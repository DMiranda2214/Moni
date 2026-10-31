/**
 * Pruebas de los recordatorios en Google Calendar (Recordatorios.gs), con un Calendar simulado.
 */
module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const CARGA = ['Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs'];
  const enDias = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  function E() {
    const e = crearEntorno({});
    e.cargar(...CARGA);
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    const bco = e.llamar('guardarCatalogo', 'Bancos', { Nombre: 'Nequi' });
    const cta = e.llamar('guardarCatalogo', 'Cuentas', { ID_Banco: bco.ID_Banco, Nombre: 'Principal', Tipo: 'Billetera' });
    const bol = e.llamar('guardarCatalogo', 'Bolsillos', { ID_Cuenta: cta.ID_Cuenta, Nombre: 'Casa', Saldo_Apertura: 1000000 });
    const susc = (nombre, dias, extra) => e.llamar('guardarCatalogo', 'Suscripciones', Object.assign({ Nombre: nombre, Valor: 39900, Proximo_Cobro: enDias(dias), ID_Bolsillo: bol.ID_Bolsillo }, extra || {}));
    /** Los eventos vivos de Moni, ordenados por fecha. */
    const eventos = () => e.calendario.calendarios.filter(c => !c.borrado).reduce((a, c) => a.concat(c.eventos.filter(x => !x.borrado)), []).sort((a, b) => a.inicio - b.inicio);
    return { e, bol, susc, eventos };
  }
  const activar = (e, extra) => e.llamar('configurarRecordatorios', Object.assign({ activos: true, nomina: false }, extra || {}));

  prueba('recordatorios: activar crea el calendario Moni y un evento por pago con sus avisos', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    const r = activar(e);
    assert.strictEqual(r.activos, true);
    assert.strictEqual(r.sincronizado.creados, 1);
    assert.strictEqual(e.calendario.calendarios.length, 1);
    assert.strictEqual(e.calendario.calendarios[0].nombre, 'Moni');
    const ev = eventos()[0];
    assert.strictEqual(ev.titulo, 'Moni · Pagar Netflix');
    assert.strictEqual(ev.inicio.toISOString(), enDias(3) + 'T14:00:00.000Z', 'a las 9:00 de Bogotá');
    assert.ok(ev.descripcion.indexOf('$ 39.900') !== -1);
    assert.deepStrictEqual(ev.avisos, [0, 2880], 'el mismo día y 2 días antes');
    assert.strictEqual(r.automatico, true, 'queda el disparador diario');
    assert.ok(r.ultima && /Creados 1/.test(r.resumen));
  });

  prueba('recordatorios: sincronizar de nuevo no duplica ni cambia nada', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3); susc('Luz', 10, { Tipo: 'Servicio' });
    activar(e);
    const ya = e.llamar('sincronizarRecordatoriosYa'), r = ya.sincronizado;
    assert.deepStrictEqual([r.creados, r.corregidos, r.eliminados, r.total], [0, 0, 0, 2]);
    assert.ok(/Creados 0/.test(ya.resumen), 'el estado trae el resumen de esta sincronización: ' + ya.resumen);
    assert.strictEqual(eventos().length, 2);
  });

  prueba('recordatorios: al pagar, el evento viejo se va y aparece el del siguiente cobro', () => {
    const { e, susc, eventos, bol } = E();
    const s = susc('Netflix', 0);
    activar(e);
    assert.strictEqual(eventos().length, 1);
    e.llamar('pagarSuscripcion', s.ID_Suscripcion, { Fecha: enDias(0), ID_Bolsillo: bol.ID_Bolsillo });
    const r = e.llamar('sincronizarRecordatoriosYa').sincronizado;
    assert.deepStrictEqual([r.creados, r.eliminados], [1, 1], 'el pago de hoy ya no hace falta y el próximo cobro (en un mes) sí');
    assert.strictEqual(eventos().length, 1);
    assert.ok(eventos()[0].inicio.toISOString().slice(0, 10) > enDias(25));
  });

  prueba('recordatorios: lo desactivado o fuera del horizonte no aparece; lo borrado se quita', () => {
    const { e, susc, eventos } = E();
    const a = susc('Netflix', 3); susc('Anual', 60);
    activar(e);
    assert.strictEqual(eventos().length, 1, 'a 60 días queda fuera de los 45');
    e.llamar('desactivarCatalogo', 'Suscripciones', a.ID_Suscripcion);
    assert.strictEqual(e.llamar('sincronizarRecordatoriosYa').sincronizado.eliminados, 1);
    assert.strictEqual(eventos().length, 0);
  });

  prueba('recordatorios: cambiar la hora o los avisos corrige los eventos existentes', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    activar(e);
    const r = activar(e, { hora: 18, diasAntes: 0 }).sincronizado;
    assert.deepStrictEqual([r.creados, r.corregidos, r.eliminados], [0, 1, 0]);
    assert.strictEqual(eventos().length, 1);
    assert.strictEqual(eventos()[0].inicio.toISOString(), enDias(3) + 'T23:00:00.000Z');
    assert.deepStrictEqual(eventos()[0].avisos, [0]);
  });

  prueba('recordatorios: los eventos que la persona puso a mano en el calendario no se tocan', () => {
    const { e, susc } = E();
    susc('Netflix', 3);
    activar(e);
    const cal = e.calendario.calendarios[0];
    cal.eventos.push({ titulo: 'Cumpleaños', inicio: new Date(Date.now() + 86400000), fin: new Date(Date.now() + 90000000), descripcion: '', tags: {}, avisos: [], borrado: false });
    e.llamar('sincronizarRecordatoriosYa');
    assert.ok(cal.eventos.some(x => x.titulo === 'Cumpleaños' && !x.borrado));
  });

  prueba('recordatorios: un evento duplicado se limpia', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    activar(e);
    const cal = e.calendario.calendarios[0], original = cal.eventos[0];
    cal.eventos.push(Object.assign({}, original, { tags: Object.assign({}, original.tags) }));
    assert.strictEqual(eventos().length, 2);
    assert.strictEqual(e.llamar('sincronizarRecordatoriosYa').sincronizado.eliminados, 1);
    assert.strictEqual(eventos().length, 1);
  });

  prueba('recordatorios: fechas de prima y cesantías, con su propio interruptor', () => {
    const { e, eventos } = E();
    const f = enDias(10).slice(5);
    e.ejecutar(`guardarConfig_('Prima_Fechas', '${f}')`);
    e.ejecutar(`guardarConfig_('Cesantias_Fecha_Consignacion', '${enDias(200).slice(5)}')`); // lejos: fuera del horizonte
    activar(e, { nomina: true });
    const titulos = eventos().map(x => x.titulo);
    assert.ok(titulos.indexOf('Moni · Prima de servicios: fecha límite de pago') !== -1, titulos.join(' | '));
    const r = activar(e, { nomina: false }).sincronizado;
    assert.ok(r.eliminados >= 1);
    assert.ok(eventos().every(x => x.titulo.indexOf('Prima') === -1));
  });

  prueba('recordatorios: tarjetas y créditos entran con su valor', () => {
    const { e, bol, eventos } = E();
    const cta = e.llamar('listarCatalogo', 'Cuentas')[0];
    const tar = e.llamar('guardarCatalogo', 'Tarjetas', { ID_Banco: cta.ID_Banco, Nombre: 'Azul', Dia_Corte: 1, Dia_Pago: Number(enDias(5).slice(8, 10)), ID_Bolsillo_Reserva: undefined, Cupo: 1000000 }, { crearReserva: { ID_Cuenta: cta.ID_Cuenta } });
    e.llamar('registrarCompraTC', { ID_Tarjeta: tar.ID_Tarjeta, Concepto: 'Ropa', Valor: 180000, Fecha: enDias(0), Fuente: 'Personal' });
    activar(e);
    const ev = eventos().find(x => x.titulo === 'Moni · Pagar tarjeta Azul');
    assert.ok(ev, eventos().map(x => x.titulo).join(' | '));
    assert.ok(/Total del extracto: \$ 180\.000/.test(ev.descripcion));
    assert.ok(bol);
  });

  prueba('recordatorios: los ajustes se validan', () => {
    const { e } = E();
    assert.strictEqual(e.llamar('saveRecordatorios', { diasAntes: 9 }).ok, false);
    assert.strictEqual(e.llamar('saveRecordatorios', { hora: 3 }).ok, false);
    assert.strictEqual(e.llamar('saveRecordatorios', { hora: 22 }).ok, false);
    assert.strictEqual(e.llamar('saveRecordatorios', { diasAntes: 1, hora: 8 }).ok, true);
    assert.strictEqual(e.llamar('getRecordatorios').data.hora, 8);
    assert.strictEqual(e.llamar('saveConfigParam', 'Recordatorios_Hora', '7').ok, false, 'no se edita como parámetro suelto');
    assert.strictEqual(e.llamar('syncRecordatorios').ok, false, 'desactivados no sincroniza');
  });

  prueba('recordatorios: desactivar apaga el disparador; quitar borra el calendario', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    assert.strictEqual(activar(e).automatico, true);
    assert.strictEqual(e.llamar('saveRecordatorios', { activos: false }).data.automatico, false);
    assert.strictEqual(eventos().length, 1, 'los eventos se quedan hasta que se quiten');
    activar(e);
    const r = e.llamar('removeRecordatorios').data;
    assert.strictEqual(r.activos, false);
    assert.strictEqual(r.tieneCalendario, false);
    assert.strictEqual(r.automatico, false);
    assert.strictEqual(eventos().length, 0);
    assert.strictEqual(e.calendario.calendarios[0].borrado, true);
  });

  prueba('recordatorios: si la persona borró el calendario, se vuelve a crear', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    activar(e);
    e.calendario.calendarios[0].borrado = true;
    e.llamar('sincronizarRecordatoriosYa');
    assert.strictEqual(e.calendario.calendarios.length, 2);
    assert.strictEqual(eventos().length, 1);
  });

  prueba('recordatorios: el disparador diario solo sincroniza si están activos y deja rastro si falla', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    assert.strictEqual(e.llamar('sincronizarRecordatoriosAuto').omitido, true);
    activar(e);
    e.calendario.calendarios[0].eventos.forEach(x => { x.borrado = true; });
    assert.strictEqual(e.llamar('sincronizarRecordatoriosAuto').creados, 1);
    assert.strictEqual(eventos().length, 1);
    e.ctx.CalendarApp = { getCalendarById: () => { throw new Error('Exception: You do not have permission to call CalendarApp.getCalendarById'); } };
    assert.throws(() => e.ejecutar('sincronizarRecordatoriosAuto()'), /permiso para usar Google Calendar/);
    assert.strictEqual(e.llamar('obtenerLogs').items[0].Funcion, 'sincronizarRecordatoriosAuto');
  });

  prueba('recordatorios: borrar todos los datos también quita el calendario y el disparador', () => {
    const { e, susc, eventos } = E();
    susc('Netflix', 3);
    activar(e);
    e.llamar('borrarTodosLosDatos', 'BORRAR');
    assert.strictEqual(eventos().length, 0);
    assert.strictEqual(e.calendario.calendarios[0].borrado, true);
    assert.strictEqual(e.llamar('getRecordatorios').data.automatico, false);
    assert.strictEqual(e.llamar('getRecordatorios').data.activos, false);
  });
};
