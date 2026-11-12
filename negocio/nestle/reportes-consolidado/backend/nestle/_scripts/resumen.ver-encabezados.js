// resumen · LEER LOS ENCABEZADOS REALES DE Report_Resumen, ANTES DE TOCAR NADA.
// 🔴 Rick edita la hoja a mano. Lo que este script imprime es la hoja, no lo que el backend cree.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var vivo = L.archivoVivo({ dir: PROY });
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_vercols.xlsx';
fs.copyFileSync(vivo.ruta, tmp);
var wb = XLSX.readFile(tmp);
var HOJA = process.argv[2] || 'Report_Resumen';
var F = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: '', blankrows: false });
var enc = (F[0] || []).map(t);
console.log('libro: ' + path.basename(vivo.ruta) + '   ·   hojas: ' + wb.SheetNames.length);
console.log(HOJA + ': ' + (F.length - 1) + ' filas de datos · ' + enc.length + ' columnas (' + enc.filter(Boolean).length + ' con nombre)\n');
// cuántas celdas llenas por columna, para ver de un golpe qué está muerto
var llenas = enc.map(function (_, i) {
  var n = 0; for (var r = 1; r < F.length; r++) { if (t((F[r] || [])[i])) n++; } return n;
});
enc.forEach(function (h, i) {
  console.log('  ' + col(i).padStart(3) + '  ' + String(llenas[i]).padStart(4) + '/' + (F.length - 1) + '  ' + (h || '·(sin encabezado)'));
});
var vacias = enc.filter(function (h, i) { return h && llenas[i] === 0; });
if (vacias.length) console.log('\n  ⚠ ' + vacias.length + ' columna(s) con nombre y CERO celdas llenas:\n     ' + vacias.join('\n     '));
try { fs.unlinkSync(tmp); } catch (e) { }
