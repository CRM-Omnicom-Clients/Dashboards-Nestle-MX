// E1.3.99 · ¿LA PARTITURA NOMBRA INSTRUMENTOS QUE EXISTEN?
//
// 🔴 El defecto que tenía el orquestador no era estar «desactualizado»: era **citar scripts que ya
//    no existen o que ya no se llaman**. Una partitura así no dirige — y peor, da la impresión de
//    que sí. Este check lo mide: cada script citado en el SKILL.md tiene que existir en disco, y
//    cada paso que el orquestador EJECUTA tiene que estar documentado.
//
//    Se corre en cada corte: si alguien renombra un paso y olvida la partitura, esto lo caza.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var SKILL = os.homedir() + '/.claude/skills/rick-reportes-orquestador/SKILL.md';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(54) + e); c ? ok++ : mal++; }

console.log('════════ E1.3.99 · LA PARTITURA CONTRA LOS INSTRUMENTOS ════════\n');
var md = fs.readFileSync(SKILL, 'utf8');
var n9 = fs.readFileSync(BACK + '/_scripts/orquestador.orquestador.js', 'utf8');

// ── 1 · todo script citado en el SKILL.md existe
console.log('══ 1 · los scripts que la partitura nombra ══');
var citados = (md.match(/`([A-Z][A-Za-z0-9]*-[A-Za-z0-9.-]+\.js)`/g) || [])
  .map(function (x) { return x.replace(/`/g, ''); })
  .filter(function (v, i, a) { return a.indexOf(v) === i; });
var fantasmas = citados.filter(function (c) { return !fs.existsSync(BACK + '/_scripts/' + c); });
chk('todo script citado existe en disco', fantasmas.length === 0,
  citados.length + ' citados' + (fantasmas.length ? '   🔴 fantasmas: ' + fantasmas.join(', ') : ''));

// ── 2 · todo paso que N9 EJECUTA está documentado
console.log('\n══ 2 · lo que N9 ejecuta, ¿está en la partitura? ══');
var bloque = (n9.match(/var PASOS = \[[\s\S]*?\n\];/) || [''])[0];
var ejecuta = (bloque.match(/script: '([A-Za-z0-9.-]+\.js)'/g) || [])
  .map(function (x) { return /'([^']+)'/.exec(x)[1]; })
  .filter(function (v, i, a) { return a.indexOf(v) === i; });
var sinDocumentar = ejecuta.filter(function (e) { return md.indexOf(e) < 0; });
chk('todo paso ejecutado está documentado', sinDocumentar.length === 0,
  ejecuta.length + ' pasos' + (sinDocumentar.length ? '   🔴 sin documentar: ' + sinDocumentar.join(', ') : ''));

// ── 3 · los pasos RETIRADOS no pueden seguir en la cadena ejecutable
console.log('\n══ 3 · los retirados no pueden seguir ejecutándose ══');
var RETIRADOS = [
  { s: 'N2a-email.js', por: 'el email sale de SFMC; llamarlo PISA el bloque bueno' },
  { s: 'orquestador.resumen.js', por: 'empareja por identidad y se rompe cuando una pieza se renombra' }
];
RETIRADOS.forEach(function (r) {
  var enCadena = new RegExp("script: '" + r.s.replace('.', '\\.') + "'").test(bloque);
  chk('«' + r.s + '» fuera de la cadena', !enCadena, enCadena ? '🔴 sigue ejecutándose — ' + r.por : 'no se ejecuta ✔');
});

// ── 4 · los pasos NUEVOS sí están
console.log('\n══ 4 · los pasos nuevos entraron ══');
[['motor.links.js', 'clicks por destino'], ['motor.links-a-rejilla.js', 'links a la rejilla'],
 ['resumen.regenerar.js', 'el reporte que regenera']].forEach(function (x) {
  chk('«' + x[0] + '» en la cadena', bloque.indexOf(x[0]) >= 0, x[1]);
});

// ── 5 · la partitura conoce el modelo de datos
console.log('\n══ 5 · la partitura conoce el modelo ══');
[['esquema.json', 'el diccionario de datos'], ['lib-esquema', 'la librería que lo sirve'],
 ['Pieza_Principal_ID', 'la foránea FUP→Principal'], ['Z-escribir-todo', 'el escritor único'],
 ['PENDIENTE', 'los tres estados de celda']].forEach(function (x) {
  chk('cita «' + x[0] + '»', md.indexOf(x[0]) >= 0, x[1]);
});

// ── 6 · y declara su propia deuda
console.log('\n══ 6 · ¿declara lo que todavía no está bien? ══');
chk('declara la deuda de los dos escritores', /DEUDA D3|dos escritores/i.test(md), 'un sistema que esconde su deuda da permiso');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ LA PARTITURA CUADRA — ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
