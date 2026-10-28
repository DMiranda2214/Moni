/**
 * Pruebas de la Fase 1: instalación del esquema, catálogos personalizables, saldos,
 * datos de demostración y API.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));

  /** Entorno con el esquema ya instalado. */
  function E(instalar) {
    const e = crearEntorno({});
    e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Api.gs');
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    if (instalar !== false) e.llamar('setupDatabase');
    return e;
  }
  const filas = (e, tabla) => e.hojas[tabla].filas.slice(1).filter(f => f.some(c => c !== '' && c !== undefined));

  // Datos base reutilizables
  function conBancoYCuenta(e, cuenta) {
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Uno' });
    const c = e.llamar('guardarCatalogo', 'Cuentas', Object.assign({ ID_Banco: banco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' }, cuenta || {}));
    return { banco, cuenta: c };
  }

  // ---------------------------------------------------------------- instalación
  prueba('setupDatabase crea las 27 tablas con sus encabezados', () => {
    const e = E(false);
    const r = e.llamar('setupDatabase');
    assert.strictEqual(r.tablas, 27);
    assert.strictEqual(r.creadas.length, 27);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(e.hojas.Movimientos.filas[0][0], 'ID_Mov');
    assert.strictEqual(e.hojas.Movimientos.filas[0].slice(-2).join(), 'Creado_En,Actualizado_En');
  });

  prueba('setupDatabase siembra Config, categorías y el escenario base una sola vez', () => {
    const e = E();
    const antes = [filas(e, 'Config').length, filas(e, 'Categorias').length, filas(e, 'Escenarios').length];
    assert.ok(antes[0] > 15 && antes[1] === 15 && antes[2] === 1);
    const r = e.llamar('setupDatabase');
    assert.strictEqual(r.creadas.length, 0, 'segunda ejecución no crea nada');
    assert.deepStrictEqual([filas(e, 'Config').length, filas(e, 'Categorias').length, filas(e, 'Escenarios').length], antes);
  });

  prueba('setupDatabase no toca una pestaña con encabezados distintos y la reporta', () => {
    const e = E(false);
    e.hojas.Bancos = new (e.hojas.constructor === Object ? Object : Object)();
    delete e.hojas.Bancos;
    e.ctx.SpreadsheetApp.openById().insertSheet('Bancos').filas.push(['Otro', 'Esquema'], ['dato', 'x']);
    const r = e.llamar('setupDatabase');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.diferencias.length, 1);
    assert.strictEqual(r.diferencias[0].tabla, 'Bancos');
    assert.strictEqual(e.hojas.Bancos.filas[1][0], 'dato', 'los datos existentes no se modifican');
  });

  prueba('los valores con forma de fecha se guardan como texto plano (Mes, Config.Valor, código de pago)', () => {
    const e = E();
    assert.strictEqual(e.hojas.Presupuesto_Mes.formatos[2], '@');
    assert.strictEqual(e.hojas.Config.formatos[2], '@');
    assert.strictEqual(e.hojas.Servicios_Publicos.formatos[5], '@');
  });

  // ---------------------------------------------------------------- auditoría
  prueba('insertar y editar completan Creado_En y Actualizado_En', () => {
    const e = E();
    const b = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Uno' });
    const fila = e.hojas.Bancos.filas[1];
    const h = e.hojas.Bancos.filas[0];
    assert.match(fila[h.indexOf('Creado_En')], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    e.hojas.Bancos.filas[1][h.indexOf('Actualizado_En')] = 'viejo';
    e.llamar('guardarCatalogo', 'Bancos', { ID_Banco: b.ID_Banco, Nombre: 'Banco Uno B' });
    assert.notStrictEqual(e.hojas.Bancos.filas[1][h.indexOf('Actualizado_En')], 'viejo');
  });

  // ---------------------------------------------------------------- bancos
  prueba('bancos: nombre obligatorio y único; editar conserva el orden', () => {
    const e = E();
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { Nombre: '  ' }), /obligatorio/);
    const b = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Uno' });
    assert.throws(e.falla('guardarCatalogo', 'Bancos', { Nombre: 'banco uno' }), /Ya existe/);
    const b2 = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Dos' });
    assert.strictEqual(b2.Orden, 2);
    e.llamar('guardarCatalogo', 'Bancos', { ID_Banco: b.ID_Banco, Nombre: 'Banco Uno Plus' });
    const lista = e.llamar('listarCatalogo', 'Bancos');
    assert.strictEqual(lista[0].Nombre, 'Banco Uno Plus');
    assert.strictEqual(lista[0].Orden, 1, 'el orden se conserva al editar');
  });

  prueba('bancos: no se desactiva con cuentas activas; sí cuando ya no tiene', () => {
    const e = E();
    const { banco, cuenta } = conBancoYCuenta(e);
    assert.throws(e.falla('desactivarCatalogo', 'Bancos', banco.ID_Banco), /cuenta\(s\) activa/);
    e.llamar('desactivarCatalogo', 'Cuentas', cuenta.ID_Cuenta);
    const r = e.llamar('desactivarCatalogo', 'Bancos', banco.ID_Banco);
    assert.strictEqual(r.Activo, false);
    assert.strictEqual(e.llamar('listarCatalogo', 'Bancos').length, 0);
    assert.strictEqual(e.llamar('listarCatalogo', 'Bancos', { incluirInactivos: true }).length, 1);
  });

  // ---------------------------------------------------------------- cuentas y bolsillos
  prueba('cuentas: el tipo Débito no permite bolsillos por defecto; Billetera sí', () => {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    const d = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Débito', Tipo: 'Debito' });
    const w = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Billetera', Tipo: 'Billetera' });
    assert.strictEqual(d.Permite_Bolsillos, false);
    assert.strictEqual(w.Permite_Bolsillos, true);
    assert.throws(e.falla('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'X', Tipo: 'Inventado' }), /tipo no es válido/);
  });

  prueba('cuenta sin bolsillos: crea el bolsillo interno "General" con el saldo inicial', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e, { Nombre: 'Débito', Tipo: 'Debito', Saldo_Apertura: 85000 });
    const bol = e.llamar('listarCatalogo', 'Bolsillos');
    assert.strictEqual(bol.length, 1);
    assert.strictEqual(bol[0].Rol, 'General');
    assert.strictEqual(bol[0].Es_Interno, true);
    assert.strictEqual(bol[0].Saldo_Apertura, 85000);
    assert.strictEqual(bol[0].ID_Cuenta, cuenta.ID_Cuenta);
    // Editar el saldo inicial de la cuenta actualiza el bolsillo interno
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Cuenta: cuenta.ID_Cuenta, Saldo_Apertura: 90000 });
    assert.strictEqual(e.llamar('listarCatalogo', 'Bolsillos')[0].Saldo_Apertura, 90000);
  });

  prueba('bolsillos: solo en cuentas que los permiten; nombre único por cuenta; no se mueven de cuenta', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e);
    const sin = conBancoYCuenta;
    const banco2 = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Dos' });
    const debito = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco2.ID_Banco, Nombre: 'Débito', Tipo: 'Debito' });
    assert.throws(e.falla('guardarCatalogo', 'Bolsillos', { ID_Cuenta: debito.ID_Cuenta, Nombre: 'Casa' }), /no permite bolsillos/);

    const casa = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 1250000 });
    assert.strictEqual(casa.Rol, 'Operativo');
    assert.throws(e.falla('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'CASA' }), /Ya existe/);
    assert.throws(e.falla('guardarCatalogo', 'Bolsillos', { ID_Bolsillo: casa.ID_Bolsillo, ID_Cuenta: debito.ID_Cuenta }), /otra cuenta/);
    assert.throws(e.falla('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Z', Rol: 'General' }), /rol no es válido/);
    assert.ok(sin);
  });

  prueba('bolsillos: puede haber saldo de apertura negativo', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e);
    const b = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Personal', Saldo_Apertura: -82840.34 });
    assert.strictEqual(b.Saldo_Apertura, -82840.34);
  });

  prueba('cambiar de "con bolsillos" a "sin bolsillos" exige dejar uno solo', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e);
    e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'A' });
    const b = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'B' });
    assert.throws(e.falla('guardarCatalogo', 'Cuentas', { ID_Cuenta: cuenta.ID_Cuenta, Permite_Bolsillos: false }), /2 bolsillos activos/);
    e.llamar('desactivarCatalogo', 'Bolsillos', b.ID_Bolsillo);
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Cuenta: cuenta.ID_Cuenta, Permite_Bolsillos: false });
    const quedan = e.llamar('listarCatalogo', 'Bolsillos');
    assert.strictEqual(quedan.length, 1);
    assert.strictEqual(quedan[0].Es_Interno, true);
    assert.strictEqual(quedan[0].Rol, 'General');
    // y de vuelta: el interno pasa a ser un bolsillo normal
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Cuenta: cuenta.ID_Cuenta, Permite_Bolsillos: true });
    const despues = e.llamar('listarCatalogo', 'Bolsillos')[0];
    assert.strictEqual(despues.Es_Interno, false);
    assert.strictEqual(despues.Rol, 'Operativo');
  });

  prueba('un bolsillo con saldo distinto de cero no se desactiva', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e);
    const b = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 500 });
    assert.throws(e.falla('desactivarCatalogo', 'Bolsillos', b.ID_Bolsillo), /saldo distinto de cero/);
    e.llamar('guardarCatalogo', 'Bolsillos', { ID_Bolsillo: b.ID_Bolsillo, Saldo_Apertura: 0 });
    assert.strictEqual(e.llamar('desactivarCatalogo', 'Bolsillos', b.ID_Bolsillo).Activo, false);
  });

  prueba('el bolsillo interno no se desactiva solo; al desactivar la cuenta se desactiva con ella', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e, { Tipo: 'Debito', Nombre: 'Débito' });
    const interno = e.llamar('listarCatalogo', 'Bolsillos')[0];
    assert.throws(e.falla('desactivarCatalogo', 'Bolsillos', interno.ID_Bolsillo), /saldo interno/);
    e.llamar('desactivarCatalogo', 'Cuentas', cuenta.ID_Cuenta);
    assert.strictEqual(e.llamar('listarCatalogo', 'Bolsillos').length, 0);
  });

  prueba('reactivar exige que lo que lo contiene siga activo', () => {
    const e = E();
    const { banco, cuenta } = conBancoYCuenta(e);
    e.llamar('desactivarCatalogo', 'Cuentas', cuenta.ID_Cuenta);
    e.llamar('desactivarCatalogo', 'Bancos', banco.ID_Banco);
    assert.throws(e.falla('reactivarCatalogo', 'Cuentas', cuenta.ID_Cuenta), /banco de la cuenta está desactivado/);
    e.llamar('reactivarCatalogo', 'Bancos', banco.ID_Banco);
    assert.strictEqual(e.llamar('reactivarCatalogo', 'Cuentas', cuenta.ID_Cuenta).Activo, true);
  });

  // ---------------------------------------------------------------- tarjetas
  prueba('tarjetas: crear con reserva nueva, validar días y rol de la reserva', () => {
    const e = E();
    const { banco, cuenta } = conBancoYCuenta(e);
    const t = e.llamar('guardarCatalogo', 'Tarjetas',
      { ID_Banco: banco.ID_Banco, Nombre: 'Tarjeta Azul', Cupo: 3000000, Dia_Corte: 15, Dia_Pago: 28 },
      { crearReserva: { ID_Cuenta: cuenta.ID_Cuenta } });
    const reserva = e.llamar('listarCatalogo', 'Bolsillos').find(b => b.ID_Bolsillo === t.ID_Bolsillo_Reserva);
    assert.strictEqual(reserva.Rol, 'Reserva_Tarjeta');
    assert.strictEqual(reserva.Nombre, 'Reserva Tarjeta Azul');

    assert.throws(e.falla('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Mala', Dia_Corte: 32, Dia_Pago: 5, ID_Bolsillo_Reserva: reserva.ID_Bolsillo }), /no puede ser mayor que 31/);
    assert.throws(e.falla('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Mala', Dia_Corte: 5, ID_Bolsillo_Reserva: reserva.ID_Bolsillo }), /día de pago es obligatorio/);
    const operativo = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa' });
    assert.throws(e.falla('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'Otra', Dia_Corte: 5, Dia_Pago: 20, ID_Bolsillo_Reserva: operativo.ID_Bolsillo }), /rol "Reserva de tarjeta"/);
  });

  prueba('tarjetas: la reserva en una cuenta sin bolsillos se rechaza con un mensaje claro', () => {
    const e = E();
    const { banco, cuenta } = conBancoYCuenta(e, { Tipo: 'Debito', Nombre: 'Débito' });
    assert.throws(e.falla('guardarCatalogo', 'Tarjetas',
      { ID_Banco: banco.ID_Banco, Nombre: 'T', Dia_Corte: 5, Dia_Pago: 20 },
      { crearReserva: { ID_Cuenta: cuenta.ID_Cuenta } }), /no permite bolsillos/);
  });

  prueba('un bolsillo que usa una tarjeta no se desactiva', () => {
    const e = E();
    const { banco, cuenta } = conBancoYCuenta(e);
    const t = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: banco.ID_Banco, Nombre: 'T', Dia_Corte: 5, Dia_Pago: 20 }, { crearReserva: { ID_Cuenta: cuenta.ID_Cuenta } });
    assert.throws(e.falla('desactivarCatalogo', 'Bolsillos', t.ID_Bolsillo_Reserva), /tarjeta\(s\)/);
  });

  // ---------------------------------------------------------------- otros catálogos
  prueba('categorías: único por tipo (puede haber "Regalos" de gasto e ingreso)', () => {
    const e = E();
    e.llamar('guardarCatalogo', 'Categorias', { Nombre: 'Regalos recibidos', Tipo: 'Ingreso' });
    assert.throws(e.falla('guardarCatalogo', 'Categorias', { Nombre: 'Mercado', Tipo: 'Gasto' }), /Ya existe/);
    assert.ok(e.llamar('guardarCatalogo', 'Categorias', { Nombre: 'Mercado', Tipo: 'Ingreso' }).ID_Categoria);
  });

  prueba('servicios públicos: exige inmueble activo y rechaza enlaces peligrosos', () => {
    const e = E();
    const inm = e.llamar('guardarCatalogo', 'Inmuebles', { Nombre: 'Casa' });
    const base = { ID_Inmueble: inm.ID_Inmueble, Tipo: 'Luz', Codigo_Pago: '00123' };
    assert.throws(e.falla('guardarCatalogo', 'Servicios_Publicos', Object.assign({}, base, { URL_Pago: 'javascript:alert(1)' })), /http/);
    const s = e.llamar('guardarCatalogo', 'Servicios_Publicos', Object.assign({}, base, { URL_Pago: 'https://pagos.example.com' }));
    assert.strictEqual(s.Codigo_Pago, '00123', 'el código conserva los ceros');
    assert.throws(e.falla('desactivarCatalogo', 'Inmuebles', inm.ID_Inmueble), /servicio\(s\) activo/);
  });

  prueba('escenarios: un solo base; no se puede quitar la marca; copiar renglones de otro', () => {
    const e = E();
    const base = e.llamar('listarCatalogo', 'Escenarios')[0];
    assert.throws(e.falla('guardarCatalogo', 'Escenarios', { ID_Escenario: base.ID_Escenario, Es_Base: false }), /escenario base/);
    assert.throws(e.falla('desactivarCatalogo', 'Escenarios', base.ID_Escenario), /escenario base/);

    // un renglón en el escenario base, para copiarlo
    e.llamar('insertRow', 'Presupuesto_Plantilla', { ID_Plantilla: 'p1', ID_Escenario: base.ID_Escenario, Concepto: 'Arriendo', Monto_Plan: 900000, Tipo: 'Gasto', Activo: true, Orden: 1 });
    const cont = e.llamar('guardarCatalogo', 'Escenarios', { Nombre: 'Contingencia', Es_Base: false }, { copiarDe: base.ID_Escenario });
    const copiados = filas(e, 'Presupuesto_Plantilla').filter(f => f[1] === cont.ID_Escenario);
    assert.strictEqual(copiados.length, 1);
    assert.strictEqual(copiados[0][2], 'Arriendo');

    // pasar la marca de base al nuevo deja uno solo
    e.llamar('guardarCatalogo', 'Escenarios', { ID_Escenario: cont.ID_Escenario, Es_Base: true });
    const bases = e.llamar('listarCatalogo', 'Escenarios').filter(x => x.Es_Base === true);
    assert.strictEqual(bases.length, 1);
    assert.strictEqual(bases[0].ID_Escenario, cont.ID_Escenario);
  });

  prueba('solo los catálogos declarados se pueden leer o escribir por la API', () => {
    const e = E();
    const r = e.llamar('listCatalogo', 'Movimientos');
    assert.strictEqual(r.ok, false);
    assert.match(r.error.message, /no es un catálogo/);
    assert.strictEqual(e.llamar('saveCatalogo', 'Config', { Clave: 'x' }).ok, false);
    assert.strictEqual(e.llamar('listCatalogo', 'constructor').ok, false);
  });

  // ---------------------------------------------------------------- saldos
  prueba('saldos: apertura + movimientos, por fecha, sin anulados, y cuadre con el saldo real', () => {
    const e = E();
    const { cuenta } = conBancoYCuenta(e, { Saldo_Real: 1300000, Fecha_Saldo_Real: '2027-01-10' });
    const a = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 1000000 });
    const mov = (id, fecha, valor, anulado) => e.llamar('insertRow', 'Movimientos', { ID_Mov: id, Fecha: fecha, Concepto: id, ID_Bolsillo: a.ID_Bolsillo, Valor: valor, Tipo_Mov: 'Gasto', Anulado: !!anulado });
    mov('m1', '2027-01-05', -100000);
    mov('m2', '2027-01-20', 500000);
    mov('m3', '2027-01-06', -999, true);

    const hoy = e.llamar('obtenerSaldos');
    assert.strictEqual(hoy.cuentas[0].Saldo, 1400000);
    assert.strictEqual(hoy.cuentas[0].Diferencia, -100000, 'real − app');
    assert.strictEqual(e.llamar('obtenerSaldos', '2027-01-10').cuentas[0].Saldo, 900000, 'a una fecha, sin el ingreso posterior');
    assert.strictEqual(hoy.total, 1400000);
  });

  prueba('saldos: el ahorro se separa del dinero disponible', () => {
    const e = E();
    const banco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'B' });
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Diaria', Tipo: 'Debito', Saldo_Apertura: 100 });
    e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: banco.ID_Banco, Nombre: 'Ahorros', Tipo: 'Ahorro', Permite_Bolsillos: false, Saldo_Apertura: 900 });
    const s = e.llamar('obtenerSaldos');
    assert.strictEqual(s.disponible, 100);
    assert.strictEqual(s.ahorro, 900);
    assert.strictEqual(s.total, 1000);
  });

  // ---------------------------------------------------------------- demo
  prueba('demo: siembra datos coherentes y marca Datos_Demo', () => {
    const e = E();
    const r = e.llamar('sembrarDatosDemo');
    assert.strictEqual(r.bancos, 3);
    assert.strictEqual(r.cuentas, 4);
    const cfg = e.llamar('getTableData', 'Config').find(c => c.Clave === 'Datos_Demo');
    assert.strictEqual(String(cfg.Valor).toUpperCase(), 'TRUE');

    const s = e.llamar('obtenerSaldos');
    assert.strictEqual(s.cuentas.length, 4);
    const sinBolsillos = s.cuentas.filter(c => !c.Permite_Bolsillos);
    assert.strictEqual(sinBolsillos.length, 2);
    // La transferencia demo suma cero: el total de la cuenta 1 solo cambia por los gastos
    const c1 = s.cuentas.find(c => c.Nombre === 'Billetera principal');
    assert.strictEqual(c1.Saldo, 1250000 + 180000 + 320000 + 60000 + 95000 + 120000 - 85500 - 12000 - 45000 + 150000 - 55000, 'incluye el retiro del ahorro y la compra de un regalo');
    assert.strictEqual(s.ahorro, 4200000 + 12300 - 150000, 'el retiro para gastos baja el ahorro');
  });

  prueba('demo: no se puede sembrar dos veces; sobre datos reales sí, y limpiar los deja intactos', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    assert.throws(e.falla('sembrarDatosDemo'), /Ya hay datos de demostración/);

    const e2 = E();
    const banco = e2.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Real' });
    const nom = e2.llamar('guardarCatalogo', 'Nomina_Escenarios', { Nombre: 'Mi nómina', Sueldo_Base: 4000000, Vigente: true });
    assert.strictEqual(e2.llamar('sembrarDatosDemo').ok, true, 'se puede ver la demo con datos reales');
    const vig = e2.llamar('getTableData', 'Nomina_Escenarios').filter(n => String(n.Vigente).toUpperCase() === 'TRUE');
    assert.deepStrictEqual(vig.map(n => n.ID_Nomina_Esc), [nom.ID_Nomina_Esc], 'la nómina demo no le quita lo vigente a la real');
    e2.llamar('limpiarDatosDemo');
    assert.deepStrictEqual(e2.llamar('listarCatalogo', 'Bancos').map(b => b.ID_Banco), [banco.ID_Banco]);
    assert.strictEqual(e2.llamar('listarCatalogo', 'Nomina_Escenarios').length, 1);

    const e3 = E();
    e3.ejecutar("guardarConfig_('Arranque_Hecho', 'TRUE')");
    assert.throws(e3.falla('sembrarDatosDemo'), /ya empezó/);
  });

  prueba('demo: limpiar borra solo lo demo y deja intacto lo real', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const real = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Banco Real' });
    const r = e.llamar('limpiarDatosDemo');
    assert.ok(r.eliminadas.Bancos === 3 && r.eliminadas.Movimientos >= 6);
    assert.strictEqual(filas(e, 'Cuentas').length, 0);
    assert.strictEqual(filas(e, 'Bolsillos').length, 0);
    assert.strictEqual(filas(e, 'Movimientos').length, 0);
    const bancos = e.llamar('listarCatalogo', 'Bancos');
    assert.deepStrictEqual(bancos.map(b => b.ID_Banco), [real.ID_Banco]);
    assert.strictEqual(filas(e, 'Config').length > 15, true, 'la configuración no se toca');
    const cfg = e.llamar('getTableData', 'Config').find(c => c.Clave === 'Datos_Demo');
    assert.strictEqual(String(cfg.Valor).toUpperCase(), 'FALSE');
    // y se puede volver a sembrar si no hay datos reales
    const e3 = E();
    e3.llamar('sembrarDatosDemo'); e3.llamar('limpiarDatosDemo');
    assert.strictEqual(e3.llamar('sembrarDatosDemo').ok, true);
  });

  prueba('demo: los datos demo respetan las reglas (cada tarjeta tiene su reserva)', () => {
    const e = E();
    e.llamar('sembrarDatosDemo');
    const bolsillos = e.llamar('listarCatalogo', 'Bolsillos');
    e.llamar('listarCatalogo', 'Tarjetas').forEach(t => {
      const reserva = bolsillos.find(b => b.ID_Bolsillo === t.ID_Bolsillo_Reserva);
      assert.ok(reserva && reserva.Rol === 'Reserva_Tarjeta', 'reserva de ' + t.Nombre);
    });
    // las cuentas sin bolsillos tienen exactamente un bolsillo interno
    e.llamar('listarCatalogo', 'Cuentas').filter(c => c.Permite_Bolsillos === false).forEach(c => {
      const propios = bolsillos.filter(b => b.ID_Cuenta === c.ID_Cuenta);
      assert.strictEqual(propios.length, 1);
      assert.strictEqual(propios[0].Es_Interno, true);
    });
  });

  // ---------------------------------------------------------------- estado y API
  prueba('estado de configuración: avanza a medida que se completan los pasos', () => {
    const e = E();
    let est = e.llamar('obtenerEstadoConfiguracion');
    assert.strictEqual(est.completo, false);
    assert.deepStrictEqual(est.pasos.filter(p => p.hecho).map(p => p.id), [], 'al inicio no hay nada hecho');
    e.llamar('saveConfigParam', 'Nombre_Usuario', 'Ana');
    const { cuenta } = conBancoYCuenta(e);
    est = e.llamar('obtenerEstadoConfiguracion');
    assert.strictEqual(est.pasos.find(p => p.id === 'cuentas').hecho, true);
    assert.strictEqual(est.pasos.find(p => p.id === 'bolsillos').hecho, false, 'falta crear bolsillos');
    e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cuenta.ID_Cuenta, Nombre: 'Casa' });
    est = e.llamar('obtenerEstadoConfiguracion');
    assert.strictEqual(est.completo, true, 'tarjetas es opcional');
  });

  prueba('getBootstrap: sin instalar avisa; instalado devuelve catálogos, saldos y estado', () => {
    const e = E(false);
    const antes = e.llamar('getBootstrap');
    assert.strictEqual(antes.ok, true);
    assert.strictEqual(antes.data.instalado, false);
    assert.strictEqual(antes.data.faltantes.length, 27);

    assert.strictEqual(e.llamar('instalarBaseDatos').ok, true);
    const d = e.llamar('getBootstrap').data;
    assert.strictEqual(d.instalado, true);
    ['Bancos', 'Cuentas', 'Bolsillos', 'Tarjetas', 'Categorias', 'Personas', 'Inmuebles', 'Servicios_Publicos', 'Escenarios']
      .forEach(t => assert.ok(Array.isArray(d.catalogos[t]), t));
    assert.ok(d.saldos && d.estado && d.enums.Cuentas.Tipo);
    assert.strictEqual(d.config.Anio_Activo, '2027');
  });

  prueba('saveConfigParam valida tema, color de acento y claves inexistentes', () => {
    const e = E();
    assert.strictEqual(e.llamar('saveConfigParam', 'Tema', 'Oscuro').ok, true);
    assert.strictEqual(e.llamar('saveConfigParam', 'Tema', 'Rojo').ok, false);
    assert.strictEqual(e.llamar('saveConfigParam', 'Color_Acento', 'naranja').ok, true);
    assert.strictEqual(e.llamar('saveConfigParam', 'Color_Acento', '#ff0000').ok, false);
    assert.strictEqual(e.llamar('saveConfigParam', 'No_Existe', 'x').ok, false);
    assert.strictEqual(e.llamar('saveConfigParam', 'Datos_Demo', 'TRUE').ok, false);
    assert.strictEqual(e.llamar('resetConfigParam', 'Tema').data.valor, 'Automatico');
  });
};
