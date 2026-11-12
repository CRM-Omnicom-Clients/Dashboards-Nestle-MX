// PUERTA 1 · paso 2 — QUÉ HAY HOY vs QUÉ VOY A ESCRIBIR.
//
// 🔴 Se diffea ANTES, no después. Rick edita el archivo a mano: si algo suyo se va a perder,
//    hay que verlo mientras todavía se puede parar. Diffear después ya no sirve de nada —
//    para entonces su trabajo ya se perdió.
//
// Este script NO escribe nada. Solo compara y avisa.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var PELIGRO = [], CAMBIOS = [];

console.log('════════ PUERTA 1 · DIFF ANTES DE ESCRIBIR ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_diff.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
function cargar(n) { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); }
var B = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp'), manual: cargar('manual') };

// ══ 1 · DATA_EMAIL ══════════════════════════════════════════════════════════════════
console.log('══ Data_Email ══');
var shE = wb.Sheets['Data_Email'];
var E = XLSX.utils.sheet_to_json(shE, { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
console.log('   hoy: ' + E.length + ' filas   ·   el bloque trae: ' + B.email.envios.length);

// las 4 columnas MIXTAS: cuántas celdas son de Rick
var r = XLSX.utils.decode_range(shE['!ref']), hdr = {};
for (var c = r.s.c; c <= r.e.c; c++) { var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h) hdr[t(h.v)] = c; }
var CANON = ['BU_Canonico', 'Marca', 'Campana_Canonica', 'Segmento_Canonico'];
var aMano = 0, detalleMano = [];
CANON.forEach(function (col) {
  var ci = hdr[col]; if (ci === undefined) return;
  var f = 0, d = 0;
  for (var i = 1; i <= r.e.r; i++) {
    var cel = shE[XLSX.utils.encode_cell({ r: i, c: ci })];
    if (!cel || t(cel.v) === '') continue;
    if (cel.f) f++; else d++;
  }
  aMano += d;
  detalleMano.push(col + ': ' + f + ' fórmula / ' + d + ' A MANO');
});
console.log('   🔴 las 4 columnas canónicas:');
detalleMano.forEach(function (x) { console.log('        ' + x); });
console.log('      → ' + aMano + ' celdas escritas a mano. NO se tocan: se escribe celda por celda.');
PELIGRO.push({ que: aMano + ' celdas escritas a mano en las 4 columnas canónicas de Data_Email',
  mitigacion: 'la escritura es por CELDA y solo sobre las columnas de métricas; las canónicas ni se abren' });

// qué filas cambian de valor
var porLlave = {};
E.forEach(function (x, i) { porLlave[D.llaveEnvio({ content_name: x['Email_Content_Name'], fecha: x['Send_Date'] })] = { fila: i + 2, r: x }; });
var MET = { Email_Sends: 'email_sends', Email_Deliveries: 'email_deliveries', Email_Unique_Opens: 'email_unique_opens', Email_Unique_Clicks: 'email_unique_clicks', Email_Bounces: 'email_bounces' };
var suben = [], nuevas = [], iguales = 0;
B.email.envios.forEach(function (e) {
  var y = porLlave[e.llave];
  if (!y) { nuevas.push(e); return; }
  var dif = Object.keys(MET).filter(function (k) { return num(y.r[k]) !== e[MET[k]]; });
  if (dif.length) suben.push({ fila: y.fila, cn: e.content_name.slice(-30), dif: dif.map(function (k) { return k.replace('Email_', '') + ' ' + num(y.r[k]) + '→' + e[MET[k]]; }) });
  else iguales++;
});
console.log('   filas que NO cambian : ' + iguales);
console.log('   filas que cambian    : ' + suben.length);
suben.slice(0, 6).forEach(function (s) { console.log('        f' + s.fila + '  ' + s.cn + '  ' + s.dif.join(' · ')); });
console.log('   filas NUEVAS         : ' + nuevas.length);
if (suben.length) CAMBIOS.push('Data_Email: ' + suben.length + ' filas actualizan métricas');
// ¿alguna BAJA? eso sí sería alarma
var bajan = suben.filter(function (s) { return s.dif.some(function (d) { var m = /(\d+)→(\d+)/.exec(d); return m && +m[2] < +m[1]; }); });
if (bajan.length) PELIGRO.push({ que: bajan.length + ' filas de Data_Email BAJARÍAN de valor', mitigacion: '🔴 revisar: el refresh es MAX, no debería bajar ninguna' });
else console.log('   ✔ ninguna métrica baja (el refresh es MAX)');

// ══ 2 · LAS DOS HOJAS DE QCART ══════════════════════════════════════════════════════
console.log('\n══ Data_Qcart_Carritos y _Productos ══');
var existeC = wb.SheetNames.indexOf('Data_Qcart_Carritos') >= 0;
var existeP = wb.SheetNames.indexOf('Data_Qcart_Productos') >= 0;
console.log('   existen hoy: ' + (existeC ? 'sí' : 'NO') + ' / ' + (existeP ? 'sí' : 'NO') + '   → se CREAN');
console.log('   se escribirán: ' + mil(B.qcart.carritos.length) + ' + ' + mil(B.qcart.productos.length) + ' eventos');
var shQ = wb.Sheets['Data_Qcart'];
var Q = XLSX.utils.sheet_to_json(shQ, { defval: '' }).filter(function (x) { return t(x['Brand']) || t(x['Campaign']); });
console.log('   ⚠ Data_Qcart (la vieja) tiene ' + Q.length + ' filas y 363 fórmulas → NO se toca, conviven');
CAMBIOS.push('se crean 2 hojas nuevas de Qcart con ' + mil(B.qcart.carritos.length + B.qcart.productos.length) + ' eventos');

// ══ 3 · DATA_WHATSAPP ═══════════════════════════════════════════════════════════════
console.log('\n══ Data_WhatsApp ══');
var shW = wb.Sheets['Data_WhatsApp'];
var W = XLSX.utils.sheet_to_json(shW, { defval: '' }).filter(function (x) { return t(x['BU']); });
console.log('   hoy: ' + W.length + ' filas (Σ ' + mil(W.reduce(function (a, x) { return a + num(x['Sends']); }, 0)) + ' sends)');
console.log('   el bloque trae: ' + B.whatsapp.envios.length + ' (Σ ' + mil(B.whatsapp.auditoria.sends_total) + ')');
// ¿alguna fila de hoy desaparecería?
var enBloque = {};
B.whatsapp.envios.forEach(function (e) { enBloque[t(e.campana_raw).toLowerCase() + '¦' + (e.sends || 0)] = 1; });
var perderia = W.filter(function (x) { return !B.whatsapp.envios.some(function (e) { return e.sends === num(x['Sends']); }); });
console.log('   filas de hoy sin equivalente en el bloque: ' + perderia.length);
if (perderia.length) {
  perderia.forEach(function (x) { console.log('        🔴 ' + t(x['Campaña']) + ' · ' + t(x['Segmento_Canonico']) + ' · ' + num(x['Sends'])); });
  PELIGRO.push({ que: perderia.length + ' filas de Data_WhatsApp no están en el bloque', mitigacion: 'se CONSERVAN: la escritura agrega y actualiza, nunca borra filas' });
} else console.log('   ✔ las ' + W.length + ' filas de hoy están todas en el bloque');
CAMBIOS.push('Data_WhatsApp: de ' + W.length + ' a ' + B.whatsapp.envios.length + ' filas');

// ══ 4 · MANUAL ══════════════════════════════════════════════════════════════════════
console.log('\n══ Manual ══');
console.log('   ' + B.manual.datos.length + ' datos → no hay nada que escribir (es el estado normal)');

// ══ EL RESUMEN ══════════════════════════════════════════════════════════════════════
console.log('\n════════ QUÉ VA A PASAR ════════');
CAMBIOS.forEach(function (c) { console.log('   · ' + c); });
console.log('\n════════ LO QUE HAY QUE CUIDAR ════════');
PELIGRO.forEach(function (p) { console.log('   🔴 ' + p.que + '\n      → ' + p.mitigacion); });
var out = { cuando: new Date().toISOString().slice(0, 16), archivo: vivo.archivo, cambios: CAMBIOS, peligros: PELIGRO,
  email: { hoy: E.length, bloque: B.email.envios.length, cambian: suben.length, nuevas: nuevas.length, iguales: iguales, celdas_a_mano: aMano },
  qcart: { crea_hojas: !existeC, eventos: B.qcart.carritos.length + B.qcart.productos.length, data_qcart_intacta: Q.length },
  whatsapp: { hoy: W.length, bloque: B.whatsapp.envios.length, se_perderian: perderia.length } };
fs.writeFileSync(BACK + '/_fuentes/diff-antes-puerta1.json', JSON.stringify(out, null, 1));
console.log('\n  → ' + BACK + '/_fuentes/diff-antes-puerta1.json');
console.log('  ⚠ este paso NO escribió nada.');
