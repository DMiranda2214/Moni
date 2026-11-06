# Varias personas con una sola aplicación

Una aplicación desplegada **una sola vez** que usan muchas personas, **cada una con sus finanzas separadas**. Nadie copia ni pega código: cuando se publica una mejora, llega a todos.

## Cómo funciona
- La web app corre **"como el usuario que accede"**: todo lo que se lee o escribe en Sheets, Drive y Calendar es de esa persona y con sus permisos.
- La **primera vez** que alguien entra, Moni le ofrece **crear su hoja** (se crea en su Drive) o **vincular una hoja de Moni que ya tenga**. El ID de esa hoja queda en las propiedades de la persona (`UserProperties`), que nadie más puede leer.
- La **caché**, el **bloqueo** y los **activadores** (copias automáticas, recordatorios de Calendar y tasas) también son de cada persona. Nada se mezcla.
- Una versión nueva con tablas o columnas nuevas **actualiza sola la hoja** de cada persona la primera vez que entra, sin borrar nada.
- **Quien administra la aplicación no ve los datos de nadie**: cada hoja es de su dueña. Tampoco puede arreglarla por ella: si algo se daña, se recupera de sus respaldos.

## Una hoja compartida (pareja)
Dos personas que quieren ver lo mismo: una crea su hoja, la **comparte** con la otra (permiso de edición) y la otra elige **"Ya tengo una hoja de Moni"** y pega el enlace. Las dos usan la misma hoja con su propia cuenta. El bloqueo es por persona, así que si escriben **exactamente a la vez** podrían pisarse; es poco probable en finanzas personales.

## Activarlo (administración)
1. Despliega la aplicación (ver [Instalación](INSTALACION.md) o [Despliegue](DESPLIEGUE.md)). Para varias personas conviene un **proyecto de Apps Script independiente**, no unido a una hoja.
2. En el editor de Apps Script, ejecuta **una vez** la función `activarModoMultiusuario` (la lista de funciones está en la barra superior). Es lo único que cambia el comportamiento: sin esa propiedad, la app funciona como siempre, con una sola hoja.
3. Despliega como **aplicación web** con *Ejecutar como: el usuario que accede* y *Quién tiene acceso: cualquier persona con cuenta de Google* (es lo que trae `appsscript.json`).
4. Comparte solo la **URL** `/exec`.
5. Opcional: para **restringir quién puede entrar**, crea la propiedad de script `USUARIOS_PERMITIDOS` con los correos autorizados separados por coma.

Para volver al modo de una sola hoja: `desactivarModoMultiusuario`.

## Producción sin datos de demostración
El paquete de producción no incluye el generador de datos de ejemplo y la propiedad `DEMO_HABILITADO` solo existe en desarrollo. Detalle en [Despliegue](DESPLIEGUE.md).

## Lo que ve cada persona
- **Bienvenida:** *Crear mi hoja* o *Ya tengo una hoja de Moni*. Google le pedirá permiso la primera vez (crear archivos en su Drive).
- **Ajustes → Mi cuenta:** su correo, un enlace a su hoja y *Usar otra hoja* (suelta la actual sin borrarla y apaga sus copias automáticas y recordatorios).

## Permisos y verificación de Google
La app pide acceso a Hojas, Drive (para crear la hoja y las copias de seguridad), Calendar (recordatorios), activadores y correo (`appsscript.json`). Mientras la app no esté **verificada por Google**, cada persona verá el aviso *"Google no ha verificado esta aplicación"* y deberá elegir *Configuración avanzada → Ir a Moni*. Para un grupo conocido es aceptable; **si la comparten decenas de personas o más, conviene pasar la verificación de Google** (el alcance de Drive es restringido y exige revisión). Reducir el alcance de Drive a archivos creados por la propia app exigiría cambios en el código.

## Cuotas
Con *"como el usuario que accede"* cada persona consume **sus propias cuotas** de Apps Script, no las del administrador.

## Qué cambia en el código
| Pieza | Una hoja | Varias personas |
|---|---|---|
| ID de la hoja | Propiedades del script | Propiedades de la persona |
| Caché | De todo el script | De la persona |
| Bloqueo | Del script | De la persona |
| Activadores | Del script | De la persona |
| Marcas de respaldo | Del script | De la persona |
| Tablas nuevas | "Instalar" a mano | Automático al entrar |

Está en `Repo.gs` (`modoMultiusuario_`, `propiedades_`, `cache_`, `tomarBloqueo`) y `Multiusuario.gs`. Las pruebas (`tests/test_multiusuario.js`) simulan varias personas con hojas, propiedades y activadores separados.
