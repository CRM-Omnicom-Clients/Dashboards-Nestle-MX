// nestle-catalogo · LLENAR LOS HUECOS DEL CATÁLOGO CON LO QUE SFMC SÍ TIENE.
//
// 🔴 LO QUE PIDIÓ RICK, LITERAL: «hay muchos datos que son de campaña, de marca, de fecha de envío
//    y todo eso, que no estaban llenos, pero que sí los tienes, porque si no no se llenarían los
//    datos». Es exactamente así: la pieza cruza con SFMC, así que su fecha y su asunto están del
//    otro lado — y la celda decía POR DEFINIR.
//
// 🔴 SOLO ESCRIBE EN UN HUECO. Nunca pisa un valor. Si la celda tiene un número y SFMC trae otro,
//    eso no es un hueco: es una discrepancia, y se DECLARA en vez de resolverse a escondidas.
//
// 🔴 Y SOLO USA MAPEOS APROBADOS. El mapeo vive en `lib-mapeo-sfmc` y lo prueba
//    `catalogo.probar-mapeo-sfmc.js` contra las piezas donde los dos lados ya tienen valor. Un
//    mapeo que no pasa esa prueba NO llena nada — así se quedó fuera `Content_ID ← ConfigKey`,
//    que habría escrito ids de pieza (`001-P001`) en una columna de ids de contenido.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var HOJA = 'Catalogo_Piezas';

// 🔴 EL VEREDICTO DEL PROBADOR ES LA CONDICIÓN DE ENTRADA, no una sugerencia. Si el probador no
//    corrió o quedó viejo, este paso NO escribe: prefiere no llenar a llenar con un mapeo sin
//    probar. Un mapeo aprobado hace dos semanas contra otro volcado no es un mapeo aprobado.
var VER = BACK + '/_preescritura/mapeo-sfmc.json';
if (!fs.existsSync(VER)) { console.log('🔴 falta la prueba del mapeo. Corre antes: catalogo.probar-mapeo-sfmc.js'); process.exit(1); }
var prueba = JSON.parse(fs.readFileSync(VER, 'utf8'));
var aprobado = {}; prueba.mapeos.forEach(function (x) { if (x.veredicto === 'SIRVE') aprobado[x.hoja] = x; });

DECL.declarar('nestle-catalogo', 'catalogo.llenar-desde-sfmc.js', [{
  hoja: HOJA,
  grano: 'una CELDA — pieza × columna, solo si la celda es un hueco',
  llave: 'Pieza_ID + nombre de columna',
  celdas_esperadas: 'los huecos de las columnas cuyo mapeo pasó `catalogo.probar-mapeo-sfmc.js`'
}]);

console.log('════════ nestle-catalogo · LLENAR DESDE SFMC ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var X = M.cargar();
console.log('  volcado: ' + X.volcado + '   ·   libro: ' + path.basename(X.libro));
console.log('  prueba del mapeo: ' + prueba.volcado + (prueba.volcado === X.volcado ? '  ✔ mismo volcado' : '  🔴 OTRO VOLCADO'));
if (prueba.volcado !== X.volcado) { console.log('\n  🔴 la prueba se corrió contra otro volcado. Vuelve a correr el probador.'); process.exit(1); }
console.log('  mapeos aprobados: ' + Object.keys(aprobado).length + ' de ' + prueba.mapeos.length + '\n');

// ── el número de fila REAL de cada pieza ────────────────────────────────────────────
// 🔴 NO se usa índice+2. La hoja tiene filas de notas al final y filas en blanco en medio; el
//    índice del array y el número de fila del XML dejaron de coincidir hace tiempo, y por eso
//    340 celdas «no encontraban dónde caer».
var wsL = XLSX.readFile(X.tmp).Sheets[HOJA];
var rngL = XLSX.utils.decode_range(wsL['!ref']);
var encL = [];
for (var c0 = rngL.s.c; c0 <= rngL.e.c; c0++) { var e0 = wsL[XLSX.utils.encode_cell({ r: 0, c: c0 })]; encL[c0] = e0 ? t(e0.v) : ''; }
var iPieza = encL.indexOf(X.nmPieza);
var filaDe = {};
for (var r0 = 1; r0 <= rngL.e.r; r0++) {
  var cP = wsL[XLSX.utils.encode_cell({ r: r0, c: iPieza })];
  var id0 = cP ? t(cP.v) : ''; if (id0) filaDe[id0] = r0 + 1;
}

var plan = [], discrepan = [], sinCruce = 0;
M.MAPEO.forEach(function (m) {
  if (!aprobado[m.hoja]) return;
  var nmH = X.columna(m.hoja, m.exacta); if (!nmH) return;
  var iCol = encL.indexOf(nmH); if (iCol < 0) return;
  X.piezas.forEach(function (p) {
    var f = X.sfmcDe(p); if (!f) return;
    var val = m.valor(f, p, X.fechasDe(p));
    if (val === null || t(val) === '') return;
    var actual = t(p[X.nmPieza] ? p[nmH] : p[nmH]);
    var id = X.idDe(p);
    if (!M.esHueco(actual)) {
      var ok = m.iguales ? m.iguales(actual, val) : t(actual).toLowerCase() === t(val).toLowerCase();
      if (!ok) discrepan.push({ pieza: id, col: m.hoja, hoja: actual, sfmc: val });
      return;                                            // ya tiene valor: no se toca
    }
    var fila = filaDe[id]; if (!fila) return;
    plan.push({ pieza: id, fila: fila, col: m.hoja, ref: col(iCol) + fila, valor: t(val), desde: m.desde });
  });
});
X.piezas.forEach(function (p) { if (!X.sfmcDe(p)) sinCruce++; });

var porCol = {};
plan.forEach(function (x) { (porCol[x.col] = porCol[x.col] || []).push(x); });
console.log('  ── lo que se va a llenar');
Object.keys(porCol).forEach(function (k) {
  var g = porCol[k];
  console.log('     🔧 ' + k.padEnd(22) + String(g.length).padStart(3) + ' celda(s)  ← ' + g[0].desde);
  g.slice(0, 3).forEach(function (x) { console.log('           ' + x.pieza + '  ' + x.ref.padEnd(6) + '« ' + x.valor.slice(0, 58) + ' »'); });
  if (g.length > 3) console.log('           … y ' + (g.length - 3) + ' más');
});
if (!plan.length) console.log('     (ninguna)');

console.log('\n  ── lo que NO se toca');
console.log('     ' + sinCruce + ' pieza(s) del catálogo no tienen envío en la DE — su hueco no lo puede llenar SFMC');
if (discrepan.length) {
  console.log('     ⚠ ' + discrepan.length + ' celda(s) tienen valor y SFMC dice otra cosa. Se DECLARAN, no se pisan:');
  discrepan.slice(0, 10).forEach(function (d) {
    console.log('        ' + d.pieza + ' · ' + d.col.padEnd(18) + 'hoja «' + t(d.hoja).slice(0, 26) + '»   sfmc «' + t(d.sfmc).slice(0, 26) + '»');
  });
  if (discrepan.length > 10) console.log('        … y ' + (discrepan.length - 10) + ' más');
}
fs.writeFileSync(BACK + '/_preescritura/PRE-llenar-sfmc.json', JSON.stringify({ cuando: new Date().toISOString(), volcado: X.volcado, plan: plan, discrepan: discrepan }, null, 1));
console.log('\n  ═══ ' + plan.length + ' celda(s) a llenar   ·   → _preescritura/PRE-llenar-sfmc.json');
if (!plan.length) { console.log('\n  ✅ nada que llenar.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-llenar-sfmc.xlsx';
fs.copyFileSync(X.libro, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(X.tmp);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte), escritas = 0;
plan.forEach(function (x) {
  var res = CX.poner(xml, x.ref, CX.celda(x.ref, x.valor, CX.estiloDe(xml, x.ref)), x.fila);
  xml = res.xml; if (res.como !== 'sin fila') escritas++;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(X.tmp);
console.log('     ✔ ' + escritas + ' de ' + plan.length + ' celda(s) escritas en el XML');
if (escritas !== plan.length) { console.log('  🔴 faltaron celdas: NO se publica.'); process.exit(1); }

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 68));
    return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 68)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', X.tmp])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(X.tmp, X.libro);
console.log('     → publicado a ' + path.basename(X.libro));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', X.libro]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', X.libro]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', X.libro]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', X.libro]);

// ══ RELEER (E4) ═════════════════════════════════════════════════════════════════════
console.log('\n  ── releído del disco');
var ws2 = XLSX.readFile(X.libro).Sheets[HOJA];
var mal = [];
plan.forEach(function (x) {
  var cel = ws2[x.ref];
  var v = cel ? t(cel.v) : '';
  if (v !== t(x.valor)) mal.push(x.pieza + ' · ' + x.col + ' → «' + v.slice(0, 30) + '»');
});
Object.keys(porCol).forEach(function (k) {
  var g = porCol[k], malos = mal.filter(function (s) { return s.indexOf(' · ' + k + ' ') >= 0; }).length;
  console.log('     ' + (malos ? '🔴 ' : '✔ ') + k.padEnd(22) + (g.length - malos) + ' de ' + g.length + ' quedaron');
});
var P2 = XLSX.utils.sheet_to_json(ws2, { defval: '', blankrows: false });
console.log('     filas: ' + X.hoja.length + ' → ' + P2.length + (X.hoja.length === P2.length ? '   ✔ ninguna se movió' : '   🔴 CAMBIÓ'));
if (X.hoja.length !== P2.length) mal.push('cambió el número de filas');
console.log('\n  ' + (mal.length ? '🔴 ' + mal.length + ' no quedaron: ' + mal.slice(0, 5).join(' · ') : '✅ ' + plan.length + ' CELDAS LLENAS, verificadas contra el disco'));
process.exit(mal.length ? 1 : 0);
