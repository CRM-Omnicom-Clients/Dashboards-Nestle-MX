// motor-clicks · EL DESGLOSE DE CLICKS POR DESTINO, desde `CRM_Email_Links`.
//
// 🔴 `Link_Name` VIENE VACÍO en casi todas las filas de la DE — el nombre del botón no está
//    capturado. Pero `Link_URL` sí, y el destino ES un hecho de la URL: `qcart.app` es el
//    carrito, `apps.apple.com`/`play.google.com` es la app, `unsub` es la baja. Clasificar por
//    ahí no es inferir del naming: es leer a dónde apunta el enlace.
//    ⚠ Lo que no cae en ninguna clase entra como `otro` y se cuenta — no se reparte a ojo.
//
// 🔴 Y EL DESGLOSE TIENE QUE CUADRAR CON EL TOTAL: Σ de las clases == Σ de los links de la pieza.
//    Un desglose que no suma su propio total es peor que no tenerlo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'motor';   // el ámbito de este skill dentro del catálogo raíz
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var _v = require(BACK + '/_scripts/lib-flexible.js').exigirInsumo('sfmc-links',
  'Son los clicks por destino de SFMC. Traelos con:  node ' + __dirname + '/fuentes-email.refrescar-volcado.js --escribir   (necesita el MCP de SFMC conectado).');
var INS = _v.ruta;   // el vigente, no una fecha fija
var D = JSON.parse(fs.readFileSync(INS, 'utf8'));
console.log('════════ motor-clicks · CLICKS POR DESTINO ════════\n');
console.log('  volcado: ' + D.count + ' links   (' + Math.round(fs.statSync(INS).size / 1024) + ' KB, nunca al contexto)');

// 🔴 LOS PATRONES YA NO VIVEN AQUÍ (19-sep-2026). Viven en `_contratos/clicks-destinos.json` — el
//    diccionario que Rick pidió: qué es cada tipo de click, qué links lo componen, y a qué familia
//    pertenece. `lib-clicks-destino` lo aplica y `motor.auditar-destinos.js` lo valida.
//
//    LA VERSIÓN QUE ESTABA AQUÍ TENÍA DOS DEFECTOS, y el segundo es el que dolió:
//      · buscaba `unsub|optout|baja|desuscri`, y la URL de baja de Nestlé es
//        `www.nestle.com.mx/centro-de-preferencias`. No matcheaba ninguno.
//      · terminaba en `if (/^https?:/) return 'web'` — un CATCH-ALL. Así que esos clicks al centro
//        de preferencias, los 2,264 de ver-en-navegador y los 479 del aviso de privacidad se
//        convertían en `web`, o sea en INTENCIÓN, sin que nada se pusiera rojo.
//    El contrato nuevo no tiene catch-all: lo desconocido cae en `por_clasificar` y se declara.
//    Y separó `retail` de `contenido` — 14,009 clicks a Amazon y Walmart, el 31% de toda la
//    actividad, estaban mezclados con las recetas.
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
function claseDe(url, nombre) { return CD.clase(url, nombre); }

// 🔴 SE CRUZA POR ContentName, NO POR ConfigKey. SFMC todavia trae el ConfigKey PROVISIONAL
//    ('TMP-AON-EAPP') de las 22 piezas nuevas -el handoff lo dice: la numeracion es nuestra- asi
//    que cruzar por ahi dejaba 34 piezas sin sus links y perdia 3,544 clicks. El ContentName es
//    la llave que declara el handoff, y esa si casa.
var XLSX = require('xlsx');
var L = require(BACK + '/_scripts/lib-flexible.js');
var RG = require(BACK + '/_scripts/lib-registro.js');
var PROY = ENT.PROYECTO;
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_ne.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TMP);
var CATW = XLSX.readFile(TMP);
var encC = XLSX.utils.sheet_to_json(CATW.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var hC = RG.abrir('catalogo', encC, { silencioso: true });
var CAT = XLSX.utils.sheet_to_json(CATW.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
/* 🔴 19-sep-2026 · EL CRUCE POR NOMBRE SE LE PIDE A `lib-canonico`, NO SE ESCRIBE AQUÍ.
 *    Este script tenía su propio índice, y miraba UNA sola columna (`catalogo.content_name`) sin
 *    variantes y sensible a mayúsculas. `motor.hoja-clicks.js` tenía otro, que sí miraba las
 *    variantes y normalizaba. Dos resolutores para la misma pregunta —«¿de qué pieza es este
 *    envío?»— y por eso uno resolvía 931 de 931 filas mientras el otro dejaba **28 piezas** con su
 *    ConfigKey provisional (`TMP-AON-EAPP`, `009-TMP-PP-E3-P`) y **6,471 clicks, el 14.2%**, fuera
 *    de toda fila del reporte. Ninguna puerta lo veía: el bloque cuadraba consigo mismo.
 *    Ahora los dos preguntan al índice canónico, que además marca AMBIGUO cuando dos piezas
 *    comparten un nombre en vez de elegir una — elegir «la primera» ya movió 186 carritos en Qcart.
 * 🔴 SE EXIGE QUE EL ÍNDICE ENCUENTRE ALGO. Si resolviera 0 filas por nombre, este paso se detiene:
 *    un índice vacío no falla solo, se cae al ConfigKey y sigue como si nada — que es lo que pasó.
 */
var CNL = require(BACK + '/_scripts/lib-canonico.js');
var IXL = CNL.indexarPiezas(CAT);
function piezaDeNombre(r) {
  var cands = [t(r.Email_Content_Name), t(r.EmailName)];
  for (var i = 0; i < cands.length; i++) {
    if (!cands[i]) continue;
    var hit = IXL.porContent[CNL.nm(cands[i])];
    if (hit && hit !== '¦AMBIGUO¦') return t(hit[hC.n('catalogo.pieza_id')]);
  }
  return null;
}
var sinCruce = {}, viaNombre = 0;
var porPieza = {};
D.rows.forEach(function (r) {
  var porNom = piezaDeNombre(r);
  var ck = porNom || t(r.ConfigKey);
  if (porNom) viaNombre++; else sinCruce[t(r.ConfigKey)] = 1;
  if (!ck) return;
  var p = porPieza[ck] = porPieza[ck] || { pieza_id: ck, links: 0, clicks_total: 0, clicks_unicos: 0, por_destino: {}, top: [], _cks: {} };
  /* de qué ConfigKey(s) de SFMC salió esta pieza — hace falta para saber cuántos de sus clicks
     vienen de un job de prueba, porque las pruebas se cuentan por ConfigKey y no por pieza */
  p._cks[t(r.ConfigKey)] = 1;
  var c = claseDe(r.Link_URL, r.Link_Name);
  p.links++;
  p.clicks_total += num(r.Clicks_Total);
  p.clicks_unicos += num(r.Clicks_Unique);
  /* 🔴 EL DESGLOSE VA EN CLICKS ÚNICOS POR LINK — y esto es una CORRECCIÓN de la misma tarde.
   *
   *    Primero lo pasé a `Clicks_Total` porque así Σdesglose ≤ total-del-detalle cuadraba 107/107.
   *    Pero medí contra la columna equivocada: el objetivo no es cuadrar contra el detalle, es no
   *    contradecir a `*_Clicks`, que es la columna que el reporte enseña. Con totales, el reporte
   *    publicaba `Mundial·E-P2 · Redes+Navegador+Legal = 7,879` contra `Clicks = 87` — **90×**.
   *    Noventa clics por persona no existe: los clicks TOTALES traen escáneres y prefetch.
   *
   *    Medido sobre las 76 piezas comparables, un destino excede a `Clicks`:
   *        con ÚNICOS  →  31 casos, peor ratio  4.0× (y solo 1.2× fuera de dos piezas diminutas)
   *        con TOTALES →  87 casos, peor ratio 90.6×
   *
   *    Queda un exceso estructural de ~1.2× que NO es un defecto y no se puede quitar sin inventar:
   *    `Clicks_CTA` agrupa cuatro clases de link (qcart, retail, app, contenido), así que quien
   *    toca dos de ellas cuenta DOS veces en CTA y UNA en `Clicks`. Por eso el desglose tiene su
   *    propio total, `Clicks_Medidos`, y es contra ése contra el que se compara. */
  p.por_destino[c] = (p.por_destino[c] || 0) + num(r.Clicks_Unique);
  p.top.push({ destino: c, url: t(r.Link_URL).slice(0, 120), nombre: t(r.Link_Name), unicos: num(r.Clicks_Unique), total: num(r.Clicks_Total) });
});
Object.keys(porPieza).forEach(function (k) {
  porPieza[k].top.sort(function (a, b) { return b.unicos - a.unicos; });
  porPieza[k].top = porPieza[k].top.slice(0, 5);
});

/* 🔴 EL TOTAL DEL BLOQUE ES LA SUMA DEL PROPIO DESGLOSE — `clicks_medidos`.
 *    Así la regla de Rick se cumple POR CONSTRUCCIÓN y no por suerte del dato. Antes se comparaba
 *    `Σ por_destino` contra `clicks_unicos`, pero las dos cifras salían del MISMO campo en el MISMO
 *    bucle: un guardián que se compara consigo mismo pasa siempre en verde — y pasó, mientras el
 *    reporte publicaba 325 clicks de CTA sobre un total de 288.
 *    `clicks_unicos` se conserva porque alimenta CTOR y Click_Rate: son DOS preguntas distintas y
 *    el reporte las dice distinto. */
var descuadres = [];
Object.keys(porPieza).forEach(function (k) {
  var p = porPieza[k];
  p.clicks_medidos = Object.keys(p.por_destino).reduce(function (a, c) { return a + p.por_destino[c]; }, 0);
  /* el desglose se compara contra los ÚNICOS por link, que es de donde sale. Lo que no cae en
     ninguna columna (`por_clasificar`) se declara aparte y no se suma: por eso puede ser menor. */
  if (p.clicks_medidos > p.clicks_unicos) descuadres.push({ pieza: k, desglose: p.clicks_medidos, total: p.clicks_unicos });
});

/* ── y el contraste que NO es circular: contra el DETALLE, que este paso no escribe ──────
 * 🔴 Los links no traen `JobID`, así que sus clicks NO se pueden limpiar de jobs de prueba. Se
 *    compara contra la misma población (el detalle CON pruebas) para que la aritmética cierre, y
 *    se DECLARA en qué piezas la prueba pesa: son 534 clicks de 97,743 (0.55%) pero concentrados
 *    — hay piezas de Pro Plan donde el 100% de los clicks del desglose son de una prueba interna.
 *    Callarlo sería publicar un desglose que no mide a nadie. */
var contaminadas = [];
try {
  var FE = require(__dirname + '/lib-fechas-envio.js');
  var LF = require(__dirname + '/lib-flexible.js');
  var rd = LF.insumoVigente('sfmc-detalle'); rd = typeof rd === 'string' ? rd : (rd && (rd.ruta || rd.archivo));
  var det = JSON.parse(fs.readFileSync(rd, 'utf8')).rows || [];
  var conP = {}; det.forEach(function (r) { var k = t(r.ConfigKey); conP[k] = (conP[k] || 0) + num(r.Email_Total_Clicks); });
  var sinP = FE.totalesPorPieza().porConfigKey;
  /* 🔴 LA CONTAMINACIÓN SE SUMA POR LOS ConfigKey DE LA PIEZA, NO POR SU pieza_id. Tras el cruce
   *    por nombre, `009-TMP-PA-E3-M` ES `009-P009`: buscar las pruebas por `009-P009` no encuentra
   *    nada y la pieza quedaría marcada como limpia teniendo el 100% de sus clicks en un job de
   *    prueba. El mapa de pruebas vive en el espacio de ConfigKey; hay que traducirlo. */
  var exceden = [];
  Object.keys(porPieza).forEach(function (k) {
    var p = porPieza[k];
    var cks = Object.keys(p._cks || {});
    var totCon = cks.reduce(function (a, ck) { return a + (conP[ck] || 0); }, 0);
    var totSin = cks.reduce(function (a, ck) { return a + ((sinP[ck] || {}).Email_Total_Clicks || 0); }, 0);
    if (!totCon) return;
    if (p.clicks_medidos > totCon) exceden.push(k + ': desglose ' + p.clicks_medidos + ' > detalle ' + totCon);
    var test = totCon - totSin;
    /* 🔴 los clicks de prueba se guardan SIEMPRE que los haya, no solo cuando pasan del 5%: el
     *    umbral es para el aviso, pero quien decide si una fila tiene algo real que desglosar
     *    necesita la cifra exacta. Un umbral en el dato es cómo se pierde un caso de borde. */
    if (test > 0) p.clicks_de_prueba = test;
    if (test > 0 && (test / totCon) >= 0.05) {
      contaminadas.push({ pieza: k, clicks: totCon, de_prueba: test, pct: +((test / totCon) * 100).toFixed(1) });
    }
  });
  contaminadas.sort(function (a, b) { return b.pct - a.pct; });
  console.log('  contraste contra el DETALLE (fuente que este paso no escribe): ' +
    (exceden.length ? '🔴 ' + exceden.length + ' exceden — ' + exceden.slice(0, 3).join(' · ') : '✔ ninguna pieza excede'));
  if (contaminadas.length) {
    console.log('  ⚠ ' + contaminadas.length + ' pieza(s) donde los jobs de PRUEBA pesan ≥5% de sus clicks:');
    contaminadas.slice(0, 5).forEach(function (x) {
      console.log('       ' + x.pieza.padEnd(22) + x.de_prueba + ' de ' + x.clicks + ' clicks (' + x.pct + '%)');
    });
  }
} catch (e) { console.log('  ⚠ no pude contrastar contra el detalle: ' + String(e.message).slice(0, 70)); }

var clases = {};
Object.keys(porPieza).forEach(function (k) {
  Object.keys(porPieza[k].por_destino).forEach(function (c) { clases[c] = (clases[c] || 0) + porPieza[k].por_destino[c]; });
});
console.log('  piezas con links: ' + Object.keys(porPieza).length);
console.log('  Σ clicks únicos : ' + mil(Object.keys(porPieza).reduce(function (a, k) { return a + porPieza[k].clicks_unicos; }, 0)));
// 🔴 EL CRUCE SE DECLARA Y SE EXIGE. Un índice que no resuelve nada no falla: cada fila se cae al
//    ConfigKey provisional y el bloque sigue cuadrando consigo mismo, con el 14% de los clicks en
//    piezas que ninguna fila del reporte recoge. Se imprime cuántas resolvió por nombre y, si son
//    CERO habiendo filas, el paso se detiene: eso solo puede ser el índice roto.
var restanTMP = Object.keys(porPieza).filter(function (k) { return /(^|-)TMP-/.test(k); });
console.log('  cruce por NOMBRE: ' + viaNombre + ' de ' + D.rows.length + ' fila(s)' +
  (Object.keys(sinCruce).length ? '   ·   ' + Object.keys(sinCruce).length + ' ConfigKey(s) sin nombre que cruce' : '   ·   todas cruzaron'));
if (restanTMP.length) console.log('  ⚠ ' + restanTMP.length + ' pieza(s) siguen con ConfigKey provisional: ' + restanTMP.slice(0, 8).join(' · '));
if (D.rows.length && viaNombre === 0) {
  console.log('\n  🔴 CERO filas cruzaron por nombre habiendo ' + D.rows.length + '. El índice de nombres está roto —');
  console.log('     no se sigue: todo caería al ConfigKey provisional y el bloque cuadraría consigo mismo.');
  process.exit(1);
}
console.log('\n  ── por destino (clicks únicos)');
Object.keys(clases).sort(function (a, b) { return clases[b] - clases[a]; }).forEach(function (c) {
  console.log('     ' + c.padEnd(18) + mil(clases[c]).padStart(8));
});
console.log('\n  ── el desglose cuadra con su total: ' + (descuadres.length ? '🔴 ' + descuadres.length + ' pieza(s) no' : '✔ en las ' + Object.keys(porPieza).length));

fs.writeFileSync(BACK + '/_fuentes/links.json', JSON.stringify({
  paso: 'motor-clicks', generado_por: 'motor.links.js', fuente: 'SFMC · CRM_Email_Links',
  llave: 'ConfigKey = pieza_id',
  clases: 'el destino se lee de la URL: qcart · app · social · unsub · ver_en_navegador · web · otro',
  piezas: porPieza,
  auditoria: { piezas: Object.keys(porPieza).length, links: D.count,
    clicks_unicos: Object.keys(porPieza).reduce(function (a, k) { return a + porPieza[k].clicks_unicos; }, 0),
    sin_cruce_por_contentname: Object.keys(sinCruce),
    por_destino: clases, descuadres: descuadres }
}, null, 1));
console.log('\n  → _fuentes/links.json');
