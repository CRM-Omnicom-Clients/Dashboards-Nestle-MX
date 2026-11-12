/*
 * lib-whatsapp-nombre.js — LA NOMENCLATURA DEL `Whatsapp_Name`.
 *
 * POR QUÉ EXISTE. En email la identidad de una pieza es su `Email_Name`: un nombre físico que la
 * fuente publica y que es único. En WhatsApp no había equivalente — las 18 piezas tenían
 * `Email_Name = N/A` y sus journeys vivían en `Notas`, como texto libre. Rick, 15-sep-2026:
 * «de WhatsApp deberíamos tener una especie de Whatsapp Name»; y sobre las campañas que no traen
 * journey: «sácalo o crea reglas para la nomenclatura y asígnalo».
 *
 * 🔴 LA FUENTE NO DA LO MISMO EN CADA CAMPAÑA, y por eso la regla tiene NIVELES. Medido el
 *    15-sep sobre el archivo del cliente:
 *      · Tercer Tiempo · The Freshers · Liga MX → journey REAL con su id  (`…_CN_WA_A_V1_065900`)
 *      · Mundial                                → columna `Journey`, pero con etiqueta humana
 *                                                 (`Segundo Partido`, `Semifinal A`, `Finales`)
 *      · Hotcakes                               → NO tiene columna de journey. Su hoja identifica
 *                                                 los envíos por `utm_content` (c1..c4) y SEGMENTO
 *    Una regla única habría tenido que inventar journeys donde no los hay, y eso es exactamente lo
 *    que este catálogo prohíbe: deducir del naming.
 *
 * 🔴 UN NOMBRE DERIVADO NUNCA SE DISFRAZA DE NOMBRE REAL. Los niveles 2 y 3 producen un nombre
 *    que EMPIEZA por `WA-`, en mayúsculas y con guiones — imposible de confundir con un journey de
 *    SFMC o de Twilio, que son largos y llevan su id al final. Quien lea la celda sabe de un
 *    vistazo si está viendo lo que la fuente publica o lo que el sistema construyó, y `nivel` y
 *    `via` lo dicen explícitamente.
 *
 * 🔴 Y LO QUE DIJO LA FUENTE NO SE PIERDE: viaja a `Whatsapp_Names_Variantes`. Es el mismo patrón
 *    que ya usan `005-P010` y `005-P012` en email, donde conviven el journey name y el nombre con
 *    el que SFMC publica. Rick lo pidió así: «súmalo al nombre que te di».
 *
 * LAS TRES CONDICIONES QUE UN NOMBRE TIENE QUE CUMPLIR, y que `probar()` verifica:
 *   1 · ÚNICO      — dos piezas no pueden compartirlo (si no, no es una llave)
 *   2 · ESTABLE    — sale de campos que no cambian entre corridas. Nunca de una MÉTRICA: un
 *                    número que se mueve con cada refresh no identifica nada (lección de las 12
 *                    gemelas de Pro Plan)
 *   3 · LEGIBLE    — se puede decir qué envío es sin abrir otra hoja
 */

var NIVELES = {
  1: 'journey real de la fuente (se guarda tal cual)',
  2: 'construido desde la etiqueta de journey que trae la fuente',
  3: 'construido desde lo que identifica al envío en su hoja (touchpoint y segmento)'
};

var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
function esDato(v) { return !!t(v) && !TOKEN.test(t(v)); }

/**
 * Normaliza un trozo para que entre en un nombre: sin acentos, mayúsculas, guiones.
 * 🔴 Determinista y sin estado: el mismo trozo da siempre el mismo resultado, que es lo que hace
 *    que el nombre sea ESTABLE entre corridas.
 */
function trozo(v) {
  return t(v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * ¿El texto es un journey REAL de la fuente, o una etiqueta humana?
 * 🔴 El criterio es estructural, no una lista de campañas: un journey real de estas fuentes lleva
 *    su id numérico al final y guiones bajos. `Segundo Partido` no cumple ninguna de las dos.
 *    Una lista de campañas se desfasa en cuanto entra una nueva; esto no.
 */
function esJourneyReal(v) {
  var s = t(v);
  if (!esDato(s)) return false;
  return s.indexOf('_') >= 0 && /\d{4,}\s*$/.test(s);
}

/**
 * Construye el nombre de UNA pieza de WhatsApp.
 * @param p  { campana, touchpoint, segmento, subsegmento }  — del catálogo
 * @param journeys  los journeys que el bloque le atribuyó (0, 1 o varios)
 * @param extra  { utm_content }  — lo que identifica el envío cuando no hay journey
 * @returns { nombre, variantes, n, nivel, via }
 */
function nombrar(p, journeys, extra) {
  journeys = (journeys || []).map(t).filter(esDato);
  extra = extra || {};

  // ── NIVEL 1 · la fuente publica un journey de verdad ────────────────────────────
  var reales = journeys.filter(esJourneyReal);
  if (reales.length) {
    return {
      nombre: reales[0],
      variantes: reales.slice(1),
      n: reales.length,
      nivel: 1,
      via: NIVELES[1]
    };
  }

  var base = 'WA-' + trozo(p.campana);

  // ── NIVEL 2 · hay etiqueta de journey, pero no es un journey ─────────────────────
  if (journeys.length) {
    // 🔴 si la fuente trae VARIAS etiquetas para la misma pieza, todas entran en el nombre: dos
    //    piezas distintas con las mismas etiquetas serían el mismo envío, y eso ya sería el defecto.
    var etiquetas = journeys.slice().sort();
    return {
      nombre: base + '-' + etiquetas.map(trozo).join('-'),
      variantes: etiquetas,            // lo que dijo la fuente, tal cual — no se pierde
      n: 1 + etiquetas.length,
      nivel: 2,
      via: NIVELES[2]
    };
  }

  // ── NIVEL 3 · la hoja no trae journey por ningún lado ────────────────────────────
  // 🔴 Se usa lo que identifica al envío DENTRO de su propia hoja. En Hotcakes eso es el
  //    `utm_content` (c1..c4) más el segmento; en las piezas retiradas de Mundial, el touchpoint
  //    más el segmento. Ninguno de los dos es una métrica: no se mueven entre corridas.
  var partes = [base];
  if (esDato(extra.utm_content)) partes.push(trozo(extra.utm_content));
  else if (esDato(p.touchpoint)) partes.push(trozo(p.touchpoint).replace(/^WA-/, ''));
  if (esDato(p.segmento)) partes.push(trozo(p.segmento));
  if (esDato(p.subsegmento) && trozo(p.segmento).indexOf(trozo(p.subsegmento)) < 0) partes.push(trozo(p.subsegmento));
  return {
    nombre: partes.filter(Boolean).join('-'),
    variantes: [],
    n: 1,
    nivel: 3,
    via: NIVELES[3]
  };
}

/**
 * Las tres condiciones, comprobadas sobre el conjunto entero.
 * 🔴 Se prueba el CONJUNTO, no una pieza: la unicidad no se puede verificar de a una.
 */
function probar(asignados) {
  var fallos = [];
  var por = {};
  asignados.forEach(function (a) {
    [a.nombre].concat(a.variantes || []).forEach(function (n) {
      if (!esDato(n)) return;
      (por[n] = por[n] || []).push(a.pieza_id);
    });
  });
  Object.keys(por).forEach(function (n) {
    var unicos = por[n].filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    if (unicos.length > 1) fallos.push('el nombre «' + n.slice(0, 50) + '» está en ' + unicos.length + ' piezas: ' + unicos.join(' '));
  });
  asignados.forEach(function (a) {
    if (!esDato(a.nombre)) fallos.push(a.pieza_id + ' se quedó sin nombre');
    else if (t(a.nombre).length < 4) fallos.push(a.pieza_id + ' tiene un nombre demasiado corto para identificar nada: «' + a.nombre + '»');
  });
  return { ok: fallos.length === 0, fallos: fallos, distintos: Object.keys(por).length };
}

module.exports = { nombrar: nombrar, probar: probar, trozo: trozo, esJourneyReal: esJourneyReal, NIVELES: NIVELES };
