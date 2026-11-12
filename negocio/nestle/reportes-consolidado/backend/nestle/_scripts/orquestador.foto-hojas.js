// orquestador · UNA FOTO DE LA FORMA DEL LIBRO — filas, columnas y encabezados por hoja.
//
// 🔴 PARA QUÉ. `orquestador.probar-idempotencia.js` prueba lo mismo, pero corre la cadena DOS veces
//    seguidas, y el libro vive en OneDrive: en tres intentos, dos se rompieron con transitorios
//    (`BadZipFile: Bad CRC-32`, y `safe-save` negándose porque el validador leyó el archivo a medio
//    sincronizar). No es un defecto del reporte —`safe-save` hizo justo lo que debe, negarse— pero
//    hace que la prueba no se pueda terminar, y una prueba que no se puede correr no protege nada.
//    Con una foto ANTES y otra DESPUÉS de UNA corrida se prueba lo mismo cuando el punto de partida
//    ya es post-cadena: si no queda trabajo nuevo, nada puede cambiar. La mitad de escrituras a
//    OneDrive, la misma afirmación.
//
//   node orquestador.foto-hojas.js --guardar <nombre>     toma la foto
//   node orquestador.foto-hojas.js --comparar <a> <b>     compara dos
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var DIR = BACK + '/_preescritura';

function foto() {
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_foto.xlsx';
  fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
  var wb = XLSX.readFile(tmp);
  var o = {};
  wb.SheetNames.forEach(function (n) {
    var s = wb.Sheets[n]; if (!s || !s['!ref']) { o[n] = { filas: 0, cols: 0, enc: [] }; return; }
    var r = XLSX.utils.decode_range(s['!ref']);
    var enc = (XLSX.utils.sheet_to_json(s, { header: 1, defval: '', blankrows: false })[0] || []).map(t);
    o[n] = { filas: r.e.r + 1, cols: r.e.c + 1, enc: enc };
  });
  try { fs.unlinkSync(tmp); } catch (e) { }
  return o;
}

var a = process.argv.indexOf('--guardar');
if (a >= 0) {
  var nom = process.argv[a + 1] || 'foto';
  var f = foto();
  fs.writeFileSync(DIR + '/foto-' + nom + '.json', JSON.stringify({ cuando: new Date().toISOString(), hojas: f }, null, 1));
  console.log('foto «' + nom + '»  ·  ' + Object.keys(f).length + ' hojas');
  Object.keys(f).sort().forEach(function (h) { console.log('   ' + h.padEnd(24) + String(f[h].filas).padStart(5) + ' filas × ' + f[h].cols + ' cols'); });
  console.log('→ _preescritura/foto-' + nom + '.json');
  process.exit(0);
}

var c = process.argv.indexOf('--comparar');
if (c >= 0) {
  var A = JSON.parse(fs.readFileSync(DIR + '/foto-' + process.argv[c + 1] + '.json', 'utf8')).hojas;
  var B = JSON.parse(fs.readFileSync(DIR + '/foto-' + process.argv[c + 2] + '.json', 'utf8')).hojas;
  console.log('════════ ¿CAMBIÓ LA FORMA DEL LIBRO? ════════\n');
  console.log('  ' + process.argv[c + 1] + '  vs  ' + process.argv[c + 2] + '\n');
  var mal = [];
  Object.keys(A).forEach(function (h) {
    if (!B[h]) { mal.push('🔴 DESAPARECIÓ la hoja ' + h); return; }
    if (A[h].filas !== B[h].filas || A[h].cols !== B[h].cols) {
      mal.push('🔴 ' + h + ': ' + A[h].filas + '×' + A[h].cols + ' → ' + B[h].filas + '×' + B[h].cols);
    }
    var nuevas = B[h].enc.filter(function (x) { return x && A[h].enc.indexOf(x) < 0; });
    var idas = A[h].enc.filter(function (x) { return x && B[h].enc.indexOf(x) < 0; });
    if (nuevas.length) mal.push('🔴 ' + h + ': columnas NUEVAS → ' + nuevas.join(' · '));
    if (idas.length) mal.push('🔴 ' + h + ': columnas QUE SE FUERON → ' + idas.join(' · '));
    // el ORDEN de las columnas es de Rick: si se reordenan sin que él lo pida, es un defecto
    var comunes = A[h].enc.filter(function (x) { return x && B[h].enc.indexOf(x) >= 0; });
    var desorden = comunes.filter(function (x, i) {
      return i > 0 && B[h].enc.indexOf(x) < B[h].enc.indexOf(comunes[i - 1]);
    });
    if (desorden.length) mal.push('🔴 ' + h + ': el ORDEN de las columnas cambió (' + desorden.slice(0, 3).join(' · ') + ') — y el orden es de Rick');
  });
  Object.keys(B).forEach(function (h) { if (!A[h]) mal.push('🔴 hoja NUEVA: ' + h); });
  if (!mal.length) console.log('  ✅ IDÉNTICO — ' + Object.keys(A).length + ' hojas, mismas filas, mismas columnas, mismo orden');
  else mal.forEach(function (m) { console.log('  ' + m); });
  process.exit(mal.length ? 1 : 0);
}
console.log('uso: --guardar <nombre>   |   --comparar <a> <b>');
