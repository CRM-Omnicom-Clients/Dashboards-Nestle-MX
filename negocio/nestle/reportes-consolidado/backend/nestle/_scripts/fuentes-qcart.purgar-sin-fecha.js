/*
 * fuentes-qcart.purgar-sin-fecha.js — SACAR DEL BLOQUE LOS EVENTOS QUE ENTRARON SIN FECHA.
 *
 * 🔴 POR QUÉ EXISTE Y POR QUÉ ES QUIRÚRGICO. El 21-sep entró a `_vigentes` el export AGREGADO de
 *    Qcart (`carts-2026-09-01-2026-09-30.csv`, una fila por shortlink × utm × tienda, SIN fecha)
 *    junto al crudo del mismo periodo. El cargador leyó los dos y **26 carritos entraron sin
 *    fecha**, encima de los mismos eventos que el crudo ya traía: la llave anti-duplicado lleva la
 *    fecha, así que sin fecha la llave es otra y el evento parece nuevo.
 *    El creador ya está arreglado (`lib-qcart` rechaza un CSV sin fecha y lo declara), pero el
 *    bloque es un LOG en modo append: lo ya escrito no se va solo. Y `--rebuild` no sirve —su
 *    guarda bloquea con razón, porque los CSV no cubren marzo-julio y reconstruir tiraría 2,363
 *    carritos viejos—. Por eso esta purga mínima.
 *
 * 🔴 NO BORRA «LO QUE NO ME GUSTA»: borra EXACTAMENTE los eventos sin fecha, y antes PRUEBA que
 *    todos vengan del archivo agregado. Si apareciera uno sin fecha de otra fuente, se detiene:
 *    sería otro problema y borrarlo escondería la pregunta.
 *
 *   node fuentes-qcart.purgar-sin-fecha.js              (seco)
 *   node fuentes-qcart.purgar-sin-fecha.js --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var RUTA = BACK + '/_fuentes/qcart.json';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

var Q = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
console.log('════════ qcart · PURGAR EVENTOS SIN FECHA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var res = {};
['carritos', 'productos'].forEach(function (tp) {
  var arr = Q[tp] || [];
  var malos = arr.filter(function (e) { return !t(e.fecha); });
  var fuentes = {};
  malos.forEach(function (e) { fuentes[t(e.fuente) || '(sin fuente)'] = (fuentes[t(e.fuente) || '(sin fuente)'] || 0) + 1; });
  res[tp] = { antes: arr.length, malos: malos.length, fuentes: fuentes, queda: arr.length - malos.length };
  console.log('  ' + tp.padEnd(11) + mil(arr.length) + ' eventos   ·   sin fecha: ' + malos.length +
    (malos.length ? '   → quedarían ' + mil(arr.length - malos.length) : '   ✔ nada que purgar'));
  Object.keys(fuentes).forEach(function (f) { console.log('        ' + String(fuentes[f]).padStart(5) + '  ' + f); });
});

// 🔴 LA PRUEBA ANTES DE BORRAR: todos los sin fecha vienen de un archivo AGREGADO (sin `-raw-`).
var sospechosos = [];
['carritos', 'productos'].forEach(function (tp) {
  Object.keys(res[tp].fuentes).forEach(function (f) { if (/-raw-/.test(f)) sospechosos.push(tp + ' ← ' + f); });
});
if (sospechosos.length) {
  console.log('\n  🔴 hay eventos sin fecha que vienen de un archivo CRUDO: ' + sospechosos.join(' · '));
  console.log('     Eso NO es el agregado: es otro problema y borrarlo lo escondería. No se purga nada.');
  process.exit(1);
}
var total = res.carritos.malos + res.productos.malos;
if (!total) { console.log('\n  ✅ no hay nada sin fecha. El bloque está limpio.'); process.exit(0); }
console.log('\n  ✔ los ' + total + ' vienen todos de un export agregado (sin `-raw-` en el nombre)');
if (!ESCRIBIR) { console.log('\n  (seco. Para purgar: --escribir)'); process.exit(0); }

fs.copyFileSync(RUTA, BACK + '/_fuentes/_qcart-antes-purga.json');
['carritos', 'productos'].forEach(function (tp) {
  Q[tp] = (Q[tp] || []).filter(function (e) { return t(e.fecha); });
});
Q.purga_sin_fecha = {
  fecha: new Date().toISOString().slice(0, 10),
  porque: 'el export AGREGADO de Qcart entró junto al crudo del mismo periodo; sus filas no traen fecha, así que la llave anti-duplicado no las reconoció como repetidas',
  carritos_quitados: res.carritos.malos, productos_quitados: res.productos.malos,
  fuentes: { carritos: res.carritos.fuentes, productos: res.productos.fuentes }
};
fs.writeFileSync(RUTA, JSON.stringify(Q, null, 1));

// releer del disco: lo que importa es lo que quedó
var V = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
var quedanMalos = (V.carritos || []).filter(function (e) { return !t(e.fecha); }).length +
  (V.productos || []).filter(function (e) { return !t(e.fecha); }).length;
console.log('\n  ── releído del disco');
console.log('     carritos  ' + mil(res.carritos.antes) + ' → ' + mil((V.carritos || []).length) + (((V.carritos || []).length === res.carritos.queda) ? '  ✔' : '  🔴'));
console.log('     productos ' + mil(res.productos.antes) + ' → ' + mil((V.productos || []).length) + (((V.productos || []).length === res.productos.queda) ? '  ✔' : '  🔴'));
console.log('     eventos sin fecha que quedan: ' + quedanMalos + (quedanMalos ? '  🔴' : '  ✔'));
console.log('\n  ✅ PURGADO   (respaldo en _fuentes/_qcart-antes-purga.json)');
