# Cambios

## 1.14.0 — Análisis y gráficos coherentes (25 nov 2026)
- **Nuevo:** pantalla **Análisis** (Planear → Análisis), todo en una sola carga:
  - **Patrimonio neto** de los últimos 12 meses (estimado reconstruido desde tus movimientos).
  - **Entró y salió** cada mes.
  - **En qué gastas** este mes frente al mes anterior y al promedio de los tres anteriores.
  - **Dónde está lo que tienes** (disponible, ahorro, invertido).
  - **Lo que debes y cuándo terminas** cada crédito.
  - **Tu dinero disponible en 30, 60 y 90 días**: lo que ya sabes que entra y sale (nómina, ingresos, suscripciones, cuotas con seguros, tarjetas, CDT, repetidos mes a mes) y, aparte, restando tu gasto habitual.
  - **Comisiones e impuestos del año**.
- **Cambia:** todos los gráficos usan la misma tarjeta y tienen **Ver como tabla**, también los medidores (cupo usado, avance de créditos, CDT, regalos, metas de ahorro) y el saldo de un crédito.
- **Interno:** los colores de las series de los gráficos están en `tokens.html`, con los demás colores; la pantalla vive en `js_analisis.html`.

## 1.13.0 — Cargos, créditos bancarios y patrimonio neto (25 nov 2026)
- **Nuevo:** **Comisiones e impuestos** (Ajustes → Cargos y comisiones). Anota lo que cobra cada banco, cuenta, tarjeta o crédito: comisiones por transferir o pagar, el 4x1000, el recargo por compras en otra moneda, la cuota de manejo y los seguros de cada cuota. Al registrar un gasto, mover dinero a otra cuenta, comprar con tarjeta, pagar un extracto, una cuota o un servicio, Moni los **propone** y puedes cambiarlos, quitarlos o agregar otros; ves el total con cargos. Cada cargo queda como gasto en "Comisiones e impuestos" y se anula con su operación. Sin reglas no se cobra nada.
- **Nuevo:** **compras con tarjeta en otra moneda**: anotas la moneda y lo que costó allá; el recargo internacional va al mismo extracto.
- **Nuevo:** **créditos con un banco o entidad** (hipoteca, vehículo, libre inversión): sin cuenta de ahorro, con entidad, desembolso opcional a un bolsillo (no cuenta como ingreso) y seguros por cuota. La cuota sale como gasto. Los créditos que ya tenías siguen como créditos de autopago, sin cambios.
- **Nuevo:** **patrimonio neto** en Inicio: lo que tienes menos lo que debes en tarjetas y créditos con un banco (aparece si tienes deudas o inversiones).
- **Nuevo:** en el celular, **Ajustes** a un toque desde Inicio (arriba a la derecha) y **Guía y Ajustes** al final de Planear. La Guía trae el **glosario** completo.
- **Nuevo:** **zona horaria** en Ajustes → Perfil (por defecto, Colombia) para quien vive en otro país.
- **Accesibilidad:** al cerrar una hoja el foco vuelve al botón que la abrió; las pestañas de Dinero miden 44 px; las barras de navegación tienen nombres distintos.
- **Cambia:** el esquema pasa a **32 tablas** (`Cargos_Reglas`) y se agregan columnas a `Creditos`, `Creditos_Pagos` y `Compras_TC`. Las hojas existentes se actualizan solas **sin cambiar ningún dato** (comprobado con la prueba de migración desde la 1.10.0).

## 1.12.0 — Una sola regla para lo que se repite y para lo que viene (25 nov 2026)
- **Corregido:** abrir o cobrar el capital de un **CDT** ya no aparece como gasto o ingreso en los gráficos ni en los totales de Movimientos: el dinero solo cambia de lugar (sí cambia el saldo del bolsillo). Antes inflaba el gasto del mes en que abrías el CDT.
- **Mejora:** pagar una suscripción o recibir un ingreso recurrente son **todo o nada**: si algo falla, el gasto o el ingreso no queda registrado a medias.
- **Interno:** suscripciones, servicios e ingresos recurrentes comparten sus reglas (`Recurrentes.gs`): periodos, costo mensual y anual, saltar y deshacer. Lo que viene (pagos, ingresos, CDT y fechas de nómina) sale de una sola lista (`proximosEventos_`) para Inicio y Calendar. En la app, cargar una pantalla y anular-avisar-deshacer usan un solo mecanismo (`cargarEn`, `escribirYAvisar`).

## 1.11.0 — Más rápida al guardar y código ordenado (25 nov 2026)
- **Mejora:** guardar es más rápido. Dentro de una misma operación, Moni ya no vuelve a leer una tabla de la hoja después de cada paso: actualiza lo que ya tenía en memoria. Medido con `tests/medir_llamadas.js` sobre los datos de ejemplo: anular un movimiento pasa de 18 a 6 lecturas de la hoja, pagar una cuota de 38 a 29 y regenerar el presupuesto de 26 a 18.
- **Mejora:** varias filas se actualizan de una vez (pagar un extracto, anular un pago de crédito, desactivar bolsillos) y el presupuesto de un mes, los saldos y las divisas se calculan una sola vez por operación.
- **Mejora:** cambiar la tasa del dólar o los recordatorios ya no recarga toda la app.
- **Interno:** las fechas y las fórmulas financieras viven en `Fechas.gs` y `Finanzas.gs` (antes había copias en seis módulos), y el JavaScript de la app se repartió en partes por módulo. La app se ve y funciona igual.

## 1.10.1 — Correcciones de integridad (25 nov 2026)
- **Corregido:** las **tasas de los créditos** se redondeaban a 2 decimales: una EA de 9,5 % se guardaba como 10 % y una tasa de 0,4 % por periodo quedaba en 0 % (cuotas sin interés). Desde ahora se guardan exactas. Los créditos creados antes **no cambian solos**: si su tasa parece redondeada, Moni lo avisa en Inicio y en el crédito, con *Está bien* o *Corregir tasa* (solo se rehacen las cuotas pendientes; lo pagado y los saldos no se tocan).
- **Corregido:** si alguien borraba o movía filas a mano en la hoja, una actualización podía escribir en **otra fila**. Ahora cada escritura comprueba el ID del registro y, si la fila se movió, lo busca.
- **Corregido:** editar las **notas** de un movimiento generado por la app (un regalo, una suscripción…) rompía su vínculo. El vínculo vive ahora en su propia columna (`Ref`); en los movimientos viejos se copia ahí antes de cambiar la nota.
- **Corregido:** las categorías que usa la app (salario, rendimientos, regalos, comisiones) se reconocen por un **rol** y no por un ID fijo: puedes renombrarlas sin perder nada.
- **Corregido:** pagar una cuota, crear un crédito o una compra con tarjeta que aparta dinero son ahora **todo o nada**: si algo falla a mitad de camino, lo hecho se deshace (antes el cronograma o el dinero apartado podían quedar a medias).
- **Mejora:** sincronizar los recordatorios con Google Calendar ya no frena los registros mientras habla con Calendar.
- **Cambia:** columnas nuevas `Movimientos.Ref`, `Compras_TC.Ref` y `Categorias.Rol`; las hojas existentes se actualizan solas **sin cambiar ningún dato**. Una prueba nueva toma una hoja de la 1.10.0 con un mes de uso, la actualiza y comprueba celda por celda que nada cambió.

## 1.10.0 — Abonos y terceros en la tarjeta, y regalos con tarjeta (24 nov 2026)
- **Nuevo:** al pagar un extracto puedes anotar **quién más aporta** (nombre libre, con sugerencias) y cuánto. No mueve tus bolsillos: solo baja lo que tú pagas.
- **Nuevo:** **Registrar un abono** a un corte de la tarjeta, de ti (desde un bolsillo) o de otra persona. Baja la deuda y libera cupo, sin apartar dinero en la reserva. Se descuenta al pagar el extracto y se puede anular.
- **Nuevo:** en un regalo puedes elegir **de qué bolsillo planeas pagarlo**, y al registrar la compra puedes usar una **tarjeta de crédito**. En ese caso Moni avisa (en Regalos y en Inicio) que muevas el dinero a la reserva de la tarjeta, con un botón *Mover ahora*, y el aviso sigue hasta que registres ese movimiento.
- **Cambia:** el esquema pasa a **31 tablas** (`Pagos_Tarjeta`) y `Regalos` gana `ID_Bolsillo_Plan`; las hojas existentes se actualizan solas.

## 1.9.1 — Corrección de Ajustes (24 nov 2026)
- **Corregido:** Ajustes mostraba "No se pudo mostrar esta pantalla (reading 'icono')" desde la 1.9.0: faltaba definir la pantalla de *Empresas de servicios*. Ya está, y una prueba nueva revisa que cada catálogo del servidor tenga su pantalla en la app.

## 1.9.0 — Retención del CDT en pesos y empresas de servicios (24 nov 2026)
- **Nuevo:** al agregar un CDT eliges si la **retención en la fuente** es un porcentaje de los intereses o un valor en pesos (total del plazo).
- **Nuevo:** **Empresas de servicios** (Ajustes): guardas una vez cada empresa con su enlace de pago (Enel, Vanti, el acueducto…). Al guardar un servicio eliges la empresa y solo escribes el hogar y el código; el enlace no se repite.
- **Nuevo:** botón **Pagar servicio**: eliges la empresa y el hogar, y Moni abre la página de pago en otra ventana y deja el código de pago en el portapapeles.
- **Cambia:** el esquema pasa a **30 tablas** (`Empresas_Pago`) y se agregan columnas a `CDTs` y `Servicios_Publicos`; las hojas existentes se actualizan solas al abrir la app, sin perder datos.

## 1.8.0 — Presupuesto en una sola pantalla, traslados históricos y autocompletado (24 nov 2026)
- **Cambia:** el presupuesto une la gráfica y la lista: cada renglón trae su **barra de avance** (real frente a plan) y su casilla de **completo**. Al marcarla, Moni pregunta si quieres agregar algún movimiento más o si bastan los registrados. Desmarcar solo reabre el renglón; en el detalle puedes agregar un movimiento sin completarlo.
- **Nuevo:** **Mover** dinero también tiene el interruptor *Sumar a mis saldos*: apágalo para anotar un traslado anterior a Moni sin que se muevan los saldos.
- **Nuevo:** **autocompletado de conceptos** al registrar un gasto, un ingreso o una compra con tarjeta; al elegir uno, se llenan el valor, el bolsillo, la categoría y el renglón de la última vez.

## 1.7.0 — Tarjeta por cortes, calendario y reserva a tu gusto (23 nov 2026)
- **Cambia:** la pantalla de una tarjeta ahora muestra **cada corte** con sus fechas, lo gastado, si está pagado o hasta cuándo pagarlo, y un aviso si hay cortes anteriores sin pagar. Tocas un corte para ver sus compras.
- **Corregido:** "El mes debe tener formato AAAA-MM" en la tarjeta (y compras que no aparecían): Google Sheets convertía algunos meses en fechas. Ahora se leen siempre como mes, la hoja se repara sola al abrir la app y todas las columnas de mes quedan como texto.
- **Corregido:** el ícono de calendario de los campos de fecha no abría nada dentro de la app publicada; ahora el calendario nativo se abre al tocar el ícono.
- **Nuevo:** al crear una tarjeta, la reserva puede ser un **bolsillo que ya tengas** (en pesos) o uno nuevo.
- **Cambia:** el paso *Bancos* de los primeros pasos explica que puedes agregar los bancos en los que eres cliente y tienes un producto (cuenta de ahorros, corriente o tarjeta de crédito).

## 1.6.1 — Datos de demostración estables (17 nov 2026)
- **Corregido:** el extracto de la tarjeta de demostración mostraba un total distinto según el día del mes (entre el 16 y el 20 algunas compras cruzaban el corte del día 15) y la prueba *"demo: incluye compras y un crédito…"* fallaba. Ahora las compras de demostración van siempre al extracto en curso. Solo afecta a desarrollo.

## 1.6.0 — Movimientos históricos y hoja de registrar en pasos (15 nov 2026)
- **Nuevo:** al registrar un **gasto o un ingreso**, el interruptor **Sumar a mis saldos** (encendido por defecto). Apagado, el movimiento es **histórico**: cuenta en el resumen del mes, las categorías, *Entró y salió*, el presupuesto y la vista anual, pero **no cambia ningún saldo**. Pensado para quien empieza a usar Moni a mitad de mes y quiere anotar lo que ya pasó. Si la fecha es de un mes anterior, Moni sugiere apagarlo. Se ve con la marca *Histórico* y se puede cambiar después con *Editar*.
- **Cambia:** la hoja **Registrar** va en tres pasos con título (*¿Cuánto y por qué?*, *¿En qué bolsillo?*, *¿Cuándo y cómo se cuenta?*) y las notas quedan en *Más opciones*.
- Nueva columna `Movimientos.Afecta_Saldos` (`ESQUEMA_VERSION` 9; se agrega sola y los movimientos anteriores siguen afectando saldos). Los saldos, el saldo al cierre de cada mes, los rendimientos del ahorro, el cuadre y la hoja `Vista_Bolsillos` la respetan.

## 1.5.1 — Alertas que caben, nómina más clara y salario mínimo editable (13 nov 2026)
- **Corregido:** las alertas (por ejemplo "Hay 2 suscripciones…" o "El salario mínimo guardado…") se salían de la pantalla en el celular y dejaban el botón cortado. Ahora el texto y el botón se acomodan en varias líneas.
- **Corregido:** *Parámetros de nómina*. La alerta del salario mínimo mandaba con *Actualizar* a la misma pantalla en la que ya estabas, así que parecía que no se podía editar. Ahora el **salario mínimo** va arriba, en una tarjeta propia que indica si está al día o por actualizar, con el año ya puesto y el valor listo para escribir, y su propio botón *Guardar salario mínimo*. Los aportes y prestaciones van aparte, cada campo con su explicación.
- **Cambia:** la pantalla de **Nómina** se ordena por lo importante: arriba cuánto te llega (ganas − descuentos), luego *¿Ya te llegó? Registrar nómina*, y el detalle en *Cómo se calcula* con tres bloques que se abren solo si quieres (Lo que ganas, Prestaciones, Descuentos).
- **Cambia:** *Registrar nómina* ahora va en tres pasos con títulos: **¿Cuánto te llegó?** (con la diferencia frente a lo estimado), **¿Dónde y cuándo?** y **¿Cómo la contamos?** (con la explicación de sumar o no a los saldos). El mes del presupuesto queda en *Más opciones*.

## 1.5.0 — Navegación nueva, Inicio pastel y ícono de la app (13 nov 2026)
- **Nuevo:** cuatro áreas — **Inicio, Dinero, Planear y Deudas** — y un botón **+** central en la barra inferior para registrar un gasto, un ingreso, mover dinero o convertir divisas (con "Repetir uno reciente"). Adiós a *Más*: sus 11 destinos quedaron dentro de Dinero (Bolsillos, Movimientos, Ahorro, CDT) y Planear (Presupuesto, Nómina, Otros ingresos, Servicios, Regalos, Vista anual). *Ajustes* y la *Guía* pasan al pie de la barra lateral y a Ajustes.
- **Nuevo:** en tablet y computador, **barra lateral contraíble** con *Registrar* (atajo **N**), búsqueda **Ctrl K** para ir a cualquier pantalla, cuenta o bolsillo, y las secciones agrupadas.
- **Nuevo:** **Inicio** con saldo total en tarjeta pastel (y ojo para ocultar cifras), **Este mes** (entró, gastado y te queda con un anillo de avance), accesos pastel y tarjetas de colores suaves.
- **Nuevo:** **primeros pasos** como tarjeta de avance con el siguiente paso, y el **asistente** con barra de tramos, panel de pasos y vista previa de la cuenta en pantallas anchas.
- **Cambia:** se quita la pantalla *Gráficos*. Cada módulo trae los suyos; nuevos en Movimientos (en qué gastaste), Nómina (a dónde va lo descontado), Servicios y suscripciones (lo que más pesa al mes), Regalos (gastado frente a estimado) y CDT (capital y avance del plazo).
- **Nuevo:** ícono propio de Moni en la pestaña del navegador (billetera sobre fondo pastel), en lugar del de Apps Script. Se sirve desde `assets/icono.png` y se puede cambiar con la propiedad de script `ICONO_URL`.

## 1.4.0 — Mes del presupuesto de la nómina (11 nov 2026)
- **Nuevo:** al registrar la nómina eliges **en qué mes del presupuesto cuenta** (por defecto, el que paga). Una nómina recibida a fin de mes para el mes siguiente suma en el presupuesto y la vista anual de ese mes; los saldos y el historial siguen la fecha real. Vale para toda nómina, afecte o no los saldos.
- **Nuevo:** en una nómina ya registrada, **Cambiar** junto a *Cuenta en el presupuesto de* corrige ese mes sin tocar saldos. Las registradas antes cuentan en el mes que pagan. Nueva columna `Nomina_Pagos.Mes_Presupuesto` (`ESQUEMA_VERSION` 8; se agrega sola).
- **Corregido:** el presupuesto se actualiza al instante al registrar o anular una nómina (1.3.1).

## 1.3.1 — La nómina sin afectar saldos se ve al instante en el presupuesto (11 nov 2026)
- **Corregido:** al registrar (o anular) una nómina sin afectar saldos, el presupuesto seguía mostrando el *Entró* anterior hasta recargar la app. Ahora se actualiza al momento.

## 1.3.0 — Saldo "Sin asignar" en todas las cuentas (10 nov 2026)
- **Nuevo:** toda cuenta puede tener dinero que no está en ningún bolsillo. Las cuentas con bolsillos tienen un saldo propio llamado **Sin asignar** (el *Saldo inicial* de la cuenta, una nómina sin repartir, una diferencia de *Cuadrar*). Se oculta de la lista mientras esté en 0 y la cuenta tenga otros bolsillos, pero siempre se puede elegir al registrar o mover dinero.
- **Cambia:** *Usar bolsillos* se puede activar o desactivar cuando se quiera. Al desactivarlo, el dinero de todos los bolsillos se junta solo en el saldo interno (ya no hay que elegir dónde).
- **Migración:** las cuentas con bolsillos creadas antes reciben su saldo *Sin asignar* en 0 al abrir la app; no cambia ningún saldo.

## 1.2.0 — Nómina sin afectar saldos, pagos del presupuesto y corrección de cuotas (10 nov 2026)
- **Nuevo:** al registrar la **nómina** hay un interruptor *Sumar a mis saldos*. Apagado, la nómina queda registrada y cuenta como ingreso del mes, pero no crea movimiento ni cambia saldos (para quien ya recibió el pago antes de empezar a usar Moni). Nueva columna `Nomina_Pagos.Afecta_Saldos` (se agrega sola a las hojas existentes; `ESQUEMA_VERSION` 6).
- **Nuevo:** marcar un renglón del **presupuesto** como pagado abre una hoja de confirmación: de qué bolsillo salió, valor y fecha. Registra el pago según el tipo (gasto, compra con tarjeta, cuota de crédito, traslado a ahorro o fondo) o **enlaza un movimiento que ya anotaste** sin duplicarlo. Desmarcar pregunta si también se anulan los pagos.
- **Nuevo:** en un **crédito**, tocar una cuota ya pagada permite **corregir lo que se pagó** (un abono extra que no se anotó): el cronograma se rehace con la misma cuota fija y tasa, y el saldo y el plazo se recalculan. No mueve dinero ni cambia saldos.
- **Cambia:** antes la casilla *Pagado* solo ponía una marca sin registrar nada.

## Documentación al día, licencia y limpieza (10 nov 2026)
No cambia el comportamiento de la app ni la versión.
- **Nuevo:** licencia **MIT** (`LICENSE`, README y `package.json`): el código es software libre. Los datos de cada persona no están en el repositorio.
- **Nuevo:** `DESPLIEGUE.md` y README resumen los **entornos** (local, desarrollo, producción): qué cambia en cada uno y qué propiedades de script lleva cada proyecto.
- **Limpieza:** se quitó `getMyAccount` (nada la llamaba; el estado de la cuenta viaja en `getBootstrap`). `listCatalogo`, `getSaldos` y `resetConfigParam` se conservan porque las pruebas y `tests/medir_llamadas.js` las usan.
- **Corregido:** el comentario de `Setup.gs` ya no fija un número de tablas.
- **Corregido:** número de tablas (29) y de pruebas en README, ARQUITECTURA, INSTALACION, LANZAMIENTO y OPERACION; versión del README (1.1.3).
- **Corregido:** `DESARROLLO.md` decía que `setupDatabase` no agrega columnas (sí lo hace con `MIGRACIONES_COLUMNAS`); ahora explica cómo migrar y cuándo subir `ESQUEMA_VERSION`.
- **Corregido:** el bloqueo de escrituras es de la persona en modo multiusuario (ARQUITECTURA, SECURITY); la caché y la revisión del esquema describen los TTL y la firma reales.
- **Nuevo:** `SECURITY.md` reescrito para un repositorio **público** y para varias personas (permisos, Drive restringido, qué nunca se sube); `INSTALACION.md` pasa a ser la guía manual de una sola hoja.
- **Nuevo:** `API.md` con las 18 funciones que faltaban y los parámetros reales; `ESQUEMA.md` con la tabla completa de los 42 parámetros de `Config` (generada desde `DEFAULT_CONFIG`).
- **Nuevo:** `REGLAS_DE_NEGOCIO.md` con monedas, conversión y comisión, recordatorios, gráficos y registro de errores; `GLOSARIO.md`, `GUIA_RAPIDA.md` y `EMPEZAR.md` con lo agregado desde la 1.0.
- **Reordenado:** `MANUAL_USUARIO.md` (numeración continua, primer uso con *Crear mi hoja*, *Mi cuenta*, Inicio completo); `LANZAMIENTO.md` con la lista de lo que solo se puede probar en Google real.

## 1.1.3 — Avisos al día y resumen sin cortes (6 nov 2026)
- **Corregido:** al guardar los *Parámetros de nómina* el aviso "Actualiza el salario mínimo" seguía en Inicio hasta recargar la app. Ahora los avisos se recalculan al guardar.
- **Corregido:** en el resumen de Inicio, las cifras con centavos o la columna *Invertido* se partían en dos líneas o quedaban tapadas en el celular. Ahora una cifra nunca se parte: si no caben, la columna baja a la línea siguiente.

## 1.1.2 — Parámetros de nómina y avisos (6 nov 2026)
- **Corregido:** *Ajustes → Parámetros de nómina* no guardaba nada y mostraba *"Este parámetro lo gestiona la app"*. La protección bloqueaba toda clave que empezara por `Tasa_`, y el interés de cesantías se llama `Tasa_Interes_Cesantias`. Ahora solo se protegen las tasas de divisas (`Tasa_USD`, `Tasa_EUR`, sus fechas y fuentes, y `Tasa_Auto`). Con esto se puede actualizar el salario mínimo y desaparece el aviso de Inicio.
- **Corregido:** en tema claro, los avisos de Inicio salían con fondo oscuro (compartían nombre de estilo con los mensajes emergentes).

## 1.1.1 — Arreglo de actualización (6 nov 2026)
- **Corregido:** tras publicar la 1.1.0, las hojas ya creadas mostraban *"La tabla CDTs no existe en la base de datos"* en vez de actualizarse. La app recordaba por 6 horas que la hoja estaba bien y no la revisaba. Ahora esa revisión recordada cambia con cada versión de la app y, si aun así falta una tabla, la app olvida lo recordado y revisa de nuevo: con varias personas la hoja se actualiza sola; con una sola hoja se ofrece *Instalar*.

## 1.1.0 — CDT, hogares y avisos (6 nov 2026)
- **CDT:** nuevo módulo (*Más → CDT*). Capital, tasa EA, plazo, banco, pago de intereses (al vencimiento, mensual o trimestral) y retención. El capital se muestra como **Invertido**, no como disponible. Calcula intereses y neto, registra pagos de intereses, cobra o cancela (con renovación) y se puede anular. Admite CDT que la persona ya tenía antes de usar Moni (sin descontar nada). Vencimientos en *Por recibir* y en Google Calendar. Tabla nueva `CDTs`.
- **Avisos en Inicio:** el panel *Para tener en cuenta* muestra lo que falta configurar o está desactualizado (importantes, sugerencias y novedades), se actualiza solo y los no urgentes se ocultan con *Ahora no*.
- **Hogares:** las suscripciones y servicios pueden pertenecer a un hogar (el mismo nombre en hogares distintos; el presupuesto los distingue). En los primeros pasos, *Hogar* va antes que *Servicios* y *Suscripciones*, y los servicios admiten enlace de pago.
- **Fechas AAAA/MM/DD** en pantalla y al escribirlas (con botón de calendario).
- **Primeros pasos:** lo ya agregado se puede tocar para editarlo, también el sueldo.
- Plan para unir servicios y suscripciones en una sola cosa: [docs/PLAN_SERVICIOS_UNIFICADOS.md](docs/PLAN_SERVICIOS_UNIFICADOS.md).

## 1.0.0 — Primera versión (6 nov 2026)
Moni queda lista para que **cualquier persona** la use como su app de finanzas personales (una hoja de Google por persona).
- **Para quién y cómo:** se entra con la cuenta de Google, se crea la hoja y un asistente de primeros pasos deja todo configurado: nombre, bancos (con su rendimiento), cuentas y bolsillos con sus saldos iniciales, tarjetas, nómina, otros ingresos, suscripciones, hogar y servicios, y el dólar de Google Finance si se quiere.
- **Dos entornos:** desarrollo (con datos de demostración) y producción (sin ellos: el paquete ni siquiera los incluye). Despliegue con un comando, sin CI/CD ([guía](docs/DESPLIEGUE.md)); lista de lanzamiento en [docs/LANZAMIENTO.md](docs/LANZAMIENTO.md).
- **Rendimiento:** creación de la hoja por partes (sin timeouts), libro abierto una vez por petición, caché de todas las tablas y refrescos livianos al guardar.
- **Funciones:** bolsillos y cuentas, presupuesto con suscripciones y servicios, nómina colombiana (una sola nómina, conceptos del mes), tarjetas y créditos de autopago, ahorro con rendimientos (diario o mensual, sobre todo el saldo o solo bolsillos), ingresos recurrentes, regalos, vista anual, respaldos y recordatorios en Google Calendar.
- El detalle de cada cambio está en las secciones siguientes.

## Sin pantalla de Arranque (6 nov)
- **Se quitó "Arranque"** (cargar saldos de apertura, fecha de inicio, archivar pruebas, empezar a operar): los saldos iniciales ya se escriben al crear cada cuenta y bolsillo en los primeros pasos. Desaparecen la pantalla, el aviso de Inicio, las funciones `getArranque`, `setFechaArranque`, `saveAperturas`, `archiveTests`, `startOperation` y los parámetros nuevos `Fecha_Arranque` y `Arranque_Hecho` (en hojas ya creadas quedan inertes).

## Suscripciones en el presupuesto y detalle de movimientos (6 nov)
- **Suscripciones y servicios dentro del presupuesto:** cada mes el presupuesto incluye lo que toca pagar (según su periodicidad), con su valor y su medio de pago. Las nuevas o editadas entran solas al mes ya generado; un aviso con *Agregar* cubre las que falten. Pagarlas cuenta como lo real y deja el renglón pagado. Columna nueva `Presupuesto_Mes.ID_Suscripcion`.
- **Detalle de un movimiento:** ahora dice primero **qué es** (gasto, ingreso, movimiento de dinero entre bolsillos, ajuste, conversión).
- **Editar un movimiento desde su detalle:** corregida una carrera al cerrar el diálogo que podía cerrar también el formulario de edición recién abierto.
- **Gasto con tarjeta en un renglón sin bolsillo:** ya no da error ("Elige de qué bolsillo sale el dinero"); cuenta en el renglón y no aparta dinero, como ya decía la pantalla.

## Ajustes de diseño del asistente (6 nov)
- **Barra de pasos legible:** con 11 pasos solo se muestran los puntos; el nombre del paso actual va en el texto de abajo ("Paso 10 de 11 · Servicios · opcional").
- **Botones claros:** el principal dice lo que hace (*Guardar y continuar* si escribiste algo, *Continuar* si no) y ya no existe "Omitir por ahora". En pasos opcionales el enlace es **Saltar este paso**; en los obligatorios, **Seguir más tarde**. En el paso del dólar el botón cambia con el interruptor (*Vincular y continuar* / *Continuar sin vincular*), que empieza apagado.
- **Corregido:** el paso de servicios públicos no guardaba nada (buscaba un "Nombre" que ese catálogo no tiene).
- **Cuentas:** *Saldo según tu banco* solo aparece al editar (al crear la cuenta es lo mismo que el saldo inicial) y las ayudas explican la diferencia.
- **Decimales:** siempre se guardaron (hasta 2); ahora los pesos también se *muestran* con centavos cuando el valor los tiene.

## Rendimientos, primeros pasos y nómina (6 nov)
- **Rendimientos:** el pago diario o mensual sigue por banco; ahora también se elige **sobre qué saldo rinde** (todo, o solo el dinero en bolsillos, como en bancos que no pagan sobre el saldo suelto). Columna nueva `Bancos.Rendimiento_Base`, que se agrega sola al instalar.
- **Primeros pasos:** nuevos pasos opcionales de **suscripciones**, **hogar**, **servicios públicos** y **dólar** (la persona decide si vincula la TRM de Google Finance).
- **Nómina sin escenarios:** una sola nómina (sueldo, descuentos e ingresos fijos). Al registrar cada pago se pueden agregar conceptos solo de ese mes: horas extras, bono, pago de cesantías, prima, descuentos de la empresa. Los datos de quien ya tenía escenarios se conservan.

## Rendimiento (6 nov)
- **Crear la hoja ya no se agota:** las 28 pestañas se preparan por partes (≈20 s por paso, con avance "n de 28" en el botón). Si se corta, *Reintentar* continúa donde quedó. Antes todo iba en una sola petición con cientos de llamadas a Google y chocaba con el tiempo límite.
- **Menos llamadas a Google:** el libro se abre una vez por petición (antes 12–23), las columnas de texto se formatean en una llamada, y todas las tablas (no solo los catálogos) se guardan en caché en trozos y se invalidan al escribir. Cargar la app con caché pasó de ~44 lecturas de hoja a 4; guardar un nombre y recargar, de ~30 a ~10.
- **Guardar ya no recarga toda la app:** guardar un nombre, un catálogo, activar o desactivar piden solo lo que cambió (`getRefresco`). El arranque no incluye próximos pagos ni ingresos por recibir: se piden aparte, ya pintada la pantalla. Las tablas en caché se traen en 2 llamadas (antes ~49), y la caché de catálogos dura 1 h (movimientos, 10 min). *Ajustes → Actualizar desde la hoja* fuerza la relectura si editas la hoja a mano.
- `node tests/medir_llamadas.js` cuenta las llamadas por operación.

## Listo para cualquier persona (6 nov)
- **Producción sin datos de demostración:** el paquete de producción reemplaza el generador (`Demo.gs`) por un archivo vacío y el script se niega a subirlo si queda algo; además `sembrarDatosDemo` exige la propiedad `DEMO_HABILITADO`, que solo existe en desarrollo. *Datos de demostración*, *Arranque* y "Explorar con datos de ejemplo" desaparecen de la app y el servidor rechaza esas operaciones.
- **El arranque** (anular pruebas, fijar saldos) solo corre en el entorno de pruebas: en producción habría anulado movimientos reales.
- **Valores iniciales para cualquiera:** el año activo es el actual (antes fijo en 2027); aviso cuando el salario mínimo guardado es de un año anterior.
- **Guía para nuevas personas:** [Empezar con Moni](docs/EMPEZAR.md).
- `scripts/publicar.sh` arma y sube el paquete de cada entorno (lo usan `npm run push:dev/prod` y `desplegar:dev/prod`). `npm run vista -- --prod` muestra la app como producción.

## Varias personas y despliegue automático (5 nov)
- **Modo multiusuario:** una sola aplicación, cada persona con su hoja (se crea en su Drive o vincula una existente), su caché, su bloqueo y sus activadores. La hoja se actualiza sola cuando una versión trae tablas o columnas nuevas. Pantalla de bienvenida y *Ajustes → Mi cuenta*. Se activa con `activarModoMultiusuario` ([guía](docs/MULTIUSUARIO.md)).
- **Despliegue sin copiar código:** un comando por entorno (`npm run desplegar:dev` / `desplegar:prod`) y verificación local antes de cada `git push`. Se probó GitHub Actions pero se descartó (exige facturación activa) ([guía](docs/DESPLIEGUE.md)).
- **Pruebas más estables:** las fechas de las pruebas usan la zona de la app (Bogotá) y no UTC; antes fallaban cada noche después de las 19:00 y los primeros 10 días del mes.

## Nómina estimada, rendimientos por banco e ingresos recurrentes (31 oct)
- **Nómina como el estimado del Excel original:** casillas para incluir o no cada línea, días editables (mes incompleto, prima, vacaciones), salud y pensión sobre ordinario + vacaciones, intereses de cesantías por tramos del año, y descuentos o ingresos fijos del escenario. Abre en el mes del próximo pago.
- **Rendimientos por banco:** tasa (% EA) y forma de pago (cada día o cada mes). La pantalla de ahorro estima lo que rinde y lo pendiente de registrar.
- **Otros ingresos:** módulo de ingresos recurrentes (concepto, monto, periodicidad y la cuenta a la que llegan), con "Por recibir" en Inicio.
- **Primeros pasos:** dos pasos nuevos y opcionales, nómina e ingresos; el banco pide su rendimiento.
- Esquema 4: tabla `Ingresos_Recurrentes` y columnas `Rendimiento_EA`, `Rendimiento_Pago` en Bancos (las bases ya instaladas las reciben con **Instalar**). Parámetros nuevos: `Cesantias_Dias_Actual`, `Cesantias_Sueldo_Anterior`.

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
