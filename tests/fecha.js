/**
 * Fechas de las pruebas en la zona de la app (America/Bogota, UTC−5), no en UTC.
 * Con `toISOString()` las pruebas fallaban cada noche después de las 19:00 en Bogotá, cuando en UTC ya es mañana
 * y la app (con razón) rechaza una fecha "futura".
 * @param {number} [desfaseMs] milisegundos a sumar al momento actual
 */
function bogota(desfaseMs) {
  return new Date(Date.now() + (desfaseMs || 0) - 5 * 3600000).toISOString().slice(0, 10);
}

module.exports = { bogota };
