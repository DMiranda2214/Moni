/**
 * Regalos.gs — Moni
 * Lista de regalos por año (por ejemplo, Navidad): a quién, qué idea, cuánto se estima y cuánto
 * se gastó. El "real" se CALCULA desde los gastos registrados para ese regalo, igual que el real
 * del presupuesto.
 */

const MARCA_REGALO = 'Regalo ';

function anioValido_(anio) {
  const n = Number(anio);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error('El año no es válido.');
  return n;
}

/** Gasto real por regalo, desde los movimientos marcados con "Regalo <ID>". */
function realPorRegalo_() {
  const real = {};
  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    const n = texto_(m.Notas);
    if (n.indexOf(MARCA_REGALO) !== 0 || m.Tipo_Mov !== 'Gasto') return;
    const id = n.slice(MARCA_REGALO.length);
    real[id] = redondear2_((real[id] || 0) + (-(Number(m.Valor) || 0)));
  });
  return real;
}

/** Pantalla de los regalos de un año, en una sola llamada. */
function obtenerRegalos(anio) {
  const a = anioValido_(anio || cfgValor_('Anio_Activo') || new Date().getFullYear());
  const personas = getTableData('Personas');
  const real = realPorRegalo_();
  const todos = getTableData('Regalos');

  const items = todos.filter(r => Number(r.Anio) === a).map(r => {
    const p = buscarPorId_(personas, 'ID_Persona', r.ID_Persona);
    const gastado = real[r.ID_Regalo] || 0;
    const aplica = r.Aplica === '' || r.Aplica === undefined ? true : esVerdadero(r.Aplica);
    const est = Number(r.Estimado) || 0;
    return {
      ID_Regalo: r.ID_Regalo, ID_Persona: r.ID_Persona, Persona: p ? p.Nombre : '', Idea: r.Idea || '', Notas: r.Notas || '',
      Estimado: est, Real: gastado, Diferencia: redondear2_(est - gastado), Aplica: aplica, Comprado: gastado > 0
    };
  }).sort((x, y) => x.Persona.localeCompare(y.Persona));

  const aplican = items.filter(i => i.Aplica);
  const suma = f => redondear2_(aplican.reduce((acc, i) => acc + f(i), 0));
  const anios = {}; todos.forEach(r => { anios[Number(r.Anio)] = true; }); anios[a] = true;
  return {
    anio: a, items: items, anios: Object.keys(anios).map(Number).sort((x, y) => y - x),
    totales: { estimado: suma(i => i.Estimado), real: suma(i => i.Real), diferencia: suma(i => i.Diferencia), comprados: aplican.filter(i => i.Comprado).length, total: aplican.length }
  };
}

/** Crea o edita un regalo. */
function guardarRegalo(r) {
  if (!r || typeof r !== 'object') throw new Error('Faltan los datos del regalo.');
  const filas = leer_('Regalos');
  const actual = r.ID_Regalo ? buscarPorId_(filas, 'ID_Regalo', r.ID_Regalo) : null;
  if (r.ID_Regalo && !actual) throw new Error('El regalo no existe.');

  const idPersona = r.ID_Persona !== undefined ? r.ID_Persona : actual && actual.ID_Persona;
  exigirActivo_(leer_('Personas'), 'ID_Persona', idPersona, 'La persona');
  const anio = anioValido_(r.Anio !== undefined ? r.Anio : actual && actual.Anio);
  const datos = {
    Anio: anio, ID_Persona: idPersona,
    Idea: texto_(r.Idea !== undefined ? r.Idea : actual && actual.Idea).slice(0, 120),
    Estimado: numero_(r.Estimado !== undefined ? r.Estimado : actual && actual.Estimado, 'El estimado', { requerido: true, min: 0, max: VALOR_MAXIMO }),
    Aplica: r.Aplica !== undefined ? esVerdadero(r.Aplica) : (actual ? esVerdadero(actual.Aplica) || actual.Aplica === '' : true),
    Notas: texto_(r.Notas !== undefined ? r.Notas : actual && actual.Notas).slice(0, 300)
  };
  if (actual) { updateRow('Regalos', actual._rowIndex, datos); return Object.assign({}, actual, datos); }
  const nuevo = Object.assign({ ID_Regalo: nuevoId_('reg'), Real: '', ID_Mov: '' }, datos);
  insertRow('Regalos', nuevo);
  return nuevo;
}

/** Quita un regalo. Solo si no tiene gastos registrados. */
function eliminarRegalo(idRegalo) {
  const fila = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!fila) throw new Error('El regalo no existe.');
  if ((realPorRegalo_()[idRegalo] || 0) > 0) throw new Error('Este regalo ya tiene gastos registrados. Anúlalos primero.');
  deleteRow('Regalos', fila._rowIndex);
  return { anio: Number(fila.Anio) };
}

/** Registra lo que costó un regalo: un gasto en el bolsillo elegido, marcado con el regalo. */
function registrarGastoRegalo(idRegalo, valor, idBolsillo, fecha) {
  const regalo = buscarPorId_(leer_('Regalos'), 'ID_Regalo', idRegalo);
  if (!regalo) throw new Error('El regalo no existe.');
  exigirPesos_(idBolsillo, 'El bolsillo del regalo');
  const p = buscarPorId_(leer_('Personas'), 'ID_Persona', regalo.ID_Persona);
  const cat = leer_('Categorias').find(c => c.ID_Categoria === 'cat-regalos' && estaActivo(c));
  const mov = registrarMovimiento({
    Tipo_Mov: 'Gasto', Valor: valor, Fecha: fecha, ID_Bolsillo: idBolsillo, ID_Categoria: cat ? cat.ID_Categoria : '',
    Concepto: 'Regalo: ' + (p ? p.Nombre : '') + (regalo.Idea ? ' · ' + regalo.Idea : ''), Notas: MARCA_REGALO + idRegalo
  });
  return { idMov: mov.ID_Mov, anio: Number(regalo.Anio) };
}
