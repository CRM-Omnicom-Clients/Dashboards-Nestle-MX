/*
 * resumen.censo-estilos.js — ¿QUÉ ESTILO TIENE CADA HOJA? Relleno, negrita, borde y color de pestaña.
 *
 * 🔴 POR QUÉ. `XLSX.writeFile` no solo borra los `numFmt` (eso ya se midió y se arregló): borra
 *    TODOS los estilos de celda y los colores de pestaña. El numFmt se comparó y se restauró; los
 *    colores hay que medirlos aparte, porque viven en otras partes de `styles.xml` (`fills`,
 *    `fonts`, `borders`) y en `<sheetPr><tabColor>`.
 *
 * 🔴 Y NO SE ARREGLA A CIEGAS: primero hay que encontrar CUÁL respaldo todavía los tiene. Los
 *    respaldos se sobrescriben en cada corrida, así que el que se llama «antes-de-X» puede ser de
 *    la quinta vez que corrió X, con el daño ya dentro. Este censo se corre sobre varios y el que
 *    tenga colores es la fuente de verdad.
 *
 *   node resumen.censo-estilos.js <archivo.xlsx> [...más archivos]
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var AdmZip = require('adm-zip');
var t = function (v) { return String(v == null ? '' : v).trim(); };
/* 🔴 la alternancia va ARRIBA y la rama auto-cerrada PRIMERO. Con la alternancia dentro de un
 * `[^>]*` compartido, `<xf a/><xf b/><xf c><alignment/></xf>` devuelve DOS elementos y los índices
 * de estilo salen corridos — ya le aplicó a 27 columnas el estilo de otra, sin tronar. */
function ELEM(tag) {
  return new RegExp('<' + tag + '\\b[^>]*\\/>|<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'g');
}
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

function censo(ruta) {
  var zip = new AdmZip(ruta);
  var st = zip.readAsText('xl/styles.xml') || '';
  var wbx = zip.readAsText('xl/workbook.xml');
  var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
  var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = String(tg).replace(/^\//, ''); return _; });

  // los catálogos de styles.xml
  function bloque(nom) { var m = new RegExp('<' + nom + '[^>]*>([\\s\\S]*?)</' + nom + '>').exec(st); return m ? m[1] : ''; }
  var fills = (bloque('fills').match(ELEM('fill')) || []);
  var fonts = (bloque('fonts').match(ELEM('font')) || []);
  var borders = (bloque('borders').match(ELEM('border')) || []);
  // fills con color de verdad (los 2 primeros son siempre none/gray125)
  var fillsConColor = fills.filter(function (f) { return /<fgColor[^>]*(rgb|theme)=/.test(f); }).length;
  var fontsNegrita = fonts.filter(function (f) { return /<b\/>|<b /.test(f); }).length;
  var fontsColor = fonts.filter(function (f) { return /<color[^>]*(rgb|theme)=/.test(f); }).length;
  var bordesReales = borders.filter(function (b) { return /style="/.test(b); }).length;

  // cellXfs → índice de estilo a { fill, font, border }
  var xfs = [];
  var mx = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
  if (mx) (mx[1].match(ELEM('xf')) || []).forEach(function (x) {
    xfs.push({
      fill: +((/fillId="(\d+)"/.exec(x) || [])[1] || 0),
      font: +((/fontId="(\d+)"/.exec(x) || [])[1] || 0),
      border: +((/borderId="(\d+)"/.exec(x) || [])[1] || 0)
    });
  });

  var hojas = [];
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
    var parte = 'xl/' + String(rmap[rid] || '').replace(/^xl\//, '');
    var xml = '';
    try { xml = zip.readAsText(parte) || ''; } catch (e) { }
    var tab = (/<tabColor[^>]*\/>/.exec(xml) || [])[0] || null;
    // el estilo de la fila 1 (encabezados): ¿tiene relleno?, ¿negrita?
    var conFill = 0, conNegrita = 0, celdas1 = 0;
    (xml.match(/<c r="[A-Z]+1"[^>]*/g) || []).forEach(function (c) {
      celdas1++;
      var s = (/ s="(\d+)"/.exec(c) || [])[1];
      var x = s !== undefined ? xfs[+s] : null;
      if (x && x.fill > 1) conFill++;
      if (x && fonts[x.font] && /<b\/>|<b /.test(fonts[x.font])) conNegrita++;
    });
    hojas.push({ nombre: n.replace(/&amp;/g, '&'), tabColor: tab, encabezados: celdas1, conFill: conFill, conNegrita: conNegrita });
    return _;
  });

  return {
    archivo: path.basename(ruta),
    fills: fills.length, fillsConColor: fillsConColor,
    fonts: fonts.length, fontsNegrita: fontsNegrita, fontsColor: fontsColor,
    borders: borders.length, bordesReales: bordesReales,
    xfs: xfs.length, hojas: hojas
  };
}

var rutas = process.argv.slice(2);
if (!rutas.length) { console.log('uso: node resumen.censo-estilos.js <archivo.xlsx> [...]'); process.exit(2); }

console.log('════════ CENSO DE ESTILOS ════════\n');
console.log('  ' + 'archivo'.padEnd(38) + 'fills'.padStart(6) + ' c/color'.padStart(9) + '  fonts'.padStart(7) + ' negrita'.padStart(9) + ' c/color'.padStart(9) + '  bordes'.padStart(8) + '  xfs'.padStart(6));
var todos = [];
rutas.forEach(function (r) {
  var c;
  try { c = censo(r); } catch (e) { console.log('  🔴 ' + path.basename(r) + ': ' + e.message.slice(0, 60)); return; }
  todos.push(c);
  console.log('  ' + c.archivo.slice(0, 37).padEnd(38) + String(c.fills).padStart(6) + String(c.fillsConColor).padStart(9) +
    String(c.fonts).padStart(7) + String(c.fontsNegrita).padStart(9) + String(c.fontsColor).padStart(9) +
    String(c.bordesReales).padStart(8) + String(c.xfs).padStart(6));
});

todos.forEach(function (c) {
  console.log('\n  ── ' + c.archivo + '   ·   encabezados con relleno / con negrita, por hoja');
  c.hojas.forEach(function (h) {
    console.log('     ' + h.nombre.padEnd(24) + String(h.conFill).padStart(4) + ' / ' + String(h.conNegrita).padStart(4) +
      ' de ' + String(h.encabezados).padStart(3) + (h.tabColor ? '   pestaña: ' + h.tabColor.replace(/<tabColor|\/>/g, '').trim() : '   (sin color de pestaña)'));
  });
});
