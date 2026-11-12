// NO-ES-RUNNER: script de MIGRACION (serie E), de una sola vez y ya aplicado. Corrio N1/N2d/N2v
//   para comprobar que los tres skills de apoyo quedaban bien. No es un camino de produccion.
// E5 · LOS SKILLS DE APOYO — insumos · manual · cuadre — y el retiro del que está muerto.
//
// 🔴 LOS TRES NO SE PARECEN, y por eso su contrato es distinto:
//      · `insumos` NO escribe: mira las descargas y dice qué llegó, qué falta y qué está viejo.
//        Su salida es un dictamen, y quien lo consume es el orquestador.
//      · `manual` SÍ escribe, pero lo que Rick declara a mano — su autoridad es él, no una fuente.
//      · `cuadre` es la PUERTA 1: no escribe nada, dictamina si se puede escribir.
//
// 🔴 Y 5.4 · `rick-reportes-nestle-fuentes` SE RETIRA. No es una opinión: **su propio texto dice
//    que está superado** («queda solo para Qcart, hasta que N2b se migre a
//    rick-reportes-fuentes-qcart»), y N2b ya se migró. Un skill que se declara obsoleto a sí mismo
//    y sigue en la lista es una trampa: alguien lo va a invocar.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var SK = os.homedir() + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(52) + e); c ? ok++ : mal++; }

console.log('════════ E5 · SKILLS DE APOYO ' + (ESCRIBIR ? '🔴 RETIRA' : '(seco)') + ' ════════\n');

// ══ 1 · los tres de apoyo, y qué produce cada uno ══
console.log('══ 1 · los tres de apoyo ══');
var APOYO = [
  { skill: 'rick-reportes-fuentes-insumos', paso: 'fuentes-insumos.insumos.js',
    produce: '_insumos/*.json — qué llegó, qué falta, qué está viejo',
    escribe_excel: false, quien_consume: 'el catálogo y las 3 fuentes' },
  { skill: 'rick-reportes-fuentes-manual', paso: 'fuentes-manual.manual.js',
    produce: '_fuentes/manual.json — lo que Rick declara y ninguna descarga entrega',
    escribe_excel: true, quien_consume: 'cuadre · reporte' },
  { skill: 'rick-reportes-fuentes-cuadre', paso: 'fuentes-cuadre.cuadre.js',
    produce: 'el veredicto de la PUERTA 1',
    escribe_excel: false, quien_consume: 'el orquestador' }
];
APOYO.forEach(function (a) {
  var haySkill = fs.existsSync(SK + '/' + a.skill + '/SKILL.md');
  var hayNodo = fs.existsSync(BACK + '/_scripts/' + a.paso);
  var compila = false;
  if (hayNodo) { try { cp.execSync('"' + process.execPath + '" --check "' + BACK + '/_scripts/' + a.paso + '"', { stdio: 'pipe' }); compila = true; } catch (e) { } }
  chk(a.skill.replace('rick-reportes-', ''), haySkill && hayNodo && compila,
    (haySkill ? 'skill ✔' : '🔴 sin skill') + ' · ' + (hayNodo ? a.paso : '🔴 sin paso') + ' · ' + (compila ? 'compila' : '🔴 no compila'));
  console.log('        produce: ' + a.produce);
  console.log('        escribe al Excel: ' + (a.escribe_excel ? 'sí' : 'NO — su salida es un dictamen') + '   ·   lo consume: ' + a.quien_consume);
});

// ══ 2 · los que NO escriben también declaran su salida ══
console.log('\n══ 2 · un skill que no escribe al Excel igual deja su tabla ══');
var salidas = [
  { skill: 'insumos', archivo: '_insumos', es_dir: true },
  { skill: 'manual', archivo: '_fuentes/manual.json', es_dir: false },
  { skill: 'cuadre', archivo: '_fuentes/veredicto.json', es_dir: false }
];
salidas.forEach(function (s) {
  var p = BACK + '/' + s.archivo;
  var hay = fs.existsSync(p);
  var det = hay ? (s.es_dir ? fs.readdirSync(p).length + ' archivos' : Math.round(fs.statSync(p).size / 1024) + ' KB') : '🔴 no existe';
  chk('«' + s.skill + '» deja su salida en disco', hay, s.archivo + '   ' + det);
});

// ══ 3 · 5.4 · el skill muerto ══
console.log('\n══ 3 · 5.4 · el skill que se declara obsoleto a sí mismo ══');
var MUERTO = 'rick-reportes-nestle-fuentes';
var rutaM = SK + '/' + MUERTO;
var existe = fs.existsSync(rutaM + '/SKILL.md');
var md = existe ? fs.readFileSync(rutaM + '/SKILL.md', 'utf8') : '';
var seDeclara = /SUPERADO|superado/.test(md);
chk('«' + MUERTO + '» se declara superado en su propio texto', seDeclara,
  seDeclara ? 'dice: «SUPERADO PARA EMAIL… queda solo para Qcart hasta que N2b se migre»' : 'no lo dice');
var n2bMigrado = fs.existsSync(SK + '/rick-reportes-fuentes-qcart/SKILL.md');
chk('y N2b YA se migró a rick-reportes-fuentes-qcart', n2bMigrado, n2bMigrado ? 'el skill existe' : '🔴 no existe');
// ¿alguien lo cita?
var citas = [];
fs.readdirSync(SK).forEach(function (s) {
  var p = SK + '/' + s + '/SKILL.md';
  if (!fs.existsSync(p) || s === MUERTO) return;
  if (fs.readFileSync(p, 'utf8').indexOf(MUERTO) >= 0) citas.push(s);
});
chk('ningún otro skill lo cita', citas.length === 0, citas.length ? '🔴 lo citan: ' + citas.join(', ') : 'nadie depende de él');

if (!ESCRIBIR) { console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════'); console.log('\n  (seco. Para retirar el muerto: --escribir)'); process.exit(mal ? 1 : 0); }

if (existe && seDeclara && n2bMigrado && citas.length === 0) {
  var ARCH = SK + '/_archivo-sistema2';
  try { fs.mkdirSync(ARCH, { recursive: true }); } catch (e) { }
  fs.copyFileSync(rutaM + '/SKILL.md', ARCH + '/' + MUERTO + '.md');
  fs.writeFileSync(ARCH + '/' + MUERTO + '.POR-QUE.md',
    '# Por qué se retiró `' + MUERTO + '`\n\n' +
    'Retirado el 24-ago-2026.\n\n' +
    '**Se declaraba superado en su propio texto:** «SUPERADO PARA EMAIL (18-ago-2026)… Este skill\n' +
    'queda **solo para Qcart**, hasta que N2b se migre a `rick-reportes-fuentes-qcart`».\n' +
    'N2b ya se migró, así que no le quedaba nada.\n\n' +
    'Antes de retirarlo se comprobó que **ningún otro skill lo cita**.\n\n' +
    'Un skill que se declara obsoleto a sí mismo y sigue en la lista es una trampa: alguien lo va\n' +
    'a invocar, y va a cargar una llave y un diff que quedaron atrás.\n');
  fs.rmSync(rutaM, { recursive: true, force: true });
  console.log('\n  ✔ retirado a skills/_archivo-sistema2/ con su motivo escrito');
} else {
  console.log('\n  ⚠ NO se retira: no se cumplen las tres condiciones (se declara superado · N2b migrado · nadie lo cita)');
}
console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
