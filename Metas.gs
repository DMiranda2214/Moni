/**
 * Metas.gs — Moni
 * Metas de ahorro (Navidad, un viaje, la moto…): cuánto, para cuándo, en qué bolsillo, y un plan por mes que se puede
 * editar, porque no todos los meses se ahorra lo mismo (diciembre en 0, junio con la prima el doble…).
 *
 *   Ahorrado = Ahorro_Inicial + lo real de los renglones del presupuesto de la meta (Presupuesto_Mes.ID_Meta)
 *              + los aportes directos (traslados con Ref "Meta <ID>" que no están en un renglón).
 *   Usado    = los gastos con Ref "Meta <ID>" (cuando se usa el dinero para lo que era). Se muestra aparte.
 *   Plan     = Plan_Mensual guarda solo los meses que la persona escribió a mano; los demás meses que quedan se reparten
 *              en partes iguales lo que falta (contado al empezar este mes, así el plan del mes no cambia al aportar).
 *
 * Cada meta activa con plan en un mes aparece en el presupuesto de ese mes como un renglón de tipo Fondo hacia su
 * bolsillo, igual que las suscripciones (agregarMetasAlMes: se puede repetir sin duplicar).
 */

const MARCA_META = 'Meta ';
const MAX_MESES_META = 240;

/** El plan escrito a mano: { "AAAA-MM": valor }. */
function planGuardado_(meta) {
  try {
    const o = JSON.parse(texto_(meta && meta.Plan_Mensual) || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}

/** Mes en que empieza la meta (AAAA-MM). */
function mesInicioMeta_(meta) {
  return (texto_(meta.Fecha_Inicio) || texto_(meta.Creado_En) || hoyIso_()).slice(0, 7);
}

/** Meses de la meta, del primero al de la fecha final. */
function mesesMeta_(meta) {
  const ini = mesInicioMeta_(meta), fin = texto_(meta.Fecha_Fin).slice(0, 7);
  const lista = [];
  if (!fin) return lista;
  for (let m = ini; m <= fin && lista.length < MAX_MESES_META; m = mesMas_(m, 1)) lista.push(m);
  return lista;
}

/**
 * Lo aportado y lo usado de cada meta, por mes.
 * @returns {Object} { ID_Meta: { porMes: { 'AAAA-MM': valor }, aportado, usado, movimientos: [] } }
 */
function aportesMetas_() {
  return memoDerivado_('metas|aportes', () => {
    const r = {};
    const de = id => r[id] || (r[id] = { porMes: {}, aportado: 0, usado: 0, movimientos: [] });
    const items = getTableData('Presupuesto_Mes').filter(i => texto_(i.ID_Meta));
    if (items.length) {
      const real = realPorRenglon_();
      items.forEach(i => {
        const v = real[i.ID_Item] || 0;
        if (!v) return;
        const x = de(i.ID_Meta);
        x.porMes[i.Mes] = redondear2_((x.porMes[i.Mes] || 0) + v);
        x.aportado = redondear2_(x.aportado + v);
      });
    }
    const renglonDeMeta = {};
    items.forEach(i => { renglonDeMeta[i.ID_Item] = i.ID_Meta; });
    getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
      const ref = refDe_(m);
      let id = ref.indexOf(MARCA_META) === 0 ? ref.slice(MARCA_META.length) : '';
      if (!id && m.ID_Item_Ppto && renglonDeMeta[m.ID_Item_Ppto]) id = renglonDeMeta[m.ID_Item_Ppto];
      if (!id) return;
      const v = Number(m.Valor) || 0;
      const x = de(id);
      if (m.Tipo_Mov === 'Transferencia' && v > 0) {
        // Un aporte enlazado a un renglón de la meta ya cuenta por el renglón
        if (!(m.ID_Item_Ppto && renglonDeMeta[m.ID_Item_Ppto])) {
          const mes = texto_(m.Fecha).slice(0, 7);
          x.porMes[mes] = redondear2_((x.porMes[mes] || 0) + v);
          x.aportado = redondear2_(x.aportado + v);
        }
        x.movimientos.push({ ID_Mov: m.ID_Mov, Fecha: m.Fecha, Concepto: m.Concepto, Valor: v, tipo: 'Aporte', Creado_En: marcaRegistro_(m.Creado_En), _rowIndex: m._rowIndex });
      } else if (m.Tipo_Mov === 'Gasto' && ref.indexOf(MARCA_META) === 0) {
        x.usado = redondear2_(x.usado - v);
        x.movimientos.push({ ID_Mov: m.ID_Mov, Fecha: m.Fecha, Concepto: m.Concepto, Valor: v, tipo: 'Uso', Creado_En: marcaRegistro_(m.Creado_En), _rowIndex: m._rowIndex });
      }
    });
    Object.keys(r).forEach(id => { r[id].movimientos.sort(masRecienteArriba_); r[id].movimientos.forEach(x => { delete x._rowIndex; }); });
    return r;
  });
}

/** Redondea un aporte sugerido hacia arriba a la centena (para que el plan alcance). */
function redondearAporte_(v) { return v > 0 ? Math.ceil(v / 100) * 100 : 0; }

/**
 * Todo lo de una meta: avance, plan por mes, estado y proyección.
 * @param {Object} meta fila de Metas
 * @param {Object} ap   aportes de esa meta (de aportesMetas_)
 * @param {string} mesHoy AAAA-MM
 * @param {Object} [planesRenglon] { 'AAAA-MM': plan del renglón de la meta } (para los meses pasados)
 */
function resumenMeta_(meta, ap, mesHoy, planesRenglon) {
  const a = ap || { porMes: {}, aportado: 0, usado: 0, movimientos: [] };
  const objetivo = Number(meta.Monto_Objetivo) || 0;
  const inicial = Number(meta.Ahorro_Inicial) || 0;
  const meses = mesesMeta_(meta);
  const manual = planGuardado_(meta);
  const tieneManual = k => Object.prototype.hasOwnProperty.call(manual, k) && manual[k] !== '' && manual[k] !== null && isFinite(Number(manual[k]));
  const ahorrado = redondear2_(inicial + a.aportado);
  const falta = Math.max(0, redondear2_(objetivo - ahorrado));

  // Lo que faltaba al empezar este mes (los aportes de este mes no cambian el plan de este mes)
  const antesDeHoy = Object.keys(a.porMes).filter(m => m < mesHoy).reduce((s, m) => s + a.porMes[m], 0);
  const faltaAlEmpezar = Math.max(0, redondear2_(objetivo - inicial - antesDeHoy));
  const futuros = meses.filter(m => m >= mesHoy), pasados = meses.filter(m => m < mesHoy);
  const manualFuturo = futuros.filter(tieneManual).reduce((s, m) => s + Number(manual[m]), 0);
  const libres = futuros.filter(m => !tieneManual(m));
  const sugerido = libres.length ? redondearAporte_(Math.max(0, faltaAlEmpezar - manualFuturo) / libres.length) : 0;
  const igualOriginal = meses.length ? redondearAporte_(Math.max(0, objetivo - inicial) / meses.length) : 0;
  const pr = planesRenglon || {};

  const plan = meses.map(m => {
    let valor;
    if (tieneManual(m)) valor = Number(manual[m]);
    else if (m >= mesHoy) valor = sugerido;
    else valor = pr[m] !== undefined ? pr[m] : igualOriginal;
    return { mes: m, plan: redondear2_(valor), aportado: a.porMes[m] || 0, manual: tieneManual(m), pasado: m < mesHoy };
  });
  // Lo que se aportó antes del primer mes o después del último también cuenta (fuera del calendario)
  let acPlan = inicial, acReal = inicial;
  const acumulado = plan.map(p => { acPlan += p.plan; acReal += p.pasado || p.mes === mesHoy ? p.aportado : 0; return { mes: p.mes, plan: redondear2_(acPlan), real: p.pasado || p.mes === mesHoy ? redondear2_(acReal) : null }; });

  const planPasado = pasados.reduce((s, m) => s + (plan.find(p => p.mes === m) || {}).plan, 0);
  const aportadoPasado = pasados.reduce((s, m) => s + (a.porMes[m] || 0), 0);
  const fin = texto_(meta.Fecha_Fin);
  const hoy = hoyIso_();
  const estadoUsuario = meta.Estado || 'Activa';
  let estado;
  if (objetivo > 0 && ahorrado >= objetivo - 0.005) estado = 'lograda';
  else if (estadoUsuario === 'Cumplida') estado = 'cumplida';
  else if (estadoUsuario === 'Pausada') estado = 'pausada';
  else if (fin && fin < hoy) estado = 'vencida';
  else if (planPasado - aportadoPasado > Math.max(1000, planPasado * 0.05)) estado = 'atrasada';
  else estado = 'al_dia';
  // Si todo el plan que queda es a mano y no alcanza, cuánto falta por cubrir
  const sinCubrir = libres.length ? 0 : Math.max(0, redondear2_(faltaAlEmpezar - manualFuturo));
  const bol = meta.ID_Bolsillo ? buscarPorId_(getTableData('Bolsillos'), 'ID_Bolsillo', meta.ID_Bolsillo) : null;

  return {
    ID_Meta: meta.ID_Meta, Nombre: meta.Nombre, Motivo: meta.Motivo || 'Otro', Monto_Objetivo: objetivo, Ahorro_Inicial: inicial,
    Fecha_Inicio: texto_(meta.Fecha_Inicio), Fecha_Fin: fin, ID_Bolsillo: meta.ID_Bolsillo || '', Bolsillo: bol ? bol.Nombre : '',
    Estado: estadoUsuario, Notas: meta.Notas || '', Activo: estaActivo(meta),
    ahorrado: ahorrado, aportado: a.aportado, usado: a.usado, falta: falta,
    avance: objetivo > 0 ? Math.min(1, Math.round(ahorrado / objetivo * 1000) / 1000) : 0,
    planMes: (plan.find(p => p.mes === mesHoy) || {}).plan || 0,
    aportadoMes: a.porMes[mesHoy] || 0,
    sugerido: sugerido, porMesParaLlegar: futuros.length ? redondearAporte_(faltaAlEmpezar / futuros.length) : 0,
    mesesRestantes: futuros.length, estado: estado, sinCubrir: sinCubrir,
    plan: plan, acumulado: acumulado, movimientos: a.movimientos.slice(0, 50)
  };
}

/** Plan de los renglones que ya se crearon en el presupuesto para cada meta: { ID_Meta: { mes: plan } }. */
function planesDeRenglones_() {
  const r = {};
  getTableData('Presupuesto_Mes').filter(i => texto_(i.ID_Meta)).forEach(i => {
    (r[i.ID_Meta] = r[i.ID_Meta] || {})[i.Mes] = (r[i.ID_Meta][i.Mes] || 0) + (Number(i.Plan) || 0);
  });
  return r;
}

function resumenesMetas_() {
  return memoDerivado_('metas|resumen', () => {
    const ap = aportesMetas_(), pr = planesDeRenglones_(), mesHoy = hoyIso_().slice(0, 7);
    return getTableData('Metas').map(m => resumenMeta_(m, ap[m.ID_Meta], mesHoy, pr[m.ID_Meta]));
  });
}

/** Pantalla de Metas: todas las metas y los totales de las activas. */
function obtenerMetas() {
  const todas = resumenesMetas_();
  const orden = { atrasada: 0, vencida: 1, al_dia: 2, pausada: 3, lograda: 4, cumplida: 5 };
  const activas = todas.filter(m => m.Activo).sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.Fecha_Fin < b.Fecha_Fin ? -1 : 1));
  const enCurso = activas.filter(m => m.Estado === 'Activa');
  const suma = f => redondear2_(enCurso.reduce((s, m) => s + f(m), 0));
  return {
    items: activas,
    archivadas: todas.filter(m => !m.Activo).map(m => ({ ID_Meta: m.ID_Meta, Nombre: m.Nombre, Monto_Objetivo: m.Monto_Objetivo, ahorrado: m.ahorrado })),
    totales: { objetivo: suma(m => m.Monto_Objetivo), ahorrado: suma(m => m.ahorrado), falta: suma(m => m.falta), planMes: suma(m => m.planMes), aportadoMes: suma(m => m.aportadoMes), cantidad: enCurso.length },
    mes: hoyIso_().slice(0, 7)
  };
}

function metaExistente_(id) {
  const m = buscarPorId_(leer_('Metas'), 'ID_Meta', id);
  if (!m) throw new Error('La meta no existe.');
  return m;
}

/** Valida un plan { 'AAAA-MM': valor } contra los meses de la meta. Un valor vacío quita ese mes (vuelve al reparto automático). */
function normalizarPlanMeta_(plan, meta) {
  const meses = {};
  mesesMeta_(meta).forEach(m => { meses[m] = true; });
  const salida = {};
  Object.keys(plan || {}).forEach(k => {
    const v = plan[k];
    if (v === '' || v === null || v === undefined) return;
    if (!meses[k]) return; // un mes fuera de las fechas de la meta se ignora
    salida[k] = numero_(v, 'El aporte de ' + k, { min: 0, max: VALOR_MAXIMO });
  });
  return Object.keys(salida).length ? JSON.stringify(salida) : '';
}

/** Guarda el plan por mes escrito a mano y pone al día los renglones de la meta en los presupuestos de este mes en adelante. */
function guardarPlanMeta(idMeta, plan) {
  const meta = metaExistente_(idMeta);
  const texto = normalizarPlanMeta_(plan, meta);
  updateRow('Metas', meta, { Plan_Mensual: texto });
  actualizarRenglonesDeMetas_();
  return Object.assign({}, meta, { Plan_Mensual: texto });
}

/** Pone al día los renglones de metas de los presupuestos desde este mes. */
function actualizarRenglonesDeMetas_() {
  const mesHoy = hoyIso_().slice(0, 7);
  const meses = {};
  leer_('Presupuesto_Mes').forEach(i => { if (i.Mes >= mesHoy) meses[i.Mes] = true; });
  Object.keys(meses).sort().forEach(m => { try { agregarMetasAlMes(m); } catch (e) { /* un mes con un problema no frena a los demás */ } });
}

/** Metas activas con plan en el mes `m` (y bolsillo, que es a donde va el dinero). */
function metasDelMes_(m) {
  return resumenesMetas_().filter(r => r.Activo && r.Estado === 'Activa' && r.ID_Bolsillo && r.estado !== 'lograda' &&
    r.plan.some(p => p.mes === m && p.plan > 0));
}

/** Metas de ese mes que todavía no tienen su renglón en el presupuesto. */
function metasFaltantes_(m, items) {
  return metasDelMes_(m).filter(r => !items.some(i => i.ID_Meta === r.ID_Meta));
}

/**
 * Agrega al presupuesto de un mes (que ya debe existir) un renglón de tipo Fondo por cada meta con plan ese mes, y pone al
 * día el plan y el bolsillo de los renglones de metas que todavía no están completos. Se puede repetir sin duplicar nada.
 */
function agregarMetasAlMes(mes) {
  const m = mesValido_(mes);
  const items = leer_('Presupuesto_Mes').filter(i => i.Mes === m);
  if (!items.length) return { agregados: 0, actualizados: 0 };
  const usados = {};
  items.forEach(i => { usados[texto_(i.Concepto).toLowerCase()] = true; });
  const nuevos = [], cambios = [];
  metasDelMes_(m).forEach(r => {
    const plan = (r.plan.find(p => p.mes === m) || {}).plan || 0;
    const existente = items.find(i => i.ID_Meta === r.ID_Meta);
    if (existente) {
      if (esVerdadero(existente.Pagado)) return;
      const c = {};
      if (Number(existente.Plan) !== plan) c.Plan = plan;
      if ((existente.ID_Bolsillo_Destino || '') !== r.ID_Bolsillo) c.ID_Bolsillo_Destino = r.ID_Bolsillo;
      if (Object.keys(c).length) cambios.push({ fila: existente, cambios: c });
      return;
    }
    let concepto = 'Meta: ' + r.Nombre;
    if (usados[concepto.toLowerCase()]) concepto = concepto + ' (' + r.ID_Meta.slice(-4) + ')';
    usados[concepto.toLowerCase()] = true;
    nuevos.push({
      ID_Item: nuevoId_('itm'), Mes: m, ID_Escenario: items[0].ID_Escenario, ID_Plantilla: '', Concepto: concepto.slice(0, 120),
      Tipo: 'Fondo', Plan: plan, Pagado: false, ID_Bolsillo_Destino: r.ID_Bolsillo, ID_Credito: '', ID_Tarjeta: '', Notas: '',
      ID_Suscripcion: '', ID_Meta: r.ID_Meta
    });
  });
  // Un renglón de una meta que ya no tiene plan ese mes (o se pausó) y no tiene movimientos queda en 0 para no inflar el plan
  items.filter(i => texto_(i.ID_Meta) && !esVerdadero(i.Pagado) && !metasDelMes_(m).some(r => r.ID_Meta === i.ID_Meta) && Number(i.Plan) !== 0)
    .forEach(i => cambios.push({ fila: i, cambios: { Plan: 0 } }));
  if (nuevos.length) insertRows('Presupuesto_Mes', nuevos);
  if (cambios.length) updateRows_('Presupuesto_Mes', cambios);
  return { agregados: nuevos.length, actualizados: cambios.length };
}

/**
 * Aportar a una meta ahora: un traslado del bolsillo de origen al de la meta. Si el presupuesto del mes tiene el renglón
 * de la meta, el aporte cuenta como lo real de ese renglón.
 */
function aportarMeta(idMeta, idOrigen, valor, fecha) {
  const meta = metaExistente_(idMeta);
  if (!estaActivo(meta)) throw new Error('La meta está archivada.');
  if (!meta.ID_Bolsillo) throw new Error('Esta meta no tiene bolsillo. Edítala y elige dónde guardas el dinero.');
  const f = fechaMovimiento_(fecha);
  const renglon = leer_('Presupuesto_Mes').find(i => i.ID_Meta === idMeta && i.Mes === f.slice(0, 7));
  return registrarTransferencia(idOrigen, meta.ID_Bolsillo, valor, f, 'Aporte a la meta ' + meta.Nombre, MARCA_META + idMeta, 'App',
    { Subtipo: 'Aporte_Meta', ID_Item_Ppto: renglon ? renglon.ID_Item : '' });
}

/** Usar el dinero de la meta (comprar lo que era): un gasto desde el bolsillo de la meta, enlazado a ella. */
function usarMeta(idMeta, valor, fecha, concepto, idCategoria) {
  const meta = metaExistente_(idMeta);
  if (!meta.ID_Bolsillo) throw new Error('Esta meta no tiene bolsillo.');
  return registrarMovimiento({
    Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: meta.ID_Bolsillo, ID_Categoria: idCategoria || '',
    Concepto: texto_(concepto) || meta.Nombre, Notas: MARCA_META + idMeta
  });
}

/** Detalle de una meta. */
function obtenerMeta(idMeta) {
  const r = resumenesMetas_().find(m => m.ID_Meta === idMeta);
  if (!r) throw new Error('La meta no existe.');
  return r;
}
