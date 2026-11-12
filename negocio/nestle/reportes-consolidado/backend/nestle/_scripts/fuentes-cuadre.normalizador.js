// FI · cuadre-coherencia — EL NORMALIZADOR TRANSVERSAL. Lo pidió Rick el 20-ago-2026:
//
//    «Creo que al final sí necesitamos este normalizador de información, o sea como el que se
//     encarga de los catálogos... por fila que tenga sentido de negocio, por columna que sea
//     coherente con su fuente, y las llaves entre catálogos y entre fuentes.»
//
// 🔴 QUÉ VIGILA QUE NADIE MÁS VIGILA. Cada guardián del sistema mira UNA cosa: N5-99 el motor,
//    PUERTA-2 el reporte contra la rejilla, FB el anclaje, FH los catálogos. Todos pueden estar en
//    verde y el libro seguir siendo incoherente CRUZANDO hojas: una campaña de EMAIL con
//    números de WhatsApp, el mismo envío en dos filas con dos identidades, piezas de la misma
//    oleada repartidas en dos quincenas porque cada una llegó por una vía distinta.
//    Eso es lo que mide este paso, y solo eso.
//
// 🔴 NINGÚN CHECK PINTA VERDE SIN HABER EVALUADO CASOS. Si un check no encuentra nada que medir
//    dice «N/A · 0 casos», no «✅». Ya pasó: un check buscaba `Pieza_ID` donde la columna se
//    llama `Pieza_IDs`, evaluaba cero casos y pintaba verde durante días.
//
// 🔴 NO REPARA. Reporta. Las filas del reporte son de Rick y varias las escribió a mano; un
//    normalizador que «arregla» solo destruye trabajo suyo sin dejar rastro. Lo que encuentra
//    va al informe y a su JSON, y la decisión es de él.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'cuadre';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
// 🔴 DEVUELVE null, NO CERO — y esta copia devolvía cero. Es la regla R10 del sistema («un cero es
//    un dato, un hueco no es un cero») rota dentro de un script del corte, y la encontró la
//    medición de divergencia de la etapa 7: de las dos copias de `num` que hay, ésta se había
//    separado de la canónica sin que nadie lo decidiera.
//    Importa justo aquí: este script CUENTA cosas para decir si el libro es coherente. Un valor
//    ilegible convertido en 0 se suma como si fuera un cero real, y una incoherencia se vuelve
//    invisible. `null` no se suma; obliga a decir «no pude leerlo».
//    Canónica del sistema: `isFinite(n) ? n : null`.
function num(v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var hallazgos = [], oks = [], na = [];
function mal(area, que, detalle, filas) { hallazgos.push({ area: area, que: que, detalle: detalle, filas: filas || [] }); }
function bien(area, que, evidencia) { oks.push({ area: area, que: que, evidencia: evidencia }); }
function nada(area, que, porque) { na.push({ area: area, que: que, porque: porque }); }

var C = require('path').resolve(__dirname, '..') + '/_tmp/_fi.xlsx';
var vivo = L.archivoVivo({ dir: PROY });
fs.copyFileSync(vivo.ruta, C);
var wb = XLSX.readFile(C);
function hoja(n) { return wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', blankrows: false }) : null; }

var RES = hoja('Report_Resumen'), CAT = hoja('Catalogo_Piezas'), REF = hoja('Catalogo_Referencias');
var DE = hoja('Data_Email'), DW = hoja('Data_WhatsApp'), DQC = hoja('Data_Qcart_Carritos'), DQP = hoja('Data_Qcart_Productos');
['Report_Resumen', 'Catalogo_Piezas', 'Catalogo_Referencias', 'Data_Email', 'Data_WhatsApp'].forEach(function (n) {
  if (!wb.Sheets[n]) { console.log('🔴 falta la hoja ' + n + '. El normalizador necesita el libro completo.'); process.exit(1); }
});

console.log('════════ FI · NORMALIZADOR TRANSVERSAL ════════\n');
console.log('  libro: ' + require('path').basename(vivo.ruta));
console.log('  Report_Resumen ' + RES.length + ' · Catalogo_Piezas ' + CAT.length + ' · Referencias ' + REF.length +
  ' · Data_Email ' + DE.length + ' · Data_WhatsApp ' + DW.length + '\n');

// ══ 1 · LAS LLAVES ═══════════════════════════════════════════════════════════════════
console.log('══ 1 · las llaves entre catálogos y fuentes ══');
// 🔴 EL RESOLUTOR VA ANTES QUE CUALQUIER LECTURA. Todo lo que este paso mira lo mira por el
//    ENCABEZADO REAL de la hoja, nunca por un nombre escrito aquí. Tres hallazgos falsos de siete
//    salieron de escribirlos: `pieza_id` cuando la hoja dice `Pieza_ID`, y `Touchpoint` cuando el
//    catálogo dice `TouchPoint` — una sola letra, y el cruce de WhatsApp acusó de fantasmas a dos
//    envíos reales (`004-P010` y `004-P013`, 162 cada uno) que sí están en el bloque.
function llaveDe(filas, idLogico) {
  if (!filas || !filas.length) return null;
  var pl = function (s) { return nmz(s).replace(/[^a-z0-9]/g, ''); };
  var objetivo = pl(idLogico);
  var enc = Object.keys(filas[0]);
  for (var i = 0; i < enc.length; i++) if (pl(enc[i]) === objetivo) return enc[i];
  // 🔴 RESPALDO POR PREFIJO ÚNICO — y solo si es ÚNICO. La hoja del reporte llama a su columna
  //    `Quincena_Lanzamiento Principal`; leerla como `Quincena_Lanzamiento` daba vacío en las 76
  //    filas y este paso las acusó a todas de «sin identidad completa». Es el mismo tropiezo que
  //    ya había tenido PUERTA-2 con esa misma columna.
  //    Si el prefijo casa con DOS encabezados no se elige uno: se devuelve null y el check queda
  //    sin evaluar. Adivinar entre dos columnas es peor que no medir.
  var pre = enc.filter(function (h) { return pl(h).indexOf(objetivo) === 0; });
  return pre.length === 1 ? pre[0] : null;
}
var kCat = {};
['Pieza_ID', 'Canal', 'Campaña', 'TouchPoint', 'Estado', 'Notas'].forEach(function (k) { kCat[k] = llaveDe(CAT, k); });
['Pieza_ID', 'Campaña', 'TouchPoint'].forEach(function (k) {
  if (!kCat[k]) nada('llaves', 'el catálogo resuelve la columna ' + k, 'no hay ningún encabezado que resuelva a ' + k + ' — lo que dependa de ella queda sin evaluar');
});
var piezas = {}, dobles = [];
CAT.forEach(function (p, i) {
  var id = t(p[kCat['Pieza_ID']]); if (!id) return;
  if (piezas[id]) dobles.push(id + ' (filas ' + piezas[id].fila + ' y ' + (i + 2) + ')');
  piezas[id] = { p: p, fila: i + 2, canal: t(p[kCat['Canal']]), campana: t(p[kCat['Campaña']]), tp: t(p[kCat['TouchPoint']]) };
});
if (dobles.length) mal('llaves', 'Pieza_ID repetido en el catálogo', dobles.join(' · '), dobles);
else bien('llaves', 'Pieza_ID único en el catálogo', Object.keys(piezas).length + ' ids');

// 🔴 LA LLAVE SE LE PIDE A LA HOJA, NO SE ESCRIBE. Este mismo archivo leía el catálogo por
//    `Pieza_ID` —su encabezado real— y las cuatro fuentes por `pieza_id`, que es la convención del
//    JSON del backend y NO el encabezado del Excel. Resultado: las cuatro hojas reportaron «todas
//    las filas sin pieza_id» (98 de 98, 12 de 12, 2645 de 2645, 696 de 696) cuando las cuatro la
//    tienen al 100%. Cuatro de siete hallazgos eran falsos.
//    Es exactamente el defecto que la cabecera de este paso cuenta —`Pieza_ID` vs `Pieza_IDs`—
//    cometido de nuevo dentro del paso que existe para atraparlo. Y es peor que un check mudo:
//    un normalizador que grita cuatro falsos por corrida enseña a ignorarlo entero.
[['Data_Email', DE], ['Data_WhatsApp', DW],
 ['Data_Qcart_Carritos', DQC], ['Data_Qcart_Productos', DQP]].forEach(function (h) {
  if (!h[1]) { nada('llaves', h[0] + ' anclada al catálogo', 'la hoja no existe en este libro'); return; }
  h[2] = llaveDe(h[1], 'Pieza_ID');
  // 🔴 sin llave NO se dice «0 filas la tienen»: se dice que no se pudo evaluar. Un cero que en
  //    realidad es «no encontré la columna» es la mentira más cara del sistema.
  if (!h[2]) { nada('llaves', h[0] + ' anclada al catálogo', 'no hay ninguna columna que resuelva a Pieza_ID — encabezados: ' + Object.keys(h[1][0]).slice(0, 6).join(', ')); return; }
  var sin = h[1].filter(function (x) { return !t(x[h[2]]); }).length;
  var huerf = h[1].filter(function (x) { return t(x[h[2]]) && !piezas[t(x[h[2]])]; });
  if (sin) mal('llaves', h[0] + ': filas sin pieza_id', sin + ' de ' + h[1].length);
  else if (huerf.length) mal('llaves', h[0] + ': pieza_id que no existe en el catálogo',
    huerf.length + ' · ' + huerf.slice(0, 4).map(function (x) { return t(x[h[2]]); }).join(', '));
  else bien('llaves', h[0] + ' anclada al catálogo', h[1].length + '/' + h[1].length);
});

// piezas del catálogo que ninguna fuente menciona
var mencionadas = {};
[DE, DW, DQC, DQP].forEach(function (filas) {
  if (!filas) return;
  var k = llaveDe(filas, 'Pieza_ID');
  if (!k) return;
  filas.forEach(function (x) { if (t(x[k])) mencionadas[t(x[k])] = 1; });
});
var mudas = Object.keys(piezas).filter(function (id) { return !mencionadas[id]; });
console.log('   piezas del catálogo sin ningún dato: ' + mudas.length + ' de ' + Object.keys(piezas).length);
// 🔴 una pieza muda NO es un error: puede ser una pieza declarada que aún no se envía. Lo que sí
//    es un error es que esté muda Y sin decir por qué.
var mudasSinDecir = mudas.filter(function (id) { return !t(piezas[id].p['Estado']) && !t(piezas[id].p['Notas']); });
if (mudasSinDecir.length) mal('llaves', 'piezas sin datos y sin explicar por qué',
  mudasSinDecir.length + ' · ' + mudasSinDecir.slice(0, 8).join(', '), mudasSinDecir);
else if (mudas.length) bien('llaves', 'toda pieza muda dice por qué lo está', mudas.length + ' mudas, todas con Estado o Notas');
else nada('llaves', 'piezas mudas', 'no hay ninguna');

// ══ 2 · POR FILA · ¿tiene sentido de negocio? ════════════════════════════════════════
console.log('\n══ 2 · por fila: ¿tiene sentido de negocio? ══');
var DATOS = RES.filter(function (x) { return t(x['TouchPoint']); });
var TOTALES = RES.filter(function (x) { return !t(x['TouchPoint']); });
console.log('   filas de datos ' + DATOS.length + ' · sin identidad (totales) ' + TOTALES.length);

// 2a · el canal declarado tiene que cuadrar con las métricas que la fila trae
var COL_EMAIL = ['Principal_Sends', 'FUP_Sends'];
var COL_WA = ['WA-Envíos'];
var canalMal = [];
RES.forEach(function (x, i) {
  if (!t(x['TouchPoint'])) return;
  var em = COL_EMAIL.reduce(function (a, c) { return a + num(x[c]); }, 0);
  var wa = COL_WA.reduce(function (a, c) { return a + num(x[c]); }, 0);
  if (!em && !wa) return;
  // ¿qué canal declara el catálogo para esta campaña × touchpoint?
  var cands = Object.keys(piezas).filter(function (id) {
    return nmz(piezas[id].campana) === nmz(x['Campaña']) && nmz(piezas[id].tp) === nmz(x['TouchPoint']);
  });
  if (!cands.length) {
    // 🔴 LA AUSENCIA TAMBIÉN ES EVIDENCIA. Si la fila trae WhatsApp y la CAMPAÑA entera no tiene
    //    ni una pieza de WhatsApp en el catálogo, no es que «falte información»: es que esos
    //    números son de otra campaña. Así se descubrió que `The Freshers` —una campaña de EMAIL,
    //    piezas 006-P001/P002— cargaba los 2,000 envíos de WhatsApp que son de `ICE` (010-P001).
    var deLaCampana = Object.keys(piezas).filter(function (id) { return nmz(piezas[id].campana) === nmz(x['Campaña']); });
    if (wa && deLaCampana.length && !deLaCampana.some(function (id) { return nmz(piezas[id].canal) === 'whatsapp'; })) {
      canalMal.push({
        fila: i + 2, campana: t(x['Campaña']), tp: t(x['TouchPoint']), seg: t(x['Segmento']),
        q: t(x['Quincena_Lanzamiento']), wa: wa, canal_catalogo: '(ninguna pieza de WhatsApp)',
        dice: 'trae ' + mil(wa) + ' envíos de WhatsApp y la campaña «' + t(x['Campaña']) +
          '» no tiene NI UNA pieza de WhatsApp en el catálogo (' + deLaCampana.length + ' piezas, todas de otro canal)'
      });
    }
    return;
  }
  var canales = {}; cands.forEach(function (id) { canales[nmz(piezas[id].canal)] = 1; });
  if (wa && !canales['whatsapp']) canalMal.push({
    fila: i + 2, campana: t(x['Campaña']), tp: t(x['TouchPoint']), seg: t(x['Segmento']),
    q: t(x['Quincena_Lanzamiento']), wa: wa, canal_catalogo: Object.keys(canales).join('/'),
    dice: 'trae ' + mil(wa) + ' envíos de WhatsApp y el catálogo dice que esta pieza es ' + Object.keys(canales).join('/')
  });
  if (em && !canales['email']) canalMal.push({
    fila: i + 2, campana: t(x['Campaña']), tp: t(x['TouchPoint']), seg: t(x['Segmento']),
    q: t(x['Quincena_Lanzamiento']), email: em, canal_catalogo: Object.keys(canales).join('/'),
    dice: 'trae ' + mil(em) + ' envíos de email y el catálogo dice que esta pieza es ' + Object.keys(canales).join('/')
  });
});
if (canalMal.length) {
  mal('por fila', 'el canal de la fila contradice al catálogo', canalMal.length + ' fila(s)', canalMal);
  canalMal.forEach(function (c) { console.log('   🔴 f' + c.fila + '  ' + c.campana + ' · ' + c.tp + ' · ' + c.seg + '  →  ' + c.dice); });
} else bien('por fila', 'el canal de cada fila cuadra con el catálogo', DATOS.length + ' filas evaluadas');

// 2b · una fila con métricas tiene que tener identidad completa
var kRep = {};
['Tot_Sends', 'WA-Envíos', 'Carritos_Total', 'Campaña', 'Objetivo', 'Quincena_Lanzamiento'].forEach(function (k) { kRep[k] = llaveDe(DATOS, k); });
var sinResolver = Object.keys(kRep).filter(function (k) { return !kRep[k]; });
var incompletas = sinResolver.length ? [] : DATOS.filter(function (x) {
  var v = num(x[kRep['Tot_Sends']]) + num(x[kRep['WA-Envíos']]) + num(x[kRep['Carritos_Total']]);
  return v > 0 && (!t(x[kRep['Campaña']]) || !t(x[kRep['Objetivo']]) || !t(x[kRep['Quincena_Lanzamiento']]));
});
if (sinResolver.length) nada('por fila', 'identidad completa en filas con métricas', 'el reporte no resuelve: ' + sinResolver.join(', '));
if (incompletas.length) mal('por fila', 'filas con números y sin identidad completa', incompletas.length + ' fila(s)',
  incompletas.map(function (x) { return t(x['Campaña']) + ' · ' + t(x['TouchPoint']); }));
else bien('por fila', 'toda fila con números tiene campaña, objetivo y quincena', DATOS.length + ' filas');

// ══ 3 · DUPLICADOS: el mismo envío contado dos veces ═════════════════════════════════
console.log('\n══ 3 · el mismo envío en dos filas ══');
// 3a · por Email_ID
var porEmailId = {}, dupEmail = [];
RES.forEach(function (x, i) {
  if (!t(x['TouchPoint'])) return;
  t(x['Email_ID (SFMC)']).split(/[,;·]/).map(t).filter(Boolean).forEach(function (id) {
    (porEmailId[id] = porEmailId[id] || []).push({ fila: i + 2, x: x });
  });
});
Object.keys(porEmailId).forEach(function (id) {
  if (porEmailId[id].length > 1) dupEmail.push({
    email_id: id,
    filas: porEmailId[id].map(function (o) { return 'f' + o.fila + ' ' + t(o.x['Campaña']) + '·' + t(o.x['TouchPoint']) + ' [' + t(o.x['Quincena_Lanzamiento']) + ']'; })
  });
});
if (dupEmail.length) {
  mal('duplicados', 'un Email_ID en más de una fila del reporte', dupEmail.length + ' id(s)', dupEmail);
  dupEmail.slice(0, 8).forEach(function (d) { console.log('   🔴 Email_ID ' + d.email_id + ': ' + d.filas.join('  |  ')); });
} else bien('duplicados', 'ningún Email_ID aparece en dos filas', Object.keys(porEmailId).length + ' ids distintos');

// 3b · dos filas de WhatsApp con el MISMO volumen.
// 🔴 MISMO VOLUMEN NO ES, POR SÍ SOLO, UN DUPLICADO. `Partido 2` y `Partido 3` mandaron 162
//    envíos cada uno: son dos envíos distintos que coinciden en número, y acusarlos entrena a
//    ignorar al guardián. Solo es duplicado si UNA de las dos filas NO tiene respaldo en el
//    bloque de WhatsApp — entonces sí: alguien está mostrando el mismo envío dos veces.
var waFilas = RES.map(function (x, i) { return { fila: i + 2, x: x, wa: num(x['WA-Envíos']) }; })
  .filter(function (o) { return t(o.x['TouchPoint']) && o.wa > 0; });
var respaldo = {};
if (fs.existsSync(BACK + '/_fuentes/whatsapp.json')) {
  var WAb = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
  (WAb.envios || []).forEach(function (e) {
    var pid = t(e.pieza_id); if (!pid || !piezas[pid]) return;
    respaldo[nmz(piezas[pid].campana) + '¦' + nmz(piezas[pid].tp)] = (+e.wa_sends || +e.sends || 0);
  });
}
var porVol = {}; waFilas.forEach(function (o) { (porVol[o.wa] = porVol[o.wa] || []).push(o); });
var dupWa = Object.keys(porVol).filter(function (v) {
  if (porVol[v].length < 2) return false;
  return porVol[v].some(function (o) { return respaldo[nmz(o.x['Campaña']) + '¦' + nmz(o.x['TouchPoint'])] === undefined; });
});
var coincidencias = Object.keys(porVol).filter(function (v) { return porVol[v].length > 1 && dupWa.indexOf(v) < 0; });
if (coincidencias.length) {
  console.log('   (' + coincidencias.length + ' coincidencia(s) de volumen entre envíos que SÍ están los dos en el bloque: ' +
    coincidencias.map(function (v) { return mil(v); }).join(', ') + ' — no son duplicados)');
}
if (dupWa.length) {
  var det = dupWa.map(function (v) {
    return mil(v) + ' envíos en ' + porVol[v].map(function (o) {
      var r = respaldo[nmz(o.x['Campaña']) + '¦' + nmz(o.x['TouchPoint'])];
      return 'f' + o.fila + ' ' + t(o.x['Campaña']) + '·' + t(o.x['TouchPoint']) + (r === undefined ? ' 🔴 SIN respaldo en el bloque' : ' ✔ en el bloque');
    }).join('   |   ');
  });
  mal('duplicados', 'el mismo volumen de WhatsApp en dos filas, y una no existe en el bloque', det.join(' · '), det);
  det.forEach(function (d) { console.log('   🔴 ' + d); });
} else bien('duplicados', 'toda coincidencia de volumen en WhatsApp tiene respaldo en el bloque', waFilas.length + ' filas con WA');

// 3c · el bloque de WhatsApp contra las filas del reporte, pieza por pieza
if (fs.existsSync(BACK + '/_fuentes/whatsapp.json')) {
  var WA = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
  var sumaBloque = (WA.envios || []).reduce(function (a, e) { return a + (+e.wa_sends || +e.sends || 0); }, 0);
  var sumaHoja = waFilas.reduce(function (a, o) { return a + o.wa; }, 0);
  console.log('   bloque ' + mil(sumaBloque) + '  ·  filas del reporte ' + mil(sumaHoja) +
    '  ·  piezas: bloque ' + (WA.envios || []).length + ' / filas ' + waFilas.length);
  if (sumaBloque !== sumaHoja) mal('duplicados', 'WhatsApp: el bloque y las filas no suman lo mismo',
    'bloque ' + mil(sumaBloque) + ' vs filas ' + mil(sumaHoja));
  else if ((WA.envios || []).length !== waFilas.length) mal('duplicados',
    'WhatsApp: suman igual pero con distinto número de filas — hay una fila de más y otra de menos',
    'bloque ' + (WA.envios || []).length + ' piezas · reporte ' + waFilas.length + ' filas');
  else bien('duplicados', 'WhatsApp cuadra pieza por pieza', (WA.envios || []).length + ' piezas · ' + mil(sumaBloque));
} else nada('duplicados', 'WhatsApp contra su bloque', 'no hay whatsapp.json');

// ══ 4 · PERIODO: la misma oleada no puede caer en dos quincenas ══════════════════════
console.log('\n══ 4 · la misma oleada en dos quincenas ══');
var porOleada = {};
DATOS.forEach(function (x, i) {
  var k = nmz(x['Campaña']) + '¦' + nmz(x['TouchPoint']);
  (porOleada[k] = porOleada[k] || []).push({ q: t(x['Quincena_Lanzamiento']), seg: t(x['Segmento']), fila: i });
});
var partidas = [];
Object.keys(porOleada).forEach(function (k) {
  var qs = {}; porOleada[k].forEach(function (o) { if (o.q) qs[o.q] = (qs[o.q] || 0) + 1; });
  var lista = Object.keys(qs);
  if (lista.length < 2) return;
  // 🔴 que una pieza mande en varias quincenas es NORMAL (18 lo hacen). Lo que NO es normal es
  //    que los SEGMENTOS de un mismo touchpoint se repartan: eso significa que la misma oleada
  //    se está reportando en dos periodos según por qué vía llegó cada segmento.
  var segsPorQ = {};
  porOleada[k].forEach(function (o) { (segsPorQ[o.q] = segsPorQ[o.q] || []).push(nmz(o.seg)); });
  var repetido = lista.some(function (q1) {
    return lista.some(function (q2) {
      return q1 !== q2 && segsPorQ[q1].some(function (s) { return segsPorQ[q2].indexOf(s) >= 0; });
    });
  });
  if (!repetido) partidas.push({ id: k.replace('¦', ' · '), quincenas: lista, por_quincena: qs });
});
if (partidas.length) {
  console.log('   ' + partidas.length + ' touchpoint(s) con sus segmentos repartidos entre quincenas:');
  partidas.forEach(function (p) {
    console.log('   ⚠ ' + p.id.padEnd(34) + Object.keys(p.por_quincena).map(function (q) { return q + '(' + p.por_quincena[q] + ')'; }).join('  '));
  });
  mal('periodo', 'una misma oleada repartida en dos quincenas', partidas.length + ' touchpoint(s)', partidas);
} else bien('periodo', 'ninguna oleada se parte entre quincenas', Object.keys(porOleada).length + ' touchpoints evaluados');

// ══ 5 · FILAS FUERA DEL RANGO DE LA FILA DE TOTALES ═════════════════════════════════
console.log('\n══ 5 · filas por debajo de la fila de totales ══');
// la fila de totales es la que NO tiene TouchPoint y sí trae números
// 🔴 LA FILA DE TOTALES NO SE BUSCA POR SU VALOR. Se buscaba «sin TouchPoint y con Tot_Sends > 0»
//    y dejó de encontrarse en cuanto sus fórmulas perdieron el valor cacheado —SheetJS no
//    materializa una fórmula sin `<v>`, aunque Excel la recalcule al abrir—. El check pasó a
//    «N/A» sin que nada estuviera mal: un guardián que depende de un dato cacheado se apaga solo.
//    Se busca por lo que la define: NO tiene TouchPoint pero SÍ tiene etiqueta en la 1ª columna.
var iTot = -1;
RES.forEach(function (x, i) {
  if (t(x['TouchPoint'])) return;
  if (num(x['Tot_Sends']) > 0 || /total/i.test(t(x['Campaña']))) iTot = i;
});
if (iTot < 0) nada('totales', 'filas fuera del rango', 'no encontré la fila de totales');
else {
  var debajo = RES.slice(iTot + 1).filter(function (x) { return t(x['TouchPoint']); });
  console.log('   fila de totales: f' + (iTot + 2) + '   ·   filas de datos por debajo: ' + debajo.length);
  if (debajo.length) {
    var det2 = debajo.map(function (x) {
      return t(x['Campaña']) + ' · ' + t(x['TouchPoint']) + ' · ' + t(x['Segmento']) + ' [' + t(x['Quincena_Lanzamiento']) + ']' +
        '  Tot_Sends ' + mil(num(x['Tot_Sends'])) + '  WA ' + mil(num(x['WA-Envíos'])) + '  carritos ' + mil(num(x['Carritos_Total']));
    });
    det2.forEach(function (d) { console.log('   🔴 ' + d); });
    mal('totales', 'hay filas de datos POR DEBAJO de la fila de totales — quedan fuera del SUM',
      debajo.length + ' fila(s) · ' + det2.join(' · '), det2);
  } else bien('totales', 'la fila de totales es la última', 'f' + (iTot + 2) + ' de ' + (RES.length + 1));
}

// ══ 6 · I2 · TODO DATO NO VALIDADO TIENE QUE ESTAR MARCADO ══════════════════════════
console.log('\n══ 6 · I2 · lo no validado, ¿está marcado? ══');
var MARCAS = /^\*\*|⚠|Por llenar|Por confirmar|estimad|supuesto/i;
var marcadas = 0, deberian = [];
// 6a · EmailID del catálogo: o está en SFMC, o va marcado
CAT.forEach(function (p, i) {
  var id = t(p['Pieza_ID']), eid = t(p['EmailID']);
  if (!id) return;
  if (MARCAS.test(eid)) { marcadas++; return; }
  if (!eid && nmz(p['Canal']) === 'email' && num(p['Sends']) > 0) {
    deberian.push({ fila: i + 2, pieza: id, campo: 'EmailID', porque: 'es email con ' + mil(num(p['Sends'])) + ' envíos y no trae EmailID ni marca' });
  }
});
console.log('   catálogo · EmailID marcados como «**Por llenar»: ' + marcadas);
console.log('   catálogo · EmailID que faltan y NO están marcados: ' + deberian.length);
if (deberian.length) {
  deberian.slice(0, 10).forEach(function (d) { console.log('      🔴 f' + d.fila + ' ' + d.pieza + ' · ' + d.porque); });
  mal('marcado', 'hay datos que faltan y no están marcados', deberian.length + ' celda(s)', deberian);
} else bien('marcado', 'todo EmailID ausente está marcado', marcadas + ' marcados');

/* 6b · el CTOR de WhatsApp derivado de un supuesto tiene que decirlo.
 *
 * 🔴 22-sep-2026 · SE MIDE EN EL BLOQUE, NO EN LA HOJA. Antes leía la columna `CTOR` de
 *    `Data_WhatsApp` y comprobaba que no trajera número. Esa columna se retiró: era una
 *    derivación guardada junto a sus conteos, o sea un caché sin invalidación (llegó a decir
 *    60.90% teniendo 2,405 y 2,890 en su propia fila, que dan 83.22%).
 *    La comprobación NO se pierde, se muda a donde de verdad vive el hecho: el bloque declara
 *    `clicks_medidos` y `clicks`, y la regla es que un click no medido sea `null` — nunca un
 *    número. Vigilar la hoja era vigilar la copia; vigilar el bloque es vigilar el original. */
var BW = null;
try { BW = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8')).envios || []; } catch (e) { }
if (BW) {
  var noMedidos = BW.filter(function (x) { return !/^s/i.test(String(x.clicks_medidos || '')); });
  var conClickVisible = noMedidos.filter(function (x) { return x.clicks !== null && x.clicks !== undefined; });
  console.log('   WhatsApp · envíos con clicks NO medidos: ' + noMedidos.length +
    '   de ellos con un número en clicks: ' + conClickVisible.length);
  if (conClickVisible.length) mal('marcado', 'clicks de WhatsApp derivados de un supuesto y cargados como si fueran medidos',
    conClickVisible.length + ' envío(s)');
  else if (noMedidos.length) bien('marcado', 'el click no medido de WhatsApp va en null', noMedidos.length + ' envíos');
  else nada('marcado', 'clicks de WhatsApp no medidos', 'no hay envíos con clicks_medidos = no');
}

// 6c · piezas cuya fuente NO es autoritativa
var viasRaras = {};
CAT.forEach(function (p) {
  var f = t(p['Fuente_Dato']); if (!f) return;
  viasRaras[f] = (viasRaras[f] || 0) + 1;
});
console.log('   catálogo · vías de origen del dato:');
Object.keys(viasRaras).sort(function (a, b) { return viasRaras[b] - viasRaras[a]; }).forEach(function (k) {
  console.log('      ' + String(viasRaras[k]).padStart(4) + '  ' + k.slice(0, 66));
});

// ══ VEREDICTO ═══════════════════════════════════════════════════════════════════════
console.log('\n════════ VEREDICTO ════════');
console.log('  ✅ coherente: ' + oks.length + '   🔴 hallazgos: ' + hallazgos.length + '   ⊘ N/A: ' + na.length + '\n');
// 🔴 UN CHECK QUE SOLO SE IMPRIME AL FALLAR NO SE PUEDE CITAR. Los verdes también se listan:
//    si no, nadie puede saber QUÉ se midió cuando todo salió bien.
console.log('  lo que se midió y quedó coherente:');
oks.forEach(function (o) { console.log('     ✅ [' + o.area + '] ' + o.que + '  —  ' + o.evidencia); });
console.log('');
if (hallazgos.length) {
  hallazgos.forEach(function (h, i) {
    console.log('  ' + (i + 1) + ') [' + h.area + '] ' + h.que);
    console.log('      ' + String(h.detalle).slice(0, 190));
  });
  console.log('\n  🔴 EL NORMALIZADOR NO REPARA. Estas son decisiones de Rick: varias de estas filas');
  console.log('     las escribió él a mano y «corregirlas» solo borraría su trabajo.');
} else {
  console.log('  ✅ el libro es coherente cruzando hojas.');
}
if (na.length) { console.log('\n  ⊘ sin evaluar (y por qué):'); na.forEach(function (x) { console.log('     · ' + x.que + ' — ' + x.porque); }); }

fs.writeFileSync(BACK + '/_fuentes/normalizador.json', JSON.stringify({
  paso: 'cuadre-coherencia', libro: require('path').basename(vivo.ruta),
  coherente: oks, hallazgos: hallazgos, sin_evaluar: na
}, null, 1));
console.log('\n  → _fuentes/normalizador.json');
process.exit(0);
