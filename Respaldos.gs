/**
 * Respaldos.gs — Moni
 * Copias de seguridad del Sheet en Drive. Se guardan en la carpeta "Moni Respaldos"; se conservan las
 * últimas N (Config.Respaldo_Copias) y las más viejas van a la papelera. El respaldo automático corre
 * cada día, pero solo copia si pasaron Config.Respaldo_Frecuencia_Dias desde la última copia.
 */

const PREFIJO_RESPALDO = 'Moni_Respaldo_';
const CARPETA_RESPALDOS = 'Moni Respaldos';
const FUNCION_RESPALDO = 'respaldoAutomatico';

function carpetaRespaldos_() {
  const it = DriveApp.getFoldersByName(CARPETA_RESPALDOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_RESPALDOS);
}

function numeroConfig_(clave, defecto) {
  const n = Number(cfgValor_(clave));
  return isFinite(n) && n >= 1 ? Math.floor(n) : defecto;
}

/** Manda a la papelera las copias que sobran (deja las `retener` más recientes). Devuelve cuántas. */
function limpiarRespaldosViejos_(carpeta, retener) {
  const archivos = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(PREFIJO_RESPALDO) === 0) archivos.push(f);
  }
  archivos.sort((a, b) => (a.getName() < b.getName() ? 1 : a.getName() > b.getName() ? -1 : 0)); // el nombre lleva la fecha
  const sobran = archivos.slice(retener);
  sobran.forEach(f => f.setTrashed(true));
  return sobran.length;
}

/** Crea una copia ahora. */
function crearRespaldo() {
  const ss = getSpreadsheet();
  const carpeta = carpetaRespaldos_();
  const sello = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd_HHmmss');
  const copia = DriveApp.getFileById(ss.getId()).makeCopy(PREFIJO_RESPALDO + sello, carpeta);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ULTIMO_RESPALDO_MS', String(Date.now()));
  props.setProperty('ULTIMO_RESPALDO', ahoraIso_());
  const eliminados = limpiarRespaldosViejos_(carpeta, numeroConfig_('Respaldo_Copias', 8));
  return { nombre: copia.getName(), url: copia.getUrl(), fecha: ahoraIso_(), eliminados: eliminados };
}

/** Lo que ejecuta el disparador diario: copia solo si ya toca. */
function respaldoAutomatico() {
  const dias = numeroConfig_('Respaldo_Frecuencia_Dias', 7);
  const ultimo = Number(PropertiesService.getScriptProperties().getProperty('ULTIMO_RESPALDO_MS')) || 0;
  if (ultimo && Date.now() - ultimo < dias * 86400000 - 3600000) return { omitido: true };
  return crearRespaldo();
}

function disparadoresRespaldo_() {
  return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === FUNCION_RESPALDO);
}

/** Activa o desactiva la copia automática diaria. */
function configurarRespaldoAutomatico(activar) {
  disparadoresRespaldo_().forEach(t => ScriptApp.deleteTrigger(t));
  if (activar) ScriptApp.newTrigger(FUNCION_RESPALDO).timeBased().everyDays(1).atHour(3).create();
  return estadoRespaldos();
}

function estadoRespaldos() {
  const props = PropertiesService.getScriptProperties();
  let copias = 0;
  try {
    const it = carpetaRespaldos_().getFiles();
    while (it.hasNext()) { if (it.next().getName().indexOf(PREFIJO_RESPALDO) === 0) copias++; }
  } catch (e) {}
  return {
    automatico: disparadoresRespaldo_().length > 0, ultimo: props.getProperty('ULTIMO_RESPALDO') || '',
    frecuenciaDias: numeroConfig_('Respaldo_Frecuencia_Dias', 7), copiasMaximas: numeroConfig_('Respaldo_Copias', 8),
    copiasActuales: copias, carpeta: CARPETA_RESPALDOS
  };
}
