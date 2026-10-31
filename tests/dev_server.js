/**
 * Servidor de vista previa local. NO es parte de la app publicada.
 * Sirve index.html (con sus <?!= include() ?> resueltos) y ejecuta las funciones del backend
 * (.gs) sobre un Sheets simulado en memoria, para ver y probar la interfaz sin desplegar.
 *
 *   npm run vista            → base instalada y vacía
 *   npm run vista -- --demo  → con datos de demostración
 *   npm run vista -- --sin-instalar
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { crearEntorno } = require('./fake_gas');

const raiz = path.join(__dirname, '..');
const PUERTO = Number(process.env.PORT) || 5178;
const args = process.argv.slice(2);

function nuevoEntorno() {
  const e = crearEntorno({});
  e.cargar('Setup.gs', 'Repo.gs', 'Catalogos.gs', 'Saldos.gs', 'Movimientos.gs', 'Presupuesto.gs', 'Nomina.gs', 'Tarjetas.gs', 'Creditos.gs', 'Ahorro.gs', 'Regalos.gs', 'Anual.gs', 'Respaldos.gs', 'Vistas.gs', 'Recordatorios.gs', 'Suscripciones.gs', 'Arranque.gs', 'Demo.gs', 'Reinicio.gs', 'Logs.gs', 'Graficos.gs', 'TasasGoogle.gs', 'Api.gs');
  if (!args.includes('--sin-instalar')) e.ejecutar('setupDatabase()');
  if (args.includes('--demo')) e.ejecutar('sembrarDatosDemo()');
  return e;
}
let entorno = nuevoEntorno();

const SHIM = `<script>
(function () {
  function crear(ok, fail) {
    return new Proxy({}, { get: function (_, prop) {
      if (prop === 'withSuccessHandler') return function (f) { return crear(f, fail); };
      if (prop === 'withFailureHandler') return function (f) { return crear(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn: prop, args: args }) })
          .then(function (r) { return r.json(); })
          .then(function (r) { if (r.error) { fail && fail({ message: r.error }); } else { ok && ok(r.data); } })
          .catch(function (e) { fail && fail(e); });
      };
    } });
  }
  window.google = { script: { run: crear(null, null) } };
})();
</script>`;

function paginaIndex() {
  const incluir = nombre => fs.readFileSync(path.join(raiz, nombre + '.html'), 'utf8');
  let html = incluir('index').replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_, n) => (n === 'app_js' ? SHIM + incluir(n) : incluir(n)));
  return html;
}

const servidor = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(paginaIndex());
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/__reset')) {
    const conDemo = req.url.includes('demo=1');
    const sinInstalar = req.url.includes('sin=1');
    args.length = 0;
    if (conDemo) args.push('--demo');
    if (sinInstalar) args.push('--sin-instalar');
    entorno = nuevoEntorno();
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('reiniciado' + (conDemo ? ' con demo' : '') + (sinInstalar ? ' sin instalar' : ''));
    return;
  }

  if (req.method === 'POST' && req.url === '/rpc') {
    let cuerpo = '';
    req.on('data', d => { cuerpo += d; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      try {
        const { fn, args: a } = JSON.parse(cuerpo);
        if (!/^[A-Za-z_]\w*$/.test(fn)) throw new Error('Función no válida');
        entorno.ctx.__args = a;
        const r = entorno.ejecutar(fn + '(...__args)');
        res.end(JSON.stringify({ data: JSON.parse(JSON.stringify(r === undefined ? null : r)) }));
      } catch (e) {
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('No encontrado');
});

servidor.listen(PUERTO, () => console.log('Vista previa en http://localhost:' + PUERTO + (args.length ? '  (' + args.join(' ') + ')' : '')));
