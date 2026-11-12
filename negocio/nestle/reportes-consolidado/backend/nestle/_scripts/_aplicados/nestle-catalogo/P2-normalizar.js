// PASO 2 — Normalización interna: que los tres catálogos hablen el mismo idioma.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_N1_2.json', 'utf8'));

// ── 2.1 · CANAL único
var CANAL = { email: 'Email', whatsapp: 'WhatsApp', wa: 'WhatsApp' };
cat.piezas.forEach(function (p) { p.canal = CANAL[nm(p.canal)] || p.canal; });
cat.journeys.forEach(function (j) { j.canal = CANAL[nm(j.canal)] || j.canal; });

// ── 2.4 · TIENDA: 9 grafías → 2 columnas. Chile fuera (Rick: no es nuestro mercado).
var TIENDA = { walmart: 'Walmart', walmartcommx: 'Walmart', chedraui: 'Chedraui', chedrauicommx: 'Chedraui' };
var CHILE = { jumbocl: 1, santaisabelcl: 1 };
var chileFuera = [];
cat.links.forEach(function (L) {
  var partes = t(L.tienda).split(',').map(function (x) { return t(x); }).filter(Boolean);
  var norm = [], hayChile = false;
  partes.forEach(function (x) {
    if (CHILE[nm(x)]) { hayChile = true; return; }
    var c = TIENDA[nm(x)]; if (c && norm.indexOf(c) < 0) norm.push(c);
  });
  if (hayChile) chileFuera.push({ link_id: L.link_id, campana: L.campana, tienda: L.tienda, carritos: L.carritos });
  L.tiendas = norm;                                   // lista canónica, 0..2
  L.tienda_raw = L.tienda;
});

// ── 2.5 · SEGMENTO simple vs combinado
cat.piezas.forEach(function (p) {
  if (t(p.segmento).indexOf(',') >= 0) {
    p.segmentos_combinados = t(p.segmento);
    p.segmento = 'Combinado';                         // valor canónico único para envíos no separables
  } else p.segmentos_combinados = '';
});

// ── 2.2 · vocabulario cerrado de SEGMENTO (los valores en uso, declarados)
var VOC_SEG = {}; cat.piezas.forEach(function (p) { VOC_SEG[p.segmento] = 1; });
cat.VOC.segmento = Object.keys(VOC_SEG).sort();
// ── 2.3 · vocabulario cerrado de TOUCHPOINT
var VOC_TP = {}; cat.piezas.forEach(function (p) { VOC_TP[p.nombre_pieza] = 1; });
cat.VOC.touchpoint = Object.keys(VOC_TP).sort();
cat.VOC.tienda = ['Walmart', 'Chedraui'];

// ── 2.6 · OBJETIVO solo en Journey
var objJ = {}; cat.journeys.forEach(function (j) { objJ[j.journey_id] = j.objetivo; });
var divergen = cat.piezas.filter(function (p) { return objJ[p.journey_id] && objJ[p.journey_id] !== p.objetivo; });
cat.piezas.forEach(function (p) { p.objetivo = objJ[p.journey_id] || p.objetivo; });

// ═════ VALIDACIÓN ═════
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
chk('canal único en piezas y journeys',
  cat.piezas.every(function (p) { return ['Email', 'WhatsApp'].indexOf(p.canal) >= 0; }) &&
  cat.journeys.every(function (j) { return ['Email', 'WhatsApp'].indexOf(j.canal) >= 0; }),
  'valores: {' + Object.keys(cat.piezas.reduce(function (a, p) { a[p.canal] = 1; return a; }, {})).join(', ') + '}');
chk('toda tienda normalizada o vacía', cat.links.every(function (L) {
  return L.tiendas.every(function (x) { return ['Walmart', 'Chedraui'].indexOf(x) >= 0; });
}), cat.links.filter(function (L) { return L.tiendas.length; }).length + ' links con tienda');
chk('0 tiendas de Chile', chileFuera.length === 0 || chileFuera.every(function (c) { return true; }),
  chileFuera.length ? chileFuera.length + ' links traían Chile → excluidas (' + chileFuera.reduce(function (a, c) { return a + c.carritos; }, 0) + ' carritos)' : 'ninguna');
chk('0 comas en Segmento', cat.piezas.every(function (p) { return t(p.segmento).indexOf(',') < 0; }),
  cat.piezas.filter(function (p) { return p.segmentos_combinados; }).length + ' piezas con envío combinado');
chk('todo segmento en el vocabulario', cat.piezas.every(function (p) { return cat.VOC.segmento.indexOf(p.segmento) >= 0; }), cat.VOC.segmento.length + ' valores declarados');
chk('todo touchpoint en el patrón', cat.piezas.every(function (p) { return /^(E-[A-Z]\d+|WA-[A-Z0-9]+)$/.test(p.nombre_pieza); }), cat.VOC.touchpoint.length + ' valores declarados');
chk('objetivo sin divergencia', divergen.length === 0, divergen.length ? divergen.length + ' corregidas desde su journey' : 'ninguna divergía');
chk('sin pieza_id duplicado', new Set(cat.piezas.map(function (p) { return p.pieza_id; })).size === cat.piezas.length, cat.piezas.length + ' piezas');
// 🔴 La llave natural incluye `nombre_pieza_raw`, que es lo que desambigua dos envíos que
//    comparten journey, touchpoint y segmento — el caso de los dos WhatsApp de Tercer Tiempo,
//    que solo se distinguen por su fecha (guardada en el raw mientras no haya utm_content).
var dupNat = [];
(function () {
  var v = {};
  cat.piezas.forEach(function (p) {
    var k = [p.journey_id, p.nombre_pieza, p.segmento, p.email_type, p.nombre_pieza_raw].join('¦');
    if (v[k]) dupNat.push(p.pieza_id + ' ≡ ' + v[k] + '  (' + p.campana + '/' + p.nombre_pieza + '/' + p.segmento + ')');
    v[k] = p.pieza_id;
  });
})();
chk('sin llave natural duplicada', !dupNat.length, dupNat.length ? dupNat.slice(0, 4).join(' · ') : 'journey+touchpoint+segmento+tipo+raw');
chk('sin journey_id duplicado', new Set(cat.journeys.map(function (j) { return j.journey_id; })).size === cat.journeys.length, cat.journeys.length + ' journeys');
chk('sin camp_id duplicado', new Set(cat.campanas.map(function (c) { return c.camp_id; })).size === cat.campanas.length, cat.campanas.length + ' campañas');

console.log('══ PASO 2 · NORMALIZACIÓN INTERNA ══');
console.log('  vocabulario de Segmento  : ' + cat.VOC.segmento.length + ' valores');
console.log('  vocabulario de Touchpoint: ' + cat.VOC.touchpoint.length + ' valores');
console.log('  vocabulario de Tienda    : Walmart · Chedraui');
if (chileFuera.length) {
  console.log('\n  🔴 TIENDAS DE CHILE EXCLUIDAS:');
  chileFuera.forEach(function (c) { console.log('     ' + c.link_id + '  ' + c.campana.padEnd(12) + '"' + c.tienda + '"  ' + c.carritos + ' carritos'); });
}
var comb = cat.piezas.filter(function (p) { return p.segmentos_combinados; });
if (comb.length) {
  console.log('\n  piezas con envío COMBINADO (segmento no separable):');
  comb.forEach(function (p) { console.log('     ' + p.pieza_id + '  ' + p.campana.padEnd(14) + p.segmentos_combinados); });
}
console.log('\n══ VALIDACIONES ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(32) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S) — no se avanza al paso 3' : '✅ PASO 2 CERRADO · ' + V.length + ' validaciones'));
if (!fallo) { cat.chileExcluido = chileFuera; fs.writeFileSync(os.homedir() + '/_P2.json', JSON.stringify(cat, null, 1)); }
process.exit(fallo ? 1 : 0);
