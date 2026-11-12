/*
 * catalogo.cerrar-por-definir.js — aplica lo que `catalogo.que-puedo-cerrar.js` midió.
 *
 * POR QUÉ: Rick, 14-sep-2026: «Dale, cierra lo que puedas». Y dos frases suyas anteriores
 * gobiernan cómo: *«no debes de descuadrar ningún número que ya se haya calculado antes»* y *«lo
 * que ya se definió no se regresa a POR DEFINIR»*.
 *
 * 🔴 LA GUARDA QUE HACE ESTO SEGURO: **solo escribe donde la celda HOY dice POR DEFINIR o
 *    PENDIENTE**. Si dice cualquier otra cosa —un valor, un `N/A`, algo que Rick puso a mano— se
 *    salta y lo declara. Con esa sola condición este paso no puede pisar un dato, y por eso puede
 *    correr sin revisar 157 celdas una por una.
 *
 * 🔴 Y ESCRIBE DOS COSAS DISTINTAS, que no se mezclan:
 *      · un VALOR, cuando hay una fuente real que lo contesta (el maestro, el bloque)
 *      · `N/A`, cuando la celda NO APLICA — la pieza no lleva Qcart, o esa posición de receta no
 *        existe. Eso no es cerrar un hueco: es corregir una pregunta mal hecha. Dejarlas en POR
 *        DEFINIR infla la deuda con algo que nadie va a cerrar nunca.
 *
 * 🔴 NO DERIVA POR PARECIDO. Ninguna celda se llena heredándola de una pieza hermana; si la
 *    fuente no la contesta, se queda pendiente y se reporta de quién depende.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var COL = require(__dirname + '/lib-columna.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var PENDIENTE = /^(POR DEFINIR|PENDIENTE)$/i;
var GRUPOS = (function () {
  var i = process.argv.indexOf('--grupos');
  return i > 0 ? process.argv[i + 1].split(',') : ['QCART'];
})();

function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// ── lo que se va a aplicar, de la medición ──────────────────────────────────
var plan = [];
GRUPOS.forEach(function (g) {
  var f = BACK + '/_preescritura/que-puedo-cerrar-' + g + '.json';
  if (!fs.existsSync(f)) { console.log('🔴 falta la medición del grupo ' + g + ' — corre catalogo.que-puedo-cerrar.js --grupo ' + g); process.exit(1); }
  var d = JSON.parse(fs.readFileSync(f, 'utf8'));
  (d.si || []).forEach(function (x) {
    if (x.valor === undefined || x.valor === null || t(x.valor) === '') return;   // sin valor no se escribe
    plan.push({ grupo: g, id: x.id, col: x.col, valor: String(x.valor), tipo: 'valor', porque: x.fuente });
  });
  (d.na || []).forEach(function (x) {
    plan.push({ grupo: g, id: x.id, col: x.col, valor: 'N/A', tipo: 'na', porque: x.por });
  });
});

var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_cerrar.xlsx';
fs.copyFileSync(VIVO, TMP);
var wb = XLSX.readFile(TMP);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var enc = Object.keys(P[0]);
var colIdx = {}; enc.forEach(function (c, i) { colIdx[c] = i; });
var NM_ID = COL.de(P, 'Pieza' + '_ID', 'catalogo');
var filaDe = {};
P.forEach(function (p, i) { var id = t(p[NM_ID]); if (id) filaDe[id] = i + 2; });

console.log('════════ nestle-catalogo · CERRAR POR DEFINIR ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  grupos: ' + GRUPOS.join(' · ') + '   ·   celdas propuestas: ' + plan.length);

// ── la guarda: solo lo que HOY está pendiente ───────────────────────────────
var APLICAR = [], SALTADAS = [], SIN_COLUMNA = [], SIN_FILA = [];
plan.forEach(function (x) {
  if (colIdx[x.col] === undefined) { SIN_COLUMNA.push(x); return; }
  var nf = filaDe[x.id];
  if (!nf) { SIN_FILA.push(x); return; }
  var actual = t(P[nf - 2][x.col]);
  if (!PENDIENTE.test(actual)) { SALTADAS.push({ x: x, actual: actual || '(vacía)' }); return; }
  APLICAR.push({ x: x, fila: nf, de: actual });
});

console.log('\n  ── las guardas');
console.log('     ' + (SIN_COLUMNA.length ? '🔴 columnas que no existen: ' + SIN_COLUMNA.length : '✔ todas las columnas existen'));
console.log('     ' + (SIN_FILA.length ? '🔴 piezas que no están: ' + SIN_FILA.length : '✔ todas las piezas están'));
console.log('     ✔ se salta lo que NO está pendiente: ' + SALTADAS.length + ' celda(s)');
if (SALTADAS.length) {
  var porQ = {}; SALTADAS.forEach(function (s) { porQ[s.actual.slice(0, 28)] = (porQ[s.actual.slice(0, 28)] || 0) + 1; });
  Object.keys(porQ).sort(function (a, b) { return porQ[b] - porQ[a]; }).slice(0, 5)
    .forEach(function (k) { console.log('        ' + String(porQ[k]).padStart(4) + '  ya dice «' + k + '»'); });
}
if (SIN_COLUMNA.length || SIN_FILA.length) { console.log('\n  🔴 NO SE ESCRIBE.'); process.exit(1); }

var valores = APLICAR.filter(function (a) { return a.x.tipo === 'valor'; });
var naes = APLICAR.filter(function (a) { return a.x.tipo === 'na'; });
console.log('\n  ── lo que se va a escribir: ' + APLICAR.length + ' celda(s)');
console.log('     ' + valores.length + ' con un VALOR de su fuente');
console.log('     ' + naes.length + ' con N/A (la celda no aplica)');
var porCol = {};
APLICAR.forEach(function (a) { var k = a.x.col + ' · ' + a.x.tipo; porCol[k] = (porCol[k] || 0) + 1; });
Object.keys(porCol).sort(function (a, b) { return porCol[b] - porCol[a]; }).forEach(function (k) {
  console.log('        ' + String(porCol[k]).padStart(4) + '  ' + k);
});

fs.writeFileSync(BACK + '/_preescritura/PRE-cerrar-por-definir.json', JSON.stringify({
  cuando: new Date().toISOString(), grupos: GRUPOS, aplicar: APLICAR.length,
  celdas: APLICAR.map(function (a) { return { id: a.x.id, col: a.x.col, de: a.de, a: a.x.valor, porque: a.x.porque }; }),
  saltadas: SALTADAS.length
}, null, 1));
console.log('\n  → _preescritura/PRE-cerrar-por-definir.json');

if (!APLICAR.length) { console.log('\n  nada que escribir.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-cerrar-por-definir.xlsx';
fs.copyFileSync(VIVO, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mSheet = new RegExp('<sheet[^>]*name="Catalogo_Piezas"[^>]*r:id="([^"]+)"').exec(wbXml);
var mRel = mSheet ? new RegExp('Id="' + mSheet[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mRel ? 'xl/' + mRel[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

// 🔴 se escribe con `lib-celda-xml`, NUNCA con un regex a mano: el que se escribió a mano una vez
//    no distinguía una celda autocerrada (`<c r="P265"/>`, que es como queda una vacía) de una
//    abierta, y al «reemplazarla» se llevaba por delante las celdas siguientes de la fila.
var COMO = {};
APLICAR.forEach(function (a) {
  var ref = col(colIdx[a.x.col]) + a.fila;
  var r = CX.poner(xml, ref, CX.celda(ref, a.x.valor, CX.estiloDe(xml, ref)), a.fila);
  xml = r.xml;
  COMO[r.como] = (COMO[r.como] || 0) + 1;
});
console.log('     cómo quedó cada celda: ' + Object.keys(COMO).map(function (k) { return k + ' ' + COMO[k]; }).join(' · '));
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);

// ── las 5 capas ANTES de publicar ───────────────────────────────────────────
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
[['xlsx-safe-save', 'node', [T + 'xlsx-safe-save.js', TMP]],
 ['xlsx-label', 'node', [T + 'xlsx-label.js', TMP]],
 ['xlsx-check', 'node', [T + 'xlsx-check.js', TMP]],
 ['xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', TMP]],
 ['xlsx-orden-celdas', 'node', [T + 'xlsx-orden-celdas.js', TMP]]
].forEach(function (c) {
  try {
    var exe = c[1] === 'node' ? process.execPath : c[1];
    var o = cp.execFileSync(exe, c[2], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('     ✔ ' + c[0].padEnd(22) + String(o).split('\n').filter(Boolean).pop().slice(0, 74));
  } catch (e) { console.log('     🔴 ' + c[0] + ' — ' + String(e.message).slice(0, 110)); process.exit(1); }
});

fs.copyFileSync(TMP, VIVO);
console.log('     → publicado a ' + path.basename(VIVO));

// ── releer del disco y verificar por NOMBRE de columna (E4) ─────────────────
var wb2 = XLSX.readFile(VIVO);
var P2 = XLSX.utils.sheet_to_json(wb2.Sheets['Catalogo_Piezas'], { defval: '' });
var fila2 = {}; P2.forEach(function (p, i) { var id = t(p[NM_ID]); if (id) fila2[id] = p; });
var mal = APLICAR.filter(function (a) {
  var p = fila2[a.x.id];
  return !p || t(p[a.x.col]) !== t(a.x.valor);
});
console.log('\n  ── releído del disco');
console.log('     ' + (mal.length ? '🔴 ' + mal.length + ' celda(s) NO quedaron' : '✔ las ' + APLICAR.length + ' celdas quedaron, verificadas por nombre de columna'));
if (mal.length) mal.slice(0, 6).forEach(function (a) { console.log('        ' + a.x.id + ' · ' + a.x.col); });
var pendDespues = 0;
P2.forEach(function (p) { Object.keys(p).forEach(function (c) { if (PENDIENTE.test(t(p[c]))) pendDespues++; }); });
console.log('     POR DEFINIR en el catálogo: ' + pendDespues);
process.exit(mal.length ? 1 : 0);
