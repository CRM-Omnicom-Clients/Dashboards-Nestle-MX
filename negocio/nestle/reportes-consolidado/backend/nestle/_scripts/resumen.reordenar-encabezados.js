// crm-reporte-resumen · REORDENAR COLUMNAS CAMBIANDO SOLO SUS ENCABEZADOS.
//
// 🔴 POR QUÉ ASÍ Y NO MOVIENDO LAS COLUMNAS. Mover una columna es correr todas las de la derecha,
//    que es literalmente la operación que desplazó celdas y perdió cinco columnas del catálogo en
//    agosto. Aquí no se mueve nada: se cambia el TEXTO de N encabezados contiguos, y como
//    `resumen.regenerar.js` escribe por NOMBRE de encabezado, en la corrida siguiente cada columna
//    recibe el valor que le toca. Tres celdas escritas en vez de 246.
//
// 🔴 SOLO SOBRE COLUMNAS QUE ESTE SISTEMA CREÓ Y NADIE MÁS HA TOCADO. El orden de las columnas es
//    de Rick (E5). Esto no reordena su hoja: corrige un desorden que produje yo hace diez minutos
//    al agregar un bloque en dos tandas. Por eso exige que las N columnas sean CONTIGUAS y que el
//    conjunto de nombres antes y después sea EXACTAMENTE el mismo — si no lo es, no toca nada.
//
// Uso:  node resumen.reordenar-encabezados.js --hoja Report_Resumen --orden "A|B|C" [--escribir]
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function arg(nm) { var i = process.argv.indexOf('--' + nm); return i >= 0 ? process.argv[i + 1] : null; }
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var HOJA = arg('hoja'), ORDEN = (arg('orden') || '').split('|').map(t).filter(Boolean);
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
if (!HOJA || ORDEN.length < 2) { console.log('uso: --hoja <hoja> --orden "A|B|C" [--escribir]'); process.exit(1); }

DECL.declarar('crm-reporte-resumen', 'resumen.reordenar-encabezados.js', [{
  hoja: HOJA, grano: 'una CELDA de encabezado', llave: 'la posición de la columna',
  celdas_esperadas: ORDEN.length + ' encabezado(s) · 0 celdas de datos'
}]);

console.log('════════ resumen · REORDENAR ENCABEZADOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_reord.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var ws = XLSX.readFile(TMP).Sheets[HOJA];
if (!ws) { console.log('🔴 no está la hoja ' + HOJA); process.exit(1); }
var R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
var enc = R[0].map(t);

// ── las guardas ─────────────────────────────────────────────────────────────────────
var idx = ORDEN.map(function (nm) { return enc.indexOf(nm); });
var falta = ORDEN.filter(function (nm, i) { return idx[i] < 0; });
if (falta.length) { console.log('🔴 no están en la hoja: ' + falta.join(' · ')); process.exit(1); }
var min = Math.min.apply(null, idx), max = Math.max.apply(null, idx);
if (max - min + 1 !== ORDEN.length) {
  console.log('🔴 las ' + ORDEN.length + ' columnas NO son contiguas (van de ' + col(min) + ' a ' + col(max) + '). No se toca nada.');
  process.exit(1);
}
var antes = enc.slice(min, max + 1).slice().sort().join('¦');
var despues = ORDEN.slice().sort().join('¦');
if (antes !== despues) { console.log('🔴 el conjunto de nombres cambiaría. Esto reordena, no renombra. No se toca nada.'); process.exit(1); }

console.log('  ' + HOJA + '   columnas ' + col(min) + '..' + col(max));
var cambios = [];
ORDEN.forEach(function (nm, i) {
  var c = min + i, actual = enc[c];
  if (actual === nm) { console.log('     ✔ ' + col(c) + '  ya dice «' + nm + '»'); return; }
  cambios.push({ ref: col(c) + '1', de: actual, a: nm });
  console.log('     🔧 ' + col(c) + '  «' + actual + '»  →  «' + nm + '»');
});
if (!cambios.length) { console.log('\n  ✅ ya están en ese orden.'); process.exit(0); }
console.log('\n  ⚠ los DATOS no se mueven: los reescribe `resumen-regenerar` por nombre en la corrida siguiente.');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

var RESP = BACK + '/_respaldos/v8-antes-reordenar.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);
cambios.forEach(function (x) { xml = CX.poner(xml, x.ref, CX.celda(x.ref, x.a, CX.estiloDe(xml, x.ref)), 1).xml; });
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + cambios.length + ' encabezado(s)');

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 64)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 64)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

console.log('\n  ── releído del disco');
var enc2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets[HOJA], { header: 1, defval: '' })[0].map(t);
var mal = 0;
ORDEN.forEach(function (nm, i) { var ok = enc2[min + i] === nm; if (!ok) mal++; console.log('     ' + (ok ? '✔ ' : '🔴 ') + col(min + i) + '  «' + enc2[min + i] + '»'); });
console.log('     columnas: ' + enc.length + ' → ' + enc2.length + (enc.length === enc2.length ? '  ✔' : '  🔴 CAMBIÓ'));
if (enc.length !== enc2.length) mal++;
console.log('\n  ' + (mal ? '🔴 ' + mal + ' no quedaron' : '✅ ENCABEZADOS EN ORDEN · corre `--desde motor-calculo` para que los datos sigan'));
process.exit(mal ? 1 : 0);
