/**
 * Regla de oro: quien ya usa Moni no pierde ni ve cambiar sus datos al actualizar la app.
 *
 * La prueba toma el código de la versión publicada (v1.10.0, sacado de git), crea una hoja y le siembra un año de datos
 * de ejemplo. Luego "actualiza" ESA MISMA hoja con el código de ahora (que agrega columnas y tablas) y compara:
 *   - ninguna fila ni celda original cambió (las columnas nuevas se insertan al lado);
 *   - saldos, deudas, créditos, presupuesto, vista anual, ahorro, CDT y suscripciones dan lo mismo.
 * Si git o esa versión no están disponibles, la prueba lo dice y no falla.
 */
const { execSync } = require('child_process');
const path = require('path');
const { bogota } = require('./fecha');

const VERSION_REFERENCIA = '5cca8fd'; // v1.10.0
const ARCHIVOS = ['Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'CDT.gs', 'Avisos.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Ingresos.gs', 'Multiusuario.gs', 'Demo.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs'];

function codigoAnterior() {
  const raiz = path.join(__dirname, '..');
  try {
    return ARCHIVOS.map(a => ({ a, codigo: execSync('git show ' + VERSION_REFERENCIA + ':' + a, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) }));
  } catch (e) {
    return null;
  }
}

module.exports = function (prueba, assert, crearEntorno) {
  const plano = x => JSON.parse(JSON.stringify(x));
  const conLlamar = e => {
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    return e;
  };

  /** Lo que la persona ve de sus datos: las respuestas completas de cada pantalla. */
  function foto(e) {
    const hoy = bogota();
    const mes = hoy.slice(0, 7);
    const creditos = e.llamar('listarCreditos');
    const tarjetas = e.llamar('resumenTarjetas_');
    return plano({
      saldos: e.llamar('obtenerSaldos'),
      tarjetas: tarjetas,
      detalleTarjetas: tarjetas.map(t => e.llamar('obtenerTarjeta', t.ID_Tarjeta)),
      creditos: creditos,
      detalleCreditos: creditos.map(c => e.llamar('obtenerCredito', c.ID_Credito)),
      deudaAhorro: e.llamar('deudaConAhorro_'),
      ppto: e.llamar('obtenerPresupuestoMes', mes),
      anual: e.llamar('obtenerVistaAnual', Number(hoy.slice(0, 4))),
      ahorro: e.llamar('obtenerAhorro'),
      cdts: e.llamar('obtenerCdts'),
      suscripciones: e.llamar('obtenerSuscripciones'),
      regalos: e.llamar('obtenerRegalos', Number(hoy.slice(0, 4))),
      movimientos: e.llamar('listarMovimientos', { desde: '2000-01-01', hasta: '2100-12-31', limite: 100000, incluirAnulados: true })
    });
  }

  /**
   * Todo lo que mostraba la versión anterior sigue igual en la nueva. La nueva puede AGREGAR campos (por ejemplo, el
   * vínculo Ref o el patrimonio), pero no cambiar ni quitar los que había. Devuelve la primera diferencia o ''.
   */
  function diferencia(nuevo, viejo, ruta) {
    if (viejo === null || typeof viejo !== 'object') {
      const a = typeof viejo === 'number' && typeof nuevo === 'number' ? Math.abs(a0(nuevo) - a0(viejo)) < 1e-6 : nuevo === viejo;
      return a ? '' : ruta + ': era ' + JSON.stringify(viejo) + ', ahora ' + JSON.stringify(nuevo);
    }
    if (nuevo === null || typeof nuevo !== 'object') return ruta + ': era un objeto, ahora ' + JSON.stringify(nuevo);
    if (Array.isArray(viejo)) {
      if (!Array.isArray(nuevo) || nuevo.length !== viejo.length) return ruta + ': tenía ' + viejo.length + ' elementos, ahora ' + (Array.isArray(nuevo) ? nuevo.length : 'no es lista');
      for (let i = 0; i < viejo.length; i++) { const d = diferencia(nuevo[i], viejo[i], ruta + '[' + i + ']'); if (d) return d; }
      return '';
    }
    for (const k of Object.keys(viejo)) {
      if (IGNORAR.indexOf(k) !== -1) continue;
      if (!(k in nuevo)) return ruta + '.' + k + ': ya no está';
      const d = diferencia(nuevo[k], viejo[k], ruta + '.' + k);
      if (d) return d;
    }
    return '';
  }
  const a0 = x => Number(x) || 0;
  const IGNORAR = ['Actualizado_En', '_rowIndex', 'ms'];

  /** Con la versión anterior: lo que haría una persona en un mes (presupuesto, gastos, tarjeta, crédito, CDT, ahorro…). */
  function usarUnMes(e) {
    const hoy = bogota();
    const mes = hoy.slice(0, 7);
    const pasos = [];
    const paso = (nombre, fn) => { try { fn(); pasos.push(nombre); } catch (err) { pasos.push(nombre + ' (falló: ' + err.message + ')'); } };
    const bols = e.llamar('listarCatalogo', 'Bolsillos').filter(b => b.Activo !== false && b.Activo !== 'FALSE');
    const saldos = e.llamar('mapaSaldosBolsillos_');
    const conPlata = bols.filter(b => (saldos[b.ID_Bolsillo] || 0) > 500000 && e.llamar('divisaDeBolsillo_', b.ID_Bolsillo) === 'COP');
    const b1 = conPlata[0], b2 = conPlata[1] || conPlata[0];
    paso('presupuesto', () => e.llamar('generarPresupuestoMes', mes));
    const ppto = e.llamar('obtenerPresupuestoMes', mes);
    const renglon = ppto && ppto.items ? ppto.items.find(i => i.ID_Bolsillo_Destino) : null;
    paso('gasto', () => e.llamar('registrarMovimiento', { Tipo_Mov: 'Gasto', Fecha: hoy, Concepto: 'Mercado', Valor: 85432.5, ID_Bolsillo: b1.ID_Bolsillo, ID_Item_Ppto: renglon ? renglon.ID_Item : '' }));
    paso('ingreso', () => e.llamar('registrarMovimiento', { Tipo_Mov: 'Ingreso', Fecha: hoy, Concepto: 'Venta', Valor: 120000, ID_Bolsillo: b2.ID_Bolsillo }));
    paso('traslado', () => e.llamar('registrarTransferencia', b1.ID_Bolsillo, b2.ID_Bolsillo, 50000, hoy, 'Mover'));
    const tarjeta = e.llamar('listarCatalogo', 'Tarjetas')[0];
    paso('compra tarjeta', () => e.llamar('registrarCompraTC', { ID_Tarjeta: tarjeta.ID_Tarjeta, Fecha: hoy, Concepto: 'Ropa', Valor: 99000 }));
    paso('compra tarjeta con renglón', () => e.llamar('registrarCompraTC', { ID_Tarjeta: tarjeta.ID_Tarjeta, Fecha: hoy, Concepto: 'Farmacia', Valor: 45000, ID_Item_Ppto: renglon ? renglon.ID_Item : '' }));
    paso('abono tarjeta', () => e.llamar('registrarAbonoTarjeta', { ID_Tarjeta: tarjeta.ID_Tarjeta, Mes: e.llamar('calcularMesExtracto_', hoy, tarjeta.Dia_Corte), Valor: 30000, Fecha: hoy, ID_Bolsillo: b1.ID_Bolsillo }));
    const credito = e.llamar('listarCreditos')[0];
    paso('cuota crédito', () => e.llamar('registrarPagoCredito', credito.ID_Credito, undefined, hoy));
    paso('abono a capital', () => { const d = e.llamar('obtenerCredito', credito.ID_Credito); e.llamar('registrarPagoCredito', credito.ID_Credito, d.cronograma.find(f => f.Estado === 'Pendiente').Cuota + 100000, hoy); });
    const banco = e.llamar('listarCatalogo', 'Bancos').find(b => (b.Divisa || 'COP') === 'COP');
    paso('cdt', () => e.llamar('guardarCatalogo', 'CDTs', { Nombre: 'CDT prueba', ID_Banco: banco.ID_Banco, Capital: 1000000, Tasa_EA: 0.0975, Fecha_Inicio: hoy, Plazo_Dias: 180, Retencion_Pct: 0.04, ID_Bolsillo_Origen: b1.ID_Bolsillo }));
    const ahorro = e.llamar('listarCatalogo', 'Cuentas').find(c => c.Tipo === 'Ahorro');
    if (ahorro) paso('rendimiento', () => e.llamar('registrarRendimiento', { ID_Cuenta: ahorro.ID_Cuenta, Tipo: 'Interes', Valor: 12345.67, Fecha: hoy }));
    const susc = e.llamar('listarCatalogo', 'Suscripciones')[0];
    if (susc) paso('pagar suscripción', () => e.llamar('pagarSuscripcion', susc.ID_Suscripcion, { Fecha: hoy, ID_Bolsillo: b1.ID_Bolsillo }));
    const ing = e.llamar('listarCatalogo', 'Ingresos_Recurrentes')[0];
    if (ing) paso('recibir ingreso', () => e.llamar('recibirIngresoRecurrente', ing.ID_Ingreso, { Fecha: hoy }));
    return pasos;
  }

  prueba('migración: una hoja de la v1.10.0 se actualiza sin perder ni cambiar datos', () => {
    const anterior = codigoAnterior();
    if (!anterior) { console.log('         (omitida: no se pudo leer la v1.10.0 desde git)'); return; }

    // 1. Una persona con un año de datos en la versión publicada
    const viejo = conLlamar(crearEntorno({}));
    anterior.forEach(x => viejo.cargarTexto(x.a, x.codigo));
    viejo.llamar('setupDatabase');
    viejo.llamar('sembrarDatosDemo');
    const pasos = usarUnMes(viejo);
    if (process.env.MONI_VER_PASOS) console.log(pasos.join(' | '));
    const antes = foto(viejo);
    const hojasAntes = {};
    Object.keys(viejo.hojas).forEach(n => { hojasAntes[n] = viejo.hojas[n].filas.map(f => f.slice()); });

    // 2. La misma hoja, abierta con la versión nueva (que migra columnas y crea tablas nuevas)
    const nuevo = conLlamar(crearEntorno(hojasAntes));
    nuevo.cargar(...ARCHIVOS);
    nuevo.llamar('setupDatabase');
    const despues = foto(nuevo);

    // 3. Ninguna celda original cambió: cada columna vieja conserva sus valores, fila por fila
    Object.keys(hojasAntes).forEach(n => {
      const vieja = hojasAntes[n];
      const actual = nuevo.hojas[n].filas;
      if (!vieja.length) return;
      const encV = vieja[0].map(String), encN = actual[0].map(String);
      assert.ok(actual.length >= vieja.length, n + ': se perdieron filas');
      encV.forEach((h, c) => {
        if (!h) return;
        const cn = encN.indexOf(h);
        assert.ok(cn !== -1, n + ': se perdió la columna ' + h);
        for (let r = 1; r < vieja.length; r++) {
          if (h === 'Actualizado_En') continue; // la marca de auditoría puede cambiar si la migración escribe
          assert.deepStrictEqual(actual[r][cn], vieja[r][c], n + '.' + h + ' fila ' + (r + 1) + ' cambió');
        }
      });
    });

    // 4. Lo que se ve da lo mismo (y la foto no está vacía)
    assert.ok(antes.movimientos.items.length >= 5 && antes.creditos.length && antes.tarjetas.length && antes.cdts.vigentes.length && antes.detalleCreditos[0].pagos.length, 'la foto de referencia debería tener datos');
    Object.keys(antes).forEach(k => {
      const d = diferencia(despues[k], antes[k], k);
      assert.strictEqual(d, '', 'cambió al actualizar → ' + d);
    });
  });
};
