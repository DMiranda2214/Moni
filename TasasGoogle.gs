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
/** Todas las divisas menos la base: el dólar y el euro primero (las filas que ya tenían las hojas de antes). */
const MONEDAS_TASA = DIVISAS.filter(d => d !== DIVISA_BASE);
const FUNCION_TASAS = 'actualizarTasasAuto';

function disparadoresTasas_() {
  return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === FUNCION_TASAS);
}

/**
 * Fórmula de la tasa de una moneda en pesos. Si Google no tiene el par directo (pasa con monedas menos negociadas contra
 * el peso), la calcula cruzando por el dólar: XXX→USD × USD→COP.
 */
function formulaTasa_(m) {
  if (m === 'USD') return '=GOOGLEFINANCE("CURRENCY:USDCOP")';
  return '=IFERROR(GOOGLEFINANCE("CURRENCY:' + m + 'COP"),IFERROR(GOOGLEFINANCE("CURRENCY:' + m + 'USD")*GOOGLEFINANCE("CURRENCY:USDCOP"),""))';
}

/** La hoja auxiliar con las fórmulas; se crea la primera vez y se le agregan las monedas que falten (sin tocar las que ya tiene). */
function hojaTasas_(ss) {
  let hoja = ss.getSheetByName(HOJA_TASAS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_TASAS);
    hoja.getRange(1, 1, 1, 2).setValues([['Moneda', 'Pesos por unidad (Google Finance)']]);
    try { hoja.getRange(1, 1, 1, 2).setFontWeight('bold'); hoja.setColumnWidth(1, 90); hoja.setColumnWidth(2, 260); } catch (e) {}
  }
  const n = Math.max(hoja.getLastRow() - 1, 0);
  const ya = n ? hoja.getRange(2, 1, n, 1).getValues().map(f => String(f[0]).trim()) : [];
  let fila = n + 2;
  MONEDAS_TASA.filter(m => ya.indexOf(m) === -1).forEach(m => {
    hoja.getRange(fila, 1).setValue(m);
    hoja.getRange(fila, 2).setFormula(formulaTasa_(m));
    fila++;
  });
  return hoja;
}

/** Tasa redondeada: 2 decimales desde 100 pesos por unidad; 4 para las monedas que valen poco (peso chileno, yen…). */
const redondearTasa_ = v => v >= 100 ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000;

/**
 * Lee las tasas de la hoja auxiliar y las guarda. Devuelve las que se actualizaron y las que Google aún no entregó
 * (la primera vez, o si el mercado no responde, la fórmula tarda unos segundos o muestra #N/A).
 */
function actualizarTasasGoogle() {
  const hoja = hojaTasas_(getSpreadsheet());
  SpreadsheetApp.flush();
  const filas = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 2).getValues();
  // Se guardan el dólar, el euro y las monedas que la persona usa (o que ya tenían tasa): las demás no llenan Config
  const enUso = divisasEnUso_();
  const interesa = m => m === 'USD' || m === 'EUR' || enUso.indexOf(m) !== -1 || !!cfgValor_('Tasa_' + m);
  const actualizadas = [], pendientes = [];
  filas.forEach(f => {
    const moneda = String(f[0]).trim(), valor = f[1];
    if (MONEDAS_TASA.indexOf(moneda) === -1 || !interesa(moneda)) return;
    if (typeof valor === 'number' && isFinite(valor) && valor > 0 && valor < 1e7) {
      const tasa = redondearTasa_(valor);
      guardarConfig_('Tasa_' + moneda, String(tasa));
      guardarConfig_('Tasa_' + moneda + '_Fecha', hoyIso_());
      guardarConfig_('Tasa_' + moneda + '_Fuente', 'Google Finance');
      actualizadas.push({ moneda: moneda, tasa: tasa });
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
    const r = actualizarTasasGoogle();
    // Los precios de las inversiones se actualizan con la misma tarea diaria
    try { r.inversiones = actualizarPreciosGoogle(); } catch (e) { r.inversiones = { error: e.message }; }
    return r;
  });
}
