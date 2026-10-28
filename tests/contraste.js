/**
 * Verifica el contraste (WCAG AA) de los tokens de tokens.html en claro y oscuro.
 * Ejecutar: npm run contraste
 */
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'tokens.html'), 'utf8');

function leerBloque(patron) {
  const m = css.match(patron);
  if (!m) throw new Error('No se encontró el bloque ' + patron);
  const vars = {};
  m[1].replace(/--m-([a-z0-9-]+):\s*([^;]+);/g, (_, k, v) => { vars[k] = v.trim(); return ''; });
  return vars;
}

const claro = leerBloque(/:root\s*\{([\s\S]*?)\n\}/);
const oscuro = Object.assign({}, claro, leerBloque(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/));

function hex(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) throw new Error('Color no hexadecimal: ' + c);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a, b) {
  const la = lum(hex(a)), lb = lum(hex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// [texto, fondo, mínimo, descripción]
const pares = [
  ['label', 'bg', 4.5, 'texto principal sobre fondo'],
  ['label', 'bg-grouped', 4.5, 'texto principal sobre tarjeta'],
  ['label-2', 'bg', 4.5, 'texto secundario sobre fondo'],
  ['label-2', 'bg-grouped', 4.5, 'texto secundario sobre tarjeta'],
  ['on-tint', 'tint', 4.5, 'texto sobre botón de acento'],
  ['tint', 'bg', 4.5, 'acento como texto sobre fondo'],
  ['tint', 'bg-grouped', 4.5, 'acento como texto sobre tarjeta'],
  ['success', 'bg-grouped', 4.5, 'verde sobre tarjeta'],
  ['danger', 'bg-grouped', 4.5, 'rojo sobre tarjeta'],
  ['warning', 'bg-grouped', 4.5, 'ámbar sobre tarjeta'],
  ['label', 'bg-elevated', 4.5, 'texto sobre hoja modal']
];

// Colores de acento que la persona puede elegir (definidos en app_js.html)
const js = fs.readFileSync(path.join(__dirname, '..', 'app_js.html'), 'utf8');
const bloque = js.match(/\/\/ <ACENTOS>([\s\S]*?)\/\/ <\/ACENTOS>/);
if (!bloque) throw new Error('No se encontró el bloque ACENTOS en app_js.html');
const ACENTOS = new Function(bloque[1] + '; return ACENTOS;')();

let fallos = 0;
Object.keys(ACENTOS).forEach(id => {
  [['claro', claro, '#FFFFFF'], ['oscuro', oscuro, '#1C1C1E']].forEach(([tema, t, sobre]) => {
    const tint = ACENTOS[id][tema];
    [['bg', 'acento como texto sobre fondo'], ['bg-grouped', 'acento como texto sobre tarjeta']].forEach(([fondo, desc]) => {
      const r = contraste(tint, t[fondo]);
      if (r < 4.5) { fallos++; console.log(`  FALLA ${r.toFixed(2)}:1 acento ${id} (${tema}) ${desc}`); }
    });
    const r2 = contraste(sobre, tint);
    if (r2 < 4.5) { fallos++; console.log(`  FALLA ${r2.toFixed(2)}:1 acento ${id} (${tema}) texto sobre botón`); }
  });
});
console.log('Acentos revisados: ' + Object.keys(ACENTOS).join(', '));

[['claro', claro], ['oscuro', oscuro]].forEach(([nombre, t]) => {
  console.log('Tema ' + nombre);
  pares.forEach(([fg, bg, min, desc]) => {
    const r = contraste(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) fallos++;
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${r.toFixed(2)}:1 (mín ${min})  ${desc}`);
  });
});
process.exit(fallos ? 1 : 0);
