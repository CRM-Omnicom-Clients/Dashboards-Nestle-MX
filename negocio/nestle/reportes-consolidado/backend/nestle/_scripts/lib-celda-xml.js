// lib-celda-xml.js — reemplazar UNA celda dentro del XML de una hoja, sin comerse las vecinas.
//
// 🔴 POR QUÉ EXISTE. Este mismo error lo cometí DOS VECES en una sola sesión, en dos scripts
//    distintos, y las dos veces destruyó datos en silencio:
//
//      new RegExp('<c r="P265"([^>]*)>[\\s\\S]*?</c>')
//
//    Si la celda está AUTOCERRADA —`<c r="P265"/>`, que es como queda una celda vacía— entonces
//    `([^>]*)` se traga el `/`, la expresión da por abierta una etiqueta que ya estaba cerrada,
//    y `[\s\S]*?</c>` sigue hacia ADELANTE hasta el primer `</c>` que encuentre: se lleva por
//    delante todas las celdas de en medio. No lanza ningún error. La fila simplemente pierde
//    columnas.
//    Así desapareció el `Email_Content_Name` de la fila de Purina: estaba después de una celda
//    vacía que se acababa de neutralizar.
//
//    Y es el MISMO error que tenía `xlsx-validar-fondo.py` con `<border/>`, corregido el mismo
//    día. Tres veces la misma trampa ⇒ deja de ser un descuido y pasa a ser una función.
//
// ⚠ La regla, para cualquier regex sobre XML: **una etiqueta vacía no tiene cierre que buscar.**
//   Antes de escribir `<tag[^>]*>…</tag>`, preguntarse si `<tag/>` es posible. Casi siempre lo es.
var t = function (v) { return String(v == null ? '' : v).trim(); };

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** el número de columna de una referencia: A1→1, AA5→27. Hace falta para insertar EN ORDEN. */
function colNum(ref) {
  var m = /^([A-Z]+)/.exec(String(ref)); if (!m) return 0;
  var n = 0;
  for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return n;
}

/** el estilo `s="N"` que ya tenía esa celda, para que corregir el valor no cambie cómo se ve */
function estiloDe(xml, ref) {
  var m = new RegExp('<c r="' + ref + '"([^>]*)').exec(xml);
  if (!m) return undefined;
  var s = /\ss="(\d+)"/.exec(m[1]);
  return s ? s[1] : undefined;
}

/** arma el XML de una celda con su valor y su estilo */
function celda(ref, v, estilo) {
  var st = estilo !== undefined ? ' s="' + estilo + '"' : '';
  if (v === null || v === undefined || v === '') return '<c r="' + ref + '"' + st + '/>';
  if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
  return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
}

/**
 * Sustituye la celda `ref` por `nueva`. Devuelve { xml, como } — `como` dice qué camino tomó,
 * para poder auditarlo: 'reemplazada' · 'autocerrada' · 'insertada' · 'sin fila'.
 */
function poner(xml, ref, nueva, fila) {
  // 1 · celda con apertura y cierre — 🔴 `(?![^>]*\/>)` la distingue de una autocerrada
  var rx = new RegExp('<c r="' + ref + '"(?![^>]*\\/>)[^>]*>[\\s\\S]*?<\\/c>');
  if (rx.test(xml)) return { xml: xml.replace(rx, function () { return nueva; }), como: 'reemplazada' };

  // 2 · celda autocerrada
  var rxA = new RegExp('<c r="' + ref + '"[^>]*\\/>');
  if (rxA.test(xml)) return { xml: xml.replace(rxA, function () { return nueva; }), como: 'autocerrada' };

  // 3 · la celda no existe: se inserta EN SU POSICIÓN DE COLUMNA dentro de la fila.
  //
  // 🔴 ESTO ROMPIÓ EL ARCHIVO Y NINGUNA DE LAS CUATRO CAPAS LO VIO. La versión anterior insertaba
  //    al principio de la fila, con este comentario: «Excel tolera que las celdas de una fila no
  //    estén ordenadas por columna». **No las tolera.** Con 14 celdas fuera de orden en
  //    `Data_WhatsApp`, Excel se NIEGA A ABRIR el libro — ni siquiera ofrece repararlo.
  //    Y `xlsx-safe-save`, `xlsx-label`, `xlsx-check` y `xlsx-validar-fondo` pasaron las cuatro:
  //    el XML está bien formado, el paquete OPC está sano y los estilos cuadran. Lo único que
  //    lo detecta es abrirlo con Excel de verdad.
  //
  //    La regla de OOXML es explícita y hay que respetarla: dentro de `<row>`, las celdas van en
  //    orden ascendente de columna; y las filas, en orden ascendente de número.
  var mFila = new RegExp('(<row r="' + fila + '"(?![^>]*\\/>)[^>]*>)([\\s\\S]*?)(<\\/row>)').exec(xml);
  if (mFila) {
    var mi = colNum(ref);
    var celdas = [];
    mFila[2].replace(/<c r="([A-Z]+\d+)"(?:[^>]*\/>|[^>]*>[\s\S]*?<\/c>)/g, function (todo, r) {
      celdas.push({ ref: r, n: colNum(r), xml: todo }); return todo;
    });
    var i = 0;
    while (i < celdas.length && celdas[i].n < mi) i++;
    celdas.splice(i, 0, { ref: ref, n: mi, xml: nueva });
    var dentro = celdas.map(function (x) { return x.xml; }).join('');
    return {
      xml: xml.replace(mFila[0], mFila[1] + dentro + mFila[3]),
      como: 'insertada'
    };
  }

  return { xml: xml, como: 'sin fila' };
}

module.exports = { poner: poner, celda: celda, estiloDe: estiloDe, colNum: colNum, esc: esc, t: t };
