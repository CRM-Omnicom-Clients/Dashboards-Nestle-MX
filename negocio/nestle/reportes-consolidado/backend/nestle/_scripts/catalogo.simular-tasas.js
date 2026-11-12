// ¿La LLAVE del catálogo alcanza para que N3 calcule OR y CTOR él mismo?
//
// El catálogo trae solo Sends. Eso está BIEN por diseño (es la capa semántica, no los números)
// **siempre que su llave permita repartir cualquier métrica**. Si no alcanza, el catálogo
// tendría que cargar métricas — y entonces duplicaría Data_Email y se desincronizaría.
// Esto lo resuelve, no lo opina.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(__dirname + '/lib-alias.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var iso = function (f) { if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10); return t(f).slice(0, 10); };
var wb = XLSX.readFile(require('path').resolve(__dirname, '..') + '/_tmp/_n3.xlsx');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var IX = A.indexar(R);
var assetDe = function (s) { return (t(s).match(/_(\d{4,})\s*$/) || [])[1] || ''; };
var pr = [], roto = 0;
function K(n, ok, d) { pr.push([n, ok, d]); if (!ok) roto++; }

// ── N3 usa SOLO la llave que el catálogo declara, y reparte él mismo TODAS las métricas
var porK = {};
E.forEach(function (r) {
  var camp = t(r['Campana_Canonica']);
  var segRaw = t(r['Segmento_Canonico']);
  var seg = (A.resolver(IX, 'Segmento', segRaw, camp, '').v) || segRaw;
  var tp = (A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v) || t(r['Touchpoint']);
  // 🔴 la fila se indexa bajo el segmento canónico Y el crudo (Antojo Infinito tiene
  //    Segmento="Combinado" y los reales en la otra columna). Pero cuando coinciden hay que
  //    meterla UNA vez: sin este dedup todo salía exactamente ×2 — y las TASAS no lo delatan,
  //    porque numerador y denominador se duplican igual. Solo lo delata el total.
  var vistas = {};
  [seg, segRaw].forEach(function (s) {
    var k = [camp, tp, s, t(r['Email_Type']), assetDe(r['Email_Content_Name'])].join('¦');
    if (vistas[k]) return;
    vistas[k] = 1;
    (porK[k] = porK[k] || []).push(r);
  });
});

var rejilla = {}, sinFilas = 0;
P.forEach(function (p) {
  var k1 = [t(p['Campaña']), t(p['Touchpoint']), t(p['Segmento']), t(p['Email_Type']), t(p['Asset_ID'])].join('¦');
  var k2 = [t(p['Campaña']), t(p['Touchpoint']), t(p['Segmentos_Combinados']), t(p['Email_Type']), t(p['Asset_ID'])].join('¦');
  var filas = porK[k1] || (t(p['Segmentos_Combinados']) ? porK[k2] : null) || [];
  if (!filas.length) { sinFilas++; return; }
  filas.forEach(function (r) {
    var mes = r['Send_Date'] ? iso(r['Send_Date']).slice(0, 7) : t(p['Mes_Lanzamiento']);
    var kk = [t(p['Camp_ID']), t(p['Touchpoint']), t(p['Segmento']), mes].join('¦');
    var f = rejilla[kk] = rejilla[kk] || { camp: t(p['Campaña']), tp: t(p['Touchpoint']), seg: t(p['Segmento']), mes: mes, obj: t(p['Objetivo']), s: 0, d: 0, o: 0, c: 0 };
    f.s += num(r['Email_Sends']); f.d += num(r['Email_Deliveries']);
    f.o += num(r['Email_Unique_Opens']); f.c += num(r['Email_Unique_Clicks']);
  });
});
var G = Object.keys(rejilla).map(function (k) { return rejilla[k]; });

console.log('════ ¿ALCANZA LA LLAVE PARA LAS TASAS? ════\n');
console.log('  filas con métricas completas: ' + G.length + '   (piezas sin filas de email: ' + sinFilas + ')');

// ── los totales tienen que cuadrar con Data_Email, o la llave pierde filas
var tot = { s: 0, d: 0, o: 0, c: 0 };
G.forEach(function (f) { tot.s += f.s; tot.d += f.d; tot.o += f.o; tot.c += f.c; });
var totE = { s: 0, d: 0, o: 0, c: 0 };
E.forEach(function (r) { totE.s += num(r['Email_Sends']); totE.d += num(r['Email_Deliveries']); totE.o += num(r['Email_Unique_Opens']); totE.c += num(r['Email_Unique_Clicks']); });
['s', 'd', 'o', 'c'].forEach(function (m) {
  var nom = { s: 'Sends', d: 'Deliveries', o: 'Unique_Opens', c: 'Unique_Clicks' }[m];
  K('Σ ' + nom + ' de la rejilla == Data_Email', tot[m] === totE[m], tot[m].toLocaleString() + ' vs ' + totE[m].toLocaleString());
});

// ── ¿las tasas salen sanas? (numerador y denominador de la MISMA fila — regla dura)
var raras = G.filter(function (f) { return f.d && (f.o > f.d || f.c > f.o); });
K('ninguna tasa imposible (opens>deliveries o clicks>opens)', !raras.length,
  raras.length ? raras.slice(0, 3).map(function (f) { return f.camp + '/' + f.tp + '/' + f.mes; }).join(' · ') : G.length + ' filas');

console.log('\n  muestra de la rejilla CON tasas — esto es lo que N3 produciría:');
console.log('    Campaña        TP     Segmento             Mes       Sends       OR     CTOR');
G.sort(function (a, b) { return b.s - a.s; }).slice(0, 8).forEach(function (f) {
  var or = f.d ? (f.o / f.d * 100).toFixed(1) + '%' : '—';
  var ctor = f.o ? (f.c / f.o * 100).toFixed(1) + '%' : '—';
  console.log('    ' + f.camp.slice(0, 14).padEnd(15) + f.tp.padEnd(7) + f.seg.slice(0, 19).padEnd(21) + f.mes.padEnd(10) +
    String(f.s.toLocaleString()).padStart(9) + String(or).padStart(8) + String(ctor).padStart(8));
});

console.log('\n════ VEREDICTO ════');
pr.forEach(function (p) { console.log('  ' + (p[1] ? '✔' : '🔴') + ' ' + p[0].padEnd(48) + (p[2] || '')); });
console.log('\n  ' + (roto
  ? '🔴 la llave NO alcanza: el catálogo tendría que cargar métricas'
  : '✅ la llave ALCANZA — N3 reparte cualquier métrica él mismo.\n     El catálogo NO debe cargar Opens/Clicks: duplicaría Data_Email y se desincronizaría.\n     Sends_Por_Quincena queda como CHECKSUM de que la llave parte bien, no como el dato.'));
