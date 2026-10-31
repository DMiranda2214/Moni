/**
 * Api.gs — Moni
 * Funciones públicas que el frontend invoca con google.script.run.
 * Todas devuelven el sobre estándar { ok, data } o { ok: false, error: { message } }.
 * La lógica vive en los módulos de dominio; aquí solo se valida la entrada y se responde.
 * (Los endpoints del proyecto anterior ya se portaron; su código quedó fuera del repositorio.)
 */

function apiSuccess(data) {
  return { ok: true, data: data };
}

function apiError(err) {
  const message = (err && err.message) ? err.message : String(err);
  Logger.log('API error: ' + message);
  return { ok: false, error: { message: message } };
}

/** Ejecuta `fn` y la envuelve en el sobre estándar. */
function responder_(fn) {
  reiniciarMemoria_(); // cada petición empieza sin nada memorizado
  const inicio = Date.now();
  try {
    const r = apiSuccess(fn());
    r.ms = Date.now() - inicio; // tiempo en el servidor, para el diagnóstico
    return r;
  } catch (e) {
    const r = apiError(e);
    registrarErrorApi_(e);
    r.ms = Date.now() - inicio;
    return r;
  }
}

/** Solo los catálogos declarados en CATALOGOS pueden leerse o escribirse desde el frontend. */
function exigirCatalogo_(tabla) {
  if (!Object.prototype.hasOwnProperty.call(CATALOGOS, tabla)) {
    throw new Error('"' + tabla + '" no es un catálogo.');
  }
  return tabla;
}

// ==========================================================================
// Arranque
// ==========================================================================

/**
 * Carga inicial: una sola llamada con todo lo necesario para pintar la app.
 * Si la base de datos no está instalada, lo indica para que la app ofrezca instalarla.
 */
function getBootstrap() {
  return responder_(function () {
    const verificacion = verificarEsquema(undefined, { usarCache: true });
    if (!verificacion.listo) {
      return { instalado: false, faltantes: verificacion.faltantes, diferencias: verificacion.diferencias };
    }

    const config = {};
    getTableData('Config').forEach(c => { config[c.Clave] = c.Valor; });

    const catalogos = {};
    Object.keys(CATALOGOS).forEach(t => { catalogos[t] = listarCatalogo(t, { incluirInactivos: true }); });
    // Cada escenario de nómina viaja con sus subsidios (para editarlo sin otra llamada)
    catalogos.Nomina_Escenarios.forEach(e => { e.subsidios = subsidiosDeEscenario_(e.ID_Nomina_Esc); });

    const mesActual = hoyIso_().slice(0, 7);
    const renglones = getTableData('Presupuesto_Mes').filter(i => i.Mes === mesActual)
      .map(i => ({ ID_Item: i.ID_Item, Concepto: i.Concepto, Pagado: esVerdadero(i.Pagado), ID_Tarjeta: i.ID_Tarjeta || '', ID_Bolsillo_Destino: i.ID_Bolsillo_Destino || '', Tipo: i.Tipo || 'Gasto' }));

    return {
      instalado: true,
      config: config,
      catalogos: catalogos,
      saldos: obtenerSaldos(),
      estado: obtenerEstadoConfiguracion(verificacion),
      ultimos: listarMovimientos({ limite: 6 }).items,
      renglones: renglones,
      creditos: getTableData('Creditos').filter(c => c.Estado === 'Activo').map(c => ({ ID_Credito: c.ID_Credito, Nombre: c.Nombre })),
      ppto: (function () { const p = obtenerPresupuestoMes(mesActual); return { mes: p.mes, existe: p.existe, totales: p.totales }; })(),
      proximos: proximosPagos_(),
      enums: ENUMS,
      hoy: hoyIso_()
    };
  });
}

function instalarBaseDatos() {
  return responder_(function () { return setupDatabase(); });
}

// ==========================================================================
// Catálogos
// ==========================================================================

function listCatalogo(tabla, incluirInactivos) {
  return responder_(function () {
    return listarCatalogo(exigirCatalogo_(tabla), { incluirInactivos: !!incluirInactivos, forceRefresh: true });
  });
}

function saveCatalogo(tabla, item, opciones) {
  return responder_(function () {
    return guardarCatalogo(exigirCatalogo_(tabla), item, opciones);
  });
}

/** Una cuenta con sus bolsillos y saldos de una sola vez (asistente de primeros pasos). */
function saveCuentaCompleta(cuenta, bolsillos) {
  return responder_(function () { return guardarCuentaConBolsillos(cuenta, bolsillos); });
}

function disableCatalogo(tabla, id) {
  return responder_(function () { return desactivarCatalogo(exigirCatalogo_(tabla), id); });
}

function enableCatalogo(tabla, id) {
  return responder_(function () { return reactivarCatalogo(exigirCatalogo_(tabla), id); });
}

// ==========================================================================
// Movimientos. Cada escritura devuelve lo que cambió (los movimientos afectados ya
// listos para mostrar y los saldos nuevos): la pantalla no necesita pedir nada más.
// ==========================================================================

/**
 * Respuesta común de las escrituras: lo que cambió, listo para mostrar.
 *  - items: los movimientos afectados. Si la pantalla está viendo un bolsillo (`vista.idBolsillo`),
 *    llegan como se ven en ese bolsillo (cada pata con su signo); si no, un traslado es una línea.
 *  - ultimos: los últimos movimientos de Inicio, ya actualizados.
 *  - saldos: saldos nuevos de bolsillos y cuentas.
 */
function resultadoEscritura_(ids, vista, extra) {
  const v = vista || {};
  const base = {
    items: listarMovimientos({ ids: ids, incluirAnulados: true, idBolsillo: v.idBolsillo || undefined }).items,
    ultimos: listarMovimientos({ limite: 6 }).items,
    saldos: resumenSaldos_()
  };
  // Si algún movimiento afecta un renglón del presupuesto, la pantalla del presupuesto llega ya actualizada.
  const pp = presupuestoAfectado_(ids, v.idItem);
  if (pp) base.presupuesto = pp;
  return Object.assign(base, extra || {});
}

/** Presupuesto del mes del primer renglón enlazado por estos movimientos (o undefined). */
function presupuestoAfectado_(ids, idItem) {
  // Un gasto con tarjeta puede no dejar movimientos y aun así cambiar el real de su renglón.
  const enlazado = idItem ? { ID_Item_Ppto: idItem } : getTableData('Movimientos').find(m => ids.indexOf(m.ID_Mov) !== -1 && m.ID_Item_Ppto);
  if (!enlazado) return undefined;
  const item = getTableData('Presupuesto_Mes').find(i => i.ID_Item === enlazado.ID_Item_Ppto);
  return item ? obtenerPresupuestoMes(item.Mes) : undefined;
}

function addMovimiento(m, vista) {
  return responder_(function () {
    const fila = registrarMovimiento(m);
    return resultadoEscritura_([fila.ID_Mov], vista);
  });
}

/** Convierte dinero entre bolsillos de distinta divisa (por ejemplo, pesos a dólares). */
function addConversion(c, vista) {
  return responder_(function () {
    const r = registrarConversion(c);
    return resultadoEscritura_(r.patas.map(p => p.ID_Mov), vista, { idGrupo: r.idGrupo, tasa: r.tasa, comision: r.comision });
  });
}

/** Anota cuántos pesos vale una unidad de una divisa (vacío = quitar la tasa). */
function saveTasaDivisa(divisa, tasa) {
  return responder_(function () {
    if (DIVISAS.indexOf(divisa) === -1 || divisa === DIVISA_BASE) throw new Error('La divisa no es válida.');
    const t = texto_(tasa).replace(',', '.');
    if (t === '') {
      guardarConfig_('Tasa_' + divisa, '');
      guardarConfig_('Tasa_' + divisa + '_Fecha', '');
      guardarConfig_('Tasa_' + divisa + '_Fuente', '');
      return { divisa: divisa, tasa: '', fecha: '' };
    }
    const n = Number(t);
    if (!isFinite(n) || n <= 0 || n > 1e7) throw new Error('La tasa debe ser un número mayor que cero.');
    guardarConfig_('Tasa_' + divisa, String(n));
    guardarConfig_('Tasa_' + divisa + '_Fecha', hoyIso_());
    guardarConfig_('Tasa_' + divisa + '_Fuente', 'Manual');
    return { divisa: divisa, tasa: String(n), fecha: hoyIso_() };
  });
}

/** Trae la tasa de referencia de Google Finance (la hoja auxiliar Tasas_Google). */
function updateTasasGoogle() { return responder_(function () { return actualizarTasasGoogle(); }); }
function saveTasaAuto(activar) { return responder_(function () { return configurarTasaAuto(!!activar); }); }

function addTransferencia(t, vista) {
  return responder_(function () {
    const x = t || {};
    const r = registrarTransferencia(x.origen, x.destino, x.valor, x.fecha, x.concepto, x.notas, 'App', { ID_Item_Ppto: x.itemPpto });
    return resultadoEscritura_(r.patas.map(p => p.ID_Mov), vista);
  });
}

function voidMovimiento(idMov, vista) {
  return responder_(function () {
    const r = anularMovimiento(idMov);
    return resultadoEscritura_(r.ids, vista, { cambiados: r.cambiados });
  });
}

/** Anula varios movimientos de una vez (por ejemplo, deshacer una distribución de nómina). */
function voidVarios(ids, vista) {
  return responder_(function () {
    (ids || []).forEach(id => anularMovimiento(id));
    return resultadoEscritura_(ids || [], vista);
  });
}

function restoreMovimiento(idMov, vista) {
  return responder_(function () {
    const r = restaurarMovimiento(idMov);
    return resultadoEscritura_(r.ids, vista, { cambiados: r.cambiados });
  });
}

function editMovimiento(idMov, cambios, vista) {
  return responder_(function () {
    const r = editarMovimiento(idMov, cambios);
    return resultadoEscritura_([r.ID_Mov], vista);
  });
}

function getMovimientos(filtro) {
  return responder_(function () { return listarMovimientos(filtro || {}); });
}

function getDetalleBolsillo(idBolsillo, mes, incluirAnulados) {
  return responder_(function () { return obtenerDetalleBolsillo(idBolsillo, mes, incluirAnulados); });
}

function cuadre(idCuenta, saldoReal, idBolsilloAjuste, vista) {
  return responder_(function () {
    const r = cuadrarCuenta(idCuenta, saldoReal, idBolsilloAjuste);
    return resultadoEscritura_(r.idMov ? [r.idMov] : [], vista, { diferenciaAnterior: r.diferenciaAnterior, ajustado: r.ajustado });
  });
}

// ==========================================================================
// Presupuesto y nómina. Cada pantalla se entrega completa en una sola llamada; las
// escrituras devuelven la pantalla ya actualizada (y los saldos si movieron dinero).
// ==========================================================================

function getPresupuesto(mes) {
  return responder_(function () { return obtenerPresupuestoMes(mes); });
}

function generarPresupuesto(mes, idEscenario, reemplazar) {
  return responder_(function () {
    generarPresupuestoMes(mes, idEscenario, reemplazar);
    return obtenerPresupuestoMes(mes);
  });
}

function saveRenglonMes(item) {
  return responder_(function () {
    const r = guardarRenglonMes(item);
    return obtenerPresupuestoMes(r.Mes);
  });
}

function deleteRenglonMes(idItem) {
  return responder_(function () {
    const r = eliminarRenglonMes(idItem);
    return obtenerPresupuestoMes(r.mes);
  });
}

function payRenglonMes(idItem, pagado) {
  return responder_(function () {
    const r = marcarRenglonPagado(idItem, pagado);
    return obtenerPresupuestoMes(r.mes);
  });
}

function previewDistribucion(mes, idOrigen) {
  return responder_(function () { return previsualizarDistribucion(mes, idOrigen); });
}

function distribuir(mes, idOrigen, fecha, forzar) {
  return responder_(function () {
    const r = distribuirNomina(mes, idOrigen, fecha, forzar);
    return resultadoEscritura_(r.ids, undefined, { distribucion: { traslados: r.traslados, total: r.total }, presupuesto: obtenerPresupuestoMes(mes) });
  });
}

function getNomina(periodo, idEscenario) {
  return responder_(function () { return obtenerNominaMes(periodo, idEscenario); });
}

function registrarNomina(periodo, idEscenario, netoReal, fecha, idBolsillo) {
  return responder_(function () {
    const r = registrarPagoNomina(periodo, idEscenario, netoReal, fecha, idBolsillo);
    return resultadoEscritura_([r.idMov], undefined, { nomina: obtenerNominaMes(periodo, idEscenario) });
  });
}

function anularNomina(periodo) {
  return responder_(function () {
    const r = anularPagoNomina(periodo);
    return resultadoEscritura_([r.idMov], undefined, { nomina: obtenerNominaMes(periodo) });
  });
}

// ==========================================================================
// Deudas: tarjetas de crédito y créditos de autopago
// ==========================================================================

function getDeudas() {
  return responder_(function () {
    return { tarjetas: resumenTarjetas_(), creditos: listarCreditos(), deudaAhorro: deudaConAhorro_() };
  });
}

function getTarjeta(idTarjeta, mes) {
  return responder_(function () { return obtenerTarjeta(idTarjeta, mes); });
}

/** Respuesta de una escritura sobre una tarjeta: la pantalla de la tarjeta ya actualizada + saldos. */
function resultadoTarjeta_(idTarjeta, mes, ids) {
  return resultadoEscritura_(ids || [], undefined, { tarjeta: obtenerTarjeta(idTarjeta, mes) });
}

/**
 * Un gasto pagado con tarjeta, desde el formulario de Registrar. Con renglón aparta el dinero de su bolsillo
 * (y cuenta como gasto de ese renglón); sin renglón no aparta nada. Devuelve lo mismo que un gasto normal.
 */
function addGastoTarjeta(c, vista) {
  return responder_(function () {
    const compra = registrarCompraTC(c);
    const ids = compra.ID_Mov_Reserva ? filasDelGrupo_(compra.ID_Mov_Reserva).filas.map(f => f.ID_Mov) : [];
    return resultadoEscritura_(ids, Object.assign({}, vista, { idItem: compra.ID_Item_Ppto }),
      { idCompra: compra.ID_Compra, idItem: compra.ID_Item_Ppto || '', aparto: !!compra.ID_Mov_Reserva });
  });
}

function voidGastoTarjeta(idCompra, idItem, vista) {
  return responder_(function () {
    const r = anularCompraTC(idCompra);
    return resultadoEscritura_(r.ids, Object.assign({}, vista, { idItem: idItem || '' }), {});
  });
}

function addCompraTC(c) {
  return responder_(function () {
    const compra = registrarCompraTC(c);
    const ids = compra.ID_Mov_Reserva ? filasDelGrupo_(compra.ID_Mov_Reserva).filas.map(f => f.ID_Mov) : [];
    return Object.assign(resultadoTarjeta_(compra.ID_Tarjeta, compra.Mes_Extracto, ids), { idCompra: compra.ID_Compra });
  });
}

function voidCompraTC(idCompra) {
  return responder_(function () {
    const r = anularCompraTC(idCompra);
    return resultadoTarjeta_(r.tarjeta, r.mes, r.ids);
  });
}

function restoreCompraTC(idCompra) {
  return responder_(function () {
    const r = restaurarCompraTC(idCompra);
    return resultadoTarjeta_(r.tarjeta, r.mes, r.ids);
  });
}

function payExtracto(idTarjeta, mes, fecha, idOrigen) {
  return responder_(function () {
    const r = pagarExtracto(idTarjeta, mes, fecha, idOrigen);
    return Object.assign(resultadoTarjeta_(r.tarjeta, r.mes, r.ids), { idExtracto: r.idExtracto, completado: r.falta, total: r.total });
  });
}

function voidPagoExtracto(idExtracto) {
  return responder_(function () {
    const r = anularPagoExtracto(idExtracto);
    return resultadoTarjeta_(r.tarjeta, r.mes, r.ids);
  });
}

function previewCredito(c) {
  return responder_(function () { return previsualizarCredito(c); });
}

function resultadoCredito_(idCredito, ids) {
  return resultadoEscritura_(ids || [], undefined, { credito: obtenerCredito(idCredito) });
}

function addCredito(c) {
  return responder_(function () {
    const r = registrarCredito(c);
    return resultadoCredito_(r.idCredito, r.ids);
  });
}

function getCredito(idCredito) {
  return responder_(function () { return obtenerCredito(idCredito); });
}

function previewPagoCredito(idCredito, valor) {
  return responder_(function () { return previsualizarPagoCredito(idCredito, valor); });
}

function payCredito(idCredito, valor, fecha, idBolsillo) {
  return responder_(function () {
    const r = registrarPagoCredito(idCredito, valor, fecha, idBolsillo);
    return Object.assign(resultadoCredito_(idCredito, r.ids), { pago: { num: r.num, valorCobrado: r.valorCobrado, excedente: r.excedente, cuotasAhorradas: r.cuotasAhorradas, cancela: r.cancela, idPago: r.idPago } });
  });
}

function voidPagoCredito(idPago) {
  return responder_(function () {
    const r = anularPagoCredito(idPago);
    return resultadoCredito_(r.idCredito, r.ids);
  });
}

function saveCredito(idCredito, datos) {
  return responder_(function () {
    editarCredito(idCredito, datos);
    return resultadoCredito_(idCredito, []);
  });
}

function cancelCredito(idCredito) {
  return responder_(function () {
    const r = anularCredito(idCredito);
    return resultadoEscritura_(r.ids, undefined, { eliminado: true });
  });
}

// ==========================================================================
// Ahorro, regalos, vista anual y respaldos
// ==========================================================================

function getAhorro() {
  return responder_(function () { return obtenerAhorro(); });
}

function getCuentaAhorro(idCuenta, mes) {
  return responder_(function () { return obtenerCuentaAhorro(idCuenta, mes); });
}

function resultadoAhorro_(idCuenta, ids) {
  return resultadoEscritura_(ids || [], undefined, { cuentaAhorro: obtenerCuentaAhorro(idCuenta), ahorro: obtenerAhorro() });
}

function addRendimiento(r) {
  return responder_(function () {
    const fila = registrarRendimiento(r);
    return resultadoAhorro_(r.ID_Cuenta, [fila.ID_Mov]);
  });
}

function withdrawAhorro(idCuenta, idDestino, valor, fecha, concepto) {
  return responder_(function () {
    const r = retirarParaGastos(idCuenta, idDestino, valor, fecha, concepto);
    return resultadoAhorro_(idCuenta, r.patas.map(p => p.ID_Mov));
  });
}

function repayAhorro(idCuenta, idOrigen, valor, fecha, concepto) {
  return responder_(function () {
    const r = reponerAhorro(idCuenta, idOrigen, valor, fecha, concepto);
    return resultadoAhorro_(idCuenta, r.patas.map(p => p.ID_Mov));
  });
}

function getRegalos(anio) {
  return responder_(function () { return obtenerRegalos(anio); });
}

function saveRegalo(r) {
  return responder_(function () {
    const g = guardarRegalo(r);
    return obtenerRegalos(g.Anio);
  });
}

function deleteRegalo(idRegalo) {
  return responder_(function () {
    const r = eliminarRegalo(idRegalo);
    return obtenerRegalos(r.anio);
  });
}

function payRegalo(idRegalo, valor, idBolsillo, fecha) {
  return responder_(function () {
    const r = registrarGastoRegalo(idRegalo, valor, idBolsillo, fecha);
    return resultadoEscritura_([r.idMov], undefined, { regalos: obtenerRegalos(r.anio) });
  });
}

function getAnual(anio) {
  return responder_(function () { return obtenerVistaAnual(anio); });
}

function getRespaldos() {
  return responder_(function () { return estadoRespaldos(); });
}

function makeRespaldo() {
  return responder_(function () { return Object.assign(crearRespaldo(), { estado: estadoRespaldos() }); });
}

function setRespaldoAuto(activar) {
  return responder_(function () { return configurarRespaldoAutomatico(!!activar); });
}

// ==========================================================================
// Saldos
// ==========================================================================

function getSaldos(hastaFecha) {
  return responder_(function () { return obtenerSaldos(hastaFecha || undefined); });
}

// ==========================================================================
// Datos de demostración
// ==========================================================================

function seedDemo() {
  return responder_(function () { return sembrarDatosDemo(); });
}

function clearDemo() {
  return responder_(function () { return limpiarDatosDemo(); });
}

/** Borra toda la información de la persona. Exige la frase de confirmación. */
function resetAllData(confirmacion, opciones) {
  return responder_(function () { return borrarTodosLosDatos(confirmacion, opciones); });
}

// ==========================================================================
// Configuración
// ==========================================================================

const TEMAS_VALIDOS = ['Claro', 'Oscuro', 'Automatico'];
const ACENTOS_VALIDOS = ['rosa', 'azul', 'verde', 'morado', 'naranja', 'grafito'];

/** Valida y normaliza el valor de un parámetro de Config. Lanza un error claro si no es válido. */
function normalizarParametro_(clave, valor) {
  if (!clave) throw new Error('La clave del parámetro es obligatoria.');
  const existe = getTableData('Config', { forceRefresh: true }).some(c => c.Clave === clave);
  if (!existe) throw new Error('El parámetro "' + clave + '" no existe.');

  let v = valor === undefined || valor === null ? '' : String(valor).trim();
  const def = DEFAULT_CONFIG.find(d => d[0] === clave);
  if (def && ['numero', 'moneda', 'porcentaje'].indexOf(def[3]) !== -1) {
    const n = Number(v.replace(',', '.'));
    if (v === '' || !isFinite(n)) throw new Error('"' + clave.replace(/_/g, ' ') + '" debe ser un número.');
    if (def[3] === 'porcentaje' && (n < 0 || n > 1)) throw new Error('Escríbelo como decimal entre 0 y 1 (por ejemplo, 4 % = 0,04).');
    v = String(n);
  }
  if (clave === 'Tema' && TEMAS_VALIDOS.indexOf(v) === -1) throw new Error('Tema no válido.');
  if (clave === 'Color_Acento' && ACENTOS_VALIDOS.indexOf(v) === -1) throw new Error('Color de acento no válido.');
  if (clave === 'Nombre_Usuario' && v.length > 60) throw new Error('El nombre es demasiado largo.');
  if (clave === 'Datos_Demo' || clave === 'Fecha_Arranque' || clave === 'Arranque_Hecho' || clave.indexOf('Tasa_') === 0 || clave.indexOf('Recordatorios_') === 0 || clave === 'Calendario_ID') throw new Error('Este parámetro lo gestiona la app.');
  return v;
}

function saveConfigParam(clave, valor) {
  return responder_(function () {
    const v = normalizarParametro_(clave, valor);
    updateRowById('Config', 'Clave', clave, { Valor: v });
    return { clave: clave, valor: v };
  });
}

/** Guarda varios parámetros a la vez: si alguno no es válido, no se guarda ninguno. */
function saveConfigParams(mapa) {
  return responder_(function () {
    const claves = Object.keys(mapa || {});
    const limpios = {};
    claves.forEach(k => { limpios[k] = normalizarParametro_(k, mapa[k]); });
    claves.forEach(k => updateRowById('Config', 'Clave', k, { Valor: limpios[k] }));
    return limpios;
  });
}

function resetConfigParam(clave) {
  return responder_(function () {
    const porDefecto = DEFAULT_CONFIG.find(item => item[0] === clave);
    if (!porDefecto) throw new Error('No hay valor predeterminado para "' + clave + '".');
    updateRowById('Config', 'Clave', clave, { Valor: porDefecto[1] });
    return { clave: clave, valor: porDefecto[1] };
  });
}

// ==========================================================================
// Diagnóstico
// ==========================================================================

function runDiagnostics() {
  return responder_(function () {
    const ss = getSpreadsheet();
    const v = verificarEsquema(ss);
    return {
      hoja: ss.getName(),
      url: ss.getUrl(),
      tablasEsperadas: Object.keys(SCHEMAS).length,
      listo: v.listo,
      faltantes: v.faltantes,
      diferencias: v.diferencias,
      version: VERSION_APP
    };
  });
}

/** Datos de los gráficos: gastos por categoría, entró/salió por mes y saldo al cierre de cada mes. */
function getGraficos(opciones) { return responder_(function () { return obtenerGraficos(opciones); }); }

// ---- Recordatorios en Google Calendar ----
function getRecordatorios() { return responder_(function () { return estadoRecordatorios_(); }); }
function saveRecordatorios(ajustes) { return responder_(function () { return configurarRecordatorios(ajustes); }); }
function syncRecordatorios() { return responder_(function () { return sincronizarRecordatoriosYa(); }); }
function removeRecordatorios() { return responder_(function () { return quitarRecordatorios(); }); }

// ---- Registro de errores ----
function getLogs(opciones) { return responder_(function () { return obtenerLogs(opciones); }); }
function clearLogs() { return responder_(function () { return limpiarLogs(); }); }
/** El navegador reporta sus errores aquí; no pasa por responder_ para no registrar un fallo del propio registro. */
function logClientError(mensaje, detalle) { return registrarErrorCliente(mensaje, detalle); }

// ---- Arranque (Fase 6) ----
function getArranque() { return responder_(function () { return obtenerArranque(); }); }
function setFechaArranque(fecha) { return responder_(function () { return guardarFechaArranque(fecha); }); }
function saveAperturas(lista) { return responder_(function () { return guardarAperturas(lista); }); }
function archiveTests() { return responder_(function () { return archivarPruebas(); }); }
function startOperation() { return responder_(function () { return iniciarOperacion(); }); }

/** Próximos pagos (liviano), para refrescar Inicio sin recargar todo. */
function getProximos() { return responder_(function () { return proximosPagos_(); }); }

// ---- Suscripciones y servicios ----
function getSuscripciones() { return responder_(function () { return obtenerSuscripciones(); }); }

function paySuscripcion(id, datos) {
  return responder_(function () {
    const r = pagarSuscripcion(id, datos);
    const ids = r.idMov ? [r.idMov] : [];
    return Object.assign(resultadoEscritura_(ids, { idItem: r.idItem }, { suscripciones: obtenerSuscripciones() }), r);
  });
}

function undoPagoSuscripcion(id, anterior, idMov, idCompra, idItem) {
  return responder_(function () {
    deshacerPagoSuscripcion(id, anterior, idMov, idCompra);
    return resultadoEscritura_(idMov ? [idMov] : [], { idItem: idItem || '' }, { suscripciones: obtenerSuscripciones() });
  });
}

function skipSuscripcion(id) {
  return responder_(function () {
    const r = saltarCobroSuscripcion(id);
    return Object.assign({ suscripciones: obtenerSuscripciones() }, r);
  });
}
