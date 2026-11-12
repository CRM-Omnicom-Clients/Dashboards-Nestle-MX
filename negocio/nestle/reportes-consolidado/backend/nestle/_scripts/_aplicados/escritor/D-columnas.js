// D-columnas · AJUSTAR LOS ENCABEZADOS DEL Report_Resumen a lo que pidió Rick (21-ago).
//
//   · D3 · renombrar `Clicks_Links_Total` → `Clicks_Unicos_Total` (el nombre tiene que decir lo que es)
//   · D4 · agregar las 6 tasas de destino: %_Qcart · %_App · %_Social · %_Web · %_Ver_Navegador · %_Unsub
//   · F3 · agregar `Email_Name` y `Principal_Subject` (el reporte tenía FUP_Subject pero no el Principal)
//
// 🔴 SOLO TOCA LA FILA 1 (encabezados) y extiende la dimensión. No escribe datos: eso lo hace N6
//    después, que ya sabe llenar estas columnas por su nombre. Las nuevas van AL FINAL —no en medio—
//    para no correr las columnas que las fórmulas de totales referencian por letra.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var RENOMBRAR = { 'Clicks_Links_Total': 'Clicks_Unicos_Total' };
var NUEVAS = ['%_Qcart', '%_App', '%_Social', '%_Web', '%_Ver_Navegador', '%_Unsub', 'Email_Name', 'Principal_Subject'];

console.log('════════ D-columnas ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_dcol.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0].map(t);
console.log('  encabezados hoy: ' + enc.length);

// qué renombra y qué agrega, contra la hoja de HOY
var aRenombrar = Object.keys(RENOMBRAR).filter(function (v) { return enc.indexOf(v) >= 0; });
var yaHay = NUEVAS.filter(function (v) { return enc.indexOf(v) >= 0; });
var aAgregar = NUEVAS.filter(function (v) { return enc.indexOf(v) < 0; });
console.log('  renombra: ' + (aRenombrar.map(function (v) { return v + '→' + RENOMBRAR[v]; }).join(' · ') || '—'));
console.log('  agrega:   ' + (aAgregar.join(' · ') || '—') + (yaHay.length ? '   (ya existían: ' + yaHay.join(' · ') + ')' : ''));

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// libre
try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); } catch (e) { console.log('\n  🔴 el vivo está TOMADO (' + e.code + '). Cierra Excel.'); process.exit(2); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var estH = CX.estiloDe(xml, 'A1');

// 1 · renombrar en su sitio
aRenombrar.forEach(function (v) {
  var i = enc.indexOf(v), ref = col(i) + '1';
  xml = CX.poner(xml, ref, CX.celda(ref, RENOMBRAR[v], CX.estiloDe(xml, ref) || estH), 1).xml;
});
// 2 · agregar al final de la fila 1
var base = enc.length;
aAgregar.forEach(function (v, k) {
  var i = base + k, ref = col(i) + '1';
  xml = CX.poner(xml, ref, CX.celda(ref, v, estH), 1).xml;
});
// 3 · extender la dimensión
var maxCol = col(base + aAgregar.length - 1);
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + maxCol + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

// las capas
var cp = require('child_process'); var TOOLS = os.homedir() + '/.claude/tools';
function q(x) { return String.fromCharCode(34) + x + String.fromCharCode(34); }
console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-label.js') + ' ' + q(SECO), { timeout: 120000 });
cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-check.js') + ' ' + q(SECO), { timeout: 120000 });
console.log('  ── etiqueta + check ✔');

var antes = fs.statSync(vivo.ruta).mtimeMs;
fs.copyFileSync(SECO, vivo.ruta);
if (fs.statSync(vivo.ruta).mtimeMs <= antes) { console.log('  🔴 no quedó'); process.exit(2); }
var wb2 = XLSX.readFile(vivo.ruta);
var enc2 = XLSX.utils.sheet_to_json(wb2.Sheets['Report_Resumen'], { header: 1 })[0].map(t);
console.log('\n  ✔ publicado · encabezados ahora: ' + enc2.length);
console.log('     Clicks_Unicos_Total: ' + (enc2.indexOf('Clicks_Unicos_Total') >= 0 ? '✔' : '🔴') +
  '   ·   nuevas presentes: ' + NUEVAS.filter(function (v) { return enc2.indexOf(v) >= 0; }).length + '/' + NUEVAS.length);
