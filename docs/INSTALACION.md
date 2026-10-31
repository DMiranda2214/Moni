# Instalación y despliegue

Hay dos caminos. El **A** es el más corto y no requiere instalar nada; el **B** (con `clasp`) es el cómodo para actualizar.

## Requisitos
- Una cuenta de Google.
- Para el camino B: Node.js 18+ y este repositorio clonado.

## A. Sin instalar nada (copiar y pegar)
1. Crea un Google Sheet en blanco, por ejemplo **"Moni 2027 - Base de datos"**.
2. En el Sheet: **Extensiones → Apps Script**.
3. Por cada archivo `.gs` del repositorio, crea un archivo del mismo nombre en el editor (`+` → Secuencia de comandos) y pega su contenido. Por cada `.html` (`index`, `app_js`, `app_css`, `tokens`), crea un archivo HTML (`+` → HTML) con el nombre **sin** la extensión.
4. Abre **Configuración del proyecto**, activa *"Mostrar el archivo de manifiesto appsscript.json"* y reemplaza su contenido por el de `appsscript.json`.
5. Continúa en el paso **Primera ejecución**.

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

## Primera ejecución
En el editor de Apps Script, elige la función en la barra superior y pulsa **Ejecutar**:

1. `vincularHojaMoni` → guarda el ID del Sheet en las propiedades del script. Acepta los permisos (Google avisará "app no verificada": es tu propio script; *Configuración avanzada → Ir a…*).
2. `setupDatabase` → crea las 27 pestañas con sus encabezados y los valores iniciales. Es **idempotente**: no borra ni cambia nada de lo que ya exista.

> Si el proyecto no está unido al Sheet, usa `vincularHojaMoni('<ID del Sheet>')`: el ID es lo que está entre `/d/` y `/edit` en la dirección del Sheet.

## Publicar la aplicación web
1. **Implementar → Nueva implementación → Aplicación web.**
2. *Ejecutar como*: **Usuario que accede a la aplicación web**. *Quién tiene acceso*: **Cualquier persona** (cada quien necesita permiso de edición sobre el Sheet; ver [Seguridad](../SECURITY.md)).
3. Copia la **URL** que termina en `/exec` y guárdala como favorito o *"Agregar a pantalla de inicio"* en el celular.
4. (Recomendado) En Configuración del proyecto → Propiedades de la secuencia de comandos, crea `USUARIOS_PERMITIDOS` con tu correo.

## Permisos nuevos (Calendar)
Las versiones con **recordatorios** agregan el permiso `https://www.googleapis.com/auth/calendar` al manifiesto. Al actualizar: sube `appsscript.json`, crea una **nueva versión** de la implementación y abre la app; Google pedirá aceptar el permiso una vez. Sin él, el resto de la app funciona igual; solo falla activar los recordatorios (con un mensaje claro).

## Actualizar una instalación existente
1. Sube el código nuevo (`npm run push` o pegando los archivos).
2. **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar.** (La URL no cambia.)
3. Abre la app. Si el esquema cambió (por ejemplo, la pestaña `Suscripciones` o la columna `Divisa` de `Bancos`), verás **"Falta instalar o actualizar la base de datos"**: pulsa **Instalar**. Solo crea lo que falta y agrega las columnas nuevas (sin tocar tus datos).
4. Si alguna pestaña tiene encabezados distintos a los esperados, la app **no la modifica**: la reporta en Ajustes → Diagnóstico.

## Menú del Sheet
Al abrir el Sheet aparece el menú **Moni** con: instalar o verificar la base, limpiar la caché, crear un respaldo, activar copias automáticas e instalar las hojas de consulta (`Vista_Bolsillos` y `Vista_Anual`, con fórmulas).

## Lista de comprobación
- [ ] El Sheet tiene las 27 pestañas.
- [ ] La URL `/exec` abre la app y muestra la bienvenida con el asistente de primeros pasos.
- [ ] Ajustes → Diagnóstico dice *"27 tablas esperadas · todas listas"*.
- [ ] Ajustes → Respaldos → *Crear un respaldo ahora* funciona.
- [ ] Probado desde el celular y desde el computador.

## Puesta en marcha real (22 – 31 de diciembre)
Ver [Operación → Arranque](OPERACION.md#arranque-del-1-de-enero).
