/**
 * Saldos.gs — Moni
 * Saldos de bolsillos y cuentas calculados desde el libro de movimientos.
 *   Saldo de bolsillo = Saldo_Apertura + Σ Valor de sus movimientos no anulados (hasta una fecha).
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
  const bolsillos = getTableData('Bolsillos');
  const movimientos = getTableData('Movimientos', { excludeAnulados: true });

  const suma = {};
  movimientos.forEach(m => {
    if (hastaFecha && m.Fecha && m.Fecha > hastaFecha) return;
    suma[m.ID_Bolsillo] = (suma[m.ID_Bolsillo] || 0) + (Number(m.Valor) || 0);
  });

  const saldos = {};
  bolsillos.forEach(b => {
    saldos[b.ID_Bolsillo] = redondear2_((Number(b.Saldo_Apertura) || 0) + (suma[b.ID_Bolsillo] || 0));
  });
  return saldos;
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

  const resultado = cuentas.map(c => {
    const banco = bancos.find(b => b.ID_Banco === c.ID_Banco);
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
    if (c.Tipo === 'Ahorro') ahorro += saldo; else disponible += saldo;

    const tieneReal = c.Saldo_Real !== '' && c.Saldo_Real !== undefined && c.Saldo_Real !== null;
    return {
      ID_Cuenta: c.ID_Cuenta,
      Nombre: c.Nombre,
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
    total: redondear2_(disponible + ahorro)
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
  const cuentas = {};
  getTableData('Cuentas').forEach(c => {
    if (!estaActivo(c)) return;
    const saldo = redondear2_(porCuenta[c.ID_Cuenta] || 0);
    if (c.Tipo === 'Ahorro') ahorro += saldo; else disponible += saldo;
    const tieneReal = c.Saldo_Real !== '' && c.Saldo_Real !== undefined && c.Saldo_Real !== null;
    cuentas[c.ID_Cuenta] = {
      Saldo: saldo,
      Saldo_Real: tieneReal ? Number(c.Saldo_Real) : null,
      Fecha_Saldo_Real: c.Fecha_Saldo_Real || '',
      Diferencia: tieneReal ? redondear2_(Number(c.Saldo_Real) - saldo) : null
    };
  });

  return { bolsillos: saldos, cuentas: cuentas, disponible: redondear2_(disponible), ahorro: redondear2_(ahorro), total: redondear2_(disponible + ahorro) };
}
