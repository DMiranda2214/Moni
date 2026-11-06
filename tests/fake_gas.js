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
  deleteColumn(col) { this.filas.forEach(f => { if (f.length >= col) f.splice(col - 1, 1); }); }
  insertColumnBefore(col) { this.filas.forEach(f => { if (f.length >= col - 1) f.splice(col - 1, 0, ""); }); }
  setFrozenRows() {}
  setColumnWidth() {}
  protect() { return inerte(); }
}

function formatearFecha(d, patron, zona) {
  // Apps Script formatea en la zona pedida; Bogotá es UTC−5 todo el año (sin horario de verano).
  if (zona === 'America/Bogota') d = new Date(d.getTime() - 5 * 3600000);
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

  // Varias personas: cada una con sus propiedades, su caché y sus hojas (solo las que creó o le compartieron).
  let usuarioActual = 'ana@example.com';
  const propsUsuario = {};
  const cachesUsuario = {};
  const libros = {};
  const crearLibro = (id, nombre, hojasLibro, editores) => {
    const obj = {
      getSheetByName: (n) => hojasLibro[n] || null,
      getSheets: () => Object.values(hojasLibro),
      insertSheet: (n) => { hojasLibro[n] = new HojaFalsa(n, []); return hojasLibro[n]; },
      deleteSheet: (sh) => { delete hojasLibro[sh.getName()]; },
      getName: () => nombre,
      getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
      getId: () => id
    };
    libros[id] = { id, nombre, hojas: hojasLibro, editores, obj };
    return obj;
  };
  const hoja = crearLibro('id-falso', 'Moni (prueba)', hojas, null);
  const mapaPropiedades = obj => ({
    getProperty: (k) => (k in obj ? obj[k] : null),
    setProperty: (k, v) => { obj[k] = v; },
    deleteProperty: (k) => { delete obj[k]; }
  });

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
    getProjectTriggers: () => drive.disparadores.filter(t => t.dueno === usuarioActual),
    deleteTrigger: t => { drive.disparadores = drive.disparadores.filter(x => x !== t); },
    newTrigger: fn => { const t = { getHandlerFunction: () => fn, dueno: usuarioActual }; const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => { drive.disparadores.push(t); return t; } }; return b; }
  };

  // Google Calendar en memoria: calendarios con eventos, etiquetas y avisos
  const calendario = { calendarios: [] };
  const envolverEvento = ev => ({
    getTitle: () => ev.titulo, setTitle: t => { ev.titulo = t; },
    getDescription: () => ev.descripcion, setDescription: d => { ev.descripcion = d; },
    getStartTime: () => ev.inicio, setTime: (a, b) => { ev.inicio = a; ev.fin = b; },
    getTag: k => (k in ev.tags ? ev.tags[k] : null), setTag: (k, v) => { ev.tags[k] = v; },
    removeAllReminders: () => { ev.avisos = []; }, addPopupReminder: m => { ev.avisos.push(m); },
    deleteEvent: () => { ev.borrado = true; }
  });
  const envolverCalendario = c => ({
    getId: () => c.id, getName: () => c.nombre,
    getEvents: (a, b) => c.eventos.filter(e => !e.borrado && e.inicio < b && e.fin > a).map(envolverEvento),
    createEvent: (titulo, inicio, fin, o) => {
      const ev = { titulo, inicio, fin, descripcion: (o && o.description) || '', tags: {}, avisos: [], borrado: false };
      c.eventos.push(ev);
      return envolverEvento(ev);
    },
    deleteCalendar: () => { c.borrado = true; }
  });
  const CalendarApp = {
    createCalendar: nombre => { const c = { id: 'cal-' + (calendario.calendarios.length + 1), nombre, eventos: [], borrado: false }; calendario.calendarios.push(c); return envolverCalendario(c); },
    getCalendarById: id => { const c = calendario.calendarios.find(x => x.id === id && !x.borrado); return c ? envolverCalendario(c) : null; }
  };

  const ctx = {
    console,
    CalendarApp,
    Date,
    Math,
    Logger: { log() {} },
    Utilities: {
      getUuid: () => String(++uuid).padStart(8, '0') + '-0000-0000-0000-000000000000',
      formatDate: (d, tz, patron) => formatearFecha(d, patron, tz)
    },
    CacheService: {
      getScriptCache: () => (opc.cache ? cacheReal : { get: () => null, put() {}, remove() {} }),
      getUserCache: () => {
        if (!opc.cache) return { get: () => null, put() {}, remove() {} };
        const m = cachesUsuario[usuarioActual] || (cachesUsuario[usuarioActual] = {});
        return { get: k => (k in m ? m[k] : null), put: (k, v) => { m[k] = v; }, remove: k => { delete m[k]; } };
      }
    },
    PropertiesService: {
      getScriptProperties: () => mapaPropiedades(propiedades),
      getUserProperties: () => mapaPropiedades(propsUsuario[usuarioActual] || (propsUsuario[usuarioActual] = {}))
    },
    LockService: {
      getScriptLock: () => { registro.bloqueos.push('script'); return { waitLock() {}, releaseLock() {} }; },
      getUserLock: () => { registro.bloqueos.push('user'); return { waitLock() {}, releaseLock() {} }; }
    },
    SpreadsheetApp: {
      openById: (id) => {
        const l = libros[id];
        if (!l || (l.editores && l.editores.indexOf(usuarioActual) === -1)) throw new Error('Exception: No se pudo abrir la hoja ' + id);
        return l.obj;
      },
      create: (nombre) => crearLibro('libro-' + String(Object.keys(libros).length).padStart(30, '0'), nombre, {}, [usuarioActual]),
      getActiveSpreadsheet: () => null,
      newDataValidation: () => inerte(),
      flush() {}
    },
    Session: { getActiveUser: () => ({ getEmail: () => usuarioActual }) },
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

  // como(correo): quién está usando la app a partir de ahora (otra persona = otras propiedades, caché y activadores).
  const como = correo => { usuarioActual = correo; return correo; };
  return { ctx, hojas, registro, propiedades, propsUsuario, libros, como, cargar, ejecutar, drive, calendario };
}

module.exports = { crearEntorno };
