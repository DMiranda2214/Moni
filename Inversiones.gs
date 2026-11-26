/**
 * Inversiones.gs — Moni
 * Acciones, ETF, cripto, fondos… Cada inversión tiene sus operaciones (compras, ventas y dividendos) y un precio: el de
 * Google Finance (si tiene símbolo) o uno que la persona escribe (el más reciente de los dos manda).
 *
 *   Posición   = cantidad y costo con el método del costo promedio (una venta saca costo en proporción a lo vendido).
 *   Valor hoy  = cantidad × precio × tasa de la moneda del precio a pesos (Config.Tasa_USD…). Sin precio, vale su costo.
 *   Dinero     = una compra con bolsillo es un Ajuste negativo (Inversion_Compra) y una venta uno positivo (Inversion_Venta):
 *                el dinero cambia de lugar, no es gasto ni ingreso (SUBTIPOS_INVERSION). Un dividendo sí es un ingreso.
 *
 * Brokers (1.19): un broker es como un banco para invertir. Tiene dinero disponible (en su moneda) y las inversiones que
 * se compran con él. Disponible = depósitos − retiros − compras + ventas + dividendos (Valor_Origen de sus operaciones;
 * las que tienen Sin_Efectivo son unidades que la persona ya tenía y no lo tocan). Una inversión sin broker sigue como antes.
 *
 * GOOGLEFINANCE solo existe como fórmula de hoja, así que, como con las tasas (TasasGoogle.gs), la app mantiene una hoja
 * auxiliar, Precios_Google, con una fórmula por inversión y lee lo que Google devolvió. Cada lectura queda en el historial
 * (Inversiones_Precios, uno por día y fuente) para los gráficos.
 */

const HOJA_PRECIOS = 'Precios_Google';
const MARCA_INVERSION = 'Inversión ';
const TIPOS_INVERSION = { Accion: 'Acción', ETF: 'ETF', Cripto: 'Cripto', Fondo: 'Fondo', Bono: 'Bono', Otro: 'Otro' };

/** Símbolo para Google Finance, en mayúsculas ("nasdaq:aapl" → "NASDAQ:AAPL"). */
function simboloInversion_(v) {
  const t = texto_(v).toUpperCase().replace(/\s+/g, '');
  if (t && !/^[A-Z0-9.:_\-]{1,40}$/.test(t)) throw new Error('El símbolo solo puede tener letras, números y ":" (por ejemplo NASDAQ:AAPL o CURRENCY:BTCUSD).');
  return t;
}

/** Moneda en la que cotiza cada bolsa en Google Finance (para proponer la del precio al escribir el símbolo). */
const DIVISA_BOLSA = {
  NASDAQ: 'USD', NYSE: 'USD', NYSEARCA: 'USD', NYSEAMERICAN: 'USD', BATS: 'USD', OTCMKTS: 'USD', BVC: 'COP',
  BMV: 'MXN', BVMF: 'BRL', SGO: 'CLP', BVL: 'PEN', BCBA: 'ARS', TSE: 'CAD', CVE: 'CAD', TYO: 'JPY', ASX: 'AUD', SWX: 'CHF',
  EPA: 'EUR', ETR: 'EUR', FRA: 'EUR', AMS: 'EUR', BME: 'EUR', BIT: 'EUR', EBR: 'EUR', ELI: 'EUR', SHA: 'CNY', SHE: 'CNY'
};

/** La moneda que corresponde a un símbolo: la de su bolsa; la cripto (CURRENCY:BTCUSD) en la moneda del par. */
function divisaDeSimbolo_(simbolo) {
  const s = texto_(simbolo).toUpperCase();
  if (!s) return DIVISA_BASE;
  if (s.indexOf('CURRENCY:') === 0) { const par = s.slice(9), m = par.slice(-3); return DIVISAS.indexOf(m) !== -1 && par.length > 3 ? m : 'USD'; }
  const bolsa = s.indexOf(':') !== -1 ? s.split(':')[0] : '';
  return DIVISA_BOLSA[bolsa] || DIVISA_BASE;
}

/** Operaciones vigentes de una inversión, en orden de fecha (y de registro). */
function operacionesDe_(idInversion, ops) {
  return (ops || getTableData('Inversiones_Operaciones')).filter(o => o.ID_Inversion === idInversion && !esVerdadero(o.Anulado))
    .sort((a, b) => (a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : texto_(a.Creado_En) < texto_(b.Creado_En) ? -1 : 1));
}

/**
 * Posición a partir de las operaciones (costo promedio). `hasta` (AAAA-MM-DD) limita a las operaciones hasta esa fecha.
 * @returns {{ cantidad, costo, realizado, dividendos, aportado, retirado, ultimoPrecio, fechaUltimoPrecio }}
 */
function posicionInversion_(ops, hasta) {
  let cantidad = 0, costo = 0, realizado = 0, dividendos = 0, aportado = 0, retirado = 0, ultimoPrecio = null, fechaUltimoPrecio = '';
  ops.forEach(o => {
    if (hasta && o.Fecha > hasta) return;
    const q = Number(o.Cantidad) || 0, v = Number(o.Valor) || 0, com = Number(o.Comision) || 0;
    if (o.Tipo === 'Compra') {
      cantidad += q; costo += v + com; aportado += v + com;
    } else if (o.Tipo === 'Venta') {
      const sale = cantidad > 0 ? costo * Math.min(1, q / cantidad) : 0;
      costo -= sale; cantidad -= q; realizado += v - com - sale; retirado += v - com;
    } else if (o.Tipo === 'Dividendo') {
      dividendos += v;
    }
    if (Number(o.Precio) > 0 && o.Tipo !== 'Dividendo') { ultimoPrecio = Number(o.Precio); fechaUltimoPrecio = o.Fecha; }
  });
  const r6 = n => Math.round(n * 1e6) / 1e6;
  return { cantidad: r6(cantidad), costo: redondear2_(Math.max(0, costo)), realizado: redondear2_(realizado), dividendos: redondear2_(dividendos),
    aportado: redondear2_(aportado), retirado: redondear2_(retirado), ultimoPrecio: ultimoPrecio, fechaUltimoPrecio: fechaUltimoPrecio };
}

/** El precio que vale hoy: el más reciente entre el de Google, el manual y el de la última operación. */
function precioVigente_(inv, pos) {
  const opciones = [];
  if (Number(inv.Precio_Google) > 0) opciones.push({ precio: Number(inv.Precio_Google), fecha: texto_(inv.Fecha_Precio_Google), fuente: 'Google' });
  if (Number(inv.Precio_Manual) > 0) opciones.push({ precio: Number(inv.Precio_Manual), fecha: texto_(inv.Fecha_Precio_Manual), fuente: 'Manual' });
  if (pos && pos.ultimoPrecio) opciones.push({ precio: pos.ultimoPrecio, fecha: pos.fechaUltimoPrecio, fuente: 'Operacion' });
  if (!opciones.length) return null;
  // Mismo día: Google, luego manual, luego la operación
  const peso = { Google: 0, Manual: 1, Operacion: 2 };
  opciones.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : peso[a.fuente] - peso[b.fuente]));
  return opciones[0];
}

/** Resumen de una inversión. */
function resumenInversion_(inv, ops) {
  const propias = operacionesDe_(inv.ID_Inversion, ops);
  const pos = posicionInversion_(propias);
  const divisa = inv.Divisa || DIVISA_BASE;
  const tasa = tasaDivisa_(divisa);
  const precio = precioVigente_(inv, pos);
  const sinTasa = divisa !== DIVISA_BASE && !tasa;
  const valor = precio && !sinTasa ? redondear2_(pos.cantidad * precio.precio * (tasa || 1)) : pos.costo;
  const ganancia = redondear2_(valor - pos.costo);
  return {
    ID_Inversion: inv.ID_Inversion, Nombre: inv.Nombre, Tipo: inv.Tipo || 'Otro', TipoNombre: TIPOS_INVERSION[inv.Tipo] || 'Otro', Simbolo: inv.Simbolo || '',
    Divisa: divisa, Notas: inv.Notas || '', Activo: estaActivo(inv), ID_Broker: texto_(inv.ID_Broker),
    Precio_Manual: Number(inv.Precio_Manual) || 0, Fecha_Precio_Manual: texto_(inv.Fecha_Precio_Manual),
    Precio_Google: Number(inv.Precio_Google) || 0, Fecha_Precio_Google: texto_(inv.Fecha_Precio_Google),
    cantidad: pos.cantidad, costo: pos.costo, valor: valor, ganancia: ganancia, rentabilidad: pos.costo > 0 ? Math.round(ganancia / pos.costo * 10000) / 10000 : null,
    realizado: pos.realizado, dividendos: pos.dividendos, aportado: pos.aportado, retirado: pos.retirado,
    precio: precio ? precio.precio : null, fechaPrecio: precio ? precio.fecha : '', fuentePrecio: precio ? precio.fuente : '',
    sinPrecio: !precio, sinTasa: sinTasa, tasa: tasa,
    operaciones: propias.slice().reverse().map(o => ({ ID_Operacion: o.ID_Operacion, Fecha: o.Fecha, Tipo: o.Tipo, Cantidad: Number(o.Cantidad) || 0, Precio: Number(o.Precio) || 0,
      Valor: Number(o.Valor) || 0, Comision: Number(o.Comision) || 0, ID_Bolsillo: o.ID_Bolsillo || '', Notas: o.Notas || '',
      ID_Broker: texto_(o.ID_Broker), Valor_Origen: o.Valor_Origen === '' || o.Valor_Origen === undefined ? null : Number(o.Valor_Origen), Sin_Efectivo: esVerdadero(o.Sin_Efectivo) }))
  };
}

function resumenesInversiones_() {
  return memoDerivado_('inversiones', () => {
    const ops = getTableData('Inversiones_Operaciones');
    return getTableData('Inversiones').map(i => resumenInversion_(i, ops));
  });
}

/** Lo invertido en acciones, cripto… (para el patrimonio): valor de hoy de las activas más el disponible de los brokers. */
function resumenInversiones_() {
  const activas = resumenesInversiones_().filter(i => i.Activo);
  const efectivo = resumenesBrokers_().reduce((a, b) => a + (b.disponibleCop || 0), 0);
  return {
    valor: redondear2_(activas.reduce((a, i) => a + i.valor, 0) + efectivo), costo: redondear2_(activas.reduce((a, i) => a + i.costo, 0)),
    efectivo: redondear2_(efectivo), cantidad: activas.filter(i => i.cantidad > 0).length
  };
}

// ---------- Brokers ----------

/** Dinero disponible en un broker, en su moneda (hasta `hasta`, AAAA-MM-DD, si se indica). */
function efectivoBroker_(idBroker, ops, hasta) {
  return redondear2_((ops || getTableData('Inversiones_Operaciones')).reduce((a, o) => {
    if (o.ID_Broker !== idBroker || esVerdadero(o.Anulado) || esVerdadero(o.Sin_Efectivo)) return a;
    if (hasta && texto_(o.Fecha) > hasta) return a;
    const v = Number(o.Valor_Origen) || 0;
    if (o.Tipo === 'Deposito' || o.Tipo === 'Venta' || o.Tipo === 'Dividendo') return a + v;
    if (o.Tipo === 'Retiro' || o.Tipo === 'Compra') return a - v;
    return a;
  }, 0));
}

/**
 * Resumen de un broker: disponible y valor de sus inversiones en su moneda y en pesos.
 * El valor en su moneda usa el precio directo si está en la misma moneda; si no, pasa por pesos con las tasas de Divisas.
 */
function resumenBroker_(b, resumenes, ops) {
  const divisa = DIVISAS.indexOf(b.Divisa) !== -1 ? b.Divisa : DIVISA_BASE;
  const tasa = tasaDivisa_(divisa);
  const items = resumenes.filter(i => i.Activo && i.ID_Broker === b.ID_Broker);
  const disponible = efectivoBroker_(b.ID_Broker, ops);
  let valorDivisa = 0, completo = true;
  items.forEach(i => {
    if (!(i.cantidad > 0)) return;
    if (i.precio && i.Divisa === divisa) valorDivisa += i.cantidad * i.precio;
    else if (tasa && !i.sinTasa && !i.sinPrecio) valorDivisa += i.valor / tasa;
    else completo = false;
  });
  const valor = redondear2_(items.reduce((a, i) => a + i.valor, 0)), costo = redondear2_(items.reduce((a, i) => a + i.costo, 0));
  const disponibleCop = tasa ? redondear2_(disponible * tasa) : null;
  return {
    ID_Broker: b.ID_Broker, Nombre: b.Nombre, Divisa: divisa, Notas: b.Notas || '', Activo: estaActivo(b),
    disponible: disponible, disponibleCop: disponibleCop, valor: valor, costo: costo, ganancia: redondear2_(valor - costo),
    valorDivisa: completo ? redondear2_(valorDivisa) : null, totalDivisa: completo ? redondear2_(valorDivisa + disponible) : null,
    total: redondear2_(valor + (disponibleCop || 0)), sinTasa: !tasa, tasa: tasa,
    Comision_Tipo: texto_(b.Comision_Tipo), Comision_Porcentaje: Number(b.Comision_Porcentaje) || 0, Comision_Minima: Number(b.Comision_Minima) || 0,
    Comision_Fija: Number(b.Comision_Fija) || 0, Comision_Divisa: texto_(b.Comision_Divisa) || divisa,
    // Lo pagado en comisiones en este broker (en pesos, con la tasa del día de cada operación)
    comisiones: redondear2_(ops.filter(o => o.ID_Broker === b.ID_Broker && !esVerdadero(o.Anulado) && !esVerdadero(o.Sin_Efectivo)).reduce((a, o) => a + (Number(o.Comision) || 0), 0)),
    inversiones: items.map(i => i.ID_Inversion),
    movimientos: ops.filter(o => o.ID_Broker === b.ID_Broker && !esVerdadero(o.Anulado) && (o.Tipo === 'Deposito' || o.Tipo === 'Retiro'))
      .sort((x, y) => (x.Fecha < y.Fecha ? 1 : x.Fecha > y.Fecha ? -1 : texto_(x.Creado_En) < texto_(y.Creado_En) ? 1 : -1))
      .map(o => ({ ID_Operacion: o.ID_Operacion, Fecha: o.Fecha, Tipo: o.Tipo, Valor: Number(o.Valor_Origen) || 0, ID_Bolsillo: o.ID_Bolsillo || '', Notas: o.Notas || '' }))
  };
}

function resumenesBrokers_() {
  const ops = getTableData('Inversiones_Operaciones');
  const resumenes = resumenesInversiones_();
  return getTableData('Brokers').filter(estaActivo).map(b => resumenBroker_(b, resumenes, ops));
}

/**
 * La comisión que cobra un broker por una compra o venta de `total` (en su moneda): % del total (con su mínimo) + valor fijo.
 * La fija en pesos de un broker en otra moneda se pasa con las tasas de Divisas (sin tasa: null, la persona la escribe).
 * Sin comisión configurada: 0. Es una sugerencia: en cada operación se puede cambiar.
 */
function comisionBroker_(b, total) {
  const tipo = texto_(b.Comision_Tipo);
  if (!tipo) return 0;
  const divisa = DIVISAS.indexOf(b.Divisa) !== -1 ? b.Divisa : DIVISA_BASE;
  let c = 0;
  if (tipo === 'Porcentaje' || tipo === 'Mixta') c = Math.max((Number(total) || 0) * (Number(b.Comision_Porcentaje) || 0), Number(b.Comision_Minima) || 0);
  if (tipo === 'Fija' || tipo === 'Mixta') {
    const fija = Number(b.Comision_Fija) || 0, enDiv = b.Comision_Divisa || divisa;
    if (enDiv === divisa) c += fija;
    else { const tO = tasaDivisa_(enDiv), tD = tasaDivisa_(divisa); if (!tO || !tD) return null; c += fija * tO / tD; }
  }
  return redondear2_(c);
}

function brokerActivo_(id) {
  const b = buscarPorId_(leer_('Brokers'), 'ID_Broker', id);
  if (!b) throw new Error('El broker no existe.');
  if (!estaActivo(b)) throw new Error('El broker "' + b.Nombre + '" está desactivado.');
  return b;
}

/**
 * Lleva dinero a un broker (Deposito) o lo saca (Retiro). Con bolsillo, el dinero sale de él (o llega a él) como un ajuste
 * que no es gasto ni ingreso (Broker_Deposito / Broker_Retiro); sin bolsillo solo se anota.
 * @param {Object} d { ID_Broker, Tipo: 'Deposito'|'Retiro', Fecha, Valor (en la moneda del broker), ID_Bolsillo?, Valor_Bolsillo? (si el bolsillo está en otra moneda), Notas? }
 */
function moverDineroBroker(d, opc) {
  if (!d || typeof d !== 'object') throw new Error('Faltan los datos.');
  const b = brokerActivo_(d.ID_Broker);
  const divisa = DIVISAS.indexOf(b.Divisa) !== -1 ? b.Divisa : DIVISA_BASE;
  const tipo = opcion_(d.Tipo, ['Deposito', 'Retiro'], 'El tipo');
  const fecha = fechaMovimiento_(d.Fecha);
  const valor = numero_(d.Valor, 'El valor', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const idBolsillo = texto_(d.ID_Bolsillo);
  let enBolsillo = 0;
  if (idBolsillo) {
    exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo');
    const divB = divisaDeBolsillo_(idBolsillo);
    enBolsillo = divB === divisa ? valor : numero_(d.Valor_Bolsillo, 'Lo que ' + (tipo === 'Deposito' ? 'sale del' : 'llega al') + ' bolsillo (en ' + divB + ')', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  }
  if (tipo === 'Retiro' && !(opc && opc.sinRevisar)) {
    const disp = efectivoBroker_(b.ID_Broker, leer_('Inversiones_Operaciones'));
    if (valor > disp + 0.005) throw new Error('En ' + b.Nombre + ' tienes ' + disp + ' ' + divisa + ' disponibles: no puedes retirar más.');
  }
  const tasa = tasaDivisa_(divisa);
  const idOp = nuevoId_('iop');
  return transaccion_(alDeshacer => {
    let idMov = '';
    if (idBolsillo) {
      const mov = registrarMovimiento({ Tipo_Mov: 'Ajuste', Subtipo: tipo === 'Deposito' ? 'Broker_Deposito' : 'Broker_Retiro', Valor: tipo === 'Deposito' ? -enBolsillo : enBolsillo,
        Fecha: fecha, ID_Bolsillo: idBolsillo, Concepto: (tipo === 'Deposito' ? 'Depósito en ' : 'Retiro de ') + b.Nombre, Notas: MARCA_INVERSION + idOp });
      idMov = mov.ID_Mov;
      alDeshacer(() => anularMovimiento(idMov));
    }
    const fila = { ID_Operacion: idOp, ID_Inversion: '', Fecha: fecha, Tipo: tipo, Cantidad: '', Precio: '', Valor: tasa ? redondear2_(valor * tasa) : '', Comision: 0,
      ID_Bolsillo: idBolsillo, ID_Mov: idMov, Notas: texto_(d.Notas).slice(0, 300), Anulado: false, ID_Broker: b.ID_Broker, Valor_Origen: valor, Sin_Efectivo: false };
    insertRow('Inversiones_Operaciones', fila);
    return fila;
  });
}

/** Deja el disponible de un broker en `nuevo` (lo que dice la plataforma): anota la diferencia, sin mover dinero de bolsillos. */
function ajustarDisponibleBroker(idBroker, nuevo, fecha) {
  const b = brokerActivo_(idBroker);
  const objetivo = numero_(nuevo, 'El disponible', { requerido: true, min: 0, max: VALOR_MAXIMO });
  const dif = redondear2_(objetivo - efectivoBroker_(b.ID_Broker, leer_('Inversiones_Operaciones')));
  if (Math.abs(dif) < 0.01) return null;
  return moverDineroBroker({ ID_Broker: b.ID_Broker, Tipo: dif > 0 ? 'Deposito' : 'Retiro', Fecha: fecha, Valor: Math.abs(dif), Notas: 'Ajuste del disponible a ' + objetivo }, { sinRevisar: true });
}

/**
 * Deja la cantidad de una inversión en `d.Cantidad` (las acciones o unidades que ya tienes), sin mover dinero.
 * Si sube, el costo es el precio promedio que se indique (o el precio de hoy: sin ganancia). Si baja, sale costo en
 * proporción, sin ganancia ni pérdida.
 * @param {Object} d { Cantidad, Precio? (precio promedio de compra, en la moneda del precio), Fecha? }
 */
function ajustarCantidadInversion(idInversion, d) {
  const inv = inversionActiva_(idInversion);
  const x = d || {};
  const nueva = numero_(x.Cantidad, 'La cantidad', { requerido: true, min: 0, max: VALOR_MAXIMO, decimales: 8 });
  const pos = posicionInversion_(operacionesDe_(idInversion, leer_('Inversiones_Operaciones')));
  const dif = Math.round((nueva - pos.cantidad) * 1e8) / 1e8;
  if (Math.abs(dif) < 1e-9) return null;
  const fecha = fechaMovimiento_(x.Fecha);
  const divisa = inv.Divisa || DIVISA_BASE, tasa = tasaDivisa_(divisa);
  const promedio = x.Precio === '' || x.Precio === undefined || x.Precio === null ? null : numero_(x.Precio, 'El precio promedio', { min: 0, max: VALOR_MAXIMO, decimales: 8 });
  let fila;
  if (dif > 0) {
    const ref = promedio || (precioVigente_(inv, pos) || {}).precio || 0;
    fila = { Tipo: 'Compra', Cantidad: dif, Valor: ref && tasa ? redondear2_(dif * ref * tasa) : 0,
      Notas: 'Ya las tenía' + (promedio ? ' · precio promedio ' + promedio + ' ' + divisa : ref ? ' · al precio de ese día' : ' · sin costo conocido') };
  } else {
    const q = -dif;
    fila = { Tipo: 'Venta', Cantidad: q, Valor: pos.cantidad > 0 ? redondear2_(pos.costo * Math.min(1, q / pos.cantidad)) : 0, Notas: 'Cantidad ajustada (sin venta)' };
  }
  fila = Object.assign({ ID_Operacion: nuevoId_('iop'), ID_Inversion: idInversion, Fecha: fecha, Precio: '', Comision: 0, ID_Bolsillo: '', ID_Mov: '', Anulado: false,
    ID_Broker: texto_(inv.ID_Broker), Valor_Origen: '', Sin_Efectivo: true }, fila);
  insertRow('Inversiones_Operaciones', fila);
  return fila;
}

/**
 * Valor de las inversiones al cierre de cada mes (para el patrimonio de 12 meses): con el último precio conocido hasta ese
 * día, más el disponible de los brokers a esa fecha (con la tasa de hoy). `sinEfectivo` deja solo las inversiones.
 */
function valorInversionesMensual_(meses, sinEfectivo) {
  const invs = getTableData('Inversiones').filter(estaActivo);
  const brokers = sinEfectivo ? [] : getTableData('Brokers').filter(estaActivo);
  if (!invs.length && !brokers.length) return meses.map(() => 0);
  const ops = getTableData('Inversiones_Operaciones');
  const efectivoMes = fin => brokers.reduce((a, b) => { const t = tasaDivisa_(DIVISAS.indexOf(b.Divisa) !== -1 ? b.Divisa : DIVISA_BASE); return a + (t ? efectivoBroker_(b.ID_Broker, ops, fin) * t : 0); }, 0);
  const historial = getTableData('Inversiones_Precios');
  return meses.map(mes => {
    const fin = finDeMes_(mes);
    return redondear2_(invs.reduce((a, inv) => {
      const propias = operacionesDe_(inv.ID_Inversion, ops);
      const pos = posicionInversion_(propias, fin);
      if (!(pos.cantidad > 0)) return a;
      const precios = historial.filter(h => h.ID_Inversion === inv.ID_Inversion && texto_(h.Fecha) <= fin && Number(h.Precio) > 0).sort((x, y) => (x.Fecha < y.Fecha ? 1 : -1));
      let precio = precios.length ? Number(precios[0].Precio) : pos.ultimoPrecio;
      if (texto_(inv.Fecha_Precio_Manual) && inv.Fecha_Precio_Manual <= fin && (!precios.length || inv.Fecha_Precio_Manual >= precios[0].Fecha) && Number(inv.Precio_Manual) > 0) precio = Number(inv.Precio_Manual);
      const tasa = tasaDivisa_(inv.Divisa || DIVISA_BASE);
      return a + (precio && tasa ? pos.cantidad * precio * tasa : pos.costo);
    }, efectivoMes(fin)));
  });
}

/** Pantalla de Inversiones, en una sola llamada. */
function obtenerInversiones() {
  const todas = resumenesInversiones_();
  const activas = todas.filter(i => i.Activo);
  const suma = f => redondear2_(activas.reduce((a, i) => a + f(i), 0));
  const porTipo = {};
  activas.filter(i => i.valor > 0).forEach(i => { porTipo[i.TipoNombre] = redondear2_((porTipo[i.TipoNombre] || 0) + i.valor); });
  const meses = mesesHasta_(hoyIso_().slice(0, 7), 12);
  const valores = valorInversionesMensual_(meses, true);
  const brokers = resumenesBrokers_();
  const efectivo = redondear2_(brokers.reduce((a, b) => a + (b.disponibleCop || 0), 0));
  const ops = getTableData('Inversiones_Operaciones');
  const costos = meses.map(m => redondear2_(getTableData('Inversiones').filter(estaActivo).reduce((a, inv) => a + posicionInversion_(operacionesDe_(inv.ID_Inversion, ops), finDeMes_(m)).costo, 0)));
  const costo = suma(i => i.costo), valor = suma(i => i.valor);
  return {
    items: activas.sort((a, b) => b.valor - a.valor),
    archivadas: todas.filter(i => !i.Activo).map(i => ({ ID_Inversion: i.ID_Inversion, Nombre: i.Nombre })),
    totales: { costo: costo, valor: valor, ganancia: redondear2_(valor - costo), rentabilidad: costo > 0 ? Math.round((valor - costo) / costo * 10000) / 10000 : null,
      realizado: suma(i => i.realizado), dividendos: suma(i => i.dividendos), efectivo: efectivo, total: redondear2_(valor + efectivo) },
    brokers: brokers,
    porTipo: Object.keys(porTipo).map(k => ({ nombre: k, valor: porTipo[k] })).sort((a, b) => b.valor - a.valor),
    evolucion: meses.map((m, k) => ({ mes: m, valor: valores[k], costo: costos[k] })),
    faltaTasa: activas.filter(i => i.sinTasa).map(i => i.Divisa).concat(brokers.filter(b => b.sinTasa).map(b => b.Divisa)).filter((d, k, l) => l.indexOf(d) === k),
    ultimaActualizacion: texto_(cfgValor_('Inversiones_Ultima')),
    automatico: esVerdadero(cfgValor_('Tasa_Auto'))
  };
}

function inversionActiva_(id) {
  const inv = buscarPorId_(leer_('Inversiones'), 'ID_Inversion', id);
  if (!inv) throw new Error('La inversión no existe.');
  if (!estaActivo(inv)) throw new Error('La inversión está archivada.');
  return inv;
}

/**
 * Registra una compra, una venta o un dividendo.
 * @param {Object} o { ID_Inversion, Fecha, Tipo, Cantidad, Precio, Valor (en pesos), Comision, ID_Bolsillo, Notas }
 *   Con bolsillo, el dinero sale (compra) o entra (venta, dividendo) de ese bolsillo; sin bolsillo, solo se anota.
 */
function registrarOperacionInversion(o) {
  if (!o || typeof o !== 'object') throw new Error('Faltan los datos de la operación.');
  const inv = inversionActiva_(o.ID_Inversion);
  const tipo = opcion_(o.Tipo, ENUMS.Inversiones_Operaciones.Tipo, 'El tipo de operación');
  const fecha = fechaMovimiento_(o.Fecha);
  const cantidad = tipo === 'Dividendo' ? 0 : numero_(o.Cantidad, 'La cantidad', { requerido: true, min: 0, max: VALOR_MAXIMO, decimales: 8 });
  if (tipo !== 'Dividendo' && !(cantidad > 0)) throw new Error('La cantidad debe ser mayor que cero.');
  const precio = o.Precio === '' || o.Precio === undefined || o.Precio === null ? '' : numero_(o.Precio, 'El precio', { min: 0, max: VALOR_MAXIMO, decimales: 8 });
  if (texto_(inv.ID_Broker)) return registrarOperacionBroker_(inv, o, tipo, fecha, cantidad, precio);
  const valor = numero_(o.Valor, tipo === 'Dividendo' ? 'El valor del dividendo' : 'El valor en pesos', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const comision = numero_(o.Comision, 'La comisión', { min: 0, max: VALOR_MAXIMO }) || 0;
  if (tipo === 'Venta') {
    const pos = posicionInversion_(operacionesDe_(inv.ID_Inversion, leer_('Inversiones_Operaciones')));
    if (cantidad > pos.cantidad + 1e-9) throw new Error('Solo tienes ' + pos.cantidad + ' de ' + inv.Nombre + ': no puedes vender más.');
    if (comision > valor) throw new Error('La comisión no puede ser mayor que lo que recibiste.');
  }
  const idBolsillo = texto_(o.ID_Bolsillo);
  if (idBolsillo) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo'); exigirPesos_(idBolsillo, 'El bolsillo'); }
  const idOp = nuevoId_('iop');

  return transaccion_(alDeshacer => {
    let idMov = '';
    if (idBolsillo) {
      let mov;
      const ref = MARCA_INVERSION + idOp;
      if (tipo === 'Compra') mov = registrarMovimiento({ Tipo_Mov: 'Ajuste', Subtipo: 'Inversion_Compra', Valor: -(valor + comision), Fecha: fecha, ID_Bolsillo: idBolsillo, Concepto: 'Compra de ' + inv.Nombre, Notas: ref });
      else if (tipo === 'Venta') mov = registrarMovimiento({ Tipo_Mov: 'Ajuste', Subtipo: 'Inversion_Venta', Valor: valor - comision, Fecha: fecha, ID_Bolsillo: idBolsillo, Concepto: 'Venta de ' + inv.Nombre, Notas: ref });
      else {
        const cat = categoriaPorRol_('Rendimiento');
        mov = registrarMovimiento({ Tipo_Mov: 'Ingreso', Subtipo: 'Dividendo', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: cat && estaActivo(cat) ? cat.ID_Categoria : '', Concepto: 'Dividendo de ' + inv.Nombre, Notas: ref });
      }
      idMov = mov.ID_Mov;
      alDeshacer(() => anularMovimiento(idMov));
    }
    const fila = { ID_Operacion: idOp, ID_Inversion: inv.ID_Inversion, Fecha: fecha, Tipo: tipo, Cantidad: cantidad, Precio: precio, Valor: valor, Comision: comision,
      ID_Bolsillo: idBolsillo, ID_Mov: idMov, Notas: texto_(o.Notas).slice(0, 300), Anulado: false };
    insertRow('Inversiones_Operaciones', fila);
    return fila;
  });
}

/**
 * Compra, venta o dividendo de una inversión que está en un broker: el dinero sale o entra del disponible del broker, en su
 * moneda (`Total` + `Comision`). Valor y Comisión se guardan en pesos con la tasa de hoy, para el costo y la ganancia.
 * Una compra con `Sin_Efectivo` es de unidades que ya tenías: no toca el disponible.
 */
function registrarOperacionBroker_(inv, o, tipo, fecha, cantidad, precio) {
  const b = brokerActivo_(inv.ID_Broker);
  const divisa = DIVISAS.indexOf(b.Divisa) !== -1 ? b.Divisa : DIVISA_BASE;
  const tasa = tasaDivisa_(divisa);
  if (!tasa) throw new Error('Falta la tasa de ' + divisa + ' para llevar la operación a pesos. Escríbela (o actívala con Google Finance) en Ajustes → Divisas.');
  const total = numero_(o.Total, tipo === 'Dividendo' ? 'El valor del dividendo' : 'El total', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  // Sin comisión escrita, la de la tarifa del broker; con una (aunque sea 0), la que se escribió
  const sinEscribir = o.Comision === undefined || o.Comision === null || o.Comision === '';
  const sugerida = tipo === 'Dividendo' || !sinEscribir ? 0 : comisionBroker_(b, total);
  const comision = tipo === 'Dividendo' ? 0 : sinEscribir ? (sugerida || 0) : numero_(o.Comision, 'La comisión', { min: 0, max: VALOR_MAXIMO }) || 0;
  const sinEfectivo = tipo === 'Compra' && esVerdadero(o.Sin_Efectivo);
  if (tipo === 'Venta') {
    const pos = posicionInversion_(operacionesDe_(inv.ID_Inversion, leer_('Inversiones_Operaciones')));
    if (cantidad > pos.cantidad + 1e-9) throw new Error('Solo tienes ' + pos.cantidad + ' de ' + inv.Nombre + ': no puedes vender más.');
    if (comision > total) throw new Error('La comisión no puede ser mayor que lo que recibiste.');
  }
  const efecto = tipo === 'Compra' ? total + comision : tipo === 'Venta' ? total - comision : total;
  const fila = { ID_Operacion: nuevoId_('iop'), ID_Inversion: inv.ID_Inversion, Fecha: fecha, Tipo: tipo, Cantidad: cantidad, Precio: precio,
    Valor: redondear2_(total * tasa), Comision: redondear2_(comision * tasa), ID_Bolsillo: '', ID_Mov: '', Notas: texto_(o.Notas).slice(0, 300), Anulado: false,
    ID_Broker: b.ID_Broker, Valor_Origen: redondear2_(efecto), Sin_Efectivo: sinEfectivo };
  insertRow('Inversiones_Operaciones', fila);
  return fila;
}

/** Anula una operación (y su movimiento de dinero). Una compra no se puede anular si deja vendido más de lo que había. */
function anularOperacionInversion(idOperacion) {
  const ops = leer_('Inversiones_Operaciones');
  const op = buscarPorId_(ops, 'ID_Operacion', idOperacion);
  if (!op) throw new Error('La operación no existe.');
  if (esVerdadero(op.Anulado)) return { ids: [] };
  if (op.Tipo === 'Compra') {
    // Sin esta compra, ninguna venta puede quedar vendiendo más de lo que había en su momento
    const resto = operacionesDe_(op.ID_Inversion, ops).filter(o => o.ID_Operacion !== idOperacion);
    let q = 0;
    resto.forEach(o => {
      if (o.Tipo === 'Compra') q += Number(o.Cantidad) || 0;
      if (o.Tipo === 'Venta') { q -= Number(o.Cantidad) || 0; if (q < -1e-9) throw new Error('Sin esta compra, una venta posterior quedaría vendiendo más de lo que tenías. Anula primero esa venta.'); }
    });
  }
  let ids = [];
  if (op.ID_Mov) ids = anularMovimiento(op.ID_Mov).ids;
  updateRow('Inversiones_Operaciones', op, { Anulado: true });
  return { ids: ids, idInversion: op.ID_Inversion };
}

/** Anota un precio a mano (por ejemplo, una acción de la BVC que Google no tiene o el valor de una unidad de un fondo). */
function guardarPrecioManual(idInversion, precio, fecha) {
  const inv = inversionActiva_(idInversion);
  const p = numero_(precio, 'El precio', { requerido: true, min: 0.00000001, max: VALOR_MAXIMO, decimales: 8 });
  const f = fechaMovimiento_(fecha);
  updateRow('Inversiones', inv, { Precio_Manual: p, Fecha_Precio_Manual: f });
  anotarPrecio_(idInversion, f, p, inv.Divisa || DIVISA_BASE, 'Manual');
  return inv;
}

/** Guarda el precio del día en el historial (uno por día y fuente: si ya hay, se actualiza). */
function anotarPrecio_(idInversion, fecha, precio, divisa, fuente) {
  const hist = leer_('Inversiones_Precios');
  const ya = hist.find(h => h.ID_Inversion === idInversion && texto_(h.Fecha) === fecha && h.Fuente === fuente);
  if (ya) { if (Number(ya.Precio) !== precio) updateRow('Inversiones_Precios', ya, { Precio: precio, Divisa: divisa }); return; }
  insertRow('Inversiones_Precios', { ID_Precio: nuevoId_('ipr'), Fecha: fecha, ID_Inversion: idInversion, Precio: precio, Divisa: divisa, Fuente: fuente });
}

// ---------- Google Finance ----------

/** Fórmula de Google Finance para un símbolo (si Google no lo tiene, queda vacía en vez de #N/A). */
function formulaPrecio_(simbolo) { return '=IFERROR(GOOGLEFINANCE("' + simbolo.replace(/"/g, '') + '","price"),"")'; }

/**
 * Pone al día la hoja auxiliar (una fila por inversión con símbolo) y lee los precios que Google devolvió. Una fila solo
 * se reescribe si cambió su símbolo (reescribir la fórmula la deja "cargando" unos segundos).
 */
function actualizarPreciosGoogle() {
  const ss = getSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_PRECIOS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_PRECIOS);
    hoja.getRange(1, 1, 1, 3).setValues([['ID_Inversion', 'Simbolo', 'Precio (Google Finance)']]);
    try { hoja.getRange(1, 1, 1, 3).setFontWeight('bold'); hoja.setColumnWidth(1, 170); hoja.setColumnWidth(2, 170); hoja.setColumnWidth(3, 200); } catch (e) {}
  }
  const invs = leer_('Inversiones').filter(i => estaActivo(i) && texto_(i.Simbolo));
  if (!invs.length) return { actualizadas: [], pendientes: [], sinSimbolo: true };
  const n = Math.max(hoja.getLastRow() - 1, 0);
  const actuales = n ? hoja.getRange(2, 1, n, 3).getValues() : [];
  invs.forEach((inv, k) => {
    const fila = actuales[k] || [];
    if (fila[0] !== inv.ID_Inversion || fila[1] !== inv.Simbolo) {
      hoja.getRange(k + 2, 1, 1, 2).setValues([[inv.ID_Inversion, inv.Simbolo]]);
      hoja.getRange(k + 2, 3).setFormula(formulaPrecio_(inv.Simbolo));
    }
  });
  if (n > invs.length) hoja.getRange(invs.length + 2, 1, n - invs.length, 3).clearContent();
  SpreadsheetApp.flush();
  const valores = hoja.getRange(2, 1, invs.length, 3).getValues();
  const hoy = hoyIso_();
  const actualizadas = [], pendientes = [];
  invs.forEach((inv, k) => {
    const v = valores[k][2];
    if (valores[k][0] === inv.ID_Inversion && typeof v === 'number' && isFinite(v) && v > 0) {
      updateRow('Inversiones', inv, { Precio_Google: v, Fecha_Precio_Google: hoy });
      anotarPrecio_(inv.ID_Inversion, hoy, v, inv.Divisa || DIVISA_BASE, 'Google');
      actualizadas.push({ ID_Inversion: inv.ID_Inversion, Nombre: inv.Nombre, precio: v });
    } else pendientes.push(inv.Nombre);
  });
  guardarConfig_('Inversiones_Ultima', ahoraIso_());
  return { actualizadas: actualizadas, pendientes: pendientes };
}

// ---------- Buscar un símbolo en Google Finance ----------

const HOJA_BUSCAR = 'Buscar_Google';

/** Símbolos que se prueban para un texto: tal cual y en las bolsas más comunes (y como cripto o divisa en dólares). */
function candidatosSimbolo_(texto) {
  const t = texto_(texto).toUpperCase().replace(/\s+/g, '');
  if (!t) return [];
  if (!/^[A-Z0-9.:_\-]{1,40}$/.test(t)) throw new Error('Escribe el símbolo con letras y números (por ejemplo AAPL, VOO, BTC o ECOPETROL).');
  if (t.indexOf(':') !== -1) return [t];
  return [t, 'NASDAQ:' + t, 'NYSE:' + t, 'NYSEARCA:' + t, 'BVC:' + t, 'CURRENCY:' + t + 'USD'];
}

/**
 * Busca un símbolo con la misma fórmula GOOGLEFINANCE (no necesita permisos nuevos): escribe los candidatos en una hoja
 * auxiliar y lee el nombre, el precio y la moneda de los que Google reconoce. Un candidato que ya estaba escrito no se
 * vuelve a escribir (así la fórmula no se queda "cargando").
 * @returns {Array} [{ simbolo, nombre, precio, divisa, tipo }]
 */
function buscarSimbolosGoogle(texto) {
  const cands = candidatosSimbolo_(texto);
  if (!cands.length) return [];
  const ss = getSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_BUSCAR);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_BUSCAR);
    hoja.getRange(1, 1, 1, 4).setValues([['Simbolo', 'Nombre', 'Precio', 'Moneda']]);
  }
  const previos = hoja.getLastRow() > 1 ? hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 4).getValues() : [];
  const mismos = previos.length >= cands.length && cands.every((c, k) => previos[k][0] === c);
  if (!mismos) {
    if (previos.length) hoja.getRange(2, 1, previos.length, 4).clearContent();
    cands.forEach((c, k) => {
      const f = '"' + c.replace(/"/g, '') + '"';
      hoja.getRange(k + 2, 1).setValue(c);
      hoja.getRange(k + 2, 2).setFormula('=IFERROR(GOOGLEFINANCE(' + f + ',"name"),"")');
      hoja.getRange(k + 2, 3).setFormula('=IFERROR(GOOGLEFINANCE(' + f + ',"price"),"")');
      hoja.getRange(k + 2, 4).setFormula('=IFERROR(GOOGLEFINANCE(' + f + ',"currency"),"")');
    });
  }
  const leer = () => { SpreadsheetApp.flush(); return hoja.getRange(2, 1, cands.length, 4).getValues(); };
  let filas = leer();
  // Google tarda un momento en responder la primera vez
  for (let intento = 0; intento < 2 && !filas.some(f => typeof f[2] === 'number' && f[2] > 0); intento++) { Utilities.sleep(1500); filas = leer(); }
  const vistos = {};
  return filas.filter(f => typeof f[2] === 'number' && isFinite(f[2]) && f[2] > 0).map(f => {
    const simbolo = String(f[0]), cripto = simbolo.indexOf('CURRENCY:') === 0;
    const divisa = cripto ? 'USD' : String(f[3] || '').toUpperCase();
    return { simbolo: simbolo, nombre: String(f[1] || '') || (cripto ? simbolo.slice(9, -3) + ' (cripto o divisa, en dólares)' : simbolo), precio: f[2],
      divisa: DIVISAS.indexOf(divisa) !== -1 ? divisa : '', monedaGoogle: divisa, tipo: cripto ? 'Cripto' : (/^NYSEARCA:/.test(simbolo) ? 'ETF' : 'Accion') };
  }).sort((a, b) => (a.simbolo.indexOf(':') === -1) - (b.simbolo.indexOf(':') === -1)).filter(r => {
    // El mismo activo (mismo nombre y precio) con y sin bolsa: se deja el que tiene la bolsa
    const k = r.nombre + '|' + r.precio;
    if (vistos[k]) return false;
    vistos[k] = true; return true;
  });
}
