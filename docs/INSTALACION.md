# Instalación manual (una sola hoja)

> **Lo normal es otra cosa.** Para que **varias personas** usen la app con sus datos separados, o para **desplegar sin copiar código**, usa [Varias personas](MULTIUSUARIO.md) y [Despliegue](DESPLIEGUE.md): un comando publica el código y cada persona crea su propia hoja al entrar. Esta guía es el camino manual para **una sola hoja** (la tuya).

Hay dos formas de poner el código en Apps Script. La **A** no requiere instalar nada; la **B** (con `clasp`) es la cómoda para actualizar.

## Requisitos
- Una cuenta de Google.
- Para el camino B: Node.js 18+ y este repositorio clonado.

## A. Sin instalar nada (copiar y pegar)
1. Crea un Google Sheet en blanco, por ejemplo **"Moni — mis finanzas"**.
2. En el Sheet: **Extensiones → Apps Script**.
3. Por cada archivo `.gs` del repositorio, crea un archivo del mismo nombre en el editor (`+` → Secuencia de comandos) y pega su contenido. Por cada `.html` (`index`, `app_js`, `app_css`, `tokens`), crea un archivo HTML (`+` → HTML) con el nombre **sin** la extensión.
   - **`Demo.gs`:** es el generador de datos de ejemplo y solo es para desarrollo. Para una instalación real pega en su lugar el contenido de `scripts/stubs/Demo.gs` (un archivo que solo avisa que no está disponible).
4. Abre **Configuración del proyecto**, activa *"Mostrar el archivo de manifiesto appsscript.json"* y reemplaza su contenido por el de `appsscript.json`.
5. Continúa en **Primera ejecución**.

## B. Con clasp
```bash
npm run login                       # inicia sesión en Google (una vez)
cp .clasp.json.example .clasp.json  # y escribe tu scriptId
npm run push                        # sube *.gs, *.html y appsscript.json
```
- El `scriptId` está en el editor de Apps Script → Configuración del proyecto → *ID de secuencia de comandos*.
- `.clasp.json` y `.clasprc.json` **no se suben al repositorio** (están en `.gitignore`).
- `.claspignore` hace que solo viajen los `.gs`, los `.html` y el manifiesto (no `tests/`, `docs/` ni `node_modules/`).
- Activa la API de Apps Script en <https://script.google.com/home/usersettings> si `clasp` lo pide.
- Ojo: `npm run push` sube **todo, incluido `Demo.gs`**, al proyecto original. Para un proyecto sin datos de demostración usa `npm run push:prod` (ver [Despliegue](DESPLIEGUE.md)).

## Primera ejecución
En el editor de Apps Script, elige la función en la barra superior y pulsa **Ejecutar**:

1. `vincularHojaMoni` → guarda el ID del Sheet en las propiedades del script. Acepta los permisos (Google avisará "app no verificada": es tu propio script; *Configuración avanzada → Ir a…*).
2. `setupDatabase` → crea las **29 pestañas** con sus encabezados y los valores iniciales. Es **idempotente**: no borra ni cambia nada de lo que ya exista.

> Si el proyecto no está unido al Sheet, usa `vincularHojaMoni('<ID del Sheet>')`: el ID es lo que está entre `/d/` y `/edit` en la dirección del Sheet.

## Publicar la aplicación web
1. **Implementar → Nueva implementación → Aplicación web.**
2. *Ejecutar como*: **Usuario que accede a la aplicación web**. *Quién tiene acceso*: **Cualquier persona con cuenta de Google** (es lo que trae `appsscript.json`).
   - **Con una sola hoja** (este camino), la persona que entra necesita permiso de edición sobre ella; ver [Seguridad](../SECURITY.md).
   - **Con varias personas**, ejecuta además una vez `activarModoMultiusuario` ([ver](MULTIUSUARIO.md)).
3. Copia la **URL** que termina en `/exec` y guárdala como favorito o *"Agregar a pantalla de inicio"* en el celular.
4. (Recomendado) En Configuración del proyecto → Propiedades de la secuencia de comandos, crea `USUARIOS_PERMITIDOS` con tu correo.
5. Abre la URL: la primera vez verás la bienvenida y el **asistente de primeros pasos** ([Empezar con Moni](EMPEZAR.md)).

## Permisos
`appsscript.json` pide: Hojas de cálculo, Drive (respaldos), Calendar (recordatorios), activadores y correo. El detalle de cada uno está en [Seguridad](../SECURITY.md). Si actualizas desde una versión anterior a los recordatorios, Google pedirá aceptar el permiso de **Calendar** una vez: sube `appsscript.json`, crea una **nueva versión** de la implementación y abre la app. Sin él, el resto de la app funciona igual; solo falla activar los recordatorios (con un mensaje claro).

## Actualizar una instalación existente
- **Con `clasp` y dos entornos (lo recomendado):** `npm run verificar` y luego `npm run desplegar:dev` / `npm run desplegar:prod`. Sube el código y crea una **versión nueva** en la implementación; la URL no cambia ([Despliegue](DESPLIEGUE.md)).
- **A mano:** sube o pega el código nuevo y, en **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**, publica (la URL no cambia).

Después, abre la app:
- **Varias personas:** la hoja de cada una se actualiza sola la primera vez que entra (crea las tablas y agrega las columnas nuevas, sin tocar sus datos).
- **Una sola hoja:** si el esquema cambió verás **"Falta instalar o actualizar la base de datos"**: pulsa **Instalar**. Solo crea lo que falta y agrega las columnas nuevas.
- Una pestaña con **otros** encabezados (editada a mano) no se modifica: se reporta en *Ajustes → Diagnóstico*.

## Menú del Sheet
Al abrir el Sheet aparece el menú **Moni** con: instalar o verificar la base, limpiar la caché, crear un respaldo, activar copias automáticas e instalar las hojas de consulta (`Vista_Bolsillos` y `Vista_Anual`, con fórmulas).

## Lista de comprobación
- [ ] El Sheet tiene las 29 pestañas.
- [ ] La URL `/exec` abre la app y muestra la bienvenida con el asistente de primeros pasos.
- [ ] *Ajustes → Diagnóstico* dice *"29 tablas esperadas · todas listas"*.
- [ ] *Ajustes → Respaldos → Crear un respaldo ahora* funciona.
- [ ] Probado desde el celular y desde el computador.

## Empezar con datos reales
Los saldos iniciales se escriben en el asistente de primeros pasos; no hay un paso de "arranque". Ver [Operación → Empezar con datos reales](OPERACION.md#empezar-con-datos-reales).
