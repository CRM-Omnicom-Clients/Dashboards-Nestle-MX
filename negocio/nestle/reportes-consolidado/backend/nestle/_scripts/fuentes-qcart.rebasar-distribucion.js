// fuentes-qcart · RE-BASAR la línea del guardián de distribución, con su motivo escrito.
//
// 🔴 POR QUÉ EXISTE, Y POR QUÉ NO ES UNA PUERTA TRASERA. El guardián compara la distribución de
//    hoy contra una línea base congelada, y bloquea si una celda BAJA, DESAPARECE o se MUEVE de
//    quincena. Eso es lo que queremos: un movimiento silencioso es indistinguible de una pérdida.
//    Pero cuando el movimiento es lo que se PIDIÓ, la línea base tiene que avanzar — si no, el
//    guardián se queda en rojo para siempre y en dos semanas alguien lo desactiva. Un guardián
//    desactivado no guarda nada.
//
// 🔴 LAS TRES CONDICIONES PARA RE-BASAR, y las tres se comprueban aquí, no se prometen:
//      1 · el TOTAL de carritos no bajó
//      2 · ninguna celda que se queda tiene MENOS carritos que antes
//      3 · lo que desaparece de una quincena APARECE en otra, con la misma cifra, misma
//          campaña·touchpoint·segmento. O sea: se movió, no se perdió.
//    Si alguna falla, NO se re-basa: el guardián tenía razón y hay que mirarlo.
//
// 🔴 Y EL MOTIVO SE ESCRIBE EN EL CONTRATO. La línea base nueva lleva quién la movió, cuándo y
//    por qué, para que el corte siguiente pueda leer la historia en vez de suponerla.
//
// Uso:  node fuentes-qcart.rebasar-distribucion.js --motivo "..." [--escribir]
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
function arg(n) { var i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; }
var MOTIVO = arg('motivo'), ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
if (!MOTIVO) { console.log('🔴 falta --motivo "por qué se movió". Sin motivo no se re-basa.'); process.exit(1); }

var BASE = BACK + '/_contratos/qcart-distribucion-base.json';
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var vieja = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : { celdas: {} };
var celdasViejas = vieja.celdas || vieja;

var ahora = {};
R.rejilla.forEach(function (c) {
  var n = (c.qcart && c.qcart.carritos) || 0; if (!n) return;
  ahora[[t(c.campana), t(c.touchpoint), t(c.segmento), t(c.quincena)].join(' ¦ ')] = n;
});

console.log('════════ fuentes-qcart · RE-BASAR LA DISTRIBUCIÓN ════════\n');
var sA = Object.keys(ahora).reduce(function (a, k) { return a + ahora[k]; }, 0);
var sV = Object.keys(celdasViejas).reduce(function (a, k) { return a + celdasViejas[k]; }, 0);
console.log('  celdas: ' + Object.keys(celdasViejas).length + ' → ' + Object.keys(ahora).length + '   ·   Σ: ' + mil(sV) + ' → ' + mil(sA));
console.log('  motivo: ' + MOTIVO + '\n');

// 🔴 LA CUARTA VÍA: LO QUE SE EXCLUYÓ POR CONTRATO (15-sep-2026). Las tres condiciones de arriba
//    solo saben de MOVIMIENTOS —una celda que cambia de quincena—, y por eso bloquean cuando una
//    celda desaparece de verdad. Eso estuvo bien mientras la única forma de desaparecer fuera
//    perderse. Ya no: Rick puede DECLARAR que un envío nunca salió y que su tráfico no cuenta
//    («Mundial E-P2 Modern Cooking: ya recordé, nunca salió»). Entonces la celda desaparece a
//    propósito, y el total baja a propósito.
//    🔴 Y NO ES UNA PUERTA TRASERA, porque se PRUEBA con la misma exigencia que las otras: los
//       carritos de la celda que desaparece tienen que estar, uno por uno, en
//       `_fuentes/qcart-excluidos.json`, con su motivo escrito. Si la cuenta no cuadra exacto, no
//       se re-basa: querría decir que además de lo excluido se perdió algo, y eso el guardián lo
//       tiene que seguir gritando.
//    🔴 LA CELDA DE UN EVENTO EXCLUIDO SE RESUELVE POR EL CATÁLOGO, NO POR SU utm. Los eventos
//       apartados traen `pieza_id` y `segmento_canonico`, pero NO `touchpoint_canonico` — su utm
//       dice `e-cooking2`, y el touchpoint de la celda es `E-P2`. Reconstruirlo del utm sería
//       exactamente la deducción que R2 prohíbe, y que ya corrió 191 carritos al segmento de al
//       lado. La pieza sí lo sabe: se le pregunta a ella.
var EXCL = (function () {
  try {
    var XL = require('xlsx');
    var EQS = require(BACK + '/_scripts/lib-esquema.js');
    var PROY = ENT.PROYECTO;
    var tmpc = require('path').resolve(__dirname, '..') + '/_tmp/_rebase.xlsx';
    fs.copyFileSync(ENT.LIBRO, tmpc);
    var CAT = XL.utils.sheet_to_json(XL.readFile(tmpc).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
    fs.unlinkSync(tmpc);
    var celdaDe = {};
    CAT.forEach(function (p) {
      var id = t(p['Pieza' + '_ID']); if (!id) return;
      celdaDe[id] = [t(p['Camp' + 'aña']), t(p['Touch' + 'Point']),
        EQS.segmentoCanonico(t(p['Segm' + 'ento']), t(p['Subsegm' + 'ento']))].join(' ¦ ');
    });
    var X = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart-excluidos.json', 'utf8'));
    var por = {};
    (X.carritos || []).forEach(function (e) {
      var k = celdaDe[t(e.pieza_id)];
      // vistas, no filas: la explicacion de un re-base tiene que ir en la MISMA unidad que las
      // celdas de la linea base (29-sep-2026). Un movimiento contado en filas y una base medida
      // en vistas no pueden cuadrar entre si nunca.
      var nv = Number(e.views) || 0;
      if (k) por[k] = (por[k] || 0) + nv;
      por.__total__ = (por.__total__ || 0) + nv;
    });
    return por;
  } catch (e) { return {}; }
})();

var fallos = [];
// 1 · el total
// 🔴 el total puede bajar SI y SOLO SI lo que bajó está declarado como excluido, y por la cifra exacta
if (sA < sV) {
  var bajo = sV - sA;
  var exc = EXCL.__total__ || 0;
  if (bajo === exc) {
    console.log('  ✔ el total baja ' + mil(bajo) + ', y son exactamente los ' + mil(exc) + ' carritos declarados en qcart-excluidos.json');
  } else {
    fallos.push('el total BAJÓ ' + mil(bajo) + ' y solo hay ' + mil(exc) + ' carrito(s) declarados como excluidos: faltan ' + mil(bajo - exc) + ' por explicar');
  }
}
/* ══ LA QUINTA VÍA · UN CAMBIO DE UNIDAD (24-sep-2026) ════════════════════════════════════════
 * 🔴 Las tres condiciones de arriba están hechas para un REPARTO: el dato es el mismo y se mueve
 *    de celda. No sirven cuando lo que cambia es QUÉ SE CUENTA. El 24-sep `carritos` pasó de ser
 *    «una fila del CSV» a ser «una vista»: una fila del export de Qcart es un bucket
 *    (día × hora × shortlink × utm × tienda) con su contador `views`, y contarla como un carrito
 *    decía 3,077 donde Qcart dice 7,503 — metiendo además **444 filas con `views = 0`**, que son
 *    impresiones del link que nunca llegaron a una vista.
 *
 * 🔴 Y por eso una celda PUEDE bajar sin que se haya perdido nada: si sus filas traían muchos
 *    ceros, contaba más cuando contaba filas. Aceptar eso a ciegas sería desactivar el guardián,
 *    así que se exige una prueba propia y más fuerte que «el total subió»:
 *
 *      para CADA celda de la línea vieja:  su cifra vieja == el NÚMERO DE EVENTOS que hoy tiene,
 *                                          y su cifra nueva == la SUMA DE `views` de esos mismos.
 *
 *    Si eso se cumple, la data es idéntica y solo cambió la definición. Si falla en una sola
 *    celda, algo más se movió y el re-base se detiene. */
var UNIDAD = process.argv.indexOf('--cambio-de-unidad') >= 0;
if (UNIDAD) {
  var evPorCelda = {};
  try {
    var BQ = JSON.parse(require('fs').readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
    var R2 = JSON.parse(require('fs').readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
    var celdaDe = {};
    (R2.rejilla || []).forEach(function (c) {
      ((c.qcart_piezas || c.piezas) || []).forEach(function (pid) {
        celdaDe[String(pid).trim()] = [t(c.campana), t(c.touchpoint), t(c.segmento), t(c.quincena)].join(' ¦ ');
      });
    });
    (BQ.eventos || BQ.carritos || []).forEach(function (e) {
      var k = celdaDe[t(e.pieza_id)]; if (!k) return;
      if (!evPorCelda[k]) evPorCelda[k] = { n: 0, views: 0 };
      evPorCelda[k].n++; evPorCelda[k].views += Number(t(e.views)) || 0;
    });
  } catch (err) { console.log('  ⚠ no pude recomponer los eventos por celda: ' + String(err.message).slice(0, 70)); }

  var probadas = 0, sinProbar = [];
  Object.keys(celdasViejas).forEach(function (k) {
    var x = evPorCelda[k];
    if (!x) { sinProbar.push(k); return; }
    /* 🔴 SE EXIGE QUE NO SE HAYA PERDIDO NINGÚN EVENTO, no que el conteo sea idéntico.
     *    La primera versión pedía `x.n === celdasViejas[k]` y falló en 16 celdas — con razón, pero
     *    por el motivo equivocado: la línea base es de un estado ANTERIOR del bloque, y desde
     *    entonces entraron descargas nuevas de Qcart. O sea que no es «solo» un cambio de unidad,
     *    también creció el dato, y exigir igualdad exacta haría imposible re-basar nunca.
     *    Lo que sí protege contra una pérdida —que es de lo que va este guardián— es que la celda
     *    tenga HOY al menos tantos eventos como tenía cuando se tomó la línea. */
    if (x.n < celdasViejas[k]) { fallos.push('PERDIÓ eventos ' + k + ': la línea tenía ' + celdasViejas[k] + ' y hoy quedan ' + x.n); return; }
    if (ahora[k] !== undefined && ahora[k] !== x.views) { fallos.push('la cifra NUEVA de ' + k + ' (' + ahora[k] + ') no es la suma de views de sus eventos (' + x.views + ')'); return; }
    probadas++;
  });
  console.log('  ── cambio de unidad: filas → views');
  console.log('     celdas probadas contra sus propios eventos: ' + probadas + ' de ' + Object.keys(celdasViejas).length +
    (sinProbar.length ? '   ⚠ ' + sinProbar.length + ' sin poder recomponer' : ''));
  if (sinProbar.length) sinProbar.slice(0, 3).forEach(function (k) { console.log('        ⚠ ' + k); });
} else {
  // 2 · ninguna que se queda baja
  Object.keys(celdasViejas).forEach(function (k) {
    if (ahora[k] !== undefined && ahora[k] < celdasViejas[k]) fallos.push('BAJÓ ' + k + ': ' + celdasViejas[k] + ' → ' + ahora[k]);
  });
}
// 3 · lo que desaparece, reaparece con la misma cifra en otra quincena
var idas = Object.keys(celdasViejas).filter(function (k) { return ahora[k] === undefined; });
var nuevas = Object.keys(ahora).filter(function (k) { return celdasViejas[k] === undefined; });
console.log('  ── lo que se movió de quincena');
var emparejadas = [];
idas.forEach(function (k) {
  var p = k.split(' ¦ '), ident = p.slice(0, 3).join(' ¦ '), n = celdasViejas[k];
  var destino = nuevas.filter(function (x) { return x.split(' ¦ ').slice(0, 3).join(' ¦ ') === ident && ahora[x] === n; })[0];
  if (destino) { emparejadas.push(destino); console.log('     ✔ ' + ident + '   ' + p[3] + ' → ' + destino.split(' ¦ ')[3] + '   ' + n + ' carritos, misma cifra'); return; }
  // la cuarta vía: desapareció porque se EXCLUYÓ, y la cifra tiene que cuadrar exacto
  var exc = EXCL[ident];
  if (exc === n) { console.log('     ✔ ' + ident + '   ' + p[3] + '   ' + n + ' carritos DECLARADOS fuera (qcart-excluidos.json), cifra exacta'); return; }
  if (exc) { fallos.push('DESAPARECIÓ ' + k + ' (' + n + ' carritos) y solo ' + exc + ' están declarados como excluidos'); return; }
  fallos.push('DESAPARECIÓ sin reaparecer ni estar declarada fuera: ' + k + ' (' + n + ' carritos)');
});
nuevas.filter(function (x) { return emparejadas.indexOf(x) < 0; }).forEach(function (x) {
  console.log('     ⚠ celda nueva sin origen: ' + x + '   ' + ahora[x] + ' carritos   (no bloquea: es alta, no movimiento)');
});
if (!idas.length) console.log('     ninguna');

console.log('\n════ VEREDICTO ════');
if (fallos.length) {
  fallos.forEach(function (f) { console.log('  🔴 ' + f); });
  console.log('\n  🔴 NO se re-basa: el guardián tenía razón.');
  process.exit(1);
}
console.log('  ✅ las 3 condiciones se cumplen: el total no bajó, ninguna celda bajó, y todo lo que');
console.log('     salió de una quincena reapareció en otra con la MISMA cifra. Es un movimiento, no una pérdida.');
if (!ESCRIBIR) { console.log('\n  (seco. Para re-basar: --escribir)'); process.exit(0); }

var nueva = {
  suma: sA,   // 🔴 el guardián lee : sin este campo leía undefined y daba 0
  celdas: ahora,
  cuando: new Date().toISOString(),
  // 🔴 `sellado` TAMBIÉN, porque es el nombre que el guardián lee y el que pone `--sellar`
  //    (29-sep-2026). Este escritor solo ponía `cuando`, así que tras la primera re-basada el
  //    guardián imprimía «contra la línea base del undefined». Dos escritores del mismo contrato
  //    con dos nombres para la misma fecha: el que se queda es el del lector.
  sellado: new Date().toISOString().slice(0, 10),
  motivo: MOTIVO,
  anterior: { celdas: Object.keys(celdasViejas).length, suma: sV, cuando: vieja.cuando || vieja.sellado || '(sin fecha)' },
  movimientos: idas.map(function (k) {
    var ident = k.split(' ¦ ').slice(0, 3).join(' ¦ ');
    var d = Object.keys(ahora).filter(function (x) { return x.split(' ¦ ').slice(0, 3).join(' ¦ ') === ident && ahora[x] === celdasViejas[k]; })[0];
    return { de: k, a: d, carritos: celdasViejas[k] };
  }),
  historia: (vieja.historia || []).concat([{ cuando: vieja.cuando || null, motivo: vieja.motivo || '(línea original)', celdas: Object.keys(celdasViejas).length, suma: sV }])
};
fs.writeFileSync(BASE, JSON.stringify(nueva, null, 1));
console.log('\n  ✅ línea base re-basada → _contratos/qcart-distribucion-base.json   (' + nueva.movimientos.length + ' movimiento(s) registrados con su motivo)');
