// qcart-bloque · SIMULACIÓN — los caminos que el corte de hoy NO ejercita.
//
// Hoy los dos archivos ya están cargados: la próxima descarga traerá **eventos nuevos**, y ese
// camino no se ha ejecutado ni una vez con datos nuevos de verdad. En email-bloque fue exactamente ahí
// donde vivía el defecto de fondo, con once validaciones en verde.
//
// No re-implementa la lógica: escribe un CSV alterado en la carpeta vigente y corre **el qcart-bloque de
// verdad** contra él. Después restaura todo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), cp = require('child_process'), path = require('path');
var C = require(__dirname + '/lib-qcart.js');
var F = require(__dirname + '/lib-qcart-filtro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var DIR = PROY + '/ReportesQcart/_vigentes';
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function mil(n) { return Number(n).toLocaleString('es-MX'); }

console.log('════════ qcart-bloque · SIMULACIÓN DE LA PRÓXIMA DESCARGA ════════\n');

// ── respaldar el estado actual, para restaurarlo pase lo que pase ───────────────────
var BLOQUE = BACK + '/_fuentes/qcart.json';
var respaldoBloque = fs.readFileSync(BLOQUE, 'utf8');
var CARR = DIR + '/Fullcarritos-MarzoAgosto.csv';
var respaldoCsv = fs.readFileSync(CARR, 'utf8');
var antes = JSON.parse(respaldoBloque);
console.log('  estado actual: ' + mil(antes.carritos.length) + ' carritos · ' + mil(antes.productos.length) + ' productos');

function restaurar() {
  fs.writeFileSync(CARR, respaldoCsv, 'utf8');
  fs.writeFileSync(BLOQUE, respaldoBloque, 'utf8');
}
process.on('exit', restaurar);

try {
  // ── construir la "descarga nueva": el mismo archivo + 4 eventos ───────────────────
  var pad = F.padron();
  // un link NUESTRO y válido, para que pase el filtro
  var bueno = Object.keys(pad.links).filter(function (c) {
    return pad.links[c].valido && !pad.links[c].fecha_sospechosa &&
      antes.carritos.some(function (e) { return e.shortlink_code === c; });
  })[0];
  var act = pad.links[bueno].activacion;
  console.log('  link de prueba: ' + bueno + '  (activado ' + act + ')');

  var lineas = respaldoCsv.replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '').split(/\r?\n/);
  var modelo = lineas.filter(function (l) { return l.indexOf(bueno) >= 0; })[0];
  if (!modelo) throw new Error('no encontré una fila del link de prueba — no invento una');
  var campos = C.partir(modelo, ';');
  var cols = C.partir(lineas[0].replace(new RegExp('^' + String.fromCharCode(0xFEFF)), ''), ';').map(C.nmz);
  function fila(cambios) {
    var v = campos.slice();
    Object.keys(cambios).forEach(function (k) { var i = cols.indexOf(k); if (i >= 0) v[i] = cambios[k]; });
    return v.join(';');
  }

  var NUEVAS = [
    { d: 'evento NUEVO de un link nuestro, en ventana → debe ENTRAR',
      l: fila({ 'date': '2026-08-18T10:00:00', 'views': '7', 'impressions': '7', 'total shown price': '999,99' }) },
    { d: 'evento ANTERIOR a la activación del link → NO debe entrar',
      l: fila({ 'date': '2020-01-01T10:00:00', 'views': '5', 'impressions': '5' }) },
    { d: 'evento de un link AJENO → NO debe entrar',
      l: fila({ 'date': '2026-08-18T11:00:00', 'shortlink code': 'ZZajeno99', 'views': '3' }) },
    { d: 'evento REPETIDO (idéntico a uno ya cargado) → NO debe duplicar',
      l: modelo }
  ];
  var nuevoCsv = String.fromCharCode(0xFEFF) + lineas.join('\n') + '\n' + NUEVAS.map(function (x) { return x.l; }).join('\n') + '\n';
  fs.writeFileSync(CARR, nuevoCsv, 'utf8');
  console.log('  descarga simulada: +' + NUEVAS.length + ' filas en ' + path.basename(CARR) + '\n');

  // ── correr el qcart-bloque DE VERDAD ──────────────────────────────────────────────────────
  var salida = cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-qcart.qcart.js"', { encoding: 'utf8' });
  console.log(salida.split('\n').filter(function (l) { return /el append|ya estaban|cuadra:|entran de/.test(l); }).join('\n'));

  var desp = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  var ap = desp.auditoria.append.carritos;

  console.log('\n══ ¿qué entró de las 4? ══');
  NUEVAS.forEach(function (x) { console.log('   · ' + x.d); });
  console.log('\n   nuevos que el script aceptó: ' + ap.nuevos);
  chk('entra EXACTAMENTE el evento válido', ap.nuevos === 1,
    ap.nuevos + ' de 4 · el anterior a la activación, el ajeno y el repetido quedan fuera');

  var elNuevo = desp.carritos.filter(function (e) { return e.fecha === '2026-08-18'; })[0];
  chk('el evento nuevo trae sus métricas', !!elNuevo && elNuevo.views === 7 && elNuevo.total_shown_price === 999.99,
    elNuevo ? 'views ' + elNuevo.views + ' · precio ' + elNuevo.total_shown_price + ' (el «999,99» europeo se leyó bien)' : 'no entró');
  chk('el evento nuevo queda anclado a su pieza', !!elNuevo && !!elNuevo.pieza_id, elNuevo ? elNuevo.pieza_id : '');

  chk('el bloque creció exactamente en 1', desp.carritos.length === antes.carritos.length + 1,
    mil(antes.carritos.length) + ' → ' + mil(desp.carritos.length));
  chk('lo ya cargado no se tocó', ap.ya_estaban === antes.carritos.length,
    mil(ap.ya_estaban) + ' intactos · son logs, no un refresh');
  chk('el repetido se ignoró en vez de duplicar', ap.repetidos >= antes.carritos.length,
    mil(ap.repetidos) + ' repetidos descartados por su llave');

  var ajeno = desp.carritos.filter(function (e) { return e.shortlink_code === 'ZZajeno99'; });
  chk('el link ajeno NO entró', ajeno.length === 0, ajeno.length ? '🔴 entró' : 'fuera, como debe');
  var viejo = desp.carritos.filter(function (e) { return e.fecha === '2020-01-01'; });
  chk('el evento anterior a la activación NO entró', viejo.length === 0, viejo.length ? '🔴 entró' : 'fuera: la ventana se respeta');

  chk('el cuadre sigue en pie tras la carga', desp.auditoria.cuadre, 'filtro y append cuadran');

} finally {
  restaurar();
  var fin = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  console.log('\n══ ¿quedó todo como estaba? ══');
  chk('el CSV y el bloque quedaron restaurados',
    fin.carritos.length === antes.carritos.length && fs.readFileSync(CARR, 'utf8') === respaldoCsv,
    mil(fin.carritos.length) + ' carritos · archivo idéntico al original');
}

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' camino(s) rotos' : '✅ la próxima descarga se carga sola, sin duplicar ni colar lo ajeno'));
process.exit(fallo ? 1 : 0);
