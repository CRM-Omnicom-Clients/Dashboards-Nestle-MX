// nestle-catalogo · ¿ESTE MAPEO SIRVE? Se prueba DONDE LOS DOS LADOS YA TIENEN VALOR.
//
// 🔴 EL DEFECTO QUE ESTE PASO EVITA, Y CASI COMETO HACE UN MINUTO. La medición anterior propuso
//    llenar `Content_ID` desde `ConfigKey` porque los nombres se parecían y el campo estaba lleno
//    en las 104 filas. Pero `ConfigKey` no es el content id: es el **Pieza_ID** (`001-P001`).
//    Escribirlo habría metido ids de pieza en una columna de ids de contenido, en 30 celdas, sin
//    que ninguna suma cambiara y sin que ninguna puerta lo viera.
//
// 🔴 LA PRUEBA QUE LO ATRAPA. Un mapeo `columna ← campo` solo sirve si, en las piezas donde el
//    catálogo YA tiene valor y la DE también, los dos dicen lo mismo. Si discrepan, el mapeo está
//    mal y no se usa para llenar nada. Es el mismo principio que «simular el nodo siguiente»:
//    no se prueba el mapeo contra sí mismo, se prueba contra lo que ya está bien.
//
// 🔴 Y UN MAPEO SIN NINGÚN SOLAPE **NO PASA**: se declara `NO PUDE EVALUAR`. Cero desacuerdos
//    sobre cero casos es exactamente el check que pinta verde sin haber mirado nada.
//
// No escribe ni una celda.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;

var X = M.cargar();
console.log('════════ nestle-catalogo · PROBAR EL MAPEO CATÁLOGO ← SFMC ════════\n');
console.log('  volcado: ' + X.volcado + '   ·   ' + X.filas.length + ' piezas de SFMC');
console.log('  libro:   ' + path.basename(X.libro) + '   ·   ' + X.piezas.length + ' piezas con id válido');
console.log('  cruzan:  ' + X.cruzan + '\n');

var res = [];
M.MAPEO.forEach(function (m) {
  var nmH = X.columna(m.hoja, m.exacta);
  if (!nmH) { res.push({ m: m, veredicto: 'NO EXISTE', nota: 'la columna no está en la hoja' }); return; }
  var acuerdo = 0, desacuerdo = [], llenables = 0;
  X.piezas.forEach(function (p) {
    var f = X.sfmcDe(p); if (!f) return;
    var esperado = m.valor(f, p, X.fechasDe(p));
    if (esperado === null || t(esperado) === '') return;
    var actual = t(p[nmH]);
    if (M.esHueco(actual)) { llenables++; return; }
    if (m.iguales ? m.iguales(actual, esperado) : t(actual).toLowerCase() === t(esperado).toLowerCase()) acuerdo++;
    else desacuerdo.push({ pieza: X.idDe(p), hoja: actual, sfmc: esperado });
  });
  var solape = acuerdo + desacuerdo.length;
  var veredicto = !solape ? 'NO PUDE EVALUAR'
    : (desacuerdo.length / solape > 0.05 ? 'NO SIRVE' : 'SIRVE');
  res.push({ m: m, veredicto: veredicto, acuerdo: acuerdo, desacuerdo: desacuerdo, llenables: llenables, solape: solape });
});

var icono = { 'SIRVE': '✔ ', 'NO SIRVE': '🔴', 'NO PUDE EVALUAR': '⚠ ', 'NO EXISTE': '· ' };
res.forEach(function (r) {
  var cab = '  ' + icono[r.veredicto] + ' ' + r.m.hoja.padEnd(30) + '← ' + r.m.desde.padEnd(20);
  if (r.veredicto === 'NO EXISTE') { console.log(cab + r.nota); return; }
  console.log(cab + 'solape ' + String(r.solape).padStart(3) + '   acuerdo ' + String(r.acuerdo).padStart(3) +
    '   discrepa ' + String(r.desacuerdo.length).padStart(3) + '   → llenaría ' + String(r.llenables).padStart(3));
  if (r.desacuerdo.length) r.desacuerdo.slice(0, 3).forEach(function (d) {
    console.log('        ' + d.pieza + '   hoja «' + t(d.hoja).slice(0, 42) + '»   ≠   sfmc «' + t(d.sfmc).slice(0, 42) + '»');
  });
  if (r.veredicto === 'NO PUDE EVALUAR') console.log('        ningún caso donde comparar: NO cuenta como pasar, y no se usa para llenar');
});

var sirven = res.filter(function (r) { return r.veredicto === 'SIRVE'; });
var total = sirven.reduce(function (a, r) { return a + r.llenables; }, 0);
console.log('\n════ VEREDICTO ════');
console.log('  ' + sirven.length + ' de ' + res.length + ' mapeos SIRVEN   ·   llenarían ' + total + ' celda(s)');
res.filter(function (r) { return r.veredicto === 'NO SIRVE'; }).forEach(function (r) {
  console.log('  🔴 ' + r.m.hoja + ' ← ' + r.m.desde + ': ' + r.desacuerdo.length + ' de ' + r.solape + ' discrepan. NO se usa.');
});
res.filter(function (r) { return r.veredicto === 'NO PUDE EVALUAR'; }).forEach(function (r) {
  console.log('  ⚠  ' + r.m.hoja + ' ← ' + r.m.desde + ': sin solape. NO se usa hasta poder compararlo.');
});
fs.writeFileSync(BACK + '/_preescritura/mapeo-sfmc.json', JSON.stringify({
  cuando: new Date().toISOString(), volcado: X.volcado,
  mapeos: res.map(function (r) { return { hoja: r.m.hoja, desde: r.m.desde, veredicto: r.veredicto, acuerdo: r.acuerdo, discrepan: r.desacuerdo ? r.desacuerdo.length : 0, llenables: r.llenables, ejemplos: (r.desacuerdo || []).slice(0, 5) }; })
}, null, 1));
console.log('  → _preescritura/mapeo-sfmc.json');
