// lib-manual-reglas.js — las dos reglas que el lector no puede comprobar solo,
// porque necesitan el catálogo y los otros tres bloques.
//
//   1 · el `pieza_id` tiene que EXISTIR en el catálogo
//       Un dato manual con una pieza inventada es peor que no tenerlo: entra al reporte
//       sin campaña, sin canal y sin periodo, y ahí ya no hay forma de rastrearlo.
//
//   2 · 🔴 NO puede pisar lo que una fuente automática ya trae
//       Si Datorama ya da los sends de esa pieza, el manual sobra — y si además difiere,
//       tenemos dos verdades para el mismo número y ninguna forma de elegir. El paso lo
//       DECLARA y no lo carga; y si el manual ya estaba y la fuente empezó a traerlo, avisa
//       que la fila quedó redundante para poder borrarla.
//       Un dato manual que sobrevive a su motivo es el que después nadie sabe explicar.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();

function t(v) { return String(v == null ? '' : v).trim(); }

// qué métrica de qué pieza trae ya cada bloque automático
function cobertura(bloques, cnPieza) {
  var cob = {};                                   // pieza¦metrica → 'email' | 'qcart' | 'whatsapp'
  function marca(id, met, quien) {
    if (!id) return;
    var k = id + '¦' + met;
    cob[k] = cob[k] ? cob[k] + '+' + quien : quien;
  }
  (bloques.email && bloques.email.envios || []).forEach(function (e) {
    var id = cnPieza[e.content_name];
    if (!id) return;
    if (e.email_sends) marca(id, 'sends', 'email');
    if (e.email_deliveries) marca(id, 'deliveries', 'email');
    if (e.email_unique_opens) marca(id, 'opens', 'email');
    if (e.email_unique_clicks) marca(id, 'clicks', 'email');
    if (e.email_bounces) marca(id, 'errores', 'email');
  });
  (bloques.qcart && bloques.qcart.carritos || []).forEach(function (e) {
    if (e.views) marca(e.pieza_id, 'views', 'qcart');
    if (e.total_shown_price) marca(e.pieza_id, 'importe', 'qcart');
    marca(e.pieza_id, 'carritos', 'qcart');
  });
  (bloques.whatsapp && bloques.whatsapp.envios || []).forEach(function (e) {
    if (e.sends) marca(e.pieza_id, 'sends', 'whatsapp');
    if (e.deliveries) marca(e.pieza_id, 'deliveries', 'whatsapp');
    if (e.opens_read) marca(e.pieza_id, 'opens', 'whatsapp');
    // ⚠ los clicks de WhatsApp solo cuentan como cobertura si están MEDIDOS: si la fuente los
    //   deriva de un supuesto, un dato manual real SÍ los mejora y no debe bloquearse.
    if (e.clicks !== null && e.clicks_medidos === 'Sí') marca(e.pieza_id, 'clicks', 'whatsapp');
    if (e.errores) marca(e.pieza_id, 'errores', 'whatsapp');
  });
  return cob;
}

/**
 * Aplica las dos reglas.
 * @returns { dentro, fuera, redundantes }  —  y dentro+fuera === datos.length, siempre
 */
function aplicar(datos, piezas, bloques, cnPieza) {
  var ids = {};
  piezas.forEach(function (p) { ids[t(p['Pieza_ID'])] = p; });
  var cob = cobertura(bloques, cnPieza);
  var dentro = [], fuera = [], redundantes = [];

  datos.forEach(function (d) {
    // 1 · la pieza tiene que existir
    if (!ids[d.pieza_id]) {
      fuera.push(Object.assign({}, d, {
        motivo_exclusion: 'la pieza «' + d.pieza_id + '» no existe en Catalogo_Piezas: sería un dato sin campaña ni canal'
      }));
      return;
    }
    // 2 · no puede pisar una fuente automática
    var quien = cob[d.pieza_id + '¦' + d.metrica];
    if (quien) {
      redundantes.push(Object.assign({}, d, {
        cubierto_por: quien,
        motivo_exclusion: '«' + d.metrica + '» de esa pieza YA la trae ' + quien +
          '. El manual sobra; si difiere, habría dos verdades para el mismo número. Bórrala del CSV.'
      }));
      fuera.push(redundantes[redundantes.length - 1]);
      return;
    }
    var p = ids[d.pieza_id];
    dentro.push(Object.assign({}, d, {
      // el dato manual hereda las dimensiones de SU pieza: no se declaran a mano
      bu: t(p['BU']), marca: t(p['Marca']), campana: t(p['Campaña']),
      canal: t(p['Canal']), touchpoint: t(p['Touchpoint']), segmento: t(p['Segmento']),
      fuente: 'manual'
    }));
  });

  return {
    dentro: dentro, fuera: fuera, redundantes: redundantes,
    cuadra: dentro.length + fuera.length === datos.length
  };
}

module.exports = { aplicar: aplicar, cobertura: cobertura, t: t };
