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
   Dominio: Movimientos · Presupuesto · Nomina · Tarjetas · Creditos · Ahorro · CDT · Ingresos ·
            Regalos · Suscripciones · Anual · Graficos · Avisos · Recordatorios · TasasGoogle ·
            Respaldos · Vistas · Logs · Reinicio · Multiusuario · Demo (solo desarrollo)
        │
        ▼
   Catalogos.gs (CRUD configurable) · Saldos.gs
        │
        ▼
   Repo.gs (libro abierto una vez por petición, lectura memorizada, caché, escrituras con bloqueo)
        │
        ▼
   Google Sheet de la persona (29 pestañas)
```

**Una aplicación, muchas hojas.** Con `MODO_MULTIUSUARIO` la web app corre *como la persona que accede* y cada una trabaja con **su** hoja: el ID, la caché, el bloqueo y los activadores son de esa persona (ver [MULTIUSUARIO.md](MULTIUSUARIO.md)). Sin esa propiedad, la app usa la hoja única del script.

**Dos entornos.** Desarrollo (con datos de demostración) y producción (sin ellos: el paquete reemplaza `Demo.gs` por un archivo vacío). Ver [DESPLIEGUE.md](DESPLIEGUE.md).

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
| `Setup.gs` | Esquema de las 29 tablas, enumeraciones, columnas de texto, parámetros por defecto, instalación idempotente por partes y migración de columnas |
| `Repo.gs` | Lectura (memorizada por petición), inserción, actualización, bloqueo, caché y propiedades de la persona (`modoMultiusuario_`, `propiedades_`, `cache_`, `tomarBloqueo`) |
| `Catalogos.gs` | Definición y CRUD de los catálogos; estado de configuración |
| `Saldos.gs` | Saldos por bolsillo, cuenta y total |
| `Movimientos.gs` | Registrar, transferir, anular, editar, listar, cuadrar |
| `Presupuesto.gs` | Plantilla, mes, real calculado, distribución de la nómina |
| `Nomina.gs` | Cálculo y registro de la nómina |
| `Tarjetas.gs` | Compras, extractos, reserva, pago atómico |
| `Creditos.gs` | Amortización francesa, cronograma versionado, pagos y abonos |
| `Ahorro.gs` | Rendimientos, retiros, reposiciones, deuda con el ahorro |
| `CDT.gs` | CDT: intereses, apertura, pagos periódicos, cobro, renovación y lo invertido |
| `Avisos.gs` | Avisos de Inicio: configuración que falta o datos desactualizados |
| `Ingresos.gs` | Ingresos recurrentes distintos de la nómina: concepto, monto, bolsillo de llegada, próximo cobro y recibirlo |
| `Regalos.gs`, `Anual.gs` | Regalos por año; vista anual |
| `Suscripciones.gs` | Cobros recurrentes y servicios |
| `Recordatorios.gs` | Próximos pagos para Inicio y sincronización con Google Calendar |
| `Respaldos.gs` | Copias en Drive y disparador diario |
| `Vistas.gs` | Hojas de consulta con fórmulas |
| `Demo.gs` | Datos de demostración (prefijo `demo-`). **Solo desarrollo**: producción lo reemplaza por `scripts/stubs/Demo.gs` |
| `Multiusuario.gs` | Una hoja por persona: crear o vincular la hoja, desvincular, modo multiusuario |
| `Logs.gs` | Registro de errores y hechos en la tabla `Log` |
| `Graficos.gs` | Datos de los gráficos: categorías del mes, entró/salió, saldo por mes y evolución de un bolsillo o cuenta |
| `TasasGoogle.gs` | Tasa de referencia desde Google Finance (hoja auxiliar `Tasas_Google`) |
| `Reinicio.gs` | Borrado total de la información de la persona (con frase de confirmación) |

## Modelo de datos (resumen)
29 pestañas en cinco grupos:
- **Configuración:** Config, Bancos, Cuentas, Bolsillos, Tarjetas, Categorias, Personas, Inmuebles, Servicios_Publicos, Suscripciones, CDTs, Ingresos_Recurrentes, Escenarios.
- **Operación:** Movimientos, Compras_TC, Extractos, Presupuesto_Plantilla, Presupuesto_Mes.
- **Nómina:** Subsidios, Nomina_Escenarios, Nomina_Conceptos, Nomina_Pagos, Nomina_Pagos_Detalle.
- **Créditos:** Creditos, Creditos_Cronograma, Creditos_Pagos.
- **Otros:** Regalos, Reportes, Log.

Además hay pestañas auxiliares que no son tablas de datos: `Tasas_Google` (fórmulas de `GOOGLEFINANCE`) y las hojas de consulta `Vista_Bolsillos` y `Vista_Anual`.

Detalle columna por columna en [ESQUEMA.md](ESQUEMA.md).

Convenciones:
- IDs con prefijo y UUID corto (`mov-1a2b3c4d`); los de demostración empiezan por `demo-`.
- Fechas, meses y marcas de tiempo son **texto plano** (`AAAA-MM-DD`, `AAAA-MM`) para que Sheets no las convierta.
- Todas las tablas tienen `Creado_En` y `Actualizado_En`.
- El dinero va **en la moneda del banco** de la cuenta (`COP`, `USD` o `EUR`). Los saldos de monedas distintas nunca se suman; presupuesto, nómina, tarjetas, créditos, ahorro con deuda, suscripciones y regalos solo usan pesos.
- Los traslados son dos filas con el mismo `ID_Grupo` que suman cero.
- `Origen` = App · Demo · Import.

## Rendimiento
- **Libro abierto una vez por petición** y **memoización por petición:** cada tabla se lee una vez por llamada; una escritura invalida solo su tabla.
- **Caché de todas las tablas**, guardada en trozos: catálogos 1 h (`CACHE_TTL_SECONDS`), movimientos y demás tablas de operación 10 min (`CACHE_TTL_MOVIMIENTOS`). Toda escritura de la app invalida su tabla; *Ajustes → Actualizar desde la hoja* fuerza la relectura. Con caché, cargar la app casi no lee la hoja (`node tests/medir_llamadas.js` cuenta las llamadas por operación).
- **Revisión del esquema recordada 6 h**, con una firma (`ESQUEMA_VERSION` + `VERSION_APP`): cada versión nueva de la app vuelve a revisar la hoja, y si falta una tabla se olvida lo recordado.
- **Instalación por partes:** crear las pestañas va en pasos de unos 20 s (`PRESUPUESTO_INSTALACION_MS`); si se acaba el tiempo devuelve `parcial` y la pantalla continúa donde quedó, sin chocar con el límite de Apps Script.
- **Refrescos livianos:** guardar un catálogo pide solo lo que cambió (`getRefresco`); los próximos pagos y los ingresos por recibir se piden aparte, con la pantalla ya pintada.
- El cliente anota el tiempo de cada llamada (Diagnóstico) y el servidor devuelve `ms`.

## Esquema y migraciones
- `setupDatabase` es **idempotente**: crea lo que falta y no borra nada. Las columnas agregadas después de la primera versión se declaran en `MIGRACIONES_COLUMNAS` (`Setup.gs`) y `migrarColumnas_` las inserta en su lugar, con un valor por defecto, en hojas ya creadas.
- Una pestaña con **otras** diferencias (encabezados editados a mano) no se toca: se reporta en *Diagnóstico*.
- Con varias personas la hoja de cada una se actualiza sola la primera vez que entra tras una versión nueva; con una sola hoja la app ofrece **Instalar**.

## Concurrencia
Las escrituras toman un bloqueo (`tomarBloqueo` en `Repo.gs`): el de **la persona** (`getUserLock`) en modo multiusuario y el del **script** (`getScriptLock`) con una sola hoja. Por eso dos personas con hojas distintas nunca se esperan, y dos pestañas de la misma persona no se pisan. El bloqueo **no es reentrante**: ninguna función que lo tenga puede llamar a otra que también lo tome. Dos personas que compartan **una misma hoja** (pareja) tienen bloqueos distintos: si escriben exactamente a la vez podrían pisarse.

## Frontend
- JavaScript sin frameworks, en un solo `<script>` incluido desde `index.html`.
- **Estado** en el objeto `App`; **pantallas** son funciones `vXxx()` que devuelven `{ titulo, html, acciones, despues }`; `render()` las pinta.
- **Delegación de eventos** con `data-acc` (clic), `data-acc-cambio` (cambio) y `data-hoja-acc` (dentro de una hoja modal). Las acciones viven en el objeto `ACCIONES`.
- **Hojas modales** con `<dialog>` y un único registro de oyentes (`hojaActual`).
- **Cargas:** cada pantalla tiene `{ data, cargando, error }`; si una respuesta llega vieja se descarta **y se apaga `cargando`** (un `return` anticipado dejaba la pantalla esperando para siempre).
- **Errores** en lenguaje llano (`mensajeLlano`) y tope de 45 s por llamada.
- **Diseño:** tokens en `tokens.html` (claro/oscuro, 6 acentos con contraste AA verificado por `tests/contraste.js`); Apple HIG: objetivos de 44 px, `Deshacer` en lugar de `confirm()`, esqueletos de carga, barra de progreso tras 400 ms.
- **Navegación y responsivo:** cuatro áreas (`TABS` y `AREA_DE_RUTA` en `app_js.html`: Inicio, Dinero, Planear, Deudas). En el celular, barra inferior con el botón **+** central (`abrirMenuRegistrar`); desde 768 px, barra lateral contraíble (preferencia en `localStorage`), búsqueda **Ctrl K** (`abrirBuscador`) y atajo **N**. Inicio en dos columnas desde 900 px; el asistente suma un panel de pasos y una vista previa de la cuenta desde 900 y 1240 px.
- **Ícono de la pestaña:** `doGet` llama a `setFaviconUrl` con `assets/icono.png` del repositorio (propiedad de script opcional `ICONO_URL` para cambiarlo; solo https).
- **Asistente de primeros pasos:** `PASOS_ASIST` define los pasos (tú, bancos, cuentas, bolsillos, tarjetas, nómina, ingresos, CDT, hogar, servicios, suscripciones y dólar); reutiliza los campos de los catálogos (`CAT`) y se retoma desde Inicio.
- **Gráficos:** SVG sin librerías. Los componentes (`vizLinea`, `vizColumnas`, `vizBarrasH`, `vizMedidores`) se registran en `VIZ` al armar el HTML y `render()` llama a `activarViz()` para el hover, el foco y las flechas. Una sola moneda por gráfico y una tabla alternativa en cada uno.
- **Errores del navegador** se reportan al registro del servidor (`logClientError`) con un tope por sesión.

## Seguridad
Ver [SECURITY.md](../SECURITY.md).
