/**
 * Repo.gs — Moni
 * Capa de abstracción de datos para Google Sheets.
 * Implementa lectura/escritura por lotes (batch operations), control de concurrencia
 * mediante LockService y optimización de rendimiento con CacheService.
 */

const CACHE_TTL_SECONDS = 3600; // catálogos: 1 h (toda escritura de la app los invalida; "Actualizar desde la hoja" fuerza la relectura)
const CACHE_TTL_MOVIMIENTOS = 600; // tablas de movimientos: 10 min

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
  const id = idHojaUsuario_();
  if (id) {
    // Abrir el libro cuesta una llamada a Google: se hace una vez por petición, no una por lectura o escritura.
    if (MEMO_LIBRO && MEMO_LIBRO.id === id) return MEMO_LIBRO.ss;
    const ss = SpreadsheetApp.openById(id);
    MEMO_LIBRO = { id: id, ss: ss };
    return ss;
  }
  // En modo multiusuario cada persona tiene su propia hoja: no se usa la hoja a la que está unido el script.
  if (modoMultiusuario_()) {
    throw new Error('Todavía no tienes tu hoja de Moni. Crea una desde la pantalla de bienvenida.');
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error("No se ha configurado la hoja de cálculo. Por favor ejecute vincularHojaMoni() o configure SPREADSHEET_ID en las propiedades del proyecto.");
}

/**
 * ¿Se pueden crear datos de demostración en este despliegue? Solo si la propiedad de script DEMO_HABILITADO = TRUE,
 * que se pone en el proyecto de DESARROLLO y en ningún otro. Además, el paquete de producción ni siquiera incluye
 * el generador (scripts/publicar.sh lo reemplaza por un archivo vacío): son dos candados.
 */
function demoHabilitado_() {
  return PropertiesService.getScriptProperties().getProperty('DEMO_HABILITADO') === 'TRUE';
}

// ---------------------------------------------------------------------------
// Modo de uso: una sola hoja (una persona o una pareja) o una hoja por usuario (varias personas)
// ---------------------------------------------------------------------------

/**
 * Con MODO_MULTIUSUARIO = TRUE en las propiedades del script, la misma aplicación la usan varias personas y
 * cada una tiene su propia hoja, su propia caché, su propio bloqueo y sus propios activadores. Sin la
 * propiedad, todo es del script (una sola hoja, la compartida), como siempre.
 */
function modoMultiusuario_() {
  return PropertiesService.getScriptProperties().getProperty('MODO_MULTIUSUARIO') === 'TRUE';
}

/** Propiedades donde se guarda el ID de la hoja y las marcas de respaldo: de la persona o del script. */
function propiedades_() {
  return modoMultiusuario_() ? PropertiesService.getUserProperties() : PropertiesService.getScriptProperties();
}

/** Caché: en modo multiusuario es de la persona (nunca se mezclan datos de dos personas). */
function cache_() {
  return modoMultiusuario_() ? CacheService.getUserCache() : CacheService.getScriptCache();
}

/** El ID de la hoja de esta persona (o del script), o '' si todavía no hay. */
function idHojaUsuario_() {
  return propiedades_().getProperty('SPREADSHEET_ID') || '';
}

/**
 * Toma el bloqueo (un solo escritor a la vez).
 * Una hoja: es del script y protege también de dos personas que comparten la hoja.
 * Varias hojas: es de la persona, para que unas no esperen a otras.
 * No es reentrante: ninguna función que lo tenga puede llamar a otra que también lo tome.
 */
function tomarBloqueo(ms) {
  const lock = modoMultiusuario_() ? LockService.getUserLock() : LockService.getScriptLock();
  lock.waitLock(ms || 10000);
  return lock;
}

/**
 * Memoria de la petición actual. En Apps Script cada llamada de google.script.run es una
 * ejecución nueva, así que estas variables viven lo que dura UNA petición: dentro de ella cada
 * tabla se lee de la hoja una sola vez. Toda escritura invalida la tabla afectada.
 */
let MEMO_TABLAS = {};
let MEMO_LIBRO = null;

/** Olvida lo leído. Se llama al empezar cada petición de la API (y entre llamadas en las pruebas). */
function reiniciarMemoria_() {
  MEMO_TABLAS = {};
  MEMO_LIBRO = null;
}

/**
 * Invalida la caché de una o todas las tablas.
 */
function invalidateCache(sheetName) {
  const cache = cache_();
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
  const cache = cache_();

  if (!forzar) {
    const guardada = leerDeCache_(cache, sheetName);
    if (guardada) return { filas: guardada, fresco: false };
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

  guardarEnCache_(cache, sheetName, filas);
  return { filas: filas, fresco: true };
}

/**
 * Caché por tabla, partida en trozos (cada valor de CacheService admite ~100 KB). La clave "TABLE_x" guarda
 * un sello y cuántos trozos hay; los trozos llevan ese sello, así que nunca se mezclan trozos de dos escrituras.
 * Invalidar es borrar solo la clave principal. Las tablas de movimientos duran menos que los catálogos.
 */
const TROZO_CACHE = 40000;

function leerDeCache_(cache, tabla) {
  const meta = cache.get('TABLE_' + tabla);
  if (!meta) return null;
  const p = String(meta).split('|');
  const n = Number(p[1]);
  if (p.length !== 2 || !isFinite(n) || n < 1) return null;
  const claves = [];
  for (let i = 0; i < n; i++) claves.push('TABLE_' + tabla + '_' + p[0] + '_' + i);
  const trozos = cache.getAll(claves);
  let texto = '';
  for (let i = 0; i < n; i++) {
    const t = trozos[claves[i]];
    if (t === undefined || t === null) return null;
    texto += t;
  }
  try { return JSON.parse(texto); } catch (e) { return null; }
}

/**
 * Trae de la caché, en DOS llamadas en total (una por los sellos y otra por todos los trozos), las tablas pedidas
 * y las deja en la memoria de la petición. Las que no estén en caché se leen de la hoja cuando se necesiten.
 */
function precargarTablas_(nombres) {
  const cache = cache_();
  const pendientes = nombres.filter(t => !MEMO_TABLAS[t] && SCHEMAS[t]);
  if (!pendientes.length) return;
  const metas = cache.getAll(pendientes.map(t => 'TABLE_' + t));
  const claves = [];
  const plan = {};
  pendientes.forEach(t => {
    const m = metas['TABLE_' + t];
    if (!m) return;
    const p = String(m).split('|');
    const n = Number(p[1]);
    if (p.length !== 2 || !isFinite(n) || n < 1) return;
    plan[t] = [];
    for (let i = 0; i < n; i++) { const k = 'TABLE_' + t + '_' + p[0] + '_' + i; plan[t].push(k); claves.push(k); }
  });
  if (!claves.length) return;
  const trozos = cache.getAll(claves);
  Object.keys(plan).forEach(t => {
    let texto = '';
    for (let i = 0; i < plan[t].length; i++) {
      const x = trozos[plan[t][i]];
      if (x === undefined || x === null) return;
      texto += x;
    }
    try { MEMO_TABLAS[t] = { filas: JSON.parse(texto), fresco: false }; } catch (e) {}
  });
}

function guardarEnCache_(cache, tabla, filas) {
  try {
    const texto = JSON.stringify(filas);
    const sello = Utilities.getUuid().slice(0, 8);
    const n = Math.max(1, Math.ceil(texto.length / TROZO_CACHE));
    if (n > 20) return; // una tabla enorme se lee siempre de la hoja
    const ttl = TABLAS_CACHEABLES.includes(tabla) ? CACHE_TTL_SECONDS : CACHE_TTL_MOVIMIENTOS;
    const valores = {};
    for (let i = 0; i < n; i++) valores['TABLE_' + tabla + '_' + sello + '_' + i] = texto.slice(i * TROZO_CACHE, (i + 1) * TROZO_CACHE);
    cache.putAll(valores, ttl);
    cache.put('TABLE_' + tabla, sello + '|' + n, ttl);
  } catch (e) {}
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
 * Elimina varias filas de una tabla de trabajo de una vez (por número real de fila). Agrupa las filas seguidas para
 * hacer pocas llamadas a Google. Solo para datos derivados que se recalculan por completo (el cronograma de un crédito).
 */
function deleteRows(sheetName, rowNumbers) {
  const filas = Array.from(new Set((rowNumbers || []).map(Number))).sort((a, b) => b - a);
  if (!filas.length) return { ok: true, eliminadas: 0 };
  if (filas.some(f => !Number.isInteger(f) || f < 2)) throw new Error(`Número de fila no válido para "${sheetName}".`);

  const lock = tomarBloqueo(10000);
  try {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`Tabla "${sheetName}" no encontrada.`);
    if (filas[0] > sheet.getLastRow()) throw new Error(`La fila ${filas[0]} no existe en "${sheetName}".`);
    // De abajo hacia arriba, para que borrar un tramo no mueva los números de los que faltan.
    let fin = filas[0], inicio = filas[0];
    for (let i = 1; i <= filas.length; i++) {
      if (i < filas.length && filas[i] === inicio - 1) { inicio = filas[i]; continue; }
      sheet.deleteRows(inicio, fin - inicio + 1);
      if (i < filas.length) { fin = filas[i]; inicio = filas[i]; }
    }
    invalidateCache(sheetName);
    return { ok: true, eliminadas: filas.length };
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
