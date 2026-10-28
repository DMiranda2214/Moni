/**
 * Presupuesto.gs — Moni
 * Presupuesto mensual: se genera desde la plantilla de un escenario, y cada renglón tiene
 *   Plan (lo previsto), Real (se CALCULA desde los movimientos enlazados) y Pagado.
 *   Ahorro del renglón = Plan − Real, solo si está pagado (regla del Excel).
 * También reparte la nómina recibida entre los bolsillos de destino.
 */

function mesValido_(mes) {
  const t = texto_(mes);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) throw new Error('El mes debe tener formato AAAA-MM.');
  return t;
}

/**
 * Lo realmente gastado por renglón, desde los movimientos enlazados (ID_Item_Ppto):
 *   - un gasto suma su valor; un ajuste suma lo contrario de su signo;
 *   - un traslado cuenta por su pata de entrada (el dinero que llegó al destino: ahorro, fondo, cuota).
 * @returns {Object} { ID_Item: real }
 */
function realPorRenglon_() {
  const real = {};
  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    if (!m.ID_Item_Ppto) return;
    let v = 0;
    if (m.Tipo_Mov === 'Gasto' || m.Tipo_Mov === 'Ajuste') v = -(Number(m.Valor) || 0);
    else if (m.Tipo_Mov === 'Transferencia' && Number(m.Valor) > 0) v = Number(m.Valor) || 0;
    real[m.ID_Item_Ppto] = redondear2_((real[m.ID_Item_Ppto] || 0) + v);
  });
  return real;
}

/** Todo lo que necesita la pantalla del presupuesto de un mes, en una sola llamada. */
function obtenerPresupuestoMes(mes) {
  const m = mesValido_(mes || hoyIso_().slice(0, 7));
  const items = getTableData('Presupuesto_Mes').filter(i => i.Mes === m);
  const real = realPorRenglon_();
  const bolsillos = getTableData('Bolsillos');
  const escenarios = getTableData('Escenarios');
  const plantilla = getTableData('Presupuesto_Plantilla').filter(p => estaActivo(p));

  let plan = 0, gastado = 0, ahorro = 0, pagados = 0;
  const lista = items.map(i => {
    const p = Number(i.Plan) || 0;
    const r = real[i.ID_Item] || 0;
    const pagado = esVerdadero(i.Pagado);
    const b = buscarPorId_(bolsillos, 'ID_Bolsillo', i.ID_Bolsillo_Destino);
    plan += p; gastado += r;
    if (pagado) { pagados++; ahorro += p - r; }
    return {
      ID_Item: i.ID_Item, Concepto: i.Concepto, Tipo: i.Tipo || 'Gasto', Plan: p, Real: r, Pagado: pagado,
      Ahorro: pagado ? redondear2_(p - r) : 0,
      Restante: redondear2_(p - r),
      ID_Bolsillo_Destino: i.ID_Bolsillo_Destino || '', Bolsillo: b ? b.Nombre : '', ID_Credito: i.ID_Credito || '',
      Notas: i.Notas || ''
    };
  });

  // Ingresos del mes: todo lo que entró como ingreso (la nómina, y lo extra)
  let ingresos = 0;
  getTableData('Movimientos', { excludeAnulados: true }).forEach(mv => {
    if (mv.Tipo_Mov === 'Ingreso' && mv.Fecha && mv.Fecha.slice(0, 7) === m) ingresos += Number(mv.Valor) || 0;
  });
  ingresos = redondear2_(ingresos);
  const saldo = redondear2_(ingresos - gastado);

  const esc = items.length ? buscarPorId_(escenarios, 'ID_Escenario', items[0].ID_Escenario) : null;
  return {
    mes: m,
    existe: items.length > 0,
    escenario: esc ? { ID_Escenario: esc.ID_Escenario, Nombre: esc.Nombre } : null,
    items: lista,
    totales: {
      plan: redondear2_(plan), real: redondear2_(gastado), ahorro: redondear2_(ahorro),
      ingresos: ingresos, saldo: saldo, porcentajeAhorro: ingresos > 0 ? Math.round(saldo / ingresos * 1000) / 1000 : null,
      pagados: pagados, renglones: lista.length
    },
    escenarios: escenarios.filter(e => estaActivo(e)).map(e => ({
      ID_Escenario: e.ID_Escenario, Nombre: e.Nombre, Es_Base: esVerdadero(e.Es_Base),
      renglones: plantilla.filter(p => p.ID_Escenario === e.ID_Escenario).length
    }))
  };
}

/**
 * Genera el presupuesto de un mes a partir de la plantilla de un escenario.
 * Si el mes ya existe, `reemplazar` lo rehace, pero solo si ningún renglón tiene movimientos enlazados.
 */
function generarPresupuestoMes(mes, idEscenario, reemplazar) {
  const m = mesValido_(mes);
  const escenarios = leer_('Escenarios');
  const esc = idEscenario
    ? exigirActivo_(escenarios, 'ID_Escenario', idEscenario, 'El escenario')
    : escenarios.find(e => estaActivo(e) && esVerdadero(e.Es_Base));
  if (!esc) throw new Error('No hay un escenario base. Marca uno en Ajustes → Escenarios.');

  const existentes = leer_('Presupuesto_Mes').filter(i => i.Mes === m);
  if (existentes.length) {
    if (!reemplazar) throw new Error('El presupuesto de ese mes ya existe. Para rehacerlo, elige reemplazarlo.');
    const real = realPorRenglon_();
    const conMovimientos = getTableData('Movimientos', { excludeAnulados: true }).some(mv => mv.ID_Item_Ppto && existentes.some(i => i.ID_Item === mv.ID_Item_Ppto));
    if (conMovimientos || existentes.some(i => real[i.ID_Item])) {
      throw new Error('No se puede reemplazar: algunos renglones ya tienen movimientos. Anúlalos primero o edita los renglones.');
    }
    existentes.sort((a, b) => b._rowIndex - a._rowIndex).forEach(i => deleteRow('Presupuesto_Mes', i._rowIndex));
  }

  const plantilla = leer_('Presupuesto_Plantilla')
    .filter(p => p.ID_Escenario === esc.ID_Escenario && estaActivo(p))
    .sort((a, b) => (Number(a.Orden) || 9999) - (Number(b.Orden) || 9999));
  if (!plantilla.length) {
    throw new Error('El escenario "' + esc.Nombre + '" no tiene renglones. Agrégalos en Ajustes → Plantilla del presupuesto.');
  }

  insertRows('Presupuesto_Mes', plantilla.map(p => ({
    ID_Item: nuevoId_('itm'), Mes: m, ID_Escenario: esc.ID_Escenario, ID_Plantilla: p.ID_Plantilla,
    Concepto: p.Concepto, Tipo: p.Tipo || 'Gasto', Plan: Number(p.Monto_Plan) || 0, Pagado: false,
    ID_Bolsillo_Destino: p.ID_Bolsillo_Destino || '', ID_Credito: p.ID_Credito || '', Notas: ''
  })));
  return { mes: m, creados: plantilla.length, escenario: esc.Nombre };
}

/** Agrega o edita un renglón de un mes (por ejemplo, un gasto que no estaba previsto). */
function guardarRenglonMes(item) {
  if (!item || typeof item !== 'object') throw new Error('Faltan los datos del renglón.');
  const filas = leer_('Presupuesto_Mes');
  const actual = item.ID_Item ? buscarPorId_(filas, 'ID_Item', item.ID_Item) : null;
  if (item.ID_Item && !actual) throw new Error('El renglón no existe.');

  const mes = mesValido_(item.Mes !== undefined ? item.Mes : actual && actual.Mes);
  const concepto = textoRequerido_(item.Concepto !== undefined ? item.Concepto : actual && actual.Concepto, 'El concepto');
  if (filas.some(f => (!actual || f.ID_Item !== actual.ID_Item) && f.Mes === mes && texto_(f.Concepto).toLowerCase() === concepto.toLowerCase())) {
    throw new Error('Ya hay un renglón llamado "' + concepto + '" en este mes.');
  }
  const tipo = opcion_(item.Tipo !== undefined ? item.Tipo : actual && actual.Tipo, ENUMS.Presupuesto_Mes.Tipo, 'El tipo', 'Gasto');
  const idBolsillo = item.ID_Bolsillo_Destino !== undefined ? item.ID_Bolsillo_Destino : actual && actual.ID_Bolsillo_Destino;
  if (idBolsillo) exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo de destino');
  if (tipo !== 'Gasto' && !idBolsillo) throw new Error('Un renglón de ' + tipo.toLowerCase() + ' necesita un bolsillo de destino.');

  const datos = {
    Mes: mes, Concepto: concepto, Tipo: tipo,
    Plan: numero_(item.Plan !== undefined ? item.Plan : actual && actual.Plan, 'El plan', { requerido: true, min: 0, max: VALOR_MAXIMO }),
    ID_Bolsillo_Destino: idBolsillo || '',
    ID_Credito: item.ID_Credito !== undefined ? texto_(item.ID_Credito) : (actual ? actual.ID_Credito || '' : ''),
    Notas: texto_(item.Notas !== undefined ? item.Notas : actual && actual.Notas).slice(0, 300)
  };
  if (datos.ID_Credito && !leer_('Creditos').some(c => c.ID_Credito === datos.ID_Credito && c.Estado === 'Activo')) throw new Error('El crédito no existe o ya está pagado.');

  if (actual) {
    updateRow('Presupuesto_Mes', actual._rowIndex, datos);
    return Object.assign({}, actual, datos);
  }
  const esc = filas.find(f => f.Mes === mes);
  const base = leer_('Escenarios').find(e => estaActivo(e) && esVerdadero(e.Es_Base));
  const nuevo = Object.assign({
    ID_Item: nuevoId_('itm'), ID_Escenario: esc ? esc.ID_Escenario : (base ? base.ID_Escenario : ''),
    ID_Plantilla: '', Pagado: false, ID_Credito: ''
  }, datos);
  insertRow('Presupuesto_Mes', nuevo);
  return nuevo;
}

/** Quita un renglón del mes. Solo si no tiene movimientos enlazados. */
function eliminarRenglonMes(idItem) {
  const fila = buscarPorId_(leer_('Presupuesto_Mes'), 'ID_Item', idItem);
  if (!fila) throw new Error('El renglón no existe.');
  const enlazados = getTableData('Movimientos', { excludeAnulados: true }).filter(m => m.ID_Item_Ppto === idItem).length;
  if (enlazados) throw new Error('No se puede quitar "' + fila.Concepto + '": tiene ' + enlazados + ' movimiento(s) enlazado(s). Anúlalos primero.');
  deleteRow('Presupuesto_Mes', fila._rowIndex);
  return { mes: fila.Mes };
}

/** Marca un renglón como pagado o pendiente (el check del Excel). */
function marcarRenglonPagado(idItem, pagado) {
  const fila = buscarPorId_(leer_('Presupuesto_Mes'), 'ID_Item', idItem);
  if (!fila) throw new Error('El renglón no existe.');
  updateRow('Presupuesto_Mes', fila._rowIndex, { Pagado: !!pagado });
  return { mes: fila.Mes, pagado: !!pagado };
}

// ---------------------------------------------------------------------------
// Distribución de la nómina entre bolsillos
// ---------------------------------------------------------------------------

const PREFIJO_DISTRIBUCION = 'Distribución ';

/**
 * Qué dinero se traslada desde el bolsillo donde llegó la nómina a los de destino.
 *   - Los renglones de gasto y de cuota de crédito se agrupan por bolsillo (un traslado por destino: es el fondeo).
 *   - Los de ahorro y fondo van uno por uno, enlazados a su renglón: ese traslado ES su "real".
 *   - Lo que ya está en el bolsillo de origen no se mueve.
 */
function previsualizarDistribucion(mes, idOrigen) {
  const m = mesValido_(mes);
  const bolsillos = leer_('Bolsillos');
  const origen = exigirActivo_(bolsillos, 'ID_Bolsillo', idOrigen, 'El bolsillo de origen');
  const items = leer_('Presupuesto_Mes').filter(i => i.Mes === m && Number(i.Plan) > 0 && i.ID_Bolsillo_Destino && i.ID_Bolsillo_Destino !== idOrigen);
  const nombre = id => { const b = buscarPorId_(bolsillos, 'ID_Bolsillo', id); return b ? b.Nombre : ''; };

  const porDestino = {};
  const lineas = [];
  items.forEach(i => {
    // Gasto y Cuota se agrupan por bolsillo (fondeo). La cuota de un crédito cuenta como "real" cuando
    // se paga de verdad (ese traslado se enlaza al renglón), no al repartir la nómina.
    if ((i.Tipo || 'Gasto') === 'Gasto' || i.Tipo === 'Cuota') {
      const l = porDestino[i.ID_Bolsillo_Destino] || (porDestino[i.ID_Bolsillo_Destino] = {
        ID_Destino: i.ID_Bolsillo_Destino, Destino: nombre(i.ID_Bolsillo_Destino), Monto: 0, Renglones: [], ID_Item: ''
      });
      l.Monto += Number(i.Plan) || 0; l.Renglones.push(i.Concepto);
    } else {
      lineas.push({ ID_Destino: i.ID_Bolsillo_Destino, Destino: nombre(i.ID_Bolsillo_Destino), Monto: Number(i.Plan) || 0, Renglones: [i.Concepto], ID_Item: i.ID_Item });
    }
  });
  Object.keys(porDestino).forEach(k => lineas.unshift(porDestino[k]));
  lineas.forEach(l => { l.Monto = redondear2_(l.Monto); });

  const marca = PREFIJO_DISTRIBUCION + m;
  const yaDistribuido = getTableData('Movimientos', { excludeAnulados: true }).some(mv => mv.Subtipo === 'Distribucion' && mv.Notas === marca);
  return {
    mes: m, origen: { ID_Bolsillo: origen.ID_Bolsillo, Nombre: origen.Nombre },
    lineas: lineas, total: redondear2_(lineas.reduce((a, l) => a + l.Monto, 0)), yaDistribuido: yaDistribuido
  };
}

/**
 * Ejecuta la distribución: un traslado por línea, con la marca del mes para no repetirla por error.
 * Si ya se distribuyó ese mes, exige `forzar`.
 */
function distribuirNomina(mes, idOrigen, fecha, forzar) {
  const prev = previsualizarDistribucion(mes, idOrigen);
  if (!prev.lineas.length) throw new Error('No hay nada que distribuir: los renglones del mes no tienen bolsillo de destino distinto del de origen.');
  if (prev.yaDistribuido && !forzar) throw new Error('Este mes ya se distribuyó. Si quieres repetirlo, confírmalo.');

  const marca = PREFIJO_DISTRIBUCION + prev.mes;
  const ids = [];
  prev.lineas.forEach(l => {
    const desc = marca + ': ' + (l.ID_Item ? l.Renglones[0] : l.Destino);
    const r = registrarTransferencia(idOrigen, l.ID_Destino, l.Monto, fecha, desc, marca, 'App', { Subtipo: 'Distribucion', ID_Item_Ppto: l.ID_Item });
    r.patas.forEach(p => ids.push(p.ID_Mov));
  });
  return { mes: prev.mes, traslados: prev.lineas.length, total: prev.total, ids: ids };
}
