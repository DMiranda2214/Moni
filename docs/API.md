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
| `addMovimiento` | `m, vista` — `m.Afecta_Saldos = false` lo registra como histórico (cuenta en informes, no en saldos) |
| `getCargosSugeridos` | `operacion, ctx { idBolsillo, idTarjeta, idCredito, valor }` — los cargos (comisiones, impuestos…) que proponen las reglas de *Cargos y comisiones* para esa operación |
| `addTransferencia` | `t { origen, destino, valor, fecha, concepto, notas, itemPpto, afectaSaldos }, vista` (con `afectaSaldos: false` es un traslado histórico) |
| `voidMovimiento` | `idMov, vista` |
| `voidVarios` | `ids, vista` |
| `restoreMovimiento` | `idMov, vista` |
| `editMovimiento` | `idMov, cambios, vista` — `cambios.Afecta_Saldos` pasa un movimiento a histórico o de vuelta |
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
| `payRenglonMes` | `idItem, pagado` (solo la marca de "completo"; la app la usa al decir "bastan los registrados" y al reabrir) |
| `getSugerenciasConceptos` | — → `{ Gasto: [...], Ingreso: [...] }` con `Concepto, Usos, ID_Bolsillo, ID_Categoria, ID_Item_Ppto, Valor` de lo último registrado |
| `payRenglonConfirmado` | `idItem, datos { Valor, Fecha, ID_Bolsillo, ID_Mov, Completar? }, vista?` (con `Completar: false` solo agrega el movimiento, sin completar el renglón) — registra el pago según el tipo del renglón (gasto, tarjeta, cuota de crédito, traslado a ahorro/fondo) o enlaza un movimiento existente (`ID_Mov`), y lo marca pagado |
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
| `getTarjeta` | `idTarjeta, mes` (devuelve `meses[]` con `mes, total, pagado, numCompras, abierto, desde, hasta, pago`, y `corte` del mes pedido) |
| `addCompraTC` | `c` |
| `addGastoTarjeta` | `c, vista` — gasto pagado con tarjeta desde Registrar; con renglón aparta el dinero de su bolsillo, sin renglón no aparta nada |
| `voidGastoTarjeta` | `idCompra, idItem, vista` |
| `voidCompraTC` | `idCompra` |
| `restoreCompraTC` | `idCompra` |
| `payExtracto` | `idTarjeta, mes, fecha, idOrigen, aportes?` (`aportes`: `[{ Pagador, Valor }]` de terceros; descuenta además lo ya abonado) |
| `addAbonoTarjeta` | `{ ID_Tarjeta, Mes, Valor, Fecha, Pagador?, ID_Bolsillo? }` — sin `Pagador` sale de `ID_Bolsillo`; con `Pagador` es de un tercero y no mueve bolsillos |
| `voidAbonoTarjeta` | `idPago` |
| `voidPagoExtracto` | `idExtracto` |
| `previewCredito` | `c` |
| `addCredito` | `c` |
| `getCredito` | `idCredito` |
| `previewPagoCredito` | `idCredito, valor` |
| `payCredito` | `idCredito, valor, fecha, idBolsillo` |
| `fixTasaCredito` | `idCredito, datos` — corrige la tasa de un crédito creado cuando las tasas se redondeaban (solo rehace las cuotas pendientes) |
| `voidPagoCredito` | `idPago` |
| `editPagoCredito` | `idCredito, numCuota, valor` — corrige lo pagado en una cuota ya pagada y rehace el cronograma; no toca saldos |
| `saveCredito` | `idCredito, datos` |
| `cancelCredito` | `idCredito` |

## Ahorro, Lista de deseos y vistas

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
| `payRegalo` | `idRegalo, valor, idBolsillo, fecha` (con `idBolsillo` = `"T:<idTarjeta>"` es una compra con tarjeta; `getRegalos` trae `pendientes[]`: lo que falta mover a la reserva) |
| `saveIdeaDeseo` | `{ ID_Idea?, ID_Regalo, Texto, Precio, Enlace }` — agrega o edita una idea de la lluvia de ideas; devuelve la lista del año |
| `deleteIdeaDeseo` | `idIdea` |
| `chooseIdeaDeseo` | `idIdea` — la idea pasa a ser la del deseo (y su precio, el estimado si estaba en 0) |
| `getAnual` | `anio` |

La **Lista de deseos** usa la tabla `Regalos`: `getRegalos` trae por cada deseo `ParaMi`, `Categoria`, `Estado`, `ideas[]`…, y además `porPersona`, `porCategoria` y `totales.paraMi / paraOtros`. `saveRegalo` acepta `Para: 'Yo'` (sin persona), `Categoria`, `Ocasion`, `Prioridad`, `Estado`, `Enlace`, `Fecha_Objetivo` y `Precio_Pagado` (comprado sin registrar el gasto).

## Metas

| Función | Parámetros |
|---|---|
| `getMetas` | — → `{ items[], archivadas[], totales { objetivo, ahorrado, falta, planMes, aportadoMes, cantidad }, mes }`; cada meta trae `plan[] { mes, plan, aportado, manual, pasado }`, `acumulado[]`, `estado` (`al_dia`, `atrasada`, `vencida`, `lograda`, `cumplida`, `pausada`), `porMesParaLlegar`, `sinCubrir` y `movimientos[]` |
| `saveMeta` | `meta` — crea o edita (`Nombre, Motivo, Monto_Objetivo, Ahorro_Inicial, Fecha_Inicio, Fecha_Fin, ID_Bolsillo, Estado, Notas`) y pone al día sus renglones del presupuesto; la app usa `saveCatalogo('Metas', …)` |
| `saveMetaPlan` | `idMeta, plan` — `{ 'AAAA-MM': valor }` de los meses escritos a mano (un mes vacío vuelve al reparto automático) |
| `addAporteMeta` | `idMeta, idOrigen, valor, fecha` — traslado al bolsillo de la meta (cuenta en el renglón del mes si existe) |
| `addUsoMeta` | `idMeta, valor, fecha, concepto, idCategoria` — gasto desde el bolsillo de la meta |
| `archiveMeta` / `restoreMeta` | `idMeta` |

`addSuscripcionesPpto` y `generarPresupuesto` también agregan los renglones de las metas (tipo `Fondo`); `getPresupuesto` trae `faltanMetas`.

## Inversiones

| Función | Parámetros |
|---|---|
| `getInversiones` | — → `{ items[], archivadas[], totales { costo, valor, ganancia, rentabilidad, realizado, dividendos }, porTipo[], evolucion[] (12 meses), faltaTasa[], ultimaActualizacion, automatico }` |
| `saveInversion` | `inv` (`Nombre, Tipo, Simbolo, Divisa, Precio_Manual, Notas`); la app usa `saveCatalogo('Inversiones', …)` |
| `archiveInversion` | `id` (solo sin unidades) |
| `addOperacionInversion` | `{ ID_Inversion, Fecha, Tipo: Compra\|Venta\|Dividendo, Cantidad, Precio, Valor (pesos), Comision, ID_Bolsillo?, Notas }`. En una inversión de un broker: `Total` y `Comision` en la moneda del broker, sin bolsillo |
| `moveDineroBroker` | `{ ID_Broker, Tipo: Deposito\|Retiro, Fecha, Valor (moneda del broker), ID_Bolsillo?, Valor_Bolsillo? (si el bolsillo está en otra moneda), Notas }` |
| `setDisponibleBroker` | `(idBroker, valor, fecha)`: deja el disponible en ese valor, sin mover bolsillos |
| `setCantidadInversion` | `(idInversion, { Cantidad, Precio? (promedio), Fecha? })`: deja la cantidad, sin mover dinero |
| `voidOperacionInversion` | `idOperacion` (devuelve el dinero al bolsillo) |
| `savePrecioManual` | `idInversion, precio, fecha` |
| `updatePreciosGoogle` | — lee los precios de la hoja auxiliar `Precios_Google` (también lo hace la tarea diaria de la tasa del dólar) |
| `searchSimbolo` | `texto` — prueba el símbolo en las bolsas comunes con `GOOGLEFINANCE` (hoja auxiliar `Buscar_Google`) → `[{ simbolo, nombre, precio, divisa, tipo }]` |

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
| `getAnalisis` | — → la pantalla Análisis completa: patrimonio de 12 meses, flujo, categorías, deudas, proyección de 90 días y cargos del año |
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
