# Moni

Finanzas personales sobre **Google Sheets** con una aplicación web hecha en **Google Apps Script**. Reemplaza un Excel de finanzas personales con las mismas reglas (bolsillos, presupuesto, tarjetas, créditos de autopago, nómina colombiana) y una interfaz pensada para el celular y el computador. Entra en operación el **1 de enero de 2027**.

- **Tus datos son tuyos:** viven en un Google Sheet de tu cuenta. No hay servidores de terceros.
- **Una sola persona:** el acceso se limita a tu cuenta de Google.
- **Todo es configurable:** bancos, cuentas, bolsillos, tarjetas, categorías, personas, escenarios y apariencia.

## Qué hace

| Módulo | Para qué sirve |
|---|---|
| **Inicio** | Resumen, accesos rápidos, próximos pagos y últimos movimientos |
| **Bolsillos** | Saldo de cada cuenta y bolsillo; registrar, mover dinero y cuadrar con el banco |
| **Presupuesto** | Plantilla por escenario, mes generado, "real" calculado de tus movimientos |
| **Nómina** | Estimado de lo que recibes (casillas, días, prima, cesantías, salud, pensión, descuentos fijos) y reparto a bolsillos, una vez al mes |
| **Otros ingresos** | Ingresos recurrentes (otro trabajo, arriendo, ventas…) con su cuenta de destino |
| **Deudas** | Tarjetas de crédito (reserva, extracto, pago) y créditos de autopago con amortización francesa |
| **Ahorro** | Rendimientos (interés, retención, GMF), retiros para gastos y lo que se debe reponer |
| **Servicios y suscripciones** | Cobros que se repiten, costo mensual/anual, pagar en un toque, códigos y enlaces de pago |
| **Regalos** | Lista por año con estimado y gasto real |
| **Vista anual** | Mes a mes: ingreso, plan, real, ahorro y restante |
| **Arranque** | Saldos de apertura reales, archivo de pruebas e inicio de la operación |
| **Respaldos** | Copias en tu Drive, manuales o automáticas |

## Documentación

| Documento | Para quién |
|---|---|
| [Guía rápida](docs/GUIA_RAPIDA.md) | Quien usa la app: lo esencial en una página |
| [Manual de usuario](docs/MANUAL_USUARIO.md) | Quien usa la app: todas las pantallas |
| [Instalación y despliegue](docs/INSTALACION.md) | Quien publica la app por primera vez o la actualiza |
| [Operación y solución de problemas](docs/OPERACION.md) | Respaldos, recuperación, errores frecuentes |
| [Reglas de negocio](docs/REGLAS_DE_NEGOCIO.md) | Cómo se calculan saldos, presupuesto, tarjetas, créditos y nómina |
| [Glosario](docs/GLOSARIO.md) | Vocabulario de la app |
| [Arquitectura](docs/ARQUITECTURA.md) | Capas, modelo de datos, convenciones |
| [API interna](docs/API.md) | Funciones que el frontend llama |
| [Esquema de datos](docs/ESQUEMA.md) | Las 28 tablas, columna por columna |
| [Desarrollo](docs/DESARROLLO.md) | Pruebas, vista previa local, cómo extender |
| [Seguridad y privacidad](SECURITY.md) | Acceso, permisos y datos |
| [Comparativa de UX](docs/UX_COMPARATIVA.md) | Evaluación de usabilidad frente a otras apps |
| [Presupuesto y tarjetas](docs/ANALISIS_PRESUPUESTO_TARJETAS.md) | Análisis de cómo cuentan las compras con tarjeta y propuesta de cambios |
| [Plan del proyecto](PLAN.md) | Decisiones, fases y estado |
| [Cambios](CHANGELOG.md) | Historia por fases |

## Inicio rápido (desarrollo)

```bash
npm run verificar     # sintaxis + 159 pruebas + contraste de colores
npm run vista -- --demo   # vista previa en http://localhost:5178 con datos de demostración
```

Para publicar en Google, sigue [Instalación y despliegue](docs/INSTALACION.md).

## Estructura

```
*.gs              Backend (Apps Script): una responsabilidad por archivo
index.html        Página; app_js.html, app_css.html y tokens.html se incluyen en ella
appsscript.json   Manifiesto (permisos y web app)
tests/            Pruebas en Node con un Google Sheets simulado en memoria
docs/             Documentación
```

## Estado

Fases 0 a 7 (parte técnica) implementadas y probadas con un Sheets simulado. Falta la verificación en el Sheet real, las dos sesiones de prueba con la usuaria y la medición de rendimiento real. Detalle en [PLAN.md](PLAN.md).

## Licencia

Sin licencia abierta: todos los derechos reservados a su autor mientras no se indique otra cosa.
