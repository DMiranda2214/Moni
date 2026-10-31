/**
 * Pruebas de la Fase 5: ahorro y rendimientos, regalos, vista anual y respaldos.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const mes = () => hoy().slice(0, 7);

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Arranque.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const ahorroCta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 1000000, Meta: 4000000 });
    const b = (n, s) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: n, Saldo_Apertura: s || 0 });
    const casa = b('Casa', 800000), regalos = b('Fondo de regalos', 300000);
    const ahorro = e.llamar('listarCatalogo', 'Bolsillos').find(x => x.ID_Cuenta === ahorroCta.ID_Cuenta);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, banco, c1, ahorroCta, casa, regalos, ahorro, saldo };
  }

  // ============================================================ ahorro
  prueba('ahorro: saldo, meta y avance de cada cuenta de ahorro', () => {
    const { e, ahorroCta } = escenario();
    const a = e.llamar('obtenerAhorro');
    assert.strictEqual(a.cuentas.length, 1, 'solo cuentas de tipo Ahorro');
    assert.strictEqual(a.cuentas[0].Saldo, 1000000);
    assert.strictEqual(a.cuentas[0].avanceMeta, 0.25);
    assert.strictEqual(a.cuentas[0].ID_Cuenta, ahorroCta.ID_Cuenta);
    assert.strictEqual(a.totales.deuda, 0);
  });

  prueba('rendimientos: el interés suma y la retención y el GMF restan; el neto los junta', () => {
    const { e, ahorroCta, ahorro, saldo } = escenario();
    e.llamar('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Interes', Valor: 12000, Fecha: hoy() });
    e.llamar('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Retencion', Valor: 1200, Fecha: hoy() });
    e.llamar('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'GMF', Valor: 48, Fecha: hoy() });
    assert.strictEqual(saldo(ahorro.ID_Bolsillo), 1000000 + 12000 - 1200 - 48);
    const r = e.llamar('obtenerAhorro').cuentas[0].rendimiento;
    assert.deepStrictEqual(r, { interes: 12000, retencion: 1200, gmf: 48, neto: 10752 });
    assert.throws(e.falla('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Otro', Valor: 1 }), /tipo no es válido/);
    assert.throws(e.falla('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Interes', Valor: 0 }), /mayor que cero/);
  });

  prueba('rendimientos: solo en cuentas de ahorro', () => {
    const { e, c1 } = escenario();
    assert.throws(e.falla('registrarRendimiento', { ID_Cuenta: c1.ID_Cuenta, Tipo: 'Interes', Valor: 10 }), /no es una cuenta de ahorro/);
  });

  prueba('retirar para gastos genera deuda con el ahorro y reponer la baja', () => {
    const { e, ahorroCta, casa, ahorro, saldo } = escenario();
    e.llamar('retirarParaGastos', ahorroCta.ID_Cuenta, casa.ID_Bolsillo, 300000, hoy());
    assert.strictEqual(saldo(ahorro.ID_Bolsillo), 700000);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 1100000);
    let a = e.llamar('obtenerAhorro').cuentas[0];
    assert.strictEqual(a.deuda.manual, 300000);
    assert.strictEqual(a.saldoSiRepones, 1000000);

    e.llamar('reponerAhorro', ahorroCta.ID_Cuenta, casa.ID_Bolsillo, 100000, hoy());
    a = e.llamar('obtenerAhorro').cuentas[0];
    assert.strictEqual(a.deuda.manual, 200000);
    assert.strictEqual(a.deuda.reposicion, 100000);
    assert.strictEqual(e.llamar('obtenerSaldos').total, 800000 + 300000 + 1000000, 'retirar y reponer son traslados: el total no cambia');
  });

  prueba('la deuda con el ahorro suma lo retirado y los créditos de autopago, sin contar dos veces el desembolso', () => {
    const { e, ahorroCta, casa } = escenario();
    e.llamar('registrarCredito', { Nombre: 'Crédito D', ID_Cuenta_Ahorro: ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: casa.ID_Bolsillo, Fecha_Inicio: hoy(), Monto: 600000, Periodicidad: 'Mensual', Num_Periodos: 6, Tasa_Periodica: 0.01 });
    e.llamar('retirarParaGastos', ahorroCta.ID_Cuenta, casa.ID_Bolsillo, 100000, hoy());
    const a = e.llamar('obtenerAhorro').cuentas[0];
    assert.strictEqual(a.deuda.manual, 100000, 'el desembolso del crédito no cuenta como retiro manual');
    assert.strictEqual(a.deuda.creditos, 600000);
    assert.strictEqual(a.deuda.total, 700000);
    assert.strictEqual(a.saldoSiRepones, a.Saldo + 700000);
    assert.strictEqual(a.creditos.length, 1);
  });

  prueba('pantalla de una cuenta de ahorro: resumen y movimientos del mes en una llamada', () => {
    const { e, ahorroCta } = escenario();
    e.llamar('registrarRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Interes', Valor: 500, Fecha: hoy() });
    const v = e.llamar('obtenerCuentaAhorro', ahorroCta.ID_Cuenta);
    assert.strictEqual(v.movimientos.length, 1);
    assert.strictEqual(v.movimientos[0].Subtipo, 'Interes');
    assert.strictEqual(v.mes, mes());
    assert.ok(v.ID_Bolsillo);
    assert.throws(e.falla('obtenerCuentaAhorro', 'no-existe'), /no existe/);
  });

  prueba('API de ahorro: las escrituras devuelven la cuenta y el resumen ya actualizados', () => {
    const { e, ahorroCta, casa } = escenario();
    const r = e.llamar('addRendimiento', { ID_Cuenta: ahorroCta.ID_Cuenta, Tipo: 'Interes', Valor: 700, Fecha: hoy() });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.cuentaAhorro.cuenta.Saldo, 1000700);
    assert.strictEqual(r.data.saldos.cuentas[ahorroCta.ID_Cuenta].Saldo, 1000700);
    const w = e.llamar('withdrawAhorro', ahorroCta.ID_Cuenta, casa.ID_Bolsillo, 200000, hoy(), '');
    assert.strictEqual(w.data.ahorro.totales.deuda, 200000);
    const p = e.llamar('repayAhorro', ahorroCta.ID_Cuenta, casa.ID_Bolsillo, 200000, hoy(), 'Devolución');
    assert.strictEqual(p.data.ahorro.totales.deuda, 0);
    assert.strictEqual(e.llamar('getAhorro').data.cuentas.length, 1);
  });

  // ============================================================ regalos
  prueba('regalos: crear, editar y listar por año con totales', () => {
    const { e } = escenario();
    const mama = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Persona A', Rol: 'Familiar' });
    const papa = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Persona B', Rol: 'Familiar' });
    const r1 = e.llamar('guardarRegalo', { Anio: 2026, ID_Persona: mama.ID_Persona, Idea: 'Audífonos', Estimado: 200000 });
    e.llamar('guardarRegalo', { Anio: 2026, ID_Persona: papa.ID_Persona, Idea: 'Camiseta', Estimado: 50000 });
    e.llamar('guardarRegalo', { Anio: 2025, ID_Persona: papa.ID_Persona, Estimado: 10 });
    e.llamar('guardarRegalo', { ID_Regalo: r1.ID_Regalo, Idea: 'Audífonos inalámbricos' });

    const v = e.llamar('obtenerRegalos', 2026);
    assert.strictEqual(v.items.length, 2);
    assert.deepStrictEqual(v.items.map(i => i.Persona), ['Persona A', 'Persona B']);
    assert.strictEqual(v.items[0].Idea, 'Audífonos inalámbricos');
    assert.strictEqual(v.totales.estimado, 250000);
    assert.deepStrictEqual(v.anios, [2026, 2025]);
  });

  prueba('regalos: valida persona, año y estimado', () => {
    const { e } = escenario();
    assert.throws(e.falla('guardarRegalo', { Anio: 2026, ID_Persona: 'no', Estimado: 1 }), /persona no existe/);
    const p = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Ana', Rol: 'Otro' });
    assert.throws(e.falla('guardarRegalo', { Anio: 1999, ID_Persona: p.ID_Persona, Estimado: 1 }), /año no es válido/);
    assert.throws(e.falla('guardarRegalo', { Anio: 2026, ID_Persona: p.ID_Persona, Estimado: -5 }), /menor que 0/);
    assert.throws(e.falla('guardarRegalo', { ID_Regalo: 'no', Estimado: 1 }), /no existe/);
  });

  prueba('regalos: el real se calcula desde los gastos; "no aplica" sale de los totales; no se quita con gastos', () => {
    const { e, regalos, saldo } = escenario();
    const p = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Ana', Rol: 'Otro' });
    const q = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Luis', Rol: 'Otro' });
    const r1 = e.llamar('guardarRegalo', { Anio: 2026, ID_Persona: p.ID_Persona, Idea: 'Libro', Estimado: 80000 });
    const r2 = e.llamar('guardarRegalo', { Anio: 2026, ID_Persona: q.ID_Persona, Estimado: 100000, Aplica: false });

    const g = e.llamar('registrarGastoRegalo', r1.ID_Regalo, 65000, regalos.ID_Bolsillo, hoy());
    assert.strictEqual(saldo(regalos.ID_Bolsillo), 300000 - 65000);
    let v = e.llamar('obtenerRegalos', 2026);
    const libro = v.items.find(i => i.Persona === 'Ana');
    assert.strictEqual(libro.Real, 65000);
    assert.strictEqual(libro.Diferencia, 15000);
    assert.strictEqual(libro.Comprado, true);
    assert.strictEqual(v.totales.estimado, 80000, 'el regalo que no aplica no cuenta');
    assert.strictEqual(v.totales.total, 1);
    assert.strictEqual(e.llamar('listarMovimientos', {}).items[0].Concepto, 'Regalo: Ana · Libro');

    assert.throws(e.falla('eliminarRegalo', r1.ID_Regalo), /ya tiene gastos/);
    e.llamar('anularMovimiento', g.idMov);
    assert.strictEqual(e.llamar('obtenerRegalos', 2026).items.find(i => i.Persona === 'Ana').Real, 0);
    e.llamar('eliminarRegalo', r1.ID_Regalo);
    assert.strictEqual(e.llamar('obtenerRegalos', 2026).items.length, 1);
    assert.ok(r2.ID_Regalo);
  });

  prueba('API de regalos: guardar, pagar y quitar devuelven la pantalla actualizada', () => {
    const { e, regalos } = escenario();
    const p = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Ana', Rol: 'Otro' });
    const s = e.llamar('saveRegalo', { Anio: 2026, ID_Persona: p.ID_Persona, Estimado: 50000 });
    assert.strictEqual(s.data.items.length, 1);
    const id = s.data.items[0].ID_Regalo;
    const pago = e.llamar('payRegalo', id, 40000, regalos.ID_Bolsillo, hoy());
    assert.strictEqual(pago.data.regalos.items[0].Real, 40000);
    assert.strictEqual(pago.data.saldos.bolsillos[regalos.ID_Bolsillo], 260000);
    assert.strictEqual(e.llamar('deleteRegalo', id).ok, false);
    assert.strictEqual(e.llamar('getRegalos', 2026).data.items.length, 1);
  });

  // ============================================================ vista anual
  prueba('anual: ingreso, plan, real, ahorro, tarjetas y restante mes a mes (fórmula del Excel)', () => {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    const c = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'P', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 0 });
    const reserva = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c.ID_Cuenta, Nombre: 'Reserva', Rol: 'Reserva_Tarjeta' });
    const t = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Visa', Dia_Corte: 28, Dia_Pago: 10, ID_Bolsillo_Reserva: reserva.ID_Bolsillo });
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Arriendo', Monto_Plan: 900000, Tipo: 'Gasto', ID_Bolsillo_Destino: casa.ID_Bolsillo });
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Mercado', Monto_Plan: 300000, Tipo: 'Gasto', ID_Bolsillo_Destino: casa.ID_Bolsillo });

    const m = mes();
    e.llamar('generarPresupuestoMes', m, esc.ID_Escenario);
    const items = e.llamar('obtenerPresupuestoMes', m).items;
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Concepto: 'Nómina', ID_Bolsillo: casa.ID_Bolsillo, Valor: 3000000 });
    e.llamar('registrarMovimiento', { Concepto: 'Arriendo', ID_Bolsillo: casa.ID_Bolsillo, Valor: 900000, ID_Item_Ppto: items.find(i => i.Concepto === 'Arriendo').ID_Item });
    e.llamar('registrarMovimiento', { Concepto: 'Mercado', ID_Bolsillo: casa.ID_Bolsillo, Valor: 250000, ID_Item_Ppto: items.find(i => i.Concepto === 'Mercado').ID_Item });
    e.llamar('marcarRenglonPagado', items.find(i => i.Concepto === 'Mercado').ID_Item, true);
    e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Ropa', Valor: 200000, Fecha: hoy(), Mes_Extracto: m });

    const anio = Number(m.slice(0, 4));
    const v = e.llamar('obtenerVistaAnual', anio);
    const f = v.meses.find(x => x.mes === m);
    assert.strictEqual(v.meses.length, 12);
    assert.deepStrictEqual([f.ingreso, f.plan, f.real, f.ahorro, f.tc], [3000000, 1200000, 1150000, 50000, 200000]);
    assert.strictEqual(f.restante, 3000000 - 1200000 - 200000, 'restante = ingreso − plan − TTCC');
    assert.strictEqual(f.saldo, 3000000 - 1150000 - 200000, 'saldo = ingreso − real − tarjetas sin renglón');
    assert.strictEqual(f.conPresupuesto, true);
    assert.strictEqual(v.totales.ingreso, 3000000);
    const otro = v.meses.find(x => x.mes !== m);
    assert.deepStrictEqual([otro.ingreso, otro.plan, otro.real, otro.tc], [0, 0, 0, 0]);
    assert.ok(v.anios.indexOf(anio) !== -1);
    assert.strictEqual(e.llamar('getAnual', anio).ok, true);
    assert.strictEqual(e.llamar('getAnual', 1900).ok, false);
  });

  // ============================================================ respaldos
  prueba('respaldo: crea una copia en la carpeta de respaldos y recuerda cuándo', () => {
    const e = E();
    const r = e.llamar('crearRespaldo');
    assert.match(r.nombre, /^Moni_Respaldo_\d{8}_\d{6}$/);
    assert.ok(e.drive.carpetas['Moni Respaldos']);
    const s = e.llamar('estadoRespaldos');
    assert.strictEqual(s.copiasActuales, 1);
    assert.ok(s.ultimo);
    assert.strictEqual(s.automatico, false);
  });

  prueba('respaldo: conserva solo las últimas N copias y manda las demás a la papelera', () => {
    const e = E();
    e.llamar('saveConfigParam', 'Respaldo_Copias', '3');
    // copias de días distintos (el nombre lleva la fecha)
    e.llamar('carpetaRespaldos_');
    ['20260101_000000', '20260102_000000', '20260103_000000', '20260104_000000', '20260105_000000'].forEach(sello => {
      e.drive.archivos.push({ nombre: 'Moni_Respaldo_' + sello, carpeta: 'Moni Respaldos', papelera: false, id: 'f' + sello });
    });
    const r = e.llamar('crearRespaldo');
    assert.strictEqual(r.eliminados, 3, '5 viejas + 1 nueva = 6; quedan 3');
    const vivos = e.drive.archivos.filter(a => !a.papelera).map(a => a.nombre);
    assert.strictEqual(vivos.length, 3);
    assert.ok(vivos.every(n => n >= 'Moni_Respaldo_2026'), 'se quedan las más recientes');
    assert.ok(!vivos.includes('Moni_Respaldo_20260101_000000'));
  });

  prueba('respaldo automático: solo copia si ya pasó la frecuencia; se activa y desactiva el disparador', () => {
    const e = E();
    assert.strictEqual(e.llamar('respaldoAutomatico').omitido, undefined, 'la primera vez copia');
    assert.strictEqual(e.llamar('respaldoAutomatico').omitido, true, 'la segunda se omite');
    e.propiedades.ULTIMO_RESPALDO_MS = String(Date.now() - 8 * 86400000);
    assert.strictEqual(e.llamar('respaldoAutomatico').omitido, undefined, 'pasaron 8 días ≥ 7');

    assert.strictEqual(e.llamar('estadoRespaldos').automatico, false);
    assert.strictEqual(e.llamar('configurarRespaldoAutomatico', true).automatico, true);
    assert.strictEqual(e.drive.disparadores.length, 1);
    assert.strictEqual(e.llamar('configurarRespaldoAutomatico', true).automatico, true);
    assert.strictEqual(e.drive.disparadores.length, 1, 'no se duplica');
    assert.strictEqual(e.llamar('configurarRespaldoAutomatico', false).automatico, false);
    assert.strictEqual(e.drive.disparadores.length, 0);
  });

  prueba('API de respaldos', () => {
    const e = E();
    assert.strictEqual(e.llamar('getRespaldos').data.copiasActuales, 0);
    const r = e.llamar('makeRespaldo');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.estado.copiasActuales, 1);
    assert.strictEqual(e.llamar('setRespaldoAuto', true).data.automatico, true);
  });

  prueba('vistas: los rangos de las fórmulas salen del esquema', () => {
    const e = E();
    assert.strictEqual(e.llamar('rangoColumna_', 'Movimientos', 'Valor'), 'Movimientos!$E$2:$E');
    assert.strictEqual(e.llamar('rangoColumna_', 'Movimientos', 'Anulado'), 'Movimientos!$M$2:$M');
    assert.strictEqual(e.llamar('letraColumna_', 27), 'AA');
    assert.throws(() => e.llamar('rangoColumna_', 'Movimientos', 'Nada'));
  });

  // ============================================================ arranque
  prueba('arranque: lista de verificación, aperturas en bloque y archivo de movimientos de prueba', () => {
    const { e, c1, casa, regalos } = escenario();
    e.llamar('saveConfigParam', 'Nombre_Usuario', 'Ana');
    let a = e.llamar('obtenerArranque');
    assert.strictEqual(a.fecha, '2027-01-01');
    assert.strictEqual(a.hecho, false);
    assert.strictEqual(a.checks.find(c => c.id === 'demo').hecho, true);
    assert.strictEqual(a.checks.find(c => c.id === 'previos').hecho, true, 'sin movimientos todavía');

    // Una prueba anterior al arranque bloquea el inicio hasta archivarla.
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Valor: 50000, Fecha: hoy(), ID_Bolsillo: casa.ID_Bolsillo, Concepto: 'Prueba' });
    a = e.llamar('obtenerArranque');
    assert.strictEqual(a.previos.movimientos, 1);
    assert.strictEqual(a.listo, false);
    assert.throws(e.falla('iniciarOperacion'), /Todavía falta/);

    assert.strictEqual(e.llamar('archivarPruebas').archivados, 1);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 800000, 'el saldo vuelve a la apertura');

    // Aperturas: todo o nada.
    assert.throws(e.falla('guardarAperturas', [{ ID_Bolsillo: casa.ID_Bolsillo, Saldo_Apertura: 1 }, { ID_Bolsillo: 'no-existe', Saldo_Apertura: 2 }]), /no existe/);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 800000);
    a = e.llamar('guardarAperturas', [{ ID_Bolsillo: casa.ID_Bolsillo, Saldo_Apertura: 1250000 }, { ID_Bolsillo: regalos.ID_Bolsillo, Saldo_Apertura: 0 }]);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 1250000);
    assert.throws(e.falla('guardarFechaArranque', '2027/01/01'), /AAAA-MM-DD/);
    assert.strictEqual(e.llamar('guardarFechaArranque', '2027-02-01').fecha, '2027-02-01');
    e.llamar('guardarFechaArranque', '2027-01-01');
  });

  prueba('arranque: iniciar deja respaldo, activa copias y congela las aperturas', () => {
    const { e, casa } = escenario();
    e.llamar('saveConfigParam', 'Nombre_Usuario', 'Ana');
    const r = e.llamar('iniciarOperacion');
    assert.strictEqual(r.hecho, true);
    assert.ok(r.respaldo);
    assert.strictEqual(e.llamar('estadoRespaldos').automatico, true);
    assert.strictEqual(e.llamar('estadoRespaldos').copiasActuales, 1);
    assert.throws(e.falla('guardarAperturas', [{ ID_Bolsillo: casa.ID_Bolsillo, Saldo_Apertura: 5 }]), /ya empezó/);
    assert.throws(e.falla('iniciarOperacion'), /ya empezó/);
    assert.strictEqual(e.llamar('saveConfigParam', 'Arranque_Hecho', 'FALSE').ok, false, 'no se reabre desde Parámetros');
  });

  prueba('arranque: con datos de demostración no se puede iniciar', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const a = e.llamar('obtenerArranque');
    assert.strictEqual(a.checks.find(c => c.id === 'demo').hecho, false);
    assert.throws(e.falla('iniciarOperacion'), /Todavía falta/);
    e.llamar('limpiarDatosDemo');
    assert.strictEqual(e.llamar('obtenerArranque').checks.find(c => c.id === 'demo').hecho, true);
  });

  // ============================================================ fase 7
  prueba('recordatorios: días entre fechas y próximos pagos ordenados dentro de la ventana', () => {
    const e = E();
    assert.strictEqual(e.llamar('diasEntre_', '2027-01-30', '2027-02-02'), 3);
    assert.strictEqual(e.llamar('diasEntre_', '2027-03-01', '2027-02-28'), -1);
    e.llamar('sembrarDatosDemo');
    const lista = e.llamar('proximosPagos_');
    assert.ok(lista.length > 0, 'el demo tiene tarjetas con compras por pagar');
    assert.ok(lista.every(p => p.dias <= 14 && ['Tarjeta', 'Credito', 'Suscripcion', 'Servicio'].includes(p.tipo)));
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i - 1].dias <= lista[i].dias, 'ordenados por cercanía');
    assert.deepStrictEqual(e.llamar('getBootstrap').data.proximos, lista, 'viajan en el arranque');
  });

  prueba('respuestas de la API traen el tiempo del servidor', () => {
    const e = E();
    const r = e.llamar('getBootstrap');
    assert.strictEqual(typeof r.ms, 'number');
    assert.ok(r.ms >= 0);
    assert.strictEqual(typeof e.llamar('saveConfigParam', 'Tema', 'Nada').ms, 'number', 'también en errores');
  });

  // ============================================================ suscripciones
  prueba('suscripciones: sumar meses conserva el día de cobro y el costo mensual iguala períodos', () => {
    const e = E();
    const f = (...a) => e.llamar('sumarMeses_', ...a);
    assert.strictEqual(f('2027-01-31', 1, 31), '2027-02-28');
    assert.strictEqual(f('2027-02-28', 1, 31), '2027-03-31', 'vuelve al día 31');
    assert.strictEqual(f('2027-11-15', 3, 15), '2028-02-15', 'cruza de año');
    assert.strictEqual(f('2027-03-10', 12, 10), '2028-03-10');
    assert.strictEqual(e.llamar('costoMensual_', 120000, 'Anual'), 10000);
    assert.strictEqual(e.llamar('costoMensual_', 30000, 'Trimestral'), 10000);
  });

  prueba('suscripciones: crear valida el medio de pago, calcula totales y avisa lo que vence pronto', () => {
    const { e, casa } = escenario();
    const pronto = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const lejos = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
    const s1 = e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Streaming', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: pronto, ID_Bolsillo: casa.ID_Bolsillo });
    e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Nube', Valor: 120000, Periodicidad: 'Anual', Proximo_Cobro: lejos, ID_Bolsillo: casa.ID_Bolsillo });
    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', { Nombre: 'Sin fecha', Valor: 1, ID_Bolsillo: casa.ID_Bolsillo }), /próximo cobro/);
    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', { Nombre: 'Doble', Valor: 1, Proximo_Cobro: pronto, ID_Bolsillo: casa.ID_Bolsillo, ID_Tarjeta: 'x' }), /no existe|ambos/);
    assert.throws(e.falla('guardarCatalogo', 'Suscripciones', { Nombre: 'Streaming', Valor: 1, Proximo_Cobro: pronto }), /ya existe|repetid|Ya hay/i);

    const o = e.llamar('getSuscripciones').data;
    assert.strictEqual(o.items.length, 2);
    assert.strictEqual(o.items[0].Nombre, 'Streaming', 'la más cercana primero');
    assert.strictEqual(o.totales.mensual, 50000, '40.000 + 120.000/12');
    assert.strictEqual(o.totales.anual, 600000);
    assert.strictEqual(o.totales.porPagar, 1);
    assert.strictEqual(o.items[0].estado, 'pronto');
    assert.ok(e.llamar('proximosPagos_').some(p => p.id === s1.ID_Suscripcion && p.tipo === 'Suscripcion'));
  });

  prueba('suscripciones: pagar registra el gasto, avanza el cobro y se puede deshacer', () => {
    const { e, casa, saldo } = escenario();
    const venc = hoy();
    const s = e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Streaming', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: venc, ID_Bolsillo: casa.ID_Bolsillo });
    const r = e.llamar('paySuscripcion', s.ID_Suscripcion, {});
    assert.strictEqual(r.ok, true);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 760000);
    assert.strictEqual(r.data.proximo, e.llamar('sumarMeses_', venc, 1, Number(venc.slice(8))));
    const mov = e.llamar('getTableData', 'Movimientos').find(m => m.ID_Mov === r.data.idMov);
    assert.strictEqual(mov.Notas, 'Suscripción ' + s.ID_Suscripcion);
    assert.strictEqual(r.data.suscripciones.items[0].Ultimo_Pago, venc);

    const u = e.llamar('undoPagoSuscripcion', s.ID_Suscripcion, r.data.anterior, r.data.idMov, '');
    assert.strictEqual(u.ok, true);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 800000);
    assert.strictEqual(u.data.suscripciones.items[0].Proximo_Cobro, venc);

    assert.strictEqual(e.llamar('skipSuscripcion', s.ID_Suscripcion).data.proximo, r.data.proximo, 'saltar avanza sin gasto');
    assert.strictEqual(saldo(casa.ID_Bolsillo), 800000);
    assert.strictEqual(e.llamar('paySuscripcion', s.ID_Suscripcion, { ID_Bolsillo: '' }).ok, false, 'sin medio no paga');
  });

  prueba('suscripciones: con tarjeta crea una compra, y un servicio recuerda el último valor pagado', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const lista = e.llamar('getSuscripciones').data.items;
    const conTarjeta = lista.find(x => x.ID_Tarjeta);
    const antes = e.llamar('getTableData', 'Compras_TC').length;
    const r = e.llamar('paySuscripcion', conTarjeta.ID_Suscripcion, {});
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.ok(r.data.idCompra);
    assert.strictEqual(e.llamar('getTableData', 'Compras_TC').length, antes + 1);
    e.llamar('undoPagoSuscripcion', conTarjeta.ID_Suscripcion, r.data.anterior, '', r.data.idCompra);
    assert.strictEqual(e.llamar('getTableData', 'Compras_TC').filter(c => String(c.Anulado).toUpperCase() === 'TRUE').length, 1);

    const srv = lista.find(x => x.Tipo === 'Servicio');
    assert.strictEqual(srv.codigo, '0000-DEMO-1', 'trae el código del servicio enlazado');
    const p = e.llamar('paySuscripcion', srv.ID_Suscripcion, { Valor: 101500 });
    assert.strictEqual(p.data.suscripciones.items.find(x => x.ID_Suscripcion === srv.ID_Suscripcion).Valor, 101500, 'el estimado pasa a ser el último pago');
    assert.strictEqual(e.llamar('limpiarDatosDemo').eliminadas.Suscripciones, 4);
  });

  // ============================================================ primeros pasos
  prueba('primeros pasos: una cuenta nace con sus bolsillos y saldos; todo o nada', () => {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const r = e.llamar('saveCuentaCompleta', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' },
      [{ Nombre: 'Casa', Saldo_Apertura: 1200000 }, { Nombre: 'Mercado', Saldo_Apertura: 300000 }, { Nombre: 'Viaje', Saldo_Apertura: 0, Rol: 'Fondo' }]);
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(r.data.bolsillos.length, 3);
    const saldos = e.llamar('mapaSaldosBolsillos_');
    assert.strictEqual(saldos[r.data.bolsillos[0].ID_Bolsillo], 1200000);
    assert.strictEqual(e.llamar('obtenerSaldos').total, 1500000);

    // Un dato inválido no deja la cuenta a medias.
    const antes = e.llamar('listarCatalogo', 'Cuentas').length;
    for (const malos of [[{ Nombre: 'A' }, { Nombre: 'a' }], [{ Nombre: '' }], [{ Nombre: 'B', Saldo_Apertura: 'x' }]]) {
      assert.strictEqual(e.llamar('saveCuentaCompleta', { ID_Banco: banco.ID_Banco, Nombre: 'Otra', Tipo: 'Billetera' }, malos).ok, false);
    }
    assert.strictEqual(e.llamar('listarCatalogo', 'Cuentas').length, antes);

    // Una cuenta de un solo saldo no admite bolsillos, pero sí su saldo inicial.
    assert.strictEqual(e.llamar('saveCuentaCompleta', { ID_Banco: banco.ID_Banco, Nombre: 'Débito', Tipo: 'Debito' }, [{ Nombre: 'X' }]).ok, false);
    const solo = e.llamar('saveCuentaCompleta', { ID_Banco: banco.ID_Banco, Nombre: 'Débito', Tipo: 'Debito', Saldo_Apertura: 85000 }, []);
    assert.strictEqual(solo.ok, true);
    assert.strictEqual(e.llamar('obtenerSaldos').total, 1585000);
  });

  prueba('primeros pasos: una tarjeta se registra aunque ninguna cuenta use bolsillos (la reserva activa los bolsillos)', () => {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const deb = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Débito', Tipo: 'Debito', Saldo_Apertura: 500000 });
    assert.strictEqual(String(deb.Permite_Bolsillos).toUpperCase(), 'FALSE');
    const t = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Visa', Cupo: 2000000, Dia_Corte: 15, Dia_Pago: 28 }, { crearReserva: { ID_Cuenta: deb.ID_Cuenta } });
    assert.ok(t.ID_Bolsillo_Reserva);
    const cta = e.llamar('listarCatalogo', 'Cuentas').find(c => c.ID_Cuenta === deb.ID_Cuenta);
    assert.strictEqual(String(cta.Permite_Bolsillos).toUpperCase(), 'TRUE');
    assert.strictEqual(e.llamar('obtenerSaldos').total, 500000, 'el dinero que ya había no se pierde');
    const bols = e.llamar('listarCatalogo', 'Bolsillos').filter(b => b.ID_Cuenta === deb.ID_Cuenta);
    assert.strictEqual(bols.length, 2, 'el saldo de la cuenta (ahora un bolsillo) y la reserva');
  });

  // ============================================================ presupuesto y tarjetas (gasto en el mes de la compra)
  function escenarioTC() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'P', Tipo: 'Billetera' });
    const mercado = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Mercado', Saldo_Apertura: 400000 });
    const personal = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Personal', Saldo_Apertura: 500000 });
    const reserva = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Reserva', Rol: 'Reserva_Tarjeta' });
    const t = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Visa', Dia_Corte: 28, Dia_Pago: 10, ID_Bolsillo_Reserva: reserva.ID_Bolsillo });
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Mercado', Monto_Plan: 400000, Tipo: 'Gasto', ID_Bolsillo_Destino: mercado.ID_Bolsillo, ID_Tarjeta: t.ID_Tarjeta });
    const m = mes();
    e.llamar('generarPresupuestoMes', m, esc.ID_Escenario);
    const item = e.llamar('obtenerPresupuestoMes', m).items[0];
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, t, mercado, personal, reserva, m, item, saldo };
  }

  prueba('gasto con tarjeta: con renglón, el sobre se vacía el día de la compra y el renglón cuenta una sola vez', () => {
    const { e, t, mercado, reserva, m, item, saldo } = escenarioTC();
    assert.strictEqual(item.ID_Tarjeta, t.ID_Tarjeta, 'el renglón recuerda su tarjeta habitual (viene de la plantilla)');
    const c = e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Mercado', Valor: 120000, Fecha: hoy(), ID_Item_Ppto: item.ID_Item });
    assert.strictEqual(c.Fuente, 'Ppto', 'con renglón, el apartado es lo predeterminado');
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 280000);
    assert.strictEqual(saldo(reserva.ID_Bolsillo), 120000);
    const p = e.llamar('obtenerPresupuestoMes', m).items[0];
    assert.strictEqual(p.Real, 120000, 'sin doble conteo: el traslado a la reserva y la compra son lo mismo');
    assert.strictEqual(p.ConTarjeta, 120000);
    assert.strictEqual(p.PendienteTarjeta, 120000);
  });

  prueba('gasto con tarjeta: sin renglón no aparta nada; con renglón pero fuente personal igual cuenta en el renglón; "de otra persona" no cuenta', () => {
    const { e, t, mercado, m, item, saldo } = escenarioTC();
    const sin = e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Salida', Valor: 50000, Fecha: hoy() });
    assert.strictEqual(sin.Fuente, 'Personal');
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 400000, 'no se apartó nada');
    e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Mercado', Valor: 30000, Fecha: hoy(), Fuente: 'Personal', ID_Item_Ppto: item.ID_Item });
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 30000, 'cuenta en el renglón aunque no mueva dinero');
    e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Para mi hermano', Valor: 80000, Fecha: hoy(), Fuente: 'Otro', ID_Item_Ppto: item.ID_Item });
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 30000, 'lo que se reembolsa no cuenta');
    // anular la compra la saca del renglón
    const id = e.llamar('getTableData', 'Compras_TC').find(c => c.Concepto === 'Mercado').ID_Compra;
    e.llamar('anularCompraTC', id);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 0);
  });

  prueba('pagar el extracto: se indica de dónde sale lo que falta; el pago no cuenta como gasto en los gráficos', () => {
    const { e, t, personal, reserva, saldo } = escenarioTC();
    const cat = e.llamar('guardarCatalogo', 'Categorias', { Nombre: 'Ropa', Tipo: 'Gasto' });
    const compra = e.llamar('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Concepto: 'Ropa', Valor: 200000, Fecha: hoy(), ID_Categoria: cat.ID_Categoria });
    assert.throws(e.falla('pagarExtracto', t.ID_Tarjeta, compra.Mes_Extracto, hoy()), /Elige de qué bolsillo/);
    assert.throws(e.falla('pagarExtracto', t.ID_Tarjeta, compra.Mes_Extracto, hoy(), reserva.ID_Bolsillo), /propia reserva/);
    const r = e.llamar('payExtracto', t.ID_Tarjeta, compra.Mes_Extracto, hoy(), personal.ID_Bolsillo);
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(saldo(personal.ID_Bolsillo), 300000, 'salió del bolsillo indicado');
    assert.strictEqual(saldo(reserva.ID_Bolsillo), 0);

    const g = e.llamar('obtenerGraficos', { mes: mes(), meses: 3 });
    assert.deepStrictEqual(g.categorias.map(c => [c.Nombre, c.Valor]), [['Ropa', 200000]], 'una sola vez, con su categoría, y sin la barra "Pago de tarjetas"');
    const f = g.serie.find(x => x.mes === mes());
    assert.strictEqual(f.gastos, 200000);
  });

  prueba('suscripciones: ligadas a un renglón, el pago cuenta en el presupuesto (con bolsillo y con tarjeta) y se deshace', () => {
    const { e, t, mercado, personal, m, item, saldo } = escenarioTC();
    const sus = e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Tienda', Valor: 40000, Periodicidad: 'Mensual', Proximo_Cobro: hoy(), ID_Bolsillo: personal.ID_Bolsillo, Renglon: 'mercado' });
    const r1 = e.llamar('paySuscripcion', sus.ID_Suscripcion, {});
    assert.strictEqual(r1.ok, true, r1.error && r1.error.message);
    assert.strictEqual(r1.data.idItem, item.ID_Item);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 40000);
    assert.strictEqual(r1.data.presupuesto.items[0].Real, 40000, 'la pantalla del presupuesto llega actualizada');

    e.llamar('undoPagoSuscripcion', sus.ID_Suscripcion, r1.data.anterior, r1.data.idMov, '');
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 0);

    // Con tarjeta: aparta del bolsillo del renglón y cuenta una vez.
    const sus2 = e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Nube', Valor: 25000, Periodicidad: 'Mensual', Proximo_Cobro: hoy(), ID_Tarjeta: t.ID_Tarjeta, Renglon: 'Mercado' });
    const r2 = e.llamar('paySuscripcion', sus2.ID_Suscripcion, {});
    assert.strictEqual(r2.ok, true, r2.error && r2.error.message);
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 400000 - 25000);
    assert.strictEqual(e.llamar('obtenerPresupuestoMes', m).items[0].Real, 25000);
  });

  prueba('esquema: una base ya instalada gana las columnas nuevas sin perder datos', () => {
    const e = E();
    // Se simula una base de la versión anterior: sin la columna ID_Tarjeta.
    e.ejecutar("(function () { const h = getSpreadsheet().getSheetByName('Presupuesto_Mes'); const col = SCHEMAS.Presupuesto_Mes.headers.indexOf('ID_Tarjeta') + 1; h.deleteColumn(col); })()");
    assert.strictEqual(e.llamar('verificarEsquema').listo, false);
    const r = e.llamar('setupDatabase');
    assert.ok(r.migradas.indexOf('Presupuesto_Mes.ID_Tarjeta') !== -1, JSON.stringify(r.migradas));
    assert.strictEqual(r.ok, true);
  });

  prueba('API: un gasto con tarjeta devuelve lo mismo que un gasto normal (saldos y presupuesto) y se anula completo', () => {
    const { e, t, mercado, m, item, saldo } = escenarioTC();
    const r = e.llamar('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Valor: 90000, Concepto: 'Mercado', Fecha: hoy(), ID_Item_Ppto: item.ID_Item }, null);
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(r.data.aparto, true);
    assert.strictEqual(r.data.items.length, 1, 'el traslado a la reserva');
    assert.strictEqual(r.data.presupuesto.items[0].Real, 90000);
    assert.strictEqual(r.data.saldos.bolsillos[mercado.ID_Bolsillo], 310000);

    const sin = e.llamar('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Valor: 20000, Concepto: 'Salida', Fecha: hoy() }, null);
    assert.strictEqual(sin.data.aparto, false);
    assert.strictEqual(sin.data.items.length, 0);

    const u = e.llamar('voidGastoTarjeta', r.data.idCompra, r.data.idItem, null);
    assert.strictEqual(u.ok, true);
    assert.strictEqual(u.data.presupuesto.items[0].Real, 0);
    assert.strictEqual(saldo(mercado.ID_Bolsillo), 400000);
  });

  // ============================================================ rendimientos por banco
  prueba('banco: el rendimiento se valida (tasa entre 0 y 100 %, pago diario o mensual)', () => {
    const e = E();
    const b = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Digital', Rendimiento_EA: 0.095, Rendimiento_Pago: 'Diario' });
    assert.strictEqual(b.Rendimiento_EA, 0.095);
    assert.strictEqual(b.Rendimiento_Pago, 'Diario');
    const m = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Mensual', Rendimiento_EA: 0.08 });
    assert.strictEqual(m.Rendimiento_Pago, 'Mensual', 'sin elegir, se paga cada mes');
    const sin = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Sin', Rendimiento_Pago: 'Diario' });
    assert.strictEqual(sin.Rendimiento_Pago, '', 'sin tasa no hay forma de pago');
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { Nombre: 'X', Rendimiento_EA: 1.5 }), /tasa/);
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { Nombre: 'Y', Rendimiento_EA: 0.1, Rendimiento_Pago: 'Semanal' }), /forma de pago/);
  });

  prueba('rendimiento estimado: diario capitaliza cada día; mensual lo suma al cerrar el mes', () => {
    const e = E();
    const td = Math.pow(1.1, 1 / 365) - 1;
    const prep = pago => {
      const e2 = E();
      const banco = e2.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B', Rendimiento_EA: 0.1, Rendimiento_Pago: pago });
      const cta = e2.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorro', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 1000000 });
      return { e2, banco, cta };
    };
    const est = (x, hoyIso) => x.e2.llamar('estimarRendimiento_', x.cta, x.banco, x.e2.llamar('getTableData', 'Bolsillos'), x.e2.llamar('getTableData', 'Movimientos'), hoyIso);

    // Primer día del mes: todavía no ha terminado ningún día
    const a = prep('Mensual');
    assert.strictEqual(est(a, '2027-03-01').dias, 0);
    // 10 días del mes (del 1 al 10)
    const m10 = est(a, '2027-03-11');
    assert.strictEqual(m10.dias, 10);
    assert.strictEqual(m10.pendiente, Math.round(1000000 * td * 10 * 100) / 100);
    const d10 = est(prep('Diario'), '2027-03-11');
    assert.strictEqual(d10.pendiente, Math.round(1000000 * (Math.pow(1 + td, 10) - 1) * 100) / 100, 'compuesto día a día');
    assert.ok(d10.pendiente > m10.pendiente);

    // Desde el último rendimiento registrado, y con el interés del mes anterior ya sumado al saldo
    const x = prep('Mensual');
    x.e2.llamar('registrarRendimiento', { ID_Cuenta: x.cta.ID_Cuenta, Tipo: 'Interes', Valor: 1000, Fecha: new Date(Date.now() - 86400000 * 0).toISOString().slice(0, 10) });
    const tras = est(x, new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10));
    assert.ok(tras.desde > new Date().toISOString().slice(0, 10), 'empieza el día siguiente al último rendimiento');

    // API: la pantalla de ahorro trae la estimación y la tasa
    const api = x.e2.llamar('getAhorro').data.cuentas[0];
    assert.strictEqual(api.rendimientoEstimado.ea, 0.1);
    assert.strictEqual(api.rendimientoEstimado.pago, 'Mensual');
  });

  // ============================================================ ingresos recurrentes
  prueba('ingresos recurrentes: concepto, monto y cuenta; recibir registra el ingreso y avanza el cobro; se deshace', () => {
    const { e, casa, saldo } = escenario();
    const venc = hoy();
    const ing = e.llamar('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Diseño freelance', Valor: 800000, Periodicidad: 'Mensual', Proximo_Cobro: venc, ID_Bolsillo: casa.ID_Bolsillo });
    assert.throws(e.falla('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Sin cuenta', Valor: 1, Proximo_Cobro: venc }), /cuenta/);
    assert.throws(e.falla('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Sin fecha', Valor: 1, ID_Bolsillo: casa.ID_Bolsillo }), /cuándo/);
    assert.throws(e.falla('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'diseño freelance', Valor: 1, Proximo_Cobro: venc, ID_Bolsillo: casa.ID_Bolsillo }), /Ya hay|existe|repetid/i);

    const o = e.llamar('getIngresosRecurrentes').data;
    assert.strictEqual(o.items.length, 1);
    assert.strictEqual(o.items[0].estado, 'pronto');
    assert.strictEqual(o.totales.mensual, 800000);
    assert.ok(o.items[0].destino.indexOf('Casa') !== -1);
    assert.ok(e.llamar('proximosIngresos_').some(p => p.tipo === 'Ingreso' && p.id === ing.ID_Ingreso));

    const antes = saldo(casa.ID_Bolsillo);
    const r = e.llamar('receiveIngreso', ing.ID_Ingreso, { Valor: 750000 });
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(saldo(casa.ID_Bolsillo), antes + 750000, 'llega lo que de verdad se recibió');
    assert.strictEqual(r.data.proximo, e.llamar('sumarMeses_', venc, 1, Number(venc.slice(8))));
    const mov = e.llamar('getTableData', 'Movimientos').find(m => m.ID_Mov === r.data.idMov);
    assert.strictEqual(mov.Tipo_Mov, 'Ingreso');
    assert.strictEqual(mov.Notas, 'Ingreso recurrente ' + ing.ID_Ingreso);

    const u = e.llamar('undoIngreso', ing.ID_Ingreso, r.data.anterior, r.data.idMov);
    assert.strictEqual(u.ok, true);
    assert.strictEqual(saldo(casa.ID_Bolsillo), antes);
    assert.strictEqual(u.data.ingresos.items[0].Proximo_Cobro, venc);

    assert.strictEqual(e.llamar('skipIngreso', ing.ID_Ingreso).data.proximo, r.data.proximo);
    assert.strictEqual(saldo(casa.ID_Bolsillo), antes, 'saltar no registra nada');
  });

  prueba('ingresos por recibir: la nómina estimada aparece junto a los ingresos recurrentes', () => {
    const { e } = escenario();
    e.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Actual', Sueldo_Base: 3000000, Vigente: true });
    e.llamar('saveConfigParam', 'Nomina_Dia_Pago', '31');
    const lista = e.llamar('proximosIngresos_');
    const nom = lista.find(x => x.tipo === 'Nomina');
    assert.ok(nom || e.llamar('mesProximoPagoNomina_') > hoy().slice(0, 7), 'sale cuando el pago cae en los próximos 14 días');
    if (nom) assert.strictEqual(nom.valor, 3000000 - 240000);
    assert.deepStrictEqual(e.llamar('getBootstrap').data.porRecibir, lista);
  });

  prueba('primeros pasos: la nómina nace con sus subsidios (todo o nada) y los estados del asistente incluyen nómina e ingresos', () => {
    const e = E();
    const ok = e.llamar('saveNominaInicial', { Nombre: 'Actual', Sueldo_Base: 3000000 }, [{ Nombre: 'Auxilio', Valor: 200000, Es_Salarial: false }, { Nombre: 'Bono', Valor: 100000, Es_Salarial: true }]);
    assert.strictEqual(ok.ok, true, ok.error && ok.error.message);
    const esc = e.llamar('listarCatalogo', 'Nomina_Escenarios');
    assert.strictEqual(esc.length, 1);
    assert.strictEqual(String(esc[0].Vigente).toUpperCase(), 'TRUE');
    const n = e.llamar('getNomina', mes(), '', {}).data.calculo;
    assert.strictEqual(n.devengos.length, 3);
    assert.strictEqual(n.ibc, 3100000, 'solo el bono salarial cotiza');

    // Dos subsidios con el mismo nombre, o un sueldo inválido: no se crea nada.
    const e2 = E();
    const subsAntes = e2.llamar('listarCatalogo', 'Subsidios').length;
    assert.strictEqual(e2.llamar('saveNominaInicial', { Nombre: 'X', Sueldo_Base: 3000000 }, [{ Nombre: 'A', Valor: 1 }, { Nombre: 'a', Valor: 2 }]).ok, false);
    assert.strictEqual(e2.llamar('saveNominaInicial', { Nombre: 'X', Sueldo_Base: 0 }, [{ Nombre: 'A', Valor: 1 }]).ok, false);
    assert.strictEqual(e2.llamar('listarCatalogo', 'Subsidios').length, subsAntes);
    assert.strictEqual(e2.llamar('listarCatalogo', 'Nomina_Escenarios').length, 0);

    const pasos = e.llamar('obtenerEstadoConfiguracion').pasos;
    assert.deepStrictEqual(pasos.filter(p => ['nomina', 'ingresos'].includes(p.id)).map(p => [p.id, p.hecho, p.opcional]), [['nomina', true, true], ['ingresos', false, true]]);
    assert.strictEqual(e.llamar('obtenerEstadoConfiguracion').completo, false, 'los pasos nuevos no son obligatorios: el resto sigue mandando');
  });
};
