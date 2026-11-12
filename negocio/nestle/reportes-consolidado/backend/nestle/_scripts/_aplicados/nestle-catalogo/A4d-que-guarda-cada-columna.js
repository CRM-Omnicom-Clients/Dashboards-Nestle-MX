// A4d · QUÉ GUARDA CADA COLUMNA, mirando los valores — no el nombre.
//
// 🔴 RICK (21-ago): «Content ID es el final del Email Name, la colita. Email ID es un número nuevo
//    que viene en la DE. No son lo mismo, conservas ambas.»
//    Yo iba a fusionarlas: mi renombre ciego mandaba `Content_ID (SFMC)` a `Email_ID (SFMC)`, que
//    YA EXISTE en Report_Resumen — habría machacado el número de la DE con la colita del nombre.
//    Este paso mira los VALORES para saber qué es cada columna antes de renombrar ninguna.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var F0 = os.homedir() + '/_a4d.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

function huella(vals) {
  var v = vals.filter(function (x) { return t(x); });
  if (!v.length) return '(todo vacío)';
  var numPuro = v.filter(function (x) { return /^\d+$/.test(t(x)); }).length;
  var largo = Math.round(v.reduce(function (a, x) { return a + t(x).length; }, 0) / v.length);
  var tipo = numPuro === v.length ? 'NÚMERO puro' : (largo > 40 ? 'NOMBRE largo' : 'texto corto');
  return tipo + '  ·  ' + v.length + ' con dato  ·  largo medio ' + largo;
}

['Catalogo_Piezas', 'Report_Resumen', 'Data_Email'].forEach(function (hoja) {
  var sh = wb.Sheets[hoja]; if (!sh) return;
  var enc = XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || [];
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  console.log('\n════════ ' + hoja + '  (' + F.length + ' filas · ' + enc.length + ' cols) ════════');
  enc.forEach(function (e) {
    if (!/content|email[_ ]?id|email[_ ]?name|asset/i.test(t(e))) return;
    var vals = F.map(function (r) { return r[t(e)]; });
    var ej = vals.filter(function (x) { return t(x); }).slice(0, 2).map(function (x) { return t(x).length > 54 ? '…' + t(x).slice(-52) : t(x); });
    console.log('   ' + t(e).padEnd(26) + huella(vals).padEnd(46));
    ej.forEach(function (x) { console.log('        ej: ' + x); });
  });
});

console.log('\n\n════════ ¿la colita del Email_Name ES el Content_ID? ════════');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var n = 0, coincide = 0, difiere = [];
P.forEach(function (p) {
  var nom = t(p['Content_Name']).split(/\s*[·|]\s*/)[0], cid = t(p['Content_ID']);
  if (!nom || !cid) return;
  n++;
  var colita = nom.split('_').pop();
  if (colita === cid) coincide++; else difiere.push({ cid: cid, colita: colita, nom: nom.slice(-40) });
});
console.log('   piezas con ambos: ' + n + '   ·   la colita coincide con Content_ID: ' + coincide +
  (difiere.length ? '   🔴 difieren ' + difiere.length : '   ✔'));
difiere.slice(0, 6).forEach(function (d) { console.log('      Content_ID=' + d.cid.padEnd(10) + 'colita=' + d.colita.padEnd(10) + d.nom); });

console.log('\n════════ ¿y el Email_ID de la DE dónde vive en el catálogo? ════════');
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
console.log('   columnas del catálogo que suenan a id: ' +
  enc.filter(function (e) { return /_id|ids$/i.test(t(e)); }).join(' · '));

console.log('\n════════ LAS FILAS 005-P001…P006 ════════');
var muestra = enc.filter(function (e) { return /pieza_id|campa|touchpoint|segmento|content|email|canal/i.test(t(e)); });
P.forEach(function (p, i) {
  if (!/^005-/.test(t(p['Pieza_ID']))) return;
  console.log('   ── fila ' + (i + 2) + '  ' + t(p['Pieza_ID']));
  muestra.forEach(function (c) {
    var v = t(p[c]); if (!v) return;
    console.log('        ' + c.padEnd(26) + (v.length > 56 ? '…' + v.slice(-54) : v));
  });
  var vacias = muestra.filter(function (c) { return !t(p[c]); });
  if (vacias.length) console.log('        (vacías: ' + vacias.join(' · ') + ')');
});
