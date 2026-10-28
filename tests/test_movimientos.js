/**
 * Pruebas de la Fase 2: movimientos, traslados, anulación, edición, consultas, cuadre,
 * fusión de bolsillos y memoria por petición.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  /** Dos cuentas con bolsillos: Principal (Casa 1.000.000, Mercado 200.000) y Digital (Reserva 50.000). */
  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const c2 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Digital', Tipo: 'Billetera' });
    const b = (cuenta, nombre, saldo) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: nombre, Saldo_Apertura: saldo });
    const casa = b(c1, 'Casa', 1000000), mercado = b(c1, 'Mercado', 200000), reserva = b(c2, 'Reserva', 50000);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, banco, c1, c2, casa, mercado, reserva, saldo };
  }
  const hoy = () => new Date().toISOString().slice(0, 10);
  const dias = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  // ---------------------------------------------------------------- registrar
  prueba('registrar: un gasto resta, un ingreso suma y el ajuste conserva su signo', () => {
    const { e, casa, saldo } = escenario();
    e.llamar('registrarMovimiento', { Concepto: 'Mercado', ID_Bolsillo: casa.ID_Bolsillo, Valor: 85500, Tipo_Mov: 'Gasto' });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 914500);
    e.llamar('registrarMovimiento', { Concepto: 'Nómina', ID_Bolsillo: casa.ID_Bolsillo, Valor: 500000, Tipo_Mov: 'Ingreso' });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1414500);
    e.llamar('registrarMovimiento', { Concepto: 'Corrección', ID_Bolsillo: casa.ID_Bolsillo, Valor: -4500, Tipo_Mov: 'Ajuste' });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1410000);
  });

  prueba('registrar: valida valor, concepto, fecha, bolsillo, tipo y categoría', () => {
    const { e, casa, mercado } = escenario();
    const base = { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 100, Tipo_Mov: 'Gasto' };
    const f = m => e.falla('registrarMovimiento', Object.assign({}, base, m));
    assert.throws(f({ Valor: 0 }), /mayor que cero/);
    assert.throws(f({ Valor: -5 }), /mayor que cero/);
    assert.throws(f({ Valor: 'abc' }), /número/);
    assert.throws(f({ Valor: 2e12 }), /mayor que/);
    assert.throws(f({ Concepto: '  ' }), /concepto es obligatorio/);
    assert.throws(f({ Fecha: '2027/01/05' }), /formato/);
    assert.throws(f({ Fecha: '2026-02-30' }), /no existe/);
    assert.throws(f({ Fecha: '2999-01-01' }), /futura/);
    assert.throws(f({ ID_Bolsillo: 'no-existe' }), /bolsillo no existe/);
    assert.throws(f({ Tipo_Mov: 'Transferencia' }), /tipo de movimiento no es válido/);
    assert.throws(f({ Tipo_Mov: 'Ajuste', Valor: 0 }), /no puede ser cero/);
    assert.throws(f({ Subtipo: 'Inventado' }), /subtipo/);
    // desactivado
    e.llamar('guardarCatalogo', 'Bolsillos', { ID_Bolsillo: mercado.ID_Bolsillo, Saldo_Apertura: 0 });
    e.llamar('desactivarCatalogo', 'Bolsillos', mercado.ID_Bolsillo);
    assert.throws(f({ ID_Bolsillo: mercado.ID_Bolsillo }), /desactivado/);
  });

  prueba('registrar: la categoría debe ser del mismo tipo que el movimiento', () => {
    const { e, casa } = escenario();
    const cats = e.llamar('listarCatalogo', 'Categorias');
    const gasto = cats.find(c => c.Tipo === 'Gasto'), ingreso = cats.find(c => c.Tipo === 'Ingreso');
    const ok = e.llamar('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1, Tipo_Mov: 'Gasto', ID_Categoria: gasto.ID_Categoria });
    assert.strictEqual(ok.ID_Categoria, gasto.ID_Categoria);
    assert.throws(e.falla('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1, Tipo_Mov: 'Gasto', ID_Categoria: ingreso.ID_Categoria }), /es de ingreso, no de gasto/);
  });

  prueba('registrar: la fecha de hoy y el ayer son válidos; sin fecha usa hoy', () => {
    const { e, casa } = escenario();
    const a = e.llamar('registrarMovimiento', { Concepto: 'a', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1 });
    const b = e.llamar('registrarMovimiento', { Concepto: 'b', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1, Fecha: dias(1) });
    assert.strictEqual(a.Fecha, hoy());
    assert.strictEqual(b.Fecha, dias(1));
  });

  // ---------------------------------------------------------------- traslados
  prueba('traslado: dos patas que suman cero, entre bolsillos de la misma cuenta y de cuentas distintas', () => {
    const { e, c1, c2, casa, mercado, reserva, saldo } = escenario();
    const total = () => e.llamar('obtenerSaldos').total;
    const antes = total();
    const r = e.llamar('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, 150000, hoy(), 'A mercado');
    assert.strictEqual(r.patas.length, 2);
    assert.strictEqual(r.patas[0].Valor + r.patas[1].Valor, 0);
    assert.strictEqual(r.patas[0].ID_Grupo, r.patas[1].ID_Grupo);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 850000);
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 350000);

    e.llamar('registrarTransferencia', casa.ID_Bolsillo, reserva.ID_Bolsillo, 50000);
    const s = e.llamar('obtenerSaldos');
    assert.strictEqual(s.cuentas.find(c => c.ID_Cuenta === c1.ID_Cuenta).Saldo, 1150000);
    assert.strictEqual(s.cuentas.find(c => c.ID_Cuenta === c2.ID_Cuenta).Saldo, 100000);
    assert.strictEqual(total(), antes, 'el total nunca cambia por un traslado');
  });

  prueba('traslado: rechaza mismo bolsillo, valor no positivo y bolsillos inexistentes', () => {
    const { e, casa, mercado } = escenario();
    assert.throws(e.falla('registrarTransferencia', casa.ID_Bolsillo, casa.ID_Bolsillo, 10), /no pueden ser el mismo/);
    assert.throws(e.falla('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, 0), /mayor que cero/);
    assert.throws(e.falla('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, -10), /mayor que cero/);
    assert.throws(e.falla('registrarTransferencia', 'x', mercado.ID_Bolsillo, 10), /origen no existe/);
    assert.throws(e.falla('registrarTransferencia', casa.ID_Bolsillo, 'x', 10), /destino no existe/);
  });

  prueba('traslado: un bolsillo puede quedar en negativo (como el bolsillo personal del Excel)', () => {
    const { e, casa, mercado, saldo } = escenario();
    e.llamar('registrarTransferencia', mercado.ID_Bolsillo, casa.ID_Bolsillo, 300000);
    assert.strictEqual(saldo(mercado.ID_Bolsillo), -100000);
  });

  // ---------------------------------------------------------------- anular / restaurar
  prueba('anular un gasto devuelve el saldo y restaurar lo vuelve a aplicar', () => {
    const { e, casa, saldo } = escenario();
    const m = e.llamar('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 100000 });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 900000);
    e.llamar('anularMovimiento', m.ID_Mov);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1000000);
    e.llamar('restaurarMovimiento', m.ID_Mov);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 900000);
  });

  prueba('anular un traslado anula las dos patas; anular dos veces no hace nada más', () => {
    const { e, casa, mercado, saldo } = escenario();
    const t = e.llamar('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, 70000);
    const r = e.llamar('anularMovimiento', t.patas[1].ID_Mov);
    assert.strictEqual(r.grupo, true);
    assert.strictEqual(r.cambiados, 2);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1000000);
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 200000);
    assert.strictEqual(e.llamar('anularMovimiento', t.patas[0].ID_Mov).cambiados, 0);
  });

  prueba('restaurar exige que los bolsillos sigan activos', () => {
    const { e, mercado } = escenario();
    const m = e.llamar('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: mercado.ID_Bolsillo, Valor: 200000 }); // saldo 0
    e.llamar('anularMovimiento', m.ID_Mov);                                                                  // saldo 200.000
    e.llamar('guardarCatalogo', 'Bolsillos', { ID_Bolsillo: mercado.ID_Bolsillo, Saldo_Apertura: 0 });        // saldo 0
    e.llamar('desactivarCatalogo', 'Bolsillos', mercado.ID_Bolsillo);
    assert.throws(e.falla('restaurarMovimiento', m.ID_Mov), /desactivado/);
    e.llamar('reactivarCatalogo', 'Bolsillos', mercado.ID_Bolsillo);
    assert.strictEqual(e.llamar('restaurarMovimiento', m.ID_Mov).cambiados, 1);
  });

  prueba('anular o restaurar un movimiento inexistente da un error claro', () => {
    const { e } = escenario();
    assert.throws(e.falla('anularMovimiento', 'nope'), /no existe/);
    assert.throws(e.falla('restaurarMovimiento', 'nope'), /no existe/);
  });

  // ---------------------------------------------------------------- editar
  prueba('editar: cambia valor, concepto, fecha y bolsillo de un gasto, conservando el signo', () => {
    const { e, casa, mercado, saldo } = escenario();
    const m = e.llamar('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 100000 });
    e.llamar('editarMovimiento', m.ID_Mov, { Valor: 60000, Concepto: 'Mercado', ID_Bolsillo: mercado.ID_Bolsillo, Fecha: dias(2) });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1000000, 'el bolsillo anterior recupera el dinero');
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 140000);
    const item = e.llamar('listarMovimientos', { ids: [m.ID_Mov] }).items[0];
    assert.strictEqual(item.Concepto, 'Mercado');
    assert.strictEqual(item.Fecha, dias(2));
    assert.strictEqual(item.Valor, -60000);
  });

  prueba('editar: no aplica a traslados, a movimientos de la app ni a anulados', () => {
    const { e, casa, mercado } = escenario();
    const t = e.llamar('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, 10);
    assert.throws(e.falla('editarMovimiento', t.patas[0].ID_Mov, { Valor: 1 }), /traslado no se edita/);
    const g = e.llamar('registrarMovimiento', { Concepto: 'pago', ID_Bolsillo: casa.ID_Bolsillo, Valor: 5, Subtipo: 'Pago_TC' });
    assert.throws(e.falla('editarMovimiento', g.ID_Mov, { Valor: 1 }), /lo generó la app/);
    const a = e.llamar('registrarMovimiento', { Concepto: 'a', ID_Bolsillo: casa.ID_Bolsillo, Valor: 5 });
    e.llamar('anularMovimiento', a.ID_Mov);
    assert.throws(e.falla('editarMovimiento', a.ID_Mov, { Valor: 1 }), /anulado/);
  });

  prueba('editar: aplica las mismas validaciones que registrar', () => {
    const { e, casa } = escenario();
    const m = e.llamar('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 100 });
    assert.throws(e.falla('editarMovimiento', m.ID_Mov, { Valor: 0 }), /mayor que cero/);
    assert.throws(e.falla('editarMovimiento', m.ID_Mov, { Concepto: '' }), /concepto es obligatorio/);
    assert.throws(e.falla('editarMovimiento', m.ID_Mov, { Fecha: '2999-01-01' }), /futura/);
    assert.throws(e.falla('editarMovimiento', m.ID_Mov, { ID_Bolsillo: 'nope' }), /bolsillo no existe/);
  });

  // ---------------------------------------------------------------- consultas
  prueba('listar: un traslado aparece una vez en la lista general y dos en la de un bolsillo', () => {
    const { e, casa, mercado } = escenario();
    e.llamar('registrarTransferencia', casa.ID_Bolsillo, mercado.ID_Bolsillo, 70000, hoy(), 'A mercado');
    e.llamar('registrarMovimiento', { Concepto: 'Pan', ID_Bolsillo: mercado.ID_Bolsillo, Valor: 5000 });

    const general = e.llamar('listarMovimientos', { mes: hoy().slice(0, 7) });
    assert.strictEqual(general.items.length, 2);
    const tr = general.items.find(i => i.esTransferencia);
    assert.strictEqual(tr.Valor, 70000);
    assert.strictEqual(tr.Origen, 'Casa');
    assert.strictEqual(tr.Destino, 'Mercado');
    assert.strictEqual(general.totales.gastos, 5000, 'el traslado no cuenta como gasto');
    assert.strictEqual(general.totales.ingresos, 0);

    const delMercado = e.llamar('listarMovimientos', { mes: hoy().slice(0, 7), idBolsillo: mercado.ID_Bolsillo });
    assert.strictEqual(delMercado.items.length, 2);
    const entrada = delMercado.items.find(i => i.esTransferencia);
    assert.strictEqual(entrada.Valor, 70000);
    assert.strictEqual(entrada.Contraparte, 'Casa');
  });

  prueba('listar: filtra por mes, texto y cuenta; ordena por fecha descendente; los anulados solo si se piden', () => {
    const { e, c2, casa, reserva } = escenario();
    const reg = (c, v, f, b) => e.llamar('registrarMovimiento', { Concepto: c, ID_Bolsillo: (b || casa).ID_Bolsillo, Valor: v, Fecha: f });
    reg('Antiguo', 10, '2026-01-15');
    reg('Reciente', 20, dias(0));
    const medio = reg('Medio', 30, dias(3));
    reg('En reserva', 40, dias(1), reserva);
    e.llamar('anularMovimiento', medio.ID_Mov);

    assert.deepStrictEqual(e.llamar('listarMovimientos', { mes: '2026-01' }).items.map(i => i.Concepto), ['Antiguo']);
    const todos = e.llamar('listarMovimientos', {}).items.map(i => i.Concepto);
    assert.deepStrictEqual(todos, ['Reciente', 'En reserva', 'Antiguo'], 'ordenado y sin anulados');
    assert.strictEqual(e.llamar('listarMovimientos', { incluirAnulados: true }).items.length, 4);
    assert.deepStrictEqual(e.llamar('listarMovimientos', { texto: 'recien' }).items.map(i => i.Concepto), ['Reciente']);
    assert.deepStrictEqual(e.llamar('listarMovimientos', { idCuenta: c2.ID_Cuenta }).items.map(i => i.Concepto), ['En reserva']);
    assert.strictEqual(e.llamar('listarMovimientos', { limite: 1 }).hayMas, true);
    assert.throws(e.falla('listarMovimientos', { mes: '26-1' }), /formato/);
  });

  prueba('detalle de bolsillo: saldo, cuenta, banco y movimientos del mes en una sola llamada', () => {
    const { e, casa } = escenario();
    e.llamar('registrarMovimiento', { Concepto: 'Gas', ID_Bolsillo: casa.ID_Bolsillo, Valor: 30000 });
    const d = e.llamar('obtenerDetalleBolsillo', casa.ID_Bolsillo);
    assert.strictEqual(d.bolsillo.Saldo, 970000);
    assert.strictEqual(d.cuenta.Nombre, 'Principal');
    assert.strictEqual(d.cuenta.Banco, 'Banco');
    assert.strictEqual(d.movimientos.length, 1);
    assert.strictEqual(d.totales.gastos, 30000);
    assert.throws(e.falla('obtenerDetalleBolsillo', 'nope'), /no existe/);
  });

  // ---------------------------------------------------------------- cuadre
  prueba('cuadre: guarda el saldo real y calcula la diferencia', () => {
    const { e, c1 } = escenario();
    const r = e.llamar('cuadrarCuenta', c1.ID_Cuenta, 1150000);
    assert.strictEqual(r.diferenciaAnterior, 0 - 50000, 'el banco muestra 50.000 menos que Moni');
    const cta = e.llamar('resumenSaldos_').cuentas[c1.ID_Cuenta];
    assert.strictEqual(cta.Saldo_Real, 1150000);
    assert.strictEqual(cta.Diferencia, -50000);
  });

  prueba('cuadre: con un bolsillo de ajuste registra la diferencia y la cuenta cuadra', () => {
    const { e, c1, mercado } = escenario();
    const r = e.llamar('cuadrarCuenta', c1.ID_Cuenta, 1150000, mercado.ID_Bolsillo);
    assert.strictEqual(r.ajustado, true);
    const cta = e.llamar('resumenSaldos_').cuentas[c1.ID_Cuenta];
    assert.strictEqual(cta.Saldo, 1150000);
    assert.strictEqual(cta.Diferencia, 0);
    const aj = e.llamar('listarMovimientos', {}).items.find(i => i.Tipo_Mov === 'Ajuste');
    assert.strictEqual(aj.Valor, -50000);
    assert.strictEqual(aj.Concepto, 'Ajuste por cuadre');
  });

  prueba('cuadre: si ya cuadra no crea ajustes; el bolsillo debe ser de la cuenta', () => {
    const { e, c1, casa, reserva } = escenario();
    const r = e.llamar('cuadrarCuenta', c1.ID_Cuenta, 1200000, casa.ID_Bolsillo);
    assert.strictEqual(r.ajustado, false);
    assert.strictEqual(e.llamar('listarMovimientos', {}).items.length, 0);
    assert.throws(e.falla('cuadrarCuenta', c1.ID_Cuenta, 5, reserva.ID_Bolsillo), /no es de esta cuenta/);
    assert.throws(e.falla('cuadrarCuenta', c1.ID_Cuenta, ''), /obligatorio/);
  });

  // ---------------------------------------------------------------- fusión de bolsillos
  prueba('fusión: quitar los bolsillos de una cuenta junta el dinero en el elegido y deja el historial', () => {
    const { e, c1, casa, mercado } = escenario();
    e.llamar('registrarMovimiento', { Concepto: 'Compra', ID_Bolsillo: mercado.ID_Bolsillo, Valor: 50000 });
    const total = e.llamar('obtenerSaldos').total;

    assert.throws(e.falla('guardarCatalogo', 'Cuentas', { ID_Cuenta: c1.ID_Cuenta, Permite_Bolsillos: false }), /Elige en cuál juntar/);
    assert.throws(e.falla('guardarCatalogo', 'Cuentas', { ID_Cuenta: c1.ID_Cuenta, Permite_Bolsillos: false }, { fusionarEn: 'otro' }), /uno activo de esta cuenta/);

    e.llamar('guardarCatalogo', 'Cuentas', { ID_Cuenta: c1.ID_Cuenta, Permite_Bolsillos: false }, { fusionarEn: casa.ID_Bolsillo });
    const quedan = e.llamar('listarCatalogo', 'Bolsillos').filter(b => b.ID_Cuenta === c1.ID_Cuenta);
    assert.strictEqual(quedan.length, 1);
    assert.strictEqual(quedan[0].Es_Interno, true);
    assert.strictEqual(quedan[0].ID_Bolsillo, casa.ID_Bolsillo);
    assert.strictEqual(e.llamar('resumenSaldos_').cuentas[c1.ID_Cuenta].Saldo, 1150000, 'el saldo de la cuenta queda intacto');
    assert.strictEqual(e.llamar('obtenerSaldos').total, total, 'fusionar no cambia el total');
    assert.ok(e.llamar('listarMovimientos', {}).items.some(i => /Fusión de bolsillos/.test(i.Concepto)), 'queda un traslado en el historial');
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[mercado.ID_Bolsillo], 0);
  });

  prueba('fusión: un bolsillo en negativo también se junta correctamente', () => {
    const { e, c1, casa, mercado } = escenario();
    e.llamar('registrarMovimiento', { Concepto: 'Gasto grande', ID_Bolsillo: mercado.ID_Bolsillo, Valor: 300000 }); // mercado = -100.000
    const total = e.llamar('obtenerSaldos').total;
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Cuenta: c1.ID_Cuenta, Permite_Bolsillos: false }, { fusionarEn: casa.ID_Bolsillo });
    assert.strictEqual(e.llamar('obtenerSaldos').total, total);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 900000);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[mercado.ID_Bolsillo], 0);
  });

  prueba('fusión: si la validación falla, la cuenta no cambia', () => {
    const { e, c1 } = escenario();
    assert.throws(e.falla('guardarCatalogo', 'Cuentas', { ID_Cuenta: c1.ID_Cuenta, Permite_Bolsillos: false }));
    const c = e.llamar('listarCatalogo', 'Cuentas').find(x => x.ID_Cuenta === c1.ID_Cuenta);
    assert.strictEqual(c.Permite_Bolsillos, true);
  });

  // ---------------------------------------------------------------- API
  prueba('API: cada escritura devuelve los movimientos afectados y los saldos nuevos', () => {
    const { e, casa, mercado } = escenario();
    const r = e.llamar('addMovimiento', { Concepto: 'Pan', ID_Bolsillo: casa.ID_Bolsillo, Valor: 5000 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.items.length, 1);
    assert.strictEqual(r.data.items[0].Bolsillo, 'Casa');
    assert.strictEqual(r.data.items[0].Valor, -5000);
    assert.strictEqual(r.data.saldos.bolsillos[casa.ID_Bolsillo], 995000);
    assert.strictEqual(r.data.saldos.total, 1250000 - 5000);

    const t = e.llamar('addTransferencia', { origen: casa.ID_Bolsillo, destino: mercado.ID_Bolsillo, valor: 1000 });
    assert.strictEqual(t.data.items.length, 1, 'un traslado = una línea');
    assert.strictEqual(t.data.items[0].esTransferencia, true);

    const v = e.llamar('voidMovimiento', t.data.items[0].ID_Mov);
    assert.strictEqual(v.data.items[0].Anulado, true);
    assert.strictEqual(v.data.saldos.bolsillos[mercado.ID_Bolsillo], 200000);
    const back = e.llamar('restoreMovimiento', t.data.items[0].ID_Mov);
    assert.strictEqual(back.data.saldos.bolsillos[mercado.ID_Bolsillo], 201000);
  });

  prueba('API: los errores llegan como { ok: false, error } sin romper', () => {
    const { e, casa } = escenario();
    const r = e.llamar('addMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: -1 });
    assert.strictEqual(r.ok, false);
    assert.match(r.error.message, /mayor que cero/);
    assert.strictEqual(e.llamar('voidMovimiento', 'nope').ok, false);
  });

  prueba('API: getBootstrap incluye los últimos movimientos', () => {
    const { e, casa } = escenario();
    e.llamar('addMovimiento', { Concepto: 'Uno', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1 });
    const d = e.llamar('getBootstrap').data;
    assert.strictEqual(d.ultimos.length, 1);
    assert.strictEqual(d.ultimos[0].Concepto, 'Uno');
  });

  // ---------------------------------------------------------------- rendimiento: una lectura por tabla y petición
  prueba('rendimiento: el arranque lee cada tabla una vez; con la caché tibia, casi nada', () => {
    const e = crearEntorno({}, { cache: true });
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase'); e.llamar('sembrarDatosDemo');

    let lecturas = {};
    Object.values(e.hojas).forEach(h => {
      const orig = h.getRange.bind(h);
      h.getRange = (...a) => {
        const r = orig(...a);
        return new Proxy(r, { get: (t, p) => (p === 'getValues' ? () => { lecturas[h.nombre] = (lecturas[h.nombre] || 0) + 1; return t.getValues(); } : t[p]) });
      };
    });
    const total = () => Object.values(lecturas).reduce((a, b) => a + b, 0);

    e.llamar('getBootstrap');
    const frio = total();
    // 1 lectura de encabezado (verificar el esquema) + 1 de datos por tabla, como máximo
    assert.deepStrictEqual(Object.keys(lecturas).filter(t => lecturas[t] > 2), [], 'tablas leídas de más: ' + JSON.stringify(lecturas));

    lecturas = {};
    e.llamar('getBootstrap');
    assert.ok(total() <= 16, 'lecturas con la caché tibia: ' + total() + ' ' + JSON.stringify(lecturas));
    assert.ok(frio > total(), 'la caché debe reducir las lecturas (' + frio + ' → ' + total() + ')');
  });

  prueba('rendimiento: una escritura invalida la lectura de su tabla dentro de la misma petición', () => {
    const { e, casa } = escenario();
    e.ctx.__id = casa.ID_Bolsillo;
    const r = e.ejecutar(`(function () {
      const antes = mapaSaldosBolsillos_()[__id];
      registrarMovimiento({ Concepto: 'x', ID_Bolsillo: __id, Valor: 1000 });
      return [antes, mapaSaldosBolsillos_()[__id]];
    })()`);
    assert.deepStrictEqual(plano(r), [1000000, 999000]);
  });

  prueba('fechas y fechas-hora se guardan como texto plano (sin conversión de Sheets)', () => {
    const e = E();
    const col = (t, h) => e.hojas[t].filas[0].indexOf(h) + 1;
    assert.strictEqual(e.hojas.Movimientos.formatos[col('Movimientos', 'Fecha')], '@');
    assert.strictEqual(e.hojas.Movimientos.formatos[col('Movimientos', 'Creado_En')], '@');
    assert.strictEqual(e.hojas.Cuentas.formatos[col('Cuentas', 'Fecha_Apertura')], '@');
    assert.strictEqual(e.hojas.Bancos.formatos[col('Bancos', 'Actualizado_En')], '@');
  });
};
