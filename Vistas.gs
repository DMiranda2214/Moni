/**
 * Vistas.gs — Moni
 * Hojas de consulta con fórmulas dentro del propio Sheet, para mirar los datos sin abrir la app.
 * Son de solo lectura: se recalculan solas y se pueden borrar o reinstalar sin perder nada.
 *   Vista_Bolsillos → saldo de cada bolsillo (apertura + movimientos no anulados).
 *   Vista_Anual     → por mes del año elegido: ingresos, gastos y presupuesto planeado.
 * Las columnas se leen del esquema (SCHEMAS), así que si cambia el orden de una tabla las fórmulas se ajustan.
 */

const VISTA_BOLSILLOS = 'Vista_Bolsillos';
const VISTA_ANUAL = 'Vista_Anual';

/** Rango de una columna de una tabla (sin encabezado), por ejemplo Movimientos!$E$2:$E. */
function rangoColumna_(tabla, columna) {
  const i = SCHEMAS[tabla].headers.indexOf(columna);
  if (i < 0) throw new Error('No existe la columna ' + tabla + '.' + columna);
  const letra = letraColumna_(i + 1);
  return tabla + '!$' + letra + '$2:$' + letra;
}

function letraColumna_(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function hojaVista_(ss, nombre) {
  let h = ss.getSheetByName(nombre);
  if (h) h.clear(); else h = ss.insertSheet(nombre);
  return h;
}

/** Crea o rehace las hojas de vista. */
function instalarVistas() {
  const ss = getSpreadsheet();
  const mov = c => rangoColumna_('Movimientos', c);

  // --- Vista_Bolsillos ---
  const hb = hojaVista_(ss, VISTA_BOLSILLOS);
  hb.getRange(1, 1, 1, 4).setValues([['Cuenta', 'Bolsillo', 'Saldo', 'Activo']]);
  const idB = rangoColumna_('Bolsillos', 'ID_Bolsillo');
  hb.getRange('A2').setFormula('=IFERROR(ARRAYFORMULA(VLOOKUP(FILTER(' + rangoColumna_('Bolsillos', 'ID_Cuenta') + ',' + idB + '<>""),' +
    'FILTER({' + rangoColumna_('Cuentas', 'ID_Cuenta') + ',' + rangoColumna_('Cuentas', 'Nombre') + '},' + rangoColumna_('Cuentas', 'ID_Cuenta') + '<>""),2,FALSE)),"")');
  hb.getRange('B2').setFormula('=IFERROR(FILTER(' + rangoColumna_('Bolsillos', 'Nombre') + ',' + idB + '<>""),"")');
  hb.getRange('C2').setFormula('=IFERROR(MAP(FILTER(' + idB + ',' + idB + '<>""),FILTER(' + rangoColumna_('Bolsillos', 'Saldo_Apertura') + ',' + idB + '<>""),' +
    'LAMBDA(id,ap,N(ap)+SUMIFS(' + mov('Valor') + ',' + mov('ID_Bolsillo') + ',id,' + mov('Anulado') + ',"<>TRUE"))),"")');
  hb.getRange('D2').setFormula('=IFERROR(FILTER(' + rangoColumna_('Bolsillos', 'Activo') + ',' + idB + '<>""),"")');
  hb.getRange('C:C').setNumberFormat('#,##0');
  hb.setFrozenRows(1); hb.getRange(1, 1, 1, 4).setFontWeight('bold');

  // --- Vista_Anual ---
  const ha = hojaVista_(ss, VISTA_ANUAL);
  ha.getRange('A1:B1').setValues([['Año', new Date().getFullYear()]]);
  ha.getRange('A3:E3').setValues([['Mes', 'Ingresos', 'Gastos', 'Plan del presupuesto', 'Restante']]);
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const r = m + 3;
    const clave = '$B$1&"-"&TEXT(' + m + ',"00")';
    meses.push([
      m,
      '=SUMIFS(' + mov('Valor') + ',' + mov('Tipo_Mov') + ',"Ingreso",' + mov('Fecha') + ',' + clave + '&"*",' + mov('Anulado') + ',"<>TRUE")',
      '=-SUMIFS(' + mov('Valor') + ',' + mov('Tipo_Mov') + ',"Gasto",' + mov('Fecha') + ',' + clave + '&"*",' + mov('Anulado') + ',"<>TRUE")',
      '=SUMIFS(' + rangoColumna_('Presupuesto_Mes', 'Plan') + ',' + rangoColumna_('Presupuesto_Mes', 'Mes') + ',' + clave + ')',
      '=B' + r + '-D' + r
    ]);
  }
  ha.getRange(4, 1, 12, 5).setFormulas(meses);
  ha.getRange('A16:E16').setFormulas([['Total', '=SUM(B4:B15)', '=SUM(C4:C15)', '=SUM(D4:D15)', '=SUM(E4:E15)']]);
  ha.getRange('B4:E16').setNumberFormat('#,##0');
  ha.setFrozenRows(3); ha.getRange('A3:E3').setFontWeight('bold'); ha.getRange('A16:E16').setFontWeight('bold');
  return { hojas: [VISTA_BOLSILLOS, VISTA_ANUAL] };
}
