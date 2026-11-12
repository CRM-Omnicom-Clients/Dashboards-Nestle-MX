// PASO 6 — Bajada a Excel: 2 hojas. Cirugía XML con texto en línea, sin tocar sharedStrings.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var AdmZip = require('adm-zip'), XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var WB = VIVO_();
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var t = function (v) { return v === null || v === undefined ? '' : String(v); };
var esc = function (s) { return t(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); };
var col = XLSX.utils.encode_col, B = 5;

// ── HOJA 1 · Catalogo_Piezas (ancha)
var COLS = [
  ['Pieza_ID', 'pieza_id'], ['Camp_ID', 'camp_id'], ['Journey_ID', 'journey_id'],
  ['BU', 'bu'], ['Marca', 'marca'], ['Campaña', 'campana'], ['Objetivo', 'objetivo'],
  ['Touchpoint', 'nombre_pieza'], ['Touchpoint_Raw', 'nombre_pieza_raw'],
  ['Segmento', 'segmento'], ['Segmentos_Combinados', 'segmentos_combinados'],
  ['Canal', 'canal'], ['Email_Type', 'email_type'],
  ['Tipo_Envio', null], ['Fecha_Primer_Envio', null], ['Dias_Envio', null],
  ['Fuente_Dato', 'fuente_dato'], ['Sends', 'sends'],
  ['Content_Name', 'content_name'], ['Asset_ID', 'asset_id'], ['Codigo_NC', 'codigo_nc'], ['ID_SFMC', 'id_sfmc'],
  ['Tiene_Qcart', 'tiene_qcart'], ['N_Recetas', 'n_recetas'], ['Carritos_Total', 'carritos_total'], ['Views_Total', 'views_total']
];
for (var i = 1; i <= B; i++) COLS.push(
  ['Receta_' + i, 'Receta_' + i], ['URL_Receta_' + i, 'URL_Receta_' + i],
  ['Cod_Walmart_' + i, 'Cod_Walmart_' + i], ['Carritos_Walmart_' + i, 'Carritos_Walmart_' + i],
  ['Cod_Chedraui_' + i, 'Cod_Chedraui_' + i], ['Carritos_Chedraui_' + i, 'Carritos_Chedraui_' + i]);
COLS.push(['Estado', 'estado'], ['Fuente_Qcart', 'fuente_qcart'], ['Notas', 'notas']);

var jById = {}; cat.journeys.forEach(function (j) { jById[j.journey_id] = j; });
var filasP = cat.piezas.map(function (p) {
  var j = jById[p.journey_id] || {};
  return COLS.map(function (c) {
    if (c[0] === 'Tipo_Envio') return j.tipo_envio || '';
    if (c[0] === 'Fecha_Primer_Envio') return j.fecha_primer_envio || '';
    if (c[0] === 'Dias_Envio') return j.dias_envio === undefined ? '' : j.dias_envio;
    var v = p[c[1]];
    return v === null || v === undefined ? '' : v;
  });
});

// ── HOJA 2 · Catalogo_Referencias
var HDR_R = ['Tipo', 'Dimension', 'Valor_Crudo', 'Valor_Canonico', 'Contexto', 'Dato_1', 'Dato_2', 'Fuente', 'Notas'];
var REF = [];
function addR(tipo, dim, crudo, canon, ctx, d1, d2, fuente, nota) {
  REF.push([tipo, dim || '', crudo || '', canon || '', ctx || '', d1 === undefined ? '' : d1, d2 === undefined ? '' : d2, fuente || '', nota || '']);
}
Object.keys(cat.VOC).forEach(function (d) {
  var nom = d.charAt(0).toUpperCase() + d.slice(1);
  cat.VOC[d].forEach(function (v) { addR('vocabulario', nom, '', v, '', '', '', 'lista cerrada', ''); });
});
(cat.aliasUTM || []).forEach(function (r) { addR('alias_utm', r.Dimension, r.Valor_Crudo, r.Valor_Canonico, r.Contexto, '', '', r.Fuente, ''); });
Object.keys(cat.aliasTP || {}).forEach(function (k) { var p = k.split(' » '); addR('alias', 'Touchpoint', p[1] || k, cat.aliasTP[k], p[0], '', '', 'Data_Email', ''); });
Object.keys(cat.aliasSEG || {}).forEach(function (k) { addR('alias', 'Segmento', k, cat.aliasSEG[k], '', '', '', 'Data_Email', ''); });
Object.keys(cat.aliasOBJ || {}).forEach(function (k) { var p = k.split(' » '); addR('alias', 'Objetivo', p.length > 1 ? p[1] : k, cat.aliasOBJ[k], p.length > 1 ? p[0] : '', '', '', 'Data_Email', ''); });
(cat.sinPieza || []).forEach(function (s) { addR('pendiente', 'Link', s.codigo, '', (s.campana || '') + (s.utm_content ? ' » ' + s.utm_content : ''), s.carritos, '', 'Data_Qcart', s.motivo); });
(cat.noEnviados || []).forEach(function (n) { addR('pendiente', 'Touchpoint', n.utm_content, '', n.campana, '', '', 'Data_Maggi', n.motivo); });
(cat.chileExcluido || []).forEach(function (c) { addR('excluido', 'Tienda', c.tienda, '', c.campana, c.carritos, '', 'Data_Qcart', 'tienda fuera de México'); });
(cat.pendientes || []).filter(function (p) { return p.tipo === 'wa_sin_utm_content'; }).forEach(function (p) {
  addR('pendiente', 'Touchpoint', '', 'wa-1 / wa-2', p.campana + ' · ' + p.fecha, p.sends, '', 'Data_WhatsApp', 'falta utm_content · nombrado wa-1/wa-2 por instrucción');
});

var HOJAS = [
  { nombre: 'Catalogo_Piezas', hdr: COLS.map(function (c) { return c[0]; }), filas: filasP },
  { nombre: 'Catalogo_Referencias', hdr: HDR_R, filas: REF }
];

function sheetXml(hdr, filas) {
  var todas = [hdr].concat(filas), ref = 'A1:' + col(hdr.length - 1) + todas.length;
  var o = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="' + ref + '"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/><cols>';
  hdr.forEach(function (h, j) {
    var w = Math.min(44, Math.max(10, h.length + 2, Math.round(filas.slice(0, 200).reduce(function (a, f) { return Math.max(a, t(f[j]).length); }, 0) * 0.95) + 2));
    o += '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>';
  });
  o += '</cols><sheetData>';
  todas.forEach(function (fila, i) {
    o += '<row r="' + (i + 1) + '">';
    fila.forEach(function (v, j) {
      if (v === '' || v === null || v === undefined) return;
      var r = col(j) + (i + 1);
      if (i > 0 && typeof v === 'number' && isFinite(v)) o += '<c r="' + r + '"><v>' + v + '</v></c>';
      else o += '<c r="' + r + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    });
    o += '</row>';
  });
  return o + '</sheetData><autoFilter ref="' + ref + '"/></worksheet>';
}

fs.copyFileSync(WB, PROY + '/_backups/v8_antes-P6_' + Date.now() + '.xlsx');
var z = new AdmZip(WB);
var wbXml = z.readAsText('xl/workbook.xml'), rels = z.readAsText('xl/_rels/workbook.xml.rels'), ct = z.readAsText('[Content_Types].xml');
var acc = [];
HOJAS.forEach(function (H) {
  var rid = (new RegExp('<sheet[^>]*name="' + H.nombre + '"[^>]*r:id="([^"]+)"').exec(wbXml) || [])[1];
  var xml = sheetXml(H.hdr, H.filas);
  if (rid) {
    var tgt = (new RegExp('<Relationship[^>]*Id="' + rid + '"[^>]*Target="([^"]+)"').exec(rels) || [])[1];
    z.updateFile('xl/' + tgt.replace(/^\/?xl\//, ''), Buffer.from(xml, 'utf8'));
    acc.push(H.nombre + ' reemplazada · ' + H.filas.length + ' filas × ' + H.hdr.length + ' col');
  } else {
    var n = 1; while (z.getEntry('xl/worksheets/sheet' + n + '.xml')) n++;
    var nr = 1; while (rels.indexOf('Id="rId' + nr + '"') >= 0) nr++;
    z.addFile('xl/worksheets/sheet' + n + '.xml', Buffer.from(xml, 'utf8'));
    rels = rels.replace('</Relationships>', '<Relationship Id="rId' + nr + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/></Relationships>');
    ct = ct.replace('</Types>', '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    var mx = 0; (wbXml.match(/<sheet[^>]*sheetId="(\d+)"/g) || []).forEach(function (s) { mx = Math.max(mx, +/sheetId="(\d+)"/.exec(s)[1]); });
    wbXml = wbXml.replace('</sheets>', '<sheet name="' + esc(H.nombre) + '" sheetId="' + (mx + 1) + '" r:id="rId' + nr + '"/></sheets>');
    z.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
    z.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
    z.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));
    acc.push(H.nombre + ' creada (sheet' + n + ') · ' + H.filas.length + ' filas × ' + H.hdr.length + ' col');
  }
});
z.writeZip(WB);
var r = safeSave(WB);
console.log('══ PASO 6 · ESCRITURA ══');
acc.forEach(function (x) { console.log('  ' + x); });
console.log('  safe-save: ' + r.partes + ' partes · validación ' + r.validado);
