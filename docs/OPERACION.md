# Operación y solución de problemas

## Empezar con datos reales
No hay un paso de "arranque": los saldos iniciales se escriben en el **asistente de primeros pasos** (cada cuenta y cada bolsillo con lo que hay hoy). Los datos de demostración existen **solo en el entorno de desarrollo**; si los creaste allí, bórralos en Ajustes → Datos de demostración → Borrar (no afecta lo real). En producción no existen.

Si Moni y el banco difieren, corrige con **Cuadrar** en la cuenta: deja un ajuste con fecha y motivo.

## Respaldos
- **Ajustes → Respaldos:** crear ahora, activar copias automáticas, frecuencia (días) y cuántas conservar.
- Las copias se guardan en tu Drive, carpeta **"Moni Respaldos"**, con el nombre `Moni_Respaldo_AAAAMMDD_HHMMSS`. Las más viejas van a la papelera.
- **Recuperar:** abre la copia que quieras (está en tu Drive) y cópiale el enlace. Luego, en la app, **Ajustes → Mi cuenta → Usar otra hoja** y elige *"Ya tengo una hoja de Moni"* pegando ese enlace: la hoja actual no se borra. (Con una sola hoja instalada a mano, equivale a `vincularHojaMoni('<ID>')` en el editor.) Si solo necesitas algunas pestañas, también puedes copiarlas a mano a la hoja actual.
- Con *Borrar todos mis datos* las copias **no** se tocan salvo que lo pidas: son tu salvavidas.

## Tasa de referencia (Google Finance)
`TasasGoogle.gs`. `GOOGLEFINANCE` solo existe como fórmula de hoja: Moni crea la pestaña auxiliar **`Tasas_Google`** (una fórmula `=GOOGLEFINANCE("CURRENCY:USDCOP")` por moneda) y lee el resultado desde el código. **Actualizar ahora** y la actualización diaria (6:00, `actualizarTasasAuto`) guardan `Tasa_USD`/`Tasa_EUR` con su fecha y fuente. Si Google aún no devolvió el valor (hoja recién creada, `#N/A`), se avisa y se reintenta; si falla el disparador, queda en el Registro de errores. No es la TRM oficial: no se usa para saldos ni para conversiones. Para dejar de usarla, desactiva la opción en Ajustes → Divisas (la pestaña auxiliar se puede borrar).

## Recordatorios en Google Calendar
`Recordatorios.gs`. Activarlos (Ajustes → Recordatorios) crea el calendario "Moni", sincroniza y deja un disparador diario a las 5:00 (`sincronizarRecordatoriosAuto`). La sincronización es idempotente: cada evento lleva la etiqueta `moni_clave` (`tipo|id|fecha`) y solo se tocan los que la tienen. Si el disparador falla, queda en el **Registro de errores**. Desactivar quita el disparador pero conserva los eventos; **Quitar** borra el calendario; **Borrar todos mis datos** también lo hace.
- Requiere el permiso `calendar` en `appsscript.json`: tras desplegar, Google lo pide al abrir la app (hay que **crear una versión nueva** de la implementación).
- El horizonte (45 días) y la hora de los avisos son de Bogotá (UTC-5, sin horario de verano).

## Registro de errores
**Ajustes → Registro de errores** muestra lo que falló en producción (tabla `Log`, últimas 500 entradas). Niveles: **Error** (fallo inesperado o del navegador), **Aviso** (una regla de negocio rechazó algo) e **Info** (hechos como el borrado total o el inicio de operación). Cada entrada lleva la función, el mensaje, la traza y la versión de Moni. También quedan anotados los fallos del respaldo automático. **Copiar el registro** deja un texto listo para pegar en un reporte.

## Borrar todos los datos
**Ajustes → Privacidad → Borrar todos mis datos** (función `resetAllData`, en `Reinicio.gs`). Vacía las 29 tablas conservando sus encabezados, listas desplegables y formato, vuelve a sembrar los parámetros, las categorías y el escenario base, apaga las copias automáticas y los disparadores de tasa y recordatorios, y borra el calendario "Moni" de Google Calendar. Exige escribir `BORRAR` (la pantalla y el servidor lo validan). Deja una nota informativa en el registro de errores.
- **No toca:** el vínculo con la hoja (`SPREADSHEET_ID`, que con varias personas está en las propiedades de cada una) ni `USUARIOS_PERMITIDOS` (la app sigue funcionando), los PDF de Drive ni las copias de "Moni Respaldos", salvo que se marque la opción de mandarlas a la papelera (recuperables unos 30 días desde la papelera de Drive).
- Es irreversible: antes, **Crear un respaldo ahora** si hay duda.
- Para no perder la configuración de accesos, no borres las propiedades del script.

## Rutina sugerida
| Cuándo | Qué |
|---|---|
| Cada día | Registrar gastos; mirar *Próximos pagos* |
| Cada mes | Generar el presupuesto, registrar la nómina, pagar extractos, cuadrar cuentas |
| Cada enero | Actualizar el **SMMLV** (Ajustes → Parámetros de nómina) y revisar la plantilla |
| Antes de cambios grandes | Crear un respaldo |

## Problemas frecuentes
| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Falta instalar o actualizar la base de datos" | Falta una pestaña o columna (versión nueva) y es una sola hoja | Pulsar **Instalar** (con varias personas se actualiza sola al entrar) |
| "La tabla … no existe en la base de datos" | Se publicó una versión con tablas nuevas y la hoja aún no se actualizó | Recargar la página: la app vuelve a revisar la hoja y la actualiza; si no, **Instalar** |
| "Falta tu hoja de Moni" | La hoja vinculada se borró o ya no tienes acceso | Crear una nueva o vincular otra (la anterior no se toca) |
| "Actualiza el salario mínimo" en Inicio | El salario mínimo guardado es de un año anterior | *Más → Nómina → Parámetros de nómina* y guardar el nuevo; el aviso se va solo |
| "Google Finance todavía no devolvió la tasa" | La fórmula de la hoja `Tasas_Google` aún no calculó | Esperar unos segundos y reintentar |
| "Este parámetro lo gestiona la app" | Se intentó editar un parámetro reservado (tasas, recordatorios…) | Cámbialo desde su pantalla (Divisas, Recordatorios) |
| Una pantalla queda en esqueleto | Respuesta lenta de Google | Esperar 45 s: avisa con un error y **Reintentar**. Si se repite, revisa la conexión |
| "Tu sesión de Google venció" | Sesión cerrada | Recargar la página e iniciar sesión |
| "Moni está guardando otro cambio" | Dos acciones a la vez | Esperar unos segundos y reintentar |
| "Google pidió una pausa" | Cuota diaria de Apps Script | Esperar unos minutos |
| Los totales de Inicio no cuadran | (solo desarrollo) hay datos de demostración activos | Ajustes → Datos de demostración → Borrar |
| Cambié la hoja a mano y la app no lo muestra | Está leyendo lo que tiene en caché | Ajustes → **Actualizar desde la hoja** |
| Un saldo no coincide con el banco | Falta registrar algo | **Cuadrar** la cuenta |
| Una pestaña tiene encabezados distintos | Se editó a mano | Ajustes → Diagnóstico; restaurar los encabezados (la app no los toca) |
| No pasa nada al "Agregar a pantalla de inicio" | Navegador | Usar Chrome (Android) o Safari (iPhone) |

## No edites el Sheet a mano
Las pestañas son la base de datos: cambiar una fecha, un ID o un encabezado puede dejar la app incoherente. Las pestañas están protegidas con aviso. Para consultar, usa `Vista_Bolsillos` y `Vista_Anual` (menú **Moni → Instalar hojas de consulta**).

## Medir la velocidad
Ajustes → **Diagnóstico → Tiempos de esta sesión**: mediana de cada llamada, lo que ves tú y lo que tarda Apps Script. Metas: abrir ≤ 2 s con caché, guardar ≤ 1,5 s. En desarrollo, `node tests/medir_llamadas.js` cuenta cuántas llamadas a Google hace cada operación.

## Administración (varias personas)
- La aplicación se publica una vez y llega a todos; las hojas se actualizan solas al entrar. Cómo publicar y volver atrás: [Despliegue](DESPLIEGUE.md); cómo funciona por dentro: [Varias personas](MULTIUSUARIO.md).
- Quien administra **no ve** las hojas. Para una persona con un problema, pídele el **Registro de errores** (*Ajustes → Registro de errores → Copiar el registro*).
- Producción **no** debe tener la propiedad `DEMO_HABILITADO`.
