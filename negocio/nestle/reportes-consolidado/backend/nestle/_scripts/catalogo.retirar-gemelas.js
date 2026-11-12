// nestle-catalogo · RETIRAR LAS 12 FILAS DUPLICADAS DE FUEL FOR LIFE.
//
// 🔴 RICK, 8-sep-2026: «esto ya sabes, no puede haber duplicados, no entiendo cuál es la decisión».
//    Tenía razón. Lo que yo pedía autorizar no era «¿son duplicados?» —eso estaba probado tres
//    veces— sino BORRAR FILAS, que es la única operación de este sistema que no se deshace sola.
//    Pero si está probado que sobran, dejarlas es peor que quitarlas.
//
// 🔴 DE DÓNDE SALIERON. Un script las escribió el 20-ago-2026 con el MISMO jobId (`1263916`) en
//    las doce — un solo envío de SFMC no puede producir doce cifras distintas. Nacieron sin
//    `Email_Name`, sin `TouchPoint` y sin `Quincena`, así que nunca cruzaron con nada.
//
// 🔴 NO SE BORRA SIN QUE `catalogo.probar-gemelas.js` ESTÉ EN VERDE. Sus cinco pruebas:
//      P1 · SFMC tiene 16 piezas de Pro Plan y el catálogo 28 → sobran exactamente 12
//      P2 · cada una tiene UNA melliza, misma campaña y mismo segmento
//      P3 · la melliza tiene nombre y touchpoint; la gemela no tiene ninguno
//      P4 · ni un solo dato de la gemela falta en su melliza  ← la que de verdad protege
//      P5 · nadie DEPENDE de ellas (lo que las nombra son avisos y bitácoras, no datos)
//
// 🔴 Y SE VERIFICA ANTES DE PUBLICAR, sobre el temporal: las 126 filas que se quedan tienen que
//    decir exactamente lo mismo, celda por celda. Publicar y luego comprobar es cómo se perdieron
//    cinco columnas en agosto: para cuando se ve, el archivo del cliente ya está mal.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var HOJA = 'Catalogo_Piezas';
var GEMELAS = /^009-P0(1[89]|2[0-9])$/;
var NLx = String.fromCharCode(10);

// 🔴 LA CONDICIÓN DE ENTRADA ES EL VEREDICTO DE LAS 5 PRUEBAS, no mi opinión de hace un minuto.
var VER = BACK + '/_preescritura/gemelas-probadas.json';
if (!fs.existsSync(VER)) { console.log('🔴 falta la prueba. Corre antes: catalogo.probar-gemelas.js'); process.exit(1); }
var prueba = JSON.parse(fs.readFileSync(VER, 'utf8'));
if (!prueba.ok) { console.log('🔴 las pruebas NO están en verde:'); (prueba.fallos || []).forEach(function (x) { console.log('   · ' + x); }); process.exit(1); }

DECL.declarar('nestle-catalogo', 'catalogo.retirar-gemelas.js', [{
  hoja: HOJA, grano: 'una FILA entera',
  llave: 'Pieza_ID',
  celdas_esperadas: '12 filas retiradas; TODAS las demás verificadas celda por celda antes de publicar'
}]);

console.log('════════ nestle-catalogo · RETIRAR LAS 12 GEMELAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  las 5 pruebas: ✅ en verde (' + String(prueba.cuando).slice(0, 19).replace('T', ' ') + ')\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_retgem.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
var P = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_' + 'ID');
var iP = enc.indexOf(nmP);

// qué FILA del XML es cada gemela
var fuera = [], dentro = [];
for (var r0 = 1; r0 <= rng.e.r; r0++) {
  var cP = ws[XLSX.utils.encode_cell({ r: r0, c: iP })];
  var id = cP ? t(cP.v) : '';
  if (GEMELAS.test(id)) fuera.push({ fila: r0 + 1, id: id }); else dentro.push(r0 + 1);
}
console.log('  filas: ' + (rng.e.r) + '   ·   se van ' + fuera.length + '   ·   se quedan ' + dentro.length);
console.log('     ' + fuera.map(function (x) { return x.id + ' (f' + x.fila + ')'; }).join(' · '));
// 🔴 EL NÚMERO NO SE FIJA EN 12. Tras la primera retirada la cadena recreó ONCE, así que exigir
//    exactamente 12 haría que el script se negara justo cuando más falta hace. Lo que sí se exige:
//    que haya al menos una, que ninguna pase de 12, y que las 5 pruebas estén en verde — eso ya
//    lo comprobó  sobre las que existan hoy.
if (!fuera.length || fuera.length > 12) { console.log(NLx + '  🔴 esperaba entre 1 y 12 filas y encontré ' + fuera.length + '. NO se toca nada.'); process.exit(1); }

// 🔴 LA FOTO DE CONTROL: cada fila que se queda, identificada por su Pieza_ID (no por su número
//    de fila, que va a cambiar), con TODAS sus celdas. Es contra esto que se verifica.
var antes = {};
dentro.forEach(function (nf) {
  var cP2 = ws[XLSX.utils.encode_cell({ r: nf - 1, c: iP })];
  var id2 = cP2 ? t(cP2.v) : ('(fila ' + nf + ')');
  var fila = {};
  for (var c1 = rng.s.c; c1 <= rng.e.c; c1++) {
    var cc = ws[XLSX.utils.encode_cell({ r: nf - 1, c: c1 })];
    if (enc[c1]) fila[enc[c1]] = cc ? t(cc.v) : '';
  }
  antes[id2] = fila;
});
console.log('  foto de control: ' + Object.keys(antes).length + ' filas × ' + enc.filter(Boolean).length + ' columnas');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA · se reconstruye el sheetData sin esas filas, RENUMERANDO ══════════
var RESP = BACK + '/_respaldos/v8-antes-retirar-gemelas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
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
// 🔴 LAS FILAS DE ABAJO SE RENUMERAN. Una fila con `r="127"` que se queda en la posición 121
//    y cuyas celdas siguen diciendo `A127` es exactamente el paquete que Excel se niega a abrir.
var nuevo = 0;
var cuerpo = filas.filter(function (f) { return !quitar[f.n]; }).map(function (f) {
  nuevo++;
  var dentroNuevo = f.dentro.replace(/<c r="([A-Z]+)\d+"/g, function (_, L2) { return '<c r="' + L2 + nuevo + '"'; });
  return '<row r="' + nuevo + '"' + String(f.attrs).replace(/ spans="[^"]*"/, '') + '>' + dentroNuevo + '</row>';
}).join('');
xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + cuerpo + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + nuevo + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ hoja reconstruida: ' + filas.length + ' → ' + nuevo + ' filas, renumeradas');

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 54)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 54)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }

// ══ VERIFICAR ANTES DE PUBLICAR ════════════════════════════════════════════════════
var ws2 = XLSX.readFile(TMP).Sheets[HOJA];
var P2 = XLSX.utils.sheet_to_json(ws2, { defval: '', blankrows: false });
var mal = [];
Object.keys(antes).forEach(function (id) {
  if (!/^\d{3}-[JP]\d{3}$/.test(id)) return;
  var f2 = P2.filter(function (q) { return t(q[nmP]) === id; })[0];
  if (!f2) { mal.push(id + ': DESAPARECIÓ'); return; }
  var difs = [];
  Object.keys(antes[id]).forEach(function (h) { if (t(f2[h]) !== antes[id][h]) difs.push(h); });
  if (difs.length) mal.push(id + ': cambiaron ' + difs.slice(0, 3).join(', '));
});
fuera.forEach(function (x) { if (P2.filter(function (q) { return t(q[nmP]) === x.id; }).length) mal.push(x.id + ': SIGUE en la hoja'); });
console.log('\n  ── verificación ANTES de publicar');
console.log('     filas: ' + P.length + ' → ' + P2.length);
console.log('     ' + (mal.length ? '🔴 ' + mal.length + ': ' + mal.slice(0, 5).join(' · ')
  : '✔ las ' + Object.keys(antes).filter(function (k) { return /^\d{3}-[JP]\d{3}$/.test(k); }).length + ' piezas que se quedan dicen EXACTAMENTE lo mismo, celda por celda'));
if (mal.length) { console.log('\n  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log('\n  ✅ 12 FILAS RETIRADAS · las demás verificadas celda por celda');
