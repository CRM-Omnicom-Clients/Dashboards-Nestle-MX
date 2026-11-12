// ¿LA CADENA CRECE SOLA? — la prueba que mecaniza «se arregla al creador, nunca al heredero».
//
// 🔴 EL CASO QUE LA PIDIÓ. Retiré la columna fantasma `EmailID` del catálogo, verifiqué que ninguna
//    celda se había movido, y la di por cerrada. En la corrida siguiente de la cadena estaba otra
//    vez ahí: catalogo-aplicar la crea en la etapa 4, y mi retiro corría después. Arreglar aguas abajo del que
//    crea el problema no arregla nada — solo lo esconde hasta la próxima corrida.
//    El mismo día, y por la misma ceguera, se descubrió algo peor: catalogo-aplicar decidía si una pieza de
//    Pro Plan era alta preguntando por su `pieza_id`, que esas piezas no traen. Así que cada corrida
//    daba de alta las mismas 12 con ids nuevos. **204 filas sobrantes**, acumuladas en 17 corridas,
//    y ninguna guarda lo vio: los ids eran todos distintos, así que «id único» salía verde.
//
// 🔴 CÓMO SE MIDE, SIN OPINIONES. Se corre la cadena dos veces seguidas y se comparan las
//    DIMENSIONES de cada hoja. Si algo crece entre la primera y la segunda, hay un script que fabrica
//    en vez de actualizar — y da igual cuál sea: la prueba lo nombra sin tener que entenderlo.
//    Es la única prueba del sistema que no necesita saber qué hace ningún paso.
//
// ⚠ ESCRIBE AL WORKBOOK: corre la cadena de verdad, dos veces. No es una prueba en seco — en seco
//   este defecto es invisible, porque nada se crea. Por eso pide `--escribir` explícito.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var D = require('path').resolve(__dirname, '..') + '/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

function foto() {
  var vivo = L.archivoVivo({ dir: PROY });
  var tmp = path.join(os.tmpdir(), 'idem-' + Date.now() % 100000 + '.xlsx');
  fs.copyFileSync(vivo.ruta, tmp);
  var wb = XLSX.readFile(tmp);
  var f = {};
  Object.keys(wb.Sheets).forEach(function (h) {
    var R = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: '' });
    f[h] = { filas: R.length, cols: R.length ? R[0].length : 0, enc: (R[0] || []).map(function (v) { return String(v || '').trim(); }) };
  });
  fs.rmSync(tmp, { force: true });
  return f;
}

console.log('════════ ¿LA CADENA CRECE SOLA? ════════\n');
if (!ESCRIBIR) {
  console.log('  ⚠ esta prueba corre la cadena DOS VECES y escribe al workbook.');
  console.log('    En seco el defecto es invisible: nada se crea, así que nada crece.');
  console.log('\n    Para correrla:  node orquestador.probar-idempotencia.js --escribir');
  process.exit(0);
}

var antes = foto();
console.log('  antes de todo:');
Object.keys(antes).sort().forEach(function (h) { console.log('     ' + h.padEnd(24) + antes[h].filas + ' filas × ' + antes[h].cols + ' cols'); });

var fotos = [antes];
for (var i = 1; i <= 2; i++) {
  console.log('\n  ── corrida ' + i + ' de la cadena ──');
  var r = cp.spawnSync(process.execPath, [D + '/orquestador.orquestador.js', '--escribir'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  var salida = (r.stdout || '') + (r.stderr || '');
  // 🔴 EL REGEX ESTABA DESFASADO Y ESO NO ES COSMÉTICO. Buscaba `scripts corridos: N` y el
  //    orquestador imprime `scripts de ejecución corridos: N` desde que se renombró el concepto.
  //    Resultado: este probador llevaba tiempo diciendo «(sin línea final)» — o sea, no podía
  //    reportar qué acababa de correr — y cuando además fallaba algo, lo único que se veía era
  //    «la cadena falló» sin una sola pista. Se acepta cualquiera de las dos redacciones y, si
  //    la corrida se rompe, se imprimen las últimas líneas REALES en vez de un veredicto mudo.
  var fin = (salida.match(/scripts (?:de ejecución )?corridos: \d+[^\n]*/) || ['(no encontré la línea de resumen)'])[0];
  console.log('     ' + fin.trim());
  if (r.status !== 0) {
    console.log('     🔴 la cadena falló — la idempotencia no se puede medir sobre una corrida rota');
    console.log('     ── últimas líneas de esa corrida:');
    salida.trim().split(/\r?\n/).slice(-14).forEach(function (l) { console.log('        ' + l); });
    process.exit(1);
  }
  fotos.push(foto());
}

// 🔴 SE COMPARA LA SEGUNDA CONTRA LA TERCERA, no contra la primera. La primera corrida SÍ puede
//    cambiar cosas legítimamente (es la que aplica el corte). Lo que no puede cambiar es la
//    SEGUNDA respecto de la primera: ahí ya no queda trabajo nuevo que hacer.
var a = fotos[1], b = fotos[2];
console.log('\n══ corrida 1 vs corrida 2 — aquí ya no debe cambiar nada ══');
var crecen = [], nuevas = [], perdidas = [];
Object.keys(a).forEach(function (h) {
  if (!b[h]) { perdidas.push(h); return; }
  if (a[h].filas !== b[h].filas || a[h].cols !== b[h].cols) {
    crecen.push({ hoja: h, de: a[h].filas + '×' + a[h].cols, a: b[h].filas + '×' + b[h].cols,
      cols: b[h].enc.filter(function (c) { return a[h].enc.indexOf(c) < 0; }) });
  }
});
Object.keys(b).forEach(function (h) { if (!a[h]) nuevas.push(h); });

Object.keys(a).sort().forEach(function (h) {
  var ig = b[h] && a[h].filas === b[h].filas && a[h].cols === b[h].cols;
  console.log('   ' + (ig ? '✔' : '🔴') + ' ' + h.padEnd(24) + a[h].filas + '×' + a[h].cols +
    (ig ? '   estable' : '  →  ' + (b[h] ? b[h].filas + '×' + b[h].cols : 'DESAPARECIÓ')));
});
crecen.forEach(function (c) {
  console.log('\n   🔴 ' + c.hoja + ' cambió entre dos corridas idénticas: ' + c.de + ' → ' + c.a);
  if (c.cols.length) console.log('      columnas que aparecieron: ' + c.cols.map(function (x) { return '«' + x + '»'; }).join(' · '));
  console.log('      Hay un script que FABRICA en vez de actualizar. Se arregla ahí, no aguas abajo:');
  console.log('      retirar lo que crea es esconderlo hasta la corrida siguiente.');
});
if (nuevas.length) console.log('   🔴 hojas nuevas: ' + nuevas.join(' · '));
if (perdidas.length) console.log('   🔴 hojas perdidas: ' + perdidas.join(' · '));

var mal = crecen.length + nuevas.length + perdidas.length;
console.log('\n════════ ' + (mal ? '🔴 LA CADENA CRECE SOLA — ' + mal + ' hoja(s)' : '✅ DOS CORRIDAS IDÉNTICAS DEJAN EL LIBRO IGUAL') + ' ════════');
process.exit(mal ? 1 : 0);
