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
- Los parámetros gestionados por la app (`Datos_Demo`, `Fecha_Arranque`, `Arranque_Hecho`) no se editan desde `saveConfigParam`.

## Arranque de la app

| Función | Parámetros |
|---|---|
| `getBootstrap` | — |
| `instalarBaseDatos` | — |
| `runDiagnostics` | — |
| `getSaldos` | `hastaFecha` |

## Catálogos

| Función | Parámetros |
|---|---|
| `listCatalogo` | `tabla, incluirInactivos` |
| `saveCatalogo` | `tabla, item, opciones` |
| `disableCatalogo` | `tabla, id` |
| `enableCatalogo` | `tabla, id` |

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
| `payRenglonMes` | `idItem, pagado` |
| `previewDistribucion` | `mes, idOrigen` |
| `distribuir` | `mes, idOrigen, fecha, forzar` |
| `getNomina` | `periodo, idEscenario` |
| `registrarNomina` | `periodo, idEscenario, netoReal, fecha, idBolsillo` |
| `anularNomina` | `periodo` |

## Tarjetas y créditos

| Función | Parámetros |
|---|---|
| `getDeudas` | — |
| `getTarjeta` | `idTarjeta, mes` |
| `addCompraTC` | `c` |
| `voidCompraTC` | `idCompra` |
| `restoreCompraTC` | `idCompra` |
| `payExtracto` | `idTarjeta, mes, fecha` |
| `voidPagoExtracto` | `idExtracto` |
| `previewCredito` | `c` |
| `addCredito` | `c` |
| `getCredito` | `idCredito` |
| `previewPagoCredito` | `idCredito, valor` |
| `payCredito` | `idCredito, valor, fecha, idBolsillo` |
| `voidPagoCredito` | `idPago` |
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
| `undoPagoSuscripcion` | `id, anterior, idMov, idCompra` |
| `skipSuscripcion` | `id` |
| `getProximos` | — |

## Respaldos, demostración y parámetros

| Función | Parámetros |
|---|---|
| `getRespaldos` | — |
| `makeRespaldo` | — |
| `setRespaldoAuto` | `activar` |
| `seedDemo` | — |
| `clearDemo` | — |
| `resetAllData` | `confirmacion` (debe ser `BORRAR`), `opciones` (`{ respaldos: true }` manda también las copias de Drive a la papelera) |
| `saveConfigParam` | `clave, valor` |
| `saveConfigParams` | `mapa` |
| `resetConfigParam` | `clave` |

## Arranque (1 de enero)

| Función | Parámetros |
|---|---|
| `getArranque` | — |
| `setFechaArranque` | `fecha` |
| `saveAperturas` | `lista` |
| `archiveTests` | — |
| `startOperation` | — |

