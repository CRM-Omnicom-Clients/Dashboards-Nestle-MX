// PUNTO DE ENTRADA ÚNICO de la validación del catálogo Nestlé.
//
//   node ~/.claude/reportes-backend/nestle/validar-catalogo.js
//
// 🔴 POR QUÉ EXISTE (Rick, 17-ago): el refutador no puede depender de que yo me acuerde de
//    correrlo. Las 5 suites daban el catálogo por bueno y estaba mal en 4 cosas — porque
//    comparaban el catálogo CONSIGO MISMO. El refutador es el único que ataca contra las
//    FUENTES, y por eso es el único que encuentra lo que las demás dan por bueno.
//    Aquí corre SIEMPRE, y su resultado sale en el veredicto final, no enterrado.
//
// REGLA DE LECTURA:
//   🟢 INDEPENDIENTE = se contrasta contra una fuente que el catálogo NO escribe
//                      (documento maestro de Hive · Data_Email · Data_Qcart · Datorama)
//   ⚪ COHERENCIA    = el catálogo contra sí mismo. Necesario, pero NO prueba correctitud:
//                      si el generador está mal, los dos lados están mal igual y sale verde.
var cp = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
var DIR = path.join(os.homedir(), '.claude/reportes-backend/nestle/_scripts');
var NODE = process.execPath;

var SUITES = [
  { f: 'Z-final.js', nom: 'cierre del catálogo', tipo: 'mixta', ok: /✅ CATÁLOGO CERRADO/, res: /✅ CATÁLOGO CERRADO · \d+ validaciones|🔴 \d+ FALLIDA\(S\)/ },
  { f: 'catalogo.prueba-uso.js', nom: 'capacidad de uso', tipo: '🟢', ok: /✅/, res: /✅ el catálogo resuelve[^\n]*|🔴 \d+ capacidad[^\n]*/ },
  { f: 'catalogo.prueba-crecer2.js', nom: 'crecimiento sin romper', tipo: '⚪', ok: /✅/, res: /✅ el catálogo aguanta[^\n]*|🔴 \d+ problema[^\n]*/ },
  { f: 'catalogo.prueba-alias.js', nom: 'escalera de alias', tipo: '⚪', ok: /✅/, res: /✅ la escalera[^\n]*|🔴 \d+ problema[^\n]*/ },
  { f: 'catalogo.prueba-anclas.js', nom: 'anclas JSON ↔ Excel', tipo: '⚪', ok: /✅/, res: /✅ las anclas[^\n]*|🔴 \d+ ancla[^\n]*/ },
  { f: 'catalogo.refutar.js', nom: 'REFUTADOR · ataca las fuentes', tipo: '🟢', ok: /✅ ningún ataque/, res: /✅ ningún ataque[^\n]*|🔴 \d+ ataque[^\n]*/ }
];

console.log('════════ VALIDACIÓN DEL CATÁLOGO NESTLÉ ════════\n');
var fallos = [], salidas = {};
SUITES.forEach(function (s) {
  var p = path.join(DIR, s.f);
  if (!fs.existsSync(p)) { console.log('  ⛔ ' + s.nom.padEnd(32) + 'FALTA ' + s.f); fallos.push(s.nom); return; }
  var out = '';
  try { out = cp.execSync('"' + NODE + '" "' + p + '"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 40 * 1024 * 1024 }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  salidas[s.f] = out;
  var m = out.match(s.res);
  var bien = s.ok.test(out);
  if (!bien) fallos.push(s.nom);
  console.log('  ' + (bien ? '✔' : '🔴') + ' ' + s.tipo + ' ' + s.nom.padEnd(32) + (m ? m[0] : '(sin veredicto legible)').slice(0, 76));
});

// el detalle del refutador SIEMPRE se imprime: es el que encuentra lo que los demás no ven
console.log('\n──── detalle del REFUTADOR (el único que compara contra las fuentes) ────');
var rf = salidas['catalogo.refutar.js'] || '';
var ver = rf.slice(rf.indexOf('VEREDICTO'));
(ver ? ver.split('\n') : ['(no corrió)']).forEach(function (l) { if (/✔|🔴|✅/.test(l)) console.log('  ' + l.trim().slice(0, 120)); });

console.log('\n════════ ' + (fallos.length
  ? '🔴 ' + fallos.length + ' SUITE(S) EN ROJO: ' + fallos.join(' · ') + '\n  NO declares nada cerrado.'
  : '✅ CATÁLOGO VALIDADO — 8 suites: 5 de forma, refutador, y 2 que prueban que el paso siguiente puede usarlo') + ' ════════');
process.exit(fallos.length ? 1 : 0);
