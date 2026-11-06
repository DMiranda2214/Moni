#!/usr/bin/env bash
# Sube el código a un proyecto de Apps Script y actualiza su implementación (la URL /exec no cambia).
# Variables: CLASPRC_JSON (credenciales de clasp), SCRIPT_ID, DEPLOYMENT_ID y DESCRIPCION.
set -euo pipefail

CLASP="npx --yes @google/clasp@3.4.1"

: "${CLASPRC_JSON:?Falta el secreto CLASPRC_JSON}"
: "${SCRIPT_ID:?Falta la variable SCRIPT_ID}"
: "${DEPLOYMENT_ID:?Falta la variable DEPLOYMENT_ID}"

# Las credenciales viven solo en una carpeta temporal y se borran al terminar, pase lo que pase.
AUTH_DIR="$(mktemp -d)"
trap 'rm -rf "$AUTH_DIR"; rm -f .clasp.json' EXIT
umask 077
printf '%s' "$CLASPRC_JSON" > "$AUTH_DIR/.clasprc.json"
printf '{"scriptId":"%s","rootDir":"."}' "$SCRIPT_ID" > .clasp.json

echo "Subiendo el código…"
$CLASP --auth "$AUTH_DIR" push --force

echo "Publicando una versión nueva en la implementación…"
$CLASP --auth "$AUTH_DIR" deploy --deploymentId "$DEPLOYMENT_ID" --description "${DESCRIPCION:-automático}"

echo "Listo."
