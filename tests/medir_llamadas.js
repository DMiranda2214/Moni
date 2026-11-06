/** Cuenta las llamadas a Google (hojas, apertura del libro, caché) que hace cada operación. Uso: node tests/medir_llamadas.js */
const fs = require('fs'), path = require('path');
const { crearEntorno } = require('./fake_gas');
const archivos = fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.gs')).sort();
const e = crearEntorno({}, { cache: true });
e.cargar(...archivos);
e.propiedades.MODO_MULTIUSUARIO = 'TRUE'; delete e.propiedades.SPREADSHEET_ID;
let n = { abrir: 0, hoja: 0, rango: 0, escritura: 0, estilo: 0, cache: 0 };
const reset = () => Object.keys(n).forEach(k => n[k] = 0);
const envolver = (obj, tipo) => new Proxy(obj, { get(t, p) {
  const v = t[p];
  if (typeof v !== 'function') return v;
  return (...a) => {
    if (tipo === 'ss') { if (p === 'insertSheet') n.hoja++; }
    else if (tipo === 'hoja') {
      if (/^(appendRow|deleteRow|deleteRows|insertColumnBefore|deleteColumn)$/.test(p)) n.escritura++;
      else if (/^(setFrozenRows|setColumnWidth|protect)$/.test(p)) n.estilo++;
      else n.rango++;
    }
    const r = v.apply(t, a);
    if (tipo === 'ss' && p === 'getSheetByName' && r) return envolver(r, 'hoja');
    if (tipo === 'hoja' && p === 'getRange') return envolverRango(r);
    if (tipo === 'hoja' && p === 'getDataRange') return envolverRango(r);
    return r;
  };
}});
const envolverRango = r => new Proxy(r, { get(t, p) {
  const v = t[p]; if (typeof v !== 'function') return v;
  return (...a) => { if (/^set(Values|Value)$/.test(p) || p === 'clearContent') n.escritura++; else if (p === 'getValues') n.rango++; else n.estilo++; return v.apply(t, a); };
}});
const abrir = e.ctx.SpreadsheetApp.openById, crear = e.ctx.SpreadsheetApp.create;
e.ctx.SpreadsheetApp.openById = id => { n.abrir++; return envolver(abrir(id), 'ss'); };
e.ctx.SpreadsheetApp.create = nombre => envolver(crear(nombre), 'ss');
const c = e.ctx.CacheService.getUserCache;
e.ctx.CacheService.getUserCache = () => { const k = c(); return { getAll: (...a) => { n.cache++; return k.getAll(...a); }, putAll: (...a) => { n.cache++; return k.putAll(...a); }, get: (...a) => { n.cache++; return k.get(...a); }, put: (...a) => { n.cache++; return k.put(...a); }, remove: (...a) => { n.cache++; return k.remove(...a); } }; };
const llamar = (fn, ...args) => { e.ctx.__args = args; reset(); const t = Date.now(); const r = JSON.parse(JSON.stringify(e.ejecutar(fn + '(...__args)'))); return { r, ...n, ms: Date.now() - t }; };
const fila = (t, x) => console.log(t.padEnd(34), 'abrirLibro', String(x.abrir).padStart(3), '| lecturas', String(x.rango).padStart(3), '| escrituras', String(x.escritura).padStart(3), '| estilo/hoja', String(x.estilo + x.hoja).padStart(4), '| cache', String(x.cache).padStart(3));
e.como('ana@example.com');
fila('createMySheet', llamar('createMySheet'));
fila('getBootstrap (1.ª)', llamar('getBootstrap'));
fila('getBootstrap (con caché)', llamar('getBootstrap'));
fila('saveCatalogo Personas (nombre)', llamar('saveCatalogo', 'Personas', { Nombre: 'Ana' }));
fila('getBootstrap tras guardar', llamar('getBootstrap'));
// ---- Con datos de ejemplo (un año de uso aprox.) ----
fila('seedDemo', llamar('seedDemo'));
e.ctx.__args = [];
const boot = JSON.parse(JSON.stringify(e.ejecutar('getBootstrap()'))).data;
const cuenta = boot.catalogos.Cuentas.find(c => c.Activo !== false);
const bols = boot.catalogos.Bolsillos.find(b => b.ID_Cuenta === cuenta.ID_Cuenta);
fila('getBootstrap (con datos)', llamar('getBootstrap'));
fila('getBootstrap (2.ª, caché)', llamar('getBootstrap'));
fila('addMovimiento', llamar('addMovimiento', { Tipo: 'Gasto', Fecha: boot.hoy, Monto: 1000, ID_Bolsillo_Origen: bols.ID_Bolsillo, Descripcion: 'x' }));
fila('getMovimientos', llamar('getMovimientos', {}));
fila('getPresupuesto', llamar('getPresupuesto', boot.hoy.slice(0, 7)));
fila('getGraficos', llamar('getGraficos', {}));
fila('getAnual', llamar('getAnual', Number(boot.hoy.slice(0, 4))));
fila('getSaldos', llamar('getSaldos'));
