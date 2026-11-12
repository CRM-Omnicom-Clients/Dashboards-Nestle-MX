// DIAGNÓSTICO ENFOCADO: JULIO. Qué dice cada fuente, y dónde está el hueco de Maggi.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var iso = function (f) {
  if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10);
  var s = t(f); if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : s.slice(0, 10);
};
var esJulio = function (s) { return /2026-07/.test(t(s)); };

var T = os.homedir() + '/_dxj.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['Campaña']); });

console.log('════ JULIO · QUÉ DICE CADA FUENTE ════\n');

console.log('── Data_Email · envíos de julio');
var eJul = E.filter(function (r) { return esJulio(iso(r['Send_Date'])); });
var pc = {};
eJul.forEach(function (r) { var k = t(r['Campana_Canonica']); pc[k] = pc[k] || { n: 0, s: 0 }; pc[k].n++; pc[k].s += num(r['Email_Sends']); });
Object.keys(pc).sort().forEach(function (k) { console.log('   ' + k.padEnd(18) + String(pc[k].n).padStart(3) + ' envíos · ' + pc[k].s.toLocaleString().padStart(10) + ' sends'); });
console.log('   TOTAL: ' + eJul.length + ' envíos · ' + eJul.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0).toLocaleString() + ' sends');

console.log('\n── Data_Qcart · filas cuya Fecha_Envio cae en julio');
var qJul = Q.filter(function (r) { return esJulio(iso(r['Fecha_Envio'])); });
var qc = {};
qJul.forEach(function (r) {
  var k = (t(r['Campana_Canonica']) || t(r['Campaign'])) + ' ¦ ' + (t(r['Medio']) || '?');
  qc[k] = qc[k] || { n: 0, c: 0, int: 0 };
  qc[k].n++; qc[k].c += num(r['Carts_Total_All_Products']); qc[k].int += num(r['Intencion_Total_Carrito_MXN']);
});
Object.keys(qc).sort().forEach(function (k) { console.log('   ' + k.padEnd(30) + String(qc[k].n).padStart(3) + ' filas · ' + String(qc[k].c).padStart(5) + ' carritos · $' + Math.round(qc[k].int).toLocaleString()); });
console.log('   TOTAL julio: ' + qJul.length + ' filas · ' + qJul.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0) + ' carritos');
console.log('\n   ⚠ filas de Qcart SIN Fecha_Envio: ' + Q.filter(function (r) { return !iso(r['Fecha_Envio']); }).length +
  '  (' + Q.filter(function (r) { return !iso(r['Fecha_Envio']); }).reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0) + ' carritos) — hay que ver si son de julio');

console.log('\n── Data_WhatsApp');
WA.forEach(function (r) {
  console.log('   ' + t(r['Campaña']).padEnd(16) + t(r['Segmento_Canonico'] || r['Segmento']).slice(0, 20).padEnd(22) +
    'sends=' + String(num(r['Sends'])).padStart(7) + '  fecha=' + iso(r['Send_Date'] || r['Fecha']));
});

console.log('\n════ MAGGI · TODO lo que existe, por mes ════');
var mg = P.filter(function (p) { return t(p['Marca']) === 'Maggi'; });
mg.sort(function (a, b) { return (t(a['Mes_Lanzamiento']) + t(a['Touchpoint'])).localeCompare(t(b['Mes_Lanzamiento']) + t(b['Touchpoint'])); });
mg.forEach(function (p) {
  console.log('   ' + t(p['Pieza_ID']) + '  ' + t(p['Campaña']).padEnd(9) + t(p['Canal']).padEnd(10) + t(p['Touchpoint']).padEnd(7) +
    t(p['Segmento']).slice(0, 16).padEnd(18) + (t(p['Mes_Lanzamiento']) || 'SIN MES').padEnd(9) +
    'sends=' + String(num(p['Sends'])).padStart(7) + ' carr=' + String(num(p['Carritos_Total'])).padStart(4) + '  ' + t(p['Estado']));
});

console.log('\n════ EL HUECO DE JULIO EN MAGGI ════');
var mgJul = mg.filter(function (p) { return esJulio(t(p['Meses_Activos']) || t(p['Mes_Lanzamiento'])); });
console.log('  piezas de Maggi con periodo julio: ' + mgJul.length);
console.log('  ¿tienen sends? ' + mgJul.filter(function (p) { return num(p['Sends']) > 0; }).length + ' de ' + mgJul.length);
console.log('  ¿tienen carritos? ' + mgJul.filter(function (p) { return num(p['Carritos_Total']) > 0; }).length);
console.log('');
console.log('  Y los partidos 5-8 del Mundial (que son de julio):');
['E-P5', 'E-P6', 'E-P7', 'E-P8', 'WA-P5', 'WA-P6', 'WA-P7', 'WA-P8'].forEach(function (tp) {
  var x = P.filter(function (p) { return t(p['Campaña']) === 'Mundial' && t(p['Touchpoint']) === tp; });
  console.log('     ' + tp.padEnd(7) + (x.length ? x.length + ' pieza(s) · mes=' + (t(x[0]['Mes_Lanzamiento']) || 'SIN') + ' · sends=' + num(x[0]['Sends']) + ' · carr=' + x.reduce(function (a, p) { return a + num(p['Carritos_Total']); }, 0) + ' · ' + t(x[0]['Estado']) : '⛔ NO EXISTE en el catálogo'));
});
