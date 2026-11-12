/*
 * fuentes-insumos.deriva-sfmc.js — cuánto se movió SFMC desde el volcado vigente.
 *
 * POR QUÉ EXISTE. Las métricas de email ACUMULAN: aperturas y clicks siguen sumando días después
 * del envío. El volcado se congela el día que se toma, así que el reporte dice lo que SFMC decía
 * ESE día. Eso está bien —es una foto con fecha— pero hay que poder VER la diferencia antes de
 * decidir si se refresca, porque refrescar mueve cifras que ya se reportaron.
 *
 * 🔴 ESTO NO ESCRIBE NADA. Solo mide. La decisión de refrescar es de Rick, y necesita ver el
 *    tamaño del movimiento para tomarla: no es lo mismo que una pieza de esta quincena sume 1,152
 *    aperturas a que una campaña cerrada hace dos meses se mueva.
 *
 * 🔴 Y COMPARA LO COMPARABLE: los envíos NO deberían moverse nunca (un envío ya salió). Si se
 *    mueven, no es maduración — es otra cosa, y se declara aparte.
 *
 *   node fuentes-insumos.deriva-sfmc.js --pegado <archivo.json>
 *   (el archivo trae las filas tal como las devolvió el MCP; R14: el MCP es de SOLO LECTURA)
 */
var fs = require('fs');
var os = require('os');
var INS = require('path').resolve(__dirname, '..') + '/_insumos';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v == null ? 0 : v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n).toLocaleString('es-MX'); };

var iP = process.argv.indexOf('--pegado');
if (iP < 0) { console.log('  falta --pegado <archivo.json> con las filas de SFMC'); process.exit(1); }
var AHORA = JSON.parse(fs.readFileSync(process.argv[iP + 1], 'utf8'));
var filas = AHORA.rows || AHORA;

function vigente(pref) {
  var c = fs.readdirSync(INS).filter(function (f) { return new RegExp('^' + pref + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? c[c.length - 1] : null;
}
var base = vigente('sfmc-piezas');
var D = JSON.parse(fs.readFileSync(INS + '/' + base, 'utf8'));
var porCK = {};
D.rows.forEach(function (r) { porCK[t(r.ConfigKey)] = r; });

// 🔴 los envíos van APARTE del resto. Un envío que cambia no es maduración.
var ESTRUCTURA = ['Email_Sends', 'Email_Deliveries', 'Email_Bounces'];
var ENGAGEMENT = ['Email_Unique_Opens', 'Email_Unique_Clicks', 'Email_Unique_Unsubs', 'Email_Total_Unsubs'];

console.log('════════ DERIVA DE SFMC contra ' + base + ' ════════\n');
console.log('  ConfigKey'.padEnd(28) + 'TP'.padEnd(9) + 'envíos'.padStart(10) +
  '   aperturas (Δ)'.padEnd(24) + 'clicks (Δ)'.padEnd(16) + 'bajas (Δ)');

var totales = {}, movidas = 0, estructural = [];
ENGAGEMENT.forEach(function (m) { totales[m] = 0; });
var lista = [];

filas.forEach(function (r) {
  var ck = t(r.ConfigKey), viejo = porCK[ck];
  if (!viejo) { console.log('  ⚠ ' + ck + ' no está en el volcado (pieza nueva)'); return; }
  var d = {}, hayCambio = false;
  ENGAGEMENT.concat(ESTRUCTURA).forEach(function (m) {
    d[m] = num(r[m]) - num(viejo[m]);
    if (d[m] !== 0) hayCambio = true;
  });
  ESTRUCTURA.forEach(function (m) {
    if (d[m] !== 0) estructural.push(ck + ' · ' + m + ': ' + mil(num(viejo[m])) + ' → ' + mil(num(r[m])) + '  (Δ ' + d[m] + ')');
  });
  if (!hayCambio) return;
  movidas++;
  ENGAGEMENT.forEach(function (m) { totales[m] += d[m]; });
  lista.push({ ck: ck, tp: t(r.Touchpoint), r: r, viejo: viejo, d: d });
});

// 🔴 se ordena por el tamaño del movimiento de aperturas: lo grande primero, para poder decidir
lista.sort(function (a, b) { return Math.abs(b.d.Email_Unique_Opens) - Math.abs(a.d.Email_Unique_Opens); });
lista.forEach(function (x) {
  var f = function (m) {
    var v = num(x.r[m]), dd = x.d[m];
    return mil(v) + (dd ? ' (' + (dd > 0 ? '+' : '') + mil(dd) + ')' : '');
  };
  console.log('  ' + x.ck.padEnd(28) + x.tp.slice(0, 8).padEnd(9) + mil(num(x.r.Email_Sends)).padStart(10) +
    '   ' + f('Email_Unique_Opens').padEnd(21) + f('Email_Unique_Clicks').padEnd(16) + f('Email_Unique_Unsubs'));
});

console.log('\n  ── piezas que se movieron: ' + movidas + ' de ' + filas.length);
ENGAGEMENT.forEach(function (m) {
  console.log('     ' + m.replace('Email_', '').padEnd(16) + (totales[m] >= 0 ? '+' : '') + mil(totales[m]));
});
if (estructural.length) {
  console.log('\n  🔴 SE MOVIÓ ALGO QUE NO DEBERÍA (envíos/entregas/rebotes ya no cambian):');
  estructural.forEach(function (s) { console.log('     ' + s); });
} else {
  console.log('\n  ✔ envíos, entregas y rebotes IDÉNTICOS — lo único que se movió es maduración de engagement');
}
console.log('\n  (esto no escribe nada: es para decidir)');
