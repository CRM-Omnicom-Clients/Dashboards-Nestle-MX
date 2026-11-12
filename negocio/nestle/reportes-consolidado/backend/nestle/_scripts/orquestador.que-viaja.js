/*
 * orquestador.que-viaja.js — QUÉ se lleva a la carpeta nueva y qué se queda.
 *
 * 🔴 LA LISTA DECLARADA DE LA CADENA **NO** ES EL CONJUNTO QUE VIAJA. `cadena-skills.json` nombra
 *    los scripts de EJECUCIÓN (37), no las librerías que esos cargan. Al migrar «el resto» creí
 *    que no tocaba el corte y era falso: `lib-flexible.js` lo carga la cadena y no está declarado
 *    en ninguna etapa. Si la carpeta nueva se armara con la lista declarada, faltarían librerías y
 *    el corte fallaría en la máquina de otra persona con un «cannot find module» — o peor, con un
 *    `catch` que lo convierte en «no hay datos».
 *
 * 🔴 ASÍ QUE SE MIDE, NO SE DEDUCE. Dos censos, y se usa la UNIÓN:
 *      · ESTÁTICO  — los `require(...)` que aparecen en el código, siguiendo la cadena hasta el
 *                    cierre transitivo.
 *      · EN VIVO   — se corre la cadena EN SECO con un preload que registra cada archivo que Node
 *                    resuelve de verdad. Esto atrapa lo que el estático no ve: un require dentro
 *                    de una función, armado con una variable, o metido en un `spawnSync`.
 *    Ninguno de los dos basta solo. El estático no ve un require calculado; el vivo no ve una rama
 *    que esa corrida no tomó. La unión puede sobrar un archivo — sobrar es barato, faltar no.
 *
 *   node orquestador.que-viaja.js            estático + lo que haya medido antes
 *   node orquestador.que-viaja.js --medir    corre la cadena en seco y mide de verdad (tarda)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

var BACK = ENT.BACKEND;
var D = BACK + '/_scripts';
var C = BACK + '/_contratos';
var MEDIDO = BACK + '/_preescritura/que-viaja-medido.json';
var SALIDA = BACK + '/_preescritura/que-viaja.json';
var MEDIR = process.argv.indexOf('--medir') >= 0;

function t(v) { return String(v == null ? '' : v).trim(); }
var TODOS = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });

console.log('════ QUÉ VIAJA A LA CARPETA NUEVA ════\n');

// ── 1 · los scripts que la cadena declara
var CAD = JSON.parse(fs.readFileSync(C + '/cadena-skills.json', 'utf8'));
var declarados = {};
(CAD.etapas || []).forEach(function (e) {
  (e.scripts || []).forEach(function (n) {
    declarados[n.script] = 1;
    (n.suites || []).forEach(function (s) { declarados[s] = 1; });
  });
});
console.log('  la cadena DECLARA: ' + Object.keys(declarados).length + ' script(s) de ejecución y suites');

// ── 2 · censo ESTÁTICO: cierre transitivo de los require
//
// 🔴 El patrón no puede exigir que el `require(` y el nombre del archivo estén pegados: en este
//    backend casi todos son `require(os.homedir() + '/.claude/.../lib-x.js')`, con una llamada
//    en medio. Mi primer intento pedía que no hubiera un `)` entre los dos y encontró CERO
//    librerías. Se busca el nombre de archivo dentro de una comilla y se comprueba que la línea
//    —no el archivo— hable de require.
function requeridosDe(texto) {
  var out = {};
  texto.split(/\r?\n/).forEach(function (L) {
    if (!/require\s*\(/.test(L)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) return;              // una cita en un comentario no es un require
    (L.match(/['"]([^'"]*?\.js)['"]/g) || []).forEach(function (q) {
      var n = path.basename(q.replace(/['"]/g, ''));
      if (TODOS.indexOf(n) >= 0) out[n] = 1;
    });
  });
  return Object.keys(out);
}
var estatico = {}, cola = Object.keys(declarados);
while (cola.length) {
  var f = cola.shift();
  if (estatico[f]) continue;
  estatico[f] = 1;
  if (TODOS.indexOf(f) < 0) continue;
  requeridosDe(fs.readFileSync(path.join(D, f), 'utf8')).forEach(function (n) { if (!estatico[n]) cola.push(n); });
}
Object.keys(estatico).forEach(function (f) { if (TODOS.indexOf(f) < 0) delete estatico[f]; });
console.log('  censo ESTÁTICO (require, cierre transitivo): ' + Object.keys(estatico).length);

// ── 3 · censo EN VIVO: qué resuelve Node de verdad al correr la cadena en seco
if (MEDIR) {
  var LOG = path.join(os.tmpdir(), 'que-viaja-' + process.pid + '.txt');
  var PRE = path.join(os.tmpdir(), 'que-viaja-preload-' + process.pid + '.js');
  // el preload envuelve la resolución de módulos y apunta cada .js del backend que se cargue
  fs.writeFileSync(PRE, [
    "var M = require('module'), fs = require('fs'), path = require('path');",
    "var LOG = " + JSON.stringify(LOG) + ";",
    "var orig = M._load;",
    "M._load = function (req, parent, isMain) {",
    "  try { var r = M._resolveFilename(req, parent, isMain);",
    "    if (/[\\\\\\/]_scripts[\\\\\\/][^\\\\\\/]+\\.js$/.test(r)) fs.appendFileSync(LOG, path.basename(r) + '\\n');",
    "  } catch (e) {}",
    "  return orig.apply(this, arguments);",
    "};"
  ].join('\n'));
  fs.writeFileSync(LOG, '');
  console.log('\n  ── midiendo en vivo: la cadena EN SECO (no escribe el libro)');
  var r = cp.spawnSync(process.execPath, [D + '/orquestador.orquestador.js'], {
    encoding: 'utf8', env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRE })
  });
  var pasos = (r.stdout || '').match(/▸/g);
  console.log('     la cadena corrió ' + (pasos ? pasos.length : 0) + ' paso(s)' + (r.status ? '   (salió ' + r.status + ')' : ''));
  var vistos = {};
  t(fs.readFileSync(LOG, 'utf8')).split(/\r?\n/).forEach(function (l) { if (l) vistos[l] = 1; });
  // los scripts de ejecución los lanza por spawn, así que no pasan por _load: se suman aparte
  Object.keys(declarados).forEach(function (f) { vistos[f] = 1; });
  fs.writeFileSync(MEDIDO, JSON.stringify({ cuando: new Date().toISOString(), pasos: pasos ? pasos.length : 0, archivos: Object.keys(vistos).sort() }, null, 1));
  try { fs.unlinkSync(LOG); fs.unlinkSync(PRE); } catch (e) { }
  console.log('     archivos del backend que Node resolvió: ' + Object.keys(vistos).length);
}

var vivo = {};
if (fs.existsSync(MEDIDO)) {
  var MJ = JSON.parse(fs.readFileSync(MEDIDO, 'utf8'));
  (MJ.archivos || []).forEach(function (f) { if (TODOS.indexOf(f) >= 0) vivo[f] = 1; });
  console.log('  censo EN VIVO (medido ' + MJ.cuando.slice(0, 16).replace('T', ' ') + '): ' + Object.keys(vivo).length);
} else {
  console.log('  censo EN VIVO: ⊘ sin medir — córrelo con --medir. La unión queda incompleta y se dice.');
}

// ── 4 · la unión, y lo que el otro censo no vio
var viaja = {};
Object.keys(estatico).forEach(function (f) { viaja[f] = (viaja[f] || '') + 'E'; });
Object.keys(vivo).forEach(function (f) { viaja[f] = (viaja[f] || '') + 'V'; });
var lista = Object.keys(viaja).sort();

var soloVivo = lista.filter(function (f) { return viaja[f] === 'V'; });
var soloEst = lista.filter(function (f) { return viaja[f] === 'E'; });
console.log('\n  ── la UNIÓN: ' + lista.length + ' script(s) viajan');
console.log('     en los dos censos: ' + lista.filter(function (f) { return viaja[f] === 'EV'; }).length);
if (soloVivo.length) {
  console.log('     🔴 solo EN VIVO (' + soloVivo.length + ') — el estático NO los vio: ' + soloVivo.join(' · '));
  console.log('        por eso no basta leer los require: son los que se cargan de formas que el texto no delata');
}
if (soloEst.length) {
  console.log('     · solo ESTÁTICO (' + soloEst.length + ') — se cargan en ramas que esa corrida no tomó: ' +
    soloEst.slice(0, 10).join(' · ') + (soloEst.length > 10 ? ' …' : ''));
}

// las librerías que viajan sin estar declaradas en ninguna etapa — el hallazgo que motiva esto
var noDeclaradas = lista.filter(function (f) { return !declarados[f]; });
console.log('\n  🔴 viajan SIN estar declaradas en ninguna etapa: ' + noDeclaradas.length);
noDeclaradas.forEach(function (f) { console.log('        ' + f); });

// ── 5 · lo que NO viaja
var seQueda = TODOS.filter(function (f) { return !viaja[f]; });
console.log('\n  ── se QUEDAN: ' + seQueda.length + ' script(s)');
var porSkill = {};
seQueda.forEach(function (f) { var s = f.split('.')[0]; (porSkill[s] = porSkill[s] || []).push(f); });
Object.keys(porSkill).sort().forEach(function (s) {
  console.log('     ' + s.padEnd(20) + String(porSkill[s].length).padStart(3) + '   ' + porSkill[s].slice(0, 3).map(function (f) { return f.replace(s + '.', ''); }).join(' · ') + (porSkill[s].length > 3 ? ' …' : ''));
});

// ── 6 · los contratos que los que viajan leen de verdad
var contratos = {};
lista.forEach(function (f) {
  if (TODOS.indexOf(f) < 0) return;
  fs.readFileSync(path.join(D, f), 'utf8').split(/\r?\n/).forEach(function (L) {
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) return;
    (L.match(/['"]([^'"]*?\.json)['"]/g) || []).forEach(function (q) {
      var n = path.basename(q.replace(/['"]/g, ''));
      if (fs.existsSync(path.join(C, n))) contratos[n] = 1;
    });
  });
});
console.log('\n  ── contratos que leen los que viajan: ' + Object.keys(contratos).length + ' de ' +
  fs.readdirSync(C).filter(function (f) { return /\.json$/.test(f); }).length + ' que hay');
var huerfanos = fs.readdirSync(C).filter(function (f) { return /\.json$/.test(f) && !contratos[f]; });
if (huerfanos.length) console.log('     · ' + huerfanos.length + ' que NO lee ninguno de los que viajan: ' + huerfanos.slice(0, 8).join(' · ') + (huerfanos.length > 8 ? ' …' : ''));

fs.writeFileSync(SALIDA, JSON.stringify({
  cuando: new Date().toISOString(),
  como: 'unión de un censo estático (require, cierre transitivo) y uno en vivo (Node resolviendo al correr la cadena en seco)',
  medido_en_vivo: !!Object.keys(vivo).length,
  declarados_en_la_cadena: Object.keys(declarados).sort(),
  viajan: lista,
  viajan_sin_declararse: noDeclaradas,
  solo_vistos_en_vivo: soloVivo,
  se_quedan: seQueda,
  contratos_que_viajan: Object.keys(contratos).sort(),
  contratos_que_no_lee_nadie_del_corte: huerfanos
}, null, 1), 'utf8');

console.log('\n════ ' + lista.length + ' viajan · ' + seQueda.length + ' se quedan · ' +
  Object.keys(contratos).length + ' contratos ════');
console.log('   → ' + SALIDA);
if (!Object.keys(vivo).length) console.log('   ⚠ sin el censo EN VIVO esta lista puede estar incompleta: córrelo con --medir');
