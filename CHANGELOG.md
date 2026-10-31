# Cambios

## Presupuesto y tarjetas: el gasto cuenta el día de la compra (30 oct)
- **Una compra con tarjeta cuenta en su renglón y su categoría el día de la compra**; pagar el extracto ya no cuenta como gasto (ni en gráficos ni en la vista anual). Sin doble conteo con el traslado a la reserva.
- **Cada renglón recuerda su medio de pago habitual** ("Se paga con": su bolsillo o una tarjeta); Registrar lo propone.
- **Registrar un gasto con tarjeta en el mismo formulario** ("Con qué pagaste"): con renglón aparta de su bolsillo; sin renglón no aparta nada.
- **Pagar el extracto indica de qué bolsillo sale lo que falta.**
- **Suscripciones y servicios ligados al presupuesto** (columna `Renglon`).
- El presupuesto muestra cuánto de cada renglón fue con tarjeta y cuánto está por pagar en el extracto.
- Esquema 3: columnas nuevas `ID_Tarjeta` (plantilla y mes del presupuesto) y `Renglon` (suscripciones); las bases ya instaladas las ganan con **Instalar**, sin perder datos.

## Primeros pasos más simples (30 oct)
- **Cuentas con sus bolsillos y saldos en un solo paso:** al crear una cuenta que usa bolsillos se anotan ahí mismo, con lo que hay hoy en cada uno (`saveCuentaCompleta`, todo o nada).
- **Tarjetas sin callejón:** la reserva puede ir en cualquier cuenta en pesos; si esa cuenta era de un solo saldo, pasa a usar bolsillos sin perder su dinero. El asistente siempre ofrece agregar tarjetas.
- **Ayudas en los campos:** un botón "i" en cada casilla de configuración y de registro explica para qué sirve (al pasar el cursor, con el teclado o al tocar).
- **Análisis** de presupuesto frente a tarjetas: [docs/ANALISIS_PRESUPUESTO_TARJETAS.md](docs/ANALISIS_PRESUPUESTO_TARJETAS.md).

Historia por fases. Las fechas son de 2026.

## Gráficos en cada módulo
- **Nuevo** componentes de gráfico reutilizables (líneas de una o varias series, columnas agrupadas, barras ordenadas y medidores) con tooltip por hover, foco y flechas, y tabla alternativa. Se registran por pantalla y se conectan en `render()`.
- **Inicio:** saldo de 6 meses y gastos del mes (se piden aparte y se refrescan tras registrar algo). **Presupuesto:** plan frente a real. **Deudas:** cupo usado y avance de créditos; en un crédito, saldo cuota a cuota. **Ahorro:** evolución total y por cuenta, avance de metas. **Vista anual:** entró/planeado/real. **Bolsillo:** saldo al cierre de cada mes.
- Servidor: `saldosMensuales_` y `evolucion` en el detalle de bolsillo y en cada cuenta de ahorro. Tercera serie de la paleta (verde) validada; el aqua en claro queda bajo 3:1 y se compensa con leyenda y tabla.
- **Pruebas** de evolución en `tests/test_graficos.js`.

## Tasa de referencia con Google Finance
- **Nuevo** Ajustes → Divisas: botón *Actualizar ahora* e interruptor *Traerla sola de Google Finance cada día* (hoja auxiliar `Tasas_Google` con `GOOGLEFINANCE`; `TasasGoogle.gs`). La tasa muestra su fecha y fuente (Manual o Google Finance).
- Solo informativa: no interviene en saldos ni conversiones.
- **Pendiente de validar en el Sheet real:** el simulador no calcula `GOOGLEFINANCE`; las pruebas cubren la lectura y el guardado.

## Conversión con tasa del banco y comisión
- **Cambia** Convertir divisas: se escribe la cantidad y la tasa que dio el banco por unidad (la TRM solo se muestra como referencia); Moni calcula cuánto sale y cuánto llega.
- **Nuevo** comisión opcional, cobrada aparte del bolsillo de origen o de destino: gasto de la categoría *Comisión bancaria* (se crea sola) dentro de la misma conversión (`Subtipo = Comision`); se anula y restaura junto.
- **Pruebas** de comisión en `tests/test_divisas.js`.

## Recordatorios en Google Calendar
- **Nuevo** Ajustes → Recordatorios: calendario "Moni" con un evento por pago de los próximos 45 días (tarjetas, cuotas, suscripciones y servicios, prima y cesantías), con aviso el mismo día y N días antes, a la hora elegida.
- Sincronización idempotente (crea, corrige y borra por clave; no toca eventos ajenos), disparador diario, sincronización en segundo plano tras registrar cambios y botones Sincronizar ahora / Quitar.
- **Permiso** nuevo `calendar` en `appsscript.json` (hay que crear una versión nueva de la implementación y aceptarlo al abrir).
- El borrado total de datos también quita el calendario y el disparador.
- **Pruebas** `tests/test_recordatorios.js` con un Calendar simulado.

## Gráficos
- **Nuevo** Más → Gráficos: gastos por categoría del mes, entró y salió por mes, saldo al cierre de cada mes y cifras del mes con su cambio. Filtros de mes, rango (3/6/12 meses) y moneda en una sola fila.
- SVG sin librerías: marcas finas, hover/foco/teclado con tooltip, tabla con los mismos datos, claro y oscuro. Paleta de dos series validada contra las superficies de la app.
- **Pruebas** `tests/test_graficos.js` (el último saldo coincide con el total del Inicio).

## Divisas
- **Nuevo** la moneda (COP, USD o EUR) se elige al crear el banco; sus cuentas y bolsillos la heredan. Los saldos de distintas monedas no se suman: el Inicio muestra **Otras monedas** aparte, con el equivalente en pesos si anotas la tasa (Ajustes → Divisas).
- **Nuevo** **Convertir divisas** (Bolsillos): sale un valor de un bolsillo y llega otro en la otra moneda, con la tasa implícita anotada; se anula junto.
- **Nuevo** migración de esquema: `setupDatabase` agrega la columna `Divisa` a un Sheet ya instalado (Instalar). `ESQUEMA_VERSION` evita que la caché oculte cambios de esquema.
- **Regla** presupuesto, nómina, tarjetas, créditos, ahorro, suscripciones y regalos solo aceptan pesos (validado en el servidor y sin ofrecer bolsillos en otras monedas en la pantalla). Los traslados entre monedas distintas se rechazan: se usa la conversión.
- **Límite conocido** la hoja de consulta `Vista_Anual` (fórmulas) suma todas las monedas; la vista anual de la app solo suma pesos.
- **Pruebas** `tests/test_divisas.js`.

## Registro de errores
- **Nuevo** `Logs.gs`: cada error de la API, del navegador y de los disparadores queda en la tabla `Log` con función, mensaje, traza y versión (`VERSION_APP`). Se conservan las últimas 500 entradas.
- **Nuevo** Ajustes → Registro de errores: filtro Errores/Todo, detalle desplegable, copiar y limpiar.
- **Pruebas** `tests/test_logs.js`.

## Bienvenida y borrado de datos
- **Nuevo** asistente de bienvenida y primeros pasos: un paso por pantalla con barra de progreso (nombre y color, bancos, cuentas, bolsillos, tarjetas), validación en línea, "Guardar y agregar otro" y "Seguir más tarde". Reutiliza los campos de los catálogos y se retoma desde Inicio.
- **Nuevo** Ajustes → Privacidad → **Borrar todos mis datos**: pantalla informativa, ventana de confirmación que exige escribir `BORRAR` y opción de mandar también los respaldos de Drive a la papelera (`Reinicio.gs`, `resetAllData`).
- **Nuevo** token `--m-on-danger` y botón `m-btn-peligro` (legible en tema claro y oscuro; entra en `npm run contraste`).
- **Pruebas** `tests/test_reinicio.js`.

## Ajustes tras probar en el Sheet real (28 oct)
- **Corrige** pantallas que se quedaban cargando para siempre (presupuesto y otras seis) cuando llegaba una respuesta vieja; añade tope de 45 s.
- **Corrige** la barra superior en PC (margen duplicado).
- **Nuevo** Inicio con accesos rápidos y dos columnas en PC.
- **Nuevo** módulo de **servicios y suscripciones** (tabla `Suscripciones`; ya son 27 tablas).
- **Nuevo** se pueden crear datos de demostración sobre datos reales (antes del arranque).
- **Docs** comparativa de UX; documentación completa; `.gitignore` ampliado; el ID del Sheet sale del código.

## Fase 7 — Rendimiento, estados y navegación (parte técnica)
Tiempos por llamada (cliente y servidor) en Diagnóstico, errores en lenguaje llano, avisos con duración según el largo y cierre, próximos pagos en Inicio. Pendiente: mediciones en el Sheet real y sesión con la usuaria.

## Fase 6 — Arranque
Pantalla de Arranque (lista de verificación, saldos de apertura en bloque, archivo de pruebas, iniciar operación con respaldo) y guía de uso.

## Fase 5 — Ahorro, regalos y vistas
Ahorro con rendimientos y deuda, regalos por año, vista anual, respaldos manuales y automáticos, hojas de consulta con fórmulas (`Vista_Bolsillos`, `Vista_Anual`).

## Fase 4 — Tarjetas y autopago
Compras, reserva, extractos con pago atómico; créditos de autopago con cronograma francés, abonos con recálculo de plazo y reposición al ahorro.

## Fase 3 — Presupuesto y nómina
Plantilla por escenario, mes generado, real calculado, distribución de nómina, calculadora de nómina, modo contingencia.

## Fase 2 — Núcleo contable
Movimientos, traslados, saldos y saldo a fecha, cuadre, anulaciones; pantallas de Registrar y Bolsillos.

## Fase 1 — Instalación y configuración
`setupDatabase`, catálogos configurables, asistente de primera ejecución, datos de demostración.

## Fase 0 — Fundaciones
Repositorio, `clasp`, esquema, tokens de diseño y componentes base (HIG).
