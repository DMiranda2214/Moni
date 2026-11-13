#!/usr/bin/env bash
# Arma el paquete de un entorno y lo sube a su proyecto de Apps Script con clasp.
#
#   scripts/publicar.sh desarrollo           sube todo, con el generador de datos de demostración
#   scripts/publicar.sh produccion           sube todo MENOS el generador de demostración (se reemplaza por un archivo vacío)
#   scripts/publicar.sh produccion --armar   solo arma el paquete y escribe su carpeta (para revisarlo o probarlo)
#   scripts/publicar.sh produccion --desplegar   sube y además publica una versión nueva en la implementación (la URL /exec no cambia)
#
# El ID del proyecto sale de .clasp.dev.json / .clasp.prod.json (o de la variable SCRIPT_ID).
# La implementación a actualizar sale de DEPLOYMENT_ID o, si no se indica, de la única implementación con versión del proyecto.
set -euo pipefail

ENTORNO="${1:-}"
MODO="${2:-}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CLASP="npx --yes @google/clasp@3.4.1"

case "$ENTORNO" in
  desarrollo) ARCHIVO=".clasp.dev.json" ;;
  produccion) ARCHIVO=".clasp.prod.json" ;;
  *) echo "Uso: $0 <desarrollo|produccion> [--armar]" >&2; exit 2 ;;
esac

PAQUETE="$(mktemp -d)"
if [ "$MODO" != "--armar" ]; then trap 'rm -rf "$PAQUETE"' EXIT; fi

# Solo lo que Apps Script necesita: los .gs, los .html y el manifiesto.
cp "$RAIZ"/*.gs "$RAIZ"/*.html "$RAIZ"/appsscript.json "$PAQUETE"/

if [ "$ENTORNO" = "produccion" ]; then
  cp "$RAIZ/scripts/stubs/Demo.gs" "$PAQUETE/Demo.gs"
  # Candado: si algo del generador de demostración siguiera en el paquete, no se sube.
  if grep -rlE "demo-(ban|cta|bol|tar|cre|mov|reg|sus|ing)" "$PAQUETE"/*.gs "$PAQUETE"/*.html >/dev/null 2>&1; then
    echo "ERROR: el paquete de producción todavía contiene datos de demostración." >&2; exit 1
  fi
fi

if [ "$MODO" = "--armar" ]; then
  # En Windows (Git Bash) la ruta de mktemp es /tmp/...; Node necesita la de Windows (C:/Users/...)
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$PAQUETE"; else echo "$PAQUETE"; fi
  exit 0
fi

if [ -n "${SCRIPT_ID:-}" ]; then ID="$SCRIPT_ID"
elif [ -f "$RAIZ/$ARCHIVO" ]; then ID="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['scriptId'])" "$RAIZ/$ARCHIVO")"
else echo "Falta SCRIPT_ID o el archivo $ARCHIVO" >&2; exit 1; fi

printf '{"scriptId":"%s","rootDir":"."}' "$ID" > "$PAQUETE/.clasp.json"
cd "$PAQUETE"
if [ -n "${CLASP_AUTH:-}" ]; then CLASP="$CLASP --auth $CLASP_AUTH"; fi

echo "Subiendo el paquete de $ENTORNO…"
$CLASP push --force

if [ "$MODO" = "--desplegar" ]; then
  DESPLIEGUE="${DEPLOYMENT_ID:-}"
  if [ -z "$DESPLIEGUE" ]; then
    # Las implementaciones con versión aparecen como "- <ID> @<versión> - <descripción>"; la automática es "@HEAD".
    LISTA="$($CLASP list-deployments | grep -E '^- [A-Za-z0-9_-]+ @[0-9]+' | awk '{print $2}')"
    CUANTAS="$(printf '%s\n' "$LISTA" | grep -c . || true)"
    if [ "$CUANTAS" -ne 1 ]; then
      echo "ERROR: hay $CUANTAS implementaciones con versión; indica cuál con DEPLOYMENT_ID=<id> (ver: npm run deployments:${ENTORNO:0:4})." >&2; exit 1
    fi
    DESPLIEGUE="$LISTA"
  fi
  echo "Publicando una versión nueva en la implementación…"
  $CLASP deploy --deploymentId "$DESPLIEGUE" --description "$(date -u +%Y-%m-%dT%H:%MZ) ${DESCRIPCION:-manual}"
fi
echo "Listo."
