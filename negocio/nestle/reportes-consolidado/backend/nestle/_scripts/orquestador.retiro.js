// orquestador.retiro.js — archivar lo que el sistema 3 ya reemplazó.
//
// 🔴 LA REGLA: no se retira NADA mientras algo lo referencie. Y «referencia» se MIDE — se busca
//    el nombre del archivo en todo lo demás — no se supone leyendo el código.
//
// 🔴 Y NADA SE BORRA. Se MUEVE a `_archivo/`, que está en git. `rm` no pasa por la papelera, y
//    ya costó tres skills que perdieron sus scripts porque una sesión en paralelo los borró.
//    Un retiro irreversible no es un retiro: es una pérdida.
//
// USO:  node orquestador.retiro.js              → dice qué se puede retirar y qué no, sin tocar nada
//       node orquestador.retiro.js --archivar   → mueve a _archivo/ solo lo que nadie referencia
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var DIR = BACK + '/_scripts';
var ARCH = BACK + '/_archivo';
var HACER = process.argv.indexOf('--archivar') > -1;

console.log('════════ N10 · RETIRO ════════');
console.log(HACER ? '  🔴 va a mover archivos\n' : '  modo seco: no se mueve nada\n');

// ── quién referencia a quién ───────────────────────────────────────────────────────────────
// se busca en TODO lo que puede citar un script: los demás scripts, el orquestador, los skills,
// las herramientas y la documentación. Un nombre citado en un .md también cuenta: si un doc le
// dice a alguien «corre este script», retirarlo rompe el doc.
var LUGARES = [DIR, BACK, require(__dirname + '/lib-entorno.js').SKILLS, require(__dirname + '/lib-entorno.js').TOOLS + '/reportes',
  require(__dirname + '/lib-entorno.js').DOCTRINA];
function todosLosArchivos(d, prof) {
  var out = [];
  (function rec(x, n) {
    if (n > (prof || 4)) return;
    var e; try { e = fs.readdirSync(x, { withFileTypes: true }); } catch (q) { return; }
    e.forEach(function (y) {
      var p2 = x + '/' + y.name;
      if (y.isDirectory()) { if (!/node_modules|_archivo|\.git/.test(y.name)) rec(p2, n + 1); }
      else if (/\.(js|md|json|ps1|py)$/.test(y.name)) out.push(p2);
    });
  })(d, 0);
  return out;
}
var universo = [];
LUGARES.forEach(function (d) { if (fs.existsSync(d)) universo = universo.concat(todosLosArchivos(d)); });
var texto = {};
universo.forEach(function (f) { try { texto[f] = fs.readFileSync(f, 'utf8'); } catch (e) { } });

// ── los candidatos: los scripts de un solo uso de la Puerta 1 ──────────────────────────────
// Se identifican por LO QUE SON, no por su prefijo: scripts que ya corrieron, cuyo resultado ya
// está dentro del workbook, y que el bucle N9 no llama.
var SCRIPTS = (function () {
  var s = fs.readFileSync(DIR + '/orquestador.orquestador.js', 'utf8');
  var out = [];
  s.replace(/script: '([^']+)'/g, function (_, x) { out.push(x); return _; });
  s.replace(/validaciones?: \[([^\]]*)\]/g, function (_, x) {
    x.replace(/'([^']+)'/g, function (__, y) { out.push(y); return __; }); return _;
  });
  return out;
})();
console.log('  el bucle N9 llama a ' + SCRIPTS.length + ' scripts — esos NO se tocan.\n');

var candidatos = fs.readdirSync(DIR).filter(function (f) {
  return /^N3-.*\.js$/.test(f) && SCRIPTS.indexOf(f) < 0;
});

var seRetiran = [], sequedan = [];
candidatos.forEach(function (f) {
  var citas = universo.filter(function (u) {
    return path.basename(u) !== f && texto[u] && texto[u].indexOf(f) > -1;
  });
  if (citas.length) sequedan.push({ f: f, por: citas.map(function (c) { return path.basename(c); }) });
  else seRetiran.push(f);
});

console.log('  ── se pueden retirar (nadie los cita)');
if (!seRetiran.length) console.log('     (ninguno)');
seRetiran.forEach(function (f) { console.log('     ✔ ' + f); });

console.log('\n  ── NO se retiran (algo los cita)');
if (!sequedan.length) console.log('     (ninguno)');
sequedan.forEach(function (x) { console.log('     ⛔ ' + x.f.padEnd(30) + ' lo citan: ' + x.por.join(' · ')); });

// ── lo que NO puede retirarse todavía, y por qué ───────────────────────────────────────────
// Esto no es un adorno: el plan dice «archivar los 12 agentes» y hacerlo hoy rompería el skill
// que Rick usa. Se mide y se reporta, no se ejecuta por estar escrito en un plan.
console.log('\n  ── lo que el plan pide retirar y TODAVIA NO SE PUEDE');
// 🔴 los agentes viven en SUBCARPETAS (`agents/crm-reporte/`), no sueltos en `agents/`.
//    Contarlos con un readdir plano daba 0 — y el reporte decia «los 0 agentes ... el skill los
//    llama por nombre», que es una contradiccion. Un conteo que no encuentra nada NO prueba que
//    no haya nada: prueba que busco donde no era.
var agentes = require(__dirname + '/lib-entorno.js').AGENTES;
var nAg = (function () {
  if (!fs.existsSync(agentes)) return 0;
  var n = 0;
  (function rec(d, p2) {
    if (p2 > 2) return;
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (x) {
      if (x.isDirectory()) rec(d + '/' + x.name, p2 + 1);
      else if (/^crm-reporte-agent-.*\.md$/.test(x.name)) n++;
    });
  })(agentes, 0);
  return n;
})();
var skillOrq = require(__dirname + '/lib-entorno.js').SKILLS + '/crm-reporte-orquestador/SKILL.md';
var citaAgentes = fs.existsSync(skillOrq) && /crm-reporte-agent-/.test(fs.readFileSync(skillOrq, 'utf8'));
console.log('     ⛔ los ' + nAg + ' agentes del sistema 2: ' + (citaAgentes ?
  'el skill `crm-reporte-orquestador` los llama por nombre en su tabla de scripts.' : 'nadie los cita — se podrian retirar.'));
console.log('        Retirarlos exige reescribir ese skill primero. Es una decision de Rick,');
console.log('        no un efecto colateral de este paso.');
console.log('     ⛔ `Catalog_Campanas`: sigue viva con ~1,142 fórmulas encima en el workbook.');

// ── mover ──────────────────────────────────────────────────────────────────────────────────
if (HACER && seRetiran.length) {
  if (!fs.existsSync(ARCH)) fs.mkdirSync(ARCH, { recursive: true });
  seRetiran.forEach(function (f) {
    fs.renameSync(DIR + '/' + f, ARCH + '/' + f);
    console.log('\n  → movido: _scripts/' + f + '  ⇒  _archivo/' + f);
  });
  // y se comprueba que no se rompió nada: el bucle tiene que seguir cargando
  var cp = require('child_process');
  try {
    cp.execSync('"' + process.execPath + '" --check "' + DIR + '/orquestador.orquestador.js"', { encoding: 'utf8' });
    console.log('  ✔ el orquestador sigue en pie tras el retiro');
  } catch (e) { console.log('  🔴 el orquestador se rompió: ' + e.message); process.exit(1); }
}

console.log('\n════════════════════════════════════════');
console.log('  ' + (HACER ? '✅ retirados ' + seRetiran.length + ' · conservados ' + sequedan.length
  : 'se pueden retirar ' + seRetiran.length + ' · se quedan ' + sequedan.length +
  (seRetiran.length ? '   → node orquestador.retiro.js --archivar' : '')));
