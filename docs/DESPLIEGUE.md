# Despliegue: desarrollo y producción

Dos entornos, cada uno un **proyecto de Apps Script** con su propia implementación web. Se publica con **un comando**, desde tu computador, sin copiar ni pegar código. (No hay CI/CD automático: GitHub Actions pide una cuenta con la facturación al día, así que se descartó. Su lugar lo ocupan los scripts de abajo y una verificación local antes de cada `git push`.)

| Entorno | Para qué | Datos | Demostración |
|---|---|---|---|
| **desarrollo** | Probar cada cambio con calma | De ejemplo | Sí (propiedad `DEMO_HABILITADO`) |
| **producción** | La app que usa la gente | Reales, una hoja por persona | **No existe** |

## Preparación (una sola vez)
1. **Dos proyectos** en <https://script.google.com> → *Nuevo proyecto* ("Moni dev" y "Moni"). Copia el **ID de la secuencia de comandos** de cada uno (Configuración del proyecto). No uses `clasp create`: sobrescribe el manifiesto.
2. **Activa la API de Apps Script** en <https://script.google.com/home/usersettings> con la cuenta dueña de los proyectos.
3. **Un archivo por entorno** con su ID (no se suben a Git: están en `.gitignore`):
   ```bash
   cp .clasp.dev.json.example  .clasp.dev.json    # escribe el scriptId de desarrollo
   cp .clasp.prod.json.example .clasp.prod.json   # escribe el scriptId de producción
   npm run login
   ```
4. **Propiedades de script** (Configuración del proyecto → Propiedades de la secuencia de comandos):
   - **Desarrollo:** `DEMO_HABILITADO` = `TRUE`.
   - **Producción:** ninguna de demostración. Para varias personas, ejecuta una vez la función `activarModoMultiusuario` en el editor ([ver](MULTIUSUARIO.md)).
5. **Primer despliegue de cada uno**: `npm run push:dev` y `npm run push:prod`; luego, en cada editor, *Implementar → Nueva implementación → Aplicación web* (toma la configuración de `appsscript.json`: *como el usuario que accede*, *cualquier persona con cuenta de Google*).
6. **Verificación antes de subir** (opcional pero recomendada): `npm run hooks` activa, en tu copia del repositorio, un chequeo que corre sintaxis, pruebas y contraste antes de cada `git push` y lo detiene si algo falla (se salta con `git push --no-verify`).

## Uso diario
```bash
npm run verificar        # sintaxis + pruebas + contraste
npm run desplegar:dev    # sube el paquete de desarrollo y publica una versión nueva
# … pruebas en la URL de desarrollo …
npm run desplegar:prod   # lo mismo para producción
```
`desplegar:*` sube el código y crea una **versión nueva** en la implementación (la URL `/exec` no cambia). Si el proyecto tuviera más de una implementación con versión, indica cuál: `DEPLOYMENT_ID=<id> npm run desplegar:prod`. Para ver los IDs: `npm run deployments:dev` / `deployments:prod`.

Solo subir sin publicar versión: `npm run push:dev` / `push:prod` (útil para probar en la URL `/dev` del editor, que siempre sirve lo último).

> `npm run push`, a secas, sube todo al proyecto **original** (el de tu hoja personal, con `.clasp.json`), no a desarrollo ni producción.

## Producción no lleva datos de demostración
Hay **dos candados**:
1. **El paquete:** `scripts/publicar.sh produccion` arma el paquete y **reemplaza `Demo.gs`** (el generador de datos de ejemplo) por un archivo vacío (`scripts/stubs/Demo.gs`) que solo falla con un mensaje claro. Si algo del generador siguiera en el paquete, el script **no lo sube**.
2. **La propiedad:** aun con el generador, `sembrarDatosDemo` exige `DEMO_HABILITADO = TRUE`, que solo existe en desarrollo. En producción desaparecen de la app *Datos de demostración* y el botón "Explorar con datos de ejemplo", y el servidor rechaza esas operaciones.

Las pruebas (`tests/test_produccion.js`) arman el paquete de producción y comprueban todo esto. Para revisarlo tú:
```bash
npm run paquete:prod          # arma el paquete y escribe su carpeta
npm run vista -- --prod       # la app como en producción (sin datos de demostración)
```

## Volver atrás
Cada `desplegar:*` deja una **versión** inmutable en Apps Script. Para volver a una anterior:
```bash
npx @google/clasp -P "$PWD/.clasp.prod.json" list-versions
npx @google/clasp -P "$PWD/.clasp.prod.json" redeploy <ID_DE_LA_IMPLEMENTACION> -V <NUMERO_DE_VERSION>
```
O en el editor: *Implementar → Administrar implementaciones → ✏️ → Versión*. (Con `clasp` 3.x, `-P` exige una **ruta absoluta**; por eso `"$PWD/…"`.)

## Qué pasa con los datos al desplegar
Desplegar **solo cambia el código**. Los datos viven en las hojas:
- **Varias personas:** la hoja de cada una se actualiza sola al entrar si la versión trae tablas o columnas nuevas.
- **Una hoja:** la app pide **Instalar** una vez (crea lo que falta, sin borrar nada).

## Seguridad
- Tus credenciales de `clasp` están en `~/.clasprc.json`, solo en tu computador. No las subas a ningún lado.
- El repositorio es público: no subas IDs de hojas, `.clasp*.json` ni respaldos (ya están en `.gitignore`).
- Si algún día quieres automatizarlo, el flujo de GitHub Actions es posible (verificar en cada pull request y desplegar con aprobación manual a producción), pero necesita facturación activa en GitHub.
