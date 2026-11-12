// FB7-nomenclatura-rick.js — B: el catálogo adopta la nomenclatura de Rick para los touchpoints
// de WhatsApp de Mundial.
//
// 🔴 DECISIÓN DE RICK (20-ago): «respeta mi nomenclatura». El catálogo los llamaba `WA-P2`,
//    `WA-SF-A`, `WA-FINAL`; Rick los tiene en el reporte como `Partido 2`, `Partido 3`,
//    `Semifinal A`, `Semifinal B`, `Final`. Mientras no coincidan, la llave del reporte no empareja
//    y esas 5 filas suyas se quedan sin datos aunque los datos existan.
//
// ⚠ LO QUE **NO** SE COPIA DE SU HOJA: las QUINCENAS. Sus filas tienen `Partido 3` en Jul-Q1 y
//   `Final` en Jul-Q1, pero la fuente dice 26-jun (Jun-Q2) y 19-jul (Jul-Q2). En fechas manda la
//   fuente — es su propia regla. Se respeta el NOMBRE, se corrige la FECHA. Y como el touchpoint
//   ya identifica al partido sin ambigüedad, el emparejamiento no necesita la quincena.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// el nombre que Rick usa, tal cual está en su hoja
var NOMBRE_RICK = {
  '004-P010': 'Partido 2', '004-P013': 'Partido 3',
  '004-P017': 'Semifinal A', '004-P018': 'Semifinal B', '004-P019': 'Final'
};

console.log('════════ B · NOMENCLATURA DE RICK ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fb7.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS = Object.keys(P[0]); var idx = {}; COLS.forEach(function (c, i) { idx[c] = i; });
var cambios = [];
P.forEach(function (p, i) {
  var id = t(p['Pieza_ID']), n = NOMBRE_RICK[id]; if (!n) return;
  if (t(p['Touchpoint']) !== n) {
    cambios.push({ fila: i + 2, col: 'Touchpoint', de: t(p['Touchpoint']), a: n, pieza: id });
  }
});
console.log('  ── touchpoints que adoptan el nombre de Rick: ' + cambios.length);
cambios.forEach(function (c) { console.log('     ' + c.pieza + '  «' + c.de + '» → «' + c.a + '»'); });
if (!cambios.length) { console.log('     ✔ ya coinciden'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FB7-nomenclatura-rick.js --escribir'); process.exit(0); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
cambios.forEach(function (c) {
  var i = idx[c.col];
  xml = CX.poner(xml, col(i) + c.fila, CX.celda(col(i) + c.fila, c.a, CX.estiloDe(xml, col(i) + '2')), c.fila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
if (P2.length !== P.length) { console.log('  🔴 cambió el nº de filas'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ ' + cambios.length + ' touchpoints con la nomenclatura de Rick');
