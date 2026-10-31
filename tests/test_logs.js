/**
 * Pruebas del registro de errores (Logs.gs).
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  prueba('log: un error de la API queda anotado con función, mensaje y versión', () => {
    const e = E();
    const r = e.llamar('saveCatalogo', 'Bancos', {});
    assert.strictEqual(r.ok, false);
    const l = e.llamar('obtenerLogs');
    assert.strictEqual(l.total, 1);
    assert.strictEqual(l.items[0].Nivel, 'Aviso', 'una regla de negocio es un aviso, no un error');
    assert.strictEqual(l.items[0].Mensaje, 'El nombre es obligatorio.');
    assert.strictEqual(l.items[0].Funcion, 'saveCatalogo');
    assert.ok(/^v\d+\.\d+\.\d+/.test(l.items[0].Detalle));
  });

  prueba('log: un fallo de código es Error; los avisos se pueden ocultar', () => {
    const e = E();
    e.ejecutar("responder_(function () { null.x; })");
    e.llamar('saveCatalogo', 'Bancos', {});
    const todo = e.llamar('obtenerLogs');
    assert.strictEqual(todo.total, 2);
    assert.strictEqual(todo.errores, 1);
    const errores = e.llamar('obtenerLogs', { soloErrores: true });
    assert.strictEqual(errores.items.length, 1);
    assert.strictEqual(errores.items[0].Nivel, 'Error');
  });

  prueba('log: lo más nuevo va primero y se respeta el límite', () => {
    const e = E();
    for (let i = 1; i <= 5; i++) e.llamar('registrarLog', 'Info', 'f', 'm' + i);
    const l = e.llamar('obtenerLogs', { limite: 3 });
    assert.deepStrictEqual(l.items.map(x => x.Mensaje), ['m5', 'm4', 'm3']);
    assert.strictEqual(l.hayMas, true);
  });

  prueba('log: el cliente reporta sus errores y los textos largos se recortan', () => {
    const e = E();
    e.llamar('logClientError', 'x'.repeat(1000), 'y'.repeat(5000));
    const it = e.llamar('obtenerLogs').items[0];
    assert.strictEqual(it.Funcion, 'cliente');
    assert.strictEqual(it.Nivel, 'Error');
    assert.ok(it.Mensaje.length <= 400 && it.Detalle.length <= 2000);
  });

  prueba('log: pasado el tope se descartan las entradas más viejas', () => {
    const e = E();
    e.ejecutar('for (let i = 1; i <= MAX_LOG_FILAS + MARGEN_RECORTE_LOG + 5; i++) registrarLog("Info", "f", "n" + i)');
    const l = e.llamar('obtenerLogs', { limite: 1000 });
    assert.ok(l.total >= 500 && l.total <= 550, 'se queda entre el tope y el margen: ' + l.total);
    assert.strictEqual(l.items[0].Mensaje, 'n555', 'lo más nuevo se conserva');
    assert.ok(l.items.every(x => x.Mensaje !== 'n1'), 'lo más viejo se fue');
  });

  prueba('log: registrar nunca rompe lo que se estaba haciendo', () => {
    const e = crearEntorno({}); // sin base instalada: la tabla Log no existe
    e.cargar('Setup.gs', 'Repo.gs', 'Logs.gs');
    assert.strictEqual(e.ejecutar('registrarLog("Error", "f", "m")'), false);
  });

  prueba('log: limpiar vacía el registro y deja constancia', () => {
    const e = E();
    e.llamar('registrarLog', 'Error', 'f', 'uno');
    e.llamar('registrarLog', 'Error', 'f', 'dos');
    const l = e.llamar('clearLogs').data;
    assert.strictEqual(l.total, 1);
    assert.strictEqual(l.items[0].Funcion, 'limpiarLogs');
  });

  prueba('log: borrar todos los datos deja una sola entrada informativa', () => {
    const e = E();
    e.llamar('registrarLog', 'Error', 'f', 'viejo');
    e.llamar('borrarTodosLosDatos', 'BORRAR');
    const l = e.llamar('obtenerLogs');
    assert.strictEqual(l.total, 1);
    assert.strictEqual(l.items[0].Nivel, 'Info');
  });

  prueba('log: un disparador que falla deja rastro y vuelve a lanzar el error', () => {
    const e = E();
    assert.throws(() => e.ejecutar("ejecutarConLog_('miDisparador', function () { throw new Error('se cayó'); })"), /se cayó/);
    const it = e.llamar('obtenerLogs').items[0];
    assert.strictEqual(it.Funcion, 'miDisparador');
    assert.strictEqual(it.Nivel, 'Error');
  });
};
