/**
 * Recurrentes.gs — Moni
 * Lo común a todo lo que se repite: lo que pagas (suscripciones y servicios, en Suscripciones.gs) y lo que recibes
 * (ingresos recurrentes, en Ingresos.gs). Antes cada módulo tenía su copia de estas reglas.
 *   - El próximo cobro avanza un período conservando el día (31 → 28 → 31).
 *   - Costo (o ingreso) mensual y anual, para comparar periodicidades distintas.
 *   - Estado según los días que faltan: atrasado/vencido, pronto (≤ 7 días) u ok.
 *   - Saltar un cobro y deshacer: lo anterior se guarda para volver a dejarlo como estaba.
 */

const MESES_PERIODO = { Mensual: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };
const DIAS_PRONTO = 7;

/** Lo que cuesta (o rinde) al mes, para comparar una suscripción anual con una mensual. */
function costoMensual_(valor, periodicidad) {
  return redondear2_((Number(valor) || 0) / (MESES_PERIODO[periodicidad] || 1));
}

/** Lo que cuesta (o rinde) en un año. */
function costoAnual_(valor, periodicidad) {
  return redondear2_((Number(valor) || 0) * 12 / (MESES_PERIODO[periodicidad] || 1));
}

/** La fecha del cobro siguiente al próximo, conservando el día de cobro. */
function siguienteCobro_(r) {
  return sumarMeses_(r.Proximo_Cobro, MESES_PERIODO[r.Periodicidad] || 1, Number(r.Dia_Cobro));
}

/**
 * Lo común del resumen de algo que se repite.
 * @param {string} atrasado cómo se llama el estado cuando ya pasó la fecha ("vencida" para un pago, "atrasado" para un ingreso)
 */
function resumenRecurrente_(r, hoy, atrasado) {
  const dias = diasEntre_(hoy, r.Proximo_Cobro);
  const valor = Number(r.Valor) || 0;
  return {
    Valor: valor, Periodicidad: r.Periodicidad || 'Mensual', Proximo_Cobro: r.Proximo_Cobro, dias: dias,
    estado: dias < 0 ? atrasado : (dias <= DIAS_PRONTO ? 'pronto' : 'ok'),
    mensual: costoMensual_(valor, r.Periodicidad), anual: costoAnual_(valor, r.Periodicidad)
  };
}

/** Totales de una lista de resúmenes. */
function totalesRecurrentes_(lista) {
  const suma = (arr, f) => redondear2_(arr.reduce((acc, x) => acc + f(x), 0));
  return { cantidad: lista.length, mensual: suma(lista, x => x.mensual), anual: suma(lista, x => x.anual), pronto: lista.filter(x => x.dias <= DIAS_PRONTO).length };
}

/** Pasa al siguiente cobro sin registrar nada. Devuelve lo anterior (para deshacer) y el próximo. */
function saltarRecurrente_(tabla, r, campoUltimo) {
  const anterior = { Proximo_Cobro: r.Proximo_Cobro, Valor: Number(r.Valor) || 0 };
  anterior[campoUltimo] = r[campoUltimo] || '';
  const proximo = siguienteCobro_(r);
  updateRow(tabla, r, { Proximo_Cobro: proximo });
  return { anterior: anterior, proximo: proximo };
}

/** Deja el cobro como estaba antes de pagarlo o recibirlo. */
function restaurarRecurrente_(tabla, r, anterior, campoUltimo, conValor) {
  if (!anterior || !anterior.Proximo_Cobro) throw new Error('Faltan los datos para deshacer.');
  const cambios = { Proximo_Cobro: fechaIso_(anterior.Proximo_Cobro, 'El cobro') };
  cambios[campoUltimo] = texto_(anterior[campoUltimo]);
  if (conValor) cambios.Valor = numero_(anterior.Valor, 'El valor', { defecto: r.Valor });
  updateRow(tabla, r, cambios);
}
