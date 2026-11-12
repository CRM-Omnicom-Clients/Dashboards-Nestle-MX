// LECTOR DE DATORAMA — N2.1.  Único punto donde se abre un export de Datorama.
//
// 🔴 DOS TRAMPAS QUE YA COSTARON:
//
// 1. **El WK del nombre MIENTE.** `Datorama-Nestle-WK32.1.xlsx` se generó el 13-ago 16:42 y
//    `WK33` el 12-ago 20:11: el "33" es MÁS VIEJO. La autoridad de frescura es el campo
//    `Date/Time Generated(UTC)` que el propio archivo trae en su preámbulo, no el nombre.
//
// 2. **El export trae PREÁMBULO** (Report Name, Date/Time, Workspace, Account…). Leerlo con
//    `sheet_to_json` sin más toma la primera fila como encabezado y devuelve 0 filas útiles.
//    El encabezado se busca por CONTENIDO, no por posición — la misma regla que en P1.
//
// 3. Un envío vive en la hoja de SU mes. Las otras hojas traen filas FRAGMENTO (sends=0,
//    opens parciales): compararlas contra la hoja equivocada da falsos "creció".
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, %$]/g, '')); return isFinite(x) ? x : 0; };

// términos que identifican la fila de encabezado de un export de Datorama
var TERMINOS = /^(content\s*name|email\s*(name|sends|deliveries|opens|clicks|bounces)|campaign|journey|send\s*(date|time)|unique|delivered|subject|list|audience|día|fecha)/i;

/** Encuentra la fila de encabezado por CONTENIDO. Devuelve {i, cols} o null. */
function encabezado(F) {
  var mejor = 0, iH = -1;
  F.slice(0, 25).forEach(function (fila, i) {
    var pts = fila.filter(function (c) { return TERMINOS.test(t(c)); }).length;
    if (pts > mejor) { mejor = pts; iH = i; }
  });
  if (iH < 0 || mejor < 3) return null;
  return { i: iH, cols: F[iH].map(t) };
}

/** El sello de frescura que trae el archivo por dentro. */
function generado(F) {
  for (var i = 0; i < Math.min(12, F.length); i++) {
    var fila = F[i].map(t);
    for (var j = 0; j < fila.length; j++) {
      if (/date\/time generated/i.test(fila[j])) {
        var v = t(fila[j + 1]);
        var m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(v);
        if (!m) return { txt: v, ts: 0 };
        var MES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        var d = Date.UTC(+m[3], MES[m[2].toLowerCase()], +m[1], +m[4], +m[5], +m[6]);
        return { txt: v, ts: d };
      }
    }
  }
  return { txt: '', ts: 0 };
}

/** Lee UN archivo → { archivo, generado, hojas:[{hoja, filas:[{...}] }] } */
function leerArchivo(ruta) {
  var tmp = path.join(os.homedir(), '_dtr_' + path.basename(ruta).replace(/[^a-z0-9]/gi, '') + '.xlsx');
  fs.copyFileSync(ruta, tmp);                       // rutas con acentos: siempre por copia ASCII
  var wb = XLSX.readFile(tmp);
  var out = { archivo: path.basename(ruta), generado: null, hojas: [] };
  wb.SheetNames.forEach(function (h) {
    var F = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: '' });
    if (!out.generado) out.generado = generado(F);
    var enc = encabezado(F);
    if (!enc) { out.hojas.push({ hoja: h, filas: [], nota: 'sin encabezado reconocible' }); return; }
    var filas = [];
    F.slice(enc.i + 1).forEach(function (fila) {
      var o = {}, algo = false;
      enc.cols.forEach(function (c, k) { if (c) { o[c] = fila[k] === undefined ? '' : fila[k]; if (t(fila[k])) algo = true; } });
      if (algo) { o.__hoja = h; filas.push(o); }
    });
    out.hojas.push({ hoja: h, filas: filas, cols: enc.cols.filter(Boolean) });
  });
  return out;
}

/** Todos los exports de una carpeta, ORDENADOS por frescura REAL (no por el WK del nombre). */
function inventario(dir) {
  return fs.readdirSync(dir)
    .filter(function (f) { return /\.xlsx$/i.test(f) && !/^~\$/.test(f); })
    .map(function (f) {
      var r = path.join(dir, f);
      var tmp = path.join(os.homedir(), '_g_' + f.replace(/[^a-z0-9]/gi, '') + '.xlsx');
      try {
        fs.copyFileSync(r, tmp);
        var F = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets[XLSX.readFile(tmp).SheetNames[0]], { header: 1, defval: '' });
        var g = generado(F);
        return { archivo: f, ruta: r, generado: g.txt, ts: g.ts, wk: num((f.match(/WK(\d+)/i) || [0, 0])[1]) };
      } catch (e) { return { archivo: f, ruta: r, generado: '(no se pudo leer: ' + e.code + ')', ts: 0, wk: 0 }; }
    })
    .sort(function (a, b) { return b.ts - a.ts; });   // el más nuevo primero, por su sello interno
}

/** Nombre de la columna que coincide con un patrón, en el orden de preferencia dado. */
function colDe(cols, pats) {
  for (var i = 0; i < pats.length; i++) {
    for (var j = 0; j < cols.length; j++) if (pats[i].test(cols[j])) return cols[j];
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// LLAVE DE UN ENVÍO — la que decide si una fila es NUEVA o es un refresh.
//
// 🔴 NO USA EL content_name CRUDO. Comprobado el 17-ago: Datorama trae
//      "GomichelaO_Maggi-Seleccion-NC006537_…_948858"
//    y Data_Email tenía
//      "O_Maggi-Seleccion-NC006537_…_948858"
//    — el MISMO envío, con el prefijo cambiado entre semanas. Las 5 métricas idénticas.
//    Cruzar por el nombre lo daba como NUEVO y habría DUPLICADO 14,118 envíos.
//
// Lo estable del content_name es su COLA: el asset_id final. La llave usa eso más las
// dimensiones que de verdad separan dos envíos distintos del mismo asset.
// ══════════════════════════════════════════════════════════════════════════════════════
function assetDe(cn) { return (t(cn).match(/_(\d{4,})\s*$/) || [])[1] || ''; }

/** ISO de una fecha que puede venir como serial de Excel, texto o Date. */
function isoFecha(f) {
  if (f instanceof Date) return f.toISOString().slice(0, 10);
  if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10);
  var s = t(f); if (!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  var d = new Date(s); return isNaN(d) ? s.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * llaveEnvio({content_name, fecha})  →  cola_normalizada(55) ¦ fecha
 *
 * 🔴 TRES INTENTOS, DOS DESASTRES EVITADOS — dejo los tres porque el error se repite:
 *
 * 1. content_name COMPLETO + fecha
 *      Datorama:  "GomichelaO_Maggi-Seleccion-…_948858"
 *      cargado :  "O_Maggi-Seleccion-…_948858"     ← mismo envío, prefijo distinto
 *    Habría DUPLICADO 14,118 envíos.
 *
 * 2. asset + journey_id + audiencia + fecha
 *      🔴 Journey_ID es un campo DISTINTO en cada lado: Data_Email trae "890132" (que es el
 *         ASSET, no un journey) y Datorama el GUID "8282C03F-1EE6-…". Y la audiencia es
 *         "All Subscribers" en casi todo: no discrimina.
 *      Habría marcado 99 filas como nuevas y DUPLICADO 5,459,711 envíos (+84.6%).
 *
 * 3. ✔ COLA del content_name + fecha
 *    El prefijo es lo que cambia; la cola lleva segmento, tipo y asset — todo lo que
 *    discrimina. Probado con colas de 40 a 70: de 40 a 60 da **0 colisiones** en la hoja
 *    cargada y **537/537** filas de Datorama encuentran su pareja.
 *
 * ⚠ asset+fecha NO basta: 113 llaves para 264 filas. Varios segmentos comparten asset y día.
 */
var COLA = 55;   // probado 40/50/55/60/70: de 40 a 60 → 0 colisiones y 537/537 matchean

function llaveEnvio(o) {
  return nmz(o.content_name).slice(-COLA) + '¦' + isoFecha(o.fecha);
}
function nmz(s) { return t(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function tieneAsset(cn) { return !!assetDe(cn); }

// El tipo de envío (Principal / Follow Up) la fuente NO lo entrega, y sin él un envío se suma
// dos veces o desaparece de los reportes. Se deriva del marcador técnico del content_name.
//
// 🔴 Y por eso «no inferir del naming» es una regla dura, no una manía: el marcador tiene DOS
//    formas. 112 envíos dicen `FUP` y uno dice `FP` (…TRADITIONAL-PARENTS-FP_AC_EM_A_V1_803867).
//    Con solo `FUP` ese envío se clasificaba Principal y entraba a la banda equivocada.
//    Probado contra las 264 filas ya clasificadas del workbook: 264/264.
//
// ⚠ Esto deriva un MARCADOR TÉCNICO, no una regla de negocio. El objetivo, el segmento y la
//   campaña NO se derivan del nombre nunca: esos salen del catálogo.
var RX_FUP = new RegExp('(^|_|-)(FUP|FP)(-|_|$)', 'i');
function tipoEmail(cn) { return RX_FUP.test(t(cn)) ? 'Follow Up' : 'Principal'; }
function fragil(o) { return !assetDe(o.content_name); }

module.exports = {
  leerArchivo: leerArchivo, inventario: inventario, encabezado: encabezado, generado: generado,
  colDe: colDe, num: num, t: t,
  assetDe: assetDe, isoFecha: isoFecha, llaveEnvio: llaveEnvio, tieneAsset: tieneAsset, fragil: fragil,
  tipoEmail: tipoEmail
};
