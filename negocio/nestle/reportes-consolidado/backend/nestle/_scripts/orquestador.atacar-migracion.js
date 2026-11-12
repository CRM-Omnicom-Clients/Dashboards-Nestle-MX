/*
 * orquestador.atacar-migracion.js — INTENTAR ROMPER la migración, no confirmar que funciona.
 *
 * 🔴 LA DIFERENCIA ESTÁ EN LA PREGUNTA. Todo lo que corrí hasta ahora pregunta «¿funciona?», y a
 *    eso un sistema roto puede contestar que sí: el corte corrió en verde desde la carpeta nueva
 *    con 2,356 carritos perdidos, y las dos puertas abrieron. Aquí la pregunta es otra: **¿qué pasa
 *    cuando le quito algo?** Un sistema portable no es el que funciona con todo en su sitio — es el
 *    que, cuando falta algo, **dice QUÉ falta y QUÉ hacer**, en vez de concluir «no hay datos».
 *
 * 🔴 EL MODO DE FALLO QUE SE PERSIGUE ES EL SILENCIOSO. En este sistema una ruta mala no truena:
 *    `existsSync` da `false` y el paso concluye que no hay nada que cargar. Eso ya costó Marzo-Mayo
 *    descartados en silencio, 1 de 113 envíos resueltos, y 6,471 clicks fuera del reporte. Así que
 *    un ataque «pasa» solo si el sistema **se niega a seguir y lo explica**; si sigue adelante con
 *    menos datos, el ataque GANA.
 *
 * 🔴 NADA DE ESTO TOCA EL SISTEMA REAL. Cada ataque se monta sobre una copia del backend en el
 *    temp, se le quita o se le estropea una pieza, y se corre desde ahí. Ni el libro del cliente ni
 *    `~/.claude` se abren para escribir en ningún momento.
 *
 *   node orquestador.atacar-migracion.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var ENT = require(__dirname + '/lib-entorno.js');
var ORIGEN = path.resolve(__dirname, '..');
var TMP = path.join(os.tmpdir(), 'atacar-migracion-' + process.pid);

var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

/* se monta un backend de mentira: los scripts y los contratos, que es lo que decide. Las carpetas
 * de datos se enlazan por copia solo donde el ataque las necesita. */
function montar(nombre) {
  var d = path.join(TMP, nombre);
  fs.rmSync(d, { recursive: true, force: true });
  ['_scripts', '_contratos', '_catalogo', '_fuentes', '_insumos', '_tmp', '_preescritura', '_rejilla'].forEach(function (s) {
    fs.mkdirSync(path.join(d, s), { recursive: true });
  });
  ['_scripts', '_contratos', '_catalogo'].forEach(function (s) {
    fs.readdirSync(path.join(ORIGEN, s)).forEach(function (f) {
      var o = path.join(ORIGEN, s, f);
      try { if (fs.statSync(o).isDirectory()) return; } catch (e) { return; }
      fs.copyFileSync(o, path.join(d, s, f));
    });
  });
  return d;
}
function corre(back, script, args) {
  var r = cp.spawnSync(process.execPath, [path.join(back, '_scripts', script)].concat(args || []),
    { encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
/* un ataque PASA si el sistema se niega Y explica. Que truene con un stack de Node no cuenta:
 * un `TypeError` no le dice a nadie qué traer. */
function seNiegaYExplica(r, pista) {
  var salio = r.code !== 0;
  var explica = pista.test(r.out);
  var stackPelado = /at Object\.<anonymous>|TypeError:|ReferenceError:/.test(r.out) && !explica;
  return { ok: salio && explica && !stackPelado, por: !salio ? 'siguió adelante' : !explica ? 'falló sin explicar' : stackPelado ? 'solo un stack de Node' : 'ok' };
}

console.log('════ ATACAR LA MIGRACIÓN · ¿se niega y lo explica, o sigue con menos datos? ════\n');
fs.mkdirSync(TMP, { recursive: true });

// ── A1 · OTRA MÁQUINA: el home no tiene nada de esto
console.log('── A1 · otra máquina (un HOME donde el proyecto no existe)');
var b1 = montar('a1-otro-home');
var homeFalso = path.join(TMP, 'home-vacio');
fs.mkdirSync(homeFalso, { recursive: true });
var r1 = (function () {
  var r = cp.spawnSync(process.execPath, [path.join(b1, '_scripts', 'orquestador.probar-entorno.js')],
    { encoding: 'utf8', timeout: 120000, env: Object.assign({}, process.env, { USERPROFILE: homeFalso, HOME: homeFalso, HOMEPATH: homeFalso }) });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
})();
var v1 = seNiegaYExplica(r1, /no encontr|NO existe|ENTORNO|compartid|sincronice/i);
chk('A1 · en otra máquina DICE qué carpeta falta y qué pedir', v1.ok, v1.ok
  ? (r1.out.match(/no encontré[^\n]*/i) || r1.out.match(/🔴[^\n]*/) || [''])[0].slice(0, 62)
  : '🔴 ' + v1.por);

// ── A2 · FALTA UNA FUENTE: el maestro de Qcart no está
console.log('── A2 · falta una fuente (el maestro de Qcart)');
var b2 = montar('a2-sin-fuente');
(function () {
  var p = path.join(b2, '_contratos', 'entorno.json');
  var J = JSON.parse(fs.readFileSync(p, 'utf8'));
  J.fuentes.qcart_maestro.ruta = 'ReportesQcart/NO-EXISTE-ESTE-ARCHIVO.xlsx';
  fs.writeFileSync(p, JSON.stringify(J, null, 1));
})();
var r2 = corre(b2, 'orquestador.probar-entorno.js');
var v2 = seNiegaYExplica(r2, /qcart_maestro|no está en|si_falta|atribuir/i);
chk('A2 · nombra la fuente que falta y para qué servía', v2.ok, v2.ok
  ? (r2.out.match(/🔴 *qcart_maestro[^\n]*/) || r2.out.match(/no está en[^\n]*/) || [''])[0].slice(0, 62) : '🔴 ' + v2.por);

// ── A3 · EL CONTRATO NO ESTÁ
console.log('── A3 · el contrato de rutas no está');
var b3 = montar('a3-sin-contrato');
fs.unlinkSync(path.join(b3, '_contratos', 'entorno.json'));
var r3 = corre(b3, 'orquestador.guardas.js');
var v3 = seNiegaYExplica(r3, /entorno\.json|no pude leer|declara dónde/i);
chk('A3 · sin el contrato se niega y dice cuál es', v3.ok, v3.ok
  ? (r3.out.match(/entorno\.json[^\n]*/) || [''])[0].slice(0, 62) : '🔴 ' + v3.por);

// ── A4 · EL LIBRO SE RENOMBRÓ
console.log('── A4 · alguien renombró el libro vivo');
var b4 = montar('a4-libro-renombrado');
(function () {
  var p = path.join(b4, '_contratos', 'entorno.json');
  var J = JSON.parse(fs.readFileSync(p, 'utf8'));
  J.libro_vivo = '(Interno)-Reporte-Consolidado-Nestle-2026-v99.xlsx';
  fs.writeFileSync(p, JSON.stringify(J, null, 1));
})();
var r4 = corre(b4, 'orquestador.probar-entorno.js');
var v4 = seNiegaYExplica(r4, /libro vivo|no está donde|libro_vivo|renombr/i);
chk('A4 · con el libro renombrado NO busca otro parecido', v4.ok, v4.ok
  ? 'dice que corrija `libro_vivo` en el contrato' : '🔴 ' + v4.por);

// ── A5 · SIN node_modules
console.log('── A5 · sin node_modules (la copia recién traída)');
/* 🔴 MI PRIMER ATAQUE A5 ESTABA MAL CONSTRUIDO, y el resultado fue un «ataque ganó» falso. Fijé
 *    `raices.node_modules.ruta` a una carpeta inexistente y di por hecho que eso quitaba los
 *    paquetes — pero `nodeModules()` prueba candidatos y gana el primero que EXISTA, así que cayó
 *    al de `~/.claude/tools` y encontró `xlsx` igual. O sea: no ataqué nada y lo apunté como
 *    derrota del sistema. Un ataque que no quita la pieza no prueba nada en ninguna dirección.
 *    El ataque de verdad es un HOME donde no hay ningún candidato. */
var b5 = montar('a5-sin-paquetes');
var homeSinNada = path.join(TMP, 'home-sin-paquetes');
fs.mkdirSync(homeSinNada, { recursive: true });
var r5 = (function () {
  var r = cp.spawnSync(process.execPath, [path.join(b5, '_scripts', 'orquestador.guardian-hojas-vs-bloques.js')], {
    encoding: 'utf8', timeout: 120000,
    env: Object.assign({}, process.env, { USERPROFILE: homeSinNada, HOME: homeSinNada, HOMEDRIVE: '', HOMEPATH: '', NODE_PATH: '' })
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
})();
chk('A5 · sin paquetes el error nombra el módulo que falta',
  r5.code !== 0 && (/Cannot find module/.test(r5.out) || /ENTORNO/.test(r5.out)),
  r5.code !== 0 ? (r5.out.match(/Cannot find module '[^']*'/) || r5.out.match(/🔴 ENTORNO[^\n]*/) || [''])[0].slice(0, 58)
    : '🔴 siguió adelante sin xlsx');

// ── A6 · CONTAMINACIÓN CRUZADA: ¿el backend de mentira escribe en el de Rick?
console.log('── A6 · contaminación cruzada (¿escribe en el backend de Rick?)');
var b6 = montar('a6-cruzada');
var marcaOrigen = path.join(ORIGEN, '_preescritura', 'deriva-copia.json');
var antesSha = (function () { try { return require('crypto').createHash('sha1').update(fs.readFileSync(marcaOrigen)).digest('hex'); } catch (e) { return null; } })();
corre(b6, 'orquestador.guardian-hojas-vs-bloques.js');
corre(b6, 'orquestador.probar-renombre.js');
var despuesSha = (function () { try { return require('crypto').createHash('sha1').update(fs.readFileSync(marcaOrigen)).digest('hex'); } catch (e) { return null; } })();
chk('A6 · 🔴 un backend de mentira NO escribe en el de Rick', antesSha === despuesSha,
  antesSha === despuesSha ? 'el origen quedó intacto (sha1 igual)' : '🔴 ESCRIBIÓ EN EL ORIGEN');

// ── A7 · UNA RUTA ESCRITA VUELVE AL CÓDIGO
console.log('── A7 · alguien vuelve a escribir una ruta en un script del corte');
var b7 = montar('a7-ruta-escrita');
(function () {
  var C = JSON.parse(fs.readFileSync(path.join(b7, '_contratos', 'cadena-skills.json'), 'utf8'));
  var victima = null;
  (C.etapas || []).forEach(function (e) { (e.scripts || []).forEach(function (s) { if (!victima) victima = s.script; }); });
  var p = path.join(b7, '_scripts', victima);
  fs.writeFileSync(p, "var P = require('os').homedir() + '/.claude/reportes-backend/nestle';\n");
})();
var r7 = corre(b7, 'orquestador.guardas.js');
chk('A7 · la guarda 7 BLOQUEA una ruta escrita en el corte', r7.code !== 0 && /BLOQUEA/.test(r7.out),
  r7.code !== 0 ? (r7.out.match(/🔴 BLOQUEA[^\n]*/) || [''])[0].slice(0, 58) : '🔴 dejó pasar la ruta escrita');

// ── A8 · UN BLOQUE VACÍO: ¿lo nota, o lo lee como «no hay datos»?
console.log('── A8 · un bloque llega vacío (el modo de fallo clásico)');
var b8 = montar('a8-bloque-vacio');
['email.json', 'whatsapp.json', 'qcart.json'].forEach(function (f) {
  var o = path.join(ORIGEN, '_fuentes', f);
  if (fs.existsSync(o)) fs.copyFileSync(o, path.join(b8, '_fuentes', f));
});
(function () {
  var p = path.join(b8, '_fuentes', 'qcart.json');
  var J = JSON.parse(fs.readFileSync(p, 'utf8'));
  J.carritos = [];   // el bloque dice que no hay carritos
  fs.writeFileSync(p, JSON.stringify(J));
})();
// la hoja del libro sí tiene 3,198: el guardián de D1 tiene que ver que el bloque se quedó corto
var r8 = corre(b8, 'orquestador.guardian-hojas-vs-bloques.js');
chk('A8 · un bloque vacío NO pasa por «no hay datos»',
  /sobran en la hoja|FILAS DE LA HOJA QUE EL BLOQUE/.test(r8.out) && /3,198|3198/.test(r8.out),
  /sobran/.test(r8.out) ? 'lo reporta como 3,198 filas que el bloque ya no trae' : '🔴 no dijo nada del hueco');

fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(58) + (v[2] || '')); });
console.log('\n  ' + (fallo
  ? '🔴 ' + fallo + ' ATAQUE(S) GANARON — el sistema siguió adelante con menos datos'
  : '✅ LOS ' + V.length + ' ATAQUES FALLAN — quitarle una pieza lo detiene y lo explica'));
process.exit(fallo ? 1 : 0);
