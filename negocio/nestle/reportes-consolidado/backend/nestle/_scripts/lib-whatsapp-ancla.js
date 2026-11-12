// lib-whatsapp-ancla.js — ata cada envío de WhatsApp a su pieza del catálogo.
//
// 🔴 NUNCA con una sola variable, y la ambigua se DECLARA en vez de forzarse. Es la misma
//    regla que en Qcart y por el mismo motivo: asignar «la primera» movió 186 carritos.
//
// La cascada, de la más específica a la más débil. Cada peldaño dice por qué se puede confiar:
//
//   1 · campaña + segmento + fecha     tres variables coincidiendo: es el mismo envío
//   2 · campaña + segmento + SENDS     la cifra confirma la identidad aunque falte la fecha
//   3 · campaña + fecha + touchpoint   cuando el segmento viene sucio pero el TP del utm sirve
//   4 · campaña + segmento            última vía; solo vale si deja UNA candidata
//       AMBIGUA / SIN PIEZA           se declara con sus candidatas. No se fuerza.
//
// ⚠ Los datos de Maggi y Maggi Mundial vienen muy sucios: fechas dentro del campo `journey`,
//   shortlinks de Qcart dentro de `utm_content`, segmentos que son frases. No se «arreglan»:
//   se intenta el cruce con lo que sí sirve y lo que no resuelve se declara con su motivo.
// 🔴 UN SOLO NORMALIZADOR PARA TODO EL SISTEMA. Esta librería tenía el suyo (`nmz`) y difería
//    del oficial (`lib-alias.nm`) en 10 de 14 casos de prueba — justo en los compuestos, que son
//    todos los segmentos de Nestlé: `Modern Cooking` daba «modern cooking» aquí y «moderncooking»
//    allá. Coincidían en los casos simples, que es por lo que nunca explotó: cada script se valida
//    contra sí mismo y nadie comparaba los dos.
//    Se delega en `lib-alias.nm`. Es un cambio que NO altera resultados —ambas funciones de abajo
//    ya quitaban los espacios— y eso se comprueba corriendo `Z-probar-escalera.js`.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ALIAS = require(__dirname + '/lib-alias.js');

function t(v) { return String(v == null ? '' : v).trim(); }
function nmz(s) { return ALIAS.nm(s); }

// 🔴 los nombres de columna, arriba y una sola vez. `NM_PIEZA` vivía dentro del peldaño 1b, y al
//    añadir el peldaño 0 —que va ANTES— habría llegado `undefined`: `var` sube la declaración pero
//    no la asignación, así que el id de la pieza habría salido vacío sin un solo error.
var NM_PIEZA = 'Pieza' + '_ID';
var NM_WA_NAME = 'Whatsapp' + '_Name', NM_WA_VAR = 'Whatsapp' + '_Names_Variantes';

// El prefijo dimensional renombro Touchpoint -> TouchPoint en el catalogo. Se lee con tolerancia:
// hardcodear el nombre fisico es como el atribuidor dejo de encontrar 2 envios sin decir nada.
function TP(p) { return (p && (p['TouchPoint'] !== undefined && String(p['TouchPoint']).trim() ? p['TouchPoint'] : p['Touchpoint'])) || ''; }

/**
 * 🔴 EL ALIAS SE PIDE A LA AUTORIDAD, no se adivina. `normalizacion.json` es el JSON que genera la
 *    hoja `Catalogo_Referencias`, y su llave lleva el CONTEXTO: «Segundo Partido» significa una
 *    cosa en Mundial y podría significar otra en otra campaña. Se busca primero con contexto y
 *    luego sin él — la «escalera de alias»: cuanto más específico, más manda.
 */
var _NORM = null;
function aliasDe(dimension, crudo, contexto) {
  if (_NORM === null) {
    try { _NORM = JSON.parse(require('fs').readFileSync(
      require('path').resolve(__dirname, '..') + '/_contratos/normalizacion.json', 'utf8')); }
    catch (e) { _NORM = { alias: {} }; }
  }
  var d = (_NORM.alias || {})[dimension] || {};
  var conCtx = d[crudo + (contexto ? ' @ ' + contexto : '')];
  if (conCtx) return conCtx.canonico;
  var solo = d[crudo];
  if (solo) return solo.canonico;
  // último escalón: comparar normalizado, por si el crudo trae mayúsculas o acentos distintos
  var k = Object.keys(d).filter(function (x) {
    var base = x.split(' @ ')[0];
    return ALIAS.nm(base) === ALIAS.nm(crudo) && (!contexto || !/ @ /.test(x) || ALIAS.nm(x.split(' @ ')[1]) === ALIAS.nm(contexto));
  })[0];
  return k ? d[k].canonico : null;
}

// ⚠ LO QUE SIGUE INFIERE DEL NAMING, y eso el sistema lo prohíbe: las dimensiones salen de las
//   autoridades. Se conserva porque hoy está resolviendo cruces reales, pero cada vez que una
//   heurística decide, lo DECLARA en `ultimaInferencia` para que se vea y se pueda migrar a un
//   alias declarado en `Catalogo_Referencias`. El objetivo es que esta función deje de inferir.
var inferencias = [];
function inferir(tipo, a, b) { inferencias.push({ heuristica: tipo, a: a, b: b }); return true; }

// «indulgentes» y «Indulgentes», «Botanas» y «Botana», «Modern Cooking» y «moderncooking»
function segIgual(a, b) {
  var x = nmz(a), y = nmz(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // plural/singular: botana ↔ botanas  — ⚠ HEURÍSTICA, se declara
  if (x.replace(/s$/, '') === y.replace(/s$/, '')) return inferir('plural/singular', a, b);
  return false;
}
function campIgual(a, b) {
  var x = nmz(a), y = nmz(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // «Maggi Mundial» ↔ «Mundial» — ⚠ HEURÍSTICA de subcadena, la más peligrosa de las dos:
  //   también haría iguales «Bebidas» y «Bebidas Light». Se declara para poder migrarla.
  if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return inferir('subcadena', a, b);
  return false;
}
/** qué decidió una heurística en vez de un alias declarado — para migrarlo al catálogo */
function inferenciasHechas() {
  var vistos = {}, out = [];
  inferencias.forEach(function (i) {
    var k = i.heuristica + '¦' + nmz(i.a) + '¦' + nmz(i.b);
    if (vistos[k]) return; vistos[k] = 1; out.push(i);
  });
  return out;
}
function limpiarInferencias() { inferencias = []; }

/**
 * @param piezas  filas de Catalogo_Piezas (solo se usan las de canal WhatsApp)
 * @param envio   un envío normalizado por lib-whatsapp
 */
function atribuir(piezas, envio) {
  var wa = piezas.filter(function (p) { return /whats/i.test(t(p['Canal'])); });
  var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };

  // 🔴 LA CAMPAÑA TAMBIÉN PASA POR EL ALIAS. La hoja de WhatsApp titula la campaña «ICE», pero ICE
  //    es la MARCA (Nescafé ICE) y la campaña es «The Freshers» — lo decidió Rick el 20-ago. Sin
  //    consultar el alias, `mismaCamp` quedaba vacío y el envío moría en el primer filtro, sin
  //    llegar a ninguno de los escalones que sí podían resolverlo.
  var campCanon = aliasDe('Campaña', t(envio.campana_raw), '') || aliasDe('Campaña', t(envio.hoja), '');
  var mismaCamp = wa.filter(function (p) {
    return campIgual(p['Campaña'], envio.campana_raw) || campIgual(p['Campaña'], envio.hoja) ||
      (campCanon && nmz(p['Campaña']) === nmz(campCanon));
  });
  if (!mismaCamp.length) {
    return { pieza_id: null, via: 'SIN PIEZA', motivo: 'ninguna pieza de WhatsApp es de esa campaña' };
  }

  // 🔴 0 · POR EL NOMBRE, Y VA PRIMERO (15-sep-2026). Desde que existe `Whatsapp_Name`, una pieza
  //    de WhatsApp tiene llave natural, y una llave natural se prueba ANTES que cualquier
  //    combinación de atributos. Todos los peldaños de abajo son aproximaciones —campaña más
  //    segmento, más fecha, más envíos— y cada uno puede acertar por casualidad: dos envíos del
  //    mismo día en la misma campaña caen en el mismo escalón. El nombre no se parece a nada: o
  //    es esa pieza o no lo es.
  //    Esto no jubila al 1b (el id final del journey): 1b sigue haciendo falta para el caso en que
  //    la fuente publica un journey que el catálogo todavía no tiene escrito. El 0 resuelve
  //    cuando el nombre YA está en el catálogo, que es el caso normal a partir de ahora.
  var nomEnvio = t(envio.journey);
  if (nomEnvio) {
    var c0 = mismaCamp.filter(function (p) {
      var nombres = [t(p[NM_WA_NAME])].concat(String(p[NM_WA_VAR] || '').split(/\s*[·|;,]\s*/));
      return nombres.some(function (n) { return t(n) && nmz(n) === nmz(nomEnvio); });
    });
    // 🔴 si dos piezas dicen el mismo nombre NO se elige ninguna: eso es un defecto del catálogo
    //    que la guarda de unicidad debe cazar, y taparlo aquí eligiendo «la primera» es cómo se
    //    movieron 186 carritos en Qcart.
    if (c0.length === 1) return { pieza_id: t(c0[0][NM_PIEZA]), via: '0 · Whatsapp_Name (la llave natural)' };
    if (c0.length > 1) return {
      pieza_id: null, via: 'AMBIGUA',
      motivo: 'el nombre «' + nomEnvio.slice(-40) + '» está en ' + c0.length + ' piezas: no se elige ninguna'
    };
  }

  // 1 · campaña + segmento + fecha
  var c1 = mismaCamp.filter(function (p) {
    return segIgual(p['Segmento'], envio.segmento_raw) && envio.fecha && t(p['Fecha_Primer_Envio']) === envio.fecha;
  });
  if (c1.length === 1) return { pieza_id: t(c1[0]['Pieza_ID']), via: '1 · campaña + segmento + fecha' };

  // 🔴 1b · campaña + el ID FINAL DEL JOURNEY — 14-sep-2026, y va ANTES que cualquier escalón
  //    que use `sends` a propósito.
  //
  //    Lo destapó la Jornada 8 de Liga MX. Su hoja («Maggi Liga MX») **no trae columna de
  //    segmento**, así que el escalón 1 no puede correr; y su pieza tiene `Sends = POR DEFINIR`
  //    —precisamente porque nadie se los ha atribuido todavía—, así que 2 y 2b tampoco. Los dos
  //    envíos quedaban SIN PIEZA por un círculo: no se atribuyen porque no tienen envíos, y no
  //    tienen envíos porque no se atribuyen.
  //
  //    🔴 Y el fondo es peor que el caso: **`sends` es una MÉTRICA, y una métrica no identifica**.
  //    Cambia con cada refresh de la fuente. Este sistema ya pagó esa lección en el catálogo, donde
  //    la llave `campaña·mascota·emailId·sends` dejó de casar al limpiar los correos de prueba y
  //    recreó 11 piezas gemelas. Aquí el mismo defecto está latente: 2b acierta hoy porque los
  //    números son específicos, y fallará el día que la fuente corrija un envío.
  //
  //    El id final del journey (`…_V1_065900` → `065900`) es lo contrario: lo asigna SFMC, no
  //    cambia, y el catálogo ya lo guarda. Se exige UNA sola coincidencia dentro de la campaña;
  //    si hubiera dos, el envío baja al siguiente escalón en vez de elegir — que es lo correcto.
  // (NM_PIEZA ahora se declara arriba, con los demás nombres de columna)
  var NM_CID = 'Content_ID (final del Email' + '_Name)';
  var idJourney = (String(envio.journey || '').match(/(\d{4,})\s*$/) || [])[1];
  if (idJourney) {
    var c1b = mismaCamp.filter(function (p) {
      var cid = t(p[NM_CID]);
      return cid && /^\d+$/.test(cid) && Number(cid) === Number(idJourney);
    });
    if (c1b.length === 1) return { pieza_id: t(c1b[0][NM_PIEZA]), via: '1b · campaña + id final del journey (' + idJourney + ')' };
  }

  // 2 · campaña + segmento + sends  (la cifra confirma aunque falte la fecha)
  var c2 = mismaCamp.filter(function (p) {
    return segIgual(p['Segmento'], envio.segmento_raw) && envio.sends !== null && num(p['Sends']) === envio.sends;
  });
  if (c2.length === 1) return { pieza_id: t(c2[0]['Pieza_ID']), via: '2 · campaña + segmento + sends' };

  // 2b · campaña + SENDS, sin exigir segmento.
  // ⚠ Hace falta porque Tercer Tiempo no trae segmento en la fuente y sus dos piezas quedaban
  //   ambiguas —aunque sus sends coinciden EXACTO (1,817 y 3,996)—. Una cifra específica dentro
  //   de la misma campaña identifica sola; y si dos piezas compartieran el número, `length === 1`
  //   falla y el envío se declara ambiguo, que es lo correcto.
  if (envio.sends !== null && envio.sends > 0) {
    var c2b = mismaCamp.filter(function (p) { return num(p['Sends']) === envio.sends; });
    if (c2b.length === 1) return { pieza_id: t(c2b[0]['Pieza_ID']), via: '2b · campaña + sends exactos' };
  }

  // 🔴 2c · campaña + JOURNEY, resuelto por el alias declarado. Es el escalón que faltaba: los dos
  //    envíos de Mundial tienen los MISMOS sends (162), así que la cifra no los desambigua y 2b
  //    devuelve dos candidatas. Lo único que los separa es el journey de la fuente —«Segundo
  //    Partido» y «Tercer Partido»— que el catálogo nombra «Partido 2» y «Partido 3».
  //
  //    El puente NO se adivina por parecido: se pide al alias declarado en `normalizacion.json`.
  //    Deducir «Segundo Partido ≈ Partido 2» acertaría hoy y fallaría el día que aparezca
  //    «Segundo Partido - Repechaje».
  if (t(envio.journey)) {
    var canon = aliasDe('Touchpoint', t(envio.journey), t(envio.campana_raw) || t(envio.hoja));
    if (canon) {
      var c2c = mismaCamp.filter(function (p) { return nmz(TP(p)) === nmz(canon); });
      if (c2c.length === 1) return { pieza_id: t(c2c[0]['Pieza_ID']), via: '2c · campaña + journey (alias declarado: «' + t(envio.journey) + '» → «' + canon + '»)' };
    }
  }

  // 3 · campaña + fecha + touchpoint del utm_content
  var tp = nmz(envio.utm_content).replace(/\s+/g, '');
  var c3 = tp ? mismaCamp.filter(function (p) {
    var ptp = nmz(TP(p)).replace(/\s+/g, '');
    return ptp && (ptp === tp || ptp.indexOf(tp) >= 0 || tp.indexOf(ptp) >= 0) &&
      (!envio.fecha || !t(p['Fecha_Primer_Envio']) || t(p['Fecha_Primer_Envio']) === envio.fecha);
  }) : [];
  if (c3.length === 1) return { pieza_id: t(c3[0]['Pieza_ID']), via: '3 · campaña + touchpoint (+fecha)' };

  // 4 · campaña + segmento, si deja una sola
  var c4 = mismaCamp.filter(function (p) { return segIgual(p['Segmento'], envio.segmento_raw); });
  if (c4.length === 1) return { pieza_id: t(c4[0]['Pieza_ID']), via: '4 · campaña + segmento' };

  // no se fuerza: se declara con sus candidatas
  var cand = (c4.length ? c4 : c3.length ? c3 : mismaCamp).map(function (p) { return t(p['Pieza_ID']); });
  return {
    pieza_id: null,
    via: cand.length > 1 ? 'AMBIGUA' : 'SIN PIEZA',
    candidatas: cand,
    motivo: cand.length > 1
      ? 'la cascada deja ' + cand.length + ' candidatas y ninguna variable más las separa'
      : 'la campaña existe en el catálogo pero ninguna pieza casa con su segmento ni su touchpoint'
  };
}

module.exports = { atribuir: atribuir, segIgual: segIgual, campIgual: campIgual, nmz: nmz, t: t,
  inferenciasHechas: inferenciasHechas, limpiarInferencias: limpiarInferencias };
