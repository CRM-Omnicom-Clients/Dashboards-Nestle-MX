// lib-qcart.js — el lector de las descargas de Qcart. Lee, normaliza, y NO calcula nada.
//
// Los 2 archivos vigentes viven en `ReportesQcart/_vigentes/`. Se lee **todo** lo que haya ahí
// y se clasifica **por su encabezado**: el de productos trae la columna `product`, el de
// carritos no. Nunca por el nombre del archivo — es el defecto que ya pagamos dos veces.
//
// 🔴 Cada fila es un EVENTO con su fecha-hora. No se agrupa, no se suma, no se promedia:
//    eso es motor-calculo. Aquí solo se deja el dato utilizable.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');

var BOM = String.fromCharCode(0xFEFF);
function t(v) { return String(v == null ? '' : v).trim(); }
// una sola normalizadora de ENCABEZADOS para todos los lectores: cinco copias idénticas hoy
// son cinco copias divergentes mañana. (No es `lib-alias.nm`, que resuelve DIMENSIONES y sí
//  quita los separadores — son trabajos distintos, y confundirlos ya costó un defecto.)
var nmz = require(__dirname + '/lib-flexible.js').nmEncabezado;

// ── el separador se DETECTA por archivo: el contrato de insumos-validar dice que varía ────────────
function separador(linea) {
  var cand = [';', ',', '\t', '|'];
  var mejor = ';', n = 0;
  cand.forEach(function (s) {
    var c = linea.split(s).length;
    if (c > n) { n = c; mejor = s; }
  });
  return mejor;
}

// ── parser que respeta comillas ─────────────────────────────────────────────────────
// 🔴 hace falta porque DOS campos traen el separador dentro:
//      total shown price → "316,83"                    (coma decimal, formato europeo)
//      store             → "walmart-com-mx, chedraui-com-mx"   (multivalor)
//    Un split() simple parte esas celdas y corre todas las columnas de esa fila.
function partir(linea, sep) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < linea.length; i++) {
    var ch = linea[i];
    if (ch === '"') { q = !q; continue; }
    if (ch === sep && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// ── número en formato europeo ───────────────────────────────────────────────────────
// «316,83» es 316.83, no 31683. Y «1.234,56» es 1234.56. Confundirlos multiplica por 100
// un importe, que es justo el tipo de error que nadie nota en un total grande.
function num(v) {
  var s = t(v);
  if (!s) return 0;
  s = s.replace(/\s/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // 1.234,56 → 1234.56
  else s = s.replace(/,/g, '');                                          // 1,234.56 → 1234.56
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

// ── la tienda ───────────────────────────────────────────────────────────────────────
// 🔴 `store` viene multivalor Y en dos órdenes: «walmart-com-mx, chedraui-com-mx» y
//    «chedraui-com-mx, walmart-com-mx» son el MISMO par. Sin ordenarlo son dos tiendas
//    distintas que no existen, y el conteo por tienda sale mal.
function tiendas(v) {
  var s = nmz(v).replace(/-com-mx|\.com\.mx|-com|www\./g, '');
  return s.split(/[;,\/]+/).map(function (x) { return t(x); }).filter(Boolean).sort();
}
function tiendaClave(v) { var a = tiendas(v); return a.length ? a.join('+') : '(sin tienda)'; }

// ── fecha-hora ──────────────────────────────────────────────────────────────────────
// El export trae `2026-08-12T17:00:00`. Se conservan las dos: la hora es la granularidad
// real del dato (3,885 de 3,953 filas la traen), y el día es con lo que se filtra.
function fechaHora(v) {
  var s = t(v);
  var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/.exec(s);
  if (!m) return { dia: null, hora: null, iso: null };
  return { dia: m[1], hora: m[2] || null, iso: m[1] + (m[2] ? 'T' + m[2] : '') };
}

/** Lee UN csv y devuelve sus filas como objetos, con el esquema detectado. */
function leerCsv(ruta) {
  var txt = fs.readFileSync(ruta, 'utf8');
  var tieneBom = txt.charCodeAt(0) === 0xFEFF;
  if (tieneBom) txt = txt.slice(1);
  var lineas = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lineas.length) return { archivo: path.basename(ruta), filas: [], tipo: null, nota: 'vacío' };
  var sep = separador(lineas[0]);
  var cols = partir(lineas[0], sep).map(function (c) { return nmz(c); });

  // 🔴 el TIPO se decide por el encabezado, no por el nombre del archivo
  var tipo = cols.indexOf('product') >= 0 ? 'productos' : 'carritos';

  // ⚠ NADA se descarta en silencio. 15 filas de estos archivos no traen `shortlink code` pero
  //   sí traen views, precio y campaña (casi todas de `lechera-junio`): son datos reales que no
  //   se pueden atribuir por la vía principal. Se marcan y viajan con su motivo.
  var filas = [], sinCodigo = [];
  lineas.slice(1).forEach(function (l, i) {
    var v = partir(l, sep), o = {};
    cols.forEach(function (c, k) { o[c] = t(v[k]); });
    o.__fila = i + 2;
    if (!o['shortlink code'] && !o['shortlink']) {
      o.__sin_codigo = 'la fila no trae shortlink code — no se puede atribuir por código';
      sinCodigo.push(o);
    }
    filas.push(o);
  });

  return {
    archivo: path.basename(ruta), ruta: ruta, tipo: tipo,
    separador: sep === '\t' ? 'TAB' : sep, bom: tieneBom,
    columnas: cols.filter(Boolean), filas: filas, sin_codigo: sinCodigo
  };
}

/** Normaliza una fila cruda a la forma que usa el bloque. Sin calcular nada. */
function normalizar(o, tipo, archivo) {
  var f = fechaHora(o['date']);
  return {
    // el evento
    fecha: f.dia, hora: f.hora, fecha_hora: f.iso,
    shortlink_code: t(o['shortlink code']) || t(o['shortlink']),
    shortlink_name: t(o['shortlink name']),
    // de dónde vino
    utm_campaign: t(o['utm_campaign']) || t(o['campaign']),
    utm_medium: t(o['utm_medium']) || t(o['medium']),
    utm_source: t(o['utm_source']),
    utm_content: t(o['utm_content']),
    utm_term: t(o['utm_term']),
    // dónde
    store_raw: t(o['store']),
    store: tiendaClave(o['store']),
    n_tiendas: tiendas(o['store']).length,
    // qué (solo en productos)
    product: tipo === 'productos' ? t(o['product']) : null,
    fila_en_csv: o.__fila || null,
    sin_codigo: o.__sin_codigo || null,
    // las métricas, tal cual vienen
    impressions: num(o['impressions']),
    views: num(o['views']),
    total_shown_price: num(o['total shown price']),
    // trazabilidad
    fuente: archivo, tipo: tipo
  };
}

/**
 * Lee la carpeta de vigentes completa.
 * Devuelve un bloque por tipo, y **declara** lo que no pudo clasificar.
 */
function leerVigentes(dir) {
  var out = { dir: dir, archivos: [], carritos: [], productos: [], avisos: [] };
  var ent;
  try { ent = fs.readdirSync(dir); }
  catch (e) { out.avisos.push('🔴 no existe la carpeta ' + dir); return out; }

  ent.forEach(function (f) {
    if (!/\.csv$/i.test(f)) return;                       // el LEEME.md y demás no son datos
    var r = leerCsv(path.join(dir, f));
    var st = fs.statSync(path.join(dir, f));
    var dias = r.filas.map(function (x) { return fechaHora(x['date']).dia; }).filter(Boolean).sort();
    r.desde = dias[0] || null; r.hasta = dias[dias.length - 1] || null;
    r.mtime = st.mtime.toISOString().slice(0, 16);
    /* 🔴 21-sep-2026 · UN CSV SIN COLUMNA DE FECHA NO ES UN LOG, ES UN RESUMEN — Y NO SE CARGA.
     *    Qcart exporta dos formas del mismo periodo: el CRUDO (una fila por día) y el AGREGADO
     *    (una fila por shortlink × utm × tienda, sin fecha). Los dos aterrizaron en `_vigentes`
     *    y se cargaron los dos: **26 carritos entraron sin fecha** desde el agregado, encima de
     *    los mismos eventos que el crudo ya traía. La llave anti-duplicado no los atrapa porque
     *    la fecha forma parte de la llave: sin fecha, la llave es OTRA y el evento parece nuevo.
     *    Es el mismo defecto que las filas de «Totales» de WhatsApp — un resumen cargado como si
     *    fuera detalle — y aquí además rompe el modelo temporal: un carrito sin fecha no se puede
     *    ubicar en ninguna quincena, así que no puede llegar a ninguna fila del reporte.
     *    Se rechaza y SE DECLARA, con su conteo. Nunca en silencio. */
    var sinFecha = !r.filas.length ? false : r.filas.every(function (x) { return !fechaHora(x['date']).dia; });
    out.archivos.push({ archivo: r.archivo, tipo: r.tipo, filas: r.filas.length,
      separador: r.separador, bom: r.bom, desde: r.desde, hasta: r.hasta, mtime: r.mtime,
      cargado: !sinFecha, motivo: sinFecha ? 'NINGUNA de sus ' + r.filas.length + ' filas trae fecha: es el export AGREGADO, no el crudo. Cargarlo duplicaría los eventos que el crudo ya trae, y un carrito sin fecha no cae en ninguna quincena.' : null });
    if (sinFecha) {
      out.avisos.push('⚠ ' + r.archivo + ' NO se cargó: ' + r.filas.length +
        ' fila(s) sin fecha (export agregado). Si lo que quieres es ese periodo, el archivo bueno es el `-raw-`.');
      return;
    }
    var destino = r.tipo === 'productos' ? out.productos : out.carritos;
    r.filas.forEach(function (o) { destino.push(normalizar(o, r.tipo, r.archivo)); });
  });

  // si hay DOS del mismo tipo, gana el que llega más lejos en el tiempo — y se dice.
  ['carritos', 'productos'].forEach(function (tp) {
    var n = out.archivos.filter(function (a) { return a.tipo === tp; });
    if (n.length === 0) out.avisos.push('🔴 no hay archivo de ' + tp + ' en ' + dir);
    if (n.length > 1) out.avisos.push('⚠ ' + n.length + ' archivos de ' + tp +
      ': ' + n.map(function (a) { return a.archivo + ' (hasta ' + a.hasta + ')'; }).join(' · ') +
      ' — se cargan TODOS; los eventos repetidos se descartan por su llave');
  });
  return out;
}

// ══ LA LLAVE DE UN EVENTO ═══════════════════════════════════════════════════════════
// Es lo que hace que la carga sea append e idempotente: correr el script dos veces con el mismo
// archivo no debe duplicar una sola fila.
//
// 🔴 `fecha-hora ¦ shortlink ¦ store ¦ product` NO alcanzaba: 21 filas la compartían. Al mirarlas
//    no eran duplicados — **difieren en `utm_content`**: el mismo producto, el mismo link y la
//    misma hora, pero un click vino del CTA (`cta`) y otro del cuerpo del correo (``). Son dos
//    eventos reales. Fundirlos habría perdido tráfico de verdad.
//
// 🔴 Y aun con todas las dimensiones quedan choques: dos filas iguales en TODO pero con métricas
//    distintas (views 2 vs 1). La fuente las entrega separadas dentro de la misma hora. En vez de
//    sumarlas —que sería calcular, y no le toca a este paso— se les da un ORDINAL dentro de su
//    grupo. Al recargar el mismo archivo el ordinal vuelve a salir igual, así que la idempotencia
//    se mantiene; y si la descarga nueva trae una tercera, esa sí es un evento nuevo.
function dimensiones(e) {
  return [e.fecha_hora || e.fecha, e.shortlink_code, e.store, e.product || '',
    e.utm_content || '', e.utm_term || '', e.utm_campaign || ''].join('¦');
}
// 🔴 Las MÉTRICAS entran en la llave, y el ordinal se fue.
//    Con un ordinal por posición, una fila **idéntica en todo** recibía «#2» y entraba como
//    evento nuevo: al simular la próxima descarga, la fila repetida se coló y el bloque creció
//    de más. Una fila igual en dimensiones Y en métricas es un duplicado de la fuente, y no hay
//    forma de distinguirla de un evento real repetido — lo conservador es contarla una vez.
//    Las 21 filas que compartían dimensiones siguen siendo eventos distintos: **difieren en las
//    métricas** (views 2 vs 1), así que la llave las separa igual.
//    Y como es un log, un evento pasado no cambia: sus métricas son parte de su identidad.
function llaveEvento(e) {
  return dimensiones(e) + '§' + [e.views, e.impressions, e.total_shown_price].join('/');
}

module.exports = {
  leerVigentes: leerVigentes, leerCsv: leerCsv, normalizar: normalizar,
  llaveEvento: llaveEvento, dimensiones: dimensiones,
  num: num, tiendas: tiendas, tiendaClave: tiendaClave, fechaHora: fechaHora,
  separador: separador, partir: partir, t: t, nmz: nmz
};
