// Restaurar `Procesos-Rick`, que se perdió al retirar Catalogo_Links.
// Se lee su contenido del respaldo y se reescribe como hoja nueva con texto en línea:
// menos superficie de error que copiar la parte del zip y sus registros.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var AdmZip = require('adm-zip'), XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var PROY = ENT.PROYECTO;
var WB = ENT.LIBRO;
var BK = PROY + '/_backups/v8_antes-P6_1787000820034.xlsx';
var t = function (v) { return v === null || v === undefined ? '' : String(v); };
var esc = function (s) { return t(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); };
var col = XLSX.utils.encode_col;

var Tb = require('path').resolve(__dirname, '..') + '/_tmp/_pr.xlsx'; fs.copyFileSync(BK, Tb);
var F = XLSX.utils.sheet_to_json(XLSX.readFile(Tb).Sheets['Procesos-Rick'], { header: 1, defval: '' });
while (F.length && !F[F.length - 1].some(function (c) { return t(c); })) F.pop();
console.log('contenido rescatado: ' + F.length + ' filas');
F.forEach(function (r, i) { var v = r.map(t).filter(Boolean); if (v.length) console.log('  f' + (i + 1) + ': ' + v.join(' | ').slice(0, 110)); });

var anchos = [];
F.forEach(function (r) { r.forEach(function (c, j) { anchos[j] = Math.max(anchos[j] || 12, Math.min(70, t(c).length + 2)); }); });
var nCols = anchos.length || 2;
var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<dimension ref="A1:' + col(nCols - 1) + Math.max(1, F.length) + '"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>';
for (var j = 0; j < nCols; j++) xml += '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + (anchos[j] || 14) + '" customWidth="1"/>';
xml += '</cols><sheetData>';
F.forEach(function (fila, i) {
  xml += '<row r="' + (i + 1) + '">';
  fila.forEach(function (v, j) {
    if (t(v) === '') return;
    var r = col(j) + (i + 1);
    if (typeof v === 'number' && isFinite(v)) xml += '<c r="' + r + '"><v>' + v + '</v></c>';
    else xml += '<c r="' + r + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  });
  xml += '</row>';
});
xml += '</sheetData></worksheet>';

fs.copyFileSync(WB, PROY + '/_backups/v8_antes-restaurar-procesos.xlsx');
var z = new AdmZip(WB);
var wbXml = z.readAsText('xl/workbook.xml'), rels = z.readAsText('xl/_rels/workbook.xml.rels'), ct = z.readAsText('[Content_Types].xml');
if (/name="Procesos-Rick"/.test(wbXml)) { console.log('\n  ya existe, no se duplica'); process.exit(0); }
var n = 1; while (z.getEntry('xl/worksheets/sheet' + n + '.xml')) n++;
var nr = 1; while (rels.indexOf('Id="rId' + nr + '"') >= 0) nr++;
z.addFile('xl/worksheets/sheet' + n + '.xml', Buffer.from(xml, 'utf8'));
rels = rels.replace('</Relationships>', '<Relationship Id="rId' + nr + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/></Relationships>');
ct = ct.replace('</Types>', '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
var mx = 0; (wbXml.match(/<sheet[^>]*sheetId="(\d+)"/g) || []).forEach(function (s) { mx = Math.max(mx, +/sheetId="(\d+)"/.exec(s)[1]); });
wbXml = wbXml.replace('</sheets>', '<sheet name="Procesos-Rick" sheetId="' + (mx + 1) + '" r:id="rId' + nr + '"/></sheets>');
z.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));
z.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
z.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
z.writeZip(WB);
var r = safeSave(WB);
console.log('\n  restaurada como sheet' + n + ' · safe-save ' + r.partes + ' partes · ' + r.validado);
