// PUERTA 1 · genera la edición de Data_Email: SOLO las celdas de métricas que cambian.
//
// 🔴 Las 4 columnas canónicas ni se abren. 277 de sus celdas están escritas a mano por Rick, y
//    sus valores crudos no están en Catalog_Campanas: si se restaurara la fórmula encima,
//    quedarían vacías para siempre.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var SP = os.homedir() + '/.claude/reportes-backend/nestle/_fuentes';

var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_ge.xlsx';
fs.copyFileSync(vivo.ruta, T);
var sh = XLSX.readFile(T).Sheets['Data_Email'];
var r = XLSX.utils.decode_range(sh['!ref']), hdr = {};
for (var c = r.s.c; c <= r.e.c; c++) {
  var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h) hdr[t(h.v)] = XLSX.utils.encode_col(c);
}
var E = XLSX.utils.sheet_to_json(sh, { defval: '' });
var B = JSON.parse(fs.readFileSync(SP + '/email.json', 'utf8'));
var porLlave = {};
B.envios.forEach(function (e) { porLlave[e.llave] = e; });

// solo las columnas de MÉTRICA. Ninguna canónica en esta lista, a propósito.
var MET = {
  Email_Sends: 'email_sends', Email_Deliveries: 'email_deliveries',
  Email_Unique_Opens: 'email_unique_opens', Email_Unique_Clicks: 'email_unique_clicks',
  Email_Bounces: 'email_bounces'
};
var set = {}, tocadas = [];
E.forEach(function (x, i) {
  var cn = t(x['Email_Content_Name']);
  if (!cn) return;
  var e = porLlave[D.llaveEnvio({ content_name: cn, fecha: x['Send_Date'] })];
  if (!e) return;
  Object.keys(MET).forEach(function (col) {
    if (num(x[col]) === e[MET[col]]) return;
    set[hdr[col] + (i + 2)] = e[MET[col]];
    tocadas.push({ celda: hdr[col] + (i + 2), col: col, de: num(x[col]), a: e[MET[col]], cn: cn.slice(-30) });
  });
});

var edicion = {
  _que: 'PUERTA 1 · Data_Email — solo las celdas de métrica que cambian',
  _no_toca: 'BU_Canonico, Marca, Campana_Canonica, Segmento_Canonico: 277 de sus celdas son de Rick',
  archivo: vivo.ruta,
  respaldo: PROY + '/_backups/(Interno)-Reporte-Consolidado-Nestle-2026-v8__2026-08-19_1809_antes-puerta1.xlsx',
  hojas: { Data_Email: { set: set } }
};
var destino = os.homedir() + '/_p1-email.json';
fs.writeFileSync(destino, JSON.stringify(edicion, null, 1), 'utf8');

console.log('PUERTA 1 · Data_Email');
console.log('  celdas a escribir: ' + tocadas.length);
tocadas.forEach(function (x) { console.log('     ' + x.celda.padEnd(6) + x.col.padEnd(20) + x.de + ' → ' + x.a + '   ' + x.cn); });
var canon = tocadas.filter(function (x) { return /Canonico|^Marca$|Canonica/.test(x.col); });
console.log('\n  ' + (canon.length ? '🔴 ' + canon.length + ' celdas canónicas en la lista' : '✔ NINGUNA celda canónica en la lista'));
console.log('  → ' + destino);
