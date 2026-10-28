/**
 * Anual.gs — Moni
 * Vista anual (la hoja "Año" del Excel): mes a mes, lo que entró, lo planeado, lo real, lo ahorrado,
 * lo que se debe en tarjetas y lo que queda.
 *   Restante = Ingreso − Plan − TTCC   (la misma fórmula del Excel)
 *   Saldo    = Ingreso − Real
 */

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function obtenerVistaAnual(anio) {
  const a = anioValido_(anio || cfgValor_('Anio_Activo') || new Date().getFullYear());
  const real = realPorRenglon_();
  const items = getTableData('Presupuesto_Mes');
  const movs = getTableData('Movimientos', { excludeAnulados: true });
  const compras = getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado));

  const meses = NOMBRES_MES.map((nombre, i) => ({
    mes: a + '-' + dosDigitos_(i + 1), nombre: nombre, ingreso: 0, plan: 0, real: 0, ahorro: 0, tc: 0, restante: 0, saldo: 0, conPresupuesto: false
  }));
  const porMes = {}; meses.forEach(m => { porMes[m.mes] = m; });

  items.forEach(i => {
    const m = porMes[i.Mes];
    if (!m) return;
    const plan = Number(i.Plan) || 0;
    const r = real[i.ID_Item] || 0;
    m.plan += plan; m.real += r; m.conPresupuesto = true;
    if (esVerdadero(i.Pagado)) m.ahorro += plan - r;
  });
  movs.forEach(mv => {
    if (mv.Tipo_Mov !== 'Ingreso' || !mv.Fecha) return;
    const m = porMes[mv.Fecha.slice(0, 7)];
    if (m) m.ingreso += Number(mv.Valor) || 0;
  });
  compras.forEach(c => {
    const m = porMes[c.Mes_Extracto];
    if (m) m.tc += Number(c.Valor) || 0;
  });

  const tot = { ingreso: 0, plan: 0, real: 0, ahorro: 0, tc: 0, restante: 0, saldo: 0 };
  meses.forEach(m => {
    ['ingreso', 'plan', 'real', 'ahorro', 'tc'].forEach(k => { m[k] = redondear2_(m[k]); });
    m.restante = redondear2_(m.ingreso - m.plan - m.tc);
    m.saldo = redondear2_(m.ingreso - m.real);
    Object.keys(tot).forEach(k => { tot[k] += m[k]; });
  });
  Object.keys(tot).forEach(k => { tot[k] = redondear2_(tot[k]); });

  // Años con datos, para el selector
  const anios = {}; anios[a] = true;
  const marca = f => { const y = Number(String(f || '').slice(0, 4)); if (y >= 2000 && y <= 2100) anios[y] = true; };
  items.forEach(i => marca(i.Mes)); movs.forEach(m => marca(m.Fecha)); compras.forEach(c => marca(c.Mes_Extracto));

  return { anio: a, anios: Object.keys(anios).map(Number).sort((x, y) => y - x), meses: meses, totales: tot };
}
