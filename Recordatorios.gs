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
function proximosPagos_() {
  const hoy = hoyIso_();
  const lista = [];

  resumenTarjetas_().forEach(t => {
    if (t.pagado || t.total <= 0) return;
    const dias = diasEntre_(hoy, t.proximoPago);
    if (dias > DIAS_RECORDATORIO) return;
    lista.push({
      tipo: 'Tarjeta', id: t.ID_Tarjeta, titulo: t.Nombre, fecha: t.proximoPago, dias: dias, valor: t.total,
      detalle: t.faltaParaPagar > 0 ? 'Falta reunir ' + Math.round(t.faltaParaPagar) : 'Ya está reunido'
    });
  });

  listarCreditos().forEach(c => {
    if (c.Estado !== 'Activo' || !c.proxima) return;
    const dias = diasEntre_(hoy, c.proxima.Fecha);
    if (dias > DIAS_RECORDATORIO) return;
    lista.push({ tipo: 'Credito', id: c.ID_Credito, titulo: c.Nombre, fecha: c.proxima.Fecha, dias: dias, valor: c.proxima.Cuota, detalle: 'Cuota ' + c.proxima.Num + ' de ' + c.cuotasTotal });
  });

  const ctx = contextoSuscripciones_();
  getTableData('Suscripciones').filter(estaActivo).forEach(x => {
    const r = resumenSuscripcion_(x, hoy, ctx);
    if (r.dias > DIAS_RECORDATORIO) return;
    lista.push({ tipo: r.Tipo, id: r.ID_Suscripcion, titulo: r.Nombre, fecha: r.Proximo_Cobro, dias: r.dias, valor: r.Valor, detalle: r.Tipo === 'Servicio' ? 'Servicio' + (r.medio ? ' · ' + r.medio : '') : 'Suscripción' + (r.medio ? ' · ' + r.medio : ''), susc: r });
  });

  return lista.sort((a, b) => a.dias - b.dias || a.titulo.localeCompare(b.titulo));
}
