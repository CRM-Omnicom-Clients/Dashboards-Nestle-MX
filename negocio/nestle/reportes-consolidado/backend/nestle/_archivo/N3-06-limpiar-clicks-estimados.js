// PUERTA 1 · quita los clicks ESTIMADOS que el sistema viejo escribió como si fueran medición.
//
// Dos filas de Tercer Tiempo traen `Clicks = 134.88` y `288.6` con `Clicks_Medidos = "NO —
// estimado"`. Esos números no son clicks: son `Read × 0.12`, un CTOR asumido. Estaban desde
// antes de la Puerta 1 — las filas que escribió este sistema ya dejan la celda vacía.
//
// 🔴 Se vacían por coherencia: la hoja no puede afirmar en una columna que el dato NO está medido
//    y a la vez darlo como número en la de al lado. Un decimal en una columna de clicks («134.88
//    clics») es además la firma de que nadie los contó.
//    El valor original queda escrito en Notas, así que no se pierde: cambia de sitio, de una
//    columna donde se lee como medición a una donde se lee como lo que es.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

console.log('════════ clicks estimados → fuera de la columna de clicks ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_limpio.xlsx';
fs.copyFileSync(vivo.ruta, SECO);

var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Data_WhatsApp'];
var r = XLSX.utils.decode_range(sh['!ref']);
var hdr = {};
for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h) hdr[t(h.v)] = c; }
var cCl = hdr['Clicks'], cMe = hdr['Clicks_Medidos'], cNo = hdr['Notas'], cRe = hdr['Opens_Read'];

var objetivo = [];
for (var i = 1; i <= r.e.r; i++) {
  var me = sh[XLSX.utils.encode_cell({ r: i, c: cMe })];
  var cl = sh[XLSX.utils.encode_cell({ r: i, c: cCl })];
  if (!me || !/^no/i.test(t(me.v))) continue;
  if (!cl || t(cl.v) === '') continue;
  var re = sh[XLSX.utils.encode_cell({ r: i, c: cRe })];
  objetivo.push({
    fila: i + 1, valor: cl.v, read: re ? re.v : null,
    factor: (re && re.v) ? +(cl.v / re.v).toFixed(4) : null
  });
}
console.log('  filas con clicks estimados escritos como número: ' + objetivo.length);
objetivo.forEach(function (o) {
  console.log('     fila ' + o.fila + '   Clicks=' + o.valor + '   Read=' + o.read + '   → factor ' + o.factor + '  (es Read × un CTOR asumido)');
});
if (!objetivo.length) { console.log('  nada que hacer'); process.exit(0); }

// editar el XML de la hoja: vaciar Clicks y dejar constancia en Notas
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, a, b) { rmap[a] = b; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Data_WhatsApp') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
var xml = zip.readAsText(parte);
function letra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

objetivo.forEach(function (o) {
  var refCl = letra(cCl) + o.fila;
  // vaciar la celda de Clicks conservando su estilo
  var rx = new RegExp('<c r="' + refCl + '"([^>]*)>(?:(?!</c>).)*</c>');
  if (rx.test(xml)) xml = xml.replace(rx, function (todo, attrs) { return '<c r="' + refCl + '"' + attrs.replace(/\st="[^"]*"/g, '') + '/>'; });
  else xml = xml.replace(new RegExp('<c r="' + refCl + '"[^>]*/>'), '<c r="' + refCl + '"/>');

  // la nota, para que el número no se pierda: cambia de columna, no desaparece
  var refNo = letra(cNo) + o.fila;
  var nota = 'Clicks estimados retirados de la columna: el valor ' + o.valor + ' era Read x ' + o.factor +
    ' (CTOR asumido), no una medicion. La fuente no mide clicks en esta campania.';
  var rxN = new RegExp('<c r="' + refNo + '"([^>]*)>(?:(?!</c>).)*</c>');
  var nueva = '<c r="' + refNo + '" t="inlineStr"><is><t>' + esc(nota) + '</t></is></c>';
  if (rxN.test(xml)) xml = xml.replace(rxN, nueva);
  else if (new RegExp('<c r="' + refNo + '"[^>]*/>').test(xml)) xml = xml.replace(new RegExp('<c r="' + refNo + '"[^>]*/>'), nueva);
  else xml = xml.replace(new RegExp('(<row r="' + o.fila + '"[^>]*>)'), '$1' + nueva);
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));

// releer
var wb2 = XLSX.readFile(SECO);
var W = XLSX.utils.sheet_to_json(wb2.Sheets['Data_WhatsApp'], { defval: '' });
var quedan = W.filter(function (x) { return /^no/i.test(t(x['Clicks_Medidos'])) && t(x['Clicks']) !== ''; });
console.log('\n  ── releído');
console.log('     filas con «No medido» y un número en Clicks: ' + quedan.length + (quedan.length ? '  🔴' : '  ✔'));
var conNota = W.filter(function (x) { return /estimados retirados/i.test(t(x['Notas'])); });
console.log('     filas con la nota puesta: ' + conNota.length);
conNota.forEach(function (x) { console.log('        ' + t(x['Campaña']) + '  ·  ' + t(x['Notas']).slice(0, 76)); });
console.log('\n  archivo listo en: ' + SECO);
