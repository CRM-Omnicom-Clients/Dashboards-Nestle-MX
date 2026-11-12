// ANCLA LITERAL Catalogo_Referencias → Catalogo_Piezas.
//
// 🔴 POR QUÉ EXISTE (Rick, 17-ago): el ancla entre las dos hojas existía LÓGICAMENTE
//    (Valor_Canonico == la dimensión de la pieza; Contexto + Valor_Crudo == Campaña +
//    Touchpoint_Raw) y las pruebas la verificaban. Pero en el Excel **no había columna**:
//    abriendo Referencias no podías saltar a las piezas que usan ese término.
//    Un ancla que solo un script puede recorrer no le sirve a quien abre el archivo.
//
// Devuelve los pieza_id que usan esa referencia. De ahí salen dos columnas:
//    N_Piezas   0 = declarada y sin usar → visible, en vez de quedarse ahí para siempre
//    Pieza_IDs  para BUSCARV directo
var t = function (v) { return String(v == null ? '' : v).trim(); };
// 🔴 UN SOLO NORMALIZADOR. Esta función estaba copiada literal en varias librerías. Copias
//    idénticas hoy son copias divergentes mañana: la de WhatsApp ya se había separado y
//    difería en 10 de 14 casos. Se delega en `lib-alias.nm`, que es el oficial.
var nm = require(__dirname + '/lib-alias.js').nm;
var NAMESPACES = { utm_term: 1, utm_content: 1, utm_campaign: 1, utm_medium: 1, utm_source: 1 };

// dimensión → campo de la pieza. Las dos grafías porque el vocabulario usa la clave interna
// (`campana`) y los alias el nombre visible (`Campaña`).
var DIM = {
  Bu: 'bu', BU: 'bu', Marca: 'marca', Campana: 'campana', 'Campaña': 'campana',
  Objetivo: 'objetivo', Segmento: 'segmento', Touchpoint: 'nombre_pieza', Canal: 'canal',
  Partido: 'nombre_pieza', Estado: 'estado', Tienda: null
};

function usa(p, campo, valor) {
  if (!campo) return false;
  if (t(p[campo]) === t(valor)) return true;
  // el segmento combinado cuenta: la pieza usa ese valor aunque su Segmento diga "Combinado"
  if (campo === 'segmento' && t(p.segmentos_combinados).split(/\s*,\s*/).map(t).indexOf(t(valor)) >= 0) return true;
  return false;
}
function aplica(ctx, p) {
  var c = t(ctx);
  if (!c || NAMESPACES[c]) return true;
  if (c.indexOf(' · ') > 0) return c === p.campana + ' · ' + p.segmento;
  return c === p.campana;
}

/** cat, tipo, dimension, valor_canonico, valor_crudo, contexto → [pieza_id] */
function piezasDe(cat, tipo, dim, canon, crudo, ctx) {
  var campo = DIM[t(dim)];
  var P = cat.piezas || [];

  if (/^vocabulario/.test(t(tipo))) {
    if (!campo) return [];
    return P.filter(function (p) { return usa(p, campo, canon); }).map(function (p) { return p.pieza_id; });
  }

  // 🔴 un alias se ancla por su CANÓNICO dentro de su contexto, NO por dónde está el crudo.
  //    «e-botana1» → E-P1 puede no aparecer en ninguna pieza (la pieza guarda otra grafía) y aun
  //    así ser útil: su trabajo es LLEVARTE a un canónico. Lo que sirve es "¿a qué piezas me
  //    lleva?", no "¿dónde está escrito este texto?".
  if (/^alias/.test(t(tipo))) {
    if (!campo) return [];
    return P.filter(function (p) { return usa(p, campo, canon) && aplica(ctx, p); }).map(function (p) { return p.pieza_id; });
  }

  // excluido: por definición NINGUNA pieza lo usa. Si alguna aparece, es un error grave —
  // significa que un código excluido se coló a una pieza y su número se está contando dos veces.
  if (t(tipo) === 'excluido') {
    var o = [];
    P.forEach(function (p) {
      for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
        t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k) && t(k) === t(crudo)) o.push(p.pieza_id); });
      });
    });
    return o;
  }
  return [];
}

module.exports = { piezasDe: piezasDe, DIM: DIM, nm: nm };
