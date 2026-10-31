# Cambios

Historia por fases. Las fechas son de 2026.

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
