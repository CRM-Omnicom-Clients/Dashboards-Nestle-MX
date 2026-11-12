/*
 * fuentes-insumos.refrescar-metricas.js — sube al volcado la MADURACIÓN de las métricas.
 *
 * POR QUÉ EXISTE, y por qué no es «volver a bajar la DE».
 *   Las aperturas y los clicks de un correo siguen sumando días después del envío. El volcado se
 *   congela el día que se toma, así que el reporte dice lo que SFMC decía ESE día — lo cual está
 *   bien y es honesto, pero se queda atrás. Rick lo pidió el 15-sep: «sí actualizas».
 *   Bajar la DE entera movería las 106 piezas de golpe; esto refresca SOLO las que se le pasan,
 *   y deja el resto exactamente como estaba, igual que el volcado mixto.
 *
 * 🔴 SOLO MADURACIÓN. Los envíos, las entregas y los rebotes NO se tocan y encima se COMPRUEBA
 *    que vengan idénticos: un envío que ya salió no cambia de tamaño. Si cambiaran, no sería
 *    maduración sino otra cosa —un re-envío, una pieza mal identificada— y eso se decide, no se
 *    escribe de pasada. El paso se detiene.
 *
 * 🔴 MONÓTONO. Una métrica acumulada no puede BAJAR. Si SFMC devuelve menos que el volcado, se
 *    conserva el valor viejo y se declara: casi siempre significa que la DE se reprocesó a medias.
 *    Es la misma regla de MAX por llave que ya rige el refresh de email.
 *
 * 🔴 Y SE TOCAN LOS DOS VOLCADOS. El de piezas trae la agregada; el de detalle trae los jobs, de
 *    donde sale el criterio de «prueba». Refrescar solo uno dejaría la resta de pruebas midiendo
 *    contra una foto y la métrica contra otra.
 *
 *   node fuentes-insumos.refrescar-metricas.js --piezas <a.json> --detalle <b.json> [--escribir]
 */
var fs = require('fs');
var os = require('os');
var INS = require('path').resolve(__dirname, '..') + '/_insumos';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v == null ? 0 : v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n).toLocaleString('es-MX'); };
var HOY = new Date().toISOString().slice(0, 10);

function arg(f) { var i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; }
var fPza = arg('--piezas'), fDet = arg('--detalle');
if (!fPza || !fDet) { console.log('  falta --piezas <a.json> --detalle <b.json>'); process.exit(1); }
function leer(p) { var d = JSON.parse(fs.readFileSync(p, 'utf8')); return d.rows || d; }
var NUEVO_P = leer(fPza), NUEVO_D = leer(fDet);

// 🔴 lo que PUEDE moverse vs lo que NO. Separarlo es lo que hace que esto sea seguro.
var MADURA = ['Email_Unique_Opens', 'Email_Total_Opens', 'Email_Unique_Clicks', 'Email_Total_Clicks',
  'Email_Unique_Unsubs', 'Email_Total_Unsubs'];
var CONGELADO = ['Email_Sends', 'Email_Deliveries', 'Email_Bounces'];
// las tasas las recalcula el motor, pero el volcado las trae y no se dejan mintiendo
var TASAS = ['Open_Rate', 'Click_Rate', 'CTOR', 'Delivery_Rate', 'Bounce_Rate'];

function vigente(pref) {
  var c = fs.readdirSync(INS).filter(function (f) { return new RegExp('^' + pref + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? c[c.length - 1] : null;
}

console.log('════════ fuentes-insumos · REFRESCAR MADURACIÓN ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var congelados = [], bajaron = [], subieron = 0, tocadas = {}, delta = {};
MADURA.forEach(function (m) { delta[m] = 0; });

function aplicar(viejo, nuevo, quien) {
  // 1 · lo que no debe moverse, no se movió
  CONGELADO.forEach(function (m) {
    if (nuevo[m] === undefined) return;
    if (num(viejo[m]) !== num(nuevo[m])) {
      congelados.push(quien + ' · ' + m + ': ' + mil(num(viejo[m])) + ' → ' + mil(num(nuevo[m])));
    }
  });
  // 2 · la maduración, monótona
  var cambio = false;
  MADURA.forEach(function (m) {
    if (nuevo[m] === undefined) return;
    var a = num(viejo[m]), b = num(nuevo[m]);
    if (b < a) { bajaron.push(quien + ' · ' + m + ': ' + mil(a) + ' → ' + mil(b) + '  (se CONSERVA ' + mil(a) + ')'); return; }
    if (b === a) return;
    viejo[m] = String(b); delta[m] += (b - a); cambio = true;
  });
  if (cambio) { subieron++; tocadas[quien] = 1; TASAS.forEach(function (m) { if (nuevo[m] !== undefined) viejo[m] = String(nuevo[m]); }); }
  if (cambio && nuevo.LastRefresh !== undefined) viejo.LastRefresh = String(nuevo.LastRefresh);
  return cambio;
}

var TAREAS = [
  { pref: 'sfmc-piezas', nuevas: NUEVO_P, llave: function (r) { return t(r.ConfigKey); }, que: 'pieza' },
  { pref: 'sfmc-detalle', nuevas: NUEVO_D, llave: function (r) { return t(r.JobID); }, que: 'job' }
];

var listo = [];
TAREAS.forEach(function (T) {
  var base = vigente(T.pref);
  if (!base) { console.log('  🔴 no hay volcado ' + T.pref + '-*'); process.exit(1); }
  var d = JSON.parse(fs.readFileSync(INS + '/' + base, 'utf8'));
  var idx = {}; d.rows.forEach(function (r) { idx[T.llave(r)] = r; });
  var noEstan = 0, movidas = 0;
  T.nuevas.forEach(function (n) {
    var k = T.llave(n), v = idx[k];
    if (!v) { noEstan++; return; }
    if (aplicar(v, n, T.que + ' ' + k)) movidas++;
  });
  console.log('  ' + T.pref.padEnd(14) + 'base ' + base + '   ' + d.rows.length + ' filas   ·   ' +
    T.nuevas.length + ' recibidas   ·   ' + movidas + ' movidas' + (noEstan ? '   ⚠ ' + noEstan + ' no están en el volcado' : ''));
  d.refrescado = (d.refrescado || []).concat([{
    fecha: HOY, filas: T.nuevas.length, movidas: movidas,
    nota: 'refresco de MADURACIÓN: solo aperturas, clicks y bajas, monótono. Envíos, entregas y rebotes comprobados idénticos. Las demás piezas del volcado conservan sus cifras a propósito.'
  }]);
  listo.push({ archivo: INS + '/' + T.pref + '-' + HOY + '.txt', datos: d });
});

console.log('\n  ── lo que se movió');
MADURA.forEach(function (m) { if (delta[m]) console.log('     ' + m.replace('Email_', '').padEnd(16) + '+' + mil(delta[m])); });
console.log('     filas tocadas: ' + Object.keys(tocadas).length);

// 🔴 las dos razones por las que esto NO escribe
if (congelados.length) {
  console.log('\n  🔴 NO SE ESCRIBE — se movió algo que no puede moverse (no es maduración):');
  congelados.forEach(function (x) { console.log('     ' + x); });
  process.exit(1);
}
console.log('\n  ✔ envíos, entregas y rebotes IDÉNTICOS en las ' + (NUEVO_P.length + NUEVO_D.length) + ' filas recibidas');
if (bajaron.length) {
  console.log('  ⚠ ' + bajaron.length + ' métrica(s) venían MÁS BAJAS que el volcado; se conservó el valor alto (monotonía):');
  bajaron.slice(0, 10).forEach(function (x) { console.log('     ' + x); });
}

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
listo.forEach(function (x) {
  fs.writeFileSync(x.archivo, JSON.stringify(x.datos), 'utf8');
  var re = JSON.parse(fs.readFileSync(x.archivo, 'utf8'));
  console.log('  ✔ ' + x.archivo.split(/[\\/]/).pop().padEnd(30) + re.rows.length + ' filas   ·   releído del disco');
});
console.log('\n  ✅ VOLCADOS REFRESCADOS. La cadena tomará estos por ser los más recientes.');
