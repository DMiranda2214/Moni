/**
 * Code.gs — Moni
 * Controlador principal y enrutador de Google Apps Script.
 * Sirve la Single Page Application (SPA), gestiona la inclusión modular de HTML/CSS/JS
 * y añade el menú de administración en Google Sheets.
 */

/**
 * Punto de entrada HTTP GET para la Aplicación Web.
 */
function doGet(e) {
  if (!accesoPermitido_()) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<body style="font-family:-apple-system,sans-serif;padding:32px;text-align:center">' +
      '<h1 style="font-size:22px">Sin acceso</h1>' +
      '<p>Esta cuenta no está autorizada para usar Moni.</p></body>'
    ).setTitle('Moni — Sin acceso');
  }

  const template = HtmlService.createTemplateFromFile('index');

  return template.evaluate()
    .setTitle('Moni')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover') // sin bloquear el zoom (accesibilidad)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Control de acceso de un solo usuario.
 * La web app corre con la cuenta de quien entra (USER_ACCESSING), así que el Sheet ya exige
 * permiso de edición. Esta lista añade una segunda barrera: si la propiedad de script
 * USUARIOS_PERMITIDOS existe (correos separados por coma), solo esos correos entran.
 * Si no existe, no se restringe (útil durante el desarrollo).
 */
function accesoPermitido_() {
  const lista = PropertiesService.getScriptProperties().getProperty('USUARIOS_PERMITIDOS');
  if (!lista) return true;

  const permitidos = lista.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length === 0) return true;

  const correo = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  return correo !== '' && permitidos.indexOf(correo) !== -1;
}

/**
 * Función auxiliar para incluir archivos modulares (CSS, JS) en templates HTML.
 * Uso en templates: <?!= include('css'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Menú contextual superior al abrir el Google Sheet para mantenimiento y acceso rápido.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Moni')
    .addItem('Instalar o verificar la base de datos', 'menuSetupDatabase')
    .addItem('Limpiar la caché', 'menuClearCache')
    .addSeparator()
    .addItem('Crear un respaldo en Drive', 'menuCreateBackup')
    .addItem('Activar copias automáticas', 'menuAutoBackup')
    .addSeparator()
    .addItem('Instalar hojas de consulta (saldos y vista anual)', 'menuInstalarVistas')
    .addToUi();
}

function menuSetupDatabase() {
  const res = setupDatabase();
  const detalle = res.ok
    ? 'Base de datos lista (' + res.tablas + ' tablas; ' + res.creadas.length + ' creadas).'
    : 'Hay ' + res.diferencias.length + ' tabla(s) con encabezados distintos a los esperados. No se modificaron: revísalas en Diagnóstico.';
  SpreadsheetApp.getUi().alert('Resultado', detalle, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuClearCache() {
  invalidateCache();
  SpreadsheetApp.getUi().alert('Caché', 'Caché de catálogos invalidada correctamente.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuCreateBackup() {
  const r = crearRespaldo();
  SpreadsheetApp.getUi().alert('Respaldo creado', 'Copia guardada en Drive: ' + r.nombre + (r.eliminados ? '\n(' + r.eliminados + ' copia(s) antigua(s) a la papelera)' : ''), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuAutoBackup() {
  const e = configurarRespaldoAutomatico(true);
  SpreadsheetApp.getUi().alert('Copias automáticas', 'Activadas: una copia cada ' + e.frecuenciaDias + ' día(s), conservando las últimas ' + e.copiasMaximas + '.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuInstalarVistas() {
  const r = instalarVistas();
  SpreadsheetApp.getUi().alert('Hojas de consulta', 'Listas: ' + r.hojas.join(', ') + '. Se calculan solas; cambia el año en Vista_Anual!B1.', SpreadsheetApp.getUi().ButtonSet.OK);
}
