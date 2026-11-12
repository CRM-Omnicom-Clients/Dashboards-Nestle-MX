// 🔴 LA REGLA DE RICK (20-ago-2026): «entre todas las hojas de datos, los datos canónicos deben
//    coincidir siempre, exactamente.»
//
// Es una invariante que NADIE estaba midiendo, y era medible desde el primer día. Cada paso
// validaba su propio bloque contra sí mismo; ninguno comparaba una hoja contra otra. Por eso
// convivían dos escaleras de alias que respondían distinto a la misma pregunta («¿`Bebidas` y
// `Bebida` son el mismo segmento?» → una decía sí y la otra no) sin que ninguna suite lo notara.
//
// Qué se comprueba, y por qué cada cosa:
//   1 · el mismo `pieza_id` muestra el MISMO valor en todas las hojas donde aparezca.
//       Es la comprobación que hace cierta la regla. Las columnas se llaman distinto en cada
//       hoja (`BU_Canonico` en email, `BU` en WhatsApp), así que se comparan por DIMENSIÓN
//       LÓGICA, que es justo para lo que el contrato la declara.
//   2 · un valor canónico que aparece en una hoja existe en el vocabulario del catálogo.
//       Si no existe, alguien lo inventó o el catálogo se quedó corto: las dos cosas hay que verlas.
//   3 · la MISMA función resuelve para todas las fuentes. Si dos scripts usan resolvedores
//       distintos, el punto 1 puede cuadrar hoy por casualidad y romperse mañana.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'escritor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var C = require(require('path').resolve(__dirname, '..') + '/_contratos/hojas.js');
var ALIAS = require(__dirname + '/lib-alias.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ resumen-regenerar · ¿COINCIDEN LOS CANÓNICOS EN TODAS LAS HOJAS? ════════\n');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n6.xlsx'; fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);

// ── 1 · el mismo pieza_id, el mismo valor en todas partes ──────────────────────────
var porPieza = {};      // pieza_id → dimension → { valor: [hojas] }
var hojasConCanonicas = [];
Object.keys(C.hojas).forEach(function (hoja) {
  var def = C.hojas[hoja];
  var cols = Object.assign({}, def.hereda ? C.hojas[def.hereda].columnas : {}, def.columnas);
  var sh = wb.Sheets[hoja]; if (!sh) return;
  var canon = Object.keys(cols).filter(function (c) { return cols[c].dimension; });
  if (!canon.length) return;
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  var colPieza = Object.keys(F[0] || {}).filter(function (k) { return /^pieza_id$/i.test(k); })[0];
  if (!colPieza) { dato(hoja + ' puede cruzarse por pieza_id', false, 'la hoja no tiene columna pieza_id: no se puede comparar fila a fila'); return; }
  hojasConCanonicas.push(hoja);
  F.forEach(function (f) {
    var pid = t(f[colPieza]); if (!pid) return;
    canon.forEach(function (c) {
      if (colsFaltan(F[0], c)) return;
      var v = t(f[c]); if (!v) return;
      var d = cols[c].dimension;
      var reg = (porPieza[pid] = porPieza[pid] || {});
      var dd = (reg[d] = reg[d] || {});
      (dd[v] = dd[v] || []).push(hoja);
    });
  });
});
function colsFaltan(fila0, c) { return fila0 && !(c in fila0); }

var choques = [];
Object.keys(porPieza).forEach(function (pid) {
  Object.keys(porPieza[pid]).forEach(function (d) {
    var vals = Object.keys(porPieza[pid][d]);
    if (vals.length > 1) choques.push({ pieza: pid, dimension: d, valores: vals.map(function (v) { return v + ' (' + porPieza[pid][d][v].join(',') + ')'; }) });
  });
});
console.log('  hojas comparables por pieza_id: ' + (hojasConCanonicas.join(' · ') || 'ninguna'));
console.log('  piezas presentes en más de una hoja: ' + Object.keys(porPieza).filter(function (p) {
  return Object.keys(porPieza[p]).some(function (d) { return Object.keys(porPieza[p][d]).some(function (v) { return porPieza[p][d][v].length > 1; }); });
}).length);
chk('🔴 el mismo pieza_id dice lo mismo en todas las hojas', choques.length === 0,
  choques.length ? '🔴 ' + choques.length + ' contradicciones' : 'sin contradicciones');
choques.slice(0, 8).forEach(function (x) { console.log('     🔴 ' + x.pieza + ' · ' + x.dimension + ': ' + x.valores.join('  vs  ')); });

// ── 2 · todo canónico visible existe en el vocabulario del catálogo ────────────────
var RF = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'] || {}, { defval: '' });
var IXA = ALIAS.indexar(RF);
var PZ = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'] || {}, { defval: '' });
var vocab = {};      // dimension → { normalizado: 1 }
[['bu', 'BU'], ['marca', 'Marca'], ['campana', 'Campaña'], ['segmento', 'Segmento']].forEach(function (p) {
  // ⚠ EL VOCABULARIO TAMBIÉN ES MULTIVALOR. `Marca` del catálogo dice «Carnation, La Lechera»
  //   (Hotcakes lleva las dos). Si solo se parte el lado de la hoja, «Carnation» sale como
  //   «valor que el catálogo no conoce» — y el catálogo sí lo conoce, solo que acompañado.
  //   Se guardan las dos formas: la completa y cada parte.
  vocab[p[0]] = {};
  PZ.forEach(function (x) {
    var v = t(x[p[1]]); if (!v) return;
    vocab[p[0]][ALIAS.nm(v)] = v;
    v.split(/\s*,\s*/).forEach(function (parte) { if (t(parte)) vocab[p[0]][ALIAS.nm(parte)] = t(parte); });
  });
});
var fuera = [];
Object.keys(C.hojas).forEach(function (hoja) {
  var def = C.hojas[hoja];
  var cols = Object.assign({}, def.hereda ? C.hojas[def.hereda].columnas : {}, def.columnas);
  var sh = wb.Sheets[hoja]; if (!sh) return;
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  Object.keys(cols).filter(function (c) { return cols[c].dimension; }).forEach(function (c) {
    F.forEach(function (f) {
      var v = t(f[c]); if (!v) return;
      // multivalor: «Carnation, La Lechera» son dos marcas del vocabulario
      var partes = v.split(/\s*,\s*/).filter(Boolean);
      partes.forEach(function (pp) {
        if (vocab[cols[c].dimension][ALIAS.nm(pp)]) return;
        fuera.push({ hoja: hoja, columna: c, valor: pp });
      });
    });
  });
});
var fueraU = {}; fuera.forEach(function (x) { fueraU[x.hoja + '¦' + x.columna + '¦' + x.valor] = x; });
var listaFuera = Object.keys(fueraU).map(function (k) { return fueraU[k]; });
console.log('\n  valores canónicos distintos fuera del vocabulario: ' + listaFuera.length);
listaFuera.slice(0, 10).forEach(function (x) { console.log('     ' + x.hoja.padEnd(22) + x.columna.padEnd(20) + '«' + x.valor + '»'); });
dato('todo canónico visible existe en Catalogo_Piezas', listaFuera.length === 0,
  listaFuera.length ? listaFuera.length + ' valores que el catálogo no conoce — o los inventó alguien o el catálogo se quedó corto' : 'todos');

// ── 3 · una sola función resuelve para todas las fuentes ───────────────────────────
var D = require('path').resolve(__dirname, '..') + '/_scripts/';
var propios = fs.readdirSync(D).filter(function (f) {
  if (!/^lib-.*\.js$/.test(f) || f === 'lib-alias.js') return false;
  var src = fs.readFileSync(D + f, 'utf8');
  var define = /function nm[z]?\s*\(s\)[\s\S]{0,200}?normalize\('NFD'\)[\s\S]{0,120}?\[\^a-z0-9\]/.test(src);
  var delega = /lib-alias\.js'\)\.nm|ALIAS\.nm/.test(src);
  return define && !delega;
});
console.log('\n  librerías con su PROPIO normalizador de dimensiones: ' + (propios.join(' · ') || 'ninguna'));
chk('🔴 una sola escalera: nadie reimplementa el normalizador de dimensiones', propios.length === 0,
  propios.length ? '🔴 ' + propios.join(' · ') : 'todas delegan en lib-alias.nm');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(56) + (v[2] || '')); });
if (H.length) {
  console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO de la fuente, no un fallo del paso)');
  H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(54) + (h[2] || '')); });
}
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ LOS CANÓNICOS COINCIDEN — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
