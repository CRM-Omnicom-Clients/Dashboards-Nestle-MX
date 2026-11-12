// ¿De dónde salen los 70,421 de 001-P001 si su content_name solo suma 34,450?
// Hipótesis: la pieza agregó filas por DIMENSIÓN (campaña+tp+segmento+tipo) pero guardó
// solo UN content_name. Si es así, Content_Names_Variantes miente por omisión.
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

// resolver cada fila de Data_Email a (campaña, touchpoint, segmento, tipo) con la escalera real
function dimsDe(r) {
  var camp = t(r['Campana_Canonica']);
  var seg = (A.resolver(IX, 'Segmento', t(r['Segmento_Canonico']), camp, '').v) || t(r['Segmento_Canonico']);
  var tp = (A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v) || t(r['Touchpoint']);
  return { camp: camp, tp: tp, seg: seg, tipo: t(r['Email_Type']) };
}
var porDim = {};
E.forEach(function (r) {
  var d = dimsDe(r);
  var k = [d.camp, d.tp, d.seg, d.tipo].join('¦');
  (porDim[k] = porDim[k] || []).push(r);
});

console.log('══ las 4 primeras piezas que descuadraban ══\n');
['001-P001', '001-P002', '001-P003', '001-P004'].forEach(function (id) {
  var p = cat.piezas.filter(function (x) { return x.pieza_id === id; })[0];
  var k = [p.campana, p.nombre_pieza, p.segmento, p.email_type].join('¦');
  var filas = porDim[k] || [];
  var suma = filas.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
  var cn = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  console.log('  ' + id + '  ' + p.campana + ' / ' + p.nombre_pieza + ' / ' + p.segmento + ' / ' + p.email_type);
  console.log('     Sends declarado          : ' + num(p.sends).toLocaleString());
  console.log('     Σ por DIMENSIÓN          : ' + suma.toLocaleString() + '  (' + filas.length + ' filas)  ' + (suma === num(p.sends) ? '✔ CUADRA' : '🔴'));
  console.log('     content_names listados   : ' + cn.length);
  var faltan = filas.map(function (r) { return t(r['Email_Content_Name']); }).filter(function (c) { return cn.indexOf(c) < 0; });
  console.log('     content_names NO listados: ' + faltan.length + (faltan.length ? '  ← Content_Names_Variantes incompleto' : ''));
  faltan.slice(0, 3).forEach(function (c) {
    var f = filas.filter(function (r) { return t(r['Email_Content_Name']) === c; })[0];
    console.log('        · ' + String(num(f['Email_Sends'])).padStart(7) + '  ' + c.slice(-58));
  });
  console.log('');
});

// ¿cuántas piezas en total tienen el content_names incompleto?
var incompletas = 0, filasNoListadas = 0, sendsNoListados = 0;
cat.piezas.forEach(function (p) {
  var k = [p.campana, p.nombre_pieza, p.segmento, p.email_type].join('¦');
  var filas = porDim[k] || []; if (!filas.length) return;
  var cn = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  var faltan = filas.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) < 0; });
  if (faltan.length) { incompletas++; filasNoListadas += faltan.length; sendsNoListados += faltan.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0); }
});
console.log('══ alcance del problema ══');
console.log('  piezas con Content_Names_Variantes incompleto: ' + incompletas + '/' + cat.piezas.length);
console.log('  filas de Data_Email no listadas por su pieza : ' + filasNoListadas + '/' + E.length +
  '  (' + sendsNoListados.toLocaleString() + ' envíos)');
console.log('\n  → si esto es así, el reparto por quincena DEBE calcularse por DIMENSIÓN,');
console.log('    no por content_name — y de paso se completa Content_Names_Variantes.');
