# Seguridad y privacidad

## Dónde están los datos
Todo vive en **un Google Sheet de la cuenta de la persona usuaria** y en su Google Drive (respaldos). Moni no envía datos a ningún servicio externo.

## Quién puede entrar
- La web app se despliega con *"Ejecutar como: el usuario que accede"*. Cada persona usa **sus propios permisos**: quien no tenga acceso de edición al Sheet no puede leer ni escribir nada.
- Capa extra opcional: en el editor de Apps Script → Configuración del proyecto → Propiedades de la secuencia de comandos, crea `USUARIOS_PERMITIDOS` con los correos autorizados separados por coma (por ejemplo `tucorreo@gmail.com`). Si no existe, no se restringe.
- Comparte el Sheet solo con quien deba verlo.

## Permisos que pide la app
| Permiso | Para qué |
|---|---|
| Hojas de cálculo | Leer y escribir la base de datos |
| Drive | Crear la carpeta de respaldos y las copias |
| Activadores (`script.scriptapp`) | El disparador diario de copias automáticas |
| Correo (`userinfo.email`) | Comprobar la lista `USUARIOS_PERMITIDOS` |

## Qué no debe subirse al repositorio
- `.clasp.json` (identifica tu proyecto de Apps Script) y `.clasprc.json` (**credenciales de clasp**): están en `.gitignore`. Usa `.clasp.json.example` como plantilla.
- Capturas, exportaciones o respaldos del Sheet real.
- IDs de hojas o carpetas: el ID del Sheet se guarda en las propiedades del script (`vincularHojaMoni()`), no en el código.
- Los datos de demostración usan nombres y cifras ficticias (prefijo `demo-`).

## Buenas prácticas
- Mantén el repositorio **privado** si contiene cifras de una persona real.
- Si publicaste algo por error (ID, correo, cifra): cámbialo y, si es una credencial, revócala. Borrar el archivo en un commit nuevo no lo quita del historial.
- Entradas del usuario: el texto se escapa antes de mostrarse (`esc()`), los enlaces de pago solo aceptan `http(s)://` y se abren con `rel="noopener noreferrer"`.
- Todas las escrituras toman un bloqueo del script, así que dos pestañas no se pisan.

## Reportar un problema
Abre un *issue* sin datos personales, o escribe a quien administra el proyecto.
