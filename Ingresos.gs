/**
 * Ingresos.gs — Moni
 * Ingresos recurrentes distintos de la nómina: otro trabajo, un arriendo, ventas, servicios que prestas…
 * Cada uno tiene su concepto, su monto y la cuenta (bolsillo) a la que llega, y recuerda cuándo se espera.
 * Al marcarlo como recibido se registra un ingreso en ese bolsillo y el próximo cobro avanza un período
 * (conservando el día, como en las suscripciones). El monto es un estimado: se puede corregir al recibirlo.
 */

const MARCA_INGRESO = 'Ingreso recurrente ';

function resumenIngreso_(r, hoy, bolsillos, cuentas) {
  const base = resumenRecurrente_(r, hoy, 'atrasado');
  const b = r.ID_Bolsillo ? buscarPorId_(bolsillos, 'ID_Bolsillo', r.ID_Bolsillo) : null;
  const c = b ? buscarPorId_(cuentas, 'ID_Cuenta', b.ID_Cuenta) : null;
  return {
    ID_Ingreso: r.ID_Ingreso, Nombre: r.Nombre, Valor: base.Valor, Periodicidad: base.Periodicidad,
    Proximo_Cobro: r.Proximo_Cobro, dias: base.dias, estado: base.estado, mensual: base.mensual, anual: base.anual,
    ID_Bolsillo: r.ID_Bolsillo || '', ID_Categoria: r.ID_Categoria || '',
    destino: b ? (c && !esVerdadero(b.Es_Interno) ? c.Nombre + ' · ' + b.Nombre : (c ? c.Nombre : b.Nombre)) : '',
    Ultimo_Cobro: r.Ultimo_Cobro || '', Notas: r.Notas || ''
  };
}

/** Pantalla de ingresos recurrentes, en una sola llamada. */
function obtenerIngresosRecurrentes() {
  const hoy = hoyIso_();
  const bolsillos = getTableData('Bolsillos'), cuentas = getTableData('Cuentas');
  const lista = getTableData('Ingresos_Recurrentes').filter(estaActivo)
    .map(r => resumenIngreso_(r, hoy, bolsillos, cuentas)).sort((a, b) => a.dias - b.dias || a.Nombre.localeCompare(b.Nombre));
  const t = totalesRecurrentes_(lista);
  return { items: lista, totales: { cantidad: t.cantidad, mensual: t.mensual, anual: t.anual, porRecibir: t.pronto } };
}

function ingresoActivo_(id) {
  return exigirActivo_(leer_('Ingresos_Recurrentes'), 'ID_Ingreso', id, 'El ingreso');
}

/**
 * Registra lo recibido y avanza el próximo cobro.
 * @param {Object} d { Valor, Fecha, ID_Bolsillo } — lo que falte sale del ingreso.
 */
function recibirIngresoRecurrente(id, d) {
  const r = ingresoActivo_(id);
  const x = d || {};
  const valor = numero_(x.Valor !== undefined && x.Valor !== '' ? x.Valor : r.Valor, 'El valor', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const fecha = fechaMovimiento_(x.Fecha);
  const idBolsillo = texto_(x.ID_Bolsillo) || texto_(r.ID_Bolsillo);
  if (!idBolsillo) throw new Error('Elige a qué cuenta llegó el dinero.');
  exigirPesos_(idBolsillo, 'El bolsillo donde llegó el ingreso');

  const anterior = { Proximo_Cobro: r.Proximo_Cobro, Ultimo_Cobro: r.Ultimo_Cobro || '', Valor: Number(r.Valor) || 0 };
  return transaccion_(alDeshacer => {
    const mov = registrarMovimiento({
      Tipo_Mov: 'Ingreso', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: r.ID_Categoria,
      Concepto: r.Nombre, Notas: MARCA_INGRESO + r.ID_Ingreso
    });
    alDeshacer(() => anularMovimiento(mov.ID_Mov));
    const proximo = siguienteCobro_(r);
    updateRow('Ingresos_Recurrentes', r, { Proximo_Cobro: proximo, Ultimo_Cobro: fecha });
    invalidateCache('Ingresos_Recurrentes');
    return { idMov: mov.ID_Mov, anterior: anterior, proximo: proximo };
  });
}

/** Deshace lo recibido: anula el ingreso y devuelve el cobro a como estaba. */
function deshacerIngresoRecurrente(id, anterior, idMov) {
  const r = ingresoActivo_(id);
  if (!anterior || !anterior.Proximo_Cobro) throw new Error('Faltan los datos para deshacer.');
  return conBloqueo_(() => {
    if (idMov) anularMovimiento(idMov);
    restaurarRecurrente_('Ingresos_Recurrentes', r, anterior, 'Ultimo_Cobro', false);
    invalidateCache('Ingresos_Recurrentes');
    return { ok: true };
  });
}

/** Pasa al siguiente cobro sin registrar nada (este mes no llegó o no aplica). */
function saltarIngresoRecurrente(id) {
  const r = saltarRecurrente_('Ingresos_Recurrentes', ingresoActivo_(id), 'Ultimo_Cobro');
  invalidateCache('Ingresos_Recurrentes');
  return r;
}

/**
 * Lo que se espera recibir pronto (14 días) o está atrasado: la nómina estimada y los ingresos recurrentes.
 * @return {Array} [{ tipo: 'Nomina'|'Ingreso', id, titulo, fecha, dias, valor, detalle }]
 */
function proximosIngresos_() {
  return proximosEventos_(DIAS_RECORDATORIO, { pagos: false }).map(quitarDireccion_);
}

/** La nómina estimada (si falta registrarla) y los ingresos recurrentes que llegan dentro del horizonte (o atrasados). */
function ingresosEsperados_(horizonte) {
  const hoy = hoyIso_();
  const lista = [];
  try {
    const mes = mesProximoPagoNomina_();
    const yaRegistrada = leer_('Nomina_Pagos').some(n => n.Periodo === mes && !esVerdadero(n.Anulado));
    if (!yaRegistrada && leer_('Nomina_Escenarios').some(estaActivo)) {
      const dia = Math.min(Number(cfgValor_('Nomina_Dia_Pago')) || 30, diasDelMes_(+mes.slice(0, 4), +mes.slice(5, 7)));
      const fecha = mes + '-' + ('0' + dia).slice(-2);
      const dias = diasEntre_(hoy, fecha);
      if (dias <= horizonte) {
        const c = calcularNominaEscenario_(escenarioNomina_(''), mes);
        lista.push({ tipo: 'Nomina', id: '', titulo: 'Nómina de ' + mes, fecha: fecha, dias: dias, valor: c.totales.neto, detalle: 'Estimado' });
      }
    }
  } catch (e) { /* sin escenario o con datos incompletos: no se muestra */ }

  const bolsillos = getTableData('Bolsillos'), cuentas = getTableData('Cuentas');
  getTableData('Ingresos_Recurrentes').filter(estaActivo).forEach(r => {
    const x = resumenIngreso_(r, hoy, bolsillos, cuentas);
    if (x.dias > horizonte) return;
    lista.push({ tipo: 'Ingreso', id: x.ID_Ingreso, titulo: x.Nombre, fecha: x.Proximo_Cobro, dias: x.dias, valor: x.Valor, detalle: x.destino ? 'A ' + x.destino : 'Por recibir', ingreso: x });
  });
  return lista;
}
