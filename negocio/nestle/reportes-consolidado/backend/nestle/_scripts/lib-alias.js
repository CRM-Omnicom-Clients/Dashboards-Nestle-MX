// ÚNICO resolvedor de alias del catálogo Nestlé. Cualquier script que traduzca un valor crudo
// a su canónico usa ESTO. Si cada script escribe su propio lookup, cada uno se equivoca distinto.
//
// LA ESCALERA — del contexto más específico al más general. EL ORDEN ES LA REGLA:
//
//   0  ya es canónico                 el valor ya está en el vocabulario (comparado NORMALIZADO:
//                                     "BOTANA", "Botana ", "botana" son el mismo)
//   1  campaña · segmento             el más específico. Solo existe donde una grafía es ambigua:
//                                     AON «N/A» vale E-P1, E-P3 o E-P4 SEGÚN el segmento.
//   2  campaña                        el normal. "Partido 1" significa algo en Mundial y nada en Liga MX.
//   3  espacio de nombres (utm_term)  los segmentos vienen del utm_term, que es su propio namespace:
//                                     su contexto NO es una campaña. Sin este peldaño, «botanas»
//                                     no encontraba «Botana» aunque el alias sí existía.
//   4  global                         alias sin contexto ninguno.
//   5  NO RESUELVE                    se detiene y sale como pendiente CON su fuente.
//
// 🔴 El peldaño 5 es el que importa. Un valor desconocido NO entra con un canónico inventado:
//    frena, se reporta, y Rick decide si es alias nuevo o es dato nuevo. Nada se adivina.
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }

// espacios de nombres: contextos que NO son campañas sino el campo de origen del dato
var NAMESPACES = { utm_term: 1, utm_content: 1, utm_campaign: 1, utm_medium: 1, utm_source: 1 };

// filas = Catalogo_Referencias (o cat.aliasUTM del JSON: mismos nombres de campo)
function indexar(filas) {
  var IX = { espec: {}, camp: {}, ns: {}, global: {}, voc: {}, vocNm: {}, excl: {}, n: 0 };
  filas.forEach(function (r) {
    var tipo = t(r['Tipo'] || r.Tipo), dim = t(r['Dimension'] || r.Dimension),
      crudo = nm(r['Valor_Crudo'] || r.Valor_Crudo), canon = t(r['Valor_Canonico'] || r.Valor_Canonico),
      ctx = t(r['Contexto'] || r.Contexto);
    if (/^vocabulario/.test(tipo)) {
      (IX.voc[dim] = IX.voc[dim] || {})[canon] = 1;
      (IX.vocNm[dim] = IX.vocNm[dim] || {})[nm(canon)] = canon;   // ← el que arregla "BOTANA"
      return;
    }
    if (tipo === 'excluido') { IX.excl[t(r['Valor_Crudo'] || r.Valor_Crudo)] = t(r['Notas'] || r.Notas) || 'sin motivo escrito'; return; }
    if (!/^alias/.test(tipo)) return;
    IX.n++;
    if (ctx.indexOf(' · ') > 0) IX.espec[dim + '¦' + ctx + '¦' + crudo] = canon;
    else if (NAMESPACES[ctx]) IX.ns[dim + '¦' + crudo] = canon;
    else if (ctx) IX.camp[dim + '¦' + ctx + '¦' + crudo] = canon;
    else IX.global[dim + '¦' + crudo] = canon;
  });
  return IX;
}

// Devuelve { v, por } — SIEMPRE con el peldaño que lo resolvió, para poder auditar la decisión.
// v === null ⇒ pendiente. Nunca devuelve un valor "por si acaso".
function resolver(IX, dim, crudo, campana, segmento) {
  var c = nm(crudo), k;
  if (!c) return { v: null, por: '5 · vacío → pendiente' };
  if (IX.vocNm[dim] && IX.vocNm[dim][c]) return { v: IX.vocNm[dim][c], por: '0 · ya es canónico' };
  if (campana && segmento && (k = IX.espec[dim + '¦' + campana + ' · ' + segmento + '¦' + c]))
    return { v: k, por: '1 · campaña · segmento' };
  if (campana && (k = IX.camp[dim + '¦' + campana + '¦' + c])) return { v: k, por: '2 · campaña' };
  if ((k = IX.ns[dim + '¦' + c])) return { v: k, por: '3 · utm (espacio de nombres)' };
  if ((k = IX.global[dim + '¦' + c])) return { v: k, por: '4 · global' };
  return { v: null, por: '5 · NO RESUELVE → pendiente' };
}

// Para un lote: separa lo resuelto de lo que hay que preguntar, con su fuente.
function resolverLote(IX, items) {
  var ok = [], pend = [];
  items.forEach(function (x) {
    var r = resolver(IX, x.dim, x.crudo, x.campana, x.segmento);
    (r.v ? ok : pend).push({ dim: x.dim, crudo: x.crudo, campana: x.campana, segmento: x.segmento, valor: r.v, por: r.por, fuente: x.fuente || '' });
  });
  return { ok: ok, pendientes: pend };
}

module.exports = { indexar: indexar, resolver: resolver, resolverLote: resolverLote, nm: nm, NAMESPACES: NAMESPACES };
