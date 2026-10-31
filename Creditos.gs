/**
 * Creditos.gs — Moni
 * Créditos de AUTOPAGO: la persona se presta a sí misma desde una cuenta de ahorro y se paga en
 * cuotas siguiendo una tabla de amortización francesa. Cada cuota pagada sale de un bolsillo y
 * vuelve a la cuenta de ahorro (reposición).
 *
 * El saldo lo manda la tabla de amortización, no un banco. Un pago mayor a la cuota abona el
 * excedente a capital y el plazo se recalcula: la cuota y la tasa se mantienen, el cronograma
 * pendiente se rehace con menos cuotas (la última se ajusta). Los cronogramas anteriores no se
 * borran: las cuotas reemplazadas quedan marcadas, para poder auditar o deshacer.
 */

const PERIODOS_ANIO = { Mensual: 12, Quincenal: 24 };

/**
 * Tasa periódica a partir de una tasa efectiva anual (EA).
 *   Método "Excel" (el del Excel de referencia): nominal = TASA.NOMINAL(EA; 2), luego ÷ periodos al año.
 *     EA 10 % → nominal 9,7618 % → ÷24 = 0,4067404 % por quincena.
 *   Método "Exacta": (1 + EA)^(1/periodos) − 1.
 */
function tasaDesdeEA_(ea, periodicidad, metodo) {
  const n = PERIODOS_ANIO[periodicidad] || 12;
  if (metodo === 'Exacta') return Math.pow(1 + ea, 1 / n) - 1;
  return (2 * (Math.pow(1 + ea, 1 / 2) - 1)) / n;
}

/** Cuota fija de la amortización francesa. */
function cuotaFrancesa_(monto, i, n) {
  if (i <= 0) return redondear2_(monto / n);
  return redondear2_(monto * i / (1 - Math.pow(1 + i, -n)));
}

/** Cuántas cuotas hacen falta para pagar `saldo` con esa cuota y tasa (redondeado hacia arriba). */
function plazoRestante_(saldo, i, cuota) {
  if (i <= 0) return Math.max(1, Math.ceil(saldo / cuota - 1e-9));
  if (cuota <= saldo * i + 1e-9) throw new Error('La cuota no alcanza a cubrir los intereses del saldo.');
  return Math.max(1, Math.ceil(-Math.log(1 - saldo * i / cuota) / Math.log(1 + i) - 1e-9));
}

function ultimoDiaMes_(anio, mes) { return new Date(Date.UTC(anio, mes, 0)).getUTCDate(); }

/**
 * Fecha prevista de la cuota número `num`, contando desde la fecha de inicio.
 *   Mensual: el mismo día de cada mes (o el último si el mes es más corto).
 *   Quincenal: los días 15 y último de cada mes.
 */
function fechaCuota_(inicio, periodicidad, num) {
  const p = inicio.split('-').map(Number);
  if (periodicidad === 'Mensual') {
    const idx = p[1] - 1 + num;
    const anio = p[0] + Math.floor(idx / 12);
    const mes = ((idx % 12) + 12) % 12 + 1;
    return anio + '-' + dosDigitos_(mes) + '-' + dosDigitos_(Math.min(p[2], ultimoDiaMes_(anio, mes)));
  }
  let a = p[0], m = p[1], d = p[2];
  for (let k = 0; k < num; k++) {
    const ult = ultimoDiaMes_(a, m);
    if (d < 15) d = 15;
    else if (d < ult) d = ult;
    else { d = 15; m++; if (m > 12) { m = 1; a++; } }
  }
  return a + '-' + dosDigitos_(m) + '-' + dosDigitos_(d);
}

/**
 * Genera filas de cronograma desde un saldo. La última cuota se ajusta para dejar el saldo en cero.
 * @param {number} saldo saldo inicial
 * @param {number} i tasa periódica
 * @param {number} cuota cuota fija
 * @param {number} numInicial número de la primera cuota que se genera
 * @param {number} maxCuotas cuántas cuotas como máximo
 * @param {function} fechaDe (num) → fecha prevista
 */
function generarCronograma_(saldo, i, cuota, numInicial, maxCuotas, fechaDe) {
  const filas = [];
  let s = redondear2_(saldo);
  for (let c = 0; c < maxCuotas && s > SALDO_CERO; c++) {
    const num = numInicial + c;
    const interes = redondear2_(s * i);
    let valor = cuota;
    let capital = redondear2_(valor - interes);
    if (capital <= 0) throw new Error('La cuota no alcanza a cubrir los intereses.');
    if (c === maxCuotas - 1 || capital >= s - SALDO_CERO) { capital = s; valor = redondear2_(capital + interes); }
    const saldoFinal = redondear2_(s - capital);
    filas.push({ Num: num, Fecha_Prevista: fechaDe(num), Saldo_Inicial: s, Cuota: valor, Interes: interes, Capital: capital, Saldo_Final: saldoFinal });
    s = saldoFinal;
  }
  return filas;
}

/** Bolsillo de una cuenta donde se registra el dinero de un crédito: el interno o el primero activo. */
function bolsilloDeCuenta_(idCuenta) {
  const delaCuenta = leer_('Bolsillos').filter(b => b.ID_Cuenta === idCuenta && estaActivo(b));
  const b = delaCuenta.find(x => esVerdadero(x.Es_Interno)) || delaCuenta[0];
  if (!b) throw new Error('La cuenta de ahorro no tiene un bolsillo activo donde registrar el dinero.');
  return b;
}

function cronogramaVigente_(idCredito) {
  return leer_('Creditos_Cronograma').filter(f => f.ID_Credito === idCredito && f.Estado !== 'Reemplazada')
    .sort((a, b) => Number(a.Num) - Number(b.Num));
}

function filaCronograma_(idCredito, version, f, estado) {
  return {
    ID_Cuota: nuevoId_('cuo'), ID_Credito: idCredito, Version: version, Num: f.Num, Fecha_Prevista: f.Fecha_Prevista,
    Saldo_Inicial: f.Saldo_Inicial, Cuota: f.Cuota, Interes: f.Interes, Capital: f.Capital, Saldo_Final: f.Saldo_Final, Estado: estado || 'Pendiente'
  };
}

/** Parámetros ya validados de un crédito nuevo (sin escribir nada). */
function normalizarCredito_(c) {
  if (!c || typeof c !== 'object') throw new Error('Faltan los datos del crédito.');
  const creditos = leer_('Creditos');
  const nombre = textoRequerido_(c.Nombre, 'El nombre').slice(0, 80);
  if (creditos.some(x => x.Estado !== 'Anulado' && x.Estado !== 'Pagado' && texto_(x.Nombre).toLowerCase() === nombre.toLowerCase())) {
    throw new Error('Ya hay un crédito activo llamado "' + nombre + '".');
  }
  if (c.ID_Persona) exigirActivo_(leer_('Personas'), 'ID_Persona', c.ID_Persona, 'La persona');
  const cuenta = exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', c.ID_Cuenta_Ahorro, 'La cuenta de ahorro');
  if (cuenta.Tipo !== 'Ahorro') throw new Error('El dinero de un crédito sale de una cuenta de tipo Ahorro. "' + cuenta.Nombre + '" no lo es.');
  exigirCuentaPesos_(cuenta.ID_Cuenta, 'La cuenta de ahorro');
  exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', c.ID_Bolsillo_Pago, 'El bolsillo desde el que pagas');
  exigirPesos_(c.ID_Bolsillo_Pago, 'El bolsillo desde el que pagas');

  const monto = numero_(c.Monto, 'El monto', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const periodicidad = opcion_(c.Periodicidad || 'Mensual', ENUMS.Creditos.Periodicidad, 'La periodicidad');
  const n = numero_(c.Num_Periodos, 'El número de cuotas', { requerido: true, entero: true, min: 1, max: 360 });
  const inicio = fechaMovimiento_(c.Fecha_Inicio);
  const metodo = opcion_(c.Metodo_Tasa || cfgValor_('Credito_Metodo_Tasa') || 'Excel', ENUMS.Creditos.Metodo_Tasa, 'El método de tasa');

  let tasa;
  if (c.Tasa_Periodica !== undefined && c.Tasa_Periodica !== '' && c.Tasa_Periodica !== null) {
    tasa = numero_(c.Tasa_Periodica, 'La tasa por periodo', { min: 0, max: 1 });
  } else if (c.EA !== undefined && c.EA !== '' && c.EA !== null) {
    tasa = tasaDesdeEA_(numero_(c.EA, 'La tasa efectiva anual', { min: 0, max: 5 }), periodicidad, metodo);
  } else {
    tasa = 0;
  }
  tasa = Math.round(tasa * 1e9) / 1e9;

  const cuota = (c.Cuota_Fija !== undefined && c.Cuota_Fija !== '' && c.Cuota_Fija !== null)
    ? numero_(c.Cuota_Fija, 'La cuota', { min: 0.01, max: VALOR_MAXIMO })
    : cuotaFrancesa_(monto, tasa, n);
  const pagadas = numero_(c.cuotasPagadas, 'Las cuotas ya pagadas', { entero: true, min: 0, max: n - 1, defecto: 0 });

  return { nombre: nombre, idPersona: c.ID_Persona || '', idCuenta: cuenta.ID_Cuenta, idBolsilloPago: c.ID_Bolsillo_Pago, monto: monto,
    periodicidad: periodicidad, n: n, inicio: inicio, metodo: metodo, tasa: tasa, cuota: cuota, pagadas: pagadas,
    desembolsar: c.desembolsar !== false && pagadas === 0, notas: texto_(c.Notas).slice(0, 300) };
}

function cfgValor_(clave) {
  const f = getTableData('Config').find(x => x.Clave === clave);
  return f ? texto_(f.Valor) : '';
}

/** Vista previa de un crédito nuevo: cuota, total a pagar y primeras cuotas. No escribe nada. */
function previsualizarCredito(c) {
  const p = normalizarCredito_(c);
  const filas = generarCronograma_(p.monto, p.tasa, p.cuota, 1, p.n, num => fechaCuota_(p.inicio, p.periodicidad, num));
  const interes = redondear2_(filas.reduce((a, f) => a + f.Interes, 0));
  return { cuota: p.cuota, tasaPeriodica: p.tasa, cuotas: filas.length, interesTotal: interes, totalAPagar: redondear2_(p.monto + interes), primera: filas[0] || null, ultima: filas[filas.length - 1] || null };
}

/**
 * Crea un crédito con su cronograma. `cuotasPagadas` sirve para registrar uno que ya viene en marcha
 * (las primeras cuotas quedan como pagadas, sin movimientos). Con `desembolsar` (por defecto sí, si es
 * un crédito nuevo) se registra la salida del dinero de la cuenta de ahorro.
 */
function registrarCredito(c) {
  const p = normalizarCredito_(c);
  const filas = generarCronograma_(p.monto, p.tasa, p.cuota, 1, p.n, num => fechaCuota_(p.inicio, p.periodicidad, num));
  const idCredito = c.ID_Credito ? texto_(c.ID_Credito) : nuevoId_('cre'); // el ID propio solo lo usan los datos de demostración

  const ids = [];
  if (p.desembolsar) {
    const b = bolsilloDeCuenta_(p.idCuenta);
    const mov = registrarMovimiento({ Tipo_Mov: 'Gasto', Subtipo: 'Para_Gastos', Valor: p.monto, Fecha: p.inicio, Concepto: 'Préstamo: ' + p.nombre, ID_Bolsillo: b.ID_Bolsillo, Notas: 'Crédito ' + idCredito });
    ids.push(mov.ID_Mov);
  }

  try {
    insertRow('Creditos', {
      ID_Credito: idCredito, Nombre: p.nombre, ID_Persona: p.idPersona, ID_Cuenta_Ahorro: p.idCuenta, ID_Bolsillo_Pago: p.idBolsilloPago,
      Fecha_Inicio: p.inicio, Monto: p.monto, Tasa_Periodica: p.tasa, Periodicidad: p.periodicidad, Num_Periodos: filas.length,
      Cuota_Fija: p.cuota, Metodo_Tasa: p.metodo, Estado: 'Activo', Notas: p.notas
    });
    insertRows('Creditos_Cronograma', filas.map(f => filaCronograma_(idCredito, 1, f, f.Num <= p.pagadas ? 'Pagada' : 'Pendiente')));
  } catch (e) {
    ids.forEach(id => { try { anularMovimiento(id); } catch (x) {} });
    throw e;
  }
  return { idCredito: idCredito, cuota: p.cuota, cuotas: filas.length, ids: ids };
}

/** Qué pasaría al pagar `valor`: la cuota, el excedente a capital y el plazo nuevo. No escribe nada. */
function planPagoCredito_(credito, vigente, valor) {
  const pendientes = vigente.filter(f => f.Estado === 'Pendiente');
  if (!pendientes.length || credito.Estado !== 'Activo') throw new Error('Este crédito ya no tiene cuotas pendientes.');
  const k = pendientes[0];
  const cuota = Number(k.Cuota);
  const v = numero_(valor === undefined || valor === '' ? cuota : valor, 'El valor del pago', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  if (v < cuota - SALDO_CERO) throw new Error('El pago debe cubrir al menos la cuota (' + pesos_(cuota) + ').');

  const saldoTrasCuota = redondear2_(Number(k.Saldo_Final));
  let excedente = redondear2_(v - cuota);
  if (excedente > saldoTrasCuota) excedente = saldoTrasCuota; // solo se cobra lo necesario
  if (excedente < SALDO_CERO) excedente = 0;

  const saldoDespues = redondear2_(saldoTrasCuota - excedente);
  const i = Number(credito.Tasa_Periodica) || 0;
  let nuevo = [];
  let plazoRestante = pendientes.length - 1;
  if (saldoDespues >= SALDO_CERO && excedente > 0) {
    plazoRestante = plazoRestante_(saldoDespues, i, Number(credito.Cuota_Fija));
    nuevo = generarCronograma_(saldoDespues, i, Number(credito.Cuota_Fija), Number(k.Num) + 1, plazoRestante, num => fechaCuota_(credito.Fecha_Inicio, credito.Periodicidad, num));
  }
  if (saldoDespues < SALDO_CERO) plazoRestante = 0;

  return {
    cuota: k, valorCobrado: redondear2_(cuota + excedente), excedente: excedente, saldoDespues: saldoDespues < SALDO_CERO ? 0 : saldoDespues,
    cancela: saldoDespues < SALDO_CERO || (excedente === 0 && pendientes.length === 1),
    cuotasRestantesAntes: pendientes.length - 1, cuotasRestantes: plazoRestante, cuotasAhorradas: Math.max(0, (pendientes.length - 1) - plazoRestante),
    nuevoCronograma: nuevo, pendientesReemplazadas: pendientes.slice(1)
  };
}

function creditoActivo_(idCredito) {
  const c = buscarPorId_(leer_('Creditos'), 'ID_Credito', idCredito);
  if (!c) throw new Error('El crédito no existe.');
  return c;
}

/** Vista previa de un pago (para mostrarla antes de confirmar). */
function previsualizarPagoCredito(idCredito, valor) {
  const credito = creditoActivo_(idCredito);
  const p = planPagoCredito_(credito, cronogramaVigente_(idCredito), valor);
  return {
    Num: Number(p.cuota.Num), cuota: Number(p.cuota.Cuota), interes: Number(p.cuota.Interes), capital: Number(p.cuota.Capital),
    valorCobrado: p.valorCobrado, excedente: p.excedente, saldoDespues: p.saldoDespues, cancela: p.cancela,
    cuotasRestantesAntes: p.cuotasRestantesAntes, cuotasRestantes: p.cuotasRestantes, cuotasAhorradas: p.cuotasAhorradas
  };
}

/**
 * Paga la siguiente cuota (y, si el valor es mayor, abona el excedente a capital).
 * Mueve dinero del bolsillo de pago a la cuenta de ahorro de origen (reposición).
 */
function registrarPagoCredito(idCredito, valor, fecha, idBolsilloOrigen) {
  const credito = creditoActivo_(idCredito);
  const vigente = cronogramaVigente_(idCredito);
  const plan = planPagoCredito_(credito, vigente, valor);
  const f = fechaMovimiento_(fecha);
  const origen = idBolsilloOrigen || credito.ID_Bolsillo_Pago;
  const destino = bolsilloDeCuenta_(credito.ID_Cuenta_Ahorro);
  if (origen === destino.ID_Bolsillo) throw new Error('El bolsillo desde el que pagas no puede ser el mismo de la cuenta de ahorro.');

  const renglon = leer_('Presupuesto_Mes').find(i => i.Mes === f.slice(0, 7) && i.ID_Credito === idCredito);
  const k = plan.cuota;
  const idPago = nuevoId_('pgo');

  const t = registrarTransferencia(origen, destino.ID_Bolsillo, plan.valorCobrado, f, 'Cuota ' + k.Num + ' · ' + credito.Nombre,
    'Pago ' + idPago, 'App', { Subtipo: 'Pago_Cuota', ID_Item_Ppto: renglon ? renglon.ID_Item : '' });
  try {
    updateRow('Creditos_Cronograma', k._rowIndex, { Estado: 'Pagada' });
    if (plan.excedente > 0 && !plan.cancela) {
      plan.pendientesReemplazadas.forEach(r => updateRow('Creditos_Cronograma', r._rowIndex, { Estado: 'Reemplazada' }));
      insertRows('Creditos_Cronograma', plan.nuevoCronograma.map(x => filaCronograma_(idCredito, Number(k.Version) + 1, x)));
    } else if (plan.excedente > 0 && plan.cancela) {
      plan.pendientesReemplazadas.forEach(r => updateRow('Creditos_Cronograma', r._rowIndex, { Estado: 'Reemplazada' }));
    }
    updateRow('Creditos', credito._rowIndex, { Num_Periodos: Number(k.Num) + plan.cuotasRestantes, Estado: plan.cancela ? 'Pagado' : 'Activo' });
    insertRow('Creditos_Pagos', {
      ID_Pago: idPago, ID_Credito: idCredito, Fecha: f, Num_Cuota: Number(k.Num), Valor_Pagado: plan.valorCobrado, Interes: Number(k.Interes),
      Capital_Cuota: Number(k.Capital), Abono_Extra: plan.excedente, Saldo_Despues: plan.saldoDespues, Version: Number(k.Version), ID_Grupo: t.idGrupo, Anulado: false
    });
  } catch (e) {
    anularMovimiento(t.patas[0].ID_Mov);
    throw e;
  }
  return { idPago: idPago, num: Number(k.Num), valorCobrado: plan.valorCobrado, excedente: plan.excedente, saldoDespues: plan.saldoDespues,
    cuotasAhorradas: plan.cuotasAhorradas, cancela: plan.cancela, ids: t.patas.map(p => p.ID_Mov), idCredito: idCredito };
}

/** Anula el ÚLTIMO pago de un crédito: devuelve el dinero y restaura el cronograma anterior. */
function anularPagoCredito(idPago) {
  const pago = buscarPorId_(leer_('Creditos_Pagos'), 'ID_Pago', idPago);
  if (!pago || esVerdadero(pago.Anulado)) throw new Error('No hay un pago para anular.');
  const delCredito = leer_('Creditos_Pagos').filter(p => p.ID_Credito === pago.ID_Credito && !esVerdadero(p.Anulado));
  const ultimo = delCredito.sort((a, b) => Number(b.Num_Cuota) - Number(a.Num_Cuota))[0];
  if (ultimo.ID_Pago !== idPago) throw new Error('Solo se puede anular el último pago (la cuota ' + ultimo.Num_Cuota + ').');

  const credito = creditoActivo_(pago.ID_Credito);
  const cron = leer_('Creditos_Cronograma').filter(f => f.ID_Credito === pago.ID_Credito);
  const version = Number(pago.Version);

  const movs = leer_('Movimientos').filter(m => m.ID_Grupo === pago.ID_Grupo && !esVerdadero(m.Anulado));
  const ids = [];
  if (movs.length) anularMovimiento(movs[0].ID_Mov).ids.forEach(i => ids.push(i));

  cron.filter(f => Number(f.Version) === version && Number(f.Num) === Number(pago.Num_Cuota))
    .forEach(f => updateRow('Creditos_Cronograma', f._rowIndex, { Estado: 'Pendiente' }));
  if (Number(pago.Abono_Extra) > 0) {
    cron.filter(f => Number(f.Version) === version + 1).forEach(f => updateRow('Creditos_Cronograma', f._rowIndex, { Estado: 'Reemplazada' }));
    cron.filter(f => Number(f.Version) === version && Number(f.Num) > Number(pago.Num_Cuota) && f.Estado === 'Reemplazada')
      .forEach(f => updateRow('Creditos_Cronograma', f._rowIndex, { Estado: 'Pendiente' }));
  }
  const maxNum = cron.filter(f => Number(f.Version) <= version).reduce((m, f) => Math.max(m, Number(f.Num)), 0);
  updateRow('Creditos', credito._rowIndex, { Estado: 'Activo', Num_Periodos: maxNum });
  updateRow('Creditos_Pagos', pago._rowIndex, { Anulado: true });
  return { ids: ids, idCredito: pago.ID_Credito };
}

/** Cambia datos que no alteran el cronograma. */
function editarCredito(idCredito, datos) {
  const c = creditoActivo_(idCredito);
  const d = datos || {};
  const cambios = {};
  if (d.Nombre !== undefined) {
    const nombre = textoRequerido_(d.Nombre, 'El nombre').slice(0, 80);
    if (leer_('Creditos').some(x => x.ID_Credito !== idCredito && x.Estado === 'Activo' && texto_(x.Nombre).toLowerCase() === nombre.toLowerCase())) throw new Error('Ya hay un crédito activo llamado "' + nombre + '".');
    cambios.Nombre = nombre;
  }
  if (d.ID_Persona !== undefined) { if (d.ID_Persona) exigirActivo_(leer_('Personas'), 'ID_Persona', d.ID_Persona, 'La persona'); cambios.ID_Persona = d.ID_Persona || ''; }
  if (d.ID_Bolsillo_Pago !== undefined) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', d.ID_Bolsillo_Pago, 'El bolsillo de pago'); exigirPesos_(d.ID_Bolsillo_Pago, 'El bolsillo de pago'); cambios.ID_Bolsillo_Pago = d.ID_Bolsillo_Pago; }
  if (d.Notas !== undefined) cambios.Notas = texto_(d.Notas).slice(0, 300);
  updateRow('Creditos', c._rowIndex, cambios);
  return { idCredito: idCredito };
}

/** Anula un crédito que no tiene pagos (y el dinero que salió del ahorro). */
function anularCredito(idCredito) {
  const c = creditoActivo_(idCredito);
  if (leer_('Creditos_Pagos').some(p => p.ID_Credito === idCredito && !esVerdadero(p.Anulado))) throw new Error('El crédito ya tiene pagos. Anúlalos primero (del último al primero).');
  const ids = [];
  leer_('Movimientos').filter(m => m.Notas === 'Crédito ' + idCredito && !esVerdadero(m.Anulado)).forEach(m => anularMovimiento(m.ID_Mov).ids.forEach(i => ids.push(i)));
  leer_('Creditos_Cronograma').filter(f => f.ID_Credito === idCredito && f.Estado !== 'Reemplazada').forEach(f => updateRow('Creditos_Cronograma', f._rowIndex, { Estado: 'Reemplazada' }));
  updateRow('Creditos', c._rowIndex, { Estado: 'Anulado' });
  return { ids: ids, idCredito: idCredito };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

function resumenCredito_(c, vigente, personas, cuentas) {
  const pagadas = vigente.filter(f => f.Estado === 'Pagada');
  const pendientes = vigente.filter(f => f.Estado === 'Pendiente');
  const proxima = pendientes[0] || null;
  const saldo = proxima ? Number(proxima.Saldo_Inicial) : 0;
  const persona = buscarPorId_(personas, 'ID_Persona', c.ID_Persona);
  const cuenta = buscarPorId_(cuentas, 'ID_Cuenta', c.ID_Cuenta_Ahorro);
  const monto = Number(c.Monto) || 0;
  return {
    ID_Credito: c.ID_Credito, Nombre: c.Nombre, Estado: c.Estado, ID_Persona: c.ID_Persona || '', Persona: persona ? persona.Nombre : '',
    ID_Cuenta_Ahorro: c.ID_Cuenta_Ahorro, CuentaAhorro: cuenta ? cuenta.Nombre : '', ID_Bolsillo_Pago: c.ID_Bolsillo_Pago,
    Fecha_Inicio: c.Fecha_Inicio, Monto: monto, Periodicidad: c.Periodicidad, Tasa_Periodica: Number(c.Tasa_Periodica) || 0, Cuota_Fija: Number(c.Cuota_Fija) || 0, Notas: c.Notas || '',
    saldo: c.Estado === 'Activo' ? saldo : 0, cuotasPagadas: pagadas.length, cuotasTotal: vigente.length,
    proxima: proxima ? { Num: Number(proxima.Num), Fecha: proxima.Fecha_Prevista, Cuota: Number(proxima.Cuota) } : null,
    avance: monto > 0 ? Math.min(1, Math.round((monto - (c.Estado === 'Activo' ? saldo : 0)) / monto * 1000) / 1000) : 0
  };
}

/** Todos los créditos (activos y pagados), para la pantalla de Deudas. */
function listarCreditos() {
  const personas = getTableData('Personas');
  const cuentas = getTableData('Cuentas');
  const cron = getTableData('Creditos_Cronograma');
  return getTableData('Creditos').filter(c => c.Estado !== 'Anulado').map(c => {
    const vigente = cron.filter(f => f.ID_Credito === c.ID_Credito && f.Estado !== 'Reemplazada').sort((a, b) => Number(a.Num) - Number(b.Num));
    return resumenCredito_(c, vigente, personas, cuentas);
  });
}

/** Todo lo de la pantalla de un crédito en una sola llamada. */
function obtenerCredito(idCredito) {
  const c = buscarPorId_(getTableData('Creditos'), 'ID_Credito', idCredito);
  if (!c) throw new Error('El crédito no existe.');
  const vigente = getTableData('Creditos_Cronograma').filter(f => f.ID_Credito === idCredito && f.Estado !== 'Reemplazada').sort((a, b) => Number(a.Num) - Number(b.Num));
  const pagos = getTableData('Creditos_Pagos').filter(p => p.ID_Credito === idCredito && !esVerdadero(p.Anulado)).sort((a, b) => Number(b.Num_Cuota) - Number(a.Num_Cuota));
  const resumen = resumenCredito_(c, vigente, getTableData('Personas'), getTableData('Cuentas'));
  const bolsillos = getTableData('Bolsillos');
  const bp = buscarPorId_(bolsillos, 'ID_Bolsillo', c.ID_Bolsillo_Pago);

  const interesPagado = redondear2_(vigente.filter(f => f.Estado === 'Pagada').reduce((a, f) => a + Number(f.Interes), 0));
  const capitalPagado = redondear2_((resumen.Monto - resumen.saldo));
  return {
    credito: resumen, BolsilloPago: bp ? bp.Nombre : '',
    cronograma: vigente.map(f => ({ Num: Number(f.Num), Fecha: f.Fecha_Prevista, Saldo_Inicial: Number(f.Saldo_Inicial), Cuota: Number(f.Cuota), Interes: Number(f.Interes), Capital: Number(f.Capital), Saldo_Final: Number(f.Saldo_Final), Estado: f.Estado })),
    pagos: pagos.map(p => ({ ID_Pago: p.ID_Pago, Fecha: p.Fecha, Num_Cuota: Number(p.Num_Cuota), Valor_Pagado: Number(p.Valor_Pagado), Abono_Extra: Number(p.Abono_Extra), Saldo_Despues: Number(p.Saldo_Despues) })),
    ultimoPago: pagos[0] ? pagos[0].ID_Pago : '',
    totales: { interesPagado: interesPagado, capitalPagado: capitalPagado, interesPendiente: redondear2_(vigente.filter(f => f.Estado === 'Pendiente').reduce((a, f) => a + Number(f.Interes), 0)) }
  };
}

/** Lo que se debe a las cuentas de ahorro por créditos activos (suma de saldos). */
function deudaConAhorro_() {
  return redondear2_(listarCreditos().filter(c => c.Estado === 'Activo').reduce((a, c) => a + c.saldo, 0));
}
