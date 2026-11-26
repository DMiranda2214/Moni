# Lanzamiento

Lista para pasar a producción y compartir la app. Sirve para cada versión nueva: marca las casillas con la versión que vas a publicar. Las secciones 2 bis a 2 quater dicen qué probar de lo agregado desde la 1.0.


## 1. Antes de publicar (en tu computador)
- [ ] `git checkout main && git pull`, con la versión que vas a publicar ya fusionada.
- [ ] `npm run verificar` → sintaxis, pruebas y contraste en verde.
- [ ] `npm run paquete:prod` → arma el paquete de producción y confirma que **no lleva datos de demostración** (si algo del generador quedara, el script se detiene).

## 2. Probar en desarrollo
- [ ] `npm run desplegar:dev` y abre la URL `/exec` de **desarrollo**.
- [ ] Propiedad de script `DEMO_HABILITADO = TRUE` solo en el proyecto de desarrollo.
- [ ] Crear la hoja desde cero (barra "n de 37") y completar el asistente con una cuenta de prueba.
- [ ] Registrar un gasto, un ingreso y un movimiento entre bolsillos; abrir su detalle y editarlo.
- [ ] Generar el presupuesto del mes: aparecen las suscripciones, los servicios y las metas.
- [ ] Nómina: sueldo, "Agregar algo de este mes" y registrar el pago.
- [ ] Ahorro: banco con rendimiento diario y otro "solo bolsillos".

## 2 bis. Qué probar de la 1.1.0 en desarrollo
- [ ] Una hoja de la 1.0 recibe sola la tabla `CDTs` y la columna de hogar al abrir la app.
- [ ] CDT: crear uno que ya existía (no cambia saldos) y uno nuevo descontando el capital; ver "Invertido" en Inicio; cobrarlo, cancelarlo y renovarlo.
- [ ] Hogares: Netflix en dos hogares; el presupuesto muestra *Netflix · Hogar*.
- [ ] Fechas: escribir `2026/11/06` en un gasto y elegir otra con el calendario.
- [ ] Avisos: "Para tener en cuenta" en Inicio; "Ahora no" oculta y *Ajustes → Avisos de Inicio* los devuelve.
- [ ] Primeros pasos: tocar lo ya agregado lo abre para editarlo.

## 2 ter. Qué probar de la 1.16 a la 1.18 en desarrollo
- [ ] Una hoja de una versión anterior recibe sola las tablas `Metas`, `Deseos_Ideas`, `Inversiones`, `Inversiones_Operaciones` e `Inversiones_Precios`, y las columnas nuevas de `Regalos` y `Presupuesto_Mes`. *Ajustes → Diagnóstico* dice 38 tablas (1.19 agrega `Brokers` y las columnas `ID_Broker`, `Valor_Origen` y `Sin_Efectivo`).
- [ ] Los regalos que ya existían aparecen iguales en **Planear → Lista de deseos** (persona, idea, estimado y lo gastado).
- [ ] **Metas:**
  - [ ] Crear una meta, poner un mes en 0 en *Plan por mes* y ver que los demás meses se reparten lo que falta.
  - [ ] La meta aparece en el presupuesto del mes como renglón *Fondo*.
  - [ ] *Aportar* mueve el dinero y cuenta en el renglón; *Usar el dinero* crea un gasto.
- [ ] **Lista de deseos:** un deseo *para mí* con dos ideas; elegir una; *Ya lo compré* sin registrar gasto; *Registrar la compra* con tarjeta (aparece el aviso de mover a la reserva).
- [ ] **Inversiones:**
  - [ ] Buscar "bitcoin", elegirlo y guardar.
  - [ ] Registrar una compra con bolsillo (el saldo baja, no cuenta como gasto), una venta y un dividendo.
  - [ ] Escribir un precio a mano. Anular una operación devuelve el dinero.
- [ ] **Navegación:**
  - [ ] Celular: pestañas Inicio, Mi dinero, Pagos y Planear; las píldoras de cada sección; Analizar desde Planear.
  - [ ] Computador: barra lateral con las cuatro secciones; plegar una, recargar y ver que sigue plegada; contraer la barra a solo íconos.
  - [ ] Ingresos con sus pestañas Nómina y Otros ingresos; Inversiones con su pestaña CDT.
- [ ] **Registrar:** *Sumar a mis saldos* aparece justo debajo del valor.
- [ ] **Ayudas:** el botón **i** abre su globo en los formularios de metas, deseos, inversiones y calculadora; en el celular, el globo no se sale de la pantalla.

## 2 quater. Lo que el simulador de las pruebas no puede comprobar (probar en Google real)
- [ ] **Dólar de Google Finance:** en *Ajustes → Divisas*, *Actualizar ahora* trae la tasa (puede tardar unos segundos la primera vez); con la actualización diaria activa, al día siguiente la fecha cambia.
- [ ] **Precios de inversiones:**
  - [ ] Una inversión con símbolo (`NASDAQ:AAPL` o `CURRENCY:BTCUSD`) trae su precio con *Actualizar precios*: se crea la hoja auxiliar `Precios_Google` y, con la tasa automática activa, se actualiza al día siguiente.
  - [ ] Una acción de la BVC sin precio de Google se puede valorar con el precio manual.
- [ ] **Buscar en Google Finance:** al agregar una inversión, buscar `TSLA` o `VOO` muestra el nombre y el precio de hoy (se crea la hoja auxiliar `Buscar_Google`; la primera vez puede tardar unos segundos).
- [ ] **Recordatorios:** activarlos pide el permiso de Calendar, crea el calendario "Moni" con los pagos de los próximos 45 días y, al pagar algo, el evento viejo se va y aparece el siguiente.
- [ ] **Divisas:** un banco en USD, una conversión con tasa del banco y comisión aparte (se deshace todo junto); el Inicio muestra *Otras monedas*.
- [ ] **Gráficos:** los de Inicio, Movimientos, Presupuesto, Nómina, Servicios, Metas, Lista de deseos, Inversiones, CDT, Tarjetas, Créditos, Ahorro, Análisis, Vista anual, Calculadora y un bolsillo cargan sin errores en el celular.
- [ ] **Navegación:** las 4 pestañas (Inicio, Mi dinero, Pagos, Planear) y el botón **+** en el celular; barra lateral (secciones plegables, contraer, Registrar, Ctrl K) en el computador; el ícono de Moni en la pestaña del navegador.
- [ ] **Registro de errores:** *Ajustes → Registro de errores* abre y *Copiar el registro* funciona (también tras provocar un aviso).
- [ ] **Respaldos automáticos:** el disparador diario crea la copia (revisa "Moni Respaldos" al día siguiente).
- [ ] **Borrar todos mis datos** (en una cuenta de prueba): deja la app como recién instalada y quita el calendario.

## 3. Producción
- [ ] En el editor del proyecto de **producción**: ejecutar una vez `activarModoMultiusuario` y aceptar los permisos.
- [ ] Verificar que el proyecto de producción **no** tenga `DEMO_HABILITADO`.
- [ ] `npm run desplegar:prod` (la URL `/exec` no cambia entre versiones).
- [ ] Abrir la URL de producción: debe mostrar "Crear mi hoja" y **ninguna** opción de datos de demostración.
- [ ] Probar con una segunda cuenta de Google: cada persona ve solo su hoja.

## 4. Compartir
- [ ] Enviar la URL `/exec` de producción y la guía [Empezar con Moni](EMPEZAR.md).
- [ ] Avisar del mensaje *"Google no ha verificado esta aplicación"* (Configuración avanzada → Ir a Moni). Es normal mientras la app no pase la verificación de Google; para un grupo conocido es aceptable ([detalle](MULTIUSUARIO.md)).
- [ ] Facturación: **no genera costo** (Apps Script en cuentas personales). La verificación de Google solo importaría si la abres a muchas personas.

## 5. Después
- [ ] Medir tiempos reales en *Ajustes → Diagnóstico* (primera carga, guardar, crear hoja).
- [ ] Si algo falla: [Operación y solución de problemas](OPERACION.md). Para volver atrás: [Despliegue → Volver atrás](DESPLIEGUE.md#volver-atrás).

## Fuera de esta versión (ideas para después)
- Reducir el permiso de Drive a los archivos que crea la app (`drive.file`; evita la revisión de seguridad de Google si se abre a mucha gente). Hoy Drive se usa solo para la carpeta de respaldos y sus copias.
- Pruebas automáticas de la interfaz en el repositorio (hoy se revisan sintaxis y contraste, y los flujos se prueban en la vista previa a mano o con scripts de Playwright fuera del repositorio).
- Archivar movimientos por año cuando la hoja crezca mucho.
- Rendimiento por bolsillo (hoy se elige por banco).
