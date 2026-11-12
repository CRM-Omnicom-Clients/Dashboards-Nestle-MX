// motor-calculo · ¿EL MOTOR CALCULA BIEN? Se comprueba contra los bloques, no contra sí mismo.
//
// 🔴 La trampa de un motor de cálculo es que es fácil validarlo con su propia aritmética: se
//    recalcula lo mismo de la misma forma y da lo mismo. Eso no prueba nada. Aquí cada check
//    o mide contra los BLOQUES (que el motor no escribió) o comprueba una propiedad que tiene
//    que valer sea cual sea el dato.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ motor-calculo · ¿EL MOTOR CALCULA BIEN? ════════\n');
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var B = {};
['email', 'qcart', 'whatsapp'].forEach(function (n) { B[n] = JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); });

// ══ 1 · NO INVENTA NI PIERDE ════════════════════════════════════════════════════════
console.log('══ 1 · la rejilla contra los bloques ══');
var sendsRejilla = R.rejilla.reduce(function (a, c) { return a + c.total.sends; }, 0);
var sendsBloque = B.email.envios.reduce(function (a, e) { return a + (num(e.email_sends) || 0); }, 0);
// 🔴 la diferencia tiene que estar EXPLICADA, no ser pequeña. Y la explicación la da EL MOTOR
//    en `fuera_de_la_rejilla`, no este validador re-derivándola: cuando el motor aprendió a usar
//    la quincena declarada en el catálogo, la vieja versión —que contaba «los que no traen
//    fecha»— sumó 25,212 envíos que YA estaban dentro y se puso roja sin que nada estuviera mal.
var fuera = (R.fuera_de_la_rejilla || []).filter(function (x) { return x.medio === 'email'; });
var sinPeriodo = fuera.reduce(function (a, x) { return a + (num(x.sends) || 0); }, 0);
chk('lo que falta en la rejilla lo declara el motor, envío por envío',
  sendsRejilla + sinPeriodo === sendsBloque,
  'rejilla ' + mil(sendsRejilla) + ' + declarados fuera ' + mil(sinPeriodo) + ' = ' +
  mil(sendsRejilla + sinPeriodo) + ' vs bloque ' + mil(sendsBloque));
var sinFecha = sinPeriodo;
var waRejilla = R.rejilla.reduce(function (a, c) { return a + c.whatsapp.sends; }, 0);
var waBloque = B.whatsapp.envios.reduce(function (a, e) { return a + (num(e.sends) || 0); }, 0);
chk('WhatsApp entra completo', waRejilla === waBloque, mil(waRejilla) + ' = ' + mil(waBloque));

// ══ 2 · LAS TASAS: LO QUE NO SE PUEDE RESPONDER ES NULL ═════════════════════════════
console.log('\n══ 2 · las tasas ══');
var cerosFalsos = R.por_registro.email.filter(function (x) {
  // una tasa de 0 con denominador 0 sería el error: se comprueba que no exista
  return x.Open_Rate === 0 && x.Delivery_Rate === null;
});
chk('🔴 ninguna tasa vale 0 cuando debería ser null', cerosFalsos.length === 0,
  cerosFalsos.length ? '🔴 ' + cerosFalsos.length + ' tasas en 0 sin denominador' : 'una tasa sin denominador es null, no 0');
var fueraDeRango = R.por_registro.email.filter(function (x) {
  return ['Delivery_Rate', 'Open_Rate', 'Click_Rate', 'Bounce_Rate'].some(function (k) {
    return x[k] !== null && (x[k] < 0 || x[k] > 1.001);
  });
});
chk('ninguna tasa cae fuera de 0..1', fueraDeRango.length === 0,
  fueraDeRango.length ? '🔴 ' + fueraDeRango.length + ' fuera de rango' : R.por_registro.email.length + ' registros');
var ctorMalo = R.por_registro.whatsapp.filter(function (x) { return x.CTOR !== null && x.CTOR_no_calculable; });
chk('🔴 ningún CTOR calculado donde el click NO está medido', ctorMalo.length === 0,
  ctorMalo.length ? '🔴 ' + ctorMalo.length + ' CTOR sobre clicks derivados de un supuesto'
    : R.por_registro.whatsapp.filter(function (x) { return x.CTOR_no_calculable; }).length + ' marcados no calculables, todos con CTOR null');

// ══ 3 · EL ANCLAJE DE QCART — que no se cuente dos veces ════════════════════════════
console.log('\n══ 3 · el anclaje de Qcart ══');
var conQcart = R.rejilla.filter(function (c) { return c.qcart; });
// 🔴 ESTOS CHECKS ERAN DEL MODELO VIEJO Y PROHIBÍAN LA MEJORA. Medían «un bloque mensual por
//    campaña, en UNA sola quincena» y exigían la remisión «— ver Qx» en las demás. Eso valía
//    cuando el Qcart se anclaba una vez por campaña; **con F1 va por touchpoint × segmento**, así
//    que varias celdas por campaña es exactamente lo que el reporte debe mostrar — el check
//    bloqueaba justo lo que Rick pidió. Y él decidió que `QCART?` dice Sí/No y nada más: la
//    remisión se fue a su propia columna.
//
//    Lo que sí hay que vigilar es el doble conteo REAL: que los carritos de una misma PIEZA no
//    estén en dos celdas. Eso sí duplicaría al sumar.
var porPiezaQ = {};
conQcart.filter(function (c) { return c.qcart.carritos > 0; }).forEach(function (c) {
  var suyas = (c.qcart.piezas_sumadas || []).slice();
  if (c.qcart.via_fup) suyas = suyas.concat(String(c.qcart.via_fup).split(/\s*\+\s*/));
  if (!suyas.length) suyas = (c.piezas || []).slice(0, 1);
  suyas.filter(Boolean).forEach(function (pz) {
    var k = String(pz).trim();
    (porPiezaQ[k] = porPiezaQ[k] || []).push(c.campana + '|' + c.touchpoint + '|' + c.segmento + '|' + c.quincena);
  });
});
var duplicados = Object.keys(porPiezaQ).filter(function (pz) {
  return porPiezaQ[pz].filter(function (v, i, a) { return a.indexOf(v) === i; }).length > 1;
});
chk('🔴 los carritos de una PIEZA no están en dos celdas', duplicados.length === 0,
  duplicados.length ? '🔴 ' + duplicados.slice(0, 4).join(' · ')
    : conQcart.filter(function (c) { return c.qcart.carritos > 0; }).length + ' celdas con Qcart, por touchpoint × segmento (F1)');

// 🔴 F2 · CADA AUDIENCIA × TOUCHPOINT CON SU INTENCIÓN DE COMPRA — el check que faltaba.
//    Este NO pregunta si la suma cuadra: cuadraba, y aun así `AON · E-P1 · Traditional Parents`
//    salía con «No» y 0 mientras el shortlink decía 366. Lo que hace es construir la rejilla
//    ESPERADA desde los EVENTOS —cada carrito trae su `pieza_id`, y la pieza trae su
//    campaña · touchpoint · segmento en el catálogo— y compararla, combinación por combinación.
//    No es circular: el esperado no lo escribió el motor, lo escribieron los eventos.
// 🔴 Y ES POR COMBINACIÓN, NO POR TOTAL. Un total correcto con los carritos en el segmento
//    equivocado da exactamente la misma suma — por eso ninguna puerta lo veía.
// 🔴 Las columnas se PIDEN a `lib-columna`, que resuelve contra el catálogo raíz o truena.
//    Escribirlas por literal es lo que hizo que un validador acusara de vacías a 98 de 98 filas.
var COL = require(__dirname + '/lib-columna.js');
var EQV = require(__dirname + '/lib-esquema.js');
var filasCat = null;
try {
  var XL = require('xlsx'), LF = require(BACK + '/_scripts/lib-flexible.js');
  var PRY = ENT.PROYECTO;
  var TQ = require('path').resolve(__dirname, '..') + '/_tmp/_val-motor.xlsx';
  fs.copyFileSync(LF.archivoVivo({ dir: PRY }).ruta, TQ);
  filasCat = XL.utils.sheet_to_json(XL.readFile(TQ).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
} catch (e) { filasCat = null; }

if (!filasCat || !filasCat.length) {
  // 🔴 NO PUDE EVALUAR se declara ruidosamente: no cuenta como pasar.
  chk('🔴 cada audiencia × touchpoint con su Qcart', false, 'NO PUDE EVALUAR: no se pudo abrir Catalogo_Piezas');
} else {
  var PZC = {};
  filasCat.forEach(function (p) {
    var id = t(COL.valor(p, filasCat, 'Pieza_ID'));
    if (id) PZC[id] = p;
  });
  // 🔴 14-sep-2026 · LOS DOS LADOS TIENEN QUE COMPONER EL SEGMENTO IGUAL, y no lo hacían.
  //    Este check armaba su llave con el `Segmento` pelado del catálogo —«Región unificada»— y la
  //    comparaba contra la de la rejilla, que le pega el SUBSEGMENTO —«Región unificada · Partición
  //    A»—. Para toda pieza con subsegmento las dos llaves eran distintas, así que el check
  //    reportaba «espera 5 y tiene 0» sobre celdas que tenían sus 5 carritos perfectamente puestos.
  //    Tres piezas de Liga MX salían en rojo sin tener nada malo.
  //
  //    Un guardián que grita en falso es casi tan caro como uno que calla: enseña a ignorarlo. Se
  //    replica **la misma regla** que usa `motor.motor.js` al construir la rejilla —incluida su
  //    guarda contra doblar el subsegmento, que ya produjo «… · Gatos — Gatos» en 15 filas— en vez
  //    de inventar aquí una segunda versión. Dos versiones de la misma regla es cómo el reporte y
  //    el catálogo llegaron a no cruzar en ninguna de sus 86 filas.
  var dimsCat = function (p) {
    var s = t(COL.valor(p, filasCat, 'Segmento'));
    var sub = t(COL.opcional(filasCat, 'Subsegmento') ? COL.valor(p, filasCat, 'Subsegmento') : '');
    // 🔴 15-sep-2026: delega en `lib-esquema.segmentoCanonico` en vez de repetir la regla. Este
    //    era el tercer sitio con la misma línea escrita a mano; ver la nota de la librería.
    var seg = EQV.segmentoCanonico(s, sub);
    return [t(COL.valor(p, filasCat, 'Campaña')), t(COL.valor(p, filasCat, 'TouchPoint')), seg].join('|');
  };
  /* 🔴 24-sep-2026 · SE ESPERA LA SUMA DE `views`, NO EL NÚMERO DE EVENTOS.
   *    Una fila del export de Qcart es un bucket (día × hora × shortlink × utm × tienda) con su
   *    contador `views`: contarla como un carrito decía 3,077 donde Qcart dice 7,503, y metía
   *    **444 filas con `views = 0`** —impresiones del link que nunca llegaron a una vista— como
   *    si fueran carritos. Este check seguía contando eventos, así que tras corregir el motor
   *    marcaba 32 diferencias que eran la corrección, no el defecto.
   *    Sigue siendo un contraste contra la FUENTE (el bloque de eventos), no contra la rejilla. */
  var espera = {}, pone = {};
  B.qcart.carritos.forEach(function (e) {
    var p = PZC[t(e.pieza_id)]; if (!p) return;
    var k = dimsCat(p); espera[k] = (espera[k] || 0) + (Number(t(e.views)) || 0);
  });
  R.rejilla.forEach(function (c) {
    var k = [t(c.campana), t(c.touchpoint), t(c.segmento)].join('|');
    pone[k] = (pone[k] || 0) + ((c.qcart && c.qcart.carritos) || 0);
  });
  var todasK = {}; Object.keys(espera).concat(Object.keys(pone)).forEach(function (k) { todasK[k] = 1; });
  var difiere = Object.keys(todasK).filter(function (k) { return (espera[k] || 0) !== (pone[k] || 0); });
  chk('🔴 cada audiencia × touchpoint con su Qcart (esperado desde los EVENTOS)', difiere.length === 0,
    difiere.length
      ? '🔴 ' + difiere.length + ': ' + difiere.slice(0, 3).map(function (k) {
          return k.replace(/\|/g, ' · ') + ' espera ' + (espera[k] || 0) + ' y tiene ' + (pone[k] || 0);
        }).join('   ·   ')
      : Object.keys(espera).length + ' combinaciones campaña × touchpoint × segmento, todas exactas');
}

// ══ 4 · LA REJILLA ES CONSISTENTE CONSIGO MISMA ════════════════════════════════════
console.log('\n══ 4 · consistencia interna ══');
var malTotal = R.rejilla.filter(function (c) {
  return c.total.sends !== c.principal.sends + c.fup.sends;
});
chk('Total = Principal + FUP en todas las celdas', malTotal.length === 0,
  malTotal.length ? '🔴 ' + malTotal.length + ' celdas' : R.rejilla.length + ' celdas');
var sinDim = R.rejilla.filter(function (c) { return !t(c.campana) || !t(c.quincena); });
// 🔴 UN SOLO FORMATO DE QUINCENA — `AAAA-MM-Qn` y nada más. No es cosmética: es la llave con la
//    que el reporte, el catálogo y el ancla de Qcart se encuentran. Dos formatos conviviendo no
//    fallan: simplemente no casan, y la fila aparece duplicada o vacía sin que nada se ponga rojo.
//    Ya costó una vez que 0 de 86 filas cruzaran; el 27-ago volvió a aparecer en 2 celdas
//    (Mundial · Partido 2 y 3) porque `periodoDe` traducía la del catálogo a `Jun-Q2-2026`.
var qMal = R.rejilla.filter(function (c) { return !/^\d{4}-\d{2}-Q[12]$/.test(t(c.quincena)); });
chk('🔴 todas las quincenas en el formato canónico AAAA-MM-Qn', qMal.length === 0,
  qMal.length ? '🔴 ' + qMal.length + ': ' + qMal.slice(0, 3).map(function (c) {
      return t(c.campana) + '/' + t(c.touchpoint) + ' → «' + t(c.quincena) + '»';
    }).join(' · ')
  : 'las ' + R.rejilla.length + ' celdas');

chk('toda celda tiene campaña y quincena', sinDim.length === 0,
  sinDim.length ? '🔴 ' + sinDim.length + ' sin dimensión' : 'las ' + R.rejilla.length);
chk('toda celda declara si su campaña viene del catálogo',
  R.rejilla.every(function (c) { return typeof c.campana_del_catalogo === 'boolean'; }),
  R.rejilla.filter(function (c) { return c.campana_del_catalogo; }).length + ' atribuidas · ' +
  R.rejilla.filter(function (c) { return !c.campana_del_catalogo; }).length + ' sin resolver');

// ══ 5 · NO ESCRIBIÓ EL EXCEL ═══════════════════════════════════════════════════════
chk('el motor NO abre ni escribe el Excel', /no abre el Excel/i.test(t(R.no_hace)), t(R.no_hace).slice(0, 56));

// ── LOS DATOS ───────────────────────────────────────────────────────────────────────
dato('todo el Qcart encontró dónde anclarse', R.auditoria.qcart_sin_ancla === 0,
  R.auditoria.qcart_sin_ancla + ' bloques con Qcart y sin envío Principal ese mes');
dato('todas las campañas de la rejilla están resueltas',
  R.rejilla.every(function (c) { return c.campana_del_catalogo; }),
  R.rejilla.filter(function (c) { return !c.campana_del_catalogo; }).length + ' celdas de envíos sin pieza');
dato('todo envío cae en una quincena', sinFecha === 0,
  sinFecha ? mil(sinFecha) + ' envíos quedan fuera del reporte: ' +
    fuera.map(function (x) { return (x.content_name || x.campana_raw || '?').slice(-32) + ' (' + x.motivo + ')'; }).join(' · ')
    : 'todos — ninguno se quedó sin periodo');
dato('todos los clicks de WhatsApp están medidos',
  R.por_registro.whatsapp.every(function (x) { return !x.CTOR_no_calculable; }),
  R.por_registro.whatsapp.filter(function (x) { return x.CTOR_no_calculable; }).length + ' campañas derivan el click de un supuesto');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(58) + (v[2] || '')); });
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(56) + (h[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) del motor' : '✅ EL MOTOR CALCULA BIEN — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
