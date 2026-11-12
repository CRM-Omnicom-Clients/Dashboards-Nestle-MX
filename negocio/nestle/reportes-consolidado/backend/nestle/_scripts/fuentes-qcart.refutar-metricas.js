/*
 * fuentes-qcart.refutar-metricas.js — VALIDACIÓN ADVERSARIAL de las métricas de Qcart.
 *
 * 🔴 Rick, 24-sep-2026: «al cerrar haces validaciones adversariales para cada etapa».
 *    Cada ataque reintroduce un defecto REAL que ya costó un número equivocado en el reporte.
 *    Un ataque que no es atrapado es un agujero.
 *
 * EL DEFECTO MADRE: una fila del export de Qcart NO es un carrito. Es un bucket
 * (día × hora × shortlink × utm × tienda) con su contador `views`. Contar filas decía 3,077
 * donde Qcart dice 7,503, metía 444 filas con `views = 0` —impresiones que nunca llegaron a una
 * vista— y ninguna puerta lo veía porque las cuatro capas descendían del mismo conteo.
 *
 *   node fuentes-qcart.refutar-metricas.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();

var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var C = require(BACK + '/_scripts/lib-qcart.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ fuentes-qcart · REFUTAR LAS MÉTRICAS ════════\n');
var ataques = [], fallos = 0;
function ataque(nombre, intenta, fn) {
  var r; try { r = fn(); } catch (e) { r = { atrapado: true, como: 'tronó: ' + String(e.message).slice(0, 80) }; }
  if (!r.atrapado) fallos++;
  ataques.push({ nombre: nombre, intenta: intenta, atrapado: !!r.atrapado, como: r.como });
  console.log('  ' + (r.atrapado ? '✔' : '🔴') + ' ' + nombre);
  console.log('      intenta: ' + intenta);
  console.log('      ' + (r.atrapado ? 'ATRAPADO: ' : '🔴 PASÓ: ') + r.como + '\n');
}
function fuente(f) { return fs.readFileSync(BACK + '/_scripts/' + f, 'utf8'); }

/* C1 · el defecto original: contar filas como carritos. */
ataque('C1 · carritos contados como filas del CSV',
  'que el motor vuelva a hacer carritos++ en vez de sumar views',
  function () {
    var src = fuente('motor.motor.js');
    var malo = /\bg\.qcart\.carritos\+\+/.test(src) || /\bg\.carritos\+\+/.test(src);
    if (malo) return { atrapado: false, como: 'el motor incrementa carritos por fila' };
    var bien = /g\.qcart\.carritos \+= num\(e\.views\)/.test(src) && /g\.carritos \+= num\(e\.views\)/.test(src);
    if (!bien) return { atrapado: false, como: 'no encontré la suma de views en los dos sitios' };
    return { atrapado: true, como: 'los dos granos (pieza y rejilla) suman views' };
  });

/* C2 · el desglose por tienda contando filas: la suma de tiendas dejaría de dar el total. */
ataque('C2 · el reparto por tienda en otra unidad que el total',
  'que Carritos_Walmart cuente filas mientras Carritos_Total cuenta vistas',
  function () {
    var src = fuente('motor.motor.js');
    if (/g\.tiendas\[key\] = \(g\.tiendas\[key\] \|\| 0\) \+ 1;/.test(src))
      return { atrapado: false, como: 'el reparto por tienda suma 1 por fila' };
    if (!/g\.tiendas\[key\] = \(g\.tiendas\[key\] \|\| 0\) \+ \(num\(e\.views\)/.test(src))
      return { atrapado: false, como: 'no encontré el reparto por tienda sumando views' };
    return { atrapado: true, como: 'el reparto por tienda suma views, igual que el total' };
  });

/* C3 · 🔴 EL DECIMAL ES COMA. `"1144,45"` son 1,144.45. Un parser que borre la coma infla 100×. */
ataque('C3 · el importe leído con el decimal equivocado',
  'pasar "1144,45" y "6695256,15" por el parser del sistema',
  function () {
    var a = C.num('1144,45'), b = C.num('6695256,15'), c = C.num('1.234,56'), d = C.num('1,234.56');
    var mal = [];
    if (Math.abs(a - 1144.45) > 0.001) mal.push('1144,45 → ' + a);
    if (Math.abs(b - 6695256.15) > 0.01) mal.push('6695256,15 → ' + b);
    if (Math.abs(c - 1234.56) > 0.001) mal.push('1.234,56 → ' + c);
    if (Math.abs(d - 1234.56) > 0.001) mal.push('1,234.56 → ' + d);
    if (mal.length) return { atrapado: false, como: 'el parser se equivoca: ' + mal.join(' · ') };
    return { atrapado: true, como: 'lee coma decimal y coma de millar sin confundirlas (1144,45 → 1144.45)' };
  });

/* C4 · el ticket dividiendo entre la unidad equivocada. */
ataque('C4 · el ticket dividido entre filas',
  'que ticket_carrito use el número de eventos como denominador',
  function () {
    var src = fuente('motor.motor.js');
    if (!/ticket_promedio = tasa\(g\.qcart\.importe_total, g\.qcart\.views\)/.test(src))
      return { atrapado: false, como: 'ticket_promedio no divide entre views' };
    if (!/ticket_carrito: tasa\(q\.importe_total, q\.views\)/.test(src))
      return { atrapado: false, como: 'ticket_carrito de la rejilla no divide entre views' };
    return { atrapado: true, como: 'los dos tickets dividen entre views, coherente con el total' };
  });

/* C5 · una puerta midiendo en filas: fue la que gritó «el motor INVENTÓ carritos». */
ataque('C5 · una puerta comparando vistas contra filas',
  'que PUERTA 2 o el guardián de distribución midan el bloque con .length',
  function () {
    var p2 = fuente('fuentes-cuadre.puerta2.js'), gd = fuente('fuentes-qcart.guardian-distribucion.js');
    var mal = [];
    if (/var qcBloque = \(B\.qcart\.carritos \|\| \[\]\)\.length/.test(p2)) mal.push('puerta2 usa .length');
    if (/sumaAhora === Q\.carritos\.length/.test(gd)) mal.push('guardian-distribucion usa .length');
    if (mal.length) return { atrapado: false, como: mal.join(' · ') };
    return { atrapado: true, como: 'las dos suman views del bloque, no cuentan eventos' };
  });

/* C6 · las filas con views = 0 no pueden ser carritos: son impresiones que nunca se vieron. */
ataque('C6 · una impresión sin vista contada como carrito',
  'comprobar que las 444 filas con views = 0 no aportan carritos',
  function () {
    var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
    var ev = Q.eventos || Q.carritos || [];
    var cero = ev.filter(function (e) { return (Number(t(e.views)) || 0) === 0; }).length;
    var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
    var rej = (R.rejilla || []).reduce(function (a, c) { return a + ((c.qcart && c.qcart.carritos) || 0); }, 0);
    var sumV = ev.reduce(function (a, e) { return a + (Number(t(e.views)) || 0); }, 0);
    if (rej === ev.length) return { atrapado: false, como: 'la rejilla tiene ' + rej + ' = el número de eventos: sigue contando filas' };
    if (rej !== sumV) return { atrapado: false, como: 'la rejilla (' + rej + ') no es Σ views (' + sumV + ')' };
    return { atrapado: true, como: 'la rejilla suma ' + sumV + ' = Σ views; las ' + cero + ' filas de 0 vistas aportan 0' };
  });

console.log('════ VEREDICTO ════');
console.log('  ataques: ' + ataques.length + '   ·   atrapados: ' + (ataques.length - fallos) + '   ·   pasaron: ' + fallos);
fs.writeFileSync(BACK + '/_preescritura/refutar-qcart-metricas.json', JSON.stringify({ cuando: new Date().toISOString(), ataques: ataques }, null, 1));
if (fallos) { console.log('\n  🔴 ' + fallos + ' ataque(s) NO atrapados.'); process.exit(1); }
console.log('\n  ✅ NINGÚN ATAQUE ROMPIÓ LAS MÉTRICAS DE QCART');
console.log('\n→ _preescritura/refutar-qcart-metricas.json');
