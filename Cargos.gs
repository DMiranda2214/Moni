/**
 * Cargos.gs — Moni
 * Comisiones, impuestos, cobro por cambio de divisa, cuota de manejo y seguros que cobra cada medio de pago.
 *
 * Cómo funciona ("reglas + editable"):
 *   1. La persona guarda REGLAS por medio de pago (Ajustes → Cargos y comisiones): "el banco X cobra 0,4 % (GMF) en toda
 *      salida", "la tarjeta Y cobra 3 % en compras en otra moneda y 25.000 de cuota de manejo al mes", "el crédito Z cobra
 *      18.000 de seguro por cuota"…
 *   2. Antes de guardar una operación, la pantalla pide los cargos SUGERIDOS (cargosSugeridos_) y los muestra; la persona
 *      puede cambiarlos o quitarlos.
 *   3. Al guardar, cada cargo queda como un gasto (o, si se pagó con tarjeta, como una compra de esa tarjeta), con su
 *      subtipo (Comision, Impuesto, GMF, Cambio_Divisa, Cuota_Manejo, Seguro), en la categoría "Comisiones e impuestos"
 *      y ligado a la operación (Ref = "Cargo <id>"): si se anula la operación, sus cargos también.
 *
 * Nada se cobra solo: sin reglas no se sugiere nada, y las hojas de antes no tienen reglas.
 */

const ETIQUETA_CARGO = { Comision: 'Comisión', Impuesto: 'Impuesto', Cambio_Divisa: 'Cambio de divisa', Cuota_Manejo: 'Cuota de manejo', Seguro: 'Seguro' };
/** Las operaciones que cuentan como "salida" de dinero de una cuenta (para reglas como el GMF). */
const OPERACIONES_SALIDA = ['Transferencia', 'Pago', 'Conversion', 'Cuota', 'Apertura_CDT', 'Extracto'];

/** Subtipo del movimiento de un cargo (el GMF tiene el suyo, como en Ahorro). */
function subtipoCargo_(tipo, nombre) {
  if (tipo === 'Impuesto' && /gmf|4\s*x\s*1000|4x1000/i.test(nombre || '')) return 'GMF';
  return ENUMS.Movimientos.Subtipo.indexOf(tipo) !== -1 ? tipo : 'Comision';
}

/** La categoría de los cargos: la de rol "Cargos" o, si no hay, se crea "Comisiones e impuestos" (también por rol). */
function categoriaCargos_() {
  const existente = categoriaPorRol_('Cargos', true);
  if (existente) return estaActivo(existente) ? existente.ID_Categoria : '';
  const cats = leer_('Categorias');
  insertRow('Categorias', { ID_Categoria: 'cat-cargos', Nombre: 'Comisiones e impuestos', Tipo: 'Gasto', Icono: 'escudo', Color: '', Activo: true, Orden: siguienteOrden_(cats), Rol: 'Cargos' });
  return 'cat-cargos';
}

/** A qué medios de pago aplica una operación: [{ Ambito, ID }], del más concreto al más general. */
function ambitosDe_(ctx) {
  const lista = [];
  if (ctx.idCredito) {
    lista.push({ Ambito: 'Credito', ID: ctx.idCredito });
    const c = buscarPorId_(getTableData('Creditos'), 'ID_Credito', ctx.idCredito);
    if (c && c.ID_Banco) lista.push({ Ambito: 'Banco', ID: c.ID_Banco });
  }
  if (ctx.idTarjeta) {
    lista.push({ Ambito: 'Tarjeta', ID: ctx.idTarjeta });
    const t = buscarPorId_(getTableData('Tarjetas'), 'ID_Tarjeta', ctx.idTarjeta);
    if (t && t.ID_Banco) lista.push({ Ambito: 'Banco', ID: t.ID_Banco });
  }
  if (ctx.idBolsillo) {
    const b = buscarPorId_(getTableData('Bolsillos'), 'ID_Bolsillo', ctx.idBolsillo);
    const cta = b ? buscarPorId_(getTableData('Cuentas'), 'ID_Cuenta', b.ID_Cuenta) : null;
    if (cta) {
      lista.push({ Ambito: 'Cuenta', ID: cta.ID_Cuenta });
      if (cta.ID_Banco) lista.push({ Ambito: 'Banco', ID: cta.ID_Banco });
    }
  }
  return lista;
}

/** ¿La regla aplica a esta operación? "Salida" cubre todas las salidas de dinero de una cuenta. */
function reglaAplica_(r, operacion) {
  if (r.Operacion === operacion) return true;
  return r.Operacion === 'Salida' && OPERACIONES_SALIDA.indexOf(operacion) !== -1;
}

/** Valor de una regla sobre una base: fijo, o porcentaje con mínimo y máximo. */
function valorRegla_(r, base) {
  let v = r.Modo === 'Porcentaje' ? (Number(base) || 0) * (Number(r.Valor) || 0) : Number(r.Valor) || 0;
  const min = Number(r.Minimo), max = Number(r.Maximo);
  if (r.Modo === 'Porcentaje' && r.Minimo !== '' && isFinite(min) && min > 0) v = Math.max(v, min);
  if (r.Modo === 'Porcentaje' && r.Maximo !== '' && isFinite(max) && max > 0) v = Math.min(v, max);
  return redondear2_(v);
}

/**
 * Cargos que corresponden a una operación según las reglas guardadas (no escribe nada).
 * @param {string} operacion Transferencia | Pago | Compra | Compra_Internacional | Conversion | Cuota | Apertura_CDT | Extracto
 * @param {Object} ctx { idBolsillo, idTarjeta, idCredito, valor }
 * @returns {Array} [{ idRegla, nombre, tipo, valor }]
 */
function cargosSugeridos_(operacion, ctx) {
  const c = ctx || {};
  const ambitos = ambitosDe_(c);
  if (!ambitos.length) return [];
  const reglas = getTableData('Cargos_Reglas').filter(estaActivo);
  const vistas = {};
  // Un crédito bancario puede traer cargos fijos por cuota (seguros) anotados al crearlo
  const salida = operacion === 'Cuota' && c.idCredito ? cargosFijosCredito_(buscarPorId_(getTableData('Creditos'), 'ID_Credito', c.idCredito)) : [];
  ambitos.forEach(a => {
    reglas.filter(r => r.Ambito === a.Ambito && r.ID_Ambito === a.ID && reglaAplica_(r, operacion))
      .sort((x, y) => (Number(x.Orden) || 0) - (Number(y.Orden) || 0))
      .forEach(r => {
        if (vistas[r.ID_Regla]) return;
        vistas[r.ID_Regla] = true;
        const v = valorRegla_(r, c.valor);
        if (v > 0) salida.push({ idRegla: r.ID_Regla, nombre: r.Nombre, tipo: r.Tipo_Cargo, valor: v });
      });
  });
  return salida;
}

/** Valida los cargos que llegan de la pantalla (lo que la persona dejó, cambió o quitó). */
function normalizarCargos_(cargos) {
  return (Array.isArray(cargos) ? cargos : []).map(x => {
    const valor = numero_(x && x.valor, 'El valor del cargo', { min: 0, max: VALOR_MAXIMO, defecto: 0 });
    const tipo = ENUMS.Cargos_Reglas.Tipo_Cargo.indexOf(texto_(x && x.tipo)) !== -1 ? texto_(x.tipo) : 'Comision';
    return { nombre: texto_(x && x.nombre).slice(0, 80) || ETIQUETA_CARGO[tipo], tipo: tipo, valor: valor };
  }).filter(x => x.valor > 0);
}

/**
 * Registra los cargos de una operación como gastos desde un bolsillo, ligados a ella (Ref = "Cargo <idRef>").
 * @param {Array} cargos [{ nombre, tipo, valor }] (ya normalizados o no)
 * @param {Object} base { idBolsillo, fecha, concepto, idRef, idItem, afecta }
 * @returns {Array} IDs de los movimientos creados
 */
function registrarCargos_(cargos, base) {
  const lista = normalizarCargos_(cargos);
  if (!lista.length) return [];
  exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', base.idBolsillo, 'El bolsillo de los cargos');
  const cat = categoriaCargos_();
  return lista.map(x => registrarMovimiento({
    Tipo_Mov: 'Gasto', Subtipo: subtipoCargo_(x.tipo, x.nombre), Valor: x.valor, Fecha: base.fecha,
    Concepto: x.nombre + (base.concepto ? ' · ' + base.concepto : ''), ID_Bolsillo: base.idBolsillo, ID_Categoria: cat,
    ID_Item_Ppto: base.idItem || '', Notas: '', Ref: MARCA_CARGO + base.idRef, Afecta_Saldos: base.afecta === false ? false : undefined
  }).ID_Mov);
}

/**
 * Cargos de una compra con tarjeta (por ejemplo, el recargo por compra en otra moneda): son compras de la misma tarjeta,
 * en el mismo extracto, ligadas a la compra.
 */
function registrarCargosTarjeta_(cargos, base) {
  const lista = normalizarCargos_(cargos);
  if (!lista.length) return [];
  const cat = categoriaCargos_();
  return lista.map(x => registrarCompraTC({
    ID_Tarjeta: base.idTarjeta, Fecha: base.fecha, Concepto: x.nombre + (base.concepto ? ' · ' + base.concepto : ''), Valor: x.valor,
    Fuente: 'Personal', ID_Categoria: cat, Mes_Extracto: base.mes, Notas: '', Ref: MARCA_CARGO + base.idRef
  }).ID_Compra);
}

/** Movimientos de cargo (no anulados) ligados a una operación. */
function cargosDe_(idRef) {
  return getTableData('Movimientos', { excludeAnulados: true }).filter(m => texto_(m.Ref) === MARCA_CARGO + idRef);
}

/** Lo que se pagó en cargos (comisiones, impuestos…) por mes y por tipo, para informes. */
function resumenCargos_(desde, hasta) {
  const porTipo = {}, porMes = {};
  let total = 0;
  const divisas = mapaDivisas_().bolsillos;
  const sumar = (fecha, tipo, v) => {
    if (desde && fecha < desde) return;
    if (hasta && fecha > hasta) return;
    porTipo[tipo] = redondear2_((porTipo[tipo] || 0) + v);
    porMes[fecha.slice(0, 7)] = redondear2_((porMes[fecha.slice(0, 7)] || 0) + v);
    total += v;
  };
  const SUBTIPOS = ['Comision', 'Impuesto', 'GMF', 'Cambio_Divisa', 'Cuota_Manejo', 'Seguro', 'Retencion'];
  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    if (m.Tipo_Mov !== 'Gasto' || SUBTIPOS.indexOf(m.Subtipo) === -1 || !m.Fecha) return;
    if ((divisas[m.ID_Bolsillo] || DIVISA_BASE) !== DIVISA_BASE) return;
    sumar(m.Fecha, m.Subtipo, -(Number(m.Valor) || 0));
  });
  getTableData('Compras_TC').forEach(c => {
    if (esVerdadero(c.Anulado) || texto_(c.Ref).indexOf(MARCA_CARGO) !== 0 || !c.Fecha) return;
    sumar(c.Fecha, 'Tarjeta', Number(c.Valor) || 0);
  });
  return { total: redondear2_(total), porTipo: porTipo, porMes: porMes };
}
