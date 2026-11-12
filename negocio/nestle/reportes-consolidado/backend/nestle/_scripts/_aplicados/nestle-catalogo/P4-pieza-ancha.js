// PASO 4 — La pieza ancha: las recetas viven EN la fila de la pieza.
// Así desaparece el paso "resolver link → pieza" y con él la clase de error que colgó
// 15 links de la pieza equivocada. El link no se resuelve: se escribe donde pertenece.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P3.json', 'utf8'));
var doc = cat.doc, PZ = cat.piezas;
var BLOQUES = 5;                                        // máximo real 4, uno de reserva

// números de Data_Qcart por código
var T = os.homedir() + '/_dq.xlsx'; fs.copyFileSync(PROY + '/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx', T);
var Q = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Data_Qcart'], { defval: '' });
var numsPorCod = {};
Q.forEach(function (r) {
  var c = t(r['Shortlink_Code']); if (!c) return;
  numsPorCod[c] = numsPorCod[c] || { carritos: 0, views: 0, tiendas: {} };
  numsPorCod[c].carritos += num(r['Carts_Total_All_Products']);
  numsPorCod[c].views += num(r['Views']);
  t(r['Tienda']).split(',').forEach(function (x) { if (t(x)) numsPorCod[c].tiendas[t(x)] = 1; });
});
var TIENDA = { walmart: 'Walmart', walmartcommx: 'Walmart', chedraui: 'Chedraui', chedrauicommx: 'Chedraui' };

// ── agrupar los links del documento por (campaña, touchpoint, receta)
var porPieza = {}, sinPieza = [], noEnviados = cat.noEnviados || [];
var idxPZ = {};
PZ.forEach(function (p) { (idxPZ[p.campana + '¦' + p.nombre_pieza] = idxPZ[p.campana + '¦' + p.nombre_pieza] || []).push(p); });

Object.keys(doc).forEach(function (cod) {
  var d = doc[cod];
  if (d.estado) { sinPieza.push({ codigo: cod, motivo: 'hoja Reagendar · atribución no confirmada', carritos: (numsPorCod[cod] || {}).carritos || 0 }); return; }
  if (!d._campana || !d._tp) {
    sinPieza.push({ codigo: cod, campana: d._campana || '?', utm_content: d.utm_content, motivo: 'touchpoint no enviado o sin traducción', carritos: (numsPorCod[cod] || {}).carritos || 0 });
    return;
  }
  var cands = idxPZ[d._campana + '¦' + d._tp] || [];
  // si el segmento del utm traduce a un segmento, se usa para elegir entre varias piezas
  var segU = d._term && d._term.dim === 'Segmento' ? d._term.val : null;
  var p = (segU && cands.filter(function (x) { return x.segmento === segU; })[0]) || cands[0] || null;
  if (!p) {
    sinPieza.push({ codigo: cod, campana: d._campana, touchpoint: d._tp, utm_content: d.utm_content, motivo: 'no existe pieza para ese touchpoint', carritos: (numsPorCod[cod] || {}).carritos || 0 });
    return;
  }
  var n = numsPorCod[cod] || { carritos: 0, views: 0, tiendas: {} };
  var tiendas = Object.keys(n.tiendas).map(function (x) { return TIENDA[nm(x)]; }).filter(Boolean);
  if (!tiendas.length && d.retailer) t(d.retailer).split(/[,\-]/).forEach(function (x) { var c = TIENDA[nm(x)]; if (c && tiendas.indexOf(c) < 0) tiendas.push(c); });
  (porPieza[p.pieza_id] = porPieza[p.pieza_id] || []).push({
    codigo: cod, receta: d.receta, url_receta: d.url_receta, tiendas: tiendas,
    carritos: n.carritos, views: n.views, fecha: d.fecha, fuente: d.fuente
  });
});

// ── volcar a bloques de RECETA (agrupando los códigos de la misma receta)
var desbordes = [];
PZ.forEach(function (p) {
  var links = porPieza[p.pieza_id] || [];
  var porReceta = {};
  links.forEach(function (L) {
    var k = nm(L.receta) || L.codigo;
    porReceta[k] = porReceta[k] || { receta: L.receta, url: L.url_receta, W: null, C: null, carW: 0, carC: 0, views: 0, fuentes: [] };
    var r = porReceta[k];
    if (!r.url && L.url_receta) r.url = L.url_receta;
    r.views += L.views; r.fuentes.push(L.fuente);
    // cada código se asigna a su tienda; si trae las dos, cuenta en ambas por su parte
    if (L.tiendas.indexOf('Walmart') >= 0) { r.W = r.W || L.codigo; r.carW += L.carritos; }
    else if (L.tiendas.indexOf('Chedraui') >= 0) { r.C = r.C || L.codigo; r.carC += L.carritos; }
    else { r.W = r.W || L.codigo; r.carW += L.carritos; }      // sin tienda declarada → Walmart, el default del documento
  });
  var recs = Object.keys(porReceta).map(function (k) { return porReceta[k]; })
    .sort(function (a, b) { return (b.carW + b.carC) - (a.carW + a.carC); });
  if (recs.length > BLOQUES) desbordes.push({ pieza_id: p.pieza_id, campana: p.campana, n: recs.length });
  for (var i = 0; i < BLOQUES; i++) {
    var r = recs[i], s = String(i + 1);
    p['Receta_' + s] = r ? r.receta : '';
    p['URL_Receta_' + s] = r ? (r.url || '') : '';
    p['Cod_Walmart_' + s] = r ? (r.W || '') : '';
    p['Carritos_Walmart_' + s] = r ? r.carW : '';
    p['Cod_Chedraui_' + s] = r ? (r.C || '') : '';
    p['Carritos_Chedraui_' + s] = r ? r.carC : '';
  }
  p.n_recetas = recs.length;
  p.carritos_total = recs.reduce(function (a, r) { return a + r.carW + r.carC; }, 0);
  p.views_total = recs.reduce(function (a, r) { return a + r.views; }, 0);
  p.tiene_qcart = recs.length > 0 ? 'Sí' : 'No';
  p.fuente_qcart = recs.length ? recs[0].fuentes[0] : '';
});

// ═════ VALIDACIÓN ═════
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
var carrCat = PZ.reduce(function (a, p) { return a + (p.carritos_total || 0); }, 0);
var carrSin = sinPieza.reduce(function (a, s) { return a + (s.carritos || 0); }, 0);
var carrQ = Q.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);
var carrConCod = Q.filter(function (r) { return t(r['Shortlink_Code']); }).reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);

chk('ninguna pieza necesita un 6º bloque', !desbordes.length, desbordes.length ? JSON.stringify(desbordes.slice(0, 3)) : 'máx ' + Math.max.apply(null, PZ.map(function (p) { return p.n_recetas; })) + ' recetas · caben ' + BLOQUES);
chk('carritos: catálogo + sin pieza == los que tienen código', carrCat + carrSin === carrConCod,
  carrCat + ' + ' + carrSin + ' = ' + (carrCat + carrSin) + ' vs ' + carrConCod);
chk('toda receta escrita tiene código', PZ.every(function (p) {
  for (var i = 1; i <= BLOQUES; i++) if (t(p['Receta_' + i]) && !t(p['Cod_Walmart_' + i]) && !t(p['Cod_Chedraui_' + i])) return false;
  return true;
}), '');
chk('todo código escrito tiene receta', PZ.every(function (p) {
  for (var i = 1; i <= BLOQUES; i++) if ((t(p['Cod_Walmart_' + i]) || t(p['Cod_Chedraui_' + i])) && !t(p['Receta_' + i])) return false;
  return true;
}), '');
chk('sin código repetido entre piezas', (function () {
  var v = {}, d = [];
  PZ.forEach(function (p) { for (var i = 1; i <= BLOQUES; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { var x = t(p[c + i]); if (!x) return; if (v[x]) d.push(x); v[x] = p.pieza_id; }); });
  return !d.length;
})(), '');
chk('tiene_qcart coincide con tener recetas', PZ.every(function (p) { return (p.tiene_qcart === 'Sí') === (p.n_recetas > 0); }),
  PZ.filter(function (p) { return p.tiene_qcart === 'Sí'; }).length + ' piezas con Qcart');
chk('todo link sin pieza tiene motivo', sinPieza.every(function (s) { return t(s.motivo); }), sinPieza.length + ' links · ' + carrSin + ' carritos');
chk('sin pieza_id duplicado', new Set(PZ.map(function (p) { return p.pieza_id; })).size === PZ.length, PZ.length + ' piezas');

console.log('══ PASO 4 · PIEZA ANCHA ══');
console.log('  piezas: ' + PZ.length + '  ·  con Qcart: ' + PZ.filter(function (p) { return p.tiene_qcart === 'Sí'; }).length);
console.log('  recetas por pieza: máx ' + Math.max.apply(null, PZ.map(function (p) { return p.n_recetas; })) + ' · bloques disponibles ' + BLOQUES);
console.log('  Σ carritos en piezas: ' + carrCat + '  ·  en links sin pieza: ' + carrSin);
console.log('  columnas por pieza: ' + (Object.keys(PZ[0]).length));
console.log('\n  links sin pieza, por motivo:');
var pm = {}; sinPieza.forEach(function (s) { pm[s.motivo] = pm[s.motivo] || { n: 0, c: 0 }; pm[s.motivo].n++; pm[s.motivo].c += s.carritos; });
Object.keys(pm).sort().forEach(function (k) { console.log('    ' + k.padEnd(48) + pm[k].n + ' links · ' + pm[k].c + ' carritos'); });
console.log('\n══ VALIDACIONES ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(46) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S) — no se avanza al paso 5' : '✅ PASO 4 CERRADO · ' + V.length + ' validaciones'));
if (!fallo) { cat.sinPieza = sinPieza; fs.writeFileSync(os.homedir() + '/_P4.json', JSON.stringify(cat, null, 1)); }
process.exit(fallo ? 1 : 0);
