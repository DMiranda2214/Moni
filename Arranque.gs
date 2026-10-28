/**
 * Arranque.gs — Moni
 * Paso de la prueba al uso real: fecha de arranque, saldos de apertura reales, retiro de los
 * movimientos de prueba y lista de verificación antes de empezar.
 *
 * Nada se borra: los movimientos de prueba se anulan (se pueden restaurar) y el arranque deja un respaldo.
 * Una vez iniciada la operación, los saldos de apertura quedan fijos: las diferencias se corrigen con un
 * ajuste por cuadre, que deja rastro.
 */

const FECHA_ARRANQUE_DEFECTO = '2027-01-01';

/** Crea la fila de Config si todavía no existe (las bases ya instaladas no tienen las claves nuevas). */
function asegurarConfig_(clave) {
  if (getTableData('Config').some(c => c.Clave === clave)) return;
  const d = DEFAULT_CONFIG.find(item => item[0] === clave);
  if (!d) throw new Error('No hay parámetro "' + clave + '".');
  insertRow('Config', { Clave: d[0], Valor: d[1], Grupo: d[2], Tipo: d[3], Descripcion: d[4] });
}

function guardarConfig_(clave, valor) {
  asegurarConfig_(clave);
  updateRowById('Config', 'Clave', clave, { Valor: String(valor) });
}

function fechaArranque_() {
  return cfgValor_('Fecha_Arranque') || FECHA_ARRANQUE_DEFECTO;
}

function exigirSinArranque_() {
  if (esVerdadero(cfgValor_('Arranque_Hecho'))) {
    throw new Error('La operación ya empezó. Para corregir un saldo usa el cuadre de la cuenta: deja un ajuste con fecha.');
  }
}

/** Todo lo que la pantalla de Arranque necesita, en una sola llamada. */
function obtenerArranque() {
  const fecha = fechaArranque_();
  const hecho = esVerdadero(cfgValor_('Arranque_Hecho'));
  const demo = esVerdadero(cfgValor_('Datos_Demo'));
  const cuentas = getTableData('Cuentas');
  const bancos = getTableData('Bancos');
  const bolsillos = getTableData('Bolsillos').filter(estaActivo);
  const saldos = mapaSaldosBolsillos_();

  const aperturas = bolsillos.map(b => {
    const c = buscarPorId_(cuentas, 'ID_Cuenta', b.ID_Cuenta);
    const bn = c ? buscarPorId_(bancos, 'ID_Banco', c.ID_Banco) : null;
    return {
      ID_Bolsillo: b.ID_Bolsillo, Bolsillo: esVerdadero(b.Es_Interno) ? '' : b.Nombre, Cuenta: c ? c.Nombre : '', Banco: bn ? bn.Nombre : '',
      Saldo_Apertura: Number(b.Saldo_Apertura) || 0, Saldo: saldos[b.ID_Bolsillo] || 0
    };
  });

  const movs = getTableData('Movimientos', { excludeAnulados: true });
  const previos = movs.filter(m => texto_(m.Fecha) < fecha);
  const otrosPrevios = {
    comprasTC: getTableData('Compras_TC', { excludeAnulados: true }).filter(c => texto_(c.Fecha) < fecha).length,
    creditosActivos: getTableData('Creditos').filter(c => c.Estado === 'Activo').length,
    nominas: getTableData('Nomina_Pagos').length
  };

  const tienePlantilla = getTableData('Presupuesto_Plantilla').some(estaActivo);
  const respaldoAuto = disparadoresRespaldo_().length > 0;
  const catalogoListo = obtenerEstadoConfiguracion().completo;

  const checks = [
    { id: 'catalogo', titulo: 'Bancos, cuentas y bolsillos creados', hecho: catalogoListo, pantalla: 'ajustes/Cuentas' },
    { id: 'demo', titulo: 'Datos de demostración borrados', hecho: !demo, pantalla: 'ajustes/demo' },
    { id: 'apertura', titulo: 'Saldos de apertura reales cargados', hecho: aperturas.some(a => a.Saldo_Apertura !== 0), pantalla: 'ajustes/arranque' },
    { id: 'previos', titulo: 'Sin movimientos de prueba anteriores al ' + fecha, hecho: previos.length === 0, detalle: previos.length ? previos.length + ' por archivar' : '', pantalla: 'ajustes/arranque' },
    { id: 'plantilla', titulo: 'Plantilla del presupuesto lista', hecho: tienePlantilla, opcional: true, pantalla: 'ajustes/plantilla' },
    { id: 'respaldo', titulo: 'Copias de seguridad automáticas', hecho: respaldoAuto || hecho, opcional: true, detalle: 'Se activan al iniciar', pantalla: 'ajustes/respaldos' }
  ];
  const listo = checks.filter(c => !c.opcional).every(c => c.hecho);

  return {
    fecha: fecha, hecho: hecho, listo: listo, checks: checks, aperturas: aperturas,
    previos: { movimientos: previos.length, comprasTC: otrosPrevios.comprasTC },
    avisos: [].concat(
      otrosPrevios.comprasTC ? [otrosPrevios.comprasTC + ' compra(s) de tarjeta anteriores al arranque: revísalas en Deudas.'] : [],
      otrosPrevios.creditosActivos ? [otrosPrevios.creditosActivos + ' crédito(s) activo(s): confirma que su saldo y cuota corresponden a la realidad.'] : []
    ),
    totalApertura: redondear2_(aperturas.reduce((a, x) => a + x.Saldo_Apertura, 0))
  };
}

/** Cambia la fecha de arranque (antes de iniciar). */
function guardarFechaArranque(fecha) {
  exigirSinArranque_();
  const f = fechaIso_(fecha, 'La fecha de arranque');
  if (!f) throw new Error('Escribe la fecha de arranque.');
  guardarConfig_('Fecha_Arranque', f);
  return obtenerArranque();
}

/**
 * Fija los saldos de apertura de varios bolsillos a la vez. Todo o nada: si uno no es válido, no se guarda ninguno.
 * @param {Array} lista [{ ID_Bolsillo, Saldo_Apertura }]
 */
function guardarAperturas(lista) {
  exigirSinArranque_();
  if (!Array.isArray(lista) || !lista.length) throw new Error('No hay saldos que guardar.');
  const bolsillos = leer_('Bolsillos');
  const cambios = lista.map(x => {
    const b = buscarPorId_(bolsillos, 'ID_Bolsillo', x && x.ID_Bolsillo);
    if (!b) throw new Error('Uno de los bolsillos no existe.');
    return { fila: b._rowIndex, valor: numero_(x.Saldo_Apertura, 'El saldo de "' + (b.Nombre || 'la cuenta') + '"', { defecto: 0, min: -VALOR_MAXIMO, max: VALOR_MAXIMO }) };
  });
  cambios.forEach(c => updateRow('Bolsillos', c.fila, { Saldo_Apertura: c.valor }));
  return obtenerArranque();
}

/** Anula los movimientos anteriores a la fecha de arranque (la prueba). Se pueden restaurar uno a uno. */
function archivarPruebas() {
  exigirSinArranque_();
  const fecha = fechaArranque_();
  const previos = leer_('Movimientos').filter(m => !esVerdadero(m.Anulado) && texto_(m.Fecha) < fecha);
  previos.forEach(m => updateRow('Movimientos', m._rowIndex, { Anulado: true }));
  return Object.assign(obtenerArranque(), { archivados: previos.length });
}

/** Empieza la operación real: exige la lista completa, deja un respaldo y activa las copias automáticas. */
function iniciarOperacion() {
  exigirSinArranque_();
  const antes = obtenerArranque();
  if (!antes.listo) {
    const falta = antes.checks.filter(c => !c.opcional && !c.hecho).map(c => c.titulo);
    throw new Error('Todavía falta: ' + falta.join('; ') + '.');
  }
  const respaldo = crearRespaldo();
  configurarRespaldoAutomatico(true);
  guardarConfig_('Arranque_Hecho', 'TRUE');
  guardarConfig_('Anio_Activo', antes.fecha.slice(0, 4));
  return Object.assign(obtenerArranque(), { respaldo: respaldo.nombre });
}
