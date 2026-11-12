/*
 * resumen.restaurar-estilos.js — DEVOLVER LOS COLORES QUE `XLSX.writeFile` SE LLEVÓ.
 *
 * 🔴 EL DAÑO, MEDIDO. SheetJS conserva los `numFmt` pero borra rellenos, fuentes, bordes y colores
 *    de pestaña. El libro pasó de **32 rellenos (30 con color) · 12 fuentes · 8 negritas · 2 bordes
 *    · 69 estilos** a **2 · 0 · 1 · 0 · 0 · 10**. Lo causó `escritor.hojas-clicks.js`, que creé la
 *    sesión pasada escribiendo con `XLSX.writeFile` contra la regla del proyecto. Ya está arreglado
 *    en el creador (escribe por XML); esto repara lo que aquel defecto dejó.
 *
 * 🔴 SE RESTAURA POR NOMBRE DE COLUMNA, NUNCA POR LETRA. Desde el 15-sep se agregaron, movieron y
 *    retiraron columnas: `Principal_Clicks` estaba en otra letra. Copiar por posición pintaría el
 *    color de una columna sobre otra — el mismo error de leer por índice que ya costó dos defectos.
 *
 * 🔴 Y SOLO SE COPIA LO VISUAL: relleno, fuente, borde y alineación. **El `numFmt` del destino NO
 *    se toca.** Importar el del origen revertiría cualquier formato numérico que Rick haya cambiado
 *    después del 15-sep, y él pidió restaurar los COLORES, no volver a una versión vieja. El
 *    formato numérico ya está verificado aparte con `resumen.comparar-formato.js`.
 *
 * 🔴 EL ESTILO DE UNA COLUMNA = el de su fila 1 (encabezado) y el de su fila 2 (datos). Es la misma
 *    convención que ya usa `resumen.mover-columnas.js`, no una que invento aquí.
 *
 *   node resumen.restaurar-estilos.js <fuente.xlsx>              (seco: qué haría)
 *   node resumen.restaurar-estilos.js <fuente.xlsx> --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var FUENTE = process.argv[2];
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
if (!FUENTE || !fs.existsSync(FUENTE)) { console.log('uso: node resumen.restaurar-estilos.js <fuente.xlsx> [--escribir]'); process.exit(2); }

console.log('════════ resumen · RESTAURAR ESTILOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

/* ══ PARTIR UN BLOQUE DE `styles.xml` EN SUS ELEMENTOS ════════════════════════════════════════
 * 🔴 ESTO YA SE EQUIVOCÓ UNA VEZ Y EL ERROR ERA INVISIBLE. La primera versión usaba
 *      /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
 *    —la alternancia DENTRO, después de un `[^>]*` compartido— y con eso `<xf a/><xf b/><xf c>
 *    <alignment/></xf>` devuelve **DOS** elementos en vez de cuatro: el `[^>]*` codicioso se come
 *    la barra del auto-cerrado, la rama `\/>` falla, y la rama `>…</xf>` se traga todo hasta el
 *    siguiente `</xf>`. Resultado: los índices de estilo salen CORRIDOS, así que a 27 columnas de
 *    `Data_Email` se les aplicó el estilo de otra. Y no truena: devuelve estilos, solo que los
 *    equivocados. Lo cazó `xlsx-safe-save` por un síntoma lateral —«<cellXfs> declara 64 y hay 74»—
 *    no por el daño en sí.
 * 🔴 LA FORMA CORRECTA es la alternancia ARRIBA, con la rama auto-cerrada PRIMERO. Probado sobre
 *    el caso mínimo: 4 de 4.
 */
function ELEM(tag) {
  return new RegExp('<' + tag + '\\b[^>]*\\/>|<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'g');
}

// ── leer un libro: sus partes, sus catálogos de estilo y sus encabezados por hoja ──────────────
function abrir(ruta) {
  var zip = new AdmZip(ruta);
  var wbx = zip.readAsText('xl/workbook.xml');
  var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
  var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = String(tg).replace(/^\//, ''); return _; });
  var partes = {};
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
    partes[n.replace(/&amp;/g, '&')] = 'xl/' + String(rmap[rid] || '').replace(/^xl\//, ''); return _;
  });
  var st = zip.readAsText('xl/styles.xml') || '';
  function lista(nom, re) { var m = new RegExp('<' + nom + '[^>]*>([\\s\\S]*?)</' + nom + '>').exec(st); return m ? (m[1].match(re) || []) : []; }
  return {
    zip: zip, ruta: ruta, wbx: wbx, st: st, partes: partes,
    fonts: lista('fonts', ELEM('font')),
    fills: lista('fills', ELEM('fill')),
    borders: lista('borders', ELEM('border')),
    xfs: (function () {
      var m = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
      return m ? (m[1].match(ELEM('xf')) || []) : [];
    })()
  };
}
function attr(x, n) { var m = new RegExp(n + '="([^"]*)"').exec(x); return m ? m[1] : null; }
function alineacion(x) { var m = /<alignment[^>]*\/>/.exec(x); return m ? m[0] : null; }

var O = abrir(FUENTE);                                   // origen: el libro con los colores
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_estilos.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var D = abrir(TMP);                                      // destino: el libro de hoy

console.log('  origen : ' + path.basename(FUENTE) + '   ·   ' + O.fills.length + ' fills · ' + O.fonts.length + ' fonts · ' + O.borders.length + ' borders · ' + O.xfs.length + ' xfs');
console.log('  destino: ' + path.basename(vivo.ruta) + '   ·   ' + D.fills.length + ' fills · ' + D.fonts.length + ' fonts · ' + D.borders.length + ' borders · ' + D.xfs.length + ' xfs\n');

// ── importar un catálogo del origen al destino, sin duplicar ───────────────────────────────────
function importador(destino, origen) {
  var idx = {}; destino.forEach(function (x, i) { idx[x] = i; });
  return function (iOrigen) {
    var x = origen[iOrigen]; if (x === undefined) return null;
    if (idx[x] !== undefined) return idx[x];
    destino.push(x); idx[x] = destino.length - 1; return destino.length - 1;
  };
}
var impFont = importador(D.fonts, O.fonts);
var impFill = importador(D.fills, O.fills);
var impBorder = importador(D.borders, O.borders);

/* 🔴 El xf nuevo = lo VISUAL del origen + el `numFmtId` que YA TIENE el destino. Así se recuperan
 *    los colores sin revertir ningún formato numérico posterior al 15-sep. */
var xfIdx = {}; D.xfs.forEach(function (x, i) { xfIdx[x] = i; });
function xfMezclado(iDestino, iOrigen) {
  var xo = O.xfs[iOrigen]; if (xo === undefined) return null;
  var xd = D.xfs[iDestino] !== undefined ? D.xfs[iDestino] : '<xf numFmtId="0"/>';
  var nf = attr(xd, 'numFmtId') || '0';
  var f = impFont(+(attr(xo, 'fontId') || 0));
  var fl = impFill(+(attr(xo, 'fillId') || 0));
  var b = impBorder(+(attr(xo, 'borderId') || 0));
  var al = alineacion(xo);
  var nuevo = '<xf numFmtId="' + nf + '" fontId="' + f + '" fillId="' + fl + '" borderId="' + b + '" xfId="0"' +
    ' applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1"' : '') +
    (al ? '>' + al + '</xf>' : '/>');
  if (xfIdx[nuevo] !== undefined) return xfIdx[nuevo];
  D.xfs.push(nuevo); xfIdx[nuevo] = D.xfs.length - 1; return D.xfs.length - 1;
}

// ── el estilo de cada columna en el ORIGEN, por NOMBRE ─────────────────────────────────────────
function encabezados(libro, hoja) {
  try { return (XLSX.utils.sheet_to_json(XLSX.readFile(libro.ruta).Sheets[hoja], { header: 1, defval: '' })[0] || []).map(t); }
  catch (e) { return []; }
}
function sDe(xml, ref) {
  var m = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>)').exec(xml);
  return m ? (attr(m[1], ' s') !== null ? +attr(m[1], ' s') : (/ s="(\d+)"/.exec(m[1]) ? +/ s="(\d+)"/.exec(m[1])[1] : null)) : null;
}

var informe = [], totalCeldas = 0, hojasTocadas = 0;
var nuevosXml = {};   // parte → xml modificado

Object.keys(O.partes).forEach(function (hoja) {
  if (!D.partes[hoja]) { informe.push({ hoja: hoja, nota: 'no existe en el destino — se ignora' }); return; }
  var xmlO = O.zip.readAsText(O.partes[hoja]) || '';
  var xmlD = D.zip.readAsText(D.partes[hoja]) || '';
  var encO = encabezados(O, hoja), encD = encabezados(D, hoja);
  var sO = {};   // nombre → { enc, dato }
  encO.forEach(function (h, i) {
    if (!h) return;
    sO[h] = { enc: sDe(xmlO, col(i) + '1'), dato: sDe(xmlO, col(i) + '2') };
  });

  // el color de pestaña
  var tabO = (/<tabColor[^>]*\/>/.exec(xmlO) || [])[0] || null;
  var tabD = (/<tabColor[^>]*\/>/.exec(xmlD) || [])[0] || null;
  var ponTab = tabO && tabO !== tabD;

  // cuántas filas tiene el destino, para pintar toda la columna
  var maxFila = 1;
  (xmlD.match(/<row r="(\d+)"/g) || []).forEach(function (r) { maxFila = Math.max(maxFila, +/(\d+)/.exec(r)[1]); });

  var cambios = 0, sinPareja = [];
  var mapa = {};   // ref de celda → nuevo s
  encD.forEach(function (h, i) {
    if (!h) return;
    var src = sO[h];
    if (!src) { sinPareja.push(h); return; }
    var letra = col(i);
    if (src.enc !== null) {
      var n = xfMezclado(sDe(xmlD, letra + '1'), src.enc);
      if (n !== null) { mapa[letra + '1'] = n; cambios++; }
    }
    if (src.dato !== null) {
      var nd = xfMezclado(sDe(xmlD, letra + '2'), src.dato);
      if (nd !== null) for (var r = 2; r <= maxFila; r++) { mapa[letra + r] = nd; cambios++; }
    }
  });

  if (!cambios && !ponTab) { informe.push({ hoja: hoja, nota: 'nada que restaurar' }); return; }
  hojasTocadas++; totalCeldas += cambios;
  informe.push({ hoja: hoja, celdas: cambios, tab: ponTab ? tabO : null, sinPareja: sinPareja.length });

  if (ESCRIBIR) {
    // aplicar el `s` de cada celda que exista en el XML del destino
    var nuevo = xmlD.replace(/<c r="([A-Z]+\d+)"([^>]*?)(\/>|>)/g, function (todo, ref, at, cierre) {
      if (mapa[ref] === undefined) return todo;
      var sinS = at.replace(/\s*s="\d+"/, '');
      return '<c r="' + ref + '" s="' + mapa[ref] + '"' + sinS + cierre;
    });
    if (ponTab) {
      nuevo = /<sheetPr[^>]*>[\s\S]*?<\/sheetPr>/.test(nuevo)
        ? nuevo.replace(/<sheetPr([^>]*)>([\s\S]*?)<\/sheetPr>/, function (_, a, c) { return '<sheetPr' + a + '>' + (/<tabColor/.test(c) ? c.replace(/<tabColor[^>]*\/>/, tabO) : tabO + c) + '</sheetPr>'; })
        : /<sheetPr[^>]*\/>/.test(nuevo)
          ? nuevo.replace(/<sheetPr([^>]*)\/>/, '<sheetPr$1>' + tabO + '</sheetPr>')
          : nuevo.replace(/(<worksheet[^>]*>)/, '$1<sheetPr>' + tabO + '</sheetPr>');
    }
    nuevosXml[D.partes[hoja]] = nuevo;
  }
});

/* ══ LAS COLUMNAS QUE NO EXISTÍAN EN EL ORIGEN — HEREDAN DE SU HERMANA ════════════════════════
 * 🔴 Las 9 de clicks nacieron después del 15-sep, así que el origen no tiene su estilo y quedaban
 *    como el único hueco blanco de una banda de encabezados que Rick tiene coloreada entera. No se
 *    inventa un color: se copia el de la columna que hace lo mismo en su bloque, que es la misma
 *    regla que ya usa `resumen.mover-columnas.js` («el formato se hereda de la hermana, nunca se
 *    inventa un numFmt»). Va declarado y no deducido: una hermana adivinada por parecido de nombre
 *    es exactamente el tipo de atajo que ya movió datos a la columna de al lado.
 * 🔴 Y SE CONSERVA EL `numFmt` PROPIO: se hereda lo visual, no el formato numérico — `Clicks_CTA`
 *    ya tiene su `#,##0` correcto y no debe tomar el de nadie. */
var HERMANAS = [
  { hoja: 'Report_Resumen', columna: 'Principal_Clicks_CTA', hermana: 'Principal_Clicks' },
  { hoja: 'Report_Resumen', columna: 'Principal_Clicks_Baja', hermana: 'Principal_Clicks' },
  { hoja: 'Report_Resumen', columna: 'Principal_Clicks_Redes+Navegador+Legal', hermana: 'Principal_Clicks' },
  { hoja: 'Report_Resumen', columna: 'FUP_Clicks_CTA', hermana: 'FUP_Clicks' },
  { hoja: 'Report_Resumen', columna: 'FUP_Clicks_Baja', hermana: 'FUP_Clicks' },
  { hoja: 'Report_Resumen', columna: 'FUP_Clicks_Redes+Navegador+Legal', hermana: 'FUP_Clicks' },
  { hoja: 'Report_Resumen', columna: 'Tot_Clicks_CTA', hermana: 'Tot_Clicks' },
  { hoja: 'Report_Resumen', columna: 'Tot_Clicks_Baja', hermana: 'Tot_Clicks' },
  { hoja: 'Report_Resumen', columna: 'Tot_Clicks_Redes+Navegador+Legal', hermana: 'Tot_Clicks' }
];
var heredadas = 0, sinHermana = [];
(function () {
  var porHoja = {};
  HERMANAS.forEach(function (h) { (porHoja[h.hoja] = porHoja[h.hoja] || []).push(h); });
  Object.keys(porHoja).forEach(function (hoja) {
    if (!D.partes[hoja]) return;
    var xmlD = nuevosXml[D.partes[hoja]] || D.zip.readAsText(D.partes[hoja]) || '';
    var encD = encabezados(D, hoja);
    var maxFila = 1;
    (xmlD.match(/<row r="(\d+)"/g) || []).forEach(function (r) { maxFila = Math.max(maxFila, +/(\d+)/.exec(r)[1]); });
    var mapa = {};
    porHoja[hoja].forEach(function (h) {
      var i = encD.indexOf(h.columna), j = encD.indexOf(h.hermana);
      if (i < 0 || j < 0) { sinHermana.push(h.columna + (i < 0 ? ' (no existe)' : ' (falta su hermana ' + h.hermana + ')')); return; }
      var li = col(i), lj = col(j);
      // el encabezado se copia TAL CUAL: una celda de encabezado no lleva formato numérico propio
      var sEnc = sDe(xmlD, lj + '1');
      if (sEnc !== null) { mapa[li + '1'] = sEnc; heredadas++; }
      // en los datos se toma lo visual de la hermana conservando el numFmt de esta columna
      var sHer = sDe(xmlD, lj + '2'), sMio = sDe(xmlD, li + '2');
      if (sHer !== null) {
        var xh = D.xfs[sHer], xm = D.xfs[sMio] !== undefined ? D.xfs[sMio] : '<xf numFmtId="0"/>';
        var nf = attr(xm, 'numFmtId') || '0';
        var nuevo = String(xh).replace(/numFmtId="\d+"/, 'numFmtId="' + nf + '"');
        var k = xfIdx[nuevo]; if (k === undefined) { D.xfs.push(nuevo); k = xfIdx[nuevo] = D.xfs.length - 1; }
        for (var r = 2; r <= maxFila; r++) { mapa[li + r] = k; heredadas++; }
      }
    });
    if (!Object.keys(mapa).length) return;
    if (ESCRIBIR) {
      nuevosXml[D.partes[hoja]] = xmlD.replace(/<c r="([A-Z]+\d+)"([^>]*?)(\/>|>)/g, function (todo, ref, at, cierre) {
        if (mapa[ref] === undefined) return todo;
        return '<c r="' + ref + '" s="' + mapa[ref] + '"' + at.replace(/\s*s="\d+"/, '') + cierre;
      });
    }
  });
})();
console.log('  ── heredan de su hermana (no existían en el origen): ' + heredadas + ' celda(s)' +
  (sinHermana.length ? '   ⚠ sin resolver: ' + sinHermana.join(' · ') : ''));

console.log('  ── qué se restaura, hoja por hoja');
informe.forEach(function (i) {
  if (i.nota) { console.log('     ' + i.hoja.padEnd(24) + i.nota); return; }
  console.log('     ' + i.hoja.padEnd(24) + String(i.celdas).padStart(7) + ' celda(s)' +
    (i.tab ? '   pestaña ' + i.tab.replace(/<tabColor|\/>|rgb=|"/g, '').trim() : '') +
    (i.sinPareja ? '   ·   ' + i.sinPareja + ' columna(s) nuevas sin pareja en el origen (se quedan como están)' : ''));
});
console.log('\n  total: ' + totalCeldas.toLocaleString('es-MX') + ' celdas en ' + hojasTocadas + ' hoja(s)');
console.log('  catálogos tras importar: ' + D.fills.length + ' fills · ' + D.fonts.length + ' fonts · ' + D.borders.length + ' borders · ' + D.xfs.length + ' xfs');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ ESCRIBIR ═══════════════════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-restaurar-estilos.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

// styles.xml con los catálogos ampliados
var stNuevo = D.st
  .replace(/<fonts[^>]*>[\s\S]*?<\/fonts>/, '<fonts count="' + D.fonts.length + '">' + D.fonts.join('') + '</fonts>')
  .replace(/<fills[^>]*>[\s\S]*?<\/fills>/, '<fills count="' + D.fills.length + '">' + D.fills.join('') + '</fills>')
  .replace(/<borders[^>]*>[\s\S]*?<\/borders>/, '<borders count="' + D.borders.length + '">' + D.borders.join('') + '</borders>')
  .replace(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/, '<cellXfs count="' + D.xfs.length + '">' + D.xfs.join('') + '</cellXfs>');
D.zip.updateFile('xl/styles.xml', Buffer.from(stNuevo, 'utf8'));
Object.keys(nuevosXml).forEach(function (p) { D.zip.updateFile(p, Buffer.from(nuevosXml[p], 'utf8')); });
D.zip.writeZip(TMP);
console.log('     ✔ styles.xml y ' + Object.keys(nuevosXml).length + ' hoja(s) reescritas');

// ── las 5 capas ───────────────────────────────────────────────────────────────────────────────
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('     ✔ ' + nom.padEnd(22) + t(r).split('\n').pop().slice(0, 62)); return true; }
  catch (e) { console.log('     🔴 ' + nom + ': ' + t((e.stdout || '') + (e.stderr || '')).split('\n').slice(-3).join(' ').slice(0, 160)); return false; }
}
console.log('\n  ── las 5 capas');
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP, '--salida', TMP])) { console.log('\n  🔴 NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log('\n  ✅ ESTILOS RESTAURADOS');
