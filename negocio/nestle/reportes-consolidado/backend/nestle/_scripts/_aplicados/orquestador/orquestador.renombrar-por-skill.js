// FASE 5 · NOMBRES `<skill>.<verbo>` — el nombre dice de quién es.
//
// 🔴 POR QUÉ. Hoy conviven prefijos de 36 familias (`N`, `Z`, `E`, `A`, `S`, `FB`, `Q`…) y para
//    saber de quién es un script hay que abrirlo. Peor: llegué a crear `orquestador.cadena-skills.js`
//    cuando ya existía `S1-altas-handoff.js` — dos scripts distintos con el mismo id, porque nada
//    lo impedía. Con `<skill>.<verbo>` el dueño va delante y los choques desaparecen solos.
//
// 🔴 LO QUE HACE PELIGROSO ESTO. Un renombre rompe a todo el que invoque por nombre: la cadena,
//    los SKILL.md, los contratos y los propios scripts. Por eso el orden es **referencias primero,
//    archivo después**, y en la misma corrida: renombrar y dejar las referencias para luego es
//    cómo se rompe la cadena en silencio.
//
// 🔴 Y NO SE RENOMBRA LO QUE NO SE PUEDE PROBAR. Las librerías conservan su `lib-` (ya es un
//    prefijo que dice qué son) y lo archivado no se toca: mover historia no ayuda a nadie.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';
var SKILLS = os.homedir() + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
var corto = function (s) { return String(s || 'sin-skill').replace('rick-reportes-', '').replace('nestle-', ''); };

// las clases que SÍ se renombran. `LIBRERIA` no: `lib-` ya dice qué es.
var RENOMBRAR = ['VIVO', 'ESCRITOR', 'ADVERSARIAL', 'HERRAMIENTA', 'FUERA-DE-CICLO', 'CONGELADO', 'RETIRADO'];

// 🔴 EL VERBO SALE DEL NOMBRE QUE YA TIENE, quitándole el prefijo de familia. No se inventa: si el
//    script se llamaba `N2v-cuadre`, su verbo es `cuadre`. Inventar verbos nuevos obligaría a
//    releer 127 scripts para saber qué hace cada uno, y ahí es donde se cuelan los errores.
function verboDe(f) {
  var base = f.replace(/\.js$/, '');
  // quita el prefijo de familia: escritor-neutralizar, PUERTA-1, insights-redactar, NC, motor-clicks, Z, S5, E8b, FB7, AUDIT…
  var v = base.replace(/^(N\d+[a-z]?|NC|motor-clicks|ND|Z|S\d+[a-z]?|E\d+[a-z]?|L\d+|F[A-Z]\d*|A\d+[a-z]?|B\d+[a-z]?|C\d+|D|G\d+|P\d+|Q\d+|M\d+|R\d+|AUDIT)-/, '');
  if (v === base) v = base;                       // no tenía prefijo (censo-pasos, revalidar-todo…)
  // los validadores llevan su número: `-99-validar` → `validar`, y se marca
  v = v.replace(/^9\d-/, '').replace(/^0\d-/, '');
  return v.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

var mapa = [], choques = {};
RENOMBRAR.forEach(function (clase) {
  (censo.clases[clase] || []).forEach(function (x) {
    if (!fs.existsSync(path.join(D, x.f))) return;
    // 🔴 IDEMPOTENTE: lo que ya lleva `<skill>.` delante NO se vuelve a renombrar. Sin esto, correr
    //    la fase dos veces produce `resumen.resumen-validar.js` — el renombrador se come su propio
    //    resultado. Una migración que no se puede repetir sin dañar no es una migración: es un
    //    disparo único que hay que acertar a la primera.
    if (/^[a-z-]+\.[a-z0-9-]+\.js$/.test(x.f)) return;
    var s = corto(x.skill), v = verboDe(x.f);
    var nuevo = s + '.' + v + '.js';
    (choques[nuevo] = choques[nuevo] || []).push(x.f);
    mapa.push({ viejo: x.f, nuevo: nuevo, skill: s, clase: clase });
  });
});

// 🔴 DOS QUE ACABEN CON EL MISMO NOMBRE ES EXACTAMENTE EL DEFECTO QUE ESTO VIENE A CERRAR.
//    Si pasa, se desambigua con la clase — nunca se pisa uno con otro.
mapa.forEach(function (m) {
  if (choques[m.nuevo].length > 1) {
    m.nuevo = m.skill + '.' + (m.clase === 'ADVERSARIAL' ? 'refuta-' : m.clase === 'HERRAMIENTA' ? 'tool-' : '') + verboDe(m.viejo) + '.js';
    m.desambiguado = true;
  }
});

console.log('════════ FASE 5 · NOMBRES <skill>.<verbo> ' + (ESCRIBIR ? '🔴 RENOMBRA' : '(seco)') + ' ════════\n');
console.log('  a renombrar: ' + mapa.length + '   ·   librerías que NO se tocan: ' + (censo.clases.LIBRERIA || []).length + '\n');
var porSkill = {};
mapa.forEach(function (m) { (porSkill[m.skill] = porSkill[m.skill] || []).push(m); });
Object.keys(porSkill).sort().forEach(function (s) {
  console.log('  ══ ' + s + ' (' + porSkill[s].length + ') ══');
  porSkill[s].slice(0, 40).forEach(function (m) {
    console.log('     ' + m.viejo.padEnd(32) + '→  ' + m.nuevo + (m.desambiguado ? '   ⚠ desambiguado' : ''));
  });
});

// ── choques que quedan
var quedan = {};
mapa.forEach(function (m) { (quedan[m.nuevo] = quedan[m.nuevo] || []).push(m.viejo); });
var dobles = Object.keys(quedan).filter(function (k) { return quedan[k].length > 1; });
console.log('\n  ' + (dobles.length ? '🔴' : '✔') + ' nombres nuevos que chocarían: ' + dobles.length);
dobles.forEach(function (k) { console.log('     🔴 ' + k + ' ← ' + quedan[k].join(' y ')); });
if (dobles.length) { console.log('\n  No se renombra nada mientras haya choques.'); process.exit(1); }

if (!ESCRIBIR) { console.log('\n  (seco. Para renombrar: --escribir)'); process.exit(0); }

// ── 1 · REFERENCIAS PRIMERO, en todo lo que puede nombrarlos
function archivosConReferencias() {
  var out = [];
  (function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); return; }
      if (/\.(js|json|md)$/.test(f)) out.push(p);
    });
  })(BACK);
  (function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { walk(p); return; }
      if (/\.md$/.test(f)) out.push(p);
    });
  })(SKILLS);
  return out;
}
var archivos = archivosConReferencias();
var tocados = 0, sustituciones = 0;
archivos.forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8'), orig = txt;
  mapa.forEach(function (m) {
    var re = new RegExp(m.viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    var n = (txt.match(re) || []).length;
    if (n) { txt = txt.replace(re, m.nuevo); sustituciones += n; }
  });
  if (txt !== orig) { fs.writeFileSync(p, txt); tocados++; }
});
console.log('\n  ── referencias actualizadas ANTES de mover: ' + sustituciones + ' en ' + tocados + ' archivos');

// ── 2 · renombrar
var hechos = [], fallos = [];
mapa.forEach(function (m) {
  try { fs.renameSync(path.join(D, m.viejo), path.join(D, m.nuevo)); hechos.push(m); }
  catch (e) { fallos.push({ m: m, error: e.code }); }
});
console.log('  ── archivos renombrados: ' + hechos.length + ' de ' + mapa.length);

// ══ VALIDACIÓN DE LA FASE 5 ══
console.log('\n  ══ VALIDACIÓN DE LA FASE 5 ══');
console.log('   ' + (hechos.length === mapa.length ? '✔' : '🔴') + ' se renombraron todos: ' + hechos.length + ' de ' + mapa.length);
var enDestino = hechos.filter(function (m) { return fs.existsSync(path.join(D, m.nuevo)); }).length;
var enOrigen = hechos.filter(function (m) { return fs.existsSync(path.join(D, m.viejo)); }).length;
console.log('   ' + (enDestino === hechos.length ? '✔' : '🔴') + ' cada uno existe con su nombre nuevo: ' + enDestino);
console.log('   ' + (enOrigen === 0 ? '✔' : '🔴') + ' ninguno quedó con el nombre viejo: ' + enOrigen);
// 🔴 la que importa: ¿queda alguna referencia al nombre viejo?
// ⚠ SE BUSCA EL NOMBRE VIEJO **SUELTO**, no como subcadena. El nombre viejo vive DENTRO del nuevo
//   (`validar-capacidades.js` está dentro de `orquestador.validar-capacidades.js`), así que un
//   `indexOf` marcó 26 referencias colgando que no existían. Un check que se acusa a sí mismo
//   entrena a ignorar el rojo — el mismo defecto que perseguimos en los guardianes.
var colgadas = [];
archivosConReferencias().forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8');
  mapa.forEach(function (m) {
    var re = new RegExp('(^|[^A-Za-z0-9.\\-])' + m.viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (re.test(txt)) colgadas.push(path.basename(p) + ' → ' + m.viejo);
  });
});
console.log('   ' + (colgadas.length === 0 ? '✔' : '🔴') + ' sin referencias colgando al nombre viejo: ' + colgadas.length);
colgadas.slice(0, 8).forEach(function (c) { console.log('      🔴 ' + c); });
// y que la cadena siga apuntando a archivos que existen
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var faltan = [];
C.etapas.forEach(function (e) { e.scripts.forEach(function (n) {
  if (!fs.existsSync(path.join(D, n.script))) faltan.push(n.id + ' → ' + n.script);
  (n.suites || []).forEach(function (s) { if (!fs.existsSync(path.join(D, s))) faltan.push(n.id + ' suite → ' + s); });
}); });
console.log('   ' + (faltan.length === 0 ? '✔' : '🔴') + ' la cadena apunta a archivos que existen: ' + (faltan.length ? faltan.join(' · ') : 'los ' + C.etapas.length + ' etapas'));
fallos.forEach(function (f) { console.log('      🔴 ' + f.m.viejo + ': ' + f.error); });
process.exit(faltan.length || colgadas.length || fallos.length ? 1 : 0);
