/**
 * Repo.gs — Moni
 * Capa de abstracción de datos para Google Sheets.
 * Implementa lectura/escritura por lotes (batch operations), control de concurrencia
 * mediante LockService y optimización de rendimiento con CacheService.
 */

const CACHE_TTL_SECONDS = 300; // 5 minutos para catálogos

/** Catálogos pequeños que cambian poco: se guardan en caché. Toda escritura la invalida. */
const TABLAS_CACHEABLES = ['Config', 'Bancos', 'Cuentas', 'Bolsillos', 'Tarjetas', 'Categorias', 'Personas', 'Inmuebles', 'Servicios_Publicos', 'Escenarios', 'Subsidios'];

/**
 * Interpreta un valor booleano de una celda (TRUE de Sheets, texto en español o inglés).
 * Una celda vacía cuenta como falso.
 */
function esVerdadero(v) {
  if (v === true) return true;
  const t = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  return t === 'TRUE' || t === 'VERDADERO' || t === 'SI' || t === 'SÍ';
}

/** Un registro está activo si su columna Activo no es falsa (o si no tiene esa columna). */
function estaActivo(fila) {
  if (fila.Activo === undefined || fila.Activo === '') return true;
  return esVerdadero(fila.Activo);
}

/**
 * Obtiene la referencia a la hoja de cálculo de Google.
 * Funciona de manera transparente tanto en proyectos vinculados (container-bound)
 * como en aplicaciones independientes mediante ScriptProperties.
 */
function getSpreadsheet() {
  // La propiedad tiene prioridad: en una web app getActiveSpreadsheet() puede devolver null.
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error("No se ha configurado la hoja de cálculo. Por favor ejecute vincularHojaMoni() o configure SPREADSHEET_ID en las propiedades del proyecto.");
}

/**
 * Toma el bloqueo del script (un solo escritor a la vez).
 * Es por script y no por usuario: protege contra dos pestañas o dispositivos de la misma persona.
 * No es reentrante: ninguna función que lo tenga puede llamar a otra que también lo tome.
 */
function tomarBloqueo(ms) {
  const lock = LockService.getScriptLock();
  lock.waitLock(ms || 10000);
  return lock;
}

/**
 * Memoria de la petición actual. En Apps Script cada llamada de google.script.run es una
 * ejecución nueva, así que estas variables viven lo que dura UNA petición: dentro de ella cada
 * tabla se lee de la hoja una sola vez. Toda escritura invalida la tabla afectada.
 */
let MEMO_TABLAS = {};

/** Olvida lo leído. Se llama al empezar cada petición de la API (y entre llamadas en las pruebas). */
function reiniciarMemoria_() {
  MEMO_TABLAS = {};
}

/**
 * Invalida la caché de una o todas las tablas.
 */
function invalidateCache(sheetName) {
  const cache = CacheService.getScriptCache();
  if (sheetName) {
    cache.remove('TABLE_' + sheetName);
    delete MEMO_TABLAS[sheetName];
  } else {
    Object.keys(SCHEMAS).forEach(name => cache.remove('TABLE_' + name));
    MEMO_TABLAS = {};
  }
}

/**
 * Lee una tabla completa desde la caché de catálogos o desde la hoja.
 * Devuelve { filas, fresco }: `fresco` indica que vino de la hoja en esta petición.
 */
function leerTabla_(sheetName, forzar) {
  const isCacheable = TABLAS_CACHEABLES.includes(sheetName);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'TABLE_' + sheetName;

  if (isCacheable && !forzar) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return { filas: JSON.parse(cached), fresco: false }; } catch (e) {}
    }
  }

  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`La tabla "${sheetName}" no existe en la base de datos.`);
  }

  const values = sheet.getDataRange().getValues();
  const filas = [];
  if (values.length > 1) {
    const headers = values[0].map(h => String(h).trim());
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row.every(cell => cell === '' || cell === null)) continue; // fila vacía
      const rowObj = { _rowIndex: i + 1 };
      headers.forEach((header, colIdx) => {
        let cellVal = row[colIdx];
        // Normalizar fechas de Apps Script a formato ISO YYYY-MM-DD
        if (cellVal instanceof Date) cellVal = Utilities.formatDate(cellVal, 'America/Bogota', 'yyyy-MM-dd');
        rowObj[header] = cellVal;
      });
      filas.push(rowObj);
    }
  }

  if (isCacheable) {
    try { cache.put(cacheKey, JSON.stringify(filas), CACHE_TTL_SECONDS); } catch (e) {}
  }
  return { filas: filas, fresco: true };
}

/**
 * Lee una tabla y la retorna como un array de objetos { encabezado: valor } con `_rowIndex`
 * (el número real de fila en la hoja).
 * @param {string} sheetName Nombre de la pestaña.
 * @param {Object} options { excludeAnulados: boolean, forceRefresh: boolean }
 *   forceRefresh lee de la hoja (no de la caché de catálogos) la primera vez en la petición;
 *   las siguientes lecturas de la misma tabla reutilizan esa lectura.
 */
function getTableData(sheetName, options) {
  const opts = options || {};
  let memo = MEMO_TABLAS[sheetName];
  if (!memo || (opts.forceRefresh && !memo.fresco)) {
    memo = leerTabla_(sheetName, !!opts.forceRefresh);
    MEMO_TABLAS[sheetName] = memo;
  }
  // Siempre una copia: quien llama puede ordenar o filtrar sin afectar lo memorizado.
  return opts.excludeAnulados
    ? memo.filas.filter(f => !esVerdadero(f.Anulado))
    : memo.filas.slice();
}

/**
 * Inserta un registro en una tabla con control de bloqueo de concurrencia.
 * @param {string} sheetName Nombre de la pestaña.
 * @param {Object} rowData Objeto con las propiedades a insertar.
 * @returns {Object} El registro insertado con su ID asignado.
 */
function insertRow(sheetName, rowData) {
  const lock = tomarBloqueo(10000);

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const dataToInsert = Object.assign({}, rowData);

    // Asignar ID UUID si la primera columna es un identificador y no viene proporcionado
    const idHeader = headers[0];
    if (idHeader.startsWith('ID') && !dataToInsert[idHeader]) {
      dataToInsert[idHeader] = Utilities.getUuid();
    }

    // Por defecto Anulado = false si la tabla tiene esa columna
    if (headers.includes('Anulado') && dataToInsert.Anulado === undefined) {
      dataToInsert.Anulado = false;
    }
    completarAuditoria_(headers, dataToInsert, ahoraIso_());

    // Convertir objeto a fila según orden de encabezados
    const rowValues = headers.map(header => {
      let val = dataToInsert[header];
      if (val === undefined || val === null) return '';
      return val;
    });

    sheet.appendRow(rowValues);
    invalidateCache(sheetName);

    return dataToInsert;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Inserta múltiples registros en una sola operación atómica.
 */
function insertRows(sheetName, rowsDataArray) {
  return insertRowsBatch(sheetName, rowsDataArray);
}

function insertRowsBatch(sheetName, rowsDataArray) {
  if (!rowsDataArray || rowsDataArray.length === 0) return [];
  const lock = tomarBloqueo(15000);

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idHeader = headers[0];
    const ahora = ahoraIso_();

    const matrix = rowsDataArray.map(rowData => {
      const copy = Object.assign({}, rowData);
      if (idHeader.startsWith('ID') && !copy[idHeader]) {
        copy[idHeader] = Utilities.getUuid();
      }
      if (headers.includes('Anulado') && copy.Anulado === undefined) {
        copy.Anulado = false;
      }
      completarAuditoria_(headers, copy, ahora);
      return headers.map(h => (copy[h] !== undefined && copy[h] !== null) ? copy[h] : '');
    });

    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, matrix.length, headers.length).setValues(matrix);
    invalidateCache(sheetName);

    return rowsDataArray;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza un registro existente buscando por su columna de ID.
 */
function updateRowById(sheetName, idColumnName, idValue, updatesObj) {
  const lock = tomarBloqueo(10000);

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) throw new Error(`Tabla "${sheetName}" vacía.`);

    const headers = values[0].map(h => String(h).trim());
    const idColIdx = headers.indexOf(idColumnName);
    if (idColIdx === -1) throw new Error(`Columna "${idColumnName}" no existe en "${sheetName}".`);

    let targetRowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idColIdx]) === String(idValue)) {
        targetRowIdx = i + 1; // 1-based index de Sheets
        break;
      }
    }

    if (targetRowIdx === -1) {
      throw new Error(`Registro con ${idColumnName} = "${idValue}" no encontrado.`);
    }

    escribirCambiosFila_(sheet, headers, targetRowIdx, updatesObj);

    invalidateCache(sheetName);
    return { ok: true, id: idValue };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza una fila identificada por su número real de fila en la hoja (fila 1 = encabezados).
 * Usar el `_rowIndex` que entrega getTableData; nunca calcularlo a partir de la posición en el arreglo,
 * porque getTableData omite filas vacías y las posiciones dejan de coincidir.
 * @param {string} sheetName Nombre de la pestaña.
 * @param {number} rowNumber Número de fila en la hoja (mínimo 2).
 * @param {Object} updatesObj Campos a modificar; las claves que no son columnas se ignoran.
 */
function updateRow(sheetName, rowNumber, updatesObj) {
  const fila = Number(rowNumber);
  if (!Number.isInteger(fila) || fila < 2) {
    throw new Error(`Número de fila no válido para "${sheetName}": ${rowNumber}.`);
  }

  const lock = tomarBloqueo(10000);

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);
    if (fila > sheet.getLastRow()) {
      throw new Error(`La fila ${fila} no existe en "${sheetName}".`);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    escribirCambiosFila_(sheet, headers, fila, updatesObj);

    invalidateCache(sheetName);
    return { ok: true, fila: fila };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Escribe los cambios de una fila con una sola lectura y una sola escritura.
 * Función interna: quien la llama ya tiene el bloqueo.
 */
function escribirCambiosFila_(sheet, headers, fila, updatesObj) {
  const rango = sheet.getRange(fila, 1, 1, headers.length);
  const fila0 = rango.getValues()[0];
  let hayCambios = false;

  Object.keys(updatesObj || {}).forEach(key => {
    const colIdx = headers.indexOf(key);
    if (colIdx === -1) return;
    const val = updatesObj[key];
    fila0[colIdx] = (val === undefined || val === null) ? '' : val;
    hayCambios = true;
  });

  if (hayCambios) {
    const colAct = headers.indexOf('Actualizado_En');
    if (colAct !== -1) fila0[colAct] = ahoraIso_();
    rango.setValues([fila0]);
  }
}

/** Completa Creado_En / Actualizado_En en un registro nuevo si la tabla los tiene. */
function completarAuditoria_(headers, registro, ahora) {
  if (headers.includes('Creado_En') && !registro.Creado_En) registro.Creado_En = ahora;
  if (headers.includes('Actualizado_En')) registro.Actualizado_En = ahora;
}

/**
 * Elimina físicamente una fila por su número real. Solo para tablas de trabajo
 * (plantillas, renglones de presupuesto); los datos contables se anulan, no se borran.
 */
function deleteRow(sheetName, rowNumber) {
  const fila = Number(rowNumber);
  if (!Number.isInteger(fila) || fila < 2) {
    throw new Error(`Número de fila no válido para "${sheetName}": ${rowNumber}.`);
  }

  const lock = tomarBloqueo(10000);

  try {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);
    if (fila > sheet.getLastRow()) {
      throw new Error(`La fila ${fila} no existe en "${sheetName}".`);
    }
    sheet.deleteRow(fila);
    invalidateCache(sheetName);
    return { ok: true, fila: fila };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Borrado lógico: establece la columna 'Anulado' en true.
 */
function softDeleteById(sheetName, idColumnName, idValue) {
  return updateRowById(sheetName, idColumnName, idValue, { Anulado: true });
}
