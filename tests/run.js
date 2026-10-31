/**
 * Pruebas de la capa de datos y de las correcciones de la Fase 0.
 * Ejecutar: npm test
 */
const assert = require('assert');
const { crearEntorno } = require('./fake_gas');

const ENC_MOV = ['ID_Mov', 'Fecha', 'Concepto', 'ID_Bolsillo', 'Valor', 'Tipo_Mov', 'Subtipo', 'ID_Categoria', 'ID_Grupo', 'ID_Item_Ppto', 'Notas', 'Origen', 'Anulado', 'Creado_En', 'Actualizado_En'];

function mov(id, grupo, valor) {
  return [id, '2026-11-01', 'c-' + id, 'b1', valor, 'Transferencia', '', '', grupo, '', '', 'Demo', false, '', ''];
}

const pruebas = [];
function prueba(nombre, fn) { pruebas.push({ nombre, fn }); }

function entorno(hojas) {
  const e = crearEntorno(hojas);
  e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs');
  return e;
}

prueba('updateRow existe y modifica solo la fila indicada', () => {
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 10), mov('b', '', 20)] });
  e.ejecutar("updateRow('Movimientos', 3, { Valor: 99, Inexistente: 1 })");
  assert.strictEqual(e.hojas.Movimientos.filas[1][4], 10);
  assert.strictEqual(e.hojas.Movimientos.filas[2][4], 99);
});

prueba('updateRow rechaza filas no válidas', () => {
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 10)] });
  assert.throws(() => e.ejecutar("updateRow('Movimientos', 1, {})"), /no válido/);
  assert.throws(() => e.ejecutar("updateRow('Movimientos', 7, {})"), /no existe/);
  assert.throws(() => e.ejecutar("updateRow('Movimientos', 'x', {})"), /no válido/);
});

prueba('updateRowById actualiza la fila correcta', () => {
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 10), mov('b', '', 20)] });
  e.ejecutar("updateRowById('Movimientos', 'ID_Mov', 'b', { Concepto: 'nuevo' })");
  assert.strictEqual(e.hojas.Movimientos.filas[2][2], 'nuevo');
  assert.strictEqual(e.hojas.Movimientos.filas[1][2], 'c-a');
});

prueba('anular con una fila en blanco en medio anula la fila correcta', () => {
  // Antes de la corrección: la fila vacía desplazaba el índice y se anulaba la fila equivocada.
  const vacia = new Array(ENC_MOV.length).fill('');
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 10), vacia, mov('b', '', 20), mov('c', '', 30)] });
  e.ejecutar("anularMovimiento('c')");
  const filas = e.hojas.Movimientos.filas;
  assert.strictEqual(filas[4][12], true, 'c debe quedar anulado');
  assert.strictEqual(filas[3][12], false, 'b no debe tocarse');
  assert.strictEqual(filas[1][12], false, 'a no debe tocarse');
});

prueba('anular una transferencia anula ambas patas aunque haya filas en blanco', () => {
  const vacia = new Array(ENC_MOV.length).fill('');
  const e = entorno({ Movimientos: [ENC_MOV, mov('x1', 'g1', -50), vacia, mov('otro', '', 5), mov('x2', 'g1', 50)] });
  const res = e.ejecutar("anularMovimiento('x1')");
  const filas = e.hojas.Movimientos.filas;
  assert.strictEqual(res.grupo, true);
  assert.strictEqual(filas[1][12], true);
  assert.strictEqual(filas[4][12], true);
  assert.strictEqual(filas[3][12], false, 'el movimiento ajeno no se toca');
});

prueba('getTableData entrega _rowIndex real aunque se omitan filas vacías', () => {
  const vacia = new Array(ENC_MOV.length).fill('');
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 1), vacia, mov('b', '', 2)] });
  const filas = e.ejecutar("getTableData('Movimientos')");
  assert.strictEqual(filas.length, 2);
  assert.strictEqual(filas[0]._rowIndex, 2);
  assert.strictEqual(filas[1]._rowIndex, 4);
});

prueba('las escrituras usan el bloqueo de script, no el de usuario', () => {
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 10)] });
  e.ejecutar("insertRow('Movimientos', { Concepto: 'z', ID_Bolsillo: 'b1', Valor: 1 })");
  e.ejecutar("updateRow('Movimientos', 2, { Valor: 2 })");
  e.ejecutar("updateRowById('Movimientos', 'ID_Mov', 'a', { Valor: 3 })");
  assert.ok(e.registro.bloqueos.length >= 3);
  assert.ok(e.registro.bloqueos.every(b => b === 'script'), 'todos deben ser de script');
});

prueba('deleteRow elimina la fila indicada por su número real', () => {
  const e = entorno({ Movimientos: [ENC_MOV, mov('a', '', 1), mov('b', '', 2), mov('c', '', 3)] });
  e.ejecutar("deleteRow('Movimientos', 3)");
  const ids = e.hojas.Movimientos.filas.slice(1).map(f => f[0]);
  assert.deepStrictEqual(ids, ['a', 'c']);
});

prueba('getSpreadsheet prefiere SPREADSHEET_ID y falla con mensaje claro si falta', () => {
  const e = entorno({});
  assert.ok(e.ejecutar('getSpreadsheet()'));
  delete e.propiedades.SPREADSHEET_ID;
  assert.throws(() => e.ejecutar('getSpreadsheet()'), /vincularHojaMoni/);
});

prueba('accesoPermitido_ respeta la lista de usuarios permitidos', () => {
  const e = crearEntorno({});
  e.cargar('Code.gs');
  assert.strictEqual(e.ejecutar('accesoPermitido_()'), true, 'sin lista no se restringe');
  e.propiedades.USUARIOS_PERMITIDOS = 'otra@example.com';
  assert.strictEqual(e.ejecutar('accesoPermitido_()'), false);
  e.propiedades.USUARIOS_PERMITIDOS = 'Otra@example.com, ANA@example.com';
  assert.strictEqual(e.ejecutar('accesoPermitido_()'), true, 'sin distinguir mayúsculas');
});

prueba('todos los .gs se cargan juntos sin declaraciones repetidas (como en Apps Script)', () => {
  // En Apps Script los archivos comparten un solo espacio global: un const repetido rompe la carga.
  const fs = require('fs');
  const archivos = fs.readdirSync(require('path').join(__dirname, '..')).filter(f => f.endsWith('.gs')).sort();
  const e = crearEntorno({});
  e.cargar(...archivos);
  const nombres = {};
  archivos.forEach(f => {
    const src = fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8');
    (src.match(/^(?:const|let|var|function)\s+[A-Za-z_$][\w$]*/gm) || []).forEach(d => {
      const n = d.split(/\s+/)[1];
      (nombres[n] = nombres[n] || []).push(f);
    });
  });
  const repetidos = Object.keys(nombres).filter(n => nombres[n].length > 1);
  assert.deepStrictEqual(repetidos, [], 'nombres repetidos entre archivos: ' + repetidos.join(', '));
});

require('./test_catalogos')(prueba, assert, crearEntorno);
require('./test_movimientos')(prueba, assert, crearEntorno);
require('./test_presupuesto')(prueba, assert, crearEntorno);
require('./test_deudas')(prueba, assert, crearEntorno);
require('./test_extras')(prueba, assert, crearEntorno);
require('./test_reinicio')(prueba, assert, crearEntorno);
require('./test_logs')(prueba, assert, crearEntorno);
require('./test_divisas')(prueba, assert, crearEntorno);
require('./test_graficos')(prueba, assert, crearEntorno);

let fallos = 0;
pruebas.forEach(p => {
  try {
    p.fn();
    console.log('  ok   ' + p.nombre);
  } catch (err) {
    fallos++;
    console.log('  FALLA ' + p.nombre + '\n         ' + err.message);
  }
});
console.log(`\n${pruebas.length - fallos}/${pruebas.length} pruebas pasan`);
process.exit(fallos ? 1 : 0);
