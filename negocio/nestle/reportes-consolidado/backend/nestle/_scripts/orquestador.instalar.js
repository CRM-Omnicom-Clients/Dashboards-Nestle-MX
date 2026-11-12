/*
 * orquestador.instalar.js — deja el sistema listo en una máquina que NO es la de Rick.
 *
 * 🔴 LA CONFIGURACIÓN DE MÁQUINA NO SE COPIA: SE INSTALA. Los 3 hooks viven en
 *    `~/.claude/settings.json` con la ruta ABSOLUTA del intérprete y del hook, y ahí va el nombre
 *    del usuario:
 *        "C:/Users/Ricardo.Aguilar/.claude/tools/node/node.exe" "C:/Users/Ricardo.Aguilar/..."
 *    Ese archivo está versionado, así que copiarlo a otra máquina lleva las rutas de ESTA. Y un
 *    hook con la ruta mala **no avisa**: Claude Code lo intenta, falla, y el trabajo sigue sin la
 *    protección que el hook daba. Es el mismo modo de fallo que las rutas de los scripts —
 *    silencioso— aplicado a lo único que es determinista en este sistema.
 *
 * 🔴 MIDE ANTES DE ESCRIBIR, Y NO PISA LO AJENO. `settings.json` lleva también el tema, el modelo,
 *    los permisos y los plugins de la persona: se MEZCLA por clave, nunca se reemplaza. Y se
 *    escribe con Node — PowerShell le mete BOM (JSON inválido) y doble-codifica los acentos.
 *
 * 🔴 NO INVENTA LO QUE NO PUEDE RESOLVER. Las dos carpetas de SharePoint se COMPARTEN, no se
 *    instalan: si no están sincronizadas, esto lo dice con el nombre de quien las comparte y para
 *    qué sirve cada una, en vez de dejar que el primer corte reporte «no hay datos de WhatsApp».
 *
 *   node orquestador.instalar.js              revisa y dice qué falta  (no escribe)
 *   node orquestador.instalar.js --escribir   instala los hooks en ESTA máquina
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

var HOME = os.homedir();
var CLAUDE = HOME + '/.claude';
var BACK = CLAUDE + '/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var problemas = [], avisos = [], hechos = [];
function mal(q, comoArreglarlo) { problemas.push({ q: q, arr: comoArreglarlo }); console.log('   🔴 ' + q); if (comoArreglarlo) console.log('      → ' + comoArreglarlo); }
function ok(q, d) { console.log('   ✔ ' + q + (d ? '   ' + d : '')); }
function avisa(q, d) { avisos.push(q); console.log('   ⚠ ' + q + (d ? '   ' + d : '')); }

console.log('════ INSTALAR EL SISTEMA DE REPORTES EN ESTA MÁQUINA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(solo revisa)') + ' ════');
console.log('   usuario: ' + path.basename(HOME) + '   ·   home: ' + HOME + '\n');

// ── 1 · los intérpretes
console.log('── 1 · los intérpretes');
var NODE = process.execPath;
ok('node', process.version + '   ' + NODE);
if (Number(process.version.replace(/^v/, '').split('.')[0]) < 18) {
  mal('node es muy viejo: hace falta 18 o más', 'instala una versión nueva de Node');
}

// 🔴 los paquetes NO se dan por buenos por existir: en esta instalación se corrompen solos y se
//    vuelven paquetes vacíos, así que `import xlsx` pasa aunque esté hueco. Se USAN para probarlos.
['xlsx', 'adm-zip'].forEach(function (p) {
  try {
    var m = require(p);
    var vivo = p === 'xlsx'
      ? (m.utils && typeof m.utils.sheet_to_json === 'function')
      : typeof m === 'function';
    if (vivo) ok('el paquete ' + p + ' responde', '(probado usándolo, no cargándolo)');
    else mal('el paquete ' + p + ' carga pero está hueco', 'node -e "..." no basta: reinstala con npm install ' + p);
  } catch (e) { mal('falta el paquete ' + p, 'npm install --prefix ' + CLAUDE + '/tools ' + p); }
});

var PY = (function () {
  var c = [require(__dirname + '/lib-entorno.js').PYTHON, 'python', 'python3'];
  for (var i = 0; i < c.length; i++) {
    try { var r = cp.spawnSync(c[i], ['--version'], { encoding: 'utf8' }); if (r.status === 0) return { ruta: c[i], v: (r.stdout || r.stderr).trim() }; } catch (e) { }
  }
  return null;
})();
if (PY) ok('python', PY.v + '   ' + PY.ruta);
else mal('no encuentro python', 'la 4ª capa de validación (xlsx-validar-fondo.py) y el render lo necesitan');

// ── 2 · el contrato de rutas
console.log('\n── 2 · el contrato de rutas — lo que el sistema necesita encontrar');
var ENT = null;
try { ENT = require(BACK + '/_scripts/lib-entorno.js'); } catch (e) { mal('no pude cargar lib-entorno.js: ' + e.message); }
if (ENT) {
  console.log(ENT.diagnostico().split('\n').map(function (l) { return '   ' + l; }).join('\n'));
  try { ENT.PROYECTO; ok('la carpeta del proyecto resuelve'); }
  catch (e) {
    mal('la carpeta del proyecto NO resuelve',
      'Es la carpeta del cliente donde vive el libro. Pide que te compartan «Marketing Automation Kinesso - Librería-Sharepoint-MAK» y que SINCRONICE en tu OneDrive (no basta verla en el navegador). Si está en otro sitio, escribe su ruta en raices.proyecto.ruta de _contratos/entorno.json.');
  }
  try { ENT.raiz('fuentes_externas'); ok('la carpeta compartida del equipo resuelve'); }
  catch (e) {
    avisa('la carpeta compartida del equipo NO resuelve',
      '— sin ella no hay datos de WhatsApp ni se puede publicar al consolidado del cliente. La comparte el equipo de Nestlé («Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026»).');
  }
}

// ── 3 · los hooks
console.log('\n── 3 · los 3 hooks — lo único determinista del sistema');
var HOOKS = [
  { f: 'hook-xlsx-protocolo.js', ev: 'PreToolUse', m: 'Bash', que: 'antes de tocar un .xlsx por Bash, inyecta el protocolo de escritura' },
  { f: 'hook-columna-literal.js', ev: 'PreToolUse', m: 'Write|Edit', que: 'rechaza escribir un script que lea por literal una columna que ya mordió' },
  { f: 'hook-xlsx-vigilar.js', ev: 'PostToolUse', m: 'Bash', que: 'después de tocar un .xlsx, comprueba que se corrieran las 5 capas' }
];
var faltanArchivos = HOOKS.filter(function (h) { return !fs.existsSync(CLAUDE + '/tools/' + h.f); });
if (faltanArchivos.length) {
  mal(faltanArchivos.length + ' hook(s) no están en ' + CLAUDE + '/tools/: ' + faltanArchivos.map(function (h) { return h.f; }).join(' · '),
    'viajan en el repo de tools; clónalo o cópialo antes de instalar');
}

var SET = CLAUDE + '/settings.json';
var S = {};
try { S = JSON.parse(fs.readFileSync(SET, 'utf8')); } catch (e) { avisa('settings.json no existe o no parsea: se creará uno nuevo'); }

function cmdDe(h) { return '"' + NODE.replace(/\\/g, '/') + '" "' + (CLAUDE + '/tools/' + h.f) + '"'; }

// qué hooks hay ya, y si apuntan a ESTA máquina
var yaBien = 0, apuntanMal = [];
HOOKS.forEach(function (h) {
  var grupos = ((S.hooks || {})[h.ev] || []).filter(function (g) { return g.matcher === h.m; });
  var cmds = [];
  grupos.forEach(function (g) { (g.hooks || []).forEach(function (x) { if (String(x.command).indexOf(h.f) >= 0) cmds.push(String(x.command)); }); });
  if (!cmds.length) { apuntanMal.push({ h: h, por: 'no está declarado' }); return; }
  var bien = cmds.some(function (c) {
    // 🔴 se comprueba que el ARCHIVO que cita exista, no que el texto se parezca: un hook con la
    //    ruta de otra máquina está «declarado» y no corre, que es el fallo silencioso a evitar.
    var citas = c.match(/"([^"]+)"/g) || [];
    return citas.every(function (q) { return fs.existsSync(q.replace(/"/g, '')); });
  });
  if (bien) { yaBien++; ok('hook ' + h.f, 'ya instalado y sus rutas existen'); }
  else apuntanMal.push({ h: h, por: 'declarado con una ruta que NO existe en esta máquina (viene de otra)' });
});
apuntanMal.forEach(function (x) { console.log('   ' + (ESCRIBIR ? '·' : '⚠') + ' hook ' + x.h.f + ': ' + x.por); });

if (apuntanMal.length && ESCRIBIR) {
  if (faltanArchivos.length) {
    mal('no instalo los hooks: faltan sus archivos', 'trae ' + CLAUDE + '/tools/ primero');
  } else {
    // se MEZCLA: se respeta todo lo demás de settings.json y los otros hooks de la persona
    S.hooks = S.hooks || {};
    apuntanMal.forEach(function (x) {
      var h = x.h;
      S.hooks[h.ev] = S.hooks[h.ev] || [];
      var g = S.hooks[h.ev].filter(function (y) { return y.matcher === h.m; })[0];
      if (!g) { g = { matcher: h.m, hooks: [] }; S.hooks[h.ev].push(g); }
      g.hooks = (g.hooks || []).filter(function (y) { return String(y.command).indexOf(h.f) < 0; });
      g.hooks.push({ type: 'command', command: cmdDe(h) });
      hechos.push(h.f);
    });
    // 🔴 con Node, nunca con PowerShell: BOM = JSON inválido, y el round-trip doble-codifica acentos
    fs.copyFileSync(SET, SET + '.antes-de-instalar');
    fs.writeFileSync(SET, JSON.stringify(S, null, 2), 'utf8');
    // y se RELEE del disco para comprobar que quedó válido
    var b = fs.readFileSync(SET);
    var limpio = b[0] === 123 && !/\u00c3|\u00c2/.test(b.toString('utf8'));
    try { JSON.parse(b.toString('utf8')); } catch (e) { limpio = false; }
    if (limpio) ok(hechos.length + ' hook(s) instalados', '(releído del disco: primer byte «{», sin BOM, sin acentos doble-codificados)');
    else mal('settings.json quedó inválido', 'restaura ' + SET + '.antes-de-instalar');
    console.log('   ⚠ los hooks se cargan AL INICIAR Claude Code: reinícialo para que surtan efecto.');
  }
}

// ── 4 · que el sistema se pueda correr
console.log('\n── 4 · ¿arranca?');
if (!problemas.length) {
  var pr = cp.spawnSync(NODE, [BACK + '/_scripts/orquestador.probar-entorno.js'], { encoding: 'utf8' });
  if (pr.status === 0) ok('el contrato de rutas resuelve', '(orquestador.probar-entorno.js en verde)');
  else avisa('el contrato de rutas NO está en verde', 'corre orquestador.probar-entorno.js y lee lo que dice');
  var gu = cp.spawnSync(NODE, [BACK + '/_scripts/orquestador.guardas.js'], { encoding: 'utf8' });
  var nb = ((gu.stdout || '').match(/🔴 bloquean: (\d+)/) || [])[1];
  if (gu.status === 0) ok('las guardas del preflight no bloquean', '(' + (nb || '0') + ' bloqueos)');
  else avisa('las guardas BLOQUEAN', 'el corte no correría; lee la salida de orquestador.guardas.js');
}

// ── veredicto
console.log('\n════════════════════════════════════════════');
if (problemas.length) {
  console.log('   🔴 FALTAN ' + problemas.length + ' COSA(S) SIN LAS QUE EL SISTEMA NO CORRE:');
  problemas.forEach(function (p) { console.log('      · ' + p.q); });
}
if (avisos.length) {
  console.log('   ⚠ ' + avisos.length + ' aviso(s) — el sistema corre, pero con menos:');
  avisos.forEach(function (a) { console.log('      · ' + a); });
}
if (!ESCRIBIR && apuntanMal.length) console.log('\n   para instalar los hooks:  node orquestador.instalar.js --escribir');
console.log('\n════ ' + (problemas.length ? '🔴 NO está listo' : avisos.length ? '⚠ LISTO, con ' + avisos.length + ' aviso(s)' : '✅ LISTO para correr un corte') + ' ════');
process.exit(problemas.length ? 1 : 0);
