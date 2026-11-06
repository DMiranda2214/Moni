/**
 * Pruebas del modo multiusuario: una aplicación, muchas personas, cada una con su hoja y sus datos separados.
 */
const fs = require('fs');
const path = require('path');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const archivos = fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.gs')).sort();

  /** Una app en modo multiusuario, sin ninguna hoja todavía. */
  function app(opciones) {
    const e = crearEntorno({}, opciones || {});
    e.cargar(...archivos);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.propiedades.MODO_MULTIUSUARIO = 'TRUE';
    delete e.propiedades.SPREADSHEET_ID;
    return e;
  }
  const ANA = 'ana@example.com', LUIS = 'luis@example.com', MARTA = 'marta@example.com';

  prueba('multiusuario: sin hoja propia solo se ofrece crearla; después la app funciona normal', () => {
    const e = app();
    e.como(ANA);
    const antes = e.llamar('getBootstrap');
    assert.strictEqual(antes.ok, true);
    assert.strictEqual(antes.data.instalado, false);
    assert.strictEqual(antes.data.sinHoja, true);
    assert.strictEqual(antes.data.cuenta.correo, ANA);
    assert.strictEqual(antes.data.cuenta.tieneHoja, false);
    assert.strictEqual(e.llamar('listCatalogo', 'Bancos').ok, false, 'sin hoja no se lee nada');

    const c = e.llamar('createMySheet');
    assert.strictEqual(c.ok, true, c.error && c.error.message);
    assert.strictEqual(c.data.tieneHoja, true);
    assert.ok(c.data.urlHoja.indexOf('docs.google.com') !== -1);
    const d = e.llamar('getBootstrap').data;
    assert.strictEqual(d.instalado, true);
    assert.strictEqual(Object.keys(d.catalogos).length > 5, true);
    // Una segunda llamada no crea otra hoja.
    const otra = e.llamar('createMySheet');
    assert.strictEqual(otra.data.yaExistia, true);
    assert.strictEqual(Object.keys(e.libros).filter(k => k !== 'id-falso').length, 1);
  });

  prueba('multiusuario: cada persona ve solo lo suyo (hojas, datos y propiedades separados)', () => {
    const e = app({ cache: true });
    e.como(ANA); e.llamar('createMySheet');
    e.llamar('saveCatalogo', 'Bancos', { Nombre: 'Banco de Ana' });
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data.map(b => b.Nombre), ['Banco de Ana']);

    e.como(LUIS);
    assert.strictEqual(e.llamar('getBootstrap').data.sinHoja, true, 'Luis todavía no tiene hoja: no cae en la de Ana');
    e.llamar('createMySheet');
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data, [], 'ni siquiera con la caché encendida');
    e.llamar('saveCatalogo', 'Bancos', { Nombre: 'Banco de Luis' });

    e.como(ANA);
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data.map(b => b.Nombre), ['Banco de Ana']);
    assert.notStrictEqual(e.propsUsuario[ANA].SPREADSHEET_ID, e.propsUsuario[LUIS].SPREADSHEET_ID);
    assert.strictEqual(e.propiedades.SPREADSHEET_ID, undefined, 'nada de esto vive en las propiedades del script');
  });

  prueba('multiusuario: vincular una hoja exige permiso y que sea de Moni; la pareja puede compartir una', () => {
    const e = app();
    e.como(LUIS); e.llamar('createMySheet');
    e.llamar('saveCatalogo', 'Bancos', { Nombre: 'Compartido' });
    const idLuis = e.propsUsuario[LUIS].SPREADSHEET_ID;

    e.como(MARTA);
    const sin = e.llamar('linkMySheet', 'https://docs.google.com/spreadsheets/d/' + idLuis + '/edit');
    assert.strictEqual(sin.ok, false);
    assert.ok(/permiso/.test(sin.error.message), 'sin acceso no se abre');

    e.libros[idLuis].editores.push(MARTA); // Luis le comparte la hoja
    assert.strictEqual(e.llamar('linkMySheet', 'https://docs.google.com/spreadsheets/d/' + idLuis + '/edit#gid=0').ok, true);
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data.map(b => b.Nombre), ['Compartido']);
    assert.strictEqual(e.llamar('linkMySheet', 'esto no es un enlace').ok, false);

    // Una hoja ajena con datos no se adopta: no se le crean tablas encima.
    e.como(ANA);
    const ajena = e.ctx.SpreadsheetApp.create('Mi presupuesto del 2020');
    ajena.insertSheet('Gastos').filas.push(['a', 'b'], ['1', '2']);
    ajena.insertSheet('Otra');
    const r = e.llamar('linkMySheet', ajena.getId());
    assert.strictEqual(r.ok, false);
    assert.ok(/no parece una hoja de Moni/.test(r.error.message));
    assert.strictEqual(e.libros[ajena.getId()].hojas.Movimientos, undefined);
  });

  prueba('multiusuario: una versión nueva con tablas o columnas nuevas actualiza sola la hoja de cada persona', () => {
    const e = app();
    e.como(ANA); e.llamar('createMySheet');
    e.llamar('saveCatalogo', 'Bancos', { Nombre: 'Banco' });
    // Se simula una hoja de la versión anterior: sin la pestaña de ingresos y sin una columna.
    e.ejecutar("(function () { const ss = getSpreadsheet(); ss.deleteSheet(ss.getSheetByName('Ingresos_Recurrentes')); " +
      "const h = ss.getSheetByName('Presupuesto_Mes'); h.deleteColumn(SCHEMAS.Presupuesto_Mes.headers.indexOf('ID_Tarjeta') + 1); })()");
    assert.strictEqual(e.llamar('verificarEsquema').listo, false);

    const d = e.llamar('getBootstrap');
    assert.strictEqual(d.data.instalado, true, 'se actualizó sola, sin pedirle nada a la persona');
    assert.strictEqual(e.llamar('verificarEsquema').listo, true);
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data.map(b => b.Nombre), ['Banco'], 'sin perder datos');
  });

  prueba('multiusuario: los activadores, el bloqueo y las marcas de respaldo son de cada persona', () => {
    const e = app();
    e.como(ANA); e.llamar('createMySheet');
    e.como(LUIS); e.llamar('createMySheet');

    e.como(ANA);
    assert.strictEqual(e.llamar('setRespaldoAuto', true).data.automatico, true);
    e.llamar('makeRespaldo');
    e.como(LUIS);
    assert.strictEqual(e.llamar('getRespaldos').data.automatico, false, 'el activador de Ana no es de Luis');
    assert.strictEqual(e.llamar('getRespaldos').data.ultimo, '', 'ni su última copia');
    e.como(ANA);
    assert.strictEqual(e.llamar('getRespaldos').data.automatico, true);
    assert.ok(e.llamar('getRespaldos').data.ultimo);

    e.registro.bloqueos.length = 0;
    e.llamar('saveCatalogo', 'Bancos', { Nombre: 'X' });
    assert.ok(e.registro.bloqueos.length > 0);
    assert.ok(e.registro.bloqueos.every(b => b === 'user'), 'los bloqueos son de la persona, no de todo el script');
  });

  prueba('multiusuario: desvincular suelta la hoja (no la borra) y no toca a los demás', () => {
    const e = app();
    e.como(ANA); e.llamar('createMySheet');
    e.como(LUIS); e.llamar('createMySheet');
    const idAna = e.propsUsuario[ANA].SPREADSHEET_ID;

    e.como(ANA);
    e.llamar('setRespaldoAuto', true);
    const r = e.llamar('unlinkMySheet');
    assert.strictEqual(r.data.tieneHoja, false);
    assert.ok(e.libros[idAna], 'la hoja sigue existiendo');
    assert.strictEqual(e.llamar('getBootstrap').data.sinHoja, true);
    assert.strictEqual(e.drive.disparadores.filter(t => t.dueno === ANA).length, 0, 'sus activadores se apagan');

    e.como(LUIS);
    assert.strictEqual(e.llamar('getBootstrap').data.instalado, true);
  });

  prueba('una sola hoja (modo de siempre): sigue usando la hoja del script, la caché y el bloqueo del script', () => {
    const e = crearEntorno({}, { cache: true });
    e.cargar(...archivos);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    assert.strictEqual(e.llamar('estadoMiCuenta').multiusuario, false);
    e.registro.bloqueos.length = 0;
    e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Uno' });
    assert.ok(e.registro.bloqueos.every(b => b === 'script'));
    // Dos personas con la misma hoja compartida ven lo mismo.
    e.como('otra@example.com');
    assert.deepStrictEqual(e.llamar('listCatalogo', 'Bancos').data.map(b => b.Nombre), ['Uno']);
  });

  prueba('instalación por partes: si no alcanza el tiempo avanza y se continúa sin perder lo hecho', () => {
    const e = app();
    e.como(ANA);
    const ss = e.ejecutar("SpreadsheetApp.create('x')");
    e.propiedades.__p = 1;
    e.ctx.__ss = ss;
    let r = plano(e.ejecutar('setupDatabase(__ss, { presupuestoMs: -1 })'));
    assert.strictEqual(r.parcial, true);
    assert.ok(r.hechas >= 1 && r.hechas < r.tablas, 'avanza al menos una tabla por llamada');
    let vueltas = 0;
    while (r.parcial && vueltas++ < 100) r = plano(e.ejecutar('setupDatabase(__ss, { presupuestoMs: -1 })'));
    assert.strictEqual(r.parcial, false);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(plano(e.ejecutar('verificarEsquema(__ss)')).listo, true);
  });

  prueba('rendimiento: el libro se abre una vez por petición y la segunda carga sale de la caché', () => {
    const e = crearEntorno({}, { cache: true });
    e.cargar(...archivos);
    e.propiedades.MODO_MULTIUSUARIO = 'TRUE'; delete e.propiedades.SPREADSHEET_ID;
    e.como(ANA);
    let abiertas = 0;
    const abrir = e.ctx.SpreadsheetApp.openById;
    e.ctx.SpreadsheetApp.openById = id => { abiertas++; return abrir(id); };
    e.ctx.__args = [];
    e.ejecutar('createMySheet()');
    abiertas = 0;
    const a = plano(e.ejecutar('getBootstrap()'));
    assert.strictEqual(a.ok, true);
    assert.ok(abiertas <= 2, 'abrió el libro ' + abiertas + ' veces');
    // Guardar invalida la tabla: el siguiente arranque ya trae el cambio
    e.ctx.__args = ['Personas', { Nombre: 'Ana' }];
    assert.strictEqual(plano(e.ejecutar('saveCatalogo(...__args)')).ok, true);
    const b = plano(e.ejecutar('getBootstrap()'));
    assert.ok(b.data.catalogos.Personas.some(p => p.Nombre === 'Ana'));
  });

  prueba('si la hoja guardada se borró, se ofrece crear otra y se crea desde cero', () => {
    const e = app();
    e.como(ANA);
    assert.strictEqual(e.llamar('createMySheet').ok, true);
    const vieja = e.propsUsuario[ANA].SPREADSHEET_ID;
    delete e.libros[vieja]; // la borró de su Drive
    const b = e.llamar('getBootstrap');
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.data.sinHoja, true);
    assert.strictEqual(b.data.hojaPerdida, true);
    const c = e.llamar('createMySheet');
    assert.strictEqual(c.ok, true, c.error && c.error.message);
    assert.notStrictEqual(e.propsUsuario[ANA].SPREADSHEET_ID, vieja);
    assert.strictEqual(e.llamar('getBootstrap').data.instalado, true);
  });

  prueba('refresco liviano: guardar un nombre o un catálogo devuelve solo lo que cambió', () => {
    const e = crearEntorno({}, { cache: true });
    e.cargar(...archivos);
    e.propiedades.MODO_MULTIUSUARIO = 'TRUE'; delete e.propiedades.SPREADSHEET_ID;
    e.como(ANA);
    e.ctx.__args = [];
    e.ejecutar('createMySheet()');
    const plano2 = x => JSON.parse(JSON.stringify(x));
    const ll = (fn, ...a) => { e.ctx.__args = a; return plano2(e.ejecutar(fn + '(...__args)')); };
    assert.strictEqual(ll('saveConfigParam', 'Nombre_Usuario', 'Ana').ok, true);
    const r = ll('getRefresco', { config: true });
    assert.strictEqual(r.data.config.Nombre_Usuario, 'Ana');
    assert.deepStrictEqual(Object.keys(r.data.catalogos), [], 'no trae catálogos que no cambiaron');
    assert.strictEqual(r.data.saldos, undefined);
    assert.ok(r.data.estado.pasos.length > 0);
    ll('saveCatalogo', 'Bancos', { Nombre: 'Nu', Tipo: 'Banco' });
    const b = ll('getRefresco', { tablas: ['Bancos'] }).data;
    assert.ok(b.catalogos.Bancos.some(x => x.Nombre === 'Nu'));
    assert.ok(b.catalogos.Cuentas && b.catalogos.Bolsillos && b.saldos, 'un banco puede mover cuentas, bolsillos y saldos');
    assert.strictEqual(ll('getRefresco', { tablas: ['NoExiste'] }).ok, false, 'solo catálogos');
    assert.strictEqual(ll('refreshCache').ok, true);
  });
};
