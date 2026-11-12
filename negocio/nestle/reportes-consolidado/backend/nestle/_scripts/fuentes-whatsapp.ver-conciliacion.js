// fuentes-whatsapp · QUÉ CAMBIÓ LA CONCILIACIÓN DE ENTREGAS, envío por envío.
// 🔴 El bloque guarda `entregados_hoja` (lo que decía la hoja) junto a `deliveries` (lo conciliado),
//    así que la corrección se puede auditar sin volver a abrir la fuente. Un cambio que no se puede
//    comparar con lo anterior no es una corrección: es un número nuevo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var W = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX'); };

console.log('════════ WHATSAPP · LA CONCILIACIÓN DE ENTREGAS ════════\n');
var sE = 0, sEntAntes = 0, sEntAhora = 0, sNo = 0, cambiados = 0;
console.log('  ' + 'pieza'.padEnd(10) + 'campaña'.padEnd(16) + 'TP'.padEnd(13) +
  'envíos'.padStart(8) + 'entregados'.padStart(20) + 'no entreg.'.padStart(11) + '   cierra');
W.envios.forEach(function (e) {
  var antes = e.entregados_hoja, ahora = e.deliveries;
  var cambio = Number(antes) !== Number(ahora);
  if (cambio) cambiados++;
  sE += e.sends || 0; sEntAntes += Number(antes) || 0; sEntAhora += Number(ahora) || 0; sNo += Number(e.no_entregados) || 0;
  var cierra = (Number(ahora) + Number(e.no_entregados)) === Number(e.sends);
  console.log('  ' + t(e.pieza_id).padEnd(10) + t(e.campana_canonica).slice(0, 15).padEnd(16) + t(e.touchpoint_canonico).padEnd(13) +
    mil(e.sends).padStart(8) +
    (cambio ? (mil(antes) + ' → ' + mil(ahora)).padStart(20) : mil(ahora).padStart(20)) +
    mil(e.no_entregados).padStart(11) + '   ' + (cierra ? '✔' : '🔴'));
});
console.log('\n  ' + 'Σ'.padEnd(39) + mil(sE).padStart(8) +
  (sEntAntes !== sEntAhora ? (mil(sEntAntes) + ' → ' + mil(sEntAhora)).padStart(20) : mil(sEntAhora).padStart(20)) + mil(sNo).padStart(11));
console.log('  ' + (sEntAhora + sNo === sE ? '✔ entregados + no entregados = envíos, exacto' : '🔴 NO cierra: ' + mil(sEntAhora + sNo) + ' vs ' + mil(sE)));
console.log('  filas corregidas: ' + cambiados + ' de ' + W.envios.length);

var incoh = W.envios.filter(function (e) { return e.entrega_coherente === false; });
if (incoh.length) {
  console.log('\n  ── las filas donde la HOJA se contradecía (y qué se hizo)');
  incoh.forEach(function (e) {
    console.log('     ' + t(e.pieza_id) + '  ' + t(e.hoja) + '!' + e.fila_en_hoja);
    console.log('        ' + t(e.entrega_nota));
  });
}
var conNota = W.envios.filter(function (e) { return e.entrega_coherente !== false && t(e.entrega_nota); });
if (conNota.length) {
  console.log('\n  ── coherentes, con comprobación contra la tasa que publica la hoja');
  conNota.forEach(function (e) { console.log('     ' + t(e.pieza_id).padEnd(10) + t(e.entrega_nota)); });
}
