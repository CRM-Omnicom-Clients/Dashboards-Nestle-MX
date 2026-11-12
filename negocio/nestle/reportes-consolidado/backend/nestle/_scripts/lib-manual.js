// lib-manual.js — lee lo que el equipo declara a mano.
//
// 🔴 LO QUE HACE DISTINTO A ESTE SCRIPT: un dato manual es **el único del sistema sin fuente
//    verificable**. Los demás se pueden volver a bajar y comparar; éste no. Si entra sin decir
//    quién lo puso y por qué, en tres meses es indistinguible de un error de dedo — y como entra
//    a los reportes igual que los otros, nadie lo nota.
//    Por eso `quien` y `por_que` son OBLIGATORIOS, y una fila sin ellos se RECHAZA con su motivo
//    en vez de cargarse a medias.
//
// El formato es un CSV en `<proyecto>/_manual/`, editable en Excel o en el bloc de notas:
//    pieza_id,fecha,metrica,valor,quien,por_que
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');

function t(v) { return String(v == null ? '' : v).trim(); }
// una sola normalizadora de ENCABEZADOS para todos los lectores: cinco copias idénticas hoy
// son cinco copias divergentes mañana. (No es `lib-alias.nm`, que resuelve DIMENSIONES y sí
//  quita los separadores — son trabajos distintos, y confundirlos ya costó un defecto.)
var nmz = require(__dirname + '/lib-flexible.js').nmEncabezado;

// las métricas que se pueden declarar. Todas son CONTEOS: las tasas las hace motor-calculo.
var METRICAS = ['sends', 'deliveries', 'opens', 'clicks', 'errores', 'carritos', 'views', 'importe'];
var CALCULADA = /rate|ctor|pct|%|tasa|ratio|promedio|penetracion/i;

// el mismo parser con comillas que Qcart: un `por_que` puede llevar comas dentro
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
function separador(l) {
  var mejor = ',', n = 0;
  [',', ';', '\t', '|'].forEach(function (s) { var c = l.split(s).length; if (c > n) { n = c; mejor = s; } });
  return mejor;
}
function num(v) {
  var s = t(v).replace(/[$\s]/g, '');
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // formato europeo
  else s = s.replace(/,/g, '');
  var n = Number(s);
  return isFinite(n) ? n : null;
}
function isoFecha(v) {
  var s = t(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  var n = Number(s);
  if (isFinite(n) && n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
  return null;
}

/**
 * Lee la carpeta `_manual` completa.
 * Nada se descarta en silencio: lo que no pasa una regla sale en `rechazados` con su motivo.
 */
function leer(dir) {
  var out = { dir: dir, archivos: [], datos: [], rechazados: [], avisos: [] };
  var ent;
  try { ent = fs.readdirSync(dir); }
  catch (e) { out.avisos.push('no existe la carpeta ' + dir + ' — no hay datos manuales, que es lo normal'); return out; }

  ent.forEach(function (f) {
    if (!/\.csv$/i.test(f)) return;                      // el LEEME.md no es un dato
    var esPlantilla = /plantilla/i.test(f);
    var txt = fs.readFileSync(path.join(dir, f), 'utf8').replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '');
    var lin = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lin.length < 2) { out.archivos.push({ archivo: f, filas: 0, nota: 'sin filas de datos' }); return; }
    var sep = separador(lin[0]);
    var cols = partir(lin[0], sep).map(nmz);
    var iP = cols.indexOf('pieza_id'), iF = cols.indexOf('fecha'), iM = cols.indexOf('metrica'),
      iV = cols.indexOf('valor'), iQ = cols.indexOf('quien'), iW = cols.indexOf('por_que');

    if (iP < 0 || iM < 0 || iV < 0) {
      out.archivos.push({ archivo: f, filas: 0, nota: '🔴 le faltan columnas obligatorias (pieza_id, metrica, valor)' });
      return;
    }
    var n = 0, rech = 0;
    lin.slice(1).forEach(function (l, k) {
      var v = partir(l, sep);
      var d = {
        pieza_id: t(v[iP]), fecha: isoFecha(v[iF]), metrica: nmz(v[iM]), valor: num(v[iV]),
        quien: iQ >= 0 ? t(v[iQ]) : '', por_que: iW >= 0 ? t(v[iW]) : '',
        archivo: f, fila: k + 2, es_plantilla: esPlantilla
      };
      function rechazar(motivo) { rech++; out.rechazados.push(Object.assign({}, d, { motivo: motivo })); }

      // la fila de ejemplo de la plantilla no es un dato
      if (esPlantilla || /borrar|ejemplo/i.test(d.por_que)) return rechazar('fila de ejemplo de la plantilla — no es un dato');
      if (!d.pieza_id) return rechazar('sin pieza_id: sería un dato flotante, sin campaña ni canal');
      if (!d.metrica) return rechazar('sin métrica');
      if (d.valor === null) return rechazar('el valor no es un número');
      // 🔴 las dos que hacen auditable un dato manual
      if (!d.quien) return rechazar('sin «quien»: un dato manual sin autor no se puede auditar después');
      if (!d.por_que) return rechazar('sin «por_que»: hay que decir qué fuente no lo entrega');
      // 🔴 nada calculado
      if (CALCULADA.test(d.metrica)) return rechazar('«' + d.metrica + '» es una métrica calculada: las tasas las hace motor-calculo, aquí solo conteos');
      if (METRICAS.indexOf(d.metrica) < 0) return rechazar('métrica desconocida «' + d.metrica + '» · las válidas: ' + METRICAS.join(', '));

      out.datos.push(d); n++;
    });
    out.archivos.push({ archivo: f, filas: n, rechazadas: rech, es_plantilla: esPlantilla });
  });
  return out;
}

// la llave: una métrica de una pieza en una fecha. Si se vuelve a declarar, es la misma.
function llave(d) { return [d.pieza_id, d.fecha || '(sin fecha)', d.metrica].join('¦'); }

module.exports = { leer: leer, llave: llave, METRICAS: METRICAS, num: num, isoFecha: isoFecha, t: t, nmz: nmz };
