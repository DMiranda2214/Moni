/**
 * Catalogos.gs — Moni
 * Servicio de catálogos personalizables: bancos, cuentas, bolsillos, tarjetas, categorías,
 * personas, inmuebles, servicios públicos y escenarios de presupuesto.
 * Nada de lo que el usuario define va fijo en el código: todo se crea, edita y desactiva aquí.
 */

const SALDO_CERO = 0.005; // tolerancia para considerar un saldo en cero

// ---------------------------------------------------------------------------
// Utilidades de validación
// ---------------------------------------------------------------------------

function nuevoId_(prefijo) {
  return prefijo + '-' + String(Utilities.getUuid()).replace(/-/g, '').slice(0, 8);
}

function hoyIso_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
}

function texto_(v) {
  return String(v === undefined || v === null ? '' : v).trim();
}

function textoRequerido_(v, etiqueta) {
  const t = texto_(v);
  if (!t) throw new Error(etiqueta + ' es obligatorio.');
  return t;
}

function numero_(v, etiqueta, opc) {
  const o = opc || {};
  if (v === undefined || v === null || v === '') {
    if (o.requerido) throw new Error(etiqueta + ' es obligatorio.');
    return o.defecto === undefined ? '' : o.defecto;
  }
  const n = Number(v);
  if (!isFinite(n)) throw new Error(etiqueta + ' debe ser un número.');
  if (o.entero && Math.floor(n) !== n) throw new Error(etiqueta + ' debe ser un número entero.');
  if (o.min !== undefined && n < o.min) throw new Error(etiqueta + ' no puede ser menor que ' + o.min + '.');
  if (o.max !== undefined && n > o.max) throw new Error(etiqueta + ' no puede ser mayor que ' + o.max + '.');
  return Math.round(n * 100) / 100;
}

function fechaIso_(v, etiqueta, defecto) {
  if (v === undefined || v === null || v === '') return defecto === undefined ? '' : defecto;
  const t = texto_(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(etiqueta + ' debe tener formato AAAA-MM-DD.');
  return t;
}

function opcion_(v, lista, etiqueta, defecto) {
  const t = texto_(v);
  if (!t && defecto !== undefined) return defecto;
  if (lista.indexOf(t) === -1) throw new Error(etiqueta + ' no es válido. Opciones: ' + lista.join(', ') + '.');
  return t;
}

function colorHex_(v) {
  const t = texto_(v);
  if (t && !/^#[0-9a-fA-F]{6}$/.test(t)) throw new Error('El color debe tener formato #RRGGBB.');
  return t;
}

function urlSegura_(v) {
  const t = texto_(v);
  if (t && !/^https?:\/\/[^\s]+$/i.test(t)) throw new Error('El enlace debe empezar por http:// o https://.');
  return t;
}

function leer_(tabla) {
  return getTableData(tabla, { forceRefresh: true });
}

// ---------------------------------------------------------------------------
// Divisas: la divisa se elige en el banco; sus cuentas y bolsillos la heredan.
// ---------------------------------------------------------------------------

function divisaBanco_(banco) {
  return banco && DIVISAS.indexOf(banco.Divisa) !== -1 ? banco.Divisa : DIVISA_BASE;
}

/** Divisa de cada cuenta y bolsillo: { cuentas: {id: 'USD'}, bolsillos: {id: 'USD'} }. */
function mapaDivisas_() {
  const porBanco = {};
  getTableData('Bancos').forEach(b => { porBanco[b.ID_Banco] = divisaBanco_(b); });
  const cuentas = {};
  getTableData('Cuentas').forEach(c => { cuentas[c.ID_Cuenta] = porBanco[c.ID_Banco] || DIVISA_BASE; });
  const bolsillos = {};
  getTableData('Bolsillos').forEach(b => { bolsillos[b.ID_Bolsillo] = cuentas[b.ID_Cuenta] || DIVISA_BASE; });
  return { cuentas: cuentas, bolsillos: bolsillos };
}

function divisaDeBolsillo_(idBolsillo) { return mapaDivisas_().bolsillos[idBolsillo] || DIVISA_BASE; }
function divisaDeCuenta_(idCuenta) { return mapaDivisas_().cuentas[idCuenta] || DIVISA_BASE; }

/** Presupuesto, nómina, tarjetas, créditos, suscripciones y regalos trabajan en pesos: rechaza un bolsillo en otra divisa. */
function exigirPesos_(idBolsillo, etiqueta) {
  const divisa = divisaDeBolsillo_(idBolsillo);
  if (divisa !== DIVISA_BASE) {
    const b = getTableData('Bolsillos').find(x => x.ID_Bolsillo === idBolsillo);
    throw new Error(etiqueta + ' ("' + (b ? b.Nombre : idBolsillo) + '") está en ' + divisa + '. Aquí solo se usan bolsillos en ' + DIVISA_BASE + '.');
  }
}

function exigirCuentaPesos_(idCuenta, etiqueta) {
  const divisa = divisaDeCuenta_(idCuenta);
  if (divisa !== DIVISA_BASE) {
    const c = getTableData('Cuentas').find(x => x.ID_Cuenta === idCuenta);
    throw new Error(etiqueta + ' ("' + (c ? c.Nombre : idCuenta) + '") está en ' + divisa + '. Aquí solo se usan cuentas en ' + DIVISA_BASE + '.');
  }
}

/** Pesos que vale una unidad de la divisa, según la tasa que la persona anotó (o null si no hay). */
function tasaDivisa_(divisa) {
  if (divisa === DIVISA_BASE) return 1;
  const n = Number(String(cfgValor_('Tasa_' + divisa)).replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
}

function buscarPorId_(filas, idCol, id) {
  return filas.find(f => f[idCol] === id) || null;
}

function exigirNombreUnico_(filas, nombre, actual, idCol, filtro) {
  const clave = nombre.toLowerCase();
  const repetido = filas.some(f =>
    (!actual || f[idCol] !== actual[idCol]) &&
    estaActivo(f) &&
    texto_(f.Nombre).toLowerCase() === clave &&
    (!filtro || filtro(f)));
  if (repetido) throw new Error('Ya existe un elemento activo llamado "' + nombre + '".');
}

function siguienteOrden_(filas) {
  return filas.reduce((m, f) => Math.max(m, Number(f.Orden) || 0), 0) + 1;
}

function exigirActivo_(filas, idCol, id, etiqueta) {
  const fila = buscarPorId_(filas, idCol, id);
  if (!fila) throw new Error(etiqueta + ' no existe.');
  if (!estaActivo(fila)) throw new Error(etiqueta + ' está desactivado.');
  return fila;
}

// ---------------------------------------------------------------------------
// Definición de cada catálogo
// ---------------------------------------------------------------------------

const CATALOGOS = {
  Bancos: {
    id: 'ID_Banco', prefijo: 'ban', etiqueta: 'El banco',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Banco');
      const divisa = opcion_(item.Divisa !== undefined ? item.Divisa : actual && actual.Divisa, DIVISAS, 'La divisa', DIVISA_BASE);
      // Cambiarla reinterpretaría los saldos ya registrados: se pide crear otro banco.
      if (actual && divisaBanco_(actual) !== divisa && leer_('Cuentas').some(c => c.ID_Banco === actual.ID_Banco)) {
        throw new Error('No se puede cambiar la divisa de un banco que ya tiene cuentas. Crea otro banco en ' + divisa + '.');
      }
      // Rendimiento de las cuentas de ahorro de este banco: tasa efectiva anual (decimal) y cuándo lo paga.
      const eaCrudo = item.Rendimiento_EA !== undefined ? item.Rendimiento_EA : actual && actual.Rendimiento_EA;
      let ea = '';
      if (eaCrudo !== '' && eaCrudo !== undefined && eaCrudo !== null) {
        ea = Number(String(eaCrudo).replace(',', '.'));
        if (!isFinite(ea) || ea < 0 || ea > 1) throw new Error('La tasa de rendimiento debe estar entre 0 % y 100 %.');
        ea = Math.round(ea * 100000) / 100000; // hasta 3 decimales en porcentaje (9,525 %)
      }
      const pagoDado = item.Rendimiento_Pago !== undefined ? item.Rendimiento_Pago : actual && actual.Rendimiento_Pago;
      const pago = ea === '' || ea === 0 ? '' : opcion_(pagoDado, ['Diario', 'Mensual'], 'La forma de pago del rendimiento', 'Mensual');
      return {
        Rendimiento_EA: ea === 0 ? '' : ea,
        Rendimiento_Pago: pago,
        Divisa: divisa,
        Nombre: nombre,
        Color: colorHex_(item.Color !== undefined ? item.Color : actual && actual.Color),
        Icono: texto_(item.Icono !== undefined ? item.Icono : actual && actual.Icono),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function (reg) {
      const msgs = [];
      const cuentas = leer_('Cuentas').filter(c => c.ID_Banco === reg.ID_Banco && estaActivo(c)).length;
      const tarjetas = leer_('Tarjetas').filter(t => t.ID_Banco === reg.ID_Banco && estaActivo(t)).length;
      if (cuentas) msgs.push(cuentas + ' cuenta(s) activa(s)');
      if (tarjetas) msgs.push(tarjetas + ' tarjeta(s) activa(s)');
      return msgs;
    }
  },

  Cuentas: {
    id: 'ID_Cuenta', prefijo: 'cta', etiqueta: 'La cuenta',
    normalizar: function (item, actual, filas, opciones) {
      const idBanco = item.ID_Banco !== undefined ? item.ID_Banco : actual && actual.ID_Banco;
      exigirActivo_(leer_('Bancos'), 'ID_Banco', idBanco, 'El banco');
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Cuenta', f => f.ID_Banco === idBanco);
      const tipo = opcion_(item.Tipo !== undefined ? item.Tipo : actual && actual.Tipo, ENUMS.Cuentas.Tipo, 'El tipo');

      let permite;
      if (item.Permite_Bolsillos !== undefined) permite = esVerdadero(item.Permite_Bolsillos);
      else if (actual) permite = esVerdadero(actual.Permite_Bolsillos);
      else permite = tipo !== 'Debito'; // por defecto, una cuenta débito es un solo saldo

      // Se valida aquí, antes de escribir nada: si falla, la cuenta queda exactamente como estaba.
      if (actual && esVerdadero(actual.Permite_Bolsillos) && !permite) {
        const delaCuenta = leer_('Bolsillos').filter(b => b.ID_Cuenta === actual.ID_Cuenta && estaActivo(b));
        if (delaCuenta.length > 1) {
          const destino = opciones && opciones.fusionarEn;
          if (!destino) {
            throw new Error('La cuenta tiene ' + delaCuenta.length + ' bolsillos activos. Elige en cuál juntar el dinero de todos para quitar los bolsillos.');
          }
          if (!delaCuenta.some(b => b.ID_Bolsillo === destino)) {
            throw new Error('El bolsillo donde se junta el dinero debe ser uno activo de esta cuenta.');
          }
        }
      }

      const saldoReal = numero_(item.Saldo_Real !== undefined ? item.Saldo_Real : actual && actual.Saldo_Real, 'El saldo real');
      let fechaSaldo = fechaIso_(item.Fecha_Saldo_Real !== undefined ? item.Fecha_Saldo_Real : actual && actual.Fecha_Saldo_Real, 'La fecha del saldo real');
      if (saldoReal !== '' && !fechaSaldo) fechaSaldo = hoyIso_();

      return {
        ID_Banco: idBanco,
        Nombre: nombre,
        Tipo: tipo,
        Permite_Bolsillos: permite,
        Fecha_Apertura: fechaIso_(item.Fecha_Apertura !== undefined ? item.Fecha_Apertura : actual && actual.Fecha_Apertura, 'La fecha de apertura', hoyIso_()),
        Saldo_Real: saldoReal,
        Fecha_Saldo_Real: saldoReal === '' ? '' : fechaSaldo,
        Meta: numero_(item.Meta !== undefined ? item.Meta : actual && actual.Meta, 'La meta', { min: 0 }),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    despues: function (reg, anterior, item, opciones) {
      const permite = esVerdadero(reg.Permite_Bolsillos);
      if (!anterior) {
        if (!permite) crearBolsilloInterno_(reg, numero_(item.Saldo_Apertura, 'El saldo inicial', { defecto: 0 }));
        return;
      }
      const antes = esVerdadero(anterior.Permite_Bolsillos);
      if (antes && !permite && opciones && opciones.fusionarEn) fusionarBolsillos_(reg, opciones.fusionarEn);
      if (antes !== permite) cambiarModoBolsillos_(reg, permite);
      if (!permite && item.Saldo_Apertura !== undefined) {
        const general = leer_('Bolsillos').find(b => b.ID_Cuenta === reg.ID_Cuenta && esVerdadero(b.Es_Interno));
        if (general) {
          updateRow('Bolsillos', general._rowIndex, { Saldo_Apertura: numero_(item.Saldo_Apertura, 'El saldo inicial', { defecto: 0 }) });
        }
      }
    },
    bloqueos: function (reg) {
      const msgs = [];
      const saldos = mapaSaldosBolsillos_();
      const conSaldo = leer_('Bolsillos').filter(b => b.ID_Cuenta === reg.ID_Cuenta && estaActivo(b) && Math.abs(saldos[b.ID_Bolsillo] || 0) >= SALDO_CERO).length;
      if (conSaldo) msgs.push(conSaldo + ' bolsillo(s) con saldo distinto de cero');
      const creditos = leer_('Creditos').filter(c => c.ID_Cuenta_Ahorro === reg.ID_Cuenta && c.Estado === 'Activo').length;
      if (creditos) msgs.push(creditos + ' crédito(s) activo(s) que reponen a esta cuenta');
      return msgs;
    },
    alDesactivar: function (reg) {
      // Los bolsillos de una cuenta desactivada también quedan inactivos (ya están en cero).
      leer_('Bolsillos').filter(b => b.ID_Cuenta === reg.ID_Cuenta && estaActivo(b))
        .forEach(b => updateRow('Bolsillos', b._rowIndex, { Activo: false }));
    },
    padreActivo: function (reg) {
      exigirActivo_(leer_('Bancos'), 'ID_Banco', reg.ID_Banco, 'El banco de la cuenta');
    }
  },

  Bolsillos: {
    id: 'ID_Bolsillo', prefijo: 'bol', etiqueta: 'El bolsillo',
    normalizar: function (item, actual, filas) {
      const idCuenta = actual ? actual.ID_Cuenta : item.ID_Cuenta;
      if (actual && item.ID_Cuenta !== undefined && item.ID_Cuenta !== actual.ID_Cuenta) {
        throw new Error('Un bolsillo no se puede mover a otra cuenta; usa una transferencia.');
      }
      const cuenta = exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', idCuenta, 'La cuenta');
      const interno = actual && esVerdadero(actual.Es_Interno);

      if (!actual && !esVerdadero(cuenta.Permite_Bolsillos)) {
        throw new Error('La cuenta "' + cuenta.Nombre + '" no permite bolsillos. Actívalo en la cuenta para crear bolsillos.');
      }

      const saldo = numero_(item.Saldo_Apertura !== undefined ? item.Saldo_Apertura : actual && actual.Saldo_Apertura, 'El saldo de apertura', { defecto: 0 });
      if (interno) {
        // El bolsillo interno solo admite cambiar su saldo de apertura.
        return { Saldo_Apertura: saldo };
      }

      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Bolsillo', f => f.ID_Cuenta === idCuenta);
      const roles = ENUMS.Bolsillos.Rol.filter(r => r !== 'General');
      const rol = opcion_(item.Rol !== undefined ? item.Rol : actual && actual.Rol, roles, 'El rol', 'Operativo');

      const datos = {
        Nombre: nombre,
        Rol: rol,
        Saldo_Apertura: saldo,
        Color: colorHex_(item.Color !== undefined ? item.Color : actual && actual.Color),
        Icono: texto_(item.Icono !== undefined ? item.Icono : actual && actual.Icono),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
      if (!actual) { datos.ID_Cuenta = idCuenta; datos.Es_Interno = false; }
      return datos;
    },
    bloqueos: function (reg) {
      const msgs = [];
      if (esVerdadero(reg.Es_Interno)) return ['es el saldo interno de una cuenta sin bolsillos; desactiva la cuenta'];
      const saldo = mapaSaldosBolsillos_()[reg.ID_Bolsillo] || 0;
      if (Math.abs(saldo) >= SALDO_CERO) msgs.push('tiene un saldo distinto de cero; trasládalo a otro bolsillo');
      const id = reg.ID_Bolsillo;
      const tarjetas = leer_('Tarjetas').filter(t => estaActivo(t) && (t.ID_Bolsillo_Reserva === id || t.ID_Bolsillo_Personal === id)).length;
      if (tarjetas) msgs.push('lo usa(n) ' + tarjetas + ' tarjeta(s)');
      const plan = leer_('Presupuesto_Plantilla').filter(p => estaActivo(p) && p.ID_Bolsillo_Destino === id).length;
      if (plan) msgs.push('lo usa(n) ' + plan + ' renglón(es) del presupuesto');
      const cred = leer_('Creditos').filter(c => c.Estado === 'Activo' && c.ID_Bolsillo_Pago === id).length;
      if (cred) msgs.push('paga(n) ' + cred + ' crédito(s)');
      return msgs;
    },
    padreActivo: function (reg) {
      exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', reg.ID_Cuenta, 'La cuenta del bolsillo');
    }
  },

  Tarjetas: {
    id: 'ID_Tarjeta', prefijo: 'tar', etiqueta: 'La tarjeta',
    // Permite crear la reserva en el mismo paso: opciones.crearReserva = { ID_Cuenta, Nombre }
    antes: function (item, actual, opciones) {
      const o = opciones || {};
      if (!o.crearReserva) return item;
      const nombreTarjeta = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      // Si la cuenta elegida se maneja como un solo saldo, pasa a usar bolsillos: la reserva necesita uno propio.
      const cuentaReserva = exigirActivo_(leer_('Cuentas'), 'ID_Cuenta', o.crearReserva.ID_Cuenta, 'La cuenta de la reserva');
      if (!esVerdadero(cuentaReserva.Permite_Bolsillos)) guardarCatalogo('Cuentas', { ID_Cuenta: cuentaReserva.ID_Cuenta, Permite_Bolsillos: true });
      const reserva = guardarCatalogo('Bolsillos', {
        ID_Cuenta: o.crearReserva.ID_Cuenta,
        Nombre: o.crearReserva.Nombre || ('Reserva ' + nombreTarjeta),
        Rol: 'Reserva_Tarjeta',
        Saldo_Apertura: 0
      });
      return Object.assign({}, item, { ID_Bolsillo_Reserva: reserva.ID_Bolsillo });
    },
    normalizar: function (item, actual, filas) {
      const idBanco = item.ID_Banco !== undefined ? item.ID_Banco : actual && actual.ID_Banco;
      const banco = exigirActivo_(leer_('Bancos'), 'ID_Banco', idBanco, 'El banco');
      if (divisaBanco_(banco) !== DIVISA_BASE) throw new Error('Las tarjetas se registran en bancos en ' + DIVISA_BASE + '; "' + banco.Nombre + '" está en ' + divisaBanco_(banco) + '.');
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Tarjeta');

      const bolsillos = leer_('Bolsillos');
      const idReserva = item.ID_Bolsillo_Reserva !== undefined ? item.ID_Bolsillo_Reserva : actual && actual.ID_Bolsillo_Reserva;
      const reserva = exigirActivo_(bolsillos, 'ID_Bolsillo', idReserva, 'El bolsillo de reserva');
      if (reserva.Rol !== 'Reserva_Tarjeta') throw new Error('El bolsillo de reserva debe tener el rol "Reserva de tarjeta".');
      exigirPesos_(idReserva, 'El bolsillo de reserva');

      const idPersonal = item.ID_Bolsillo_Personal !== undefined ? item.ID_Bolsillo_Personal : actual && actual.ID_Bolsillo_Personal;
      if (idPersonal) { exigirActivo_(bolsillos, 'ID_Bolsillo', idPersonal, 'El bolsillo personal'); exigirPesos_(idPersonal, 'El bolsillo personal'); }

      return {
        ID_Banco: idBanco,
        Nombre: nombre,
        Cupo: numero_(item.Cupo !== undefined ? item.Cupo : actual && actual.Cupo, 'El cupo', { min: 0, defecto: 0 }),
        Dia_Corte: numero_(item.Dia_Corte !== undefined ? item.Dia_Corte : actual && actual.Dia_Corte, 'El día de corte', { requerido: true, entero: true, min: 1, max: 31 }),
        Dia_Pago: numero_(item.Dia_Pago !== undefined ? item.Dia_Pago : actual && actual.Dia_Pago, 'El día de pago', { requerido: true, entero: true, min: 1, max: 31 }),
        ID_Bolsillo_Reserva: idReserva,
        ID_Bolsillo_Personal: idPersonal || '',
        Color: colorHex_(item.Color !== undefined ? item.Color : actual && actual.Color),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function (reg) {
      const pend = leer_('Compras_TC').filter(c => c.ID_Tarjeta === reg.ID_Tarjeta && !esVerdadero(c.Anulado) && !esVerdadero(c.Pagado)).length;
      return pend ? [pend + ' compra(s) sin pagar'] : [];
    },
    padreActivo: function (reg) {
      exigirActivo_(leer_('Bancos'), 'ID_Banco', reg.ID_Banco, 'El banco de la tarjeta');
    }
  },

  Categorias: {
    id: 'ID_Categoria', prefijo: 'cat', etiqueta: 'La categoría',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      const tipo = opcion_(item.Tipo !== undefined ? item.Tipo : actual && actual.Tipo, ENUMS.Categorias.Tipo, 'El tipo');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Categoria', f => f.Tipo === tipo);
      return {
        Nombre: nombre,
        Tipo: tipo,
        Icono: texto_(item.Icono !== undefined ? item.Icono : actual && actual.Icono),
        Color: colorHex_(item.Color !== undefined ? item.Color : actual && actual.Color),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function () { return []; } // el historial conserva la categoría aunque se desactive
  },

  Personas: {
    id: 'ID_Persona', prefijo: 'per', etiqueta: 'La persona',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Persona');
      return {
        Nombre: nombre,
        Rol: opcion_(item.Rol !== undefined ? item.Rol : actual && actual.Rol, ENUMS.Personas.Rol, 'El rol', 'Otro')
      };
    },
    bloqueos: function (reg) {
      const n = leer_('Creditos').filter(c => c.ID_Persona === reg.ID_Persona && c.Estado === 'Activo').length;
      return n ? [n + ' crédito(s) activo(s)'] : [];
    }
  },

  Inmuebles: {
    id: 'ID_Inmueble', prefijo: 'inm', etiqueta: 'El inmueble',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Inmueble');
      return { Nombre: nombre, Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 }) };
    },
    bloqueos: function (reg) {
      const n = leer_('Servicios_Publicos').filter(s => s.ID_Inmueble === reg.ID_Inmueble && estaActivo(s)).length;
      return n ? [n + ' servicio(s) activo(s); desactívalos primero'] : [];
    }
  },

  Servicios_Publicos: {
    id: 'ID_Servicio', prefijo: 'srv', etiqueta: 'El servicio',
    normalizar: function (item, actual) {
      const idInmueble = item.ID_Inmueble !== undefined ? item.ID_Inmueble : actual && actual.ID_Inmueble;
      exigirActivo_(leer_('Inmuebles'), 'ID_Inmueble', idInmueble, 'El inmueble');
      return {
        ID_Inmueble: idInmueble,
        Tipo: textoRequerido_(item.Tipo !== undefined ? item.Tipo : actual && actual.Tipo, 'El tipo de servicio'),
        Empresa: texto_(item.Empresa !== undefined ? item.Empresa : actual && actual.Empresa),
        Codigo_Pago: textoRequerido_(item.Codigo_Pago !== undefined ? item.Codigo_Pago : actual && actual.Codigo_Pago, 'El código de pago'),
        URL_Pago: urlSegura_(item.URL_Pago !== undefined ? item.URL_Pago : actual && actual.URL_Pago),
        Notas: texto_(item.Notas !== undefined ? item.Notas : actual && actual.Notas)
      };
    },
    bloqueos: function () { return []; },
    padreActivo: function (reg) {
      exigirActivo_(leer_('Inmuebles'), 'ID_Inmueble', reg.ID_Inmueble, 'El inmueble del servicio');
    }
  },

  Suscripciones: {
    id: 'ID_Suscripcion', prefijo: 'sus', etiqueta: 'La suscripción',
    normalizar: function (item, actual, filas) {
      const pick = k => item[k] !== undefined ? item[k] : actual && actual[k];
      const nombre = textoRequerido_(pick('Nombre'), 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Suscripcion');
      const proximo = fechaIso_(pick('Proximo_Cobro'), 'La fecha del próximo cobro');
      if (!proximo) throw new Error('Indica cuándo es el próximo cobro.');
      const idBolsillo = texto_(pick('ID_Bolsillo')), idTarjeta = texto_(pick('ID_Tarjeta'));
      if (idBolsillo) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo'); exigirPesos_(idBolsillo, 'El bolsillo'); }
      if (idTarjeta) exigirActivo_(leer_('Tarjetas'), 'ID_Tarjeta', idTarjeta, 'La tarjeta');
      if (idBolsillo && idTarjeta) throw new Error('Elige cómo se paga: desde un bolsillo o con una tarjeta, no ambos.');
      const idCat = texto_(pick('ID_Categoria'));
      if (idCat) exigirActivo_(leer_('Categorias'), 'ID_Categoria', idCat, 'La categoría');
      const idSrv = texto_(pick('ID_Servicio'));
      if (idSrv) exigirActivo_(leer_('Servicios_Publicos'), 'ID_Servicio', idSrv, 'El servicio');
      return {
        Nombre: nombre,
        Tipo: opcion_(pick('Tipo'), ENUMS.Suscripciones.Tipo, 'El tipo', 'Suscripcion'),
        Valor: numero_(pick('Valor'), 'El valor', { requerido: true, min: 0, max: VALOR_MAXIMO }),
        Periodicidad: opcion_(pick('Periodicidad'), ENUMS.Suscripciones.Periodicidad, 'La periodicidad', 'Mensual'),
        Proximo_Cobro: proximo, Dia_Cobro: Number(proximo.slice(8, 10)),
        ID_Bolsillo: idBolsillo, ID_Tarjeta: idTarjeta, ID_Categoria: idCat, ID_Servicio: idSrv,
        Renglon: texto_(pick('Renglon')).slice(0, 80),
        URL_Pago: urlSegura_(pick('URL_Pago')), Notas: texto_(pick('Notas')).slice(0, 300),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function () { return []; }
  },

  Ingresos_Recurrentes: {
    id: 'ID_Ingreso', prefijo: 'ing', etiqueta: 'El ingreso',
    normalizar: function (item, actual, filas) {
      const pick = k => item[k] !== undefined ? item[k] : actual && actual[k];
      const nombre = textoRequerido_(pick('Nombre'), 'El concepto').slice(0, 80);
      exigirNombreUnico_(filas, nombre, actual, 'ID_Ingreso');
      const proximo = fechaIso_(pick('Proximo_Cobro'), 'La fecha del próximo ingreso');
      if (!proximo) throw new Error('Indica cuándo esperas recibirlo.');
      const idBolsillo = texto_(pick('ID_Bolsillo'));
      if (!idBolsillo) throw new Error('Elige a qué cuenta llega el dinero.');
      exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo');
      exigirPesos_(idBolsillo, 'El bolsillo donde llega el ingreso');
      const idCat = texto_(pick('ID_Categoria'));
      if (idCat) exigirActivo_(leer_('Categorias'), 'ID_Categoria', idCat, 'La categoría');
      return {
        Nombre: nombre,
        Valor: numero_(pick('Valor'), 'El monto', { requerido: true, min: 0.01, max: VALOR_MAXIMO }),
        Periodicidad: opcion_(pick('Periodicidad'), ENUMS.Ingresos_Recurrentes.Periodicidad, 'La periodicidad', 'Mensual'),
        Proximo_Cobro: proximo, Dia_Cobro: Number(proximo.slice(8, 10)),
        ID_Bolsillo: idBolsillo, ID_Categoria: idCat, Notas: texto_(pick('Notas')).slice(0, 300),
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function () { return []; }
  },

  Presupuesto_Plantilla: {
    id: 'ID_Plantilla', prefijo: 'ppl', etiqueta: 'El renglón',
    normalizar: function (item, actual, filas) {
      const idEsc = item.ID_Escenario !== undefined ? item.ID_Escenario : actual && actual.ID_Escenario;
      exigirActivo_(leer_('Escenarios'), 'ID_Escenario', idEsc, 'El escenario');
      const concepto = textoRequerido_(item.Concepto !== undefined ? item.Concepto : actual && actual.Concepto, 'El concepto');
      const repetido = filas.some(f => (!actual || f.ID_Plantilla !== actual.ID_Plantilla) && estaActivo(f) && f.ID_Escenario === idEsc && texto_(f.Concepto).toLowerCase() === concepto.toLowerCase());
      if (repetido) throw new Error('Ya hay un renglón llamado "' + concepto + '" en este escenario.');

      const tipo = opcion_(item.Tipo !== undefined ? item.Tipo : actual && actual.Tipo, ENUMS.Presupuesto_Plantilla.Tipo, 'El tipo', 'Gasto');
      const idBolsillo = item.ID_Bolsillo_Destino !== undefined ? item.ID_Bolsillo_Destino : actual && actual.ID_Bolsillo_Destino;
      if (idBolsillo) { exigirActivo_(leer_('Bolsillos'), 'ID_Bolsillo', idBolsillo, 'El bolsillo de destino'); exigirPesos_(idBolsillo, 'El bolsillo de destino'); }
      if (tipo !== 'Gasto' && !idBolsillo) throw new Error('Un renglón de ' + tipo.toLowerCase() + ' necesita un bolsillo de destino: ahí se aparta el dinero.');
      const idCat = item.ID_Categoria !== undefined ? item.ID_Categoria : actual && actual.ID_Categoria;
      if (idCat) exigirActivo_(leer_('Categorias'), 'ID_Categoria', idCat, 'La categoría');
      const idCredito = item.ID_Credito !== undefined ? texto_(item.ID_Credito) : (actual ? actual.ID_Credito || '' : '');
      if (idCredito && !leer_('Creditos').some(c => c.ID_Credito === idCredito && c.Estado === 'Activo')) throw new Error('El crédito no existe o ya está pagado.');

      const idTarjeta = item.ID_Tarjeta !== undefined ? texto_(item.ID_Tarjeta) : (actual ? actual.ID_Tarjeta || '' : '');
      if (idTarjeta) {
        if (tipo !== 'Gasto') throw new Error('Solo un renglón de gasto puede pagarse con tarjeta.');
        exigirActivo_(leer_('Tarjetas'), 'ID_Tarjeta', idTarjeta, 'La tarjeta');
      }

      return {
        ID_Credito: idCredito,
        ID_Tarjeta: idTarjeta,
        ID_Escenario: idEsc,
        Concepto: concepto,
        Monto_Plan: numero_(item.Monto_Plan !== undefined ? item.Monto_Plan : actual && actual.Monto_Plan, 'El monto', { requerido: true, min: 0, max: VALOR_MAXIMO }),
        Tipo: tipo,
        ID_Bolsillo_Destino: idBolsillo || '',
        ID_Categoria: idCat || '',
        Orden: numero_(item.Orden, 'El orden', { entero: true, min: 0 })
      };
    },
    bloqueos: function () { return []; } // los meses ya generados conservan su copia
  },

  Subsidios: {
    id: 'ID_Subsidio', prefijo: 'sub', etiqueta: 'El subsidio',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Subsidio');
      return {
        Nombre: nombre,
        Valor: numero_(item.Valor !== undefined ? item.Valor : actual && actual.Valor, 'El valor', { requerido: true, min: 0, max: VALOR_MAXIMO }),
        Es_Salarial: item.Es_Salarial !== undefined ? esVerdadero(item.Es_Salarial) : (actual ? esVerdadero(actual.Es_Salarial) : false),
        Vigente_Desde: fechaIso_(item.Vigente_Desde !== undefined ? item.Vigente_Desde : actual && actual.Vigente_Desde, 'La fecha de inicio'),
        Vigente_Hasta: fechaIso_(item.Vigente_Hasta !== undefined ? item.Vigente_Hasta : actual && actual.Vigente_Hasta, 'La fecha de fin')
      };
    },
    bloqueos: function (reg) {
      const n = leer_('Nomina_Conceptos').filter(c => c.ID_Subsidio === reg.ID_Subsidio && estaActivo(c)).length;
      return n ? ['lo usa(n) ' + n + ' escenario(s) de nómina; quítaselo primero'] : [];
    }
  },

  Nomina_Escenarios: {
    id: 'ID_Nomina_Esc', prefijo: 'nes', etiqueta: 'El escenario de nómina',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Nomina_Esc');
      let vigente = actual ? esVerdadero(actual.Vigente) : false;
      if (item.Vigente !== undefined) vigente = esVerdadero(item.Vigente);
      if (actual && esVerdadero(actual.Vigente) && !vigente) {
        throw new Error('Debe haber un escenario vigente. Marca otro como vigente en lugar de quitarle la marca a este.');
      }
      return {
        Nombre: nombre,
        Sueldo_Base: numero_(item.Sueldo_Base !== undefined ? item.Sueldo_Base : actual && actual.Sueldo_Base, 'El sueldo base', { requerido: true, min: 0.01, max: VALOR_MAXIMO }),
        Vigente: vigente
      };
    },
    despues: function (reg, anterior, item, opciones) {
      if (esVerdadero(reg.Vigente)) {
        leer_('Nomina_Escenarios').filter(e => e.ID_Nomina_Esc !== reg.ID_Nomina_Esc && esVerdadero(e.Vigente))
          .forEach(e => updateRow('Nomina_Escenarios', e._rowIndex, { Vigente: false }));
      }
      // Los subsidios del escenario se reemplazan por la lista recibida (si viene).
      const ids = (opciones && opciones.subsidios) || (item && item.subsidios);
      if (Array.isArray(ids)) sincronizarSubsidios_(reg.ID_Nomina_Esc, ids);
    },
    bloqueos: function (reg) {
      return esVerdadero(reg.Vigente) ? ['es el escenario vigente; marca otro como vigente primero'] : [];
    }
  },

  Escenarios: {
    id: 'ID_Escenario', prefijo: 'esc', etiqueta: 'El escenario',
    normalizar: function (item, actual, filas) {
      const nombre = textoRequerido_(item.Nombre !== undefined ? item.Nombre : actual && actual.Nombre, 'El nombre');
      exigirNombreUnico_(filas, nombre, actual, 'ID_Escenario');
      let esBase = actual ? esVerdadero(actual.Es_Base) : false;
      if (item.Es_Base !== undefined) esBase = esVerdadero(item.Es_Base);
      if (actual && esVerdadero(actual.Es_Base) && !esBase) {
        throw new Error('Debe haber un escenario base. Marca otro escenario como base en lugar de quitarle la marca a este.');
      }
      return { Nombre: nombre, Es_Base: esBase, Descripcion: texto_(item.Descripcion !== undefined ? item.Descripcion : actual && actual.Descripcion) };
    },
    despues: function (reg, anterior, item, opciones) {
      const o = opciones || {};
      // Un solo escenario base: al marcar este, los demás dejan de serlo.
      if (esVerdadero(reg.Es_Base)) {
        leer_('Escenarios').filter(e => e.ID_Escenario !== reg.ID_Escenario && esVerdadero(e.Es_Base))
          .forEach(e => updateRow('Escenarios', e._rowIndex, { Es_Base: false }));
      }
      // Crear un escenario copiando los renglones de otro (p. ej. Contingencia a partir de Normal).
      if (!anterior && o.copiarDe) {
        const origen = leer_('Presupuesto_Plantilla').filter(p => p.ID_Escenario === o.copiarDe && estaActivo(p));
        if (origen.length) {
          insertRows('Presupuesto_Plantilla', origen.map(p => ({
            ID_Plantilla: nuevoId_('ppl'),
            ID_Escenario: reg.ID_Escenario,
            Concepto: p.Concepto, Monto_Plan: p.Monto_Plan, Tipo: p.Tipo,
            ID_Bolsillo_Destino: p.ID_Bolsillo_Destino, ID_Categoria: p.ID_Categoria, ID_Credito: p.ID_Credito,
            Activo: true, Orden: p.Orden
          })));
        }
      }
    },
    bloqueos: function (reg) {
      return esVerdadero(reg.Es_Base) ? ['es el escenario base; marca otro como base primero'] : [];
    }
  }
};

/** Reemplaza los subsidios de un escenario de nómina por los recibidos. */
function sincronizarSubsidios_(idEsc, idsSubsidio) {
  const subsidios = leer_('Subsidios');
  idsSubsidio.forEach(id => exigirActivo_(subsidios, 'ID_Subsidio', id, 'El subsidio'));
  const actuales = leer_('Nomina_Conceptos').filter(c => c.ID_Nomina_Esc === idEsc && estaActivo(c));
  actuales.forEach(c => { if (idsSubsidio.indexOf(c.ID_Subsidio) === -1) updateRow('Nomina_Conceptos', c._rowIndex, { Activo: false }); });
  const yaEstan = actuales.map(c => c.ID_Subsidio);
  const nuevos = idsSubsidio.filter(id => yaEstan.indexOf(id) === -1).map(id => {
    const sub = buscarPorId_(subsidios, 'ID_Subsidio', id);
    return { ID_Concepto: nuevoId_('nco'), ID_Nomina_Esc: idEsc, Tipo: 'Devengo', Concepto: sub.Nombre, Activo: true, Tipo_Calculo: 'Subsidio', ID_Subsidio: id };
  });
  if (nuevos.length) insertRows('Nomina_Conceptos', nuevos);
}

/** IDs de los subsidios activos de un escenario de nómina. */
function subsidiosDeEscenario_(idEsc) {
  return leer_('Nomina_Conceptos').filter(c => c.ID_Nomina_Esc === idEsc && estaActivo(c) && c.ID_Subsidio).map(c => c.ID_Subsidio);
}

function definicion_(tabla) {
  const def = CATALOGOS[tabla];
  if (!def) throw new Error('"' + tabla + '" no es un catálogo.');
  return def;
}

// ---------------------------------------------------------------------------
// Operaciones públicas
// ---------------------------------------------------------------------------

/** Lista un catálogo ordenado por `Orden` y nombre. Por defecto solo los activos. */
function listarCatalogo(tabla, opciones) {
  const def = definicion_(tabla);
  const o = opciones || {};
  return getTableData(tabla, { forceRefresh: !!o.forceRefresh })
    .filter(f => o.incluirInactivos || estaActivo(f))
    .sort((a, b) => ((Number(a.Orden) || 9999) - (Number(b.Orden) || 9999)) ||
      texto_(a.Nombre || a.Concepto || a[def.id]).localeCompare(texto_(b.Nombre || b.Concepto || b[def.id])));
}

/**
 * Crea o edita un elemento. Si trae el ID, edita; si no, crea.
 * Los campos que no vienen en `item` se conservan al editar.
 */
function guardarCatalogo(tabla, item, opciones) {
  const def = definicion_(tabla);
  if (!item || typeof item !== 'object') throw new Error('Faltan los datos a guardar.');

  const filas = leer_(tabla);
  const id = item[def.id];
  const actual = id ? buscarPorId_(filas, def.id, id) : null;
  if (id && !actual) throw new Error(def.etiqueta + ' que intentas editar no existe.');

  const entrada = def.antes ? def.antes(item, actual, opciones) : item;
  const datos = def.normalizar(entrada, actual, filas, opciones);

  const sinOrden = datos.Orden === '' || datos.Orden === undefined;

  let registro;
  if (actual) {
    if (sinOrden) delete datos.Orden; // al editar, el orden se conserva si no se envía
    updateRow(tabla, actual._rowIndex, datos);
    registro = Object.assign({}, actual, datos);
  } else {
    datos[def.id] = nuevoId_(def.prefijo);
    datos.Activo = true;
    if (sinOrden) datos.Orden = siguienteOrden_(filas);
    insertRow(tabla, datos);
    registro = datos;
  }

  if (def.despues) def.despues(registro, actual, entrada, opciones);
  invalidateCache(tabla);
  return registro;
}

/** Desactiva un elemento (borrado lógico). Se rechaza si hay saldo o dependencias activas. */
function desactivarCatalogo(tabla, id) {
  const def = definicion_(tabla);
  const filas = leer_(tabla);
  const reg = buscarPorId_(filas, def.id, id);
  if (!reg) throw new Error(def.etiqueta + ' no existe.');
  if (!estaActivo(reg)) return reg;

  const motivos = def.bloqueos ? def.bloqueos(reg) : [];
  if (motivos.length) {
    throw new Error('No se puede desactivar "' + (reg.Nombre || id) + '": ' + motivos.join('; ') + '.');
  }

  updateRow(tabla, reg._rowIndex, { Activo: false });
  if (def.alDesactivar) def.alDesactivar(reg);
  invalidateCache(tabla);
  return Object.assign({}, reg, { Activo: false });
}

/** Vuelve a activar un elemento, si lo que lo contiene sigue activo. */
function reactivarCatalogo(tabla, id) {
  const def = definicion_(tabla);
  const reg = buscarPorId_(leer_(tabla), def.id, id);
  if (!reg) throw new Error(def.etiqueta + ' no existe.');
  if (def.padreActivo) def.padreActivo(reg);
  updateRow(tabla, reg._rowIndex, { Activo: true });
  invalidateCache(tabla);
  return Object.assign({}, reg, { Activo: true });
}

/**
 * Crea tu nómina con sus subsidios de una sola vez (asistente de primeros pasos). Todo o nada.
 * @param {Object} esc { Nombre, Sueldo_Base }  (queda como el escenario vigente)
 * @param {Array} subsidios [{ Nombre, Valor, Es_Salarial }]  ingresos fijos como un auxilio o un bono
 */
function guardarNominaConSubsidios(esc, subsidios) {
  if (!esc || typeof esc !== 'object') throw new Error('Faltan los datos de la nómina.');
  const lista = Array.isArray(subsidios) ? subsidios : [];
  const existentes = leer_('Subsidios').filter(estaActivo).map(s => texto_(s.Nombre).toLowerCase());
  const vistos = {};
  lista.forEach((s, i) => {
    const nombre = textoRequerido_(s && s.Nombre, 'El nombre del subsidio ' + (i + 1));
    const k = nombre.toLowerCase();
    if (vistos[k] || existentes.indexOf(k) !== -1) throw new Error('Ya hay un subsidio llamado "' + nombre + '".');
    vistos[k] = true;
    numero_(s.Valor, 'El valor de "' + nombre + '"', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  });
  numero_(esc.Sueldo_Base, 'El sueldo base', { requerido: true, min: 0.01, max: VALOR_MAXIMO });
  const creados = lista.map(s => guardarCatalogo('Subsidios', { Nombre: s.Nombre, Valor: s.Valor, Es_Salarial: !!s.Es_Salarial }));
  const creado = guardarCatalogo('Nomina_Escenarios', Object.assign({ Nombre: 'Actual' }, esc, { Vigente: true }), { subsidios: creados.map(c => c.ID_Subsidio) });
  return { escenario: creado, subsidios: creados };
}

/**
 * Crea una cuenta junto con sus bolsillos y el dinero que hay hoy en cada uno (el caso normal de quien ya
 * tiene su dinero repartido). Se valida todo antes de escribir: si algo no es válido, no se crea nada.
 * @param {Object} cuenta Los campos de la cuenta (ID_Banco, Nombre, Tipo, Permite_Bolsillos, Saldo_Apertura…).
 * @param {Array} bolsillos [{ Nombre, Saldo_Apertura, Rol? }]. Solo si la cuenta usa bolsillos.
 */
function guardarCuentaConBolsillos(cuenta, bolsillos) {
  if (!cuenta || typeof cuenta !== 'object') throw new Error('Faltan los datos de la cuenta.');
  const lista = Array.isArray(bolsillos) ? bolsillos : [];
  const permite = cuenta.Permite_Bolsillos !== undefined ? esVerdadero(cuenta.Permite_Bolsillos) : texto_(cuenta.Tipo) !== 'Debito';
  if (!permite && lista.length) throw new Error('Esta cuenta se maneja como un solo saldo. Activa "Usar bolsillos" o quita los bolsillos.');

  const roles = ENUMS.Bolsillos.Rol.filter(r => r !== 'General');
  const vistos = {};
  lista.forEach((b, i) => {
    const nombre = textoRequerido_(b && b.Nombre, 'El nombre del bolsillo ' + (i + 1));
    if (vistos[nombre.toLowerCase()]) throw new Error('Hay dos bolsillos llamados "' + nombre + '".');
    vistos[nombre.toLowerCase()] = true;
    numero_(b.Saldo_Apertura, 'El saldo de "' + nombre + '"', { defecto: 0, min: -VALOR_MAXIMO, max: VALOR_MAXIMO });
    opcion_(b.Rol, roles, 'El rol de "' + nombre + '"', 'Operativo');
  });

  const creada = guardarCatalogo('Cuentas', cuenta);
  const creados = lista.map(b => guardarCatalogo('Bolsillos', Object.assign({}, b, { ID_Cuenta: creada.ID_Cuenta })));
  return { cuenta: creada, bolsillos: creados };
}

// ---------------------------------------------------------------------------
// Cuentas con o sin bolsillos
// ---------------------------------------------------------------------------

/** Crea el bolsillo interno "General" de una cuenta que no usa bolsillos. */
function crearBolsilloInterno_(cuenta, saldoApertura) {
  insertRow('Bolsillos', {
    ID_Bolsillo: nuevoId_('bol'),
    ID_Cuenta: cuenta.ID_Cuenta,
    Nombre: cuenta.Nombre,
    Rol: 'General',
    Saldo_Apertura: saldoApertura || 0,
    Es_Interno: true,
    Color: '', Icono: '',
    Activo: true,
    Orden: 1
  });
  invalidateCache('Bolsillos');
}

/**
 * Junta en un solo bolsillo el dinero de todos los bolsillos activos de una cuenta.
 * Cada bolsillo con saldo se traslada al destino (un traslado normal, que queda en el historial)
 * y luego se desactiva. Después la cuenta puede pasar a funcionar sin bolsillos.
 */
function fusionarBolsillos_(cuenta, idDestino) {
  const saldos = mapaSaldosBolsillos_();
  const otros = leer_('Bolsillos').filter(b => b.ID_Cuenta === cuenta.ID_Cuenta && estaActivo(b) && b.ID_Bolsillo !== idDestino);
  otros.forEach(b => {
    const saldo = saldos[b.ID_Bolsillo] || 0;
    if (saldo >= SALDO_CERO) registrarTransferencia(b.ID_Bolsillo, idDestino, saldo, hoyIso_(), 'Fusión de bolsillos: ' + b.Nombre);
    else if (saldo <= -SALDO_CERO) registrarTransferencia(idDestino, b.ID_Bolsillo, -saldo, hoyIso_(), 'Fusión de bolsillos: ' + b.Nombre);
  });
  // Releer: los traslados invalidaron la lectura anterior y hay que usar números de fila vigentes.
  leer_('Bolsillos').filter(b => otros.some(o => o.ID_Bolsillo === b.ID_Bolsillo))
    .forEach(b => updateRow('Bolsillos', b._rowIndex, { Activo: false }));
  invalidateCache('Bolsillos');
}

/**
 * Cambia una cuenta entre "con bolsillos" y "sin bolsillos".
 *  - Con → sin: solo si queda a lo sumo un bolsillo activo (que pasa a ser el saldo interno); esa
 *    condición se valida en Cuentas.normalizar, antes de escribir. La fusión de varios bolsillos con
 *    traslado de saldo llega con las transferencias (Fase 2).
 *  - Sin → con: el saldo interno pasa a ser un bolsillo normal que se puede renombrar.
 */
function cambiarModoBolsillos_(cuenta, permite) {
  const delaCuenta = leer_('Bolsillos').filter(b => b.ID_Cuenta === cuenta.ID_Cuenta && estaActivo(b));

  if (permite) {
    delaCuenta.filter(b => esVerdadero(b.Es_Interno))
      .forEach(b => updateRow('Bolsillos', b._rowIndex, { Es_Interno: false, Rol: 'Operativo' }));
  } else {
    if (delaCuenta.length === 1) {
      updateRow('Bolsillos', delaCuenta[0]._rowIndex, { Es_Interno: true, Rol: 'General', Nombre: cuenta.Nombre });
    } else {
      crearBolsilloInterno_(cuenta, 0);
    }
  }
  invalidateCache('Bolsillos');
}

// ---------------------------------------------------------------------------
// Estado de la configuración (lista guiada de primeros pasos)
// ---------------------------------------------------------------------------

function obtenerEstadoConfiguracion(verificacionPrevia) {
  const verificacion = verificacionPrevia || verificarEsquema(undefined, { usarCache: true });
  if (!verificacion.listo) {
    return { instalado: false, faltantes: verificacion.faltantes, diferencias: verificacion.diferencias, pasos: [], completo: false };
  }

  const config = {};
  getTableData('Config').forEach(c => { config[c.Clave] = c.Valor; });
  const bancos = listarCatalogo('Bancos');
  const cuentas = listarCatalogo('Cuentas');
  const bolsillos = listarCatalogo('Bolsillos').filter(b => !esVerdadero(b.Es_Interno));
  const tarjetas = listarCatalogo('Tarjetas');
  const hayCuentaConBolsillos = cuentas.some(c => esVerdadero(c.Permite_Bolsillos));

  const pasos = [
    { id: 'perfil', titulo: 'Cuéntanos cómo te llamas', hecho: texto_(config.Nombre_Usuario) !== '', opcional: false, pantalla: 'ajustes/perfil' },
    { id: 'bancos', titulo: 'Agrega tus bancos o billeteras', hecho: bancos.length > 0, opcional: false, pantalla: 'ajustes/Bancos' },
    { id: 'cuentas', titulo: 'Crea tus cuentas', hecho: cuentas.length > 0, opcional: false, pantalla: 'ajustes/Cuentas' },
    { id: 'bolsillos', titulo: 'Crea tus bolsillos con su saldo inicial', hecho: cuentas.length > 0 && (!hayCuentaConBolsillos || bolsillos.length > 0), opcional: cuentas.length > 0 && !hayCuentaConBolsillos, pantalla: 'ajustes/Bolsillos' },
    { id: 'tarjetas', titulo: 'Registra tus tarjetas de crédito', hecho: tarjetas.length > 0, opcional: true, pantalla: 'ajustes/Tarjetas' },
    { id: 'nomina', titulo: 'Configura tu nómina', hecho: listarCatalogo('Nomina_Escenarios').length > 0, opcional: true, pantalla: 'ajustes/Nomina_Escenarios' },
    { id: 'ingresos', titulo: 'Anota otros ingresos que se repiten', hecho: listarCatalogo('Ingresos_Recurrentes').length > 0, opcional: true, pantalla: 'ingresos' }
  ];
  const completo = pasos.filter(p => !p.opcional).every(p => p.hecho);

  return { instalado: true, pasos: pasos, completo: completo, hayDemo: esVerdadero(config.Datos_Demo) };
}
