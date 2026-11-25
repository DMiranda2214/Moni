/**
 * Pruebas de la versión 1.13 (Propuesta 5): cargos por medio de pago (comisiones, impuestos, cambio de divisa, cuota de
 * manejo y seguros) y créditos bancarios.
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();

  function escenario() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.api = (fn, ...args) => { const r = e.llamar(fn, ...args); if (!r.ok) throw new Error(r.error.message); return r.data; };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco A' });
    const otro = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco B' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const ctaB = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: otro.ID_Banco, Nombre: 'Otra', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 2000000 });
    const personal = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Personal', Saldo_Apertura: 1000000 });
    const enB = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Cuenta === ctaB.ID_Cuenta);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    const regla = r => e.llamar('guardarCatalogo', 'Cargos_Reglas', r);
    return { e, banco, otro, cta, ctaB, casa, personal, enB, saldo, regla };
  }
  const tarjeta = x => x.e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: x.banco.ID_Banco, Nombre: 'Visa', Cupo: 5000000, Dia_Corte: 31, Dia_Pago: 28, ID_Bolsillo_Personal: x.personal.ID_Bolsillo },
    { crearReserva: { ID_Cuenta: x.cta.ID_Cuenta } });

  prueba('cargos: una regla del banco (4x1000 en toda salida) se sugiere solo para sus cuentas', () => {
    const x = escenario();
    x.regla({ Nombre: 'GMF (4x1000)', Medio: 'Banco|' + x.banco.ID_Banco, Tipo_Cargo: 'Impuesto', Operacion: 'Salida', Modo: 'Porcentaje', Porcentaje: 0.004 });
    const s = x.e.api('getCargosSugeridos', 'Pago', { idBolsillo: x.casa.ID_Bolsillo, valor: 250000 });
    assert.deepStrictEqual(s.map(c => [c.nombre, c.tipo, c.valor]), [['GMF (4x1000)', 'Impuesto', 1000]]);
    assert.deepStrictEqual(x.e.api('getCargosSugeridos', 'Pago', { idBolsillo: x.enB.ID_Bolsillo, valor: 250000 }), [], 'otra entidad: nada');
    assert.deepStrictEqual(x.e.api('getCargosSugeridos', 'Compra', { idBolsillo: x.casa.ID_Bolsillo, valor: 250000 }), [], 'una compra con tarjeta no es salida de la cuenta');
  });

  prueba('cargos: porcentaje con mínimo y máximo; valor fijo', () => {
    const x = escenario();
    x.regla({ Nombre: 'Comisión', Medio: 'Cuenta|' + x.cta.ID_Cuenta, Tipo_Cargo: 'Comision', Operacion: 'Transferencia', Modo: 'Porcentaje', Porcentaje: 0.01, Minimo: 3000, Maximo: 10000 });
    const v = valor => x.e.api('getCargosSugeridos', 'Transferencia', { idBolsillo: x.casa.ID_Bolsillo, valor: valor })[0].valor;
    assert.strictEqual(v(100000), 3000, 'mínimo');
    assert.strictEqual(v(500000), 5000);
    assert.strictEqual(v(5000000), 10000, 'máximo');
    x.regla({ Nombre: 'PSE', Medio: 'Cuenta|' + x.cta.ID_Cuenta, Tipo_Cargo: 'Comision', Operacion: 'Pago', Modo: 'Fijo', Valor: 2500 });
    assert.strictEqual(x.e.api('getCargosSugeridos', 'Pago', { idBolsillo: x.casa.ID_Bolsillo, valor: 1 })[0].valor, 2500);
  });

  prueba('cargos: una regla de tarjeta solo acepta compras o extracto', () => {
    const x = escenario();
    const t = tarjeta(x);
    assert.throws(x.e.falla('guardarCatalogo', 'Cargos_Reglas', { Nombre: 'X', Medio: 'Tarjeta|' + t.ID_Tarjeta, Tipo_Cargo: 'Comision', Operacion: 'Pago', Modo: 'Fijo', Valor: 100 }), /no aplica/);
  });

  prueba('cargos: un gasto con su comisión; anularlo anula la comisión y restaurarlo la devuelve', () => {
    const x = escenario();
    const r = x.e.api('addMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Arriendo', Valor: 1000000, ID_Bolsillo: x.casa.ID_Bolsillo, cargos: [{ nombre: 'Comisión PSE', tipo: 'Comision', valor: 3500 }] });
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000 - 1000000 - 3500);
    const movs = x.e.llamar('getTableData', 'Movimientos');
    const principal = movs.find(m => m.Concepto === 'Arriendo'), cargo = movs.find(m => m.Subtipo === 'Comision');
    assert.strictEqual(cargo.Ref, 'Cargo ' + principal.ID_Mov);
    assert.strictEqual(x.e.llamar('categoriaPorRol_', 'Cargos').ID_Categoria, cargo.ID_Categoria, 'categoría "Comisiones e impuestos"');
    x.e.api('voidMovimiento', principal.ID_Mov);
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000);
    x.e.api('restoreMovimiento', principal.ID_Mov);
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000 - 1000000 - 3500);
    assert.ok(r.items.length >= 1);
  });

  prueba('cargos: el 4x1000 se registra como GMF y aparece en el resumen de cargos', () => {
    const x = escenario();
    x.e.api('addTransferencia', { origen: x.casa.ID_Bolsillo, destino: x.enB.ID_Bolsillo, valor: 500000, fecha: hoy(), concepto: 'A la otra cuenta', cargos: [{ nombre: 'GMF (4x1000)', tipo: 'Impuesto', valor: 2000 }] });
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000 - 500000 - 2000);
    const gmf = x.e.llamar('getTableData', 'Movimientos').find(m => m.Subtipo === 'GMF');
    assert.ok(gmf, 'subtipo GMF');
    assert.strictEqual(x.e.llamar('resumenCargos_').total, 2000);
  });

  prueba('cargos: compra en dólares con tarjeta, con recargo internacional en el mismo extracto; anularla anula el recargo', () => {
    const x = escenario();
    const t = tarjeta(x);
    const r = x.e.api('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Fecha: hoy(), Concepto: 'Libro', Valor: 200000, Divisa_Original: 'usd', Valor_Original: 50,
      cargos: [{ nombre: 'Compra internacional', tipo: 'Cambio_Divisa', valor: 6000 }] });
    const compras = x.e.llamar('getTableData', 'Compras_TC');
    const libro = compras.find(c => c.ID_Compra === r.idCompra), recargo = compras.find(c => c.Ref === 'Cargo ' + r.idCompra);
    assert.strictEqual(libro.Divisa_Original, 'USD'); assert.strictEqual(libro.Valor_Original, 50); assert.strictEqual(libro.Tasa, 4000);
    assert.strictEqual(recargo.Valor, 6000); assert.strictEqual(recargo.Mes_Extracto, libro.Mes_Extracto);
    x.e.api('voidGastoTarjeta', r.idCompra);
    assert.ok(x.e.llamar('getTableData', 'Compras_TC').every(c => c.Anulado === true), 'compra y recargo anulados');
  });

  prueba('cargos: la cuota de manejo se paga con el extracto y se anula con su pago', () => {
    const x = escenario();
    const t = tarjeta(x);
    x.regla({ Nombre: 'Cuota de manejo', Medio: 'Tarjeta|' + t.ID_Tarjeta, Tipo_Cargo: 'Cuota_Manejo', Operacion: 'Extracto', Modo: 'Fijo', Valor: 25000 });
    const c = x.e.api('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Fecha: hoy(), Concepto: 'Ropa', Valor: 100000 });
    const mes = x.e.llamar('getTableData', 'Compras_TC').find(q => q.ID_Compra === c.idCompra).Mes_Extracto;
    const sug = x.e.api('getCargosSugeridos', 'Extracto', { idTarjeta: t.ID_Tarjeta, idBolsillo: x.personal.ID_Bolsillo, valor: 100000 });
    assert.deepStrictEqual(sug.map(s => s.valor), [25000]);
    const antes = x.saldo(x.personal.ID_Bolsillo);
    const p = x.e.api('payExtracto', t.ID_Tarjeta, mes, hoy(), x.personal.ID_Bolsillo, [], sug);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), antes - 100000 - 25000);
    x.e.api('voidPagoExtracto', p.idExtracto);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), antes, 'el pago y la cuota de manejo se anularon');
  });

  prueba('crédito bancario: el desembolso llega a un bolsillo sin contar como ingreso; la cuota y su seguro salen como gastos', () => {
    const x = escenario();
    const r = x.e.api('addCredito', { Tipo_Credito: 'Bancario', ID_Banco: x.banco.ID_Banco, Nombre: 'Carro', Monto: 12000000, EA: 0.18, Periodicidad: 'Mensual', Num_Periodos: 24,
      Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.casa.ID_Bolsillo, ID_Bolsillo_Desembolso: x.personal.ID_Bolsillo, Cargos_Cuota: 18000, Detalle_Cargos: 'Seguro de vida' });
    const id = r.credito.credito.ID_Credito;
    assert.strictEqual(r.credito.credito.Tipo_Credito, 'Bancario');
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 1000000 + 12000000, 'llegó el desembolso');
    const g = x.e.llamar('obtenerGraficos', {});
    assert.strictEqual(g.serie[g.serie.length - 1].ingresos, 0, 'un préstamo no es ingreso');
    const anual = x.e.llamar('obtenerVistaAnual', Number(hoy().slice(0, 4)));
    assert.strictEqual(anual.totales.ingreso, 0, 'tampoco en la vista anual');

    const cuota = r.credito.credito.Cuota_Fija;
    assert.deepStrictEqual(x.e.api('getCargosSugeridos', 'Cuota', { idCredito: id, idBolsillo: x.casa.ID_Bolsillo, valor: cuota }).map(s => [s.nombre, s.valor]), [['Seguro de vida', 18000]]);
    const p = x.e.api('payCredito', id, undefined, hoy(), x.casa.ID_Bolsillo, [{ nombre: 'Seguro de vida', tipo: 'Seguro', valor: 18000 }]);
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000 - cuota - 18000);
    const movs = x.e.llamar('getTableData', 'Movimientos');
    assert.ok(movs.some(m => m.Subtipo === 'Pago_Cuota' && m.Tipo_Mov === 'Gasto'));
    assert.ok(movs.some(m => m.Subtipo === 'Seguro'));
    assert.strictEqual(x.e.llamar('getTableData', 'Creditos_Pagos')[0].Cargos, 18000);
    x.e.api('voidPagoCredito', p.pago.idPago);
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000, 'anular el pago devuelve la cuota y el seguro');
  });

  prueba('crédito bancario: sin bolsillo de desembolso no mueve dinero (un crédito que ya venía)', () => {
    const x = escenario();
    x.e.api('addCredito', { Tipo_Credito: 'Bancario', Nombre: 'Hipoteca', Monto: 100000000, EA: 0.12, Periodicidad: 'Mensual', Num_Periodos: 180,
      Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.casa.ID_Bolsillo, cuotasPagadas: 0 });
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 2000000);
    assert.strictEqual(x.saldo(x.personal.ID_Bolsillo), 1000000);
  });

  prueba('patrimonio neto: lo que tienes menos tarjetas y créditos con un banco (el autopago no se resta)', () => {
    const x = escenario();
    const t = tarjeta(x);
    x.e.api('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Fecha: hoy(), Concepto: 'Ropa', Valor: 300000 });
    x.e.api('addCredito', { Tipo_Credito: 'Bancario', Nombre: 'Libre', Monto: 1000000, EA: 0.2, Periodicidad: 'Mensual', Num_Periodos: 10, Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.casa.ID_Bolsillo, ID_Bolsillo_Desembolso: x.casa.ID_Bolsillo });
    const p = x.e.llamar('resumenPatrimonio_');
    // Casa 2.000.000 + 1.000.000 del desembolso, Personal 1.000.000, la otra cuenta 0
    assert.strictEqual(p.activos.total, 4000000);
    assert.strictEqual(p.pasivos.tarjetas, 300000);
    assert.strictEqual(p.pasivos.creditos, 1000000);
    assert.strictEqual(p.neto, 2700000);
    const boot = x.e.api('getBootstrap');
    assert.strictEqual(boot.patrimonio.neto, 2700000, 'llega en el arranque');
  });

  prueba('zona horaria: se puede cambiar a otra válida; un texto cualquiera se rechaza', () => {
    const x = escenario();
    const r = x.e.llamar('saveConfigParam', 'Zona_Horaria', 'hola');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(x.e.llamar('saveConfigParam', 'Zona_Horaria', 'Europe/Madrid').ok, true);
    assert.strictEqual(x.e.llamar('zonaHoraria_'), 'Europe/Madrid');
  });

  prueba('análisis: el patrimonio del último mes es el de Inicio y la proyección repite los cobros de cada mes', () => {
    const x = escenario();
    const t = tarjeta(x);
    x.e.api('addGastoTarjeta', { ID_Tarjeta: t.ID_Tarjeta, Fecha: hoy(), Concepto: 'Ropa', Valor: 300000 });
    x.e.api('addCredito', { Tipo_Credito: 'Bancario', Nombre: 'Libre', Monto: 1000000, EA: 0.2, Periodicidad: 'Mensual', Num_Periodos: 10, Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.casa.ID_Bolsillo, ID_Bolsillo_Desembolso: x.casa.ID_Bolsillo });
    const en = n => bogota(n * 86400000);
    x.e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Internet', Tipo: 'Servicio', Valor: 100000, Periodicidad: 'Mensual', Proximo_Cobro: en(5), ID_Bolsillo: x.casa.ID_Bolsillo });
    const d = x.e.api('getAnalisis');
    assert.strictEqual(d.patrimonioMensual.length, 12);
    assert.strictEqual(d.patrimonioMensual[11].neto, d.patrimonio.neto, 'el último mes coincide con el patrimonio de hoy');
    assert.strictEqual(d.proyeccion.eventos.filter(e => e.titulo === 'Internet').length, 3, 'tres cobros mensuales en 90 días');
    assert.ok(d.proyeccion.eventos.some(e => e.tipo === 'Crédito' && e.valor < 0), 'las cuotas del crédito salen');
    assert.ok(d.proyeccion.conocido.d90 <= d.proyeccion.inicio, 'sin ingresos conocidos, el disponible baja');
    assert.ok(Array.isArray(d.categorias) && Array.isArray(d.deudas) && d.deudas.length === 2);
  });

  prueba('crédito de autopago: sigue igual (sale del ahorro y vuelve con cada cuota)', () => {
    const x = escenario();
    const ah = x.e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: x.banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 3000000 });
    const r = x.e.api('addCredito', { Nombre: 'Moto', ID_Cuenta_Ahorro: ah.ID_Cuenta, ID_Bolsillo_Pago: x.casa.ID_Bolsillo, Fecha_Inicio: hoy(), Monto: 1200000, Periodicidad: 'Mensual', Num_Periodos: 12, Tasa_Periodica: 0.01 });
    assert.strictEqual(r.credito.credito.Tipo_Credito, 'Autopago');
    const p = x.e.api('payCredito', r.credito.credito.ID_Credito, undefined, hoy(), x.casa.ID_Bolsillo, []);
    assert.ok(p.pago.num === 1);
    assert.ok(x.e.llamar('getTableData', 'Movimientos').some(m => m.Subtipo === 'Pago_Cuota' && m.Tipo_Mov === 'Transferencia'));
  });
};
