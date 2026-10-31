/**
 * Suscripciones.gs — Moni
 * Pagos que se repiten: suscripciones (Netflix, Disney…) y servicios (luz, agua, internet…).
 * Cada una guarda su próximo cobro; al pagarla se registra un gasto (desde un bolsillo) o una compra
 * de tarjeta, y el próximo cobro avanza un período. El día de cobro se conserva (31 → 28 → 31).
 * Tipo "Servicio": el valor es un estimado (el último que pagaste) y puede enlazar un servicio público
 * con su código de pago y su enlace.
 */

const MESES_PERIODO = { Mensual: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };
const MARCA_SUSCRIPCION = 'Suscripción ';
const DIAS_PRONTO = 7;

function diasDelMes_(anio, mes) { return new Date(Date.UTC(anio, mes, 0)).getUTCDate(); }

/** Suma meses a una fecha AAAA-MM-DD conservando el día de cobro (con tope en el último día del mes). */
function sumarMeses_(fechaIso, meses, dia) {
  const a = +fechaIso.slice(0, 4), m = +fechaIso.slice(5, 7) - 1 + meses;
  const anio = a + Math.floor(m / 12), mes = ((m % 12) + 12) % 12 + 1;
  const d = Math.min(dia || +fechaIso.slice(8, 10), diasDelMes_(anio, mes));
  return anio + '-' + ('0' + mes).slice(-2) + '-' + ('0' + d).slice(-2);
}

/** Lo que cuesta al mes (para comparar una suscripción anual con una mensual). */
function costoMensual_(valor, periodicidad) {
  return redondear2_((Number(valor) || 0) / (MESES_PERIODO[periodicidad] || 1));
}

function resumenSuscripcion_(s, hoy, ctx) {
  const dias = diasEntre_(hoy, s.Proximo_Cobro);
  const srv = s.ID_Servicio ? buscarPorId_(ctx.servicios, 'ID_Servicio', s.ID_Servicio) : null;
  const tar = s.ID_Tarjeta ? buscarPorId_(ctx.tarjetas, 'ID_Tarjeta', s.ID_Tarjeta) : null;
  const bol = s.ID_Bolsillo ? buscarPorId_(ctx.bolsillos, 'ID_Bolsillo', s.ID_Bolsillo) : null;
  const valor = Number(s.Valor) || 0;
  return {
    ID_Suscripcion: s.ID_Suscripcion, Nombre: s.Nombre, Tipo: s.Tipo || 'Suscripcion', Valor: valor, Periodicidad: s.Periodicidad || 'Mensual',
    Proximo_Cobro: s.Proximo_Cobro, dias: dias, estado: dias < 0 ? 'vencida' : (dias <= DIAS_PRONTO ? 'pronto' : 'ok'),
    mensual: costoMensual_(valor, s.Periodicidad), anual: redondear2_(valor * 12 / (MESES_PERIODO[s.Periodicidad] || 1)),
    ID_Bolsillo: s.ID_Bolsillo || '', ID_Tarjeta: s.ID_Tarjeta || '', medio: tar ? tar.Nombre : (bol ? bol.Nombre : ''),
    ID_Servicio: s.ID_Servicio || '', Renglon: s.Renglon || '', codigo: srv ? srv.Codigo_Pago : '', url: s.URL_Pago || (srv ? srv.URL_Pago || '' : ''),
    Ultimo_Pago: s.Ultimo_Pago || '', Notas: s.Notas || ''
  };
}

function contextoSuscripciones_() {
  return { servicios: getTableData('Servicios_Publicos'), tarjetas: getTableData('Tarjetas'), bolsillos: getTableData('Bolsillos') };
}

/** Pantalla de suscripciones y servicios, en una sola llamada. */
function obtenerSuscripciones() {
  const hoy = hoyIso_();
  const ctx = contextoSuscripciones_();
  const lista = getTableData('Suscripciones').filter(estaActivo)
    .map(s => resumenSuscripcion_(s, hoy, ctx)).sort((a, b) => a.dias - b.dias || a.Nombre.localeCompare(b.Nombre));
  const suma = (arr, f) => redondear2_(arr.reduce((acc, x) => acc + f(x), 0));
  const susc = lista.filter(x => x.Tipo === 'Suscripcion');
  return {
    items: lista,
    totales: {
      cantidad: lista.length, suscripciones: susc.length,
      mensual: suma(lista, x => x.mensual), anual: suma(lista, x => x.anual),
      mensualSuscripciones: suma(susc, x => x.mensual),
      porPagar: lista.filter(x => x.dias <= DIAS_PRONTO).length
    }
  };
}

function suscripcionActiva_(id) {
  return exigirActivo_(leer_('Suscripciones'), 'ID_Suscripcion', id, 'La suscripción');
}

/** El renglón del presupuesto de ese mes al que está ligado un cobro (por el nombre del renglón), o null. */
function renglonDeCobro_(s, mes) {
  const nombre = texto_(s.Renglon).toLowerCase();
  if (!nombre) return null;
  return leer_('Presupuesto_Mes').find(i => i.Mes === mes && texto_(i.Concepto).toLowerCase() === nombre) || null;
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

  // Si el cobro está ligado a un renglón del presupuesto, el pago cuenta en el renglón del mes en que se paga.
  const item = renglonDeCobro_(s, fecha.slice(0, 7));
  if (item) resultado.idItem = item.ID_Item;

  if (idTarjeta) {
    // Con renglón, el dinero se aparta ahora desde el bolsillo del renglón; sin renglón no se aparta nada.
    const compra = registrarCompraTC({
      ID_Tarjeta: idTarjeta, Concepto: s.Nombre, Valor: valor, Fecha: fecha,
      Fuente: item && item.ID_Bolsillo_Destino ? 'Ppto' : 'Personal', ID_Item_Ppto: item ? item.ID_Item : '',
      ID_Categoria: s.ID_Categoria, Notas: MARCA_SUSCRIPCION + s.ID_Suscripcion
    });
    resultado.idCompra = compra.ID_Compra;
    resultado.idMovReserva = compra.ID_Mov_Reserva || '';
  } else {
    const mov = registrarMovimiento({
      Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: s.ID_Categoria,
      Concepto: s.Nombre, Notas: MARCA_SUSCRIPCION + s.ID_Suscripcion, ID_Item_Ppto: item ? item.ID_Item : ''
    });
    resultado.idMov = mov.ID_Mov;
  }

  const cambios = { Proximo_Cobro: sumarMeses_(s.Proximo_Cobro, MESES_PERIODO[s.Periodicidad] || 1, Number(s.Dia_Cobro)), Ultimo_Pago: fecha };
  if (s.Tipo === 'Servicio') cambios.Valor = valor; // el estimado pasa a ser el último pago
  updateRow('Suscripciones', s._rowIndex, cambios);
  invalidateCache('Suscripciones');
  return Object.assign(resultado, { anterior: anterior, proximo: cambios.Proximo_Cobro });
}

/** Deshace un pago: anula el gasto o la compra y devuelve la suscripción a como estaba. */
function deshacerPagoSuscripcion(id, anterior, idMov, idCompra) {
  const s = suscripcionActiva_(id);
  if (!anterior || !anterior.Proximo_Cobro) throw new Error('Faltan los datos para deshacer.');
  if (idMov) anularMovimiento(idMov);
  if (idCompra) anularCompraTC(idCompra);
  updateRow('Suscripciones', s._rowIndex, {
    Proximo_Cobro: fechaIso_(anterior.Proximo_Cobro, 'El cobro'), Ultimo_Pago: texto_(anterior.Ultimo_Pago),
    Valor: numero_(anterior.Valor, 'El valor', { defecto: s.Valor })
  });
  invalidateCache('Suscripciones');
  return { ok: true };
}

/** Pasa al siguiente cobro sin registrar nada (se pagó por otro lado, o este mes no aplica). */
function saltarCobroSuscripcion(id) {
  const s = suscripcionActiva_(id);
  const anterior = { Proximo_Cobro: s.Proximo_Cobro, Ultimo_Pago: s.Ultimo_Pago || '', Valor: Number(s.Valor) || 0 };
  const proximo = sumarMeses_(s.Proximo_Cobro, MESES_PERIODO[s.Periodicidad] || 1, Number(s.Dia_Cobro));
  updateRow('Suscripciones', s._rowIndex, { Proximo_Cobro: proximo });
  invalidateCache('Suscripciones');
  return { anterior: anterior, proximo: proximo };
}
