# Moni

Finanzas personales sobre **Google Sheets** con una aplicación web hecha en **Google Apps Script**. Ordena tus bolsillos, presupuesto, tarjetas, créditos, suscripciones y nómina colombiana, con una interfaz pensada para el celular y el computador. Versión **1.5.1**.

- **Tus datos son tuyos:** viven en un Google Sheet de tu cuenta. No hay servidores de terceros.
- **Una persona, una pareja o muchas:** una hoja compartida, o una app única con **una hoja por persona** ([ver](docs/MULTIUSUARIO.md)).
- **Todo es configurable:** bancos (en pesos, dólares o euros), cuentas, bolsillos, tarjetas, categorías, personas, escenarios y apariencia.
- **Código abierto (MIT):** este repositorio es **público** para que más gente pueda usar, revisar y mejorar la app. Los datos de cada persona **nunca** están aquí (ver [Seguridad](SECURITY.md)).

## Qué hace

| Módulo | Para qué sirve |
|---|---|
| **Inicio** | Resumen (con otras monedas aparte), avisos de lo que falta configurar, accesos rápidos, gráficos, próximos pagos y últimos movimientos |
| **Bolsillos** | Saldo de cada cuenta y bolsillo; registrar, mover dinero y cuadrar con el banco |
| **Presupuesto** | Plantilla por escenario, mes generado (con tus suscripciones y servicios), "real" calculado de tus movimientos |
| **Nómina** | Tu sueldo y descuentos fijos, más lo de cada mes (horas extras, cesantías, prima, descuentos de la empresa); estimado con salud, pensión y prestaciones, y reparto a bolsillos |
| **Otros ingresos** | Ingresos recurrentes (otro trabajo, arriendo, ventas…) con su cuenta de destino |
| **Deudas** | Tarjetas de crédito (reserva, extracto, pago) y créditos de autopago con amortización francesa |
| **CDT** | Lo que tienes a plazo fijo: capital "invertido" (no disponible), lo que ganarás, vencimientos, cobro y renovación |
| **Ahorro** | Rendimientos (interés, retención, GMF), retiros para gastos y lo que se debe reponer |
| **Servicios y suscripciones** | Cobros que se repiten, costo mensual/anual, pagar en un toque, códigos y enlaces de pago |
| **Regalos** | Lista por año con estimado y gasto real |
| **Vista anual** | Mes a mes: ingreso, plan, real, ahorro y restante |
| **Gráficos** | Dentro de cada módulo: Inicio, Movimientos, Presupuesto, Nómina, Servicios, Regalos, CDT, Deudas, Ahorro, Vista anual y cada bolsillo) |
| **Monedas** | Cuentas en dólares o euros sin mezclarlas con los pesos, conversión con la tasa del banco y su comisión, y una tasa de referencia de Google Finance |
| **Recordatorios** | Tus pagos de los próximos 45 días en un calendario "Moni" de Google Calendar |
| **Respaldos y privacidad** | Copias en tu Drive (manuales o automáticas), registro de errores y *Borrar todos mis datos* |

## Entornos
| Entorno | Qué es | Datos | Cómo se llega |
|---|---|---|---|
| **Local** | Vista previa en tu computador, con un Google simulado en memoria | De ejemplo o vacíos | `npm run vista` (ver [Desarrollo](docs/DESARROLLO.md)) |
| **Desarrollo** | Un proyecto de Apps Script de pruebas, con datos de demostración | De ejemplo (propiedad `DEMO_HABILITADO`) | `npm run desplegar:dev` |
| **Producción** | La app que usa la gente, una hoja por persona, **sin** datos de demostración | Reales | `npm run desplegar:prod` |

Se prueba en desarrollo y, cuando está bien, se publica en producción (sin CI/CD: un comando por entorno). Detalle y propiedades de cada uno en [Despliegue](docs/DESPLIEGUE.md).

## Documentación

| Documento | Para quién |
|---|---|
| [**Empezar con Moni**](docs/EMPEZAR.md) | **Quien usa la app por primera vez**: qué es, cómo entrar y configurarla |
| [Guía rápida](docs/GUIA_RAPIDA.md) | Quien usa la app: lo esencial en una página |
| [Manual de usuario](docs/MANUAL_USUARIO.md) | Quien usa la app: todas las pantallas |
| [Instalación manual](docs/INSTALACION.md) | Quien instala la app a mano para una sola hoja |
| [Varias personas](docs/MULTIUSUARIO.md) | Una sola aplicación, cada persona con su hoja y sus datos |
| [Despliegue](docs/DESPLIEGUE.md) | Desarrollo y producción con un comando, sin copiar código; producción sin datos de demostración |
| [Operación y solución de problemas](docs/OPERACION.md) | Respaldos, recuperación, errores frecuentes |
| [Reglas de negocio](docs/REGLAS_DE_NEGOCIO.md) | Cómo se calculan saldos, presupuesto, tarjetas, créditos y nómina |
| [Glosario](docs/GLOSARIO.md) | Vocabulario de la app |
| [Arquitectura](docs/ARQUITECTURA.md) | Capas, modelo de datos, convenciones |
| [API interna](docs/API.md) | Funciones que el frontend llama |
| [Esquema de datos](docs/ESQUEMA.md) | Las 29 tablas, columna por columna |
| [Desarrollo](docs/DESARROLLO.md) | Pruebas, vista previa local, cómo extender |
| [Seguridad y privacidad](SECURITY.md) | Acceso, permisos y datos |
| [Comparativa de UX](docs/UX_COMPARATIVA.md) | Evaluación de usabilidad frente a otras apps |
| [Presupuesto y tarjetas](docs/ANALISIS_PRESUPUESTO_TARJETAS.md) | Análisis de cómo cuentan las compras con tarjeta y propuesta de cambios |
| [Plan: unir servicios y suscripciones](docs/PLAN_SERVICIOS_UNIFICADOS.md) | Evaluación y plan para la versión 1.2 |
| [Lanzamiento](docs/LANZAMIENTO.md) | Lista para pasar a producción y compartir la app |
| [Plan del proyecto](PLAN.md) | Historia: decisiones y fases de construcción |
| [Cambios](CHANGELOG.md) | Historia por fases |

## Inicio rápido (desarrollo)

```bash
npm run verificar     # sintaxis + pruebas + contraste de colores
npm run vista -- --demo   # vista previa en http://localhost:5178 con datos de demostración
```

Para publicar en Google, sigue [Despliegue](docs/DESPLIEGUE.md) (dos entornos, un comando) o, para una sola hoja a mano, [Instalación manual](docs/INSTALACION.md).

## Estructura

```
*.gs              Backend (Apps Script): una responsabilidad por archivo
index.html        Página; app_js.html, app_css.html y tokens.html se incluyen en ella
appsscript.json   Manifiesto (permisos y web app)
scripts/          Despliegue por entorno (publicar.sh) y el stub de producción sin datos de demostración
tests/            Pruebas en Node con un Google Sheets simulado en memoria, y la vista previa local
.githooks/        Chequeo antes de cada push (se activa con `npm run hooks`)
docs/             Documentación
```

## Estado

**Listo para usarse como app personal**: cualquier persona entra con su cuenta de Google, crea su hoja y empieza ([Empezar con Moni](docs/EMPEZAR.md)). Producción no incluye datos de demostración (ver [Despliegue](docs/DESPLIEGUE.md)).

Probada con cientos de pruebas automáticas sobre un Sheets simulado (`npm run verificar`). Lo que ese simulador no puede comprobar —autorización, tiempos, varias personas, el dólar de Google Finance y los avisos de Calendar— se verifica en Google real con la [lista de lanzamiento](docs/LANZAMIENTO.md). La interfaz no tiene pruebas automáticas todavía: se revisa su sintaxis y su contraste, y sus flujos se prueban a mano.

## Licencia

Software libre bajo la **licencia MIT** ([LICENSE](LICENSE)): puedes usar, copiar, modificar y distribuir Moni, incluso con fines comerciales, conservando el aviso de copyright. Se ofrece "tal cual", sin garantía. Esto cubre el **código**; los datos de cada persona son de ella y nunca están en este repositorio ([Seguridad](SECURITY.md)).
