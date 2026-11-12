// FASE 2 · ARCHIVAR LO APLICADO — mover, nunca borrar.
//
// 🔴 QUÉ SE MUEVE Y QUÉ NO. Solo la clase `APLICADO` del censo: decisiones que ya se ejecutaron.
//    109 de 226 scripts. No se borran — van a `_scripts/_aplicados/<skill>/` con un índice que
//    dice qué hizo cada uno. Siguen en git, siguen leíbles, dejan de ser ruido.
//
// 🔴 SE AGRUPAN POR SKILL, NO POR SERIE. La serie (`A3`, `FB5`, `Q7`) dice CUÁNDO se hizo; el skill
//    dice DE QUIÉN es. Dentro de un año a nadie le va a servir «la serie Q», pero sí «lo que el
//    catálogo hizo y ya está aplicado».
//
// 🔴 Y NADIE SE MUEVE SI ALGUIEN LO INVOCA. Antes de mover se comprueba, script por script, que
//    ningún VIVO lo nombre. Mover algo que alguien llama es romper la cadena en silencio — y el
//    error aparecería lejos, con un «no such file» que se lee como problema de instalación.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts', DEST = D + '/_aplicados';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
var aplicados = censo.clases.APLICADO || [];
// todo lo que NO se archiva: si alguno de estos lo nombra, no se mueve
var seQuedan = []
  .concat((censo.clases.VIVO || []).map(function (x) { return x.f; }))
  .concat((censo.clases.ESCRITOR || []).map(function (x) { return x.f; }))
  .concat((censo.clases.ADVERSARIAL || []).map(function (x) { return x.f; }))
  .concat((censo.clases.HERRAMIENTA || []).map(function (x) { return x.f; }))
  .concat(censo.clases.LIBRERIA || [])
  .concat((censo.clases['FUERA-DE-CICLO'] || []).map(function (x) { return x.f; }));

console.log('════════ FASE 2 · ARCHIVAR ' + (ESCRIBIR ? '🔴 MUEVE' : '(seco)') + ' ════════\n');
console.log('  candidatos (clase APLICADO): ' + aplicados.length);
console.log('  se quedan: ' + seQuedan.length + '\n');

// ── ¿alguien vivo los invoca?
var citado = {};
seQuedan.forEach(function (v) {
  var p = path.join(D, v);
  if (!fs.existsSync(p)) return;
  var txt = fs.readFileSync(p, 'utf8');
  aplicados.forEach(function (a) { if (txt.indexOf(a.f) >= 0) (citado[a.f] = citado[a.f] || []).push(v); });
});

var van = aplicados.filter(function (a) { return !citado[a.f]; });
var noVan = aplicados.filter(function (a) { return citado[a.f]; });
console.log('  ✔ se archivan: ' + van.length);
console.log('  ⛔ NO se archivan porque algo vivo los invoca: ' + noVan.length);
noVan.forEach(function (a) { console.log('     ' + a.f.padEnd(32) + 'lo citan: ' + citado[a.f].slice(0, 3).join(' · ')); });

// ── por skill
var porSkill = {};
van.forEach(function (a) { (porSkill[a.skill || 'sin-skill'] = porSkill[a.skill || 'sin-skill'] || []).push(a); });
console.log('\n  ── a dónde va cada uno ──');
Object.keys(porSkill).sort().forEach(function (s) {
  console.log('   _aplicados/' + s.replace('rick-reportes-', '') + '/   ← ' + porSkill[s].length + ' scripts');
});

if (!ESCRIBIR) { console.log('\n  (seco. Para archivar: --escribir)'); process.exit(0); }

// ── mover
var movidos = [], fallos = [];
Object.keys(porSkill).forEach(function (s) {
  var carpeta = path.join(DEST, s.replace('rick-reportes-', ''));
  fs.mkdirSync(carpeta, { recursive: true });
  porSkill[s].forEach(function (a) {
    var de = path.join(D, a.f), a2 = path.join(carpeta, a.f);
    try { fs.renameSync(de, a2); movidos.push({ f: a.f, skill: s, destino: path.relative(D, a2) }); }
    catch (e) { fallos.push({ f: a.f, error: e.code }); }
  });
});

// ── el índice: qué hizo cada uno, para que archivar no sea perder
var idx = ['# Scripts aplicados — decisiones ya ejecutadas', '',
  'Movidos aquí en la **fase 2** del plan de pasos. **No están muertos: están hechos.**',
  'Cada uno fue una decisión de un día que ya corrió. Se conservan porque son la única memoria',
  'de por qué el sistema es como es — pero fuera del camino, para que nadie los invoque por error.', '',
  '🔴 **Ninguno se movió si algo vivo lo invocaba**: eso se comprobó script por script antes de mover.', ''];
Object.keys(porSkill).sort().forEach(function (s) {
  idx.push('## ' + s.replace('rick-reportes-', ''));
  idx.push('');
  porSkill[s].forEach(function (a) { idx.push('- `' + a.f + '` — serie ' + (a.serie || '?')); });
  idx.push('');
});
fs.writeFileSync(path.join(DEST, 'INDICE.md'), idx.join('\n'));

// ══ VALIDACIÓN DE LA FASE 2 — de COLOCACIÓN, no de uso ══
console.log('\n  ══ VALIDACIÓN DE LA FASE 2 ══');
var enDestino = 0, enOrigen = 0, perdidos = [];
movidos.forEach(function (m) {
  var dst = path.join(D, m.destino);
  if (fs.existsSync(dst)) enDestino++; else perdidos.push(m.f + ' (no está en su destino)');
  if (fs.existsSync(path.join(D, m.f))) enOrigen++;
});
console.log('   ' + (movidos.length === van.length ? '✔' : '🔴') + ' se movieron los que tocaba: ' + movidos.length + ' de ' + van.length);
console.log('   ' + (enDestino === movidos.length ? '✔' : '🔴') + ' cada uno EXISTE en su carpeta de destino: ' + enDestino + ' de ' + movidos.length);
console.log('   ' + (enOrigen === 0 ? '✔' : '🔴') + ' ninguno quedó también en el origen: ' + enOrigen);
console.log('   ' + (fallos.length === 0 ? '✔' : '🔴') + ' sin fallos al mover: ' + fallos.length);
console.log('   ' + (fs.existsSync(path.join(DEST, 'INDICE.md')) ? '✔' : '🔴') + ' el índice existe y nombra a los ' + movidos.length);
// 🔴 y la que de verdad importa: ¿la cadena sigue teniendo todos sus scripts?
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var faltan = [];
C.etapas.forEach(function (e) { e.scripts.forEach(function (n) {
  if (!fs.existsSync(path.join(D, n.script))) faltan.push(n.id + ' → ' + n.script);
  (n.suites || []).forEach(function (s) { if (!fs.existsSync(path.join(D, s))) faltan.push(n.id + ' suite → ' + s); });
}); });
console.log('   ' + (faltan.length === 0 ? '✔' : '🔴') + ' la cadena conserva TODOS sus scripts: ' + (faltan.length ? faltan.join(' · ') : 'los ' + C.etapas.length + ' etapas completas'));
perdidos.forEach(function (p) { console.log('      🔴 ' + p); });
fallos.forEach(function (f) { console.log('      🔴 ' + f.f + ': ' + f.error); });
console.log('\n  → _scripts/_aplicados/  ·  índice en INDICE.md');
process.exit(faltan.length || perdidos.length || fallos.length ? 1 : 0);
