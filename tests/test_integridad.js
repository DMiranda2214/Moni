/**
 * Pruebas de la versión 1.11 (Propuesta 0): tasas con decimales, escrituras que no se equivocan de fila, vínculos que
 * sobreviven a editar las notas, categorías por rol, bloqueo reentrante y operaciones "todo o nada".
 */
const { bogota } = require('./fecha');

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const hoy = () => bogota();
  const hace = n => bogota(-n * 86400000);
  const TODOS = ['Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs'];

  function E() {
    const e = crearEntorno({});
    e.cargar(...TODOS);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    e.llamar('setupDatabase');
    return e;
  }

  function escenario() {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco' });
    const c1 = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const ahorroCta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 5000000 });
    const b = (n, s) => e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: c1.ID_Cuenta, Nombre: n, Saldo_Apertura: s || 0, Rol: 'Operativo' });
    const casa = b('Casa', 1000000), pagos = b('Para cuotas', 600000);
    const saldo = id => e.llamar('mapaSaldosBolsillos_')[id];
    return { e, banco, c1, ahorroCta, casa, pagos, saldo };
  }
  const nuevoCredito = (x, extra) => x.e.llamar('registrarCredito', Object.assign({ Nombre: 'Moto', ID_Cuenta_Ahorro: x.ahorroCta.ID_Cuenta, ID_Bolsillo_Pago: x.pagos.ID_Bolsillo,
    Fecha_Inicio: hace(3), Monto: 1200000, Periodicidad: 'Mensual', Num_Periodos: 12, desembolsar: false }, extra || {}));

  // ---------------------------------------------------------------- tasas
  prueba('tasas: una EA con decimales (9,5 %) ya no se redondea a 10 %', () => {
    const x = escenario();
    const r = nuevoCredito(x, { EA: 0.095 });
    const c = x.e.llamar('obtenerCredito', r.idCredito).credito;
    const esperado = x.e.llamar('tasaDesdeEA_', 0.095, 'Mensual', 'Exacta');
    assert.ok(Math.abs(c.Tasa_Periodica - esperado) < 1e-9, 'tasa periódica de 9,5 % EA');
    assert.ok(Math.abs(c.EA - 0.095) < 1e-6, 'la EA se conserva');
    assert.notStrictEqual(Number(c.Tasa_Periodica.toFixed(9)), Number(x.e.llamar('tasaDesdeEA_', 0.1, 'Mensual', 'Exacta').toFixed(9)));
  });

  prueba('tasas: una tasa por periodo de 0,4 % ya no se vuelve 0 %', () => {
    const x = escenario();
    const r = nuevoCredito(x, { Tasa_Periodica: 0.004, Periodicidad: 'Quincenal', Num_Periodos: 6 });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.credito.Tasa_Periodica, 0.004);
    assert.ok(d.cronograma[0].Interes > 0, 'la primera cuota tiene intereses');
  });

  prueba('tasas: el dinero sigue redondeado a 2 decimales', () => {
    const e = E();
    assert.strictEqual(e.llamar('numero_', 1234.5678, 'x'), 1234.57);
    assert.strictEqual(e.llamar('tasa_', 0.0123456789, 'x'), 0.012345679);
  });

  prueba('tasas: un crédito viejo con tasa "redonda" pide revisión; corregirla rehace solo las cuotas pendientes', () => {
    const x = escenario();
    const r = nuevoCredito(x, { EA: 0.10 });
    // Simula un crédito creado antes de la corrección
    const fila = x.e.hojas.Creditos.filas;
    const colCreado = fila[0].indexOf('Creado_En');
    fila[1][colCreado] = '2026-10-01T10:00:00';
    x.e.ejecutar('invalidateCache()');
    assert.ok(x.e.llamar('obtenerAvisos_').some(a => a.id === 'tasa_credito_' + r.idCredito), 'aparece el aviso');

    x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    const antes = x.e.llamar('obtenerCredito', r.idCredito);
    const saldoPagos = x.saldo(x.pagos.ID_Bolsillo);
    x.e.llamar('corregirTasaCredito', r.idCredito, { EA: 0.095 });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.strictEqual(d.cronograma.filter(f => f.Estado === 'Pagada').length, 1, 'la cuota pagada sigue pagada');
    assert.deepStrictEqual(d.cronograma[0], antes.cronograma[0], 'la cuota pagada no cambia');
    assert.strictEqual(d.cronograma.length, 12, 'mismo número de cuotas');
    assert.ok(d.cronograma[1].Cuota < antes.cronograma[1].Cuota, 'con menos tasa, la cuota baja');
    assert.ok(Math.abs(d.cronograma[11].Saldo_Final) < 0.01, 'termina en cero');
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), saldoPagos, 'no mueve dinero');
    assert.ok(!x.e.llamar('obtenerAvisos_').some(a => a.id === 'tasa_credito_' + r.idCredito), 'el aviso se va');
    assert.throws(x.e.falla('anularPagoCredito', d.pagos[0].ID_Pago), /se corrigió la tasa/);
  });

  prueba('tasas: confirmar que la tasa está bien solo quita el aviso', () => {
    const x = escenario();
    const r = nuevoCredito(x, { EA: 0.12 });
    const fila = x.e.hojas.Creditos.filas;
    fila[1][fila[0].indexOf('Creado_En')] = '2026-10-01T10:00:00';
    x.e.ejecutar('invalidateCache()');
    const antes = x.e.llamar('obtenerCredito', r.idCredito).cronograma;
    x.e.llamar('corregirTasaCredito', r.idCredito, { soloConfirmar: true });
    assert.deepStrictEqual(x.e.llamar('obtenerCredito', r.idCredito).cronograma, antes);
    assert.ok(!x.e.llamar('obtenerAvisos_').some(a => a.id === 'tasa_credito_' + r.idCredito));
  });

  prueba('tasas: un crédito bancario usa la equivalencia exacta aunque la configuración diga Excel', () => {
    const x = escenario();
    x.e.ejecutar("updateRow('Config', getTableData('Config').find(c => c.Clave === 'Credito_Metodo_Tasa'), { Valor: 'Excel' })");
    const r = x.e.llamar('registrarCredito', { Tipo_Credito: 'Bancario', Nombre: 'Libre', Monto: 10000000, EA: 0.24, Periodicidad: 'Mensual', Num_Periodos: 36,
      Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.pagos.ID_Bolsillo });
    const c = x.e.llamar('obtenerCredito', r.idCredito).credito;
    assert.ok(Math.abs(c.Tasa_Periodica - 0.018087582) < 1e-9, '24 % EA → 1,8088 % mensual, no 1,8925 %');
    assert.strictEqual(r.cuota, x.e.llamar('cuotaFrancesa_', 10000000, c.Tasa_Periodica, 36));
    assert.strictEqual(c.metodoPorRevisar, null);
    // El autopago sigue con lo que diga la configuración (el Excel de referencia de quien ya usaba Moni)
    const a = nuevoCredito(x, { EA: 0.10 });
    assert.ok(Math.abs(x.e.llamar('obtenerCredito', a.idCredito).credito.Tasa_Periodica - x.e.llamar('tasaDesdeEA_', 0.10, 'Mensual', 'Excel')) < 1e-9);
  });

  prueba('tasas: un crédito bancario viejo con el método aproximado avisa y se recalcula con la misma EA solo si la persona quiere', () => {
    const x = escenario();
    const r = x.e.llamar('registrarCredito', { Tipo_Credito: 'Bancario', Nombre: 'Carro', Monto: 10000000, EA: 0.24, Periodicidad: 'Mensual', Num_Periodos: 36,
      Fecha_Inicio: hace(2), ID_Bolsillo_Pago: x.pagos.ID_Bolsillo });
    // Simula un crédito bancario creado en la 1.13–1.18, con la tasa convertida por el método "Excel"
    const h = x.e.hojas.Creditos.filas, col = k => h[0].indexOf(k);
    h[1][col('Metodo_Tasa')] = 'Excel';
    h[1][col('Tasa_Periodica')] = x.e.llamar('tasaDesdeEA_', 0.24, 'Mensual', 'Excel');
    x.e.ejecutar('invalidateCache()');
    x.e.llamar('corregirTasaCredito', r.idCredito, { Tasa_Periodica: h[1][col('Tasa_Periodica')] }); // cronograma con la tasa vieja
    h[1][col('Metodo_Tasa')] = 'Excel';
    h[1][col('Notas')] = '';
    x.e.ejecutar('invalidateCache()');
    x.e.llamar('registrarPagoCredito', r.idCredito, undefined, hoy());
    const antes = x.e.llamar('obtenerCredito', r.idCredito);
    const mp = antes.credito.metodoPorRevisar;
    assert.ok(mp, 'propone revisar el método');
    assert.ok(Math.abs(mp.EA - 0.24) < 1e-6 && mp.cuotaExacta < mp.cuotaActual, 'misma EA, cuota menor');
    assert.ok(x.e.llamar('obtenerAvisos_').some(a => a.id === 'metodo_credito_' + r.idCredito), 'aparece el aviso');
    const saldo = x.saldo(x.pagos.ID_Bolsillo);
    x.e.llamar('corregirTasaCredito', r.idCredito, { metodo: 'Exacta' });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.deepStrictEqual(d.cronograma[0], antes.cronograma[0], 'la cuota pagada no cambia');
    assert.ok(Math.abs(d.credito.Tasa_Periodica - 0.018087582) < 1e-9);
    assert.ok(Math.abs(d.credito.EA - 0.24) < 1e-6, 'conserva la EA');
    assert.strictEqual(d.credito.Cuota_Fija, mp.cuotaExacta);
    assert.strictEqual(d.cronograma.length, 36);
    assert.ok(Math.abs(d.cronograma[35].Saldo_Final) < 0.01, 'termina en cero');
    assert.strictEqual(x.saldo(x.pagos.ID_Bolsillo), saldo, 'no mueve dinero');
    assert.strictEqual(d.credito.metodoPorRevisar, null);
    assert.ok(!x.e.llamar('obtenerAvisos_').some(a => a.id === 'metodo_credito_' + r.idCredito), 'el aviso se va');
  });

  prueba('tasas: dejar el método como está solo quita el aviso del crédito bancario', () => {
    const x = escenario();
    const r = x.e.llamar('registrarCredito', { Tipo_Credito: 'Bancario', Nombre: 'Moto', Monto: 5000000, EA: 0.2, Periodicidad: 'Mensual', Num_Periodos: 12,
      Fecha_Inicio: hoy(), ID_Bolsillo_Pago: x.pagos.ID_Bolsillo });
    const h = x.e.hojas.Creditos.filas;
    h[1][h[0].indexOf('Metodo_Tasa')] = 'Excel';
    x.e.ejecutar('invalidateCache()');
    const antes = x.e.llamar('obtenerCredito', r.idCredito).cronograma;
    assert.ok(x.e.llamar('obtenerCredito', r.idCredito).credito.metodoPorRevisar);
    x.e.llamar('corregirTasaCredito', r.idCredito, { metodo: 'Exacta', soloConfirmar: true });
    const d = x.e.llamar('obtenerCredito', r.idCredito);
    assert.deepStrictEqual(d.cronograma, antes);
    assert.strictEqual(d.credito.metodoPorRevisar, null);
    assert.ok(!x.e.llamar('obtenerAvisos_').some(a => a.id === 'metodo_credito_' + r.idCredito));
  });

  // ---------------------------------------------------------------- filas
  prueba('updateRow con el registro: si la fila se movió (alguien borró una fila a mano), escribe en la correcta', () => {
    const x = escenario();
    const m1 = x.e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Uno', Valor: 100, ID_Bolsillo: x.casa.ID_Bolsillo });
    const m2 = x.e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Dos', Valor: 200, ID_Bolsillo: x.casa.ID_Bolsillo });
    const leido = x.e.llamar('getTableData', 'Movimientos').find(m => m.ID_Mov === m2.ID_Mov);
    // Se borra a mano la primera fila de datos: m2 sube una fila y el _rowIndex leído queda viejo
    x.e.hojas.Movimientos.filas.splice(1, 1);
    x.e.ctx.__reg = leido;
    x.e.ejecutar("updateRow('Movimientos', __reg, { Concepto: 'Dos corregido' })");
    const filas = x.e.hojas.Movimientos.filas;
    const col = filas[0].indexOf('Concepto'), colId = filas[0].indexOf('ID_Mov');
    assert.strictEqual(filas.find(f => f[colId] === m2.ID_Mov)[col], 'Dos corregido');
    assert.ok(!filas.some(f => f[colId] !== m2.ID_Mov && f[col] === 'Dos corregido'), 'ningún otro registro se tocó');
    assert.ok(m1);
  });

  prueba('updateRow con un registro que ya no existe: falla sin escribir en otra fila', () => {
    const x = escenario();
    const m = x.e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Uno', Valor: 100, ID_Bolsillo: x.casa.ID_Bolsillo });
    x.e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'Otro', Valor: 50, ID_Bolsillo: x.casa.ID_Bolsillo });
    const leido = x.e.llamar('getTableData', 'Movimientos').find(r => r.ID_Mov === m.ID_Mov);
    const filas = x.e.hojas.Movimientos.filas;
    filas.splice(filas.findIndex(f => f[0] === m.ID_Mov), 1);
    x.e.ctx.__reg = leido;
    assert.throws(() => x.e.ejecutar("updateRow('Movimientos', __reg, { Concepto: 'X' })"), /ya no está/);
    assert.ok(!filas.some(f => f.indexOf('X') !== -1));
  });

  prueba('updateRows_: varias filas con un bloqueo y pocas escrituras', () => {
    const x = escenario();
    for (let i = 0; i < 4; i++) x.e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy(), Concepto: 'M' + i, Valor: 10 + i, ID_Bolsillo: x.casa.ID_Bolsillo });
    const movs = x.e.llamar('getTableData', 'Movimientos');
    const bloqueosAntes = x.e.registro.bloqueos.length;
    x.e.ctx.__lista = movs.map(m => ({ fila: m, cambios: { Notas: 'lote' } }));
    x.e.ejecutar("updateRows_('Movimientos', __lista)");
    assert.strictEqual(x.e.registro.bloqueos.length - bloqueosAntes, 1, 'un solo bloqueo');
    const col = x.e.hojas.Movimientos.filas[0].indexOf('Notas');
    assert.strictEqual(x.e.hojas.Movimientos.filas.slice(1).filter(f => f[col] === 'lote').length, movs.length);
  });

  // ---------------------------------------------------------------- bloqueo
  prueba('bloqueo reentrante: una operación lo toma una vez y sus escrituras internas no lo sueltan', () => {
    const e = E();
    const antes = e.registro.bloqueos.length;
    e.ejecutar("conBloqueo_(() => { guardarConfig_('Nombre_Usuario', 'Ana'); guardarConfig_('Moneda', 'COP'); })");
    assert.strictEqual(e.registro.bloqueos.length - antes, 1);
    assert.strictEqual(e.ejecutar('BLOQUEO_ACTUAL'), null, 'al terminar queda libre');
  });

  prueba('transacción: si un paso falla, se deshace lo anterior', () => {
    const x = escenario();
    x.e.ctx.__casa = x.casa.ID_Bolsillo;
    assert.throws(() => x.e.ejecutar(`transaccion_(alDeshacer => {
      const m = registrarMovimiento({ Tipo_Mov: 'Gasto', Fecha: hoyIso_(), Concepto: 'A medias', Valor: 1000, ID_Bolsillo: __casa });
      alDeshacer(() => anularMovimiento(m.ID_Mov));
      throw new Error('falla a propósito');
    })`), /a propósito/);
    assert.strictEqual(x.saldo(x.casa.ID_Bolsillo), 1000000, 'el saldo quedó como estaba');
  });

  prueba('compra con tarjeta que aparta dinero: si no se puede guardar, el dinero vuelve', () => {
    const x = escenario();
    const personal = x.e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: x.c1.ID_Cuenta, Nombre: 'Personal', Saldo_Apertura: 300000, Rol: 'Operativo' });
    const t = x.e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: x.banco.ID_Banco, Nombre: 'Visa', Cupo: 2000000, Dia_Corte: 15, Dia_Pago: 28, ID_Bolsillo_Personal: personal.ID_Bolsillo },
      { crearReserva: { ID_Cuenta: x.c1.ID_Cuenta } });
    // Rompe la tabla de compras para que falle el último paso
    const hoja = x.e.hojas.Compras_TC;
    const original = hoja.appendRow.bind(hoja);
    hoja.appendRow = () => { throw new Error('Sheets no responde'); };
    assert.throws(x.e.falla('registrarCompraTC', { ID_Tarjeta: t.ID_Tarjeta, Fecha: hoy(), Concepto: 'Ropa', Valor: 50000, Fuente: 'Guardar' }), /no responde/);
    hoja.appendRow = original;
    assert.strictEqual(x.saldo(personal.ID_Bolsillo), 300000, 'el dinero apartado volvió');
  });

  // ---------------------------------------------------------------- vínculos
  prueba('vínculos: editar las notas de un pago de regalo no lo desliga del regalo', () => {
    const x = escenario();
    const p = x.e.llamar('guardarCatalogo', 'Personas', { Nombre: 'Mamá' });
    const r = x.e.llamar('guardarRegalo', { ID_Persona: p.ID_Persona, Anio: Number(hoy().slice(0, 4)), Estimado: 100000, Idea: 'Libro' });
    const pago = x.e.llamar('registrarGastoRegalo', r.ID_Regalo, 80000, x.casa.ID_Bolsillo, hoy());
    const idMov = (pago.ids || [pago.ID_Mov]).filter(Boolean)[0] || x.e.llamar('getTableData', 'Movimientos').find(m => m.Concepto.indexOf('Regalo') === 0).ID_Mov;
    const real = () => x.e.llamar('realPorRegalo_')[r.ID_Regalo];
    assert.strictEqual(real(), 80000);
    // Un movimiento de antes de 1.11 (sin Ref) que la persona edita
    const filas = x.e.hojas.Movimientos.filas, colRef = filas[0].indexOf('Ref');
    filas.forEach((f, i) => { if (i > 0) f[colRef] = ''; });
    x.e.ejecutar('invalidateCache()');
    x.e.llamar('editarMovimiento', idMov, { Notas: 'Lo compré en la feria' });
    assert.strictEqual(real(), 80000, 'sigue contando en el regalo');
    const mov = x.e.llamar('getTableData', 'Movimientos').find(m => m.ID_Mov === idMov);
    assert.strictEqual(mov.Notas, 'Lo compré en la feria');
    assert.strictEqual(mov.Ref.indexOf('Regalo '), 0);
  });

  prueba('vínculos: los movimientos nuevos guardan su vínculo en Ref', () => {
    const x = escenario();
    const r = nuevoCredito(x, { EA: 0.1, desembolsar: true, Fecha_Inicio: hoy() });
    const m = x.e.llamar('getTableData', 'Movimientos').find(mv => mv.ID_Mov === r.ids[0]);
    assert.strictEqual(m.Ref, 'Crédito ' + r.idCredito);
  });

  // ---------------------------------------------------------------- categorías
  prueba('categorías por rol: las nuevas traen rol; las de antes se reconocen por su ID; renombrarlas no rompe nada', () => {
    const e = E();
    assert.strictEqual(e.llamar('categoriaPorRol_', 'Salario').ID_Categoria, 'cat-salario');
    // Hoja de antes: sin rol
    const filas = e.hojas.Categorias.filas, colRol = filas[0].indexOf('Rol');
    filas.forEach((f, i) => { if (i > 0) f[colRol] = ''; });
    e.ejecutar('invalidateCache()');
    assert.strictEqual(e.llamar('categoriaPorRol_', 'Rendimiento').ID_Categoria, 'cat-rendim');
    e.llamar('guardarCatalogo', 'Categorias', { ID_Categoria: 'cat-regalos', Nombre: 'Detalles y regalos', Tipo: 'Gasto' });
    assert.strictEqual(e.llamar('categoriaPorRol_', 'Regalos').Nombre, 'Detalles y regalos');
  });
};
