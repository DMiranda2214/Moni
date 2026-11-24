/**
 * Regalos.gs — Moni
 * Lista de regalos por año (por ejemplo, Navidad): a quién, qué idea, cuánto se estima y cuánto
 * se gastó. El "real" se CALCULA desde los gastos registrados para ese regalo, igual que el real
 * del presupuesto.
 */

const MARCA_REGALO = 'Regalo ';

function anioValido_(anio) {
  const n = Number(anio);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error('El año no es válido.');
  return n;
}

/** Gasto real por regalo, desde los movimientos marcados con "Regalo <ID>". */
function realPorRegalo_() {
  const real = {};
  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    const n = texto_(m.Notas);
    if (n.indexOf(MARCA_REGALO) !== 0 || m.Tipo_Mov !== 'Gasto') return;
    const id = n.slice(MARCA_REGALO.length);
    real[id] = redondear2_((real[id] || 0) + (-(Number(m.Valor) || 0)));
  });
  // Las compras con tarjeta también cuentan como lo gastado en el regalo
  getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado)).forEach(c => {
    const n = texto_(c.Notas);
    if (n.indexOf(MARCA_REGALO) !== 0) return;
    const id = n.slice(MARCA_REGALO.length);
    real[id] = redondear2_((real[id] || 0) + (Number(c.Valor) || 0));
  });
  return real;
}

/**
 * Regalos comprados con tarjeta cuyo dinero todavía no se movió a la reserva de la tarjeta. Mientras la compra esté sin
 * pagar en un extracto, se sigue pidiendo mover el dinero (del bolsillo planeado a la reserva) hasta que la persona registre
 * ese traslado. Los traslados que cuentan: manuales (sin subtipo), a la reserva de esa tarjeta, hechos desde el bolsillo
 * planeado (si el regalo lo tiene) y posteriores a la compra. Cada traslado se reparte entre los regalos por orden de compra.
 */
function regalosPendientesReserva_() {
  const regalos = getTableData('Regalos'), personas = getTableData('Personas'), tarjetas = getTableData('Tarjetas'), bolsillos = getTableData('Bolsillos');
  const compras = getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado) && !esVerdadero(c.Pagado) && texto_(c.Notas).indexOf(MARCA_REGALO) === 0);
  if (!compras.length) return [];
  const movs = getTableData('Movimientos', { excludeAnulados: true }).filter(m => m.Tipo_Mov === 'Transferencia' && !m.Subtipo && m.ID_Grupo && afectaSaldos_(m));
  const porGrupo = {};
  movs.forEach(m => { (porGrupo[m.ID_Grupo] = porGrupo[m.ID_Grupo] || []).push(m); });
  const nombre = (lista, col, id, campo) => { const f = buscarPorId_(lista, col, id); return f ? f[campo || 'Nombre'] : ''; };

  // Un regalo por tarjeta con lo que falta mover
  const porRegalo = {};
  compras.forEach(c => {
    const idRegalo = texto_(c.Notas).slice(MARCA_REGALO.length);
    const k = idRegalo + '|' + c.ID_Tarjeta;
    const x = porRegalo[k] || (porRegalo[k] = { idRegalo: idRegalo, idTarjeta: c.ID_Tarjeta, total: 0, desde: c.Fecha });
    x.total = redondear2_(x.total + (Number(c.Valor) || 0));
    if (c.Fecha < x.desde) x.desde = c.Fecha;
  });
  const consumido = {}; // por id de movimiento: cuánto de ese traslado ya se asignó a un regalo
  const salida = [];
  Object.keys(porRegalo).map(k => porRegalo[k]).sort((a, b) => (a.desde > b.desde ? 1 : a.desde < b.desde ? -1 : 0)).forEach(x => {
    const regalo = buscarPorId_(regalos, 'ID_Regalo', x.idRegalo);
    const tarjeta = buscarPorId_(tarjetas, 'ID_Tarjeta', x.idTarjeta);
    if (!regalo || !tarjeta) return;
    const plan = texto_(regalo.ID_Bolsillo_Plan);
    let movido = 0;
    movs.forEach(m => {
      if (m.ID_Bolsillo !== tarjeta.ID_Bolsillo_Reserva || (Number(m.Valor) || 0) <= 0 || m.Fecha < x.desde) return;
      if (plan) { const par = (porGrupo[m.ID_Grupo] || []).find(o => o.ID_Mov !== m.ID_Mov); if (!par || par.ID_Bolsillo !== plan) return; }
      const libre = (Number(m.Valor) || 0) - (consumido[m.ID_Mov] || 0);
      const toma = Math.max(0, Math.min(libre, x.total - movido));
      if (toma > 0) { consumido[m.ID_Mov] = (consumido[m.ID_Mov] || 0) + toma; movido += toma; }
    });
    const falta = redondear2_(x.total - movido);
    if (falta < 1) return;
    salida.push({
      ID_Regalo: x.idRegalo, Persona: nombre(personas, 'ID_Persona', regalo.ID_Persona), Idea: regalo.Idea || '', Anio: Number(regalo.Anio),
      ID_Tarjeta: x.idTarjeta, Tarjeta: tarjeta.Nombre, ID_Bolsillo_Reserva: tarjeta.ID_Bolsillo_Reserva, Reserva: nombre(bolsillos, 'ID_Bolsillo', tarjeta.ID_Bolsillo_Reserva),
      ID_Bolsillo_Plan: plan, BolsilloPlan: plan ? nombre(bolsillos, 'ID_Bolsillo', plan) : '', total: x.total, falta: falta
    });
  });
  return salida;
}

/** Pantalla de los regalos de un año, en una sola llamada. */
function obtenerRegalos(anio) {
  const a = anioValido_(anio || cfgValor_('Anio_Activo') || new Date().getFullYear());
  const personas = getTableData('Personas');
  const bolsillos = getTableData('Bolsillos');
  const real = realPorRegalo_();
  const todos = getTableData('Regalos');
  const pendientes = regalosPendientesReserva_();

  const items = todos.filter(r => Number(r.Anio) === a).map(r => {
    const p = buscarPorId_(personas, 'ID_Persona', r.ID_Persona);
    const gastado = real[r.ID_Regalo] || 0;
    const aplica = r.Aplica === '' || r.Aplica === undefined ? true : esVerdadero(r.Aplica);
    const est = Number(r.Estimado) || 0;
    return {
      ID_Regalo: r.ID_Regalo, ID_Persona: r.ID_Persona, Persona: p ? p.Nombre : '', Idea: r.Idea || '', Notas: r.Notas || '',
      Estimado: est, Real: gastado, Diferencia: redondear2_(est - gastado), Aplica: aplica, Comprado: gastado > 0,
      ID_Bolsillo_Plan: r.ID_Bolsillo_Plan || '', BolsilloPlan: r.ID_Bolsillo_Plan ? ((buscarPorId_(bolsillos, 'ID_Bolsillo', r.ID_Bolsillo_Plan) || {}).Nombre || '') : '',
      PendienteReserva: pendientes.filter(x => x.ID_Regalo === r.ID_Regalo)
    };
  }).sort((x, y) => x.Persona.localeCompare(y.Persona));

  const aplican = items.filter(i => i.Aplica);
  const suma = f => redondear2_(aplican.reduce((acc, i) => acc + f(i), 0));
  const anios = {}; todos.forEach(r => { anios[Number(r.Anio)] = true; }); anios[a] = true;
  return {
    anio: a, items: items, pendientes: pendientes, anios: Object.keys(anios).map(Number).sort((x, y) => y - x),
    totales: { estimado: suma(i => i.Estimado), real: suma(i => i.Real), diferencia: suma(i => i.Diferencia), comprados: aplican.filter(i => i.Comprado).length, total: aplican.length }
  };
}

/** Crea o edita un regalo. */
function guardarRegalo(r) {
  if (!r || typeof r !== 'object') throw new Error('Faltan los datos del regalo.');
  const filas = leer_('Regalos');
  const actual = r.ID_Regalo ? buscarPorId_(filas, 'ID_Regalo', r.ID_Regalo) : null;
  if (r.ID_Regalo && !actual) throw new Error('El regalo no existe.');

  const idPersona = r.ID_Persona !== undefined ? r.ID_Persona : actual && actual.ID_Persona;
  exigirActivo_(leer_('Personas'), 'ID_Persona', idPersona, 'La persona');
  const anio = anioValido_(r.Anio !== undefined ? r.Anio : actual && actual.Anio);
  const datos = {
    Anio: anio, ID_Persona: idPersona,
    Idea: texto_(r.Idea !== undefined ? r.Idea : actual && actual.Idea).slice(0, 120),
    Estimado: numero_(r.Estimado !== undefined ? r.Estimado : actual && actual.Estimado, 'El estimado', { requerido: true, min: 0, max: VALOR_MAXIMO }),
    Aplica: r.Aplica !== undefined ? esVerdadero(r.Aplica) : (actual ? esVerdadero(actual.Aplica) || actual.Aplica === '' : true),
    Notas: texto_(r.Notas !== undefined ? r.Notas : actual && actual.Notas).slice(0, 300),
    ID_Bolsillo_Plan: texto_(r.ID_Bolsillo_Plan !== undefined ? r.ID_Bolsillo_Plan : actual && actual.ID_Bolsillo_Plan)
  };
  // El bolsillo del que se planea pagar el regalo (opcional)
  if (datos.ID_Bolsillo_Plan) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', datos.ID_Bolsillo_Plan, 'El bolsillo del regalo'); exigirPesos_(datos.ID_Bolsillo_Plan, 'El bolsillo del regalo'); }
  if (actual) { updateRow('Regalos', actual._rowIndex, datos); return Object.assign({}, actual, datos); }
  const nuevo = Object.assign({ ID_Regalo: nuevoId_('reg'), Real: '', ID_Mov: '' }, datos);
  insertRow('Regalos', nuevo);
  return nuevo;
}

/** Quita un regalo. Solo si no tiene gastos registrados. */
function eliminarRegalo(idRegalo) {
  const fila = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!fila) throw new Error('El regalo no existe.');
  if ((realPorRegalo_()[idRegalo] || 0) > 0) throw new Error('Este regalo ya tiene gastos registrados. Anúlalos primero.');
  deleteRow('Regalos', fila._rowIndex);
  return { anio: Number(fila.Anio) };
}

/**
 * Registra lo que costó un regalo: un gasto en el bolsillo elegido, marcado con el regalo. Con "T:<id de tarjeta>" en lugar
 * del bolsillo es una compra con esa tarjeta: no mueve dinero, pero Moni avisa que hay que pasarlo a la reserva de la tarjeta
 * (ver `regalosPendientesReserva_`) hasta que se registre ese traslado.
 */
function registrarGastoRegalo(idRegalo, valor, idBolsillo, fecha) {
  const regalo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!regalo) throw new Error('El regalo no existe.');
  const p = buscarPorId_(leer_('Personas'), 'ID_Persona', regalo.ID_Persona);
  const cat = leer_('Categorias').find(c => c.ID_Categoria === 'cat-regalos' && estaActivo(c));
  if (texto_(idBolsillo).indexOf('T:') === 0) {
    const compra = registrarCompraTC({
      ID_Tarjeta: texto_(idBolsillo).slice(2), Fecha: fecha, Valor: valor, Fuente: 'Personal', ID_Categoria: cat ? cat.ID_Categoria : '',
      Concepto: 'Regalo: ' + (p ? p.Nombre : '') + (regalo.Idea ? ' · ' + regalo.Idea : ''), Notas: MARCA_REGALO + idRegalo
    });
    return { idMov: '', idCompra: compra.ID_Compra, idTarjeta: compra.ID_Tarjeta, anio: Number(regalo.Anio) };
  }
  exigirPesos_(idBolsillo, 'El bolsillo del regalo');
  const mov = registrarMovimiento({
    Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: cat ? cat.ID_Categoria : '',
    Concepto: 'Regalo: ' + (p ? p.Nombre : '') + (regalo.Idea ? ' · ' + regalo.Idea : ''), Notas: MARCA_REGALO + idRegalo
  });
  return { idMov: mov.ID_Mov, anio: Number(regalo.Anio) };
}
