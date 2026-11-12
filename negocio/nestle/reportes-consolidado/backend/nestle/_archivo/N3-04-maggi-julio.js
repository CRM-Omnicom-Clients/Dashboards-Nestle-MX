// Vuelca COMPLETO el Report_Resumen de Maggi y separa lo de julio.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, $%]/g, '')); return isFinite(x) ? x : 0; };
var wb = XLSX.readFile(os.homedir() + '/_maggi.xlsx');
var F = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1, defval: '' });
var H = F[0].map(t);
console.log('════ COLUMNAS (' + H.filter(Boolean).length + ') ════');
H.forEach(function (c, i) { if (c) console.log('  [' + String(i).padStart(2) + '] ' + c); });

console.log('\n════ LAS ' + (F.length - 1) + ' FILAS ════');
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '' });
R.forEach(function (r, i) {
  console.log('\n  ── fila ' + (i + 1) + '');
  H.forEach(function (c) {
    if (!c) return;
    var v = r[c];
    if (t(v)) console.log('     ' + c.slice(0, 30).padEnd(32) + t(v).slice(0, 50));
  });
});
