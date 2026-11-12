// FASE 4 (paso 1) · QUÉ ESTÁ REPETIDO EN LOS VIVOS.
//
// 🔴 LA LISTA DE CAPACIDADES SALE DE LA MEDICIÓN, NO DE MI INTUICIÓN. Si la invento, colapso lo
//    que a mí me parece parecido — y lo que de verdad se desincroniza es otra cosa. Aquí se cuenta
//    cuántos scripts vivos repiten cada IDIOMA: el mismo gesto escrito una y otra vez.
//
// 🔴 UN IDIOMA REPETIDO EN N SCRIPTS ES UNA CAPACIDAD QUE FALTA. Y cada copia es un sitio donde
//    arreglar el bug en una no lo arregla en las otras — que es literalmente lo que pasó hoy con
//    la llave del reporte (4 copias), el separador del subsegmento (2) y el nombre de la quincena.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';
var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));

var vivos = ['VIVO', 'ESCRITOR', 'ADVERSARIAL', 'HERRAMIENTA'].reduce(function (a, k) {
  return a.concat((censo.clases[k] || []).map(function (x) { return { f: x.f, skill: String(x.skill || '').replace('rick-reportes-', ''), clase: k }; }));
}, []);

// los IDIOMAS: cada uno es «un gesto que se repite». El nombre dice qué capacidad sería.
var IDIOMAS = [
  { id: 'abrir-libro',        re: /archivoVivo\s*\(/,                          cap: 'abrir el libro vivo (copia ASCII incluida)' },
  { id: 'leer-encabezados',   re: /sheet_to_json\([^)]*header:\s*1/,           cap: 'leer los encabezados de una hoja' },
  { id: 'leer-filas',         re: /sheet_to_json\([^)]*defval/,                cap: 'leer las filas de una hoja' },
  { id: 'copiar-a-temp',      re: /copyFileSync\([^)]*homedir\(\)\s*\+\s*'\/_/,cap: 'copiar a una ruta ASCII antes de leer' },
  { id: 'trim-propio',        re: /function\s*t\s*\(|var t = function/,        cap: 'normalizar un valor (cada script tiene su `t`)' },
  { id: 'normalizador-propio',re: /function nmz|nmz\s*=\s*function/,           cap: 'normalizar un NOMBRE (cada script tiene el suyo)' },
  { id: 'numero-propio',      re: /function num|num = function/,               cap: 'leer un número con comas' },
  { id: 'letra-columna',      re: /function col\s*\(n\)|function letra/,       cap: 'convertir índice ↔ letra de columna' },
  { id: 'las-5-capas',        re: /xlsx-safe-save|safeSave/,                   cap: 'publicar con las 5 capas de validación' },
  { id: 'llave-compuesta',    re: /\.join\('¦'\)/,                             cap: 'construir la llave de una entidad' },
  { id: 'chequeo-propio',     re: /function chk\s*\(|function check/,          cap: 'registrar un check y su veredicto' },
  { id: 'leer-bloque',        re: /_fuentes\/[a-z]+\.json/,                    cap: 'leer un bloque de fuente' },
  { id: 'escribir-celda-xml', re: /lib-celda-xml|CX\.celda/,                   cap: 'escribir una celda en el XML' },
  { id: 'apuntar-cambio',     re: /CB\.apuntar/,                               cap: 'apuntar un cambio al acumulador' },
  { id: 'releer-para-verificar', re: /reléid|releído|releer|XLSX\.readFile\(vivo/, cap: 'verificar releyendo el archivo escrito' },
  { id: 'mil-propio',         re: /function mil\s*\(/,                         cap: 'formatear un número para leerlo' }
];

var cuenta = {}, quien = {};
IDIOMAS.forEach(function (i) { cuenta[i.id] = 0; quien[i.id] = []; });
var porScript = {};
vivos.forEach(function (v) {
  var p = path.join(D, v.f);
  if (!fs.existsSync(p)) return;
  var txt = fs.readFileSync(p, 'utf8');
  porScript[v.f] = { skill: v.skill, clase: v.clase, idiomas: [], lineas: txt.split('\n').length };
  IDIOMAS.forEach(function (i) {
    if (!i.re.test(txt)) return;
    cuenta[i.id]++; quien[i.id].push(v.f); porScript[v.f].idiomas.push(i.id);
  });
});

console.log('════════ FASE 4 · QUÉ ESTÁ REPETIDO ════════\n');
console.log('  scripts vivos analizados: ' + Object.keys(porScript).length + '\n');
console.log('  ── IDIOMAS, de más repetido a menos ──');
IDIOMAS.slice().sort(function (a, b) { return cuenta[b.id] - cuenta[a.id]; }).forEach(function (i) {
  if (!cuenta[i.id]) return;
  var marca = cuenta[i.id] >= 10 ? '🔴' : cuenta[i.id] >= 5 ? '⚠ ' : '  ';
  console.log('   ' + marca + ' ' + String(cuenta[i.id]).padStart(3) + ' scripts  ' + i.id.padEnd(24) + i.cap);
});

// los que más idiomas repiten son los que más ganarían al colapsar
var ranking = Object.keys(porScript).map(function (f) { return { f: f, n: porScript[f].idiomas.length, s: porScript[f].skill, l: porScript[f].lineas }; })
  .sort(function (a, b) { return b.n - a.n; });
console.log('\n  ── LOS QUE MÁS REPITEN (candidatos a colapsar primero) ──');
ranking.slice(0, 12).forEach(function (x) {
  console.log('   ' + String(x.n).padStart(2) + ' idiomas · ' + String(x.l).padStart(4) + ' líneas · ' + x.f.padEnd(30) + x.s);
});

var totalIdiomas = Object.keys(cuenta).reduce(function (a, k) { return a + cuenta[k]; }, 0);
var conMas10 = IDIOMAS.filter(function (i) { return cuenta[i.id] >= 10; });
fs.writeFileSync(BACK + '/_contratos/duplicacion.json', JSON.stringify({
  paso: 'medir-duplicacion', fase: 4,
  scripts: porScript, cuenta: cuenta, quien: quien,
  capacidades_que_faltan: conMas10.map(function (i) { return { id: i.id, capacidad: i.cap, scripts: cuenta[i.id] }; })
}, null, 1));

console.log('\n  ══ VALIDACIÓN DE LA FASE 4 · paso 1 ══');
console.log('   ✔ se analizaron los ' + Object.keys(porScript).length + ' vivos que existen en disco');
console.log('   ✔ copias de idiomas contadas: ' + totalIdiomas);
console.log('   🔴 idiomas repetidos en 10+ scripts: ' + conMas10.length + '  ← cada uno es una capacidad que falta');
conMas10.forEach(function (i) { console.log('      ' + String(cuenta[i.id]).padStart(3) + '×  ' + i.cap); });
console.log('\n  → _contratos/duplicacion.json');
