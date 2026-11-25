/**
 * Revisa la sintaxis de todos los .gs y del JavaScript embebido en js.html.
 * Ejecutar: npm run sintaxis
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
let fallos = 0;

function revisar(nombre, codigo) {
  try {
    new vm.Script(codigo, { filename: nombre });
    console.log('  ok   ' + nombre);
  } catch (e) {
    fallos++;
    console.log('  FALLA ' + nombre + ': ' + e.message);
  }
}

fs.readdirSync(raiz).filter(f => f.endsWith('.gs')).sort().forEach(f => {
  revisar(f, fs.readFileSync(path.join(raiz, f), 'utf8'));
});

// JavaScript embebido en los parciales HTML (<script>…</script>)
fs.readdirSync(raiz).filter(f => f.endsWith('.html')).sort().forEach(f => {
  const html = fs.readFileSync(path.join(raiz, f), 'utf8');
  const m = html.match(/<script[^>]*>([\s\S]*)<\/script>/);
  if (m) revisar(f + ' (script)', m[1]);
});

// La app: sus partes (PARTES_JS de Code.gs) forman un solo <script>
const partes = JSON.parse(fs.readFileSync(path.join(raiz, 'Code.gs'), 'utf8').match(/const PARTES_JS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const faltan = fs.readdirSync(raiz).filter(f => /^js_.*\.html$/.test(f) && partes.indexOf(f.replace('.html', '')) === -1);
if (faltan.length) { fallos++; console.log('  FALLA partes sin incluir en PARTES_JS: ' + faltan.join(', ')); }
revisar('app (' + partes.length + ' partes)', partes.map(p => fs.readFileSync(path.join(raiz, p + '.html'), 'utf8')).join('\n'));

JSON.parse(fs.readFileSync(path.join(raiz, 'appsscript.json'), 'utf8'));
console.log('  ok   appsscript.json');

process.exit(fallos ? 1 : 0);
