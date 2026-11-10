# Moni — Especificación del esquema

Base de datos: un Google Sheet por persona ("Moni — mis finanzas").
El script de instalación (`setupDatabase`) crea estas 29 tablas, una por pestaña, con los encabezados exactos de abajo.

## Convenciones

| Tema | Regla |
|---|---|
| IDs | `ID_*` es texto. UUID para datos creados por la app; *slug* legible (`bol-casa`) solo en semillas. **Nunca se escribe un ID fijo en el código** para referirse a un dato del usuario |
| Fechas | `Fecha` = `yyyy-MM-dd`. `Mes` = `yyyy-MM`. Zona horaria de `Config.Zona_Horaria` (`America/Bogota`). **Se guardan como texto plano** (también `Creado_En` y `Actualizado_En`) para que Sheets no las convierta ni las corra de día; `setupDatabase` fija la zona horaria de la hoja |
| Dinero | Número, hasta 2 decimales, **en la moneda del banco** de la cuenta (`Bancos.Divisa`: `COP`, `USD` o `EUR`; pesos por defecto). En `Movimientos`, **negativo = sale, positivo = entra** |
| Booleanos | `TRUE` / `FALSE` |
| Borrado | Datos contables: `Anulado = TRUE` (no se borran). Catálogos: `Activo = FALSE` |
| Auditoría | Toda tabla termina con `Creado_En` y `Actualizado_En` (fecha y hora ISO) |
| Origen | Tablas de operación llevan `Origen`: `App`, `Demo` o `Import`. `limpiarDatosDemo()` borra solo `Demo` |
| Orden | `Orden` numérico para ordenar listas en pantalla |

## 1. Configuración (la edita la usuaria en Ajustes)

**Config** — `Clave, Valor, Grupo, Tipo, Descripcion`

Parámetros de la persona (clave → valor). La tabla de abajo sale de `DEFAULT_CONFIG` en `Setup.gs`; las filas se siembran al instalar y las claves nuevas se agregan solas (`asegurarConfig_`) en hojas ya creadas. Los marcados *(la gestiona la app)* no se pueden editar desde `saveConfigParam`; el resto se cambia desde Ajustes. El año activo se ajusta al año actual al crear la hoja.

| Clave | Por defecto | Grupo | Para qué |
|---|---|---|---|
| `Nombre_Usuario` | — | General | Nombre con el que la app te saluda |
| `Anio_Activo` | el año actual | General | Año de operación activo |
| `Zona_Horaria` | `America/Bogota` | General | Zona horaria para cálculos de fechas |
| `Moneda` | `COP` | General | Código de moneda (ISO 4217) |
| `Tema` | `Automatico` | Apariencia | Claro, Oscuro o Automatico (sigue al dispositivo) |
| `Color_Acento` | `rosa` | Apariencia | Color de acento de la interfaz |
| `Avisos_Ocultos` | — | Sistema | Avisos de Inicio que la persona decidió ocultar (separados por coma) *(la gestiona la app)* |
| `Datos_Demo` | `FALSE` | Sistema | TRUE mientras existan datos de demostración *(la gestiona la app)* |
| `Carpeta_PDF` | `Moni/Extractos` | General | Ruta de Google Drive para extractos en PDF |
| `Respaldo_Frecuencia_Dias` | `7` | Respaldos | Frecuencia de copia en días |
| `Respaldo_Copias` | `8` | Respaldos | Número de copias retenidas |
| `Nomina_Periodicidad` | `Mensual` | Nomina | La nómina se paga una vez al mes |
| `Nomina_Dia_Pago` | `30` | Nomina | Día estimado de pago del salario |
| `Dias_Base` | `30` | Nomina | Días comerciales por mes para nómina |
| `Aporte_Salud` | `0.04` | Nomina | Porcentaje de aporte a salud del trabajador |
| `Aporte_Pension` | `0.04` | Nomina | Porcentaje de aporte a pensión del trabajador |
| `Redondeo_Aportes` | `-2` | Nomina | Redondeo de aportes (-2 = centena superior) |
| `SMMLV` | `1423500` | Nomina | Salario mínimo mensual legal vigente. Actualizar cada enero |
| `SMMLV_Anio` | `2025` | Nomina | Año del SMMLV registrado |
| `FSP_Umbral_SMMLV` | `4` | Nomina | Umbral de SMMLV para el Fondo de Solidaridad Pensional |
| `Auxilio_Transporte_Aplica` | `FALSE` | Nomina | Aplica auxilio de transporte legal |
| `Prima_Fechas` | `06-30,12-20` | Nomina | Fechas límite de pago de prima |
| `Cesantias_Fecha_Consignacion` | `02-14` | Nomina | Fecha máxima de consignación al fondo |
| `Intereses_Cesantias_Fecha` | `01-31` | Nomina | Fecha máxima de pago de intereses de cesantías |
| `Tasa_Interes_Cesantias` | `0.12` | Nomina | Tasa legal de intereses de cesantías |
| `Cesantias_Dias_Actual` | `360` | Nomina | Días del año de cesantías con el sueldo actual (360 = todo el año; menos si el sueldo cambió) |
| `Cesantias_Sueldo_Anterior` | `0` | Nomina | Sueldo que tenías antes del cambio, para los días restantes del año de cesantías (0 = sin cambio) |
| `Credito_Metodo_Tasa` | `Excel` | Creditos | Conversión de tasa EA a periódica: Excel o Exacta |
| `Tasa_USD` | — | Divisas | Pesos que vale 1 dólar (TRM que tú escribes). Sirve para ver el equivalente en pesos *(la gestiona la app)* |
| `Tasa_USD_Fecha` | — | Divisas | Fecha en que anotaste la tasa del dólar *(la gestiona la app)* |
| `Tasa_EUR` | — | Divisas | Pesos que vale 1 euro *(la gestiona la app)* |
| `Tasa_EUR_Fecha` | — | Divisas | Fecha en que anotaste la tasa del euro *(la gestiona la app)* |
| `Tasa_USD_Fuente` | — | Divisas | De dónde salió la tasa del dólar: Manual o Google Finance *(la gestiona la app)* |
| `Tasa_EUR_Fuente` | — | Divisas | De dónde salió la tasa del euro: Manual o Google Finance *(la gestiona la app)* |
| `Tasa_Auto` | `FALSE` | Divisas | TRUE si la tasa se actualiza sola cada día con Google Finance *(la gestiona la app)* |
| `Recordatorios_Activos` | `FALSE` | Recordatorios | TRUE si los pagos se anotan en Google Calendar *(la gestiona la app)* |
| `Recordatorios_Dias_Antes` | `2` | Recordatorios | Días de anticipación del aviso (además del aviso del mismo día) *(la gestiona la app)* |
| `Recordatorios_Hora` | `9` | Recordatorios | Hora del día en que suenan los avisos *(la gestiona la app)* |
| `Recordatorios_Nomina` | `TRUE` | Recordatorios | Incluir las fechas de prima y cesantías *(la gestiona la app)* |
| `Calendario_ID` | — | Recordatorios | Calendario de Google que crea la app *(la gestiona la app)* |
| `Recordatorios_Ultima` | — | Recordatorios | Fecha y hora de la última sincronización *(la gestiona la app)* |
| `Recordatorios_Resumen` | — | Recordatorios | Resultado de la última sincronización *(la gestiona la app)* |

`Tipo` indica cómo se valida: `numero`, `moneda` y `porcentaje` (decimal entre 0 y 1: 4 % = `0.04`) exigen un número; `booleano` es `TRUE`/`FALSE`; `seleccion` y `texto` son texto.

**Bancos** — `ID_Banco, Nombre, Color, Icono, Activo, Orden, Divisa, Rendimiento_EA, Rendimiento_Pago, Rendimiento_Base` (`Rendimiento_Base`: `Todo` o `Bolsillos`, sobre qué saldo rinde; `Rendimiento_EA`: tasa efectiva anual en decimal (0,095 = 9,5 %); `Rendimiento_Pago`: `Diario` o `Mensual`. `Divisa`: `COP`, `USD` o `EUR`, por defecto `COP`; las cuentas y bolsillos la heredan del banco y no se puede cambiar cuando el banco ya tiene cuentas. Se agrega sola a las bases anteriores al pulsar **Instalar**)

**Cuentas** — `ID_Cuenta, ID_Banco, Nombre, Tipo, Permite_Bolsillos, Fecha_Apertura, Saldo_Real, Fecha_Saldo_Real, Meta, Activo, Orden`
- `Tipo`: `Billetera`, `Debito`, `Ahorro`, `Otra`.
- **Toda cuenta tiene un bolsillo interno** (`Es_Interno = TRUE`, `Rol = General`): su saldo propio. Con `Permite_Bolsillos = TRUE` se llama **"Sin asignar"** (dinero que no está en ningún bolsillo); con `FALSE` la cuenta es un solo saldo y el interno lleva el nombre de la cuenta.
- **El saldo de apertura vive en los bolsillos** (`Bolsillos.Saldo_Apertura`); la cuenta no lo guarda, para no tener dos fuentes. `Fecha_Apertura` es la fecha desde la que se llevan los saldos.
- `Saldo_Real` / `Fecha_Saldo_Real`: último saldo auditado en la app del banco, para el cuadre.
- `Meta`: objetivo de ahorro (solo cuentas `Ahorro`).

**Bolsillos** — `ID_Bolsillo, ID_Cuenta, Nombre, Rol, Saldo_Apertura, Es_Interno, Color, Icono, Activo, Orden`
- `Rol`: `Operativo`, `Reserva_Tarjeta`, `Fondo`, `General`.
- `Es_Interno = TRUE` para el saldo propio de cada cuenta (uno por cuenta). Solo admite cambiar su saldo de apertura; se desactiva con la cuenta. Las hojas anteriores a la 1.3 se completan solas al abrir la app (se crea en 0, sin cambiar saldos).

**Tarjetas** — `ID_Tarjeta, ID_Banco, Nombre, Cupo, Dia_Corte, Dia_Pago, ID_Bolsillo_Reserva, ID_Bolsillo_Personal, Color, Activo, Orden`
- `ID_Bolsillo_Reserva`: dinero apartado para pagar el extracto.
- `ID_Bolsillo_Personal`: bolsillo del que sale lo que falta al pagar (compras de Fuente `Personal`).

**Categorias** — `ID_Categoria, Nombre, Tipo, Icono, Color, Activo, Orden` · `Tipo`: `Gasto`, `Ingreso`, `Transferencia`, `Ajuste`.

**Personas** — `ID_Persona, Nombre, Rol, Activo` · `Rol`: `Titular`, `Familiar`, `Otro`. Se usan en créditos y regalos.

**Inmuebles** — `ID_Inmueble, Nombre, Activo, Orden`
**Servicios_Publicos** — `ID_Servicio, ID_Inmueble, Tipo, Empresa, Codigo_Pago, URL_Pago, Notas, Activo`

**Suscripciones** — `ID_Suscripcion, Nombre, Tipo, Valor, Periodicidad, Proximo_Cobro, Dia_Cobro, ID_Bolsillo, ID_Tarjeta, ID_Categoria, ID_Servicio, ID_Inmueble, Renglon, URL_Pago, Ultimo_Pago, Notas, Activo, Orden`
Pagos que se repiten. `Tipo` = `Suscripcion` o `Servicio`; `Periodicidad` = Mensual/Bimestral/Trimestral/Semestral/Anual. `Proximo_Cobro` y `Ultimo_Pago` son texto AAAA-MM-DD. Se paga con **un** medio: `ID_Bolsillo` (gasto) o `ID_Tarjeta` (compra de tarjeta). `Dia_Cobro` conserva el día original (31 → 28 → 31). `ID_Servicio` enlaza un servicio público (código y enlace de pago). Cada pago deja `Notas = "Suscripción <ID>"` en el gasto o la compra.

**CDTs** — `ID_CDT, Nombre, ID_Banco, Capital, Tasa_EA, Fecha_Inicio, Plazo_Dias, Fecha_Vencimiento, Pago_Intereses, Retencion_Pct, Estado, ID_Bolsillo_Origen, ID_Bolsillo_Destino, Renovar, Prox_Pago_Interes, Ultimo_Pago_Interes, Intereses_Cobrados, ID_Mov_Apertura, Fecha_Cierre, Notas, Activo, Orden` (`Tasa_EA` y `Retencion_Pct` en decimal; `Pago_Intereses`: `Vencimiento`, `Mensual` o `Trimestral`; `Estado`: `Vigente` o `Cerrado`; fechas como texto AAAA-MM-DD). Los movimientos del CDT usan los subtipos `CDT_Apertura` y `CDT_Retorno` (ajustes), más `Interes` y `Retencion`.

**Ingresos_Recurrentes** — `ID_Ingreso, Nombre, Valor, Periodicidad, Proximo_Cobro, Dia_Cobro, ID_Bolsillo, ID_Categoria, Ultimo_Cobro, Notas, Activo, Orden`
Ingresos que se repiten y no son la nómina. `ID_Bolsillo` es el bolsillo (cuenta) al que llega, en pesos. Cada recibo deja `Notas = "Ingreso recurrente <ID>"` en el ingreso.

**Escenarios** — `ID_Escenario, Nombre, Es_Base, Descripcion, Activo`
Escenarios de presupuesto (por ejemplo `Normal` y `Contingencia`). Exactamente uno tiene `Es_Base = TRUE`.

## 2. Operación

**Movimientos** (libro mayor de bolsillos) —
`ID_Mov, Fecha, Concepto, ID_Bolsillo, Valor, Tipo_Mov, Subtipo, ID_Categoria, ID_Grupo, ID_Item_Ppto, Notas, Origen, Anulado`
- `Tipo_Mov`: `Gasto`, `Ingreso`, `Transferencia`, `Ajuste`.
- `Subtipo` (opcional): `Para_Gastos`, `Reposicion`, `Interes`, `Retencion`, `GMF`, `Pago_TC`, `Reserva_TC`, `Pago_Cuota`, `Nomina`, `Distribucion`, `Conversion` (dos filas con el mismo `ID_Grupo`, cada una en la divisa de su bolsillo, que no suman cero; la tasa implícita va en `Notas`).
- `ID_Grupo`: une las filas de una misma operación (transferencia, pago de extracto, pago de cuota). **La suma de un grupo de transferencia interna es 0.**
- `ID_Item_Ppto`: enlaza el gasto con su renglón del presupuesto del mes.

> El ahorro externo **no tiene tabla propia**: las cuentas de tipo `Ahorro` usan este mismo libro. La deuda con el ahorro de una cuenta = Σ `Para_Gastos` − Σ `Reposicion`.

**Compras_TC** —
`ID_Compra, Fecha, Concepto, Valor, ID_Tarjeta, Mes_Extracto, Fuente, ID_Categoria, ID_Item_Ppto, ID_Extracto, Pagado, ID_Mov_Reserva, Notas, Origen, Anulado`
- `Fuente`: `Personal`, `Ppto`, `Guardar`, `Otro`. (`Personal` = gasto propio que se paga desde `Tarjetas.ID_Bolsillo_Personal`.)
- `ID_Mov_Reserva`: movimiento que apartó el dinero en la reserva (Fuente `Ppto`).
- `Mes_Extracto` se calcula con el `Dia_Corte` de la tarjeta si no se indica.

**Extractos** — `ID_Extracto, ID_Tarjeta, Mes, Total, Estado, Fecha_Pago, ID_Grupo_Pago, URL_PDF, Notas, Anulado`
`Estado`: `Abierto`, `Pagado`.

**Presupuesto_Plantilla** —
`ID_Plantilla, ID_Escenario, Concepto, Monto_Plan, Tipo, ID_Bolsillo_Destino, ID_Categoria, ID_Credito, ID_Tarjeta, Activo, Orden`
- `Tipo`: `Gasto`, `Cuota`, `Ahorro`, `Fondo`.
- `ID_Tarjeta`: con qué se suele pagar un gasto (vacío = el bolsillo del renglón). Solo en renglones de tipo `Gasto`.
- No hay "Continuar/Congelar": un gasto "congelado" simplemente no existe, o vale 0, en el escenario `Contingencia`. Se crea un escenario copiando otro.

**Presupuesto_Mes** — (incluye `ID_Suscripcion`, el enlace con la suscripción o servicio que lo originó; se agrega sola al instalar) 
`ID_Item, Mes, ID_Escenario, ID_Plantilla, Concepto, Tipo, Plan, Pagado, ID_Bolsillo_Destino, ID_Credito, ID_Tarjeta, Notas`
- **No existe la columna `Real`: se calcula** = Σ `Movimientos` con ese `ID_Item_Ppto` + Σ `Compras_TC` (Fuente `Ppto`) con ese `ID_Item_Ppto`.
- `Ahorro` del renglón = `Plan − Real` solo si `Pagado`.

## 3. Nómina (una vez al mes)

**Subsidios** — `ID_Subsidio, Nombre, Valor, Es_Salarial, Vigente_Desde, Vigente_Hasta, Activo`
**Nomina_Escenarios** — `ID_Nomina_Esc, Nombre, Sueldo_Base, Vigente, Activo` (hoy solo hay una fila activa, "Mi nómina": la tabla se conserva para no perder los datos de quien ya tenía escenarios; la pantalla ya no los ofrece)
**Nomina_Conceptos** — `ID_Concepto, ID_Nomina_Esc, Tipo, Concepto, Activo, Tipo_Calculo, Dias, Porcentaje, Valor_Fijo, ID_Subsidio`
**Nomina_Pagos** — `ID_Nomina, Periodo, ID_Nomina_Esc, Estado, Devengado, Deducciones, Extras, Neto_Estimado, Neto_Real, Fecha_Pago, ID_Bolsillo_Destino, ID_Mov, Notas, Origen, Anulado, Afecta_Saldos`
**Nomina_Pagos_Detalle** — `ID_Detalle, ID_Nomina, Tipo, Concepto, Valor`
- `Estado`: `Proyectado`, `Recibido`. Un solo registro vigente por `Periodo`.

## 4. Créditos (autopago)

**Creditos** —
`ID_Credito, Nombre, ID_Persona, ID_Cuenta_Ahorro, ID_Bolsillo_Pago, Fecha_Inicio, Monto, Tasa_Periodica, Periodicidad, Num_Periodos, Cuota_Fija, Metodo_Tasa, Estado, Notas`
- `ID_Cuenta_Ahorro`: de dónde salió el dinero y adónde se repone.
- `Periodicidad`: `Quincenal`, `Mensual`. `Estado`: `Activo`, `Pagado`, `Anulado`.
- `Num_Periodos` es el plazo **vigente**; baja cuando hay abonos extra.

**Creditos_Cronograma** — `ID_Cuota, ID_Credito, Version, Num, Fecha_Prevista, Saldo_Inicial, Cuota, Interes, Capital, Saldo_Final, Estado`
- `Estado`: `Pendiente`, `Pagada`, `Reemplazada`. Un abono extra crea una `Version` nueva y marca las cuotas pendientes anteriores como `Reemplazada`.

**Creditos_Pagos** — `ID_Pago, ID_Credito, Fecha, Num_Cuota, Valor_Pagado, Interes, Capital_Cuota, Abono_Extra, Saldo_Despues, Version, ID_Grupo, Anulado`
- `ID_Grupo` apunta a los movimientos del pago (salida del bolsillo y reposición al ahorro).

## 5. Otros

**Regalos** — `ID_Regalo, Anio, ID_Persona, Idea, Estimado, Real, Aplica, ID_Mov, Notas`
**Reportes** — `ID_Reporte, Tipo, Mes, ID_Tarjeta, URL_Drive`
**Log** — `ID_Log, Fecha_Hora, Nivel, Funcion, Mensaje, Detalle`

## Invariantes (se prueban en `tests/`)

1. Saldo de bolsillo = `Saldo_Apertura` + Σ `Valor` de sus movimientos no anulados. Se puede pedir **a una fecha**.
2. Saldo de cuenta = Σ saldos de sus bolsillos. Cuadre: saldo de cuenta vs `Saldo_Real`, con diferencia explicada.
3. Una transferencia **dentro de una cuenta** suma 0. Una transferencia **entre cuentas** son dos movimientos con el mismo `ID_Grupo` en bolsillos de cuentas distintas.
4. Una cuenta con `Permite_Bolsillos = FALSE` tiene exactamente un bolsillo `General`.
5. Anular un movimiento anula todo su `ID_Grupo`.
6. **Compra de tarjeta Fuente `Ppto`:** mueve del bolsillo del renglón a la reserva en el momento de registrarla.
7. **Pagar un extracto:** en una sola operación completa la reserva desde `ID_Bolsillo_Personal` con lo que falte (traslado `Reserva_TC`), paga el total desde la reserva (gasto `Pago_TC`) y marca como pagadas sus compras; los movimientos llevan en `Notas` la marca `Extracto <ID>`. Luego `Estado = Pagado`. Fuente `Guardar` aparta desde el bolsillo personal en el momento; `Otro` no mueve dinero.
8. **Pago de crédito:** la cuota se aplica con interés sobre saldo; el excedente va a capital; se reponen en `ID_Cuenta_Ahorro` capital e interés pagados; el cronograma restante se regenera manteniendo cuota y tasa (plazo nuevo `n = ⌈ −ln(1 − saldo·i / cuota) / ln(1+i) ⌉`) y la última cuota se ajusta. Un abono mayor al saldo solo cobra lo necesario.
9. Dos escenarios distintos no pueden tener `Es_Base = TRUE` a la vez.

## Cambios frente al esquema anterior ("Cuentas")

| Antes | Ahora | Motivo |
|---|---|---|
| Bolsillos y tarjetas en una sola tabla con `Tipo` | `Cuentas` → `Bolsillos`; `Tarjetas` aparte | Nu y Nequi tienen bolsillos; las cuentas débito pueden no tenerlos |
| `Ahorro_Cuentas` + `Ahorro_Movimientos` | Cuentas `Tipo = Ahorro` y `Movimientos.Subtipo` | Un solo libro; transferencias Nequi → ahorro sin duplicar |
| Texto libre para detectar "para gastos" | `Subtipo` explícito | Evitar errores por palabras |
| `Presupuesto_Mes.Real` escrito a mano | Calculado | Una sola fuente de verdad |
| `Estado = Continuar/Congelar` | `Escenarios` | La contingencia es un presupuesto completo, no una marca |
| `Creditos` con cuota sin cronograma | `Creditos_Cronograma` versionado y `Creditos_Pagos` | Recalcular plazo con trazabilidad |
| `Nomina_Salario_Historial` | Se elimina | Sin uso; el sueldo vigente está en `Nomina_Escenarios` |
| `Servicios_Publicos.Inmueble` (texto) | `Inmuebles` + `ID_Inmueble` | Catálogo editable |
| Categoría como texto | `ID_Categoria` | Renombrar sin romper el historial |
