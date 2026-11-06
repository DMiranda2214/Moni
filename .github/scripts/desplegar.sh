#!/usr/bin/env bash
# Sube el código a un proyecto de Apps Script y actualiza su implementación (la URL /exec no cambia).
# Variables: CLASPRC_JSON (credenciales de clasp), SCRIPT_ID, DEPLOYMENT_ID y DESCRIPCION.
set -euo pipefail

CLASP="npx --yes @google/clasp@3.4.1"

: "${CLASPRC_JSON:?Falta el secreto CLASPRC_JSON}"
: "${SCRIPT_ID:?Falta la variable SCRIPT_ID}"
: "${DEPLOYMENT_ID:?Falta la variable DEPLOYMENT_ID}"

: "${ENTORNO:?Falta la variable ENTORNO (desarrollo o produccion)}"

# Las credenciales viven solo en una carpeta temporal y se borran al terminar, pase lo que pase.
AUTH_DIR="$(mktemp -d)"
trap 'rm -rf "$AUTH_DIR"' EXIT
umask 077
printf '%s' "$CLASPRC_JSON" > "$AUTH_DIR/.clasprc.json"

# El paquete se arma según el entorno: producción NO lleva el generador de datos de demostración.
echo "Armando y subiendo el paquete de $ENTORNO…"
CLASP_AUTH="$AUTH_DIR" bash scripts/publicar.sh "$ENTORNO"

echo "Publicando una versión nueva en la implementación…"
printf '{"scriptId":"%s","rootDir":"."}' "$SCRIPT_ID" > "$AUTH_DIR/.clasp.json"
( cd "$AUTH_DIR" && $CLASP --auth "$AUTH_DIR" deploy --deploymentId "$DEPLOYMENT_ID" --description "${DESCRIPCION:-automático}" )

echo "Listo."
