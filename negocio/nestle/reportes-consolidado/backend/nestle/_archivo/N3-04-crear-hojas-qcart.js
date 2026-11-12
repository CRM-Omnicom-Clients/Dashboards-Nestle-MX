// PUERTA 1 · crea Data_Qcart_Carritos y Data_Qcart_Productos.
//
// 🔴 NO se puede usar SheetJS para escribir: `writeFile` BORRA todos los estilos de celda y los
//    colores de pestaña del libro entero. Aquí se agregan las hojas por XML con adm-zip, que
//    deja intacto todo lo demás, y se cierra con safe-save (que repara el paquete y valida
//    ANTES de escribir).
//
// ⚠ `Data_Qcart` (la vieja, con sus 363 fórmulas) NO se toca. Las dos hojas nuevas CONVIVEN con
//    ella. Sustituirla es otra decisión, de Rick.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');       // caracteres que rompen el XML
}
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

/** arma el XML de una hoja a partir de filas de objetos */
function hojaXml(cols, filas) {
  var out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetData>'];
  // encabezado
  out.push('<row r="1">' + cols.map(function (c, i) {
    return '<c r="' + col(i) + '1" t="inlineStr"><is><t>' + esc(c) + '</t></is></c>';
  }).join('') + '</row>');
  filas.forEach(function (f, k) {
    var celdas = cols.map(function (c, i) {
      var v = f[c];
      if (v === null || v === undefined || v === '') return '';
      var ref = col(i) + (k + 2);
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
    }).filter(Boolean).join('');
    out.push('<row r="' + (k + 2) + '">' + celdas + '</row>');
  });
  out.push('</sheetData></worksheet>');
  return out.join('');
}

console.log('════════ PUERTA 1 · las dos hojas de Qcart ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_qhojas.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// las columnas de cada hoja: crudo + el ancla. NINGUNA calculada.
var COLS = ['pieza_id', 'fecha', 'hora', 'shortlink_code', 'shortlink_name',
  'utm_campaign', 'utm_medium', 'utm_source', 'utm_content', 'utm_term',
  'store', 'n_tiendas', 'product', 'impressions', 'views', 'total_shown_price',
  'activacion_link', 'link_campana', 'fuente', 'fila_en_csv', 'aviso'];

var HOJAS = [
  { nombre: 'Data_Qcart_Carritos', filas: B.carritos, cols: COLS.filter(function (c) { return c !== 'product'; }) },
  { nombre: 'Data_Qcart_Productos', filas: B.productos, cols: COLS }
];

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var ct = zip.readAsText('[Content_Types].xml');

// el próximo rId y el próximo sheetN libres
var maxRid = 0;
rels.replace(/Id="rId(\d+)"/g, function (_, n) { maxRid = Math.max(maxRid, +n); return _; });
var maxSheet = 0;
zip.getEntries().forEach(function (e) { var m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(e.entryName); if (m) maxSheet = Math.max(maxSheet, +m[1]); });
var maxSid = 0;
wbx.replace(/sheetId="(\d+)"/g, function (_, n) { maxSid = Math.max(maxSid, +n); return _; });

HOJAS.forEach(function (h) {
  if (wbx.indexOf('name="' + h.nombre + '"') >= 0) { console.log('  ⚠ «' + h.nombre + '» ya existe, se salta'); return; }
  maxRid++; maxSheet++; maxSid++;
  var parte = 'xl/worksheets/sheet' + maxSheet + '.xml';
  var xml = hojaXml(h.cols, h.filas);
  zip.addFile(parte, Buffer.from(xml, 'utf8'));
  rels = rels.replace('</Relationships>',
    '<Relationship Id="rId' + maxRid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + maxSheet + '.xml"/></Relationships>');
  wbx = wbx.replace('</sheets>',
    '<sheet name="' + esc(h.nombre) + '" sheetId="' + maxSid + '" r:id="rId' + maxRid + '"/></sheets>');
  ct = ct.replace('</Types>',
    '<Override PartName="/' + parte + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  console.log('  ✔ ' + h.nombre.padEnd(24) + h.filas.length.toLocaleString('es-MX').padStart(6) + ' filas × ' + h.cols.length + ' cols   → ' + parte);
});

zip.updateFile('xl/workbook.xml', Buffer.from(wbx, 'utf8'));
zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
zip.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
zip.writeZip(SECO);

console.log('\n  ── safe-save (repara el paquete y valida ANTES de escribir)');
var r = safeSave(SECO, SECO);
console.log('     validado: ' + (r.validado || '?') + '   partes: ' + r.partes);

// verificar releyendo
var wb2 = XLSX.readFile(SECO);
console.log('\n  ── releído');
console.log('     hojas: ' + wb2.SheetNames.length + '   ' + wb2.SheetNames.join(' · '));
HOJAS.forEach(function (h) {
  var sh = wb2.Sheets[h.nombre];
  if (!sh) { console.log('     🔴 ' + h.nombre + ' NO se creó'); return; }
  var f = XLSX.utils.sheet_to_json(sh, { defval: '' });
  var suma = f.reduce(function (a, x) { return a + (Number(x.views) || 0); }, 0);
  console.log('     ' + h.nombre.padEnd(24) + f.length.toLocaleString('es-MX').padStart(6) + ' filas   Σ views ' + suma.toLocaleString('es-MX'));
});
var q = wb2.Sheets['Data_Qcart'];
console.log('     Data_Qcart (la vieja): ' + (q ? XLSX.utils.sheet_to_json(q, { defval: '' }).length + ' filas ✔ intacta' : '🔴 desapareció'));
console.log('\n  archivo listo en: ' + SECO);
