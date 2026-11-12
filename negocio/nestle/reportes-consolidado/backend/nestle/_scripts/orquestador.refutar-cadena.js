// S3 · REFUTAR LA CADENA DE SKILLS. No comprueba que funcione: intenta DEMOSTRAR que es de mentira.
//
// 🔴 LA AFIRMACIÓN QUE SE ATACA: «la cadena es de skills, los scripts de ejecución están dentro, y la cadena de
//    scripts ya no se usa». Una migración cosmética pasaría cualquier prueba que solo mire el JSON
//    bonito. Así que cada ataque busca la forma concreta en que esto podría ser falso:
//
//      A1 · ¿hay un script del backend que corra SIN pertenecer a un skill?
//      A2 · ¿la cadena declarada es de verdad la que se EJECUTA, o el orquestador la ignora?
//      A3 · ¿el guard de script huérfano de verdad BLOQUEA, o solo avisa?
//      A4 · ¿el ORDEN de la cadena es el orden real, o se reordenó al agrupar por skill?
//      A5 · ¿los 12 skills existen de verdad, con su fundación, o son archivos vacíos?
//      A6 · ¿el HTML dice lo mismo que la cadena, o ya divergió?
//      A7 · 🔴 ¿queda algún camino que corra scripts SALTÁNDOSE la cadena de skills?
//      A8 · ¿algún skill declara scripts que no existen en el disco?
//
// Sale exit 1 si algún ataque tiene éxito.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var SKDIR = require(__dirname + '/lib-entorno.js').SKILLS;
var PROY = ENT.PROYECTO;
var rotos = [], ok = [];
function ataque(nombre, exito, detalle) {
  if (exito) rotos.push({ nombre: nombre, detalle: detalle });
  else ok.push({ nombre: nombre, detalle: detalle });
}

console.log('════════ S3 · REFUTAR LA CADENA DE SKILLS ════════\n');
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var scripts = []; C.etapas.forEach(function (e) { e.scripts.forEach(function (n) { scripts.push(Object.assign({ _skill: e.skill, _etapa: e.orden }, n)); }); });

// ── A1 · un script que corre sin skill ──────────────────────────────────────────────────
(function () {
  var src = fs.readFileSync(D + '/orquestador.orquestador.js', 'utf8');
  var m = /SCRIPTS\s*=\s*\[([\s\S]*?)\n\];/.exec(src);
  var docs = (m ? (m[1].match(/id:\s*'([^']+)'/g) || []) : []).map(function (x) { return /'([^']+)'/.exec(x)[1]; });
  var enCadena = {}; scripts.forEach(function (n) { enCadena[n.id] = 1; });
  var sinSkill = docs.filter(function (id) { return !enCadena[id]; });
  ataque('A1 · un script de ejecución del corte corre sin pertenecer a ningún skill', sinSkill.length > 0,
    sinSkill.length ? 'huérfanos: ' + sinSkill.join(' · ') : 'los ' + docs.length + ' scripts documentados están en un skill');
})();

// ── A2 · ¿el orquestador de verdad lee la cadena? Se le rompe el JSON y tiene que negarse. ──
(function () {
  var ruta = BACK + '/_contratos/cadena-skills.json';
  var bueno = fs.readFileSync(ruta, 'utf8');
  fs.writeFileSync(ruta, '{ "etapas": [], "skills": [], "dirige": "x" }');
  var r;
  try { r = cp.execSync('"' + process.execPath + '" "' + D + '/orquestador.orquestador.js"', { cwd: D, encoding: 'utf8', timeout: 120000 }); }
  catch (e) { r = String(e.stdout || '') + String(e.stderr || ''); }
  fs.writeFileSync(ruta, bueno);
  var seNego = /NO COINCIDE|sin skill en la cadena|Regenérala/.test(r);
  ataque('A2 · el orquestador ignora la cadena declarada y corre igual', !seNego,
    seNego ? 'con la cadena vacía se NIEGA a correr — la lee de verdad'
           : '🔴 corrió con la cadena vacía: entonces la cadena es decorativa');
})();

// ── A3 · el guard de huérfano, ¿bloquea o solo avisa? ─────────────────────────────────
(function () {
  var ruta = D + '/orquestador.cadena-skills.js';
  var bueno = fs.readFileSync(ruta, 'utf8');
  // se le quita el dueño a motor-calculo y tiene que negarse a escribir la cadena
  // 🔴 La llave va ENTRECOMILLADA desde el desanclaje: el id nuevo lleva guion (`motor-calculo`) y
  //    sin comillas no es un identificador válido en JS. El ataque buscaba la forma vieja y no
  //    pudo montarse — y «no pude montar el ataque» cuenta como ataque exitoso, a propósito:
  //    un refutador que no logra atacar no está probando nada.
  var roto = bueno.replace(/\n\s*'motor-calculo':\s*\{ skill:[^\n]*\n/, '\n');
  if (roto === bueno) { ataque('A3 · no se pudo montar el ataque (no encontré la entrada de motor-calculo)', true, 'el ataque no se pudo ejecutar: eso ya es un hallazgo'); return; }
  fs.writeFileSync(ruta, roto);
  var salida = '', codigo = 0;
  try { salida = cp.execSync('"' + process.execPath + '" "' + ruta + '"', { cwd: D, encoding: 'utf8', timeout: 120000 }); }
  catch (e) { salida = String(e.stdout || ''); codigo = e.status || 1; }
  fs.writeFileSync(ruta, bueno);
  var bloqueo = codigo !== 0 && /SCRIPTS SIN SKILL/.test(salida);
  ataque('A3 · el guard de script huérfano no bloquea, solo avisa', !bloqueo,
    bloqueo ? 'quitándole el dueño a motor-calculo, sale exit ' + codigo + ' y nombra el huérfano'
            : '🔴 no bloqueó: un script puede quedar fuera de la cadena en silencio');
})();

// ── A4 · el orden de la cadena vs el orden real ───────────────────────────────────────
(function () {
  var src = fs.readFileSync(D + '/orquestador.orquestador.js', 'utf8');
  var m = /SCRIPTS\s*=\s*\[([\s\S]*?)\n\];/.exec(src);
  var docs = (m ? (m[1].match(/id:\s*'([^']+)'/g) || []) : []).map(function (x) { return /'([^']+)'/.exec(x)[1]; });
  var enCadena = scripts.map(function (n) { return n.id; });
  var igual = docs.join('>') === enCadena.join('>');
  var dif = igual ? '' : docs.filter(function (x, i) { return enCadena[i] !== x; }).slice(0, 4).join(' · ');
  ataque('A4 · agrupar por skill REORDENÓ la ejecución', !igual,
    igual ? 'el orden de la cadena es idéntico al orden real, script por script'
          : '🔴 difieren en: ' + dif);
})();

// ── A5 · ¿los skills existen de verdad? ───────────────────────────────────────────────
(function () {
  var malos = [];
  C.skills.forEach(function (s) {
    var p = path.join(SKDIR, s.id, 'SKILL.md');
    if (!fs.existsSync(p)) { malos.push(s.id + ' (no existe)'); return; }
    var txt = fs.readFileSync(p, 'utf8');
    if (txt.length < 800) { malos.push(s.id + ' (' + txt.length + ' bytes: es un cascarón)'); return; }
    if (!/^---\s*\nname:/.test(txt)) { malos.push(s.id + ' (sin frontmatter)'); return; }
    if (txt.indexOf('<!-- FUNDACION:INICIO -->') < 0) malos.push(s.id + ' (sin la FUNDACIÓN: puede reimplementar la quincena o la llave)');
  });
  ataque('A5 · hay skills que son cascarones vacíos', malos.length > 0,
    malos.length ? '🔴 ' + malos.join(' · ') : 'los ' + C.skills.length + ' tienen SKILL.md con frontmatter y fundación');
})();

// ── A6 · el HTML vs la cadena ─────────────────────────────────────────────────────────
(function () {
  // 🔴 SE MIRA EL MAPA GENERADO, NO EL ESCRITO A MANO. Este ataque apuntaba a
  //    `cadena-skills-nestle.html`, un mapa hecho a mano el 24-ago, y prosperó en cuanto la cadena
  //    creció a 17 etapas: el HTML seguía enseñando 15. No mentía por descuido — mentía porque era
  //    una COPIA, y una copia se desfasa en cuanto la fuente cambia.
  //    El mapa vivo es `mapa-cadena-skills.html`, que `orquestador.mapa-skills.js` emite desde
  //    `cadena-skills.json` entre marcas. Divergir ya no es posible: se regenera.
  //    ⚠ El de 24-ago sigue en disco como histórico; si estorba, lo decide Rick — no se borra un
  //      archivo de la carpeta del proyecto por cuenta propia.
  var f = PROY + '/_orquesta/mapa-cadena-skills.html';
  if (!fs.existsSync(f)) { ataque('A6 · el mapa no existe', true, 'córrelo: node orquestador.mapa-skills.js --escribir'); return; }
  var html = fs.readFileSync(f, 'utf8');
  // el mapa numera las etapas en la espina (`<div class="num">07</div>`) y las nombra al lado
  var faltan = C.etapas.filter(function (e) {
    var n = String(e.orden).padStart(2, '0');
    return html.indexOf('<div class="num">' + n + '</div>') < 0;
  }).map(function (e) { return e.orden + '·' + e.skill; });
  ataque('A6 · el HTML y la cadena ya divergieron', faltan.length > 0,
    faltan.length ? '🔴 el HTML no muestra: ' + faltan.join(' · ') : 'las ' + C.etapas.length + ' etapas están en el HTML, en su orden');
})();

// ── A7 · 🔴 ¿queda otro camino que corra scripts saltándose la cadena? ──────────────────
(function () {
  // 🔴 EL DETECTOR TIENE QUE MEDIR LO QUE DICE MEDIR. La primera versión contaba «3+ scripts con
  //    pinta de paso» y señalaba a `revalidar-todo` y a dos scripts de la serie E — que encadenan
  //    VALIDADORES, no scripts de ejecución del corte. Un detector que señala trabajo correcto entrena a ignorar
  //    al detector. Lo que de verdad viola la regla es un script que **ejecuta los scripts de la
  //    cadena**: eso es un segundo runner del corte, y produce un resultado distinto al de la cadena.
  var deLaCadena = {}; scripts.forEach(function (n) { deLaCadena[n.script] = n.id; });
  var sospechosos = fs.readdirSync(D).filter(function (f) {
    if (!/\.js$/.test(f) || f === 'orquestador.orquestador.js' || f === 'orquestador.cadena-skills.js' || f === 'orquestador.refutar-cadena.js') return false;
    var txt = fs.readFileSync(D + '/' + f, 'utf8');
    if (!/exec(Sync|File)|spawn/.test(txt)) return false;
    // 🔴 LA EXENCIÓN VIVE EN EL ARCHIVO EXENTO, CON SU RAZÓN — no en una lista dentro del detector.
    //    Una lista de nombres aquí envejece sin que nadie la mire y acaba tapando lo que debía
    //    encontrar. Con el marcador, quien exime tiene que escribir POR QUÉ, y se lee al abrir el
    //    archivo. Hoy lo llevan `revalidar-todo` (corre validadores, no el corte) y `E5` (script de
    //    migración ya aplicado).
    if (/^\/\/\s*NO-ES-RUNNER:/m.test(txt)) return false;
    var corre = Object.keys(deLaCadena).filter(function (s) { return txt.indexOf(s) >= 0; });
    return corre.length >= 2;
  }).map(function (f) {
    var txt = fs.readFileSync(D + '/' + f, 'utf8');
    return f + ' [' + Object.keys(deLaCadena).filter(function (s) { return txt.indexOf(s) >= 0; })
      .map(function (s) { return deLaCadena[s]; }).join(',') + ']';
  });
  ataque('A7 · queda un camino que encadena scripts SIN pasar por la cadena de skills', sospechosos.length > 0,
    sospechosos.length ? '🔴 ' + sospechosos.join(' · ') + ' — encadenan scripts por su cuenta'
                       : 'ningún otro script encadena scripts: el único runner es el orquestador');
})();

// ── A8 · scripts declarados que no existen ──────────────────────────────────────────────
(function () {
  var faltan = scripts.filter(function (n) { return !fs.existsSync(D + '/' + n.script); })
    .map(function (n) { return n.id + '→' + n.script; });
  var suitesFaltan = [];
  scripts.forEach(function (n) {
    (n.suites || []).forEach(function (s) { if (!fs.existsSync(D + '/' + s)) suitesFaltan.push(n.id + '→' + s); });
  });
  ataque('A8 · la cadena declara scripts o suites que no existen en disco', faltan.length + suitesFaltan.length > 0,
    (faltan.length || suitesFaltan.length)
      ? '🔴 scripts: ' + (faltan.join(' · ') || '—') + '  ·  suites: ' + (suitesFaltan.join(' · ') || '—')
      : 'los ' + scripts.length + ' scripts y sus ' + scripts.reduce(function (a, n) { return a + (n.suites || []).length; }, 0) + ' suites existen');
})();

// ── veredicto ─────────────────────────────────────────────────────────────────────────
console.log('  ── ATAQUES QUE NO PROSPERARON ──────────────────────────────────────────');
ok.forEach(function (a) { console.log('   ✔ ' + a.nombre.padEnd(62) + a.detalle); });
if (rotos.length) {
  console.log('\n  ── 🔴 ATAQUES CON ÉXITO — la migración NO es lo que dice ser ───────────');
  rotos.forEach(function (a) { console.log('   🔴 ' + a.nombre + '\n      ' + a.detalle); });
}
console.log('\n════════ ' + (rotos.length
  ? '🔴 ' + rotos.length + ' ATAQUE(S) PROSPERARON'
  : '✅ NINGÚN ATAQUE ROMPIÓ LA CADENA DE SKILLS — ' + ok.length + ' intentos') + ' ════════');
process.exit(rotos.length ? 1 : 0);
