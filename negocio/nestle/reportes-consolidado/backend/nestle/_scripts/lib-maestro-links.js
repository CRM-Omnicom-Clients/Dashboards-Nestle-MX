var ENT = require(__dirname + '/lib-entorno.js');
// lib-maestro-links · EL MAESTRO DE LINKS DE QCART, INDEXADO POR SHORTLINK.
//
// 🔴 LA PAUTA (Rick, 27-ago-2026), y es la razón de ser de este archivo:
//    «TODAS LAS FILAS DEL DOC LINK QCART MARCAN UNA PIEZA, CADA MES DE MARZO A AGOSTO, ESO
//     DEFINE TODO. SI ES MISMO SEGMENTO EN DIFERENTE MES CON SHORT LINK DISTINTO, ES AHÍ DONDE
//     CUADRAS. Únicamente envío principal, NUNCA FUPS.»
//    Es decir: el bloque (MES · campaña · touchpoint · segmento) con SUS códigos ES una pieza.
//    El mismo segmento en otro mes, con otros códigos, es OTRA pieza y por tanto otra fila.
//
// 🔴 LA LLAVE ES EL SHORTLINK, NUNCA EL UTM (R2). Rick lo repitió el 27-ago: «las utms no
//    coinciden con el xls, solo el short link». En el CSV una fila puede traer `utm_content=e-p1`
//    y `utm_term=ligamx` mientras el maestro dice `e-j4` y `conregion`. Manda el maestro.
//
// 🔴 EL BUG QUE ESTE ARCHIVO TENÍA, Y POR QUÉ IMPORTA TANTO (corregido 27-ago-2026):
//    la fila del encabezado estaba FIJA en el índice 3 y la columna del código FIJA en «Códigos».
//    Marzo, Abril y Mayo no cumplen ninguna de las dos cosas, así que **las tres hojas se
//    descartaban en silencio** — el lector devolvía 66 filas de Junio a Septiembre y nadie
//    sabía que faltaba medio semestre. Dejaba un aviso, sí, pero un aviso que nadie lee no es
//    una salvaguarda. Ahora cada hoja declara CÓMO se leyó y CUÁNTO trajo, y una hoja de mes que
//    entrega cero filas es un error explícito, no un renglón en un array de avisos.
//
//    Las tres hojas tienen tres formas distintas y ninguna es «la mala»:
//      Marzo  → encabezado en f8 · campaña=«Campaña» · touchpoint=«Nombre Mail» · segmento=«Audiencia» · código=«ID»
//      Abril  → encabezado en f8 · utm_* · código=«Código» (SINGULAR)
//      Mayo   → encabezado en f8 · utm_* · SIN columna de código → sale de la URL de «QCart R1»
//      Jun-Ago→ encabezado en f4 · utm_* · código=«Códigos»
//    Por eso no se busca un nombre: se busca el ROL, y se acepta cualquiera de sus nombres.
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
/* 🔴 LA RUTA SE RESUELVE AL USARLA, NO AL CARGAR LA LIBRERÍA. `ENT.fuente()` **truena** si el
 *    archivo no está — y eso es lo correcto para quien lo va a leer, pero esto es una LIBRERÍA:
 *    puesto al nivel del módulo, el `require` de cualquier script moría aunque no tocara Qcart.
 *    Para alguien externo que no tenga compartido el maestro, eso convertiría «no tengo esa
 *    fuente» en «el sistema entero no arranca», y el mensaje señalaría al script equivocado. */
function ruta() { return ENT.fuente('qcart_maestro'); }

// ⚠ HISTÓRICO — ESTA REGLA YA NO APLICA. Decía: «Septiembre queda FUERA: Rick, 27-ago — estamos en
//    agosto, no hay de septiembre, e-p4 no vale, solo e-j5». Era cierto entonces: la hoja de
//    Septiembre estaba vacía y leerla solo metía ruido.
// 🔴 RICK LA LEVANTÓ EL 21-SEP: «ya está el qcart link master actualizado a septiembre». La hoja
//    trae 8 filas reales (J7, J8, WA-J8, J9, WA-J9). Se lee.
//    Lo que aquella exclusión evitaba sigue siendo verdad y ahora se DECLARA en vez de esconderse:
//    un mismo shortlink que aparece en dos meses queda bajo dos touchpoints, y eso es una
//    ambigüedad real del maestro que hay que resolver mirándola, no ocultando un mes entero.
/* 🔴 21-sep-2026 · LOS MESES SE DESCUBREN EN EL LIBRO, NO SE ESCRIBEN AQUÍ.
 *    Esta lista estaba fija y terminaba en Agosto. Rick actualizó el maestro con la hoja
 *    **Septiembre** (988 filas) y el lector la descartó **en silencio**: `MESES.forEach` solo mira
 *    los nombres que alguien recordó escribir, así que una hoja nueva no falla — simplemente no
 *    existe para el sistema. Es EXACTAMENTE el defecto que ya costó Marzo-Mayo en este mismo
 *    archivo, repetido por el otro extremo del calendario.
 *    Ahora se recorren TODAS las hojas del libro y se toma la que se llame como un mes; las demás
 *    se declaran con su motivo, para que saltarse una hoja sea siempre una frase, nunca un vacío.
 */
var MESES_VALIDOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function normMes(s) {
  return String(s == null ? '' : s).trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
/* Devuelve las hojas del libro que son un mes, EN ORDEN DE CALENDARIO — no en el orden en que
 * estén en el archivo, que es arbitrario y cambia cuando alguien mueve una pestaña. */
function mesesDelLibro(wb) {
  var idx = {}; MESES_VALIDOS.forEach(function (m, i) { idx[normMes(m)] = i; });
  return (wb.SheetNames || []).filter(function (h) { return idx[normMes(h)] !== undefined; })
    .sort(function (a, b) { return idx[normMes(a)] - idx[normMes(b)]; });
}
var MESES = MESES_VALIDOS;

// los ROLES y los nombres con que cada hoja los llama. Se busca el rol, no el nombre.
var ROLES = {
  campana:    ['utm_campaign', 'campaña', 'campana'],
  touchpoint: ['utm_content', 'nombre email', 'nombre mail'],
  segmento:   ['utm_term', 'audiencia'],
  fecha:      ['fecha de envío', 'fecha de envio', 'fecha envío', 'fecha envio'],
  receta:     ['receta1', 'recetas', 'receta 1'],
  retailer:   ['retailer'],
  codigo:     ['códigos', 'codigos', 'código', 'codigo', 'id'],
  url:        ['links qcart', 'qcart r1', 'link qcart']
};

// el código dentro de una URL de qcart: `https://recetasnestlmx.qcart.app/3o1GDbRc` → `3o1GDbRc`
function codigoDeUrl(v) {
  var m = /qcart\.app\/([A-Za-z0-9_-]{6,})/.exec(t(v));
  return m ? m[1] : '';
}

var _cache = null;
function cargar(opciones) {
  if (_cache && !(opciones || {}).recargar) return _cache;
  var T = require('path').resolve(__dirname, '..') + '/_tmp/_maestro-links.xlsx';
  fs.copyFileSync(ruta(), T);                      // ruta con acentos: se copia a ASCII
  var wb = XLSX.readFile(T);
  var porCodigo = {}, filas = [], avisos = [], hojas = [];

  var MESES_AQUI = mesesDelLibro(wb);
  // 🔴 y lo que NO es un mes se declara: una hoja saltada tiene que ser una frase, no un vacío
  (wb.SheetNames || []).forEach(function (h) {
    if (MESES_AQUI.indexOf(h) < 0) hojas.push({ hoja: h, leida: false, motivo: 'no es una hoja de mes — no se lee' });
  });
  MESES_AQUI.forEach(function (hoja) {
    if (!wb.Sheets[hoja]) { hojas.push({ hoja: hoja, leida: false, motivo: 'la hoja no existe en el libro' }); return; }
    var M = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: '' });

    // 🔴 EL ENCABEZADO SE BUSCA, NO SE ASUME. Es la mitad del bug: estaba fijo en el índice 3 y
    //    Abril y Mayo lo tienen en el 7. Se busca la primera fila que traiga el rol «campaña».
    var iEnc = -1, cols = null;
    for (var f = 0; f < Math.min(20, M.length) && iEnc < 0; f++) {
      var enc = (M[f] || []).map(function (x) { return t(x).toLowerCase(); });
      var c = {};
      Object.keys(ROLES).forEach(function (rol) {
        c[rol] = -1;
        ROLES[rol].forEach(function (nom) { if (c[rol] < 0) c[rol] = enc.indexOf(nom); });
      });
      if (c.campana >= 0) { iEnc = f; cols = c; }
    }
    if (iEnc < 0) {
      hojas.push({ hoja: hoja, leida: false, motivo: 'ninguna de las primeras 20 filas trae una columna de campaña' });
      avisos.push({ hoja: hoja, aviso: '🔴 no se pudo leer: sin fila de encabezado reconocible' });
      return;
    }
    // el código puede venir de su columna o de la URL; si no hay ninguna de las dos, no se lee
    if (cols.codigo < 0 && cols.url < 0) {
      hojas.push({ hoja: hoja, leida: false, fila_encabezado: iEnc + 1, motivo: 'sin columna de código ni de URL de qcart' });
      avisos.push({ hoja: hoja, aviso: '🔴 no se pudo leer: no hay de dónde sacar el shortlink' });
      return;
    }

    // 🔴 la herencia se corta al cambiar de campaña o de fecha: si no, un bloque nuevo heredaría
    //    el touchpoint del anterior y se atribuiría a la pieza equivocada. En Marzo el SEGMENTO
    //    también se hereda (solo aparece en la primera fila del bloque), así que hereda igual.
    var ultTp = '', ultSeg = '', ultCamp = '', ultFecha = '', n = 0, deUrl = 0;
    for (var i = iEnc + 1; i < M.length; i++) {
      var r = M[i] || [];
      var camp = t(r[cols.campana]); if (!camp) continue;
      var fecha = cols.fecha >= 0 ? t(r[cols.fecha]) : '';
      if (camp !== ultCamp || fecha !== ultFecha) { ultTp = ''; ultSeg = ''; ultCamp = camp; ultFecha = fecha; }

      var tp = cols.touchpoint >= 0 ? t(r[cols.touchpoint]) : '';
      if (tp) ultTp = tp; else tp = ultTp;
      var seg = cols.segmento >= 0 ? t(r[cols.segmento]) : '';
      if (seg) ultSeg = seg; else seg = ultSeg;

      var cod = cols.codigo >= 0 ? t(r[cols.codigo]) : '';
      var viaUrl = false;
      // 🔴 un código no se INVENTA de la URL cuando la columna trae otra cosa: solo se lee de la
      //    URL si la columna no existe o vino vacía. Y se declara cuál de las dos fuentes se usó.
      if (!cod && cols.url >= 0) { cod = codigoDeUrl(r[cols.url]); viaUrl = !!cod; }
      // una celda de la columna «ID» puede traer texto («No se envío a Qcart»): eso NO es un código
      if (!/^[A-Za-z0-9_-]{6,}$/.test(cod)) continue;
      if (viaUrl) deUrl++;

      var reg = {
        hoja: hoja, fila: i + 1, utm_campaign: camp, fecha_envio: fecha,
        utm_content: tp, utm_content_heredado: !t(r[cols.touchpoint >= 0 ? cols.touchpoint : 0]) && !!tp,
        utm_term: seg,
        receta: cols.receta >= 0 ? t(r[cols.receta]) : '',
        retailer: cols.retailer >= 0 ? t(r[cols.retailer]) : '',
        codigo: cod, codigo_via: viaUrl ? 'URL' : 'columna'
      };
      filas.push(reg); n++;
      // 🔴 un mismo shortlink bajo dos touchpoints es un carrito que NO se puede atribuir: no hay
      //    tercera señal que los separe. Se declara con las DOS combinaciones, no se elige una.
      if (porCodigo[cod] && porCodigo[cod].utm_content !== tp) {
        avisos.push({ codigo: cod, aviso: 'el mismo shortlink aparece con dos utm_content distintos',
          a: porCodigo[cod].hoja + '/' + porCodigo[cod].utm_content + '/' + porCodigo[cod].utm_term,
          b: hoja + '/' + tp + '/' + seg });
      }
      porCodigo[cod] = reg;
    }
    hojas.push({ hoja: hoja, leida: true, fila_encabezado: iEnc + 1, filas: n, codigos_de_url: deUrl,
      columnas: Object.keys(cols).filter(function (k) { return cols[k] >= 0; }) });
    // 🔴 UNA HOJA DE MES QUE ENTREGA CERO ES UN ERROR, NO UN DATO. Así se descubrió el bug:
    //    tres hojas devolvían cero y el sistema seguía como si nada.
    if (!n) avisos.push({ hoja: hoja, aviso: '🔴 la hoja se leyó pero NO entregó ninguna fila con código' });
  });

  _cache = { porCodigo: porCodigo, filas: filas, avisos: avisos, hojas: hojas, meses: MESES_AQUI, ruta: ruta() };
  return _cache;
}

/** lo que el MAESTRO declara para un shortlink. `null` si no lo declara — y eso se dice, no se rellena. */
function porShortlink(code) {
  var M = cargar();
  return M.porCodigo[t(code)] || null;
}

/** las audiencias declaradas de una campaña: los `utm_term` distintos que usa */
function audienciasDe(utmCampaign) {
  var M = cargar(), out = {};
  M.filas.filter(function (f) { return t(f.utm_campaign).toLowerCase() === t(utmCampaign).toLowerCase(); })
    .forEach(function (f) { if (f.utm_term) out[f.utm_term] = (out[f.utm_term] || 0) + 1; });
  return out;
}

/** los touchpoints declarados de una campaña, con sus audiencias y sus códigos */
function bloquesDe(utmCampaign) {
  var M = cargar(), out = {};
  M.filas.filter(function (f) { return t(f.utm_campaign).toLowerCase() === t(utmCampaign).toLowerCase(); })
    .forEach(function (f) {
      var k = f.utm_content + ' ¦ ' + f.utm_term;
      out[k] = out[k] || { utm_content: f.utm_content, utm_term: f.utm_term, fecha_envio: f.fecha_envio, codigos: [] };
      out[k].codigos.push(f.codigo);
    });
  return Object.keys(out).map(function (k) { return out[k]; });
}

/**
 * LOS BLOQUES = LAS PIEZAS QUE EL DOC DECLARA (la pauta de Rick).
 * Uno por MES × campaña × touchpoint × segmento, con sus códigos. Es la unidad contra la que
 * se audita el catálogo: si un bloque no tiene pieza, falta una fila; si tiene dos, se partió.
 */
function piezasDelDoc() {
  var M = cargar(), out = {}, sinFecha = [];
  M.filas.forEach(function (f) {
    // 🔴 SOLO LAS FILAS CON FECHA Y MES VIGENTE (Rick, 27-ago): «las filas del doc qcart son las
    //    que tienen fecha y mes vigente; no hojas sueltas sin mes, ni sin fecha». Una fila sin
    //    fecha de envío no es una pieza: es un borrador dentro de una hoja de mes. Se DECLARA
    //    cuántas se caen por eso — dejarlas fuera en silencio sería el mismo defecto que
    //    descartaba Marzo, Abril y Mayo.
    // 🔴 «No usado» NO ES UNA FECHA, y la celda no está vacía — así que el filtro de «tiene
    //    fecha» la dejaba pasar. El doc escribe el hecho de que el link no salió con palabras:
    //    `No usado` · `No enviado` · `No salió` · `No seleccionado`. Una fila así no es una pieza:
    //    es un link preparado que nunca se mandó, y contarla inventa un bloque sin envío.
    var fe = t(f.fecha_envio);
    if (!fe || /^no\s|^n\/a$|^pendiente$/i.test(fe)) {
      sinFecha.push({ hoja: f.hoja, fila: f.fila, codigo: f.codigo, campana: f.utm_campaign, dice: fe || '(vacío)' });
      return;
    }
    var k = [f.hoja, f.utm_campaign, f.utm_content || '(sin touchpoint)', f.utm_term || '(sin segmento)'].join(' ¦ ');
    out[k] = out[k] || { llave: k, mes: f.hoja, campana: f.utm_campaign,
      touchpoint: f.utm_content || '(sin touchpoint)', segmento: f.utm_term || '(sin segmento)',
      fecha_envio: f.fecha_envio, codigos: [], recetas: [] };
    if (out[k].codigos.indexOf(f.codigo) < 0) out[k].codigos.push(f.codigo);
    if (f.receta && out[k].recetas.indexOf(f.receta) < 0) out[k].recetas.push(f.receta);
  });
  var lista = Object.keys(out).sort().map(function (k) { return out[k]; });
  lista.sin_fecha = sinFecha;      // se lleva pegado quién se quedó fuera y por qué
  return lista;
}

module.exports = { cargar: cargar, porShortlink: porShortlink, audienciasDe: audienciasDe,
  bloquesDe: bloquesDe, piezasDelDoc: piezasDelDoc, MESES: MESES, get RUTA() { return ruta(); } };
