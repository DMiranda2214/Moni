# Seguridad y privacidad

## Dónde están los datos
Cada persona tiene **su propia hoja de Google Sheets** en **su** Google Drive (y sus respaldos en su Drive). Moni no tiene servidor propio ni envía datos a servicios de terceros: todo ocurre dentro de Google (Hojas, Drive, Calendar). La tasa del dólar, si la activas, la calcula la fórmula `GOOGLEFINANCE` de tu propia hoja.

**Quien administra la aplicación no puede ver las hojas de las personas**: la app corre "como el usuario que accede", así que todo lo que lee o escribe es de esa persona y con sus permisos. Tampoco puede arreglárselas: si algo se daña, se recupera de los respaldos de la dueña.

## Un repositorio público
El código de Moni es **público** para que más gente pueda usar la app y revisarla. Por eso:
- **Nunca** se sube al repositorio una hoja real, una captura con cifras, un respaldo, un ID de hoja o carpeta, ni credenciales. `.gitignore` excluye `.clasp*.json`, `.clasprc.json`, `.env*`, claves y `legacy/`; revisa `git status` antes de cada commit.
- Los datos de demostración usan nombres y cifras inventados (prefijo `demo-`) y **no viajan a producción** (ver [Despliegue](docs/DESPLIEGUE.md)).
- El ID de la hoja de cada persona no está en el código: se guarda en las propiedades de **esa persona** (`UserProperties`), que nadie más puede leer.
- Si publicaste algo por error (un ID, un correo, una cifra): cámbialo y, si es una credencial, **revócala**. Borrar el archivo en un commit nuevo no lo quita del historial.
- Las credenciales de `clasp` (`~/.clasprc.json`) son de tu cuenta de Google y se quedan en tu computador ([ver](docs/DESPLIEGUE.md)).

## Quién puede entrar
- La web app se despliega con *"Ejecutar como: el usuario que accede"* y *"Cualquier persona con cuenta de Google"* (`appsscript.json`). Cada persona entra con su cuenta y trabaja solo con su hoja ([Varias personas](docs/MULTIUSUARIO.md)).
- Capa extra opcional: en Configuración del proyecto → Propiedades de la secuencia de comandos, crea `USUARIOS_PERMITIDOS` con los correos autorizados separados por coma. Si no existe, no se restringe. Útil para una prueba cerrada antes de compartir la URL.
- Si dos personas comparten **una misma hoja** (pareja), cada una usa su cuenta con permiso de edición sobre esa hoja; el resto de sus datos (propiedades, activadores, calendario) sigue siendo de cada una.
- Comparte tu hoja solo con quien deba verla.

## Permisos que pide la app
| Permiso | Para qué |
|---|---|
| Hojas de cálculo | Crear y leer/escribir la hoja de la persona |
| Drive | Crear la carpeta de respaldos ("Moni Respaldos") y las copias de la hoja. **Es un permiso amplio** (restringido por Google): ver más abajo |
| Activadores (`script.scriptapp`) | Los disparadores diarios de la propia persona: copias automáticas, recordatorios de Calendar y tasa de referencia (solo si los activa) |
| Google Calendar | Crear el calendario "Moni" y sus eventos de pagos (solo si activa los recordatorios). Los eventos incluyen el valor de cada pago: no compartas ese calendario con quien no deba verlo |
| Correo (`userinfo.email`) | Mostrar su correo en *Mi cuenta* y comprobar `USUARIOS_PERMITIDOS` |

**Verificación de Google.** Mientras la app no esté verificada, cada persona verá *"Google no ha verificado esta aplicación"* y debe elegir *Configuración avanzada → Ir a Moni*. Para un grupo conocido es aceptable. Si la comparten decenas de personas o más conviene pasar la verificación; el permiso de Drive es el que más la complica, y reducirlo a los archivos que crea la propia app exigiría cambios en el código (está anotado en la [lista de lanzamiento](docs/LANZAMIENTO.md)).

## Cómo se protege el código
- **Entradas del usuario:** el texto se escapa antes de mostrarse (`esc()`), los enlaces de pago solo aceptan `http(s)://` y se abren con `rel="noopener noreferrer"`. Cada función pública del servidor **valida su entrada** (se puede invocar desde fuera de la interfaz).
- **Concurrencia:** las escrituras toman un bloqueo (de la persona en modo multiusuario, del script con una sola hoja), así que dos pestañas no se pisan.
- **Acciones destructivas:** *Borrar todos mis datos* exige escribir `BORRAR` y el servidor lo vuelve a comprobar; no toca los respaldos de Drive salvo que se pida.
- **Datos de demostración:** el paquete de producción no incluye el generador y el servidor rechaza crearlos (dos candados).
- **Registro de errores:** guarda mensajes y trazas técnicas en la hoja de la persona (nunca en un servidor externo); no incluye contraseñas porque la app no las maneja.
- Moni **no se conecta a los bancos** ni pide sus contraseñas: la persona registra los movimientos.

## Reportar un problema
Para fallos comunes abre un *issue* **sin datos personales** (el repositorio es público: lo que escribas lo ve cualquiera). Para algo de seguridad, no lo publiques: escribe en privado a quien administra el proyecto.
