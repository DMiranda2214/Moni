/**
 * Nomina.gs — Moni
 * Calculadora de nómina mensual (legislación colombiana) y registro del pago recibido.
 *   Devengado = sueldo + subsidios.  Salud y pensión (4 % c/u) sobre el IBC, redondeadas a la centena superior.
 *   IBC = sueldo + subsidios salariales.  Fondo de Solidaridad Pensional (1 %) si el IBC llega a 4 SMMLV.
 *   Extras del mes: prima en junio y diciembre (IBC / 2) e intereses de cesantías en enero (IBC × tasa).
 *   Neto = devengado − deducciones + extras.
 * Las cifras coinciden con el Excel de referencia (ver pruebas).
 */

/** Parámetros de nómina desde Config, con valores por defecto. */
function parametrosNomina_() {
  const mapa = {};
  getTableData('Config').forEach(c => { mapa[c.Clave] = c.Valor; });
  const num = (k, defecto) => { const n = Number(mapa[k]); return isFinite(n) && String(mapa[k]).trim() !== '' ? n : defecto; };
  return {
    aporteSalud: num('Aporte_Salud', 0.04),
    aportePension: num('Aporte_Pension', 0.04),
    redondeo: num('Redondeo_Aportes', -2),
    smmlv: num('SMMLV', 1423500),
    fspUmbral: num('FSP_Umbral_SMMLV', 4),
    tasaCesantias: num('Tasa_Interes_Cesantias', 0.12)
  };
}

/** Redondeo de aportes de la PILA: por defecto a la centena superior (164.219 → 164.300). */
function redondearPila_(valor, regla) {
  return regla === -2 ? Math.ceil(valor / 100) * 100 : Math.round(valor);
}

/**
 * Cálculo puro (sin leer hojas), para poder probarlo con cifras conocidas.
 * @param {Object} p parámetros de parametrosNomina_()
 * @param {number} sueldo sueldo base del escenario
 * @param {Array} subsidios [{ Nombre, Valor, Es_Salarial }]
 * @param {string} periodo AAAA-MM
 */
function calcularNomina_(p, sueldo, subsidios, periodo) {
  const devengos = [{ concepto: 'Sueldo básico', valor: sueldo, esSalarial: true }];
  let devengado = sueldo;
  let ibc = sueldo;

  subsidios.forEach(s => {
    const v = Number(s.Valor) || 0;
    if (v <= 0) return;
    const sal = esVerdadero(s.Es_Salarial);
    devengos.push({ concepto: s.Nombre, valor: v, esSalarial: sal });
    devengado += v;
    if (sal) ibc += v;
  });

  const deducciones = [
    { concepto: 'Salud (' + Math.round(p.aporteSalud * 100) + ' %)', valor: redondearPila_(ibc * p.aporteSalud, p.redondeo) },
    { concepto: 'Pensión (' + Math.round(p.aportePension * 100) + ' %)', valor: redondearPila_(ibc * p.aportePension, p.redondeo) }
  ];
  if (ibc >= p.fspUmbral * p.smmlv) {
    deducciones.push({ concepto: 'Fondo de Solidaridad Pensional (1 %)', valor: redondearPila_(ibc * 0.01, p.redondeo) });
  }

  const mes = Number(periodo.slice(5, 7));
  const extras = [];
  if (mes === 6 || mes === 12) extras.push({ concepto: 'Prima de servicios (' + (mes === 6 ? 'primer' : 'segundo') + ' semestre)', valor: redondear2_(ibc / 2) });
  if (mes === 1) extras.push({ concepto: 'Intereses de cesantías (' + Math.round(p.tasaCesantias * 100) + ' % anual)', valor: redondear2_(ibc * p.tasaCesantias) });

  const totalDed = deducciones.reduce((a, d) => a + d.valor, 0);
  const totalExt = extras.reduce((a, e) => a + e.valor, 0);
  return {
    periodo: periodo, ibc: redondear2_(ibc), devengos: devengos, deducciones: deducciones, extras: extras,
    totales: {
      devengado: redondear2_(devengado), deducciones: redondear2_(totalDed), extras: redondear2_(totalExt),
      neto: redondear2_(devengado - totalDed + totalExt)
    }
  };
}

/** Escenario de nómina elegido o, si no se indica, el vigente. */
function escenarioNomina_(idEsc) {
  const todos = leer_('Nomina_Escenarios').filter(e => estaActivo(e));
  if (!todos.length) throw new Error('Aún no hay escenarios de nómina. Crea uno en Ajustes → Nómina.');
  const esc = idEsc ? todos.find(e => e.ID_Nomina_Esc === idEsc) : (todos.find(e => esVerdadero(e.Vigente)) || todos[0]);
  if (!esc) throw new Error('El escenario de nómina no existe o está desactivado.');
  return esc;
}

/** Cálculo de un escenario para un mes, leyendo sus subsidios vigentes. */
function calcularNominaEscenario_(esc, periodo) {
  const subsidios = leer_('Subsidios').filter(s => estaActivo(s));
  const ids = subsidiosDeEscenario_(esc.ID_Nomina_Esc);
  const hoy = periodo + '-28'; // un día cualquiera del mes para respetar la vigencia
  const aplicables = subsidios.filter(s => ids.indexOf(s.ID_Subsidio) !== -1 &&
    (!s.Vigente_Desde || s.Vigente_Desde <= hoy) && (!s.Vigente_Hasta || s.Vigente_Hasta >= periodo + '-01'));
  const calculo = calcularNomina_(parametrosNomina_(), Number(esc.Sueldo_Base) || 0, aplicables, periodo);
  calculo.escenario = { ID_Nomina_Esc: esc.ID_Nomina_Esc, Nombre: esc.Nombre, Sueldo_Base: Number(esc.Sueldo_Base) || 0, Vigente: esVerdadero(esc.Vigente) };
  return calculo;
}

/** Todo lo de la pantalla de nómina de un mes, en una sola llamada. */
function obtenerNominaMes(periodo, idEsc) {
  const p = mesValido_(periodo || hoyIso_().slice(0, 7));
  const escenarios = leer_('Nomina_Escenarios').filter(e => estaActivo(e));
  const pago = leer_('Nomina_Pagos').find(n => n.Periodo === p && !esVerdadero(n.Anulado));

  let calculo = null, error = '';
  try { calculo = calcularNominaEscenario_(escenarioNomina_(idEsc), p); } catch (e) { error = e.message; }

  const comparacion = escenarios.map(e => {
    const c = calcularNominaEscenario_(e, p);
    return { ID_Nomina_Esc: e.ID_Nomina_Esc, Nombre: e.Nombre, Vigente: esVerdadero(e.Vigente), Sueldo_Base: Number(e.Sueldo_Base) || 0, devengado: c.totales.devengado, deducciones: c.totales.deducciones, extras: c.totales.extras, neto: c.totales.neto };
  });

  return {
    periodo: p, calculo: calculo, error: error, comparacion: comparacion,
    pago: pago ? { ID_Nomina: pago.ID_Nomina, Estado: pago.Estado, Neto_Estimado: Number(pago.Neto_Estimado) || 0, Neto_Real: Number(pago.Neto_Real) || 0, Fecha_Pago: pago.Fecha_Pago, ID_Bolsillo_Destino: pago.ID_Bolsillo_Destino, ID_Mov: pago.ID_Mov } : null
  };
}

/**
 * Registra la nómina recibida: guarda el cálculo del mes (con su detalle congelado) y crea el
 * ingreso en el bolsillo elegido. Solo un pago por mes.
 */
function registrarPagoNomina(periodo, idEsc, netoReal, fecha, idBolsillo) {
  const p = mesValido_(periodo);
  if (leer_('Nomina_Pagos').some(n => n.Periodo === p && !esVerdadero(n.Anulado))) {
    throw new Error('La nómina de ese mes ya está registrada. Anúlala primero si necesitas corregirla.');
  }
  const esc = escenarioNomina_(idEsc);
  const calculo = calcularNominaEscenario_(esc, p);
  const neto = numero_(netoReal === undefined || netoReal === '' ? calculo.totales.neto : netoReal, 'El neto recibido', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const f = fechaMovimiento_(fecha);
  exigirPesos_(idBolsillo, 'El bolsillo donde llega la nómina');

  const catSalario = leer_('Categorias').find(c => c.ID_Categoria === 'cat-salario' && estaActivo(c));
  const mov = registrarMovimiento({
    Tipo_Mov: 'Ingreso', Subtipo: 'Nomina', Valor: neto, Fecha: f, Concepto: 'Nómina ' + p,
    ID_Bolsillo: idBolsillo, ID_Categoria: catSalario ? catSalario.ID_Categoria : '', Notas: 'Escenario: ' + esc.Nombre
  });

  const idNomina = nuevoId_('nom');
  insertRow('Nomina_Pagos', {
    ID_Nomina: idNomina, Periodo: p, ID_Nomina_Esc: esc.ID_Nomina_Esc, Estado: 'Recibido',
    Devengado: calculo.totales.devengado, Deducciones: calculo.totales.deducciones, Extras: calculo.totales.extras,
    Neto_Estimado: calculo.totales.neto, Neto_Real: neto, Fecha_Pago: f, ID_Bolsillo_Destino: idBolsillo,
    ID_Mov: mov.ID_Mov, Notas: 'Escenario: ' + esc.Nombre, Origen: 'App', Anulado: false
  });

  const detalle = [];
  calculo.devengos.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Devengo', Concepto: d.concepto, Valor: d.valor }));
  calculo.deducciones.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Deduccion', Concepto: d.concepto, Valor: d.valor }));
  calculo.extras.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Extra', Concepto: d.concepto, Valor: d.valor }));
  insertRows('Nomina_Pagos_Detalle', detalle);

  return { idNomina: idNomina, idMov: mov.ID_Mov, neto: neto, periodo: p };
}

/** Anula la nómina registrada de un mes y su ingreso. */
function anularPagoNomina(periodo) {
  const p = mesValido_(periodo);
  const pago = leer_('Nomina_Pagos').find(n => n.Periodo === p && !esVerdadero(n.Anulado));
  if (!pago) throw new Error('No hay una nómina registrada en ese mes.');
  if (pago.ID_Mov) anularMovimiento(pago.ID_Mov);
  updateRow('Nomina_Pagos', pago._rowIndex, { Anulado: true });
  return { idMov: pago.ID_Mov, periodo: p };
}
