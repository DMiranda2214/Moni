/**
 * Tarjetas.gs — Moni
 * Compras con tarjeta de crédito y pago de extractos.
 *
 * Cómo funciona el dinero (igual que en el Excel):
 *   - Cada tarjeta tiene un bolsillo de RESERVA: el dinero apartado para pagarla.
 *   - Una compra no mueve plata por sí misma. Según su Fuente:
 *       Personal → no mueve nada: al pagar el extracto se completa la reserva desde el bolsillo personal.
 *       Ppto     → al registrarla, traslada ese valor del bolsillo del renglón (p. ej. Servicios) a la reserva.
 *       Guardar  → al registrarla, traslada ese valor del bolsillo personal a la reserva.
 *       Otro     → compra de otra persona: no mueve nada; quien debe reembolsar le da el dinero a la reserva.
 *   - Pagar el extracto, en una sola operación: completa la reserva con lo que falte (desde el
 *     bolsillo personal), paga el total desde la reserva y marca las compras como pagadas.
 */

function dosDigitos_(n) { return String(n).padStart(2, '0'); }

/** Mes (AAAA-MM) del extracto al que pertenece una compra: si pasa del día de corte, va al siguiente. */
function calcularMesExtracto_(fecha, diaCorte) {
  const p = String(fecha).split('-').map(Number);
  let anio = p[0], mes = p[1];
  if (p[2] > (Number(diaCorte) || 1)) { mes++; if (mes > 12) { mes = 1; anio++; } }
  return anio + '-' + dosDigitos_(mes);
}

/** Próxima fecha (desde `desde`, inclusive) cuyo día del mes sea `dia` (si el mes no lo tiene, el último). */
function proximoDiaDelMes_(dia, desde) {
  const p = desde.split('-').map(Number);
  const en = (anio, mes) => {
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return anio + '-' + dosDigitos_(mes) + '-' + dosDigitos_(Math.min(dia, ultimo));
  };
  const estaVez = en(p[0], p[1]);
  if (estaVez >= desde) return estaVez;
  return p[1] === 12 ? en(p[0] + 1, 1) : en(p[0], p[1] + 1);
}

/** Extracto pagado (y no anulado) de una tarjeta y un mes, si existe. */
function extractoPagado_(idTarjeta, mes) {
  return leer_('Extractos').find(x => x.ID_Tarjeta === idTarjeta && x.Mes === mes && !esVerdadero(x.Anulado)) || null;
}

/**
 * Registra una compra con tarjeta.
 * @param {Object} c { ID_Tarjeta, Fecha, Concepto, Valor, Fuente, ID_Bolsillo_Origen, ID_Item_Ppto, ID_Categoria, Mes_Extracto, Notas }
 */
function registrarCompraTC(c) {
  if (!c || typeof c !== 'object') throw new Error('Faltan los datos de la compra.');
  const tarjeta = exigirActivo_(leer_('Tarjetas'), 'ID_Tarjeta', c.ID_Tarjeta, 'La tarjeta');
  const fecha = fechaMovimiento_(c.Fecha);
  const concepto = textoRequerido_(c.Concepto, 'El concepto').slice(0, 120);
  const valor = numero_(c.Valor, 'El valor', { requerido: true, max: VALOR_MAXIMO });
  if (valor <= 0) throw new Error('El valor debe ser mayor que cero.');
  const idItemPedido = texto_(c.ID_Item_Ppto);
  // Con renglón del presupuesto, el dinero sale de su bolsillo en el momento de la compra (el sobre se vacía el día
  // que gastas). Sin renglón no se aparta nada: al pagar el extracto se indica de dónde sale el dinero.
  const fuente = opcion_(c.Fuente || (idItemPedido ? 'Ppto' : 'Personal'), ENUMS.Compras_TC.Fuente, 'La fuente');

  let mes = texto_(c.Mes_Extracto);
  if (mes) mes = mesValido_(mes); else mes = calcularMesExtracto_(fecha, tarjeta.Dia_Corte);
  if (extractoPagado_(tarjeta.ID_Tarjeta, mes)) {
    throw new Error('El extracto de ' + mes + ' ya está pagado. Anula su pago para agregar compras, o registra la compra con otra fecha.');
  }

  const idItem = renglonMovimiento_(texto_(c.ID_Item_Ppto));
  const idCategoria = categoriaMovimiento_(c.ID_Categoria, 'Gasto');
  const idCompra = nuevoId_('cmp');

  // Compras que apartan dinero en la reserva en el momento
  let idMovReserva = '';
  if (fuente === 'Ppto' || fuente === 'Guardar') {
    let origen = texto_(c.ID_Bolsillo_Origen);
    if (!origen && fuente === 'Ppto' && idItem) {
      const item = buscarPorId_(leer_('Presupuesto_Mes'), 'ID_Item', idItem);
      origen = item ? item.ID_Bolsillo_Destino : '';
    }
    if (!origen && fuente === 'Guardar') origen = tarjeta.ID_Bolsillo_Personal;
    if (!origen) {
      throw new Error(fuente === 'Ppto'
        ? 'Elige de qué bolsillo sale el dinero (por ejemplo, el bolsillo del renglón del presupuesto).'
        : 'Elige de qué bolsillo apartas el dinero, o define el bolsillo personal de la tarjeta.');
    }
    const r = registrarTransferencia(origen, tarjeta.ID_Bolsillo_Reserva, valor, fecha, 'Reserva ' + tarjeta.Nombre + ': ' + concepto,
      'Compra ' + idCompra, 'App', { Subtipo: 'Reserva_TC', ID_Item_Ppto: fuente === 'Ppto' ? idItem : '' });
    idMovReserva = r.patas[1].ID_Mov;
  }

  const fila = {
    ID_Compra: idCompra, Fecha: fecha, Concepto: concepto, Valor: valor, ID_Tarjeta: tarjeta.ID_Tarjeta, Mes_Extracto: mes,
    Fuente: fuente, ID_Categoria: idCategoria, ID_Item_Ppto: idItem, ID_Extracto: '', Pagado: false, ID_Mov_Reserva: idMovReserva,
    Notas: texto_(c.Notas).slice(0, 500), Origen: opcion_(c.Origen || 'App', ENUMS.Compras_TC.Origen, 'El origen'), Anulado: false
  };
  insertRow('Compras_TC', fila);
  return fila;
}

/** Anula una compra (y el dinero que apartó). No se puede si su extracto ya se pagó. */
function anularCompraTC(idCompra) {
  const compra = buscarPorId_(leer_('Compras_TC'), 'ID_Compra', idCompra);
  if (!compra) throw new Error('La compra no existe.');
  if (esVerdadero(compra.Anulado)) return { ids: [], tarjeta: compra.ID_Tarjeta, mes: compra.Mes_Extracto };
  if (esVerdadero(compra.Pagado)) throw new Error('Esa compra ya está en un extracto pagado. Anula primero el pago del extracto.');
  let ids = [];
  if (compra.ID_Mov_Reserva) ids = anularMovimiento(compra.ID_Mov_Reserva).ids;
  updateRow('Compras_TC', compra._rowIndex, { Anulado: true });
  return { ids: ids, tarjeta: compra.ID_Tarjeta, mes: compra.Mes_Extracto };
}

/** Deshace la anulación de una compra. */
function restaurarCompraTC(idCompra) {
  const compra = buscarPorId_(leer_('Compras_TC'), 'ID_Compra', idCompra);
  if (!compra) throw new Error('La compra no existe.');
  if (!esVerdadero(compra.Anulado)) return { ids: [], tarjeta: compra.ID_Tarjeta, mes: compra.Mes_Extracto };
  if (extractoPagado_(compra.ID_Tarjeta, compra.Mes_Extracto)) throw new Error('El extracto de ese mes ya está pagado.');
  let ids = [];
  if (compra.ID_Mov_Reserva) ids = restaurarMovimiento(compra.ID_Mov_Reserva).ids;
  updateRow('Compras_TC', compra._rowIndex, { Anulado: false });
  return { ids: ids, tarjeta: compra.ID_Tarjeta, mes: compra.Mes_Extracto };
}

/**
 * Paga el extracto de un mes en una sola operación. Si algo falla a medias, deshace lo hecho.
 * @returns {{idExtracto, total, falta, ids}} `falta` = lo que se completó desde el bolsillo personal.
 */
function pagarExtracto(idTarjeta, mes, fecha, idOrigen) {
  const tarjeta = exigirActivo_(leer_('Tarjetas'), 'ID_Tarjeta', idTarjeta, 'La tarjeta');
  const m = mesValido_(mes);
  const f = fechaMovimiento_(fecha);
  if (extractoPagado_(idTarjeta, m)) throw new Error('El extracto de ' + m + ' ya está pagado.');

  const compras = leer_('Compras_TC').filter(c => c.ID_Tarjeta === idTarjeta && c.Mes_Extracto === m && !esVerdadero(c.Anulado));
  if (!compras.length) throw new Error('Ese extracto no tiene compras.');
  const total = redondear2_(compras.reduce((a, c) => a + (Number(c.Valor) || 0), 0));

  const saldoReserva = mapaSaldosBolsillos_()[tarjeta.ID_Bolsillo_Reserva] || 0;
  const falta = Math.max(0, redondear2_(total - saldoReserva));
  // De dónde sale lo que falta lo indica quien paga; si no, se usa el bolsillo personal de la tarjeta (si lo tiene).
  const origen = texto_(idOrigen) || tarjeta.ID_Bolsillo_Personal;
  if (falta >= SALDO_CERO && !origen) {
    throw new Error('A la reserva le faltan ' + pesos_(falta) + ' para pagar. Elige de qué bolsillo sale ese dinero.');
  }
  if (falta >= SALDO_CERO) {
    exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', origen, 'El bolsillo de donde sale el dinero');
    exigirPesos_(origen, 'El bolsillo de donde sale el dinero');
    if (origen === tarjeta.ID_Bolsillo_Reserva) throw new Error('El dinero que falta no puede salir de la propia reserva.');
  }

  const idExtracto = nuevoId_('ext');
  const marca = 'Extracto ' + idExtracto;
  const idGrupoPago = nuevoId_('grp');
  const creados = [];
  try {
    if (falta >= SALDO_CERO) {
      const t = registrarTransferencia(origen, tarjeta.ID_Bolsillo_Reserva, falta, f, 'Completar la reserva de ' + tarjeta.Nombre, marca, 'App', { Subtipo: 'Reserva_TC' });
      t.patas.forEach(p => creados.push(p.ID_Mov));
    }
    const pago = registrarMovimiento({
      Tipo_Mov: 'Gasto', Subtipo: 'Pago_TC', Valor: total, Fecha: f, Concepto: 'Pago de ' + tarjeta.Nombre + ' · ' + m,
      ID_Bolsillo: tarjeta.ID_Bolsillo_Reserva, ID_Grupo: idGrupoPago, Notas: marca
    });
    creados.push(pago.ID_Mov);

    compras.forEach(c => updateRow('Compras_TC', c._rowIndex, { Pagado: true, ID_Extracto: idExtracto }));
    insertRow('Extractos', { ID_Extracto: idExtracto, ID_Tarjeta: idTarjeta, Mes: m, Total: total, Estado: 'Pagado', Fecha_Pago: f, ID_Grupo_Pago: idGrupoPago, URL_PDF: '', Notas: '', Anulado: false });
  } catch (e) {
    // Atomicidad: no se deja un pago a medias.
    creados.forEach(id => { try { anularMovimiento(id); } catch (x) {} });
    leer_('Compras_TC').filter(c => c.ID_Extracto === idExtracto).forEach(c => updateRow('Compras_TC', c._rowIndex, { Pagado: false, ID_Extracto: '' }));
    throw e;
  }
  return { idExtracto: idExtracto, total: total, falta: falta, ids: creados, tarjeta: idTarjeta, mes: m };
}

/** Anula el pago de un extracto: libera las compras y anula los movimientos del pago. */
function anularPagoExtracto(idExtracto) {
  const ext = buscarPorId_(leer_('Extractos'), 'ID_Extracto', idExtracto);
  if (!ext || esVerdadero(ext.Anulado)) throw new Error('No hay un pago de extracto para anular.');
  const marca = 'Extracto ' + idExtracto;
  const movs = leer_('Movimientos').filter(m => m.Notas === marca && !esVerdadero(m.Anulado));
  const ids = [];
  movs.forEach(m => { anularMovimiento(m.ID_Mov).ids.forEach(i => ids.push(i)); });
  leer_('Compras_TC').filter(c => c.ID_Extracto === idExtracto).forEach(c => updateRow('Compras_TC', c._rowIndex, { Pagado: false, ID_Extracto: '' }));
  updateRow('Extractos', ext._rowIndex, { Anulado: true });
  return { ids: ids, tarjeta: ext.ID_Tarjeta, mes: ext.Mes };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Todo lo de la pantalla de una tarjeta en un mes de extracto, en una sola llamada. */
function obtenerTarjeta(idTarjeta, mes) {
  const tarjeta = buscarPorId_(getTableData('Tarjetas'), 'ID_Tarjeta', idTarjeta);
  if (!tarjeta) throw new Error('La tarjeta no existe.');
  const banco = buscarPorId_(getTableData('Bancos'), 'ID_Banco', tarjeta.ID_Banco) || {};
  const bolsillos = getTableData('Bolsillos');
  const saldos = mapaSaldosBolsillos_();
  const categorias = getTableData('Categorias');
  const nombreBolsillo = id => { const b = buscarPorId_(bolsillos, 'ID_Bolsillo', id); return b ? b.Nombre : ''; };

  const hoy = hoyIso_();
  const mesActual = calcularMesExtracto_(hoy, tarjeta.Dia_Corte);
  const m = mes ? mesValido_(mes) : mesActual;

  const todas = getTableData('Compras_TC').filter(c => c.ID_Tarjeta === idTarjeta && !esVerdadero(c.Anulado));
  const extractos = getTableData('Extractos').filter(x => x.ID_Tarjeta === idTarjeta && !esVerdadero(x.Anulado));

  // Meses con compras (y el actual), del más reciente al más antiguo
  const mapaMeses = {};
  todas.forEach(c => { mapaMeses[c.Mes_Extracto] = (mapaMeses[c.Mes_Extracto] || 0) + (Number(c.Valor) || 0); });
  if (!(mesActual in mapaMeses)) mapaMeses[mesActual] = 0;
  const meses = Object.keys(mapaMeses).sort().reverse().map(k => ({
    mes: k, total: redondear2_(mapaMeses[k]), pagado: extractos.some(x => x.Mes === k)
  }));

  const compras = todas.filter(c => c.Mes_Extracto === m)
    .sort((a, b) => (b.Fecha > a.Fecha ? 1 : b.Fecha < a.Fecha ? -1 : 0))
    .map(c => ({
      ID_Compra: c.ID_Compra, Fecha: c.Fecha, Concepto: c.Concepto, Valor: Number(c.Valor) || 0, Fuente: c.Fuente,
      Pagado: esVerdadero(c.Pagado), ID_Categoria: c.ID_Categoria || '',
      Categoria: (buscarPorId_(categorias, 'ID_Categoria', c.ID_Categoria) || {}).Nombre || '',
      ID_Item_Ppto: c.ID_Item_Ppto || '', Notas: c.Notas || '', ApartoDinero: !!c.ID_Mov_Reserva
    }));

  const porFuente = { Personal: 0, Ppto: 0, Guardar: 0, Otro: 0 };
  let total = 0;
  compras.forEach(c => { total += c.Valor; porFuente[c.Fuente] = (porFuente[c.Fuente] || 0) + c.Valor; });
  total = redondear2_(total);
  const extracto = extractos.find(x => x.Mes === m) || null;
  const saldoReserva = saldos[tarjeta.ID_Bolsillo_Reserva] || 0;
  const usado = redondear2_(todas.filter(c => !esVerdadero(c.Pagado)).reduce((a, c) => a + (Number(c.Valor) || 0), 0));
  const cupo = Number(tarjeta.Cupo) || 0;

  return {
    tarjeta: { ID_Tarjeta: tarjeta.ID_Tarjeta, Nombre: tarjeta.Nombre, Banco: banco.Nombre || '', Cupo: cupo, Dia_Corte: Number(tarjeta.Dia_Corte), Dia_Pago: Number(tarjeta.Dia_Pago) },
    reserva: { ID_Bolsillo: tarjeta.ID_Bolsillo_Reserva, Nombre: nombreBolsillo(tarjeta.ID_Bolsillo_Reserva), Saldo: saldoReserva },
    personal: tarjeta.ID_Bolsillo_Personal ? { ID_Bolsillo: tarjeta.ID_Bolsillo_Personal, Nombre: nombreBolsillo(tarjeta.ID_Bolsillo_Personal) } : null,
    mes: m, mesActual: mesActual, meses: meses, compras: compras,
    totales: { total: total, porFuente: porFuente, faltaParaPagar: extracto ? 0 : Math.max(0, redondear2_(total - saldoReserva)), sobranteReserva: Math.max(0, redondear2_(saldoReserva - total)) },
    extracto: extracto ? { ID_Extracto: extracto.ID_Extracto, Total: Number(extracto.Total) || 0, Fecha_Pago: extracto.Fecha_Pago } : null,
    cupo: { usado: usado, disponible: redondear2_(cupo - usado) },
    proximoCorte: proximoDiaDelMes_(Number(tarjeta.Dia_Corte), hoy),
    proximoPago: proximoDiaDelMes_(Number(tarjeta.Dia_Pago), hoy)
  };
}

/** Resumen de todas las tarjetas activas (para la pantalla de Deudas). */
function resumenTarjetas_() {
  const saldos = mapaSaldosBolsillos_();
  const hoy = hoyIso_();
  const compras = getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado));
  const extractos = getTableData('Extractos').filter(x => !esVerdadero(x.Anulado));
  const bancos = getTableData('Bancos');
  return getTableData('Tarjetas').filter(t => estaActivo(t)).map(t => {
    const mesActual = calcularMesExtracto_(hoy, t.Dia_Corte);
    const mias = compras.filter(c => c.ID_Tarjeta === t.ID_Tarjeta);
    const delMes = mias.filter(c => c.Mes_Extracto === mesActual);
    const total = redondear2_(delMes.reduce((a, c) => a + (Number(c.Valor) || 0), 0));
    const pagado = extractos.some(x => x.ID_Tarjeta === t.ID_Tarjeta && x.Mes === mesActual);
    const usado = redondear2_(mias.filter(c => !esVerdadero(c.Pagado)).reduce((a, c) => a + (Number(c.Valor) || 0), 0));
    const saldoReserva = saldos[t.ID_Bolsillo_Reserva] || 0;
    const b = buscarPorId_(bancos, 'ID_Banco', t.ID_Banco) || {};
    return {
      ID_Tarjeta: t.ID_Tarjeta, Nombre: t.Nombre, Banco: b.Nombre || '', Cupo: Number(t.Cupo) || 0, Dia_Corte: Number(t.Dia_Corte), Dia_Pago: Number(t.Dia_Pago),
      mes: mesActual, total: total, pagado: pagado, faltaParaPagar: pagado ? 0 : Math.max(0, redondear2_(total - saldoReserva)),
      saldoReserva: saldoReserva, cupoDisponible: redondear2_((Number(t.Cupo) || 0) - usado), proximoPago: proximoDiaDelMes_(Number(t.Dia_Pago), hoy)
    };
  });
}
