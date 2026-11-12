/*
 * orquestador.migrar-herramientas.js — las HERRAMIENTAS y el INTÉRPRETE también se piden.
 *
 * Son las dos anclas que quedaban después de las rutas del cliente y del backend:
 *
 *   · `~/.claude/tools` en 51 scripts — de ahí salen `node_modules` y las 5 capas de validación
 *     del Excel (`xlsx-safe-save`, `xlsx-label`, `xlsx-check`, `xlsx-validar-fondo`,
 *     `xlsx-orden-celdas`). Sin ellas no se publica nada, así que una ruta mala no es un detalle.
 *
 *   · `AppData/Local/Programs/Python/Python313/python.exe` en 36 scripts — 🔴 **con la VERSIÓN
 *     escrita**. El día que se instale un 3.14 esos 36 apuntan a una carpeta que ya no existe, y
 *     entre ellos está la CUARTA capa, la que el protocolo marca como «la que no se salta».
 *     No da un error de instalación: da un paso que no corre.
 *
 * 🔴 SE SUSTITUYE POR UN `require` INLINE, no por una variable. Los scripts ya resuelven
 *    `NODE_PATH` con `require(__dirname + '/lib-entorno.js').TOOLS`, sin declarar nada; meter
 *    ahora un `var ENT` chocaría con los que ya lo tienen y habría que distinguir caso por caso.
 *    El require está cacheado por Node: cuesta lo mismo y no colisiona con nada.
 *
 *   node orquestador.migrar-herramientas.js              (seco)
 *   node orquestador.migrar-herramientas.js --escribir
 */
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var D = path.resolve(__dirname);
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var ENT = require(__dirname + '/lib-entorno.js');

console.log('════ LAS HERRAMIENTAS Y EL INTÉRPRETE, PEDIDOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// ── 0 · la prueba que autoriza: lo que resuelve el contrato tiene que ser lo que hay escrito
function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, ''); }
var okT = norm(ENT.TOOLS) === norm(os.homedir() + '/.claude/tools');
var okP = norm(ENT.PYTHON) === norm(os.homedir() + '/AppData/Local/Programs/Python/Python313/python.exe');
console.log('  TOOLS   contrato: ' + norm(ENT.TOOLS));
console.log('          escrito : ' + norm(os.homedir() + '/.claude/tools') + '   ' + (okT ? '✔' : '🔴'));
console.log('  PYTHON  contrato: ' + norm(ENT.PYTHON));
console.log('          escrito : Python313/python.exe   ' + (okP ? '✔' : '🔴'));
if (!okT || !okP) {
  console.log('\n🔴 No resuelven al mismo sitio. No migro: dejaría scripts apuntando a otra carpeta,');
  console.log('   y este sistema lee un `existsSync` en falso como «no hay datos».');
  process.exit(1);
}
console.log('  ✔ los dos resuelven igual: se puede migrar\n');

var REQ_T = "require(__dirname + '/lib-entorno.js').TOOLS";
var REQ_P = "require(__dirname + '/lib-entorno.js').PYTHON";

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function prefijosDelHome(t) {
  var pre = ['os.homedir()', "require('os').homedir()"];
  (t.match(/(\w+)\s*=\s*require\('os'\)/g) || []).forEach(function (m) { pre.push(/(\w+)\s*=/.exec(m)[1] + '.homedir()'); });
  (t.match(/(\w+)\s*=\s*(?:require\('os'\)|\w+)\.homedir\(\)/g) || []).forEach(function (m) { pre.push(/(\w+)\s*=/.exec(m)[1]); });
  return pre.filter(function (p, i) { return pre.indexOf(p) === i; });
}

var plan = [];
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  if (path.join(D, f) === __filename) return;              // el que migra lleva los literales
  if (f === 'lib-entorno.js') return;                      // es quien los resuelve
  var p = path.join(D, f), t = fs.readFileSync(p, 'utf8'), o = t, cuenta = {};
  var PRE = prefijosDelHome(t);

  PRE.forEach(function (pre) {
    // python, con o sin la versión escrita
    var reP = new RegExp(esc(pre) + "\\s*\\+\\s*'/AppData/Local/Programs/Python/Python\\d+/python\\.exe'", 'g');
    t = t.replace(reP, function () { cuenta['el intérprete de python'] = (cuenta['el intérprete de python'] || 0) + 1; return REQ_P; });

    // las herramientas: la carpeta, con o sin lo que venga detrás
    var reT = new RegExp(esc(pre) + "\\s*\\+\\s*'/\\.claude/tools([^']*)'", 'g');
    t = t.replace(reT, function (_, resto) {
      cuenta['las herramientas'] = (cuenta['las herramientas'] || 0) + 1;
      return resto ? REQ_T + " + '" + resto + "'" : REQ_T;
    });
  });

  if (t === o) return;
  plan.push({ f: f, p: p, t: t, cuenta: cuenta });
});

var tot = {};
plan.forEach(function (x) { Object.keys(x.cuenta).forEach(function (k) { tot[k] = (tot[k] || 0) + x.cuenta[k]; }); });
console.log('  a migrar: ' + plan.length + ' script(s)');
console.log('\n  ── qué se sustituye');
Object.keys(tot).forEach(function (k) { console.log('     ' + String(tot[k]).padStart(4) + '  ' + k); });

if (!ESCRIBIR) {
  console.log('\n  ── los primeros');
  plan.slice(0, 8).forEach(function (x) { console.log('     ' + x.f.padEnd(44) + Object.keys(x.cuenta).map(function (k) { return x.cuenta[k] + ' ' + k; }).join(' · ')); });
  console.log('\n  (seco. Para escribir: --escribir)');
  process.exit(0);
}

var rotos = [];
plan.forEach(function (x) {
  fs.writeFileSync(x.p, x.t);
  var ch = cp.spawnSync(process.execPath, ['--check', x.p], { encoding: 'utf8' });
  if (ch.status !== 0) rotos.push(x.f + ': ' + (String(ch.stderr || '').split(/\r?\n/).filter(function (l) { return /Error|Unexpected/.test(l); })[0] || 'rechazado'));
});
console.log('\n  ── releído del disco');
console.log('     ' + (rotos.length ? '🔴 ' + rotos.length + ' con sintaxis rota:' : '✔ los ' + plan.length + ' siguen compilando'));
rotos.slice(0, 6).forEach(function (r) { console.log('        ' + r); });

/* 🔴 EL BARRIDO MIRA TODOS Y LAS DOS FORMAS. Las dos lecciones de hoy en una línea: un barrido que
 *    solo revisa lo que tocó se declaró completo con 7 rutas en pie, y uno que solo buscaba la
 *    ruta con barras dejó anclado `lib-entorno.js`, que la tenía repartida en `path.join(...)`. */
var TODOS = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var quedan = [];
TODOS.forEach(function (f) {
  if (path.join(D, f) === __filename) return;
  var ls = fs.readFileSync(path.join(D, f), 'utf8').split(/\r?\n/).filter(function (L) {
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) return false;
    if (L.indexOf('/.claude/tools') >= 0 || L.indexOf('Programs/Python') >= 0) return true;
    return /['"]\.claude['"]\s*,\s*['"]tools['"]/.test(L) || /['"]Programs['"]\s*,\s*['"]Python['"]/.test(L);
  });
  if (ls.length) quedan.push({ f: f, n: ls.length, L: ls[0].trim().slice(0, 92) });
});
console.log('\n  ── el barrido, sobre los ' + TODOS.length + ' scripts');
if (!quedan.length) console.log('     ✔ NINGUNO ancla las herramientas ni el intérprete');
else {
  console.log('     ' + (quedan.length === 1 && quedan[0].f === 'lib-entorno.js' ? '✔' : '🔴') + ' ' + quedan.length + ' siguen anclados:');
  quedan.slice(0, 10).forEach(function (x) { console.log('        ' + x.f.padEnd(40) + x.n + '   ' + x.L); });
  if (quedan.length === 1 && quedan[0].f === 'lib-entorno.js') console.log('        ↑ es quien los RESUELVE: ahí viven a propósito');
}

var pendientes = quedan.filter(function (x) { return x.f !== 'lib-entorno.js'; });
var fallo = rotos.length + pendientes.length;
console.log('\n════ ' + (fallo ? '🔴 NO quedó · ' + rotos.length + ' roto(s) · ' + pendientes.length + ' anclado(s)'
  : '✅ ' + plan.length + ' MIGRADOS — herramientas e intérprete se piden. Corre la cadena y compara contra la línea base') + ' ════');
process.exit(fallo ? 1 : 0);
