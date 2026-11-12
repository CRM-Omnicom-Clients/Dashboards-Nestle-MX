/*
 * orquestador.probar-copiador.js — ¿el copiador hace lo que dice, o solo no truena?
 *
 * 🔴 EL COPIADOR ESCRIBE EN LA CARPETA DE UN CLIENTE Y NO TENÍA NI UN SEÑUELO. Ya lleva tres
 *    defectos reales, los tres encontrados por accidente y no por una prueba:
 *      · clasificó `_fuentes/` como salida regenerable → la copia perdió 2,356 carritos de
 *        marzo-julio y PUERTA 2 cerró
 *      · añadía pero no retiraba → dejó 25 carpetas de skill donde hay 13
 *      · dejó 27 archivos y 15.8 MB de copias temporales del libro en la carpeta del cliente
 *    Un script con ese historial, que además borra cosas, tiene que probarse.
 *
 * 🔴 TODO OCURRE EN UN DESTINO DE MENTIRA, bajo el temp del sistema. No se toca ni el origen ni la
 *    carpeta del cliente. Y se comprueban las dos direcciones: que copie lo que debe, y que NO
 *    borre lo que no es suyo.
 *
 *   node orquestador.probar-copiador.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var ENT = require(__dirname + '/lib-entorno.js');
var COPIADOR = path.join(__dirname, 'orquestador.llevar-a-carpeta.js');
var TMP = path.join(os.tmpdir(), 'probar-copiador-' + process.pid);

var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

function correr() {
  var r = cp.spawnSync(process.execPath, [COPIADOR, '--destino', TMP, '--escribir'], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
var RAIZ = path.join(TMP, 'Sistema-Reportes-CRM');

console.log('════ ¿EL COPIADOR HACE LO QUE DICE? ════\n');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// ── 1 · la copia limpia
var r1 = correr();
chk('copia sin fallar a un destino vacío', r1.code === 0, (r1.out.match(/✅[^\n]*/) || ['🔴 no dijo ✅'])[0].slice(0, 56));

// 🔴 los BLOQUES tienen que viajar: no hacerlo costó 2,356 carritos
var qc = path.join(RAIZ, '_fuentes', 'qcart.json');
var carritos = 0;
try { carritos = JSON.parse(fs.readFileSync(qc, 'utf8')).carritos.length; } catch (e) { }
chk('🔴 lleva `_fuentes/qcart.json` CON su historia acumulada', carritos > 3000,
  carritos ? carritos + ' carritos (las descargas vigentes solo cubren ~430: el resto es historia)' : '🔴 no llegó — marzo-julio se perderían');

// las 26 declaraciones de escritura: sin ellas la guarda 5 bloquea y el sistema no arranca
var decl = 0;
try { decl = fs.readdirSync(path.join(RAIZ, '_preescritura')).filter(function (f) { return /^DECL-/.test(f); }).length; } catch (e) { }
chk('🔴 lleva las DECL-*.json (sin ellas la guarda 5 bloquea)', decl >= 20, decl + ' declaraciones');

// el LEEME: sin él esto es una carpeta con 257 scripts
chk('lleva el LEEME.md', fs.existsSync(path.join(RAIZ, 'LEEME.md')), 'por donde se empieza');

// lo que NO debe viajar
chk('NO lleva node_modules (236 MB · se instala)', !fs.existsSync(path.join(RAIZ, 'tools', 'node_modules')), 'se instala con npm');
var respaldos = 0;
try { respaldos = fs.readdirSync(path.join(RAIZ, '_respaldos')).length; } catch (e) { }
chk('NO lleva los respaldos (son copias del libro del CLIENTE)', respaldos === 0, respaldos + ' archivo(s)');

// ── 2 · la copia resuelve HACIA SÍ MISMA, no hacia el origen
var r2 = cp.spawnSync(process.execPath, ['-e',
  'var E=require(process.argv[1]+"/_scripts/lib-entorno.js");console.log(E.BACKEND)'], { encoding: 'utf8', input: '' });
var r2b = cp.spawnSync(process.execPath, ['-e',
  'var E=require(process.argv[1]+"/_scripts/lib-entorno.js");console.log(E.BACKEND)', RAIZ], { encoding: 'utf8' });
var propio = String(r2b.stdout || '').trim();
chk('🔴 la copia resuelve SU backend, no el del origen', propio.indexOf(RAIZ.slice(0, 20)) >= 0 || propio.indexOf('Sistema-Reportes-CRM') >= 0,
  propio ? propio.slice(-54) : '🔴 no respondió');

// ── 3 · RETIRA lo que ya no existe… pero SOLO lo suyo
var intruso = path.join(RAIZ, 'skills', 'skill-de-otro-equipo');
fs.mkdirSync(intruso, { recursive: true });
fs.writeFileSync(path.join(intruso, 'SKILL.md'), 'no es del sistema');
var viejo = path.join(RAIZ, 'skills', 'rick-reportes-escritor');   // prefijo de la historia del contrato
fs.mkdirSync(viejo, { recursive: true });
fs.writeFileSync(path.join(viejo, 'SKILL.md'), 'prefijo viejo');
var ajeno = path.join(TMP, 'Archivo-del-cliente.xlsx');
fs.writeFileSync(ajeno, 'esto es del cliente');

var r3 = correr();
chk('🔴 retira la carpeta con el prefijo VIEJO', !fs.existsSync(viejo), 'o quedarían dos versiones del mismo skill');
chk('🔴 NO toca un skill que no es del sistema', fs.existsSync(intruso), 'borrar «lo que no reconozco» destruye trabajo ajeno');
chk('🔴 NO toca nada FUERA de su subcarpeta', fs.existsSync(ajeno) && fs.readFileSync(ajeno, 'utf8') === 'esto es del cliente',
  'el destino es una carpeta compartida con el cliente');

// ── 4 · vacía su `_tmp` (15.8 MB de copias del libro acabaron en la carpeta del cliente)
fs.writeFileSync(path.join(RAIZ, '_tmp', '_basura.xlsx'), 'temporal de una corrida');
var r4 = correr();
chk('🔴 vacía su `_tmp` en cada sincronización', !fs.existsSync(path.join(RAIZ, '_tmp', '_basura.xlsx')),
  'eran copias del libro del cliente tiradas en su carpeta');

// ── 5 · comprueba el contenido, no solo que copió
chk('comprueba archivo por archivo (sha1), no «lo copié»', /idénticos al origen/.test(r4.out),
  (r4.out.match(/✔ los \d+ son idénticos[^\n]*/) || ['🔴 no lo dice'])[0].slice(0, 46));

fs.rmSync(TMP, { recursive: true, force: true });

console.log('════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(56) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' comprobación(es) fallan — el copiador no hace lo que dice'
  : '✅ EL COPIADOR HACE LO QUE DICE — ' + V.length + ' comprobaciones, en un destino de mentira'));
process.exit(fallo ? 1 : 0);
