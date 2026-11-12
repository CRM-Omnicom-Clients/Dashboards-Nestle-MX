// FASE 7 · PROBAR LAS GUARDAS — plantarles el defecto y exigir que BLOQUEEN.
//
// 🔴 POR QUÉ NO BASTA CON QUE SALGAN VERDES. Las dos guardas dieron verde en su segunda corrida,
//    después de que yo les arreglara dos errores. Verde después de arreglarlas no prueba nada:
//    «pasa siempre» y «no mira nada» se ven idénticos desde fuera. Lo mismo que pasó con
//    `Data_WhatsApp`, que pasó 19 checks en verde con 14 de 26 envíos mal — la auditoría comparaba
//    el bloque contra sí mismo.
//
// 🔴 LA PRUEBA QUE NO ES CIRCULAR: se le PLANTA a la guarda cada uno de los defectos que dice
//    atrapar, sobre una COPIA de los contratos, y se exige que bloquee. Si no bloquea con el
//    defecto puesto delante, la guarda es decorativa. Y al revés: se corre también sobre la copia
//    SANA y se exige verde — una guarda que bloquea siempre atora el corte y acaba desactivada.
//
// 🔴 EL SISTEMA REAL NO SE TOCA. Todo ocurre en una carpeta temporal fuera de OneDrive.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var NODE = process.execPath;
var GUARDA = BACK + '/_scripts/orquestador.guardas.js';
var TMP = path.join(os.tmpdir(), 'probar-guardas');

var ok = 0, mal = 0;
function chk(nom, cond, ev) {
  console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(56) + (ev || ''));
  cond ? ok++ : mal++;
}

// prepara una copia limpia de los contratos y le aplica una mutación
function conDefecto(nombre, mutar) {
  var dir = path.join(TMP, nombre);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(BACK + '/_contratos').forEach(function (f) {
    if (!/\.json$/.test(f)) return;
    var src = path.join(BACK + '/_contratos', f);
    if (fs.statSync(src).size > 3e6) return;             // el enorme no hace falta para probar
    fs.copyFileSync(src, path.join(dir, f));
  });
  if (mutar) mutar(dir);
  return dir;
}
function corre(dir) {
  try { return { code: 0, out: cp.execFileSync(NODE, [GUARDA, '--contratos', dir], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}
function J(dir, f) { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
function W(dir, f, o) { fs.writeFileSync(path.join(dir, f), JSON.stringify(o, null, 1)); }

console.log('════════ FASE 7 · ¿LAS GUARDAS ATRAPAN DE VERDAD? ════════\n');

// ── 0 · CONTROL: sobre la copia sana tiene que pasar
console.log('══ 0 · control — la copia sana pasa ══');
var r0 = corre(conDefecto('sana', null));
chk('sin defecto plantado, NO bloquea', r0.code === 0, r0.code === 0 ? 'verde' : '🔴 bloquea sin motivo: atoraría el corte');

// ── 1 · destructivo sin skill
console.log('\n══ 1 · guarda 1 — destructivo sin skill ══');
var d1 = conDefecto('sin-skill', function (dir) {
  // se le quita el dueño a un destructivo que SÍ existe en disco
  var C = J(dir, 'orquestador.censo-scripts.json');
  var victima = null;
  Object.keys(C.clases).forEach(function (cl) {
    C.clases[cl].forEach(function (x) {
      if (!victima && (C.propiedades[x.f] || {}).escribe_excel && fs.existsSync(BACK + '/_scripts/' + x.f)) { victima = x; }
    });
  });
  if (victima) victima.skill = '';
  W(dir, 'orquestador.censo-scripts.json', C);
  // y a la cadena se le quita su turno, para que no tenga por dónde salvarse
  var K = J(dir, 'cadena-skills.json');
  K.etapas.forEach(function (e) { e.scripts = e.scripts.filter(function (n) { return !victima || n.script !== victima.f; }); });
  K.fuera_de_ciclo = (K.fuera_de_ciclo || []).filter(function (x) { return !victima || x.script !== victima.f; });
  W(dir, 'cadena-skills.json', K);
});
var r1 = corre(d1);
chk('BLOQUEA un destructivo sin skill dueño', r1.code === 1 && /sin skill|SUELTOS/.test(r1.out),
  (r1.out.match(/🔴 (hay destructivos[^\n]*|destructivos sin skill[^\n]*)/) || ['(no lo dijo)'])[0].slice(0, 78));

// ── 2 · alguien invoca al congelado
console.log('\n══ 2 · guarda 1 — se invoca a un CONGELADO ══');
// 🔴 este se prueba distinto: el defecto no vive en un contrato sino en un .js. Se crea un script
//    señuelo que SÍ lo invoca de verdad (execFileSync), se corre la guarda, y se borra.
var senuelo = BACK + '/_scripts/orquestador.zz-senuelo-prueba.js';
var congelado = (J(BACK + '/_contratos', 'orquestador.censo-scripts.json').clases.CONGELADO || [])[0];
if (!congelado) {
  console.log('   ⊘ NO PUDE EVALUAR — no hay ningún script congelado ahora mismo');
} else {
  fs.writeFileSync(senuelo, "// señuelo de prueba — se borra solo\nrequire('child_process').execFileSync('node', ['" + congelado.f + "']);\n");
  var r2 = corre(conDefecto('congelado', null));
  fs.unlinkSync(senuelo);
  chk('BLOQUEA cuando alguien invoca al congelado', r2.code === 1 && /CONGELADO/.test(r2.out),
    (r2.out.match(/🔴 alguien invoca[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 78));
  chk('y el señuelo quedó borrado', !fs.existsSync(senuelo), 'el disco queda como estaba');
}

// ── 3 · dos scripts distintos con el mismo id de paso
console.log('\n══ 3 · guarda 2 — id de paso duplicado ══');
var r3 = corre(conDefecto('id-dup', function (dir) {
  var K = J(dir, 'cadena-skills.json');
  var todos = [];
  K.etapas.forEach(function (e) { e.scripts.forEach(function (n) { todos.push(n); }); });
  if (todos.length > 1) todos[1].id = todos[0].id;      // dos scripts distintos, mismo id
  W(dir, 'cadena-skills.json', K);
}));
chk('BLOQUEA dos scripts con el mismo id de paso', r3.code === 1 && /mismo id de paso/.test(r3.out),
  (r3.out.match(/🔴 dos scripts distintos[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 78));

// ── 4 · contrato gemelo — el defecto real de hoy
console.log('\n══ 4 · guarda 2 — contrato gemelo (el caso real de la fase 6) ══');
var r4 = corre(conDefecto('gemelo', function (dir) {
  fs.copyFileSync(path.join(dir, 'orquestador.censo-scripts.json'), path.join(dir, 'censo-scripts.json'));
}));
chk('BLOQUEA dos contratos con la misma forma', r4.code === 1 && /gemelo|misma forma/.test(r4.out),
  (r4.out.match(/🔴 dos contratos[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 78));

// ── 5 · dos etapas en el mismo paso
console.log('\n══ 5 · guarda 2 — dos etapas comparten paso ══');
var r5 = corre(conDefecto('paso-dup', function (dir) {
  var K = J(dir, 'cadena-skills.json');
  if (K.etapas.length > 1) K.etapas[1].orden = K.etapas[0].orden;
  W(dir, 'cadena-skills.json', K);
}));
chk('BLOQUEA dos etapas con el mismo número de paso', r5.code === 1 && /número de paso/.test(r5.out),
  (r5.out.match(/🔴 dos etapas[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 78));

// ── 6 · el tercer veredicto: sin insumo NO dice verde
console.log('\n══ 6 · el tercer veredicto — sin insumo no finge que pasó ══');
var r6 = corre(conDefecto('sin-censo', function (dir) { fs.unlinkSync(path.join(dir, 'orquestador.censo-scripts.json')); }));
chk('sin el censo dice NO PUDE EVALUAR, no verde', /NO PUDE EVALUAR/.test(r6.out) && !/LAS DOS GUARDAS EN VERDE/.test(r6.out),
  /NO PUDE EVALUAR/.test(r6.out) ? 'lo declara ruidosamente' : '🔴 se quedó callado');

// ── 7 · preflight sobre el congelado
console.log('\n══ 7 · preflight — el congelado no puede correr ══');
if (congelado) {
  var r7 = corre(conDefecto('sana', null));   // dir sano; el preflight se pide aparte
  var out7 = '';
  try { out7 = cp.execFileSync(NODE, [GUARDA, '--antes', congelado.f], { encoding: 'utf8' }); }
  catch (e) { out7 = (e.stdout || '') + (e.stderr || ''); }
  chk('el preflight BLOQUEA al congelado', /BLOQUEA — está CONGELADO/.test(out7),
    (out7.match(/🔴 BLOQUEA[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 78));
  var out8 = cp.execFileSync(NODE, [GUARDA, '--antes', 'lib-esquema.js'], { encoding: 'utf8' });
  chk('y deja correr lo que no es destructivo', /no es destructivo|con dueño/.test(out8), 'no atora lo sano');
}

// ── 8 · GUARDA 7 · la ruta escrita ───────────────────────────────────────────────────────────
//
// 🔴 LOS SEÑUELOS SON LAS DOS FORMAS QUE ENGAÑARON A MI PROPIO MIGRADOR, no las que se me ocurren
//    ahora. El migrador buscaba `os.homedir() + '<ruta>'` literal, así que fue CIEGO a dos cosas:
//    el home aliasado (`var H = os.homedir()` y luego `H + '…'`) y el literal que SIGUE más allá
//    de la ruta declarada (`PROY + '/(Interno)-…-v8.xlsx'`). Las dos pasaron inadvertidas y el
//    migrador se declaró completo con 7 rutas en pie. Si la guarda nace solo con el caso obvio,
//    hereda el mismo punto ciego — y eso ya pasó: el señuelo VIEJO fue el que atrapó mi punto
//    ciego NUEVO la vez anterior.
//
// 🔴 Y SE PRUEBAN LAS DOS DIRECCIONES. Una guarda que bloquea siempre atora el corte y acaba
//    desactivada, así que también se le pone delante lo LEGÍTIMO —un literal en un comentario, y
//    un intocable— y se exige que NO lo señale.
console.log('\n══ 8 · guarda 7 — una ruta escrita no pasa, y lo legítimo no se bloquea ══');

var RAIZ_SENUELO = "/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé";
var LIBRO_SENUELO = JSON.parse(fs.readFileSync(BACK + '/_contratos/entorno.json', 'utf8')).libro_vivo;

// un script que la CADENA invoca de verdad, para poder probar que BLOQUEA (y no solo avisa)
var DEL_CORTE = (function () {
  var K = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
  var n = null;
  (K.etapas || []).forEach(function (e) { (e.scripts || []).forEach(function (s) { if (!n) n = s.script; }); });
  return n;
})();

function conScripts(nombre, archivos) {
  var dir = path.join(TMP, 'scripts-' + nombre);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  Object.keys(archivos).forEach(function (f) { fs.writeFileSync(path.join(dir, f), archivos[f]); });
  return dir;
}
function correG7(dirScripts) {
  var args = [GUARDA, '--contratos', BACK + '/_contratos', '--scripts', dirScripts];
  try { return { code: 0, out: cp.execFileSync(NODE, args, { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}
function g7(out) { return (out.split('══ GUARDA 7')[1] || '').split('════════════')[0]; }

// S1 · la forma obvia, en un script DEL CORTE → tiene que BLOQUEAR
var s1 = {}; s1[DEL_CORTE] = "var P = require('os').homedir() + '" + RAIZ_SENUELO + "';\n";
var g1 = correG7(conScripts('s1', s1));
chk('S1 · BLOQUEA la ruta escrita en un script del corte',
  g1.code === 1 && /BLOQUEA/.test(g7(g1.out)), (g7(g1.out).match(/🔴 BLOQUEA[^\n]*/) || ['(no lo dijo)'])[0].slice(0, 70));

// S2 · el HOME ALIASADO — la forma que el migrador no vio
var s2 = {}; s2[DEL_CORTE] = "var os = require('os');\nvar H = os.homedir();\nvar P = H + '" + RAIZ_SENUELO + "';\n";
var g2 = correG7(conScripts('s2', s2));
chk('S2 · atrapa el home ALIASADO (H + ...) — el punto ciego del migrador',
  g2.code === 1 && /BLOQUEA/.test(g7(g2.out)), g2.code === 1 ? 'bloqueó' : '🔴 pasó de largo, como el migrador');

// S3 · el NOMBRE DEL LIBRO armado en dos expresiones — el otro punto ciego
var s3 = {}; s3[DEL_CORTE] = "var ENT = {};\nvar PROY = ENT.PROYECTO;\nvar V = PROY + '/" + LIBRO_SENUELO + "';\n";
var g3 = correG7(conScripts('s3', s3));
chk('S3 · atrapa el nombre del libro escrito tras una raíz ya pedida',
  g3.code === 1 && /BLOQUEA/.test(g7(g3.out)), g3.code === 1 ? 'bloqueó' : '🔴 el nombre se escaparía otra vez');

// S4 · fuera del corte → AVISA, no bloquea (si no, un explorador de un rato atora el corte)
var g4 = correG7(conScripts('s4', {
  'herramienta.de-un-rato.js': "var P = require('os').homedir() + '" + RAIZ_SENUELO + "';\n"
}));
chk('S4 · fuera del corte AVISA y no detiene',
  g4.code === 0 && /⚠/.test(g7(g4.out)) && !/BLOQUEA/.test(g7(g4.out)),
  g4.code === 0 ? 'avisa sin atorar' : '🔴 bloqueó algo que no corre en el corte');

// S5 · LO LEGÍTIMO · el literal dentro de un comentario NO se señala
var s5 = {}; s5[DEL_CORTE] = "// antes decía os.homedir() + '" + RAIZ_SENUELO + "' y por eso no era portable\n" +
  " *    el libro " + LIBRO_SENUELO + " se pide con ENT.LIBRO\nvar P = 1;\n";
var g5 = correG7(conScripts('s5', s5));
chk('S5 · NO señala un literal que está en un comentario',
  g5.code === 0 && !/escribe «/.test(g7(g5.out)),
  g5.code === 0 ? 'la documentación no es una infracción' : '🔴 señalaría su propia explicación');

// S6 · LO LEGÍTIMO · los intocables llevan la ruta a propósito
var g6 = correG7(conScripts('s6', {
  'lib-entorno.js': "var RAIZ = '" + RAIZ_SENUELO + "';\n",
  'orquestador.probar-entorno.js': "var r = /'[^']*OneDrive - OneWorkplace[^']*'/g;\n"
}));
chk('S6 · NO señala a los 3 intocables (lib-entorno define las rutas)',
  g6.code === 0 && !/escribe «/.test(g7(g6.out)),
  g6.code === 0 ? 'no se muerde la cola' : '🔴 se acusa a sí misma, como ya pasó con el probador');

// S8 · LO LEGÍTIMO · NOMBRAR la carpeta en un mensaje para la persona no es escribir una ruta.
//    Este señuelo nace del caso real: la primera versión de la guarda señaló a
//    `orquestador.instalar.js`, cuyo texto de ayuda dice «pide que te compartan «Marketing
//    Automation Kinesso - …»» — y ese nombre es justo lo que hace útil el mensaje. Señalar la
//    ayuda es como se consigue que alguien apague el guardián.
var s8 = {}; s8[DEL_CORTE] = "var msg = 'Pide que te compartan la carpeta «Marketing Automation Kinesso - Librería-Sharepoint-MAK» y que sincronice';\n" +
  "var m2 = 'la comparte el equipo: «Archivos de Leslie Monserrat Monterrosas (Omnicom)»';\n";
var g8 = correG7(conScripts('s8', s8));
chk('S8 · NO señala el nombre de la carpeta dentro de una frase',
  g8.code === 0 && !/escribe «/.test(g7(g8.out)),
  g8.code === 0 ? 'nombrar no es armar una ruta' : '🔴 señalaría el mensaje que ayuda a la persona nueva');

// S9 · pero la MISMA carpeta con una barra delante SÍ es una ruta — la otra mitad de S8
var s9 = {}; s9[DEL_CORTE] = "var P = H + '/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé';\n";
var g9 = correG7(conScripts('s9', s9));
chk('S9 · y SÍ la señala cuando lleva barra (se está armando una ruta)',
  g9.code === 1 && /BLOQUEA/.test(g7(g9.out)),
  g9.code === 1 ? 'la barra es la diferencia' : '🔴 la regla nueva la dejó ciega');

// S10 · el BACKEND anclado al home — el patrón más grave: produce una FACHADA
var s10 = {}; s10[DEL_CORTE] = "var B = require('os').homedir() + '/.claude/reportes-backend/nestle';\n";
var g10 = correG7(conScripts('s10', s10));
chk('S10 · atrapa el backend anclado al home', g10.code === 1 && /BLOQUEA/.test(g7(g10.out)),
  g10.code === 1 ? 'bloqueó' : '🔴 una copia en SharePoint obedecería a ~/.claude sin fallar');

// S11 · 🔴 LA MISMA RUTA REPARTIDA EN ARGUMENTOS — el defecto que se me escapó DOS VECES hoy.
//    Mi barrido buscaba el literal con barras y salió verde dejando anclados `lib-entorno.js` y
//    `lib-registro.js`. El segundo no lo encontré yo: lo encontró la guarda al aprender esta forma.
var s11 = {}; s11[DEL_CORTE] = "var path = require('path'), os = require('os');\n" +
  "var B = path.join(os.homedir(), '.claude', 'reportes-backend', 'nestle');\n";
var g11 = correG7(conScripts('s11', s11));
chk('S11 · atrapa la MISMA ruta repartida en path.join(...)', g11.code === 1 && /BLOQUEA/.test(g7(g11.out)),
  g11.code === 1 ? 'la forma por argumentos ya no la esconde' : '🔴 sigue ciega a lo que hoy dejó anclado lib-entorno');

// S12 · el intérprete CON LA VERSIÓN escrita
var s12 = {}; s12[DEL_CORTE] = "var PY = require('os').homedir() + '/AppData/Local/Programs/Python/Python313/python.exe';\n";
var g12 = correG7(conScripts('s12', s12));
chk('S12 · atrapa el python con la versión escrita', g12.code === 1 && /BLOQUEA/.test(g7(g12.out)),
  g12.code === 1 ? 'bloqueó' : '🔴 un 3.14 dejaría muda la 4ª capa de validación');

// S13 · las herramientas
var s13 = {}; s13[DEL_CORTE] = "var T = require('os').homedir() + '/.claude/tools/xlsx-safe-save.js';\n";
var g13 = correG7(conScripts('s13', s13));
chk('S13 · atrapa las herramientas ancladas al home', g13.code === 1 && /BLOQUEA/.test(g7(g13.out)),
  g13.code === 1 ? 'bloqueó' : '🔴 las 5 capas de validación no se encontrarían');

// S7 · y en limpio dice verde — una guarda que nunca pasa se desactiva
var s7 = {}; s7[DEL_CORTE] = "var ENT = require('./lib-entorno.js');\nvar P = ENT.PROYECTO, V = ENT.LIBRO;\n";
var g7r = correG7(conScripts('s7', s7));
chk('S7 · en limpio dice verde', g7r.code === 0 && /ningún script escribe una ruta/.test(g7(g7r.out)),
  /ningún script escribe/.test(g7(g7r.out)) ? 'verde cuando toca' : '🔴 bloquea siempre');

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' GUARDA(S) DECORATIVA(S)' : '✅ LAS GUARDAS ATRAPAN LO QUE DICEN ATRAPAR') + ' — ' + ok + ' pruebas ════════');
process.exit(mal ? 1 : 0);
