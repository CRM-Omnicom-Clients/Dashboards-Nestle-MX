// fuentes-email · ¿CUÁNTO PESAN LOS ENVÍOS DE PRUEBA EN CADA MÉTRICA? Mide, no escribe.
//
// 🔴 LO QUE PIDIÓ RICK (7-sep-2026): «no puede haber ya nada de prueba, limpia esto».
//    Hasta ahora las pruebas solo se excluían para fijar la FECHA. Sus métricas siguen dentro
//    de los totales, porque el bloque de email toma la tabla YA AGREGADA de SFMC
//    (`CRM_Email_Piezas`), y ahí los 8 jobs de E-PROP1 vienen sumados en uno.
//
// 🔴 UNA PRUEBA ENSUCIA MÁS LAS TASAS QUE LOS TOTALES. Son 203 envíos sobre 8.9 millones: en el
//    total no se nota. Pero quien manda la prueba SE LA ABRE — los jobs de 1 envío traen 1 open.
//    En una pieza chica eso mueve la tasa de apertura de verdad, y ahí sí se nota.
//
// Deja su medición en `_preescritura/` para poder revisarla ANTES de tocar nada.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var FE = require(__dirname + '/lib-fechas-envio.js');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

function vigente(p) {
  var dir = BACK + '/_insumos';
  var c = fs.readdirSync(dir).filter(function (f) { return new RegExp('^' + p + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return dir + '/' + c[c.length - 1];
}
var rutaDet = vigente('sfmc-detalle'), rutaPza = vigente('sfmc-piezas');
var det = (function () { var D = JSON.parse(fs.readFileSync(rutaDet, 'utf8')); return D.rows || D.data || []; })();
var pza = (function () { var D = JSON.parse(fs.readFileSync(rutaPza, 'utf8')); return D.rows || D.data || []; })();

console.log('════════ fuentes-email · CUÁNTO PESA LO DE PRUEBA ════════\n');
console.log('  detalle: ' + path.basename(rutaDet) + '   ·   ' + det.length + ' filas');
console.log('  umbral de prueba: menos de ' + FE.UMBRAL + ' envíos en un job\n');

// las métricas que el bloque toma de la DE agregada, y su nombre en el detalle
var MET = [
  { de: 'Email_Sends', det: 'Email_Sends' },
  { de: 'Email_Deliveries', det: 'Email_Deliveries' },
  { de: 'Email_Unique_Opens', det: 'Email_Unique_Opens' },
  { de: 'Email_Unique_Clicks', det: 'Email_Unique_Clicks' },
  { de: 'Email_Bounces', det: 'Email_Bounces' },
  { de: 'Email_Unique_Unsubs', det: 'Email_Unique_Unsubs' },
  { de: 'Email_Total_Unsubs', det: 'Email_Total_Unsubs' }
];

// por job: su volumen, para saber si es prueba
var jobs = {};
det.forEach(function (r) {
  var k = t(r.ConfigKey) + '¦' + t(r.JobID);
  if (!jobs[k]) jobs[k] = { ck: t(r.ConfigKey), envios: 0, filas: [] };
  jobs[k].envios += num(r.Email_Sends);
  jobs[k].filas.push(r);
});

// lo que aportan las pruebas, por ConfigKey y por métrica
var pruebaDe = {}, totDet = {}, totPrueba = {};
MET.forEach(function (m) { totDet[m.de] = 0; totPrueba[m.de] = 0; });
Object.keys(jobs).forEach(function (k) {
  var j = jobs[k], esPrueba = j.envios < FE.UMBRAL;
  j.filas.forEach(function (r) {
    MET.forEach(function (m) {
      var v = num(r[m.det]);
      totDet[m.de] += v;
      if (esPrueba) {
        totPrueba[m.de] += v;
        if (!pruebaDe[j.ck]) { pruebaDe[j.ck] = {}; MET.forEach(function (x) { pruebaDe[j.ck][x.de] = 0; }); pruebaDe[j.ck].jobs = 0; }
        pruebaDe[j.ck][m.de] += v;
      }
    });
    if (esPrueba && pruebaDe[j.ck]) { /* jobs se cuenta abajo, una vez */ }
  });
  if (esPrueba) { pruebaDe[j.ck] = pruebaDe[j.ck] || {}; pruebaDe[j.ck].jobs = (pruebaDe[j.ck].jobs || 0) + 1; }
});

console.log('  ── lo que aportan las PRUEBAS, por métrica');
MET.forEach(function (m) {
  var p = totPrueba[m.de], tt = totDet[m.de];
  console.log('     ' + m.de.padEnd(22) + mil(p).padStart(8) + ' de ' + mil(tt).padStart(11) +
    '   (' + (tt ? (p / tt * 100).toFixed(4) : '0') + '%)');
});

// 🔴 EL DETALLE TIENE QUE CUADRAR CON LA DE AGREGADA, o restar del agregado usando el detalle
//    sería restar peras de manzanas. Se comprueba ANTES de proponer nada.
console.log('\n  ── ¿el detalle cuadra con la DE agregada? (si no, no se puede restar)');
var cuadra = true;
MET.forEach(function (m) {
  var agg = pza.reduce(function (a, r) { return a + num(r[m.de]); }, 0);
  var d = totDet[m.de];
  var ok = agg === d;
  if (!ok) cuadra = false;
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + m.de.padEnd(22) + 'agregada ' + mil(agg).padStart(11) + '   detalle ' + mil(d).padStart(11) +
    (ok ? '' : '   difieren en ' + mil(agg - d)));
});

// las piezas más afectadas EN SU TASA, no en su total
console.log('\n  ── las piezas donde la prueba MÁS ensucia la tasa de apertura');
var lista = [];
pza.forEach(function (r) {
  var ck = t(r.ConfigKey), p = pruebaDe[ck]; if (!p) return;
  var dEl = num(r.Email_Deliveries), oEl = num(r.Email_Unique_Opens);
  var dLimpio = dEl - (p.Email_Deliveries || 0), oLimpio = oEl - (p.Email_Unique_Opens || 0);
  var orAntes = dEl ? oEl / dEl : 0, orDespues = dLimpio ? oLimpio / dLimpio : 0;
  lista.push({ ck: ck, jobs: p.jobs || 0, sends: p.Email_Sends || 0, opens: p.Email_Unique_Opens || 0,
    orAntes: orAntes, orDespues: orDespues, pp: (orAntes - orDespues) * 100, sendsTot: num(r.Email_Sends) });
});
lista.sort(function (a, b) { return Math.abs(b.pp) - Math.abs(a.pp); });
lista.slice(0, 8).forEach(function (x) {
  console.log('     ' + x.ck.padEnd(24) + x.jobs + ' prueba(s)   ' + mil(x.sends).padStart(4) + ' envíos · ' + mil(x.opens).padStart(4) + ' opens   ' +
    'OR ' + (x.orAntes * 100).toFixed(3) + '% → ' + (x.orDespues * 100).toFixed(3) + '%   (' + (x.pp >= 0 ? '-' : '+') + Math.abs(x.pp).toFixed(3) + ' pp)');
});
console.log('     piezas con alguna prueba: ' + lista.length + ' de ' + pza.length);

fs.writeFileSync(BACK + '/_preescritura/pruebas-por-pieza.json', JSON.stringify({
  cuando: new Date().toISOString(), volcado: path.basename(rutaDet), umbral: FE.UMBRAL,
  cuadra_con_agregada: cuadra, total_prueba: totPrueba, total_detalle: totDet, por_pieza: pruebaDe
}, null, 1));
console.log('\n  ' + (cuadra ? '✅ el detalle CUADRA con la agregada: se puede restar métrica por métrica'
  : '🔴 el detalle NO cuadra con la agregada: restar sería mezclar dos fuentes. NO se resta.'));
console.log('  → _preescritura/pruebas-por-pieza.json');
process.exit(cuadra ? 0 : 1);
