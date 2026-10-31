/**
 * Reinicio.gs — Moni
 * Borra toda la información de la persona y deja la base como recién instalada: las pestañas y sus
 * encabezados se conservan; los datos, no. Es la salida para quien quiere empezar de cero o dejar de usar Moni.
 *
 * No se puede deshacer, así que la API exige la frase de confirmación (lo que la pantalla le pide escribir).
 * No toca: los respaldos de Drive (salvo que se pida), los PDF que la persona haya guardado ni los permisos de
 * acceso del proyecto (SPREADSHEET_ID y USUARIOS_PERMITIDOS), para que la app siga funcionando.
 */

const FRASE_REINICIO = 'BORRAR';

/** Manda a la papelera los respaldos de Drive, si la carpeta existe. Devuelve cuántos. */
function borrarRespaldos_() {
  const it = DriveApp.getFoldersByName(CARPETA_RESPALDOS);
  return it.hasNext() ? limpiarRespaldosViejos_(it.next(), 0) : 0;
}

/**
 * Vacía todas las tablas, vuelve a sembrar los valores iniciales (parámetros, categorías y escenario base)
 * y apaga las copias automáticas.
 * @param {string} confirmacion Debe ser la frase FRASE_REINICIO.
 * @param {Object} [opciones] { respaldos: true } manda además a la papelera las copias de "Moni Respaldos".
 */
function borrarTodosLosDatos(confirmacion, opciones) {
  if (texto_(confirmacion).toUpperCase() !== FRASE_REINICIO) {
    throw new Error('Para borrar todo escribe ' + FRASE_REINICIO + ' tal como aparece.');
  }
  const o = opciones || {};
  const eliminadas = {};

  const lock = tomarBloqueo(30000);
  try {
    const ss = getSpreadsheet();
    Object.keys(SCHEMAS).forEach(nombre => {
      const sheet = ss.getSheetByName(nombre);
      const ultima = sheet ? sheet.getLastRow() : 0;
      if (ultima < 2) return;
      // clearContent y no deleteRows: así se conservan el formato y las listas desplegables de la hoja.
      sheet.getRange(2, 1, ultima - 1, SCHEMAS[nombre].headers.length).clearContent();
      eliminadas[nombre] = ultima - 1;
    });
    sembrarPorDefecto_(ss);
  } finally {
    lock.releaseLock();
  }
  invalidateCache();

  // Sin datos no hay nada que copiar: las copias automáticas se vuelven a activar al iniciar la operación.
  configurarRespaldoAutomatico(false);
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('ULTIMO_RESPALDO');
  props.deleteProperty('ULTIMO_RESPALDO_MS');

  const respaldosEliminados = o.respaldos ? borrarRespaldos_() : 0;
  // El registro también se vació: esta entrada deja constancia de que fue a propósito.
  registrarLog('Info', 'borrarTodosLosDatos', 'Se borró toda la información', respaldosEliminados ? respaldosEliminados + ' respaldo(s) a la papelera' : '');
  return { ok: true, eliminadas: eliminadas, respaldosEliminados: respaldosEliminados };
}
