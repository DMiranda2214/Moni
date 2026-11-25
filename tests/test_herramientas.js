/**
 * Pruebas de la 1.16: fórmulas de la Calculadora (js_herramientas.html, bloque CALC) y glosario de la Guía.
 */
const fs = require('fs');
const path = require('path');

module.exports = function (prueba, assert) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js_herramientas.html'), 'utf8');
  const bloque = src.slice(src.indexOf('// <calc>'), src.indexOf('// </calc>'));
  const CALC = new Function(bloque + '\nreturn CALC;')();
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

  prueba('guía: cada término del glosario tiene su palabra y su explicación', () => {
    const s = fs.readFileSync(path.join(__dirname, '..', 'js_ahorro.html'), 'utf8');
    const glosario = new Function('return ' + s.match(/const GLOSARIO = (\[[\s\S]*?\n\]);/)[1])();
    glosario.forEach((g, k) => assert.ok(Array.isArray(g) && g.length === 2 && g[0] && g[1], 'entrada ' + k + ' mal formada'));
    ['Meta', 'Lista de deseos', 'Inversión', 'Símbolo'].forEach(t => assert.ok(glosario.some(g => g[0] === t), 'falta ' + t));
  });
};
