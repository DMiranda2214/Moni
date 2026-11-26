/**
 * Pruebas de la 1.16: fórmulas de la Calculadora (js_herramientas.html, bloque CALC) y glosario de la Guía.
 */
const fs = require('fs');
const path = require('path');

module.exports = function (prueba, assert) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js_herramientas.html'), 'utf8');
  const bloque = src.slice(src.indexOf('// <calc>'), src.indexOf('// </calc>'));
  const CALC = new Function(bloque + '\nreturn CALC;')();
  const TIPOS_TASA_DE = new Function(bloque + '\nreturn () => TIPOS_TASA;')();
  const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol || 0.5), (msg || '') + ' esperado ' + b + ', obtuvo ' + a);

  prueba('calculadora: cuota fija y tabla de amortización', () => {
    cerca(CALC.cuota(1000000, 0.01, 12), 88848.79, 0.01, 'cuota al 1 % mensual');
    assert.strictEqual(CALC.cuota(1200, 0, 12), 100);
    const t = CALC.amortizacion(1000000, 0.01, 12, 5000);
    assert.strictEqual(t.length, 12);
    cerca(t.reduce((a, f) => a + f.capital, 0), 1000000, 0.01, 'el capital suma el préstamo');
    cerca(t[11].saldo, 0, 0.01);
    cerca(t[0].cuota, 88848.79 + 5000, 0.01, 'la cuota lleva los seguros');
    cerca(CALC.mensualDeEA(0.2682418), 0.02, 1e-6, 'EA → mensual');
    cerca(CALC.eaDeMensual(0.02), 0.2682418, 1e-6);
    cerca(CALC.mensualDe(0.24, 'NAMV'), 0.02, 1e-12);
  });

  prueba('calculadora: ahorro, aporte para una meta y CDT', () => {
    const a = CALC.ahorro(0, 100, 0, 12);
    assert.strictEqual(a[11].saldo, 1200);
    const i = CALC.mensualDeEA(0.09);
    const p = CALC.aporteParaMeta(5000000, 1000000, i, 24);
    cerca(CALC.ahorro(1000000, p, i, 24)[23].saldo, 5000000, 0.01, 'con ese aporte se llega a la meta');
    assert.strictEqual(CALC.aporteParaMeta(1200, 0, 0, 12), 100);
    assert.strictEqual(CALC.aporteParaMeta(100, 500, 0.01, 12), 0, 'si ya alcanza, 0');
    const c = CALC.cdt(1000000, 0.10, 365, 0.04);
    cerca(c.intereses, 100000, 0.01); cerca(c.retencion, 4000, 0.01); cerca(c.neto, 96000, 0.01);
  });

  prueba('calculadora: equivalencia de tasas (ingeniería económica)', () => {
    // EA → efectiva mensual: (1 + 0,24)^(1/12) − 1, NO 24 % / 12 (ese es el error que hace que no cuadre con el banco).
    cerca(CALC.mensualDe(0.24, 'EA'), 0.0180876, 1e-6, '24 % EA → mensual');
    cerca(CALC.desdeEA(0.24, 'NAMV'), 0.0180876 * 12, 1e-6, '24 % EA → NAMV');
    cerca(CALC.aEA(0.12, 'NATV'), 0.12550881, 1e-7, '12 % NATV → 3 % trimestral → 12,55 % EA');
    cerca(CALC.desdeEA(CALC.aEA(0.12, 'NATV'), 'TV'), 0.03, 1e-12, 'trimestral vencida');
    cerca(CALC.mensualDe(0.02, 'MA'), 0.02 / 0.98, 1e-12, '2 % MA → 2,0408 % MV');
    cerca(CALC.aEA(0.02, 'MA'), 0.27429, 1e-4, '2 % MA → 27,43 % EA');
    cerca(CALC.aEA(0.24, 'NAMA'), CALC.aEA(0.02, 'MA'), 1e-12, 'NAMA es 12 veces la MA');
    cerca(CALC.aEA(0.06, 'SV'), 0.1236, 1e-12, '6 % semestral → 12,36 % EA');
    // Ida y vuelta para todos los tipos.
    Object.keys(TIPOS_TASA_DE()).forEach(t => cerca(CALC.aEA(CALC.desdeEA(0.183, t), t), 0.183, 1e-12, 'ida y vuelta ' + t));
    // La anticipada siempre es menor que su vencida equivalente.
    assert.ok(CALC.desdeEA(0.2, 'MA') < CALC.desdeEA(0.2, 'MV'));
  });

  prueba('calculadora: préstamo con seguros, cobros y costo efectivo (TIR)', () => {
    const i = CALC.mensualDe(0.24, 'EA'), n = 36, P = 10000000;
    const sin = CALC.amortizacion(P, i, n, 0);
    cerca(CALC.costoEfectivoEA(P, 0, sin), 0.24, 1e-6, 'sin extras, la TIR es la misma EA');
    // Seguro de vida deudor: % mensual sobre el saldo que aún se debe → la cuota baja con el tiempo.
    const vida = CALC.amortizacion(P, i, n, { modo: 'saldo', valor: 0.001 });
    cerca(vida[0].seguros, 10000, 0.01, 'primer mes: 0,1 % de 10 millones');
    assert.ok(vida[1].seguros < vida[0].seguros && vida[35].cuota < vida[0].cuota, 'el seguro baja con el saldo');
    cerca(vida[1].seguros, vida[0].saldo * 0.001, 1e-6, 'cada mes sobre el saldo pendiente');
    // Sobre lo prestado: igual cada mes.
    const monto = CALC.amortizacion(P, i, n, { modo: 'monto', valor: 0.001 });
    assert.ok(monto.every(f => Math.abs(f.seguros - 10000) < 1e-6));
    // Con seguros o cobros al desembolso, el costo efectivo es mayor que la tasa.
    const ce = CALC.costoEfectivoEA(P, 0, vida), ce2 = CALC.costoEfectivoEA(P, 300000, sin);
    assert.ok(ce > 0.24 && ce < 0.40, 'con seguros cuesta más: ' + ce);
    assert.ok(ce2 > 0.24, 'con cobro inicial cuesta más: ' + ce2);
    // La TIR reproduce la tasa: con un pago único de 1.100 por 1.000 recibidos, 10 % mensual.
    cerca(CALC.tirMensual(1000, [1100]), 0.1, 1e-9);
  });

  prueba('calculadora: ahorro anticipado y CDT con año de 360 o pagos periódicos', () => {
    const i = 0.01;
    // Anualidad anticipada: F = A · ((1+i)^n − 1)/i · (1+i)
    const fv = 100 * (Math.pow(1.01, 12) - 1) / 0.01;
    cerca(CALC.ahorro(0, 100, i, 12)[11].saldo, fv, 1e-9, 'vencida');
    cerca(CALC.ahorro(0, 100, i, 12, true)[11].saldo, fv * 1.01, 1e-9, 'anticipada');
    const p = CALC.aporteParaMeta(10000, 0, i, 12, true);
    cerca(CALC.ahorro(0, p, i, 12, true)[11].saldo, 10000, 1e-6, 'el aporte anticipado llega a la meta');
    assert.ok(p < CALC.aporteParaMeta(10000, 0, i, 12));
    // CDT: 10 % EA, 180 días. Año de 360 → (1,1)^(0,5) − 1 = 4,88 %; de 365 → algo menos.
    cerca(CALC.cdt(1000000, 0.10, 180, 0, { base: 360 }).intereses, 48808.85, 0.01);
    assert.ok(CALC.cdt(1000000, 0.10, 180, 0).intereses < 48808.85);
    // Pago trimestral a 360 días con año comercial: 4 pagos de capital × ((1,1)^(90/360) − 1), sin reinvertir.
    const t = CALC.cdt(1000000, 0.10, 360, 0.04, { base: 360, pago: 'trimestral' });
    assert.strictEqual(t.periodos, 4);
    cerca(t.porPeriodo, 1000000 * (Math.pow(1.1, 0.25) - 1) * 0.96, 0.01);
    assert.ok(t.intereses < 100000, 'sin reinvertir rinde menos que al vencimiento');
  });

  prueba('guía: cada término del glosario tiene su palabra y su explicación', () => {
    const s = fs.readFileSync(path.join(__dirname, '..', 'js_ahorro.html'), 'utf8');
    const glosario = new Function('return ' + s.match(/const GLOSARIO = (\[[\s\S]*?\n\]);/)[1])();
    glosario.forEach((g, k) => assert.ok(Array.isArray(g) && g.length === 2 && g[0] && g[1], 'entrada ' + k + ' mal formada'));
    ['Meta', 'Lista de deseos', 'Inversión', 'Símbolo'].forEach(t => assert.ok(glosario.some(g => g[0] === t), 'falta ' + t));
  });
};
