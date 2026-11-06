/**
 * Producción: nada de datos de demostración, ni el generador ni la posibilidad de crearlos.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = function (prueba, assert, crearEntorno) {
  const raiz = path.join(__dirname, '..');
  const plano = x => JSON.parse(JSON.stringify(x));

  const armar = entorno => execFileSync('bash', [path.join(raiz, 'scripts', 'publicar.sh'), entorno, '--armar'], { encoding: 'utf8' }).trim();
  /** Carga los .gs de una carpeta cualquiera (el paquete armado) en un entorno simulado. */
  function entornoDePaquete(carpeta, demoHabilitado) {
    const e = crearEntorno({});
    const vm = require('vm');
    fs.readdirSync(carpeta).filter(f => f.endsWith('.gs')).sort().forEach(f => {
      vm.runInContext(fs.readFileSync(path.join(carpeta, f), 'utf8'), e.ctx, { filename: f });
    });
    if (demoHabilitado) e.propiedades.DEMO_HABILITADO = 'TRUE'; else delete e.propiedades.DEMO_HABILITADO;
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.falla = (fn, ...args) => { e.ctx.__args = args; return () => e.ejecutar(fn + '(...__args)'); };
    return e;
  }

  prueba('producción: el paquete no lleva el generador de datos de demostración (solo un archivo vacío que falla)', () => {
    const carpeta = armar('produccion');
    try {
      const demo = fs.readFileSync(path.join(carpeta, 'Demo.gs'), 'utf8');
      assert.strictEqual(demo, fs.readFileSync(path.join(raiz, 'scripts', 'stubs', 'Demo.gs'), 'utf8'));
      assert.ok(!/demo-(ban|cta|bol|tar|cre|mov|reg|sus|ing)/.test(demo));
      // Ningún archivo del paquete trae datos de ejemplo
      fs.readdirSync(carpeta).filter(f => /\.(gs|html)$/.test(f)).forEach(f => {
        const t = fs.readFileSync(path.join(carpeta, f), 'utf8');
        assert.ok(!/Banco Cumbre|Billetera Aurora|Banco Brisa|Tarjeta Azul \(demo\)/.test(t), f + ' trae datos de demostración');
      });
      // Solo lo que Apps Script necesita (nada de pruebas, docs ni credenciales)
      const extra = fs.readdirSync(carpeta).filter(f => !/\.(gs|html)$/.test(f) && f !== 'appsscript.json');
      assert.deepStrictEqual(extra, []);

      // El paquete carga completo y no se puede sembrar nada, aunque se intente
      const e = entornoDePaquete(carpeta, false);
      e.llamar('setupDatabase');
      assert.strictEqual(e.llamar('seedDemo').ok, false);
      assert.ok(/no están disponibles/.test(e.llamar('seedDemo').error.message));
      assert.strictEqual(e.llamar('getTableData', 'Bancos').length, 0, 'no se creó nada');
      assert.strictEqual(e.llamar('getBootstrap').data.demoHabilitado, false);
    } finally { fs.rmSync(carpeta, { recursive: true, force: true }); }
  });

  prueba('desarrollo: el paquete sí lleva el generador y solo funciona con DEMO_HABILITADO', () => {
    const carpeta = armar('desarrollo');
    try {
      assert.ok(/demo-ban-1/.test(fs.readFileSync(path.join(carpeta, 'Demo.gs'), 'utf8')));
      const apagado = entornoDePaquete(carpeta, false);
      apagado.llamar('setupDatabase');
      assert.strictEqual(apagado.llamar('seedDemo').ok, false, 'sin la propiedad, ni siquiera el código de desarrollo siembra');
      assert.strictEqual(apagado.llamar('getTableData', 'Bancos').length, 0);

      const encendido = entornoDePaquete(carpeta, true);
      encendido.llamar('setupDatabase');
      assert.strictEqual(encendido.llamar('seedDemo').ok, true);
      assert.strictEqual(encendido.llamar('getBootstrap').data.demoHabilitado, true);
    } finally { fs.rmSync(carpeta, { recursive: true, force: true }); }
  });

  prueba('una persona nueva: el año activo es el actual y no hay nada de otra persona', () => {
    const e = crearEntorno({});
    e.cargar(...fs.readdirSync(raiz).filter(f => f.endsWith('.gs')).sort());
    e.llamar = (fn, ...args) => { e.ctx.__args = args; return plano(e.ejecutar(fn + '(...__args)')); };
    e.llamar('setupDatabase');
    const cfg = {}; e.llamar('getTableData', 'Config').forEach(c => { cfg[c.Clave] = c.Valor; });
    assert.strictEqual(cfg.Anio_Activo, String(new Date(Date.now() - 5 * 3600000).getUTCFullYear()));
    assert.strictEqual(cfg.Nombre_Usuario, '');
    assert.strictEqual(e.llamar('getTableData', 'Cuentas').length + e.llamar('getTableData', 'Bancos').length + e.llamar('getTableData', 'Movimientos').length, 0);
  });
};
