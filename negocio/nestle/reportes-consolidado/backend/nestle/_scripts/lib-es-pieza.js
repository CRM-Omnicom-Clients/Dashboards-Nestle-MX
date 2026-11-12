/*
 * lib-es-pieza.js — ¿ESTA FILA DEL CATÁLOGO ES UNA PIEZA, Y SE PUEDE CONSUMIR?
 *
 * 🔴 UN SOLO RESOLUTOR PARA UNA SOLA PREGUNTA. Si la cadena, el dashboard de Treasure Data y la
 *    sesión de SFMC responden cada uno por su cuenta «¿esto es una pieza?», van a divergir en
 *    silencio y cada uno va a reportar un total distinto que cuadra consigo mismo. Ya pasó aquí:
 *    tres scripts resolvían «¿de qué pieza es este envío?» y el canónico encontraba 1 de 113.
 *    Quien consuma el catálogo pregunta AQUÍ. No reimplementa.
 *
 * 🔴 EL CASO QUE LO ORIGINA. Rick escribe notas a mano en el catálogo, y quedan como filas con la
 *    columna `TouchPoint` llena de texto y SIN `Pieza_ID`:
 *        «NOTAS CATALOGO VARIOS DATOS YA ESTABAN» · «REVISAR A DETALLE QCART»
 *        «ATRIBUCIÓN DE CLICKS Y AGRUPACIÓN»      · «CADA COSA POR SEPARADO»
 *    Un lector que cuenta filas las cuenta como piezas. El reconciliador de Treasure Data lo hizo
 *    (dijo «127 piezas») y ya antes `vacios-llenar` les escribió 340 tokens encima creyendo que
 *    eran registros. Una fila sin llave no es un registro.
 *
 * 🔴 LA LLAVE ES EL `Pieza_ID`, Y TIENE FORMA. `NNN-PNNN` (`001-P032`). No basta «no está vacío»:
 *    una nota podría llevar texto en esa celda. Se exige la forma.
 */
var t = function (v) { return String(v == null ? '' : v).trim(); };

var FORMA_ID = /^\d{3}-P\d{3}$/;

/* Los canales que el catálogo declara. `Email` vive en SFMC; `WhatsApp` NO — sus métricas salen
 * de otra fuente, así que pedirle a SFMC que las encuentre siempre va a fallar. Eso no es una
 * discrepancia: es el diseño. */
var CANALES = { Email: 'vive en SFMC', WhatsApp: 'NO vive en SFMC — su fuente es whatsapp_leads.*' };

/**
 * @param fila  una fila del catálogo como la entrega `sheet_to_json`
 * @param cols  { id, canal, touchpoint } los NOMBRES REALES de esas columnas (los resuelve
 *              lib-columna quien llama; aquí no se adivinan)
 * @returns { es_pieza, canal, en_sfmc, motivo }
 */
function evaluar(fila, cols) {
  var id = t(fila[cols.id]);
  if (!id) return { es_pieza: false, canal: null, en_sfmc: false, motivo: 'sin Pieza_ID — no es un registro, es una fila suelta (probablemente una nota a mano)' };
  if (!FORMA_ID.test(id)) return { es_pieza: false, canal: null, en_sfmc: false, motivo: 'el Pieza_ID «' + id + '» no tiene la forma NNN-PNNN' };
  var canal = t(fila[cols.canal]);
  if (!canal) return { es_pieza: true, canal: null, en_sfmc: false, motivo: 'es una pieza pero NO declara canal — no se puede decidir su fuente' };
  if (CANALES[canal] === undefined) return { es_pieza: true, canal: canal, en_sfmc: false, motivo: 'canal «' + canal + '» no declarado en el contrato' };
  return { es_pieza: true, canal: canal, en_sfmc: (canal === 'Email'), motivo: CANALES[canal] };
}

/** El universo que un consumidor DEBE usar, ya partido. Nadie filtra por su cuenta. */
function universo(filas, cols) {
  var u = { piezas: [], email: [], whatsapp: [], sin_canal: [], no_piezas: [] };
  filas.forEach(function (f, i) {
    var r = evaluar(f, cols);
    var reg = { i: i + 2, id: t(f[cols.id]), texto: t(f[cols.touchpoint]).slice(0, 60), veredicto: r };
    if (!r.es_pieza) { u.no_piezas.push(reg); return; }
    u.piezas.push(reg);
    if (r.canal === 'Email') u.email.push(reg);
    else if (r.canal === 'WhatsApp') u.whatsapp.push(reg);
    else u.sin_canal.push(reg);
  });
  return u;
}

/* ══ NORMALIZAR UN Email_Name PARA CRUZARLO CONTRA SFMC ════════════════════════════════
 * 🔴 SFMC publica variantes del nombre que el catálogo guarda como «planeado»:
 *      · sufijo `-B-C`   → `…LIGAMX-J7_AQ…` (catálogo) vs `…LIGAMX-J7-B-C_AQ…` (SFMC)
 *      · sufijo ` - AAAAMM` que alguien agrega al reusar el nombre en otra oleada
 *      · el catálogo puede traer VARIOS nombres en una celda, separados por « · »
 *   Normalizar no es «limpiar»: es declarar qué diferencias NO cambian la identidad. Cualquier
 *   otra diferencia sí la cambia y debe fallar el match, no maquillarse.
 */
function nombresDe(celda) {
  return t(celda).split(/\s*·\s*/).map(t).filter(function (x) { return x && !/^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(x); });
}
function normalizar(nombre) {
  return t(nombre)
    .replace(/\s*-\s*\d{6}\s*$/, '')        // « - 202609»
    .replace(/-B-C(?=_)/, '')               // «-B-C» antes de un guion bajo
    .toUpperCase();
}
/** ¿dos nombres son el mismo envío? */
function mismoNombre(a, b) { return normalizar(a) === normalizar(b); }

module.exports = {
  evaluar: evaluar, universo: universo, FORMA_ID: FORMA_ID, CANALES: CANALES,
  nombresDe: nombresDe, normalizar: normalizar, mismoNombre: mismoNombre
};
