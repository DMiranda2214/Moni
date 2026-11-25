/**
 * Fechas.gs — Moni
 * Todo lo de fechas y meses en un solo lugar. Las fechas viajan como texto AAAA-MM-DD y los meses como AAAA-MM
 * (así Sheets no las convierte ni las corre de día). Antes cada módulo tenía su propia copia de estas funciones.
 */

const ZONA_POR_DEFECTO = 'America/Bogota';
let ZONA_MEMO = null; // se recuerda durante una petición (reiniciarMemoria_ la olvida)

/**
 * Zona horaria de la persona (Config.Zona_Horaria), o la de Colombia si no hay. Se usa para "hoy" y las marcas de tiempo.
 * Leer Config no puede depender de la zona (para no entrar en un ciclo), así que mientras se lee se usa la por defecto.
 */
function zonaHoraria_() {
  if (ZONA_MEMO) return ZONA_MEMO;
  ZONA_MEMO = ZONA_POR_DEFECTO;
  try {
    const f = getTableData('Config').find(x => x.Clave === 'Zona_Horaria');
    const z = f ? String(f.Valor || '').trim() : '';
    if (z && zonaValida_(z)) ZONA_MEMO = z;
  } catch (e) { /* sin hoja o sin tabla: la zona por defecto */ }
  return ZONA_MEMO;
}

function zonaValida_(z) {
  if (!/^(UTC|GMT|[A-Za-z_]+\/[A-Za-z_+\-0-9\/]+)$/.test(String(z || ''))) return false;
  try { Utilities.formatDate(new Date(), z, 'yyyy'); return true; } catch (e) { return false; }
}

function hoyIso_() {
  return Utilities.formatDate(new Date(), zonaHoraria_(), 'yyyy-MM-dd');
}

/** Fecha y hora actual en ISO local (para Creado_En / Actualizado_En). */
function ahoraIso_() {
  return Utilities.formatDate(new Date(), zonaHoraria_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function dosDigitos_(n) { return String(n).padStart(2, '0'); }

/** Días que tiene un mes (mes de 1 a 12). */
function diasDelMes_(anio, mes) { return new Date(Date.UTC(anio, mes, 0)).getUTCDate(); }
const ultimoDiaMes_ = diasDelMes_;

/** AAAA-MM-DD a partir de año, mes (1-12) y día. */
function fechaTexto_(anio, mes, dia) { return anio + '-' + dosDigitos_(mes) + '-' + dosDigitos_(dia); }

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
function sumarDias_(fechaIso, n) {
  const d = new Date(Date.UTC(+fechaIso.slice(0, 4), +fechaIso.slice(5, 7) - 1, +fechaIso.slice(8, 10) + n));
  return fechaTexto_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const diasMas_ = sumarDias_;

/** Suma meses a una fecha AAAA-MM-DD conservando el día (o `dia`), con tope en el último día del mes. */
function sumarMeses_(fechaIso, meses, dia) {
  const a = +fechaIso.slice(0, 4), m = +fechaIso.slice(5, 7) - 1 + meses;
  const anio = a + Math.floor(m / 12), mes = ((m % 12) + 12) % 12 + 1;
  return fechaTexto_(anio, mes, Math.min(dia || +fechaIso.slice(8, 10), diasDelMes_(anio, mes)));
}

/** Días entre dos fechas AAAA-MM-DD (positivo si `hasta` es posterior). */
function diasEntre_(desdeIso, hastaIso) {
  const a = Date.UTC(+desdeIso.slice(0, 4), +desdeIso.slice(5, 7) - 1, +desdeIso.slice(8, 10));
  const b = Date.UTC(+hastaIso.slice(0, 4), +hastaIso.slice(5, 7) - 1, +hastaIso.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Mes AAAA-MM desplazado n meses (n negativo = hacia atrás). */
function mesMas_(mes, n) {
  const p = String(mes).split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
  return d.getUTCFullYear() + '-' + dosDigitos_(d.getUTCMonth() + 1);
}

/** Meses AAAA-MM que terminan en `mes`, del más viejo al más nuevo. */
function mesesHasta_(mes, n) {
  const lista = [];
  for (let i = n - 1; i >= 0; i--) lista.push(mesMas_(mes, -i));
  return lista;
}

/** Cuántos meses hay de `a` a `b` (AAAA-MM o AAAA-MM-DD). */
function mesesEntre_(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }

function mesValido_(mes) {
  const t = texto_(mes);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) throw new Error('El mes debe tener formato AAAA-MM.');
  return t;
}

/** ¿El texto AAAA-MM-DD es una fecha que existe (no un 31 de febrero)? */
function fechaExiste_(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(t + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}
