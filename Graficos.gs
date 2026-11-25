/**
 * Graficos.gs — Moni
 * Datos para la pantalla de Gráficos, calculados desde el libro de movimientos:
 *   - gastos del mes por categoría,
 *   - lo que entró y lo que salió en los últimos N meses,
 *   - el saldo al cierre de cada mes.
 * Todo es de una sola divisa (la que se elige): los pesos y los dólares no se suman.
 * "Entró" y "salió" siguen la misma regla de la pantalla de Movimientos: los traslados no cuentan.
 * Las compras con tarjeta cuentan como gasto el día de la compra; el pago del extracto no cuenta (liquida la deuda).
 */


const ETIQUETA_SUBTIPO_GASTO = { Pago_TC: 'Pago de tarjetas', Pago_Cuota: 'Cuotas de crédito', GMF: 'GMF (4x1000)', Retencion: 'Retención en la fuente' };

/**
 * @param {Object} [o] { mes: 'AAAA-MM' (por defecto, el actual), meses: 3|6|12 (por defecto 6), divisa: 'COP'|'USD'|'EUR' }
 */
function obtenerGraficos(o) {
  const x = o || {};
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(x.mes) ? x.mes : hoyIso_().slice(0, 7);
  const n = [3, 6, 12].indexOf(Number(x.meses)) !== -1 ? Number(x.meses) : 6;
  const divisa = DIVISAS.indexOf(x.divisa) !== -1 ? x.divisa : DIVISA_BASE;

  // Solo los bolsillos de cuentas activas en esa divisa (igual que el total del Inicio)
  const divisas = mapaDivisas_().bolsillos;
  const cuentasActivas = {};
  getTableData('Cuentas').forEach(c => { if (estaActivo(c)) cuentasActivas[c.ID_Cuenta] = true; });
  const propios = getTableData('Bolsillos').filter(b => cuentasActivas[b.ID_Cuenta] && divisas[b.ID_Bolsillo] === divisa);
  const ids = {};
  propios.forEach(b => { ids[b.ID_Bolsillo] = true; });
  const apertura = propios.reduce((a, b) => a + (Number(b.Saldo_Apertura) || 0), 0);

  const lista = mesesHasta_(mes, n);
  const porMes = {};
  lista.forEach(m => { porMes[m] = { mes: m, ingresos: 0, gastos: 0, movido: 0 }; });
  const nombreCategoria = {};
  getTableData('Categorias').forEach(c => { nombreCategoria[c.ID_Categoria] = c.Nombre; });

  let saldoInicial = apertura; // lo que había antes del primer mes del rango
  const categorias = {};
  let hayDatos = false;

  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    if (!ids[m.ID_Bolsillo] || !m.Fecha) return;
    const mm = String(m.Fecha).slice(0, 7);
    const v = Number(m.Valor) || 0;
    const mueve = afectaSaldos_(m); // un movimiento histórico cuenta en entró/salió y categorías, pero no en el saldo
    if (mm < lista[0]) { if (mueve) saldoInicial += v; return; }
    const fila = porMes[mm];
    if (!fila) return; // posterior al mes elegido
    hayDatos = true;
    if (mueve) fila.movido += v; // todo cambia el saldo, también los traslados y las conversiones
    // El pago de un extracto liquida una deuda: el gasto ya se contó el día de cada compra.
    if (!esIngresoOGasto_(m) || m.Subtipo === 'Pago_TC') return;
    if (v >= 0) { fila.ingresos += v; return; }
    fila.gastos += -v;
    if (mm === mes) {
      const nombre = nombreCategoria[m.ID_Categoria] || ETIQUETA_SUBTIPO_GASTO[m.Subtipo] || 'Sin categoría';
      categorias[nombre] = (categorias[nombre] || 0) + (-v);
    }
  });

  // Las compras con tarjeta cuentan el día de la compra (en pesos), con su categoría. Las "De otra persona" se reembolsan.
  if (divisa === DIVISA_BASE) {
    getTableData('Compras_TC').forEach(c => {
      if (esVerdadero(c.Anulado) || c.Fuente === 'Otro' || !c.Fecha) return;
      const mm = String(c.Fecha).slice(0, 7), fila = porMes[mm], v = Number(c.Valor) || 0;
      if (!fila) return;
      hayDatos = true;
      fila.gastos += v;
      if (mm === mes) { const nombre = nombreCategoria[c.ID_Categoria] || 'Sin categoría'; categorias[nombre] = (categorias[nombre] || 0) + v; }
    });
  }

  let saldo = saldoInicial;
  const meses = lista.map(k => {
    const f = porMes[k];
    saldo += f.movido;
    return { mes: k, ingresos: redondear2_(f.ingresos), gastos: redondear2_(f.gastos), neto: redondear2_(f.ingresos - f.gastos), saldo: redondear2_(saldo) };
  });
  const cats = Object.keys(categorias).map(k => ({ Nombre: k, Valor: redondear2_(categorias[k]) })).sort((a, b) => b.Valor - a.Valor);

  return {
    mes: mes, meses: n, divisa: divisa, hayDatos: hayDatos,
    serie: meses, categorias: cats, totalGastos: redondear2_(cats.reduce((a, c) => a + c.Valor, 0))
  };
}

/**
 * Saldo al cierre de cada uno de los últimos `n` meses (hasta `mesFin`) de un conjunto de bolsillos.
 * @param {Object} ids { ID_Bolsillo: true }
 * @param {Array} [movs] movimientos no anulados ya leídos (para no volver a leerlos)
 * @returns {Array} [{ mes: 'AAAA-MM', saldo }]
 */
function saldosMensuales_(ids, mesFin, n, movs) {
  const lista = mesesHasta_(mesFin, n);
  let saldo = getTableData('Bolsillos').filter(b => ids[b.ID_Bolsillo]).reduce((a, b) => a + (Number(b.Saldo_Apertura) || 0), 0);
  const porMes = {};
  (movs || getTableData('Movimientos', { excludeAnulados: true })).forEach(m => {
    if (!ids[m.ID_Bolsillo] || !m.Fecha || !afectaSaldos_(m)) return;
    const mm = String(m.Fecha).slice(0, 7), v = Number(m.Valor) || 0;
    if (mm < lista[0]) saldo += v; // lo anterior al rango forma el saldo de partida
    else if (lista.indexOf(mm) !== -1) porMes[mm] = (porMes[mm] || 0) + v;
  });
  return lista.map(k => { saldo += porMes[k] || 0; return { mes: k, saldo: redondear2_(saldo) }; });
}

// ---------------------------------------------------------------------------
// Análisis: el panorama completo en una sola pantalla (Planear → Análisis)
// ---------------------------------------------------------------------------

/** Último día de un mes AAAA-MM. */
function finDeMes_(mes) { return mes + '-' + dosDigitos_(diasDelMes_(+mes.slice(0, 4), +mes.slice(5, 7))); }

/**
 * Patrimonio neto al cierre de cada uno de los últimos `n` meses (en la moneda principal). Es un estimado reconstruido:
 *   dinero en tus bolsillos + capital de los CDT vigentes ese día − lo comprado con tarjeta y sin pagar − el capital
 *   pendiente de los créditos con un banco. Los créditos de autopago no se restan (ver resumenPatrimonio_).
 */
function patrimonioMensual_(mesFin, n) {
  const divisas = mapaDivisas_().bolsillos;
  const activas = {};
  getTableData('Cuentas').forEach(c => { if (estaActivo(c)) activas[c.ID_Cuenta] = true; });
  const ids = {};
  getTableData('Bolsillos').forEach(b => { if (activas[b.ID_Cuenta] && (divisas[b.ID_Bolsillo] || DIVISA_BASE) === DIVISA_BASE) ids[b.ID_Bolsillo] = true; });
  const caja = saldosMensuales_(ids, mesFin, n);

  const cdts = getTableData('CDTs').filter(estaActivo);
  const compras = getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado) && c.Fuente !== 'Otro');
  const extractos = {};
  getTableData('Extractos').filter(x => !esVerdadero(x.Anulado)).forEach(x => { extractos[x.ID_Extracto] = x; });
  const pagadoAntes = (idExt, fin) => { const x = extractos[idExt]; return !!(x && texto_(x.Fecha_Pago) && x.Fecha_Pago <= fin); };
  const abonos = getTableData('Pagos_Tarjeta').filter(p => !esVerdadero(p.Anulado) && p.Tipo === 'Abono');
  const creditos = getTableData('Creditos').filter(c => c.Estado !== 'Anulado' && esBancario_(c));
  const pagosCred = getTableData('Creditos_Pagos').filter(p => !esVerdadero(p.Anulado));

  return caja.map(p => {
    const fin = finDeMes_(p.mes);
    const invertido = cdts.filter(c => c.Fecha_Inicio <= fin && (c.Estado === 'Vigente' || texto_(c.Fecha_Vencimiento) > fin)).reduce((a, c) => a + (Number(c.Capital) || 0), 0);
    const comprado = compras.filter(c => c.Fecha <= fin && !pagadoAntes(c.ID_Extracto, fin)).reduce((a, c) => a + (Number(c.Valor) || 0), 0);
    const abonado = abonos.filter(a => a.Fecha <= fin && !pagadoAntes(a.ID_Extracto, fin)).reduce((a, x) => a + (Number(x.Valor) || 0), 0);
    const tarjetas = Math.max(0, comprado - abonado);
    const deudaCred = creditos.filter(c => c.Fecha_Inicio <= fin).reduce((a, c) => {
      const pagos = pagosCred.filter(x => x.ID_Credito === c.ID_Credito && x.Fecha <= fin).sort((x, y) => Number(y.Num_Cuota) - Number(x.Num_Cuota));
      return a + (pagos.length ? Number(pagos[0].Saldo_Despues) || 0 : Number(c.Monto) || 0);
    }, 0);
    return { mes: p.mes, caja: p.saldo, invertido: redondear2_(invertido), tarjetas: redondear2_(tarjetas), creditos: redondear2_(deudaCred),
      neto: redondear2_(p.saldo + invertido - tarjetas - deudaCred) };
  });
}

/**
 * Lo que viene en los próximos `dias` (estimado), con las repeticiones: cada cobro y cada ingreso que se repite, cada
 * cuota de crédito (con sus seguros), el pago de cada tarjeta, la nómina de cada mes y los CDT.
 * @returns {Array} [{ fecha, dias, titulo, valor (con signo: + entra, − sale), tipo }]
 */
function eventosProyectados_(dias) {
  const hoy = hoyIso_(), limite = sumarDias_(hoy, dias);
  const lista = [];
  const agregar = (fecha, titulo, valor, tipo) => {
    const f = fecha < hoy ? hoy : fecha; // lo atrasado cuenta hoy
    if (f > limite || !valor) return;
    lista.push({ fecha: f, dias: diasEntre_(hoy, f), titulo: titulo, valor: redondear2_(valor), tipo: tipo });
  };
  const repetir = (r, signo, tipo) => {
    let f = r.Proximo_Cobro, x = Object.assign({}, r), vueltas = 0;
    while (f && f <= limite && vueltas++ < 60) { agregar(f, r.Nombre, signo * (Number(r.Valor) || 0), tipo); x.Proximo_Cobro = f; f = siguienteCobro_(x); }
  };
  const divisas = mapaDivisas_().bolsillos;
  const enPesos = id => !id || (divisas[id] || DIVISA_BASE) === DIVISA_BASE;
  getTableData('Suscripciones').filter(s => estaActivo(s) && enPesos(s.ID_Bolsillo)).forEach(s => repetir(s, -1, s.Tipo === 'Servicio' ? 'Servicio' : 'Suscripción'));
  getTableData('Ingresos_Recurrentes').filter(r => estaActivo(r) && enPesos(r.ID_Bolsillo)).forEach(r => repetir(r, 1, 'Ingreso'));
  // Cuotas de crédito pendientes (y los seguros de cada una en los bancarios)
  const cred = {};
  getTableData('Creditos').filter(c => c.Estado === 'Activo').forEach(c => { cred[c.ID_Credito] = c; });
  getTableData('Creditos_Cronograma').filter(f => f.Estado === 'Pendiente' && cred[f.ID_Credito]).forEach(f => {
    const c = cred[f.ID_Credito];
    agregar(f.Fecha_Prevista, 'Cuota ' + f.Num + ' · ' + c.Nombre, -((Number(f.Cuota) || 0) + (Number(c.Cargos_Cuota) || 0)), 'Crédito');
  });
  // Pago de las tarjetas (lo que falta de su extracto) y los CDT que pagan o vencen
  proximosEventos_(dias, { ingresos: false }).forEach(e => {
    if (e.tipo === 'Tarjeta') agregar(e.fecha, 'Pagar ' + e.titulo, -(Number(e.valor) || 0), 'Tarjeta');
    if (e.tipo === 'CDT') agregar(e.fecha, e.titulo, Number(e.valor) || 0, 'CDT');
  });
  // La nómina estimada: la próxima y, con el mismo valor, la de cada mes siguiente dentro del horizonte
  ingresosEsperados_(dias).filter(e => e.tipo === 'Nomina').forEach(e => {
    for (let k = 0; k < 4; k++) agregar(sumarMeses_(e.fecha, k), e.titulo.replace(/\d{4}-\d{2}$/, '') + (k ? '(mes +' + k + ')' : ''), Number(e.valor) || 0, 'Nómina');
  });
  return lista.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.titulo.localeCompare(b.titulo));
}

/** Todo lo de la pantalla Análisis en una sola llamada. */
function obtenerAnalisis() {
  const hoy = hoyIso_(), mes = hoy.slice(0, 7), anio = hoy.slice(0, 4);
  const patrimonio = resumenPatrimonio_();

  // Categorías: este mes frente al anterior y al promedio de los tres anteriores
  const cats = m => { const o = {}; obtenerGraficos({ mes: m }).categorias.forEach(c => { o[c.Nombre] = c.Valor; }); return o; };
  const actual = cats(mes), anteriores = [1, 2, 3].map(k => cats(mesMas_(mes, -k)));
  const nombres = {};
  [actual].concat(anteriores).forEach(o => Object.keys(o).forEach(k => { nombres[k] = true; }));
  const categorias = Object.keys(nombres).map(k => ({
    nombre: k, actual: actual[k] || 0, anterior: anteriores[0][k] || 0,
    promedio: redondear2_(anteriores.reduce((a, o) => a + (o[k] || 0), 0) / 3)
  })).sort((a, b) => b.actual - a.actual || b.promedio - a.promedio).slice(0, 10);

  // Lo que debes y cuándo terminas
  const cron = getTableData('Creditos_Cronograma');
  const deudas = resumenTarjetas_().filter(t => t.deuda > 0).map(t => ({ nombre: t.Nombre, tipo: 'Tarjeta', saldo: t.deuda, fin: t.proximoPago, cuotas: 0 }))
    .concat(listarCreditos().filter(c => c.Estado === 'Activo').map(c => {
      const pend = cron.filter(f => f.ID_Credito === c.ID_Credito && f.Estado === 'Pendiente').map(f => f.Fecha_Prevista).sort();
      return { nombre: c.Nombre, tipo: c.Tipo_Credito === 'Bancario' ? 'Crédito' : 'Autopago', saldo: c.saldo, fin: pend[pend.length - 1] || '', cuotas: pend.length };
    }));

  // Proyección del dinero disponible a 30, 60 y 90 días: lo que ya sabes que entra y sale y, aparte, tu gasto habitual
  // (el promedio de gastos de los tres meses anteriores, sin lo que ya está en los compromisos: suscripciones, servicios y cuotas)
  const eventos = eventosProyectados_(90);
  const inicio = patrimonio.activos.disponible;
  const flujo = obtenerGraficos({ mes: mes, meses: 12 }).serie;
  const previos = flujo.slice(-4, -1);
  const gastoPromedio = previos.length ? previos.reduce((a, m) => a + m.gastos, 0) / previos.length : 0;
  const compromisosMes = getTableData('Suscripciones').filter(s => estaActivo(s) && cobroProgramado_(s)).reduce((a, x) => a + costoMensual_(x.Valor, x.Periodicidad), 0) +
    getTableData('Creditos').filter(c => c.Estado === 'Activo' && esBancario_(c)).reduce((a, c) => a + (Number(c.Cuota_Fija) || 0) * (c.Periodicidad === 'Quincenal' ? 2 : 1), 0);
  // Sin historia todavía (quien empieza), el plan del presupuesto del mes o, si no lo hay, la plantilla base
  let baseGasto = gastoPromedio, fuente = gastoPromedio > 0 ? 'promedio' : '';
  if (!baseGasto) {
    const ppto = obtenerPresupuestoMes(mes);
    const plan = ppto && ppto.totales ? Number(ppto.totales.plan) || 0 : 0;
    if (plan > 0) { baseGasto = plan; fuente = 'presupuesto'; }
    else {
      const base = getTableData('Escenarios').find(x => estaActivo(x) && esVerdadero(x.Es_Base));
      const t = base ? getTableData('Presupuesto_Plantilla').filter(r => estaActivo(r) && r.ID_Escenario === base.ID_Escenario).reduce((a, r) => a + (Number(r.Monto_Plan) || 0), 0) : 0;
      if (t > 0) { baseGasto = t; fuente = 'plantilla'; }
    }
  }
  const habitual = redondear2_(Math.max(0, baseGasto - compromisosMes));
  const conocido = d => redondear2_(inicio + eventos.filter(e => e.dias <= d).reduce((a, e) => a + e.valor, 0));
  const enDias = d => redondear2_(conocido(d) - habitual * d / 30);
  const semanas = [];
  for (let k = 0; k <= 13; k++) semanas.push({ dia: k * 7, fecha: sumarDias_(hoy, k * 7), conocido: conocido(k * 7), saldo: enDias(k * 7) });

  return {
    hoy: hoy, mes: mes, divisa: DIVISA_BASE,
    patrimonio: patrimonio,
    patrimonioMensual: patrimonioMensual_(mes, 12),
    flujo: flujo,
    categorias: categorias,
    deudas: deudas,
    proyeccion: { inicio: inicio, habitual: habitual, fuenteHabitual: fuente, d30: enDias(30), d60: enDias(60), d90: enDias(90),
      conocido: { d30: conocido(30), d60: conocido(60), d90: conocido(90) }, semanas: semanas, eventos: eventos.slice(0, 60) },
    cargos: resumenCargos_(anio + '-01-01', hoy), anio: Number(anio)
  };
}
