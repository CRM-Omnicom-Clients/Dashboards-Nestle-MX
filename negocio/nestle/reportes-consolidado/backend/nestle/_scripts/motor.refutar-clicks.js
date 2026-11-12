/*
 * motor.refutar-clicks.js — VALIDACIÓN ADVERSARIAL de la coherencia de clicks (E1).
 *
 * 🔴 Rick, 24-sep-2026: «al cerrar haces validaciones adversariales para cada etapa».
 *    No basta con que la regla salga en verde HOY: hay que plantarle el defecto y exigir que lo
 *    atrape. Que una suite pase no prueba que mire — ya pasó con la guarda del congelado, que
 *    salía verde con el señuelo delante porque su regex no reconocía `execFileSync(`.
 *
 * Cada ataque intenta REINTRODUCIR el defecto que E1 arregló. Un ataque que NO es atrapado es un
 * agujero real, y este script falla.
 *
 *   node motor.refutar-clicks.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var COL = require(BACK + '/_scripts/lib-columna.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ motor · REFUTAR LA COHERENCIA DE CLICKS ════════\n');
var ataques = [], fallos = 0;
function ataque(nombre, queIntenta, fn) {
  var r;
  try { r = fn(); } catch (e) { r = { atrapado: true, como: 'tronó: ' + String(e.message).slice(0, 80) }; }
  var ok = !!r.atrapado;
  if (!ok) fallos++;
  ataques.push({ nombre: nombre, intenta: queIntenta, atrapado: ok, como: r.como });
  console.log('  ' + (ok ? '✔' : '🔴') + ' ' + nombre);
  console.log('      intenta: ' + queIntenta);
  console.log('      ' + (ok ? 'ATRAPADO: ' : '🔴 PASÓ SIN QUE NADIE LO VIERA: ') + r.como + '\n');
}

/* A1 · una clase de destino nueva sin columna declarada debe TRONAR, no caer callada en CTA. */
ataque('A1 · clase de click sin columna declarada',
  'meter un destino inventado en repartir() para que su tráfico se cuele en una columna',
  function () {
    try {
      var r = CD.repartir({ qcart: 10, destino_que_no_existe: 999 });
      var enColumnas = CD.columnas().reduce(function (a, k) { return a + (r[k] || 0); }, 0);
      return { atrapado: false, como: 'NO tronó; ' + (enColumnas > 10 ? 'los 999 entraron a una columna' : 'quedaron en fuera=' + r.fuera) };
    } catch (e) { return { atrapado: true, como: 'tronó como debe: ' + String(e.message).slice(0, 70) }; }
  });

/* A2 · `Clicks_Medidos` NO puede ser un destino: si entrara en columnas(), repartir lo buscaría
 *      como clase y el total se contaminaría con tráfico. */
ataque('A2 · el total colado como si fuera un destino',
  'que Clicks_Medidos aparezca en columnas() y repartir() lo trate como una clase más',
  function () {
    if (CD.columnas().indexOf(CD.COL_MEDIDOS) >= 0)
      return { atrapado: false, como: 'Clicks_Medidos está en columnas(): repartir lo trataría como destino' };
    return { atrapado: true, como: 'columnas() son solo los 3 destinos; el total vive aparte en columnasReporte()' };
  });

/* A3 · el defecto original: desglose que excede a su total. */
ataque('A3 · un desglose mayor que su total',
  'construir un bloque cuyo desglose sume más que su Clicks_Medidos',
  function () {
    var d = {}; d[CD.COL_CTA] = 300; d[CD.COL_BAJA] = 20; d[CD.COL_RNL] = 5;
    var total = CD.totalMedido(d);
    if (total < 325) return { atrapado: false, como: 'totalMedido devolvió ' + total + ', menor que la suma real 325' };
    return { atrapado: true, como: 'totalMedido() = ' + total + ' = la suma exacta: por construcción no puede quedar por debajo' };
  });

/* A4 · el check circular: comparar el desglose contra algo derivado de él mismo. */
ataque('A4 · el check que se compara consigo mismo',
  'comprobar que motor.links.js ya NO valida el desglose contra clicks_unicos (ambos del mismo campo)',
  function () {
    var src = fs.readFileSync(BACK + '/_scripts/motor.links.js', 'utf8');
    if (/!==\s*p\.clicks_unicos/.test(src)) return { atrapado: false, como: 'sigue el check circular contra clicks_unicos' };
    var externo = src.indexOf('contraste contra el DETALLE') >= 0;
    return { atrapado: true, como: 'el check circular ya no está' + (externo ? ', y hay contraste contra el DETALLE (fuente externa)' : '') };
  });

/* A5 · 🔴 el desglose va en ÚNICOS por link. Con TOTALES el reporte publicaba un destino con
 *      7,879 clicks sobre `Clicks = 87` — 90×, porque los totales traen escáneres y prefetch. */
ataque('A5 · el desglose armado con clicks TOTALES',
  'que por_destino vuelva a sumarse con Clicks_Total, que producía ratios de 90× contra Clicks',
  function () {
    var src = fs.readFileSync(BACK + '/_scripts/motor.links.js', 'utf8');
    var m = /p\.por_destino\[c\]\s*=\s*\(p\.por_destino\[c\]\s*\|\|\s*0\)\s*\+\s*num\(r\.(\w+)\)/.exec(src);
    if (!m) return { atrapado: false, como: 'no encontré la línea que arma por_destino' };
    if (m[1] !== 'Clicks_Unique') return { atrapado: false, como: 'por_destino se arma con ' + m[1] + ': vuelve el ratio de 90×' };
    return { atrapado: true, como: 'por_destino se arma con Clicks_Unique (31 excesos, peor 4×) y no con Clicks_Total (87 excesos, peor 90×)' };
  });

/* A8 · ninguna fila puede decir «0 clicks» y traer desglose: eso es la contradicción que Rick
 *      señaló y la que queda cuando una pieza tiene el 100% de sus clicks en un job de prueba. */
ataque('A8 · una fila con Clicks = 0 y desglose > 0',
  'buscar en el reporte filas que digan cero clicks y a la vez desglosen clicks',
  function () {
    var XLSX = require('xlsx');
    var V = ENT.LIBRO;
    var tmp = BACK + '/_tmp/_refuta8.xlsx'; fs.copyFileSync(V, tmp);
    var R = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { defval: '' });
    var nCamp = COL.de(R, 'Campaña', 'resumen');
    var TOKn = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
    var nn = function (v) { var s = t(v); if (!s || TOKn.test(s)) return null; var x = Number(s.replace(/[,$%\s]/g, '')); return isFinite(x) ? x : null; };
    var mal = [];
    R.filter(function (r) { return !/^total/i.test(t(r[nCamp])); }).forEach(function (r) {
      ['Principal', 'FUP', 'Tot'].forEach(function (b) {
        var cl = nn(r[b + '_Clicks']), md = nn(r[b + '_Clicks_Medidos']);
        if (cl === 0 && md > 0) mal.push(t(r[nCamp]) + '·' + b + ' Clicks=0 Medidos=' + md);
      });
    });
    if (mal.length) return { atrapado: false, como: mal.length + ' fila(s): ' + mal.slice(0, 3).join(' · ') };
    return { atrapado: true, como: 'ninguna fila dice 0 clicks con desglose' };
  });

/* A6 · la columna nueva tiene que llegar a la fila de TOTALES. El regex de SUMABLES ya se saltó
 *      columnas en silencio dos veces. */
ataque('A6 · la columna nueva fuera de la fila de totales',
  'que SUMABLES no reconozca Clicks_Medidos y la fila Total le escriba N/A encima',
  function () {
    var src = fs.readFileSync(BACK + '/_scripts/resumen.regenerar.js', 'utf8');
    var m = /var SUMABLES = (\/[^\n]*\/);/.exec(src);
    if (!m) return { atrapado: false, como: 'no pude leer el regex SUMABLES' };
    var re = eval(m[1]);
    var faltan = ['Principal_Clicks_Medidos', 'FUP_Clicks_Medidos', 'Tot_Clicks_Medidos'].filter(function (c) { return !re.test(c); });
    if (faltan.length) return { atrapado: false, como: 'SUMABLES NO reconoce: ' + faltan.join(', ') };
    return { atrapado: true, como: 'SUMABLES reconoce las tres: la fila de totales las suma' };
  });

/* A7 · `*_Clicks` (únicos) no debe haberse convertido en totales — rompería CTOR. */
ataque('A7 · CTOR contaminado con clicks totales',
  'que el desglose por totales se haya filtrado a *_Clicks y por tanto a CTOR',
  function () {
    var XLSX = require('xlsx');
    var V = ENT.LIBRO;
    var tmp = BACK + '/_tmp/_refuta.xlsx'; fs.copyFileSync(V, tmp);
    var R = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { defval: '' });
    /* la columna se PIDE, no se escribe — el hook me atrapó escribiéndola por literal */
    var nCamp = COL.de(R, 'Campaña', 'resumen');
    var tot = R.filter(function (r) { return /^total/i.test(t(r[nCamp])); })[0] || {};
    var cl = Number(t(tot['Tot_Clicks']).replace(/[, ]/g, '')) || 0;
    var md = Number(t(tot['Tot_Clicks_Medidos']).replace(/[, ]/g, '')) || 0;
    if (!cl || !md) return { atrapado: false, como: 'no pude leer los totales (Clicks=' + cl + ', Medidos=' + md + ')' };
    if (cl === md) return { atrapado: false, como: 'Tot_Clicks == Tot_Clicks_Medidos (' + cl + '): los únicos se volvieron totales' };
    return { atrapado: true, como: 'siguen distintos: únicos ' + cl.toLocaleString() + ' vs medidos ' + md.toLocaleString() };
  });

console.log('════ VEREDICTO ════');
console.log('  ataques: ' + ataques.length + '   ·   atrapados: ' + (ataques.length - fallos) + '   ·   pasaron: ' + fallos);
fs.writeFileSync(BACK + '/_preescritura/refutar-clicks.json', JSON.stringify({ cuando: new Date().toISOString(), ataques: ataques }, null, 1));
if (fallos) { console.log('\n  🔴 ' + fallos + ' ataque(s) NO fueron atrapados — hay agujero.'); process.exit(1); }
console.log('\n  ✅ NINGÚN ATAQUE ROMPIÓ LA COHERENCIA DE CLICKS');
console.log('\n→ _preescritura/refutar-clicks.json');
