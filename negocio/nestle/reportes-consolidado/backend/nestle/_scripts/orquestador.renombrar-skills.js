/*
 * orquestador.renombrar-skills.js — cambia el prefijo de los skills en TODO el sistema.
 *
 * 🔴 ESTE ES EL RENOMBRE QUE YA MORDIÓ ANTES. La fase 5 renombró al **productor** y con él se
 *    renombró el **producto**: quedaron dos censos con el mismo contenido, uno muerto. Así que aquí
 *    las cosas se parten en CUATRO clases y cada una se trata distinto:
 *
 *      1 · CARPETAS      los 12 `skills/<prefijo><id>/` — se mueven con `git mv` para no perder
 *                        la historia, y su `name:` del frontmatter va con ellas
 *      2 · REFERENCIAS   el código y los documentos VIVOS que apuntan a un skill — se sustituyen
 *      3 · HISTORIA      transcripts, telemetría, `_aplicados`, `_archivo`, respaldos, logs —
 *                        🔴 NO SE TOCAN. Cuentan lo que pasó; renombrarlas deja frases sin sentido
 *                        y borra el rastro de cómo se llamaba el sistema entonces
 *      4 · PRODUCTOS     `cadena-skills.json`, el censo y los @DECLARACION — 🔴 NO se sustituyen:
 *                        SE REGENERAN. Sustituir el texto y además regenerar son dos caminos que
 *                        pueden divergir, y entonces conviven dos verdades del mismo hecho
 *
 * 🔴 LAS CLASES 3 Y 4 SE LEEN DEL CONTRATO (`nomenclatura.no_se_renombra`,
 *    `nomenclatura.se_regenera_en_vez_de_sustituir`), no de una lista aquí: una lista en el código
 *    se desfasa con la primera carpeta nueva.
 *
 *   node orquestador.renombrar-skills.js --de crm-reporte-              (seco)
 *   node orquestador.renombrar-skills.js --de crm-reporte- --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var ENT = require(__dirname + '/lib-entorno.js');

var RAIZ = path.join(os.homedir(), '.claude');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var DE = (function () {
  var i = process.argv.indexOf('--de');
  if (i < 0 || !process.argv[i + 1]) { console.log('🔴 falta --de <prefijo-viejo>   (p.ej. --de crm-reporte-)'); process.exit(1); }
  return process.argv[i + 1];
})();
var A = ENT.PREFIJO_SKILL;

console.log('════ RENOMBRAR LOS SKILLS · «' + DE + '» → «' + A + '» ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');
if (DE === A) { console.log('🔴 el prefijo viejo y el nuevo son el mismo. Nada que hacer.'); process.exit(1); }

var N = ENT.cfg().nomenclatura || {};
var NO_TOCAR = (N.no_se_renombra || {}).patrones || [];
var REGENERA = (N.se_regenera_en_vez_de_sustituir || {}).archivos || [];
console.log('  el contrato declara ' + NO_TOCAR.length + ' patrón(es) de HISTORIA y ' + REGENERA.length + ' producto(s) que se regeneran\n');

function norm(p) { return p.replace(/\\/g, '/'); }
function esHistoria(rel) { var r = norm(rel); return NO_TOCAR.some(function (p) { return r.indexOf(p) >= 0; }); }

/* 🔴 EL RENOMBRE SE COMIÓ SU PROPIO REGISTRO, y lo cazó la prueba. `entorno.json` es a la vez un
 *    archivo que APUNTA (el prefijo vigente) y uno que CUENTA (de qué prefijo se vino y por qué).
 *    La sustitución ciega convirtió `"de": "rick-reportes-"` en `"de": "crm-reporte-"`, o sea
 *    «renombramos de X a X»: el único sitio donde quedaba constancia del nombre viejo, borrado por
 *    el propio renombre. Y el párrafo que explica el defecto citaba `'rick-reportes-' + sk` como
 *    ejemplo: también quedó sin sentido.
 *    No se arregla con otra lista de archivos: se arregla distinguiendo DENTRO del archivo. Las
 *    líneas que son NARRACIÓN del renombre —la historia, y el texto que cita el prefijo viejo como
 *    ejemplo— se dejan como están. Es la regla de los reemplazos masivos aplicada a una línea. */
function esNarracionDelRenombre(rel, linea) {
  if (norm(rel).indexOf('_contratos/entorno.json') < 0) return false;
  return /"de"\s*:/.test(linea) || /por_que_se_pide/.test(linea) || /"cuando"\s*:/.test(linea);
}
function esProducto(rel) { var r = norm(rel); return REGENERA.some(function (p) { return r.indexOf(p) >= 0; }); }

// ── 1 · las carpetas de los 12 skills
var DIR_SK = ENT.SKILLS;
var carpetas = fs.readdirSync(DIR_SK).filter(function (d) {
  return d.indexOf(DE) === 0 && (function () { try { return fs.statSync(path.join(DIR_SK, d)).isDirectory(); } catch (e) { return false; } })();
});
console.log('  ── 1 · carpetas de skill a mover: ' + carpetas.length);
carpetas.forEach(function (d) { console.log('     ' + d + '   →   ' + A + d.slice(DE.length)); });

// ── 2 · los archivos VIVOS que mencionan el prefijo
var vivos = [], historia = [], productos = [];
(function barrer(d, prof) {
  if (prof > 7) return;
  var e; try { e = fs.readdirSync(d); } catch (x) { return; }
  e.forEach(function (n) {
    if (n === '.git' || n === 'node_modules') return;
    var p = path.join(d, n), s; try { s = fs.statSync(p); } catch (y) { return; }
    var rel = path.relative(RAIZ, p);
    if (s.isDirectory()) return barrer(p, prof + 1);
    if (!/\.(js|json|md)$/.test(n) || s.size > 3e6) return;
    var txt; try { txt = fs.readFileSync(p, 'utf8'); } catch (y) { return; }
    var cuenta = (txt.match(new RegExp(DE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (!cuenta) return;
    if (esHistoria(rel)) historia.push({ rel: rel, n: cuenta });
    else if (esProducto(rel)) productos.push({ rel: rel, n: cuenta });
    else vivos.push({ rel: rel, p: p, n: cuenta, txt: txt });
  });
})(RAIZ, 0);

function suma(a) { return a.reduce(function (s, x) { return s + x.n; }, 0); }
console.log('\n  ── 2 · referencias VIVAS (se sustituyen): ' + vivos.length + ' archivo(s) · ' + suma(vivos) + ' mención(es)');
vivos.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 10).forEach(function (x) { console.log('     ' + String(x.n).padStart(4) + '  ' + x.rel); });
if (vivos.length > 10) console.log('     … y ' + (vivos.length - 10) + ' más');

console.log('\n  ── 3 · HISTORIA (no se toca): ' + historia.length + ' archivo(s) · ' + suma(historia) + ' mención(es)');
var porPat = {};
historia.forEach(function (x) { var r = norm(x.rel); NO_TOCAR.forEach(function (p) { if (r.indexOf(p) >= 0 && !porPat[x.rel]) porPat[x.rel] = p; }); });
var agr = {};
Object.keys(porPat).forEach(function (f) { agr[porPat[f]] = (agr[porPat[f]] || 0) + 1; });
Object.keys(agr).sort().forEach(function (p) { console.log('     ' + String(agr[p]).padStart(3) + ' archivo(s)   ' + p); });

console.log('\n  ── 4 · PRODUCTOS (se REGENERAN, no se sustituyen): ' + productos.length + ' archivo(s) · ' + suma(productos) + ' mención(es)');
productos.forEach(function (x) { console.log('     ' + String(x.n).padStart(4) + '  ' + x.rel); });

if (!ESCRIBIR) {
  console.log('\n  (seco. Para escribir: --escribir)');
  process.exit(0);
}

// ── escribir ────────────────────────────────────────────────────────────────────────────────
/* 🔴 «ESTAR DENTRO DE UN REPO» NO ES «ESTAR VERSIONADO», y presumirlo dejó el renombre A MEDIAS.
 *    Yo preguntaba `git rev-parse --is-inside-work-tree` —que dice sí, porque `~/.claude` ES un
 *    repo— y `git mv` falló en las 12 con «source directory is empty»: `skills/` está en el
 *    `.gitignore`. Resultado: las 216 referencias ya decían `crm-reporte-` y las carpetas seguían
 *    llamándose `crm-reporte-`. El sistema quedó apuntando a carpetas que no existen.
 *    Se pregunta por los ARCHIVOS: `git ls-files <ruta>`. Y si no están versionados se dice en voz
 *    alta, porque entonces **no hay rollback de git** — y en este sistema eso ya costó tres skills.
 */
var versionado = (function () {
  try {
    var r = cp.spawnSync('git', ['-C', RAIZ, 'ls-files', path.relative(RAIZ, DIR_SK)], { encoding: 'utf8' });
    return r.status === 0 && String(r.stdout || '').trim().length > 0;
  } catch (e) { return false; }
})();
console.log('\n  ── moviendo las carpetas' + (versionado ? ' con `git mv` (conserva la historia)' : ' con `fs.renameSync`'));
if (!versionado) {
  console.log('     ⚠ `' + path.relative(RAIZ, DIR_SK) + '` NO está versionado (está en .gitignore).');
  console.log('       Eso significa que git NO puede deshacer esto: respalda la carpeta antes.');
}
var movidas = 0, falloMv = [];
carpetas.forEach(function (d) {
  var o = path.join(DIR_SK, d), n = path.join(DIR_SK, A + d.slice(DE.length));
  if (fs.existsSync(n)) { falloMv.push(d + ': el destino ya existe'); return; }
  if (versionado) {
    var r = cp.spawnSync('git', ['-C', RAIZ, 'mv', path.relative(RAIZ, o), path.relative(RAIZ, n)], { encoding: 'utf8' });
    if (r.status !== 0) { falloMv.push(d + ': ' + String(r.stderr || '').trim().slice(0, 70)); return; }
  } else {
    try { fs.renameSync(o, n); } catch (e) { falloMv.push(d + ': ' + e.code); return; }
  }
  movidas++;
});

/* el `name:` del frontmatter viaja con la carpeta: si no, Claude Code encuentra la carpeta nueva
 * con el nombre viejo dentro, y el skill se anuncia como algo que ya no existe. */
var nombresArreglados = 0;
carpetas.forEach(function (d) {
  var corto = d.slice(DE.length);
  var p = path.join(DIR_SK, A + corto, 'SKILL.md');
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8');
  var nt = t.replace(new RegExp('^(name:\\s*)' + DE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + corto + '\\s*$', 'm'), '$1' + A + corto);
  if (nt !== t) { fs.writeFileSync(p, nt); nombresArreglados++; }
});
console.log('     frontmatter `name:` corregido en ' + nombresArreglados + ' SKILL.md');
console.log('     ' + (falloMv.length ? '🔴 ' + falloMv.length + ' no se movieron: ' + falloMv.join(' · ') : '✔ las ' + movidas + ' movidas'));

console.log('\n  ── sustituyendo en los VIVOS');
var reDE = new RegExp(DE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
var escritos = 0, rotos = [];
vivos.forEach(function (x) {
  // el archivo pudo moverse con su carpeta: se resuelve la ruta nueva
  var destino = x.p;
  if (!fs.existsSync(destino)) {
    var alt = x.p.replace(new RegExp(DE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), A);
    if (fs.existsSync(alt)) destino = alt; else { rotos.push(x.rel + ': desapareció'); return; }
  }
  // se sustituye LINEA A LINEA, para poder dejar en paz la narracion del propio renombre
  var relD = path.relative(RAIZ, destino);
  var crudo = fs.readFileSync(destino, 'utf8');
  var finDeLinea = crudo.indexOf('\r\n') >= 0 ? '\r\n' : '\n';   // se conserva el del archivo
  var salida = crudo.split(/\r?\n/).map(function (L) {
    return esNarracionDelRenombre(relD, L) ? L : L.replace(reDE, A);
  }).join(finDeLinea);
  fs.writeFileSync(destino, salida);
  if (/\.js$/.test(destino) && cp.spawnSync(process.execPath, ['--check', destino], { encoding: 'utf8' }).status !== 0) rotos.push(x.rel + ': sintaxis');
  if (/\.json$/.test(destino)) { try { JSON.parse(fs.readFileSync(destino, 'utf8')); } catch (e) { rotos.push(x.rel + ': JSON inválido'); } }
  escritos++;
});
console.log('     ' + (rotos.length ? '🔴 ' + rotos.length + ' con problema: ' + rotos.slice(0, 4).join(' · ') : '✔ ' + escritos + ' archivo(s), todos compilan / parsean'));

// ── el barrido: ¿queda alguna mención VIVA?
var quedan = [];
(function barrer2(d, prof) {
  if (prof > 7) return;
  var e; try { e = fs.readdirSync(d); } catch (x) { return; }
  e.forEach(function (n) {
    if (n === '.git' || n === 'node_modules') return;
    var p = path.join(d, n), s; try { s = fs.statSync(p); } catch (y) { return; }
    var rel = path.relative(RAIZ, p);
    if (s.isDirectory()) return barrer2(p, prof + 1);
    if (!/\.(js|json|md)$/.test(n) || s.size > 3e6) return;
    if (esHistoria(rel)) return;
    var txt; try { txt = fs.readFileSync(p, 'utf8'); } catch (y) { return; }
    var c = (txt.match(reDE) || []).length;
    if (c) quedan.push({ rel: rel, n: c, producto: esProducto(rel) });
  });
})(RAIZ, 0);

var pendProd = quedan.filter(function (x) { return x.producto; });
var pendVivo = quedan.filter(function (x) { return !x.producto; });
console.log('\n  ── el barrido, sobre todo el sistema (saltando la historia)');
console.log('     ' + (pendVivo.length ? '🔴 ' + pendVivo.length + ' VIVO(s) conservan «' + DE + '»:' : '✔ ningún archivo vivo conserva «' + DE + '»'));
pendVivo.slice(0, 8).forEach(function (x) { console.log('        ' + String(x.n).padStart(4) + '  ' + x.rel); });
if (pendProd.length) {
  console.log('     · ' + pendProd.length + ' PRODUCTO(s) todavía lo llevan — correcto: se REGENERAN, no se sustituyen:');
  pendProd.forEach(function (x) { console.log('        ' + String(x.n).padStart(4) + '  ' + x.rel); });
}

var fallo = falloMv.length + rotos.length + pendVivo.length;
console.log('\n════ ' + (fallo
  ? '🔴 NO quedó · ' + falloMv.length + ' carpeta(s) · ' + rotos.length + ' archivo(s) · ' + pendVivo.length + ' sin sustituir'
  : '✅ RENOMBRADO — ' + movidas + ' carpetas y ' + escritos + ' archivos. AHORA regenera los productos:') + ' ════');
if (!fallo) {
  console.log('     node orquestador.cadena-skills.js --escribir');
  console.log('     node orquestador.censo-scripts.js --escribir');
  console.log('     node orquestador.declarar-en-skills.js --escribir');
}
process.exit(fallo ? 1 : 0);
