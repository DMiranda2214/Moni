# Desarrollo

## Requisitos
Node.js 18+. No hay dependencias que instalar: las pruebas y la vista previa usan solo Node. Para publicar se usa `clasp` (se descarga con `npx` al usarlo).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run verificar` | Sintaxis de todos los `.gs`/`.html` + todas las pruebas + contraste de colores. **Corre esto antes de cada commit** (con `npm run hooks` se corre solo antes de cada `git push`) |
| `npm test` | Solo las pruebas |
| `npm run sintaxis` | Solo la sintaxis |
| `npm run contraste` | Contraste AA de los 6 colores de acento y de los pares de texto, claro y oscuro |
| `npm run vista` | Vista previa en <http://localhost:5178> con una base vacía |
| `npm run vista -- --demo` | Igual, con datos de demostración |
| `npm run vista -- --sin-instalar` | Para ver la pantalla de instalación |
| `npm run vista -- --prod` | Como producción: sin datos de demostración (`DEMO_HABILITADO` apagado) |
| `npm run vista:multi` | Modo varias personas: empieza sin hoja (pantalla de bienvenida) |
| `node tests/medir_llamadas.js` | Cuenta las llamadas a Google (hojas, caché) de cada operación |
| `npm run paquete:prod` | Arma el paquete de producción (sin `Demo.gs`) y escribe su carpeta, para revisarlo |
| `npm run push:dev` / `push:prod` | Sube el código al proyecto de ese entorno (clasp) |
| `npm run desplegar:dev` / `desplegar:prod` | Sube y publica una **versión nueva** en la implementación (la URL `/exec` no cambia) |
| `npm run deployments:dev` / `deployments:prod` | Lista las implementaciones del entorno |
| `npm run hooks` | Activa el chequeo `pre-push` (sintaxis + pruebas + contraste) en tu copia del repositorio |
| `npm run login` | Inicia sesión de `clasp` (una vez) |
| `npm run push` / `pull` / `abrir` | `clasp` contra el proyecto **original** (`.clasp.json`), no contra desarrollo ni producción |

En la vista previa, `/__reset?demo=1` reinicia la base en memoria.

## Cómo funcionan las pruebas
`tests/fake_gas.js` simula Google (SpreadsheetApp, CacheService, LockService —de script y de persona—, DriveApp, ScriptApp, CalendarApp, PropertiesService —de script y de persona—, Utilities) **en memoria**; carga los `.gs` reales en un contexto de Node. Cada archivo `tests/test_*.js` exporta una función que recibe `prueba`, `assert` y `crearEntorno`:

```js
prueba('lo que se prueba', () => {
  const e = crearEntorno({});
  e.cargar('Setup.gs', 'Repo.gs', /* … */ 'Api.gs');
  e.llamar = (fn, ...args) => { e.ctx.__args = args; return JSON.parse(JSON.stringify(e.ejecutar(fn + '(...__args)'))); };
  e.llamar('setupDatabase');
  // …
});
```
> **Importante:** al crear un archivo `.gs` nuevo, agrégalo a la lista de `e.cargar(...)` de los `tests/*.js` y de `tests/dev_server.js` (hay una prueba que carga todos los `.gs` juntos y avisa de nombres repetidos).

Las pruebas usan el **reloj real** (`bogota()` en los helpers): no asumas un día del mes (una fecha "el día 10" falla del 1 al 9 porque no se permiten movimientos futuros). Usa fechas relativas a hoy.

Archivos de pruebas: `test_catalogos`, `test_movimientos`, `test_presupuesto`, `test_deudas`, `test_extras` (ahorro, regalos, respaldos, suscripciones…), `test_divisas`, `test_graficos`, `test_recordatorios`, `test_logs`, `test_reinicio`, `test_cdt`, `test_avisos`, `test_multiusuario` y `test_produccion` (arma el paquete de producción y comprueba que no lleve datos de demostración).

Los límites de lo que se prueba así: la lógica y las reglas sí; el rendimiento real, los permisos de Google, `GOOGLEFINANCE` (el simulador no calcula fórmulas), los avisos reales de Calendar y la interfaz en un celular real **no**. La interfaz (`app_js.html`) solo pasa la revisión de sintaxis y de contraste: sus flujos se prueban a mano en la vista previa (`npm run vista`) y en el entorno de desarrollo. Eso se verifica con la [lista de lanzamiento](LANZAMIENTO.md).

## Convenciones
- **Español** en nombres de dominio y mensajes; funciones privadas terminan en `_`.
- Un `.gs` por responsabilidad; las funciones públicas de `Api.gs` solo validan y llaman al dominio.
- Mensajes de error **para una persona** (qué pasó y qué hacer), no técnicos.
- Nunca `confirm()`/`prompt()`: usa hojas modales y avisos con **Deshacer**.
- Texto del usuario siempre con `esc()` antes de ponerlo en HTML.
- Escribe una prueba por regla de negocio nueva; si corriges un error, añade la prueba que lo habría detectado.

## Cómo extender
### Un catálogo nuevo (una tabla editable)
1. `Setup.gs`: añade la tabla a `SCHEMAS` (con `Activo` y `Orden`), sus `ENUMS` y `COLUMNAS_TEXTO` si guarda fechas.
2. `Catalogos.gs`: añade su definición a `CATALOGOS` (`id`, `prefijo`, `normalizar`, `bloqueos`). Con eso ya funcionan `listCatalogo`, `saveCatalogo`, `disableCatalogo`… y viaja en `getBootstrap`.
3. `app_js.html`: añade su entrada a `CAT` (títulos, campos, `fila`). Con eso Ajustes ya lo edita.
4. Actualiza los conteos de tablas en los tests (`setupDatabase crea las N tablas`), `docs/ESQUEMA.md` y los números de tablas de los documentos.
5. **Sube `ESQUEMA_VERSION`** en `Setup.gs` (y la versión de la app): así la revisión recordada de las hojas ya creadas se repite y la tabla nueva se crea sola al entrar.
6. Si el catálogo es de la persona y debe viajar en el arranque, revisa `armarBootstrap_` y `getRefresco` (`RELACIONADAS_`).

### Una pantalla nueva
1. Función `vXxx()` que devuelve `{ titulo, html, acciones, despues }` y, si carga datos, un estado `App.xxx = { data, cargando, error }` con `cargarEn(App.xxx, 'ruta', 'getXxx', [])`.
2. Añádela a `pantalla()` (`case`), a `tituloRuta()` y enlázala (por ejemplo, desde *Más*).
3. Si una escritura la afecta, ponla en `null` dentro de `aplicarEscritura`.
4. Endpoint(s) en `Api.gs`.

### Un cambio de esquema en una tabla existente
- **Una columna nueva al final de la tabla (antes de `Creado_En`):** agrégala al esquema en `SCHEMAS` **y** declárala en `MIGRACIONES_COLUMNAS` (`{ tabla, columna, valor }`). `migrarColumnas_` la inserta en su lugar, con el valor por defecto, en las hojas ya creadas; sube `ESQUEMA_VERSION`. Hay que cubrirlo con una prueba de migración (una hoja con el encabezado viejo recibe la columna sin perder datos y el proceso se puede repetir).
- **Cualquier otro cambio** (renombrar, quitar o reordenar columnas): `setupDatabase` **no lo toca** y lo reporta en Diagnóstico, para no dañar datos. Lo más seguro es una tabla nueva y migrar los datos con una función repetible (ver `docs/PLAN_SERVICIOS_UNIFICADOS.md`).

## Publicar un cambio
```bash
npm run verificar
git push                 # con `npm run hooks` el chequeo corre antes de subir
npm run desplegar:dev    # prueba en la URL de desarrollo
npm run desplegar:prod   # cuando esté probado
```
Detalle (entornos, propiedades de script, volver a una versión anterior) en [Despliegue](DESPLIEGUE.md). Cada versión nueva lleva su entrada en el [CHANGELOG](../CHANGELOG.md) y se refleja en `package.json` y `VERSION_APP` (`Logs.gs`).

## Qué no subir
`.clasp*.json` (identifican tus proyectos de Apps Script), `.clasprc.json` (credenciales de clasp), `legacy/`, respaldos o capturas de una hoja real. **El repositorio es público**: ningún dato personal, ID de hoja ni credencial (ver [SECURITY.md](../SECURITY.md)).
