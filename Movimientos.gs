/**
 * Movimientos.gs — Moni
 * Libro mayor de los bolsillos: gastos, ingresos, ajustes y traslados.
 *   Valor negativo = sale del bolsillo; positivo = entra.
 *   Un traslado son dos filas con el mismo ID_Grupo que suman cero.
 *   Nada se borra: se anula (y se puede restaurar).
 */

const TIPOS_MANUALES = ['Gasto', 'Ingreso', 'Ajuste'];
const VALOR_MAXIMO = 1e12;

/** Valida una fecha de movimiento: AAAA-MM-DD, existente y no futura. Vacía = hoy. */
function fechaMovimiento_(f) {
  const t = (texto_(f) || hoyIso_()).replace(/\//g, '-'); // se acepta AAAA/MM/DD y AAAA-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('La fecha debe tener formato AAAA/MM/DD.');
  if (!fechaExiste_(t)) throw new Error('La fecha no existe.');
  if (t > hoyIso_()) throw new Error('La fecha no puede ser futura.');
  return t;
}

/** Renglón del presupuesto opcional: debe existir. Devuelve su ID (o vacío). */
function renglonMovimiento_(idItem) {
  if (!idItem) return '';
  if (!leer_('Presupuesto_Mes').some(i => i.ID_Item === idItem)) throw new Error('El renglón del presupuesto no existe.');
  return idItem;
}

/** Categoría opcional: debe existir, estar activa y ser del mismo tipo que el movimiento. */
function categoriaMovimiento_(idCategoria, tipo) {
  if (!idCategoria) return '';
  const cat = exigirActivo_(leer_('Categorias'), 'ID_Categoria', idCategoria, 'La categoría');
  if (tipo !== 'Ajuste' && cat.Tipo !== tipo) {
    throw new Error('La categoría "' + cat.Nombre + '" es de ' + cat.Tipo.toLowerCase() + ', no de ' + tipo.toLowerCase() + '.');
  }
  return idCategoria;
}

/** Normaliza el valor con su signo: Gasto negativo, Ingreso positivo, Ajuste con el signo recibido. */
/**
 * Vínculos que la app escribe para reconocer lo que generó un movimiento o una compra (un crédito, un extracto, un regalo,
 * una suscripción, la distribución de un mes…). Antes vivían solo en Notas; desde 1.11 se guardan también en la columna
 * Ref, así la persona puede editar sus notas sin romper el vínculo. Los registros viejos sin Ref siguen leyéndose de Notas.
 */
const MARCAS_SISTEMA = /^(Crédito |Extracto |Abono |Pago |Suscripción |Ingreso recurrente |Regalo |Distribución |Cargo |Meta |Inversión )/;

/** Ref de un cargo (comisión, impuesto…): "Cargo <ID de la operación>" (ver Cargos.gs). */
const MARCA_CARGO = 'Cargo ';

function esMarcaSistema_(t) { return MARCAS_SISTEMA.test(texto_(t)); }

/** El vínculo de un registro: su Ref o, en los registros de antes de 1.11, sus Notas. */
function refDe_(fila) { return texto_(fila && fila.Ref) || texto_(fila && fila.Notas); }

/** Completa Ref en un registro nuevo cuyas Notas son una marca de la app. */
function conRef_(fila) {
  if (fila && !texto_(fila.Ref) && esMarcaSistema_(fila.Notas)) fila.Ref = texto_(fila.Notas);
  return fila;
}

/**
 * Una sola regla para decir si un movimiento es ingreso o gasto en informes y totales. No lo son: los traslados (y las
 * conversiones entre divisas, que son traslados) ni el dinero que entra o sale de una inversión (abrir o cobrar el
 * capital de un CDT): el dinero solo cambia de lugar. Sí cambian el saldo del bolsillo.
 */
const SUBTIPOS_INVERSION = ['CDT_Apertura', 'CDT_Retorno', 'Desembolso', 'Inversion_Compra', 'Inversion_Venta', 'Broker_Deposito', 'Broker_Retiro']; // el desembolso de un crédito es una deuda, no un ingreso

function esIngresoOGasto_(m) {
  return m.Tipo_Mov !== 'Transferencia' && SUBTIPOS_INVERSION.indexOf(m.Subtipo) === -1;
}

function valorConSigno_(valor, tipo) {
  const n = numero_(valor, 'El valor', { requerido: true, max: VALOR_MAXIMO, min: -VALOR_MAXIMO });
  if (tipo === 'Ajuste') {
    if (n === 0) throw new Error('El ajuste no puede ser cero.');
    return n;
  }
  if (n <= 0) throw new Error('El valor debe ser mayor que cero.');
  return tipo === 'Gasto' ? -n : n;
}

/**
 * Registra un gasto, un ingreso o un ajuste en un bolsillo.
 * @param {Object} m { Fecha, Concepto, ID_Bolsillo, Valor, Tipo_Mov, ID_Categoria, Subtipo, Notas, Origen, ID_Item_Ppto, ID_Grupo, Afecta_Saldos }
 *   Para Gasto e Ingreso el valor se escribe positivo; el signo lo pone la app.
 *   Con `Afecta_Saldos: false` el movimiento es "histórico": cuenta en gráficos, presupuesto y vista anual, pero no cambia
 *   ningún saldo (para quien empieza a usar Moni a mitad de mes y anota lo que ya había pasado). Un ajuste siempre afecta.
 * @returns {Object} la fila creada
 */
function registrarMovimiento(m) {
  if (!m || typeof m !== 'object') throw new Error('Faltan los datos del movimiento.');
  exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', m.ID_Bolsillo, 'El bolsillo');
  const tipo = opcion_(m.Tipo_Mov || 'Gasto', TIPOS_MANUALES, 'El tipo de movimiento');
  const afecta = quiereAfectarSaldos_(m.Afecta_Saldos, tipo);

  const fila = {
    ID_Mov: nuevoId_('mov'),
    Fecha: fechaMovimiento_(m.Fecha),
    Concepto: textoRequerido_(m.Concepto, 'El concepto').slice(0, 120),
    ID_Bolsillo: m.ID_Bolsillo,
    Valor: valorConSigno_(m.Valor, tipo),
    Tipo_Mov: tipo,
    Subtipo: opcion_(m.Subtipo || '', ENUMS.Movimientos.Subtipo, 'El subtipo', ''),
    ID_Categoria: categoriaMovimiento_(m.ID_Categoria, tipo),
    ID_Grupo: texto_(m.ID_Grupo),
    ID_Item_Ppto: renglonMovimiento_(texto_(m.ID_Item_Ppto)),
    Notas: texto_(m.Notas).slice(0, 500),
    Origen: opcion_(m.Origen || 'App', ENUMS.Movimientos.Origen, 'El origen'),
    Anulado: false,
    Afecta_Saldos: afecta,
    Ref: texto_(m.Ref).slice(0, 200)
  };
  insertRow('Movimientos', conRef_(fila));
  return fila;
}

/**
 * Conceptos que la persona ya usó, para autocompletar al registrar: por cada tipo (Gasto, Ingreso), los más repetidos
 * con lo último que se registró bajo ese nombre (bolsillo, categoría, valor y renglón). Solo movimientos hechos a mano:
 * no los que genera la app (nómina, traslados, pagos de crédito…). Las compras con tarjeta cuentan como gastos con la
 * tarjeta como medio ("T:<id>").
 */
function sugerirConceptos(limite) {
  const tope = Math.max(1, Math.min(Number(limite) || 60, 200));
  const grupos = { Gasto: {}, Ingreso: {} };
  const anotar = (tipo, concepto, fecha, creado, datos) => {
    const nombre = texto_(concepto);
    if (!nombre || !grupos[tipo]) return;
    const clave = nombre.toLowerCase();
    const g = grupos[tipo][clave] || (grupos[tipo][clave] = { Concepto: nombre, usos: 0, ultima: '' });
    g.usos++;
    const marca = String(fecha || '') + '|' + String(creado || '');
    if (marca >= g.ultima) { g.ultima = marca; g.Concepto = nombre; Object.assign(g, datos); }
  };
  getTableData('Movimientos', { excludeAnulados: true }).forEach(m => {
    if ((m.Tipo_Mov !== 'Gasto' && m.Tipo_Mov !== 'Ingreso') || m.Subtipo || m.ID_Grupo) return;
    anotar(m.Tipo_Mov, m.Concepto, m.Fecha, m.Creado_En, { ID_Bolsillo: m.ID_Bolsillo, ID_Categoria: m.ID_Categoria || '', ID_Item_Ppto: m.ID_Item_Ppto || '', Valor: Math.abs(Number(m.Valor) || 0) });
  });
  getTableData('Compras_TC').filter(c => !esVerdadero(c.Anulado)).forEach(c => {
    anotar('Gasto', c.Concepto, c.Fecha, c.Creado_En, { ID_Bolsillo: 'T:' + c.ID_Tarjeta, ID_Categoria: c.ID_Categoria || '', ID_Item_Ppto: c.ID_Item_Ppto || '', Valor: Math.abs(Number(c.Valor) || 0) });
  });
  const salida = {};
  Object.keys(grupos).forEach(tipo => {
    salida[tipo] = Object.keys(grupos[tipo]).map(k => grupos[tipo][k])
      .sort((a, b) => b.usos - a.usos || (b.ultima > a.ultima ? 1 : -1)).slice(0, tope)
      .map(g => ({ Concepto: g.Concepto, Usos: g.usos, ID_Bolsillo: g.ID_Bolsillo, ID_Categoria: g.ID_Categoria, ID_Item_Ppto: g.ID_Item_Ppto, Valor: g.Valor }));
  });
  return salida;
}

/** Interpreta la casilla "afecta saldos" (por defecto sí). Un ajuste corrige un saldo, así que no puede ser histórico. */
function quiereAfectarSaldos_(valor, tipo) {
  const afecta = !(valor === false || String(valor).toLowerCase() === 'false');
  if (!afecta && tipo === 'Ajuste') throw new Error('Un ajuste corrige un saldo, así que siempre lo cambia.');
  return afecta;
}

/**
 * Traslada dinero de un bolsillo a otro (de la misma cuenta o de otra).
 * Crea dos filas con el mismo ID_Grupo: la suma es cero.
 */
function registrarTransferencia(origenId, destinoId, valor, fecha, concepto, notas, origen, extra) {
  if (origenId === destinoId) throw new Error('El bolsillo de origen y el de destino no pueden ser el mismo.');
  const bolsillos = leer_('Bolsillos');
  const desde = exigirActivo_(bolsillos, 'ID_Bolsillo', origenId, 'El bolsillo de origen');
  const hacia = exigirActivo_(bolsillos, 'ID_Bolsillo', destinoId, 'El bolsillo de destino');
  const divisas = mapaDivisas_().bolsillos;
  if (divisas[origenId] !== divisas[destinoId]) {
    throw new Error('"' + desde.Nombre + '" está en ' + divisas[origenId] + ' y "' + hacia.Nombre + '" en ' + divisas[destinoId] + '. Para pasar dinero entre divisas usa "Convertir divisas".');
  }
  const monto = numero_(valor, 'El valor', { requerido: true, max: VALOR_MAXIMO });
  if (monto <= 0) throw new Error('El valor debe ser mayor que cero.');

  const f = fechaMovimiento_(fecha);
  const desc = texto_(concepto).slice(0, 120) || 'Traslado entre bolsillos';
  const idGrupo = nuevoId_('grp');
  // extra: { Subtipo, ID_Item_Ppto } para traslados que genera la app (distribución de nómina, pagos…).
  // `Afecta_Saldos: false` anota un traslado histórico (ya contado en los saldos iniciales): queda en los movimientos, sin mover saldos.
  const ex = extra || {};
  const afecta = quiereAfectarSaldos_(ex.Afecta_Saldos, 'Transferencia');
  const comun = { Fecha: f, Concepto: desc, Tipo_Mov: 'Transferencia', Subtipo: opcion_(ex.Subtipo || '', ENUMS.Movimientos.Subtipo, 'El subtipo', ''), ID_Categoria: '', ID_Grupo: idGrupo, ID_Item_Ppto: renglonMovimiento_(texto_(ex.ID_Item_Ppto)), Notas: texto_(notas).slice(0, 500), Origen: origen || 'App', Anulado: false, Afecta_Saldos: afecta };

  const salida = Object.assign({ ID_Mov: nuevoId_('mov'), ID_Bolsillo: desde.ID_Bolsillo, Valor: -monto }, comun);
  const entrada = Object.assign({ ID_Mov: nuevoId_('mov'), ID_Bolsillo: hacia.ID_Bolsillo, Valor: monto }, comun);
  insertRows('Movimientos', [conRef_(salida), conRef_(entrada)]);

  return { ok: true, idGrupo: idGrupo, patas: [salida, entrada] };
}

/** Categoría de las comisiones de conversión: se crea la primera vez; si la persona la desactivó, queda sin categoría. */
function categoriaComision_() {
  const existente = categoriaPorRol_('Comision', true);
  if (existente) return estaActivo(existente) ? existente.ID_Categoria : '';
  const cats = leer_('Categorias');
  insertRow('Categorias', { ID_Categoria: 'cat-comision', Nombre: 'Comisión bancaria', Tipo: 'Gasto', Icono: '', Color: '', Activo: true, Orden: siguienteOrden_(cats), Rol: 'Comision' });
  return 'cat-comision';
}

/**
 * Convierte dinero de una divisa a otra (por ejemplo, comprar dólares): sale un valor de un bolsillo y entra
 * otro, en la divisa del bolsillo de destino. Son dos filas con el mismo ID_Grupo (se anulan juntas); como cada
 * una está en su divisa, no suman cero. La tasa implícita queda anotada.
 * La comisión del banco, si la hay, es un gasto aparte dentro de la misma conversión (mismo ID_Grupo): se cobra
 * del bolsillo de origen o del de destino, queda como gasto de su categoría y se anula junto con la conversión.
 * @param {Object} c { origen, destino, valorOrigen, valorDestino, fecha, concepto, notas, comision, comisionEn: 'origen'|'destino' }
 */
function registrarConversion(c) {
  const x = c || {};
  const bolsillos = leer_('Bolsillos');
  const desde = exigirActivo_(bolsillos, 'ID_Bolsillo', x.origen, 'El bolsillo de origen');
  const hacia = exigirActivo_(bolsillos, 'ID_Bolsillo', x.destino, 'El bolsillo de destino');
  const divisas = mapaDivisas_().bolsillos;
  const dOrigen = divisas[desde.ID_Bolsillo], dDestino = divisas[hacia.ID_Bolsillo];
  if (dOrigen === dDestino) throw new Error('Los dos bolsillos están en ' + dOrigen + '. Para moverlo entre bolsillos usa "Mover dinero".');
  const sale = numero_(x.valorOrigen, 'Lo que sale', { requerido: true, max: VALOR_MAXIMO });
  const entra = numero_(x.valorDestino, 'Lo que entra', { requerido: true, max: VALOR_MAXIMO });
  if (sale <= 0) throw new Error('Lo que sale debe ser mayor que cero.');
  if (entra <= 0) throw new Error('Lo que entra debe ser mayor que cero.');
  const comision = numero_(x.comision, 'La comisión', { min: 0, max: VALOR_MAXIMO, defecto: 0 });
  const comisionEn = x.comisionEn === 'destino' ? 'destino' : 'origen';

  // Tasa implícita en pesos por unidad de la otra divisa (si no hay pesos de por medio, la de origen por la de destino)
  let tasaTexto;
  // Con 6 cifras significativas: una moneda que vale poco (1 CLP = 4,3127 COP) o un cruce (1 EUR = 1,0842 USD) no pierde precisión
  const t6 = x => Number(x.toPrecision(6));
  if (dOrigen === DIVISA_BASE) tasaTexto = '1 ' + dDestino + ' = ' + t6(sale / entra) + ' ' + DIVISA_BASE;
  else if (dDestino === DIVISA_BASE) tasaTexto = '1 ' + dOrigen + ' = ' + t6(entra / sale) + ' ' + DIVISA_BASE;
  else tasaTexto = '1 ' + dOrigen + ' = ' + t6(entra / sale) + ' ' + dDestino;

  const f = fechaMovimiento_(x.fecha);
  const idGrupo = nuevoId_('grp');
  const comun = {
    Fecha: f, Concepto: texto_(x.concepto).slice(0, 120) || ('Conversión ' + dOrigen + ' → ' + dDestino), Tipo_Mov: 'Transferencia', Subtipo: 'Conversion',
    ID_Categoria: '', ID_Grupo: idGrupo, ID_Item_Ppto: '', Notas: (texto_(x.notas) ? texto_(x.notas) + ' · ' : '') + tasaTexto, Origen: 'App', Anulado: false
  };
  const salida = Object.assign({ ID_Mov: nuevoId_('mov'), ID_Bolsillo: desde.ID_Bolsillo, Valor: -sale }, comun);
  const entrada = Object.assign({ ID_Mov: nuevoId_('mov'), ID_Bolsillo: hacia.ID_Bolsillo, Valor: entra }, comun);
  const filas = [salida, entrada];
  let comisionInfo = null;
  if (comision > 0) {
    const bolsillo = comisionEn === 'destino' ? hacia : desde;
    filas.push({
      ID_Mov: nuevoId_('mov'), Fecha: f, Concepto: 'Comisión · ' + comun.Concepto, ID_Bolsillo: bolsillo.ID_Bolsillo, Valor: -comision, Tipo_Mov: 'Gasto', Subtipo: 'Comision',
      ID_Categoria: categoriaComision_(), ID_Grupo: idGrupo, ID_Item_Ppto: '', Notas: 'Comisión de la conversión (' + tasaTexto + ')', Origen: 'App', Anulado: false
    });
    comisionInfo = { valor: comision, divisa: divisas[bolsillo.ID_Bolsillo], enBolsillo: bolsillo.ID_Bolsillo };
  }
  insertRows('Movimientos', filas);
  return { ok: true, idGrupo: idGrupo, patas: filas, tasa: tasaTexto, comision: comisionInfo };
}

/** Filas de un movimiento y, si es parte de un grupo, de todo el grupo. */
function filasDelGrupo_(idMov) {
  const todos = getTableData('Movimientos', { forceRefresh: true });
  const mov = todos.find(m => m.ID_Mov === idMov);
  if (!mov) throw new Error('El movimiento no existe.');
  const filas = mov.ID_Grupo ? todos.filter(m => m.ID_Grupo === mov.ID_Grupo) : [mov];
  return { mov: mov, filas: filas };
}

/** Anula un movimiento; si es un traslado, anula las dos patas. Devuelve los IDs afectados. */
function anularMovimiento(idMov) {
  const g = filasDelGrupo_(idMov);
  // Sus cargos (comisiones, impuestos…) se anulan con él
  const refs = g.filas.map(f => MARCA_CARGO + f.ID_Mov);
  const cargos = getTableData('Movimientos').filter(m => refs.indexOf(texto_(m.Ref)) !== -1);
  const pendientes = g.filas.concat(cargos).filter(f => !esVerdadero(f.Anulado));
  updateRows_('Movimientos', pendientes.map(f => ({ fila: f, cambios: { Anulado: true } })));
  return { ids: g.filas.concat(cargos).map(f => f.ID_Mov), cambiados: pendientes.length, grupo: g.filas.length > 1 };
}

/** Deshace una anulación. Exige que los bolsillos involucrados sigan activos. */
function restaurarMovimiento(idMov) {
  const g = filasDelGrupo_(idMov);
  const bolsillos = leer_('Bolsillos');
  g.filas.forEach(f => {
    const b = buscarPorId_(bolsillos, 'ID_Bolsillo', f.ID_Bolsillo);
    if (!b || !estaActivo(b)) {
      throw new Error('El bolsillo "' + (b ? b.Nombre : f.ID_Bolsillo) + '" está desactivado. Reactívalo para restaurar el movimiento.');
    }
  });
  const refs = g.filas.map(f => MARCA_CARGO + f.ID_Mov);
  const cargos = getTableData('Movimientos').filter(m => refs.indexOf(texto_(m.Ref)) !== -1);
  const pendientes = g.filas.concat(cargos).filter(f => esVerdadero(f.Anulado));
  updateRows_('Movimientos', pendientes.map(f => ({ fila: f, cambios: { Anulado: false } })));
  return { ids: g.filas.concat(cargos).map(f => f.ID_Mov), cambiados: pendientes.length, grupo: g.filas.length > 1 };
}

/**
 * Corrige un gasto, ingreso o ajuste simple. No aplica a traslados ni a movimientos que
 * generó otra función (pagos, nómina…): para esos se anula y se registra de nuevo.
 * @param {Object} cambios { Fecha, Concepto, Valor, ID_Bolsillo, ID_Categoria, Notas }
 */
function editarMovimiento(idMov, cambios) {
  const g = filasDelGrupo_(idMov);
  const mov = g.mov;
  if (mov.ID_Grupo) throw new Error('Un traslado no se edita: anúlalo y regístralo de nuevo.');
  if (mov.Subtipo) throw new Error('Este movimiento lo generó la app (' + mov.Subtipo + ') y no se edita a mano.');
  if (esVerdadero(mov.Anulado)) throw new Error('El movimiento está anulado; restáuralo antes de editarlo.');

  const c = cambios || {};
  const tipo = mov.Tipo_Mov;
  const idBolsillo = c.ID_Bolsillo !== undefined ? c.ID_Bolsillo : mov.ID_Bolsillo;
  if (idBolsillo !== mov.ID_Bolsillo) exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo');

  // El valor se recibe como se muestra: positivo para Gasto/Ingreso, con signo para Ajuste.
  const valorEntrada = c.Valor !== undefined ? c.Valor : (tipo === 'Ajuste' ? mov.Valor : Math.abs(mov.Valor));
  const datos = {
    Fecha: c.Fecha !== undefined ? fechaMovimiento_(c.Fecha) : mov.Fecha,
    Concepto: c.Concepto !== undefined ? textoRequerido_(c.Concepto, 'El concepto').slice(0, 120) : mov.Concepto,
    ID_Bolsillo: idBolsillo,
    Valor: valorConSigno_(valorEntrada, tipo),
    ID_Categoria: c.ID_Categoria !== undefined ? categoriaMovimiento_(c.ID_Categoria, tipo) : mov.ID_Categoria,
    ID_Item_Ppto: c.ID_Item_Ppto !== undefined ? renglonMovimiento_(texto_(c.ID_Item_Ppto)) : mov.ID_Item_Ppto,
    Notas: c.Notas !== undefined ? texto_(c.Notas).slice(0, 500) : mov.Notas
  };
  if (c.Afecta_Saldos !== undefined) datos.Afecta_Saldos = quiereAfectarSaldos_(c.Afecta_Saldos, tipo);
  // Un registro de antes de 1.11 guarda su vínculo (regalo, suscripción…) en Notas: se copia a Ref antes de cambiar la nota.
  if (!texto_(mov.Ref) && esMarcaSistema_(mov.Notas) && datos.Notas !== mov.Notas) datos.Ref = texto_(mov.Notas);
  updateRow('Movimientos', mov, datos);
  return Object.assign({}, mov, datos, { bolsilloAnterior: mov.ID_Bolsillo });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Rango de fechas [desde, hasta] a partir de un mes AAAA-MM o de fechas sueltas. */
function rangoFechas_(f) {
  if (f.mes) {
    if (!/^\d{4}-\d{2}$/.test(f.mes)) throw new Error('El mes debe tener formato AAAA-MM.');
    return { desde: f.mes + '-01', hasta: f.mes + '-31' };
  }
  return { desde: f.desde || '', hasta: f.hasta || '' };
}

/**
 * Lista movimientos con los nombres ya resueltos (bolsillo, cuenta, categoría).
 * Sin filtro de bolsillo o cuenta, cada traslado aparece UNA vez ("A → B").
 * Con filtro, aparece cada pata con su signo y la contraparte.
 * @param {Object} f { mes | desde, hasta, ids, idBolsillo, idCuenta, texto, incluirAnulados, limite }
 */
function listarMovimientos(f) {
  const filtro = f || {};
  const rango = rangoFechas_(filtro);
  const bolsillos = getTableData('Bolsillos');
  const cuentas = getTableData('Cuentas');
  const categorias = getTableData('Categorias');
  const bolPorId = {}; bolsillos.forEach(b => { bolPorId[b.ID_Bolsillo] = b; });
  const ctaPorId = {}; cuentas.forEach(c => { ctaPorId[c.ID_Cuenta] = c; });
  const catPorId = {}; categorias.forEach(c => { catPorId[c.ID_Categoria] = c; });

  let movs = getTableData('Movimientos', { excludeAnulados: !filtro.incluirAnulados });
  if (rango.desde) movs = movs.filter(m => m.Fecha >= rango.desde);
  if (rango.hasta) movs = movs.filter(m => m.Fecha <= rango.hasta);
  if (filtro.ids) {
    const ids = {}; filtro.ids.forEach(i => { ids[i] = true; });
    movs = movs.filter(m => ids[m.ID_Mov]);
  }

  // Contraparte de cada traslado, buscada antes de filtrar por bolsillo
  const porGrupo = {};
  movs.forEach(m => { if (m.ID_Grupo) (porGrupo[m.ID_Grupo] = porGrupo[m.ID_Grupo] || []).push(m); });

  const conFiltroDeLugar = !!(filtro.idBolsillo || filtro.idCuenta);
  if (filtro.idBolsillo) movs = movs.filter(m => m.ID_Bolsillo === filtro.idBolsillo);
  if (filtro.idCuenta) movs = movs.filter(m => bolPorId[m.ID_Bolsillo] && bolPorId[m.ID_Bolsillo].ID_Cuenta === filtro.idCuenta);

  const divisas = mapaDivisas_();
  const nombreBolsillo = id => (bolPorId[id] ? bolPorId[id].Nombre : '');
  const nombreCuenta = id => { const b = bolPorId[id]; const c = b && ctaPorId[b.ID_Cuenta]; return c ? c.Nombre : ''; };

  let items = [];
  movs.forEach(m => {
    const base = {
      ID_Mov: m.ID_Mov, Fecha: m.Fecha, Concepto: m.Concepto, Tipo_Mov: m.Tipo_Mov, Subtipo: m.Subtipo || '',
      ID_Bolsillo: m.ID_Bolsillo, Bolsillo: nombreBolsillo(m.ID_Bolsillo), Cuenta: nombreCuenta(m.ID_Bolsillo), Divisa: divisas.bolsillos[m.ID_Bolsillo] || DIVISA_BASE,
      ID_Categoria: m.ID_Categoria || '', Categoria: catPorId[m.ID_Categoria] ? catPorId[m.ID_Categoria].Nombre : '',
      ID_Grupo: m.ID_Grupo || '', ID_Item_Ppto: m.ID_Item_Ppto || '', Notas: m.Notas || '', Anulado: esVerdadero(m.Anulado), Afecta_Saldos: afectaSaldos_(m),
      Creado_En: marcaRegistro_(m.Creado_En), _fila: m._rowIndex, Valor: Number(m.Valor) || 0,
      esTransferencia: m.Tipo_Mov === 'Transferencia', Editable: !m.ID_Grupo && !m.Subtipo
    };
    if (!base.esTransferencia) { items.push(base); return; }

    const par = (porGrupo[m.ID_Grupo] || []).find(x => x.ID_Mov !== m.ID_Mov);
    if (conFiltroDeLugar) {
      base.Contraparte = par ? nombreBolsillo(par.ID_Bolsillo) : '';
      items.push(base);
    } else if (base.Valor < 0) {
      // Sin filtro: una sola línea por traslado, tomada de la pata de salida
      base.Valor = Math.abs(base.Valor);
      base.Origen = base.Bolsillo;
      base.Destino = par ? nombreBolsillo(par.ID_Bolsillo) : '';
      // Una conversión entra en otra divisa y por otro valor: se muestra lo que llegó
      if (par && (divisas.bolsillos[par.ID_Bolsillo] || DIVISA_BASE) !== base.Divisa) {
        base.DivisaDestino = divisas.bolsillos[par.ID_Bolsillo];
        base.ValorDestino = Math.abs(Number(par.Valor) || 0);
      }
      items.push(base);
    }
  });

  const t = texto_(filtro.texto).toLowerCase();
  if (t) {
    items = items.filter(i => [i.Concepto, i.Notas, i.Bolsillo, i.Categoria, i.Origen, i.Destino, i.Contraparte].some(x => texto_(x).toLowerCase().indexOf(t) !== -1));
  }

  items.sort(masRecienteArriba_);

  // Totales sobre lo que se ve; los traslados no son ingreso ni gasto. Solo de una divisa: la del bolsillo o
  // la cuenta que se mira; sin filtro, pesos (no se suman divisas distintas).
  const divisaTotales = filtro.idBolsillo ? (divisas.bolsillos[filtro.idBolsillo] || DIVISA_BASE) : (filtro.idCuenta ? (divisas.cuentas[filtro.idCuenta] || DIVISA_BASE) : DIVISA_BASE);
  let ingresos = 0, gastos = 0, traslados = 0;
  items.forEach(i => {
    if (i.Anulado || i.Divisa !== divisaTotales) return;
    if (i.esTransferencia) { traslados += conFiltroDeLugar ? i.Valor : 0; return; }
    if (SUBTIPOS_INVERSION.indexOf(i.Subtipo) !== -1) return; // abrir o cobrar un CDT no es ingreso ni gasto
    if (i.Valor >= 0) ingresos += i.Valor; else gastos += -i.Valor;
  });

  const limite = Number(filtro.limite) > 0 ? Number(filtro.limite) : 300;
  items.forEach(i => { delete i._fila; }); // Creado_En se queda: la app lo usa para ordenar lo que agrega sin volver a pedir la lista
  return {
    items: items.slice(0, limite),
    total: items.length,
    hayMas: items.length > limite,
    totales: { ingresos: redondear2_(ingresos), gastos: redondear2_(gastos), neto: redondear2_(ingresos - gastos), trasladosNetos: redondear2_(traslados), Divisa: divisaTotales }
  };
}

/** Todo lo que necesita la pantalla de un bolsillo, en una sola llamada. */
function obtenerDetalleBolsillo(idBolsillo, mes, incluirAnulados) {
  const bolsillo = buscarPorId_(getTableData('Bolsillos'), 'ID_Bolsillo', idBolsillo);
  if (!bolsillo) throw new Error('El bolsillo no existe.');
  const cuenta = buscarPorId_(getTableData('Cuentas'), 'ID_Cuenta', bolsillo.ID_Cuenta) || {};
  const banco = buscarPorId_(getTableData('Bancos'), 'ID_Banco', cuenta.ID_Banco) || {};
  const saldos = mapaSaldosBolsillos_();

  const lista = listarMovimientos({ mes: mes || hoyIso_().slice(0, 7), idBolsillo: idBolsillo, incluirAnulados: !!incluirAnulados });
  return {
    bolsillo: {
      ID_Bolsillo: bolsillo.ID_Bolsillo, Nombre: bolsillo.Nombre, Rol: bolsillo.Rol, Es_Interno: esVerdadero(bolsillo.Es_Interno),
      Activo: estaActivo(bolsillo), Saldo: saldos[idBolsillo] || 0, Saldo_Apertura: Number(bolsillo.Saldo_Apertura) || 0
    },
    cuenta: { ID_Cuenta: cuenta.ID_Cuenta, Nombre: cuenta.Nombre, Banco: banco.Nombre || '', Tipo: cuenta.Tipo, Divisa: divisaBanco_(banco) },
    mes: mes || hoyIso_().slice(0, 7),
    movimientos: lista.items,
    totales: lista.totales,
    hayMas: lista.hayMas,
    evolucion: saldosMensuales_({ [idBolsillo]: true }, mes || hoyIso_().slice(0, 7), 6)
  };
}

/**
 * Cuadra una cuenta con el saldo que muestra el banco.
 * Guarda el saldo real y, si se indica un bolsillo, registra un ajuste por la diferencia
 * para que la suma de los bolsillos coincida con el banco.
 */
function cuadrarCuenta(idCuenta, saldoReal, idBolsilloAjuste) {
  const cuenta = exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', idCuenta, 'La cuenta');
  const real = numero_(saldoReal, 'El saldo real', { requerido: true, max: VALOR_MAXIMO, min: -VALOR_MAXIMO });

  const saldos = mapaSaldosBolsillos_();
  const delaCuenta = leer_('Bolsillos').filter(b => b.ID_Cuenta === idCuenta);
  const saldo = redondear2_(delaCuenta.reduce((a, b) => a + (saldos[b.ID_Bolsillo] || 0), 0));
  const diferencia = redondear2_(real - saldo);

  let ajuste = null;
  if (idBolsilloAjuste && Math.abs(diferencia) >= SALDO_CERO) {
    if (!delaCuenta.some(b => b.ID_Bolsillo === idBolsilloAjuste)) throw new Error('El bolsillo del ajuste no es de esta cuenta.');
    ajuste = registrarMovimiento({
      Tipo_Mov: 'Ajuste', Valor: diferencia, ID_Bolsillo: idBolsilloAjuste,
      Concepto: 'Ajuste por cuadre', Notas: 'Diferencia entre el saldo del banco y el de Moni'
    });
  }

  updateRow('Cuentas', cuenta, { Saldo_Real: real, Fecha_Saldo_Real: hoyIso_() });
  return { diferenciaAnterior: diferencia, ajustado: !!ajuste, idMov: ajuste ? ajuste.ID_Mov : '' };
}
