/**
 * Pruebas de los CDT (CDT.gs): cálculo de intereses, apertura con o sin descuento, pagos periódicos, cierre, renovación,
 * anulación y lo que se ve como "Invertido".
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();
  const hace = n => bogota(-n * 86400000);

  function E() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 10000000 });
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    const base = { Nombre: 'CDT 1', ID_Banco: banco.ID_Banco, Capital: 5000000, Tasa_EA: 0.1, Fecha_Inicio: hoy(), Plazo_Dias: 365, Retencion_Pct: 0.04 };
    return { e, banco, cta, casa, saldo, base };
  }

  prueba('cdt: se crea con su vencimiento y el interés estimado (compuesto, sobre 365 días)', () => {
    const { e, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', base);
    assert.strictEqual(c.Fecha_Vencimiento, e.llamar('sumarDias_', hoy(), 365));
    assert.strictEqual(c.Estado, 'Vigente');
    const r = e.llamar('obtenerCdts');
    assert.strictEqual(r.vigentes.length, 1);
    const x = r.vigentes[0];
    assert.strictEqual(x.interesTotal, 500000, '10 % EA sobre 5.000.000 a un año');
    assert.strictEqual(x.retencionTotal, 20000);
    assert.strictEqual(x.netoTotal, 480000);
    assert.strictEqual(x.dias, 365);
    assert.strictEqual(r.totales.invertido, 5000000);
    // A 180 días el interés es proporcional (compuesto)
    const y = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'CDT 2', Plazo_Dias: 180, Capital: 1000000 }));
    const esperado = Math.round(1000000 * (Math.pow(1.1, 180 / 365) - 1) * 100) / 100;
    assert.strictEqual(e.llamar('obtenerCdts').vigentes.find(v => v.ID_CDT === y.ID_CDT).interesTotal, esperado);
  });

  prueba('cdt: validaciones (banco en pesos, tasa, plazo, fecha futura, nombre único)', () => {
    const { e, banco, base } = escenario();
    const usd = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Dólares', Divisa: 'USD' });
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { ID_Banco: usd.ID_Banco })), /en pesos/);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Tasa_EA: 0 })), /tasa/);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Tasa_EA: 1.5 })), /tasa/);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Plazo_Dias: 0 })), /plazo/);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Capital: 0 })), /capital/i);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Fecha_Inicio: e.llamar('sumarDias_', hoy(), 3) })), /futura/);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Pago_Intereses: 'Semanal' })), /intereses/);
    e.llamar('guardarCatalogo', 'CDTs', base);
    assert.throws(e.falla('guardarCatalogo', 'CDTs', base), /ya existe|ya hay/i);
    assert.ok(banco);
  });

  prueba('cdt: uno que ya se tenía no toca los saldos; uno nuevo puede descontar el capital del bolsillo y se anula entero', () => {
    const { e, casa, saldo, base } = escenario();
    // Ya lo tenía: ese dinero nunca estuvo en los bolsillos de Moni
    const viejo = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Viejo', Fecha_Inicio: hace(100) }));
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000);
    assert.strictEqual(e.llamar('obtenerCdts').vigentes.find(c => c.ID_CDT === viejo.ID_CDT).descontado, false);

    // Nuevo, pagado desde un bolsillo
    const n = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Nuevo' }), { descontar: true, ID_Bolsillo_Origen: casa.ID_Bolsillo });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 5000000, 'el capital salió del bolsillo');
    const mov = e.llamar('getTableData', 'Movimientos').find(m => m.Subtipo === 'CDT_Apertura');
    assert.strictEqual(mov.Tipo_Mov, 'Ajuste'); assert.strictEqual(Number(mov.Valor), -5000000);
    assert.strictEqual(e.llamar('obtenerCdts').totales.invertido, 10000000, 'invertido suma los dos');
    assert.throws(e.falla('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Sin origen' }), { descontar: true }), /bolsillo/);

    // Con movimientos, las cifras no se editan; el nombre sí
    assert.throws(e.falla('guardarCatalogo', 'CDTs', { ID_CDT: n.ID_CDT, Capital: 1 }), /Anúlalo|no se cambian/);
    assert.strictEqual(e.llamar('guardarCatalogo', 'CDTs', { ID_CDT: n.ID_CDT, Nombre: 'Nuevo 2' }).Nombre, 'Nuevo 2');
    // Uno sin movimientos sí se puede corregir
    assert.strictEqual(e.llamar('guardarCatalogo', 'CDTs', { ID_CDT: viejo.ID_CDT, Capital: 4000000 }).Capital, 4000000);

    // Anular devuelve el dinero y lo quita de lo invertido
    e.llamar('anularCdt', n.ID_CDT);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000);
    assert.strictEqual(e.llamar('obtenerCdts').totales.invertido, 4000000);
    assert.throws(e.falla('desactivarCatalogo', 'CDTs', viejo.ID_CDT), /vigente/);
  });

  prueba('cdt: cobrarlo al vencimiento devuelve el capital y anota intereses y retención', () => {
    const { e, casa, saldo, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Fecha_Inicio: hace(365), ID_Bolsillo_Destino: casa.ID_Bolsillo }));
    const antes = e.llamar('obtenerCdts').vigentes[0];
    assert.strictEqual(antes.estado, 'pronto', 'vence hoy');
    assert.strictEqual(antes.sugerencia.interes, 500000);
    assert.strictEqual(antes.sugerencia.retencion, 20000);

    const r = e.llamar('cerrarCdt', c.ID_CDT, {});
    assert.strictEqual(r.interes, 500000); assert.strictEqual(r.retencion, 20000);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 + 5000000 + 500000 - 20000);
    const movs = e.llamar('getTableData', 'Movimientos');
    assert.ok(movs.some(m => m.Subtipo === 'CDT_Retorno' && Number(m.Valor) === 5000000));
    assert.ok(movs.some(m => m.Subtipo === 'Interes' && Number(m.Valor) === 500000));
    assert.ok(movs.some(m => m.Subtipo === 'Retencion' && Number(m.Valor) === -20000));
    const t = e.llamar('obtenerCdts');
    assert.strictEqual(t.vigentes.length, 0); assert.strictEqual(t.cerrados.length, 1); assert.strictEqual(t.totales.invertido, 0);
    assert.throws(e.falla('cerrarCdt', c.ID_CDT, {}), /cerrado/);
  });

  prueba('cdt: cancelarlo antes devuelve solo lo que el banco entregó, y se puede corregir lo sugerido', () => {
    const { e, casa, saldo, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Fecha_Inicio: hace(100), ID_Bolsillo_Destino: casa.ID_Bolsillo }), { descontar: true, ID_Bolsillo_Origen: casa.ID_Bolsillo });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 5000000);
    const s = e.llamar('obtenerCdts').vigentes[0].sugerencia;
    const causado = Math.round(5000000 * (Math.pow(1.1, 100 / 365) - 1) * 100) / 100;
    assert.strictEqual(s.interes, causado, 'a los 100 días solo lo causado');
    // El banco devolvió menos (penalización) y sin intereses
    e.llamar('cerrarCdt', c.ID_CDT, { Capital: 4900000, Interes: 0, Retencion: 0 });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 5000000 + 4900000);
    assert.throws(e.falla('cerrarCdt', c.ID_CDT, {}), /cerrado/);
  });

  prueba('cdt: renovar deja el capital invertido y crea otro CDT desde esa fecha', () => {
    const { e, casa, saldo, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Fecha_Inicio: hace(365), ID_Bolsillo_Destino: casa.ID_Bolsillo }));
    const r = e.llamar('cerrarCdt', c.ID_CDT, { Renovar: true });
    assert.ok(r.renovado);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 + 500000 - 20000, 'solo salen los intereses netos; el capital sigue invertido');
    const t = e.llamar('obtenerCdts');
    assert.strictEqual(t.vigentes.length, 1); assert.strictEqual(t.vigentes[0].Capital, 5000000);
    assert.strictEqual(t.vigentes[0].Fecha_Inicio, hoy());
    assert.strictEqual(t.vigentes[0].Nombre, 'CDT 1 (2)');
    assert.strictEqual(t.totales.invertido, 5000000);
  });

  prueba('cdt: los que pagan intereses cada mes tienen próximo pago y se registran uno a uno', () => {
    const { e, casa, saldo, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Mensual', Pago_Intereses: 'Mensual', Plazo_Dias: 180, Fecha_Inicio: hace(10), ID_Bolsillo_Destino: casa.ID_Bolsillo }));
    let x = e.llamar('obtenerCdts').vigentes[0];
    assert.ok(x.proximoPago, 'tiene próximo pago');
    assert.ok(x.proximoPago.fecha >= hoy(), 'el primero que no es pasado');
    const mensual = Math.round(5000000 * (Math.pow(1.1, 1 / 365 * 31) - 1) * 100) / 100;
    assert.ok(Math.abs(x.proximoPago.valor - mensual) < 1500, 'cerca del interés de un mes');
    assert.throws(e.falla('cobrarInteresesCdt', e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Final' })).ID_CDT, {}), /al vencimiento/);

    const prox = x.proximoPago.fecha;
    const r = e.llamar('cobrarInteresesCdt', c.ID_CDT, { Interes: 40000, Retencion: 1600 });
    assert.strictEqual(r.interes, 40000);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 + 40000 - 1600);
    x = e.llamar('obtenerCdts').vigentes.find(v => v.ID_CDT === c.ID_CDT);
    assert.strictEqual(x.cobrados, 40000);
    assert.ok(x.proximoPago.fecha > prox, 'avanza al siguiente');
    assert.throws(e.falla('anularCdt', c.ID_CDT), /intereses cobrados/);
  });

  prueba('cdt: Inicio muestra lo invertido y "Por recibir" trae vencimientos próximos', () => {
    const { e, base } = escenario();
    e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Pronto', Fecha_Inicio: hace(360), Plazo_Dias: 365 }));
    e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Nombre: 'Lejos', Capital: 1000000 }));
    const b = e.llamar('getBootstrap').data;
    assert.strictEqual(b.invertido.total, 6000000); assert.strictEqual(b.invertido.cantidad, 2);
    assert.ok(b.catalogos.CDTs.length === 2, 'viaja con los catálogos');
    const prox = e.llamar('getProximosIngresos').data.filter(p => p.tipo === 'CDT');
    assert.strictEqual(prox.length, 1);
    assert.strictEqual(prox[0].titulo, 'CDT Pronto'); assert.strictEqual(prox[0].dias, 5);
    assert.ok(prox[0].valor > 5000000, 'capital más intereses netos');
    // Refresco liviano: guardar un CDT devuelve lo invertido
    const r = e.llamar('getRefresco', { tablas: ['CDTs'] }).data;
    assert.strictEqual(r.invertido.total, 6000000); assert.ok(r.saldos);
    // Recordatorios del calendario
    const deseados = e.llamar('recordatoriosDeseados_', { diasAntes: 1, hora: 8, nomina: false });
    assert.ok(deseados.some(d => /Llega CDT Pronto/.test(d.titulo)));
  });

  prueba('cdt: con la API, cobrar devuelve saldos, lo invertido y la lista al día', () => {
    const { e, casa, base } = escenario();
    const c = e.llamar('guardarCatalogo', 'CDTs', Object.assign({}, base, { Fecha_Inicio: hace(365), ID_Bolsillo_Destino: casa.ID_Bolsillo }));
    const r = e.llamar('closeCdt', c.ID_CDT, {});
    assert.strictEqual(r.ok, true, r.error && r.error.message);
    assert.strictEqual(r.data.invertido.total, 0);
    assert.strictEqual(r.data.cdts.cerrados.length, 1);
    assert.ok(r.data.saldos);
    assert.strictEqual(e.llamar('closeCdt', c.ID_CDT, {}).ok, false);
    assert.strictEqual(e.llamar('getCdts').data.totales.cantidad, 0);
  });
};
