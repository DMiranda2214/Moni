# Desarrollo

## Requisitos
Node.js 18+. No hay dependencias que instalar: las pruebas y la vista previa usan solo Node. Para publicar se usa `clasp` (se descarga con `npx` al usarlo).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run verificar` | Sintaxis de todos los `.gs`/`.html` + todas las pruebas + contraste de colores. **Corre esto antes de cada commit** |
| `npm test` | Solo las pruebas |
| `npm run sintaxis` | Solo la sintaxis |
| `npm run contraste` | Contraste AA de los 6 colores de acento, claro y oscuro |
| `npm run vista` | Vista previa en <http://localhost:5178> con una base vacía |
| `npm run vista -- --demo` | Igual, con datos de demostración |
| `npm run vista -- --sin-instalar` | Para ver la pantalla de instalación |
| `npm run push` | Sube el código a Apps Script (`clasp`) |

En la vista previa, `/__reset?demo=1` reinicia la base en memoria.

## Cómo funcionan las pruebas
`tests/fake_gas.js` simula Google (SpreadsheetApp, CacheService, LockService, DriveApp, ScriptApp, PropertiesService, Utilities) **en memoria**; carga los `.gs` reales en un contexto de Node. Cada archivo `tests/test_*.js` exporta una función que recibe `prueba`, `assert` y `crearEntorno`:

```js
prueba('lo que se prueba', () => {
  const e = crearEntorno({});
  e.cargar('Setup.gs', 'Repo.gs', /* … */ 'Api.gs');
  e.llamar = (fn, ...args) => { e.ctx.__args = args; return JSON.parse(JSON.stringify(e.ejecutar(fn + '(...__args)'))); };
  e.llamar('setupDatabase');
  // …
});
```
> **Importante:** al crear un archivo `.gs` nuevo, agrégalo a la lista de `e.cargar(...)` de los `tests/*.js` y de `tests/dev_server.js`.

Los límites de lo que se prueba así: la lógica y las reglas sí; el rendimiento real, los permisos de Google y la interfaz en un celular real **no**. Eso se verifica a mano en el Sheet real.

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
4. Actualiza los conteos de tablas en los tests (`setupDatabase crea las N tablas`) y `docs/ESQUEMA.md`.
5. Una base ya instalada mostrará "Falta instalar" una vez: `setupDatabase` crea solo lo que falta.

### Una pantalla nueva
1. Función `vXxx()` que devuelve `{ titulo, html, acciones, despues }` y, si carga datos, un estado `App.xxx = { data, cargando, error }` con `cargarEn(App.xxx, 'ruta', 'getXxx', [])`.
2. Añádela a `pantalla()` (`case`), a `tituloRuta()` y enlázala (por ejemplo, desde *Más*).
3. Si una escritura la afecta, ponla en `null` dentro de `aplicarEscritura`.
4. Endpoint(s) en `Api.gs`.

### Un cambio de esquema en una tabla existente
`setupDatabase` **no modifica** encabezados existentes: los reporta. Para añadir una columna a una base ya instalada, agrégala a mano al final de la pestaña (o crea una tabla nueva, que es lo más seguro).

## Publicar un cambio
```bash
npm run verificar
npm run push
```
Y en Apps Script: *Implementar → Administrar implementaciones → Nueva versión*. Ver [Instalación](INSTALACION.md).

## Qué no subir
`.clasp.json`, `.clasprc.json`, `legacy/`, respaldos o capturas del Sheet real (ver [SECURITY.md](../SECURITY.md)).
