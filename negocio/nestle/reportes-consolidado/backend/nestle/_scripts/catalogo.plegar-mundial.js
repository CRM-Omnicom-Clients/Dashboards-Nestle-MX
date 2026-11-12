/*
 * catalogo.plegar-mundial.js — PASO 1 DE 2: pliega las declaraciones por segmento de Mundial
 * dentro de la `Notas` de su pieza combinada. NO borra ninguna fila — eso es el paso 2.
 *
 * 🔴 E3 · «Fusionar antes de retirar, SIEMPRE». Este es el fusionar. Si se retirara primero, el
 *    hecho de que el doc de links declaró esas audiencias desaparecería sin dejar rastro, y la
 *    única copia estaría en un informe que nadie lee.
 *
 * Rick, 22-sep-2026: «solo deja las piezas que son, si está en 0 no va». La pieza es el PARTIDO
 * —la fuente de WhatsApp da el total del partido y no lo reparte por audiencia— así que una fila
 * por segmento en 0 no es una pieza: es una declaración que nunca se materializó como envío.
 *
 * 🔴 LO QUE ESTE PASO NO HACE, A PROPÓSITO: no mete «Modern Cooking» ni «Activos» en el
 *    `Segmento` de la combinada. Eso AFIRMARÍA que esos 162 envíos llegaron a esas audiencias, y
 *    ninguna fuente lo dice. Una audiencia PLANEADA no es una audiencia ALCANZADA. La declaración
 *    se registra como lo que es: una declaración.
 *
 * 🔴 Y LA NOTA SE AGREGA, NO SE PISA. Rick escribe en `Notas` a mano. Se lee lo que hay, se le
 *    añade al final, y si el texto ya está no se vuelve a escribir (idempotente).
 *
 *   node catalogo.plegar-mundial.js              seco
 *   node catalogo.plegar-mundial.js --escribir    escribe + las 5 capas
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var DECL = require(BACK + '/_scripts/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var HOJA = 'Catalogo_Piezas';
var AMBITO = 'catalogo';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var PAREJAS = [
  { combinada: '004-P010', porSegmento: ['004-P011', '004-P012'], partido: 'Partido 2' },
  { combinada: '004-P013', porSegmento: ['004-P014', '004-P015', '004-P016'], partido: 'Partido 3' }
];

DECL.declarar('nestle-catalogo', 'catalogo.plegar-mundial.js', [{
  hoja: HOJA, grano: 'una PIEZA (una fila)',
  llave: 'Pieza_ID',
  celdas_esperadas: '2 celdas de Notas (004-P010 y 004-P013); ninguna otra columna se toca'
}]);

console.log('════ nestle-catalogo · PLEGAR las declaraciones de Mundial ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

var TMP = BACK + '/_tmp/_plegar-mundial.xlsx';
fs.copyFileSync(VIVO, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
var C = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
function N(id) { return COL.de(C, id, AMBITO); }
var nID = N('Pieza_ID'), nSEG = N('Segmento'), nSENDS = N('Sends');
var iID = enc.indexOf(nID), iNOTAS = enc.indexOf('Notas');
if (iID < 0 || iNOTAS < 0) { console.log('🔴 no resolví las columnas (Pieza_ID=' + iID + ' Notas=' + iNOTAS + ')'); process.exit(1); }

/* 🔴 LA FILA SE BUSCA EN LA HOJA POR SU ID, nunca índice+2: el catálogo no es contiguo y esa
 *    cuenta escribió una vez en una fila que no era, con las 5 capas en verde encima. */
var filaDe = {};
for (var r0 = 1; r0 <= rng.e.r; r0++) {
  var cc = ws[XLSX.utils.encode_cell({ r: r0, c: iID })];
  if (cc && t(cc.v)) filaDe[t(cc.v)] = r0 + 1;
}

var APLICAR = [];
PAREJAS.forEach(function (par) {
  var comb = C.filter(function (p) { return t(p[nID]) === par.combinada; })[0];
  if (!comb) { console.log('🔴 no existe la combinada ' + par.combinada); process.exit(1); }
  var hijas = par.porSegmento.map(function (id) {
    return C.filter(function (p) { return t(p[nID]) === id; })[0];
  }).filter(Boolean);
  if (!hijas.length) { console.log('  ' + par.partido + ': ya no quedan declaraciones por plegar'); return; }

  /* solo se pliega lo que NO tiene envío propio: si una tuviera envíos sería una pieza de verdad
     y plegarla perdería datos — eso lo prueba P1, y aquí se vuelve a exigir */
  var conEnvio = hijas.filter(function (h) { return t(h[nSENDS]) && !/^(0|N\/A|POR DEFINIR|PENDIENTE)$/i.test(t(h[nSENDS])); });
  if (conEnvio.length) {
    console.log('🔴 ' + conEnvio.map(function (h) { return t(h[nID]); }).join(', ') + ' TIENEN envíos. No se pliega nada.');
    process.exit(1);
  }

  var lista = hijas.map(function (h) { return t(h[nID]) + ' «' + t(h[nSEG]) + '»'; }).join(' · ');
  var marca = 'declaraciones plegadas (22-sep-2026, sin envío propio, la pieza es el partido): ' + lista;
  var actual = t(comb['Notas']);
  console.log('── ' + par.partido + '  ·  ' + par.combinada + '   (' + t(comb[nSENDS]) + ' envíos)');
  console.log('     Notas AHORA: «' + actual + '»');
  if (actual.indexOf(marca) >= 0) { console.log('     ✔ ya está plegado — nada que escribir'); return; }
  var nueva = actual && !/^(N\/A|POR DEFINIR)$/i.test(actual) ? actual + ' · ' + marca : marca;
  console.log('     Notas QUEDA: «' + nueva + '»');
  APLICAR.push({ id: par.combinada, fila: filaDe[par.combinada], valor: nueva });
});

if (!APLICAR.length) { console.log('\n  ✔ nada que plegar. Sigue: catalogo.probar-mundial-por-segmento.js'); process.exit(0); }
console.log('\n  celdas a escribir: ' + APLICAR.length + '   ·   ' + APLICAR.map(function (a) { return a.id + ' → Notas f' + a.fila; }).join(' · '));
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ ESCRITURA ════════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-plegar-mundial.xlsx';
fs.copyFileSync(VIVO, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mSheet = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mRel = mSheet ? new RegExp('Id="' + mSheet[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mRel ? 'xl/' + mRel[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

var COMO = {};
APLICAR.forEach(function (a) {
  var ref = col(iNOTAS) + a.fila;
  var r = CX.poner(xml, ref, CX.celda(ref, a.valor, CX.estiloDe(xml, ref)), a.fila);
  xml = r.xml;
  COMO[r.como] = (COMO[r.como] || 0) + 1;
  console.log('     ' + ref + ' (' + a.id + ') → ' + r.como);
});
/* 🔴 `sin fila` significa que NO se escribió nada y el script no truena: una fila autocerrada
 *    (`<row r="24"/>`) existe pero no admite celdas. Se comprueba el `como`, no la ausencia de error. */
if (COMO['sin fila']) { console.log('\n  🔴 ' + COMO['sin fila'] + ' celda(s) no se escribieron (fila autocerrada). NO se publica.'); process.exit(1); }
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);

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
    console.log('     ✔ ' + c[0].padEnd(22) + String(o).split('\n').filter(Boolean).pop().slice(0, 70));
  } catch (e) { console.log('     🔴 ' + c[0] + ' — ' + String(e.message).slice(0, 110)); process.exit(1); }
});

fs.copyFileSync(TMP, VIVO);
console.log('     → publicado a ' + path.basename(VIVO));

// ── E4 · releer del DISCO y verificar por NOMBRE de columna ──────────────────────────
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(VIVO).Sheets[HOJA], { defval: '' });
var mal = APLICAR.filter(function (a) {
  var p = P2.filter(function (q) { return t(q[nID]) === a.id; })[0];
  return !p || t(p['Notas']) !== t(a.valor);
});
console.log('\n  ── verificación (releído del disco)');
console.log('     filas: ' + C.length + ' → ' + P2.length + (C.length === P2.length ? '  ✔ ninguna fila se movió' : '  🔴 CAMBIÓ el conteo'));
if (mal.length) { console.log('     🔴 no quedaron: ' + mal.map(function (a) { return a.id; }).join(', ')); process.exit(1); }
console.log('     ✔ las ' + APLICAR.length + ' notas dicen exactamente lo que se pidió');
console.log('\n  ✅ PLEGADO. Sigue: catalogo.probar-mundial-por-segmento.js (debe dar 5/5) y luego el retiro.');
