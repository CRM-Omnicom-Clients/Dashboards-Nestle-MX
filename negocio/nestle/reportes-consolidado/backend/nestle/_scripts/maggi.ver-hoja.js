// maggi · LEER LA HOJA «Maggi Reporte» TAL COMO ESTÁ, antes de escribir nada.
// 🔴 Rick la armó y llenó parte a mano. Leer antes de escribir, no después: un script que
//    regenera sin mirar destruye su trabajo sin dejar rastro.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Maggi Reporte';
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_mgver.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var F = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets[HOJA], { header: 1, defval: '', blankrows: false });
var enc = (F[0] || []).map(t);
function ix(c) { return enc.indexOf(c); }
var VER = process.argv[2] === '--todo';

console.log('════════ ' + HOJA + ' · ' + (F.length - 1) + ' filas ════════\n');
var DIM = ['Campaña', 'TouchPoint', 'Tipo Email', 'Segmento', 'Quincena_Lanzamiento Principal', 'Mes', 'QCART?'];
var NUEVAS = ['RECETAS ASIGNADAS', 'SHORTLINKS ASIGNADOS', 'UTMS CONTENT ORIGEN', 'UTMS CONTENT MODIFICADAS', 'Medición desde', 'Medición hasta'];
var QC = ['Clicks', 'Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN'];
var EM = ['Principal_Sends', 'Principal_Opens', 'Principal_Clicks'];
var WA = ['WA-Envíos', 'WA-Leídos', 'WA-Clicks'];

for (var r = 1; r < F.length; r++) {
  var g = function (c) { var i = ix(c); return i < 0 ? '' : t(F[r][i]); };
  console.log('fila ' + (r + 1) + '  ' + DIM.map(g).filter(Boolean).join(' | '));
  console.log('   email: ' + EM.map(function (c) { return c.replace('Principal_', '') + ' ' + (g(c) || '—'); }).join(' · ') +
    '   WA: ' + WA.map(function (c) { return c.replace('WA-', '') + ' ' + (g(c) || '—'); }).join(' · '));
  console.log('   qcart: ' + QC.map(function (c) { return c + ' ' + (g(c) || '—'); }).join(' · '));
  NUEVAS.forEach(function (c) { var val = g(c); if (val) console.log('   ' + c + ': ' + val); });
  if (VER) console.log('   nombre SFMC: ' + g('Email Name SFMC_Principal'));
  console.log('');
}
console.log('── cuántas celdas tiene cada columna nueva');
NUEVAS.forEach(function (c) {
  var i = ix(c); if (i < 0) { console.log('   🔴 ' + c + ' NO existe'); return; }
  var n = 0; for (var rr = 1; rr < F.length; rr++) if (t(F[rr][i])) n++;
  console.log('   ' + c.padEnd(28) + n + ' de ' + (F.length - 1));
});
try { fs.unlinkSync(tmp); } catch (e) { }
