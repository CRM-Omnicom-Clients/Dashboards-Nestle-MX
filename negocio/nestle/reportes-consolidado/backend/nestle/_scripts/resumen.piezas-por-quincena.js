/*
 * resumen.piezas-por-quincena.js — RESULTADOS DE UNAS PIEZAS, ABIERTOS POR QUINCENA.
 *
 * 🔴 SALE DEL DETALLE DÍA POR DÍA (`sfmc-detalle-*`), no de la DE agregada. La agregada da un total
 *    por pieza y no se puede repartir en el tiempo; el detalle trae una fila por job × día y ésa sí.
 *
 * 🔴 LOS JOBS DE PRUEBA, FUERA. En esta BU conviven jobs reales con jobs de 1 correo (alguien se lo
 *    manda a sí mismo). El criterio vive en UN solo lugar —`lib-fechas-envio.js`, umbral <10— y se
 *    usa aquí igual, porque dos criterios harían que la fecha dijera una cosa y las métricas otra.
 *
 * 🔴 Y LA MADURACIÓN SE MIDE COMPARANDO DOS FOTOS DE SFMC, no suponiendo. Un envío de julio que
 *    «sigue dando resultados» es un envío cuyas aperturas y clics CRECIERON entre una descarga y
 *    otra, para el MISMO día de envío. Si no crecieron, lo que hay son envíos nuevos, que es otra
 *    cosa y se reporta aparte.
 *
 *   node resumen.piezas-por-quincena.js 001-P015 001-P016 …
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var Q = require(BACK + '/_scripts/lib-quincena.js');
var FE = require(BACK + '/_scripts/lib-fechas-envio.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var n = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var mil = function (v) { return Number(v || 0).toLocaleString('es-MX'); };
var pct = function (a, b) { return b ? (a / b * 100).toFixed(2) + '%' : '—'; };

var IDS = process.argv.slice(2).filter(function (a) { return /^\d{3}-P\d{3}$/.test(a); });
if (!IDS.length) { console.log('uso: node resumen.piezas-por-quincena.js 001-P015 001-P016 ...'); process.exit(2); }

function fotos() {
  return fs.readdirSync(BACK + '/_insumos').filter(function (x) { return /^sfmc-detalle-\d{4}-\d{2}-\d{2}\.txt$/.test(x); }).sort();
}
function leer(f) { return (JSON.parse(fs.readFileSync(BACK + '/_insumos/' + f, 'utf8')).rows || []); }

var FS_ = fotos();
var VIEJA = FS_[0], NUEVA = FS_[FS_.length - 1];
var R = leer(NUEVA).filter(function (r) { return IDS.indexOf(t(r.ConfigKey)) >= 0; });
console.log('════════ RESULTADOS POR QUINCENA ════════\n');
console.log('  foto de SFMC: ' + NUEVA.replace(/sfmc-detalle-|\.txt/g, '') + '   ·   filas de estas piezas: ' + R.length);
if (!R.length) { console.log('  🔴 el detalle no trae ninguna de esas piezas — ¿el ConfigKey es otro?'); process.exit(1); }

// 🔴 los jobs de prueba: un job con menos de 10 envíos no es un envío, es alguien revisando
var porJob = {};
R.forEach(function (r) { var j = t(r.JobID); porJob[j] = (porJob[j] || 0) + n(r.Email_Sends); });
var pruebas = Object.keys(porJob).filter(function (j) { return porJob[j] < 10; });
var sendsPrueba = pruebas.reduce(function (a, j) { return a + porJob[j]; }, 0);
console.log('  jobs de prueba descartados: ' + pruebas.length + ' (' + mil(sendsPrueba) + ' envío(s))');
R = R.filter(function (r) { return pruebas.indexOf(t(r.JobID)) < 0; });

// agrupar por pieza y quincena del DÍA DE ENVÍO
var M = ['Email_Sends', 'Email_Deliveries', 'Email_Unique_Opens', 'Email_Unique_Clicks', 'Email_Unique_Unsubs', 'Email_Bounces'];
var G = {}, dimDe = {};
R.forEach(function (r) {
  var dia = t(r.SendDay).slice(0, 10);
  var q = Q.deFecha(dia);
  var k = t(r.ConfigKey) + '¦' + q;
  if (!G[k]) { G[k] = { pieza: t(r.ConfigKey), q: q, dias: {} }; M.forEach(function (m) { G[k][m] = 0; }); }
  M.forEach(function (m) { G[k][m] += n(r[m]); });
  G[k].dias[dia] = 1;
  dimDe[t(r.ConfigKey)] = { tp: t(r.Touchpoint), seg: t(r.Segmento), fup: /^(s|1|true)/i.test(t(r.Es_FUP)), asunto: t(r.Email_Subject) };
});

// ── por pieza, abierto por quincena ───────────────────────────────────────────────
IDS.forEach(function (id) {
  var d = dimDe[id]; if (!d) { console.log('\n  ⊘ ' + id + ' no aparece en el detalle'); return; }
  var filas = Object.keys(G).filter(function (k) { return G[k].pieza === id; }).sort(function (a, b) { return G[a].q < G[b].q ? -1 : 1; });
  console.log('\n── ' + id + '   ' + d.tp + '   ·   ' + d.seg + '   ·   ' + (d.fup ? 'FUP' : 'Principal'));
  console.log('   «' + d.asunto.slice(0, 84) + '»');
  console.log('   ' + 'quincena'.padEnd(13) + 'días'.padStart(5) + 'envíos'.padStart(10) + 'entregas'.padStart(10) +
    'aperturas'.padStart(10) + 'clicks'.padStart(8) + 'bajas'.padStart(7) + '   OR'.padStart(9) + '  CTOR'.padStart(8) + '  CTR'.padStart(8));
  var T = { }; M.forEach(function (m) { T[m] = 0; });
  filas.forEach(function (k) {
    var g = G[k]; M.forEach(function (m) { T[m] += g[m]; });
    console.log('   ' + g.q.padEnd(13) + String(Object.keys(g.dias).length).padStart(5) +
      mil(g.Email_Sends).padStart(10) + mil(g.Email_Deliveries).padStart(10) + mil(g.Email_Unique_Opens).padStart(10) +
      mil(g.Email_Unique_Clicks).padStart(8) + mil(g.Email_Unique_Unsubs).padStart(7) +
      pct(g.Email_Unique_Opens, g.Email_Deliveries).padStart(9) + pct(g.Email_Unique_Clicks, g.Email_Unique_Opens).padStart(8) +
      pct(g.Email_Unique_Clicks, g.Email_Deliveries).padStart(8));
  });
  if (filas.length > 1) {
    console.log('   ' + 'TOTAL'.padEnd(18) + mil(T.Email_Sends).padStart(10) + mil(T.Email_Deliveries).padStart(10) +
      mil(T.Email_Unique_Opens).padStart(10) + mil(T.Email_Unique_Clicks).padStart(8) + mil(T.Email_Unique_Unsubs).padStart(7) +
      pct(T.Email_Unique_Opens, T.Email_Deliveries).padStart(9) + pct(T.Email_Unique_Clicks, T.Email_Unique_Opens).padStart(8) +
      pct(T.Email_Unique_Clicks, T.Email_Deliveries).padStart(8));
  }
});

// ══ ¿SIGUIERON MADURANDO? dos fotos, mismo día de envío ═══════════════════════════
console.log('\n\n════════ ¿LOS ENVÍOS VIEJOS SIGUEN DANDO RESULTADOS? ════════');
console.log('  se compara la MISMA foto de cada día de envío entre dos descargas de SFMC:');
console.log('  ' + VIEJA.replace(/sfmc-detalle-|\.txt/g, '') + '   →   ' + NUEVA.replace(/sfmc-detalle-|\.txt/g, '') + '\n');
var V = {}, Nn = {};
function indexar(rows, dest) {
  rows.forEach(function (r) {
    if (IDS.indexOf(t(r.ConfigKey)) < 0) return;
    var k = t(r.ConfigKey) + '¦' + t(r.SendDay).slice(0, 10);
    if (!dest[k]) dest[k] = { sends: 0, opens: 0, clicks: 0 };
    dest[k].sends += n(r.Email_Sends); dest[k].opens += n(r.Email_Unique_Opens); dest[k].clicks += n(r.Email_Unique_Clicks);
  });
}
indexar(leer(VIEJA), V); indexar(leer(NUEVA), Nn);
var comunes = Object.keys(V).filter(function (k) { return Nn[k]; });
var nuevos = Object.keys(Nn).filter(function (k) { return !V[k]; });
var crecen = comunes.filter(function (k) { return Nn[k].opens > V[k].opens || Nn[k].clicks > V[k].clicks; });
console.log('  días de envío en las dos fotos: ' + comunes.length + '   ·   que CRECIERON: ' + crecen.length);
if (crecen.length) crecen.sort().forEach(function (k) {
  var p = k.split('¦');
  console.log('     ' + p[0] + '  envío del ' + p[1] + '   aperturas ' + mil(V[k].opens) + ' → ' + mil(Nn[k].opens) +
    '  (+' + mil(Nn[k].opens - V[k].opens) + ')   clicks ' + mil(V[k].clicks) + ' → ' + mil(Nn[k].clicks) + '  (+' + mil(Nn[k].clicks - V[k].clicks) + ')');
});
else console.log('     ⊘ NINGUNO creció: los envíos viejos ya no acumulan aperturas ni clics.');
if (nuevos.length) {
  console.log('\n  🔴 días de envío que NO estaban en la foto vieja (son envíos NUEVOS, no maduración):');
  nuevos.sort().forEach(function (k) {
    var p = k.split('¦');
    console.log('     ' + p[0] + '  ' + p[1] + '   ' + mil(Nn[k].sends) + ' envíos · ' + mil(Nn[k].opens) + ' aperturas · ' + mil(Nn[k].clicks) + ' clicks');
  });
}
