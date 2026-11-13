# Lanzamiento

Lista para pasar a producción y compartir la app. Sirve para cada versión nueva: marca las casillas con la versión que vas a publicar. Las secciones 2 bis y 2 ter dicen qué probar de lo agregado desde la 1.0.


## 1. Antes de publicar (en tu computador)
- [ ] `git checkout main && git pull`, con la versión que vas a publicar ya fusionada.
- [ ] `npm run verificar` → sintaxis, pruebas y contraste en verde.
- [ ] `npm run paquete:prod` → arma el paquete de producción y confirma que **no lleva datos de demostración** (si algo del generador quedara, el script se detiene).

## 2. Probar en desarrollo
- [ ] `npm run desplegar:dev` y abre la URL `/exec` de **desarrollo**.
- [ ] Propiedad de script `DEMO_HABILITADO = TRUE` solo en el proyecto de desarrollo.
- [ ] Crear la hoja desde cero (barra "n de 29") y completar el asistente con una cuenta de prueba.
- [ ] Registrar un gasto, un ingreso y un movimiento entre bolsillos; abrir su detalle y editarlo.
- [ ] Generar el presupuesto del mes: aparecen las suscripciones y los servicios.
- [ ] Nómina: sueldo, "Agregar algo de este mes" y registrar el pago.
- [ ] Ahorro: banco con rendimiento diario y otro "solo bolsillos".

## 2 bis. Qué probar de la 1.1.0 en desarrollo
- [ ] Una hoja de la 1.0 recibe sola la tabla `CDTs` y la columna de hogar al abrir la app.
- [ ] CDT: crear uno que ya existía (no cambia saldos) y uno nuevo descontando el capital; ver "Invertido" en Inicio; cobrarlo, cancelarlo y renovarlo.
- [ ] Hogares: Netflix en dos hogares; el presupuesto muestra *Netflix · Hogar*.
- [ ] Fechas: escribir `2026/11/06` en un gasto y elegir otra con el calendario.
- [ ] Avisos: "Para tener en cuenta" en Inicio; "Ahora no" oculta y *Ajustes → Avisos de Inicio* los devuelve.
- [ ] Primeros pasos: tocar lo ya agregado lo abre para editarlo.

## 2 ter. Lo que el simulador de las pruebas no puede comprobar (probar en Google real)
- [ ] **Dólar de Google Finance:** en *Ajustes → Divisas*, *Actualizar ahora* trae la tasa (puede tardar unos segundos la primera vez); con la actualización diaria activa, al día siguiente la fecha cambia.
- [ ] **Recordatorios:** activarlos pide el permiso de Calendar, crea el calendario "Moni" con los pagos de los próximos 45 días y, al pagar algo, el evento viejo se va y aparece el siguiente.
- [ ] **Divisas:** un banco en USD, una conversión con tasa del banco y comisión aparte (se deshace todo junto); el Inicio muestra *Otras monedas*.
- [ ] **Gráficos:** los de Inicio, Movimientos, Presupuesto, Nómina, Servicios, Regalos, CDT, Deudas, Ahorro, Vista anual y un bolsillo cargan sin errores en el celular.
- [ ] **Navegación:** las 4 pestañas y el botón **+** en el celular; barra lateral (contraer, Registrar, Ctrl K) en el computador; el ícono de Moni en la pestaña del navegador.
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
- Pruebas automáticas de la interfaz (hoy solo se revisan sintaxis y contraste, y los flujos se prueban a mano).
- Archivar movimientos por año cuando la hoja crezca mucho.
- Rendimiento por bolsillo (hoy se elige por banco).
