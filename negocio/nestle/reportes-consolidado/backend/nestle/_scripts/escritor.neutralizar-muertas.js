// VACÍA LAS FÓRMULAS MUERTAS DE TODO EL LIBRO. No borra datos: `#REF!` es la AUSENCIA de un
// dato, no un dato. Una fórmula que apunta a una hoja que ya no existe no calcula nada y además
// impide que la cadena de validación deje escribir el archivo.
//
// ⚠ ESTO NO RETIRA NINGUNA HOJA. `Data_Qcart` sigue con sus 118 filas y sus columnas que sí
//   tienen valor; lo único que se va son las celdas cuya fórmula cita una hoja inexistente.
//   Retirar una hoja es otra decisión, y es de Rick.
//
// USO:  node escritor.neutralizar-muertas.js            → solo cuenta
//       node escritor.neutralizar-muertas.js --escribir → vacía y guarda
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var ENTRADA = (function () { var i = process.argv.indexOf('--archivo'); return i > 0 ? process.argv[i + 1] : null; })();

console.log('════════ fórmulas MUERTAS ' + (ESCRIBIR ? '(se vacían)' : '(solo cuenta)') + ' ════════\n');
var origen = ENTRADA || L.archivoVivo({ dir: PROY }).ruta;
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_neutro.xlsx';
fs.copyFileSync(origen, SECO);
var wb = XLSX.readFile(SECO);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

var total = 0, tocadas = 0;
wb.SheetNames.forEach(function (hoja) {
  var parte = parteDe[hoja]; if (!parte) return;
  var xml;
  try { xml = zip.readAsText(parte); } catch (e) { return; }
  var n = 0;
  // 🔴 `(?![^>]*\/>)` — EXCLUIR LAS CELDAS AUTOCERRADAS. Sin eso, `<c([^>]*)>` también casa
  //    `<c r="V265"/>`: `[^>]*` se come el `/`, y entonces `[\s\S]*?</c>` sigue hacia ADELANTE
  //    hasta el primer `</c>` que encuentre — devorando las celdas de en medio. Así se perdió
  //    el `Email_Content_Name` de la fila de Purina, que estaba después de una celda vacía.
  //    Es exactamente el mismo error que tenía `xlsx-validar-fondo.py` con `<border/>`, y que
  //    se corrigió hoy mismo. El autocerrado es la trampa que hay que mirar SIEMPRE en un
  //    regex sobre XML: una etiqueta vacía no tiene cierre que buscar.
  var nuevo = xml.replace(/<c(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/c>/g, function (todo, attrs, dentro) {
    if (dentro.indexOf('#REF!') < 0) return todo;
    n++;
    return '<c' + attrs.replace(/\st="[^"]*"/g, '') + '/>';
  });
  if (!n) return;
  total += n; tocadas++;
  console.log('   ' + hoja.padEnd(30) + String(n).padStart(5) + ' celdas con #REF!');
  if (ESCRIBIR) zip.updateFile(parte, Buffer.from(nuevo, 'utf8'));
});
console.log('\n   total: ' + total + ' celdas en ' + tocadas + ' hoja(s)');
if (!total) { console.log('   ✔ no hay fórmulas muertas'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n   (no se escribe: falta --escribir)'); process.exit(0); }

zip.writeZip(SECO);
console.log('\n  ── safe-save');
var r = safeSave(SECO, SECO);
console.log('     validado: ' + (r.validado || '?'));
// releer y comprobar que de verdad se fueron
var wb2 = XLSX.readFile(SECO), quedan = 0;
wb2.SheetNames.forEach(function (h) {
  var sh = wb2.Sheets[h]; if (!sh || !sh['!ref']) return;
  var rr = XLSX.utils.decode_range(sh['!ref']);
  for (var i = rr.s.r; i <= rr.e.r; i++) for (var c = rr.s.c; c <= rr.e.c; c++) {
    var cel = sh[XLSX.utils.encode_cell({ r: i, c: c })];
    if (cel && ((cel.f && /#REF!/.test(cel.f)) || String(cel.v) === '#REF!')) quedan++;
  }
});
console.log('     releído: quedan ' + quedan + ' con #REF!' + (quedan ? '  🔴' : '  ✔'));
console.log('\n  archivo listo en: ' + SECO);
