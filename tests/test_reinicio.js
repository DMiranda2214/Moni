/**
 * Pruebas del borrado total de la información de la persona (Reinicio.gs).
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  /** Una persona con datos reales: nombre, banco, cuenta, bolsillo, un movimiento y la operación iniciada. */
  function conDatos() {
    const e = E();
    e.llamar('saveConfigParam', 'Nombre_Usuario', 'Ana');
    e.llamar('saveConfigParam', 'Color_Acento', 'azul');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const cuenta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const bol = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 500000 });
    e.llamar('registrarMovimiento', { ID_Bolsillo: bol.ID_Bolsillo, Valor: 20000, Tipo_Mov: 'Gasto', Concepto: 'Mercado' });
    return e;
  }

  const filasDe = (e, tabla) => e.llamar('getTableData', tabla, { forceRefresh: true });

  prueba('reinicio: sin la frase exacta no se borra nada', () => {
    const e = conDatos();
    assert.throws(e.falla('borrarTodosLosDatos', ''), /escribe BORRAR/);
    assert.throws(e.falla('borrarTodosLosDatos', 'borrar todo'), /escribe BORRAR/);
    assert.throws(e.falla('borrarTodosLosDatos'), /escribe BORRAR/);
    assert.strictEqual(filasDe(e, 'Bancos').length, 1);
    assert.strictEqual(filasDe(e, 'Movimientos').length, 1);
    assert.strictEqual(e.llamar('resetAllData', 'no').ok, false, 'la API responde con error');
    assert.strictEqual(filasDe(e, 'Cuentas').length, 1);
  });

  prueba('reinicio: deja todas las tablas vacías y los valores iniciales como en una instalación nueva', () => {
    const e = conDatos();
    e.llamar('sembrarDatosDemo');
    const r = e.llamar('borrarTodosLosDatos', 'BORRAR');
    assert.strictEqual(r.ok, true);
    assert.ok(r.eliminadas.Movimientos >= 1 && r.eliminadas.Bancos >= 1);

    const sembradas = { Config: 1, Categorias: 1, Escenarios: 1, Log: 1 }; // el Log conserva la nota del borrado
    plano(e.ejecutar('Object.keys(SCHEMAS)')).forEach(tabla => {
      if (sembradas[tabla]) return;
      assert.strictEqual(filasDe(e, tabla).length, 0, tabla + ' debe quedar vacía');
    });
    // Los encabezados siguen: la base sigue "instalada"
    assert.strictEqual(e.llamar('verificarEsquema').listo, true);

    const cfg = {};
    filasDe(e, 'Config').forEach(c => { cfg[c.Clave] = c.Valor; });
    assert.strictEqual(cfg.Nombre_Usuario, '');
    assert.strictEqual(cfg.Color_Acento, 'rosa');
    assert.strictEqual(String(cfg.Datos_Demo).toUpperCase(), 'FALSE');
    assert.strictEqual(String(cfg.Arranque_Hecho).toUpperCase(), 'FALSE');
    assert.strictEqual(filasDe(e, 'Log').length, 1);
    assert.strictEqual(filasDe(e, 'Categorias').length, 15);
    assert.strictEqual(filasDe(e, 'Escenarios').length, 1);
  });

  prueba('reinicio: después la app vuelve a pedir los primeros pasos y se puede empezar de nuevo', () => {
    const e = conDatos();
    assert.strictEqual(e.llamar('obtenerEstadoConfiguracion').completo, true);
    e.llamar('borrarTodosLosDatos', 'BORRAR');
    const estado = e.llamar('obtenerEstadoConfiguracion');
    assert.strictEqual(estado.instalado, true);
    assert.strictEqual(estado.completo, false);
    assert.ok(estado.pasos.every(p => !p.hecho || p.opcional), 'ningún paso obligatorio queda hecho');

    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco nuevo' });
    assert.ok(banco.ID_Banco);
    assert.strictEqual(filasDe(e, 'Bancos').length, 1);
  });

  prueba('reinicio: apaga las copias automáticas y conserva las copias de Drive salvo que se pida', () => {
    const e = conDatos();
    e.llamar('crearRespaldo');
    e.llamar('configurarRespaldoAutomatico', true);
    assert.strictEqual(e.llamar('estadoRespaldos').automatico, true);

    const r = e.llamar('borrarTodosLosDatos', 'BORRAR');
    assert.strictEqual(r.respaldosEliminados, 0);
    const est = e.llamar('estadoRespaldos');
    assert.strictEqual(est.automatico, false);
    assert.strictEqual(est.copiasActuales, 1, 'la copia de Drive no se toca por defecto');
    assert.strictEqual(est.ultimo, '', 'ya no hay "último respaldo"');
  });

  prueba('reinicio: con la opción de respaldos también los manda a la papelera', () => {
    const e = conDatos();
    e.llamar('crearRespaldo');
    e.llamar('crearRespaldo');
    const r = e.llamar('resetAllData', 'BORRAR', { respaldos: true });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.respaldosEliminados, 2);
    assert.strictEqual(e.llamar('estadoRespaldos').copiasActuales, 0);
  });

  prueba('reinicio: sin carpeta de respaldos la opción no falla', () => {
    const e = conDatos();
    const r = e.llamar('resetAllData', 'BORRAR', { respaldos: true });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.respaldosEliminados, 0);
  });

  prueba('reinicio: conserva el vínculo con la hoja y la lista de usuarios permitidos', () => {
    const e = conDatos();
    e.propiedades.USUARIOS_PERMITIDOS = 'ana@example.com';
    e.llamar('borrarTodosLosDatos', 'BORRAR');
    assert.strictEqual(e.propiedades.SPREADSHEET_ID, 'id-falso');
    assert.strictEqual(e.propiedades.USUARIOS_PERMITIDOS, 'ana@example.com');
  });

  prueba('reinicio: se puede repetir sobre una base ya vacía', () => {
    const e = E();
    assert.strictEqual(e.llamar('borrarTodosLosDatos', 'BORRAR').ok, true);
    assert.strictEqual(e.llamar('borrarTodosLosDatos', 'borrar').ok, true, 'sin distinguir mayúsculas');
    assert.strictEqual(filasDe(e, 'Categorias').length, 15, 'no duplica lo sembrado');
  });
};
