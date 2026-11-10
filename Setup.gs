/**
 * Setup.gs — Moni
 * Esquema de la base de datos (las tablas de SCHEMAS; ver docs/ESQUEMA.md) e instalación idempotente.
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
const ESQUEMA_VERSION = '6';

/** Lo que se recuerda de una revisión correcta: cambia con cada versión de la app, así una versión nueva siempre vuelve a revisar la hoja. */
function firmaEsquema_() { return ESQUEMA_VERSION + '|' + (typeof VERSION_APP !== 'undefined' ? VERSION_APP : ''); }

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
  Bancos: tabla_(['ID_Banco', 'Nombre', 'Color', 'Icono', 'Activo', 'Orden', 'Divisa', 'Rendimiento_EA', 'Rendimiento_Pago', 'Rendimiento_Base'], [170, 200, 90, 90, 70, 60, 80, 120, 130, 130]),
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
    ['ID_Suscripcion', 'Nombre', 'Tipo', 'Valor', 'Periodicidad', 'Proximo_Cobro', 'Dia_Cobro', 'ID_Bolsillo', 'ID_Tarjeta', 'ID_Categoria', 'ID_Servicio', 'ID_Inmueble', 'Renglon', 'URL_Pago', 'Ultimo_Pago', 'Notas', 'Activo', 'Orden'],
    [170, 220, 110, 120, 110, 120, 80, 170, 170, 170, 170, 170, 200, 260, 120, 220, 70, 60]),
  CDTs: tabla_(
    ['ID_CDT', 'Nombre', 'ID_Banco', 'Capital', 'Tasa_EA', 'Fecha_Inicio', 'Plazo_Dias', 'Fecha_Vencimiento', 'Pago_Intereses', 'Retencion_Pct', 'Estado', 'ID_Bolsillo_Origen', 'ID_Bolsillo_Destino', 'Renovar', 'Prox_Pago_Interes', 'Ultimo_Pago_Interes', 'Intereses_Cobrados', 'ID_Mov_Apertura', 'Fecha_Cierre', 'Notas', 'Activo', 'Orden'],
    [170, 220, 170, 130, 90, 110, 90, 120, 120, 100, 90, 170, 170, 80, 120, 120, 130, 170, 110, 220, 70, 60]),
  Ingresos_Recurrentes: tabla_(
    ['ID_Ingreso', 'Nombre', 'Valor', 'Periodicidad', 'Proximo_Cobro', 'Dia_Cobro', 'ID_Bolsillo', 'ID_Categoria', 'Ultimo_Cobro', 'Notas', 'Activo', 'Orden'],
    [170, 220, 120, 110, 120, 80, 170, 170, 120, 220, 70, 60]),
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
    ['ID_Item', 'Mes', 'ID_Escenario', 'ID_Plantilla', 'Concepto', 'Tipo', 'Plan', 'Pagado', 'ID_Bolsillo_Destino', 'ID_Credito', 'ID_Tarjeta', 'Notas', 'ID_Suscripcion'],
    [170, 90, 170, 170, 240, 90, 120, 70, 170, 170, 170, 220, 170]),

  // ---- Nómina (una vez al mes) ----
  Subsidios: tabla_(['ID_Subsidio', 'Nombre', 'Valor', 'Es_Salarial', 'Vigente_Desde', 'Vigente_Hasta', 'Activo'], [170, 260, 120, 100, 120, 120, 70]),
  Nomina_Escenarios: tabla_(['ID_Nomina_Esc', 'Nombre', 'Sueldo_Base', 'Vigente', 'Activo'], [170, 240, 130, 80, 70]),
  Nomina_Conceptos: tabla_(
    ['ID_Concepto', 'ID_Nomina_Esc', 'Tipo', 'Concepto', 'Activo', 'Tipo_Calculo', 'Dias', 'Porcentaje', 'Valor_Fijo', 'ID_Subsidio'],
    [170, 170, 100, 220, 70, 140, 70, 90, 120, 170]),
  Nomina_Pagos: tabla_(
    ['ID_Nomina', 'Periodo', 'ID_Nomina_Esc', 'Estado', 'Devengado', 'Deducciones', 'Extras', 'Neto_Estimado', 'Neto_Real', 'Fecha_Pago', 'ID_Bolsillo_Destino', 'ID_Mov', 'Notas', 'Origen', 'Anulado', 'Afecta_Saldos'],
    [170, 90, 170, 100, 120, 120, 110, 130, 130, 110, 170, 170, 200, 80, 80, 110]),
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
  Bancos: { Divisa: DIVISAS, Rendimiento_Pago: ['', 'Diario', 'Mensual'], Rendimiento_Base: ['', 'Todo', 'Bolsillos'] },
  CDTs: { Pago_Intereses: ['Vencimiento', 'Mensual', 'Trimestral'], Estado: ['Vigente', 'Cerrado'] },
  Ingresos_Recurrentes: { Periodicidad: ['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'] },
  Cuentas: { Tipo: ['Billetera', 'Debito', 'Ahorro', 'Otra'] },
  Bolsillos: { Rol: ['Operativo', 'Reserva_Tarjeta', 'Fondo', 'General'] },
  Categorias: { Tipo: ['Gasto', 'Ingreso', 'Transferencia', 'Ajuste'] },
  Personas: { Rol: ['Titular', 'Familiar', 'Otro'] },
  Movimientos: {
    Tipo_Mov: ['Gasto', 'Ingreso', 'Transferencia', 'Ajuste'],
    Subtipo: ['', 'Para_Gastos', 'Reposicion', 'Interes', 'Retencion', 'GMF', 'Pago_TC', 'Reserva_TC', 'Pago_Cuota', 'Nomina', 'Distribucion', 'Conversion', 'Comision', 'CDT_Apertura', 'CDT_Retorno'],
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
  Ingresos_Recurrentes: ['Proximo_Cobro', 'Ultimo_Cobro'],
  CDTs: ['Fecha_Inicio', 'Fecha_Vencimiento', 'Prox_Pago_Interes', 'Ultimo_Pago_Interes', 'Fecha_Cierre'],
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
  ['Avisos_Ocultos', '', 'Sistema', 'texto', 'Avisos de Inicio que la persona decidió ocultar (separados por coma)'],
  ['Datos_Demo', 'FALSE', 'Sistema', 'booleano', 'TRUE mientras existan datos de demostración'],
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
  ['Cesantias_Dias_Actual', '360', 'Nomina', 'numero', 'Días del año de cesantías con el sueldo actual (360 = todo el año; menos si el sueldo cambió)'],
  ['Cesantias_Sueldo_Anterior', '0', 'Nomina', 'moneda', 'Sueldo que tenías antes del cambio, para los días restantes del año de cesantías (0 = sin cambio)'],
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
  const cache = cache_();
  if (opciones && opciones.usarCache && !(opciones.solo) && cache.get('ESQUEMA_OK') === firmaEsquema_()) {
    return { faltantes: [], diferencias: [], listo: true, desdeCache: true };
  }

  const ss = spreadsheet || getSpreadsheet();
  const faltantes = [];
  const diferencias = [];

  const solo = opciones && opciones.solo; // revisar solo estas tablas (las demás se acaban de crear con su encabezado exacto)
  Object.keys(SCHEMAS).forEach(nombre => {
    if (solo && solo.indexOf(nombre) === -1) return;
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
  if (listo && !solo) { try { cache.put('ESQUEMA_OK', firmaEsquema_(), 21600); } catch (e) {} }
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
  { tabla: 'Suscripciones', columna: 'Renglon', valor: '' },
  { tabla: 'Bancos', columna: 'Rendimiento_EA', valor: '' },
  { tabla: 'Bancos', columna: 'Rendimiento_Pago', valor: '' },
  { tabla: 'Bancos', columna: 'Rendimiento_Base', valor: '' },
  { tabla: 'Presupuesto_Mes', columna: 'ID_Suscripcion', valor: '' },
  { tabla: 'Suscripciones', columna: 'ID_Inmueble', valor: '' },
  { tabla: 'Nomina_Pagos', columna: 'Afecta_Saldos', valor: true }
];

function migrarColumnas_(ss) {
  const migradas = [];
  const porTabla = {};
  MIGRACIONES_COLUMNAS.forEach(mg => { (porTabla[mg.tabla] = porTabla[mg.tabla] || []).push(mg); });

  Object.keys(porTabla).forEach(tabla => {
    const sheet = ss.getSheetByName(tabla);
    if (!sheet || sheet.getLastRow() === 0) return;
    const esperado = SCHEMAS[tabla].headers;
    const real = sheet.getRange(1, 1, 1, Math.max(esperado.length, sheet.getLastColumn())).getValues()[0].map(h => String(h).trim());
    // Solo se migra si lo único que falta son columnas declaradas aquí y todo lo demás coincide, en orden.
    const faltan = porTabla[tabla].filter(mg => real.indexOf(mg.columna) === -1);
    if (!faltan.length) return;
    const sinFaltantes = esperado.filter(h => !faltan.some(mg => mg.columna === h));
    if (real.slice(0, sinFaltantes.length).join('|') !== sinFaltantes.join('|')) return;

    // De izquierda a derecha: cada inserción respeta la posición que tiene en el esquema.
    faltan.sort((x, y) => esperado.indexOf(x.columna) - esperado.indexOf(y.columna)).forEach(mg => {
      const col = esperado.indexOf(mg.columna) + 1;
      sheet.insertColumnBefore(col);
      sheet.getRange(1, col).setValue(mg.columna);
      const filas = sheet.getLastRow() - 1;
      if (filas > 0) sheet.getRange(2, col, filas, 1).setValues(Array.from({ length: filas }, () => [mg.valor]));
      // Aspecto igual al de las demás columnas (si algo de esto falla, los datos ya quedaron bien)
      try {
        sheet.getRange(1, col - 1).copyTo(sheet.getRange(1, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        sheet.setColumnWidth(col, SCHEMAS[tabla].widths[col - 1]);
        if (ENUMS[tabla] && ENUMS[tabla][mg.columna]) {
          sheet.getRange(2, col, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ENUMS[tabla][mg.columna], true).setAllowInvalid(true).build());
        }
      } catch (e) {}
      migradas.push(tabla + '.' + mg.columna);
    });
  });
  return migradas;
}

/**
 * Instala la base de datos. Idempotente: crea lo que falta y nunca borra ni sobrescribe datos.
 * Si una pestaña existe con encabezados distintos, no la toca y la reporta en `diferencias`.
 */
function setupDatabase(spreadsheet, opciones) {
  const ss = spreadsheet || getSpreadsheet();
  const creadas = [];
  const existentes = [];
  // Con presupuestoMs, si se acaba el tiempo se detiene y devuelve { parcial: true }: quien llama repite
  // la llamada y continúa donde quedó (cada pestaña terminada se reconoce por su encabezado). Así una
  // instalación larga nunca choca con el límite de tiempo de Apps Script ni con la espera de la pantalla.
  const limite = opciones && opciones.presupuestoMs ? Date.now() + opciones.presupuestoMs : 0;
  const nombres = Object.keys(SCHEMAS);

  // La hoja y la app deben hablar la misma zona horaria.
  try { ss.setSpreadsheetTimeZone('America/Bogota'); } catch (e) {}

  let pendientes = 0;
  let trabajadas = 0; // siempre se avanza al menos una pestaña por llamada, aunque el tiempo sea muy corto
  nombres.forEach(nombre => {
    if (limite && trabajadas > 0 && Date.now() > limite) { // sin tiempo: se cuentan las que faltan por revisar
      const s = ss.getSheetByName(nombre);
      if (!s || s.getLastRow() === 0) pendientes++;
      return;
    }
    const config = SCHEMAS[nombre];
    let sheet = ss.getSheetByName(nombre);
    if (!sheet) sheet = ss.insertSheet(nombre);

    if (sheet.getLastRow() === 0) {
      prepararHoja_(sheet, nombre, config);
      creadas.push(nombre);
      trabajadas++;
    } else {
      existentes.push(nombre);
    }
  });

  if (pendientes > 0) {
    return { ok: false, parcial: true, tablas: nombres.length, hechas: nombres.length - pendientes, creadas: creadas, url: ss.getUrl() };
  }

  // Quitar la hoja vacía que Google crea por defecto
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(nombre => {
    const s = ss.getSheetByName(nombre);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  const migradas = migrarColumnas_(ss);
  sembrarPorDefecto_(ss);
  completarConfig_(ss);
  invalidateCache();
  cache_().remove('ESQUEMA_OK');

  // Lo recién creado ya tiene su encabezado exacto: solo se revisa lo que ya existía.
  const verificacion = verificarEsquema(ss, existentes.length < nombres.length ? { solo: existentes } : undefined);
  return {
    ok: verificacion.listo,
    parcial: false,
    tablas: nombres.length,
    hechas: nombres.length,
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
  // El encabezado se escribe AL FINAL: una pestaña sin encabezado cuenta como "sin terminar" y se rehace
  // si la instalación se interrumpió a medias.
  sheet.setFrozenRows(1);
  config.widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const filas = 1000;
  // Todas las columnas de texto en una sola llamada (RangeList), en vez de una por columna.
  const colsTexto = headers.map((h, i) => ((COLUMNAS_TEXTO[nombre] || []).indexOf(h) !== -1 || COL_AUDITORIA.indexOf(h) !== -1) ? i + 1 : 0).filter(Boolean);
  if (colsTexto.length) {
    const a1 = colsTexto.map(c => sheet.getRange(2, c, filas, 1).getA1Notation());
    sheet.getRangeList(a1).setNumberFormat('@');
  }
  // No se precargan casillas de verificación: las celdas "FALSE" cuentan como contenido,
  // getLastRow() devolvería 1001 y los registros nuevos se agregarían al final de la hoja.
  headers.forEach((h, i) => {
    if (ENUMS[nombre] && ENUMS[nombre][h]) {
      try {
        const regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(ENUMS[nombre][h].filter(Boolean), true)
          .setAllowInvalid(true)
          .build();
        sheet.getRange(2, i + 1, filas, 1).setDataValidation(regla);
      } catch (e) {}
    }
  });

  // Los datos los escribe la app: editar a mano muestra una advertencia, pero no se bloquea.
  try { sheet.protect().setDescription('Tabla gestionada por Moni').setWarningOnly(true); } catch (e) {}

  const enc = sheet.getRange(1, 1, 1, headers.length);
  enc.setValues([headers]);
  enc.setFontWeight('bold').setBackground('#1C1C1E').setFontColor('#FFFFFF').setHorizontalAlignment('center');
}

/** Añade los parámetros que una base ya instalada todavía no tiene (los valores existentes no se tocan). */
function completarConfig_(ss) {
  const sheet = ss.getSheetByName('Config');
  if (!sheet || sheet.getLastRow() < 2) return;
  const claves = {};
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(r => { claves[String(r[0]).trim()] = true; });
  const faltan = configInicial_().filter(c => !claves[c[0]]);
  if (!faltan.length) return;
  const ahora = ahoraIso_();
  const filas = faltan.map(f => f.concat([ahora, ahora]));
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  invalidateCache('Config');
}

/** Siembra Config, Categorías y el escenario base cuando esas tablas están vacías. */
/** Parámetros iniciales: el año activo es el actual (no uno fijo), para que cualquier persona empiece bien en cualquier fecha. */
function configInicial_() {
  const anio = String(Number(hoyIso_().slice(0, 4)));
  return DEFAULT_CONFIG.map(c => c[0] === 'Anio_Activo' ? [c[0], anio].concat(c.slice(2)) : c);
}

/** Crea la fila de Config si todavía no existe (las bases ya instaladas no tienen las claves nuevas). */
function asegurarConfig_(clave) {
  if (getTableData('Config').some(c => c.Clave === clave)) return;
  const d = configInicial_().find(item => item[0] === clave);
  if (!d) throw new Error('No hay parámetro "' + clave + '".');
  insertRow('Config', { Clave: d[0], Valor: d[1], Grupo: d[2], Tipo: d[3], Descripcion: d[4] });
}

function guardarConfig_(clave, valor) {
  asegurarConfig_(clave);
  updateRowById('Config', 'Clave', clave, { Valor: String(valor) });
}

function sembrarPorDefecto_(ss) {
  const ahora = ahoraIso_();
  const sembrar = (nombre, filas) => {
    const sheet = ss.getSheetByName(nombre);
    if (!sheet || sheet.getLastRow() > 1 || filas.length === 0) return;
    const conAuditoria = filas.map(f => f.concat([ahora, ahora]));
    sheet.getRange(2, 1, conAuditoria.length, conAuditoria[0].length).setValues(conAuditoria);
  };
  sembrar('Config', configInicial_());
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
  propiedades_().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Vinculado a: ' + ss.getName() + ' — ' + ss.getUrl());
  return { ok: true, nombre: ss.getName(), url: ss.getUrl() };
}
