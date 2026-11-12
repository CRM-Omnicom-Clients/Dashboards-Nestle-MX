// VOCABULARIO · «paso» deja de existir. Se llama SCRIPT DE EJECUCIÓN.
//
// 🔴 POR QUÉ, y no es cosmético. Rick (26-ago): «"pasos" es muy ambiguo, tiene que llamarse
//    scripts de ejecución». Tenía razón en algo que yo no había visto: `paso` fue el sustituto que
//    elegí para el nombre del sistema anterior, y **arrastró su misma ambigüedad**. No dice si se
//    habla de una decisión, de un turno o de un archivo.
//    `script de ejecución` es literal: ES un archivo .js que se ejecuta. Nadie lo confunde con una
//    etapa, y —lo que importa— nadie puede «seguir la cadena de scripts» creyendo que sigue el
//    razonamiento. El nombre nuevo recuerda todo el tiempo que un script solo SIRVE a una decisión.
//
// 🔴 Y NO SE REEMPLAZA A CIEGAS. Hace dos horas un reemplazo ciego rompió tres archivos, se comió
//    una función y borró 13 suites en silencio. Aquí se separa:
//      · ESTRUCTURA (campo `pasos`, array `PASOS`) → se renombra: es un identificador
//      · PROSA (comentarios, mensajes)             → se reescribe con criterio, frase por frase
//      · ESPAÑOL NORMAL («el paso siguiente»)      → NO SE TOCA
//    Las 658 apariciones en prosa NO se tocan en bloque: solo las que nombran al concepto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var BACK = H + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';
var SKILLS = H + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// ── 1 · ESTRUCTURA: identificadores. Aquí sí es un renombre mecánico y seguro.
var ESTRUCTURA = [
  // el campo del contrato de la cadena
  [/\.pasos\b/g, '.scripts'],
  [/"pasos"\s*:/g, '"scripts":'],
  [/\bpasos:\s*\[/g, 'scripts: ['],
  [/\bpasos:\s*pasos\b/g, 'scripts: scripts'],
  // el array del orquestador y sus derivados
  [/\bPASOS\b/g, 'SCRIPTS'],
  // variables locales que se llaman pasos y guardan scripts
  [/\bvar pasos =/g, 'var scripts ='],
  [/\bpasos\.push\(/g, 'scripts.push('],
  [/\bpasos\.forEach\(/g, 'scripts.forEach('],
  [/\bpasos\.map\(/g, 'scripts.map('],
  [/\bpasos\.filter\(/g, 'scripts.filter('],
  [/\bpasos\.length\b/g, 'scripts.length'],
  [/\bpasos\.some\(/g, 'scripts.some(']
];

// ── 2 · PROSA: solo las frases que nombran al CONCEPTO. Cada una, decidida.
var PROSA = [
  [/pasos corridos/g, 'scripts corridos'],
  [/PASOS SIN SKILL/g, 'SCRIPTS SIN SKILL'],
  [/\bpasos? del corte\b/g, 'scripts de ejecución del corte'],
  [/\bpasos? del backend\b/g, 'scripts del backend'],
  [/\bcadena de pasos\b/gi, 'cadena de skills'],
  [/\bun paso huérfano\b/g, 'un script huérfano'],
  [/\bpaso huérfano\b/g, 'script huérfano'],
  [/\blos \d+ pasos\b/g, function (m) { return m.replace('pasos', 'scripts de ejecución'); }],
  [/\bpasos documentados\b/g, 'scripts documentados'],
  [/\b(\d+) pasos\b/g, '$1 scripts de ejecución'],
  [/\bel paso\b(?! siguiente| a paso)/g, 'el script'],
  [/\bcada paso\b/g, 'cada script'],
  [/\bese paso\b/g, 'ese script'],
  [/\bun paso\b(?! atrás| adelante)/g, 'un script'],
  [/\bsu paso\b/g, 'su script'],
  [/\bPASO\b/g, 'SCRIPT']
];

function archivos() {
  var out = [];
  fs.readdirSync(D).forEach(function (f) {
    if (!/\.js$/.test(f)) return;
    if (/vocabulario-scripts|desanclar-|barrido-final/.test(f)) return;   // los migradores definen los patrones
    out.push(path.join(D, f));
  });
  fs.readdirSync(BACK + '/_contratos').forEach(function (f) {
    if (/\.json$/.test(f)) out.push(path.join(BACK + '/_contratos', f));
  });
  fs.readdirSync(SKILLS).forEach(function (d) {
    var p = path.join(SKILLS, d, 'SKILL.md');
    if (/^rick-reportes-/.test(d) && fs.existsSync(p)) out.push(p);
  });
  return out;
}

console.log('════════ VOCABULARIO · «paso» → «script de ejecución» ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var nEst = 0, nPro = 0, tocados = 0;
archivos().forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8'), orig = txt;
  ESTRUCTURA.forEach(function (r) { var c = (txt.match(r[0]) || []).length; if (c) { nEst += c; txt = txt.replace(r[0], r[1]); } });
  PROSA.forEach(function (r) { var c = (txt.match(r[0]) || []).length; if (c) { nPro += c; txt = txt.replace(r[0], r[1]); } });
  if (txt !== orig) { tocados++; if (ESCRIBIR) fs.writeFileSync(p, txt); }
});

console.log('  estructura (campos, arrays, variables): ' + nEst);
console.log('  prosa (solo las que nombran el concepto): ' + nPro);
console.log('  archivos tocados: ' + tocados);
console.log('\n  ⚠ el español normal («el paso siguiente», «paso a paso») NO se toca.');

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ── VERIFICACIÓN ESTRUCTURAL — de sistema, no de uso: nada de correr el corte ni tocar el Excel
console.log('\n  ══ VERIFICACIÓN DE SISTEMA ══');
var cp = require('child_process');
var malos = [];
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  var r = cp.spawnSync(process.execPath, ['-c', path.join(D, f)], { encoding: 'utf8' });
  if (r.status !== 0) malos.push(f);
});
console.log('   ' + (malos.length ? '🔴' : '✔') + ' los ' + fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).length +
  ' scripts parsean' + (malos.length ? ': 🔴 ' + malos.join(' · ') : ''));

var malJson = [];
fs.readdirSync(BACK + '/_contratos').forEach(function (f) {
  if (!/\.json$/.test(f)) return;
  try { JSON.parse(fs.readFileSync(BACK + '/_contratos/' + f, 'utf8')); } catch (e) { malJson.push(f); }
});
console.log('   ' + (malJson.length ? '🔴' : '✔') + ' los contratos JSON son válidos' + (malJson.length ? ': ' + malJson.join(' · ') : ''));

// que el contrato de la cadena use ya el campo nuevo
try {
  var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
  var conScripts = C.etapas.filter(function (e) { return Array.isArray(e.scripts); }).length;
  var conPasos = C.etapas.filter(function (e) { return Array.isArray(e.pasos); }).length;
  console.log('   ' + (conPasos === 0 ? '✔' : '⚠') + ' la cadena usa el campo `scripts`: ' + conScripts + ' etapas' +
    (conPasos ? '   ⚠ quedan ' + conPasos + ' con `pasos` — se regenera con orquestador.cadena-skills.js' : ''));
} catch (e) { console.log('   ⊘ no pude leer la cadena'); }
process.exit(malos.length || malJson.length ? 1 : 0);
