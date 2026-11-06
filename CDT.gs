/**
 * CDT.gs — Moni
 * Certificados de depósito a término: dinero que se entrega a un banco por un plazo fijo a una tasa efectiva anual.
 *
 * El capital de un CDT vigente NO es dinero disponible: aparece aparte, como "Invertido". Con el libro de movimientos
 * se maneja así (todos son movimientos normales, así que se pueden anular y quedan en el historial):
 *   CDT_Apertura → Ajuste negativo: el capital sale del bolsillo del que se pagó (solo si se pidió descontarlo; un CDT que
 *                  la persona ya tenía antes de usar Moni no descuenta nada porque ese dinero nunca estuvo en sus bolsillos).
 *   Interes      → Ingreso: lo ganado (también el de los pagos periódicos).
 *   Retencion    → Gasto: la retención en la fuente sobre lo ganado (el porcentaje lo indica la persona en cada CDT).
 *   CDT_Retorno  → Ajuste positivo: el capital que vuelve a un bolsillo al cobrar o cancelar.
 *
 * Interés de un CDT = capital × ((1 + EA)^(días / 365) − 1). Es un estimado: el banco puede redondear distinto.
 */

const PERIODO_PAGO_CDT = { Vencimiento: 0, Mensual: 1, Trimestral: 3 };

function interesCdt_(capital, ea, dias) {
  return redondear2_((Number(capital) || 0) * (Math.pow(1 + (Number(ea) || 0), Math.max(0, dias) / 365) - 1));
}

/** Fecha del próximo pago de intereses de un CDT periódico: la primera fecha del calendario del CDT que no sea pasada. */
function proximoPagoInteresCdt_(inicio, meses, vencimiento, desde) {
  if (!meses) return '';
  const dia = Number(inicio.slice(8, 10));
  for (let k = meses; k < 1200; k += meses) {
    const f = sumarMeses_(inicio, k, dia);
    if (f >= vencimiento) return vencimiento;
    if (f >= desde) return f;
  }
  return vencimiento;
}

/** Un CDT con sus cifras calculadas. */
function resumenCdt_(c, hoy, bancos) {
  const capital = Number(c.Capital) || 0, ea = Number(c.Tasa_EA) || 0, plazo = Number(c.Plazo_Dias) || 0;
  const pct = Number(c.Retencion_Pct) || 0;
  const interesTotal = interesCdt_(capital, ea, plazo);
  const dias = diasEntre_(hoy, c.Fecha_Vencimiento);
  const transcurridos = Math.max(0, Math.min(plazo, plazo - dias));
  const vigente = c.Estado === 'Vigente';
  const cobrados = Number(c.Intereses_Cobrados) || 0;
  const banco = buscarPorId_(bancos, 'ID_Banco', c.ID_Banco);

  // Lo que se espera recibir si se cobra hoy: al vencimiento todo lo que falta; antes, solo lo causado hasta hoy.
  const causado = dias <= 0 ? interesTotal : interesCdt_(capital, ea, transcurridos);
  const interesHoy = redondear2_(Math.max(0, causado - cobrados));
  const meses = PERIODO_PAGO_CDT[c.Pago_Intereses] || 0;
  let proximoPago = null;
  if (vigente && meses && c.Prox_Pago_Interes) {
    const desde = c.Ultimo_Pago_Interes || c.Fecha_Inicio;
    const esFinal = c.Prox_Pago_Interes >= c.Fecha_Vencimiento;
    const valor = esFinal ? Math.max(0, interesTotal - cobrados) : interesCdt_(capital, ea, diasEntre_(desde, c.Prox_Pago_Interes));
    proximoPago = { fecha: c.Prox_Pago_Interes, dias: diasEntre_(hoy, c.Prox_Pago_Interes), valor: redondear2_(valor), esFinal: esFinal };
  }
  return {
    ID_CDT: c.ID_CDT, Nombre: c.Nombre, ID_Banco: c.ID_Banco, Banco: banco ? banco.Nombre : '',
    Capital: capital, Tasa_EA: ea, Fecha_Inicio: c.Fecha_Inicio, Plazo_Dias: plazo, Fecha_Vencimiento: c.Fecha_Vencimiento,
    Pago_Intereses: c.Pago_Intereses || 'Vencimiento', Retencion_Pct: pct, Estado: c.Estado || 'Vigente',
    ID_Bolsillo_Origen: c.ID_Bolsillo_Origen || '', ID_Bolsillo_Destino: c.ID_Bolsillo_Destino || '',
    Renovar: esVerdadero(c.Renovar), Fecha_Cierre: c.Fecha_Cierre || '', Notas: c.Notas || '',
    descontado: !!c.ID_Mov_Apertura, cobrados: cobrados,
    dias: dias, avance: plazo > 0 ? Math.round(transcurridos / plazo * 1000) / 1000 : 0,
    estado: !vigente ? 'cerrado' : (dias < 0 ? 'vencido' : (dias <= DIAS_RECORDATORIO ? 'pronto' : 'ok')),
    interesTotal: interesTotal, retencionTotal: redondear2_(interesTotal * pct), netoTotal: redondear2_(interesTotal * (1 - pct)),
    sugerencia: { interes: interesHoy, retencion: redondear2_(interesHoy * pct) },
    proximoPago: proximoPago,
    editableCifras: vigente && !c.ID_Mov_Apertura && !cobrados
  };
}

/** Pantalla de CDT: lista y totales. */
function obtenerCdts() {
  const hoy = hoyIso_();
  const bancos = getTableData('Bancos');
  const todos = getTableData('CDTs').filter(estaActivo).map(c => resumenCdt_(c, hoy, bancos));
  const vigentes = todos.filter(c => c.Estado === 'Vigente').sort((a, b) => a.dias - b.dias || a.Nombre.localeCompare(b.Nombre));
  const cerrados = todos.filter(c => c.Estado !== 'Vigente').sort((a, b) => (b.Fecha_Cierre || '').localeCompare(a.Fecha_Cierre || ''));
  const suma = (arr, f) => redondear2_(arr.reduce((a, x) => a + f(x), 0));
  return {
    vigentes: vigentes, cerrados: cerrados,
    totales: {
      invertido: suma(vigentes, c => c.Capital), cantidad: vigentes.length,
      interesesEsperados: suma(vigentes, c => c.interesTotal - c.cobrados), netoEsperado: suma(vigentes, c => (c.interesTotal - c.cobrados) * (1 - c.Retencion_Pct)),
      proximoVencimiento: vigentes.length ? vigentes[0].Fecha_Vencimiento : ''
    }
  };
}

/** Lo que muestra Inicio como "Invertido". */
function resumenInvertido_() {
  const vigentes = getTableData('CDTs').filter(c => estaActivo(c) && c.Estado === 'Vigente');
  return {
    total: redondear2_(vigentes.reduce((a, c) => a + (Number(c.Capital) || 0), 0)), cantidad: vigentes.length,
    proximoVencimiento: vigentes.map(c => c.Fecha_Vencimiento).sort()[0] || ''
  };
}

function cdtVigente_(id) {
  const c = buscarPorId_(leer_('CDTs'), 'ID_CDT', id);
  if (!c || !estaActivo(c)) throw new Error('El CDT no existe.');
  if (c.Estado !== 'Vigente') throw new Error('Este CDT ya está cerrado.');
  return c;
}

function bolsilloDeCdt_(c, pedido) {
  const id = texto_(pedido) || c.ID_Bolsillo_Destino || c.ID_Bolsillo_Origen;
  if (!id) throw new Error('Elige el bolsillo al que llega el dinero.');
  exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', id, 'El bolsillo');
  exigirPesos_(id, 'El bolsillo');
  return id;
}

/** Intereses y retención de un cobro, como movimientos. Devuelve los IDs. */
function movimientosInteresCdt_(c, d, idBolsillo, fecha) {
  const ids = [];
  const interes = numero_(d.Interes, 'Los intereses', { requerido: true, min: 0, max: VALOR_MAXIMO });
  const retencion = numero_(d.Retencion === undefined || d.Retencion === '' ? 0 : d.Retencion, 'La retención', { min: 0, max: VALOR_MAXIMO });
  if (retencion > interes) throw new Error('La retención no puede ser mayor que los intereses.');
  if (interes > 0) ids.push(registrarMovimiento({ Tipo_Mov: 'Ingreso', Subtipo: 'Interes', Valor: interes, Fecha: fecha, Concepto: 'Intereses CDT ' + c.Nombre, ID_Bolsillo: idBolsillo }).ID_Mov);
  if (retencion > 0) ids.push(registrarMovimiento({ Tipo_Mov: 'Gasto', Subtipo: 'Retencion', Valor: retencion, Fecha: fecha, Concepto: 'Retención CDT ' + c.Nombre, ID_Bolsillo: idBolsillo }).ID_Mov);
  return { ids: ids, interes: interes, retencion: retencion };
}

/**
 * Registra el pago de intereses de un CDT que los paga cada mes o cada trimestre, y avanza el próximo pago.
 * @param {Object} d { Interes, Retencion, ID_Bolsillo, Fecha } — lo que falte sale de lo calculado.
 */
function cobrarInteresesCdt(id, d) {
  const c = cdtVigente_(id);
  const x = d || {};
  const r = resumenCdt_(c, hoyIso_(), leer_('Bancos'));
  if (!r.proximoPago) throw new Error('Este CDT paga los intereses al vencimiento: se registran al cobrarlo.');
  const fecha = fechaMovimiento_(x.Fecha);
  const idBolsillo = bolsilloDeCdt_(c, x.ID_Bolsillo);
  const datos = {
    Interes: x.Interes !== undefined && x.Interes !== '' ? x.Interes : r.proximoPago.valor,
    Retencion: x.Retencion !== undefined && x.Retencion !== '' ? x.Retencion : redondear2_(r.proximoPago.valor * r.Retencion_Pct)
  };
  const m = movimientosInteresCdt_(c, datos, idBolsillo, fecha);
  const meses = PERIODO_PAGO_CDT[c.Pago_Intereses] || 0;
  const siguiente = r.proximoPago.esFinal ? c.Fecha_Vencimiento : proximoPagoInteresCdt_(c.Fecha_Inicio, meses, c.Fecha_Vencimiento, sumarDias_(c.Prox_Pago_Interes, 1));
  updateRow('CDTs', c._rowIndex, {
    Intereses_Cobrados: redondear2_((Number(c.Intereses_Cobrados) || 0) + m.interes), Ultimo_Pago_Interes: c.Prox_Pago_Interes, Prox_Pago_Interes: siguiente
  });
  invalidateCache('CDTs');
  return { ids: m.ids, interes: m.interes, retencion: m.retencion };
}

/**
 * Cobra un CDT (al vencimiento) o lo cancela antes. El capital vuelve a un bolsillo y los intereses y la retención quedan
 * anotados. Con `Renovar`, el capital sigue invertido: se crea otro CDT con las mismas condiciones desde esa fecha.
 * @param {Object} d { Capital, Interes, Retencion, ID_Bolsillo, Fecha, Renovar, Tasa_EA?, Plazo_Dias? }
 */
function cerrarCdt(id, d) {
  const c = cdtVigente_(id);
  const x = d || {};
  const fecha = fechaMovimiento_(x.Fecha);
  if (fecha < c.Fecha_Inicio) throw new Error('La fecha no puede ser anterior al inicio del CDT.');
  const r = resumenCdt_(c, fecha, leer_('Bancos'));
  const idBolsillo = bolsilloDeCdt_(c, x.ID_Bolsillo);
  const renovar = x.Renovar !== undefined ? esVerdadero(x.Renovar) : esVerdadero(c.Renovar);
  const capital = numero_(x.Capital === undefined || x.Capital === '' ? c.Capital : x.Capital, 'El capital devuelto', { min: 0, max: VALOR_MAXIMO });
  const datos = {
    Interes: x.Interes !== undefined && x.Interes !== '' ? x.Interes : r.sugerencia.interes,
    Retencion: x.Retencion !== undefined && x.Retencion !== '' ? x.Retencion : r.sugerencia.retencion
  };
  const ids = [];
  if (!renovar && capital > 0) {
    ids.push(registrarMovimiento({ Tipo_Mov: 'Ajuste', Subtipo: 'CDT_Retorno', Valor: capital, Fecha: fecha, Concepto: 'Capital CDT ' + c.Nombre, ID_Bolsillo: idBolsillo }).ID_Mov);
  }
  const m = movimientosInteresCdt_(c, datos, idBolsillo, fecha);
  m.ids.forEach(i => ids.push(i));
  updateRow('CDTs', c._rowIndex, {
    Estado: 'Cerrado', Fecha_Cierre: fecha, Prox_Pago_Interes: '', Intereses_Cobrados: redondear2_((Number(c.Intereses_Cobrados) || 0) + m.interes)
  });
  invalidateCache('CDTs');

  let renovado = null;
  if (renovar) {
    const existentes = leer_('CDTs').map(f => texto_(f.Nombre).toLowerCase());
    let nombre = c.Nombre, n = 2;
    while (existentes.indexOf(nombre.toLowerCase()) !== -1) nombre = c.Nombre + ' (' + (n++) + ')';
    renovado = guardarCatalogo('CDTs', {
      Nombre: nombre, ID_Banco: c.ID_Banco, Capital: capital || c.Capital, Tasa_EA: x.Tasa_EA !== undefined && x.Tasa_EA !== '' ? x.Tasa_EA : c.Tasa_EA,
      Fecha_Inicio: fecha, Plazo_Dias: x.Plazo_Dias !== undefined && x.Plazo_Dias !== '' ? x.Plazo_Dias : c.Plazo_Dias,
      Pago_Intereses: c.Pago_Intereses, Retencion_Pct: c.Retencion_Pct, ID_Bolsillo_Destino: c.ID_Bolsillo_Destino, Renovar: true, Notas: 'Renovación de ' + c.Nombre
    });
  }
  return { ids: ids, interes: m.interes, retencion: m.retencion, renovado: renovado };
}

/** Anula un CDT que se registró por error: devuelve el capital al bolsillo del que salió. Solo si aún no tiene cobros. */
function anularCdt(id) {
  const c = buscarPorId_(leer_('CDTs'), 'ID_CDT', id);
  if (!c || !estaActivo(c)) throw new Error('El CDT no existe.');
  if (c.Estado !== 'Vigente') throw new Error('Este CDT ya se cobró o se canceló: sus movimientos quedan en el historial.');
  if (Number(c.Intereses_Cobrados) > 0) throw new Error('Este CDT ya tiene intereses cobrados; no se puede anular.');
  const ids = [];
  if (c.ID_Mov_Apertura) { anularMovimiento(c.ID_Mov_Apertura); ids.push(c.ID_Mov_Apertura); }
  updateRow('CDTs', c._rowIndex, { Activo: false });
  invalidateCache('CDTs');
  return { ids: ids };
}

/** Pagos de intereses y vencimientos próximos, para "Por recibir" de Inicio y para los recordatorios. */
function eventosCdt_(horizonte) {
  const hoy = hoyIso_();
  const bancos = getTableData('Bancos');
  const lista = [];
  getTableData('CDTs').filter(c => estaActivo(c) && c.Estado === 'Vigente').forEach(c => {
    const r = resumenCdt_(c, hoy, bancos);
    const final = { fecha: r.Fecha_Vencimiento, dias: r.dias, valor: redondear2_(r.Capital + r.sugerencia.interes - r.sugerencia.retencion), detalle: 'Vence el CDT · capital e intereses' };
    const evento = r.proximoPago && !r.proximoPago.esFinal
      ? { fecha: r.proximoPago.fecha, dias: r.proximoPago.dias, valor: r.proximoPago.valor, detalle: 'Intereses del CDT' } : final;
    if (evento.dias > horizonte) return;
    lista.push({ tipo: 'CDT', id: r.ID_CDT, titulo: 'CDT ' + r.Nombre, fecha: evento.fecha, dias: evento.dias, valor: evento.valor, detalle: evento.detalle, cdt: r });
  });
  return lista;
}
