// A6 · LA REGLA DE RICK, HECHA CHECK PERMANENTE.
//
//    «Todo lo que tiene link y fecha en Qcart Links debe tener atribución a alguna pieza. Todo.
//     Si no tiene fecha de salida o no está en las hojas de mes, no. Esos datos no son nuestros
//     o todavía no cuentan.»
//
// 🔴 SON DOS AFIRMACIONES, Y SE MIDEN POR SEPARADO:
//      1 · con link Y fecha  → TIENE que atribuir. Si uno no atribuye, es un hueco del catálogo.
//      2 · sin fecha         → NO cuenta. Si alguno se coló, es que una regla lo dejó pasar.
//    Un check que solo mirara la primera dejaría entrar tráfico ajeno sin decir nada.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var F = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-filtro.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(52) + e); c ? ok++ : mal++; }

console.log('════════ A6 · TODO LINK CON FECHA ATRIBUYE ════════\n');
var A = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8'));
var val = A.links_validos || {}, inv = A.links_invalidos || [];
var C = os.homedir() + '/_a6.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var codPieza = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { codPieza[c] = t(p[N('pieza_id')]); });
  });
});

// ── 1 · con link Y fecha → atribuye
console.log('══ 1 · los que TIENEN fecha deben atribuir ══');
var conFecha = Object.keys(val);
var sinPieza = conFecha.filter(function (c) { return !codPieza[c]; });
chk('todo link con fecha tiene pieza', sinPieza.length === 0,
  (conFecha.length - sinPieza.length) + '/' + conFecha.length + (sinPieza.length ? '   🔴 sin pieza: ' + sinPieza.join(' · ') : ''));
if (sinPieza.length) {
  console.log('\n      qué son los que faltan:');
  sinPieza.forEach(function (c) {
    var l = val[c];
    console.log('        ' + c.padEnd(14) + t(l.campana).padEnd(24) + t(l.fecha_activacion).padEnd(12) + t(l.receta).slice(0, 34) + '   hoja ' + t(l.hoja));
  });
}

// ── 2 · sin fecha → NO cuenta
console.log('\n══ 2 · los que NO tienen fecha no pueden estar en el bloque ══');
var QJ = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var sinFecha = {};
inv.forEach(function (x) { sinFecha[t(x.codigo)] = t(x.valor_de_fecha); });
var colados = (QJ.carritos || []).concat(QJ.productos || [])
  .filter(function (e) { return sinFecha[t(e.shortlink_code)] !== undefined; });
chk('ningún evento de un link sin fecha está cargado', colados.length === 0,
  colados.length ? '🔴 ' + mil(colados.length) + ' colado(s)' : mil((QJ.carritos || []).length + (QJ.productos || []).length) + ' eventos, ninguno');
if (colados.length) {
  var pc = {};
  colados.forEach(function (e) { var k = t(e.shortlink_code) + ' («' + sinFecha[t(e.shortlink_code)] + '»)'; pc[k] = (pc[k] || 0) + 1; });
  Object.keys(pc).slice(0, 8).forEach(function (k) { console.log('        ' + String(pc[k]).padStart(5) + '  ' + k); });
}

// ── 3 · y el catálogo no puede declarar códigos que el padrón no conoce
console.log('\n══ 3 · el catálogo contra el padrón ══');
var enPadron = {};
conFecha.forEach(function (c) { enPadron[c] = 1; });
inv.forEach(function (x) { enPadron[t(x.codigo)] = 1; });
var inventados = Object.keys(codPieza).filter(function (c) { return !enPadron[c]; });
chk('todo código del catálogo está en Qcart-Links', inventados.length === 0,
  inventados.length ? '🔴 ' + inventados.length + ': ' + inventados.slice(0, 6).join(' · ') : Object.keys(codPieza).length + ' códigos');
if (inventados.length) {
  console.log('\n      🔴 estos códigos están en el catálogo pero NO en la autoridad de links.');
  console.log('         O se agregan a `Qcart-Links Mails-Hive-MX.xlsx`, o salen del catálogo.');
  inventados.forEach(function (c) { console.log('        ' + c.padEnd(14) + '→ pieza ' + codPieza[c]); });
}

// ── 4 · el reparto de eventos, para leer el resultado
console.log('\n══ 4 · dónde quedó cada evento ══');
var lec = require(BACK + '/_scripts/lib-qcart.js').leerVigentes(PROY + '/ReportesQcart/_vigentes');
var pad = F.padron();
['carritos', 'productos'].forEach(function (k) {
  var res = F.aplicar(lec[k] || [], pad, codPieza);
  var r = res.resumen;
  console.log('   ' + k.padEnd(11) + 'de ' + mil(r.total) + ':  dentro ' + mil(r.dentro) +
    '  ·  ajenos ' + mil(r.fuera_no_es_nuestro) + '  ·  sin fecha de salida ' + mil(r.fuera_link_invalido) +
    '  ·  antes de activar ' + mil(r.fuera_antes_de_activacion) + '  ·  sin código ' + mil(r.fuera_sin_codigo) +
    '   ' + (r.cuadra ? '✔ cuadra' : '🔴 NO cuadra'));
});

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ LA REGLA SE CUMPLE') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
