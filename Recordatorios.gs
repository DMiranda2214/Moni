/**
 * Recordatorios.gs — Moni
 * "Próximos pagos" para Inicio: extractos de tarjeta por pagar y cuotas de créditos de autopago,
 * ordenados por fecha. Solo lee; no crea nada.
 */

const DIAS_RECORDATORIO = 14;

function diasEntre_(desdeIso, hastaIso) {
  const a = Date.UTC(+desdeIso.slice(0, 4), +desdeIso.slice(5, 7) - 1, +desdeIso.slice(8, 10));
  const b = Date.UTC(+hastaIso.slice(0, 4), +hastaIso.slice(5, 7) - 1, +hastaIso.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/**
 * Pagos próximos (dentro de DIAS_RECORDATORIO días) y vencidos.
 * @return {Array} [{ tipo: 'Tarjeta'|'Credito'|'Suscripcion'|'Servicio', id, titulo, fecha, dias, valor, detalle }]
 */
function proximosPagos_(horizonte) {
  const hoy = hoyIso_();
  const limite = horizonte === undefined ? DIAS_RECORDATORIO : horizonte;
  const lista = [];

  resumenTarjetas_().forEach(t => {
    if (t.pagado || t.total <= 0) return;
    const dias = diasEntre_(hoy, t.proximoPago);
    if (dias > limite) return;
    lista.push({
      tipo: 'Tarjeta', id: t.ID_Tarjeta, titulo: t.Nombre, fecha: t.proximoPago, dias: dias, valor: t.total,
      detalle: t.faltaParaPagar > 0 ? 'Falta reunir ' + Math.round(t.faltaParaPagar) : 'Ya está reunido'
    });
  });

  listarCreditos().forEach(c => {
    if (c.Estado !== 'Activo' || !c.proxima) return;
    const dias = diasEntre_(hoy, c.proxima.Fecha);
    if (dias > limite) return;
    lista.push({ tipo: 'Credito', id: c.ID_Credito, titulo: c.Nombre, fecha: c.proxima.Fecha, dias: dias, valor: c.proxima.Cuota, detalle: 'Cuota ' + c.proxima.Num + ' de ' + c.cuotasTotal });
  });

  const ctx = contextoSuscripciones_();
  getTableData('Suscripciones').filter(estaActivo).forEach(x => {
    const r = resumenSuscripcion_(x, hoy, ctx);
    if (r.dias > limite) return;
    lista.push({ tipo: r.Tipo, id: r.ID_Suscripcion, titulo: r.Nombre, fecha: r.Proximo_Cobro, dias: r.dias, valor: r.Valor, detalle: r.Tipo === 'Servicio' ? 'Servicio' + (r.medio ? ' · ' + r.medio : '') : 'Suscripción' + (r.medio ? ' · ' + r.medio : ''), susc: r });
  });

  return lista.sort((a, b) => a.dias - b.dias || a.titulo.localeCompare(b.titulo));
}

// ---------------------------------------------------------------------------
// Recordatorios en Google Calendar
//
// Moni crea un calendario propio ("Moni") y mantiene en él un evento por cada pago de los próximos
// HORIZONTE_CALENDARIO días: extractos de tarjeta, cuotas de crédito, suscripciones y servicios, y las
// fechas límite de prima y cesantías. Sincronizar es idempotente: crea lo que falta, corrige lo que cambió
// y borra lo que ya no corresponde (por ejemplo, un pago ya hecho). Cada evento lleva una etiqueta con su
// clave; lo que no la tenga (eventos que la persona ponga a mano en ese calendario) no se toca.
// Corre solo cada día y cuando la app registra cambios; también hay un botón para sincronizar ya.
// ---------------------------------------------------------------------------

const HORIZONTE_CALENDARIO = 45;
const NOMBRE_CALENDARIO = 'Moni';
const FUNCION_RECORDATORIOS = 'sincronizarRecordatoriosAuto';
const ZONA_CALENDARIO = '-05:00'; // Bogotá no cambia de hora en el año
const FECHAS_NOMINA = [
  ['Prima_Fechas', 'Prima de servicios: fecha límite de pago'],
  ['Cesantias_Fecha_Consignacion', 'Cesantías: fecha límite de consignación'],
  ['Intereses_Cesantias_Fecha', 'Intereses de cesantías: fecha límite de pago']
];

function configEntero_(clave, defecto, min, max) {
  const n = Number(cfgValor_(clave));
  return isFinite(n) && cfgValor_(clave) !== '' && n >= min && n <= max ? Math.floor(n) : defecto;
}

function disparadoresRecordatorios_() {
  return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === FUNCION_RECORDATORIOS);
}

function ajustesRecordatorios_() {
  return {
    activos: esVerdadero(cfgValor_('Recordatorios_Activos')),
    diasAntes: configEntero_('Recordatorios_Dias_Antes', 2, 0, 7),
    hora: configEntero_('Recordatorios_Hora', 9, 5, 21),
    nomina: cfgValor_('Recordatorios_Nomina') === '' ? true : esVerdadero(cfgValor_('Recordatorios_Nomina'))
  };
}

function estadoRecordatorios_() {
  return Object.assign(ajustesRecordatorios_(), {
    automatico: disparadoresRecordatorios_().length > 0,
    tieneCalendario: cfgValor_('Calendario_ID') !== '',
    ultima: cfgValor_('Recordatorios_Ultima'),
    resumen: cfgValor_('Recordatorios_Resumen'),
    horizonte: HORIZONTE_CALENDARIO
  });
}

/** El calendario de Moni; lo crea si no existe (o si la persona lo borró). */
function calendarioMoni_(crear) {
  const id = cfgValor_('Calendario_ID');
  let cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal && crear) {
    cal = CalendarApp.createCalendar(NOMBRE_CALENDARIO, { summary: 'Pagos y fechas de Moni', timeZone: 'America/Bogota' });
    guardarConfig_('Calendario_ID', cal.getId());
  }
  return cal;
}

/** Pasa un permiso de Calendar no concedido a un mensaje que se entienda. */
function conCalendario_(fn) {
  try {
    return fn();
  } catch (e) {
    if (/permission|authoriz|scope|calendar/i.test(String(e && e.message))) {
      throw new Error('Moni necesita permiso para usar Google Calendar. Cierra la app y vuelve a abrirla para aceptarlo.');
    }
    throw e;
  }
}

function fechaHora_(fecha, hora, minutos) {
  return new Date(fecha + 'T' + dosDigitos_(hora) + ':' + dosDigitos_(minutos || 0) + ':00' + ZONA_CALENDARIO);
}

/** Próxima vez (dentro del horizonte) de cada fecha MM-DD de los parámetros de nómina. */
function fechasNomina_(hoy, horizonte) {
  const salida = [];
  FECHAS_NOMINA.forEach(def => {
    cfgValor_(def[0]).split(',').map(s => s.trim()).filter(s => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)).forEach(mmdd => {
      [Number(hoy.slice(0, 4)), Number(hoy.slice(0, 4)) + 1].forEach(anio => {
        const f = anio + '-' + mmdd;
        if (new Date(f + 'T00:00:00Z').toISOString().slice(0, 10) !== f) return; // un 30 de febrero no existe
        const dias = diasEntre_(hoy, f);
        if (dias >= 0 && dias <= horizonte) salida.push({ tipo: 'Nomina', id: def[0] + '-' + mmdd, titulo: def[1], fecha: f, dias: dias, valor: null, detalle: '' });
      });
    });
  });
  return salida;
}

/** Lo que debería haber en el calendario: [{ clave, titulo, descripcion, fecha }]. */
function recordatoriosDeseados_(ajustes) {
  const hoy = hoyIso_();
  let lista = proximosPagos_(HORIZONTE_CALENDARIO).filter(p => p.dias >= 0);
  if (ajustes.nomina) lista = lista.concat(fechasNomina_(hoy, HORIZONTE_CALENDARIO));
  return lista.map(p => {
    const titulo = p.tipo === 'Nomina' ? p.titulo
      : p.tipo === 'Tarjeta' ? 'Pagar tarjeta ' + p.titulo
      : p.tipo === 'Credito' ? 'Pagar cuota · ' + p.titulo
      : 'Pagar ' + p.titulo;
    const lineas = [];
    if (p.valor) lineas.push((p.tipo === 'Tarjeta' ? 'Total del extracto: ' : 'Valor: ') + pesos_(p.valor));
    if (p.detalle) lineas.push(p.detalle);
    lineas.push('', 'Lo creó Moni y se actualiza solo: no lo edites a mano.');
    return { clave: p.tipo + '|' + p.id + '|' + p.fecha, titulo: 'Moni · ' + titulo, descripcion: lineas.join('\n'), fecha: p.fecha };
  });
}

function aplicarAvisos_(ev, ajustes) {
  ev.removeAllReminders();
  ev.addPopupReminder(0);
  if (ajustes.diasAntes > 0) ev.addPopupReminder(ajustes.diasAntes * 1440);
}

/** Deja el calendario como debe estar. Devuelve cuántos eventos creó, corrigió y borró. */
function sincronizarRecordatorios_() {
  return conCalendario_(function () {
    const lock = tomarBloqueo(15000);
    try {
      const ajustes = ajustesRecordatorios_();
      const cal = calendarioMoni_(true);
      const hoy = hoyIso_();
      const firma = ajustes.diasAntes + '|' + ajustes.hora; // si cambian los avisos, los eventos se rehacen
      const deseados = recordatoriosDeseados_(ajustes);

      const actuales = {};
      let eliminados = 0, creados = 0, corregidos = 0;
      cal.getEvents(fechaHora_(hoy, 0), fechaHora_(diasMas_(hoy, HORIZONTE_CALENDARIO + 2), 0)).forEach(ev => {
        const clave = ev.getTag('moni_clave');
        if (!clave) return; // no es de Moni
        if (actuales[clave]) { ev.deleteEvent(); eliminados++; return; } // duplicado
        actuales[clave] = ev;
      });

      const vigentes = {};
      deseados.forEach(d => {
        vigentes[d.clave] = true;
        const inicio = fechaHora_(d.fecha, ajustes.hora), fin = fechaHora_(d.fecha, ajustes.hora, 30);
        const ev = actuales[d.clave];
        if (!ev) {
          const nuevo = cal.createEvent(d.titulo, inicio, fin, { description: d.descripcion });
          nuevo.setTag('moni_clave', d.clave); nuevo.setTag('moni_firma', firma);
          aplicarAvisos_(nuevo, ajustes);
          creados++;
        } else if (ev.getTitle() !== d.titulo || ev.getDescription() !== d.descripcion || ev.getStartTime().getTime() !== inicio.getTime() || ev.getTag('moni_firma') !== firma) {
          ev.setTitle(d.titulo); ev.setDescription(d.descripcion); ev.setTime(inicio, fin); ev.setTag('moni_firma', firma);
          aplicarAvisos_(ev, ajustes);
          corregidos++;
        }
      });
      Object.keys(actuales).forEach(k => { if (!vigentes[k]) { actuales[k].deleteEvent(); eliminados++; } });

      const resumen = 'Creados ' + creados + ' · corregidos ' + corregidos + ' · borrados ' + eliminados + ' · ' + deseados.length + ' en el calendario';
      guardarConfig_('Recordatorios_Ultima', ahoraIso_());
      guardarConfig_('Recordatorios_Resumen', resumen);
      return { creados: creados, corregidos: corregidos, eliminados: eliminados, total: deseados.length, resumen: resumen };
    } finally {
      lock.releaseLock();
    }
  });
}

function diasMas_(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lo que ejecuta el disparador diario. */
function sincronizarRecordatoriosAuto() {
  return ejecutarConLog_(FUNCION_RECORDATORIOS, function () {
    if (!ajustesRecordatorios_().activos) return { omitido: true };
    return sincronizarRecordatorios_();
  });
}

/**
 * Guarda los ajustes. Al activar, crea el calendario, sincroniza y deja el disparador diario; al
 * desactivar, quita el disparador (los eventos que ya están se quedan hasta que se quiten).
 * @param {Object} o { activos, diasAntes (0-7), hora (5-21), nomina }
 */
function configurarRecordatorios(o) {
  const x = o || {};
  const actual = ajustesRecordatorios_();
  const diasAntes = x.diasAntes === undefined ? actual.diasAntes : numero_(x.diasAntes, 'Los días de anticipación', { entero: true, min: 0, max: 7, requerido: true });
  const hora = x.hora === undefined ? actual.hora : numero_(x.hora, 'La hora', { entero: true, min: 5, max: 21, requerido: true });
  const activos = x.activos === undefined ? actual.activos : !!x.activos;
  const nomina = x.nomina === undefined ? actual.nomina : !!x.nomina;

  guardarConfig_('Recordatorios_Dias_Antes', diasAntes);
  guardarConfig_('Recordatorios_Hora', hora);
  guardarConfig_('Recordatorios_Nomina', nomina ? 'TRUE' : 'FALSE');
  guardarConfig_('Recordatorios_Activos', activos ? 'TRUE' : 'FALSE');

  disparadoresRecordatorios_().forEach(t => ScriptApp.deleteTrigger(t));
  let resultado = null;
  if (activos) {
    resultado = sincronizarRecordatorios_(); // si falta el permiso de Calendar, falla aquí y se avisa
    ScriptApp.newTrigger(FUNCION_RECORDATORIOS).timeBased().everyDays(1).atHour(5).create();
  }
  return Object.assign(estadoRecordatorios_(), { sincronizado: resultado });
}

/** Sincroniza ahora (botón de la pantalla y avisos después de registrar cambios). */
function sincronizarRecordatoriosYa() {
  if (!ajustesRecordatorios_().activos) throw new Error('Los recordatorios están desactivados.');
  const sincronizado = sincronizarRecordatorios_(); // primero sincroniza: el estado debe traer el resumen nuevo
  return Object.assign(estadoRecordatorios_(), { sincronizado: sincronizado });
}

/** Borra el calendario de Moni con todos sus eventos y apaga los recordatorios. */
function quitarRecordatorios() {
  conCalendario_(function () {
    const cal = calendarioMoni_(false);
    if (cal) cal.deleteCalendar();
  });
  disparadoresRecordatorios_().forEach(t => ScriptApp.deleteTrigger(t));
  guardarConfig_('Recordatorios_Activos', 'FALSE');
  guardarConfig_('Calendario_ID', '');
  guardarConfig_('Recordatorios_Ultima', '');
  guardarConfig_('Recordatorios_Resumen', '');
  return estadoRecordatorios_();
}
