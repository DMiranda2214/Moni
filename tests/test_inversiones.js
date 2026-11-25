/**
 * Pruebas de la 1.16: inversiones (costo promedio, operaciones con dinero, precios de Google Finance y manuales, patrimonio).
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();

  function escenario() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 10000000 });
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, casa, saldo };
  }

  prueba('inversiones: símbolo y moneda; un símbolo de bolsa de EE. UU. o cripto queda en dólares', () => {
    const { e } = escenario();
    const a = e.llamar('guardarCatalogo', 'Inversiones', { Nombre: 'Apple', Tipo: 'Accion', Simbolo: ' nasdaq:aapl ' });
    assert.strictEqual(a.Simbolo, 'NASDAQ:AAPL');
    assert.strictEqual(a.Divisa, 'USD');
    const f = e.llamar('guardarCatalogo', 'Inversiones', { Nombre: 'Fondo vista', Tipo: 'Fondo' });
    assert.strictEqual(f.Divisa, 'COP');
    assert.throws(e.falla('guardarCatalogo', 'Inversiones', { Nombre: 'Malo', Simbolo: 'A B "C"' }), /símbolo/);
  });

  prueba('inversiones: compra y venta con costo promedio; el dinero sale y vuelve al bolsillo sin contar como gasto ni ingreso', () => {
    const { e, casa, saldo } = escenario();
    const inv = e.llamar('guardarCatalogo', 'Inversiones', { Nombre: 'Ecopetrol', Tipo: 'Accion', Simbolo: 'BVC:ECOPETROL', Divisa: 'COP' });
    let r = e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Compra', Cantidad: 100, Precio: 2000, Valor: 200000, Comision: 5000, ID_Bolsillo: casa.ID_Bolsillo });
    assert.strictEqual(r.ok, true, r.error);
    e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Compra', Cantidad: 100, Precio: 2500, Valor: 250000, ID_Bolsillo: casa.ID_Bolsillo });
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 - 455000);
    let it = e.llamar('obtenerInversiones').items[0];
    assert.strictEqual(it.cantidad, 200);
    assert.strictEqual(it.costo, 455000);
    assert.strictEqual(it.precio, 2500, 'sin otro precio, vale la última operación');
    assert.strictEqual(it.valor, 500000);
    // Vende la mitad: sale la mitad del costo
    r = e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Venta', Cantidad: 100, Precio: 3000, Valor: 300000, Comision: 2000, ID_Bolsillo: casa.ID_Bolsillo });
    it = r.data.inversiones.items[0];
    assert.strictEqual(it.cantidad, 100);
    assert.strictEqual(it.costo, 227500);
    assert.strictEqual(it.realizado, 300000 - 2000 - 227500);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 - 455000 + 298000);
    assert.throws(e.falla('registrarOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Venta', Cantidad: 101, Valor: 1 }), /no puedes vender más/);
    // Nada de esto es ingreso o gasto
    const movs = e.llamar('listarMovimientos', { limite: 10 }).items;
    assert.ok(movs.every(m => ['Inversion_Compra', 'Inversion_Venta'].indexOf(m.Subtipo) !== -1));
    assert.ok(e.llamar('esIngresoOGasto_', movs[0]) === false);
    // No se puede archivar con unidades
    assert.throws(e.falla('desactivarCatalogo', 'Inversiones', inv.ID_Inversion), /unidades/);
  });

  prueba('inversiones: dividendo es ingreso; anular una operación devuelve el dinero; una compra no se anula si deja la venta en el aire', () => {
    const { e, casa, saldo } = escenario();
    const inv = e.llamar('guardarCatalogo', 'Inversiones', { Nombre: 'ETF', Tipo: 'ETF', Divisa: 'COP' });
    const c = e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Compra', Cantidad: 10, Valor: 100000, ID_Bolsillo: casa.ID_Bolsillo });
    const v = e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Venta', Cantidad: 5, Valor: 60000, ID_Bolsillo: casa.ID_Bolsillo });
    const d = e.llamar('addOperacionInversion', { ID_Inversion: inv.ID_Inversion, Fecha: hoy(), Tipo: 'Dividendo', Valor: 3000, ID_Bolsillo: casa.ID_Bolsillo });
    assert.strictEqual(d.data.inversiones.items[0].dividendos, 3000);
    assert.strictEqual(d.data.items[0].Tipo_Mov, 'Ingreso');
    assert.throws(e.falla('anularOperacionInversion', c.data.idOperacion), /venta posterior/);
    e.llamar('voidOperacionInversion', v.data.idOperacion);
    e.llamar('voidOperacionInversion', c.data.idOperacion);
    assert.strictEqual(saldo(casa.ID_Bolsillo), 10000000 + 3000);
    assert.strictEqual(e.llamar('obtenerInversiones').items[0].cantidad, 0);
  });

  prueba('inversiones: Google Finance por la hoja auxiliar, precio manual y valor en pesos con la tasa del dólar; suma al patrimonio', () => {
    const { e } = escenario();
    e.ejecutar("guardarConfig_('Tasa_USD', '4000')");
    const btc = e.llamar('guardarCatalogo', 'Inversiones', { Nombre: 'Bitcoin', Tipo: 'Cripto', Simbolo: 'CURRENCY:BTCUSD' });
    e.llamar('addOperacionInversion', { ID_Inversion: btc.ID_Inversion, Fecha: hoy(), Tipo: 'Compra', Cantidad: 0.01, Precio: 50000, Valor: 2000000 });
    // La primera vez Google todavía no responde
    let r = e.llamar('updatePreciosGoogle').data;
    assert.deepStrictEqual(r.pendientes, ['Bitcoin']);
    const hoja = e.hojas.Precios_Google;
    assert.strictEqual(hoja.filas[1][0], btc.ID_Inversion);
    assert.strictEqual(hoja.filas[1][1], 'CURRENCY:BTCUSD');
    hoja.filas[1][2] = 60000; // lo que devolvió la fórmula
    r = e.llamar('updatePreciosGoogle').data;
    assert.strictEqual(r.actualizadas.length, 1);
    const it = r.inversiones.items[0];
    assert.strictEqual(it.fuentePrecio, 'Google');
    assert.strictEqual(it.valor, 0.01 * 60000 * 4000);
    assert.strictEqual(it.ganancia, 2400000 - 2000000);
    assert.strictEqual(e.llamar('getTableData', 'Inversiones_Precios').length, 1, 'queda en el historial');
    assert.strictEqual(r.patrimonio.activos.inversiones, 2400000);
    // Un precio manual del mismo día no le gana a Google; sin tasa del dólar, vale su costo y se avisa
    e.llamar('guardarPrecioManual', btc.ID_Inversion, 55000, hoy());
    assert.strictEqual(e.llamar('obtenerInversiones').items[0].fuentePrecio, 'Google');
    e.ejecutar("guardarConfig_('Tasa_USD', '')");
    const sin = e.llamar('obtenerInversiones');
    assert.deepStrictEqual(sin.faltaTasa, ['USD']);
    assert.strictEqual(sin.items[0].valor, 2000000);
  });

  prueba('inversiones: buscar un símbolo en Google Finance prueba las bolsas comunes y deja uno por activo', () => {
    const { e } = escenario();
    assert.deepStrictEqual(e.llamar('candidatosSimbolo_', 'aapl'), ['AAPL', 'NASDAQ:AAPL', 'NYSE:AAPL', 'NYSEARCA:AAPL', 'BVC:AAPL', 'CURRENCY:AAPLUSD']);
    assert.deepStrictEqual(e.llamar('candidatosSimbolo_', 'nasdaq:aapl'), ['NASDAQ:AAPL']);
    assert.throws(e.falla('candidatosSimbolo_', 'a b"c'), /letras y números/);
    // La primera vez Google aún no responde: no hay resultados
    assert.deepStrictEqual(e.llamar('searchSimbolo', 'aapl').data, []);
    const hoja = e.hojas.Buscar_Google;
    assert.strictEqual(hoja.filas[2][0], 'NASDAQ:AAPL');
    // Lo que devolvieron las fórmulas: el mismo activo con y sin bolsa, y nada en las demás
    hoja.filas[1][1] = 'Apple Inc'; hoja.filas[1][2] = 190.5; hoja.filas[1][3] = 'USD';
    hoja.filas[2][1] = 'Apple Inc'; hoja.filas[2][2] = 190.5; hoja.filas[2][3] = 'USD';
    const r = e.llamar('searchSimbolo', 'AAPL').data;
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].simbolo, 'NASDAQ:AAPL');
    assert.strictEqual(r[0].divisa, 'USD');
    assert.strictEqual(r[0].tipo, 'Accion');
  });
};
