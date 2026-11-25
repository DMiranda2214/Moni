/**
 * Finanzas.gs — Moni
 * Fórmulas financieras compartidas: tasas, interés compuesto y amortización francesa. Antes estaban repetidas en
 * Ahorro (tasa diaria), CDT (interés) y Créditos (cuota y plazo).
 */

/** Periodos por año de cada periodicidad de cuota. */
const PERIODOS_ANIO = { Mensual: 12, Quincenal: 24 };

/** Tasa diaria equivalente a una tasa efectiva anual: (1 + EA)^(1/365) − 1. */
function tasaDiaria_(ea) { return Math.pow(1 + ea, 1 / 365) - 1; }

/** Interés compuesto de un capital a una EA durante `dias` (base 365). */
function interesCompuesto_(capital, ea, dias) {
  return redondear2_((Number(capital) || 0) * (Math.pow(1 + (Number(ea) || 0), Math.max(0, dias) / 365) - 1));
}

/**
 * Tasa periódica a partir de una tasa efectiva anual (EA).
 *   Método "Excel" (el del Excel de referencia): nominal = TASA.NOMINAL(EA; 2), luego ÷ periodos al año.
 *     EA 10 % → nominal 9,7618 % → ÷24 = 0,4067404 % por quincena.
 *   Método "Exacta": (1 + EA)^(1/periodos) − 1.
 */
function tasaDesdeEA_(ea, periodicidad, metodo) {
  const n = PERIODOS_ANIO[periodicidad] || 12;
  if (metodo === 'Exacta') return Math.pow(1 + ea, 1 / n) - 1;
  return (2 * (Math.pow(1 + ea, 1 / 2) - 1)) / n;
}

/** La EA que corresponde a una tasa periódica (lo inverso de tasaDesdeEA_), para mostrarla. */
function eaDesdeTasa_(i, periodicidad, metodo) {
  const n = PERIODOS_ANIO[periodicidad] || 12;
  return metodo === 'Exacta' ? Math.pow(1 + i, n) - 1 : Math.pow(1 + i * n / 2, 2) - 1;
}

/** Cuota fija de la amortización francesa. */
function cuotaFrancesa_(monto, i, n) {
  if (i <= 0) return redondear2_(monto / n);
  return redondear2_(monto * i / (1 - Math.pow(1 + i, -n)));
}

/** Cuántas cuotas hacen falta para pagar `saldo` con esa cuota y tasa (redondeado hacia arriba). */
function plazoRestante_(saldo, i, cuota) {
  if (i <= 0) return Math.max(1, Math.ceil(saldo / cuota - 1e-9));
  if (cuota <= saldo * i + 1e-9) throw new Error('La cuota no alcanza a cubrir los intereses del saldo.');
  return Math.max(1, Math.ceil(-Math.log(1 - saldo * i / cuota) / Math.log(1 + i) - 1e-9));
}
