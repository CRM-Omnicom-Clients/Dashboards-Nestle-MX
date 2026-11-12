// ETAPA 6 · ¿Cada regla irrenunciable tiene quien la haga cumplir?
//
// 🔴 POR QUÉ ESTA VALIDACIÓN Y NO OTRA. Rick, 26-ago: *«Lo que el sistema no puede perder son las
//    reglas de todos los skills.»* Mi lista anterior enumeraba MECANISMOS —las dos puertas, las 5
//    capas, el escritor— y estaba mal encuadrada: los mecanismos son la consecuencia, no la regla.
//    La regla es «el catálogo es la autoridad de dimensiones»; el catálogo es dónde está escrita.
//
// 🔴 Y LA PRUEBA QUE IMPORTA ES: **¿alguien la hace cumplir?** Una regla sin mecanismo no es una
//    regla — es una intención, y las intenciones se pierden. Hoy se perdieron tres decisiones en
//    una sola sesión, y las tres vivían solo como prosa. Así que cada entrada declara su mecanismo,
//    y ésta comprueba que el mecanismo EXISTA en disco: un mecanismo citado que no está es peor que
//    ninguno, porque da la sensación de estar cubierto.
//
// ⚠ Validación de SISTEMA, no de uso: no se corre el corte ni se toca el Excel.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var SKILLS = require(__dirname + '/lib-entorno.js').SKILLS;

var R = JSON.parse(fs.readFileSync(BACK + '/_contratos/reglas-irrenunciables.json', 'utf8'));
var ok = 0, mal = 0;
function chk(nom, cond, ev) { console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(56) + (ev || '')); cond ? ok++ : mal++; }

console.log('════════ ETAPA 6 · LAS REGLAS IRRENUNCIABLES ════════\n');
console.log('  reglas declaradas: ' + R.reglas.length + '\n');

// 1 · cada una declara los cuatro campos que la hacen citable
var CAMPOS = ['regla', 'skill', 'por_que', 'mecanismo', 'evidencia'];
var incompletas = [];
R.reglas.forEach(function (r) {
  var faltan = CAMPOS.filter(function (c) { return !r[c]; });
  if (faltan.length) incompletas.push(r.id + ': falta ' + faltan.join(', '));
});
chk('cada regla declara regla · skill · por qué · mecanismo · evidencia', incompletas.length === 0,
  incompletas.length ? incompletas.slice(0, 3).join(' · ') : 'las ' + R.reglas.length);

// 2 · el skill dueño existe (o es un colectivo declarado)
var COLECTIVOS = ['todos', 'todos los que escriben'];
var sinSkill = R.reglas.filter(function (r) {
  if (COLECTIVOS.indexOf(r.skill) >= 0) return false;
  return !fs.existsSync(path.join(SKILLS, r.skill, 'SKILL.md'));
});
chk('el skill dueño de cada regla existe', sinSkill.length === 0,
  sinSkill.length ? sinSkill.map(function (r) { return r.id + '→' + r.skill; }).join(' · ') : 'todos resuelven');

// 3 · 🔴 EL CHECK QUE IMPORTA: el mecanismo citado EXISTE en disco
var vivos = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var fantasma = [];
R.reglas.forEach(function (r) {
  // los mecanismos se citan por nombre de script o de librería; se comprueba cada uno
  var citados = (r.mecanismo.match(/[a-z][a-z0-9-]*\.[a-z0-9-]+(?:\.js)?/gi) || [])
    .filter(function (x) { return /^(lib-|orquestador\.|escritor\.|resumen\.|motor\.|catalogo\.|fuentes-|insights\.)/.test(x); })
    .map(function (x) { return /\.js$/.test(x) ? x : x + '.js'; });
  citados.forEach(function (c) {
    if (vivos.indexOf(c) < 0) fantasma.push(r.id + ' cita `' + c + '` y no está en _scripts/');
  });
});
chk('🔴 cada mecanismo citado EXISTE en disco', fantasma.length === 0,
  fantasma.length ? fantasma.slice(0, 4).join(' · ') : 'ningún mecanismo fantasma');

// 4 · las que dicen BLOQUEA tienen una guarda de verdad
var guardas = '';
try { guardas = fs.readFileSync(D + '/orquestador.guardas.js', 'utf8'); } catch (e) { }
var bloqueadoras = R.reglas.filter(function (r) { return /BLOQUEA/.test(r.mecanismo); });
var sinGuarda = bloqueadoras.filter(function (r) {
  var m = /Guarda (\d+)/.exec(r.mecanismo);
  return !m || guardas.indexOf('GUARDA ' + m[1]) < 0;
});
chk('cada regla que dice BLOQUEA nombra una guarda que existe', sinGuarda.length === 0,
  sinGuarda.length ? sinGuarda.map(function (r) { return r.id; }).join(' · ') : bloqueadoras.length + ' reglas con guarda real');

// 5 · 🔴 LAS QUE NO TIENEN MECANISMO SE DECLARAN COMO TALES, no se disimulan
var sinMec = R.reglas.filter(function (r) { return /sin mecanismo autom/i.test(r.mecanismo); });
console.log('\n   ⚠ reglas SIN mecanismo automático: ' + sinMec.length + '   (declaradas, no disimuladas)');
sinMec.forEach(function (r) { console.log('      ' + r.id + ' · ' + r.regla.slice(0, 78)); });
console.log('      Una regla que el sistema no puede hacer cumplir se dice. Fingir que está cubierta');
console.log('      es peor que no tenerla: nadie la vigila y todos creen que sí.');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ LAS ' + R.reglas.length + ' REGLAS TIENEN DUEÑO Y MECANISMO') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
