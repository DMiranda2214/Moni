# Lanzamiento de la versión 1.0.0

Lista para pasar a producción y compartir la app. Marca cada paso.

## 1. Antes de publicar (en tu computador)
- [ ] `git checkout main && git pull` (con la versión 1.0.0 ya fusionada).
- [ ] `npm run verificar` → sintaxis, pruebas y contraste en verde.
- [ ] `npm run paquete:prod` → arma el paquete de producción y confirma que **no lleva datos de demostración** (si algo del generador quedara, el script se detiene).

## 2. Probar en desarrollo
- [ ] `npm run desplegar:dev` y abre la URL `/exec` de **desarrollo**.
- [ ] Propiedad de script `DEMO_HABILITADO = TRUE` solo en el proyecto de desarrollo.
- [ ] Crear la hoja desde cero (barra "n de 28") y completar el asistente con una cuenta de prueba.
- [ ] Registrar un gasto, un ingreso y un movimiento entre bolsillos; abrir su detalle y editarlo.
- [ ] Generar el presupuesto del mes: aparecen las suscripciones y los servicios.
- [ ] Nómina: sueldo, "Agregar algo de este mes" y registrar el pago.
- [ ] Ahorro: banco con rendimiento diario y otro "solo bolsillos".

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
- Reducir el permiso de Drive a los archivos que crea la app (evita la revisión de seguridad de Google si se abre a mucha gente).
- Archivar movimientos por año cuando la hoja crezca mucho.
- Rendimiento por bolsillo (hoy se elige por banco).
