# Moni — Plan de desarrollo 2027

> Documento vivo. Última actualización: 2026-10-28 (Fases 1 a 4 listas en código).
> Léelo completo antes de seguir el trabajo en otro dispositivo.

## 1. Propósito y alcance

Moni es la **reinterpretación del Excel de finanzas personales** de la usuaria y una **aplicación nueva en Google Apps Script** que lo reemplaza. Todo vive en Google Sheets. Entra en operación el **1 de enero de 2027**, con saldos de apertura al 31/12/2026.

- No es una migración del histórico. El Excel sirve como **especificación de comportamiento**, no como fuente de datos.
- **Un solo usuario:** la usuaria. Sin roles ni permisos por persona.
- **Personalización máxima:** bancos, cuentas, bolsillos, tarjetas, categorías, personas, inmuebles y escenarios los define ella en la app. Nada de esto va fijo en el código.
- La interfaz sigue las **Human Interface Guidelines (HIG) de Apple** (ver sección 6).

### Archivos de referencia

El Excel original y los Sheets de trabajo (con sus IDs) **no se publican** en este repositorio. El Excel sirvió solo como especificación de comportamiento; la base de datos es un Sheet nuevo que crea `setupDatabase()`.

## 2. Cómo funcionaba el Excel original

**Idea central:** un sistema de **sobres** (bolsillos) sobre una sola cuenta digital, más ahorro externo, tarjetas y préstamos a sí misma.

1. **Nómina:** *Estimado nómina* proyecta el neto. Parte del sueldo base, el subsidio remoto, la prima, los intereses de cesantías, y descuenta salud 4 % y pensión 4 %. Tiene escenarios (actual, 1, 2, 3).
2. **Distribución:** la tabla "Distribución nómina" de la hoja *Presupuesto* asigna cada concepto a un bolsillo. Ejemplo: arriendo → Casa; suscripciones → Servicios; cuotas y ahorro → Ahorro.
3. **Bolsillos:** el saldo de cada uno es la suma de sus movimientos (`SUMIFS`). También se ve el saldo "hasta" una fecha.
4. **Movimientos:** libro diario con día, concepto, bolsillo y valor (negativo gasta, positivo ingresa). Para mover plata entre bolsillos se registran dos filas "Ajuste –".
5. **Presupuesto mensual (Ppto 1…12):**
   - Cada renglón tiene Pago (check), Plan, Real y Ahorro. Ahorro = Plan − Real.
   - Las cuotas de los créditos y el ahorro mensual son renglones del presupuesto.
   - Resumen: Ingresos, Gastos, Ahorro, Saldo y % de ahorro.
6. **Tarjetas de crédito:**
   - Hay una hoja por tarjeta y mes. Cada compra tiene un Tipo: **Personal**, **Ppto** (recurrente, como Netflix o iCloud) u **Otro**.
   - Cada tarjeta tiene un bolsillo propio que funciona como **reserva**: plata apartada para pagar el extracto.
   - Una compra Ppto se financia con un traslado desde el bolsillo del presupuesto a la reserva. Ejemplo: una suscripción de 29.900 que sale del bolsillo Servicios hacia la reserva de la tarjeta.
   - Al pagar el extracto, sale plata de la reserva. Lo de tipo Personal sale del bolsillo personal de la tarjeta, que puede quedar en negativo mientras no se paga.
   - El extracto muestra Total, Pagado, Falta y "Guardar".
7. **Créditos = autopago.** la usuaria se presta a sí misma desde su ahorro y se paga en cuotas, siguiendo la **tabla de amortización**:
   - La hoja *Amortización X* tiene la cuota francesa: saldo inicial, cuota, interés, abono a capital y saldo final.
   - La hoja *Cuota X* es el libro de pagos reales. En el Excel, un pago mayor a una cuota cuenta como varias cuotas (ejemplo: un pago equivalente a tres cuotas cuenta como tres). **En la app esto cambia (D8):** el excedente abona a capital y el plazo se recalcula.
   - Cada cuota pagada **vuelve al ahorro** como "Reposición ahorro". La "Deuda" con el ahorro baja a medida que repone.
   - Hay créditos de terceros que ella financia (familiares).
8. **Ahorro externo (varias cuentas de ahorro):** libro con saldo corrido. La deuda de "Para gastos" contra "Reposición ahorro" se calcula buscando esas palabras en el concepto (frágil).
9. **Contingencia:** *Gastos necesarios* y un presupuesto de contingencia marcan cada gasto como Continuar o Congelar, con otra nómina.
10. **Vista anual:** Ingreso, Plan, Real, Ahorro, TTCC (total de tarjetas) y Restante = Ingreso − Plan − TTCC.
11. **Extras:** regalos de navidad (estimado vs real), y códigos de pago de servicios públicos de varios inmuebles.

### Fórmula de los créditos (validada con el Excel)
Ejemplo: $2.400.000, 48 quincenas, tasa periódica 0,4067404 % → cuota **$55.140,90**; interés de la cuota 1 = **$9.762**. Es cuota francesa estándar (PMT). La tasa se **guarda por crédito**; la conversión desde EA es solo una ayuda de captura. En el Excel, EA 10 % → "nominal 9,76 %" (= TASA.NOMINAL(10 %; 2)) → ÷24. Esa conversión se reproduce como método "Excel" y se ofrece también el método "Exacta".

## 3. Estado de la app anterior

Se reutiliza la arquitectura. El código vive en este directorio (~10k líneas).

| Capa | Archivos |
|---|---|
| Entrada y menú | `Code.gs` |
| Esquema y siembra | `Setup.gs`, `Migracion.gs` |
| Acceso a datos | `Repo.gs` (lectura/escritura por lotes, `LockService`, `CacheService`) |
| Dominio | `Dominio_Movimientos`, `_Tarjetas`, `_Presupuesto`, `_Nomina`, `_Creditos`, `_Ahorro`, `_Regalos` |
| API | `Api.gs` (respuestas `{ok, data, error}`, `getBootstrap`) |
| PDF | `Pdf.gs` (extractos a Drive) |
| Frontend | `index.html`, `js.html`, `css.html` (SPA de 7 pestañas) |

### Defectos de la base que hay que corregir
1. **`updateRow()` no existe** y se llama en 9 sitios (`Dominio_Creditos.gs:263`, `Dominio_Presupuesto.gs:145,262,702`, `Dominio_Movimientos.gs:166,170`, `Dominio_Nomina.gs:335`, `Dominio_Tarjetas.gs:102`, `Dominio_Regalos.gs:64`). Fallan: anular, marcar pagos, editar plantilla/regalos y registrar nómina.
2. **Filas calculadas con `index + 2`:** `getTableData` omite filas vacías, así que un hueco desplaza el índice y se edita la fila equivocada.
3. **Cuota de crédito:** `calcularCuotaValorFuturo` usa valor futuro dividido en n (valor distinto de la cuota francesa), no la cuota francesa. `generarCronogramaAmortizacion` reparte capital e interés en partes iguales. `convertirEaATasaPeriodica` tiene las dos ramas idénticas.
4. **Pagar un extracto de tarjeta no mueve plata:** `setPagadoCompra` solo cambia un check.
5. **`Real` del presupuesto** se escribe a mano; no se calcula desde los movimientos.
6. **Ahorro** detecta "para gastos" y "reposición" por texto.
7. **IDs fijos en el código** (`'bol-personal'`, `'bol-tc-nu'`…, 26 usos en `js.html` e `index.html`), pills de tarjetas estáticas y años 2024–2028 fijos. Contradice la personalización.
8. **Códigos de servicios públicos y datos de usuario** quemados en `Dominio_Presupuesto.gs`.
9. **Despliegue:** `appsscript.json` tiene `access: MYSELF` y `executeAs: USER_DEPLOYING`; con eso solo el dueño abre la app. Se debe cambiar para que la usuaria entre con su cuenta.
10. **No es repo git, no hay `.clasp.json` ni pruebas.**

## 4. Decisiones tomadas

| # | Decisión |
|---|---|
| D1 | **Créditos = autopago.** El saldo sigue la tabla de amortización, no un extracto bancario. Cada cuota pagada repone el ahorro de origen. |
| D2 | **Personalización total** de bancos, cuentas, bolsillos, tarjetas, categorías, personas, inmuebles, escenarios y apariencia. |
| D3 | **Un solo usuario.** `LockService` por script; sin gestión de usuarios. |
| D4 | **Sheet nuevo y en blanco** (`Moni 2027 - Base de datos`). El esquema anterior se descarta. |
| D5 | **Arranque el 1/1/2027** con saldos de apertura. Sin migración del 2025. |
| D6 | **Interfaz alineada a HIG** (sección 6). |
| D7 | Tres capas en el Sheet: **Datos** (tablas protegidas, solo la app escribe), **Vistas** (hojas con fórmulas parecidas a su Excel, solo lectura) y **App** (captura y operaciones). |
| D8 | **Abonos mayores a la cuota recalculan el plazo.** La cuota se mantiene; el excedente va a capital y se regenera el cronograma restante con menos cuotas (la última se ajusta). Reemplaza el "adelanto de cuotas" del Excel. |
| D9 | **Bolsillos configurables por cuenta.** Cada cuenta tiene la opción `Permite_Bolsillos`. Nequi y Nu pueden usarlos; una cuenta débito o de bajo monto puede funcionar como un solo saldo. |
| D10 | **Datos ficticios durante el desarrollo.** Se prueba con saldos inventados, marcados como demo y separados de los reales. Los saldos reales se cargan solo al final (F6). |
| D11 | **Fase 7 de pulido al final:** tras las fases funcionales se dedica una fase a rendimiento, estados de carga y notificaciones, y a la claridad de la navegación, con medición y pruebas con la usuaria (sección 7.1). Mientras tanto, se siguen las reglas de la sección 7.2 para no acumular más deuda. |

## 5. Modelo de datos

> **La especificación definitiva, columna por columna, está en [docs/ESQUEMA.md](docs/ESQUEMA.md)** (26 tablas, convenciones e invariantes). Lo de abajo es el resumen. Cambios decididos en la Fase 0:
> - El ahorro externo **no tiene tablas propias**: las cuentas de tipo `Ahorro` usan `Movimientos` con `Subtipo` (`Para_Gastos`, `Reposicion`, `Interes`, `Retencion`, `GMF`). Desaparece `Ahorro_Movimientos`.
> - `Continuar/Congelar` desaparece: la contingencia es un `Escenario` de presupuesto completo.
> - `Presupuesto_Mes` no guarda `Real`; se calcula desde los movimientos enlazados.

Principios: IDs generados (UUID) y nunca fijos en código; borrado lógico (`Anulado`/`Activo`); `Creado_En` y `Actualizado_En` en cada tabla; fechas ISO; dinero como número; toda lista desplegable sale de una tabla.

### Configuración (la edita la usuaria desde Ajustes)
| Tabla | Para qué |
|---|---|
| `Config` | Parámetros clave/valor: nombre de usuario, año activo, moneda, periodicidad de nómina, SMMLV, % de aportes, método de tasa, apariencia, respaldos |
| `Bancos` | Nequi, Pibank, Nu, Bancolombia, RappiPay… con color e icono |
| `Cuentas` | Cuentas o billeteras reales (Nequi, Nu, Pibank, débito…) ligadas a un banco. Campos: `Tipo` (Billetera, Débito, Ahorro, Otra), **`Permite_Bolsillos`** (Sí/No), saldo real auditable |
| `Bolsillos` | Sobres virtuales dentro de una cuenta (`ID_Cuenta`). Campo `Rol`: Operativo, Reserva_Tarjeta, Fondo, Ahorro_Puente. Si la cuenta **no** permite bolsillos, la app crea un único bolsillo interno "General" y lo oculta: la cuenta se maneja como un solo saldo |
| `Tarjetas` | Banco, cupo, día de corte, día de pago, **bolsillo de reserva**, bolsillo para compras personales |
| `Categorias` | Gasto, Ingreso, Transferencia, Ajuste |
| `Personas` | Titulares (la usuaria y sus familiares) para créditos y regalos |
| `Inmuebles` y `Servicios_Publicos` | Códigos y portales de pago |
| `Escenarios` | Normal, Contingencia u otros que ella cree |

### Operación
| Tabla | Para qué |
|---|---|
| `Movimientos` | Libro mayor de bolsillos. Transferencias = 2 filas con el mismo `ID_Grupo` que suman 0 |
| `Compras_TC` | Compras con `Fuente` (Personal, Ppto, Guardar, Otro) y `Mes_Extracto` |
| `Extractos` | Tarjeta, mes, total, estado y fecha de pago, enlazados a los movimientos de pago |
| `Presupuesto_Plantilla` | Renglones por escenario: concepto, monto, bolsillo destino, tipo (Gasto, Cuota, Ahorro, Fondo) |
| `Presupuesto_Mes` | Renglones del mes. `Real` se **calcula** desde movimientos y compras enlazados |
| `Nomina_Escenarios`, `_Conceptos`, `_Pagos`, `_Pagos_Detalle`, `Subsidios` | Calculadora de nómina y pagos recibidos |
| `Creditos` | Autopago o de terceros: monto, tasa periódica, periodicidad, nº de cuotas, titular, cuenta de ahorro de origen |
| `Creditos_Cronograma` | Cuotas teóricas persistidas (francesa) |
| `Creditos_Pagos` | Pagos reales, con enlace al movimiento y a la reposición del ahorro |
| `Regalos`, `Reportes`, `Log` | Regalos por año, PDF de extractos en Drive, y auditoría de errores |

### Reglas contables (invariantes)
- Saldo de bolsillo = saldo de apertura + Σ movimientos no anulados. Se puede consultar **a una fecha**.
- Una transferencia **entre bolsillos de la misma cuenta** nunca cambia el total de la cuenta. Una transferencia **entre cuentas** (ejemplo: Nequi → Nu) sí mueve saldo entre ambas y se registra como un par de movimientos enlazados.
- Cambiar `Permite_Bolsillos` de Sí a No solo es posible si todos los bolsillos de la cuenta se pueden fusionar en uno (la app pide elegir el destino y registra transferencias). De No a Sí conserva el saldo en "General".
- **Compra de tarjeta:**
  - Fuente Ppto: al registrarla, traslada del bolsillo del presupuesto a la reserva de la tarjeta.
  - Fuente Personal: no mueve plata hasta pagar el extracto.
- **Pagar extracto:** completa la reserva desde el bolsillo personal con lo que falte, paga desde la reserva y marca las compras como pagadas, todo en una sola operación atómica.
- **Pago de cuota de crédito (autopago):**
  1. Sale del bolsillo origen.
  2. Genera una reposición en la cuenta de ahorro de origen.
  3. Avanza el cronograma.
  4. **Pago mayor a la cuota (D8):** la cuota del periodo se aplica normal (interés sobre saldo, resto a capital). El excedente se abona a capital. Luego se **regenera el cronograma restante** manteniendo la cuota fija y la tasa; el nuevo número de cuotas se calcula con `n = -ln(1 - saldo·i/cuota) / ln(1+i)`, redondeado hacia arriba, y la última cuota se ajusta al saldo. Si el excedente cancela el saldo, el crédito pasa a Pagado.
  5. El pago, la reposición al ahorro y el nuevo cronograma se guardan en una sola operación; el cronograma anterior queda con las cuotas pendientes anuladas, para poder auditar el cambio.
- Ahorro del renglón de presupuesto = Plan − Real, solo si está pagado.
- Cuadre **por cuenta**: Σ bolsillos de la cuenta = saldo real de esa cuenta ± diferencia explicada. Aplica a Nequi, Nu y cualquier otra que ella configure.

## 6. Revisión de interfaz contra las HIG de Apple

Base de la revisión: `css.html`, `index.html` y `js.html` actuales.

### Lo que ya cumple
- Estructura adaptable: barra lateral en tablet y escritorio, barra de pestañas en móvil, y modales como hoja inferior en móvil y diálogo en escritorio.
- Áreas seguras (`env(safe-area-inset-*)`), material translúcido, separadores de 0,5 px y tipografía de sistema (`-apple-system`).
- Números tabulares para el dinero, interruptor de 51×31, y listas agrupadas.
- Esqueletos de carga, y avisos tipo "pastilla" arriba.

### Hallazgos y correcciones

| # | Hallazgo | Dónde | Severidad | Corrección |
|---|---|---|---|---|
| H1 | **Zoom bloqueado** (`maximum-scale=1`, `user-scalable=no`) | `index.html:5` | Alta | Quitar ambos. Es requisito de accesibilidad |
| H2 | **Sin modo oscuro**: 0 reglas `prefers-color-scheme`; colores fijos | `css.html` | Alta | Tokens semánticos con valores claro y oscuro; seguir el sistema por defecto |
| H3 | **Contraste insuficiente:** texto blanco sobre `#FF6584` (≈3:1) y `--label-tertiary` `#CBB8C2` sobre blanco | `css.html:25,22` | Alta | Objetivo AA (4,5:1 texto, 3:1 elementos grandes); oscurecer el tinte para texto y botones |
| H4 | **Tipografía en px fija**, no escala; 19 usos de tamaños menores a 12 px; cuerpo de 14–15 px | `css.html`, `index.html` | Alta | Escala en `rem` con estilos de texto de Apple (Large Title 34, Title 28/22, Headline 17 semibold, Body 17, Callout 16, Subheadline 15, Footnote 13, Caption 12/11) |
| H5 | **Campos de 15 px:** iOS hace zoom al enfocar si es menor a 16 px; y el zoom está bloqueado | `.form-control` | Alta | Campos de 16 px mínimo |
| H6 | **Áreas táctiles menores a 44 pt:** `btn-sm` 34, cerrar modal 32, botón de barra lateral 28 | `css.html` | Alta | Mínimo 44×44 pt en táctil |
| H7 | **Sin accesibilidad semántica:** 0 `aria-*`/`role`; 38 `<div onclick>` no enfocables; sin `:focus-visible`; pestañas como `div` | `index.html`, `css.html` | Alta | Usar `<button>`/`<a>`/`<nav>`; `aria-current` en la pestaña activa; foco visible; etiquetas en iconos |
| H8 | **Modales sin rol de diálogo:** sin `role="dialog"`/`aria-modal`, sin trampa de foco, sin cerrar con Esc, sin arrastrar para cerrar | `modal-*` | Alta | Rol, foco, Esc, gesto de arrastre y barra con Cancelar/Guardar |
| H9 | **10 `confirm()`/`prompt()` del navegador** para borrar, anular y restablecer | `js.html:553,863,1285,1502,1645,1920,2192,3046,3080,3146` | Media | Hoja de acción con botón destructivo en rojo, o **Deshacer** en el aviso tras la acción |
| H10 | **Navegación móvil:** 6 elementos (incl. "+") y faltan Créditos y Ahorro; HIG pide máximo 5 | `index.html:830` | Media | 5 pestañas: Inicio, Bolsillos, Presupuesto, Tarjetas, Más. El "+" pasa a botón en la barra de navegación |
| H11 | **Emojis como iconos** (58): inconsistentes entre dispositivos y mal leídos por VoiceOver | todo | Media | Juego de iconos SVG de trazo uniforme, similares a SF Symbols |
| H12 | **Texto con degradado** en títulos (`-webkit-text-fill-color: transparent`); degradados arcoíris en varios sitios | `.brand-rose-text` | Media | Títulos en color de etiqueta. El rosa se reserva como **tinte de acento** único. El tema queda en Ajustes |
| H13 | **264 estilos en línea** | `index.html` | Media | Mover a clases y tokens |
| H14 | **Variables CSS no definidas:** `--bg-card`, `--bg-grouped-secondary`, `--system-fill` | `css.html:175` y otros | Media | Definirlas o eliminarlas |
| H15 | **Sin `prefers-reduced-motion`**; hover con `translateY` | `css.html` | Media | Reducir o quitar animaciones si el sistema lo pide |
| H16 | **Tablas anchas con scroll horizontal** en móvil (vista anual, cronogramas) | `.data-table` | Media | Filas tipo lista en móvil; tabla solo en pantallas anchas |
| H17 | **Avisos sin `aria-live`** | `#toast-container` | Media | `role="status"`, `aria-live="polite"` |
| H18 | **Inicio sobrecargado:** 5 tarjetas grandes apiladas (portales de pago, códigos, balance…) | `view-inicio` | Media | Jerarquía: saldo, próximo pago, estado del mes, últimos movimientos. Lo demás en pantallas propias |
| H19 | **Nombre y datos fijos en el texto** (un nombre propio, años fijos y nombres de bancos escritos en el texto) | `index.html` | Media | Que salgan de `Config` y de las tablas |

### Especificación de diseño para la reconstrucción
- **Tokens** semánticos (fondo, fondo agrupado, etiqueta primaria/secundaria/terciaria, separador, relleno, tinte, éxito, peligro, advertencia), cada uno con valor claro y oscuro. Rejilla de 8 pt.
- **Navegación:** barra lateral (≥768 px) y barra de pestañas de 5 elementos (móvil). Título grande que se contrae al desplazar. Acciones primarias en la barra superior.
- **Componentes:** lista agrupada inset, hoja modal con detents, hoja de acción, control segmentado, interruptor, selector con búsqueda, campo de moneda con teclado numérico (`inputmode="decimal"`), estado vacío, estado de error con reintento.
- **Pantallas clave:** Inicio, Bolsillos (detalle con movimientos), Registrar (hoja de captura rápida), Presupuesto del mes, Tarjeta y extracto, Crédito (cronograma), Ahorro, Ajustes (CRUD de todo el catálogo), asistente de primera ejecución.
- **Idioma y tono:** español neutro, sin emojis en etiquetas funcionales, cifras en `es-CO`.
- **Apariencia personalizable:** tinte de acento (rosa por defecto), claro/oscuro/automático.
- **Limitación a verificar en dispositivo:** HtmlService carga la app en un iframe, y algunas metas de pantalla completa (PWA, barra de estado) pueden no aplicar.

### Criterios de aceptación de interfaz
- Contraste AA en claro y oscuro; zoom y tamaño de texto al 200 % sin romper el diseño.
- Todos los controles táctiles ≥ 44×44 pt y operables con teclado; foco visible.
- Cero `confirm`/`prompt`/`alert` nativos.
- Auditoría de accesibilidad (Lighthouse) ≥ 95.
- Revisión en teléfono, tableta y escritorio.

## 7. Plan de fases (hoy 27/10/2026 → arranque 1/1/2027)

La **pista UX** corre en paralelo: el sistema de diseño y la estructura de navegación se construyen primero, y cada módulo se hace sobre esos componentes.

| Fase | Fechas | Contenido | Salida |
|---|---|---|---|
| **F0 Fundaciones** ✅ *código listo; falta el paso manual de clasp (ver sección 10)* | 28 oct – 3 nov | Git y clasp; corregir `updateRow`, índices de fila y lock; despliegue para la usuaria; especificación final del esquema; tokens de diseño y componentes base (HIG) | Proyecto versionado, esquema especificado, kit de interfaz |
| **F1 Instalación y Configuración** ✅ *código listo; falta probar en el Sheet real* | 4 – 14 nov | `setupDatabase` crea las tablas en `Moni 2027`; CRUD de Bancos, Cuentas (con `Permite_Bolsillos`), Bolsillos, Tarjetas, Categorías, Personas, Inmuebles y Escenarios; **asistente de primera ejecución** con saldos de apertura; **`sembrarDatosDemo()` y `limpiarDatosDemo()`** con saldos ficticios | Ella configura todo sin tocar código, y hay datos de prueba para desarrollar |
| **F2 Núcleo contable** ✅ *código listo; falta el punto de control con la usuaria y probar en el Sheet real* | 15 – 24 nov | Movimientos, transferencias, saldos y saldo a fecha, cuadre con la cuenta real, anulaciones; pantalla de Registrar y Bolsillos | Saldos reproducibles y probados. **Punto de control con la usuaria (20 min):** registrar un gasto, ver cuánto queda en un bolsillo y mover dinero entre bolsillos; se anota dónde duda |
| **F3 Presupuesto y nómina** ✅ *código listo; falta probar en el Sheet real* | 25 nov – 5 dic | Plantilla por escenario, generar el mes, `Real` calculado, distribución de nómina a bolsillos, calculadora de nómina, modo contingencia | Un mes simulado coincide con lo que ella espera |
| **F4 Tarjetas y autopago** ✅ *código listo; falta el segundo punto de control con la usuaria y probar en el Sheet real* | 6 – 14 dic | Compras, reserva, extractos y pago atómico; créditos con cronograma francés, pagos, **abonos con recálculo de plazo** y reposición al ahorro | Ciclo completo de una compra y de un crédito. **Segundo punto de control con la usuaria (20 min):** pagar un extracto y abonar a un crédito |
| **F5 Ahorro, regalos y vistas** ✅ *código listo; falta probar en el Sheet real* | 15 – 21 dic | Ahorro con tipos explícitos, regalos, hojas de vista con fórmulas (bolsillos y anual), respaldos automáticos | Ella ve en el Sheet lo mismo que en su Excel |
| **F6 Prueba en paralelo y arranque** ✅ *herramientas listas; la prueba en paralelo y la carga real las hace la usuaria* | desde 1 dic, cierre 22 – 31 dic | Prueba en paralelo con datos ficticios, y luego con movimientos reales de diciembre. El 22 – 31 dic: `limpiarDatosDemo()`, carga de **saldos reales de apertura al 31/12** y guía corta de uso | Diferencias en cero o explicadas; Sheet sin datos demo |
| **F7 Rendimiento, estados y navegación** 🟡 *parte técnica hecha; faltan las mediciones en el Sheet real y la sesión con la usuaria* | 4 – 22 ene 2027 (después del arranque) | Medir y optimizar la velocidad; sistema de estados de carga y notificaciones; reorganizar la navegación según cómo usa la app la usuaria. Detalle en 7.1 | Metas medibles de 7.1 cumplidas y prueba de uso con la usuaria superada |

**Riesgo de calendario:** son 9 semanas con mucho alcance. Si se atrasa, el arranque se hace con F0–F4 y F5 sigue en enero. La prueba en paralelo con F2–F3 permite detectar diferencias temprano. La Fase 7 va después del arranque (enero); si el rendimiento o la navegación estorban el uso diario antes, se adelanta lo urgente (ver 7.1).

### 7.1 Fase 7: rendimiento, estados de carga y navegación

**Origen.** Después de probar la Fase 1, el diseño visual se ve correcto y el arranque con preguntas de configuración está bien. Pero la app se siente lenta, avisa poco del estado de lo que hace (carga, guardado, errores) y la navegación no se entiende. Esta fase lo corrige una vez terminadas las fases funcionales.

**Diagnóstico (28/10/2026).** Los datos de rendimiento son una medición real; el resto son hipótesis que hay que **confirmar con la usuaria** antes de rediseñar.

| Área | Lo que se observa | Evidencia |
|---|---|---|
| Rendimiento | Una carga inicial (`getBootstrap`) hace **72 lecturas de hoja**. 52 son `verificarEsquema()` (26 pestañas), que se ejecuta **dos veces**: una en `getBootstrap` y otra dentro de `obtenerEstadoConfiguracion` | Medido con un contador de lecturas sobre el simulador |
| Rendimiento | Tras **cada guardado** el frontend repite `getBootstrap` completo: una acción = 2 viajes en serie a Apps Script (escribir y volver a cargar todo) | `refrescar()` en `app_js.html` |
| Rendimiento | Dentro de una misma petición se lee varias veces la misma tabla (Bolsillos 6, Bancos 5, Cuentas 5, Config 4) | Medición anterior |
| Rendimiento | Con un Sheet real, cada lectura tarda decenas de ms y Apps Script suma un arranque en frío de 1 a 3 s. **Por confirmar:** tiempos reales de arranque y de guardado | Pendiente de medir en el Sheet real |
| Estados | Carga inicial con texto "Cargando…" y sin indicador al guardar (los botones solo se deshabilitan). Avisos de 3 s sin "Deshacer" ni reintento; los errores de red muestran el mensaje técnico | Revisión del código y de las pruebas en navegador |
| Navegación | La misma información está en dos sitios: **Bolsillos** (solo lectura) y **Ajustes → Bolsillos** (edición). Cambiar un bolsillo exige Más → Ajustes → Bolsillos (3 niveles) | `vBolsillos` y `CAT` en `app_js.html` |
| Navegación | Dos pestañas (Presupuesto, Tarjetas) muestran "Próximamente" o están vacías; **Más** mezcla Ajustes con funciones que no existen | Pantallas actuales |
| Navegación | No hay una acción principal siempre visible para lo más frecuente (**registrar un gasto**) | Estructura de pestañas |
| Navegación | Cuenta, bolsillo, reserva y escenario aparecen sin explicación donde se usan | Textos de los formularios |

**A. Rendimiento**
1. **Línea base:** instrumentar el tiempo de cada llamada en el cliente y el servidor, y medirlo en el Sheet real (arranque en frío, arranque con caché, guardar, abrir cada pantalla).
2. **Backend:**
   - Una sola lectura de cada tabla por petición (contexto de petición con lectura memorizada).
   - `verificarEsquema()` solo en instalación y diagnóstico; el resultado se guarda con un número de versión del esquema en `Config`.
   - Leer solo el rango con datos, en lugar de la hoja completa.
   - Escrituras en lote y `CacheService` con invalidación por tabla.
   - Cargas por pantalla: el arranque trae lo mínimo (configuración, catálogos y saldos) y el resto bajo demanda. Movimientos paginados por mes.
3. **Cliente:**
   - Una escritura devuelve **lo que cambió** (el registro y los saldos afectados), sin volver a pedir todo.
   - Actualización optimista con reversión si falla.
   - Mostrar de inmediato lo último guardado en el dispositivo y refrescar en segundo plano.
   - Evitar repintar toda la pantalla; precargar la pantalla siguiente probable.
4. Evaluar un disparador de tiempo que mantenga "caliente" el script, si el arranque en frío resulta ser lo que más pesa.

**B. Estados de carga y notificaciones**
1. **Estados por pantalla y por componente:** cargando (esqueleto con la forma del contenido), vacío, error con "Reintentar" y éxito.
2. **Botones con estado** "Guardando…" y protección contra doble envío. Barra fina de progreso arriba para toda petición que pase de 400 ms.
3. **Avisos con niveles** (éxito, información, advertencia, error): duración según el largo del texto, **"Deshacer"** al anular o desactivar, y los errores que piden acción en un banner que no desaparece solo.
4. **Errores en lenguaje llano**, con el detalle técnico plegado y registrado en `Log`. Manejo de sin conexión y de sesión de Google vencida.
5. **Recordatorios** de vencimientos de tarjetas, servicios y cuotas dentro de la app (y, si ella lo quiere, por correo).

**C. Navegación e intuición**
1. **Observar a la usuaria antes de rediseñar.** Sesión de 30 minutos, pensando en voz alta, con 5 tareas: registrar un gasto, ver cuánto queda en un bolsillo, mover dinero entre bolsillos, pagar una tarjeta y cambiar el nombre de un bolsillo. Se mide si lo logra, cuánto tarda y dónde duda.
2. **Organizar por tareas y no por tablas.** Propuesta a validar:
   - Acción **Registrar** siempre visible.
   - **Dinero** unifica cuentas, bolsillos y movimientos.
   - **Mes** reúne presupuesto y nómina.
   - **Tarjetas y deudas** reúne tarjetas y créditos.
   - **Más** queda para ajustes y extras.
3. **Editar donde se ve:** un bolsillo se edita desde su propio detalle. Ajustes queda solo para lo estructural (bancos, categorías, apariencia).
4. **Ninguna pestaña vacía:** lo que aún no existe no aparece. Máximo 2 niveles desde cada pestaña, y siempre claro dónde se está y cómo volver.
5. **Vocabulario:** un glosario único, ayuda breve donde aparece cada concepto y ejemplos dentro de los campos.
6. **Inicio orientado a "qué hago hoy":** próximos pagos, lo que falta del mes y accesos rápidos. La lista de primeros pasos se oculta al completarla.
7. Repetir la sesión con la usuaria y comparar resultados.

**Criterios de aceptación de la Fase 7**
- Abrir la app con datos ya cargados: ≤ 2 s con caché y ≤ 4 s en frío (en el Sheet real y en el celular de la usuaria).
- Guardar algo: el cambio se ve en ≤ 300 ms y queda confirmado en ≤ 1,5 s. Máximo **una** llamada al servidor por acción.
- Cero pantallas con texto "Cargando…" sin esqueleto; ninguna acción sin respuesta visible; todo borrado o desactivación con "Deshacer".
- la usuaria completa las 5 tareas sin ayuda, cada una en ≤ 3 toques desde Inicio (salvo configuración).
- La auditoría de accesibilidad de la sección 6 se mantiene (≥ 95).

**Orden:** medir primero (1 día), luego A y B (1 semana) y después C con la prueba con la usuaria (1 semana). Si el uso diario de la Fase 2 resulta incómodo antes de terminar todo, se adelanta lo que más moleste; no se espera al final.

### 7.2 Reglas desde ya (Fases 2 a 6)
Para no sumar deuda mientras se construye el resto:
1. **Una pantalla = una llamada** al servidor. Si necesita más, se agrega un endpoint que la entregue completa.
2. **Una escritura devuelve lo que cambió**; el frontend no vuelve a pedir todo.
3. **Cada tabla se lee una vez por petición.** `verificarEsquema()` no se llama fuera de instalación y diagnóstico.
4. **Toda acción asíncrona muestra su estado** (cargando, guardando, error con reintento) y pide **Deshacer** en vez de confirmación cuando se puede revertir.
5. **Nada de pestañas o pantallas sin contenido** ni de editar lo mismo en dos sitios: se edita donde se ve.
6. **Vocabulario nuevo = entrada nueva en el glosario** y texto de ayuda en el formulario.
7. **Puntos de control con la usuaria** de 20 minutos: al terminar la Fase 2 (Registrar y Bolsillos, que es lo que más usará) y la Fase 4 (tarjetas y créditos). Sirven para detectar problemas de navegación temprano, sin esperar a la Fase 7.

## 8. Datos ficticios de desarrollo (D10)
- `sembrarDatosDemo()` crea un conjunto coherente e inventado: 3 bancos, 4 cuentas (una sin bolsillos), ~10 bolsillos, 2 tarjetas, un mes de nómina, presupuesto, compras, un crédito de autopago con abonos y ahorro. Nombres genéricos; no se usan códigos de servicios ni datos reales de la familia.
- Todo registro demo lleva `Origen = "Demo"`. `limpiarDatosDemo()` los elimina sin tocar lo real, y la app avisa con una franja visible mientras haya datos demo.
- Los saldos reales se cargan al final, con el asistente de primera ejecución (F6).

## 9. Preguntas abiertas
Ninguna por ahora.

### Resueltas
- Nómina: se paga **una vez al mes** (periodicidad por defecto Mensual; la calculadora de nómina no necesita quincena).
- Cuenta sin bolsillos: se pueden registrar gastos y movimientos eligiendo solo la cuenta; los movimientos entre bolsillos aplican a las cuentas que los permiten.
- Abono que supera el saldo del crédito: la app cobra **solo lo necesario**.
- Cuentas y bolsillos configurables, con `Permite_Bolsillos` (D9).
- Abonos recalculan el plazo (D8).
- Saldos ficticios en desarrollo (D10).
- Periodicidad de cuotas: el modelo soporta quincenal y mensual.

## 10. Cómo continuar en otro dispositivo

### Estado de la Fase 0 (2026-10-28)
Hecho:
- `git init` (rama `main`, **sin commits ni remoto todavía**), `.gitignore`, `.claspignore`, `package.json`.
- `updateRow` y `deleteRow` definidos en `Repo.gs`; los 9 usos de `index + 2` ahora usan `_rowIndex`. Lock por **script** (`tomarBloqueo`).
- Acceso para la usuaria: la web app corre como quien entra (`USER_ACCESSING`, `ANYONE` = cualquiera con cuenta Google, pero cada quien necesita permiso sobre el Sheet), más lista opcional `USUARIOS_PERMITIDOS`. `vincularHojaMoni()` apunta el proyecto al Sheet nuevo.
- Esquema especificado en `docs/ESQUEMA.md`. Tokens HIG en `tokens.html` (claro/oscuro, contraste AA verificado, 44 pt, 16 px en campos, movimiento reducido; **aún sin conectar** a `index.html`).
- Correcciones HIG rápidas: zoom ya no está bloqueado (H1), variables CSS faltantes definidas (H14), campos a 16 px (H5).
- Pruebas: `npm run verificar` (sintaxis de todos los `.gs` y `js.html`, 11 pruebas de la capa de datos con un Sheets simulado, contraste de tokens).

Pendiente de la usuaria/tú (requiere tu cuenta de Google; no se puede automatizar):
1. `npm run login` (abre el navegador y autoriza clasp). Activa antes la API de Apps Script en https://script.google.com/home/usersettings.
2. Crear el proyecto Apps Script **desde dentro del Sheet** (no con `clasp create`): abrir `Moni 2027 - Base de datos` → Extensiones → Apps Script → Configuración del proyecto, copiar el ID del script y crear a mano `.clasp.json` con `{"scriptId":"<ID>","rootDir":"."}`.
   - **No usar `clasp create --parentId`**: en clasp 3.4.1 ignora el Sheet existente, crea un documento nuevo vacío en la raíz del Drive y **sobrescribe `appsscript.json`** con uno genérico (si pasa, `git checkout -- appsscript.json`).
   - `npm run push` también reemplaza el `appsscript.json` remoto por el del repo (el correcto).
3. `npm run push`, abrir con `npm run abrir`, ejecutar `vincularHojaMoni()` y autorizar permisos.
4. Compartir el Sheet con la cuenta de la usuaria (editora) y, al desplegar la web app, definir la propiedad de script `USUARIOS_PERMITIDOS` con su correo.

### Estado de la Fase 1 (2026-10-28)
Hecho (todo con pruebas; `npm run verificar` → 42 pruebas + contraste de tokens y de los 6 acentos):
- **Esquema v2** en `Setup.gs`: 26 tablas con auditoría (`Creado_En`/`Actualizado_En`), listas desplegables, columnas de texto plano (evita que Sheets convierta `2027-01` o `02-14` en fechas) y aviso al editar a mano. `setupDatabase()` es idempotente y **no toca** una pestaña con encabezados distintos: la reporta.
- **Catálogos** (`Catalogos.gs`): bancos, cuentas (con `Permite_Bolsillos`), bolsillos, tarjetas (con creación de la reserva en el mismo paso), categorías, personas, inmuebles, servicios públicos y escenarios. Reglas: nombres únicos, bolsillo interno "General" en cuentas sin bolsillos, escenario base único, no se desactiva lo que tiene saldo o dependencias, reactivar exige que el padre siga activo. Si una validación falla, **no se escribe nada**.
- **Saldos** (`Saldos.gs`): por bolsillo y cuenta, a una fecha, con cuadre contra el saldo real; el ahorro se separa de lo disponible.
- **Datos de demostración** (`Demo.gs`): `sembrarDatosDemo()` y `limpiarDatosDemo()` (IDs `demo-…`; no mezcla con datos reales).
- **API** nueva en `Api.gs` (la anterior está en `legacy/Api_v1.gs`).
- **Interfaz nueva** (`index.html`, `app_css.html`, `app_js.html`, `tokens.html`): navegación de 5 pestañas (barra lateral desde 768 px), Inicio con lista de primeros pasos, Bolsillos, Tarjetas, Más y **Ajustes** con perfil, apariencia (tema y 6 acentos), todos los catálogos, datos demo y diagnóstico. Sin `confirm()` ni `prompt()`; hojas `<dialog>` con foco, Esc y arrastre; modo claro/oscuro; zoom libre; áreas táctiles ≥ 44 pt; verificada en el navegador en móvil y escritorio.
- Código anterior movido a `legacy/` (UI v1, API v1, migración con datos reales). Los módulos `Dominio_*.gs` siguen en la raíz hasta portarlos en su fase; apuntan al esquema viejo y **no se usan** todavía.

Decisiones de diseño tomadas en la Fase 1:
- **Asistente de primera ejecución = lista guiada de "Primeros pasos"** en Inicio (cada paso abre su pantalla de Ajustes), en vez de un asistente modal: reutiliza los mismos formularios y se puede dejar a medias.
- `Compras_TC.Fuente` usa `Personal` (no un nombre propio) para respetar la personalización.
- El saldo de apertura vive solo en los bolsillos; la cuenta no lo guarda.
- Pendiente para la Fase 2: fusionar varios bolsillos al quitar los bolsillos de una cuenta (necesita transferencias).
- Pendiente para la Fase 3: eliminar de `Dominio_Presupuesto.gs` los códigos de servicios públicos reales que quedaron en el código.

No verificado aún: el comportamiento contra un Sheet real (solo contra un simulador en memoria). Para probarlo:
1. `npm run push`, y en el editor de Apps Script ejecutar `vincularHojaMoni()` (si no se hizo) y luego `setupDatabase()` (o, en el Sheet, menú **Moni → Instalar o verificar la base de datos**). Debe crear 27 pestañas (si ya tenías las 26 anteriores, solo crea `Suscripciones`).
2. Desplegar la web app (Implementar → Nueva implementación → Aplicación web) y abrirla con la cuenta de la usuaria.
3. En Ajustes → Datos de demostración, crear y luego borrar los datos de prueba.

Vista previa local sin desplegar: `npm run vista` (base vacía), `npm run vista -- --demo` (con datos demo) y abrir http://localhost:5178. Usa el backend simulado; no toca Google.

### Estado de la Fase 2 (2026-10-28)
Hecho (71 pruebas + contraste; la interfaz se probó en el navegador en móvil y escritorio):
- **Movimientos** (`Movimientos.gs`, reemplaza a `legacy/Dominio_Movimientos_v1.gs`): gasto, ingreso y ajuste (`registrarMovimiento`), traslados entre bolsillos de la misma cuenta o de cuentas distintas (`registrarTransferencia`, dos patas que suman cero), anular y **restaurar**, editar (solo movimientos simples: no traslados ni los generados por la app), listar con nombres ya resueltos y **cuadre de cuenta** (con ajuste opcional). Reglas: fecha real y no futura, valor > 0, categoría del mismo tipo, bolsillo activo; un bolsillo puede quedar en negativo.
- **Fusión de bolsillos:** al quitar los bolsillos de una cuenta se elige dónde juntar el dinero; cada saldo se traslada (queda en el historial) y los demás se desactivan. Si una validación falla, no se escribe nada.
- **API: una llamada por pantalla y las escrituras devuelven lo que cambió.** `getDetalleBolsillo` y `getMovimientos` traen todo lo de su pantalla; `addMovimiento`, `addTransferencia`, `voidMovimiento`, `restoreMovimiento`, `editMovimiento` y `cuadre` devuelven los movimientos afectados (con la forma de la pantalla que se está viendo), los últimos movimientos de Inicio y los saldos nuevos. La interfaz los aplica sin volver a pedir todo.
- **Rendimiento (adelantado de la Fase 7):** cada tabla se lee **una vez por petición** (memoria que se invalida al escribir) y `verificarEsquema` se recuerda 6 horas. La carga inicial pasó de 72 lecturas de hoja a ≤ 40 (hay una prueba que lo exige).
- **Fechas y fechas-hora como texto plano** en todas las tablas (`Fecha`, `Creado_En`…): evita que Sheets las convierta y las corra un día; además `setupDatabase` fija la zona horaria de la hoja en `America/Bogota`.
- **Interfaz:** botón **Registrar** siempre a mano (flotante) con Gasto / Ingreso / Mover, detalle de bolsillo con navegación por mes, lista de **Movimientos** con búsqueda, detalle y edición de un movimiento, cuadre de cuenta, y "Últimos movimientos" en Inicio. Se quitó la pestaña Presupuesto (vuelve en la Fase 3) y los "Próximamente" de Más.
- **Estados y avisos (adelantados de la Fase 7):** barra de progreso si una petición pasa de 400 ms, esqueletos de carga, botón "Guardando…", errores con reintento y avisos con **Deshacer** al registrar, mover o anular.

Errores encontrados y corregidos en esta fase:
- Los oyentes del `<dialog>` se acumulaban porque dependían del evento `close`, que no siempre se dispara a tiempo: un clic ejecutaba también el guardado de hojas anteriores (**doble registro**). Ahora se registran una sola vez y la hoja se limpia de inmediato.
- Al editar una cuenta, vaciar la fusión dejaba el cambio a medias (ver Fase 1: ahora se valida antes de escribir).

Pendiente:
- **Punto de control con la usuaria (20 min)**, ver tabla de fases.
- Probar contra el Sheet real (misma lista de la Fase 1; además registrar un gasto, mover dinero y anular).
- **No hay pruebas automáticas de la interfaz** (solo del backend, y la interfaz se probó a mano en el navegador). Conviene agregar un conjunto que ejecute los flujos de Registrar, Mover y Anular, porque el fallo del doble registro no lo habría detectado ninguna prueba actual.

### Estado de la Fase 3 (2026-10-28)
Hecho (99 pruebas; interfaz probada en el navegador en móvil y escritorio):
- **Plantilla del presupuesto por escenario** (`Presupuesto_Plantilla` como catálogo): renglones con concepto, monto, tipo (Gasto, Cuota, Ahorro, Fondo) y bolsillo de destino; los de ahorro, fondo y cuota exigen destino. Un escenario nuevo (por ejemplo Contingencia) puede copiar los renglones de otro.
- **Presupuesto del mes** (`Presupuesto.gs`, reemplaza a `legacy/Dominio_Presupuesto_v1.gs`): se genera desde la plantilla de un escenario; renglones con Plan, **Real calculado** desde los movimientos enlazados (`ID_Item_Ppto`) y Pagado; ahorro del renglón = Plan − Real solo si está pagado; ingresos, saldo y % de ahorro como en el Excel. Se pueden agregar, editar y quitar renglones (no si tienen movimientos). Reemplazar un mes ya generado solo se permite si nada está enlazado.
- **Regla del "real":** un gasto suma su valor; un traslado cuenta por su pata de entrada (el dinero que llegó a un bolsillo de ahorro, fondo o cuota).
- **Distribución de la nómina** (`distribuirNomina`): desde el bolsillo donde llegó, traslada a los bolsillos de destino. Los gastos se agrupan **por bolsillo** (un traslado) y los de ahorro/fondo/cuota van **uno por uno, enlazados a su renglón** (así ese traslado es su "real"). Lo que ya está en el bolsillo de origen no se mueve, y no se repite el mismo mes sin confirmación. Se puede deshacer de una vez.
- **Calculadora de nómina** (`Nomina.gs`, reemplaza a `legacy/Dominio_Nomina_v1.gs`), mensual, validada con **cifras de referencia**: salud y pensión del 4 % con redondeo PILA (3.127.845 → 125.200 c/u, 250.400 en total), neto de un mes normal 2.877.445 y neto con prima 4.441.367,50. Incluye subsidios (salariales o no, con vigencia), Fondo de Solidaridad desde 4 SMMLV, prima en junio y diciembre e intereses de cesantías en enero. Escenarios de nómina comparables entre sí.
- **Registrar la nómina recibida:** crea el ingreso (Subtipo `Nomina`, categoría "Salario / nómina") en el bolsillo elegido y guarda el cálculo del mes con su detalle congelado. Un pago por mes; se puede anular.
- **Parámetros de nómina editables** (SMMLV, aportes, cesantías) con validación (los porcentajes como decimal entre 0 y 1; en pantalla se escriben en %), guardados en lote: si uno falla, no se guarda ninguno.
- **Interfaz:** pestaña **Presupuesto** (resumen "Te queda", renglones con casilla de pagado, registrar el pago desde el renglón ya enlazado), pantalla de **Nómina**, **Plantilla del presupuesto** y **Parámetros de nómina** en Ajustes, y el resumen del presupuesto en Inicio. En Registrar hay un campo opcional "Renglón del presupuesto".
- **Datos demo:** ahora incluyen una plantilla, un subsidio y un escenario de nómina; lo que se genere sobre ellos (presupuestos, nómina, movimientos en bolsillos demo) se borra junto con los demás datos demo.

Decisiones y pendientes de la Fase 3:
- **Intereses de cesantías:** se calculan sobre el IBC de un **año completo** (IBC × 12 %). En el Excel original el valor era menor, probablemente por un año parcial. Hay que confirmar con la usuaria y, si hace falta, agregar los días trabajados.
- La **prima** se calcula como IBC / 2 (coincide con el Excel).
- Pendiente: el cierre mensual (copiar lo no usado, comparar contra el año) llega con la vista anual de la Fase 5.
- Pendiente: probar contra el Sheet real (misma lista de las fases anteriores, más generar un presupuesto, registrar la nómina y repartirla).

### Estado de la Fase 4 (2026-10-28)
Hecho (133 pruebas; interfaz probada en el navegador en móvil y escritorio):
- **Compras con tarjeta** (`Tarjetas.gs`, reemplaza a `legacy/Dominio_Tarjetas_v1.gs`). Cada tarjeta tiene su **bolsillo de reserva**: el dinero apartado para pagarla. Según la *fuente* de la compra:
  - **Personal:** no mueve dinero; al pagar el extracto se completa la reserva desde el bolsillo personal.
  - **Ppto:** aparta ya el dinero desde el bolsillo del renglón del presupuesto hacia la reserva (y cuenta como el "real" de ese renglón).
  - **Guardar:** aparta ya el dinero desde el bolsillo personal.
  - **Otro:** compra de otra persona; no mueve dinero hasta que la reembolsen.
  El mes del extracto sale del día de corte (después del corte, la compra pasa al mes siguiente). Anular una compra devuelve el dinero apartado; no se puede si su extracto ya se pagó.
- **Pagar el extracto, atómico:** completa la reserva con lo que falte (desde el bolsillo personal), paga el total desde la reserva y marca las compras como pagadas. Si algo falla a medias, se deshace todo (hay una prueba que lo fuerza). Se puede anular el pago y se vuelve a pagar. Se calcula también el cupo disponible y las próximas fechas de corte y pago.
- **Créditos de autopago** (`Creditos.gs`, reemplaza a `legacy/Dominio_Creditos_v1.gs`): amortización francesa con el cronograma guardado por versiones. La fórmula **reproduce al centavo los créditos del Excel original** (en las pruebas hay tres casos de referencia: 55.140,90; 87.915,89 y 52.791,04).
  - La tasa puede darse como EA (con el método "Excel" o "Exacta") o por periodo; las cuotas son mensuales o quincenales (días 15 y último, como en el Excel).
  - Un crédito nuevo registra la **salida del dinero del ahorro** (`Para_Gastos`); uno que ya venía en marcha se crea indicando cuántas cuotas lleva pagadas (sin movimientos).
  - **Pagar una cuota** traslada el dinero del bolsillo de pago a la cuenta de ahorro (reposición). Si el pago supera la cuota, el excedente **abona a capital y el plazo se recalcula** (cuota y tasa iguales; la última cuota se ajusta); si supera el saldo, **solo se cobra lo necesario**. Hay vista previa antes de confirmar.
  - **Anular el último pago** devuelve el dinero y restaura el cronograma anterior (solo el último, para no romper la cadena). Los cronogramas reemplazados no se borran: quedan marcados.
  - El pago se enlaza al renglón de tipo Cuota del presupuesto que apunta a ese crédito, y cuenta como su real.
  - La **deuda con el ahorro** es la suma de los saldos de los créditos activos.
- **Interfaz:** la pestaña ahora se llama **Deudas** (tarjetas y créditos); detalle de tarjeta con compras por extracto, pagar y anular; detalle de crédito con saldo, avance, tabla de amortización y pagos; "Nuevo crédito" con vista previa de la cuota; el pago de una cuota muestra qué pasa con el plazo. El renglón de presupuesto de tipo Cuota admite elegir el crédito que paga.
- **Datos demo:** incluyen compras de tarjeta y un crédito en marcha; todo se limpia junto con ellos.

Decisiones y pendientes de la Fase 4:
- La distribución de la nómina trata los renglones de **Cuota** como gastos (se agrupan por bolsillo y fondean el bolsillo desde el que se paga la cuota); su "real" llega cuando la cuota se paga de verdad.
- **PDF de extractos:** el módulo anterior (`legacy/Pdf_v1.gs`) no se portó. Hoy el extracto se ve en la app; decidir con la usuaria si el PDF en Drive hace falta.
- Un pago de crédito menor que la cuota se rechaza (no hay pagos parciales).
- Pendiente: **segundo punto de control con la usuaria (20 min)**: pagar un extracto y abonar a un crédito.
- Pendiente: probar contra el Sheet real (misma lista de las fases anteriores).

### Trabajar desde otro equipo
- Este directorio es el proyecto. El repositorio está en GitHub (público): no subir datos reales ni credenciales (ver SECURITY.md).
- Comandos: `npm run verificar` (todo), `npm test` (datos), `npm run sintaxis`, `npm run contraste`, `npm run vista` (vista previa local), `npm run push`.
- Tras cada sesión, actualizar la fecha de este documento y marcar el avance en la sección 7.

### Estado de la Fase 5 (2026-10-28)

- **Ahorro** (`Ahorro.gs`): rendimientos (interés, retención, GMF) con `Subtipo` explícito; retiros "para gastos" y reposiciones; deuda con el ahorro = retirado − repuesto + saldo de créditos activos. Pantallas Ahorro y detalle por cuenta.
- **Regalos** (`Regalos.gs`): lista por año; el real se calcula desde gastos marcados `Regalo <ID>`.
- **Vista anual** (`Anual.gs`): por mes, ingreso, plan, real, ahorro, tarjetas, restante.
- **Respaldos** (`Respaldos.gs`): copia en Drive ("Moni Respaldos"), disparador diario que respeta la frecuencia, conserva las últimas N copias.
- **Hojas de consulta con fórmulas** (`Vistas.gs`, menú Moni → Instalar hojas de consulta): `Vista_Bolsillos` (saldo = apertura + movimientos no anulados) y `Vista_Anual` (ingresos, gastos y plan por mes; año en B1). Fórmulas verificadas contra un Google Sheet temporal con datos de prueba (coinciden con el cálculo del servidor; anulados excluidos). **Decisión:** no se hicieron vistas de presupuesto ni tarjetas con fórmulas: su lógica (vínculo por `ID_Item_Ppto`, Ahorro condicionado a Pagado, reservas) no cabe en fórmulas legibles y duplicarla arriesga diferencias; para eso está la app.
- Tarea para el Sheet real: ejecutar `instalarVistas()` una vez (menú) tras `setupDatabase()`.

### Estado de la Fase 6 (2026-10-28)

- **Arranque** (`Arranque.gs`, Ajustes → Arranque): lista de verificación (catálogo, demo borrado, aperturas cargadas, sin movimientos de prueba anteriores a la fecha, plantilla, copias), fecha de arranque (`Config.Fecha_Arranque`, por defecto 2027-01-01), carga de saldos de apertura en bloque (todo o nada), archivo de movimientos de prueba (se **anulan**, no se borran; restaurables) y botón "Empezar a usar Moni".
- **Iniciar operación**: exige la lista completa, crea un respaldo, activa las copias automáticas y marca `Arranque_Hecho`. Desde ahí las aperturas quedan **fijas**: las diferencias se corrigen con el cuadre de cuenta (ajuste con fecha). `Datos_Demo`, `Fecha_Arranque` y `Arranque_Hecho` no se editan desde Parámetros.
- **Guía de uso** dentro de la app (Más → Guía de uso) y aviso en Inicio cuando falta el arranque.
- Las claves nuevas de Config se crean al usarlas (`asegurarConfig_`), así que una base ya instalada no necesita migración.
- **Límite conocido:** el archivo de pruebas solo anula `Movimientos`. Compras de tarjeta, extractos, créditos y nóminas de prueba se avisan pero se revisan a mano.
- **Procedimiento para la usuaria (22 – 31 dic):** 1) Ajustes → Datos de demostración → borrar; 2) crear bancos, cuentas, bolsillos y tarjetas reales; 3) Arranque → cargar saldos de apertura al 31/12; 4) archivar pruebas; 5) Empezar.

### Estado de la Fase 7 (2026-10-28)

**Hecho (no necesita a la usuaria):**
- **Medición:** cada respuesta de la API trae `ms` (tiempo en el servidor) y el cliente anota lo que tarda cada llamada. Ajustes → Diagnóstico muestra la tabla "Tiempos de esta sesión" (mediana y máximo por llamada) para medir en el Sheet real y en el celular.
- **Errores en lenguaje llano** (`mensajeLlano`): sin conexión, sesión de Google vencida, bloqueo ocupado, tiempo agotado y cuota; el detalle técnico queda en la consola.
- **Avisos:** duración según el largo del texto (3 – 12 s); los errores se pueden cerrar y se anuncian como alerta.
- **Próximos pagos en Inicio** (`Recordatorios.gs`): extractos de tarjeta por pagar y cuotas de autopago a 14 días o vencidos, con enlace a su detalle. Tras una escritura la lista se vuelve a pedir en segundo plano (`getProximos`, liviano).
- Ya estaban desde las fases anteriores: memoización de lecturas por petición, esquema verificado con caché (6 h), escrituras que devuelven lo que cambió, esqueletos de carga, barra de progreso a los 400 ms, "Deshacer", botones con "Guardando…".

**Pendiente (necesita el Sheet real o a la usuaria):**
1. Línea base: abrir, guardar y navegar en el Sheet real y en el celular; comparar con las metas (≤ 2 s con caché, ≤ 4 s en frío, guardar ≤ 1,5 s). Si el arranque en frío pesa, evaluar el disparador de calentamiento.
2. Sesión de 30 min con la usuaria (5 tareas) para decidir la reorganización de pestañas (C.1 – C.2). **No se rediseñó la navegación sin esa observación.**
3. Recordatorios por correo (solo si ella lo quiere).
4. Segunda sesión con la usuaria y comparación.

### Ajustes tras probar en el Sheet real (2026-10-28)

- **Presupuesto "pensando" para siempre — causa y arreglo.** Siete cargas de pantalla (presupuesto, detalle de bolsillo, movimientos, nómina, tarjeta, crédito y la carga genérica) tenían un `return` anticipado cuando llegaba una respuesta vieja (por cambiar de mes o de pantalla mientras cargaba). Ese `return` dejaba `cargando = true`, y como la pantalla solo pide datos si no está cargando, **nunca volvía a pedirlos y tampoco mostraba error**. Con la latencia real de Apps Script es fácil de provocar; en el simulador no se veía. Ahora la respuesta vieja se descarta, `cargando` se apaga y se pide la actual. Además, toda llamada tiene **tope de 45 s** y avisa en vez de quedarse esperando.
- **Barra superior en PC:** la barra estaba dentro del contenido (que ya tenía el margen de la barra lateral) y llevaba su propio margen: quedaba corrida 260 px y cortada. Se quitó el margen duplicado.
- **Inicio:** accesos rápidos (Gasto, Ingreso, Mover dinero, Pagar servicios, Tarjetas, Presupuesto) y, en PC (≥ 900 px), tablero de dos columnas con ancho de 1080 px.
- **Servicios y suscripciones** (`Suscripciones.gs`, tabla nueva `Suscripciones`; ya son 27 tablas): pantalla con costo mensual y anual, por pagar, servicios y suscripciones; pagar con 1 toque (gasto desde un bolsillo o compra de tarjeta) con "Deshacer", saltar un cobro, copiar el código, ir al enlace de pago. El día de cobro se conserva (31 → 28 → 31); en un servicio el valor pasa a ser el último pagado. Los vencimientos salen en "Próximos pagos" de Inicio. **Al actualizar una base ya instalada**, la app pide "Instalar" una vez: solo crea `Suscripciones`.
- **Comparativa de UX:** [docs/UX_COMPARATIVA.md](docs/UX_COMPARATIVA.md) (evaluación heurística, no datos de usuarios).
