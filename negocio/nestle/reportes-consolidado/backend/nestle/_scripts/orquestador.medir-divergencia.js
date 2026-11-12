// ETAPA 7 · ¿Las copias del mismo idioma dicen LO MISMO? — la pregunta que cambia la etapa.
//
// 🔴 EL HALLAZGO QUE LA MOTIVA. Al ir a consolidar `mil()` —formatear miles, el idioma más inocuo
//    de todos— aparecieron CUATRO implementaciones distintas, y no son equivalentes:
//        Number(n || 0)            → null y undefined dan «0»          (26 copias)
//        Number(n)                 → undefined da «NaN»                 (5)
//        n.toLocaleString()        → **TRUENA** con null                (1)
//        Number(Math.round(n||0))  → REDONDEA: 1.6 sale «2»             (1)
//    Es decir: el sistema formatea un número de cuatro maneras según qué script lo tocó.
//
// 🔴 POR QUÉ ESTO REENCUADRA LA DUPLICACIÓN. Contarla como «hay que tocar 26 archivos si cambia»
//    la subestima: el problema real es que **ya cambiaron, cada una por su lado**, y nadie lo
//    decidió. Una copia que diverge deja de ser una copia y pasa a ser una segunda regla — sin
//    dueño, sin declarar, y sin que ninguna suma la vea.
//
// 🔴 Y POR ESO NO SE CONSOLIDA A CIEGAS. Sustituir las 33 por una sola CAMBIARÍA el comportamiento
//    de 7 de ellas. Consolidar sin saberlo sería exactamente el reemplazo ciego que hoy ya rompió
//    cuatro cosas. Se mide, se declara cuál es la canónica y cuáles divergen, y la consolidación
//    pasa a ser una decisión con la evidencia delante.
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

// los idiomas que se pueden capturar como una función de una línea y comparar literalmente
var CAPTURAS = {
  'mil': /function mil\s*\([^)]*\)\s*\{[^}]*\}/,
  'num': /function num\s*\([^)]*\)\s*\{[^}]*\}/,
  't (trim)': /var t = function\s*\([^)]*\)\s*\{[^}]*\};/,
  'letra/col': /function (?:col|letraDeNum)\s*\([^)]*\)\s*\{[^}]*\}/
};

console.log('════════ ETAPA 7 · ¿LAS COPIAS DICEN LO MISMO? ════════\n');

var salida = {};
Object.keys(CAPTURAS).forEach(function (id) {
  var variantes = {};
  fs.readdirSync(D).forEach(function (f) {
    if (!/\.js$/.test(f) || /^lib-/.test(f)) return;
    var m = CAPTURAS[id].exec(fs.readFileSync(path.join(D, f), 'utf8'));
    if (!m) return;
    var cuerpo = m[0].replace(/\s+/g, ' ').trim();
    (variantes[cuerpo] = variantes[cuerpo] || []).push(f);
  });
  var lista = Object.keys(variantes).sort(function (a, b) { return variantes[b].length - variantes[a].length; });
  if (!lista.length) return;

  var enCorte = function (v) { return variantes[v].filter(function (f) { return delCorte[f]; }).length; };
  console.log('══ `' + id + '` — ' + lista.length + ' variante(s) distintas, ' +
    lista.reduce(function (a, v) { return a + variantes[v].length; }, 0) + ' copias ══');
  lista.forEach(function (v, i) {
    var marca = i === 0 ? '   ✔ CANÓNICA ' : '   🔴 DIVERGE ';
    console.log(marca + '(' + variantes[v].length + ' copias, ' + enCorte(v) + ' en el corte)');
    console.log('        ' + v.slice(0, 110));
    if (i > 0) console.log('        en: ' + variantes[v].slice(0, 4).join(' · ') + (variantes[v].length > 4 ? ' …' : ''));
  });
  console.log();
  salida[id] = {
    variantes: lista.length,
    canonica: { cuerpo: lista[0], copias: variantes[lista[0]].length, en_corte: enCorte(lista[0]) },
    divergentes: lista.slice(1).map(function (v) {
      return { cuerpo: v, copias: variantes[v].length, en_corte: enCorte(v), archivos: variantes[v] };
    })
  };
});

var totalDiv = Object.keys(salida).reduce(function (a, k) {
  return a + salida[k].divergentes.reduce(function (b, d) { return b + d.copias; }, 0);
}, 0);
var divEnCorte = Object.keys(salida).reduce(function (a, k) {
  return a + salida[k].divergentes.reduce(function (b, d) { return b + d.en_corte; }, 0);
}, 0);

fs.writeFileSync(BACK + '/_contratos/divergencia.json', JSON.stringify({
  nodo: 'orquestador.medir-divergencia', medido: 'etapa 7',
  que_es: 'Copias del mismo idioma que YA NO dicen lo mismo. Una copia que diverge dejó de ser una copia: es una segunda regla, sin dueño y sin declarar.',
  total_divergentes: totalDiv, divergentes_en_el_corte: divEnCorte,
  regla: 'No se consolida a ciegas: sustituir todas por la canónica CAMBIARÍA el comportamiento de las divergentes. Se decide con la evidencia delante.',
  idiomas: salida
}, null, 1));

console.log('  ── TOTAL ' + '─'.repeat(60));
console.log('   copias que DIVERGEN de su canónica: ' + totalDiv + '   ·   de ellas, en el corte: ' + divEnCorte);
console.log('\n   🔴 Consolidar a ciegas cambiaría el comportamiento de esas ' + totalDiv + '.');
console.log('      La duplicación no era «hay que tocar N archivos»: es que ya cambiaron, cada una');
console.log('      por su lado, y nadie lo decidió. Eso es lo que hay que cerrar, no el conteo.');
console.log('\n  → _contratos/divergencia.json');
