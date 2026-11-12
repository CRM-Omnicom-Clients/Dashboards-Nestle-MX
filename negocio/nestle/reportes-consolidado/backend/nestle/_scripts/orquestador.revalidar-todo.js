var ENT = require(__dirname + '/lib-entorno.js');
// NO-ES-RUNNER: corre la bateria de VALIDADORES contra el workbook ya escrito, no produce el corte.
//   No escribe nada. Su unico efecto es decir que resiste y que no.
//
// REVALIDACIÓN COMPLETA — corre toda la batería y resume.
// No interpreta: reporta el código de salida y las líneas de veredicto de cada script.
//
// 🔴 LA LISTA SE DESCUBRE, YA NO SE CLAVA. Tenía los 32 validadores escritos a mano, agrupados por
//    paso. Dos consecuencias, y las dos se pagaron:
//      · un validador nuevo no entraba a la batería hasta que alguien se acordara de añadirlo aquí
//      · y esta lista **inmovilizaba los archivos**: la fase 3 de la migración no podía colocar 32
//        adversariales bajo su skill porque este script los nombraba por su nombre plano.
//    Ahora sale del censo (`_contratos/orquestador.censo-scripts.json`) y de la cadena: quien clasifica manda, y
//    mover un archivo deja de romper a quien lo invoca porque la ruta se resuelve al vuelo.
var cp = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var DIR = BACK + '/_scripts';

// 🔴 RESOLVER LA RUTA, NO SUPONERLA. Tras la migración un script puede estar en la raíz, en
//    `_adversarial/<skill>/` o en `_herramientas/<skill>/`. Se busca; si no aparece, se dice.
function resolver(nombre) {
  var cand = [path.join(DIR, nombre)];
  ['_adversarial', '_herramientas'].forEach(function (base) {
    var b = path.join(DIR, base);
    if (!fs.existsSync(b)) return;
    fs.readdirSync(b).forEach(function (skill) {
      var p = path.join(b, skill, nombre);
      if (fs.existsSync(p)) cand.push(p);
    });
  });
  return cand.filter(function (p) { return fs.existsSync(p); })[0] || null;
}

// ── qué se corre: los ADVERSARIAL del censo + las suites que declara la cadena
var grupos = [];
try {
  var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
  var porSkill = {};
  (censo.clases.ADVERSARIAL || []).forEach(function (x) {
    var s = String(x.skill || 'sin-skill').replace(ENT.PREFIJO_SKILL, '');
    (porSkill[s] = porSkill[s] || []).push(x.f);
  });
  Object.keys(porSkill).sort().forEach(function (s) { grupos.push(['adversarial · ' + s, porSkill[s].sort()]); });
} catch (e) { console.log('  ⚠ sin censo: corre S1/censo-scripts primero'); }

try {
  var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
  var suites = [];
  C.etapas.forEach(function (e) { e.scripts.forEach(function (n) {
    (n.suites || []).forEach(function (s) { suites.push(s); });
  }); });
  if (suites.length) grupos.push(['suites de la cadena', suites]);
} catch (e) { }

console.log('════════ REVALIDACIÓN COMPLETA ════════');
console.log('  la batería sale del censo y de la cadena — no de una lista escrita a mano\n');

var total = 0, rojos = 0, ausentes = [];
grupos.forEach(function (grupo) {
  console.log('\n════════════════ ' + grupo[0] + ' ════════════════');
  grupo[1].forEach(function (s) {
    var ruta = resolver(s);
    if (!ruta) { ausentes.push(s); console.log('   ‹no existe› ' + s); return; }
    total++;
    var salida = '', codigo = 0;
    try { salida = cp.execSync('"' + process.execPath + '" "' + ruta + '"', { cwd: DIR, encoding: 'utf8', timeout: 300000 }); }
    catch (e) { salida = String(e.stdout || '') + String(e.stderr || ''); codigo = e.status === undefined ? 99 : e.status; }
    if (codigo !== 0) rojos++;
    var lineas = salida.split('\n').map(function (x) { return x.replace(/\s+$/, ''); }).filter(Boolean);
    var ver = lineas.filter(function (x) { return /✅|🔴|⛔|VEREDICTO|PUERTA|resiste ninguno/.test(x); });
    var ult = ver.length ? ver[ver.length - 1].trim() : (lineas[lineas.length - 1] || '(sin salida)').trim();
    var conRojo = lineas.filter(function (x) { return /^\s*🔴/.test(x); }).length;
    console.log('   ' + (codigo === 0 ? '✔' : '🔴') + ' ' + s.replace('.js', '').padEnd(28) +
      (conRojo ? '(' + conRojo + ' rojo) ' : '') + ult.slice(0, 92));
  });
});
console.log('\n════════════════════════════════════════════');
console.log('  suites corridas: ' + total + '   ·   con salida roja: ' + rojos);
if (ausentes.length) console.log('  no existen: ' + ausentes.join(' · '));
console.log('  ' + (rojos ? '🔴 hay ' + rojos + ' suite(s) en rojo — ver arriba' : '✅ TODA LA BATERÍA EN VERDE'));
