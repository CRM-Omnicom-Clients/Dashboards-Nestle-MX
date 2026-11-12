// FA2-expandir-compartidas.js — hacer `Report_Resumen` inmune a la rotura por fórmula compartida.
//
// 🔴 POR QUÉ HACE FALTA, MEDIDO. Rick tiene 437 fórmulas en el reporte, y muchas son COMPARTIDAS:
//    una celda MAESTRA lleva el texto y las demás solo apuntan a ella con `<f t="shared" si="N"/>`.
//    En cuanto el sistema reescribe una fila, la maestra puede desaparecer y todas sus esclavas
//    quedan huérfanas → `safe-save` se niega a guardar, con razón: Excel mandaría el libro a
//    reparar. Eso es lo que bloqueó tres intentos seguidos de escribir el reporte.
//
// 🔴 LA SOLUCIÓN NO ES QUITAR LAS FÓRMULAS DE RICK — son suyas y son correctas. Es darle a cada
//    esclava **su propio texto**, con las referencias ya trasladadas. La hoja calcula exactamente
//    lo mismo, y deja de depender de que una celda concreta sobreviva.
//    Es la Regla 3 de `~/.claude/rick-reportes/editar-xlsx-sin-romper.md`.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var expandir = require(os.homedir() + '/.claude/tools/reportes/_expandir-compartidas.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') > -1;

console.log('════════ EXPANDIR FÓRMULAS COMPARTIDAS ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fa2.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var partes = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { partes[n] = rmap[rid]; return _; });

var total = 0;
Object.keys(partes).forEach(function (hoja) {
  var xml; try { xml = zip.readAsText(partes[hoja]); } catch (e) { return; }
  var compartidas = (xml.match(/<f[^>]*t="shared"/g) || []).length;
  if (!compartidas) return;
  // el módulo devuelve { xml, n } — no un string. Leerlo mal daba «nuevo.match is not a function».
  var r = expandir(xml);
  var nuevo = r.xml;
  var quedan = (nuevo.match(/<f[^>]*t="shared"/g) || []).length;
  console.log('  ' + hoja.padEnd(24) + compartidas + ' compartidas → ' + quedan + ' (' + (compartidas - quedan) + ' expandidas)');
  total += compartidas - quedan;
  if (ESCRIBIR) zip.updateFile(partes[hoja], Buffer.from(nuevo, 'utf8'));
});
console.log('\n  total expandidas: ' + total);
if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FA2-expandir-compartidas.js --escribir'); process.exit(0); }

zip.writeZip(SECO);
var res = safeSave(SECO, SECO);
console.log('  safe-save: ' + (res.validado || '?'));
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
// 🔴 el número de fórmulas NO puede bajar: expandir no quita ninguna, les da texto propio.
var wb2 = XLSX.readFile(SECO);
var R2 = XLSX.utils.sheet_to_json(wb2.Sheets['Report_Resumen'], { defval: '', blankrows: false });
console.log('  releído: Report_Resumen ' + R2.length + ' filas · ' + Object.keys(R2[0]).length + ' columnas');
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ expandidas y publicadas — la hoja ya no depende de que una celda maestra sobreviva');
