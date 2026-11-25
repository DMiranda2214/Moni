/**
 * Suscripciones.gs — Moni
 * Pagos que se repiten: suscripciones (Netflix, Disney…) y servicios (luz, agua, internet…).
 * Cada una guarda su próximo cobro; al pagarla se registra un gasto (desde un bolsillo) o una compra
 * de tarjeta, y el próximo cobro avanza un período. El día de cobro se conserva (31 → 28 → 31).
 * Tipo "Servicio": el valor es un estimado (el último que pagaste).
 *
 * Desde 1.15 esta es LA tabla de lo que pagas: cada cobro guarda también su empresa, su código de pago y su enlace.
 * Lo que antes estaba en Servicios_Publicos y Empresas_Pago se trajo aquí (unificarServicios_), sin borrar esas pestañas.
 * Un cobro sin "próximo cobro" es solo un dato de pago (un código o un enlace): no entra en próximos pagos, costos ni
 * presupuesto, igual que antes un servicio público sin suscripción.
 */

const MARCA_SUSCRIPCION = 'Suscripción ';
// Lo común con los ingresos recurrentes (periodos, costo mensual y anual, saltar y deshacer) está en Recurrentes.gs.

/** ¿El cobro tiene fecha (se repite)? Sin fecha es solo un dato de pago: código, enlace, empresa. */
function cobroProgramado_(s) { return !!texto_(s.Proximo_Cobro); }

function resumenSuscripcion_(s, hoy, ctx) {
  const programado = cobroProgramado_(s);
  const base = programado ? resumenRecurrente_(s, hoy, 'vencida')
    : { Valor: Number(s.Valor) || 0, Periodicidad: s.Periodicidad || 'Mensual', dias: null, estado: 'sin_fecha', mensual: 0, anual: 0 };
  const srv = s.ID_Servicio ? buscarPorId_(ctx.servicios, 'ID_Servicio', s.ID_Servicio) : null;
  const tar = s.ID_Tarjeta ? buscarPorId_(ctx.tarjetas, 'ID_Tarjeta', s.ID_Tarjeta) : null;
  const bol = s.ID_Bolsillo ? buscarPorId_(ctx.bolsillos, 'ID_Bolsillo', s.ID_Bolsillo) : null;
  const hog = s.ID_Inmueble ? buscarPorId_(ctx.inmuebles, 'ID_Inmueble', s.ID_Inmueble) : null;
  return {
    ID_Suscripcion: s.ID_Suscripcion, Nombre: s.Nombre, Tipo: s.Tipo || 'Suscripcion', Valor: base.Valor, Periodicidad: base.Periodicidad,
    Proximo_Cobro: s.Proximo_Cobro, dias: base.dias, estado: base.estado, mensual: base.mensual, anual: base.anual,
    ID_Bolsillo: s.ID_Bolsillo || '', ID_Tarjeta: s.ID_Tarjeta || '', medio: tar ? tar.Nombre : (bol ? bol.Nombre : ''),
    ID_Servicio: s.ID_Servicio || '', ID_Inmueble: s.ID_Inmueble || '', Hogar: hog ? hog.Nombre : '', Renglon: s.Renglon || '',
    // El código y el enlace son del propio cobro; los de antes de 1.15 que no se hayan unificado aún, del servicio enlazado
    codigo: texto_(s.Codigo_Pago) || (srv ? texto_(srv.Codigo_Pago) : ''), url: s.URL_Pago || (srv ? srv.URL_Pago || urlEmpresaServicio_(srv, ctx) : ''),
    Empresa: texto_(s.Empresa) || (srv ? texto_(srv.Empresa) : ''), programado: programado,
    Ultimo_Pago: s.Ultimo_Pago || '', Notas: s.Notas || ''
  };
}

/** El enlace de pago de un servicio: el propio o, si tiene una empresa registrada, el de la empresa. */
function urlEmpresaServicio_(srv, ctx) {
  const emp = srv && srv.ID_Empresa ? buscarPorId_(ctx.empresas || [], 'ID_Empresa', srv.ID_Empresa) : null;
  return emp ? emp.URL_Pago || '' : '';
}

function contextoSuscripciones_() {
  return { empresas: getTableData('Empresas_Pago'), servicios: getTableData('Servicios_Publicos'), tarjetas: getTableData('Tarjetas'), bolsillos: getTableData('Bolsillos'), inmuebles: getTableData('Inmuebles') };
}

/** Pantalla de suscripciones y servicios, en una sola llamada. */
function obtenerSuscripciones() {
  const hoy = hoyIso_();
  const ctx = contextoSuscripciones_();
  const todos = getTableData('Suscripciones').filter(estaActivo).map(s => resumenSuscripcion_(s, hoy, ctx));
  // Los cobros con fecha (lo que se paga y cuánto cuesta) y, aparte, los códigos y enlaces de pago de todos
  const lista = todos.filter(x => x.programado).sort((a, b) => a.dias - b.dias || a.Nombre.localeCompare(b.Nombre));
  const codigos = todos.filter(x => x.codigo || x.url).sort((a, b) => (a.Hogar || '').localeCompare(b.Hogar || '') || a.Nombre.localeCompare(b.Nombre));
  const susc = lista.filter(x => x.Tipo === 'Suscripcion');
  const t = totalesRecurrentes_(lista);
  return {
    items: lista,
    codigos: codigos,
    totales: {
      cantidad: t.cantidad, suscripciones: susc.length, mensual: t.mensual, anual: t.anual,
      mensualSuscripciones: totalesRecurrentes_(susc).mensual, porPagar: t.pronto
    }
  };
}

function suscripcionActiva_(id) {
  return exigirActivo_(leer_('Suscripciones'), 'ID_Suscripcion', id, 'La suscripción');
}

/** El renglón del presupuesto de ese mes al que está ligado un cobro (por el nombre del renglón), o null. */
function renglonDeCobro_(s, mes) {
  return renglonDeSuscripcion_(s, leer_('Presupuesto_Mes').filter(i => i.Mes === mes));
}

/**
 * Registra el pago de un cobro y avanza el próximo.
 * @param {Object} d { Valor, Fecha, ID_Bolsillo, ID_Tarjeta } — lo que falte sale de la suscripción.
 */
function pagarSuscripcion(id, d) {
  const s = suscripcionActiva_(id);
  const x = d || {};
  const valor = numero_(x.Valor !== undefined && x.Valor !== '' ? x.Valor : s.Valor, 'El valor', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const fecha = fechaMovimiento_(x.Fecha);
  const idTarjeta = x.ID_Tarjeta !== undefined ? texto_(x.ID_Tarjeta) : texto_(s.ID_Tarjeta);
  const idBolsillo = x.ID_Bolsillo !== undefined ? texto_(x.ID_Bolsillo) : texto_(s.ID_Bolsillo);
  if (!idTarjeta && !idBolsillo) throw new Error('Elige con qué la pagas: un bolsillo o una tarjeta.');
  if (idBolsillo) exigirPesos_(idBolsillo, 'El bolsillo de pago');

  const anterior = { Proximo_Cobro: s.Proximo_Cobro, Ultimo_Pago: s.Ultimo_Pago || '', Valor: Number(s.Valor) || 0 };
  const resultado = { idMov: '', idCompra: '', idItem: '' };
  return transaccion_(alDeshacer => {

  // Si el cobro está ligado a un renglón del presupuesto, el pago cuenta en el renglón del mes en que se paga.
  const item = renglonDeCobro_(s, fecha.slice(0, 7));
  if (item) resultado.idItem = item.ID_Item;
  // Un renglón que la app creó para esta suscripción queda como pagado al pagarla (así el ahorro del mes se calcula solo).
  const marcarPagado = !!(item && item.ID_Suscripcion === s.ID_Suscripcion);

  if (idTarjeta) {
    // Con renglón, el dinero se aparta ahora desde el bolsillo del renglón; sin renglón no se aparta nada.
    const compra = registrarCompraTC({
      ID_Tarjeta: idTarjeta, Concepto: s.Nombre, Valor: valor, Fecha: fecha,
      Fuente: item && item.ID_Bolsillo_Destino ? 'Ppto' : 'Personal', ID_Item_Ppto: item ? item.ID_Item : '',
      ID_Categoria: s.ID_Categoria, Notas: MARCA_SUSCRIPCION + s.ID_Suscripcion
    });
    resultado.idCompra = compra.ID_Compra;
    resultado.idMovReserva = compra.ID_Mov_Reserva || '';
    alDeshacer(() => anularCompraTC(compra.ID_Compra));
    if (x.cargos) registrarCargosTarjeta_(x.cargos, { idTarjeta: idTarjeta, fecha: fecha, concepto: s.Nombre, idRef: compra.ID_Compra, mes: compra.Mes_Extracto });
  } else {
    const mov = registrarMovimiento({
      Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: s.ID_Categoria,
      Concepto: s.Nombre, Notas: MARCA_SUSCRIPCION + s.ID_Suscripcion, ID_Item_Ppto: item ? item.ID_Item : ''
    });
    resultado.idMov = mov.ID_Mov;
    alDeshacer(() => anularMovimiento(mov.ID_Mov));
    // Comisión del pago (por ejemplo, PSE) o el 4x1000: gastos aparte, ligados al pago
    if (x.cargos) resultado.idsCargos = registrarCargos_(x.cargos, { idBolsillo: idBolsillo, fecha: fecha, concepto: s.Nombre, idRef: mov.ID_Mov, idItem: item ? item.ID_Item : '' });
  }

  if (marcarPagado) { marcarRenglonPagado(item.ID_Item, true); alDeshacer(() => marcarRenglonPagado(item.ID_Item, false)); }

  const cambios = { Proximo_Cobro: cobroProgramado_(s) ? siguienteCobro_(s) : '', Ultimo_Pago: fecha };
  if (s.Tipo === 'Servicio') cambios.Valor = valor; // el estimado pasa a ser el último pago
  updateRow('Suscripciones', s, cambios);
  invalidateCache('Suscripciones');
  return Object.assign(resultado, { anterior: anterior, proximo: cambios.Proximo_Cobro });
  });
}

/** Deshace un pago: anula el gasto o la compra y devuelve la suscripción a como estaba. */
function deshacerPagoSuscripcion(id, anterior, idMov, idCompra) {
  const s = suscripcionActiva_(id);
  if (!anterior || !anterior.Proximo_Cobro) throw new Error('Faltan los datos para deshacer.');
  return conBloqueo_(() => {
  // El renglón que se había marcado como pagado vuelve a estar pendiente.
  let idItem = '';
  if (idMov) { const g = filasDelGrupo_(idMov); idItem = g.mov.ID_Item_Ppto || ''; }
  else if (idCompra) { const c = buscarPorId_(leer_('Compras_TC'), 'ID_Compra', idCompra); idItem = c ? c.ID_Item_Ppto || '' : ''; }
  if (idMov) anularMovimiento(idMov);
  if (idCompra) anularCompraTC(idCompra);
  if (idItem) {
    const r = buscarPorId_(leer_('Presupuesto_Mes'), 'ID_Item', idItem);
    if (r && r.ID_Suscripcion === s.ID_Suscripcion && esVerdadero(r.Pagado)) marcarRenglonPagado(idItem, false);
  }
  restaurarRecurrente_('Suscripciones', s, anterior, 'Ultimo_Pago', true);
  invalidateCache('Suscripciones');
  return { ok: true };
  });
}

/** Pasa al siguiente cobro sin registrar nada (se pagó por otro lado, o este mes no aplica). */
function saltarCobroSuscripcion(id) {
  const s = suscripcionActiva_(id);
  if (!cobroProgramado_(s)) throw new Error('Este cobro no tiene fecha: no hay nada que saltar.');
  const r = saltarRecurrente_('Suscripciones', s, 'Ultimo_Pago');
  invalidateCache('Suscripciones');
  return r;
}

// ---------------------------------------------------------------------------
// Unificación (1.15): servicios públicos y empresas de pago pasan a ser datos del cobro
// ---------------------------------------------------------------------------

/**
 * Trae a Suscripciones lo que estaba en Servicios_Publicos y Empresas_Pago. No borra nada y se puede repetir sin duplicar:
 *   - Un servicio enlazado a un cobro le pasa su empresa y su código, en las columnas NUEVAS (Empresa, Codigo_Pago,
 *     ID_Empresa). Ninguna celda que la persona ya tenía cambia: el hogar y el enlace del cobro quedan como estaban (el
 *     enlace del servicio se sigue mostrando por resumenSuscripcion_, como antes).
 *   - Un servicio sin cobro se vuelve un cobro de tipo Servicio SIN fecha (solo datos de pago, como era), con su hogar,
 *     empresa, código, enlace y notas; queda activo o inactivo como estaba. Se reconoce por su ID_Servicio.
 *   - Una empresa que ningún servicio usaba se vuelve un dato de pago con su nombre y su enlace (se reconoce por ID_Empresa).
 * @returns {number} cuántos cobros se crearon o completaron
 */
function unificarServicios_() {
  const srvs = leer_('Servicios_Publicos'), emps = leer_('Empresas_Pago');
  if (!srvs.length && !emps.length) return 0;
  const subs = leer_('Suscripciones');
  const empPorId = {};
  emps.forEach(e => { empPorId[e.ID_Empresa] = e; });
  const nuevos = [], cambios = [];
  let orden = siguienteOrden_(subs);

  srvs.forEach(srv => {
    const emp = empPorId[srv.ID_Empresa] || null;
    const datos = {
      Empresa: emp ? texto_(emp.Nombre) : texto_(srv.Empresa), ID_Empresa: texto_(srv.ID_Empresa), Codigo_Pago: texto_(srv.Codigo_Pago),
      URL_Pago: texto_(srv.URL_Pago) || (emp ? texto_(emp.URL_Pago) : ''), ID_Inmueble: texto_(srv.ID_Inmueble)
    };
    const enlazados = subs.filter(s => texto_(s.ID_Servicio) === srv.ID_Servicio);
    if (enlazados.length) {
      enlazados.forEach(s => {
        const c = {};
        ['Empresa', 'Codigo_Pago', 'ID_Empresa'].forEach(k => { if (datos[k] && !texto_(s[k])) c[k] = datos[k]; });
        if (Object.keys(c).length) cambios.push({ fila: s, cambios: c });
      });
      return;
    }
    nuevos.push(Object.assign({
      ID_Suscripcion: nuevoId_('sus'), Nombre: texto_(srv.Tipo) || 'Servicio', Tipo: 'Servicio', Valor: 0, Periodicidad: 'Mensual',
      Proximo_Cobro: '', Dia_Cobro: '', ID_Bolsillo: '', ID_Tarjeta: '', ID_Categoria: '', ID_Servicio: srv.ID_Servicio, Renglon: '',
      Ultimo_Pago: '', Notas: texto_(srv.Notas), Activo: estaActivo(srv), Orden: orden++
    }, datos));
  });

  const empresasUsadas = {};
  srvs.forEach(srv => { if (srv.ID_Empresa) empresasUsadas[srv.ID_Empresa] = true; });
  emps.forEach(e => {
    if (empresasUsadas[e.ID_Empresa] || subs.some(s => texto_(s.ID_Empresa) === e.ID_Empresa)) return;
    nuevos.push({
      ID_Suscripcion: nuevoId_('sus'), Nombre: texto_(e.Nombre) || 'Empresa', Tipo: 'Servicio', Valor: 0, Periodicidad: 'Mensual',
      Proximo_Cobro: '', Dia_Cobro: '', ID_Bolsillo: '', ID_Tarjeta: '', ID_Categoria: '', ID_Servicio: '', ID_Inmueble: '', Renglon: '',
      URL_Pago: texto_(e.URL_Pago), Ultimo_Pago: '', Notas: texto_(e.Notas), Activo: estaActivo(e), Orden: orden++,
      Empresa: texto_(e.Nombre), Codigo_Pago: '', ID_Empresa: e.ID_Empresa
    });
  });

  if (!cambios.length && !nuevos.length) return 0;
  // Los códigos de pago son texto ("00123" no debe perder los ceros)
  try {
    const hoja = getSpreadsheet().getSheetByName('Suscripciones');
    const col = encabezados_(hoja, 'Suscripciones').indexOf('Codigo_Pago') + 1;
    if (col > 0) hoja.getRange(2, col, Math.max(hoja.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  } catch (e) { /* si no se puede dar formato, los datos igual quedan */ }
  conBloqueo_(() => {
    if (cambios.length) updateRows_('Suscripciones', cambios);
    if (nuevos.length) insertRows('Suscripciones', nuevos);
  });
  return cambios.length + nuevos.length;
}

