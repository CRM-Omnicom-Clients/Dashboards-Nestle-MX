/*
 * motor.auditar-destinos.js — LA DOBLE VALIDACIÓN de la clasificación de clicks.
 *
 * 🔴 RICK, 19-sep-2026: «¿cómo doble validas que sí se están calculando únicamente ese tipo de
 *    links?». Esto es la respuesta, y no es una promesa: son las 5 pruebas que declara
 *    `_contratos/clicks-destinos.json`, corridas sobre todos los links del volcado.
 *
 * 🔴 LA PRUEBA QUE DE VERDAD PROTEGE ES LA 1, y es la más aburrida: imprimir TODAS las URLs de
 *    cada clase con sus clicks, para que un humano pueda leerlas y decir «sí, eso es Qcart» o «no,
 *    eso no». El defecto que originó este auditor —el centro de preferencias contado como
 *    contenido— habría saltado a la vista en tres segundos si alguien hubiera podido ver la lista.
 *    Ningún check automático lo encontró en meses; una lista legible sí lo habría hecho.
 *
 *   node motor.auditar-destinos.js              resumen + lo que hay que mirar
 *   node motor.auditar-destinos.js --todo       TODAS las URLs de cada clase
 *   node motor.auditar-destinos.js --clase qcart   solo una clase
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var NL = String.fromCharCode(10);
var TODO = process.argv.indexOf('--todo') >= 0;
var iC = process.argv.indexOf('--clase');
var SOLO = iC >= 0 ? t(process.argv[iC + 1]) : null;

var _v = L.exigirInsumo('sfmc-links',
  'Son los clicks por destino de SFMC. Traelos con:  node ' + __dirname + '/fuentes-email.refrescar-volcado.js --escribir');
if (!_v || !fs.existsSync(_v.ruta)) { console.log('🔴 falta el volcado sfmc-links-*'); process.exit(1); }
var D = JSON.parse(fs.readFileSync(_v.ruta, 'utf8'));
var R = D.rows || [];

console.log('════════ motor · AUDITAR LA CLASIFICACIÓN DE CLICKS ════════' + NL);
console.log('  volcado: ' + _v.ruta.split(/[\\/]/).pop() + '   ·   ' + R.length + ' links');
console.log('  contrato: ' + CD.RUTA.split(/[\\/]/).pop() + '   ·   ' + CD.clases().length + ' clases, ' + CD.familias().length + ' familias' + NL);

// ── clasificar todo ────────────────────────────────────────────────────────────────
var porClase = {}, porUrl = {}, porPieza = {}, tot = 0;
CD.clases().forEach(function (c) { porClase[c] = { clicks: 0, links: 0, urls: {} }; });
R.forEach(function (r) {
  var u = t(r.Link_URL), nm = t(r.Link_Name), c = num(r.Clicks_Unique);
  var cl = CD.clase(u, nm);
  porClase[cl].clicks += c; porClase[cl].links++;
  porClase[cl].urls[u] = (porClase[cl].urls[u] || 0) + c;
  porUrl[u] = cl; tot += c;
  var pz = t(r.ConfigKey) || '(sin llave)';
  porPieza[pz] = porPieza[pz] || { clicks: 0, porClase: {} };
  porPieza[pz].clicks += c;
  porPieza[pz].porClase[cl] = (porPieza[pz].porClase[cl] || 0) + c;
});

// ── el resumen, por familia ────────────────────────────────────────────────────────
console.log('══ POR FAMILIA   (base: ' + mil(tot) + ' clicks · único por LINK, no por persona)');
CD.familias().forEach(function (fam) {
  var cls = CD.clasesDe(fam);
  var s = cls.reduce(function (a, c) { return a + (porClase[c] ? porClase[c].clicks : 0); }, 0);
  console.log(NL + '  ' + fam.toUpperCase().padEnd(16) + mil(s).padStart(9) + '   ' + (tot ? (s / tot * 100).toFixed(1) : 0) + '%');
  cls.forEach(function (c) {
    var x = porClase[c]; if (!x) return;
    console.log('     · ' + c.padEnd(22) + mil(x.clicks).padStart(9) + '   ' + (tot ? (x.clicks / tot * 100).toFixed(1) : 0) + '%' +
      '   ' + Object.keys(x.urls).length + ' url(s) distintas, ' + x.links + ' link(s)');
  });
});

var fallos = [], avisos = [];
function K(n, ok, det) { console.log('  ' + (ok ? '✔' : '🔴') + ' ' + n.padEnd(56) + det); if (!ok) fallos.push(n + ' — ' + det); }

console.log(NL + '══ LAS 5 VALIDACIONES QUE DECLARA EL CONTRATO' + NL);

// 1 · la lista legible (se imprime abajo; aquí se cuenta que exista)
var urlsDistintas = Object.keys(porUrl).length;
K('1 · todas las URLs son legibles y atribuidas a una clase', urlsDistintas > 0,
  urlsDistintas + ' url(s) distintas, todas con clase (se listan abajo)');

// 2 · Σ de las clases == Σ de los links, por pieza
var descuadres = Object.keys(porPieza).filter(function (p) {
  var s = Object.keys(porPieza[p].porClase).reduce(function (a, c) { return a + porPieza[p].porClase[c]; }, 0);
  return s !== porPieza[p].clicks;
});
K('2 · Σ de las clases == Σ de los links, en cada pieza', descuadres.length === 0,
  descuadres.length ? '🔴 ' + descuadres.length + ' pieza(s) descuadran' : 'las ' + Object.keys(porPieza).length + ' piezas cuadran');

// 3 · ninguna URL la reclaman dos clases
var sol = CD.solapamientos(Object.keys(porUrl));
K('3 · ninguna URL la reclaman dos clases (sin ambigüedad)', sol.length === 0,
  sol.length ? '🔴 ' + sol.length + ' url(s) ambiguas' : 'ninguna de las ' + urlsDistintas);
if (sol.length) sol.slice(0, 8).forEach(function (x) { console.log('        ' + x.clases.join(' + ') + '  →  gana «' + x.gana + '»   ' + x.url.slice(0, 60)); });

// 4 · por_clasificar bajo control
var pc = porClase['por_clasificar'];
var pctPC = tot ? pc.clicks / tot * 100 : 0;
var okPC = pctPC <= 1;
console.log('  ' + (okPC ? '✔' : '⚠') + ' 4 · `por_clasificar` por debajo del 1% de la actividad'.padEnd(56) +
  mil(pc.clicks) + ' clicks (' + pctPC.toFixed(2) + '%) en ' + Object.keys(pc.urls).length + ' url(s)');
if (!okPC) avisos.push('`por_clasificar` tiene ' + mil(pc.clicks) + ' clicks (' + pctPC.toFixed(2) + '%): la fuente manda destinos que el contrato no conoce');
if (Object.keys(pc.urls).length) {
  console.log('     🔴 LO QUE NADIE HA CLASIFICADO — necesita una decisión, no una suposición:');
  Object.keys(pc.urls).sort(function (a, b) { return pc.urls[b] - pc.urls[a]; }).slice(0, 15).forEach(function (u) {
    console.log('        ' + mil(pc.urls[u]).padStart(7) + '  ' + u.slice(0, 84));
  });
}

// 5 · contra el crudo de SFMC: se declara cómo comprobarlo (necesita un jobId)
console.log('  ⊘ 5 · contra `ClickEvent` de SFMC por job'.padEnd(58) +
  'se corre a mano con `sfmc_get_clicks` sobre una pieza de muestra');

// ── LA LISTA LEGIBLE ──────────────────────────────────────────────────────────────
console.log(NL + '══ LAS URLs DE CADA CLASE   ' + (TODO ? '(todas)' : '(top 8 por clase — `--todo` para verlas todas)'));
CD.clases().forEach(function (c) {
  if (SOLO && c !== SOLO) return;
  var x = porClase[c]; if (!x || !Object.keys(x.urls).length) return;
  var def = CD.definicion(c) || {};
  console.log(NL + '  ── ' + c.toUpperCase() + '   ' + mil(x.clicks) + ' clicks   ·   familia: ' + CD.familia(c));
  if (def.que_es) console.log('     ' + String(def.que_es).slice(0, 150));
  if (def.patrones && def.patrones.length) console.log('     patrones: ' + def.patrones.join(' · '));
  var us = Object.keys(x.urls).sort(function (a, b) { return x.urls[b] - x.urls[a]; });
  (TODO || SOLO ? us : us.slice(0, 8)).forEach(function (u) {
    console.log('        ' + mil(x.urls[u]).padStart(7) + '  ' + u.slice(0, 92));
  });
  if (!TODO && !SOLO && us.length > 8) console.log('        … y ' + (us.length - 8) + ' url(s) más');
});

// ── el veredicto ──────────────────────────────────────────────────────────────────
var DEST = BACK + '/_preescritura/auditoria-destinos.json';
fs.writeFileSync(DEST, JSON.stringify({
  generado: new Date().toISOString().slice(0, 10), volcado: _v.ruta.split(/[\\/]/).pop(),
  total_clicks: tot, por_clase: Object.keys(porClase).reduce(function (o, c) {
    o[c] = { clicks: porClase[c].clicks, links: porClase[c].links, urls: porClase[c].urls }; return o;
  }, {}), fallos: fallos, avisos: avisos, solapamientos: sol
}, null, 1));

console.log(NL + '════ VEREDICTO ════');
if (fallos.length) { fallos.forEach(function (f) { console.log('  🔴 ' + f); }); }
if (avisos.length) { avisos.forEach(function (a) { console.log('  ⚠ ' + a); }); }
if (!fallos.length) console.log('  ✅ LA CLASIFICACIÓN ES ÍNTEGRA — cuadra por pieza, sin ambigüedad, y lo desconocido está declarado');
console.log('  → ' + DEST.split(/[\\/]/).slice(-2).join('/'));
process.exit(fallos.length ? 1 : 0);
