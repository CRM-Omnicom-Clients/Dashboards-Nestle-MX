// lib-columna · EL ÚNICO MODO DE LEER UNA COLUMNA. Resuelve, o truena. Nunca devuelve vacío.
//
// 🔴 QUÉ CLASE DE ERROR CIERRA. El 25-ago-2026, cinco defectos distintos resultaron ser el mismo:
//      `pieza_id`             cuando las 4 hojas de datos dicen  `Pieza_ID`
//      `Touchpoint`           cuando el catálogo dice            `TouchPoint`      (una sola letra)
//      `Quincena_Lanzamiento` cuando el reporte dice             `…Principal`
//      `e.n`                  cuando la etapa se llama           `orden`
//      `|| VIVO`              cuando había que preguntarle al grafo
//    Los cinco son: **escribí el nombre en vez de pedirlo.** Y los cinco fallaron del mismo modo
//    silencioso — devolviendo `undefined`, que en JS no truena: se lee como «vacío». Así, «98 de 98
//    filas sin Pieza_ID» se imprimió en rojo sobre una columna llena al 100%, y las 15 etapas
//    cayeron bajo la llave `undefined` como si compartieran paso.
//
// 🔴 POR QUÉ TRONAR Y NO DEVOLVER NULL. Un `null` educado se convierte en un cero, y un cero se lee
//    como un hecho: «no hay ninguno». Ésa es la mentira más cara del sistema, porque no se parece a
//    un error — se parece a un dato. Aquí, si el nombre no resuelve, el proceso se detiene y dice
//    qué encabezados SÍ existen. Un check que no puede medir no pinta verde ni rojo: se calla
//    ruidosamente y deja de correr.
//
// 🔴 Y LA AMBIGÜEDAD TAMBIÉN TRUENA. `Quincena_Lanzamiento` casa por prefijo con dos columnas del
//    reporte. Elegir una de las dos sería adivinar; adivinar entre dos columnas es peor que no
//    medir, porque el resultado se ve razonable.
//
// Uso:
//    var COL = require('.../lib-columna.js');
//    var k = COL.de(filas, 'Pieza_ID');        // el ENCABEZADO REAL, o truena
//    var v = COL.valor(fila, filas, 'Pieza_ID');
//    var k = COL.opcional(filas, 'Mascota');   // null si no está — SOLO cuando falta es legítimo
var t = function (v) { return String(v == null ? '' : v).trim(); };
function plano(s) {
  return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

// 🔴 LA LISTA NEGRA LA ESCRIBE EL DEFECTO REAL, NO LA TEORÍA. Cada nombre que ya mordió una vez
//    entra aquí, y desde ese momento leerlo por literal deja de ser posible: el hook lo rechaza al
//    escribir el script. No se agregan nombres «por si acaso» — se agregan con su fecha y su caso.
var MORDIERON = {
  'Pieza_ID': '25-ago-2026 · cuadre-coherencia leyó `pieza_id` y acusó de vacías a 98/98, 12/12, 2645/2645, 696/696',
  'TouchPoint': '25-ago-2026 · cuadre-coherencia leyó `Touchpoint` y llamó fantasmas a 004-P010 y 004-P013, reales',
  'Quincena_Lanzamiento': '25-ago-2026 · la hoja dice `…Principal`; cuadre-coherencia y PUERTA-2 acusaron a las 76 filas',
  'Campaña': '20-ago-2026 · Data_WhatsApp.Campaña estaba declarada al mismo campo que Campana_Raw',
  'Segmento': '17-ago-2026 · Segmento_Canonico: 193 de 264 celdas escritas a mano, se borrarían',
  'Email_ID (de la DE de SFMC)': '25-ago-2026 · convivió con `EmailID`; 24 piezas solo tenían la vieja'
};

function encabezados(filas) {
  if (!filas || !filas.length) throw new Error('lib-columna: no hay filas de las que leer encabezados');
  return Array.isArray(filas[0]) ? filas[0].map(t) : Object.keys(filas[0]);
}

function resolver(filas, idLogico, opciones) {
  var enc = encabezados(filas);
  var obj = plano(idLogico);
  var exactas = enc.filter(function (h) { return plano(h) === obj; });
  if (exactas.length === 1) return exactas[0];
  if (exactas.length > 1) {
    return { ambigua: exactas, por: 'DOS columnas resuelven exactamente al mismo nombre' };
  }
  var prefijo = enc.filter(function (h) { return plano(h).indexOf(obj) === 0; });
  if (prefijo.length === 1) return prefijo[0];
  if (prefijo.length > 1) return { ambigua: prefijo, por: 'el prefijo casa con varias' };
  return null;
}

// ══ EL CATÁLOGO RAÍZ ═══════════════════════════════════════════════════════════════════
//
// 🔴 ESTA ES LA PIEZA QUE FALTABA, y sin ella «anclar al catálogo» no anclaba a nada.
//    Rick describió el diseño el 26-ago: *«tengo un catálogo base de un valor que nunca cambia, y
//    ese valor fijo es el que usan los scripts para hacer referencia; luego tengo un valor dinámico
//    —el nombre físico actual— que sí cambia. Así no tienes que editar todos los scripts: lo único
//    que cambia es la variable dentro del catálogo, y el catálogo dice qué se renombró.»*
//
//    Ese catálogo YA EXISTE: `_contratos/registro.json` — 442 columnas, cada una con su `id`
//    inmutable, sus `nombres` mutables y el historial de renombres con fecha y quién lo detectó.
//    Lo que faltaba es que alguien le preguntara. `lib-columna` resolvía contra la HOJA, no contra
//    el catálogo — así que el catálogo era un documento, no una autoridad.
//
// 🔴 EL ORDEN IMPORTA: primero el catálogo, después la hoja.
//    Si se pregunta primero a la hoja, un renombre que el catálogo ya conoce se «redescubre» cada
//    vez, y peor: si el nombre viejo y el nuevo conviven un rato, la hoja da el equivocado sin
//    avisar. Preguntando primero al catálogo, un renombre se resuelve en UN lugar — que es la razón
//    de que el catálogo exista.
var _reg = null;
function registro() {
  if (_reg !== null) return _reg;
  try {
    _reg = require('fs').readFileSync(require('path').resolve(__dirname, '..') + '/_contratos/registro.json', 'utf8');
    _reg = JSON.parse(_reg).columnas || {};
  } catch (e) { _reg = {}; }
  return _reg;
}

/**
 * El nombre físico ACTUAL de un id lógico, según el catálogo raíz.
 * @param idLogico  puede venir con ámbito (`resumen.campana`) o sin él (`Campaña`)
 * @param ambito    si se conoce, acota la búsqueda — dos hojas pueden tener columnas homónimas
 * @returns el nombre físico, o null si el catálogo no lo conoce
 */
function delCatalogo(idLogico, ambito) {
  var C = registro();
  if (!Object.keys(C).length) return null;
  // 1 · por id exacto: `resumen.campana`
  var directo = C[idLogico] || (ambito ? C[ambito + '.' + plano(idLogico)] : null);
  if (directo && directo.nombres && directo.nombres.length) return directo.nombres[0];
  // 2 · por nombre: ¿alguna entrada del catálogo se llama así HOY, o se llamó así antes?
  var obj = plano(idLogico);
  var cands = Object.keys(C).filter(function (k) {
    var e = C[k];
    if (ambito && e.ambito && e.ambito !== ambito) return false;
    var actuales = (e.nombres || []).some(function (n) { return plano(n) === obj; });
    var viejos = (e.alias_historicos || []).some(function (n) { return plano(n) === obj; });
    return actuales || viejos;
  });
  if (cands.length === 1) return C[cands[0]].nombres[0];
  return null;   // 0 o ambiguo: que decida la hoja, y si es ambigua allá también, truena
}

/** El encabezado real. Si no resuelve o es ambiguo: TRUENA. */
function de(filas, idLogico, ambito) {
  // 🔴 PRIMERO EL CATÁLOGO RAÍZ. Solo si él no lo conoce se mira la hoja.
  var delReg = delCatalogo(idLogico, ambito);
  if (delReg) {
    var enc0 = encabezados(filas);
    var hit = enc0.filter(function (h) { return plano(h) === plano(delReg); });
    if (hit.length === 1) return hit[0];
    // el catálogo dice un nombre que la hoja ya no tiene: es un renombre SIN registrar.
    // No se adivina — se dice, porque es justo el hecho que el catálogo debe capturar.
    if (hit.length === 0 && enc0.length) {
      var alt = resolver(filas, idLogico);
      if (typeof alt === 'string') {
        throw new Error('lib-columna: el catálogo raíz dice que «' + idLogico + '» se llama «' + delReg +
          '», y la hoja tiene «' + alt + '».\n   Es un renombre sin registrar: actualiza el catálogo ' +
          '(`_contratos/registro.json`) antes de seguir. El catálogo es el único lugar donde el id y el nombre se tocan.');
      }
    }
  }
  var r = resolver(filas, idLogico);
  if (typeof r === 'string') return r;
  var enc = encabezados(filas);
  if (r && r.ambigua) {
    throw new Error('lib-columna: «' + idLogico + '» es AMBIGUA — ' + r.por + ': ' +
      r.ambigua.map(function (x) { return '«' + x + '»'; }).join(' y ') +
      '. Pide el nombre completo; elegir una sería adivinar.');
  }
  throw new Error('lib-columna: no hay ninguna columna que resuelva a «' + idLogico + '».' +
    (MORDIERON[idLogico] ? '\n   (esta columna ya mordió antes: ' + MORDIERON[idLogico] + ')' : '') +
    '\n   encabezados disponibles (' + enc.length + '): ' + enc.slice(0, 14).join(' · ') + (enc.length > 14 ? ' …' : ''));
}

/** Cuando que falte es LEGÍTIMO. Devuelve null — y quien la use debe declarar «no pude evaluar». */
function opcional(filas, idLogico) {
  var r = resolver(filas, idLogico);
  if (typeof r === 'string') return r;
  if (r && r.ambigua) throw new Error('lib-columna: «' + idLogico + '» es AMBIGUA entre ' + r.ambigua.join(' y ') + ' — ni siquiera como opcional se adivina');
  return null;
}

/** El valor de una fila, pidiendo su columna. */
function valor(fila, filas, idLogico) {
  var k = de(filas, idLogico);
  return Array.isArray(fila) ? t(fila[encabezados(filas).indexOf(k)]) : t(fila[k]);
}

/** Un campo de un objeto de contrato — mismo problema que una columna (`e.n` vs `e.orden`). */
function campo(obj, nombre, contexto) {
  if (!obj || typeof obj !== 'object') throw new Error('lib-columna.campo: no hay objeto' + (contexto ? ' (' + contexto + ')' : ''));
  if (!(nombre in obj)) {
    throw new Error('lib-columna.campo: «' + nombre + '» no existe' + (contexto ? ' en ' + contexto : '') +
      '.\n   campos que sí existen: ' + Object.keys(obj).join(' · ') +
      '\n   (un campo inexistente NO truena en JS: devuelve undefined y agrupa perfecto — así las 15 etapas cayeron bajo la llave `undefined`)');
  }
  return obj[nombre];
}

module.exports = { de: de, delCatalogo: delCatalogo, registro: registro, opcional: opcional, valor: valor, campo: campo, encabezados: encabezados, MORDIERON: MORDIERON, plano: plano };
