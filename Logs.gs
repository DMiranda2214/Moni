/**
 * Logs.gs — Moni
 * Registro de lo que pasa en producción, para poder seguir un error y corregirlo después.
 * Usa la tabla Log (ID_Log, Fecha_Hora, Nivel, Funcion, Mensaje, Detalle). Se guardan las últimas
 * MAX_LOG_FILAS entradas; las más viejas se descartan solas.
 *
 * Qué se anota:
 *   - Error: algo inesperado (fallo de código o de un servicio de Google) o un error del navegador.
 *   - Aviso: una regla de negocio que rechazó algo ("Escribe tu nombre", "Ya existe un banco…").
 *   - Info: hechos que conviene recordar (borrado total, inicio de operación).
 * Registrar nunca debe romper lo que se estaba haciendo: todo está envuelto para no lanzar.
 */

const VERSION_APP = '0.3.0';
const MAX_LOG_FILAS = 500;
const MARGEN_RECORTE_LOG = 50; // se recorta cada vez que sobran 50, no en cada entrada

function recortarTexto_(v, max) {
  const t = String(v === undefined || v === null ? '' : v);
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Fallo de código o de un servicio de Google = Error. Una regla de negocio (Error común) = Aviso. */
function nivelDeError_(e) {
  const n = e && e.name;
  return (n === 'TypeError' || n === 'ReferenceError' || n === 'RangeError' || n === 'SyntaxError' || n === 'Exception') ? 'Error' : 'Aviso';
}

/** Nombre de la función de la API que falló, sacado de la traza (la primera que no sea de infraestructura). */
function funcionDeError_(e) {
  const traza = String((e && e.stack) || '');
  const re = /at (?:[\w$.]*\.)?([A-Za-z_$][\w$]*) \(/g;
  const nombres = [];
  let m;
  while ((m = re.exec(traza)) !== null) nombres.push(m[1]);
  // La función de la API es la que llamó a responder_; las de más arriba son detalles internos.
  const i = nombres.indexOf('responder_');
  if (i !== -1 && nombres[i + 1]) return nombres[i + 1];
  return nombres.find(n => n !== 'Object' && n !== 'eval') || 'desconocida';
}

/** Anota una entrada. Devuelve true si quedó guardada. No lanza nunca. */
function registrarLog(nivel, funcion, mensaje, detalle) {
  try {
    insertRow('Log', {
      Fecha_Hora: ahoraIso_(),
      Nivel: ENUMS.Log.Nivel.indexOf(nivel) === -1 ? 'Info' : nivel,
      Funcion: recortarTexto_(funcion, 80),
      Mensaje: recortarTexto_(mensaje, 400),
      Detalle: recortarTexto_('v' + VERSION_APP + (detalle ? '\n' + detalle : ''), 2000)
    });
    recortarLog_();
    return true;
  } catch (e) {
    try { Logger.log('No se pudo registrar el log: ' + e.message); } catch (e2) {}
    return false;
  }
}

/** Descarta las entradas más viejas cuando se pasa del tope. */
function recortarLog_() {
  const sheet = getSpreadsheet().getSheetByName('Log');
  if (!sheet) return;
  const ultima = sheet.getLastRow();
  if (ultima - 1 <= MAX_LOG_FILAS + MARGEN_RECORTE_LOG) return;
  const lock = tomarBloqueo(5000);
  try {
    sheet.deleteRows(2, ultima - 1 - MAX_LOG_FILAS);
    invalidateCache('Log');
  } finally {
    lock.releaseLock();
  }
}

/** Lo llama responder_ cuando una función de la API falla. */
function registrarErrorApi_(e) {
  const mensaje = (e && e.message) ? e.message : String(e);
  // Si el fallo fue no conseguir el bloqueo, registrar volvería a esperar el mismo bloqueo.
  if (/lock|bloqueo|waitLock/i.test(mensaje)) return;
  registrarLog(nivelDeError_(e), funcionDeError_(e), mensaje, e && e.stack);
}

/** Envuelve algo que corre solo (un disparador): si falla, queda anotado y se vuelve a lanzar. */
function ejecutarConLog_(nombre, fn) {
  try {
    return fn();
  } catch (e) {
    registrarLog('Error', nombre, (e && e.message) || String(e), e && e.stack);
    throw e;
  }
}

/** Errores que ocurren en el navegador (el cliente los reporta con un tope por sesión). */
function registrarErrorCliente(mensaje, detalle) {
  registrarLog('Error', 'cliente', mensaje, detalle);
  return { ok: true };
}

/**
 * Entradas recientes, de la más nueva a la más vieja.
 * @param {Object} [o] { soloErrores: boolean, limite: number }
 */
function obtenerLogs(o) {
  const opc = o || {};
  const todas = getTableData('Log', { forceRefresh: true }).sort((a, b) => {
    const fa = String(a.Fecha_Hora), fb = String(b.Fecha_Hora);
    return fa < fb ? 1 : fa > fb ? -1 : b._rowIndex - a._rowIndex;
  });
  const filtradas = opc.soloErrores ? todas.filter(l => l.Nivel === 'Error') : todas;
  const limite = Number(opc.limite) > 0 ? Number(opc.limite) : 150;
  return {
    version: VERSION_APP,
    items: filtradas.slice(0, limite).map(l => ({ Fecha_Hora: l.Fecha_Hora, Nivel: l.Nivel, Funcion: l.Funcion, Mensaje: l.Mensaje, Detalle: l.Detalle })),
    total: todas.length,
    errores: todas.filter(l => l.Nivel === 'Error').length,
    hayMas: filtradas.length > limite
  };
}

/** Vacía el registro y deja constancia de que se hizo. */
function limpiarLogs() {
  const lock = tomarBloqueo(15000);
  try {
    const sheet = getSpreadsheet().getSheetByName('Log');
    const ultima = sheet ? sheet.getLastRow() : 0;
    if (ultima >= 2) sheet.getRange(2, 1, ultima - 1, SCHEMAS.Log.headers.length).clearContent();
    invalidateCache('Log');
  } finally {
    lock.releaseLock();
  }
  registrarLog('Info', 'limpiarLogs', 'Se limpió el registro');
  return obtenerLogs();
}
