/**
 * Pruebas de la 1.16: metas de ahorro (plan por mes y presupuesto) y Lista de deseos (sobre la tabla de regalos).
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();
  const mesHoy = () => hoy().slice(0, 7);
  const mesMas = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };

  function escenario() {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const b = (n, s) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: n, Saldo_Apertura: s || 0 });
    const casa = b('Casa', 5000000), viaje = b('Viaje', 0);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, casa, viaje, saldo };
  }

  // ============================================================ metas
  prueba('metas: plan automático reparte lo que falta en los meses que quedan', () => {
    const { e, viaje } = escenario();
    const fin = mesMas(mesHoy(), 3) + '-15'; // 4 meses: este y 3 más
    const m = e.llamar('guardarCatalogo', 'Metas', { Nombre: 'Viaje a la costa', Motivo: 'Viaje', Monto_Objetivo: 1200000, Ahorro_Inicial: 200000, Fecha_Inicio: hoy(), Fecha_Fin: fin, ID_Bolsillo: viaje.ID_Bolsillo });
    const r = e.llamar('obtenerMeta', m.ID_Meta);
    assert.strictEqual(r.plan.length, 4);
    assert.strictEqual(r.falta, 1000000);
    assert.deepStrictEqual(r.plan.map(p => p.plan), [250000, 250000, 250000, 250000]);
    assert.strictEqual(r.avance, 0.167);
    assert.strictEqual(r.estado, 'al_dia');
  });

  prueba('metas: el plan a mano se respeta (un mes en 0, otro doble) y el resto se reparte', () => {
    const { e, viaje } = escenario();
    const m0 = mesHoy(), m1 = mesMas(m0, 1), m2 = mesMas(m0, 2), m3 = mesMas(m0, 3);
    const m = e.llamar('guardarCatalogo', 'Metas', { Nombre: 'Navidad', Motivo: 'Navidad', Monto_Objetivo: 1000000, Fecha_Inicio: hoy(), Fecha_Fin: m3 + '-01', ID_Bolsillo: viaje.ID_Bolsillo });
    const plan = {}; plan[m1] = 0; plan[m2] = 500000; plan['1999-01'] = 7; // un mes fuera de la meta se ignora
    e.llamar('guardarPlanMeta', m.ID_Meta, plan);
    const r = e.llamar('obtenerMeta', m.ID_Meta);
    assert.deepStrictEqual(r.plan.map(p => [p.plan, p.manual]), [[250000, false], [0, true], [500000, true], [250000, false]]);
    assert.ok(!/1999/.test(e.llamar('listarCatalogo', 'Metas')[0].Plan_Mensual));
    assert.throws(e.falla('guardarPlanMeta', m.ID_Meta, { [m1]: -1 }), /menor que 0/);
    // Todo a mano y no alcanza: se avisa cuánto falta cubrir
    e.llamar('guardarPlanMeta', m.ID_Meta, { [m0]: 100000, [m1]: 100000, [m2]: 100000, [m3]: 100000 });
    assert.strictEqual(e.llamar('obtenerMeta', m.ID_Meta).sinCubrir, 600000);
  });

  prueba('metas: validaciones (monto, fechas y bolsillo)', () => {
    const { e, viaje } = escenario();
    const base = { Nombre: 'Moto', Monto_Objetivo: 8000000, Fecha_Inicio: hoy(), Fecha_Fin: mesMas(mesHoy(), 10) + '-01', ID_Bolsillo: viaje.ID_Bolsillo };
    assert.throws(e.falla('guardarCatalogo', 'Metas', Object.assign({}, base, { Monto_Objetivo: 0 })), /menor que 1/);
    assert.throws(e.falla('guardarCatalogo', 'Metas', Object.assign({}, base, { Fecha_Fin: '' })), /para cuándo/);
    assert.throws(e.falla('guardarCatalogo', 'Metas', Object.assign({}, base, { Fecha_Fin: '2001-01-01' })), /después/);
    assert.throws(e.falla('guardarCatalogo', 'Metas', Object.assign({}, base, { ID_Bolsillo: '' })), /bolsillo/);
    e.llamar('guardarCatalogo', 'Metas', base);
    assert.throws(e.falla('guardarCatalogo', 'Metas', base), /Ya existe|ya existe/);
  });

  prueba('metas: aportar mueve el dinero al bolsillo de la meta y suma al avance; usar el dinero es un gasto aparte', () => {
    const { e, casa, viaje, saldo } = escenario();
    const m = e.llamar('guardarCatalogo', 'Metas', { Nombre: 'Viaje', Monto_Objetivo: 1000000, Fecha_Inicio: hoy(), Fecha_Fin: mesMas(mesHoy(), 4) + '-01', ID_Bolsillo: viaje.ID_Bolsillo });
    const res = e.llamar('addAporteMeta', m.ID_Meta, casa.ID_Bolsillo, 300000, hoy());
    assert.strictEqual(res.ok, true, res.error);
    assert.strictEqual(saldo(viaje.ID_Bolsillo), 300000);
    assert.strictEqual(res.data.meta.ahorrado, 300000);
    assert.strictEqual(res.data.meta.aportadoMes, 300000);
    // El plan de este mes no cambia por aportar (se cuenta lo que faltaba al empezar el mes)
    assert.strictEqual(res.data.meta.planMes, 200000);
    const uso = e.llamar('addUsoMeta', m.ID_Meta, 50000, hoy(), 'Tiquetes', '');
    assert.strictEqual(uso.data.meta.usado, 50000);
    assert.strictEqual(uso.data.meta.ahorrado, 300000, 'usar no baja lo ahorrado');
    assert.strictEqual(saldo(viaje.ID_Bolsillo), 250000);
    // Los aportes no son ingresos ni gastos del mes
    const mov = e.llamar('listarMovimientos', { limite: 10 }).items.find(x => x.Concepto === 'Aporte a la meta Viaje');
    assert.ok(mov);
  });

  prueba('metas: entran al presupuesto como renglón Fondo (sin duplicar) y el aporte cuenta como real del renglón', () => {
    const { e, casa, viaje } = escenario();
    e.llamar('guardarCatalogo', 'Escenarios', { Nombre: 'Base', Es_Base: true });
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Mercado', Monto_Plan: 600000, Tipo: 'Gasto' });
    const m = e.llamar('guardarCatalogo', 'Metas', { Nombre: 'Carro', Motivo: 'Carro', Monto_Objetivo: 1200000, Fecha_Inicio: hoy(), Fecha_Fin: mesMas(mesHoy(), 5) + '-01', ID_Bolsillo: viaje.ID_Bolsillo });
    e.llamar('generarPresupuestoMes', mesHoy(), esc.ID_Escenario);
    let p = e.llamar('obtenerPresupuestoMes', mesHoy());
    const r = p.items.find(i => i.ID_Meta === m.ID_Meta);
    assert.ok(r, 'el renglón de la meta se crea al generar el mes');
    assert.strictEqual(r.Tipo, 'Fondo');
    assert.strictEqual(r.Plan, 200000);
    assert.strictEqual(p.faltanMetas, 0);
    // Repetir no duplica
    const otra = e.llamar('addSuscripcionesPpto', mesHoy());
    assert.strictEqual(otra.data.agregados, 0);
    // Cambiar el plan a mano pone al día el renglón
    e.llamar('guardarPlanMeta', m.ID_Meta, { [mesHoy()]: 300000 });
    p = e.llamar('obtenerPresupuestoMes', mesHoy());
    assert.strictEqual(p.items.find(i => i.ID_Meta === m.ID_Meta).Plan, 300000);
    // El aporte se enlaza al renglón del mes: cuenta una sola vez
    e.llamar('addAporteMeta', m.ID_Meta, casa.ID_Bolsillo, 300000, hoy());
    p = e.llamar('obtenerPresupuestoMes', mesHoy());
    assert.strictEqual(p.items.find(i => i.ID_Meta === m.ID_Meta).Real, 300000);
    assert.strictEqual(e.llamar('obtenerMeta', m.ID_Meta).ahorrado, 300000);
    // Una meta pausada deja su renglón (sin movimientos) en 0 en los meses que vienen
    e.llamar('guardarCatalogo', 'Metas', { ID_Meta: m.ID_Meta, Estado: 'Pausada' });
    assert.strictEqual(e.llamar('obtenerMetas').items[0].Estado, 'Pausada');
  });

  prueba('metas: una meta nueva con un presupuesto ya creado aparece como faltante hasta agregarla', () => {
    const { e, viaje } = escenario();
    e.llamar('guardarCatalogo', 'Escenarios', { Nombre: 'Base', Es_Base: true });
    const esc = e.llamar('listarCatalogo', 'Escenarios')[0];
    e.llamar('guardarCatalogo', 'Presupuesto_Plantilla', { ID_Escenario: esc.ID_Escenario, Concepto: 'Mercado', Monto_Plan: 600000, Tipo: 'Gasto' });
    e.llamar('generarPresupuestoMes', mesHoy(), esc.ID_Escenario);
    // Guardar la meta agrega su renglón a los presupuestos que ya existen de este mes en adelante
    const m = e.llamar('guardarCatalogo', 'Metas', { Nombre: 'Celular', Motivo: 'Tecnologia', Monto_Objetivo: 600000, Fecha_Inicio: hoy(), Fecha_Fin: mesMas(mesHoy(), 2) + '-01', ID_Bolsillo: viaje.ID_Bolsillo });
    const p = e.llamar('obtenerPresupuestoMes', mesHoy());
    assert.ok(p.items.some(i => i.ID_Meta === m.ID_Meta));
    assert.strictEqual(e.llamar('obtenerMetas').totales.planMes, 200000);
  });

  // ============================================================ lista de deseos
  prueba('lista de deseos: para mí (sin persona), categoría, ocasión y estado; los totales separan para mí y para otros', () => {
    const { e } = escenario();
    const p = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Mamá', Rol: 'Familiar' });
    e.llamar('guardarRegalo', { Anio: 2026, ID_Persona: p.ID_Persona, Idea: 'Perfume', Estimado: 150000, Ocasion: 'Navidad' });
    const yo = e.llamar('guardarRegalo', { Anio: 2026, Para: 'Yo', Idea: 'Sérum', Categoria: 'Cuidado_Personal', Estimado: 90000, Prioridad: 'Alta', Enlace: 'https://tienda.example/serum' });
    const v = e.llamar('obtenerRegalos', 2026);
    assert.strictEqual(v.items[0].Persona, 'Para mí', 'lo de uno va primero');
    assert.strictEqual(v.items[0].CategoriaNombre, 'Cuidado personal');
    assert.strictEqual(v.items[1].Categoria, 'Regalo');
    assert.strictEqual(v.totales.paraMi, 90000);
    assert.strictEqual(v.totales.paraOtros, 150000);
    assert.strictEqual(v.items[0].Estado, 'Idea');
    assert.throws(e.falla('guardarRegalo', { ID_Regalo: yo.ID_Regalo, Enlace: 'javascript:alert(1)' }), /http/);
    // Comprado sin registrar el gasto: con el precio pagado a mano
    e.llamar('guardarRegalo', { ID_Regalo: yo.ID_Regalo, Estado: 'Comprado', Precio_Pagado: 85000 });
    const it = e.llamar('obtenerRegalos', 2026).items.find(i => i.ID_Regalo === yo.ID_Regalo);
    assert.strictEqual(it.Real, 85000); assert.strictEqual(it.Comprado, true);
    // Descartado sale de los totales
    e.llamar('guardarRegalo', { ID_Regalo: yo.ID_Regalo, Estado: 'Descartado' });
    assert.strictEqual(e.llamar('obtenerRegalos', 2026).totales.paraMi, 0);
  });

  prueba('lista de deseos: lluvia de ideas, elegir una idea y quitar el deseo con sus ideas', () => {
    const { e } = escenario();
    const d = e.llamar('guardarRegalo', { Anio: 2026, Para: 'Yo', Estimado: 0, Categoria: 'Tecnologia' });
    e.llamar('saveIdeaDeseo', { ID_Regalo: d.ID_Regalo, Texto: 'Audífonos', Precio: 250000 });
    const v = e.llamar('saveIdeaDeseo', { ID_Regalo: d.ID_Regalo, Texto: 'Parlante', Precio: 180000, Enlace: 'https://x.example/p' }).data;
    const ideas = v.items[0].ideas;
    assert.strictEqual(ideas.length, 2);
    const elegida = e.llamar('chooseIdeaDeseo', ideas[1].ID_Idea).data.items[0];
    assert.strictEqual(elegida.Idea, 'Parlante');
    assert.strictEqual(elegida.Estimado, 180000, 'sin estimado, toma el precio de la idea');
    assert.strictEqual(elegida.Estado, 'Decidido');
    assert.deepStrictEqual(elegida.ideas.map(x => x.Elegida), [false, true]);
    assert.strictEqual(e.llamar('deleteIdeaDeseo', ideas[0].ID_Idea).data.items[0].ideas.length, 1);
    e.llamar('eliminarRegalo', d.ID_Regalo);
    assert.strictEqual(e.llamar('getTableData', 'Deseos_Ideas').length, 0);
  });

  prueba('lista de deseos: un regalo de antes (sin las columnas nuevas) se ve igual', () => {
    const { e } = escenario();
    const p = e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Ana', Rol: 'Otro' });
    // Fila como la dejaba la 1.15: Para/Categoria/Estado vacíos
    e.llamar('insertRow', 'Regalos', { ID_Regalo: 'reg-viejo', Anio: 2026, ID_Persona: p.ID_Persona, Idea: 'Libro', Estimado: 60000, Real: '', Aplica: true, ID_Mov: '', Notas: '', ID_Bolsillo_Plan: '' });
    const it = e.llamar('obtenerRegalos', 2026).items[0];
    assert.strictEqual(it.Persona, 'Ana');
    assert.strictEqual(it.Idea, 'Libro');
    assert.strictEqual(it.Estimado, 60000);
    assert.strictEqual(it.Categoria, 'Regalo');
    assert.strictEqual(it.ParaMi, false);
  });
};
