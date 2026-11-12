// lib-cuadre.js — los cruces que ningún bloque puede hacer solo.
//
// Cada bloque se validó CONTRA SÍ MISMO. Aquí se cruzan ENTRE ELLOS y contra el catálogo, que
// es donde aparece lo que ninguno ve: un dato contado dos veces, un bloque que quedó viejo, una
// suma que ya no cuadra.
//
// 🔴 LA DISTINCIÓN QUE HACE ÚTIL AL GATE — y sin la cual sería un rojo permanente que se ignora:
//
//    BLOQUEA  algo está PROBADAMENTE mal y escribir lo empeora
//             · el mismo dato contado por dos bloques
//             · un bloque con MENOS que el catálogo (se perdió algo por el camino)
//             · bloques de generaciones distintas (se mezclarían dos cortes)
//             · el cuadre interno de un bloque roto
//
//    AVISA    hay algo que mirar, pero escribir lo MEJORA
//             · un bloque con MÁS que el catálogo → es justo lo que la puerta va a corregir
//             · piezas del catálogo que ningún bloque toca → puede que no tengan datos aún
//             · datos sin pieza YA declarados por su bloque → ya se sabe, y traen su motivo
//
// Un aviso no detiene la escritura, pero viaja con el veredicto y se reporta.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs');

function t(v) { return String(v == null ? '' : v).trim(); }
function num(v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; }

/** mapa content_name → pieza_id, con la misma cascada que usan los bloques */
function indicePiezas(P) {
  var cn = {}, ids = {};
  P.forEach(function (p) {
    var id = t(p['Pieza_ID']);
    ids[id] = p;
    [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/))
      .filter(Boolean).forEach(function (c) { if (!cn[c]) cn[c] = id; });
  });
  return { porContentName: cn, porId: ids };
}

// ── 1 · ¿son de la misma generación? ────────────────────────────────────────────────
// Si un bloque se armó con el corte anterior y otro con el nuevo, escribirlos juntos mezcla
// dos cortes en la misma hoja y ya no hay forma de separarlos.
function frescura(bloques, minutosTolerancia) {
  var tol = (minutosTolerancia || 180) * 60000;
  var ts = [];
  Object.keys(bloques).forEach(function (k) {
    var b = bloques[k];
    if (b && b.__mtime_ms) ts.push({ bloque: k, ms: b.__mtime_ms, iso: b.__mtime });
  });
  if (ts.length < 2) return { ok: true, detalle: 'menos de dos bloques que comparar' };
  ts.sort(function (a, b) { return a.ms - b.ms; });
  var dif = ts[ts.length - 1].ms - ts[0].ms;
  return {
    ok: dif <= tol,
    minutos: Math.round(dif / 60000),
    mas_viejo: ts[0].bloque + ' ' + ts[0].iso,
    mas_nuevo: ts[ts.length - 1].bloque + ' ' + ts[ts.length - 1].iso,
    detalle: Math.round(dif / 60000) + ' min entre el más viejo y el más nuevo (tolerancia ' + (tol / 60000) + ')'
  };
}

// ── 2 · ¿el mismo dato contado dos veces? ───────────────────────────────────────────
// El caso que más daño hace: dos bloques aportando la misma métrica de la misma pieza. Al
// sumar en el reporte, el número sale inflado y nadie sabe por qué.
function dobleConteo(bloques, idx) {
  var met = {};
  function reg(id, m, quien, v) {
    if (!id || !v) return;
    var k = id + '¦' + m;
    met[k] = met[k] || {};
    met[k][quien] = (met[k][quien] || 0) + v;
  }
  (bloques.email && bloques.email.envios || []).forEach(function (e) {
    var id = idx.porContentName[e.content_name];
    reg(id, 'sends', 'email', e.email_sends);
    reg(id, 'deliveries', 'email', e.email_deliveries);
    reg(id, 'opens', 'email', e.email_unique_opens);
    reg(id, 'clicks', 'email', e.email_unique_clicks);
  });
  (bloques.whatsapp && bloques.whatsapp.envios || []).forEach(function (e) {
    reg(e.pieza_id, 'sends', 'whatsapp', e.sends);
    reg(e.pieza_id, 'deliveries', 'whatsapp', e.deliveries);
    reg(e.pieza_id, 'opens', 'whatsapp', e.opens_read);
    reg(e.pieza_id, 'clicks', 'whatsapp', e.clicks);
  });
  (bloques.qcart && bloques.qcart.carritos || []).forEach(function (e) { reg(e.pieza_id, 'views', 'qcart', e.views); });
  (bloques.manual && bloques.manual.datos || []).forEach(function (d) { reg(d.pieza_id, d.metrica, 'manual', d.valor); });

  var choques = Object.keys(met).filter(function (k) { return Object.keys(met[k]).length > 1; })
    .map(function (k) { return { par: k, de: met[k] }; });
  return { pares: Object.keys(met).length, choques: choques, ok: choques.length === 0 };
}

// ── 3 · ¿la Σ del bloque cuadra con el catálogo? ────────────────────────────────────
// 🔴 La DIRECCIÓN importa, y es lo que separa un bloqueo de un aviso:
//      bloque < catálogo  → se perdió algo por el camino. BLOQUEA.
//      bloque > catálogo  → el bloque trae datos que el catálogo aún no tiene. AVISA:
//                            es exactamente lo que la puerta va a escribir.
function sumaVsCatalogo(bloques, P) {
  var out = [];
  function comparar(nombre, delBloque, filtroCanal) {
    var delCatalogo = P.filter(filtroCanal).reduce(function (a, p) { return a + num(p['Sends']); }, 0);
    var d = delBloque - delCatalogo;
    out.push({
      canal: nombre, bloque: delBloque, catalogo: delCatalogo, diferencia: d,
      clase: d === 0 ? 'ok' : d > 0 ? 'aviso' : 'bloquea',
      lectura: d === 0 ? 'cuadra exacto'
        : d > 0 ? 'el bloque trae ' + d.toLocaleString() + ' MÁS: son datos que el catálogo aún no tiene, y que la puerta va a escribir'
          : 'el bloque trae ' + Math.abs(d).toLocaleString() + ' MENOS: se perdió algo por el camino'
    });
  }
  if (bloques.email) comparar('email', bloques.email.auditoria.sends_total,
    function (p) { return t(p['Canal']) === 'Email'; });
  if (bloques.whatsapp) comparar('whatsapp', bloques.whatsapp.auditoria.sends_total,
    function (p) { return /whats/i.test(t(p['Canal'])); });
  return out;
}

// ── 4 · ¿el cuadre interno de cada bloque sigue en pie? ─────────────────────────────
// Cada bloque lo comprueba al generarse, pero aquí se vuelve a leer del JSON: si alguien lo
// editó a mano o quedó a medias, se ve.
//
// 🔴 Y ADEMÁS se cuenta el contenido REAL, no se cree la auditoría.
//    El refutador coló un bloque con `envios: []` y `sends_total: 6,454,554` intacto, y el gate
//    abrió: estaba confiando en el número declarado en vez de contar los registros. Una
//    auditoría es una afirmación sobre el contenido; si no coincide con él, la afirmación miente.
function cuenta(b, nombre) {
  if (!b) return 0;
  if (nombre === 'qcart') return (b.carritos || []).length + (b.productos || []).length;
  if (nombre === 'manual') return (b.datos || []).length;
  return (b.envios || []).length;
}
function cuadreInterno(bloques) {
  var out = [];
  function coherente(nombre, declarado, ok, detalle) {
    var real = cuenta(bloques[nombre], nombre);
    if (declarado !== undefined && declarado !== real) {
      out.push({
        bloque: nombre, ok: false,
        detalle: '🔴 la auditoría dice ' + declarado + ' registros y el bloque tiene ' + real +
          ' — el JSON está a medias o lo editaron'
      });
      return;
    }
    out.push({ bloque: nombre, ok: ok, detalle: detalle + '  ·  ' + real + ' registros contados' });
  }
  if (bloques.email) {
    var a = bloques.email.auditoria;
    coherente('email', a.envios, a.cuadre_del_diff === a.envios, a.cuadre_del_diff + ' = ' + a.envios);
  }
  if (bloques.qcart) {
    var q = bloques.qcart.auditoria;
    var decl = (q.append && q.append.carritos ? q.append.carritos.total : 0) +
      (q.append && q.append.productos ? q.append.productos.total : 0);
    coherente('qcart', decl, q.cuadre === true, 'filtro y append');
  }
  if (bloques.whatsapp) {
    var w = bloques.whatsapp.auditoria;
    coherente('whatsapp', w.envios, w.cuadre_append === true, 'append');
  }
  if (bloques.manual) {
    var m = bloques.manual.auditoria;
    coherente('manual', m.datos, m.cuadre === true, 'entran + fuera = leídos');
  }
  return out;
}

// ── 5 · cobertura y huérfanos ───────────────────────────────────────────────────────
function cobertura(bloques, idx, P) {
  var tocadas = {};
  // 🔴 EL EMAIL SE CRUZA POR `pieza_id`, QUE ES LA LLAVE DECLARADA. Cruzaba por
  //    `idx.porContentName[e.content_name]`, un índice que se arma con la columna `Content_Name`
  //    del catálogo — renombrada a `Email_Name` por A11. El índice quedó vacío, los 98 envíos
  //    dejaron de «tocar» ninguna pieza, **los 98 contaron como huérfanos sin declarar y la
  //    Puerta 1 cerró el corte entero**. El bloque ya trae su `pieza_id` resuelto: usarlo es más
  //    directo y no depende de cómo se llame hoy una columna.
  (bloques.email && bloques.email.envios || []).forEach(function (e) {
    var id = e.pieza_id || idx.porContentName[e.content_name];
    if (id) tocadas[id] = 1;
  });
  (bloques.qcart && (bloques.qcart.carritos || []).concat(bloques.qcart.productos || []) || []).forEach(function (e) { if (e.pieza_id) tocadas[e.pieza_id] = 1; });
  (bloques.whatsapp && bloques.whatsapp.envios || []).forEach(function (e) { if (e.pieza_id) tocadas[e.pieza_id] = 1; });
  (bloques.manual && bloques.manual.datos || []).forEach(function (d) { if (d.pieza_id) tocadas[d.pieza_id] = 1; });
  var sinTocar = P.filter(function (p) { return !tocadas[t(p['Pieza_ID'])]; });

  // huérfanos: datos SIN pieza. Solo cuentan como problema si el bloque NO los declaró.
  var huerfanos = [];
  (bloques.qcart && (bloques.qcart.carritos || []).concat(bloques.qcart.productos || []) || [])
    .filter(function (e) { return !e.pieza_id; }).forEach(function (e) { huerfanos.push({ bloque: 'qcart', declarado: !!e.motivo_sin_pieza }); });
  (bloques.whatsapp && bloques.whatsapp.envios || []).filter(function (e) { return !e.pieza_id; })
    .forEach(function (e) { huerfanos.push({ bloque: 'whatsapp', declarado: !!e.motivo_sin_pieza }); });
  // idem aquí: un envío de email es huérfano si NO tiene pieza, no si su nombre no está en un
  // índice que puede haber quedado desactualizado por un renombre de columna.
  (bloques.email && bloques.email.envios || []).filter(function (e) { return !e.pieza_id && !idx.porContentName[e.content_name]; })
    .forEach(function (e) { huerfanos.push({ bloque: 'email', declarado: !!e.motivo_sin_pieza }); });

  return {
    piezas: P.length, tocadas: Object.keys(tocadas).length, sin_tocar: sinTocar.length,
    sin_tocar_detalle: sinTocar.slice(0, 12).map(function (p) { return t(p['Pieza_ID']) + ' ' + t(p['Campaña']) + ' ' + t(p['Canal']); }),
    huerfanos: huerfanos.length,
    huerfanos_sin_declarar: huerfanos.filter(function (h) { return !h.declarado; }).length
  };
}

module.exports = {
  indicePiezas: indicePiezas, frescura: frescura, dobleConteo: dobleConteo,
  sumaVsCatalogo: sumaVsCatalogo, cuadreInterno: cuadreInterno, cobertura: cobertura,
  t: t, num: num
};
