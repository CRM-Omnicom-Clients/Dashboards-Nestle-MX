// lib-whatsapp.js — lee la fuente de WhatsApp y devuelve un envío por fila, normalizado.
//
// 🔴 UNA HOJA NO ES UNA TABLA. Ese fue el defecto que costó más caro (DEF-WA-005): el lector
//    buscaba UN encabezado por hoja y leía todo lo de abajo con él. Pero las hojas traen tablas
//    APILADAS con encabezados distintos, y las de abajo se leían corridas. Probado en `Maggi`:
//
//      encabezado f1 : SEGMENTO │ Journey │ utm_content │ url │ Fecha │ #AUD… │ ENVÍOS │ ENTREGAS
//      fila       f9 : Envíos Tercer partido │ 46199 │ │ 162 │ 162 │ 1 │ 125 │ 0.77 │ 94 │ 30
//                      ↑ su encabezado real es otro (f8), y con el de arriba «ENVÍOS» cae en 94,
//                        que es la columna `Read`. Los 162 envíos reales se perdían.
//
//    Además entraron como envíos una tabla de LINKS (sin una sola métrica) y seis filas de
//    SESIONES DE GOOGLE ANALYTICS (`Session source … Sessions`), porque la columna 9 del
//    encabezado equivocado decía «Envíos».
//
// El lector de ahora hace tres cosas, en este orden, y ninguna adivina:
//    1. parte cada hoja en BLOQUES separados por filas vacías;
//    2. a cada bloque le busca SU encabezado, y solo carga el que tenga columna de envíos —
//       una tabla sin métrica de envío se DECLARA y se descarta, no se lee a la fuerza;
//    3. una fila necesita al menos UNA métrica para ser un envío: fecha y segmento solos son
//       un plan, no un resultado.
//
// Añadir una hoja nueva sigue siendo añadir sinónimos, nunca un parser.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');

function t(v) { return String(v == null ? '' : v).trim(); }
// una sola normalizadora de ENCABEZADOS para todos los lectores: cinco copias idénticas hoy
// son cinco copias divergentes mañana. (No es `lib-alias.nm`, que resuelve DIMENSIONES y sí
//  quita los separadores — son trabajos distintos, y confundirlos ya costó un defecto.)
var nmz = require(__dirname + '/lib-flexible.js').nmEncabezado;
// la nomenclatura del Whatsapp_Name — ya existía para nombrar piezas; aquí nombra envíos
var WN = require(__dirname + '/lib-whatsapp-nombre.js');
function num(v) {
  if (v === null || v === undefined || t(v) === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var n = Number(t(v).replace(/[, %$]/g, ''));
  return isFinite(n) ? n : null;
}
function isoFecha(v) {
  if (v === null || v === undefined || t(v) === '') return null;
  if (typeof v === 'number' && v > 40000 && v < 60000) return new Date(Date.UTC(1899, 11, 30 + v)).toISOString().slice(0, 10);
  var s = t(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s);            // d/m/aaaa o d/m/aa
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  var n = num(s);
  if (n && n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
  return null;
}

// ── el diccionario: cada campo del contrato y cómo lo llama cada hoja ────────────────
// Se busca por SINÓNIMO normalizado y por IGUALDAD EXACTA — «total sent» no debe casar con
// «total sent rate», que es un porcentaje.
var CAMPOS = {
  segmento_raw: ['segmento', 'segmentos', 'segment'],
  journey: ['journey', 'journey name', 'nombre journey'],
  utm_content: ['utm_content', 'utms', 'utm'],
  url: ['url completa', 'urls', 'url'],
  fecha: ['fecha de envio', 'fecha envio', 'date', 'fecha'],
  aud_original: ['#audiencia original', 'audiencia original', 'total mgsc / data extension', 'total mgsc'],
  aud_filtros: ['#audiencia filtros 1', 'audiencia filtros', 'audiencia filtros 1'],
  aud_final: ['#audiencia final', 'audiencia final'],
  sends: ['envios', 'envios totales', 'total sent'],
  deliveries: ['entregas', 'entregados', 'total received', 'total recibidos'],
  // 🔴 14-sep-2026 · `undelivered` A SECAS. La hoja nueva «Maggi Liga MX» nombra la columna
  //    **`Undelivered`**, mientras Tercer Tiempo la llama `ERROR Undelivered`. El emparejamiento es
  //    EXACTO —no por substring—, así que la de Liga MX no casaba con ningún sinónimo y sus
  //    **346 mensajes no entregados** (139 + 207) se perdían en silencio: el campo salía `null` y
  //    `null` se lee como «no hubo». Agregar el sinónimo no puede morder a las otras hojas
  //    justamente porque la coincidencia es exacta: `ERROR Undelivered` sigue casando con el suyo.
  //    Es el mismo defecto que ya pagamos con `Errores`/`Failed`: cada hoja de esta fuente la
  //    arma un equipo distinto y nombra las columnas a su manera.
  no_entregados: ['no entregados', 'undelivered error', 'error undelivered', 'undelivered'],
  errores: ['errores', 'failed'],
  // 🔴 20-sep-2026 · `Delivery Unknown` — el mensaje que ni se confirmó entregado ni falló. Tres de
  //    las cinco hojas la traen y no se estaba leyendo. En Tercer Tiempo es la pieza que faltaba
  //    para reproducir el `%Unsend rate` que la propia hoja publica.
  delivery_unknown: ['delivery unknown'],
  // la tasa de no-entrega que algunas hojas ya publican: sirve para COMPROBAR lo que derivamos
  pct_unsend: ['%unsend rate', '%error'],
  opens_read: ['opens', 'leidos', 'read'],
  clicks: ['clicks', 'clics'],
  bu: ['bu'],
  marca: ['marca', 'brand'],
  campana_raw: ['campana', 'campaign'],
  objetivo: ['objetivo']
};

/** localiza el índice de columna de un campo, por sinónimos */
function idx(cols, campo) {
  var syn = CAMPOS[campo] || [];
  for (var s = 0; s < syn.length; s++) {
    for (var k = 0; k < cols.length; k++) if (cols[k] === syn[s]) return k;
  }
  return -1;
}

// ── los clicks derivados ────────────────────────────────────────────────────────────
// Si la hoja trae «Clicks pesimista/realistas/optimistas», el número NO es una medición:
// es `Read × un CTOR asumido`. Se comprueba con el propio dato en vez de confiar en el nombre.
function clicksDeLaHoja(fila, cols, read) {
  var iC = idx(cols, 'clicks');
  if (iC >= 0) return { clicks: num(fila[iC]), medidos: 'Sí', nota: null };

  var iPes = cols.indexOf('clicks pesimista'), iRea = cols.indexOf('clicks realistas');
  if (iPes < 0 && iRea < 0) return { clicks: null, medidos: 'No', nota: 'la hoja no trae columna de clicks' };

  var pes = num(fila[iPes]), rea = num(fila[iRea]);
  var factor = (read && rea !== null) ? +(rea / read).toFixed(4) : null;
  return {
    clicks: null,                                    // 🔴 NO se carga un supuesto como dato
    medidos: 'No',
    nota: 'la fuente DERIVA los clicks: Read × CTOR asumido' +
      (factor !== null ? ' (aquí ×' + factor + ')' : '') +
      '. No se carga como medición; el estimado lo hace motor-calculo si lo necesita.',
    derivado_pesimista: pes, derivado_realista: rea
  };
}

// ── segmentar una hoja en tablas ────────────────────────────────────────────────────
// Un BLOQUE es una racha de filas con contenido, separada de la siguiente por filas vacías.
// Es el separador que usa quien llena estas hojas a mano, y el único que no depende de
// reconocer nombres de columna — que es justo lo que cambia entre tablas.
function bloquesDe(M) {
  var out = [], actual = null;
  M.forEach(function (f, i) {
    var vacia = !f.some(function (c) { return t(c) !== ''; });
    if (vacia) { actual = null; return; }
    if (!actual) { actual = { desde: i, filas: [] }; out.push(actual); }
    actual.filas.push({ i: i, f: f });
  });
  return out;
}

/** dentro de un bloque, su encabezado es la fila que más campos del contrato reconoce */
function encabezadoDe(bloque) {
  var mejor = { pts: 0, k: -1 };
  bloque.filas.forEach(function (r, k) {
    var c = r.f.map(nmz);
    var p = Object.keys(CAMPOS).filter(function (campo) { return idx(c, campo) >= 0; }).length;
    if (p > mejor.pts) mejor = { pts: p, k: k };
  });
  return mejor;
}

/* ══ CONCILIAR ENTREGADOS Y NO ENTREGADOS — 20-sep-2026 ═══════════════════════════════════════
 * 🔴 LO PIDIÓ RICK: «de 008-P007 entregados no puede ser lo mismo que envíos. Corrige ese tipo de
 *    incongruencias desde la fuente». Tenía razón: Tercer Tiempo declara `Total Sent` 1,817 y
 *    `Total Received` 1,817 **y al mismo tiempo** 183 `ERROR Undelivered`. Las dos cosas no pueden
 *    ser ciertas. Antes se copiaban las dos tal cual y el reporte mostraba «100% de entrega» junto
 *    a «10.1% de no entrega».
 *
 * 🔴 LA REGLA, UNA SOLA Y SIN CASOS ESPECIALES. `Envíos` es el ancla: es la única columna que las
 *    cinco hojas traen y que ninguna se contradice. Entonces el hueco `envíos − entregados` tiene
 *    que caber entre los fallos que la hoja declara:
 *
 *        max(fallos)  ≤  envíos − entregados  ≤  Σ(fallos)
 *
 *    · Si cabe → la hoja es coherente: se respeta SU `entregados` y `no entregados = el hueco`.
 *      (ICE: 2000−1599=401=Undelivered ✔ · Liga MX: 985−835=150=139+11 ✔ · Hotcakes: 312−226=86 ✔)
 *    · Si no cabe → la hoja se contradice: se deriva `no entregados = Σ(fallos)` y
 *      `entregados = envíos − no entregados`. Nunca al revés, porque el dato roto es el entregado.
 *
 * 🔴 Y NO ES UNA FÓRMULA INVENTADA: en Tercer Tiempo lo derivado REPRODUCE EL `%Unsend rate` QUE LA
 *    PROPIA HOJA PUBLICA — 186/1,817 = 0.10236653824986242, el valor exacto de su celda. Ahí está
 *    la prueba de que 183+3 es lo que esa hoja entiende por «no entregado», no una elección mía.
 *
 * 🔴 UN ENTREGADO ES UN MENSAJE: NO PUEDE SER FRACCIONARIO. `Semifinal A` traía 1,525.37 porque la
 *    hoja aplicó un porcentaje en vez de contar. Se redondea y el complemento absorbe la diferencia,
 *    para que `entregados + no entregados = envíos` siga siendo exacto.
 *
 * ⚠ NO SE TOCA LA FUENTE. El archivo es de Leslie y se lee en solo lectura; esto corrige lo que
 *   NUESTRO sistema publica, y deja escrito en cada envío qué decía la hoja (`entregados_hoja`).
 */
function conciliarEntregas(fila, cols, sends, deliveries) {
  function v(campo) { var i = idx(cols, campo); return i >= 0 ? num(fila[i]) : null; }
  var declarados = [];
  ['no_entregados', 'errores', 'delivery_unknown'].forEach(function (c) {
    var x = v(c); if (x !== null && x > 0) declarados.push({ campo: c, valor: x });
  });
  var suma = declarados.reduce(function (a, d) { return a + d.valor; }, 0);
  var mayor = declarados.reduce(function (a, d) { return Math.max(a, d.valor); }, 0);
  var unknown = v('delivery_unknown');

  if (sends === null) {
    return { entregados: deliveries, no_entregados: v('no_entregados'), coherente: null, unknown: unknown,
      nota: 'sin envíos declarados: no se puede conciliar' };
  }
  var hueco = deliveries === null ? null : sends - deliveries;
  var cabe = hueco !== null && hueco >= -0.5 && hueco >= mayor - 0.5 && hueco <= suma + 0.5;

  // sin ningún fallo declarado, el hueco ES la no entrega (Maggi Mundial ya la trae calculada)
  if (!declarados.length && hueco !== null && hueco >= -0.5) cabe = true;

  var ent, noEnt, nota = null, coherente = true;
  if (cabe) {
    ent = deliveries; noEnt = hueco;
  } else {
    coherente = false;
    noEnt = suma;
    ent = sends - noEnt;
    nota = 'la hoja se contradice: dice ' + deliveries + ' entregados de ' + sends + ' envíos (hueco ' +
      hueco + ') pero declara ' + suma + ' fallo(s) [' + declarados.map(function (d) { return d.campo + ' ' + d.valor; }).join(' + ') +
      ']. Se deriva entregados = envíos − fallos = ' + ent + '.';
  }
  // el redondeo, al final y por el mismo sitio en los dos caminos
  if (ent !== null) {
    var entR = Math.round(ent);
    if (entR !== ent) nota = (nota ? nota + ' · ' : '') + 'entregados venía fraccionario (' + ent + '): un mensaje no se entrega a medias, se redondea a ' + entR + '.';
    ent = entR;
    noEnt = sends - ent;
  }
  // la comprobación contra la tasa que la hoja publica, cuando existe
  var pct = v('pct_unsend');
  if (pct !== null && sends > 0 && noEnt !== null) {
    var esperado = pct > 1 ? pct / 100 : pct;
    var obtenido = noEnt / sends;
    nota = (nota ? nota + ' · ' : '') + (Math.abs(esperado - obtenido) < 0.0005
      ? '✔ reproduce el %unsend que publica la hoja (' + obtenido.toFixed(6) + ')'
      : '⚠ NO reproduce el %unsend de la hoja: ella dice ' + esperado.toFixed(6) + ' y esto da ' + obtenido.toFixed(6));
  }
  return { entregados: ent, no_entregados: noEnt, coherente: coherente, unknown: unknown, nota: nota };
}

/* 🔴 22-sep-2026 · `totales?` significaba «totale» + s opcional: casaba «Totales» pero NUNCA
 *    «TOTAL». La hoja «Maggi Liga MX» rotula sus sumas en singular, así que sus filas de total
 *    no se reconocían como subtotal. El defecto estaba LATENTE —ese bloque se descartaba entero
 *    por no traer encabezado— y salió a la luz al enseñar al lector a leer continuaciones: la
 *    fila TOTAL entró como si fuera un envío de 1,962. El cuantificador va sobre «es», no sobre «e». */
var ETIQ_TOTAL = /^(total(es)?|total general|suma|gran total)$/i;

/**
 * Lee la fuente completa y devuelve un envío por fila, normalizado al contrato.
 *
 * ⚠ `opts.sinSolapes` deja los solapes y el conteo de «sin fecha» SIN resolver, para que quien
 *   llama pueda ENRIQUECER primero y resolver después. Importa por el orden: el desempate de un
 *   solape usa la fecha, y si las fechas derivadas llegan después, desempata con menos
 *   información de la que ya existía. Hoy no cambia el resultado; es la clase de trampa que
 *   muerde el día que dos tablas empatan y solo una tiene fecha derivada.
 */
function leer(ruta, opts) {
  opts = opts || {};
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_wa_lib.xlsx';
  fs.copyFileSync(ruta, tmp);                        // rutas con acentos: siempre por copia ASCII
  var wb = XLSX.readFile(tmp);
  var out = {
    archivo: path.basename(ruta), hojas: [], envios: [], avisos: [],
    subtotales: [], tablas: [], tablas_descartadas: [], solapes: []
  };

  wb.SheetNames.forEach(function (hoja) {
    var M = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: '' });
    if (!M.length) { out.hojas.push({ hoja: hoja, filas: 0, nota: 'vacía' }); return; }

    var bloques = bloquesDe(M);
    var nHoja = 0, tablasHoja = 0;
    /* la última tabla de ENVÍOS leída en ESTA hoja — para poder reconocer un bloque que la
       continúa. Se reinicia con cada hoja: nunca se cruza el encabezado de una hoja a otra. */
    var ultimaTabla = null;

    bloques.forEach(function (bloque) {
      var enc = encabezadoDe(bloque);
      var cols, datos, filaEnc, continuacionDe = null;

      if (enc.k < 0 || enc.pts < 2) {
        /* 🔴 UN BLOQUE SIN ENCABEZADO PUEDE SER LA CONTINUACIÓN DEL ANTERIOR — 22-sep-2026.
         *    `bloquesDe` parte por filas VACÍAS, así que cuando la fuente escribe su total, unas
         *    tasas sueltas y una etiqueta («J9») antes de seguir con más envíos, todo eso cae en
         *    un bloque nuevo que no repite el encabezado. La regla anterior lo descartaba entero
         *    y **así se perdió la Jornada 9 completa: 2 envíos, 2,560 sends.** El lector lo
         *    declaraba en `tablas_descartadas` —no fue silencioso— pero nadie lo leyó.
         *
         * 🔴 NO SE AFLOJA LA REGLA, SE ACOTA. Sigue prohibido leer un bloque con el encabezado
         *    de OTRA tabla. Lo que se permite es continuar la MISMA tabla de la MISMA hoja, y
         *    solo con las filas que por sí solas se comportan como un envío:
         *      · la columna del journey trae texto (una etiqueta suelta como «J9» no la llena)
         *      · la columna de envíos trae un número > 0 (las filas de CTR/CTOR no)
         *      · no es una fila de TOTAL (la guarda de subtotales la sigue atrapando después)
         *    Si ninguna fila pasa, se descarta igual que antes. */
        /* 🔴 EL FILTRO EXIGE LAS TRES COLUMNAS QUE DEFINEN UN ENVÍO, NO DOS.
         *    Con solo `journey` + `sends` se coló la tabla de SESIONES DE GOOGLE ANALYTICS que
         *    «Maggi Mundial» trae al pie: leída con el encabezado de envíos, su `Session source`
         *    caía en la columna del journey y sus `Sessions` en la de envíos — 6 «envíos» de 43
         *    sends. Es exactamente lo que la regla original protegía.
         *    `deliveries` es la que las separa: un envío siempre declara cuántos llegaron; una
         *    fila de sesiones no tiene ese concepto. */
        var cont = ultimaTabla ? bloque.filas.filter(function (r) {
          var jj = idx(ultimaTabla.cols, 'journey'), ss = idx(ultimaTabla.cols, 'sends'), dd = idx(ultimaTabla.cols, 'deliveries');
          if (jj < 0 || ss < 0 || dd < 0) return false;
          if (!t(r.f[jj])) return false;
          if (ETIQ_TOTAL.test(t(r.f[jj]))) return false;
          return num(r.f[ss]) > 0 && t(r.f[dd]) !== '';
        }) : [];

        if (!cont.length) {
          out.tablas_descartadas.push({
            hoja: hoja, desde_fila: bloque.desde + 1, filas: bloque.filas.length,
            primera_fila: bloque.filas[0].f.filter(function (c) { return t(c); }).slice(0, 4).map(function (c) { return t(c).slice(0, 40); }),
            motivo: 'sin encabezado reconocible (' + enc.pts + ' campos del contrato): no se lee con el encabezado de otra tabla'
          });
          return;
        }
        cols = ultimaTabla.cols;
        datos = cont;
        filaEnc = ultimaTabla.filaEnc;
        continuacionDe = ultimaTabla.filaEnc;
        /* 🔴 SE DECLARA COMO AVISO, no en un campo propio. Mi primera versión lo guardaba en
         *    `out.continuaciones` y el escritor del bloque no copia ese campo: la continuación
         *    quedaba SILENCIOSA, que es justo lo que no puede pasar — leer filas con el
         *    encabezado de otro bloque es una licencia, y una licencia que nadie ve es un
         *    agujero. Los avisos sí viajan al handoff. */
        out.avisos.push({
          tipo: 'tabla_continuada', hoja: hoja, desde_fila: bloque.desde + 1,
          encabezado_en_fila: ultimaTabla.filaEnc,
          cuantas: cont.length,
          detalle: 'el bloque de la fila ' + (bloque.desde + 1) + ' no repite el encabezado, pero ' +
            cont.length + ' de sus ' + bloque.filas.length + ' filas traen journey, envíos > 0 y entregados: ' +
            'se leen como continuación de la tabla que empieza en la fila ' + ultimaTabla.filaEnc + '.'
        });
      } else {
        cols = bloque.filas[enc.k].f.map(nmz);
        datos = bloque.filas.slice(enc.k + 1);
        filaEnc = bloque.filas[enc.k].i + 1;
      }

      // 🔴 una tabla solo se carga si mide ENVÍOS. Sin esa columna no es un reporte de resultados:
      //    es un calendario, una tabla de links o —esto pasó— sesiones de Google Analytics.
      //    Descartar por lo que la tabla NO tiene es seguro; adivinar por posición no lo es.
      if (idx(cols, 'sends') < 0) {
        // ⚠ se descarta para CARGAR, no para saber. La tabla-calendario de `Maggi Mundial` no
        //   mide envíos, pero sí dice en qué fecha salió cada partido — y es la única fuente
        //   independiente contra la que se puede cruzar una fecha derivada del doc de links.
        //   Tirar sus filas dejaba esa comprobación sin nada con qué hacerse.
        out.tablas_descartadas.push({
          hoja: hoja, desde_fila: filaEnc, filas: datos.length,
          encabezado: cols.filter(Boolean).slice(0, 10),
          cols: cols,
          tiene_fecha: idx(cols, 'fecha') >= 0,
          filas_datos: datos.map(function (r) { return { fila: r.i + 1, celdas: r.f.map(t) }; }),
          motivo: 'no trae columna de envíos: no es una tabla de resultados de envío'
        });
        return;
      }

      tablasHoja++;
      /* queda como referencia para un posible bloque de continuación. Solo se guarda una tabla
         que YA pasó el filtro de «mide envíos»: así una continuación nunca hereda el encabezado
         de un calendario ni de una tabla de sesiones de GA. */
      if (!continuacionDe) ultimaTabla = { cols: cols, filaEnc: filaEnc };
      var sinMapear = cols.filter(function (c, k) {
        if (!c || /^__empty/.test(c)) return false;
        return !Object.keys(CAMPOS).some(function (campo) { return idx(cols, campo) === k; });
      });
      var tieneFecha = idx(cols, 'fecha') >= 0;

      var n = 0, acumulado = 0, sinMetrica = 0;
      datos.forEach(function (r) {
        var f = r.f, filaN = r.i + 1;
        var sends = num(f[idx(cols, 'sends')]);
        var read = num(f[idx(cols, 'opens_read')]);
        var deliveries = num(f[idx(cols, 'deliveries')]);
        var audOrig = num(f[idx(cols, 'aud_original')]);
        var fecha = isoFecha(f[idx(cols, 'fecha')]);

        // ⚠ la etiqueta «Totales» no vive en la misma columna en todas las hojas. Se busca en
        //   CUALQUIER celda, y se CONFIRMA con la aritmética: si no cuadra con la suma de las
        //   de arriba no se descarta en silencio — se declara, porque entonces es otra cosa.
        var etiqueta = '';
        for (var c2 = 0; c2 < f.length && !etiqueta; c2++) if (ETIQ_TOTAL.test(t(f[c2]))) etiqueta = t(f[c2]);
        if (etiqueta) {
          var cuadra = sends !== null && Math.abs(sends - acumulado) < 1;
          out.subtotales.push({
            hoja: hoja, fila: filaN, etiqueta: etiqueta, sends_de_la_fila: sends,
            suma_de_las_de_arriba: acumulado, cuadra: cuadra,
            motivo: cuadra
              ? 'fila de SUBTOTAL: repite la suma de las de arriba. Cargarla duplicaría la tabla.'
              : '⚠ etiquetada «' + etiqueta + '» pero NO cuadra con la suma (' + sends + ' vs ' + acumulado + '): mirarla, no es un subtotal limpio'
          });
          return;
        }
        if (sends !== null) acumulado += sends;

        // 🔴 una fila necesita al menos UNA métrica para ser un envío. Con fecha y segmento pero
        //    sin una sola cifra, lo que hay es un PLAN (qué se iba a mandar), no un resultado.
        if (sends === null && read === null && deliveries === null && audOrig === null) {
          if (f.some(function (c) { return t(c); })) sinMetrica++;
          return;
        }

        var cl = clicksDeLaHoja(f, cols, read);
        var EN = conciliarEntregas(f, cols, sends, deliveries);
        function g(campo) { var i = idx(cols, campo); return i >= 0 ? t(f[i]) : ''; }
        /* 🔴 EL NOMBRE DEL ENVÍO ES UN HECHO DEL ENVÍO, y por eso nace AQUÍ (22-sep-2026).
         *
         *    `Whatsapp_Name` es la llave declarada de la entidad `envio_whatsapp` en
         *    `esquema.json`, y estaba **vacía en las 14 filas** de `Data_WhatsApp`: la columna
         *    existía y nadie la llenaba. Eso hizo que los dos envíos de WA-J8 parecieran
         *    indistinguibles —mismo Pieza_ID, misma fecha, mismo segmento, solo cambiaban los
         *    números— cuando la fuente SÍ los distingue perfectamente: uno salió a las 4PM y otro
         *    a las 5PM, y lo dice su journey. No era una fuente ambigua: era una llave sin cargar.
         *
         * 🔴 SE USA `lib-whatsapp-nombre`, NO UNA REGLA NUEVA. Ya existía, con sus tres niveles
         *    medidos sobre el archivo del cliente: journey real tal cual (Liga MX, Tercer Tiempo,
         *    ICE) · construido desde la etiqueta (Mundial) · construido desde utm+segmento
         *    (Hotcakes, que no trae journey). Y un nombre construido empieza por `WA-`, así que
         *    nunca se confunde con uno que la fuente publique. La usaba el catálogo para nombrar
         *    PIEZAS; aquí nombra ENVÍOS, que es el grano de esta entidad. */
        var _nom = WN.nombrar(
          { campana: g('campana_raw') || hoja, touchpoint: '', segmento: g('segmento_raw') },
          [g('journey')],
          { utm_content: g('utm_content') }
        );
        out.envios.push({
          whatsapp_name: _nom.nombre, nombre_nivel: _nom.nivel, nombre_via: _nom.via,
          hoja: hoja, fila_en_hoja: filaN, encabezado_en_fila: filaEnc,
          bu: g('bu'), marca: g('marca'),
          campana_raw: g('campana_raw') || hoja,      // si la tabla no la trae, la hoja ES la campaña
          objetivo: g('objetivo'),
          segmento_raw: g('segmento_raw'),
          journey: g('journey'), utm_content: g('utm_content'), url: g('url'),
          canal: 'WhatsApp', fecha: fecha,
          fecha_ausente_motivo: fecha ? null : (tieneFecha ? 'la tabla tiene columna de fecha y esta fila la trae vacía' : 'la tabla NO tiene columna de fecha'),
          sends: sends, deliveries: EN.entregados, entregados_hoja: deliveries,
          no_entregados: EN.no_entregados,
          entrega_coherente: EN.coherente, entrega_nota: EN.nota,
          delivery_unknown: EN.unknown,
          errores: num(f[idx(cols, 'errores')]),
          opens_read: read,
          clicks: cl.clicks, clicks_medidos: cl.medidos, clicks_nota: cl.nota,
          clicks_derivado_realista: cl.derivado_realista === undefined ? null : cl.derivado_realista,
          aud_original: audOrig,
          aud_filtros: num(f[idx(cols, 'aud_filtros')]),
          aud_final: num(f[idx(cols, 'aud_final')]),
          fuente: path.basename(ruta)
        });
        n++;
      });

      out.tablas.push({
        hoja: hoja, encabezado_en_fila: filaEnc, envios: n, acumulado: acumulado,
        tiene_columna_de_fecha: tieneFecha,
        filas_sin_ninguna_metrica: sinMetrica,
        columnas_sin_mapear: sinMapear
      });
      if (sinMetrica) {
        out.avisos.push({
          tipo: 'filas_sin_metrica', hoja: hoja, encabezado_en_fila: filaEnc, cuantas: sinMetrica,
          detalle: sinMetrica + ' fila(s) con dimensiones pero sin ninguna cifra: son un plan, no un resultado. No se cargaron.'
        });
      }
      if (!tieneFecha && n) {
        out.avisos.push({
          tipo: 'tabla_sin_fecha', hoja: hoja, encabezado_en_fila: filaEnc, cuantas: n,
          detalle: '🔴 esta tabla NO trae columna de fecha: sus ' + n + ' envíos no se pueden ubicar en ningún periodo (mes, quincena o semana).'
        });
      }
      nHoja += n;
    });

    /* 🔴 20-sep-2026 · UNA HOJA EN CERO TIENE QUE DECIR POR QUÉ, y la razón se DERIVA de lo que se
     *    encontró — no de una lista de hojas permitidas. Apareció `BAU 2025 Nescafé` (el equipo la
     *    agregó a la fuente ese mismo día) y el guardián se puso rojo con toda la razón: una hoja
     *    leída que no aporta ni un envío es, por defecto, un envío perdido.
     *    Una lista blanca de nombres la habría callado para siempre, incluida la hoja futura que sí
     *    traiga envíos y se lea mal. Aquí se escribe la EVIDENCIA: cuántos bloques hubo, cuántas
     *    tablas de envíos se reconocieron y por qué se descartó cada bloque. Si mañana una hoja con
     *    envíos se lee mal, su razón dirá «0 tablas reconocidas» y eso es una pregunta, no un
     *    permiso — que es justo lo que queremos que pase. */
    var motivoCero = null;
    if (nHoja === 0) {
      var desc = (out.tablas_descartadas || []).filter(function (x) { return x.hoja === hoja; });
      motivoCero = tablasHoja === 0
        ? 'ninguno de sus ' + bloques.length + ' bloque(s) es una tabla de envíos: no traen las columnas que identifican un envío' +
          (desc.length ? ' — descartados: ' + desc.map(function (d) { return 'fila ' + d.desde_fila + ' (' + t(d.motivo).slice(0, 60) + ')'; }).join(' · ') : '')
        : 'tiene ' + tablasHoja + ' tabla(s) de envíos pero ninguna fila con métricas (solo plan o subtotales)';
    }
    out.hojas.push({ hoja: hoja, bloques: bloques.length, tablas_de_envios: tablasHoja, envios: nHoja, motivo_cero: motivoCero });
    if (motivoCero) {
      out.avisos.push({
        tipo: 'hoja_sin_envios', hoja: hoja,
        detalle: '⚠ la hoja «' + hoja + '» no aportó ningún envío: ' + motivoCero +
          '. Si debería aportarlos, es un defecto del lector, no de la fuente.'
      });
    }
  });

  if (opts.sinSolapes) return out;               // los resuelve quien llama, ya enriquecido
  // ⚠ el orden importa: los solapes se quitan ANTES de contar los que no tienen fecha. Al revés,
  //   el aviso denuncia envíos que después se excluyen — y un aviso que sobra-cuenta se ignora.
  marcarSolapes(out);
  var sinFecha = out.envios.filter(function (e) { return !e.fecha; });
  if (sinFecha.length) {
    out.avisos.push({
      tipo: 'envios_sin_fecha', cuantas: sinFecha.length,
      detalle: '🔴 ' + sinFecha.length + ' de ' + out.envios.length + ' envíos no tienen fecha: no se pueden ubicar en ningún periodo. Todo reporte pivota por periodo, así que se caerían en silencio.',
      filas: sinFecha.map(function (e) { return e.hoja + '!' + e.fila_en_hoja + ' · ' + (e.fecha_ausente_motivo || ''); })
    });
  }
  return out;
}

// ── el mismo envío contado dos veces en dos tablas ──────────────────────────────────
// 🔴 `Maggi` y `Maggi Mundial` describen la MISMA campaña: una por journey y la otra
//    resumida. Cargar las dos duplica. Y no se detecta por el nombre —«Maggi» vs «Mundial»
//    son campañas distintas para cualquier llave— sino por ARITMÉTICA sobre dos métricas
//    independientes a la vez, que es lo que no coincide por casualidad:
//
//      Maggi Mundial f6 «Finales»  = 1965 envíos · 1520 entregas · 917 leídos
//      Maggi f15 + f16             = 982+983    · 749+771       · 440+477   → idéntico
//
// Regla, declarada y reversible: **gana la tabla que lo trae DESAGREGADO**. Un detalle
// siempre se puede volver a sumar; un resumen no se puede volver a partir. Si empatan en
// desagregación, gana el que trae fecha — el otro dice lo mismo y no se puede ubicar.
// Lo excluido NO se borra: queda listado con la aritmética que lo prueba.
function casi(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  return Math.abs(a - b) < 1;
}
function marcarSolapes(out) {
  var E = out.envios;
  var fuera = {};

  // 1 · un envío que es la SUMA de varios de otra tabla → el agregado sobra
  E.forEach(function (a, i) {
    if (fuera[i] || !a.sends) return;
    var otros = E.map(function (b, j) { return { b: b, j: j }; })
      .filter(function (x) { return x.j !== i && !fuera[x.j] && x.b.hoja !== a.hoja && x.b.sends; });
    for (var p = 0; p < otros.length; p++) for (var q = p + 1; q < otros.length; q++) {
      var x = otros[p].b, y = otros[q].b;
      if (x.hoja !== y.hoja) continue;
      if (casi(x.sends + y.sends, a.sends) && casi((x.deliveries || 0) + (y.deliveries || 0), a.deliveries) &&
        casi((x.opens_read || 0) + (y.opens_read || 0), a.opens_read)) {
        var prueba = 'sends ' + x.sends + '+' + y.sends + '=' + a.sends +
          ' · entregas ' + x.deliveries + '+' + y.deliveries + '=' + a.deliveries +
          ' · leídos ' + x.opens_read + '+' + y.opens_read + '=' + a.opens_read;

        // 🔴 CORREGIDO 20-ago-2026 POR RICK. «Gana el desagregado» solo vale cuando la
        //    desagregación es una UNIDAD DE NEGOCIO. Aquí no lo era: el detalle está partido por
        //    LINK, y un envío de WhatsApp que salió con dos links **sigue siendo UN envío**. La
        //    unidad real es el PARTIDO, y así lo cuadró Rick con la fuente.
        //    El criterio para saberlo es objetivo y no hardcodea ninguna hoja: **si la fila
        //    agregada declara VARIOS utm/links en su propia celda, ella ES la pieza** y los
        //    desagregados son sus links. Antes se partía `Finales` (1,965) en 982+983 y se
        //    reportaban dos envíos donde el cliente cuenta uno.
        var utmsA = t(a.utm_content).split(/[\s,;·|]+/).filter(Boolean);
        if (utmsA.length > 1) {
          fuera[otros[p].j] = true; fuera[otros[q].j] = true;
          out.solapes.push({
            se_queda: a.hoja + '!' + a.fila_en_hoja, journey: a.journey, sends: a.sends,
            excluidos: [x.hoja + '!' + x.fila_en_hoja, y.hoja + '!' + y.fila_en_hoja],
            utms_del_agregado: utmsA,
            prueba: prueba,
            regla: 'gana el AGREGADO: declara ' + utmsA.length + ' links en la misma fila, ' +
              'asi que es UN envio con varios links — no dos envios. La unidad de reporte es el partido.'
          });
          return;
        }

        fuera[i] = true;
        out.solapes.push({
          excluido: a.hoja + '!' + a.fila_en_hoja, journey: a.journey, sends: a.sends,
          es_agregado_de: [x.hoja + '!' + x.fila_en_hoja, y.hoja + '!' + y.fila_en_hoja],
          prueba: prueba,
          regla: 'gana el DESAGREGADO: el agregado no declara varios links, asi que es un resumen'
        });
        return;
      }
    }
  });

  // 2 · el MISMO envío en dos tablas → gana el que trae fecha
  E.forEach(function (a, i) {
    if (fuera[i] || !a.sends) return;
    E.forEach(function (b, j) {
      if (j <= i || fuera[j] || fuera[i] || b.hoja === a.hoja || !b.sends) return;
      if (!casi(a.sends, b.sends) || !casi(a.deliveries, b.deliveries)) return;
      // 🔴 CUANDO LOS NÚMEROS EMPATAN, MANDA EL NOMBRE. `Segundo Partido` y `Tercer Partido`
      //    tienen **162 envíos y 125 entregas idénticos**: emparejar solo por aritmética los
      //    cruzaba al azar, y el Segundo se quedaba con la fecha del Tercero (26-jun) mientras el
      //    Tercero se quedaba SIN fecha — y sin fecha no cae en ninguna quincena, así que sus 162
      //    envíos desaparecían del reporte. Dos filas solo son el mismo envío si además su
      //    identidad es compatible.
      var na = nmz(t(a.journey)), nb = nmz(t(b.journey));
      if (na && nb) {
        var tokA = na.match(/[a-z]{4,}/g) || [], tokB = nb.match(/[a-z]{4,}/g) || [];
        var comun = tokA.filter(function (x) { return tokB.indexOf(x) >= 0; });
        var propios = ['segundo', 'tercer', 'cuarto', 'quinto', 'semifinal', 'final', 'inaugur'];
        var distinguen = tokA.concat(tokB).filter(function (x) { return propios.some(function (pp) { return x.indexOf(pp) === 0; }); });
        // si alguno declara un identificador propio (el partido) y NO lo comparten, no son el mismo
        if (distinguen.length && !comun.some(function (x) { return propios.some(function (pp) { return x.indexOf(pp) === 0; }); })) return;
      }
      // 🔴 NO SE ELIGE: SE FUSIONA. Corregido 20-ago por Rick. Las dos filas describen el MISMO
      //    envío, y cada una aporta algo que la otra no tiene: la hoja por-partido trae las
      //    DIMENSIONES (journey/partido, utms, segmentos) y la otra trae la FECHA. Elegir una
      //    tiraba la mitad de la información — y elegir «la que trae fecha» tiraba justo la
      //    identidad de la pieza, que es la que no se puede recuperar de ningún otro lado.
      //    La fecha SÍ se puede heredar. Las dimensiones no se pueden inventar.
      function riqueza(e) {
        return (t(e.journey) ? 1 : 0) + (t(e.utm_content) ? 1 : 0) + (t(e.segmento_raw) ? 1 : 0);
      }
      var gana = riqueza(a) >= riqueza(b) ? i : j;
      var pierde = gana === i ? j : i;
      // el que gana HEREDA lo que solo tenía el otro — nada se pierde
      var heredado = [];
      ['fecha', 'journey', 'utm_content', 'segmento_raw', 'url'].forEach(function (k) {
        if (!t(E[gana][k]) && t(E[pierde][k])) { E[gana][k] = E[pierde][k]; heredado.push(k); }
      });
      if (heredado.indexOf('fecha') >= 0) E[gana].fecha_via = 'heredada de ' + E[pierde].hoja;
      fuera[pierde] = true;
      out.solapes.push({
        excluido: E[pierde].hoja + '!' + E[pierde].fila_en_hoja,
        se_queda: E[gana].hoja + '!' + E[gana].fila_en_hoja,
        sends: a.sends,
        prueba: 'mismos envíos (' + a.sends + ') y mismas entregas (' + a.deliveries + ') en dos tablas distintas',
        heredado: heredado,
        regla: 'gana el que identifica mejor la PIEZA (journey + utms + segmentos), y HEREDA del otro ' +
          'lo que le faltaba (' + (heredado.join(', ') || 'nada') + '). La fecha se hereda; la identidad no se inventa.'
      });
    });
  });

  out.envios = E.filter(function (e, i) { return !fuera[i]; });
  out.excluidos_por_solape = E.filter(function (e, i) { return fuera[i]; });
  if (out.solapes.length) {
    out.avisos.push({
      tipo: 'solape_entre_tablas', cuantas: out.solapes.length,
      detalle: '🔴 ' + out.solapes.length + ' envío(s) aparecían en DOS tablas a la vez. Se conservó el desagregado y se excluyó el duplicado; la aritmética que lo prueba está en `solapes`. Confirmar con Rick qué tabla manda.'
    });
  }
}

// La llave de un envío de WhatsApp. Sin cadencia, la carga es append: lo que ya está no cambia.
//
// 🔴 `journey || utm_content` perdía envíos: dos filas de Maggi Mundial comparten fecha, campaña,
//    segmento y journey (`crm-hive`) y **solo se distinguen por el utm_content** (`wa-botanas3`
//    vs `wa-botana1`, con 6 y 3 envíos). Con el `||`, la segunda se descartaba como repetida.
//    Los dos campos entran, y las MÉTRICAS también: sin cadencia un envío pasado no cambia, así
//    que sus cifras son parte de su identidad — igual que en Qcart.
function llaveEnvio(e) {
  return [e.fecha || '(sin fecha)', nmz(e.campana_raw), nmz(e.segmento_raw),
    nmz(e.journey), nmz(e.utm_content),
    e.sends, e.opens_read].join('¦');
}

// 🔴 LA VERSION DEL LECTOR. Cuando cambia la FORMA de leer la fuente, lo que se cargó antes
//    deja de ser historia que conservar y pasa a ser salida mala: se reconstruye desde cero.
//    Sin esto, arreglar el lector no arregla nada — el append suma lo corregido a lo corrupto.
//    Subirla es obligatorio en todo cambio que altere qué filas entran o qué columna es cuál.
var LECTOR = 2;   // v2 (19-ago-2026): tablas apiladas por bloque · fila sin métrica no es envío · solapes

module.exports = {
  LECTOR: LECTOR,
  leer: leer, marcarSolapes: marcarSolapes, llaveEnvio: llaveEnvio, isoFecha: isoFecha, num: num, t: t, nmz: nmz,
  CAMPOS: CAMPOS, bloquesDe: bloquesDe
};
