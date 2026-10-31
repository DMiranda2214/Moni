/**
 * Pruebas de la Fase 3: plantilla y presupuesto del mes, "real" calculado, distribución de la
 * nómina, y la calculadora de nómina con las cifras de referencia.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => new Date().toISOString().slice(0, 7);
  const diaHoy = () => new Date().toISOString().slice(0, 10);

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Logs.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  /** Cuenta con Nómina (bolsillo de llegada), Casa, Servicios y Ahorro (cuenta de ahorro sin bolsillos). */
  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const ahorroCta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 0 });
    const b = (n, s) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: n, Saldo_Apertura: s || 0 });
    const nomina = b('Nómina'), casa = b('Casa'), servicios = b('Servicios');
    const ahorro = e.llamar('listarCatalogo', 'Bolsillos').find(x => x.ID_Cuenta === ahorroCta.ID_Cuenta);
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    const renglon = (concepto, monto, tipo, destino) => e.llamar('guardarCatalogo', 'Presupuesto_Plantilla',
      { ID_Escenario: esc.ID_Escenario, Concepto: concepto, Monto_Plan: monto, Tipo: tipo || 'Gasto', ID_Bolsillo_Destino: destino && destino.ID_Bolsillo });
    return { e, banco, c1, nomina, casa, servicios, ahorro, esc, renglon };
  }

  function conPlantilla() {
    const x = escenario();
    x.renglon('Arriendo', 1400000, 'Gasto', x.casa);
    x.renglon('Mercado', 300000, 'Gasto', x.casa);
    x.renglon('Luz', 80000, 'Gasto', x.servicios);
    x.renglon('Ahorro mensual', 500000, 'Ahorro', x.ahorro);
    return x;
  }
  const saldo = (e, id) => e.llamar('mapaSaldosBolsillos_')[id];

  // ------------------------------------------------------------- plantilla
  prueba('plantilla: valida concepto único por escenario, monto y bolsillo para ahorro/fondo/cuota', () => {
    const { e, esc, casa } = escenario();
    const base = { ID_Escenario: esc.ID_Escenario, Concepto: 'Arriendo', Monto_Plan: 100, Tipo: 'Gasto' };
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', base);
    assert.throws(e.falla('guardarCatalogo', 'Presupuesto_Plantilla', base), /Ya hay un renglón/);
    assert.throws(e.falla('guardarCatalogo', 'Presupuesto_Plantilla', Object.assign({}, base, { Concepto: 'X', Monto_Plan: -1 })), /menor que 0/);
    assert.throws(e.falla('guardarCatalogo', 'Presupuesto_Plantilla', Object.assign({}, base, { Concepto: 'Y', Tipo: 'Ahorro' })), /necesita un bolsillo de destino/);
    assert.throws(e.falla('guardarCatalogo', 'Presupuesto_Plantilla', Object.assign({}, base, { Concepto: 'Z', ID_Escenario: 'nope' })), /escenario no existe/);
    assert.ok(e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', Object.assign({}, base, { Concepto: 'W', Tipo: 'Fondo', ID_Bolsillo_Destino: casa.ID_Bolsillo })).ID_Plantilla);
  });

  // ------------------------------------------------------------- generar el mes
  prueba('generar: copia la plantilla activa del escenario; no se duplica; sin renglones avisa', () => {
    const { e, esc } = conPlantilla();
    assert.throws(e.falla('generarPresupuestoMes', '26-1'), /formato/);
    const r = e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    assert.strictEqual(r.creados, 4);
    assert.throws(e.falla('generarPresupuestoMes', hoy(), esc.ID_Escenario), /ya existe/);
    const p = e.llamar('obtenerPresupuestoMes', hoy());
    assert.strictEqual(p.items.length, 4);
    assert.strictEqual(p.totales.plan, 2280000);
    assert.strictEqual(p.escenario.Nombre, 'Normal');

    const vacio = escenario().e;
    assert.throws(vacio.falla('generarPresupuestoMes', hoy()), /no tiene renglones/);
  });

  prueba('generar: reemplazar solo si ningún renglón tiene movimientos enlazados', () => {
    const { e, esc, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario, true);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).items.length, 4, 'se rehace sin duplicar');

    const item = e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Mercado');
    e.llamar('registrarMovimiento', { Concepto: 'Mercado', ID_Bolsillo: casa.ID_Bolsillo, Valor: 100, ID_Item_Ppto: item.ID_Item });
    assert.throws(e.falla('generarPresupuestoMes', hoy(), esc.ID_Escenario, true), /ya tienen movimientos/);
  });

  prueba('generar: la plantilla de otro escenario produce otro presupuesto (contingencia)', () => {
    const { e, esc, casa } = conPlantilla();
    const cont = e.llamar('guardarCatalogo', 'Escenarios', { Nombre: 'Contingencia' }, { copiarDe: esc.ID_Escenario });
    // en contingencia el arriendo baja y se quita el ahorro
    const filas = e.llamar('listarCatalogo', 'Presupuesto_Plantilla').filter(p => p.ID_Escenario === cont.ID_Escenario);
    assert.strictEqual(filas.length, 4);
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Plantilla: filas.find(f => f.Concepto === 'Arriendo').ID_Plantilla, Monto_Plan: 900000 });
    e.llamar('desactivarCatalogo', 'Presupuesto_Plantilla', filas.find(f => f.Concepto === 'Ahorro mensual').ID_Plantilla);
    e.llamar('generarPresupuestoMes', hoy(), cont.ID_Escenario);
    const p = e.llamar('obtenerPresupuestoMes', hoy());
    assert.strictEqual(p.escenario.Nombre, 'Contingencia');
    assert.strictEqual(p.totales.plan, 900000 + 300000 + 80000);
    assert.ok(casa);
  });

  // ------------------------------------------------------------- real calculado
  prueba('real: se calcula desde los movimientos enlazados; el ahorro cuenta solo si está pagado', () => {
    const { e, esc, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const luz = () => e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Luz');
    assert.strictEqual(luz().Real, 0);

    e.llamar('registrarMovimiento', { Concepto: 'Luz', ID_Bolsillo: casa.ID_Bolsillo, Valor: 62000, ID_Item_Ppto: luz().ID_Item });
    assert.strictEqual(luz().Real, 62000);
    assert.strictEqual(luz().Ahorro, 0, 'sin marcar pagado no hay ahorro');
    e.llamar('marcarRenglonPagado', luz().ID_Item, true);
    assert.strictEqual(luz().Ahorro, 18000);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).totales.ahorro, 18000);
  });

  prueba('real: un movimiento anulado deja de contar; el ajuste y el sobregasto se reflejan', () => {
    const { e, esc, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const it = e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Luz');
    const m = e.llamar('registrarMovimiento', { Concepto: 'Luz', ID_Bolsillo: casa.ID_Bolsillo, Valor: 95000, ID_Item_Ppto: it.ID_Item });
    e.llamar('marcarRenglonPagado', it.ID_Item, true);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Luz').Ahorro, -15000, 'sobregasto = ahorro negativo');
    e.llamar('anularMovimiento', m.ID_Mov);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Luz').Real, 0);
  });

  prueba('resumen: ingresos del mes, saldo y porcentaje de ahorro con el cálculo de referencia', () => {
    const { e, esc, casa, nomina } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Concepto: 'Nómina', ID_Bolsillo: nomina.ID_Bolsillo, Valor: 2877445 });
    const arr = e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Arriendo');
    e.llamar('registrarMovimiento', { Concepto: 'Arriendo', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1400000, ID_Item_Ppto: arr.ID_Item });
    const t = e.llamar('obtenerPresupuestoMes', hoy()).totales;
    assert.strictEqual(t.ingresos, 2877445);
    assert.strictEqual(t.real, 1400000);
    assert.strictEqual(t.saldo, 1477445, 'saldo = ingresos − gastos reales');
    assert.strictEqual(t.porcentajeAhorro, 0.513, 'saldo / ingresos');
  });

  prueba('renglones del mes: agregar uno no previsto, editar, quitar y reglas', () => {
    const { e, esc, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const nuevo = e.llamar('guardarRenglonMes', { Mes: hoy(), Concepto: 'Regalo', Plan: 50000, Tipo: 'Gasto' });
    assert.strictEqual(nuevo.Plan, 50000);
    assert.throws(e.falla('guardarRenglonMes', { Mes: hoy(), Concepto: 'regalo', Plan: 1 }), /Ya hay un renglón/);
    assert.throws(e.falla('guardarRenglonMes', { Mes: hoy(), Concepto: 'Meta', Plan: 1, Tipo: 'Fondo' }), /necesita un bolsillo/);
    e.llamar('guardarRenglonMes', { ID_Item: nuevo.ID_Item, Plan: 70000, ID_Bolsillo_Destino: casa.ID_Bolsillo });
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Regalo').Plan, 70000);

    e.llamar('registrarMovimiento', { Concepto: 'Regalo', ID_Bolsillo: casa.ID_Bolsillo, Valor: 10, ID_Item_Ppto: nuevo.ID_Item });
    assert.throws(e.falla('eliminarRenglonMes', nuevo.ID_Item), /movimiento\(s\) enlazado/);
    const otro = e.llamar('guardarRenglonMes', { Mes: hoy(), Concepto: 'Temporal', Plan: 5 });
    e.llamar('eliminarRenglonMes', otro.ID_Item);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', hoy()).items.some(i => i.Concepto === 'Temporal'), false);
  });

  prueba('un movimiento no puede enlazarse a un renglón que no existe', () => {
    const { e, casa } = conPlantilla();
    assert.throws(e.falla('registrarMovimiento', { Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 1, ID_Item_Ppto: 'nope' }), /renglón del presupuesto no existe/);
  });

  // ------------------------------------------------------------- distribución de nómina
  prueba('distribución: agrupa los gastos por bolsillo y enlaza ahorro/fondo/cuota uno a uno', () => {
    const { e, esc, nomina, casa, servicios, ahorro } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Concepto: 'Nómina', ID_Bolsillo: nomina.ID_Bolsillo, Valor: 3000000 });

    const prev = e.llamar('previsualizarDistribucion', hoy(), nomina.ID_Bolsillo);
    assert.strictEqual(prev.lineas.length, 3);
    const porDestino = n => prev.lineas.find(l => l.Destino === n);
    assert.strictEqual(porDestino('Casa').Monto, 1700000, 'arriendo + mercado en un solo traslado');
    assert.strictEqual(porDestino('Servicios').Monto, 80000);
    assert.strictEqual(prev.lineas.find(l => l.ID_Item).Monto, 500000);
    assert.strictEqual(prev.total, 2280000);
    assert.strictEqual(prev.yaDistribuido, false);

    const r = e.llamar('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy());
    assert.strictEqual(r.traslados, 3);
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 3000000 - 2280000);
    assert.strictEqual(saldo(e, casa.ID_Bolsillo), 1700000);
    assert.strictEqual(saldo(e, servicios.ID_Bolsillo), 80000);
    assert.strictEqual(saldo(e, ahorro.ID_Bolsillo), 500000);
    assert.strictEqual(e.llamar('obtenerSaldos').total, 3000000, 'repartir no cambia el total');

    // el traslado de ahorro cuenta como el "real" de su renglón; el de gastos, no
    const p = e.llamar('obtenerPresupuestoMes', hoy());
    assert.strictEqual(p.items.find(i => i.Concepto === 'Ahorro mensual').Real, 500000);
    assert.strictEqual(p.items.find(i => i.Concepto === 'Arriendo').Real, 0);
  });

  prueba('distribución: no se repite por error y no mueve lo que ya está en el bolsillo de origen', () => {
    const { e, esc, nomina, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    e.llamar('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy());
    assert.strictEqual(e.llamar('previsualizarDistribucion', hoy(), nomina.ID_Bolsillo).yaDistribuido, true);
    assert.throws(e.falla('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy()), /ya se distribuyó/);
    assert.strictEqual(e.llamar('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy(), true).traslados, 3, 'con confirmación sí');

    // si el origen es Casa, lo destinado a Casa no se traslada
    const p = e.llamar('previsualizarDistribucion', hoy(), casa.ID_Bolsillo);
    assert.strictEqual(p.lineas.some(l => l.Destino === 'Casa'), false);
  });

  prueba('distribución: sin renglones con destino distinto avisa; anular un traslado lo saca de "ya distribuido"', () => {
    const { e, esc, nomina } = conPlantilla();
    assert.throws(e.falla('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy()), /nada que distribuir/);
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const r = e.llamar('distribuirNomina', hoy(), nomina.ID_Bolsillo, diaHoy());
    r.ids.forEach(id => e.llamar('anularMovimiento', id));
    assert.strictEqual(e.llamar('previsualizarDistribucion', hoy(), nomina.ID_Bolsillo).yaDistribuido, false);
  });

  // ------------------------------------------------------------- nómina (cifras de referencia)
  const PARAMS = { aporteSalud: 0.04, aportePension: 0.04, redondeo: -2, smmlv: 1423500, fspUmbral: 4, tasaCesantias: 0.12 };

  prueba('nómina: salud y pensión (4 % sobre 3.127.845 → 125.200 c/u, total 250.400)', () => {
    const e = E();
    e.ctx.__p = PARAMS;
    const c = plano(e.ejecutar('calcularNomina_(__p, 3127845, [], "2027-03")'));
    assert.deepStrictEqual(c.deducciones.map(d => d.valor), [125200, 125200]);
    assert.strictEqual(c.totales.deducciones, 250400);
    assert.strictEqual(c.totales.neto, 2877445, 'neto de un mes normal');
    assert.strictEqual(c.totales.extras, 0);
  });

  prueba('nómina: la prima de diciembre da el neto con prima (4.441.367,50)', () => {
    const e = E();
    e.ctx.__p = PARAMS;
    const dic = plano(e.ejecutar('calcularNomina_(__p, 3127845, [], "2027-12")'));
    assert.strictEqual(dic.extras[0].valor, 1563922.5);
    assert.strictEqual(dic.totales.neto, 4441367.5);
    const jun = plano(e.ejecutar('calcularNomina_(__p, 3127845, [], "2027-06")'));
    assert.strictEqual(jun.totales.neto, 4441367.5, 'junio también paga prima');
    const ene = plano(e.ejecutar('calcularNomina_(__p, 3127845, [], "2027-01")'));
    assert.strictEqual(ene.extras[0].valor, 375341.4, 'intereses de cesantías (año completo)');
  });

  prueba('nómina: los subsidios suman al devengado; solo los salariales entran al IBC', () => {
    const e = E();
    e.ctx.__p = PARAMS;
    e.ctx.__s = [{ Nombre: 'Remoto', Valor: 200000, Es_Salarial: false }, { Nombre: 'Bono salarial', Valor: 100000, Es_Salarial: true }];
    const c = plano(e.ejecutar('calcularNomina_(__p, 3127845, __s, "2027-03")'));
    assert.strictEqual(c.ibc, 3227845);
    assert.strictEqual(c.totales.devengado, 3427845);
    assert.strictEqual(c.deducciones[0].valor, 129200, 'salud sobre el IBC con subsidio salarial: 129.113,80 → 129.200');
    assert.strictEqual(c.totales.neto, 3427845 - 258400);
  });

  prueba('nómina: el Fondo de Solidaridad aparece desde 4 SMMLV', () => {
    const e = E();
    e.ctx.__p = PARAMS;
    const bajo = plano(e.ejecutar('calcularNomina_(__p, 5000000, [], "2027-03")'));
    assert.strictEqual(bajo.deducciones.length, 2);
    const alto = plano(e.ejecutar('calcularNomina_(__p, 6000000, [], "2027-03")'));
    assert.strictEqual(alto.deducciones.length, 3);
    assert.strictEqual(alto.deducciones[2].valor, 60000);
  });

  prueba('nómina: escenarios con subsidios, comparación y vigencia de los subsidios', () => {
    const { e } = escenario();
    const remoto = e.llamar('guardarCatalogo', 'Subsidios', { Nombre: 'Trabajo remoto', Valor: 200000, Es_Salarial: false });
    const viejo = e.llamar('guardarCatalogo', 'Subsidios', { Nombre: 'Bono viejo', Valor: 100000, Vigente_Hasta: '2020-12-31' });
    const a = e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 3127845, Vigente: true }, { subsidios: [remoto.ID_Subsidio, viejo.ID_Subsidio] });
    const aumento = e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Aumento', Sueldo_Base: 4500000 }, { subsidios: [remoto.ID_Subsidio] });

    const n = e.llamar('obtenerNominaMes', '2027-03');
    assert.strictEqual(n.calculo.escenario.Nombre, 'Actual');
    assert.strictEqual(n.calculo.devengos.length, 2, 'el subsidio vencido no cuenta');
    assert.strictEqual(n.calculo.totales.neto, 3127845 + 200000 - 250400);
    assert.strictEqual(n.comparacion.length, 2);
    assert.ok(n.comparacion[1].neto > n.comparacion[0].neto);

    assert.throws(e.falla('desactivarCatalogo', 'Subsidios', remoto.ID_Subsidio), /escenario\(s\) de nómina/);
    assert.throws(e.falla('guardarCatalogo', 'Nomina_Escenarios', { ID_Nomina_Esc: a.ID_Nomina_Esc, Vigente: false }), /escenario vigente/);
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { ID_Nomina_Esc: a.ID_Nomina_Esc }, { subsidios: [] });
    assert.strictEqual(e.llamar('obtenerNominaMes', '2027-03', a.ID_Nomina_Esc).calculo.devengos.length, 1, 'quitar subsidios del escenario');
    assert.throws(e.falla('desactivarCatalogo', 'Subsidios', remoto.ID_Subsidio), /escenario\(s\) de nómina/, 'aún lo usa el otro escenario');
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { ID_Nomina_Esc: aumento.ID_Nomina_Esc }, { subsidios: [] });
    assert.strictEqual(e.llamar('desactivarCatalogo', 'Subsidios', remoto.ID_Subsidio).Activo, false);
  });

  prueba('nómina: sin escenarios avisa con un mensaje claro', () => {
    const { e } = escenario();
    const n = e.llamar('obtenerNominaMes', '2027-03');
    assert.strictEqual(n.calculo, null);
    assert.match(n.error, /Aún no hay escenarios de nómina/);
  });

  prueba('nómina: registrar el pago crea el ingreso, guarda el detalle y no se repite', () => {
    const { e, nomina } = escenario();
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 3127845, Vigente: true });
    const r = e.llamar('registrarPagoNomina', hoy(), undefined, '', diaHoy(), nomina.ID_Bolsillo);
    assert.strictEqual(r.neto, 2877445, 'sin neto indicado usa el estimado');
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 2877445);
    const mov = e.llamar('listarMovimientos', {}).items[0];
    assert.strictEqual(mov.Subtipo, 'Nomina');
    assert.strictEqual(mov.Concepto, 'Nómina ' + hoy());
    assert.strictEqual(mov.Categoria, 'Salario / nómina');
    assert.strictEqual(e.llamar('listarCatalogo', 'Categorias').length, 15);
    const det = e.hojas.Nomina_Pagos_Detalle.filas.slice(1).filter(f => f[0]);
    assert.strictEqual(det.length, 3, 'sueldo + salud + pensión');

    assert.throws(e.falla('registrarPagoNomina', hoy(), undefined, 3000000, diaHoy(), nomina.ID_Bolsillo), /ya está registrada/);
    const n = e.llamar('obtenerNominaMes', hoy());
    assert.strictEqual(n.pago.Estado, 'Recibido');
    assert.strictEqual(n.pago.Neto_Real, 2877445);
  });

  prueba('nómina: el neto real puede diferir del estimado; anular libera el mes', () => {
    const { e, nomina } = escenario();
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 3127845, Vigente: true });
    e.llamar('registrarPagoNomina', hoy(), undefined, 3700000, diaHoy(), nomina.ID_Bolsillo);
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 3700000);
    e.llamar('anularPagoNomina', hoy());
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 0);
    assert.strictEqual(e.llamar('obtenerNominaMes', hoy()).pago, null);
    e.llamar('registrarPagoNomina', hoy(), undefined, 2877445, diaHoy(), nomina.ID_Bolsillo);
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 2877445);
    assert.throws(e.falla('anularPagoNomina', '2000-01'), /No hay una nómina/);
  });

  prueba('parámetros de nómina: se validan como números y los porcentajes como decimales', () => {
    const e = E();
    assert.strictEqual(e.llamar('saveConfigParam', 'SMMLV', '1.750.905').ok, false);
    assert.strictEqual(e.llamar('saveConfigParam', 'SMMLV', '1750905').data.valor, '1750905');
    assert.strictEqual(e.llamar('saveConfigParam', 'Aporte_Salud', '4').ok, false);
    assert.strictEqual(e.llamar('saveConfigParam', 'Aporte_Salud', '0,04').data.valor, '0.04');
    assert.strictEqual(e.llamar('saveConfigParam', 'SMMLV', 'abc').ok, false);
  });

  // ------------------------------------------------------------- API
  prueba('API: el presupuesto y la nómina se entregan completos y las escrituras devuelven la pantalla', () => {
    const { e, esc, nomina } = conPlantilla();
    const g = e.llamar('generarPresupuesto', hoy(), esc.ID_Escenario);
    assert.strictEqual(g.ok, true);
    assert.strictEqual(g.data.items.length, 4);
    const it = g.data.items[0];
    const p = e.llamar('payRenglonMes', it.ID_Item, true);
    assert.strictEqual(p.data.items.find(i => i.ID_Item === it.ID_Item).Pagado, true);
    assert.strictEqual(e.llamar('saveRenglonMes', { Mes: hoy(), Concepto: 'Extra', Plan: 10 }).data.items.length, 5);

    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 3127845, Vigente: true });
    const r = e.llamar('registrarNomina', hoy(), '', '', diaHoy(), nomina.ID_Bolsillo);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.nomina.pago.Estado, 'Recibido');
    assert.strictEqual(r.data.saldos.bolsillos[nomina.ID_Bolsillo], 2877445);
    assert.strictEqual(r.data.items.length, 1);

    const d = e.llamar('distribuir', hoy(), nomina.ID_Bolsillo, diaHoy());
    assert.strictEqual(d.ok, true);
    assert.strictEqual(d.data.distribucion.traslados, 3);
    assert.strictEqual(d.data.presupuesto.items.find(i => i.Concepto === 'Ahorro mensual').Real, 500000);
    assert.strictEqual(e.llamar('distribuir', hoy(), nomina.ID_Bolsillo, diaHoy()).ok, false);
  });

  prueba('API: getBootstrap incluye plantilla, subsidios, escenarios de nómina con sus subsidios y los renglones del mes', () => {
    const { e, esc } = conPlantilla();
    const s = e.llamar('guardarCatalogo', 'Subsidios', { Nombre: 'Remoto', Valor: 1 });
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 100, Vigente: true }, { subsidios: [s.ID_Subsidio] });
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const d = e.llamar('getBootstrap').data;
    assert.strictEqual(d.catalogos.Presupuesto_Plantilla.length, 4);
    assert.strictEqual(d.catalogos.Subsidios.length, 1);
    assert.deepStrictEqual(d.catalogos.Nomina_Escenarios[0].subsidios, [s.ID_Subsidio]);
    assert.strictEqual(d.renglones.length, 4);
  });
  prueba('API: un movimiento enlazado devuelve el presupuesto actualizado; anular varios de una vez', () => {
    const { e, esc, nomina, casa } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const it = e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Luz');
    const r = e.llamar('addMovimiento', { Concepto: 'Luz', ID_Bolsillo: casa.ID_Bolsillo, Valor: 70000, ID_Item_Ppto: it.ID_Item });
    assert.strictEqual(r.data.presupuesto.items.find(i => i.Concepto === 'Luz').Real, 70000);
    const sin = e.llamar('addMovimiento', { Concepto: 'Suelto', ID_Bolsillo: casa.ID_Bolsillo, Valor: 5 });
    assert.strictEqual(sin.data.presupuesto, undefined, 'sin renglón no hay presupuesto en la respuesta');

    e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Concepto: 'Nómina', ID_Bolsillo: nomina.ID_Bolsillo, Valor: 3000000 });
    const d = e.llamar('distribuir', hoy(), nomina.ID_Bolsillo, diaHoy());
    const antes = e.llamar('obtenerSaldos').total;
    const v = e.llamar('voidVarios', d.data.ids || e.llamar('listarMovimientos', { limite: 20 }).items.filter(i => i.Subtipo === 'Distribucion').map(i => i.ID_Mov));
    assert.strictEqual(v.ok, true);
    assert.strictEqual(saldo(e, nomina.ID_Bolsillo), 3000000, 'todo vuelve al bolsillo de origen');
    assert.strictEqual(e.llamar('obtenerSaldos').total, antes);
  });

  prueba('API: la traslado puede enlazarse a un renglón de ahorro y cuenta como su real', () => {
    const { e, esc, casa, ahorro } = conPlantilla();
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const it = e.llamar('obtenerPresupuestoMes', hoy()).items.find(i => i.Concepto === 'Ahorro mensual');
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Concepto: 'x', ID_Bolsillo: casa.ID_Bolsillo, Valor: 800000 });
    const r = e.llamar('addTransferencia', { origen: casa.ID_Bolsillo, destino: ahorro.ID_Bolsillo, valor: 300000, itemPpto: it.ID_Item });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.presupuesto.items.find(i => i.Concepto === 'Ahorro mensual').Real, 300000);
  });

  prueba('parámetros en lote: si uno falla no se guarda ninguno', () => {
    const e = E();
    const mal = e.llamar('saveConfigParams', { SMMLV: '1750905', Aporte_Salud: '4' });
    assert.strictEqual(mal.ok, false);
    assert.strictEqual(e.llamar('getTableData', 'Config').find(c => c.Clave === 'SMMLV').Valor, '1423500', 'SMMLV sin cambios');
    const bien = e.llamar('saveConfigParams', { SMMLV: '1750905', Aporte_Salud: '0,04' });
    assert.strictEqual(bien.ok, true);
    assert.strictEqual(e.llamar('getTableData', 'Config').find(c => c.Clave === 'SMMLV').Valor, '1750905');
  });

  prueba('API: el arranque trae el resumen del presupuesto del mes', () => {
    const { e, esc } = conPlantilla();
    assert.strictEqual(e.llamar('getBootstrap').data.ppto.existe, false);
    e.llamar('generarPresupuestoMes', hoy(), esc.ID_Escenario);
    const d = e.llamar('getBootstrap').data;
    assert.strictEqual(d.ppto.existe, true);
    assert.strictEqual(d.ppto.totales.plan, 2280000);
  });
  prueba('demo: lo que se genera sobre los datos demo (presupuesto, nómina, movimientos) se limpia con ellos', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const mes = hoy();
    e.llamar('generarPresupuestoMes', mes);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', mes).items.length, 7, 'plantilla demo');
    e.llamar('registrarPagoNomina', mes, undefined, '', diaHoy(), 'demo-bol-casa');
    e.llamar('registrarMovimiento', { Concepto: 'Prueba', ID_Bolsillo: 'demo-bol-ocio', Valor: 10 });
    e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco real' });

    const r = e.llamar('limpiarDatosDemo');
    assert.ok(r.eliminadas.Presupuesto_Mes === 7 && r.eliminadas.Nomina_Pagos === 1 && r.eliminadas.Nomina_Pagos_Detalle >= 3, JSON.stringify(r.eliminadas));
    ['Presupuesto_Plantilla', 'Presupuesto_Mes', 'Nomina_Escenarios', 'Nomina_Conceptos', 'Nomina_Pagos', 'Nomina_Pagos_Detalle', 'Movimientos', 'Subsidios'].forEach(t => {
      assert.strictEqual(e.hojas[t].filas.slice(1).filter(f => f.some(c => c !== '' && c !== undefined)).length, 0, t + ' debe quedar vacía');
    });
    assert.deepStrictEqual(e.llamar('listarCatalogo', 'Bancos').map(b => b.Nombre), ['Banco real'], 'lo real se conserva');
    assert.strictEqual(e.llamar('listarCatalogo', 'Escenarios').length, 1, 'el escenario base no es demo');
  });
};
