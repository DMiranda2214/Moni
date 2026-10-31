/**
 * Pruebas de los datos de los gráficos (Graficos.gs).
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const CARGA = ['Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs'];
  const hoy = () => new Date().toISOString().slice(0, 10);
  /** Una fecha en el mes `atras` meses antes del actual, día 10 (nunca futura). */
  const fechaDe = atras => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - atras); d.setUTCDate(10); return d.toISOString().slice(0, 10); };
  const mesDe = atras => fechaDe(atras).slice(0, 7);

  function E() {
    const e = crearEntorno({});
    e.cargar(...CARGA);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    const bco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Nequi' });
    const usa = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco USA', Divisa: 'USD' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: bco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 1000000 });
    const cu = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: usa.ID_Banco, Nombre: 'Ahorro USD', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 500 });
    const bolUsd = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Cuenta === cu.ID_Cuenta);
    const mov = (b, valor, tipo, atras, extra) => e.llamar('registrarMovimiento', Object.assign({ ID_Bolsillo: b.ID_Bolsillo, Valor: valor, Tipo_Mov: tipo, Concepto: 'x', Fecha: fechaDe(atras) }, extra || {}));
    return { e, casa, bolUsd, mov };
  }

  prueba('gráficos: la serie trae N meses terminando en el elegido y valida las entradas', () => {
    const { e } = E();
    const g = e.llamar('obtenerGraficos', { mes: '2026-03', meses: 6 });
    assert.deepStrictEqual(g.serie.map(m => m.mes), ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    assert.strictEqual(e.llamar('obtenerGraficos', { mes: 'basura', meses: 7, divisa: 'JPY' }).serie.length, 6);
    assert.strictEqual(e.llamar('obtenerGraficos', { meses: 12 }).serie.length, 12);
    assert.strictEqual(e.llamar('obtenerGraficos').serie[5].mes, hoy().slice(0, 7));
    assert.strictEqual(e.llamar('obtenerGraficos').divisa, 'COP');
  });

  prueba('gráficos: entró y salió por mes, sin contar los traslados', () => {
    const { e, casa, mov } = E();
    mov(casa, 3000000, 'Ingreso', 1);
    mov(casa, 400000, 'Gasto', 1);
    mov(casa, 100000, 'Gasto', 0);
    const otro = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: casa.ID_Cuenta, Nombre: 'Mercado', Saldo_Apertura: 0 });
    e.llamar('registrarTransferencia', casa.ID_Bolsillo, otro.ID_Bolsillo, 250000, fechaDe(0));
    const g = e.llamar('obtenerGraficos', { meses: 3 });
    const prev = g.serie.find(m => m.mes === mesDe(1)), act = g.serie.find(m => m.mes === mesDe(0));
    assert.deepStrictEqual([prev.ingresos, prev.gastos, prev.neto], [3000000, 400000, 2600000]);
    assert.deepStrictEqual([act.ingresos, act.gastos], [0, 100000], 'el traslado no es gasto');
  });

  prueba('gráficos: el saldo al cierre de cada mes acumula apertura y movimientos, y el último coincide con el Inicio', () => {
    const { e, casa, mov } = E();
    mov(casa, 3000000, 'Ingreso', 5); // fuera del rango de 3 meses: entra en el saldo inicial
    mov(casa, 400000, 'Gasto', 1);
    mov(casa, 100000, 'Gasto', 0);
    const g = e.llamar('obtenerGraficos', { meses: 3 });
    assert.deepStrictEqual(g.serie.map(m => m.saldo), [4000000, 3600000, 3500000]);
    assert.strictEqual(g.serie[2].saldo, e.llamar('obtenerSaldos').total);
  });

  prueba('gráficos: gastos del mes por categoría, de mayor a menor, con nombres para lo que no tiene', () => {
    const { e, casa, mov } = E();
    const cats = e.llamar('listarCatalogo', 'Categorias');
    const mercado = cats.find(c => c.ID_Categoria === 'cat-mercado'), transp = cats.find(c => c.ID_Categoria === 'cat-transporte');
    mov(casa, 300000, 'Gasto', 0, { ID_Categoria: mercado.ID_Categoria });
    mov(casa, 50000, 'Gasto', 0, { ID_Categoria: mercado.ID_Categoria });
    mov(casa, 80000, 'Gasto', 0, { ID_Categoria: transp.ID_Categoria });
    mov(casa, 20000, 'Gasto', 0);
    mov(casa, 700000, 'Gasto', 1, { ID_Categoria: transp.ID_Categoria }); // otro mes: no entra
    const g = e.llamar('obtenerGraficos', { meses: 3 });
    assert.deepStrictEqual(g.categorias, [{ Nombre: 'Mercado', Valor: 350000 }, { Nombre: 'Transporte', Valor: 80000 }, { Nombre: 'Sin categoría', Valor: 20000 }]);
    assert.strictEqual(g.totalGastos, 450000);
    assert.strictEqual(g.totalGastos, g.serie[2].gastos, 'las categorías suman lo que salió');
    assert.strictEqual(e.llamar('obtenerGraficos', { mes: mesDe(1), meses: 3 }).categorias[0].Nombre, 'Transporte');
  });

  prueba('gráficos: cada divisa va aparte y una conversión mueve el saldo pero no es ingreso ni gasto', () => {
    const { e, casa, bolUsd, mov } = E();
    mov(casa, 100000, 'Gasto', 0);
    mov(bolUsd, 30, 'Ingreso', 0);
    e.llamar('registrarConversion', { origen: casa.ID_Bolsillo, destino: bolUsd.ID_Bolsillo, valorOrigen: 400000, valorDestino: 100, fecha: fechaDe(0) });
    const cop = e.llamar('obtenerGraficos', { meses: 3 }).serie[2];
    const usd = e.llamar('obtenerGraficos', { meses: 3, divisa: 'USD' });
    assert.deepStrictEqual([cop.ingresos, cop.gastos, cop.saldo], [0, 100000, 500000]);
    assert.deepStrictEqual([usd.serie[2].ingresos, usd.serie[2].gastos, usd.serie[2].saldo], [30, 0, 630]);
    assert.strictEqual(usd.divisa, 'USD');
  });

  prueba('gráficos: sin movimientos en el rango no hay datos, pero el saldo se ve plano', () => {
    const { e } = E();
    const g = e.llamar('obtenerGraficos', { meses: 3 });
    assert.strictEqual(g.hayDatos, false);
    assert.deepStrictEqual(g.serie.map(m => m.saldo), [1000000, 1000000, 1000000]);
    assert.deepStrictEqual(g.categorias, []);
  });

  prueba('gráficos: la API responde con el sobre estándar', () => {
    const { e } = E();
    const r = e.llamar('getGraficos', { meses: 3 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.serie.length, 3);
  });

  prueba('gráficos: la evolución del saldo de un bolsillo parte de su apertura y acumula mes a mes', () => {
    const { e, casa, mov } = E();
    mov(casa, 500000, 'Ingreso', 8);   // antes del rango
    mov(casa, 200000, 'Gasto', 1);
    mov(casa, 50000, 'Gasto', 0);
    const d = e.llamar('obtenerDetalleBolsillo', casa.ID_Bolsillo);
    assert.strictEqual(d.evolucion.length, 6);
    assert.deepStrictEqual(d.evolucion.map(x => x.saldo), [1500000, 1500000, 1500000, 1500000, 1300000, 1250000]);
    assert.strictEqual(d.evolucion[5].saldo, d.bolsillo.Saldo, 'el último punto es el saldo actual');
    const anterior = e.llamar('obtenerDetalleBolsillo', casa.ID_Bolsillo, mesDe(1));
    assert.strictEqual(anterior.evolucion[5].mes, mesDe(1));
    assert.strictEqual(anterior.evolucion[5].saldo, 1300000);
  });

  prueba('gráficos: cada cuenta de ahorro trae su evolución de 12 meses', () => {
    const e = crearEntorno({});
    e.cargar(...CARGA);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    const bco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Nu' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: bco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 1000000, Meta: 4000000 });
    const bol = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Cuenta === cta.ID_Cuenta);
    e.llamar('registrarMovimiento', { ID_Bolsillo: bol.ID_Bolsillo, Valor: 20000, Tipo_Mov: 'Ingreso', Subtipo: 'Interes', Concepto: 'Rendimientos', Fecha: fechaDe(2) });
    const a = e.llamar('obtenerAhorro').cuentas[0];
    assert.strictEqual(a.evolucion.length, 12);
    assert.strictEqual(a.evolucion[11].saldo, 1020000);
    assert.strictEqual(a.evolucion[8].saldo, 1000000);
    assert.strictEqual(a.evolucion[9].saldo, 1020000);
    assert.deepStrictEqual(e.llamar('obtenerCuentaAhorro', cta.ID_Cuenta).cuenta.evolucion, a.evolucion);
  });
};
