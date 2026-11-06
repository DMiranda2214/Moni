# Despliegue automático (CI/CD)

Cada cambio que entra a `main` se **verifica**, pasa a **desarrollo** y, tras una **aprobación**, a **producción**. Nadie copia ni pega código ni descarga nada.

```
 pull request ──► Verificar (sintaxis + pruebas + contraste)
 push a main  ──► Verificar ──► Desarrollo (automático) ──► Producción (con aprobación)
```

Los archivos: [`.github/workflows/verificar.yml`](../.github/workflows/verificar.yml), [`desplegar.yml`](../.github/workflows/desplegar.yml) y [`.github/scripts/desplegar.sh`](../.github/scripts/desplegar.sh).

## Entornos
Un **entorno** es un proyecto de Apps Script (con su implementación y, si aplica, su hoja de datos):

| Entorno | Para qué | Datos |
|---|---|---|
| **desarrollo** | Probar cada cambio con calma | Datos de demostración |
| **producción** | La app que usa la gente | Reales |

Cada uno tiene su `scriptId` y su implementación. (Con `clasp` 3.x, `-P` exige una **ruta absoluta** al archivo; los scripts `npm run push:dev` y `push:prod` ya la usan.) La URL `/exec` de producción **no cambia** al desplegar.

## Preparación (una sola vez)
1. **Crea los dos proyectos** en <https://script.google.com> → *Nuevo proyecto* (uno "Moni dev", otro "Moni"). Copia el **ID de la secuencia de comandos** de cada uno (Configuración del proyecto). No uses `clasp create`: sobrescribe el manifiesto.
2. **Activa la API de Apps Script** en <https://script.google.com/home/usersettings> con la cuenta dueña de los proyectos.
3. **Primer despliegue a mano**, para que existan las implementaciones:
   ```bash
   cp .clasp.dev.json.example  .clasp.dev.json    # escribe el scriptId de desarrollo
   cp .clasp.prod.json.example .clasp.prod.json   # escribe el scriptId de producción
   npm run login
   npm run push:dev    && npm run push:prod
   ```
   En cada editor: *Implementar → Nueva implementación → Aplicación web* (se toma la configuración de `appsscript.json`). Para varias personas, ejecuta antes `activarModoMultiusuario` en producción ([ver](MULTIUSUARIO.md)).
4. **Anota el ID de cada implementación**:
   ```bash
   npm run deployments:prod
   npm run deployments:dev
   ```
5. **Credenciales de clasp** (de la cuenta dueña): tras `npm run login`, el contenido de `~/.clasprc.json` es el secreto `CLASPRC_JSON`.
6. En GitHub → **Settings → Environments** crea **`desarrollo`** y **`produccion`**. En cada uno:
   - **Secreto** `CLASPRC_JSON` = el contenido del archivo.
   - **Variables** `SCRIPT_ID` y `DEPLOYMENT_ID` de ese entorno.
   - En **produccion**, activa **Required reviewers** (aprobación manual).
7. **Protege `main`** (Settings → Branches): exige pull request y que pase el chequeo *Verificar*.

## Uso diario
```bash
git switch -c mi-cambio
# … cambios …
npm run verificar        # lo mismo que corre el CI
git push -u origin mi-cambio   # abre el pull request; GitHub corre "Verificar"
```
Al fusionar a `main`: se verifica otra vez, se despliega a **desarrollo** solo, y GitHub pide la **aprobación** para producción. También se puede lanzar a mano desde *Actions → Desplegar → Run workflow*.

## Volver atrás
Cada despliegue crea una **versión** inmutable en Apps Script (la descripción es el hash del commit). Para volver a una anterior:
```bash
npx @google/clasp -P "$PWD/.clasp.prod.json" list-versions
npx @google/clasp -P "$PWD/.clasp.prod.json" redeploy <ID_DE_LA_IMPLEMENTACION> -V <NUMERO_DE_VERSION>
```
O en el editor: *Implementar → Administrar implementaciones → ✏️ → Versión*.

## Seguridad
- `CLASPRC_JSON` es una **credencial de tu cuenta de Google**: solo en secretos de entorno, nunca en el código. Si sospechas que se filtró, revócala en <https://myaccount.google.com/permissions> y genera otra.
- El script `desplegar.sh` escribe las credenciales en una carpeta temporal y las borra al terminar.
- Los pull requests de **forks no reciben secretos**; el chequeo *Verificar* no los necesita.
- Con producción protegida por aprobación, ni un commit malicioso llega a producción sin que alguien lo mire.
- El repositorio es público: no subas IDs de hojas, `.clasp*.json` ni respaldos (ya están en `.gitignore`).

## Producción no lleva datos de demostración
Hay **dos candados**, para que nadie pueda crear datos de ejemplo en producción:
1. **El paquete:** `scripts/publicar.sh produccion` arma el paquete y **reemplaza `Demo.gs`** (el generador de datos de ejemplo) por un archivo vacío (`scripts/stubs/Demo.gs`) que solo falla con un mensaje claro. Si algo del generador siguiera en el paquete, el script **no lo sube**. Lo mismo hace el CI.
2. **La propiedad:** aun con el generador, `sembrarDatosDemo` exige la propiedad de script `DEMO_HABILITADO = TRUE`. **Solo ponla en el proyecto de desarrollo** (Configuración del proyecto → Propiedades de la secuencia de comandos). En producción no existe, y en la app desaparecen *Datos de demostración*, *Arranque* y el botón "Explorar con datos de ejemplo".

Las pruebas (`tests/test_produccion.js`) arman el paquete de producción y comprueban que no trae datos de ejemplo, que no se puede sembrar nada y que el arranque (que anula movimientos) tampoco corre. Para revisarlo tú:
```bash
npm run paquete:prod          # arma el paquete y escribe su carpeta
npm run vista -- --prod       # la app como en producción (sin demo ni arranque)
```
Los comandos `npm run push:dev` y `npm run push:prod` usan este mismo armado. (`npm run push`, a secas, sube todo al proyecto original, el de tu hoja personal.)

## Qué pasa con los datos al desplegar
Desplegar **solo cambia el código**. Los datos viven en las hojas:
- **Varias personas:** la hoja de cada una se actualiza sola al entrar si la versión trae tablas o columnas nuevas.
- **Una hoja:** la app pide **Instalar** una vez (crea lo que falta, sin borrar nada).
