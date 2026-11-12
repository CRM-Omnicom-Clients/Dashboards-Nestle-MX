/*
 * orquestador.probar-renombre.js — ¿el renombre de los skills quedó COMPLETO, o a medias?
 *
 * 🔴 UN RENOMBRE A MEDIAS ES PEOR QUE NO HABERLO HECHO, y hoy pasó: `git mv` falló en las 12
 *    carpetas («source directory is empty», porque `skills/` está en el `.gitignore`) mientras las
 *    216 referencias YA decían el nombre nuevo. Durante unos minutos el sistema apuntaba a carpetas
 *    que no existían. Eso no truena al cargar: truena cuando alguien pide el SKILL.md.
 *
 * 🔴 Y SE COMPRUEBAN LAS DOS DIRECCIONES, porque las dos fallan distinto:
 *      · que no quede el nombre VIEJO en nada vivo  → referencias muertas
 *      · que cada skill declarado EXISTA en disco    → la cadena apuntando al vacío
 *      · que carpeta y `name:` coincidan             → Claude Code anuncia un nombre que no es
 *      · que la HISTORIA siga intacta                → renombrarla borraría el rastro
 *
 *   node orquestador.probar-renombre.js            (contra el prefijo del contrato)
 *   node orquestador.probar-renombre.js --viejo rick-reportes-
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var ENT = require(__dirname + '/lib-entorno.js');

/* 🔴 LA PRUEBA AUDITA EL SISTEMA DEL QUE FORMA PARTE, NO EL DE RICK. Esto decía
 *    `path.join(os.homedir(), '.claude')` fijo, así que corrida DESDE la copia de SharePoint salía
 *    en verde habiendo barrido la máquina de Rick — exactamente la fachada que llevo todo el día
 *    cerrando, esta vez dentro del verificador. Se barre desde el BACKEND propio (y desde
 *    `~/.claude` además, solo cuando el backend propio está dentro). */
var MI_BACK = path.resolve(__dirname, '..');
var HOME_CLAUDE = path.join(os.homedir(), '.claude');
var RAICES = [MI_BACK, ENT.SKILLS];
if (MI_BACK.indexOf(HOME_CLAUDE) === 0) RAICES = [HOME_CLAUDE];
var RAIZ = RAICES[0];
var A = ENT.PREFIJO_SKILL;
var VIEJO = (function () {
  var i = process.argv.indexOf('--viejo');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  var h = (ENT.cfg().nomenclatura || {}).historia || [];
  return h.length ? h[h.length - 1].de : null;
})();

var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
var BS = String.fromCharCode(92);
function norm(p) { return String(p).split(BS).join('/'); }

console.log('════ ¿EL RENOMBRE QUEDÓ COMPLETO? · prefijo «' + A + '»' + (VIEJO ? ' (venía de «' + VIEJO + '»)' : '') + ' ════\n');

var NO = ((ENT.cfg().nomenclatura || {}).no_se_renombra || {}).patrones || [];
function esHistoria(rel) { var r = norm(rel); return NO.some(function (p) { return r.indexOf(p) >= 0; }); }

/* 🔴 Y LA NARRACIÓN DEL PROPIO RENOMBRE TAMPOCO ES UN DEFECTO. Esta prueba señaló `entorno.json`
 *    porque su bloque `historia` dice «de rick-reportes- a crm-reporte-» — que es exactamente lo
 *    que TIENE que decir. La primera vez el renombrador lo sustituyó y el registro quedó diciendo
 *    «de X a X»: borró la única constancia del nombre viejo. Lo arreglé en el renombrador, y aquí
 *    hay que saberlo igual, o la prueba exige deshacer el arreglo. */
/* 🔴 Y LOS SEÑUELOS LLEVAN EL NOMBRE VIEJO A PROPÓSITO. `orquestador.probar-copiador.js` planta
 *    una carpeta `<prefijo-viejo>escritor` para comprobar que el copiador la retira; sin ese
 *    nombre no hay prueba. La lista de intocables ya existía para «quién puede llevar una RUTA
 *    escrita», y es el mismo concepto: quién puede llevar un literal que las guardas señalarían.
 *    Se lee del contrato en vez de escribirla aquí — sería el cuarto sitio con la misma lista. */
var INTOCABLES = Object.keys(((ENT.cfg().intocables || {}).lista) || {});
function esSenuelo(rel) {
  var base = norm(rel).split('/').pop();
  return INTOCABLES.indexOf(base) >= 0;
}

function esNarracion(rel, linea) {
  // 🔴 un COMENTARIO que cita el nombre viejo como ejemplo tampoco es un defecto: es la lección.
  //    `orquestador.llevar-a-carpeta.js` explica que su filtro decía `/^rick-reportes/` y por qué
  //    eso habría copiado cero skills. Señalar esa explicación obligaría a borrarla.
  if (/\.js$/.test(rel) && /^\s*(\/\/|\*|\/\*)/.test(linea)) return true;
  if (norm(rel).indexOf('_contratos/entorno.json') < 0) return false;
  return /"de"\s*:/.test(linea) || /por_que_se_pide/.test(linea) || /"cuando"\s*:/.test(linea);
}

// ── 1 · no queda el nombre viejo en nada VIVO
if (VIEJO) {
  var vivos = [], enHistoria = 0;
  var re = new RegExp(VIEJO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-$/, ''), 'g');
  function barrer(d, prof) {
    if (prof > 7) return;
    var e; try { e = fs.readdirSync(d); } catch (x) { return; }
    e.forEach(function (n) {
      if (n === '.git' || n === 'node_modules') return;
      var p = path.join(d, n), s; try { s = fs.statSync(p); } catch (y) { return; }
      var rel = path.relative(RAIZ, p);
      if (s.isDirectory()) return barrer(p, prof + 1);
      if (!/\.(js|json|md)$/.test(n) || s.size > 3e6) return;
      var t; try { t = fs.readFileSync(p, 'utf8'); } catch (y) { return; }
      // se cuenta por LÍNEA, para poder perdonar la narración del propio renombre
      var c = 0, enNarr = 0;
      t.split(/\r?\n/).forEach(function (L) {
        var k = (L.match(re) || []).length;
        if (!k) return;
        if (esNarracion(rel, L)) enNarr += k; else c += k;
      });
      if (enNarr) enHistoria += enNarr;
      if (!c) return;
      if (esHistoria(rel) || esSenuelo(rel)) enHistoria += c; else vivos.push({ rel: rel, n: c });
    });
  }
  RAICES.filter(function (r, i) { return RAICES.indexOf(r) === i; }).forEach(function (r) { barrer(r, 0); });
  chk('ningún archivo VIVO conserva el nombre viejo', vivos.length === 0,
    vivos.length ? vivos.slice(0, 4).map(function (x) { return x.rel + ' (' + x.n + ')'; }).join(' · ') : 'barridos los .js/.json/.md de: ' + RAICES.map(function (r) { return path.basename(r); }).join(' + '));
  // 🔴 y la historia tiene que SEGUIR ahí: si sale 0, alguien la renombró
  chk('la HISTORIA sigue intacta (no se renombró)', enHistoria > 0,
    enHistoria + ' mención(es) conservadas en transcripts, telemetría, _aplicados, _archivo y respaldos');
}

// ── 2 · cada skill que la cadena declara EXISTE en disco
var CAD = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..') + '/_contratos/cadena-skills.json', 'utf8'));
var declarados = {};
(CAD.etapas || []).forEach(function (e) { if (e.skill) declarados[e.skill] = 1; });
var sinCarpeta = Object.keys(declarados).filter(function (s) { return !fs.existsSync(path.join(ENT.SKILLS, s, 'SKILL.md')); });
chk('cada skill de la cadena tiene su SKILL.md en disco', sinCarpeta.length === 0,
  sinCarpeta.length ? '🔴 apuntan al vacío: ' + sinCarpeta.join(' · ') : Object.keys(declarados).length + ' de ' + Object.keys(declarados).length);

// ── 3 · todos llevan el prefijo nuevo
var conPrefijo = Object.keys(declarados).filter(function (s) { return s.indexOf(A) === 0; });
chk('todos los skills declarados llevan el prefijo del contrato', conPrefijo.length === Object.keys(declarados).length,
  conPrefijo.length + ' de ' + Object.keys(declarados).length + ' con «' + A + '»');

// ── 4 · la carpeta y el `name:` del frontmatter dicen lo mismo
var discrepan = [];
fs.readdirSync(ENT.SKILLS).filter(function (d) { return d.indexOf(A) === 0; }).forEach(function (d) {
  var p = path.join(ENT.SKILLS, d, 'SKILL.md');
  if (!fs.existsSync(p)) { discrepan.push(d + ': sin SKILL.md'); return; }
  var m = /^name:\s*(.+)$/m.exec(fs.readFileSync(p, 'utf8'));
  if (!m) { discrepan.push(d + ': sin `name:`'); return; }
  if (m[1].trim() !== d) discrepan.push(d + ' ≠ name:' + m[1].trim());
});
chk('la carpeta y el `name:` coinciden en los ' + fs.readdirSync(ENT.SKILLS).filter(function (d) { return d.indexOf(A) === 0; }).length,
  discrepan.length === 0, discrepan.length ? discrepan.join(' · ') : 'Claude Code anuncia el nombre real');

// ── 5 · el prefijo se PIDE, no se escribe: ningún script lo lleva literal
var conLiteral = [];
var dirS = path.resolve(__dirname);
fs.readdirSync(dirS).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  if (f === 'lib-entorno.js' || f === path.basename(__filename) || f === 'orquestador.renombrar-skills.js') return;
  var ls = fs.readFileSync(path.join(dirS, f), 'utf8').split(/\r?\n/).filter(function (L) {
    return !/^\s*(\/\/|\*|\/\*)/.test(L) && L.indexOf("'" + A + "'") >= 0;
  });
  if (ls.length) conLiteral.push(f + ':' + ls.length);
});
chk('el prefijo se PIDE al contrato, no se escribe en el código', conLiteral.length === 0,
  conLiteral.length ? '⚠ lo escriben: ' + conLiteral.slice(0, 5).join(' · ') + '  — el día que cambie otra vez, vuelven a romperse' : 'ENT.PREFIJO_SKILL / ENT.skillDe() / ENT.cortoDe()');

console.log('════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(58) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' comprobación(es) fallan — el renombre NO está completo'
  : '✅ EL RENOMBRE ESTÁ COMPLETO Y COHERENTE — ' + V.length + ' comprobaciones'));
process.exit(fallo ? 1 : 0);
