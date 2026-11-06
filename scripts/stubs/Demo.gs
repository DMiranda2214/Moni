/**
 * Demo.gs — versión de PRODUCCIÓN.
 * En producción no existen datos de demostración: scripts/publicar.sh reemplaza el Demo.gs de desarrollo por este
 * archivo, que no contiene ningún dato de ejemplo ni código para generarlos. Solo deja las dos funciones que
 * Api.gs invoca, para que un intento de usarlas falle con un mensaje claro.
 */

function sembrarDatosDemo() {
  throw new Error('Los datos de demostración no están disponibles en esta versión de Moni.');
}

function limpiarDatosDemo() {
  throw new Error('Los datos de demostración no están disponibles en esta versión de Moni.');
}
