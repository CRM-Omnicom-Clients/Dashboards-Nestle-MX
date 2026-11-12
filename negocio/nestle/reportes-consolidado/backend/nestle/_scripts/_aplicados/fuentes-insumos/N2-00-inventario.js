// N2 · PASO 0 — INVENTARIO DE FUENTES.
// Antes de escribir un lector: ¿qué hay en disco, qué está cargado, y qué falta?
// Sin esto, N2 sería una lista de deseos en vez de un plan.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
// 🔴 SUPERADO por fuentes-insumos.insumos.js (19-ago-2026)
//    inventaría la carpeta; N1 ya lo hace y publica el handoff.
//    Se conserva por su historia, no por su utilidad: corre sobre un esquema que ya cambió.
var SUPERADO_POR = "fuentes-insumos.insumos.js";
if (!process.env.CORRER_SUPERADO) {
  console.log("\n  🔴 este script está SUPERADO por " + SUPERADO_POR + ".");
  console.log("     inventaría la carpeta; N1 ya lo hace y publica el handoff");
  console.log("     Si de verdad lo necesitas: CORRER_SUPERADO=1 node N2-00-inventario.js\n");
  process.exit(0);
}
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
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
var kb = function (n) { return (n / 1024).toFixed(0) + ' KB'; };

function listar(dir, filtro) {
  try {
    return fs.readdirSync(dir).filter(function (f) { return !/^~\$/.test(f) && (!filtro || filtro.test(f)); })
      .map(function (f) { var st = fs.statSync(path.join(dir, f)); return { n: f, size: st.size, m: st.mtime }; })
      .sort(function (a, b) { return b.m - a.m; });
  } catch (e) { return null; }
}

console.log('════════ N2 · INVENTARIO DE FUENTES ════════\n');

// ── 1 · qué hay en disco
var CARPETAS = [
  ['Reportes-Datorama', /\.xlsx$/i, 'EMAIL · envíos y engagement de SFMC'],
  ['ReportesQcart', /\.(xlsx|csv)$/i, 'QCART · links (autoridad) + carritos y productos'],
  ['.', /Whatsapp|WhatsApp/i, 'WHATSAPP · Twilio + Google Analytics']
];
console.log('══ 1 · QUÉ HAY EN DISCO ══');
var enDisco = {};
CARPETAS.forEach(function (c) {
  var L = listar(path.join(PROY, c[0]), c[1]);
  console.log('\n  📁 ' + c[0] + '   ' + c[2]);
  if (!L) { console.log('     ⛔ no existe la carpeta'); return; }
  enDisco[c[0]] = L;
  L.slice(0, 8).forEach(function (f) {
    console.log('     ' + f.m.toISOString().slice(0, 10) + '  ' + kb(f.size).padStart(9) + '  ' + f.n);
  });
  if (L.length > 8) console.log('     … y ' + (L.length - 8) + ' más');
});

// ── 2 · qué está cargado hoy en el workbook
console.log('\n\n══ 2 · QUÉ ESTÁ CARGADO EN EL WORKBOOK ══');
var T = os.homedir() + '/_n2.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var HOJAS = [
  ['Data_Email', 'Email_Content_Name', 'Email_Sends', 'Send_Date'],
  ['Data_Qcart', 'Shortlink_Code', 'Carts_Total_All_Products', null],
  ['Data_WhatsApp', 'Campaña', 'Sends', null]
];
var cargado = {};
HOJAS.forEach(function (h) {
  var R = XLSX.utils.sheet_to_json(wb.Sheets[h[0]], { defval: '' }).filter(function (x) { return t(x[h[1]]); });
  var suma = R.reduce(function (a, r) { return a + num(r[h[2]]); }, 0);
  cargado[h[0]] = { filas: R.length, suma: suma };
  var fechas = h[3] ? R.map(function (r) { return r[h[3]]; }).filter(Boolean) : [];
  var rango = '';
  if (fechas.length) {
    var iso = fechas.map(function (f) { return typeof f === 'number' ? new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10) : t(f).slice(0, 10); }).sort();
    rango = '  ·  ' + iso[0] + ' → ' + iso[iso.length - 1];
  }
  console.log('  ' + h[0].padEnd(16) + String(R.length).padStart(4) + ' filas  ·  ' + h[2] + ' = ' + suma.toLocaleString() + rango);
});

// ── 3 · el hueco: qué trae el Datorama más nuevo que NO está cargado
console.log('\n══ 3 · EL HUECO · Datorama más nuevo vs lo cargado ══');
var DL = enDisco['Reportes-Datorama'] || [];
var wks = DL.map(function (f) { return { f: f.n, wk: num((f.n.match(/WK(\d+)/i) || [0, 0])[1]) }; }).filter(function (x) { return x.wk; }).sort(function (a, b) { return b.wk - a.wk; });
if (!wks.length) { console.log('  ⛔ ningún archivo con WK## en el nombre'); }
else {
  console.log('  el más nuevo: ' + wks[0].f + '   (los cargados venían de WK27/WK29 según la bitácora)');
  var TD = os.homedir() + '/_dt2.xlsx'; fs.copyFileSync(path.join(PROY, 'Reportes-Datorama', wks[0].f), TD);
  var wd = XLSX.readFile(TD);
  console.log('  hojas: ' + wd.SheetNames.join(' · '));
  var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
  var yaCargado = {}; E.forEach(function (r) { yaCargado[t(r['Email_Content_Name'])] = num(r['Email_Sends']); });
  var nuevos = [], crecieron = [], iguales = 0, total = 0;
  wd.SheetNames.forEach(function (h) {
    XLSX.utils.sheet_to_json(wd.Sheets[h], { defval: '' }).forEach(function (r) {
      // el content name puede venir en varias columnas según el export
      var cn = '', sends = 0;
      Object.keys(r).forEach(function (k) {
        if (/content\s*name/i.test(k) && t(r[k])) cn = t(r[k]);
        if (/^email sends$|^sends$/i.test(k)) sends = num(r[k]);
      });
      if (!cn) return;
      total++;
      if (yaCargado[cn] === undefined) nuevos.push({ cn: cn, s: sends, h: h });
      else if (sends > yaCargado[cn]) crecieron.push({ cn: cn, antes: yaCargado[cn], ahora: sends });
      else iguales++;
    });
  });
  console.log('  filas con content_name en el archivo: ' + total);
  console.log('    ya cargadas e iguales : ' + iguales);
  console.log('    🔴 CRECIERON          : ' + crecieron.length);
  crecieron.slice(0, 5).forEach(function (x) { console.log('       ' + x.antes.toLocaleString() + ' → ' + x.ahora.toLocaleString() + '  ' + x.cn.slice(-46)); });
  console.log('    🔴 NUEVAS             : ' + nuevos.length);
  var porHoja = {}; nuevos.forEach(function (x) { porHoja[x.h] = (porHoja[x.h] || 0) + 1; });
  Object.keys(porHoja).forEach(function (h) { console.log('       ' + String(porHoja[h]).padStart(3) + ' en ' + h); });
  nuevos.slice(0, 6).forEach(function (x) { console.log('       ' + String(x.s).padStart(8) + '  ' + x.cn.slice(-52)); });
}

// ── 4 · lo que el catálogo dice que falta
console.log('\n══ 4 · LO QUE EL CATÁLOGO DECLARA COMO FALTANTE ══');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var v = {};
P.filter(function (p) { return t(p['Estado']) !== 'Confirmado'; }).forEach(function (p) {
  var k = t(p['Estado']) + ' · ' + t(p['Campaña']) + ' · ' + t(p['Canal']);
  v[k] = (v[k] || 0) + 1;
});
Object.keys(v).sort().forEach(function (k) { console.log('  ' + String(v[k]).padStart(3) + '  ' + k); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var sinCod = Q.filter(function (r) { return !t(r['Shortlink_Code']); });
console.log('  ' + String(sinCod.length).padStart(3) + '  filas de Data_Qcart SIN shortlink_code (' +
  sinCod.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0).toLocaleString() + ' carritos)');
