/**
 * Avisos.gs — Moni
 * Lo que la persona debería tener en cuenta y todavía no ha configurado o resuelto. Se calcula siempre desde el estado de
 * su hoja (por eso desaparece solo cuando lo hace) y se muestra en Inicio, para que cada función nueva o cada dato
 * desactualizado se note sin tener que buscarlo.
 *
 * Cada aviso: { id, nivel, titulo, detalle, pantalla, ocultable }
 *   nivel "importante": algo desactualizado o por resolver (no se puede ocultar).
 *   nivel "sugerencia": una configuración que falta; la persona puede decir "Ahora no" (se guarda en Avisos_Ocultos).
 *   nivel "novedad": una función nueva que todavía no ha usado; también se puede ocultar.
 */

function avisosOcultos_() {
  return texto_(cfgValor_('Avisos_Ocultos')).split(',').map(x => x.trim()).filter(Boolean);
}

function obtenerAvisos_() {
  const ocultos = avisosOcultos_();
  const lista = [];
  const hoy = hoyIso_();
  const agregar = (id, nivel, titulo, detalle, pantalla) => {
    const ocultable = nivel !== 'importante';
    if (ocultable && ocultos.indexOf(id) !== -1) return;
    lista.push({ id: id, nivel: nivel, titulo: titulo, detalle: detalle, pantalla: pantalla, ocultable: ocultable });
  };

  const bancos = getTableData('Bancos').filter(estaActivo);
  const cuentas = getTableData('Cuentas').filter(estaActivo);
  const nominaLista = getTableData('Nomina_Escenarios').some(estaActivo);

  // ---- Importantes: algo desactualizado o por resolver ----
  const anioSmmlv = Number(cfgValor_('SMMLV_Anio'));
  const anioActual = Number(hoy.slice(0, 4));
  if (nominaLista && anioSmmlv && anioSmmlv < anioActual) {
    agregar('smmlv', 'importante', 'Actualiza el salario mínimo', 'El guardado es el de ' + anioSmmlv + ': actualízalo al de ' + anioActual + ' para que el cálculo de tu nómina sea correcto.', 'ajustes/parametros');
  }
  const cdtVencidos = getTableData('CDTs').filter(c => estaActivo(c) && c.Estado === 'Vigente' && c.Fecha_Vencimiento < hoy).length;
  if (cdtVencidos) {
    agregar('cdt_vencidos', 'importante', cdtVencidos === 1 ? 'Un CDT ya venció' : cdtVencidos + ' CDT ya vencieron', 'Regístralo como cobrado (o renuévalo) para que no cuente como invertido.', 'cdt');
  }
  const mes = hoy.slice(0, 7);
  const itemsMes = getTableData('Presupuesto_Mes').filter(i => i.Mes === mes);
  if (itemsMes.length) {
    const faltan = suscripcionesFaltantes_(mes, itemsMes).length;
    if (faltan) agregar('susc_ppto', 'importante', faltan === 1 ? 'Falta 1 suscripción o servicio en el presupuesto' : 'Faltan ' + faltan + ' suscripciones o servicios en el presupuesto', 'Toca este mes pagarlos: agrégalos al presupuesto del mes.', 'presupuesto');
  }

  // ---- Sugerencias: configuración que falta ----
  const hayDolares = bancos.some(b => divisaBanco_(b) !== DIVISA_BASE);
  if (hayDolares && !esVerdadero(cfgValor_('Tasa_Auto')) && !cfgValor_('Tasa_USD') && !cfgValor_('Tasa_EUR')) {
    agregar('tasa', 'sugerencia', 'Configura el dólar', 'Tienes dinero en otra moneda: vincula la TRM de Google Finance o anota la tasa para ver su equivalente en pesos.', 'ajustes/divisas');
  }
  const sinTasa = cuentas.filter(c => c.Tipo === 'Ahorro' && !(Number((bancos.find(b => b.ID_Banco === c.ID_Banco) || {}).Rendimiento_EA) > 0));
  if (sinTasa.length) {
    agregar('rendimiento', 'sugerencia', 'Cuentas de ahorro sin tasa de rendimiento', 'Agrega la tasa en el banco para que Moni calcule cuánto te rinde (y si es diario o mensual).', 'ajustes/Bancos');
  }
  if (!nominaLista) agregar('nomina', 'sugerencia', 'Configura tu nómina', 'Con tu sueldo, Moni estima lo que recibes cada mes.', 'nomina');
  if (!getTableData('Suscripciones').some(estaActivo)) {
    agregar('suscripciones', 'sugerencia', 'Anota tus suscripciones y servicios', 'Streaming, internet, luz…: entran solos a tu presupuesto y te recordamos cuándo se cobran.', 'pagos');
  }
  if (!esVerdadero(cfgValor_('Recordatorios_Activos'))) {
    agregar('recordatorios', 'sugerencia', 'Activa los recordatorios', 'Moni puede avisarte en Google Calendar cuando se acerque un pago.', 'ajustes/recordatorios');
  }

  // ---- Novedades: funciones que todavía no ha usado ----
  if (!getTableData('CDTs').some(estaActivo)) {
    agregar('novedad_cdt', 'novedad', 'Nuevo: CDT', 'Registra tus CDT: ves cuánto tienes invertido, lo que ganarás y cuándo vencen.', 'cdt');
  }
  if (getTableData('Inmuebles').filter(estaActivo).length === 0 && getTableData('Suscripciones').some(estaActivo)) {
    agregar('novedad_hogar', 'novedad', 'Nuevo: hogares', 'Si pagas servicios o suscripciones en más de una casa, sepáralos por hogar.', 'ajustes/Inmuebles');
  }

  const orden = { importante: 0, sugerencia: 1, novedad: 2 };
  return lista.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/** "Ahora no": la persona oculta un aviso (los importantes no se pueden ocultar). */
function ocultarAviso(id) {
  const a = obtenerAvisos_().find(x => x.id === id);
  if (!a) return obtenerAvisos_();
  if (!a.ocultable) throw new Error('Este aviso se quita solo cuando lo resuelvas.');
  const actuales = avisosOcultos_();
  if (actuales.indexOf(id) === -1) guardarConfig_('Avisos_Ocultos', actuales.concat([id]).join(','));
  return obtenerAvisos_();
}

/** Vuelve a mostrar todo lo que se había ocultado. */
function mostrarAvisosOcultos() {
  guardarConfig_('Avisos_Ocultos', '');
  return obtenerAvisos_();
}
