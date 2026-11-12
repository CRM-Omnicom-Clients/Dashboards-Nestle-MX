// escritor-formato-datos · ANCHOS Y ENCABEZADO CONGELADO para todas las hojas de datos.
//
// 🔴 ESTO SOLO SE VE MIRANDO EL RENDER. Ninguna suma lo detecta: `Send_Date` salía «46175» en vez
//    de «2/6/26», los nombres de shortlink truncados, y las columnas recién creadas nacen con el
//    ancho por defecto. El archivo estaba «bien» en las cuatro capas de validación y se veía mal.
//
// El ancho se decide por el CONTENIDO REAL de la columna, no por una tabla clavada: se mide el
// valor más largo y se acota. Así una columna nueva queda bien sin que nadie la añada a una lista.
// ⚠ Se acota a 46: sin tope, una URL de 300 caracteres haría una columna inusable.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'escritor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var C = require(require('path').resolve(__dirname, '..') + '/_contratos/hojas.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ escritor-formato-datos · anchos y encabezado congelado ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_fmt.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

// 🔴 `Report_Resumen` NO ESTÁ EN EL CONTRATO —el contrato describe las hojas de DATOS— así que
//    nunca recibía anchos: sus 83 columnas estaban las 83 sin declarar y el render lo enseñó,
//    «Recetas Nestlé» se leía «cetas Nes». Y no basta con agregarla a la lista: resumen-regenerar la REGENERA
//    después de este paso, así que el formato se perdería. Por eso el script acepta `--hoja`, y el
//    orquestador lo vuelve a llamar sobre el reporte cuando ya está construido.
//    La regla del ancho es la misma para las dos pasadas — una sola implementación.
var SOLO = (function () { var i = process.argv.indexOf('--hoja'); return i > 0 ? process.argv[i + 1] : null; })();
var LISTA = SOLO ? [SOLO] : Object.keys(C.hojas);
LISTA.forEach(function (hoja) {
  var sh = wb.Sheets[hoja], parte = parteDe[hoja];
  if (!sh || !parte) { console.log('  ⚠ ' + hoja + ' no está'); return; }
  var r = XLSX.utils.decode_range(sh['!ref']);
  var anchos = [];
  for (var c = r.s.c; c <= r.e.c; c++) {
    var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })];
    var nom = h ? t(h.v) : '';
    if (!nom) { anchos.push(null); continue; }
    var max = nom.length;
    // se muestrea hasta 400 filas: suficiente para el ancho, y no cuesta abrir el libro entero
    for (var i = 1; i <= Math.min(r.e.r, 400); i++) {
      var cel = sh[XLSX.utils.encode_cell({ r: i, c: c })];
      if (!cel) continue;
      var v = t(cel.w || cel.v);
      // una fecha se muestra como «2/6/26», no como su serial: el ancho es el del formato
      if (typeof cel.v === 'number' && /date|fecha/i.test(nom) && v.length > 12) v = '00/00/0000';
      if (v.length > max) max = v.length;
    }
    anchos.push(Math.max(9, Math.min(46, max + 3)));
  }
  var xml = zip.readAsText(parte);
  // 🔴 LA LIMPIEZA NO PUEDE DEPENDER DE QUE EXISTA `<cols>`. Esto decía «si hay cols, borra desde
  //    sheetViews hasta /cols», y ahí se apoyaba en que los tres bloques viajaran juntos. Dejan de
  //    viajar juntos en cuanto otro paso toca la hoja: `escritor.retirar.js` elimina `<cols>` al
  //    retirar una columna —los anchos ya no corresponden— y deja `sheetViews` y `sheetFormatPr`
  //    donde estaban. Entonces esta condición daba falso, no limpiaba nada, y la cabeza nueva se
  //    insertaba DETRÁS del `sheetFormatPr` viejo: el orden quedaba `sheetFormatPr → sheetViews`,
  //    que OOXML no permite, y Excel repara el archivo al abrirlo.
  //    Lo detectó `xlsx-check` y la cadena se negó a publicar — el guard hizo su trabajo. Pero el
  //    defecto estaba aquí, en quien inserta, no en quien retira: se arregla en el creador.
  //    Ahora se quita cada bloque por separado, exista o no el de al lado.
  var rehecho = /<cols>|<sheetFormatPr/.test(xml);
  xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, '')
           .replace(/<sheetFormatPr\b[^>]*\/>/, '')
           .replace(/<sheetFormatPr\b[\s\S]*?<\/sheetFormatPr>/, '')
           .replace(/<cols>[\s\S]*?<\/cols>/, '');
  var defs = anchos.map(function (w, i) {
    if (!w) return '';
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
  }).filter(Boolean).join('');
  var cabeza = '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/><cols>' + defs + '</cols>';
  xml = xml.replace('<sheetData>', cabeza + '<sheetData>');
  zip.updateFile(parte, Buffer.from(xml, 'utf8'));
  console.log('  ✔ ' + hoja.padEnd(24) + anchos.filter(Boolean).length + ' columnas' +
    (rehecho ? ' (rehecho)' : '') + '   ancho medio ' +
    Math.round(anchos.filter(Boolean).reduce(function (a, x) { return a + x; }, 0) / anchos.filter(Boolean).length));
});
zip.writeZip(SECO);
console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));
// releer: ningún dato se movió
var wb2 = XLSX.readFile(SECO);
LISTA.forEach(function (h) {   // la misma lista que se formateó: verificar otra hoja no prueba nada
  var a = XLSX.utils.sheet_to_json(wb.Sheets[h] || {}, { defval: '' }).length;
  var b = XLSX.utils.sheet_to_json(wb2.Sheets[h] || {}, { defval: '' }).length;
  console.log('     ' + h.padEnd(24) + a + ' → ' + b + (a === b ? '  ✔' : '  🔴'));
});
console.log('\n  archivo listo en: ' + SECO);
