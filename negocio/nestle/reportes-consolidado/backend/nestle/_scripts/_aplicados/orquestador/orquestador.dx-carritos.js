// ¿Dónde se van los 44 carritos al abrir la rejilla por mes? (1,592 de 1,636)
// No es doble conteo — es PÉRDIDA, que es peor: desaparecen sin avisar.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var wb = XLSX.readFile(os.homedir() + '/_n3.xlsx');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });

console.log('══ piezas CON carritos que no los entregan a la rejilla ══\n');
var perdidos = 0;
P.filter(function (p) { return num(p['Carritos_Total']) > 0; }).forEach(function (p) {
  var meses = t(p['Sends_Por_Mes']).split(' ; ').map(function (x) { return x.split(':')[0]; }).filter(Boolean);
  var ml = t(p['Mes_Lanzamiento']);
  var entra = ml && meses.indexOf(ml) >= 0;
  if (entra) return;
  perdidos += num(p['Carritos_Total']);
  console.log('  ' + t(p['Pieza_ID']) + '  ' + t(p['Campaña']).padEnd(15) + t(p['Touchpoint']).padEnd(7) +
    t(p['Segmento']).slice(0, 18).padEnd(20) + t(p['Canal']).padEnd(10) + String(num(p['Carritos_Total'])).padStart(5) + ' carritos');
  console.log('       Mes_Lanzamiento="' + ml + '"   Sends_Por_Mes="' + t(p['Sends_Por_Mes']) + '"   Estado=' + t(p['Estado']));
  console.log('       Fecha_Origen: ' + t(p['Fecha_Origen']));
});
console.log('\n  carritos que se pierden: ' + perdidos + '   (1,636 - ' + perdidos + ' = ' + (1636 - perdidos) + ')');

console.log('\n══ los carritos, por canal y estado ══');
var v = {};
P.filter(function (p) { return num(p['Carritos_Total']) > 0; }).forEach(function (p) {
  var k = t(p['Canal']) + ' · ' + t(p['Estado']);
  v[k] = (v[k] || 0) + num(p['Carritos_Total']);
});
Object.keys(v).sort().forEach(function (k) { console.log('    ' + String(v[k]).padStart(5) + '  ' + k); });
