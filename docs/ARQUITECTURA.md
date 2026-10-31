# Arquitectura

## Visión general
```
 Navegador (celular o PC)
   index.html + app_js.html + app_css.html + tokens.html   ← SPA sin frameworks
        │  google.script.run  (una llamada por pantalla)
        ▼
   Api.gs  ── responder_() ──►  sobre { ok, data | error, ms }
        │
        ▼
   Dominio: Movimientos · Presupuesto · Nomina · Tarjetas · Creditos · Ahorro · Regalos ·
            Suscripciones · Anual · Arranque · Recordatorios · Respaldos · Vistas · Demo
        │
        ▼
   Catalogos.gs (CRUD configurable) · Saldos.gs
        │
        ▼
   Repo.gs (lectura memorizada, escrituras con bloqueo, caché)  ──►  Google Sheet (27 pestañas)
```

## Principios
1. **El Sheet es la base de datos; la lógica vive en el código.** Las pestañas se tratan como tablas: encabezados exactos, una fila por registro.
2. **Libro de movimientos.** Los saldos no se guardan: se calculan (`apertura + Σ movimientos no anulados`). Así siempre son reproducibles.
3. **Derivado, no duplicado.** El *real* del presupuesto, el ahorro de un renglón, la deuda con el ahorro y los costos de suscripciones se calculan; no hay una celda que pueda quedar desactualizada.
4. **Borrado lógico.** `Anulado` (movimientos) y `Activo` (catálogos). Nada se destruye salvo los datos de demostración.
5. **Personalización total.** Bancos, cuentas, bolsillos, tarjetas, categorías, personas, inmuebles, escenarios y apariencia son datos, no constantes.
6. **Una pantalla, una llamada.** El cliente pide todo lo que necesita en una sola llamada; cada escritura devuelve **lo que cambió** (movimientos, saldos y, si aplica, el presupuesto) y el cliente se actualiza sin recargar.
7. **Todo o nada.** Las operaciones compuestas (pagar un extracto, abonar un crédito) deshacen lo hecho si algo falla.

## Backend (`*.gs`)
| Archivo | Responsabilidad |
|---|---|
| `Code.gs` | `doGet`, control de acceso, menú del Sheet |
| `Api.gs` | Funciones públicas; validan la entrada y responden con `responder_` |
| `Setup.gs` | Esquema de las 27 tablas, enumeraciones, columnas de texto, instalación idempotente |
| `Repo.gs` | Lectura (memorizada por petición), inserción, actualización, bloqueo, caché |
| `Catalogos.gs` | Definición y CRUD de los catálogos; estado de configuración |
| `Saldos.gs` | Saldos por bolsillo, cuenta y total |
| `Movimientos.gs` | Registrar, transferir, anular, editar, listar, cuadrar |
| `Presupuesto.gs` | Plantilla, mes, real calculado, distribución de la nómina |
| `Nomina.gs` | Cálculo y registro de la nómina |
| `Tarjetas.gs` | Compras, extractos, reserva, pago atómico |
| `Creditos.gs` | Amortización francesa, cronograma versionado, pagos y abonos |
| `Ahorro.gs` | Rendimientos, retiros, reposiciones, deuda con el ahorro |
| `Regalos.gs`, `Anual.gs` | Regalos por año; vista anual |
| `Suscripciones.gs` | Cobros recurrentes y servicios |
| `Recordatorios.gs` | Próximos pagos para Inicio y sincronización con Google Calendar |
| `Arranque.gs` | Aperturas, archivo de pruebas, inicio de operación |
| `Respaldos.gs` | Copias en Drive y disparador diario |
| `Vistas.gs` | Hojas de consulta con fórmulas |
| `Demo.gs` | Datos de demostración (prefijo `demo-`) |
| `Logs.gs` | Registro de errores y hechos en la tabla `Log` |
| `Graficos.gs` | Datos de los gráficos: categorías del mes, entró/salió y saldo por mes |
| `Reinicio.gs` | Borrado total de la información de la persona (con frase de confirmación) |

## Modelo de datos (resumen)
27 pestañas en tres grupos:
- **Configuración:** Config, Bancos, Cuentas, Bolsillos, Tarjetas, Categorias, Personas, Inmuebles, Servicios_Publicos, Suscripciones, Escenarios.
- **Operación:** Movimientos, Compras_TC, Extractos, Presupuesto_Plantilla, Presupuesto_Mes, Creditos, Creditos_Cronograma, Creditos_Pagos, Regalos, Reportes, Log.
- **Nómina:** Subsidios, Nomina_Escenarios, Nomina_Conceptos, Nomina_Pagos, Nomina_Pagos_Detalle.

Detalle columna por columna en [ESQUEMA.md](ESQUEMA.md).

Convenciones:
- IDs con prefijo y UUID corto (`mov-1a2b3c4d`); los de demostración empiezan por `demo-`.
- Fechas, meses y marcas de tiempo son **texto plano** (`AAAA-MM-DD`, `AAAA-MM`) para que Sheets no las convierta.
- Todas las tablas tienen `Creado_En` y `Actualizado_En`.
- Los traslados son dos filas con el mismo `ID_Grupo` que suman cero.
- `Origen` = App · Demo · Import.

## Rendimiento
- **Memoización por petición:** cada tabla se lee una vez por llamada; una escritura invalida solo su tabla.
- **Verificación de esquema con caché** (6 h) para no leer las 27 pestañas en cada carga.
- **Caché de catálogos** con invalidación por tabla.
- El cliente anota el tiempo de cada llamada (Diagnóstico) y el servidor devuelve `ms`.

## Concurrencia
Las escrituras toman `LockService.getScriptLock()`. El bloqueo **no es reentrante**: ninguna función que lo tenga puede llamar a otra que también lo tome.

## Frontend
- JavaScript sin frameworks, en un solo `<script>` incluido desde `index.html`.
- **Estado** en el objeto `App`; **pantallas** son funciones `vXxx()` que devuelven `{ titulo, html, acciones, despues }`; `render()` las pinta.
- **Delegación de eventos** con `data-acc` (clic), `data-acc-cambio` (cambio) y `data-hoja-acc` (dentro de una hoja modal). Las acciones viven en el objeto `ACCIONES`.
- **Hojas modales** con `<dialog>` y un único registro de oyentes (`hojaActual`).
- **Cargas:** cada pantalla tiene `{ data, cargando, error }`; si una respuesta llega vieja se descarta **y se apaga `cargando`** (un `return` anticipado dejaba la pantalla esperando para siempre).
- **Errores** en lenguaje llano (`mensajeLlano`) y tope de 45 s por llamada.
- **Diseño:** tokens en `tokens.html` (claro/oscuro, 6 acentos con contraste AA verificado por `tests/contraste.js`); Apple HIG: objetivos de 44 px, `Deshacer` en lugar de `confirm()`, esqueletos de carga, barra de progreso tras 400 ms.
- **Responsivo:** pestañas abajo en el celular; barra lateral desde 768 px; Inicio en dos columnas desde 900 px.

## Seguridad
Ver [SECURITY.md](../SECURITY.md).
