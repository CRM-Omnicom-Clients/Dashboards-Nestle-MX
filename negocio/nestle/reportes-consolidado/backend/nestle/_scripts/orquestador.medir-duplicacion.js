// ETAPA 7 · Re-mide el código repetido, sobre el estado YA REDUCIDO.
//
// 🔴 POR QUÉ SE VUELVE A MEDIR. La medición anterior era de la fase 4, sobre 93 scripts, y desde
//    entonces se archivaron 20, se renombraron 651 identificadores y se ancló todo al catálogo
//    raíz. Usar aquel número para decidir qué consolidar sería decidir sobre un sistema que ya no
//    existe — el mismo defecto que el mapa desfasado, aplicado a una medición.
//
// 🔴 QUÉ ES UN «IDIOMA REPETIDO» Y QUÉ NO. No es código parecido: es la MISMA operación resuelta
//    otra vez. Abrir un libro, leer sus filas, formatear miles. No infla lo que se ve correr; infla
//    cuánto hay que tocar cuando esa lógica tiene un bug — y ése es el ciclo que Rick describió:
//    «rompes, borras, reescribes». Hoy mismo el defecto de leer una columna apareció CINCO veces en
//    cinco archivos distintos, porque estaba escrito cinco veces.
//
// 🔴 Y SE SEPARA LO QUE CORRE DE LO QUE NO. Consolidar un idioma en un adversarial archivado no
//    compra nada. La deuda que importa es la de los 35 del corte.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var delCorte = {};
C.etapas.forEach(function (e) {
  e.scripts.forEach(function (n) { delCorte[n.script] = 1; (n.suites || []).forEach(function (s) { delCorte[s] = 1; }); });
});

// los idiomas: cada uno es una operación que YA tiene (o debería tener) una librería
var IDIOMAS = {
  'abrir-libro': { rx: /XLSX\.readFile\(/, lib: 'lib-flexible.archivoVivo + una capacidad de apertura' },
  'leer-filas': { rx: /sheet_to_json\(/, lib: 'una capacidad `filasDe(hoja)`' },
  'trim-propio': { rx: /function\s+t\s*\(|var t = function/, lib: 'lib-columna ya lo trae' },
  'numero-propio': { rx: /function num\s*\(|var num = function/, lib: 'una capacidad `numero()`' },
  'mil-propio': { rx: /function mil\s*\(/, lib: 'una capacidad `mil()`' },
  'normalizador-propio': { rx: /normalize\('NFD'\)/, lib: 'lib-columna.plano ya lo trae' },
  'letra-columna': { rx: /function (col|letra|letraDeNum)\s*\(/, lib: 'una capacidad `letraDe(n)`' },
  'las-5-capas': { rx: /xlsx-safe-save/, lib: 'lib-capacidades.publicar ya las corre' },
  'releer-para-verificar': { rx: /releíd|releido|releer/i, lib: 'lib-capacidades.verificarEnDisco' },
  'chequeo-propio': { rx: /function chk\s*\(|function check\s*\(/, lib: 'lib-capacidades.checks' },
  'copiar-a-temp': { rx: /copyFileSync\([^)]*homedir/, lib: 'la capacidad de apertura ya copia' }
};

var scripts = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f) && !/^lib-/.test(f); });
var conteo = {}, porIdiomaCorte = {}, detalle = {};

scripts.forEach(function (f) {
  var t = fs.readFileSync(path.join(D, f), 'utf8');
  Object.keys(IDIOMAS).forEach(function (id) {
    if (!IDIOMAS[id].rx.test(t)) return;
    conteo[id] = (conteo[id] || 0) + 1;
    if (delCorte[f]) {
      porIdiomaCorte[id] = (porIdiomaCorte[id] || 0) + 1;
      (detalle[id] = detalle[id] || []).push(f);
    }
  });
});

console.log('════════ ETAPA 7 · DUPLICACIÓN, RE-MEDIDA ════════\n');
console.log('  scripts medidos: ' + scripts.length + '   (de ellos, ' + Object.keys(delCorte).length + ' corren en el corte)\n');
console.log('  ' + 'IDIOMA'.padEnd(24) + 'TOTAL'.padStart(6) + 'EN EL CORTE'.padStart(13) + '   QUÉ LO SUSTITUIRÍA');
console.log('  ' + '─'.repeat(96));
var total = 0, totalCorte = 0;
Object.keys(conteo).sort(function (a, b) { return (porIdiomaCorte[b] || 0) - (porIdiomaCorte[a] || 0); }).forEach(function (id) {
  total += conteo[id]; totalCorte += (porIdiomaCorte[id] || 0);
  console.log('  ' + id.padEnd(24) + String(conteo[id]).padStart(6) + String(porIdiomaCorte[id] || 0).padStart(13) + '   ' + IDIOMAS[id].lib);
});
console.log('  ' + '─'.repeat(96));
console.log('  ' + 'TOTAL'.padEnd(24) + String(total).padStart(6) + String(totalCorte).padStart(13));

// ── comparación con la medición anterior, si existe
var antes = null;
try { antes = JSON.parse(fs.readFileSync(BACK + '/_contratos/duplicacion.json', 'utf8')); } catch (e) { }
if (antes && antes.scripts) {
  var nAntes = Object.keys(antes.scripts).length;
  var copiasAntes = Object.keys(antes.scripts).reduce(function (a, k) { return a + (antes.scripts[k].idiomas || []).length; }, 0);
  console.log('\n  ── contra la medición de la fase 4 ──');
  console.log('     scripts:  ' + nAntes + ' → ' + scripts.length);
  console.log('     copias:   ' + copiasAntes + ' → ' + total + '   (' + (total < copiasAntes ? '−' : '+') + Math.abs(copiasAntes - total) + ')');
  console.log('     ⚠ no son comparables uno a uno: la medición vieja contaba idiomas que ya no se miden igual.');
  console.log('       Lo que sí vale es el número NUEVO, y sobre todo la columna «EN EL CORTE».');
}

fs.writeFileSync(BACK + '/_contratos/duplicacion.json', JSON.stringify({
  nodo: 'orquestador.medir-duplicacion', medido: 'etapa 7 · sobre el estado ya reducido',
  scripts_medidos: scripts.length, del_corte: Object.keys(delCorte).length,
  total_copias: total, copias_en_el_corte: totalCorte,
  por_idioma: conteo, por_idioma_en_el_corte: porIdiomaCorte, detalle_del_corte: detalle,
  nota: 'La deuda que importa es la del corte. Consolidar un idioma en un adversarial archivado no compra nada.'
}, null, 1));

console.log('\n  ── LOS TRES QUE MÁS PESAN EN EL CORTE ──');
Object.keys(porIdiomaCorte).sort(function (a, b) { return porIdiomaCorte[b] - porIdiomaCorte[a]; }).slice(0, 3).forEach(function (id) {
  console.log('     ' + String(porIdiomaCorte[id]).padStart(3) + '  ' + id.padEnd(22) + '→ ' + IDIOMAS[id].lib);
  console.log('          ' + (detalle[id] || []).slice(0, 5).join(' · ') + ((detalle[id] || []).length > 5 ? ' … +' + (detalle[id].length - 5) : ''));
});
console.log('\n  → _contratos/duplicacion.json');
