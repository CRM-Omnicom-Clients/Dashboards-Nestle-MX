// Las 29 filas de Qcart de JULIO, una por una: ¿a qué pieza van y por qué no llegaron?
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var iso = function (f) {
  if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10);
  var s = t(f); if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : s.slice(0, 10);
};
var T = os.homedir() + '/_dxj.xlsx';
var wb = XLSX.readFile(T);
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });

var porCod = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) porCod[t(k)] = p; });
  });
});

var qJul = Q.filter(function (r) { return /2026-07/.test(iso(r['Fecha_Envio'])); });
console.log('════ LAS ' + qJul.length + ' FILAS DE QCART DE JULIO ════\n');
console.log('  fecha       campaña     medio     TP          segmento         carr    código    → pieza');
qJul.sort(function (a, b) { return iso(a['Fecha_Envio']).localeCompare(iso(b['Fecha_Envio'])); }).forEach(function (r) {
  var cod = t(r['Shortlink_Code']);
  var pz = cod && porCod[cod] ? t(porCod[cod]['Pieza_ID']) + ' ' + t(porCod[cod]['Touchpoint']) : (cod ? '⛔ código sin pieza' : '⛔ SIN CÓDIGO');
  console.log('  ' + iso(r['Fecha_Envio']) + '  ' + (t(r['Campana_Canonica']) || t(r['Campaign'])).slice(0, 10).padEnd(11) +
    t(r['Medio']).padEnd(10) + t(r['Touchpoint']).slice(0, 11).padEnd(12) +
    (t(r['Segmento_Canonico']) || t(r['Segment'])).slice(0, 15).padEnd(17) +
    String(num(r['Carts_Total_All_Products'])).padStart(4) + '   ' + (cod || '—').padEnd(10) + pz);
});

console.log('\n════ EL DESCUADRE ════');
var porCamp = {};
qJul.forEach(function (r) {
  var k = t(r['Campana_Canonica']) || t(r['Campaign']);
  porCamp[k] = porCamp[k] || { qcart: 0, catalogo: 0 };
  porCamp[k].qcart += num(r['Carts_Total_All_Products']);
});
// lo que el catálogo tiene para julio
P.filter(function (p) { return /2026-07/.test(t(p['Meses_Activos']) || t(p['Mes_Lanzamiento'])); }).forEach(function (p) {
  var k = t(p['Campaña']); porCamp[k] = porCamp[k] || { qcart: 0, catalogo: 0 };
  porCamp[k].catalogo += num(p['Carritos_Total']);
});
console.log('  campaña          Qcart julio   catálogo julio   hueco');
Object.keys(porCamp).sort().forEach(function (k) {
  var x = porCamp[k];
  console.log('  ' + k.padEnd(18) + String(x.qcart).padStart(8) + String(x.catalogo).padStart(16) + '   ' + (x.qcart - x.catalogo > 0 ? '🔴 faltan ' + (x.qcart - x.catalogo) : '✔'));
});

console.log('\n════ ¿POR QUÉ NO LLEGAN? ════');
var sinCod = qJul.filter(function (r) { return !t(r['Shortlink_Code']); });
var conCodSinPieza = qJul.filter(function (r) { return t(r['Shortlink_Code']) && !porCod[t(r['Shortlink_Code'])]; });
var ok = qJul.filter(function (r) { return t(r['Shortlink_Code']) && porCod[t(r['Shortlink_Code'])]; });
console.log('  ✔ con código Y pieza     : ' + ok.length + ' filas · ' + ok.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0) + ' carritos');
console.log('  🔴 SIN código            : ' + sinCod.length + ' filas · ' + sinCod.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0) + ' carritos');
console.log('  🔴 con código, sin pieza : ' + conCodSinPieza.length + ' filas · ' + conCodSinPieza.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0) + ' carritos');
conCodSinPieza.forEach(function (r) {
  console.log('       ' + t(r['Shortlink_Code']).padEnd(10) + (t(r['Campana_Canonica']) || t(r['Campaign'])).padEnd(10) +
    t(r['Touchpoint']).padEnd(12) + t(r['Receta']).slice(0, 26).padEnd(28) + String(num(r['Carts_Total_All_Products'])).padStart(4) + ' carr');
});

console.log('\n════ ¿Y LOS PARTIDOS 5-8 DE MUNDIAL EN EMAIL? ════');
var m7 = qJul.filter(function (r) { return /mundial/i.test(t(r['Campana_Canonica']) || t(r['Campaign'])); });
console.log('  filas de Mundial en julio: ' + m7.length);
var tps = {};
m7.forEach(function (r) { var k = t(r['Medio']) + ' ¦ ' + t(r['Touchpoint']); tps[k] = (tps[k] || 0) + num(r['Carts_Total_All_Products']); });
Object.keys(tps).sort().forEach(function (k) { console.log('     ' + String(tps[k]).padStart(4) + ' carritos   ' + k); });
