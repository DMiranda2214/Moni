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
    Divisa: divisa, Notas: inv.Notas || '', Activo: estaActivo(inv),
    Precio_Manual: Number(inv.Precio_Manual) || 0, Fecha_Precio_Manual: texto_(inv.Fecha_Precio_Manual),
    Precio_Google: Number(inv.Precio_Google) || 0, Fecha_Precio_Google: texto_(inv.Fecha_Precio_Google),
    cantidad: pos.cantidad, costo: pos.costo, valor: valor, ganancia: ganancia, rentabilidad: pos.costo > 0 ? Math.round(ganancia / pos.costo * 10000) / 10000 : null,
    realizado: pos.realizado, dividendos: pos.dividendos, aportado: pos.aportado, retirado: pos.retirado,
    precio: precio ? precio.precio : null, fechaPrecio: precio ? precio.fecha : '', fuentePrecio: precio ? precio.fuente : '',
    sinPrecio: !precio, sinTasa: sinTasa, tasa: tasa,
    operaciones: propias.slice().reverse().map(o => ({ ID_Operacion: o.ID_Operacion, Fecha: o.Fecha, Tipo: o.Tipo, Cantidad: Number(o.Cantidad) || 0, Precio: Number(o.Precio) || 0,
      Valor: Number(o.Valor) || 0, Comision: Number(o.Comision) || 0, ID_Bolsillo: o.ID_Bolsillo || '', Notas: o.Notas || '' }))
  };
}

function resumenesInversiones_() {
  return memoDerivado_('inversiones', () => {
    const ops = getTableData('Inversiones_Operaciones');
    return getTableData('Inversiones').map(i => resumenInversion_(i, ops));
  });
}

/** Lo invertido en acciones, cripto… (para el patrimonio): valor de hoy de las activas. */
function resumenInversiones_() {
  const activas = resumenesInversiones_().filter(i => i.Activo);
  return {
    valor: redondear2_(activas.reduce((a, i) => a + i.valor, 0)), costo: redondear2_(activas.reduce((a, i) => a + i.costo, 0)),
    cantidad: activas.filter(i => i.cantidad > 0).length
  };
}

/** Valor de las inversiones al cierre de cada mes (para el patrimonio de 12 meses): con el último precio conocido hasta ese día. */
function valorInversionesMensual_(meses) {
  const invs = getTableData('Inversiones').filter(estaActivo);
  if (!invs.length) return meses.map(() => 0);
  const ops = getTableData('Inversiones_Operaciones');
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
    }, 0));
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
  const valores = valorInversionesMensual_(meses);
  const ops = getTableData('Inversiones_Operaciones');
  const costos = meses.map(m => redondear2_(getTableData('Inversiones').filter(estaActivo).reduce((a, inv) => a + posicionInversion_(operacionesDe_(inv.ID_Inversion, ops), finDeMes_(m)).costo, 0)));
  const costo = suma(i => i.costo), valor = suma(i => i.valor);
  return {
    items: activas.sort((a, b) => b.valor - a.valor),
    archivadas: todas.filter(i => !i.Activo).map(i => ({ ID_Inversion: i.ID_Inversion, Nombre: i.Nombre })),
    totales: { costo: costo, valor: valor, ganancia: redondear2_(valor - costo), rentabilidad: costo > 0 ? Math.round((valor - costo) / costo * 10000) / 10000 : null,
      realizado: suma(i => i.realizado), dividendos: suma(i => i.dividendos) },
    porTipo: Object.keys(porTipo).map(k => ({ nombre: k, valor: porTipo[k] })).sort((a, b) => b.valor - a.valor),
    evolucion: meses.map((m, k) => ({ mes: m, valor: valores[k], costo: costos[k] })),
    faltaTasa: activas.filter(i => i.sinTasa).map(i => i.Divisa).filter((d, k, l) => l.indexOf(d) === k),
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
