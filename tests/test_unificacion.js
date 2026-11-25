/**
 * Pruebas de la versión 1.12 (Propuesta 1): reglas comunes de lo que se repite, una sola lista de "lo que viene" y una
 * sola regla de qué es ingreso o gasto en informes y totales.
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();
  const enDias = n => bogota(n * 86400000);

  function escenario() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 5000000 });
    return { e, banco, cta, casa };
  }

  prueba('recurrentes: costo mensual y anual con la misma regla para pagos e ingresos', () => {
    const { e, casa } = escenario();
    e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Seguro', Tipo: 'Suscripcion', Valor: 600000, Periodicidad: 'Semestral', Proximo_Cobro: enDias(10), ID_Bolsillo: casa.ID_Bolsillo });
    e.llamar('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Arriendo', Valor: 600000, Periodicidad: 'Semestral', Proximo_Cobro: enDias(10), ID_Bolsillo: casa.ID_Bolsillo });
    const s = e.llamar('obtenerSuscripciones').items[0], i = e.llamar('obtenerIngresosRecurrentes').items[0];
    assert.strictEqual(s.mensual, 100000); assert.strictEqual(s.anual, 1200000);
    assert.strictEqual(i.mensual, s.mensual); assert.strictEqual(i.anual, s.anual);
  });

  prueba('recurrentes: saltar y deshacer un ingreso deja el cobro como estaba', () => {
    const { e, casa } = escenario();
    const r = e.llamar('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Clases', Valor: 200000, Periodicidad: 'Mensual', Proximo_Cobro: '2026-01-31', Dia_Cobro: 31, ID_Bolsillo: casa.ID_Bolsillo });
    const x = e.llamar('saltarIngresoRecurrente', r.ID_Ingreso);
    assert.strictEqual(x.proximo, '2026-02-28', 'el 31 pasa al último día de febrero');
    const y = e.llamar('recibirIngresoRecurrente', r.ID_Ingreso, { Fecha: hoy() });
    assert.strictEqual(y.proximo, '2026-03-31', 'y vuelve al 31');
    e.llamar('deshacerIngresoRecurrente', r.ID_Ingreso, y.anterior, y.idMov);
    const despues = e.llamar('getTableData', 'Ingresos_Recurrentes')[0];
    assert.strictEqual(despues.Proximo_Cobro, '2026-02-28');
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 5000000, 'el ingreso se anuló');
  });

  prueba('recurrentes: si registrar el pago de una suscripción falla, no queda el gasto a medias', () => {
    const { e, casa } = escenario();
    const s = e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Música', Tipo: 'Suscripcion', Valor: 20000, Periodicidad: 'Mensual', Proximo_Cobro: hoy(), ID_Bolsillo: casa.ID_Bolsillo });
    const hoja = e.hojas.Suscripciones;
    const original = hoja.getRange.bind(hoja);
    hoja.getRange = function (f) { if (f > 1 && arguments.length === 4) { const r = original.apply(null, arguments); r.setValues = () => { throw new Error('Sheets no responde'); }; return r; } return original.apply(null, arguments); };
    assert.throws(() => e.llamar('pagarSuscripcion', s.ID_Suscripcion, { Fecha: hoy() }), /no responde/);
    hoja.getRange = original;
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 5000000, 'el gasto se deshizo');
  });

  prueba('lo que viene: una sola lista con lo que sale, lo que entra y las fechas de nómina', () => {
    const { e, casa } = escenario();
    e.llamar('guardarCatalogo', 'Suscripciones', { Nombre: 'Internet', Tipo: 'Servicio', Valor: 90000, Periodicidad: 'Mensual', Proximo_Cobro: enDias(3), ID_Bolsillo: casa.ID_Bolsillo });
    e.llamar('guardarCatalogo', 'Ingresos_Recurrentes', { Nombre: 'Arriendo', Valor: 800000, Periodicidad: 'Mensual', Proximo_Cobro: enDias(5), ID_Bolsillo: casa.ID_Bolsillo });
    const ev = e.llamar('proximosEventos_', 30, { fechasNomina: true });
    const internet = ev.find(x => x.titulo === 'Internet'), arriendo = ev.find(x => x.titulo === 'Arriendo');
    assert.strictEqual(internet.direccion, 'sale');
    assert.strictEqual(arriendo.direccion, 'entra');
    assert.ok(ev.indexOf(internet) < ev.indexOf(arriendo), 'ordenado por fecha');
    // Las respuestas de siempre conservan su forma
    assert.ok(e.llamar('proximosPagos_').some(x => x.titulo === 'Internet' && x.direccion === undefined));
    assert.ok(e.llamar('proximosIngresos_').some(x => x.titulo === 'Arriendo' && x.direccion === undefined));
  });

  prueba('ingreso o gasto: abrir o cobrar un CDT no cuenta en los gráficos ni en los totales (sí en el saldo)', () => {
    const { e, banco, casa } = escenario();
    e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Mercado', Valor: 100000, ID_Bolsillo: casa.ID_Bolsillo });
    e.llamar('guardarCatalogo', 'CDTs', { Nombre: 'CDT', ID_Banco: banco.ID_Banco, Capital: 1000000, Tasa_EA: 0.1, Fecha_Inicio: hoy(), Plazo_Dias: 90 }, { descontar: true, ID_Bolsillo_Origen: casa.ID_Bolsillo });
    const g = e.llamar('obtenerGraficos', {});
    const mes = g.serie[g.serie.length - 1];
    assert.strictEqual(mes.gastos, 100000, 'solo el mercado es gasto');
    const t = e.llamar('listarMovimientos', { mes: hoy().slice(0, 7) }).totales;
    assert.strictEqual(t.gastos, 100000);
    assert.strictEqual(e.llamar('mapaSaldosBolsillos_')[casa.ID_Bolsillo], 3900000, 'el capital sí salió del bolsillo');
  });
};
