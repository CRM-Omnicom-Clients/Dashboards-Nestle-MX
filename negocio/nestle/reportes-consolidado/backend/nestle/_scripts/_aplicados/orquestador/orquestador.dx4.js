// Dos cosas por aclarar antes de escribir nada:
//   (a) las 15 "filas en dos piezas" — ¿son de verdad compartidas o es mi conteo?
//   (b) las 2 filas de Antojo Infinito sin pieza (154,012 envíos) — ¿por qué no matchean?
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
// ── (a) contar por ÍNDICE de fila, no por content_name (dos filas pueden compartir nombre)
var porK = {};
E.forEach(function (r, i) { r.__i = i; (porK[llaveFila(r)] = porK[llaveFila(r)] || []).push(r); });
var duenos = {};
cat.piezas.forEach(function (p) {
  var k = [p.campana, p.nombre_pieza, p.segmento, p.email_type, t(p.asset_id)].join('¦');
  (porK[k] || []).forEach(function (r) { (duenos[r.__i] = duenos[r.__i] || []).push(p.pieza_id); });
});
var compart = Object.keys(duenos).filter(function (i) { return duenos[i].length > 1; });
console.log('══ (a) ¿alguna FILA cae en dos piezas? ══');
console.log('  filas reclamadas por 2+ piezas: ' + compart.length + (compart.length ? '' : '  ✔ ninguna — cada fila tiene UNA dueña'));
compart.slice(0, 5).forEach(function (i) {
  console.log('     fila ' + i + '  sends=' + num(E[i]['Email_Sends']) + '  → ' + duenos[i].join(' + ') + '   ' + t(E[i]['Email_Content_Name']).slice(-46));
});
var huerf = E.filter(function (r) { return !duenos[r.__i]; });
console.log('  filas sin dueña: ' + huerf.length + '  (' + huerf.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0).toLocaleString() + ' envíos)');

// ── (b) Antojo Infinito
console.log('\n══ (b) Antojo Infinito ══');
console.log('  piezas del catálogo:');
cat.piezas.filter(function (p) { return p.campana === 'Antojo Infinito'; }).forEach(function (p) {
  console.log('    ' + p.pieza_id + '  tp=' + p.nombre_pieza.padEnd(6) + 'seg=' + t(p.segmento).slice(0, 34).padEnd(36) +
    'tipo=' + t(p.email_type).padEnd(11) + 'asset=' + t(p.asset_id).padEnd(9) + 'sends=' + num(p.sends).toLocaleString());
  console.log('        content=' + t(p.content_name).slice(-56));
});
console.log('  filas de Data_Email:');
E.filter(function (r) { return t(r['Campana_Canonica']) === 'Antojo Infinito'; }).forEach(function (r) {
  var camp = t(r['Campana_Canonica']);
  var seg = (A.resolver(IX, 'Segmento', t(r['Segmento_Canonico']), camp, '').v) || t(r['Segmento_Canonico']);
  var tp = (A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v) || t(r['Touchpoint']);
  console.log('    sends=' + String(num(r['Email_Sends'])).padStart(7) + '  tp_raw=' + t(r['Touchpoint']).padEnd(8) + '→' + String(tp).padEnd(6) +
    ' seg=' + t(r['Segmento_Canonico']).slice(0, 34).padEnd(36) + 'tipo=' + t(r['Email_Type']).padEnd(11) + 'asset=' + assetDe(r['Email_Content_Name']));
});
