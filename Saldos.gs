/**
 * Saldos.gs — Moni
 * Saldos de bolsillos y cuentas calculados desde el libro de movimientos.
 *   Saldo de bolsillo = Saldo_Apertura + Σ Valor de sus movimientos no anulados que afectan saldos (hasta una fecha).
 *   Saldo de cuenta   = Σ saldos de sus bolsillos.
 */

/** Pesos con separador de miles, para mensajes de error: 1250000 → "$ 1.250.000". */
function pesos_(n) {
  return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function redondear2_(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Devuelve { ID_Bolsillo: saldo }. `hastaFecha` (AAAA-MM-DD) es opcional e inclusiva. */
function mapaSaldosBolsillos_(hastaFecha) {
  return memoDerivado_('saldos|' + (hastaFecha || ''), () => calcularSaldosBolsillos_(hastaFecha));
}

function calcularSaldosBolsillos_(hastaFecha) {
  const bolsillos = getTableData('Bolsillos');
  const movimientos = getTableData('Movimientos', { excludeAnulados: true });

  const suma = {};
  movimientos.forEach(m => {
    if (hastaFecha && m.Fecha && m.Fecha > hastaFecha) return;
    if (!afectaSaldos_(m)) return; // un movimiento histórico cuenta en los informes, no en los saldos
    suma[m.ID_Bolsillo] = (suma[m.ID_Bolsillo] || 0) + (Number(m.Valor) || 0);
  });

  const saldos = {};
  bolsillos.forEach(b => {
    saldos[b.ID_Bolsillo] = redondear2_((Number(b.Saldo_Apertura) || 0) + (suma[b.ID_Bolsillo] || 0));
  });
  return saldos;
}

/** Totales de las divisas distintas al peso, con su equivalente en pesos si la persona anotó la tasa. */
function resumenOtrasDivisas_(totales) {
  return Object.keys(totales).sort().map(d => {
    const tasa = tasaDivisa_(d);
    return { Divisa: d, Total: redondear2_(totales[d]), Tasa: tasa, Equivalente: tasa ? redondear2_(totales[d] * tasa) : null };
  });
}

/**
 * Saldos por cuenta y bolsillo, con el cuadre contra el saldo real auditado de cada cuenta.
 * @param {string} hastaFecha AAAA-MM-DD (opcional; por defecto, todo el historial)
 */
function obtenerSaldos(hastaFecha) {
  const saldos = mapaSaldosBolsillos_(hastaFecha);
  const bancos = getTableData('Bancos');
  const cuentas = listarCatalogo('Cuentas');
  const bolsillos = listarCatalogo('Bolsillos');

  let disponible = 0;
  let ahorro = 0;
  const otras = {}; // saldo total de cada divisa distinta al peso
  const divisas = mapaDivisas_();

  const resultado = cuentas.map(c => {
    const banco = bancos.find(b => b.ID_Banco === c.ID_Banco);
    const divisa = divisas.cuentas[c.ID_Cuenta] || DIVISA_BASE;
    const susBolsillos = bolsillos
      .filter(b => b.ID_Cuenta === c.ID_Cuenta)
      .map(b => ({
        ID_Bolsillo: b.ID_Bolsillo,
        Nombre: b.Nombre,
        Rol: b.Rol,
        Es_Interno: esVerdadero(b.Es_Interno),
        Color: b.Color,
        Saldo: saldos[b.ID_Bolsillo] || 0
      }));

    const saldo = redondear2_(susBolsillos.reduce((a, b) => a + b.Saldo, 0));
    // Los pesos no se suman con otras divisas: cada una lleva su total aparte.
    if (divisa !== DIVISA_BASE) otras[divisa] = (otras[divisa] || 0) + saldo;
    else if (c.Tipo === 'Ahorro') ahorro += saldo; else disponible += saldo;

    const tieneReal = c.Saldo_Real !== '' && c.Saldo_Real !== undefined && c.Saldo_Real !== null;
    return {
      ID_Cuenta: c.ID_Cuenta,
      Nombre: c.Nombre,
      Divisa: divisa,
      Tipo: c.Tipo,
      Banco: banco ? banco.Nombre : '',
      Color: banco ? banco.Color : '',
      Permite_Bolsillos: esVerdadero(c.Permite_Bolsillos),
      Meta: Number(c.Meta) || 0,
      Saldo: saldo,
      Saldo_Real: tieneReal ? Number(c.Saldo_Real) : null,
      Fecha_Saldo_Real: c.Fecha_Saldo_Real || '',
      Diferencia: tieneReal ? redondear2_(Number(c.Saldo_Real) - saldo) : null,
      bolsillos: susBolsillos
    };
  });

  return {
    fecha: hastaFecha || hoyIso_(),
    cuentas: resultado,
    disponible: redondear2_(disponible),
    ahorro: redondear2_(ahorro),
    total: redondear2_(disponible + ahorro),
    divisas: resumenOtrasDivisas_(otras)
  };
}

/**
 * Saldos de todos los bolsillos y cuentas en un formato compacto. Es lo que devuelve cada
 * escritura para que la pantalla actualice los números sin volver a pedir todo.
 * @returns {{bolsillos: Object, cuentas: Object, disponible: number, ahorro: number, total: number}}
 */
function resumenSaldos_() {
  const saldos = mapaSaldosBolsillos_();
  const porCuenta = {};
  getTableData('Bolsillos').forEach(b => {
    porCuenta[b.ID_Cuenta] = (porCuenta[b.ID_Cuenta] || 0) + (saldos[b.ID_Bolsillo] || 0);
  });

  let disponible = 0;
  let ahorro = 0;
  const otras = {};
  const divisaDeCuenta = mapaDivisas_().cuentas;
  const cuentas = {};
  getTableData('Cuentas').forEach(c => {
    if (!estaActivo(c)) return;
    const saldo = redondear2_(porCuenta[c.ID_Cuenta] || 0);
    const divisa = divisaDeCuenta[c.ID_Cuenta] || DIVISA_BASE;
    if (divisa !== DIVISA_BASE) otras[divisa] = (otras[divisa] || 0) + saldo;
    else if (c.Tipo === 'Ahorro') ahorro += saldo; else disponible += saldo;
    const tieneReal = c.Saldo_Real !== '' && c.Saldo_Real !== undefined && c.Saldo_Real !== null;
    cuentas[c.ID_Cuenta] = {
      Saldo: saldo,
      Saldo_Real: tieneReal ? Number(c.Saldo_Real) : null,
      Fecha_Saldo_Real: c.Fecha_Saldo_Real || '',
      Diferencia: tieneReal ? redondear2_(Number(c.Saldo_Real) - saldo) : null
    };
  });

  return { bolsillos: saldos, cuentas: cuentas, disponible: redondear2_(disponible), ahorro: redondear2_(ahorro), total: redondear2_(disponible + ahorro), divisas: resumenOtrasDivisas_(otras) };
}

/**
 * Patrimonio neto: lo que tienes menos lo que debes (en la moneda principal; las demás divisas van aparte).
 *   Tienes: disponible + ahorro + invertido (capital de los CDT vigentes).
 *   Debes: lo comprado con tarjeta sin pagar + el capital pendiente de los créditos con un banco o entidad.
 * Un crédito de autopago no se resta: es dinero que te debes a ti (ya salió de tu ahorro, así que no se cuenta dos veces).
 * La reserva de una tarjeta es dinero tuyo (está en "disponible") apartado para pagarla.
 */
function resumenPatrimonio_() {
  return memoDerivado_('patrimonio', () => {
    const s = resumenSaldos_();
    const cdt = resumenInvertido_().total;
    const inversiones = resumenInversiones_().valor;
    const invertido = redondear2_(cdt + inversiones);
    const tarjetas = redondear2_(resumenTarjetas_().reduce((a, t) => a + (Number(t.deuda) || 0), 0));
    const creditosB = listarCreditos().filter(c => c.Estado === 'Activo' && c.Tipo_Credito === 'Bancario');
    const creditos = redondear2_(creditosB.reduce((a, c) => a + (Number(c.saldo) || 0), 0));
    const activos = redondear2_(s.disponible + s.ahorro + invertido);
    const pasivos = redondear2_(tarjetas + creditos);
    return {
      activos: { disponible: s.disponible, ahorro: s.ahorro, invertido: invertido, cdt: cdt, inversiones: inversiones, total: activos },
      pasivos: { tarjetas: tarjetas, creditos: creditos, total: pasivos },
      neto: redondear2_(activos - pasivos), divisas: s.divisas, divisa: DIVISA_BASE
    };
  });
}

