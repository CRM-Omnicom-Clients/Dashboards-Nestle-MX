// Lee el ReporteCliente-Maggi-Mundial-Resumen-2026.xlsx (el que Rick señaló) y saca JULIO.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, $%]/g, '')); return isFinite(x) ? x : 0; };
var SRC = os.homedir() + '/OneDrive - OneWorkplace/Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026/Marcas/RN/CRM RN/Maggi/Maggi Mundial/ReporteCliente-Maggi-Mundial-Resumen-2026.xlsx';
var T = os.homedir() + '/_maggi.xlsx';
fs.copyFileSync(SRC, T);
var wb = XLSX.readFile(T);
console.log('════ ReporteCliente-Maggi-Mundial-Resumen-2026.xlsx ════');
console.log('  hojas: ' + wb.SheetNames.join(' · ') + '\n');

wb.SheetNames.forEach(function (h) {
  var F = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: '' });
  var conDatos = F.filter(function (f) { return f.some(function (c) { return t(c); }); });
  console.log('  ── ' + h + '   ' + conDatos.length + ' filas con datos');
  // encabezado por contenido
  var iH = 0, mejor = 0;
  F.slice(0, 12).forEach(function (f, i) {
    var n = f.filter(function (c) { return t(c) && isNaN(Number(c)); }).length;
    if (n > mejor) { mejor = n; iH = i; }
  });
  var H = F[iH].map(t).filter(Boolean);
  console.log('     encabezado (f' + (iH + 1) + ', ' + H.length + ' cols): ' + H.slice(0, 14).join(' | ').slice(0, 190));
  // primeras filas de datos
  F.slice(iH + 1, iH + 4).forEach(function (f) {
    var s = f.map(t).filter(Boolean).slice(0, 12).join(' | ');
    if (s) console.log('        ' + s.slice(0, 190));
  });
  console.log('');
});
