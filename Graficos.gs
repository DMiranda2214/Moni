/**
 * Graficos.gs — Moni
 * Datos para la pantalla de Gráficos, calculados desde el libro de movimientos:
 *   - gastos del mes por categoría,
 *   - lo que entró y lo que salió en los últimos N meses,
 *   - el saldo al cierre de cada mes.
 * Todo es de una sola divisa (la que se elige): los pesos y los dólares no se suman.
 * "Entró" y "salió" siguen la misma regla de la pantalla de Movimientos: los traslados no cuentan.
 */

/** Meses AAAA-MM que terminan en `mes`, del más viejo al más nuevo. */
function mesesHasta_(mes, n) {
  const p = mes.split('-').map(Number);
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(p[0], p[1] - 1 - i, 1));
    lista.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
  }
  return lista;
}

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
    if (mm < lista[0]) { saldoInicial += v; return; }
    const fila = porMes[mm];
    if (!fila) return; // posterior al mes elegido
    hayDatos = true;
    fila.movido += v; // todo cambia el saldo, también los traslados y las conversiones
    if (m.Tipo_Mov === 'Transferencia') return;
    if (v >= 0) { fila.ingresos += v; return; }
    fila.gastos += -v;
    if (mm === mes) {
      const nombre = nombreCategoria[m.ID_Categoria] || ETIQUETA_SUBTIPO_GASTO[m.Subtipo] || 'Sin categoría';
      categorias[nombre] = (categorias[nombre] || 0) + (-v);
    }
  });

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
