/*
 * motor.clicks-desde-plataforma.js — el desglose de clicks desde `ClickEvent`, la fuente COMPLETA.
 *
 * 🔴 POR QUÉ HACE FALTA OTRA FUENTE (19-sep-2026). El desglose vivía en `CRM_Email_Links`, y esa
 *    DE es CIEGA al link de baja en 30 de 106 piezas — que suman 28,484 bajas, el 57% del total.
 *    No es un bug de la query: es que **el link de baja de SFMC es TOKENIZADO POR SUSCRIPTOR**:
 *        https://cloud.email.mx.nestle.com/Unsubscribe?qs=ABB7InYiOjEsImQiOjQ5MTd9AAE...
 *    Cada persona recibe una URL distinta. Una DE que agrupa por `Link_URL` no puede representar
 *    eso como una fila: son miles de filas de un click cada una, o ninguna.
 *    `ClickEvent` sí las trae, porque es el evento, no el link.
 *
 * 🔴 EL DATO NO PASA POR EL CONTEXTO. Cada `sfmc_get_clicks` devuelve decenas de miles de líneas;
 *    la herramienta las guarda en un archivo y este script los lee del disco. Es la misma regla que
 *    rige los volcados de SFMC: un fetch grande nunca entra al contexto.
 *
 * 🔴 Y NO SUSTITUYE A `CRM_Email_Links`: LA COMPLETA. La DE cubre las 104 piezas con su desglose
 *    por destino; esta fuente aporta lo que la DE no puede ver. Donde las dos hablan, se declara
 *    cuál gana y por qué — nunca se promedian.
 *
 *   node motor.clicks-desde-plataforma.js            (mide y escribe el volcado)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var NL = String.fromCharCode(10);

/* 🔴 LEÍA DE LA CARPETA DE UNA SESIÓN DE CLAUDE CODE, y eso es tan frágil como suena. La ruta era
 *    `~/.claude/projects/<proyecto>/<ID-DE-SESIÓN>/tool-results`: el id cambia en cada sesión, la
 *    carpeta es el almacén de transcripts (no un sitio de datos) y Claude Code puede limpiarla.
 *    Así que este script no corría ni en la máquina de Rick la próxima vez, y en la de otra persona
 *    nunca. La guarda 7 no lo veía porque `.claude/projects` no era uno de sus patrones; lo
 *    encontró su regla general: «desde el home, nada».
 *
 * 🔴 Y LOS VOLCADOS ESTABAN AHÍ DENTRO — 8 archivos, 1 MB, del 19-sep-2026 — así que la ruta mala
 *    no era solo un problema de portabilidad: era el único sitio donde vivía un dato que solo se
 *    recupera volviendo a pedírselo a SFMC. Se copiaron a `_insumos/`, comprobados sha1 uno por
 *    uno, que es donde este mismo script YA escribía su salida. La entrada vive donde la salida.
 *
 *    Los volcados nuevos se dejan en una carpeta `_insumos/sfmc-clicks-crudo-<fecha>/`. */
var SALIDA = BACK + '/_insumos/sfmc-clickevent-' + new Date().toISOString().slice(0, 10) + '.txt';

console.log('════════ motor · CLICKS DESDE LA PLATAFORMA (ClickEvent) ════════' + NL);

var DIR = (function () {
  var ins = BACK + '/_insumos';
  var cands;
  try {
    cands = fs.readdirSync(ins)
      .filter(function (d) { return /^sfmc-clicks-crudo-/.test(d); })
      .filter(function (d) { try { return fs.statSync(ins + '/' + d).isDirectory(); } catch (e) { return false; } })
      .sort();
  } catch (e) { cands = []; }
  if (cands.length) return ins + '/' + cands[cands.length - 1];   // el más reciente por nombre (lleva la fecha)
  console.log('🔴 no hay ninguna carpeta `_insumos/sfmc-clicks-crudo-<fecha>/` con los volcados de ClickEvent.');
  console.log('   Son los clicks crudos de SFMC y son una ENTRADA: no los produce la cadena.');
  console.log('   Pídelos con `sfmc_get_clicks` por el MCP — la herramienta los guarda en un archivo,');
  console.log('   porque un fetch de decenas de miles de líneas no entra al contexto — y copia esos');
  console.log('   `.txt` a una carpeta nueva con la fecha del día.');
  console.log('   ⚠ NO los dejes en la carpeta de resultados de la sesión: ahí vivían antes y esa');
  console.log('     carpeta cambia de nombre en cada sesión y no existe en otra máquina.');
  process.exit(1);
})();
console.log('  volcados: ' + path.basename(DIR));

var archivos = fs.readdirSync(DIR).filter(function (f) { return /sfmc_get_clicks/.test(f) && /\.txt$/.test(f); });
console.log('  archivos de ClickEvent en disco: ' + archivos.length);

// ── el mapa job → pieza, del volcado de detalle ────────────────────────────────────
function vig(p) {
  var re = new RegExp('^' + p + '-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.txt$');
  return fs.readdirSync(BACK + '/_insumos').filter(function (x) { return re.test(x); }).sort().pop();
}
var DET = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + vig('sfmc-detalle'), 'utf8')).rows;
var piezaDe = {}, fupDe = {};
DET.forEach(function (r) {
  var j = t(r.JobID); if (!j) return;
  piezaDe[j] = t(r.ConfigKey);
  fupDe[j] = /^s[ií]$/i.test(t(r.Es_FUP)) ? 'FUP' : 'PRIN';
});

// ── leer cada archivo y clasificar ─────────────────────────────────────────────────
var porJob = {}, leidos = 0, truncados = [];
archivos.forEach(function (f) {
  var P;
  try { P = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return; }
  if (!P || !P.jobId || !P.topUrls) return;
  var j = String(P.jobId);
  // 🔴 si el mismo job aparece en dos archivos, gana el que NO esté truncado, y si los dos
  //    están completos, el más reciente. Quedarse con el truncado es como no tener el dato.
  var prev = porJob[j];
  if (prev && prev.truncated === false && P.truncated !== false) return;
  if (P.truncated) truncados.push(j);
  var clases = {}, tot = 0;
  P.topUrls.forEach(function (x) {
    var c = CD.clase(x.url, '');
    clases[c] = (clases[c] || 0) + num(x.clicks);
    tot += num(x.clicks);
  });
  porJob[j] = {
    job: j, pieza: piezaDe[j] || '(sin pieza)', bloque: fupDe[j] || 'PRIN',
    eventos: num(P.count), suscriptores_unicos: num(P.uniqueSubscribers),
    truncated: P.truncated === true, clases: clases, total_clasificado: tot, archivo: f
  };
  leidos++;
});

var jobs = Object.keys(porJob);
console.log('  jobs con dato completo: ' + jobs.filter(function (j) { return !porJob[j].truncated; }).length +
  '   ·   truncados (NO se usan para totales): ' + jobs.filter(function (j) { return porJob[j].truncated; }).length);

// ── el resumen, por familia ────────────────────────────────────────────────────────
var buenos = jobs.filter(function (j) { return !porJob[j].truncated; });
var totClases = {}, totEv = 0, totSubs = 0;
buenos.forEach(function (j) {
  var x = porJob[j];
  Object.keys(x.clases).forEach(function (c) { totClases[c] = (totClases[c] || 0) + x.clases[c]; });
  totEv += x.eventos; totSubs += x.suscriptores_unicos;
});
console.log(NL + '══ LO QUE APORTA LA PLATAFORMA   (' + buenos.length + ' jobs · ' + mil(totEv) + ' eventos de click)');
CD.familias().forEach(function (fam) {
  var cls = CD.clasesDe(fam);
  var s = cls.reduce(function (a, c) { return a + (totClases[c] || 0); }, 0);
  if (!s) return;
  console.log('  ' + fam.toUpperCase().padEnd(16) + mil(s).padStart(9) + '   ' + (totEv ? (s / totEv * 100).toFixed(1) : 0) + '%');
  cls.forEach(function (c) { if (totClases[c]) console.log('     · ' + c.padEnd(22) + mil(totClases[c]).padStart(9)); });
});

// ── 🔴 LO QUE LA DE NO VEÍA: la comparación pieza por pieza ────────────────────────
var LK = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + vig('sfmc-links'), 'utf8')).rows;
var deDE = {};
LK.forEach(function (r) {
  var k = t(r.ConfigKey); if (!k) return;
  deDE[k] = deDE[k] || {};
  var c = CD.clase(t(r.Link_URL), t(r.Link_Name));
  deDE[k][c] = (deDE[k][c] || 0) + num(r.Clicks_Unique);
});
console.log(NL + '══ BAJA: LO QUE LA DE VE vs LO QUE LA PLATAFORMA DICE');
console.log('  pieza'.padEnd(26) + 'DE'.padStart(7) + 'plataforma'.padStart(12) + '   diferencia');
var recuperado = 0;
buenos.map(function (j) { return porJob[j]; }).sort(function (a, b) {
  return (b.clases.baja_preferencias || 0) - (a.clases.baja_preferencias || 0);
}).forEach(function (x) {
  var de = (deDE[x.pieza] || {}).baja_preferencias || 0;
  var pl = x.clases.baja_preferencias || 0;
  if (!pl && !de) return;
  recuperado += Math.max(0, pl - de);
  console.log('  ' + x.pieza.slice(0, 24).padEnd(26) + mil(de).padStart(7) + mil(pl).padStart(12) +
    '   ' + (pl > de ? '🔴 +' + mil(pl - de) + ' que la DE no veía' : '✔ igual'));
});
console.log(NL + '  ── clicks de baja que la DE no veía y ahora sí: ' + mil(recuperado));

// ── el volcado ────────────────────────────────────────────────────────────────────
fs.writeFileSync(SALIDA, JSON.stringify({
  paso: 'motor.clicks-desde-plataforma',
  generado: new Date().toISOString().slice(0, 10),
  fuente: 'SFMC · ClickEvent (SOAP), un job a la vez',
  que_es: 'El desglose de clicks por destino desde la fuente COMPLETA. Complementa a CRM_Email_Links, ' +
    'que es ciega al link de baja porque SFMC lo tokeniza por suscriptor.',
  base: 'los clicks son TOTALES por URL (no únicos por persona): ClickEvent es el evento',
  jobs: buenos.length, eventos: totEv, por_clase: totClases,
  detalle: buenos.map(function (j) { return porJob[j]; }),
  truncados: truncados
}, null, 1), 'utf8');
var re = JSON.parse(fs.readFileSync(SALIDA, 'utf8'));
console.log('  ✔ volcado escrito y releído: ' + re.detalle.length + ' jobs   →   _insumos/' + path.basename(SALIDA));
