// nestle-catalogo · LOS 307 HUECOS DE QCART: ¿cuáles cierra el maestro y cuáles son `No`? Mide.
//
// 🔴 LA PREGUNTA NO ES «¿QUÉ FALTA?» SINO «¿ESTA PIEZA TIENE QCART O NO?». Y las dos respuestas
//    son un dato, no un hueco:
//      · la pieza ESTÁ en el maestro  → `Tiene_Qcart = Sí` y sus códigos, recetas y fecha
//      · la pieza NO está en el maestro → `Tiene_Qcart = No`, y entonces `Carritos_Total`,
//        `Views_Total`, `Codigos_Qcart`… no son POR DEFINIR: son **N/A**, porque esa pieza no
//        lleva carrito. Dejarlas en POR DEFINIR dice «lo debemos» sobre algo que no existe.
//
// 🔴 LA LLAVE ES campaña × touchpoint × segmento — y el maestro usa SUS PROPIAS grafías
//    (`aon-rn-abril-purchase`, `FamilyFocused`). Se resuelven con `lib-alias`, que es la escalera
//    del catálogo; NUNCA por parecido de texto. Si un bloque no resuelve, se declara y NO se usa:
//    el alias `Email 2→E-P2` ya mandó 191 carritos al segmento de al lado con la suma cuadrando.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var ML = require(__dirname + '/lib-maestro-links.js');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var FALTA = /^(POR DEFINIR|PENDIENTE)$/i;
var falta = function (v) { return FALTA.test(t(v)); };

var X = M.cargar();
var doc = ML.piezasDelDoc();
console.log('════════ LOS HUECOS DE QCART CONTRA EL MAESTRO ════════\n');
console.log('  catálogo: ' + X.piezas.length + ' piezas   ·   maestro: ' + doc.length + ' bloques (mes vigente y con fecha)\n');

var nmC = X.columna('Campaña'), nmT = X.columna('TouchPoint'), nmS = X.columna('Segmento');
var nmQ = X.columna('Tiene_Qcart'), nmCod = X.columna('Codigos_Qcart');

// 🔴 el índice del maestro se arma por los CÓDIGOS, que es la llave probada (R2: la llave de
//    Qcart es el SHORTLINK, nunca la utm). Así una pieza se reconoce por lo que de verdad
//    comparte con el doc, no por cómo se escribe su campaña ahí.
var docPorCodigo = {};
doc.forEach(function (b) { (b.codigos || []).forEach(function (c) { if (t(c)) docPorCodigo[t(c)] = b; }); });
console.log('  el maestro trae ' + Object.keys(docPorCodigo).length + ' shortlinks en esos ' + doc.length + ' bloques\n');

// las piezas del catálogo que YA tienen códigos: por ahí se sabe cuál bloque es cuál
var bloqueDePieza = {};
X.piezas.forEach(function (p) {
  var cods = t(p[nmCod]).split(/[;,]\s*/).map(t).filter(function (c) { return c && !falta(c); });
  var b = null;
  cods.forEach(function (c) { if (!b && docPorCodigo[c]) b = docPorCodigo[c]; });
  if (b) bloqueDePieza[X.idDe(p)] = b;
});
console.log('  piezas del catálogo que ya casan con un bloque del maestro por shortlink: ' + Object.keys(bloqueDePieza).length);

// ── los huecos de Qcart, y qué se puede decir de cada pieza ─────────────────────────
var COLS_QCART = ['Tiene_Qcart', 'N_Recetas', 'Codigos_Qcart', 'Fuente_Qcart', 'Carritos_Total', 'Views_Total',
  'Fecha_Activacion_Qcart', 'Activaciones_Qcart'];
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(X.tmp).Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var esQcart = /^(Receta|URL_Receta|Cod_Walmart|Cod_Chedraui|Carritos_Walmart|Carritos_Chedraui)_\d$/;

var conBloque = [], sinBloque = [];
X.piezas.forEach(function (p) {
  var id = X.idDe(p);
  var huecos = enc.filter(function (h) { return h && (COLS_QCART.indexOf(h) >= 0 || esQcart.test(h)) && falta(p[h]); });
  if (!huecos.length) return;
  var b = bloqueDePieza[id];
  var reg = { id: id, campana: t(p[nmC]), tp: t(p[nmT]), seg: t(p[nmS]), huecos: huecos.length,
    cols: huecos, tieneQcart: t(p[nmQ]) };
  if (b) { reg.bloque = b.llave; reg.codigos = b.codigos; conBloque.push(reg); } else sinBloque.push(reg);
});

console.log('\n  ── 🔧 CON BLOQUE EN EL MAESTRO: ' + conBloque.length + ' pieza(s), ' +
  conBloque.reduce(function (a, x) { return a + x.huecos; }, 0) + ' hueco(s)');
conBloque.forEach(function (x) {
  console.log('     ' + x.id.padEnd(10) + x.campana.slice(0, 14).padEnd(16) + x.tp.padEnd(10) + x.seg.slice(0, 20).padEnd(22) +
    String(x.huecos).padStart(2) + ' hueco(s)   ← ' + x.bloque.slice(0, 44));
});

console.log('\n  ── 🔴 SIN BLOQUE EN EL MAESTRO: ' + sinBloque.length + ' pieza(s), ' +
  sinBloque.reduce(function (a, x) { return a + x.huecos; }, 0) + ' hueco(s)');
console.log('     Estas NO llevan Qcart: sus columnas de carrito no son POR DEFINIR, son N/A.');
var porCamp = {};
sinBloque.forEach(function (x) { (porCamp[x.campana] = porCamp[x.campana] || []).push(x); });
Object.keys(porCamp).sort().forEach(function (c) {
  var G = porCamp[c];
  console.log('     ' + (c || '(sin campaña)').slice(0, 20).padEnd(22) + String(G.length).padStart(3) + ' pieza(s)   ' +
    G.reduce(function (a, x) { return a + x.huecos; }, 0) + ' hueco(s)   ·   Tiene_Qcart hoy: ' +
    Object.keys(G.reduce(function (a, x) { a[x.tieneQcart || '(vacío)'] = 1; return a; }, {})).join(' / '));
});

fs.writeFileSync(BACK + '/_preescritura/qcart-huecos.json', JSON.stringify({ cuando: new Date().toISOString(), conBloque: conBloque, sinBloque: sinBloque }, null, 1));
console.log('\n  → _preescritura/qcart-huecos.json');
