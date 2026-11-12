// Hipótesis: la llave fila→pieza es dims + ASSET_ID (el número final del content_name).
// Por eso 001-P001 (863587) y 001-P023 (803867) son piezas distintas y AMBAS correctas.
// Si la hipótesis es buena, Σ por esa llave == Sends en TODAS las piezas.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var wb = XLSX.readFile(os.homedir() + '/_fc.xlsx');
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var IX = A.indexar(R);
var assetDe = function (s) { return (t(s).match(/_(\d{4,})\s*$/) || [])[1] || ''; };

function llaveFila(r) {
  var camp = t(r['Campana_Canonica']);
  var seg = (A.resolver(IX, 'Segmento', t(r['Segmento_Canonico']), camp, '').v) || t(r['Segmento_Canonico']);
  var tp = (A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v) || t(r['Touchpoint']);
  return [camp, tp, seg, t(r['Email_Type']), assetDe(r['Email_Content_Name'])].join('¦');
}
var porK = {};
E.forEach(function (r) { (porK[llaveFila(r)] = porK[llaveFila(r)] || []).push(r); });

var ok = 0, mal = [], sinFilas = 0;
cat.piezas.forEach(function (p) {
  var k = [p.campana, p.nombre_pieza, p.segmento, p.email_type, t(p.asset_id)].join('¦');
  var filas = porK[k] || [];
  if (!filas.length) { sinFilas++; return; }
  var s = filas.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
  if (s === num(p.sends)) ok++;
  else mal.push(p.pieza_id + ' ' + s.toLocaleString() + '≠' + num(p.sends).toLocaleString() + ' (' + filas.length + ' filas · asset ' + t(p.asset_id) + ')');
});
console.log('══ llave  campaña¦touchpoint¦segmento¦email_type¦ASSET_ID ══');
console.log('  piezas cuyo Σ CUADRA con Sends : ' + ok);
console.log('  piezas que NO cuadran          : ' + mal.length);
mal.slice(0, 8).forEach(function (x) { console.log('     ' + x); });
console.log('  piezas sin filas por esa llave : ' + sinFilas + '  (WhatsApp, Liga MX, Mundial WA)');

// ¿cada fila cae en EXACTAMENTE una pieza? (ni huérfana ni compartida)
var reclamada = {};
cat.piezas.forEach(function (p) {
  var k = [p.campana, p.nombre_pieza, p.segmento, p.email_type, t(p.asset_id)].join('¦');
  (porK[k] || []).forEach(function (r) { var c = t(r['Email_Content_Name']); (reclamada[c] = reclamada[c] || []).push(p.pieza_id); });
});
var huerf = E.filter(function (r) { return !reclamada[t(r['Email_Content_Name'])]; });
var compart = Object.keys(reclamada).filter(function (c) { return reclamada[c].length > 1; });
console.log('\n  filas sin pieza          : ' + huerf.length + (huerf.length ? ' (' + huerf.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0).toLocaleString() + ' envíos)' : ''));
huerf.slice(0, 5).forEach(function (r) { console.log('     ' + String(num(r['Email_Sends'])).padStart(7) + '  ' + t(r['Campana_Canonica']).padEnd(14) + t(r['Email_Content_Name']).slice(-52)); });
console.log('  filas en DOS piezas      : ' + compart.length);
