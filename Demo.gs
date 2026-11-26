/**
 * Demo.gs — Moni
 * Datos ficticios para desarrollar y probar sin tocar saldos reales.
 *   - Todo registro demo tiene un ID que empieza por "demo-" y, en tablas de operación, Origen = "Demo".
 *   - Mientras existan, Config.Datos_Demo = TRUE y la app muestra una franja visible.
 *   - limpiarDatosDemo() borra solo lo demo; no toca nada real.
 * Los nombres y saldos son inventados: no representan datos de ninguna persona.
 */

const PREFIJO_DEMO = 'demo-';

/**
 * Una fila es de demostración si su ID empieza por "demo-", si referencia algo de demostración
 * (cualquier columna ID_… con ese prefijo: un renglón generado desde la plantilla demo, un movimiento
 * en un bolsillo demo…) o si su Origen es Demo.
 */
function esFilaDemo_(headers, fila) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (i === 0 || h.indexOf('ID_') === 0) {
      if (String(fila[i] === undefined ? '' : fila[i]).indexOf(PREFIJO_DEMO) === 0) return true;
    }
  }
  const iOrigen = headers.indexOf('Origen');
  return iOrigen !== -1 && fila[iOrigen] === 'Demo';
}

function fechaRelativa_(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd');
}

/** Siembra el conjunto de demostración. Rechaza si ya hay demo o si ya empezó la operación real. */
function sembrarDatosDemo() {
  if (!demoHabilitado_()) throw new Error('Los datos de demostración no están disponibles en esta versión de Moni.');
  const verificacion = verificarEsquema();
  if (!verificacion.listo) throw new Error('Primero instala la base de datos.');

  const cfg = {};
  getTableData('Config', { forceRefresh: true }).forEach(c => { cfg[c.Clave] = c.Valor; });
  if (esVerdadero(cfg.Datos_Demo)) throw new Error('Ya hay datos de demostración. Límpialos antes de volver a crearlos.');

  // Se puede crear sobre datos reales (para ver cómo luce la app): todo lo demo lleva el prefijo "demo-" y se borra aparte.
  // Una vez que empezó la operación real, no: ahí ya no se mezcla nada.
  const nominaRealVigente = getTableData('Nomina_Escenarios', { forceRefresh: true }).some(n => esVerdadero(n.Vigente) && estaActivo(n));

  const bancos = [
    { ID_Banco: 'demo-ban-1', Nombre: 'Billetera Aurora (demo)', Color: '#6C5CE7', Icono: '', Activo: true, Orden: 1 },
    { ID_Banco: 'demo-ban-2', Nombre: 'Banco Cumbre (demo)', Color: '#0B63CE', Icono: '', Activo: true, Orden: 2, Rendimiento_EA: 0.095, Rendimiento_Pago: 'Mensual' },
    { ID_Banco: 'demo-ban-3', Nombre: 'Banco Brisa (demo)', Color: '#17744A', Icono: '', Activo: true, Orden: 3 }
  ];

  const hoy = hoyIso_();
  const cuentas = [
    { ID_Cuenta: 'demo-cta-1', ID_Banco: 'demo-ban-1', Nombre: 'Billetera principal', Tipo: 'Billetera', Permite_Bolsillos: true, Fecha_Apertura: hoy, Saldo_Real: '', Fecha_Saldo_Real: '', Meta: '', Activo: true, Orden: 1 },
    { ID_Cuenta: 'demo-cta-2', ID_Banco: 'demo-ban-2', Nombre: 'Cuenta digital', Tipo: 'Debito', Permite_Bolsillos: true, Fecha_Apertura: hoy, Saldo_Real: '', Fecha_Saldo_Real: '', Meta: '', Activo: true, Orden: 2 },
    { ID_Cuenta: 'demo-cta-3', ID_Banco: 'demo-ban-3', Nombre: 'Débito diario', Tipo: 'Debito', Permite_Bolsillos: false, Fecha_Apertura: hoy, Saldo_Real: '', Fecha_Saldo_Real: '', Meta: '', Activo: true, Orden: 3 },
    { ID_Cuenta: 'demo-cta-4', ID_Banco: 'demo-ban-2', Nombre: 'Ahorro programado', Tipo: 'Ahorro', Permite_Bolsillos: false, Fecha_Apertura: hoy, Saldo_Real: '', Fecha_Saldo_Real: '', Meta: 10000000, Activo: true, Orden: 4 }
  ];

  const bol = (id, cuenta, nombre, rol, saldo, interno, orden) => ({
    ID_Bolsillo: id, ID_Cuenta: cuenta, Nombre: nombre, Rol: rol, Saldo_Apertura: saldo,
    Es_Interno: !!interno, Color: '', Icono: '', Activo: true, Orden: orden
  });
  const bolsillos = [
    bol('demo-bol-casa', 'demo-cta-1', 'Casa', 'Operativo', 1250000, false, 1),
    bol('demo-bol-servicios', 'demo-cta-1', 'Servicios', 'Operativo', 180000, false, 2),
    bol('demo-bol-mercado', 'demo-cta-1', 'Mercado', 'Operativo', 320000, false, 3),
    bol('demo-bol-transporte', 'demo-cta-1', 'Transporte', 'Operativo', 60000, false, 4),
    bol('demo-bol-ocio', 'demo-cta-1', 'Ocio', 'Operativo', 95000, false, 5),
    bol('demo-bol-regalos', 'demo-cta-1', 'Fondo de regalos', 'Fondo', 120000, false, 6),
    bol('demo-bol-reserva-verde', 'demo-cta-1', 'Reserva Tarjeta Verde', 'Reserva_Tarjeta', 0, false, 7),
    bol('demo-bol-reserva-azul', 'demo-cta-2', 'Reserva Tarjeta Azul', 'Reserva_Tarjeta', 310000, false, 1),
    bol('demo-bol-personal', 'demo-cta-2', 'Gastos personales', 'Operativo', 150000, false, 2),
    bol('demo-bol-viaje', 'demo-cta-2', 'Fondo de viaje', 'Fondo', 400000, false, 3),
    bol('demo-bol-sin-asignar-1', 'demo-cta-1', 'Sin asignar', 'General', 0, true, 0),
    bol('demo-bol-sin-asignar-2', 'demo-cta-2', 'Sin asignar', 'General', 0, true, 0),
    bol('demo-bol-general-3', 'demo-cta-3', 'Débito diario', 'General', 85000, true, 1),
    bol('demo-bol-general-4', 'demo-cta-4', 'Ahorro programado', 'General', 4200000, true, 1)
  ];

  const tarjetas = [
    { ID_Tarjeta: 'demo-tar-1', ID_Banco: 'demo-ban-2', Nombre: 'Tarjeta Azul (demo)', Cupo: 3000000, Dia_Corte: 15, Dia_Pago: 28, ID_Bolsillo_Reserva: 'demo-bol-reserva-azul', ID_Bolsillo_Personal: 'demo-bol-personal', Color: '#0B63CE', Activo: true, Orden: 1 },
    { ID_Tarjeta: 'demo-tar-2', ID_Banco: 'demo-ban-3', Nombre: 'Tarjeta Verde (demo)', Cupo: 1500000, Dia_Corte: 5, Dia_Pago: 20, ID_Bolsillo_Reserva: 'demo-bol-reserva-verde', ID_Bolsillo_Personal: 'demo-bol-personal', Color: '#17744A', Activo: true, Orden: 2 }
  ];

  const personas = [
    { ID_Persona: 'demo-per-1', Nombre: 'Yo (demo)', Rol: 'Titular', Activo: true },
    { ID_Persona: 'demo-per-2', Nombre: 'Familiar 1 (demo)', Rol: 'Familiar', Activo: true },
    { ID_Persona: 'demo-per-3', Nombre: 'Familiar 2 (demo)', Rol: 'Familiar', Activo: true }
  ];

  const inmuebles = [{ ID_Inmueble: 'demo-inm-1', Nombre: 'Casa (demo)', Activo: true, Orden: 1 }];

  const mov = (id, dias, concepto, bolsillo, valor, tipo, subtipo, grupo) => ({
    ID_Mov: id, Fecha: fechaRelativa_(dias), Concepto: concepto, ID_Bolsillo: bolsillo, Valor: valor,
    Tipo_Mov: tipo, Subtipo: subtipo || '', ID_Categoria: '', ID_Grupo: grupo || '', ID_Item_Ppto: '',
    Notas: '', Origen: 'Demo', Anulado: false
  });
  const movimientos = [
    mov('demo-mov-1', 6, 'Mercado de la semana', 'demo-bol-mercado', -85500, 'Gasto'),
    mov('demo-mov-2', 5, 'Pasajes', 'demo-bol-transporte', -12000, 'Gasto'),
    mov('demo-mov-3', 3, 'Cine', 'demo-bol-ocio', -45000, 'Gasto'),
    mov('demo-mov-4', 2, 'Traslado a servicios', 'demo-bol-casa', -150000, 'Transferencia', '', 'demo-grp-1'),
    mov('demo-mov-5', 2, 'Traslado a servicios', 'demo-bol-servicios', 150000, 'Transferencia', '', 'demo-grp-1'),
    mov('demo-mov-6', 1, 'Rendimientos del mes', 'demo-bol-general-4', 12300, 'Ingreso', 'Interes')
  ];

  insertRows('Bancos', bancos);
  insertRows('Cuentas', cuentas);
  insertRows('Bolsillos', bolsillos);
  insertRows('Tarjetas', tarjetas);
  insertRows('Personas', personas);
  insertRows('Inmuebles', inmuebles);
  insertRows('Movimientos', movimientos.map(conRef_));

  // Plantilla de presupuesto y nómina de ejemplo (sobre el escenario base que ya existe)
  const esc = getTableData('Escenarios', { forceRefresh: true }).find(e => esVerdadero(e.Es_Base));
  if (esc) {
    const ppl = (n, concepto, monto, tipo, destino, orden) => ({
      ID_Plantilla: 'demo-ppl-' + n, ID_Escenario: esc.ID_Escenario, Concepto: concepto, Monto_Plan: monto, Tipo: tipo,
      ID_Bolsillo_Destino: destino, ID_Categoria: '', ID_Credito: '', Activo: true, Orden: orden
    });
    insertRows('Presupuesto_Plantilla', [
      ppl(1, 'Arriendo', 900000, 'Gasto', 'demo-bol-casa', 1),
      ppl(2, 'Mercado', 300000, 'Gasto', 'demo-bol-mercado', 2),
      ppl(3, 'Servicios públicos', 180000, 'Gasto', 'demo-bol-servicios', 3),
      ppl(4, 'Transporte', 60000, 'Gasto', 'demo-bol-transporte', 4),
      ppl(5, 'Ocio', 100000, 'Gasto', 'demo-bol-ocio', 5),
      ppl(6, 'Fondo de regalos', 50000, 'Fondo', 'demo-bol-regalos', 6),
      ppl(7, 'Ahorro mensual', 400000, 'Ahorro', 'demo-bol-general-4', 7)
    ]);
  }
  insertRows('Subsidios', [{ ID_Subsidio: 'demo-sub-1', Nombre: 'Auxilio de conectividad (demo)', Valor: 150000, Es_Salarial: false, Vigente_Desde: '', Vigente_Hasta: '', Activo: true }]);
  insertRows('Nomina_Escenarios', [{ ID_Nomina_Esc: 'demo-nes-1', Nombre: 'Actual (demo)', Sueldo_Base: 3200000, Vigente: !nominaRealVigente, Activo: true }]);
  insertRows('Nomina_Conceptos', [{ ID_Concepto: 'demo-nco-1', ID_Nomina_Esc: 'demo-nes-1', Tipo: 'Devengo', Concepto: 'Auxilio de conectividad (demo)', Activo: true, Tipo_Calculo: 'Subsidio', ID_Subsidio: 'demo-sub-1' }]);

  // Compras de tarjeta y un crédito de autopago en marcha
  // Todas van al extracto en curso: con fechas relativas, según el día del mes algunas cruzarían el corte (día 15) y el
  // extracto de demostración quedaría con un total distinto cada día.
  const mesExtractoDemo = calcularMesExtracto_(hoyIso_(), 15);
  const compraDemo = (concepto, valor, dias, fuente) => registrarCompraTC({
    ID_Tarjeta: 'demo-tar-1', Concepto: concepto, Valor: valor, Fecha: fechaRelativa_(dias), Fuente: fuente, Origen: 'Demo', Mes_Extracto: mesExtractoDemo
  });
  compraDemo('Ropa (demo)', 180000, 5, 'Personal');
  compraDemo('Cena (demo)', 65000, 3, 'Guardar');
  compraDemo('Libros (demo)', 90000, 1, 'Personal');
  registrarCredito({
    ID_Credito: 'demo-cre-1', Nombre: 'Celular (demo)', ID_Persona: 'demo-per-2', ID_Cuenta_Ahorro: 'demo-cta-4', ID_Bolsillo_Pago: 'demo-bol-casa',
    Fecha_Inicio: fechaRelativa_(70), Monto: 900000, Periodicidad: 'Mensual', Num_Periodos: 6, Tasa_Periodica: 0.01, cuotasPagadas: 2
  });

  // Suscripciones y un servicio con vencimiento próximo
  const enDias = n => { const d = new Date(Date.now() + n * 86400000); return Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd'); };
  const susc = (n, nombre, tipo, valor, periodo, dias, extra) => Object.assign({
    ID_Suscripcion: 'demo-sus-' + n, Nombre: nombre, Tipo: tipo, Valor: valor, Periodicidad: periodo, Proximo_Cobro: enDias(dias),
    Dia_Cobro: Number(enDias(dias).slice(8, 10)), ID_Bolsillo: '', ID_Tarjeta: '', ID_Categoria: '', ID_Servicio: '', URL_Pago: '',
    Ultimo_Pago: '', Notas: '', Activo: true, Orden: n
  }, extra || {});
  insertRows('Suscripciones', [
    susc(1, 'Películas en streaming (demo)', 'Suscripcion', 39900, 'Mensual', 3, { ID_Tarjeta: 'demo-tar-1' }),
    susc(2, 'Música (demo)', 'Suscripcion', 16900, 'Mensual', 12, { ID_Bolsillo: 'demo-bol-personal' }),
    susc(3, 'Almacenamiento en la nube (demo)', 'Suscripcion', 120000, 'Anual', 80, { ID_Tarjeta: 'demo-tar-1' }),
    susc(4, 'Energía (demo)', 'Servicio', 95000, 'Mensual', 5, { ID_Bolsillo: 'demo-bol-servicios', ID_Inmueble: 'demo-inm-1', Empresa: 'Energía Demo', Codigo_Pago: '0000-DEMO-1', URL_Pago: 'https://example.com/energia', Notas: 'Dato ficticio' }),
    // Un servicio del que solo se guardan los datos de pago (sin fecha ni valor)
    susc(5, 'Agua (demo)', 'Servicio', 0, 'Mensual', 0, { Proximo_Cobro: '', Dia_Cobro: '', ID_Inmueble: 'demo-inm-1', Empresa: 'Acueducto Demo', Codigo_Pago: '0000-DEMO-2', URL_Pago: 'https://example.com/acueducto', Notas: 'Dato ficticio' })
  ]);

  // Un ingreso recurrente (otro trabajo)
  insertRows('Ingresos_Recurrentes', [{
    ID_Ingreso: 'demo-ing-1', Nombre: 'Trabajo aparte (demo)', Valor: 600000, Periodicidad: 'Mensual', Proximo_Cobro: enDias(6), Dia_Cobro: Number(enDias(6).slice(8, 10)),
    ID_Bolsillo: 'demo-bol-personal', ID_Categoria: '', Ultimo_Cobro: '', Notas: 'Dato ficticio', Activo: true, Orden: 1
  }]);

  // Regalos del año activo y un retiro del ahorro para gastos
  const anioDemo = Number(cfgValor_('Anio_Activo')) || new Date().getFullYear();
  insertRows('Regalos', [
    { ID_Regalo: 'demo-reg-1', Anio: anioDemo, ID_Persona: 'demo-per-2', Idea: 'Audífonos', Estimado: 200000, Real: '', ID_Mov: '', Aplica: true, Notas: '' },
    { ID_Regalo: 'demo-reg-2', Anio: anioDemo, ID_Persona: 'demo-per-3', Idea: 'Camiseta', Estimado: 60000, Real: '', ID_Mov: '', Aplica: true, Notas: '' },
    { ID_Regalo: 'demo-reg-3', Anio: anioDemo, ID_Persona: 'demo-per-1', Idea: 'Libro', Estimado: 80000, Real: '', ID_Mov: '', Aplica: false, Notas: '' }
  ]);
  registrarGastoRegalo('demo-reg-2', 55000, 'demo-bol-regalos', fechaRelativa_(2));
  // 1.16: un deseo para uno mismo, con su lluvia de ideas
  insertRows('Regalos', [
    { ID_Regalo: 'demo-reg-4', Anio: anioDemo, ID_Persona: '', Para: 'Yo', Idea: '', Categoria: 'Cuidado_Personal', Estimado: 120000, Real: '', ID_Mov: '', Aplica: true, Notas: '', Prioridad: 'Media', Estado: 'Idea', Ocasion: 'Porque sí' }
  ]);
  insertRows('Deseos_Ideas', [
    { ID_Idea: 'demo-ida-1', ID_Regalo: 'demo-reg-4', Texto: 'Sérum con vitamina C', Precio: 95000, Enlace: '', Elegida: false, Orden: 1 },
    { ID_Idea: 'demo-ida-2', ID_Regalo: 'demo-reg-4', Texto: 'Protector solar + hidratante', Precio: 110000, Enlace: '', Elegida: false, Orden: 2 }
  ]);
  // 1.16: metas de ahorro (una con el plan de diciembre en 0) e inversiones con precio de Google o manual
  const mesDemo = hoy.slice(0, 7);
  const planViaje = {}; planViaje[mesMas_(mesDemo, 1)] = 0;
  insertRows('Metas', [
    { ID_Meta: 'demo-meta-1', Nombre: 'Viaje a la costa (demo)', Motivo: 'Viaje', Monto_Objetivo: 3000000, Ahorro_Inicial: 400000, Fecha_Inicio: hoy, Fecha_Fin: sumarMeses_(hoy, 8), ID_Bolsillo: 'demo-bol-viaje', Plan_Mensual: JSON.stringify(planViaje), Estado: 'Activa', Notas: '', Activo: true, Orden: 1 },
    { ID_Meta: 'demo-meta-2', Nombre: 'Moto (demo)', Motivo: 'Moto', Monto_Objetivo: 9000000, Ahorro_Inicial: 0, Fecha_Inicio: hoy, Fecha_Fin: sumarMeses_(hoy, 18), ID_Bolsillo: 'demo-bol-general-4', Plan_Mensual: '', Estado: 'Activa', Notas: '', Activo: true, Orden: 2 }
  ]);
  // 1.19: un broker con dinero disponible y una acción comprada con él
  insertRows('Brokers', [{ ID_Broker: 'demo-brk-1', Nombre: 'Broker Andes (demo)', Divisa: 'COP', Notas: '', Activo: true, Orden: 1, Comision_Tipo: 'Porcentaje', Comision_Porcentaje: 0.005, Comision_Minima: 6000, Comision_Fija: '', Comision_Divisa: '' }]);
  insertRows('Inversiones', [
    { ID_Inversion: 'demo-inv-3', Nombre: 'Ecopetrol (demo)', Tipo: 'Accion', Simbolo: 'BVC:ECOPETROL', Divisa: 'COP', Precio_Manual: 2350, Fecha_Precio_Manual: hoy, Precio_Google: '', Fecha_Precio_Google: '', Notas: '', Activo: true, Orden: 3, ID_Broker: 'demo-brk-1' },
    { ID_Inversion: 'demo-inv-1', Nombre: 'Bitcoin (demo)', Tipo: 'Cripto', Simbolo: 'CURRENCY:BTCUSD', Divisa: 'USD', Precio_Manual: '', Fecha_Precio_Manual: '', Precio_Google: '', Fecha_Precio_Google: '', Notas: '', Activo: true, Orden: 1 },
    { ID_Inversion: 'demo-inv-2', Nombre: 'Fondo de inversión (demo)', Tipo: 'Fondo', Simbolo: '', Divisa: 'COP', Precio_Manual: 11250, Fecha_Precio_Manual: hoy, Precio_Google: '', Fecha_Precio_Google: '', Notas: '', Activo: true, Orden: 2 }
  ]);
  insertRows('Inversiones_Operaciones', [
    { ID_Operacion: 'demo-iop-1', ID_Inversion: 'demo-inv-1', Fecha: fechaRelativa_(40), Tipo: 'Compra', Cantidad: 0.005, Precio: 60000, Valor: 1200000, Comision: 0, ID_Bolsillo: '', ID_Mov: '', Notas: '', Anulado: false },
    { ID_Operacion: 'demo-iop-2', ID_Inversion: 'demo-inv-2', Fecha: fechaRelativa_(60), Tipo: 'Compra', Cantidad: 200, Precio: 10000, Valor: 2000000, Comision: 0, ID_Bolsillo: '', ID_Mov: '', Notas: '', Anulado: false },
    { ID_Operacion: 'demo-iop-3', ID_Inversion: '', Fecha: fechaRelativa_(30), Tipo: 'Deposito', Cantidad: '', Precio: '', Valor: 1500000, Comision: 0, ID_Bolsillo: '', ID_Mov: '', Notas: 'Disponible inicial', Anulado: false, ID_Broker: 'demo-brk-1', Valor_Origen: 1500000, Sin_Efectivo: false },
    { ID_Operacion: 'demo-iop-4', ID_Inversion: 'demo-inv-3', Fecha: fechaRelativa_(25), Tipo: 'Compra', Cantidad: 400, Precio: 2000, Valor: 800000, Comision: 6000, ID_Bolsillo: '', ID_Mov: '', Notas: '', Anulado: false, ID_Broker: 'demo-brk-1', Valor_Origen: 806000, Sin_Efectivo: false }
  ]);
  retirarParaGastos('demo-cta-4', 'demo-bol-casa', 150000, fechaRelativa_(4), 'Para gastos (demo)');

  updateRowById('Config', 'Clave', 'Datos_Demo', { Valor: 'TRUE' });
  invalidateCache();

  return {
    ok: true,
    bancos: bancos.length, cuentas: cuentas.length, bolsillos: bolsillos.length,
    tarjetas: tarjetas.length, movimientos: movimientos.length
  };
}

/** Borra solo los datos de demostración (IDs "demo-…" u Origen = Demo). */
function limpiarDatosDemo() {
  const lock = tomarBloqueo(30000);
  const eliminadas = {};
  try {
    const ss = getSpreadsheet();
    Object.keys(SCHEMAS).forEach(nombre => {
      if (nombre === 'Config') return;
      const sheet = ss.getSheetByName(nombre);
      if (!sheet || sheet.getLastRow() < 2) return;

      const valores = sheet.getRange(1, 1, sheet.getLastRow(), SCHEMAS[nombre].headers.length).getValues();
      const headers = valores[0].map(h => String(h).trim());
      const filas = [];
      for (let i = 1; i < valores.length; i++) {
        if (esFilaDemo_(headers, valores[i])) filas.push(i + 1);
      }
      // De abajo hacia arriba, para que los números de fila pendientes no se desplacen.
      filas.reverse().forEach(f => sheet.deleteRow(f));
      if (filas.length) eliminadas[nombre] = filas.length;
    });
  } finally {
    lock.releaseLock();
  }

  // El detalle de una nómina demo no tiene prefijo propio: se va con su nómina.
  limpiarDetalleHuerfano_(eliminadas);

  updateRowById('Config', 'Clave', 'Datos_Demo', { Valor: 'FALSE' });
  invalidateCache();
  return { ok: true, eliminadas: eliminadas };
}

/** Borra las líneas de detalle de nómina cuya nómina ya no existe. */
function limpiarDetalleHuerfano_(eliminadas) {
  invalidateCache();
  const vigentes = {};
  getTableData('Nomina_Pagos', { forceRefresh: true }).forEach(n => { vigentes[n.ID_Nomina] = true; });
  const huerfanas = getTableData('Nomina_Pagos_Detalle', { forceRefresh: true }).filter(d => !vigentes[d.ID_Nomina]);
  if (!huerfanas.length) return;
  const lock = tomarBloqueo(30000);
  try {
    const sheet = getSpreadsheet().getSheetByName('Nomina_Pagos_Detalle');
    huerfanas.sort((a, b) => b._rowIndex - a._rowIndex).forEach(d => sheet.deleteRow(d._rowIndex));
  } finally {
    lock.releaseLock();
  }
  eliminadas.Nomina_Pagos_Detalle = huerfanas.length;
  invalidateCache();
}
