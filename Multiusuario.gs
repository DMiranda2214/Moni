/**
 * Multiusuario.gs — Moni
 * Una sola aplicación desplegada, muchas personas con sus finanzas separadas.
 *
 * Cómo funciona (con la propiedad de script MODO_MULTIUSUARIO = TRUE):
 *  - La web app corre "como el usuario que accede": todo lo que se lee o escribe en Sheets, Drive y Calendar
 *    es de esa persona y con sus permisos.
 *  - Cada persona tiene su propia hoja de Moni, que la app le crea en su Drive la primera vez (o que vincula
 *    si ya tiene una). El ID se guarda en las propiedades de esa persona, que nadie más puede leer.
 *  - La caché, el bloqueo y los activadores (copias automáticas, recordatorios) también son de cada persona.
 *  - Una actualización del código llega a todos a la vez. Si trae tablas o columnas nuevas, la hoja de cada
 *    persona se actualiza sola la primera vez que entra (sin borrar nada).
 *  - Quien administra la app no ve los datos de nadie: cada hoja es de su dueña.
 */

/** Activa el modo multiusuario. Se ejecuta una vez desde el editor de Apps Script. */
function activarModoMultiusuario() {
  PropertiesService.getScriptProperties().setProperty('MODO_MULTIUSUARIO', 'TRUE');
  Logger.log('Modo multiusuario activado. Cada persona creará o vinculará su propia hoja al entrar.');
}

/** Vuelve al modo de una sola hoja (la del script). */
function desactivarModoMultiusuario() {
  PropertiesService.getScriptProperties().deleteProperty('MODO_MULTIUSUARIO');
  Logger.log('Modo multiusuario desactivado. Se usa la hoja guardada en las propiedades del script.');
}

function correoActual_() {
  try { return String(Session.getActiveUser().getEmail() || ''); } catch (e) { return ''; }
}

/** Datos de la cuenta de quien entra, para la pantalla de bienvenida y Ajustes → Mi cuenta. */
function estadoMiCuenta() {
  const id = idHojaUsuario_();
  let url = '', nombre = '', hay = !!id;
  // Una sola hoja: también puede ser la hoja a la que está unido el script (sin SPREADSHEET_ID).
  if (id || !modoMultiusuario_()) {
    try { const ss = getSpreadsheet(); url = ss.getUrl(); nombre = ss.getName(); hay = true; } catch (e) { /* sin acceso: se avisa abajo */ }
  }
  return { multiusuario: modoMultiusuario_(), correo: correoActual_(), tieneHoja: hay, urlHoja: url, nombreHoja: nombre };
}

/** Un ID de hoja a partir de lo que pegue la persona: el ID solo o el enlace completo. */
function idDesdeEnlace_(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : '';
}

/** ¿Es una hoja de Moni (o una hoja vacía a la que se le pueden crear las tablas)? */
function pareceHojaMoni_(ss) {
  const hojas = ss.getSheets();
  if (hojas.some(h => h.getName() === 'Movimientos') && hojas.some(h => h.getName() === 'Config')) return true;
  return hojas.length === 1 && hojas[0].getLastRow() === 0; // recién creada y en blanco
}

/** Guarda la hoja de esta persona y deja sus tablas al día. */
/** Tiempo máximo de cada paso de instalación: la pantalla espera ~45 s por llamada y Apps Script corta a los 6 min. */
const PRESUPUESTO_INSTALACION_MS = 20000;

function adoptarHoja_(ss) {
  propiedades_().setProperty('SPREADSHEET_ID', ss.getId());
  invalidateCache();
  // Por partes: si no alcanza el tiempo, la pantalla pide continuar (ver instalarBaseDatos) en vez de morir por timeout.
  const r = setupDatabase(ss, { presupuestoMs: PRESUPUESTO_INSTALACION_MS });
  if (!r.parcial) registrarLog('Info', 'adoptarHoja_', 'Hoja vinculada', ss.getName());
  return { id: ss.getId(), url: ss.getUrl(), nombre: ss.getName(), instalada: r.ok, parcial: !!r.parcial, hechas: r.hechas, tablas: r.tablas };
}

/** Crea la hoja de Moni de esta persona en su Drive y la prepara. Si ya tiene una, devuelve esa. */
function crearMiHoja() {
  if (idHojaUsuario_()) return Object.assign(estadoMiCuenta(), { yaExistia: true });
  const ss = SpreadsheetApp.create('Moni — mis finanzas');
  const r = adoptarHoja_(ss);
  return Object.assign(estadoMiCuenta(), { yaExistia: false, parcial: r.parcial, hechas: r.hechas, tablas: r.tablas });
}

/**
 * Vincula una hoja que la persona ya tiene (la pega como enlace o como ID). Necesita permiso de edición.
 * Sirve para empezar con una hoja de Moni existente o para usar la hoja compartida de la pareja.
 */
function vincularMiHoja(enlace) {
  const id = idDesdeEnlace_(enlace);
  if (!id) throw new Error('Pega el enlace de tu hoja de cálculo (el de la barra del navegador) o su ID.');
  let ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('No pude abrir esa hoja. Revisa el enlace y que tengas permiso de edición sobre ella.'); }
  if (!pareceHojaMoni_(ss)) throw new Error('Esa hoja no parece una hoja de Moni. Para no mezclar datos, usa una hoja de Moni o una en blanco.');
  adoptarHoja_(ss);
  return estadoMiCuenta();
}

/**
 * Suelta la hoja actual (no se borra: sigue en tu Drive) para empezar con otra. Apaga las copias automáticas
 * y los recordatorios de esta persona, que apuntaban a la hoja anterior.
 */
function desvincularMiHoja() {
  try { configurarRespaldoAutomatico(false); } catch (e) {}
  disparadoresRecordatorios_().forEach(t => ScriptApp.deleteTrigger(t));
  disparadoresTasas_().forEach(t => ScriptApp.deleteTrigger(t));
  const props = propiedades_();
  ['SPREADSHEET_ID', 'ULTIMO_RESPALDO', 'ULTIMO_RESPALDO_MS'].forEach(k => props.deleteProperty(k));
  invalidateCache();
  return estadoMiCuenta();
}
