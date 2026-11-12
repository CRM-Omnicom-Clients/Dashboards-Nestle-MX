/*
 * fuentes-whatsapp.auditar-entregas.js — ¿CIERRA `ENTREGADOS + NO ENTREGADOS = ENVÍOS`?
 *
 * 🔴 LO PIDIÓ RICK (20-sep-2026): «de 008-P007 entregados no puede ser lo mismo que envíos.
 *    Corrige ese tipo de incongruencias desde la fuente, debe haber cálculos mal, sin perder los
 *    datos de Tercer Tiempo — eran como 7K envíos en total, ¿no?».
 *
 * 🔴 LAS CINCO HOJAS TIENEN CINCO ESQUEMAS, y no es un detalle: cada una llama distinto a lo mismo
 *    y tres de ellas definen «entregado» de forma distinta.
 *      · Hotcakes       ENVÍOS · ENTREGAS · ERRORES          →  312 − 86 = 226 ✔ cierra
 *      · Maggi Mundial  Envíos · Entregados · No entregados  →  ya viene calculado
 *      · Tercer Tiempo  Total Sent · Total Received · ERROR Undelivered · Delivery Unknown
 *      · Maggi Liga MX  Total Sent · Total Received · Undelivered · Failed · Delivery Unknown
 *      · ICE            Total Sent · Total Received · Undelivered ERROR · Failed · Delivery Unknown
 *
 * 🔴 EL «7K» DE RICK ES LA AUDIENCIA, NO LOS ENVÍOS. Tercer Tiempo declara
 *    `Total MGSC / Data Extension` = 2,000 + 5,000 = **7,000** (la Data Extension) y
 *    `Total Sent` = 1,817 + 3,996 = **5,813** (los mensajes que de verdad salieron).
 *    Las dos cifras son ciertas y son distintas; el bloque ya carga ambas.
 *
 * LA PRUEBA, y es una sola: **`envíos − entregados` tiene que ser igual a los fallos que la hoja
 * declara**. Si lo es, se respeta el dato de la hoja. Si no, la hoja se contradice y se deriva
 * `entregados = envíos − fallos` — nunca al revés, porque `Total Sent` es la única columna que las
 * cinco hojas traen y que ninguna se contradice.
 *
 *   node fuentes-whatsapp.auditar-entregas.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v == null ? '' : v).replace(/[, %]/g, '')); return isFinite(n) ? n : null; };
var mil = function (n) { return n === null ? '—' : Number(n).toLocaleString('es-MX'); };

var RUTA = ENT.fuente('whatsapp');
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_waaud.xlsx';
fs.copyFileSync(RUTA, tmp);
var wb = XLSX.readFile(tmp);

/* Qué columna es qué, por hoja. Se declara: deducirlo por parecido de nombre es exactamente el
 * atajo que ya movió datos a la columna de al lado en Qcart. */
var ESQUEMA = {
  'Hotcakes':      { envios: 'ENVÍOS', entregados: 'ENTREGAS', fallos: ['ERRORES'], etiqueta: 'SEGMENTO' },
  'Maggi Mundial': { envios: 'Envíos', entregados: 'Entregados', fallos: ['No entregados'], etiqueta: 'Journey' },
  'Tercer Tiempo': { envios: 'Total Sent', entregados: 'Total Received', fallos: ['ERROR Undelivered'], otros: ['Delivery Unknown', 'Failed'], audiencia: 'Total MGSC / Data Extension', etiqueta: 'Journey Name' },
  'Maggi Liga MX': { envios: 'Total Sent', entregados: 'Total Received', fallos: ['Undelivered', 'Failed'], otros: ['Delivery Unknown'], audiencia: 'Total MGSC / Data Extension', etiqueta: 'Journey Name' },
  'ICE':           { envios: 'Total Sent', entregados: 'Total Received', fallos: ['Undelivered ERROR'], otros: ['Delivery Unknown', 'Failed'], audiencia: 'Total MGSC / Data Extension', etiqueta: 'Journey Name' }
};

console.log('════════ WHATSAPP · ¿CIERRAN LAS ENTREGAS? ════════\n');
var propuesta = [], totalEnv = 0, totalEntAntes = 0, totalEntDespues = 0;

Object.keys(ESQUEMA).forEach(function (hoja) {
  var E = ESQUEMA[hoja];
  var s = wb.Sheets[hoja];
  if (!s) { console.log('  ⊘ no está la hoja ' + hoja); return; }
  var F = XLSX.utils.sheet_to_json(s, { header: 1, defval: '', blankrows: false });
  var enc = (F[0] || []).map(t);
  function ix(n) { return enc.indexOf(n); }
  var faltan = [E.envios, E.entregados].concat(E.fallos).filter(function (c) { return ix(c) < 0; });
  console.log('── ' + hoja + '   (' + enc.length + ' columnas)');
  if (faltan.length) { console.log('   🔴 no encuentro: ' + faltan.join(' · ') + '   — el esquema declarado no casa con la hoja\n'); return; }

  for (var r = 1; r < F.length; r++) {
    var env = num(F[r][ix(E.envios)]);
    if (env === null || env === 0) continue;
    var etq = t(F[r][ix(E.etiqueta)]).split(/[\r\n]/)[0].slice(0, 34);
    if (/^totales?$/i.test(etq) || /^total$/i.test(t(F[r][1]))) continue;   // la fila de subtotal no es un envío
    var ent = num(F[r][ix(E.entregados)]);
    var fall = E.fallos.reduce(function (a, c) { return a + (num(F[r][ix(c)]) || 0); }, 0);
    var otros = (E.otros || []).map(function (c) { return { c: c, v: num(F[r][ix(c)]) }; }).filter(function (x) { return x.v; });
    var aud = E.audiencia && ix(E.audiencia) >= 0 ? num(F[r][ix(E.audiencia)]) : null;

    var hueco = ent === null ? null : env - ent;
    var cierra = hueco !== null && Math.abs(hueco - fall) < 0.5;
    var entOK = cierra ? ent : env - fall;
    var noOK = env - entOK;

    totalEnv += env; totalEntAntes += (ent === null ? 0 : ent); totalEntDespues += entOK;
    propuesta.push({ hoja: hoja, fila: r + 1, etiqueta: etq, envios: env, aud: aud, ent_hoja: ent, fallos_hoja: fall, cierra: cierra, ent_ok: entOK, no_ok: noOK, otros: otros });

    console.log('   fila ' + String(r + 1).padStart(2) + '  ' + etq.padEnd(36) +
      'envíos ' + String(mil(env)).padStart(7) +
      (aud !== null ? '   audiencia ' + String(mil(aud)).padStart(6) : '') +
      (cierra ? '   ✔ cierra' : '   🔴 NO cierra'));
    console.log('        la hoja dice: entregados ' + String(mil(ent)).padStart(7) + '   fallos declarados ' + String(mil(fall)).padStart(6) +
      '   ·   envíos − entregados = ' + String(mil(hueco)).padStart(6) + (cierra ? '' : '   ≠ ' + mil(fall)));
    if (!cierra) console.log('        ⇒ se deriva:  entregados ' + String(mil(entOK)).padStart(7) + '   no entregados ' + String(mil(noOK)).padStart(6) + '   (suman ' + mil(entOK + noOK) + ' = envíos ✔)');
    if (otros.length) console.log('        (además declara: ' + otros.map(function (x) { return x.c + ' ' + mil(x.v); }).join(' · ') + ')');
  }
  console.log('');
});

var rotas = propuesta.filter(function (p) { return !p.cierra; });
console.log('══ RESUMEN ══');
console.log('  envíos ' + mil(totalEnv) + '   ·   filas que cierran: ' + (propuesta.length - rotas.length) + ' de ' + propuesta.length);
console.log('  entregados: la hoja dice ' + mil(totalEntAntes) + '   ·   corregido ' + mil(totalEntDespues) +
  '   (diferencia ' + mil(totalEntDespues - totalEntAntes) + ')');
if (rotas.length) {
  console.log('\n  🔴 las que NO cierran:');
  rotas.forEach(function (p) {
    console.log('     ' + (p.hoja + '!' + p.fila).padEnd(20) + p.etiqueta.slice(0, 30).padEnd(32) +
      'entregados ' + mil(p.ent_hoja) + ' → ' + mil(p.ent_ok) + '   ·   no entregados → ' + mil(p.no_ok));
  });
}
fs.writeFileSync(BACK + '/_preescritura/whatsapp-entregas.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), filas: propuesta.length, no_cierran: rotas.length,
  envios: totalEnv, entregados_hoja: totalEntAntes, entregados_corregido: totalEntDespues, detalle: propuesta
}, null, 1));
console.log('\n  → _preescritura/whatsapp-entregas.json');
try { fs.unlinkSync(tmp); } catch (e) { }
