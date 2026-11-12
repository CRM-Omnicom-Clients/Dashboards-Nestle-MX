// FA3-quitar-anexadas.js — deshacer las filas que el escritor anexó de más al Report_Resumen.
//
// 🔴 QUÉ PASÓ. `N6` empareja cada celda de la rejilla con una fila de la hoja por la llave
//    `Campaña¦Objetivo¦TouchPoint¦Segmento¦Quincena`. Al corregir el catálogo, las piezas de
//    WhatsApp de Mundial cambiaron de touchpoint (`WA-P2` → `WA-SF-A`…) y varias piezas cambiaron
//    de quincena. Con eso **la llave dejó de coincidir con las filas que Rick ya tenía**, así que
//    el escritor las dio por nuevas y las ANEXÓ — dejando la vieja y la nueva a la vez.
//    Resultado: la hoja pasó de 73 a 82 filas y los totales se DOBLARON (12.6M contra 6.2M reales).
//    La Puerta 2 lo atrapó y se negó a dar el reporte por bueno, que es exactamente su trabajo.
//
// 🔴 LA LECCIÓN, y por eso N6 deja de anexar: **cuando la identidad de una pieza cambia, el
//    escritor no puede saber si es una fila nueva o la misma con otro nombre.** Anexar da
//    duplicados silenciosos; actualizar a ciegas pisa lo que no es. Lo único honesto es
//    ACTUALIZAR lo que empareja y DECLARAR lo que no, para que lo decida el humano.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ QUITAR FILAS ANEXADAS ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fa3.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var contrato = JSON.parse(fs.readFileSync(BACK + '/_contratos/report-resumen-layout.json', 'utf8'));
console.log('  hoja hoy: ' + R.length + ' filas   ·   contrato congelado: ' + contrato.n_filas);
var sobran = R.length - contrato.n_filas;
if (sobran <= 0) { console.log('\n  ✔ no sobra ninguna fila'); process.exit(0); }
console.log('  🔴 sobran ' + sobran + ' filas anexadas\n');
// las anexadas están al final: de (contrato.n_filas + 2) en adelante en numeración de hoja
var desde = contrato.n_filas + 2;
R.slice(contrato.n_filas).forEach(function (x, k) {
  console.log('     fila ' + (desde + k) + '  ' + t(x['Campaña']).padEnd(16).slice(0, 16) +
    t(x['TouchPoint']).padEnd(10) + t(x['Segmento']).padEnd(22).slice(0, 22) + ' ' + t(x['Quincena_Lanzamiento']));
});
if (!ESCRIBIR) { console.log('\n  seco. Para quitarlas: node FA3-quitar-anexadas.js --escribir'); process.exit(0); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var quitadas = 0;
xml = xml.replace(/<row r="(\d+)"(?![^>]*\/>)[^>]*>[\s\S]*?<\/row>|<row r="(\d+)"[^>]*\/>/g, function (todo, a, b) {
  var n = +(a || b);
  if (n >= desde) { quitadas++; return ''; }
  return todo;
});
console.log('\n  filas quitadas: ' + quitadas);
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var R2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Report_Resumen'], { defval: '', blankrows: false });
console.log('  releído: ' + R2.length + ' filas (contrato: ' + contrato.n_filas + ')' + (R2.length === contrato.n_filas ? '  ✔' : '  🔴'));
if (R2.length !== contrato.n_filas) { console.log('  🔴 no se publica'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ reporte devuelto a sus ' + contrato.n_filas + ' filas');
