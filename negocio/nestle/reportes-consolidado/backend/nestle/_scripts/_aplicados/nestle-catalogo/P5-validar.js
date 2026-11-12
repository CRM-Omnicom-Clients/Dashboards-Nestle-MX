// PASO 5 — Validación completa antes de escribir. Incluye duplicados en todas sus formas.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P4.json', 'utf8'));
var PZ = cat.piezas, JO = cat.journeys, CA = cat.campanas, B = 5;
var T = os.homedir() + '/_dv.xlsx'; fs.copyFileSync(PROY + '/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx', T);
var wb = XLSX.readFile(T);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (r) { return t(r['Email_Content_Name']); });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (r) { return t(r['Campaña']); });

var V = [], fallo = 0;
function chk(g, n, ok, d) { V.push([g, n, ok, d]); if (!ok) fallo++; }

// ── A · INTEGRIDAD DE LLAVES
chk('A', 'pieza_id único', new Set(PZ.map(function (p) { return p.pieza_id; })).size === PZ.length, PZ.length);
chk('A', 'journey_id único', new Set(JO.map(function (j) { return j.journey_id; })).size === JO.length, JO.length);
chk('A', 'camp_id único', new Set(CA.map(function (c) { return c.camp_id; })).size === CA.length, CA.length);
chk('A', 'todo journey_id de pieza existe', PZ.every(function (p) { return JO.some(function (j) { return j.journey_id === p.journey_id; }); }), '');
chk('A', 'todo camp_id de pieza existe', PZ.every(function (p) { return CA.some(function (c) { return c.camp_id === p.camp_id; }); }), '');
chk('A', 'todo camp_id de journey existe', JO.every(function (j) { return CA.some(function (c) { return c.camp_id === j.camp_id; }); }), '');

// ── B · DUPLICADOS (lo que pidió Rick, en todas sus formas)
var dupNat = [], v1 = {};
PZ.forEach(function (p) {
  var k = [p.journey_id, p.nombre_pieza, p.segmento, p.email_type, p.nombre_pieza_raw].join('¦');
  if (v1[k]) dupNat.push(p.pieza_id + '≡' + v1[k]); v1[k] = p.pieza_id;
});
chk('B', 'sin llave natural repetida', !dupNat.length, dupNat.slice(0, 3).join(' ') || 'journey+tp+seg+tipo+raw');
var dupCod = [], v2 = {};
PZ.forEach(function (p) { for (var i = 1; i <= B; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { var x = t(p[c + i]); if (!x) return; if (v2[x]) dupCod.push(x + ' en ' + p.pieza_id + ' y ' + v2[x]); v2[x] = p.pieza_id; }); });
chk('B', 'sin código de Qcart repetido', !dupCod.length, dupCod.slice(0, 3).join(' · ') || Object.keys(v2).length + ' códigos');
var dupRec = [];
PZ.forEach(function (p) { var vis = {}; for (var i = 1; i <= B; i++) { var r = t(p['Receta_' + i]); if (!r) continue; if (vis[r]) dupRec.push(p.pieza_id + ': "' + r + '" dos veces'); vis[r] = 1; } });
chk('B', 'sin receta repetida dentro de una pieza', !dupRec.length, dupRec.slice(0, 3).join(' · ') || '');
var dupCamp = [], v3 = {};
CA.forEach(function (c) { var k = [c.bu, c.marca, c.campana].join('¦'); if (v3[k]) dupCamp.push(k); v3[k] = 1; });
chk('B', 'sin campaña repetida (BU+Marca+Campaña)', !dupCamp.length, dupCamp.join(' · ') || CA.length + ' campañas');

// ── C · DIMENSIONES: llenas, en vocabulario, sin mezclar
var OBL = ['pieza_id', 'camp_id', 'journey_id', 'bu', 'marca', 'campana', 'objetivo', 'nombre_pieza', 'segmento', 'canal', 'fuente_dato', 'tiene_qcart'];
var vac = OBL.filter(function (c) { return PZ.some(function (p) { return t(p[c]) === ''; }); });
chk('C', 'las 12 obligatorias llenas', !vac.length, vac.join(', ') || '100%');
chk('C', 'BU en vocabulario', CA.every(function (c) { return cat.VOC.bu.indexOf(c.bu) >= 0; }), '');
chk('C', 'Marca en vocabulario', CA.every(function (c) { return cat.VOC.marca.indexOf(c.marca) >= 0; }), '');
chk('C', 'Campaña en vocabulario', CA.every(function (c) { return cat.VOC.campana.indexOf(c.campana) >= 0; }), '');
chk('C', 'Objetivo en vocabulario', JO.every(function (j) { return cat.VOC.objetivo.indexOf(j.objetivo) >= 0; }), '');
chk('C', 'Canal en vocabulario', PZ.every(function (p) { return cat.VOC.canal.indexOf(p.canal) >= 0; }), '');
chk('C', 'Segmento en vocabulario', PZ.every(function (p) { return cat.VOC.segmento.indexOf(p.segmento) >= 0; }), cat.VOC.segmento.length + ' declarados');
chk('C', 'Touchpoint en el patrón', PZ.every(function (p) { return /^(E-[A-Z]\d+|WA-[A-Z0-9]+)$/.test(p.nombre_pieza); }), '');
chk('C', '0 comas en Segmento', PZ.every(function (p) { return t(p.segmento).indexOf(',') < 0; }), '');
var dims = { BU: {}, Marca: {}, 'Campaña': {}, Objetivo: {}, Segmento: {}, Touchpoint: {} };
CA.forEach(function (c) { dims.BU[c.bu] = 1; dims.Marca[c.marca] = 1; dims['Campaña'][c.campana] = 1; });
JO.forEach(function (j) { dims.Objetivo[j.objetivo] = 1; });
PZ.forEach(function (p) { dims.Segmento[p.segmento] = 1; dims.Touchpoint[p.nombre_pieza] = 1; });
var nn = Object.keys(dims), cruces = [];
for (var a = 0; a < nn.length; a++) for (var b = a + 1; b < nn.length; b++) Object.keys(dims[nn[a]]).forEach(function (x) { if (dims[nn[b]][x]) cruces.push(x + '(' + nn[a] + '/' + nn[b] + ')'); });
chk('C', 'nada mezclado entre dimensiones', !cruces.length, cruces.join(' · '));
chk('C', 'una BU y una Marca por campaña', (function () { var m = {}, ok = true; PZ.forEach(function (p) { var k = p.camp_id, v = p.bu + '¦' + p.marca; if (m[k] && m[k] !== v) ok = false; m[k] = v; }); return ok; })(), '');
chk('C', 'objetivo de pieza == el de su journey', (function () { var m = {}; JO.forEach(function (j) { m[j.journey_id] = j.objetivo; }); return PZ.every(function (p) { return m[p.journey_id] === p.objetivo; }); })(), '');

// ── D · TOTALES contra las fuentes
var sumP = PZ.reduce(function (a, p) { return a + num(p.sends); }, 0);
var sumF = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0) + WA.reduce(function (a, r) { return a + num(r['Sends']); }, 0);
chk('D', 'Σ sends == Data_Email + Data_WhatsApp', sumP === sumF, sumP.toLocaleString() + ' vs ' + sumF.toLocaleString());
var sumC = PZ.reduce(function (a, p) { return a + num(p.carritos_total); }, 0);
var sumSin = (cat.sinPieza || []).reduce(function (a, s) { return a + num(s.carritos); }, 0);
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var qCod = Q.filter(function (r) { return t(r['Shortlink_Code']); }).reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);
chk('D', 'Σ carritos == los de Data_Qcart con código', sumC + sumSin === qCod, sumC + '+' + sumSin + ' vs ' + qCod);

// ── E · TRAZABILIDAD Y COHERENCIA
chk('E', 'toda pieza con Qcart tiene fuente escrita', PZ.filter(function (p) { return p.tiene_qcart === 'Sí'; }).every(function (p) { return t(p.fuente_qcart); }), '');
chk('E', 'toda receta con código y todo código con receta', PZ.every(function (p) {
  for (var i = 1; i <= B; i++) { var r = t(p['Receta_' + i]), c = t(p['Cod_Walmart_' + i]) || t(p['Cod_Chedraui_' + i]); if ((r && !c) || (c && !r)) return false; }
  return true;
}), '');
chk('E', 'bloques de receta sin huecos intermedios', PZ.every(function (p) {
  var vistoVacio = false;
  for (var i = 1; i <= B; i++) { var r = t(p['Receta_' + i]); if (!r) vistoVacio = true; else if (vistoVacio) return false; }
  return true;
}), '');
chk('E', 'todo alias apunta a un valor real', (function () {
  var tp = {}, sg = {};
  PZ.forEach(function (p) { tp[p.nombre_pieza] = 1; sg[p.segmento] = 1; });
  return (cat.aliasUTM || []).every(function (r) {
    if (r.Dimension === 'Touchpoint') return tp[r.Valor_Canonico];
    if (r.Dimension === 'Segmento') return sg[r.Valor_Canonico] || cat.VOC.segmento.indexOf(r.Valor_Canonico) >= 0;
    return true;
  });
})(), (cat.aliasUTM || []).length + ' alias');
chk('E', 'todo pendiente tiene motivo', (cat.sinPieza || []).every(function (s) { return t(s.motivo); }), (cat.sinPieza || []).length + ' registrados');
chk('E', '0 tiendas fuera de México', PZ.every(function (p) { return JSON.stringify(p).indexOf('jumbo-cl') < 0 && JSON.stringify(p).indexOf('santaisabel-cl') < 0; }), (cat.chileExcluido || []).length + ' links de Chile excluidos');

// ── informe
var porG = {};
V.forEach(function (v) { porG[v[0]] = porG[v[0]] || { ok: 0, mal: 0 }; if (v[2]) porG[v[0]].ok++; else porG[v[0]].mal++; });
var NOM = { A: 'integridad de llaves', B: 'duplicados', C: 'dimensiones', D: 'totales', E: 'trazabilidad' };
console.log('══ PASO 5 · VALIDACIÓN COMPLETA ══');
Object.keys(porG).sort().forEach(function (g) { console.log('  ' + g + ' · ' + NOM[g].padEnd(24) + porG[g].ok + '/' + (porG[g].ok + porG[g].mal)); });
console.log('');
V.forEach(function (v) { console.log('  ' + (v[2] ? '✔' : '🔴') + ' ' + (v[0] + ' ' + v[1]).padEnd(48) + (v[3] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S) — no se escribe a Excel' : '✅ PASO 5 CERRADO · ' + V.length + ' validaciones'));
if (!fallo) fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
process.exit(fallo ? 1 : 0);
