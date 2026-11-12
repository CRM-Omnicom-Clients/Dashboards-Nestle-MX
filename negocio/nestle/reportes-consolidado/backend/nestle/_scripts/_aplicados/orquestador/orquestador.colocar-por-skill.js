// FASE 3 · COLOCAR CADA SCRIPT BAJO SU SKILL — la migración, no la funcionalidad.
//
// 🔴 QUÉ SE MIGRA. Los que se quedan vivos, en tres carpetas por clase:
//
//      _skills/<skill>/          los VIVOS del corte y el escritor
//      _adversarial/<skill>/     refutadores y simuladores — no escriben, atacan
//      _herramientas/<skill>/    se invocan con propósito, fuera del ciclo
//
//    El nombre de la carpeta dice **de quién es**. Hoy `_scripts/` es una bolsa plana de 122
//    archivos con 36 prefijos: para saber de quién es uno hay que abrirlo. Después de esto, la
//    ruta lo dice.
//
// 🔴 NO SE TOCA LO QUE SE INVOCA POR RUTA. Un script que otro llama con `_scripts/<nombre>` se
//    rompería al moverlo. Antes de mover se busca cada nombre en TODO lo que se queda, y el que
//    aparezca citado **no se mueve**: se declara y se resuelve al renombrar (fase 4).
//    Mover algo que alguien llama es romper la cadena en silencio.
//
// 🔴 Y LA CADENA SE ACTUALIZA SOLA. `cadena-skills.json` guarda `script`; si un VIVO cambia de
//    carpeta, la cadena tiene que apuntar a la nueva ruta o el orquestador no lo encuentra.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
var corto = function (s) { return String(s || 'sin-skill').replace('rick-reportes-', ''); };

// qué clase va a qué carpeta. Las que NO se mueven se declaran aquí con su razón.
var DESTINO = {
  ADVERSARIAL: '_adversarial',
  HERRAMIENTA: '_herramientas'
  // VIVO, ESCRITOR, LIBRERIA, FUERA-DE-CICLO, CONGELADO, RETIRADO se quedan en la raíz de
  // `_scripts/` **por ahora**: son los que la cadena invoca por nombre, y moverlos es la fase 4,
  // junto con el renombre. Hacer las dos cosas a la vez haría imposible saber cuál rompió qué.
};

var mover = [];
Object.keys(DESTINO).forEach(function (clase) {
  (censo.clases[clase] || []).forEach(function (x) {
    mover.push({ f: x.f, clase: clase, skill: corto(x.skill), carpeta: DESTINO[clase] + '/' + corto(x.skill) });
  });
});

console.log('════════ FASE 3 · COLOCAR POR SKILL ' + (ESCRIBIR ? '🔴 MUEVE' : '(seco)') + ' ════════\n');
console.log('  candidatos: ' + mover.length + '  (' + Object.keys(DESTINO).join(' · ') + ')\n');

// ── ¿alguien los invoca por nombre?
var seQuedan = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var citado = {};
seQuedan.forEach(function (v) {
  var txt = fs.readFileSync(path.join(D, v), 'utf8');
  mover.forEach(function (m) {
    if (m.f === v) return;
    if (txt.indexOf(m.f) >= 0) (citado[m.f] = citado[m.f] || []).push(v);
  });
});
// y la cadena
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var enCadena = {};
C.etapas.forEach(function (e) { e.scripts.forEach(function (n) {
  enCadena[n.script] = 1; (n.suites || []).forEach(function (s) { enCadena[s] = 1; });
}); });

var van = mover.filter(function (m) { return !citado[m.f] && !enCadena[m.f]; });
var noVan = mover.filter(function (m) { return citado[m.f] || enCadena[m.f]; });

console.log('  ✔ se colocan: ' + van.length);
var porCarpeta = {};
van.forEach(function (m) { (porCarpeta[m.carpeta] = porCarpeta[m.carpeta] || []).push(m.f); });
Object.keys(porCarpeta).sort().forEach(function (c) { console.log('     ' + c.padEnd(40) + porCarpeta[c].length); });

console.log('\n  ⛔ NO se mueven, y por qué: ' + noVan.length);
noVan.forEach(function (m) {
  console.log('     ' + m.f.padEnd(32) + (enCadena[m.f] ? 'la CADENA lo invoca por nombre' : 'lo citan: ' + citado[m.f].slice(0, 2).join(' · ')));
});

if (!ESCRIBIR) { console.log('\n  (seco. Para colocar: --escribir)'); process.exit(0); }

var movidos = [], fallos = [];
van.forEach(function (m) {
  var carpeta = path.join(D, m.carpeta);
  fs.mkdirSync(carpeta, { recursive: true });
  try { fs.renameSync(path.join(D, m.f), path.join(carpeta, m.f)); movidos.push(m); }
  catch (e) { fallos.push({ f: m.f, error: e.code }); }
});

// índice por carpeta, para que la ruta no sea lo único que explique
Object.keys(porCarpeta).forEach(function (c) {
  var lineas = ['# ' + c, '', 'Scripts de **' + c.split('/')[1] + '** — clase `' + c.split('/')[0].replace('_', '') + '`.', ''];
  porCarpeta[c].forEach(function (f) {
    var x = mover.filter(function (m) { return m.f === f; })[0];
    lineas.push('- `' + f + '`' + (x && x.clase === 'ADVERSARIAL' ? ' — refuta o simula; **no escribe**' : ''));
  });
  fs.writeFileSync(path.join(D, c, 'INDICE.md'), lineas.join('\n'));
});

// ══ VALIDACIÓN DE LA FASE 3 — de COLOCACIÓN ══
console.log('\n  ══ VALIDACIÓN DE LA FASE 3 ══');
var enDestino = movidos.filter(function (m) { return fs.existsSync(path.join(D, m.carpeta, m.f)); }).length;
var enOrigen = movidos.filter(function (m) { return fs.existsSync(path.join(D, m.f)); }).length;
console.log('   ' + (movidos.length === van.length ? '✔' : '🔴') + ' se movieron los que tocaba: ' + movidos.length + ' de ' + van.length);
console.log('   ' + (enDestino === movidos.length ? '✔' : '🔴') + ' cada uno EXISTE en la carpeta de su skill: ' + enDestino + ' de ' + movidos.length);
console.log('   ' + (enOrigen === 0 ? '✔' : '🔴') + ' ninguno quedó también en la raíz: ' + enOrigen);
console.log('   ' + (fallos.length === 0 ? '✔' : '🔴') + ' sin fallos: ' + fallos.length);
// la que de verdad importa: la cadena intacta
var faltan = [];
Object.keys(enCadena).forEach(function (s) { if (!fs.existsSync(path.join(D, s))) faltan.push(s); });
console.log('   ' + (faltan.length === 0 ? '✔' : '🔴') + ' la cadena conserva sus ' + Object.keys(enCadena).length + ' scripts: ' + (faltan.length ? faltan.join(' · ') : 'todos'));
// y que cada carpeta tenga índice
var sinIdx = Object.keys(porCarpeta).filter(function (c) { return !fs.existsSync(path.join(D, c, 'INDICE.md')); });
console.log('   ' + (sinIdx.length === 0 ? '✔' : '🔴') + ' cada carpeta tiene su índice: ' + (sinIdx.length ? sinIdx.join(' · ') : Object.keys(porCarpeta).length + ' carpetas'));
fallos.forEach(function (f) { console.log('      🔴 ' + f.f + ': ' + f.error); });
console.log('\n  → _scripts/_adversarial/  ·  _scripts/_herramientas/');
process.exit(faltan.length || fallos.length || enOrigen ? 1 : 0);
