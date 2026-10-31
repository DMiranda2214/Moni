# Operación y solución de problemas

## Arranque del 1 de enero
Hazlo en este orden (Ajustes → **Arranque** lo guía y valida):
1. **Ajustes → Datos de demostración → Borrar.** Solo borra lo ficticio.
2. Crea tus **bancos, cuentas, bolsillos y tarjetas** reales.
3. **Arranque → Cargar saldos de apertura:** lo que hay en cada lugar al cierre del 31/12.
4. **Archivar pruebas:** anula (no borra) los movimientos anteriores a la fecha de arranque. Se pueden restaurar.
5. **Empezar a usar Moni:** crea un respaldo, activa las copias automáticas y **fija** los saldos de apertura.

Desde ahí, si Moni y el banco difieren, corrige con **Cuadrar** en la cuenta: deja un ajuste con fecha y motivo.

## Respaldos
- **Ajustes → Respaldos:** crear ahora, activar copias automáticas, frecuencia (días) y cuántas conservar.
- Las copias se guardan en tu Drive, carpeta **"Moni Respaldos"**, con el nombre `Moni_Respaldo_AAAAMMDD_HHMMSS`. Las más viejas van a la papelera.
- **Recuperar:** abre la copia que quieras, y o bien (a) úsala como Sheet nuevo (copia el ID con `vincularHojaMoni('<ID>')`), o (b) copia las pestañas necesarias al Sheet actual.

## Tasa de referencia (Google Finance)
`TasasGoogle.gs`. `GOOGLEFINANCE` solo existe como fórmula de hoja: Moni crea la pestaña auxiliar **`Tasas_Google`** (una fórmula `=GOOGLEFINANCE("CURRENCY:USDCOP")` por moneda) y lee el resultado desde el código. **Actualizar ahora** y la actualización diaria (6:00, `actualizarTasasAuto`) guardan `Tasa_USD`/`Tasa_EUR` con su fecha y fuente. Si Google aún no devolvió el valor (hoja recién creada, `#N/A`), se avisa y se reintenta; si falla el disparador, queda en el Registro de errores. No es la TRM oficial: no se usa para saldos ni para conversiones. Para dejar de usarla, desactiva la opción en Ajustes → Divisas (la pestaña auxiliar se puede borrar).

## Recordatorios en Google Calendar
`Recordatorios.gs`. Activarlos (Ajustes → Recordatorios) crea el calendario "Moni", sincroniza y deja un disparador diario a las 5:00 (`sincronizarRecordatoriosAuto`). La sincronización es idempotente: cada evento lleva la etiqueta `moni_clave` (`tipo|id|fecha`) y solo se tocan los que la tienen. Si el disparador falla, queda en el **Registro de errores**. Desactivar quita el disparador pero conserva los eventos; **Quitar** borra el calendario; **Borrar todos mis datos** también lo hace.
- Requiere el permiso `calendar` en `appsscript.json`: tras desplegar, Google lo pide al abrir la app (hay que **crear una versión nueva** de la implementación).
- El horizonte (45 días) y la hora de los avisos son de Bogotá (UTC-5, sin horario de verano).

## Registro de errores
**Ajustes → Registro de errores** muestra lo que falló en producción (tabla `Log`, últimas 500 entradas). Niveles: **Error** (fallo inesperado o del navegador), **Aviso** (una regla de negocio rechazó algo) e **Info** (hechos como el borrado total o el inicio de operación). Cada entrada lleva la función, el mensaje, la traza y la versión de Moni. También quedan anotados los fallos del respaldo automático. **Copiar el registro** deja un texto listo para pegar en un reporte.

## Borrar todos los datos
**Ajustes → Privacidad → Borrar todos mis datos** (función `resetAllData`, en `Reinicio.gs`). Vacía las 27 tablas conservando sus encabezados, listas desplegables y formato, vuelve a sembrar los parámetros, las categorías y el escenario base, y apaga las copias automáticas. Exige escribir `BORRAR` (la pantalla y el servidor lo validan).
- **No toca:** `SPREADSHEET_ID` ni `USUARIOS_PERMITIDOS` (la app sigue funcionando), los PDF de Drive ni las copias de "Moni Respaldos", salvo que se marque la opción de mandarlas a la papelera (recuperables unos 30 días desde la papelera de Drive).
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
| "Falta instalar la base de datos" | Falta una pestaña (versión nueva) | Pulsar **Instalar** |
| Una pantalla queda en esqueleto | Respuesta lenta de Google | Esperar 45 s: avisa con un error y **Reintentar**. Si se repite, revisa la conexión |
| "Tu sesión de Google venció" | Sesión cerrada | Recargar la página e iniciar sesión |
| "Moni está guardando otro cambio" | Dos acciones a la vez | Esperar unos segundos y reintentar |
| "Google pidió una pausa" | Cuota diaria de Apps Script | Esperar unos minutos |
| Los totales de Inicio no cuadran | Hay datos de demostración activos | Ajustes → Datos de demostración → Borrar |
| Un saldo no coincide con el banco | Falta registrar algo | **Cuadrar** la cuenta |
| Una pestaña tiene encabezados distintos | Se editó a mano | Ajustes → Diagnóstico; restaurar los encabezados (la app no los toca) |
| No pasa nada al "Agregar a pantalla de inicio" | Navegador | Usar Chrome (Android) o Safari (iPhone) |

## No edites el Sheet a mano
Las pestañas son la base de datos: cambiar una fecha, un ID o un encabezado puede dejar la app incoherente. Las pestañas están protegidas con aviso. Para consultar, usa `Vista_Bolsillos` y `Vista_Anual` (menú **Moni → Instalar hojas de consulta**).

## Medir la velocidad
Ajustes → **Diagnóstico → Tiempos de esta sesión**: mediana de cada llamada, lo que ves tú y lo que tarda Apps Script. Metas: abrir ≤ 2 s con caché, guardar ≤ 1,5 s.
