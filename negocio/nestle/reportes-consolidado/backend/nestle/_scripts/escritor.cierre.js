// CIERRE DEL CATÁLOGO — reclasificar, escribir con formato, ordenar hojas.
//
// 🔴 CORRECCIÓN DE CRITERIO (Rick): "no se envió" no es un pendiente, es un HECHO resuelto.
//    Un pendiente es algo que me falta y necesito. Se reclasifica todo:
//      · Estado en la pieza      → Confirmado · Sin engagement cargado · Sin email cargado
//      · Tipo=excluido en Refs   → con su motivo y su número, para que el cuadre sea explícito
//      · Pendientes reales       → ninguno
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var AdmZip = require('adm-zip'), XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var PROY = ENT.PROYECTO;
var WB = ENT.LIBRO;
var cat = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_P5.json', 'utf8'));
var t = function (v) { return v === null || v === undefined ? '' : String(v); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
// TODO lo que entra a XML va escapado — incluida la comilla, que ya borró un styles.xml completo
var esc = function (s) { return t(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); };
var col = XLSX.utils.encode_col, B = 5;

// ══ 1 · wa-1 / wa-2 para los WhatsApp de Tercer Tiempo (instrucción de Rick)
var tt = cat.piezas.filter(function (p) { return p.campana === 'Tercer Tiempo' && p.canal === 'WhatsApp'; });

// ══ 2 · reclasificar estados y excluidos
var EXCL = [];
(cat.sinPieza || []).forEach(function (s) {
  var motivo = /Reagendar/.test(s.motivo) ? 'link de la hoja Reagendar · fuera del alcance del documento vigente'
    : /no enviado|traducción/.test(s.motivo) ? 'link de un envío que NO se realizó (Data_Maggi)'
      : s.motivo;
  EXCL.push({ que: s.codigo, tipo: 'Link Qcart', contexto: (s.campana || '') + (s.utm_content ? ' » ' + s.utm_content : ''), carritos: s.carritos || 0, motivo: motivo, fuente: 'Data_Qcart' });
});
(cat.chileExcluido || []).forEach(function (c) {
  EXCL.push({ que: c.tienda, tipo: 'Tienda', contexto: c.campana, carritos: c.carritos || 0, motivo: 'tienda fuera de México · no lanzamos ahí', fuente: 'Data_Qcart' });
});
(cat.noEnviados || []).forEach(function (n) {
  EXCL.push({ que: n.utm_content, tipo: 'Touchpoint', contexto: n.campana, carritos: 0, motivo: 'Data_Maggi declara que ese envío no se realizó', fuente: 'Data_Maggi' });
});
cat.piezas.forEach(function (p) {
  if (/engagement de WhatsApp sin cargar/.test(t(p.notas))) p.estado = 'Sin engagement cargado';
  else if (/engagement de email sin descargar/.test(t(p.notas))) p.estado = 'Sin email cargado';
  else if (t(p.estado) === 'Sin fecha en la fuente') { /* declarado a mano: no se pisa */ }
  else if (!t(p.estado) || t(p.estado) === '⚠ Por confirmar') p.estado = 'Confirmado';
});

// ══ 3 · las dos hojas
var COLS = [
  ['Pieza_ID', 'pieza_id', 'id'], ['Camp_ID', 'camp_id', 'id'], ['Journey_ID', 'journey_id', 'id'],
  ['BU', 'bu', 'dim'], ['Marca', 'marca', 'dim'], ['Campaña', 'campana', 'dim'], ['Objetivo', 'objetivo', 'dim'],
  ['Touchpoint', 'nombre_pieza', 'dim'], ['Touchpoint_Raw', 'nombre_pieza_raw', 'dim'],
  ['Segmento', 'segmento', 'dim'], ['Segmentos_Combinados', 'segmentos_combinados', 'dim'],
  ['Canal', 'canal', 'dim'], ['Email_Type', 'email_type', 'dim'],
  // 🔴 Fecha_Primer_Envio sale de la PIEZA, no del journey. Un journey manda varios envíos en
  //    fechas distintas: usar la suya para todas sus piezas mandaba 17 piezas a otra quincena
  //    y 3 a otro mes — y de ahí salen el mes_atribucion de N3 y el anclaje del Qcart.
  // ── ANCLA: una sola. Es de donde cuelga el Qcart del mes, UNA vez, sin doblarse.
  ['Tipo_Envio', null, 'env'], ['Fecha_Primer_Envio', 'fecha_primer_envio', 'env'],
  ['Fecha_Ultimo_Envio', 'fecha_ultimo_envio', 'env'],
  ['Mes_Lanzamiento', 'mes_lanzamiento', 'env'], ['Quincena_Lanzamiento', 'quincena_lanzamiento', 'env'],
  // ── ACTIVIDAD: todas. Una pieza AON manda durante semanas — 18 cruzan de quincena, 17 de mes.
  ['Quincenas_Activas', 'quincenas_activas', 'per'], ['N_Quincenas', 'n_quincenas', 'per'],
  ['Meses_Activos', 'meses_activos', 'per'], ['N_Meses', 'n_meses', 'per'],
  // ── REPARTO: "2026-04-Q2:14972 ; 2026-05-Q1:39". N3 abre una fila por periodo con SU volumen.
  ['Sends_Por_Quincena', 'sends_por_quincena', 'per'], ['Sends_Por_Mes', 'sends_por_mes', 'per'],
  ['N_Envios_Fechados', 'n_envios_fechados', 'per'],
  // 🔴 dice CON QUÉ PRECISIÓN se conoce el periodo: una hoja "Julio" del maestro da el mes,
  //    NO la quincena. Sin esto, N3 abriría por quincena una pieza que solo sabe su mes.
  ['Granularidad_Periodo', 'granularidad_periodo', 'per'], ['Fecha_Origen', 'fecha_origen', 'per'],
  ['Dias_Envio', null, 'env'],
  ['Fuente_Dato', 'fuente_dato', 'env'], ['Clicks_Medidos', 'clicks_medidos', 'env'], ['Sends', 'sends', 'env'],
  ['Content_Name', 'content_name', 'ident'], ['Content_Names_Variantes', 'content_names', 'ident'], ['N_Content_Names', 'n_content_names', 'ident'], ['Asset_ID', 'asset_id', 'ident'],
  ['Codigo_NC', 'codigo_nc', 'ident'], ['ID_SFMC', 'id_sfmc', 'ident'],
  ['Tiene_Qcart', 'tiene_qcart', 'qc'], ['N_Recetas', 'n_recetas', 'qc'],
  ['Carritos_Total', 'carritos_total', 'qc'], ['Views_Total', 'views_total', 'qc']
];
for (var i = 1; i <= B; i++) COLS.push(
  ['Receta_' + i, 'Receta_' + i, 'r' + i], ['URL_Receta_' + i, 'URL_Receta_' + i, 'r' + i],
  ['Cod_Walmart_' + i, 'Cod_Walmart_' + i, 'r' + i], ['Carritos_Walmart_' + i, 'Carritos_Walmart_' + i, 'r' + i],
  ['Cod_Chedraui_' + i, 'Cod_Chedraui_' + i, 'r' + i], ['Carritos_Chedraui_' + i, 'Carritos_Chedraui_' + i, 'r' + i]);
COLS.push(['Estado', 'estado', 'ctl'], ['Fuente_Qcart', 'fuente_qcart', 'ctl'], ['Notas', 'notas', 'ctl']);

var COLOR = {
  id: '595F6E', dim: '2E6DB4', env: '31859C', per: '1F6F8B', ident: '6A4C93', qc: '2A9187',
  r1: 'C77F0A', r2: 'C77F0A', r3: 'C77F0A', r4: 'C77F0A', r5: 'C77F0A', ctl: '4C7A34'
};
var jById = {}; cat.journeys.forEach(function (j) { jById[j.journey_id] = j; });
var filasP = cat.piezas.map(function (p) {
  var j = jById[p.journey_id] || {};
  return COLS.map(function (c) {
    if (c[0] === 'Tipo_Envio') return j.tipo_envio || '';
    if (c[0] === 'Dias_Envio') return j.dias_envio === undefined ? '' : j.dias_envio;
    var v = p[c[1]]; return v === null || v === undefined ? '' : v;
  });
});

var HDR_R = ['Tipo', 'Dimension', 'Valor_Crudo', 'Valor_Canonico', 'Contexto', 'Dato_1', 'Dato_2', 'Fuente', 'Notas',
  // el ancla literal a la otra hoja — sin esto, Referencias no se cruza con Piezas desde Excel
  'N_Piezas', 'Pieza_IDs'];
var REF = [];
function addR(a) { REF.push(a); }
Object.keys(cat.VOC).forEach(function (d) {
  var nom = d.charAt(0).toUpperCase() + d.slice(1);
  cat.VOC[d].forEach(function (v) { addR(['vocabulario', nom, '', v, '', '', '', 'lista cerrada', '']); });
});
(cat.aliasUTM || []).forEach(function (r) { addR(['alias', r.Dimension, r.Valor_Crudo, r.Valor_Canonico, r.Contexto, '', '', r.Fuente, '']); });
// 🔴 Un alias genérico AMBIGUO no entra: si la misma grafía cruda da varios touchpoints según
//    el segmento, solo valen las entradas específicas (campaña · segmento) que ya están en
//    aliasUTM. Dejar el genérico haría que el catálogo se contradiga a sí mismo.
var ambiguos = {};
(function () {
  var porRaw = {};
  cat.piezas.forEach(function (p) {
    var raw = t(p.nombre_pieza_raw).split(' · ')[0];
    if (!raw || raw === p.nombre_pieza) return;
    (porRaw[p.campana + ' » ' + raw] = porRaw[p.campana + ' » ' + raw] || {})[p.nombre_pieza] = 1;
  });
  Object.keys(porRaw).forEach(function (k) { if (Object.keys(porRaw[k]).length > 1) ambiguos[k] = 1; });
})();
Object.keys(cat.aliasTP || {}).forEach(function (k) {
  if (ambiguos[k]) return;
  var p = k.split(' » '); addR(['alias', 'Touchpoint', p[1] || k, cat.aliasTP[k], p[0], '', '', 'Data_Email', '']);
});
Object.keys(cat.aliasSEG || {}).forEach(function (k) { addR(['alias', 'Segmento', k, cat.aliasSEG[k], '', '', '', 'Data_Email', '']); });
Object.keys(cat.aliasOBJ || {}).forEach(function (k) { var p = k.split(' » '); addR(['alias', 'Objetivo', p.length > 1 ? p[1] : k, cat.aliasOBJ[k], p.length > 1 ? p[0] : '', '', '', 'Data_Email', '']); });
EXCL.forEach(function (e) { addR(['excluido', e.tipo, e.que, '', e.contexto, e.carritos, '', e.fuente, e.motivo]); });

// ══ 3b · ANCLA LITERAL Referencias → Piezas  (lo que Rick notó que faltaba)
// El ancla existía LÓGICAMENTE pero no había COLUMNA: abriendo la hoja no podías saltar de una
// referencia a las piezas que la usan. Un ancla que solo un script puede recorrer no sirve.
//   N_Piezas  = cuántas la usan. **0 = declarada y sin usar** → salta a la vista en vez de
//               quedarse ahí para siempre.
//   Pieza_IDs = los ids, para BUSCARV directo contra Catalogo_Piezas.
// 🔴 Un alias se ancla por su CANÓNICO, no por dónde está escrito el crudo: «e-botana1» puede no
//    aparecer en ninguna pieza y aun así ser útil — su trabajo es llevarte a E-P1.
var ANCLA = require(__dirname + '/lib-ancla-refs.js');
var TOPE = 12;
REF = REF.map(function (r) {
  var ids = ANCLA.piezasDe(cat, r[0], r[1], r[3], r[2], r[4]);
  return r.concat([ids.length, ids.length > TOPE ? ids.slice(0, TOPE).join(' ') + ' … (+' + (ids.length - TOPE) + ')' : ids.join(' ')]);
});

var HOJAS = [
  { nombre: 'Catalogo_Piezas', hdr: COLS.map(function (c) { return c[0]; }), grupos: COLS.map(function (c) { return c[2]; }), filas: filasP },
  { nombre: 'Catalogo_Referencias', hdr: HDR_R, grupos: HDR_R.map(function () { return 'id'; }), filas: REF }
];

// ══ 4 · estilos
var z = new AdmZip(WB);
var st = z.readAsText('xl/styles.xml');
var mF = /(<fonts count="\d+"[^>]*>)([\s\S]*?)(<\/fonts>)/.exec(st);
var fonts = mF[2].match(/<font>[\s\S]*?<\/font>|<font\/>/g) || [];
var mL = /(<fills count="\d+"[^>]*>)([\s\S]*?)(<\/fills>)/.exec(st);
var fills = mL[2].match(/<fill>[\s\S]*?<\/fill>|<fill\/>/g) || [];
var mX = /(<cellXfs count="\d+"[^>]*>)([\s\S]*)(<\/cellXfs>)/.exec(st);
var xfs = mX[2].match(/<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/g) || [];
var FONT_H = '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>';
var iFH = fonts.indexOf(FONT_H); if (iFH < 0) { fonts.push(FONT_H); iFH = fonts.length - 1; }
function idFill(hex) {
  var p = '<fill><patternFill patternType="solid"><fgColor rgb="FF' + hex + '"/><bgColor indexed="64"/></patternFill></fill>';
  var i = fills.indexOf(p); if (i >= 0) return i; fills.push(p); return fills.length - 1;
}
function claro(hex, f) {
  var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  function m(x) { return Math.round(x + (255 - x) * f).toString(16).padStart(2, '0').toUpperCase(); }
  return m(r) + m(g) + m(b);
}
function idXf(font, fill, centro) {
  var xf = '<xf numFmtId="0" fontId="' + font + '" fillId="' + fill + '" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
    '<alignment horizontal="' + (centro ? 'center' : 'left') + '" vertical="center" wrapText="' + (centro ? '1' : '0') + '"/></xf>';
  var i = xfs.indexOf(xf); if (i >= 0) return i; xfs.push(xf); return xfs.length - 1;
}
function sheetXml(H) {
  var todas = [H.hdr].concat(H.filas), ref = 'A1:' + col(H.hdr.length - 1) + todas.length;
  var xfH = [], xfB = [];
  H.hdr.forEach(function (h, j) {
    var c = COLOR[H.grupos[j]] || '595F6E';
    xfH[j] = idXf(iFH, idFill(c), true);
    xfB[j] = idXf(0, idFill(claro(c, 0.88)), false);
  });
  var o = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="' + ref + '"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/><cols>';
  H.hdr.forEach(function (h, j) {
    var w = Math.min(42, Math.max(11, h.length + 3, Math.round(H.filas.slice(0, 300).reduce(function (a, f) { return Math.max(a, t(f[j]).length); }, 0) * 0.95) + 2));
    o += '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>';
  });
  o += '</cols><sheetData>';
  todas.forEach(function (fila, i) {
    o += '<row r="' + (i + 1) + '"' + (i === 0 ? ' ht="32" customHeight="1"' : '') + '>';
    fila.forEach(function (v, j) {
      var r = col(j) + (i + 1), s = i === 0 ? xfH[j] : xfB[j];
      if (v === '' || v === null || v === undefined) { o += '<c r="' + r + '" s="' + s + '"/>'; return; }
      if (i > 0 && typeof v === 'number' && isFinite(v)) o += '<c r="' + r + '" s="' + s + '"><v>' + v + '</v></c>';
      else o += '<c r="' + r + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    });
    o += '</row>';
  });
  return o + '</sheetData><autoFilter ref="' + ref + '"/></worksheet>';
}
var cuerpos = HOJAS.map(sheetXml);
st = st.slice(0, mF.index) + '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>' + st.slice(mF.index + mF[0].length);
var m2 = /(<fills count="\d+"[^>]*>)([\s\S]*?)(<\/fills>)/.exec(st);
st = st.slice(0, m2.index) + '<fills count="' + fills.length + '">' + fills.join('') + '</fills>' + st.slice(m2.index + m2[0].length);
var m3 = /(<cellXfs count="\d+"[^>]*>)([\s\S]*)(<\/cellXfs>)/.exec(st);
st = st.slice(0, m3.index) + '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>' + st.slice(m3.index + m3[0].length);
z.updateFile('xl/styles.xml', Buffer.from(st, 'utf8'));

// ══ 5 · escribir las hojas
var wbXml = z.readAsText('xl/workbook.xml'), rels = z.readAsText('xl/_rels/workbook.xml.rels');
var d = {}; rels.replace(/<Relationship[^>]*\/>/g, function (x) { var a = /Id="([^"]*)"/.exec(x), b = /Target="([^"]*)"/.exec(x); if (a && b) d[a[1]] = b[1].replace(/^\/?xl\//, ''); return x; });
HOJAS.forEach(function (H, k) {
  var rid = (new RegExp('<sheet[^>]*name="' + H.nombre + '"[^>]*r:id="([^"]+)"').exec(wbXml) || [])[1];
  if (!rid) throw new Error('no existe la hoja ' + H.nombre);
  z.updateFile('xl/' + d[rid], Buffer.from(cuerpos[k], 'utf8'));
});

// ══ 6 · ORDEN de las hojas: catálogo → datos → reportes → soporte
var ORDEN = ['Catalogo_Piezas', 'Catalogo_Referencias', 'Data_Email', 'Data_Qcart', 'Data_WhatsApp',
  'Catalog_Campanas', 'Report_Resumen', 'Report_Mensual', 'Report_CompletoQcart', 'Report_Campana_Mes',
  'Report_Insights_Operativo', 'Soporte_IA_Qcart_Productos', 'Soporte_IA_Stage_Carts', 'Soporte_IA_Stage_Products', 'Procesos-Rick'];
var tags = {};
wbXml.replace(/<sheet[^>]*\/>/g, function (x) { tags[/name="([^"]*)"/.exec(x)[1]] = x; return x; });
var orden = ORDEN.filter(function (n) { return tags[n]; }).concat(Object.keys(tags).filter(function (n) { return ORDEN.indexOf(n) < 0; }));
wbXml = wbXml.replace(/<sheets>[\s\S]*?<\/sheets>/, '<sheets>' + orden.map(function (n) { return tags[n]; }).join('') + '</sheets>');
z.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));
z.writeZip(WB);
var r = safeSave(WB);

console.log('══ CIERRE ══');
console.log('  Catalogo_Piezas       ' + filasP.length + ' filas × ' + COLS.length + ' col');
console.log('  Catalogo_Referencias  ' + REF.length + ' filas × ' + HDR_R.length + ' col');
console.log('  orden de hojas        ' + orden.join(' · '));
console.log('  safe-save             ' + r.partes + ' partes · ' + r.validado);
console.log('\n  reclasificación:');
console.log('    pendientes → 0');
console.log('    excluidos con motivo y número → ' + EXCL.length);
var pe = {}; EXCL.forEach(function (e) { pe[e.motivo] = pe[e.motivo] || { n: 0, c: 0 }; pe[e.motivo].n++; pe[e.motivo].c += e.carritos; });
Object.keys(pe).forEach(function (k) { console.log('      ' + k.slice(0, 58).padEnd(60) + pe[k].n + ' · ' + pe[k].c + ' carritos'); });
var est = {}; cat.piezas.forEach(function (p) { est[p.estado] = (est[p.estado] || 0) + 1; });
console.log('    estados de las piezas: ' + Object.keys(est).map(function (k) { return k + ' ' + est[k]; }).join(' · '));
console.log('    Tercer Tiempo WhatsApp → ' + tt.map(function (p) { return p.nombre_pieza; }).join(' · '));
fs.writeFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_P5.json', JSON.stringify(cat, null, 1));
