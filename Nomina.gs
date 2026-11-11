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
    tasaCesantias: num('Tasa_Interes_Cesantias', 0.12),
    diasBase: num('Dias_Base', 30),
    // Intereses de cesantías: el año se parte en dos tramos si el sueldo cambió (como en el Excel original).
    cesDiasActual: num('Cesantias_Dias_Actual', 360),
    cesSueldoAnterior: num('Cesantias_Sueldo_Anterior', 0)
  };
}

/** Redondeo de aportes de la PILA: por defecto a la centena superior (164.219 → 164.300). */
function redondearPila_(valor, regla) {
  return regla === -2 ? Math.ceil(valor / 100) * 100 : Math.round(valor);
}

/** Intereses de cesantías de un tramo del año: cesantías (sueldo × días / 360) × días × tasa / 360. */
function interesCesantiasTramo_(sueldo, dias, tasa) {
  return (sueldo * dias / 360) * dias * tasa / 360;
}

/**
 * Cálculo puro (sin leer hojas), para poder probarlo con cifras conocidas.
 *
 * Cada línea tiene una clave y se puede incluir o no, como las casillas del estimado del Excel original:
 *   ordinario (días × sueldo / días base) · sub:<nombre> · prima (días × día base) · vacaciones (días × día base)
 *   · intereses · salud · pension · fsp · otro:<id>
 * Salud, pensión y FSP se calculan sobre el IBC = ordinario + subsidios salariales + vacaciones (la prima y las
 * cesantías no cotizan). La prima y las vacaciones valen días × (sueldo + subsidios salariales) / días base.
 *
 * @param {Object} p parámetros de parametrosNomina_()
 * @param {number} sueldo sueldo base del escenario
 * @param {Array} subsidios [{ Nombre, Valor, Es_Salarial }]
 * @param {string} periodo AAAA-MM
 * @param {Object} [opc] { dias, diasPrima, diasVacaciones, incluir: { clave: bool }, otros: [{ ID, Tipo: Devengo|Deduccion|Extra, Concepto, Valor, Es_Salarial, Adicional }] }
 *   Los "otros" son los conceptos fijos de la nómina y los adicionales del mes (horas extras, un bono, el pago de cesantías,
 *   un descuento de la empresa…). Un Extra es una prestación: suma al neto pero no cotiza.
 */
function calcularNomina_(p, sueldo, subsidios, periodo, opc) {
  const o = opc || {};
  const incl = o.incluir || {};
  const mes = Number(periodo.slice(5, 7));
  const base = p.diasBase || 30;
  const dias = o.dias === undefined || o.dias === '' || o.dias === null ? base : Math.max(0, Math.min(base, Number(o.dias) || 0));
  const dec = (clave, defecto) => incl[clave] === undefined ? defecto : !!incl[clave];

  const lineas = [];
  const agregar = (clave, grupo, concepto, valor, defecto, extra) => lineas.push(Object.assign({
    clave: clave, grupo: grupo, concepto: concepto, valor: redondear2_(valor), incluido: dec(clave, defecto), esSalarial: false
  }, extra || {}));

  // Devengos
  const ordinario = sueldo * dias / base;
  agregar('ordinario', 'devengo', dias === base ? 'Sueldo básico' : 'Sueldo básico (' + dias + ' días)', ordinario, true, { esSalarial: true, dias: dias });

  let salarialSubs = 0;
  (subsidios || []).forEach(s => {
    const v = Number(s.Valor) || 0;
    if (v <= 0) return;
    const sal = esVerdadero(s.Es_Salarial);
    const clave = 'sub:' + s.Nombre;
    agregar(clave, 'devengo', s.Nombre, v, true, { esSalarial: sal });
    if (sal && dec(clave, true)) salarialSubs += v;
  });
  (o.otros || []).filter(x => x.Tipo === 'Devengo').forEach(x => {
    const v = Number(x.Valor) || 0;
    if (v <= 0) return;
    const sal = esVerdadero(x.Es_Salarial), clave = 'otro:' + x.ID;
    agregar(clave, 'devengo', x.Concepto, v, true, { esSalarial: sal, propio: true, adicional: !!x.Adicional });
    if (sal && dec(clave, true)) salarialSubs += v;
  });

  // Prestaciones adicionales del mes (por ejemplo el pago de cesantías): suman al neto, no cotizan.
  (o.otros || []).filter(x => x.Tipo === 'Extra').forEach(x => {
    const v = Number(x.Valor) || 0;
    if (v > 0) agregar('otro:' + x.ID, 'extra', x.Concepto, v, true, { propio: true, adicional: !!x.Adicional });
  });

  // Prima y vacaciones: días × día base (el día base incluye los subsidios salariales)
  const diaBase = (sueldo + salarialSubs) / base;
  const diasPrima = o.diasPrima === undefined || o.diasPrima === '' ? ((mes === 6 || mes === 12) ? 15 : 0) : Math.max(0, Number(o.diasPrima) || 0);
  const diasVac = o.diasVacaciones === undefined || o.diasVacaciones === '' ? 0 : Math.max(0, Number(o.diasVacaciones) || 0);
  agregar('prima', 'extra', 'Prima de servicios' + (mes === 6 ? ' (primer semestre)' : mes === 12 ? ' (segundo semestre)' : ''), diasPrima * diaBase, diasPrima > 0, { dias: diasPrima });
  agregar('vacaciones', 'extra', 'Vacaciones', diasVac * diaBase, diasVac > 0, { esSalarial: true, dias: diasVac });

  // Intereses de cesantías (casi siempre en enero)
  const diasActual = p.cesDiasActual === undefined ? 360 : Math.max(0, Math.min(360, p.cesDiasActual));
  const interes = interesCesantiasTramo_(sueldo + salarialSubs, diasActual, p.tasaCesantias) +
    (p.cesSueldoAnterior > 0 ? interesCesantiasTramo_(p.cesSueldoAnterior, 360 - diasActual, p.tasaCesantias) : 0);
  agregar('intereses', 'extra', 'Intereses de cesantías (' + Math.round(p.tasaCesantias * 100) + ' % anual)', interes, mes === 1);

  // IBC: lo que cotiza
  const lv = clave => lineas.find(l => l.clave === clave);
  const ibc = (lv('ordinario').incluido ? ordinario : 0) + salarialSubs + (lv('vacaciones').incluido ? lv('vacaciones').valor : 0);

  // Deducciones
  const deduccion = (clave, concepto, valor, defecto) => agregar(clave, 'deduccion', concepto, valor, defecto);
  deduccion('salud', 'Salud (' + Math.round(p.aporteSalud * 100) + ' %)', redondearPila_(ibc * p.aporteSalud, p.redondeo), true);
  deduccion('pension', 'Pensión (' + Math.round(p.aportePension * 100) + ' %)', redondearPila_(ibc * p.aportePension, p.redondeo), true);
  if (ibc >= p.fspUmbral * p.smmlv) deduccion('fsp', 'Fondo de Solidaridad Pensional (1 %)', redondearPila_(ibc * 0.01, p.redondeo), true);
  (o.otros || []).filter(x => x.Tipo === 'Deduccion').forEach(x => {
    const v = Number(x.Valor) || 0;
    if (v > 0) agregar('otro:' + x.ID, 'deduccion', x.Concepto, v, true, { propio: true, adicional: !!x.Adicional });
  });

  const activos = g => lineas.filter(l => l.grupo === g && l.incluido);
  const lista = g => activos(g).map(l => ({ concepto: l.concepto, valor: l.valor, esSalarial: l.esSalarial }));
  const suma = g => activos(g).reduce((a, l) => a + l.valor, 0);
  const devengado = suma('devengo'), totalDed = suma('deduccion'), totalExt = suma('extra');
  return {
    periodo: periodo, ibc: redondear2_(ibc), diaBase: redondear2_(diaBase), dias: dias, diasBase: base,
    lineas: lineas, devengos: lista('devengo'), deducciones: lista('deduccion'), extras: lista('extra'),
    totales: {
      devengado: redondear2_(devengado), deducciones: redondear2_(totalDed), extras: redondear2_(totalExt),
      neto: redondear2_(devengado - totalDed + totalExt)
    }
  };
}

/**
 * La nómina de la persona. Por dentro sigue siendo un "escenario" (así se conservan los datos de quien ya tenía uno),
 * pero ahora solo hay uno: el vigente. `idEsc` solo se respeta si se pide uno concreto.
 */
function escenarioNomina_(idEsc) {
  const todos = leer_('Nomina_Escenarios').filter(e => estaActivo(e));
  if (!todos.length) throw new Error('Aún no configuras tu nómina. Escribe tu sueldo en Más → Nómina.');
  const esc = idEsc ? todos.find(e => e.ID_Nomina_Esc === idEsc) : (todos.find(e => esVerdadero(e.Vigente)) || todos[0]);
  if (!esc) throw new Error('El escenario de nómina no existe o está desactivado.');
  return esc;
}

/** Otros conceptos fijos de un escenario (descuentos como una libranza, o ingresos como un bono): son filas de Nomina_Conceptos sin subsidio. */
function conceptosFijosNomina_(idEsc) {
  return leer_('Nomina_Conceptos').filter(c => c.ID_Nomina_Esc === idEsc && estaActivo(c) && !c.ID_Subsidio && (c.Tipo === 'Devengo' || c.Tipo === 'Deduccion'))
    .map(c => ({ ID: c.ID_Concepto, Tipo: c.Tipo, Concepto: c.Concepto, Valor: Number(c.Valor_Fijo) || 0, Es_Salarial: c.Tipo_Calculo === 'Fijo_Salarial' }));
}

/**
 * Lo que la persona agrega solo para el pago de un mes (no se guarda como fijo): horas extras, un bono, la prima,
 * el pago de cesantías, un descuento de la empresa…  [{ Tipo: Devengo|Deduccion|Extra, Concepto, Valor, Es_Salarial }]
 */
function adicionalesNomina_(lista) {
  if (lista === undefined || lista === null || lista === '') return [];
  if (!Array.isArray(lista)) throw new Error('Los conceptos adicionales no son válidos.');
  if (lista.length > 30) throw new Error('Son demasiados conceptos adicionales (máximo 30).');
  return lista.map((x, i) => {
    const tipo = opcion_(x && x.Tipo, ['Devengo', 'Deduccion', 'Extra'], 'El tipo del concepto ' + (i + 1));
    return {
      ID: 'adic-' + i, Adicional: true, Tipo: tipo,
      Concepto: textoRequerido_(x.Concepto, 'El nombre del concepto ' + (i + 1)).slice(0, 80),
      Valor: numero_(x.Valor, 'El valor de "' + texto_(x.Concepto) + '"', { requerido: true, min: 0.01, max: VALOR_MAXIMO }),
      Es_Salarial: tipo === 'Devengo' && esVerdadero(x.Es_Salarial)
    };
  });
}

/** Cálculo de un escenario para un mes, leyendo sus subsidios vigentes. */
function calcularNominaEscenario_(esc, periodo, opciones) {
  const subsidios = leer_('Subsidios').filter(s => estaActivo(s));
  const ids = subsidiosDeEscenario_(esc.ID_Nomina_Esc);
  const hoy = periodo + '-28'; // un día cualquiera del mes para respetar la vigencia
  const aplicables = subsidios.filter(s => ids.indexOf(s.ID_Subsidio) !== -1 &&
    (!s.Vigente_Desde || s.Vigente_Desde <= hoy) && (!s.Vigente_Hasta || s.Vigente_Hasta >= periodo + '-01'));
  const opc = Object.assign({}, opciones || {}, { otros: conceptosFijosNomina_(esc.ID_Nomina_Esc).concat(adicionalesNomina_(opciones && opciones.adicionales)) });
  const calculo = calcularNomina_(parametrosNomina_(), Number(esc.Sueldo_Base) || 0, aplicables, periodo, opc);
  calculo.escenario = { ID_Nomina_Esc: esc.ID_Nomina_Esc, Nombre: esc.Nombre, Sueldo_Base: Number(esc.Sueldo_Base) || 0, Vigente: esVerdadero(esc.Vigente) };
  return calculo;
}

/**
 * El mes del próximo pago: el actual si todavía no se registró la nómina y no ha pasado el día de pago;
 * si no, el siguiente. Es el mes que el estimado muestra al abrir.
 */
function mesProximoPagoNomina_() {
  const hoy = hoyIso_(), mes = hoy.slice(0, 7);
  const diaPago = Number(cfgValor_('Nomina_Dia_Pago')) || 30;
  const registrada = leer_('Nomina_Pagos').some(n => n.Periodo === mes && !esVerdadero(n.Anulado));
  if (!registrada && Number(hoy.slice(8, 10)) <= diaPago) return mes;
  const d = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 1));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}

/**
 * Todo lo de la pantalla de nómina de un mes, en una sola llamada.
 * @param {Object} [opciones] lo que el usuario ajustó en el estimado: { dias, diasPrima, diasVacaciones, incluir }
 */
function obtenerNominaMes(periodo, idEsc, opciones) {
  const p = mesValido_(periodo || mesProximoPagoNomina_());
  const pago = leer_('Nomina_Pagos').find(n => n.Periodo === p && !esVerdadero(n.Anulado));

  let calculo = null, error = '';
  try { calculo = calcularNominaEscenario_(escenarioNomina_(idEsc), p, opciones); } catch (e) { error = e.message; }

  return {
    periodo: p, calculo: calculo, error: error, configurada: leer_('Nomina_Escenarios').some(estaActivo),
    conceptos: calculo ? conceptosFijosNomina_(calculo.escenario.ID_Nomina_Esc) : [],
    pago: pago ? { ID_Nomina: pago.ID_Nomina, Estado: pago.Estado, Neto_Estimado: Number(pago.Neto_Estimado) || 0, Neto_Real: Number(pago.Neto_Real) || 0, Fecha_Pago: pago.Fecha_Pago, ID_Bolsillo_Destino: pago.ID_Bolsillo_Destino, ID_Mov: pago.ID_Mov, Afecta_Saldos: afectaSaldosNomina_(pago) } : null
  };
}

/** Las nóminas registradas antes de existir la columna (o con la celda vacía) sí afectaron los saldos. */
function afectaSaldosNomina_(pago) {
  return pago.Afecta_Saldos === undefined || pago.Afecta_Saldos === '' || esVerdadero(pago.Afecta_Saldos);
}

/** Nóminas vigentes registradas sin afectar saldos: cuentan como ingreso de su mes, pero no hay movimiento. [{ mes, valor }] */
function nominasInformativas_() {
  return leer_('Nomina_Pagos')
    .filter(n => !esVerdadero(n.Anulado) && !afectaSaldosNomina_(n))
    .map(n => ({ mes: String(n.Fecha_Pago || n.Periodo || '').slice(0, 7), valor: Number(n.Neto_Real) || 0 }));
}

/**
 * Registra la nómina recibida: guarda el cálculo del mes (con su detalle congelado) y crea el
 * ingreso en el bolsillo elegido. Solo un pago por mes.
 */
function registrarPagoNomina(periodo, idEsc, netoReal, fecha, idBolsillo, opciones, afectaSaldos) {
  const p = mesValido_(periodo);
  if (leer_('Nomina_Pagos').some(n => n.Periodo === p && !esVerdadero(n.Anulado))) {
    throw new Error('La nómina de ese mes ya está registrada. Anúlala primero si necesitas corregirla.');
  }
  const esc = escenarioNomina_(idEsc);
  const calculo = calcularNominaEscenario_(esc, p, opciones);
  const neto = numero_(netoReal === undefined || netoReal === '' ? calculo.totales.neto : netoReal, 'El neto recibido', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const f = fechaMovimiento_(fecha);
  // Sin afectar saldos: la nómina queda registrada (y cuenta como ingreso del mes) pero no mueve dinero ni pide bolsillo.
  const afecta = !(afectaSaldos === false || afectaSaldos === 'false');
  if (afecta) exigirPesos_(idBolsillo, 'El bolsillo donde llega la nómina');

  const catSalario = leer_('Categorias').find(c => c.ID_Categoria === 'cat-salario' && estaActivo(c));
  const mov = afecta ? registrarMovimiento({
    Tipo_Mov: 'Ingreso', Subtipo: 'Nomina', Valor: neto, Fecha: f, Concepto: 'Nómina ' + p,
    ID_Bolsillo: idBolsillo, ID_Categoria: catSalario ? catSalario.ID_Categoria : '', Notas: 'Escenario: ' + esc.Nombre
  }) : { ID_Mov: '' };

  const idNomina = nuevoId_('nom');
  insertRow('Nomina_Pagos', {
    ID_Nomina: idNomina, Periodo: p, ID_Nomina_Esc: esc.ID_Nomina_Esc, Estado: 'Recibido',
    Devengado: calculo.totales.devengado, Deducciones: calculo.totales.deducciones, Extras: calculo.totales.extras,
    Neto_Estimado: calculo.totales.neto, Neto_Real: neto, Fecha_Pago: f, ID_Bolsillo_Destino: afecta ? idBolsillo : '',
    ID_Mov: mov.ID_Mov, Notas: 'Escenario: ' + esc.Nombre + (afecta ? '' : ' · sin afectar saldos'), Origen: 'App', Anulado: false, Afecta_Saldos: afecta
  });

  const detalle = [];
  calculo.devengos.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Devengo', Concepto: d.concepto, Valor: d.valor }));
  calculo.deducciones.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Deduccion', Concepto: d.concepto, Valor: d.valor }));
  calculo.extras.forEach(d => detalle.push({ ID_Detalle: nuevoId_('ndt'), ID_Nomina: idNomina, Tipo: 'Extra', Concepto: d.concepto, Valor: d.valor }));
  insertRows('Nomina_Pagos_Detalle', detalle);

  return { idNomina: idNomina, idMov: mov.ID_Mov, neto: neto, periodo: p, afectaSaldos: afecta };
}

/** Anula la nómina registrada de un mes y su ingreso. */
function anularPagoNomina(periodo) {
  const p = mesValido_(periodo);
  const pago = leer_('Nomina_Pagos').find(n => n.Periodo === p && !esVerdadero(n.Anulado));
  if (!pago) throw new Error('No hay una nómina registrada en ese mes.');
  if (pago.ID_Mov) anularMovimiento(pago.ID_Mov);
  updateRow('Nomina_Pagos', pago._rowIndex, { Anulado: true });
  return { idMov: pago.ID_Mov, periodo: p, fecha: pago.Fecha_Pago };
}

// ---------------------------------------------------------------------------
// Otros conceptos fijos del escenario (descuentos o ingresos que se repiten cada mes)
// ---------------------------------------------------------------------------

/**
 * Crea o edita un concepto fijo: por ejemplo una libranza o la medicina prepagada (deducción), o un bono (devengo).
 * @param {Object} d { ID_Concepto?, ID_Nomina_Esc, Tipo: Devengo|Deduccion, Concepto, Valor, Es_Salarial }
 */
function guardarConceptoNomina(d) {
  if (!d || typeof d !== 'object') throw new Error('Faltan los datos del concepto.');
  const filas = leer_('Nomina_Conceptos');
  const actual = d.ID_Concepto ? buscarPorId_(filas, 'ID_Concepto', d.ID_Concepto) : null;
  if (d.ID_Concepto && !actual) throw new Error('El concepto no existe.');
  const idEsc = actual ? actual.ID_Nomina_Esc : d.ID_Nomina_Esc;
  exigirActivo_(leer_('Nomina_Escenarios'), 'ID_Nomina_Esc', idEsc, 'El escenario de nómina');
  const tipo = opcion_(d.Tipo !== undefined ? d.Tipo : actual && actual.Tipo, ['Devengo', 'Deduccion'], 'El tipo');
  const concepto = textoRequerido_(d.Concepto !== undefined ? d.Concepto : actual && actual.Concepto, 'El concepto').slice(0, 80);
  const valor = numero_(d.Valor !== undefined ? d.Valor : actual && actual.Valor_Fijo, 'El valor', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const salarial = tipo === 'Devengo' && (d.Es_Salarial !== undefined ? esVerdadero(d.Es_Salarial) : (actual ? actual.Tipo_Calculo === 'Fijo_Salarial' : false));
  const datos = { ID_Nomina_Esc: idEsc, Tipo: tipo, Concepto: concepto, Valor_Fijo: valor, Tipo_Calculo: salarial ? 'Fijo_Salarial' : 'Fijo', Activo: true };
  if (filas.some(f => (!actual || f.ID_Concepto !== actual.ID_Concepto) && f.ID_Nomina_Esc === idEsc && estaActivo(f) && f.Tipo === tipo && texto_(f.Concepto).toLowerCase() === concepto.toLowerCase())) {
    throw new Error('Ya hay un concepto llamado "' + concepto + '" en este escenario.');
  }
  if (actual) { updateRow('Nomina_Conceptos', actual._rowIndex, datos); return Object.assign({}, actual, datos); }
  const nuevo = Object.assign({ ID_Concepto: nuevoId_('nco'), Dias: '', Porcentaje: '', ID_Subsidio: '' }, datos);
  insertRow('Nomina_Conceptos', nuevo);
  return nuevo;
}

function quitarConceptoNomina(idConcepto) {
  const c = buscarPorId_(leer_('Nomina_Conceptos'), 'ID_Concepto', idConcepto);
  if (!c) throw new Error('El concepto no existe.');
  updateRow('Nomina_Conceptos', c._rowIndex, { Activo: false });
  return { ID_Nomina_Esc: c.ID_Nomina_Esc };
}

/**
 * Tu sueldo base: crea tu nómina la primera vez y después solo cambia el sueldo (los descuentos e ingresos fijos se
 * conservan). Es lo que reemplaza a los "escenarios" de nómina.
 */
function guardarMiNomina(sueldo) {
  const valor = numero_(sueldo, 'El sueldo base', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const actual = leer_('Nomina_Escenarios').filter(estaActivo).find(e => esVerdadero(e.Vigente)) || leer_('Nomina_Escenarios').find(estaActivo);
  if (actual) return guardarCatalogo('Nomina_Escenarios', { ID_Nomina_Esc: actual.ID_Nomina_Esc, Sueldo_Base: valor });
  return guardarCatalogo('Nomina_Escenarios', { Nombre: 'Mi nómina', Sueldo_Base: valor, Vigente: true });
}
