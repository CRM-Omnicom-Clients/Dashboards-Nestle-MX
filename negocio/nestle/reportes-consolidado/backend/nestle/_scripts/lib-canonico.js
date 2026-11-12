// lib-canonico.js — LAS CUATRO DIMENSIONES CANÓNICAS, resueltas desde el catálogo.
//
// 🔴 POR QUÉ EXISTE. Las canónicas de `Data_Email` eran 779 fórmulas
//    `INDEX(Catalog_Campanas!…, MATCH(…))` dentro de la hoja. Rick borró esa hoja y las 779
//    murieron de golpe. Un valor no se rompe cuando alguien mueve una hoja; una fórmula sí.
//    Así que la resolución ocurre AQUÍ, en el backend, y a la hoja bajan VALORES.
//
// 🔴 UNA SOLA IMPLEMENTACIÓN PARA LAS CUATRO FUENTES. Email, Qcart, WhatsApp y manual usan
//    esto. Si cada fuente resolviera por su cuenta, el mismo `pieza_id` podría salir con
//    `Segmento` distinto en dos hojas — y la regla de Rick es que los canónicos coincidan
//    EXACTAMENTE entre todas las hojas de datos. Una sola función es lo que lo hace cierto.
//
// LA CASCADA — de la más fuerte a la más débil, y frena:
//   1 · pieza_id            el registro ya está anclado: hereda las 4 de su pieza. Es la buena.
//   2 · content_name        cruza contra Catalogo_Piezas por nombre de pieza (y sus variantes)
//   3 · escalera de alias   traduce el valor crudo con lib-alias (Catalogo_Referencias)
//   4 · NO RESUELVE         se declara con su motivo. No se inventa.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ALIAS = require(__dirname + '/lib-alias.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

// la dimensión lógica → su columna en Catalogo_Piezas, y su dimensión en Catalogo_Referencias
// 🔴 EL TOUCHPOINT ES UNA DIMENSIÓN COMO LAS OTRAS CUATRO, y faltaba. El contrato de
//    `Data_WhatsApp` pedía `touchpoint_canonico` —un campo que ningún bloque producía— así que
//    `TouchPoint` no se escribía nunca y la hoja se quedaba con el CRUDO: decía `WA-SF-A` donde el
//    catálogo dice `Semifinal A`, `WA-FINAL` donde dice `Final`. El reporte sí traía el canónico
//    (sale del catálogo), así que las dos vistas del mismo envío no cruzaban, y el guardián de
//    WhatsApp declaró los 12 envíos «sin llegar a ningún reporte». Estaban todos.
//    Declararlo aquí lo reparte a las cuatro fuentes de una vez: es el sitio donde una dimensión
//    se declara una sola vez y todos la resuelven igual.
// la función compartida que compone «segmento · subsegmento» — vive en UN solo sitio
var EQS = require(__dirname + '/lib-esquema.js');
var NM_SUB = 'Subsegm' + 'ento';
// la llave natural de WhatsApp, desde el 15-sep-2026 — ver la nota en `indexarPiezas`
var NM_WA_NAME = 'Whatsapp' + '_Name', NM_WA_VAR = 'Whatsapp' + '_Names_Variantes';

var DIM = {
  bu: { pieza: 'BU', ref: 'Bu' },
  marca: { pieza: 'Marca', ref: 'Marca' },
  campana: { pieza: 'Campaña', ref: 'Campana' },
  segmento: { pieza: 'Segmento', ref: 'Segmento' },
  touchpoint: { pieza: 'TouchPoint', ref: 'Touchpoint' }
};

/* ══ 19-sep-2026 · EL NOMBRE DE LA COLUMNA SE PREGUNTA, NO SE ESCRIBE ═════════════════════════
 * 🔴 EL DEFECTO QUE ESTO ARREGLA, MEDIDO: este índice leía la columna de nombre como LITERAL
 *    `Content_Name`. Esa columna se renombró a **`Email_Name`** (el registro lo tiene:
 *    `catalogo.content_name → ["Email_Name"]`, con `Content_Name` como alias histórico). La lectura
 *    devolvía `undefined` en las 129 piezas y el índice de nombres de email quedaba con **1 clave
 *    de 113**. No tronó: `resolver()` no encontraba nada por nombre y se caía a su siguiente vía,
 *    en silencio. Coste comprobado: `motor.links.js` dejó 28 piezas con su ConfigKey provisional
 *    (`TMP-AON-EAPP`, `009-TMP-PP-E3-P`) y **6,471 clicks — el 14.2%** fuera de toda fila del
 *    reporte. Es el «0 y 0» por el que nació el registro de nombres, otra vez.
 *
 * 🔴 Y SE EXIGE QUE LA COLUMNA EXISTA, en vez de aceptar el vacío. Si ninguno de los candidatos
 *    está en las filas que llegan, `indexarPiezas` TRUENA. Un índice vacío es indistinguible de
 *    «no hay coincidencias», y ésa es exactamente la razón por la que este defecto vivió meses.
 */
var CANDIDATOS = {
  nombre: ['Email' + '_Name', 'Content' + '_Name'],
  variantes: ['Email' + '_Names_Variantes', 'Content' + '_Names_Variantes']
};
function campoDe(fila, cands) {
  for (var i = 0; i < cands.length; i++) if (Object.prototype.hasOwnProperty.call(fila, cands[i])) return cands[i];
  return null;
}
/* Parte una celda de nombres en sus nombres. Un solo separador para las cuatro columnas: si la
 * celda principal se partiera con un juego de separadores y las variantes con otro, el mismo nombre
 * entraría al índice de una forma en una columna y de otra en la otra. */
function SEP(v) {
  return String(v == null ? '' : v).split(/\s*[·|;]\s*|[\r\n]+/).map(t).filter(Boolean);
}
var NM_ID = 'Pieza' + '_ID';
var AMBIGUO = '¦AMBIGUO¦';

/** índices sobre Catalogo_Piezas: por pieza_id y por nombre de pieza (email y WhatsApp, con variantes) */
function indexarPiezas(piezas) {
  var porId = {}, porContent = {}, candidatas = {};
  // se resuelve UNA vez contra la primera fila, y se exige que el nombre de email exista
  var muestra = (piezas || [])[0] || {};
  var CNOM = campoDe(muestra, CANDIDATOS.nombre);
  var CVAR = campoDe(muestra, CANDIDATOS.variantes);
  if (piezas && piezas.length && !CNOM) {
    throw new Error('lib-canonico.indexarPiezas: ninguna columna de nombre existe en las filas (' +
      CANDIDATOS.nombre.join(' / ') + '). Un índice vacío se lee como «no hay coincidencias» y esconde el defecto.');
  }
  piezas.forEach(function (p) {
    var id = t(p['Pieza_ID']);
    if (id) porId[id] = p;
    // 🔴 EL ÍNDICE DE NOMBRES ES DE LOS DOS CANALES (15-sep-2026). Solo miraba los de email, así
    //    que una pieza de WhatsApp nunca se podía encontrar por su nombre — no tenía ninguno.
    //    Desde que existe `Whatsapp_Name` sí lo tiene, y entra al MISMO índice a propósito: el
    //    nombre es la identidad de la pieza, no una propiedad de su canal, y dos piezas no pueden
    //    compartirlo aunque sean de canales distintos. Si alguna vez chocaran, la marca de
    //    ambiguo salta igual y ninguna de las dos gana — que es justo lo que tiene que pasar.
    // 🔴 LA CELDA PRINCIPAL TAMBIÉN SE PARTE. Se indexaba entera, y hay piezas cuyo `Email_Name`
    //    guarda DOS nombres unidos por `·` (`005-P012` es una: SFMC publicó el mismo envío con dos
    //    nombres). Metida entera, la clave era la cadena `A · B`, que no coincide con ninguno de los
    //    dos nombres reales: 4 nombres quedaban fuera del índice. Partirla no puede romper nada —
    //    un nombre sin `·` se parte en sí mismo.
    var nombres = SEP(CNOM ? p[CNOM] : '').concat(SEP(CVAR ? p[CVAR] : ''))
      .concat(SEP(p[NM_WA_NAME])).concat(SEP(p[NM_WA_VAR]));
    nombres.forEach(function (cn) {
      var k = ALIAS.nm(cn);
      if (!k) return;
      // ⚠ si dos piezas comparten un content_name, NO se elige una: se marca ambiguo y la
      //   vía 2 se salta. Elegir «la primera» es exactamente lo que movió 186 carritos en Qcart.
      /* 🔴 UN NOMBRE AMBIGUO NO ES UN NOMBRE DESCONOCIDO — se guardan sus candidatas.
       *    Antes se marcaba `¦AMBIGUO¦` y se perdía QUIÉNES chocaban, así que quien preguntaba se
       *    quedaba sin nada: en `Data_Clicks` eso dejó **45 filas sin campaña**. Pero la ambigüedad
       *    es sobre QUÉ PIEZA, no sobre qué campaña: `009-P002` y `009-P009` comparten nombre y son
       *    las dos «Fuel for life · E-E3 · Pro Plan Aspiracionales». Guardando las candidatas se
       *    puede responder lo que TODAS contestan igual y callar lo que no (`dimensionSiCoinciden`),
       *    que es más honesto que elegir una y más útil que no saber nada. */
      candidatas[k] = candidatas[k] || [];
      if (candidatas[k].indexOf(p) < 0) candidatas[k].push(p);
      var yaId = porContent[k] && porContent[k] !== '¦AMBIGUO¦' ? t(porContent[k][NM_ID]) : null;
      if (yaId !== null && yaId !== id) porContent[k] = '¦AMBIGUO¦';
      else if (!porContent[k]) porContent[k] = p;
    });
  });
  return { porId: porId, porContent: porContent, candidatas: candidatas };
}

/**
 * Resuelve las 4 canónicas de un registro.
 * @param IX    índice de indexarPiezas
 * @param IXA   índice de lib-alias.indexar(Catalogo_Referencias)
 * @param reg   { pieza_id?, content_name?, campana_raw?, segmento_raw? }
 * @returns { bu, marca, campana, segmento, via, pieza_id, motivo }
 */
function resolver(IX, IXA, reg) {
  var out = { bu: null, marca: null, campana: null, segmento: null, via: null, pieza_id: null, motivo: null };

  // 1 · ya viene anclado
  var p = reg.pieza_id ? IX.porId[t(reg.pieza_id)] : null;
  if (p) out.via = '1 · pieza_id';

  // 2 · por content_name
  if (!p && reg.content_name) {
    var hit = IX.porContent[ALIAS.nm(reg.content_name)];
    if (hit === '¦AMBIGUO¦') { out.motivo = 'su content_name está en más de una pieza: no se elige ninguna'; }
    else if (hit) { p = hit; out.via = '2 · content_name'; }
  }

  if (p) {
    out.pieza_id = t(p['Pieza_ID']);
    Object.keys(DIM).forEach(function (d) { out[d] = t(p[DIM[d].pieza]) || null; });
    // 🔴 EL SEGMENTO LLEVA SU SUBSEGMENTO (15-sep-2026). Aquí salía pelado, y el bloque de email
    //    —que no pasa por esta función— lo componía por su cuenta. Mientras las piezas nuevas no
    //    llegaban a las hojas crudas nadie veía la diferencia; en cuanto el escritor empezó a
    //    darlas de alta, el MISMO id apareció como «Región unificada · Partición A» en Data_Email
    //    y «Región unificada» en Data_Qcart, y el guardián de canónicos lo cazó (005-P009 y
    //    005-P012). Se compone aquí, que es el único sitio por el que pasan las cuatro fuentes,
    //    y con la función compartida de `lib-esquema` — no con una cuarta copia de la misma línea.
    if (out.segmento) out.segmento = EQS.segmentoCanonico(out.segmento, t(p[NM_SUB]));
    // 🔴 aunque haya pieza, un campo vacío en el catálogo NO se rellena con la escalera: el
    //    catálogo es la autoridad, y su vacío es información (esa pieza no tiene esa dimensión).
    return out;
  }

  // 3 · la escalera de alias sobre los valores crudos
  var algo = false;
  if (reg.campana_raw) {
    var rc = ALIAS.resolver(IXA, DIM.campana.ref, reg.campana_raw, null, null);
    if (rc.v) { out.campana = rc.v; algo = true; }
  }
  if (reg.segmento_raw) {
    var rs = ALIAS.resolver(IXA, DIM.segmento.ref, reg.segmento_raw, reg.campana_raw || null, null);
    if (rs.v) { out.segmento = rs.v; algo = true; }
  }
  if (algo) { out.via = '3 · escalera de alias'; return out; }

  out.via = '4 · NO RESUELVE';
  out.motivo = out.motivo || 'ni su content_name está en el catálogo ni sus valores crudos tienen alias declarado';
  return out;
}

/**
 * Compara lo resuelto contra lo que la hoja ya tiene, y DECLARA cada diferencia.
 * 🔴 Manda el catálogo (decisión de Rick, 20-ago-2026): `Data_Email` quedó desactualizada y las
 *    celdas escritas a mano se escribieron cuando el catálogo no existía. Pero «manda» no es
 *    «se pisa en silencio»: cada celda que cambia se lista con lo que decía antes, para poder
 *    revisarla y, si el catálogo se equivoca, corregir el catálogo.
 * ⚠ Donde el catálogo NO resuelve, se CONSERVA lo de la hoja. Sustituir un valor escrito por
 *   una persona por un vacío sería destruir el único dato que hay.
 */
function contrastar(resuelto, enLaHoja) {
  var cambios = [], conservados = [];
  Object.keys(DIM).forEach(function (d) {
    var nuevo = resuelto[d], viejo = t(enLaHoja[d] || '');
    if (!nuevo) { if (viejo) conservados.push({ dimension: d, valor: viejo, motivo: 'el catálogo no lo resuelve; se conserva lo de la hoja' }); return; }
    if (!viejo) { cambios.push({ dimension: d, de: '(vacío)', a: nuevo, tipo: 'repuesto' }); return; }
    if (ALIAS.nm(viejo) !== ALIAS.nm(nuevo)) cambios.push({ dimension: d, de: viejo, a: nuevo, tipo: 'CORREGIDO' });
  });
  return { cambios: cambios, conservados: conservados };
}

/* ══ LO QUE SE PUEDE SABER DE UN NOMBRE AMBIGUO ═══════════════════════════════════════════════
 * 🔴 LA IDEA, Y POR QUÉ NO ES UN ATAJO. Cuando dos piezas comparten un nombre no se puede decir
 *    de QUIÉN es el envío — y no se elige, nunca. Pero sí se puede decir todo aquello en lo que
 *    las candidatas COINCIDEN: si las dos son «Fuel for life · E-E3 · Pro Plan Aspiracionales»,
 *    la campaña de ese envío es Fuel for life sin ninguna duda. Lo que difiere se devuelve vacío.
 *    Sin esto, `Data_Clicks` dejaba 45 filas sin campaña **aunque la campaña fuera obvia**, y la
 *    alternativa tentadora —elegir la primera candidata— es justo lo que movió 186 carritos.
 * 🔴 Devuelve `{ pieza_id: null }` a propósito: la pieza sigue sin resolverse. Que se sepa la
 *    campaña no autoriza a inventar un `pieza_id`, que es la llave de la atribución.
 */
function dimensionesDeNombre(IX, nombre, columnas) {
  var k = ALIAS.nm(nombre);
  if (!k) return null;
  var hit = IX.porContent[k];
  if (hit && hit !== AMBIGUO) return { pieza_id: t(hit[NM_ID]), unica: true, valores: hit, candidatas: [hit] };
  var cs = (IX.candidatas || {})[k] || [];
  if (cs.length < 2) return null;
  var out = {};
  (columnas || []).forEach(function (c) {
    var vs = [];
    cs.forEach(function (p) { var v = t(p[c]); if (vs.indexOf(v) < 0) vs.push(v); });
    out[c] = vs.length === 1 ? vs[0] : '';   // difieren → no se sabe, y se dice callando
  });
  return { pieza_id: null, unica: false, valores: out, candidatas: cs };
}

module.exports = {
  indexarPiezas: indexarPiezas, resolver: resolver, contrastar: contrastar, DIM: DIM, nm: ALIAS.nm,
  dimensionesDeNombre: dimensionesDeNombre, AMBIGUO: AMBIGUO, NM_ID: NM_ID
};
