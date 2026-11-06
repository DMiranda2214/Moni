/**
 * Avisos de Inicio (Avisos.gs): lo que falta configurar o está desactualizado, calculado desde el estado de la hoja.
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }
  const ids = e => e.llamar('obtenerAvisos_').map(a => a.id);

  prueba('avisos: una persona recién llegada ve sugerencias y novedades, y cada una desaparece al configurarla', () => {
    const e = E();
    const a = e.llamar('obtenerAvisos_');
    ['nomina', 'suscripciones', 'recordatorios', 'novedad_cdt'].forEach(id => assert.ok(a.some(x => x.id === id), id));
    assert.ok(a.every(x => x.pantalla && x.titulo && x.detalle), 'todos dicen a dónde ir');
    // Orden: importantes, sugerencias, novedades
    const orden = { importante: 0, sugerencia: 1, novedad: 2 };
    for (let i = 1; i < a.length; i++) assert.ok(orden[a[i - 1].nivel] <= orden[a[i].nivel]);

    e.llamar('guardarMiNomina', 3000000);
    assert.ok(ids(e).indexOf('nomina') === -1, 'con sueldo ya no pide la nómina');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    e.llamar('guardarCatalogo', 'CDTs', { Nombre: 'CDT', ID_Banco: banco.ID_Banco, Capital: 1000000, Tasa_EA: 0.1, Fecha_Inicio: hoy(), Plazo_Dias: 90 });
    assert.ok(ids(e).indexOf('novedad_cdt') === -1, 'con un CDT ya no es novedad');
  });

  prueba('avisos: ocultar una sugerencia la quita y se puede volver a mostrar; un importante no se oculta', () => {
    const e = E();
    assert.ok(ids(e).indexOf('recordatorios') !== -1);
    const r = e.llamar('dismissAviso', 'recordatorios');
    assert.strictEqual(r.ok, true);
    assert.ok(r.data.every(a => a.id !== 'recordatorios'));
    assert.ok(ids(e).indexOf('recordatorios') === -1, 'queda guardado');
    assert.strictEqual(e.llamar('restoreAvisos').data.some(a => a.id === 'recordatorios'), true);

    // Importante: el salario mínimo de un año anterior con nómina configurada
    e.llamar('guardarMiNomina', 3000000);
    e.ejecutar("guardarConfig_('SMMLV_Anio', String(Number(hoyIso_().slice(0, 4)) - 1))");
    assert.ok(ids(e).indexOf('smmlv') !== -1);
    assert.strictEqual(e.llamar('dismissAviso', 'smmlv').ok, false, 'no se puede ocultar');
    assert.strictEqual(e.llamar('saveConfigParam', 'Avisos_Ocultos', 'x').ok, false, 'lo gestiona la app');
  });

  prueba('avisos: moneda extranjera sin tasa, ahorro sin rendimiento, CDT vencido y renglones que faltan en el presupuesto', () => {
    const e = E();
    const usd = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Dólares', Divisa: 'USD' });
    assert.ok(ids(e).indexOf('tasa') !== -1);
    e.llamar('saveTasaDivisa', 'USD', 4000);
    assert.ok(ids(e).indexOf('tasa') === -1, 'con la tasa anotada ya no');

    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false });
    assert.ok(ids(e).indexOf('rendimiento') !== -1);
    e.llamar('guardarCatalogo', 'Bancos', { ID_Banco: banco.ID_Banco, Rendimiento_EA: 0.09 });
    assert.ok(ids(e).indexOf('rendimiento') === -1);

    e.llamar('guardarCatalogo', 'CDTs', { Nombre: 'Vencido', ID_Banco: banco.ID_Banco, Capital: 1000000, Tasa_EA: 0.1, Fecha_Inicio: bogota(-120 * 86400000), Plazo_Dias: 90 });
    const v = e.llamar('obtenerAvisos_').find(a => a.id === 'cdt_vencidos');
    assert.ok(v && v.nivel === 'importante' && v.pantalla === 'cdt');
    assert.ok(usd);
  });

  prueba('avisos: viajan en el arranque y en el refresco liviano', () => {
    const e = E();
    const b = e.llamar('getBootstrap').data;
    assert.ok(Array.isArray(b.avisos) && b.avisos.length > 0);
    assert.ok(e.llamar('getRefresco', { config: true }).data.avisos.length > 0);
  });

  prueba('migración: una hoja de la versión 1.0 recibe la tabla CDTs y la columna de hogar en suscripciones sin perder datos', () => {
    const tmp = E();
    const nuevos = plano(tmp.ejecutar('SCHEMAS.Suscripciones.headers'));
    const viejos = nuevos.filter(h => h !== 'ID_Inmueble');
    const fila = viejos.map(h => ({ ID_Suscripcion: 'sus-1', Nombre: 'Netflix', Tipo: 'Suscripcion', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: '2026-12-01', Dia_Cobro: 1, Activo: true }[h] === undefined ? '' : { ID_Suscripcion: 'sus-1', Nombre: 'Netflix', Tipo: 'Suscripcion', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: '2026-12-01', Dia_Cobro: 1, Activo: true }[h]));
    const e = crearEntorno({ Suscripciones: [viejos, fila] });
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.ejecutar('setupDatabase()');
    const hoja = e.hojas.Suscripciones.filas;
    assert.deepStrictEqual(plano(hoja[0]).slice(0, nuevos.length), nuevos, 'la columna nueva quedó en su lugar del esquema');
    const col = nuevos.indexOf('ID_Inmueble');
    assert.strictEqual(hoja[1][nuevos.indexOf('Nombre')], 'Netflix');
    assert.strictEqual(hoja[1][col], '');
    assert.ok(e.hojas.CDTs && e.hojas.CDTs.filas[0][0] === 'ID_CDT', 'la tabla CDTs se crea');
    assert.strictEqual(plano(e.ejecutar('verificarEsquema()')).listo, true);
  });

  prueba('suscripciones: el mismo nombre se puede repetir en hogares distintos y el presupuesto los distingue', () => {
    const e = E();
    const a = e.llamar('guardarCatalogo', 'Inmuebles', { Nombre: 'Mi casa' });
    const b = e.llamar('guardarCatalogo', 'Inmuebles', { Nombre: 'Casa de mamá' });
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'C', Tipo: 'Billetera' });
    const bol = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 500000 });
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Mercado', Monto_Plan: 100000, Tipo: 'Gasto', ID_Bolsillo_Destino: bol.ID_Bolsillo });
    e.llamar('generarPresupuestoMes', hoy().slice(0, 7), esc.ID_Escenario);
    const base = { Nombre: 'Netflix', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: hoy(), ID_Bolsillo: bol.ID_Bolsillo };
    e.llamar('guardarCatalogo', 'Suscripciones', Object.assign({ ID_Inmueble: a.ID_Inmueble }, base));
    e.llamar('guardarCatalogo', 'Suscripciones', Object.assign({ ID_Inmueble: b.ID_Inmueble }, base));
    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', Object.assign({ ID_Inmueble: b.ID_Inmueble }, base)), /ya existe|ya hay/i, 'repetido en el mismo hogar no');
    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', Object.assign({}, base, { ID_Inmueble: 'no-existe' })), /hogar/i);
    const conceptos = e.llamar('obtenerPresupuestoMes', hoy().slice(0, 7)).items.map(i => i.Concepto);
    assert.ok(conceptos.indexOf('Netflix · Mi casa') !== -1 && conceptos.indexOf('Netflix · Casa de mamá') !== -1, conceptos.join(' | '));
    const lista = e.llamar('obtenerSuscripciones').items;
    assert.deepStrictEqual(lista.map(x => x.Hogar).sort(), ['Casa de mamá', 'Mi casa']);
  });

  prueba('actualización: una hoja sin una tabla nueva que la caché daba por buena se arregla sola (varias personas) o ofrece Instalar (una hoja)', () => {
    const cargar = e => e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    const llamar = (e, fn, ...a) => { e.ctx.__args = a; return plano(e.ejecutar(fn + '(...__args)')); };

    // Varias personas
    const m = crearEntorno({}, { cache: true });
    cargar(m);
    m.propiedades.MODO_MULTIUSUARIO = 'TRUE'; delete m.propiedades.SPREADSHEET_ID;
    m.como('ana@example.com');
    llamar(m, 'createMySheet');
    assert.strictEqual(llamar(m, 'getBootstrap').data.instalado, true);
    const id = m.propsUsuario['ana@example.com'].SPREADSHEET_ID;
    delete m.libros[id].hojas.CDTs;          // como una hoja de la versión anterior
    m.ejecutar('invalidateCache()');         // (y sin datos de esa tabla en la caché)
    m.ctx.__x = 1; m.ejecutar("CacheService.getUserCache().put('ESQUEMA_OK', firmaEsquema_(), 21600)"); // y la caché diciendo que está bien
    const r = llamar(m, 'getBootstrap');
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(r.data.instalado, true);
    assert.ok(m.libros[id].hojas.CDTs, 'la tabla nueva se creó sola');

    // Una sola hoja: se ofrece Instalar en vez de un error
    const u = crearEntorno({}, { cache: true });
    cargar(u);
    llamar(u, 'setupDatabase');
    assert.strictEqual(llamar(u, 'getBootstrap').data.instalado, true);
    delete u.hojas.CDTs;
    u.ejecutar('invalidateCache()');
    u.ejecutar("CacheService.getScriptCache().put('ESQUEMA_OK', firmaEsquema_(), 21600)");
    const r2 = llamar(u, 'getBootstrap');
    assert.strictEqual(r2.ok, true, r2.error && r2.error.message);
    assert.strictEqual(r2.data.instalado, false);
    assert.ok(r2.data.faltantes.indexOf('CDTs') !== -1);
    assert.strictEqual(llamar(u, 'instalarBaseDatos').data.ok, true);
    assert.strictEqual(llamar(u, 'getBootstrap').data.instalado, true);

    // Una versión nueva de la app no confía en la revisión recordada de la anterior
    u.ejecutar("CacheService.getScriptCache().put('ESQUEMA_OK', '5|0.0.1', 21600)");
    assert.strictEqual(plano(u.ejecutar('verificarEsquema(undefined, { usarCache: true })')).desdeCache, undefined);
  });
};
