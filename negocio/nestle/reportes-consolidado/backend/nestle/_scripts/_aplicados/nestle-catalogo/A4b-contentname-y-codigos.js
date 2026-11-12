// A4b · DOS COSAS: los 8 códigos con sus utms, y el ContentName en TODAS las hojas.
//
// 🔴 REGLA DE RICK (21-ago): **ContentName = EmailName**, y está completo en catálogo, reportes y
//    demás. **No puede haber vacíos salvo en WhatsApp**, que no tiene EmailName porque no es un
//    correo. Este paso lo mide hoja por hoja en vez de asumir que lo de ayer sigue siendo cierto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var C0 = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var LOS8 = ['SD0eqGtK', 'GQnvqqP3', 'CDoLolmJ', 'piPZpvXp', 'CVCPHfND', 'TjDcVdNI', 'bgsOdlLo', 'J2Q8RKyO'];

console.log('════════ A4b ════════\n');
console.log('══ 1 · LOS 8 CÓDIGOS QUE QUITÉ, CON SUS UTMS ══\n');
var lec = C0.leerVigentes(PROY + '/ReportesQcart/_vigentes');
var todos = (lec.carritos || []).concat(lec.productos || []);
var g = {};
todos.forEach(function (e) {
  var c = t(e.shortlink_code);
  if (LOS8.indexOf(c) < 0) return;
  g[c] = g[c] || { cod: c, nombre: t(e.shortlink_name), n: 0, campaign: {}, medium: {}, source: {}, content: {}, term: {}, store: {}, desde: '', hasta: '' };
  var x = g[c]; x.n++;
  ['utm_campaign', 'utm_medium', 'utm_source', 'utm_content', 'utm_term'].forEach(function (k) {
    var v = t(e[k]); if (v) x[k.replace('utm_', '')][v] = (x[k.replace('utm_', '')][v] || 0) + 1;
  });
  var st = t(e.store); if (st) x.store[st] = 1;
  var f = t(e.fecha).slice(0, 10);
  if (f) { if (!x.desde || f < x.desde) x.desde = f; if (!x.hasta || f > x.hasta) x.hasta = f; }
});
LOS8.forEach(function (c) {
  var x = g[c];
  if (!x) { console.log('   ' + c + '   (sin eventos en los CSV)'); return; }
  console.log('   ' + c + '   «' + x.nombre + '»   ' + x.n + ' eventos   ' + x.desde + ' → ' + x.hasta);
  console.log('        utm_campaign : ' + Object.keys(x.campaign).join(' · '));
  console.log('        utm_medium   : ' + Object.keys(x.medium).join(' · ') + '        utm_source: ' + Object.keys(x.source).join(' · '));
  console.log('        utm_content  : ' + (Object.keys(x.content).join(' · ') || '(vacío)') + '        utm_term: ' + (Object.keys(x.term).join(' · ') || '(vacío)'));
  console.log('        tienda       : ' + Object.keys(x.store).join(' · '));
});

console.log('\n\n══ 2 · ContentName EN TODAS LAS HOJAS ══');
console.log('   regla: ContentName = EmailName. Completo salvo en WhatsApp, que no es correo.\n');
var F0 = os.homedir() + '/_a4b.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

// dónde vive el ContentName en cada hoja
var DONDE = [
  { hoja: 'Catalogo_Piezas', col: 'Content_Name', canal: 'Canal', id: 'Pieza_ID' },
  { hoja: 'Data_Email', col: 'Email_Content_Name', canal: null, id: 'pieza_id' },
  { hoja: 'Report_Resumen', col: 'Content_ID (SFMC)', canal: 'Medio', id: 'TouchPoint' },
  { hoja: 'Catalogo_Referencias', col: null, canal: null, id: null }
];
DONDE.forEach(function (D) {
  var sh = wb.Sheets[D.hoja];
  if (!sh) { console.log('   ⊘ ' + D.hoja + ' no existe'); return; }
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  if (!D.col) {
    var cols = Object.keys(F[0] || {}).filter(function (c) { return /content|emailname/i.test(c); });
    console.log('   ○ ' + D.hoja.padEnd(24) + (cols.length ? 'columnas parecidas: ' + cols.join(' · ') : 'no lleva ContentName'));
    return;
  }
  if (Object.keys(F[0] || {}).indexOf(D.col) < 0) { console.log('   🔴 ' + D.hoja.padEnd(24) + 'no tiene la columna «' + D.col + '»'); return; }
  var conDatos = F.filter(function (x) { return D.hoja !== 'Report_Resumen' || t(x['TouchPoint']); });
  var vacias = conDatos.filter(function (x) { return !t(x[D.col]); });
  var vaciasWA = vacias.filter(function (x) { return D.canal && /whats|wa/i.test(t(x[D.canal])); });
  var vaciasNoWA = vacias.filter(function (x) { return !(D.canal && /whats|wa/i.test(t(x[D.canal]))); });
  console.log('   ' + (vaciasNoWA.length ? '🔴' : '✔') + ' ' + D.hoja.padEnd(24) + mil(conDatos.length).padStart(6) + ' filas   ' +
    'vacías: ' + vacias.length + '   de ellas WhatsApp: ' + vaciasWA.length + '   🔴 SIN excusa: ' + vaciasNoWA.length);
  vaciasNoWA.slice(0, 14).forEach(function (x) {
    console.log('        ' + t(x[D.id]).padEnd(12) + (D.canal ? t(x[D.canal]).padEnd(12) : '') +
      Object.keys(x).filter(function (k) { return /campa/i.test(k); }).map(function (k) { return t(x[k]); }).join(' ').slice(0, 34));
  });
  if (vaciasNoWA.length > 14) console.log('        … y ' + (vaciasNoWA.length - 14) + ' más');
});

console.log('\n\n══ 3 · ¿el ContentName del catálogo coincide con el de SFMC? ══');
var D2 = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var catCN = {};
P.forEach(function (p) { t(p[N('content_name')]).split(/\s*[·|]\s*/).forEach(function (cn) { if (t(cn)) catCN[t(cn)] = t(p[N('pieza_id')]); }); });
var sfmcSinCat = D2.rows.filter(function (r) { return !catCN[t(r.Email_Content_Name)]; });
console.log('   piezas en SFMC: ' + D2.count + '   ·   con ContentName en el catálogo: ' + (D2.count - sfmcSinCat.length) +
  '   ' + (sfmcSinCat.length ? '🔴 faltan ' + sfmcSinCat.length : '✔'));
sfmcSinCat.slice(0, 10).forEach(function (r) {
  console.log('        eid ' + t(r.Email_ID).padEnd(8) + t(r.Campana).padEnd(16) + mil(r.Email_Sends).padStart(9) + '  …' + t(r.Email_Content_Name).slice(-46));
});
