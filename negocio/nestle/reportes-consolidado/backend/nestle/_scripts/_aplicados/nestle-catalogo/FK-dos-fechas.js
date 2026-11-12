// FK-dos-fechas.js — K1: separar la FECHA DE ENVÍO de la FECHA DE ACTIVACIÓN DEL LINK.
//
// 🔴 LA IDEA ES DE RICK (20-ago) y arregla de raíz algo que llevábamos parcheando:
//    «los catálogos necesitan tener la fecha de activación de Qcart y la fecha de envío por
//     separado, para que cuando Qcart mida pueda hacerlo desde la fecha que le toca».
//
//    Hoy el catálogo tiene UNA fecha (`Fecha_Primer_Envio`) que se usa para las dos cosas, y no
//    son la misma:
//      · el correo de Traditional Parents salió el **14-mar**, pero su shortlink se activó el
//        **13-mar** — un día ANTES;
//      · y la oleada de abril reusó la misma pieza con un link activado el **30-abr**.
//    Con una sola fecha, Qcart mide desde la del envío y arrastra carritos que no le tocan, o se
//    pierde los que sí. Con dos, cada medición arranca donde debe.
//
// 🔴 DE DÓNDE SALE CADA UNA, Y NO SE MEZCLAN NUNCA:
//      `Fecha_Primer_Envio`      ← SFMC (`min(SendDay)`). Es cuándo salió el correo.
//      `Fecha_Activacion_Qcart`  ← el bloque de Qcart (`activacion_link` del shortlink de la
//                                   pieza). Es desde cuándo ese link puede generar carritos.
//    Si una pieza no tiene Qcart, la segunda queda vacía — y eso es información, no un hueco.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ K1 · DOS FECHAS SEPARADAS ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fk.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS = Object.keys(P[0]);
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// ── la activación de cada pieza, desde el bloque de Qcart ──────────────────────────────────
// Una pieza puede tener VARIOS links; su activación es la del PRIMERO que se encendió, porque es
// desde ahí que la pieza puede generar carritos. Las demás se declaran, no se pierden.
var act = {};
Q.carritos.concat(Q.productos).forEach(function (c) {
  var p = t(c.pieza_id), a = t(c.activacion_link); if (!p || !a) return;
  act[p] = act[p] || { fechas: {}, codigos: {} };
  act[p].fechas[a] = 1;
  if (t(c.shortlink_code)) act[p].codigos[t(c.shortlink_code)] = 1;
});

var NUEVAS = ['Fecha_Activacion_Qcart', 'Activaciones_Qcart'].filter(function (c) { return COLS.indexOf(c) < 0; });
console.log('  columnas nuevas: ' + (NUEVAS.join(' · ') || '(ya existían)'));
var conAct = 0, varias = [];
var valores = P.map(function (p) {
  var id = t(p['Pieza_ID']), a = act[id];
  if (!a) return { Fecha_Activacion_Qcart: '', Activaciones_Qcart: '' };
  var fechas = Object.keys(a.fechas).sort();
  conAct++;
  if (fechas.length > 1) varias.push(id + ': ' + fechas.join(' · '));
  return {
    Fecha_Activacion_Qcart: fechas[0],
    // 🔴 si hay MÁS DE UNA activación, se declaran TODAS. Guardar solo la primera escondería que
    //    esa pieza tuvo dos oleadas — que es exactamente lo que nos costó encontrar.
    Activaciones_Qcart: fechas.join(' · ') + '  [' + Object.keys(a.codigos).length + ' código(s)]'
  };
});
console.log('\n  piezas con activación de Qcart: ' + conAct + '/' + P.length);
console.log('  con MÁS DE UNA activación: ' + varias.length);
varias.forEach(function (v) { console.log('     ' + v); });

// ── la comparación que justifica separar las fechas ────────────────────────────────────────
console.log('\n  ── envío vs activación: dónde difieren');
var difieren = 0;
P.forEach(function (p, i) {
  var env = t(p['Fecha_Primer_Envio']), ac = valores[i].Fecha_Activacion_Qcart;
  if (!env || !ac || env === ac) return;
  difieren++;
  if (difieren <= 10) {
    var d = Math.round((new Date(ac + 'T00:00:00Z') - new Date(env + 'T00:00:00Z')) / 86400000);
    console.log('     ' + t(p['Pieza_ID']) + '  envío ' + env + '  ·  activación ' + ac +
      '   (' + (d > 0 ? '+' : '') + d + ' días)');
  }
});
console.log('     → ' + difieren + ' piezas donde NO son la misma fecha' +
  (difieren ? '   🔴 con una sola fecha, Qcart medía desde la ventana equivocada' : ''));

if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FK-dos-fechas.js --escribir'); process.exit(0); }
if (!NUEVAS.length && !conAct) { console.log('\n  nada que escribir'); process.exit(0); }

// ── escribir ───────────────────────────────────────────────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var TODAS = COLS.concat(NUEVAS);
var estH = CX.estiloDe(xml, 'A1'), estD = CX.estiloDe(xml, 'A2');
NUEVAS.forEach(function (c) {
  var i = TODAS.indexOf(c);
  xml = CX.poner(xml, col(i) + '1', CX.celda(col(i) + '1', c, estH), 1).xml;
});
var escritas = 0;
P.forEach(function (p, r) {
  var nF = r + 2;
  ['Fecha_Activacion_Qcart', 'Activaciones_Qcart'].forEach(function (c) {
    var i = TODAS.indexOf(c); if (i < 0) return;
    var v = valores[r][c]; if (!v) return;
    xml = CX.poner(xml, col(i) + nF, CX.celda(col(i) + nF, v, estD), nF).xml;
    escritas++;
  });
});
xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + col(TODAS.length - 1) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var perdidas = COLS.filter(function (c) { return Object.keys(P2[0]).indexOf(c) < 0; });
console.log('\n  ── releído: ' + P2.length + ' piezas · ' + Object.keys(P2[0]).length + ' columnas (antes ' + COLS.length + ')');
console.log('     celdas escritas: ' + escritas + '   columnas perdidas: ' + (perdidas.length ? '🔴 ' + perdidas.join(' · ') : 'ninguna ✔'));
console.log('     con Fecha_Activacion_Qcart: ' + P2.filter(function (x) { return t(x['Fecha_Activacion_Qcart']); }).length);
if (perdidas.length || P2.length !== P.length) { console.log('  🔴 no se publica'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ las dos fechas, separadas y publicadas');
