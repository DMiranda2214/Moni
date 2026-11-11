# API interna

Funciones públicas de `Api.gs` que el frontend invoca con `google.script.run`. Todas devuelven el sobre:

```json
{ "ok": true,  "data": { … }, "ms": 42 }
{ "ok": false, "error": { "message": "…" }, "ms": 3 }
```

`ms` es el tiempo en el servidor (milisegundos). El cliente (`api()` en `app_js.html`) rechaza la promesa con el mensaje si `ok` es falso, traduce los errores de red a lenguaje llano y corta a los 45 s.

## Reglas

- **Una pantalla, una llamada:** las lecturas devuelven todo lo que la pantalla necesita.
- **Las escrituras devuelven lo que cambió:** `items` (movimientos afectados, listos para mostrar), `ultimos`, `saldos` y, si afectan un renglón, `presupuesto`. Algunas añaden más (`suscripciones`, `anterior`, `idMov`…).
- Los catálogos solo se exponen si están declarados en `CATALOGOS` (`exigirCatalogo_`).
- Los parámetros gestionados por la app (los de demostración, avisos ocultos, tasas de divisas, recordatorios y `Calendario_ID`; ver [ESQUEMA.md](ESQUEMA.md#1-configuración-la-edita-la-usuaria-en-ajustes)) no se editan desde `saveConfigParam`.
- Toda función pública de Apps Script se puede invocar desde fuera de la interfaz, así que **cada una valida su entrada** y la app corre "como la persona que accede": nadie lee ni escribe más que su propia hoja.
- Los errores se anotan en el registro (`Log`): un fallo de código es *Error* y una regla de negocio rechazada es *Aviso* (`responder_` los clasifica).

## Arranque de la app

| Función | Parámetros |
|---|---|
| `getBootstrap` | — |
| `instalarBaseDatos` | — |
| `runDiagnostics` | — |
| `getSaldos` | `hastaFecha` *(la interfaz no la llama —los saldos vienen en el arranque y en cada escritura—; la usa `tests/medir_llamadas.js`)* |
| `getRefresco` | `{ tablas, config }` — refresco liviano tras guardar: solo lo que cambió (catálogos, saldos, lo invertido, estado del asistente y avisos) |
| `refreshCache` | — — "Actualizar desde la hoja": olvida lo memorizado para releer todo (por si se editó la hoja a mano) |

## Catálogos

| Función | Parámetros |
|---|---|
| `listCatalogo` | `tabla, incluirInactivos` *(la interfaz no la llama —los catálogos vienen en el arranque—; la usan las pruebas de acceso por persona y de la lista de catálogos permitidos)* |
| `saveCatalogo` | `tabla, item, opciones` |
| `disableCatalogo` | `tabla, id` |
| `enableCatalogo` | `tabla, id` |
| `saveCuentaCompleta` | `cuenta, bolsillos` — una cuenta con sus bolsillos y saldos de una vez (asistente de primeros pasos) |
| `saveNominaInicial` | `esc, subsidios` — la nómina y sus subsidios de una vez (asistente) |

## Movimientos

| Función | Parámetros |
|---|---|
| `addMovimiento` | `m, vista` |
| `addTransferencia` | `t, vista` |
| `voidMovimiento` | `idMov, vista` |
| `voidVarios` | `ids, vista` |
| `restoreMovimiento` | `idMov, vista` |
| `editMovimiento` | `idMov, cambios, vista` |
| `getMovimientos` | `filtro` |
| `getDetalleBolsillo` | `idBolsillo, mes, incluirAnulados` |
| `cuadre` | `idCuenta, saldoReal, idBolsilloAjuste, vista` |

## Presupuesto y nómina

| Función | Parámetros |
|---|---|
| `getPresupuesto` | `mes` |
| `generarPresupuesto` | `mes, idEscenario, reemplazar` |
| `saveRenglonMes` | `item` |
| `deleteRenglonMes` | `idItem` |
| `payRenglonMes` | `idItem, pagado` (solo la marca; la app usa las tres siguientes) |
| `payRenglonConfirmado` | `idItem, datos { Valor, Fecha, ID_Bolsillo, ID_Mov }, vista?` — registra el pago según el tipo del renglón (gasto, tarjeta, cuota de crédito, traslado a ahorro/fondo) o enlaza un movimiento existente (`ID_Mov`), y lo marca pagado |
| `listMovimientosParaRenglon` | `idItem` — movimientos sueltos que se pueden enlazar a ese renglón |
| `unpayRenglon` | `idItem, anular, vista?` — desmarca; con `anular` también anula los pagos sencillos que registró |
| `previewDistribucion` | `mes, idOrigen` |
| `distribuir` | `mes, idOrigen, fecha, forzar` |
| `getNomina` | `periodo, idEscenario, opciones` |
| `registrarNomina` | `periodo, idEscenario, netoReal, fecha, idBolsillo, opciones, afectaSaldos?, mesPresupuesto?` — con `afectaSaldos = false` no crea movimiento ni pide bolsillo; `mesPresupuesto` (AAAA-MM) es el mes del presupuesto en que cuenta (por defecto, el que paga) |
| `changeMesNomina` | `periodo, mesNuevo` — cambia el mes del presupuesto de una nómina ya registrada; no toca saldos |
| `saveMiNomina` | `sueldo, periodo, opciones` — el sueldo base (crea la nómina la primera vez) y devuelve la nómina del mes |
| `saveConceptoNomina` | `d, periodo, opciones` — un descuento o ingreso fijo (libranza, medicina prepagada, bono…) |
| `removeConceptoNomina` | `idConcepto, periodo, opciones` |
| `addSuscripcionesPpto` | `mes` — agrega al presupuesto del mes las suscripciones y servicios que toca pagar y todavía no están |
| `anularNomina` | `periodo` |

## Tarjetas y créditos

| Función | Parámetros |
|---|---|
| `getDeudas` | — |
| `getTarjeta` | `idTarjeta, mes` |
| `addCompraTC` | `c` |
| `addGastoTarjeta` | `c, vista` — gasto pagado con tarjeta desde Registrar; con renglón aparta el dinero de su bolsillo, sin renglón no aparta nada |
| `voidGastoTarjeta` | `idCompra, idItem, vista` |
| `voidCompraTC` | `idCompra` |
| `restoreCompraTC` | `idCompra` |
| `payExtracto` | `idTarjeta, mes, fecha, idOrigen` |
| `voidPagoExtracto` | `idExtracto` |
| `previewCredito` | `c` |
| `addCredito` | `c` |
| `getCredito` | `idCredito` |
| `previewPagoCredito` | `idCredito, valor` |
| `payCredito` | `idCredito, valor, fecha, idBolsillo` |
| `voidPagoCredito` | `idPago` |
| `editPagoCredito` | `idCredito, numCuota, valor` — corrige lo pagado en una cuota ya pagada y rehace el cronograma; no toca saldos |
| `saveCredito` | `idCredito, datos` |
| `cancelCredito` | `idCredito` |

## Ahorro, regalos y vistas

| Función | Parámetros |
|---|---|
| `getAhorro` | — |
| `getCuentaAhorro` | `idCuenta, mes` |
| `addRendimiento` | `r` |
| `withdrawAhorro` | `idCuenta, idDestino, valor, fecha, concepto` |
| `repayAhorro` | `idCuenta, idOrigen, valor, fecha, concepto` |
| `getRegalos` | `anio` |
| `saveRegalo` | `r` |
| `deleteRegalo` | `idRegalo` |
| `payRegalo` | `idRegalo, valor, idBolsillo, fecha` |
| `getAnual` | `anio` |

## Servicios y suscripciones

| Función | Parámetros |
|---|---|
| `getSuscripciones` | — |
| `paySuscripcion` | `id, datos` |
| `undoPagoSuscripcion` | `id, anterior, idMov, idCompra, idItem` |
| `skipSuscripcion` | `id` |
| `getProximos` | — |

## Respaldos, demostración y parámetros

| Función | Parámetros |
|---|---|
| `getRespaldos` | — |
| `makeRespaldo` | — |
| `setRespaldoAuto` | `activar` |
| `seedDemo` | — *(solo en desarrollo: exige `DEMO_HABILITADO`)* |
| `clearDemo` | — |
| `saveConfigParam` | `clave, valor` |
| `saveConfigParams` | `mapa` |
| `resetConfigParam` | `clave` *(vuelve un parámetro a su valor por defecto; la interfaz aún no la llama, la cubre una prueba)* |
| `resetAllData` | `confirmacion` (debe ser `BORRAR`), `opciones` (`{ respaldos: true }` manda también las copias de Drive a la papelera) |

## Divisas, gráficos y registro de errores

| Función | Parámetros |
|---|---|
| `addConversion` | `conversion` (`{ origen, destino, valorOrigen, valorDestino, comision, comisionEn: 'origen'\|'destino', fecha, notas }`), `vista` |
| `saveTasaDivisa` | `divisa` (`USD`/`EUR`), `tasa` (vacío = quitar) |
| `updateTasasGoogle` | — |
| `saveTasaAuto` | `activar` |
| `getGraficos` | `opciones` (`{ mes: 'AAAA-MM', meses: 3\|6\|12, divisa }`) |
| `getLogs` | `opciones` (`{ soloErrores, limite }`) |
| `clearLogs` | — |
| `logClientError` | `mensaje, detalle` *(el navegador reporta sus errores aquí; no pasa por `responder_`)* |

## Recordatorios en Google Calendar

| Función | Parámetros |
|---|---|
| `getRecordatorios` | — |
| `saveRecordatorios` | `ajustes` (`{ activos, diasAntes (0-7), hora (5-21), nomina }`) |
| `syncRecordatorios` | — |
| `removeRecordatorios` | — |

## Ingresos recurrentes

Ingresos distintos de la nómina (otro trabajo, arriendo, ventas…). Crear o editar uno va por `saveCatalogo('Ingresos_Recurrentes', …)`.

| Función | Parámetros |
|---|---|
| `getIngresosRecurrentes` | — |
| `getProximosIngresos` | — *(lo que se espera recibir; se pide aparte del arranque)* |
| `receiveIngreso` | `id, datos` |
| `undoIngreso` | `id, anterior, idMov` |
| `skipIngreso` | `id` |

## Mi cuenta (varias personas)

Una hoja por persona ([MULTIUSUARIO.md](MULTIUSUARIO.md)). Las usa la pantalla de bienvenida y *Ajustes → Mi cuenta*; el estado de la cuenta (`cuenta`) viaja en `getBootstrap`.

| Función | Parámetros |
|---|---|
| `createMySheet` | — *(crea la hoja de la persona; si falta tiempo devuelve `parcial` y se repite)* |
| `linkMySheet` | `enlace` (el enlace o el ID de una hoja de Moni o en blanco, con permiso de edición) |
| `unlinkMySheet` | — *(suelta la hoja actual sin borrarla y apaga sus copias y recordatorios)* |

## CDT y avisos

| Función | Parámetros |
|---|---|
| `getCdts` | — |
| `collectCdtInteres` | `id`, `{ Interes, Retencion, ID_Bolsillo, Fecha }` |
| `closeCdt` | `id`, `{ Capital, Interes, Retencion, ID_Bolsillo, Fecha, Renovar }` |
| `voidCdt` | `id` |
| `dismissAviso` | `id` |
| `restoreAvisos` | — |

Crear o editar un CDT va por `saveCatalogo('CDTs', item, { descontar, ID_Bolsillo_Origen })`. `getBootstrap` trae `invertido` y `avisos`.
