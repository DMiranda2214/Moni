/**
 * Entorno simulado de Apps Script para probar los .gs en Node sin desplegar.
 * Implementa lo que usan la capa de datos y los servicios: hojas en memoria,
 * caché, bloqueo, propiedades, utilidades y las llamadas de estilo (que no hacen nada).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** Objeto que acepta cualquier llamada encadenada sin hacer nada (estilos, validaciones, protección). */
function inerte() {
  const p = new Proxy(function () {}, {
    get: (_, prop) => (prop === 'then' ? undefined : p),
    apply: () => p
  });
  return p;
}

class HojaFalsa {
  constructor(nombre, filas) {
    this.nombre = nombre;
    this.filas = filas; // arreglo de arreglos; la fila 1 son los encabezados
    this.formatos = {};
  }
  getName() { return this.nombre; }
  getLastRow() {
    let ultima = 0;
    this.filas.forEach((f, i) => { if (f.some(c => c !== '' && c !== null && c !== undefined)) ultima = i + 1; });
    return ultima;
  }
  getLastColumn() { return this.filas.reduce((m, f) => Math.max(m, f.length), 0); }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(fila, col, nFilas, nCols) {
    const hoja = this;
    nFilas = nFilas || 1;
    nCols = nCols || 1;
    const real = {
      getValues() {
        const out = [];
        for (let r = 0; r < nFilas; r++) {
          const origen = hoja.filas[fila - 1 + r] || [];
          const fila0 = [];
          for (let c = 0; c < nCols; c++) {
            const v = origen[col - 1 + c];
            fila0.push(v === undefined ? '' : v);
          }
          out.push(fila0);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((v, r) => {
          while (hoja.filas.length < fila + r) hoja.filas.push([]);
          const destino = hoja.filas[fila - 1 + r];
          v.forEach((x, c) => { destino[col - 1 + c] = x; });
        });
      },
      setValue(v) { this.setValues([[v]]); },
      clearContent() {
        for (let r = 0; r < nFilas; r++) {
          const f = hoja.filas[fila - 1 + r];
          if (f) for (let c = 0; c < nCols; c++) if (col - 1 + c < f.length) f[col - 1 + c] = '';
        }
      },
      setNumberFormat(f) { hoja.formatos[col] = f; }
    };
    // Cualquier otro método (estilos, validación) no hace nada.
    return new Proxy(real, { get: (t, p) => (p in t ? t[p] : inerte()) });
  }
  appendRow(valores) { this.filas.splice(this.getLastRow(), 0, valores.slice()); }
  deleteRow(n) { this.filas.splice(n - 1, 1); }
  deleteRows(desde, cuantas) { this.filas.splice(desde - 1, cuantas); }
  insertColumnBefore(col) { this.filas.forEach(f => { if (f.length >= col - 1) f.splice(col - 1, 0, ""); }); }
  setFrozenRows() {}
  setColumnWidth() {}
  protect() { return inerte(); }
}

function formatearFecha(d, patron) {
  const p2 = n => String(n).padStart(2, '0');
  const partes = {
    yyyy: d.getUTCFullYear(), MM: p2(d.getUTCMonth() + 1), dd: p2(d.getUTCDate()),
    HH: p2(d.getUTCHours()), mm: p2(d.getUTCMinutes()), ss: p2(d.getUTCSeconds())
  };
  return String(patron).replace(/yyyy|MM|dd|HH|mm|ss|'([^']*)'/g, (m, literal) => (literal !== undefined ? literal : partes[m]));
}

function crearEntorno(hojasIniciales, opciones) {
  const opc = opciones || {};
  const memoria = {};
  const cacheReal = { get: k => (k in memoria ? memoria[k] : null), put: (k, v) => { memoria[k] = v; }, remove: k => { delete memoria[k]; } };
  const hojas = {};
  Object.keys(hojasIniciales || {}).forEach(n => {
    hojas[n] = new HojaFalsa(n, hojasIniciales[n].map(f => f.slice()));
  });

  const registro = { bloqueos: [], escrituras: 0 };
  const propiedades = { SPREADSHEET_ID: 'id-falso' };
  let uuid = 0;

  const hoja = {
    getSheetByName: (n) => hojas[n] || null,
    getSheets: () => Object.values(hojas),
    insertSheet: (n) => { hojas[n] = new HojaFalsa(n, []); return hojas[n]; },
    deleteSheet: (s) => { delete hojas[s.getName()]; },
    getName: () => 'Moni (prueba)',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/falso',
    getId: () => 'id-falso'
  };

  // Drive y disparadores en memoria (lo justo para probar los respaldos)
  const drive = { carpetas: {}, archivos: [], disparadores: [], reloj: 0 };
  const crearArchivo = (nombre, carpeta) => {
    const f = { nombre, carpeta, papelera: false, id: 'file-' + (drive.archivos.length + 1) };
    drive.archivos.push(f);
    return { getName: () => f.nombre, getUrl: () => 'https://drive.example/' + f.id, setTrashed: v => { f.papelera = !!v; }, _f: f };
  };
  drive.api = {
    getFoldersByName: n => { const c = drive.carpetas[n]; let usado = false; return { hasNext: () => !usado && !!c, next: () => { usado = true; return c; } }; },
    createFolder: n => { drive.carpetas[n] = { nombre: n, getFiles: () => { const l = drive.archivos.filter(a => a.carpeta === n && !a.papelera).map(a => ({ getName: () => a.nombre, setTrashed: v => { a.papelera = !!v; } })); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; } }; return drive.carpetas[n]; },
    getFileById: () => ({ makeCopy: (nombre, carpeta) => crearArchivo(nombre, carpeta.nombre) })
  };
  drive.script = {
    getProjectTriggers: () => drive.disparadores.slice(),
    deleteTrigger: t => { drive.disparadores = drive.disparadores.filter(x => x !== t); },
    newTrigger: fn => { const t = { getHandlerFunction: () => fn }; const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => { drive.disparadores.push(t); return t; } }; return b; }
  };

  const ctx = {
    console,
    Date,
    Math,
    Logger: { log() {} },
    Utilities: {
      getUuid: () => String(++uuid).padStart(8, '0') + '-0000-0000-0000-000000000000',
      formatDate: (d, tz, patron) => formatearFecha(d, patron)
    },
    CacheService: { getScriptCache: () => (opc.cache ? cacheReal : { get: () => null, put() {}, remove() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in propiedades ? propiedades[k] : null),
        setProperty: (k, v) => { propiedades[k] = v; },
        deleteProperty: (k) => { delete propiedades[k]; }
      })
    },
    LockService: {
      getScriptLock: () => { registro.bloqueos.push('script'); return { waitLock() {}, releaseLock() {} }; },
      getUserLock: () => { registro.bloqueos.push('user'); return { waitLock() {}, releaseLock() {} }; }
    },
    SpreadsheetApp: {
      openById: () => hoja,
      getActiveSpreadsheet: () => null,
      newDataValidation: () => inerte()
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'ana@example.com' }) },
    DriveApp: drive.api,
    ScriptApp: drive.script
  };
  vm.createContext(ctx);

  function cargar(...archivos) {
    archivos.forEach(a => {
      const codigo = fs.readFileSync(path.join(__dirname, '..', a), 'utf8');
      vm.runInContext(codigo, ctx, { filename: a });
    });
  }

  // Cada ejecutar() equivale a una petición de Apps Script: empieza sin nada memorizado.
  const ejecutar = (js) => {
    vm.runInContext("typeof reiniciarMemoria_ === 'function' && reiniciarMemoria_()", ctx);
    return vm.runInContext(js, ctx);
  };

  return { ctx, hojas, registro, propiedades, cargar, ejecutar, drive };
}

module.exports = { crearEntorno };
