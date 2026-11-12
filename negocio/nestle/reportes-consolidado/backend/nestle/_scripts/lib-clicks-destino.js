/*
 * lib-clicks-destino.js — clasifica un link en su DESTINO, leyendo el contrato.
 *
 * 🔴 LOS PATRONES NO VIVEN AQUÍ. Viven en `_contratos/clicks-destinos.json`, que es el diccionario
 *    que Rick pidió el 19-sep-2026: qué es cada tipo de click, qué links lo componen, y a qué
 *    familia pertenece. Esta librería solo lo aplica. Un patrón escrito en código y no en el
 *    contrato es un patrón que nadie puede revisar — y así sobrevivió meses el defecto que originó
 *    todo esto: `claseDe` buscaba `unsub|optout|baja|desuscri` y la URL de baja de Nestlé es
 *    `centro-de-preferencias`, que no matchea ninguno. 1,005 clicks a la baja, 1,009 a
 *    ver-en-navegador y 479 al aviso de privacidad se contaban como CONTENIDO.
 *
 * 🔴 SIN CATCH-ALL, Y ES LA CORRECCIÓN DE FONDO. La versión anterior terminaba en
 *    `if (/^https?:/) return 'web'` — o sea, cualquier URL desconocida se convertía en intención
 *    en silencio. Ahora lo desconocido cae en `por_clasificar` y se declara con sus clicks. Una
 *    URL nueva aparece como pregunta, no como dato.
 *
 * 🔴 EL ORDEN ES EL DEL CONTRATO y gana la PRIMERA clase que matchea. `contenido` va al final a
 *    propósito: es la más amplia y sus dominios (`nestle.com.mx`) contienen el centro de
 *    preferencias y el aviso legal. Si fuera primero se los quedaría — que es justo lo que pasaba.
 */
var fs = require('fs'), os = require('os');
var RUTA = require('path').resolve(__dirname, '..') + '/_contratos/clicks-destinos.json';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var _C = null;
function contrato() {
  if (_C) return _C;
  _C = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  // 🔴 se compilan una vez y se comprueba que cada patrón sea un regex válido: un patrón roto
  //    haría que su clase nunca matcheara y todo su tráfico se fuera a `por_clasificar` sin que
  //    nadie entienda por qué.
  _C.clases.forEach(function (c) {
    c._re = (c.patrones || []).map(function (p) {
      try { return new RegExp(p, 'i'); }
      catch (e) { throw new Error('patrón inválido en la clase ' + c.id + ': ' + p + ' — ' + e.message); }
    });
  });
  return _C;
}

/** La clase de un link. Devuelve el id de la clase, o 'por_clasificar' si ninguna lo reclama. */
function clase(url, nombre) {
  var C = contrato();
  var u = t(url), n = t(nombre);
  var sujeto = u + ' ' + n;
  for (var i = 0; i < C.clases.length; i++) {
    var c = C.clases[i];
    for (var j = 0; j < c._re.length; j++) {
      if (c._re[j].test(sujeto)) return c.id;
    }
  }
  return 'por_clasificar';
}

/** La familia de una clase: intencion · engagement · mecanica · sin_resolver. */
function familia(idClase) {
  var C = contrato();
  var f = null;
  Object.keys(C.familias).forEach(function (k) {
    if ((C.familias[k].clases || []).indexOf(idClase) >= 0) f = k;
  });
  return f || 'sin_resolver';
}

/** Todas las clases declaradas, en su orden de evaluación. */
function clases() { return contrato().clases.map(function (c) { return c.id; }).concat(['por_clasificar']); }

/** Las clases de una familia. */
function clasesDe(fam) { return (contrato().familias[fam] || {}).clases || (fam === 'sin_resolver' ? ['por_clasificar'] : []); }

/** Las familias declaradas. */
function familias() { return Object.keys(contrato().familias); }

/** Lo que el contrato dice de una clase — para que un reporte o un auditor cite la definición. */
function definicion(idClase) {
  if (idClase === 'por_clasificar') {
    return { id: 'por_clasificar', nombre: 'Por clasificar', que_es: (contrato().familias.sin_resolver || {}).que_es || '', patrones: [] };
  }
  return contrato().clases.filter(function (c) { return c.id === idClase; })[0] || null;
}

/**
 * 🔴 SOLAPAMIENTO: ¿dos clases reclaman la misma URL? Es la prueba 3 del contrato.
 *    Devuelve, para una lista de URLs, las que matchean más de una clase — con cuáles.
 *    Dos clases que matchean lo mismo es una llave ambigua: el orden decide, y el orden no
 *    debería ser lo que resuelve una dimensión.
 */
function solapamientos(urls) {
  var C = contrato(), out = [];
  urls.forEach(function (u) {
    var hit = [];
    C.clases.forEach(function (c) {
      for (var j = 0; j < c._re.length; j++) { if (c._re[j].test(t(u))) { hit.push(c.id); return; } }
    });
    if (hit.length > 1) out.push({ url: t(u), clases: hit, gana: hit[0] });
  });
  return out;
}

/* ══ LAS 3 COLUMNAS DEL REPORTE ═══════════════════════════════════════════════════════════════
 * 🔴 ESTE MAPA VIVE AQUÍ Y EN NINGÚN OTRO SITIO. Nació duplicado: `motor.hoja-clicks.js` tenía su
 *    propio `A_COLUMNA` para construir `Data_Clicks`, y el reporte iba a necesitar el mismo mapa
 *    para sus nueve columnas. Dos copias del mismo mapa es exactamente cómo la hoja y el reporte
 *    acaban diciendo cosas distintas del mismo click: alguien mueve `social` de una columna a otra
 *    en un sitio, el otro sigue igual, **las dos sumas siguen cuadrando cada una consigo misma** y
 *    ninguna puerta lo ve. Es la familia de defecto que ya costó `Tot_Unsubs` (2,111 bajas perdidas
 *    por leer un campo que otro paso dejaba obsoleto).
 *
 * 🔴 Y LAS 3 COLUMNAS SON DECISIÓN DE RICK, 19-sep-2026, textual: «son demasiadas columnas,
 *    necesitamos simplificar, y que sea mucho más claro qué es cada una. Fácil: click efectivo a
 *    CTA, clicks baja, hay que definir máximo 3 columnas». Y después: «el ~8% que es ver en
 *    navegador + aviso legal, esto va en redes» → de ahí el nombre largo, que él mismo eligió:
 *    «ponle redes+navegador+legal así lo nombras aunque sea largo».
 *    O sea: el nombre NO es una abreviatura mía de tres clases técnicas — es el rótulo que pidió.
 */
var COL_CTA = 'Clicks_CTA';
var COL_BAJA = 'Clicks_Baja';
var COL_RNL = 'Clicks_Redes+Navegador+Legal';
var SIN_COLUMNA = '(ninguna — se declara aparte)';

var A_COLUMNA = {
  // intención: el click que el negocio quiere. Las 4 clases van juntas a propósito — Rick pidió
  // UNA columna de «click efectivo a CTA», no cuatro columnas de tipos de destino.
  qcart: COL_CTA, retail: COL_CTA, app: COL_CTA, contenido: COL_CTA,
  baja_preferencias: COL_BAJA,
  // 🔴 `social` + `ver_en_navegador` + `legal` en una sola. No es que sean lo mismo: es que Rick
  //    decidió que las tres juntas son «el ruido del pie del correo» y que separarlas no le sirve.
  social: COL_RNL, ver_en_navegador: COL_RNL, legal: COL_RNL,
  // 🔴 `por_clasificar` NO cae en ninguna columna. Si cayera en una, un destino desconocido se
  //    volvería una afirmación; y si cayera en CTA, se volvería intención inventada. Se declara.
  por_clasificar: SIN_COLUMNA
};

/* Devuelve la columna del reporte de una clase. **Truena si la clase no está mapeada** en vez de
 * devolver '' — una clase nueva en el contrato sin columna declarada tiene que detener a quien la
 * use, no caer callada en el vacío (L2: un cero no es un vacío). */
function columnaDe(claseId) {
  var c = A_COLUMNA[t(claseId)];
  if (!c) throw new Error('clase de click sin columna declarada en lib-clicks-destino: "' + claseId + '"');
  return c;
}
/* true si esa clase sí llega a una columna del reporte. */
function tieneColumna(claseId) { return columnaDe(claseId) !== SIN_COLUMNA; }
/* Las 3 columnas de DESTINO — el dominio de `repartir()`. Una clase de click cae en una de estas. */
function columnas() { return [COL_CTA, COL_BAJA, COL_RNL]; }

/* 🔴 LA CUARTA COLUMNA: EL TOTAL CON EL QUE EL DESGLOSE SÍ SE COMPARA (24-sep-2026).
 *    Rick: «el total de clicks no puede ser menor que alguno de los desgloses». No se cumplía, y
 *    la causa no era la atribución: `*_Clicks` son únicos POR CORREO y el desglose suma clicks
 *    POR LINK. Son dos preguntas distintas y ninguna está mal — están mal COMPARADAS.
 *
 *    `Clicks_Medidos` es la suma del propio desglose, así que la regla se cumple POR CONSTRUCCIÓN
 *    y no por suerte del dato de este corte. `*_Clicks` no se toca: sostiene CTOR y Click_Rate, y
 *    moverlo cambiaría métricas que el cliente ya vio.
 *
 *    NO entra en `columnas()` a propósito: no es un destino, es su total. Meterla ahí haría que
 *    `repartir()` buscara una clase de click llamada «medidos» y tronara. */
var COL_MEDIDOS = 'Clicks_Medidos';
function columnasReporte() { return [COL_CTA, COL_BAJA, COL_RNL, COL_MEDIDOS]; }
/* la suma del desglose de un bloque — un solo lugar que lo define */
function totalMedido(desglose) {
  return columnas().reduce(function (a, k) { return a + (Number((desglose || {})[k]) || 0); }, 0);
}
/* Los 3 bloques del reporte × las 4 columnas = los 12 encabezados, en orden.
 * `Clicks_Medidos` va al final de su bloque, justo después de los tres destinos que suma. */
function encabezados() {
  var out = [];
  ['Principal_', 'FUP_', 'Tot_'].forEach(function (b) {
    columnasReporte().forEach(function (c) { out.push(b + c); });
  });
  return out;
}
/* Reparte un `por_destino` ({clase: clicks}) en las 3 columnas. Lo que no tiene columna se
 * devuelve aparte en `fuera`, nunca sumado a una columna. */
function repartir(porDestino) {
  var r = {}; columnas().forEach(function (c) { r[c] = 0; });
  var fuera = 0;
  Object.keys(porDestino || {}).forEach(function (k) {
    var n = Number(porDestino[k]) || 0;
    var c = columnaDe(k);
    if (c === SIN_COLUMNA) fuera += n; else r[c] += n;
  });
  r.fuera = fuera;
  return r;
}

module.exports = {
  clase: clase, familia: familia, clases: clases, clasesDe: clasesDe,
  familias: familias, definicion: definicion, solapamientos: solapamientos, contrato: contrato, RUTA: RUTA,
  columnaDe: columnaDe, tieneColumna: tieneColumna, columnas: columnas, encabezados: encabezados,
  repartir: repartir, COL_CTA: COL_CTA, COL_BAJA: COL_BAJA, COL_RNL: COL_RNL, SIN_COLUMNA: SIN_COLUMNA,
  COL_MEDIDOS: COL_MEDIDOS, columnasReporte: columnasReporte, totalMedido: totalMedido
};
