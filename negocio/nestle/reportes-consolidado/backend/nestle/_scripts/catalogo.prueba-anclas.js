// ¿LAS ANCLAS FUNCIONAN IGUAL EN EL JSON Y EN EL EXCEL? — segunda pregunta de Rick.
// Un ancla que solo funciona de un lado no es un ancla: es una coincidencia.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(__dirname + '/lib-alias.js');
var LIB = require(__dirname + '/lib-ids.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..') + '/_catalogo';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var T = require('path').resolve(__dirname, '..') + '/_tmp/_an.xlsx';
fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var J = JSON.parse(fs.readFileSync(BACK + '/catalogo.json', 'utf8'));
var REG = LIB.cargar();
var pr = [], fallo = 0;
function K(n, ok, d) { pr.push([n, ok, d]); if (!ok) fallo++; }

console.log('══════ ANCLAS · JSON ↔ EXCEL ↔ REGISTRO ══════\n');

// ── 1 · el mismo id del mismo lado y del otro
var xl = {}; P.forEach(function (p) { xl[t(p['Pieza_ID'])] = p; });
var js = {}; J.piezas.forEach(function (p) { js[t(p.pieza_id)] = p; });
var soloXL = Object.keys(xl).filter(function (k) { return !js[k]; });
var soloJS = Object.keys(js).filter(function (k) { return !xl[k]; });
K('mismos Pieza_ID en JSON y Excel', !soloXL.length && !soloJS.length,
  Object.keys(xl).length + ' ↔ ' + Object.keys(js).length + (soloXL.length || soloJS.length ? ' 🔴 solo-Excel ' + soloXL.length + ' · solo-JSON ' + soloJS.length : ''));

// ── 2 · y con los MISMOS valores en los campos que amarran
var CAMPOS = [['Campaña', 'campana'], ['Touchpoint', 'nombre_pieza'], ['Segmento', 'segmento'],
['Canal', 'canal'], ['Journey_ID', 'journey_id'], ['Camp_ID', 'camp_id']];
var difs = [];
Object.keys(xl).forEach(function (id) {
  if (!js[id]) return;
  CAMPOS.forEach(function (c) {
    if (t(xl[id][c[0]]) !== t(js[id][c[1]])) difs.push(id + '.' + c[0] + ': «' + t(xl[id][c[0]]) + '» vs «' + t(js[id][c[1]]) + '»');
  });
});
K('mismos valores en los 6 campos ancla', !difs.length,
  difs.length ? difs.slice(0, 3).join(' · ') : (Object.keys(xl).length * CAMPOS.length) + ' comparaciones');

// ── 3 · el registro persistente coincide con ambos
var desR = [];
J.piezas.forEach(function (p) { if (REG.piezas[LIB.llavePieza(p)] !== p.pieza_id) desR.push(p.pieza_id); });
K('el registro de ids coincide con el catálogo', !desR.length,
  Object.keys(REG.piezas).length + ' llaves registradas' + (desR.length ? ' 🔴 ' + desR.length + ' desalineadas' : ''));

// ── 4 · el id DICE su campaña
// 🔴 Este check era LAXO y por eso dejó pasar un bug real: usaba LIB.ancla(), que toma los
//    últimos 1-3 dígitos, así que "CMP-0001" (formato viejo, copia sin refrescar en la pieza)
//    daba el mismo "001" que "CMP-001" y el check pasaba en verde. Ahora exige el FORMATO
//    exacto y además que la pieza apunte al camp_id que la tabla de campañas dice hoy.
var malAncla = [], malFmt = [], desincro = [];
var campDe = {}; J.campanas.forEach(function (c) { campDe[c.campana] = c.camp_id; });
Object.keys(xl).forEach(function (id) {
  var ci = t(xl[id]['Camp_ID']);
  if (!LIB.RE_CAMPANA.test(ci)) malFmt.push(id + ' Camp_ID=«' + ci + '»');
  if (campDe[t(xl[id]['Campaña'])] && campDe[t(xl[id]['Campaña'])] !== ci)
    desincro.push(id + ': ' + ci + ' vs ' + campDe[t(xl[id]['Campaña'])]);
  if (!LIB.RE_PIEZA.test(id) || id.slice(0, 3) !== ci.replace('CMP-', '')) malAncla.push(id + ' vs ' + ci);
});
K('el Camp_ID tiene el formato vigente CMP-###', !malFmt.length,
  malFmt.length ? malFmt.slice(0, 3).join(' · ') : Object.keys(xl).length + ' filas');
K('la copia de Camp_ID en la pieza está al día', !desincro.length,
  desincro.length ? desincro.slice(0, 3).join(' · ') : 'coincide con la tabla de campañas');
K('el Pieza_ID declara su campaña', !malAncla.length,
  malAncla.length ? malAncla.slice(0, 3).join(' · ') : '###-P### donde ### == el número de su Camp_ID');

// ── 5 · journey: mismo id, y también anclado
var jx = {}; P.forEach(function (p) { if (t(p['Journey_ID'])) jx[t(p['Journey_ID'])] = t(p['Camp_ID']); });
var malJ = Object.keys(jx).filter(function (j) { return !LIB.RE_JOURNEY.test(j) || j.slice(0, 3) !== LIB.ancla(jx[j]); });
K('el Journey_ID declara su campaña', !malJ.length, malJ.length ? malJ.slice(0, 3).join(' · ') : Object.keys(jx).length + ' journeys en uso');

// ── 6 · Piezas → Referencias: las 4 anclas declaradas
var IX = A.indexar(R);
var VOC = {}; R.filter(function (r) { return /^vocabulario/.test(t(r['Tipo'])); })
  .forEach(function (r) { (VOC[t(r['Dimension'])] = VOC[t(r['Dimension'])] || {})[t(r['Valor_Canonico'])] = 1; });
var DIMS = [['Campaña', 'Campana'], ['BU', 'BU'], ['Marca', 'Marca'], ['Objetivo', 'Objetivo'],
['Segmento', 'Segmento'], ['Touchpoint', 'Touchpoint'], ['Canal', 'Canal']];
var fueraVoc = [];
P.forEach(function (p) {
  DIMS.forEach(function (d) {
    var v = t(p[d[0]]); if (!v || v === 'Segmentos_Combinados') return;
    if (VOC[d[1]] && !VOC[d[1]][v]) fueraVoc.push(t(p['Pieza_ID']) + '.' + d[0] + '=«' + v + '»');
  });
});
K('ancla 1 · vocabulario  Piezas.<Dim> == Referencias.Valor_Canonico', !fueraVoc.length,
  fueraVoc.length ? fueraVoc.slice(0, 3).join(' · ') : (P.length * DIMS.length) + ' valores, todos declarados');

var malAlias = [], nAlias = 0;
P.forEach(function (p) {
  var raw = t(p['Touchpoint_Raw']).split(' · ')[0];
  if (!raw || raw === t(p['Touchpoint'])) return;
  nAlias++;
  var r = A.resolver(IX, 'Touchpoint', raw, t(p['Campaña']), t(p['Segmento']));
  if (r.v !== t(p['Touchpoint'])) malAlias.push(t(p['Pieza_ID']) + ' ' + raw);
});
K('ancla 2 · alias  Campaña(+Segmento) + Raw == Contexto + Valor_Crudo', !malAlias.length,
  malAlias.length ? malAlias.slice(0, 3).join(' · ') : nAlias + ' grafías crudas reproducidas');

var cods = {}; P.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) cods[t(k)] = t(p['Pieza_ID']); });
  });
});
var choque = Object.keys(IX.excl).filter(function (c) { return cods[c]; });
K('ancla 3 · excluido  Cod_* ∌ Referencias(Tipo=excluido)', !choque.length,
  Object.keys(cods).length + ' códigos en piezas · ' + Object.keys(IX.excl).length + ' excluidos, sin traslape');

// ── 7 · y hacia las hojas de datos: ¿el ancla llega a las fuentes?
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' }).filter(function (x) { return t(x['Shortlink_Code']); });
var cn = {}; P.forEach(function (p) {
  if (t(p['Content_Name'])) cn[t(p['Content_Name'])] = t(p['Pieza_ID']);
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) { if (t(x)) cn[t(x)] = t(p['Pieza_ID']); });
});
var sinE = E.filter(function (r) { return !cn[t(r['Email_Content_Name'])]; });
K('ancla 4 · Data_Email.Content_Name → Pieza_ID', sinE.length / E.length < 0.02,
  (E.length - sinE.length) + '/' + E.length + ' filas caen en una pieza' + (sinE.length ? ' (' + sinE.length + ' por asset_id)' : ''));
var sinQ = Q.filter(function (r) { return !cods[t(r['Shortlink_Code'])] && !IX.excl[t(r['Shortlink_Code'])]; });
K('ancla 5 · Data_Qcart.Shortlink_Code → Pieza_ID', !sinQ.length,
  (Q.length - sinQ.length) + '/' + Q.length + ' filas atribuidas o excluidas con motivo');

console.log('  MAPA DE ANCLAS (las mismas en los dos lados):');
console.log('    Pieza_ID       ###-P###   ← el número dice la campaña');
console.log('    Journey_ID     ###-J###   ← igual');
console.log('    Camp_ID        CMP-###');
console.log('    Piezas → Referencias   por Valor_Canonico (vocabulario) y Contexto+Valor_Crudo (alias)');
console.log('    Piezas → Data_Email    por Content_Name (+ variantes) y Asset_ID');
console.log('    Piezas → Data_Qcart    por Cod_Walmart_N / Cod_Chedraui_N');
console.log('    Piezas → Data_WhatsApp por Campaña + Canal + Segmento\n');
pr.forEach(function (p) { console.log('  ' + (p[1] ? '✔' : '🔴') + ' ' + p[0].padEnd(54) + (p[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ancla(s) rota(s)'
  : '✅ las anclas son las MISMAS en el JSON, en el Excel y en el registro'));
