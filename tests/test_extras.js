/**
 * Pruebas de la Fase 5: ahorro y rendimientos, regalos, vista anual y respaldos.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const mes = () => hoy().slice(0, 7);

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
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
    assert.strictEqual(f.saldo, 3000000 - 1150000);
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
};
