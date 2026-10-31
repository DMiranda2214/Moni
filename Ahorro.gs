/**
 * Ahorro.gs — Moni
 * Cuentas de ahorro: saldo, meta, rendimientos y lo que se debe al ahorro.
 *
 * No hay tablas propias: una cuenta de tipo Ahorro usa el mismo libro de movimientos, y los
 * movimientos llevan un Subtipo que dice qué son:
 *   Interes     → rendimiento ganado (ingreso).
 *   Retencion   → retención en la fuente sobre el rendimiento (gasto).
 *   GMF         → impuesto 4x1000 (gasto).
 *   Para_Gastos → dinero que se saca del ahorro para gastarlo (se debe reponer).
 *   Reposicion  → dinero que se devuelve al ahorro.
 * La deuda con el ahorro suma dos cosas: lo retirado "para gastos" menos lo repuesto, y el saldo de
 * los créditos de autopago activos (que se calcula desde su tabla de amortización).
 */

const SUBTIPOS_RENDIMIENTO = ['Interes', 'Retencion', 'GMF'];

/** Movimientos no anulados de los bolsillos de una cuenta. */
function movimientosDeCuenta_(idCuenta, bolsillos, movs) {
  const ids = {};
  bolsillos.filter(b => b.ID_Cuenta === idCuenta).forEach(b => { ids[b.ID_Bolsillo] = true; });
  return movs.filter(m => ids[m.ID_Bolsillo]);
}

/** { ID_Bolsillo: true } de los bolsillos de una cuenta. */
function idsDeCuenta_(idCuenta, bolsillos) {
  const ids = {};
  bolsillos.filter(b => b.ID_Cuenta === idCuenta).forEach(b => { ids[b.ID_Bolsillo] = true; });
  return ids;
}

/** Resumen de una cuenta de ahorro a partir de sus movimientos y los créditos activos. */
function resumenCuentaAhorro_(cuenta, bolsillos, movs, saldos, creditos) {
  const propios = movimientosDeCuenta_(cuenta.ID_Cuenta, bolsillos, movs);
  let interes = 0, retencion = 0, gmf = 0, paraGastos = 0, reposicion = 0;
  propios.forEach(m => {
    const v = Number(m.Valor) || 0;
    if (m.Subtipo === 'Interes' && v > 0) interes += v;
    else if (m.Subtipo === 'Retencion' && v < 0) retencion += -v;
    else if (m.Subtipo === 'GMF' && v < 0) gmf += -v;
    else if (m.Subtipo === 'Para_Gastos' && v < 0 && texto_(m.Notas).indexOf('Crédito ') !== 0) paraGastos += -v; // el desembolso de un crédito va por su propio saldo
    else if (m.Subtipo === 'Reposicion' && v > 0) reposicion += v;
  });

  const saldo = redondear2_(bolsillos.filter(b => b.ID_Cuenta === cuenta.ID_Cuenta).reduce((a, b) => a + (saldos[b.ID_Bolsillo] || 0), 0));
  const deudaManual = Math.max(0, redondear2_(paraGastos - reposicion));
  const deCreditos = creditos.filter(c => c.Estado === 'Activo' && c.ID_Cuenta_Ahorro === cuenta.ID_Cuenta);
  const deudaCreditos = redondear2_(deCreditos.reduce((a, c) => a + c.saldo, 0));
  const meta = Number(cuenta.Meta) || 0;

  return {
    ID_Cuenta: cuenta.ID_Cuenta, Nombre: cuenta.Nombre, Saldo: saldo, Meta: meta,
    avanceMeta: meta > 0 ? Math.min(1, Math.round(saldo / meta * 1000) / 1000) : null,
    rendimiento: { interes: redondear2_(interes), retencion: redondear2_(retencion), gmf: redondear2_(gmf), neto: redondear2_(interes - retencion - gmf) },
    deuda: { paraGastos: redondear2_(paraGastos), reposicion: redondear2_(reposicion), manual: deudaManual, creditos: deudaCreditos, total: redondear2_(deudaManual + deudaCreditos) },
    saldoSiRepones: redondear2_(saldo + deudaManual + deudaCreditos),
    creditos: deCreditos.map(c => ({ ID_Credito: c.ID_Credito, Nombre: c.Nombre, saldo: c.saldo })),
    evolucion: saldosMensuales_(idsDeCuenta_(cuenta.ID_Cuenta, bolsillos), hoyIso_().slice(0, 7), 12, movs)
  };
}

/** Todas las cuentas de ahorro activas, para la pantalla de Ahorro. */
function obtenerAhorro() {
  const divisas = mapaDivisas_().cuentas;
  const cuentas = getTableData('Cuentas').filter(c => estaActivo(c) && c.Tipo === 'Ahorro' && divisas[c.ID_Cuenta] === DIVISA_BASE);
  const bolsillos = getTableData('Bolsillos');
  const movs = getTableData('Movimientos', { excludeAnulados: true });
  const saldos = mapaSaldosBolsillos_();
  const creditos = listarCreditos();
  const bancos = getTableData('Bancos');

  const lista = cuentas.map(c => {
    const r = resumenCuentaAhorro_(c, bolsillos, movs, saldos, creditos);
    const b = buscarPorId_(bancos, 'ID_Banco', c.ID_Banco);
    r.Banco = b ? b.Nombre : '';
    return r;
  });
  const suma = f => redondear2_(lista.reduce((a, c) => a + f(c), 0));
  return {
    cuentas: lista,
    totales: { saldo: suma(c => c.Saldo), deuda: suma(c => c.deuda.total), saldoSiRepones: suma(c => c.saldoSiRepones), rendimientoNeto: suma(c => c.rendimiento.neto) }
  };
}

/** Pantalla de una cuenta de ahorro: resumen y sus movimientos del mes. */
function obtenerCuentaAhorro(idCuenta, mes) {
  const todas = obtenerAhorro();
  const cuenta = todas.cuentas.find(c => c.ID_Cuenta === idCuenta);
  if (!cuenta) throw new Error('La cuenta de ahorro no existe o no es de tipo Ahorro.');
  const m = mes ? mesValido_(mes) : hoyIso_().slice(0, 7);
  const lista = listarMovimientos({ mes: m, idCuenta: idCuenta });
  const bolsillo = bolsilloDeCuenta_(idCuenta);
  return { cuenta: cuenta, mes: m, movimientos: lista.items, totales: lista.totales, hayMas: lista.hayMas, ID_Bolsillo: bolsillo.ID_Bolsillo };
}

function cuentaAhorroActiva_(idCuenta) {
  const c = exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', idCuenta, 'La cuenta');
  if (c.Tipo !== 'Ahorro') throw new Error('"' + c.Nombre + '" no es una cuenta de ahorro.');
  exigirCuentaPesos_(c.ID_Cuenta, 'La cuenta de ahorro'); // el ahorro con deuda y rendimientos es en pesos
  return c;
}

/**
 * Registra un rendimiento: interés ganado (ingreso), o la retención y el GMF que lo descuentan (gastos).
 * @param {Object} r { ID_Cuenta, Tipo: Interes|Retencion|GMF, Valor, Fecha, Notas }
 */
function registrarRendimiento(r) {
  if (!r || typeof r !== 'object') throw new Error('Faltan los datos del rendimiento.');
  const cuenta = cuentaAhorroActiva_(r.ID_Cuenta);
  const tipo = opcion_(r.Tipo, SUBTIPOS_RENDIMIENTO, 'El tipo');
  const bolsillo = bolsilloDeCuenta_(cuenta.ID_Cuenta);
  const cat = leer_('Categorias').find(c => c.ID_Categoria === 'cat-rendim' && estaActivo(c));
  const etiqueta = { Interes: 'Rendimientos', Retencion: 'Retención en la fuente', GMF: 'GMF (4x1000)' }[tipo];
  return registrarMovimiento({
    Tipo_Mov: tipo === 'Interes' ? 'Ingreso' : 'Gasto', Subtipo: tipo, Valor: r.Valor, Fecha: r.Fecha,
    Concepto: etiqueta + ' · ' + cuenta.Nombre, ID_Bolsillo: bolsillo.ID_Bolsillo,
    ID_Categoria: tipo === 'Interes' && cat ? cat.ID_Categoria : '', Notas: r.Notas
  });
}

/** Saca dinero del ahorro para gastarlo: queda como deuda hasta que se reponga. */
function retirarParaGastos(idCuenta, idBolsilloDestino, valor, fecha, concepto) {
  const cuenta = cuentaAhorroActiva_(idCuenta);
  const origen = bolsilloDeCuenta_(cuenta.ID_Cuenta);
  return registrarTransferencia(origen.ID_Bolsillo, idBolsilloDestino, valor, fecha, texto_(concepto) || 'Para gastos · ' + cuenta.Nombre, '', 'App', { Subtipo: 'Para_Gastos' });
}

/** Devuelve dinero al ahorro (reposición). */
function reponerAhorro(idCuenta, idBolsilloOrigen, valor, fecha, concepto) {
  const cuenta = cuentaAhorroActiva_(idCuenta);
  const destino = bolsilloDeCuenta_(cuenta.ID_Cuenta);
  return registrarTransferencia(idBolsilloOrigen, destino.ID_Bolsillo, valor, fecha, texto_(concepto) || 'Reposición · ' + cuenta.Nombre, '', 'App', { Subtipo: 'Reposicion' });
}
