/**
 * Pruebas de divisas: banco en USD, migración de la columna, saldos por divisa, conversión y reglas.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const CARGA = ['Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'Api.gs'];
  const hoy = () => new Date().toISOString().slice(0, 10);

  function equipar(e) {
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    return e;
  }
  function E() {
    const e = equipar(crearEntorno({}));
    e.cargar(...CARGA);
    e.llamar('setupDatabase');
    return e;
  }

  /** Un banco en pesos con una billetera, y un banco en dólares con una cuenta de ahorro (US$ 1.000). */
  function escenario() {
    const e = E();
    const bco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Nequi' });
    const usa = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco USA', Divisa: 'USD' });
    const cop = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: bco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cop.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 2000000 });
    const dolares = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: usa.ID_Banco, Nombre: 'Ahorro USD', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 1000 });
    const bolUsd = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Cuenta === dolares.ID_Cuenta);
    return { e, bco, usa, cop, casa, dolares, bolUsd };
  }

  prueba('divisas: un banco nuevo es en pesos y se puede crear en dólares; otra divisa no se acepta', () => {
    const e = E();
    assert.strictEqual(e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'A' }).Divisa, 'COP');
    assert.strictEqual(e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B', Divisa: 'USD' }).Divisa, 'USD');
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { Nombre: 'C', Divisa: 'JPY' }), /divisa no es válido/);
  });

  prueba('divisas: no se cambia la divisa de un banco que ya tiene cuentas', () => {
    const { e, usa, bco } = escenario();
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { ID_Banco: usa.ID_Banco, Divisa: 'COP' }), /ya tiene cuentas/);
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { ID_Banco: bco.ID_Banco, Divisa: 'USD' }), /ya tiene cuentas/);
    const vacio = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Sin cuentas' });
    assert.strictEqual(e.llamar('guardarCatalogo', 'Bancos', { ID_Banco: vacio.ID_Banco, Divisa: 'EUR' }).Divisa, 'EUR');
  });

  prueba('migración: una pestaña Bancos sin la columna Divisa la recibe, sin perder datos', () => {
    const viejo = [['ID_Banco', 'Nombre', 'Color', 'Icono', 'Activo', 'Orden', 'Creado_En', 'Actualizado_En'],
      ['ban-1', 'Nequi', '#fff', '', true, 1, '2026-01-01T00:00:00', '2026-01-02T00:00:00']];
    const e = equipar(crearEntorno({ Bancos: viejo }));
    e.cargar(...CARGA);
    assert.strictEqual(e.llamar('verificarEsquema').diferencias.some(d => d.tabla === 'Bancos'), true, 'antes de migrar hay diferencias');
    const r = e.llamar('setupDatabase');
    assert.deepStrictEqual(r.migradas, ['Bancos.Divisa']);
    assert.strictEqual(r.ok, true);
    const fila = e.hojas.Bancos.filas;
    assert.deepStrictEqual(fila[0].slice(4), ['Activo', 'Orden', 'Divisa', 'Creado_En', 'Actualizado_En']);
    assert.deepStrictEqual(fila[1], ['ban-1', 'Nequi', '#fff', '', true, 1, 'COP', '2026-01-01T00:00:00', '2026-01-02T00:00:00']);
    assert.strictEqual(e.llamar('setupDatabase').migradas.length, 0, 'es idempotente');
    assert.strictEqual(e.llamar('listarCatalogo', 'Bancos')[0].Divisa, 'COP');
  });

  prueba('migración: una pestaña con otras diferencias no se toca', () => {
    const raro = [['ID_Banco', 'Otro', 'Creado_En', 'Actualizado_En'], ['x', 'y', '', '']];
    const e = equipar(crearEntorno({ Bancos: raro }));
    e.cargar(...CARGA);
    const r = e.llamar('setupDatabase');
    assert.strictEqual(r.migradas.length, 0);
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(e.hojas.Bancos.filas[0], ['ID_Banco', 'Otro', 'Creado_En', 'Actualizado_En']);
  });

  prueba('saldos: los pesos y los dólares no se mezclan; el equivalente usa la tasa anotada', () => {
    const { e, dolares } = escenario();
    let s = e.llamar('obtenerSaldos');
    assert.strictEqual(s.total, 2000000, 'el total es solo en pesos');
    assert.strictEqual(s.ahorro, 0);
    assert.deepStrictEqual(s.divisas, [{ Divisa: 'USD', Total: 1000, Tasa: null, Equivalente: null }]);
    assert.strictEqual(s.cuentas.find(c => c.ID_Cuenta === dolares.ID_Cuenta).Divisa, 'USD');

    e.llamar('saveTasaDivisa', 'USD', '4.012,50'.replace('.', '').replace(',', '.'));
    s = e.llamar('obtenerSaldos');
    assert.deepStrictEqual(s.divisas, [{ Divisa: 'USD', Total: 1000, Tasa: 4012.5, Equivalente: 4012500 }]);
    assert.deepStrictEqual(e.llamar('resumenSaldos_').divisas, s.divisas, 'cada escritura devuelve lo mismo');
    assert.strictEqual(e.llamar('resumenSaldos_').total, 2000000);
  });

  prueba('tasa: se valida, queda con fecha, se puede quitar y funciona en una base antigua', () => {
    const { e } = escenario();
    assert.strictEqual(e.llamar('saveTasaDivisa', 'COP', '1').ok, false);
    assert.strictEqual(e.llamar('saveTasaDivisa', 'USD', '-3').ok, false);
    assert.strictEqual(e.llamar('saveTasaDivisa', 'USD', 'abc').ok, false);
    const r = e.llamar('saveTasaDivisa', 'USD', '4000');
    assert.strictEqual(r.data.fecha, hoy());
    assert.strictEqual(e.llamar('saveConfigParam', 'Tasa_USD', '1').ok, false, 'no se edita como parámetro suelto');
    assert.strictEqual(e.llamar('saveTasaDivisa', 'USD', '').data.tasa, '');
    assert.strictEqual(e.llamar('obtenerSaldos').divisas[0].Tasa, null);

    // Base creada antes de las tasas: la fila de Config no existe y se crea al guardar
    const hoja = e.hojas.Config;
    hoja.filas = hoja.filas.filter(f => !String(f[0]).startsWith('Tasa_'));
    e.ejecutar('invalidateCache()');
    assert.strictEqual(e.llamar('saveTasaDivisa', 'EUR', '4500').ok, true);
  });

  prueba('traslados: entre bolsillos de la misma divisa sí; entre divisas distintas se pide convertir', () => {
    const { e, casa, bolUsd, usa, dolares } = escenario();
    assert.throws(e.falla('registrarTransferencia', casa.ID_Bolsillo, bolUsd.ID_Bolsillo, 100, hoy()), /usa "Convertir divisas"/);
    const otro = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: usa.ID_Banco, Nombre: 'Viajes USD', Tipo: 'Debito', Permite_Bolsillos: false, Saldo_Apertura: 0 });
    const b2 = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Cuenta === otro.ID_Cuenta);
    assert.strictEqual(e.llamar('registrarTransferencia', bolUsd.ID_Bolsillo, b2.ID_Bolsillo, 250, hoy()).ok, true);
    const m = e.llamar('mapaSaldosBolsillos_');
    assert.strictEqual(m[bolUsd.ID_Bolsillo], 750);
    assert.strictEqual(m[b2.ID_Bolsillo], 250);
    assert.ok(dolares);
  });

  prueba('conversión: comprar dólares mueve ambos saldos, anota la tasa y se anula junta', () => {
    const { e, casa, bolUsd } = escenario();
    const r = e.llamar('addConversion', { origen: casa.ID_Bolsillo, destino: bolUsd.ID_Bolsillo, valorOrigen: 1000000, valorDestino: 250, fecha: hoy() }).data;
    assert.strictEqual(r.tasa, '1 USD = 4000 COP');
    let m = e.llamar('mapaSaldosBolsillos_');
    assert.strictEqual(m[casa.ID_Bolsillo], 1000000);
    assert.strictEqual(m[bolUsd.ID_Bolsillo], 1250);

    const item = e.llamar('listarMovimientos', { mes: hoy().slice(0, 7) }).items.find(i => i.Subtipo === 'Conversion');
    assert.strictEqual(item.Valor, 1000000);
    assert.strictEqual(item.Divisa, 'COP');
    assert.strictEqual(item.DivisaDestino, 'USD');
    assert.strictEqual(item.ValorDestino, 250);

    e.llamar('anularMovimiento', item.ID_Mov);
    m = e.llamar('mapaSaldosBolsillos_');
    assert.strictEqual(m[casa.ID_Bolsillo], 2000000);
    assert.strictEqual(m[bolUsd.ID_Bolsillo], 1000);
  });

  prueba('conversión: de dólares a pesos, valida las divisas y los valores', () => {
    const { e, casa, bolUsd } = escenario();
    const r = e.llamar('addConversion', { origen: bolUsd.ID_Bolsillo, destino: casa.ID_Bolsillo, valorOrigen: 100, valorDestino: 410000 }).data;
    assert.strictEqual(r.tasa, '1 USD = 4100 COP');
    const otra = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: e.llamar('listarCatalogo', 'Cuentas').find(c => c.Nombre === 'Principal').ID_Cuenta, Nombre: 'Otro', Saldo_Apertura: 0 });
    assert.strictEqual(e.llamar('addConversion', { origen: casa.ID_Bolsillo, destino: otra.ID_Bolsillo, valorOrigen: 1, valorDestino: 1 }).ok, false, 'misma divisa');
    assert.strictEqual(e.llamar('addConversion', { origen: casa.ID_Bolsillo, destino: bolUsd.ID_Bolsillo, valorOrigen: 0, valorDestino: 5 }).ok, false);
    assert.strictEqual(e.llamar('addConversion', { origen: casa.ID_Bolsillo, destino: bolUsd.ID_Bolsillo, valorOrigen: 5, valorDestino: -1 }).ok, false);
  });

  prueba('movimientos: los totales del mes son en pesos; al mirar un bolsillo en dólares, en dólares', () => {
    const { e, casa, bolUsd } = escenario();
    e.llamar('registrarMovimiento', { ID_Bolsillo: casa.ID_Bolsillo, Valor: 50000, Tipo_Mov: 'Gasto', Concepto: 'Mercado' });
    e.llamar('registrarMovimiento', { ID_Bolsillo: bolUsd.ID_Bolsillo, Valor: 30, Tipo_Mov: 'Ingreso', Concepto: 'Intereses' });
    const mes = hoy().slice(0, 7);
    const todo = e.llamar('listarMovimientos', { mes });
    assert.strictEqual(todo.totales.Divisa, 'COP');
    assert.strictEqual(todo.totales.gastos, 50000);
    assert.strictEqual(todo.totales.ingresos, 0, 'los 30 dólares no se suman a los pesos');
    const usd = e.llamar('listarMovimientos', { mes, idBolsillo: bolUsd.ID_Bolsillo });
    assert.strictEqual(usd.totales.Divisa, 'USD');
    assert.strictEqual(usd.totales.ingresos, 30);
    assert.strictEqual(e.llamar('obtenerDetalleBolsillo', bolUsd.ID_Bolsillo).cuenta.Divisa, 'USD');
  });

  prueba('vista anual: los ingresos en dólares no se suman a los de pesos', () => {
    const { e, casa, bolUsd } = escenario();
    e.llamar('registrarMovimiento', { ID_Bolsillo: casa.ID_Bolsillo, Valor: 3000000, Tipo_Mov: 'Ingreso', Concepto: 'Sueldo' });
    e.llamar('registrarMovimiento', { ID_Bolsillo: bolUsd.ID_Bolsillo, Valor: 500, Tipo_Mov: 'Ingreso', Concepto: 'Freelance' });
    assert.strictEqual(e.llamar('obtenerVistaAnual', Number(hoy().slice(0, 4))).totales.ingreso, 3000000);
  });

  prueba('reglas: presupuesto, tarjetas, suscripciones, nómina y créditos solo aceptan pesos', () => {
    const { e, casa, bolUsd, usa, bco, dolares } = escenario();
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    assert.throws(e.falla('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Ahorro', Monto_Plan: 10, Tipo: 'Ahorro', ID_Bolsillo_Destino: bolUsd.ID_Bolsillo }), /está en USD/);
    assert.ok(e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Casa', Monto_Plan: 10, Tipo: 'Gasto', ID_Bolsillo_Destino: casa.ID_Bolsillo }).ID_Plantilla);

    assert.throws(e.falla('guardarCatalogo', 'Tarjetas', { ID_Banco: usa.ID_Banco, Nombre: 'T', Dia_Corte: 5, Dia_Pago: 20, ID_Bolsillo_Reserva: casa.ID_Bolsillo }), /bancos en COP/);
    const cuentaCop = e.llamar('listarCatalogo', 'Cuentas').find(c => c.Nombre === 'Principal');
    const reservaUsd = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: usa.ID_Banco, Nombre: 'Con bolsillos USD', Tipo: 'Billetera', Permite_Bolsillos: true });
    const bRes = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: reservaUsd.ID_Cuenta, Nombre: 'Reserva', Rol: 'Reserva_Tarjeta' });
    assert.throws(e.falla('guardarCatalogo', 'Tarjetas', { ID_Banco: bco.ID_Banco, Nombre: 'T', Dia_Corte: 5, Dia_Pago: 20, ID_Bolsillo_Reserva: bRes.ID_Bolsillo }), /bolsillo de reserva.*USD/);

    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', { Nombre: 'Netflix', Valor: 10, Proximo_Cobro: hoy(), ID_Bolsillo: bolUsd.ID_Bolsillo }), /está en USD/);
    assert.throws(e.falla('registrarPagoNomina', hoy().slice(0, 7), undefined, 1000000, hoy(), bolUsd.ID_Bolsillo), /./);
    assert.throws(e.falla('registrarCredito', { Nombre: 'C', ID_Cuenta_Ahorro: dolares.ID_Cuenta, ID_Bolsillo_Pago: casa.ID_Bolsillo, Monto: 100, Num_Periodos: 4, Tasa_Periodica: 0.01, Fecha_Inicio: hoy() }), /en COP/);
    assert.ok(cuentaCop);
  });

  prueba('ahorro: las cuentas de ahorro en dólares no entran al módulo de ahorro en pesos', () => {
    const { e, dolares } = escenario();
    assert.strictEqual(e.llamar('obtenerAhorro').cuentas.length, 0);
    assert.throws(e.falla('registrarRendimiento', { ID_Cuenta: dolares.ID_Cuenta, Tipo: 'Interes', Valor: 5 }), /solo se usan cuentas en COP/);
  });

  prueba('arranque: el total de apertura es en pesos y cada saldo lleva su divisa', () => {
    const { e, casa } = escenario();
    const a = e.llamar('obtenerArranque');
    assert.strictEqual(a.totalApertura, 2000000);
    assert.ok(a.aperturas.some(x => x.Divisa === 'USD' && x.Saldo_Apertura === 1000));
    assert.ok(a.aperturas.some(x => x.Divisa === 'COP' && x.ID_Bolsillo === casa.ID_Bolsillo));
  });
};
