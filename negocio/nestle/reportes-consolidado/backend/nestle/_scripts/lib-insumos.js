// insumos-validar · INSUMOS — descubrir y clasificar lo que llegó, ANTES de que nada lo consuma.
//
// Migra `agent-insumos.md` + `validar-insumos.js`, y corrige dos defectos que el guardián
// viejo tenía, ambos medidos el 18-ago-2026:
//
//   🔴 1. NO VEÍA 4 DE 18 ARCHIVOS. Filtraba la carpeta con el patrón de nombre
//         /^Datorama-Nestle-WK(\d+)\.xlsx$/  →  quedaban fuera `WK32.1`, `AON-RN-Marzo-Mayo`,
//         `Intelligent-Abril` y `Reporte-Email-...wk25`. Firmaba en verde con media carpeta.
//
//   🔴 2. ELEGÍA UN ARCHIVO 21 HORAS MÁS VIEJO. Tomaba el WK más alto del NOMBRE: cargaba
//         `WK33` (generado 12-ago 20:11) teniendo `WK32.1` (13-ago 16:42) al lado.
//
// LA REGLA QUE SALE DE LOS DOS: **el nombre es una pista, el contenido es el dato.**
// Se lista TODO, se clasifica por lo que trae adentro, y se ordena por su sello interno.
var fs = require('fs'), path = require('path'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };

// El BOM y el salto de línea se construyen por código: escritos como literal se pierden
// cuando el archivo se edita desde una capa de shell, y el módulo deja de cargar.
var BOM = String.fromCharCode(0xFEFF);
var SALTO = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n');

/* ── Las CARPETAS son lo único estable. Lo que hay dentro cambia. (de agent-insumos)
 *
 * 🔴 PERO EL NOMBRE DE LA CARPETA TAMPOCO ES ESTABLE, Y ESO VOLVIÓ A MORDER (6-oct-2026).
 *    Estaban escritos `'ReportesQcart'` y `'Reportes-Datorama'`. Rick reorganizó la carpeta de
 *    SharePoint —las fuentes pasaron a `Fuentes/Qcart/`— y este lector reportó
 *    **«0 CSV · 0 piezas · ninguno»** teniendo las descargas de HOY delante, con sus cinco checks
 *    de Qcart en VERDE sobre el conjunto vacío.
 *    Es exactamente el defecto que el comentario de abajo documenta del 21-sep, por otra causa:
 *    entonces era el nivel de la carpeta, ahora el nombre. La forma de no repetirlo no es mirar
 *    un nivel más: es **preguntar al contrato dónde están**, que es el único sitio donde eso se
 *    declara. `qcart_descargas` apunta a `_vigientes`; su carpeta padre es la de Qcart.
 *
 * 🔴 Y DATORAMA ESTÁ RETIRADO: el email sale del MCP de SFMC desde septiembre. Su carpeta se
 *    declara OPCIONAL — que no esté no es un hallazgo, y marcarlo como fallo entrena a ignorar
 *    los fallos. */
function dirDeFuente(proy, cual) {
  var ENT;
  try { ENT = require(__dirname + '/lib-entorno.js'); } catch (e) { ENT = null; }
  if (ENT && cual === 'qcart') {
    try { return path.dirname(ENT.fuente('qcart_descargas')); } catch (e) { /* cae al nombre viejo */ }
  }
  return path.join(proy, cual === 'qcart' ? 'ReportesQcart' : 'Reportes-Datorama');
}
var FUENTES = {
  email: {
    dir: 'Reportes-Datorama',
    opcional: true,
    por_que_opcional: 'Datorama está RETIRADO: el email sale del MCP de SFMC. Que la carpeta no exista no es un hallazgo.',
    ext: /\.xlsx$/i,
    nombre: 'Email · export de Datorama (retirado)',
    marcas: /email\s*(sends|deliveries|content name)|unique opens/i
  },
  qcart: {
    dir: 'ReportesQcart',
    ext: /\.(csv|xlsx)$/i,
    nombre: 'Qcart · carritos, productos y el mapa de links',
    marcas: /shortlink|qcart|carts?_total|impressions/i
  }
};

/** Lista TODO lo que hay en la carpeta. Sin filtrar por nombre — ese fue el defecto 1. */
/* 🔴 21-sep-2026 · SE MIRA DONDE MIRA EL CARGADOR, NO UN NIVEL ARRIBA.
 *    Esto leía SOLO la raíz de la carpeta, y las descargas de Qcart viven en
 *    `ReportesQcart/_vigentes/` —que es donde las lee `fuentes-qcart.qcart.js`—. Resultado: el
 *    validador encontraba **0 CSV** y sus cinco checks de Qcart salían en VERDE sobre un conjunto
 *    vacío: «todo CSV se clasifica ✓ 0 CSV», «cada pieza trae sus dos mitades ✓ 0 piezas».
 *    Un check que pasa porque no hay nada que mirar es peor que no tenerlo: promete vigilancia.
 *    Rick dejó las descargas de septiembre el 21-sep a las 12:07 y el validador no dijo una palabra.
 *    Ahora se baja un nivel a las subcarpetas (sin recursión infinita: solo un nivel, que es la
 *    forma real de estas carpetas) y cada archivo declara en qué subcarpeta estaba. */
function descubrir(proy, fuente) {
  var F = FUENTES[fuente];
  var dir = dirDeFuente(proy, fuente);
  if (!fs.existsSync(dir)) return { dir: dir, existe: false, opcional: !!F.opcional, archivos: [] };
  function leerDir(d, sub) {
    var out = [];
    fs.readdirSync(d).forEach(function (f) {
      if (/^~\$/.test(f)) return;
      var p = path.join(d, f), st;
      try { st = fs.statSync(p); } catch (e) { return; }
      if (st.isDirectory()) {
        // un solo nivel, y nunca los respaldos: un backup viejo no es una descarga del corte
        if (!sub && !/^_?backups?$/i.test(f)) out = out.concat(leerDir(p, f));
        return;
      }
      if (!F.ext.test(f)) return;
      out.push({ archivo: f, ruta: p, kb: Math.round(st.size / 1024), mtime: st.mtime, subcarpeta: sub || '' });
    });
    return out;
  }
  return { dir: dir, existe: true, opcional: !!F.opcional, archivos: leerDir(dir, '') };
}

/** Primera línea de un CSV, sin BOM y con su separador detectado. */
function cabeceraCSV(ruta) {
  var l1 = '';
  try { l1 = fs.readFileSync(ruta, 'utf8').split(SALTO)[0] || ''; } catch (e) { return null; }
  if (l1.charAt(0) === BOM) l1 = l1.slice(1);
  if (!l1.trim()) return { vacio: true, cols: [], sep: null };
  var sep = [';', ',', '\t'].sort(function (a, b) { return l1.split(b).length - l1.split(a).length; })[0];
  return {
    vacio: false, sep: sep,
    cols: l1.split(sep).map(function (c) { return c.replace(/^"|"$/g, '').trim(); })
  };
}

/** Qué ES este archivo — por su CONTENIDO. `tipo` nunca se adivina del nombre. */
function clasificar(ruta) {
  if (/\.csv$/i.test(ruta)) {
    var h = cabeceraCSV(ruta);
    if (!h) return { tipo: 'ilegible', cols: [], nota: 'no se pudo leer' };
    if (h.vacio) return { tipo: 'vacio', cols: [], nota: 'primera línea vacía' };
    // la regla del guardián viejo, que sí estaba bien: ¿trae columna de producto?
    var esProd = h.cols.some(function (c) { return /^product/i.test(c); });
    return {
      tipo: esProd ? 'qcart-productos' : 'qcart-carritos',
      cols: h.cols, sep: h.sep,
      nota: esProd ? 'trae columna product → numerador Nestlé' : 'sin columna product → denominador'
    };
  }
  if (/\.xlsx$/i.test(ruta)) return { tipo: 'xlsx', cols: [], nota: 'requiere abrirlo para clasificar' };
  return { tipo: 'desconocido', cols: [], nota: 'extensión no reconocida' };
}

/** La pieza de un CSV de Qcart: el nombre sin el token de tipo. Para emparejar mitades. */
function pieza(f) {
  return f.replace(/\.csv$/i, '')
    .replace(/[-_ ]?(carts?|products?)[-_ ]?/ig, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Filas con contenido de un CSV, sin contar el encabezado. */
function filasCSV(ruta) {
  try {
    return fs.readFileSync(ruta, 'utf8').split(SALTO).filter(function (l) { return l.trim(); }).length - 1;
  } catch (e) { return -1; }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// EL PERIODO Y LA FRESCURA — se leen ADENTRO, nunca del nombre.
//
// Regla que viene de `agent-insumos`: *"el periodo de un archivo se lee por las fechas de
// sus filas, nunca por su nombre"*. El defecto 2 del guardián viejo lo confirma.
//
//   xlsx de Datorama → el campo `Date/Time Generated(UTC)` de su preámbulo
//   CSV de Qcart     → la primera y última fecha de sus filas
// ══════════════════════════════════════════════════════════════════════════════════════

var MES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Frescura de un export de Datorama: su sello interno. */
function selloDatorama(ruta) {
  var XLSX;
  try { XLSX = require('xlsx'); } catch (e) { return null; }
  var tmp = path.join(os.homedir(), '_ins_' + path.basename(ruta).replace(/[^a-z0-9]/gi, '') + '.xlsx');
  try {
    fs.copyFileSync(ruta, tmp);                 // rutas con acentos: siempre por copia ASCII
    var wb = XLSX.readFile(tmp);
    var F = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    for (var i = 0; i < Math.min(12, F.length); i++) {
      var fila = (F[i] || []).map(t);
      for (var j = 0; j < fila.length; j++) {
        if (/date\/time generated/i.test(fila[j])) {
          var v = t(fila[j + 1]);
          var m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(v);
          if (!m) return { ts: 0, txt: v };
          return { ts: Date.UTC(+m[3], MES[m[2].toLowerCase()], +m[1], +m[4], +m[5], +m[6]), txt: v };
        }
      }
    }
    return { ts: 0, txt: '(sin sello interno)' };
  } catch (e) { return { ts: 0, txt: '(no se pudo abrir: ' + e.code + ')' }; }
}

/** Periodo de un CSV: primera y última fecha de sus FILAS. */
function periodoCSV(ruta) {
  var h = cabeceraCSV(ruta);
  if (!h || h.vacio) return null;
  var iFecha = -1;
  h.cols.forEach(function (c, i) { if (iFecha < 0 && /^(date|fecha)/i.test(c)) iFecha = i; });
  if (iFecha < 0) return { nota: 'sin columna de fecha reconocible' };
  var fechas = [];
  try {
    var txt = fs.readFileSync(ruta, 'utf8');
    if (txt.charAt(0) === BOM) txt = txt.slice(1);
    txt.split(SALTO).slice(1).forEach(function (l) {
      if (!l.trim()) return;
      var v = t((l.split(h.sep)[iFecha] || '')).replace(/^"|"$/g, '');
      var m = /(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (m) fechas.push(m[0]);
    });
  } catch (e) { return { nota: 'no se pudo leer' }; }
  if (!fechas.length) return { nota: 'columna de fecha sin valores legibles' };
  fechas.sort();
  return { desde: fechas[0], hasta: fechas[fechas.length - 1], n: fechas.length };
}

/**
 * Inventario ordenado por frescura REAL.
 * `wk_del_nombre` se guarda solo para poder DELATAR la diferencia, nunca para ordenar.
 */
function porFrescura(archivos) {
  return archivos.map(function (a) {
    var s = /\.xlsx$/i.test(a.archivo) ? selloDatorama(a.ruta) : null;
    var wk = (a.archivo.match(/WK(\d+)/i) || [0, 0])[1];
    return {
      archivo: a.archivo, ruta: a.ruta, kb: a.kb,
      sello: s ? s.txt : '', ts: s && s.ts ? s.ts : a.mtime.getTime(),
      wk_del_nombre: +wk || null,
      fuente_frescura: s && s.ts ? 'sello interno' : 'mtime del archivo'
    };
  }).sort(function (x, y) { return y.ts - x.ts; });
}

/** ¿El orden por nombre contradice al real? Devuelve los que engañan. */
function nombreEngana(inv) {
  if (!inv.length) return [];
  var top = inv[0];
  return inv.filter(function (x) {
    return x !== top && x.wk_del_nombre && top.wk_del_nombre && x.wk_del_nombre > top.wk_del_nombre;
  });
}

module.exports = {
  FUENTES: FUENTES, descubrir: descubrir, clasificar: clasificar, cabeceraCSV: cabeceraCSV,
  pieza: pieza, filasCSV: filasCSV, selloDatorama: selloDatorama, periodoCSV: periodoCSV,
  porFrescura: porFrescura, nombreEngana: nombreEngana, t: t, BOM: BOM, SALTO: SALTO
};
