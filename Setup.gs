/**
 * Setup.gs — Moni
 * Esquema de la base de datos (27 tablas, ver docs/ESQUEMA.md) e instalación idempotente.
 * Toda tabla termina con Creado_En y Actualizado_En; Repo.gs los completa solo.
 */

const COL_AUDITORIA = ['Creado_En', 'Actualizado_En'];

/** Divisas que admite un banco. COP es la divisa de la app: presupuesto, nómina, tarjetas y créditos solo la usan a ella. */
const DIVISAS = ['COP', 'USD', 'EUR'];
const DIVISA_BASE = 'COP';

/**
 * Versión del esquema. Súbela cuando cambie una tabla: la comprobación "todo está listo" se recuerda
 * 6 horas (caché) y la versión evita que esa memoria tape un cambio recién desplegado.
 */
const ESQUEMA_VERSION = '3';

/** Define una tabla: encabezados propios + auditoría. `anchos` cubre solo las columnas propias. */
function tabla_(headers, anchos) {
  return {
    headers: headers.concat(COL_AUDITORIA),
    widths: anchos.concat([150, 150])
  };
}

const SCHEMAS = {
  // ---- Configuración ----
  Config: tabla_(['Clave', 'Valor', 'Grupo', 'Tipo', 'Descripcion'], [200, 240, 110, 100, 360]),
  Bancos: tabla_(['ID_Banco', 'Nombre', 'Color', 'Icono', 'Activo', 'Orden', 'Divisa'], [170, 200, 90, 90, 70, 60, 80]),
  Cuentas: tabla_(
    ['ID_Cuenta', 'ID_Banco', 'Nombre', 'Tipo', 'Permite_Bolsillos', 'Fecha_Apertura', 'Saldo_Real', 'Fecha_Saldo_Real', 'Meta', 'Activo', 'Orden'],
    [170, 170, 200, 100, 130, 120, 120, 130, 110, 70, 60]),
  Bolsillos: tabla_(
    ['ID_Bolsillo', 'ID_Cuenta', 'Nombre', 'Rol', 'Saldo_Apertura', 'Es_Interno', 'Color', 'Icono', 'Activo', 'Orden'],
    [170, 170, 200, 130, 130, 90, 90, 90, 70, 60]),
  Tarjetas: tabla_(
    ['ID_Tarjeta', 'ID_Banco', 'Nombre', 'Cupo', 'Dia_Corte', 'Dia_Pago', 'ID_Bolsillo_Reserva', 'ID_Bolsillo_Personal', 'Color', 'Activo', 'Orden'],
    [170, 170, 200, 120, 90, 90, 170, 170, 90, 70, 60]),
  Categorias: tabla_(['ID_Categoria', 'Nombre', 'Tipo', 'Icono', 'Color', 'Activo', 'Orden'], [170, 220, 120, 90, 90, 70, 60]),
  Personas: tabla_(['ID_Persona', 'Nombre', 'Rol', 'Activo'], [170, 220, 110, 70]),
  Inmuebles: tabla_(['ID_Inmueble', 'Nombre', 'Activo', 'Orden'], [170, 220, 70, 60]),
  Servicios_Publicos: tabla_(
    ['ID_Servicio', 'ID_Inmueble', 'Tipo', 'Empresa', 'Codigo_Pago', 'URL_Pago', 'Notas', 'Activo'],
    [170, 170, 110, 180, 150, 260, 200, 70]),
  Suscripciones: tabla_(
    ['ID_Suscripcion', 'Nombre', 'Tipo', 'Valor', 'Periodicidad', 'Proximo_Cobro', 'Dia_Cobro', 'ID_Bolsillo', 'ID_Tarjeta', 'ID_Categoria', 'ID_Servicio', 'Renglon', 'URL_Pago', 'Ultimo_Pago', 'Notas', 'Activo', 'Orden'],
    [170, 220, 110, 120, 110, 120, 80, 170, 170, 170, 170, 200, 260, 120, 220, 70, 60]),
  Escenarios: tabla_(['ID_Escenario', 'Nombre', 'Es_Base', 'Descripcion', 'Activo'], [170, 200, 80, 300, 70]),

  // ---- Operación ----
  Movimientos: tabla_(
    ['ID_Mov', 'Fecha', 'Concepto', 'ID_Bolsillo', 'Valor', 'Tipo_Mov', 'Subtipo', 'ID_Categoria', 'ID_Grupo', 'ID_Item_Ppto', 'Notas', 'Origen', 'Anulado'],
    [170, 110, 260, 170, 120, 110, 110, 170, 170, 170, 220, 80, 80]),
  Compras_TC: tabla_(
    ['ID_Compra', 'Fecha', 'Concepto', 'Valor', 'ID_Tarjeta', 'Mes_Extracto', 'Fuente', 'ID_Categoria', 'ID_Item_Ppto', 'ID_Extracto', 'Pagado', 'ID_Mov_Reserva', 'Notas', 'Origen', 'Anulado'],
    [170, 110, 260, 120, 170, 110, 90, 170, 170, 170, 70, 170, 220, 80, 80]),
  Extractos: tabla_(
    ['ID_Extracto', 'ID_Tarjeta', 'Mes', 'Total', 'Estado', 'Fecha_Pago', 'ID_Grupo_Pago', 'URL_PDF', 'Notas', 'Anulado'],
    [170, 170, 90, 120, 90, 110, 170, 260, 200, 80]),
  Presupuesto_Plantilla: tabla_(
    ['ID_Plantilla', 'ID_Escenario', 'Concepto', 'Monto_Plan', 'Tipo', 'ID_Bolsillo_Destino', 'ID_Categoria', 'ID_Credito', 'ID_Tarjeta', 'Activo', 'Orden'],
    [170, 170, 240, 120, 90, 170, 170, 170, 170, 70, 60]),
  Presupuesto_Mes: tabla_(
    ['ID_Item', 'Mes', 'ID_Escenario', 'ID_Plantilla', 'Concepto', 'Tipo', 'Plan', 'Pagado', 'ID_Bolsillo_Destino', 'ID_Credito', 'ID_Tarjeta', 'Notas'],
    [170, 90, 170, 170, 240, 90, 120, 70, 170, 170, 170, 220]),

  // ---- Nómina (una vez al mes) ----
  Subsidios: tabla_(['ID_Subsidio', 'Nombre', 'Valor', 'Es_Salarial', 'Vigente_Desde', 'Vigente_Hasta', 'Activo'], [170, 260, 120, 100, 120, 120, 70]),
  Nomina_Escenarios: tabla_(['ID_Nomina_Esc', 'Nombre', 'Sueldo_Base', 'Vigente', 'Activo'], [170, 240, 130, 80, 70]),
  Nomina_Conceptos: tabla_(
    ['ID_Concepto', 'ID_Nomina_Esc', 'Tipo', 'Concepto', 'Activo', 'Tipo_Calculo', 'Dias', 'Porcentaje', 'Valor_Fijo', 'ID_Subsidio'],
    [170, 170, 100, 220, 70, 140, 70, 90, 120, 170]),
  Nomina_Pagos: tabla_(
    ['ID_Nomina', 'Periodo', 'ID_Nomina_Esc', 'Estado', 'Devengado', 'Deducciones', 'Extras', 'Neto_Estimado', 'Neto_Real', 'Fecha_Pago', 'ID_Bolsillo_Destino', 'ID_Mov', 'Notas', 'Origen', 'Anulado'],
    [170, 90, 170, 100, 120, 120, 110, 130, 130, 110, 170, 170, 200, 80, 80]),
  Nomina_Pagos_Detalle: tabla_(['ID_Detalle', 'ID_Nomina', 'Tipo', 'Concepto', 'Valor'], [170, 170, 100, 240, 120]),

  // ---- Créditos (autopago) ----
  Creditos: tabla_(
    ['ID_Credito', 'Nombre', 'ID_Persona', 'ID_Cuenta_Ahorro', 'ID_Bolsillo_Pago', 'Fecha_Inicio', 'Monto', 'Tasa_Periodica', 'Periodicidad', 'Num_Periodos', 'Cuota_Fija', 'Metodo_Tasa', 'Estado', 'Notas'],
    [170, 200, 170, 170, 170, 110, 120, 110, 100, 100, 120, 100, 90, 200]),
  Creditos_Cronograma: tabla_(
    ['ID_Cuota', 'ID_Credito', 'Version', 'Num', 'Fecha_Prevista', 'Saldo_Inicial', 'Cuota', 'Interes', 'Capital', 'Saldo_Final', 'Estado'],
    [170, 170, 70, 60, 110, 120, 110, 110, 110, 120, 100]),
  Creditos_Pagos: tabla_(
    ['ID_Pago', 'ID_Credito', 'Fecha', 'Num_Cuota', 'Valor_Pagado', 'Interes', 'Capital_Cuota', 'Abono_Extra', 'Saldo_Despues', 'Version', 'ID_Grupo', 'Anulado'],
    [170, 170, 110, 90, 120, 110, 120, 110, 130, 70, 170, 80]),

  // ---- Otros ----
  Regalos: tabla_(['ID_Regalo', 'Anio', 'ID_Persona', 'Idea', 'Estimado', 'Real', 'Aplica', 'ID_Mov', 'Notas'], [170, 70, 170, 220, 120, 120, 70, 170, 200]),
  Reportes: tabla_(['ID_Reporte', 'Tipo', 'Mes', 'ID_Tarjeta', 'URL_Drive'], [170, 120, 90, 170, 320]),
  Log: tabla_(['ID_Log', 'Fecha_Hora', 'Nivel', 'Funcion', 'Mensaje', 'Detalle'], [170, 160, 80, 180, 300, 400])
};

/** Listas cerradas. Las usan la validación del Sheet y los servicios de catálogo. */
const ENUMS = {
  Bancos: { Divisa: DIVISAS },
  Cuentas: { Tipo: ['Billetera', 'Debito', 'Ahorro', 'Otra'] },
  Bolsillos: { Rol: ['Operativo', 'Reserva_Tarjeta', 'Fondo', 'General'] },
  Categorias: { Tipo: ['Gasto', 'Ingreso', 'Transferencia', 'Ajuste'] },
  Personas: { Rol: ['Titular', 'Familiar', 'Otro'] },
  Movimientos: {
    Tipo_Mov: ['Gasto', 'Ingreso', 'Transferencia', 'Ajuste'],
    Subtipo: ['', 'Para_Gastos', 'Reposicion', 'Interes', 'Retencion', 'GMF', 'Pago_TC', 'Reserva_TC', 'Pago_Cuota', 'Nomina', 'Distribucion', 'Conversion', 'Comision'],
    Origen: ['App', 'Demo', 'Import']
  },
  Compras_TC: { Fuente: ['Personal', 'Ppto', 'Guardar', 'Otro'], Origen: ['App', 'Demo', 'Import'] },
  Extractos: { Estado: ['Abierto', 'Pagado'] },
  Presupuesto_Plantilla: { Tipo: ['Gasto', 'Cuota', 'Ahorro', 'Fondo'] },
  Presupuesto_Mes: { Tipo: ['Gasto', 'Cuota', 'Ahorro', 'Fondo'] },
  Nomina_Pagos: { Estado: ['Proyectado', 'Recibido'], Origen: ['App', 'Demo', 'Import'] },
  Creditos: { Periodicidad: ['Quincenal', 'Mensual'], Metodo_Tasa: ['Excel', 'Exacta'], Estado: ['Activo', 'Pagado', 'Anulado'] },
  Creditos_Cronograma: { Estado: ['Pendiente', 'Pagada', 'Reemplazada'] },
  Suscripciones: { Tipo: ['Suscripcion', 'Servicio'], Periodicidad: ['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'] },
  Log: { Nivel: ['Info', 'Aviso', 'Error'] }
};

/**
 * Columnas que deben guardarse como texto plano. Sin esto Sheets las "interpreta":
 * "2027-01" pasa a ser una fecha, "02-14" también, "00123" pierde los ceros, y las fechas
 * AAAA-MM-DD se vuelven fechas reales que dependen de la zona horaria de la hoja (podrían
 * correrse un día). Como texto, lo que se guarda es exactamente lo que se lee.
 * Creado_En y Actualizado_En se tratan igual en todas las tablas.
 */
const COLUMNAS_TEXTO = {
  Config: ['Valor'],
  Cuentas: ['Fecha_Apertura', 'Fecha_Saldo_Real'],
  Servicios_Publicos: ['Codigo_Pago'],
  Suscripciones: ['Proximo_Cobro', 'Ultimo_Pago'],
  Movimientos: ['Fecha'],
  Compras_TC: ['Fecha', 'Mes_Extracto'],
  Extractos: ['Mes', 'Fecha_Pago'],
  Presupuesto_Mes: ['Mes'],
  Subsidios: ['Vigente_Desde', 'Vigente_Hasta'],
  Nomina_Pagos: ['Periodo', 'Fecha_Pago'],
  Creditos: ['Fecha_Inicio'],
  Creditos_Cronograma: ['Fecha_Prevista'],
  Creditos_Pagos: ['Fecha'],
  Reportes: ['Mes']
};

/** Parámetros por defecto: [Clave, Valor, Grupo, Tipo, Descripcion]. */
const DEFAULT_CONFIG = [
  ['Nombre_Usuario', '', 'General', 'texto', 'Nombre con el que la app te saluda'],
  ['Anio_Activo', '2027', 'General', 'numero', 'Año de operación activo'],
  ['Zona_Horaria', 'America/Bogota', 'General', 'texto', 'Zona horaria para cálculos de fechas'],
  ['Moneda', 'COP', 'General', 'texto', 'Código de moneda (ISO 4217)'],
  ['Tema', 'Automatico', 'Apariencia', 'seleccion', 'Claro, Oscuro o Automatico (sigue al dispositivo)'],
  ['Color_Acento', 'rosa', 'Apariencia', 'seleccion', 'Color de acento de la interfaz'],
  ['Datos_Demo', 'FALSE', 'Sistema', 'booleano', 'TRUE mientras existan datos de demostración'],
  ['Fecha_Arranque', '2027-01-01', 'Sistema', 'texto', 'Primer día de operación real; antes de esa fecha todo es prueba'],
  ['Arranque_Hecho', 'FALSE', 'Sistema', 'booleano', 'TRUE cuando ya empezó la operación real'],
  ['Carpeta_PDF', 'Moni/Extractos', 'General', 'texto', 'Ruta de Google Drive para extractos en PDF'],
  ['Respaldo_Frecuencia_Dias', '7', 'Respaldos', 'numero', 'Frecuencia de copia en días'],
  ['Respaldo_Copias', '8', 'Respaldos', 'numero', 'Número de copias retenidas'],
  ['Nomina_Periodicidad', 'Mensual', 'Nomina', 'seleccion', 'La nómina se paga una vez al mes'],
  ['Nomina_Dia_Pago', '30', 'Nomina', 'numero', 'Día estimado de pago del salario'],
  ['Dias_Base', '30', 'Nomina', 'numero', 'Días comerciales por mes para nómina'],
  ['Aporte_Salud', '0.04', 'Nomina', 'porcentaje', 'Porcentaje de aporte a salud del trabajador'],
  ['Aporte_Pension', '0.04', 'Nomina', 'porcentaje', 'Porcentaje de aporte a pensión del trabajador'],
  ['Redondeo_Aportes', '-2', 'Nomina', 'numero', 'Redondeo de aportes (-2 = centena superior)'],
  ['SMMLV', '1423500', 'Nomina', 'moneda', 'Salario mínimo mensual legal vigente. Actualizar cada enero'],
  ['SMMLV_Anio', '2025', 'Nomina', 'numero', 'Año del SMMLV registrado'],
  ['FSP_Umbral_SMMLV', '4', 'Nomina', 'numero', 'Umbral de SMMLV para el Fondo de Solidaridad Pensional'],
  ['Auxilio_Transporte_Aplica', 'FALSE', 'Nomina', 'booleano', 'Aplica auxilio de transporte legal'],
  ['Prima_Fechas', '06-30,12-20', 'Nomina', 'texto', 'Fechas límite de pago de prima'],
  ['Cesantias_Fecha_Consignacion', '02-14', 'Nomina', 'texto', 'Fecha máxima de consignación al fondo'],
  ['Intereses_Cesantias_Fecha', '01-31', 'Nomina', 'texto', 'Fecha máxima de pago de intereses de cesantías'],
  ['Tasa_Interes_Cesantias', '0.12', 'Nomina', 'porcentaje', 'Tasa legal de intereses de cesantías'],
  ['Credito_Metodo_Tasa', 'Excel', 'Creditos', 'seleccion', 'Conversión de tasa EA a periódica: Excel o Exacta'],
  ['Tasa_USD', '', 'Divisas', 'texto', 'Pesos que vale 1 dólar (TRM que tú escribes). Sirve para ver el equivalente en pesos'],
  ['Tasa_USD_Fecha', '', 'Divisas', 'texto', 'Fecha en que anotaste la tasa del dólar'],
  ['Tasa_EUR', '', 'Divisas', 'texto', 'Pesos que vale 1 euro'],
  ['Tasa_EUR_Fecha', '', 'Divisas', 'texto', 'Fecha en que anotaste la tasa del euro'],
  ['Tasa_USD_Fuente', '', 'Divisas', 'texto', 'De dónde salió la tasa del dólar: Manual o Google Finance'],
  ['Tasa_EUR_Fuente', '', 'Divisas', 'texto', 'De dónde salió la tasa del euro: Manual o Google Finance'],
  ['Tasa_Auto', 'FALSE', 'Divisas', 'booleano', 'TRUE si la tasa se actualiza sola cada día con Google Finance'],
  ['Recordatorios_Activos', 'FALSE', 'Recordatorios', 'booleano', 'TRUE si los pagos se anotan en Google Calendar'],
  ['Recordatorios_Dias_Antes', '2', 'Recordatorios', 'numero', 'Días de anticipación del aviso (además del aviso del mismo día)'],
  ['Recordatorios_Hora', '9', 'Recordatorios', 'numero', 'Hora del día en que suenan los avisos'],
  ['Recordatorios_Nomina', 'TRUE', 'Recordatorios', 'booleano', 'Incluir las fechas de prima y cesantías'],
  ['Calendario_ID', '', 'Recordatorios', 'texto', 'Calendario de Google que crea la app'],
  ['Recordatorios_Ultima', '', 'Recordatorios', 'texto', 'Fecha y hora de la última sincronización'],
  ['Recordatorios_Resumen', '', 'Recordatorios', 'texto', 'Resultado de la última sincronización']
];

/** Categorías iniciales (editables): [ID, Nombre, Tipo, Icono, Color, Activo, Orden]. */
const DEFAULT_CATEGORIAS = [
  ['cat-mercado', 'Mercado', 'Gasto', 'carrito', '', true, 1],
  ['cat-servicios', 'Servicios públicos', 'Gasto', 'rayo', '', true, 2],
  ['cat-transporte', 'Transporte', 'Gasto', 'auto', '', true, 3],
  ['cat-salud', 'Salud y farmacia', 'Gasto', 'corazon', '', true, 4],
  ['cat-suscrip', 'Suscripciones', 'Gasto', 'pantalla', '', true, 5],
  ['cat-hogar', 'Arriendo y hogar', 'Gasto', 'casa', '', true, 6],
  ['cat-salidas', 'Salidas y restaurantes', 'Gasto', 'cubiertos', '', true, 7],
  ['cat-familia', 'Apoyo familiar', 'Gasto', 'personas', '', true, 8],
  ['cat-cuota', 'Cuota de crédito', 'Gasto', 'tarjeta', '', true, 9],
  ['cat-regalos', 'Regalos', 'Gasto', 'regalo', '', true, 10],
  ['cat-salario', 'Salario / nómina', 'Ingreso', 'billete', '', true, 11],
  ['cat-extra', 'Ingreso extra', 'Ingreso', 'mas', '', true, 12],
  ['cat-rendim', 'Rendimientos', 'Ingreso', 'grafico', '', true, 13],
  ['cat-transfer', 'Transferencia', 'Transferencia', 'flechas', '', true, 14],
  ['cat-ajuste', 'Ajuste contable', 'Ajuste', 'ajuste', '', true, 15]
];

/** Escenario inicial: [ID, Nombre, Es_Base, Descripcion, Activo]. */
const DEFAULT_ESCENARIOS = [
  ['esc-normal', 'Normal', true, 'Presupuesto habitual', true]
];

/** Fecha y hora actual en ISO local (para Creado_En / Actualizado_En). */
function ahoraIso_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Compara los encabezados reales de cada pestaña con los del esquema.
 * No modifica nada. Devuelve { faltantes: [tablas], diferencias: [{tabla, esperado, actual}] }.
 */
function verificarEsquema(spreadsheet, opciones) {
  // Verificar son 26 lecturas de hoja. Con usarCache, un resultado correcto se recuerda 6 horas;
  // setupDatabase lo olvida. Solo se guardan los resultados "listo", nunca los fallos.
  const cache = CacheService.getScriptCache();
  if (opciones && opciones.usarCache && cache.get('ESQUEMA_OK') === ESQUEMA_VERSION) {
    return { faltantes: [], diferencias: [], listo: true, desdeCache: true };
  }

  const ss = spreadsheet || getSpreadsheet();
  const faltantes = [];
  const diferencias = [];

  Object.keys(SCHEMAS).forEach(nombre => {
    const sheet = ss.getSheetByName(nombre);
    if (!sheet) { faltantes.push(nombre); return; }
    const esperado = SCHEMAS[nombre].headers;
    const actual = sheet.getLastRow() === 0
      ? []
      : sheet.getRange(1, 1, 1, esperado.length).getValues()[0].map(h => String(h).trim());
    if (esperado.join('|') !== actual.join('|')) {
      diferencias.push({ tabla: nombre, esperado: esperado, actual: actual });
    }
  });

  const listo = faltantes.length === 0 && diferencias.length === 0;
  if (listo) { try { cache.put('ESQUEMA_OK', ESQUEMA_VERSION, 21600); } catch (e) {} }
  return { faltantes: faltantes, diferencias: diferencias, listo: listo };
}

/**
 * Columnas agregadas después de la primera versión. Si una pestaña ya existe sin la columna (y todo lo
 * demás coincide con el esquema), se inserta en su lugar con un valor por defecto para las filas que ya hay.
 * Una pestaña con otras diferencias no se toca: se reporta en el diagnóstico.
 */
const MIGRACIONES_COLUMNAS = [
  { tabla: 'Bancos', columna: 'Divisa', valor: DIVISA_BASE },
  { tabla: 'Presupuesto_Plantilla', columna: 'ID_Tarjeta', valor: '' },
  { tabla: 'Presupuesto_Mes', columna: 'ID_Tarjeta', valor: '' },
  { tabla: 'Suscripciones', columna: 'Renglon', valor: '' }
];

function migrarColumnas_(ss) {
  const migradas = [];
  MIGRACIONES_COLUMNAS.forEach(mg => {
    const sheet = ss.getSheetByName(mg.tabla);
    if (!sheet || sheet.getLastRow() === 0) return;
    const esperado = SCHEMAS[mg.tabla].headers;
    const sinColumna = esperado.filter(h => h !== mg.columna);
    const actual = sheet.getRange(1, 1, 1, sinColumna.length).getValues()[0].map(h => String(h).trim());
    const yaTiene = sheet.getRange(1, 1, 1, esperado.length).getValues()[0].map(h => String(h).trim()).join('|') === esperado.join('|');
    if (yaTiene || actual.join('|') !== sinColumna.join('|')) return;

    const col = esperado.indexOf(mg.columna) + 1;
    sheet.insertColumnBefore(col);
    sheet.getRange(1, col).setValue(mg.columna);
    const filas = sheet.getLastRow() - 1;
    if (filas > 0) sheet.getRange(2, col, filas, 1).setValues(Array.from({ length: filas }, () => [mg.valor]));
    // Aspecto igual al de las demás columnas (si algo de esto falla, los datos ya quedaron bien)
    try {
      sheet.getRange(1, col - 1).copyTo(sheet.getRange(1, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sheet.setColumnWidth(col, SCHEMAS[mg.tabla].widths[col - 1]);
      if (ENUMS[mg.tabla] && ENUMS[mg.tabla][mg.columna]) {
        sheet.getRange(2, col, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ENUMS[mg.tabla][mg.columna], true).setAllowInvalid(true).build());
      }
    } catch (e) {}
    migradas.push(mg.tabla + '.' + mg.columna);
  });
  return migradas;
}

/**
 * Instala la base de datos. Idempotente: crea lo que falta y nunca borra ni sobrescribe datos.
 * Si una pestaña existe con encabezados distintos, no la toca y la reporta en `diferencias`.
 */
function setupDatabase(spreadsheet) {
  const ss = spreadsheet || getSpreadsheet();
  const creadas = [];
  const existentes = [];

  // La hoja y la app deben hablar la misma zona horaria.
  try { ss.setSpreadsheetTimeZone('America/Bogota'); } catch (e) {}

  Object.keys(SCHEMAS).forEach(nombre => {
    const config = SCHEMAS[nombre];
    let sheet = ss.getSheetByName(nombre);
    const esNueva = !sheet;
    if (esNueva) sheet = ss.insertSheet(nombre);

    if (sheet.getLastRow() === 0) {
      prepararHoja_(sheet, nombre, config);
      creadas.push(nombre);
    } else {
      existentes.push(nombre);
    }
  });

  // Quitar la hoja vacía que Google crea por defecto
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(nombre => {
    const s = ss.getSheetByName(nombre);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  const migradas = migrarColumnas_(ss);
  sembrarPorDefecto_(ss);
  invalidateCache();
  CacheService.getScriptCache().remove('ESQUEMA_OK');

  const verificacion = verificarEsquema(ss);
  return {
    ok: verificacion.listo,
    tablas: Object.keys(SCHEMAS).length,
    creadas: creadas,
    existentes: existentes,
    migradas: migradas,
    diferencias: verificacion.diferencias,
    url: ss.getUrl()
  };
}

/** Encabezado, anchos, listas desplegables, casillas y aviso al editar a mano. */
function prepararHoja_(sheet, nombre, config) {
  const headers = config.headers;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const enc = sheet.getRange(1, 1, 1, headers.length);
  enc.setFontWeight('bold');
  enc.setBackground('#1C1C1E');
  enc.setFontColor('#FFFFFF');
  enc.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  config.widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const filas = 1000;
  headers.forEach((h, i) => {
    const col = i + 1;
    if ((COLUMNAS_TEXTO[nombre] || []).indexOf(h) !== -1 || COL_AUDITORIA.indexOf(h) !== -1) {
      sheet.getRange(2, col, filas, 1).setNumberFormat('@');
    }
    // No se precargan casillas de verificación: las celdas "FALSE" cuentan como contenido,
    // getLastRow() devolvería 1001 y los registros nuevos se agregarían al final de la hoja.
    if (ENUMS[nombre] && ENUMS[nombre][h]) {
      try {
        const regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(ENUMS[nombre][h].filter(Boolean), true)
          .setAllowInvalid(true)
          .build();
        sheet.getRange(2, col, filas, 1).setDataValidation(regla);
      } catch (e) {}
    }
  });

  // Los datos los escribe la app: editar a mano muestra una advertencia, pero no se bloquea.
  try { sheet.protect().setDescription('Tabla gestionada por Moni').setWarningOnly(true); } catch (e) {}
}

/** Siembra Config, Categorías y el escenario base cuando esas tablas están vacías. */
function sembrarPorDefecto_(ss) {
  const ahora = ahoraIso_();
  const sembrar = (nombre, filas) => {
    const sheet = ss.getSheetByName(nombre);
    if (!sheet || sheet.getLastRow() > 1 || filas.length === 0) return;
    const conAuditoria = filas.map(f => f.concat([ahora, ahora]));
    sheet.getRange(2, 1, conAuditoria.length, conAuditoria[0].length).setValues(conAuditoria);
  };
  sembrar('Config', DEFAULT_CONFIG);
  sembrar('Categorias', DEFAULT_CATEGORIAS);
  sembrar('Escenarios', DEFAULT_ESCENARIOS);
}

/**
 * Vincula este proyecto con el Sheet de Moni (guarda su ID en las propiedades del script).
 * Ejecutar una vez desde el editor. Sin argumentos usa la hoja a la que está unido el proyecto
 * (Extensiones → Apps Script); también acepta el ID de otra hoja: vincularHojaMoni('<ID>').
 * El ID no va en el código para que el repositorio no dependa de una hoja concreta.
 * Después de vincular, `setupDatabase()` crea las tablas.
 */
function vincularHojaMoni(idHoja) {
  const ss = idHoja ? SpreadsheetApp.openById(idHoja) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No hay una hoja a la que vincular. Abre el proyecto desde la hoja (Extensiones → Apps Script) o pasa su ID.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Vinculado a: ' + ss.getName() + ' — ' + ss.getUrl());
  return { ok: true, nombre: ss.getName(), url: ss.getUrl() };
}
