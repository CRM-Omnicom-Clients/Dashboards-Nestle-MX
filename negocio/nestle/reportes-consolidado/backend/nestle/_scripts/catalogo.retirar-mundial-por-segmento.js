/*
 * catalogo.retirar-mundial-por-segmento.js — PASO 2 DE 2: retira del catálogo las declaraciones
 * por segmento de Mundial que nunca fueron un envío.
 *
 * Rick, 22-sep-2026: «solo deja las piezas que son, si está en 0 no va, no es lógico con lo que
 * acabamos de decir». La pieza es el PARTIDO: la fuente de WhatsApp entrega el total del partido
 * y no lo reparte por audiencia, así que una fila por segmento en 0 no es una pieza.
 *
 * 🔴 LA CONDICIÓN DE ENTRADA ES EL VEREDICTO DE LAS 5 PRUEBAS, no mi lectura de hace un minuto.
 *    Y antes que él, el PLEGADO: `catalogo.plegar-mundial.js` tuvo que dejar la declaración
 *    registrada en la `Notas` de la combinada — es lo que hace pasar P3. Si alguien corre esto
 *    sin plegar, P3 está en rojo y el script se niega. E3: fusionar antes de retirar, siempre.
 *
 * 🔴 Y SE SINCRONIZA `_catalogo/catalogo.json` EN EL MISMO ACTO. Lo lee `catalogo.prueba-anclas.js`
 *    —que tiene turno en la cadena— para cruzar JSON ↔ Excel ↔ registro de ids. Sacar la fila del
 *    Excel y dejarla en el JSON descuadra el ancla y la prueba lo reporta como pieza perdida. P5
 *    lo clasifica como «SINCRONIZAR» justamente para que este paso esté obligado a hacerlo.
 *
 * 🔴 LO QUE NO SE TOCA: `_catalogo/registro-ids.json`. Es APPEND-ONLY por doctrina —«un id
 *    liberado NUNCA se reutiliza»—. Los 5 ids se quedan reservados ahí para siempre, y eso es
 *    lo correcto: así nadie los vuelve a asignar a otra cosa.
 *
 *   node catalogo.retirar-mundial-por-segmento.js              seco
 *   node catalogo.retirar-mundial-por-segmento.js --escribir    escribe + las 5 capas
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var DECL = require(BACK + '/_scripts/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var HOJA = 'Catalogo_Piezas';
var AMBITO = 'catalogo';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var NL = String.fromCharCode(10);

// ── la condición de entrada: las 5 pruebas, en verde, sobre las que existan hoy ──────
var VER = BACK + '/_preescritura/probar-mundial-por-segmento.json';
if (!fs.existsSync(VER)) { console.log('🔴 falta la prueba. Corre antes: catalogo.probar-mundial-por-segmento.js'); process.exit(1); }
var prueba = JSON.parse(fs.readFileSync(VER, 'utf8'));
var noVerdes = (prueba.veredicto || []).filter(function (v) { return !v.plegable; });
if (noVerdes.length) {
  console.log('🔴 hay ' + noVerdes.length + ' pieza(s) que NO pasan las 5 pruebas. No se toca nada:');
  noVerdes.forEach(function (v) {
    console.log('   · ' + v.id + ' (' + v.segmento + ')');
    v.pruebas.filter(function (p) { return !p.pasa; }).forEach(function (p) { console.log('       🔴 ' + p.prueba + ' — ' + p.detalle); });
  });
  process.exit(1);
}
var A_RETIRAR = (prueba.veredicto || []).map(function (v) { return v.id; });
if (!A_RETIRAR.length) { console.log('  ✔ el veredicto no lista ninguna pieza. Nada que retirar.'); process.exit(0); }
if (A_RETIRAR.length > 5) { console.log('🔴 el veredicto lista ' + A_RETIRAR.length + ' piezas y esperaba como máximo 5. No se toca nada.'); process.exit(1); }

DECL.declarar('nestle-catalogo', 'catalogo.retirar-mundial-por-segmento.js', [{
  hoja: HOJA, grano: 'una FILA entera',
  llave: 'Pieza_ID',
  celdas_esperadas: A_RETIRAR.length + ' filas retiradas; TODAS las demás verificadas celda por celda antes de publicar'
}]);

console.log('════ nestle-catalogo · RETIRAR las declaraciones por segmento de Mundial ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════' + NL);
console.log('  las 5 pruebas: ✅ verde para las ' + A_RETIRAR.length + ' (' + String(prueba.fecha) + ')');
console.log('  a retirar: ' + A_RETIRAR.join(' · '));
var SINC = prueba.a_sincronizar || {};
var archivosSinc = {};
Object.keys(SINC).forEach(function (id) { (SINC[id] || []).forEach(function (s) { archivosSinc[String(s).split(' ')[0]] = 1; }); });
console.log('  a sincronizar: ' + (Object.keys(archivosSinc).join(' · ') || '(ninguno)') + NL);

var TMP = BACK + '/_tmp/_retirar-mundial.xlsx';
fs.copyFileSync(VIVO, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
var P = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nID = COL.de(P, 'Pieza_ID', AMBITO);
var iID = enc.indexOf(nID);
if (iID < 0) { console.log('🔴 no resolví la columna del id'); process.exit(1); }

// qué FILA del XML es cada una — por su id en la hoja, nunca por índice
var fuera = [], dentro = [];
for (var r0 = 1; r0 <= rng.e.r; r0++) {
  var cP = ws[XLSX.utils.encode_cell({ r: r0, c: iID })];
  var id = cP ? t(cP.v) : '';
  if (A_RETIRAR.indexOf(id) >= 0) fuera.push({ fila: r0 + 1, id: id }); else dentro.push(r0 + 1);
}
console.log('  filas: ' + rng.e.r + '   ·   se van ' + fuera.length + '   ·   se quedan ' + dentro.length);
console.log('     ' + fuera.map(function (x) { return x.id + ' (f' + x.fila + ')'; }).join(' · '));
if (fuera.length !== A_RETIRAR.length) {
  console.log(NL + '  🔴 el veredicto lista ' + A_RETIRAR.length + ' y en la hoja encontré ' + fuera.length + '. NO se toca nada.');
  process.exit(1);
}

/* 🔴 LA FOTO DE CONTROL: cada fila que se queda, identificada por su id (no por su número de
 *    fila, que va a cambiar), con TODAS sus celdas. Es contra esto que se verifica después. */
var antes = {};
dentro.forEach(function (nf) {
  var c2 = ws[XLSX.utils.encode_cell({ r: nf - 1, c: iID })];
  var id2 = c2 ? t(c2.v) : ('(fila ' + nf + ')');
  var fila = {};
  for (var c1 = rng.s.c; c1 <= rng.e.c; c1++) {
    var cc = ws[XLSX.utils.encode_cell({ r: nf - 1, c: c1 })];
    if (enc[c1]) fila[enc[c1]] = cc ? t(cc.v) : '';
  }
  antes[id2] = fila;
});
console.log('  foto de control: ' + Object.keys(antes).length + ' filas × ' + enc.filter(Boolean).length + ' columnas');

// suma independiente de Sends: retirar 5 filas en 0 NO puede mover el total
var nSENDS = COL.de(P, 'Sends', AMBITO);
var num = function (v) { var x = Number(t(v).replace(/[,$%\s]/g, '')); return isFinite(x) ? x : 0; };
var sendsAntes = P.reduce(function (s, p) { return s + num(p[nSENDS]); }, 0);
console.log('  Σ Sends antes: ' + sendsAntes.toLocaleString());
if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ ESCRITURA ════════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-retirar-mundial.xlsx';
fs.copyFileSync(VIVO, RESP);
console.log(NL + '  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);
var quitar = {}; fuera.forEach(function (x) { quitar[x.fila] = 1; });

var filas = [];
xml.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, function (todo, nr, attrs, dentroXml) {
  filas.push({ n: +nr, attrs: attrs, dentro: dentroXml });
  return todo;
});
/* 🔴 LAS FILAS DE ABAJO SE RENUMERAN. Una fila con r="127" que se queda en la posición 121 y
 *    cuyas celdas siguen diciendo A127 es exactamente el paquete que Excel se niega a abrir. */
var nuevo = 0;
var cuerpo = filas.filter(function (f) { return !quitar[f.n]; }).map(function (f) {
  nuevo++;
  var dn = f.dentro.replace(/<c r="([A-Z]+)\d+"/g, function (_, L2) { return '<c r="' + L2 + nuevo + '"'; });
  return '<row r="' + nuevo + '"' + String(f.attrs).replace(/ spans="[^"]*"/, '') + '>' + dn + '</row>';
}).join('');
xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + cuerpo + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + nuevo + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ hoja reconstruida: ' + filas.length + ' → ' + nuevo + ' filas, renumeradas');

console.log(NL + '  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
function capa(nom, cmd, args) {
  try {
    var rr = cp.execFileSync(cmd === 'node' ? process.execPath : cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(22) + (t(rr).split(NL).filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 62)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(22) + t(String(e.stdout || e.message)).split(NL).pop().slice(0, 62)); return false; }
}
if (!capa('xlsx-safe-save', 'node', [T + 'xlsx-safe-save.js', TMP])) { console.log(NL + '  🔴 paquete no sano: NO se publica.'); process.exit(1); }

// ══ VERIFICAR ANTES DE PUBLICAR ══════════════════════════════════════════════════════
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets[HOJA], { defval: '', blankrows: false });
var mal = [];
Object.keys(antes).forEach(function (id) {
  if (!/^\d{3}-[JP]\d{3}$/.test(id)) return;
  var f2 = P2.filter(function (q) { return t(q[nID]) === id; })[0];
  if (!f2) { mal.push(id + ': DESAPARECIÓ'); return; }
  var difs = [];
  Object.keys(antes[id]).forEach(function (h) { if (t(f2[h]) !== antes[id][h]) difs.push(h); });
  if (difs.length) mal.push(id + ': cambiaron ' + difs.slice(0, 3).join(', '));
});
fuera.forEach(function (x) { if (P2.filter(function (q) { return t(q[nID]) === x.id; }).length) mal.push(x.id + ': SIGUE en la hoja'); });
var sendsDespues = P2.reduce(function (s, p) { return s + num(p[nSENDS]); }, 0);
if (sendsDespues !== sendsAntes) mal.push('Σ Sends se movió: ' + sendsAntes + ' → ' + sendsDespues);

console.log(NL + '  ── verificación ANTES de publicar');
console.log('     filas: ' + P.length + ' → ' + P2.length);
console.log('     Σ Sends: ' + sendsAntes.toLocaleString() + ' → ' + sendsDespues.toLocaleString() + (sendsDespues === sendsAntes ? '  ✔ no se movió' : '  🔴 SE MOVIÓ'));
console.log('     ' + (mal.length ? '🔴 ' + mal.length + ': ' + mal.slice(0, 5).join(' · ')
  : '✔ las ' + Object.keys(antes).filter(function (k) { return /^\d{3}-[JP]\d{3}$/.test(k); }).length + ' piezas que se quedan dicen EXACTAMENTE lo mismo, celda por celda'));
if (mal.length) { console.log(NL + '  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, VIVO);
console.log('     → publicado a ' + path.basename(VIVO));
capa('xlsx-label', 'node', [T + 'xlsx-label.js', VIVO]);
capa('xlsx-check', 'node', [T + 'xlsx-check.js', VIVO]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', VIVO]);
capa('xlsx-orden-celdas', 'node', [T + 'xlsx-orden-celdas.js', VIVO]);

// ══ SINCRONIZAR catalogo.json EN EL MISMO ACTO ═══════════════════════════════════════
console.log(NL + '  ── sincronizar el JSON que la cadena cruza contra el Excel');
var RJ = BACK + '/_catalogo/catalogo.json';
if (fs.existsSync(RJ)) {
  fs.copyFileSync(RJ, BACK + '/_respaldos/catalogo.json.antes-retirar-mundial');
  var J = JSON.parse(fs.readFileSync(RJ, 'utf8'));
  var n0 = (J.piezas || []).length;
  J.piezas = (J.piezas || []).filter(function (p) { return A_RETIRAR.indexOf(t(p.pieza_id)) < 0; });
  var n1 = J.piezas.length;
  fs.writeFileSync(RJ, JSON.stringify(J, null, 1), 'utf8');
  var rel = JSON.parse(fs.readFileSync(RJ, 'utf8'));                       // releer y comprobar
  var quedan = A_RETIRAR.filter(function (id) { return (rel.piezas || []).some(function (p) { return t(p.pieza_id) === id; }); });
  console.log('     _catalogo/catalogo.json · piezas ' + n0 + ' → ' + n1 + (quedan.length ? '  🔴 siguen: ' + quedan.join(', ') : '  ✔ ninguna de las ' + A_RETIRAR.length + ' quedó'));
  if (quedan.length) process.exit(1);
} else { console.log('     ⚠ no existe _catalogo/catalogo.json — nada que sincronizar'); }
console.log('     _catalogo/registro-ids.json · NO se toca (append-only: los ' + A_RETIRAR.length + ' ids quedan reservados)');

console.log(NL + '  ✅ ' + fuera.length + ' FILAS RETIRADAS · las demás verificadas celda por celda · Σ Sends intacta');
console.log('  ⚠ el roster `Catalogo_Referencias.Pieza_IDs` lo reconstruye `escritor.cierre.js` en el próximo cierre.');
