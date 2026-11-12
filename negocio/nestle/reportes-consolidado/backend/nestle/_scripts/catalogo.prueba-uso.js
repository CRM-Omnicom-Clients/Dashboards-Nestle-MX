// ¿SIRVE DE VERDAD? Prueba de uso: simular lo que un corte le pediría al catálogo.
// No valida forma — valida CAPACIDAD: ¿puede atribuir cada fila de cada fuente, solo?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var T = require('path').resolve(__dirname, '..') + '/_tmp/_pu.xlsx'; fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['Campaña']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });

// ── índices que el catálogo ofrece
var porContent = {}, porNombres = {}, porAsset = {}, porCodigo = {}, alias = {}, voc = {};
P.forEach(function (p) {
  if (t(p['Content_Name'])) (porContent[t(p['Content_Name'])] = porContent[t(p['Content_Name'])] || []).push(p);
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function(cn){ if(cn) (porNombres[cn]=porNombres[cn]||[]).push(p); });
  if (t(p['Asset_ID'])) (porAsset[t(p['Asset_ID'])] = porAsset[t(p['Asset_ID'])] || []).push(p);
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function(k){ if(k) porCodigo[k] = p; });
  });
});
R.forEach(function (r) {
  if (t(r['Tipo']) === 'alias') alias[t(r['Dimension']) + '¦' + nm(r['Valor_Crudo'])] = t(r['Valor_Canonico']);
  if (t(r['Tipo']) === 'vocabulario') (voc[t(r['Dimension'])] = voc[t(r['Dimension'])] || {})[t(r['Valor_Canonico'])] = 1;
});
var excl = {}; R.filter(function (r) { return t(r['Tipo']) === 'excluido'; }).forEach(function (r) { excl[t(r['Valor_Crudo'])] = t(r['Notas']); });

var pruebas = [];
function P_(nom, ok, det) { pruebas.push([nom, ok, det]); }

// ══ PRUEBA 1 · ¿resuelve cada fila de Data_Email a una pieza?
var noRes = [], resPorContent = 0, resPorAsset = 0;
E.forEach(function (r) {
  var c = t(r['Email_Content_Name']);
  var tp = alias['Touchpoint¦' + nm(r['Touchpoint'])] || t(r['Touchpoint']);
  var seg = alias['Segmento¦' + nm(r['Segmento_Canonico'])] || t(r['Segmento_Canonico']);
  var cands = porContent[c] || (porNombres[c] || []);
  if (cands.length) {
    var exacta = cands.filter(function (p) { return t(p['Segmento']) === seg && t(p['Email_Type']) === t(r['Email_Type']); });
    if (exacta.length === 1) { resPorContent++; return; }
    if (cands.length === 1) { resPorContent++; return; }
  }
  var asset = (c.match(/_(\d+)$/) || [])[1];
  if (asset && (porAsset[asset] || []).length) { resPorAsset++; return; }
  noRes.push({ content: c.slice(-40), tp: t(r['Touchpoint']), seg: seg, sends: num(r['Email_Sends']) });
});
P_('resuelve cada fila de Data_Email', !noRes.length,
  E.length + ' filas · por content_name ' + resPorContent + ' · por asset_id ' + resPorAsset + (noRes.length ? ' · 🔴 sin resolver ' + noRes.length : ''));

// ══ PRUEBA 2 · ¿resuelve cada fila de Data_WhatsApp?
var noWA = [];
WA.forEach(function (r) {
  var camp = t(r['Campaña']), seg = alias['Segmento¦' + nm(r['Segmento_Canonico'])] || t(r['Segmento_Canonico']);
  var c = P.filter(function (p) { return t(p['Campaña']) === camp && t(p['Canal']) === 'WhatsApp'; });
  var ex = c.filter(function (p) { return t(p['Segmento']) === seg || t(p['Segmentos_Combinados']) === t(r['Segmento_Canonico']); });
  if (!ex.length && c.length !== 1) noWA.push(camp + '/' + seg);
});
P_('resuelve cada fila de Data_WhatsApp', !noWA.length, WA.length + ' filas' + (noWA.length ? ' · 🔴 ' + noWA.join(' · ') : ''));

// ══ PRUEBA 3 · ¿resuelve cada fila de Data_Qcart con código?
var conCod = Q.filter(function (r) { return t(r['Shortlink_Code']); });
var noQ = [], resQ = 0, exQ = 0;
conCod.forEach(function (r) {
  var c = t(r['Shortlink_Code']);
  if (porCodigo[c]) resQ++;
  else if (excl[c]) exQ++;
  else noQ.push(c);
});
P_('resuelve cada fila de Data_Qcart con código', !noQ.length,
  conCod.length + ' filas · atribuidas ' + resQ + ' · excluidas con motivo ' + exQ + (noQ.length ? ' · 🔴 ' + noQ.length : ''));

// ══ PRUEBA 4 · ¿todo lo que el catálogo dice está respaldado por una fuente citable?
var sinFuente = P.filter(function (p) { return t(p['Tiene_Qcart']) === 'Sí' && !t(p['Fuente_Qcart']); });
P_('toda atribución de Qcart cita su fuente', !sinFuente.length, P.filter(function (p) { return t(p['Tiene_Qcart']) === 'Sí'; }).length + ' piezas con Qcart');

// ══ PRUEBA 5 · FLEXIBILIDAD · ¿qué pasa con información nueva?
var casos = [
  { q: 'campaña nueva', hay: !!voc['Campana'], det: Object.keys(voc['Campana'] || {}).length + ' declaradas, ' + P.reduce(function (a, p) { var s = {}; s[t(p['Campaña'])] = 1; return a; }, 0) },
  { q: 'marca nueva', hay: !!voc['Marca'], det: Object.keys(voc['Marca'] || {}).length + ' declaradas · 8 en uso' },
  { q: 'objetivo nuevo', hay: !!voc['Objetivo'], det: Object.keys(voc['Objetivo'] || {}).length + ' declarados · 7 en uso' },
  { q: 'segmento nuevo', hay: !!voc['Segmento'], det: Object.keys(voc['Segmento'] || {}).length + ' declarados' },
  { q: 'grafía nueva de touchpoint', hay: Object.keys(alias).some(function (k) { return /^Touchpoint/.test(k); }), det: Object.keys(alias).filter(function (k) { return /^Touchpoint/.test(k); }).length + ' alias' },
  { q: 'tienda nueva', hay: !!voc['Tienda'], det: Object.keys(voc['Tienda'] || {}).join(', ') },
  { q: 'link que no salió', hay: Object.keys(excl).length > 0, det: Object.keys(excl).length + ' excluidos con motivo' }
];
var sinRuta = casos.filter(function (c) { return !c.hay; });
P_('hay ruta declarada para información nueva', !sinRuta.length, sinRuta.map(function (c) { return c.q; }).join(' · ') || casos.length + ' casos cubiertos');

// ══ PRUEBA 6 · ¿el catálogo basta para armar una fila del Report_Resumen?
var CAMPOS_REPORTE = ['Campaña', 'BU', 'Marca', 'Objetivo', 'Touchpoint', 'Segmento', 'Canal', 'Tipo_Envio', 'Fecha_Primer_Envio', 'Tiene_Qcart'];
var faltan = CAMPOS_REPORTE.filter(function (c) { return !Object.keys(P[0]).some(function (k) { return k === c; }); });
P_('trae todo lo que el Report_Resumen necesita', !faltan.length, faltan.join(', ') || CAMPOS_REPORTE.length + ' campos disponibles en la fila');

console.log('══════ PRUEBA DE USO ══════');
pruebas.forEach(function (p) { console.log('  ' + (p[1] ? '✔' : '🔴') + ' ' + p[0].padEnd(44) + p[2]); });
if (noRes.length) { console.log('\n  filas de Data_Email sin resolver:'); noRes.slice(0, 8).forEach(function (x) { console.log('     ' + x.content + '  tp=' + x.tp + '  seg=' + x.seg + '  sends=' + x.sends); }); }
var mal = pruebas.filter(function (p) { return !p[1]; }).length;
console.log('\n  ' + (mal ? '🔴 ' + mal + ' capacidad(es) faltante(s)' : '✅ el catálogo resuelve todo lo que un corte le pide'));
