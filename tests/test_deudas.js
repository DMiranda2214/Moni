/**
 * Pruebas de la Fase 4: compras y extractos de tarjetas, y créditos de autopago
 * (amortización francesa, pagos, abonos con recálculo de plazo, anulaciones).
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const mesDe = f => f.slice(0, 7);
  const hace = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Logs.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  /** Principal (Casa, Servicios, Personal, Reserva Visa) + Ahorros (sin bolsillos) + una tarjeta Visa con corte 15 y pago 28. */
  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const ahorroCta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 5000000 });
    const b = (n, s, rol) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: n, Saldo_Apertura: s || 0, Rol: rol || 'Operativo' });
    const casa = b('Casa', 1000000), servicios = b('Servicios', 200000), personal = b('Personal', 500000), pagos = b('Para cuotas', 600000);
    const ahorro = e.llamar('listarCatalogo', 'Bolsillos').find(x => x.ID_Cuenta === ahorroCta.ID_Cuenta);
    const t = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Visa', Cupo: 2000000, Dia_Corte: 15, Dia_Pago: 28, ID_Bolsillo_Personal: personal.ID_Bolsillo },
      { crearReserva: { ID_Cuenta: c1.ID_Cuenta } });
    const reserva = e.llamar('listarCatalogo', 'Bolsillos').find(x => x.ID_Bolsillo === t.ID_Bolsillo_Reserva);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, banco, c1, ahorroCta, casa, servicios, personal, pagos, ahorro, t, reserva, saldo };
  }
  const compra = (x, extra) => x.e.llamar('registrarCompraTC', Object.assign({ ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'Compra', Valor: 100000, Fecha: hoy() }, extra || {}));

  // ============================================================= tarjetas
  prueba('extracto: el mes depende del día de corte (después del corte pasa al siguiente)', () => {
    const e = E();
    const f = (fecha, corte) => e.llamar('calcularMesExtracto_', fecha, corte);
    assert.strictEqual(f('2026-10-14', 15), '2026-10');
    assert.strictEqual(f('2026-10-15', 15), '2026-10', 'el día de corte aún entra');
    assert.strictEqual(f('2026-10-16', 15), '2026-11');
    assert.strictEqual(f('2026-12-20', 15), '2027-01', 'cambia de año');
  });

  prueba('fechas: próximo día del mes, con meses cortos', () => {
    const e = E();
    const f = (dia, desde) => e.llamar('proximoDiaDelMes_', dia, desde);
    assert.strictEqual(f(28, '2026-10-10'), '2026-10-28');
    assert.strictEqual(f(5, '2026-10-10'), '2026-11-05');
    assert.strictEqual(f(31, '2026-02-10'), '2026-02-28');
    assert.strictEqual(f(15, '2026-12-20'), '2027-01-15');
  });

  prueba('compra Personal: no mueve dinero; aparece en el extracto y en el cupo', () => {
    const x = escenario();
    const antes = x.e.llamar('obtenerSaldos').total;
    const c = compra(x, { Concepto: 'Ropa', Valor: 250000, Fuente: 'Personal' });
    assert.strictEqual(c.ID_Mov_Reserva, '');
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, antes);
    const v = x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, c.Mes_Extracto);
    assert.strictEqual(v.totales.total, 250000);
    assert.strictEqual(v.totales.faltaParaPagar, 250000);
    assert.strictEqual(v.cupo.disponible, 1750000);
    assert.strictEqual(v.compras[0].Concepto, 'Ropa');
  });

  prueba('compra Ppto: aparta el dinero en la reserva desde el bolsillo del renglón y cuenta como su real', () => {
    const x = escenario();
    const esc = x.e.llamar('listarCatalogo', 'Escenarios')[0];
    x.e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Suscripciones', Monto_Plan: 60000, Tipo: 'Gasto', ID_Bolsillo_Destino: x.servicios.ID_Bolsillo });
    x.e.llamar('generarPresupuestoMes', mesDe(hoy()), esc.ID_Escenario);
    const item = x.e.llamar('obtenerPresupuestoMes', mesDe(hoy())).items[0];

    const c = compra(x, { Concepto: 'Netflix', Valor: 29900, Fuente: 'Ppto', ID_Item_Ppto: item.ID_Item });
    assert.ok(c.ID_Mov_Reserva);
    assert.strictEqual(x.saldo(x.servicios.ID_Bolsillo), 200000 - 29900);
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 29900);
    assert.strictEqual(x.e.llamar('obtenerPresupuestoMes', mesDe(hoy())).items[0].Real, 29900);
    assert.strictEqual(x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, c.Mes_Extracto).totales.faltaParaPagar, 0, 'ya está apartado');

    // anular la compra devuelve el dinero
    x.e.llamar('anularCompraTC', c.ID_Compra);
    assert.strictEqual(x.saldo(x.servicios.ID_Bolsillo), 200000);
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 0);
    assert.strictEqual(x.e.llamar('obtenerPresupuestoMes', mesDe(hoy())).items[0].Real, 0);
    x.e.llamar('restaurarCompraTC', c.ID_Compra);
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 29900);
  });

  prueba('compra Guardar: aparta desde el bolsillo personal; Ppto y Guardar exigen un origen', () => {
    const x = escenario();
    compra(x, { Concepto: 'Cena', Valor: 80000, Fuente: 'Guardar' });
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 420000);
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 80000);
    assert.throws(x.e.falla('registrarCompraTC', { ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'x', Valor: 1, Fuente: 'Ppto' }), /de qué bolsillo sale/);
    const sinPersonal = x.e.llamar('guardarCatalogo', 'Tarjetas', { ID_Tarjeta: x.t.ID_Tarjeta, ID_Bolsillo_Personal: '' });
    assert.strictEqual(sinPersonal.ID_Bolsillo_Personal, '');
    assert.throws(x.e.falla('registrarCompraTC', { ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'x', Valor: 1, Fuente: 'Guardar' }), /Elige de qué bolsillo apartas/);
    // con un origen explícito sí funciona
    assert.ok(compra(x, { Fuente: 'Guardar', ID_Bolsillo_Origen: x.casa.ID_Bolsillo, Valor: 5 }).ID_Mov_Reserva);
  });

  prueba('compra: valida valor, concepto, tarjeta, fuente y fecha', () => {
    const x = escenario();
    const f = m => x.e.falla('registrarCompraTC', Object.assign({ ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'x', Valor: 1 }, m));
    assert.throws(f({ Valor: 0 }), /mayor que cero/);
    assert.throws(f({ Concepto: ' ' }), /concepto es obligatorio/);
    assert.throws(f({ ID_Tarjeta: 'no' }), /tarjeta no existe/);
    assert.throws(f({ Fuente: 'Rara' }), /fuente no es válido/);
    assert.throws(f({ Fecha: '2999-01-01' }), /futura/);
    assert.throws(f({ Mes_Extracto: '26-1' }), /formato/);
  });

  prueba('pagar extracto: completa la reserva desde el bolsillo personal, paga y marca las compras', () => {
    const x = escenario();
    const m = compra(x, { Concepto: 'Cena', Valor: 100000, Fuente: 'Guardar' }).Mes_Extracto; // ya apartado 100.000
    compra(x, { Concepto: 'Ropa', Valor: 250000, Fuente: 'Personal' });
    const totalAntes = x.e.llamar('obtenerSaldos').total;

    const r = x.e.llamar('pagarExtracto', x.t.ID_Tarjeta, m, hoy());
    assert.strictEqual(r.total, 350000);
    assert.strictEqual(r.falta, 250000, 'lo que faltaba en la reserva');
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 0, 'la reserva queda en cero');
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 500000 - 100000 - 250000);
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, totalAntes - 350000, 'el dinero sale de verdad por el valor del extracto');

    const v = x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, m);
    assert.strictEqual(v.extracto.Total, 350000);
    assert.ok(v.compras.every(c => c.Pagado));
    assert.strictEqual(v.cupo.usado, 0);
    const pago = x.e.llamar('listarMovimientos', {}).items.find(i => i.Subtipo === 'Pago_TC');
    assert.strictEqual(pago.Valor, -350000);
    assert.throws(x.e.falla('pagarExtracto', x.t.ID_Tarjeta, m, hoy()), /ya está pagado/);
    assert.throws(x.e.falla('registrarCompraTC', { ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'x', Valor: 1, Mes_Extracto: m }), /ya está pagado/);
  });

  prueba('pagar extracto: si la reserva ya alcanza no toca el bolsillo personal; el sobrante se queda', () => {
    const x = escenario();
    x.e.llamar('registrarTransferencia', x.casa.ID_Bolsillo, x.reserva.ID_Bolsillo, 500000);
    const c = compra(x, { Valor: 300000, Fuente: 'Personal' });
    const r = x.e.llamar('pagarExtracto', x.t.ID_Tarjeta, c.Mes_Extracto, hoy());
    assert.strictEqual(r.falta, 0);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 500000);
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 200000, 'sobrante en la reserva');
  });

  prueba('pagar extracto: sin compras o sin dinero para completar avisa con claridad', () => {
    const x = escenario();
    assert.throws(x.e.falla('pagarExtracto', x.t.ID_Tarjeta, mesDe(hoy()), hoy()), /no tiene compras/);
    const c = compra(x, { Valor: 100000 });
    x.e.llamar('guardarCatalogo', 'Tarjetas', { ID_Tarjeta: x.t.ID_Tarjeta, ID_Bolsillo_Personal: '' });
    assert.throws(x.e.falla('pagarExtracto', x.t.ID_Tarjeta, c.Mes_Extracto, hoy()), /le faltan \$ 100\.000/);
  });

  prueba('pagar extracto es atómico: si algo falla a medias, no queda nada a medias', () => {
    const x = escenario();
    const c = compra(x, { Valor: 100000 });
    const total = x.e.llamar('obtenerSaldos').total;
    x.e.ejecutar("globalThis.__orig = registrarMovimiento; registrarMovimiento = function () { throw new Error('falla simulada'); };");
    assert.throws(x.e.falla('pagarExtracto', x.t.ID_Tarjeta, c.Mes_Extracto, hoy()), /falla simulada/);
    x.e.ejecutar('registrarMovimiento = globalThis.__orig;');
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, total);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 500000, 'el traslado de completar se deshizo');
    assert.strictEqual(x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, c.Mes_Extracto).extracto, null);
    assert.strictEqual(x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, c.Mes_Extracto).compras[0].Pagado, false);
    // y se puede volver a intentar
    assert.strictEqual(x.e.llamar('pagarExtracto', x.t.ID_Tarjeta, c.Mes_Extracto, hoy()).total, 100000);
  });

  prueba('anular el pago de un extracto devuelve todo y libera las compras', () => {
    const x = escenario();
    const m = compra(x, { Valor: 100000, Fuente: 'Guardar' }).Mes_Extracto;
    compra(x, { Valor: 250000 });
    const total = x.e.llamar('obtenerSaldos').total;
    const r = x.e.llamar('pagarExtracto', x.t.ID_Tarjeta, m, hoy());
    assert.throws(x.e.falla('anularCompraTC', x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, m).compras[0].ID_Compra), /ya está en un extracto pagado/);

    x.e.llamar('anularPagoExtracto', r.idExtracto);
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, total);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 400000, 'solo queda lo apartado por la compra Guardar');
    assert.strictEqual(x.saldo(x.reserva.ID_Bolsillo), 100000);
    const v = x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta, m);
    assert.strictEqual(v.extracto, null);
    assert.ok(v.compras.every(c => !c.Pagado));
    assert.throws(x.e.falla('anularPagoExtracto', r.idExtracto), /No hay un pago/);
    assert.strictEqual(x.e.llamar('pagarExtracto', x.t.ID_Tarjeta, m, hoy()).total, 350000, 'se puede pagar de nuevo');
  });

  prueba('tarjeta: meses con compras, cupo disponible y resumen para Deudas', () => {
    const x = escenario();
    compra(x, { Valor: 100000, Fecha: hace(40) });
    compra(x, { Valor: 50000 });
    const v = x.e.llamar('obtenerTarjeta', x.t.ID_Tarjeta);
    assert.ok(v.meses.length >= 2);
    assert.strictEqual(v.mes, v.mesActual);
    assert.strictEqual(v.cupo.usado, 150000);
    assert.strictEqual(v.proximoPago.slice(8), '28');
    const r = x.e.llamar('resumenTarjetas_');
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].cupoDisponible, 1850000);
    assert.ok(r[0].faltaParaPagar >= 0);
  });

  // ============================================================= créditos
  prueba('crédito: la tasa y la cuota reproducen las cuotas de referencia', () => {
    const e = E();
    assert.strictEqual(Number(e.llamar('tasaDesdeEA_', 0.10, 'Quincenal', 'Excel').toFixed(9)), 0.004067404);
    assert.ok(e.llamar('tasaDesdeEA_', 0.10, 'Quincenal', 'Exacta') < 0.004);
    assert.strictEqual(e.llamar('cuotaFrancesa_', 2400000, 0.004067404, 48), 55140.9, 'quincenal a 48 cuotas');
    assert.strictEqual(e.llamar('cuotaFrancesa_', 1000000, 0.008333333, 12), 87915.89, 'mensual a 12 cuotas');
    assert.strictEqual(e.llamar('cuotaFrancesa_', 500000, 0.01, 10), 52791.04, 'mensual a 10 cuotas');
    assert.strictEqual(e.llamar('cuotaFrancesa_', 1200, 0, 12), 100, 'sin interés');
  });

  prueba('crédito: fechas de las cuotas (mensual y quincenal como el Excel)', () => {
    const e = E();
    const q = n => e.llamar('fechaCuota_', '2023-06-12', 'Quincenal', n);
    assert.deepStrictEqual([1, 2, 3, 4].map(q), ['2023-06-15', '2023-06-30', '2023-07-15', '2023-07-31']);
    assert.deepStrictEqual([1, 2, 3].map(n => e.llamar('fechaCuota_', '2026-01-31', 'Mensual', n)), ['2026-02-28', '2026-03-31', '2026-04-30']);
    assert.strictEqual(e.llamar('fechaCuota_', '2026-11-15', 'Mensual', 2), '2027-01-15');
  });

  /** Crédito de ejemplo: 1.200.000 a 12 cuotas mensuales con tasa 1 % por periodo. */
  function credito(x, extra) {
    return x.e.llamar('registrarCredito', Object.assign({ Nombre: 'Crédito B', ID_Cuenta_Ahorro: x.ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: x.pagos.ID_Bolsillo,
      Fecha_Inicio: hace(3), Monto: 1200000, Periodicidad: 'Mensual', Num_Periodos: 12, Tasa_Periodica: 0.01 }, extra || {}));
  }

  prueba('crédito: el cronograma cierra en cero, suma el monto en capital y tiene intereses sobre saldo', () => {
    const x = escenario();
    const r = credito(x);
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.cronograma.length, 12);
    assert.strictEqual(d.cronograma[0].Interes, 12000, '1 % de 1.200.000');
    assert.strictEqual(d.cronograma[0].Saldo_Inicial, 1200000);
    assert.strictEqual(d.cronograma[11].Saldo_Final, 0);
    const capital = d.cronograma.reduce((a, f) => a + f.Capital, 0);
    assert.ok(Math.abs(capital - 1200000) < 0.005, 'capital total = monto');
    d.cronograma.forEach((f, i) => { if (i) assert.strictEqual(f.Saldo_Inicial, d.cronograma[i - 1].Saldo_Final); });
    assert.strictEqual(d.credito.saldo, 1200000);
    assert.strictEqual(d.credito.cuotasPagadas, 0);
  });

  prueba('crédito: el desembolso sale del ahorro (Para_Gastos) y se puede omitir', () => {
    const x = escenario();
    const ahorroAntes = x.saldo(x.ahorro.ID_Bolsillo);
    credito(x);
    assert.strictEqual(x.saldo(x.ahorro.ID_Bolsillo), ahorroAntes - 1200000);
    const mov = x.e.llamar('listarMovimientos', {}).items.find(i => i.Subtipo === 'Para_Gastos');
    assert.strictEqual(mov.Concepto, 'Préstamo: Crédito B');
    const sin = credito(x, { Nombre: 'Otro', desembolsar: false });
    assert.strictEqual(x.saldo(x.ahorro.ID_Bolsillo), ahorroAntes - 1200000, 'sin desembolso no se mueve el ahorro');
    assert.ok(sin.idCredito);
  });

  prueba('crédito: valida los datos y que el dinero salga de una cuenta de ahorro', () => {
    const x = escenario();
    const f = m => x.e.falla('registrarCredito', Object.assign({ Nombre: 'X', ID_Cuenta_Ahorro: x.ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: x.pagos.ID_Bolsillo, Fecha_Inicio: hoy(), Monto: 1000, Num_Periodos: 4, Tasa_Periodica: 0.01 }, m));
    assert.throws(f({ ID_Cuenta_Ahorro: x.c1.ID_Cuenta }), /de tipo Ahorro/);
    assert.throws(f({ Monto: 0 }), /menor que 0,01|menor que 0.01/);
    assert.throws(f({ Num_Periodos: 0 }), /menor que 1/);
    assert.throws(f({ Num_Periodos: 2.5 }), /entero/);
    assert.throws(f({ Nombre: '' }), /nombre es obligatorio/);
    assert.throws(f({ ID_Bolsillo_Pago: 'no' }), /bolsillo/);
    assert.throws(f({ Fecha_Inicio: '2999-01-01' }), /futura/);
    credito(x);
    assert.throws(f({ Nombre: 'crédito b' }), /Ya hay un crédito activo/);
  });

  prueba('crédito: la vista previa calcula la cuota con EA y no escribe nada', () => {
    const x = escenario();
    const total = x.e.llamar('obtenerSaldos').total;
    const p = x.e.llamar('previsualizarCredito', { Nombre: 'Crédito A', ID_Cuenta_Ahorro: x.ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: x.pagos.ID_Bolsillo, Fecha_Inicio: hoy(), Monto: 2400000, Periodicidad: 'Quincenal', Num_Periodos: 48, EA: 0.10 });
    assert.strictEqual(p.cuota, 55140.9);
    assert.strictEqual(p.cuotas, 48);
    assert.ok(p.interesTotal > 240000 && p.interesTotal < 260000);
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, total);
    assert.strictEqual(x.e.llamar('listarCreditos').length, 0);
  });

  prueba('crédito: un crédito en marcha (cuotas ya pagadas) calcula el saldo desde el cronograma', () => {
    const x = escenario();
    const r = credito(x, { cuotasPagadas: 4, desembolsar: true });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.cuotasPagadas, 4);
    assert.strictEqual(d.credito.saldo, d.cronograma[4].Saldo_Inicial);
    assert.strictEqual(d.credito.proxima.Num, 5);
    assert.strictEqual(x.e.llamar('listarMovimientos', {}).items.length, 0, 'sin desembolso ni movimientos para lo ya pagado');
  });

  prueba('pago de cuota: sale del bolsillo, vuelve al ahorro y avanza el cronograma', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const cuota = x.e.llamar('obtenerCredito', r.idCredito).cronograma[0].Cuota;
    const ahorroAntes = x.saldo(x.ahorro.ID_Bolsillo), totalAntes = x.e.llamar('obtenerSaldos').total;

    const p = x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    assert.strictEqual(p.valorCobrado, cuota);
    assert.strictEqual(p.excedente, 0);
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), 600000 - cuota);
    assert.strictEqual(x.saldo(x.ahorro.ID_Bolsillo), ahorroAntes + cuota, 'reposición al ahorro');
    assert.strictEqual(x.e.llamar('obtenerSaldos').total, totalAntes, 'es un traslado: el total no cambia');
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.cuotasPagadas, 1);
    assert.strictEqual(d.credito.proxima.Num, 2);
    assert.strictEqual(d.pagos.length, 1);
    assert.strictEqual(d.credito.cuotasTotal, 12);
  });

  prueba('pago de cuota: no se acepta menos que la cuota', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    assert.throws(x.e.falla('registrarPagoCredito', r.idCredito, 1000, hoy()), /al menos la cuota/);
    assert.throws(x.e.falla('registrarPagoCredito', r.idCredito, 'abc', hoy()), /número/);
  });

  prueba('abono mayor a la cuota: el excedente va a capital y el plazo se recalcula (cuota y tasa iguales)', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const antes = x.e.llamar('obtenerCredito', r.idCredito);
    const cuota = antes.cronograma[0].Cuota;

    const prev = x.e.llamar('previsualizarPagoCredito', r.idCredito, cuota + 400000);
    assert.strictEqual(prev.excedente, 400000);
    assert.ok(prev.cuotasRestantes < prev.cuotasRestantesAntes, 'el plazo baja');
    assert.strictEqual(prev.cuotasAhorradas, prev.cuotasRestantesAntes - prev.cuotasRestantes);

    const p = x.e.llamar('registrarPagoCredito', r.idCredito, cuota + 400000, hoy());
    assert.strictEqual(p.excedente, 400000);
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.cronograma.length, 1 + prev.cuotasRestantes, 'la cuota pagada + las restantes');
    assert.strictEqual(d.credito.Cuota_Fija, cuota, 'la cuota fija no cambia');
    assert.strictEqual(d.cronograma[1].Cuota, cuota);
    assert.strictEqual(d.cronograma[d.cronograma.length - 1].Saldo_Final, 0);
    assert.strictEqual(d.credito.saldo, d.cronograma[1].Saldo_Inicial);
    assert.ok(Math.abs(d.credito.saldo - (antes.cronograma[0].Saldo_Final - 400000)) < 0.005, 'el saldo baja por el excedente');
    assert.ok(d.cronograma[d.cronograma.length - 1].Cuota <= cuota + 0.005, 'la última cuota se ajusta hacia abajo');
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), Math.round((600000 - cuota - 400000) * 100) / 100);
  });

  prueba('abono que supera el saldo: solo se cobra lo necesario y el crédito queda pagado', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const d0 = x.e.llamar('obtenerCredito', r.idCredito);
    const p = x.e.llamar('registrarPagoCredito', r.idCredito, 5000000, hoy());
    assert.strictEqual(p.cancela, true);
    assert.strictEqual(p.valorCobrado, d0.cronograma[0].Cuota + d0.cronograma[0].Saldo_Final, 'cuota + saldo restante, nada más');
    assert.strictEqual(p.saldoDespues, 0);
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.Estado, 'Pagado');
    assert.strictEqual(d.credito.saldo, 0);
    assert.throws(x.e.falla('registrarPagoCredito', r.idCredito, undefined, hoy()), /ya no tiene cuotas pendientes/);
  });

  prueba('pagar todas las cuotas una por una cierra el crédito en la última', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false, Monto: 300000, Num_Periodos: 3 });
    x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    assert.strictEqual(x.e.llamar('obtenerCredito', r.idCredito).credito.Estado, 'Activo');
    const ultimo = x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    assert.strictEqual(ultimo.cancela, true);
    assert.strictEqual(x.e.llamar('obtenerCredito', r.idCredito).credito.Estado, 'Pagado');
    assert.strictEqual(x.e.llamar('obtenerCredito', r.idCredito).credito.avance, 1);
  });

  prueba('anular el último pago restaura el cronograma y devuelve el dinero; solo el último', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const antes = x.e.llamar('obtenerCredito', r.idCredito);
    const cuota = antes.cronograma[0].Cuota;
    const p1 = x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    const p2 = x.e.llamar('registrarPagoCredito', r.idCredito, cuota + 300000, hoy());
    assert.throws(x.e.falla('anularPagoCredito', p1.idPago), /Solo se puede anular el último pago/);

    x.e.llamar('anularPagoCredito', p2.idPago);
    let d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.cronograma.length, 12, 'vuelve el plazo original');
    assert.strictEqual(d.credito.cuotasPagadas, 1);
    assert.strictEqual(d.credito.proxima.Num, 2);
    assert.strictEqual(d.credito.saldo, antes.cronograma[1].Saldo_Inicial);
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), 600000 - cuota);

    x.e.llamar('anularPagoCredito', p1.idPago);
    d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.deepStrictEqual(d.cronograma.map(f => f.Estado), new Array(12).fill('Pendiente'));
    assert.strictEqual(d.credito.saldo, 1200000);
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), 600000);
    assert.strictEqual(d.pagos.length, 0);
  });

  prueba('anular el pago que canceló el crédito lo deja activo otra vez', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const p = x.e.llamar('registrarPagoCredito', r.idCredito, 5000000, hoy());
    assert.strictEqual(x.e.llamar('obtenerCredito', r.idCredito).credito.Estado, 'Pagado');
    x.e.llamar('anularPagoCredito', p.idPago);
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.Estado, 'Activo');
    assert.strictEqual(d.cronograma.length, 12);
    assert.strictEqual(d.credito.saldo, 1200000);
  });

  prueba('el pago de una cuota se enlaza al renglón del presupuesto del crédito y cuenta como su real', () => {
    const x = escenario();
    const r = credito(x, { desembolsar: false });
    const esc = x.e.llamar('listarCatalogo', 'Escenarios')[0];
    x.e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Cuota Crédito B', Monto_Plan: 120000, Tipo: 'Cuota', ID_Bolsillo_Destino: x.pagos.ID_Bolsillo, ID_Credito: r.idCredito });
    x.e.llamar('generarPresupuestoMes', mesDe(hoy()), esc.ID_Escenario);
    const cuota = x.e.llamar('obtenerCredito', r.idCredito).cronograma[0].Cuota;
    x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    const it = x.e.llamar('obtenerPresupuestoMes', mesDe(hoy())).items.find(i => i.Concepto === 'Cuota Crédito B');
    assert.strictEqual(it.Real, cuota);
    assert.throws(x.e.falla('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Otra', Monto_Plan: 1, Tipo: 'Cuota', ID_Bolsillo_Destino: x.pagos.ID_Bolsillo, ID_Credito: 'no' }), /crédito no existe/);
  });

  prueba('crédito: editar datos, anular sin pagos (devuelve el desembolso) y no con pagos', () => {
    const x = escenario();
    const ahorroAntes = x.saldo(x.ahorro.ID_Bolsillo);
    const r = credito(x);
    const persona = x.e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Persona A', Rol: 'Familiar' });
    x.e.llamar('editarCredito', r.idCredito, { Nombre: 'Crédito B renovado', ID_Persona: persona.ID_Persona, Notas: 'ok' });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.Nombre, 'Crédito B renovado');
    assert.strictEqual(d.credito.Persona, 'Persona A');

    const p = x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    assert.throws(x.e.falla('anularCredito', r.idCredito), /ya tiene pagos/);
    x.e.llamar('anularPagoCredito', p.idPago);
    x.e.llamar('anularCredito', r.idCredito);
    assert.strictEqual(x.saldo(x.ahorro.ID_Bolsillo), ahorroAntes, 'el desembolso se anuló');
    assert.strictEqual(x.e.llamar('listarCreditos').length, 0);
    assert.throws(x.e.falla('desactivarCatalogo', 'Personas', 'nope'), /no existe/);
  });

  prueba('la deuda con el ahorro es la suma de los saldos de los créditos activos', () => {
    const x = escenario();
    credito(x, { desembolsar: false });
    credito(x, { Nombre: 'Crédito C', Monto: 500000, Num_Periodos: 5, desembolsar: false });
    assert.strictEqual(x.e.llamar('deudaConAhorro_'), 1700000);
    const lista = x.e.llamar('listarCreditos');
    assert.strictEqual(lista.length, 2);
    assert.ok(lista.every(c => c.proxima && c.proxima.Cuota > 0));
  });

  prueba('un crédito activo impide desactivar su cuenta de ahorro y a su persona', () => {
    const x = escenario();
    const persona = x.e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Persona B', Rol: 'Familiar' });
    credito(x, { desembolsar: false, ID_Persona: persona.ID_Persona });
    assert.throws(x.e.falla('desactivarCatalogo', 'Personas', persona.ID_Persona), /crédito\(s\) activo/);
    assert.throws(x.e.falla('desactivarCatalogo', 'Cuentas', x.ahorroCta.ID_Cuenta), /crédito\(s\) activo|saldo distinto/);
  });

  // ============================================================= API
  prueba('API: las compras y los pagos devuelven la tarjeta ya actualizada con los saldos', () => {
    const x = escenario();
    const r = x.e.llamar('addCompraTC', { ID_Tarjeta: x.t.ID_Tarjeta, Concepto: 'Cena', Valor: 80000, Fecha: hoy(), Fuente: 'Guardar' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.tarjeta.totales.total, 80000);
    assert.strictEqual(r.data.saldos.bolsillos[x.reserva.ID_Bolsillo], 80000);
    assert.strictEqual(r.data.items.length, 1, 'el traslado de reserva');

    const p = x.e.llamar('payExtracto', x.t.ID_Tarjeta, r.data.tarjeta.mes, hoy());
    assert.strictEqual(p.ok, true);
    assert.ok(p.data.tarjeta.extracto);
    assert.strictEqual(p.data.completado, 0);
    const v = x.e.llamar('voidPagoExtracto', p.data.idExtracto);
    assert.strictEqual(v.data.tarjeta.extracto, null);
    assert.strictEqual(v.data.saldos.bolsillos[x.reserva.ID_Bolsillo], 80000);

    const c = x.e.llamar('voidCompraTC', r.data.idCompra);
    assert.strictEqual(c.data.tarjeta.totales.total, 0);
    assert.strictEqual(x.e.llamar('restoreCompraTC', r.data.idCompra).data.tarjeta.totales.total, 80000);
    assert.strictEqual(x.e.llamar('addCompraTC', { ID_Tarjeta: 'no', Concepto: 'x', Valor: 1 }).ok, false);
  });

  prueba('API: los créditos se crean, se pagan y se anulan con la pantalla del crédito actualizada', () => {
    const x = escenario();
    const c = x.e.llamar('addCredito', { Nombre: 'Crédito D', ID_Cuenta_Ahorro: x.ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: x.pagos.ID_Bolsillo, Fecha_Inicio: hace(10), Monto: 600000, Periodicidad: 'Quincenal', Num_Periodos: 6, Tasa_Periodica: 0.004 });
    assert.strictEqual(c.ok, true);
    const id = c.data.credito.credito.ID_Credito;
    assert.strictEqual(c.data.credito.cronograma.length, 6);

    const prev = x.e.llamar('previewPagoCredito', id);
    assert.strictEqual(prev.data.Num, 1);
    const pago = x.e.llamar('payCredito', id, '', hoy(), '');
    assert.strictEqual(pago.ok, true);
    assert.strictEqual(pago.data.credito.credito.cuotasPagadas, 1);
    assert.strictEqual(pago.data.pago.num, 1);
    assert.strictEqual(x.e.llamar('getDeudas').data.creditos.length, 1);

    assert.strictEqual(x.e.llamar('voidPagoCredito', pago.data.pago.idPago).data.credito.credito.cuotasPagadas, 0);
    assert.strictEqual(x.e.llamar('saveCredito', id, { Notas: 'hola' }).data.credito.credito.Notas, 'hola');
    assert.strictEqual(x.e.llamar('cancelCredito', id).ok, true);
    assert.strictEqual(x.e.llamar('getDeudas').data.creditos.length, 0);
  });

  prueba('API: getDeudas junta tarjetas y créditos y el arranque trae los créditos activos', () => {
    const x = escenario();
    compra(x, { Valor: 40000 });
    credito(x, { desembolsar: false });
    const d = x.e.llamar('getDeudas').data;
    assert.strictEqual(d.tarjetas.length, 1);
    assert.strictEqual(d.creditos.length, 1);
    assert.strictEqual(d.deudaAhorro, 1200000);
    const boot = x.e.llamar('getBootstrap').data;
    assert.strictEqual(boot.creditos.length, 1);
  });
  prueba('demo: incluye compras y un crédito, y limpiarlos deja todo en cero', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const d = e.llamar('getDeudas').data;
    assert.strictEqual(d.tarjetas.length, 2);
    assert.strictEqual(d.creditos.length, 1);
    assert.strictEqual(d.creditos[0].cuotasPagadas, 2);
    const t = e.llamar('obtenerTarjeta', 'demo-tar-1');
    assert.strictEqual(t.totales.total, 335000);

    e.llamar('pagarExtracto', 'demo-tar-1', t.mes, hoy());
    e.llamar('registrarPagoCredito', 'demo-cre-1', undefined, hoy());
    e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco real' });
    const r = e.llamar('limpiarDatosDemo');
    ['Compras_TC', 'Extractos', 'Creditos', 'Creditos_Cronograma', 'Creditos_Pagos', 'Movimientos'].forEach(tab => {
      assert.strictEqual(e.hojas[tab].filas.slice(1).filter(f => f.some(c => c !== '' && c !== undefined)).length, 0, tab + ' debe quedar vacía: ' + JSON.stringify(r.eliminadas));
    });
    assert.deepStrictEqual(e.llamar('listarCatalogo', 'Bancos').map(b => b.Nombre), ['Banco real']);
  });
};
