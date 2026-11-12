// PUERTA 1 · las dos hojas nuevas se ven mochas. Anchos de columna + encabezado congelado.
//
// 🔴 ESTO LO ENCONTRÓ EL RENDER, NO UNA SUMA. Las 19 validaciones daban verde: filas correctas,
//    totales exactos, ancla completa. Y al mirar el PNG, `fecha` decía «2026-08-1» y los nombres
//    de shortlink, las utm y las URLs salían cortados. Las hojas se crearon por XML a mano y ese
//    XML no llevaba `<cols>`: todas las columnas quedaron con el ancho por defecto.
//
// Se agregan dos cosas, ninguna toca un dato:
//    · anchos por NOMBRE de encabezado — si mañana cambia el orden de las columnas, siguen bien
//    · el encabezado congelado: son 2,538 filas, sin eso se navega a ciegas
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

// ancho por encabezado. Lo que no esté aquí toma un ancho según su largo — nunca se queda corto.
var ANCHO = {
  pieza_id: 11, fecha: 12, hora: 10, shortlink_code: 16, shortlink_name: 34,
  utm_campaign: 32, utm_medium: 12, utm_source: 14, utm_content: 15, utm_term: 20,
  store: 22, n_tiendas: 10, product: 46, impressions: 12, views: 8,
  total_shown_price: 17, activacion_link: 15, link_campana: 26, fuente: 30,
  fila_en_csv: 12, aviso: 46
};

console.log('════════ PUERTA 1 · anchos de las hojas de Qcart ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_qancho.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});

['Data_Qcart_Carritos', 'Data_Qcart_Productos'].forEach(function (hoja) {
  var parte = parteDe[hoja];
  if (!parte) { console.log('  🔴 no encontré ' + hoja); return; }
  var sh = wb.Sheets[hoja];
  var r = XLSX.utils.decode_range(sh['!ref']);
  var cols = [];
  for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; cols.push(h ? t(h.v) : ''); }

  var xml = zip.readAsText(parte);
  // si ya tiene anchos, se REEMPLAZAN: saltar dejaba un ancho malo puesto para siempre
  var rehecho = /<cols>/.test(xml);
  if (rehecho) xml = xml.replace(/<sheetViews>[\s\S]*?<\/cols>/, '');

  var defs = cols.map(function (nom, i) {
    var w = ANCHO[nom] || Math.max(10, Math.min(40, nom.length + 4));
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
  }).join('');

  // orden que exige el esquema: sheetViews → sheetFormatPr → cols → sheetData
  var cabeza = '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols>' + defs + '</cols>';
  xml = xml.replace('<sheetData>', cabeza + '<sheetData>');
  zip.updateFile(parte, Buffer.from(xml, 'utf8'));
  console.log('  ✔ ' + hoja.padEnd(24) + cols.length + ' columnas con ancho · encabezado congelado' + (rehecho ? ' (rehecho)' : ''));
});
zip.writeZip(SECO);

console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));

// releer: los datos no se movieron
var wb2 = XLSX.readFile(SECO);
['Data_Qcart_Carritos', 'Data_Qcart_Productos'].forEach(function (h) {
  var f = XLSX.utils.sheet_to_json(wb2.Sheets[h], { defval: '' });
  var sv = f.reduce(function (a, x) { return a + (Number(x.views) || 0); }, 0);
  console.log('     ' + h.padEnd(24) + f.length.toLocaleString('es-MX').padStart(6) + ' filas · Σ views ' + sv.toLocaleString('es-MX'));
});
console.log('\n  archivo listo en: ' + SECO);
