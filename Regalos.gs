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
    const n = refDe_(m);
    if (n.indexOf(MARCA_REGALO) !== 0 || m.Tipo_Mov !== 'Gasto') return;
    const id = n.slice(MARCA_REGALO.length);
    real[id] = redondear2_((real[id] || 0) + (-(Number(m.Valor) || 0)));
  });
  // Las compras con tarjeta también cuentan como lo gastado en el regalo
  getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado)).forEach(c => {
    const n = refDe_(c);
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
  const compras = getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado) && !esVerdadero(c.Pagado) && refDe_(c).indexOf(MARCA_REGALO) === 0);
  if (!compras.length) return [];
  const movs = getTableData('Movimientos', { excludeAnulados: true }).filter(m => m.Tipo_Mov === 'Transferencia' && !m.Subtipo && m.ID_Grupo && afectaSaldos_(m));
  const porGrupo = {};
  movs.forEach(m => { (porGrupo[m.ID_Grupo] = porGrupo[m.ID_Grupo] || []).push(m); });
  const nombre = (lista, col, id, campo) => { const f = buscarPorId_(lista, col, id); return f ? f[campo || 'Nombre'] : ''; };

  // Un regalo por tarjeta con lo que falta mover
  const porRegalo = {};
  compras.forEach(c => {
    const idRegalo = refDe_(c).slice(MARCA_REGALO.length);
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
      ID_Regalo: x.idRegalo, ParaMi: esParaMi_(regalo), Persona: esParaMi_(regalo) ? 'Para mí' : nombre(personas, 'ID_Persona', regalo.ID_Persona), Idea: regalo.Idea || '', Anio: Number(regalo.Anio),
      ID_Tarjeta: x.idTarjeta, Tarjeta: tarjeta.Nombre, ID_Bolsillo_Reserva: tarjeta.ID_Bolsillo_Reserva, Reserva: nombre(bolsillos, 'ID_Bolsillo', tarjeta.ID_Bolsillo_Reserva),
      ID_Bolsillo_Plan: plan, BolsilloPlan: plan ? nombre(bolsillos, 'ID_Bolsillo', plan) : '', total: x.total, falta: falta
    });
  });
  return salida;
}

/** Nombre de la categoría de un deseo. */
const CATEGORIAS_DESEO = { Regalo: 'Regalo', Cuidado_Personal: 'Cuidado personal', Ropa: 'Ropa y accesorios', Tecnologia: 'Tecnología', Hogar: 'Hogar', Experiencia: 'Experiencia', Otro: 'Otro' };

/** ¿Es un deseo para la persona misma? (sin persona elegida, o marcado "Yo") */
function esParaMi_(r) { return texto_(r.Para) === 'Yo' || !texto_(r.ID_Persona); }

/**
 * Pantalla de la Lista de deseos (antes "Regalos") de un año, en una sola llamada. Los regalos de antes se ven igual:
 * misma persona, idea, estimado y lo gastado (que sigue saliendo de los gastos y compras enlazados).
 */
function obtenerRegalos(anio) {
  const a = anioValido_(anio || cfgValor_('Anio_Activo') || new Date().getFullYear());
  const personas = getTableData('Personas');
  const bolsillos = getTableData('Bolsillos');
  const real = realPorRegalo_();
  const todos = getTableData('Regalos');
  const pendientes = regalosPendientesReserva_();
  const ideas = getTableData('Deseos_Ideas');

  const items = todos.filter(r => Number(r.Anio) === a).map(r => {
    const paraMi = esParaMi_(r);
    const p = paraMi ? null : buscarPorId_(personas, 'ID_Persona', r.ID_Persona);
    const registrado = real[r.ID_Regalo] || 0;
    const manual = Number(r.Precio_Pagado) || 0;
    const gastado = registrado || manual;
    const aplica = r.Aplica === '' || r.Aplica === undefined ? true : esVerdadero(r.Aplica);
    const est = Number(r.Estimado) || 0;
    const comprado = gastado > 0 || r.Estado === 'Comprado';
    const categoria = r.Categoria || 'Regalo';
    return {
      ID_Regalo: r.ID_Regalo, ID_Persona: paraMi ? '' : r.ID_Persona, Persona: paraMi ? 'Para mí' : (p ? p.Nombre : ''), ParaMi: paraMi,
      Idea: r.Idea || '', Notas: r.Notas || '', Categoria: categoria, CategoriaNombre: CATEGORIAS_DESEO[categoria] || categoria,
      Ocasion: r.Ocasion || '', Prioridad: r.Prioridad || '', Enlace: r.Enlace || '', Fecha_Objetivo: texto_(r.Fecha_Objetivo),
      Estado: r.Estado || (comprado ? 'Comprado' : 'Idea'), Precio_Pagado: manual, Registrado: registrado,
      Estimado: est, Real: gastado, Diferencia: redondear2_(est - gastado), Aplica: aplica && r.Estado !== 'Descartado', Comprado: comprado,
      ID_Bolsillo_Plan: r.ID_Bolsillo_Plan || '', BolsilloPlan: r.ID_Bolsillo_Plan ? ((buscarPorId_(bolsillos, 'ID_Bolsillo', r.ID_Bolsillo_Plan) || {}).Nombre || '') : '',
      PendienteReserva: pendientes.filter(x => x.ID_Regalo === r.ID_Regalo),
      ideas: ideas.filter(x => x.ID_Regalo === r.ID_Regalo).sort((x, y) => (Number(x.Orden) || 0) - (Number(y.Orden) || 0))
        .map(x => ({ ID_Idea: x.ID_Idea, Texto: x.Texto, Precio: Number(x.Precio) || 0, Enlace: x.Enlace || '', Elegida: esVerdadero(x.Elegida) }))
    };
  }).sort((x, y) => (x.ParaMi === y.ParaMi ? 0 : x.ParaMi ? -1 : 1) || x.Persona.localeCompare(y.Persona));

  const aplican = items.filter(i => i.Aplica);
  const suma = f => redondear2_(aplican.reduce((acc, i) => acc + f(i), 0));
  const agrupar = clave => {
    const g = {};
    aplican.forEach(i => { const k = i[clave] || '—'; const x = g[k] || (g[k] = { nombre: k, estimado: 0, real: 0, cantidad: 0 }); x.estimado += i.Estimado; x.real += i.Real; x.cantidad++; });
    return Object.keys(g).map(k => ({ nombre: g[k].nombre, estimado: redondear2_(g[k].estimado), real: redondear2_(g[k].real), cantidad: g[k].cantidad })).sort((x, y) => y.estimado - x.estimado);
  };
  const anios = {}; todos.forEach(r => { anios[Number(r.Anio)] = true; }); anios[a] = true;
  return {
    anio: a, items: items, pendientes: pendientes, anios: Object.keys(anios).map(Number).sort((x, y) => y - x),
    porPersona: agrupar('Persona'), porCategoria: agrupar('CategoriaNombre'),
    totales: { estimado: suma(i => i.Estimado), real: suma(i => i.Real), diferencia: suma(i => i.Diferencia), comprados: aplican.filter(i => i.Comprado).length, total: aplican.length,
      paraMi: suma(i => i.ParaMi ? i.Estimado : 0), paraOtros: suma(i => i.ParaMi ? 0 : i.Estimado) }
  };
}

/** Crea o edita un deseo (o un regalo). Sin persona, es para la persona misma. */
function guardarRegalo(r) {
  if (!r || typeof r !== 'object') throw new Error('Faltan los datos del deseo.');
  const filas = leer_('Regalos');
  const actual = r.ID_Regalo ? buscarPorId_(filas, 'ID_Regalo', r.ID_Regalo) : null;
  if (r.ID_Regalo && !actual) throw new Error('El deseo no existe.');
  const pick = k => r[k] !== undefined ? r[k] : actual && actual[k];

  let idPersona = texto_(pick('ID_Persona'));
  let para = texto_(pick('Para'));
  if (r.Para === 'Yo' || (!idPersona && r.ID_Persona !== undefined)) { para = 'Yo'; idPersona = ''; }
  if (idPersona) { exigirActivo_(leer_('Personas'), 'ID_Persona', idPersona, 'La persona'); para = ''; }
  else para = 'Yo';
  const anio = anioValido_(pick('Anio'));
  const datos = {
    Anio: anio, ID_Persona: idPersona, Para: para,
    Idea: texto_(pick('Idea')).slice(0, 120),
    Estimado: numero_(pick('Estimado'), 'Cuánto quieres gastar', { requerido: true, min: 0, max: VALOR_MAXIMO }),
    Aplica: r.Aplica !== undefined ? esVerdadero(r.Aplica) : (actual ? esVerdadero(actual.Aplica) || actual.Aplica === '' : true),
    Notas: texto_(pick('Notas')).slice(0, 300),
    ID_Bolsillo_Plan: texto_(pick('ID_Bolsillo_Plan')),
    Categoria: opcion_(pick('Categoria'), ENUMS.Regalos.Categoria, 'La categoría', idPersona ? 'Regalo' : 'Otro'),
    Ocasion: texto_(pick('Ocasion')).slice(0, 60),
    Prioridad: opcion_(pick('Prioridad') || '', ENUMS.Regalos.Prioridad, 'La prioridad', ''),
    Estado: opcion_(pick('Estado') || '', ENUMS.Regalos.Estado, 'El estado', ''),
    Enlace: urlSegura_(pick('Enlace')).slice(0, 500),
    Fecha_Objetivo: fechaIso_(pick('Fecha_Objetivo'), 'La fecha') || '',
    Precio_Pagado: pick('Precio_Pagado') === '' || pick('Precio_Pagado') === undefined || pick('Precio_Pagado') === null ? '' : numero_(pick('Precio_Pagado'), 'Lo que pagaste', { min: 0, max: VALOR_MAXIMO })
  };
  // El bolsillo del que se planea pagar (opcional)
  if (datos.ID_Bolsillo_Plan) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', datos.ID_Bolsillo_Plan, 'El bolsillo'); exigirPesos_(datos.ID_Bolsillo_Plan, 'El bolsillo'); }
  if (actual) { updateRow('Regalos', actual, datos); return Object.assign({}, actual, datos); }
  const nuevo = Object.assign({ ID_Regalo: nuevoId_('reg'), Real: '', ID_Mov: '' }, datos);
  insertRow('Regalos', nuevo);
  return nuevo;
}

/** Quita un deseo (y su lluvia de ideas). Solo si no tiene gastos registrados. */
function eliminarRegalo(idRegalo) {
  const fila = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!fila) throw new Error('El deseo no existe.');
  if ((realPorRegalo_()[idRegalo] || 0) > 0) throw new Error('Este deseo ya tiene gastos registrados. Anúlalos primero.');
  const ideas = leer_('Deseos_Ideas').filter(x => x.ID_Regalo === idRegalo).map(x => x._rowIndex);
  if (ideas.length) deleteRows('Deseos_Ideas', ideas);
  deleteRow('Regalos', leer_('Regalos').find(x => x.ID_Regalo === idRegalo)._rowIndex);
  return { anio: Number(fila.Anio) };
}

// ---------- Lluvia de ideas de un deseo ----------

/** Agrega o edita una idea. */
function guardarIdeaDeseo(idea) {
  if (!idea || typeof idea !== 'object') throw new Error('Faltan los datos de la idea.');
  const deseo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idea.ID_Regalo);
  if (!deseo) throw new Error('El deseo no existe.');
  const filas = leer_('Deseos_Ideas');
  const actual = idea.ID_Idea ? buscarPorId_(filas, 'ID_Idea', idea.ID_Idea) : null;
  if (idea.ID_Idea && !actual) throw new Error('La idea no existe.');
  const datos = {
    ID_Regalo: deseo.ID_Regalo,
    Texto: textoRequerido_(idea.Texto !== undefined ? idea.Texto : actual && actual.Texto, 'La idea').slice(0, 160),
    Precio: idea.Precio === '' || idea.Precio === undefined || idea.Precio === null ? (actual ? actual.Precio : '') : numero_(idea.Precio, 'El precio', { min: 0, max: VALOR_MAXIMO }),
    Enlace: urlSegura_(idea.Enlace !== undefined ? idea.Enlace : actual && actual.Enlace).slice(0, 500)
  };
  if (actual) { updateRow('Deseos_Ideas', actual, datos); return { anio: Number(deseo.Anio) }; }
  insertRow('Deseos_Ideas', Object.assign({ ID_Idea: nuevoId_('ida'), Elegida: false, Orden: filas.filter(x => x.ID_Regalo === deseo.ID_Regalo).length + 1 }, datos));
  return { anio: Number(deseo.Anio) };
}

function eliminarIdeaDeseo(idIdea) {
  const fila = buscarPorId_(leer_('Deseos_Ideas'), 'ID_Idea', idIdea);
  if (!fila) throw new Error('La idea no existe.');
  const deseo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', fila.ID_Regalo);
  deleteRow('Deseos_Ideas', fila._rowIndex);
  return { anio: deseo ? Number(deseo.Anio) : '' };
}

/** Elige una idea: pasa a ser la idea del deseo (y su precio, el estimado si todavía no tenía). */
function elegirIdeaDeseo(idIdea) {
  const ideas = leer_('Deseos_Ideas');
  const idea = buscarPorId_(ideas, 'ID_Idea', idIdea);
  if (!idea) throw new Error('La idea no existe.');
  const deseo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idea.ID_Regalo);
  if (!deseo) throw new Error('El deseo no existe.');
  updateRows_('Deseos_Ideas', ideas.filter(x => x.ID_Regalo === idea.ID_Regalo && esVerdadero(x.Elegida) !== (x.ID_Idea === idIdea))
    .map(x => ({ fila: x, cambios: { Elegida: x.ID_Idea === idIdea } })));
  const cambios = { Idea: texto_(idea.Texto).slice(0, 120) };
  if (idea.Enlace) cambios.Enlace = idea.Enlace;
  if (!(Number(deseo.Estimado) > 0) && Number(idea.Precio) > 0) cambios.Estimado = Number(idea.Precio);
  if (!deseo.Estado || deseo.Estado === 'Idea') cambios.Estado = 'Decidido';
  updateRow('Regalos', deseo, cambios);
  return { anio: Number(deseo.Anio) };
}

/**
 * Registra lo que costó un regalo: un gasto en el bolsillo elegido, marcado con el regalo. Con "T:<id de tarjeta>" en lugar
 * del bolsillo es una compra con esa tarjeta: no mueve dinero, pero Moni avisa que hay que pasarlo a la reserva de la tarjeta
 * (ver `regalosPendientesReserva_`) hasta que se registre ese traslado.
 */
function registrarGastoRegalo(idRegalo, valor, idBolsillo, fecha) {
  const regalo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!regalo) throw new Error('El regalo no existe.');
  const p = esParaMi_(regalo) ? null : buscarPorId_(leer_('Personas'), 'ID_Persona', regalo.ID_Persona);
  const cat = !p && regalo.Categoria && regalo.Categoria !== 'Regalo' ? null : categoriaPorRol_('Regalos');
  if (texto_(idBolsillo).indexOf('T:') === 0) {
    const compra = registrarCompraTC({
      ID_Tarjeta: texto_(idBolsillo).slice(2), Fecha: fecha, Valor: valor, Fuente: 'Personal', ID_Categoria: cat ? cat.ID_Categoria : '',
      Concepto: conceptoDeseo_(regalo, p), Notas: MARCA_REGALO + idRegalo
    });
    return { idMov: '', idCompra: compra.ID_Compra, idTarjeta: compra.ID_Tarjeta, anio: Number(regalo.Anio) };
  }
  exigirPesos_(idBolsillo, 'El bolsillo del regalo');
  const mov = registrarMovimiento({
    Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: cat ? cat.ID_Categoria : '',
    Concepto: conceptoDeseo_(regalo, p), Notas: MARCA_REGALO + idRegalo
  });
  return { idMov: mov.ID_Mov, anio: Number(regalo.Anio) };
}

/** Concepto del gasto de un deseo: "Regalo: Mamá · Perfume" o, si es para la persona misma, la idea. */
function conceptoDeseo_(regalo, persona) {
  if (persona) return ('Regalo: ' + persona.Nombre + (regalo.Idea ? ' · ' + regalo.Idea : '')).slice(0, 120);
  return (texto_(regalo.Idea) || CATEGORIAS_DESEO[regalo.Categoria] || 'Compra de la lista de deseos').slice(0, 120);
}
