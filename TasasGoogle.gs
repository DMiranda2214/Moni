/**
 * TasasGoogle.gs — Moni
 * Tasa de cambio de referencia tomada de Google Finance. Solo es informativa: sirve para ver cuánto equivale
 * en pesos un saldo en otra moneda y para comparar con lo que cobró el banco en una conversión. Cada banco
 * cambia a su propio precio, así que los saldos y las conversiones nunca usan esta tasa.
 *
 * GOOGLEFINANCE solo existe como fórmula de hoja de cálculo (no se puede llamar desde el código), así que la
 * app mantiene una hoja auxiliar, Tasas_Google, con una fórmula por moneda y lee el resultado de ahí.
 */

const HOJA_TASAS = 'Tasas_Google';
const MONEDAS_TASA = ['USD', 'EUR'];
const FUNCION_TASAS = 'actualizarTasasAuto';

function disparadoresTasas_() {
  return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === FUNCION_TASAS);
}

/** La hoja auxiliar con las fórmulas; se crea la primera vez. */
function hojaTasas_(ss) {
  let hoja = ss.getSheetByName(HOJA_TASAS);
  if (hoja) return hoja;
  hoja = ss.insertSheet(HOJA_TASAS);
  hoja.getRange(1, 1, 1, 2).setValues([['Moneda', 'Pesos por unidad (Google Finance)']]);
  MONEDAS_TASA.forEach((m, i) => {
    hoja.getRange(i + 2, 1).setValue(m);
    hoja.getRange(i + 2, 2).setFormula('=GOOGLEFINANCE("CURRENCY:' + m + 'COP")');
  });
  try { hoja.getRange(1, 1, 1, 2).setFontWeight('bold'); hoja.setColumnWidth(1, 90); hoja.setColumnWidth(2, 260); } catch (e) {}
  return hoja;
}

/**
 * Lee las tasas de la hoja auxiliar y las guarda. Devuelve las que se actualizaron y las que Google aún no entregó
 * (la primera vez, o si el mercado no responde, la fórmula tarda unos segundos o muestra #N/A).
 */
function actualizarTasasGoogle() {
  const hoja = hojaTasas_(getSpreadsheet());
  SpreadsheetApp.flush();
  const filas = hoja.getRange(2, 1, MONEDAS_TASA.length, 2).getValues();
  const actualizadas = [], pendientes = [];
  filas.forEach(f => {
    const moneda = String(f[0]).trim(), valor = f[1];
    if (MONEDAS_TASA.indexOf(moneda) === -1) return;
    if (typeof valor === 'number' && isFinite(valor) && valor > 0 && valor < 1e7) {
      guardarConfig_('Tasa_' + moneda, String(Math.round(valor * 100) / 100));
      guardarConfig_('Tasa_' + moneda + '_Fecha', hoyIso_());
      guardarConfig_('Tasa_' + moneda + '_Fuente', 'Google Finance');
      actualizadas.push({ moneda: moneda, tasa: Math.round(valor * 100) / 100 });
    } else {
      pendientes.push(moneda);
    }
  });
  if (!actualizadas.length) throw new Error('Google Finance todavía no devolvió la tasa. Espera unos segundos y vuelve a intentar.');
  return { actualizadas: actualizadas, pendientes: pendientes };
}

/** Activa o desactiva la actualización diaria (6:00). Al activar, intenta actualizar de una vez. */
function configurarTasaAuto(activar) {
  disparadoresTasas_().forEach(t => ScriptApp.deleteTrigger(t));
  guardarConfig_('Tasa_Auto', activar ? 'TRUE' : 'FALSE');
  let resultado = null, aviso = '';
  if (activar) {
    ScriptApp.newTrigger(FUNCION_TASAS).timeBased().everyDays(1).atHour(6).create();
    try { resultado = actualizarTasasGoogle(); } catch (e) { aviso = e.message; } // la hoja recién creada puede tardar: el disparador la leerá mañana
  }
  return { activa: !!activar, automatico: disparadoresTasas_().length > 0, resultado: resultado, aviso: aviso };
}

/** Lo que ejecuta el disparador diario. */
function actualizarTasasAuto() {
  return ejecutarConLog_(FUNCION_TASAS, function () {
    if (!esVerdadero(cfgValor_('Tasa_Auto'))) return { omitido: true };
    return actualizarTasasGoogle();
  });
}
