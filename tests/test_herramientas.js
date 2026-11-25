/**
 * Pruebas de la 1.16: fórmulas de la Calculadora y de Pensiones y cesantías (js_herramientas.html, bloque CALC).
 */
const fs = require('fs');
const path = require('path');

module.exports = function (prueba, assert) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js_herramientas.html'), 'utf8');
  const bloque = src.slice(src.indexOf('// <calc>'), src.indexOf('// </calc>'));
  const CALC = new Function(bloque + '\nreturn CALC;')();
  const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol || 0.5), (msg || '') + ' esperado ' + b + ', obtuvo ' + a);
  const SMMLV = 1750905, AUX = 249095;

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

  prueba('cesantías: base con auxilio hasta 2 SMMLV, intereses del 12 %, prima y salario integral', () => {
    assert.strictEqual(CALC.dias360('2026-01-01', '2026-12-31'), 360);
    assert.strictEqual(CALC.dias360('2026-02-01', '2026-02-28'), 30, 'febrero completo son 30 días');
    assert.strictEqual(CALC.dias360('2026-03-16', '2026-03-31'), 15);
    const r = CALC.cesantias({ salario: SMMLV, smmlv: SMMLV, auxilio: AUX, desde: '2026-01-01', hasta: '2026-12-31' });
    assert.strictEqual(r.aplicaAuxilio, true);
    cerca(r.cesantias, 2000000, 0.01, 'un año con salario mínimo + auxilio');
    cerca(r.intereses, 240000, 0.01);
    cerca(r.prima, 1000000, 0.01, 'prima del segundo semestre');
    const medio = CALC.cesantias({ salario: 3000000, smmlv: SMMLV, auxilio: AUX, desde: '2026-07-01', hasta: '2026-12-31' });
    assert.strictEqual(medio.aplicaAuxilio, true, '3 millones es menos de 2 SMMLV');
    cerca(medio.cesantias, (3000000 + AUX) / 2, 0.01);
    cerca(medio.intereses, medio.cesantias * 180 * 0.12 / 360, 0.01);
    const alto = CALC.cesantias({ salario: 5000000, smmlv: SMMLV, auxilio: AUX, desde: '2026-01-01', hasta: '2026-12-31', diasNoPagados: 36 });
    assert.strictEqual(alto.aplicaAuxilio, false);
    cerca(alto.cesantias, 5000000 * 324 / 360, 0.01, 'los días no pagados no cuentan');
    assert.strictEqual(CALC.cesantias({ salario: 30000000, smmlv: SMMLV, auxilio: AUX, integral: true, desde: '2026-01-01', hasta: '2026-12-31' }).cesantias, 0);
  });

  prueba('pensión: semanas (C-197 de 2023), tasa de reemplazo y Fondo de Solidaridad', () => {
    assert.strictEqual(CALC.semanasRequeridas('H', 2030, 'RPM'), 1300);
    assert.strictEqual(CALC.semanasRequeridas('M', 2025, 'RPM'), 1300);
    assert.strictEqual(CALC.semanasRequeridas('M', 2026, 'RPM'), 1250);
    assert.strictEqual(CALC.semanasRequeridas('M', 2030, 'RPM'), 1150);
    assert.strictEqual(CALC.semanasRequeridas('M', 2036, 'RPM'), 1000);
    assert.strictEqual(CALC.semanasRequeridas('M', 2045, 'RPM'), 1000);
    assert.strictEqual(CALC.semanasRequeridas('H', 2030, 'RAIS'), 1150);
    cerca(CALC.tasaReemplazo(SMMLV, SMMLV, 1300, 1300), 65, 1e-9, 'un salario mínimo: 65 %');
    cerca(CALC.tasaReemplazo(10 * SMMLV, SMMLV, 1300, 1300), 60.5, 1e-9);
    cerca(CALC.tasaReemplazo(25 * SMMLV, SMMLV, 1300, 1300), 55, 1e-9, 'no baja de 55 %');
    cerca(CALC.tasaReemplazo(SMMLV, SMMLV, 1449, 1300), 68, 1e-9, '149 semanas extra son 2 bloques de 50');
    cerca(CALC.tasaReemplazo(SMMLV, SMMLV, 1450, 1300), 69.5, 1e-9, '+1,5 por cada 50 semanas extra');
    assert.strictEqual(CALC.tasaReemplazo(SMMLV, SMMLV, 3000, 1300), 80, 'hasta 80 %');
    assert.strictEqual(CALC.fsp(3.99), 0); assert.strictEqual(CALC.fsp(4), 0.01); assert.strictEqual(CALC.fsp(16.5), 0.012); assert.strictEqual(CALC.fsp(25), 0.02);
  });

  prueba('pensión: fecha y mesada en Colpensiones, ritmo sin cotizar y reforma informativa', () => {
    const h = CALC.pension({ sexo: 'H', nacimiento: '1970-05-10', semanas: 1200, semanasPorAnio: 52, salario: 3000000, regimen: 'RPM', smmlv: SMMLV, hoy: '2026-11-25' });
    assert.strictEqual(h.fechaEdad, '2032-05-10');
    assert.strictEqual(h.fechaPension, '2032-05-10', 'cumple las semanas antes que la edad');
    assert.strictEqual(h.requeridas, 1300);
    assert.ok(h.mesada > SMMLV && h.mesada < 3000000);
    cerca(h.aportes.tuyo, 120000, 0.01, '4 % del salario'); cerca(h.aportes.empleador, 360000, 0.01);
    assert.strictEqual(h.reforma.transicion, true, 'más de 900 semanas en 2025');
    assert.strictEqual(h.reforma.aFondo, 0, 'menos de 2,3 SMMLV va todo a Colpensiones');
    // Mujer: las semanas que se piden bajan con el año
    const m = CALC.pension({ sexo: 'M', nacimiento: '1975-01-01', semanas: 900, semanasPorAnio: 52, salario: SMMLV, regimen: 'RPM', smmlv: SMMLV, hoy: '2026-11-25', hijos: 2 });
    assert.strictEqual(m.fechaPension, '2032-01-01');
    assert.strictEqual(m.requeridas, 1100);
    cerca(m.mesada, SMMLV, 0.01, 'nunca menos de un salario mínimo');
    assert.strictEqual(m.reforma.menosPorHijos, 100);
    // Sin seguir cotizando y sin las semanas: no hay fecha
    const sin = CALC.pension({ sexo: 'H', nacimiento: '1970-01-01', semanas: 600, semanasPorAnio: 0, salario: SMMLV, regimen: 'RPM', smmlv: SMMLV, hoy: '2026-11-25' });
    assert.strictEqual(sin.fechaPension, null);
    // Independiente: cotiza sobre el 40 % y paga todo; con altos ingresos, parte iría al fondo con la reforma
    const ind = CALC.pension({ sexo: 'H', nacimiento: '1990-01-01', semanas: 300, semanasPorAnio: 52, salario: 20000000, independiente: true, regimen: 'RPM', smmlv: SMMLV, hoy: '2026-11-25' });
    cerca(ind.ibc, 8000000, 0.01);
    cerca(ind.aportes.tuyo, 8000000 * 0.17, 0.01, '16 % + 1 % de solidaridad (más de 4 SMMLV)');
    assert.ok(ind.reforma.aFondo > 0);
  });

  prueba('guía: cada término del glosario tiene su palabra y su explicación', () => {
    const s = fs.readFileSync(path.join(__dirname, '..', 'js_ahorro.html'), 'utf8');
    const glosario = new Function('return ' + s.match(/const GLOSARIO = (\[[\s\S]*?\n\]);/)[1])();
    glosario.forEach((g, k) => assert.ok(Array.isArray(g) && g.length === 2 && g[0] && g[1], 'entrada ' + k + ' mal formada'));
    ['Meta', 'Lista de deseos', 'Inversión', 'Cesantías', 'Tasa de reemplazo'].forEach(t => assert.ok(glosario.some(g => g[0] === t), 'falta ' + t));
  });

  prueba('pensión en un fondo privado: saldo proyectado y garantía de pensión mínima', () => {
    const r = CALC.pension({ sexo: 'H', nacimiento: '1970-01-01', semanas: 1200, semanasPorAnio: 52, salario: SMMLV, regimen: 'RAIS', saldo: 20000000, rentabilidad: 0.03, smmlv: SMMLV, hoy: '2026-11-25' });
    assert.ok(r.saldoProyectado > 20000000);
    assert.strictEqual(r.garantiaMinima, true, 'con poco saldo y 1.150 semanas, un salario mínimo');
    cerca(r.mesada, SMMLV, 0.01);
    const rico = CALC.pension({ sexo: 'H', nacimiento: '1970-01-01', semanas: 1200, semanasPorAnio: 52, salario: 8000000, regimen: 'RAIS', saldo: 900000000, rentabilidad: 0.04, smmlv: SMMLV, hoy: '2026-11-25' });
    assert.strictEqual(rico.garantiaMinima, false);
    assert.ok(rico.mesada > SMMLV);
  });
};
