/*
 * lib-hoja-xml.js — ESCRIBIR UNA HOJA ENTERA SIN QUE SHEETJS TOQUE EL LIBRO.
 *
 * 🔴 POR QUÉ EXISTE, Y ES UN DEFECTO MÍO MEDIDO (20-sep-2026). `escritor.hojas-clicks.js` creaba
 *    `Data_Clicks` y `Dic_Clicks` con `XLSX.writeFile(wb, TMP)`. La regla del proyecto lo dice sin
 *    ambigüedad —«SheetJS BORRA todos los estilos de celda en cada writeFile; edita el XML con
 *    adm-zip»— y aun así lo escribí así. Coste, medido comparando el numFmt columna por columna
 *    antes y después: **56 columnas de `Report_Resumen` perdieron su formato**. Las fechas pasaron
 *    de `dd/mm/yyyy` a `General`, las tasas de `0.0%` a `0.13253901`, y los importes perdieron su
 *    máscara de moneda. El formato es de Rick (E5) y una escritura del sistema no puede tocarlo.
 *
 * 🔴 Y NINGUNA PUERTA LO VE, por construcción: las puertas comparan VALORES, y el valor no cambia
 *    cuando se pierde un numFmt. El 0.13253901 y el 13.3% son el mismo número. Lo vi en el render
 *    —la regla de «míralo antes de decir que quedó bien»— y lo confirmó `resumen.comparar-formato.js`.
 *
 * QUÉ HACE: escribe hojas completas manipulando el paquete OPC directamente.
 *   · si la hoja ya existe → reemplaza SOLO su parte XML; el resto del zip no se toca
 *   · si no existe        → crea su parte y la registra en workbook.xml, en los rels y en
 *                           [Content_Types].xml
 *   · los textos van como `inlineStr`, así no hay que tocar `sharedStrings.xml` ni reindexar nada
 *
 * ⚠ ESTO NO PONE FORMATO, y es a propósito: escribe hojas de datos crudos que nacen sin estilo.
 *   Lo que garantiza es no DESTRUIR el de las demás, que es la otra mitad de la regla E5.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var AdmZip = require('adm-zip');

var NS_HOJA = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
var CT_HOJA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

/* 🔴 El escape va completo: `&` primero o se re-escaparía lo ya escapado. Y se quitan los
 *    caracteres de control que XML 1.0 prohíbe — una URL rara con un \x01 hace que Excel declare
 *    el archivo dañado, y el mensaje no dice dónde. */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Una fila de valores → su XML. Los números van como `<v>`; todo lo demás como texto en línea. */
function filaXml(valores, r) {
  var celdas = '';
  valores.forEach(function (v, i) {
    if (v === null || v === undefined || v === '') return;          // una celda vacía no se escribe
    var ref = col(i) + r;
    if (typeof v === 'number' && isFinite(v)) { celdas += '<c r="' + ref + '"><v>' + v + '</v></c>'; return; }
    celdas += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  });
  return '<row r="' + r + '">' + celdas + '</row>';
}

function hojaXml(aoa) {
  var maxC = 0;
  aoa.forEach(function (f) { if (f.length > maxC) maxC = f.length; });
  var filas = aoa.map(function (f, i) { return filaXml(f, i + 1); }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:' + col(Math.max(maxC, 1) - 1) + Math.max(aoa.length, 1) + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<sheetData>' + filas + '</sheetData>' +
    '</worksheet>';
}

/**
 * Escribe hojas en un .xlsx sin pasar por SheetJS.
 * @param ruta   el archivo a modificar (se escribe en el sitio; usa un TEMPORAL, no el vivo)
 * @param hojas  { 'Nombre_De_Hoja': [[fila],[fila],…] }
 * @returns { creadas: [], reemplazadas: [] }
 */
function escribir(ruta, hojas) {
  var zip = new AdmZip(ruta);
  var wbx = zip.readAsText('xl/workbook.xml');
  var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
  var cts = zip.readAsText('[Content_Types].xml');

  var rmap = {};
  rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = String(tg).replace(/^\//, ''); return _; });
  var existentes = {};
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"[^>]*\/>/g, function (_, n, rid) {
    existentes[n.replace(/&amp;/g, '&')] = rmap[rid] ? 'xl/' + rmap[rid].replace(/^xl\//, '') : null;
    return _;
  });

  // el siguiente rId y el siguiente sheetId libres — se calculan, no se adivinan
  var maxR = 0; rels.replace(/Id="rId(\d+)"/g, function (_, n) { maxR = Math.max(maxR, +n); return _; });
  var maxS = 0; wbx.replace(/sheetId="(\d+)"/g, function (_, n) { maxS = Math.max(maxS, +n); return _; });
  var usados = {}; zip.getEntries().forEach(function (e) {
    var m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(e.entryName); if (m) usados[m[1]] = 1;
  });

  var creadas = [], reemplazadas = [];
  Object.keys(hojas).forEach(function (nom) {
    var xml = hojaXml(hojas[nom]);
    if (existentes[nom]) {
      // 🔴 SOLO se reemplaza la parte de ESA hoja. El resto del paquete —estilos incluidos— queda
      //    byte a byte como estaba, que es justo lo que SheetJS no puede prometer.
      zip.updateFile(existentes[nom], Buffer.from(xml, 'utf8'));
      reemplazadas.push(nom);
      return;
    }
    var k = 1; while (usados[String(k)]) k++;
    usados[String(k)] = 1;
    var parte = 'xl/worksheets/sheet' + k + '.xml';
    maxR++; maxS++;
    var rid = 'rId' + maxR;
    zip.addFile(parte, Buffer.from(xml, 'utf8'));
    rels = rels.replace(/<\/Relationships>/,
      '<Relationship Id="' + rid + '" Type="' + NS_HOJA + '" Target="worksheets/sheet' + k + '.xml"/></Relationships>');
    wbx = wbx.replace(/<\/sheets>/,
      '<sheet name="' + esc(nom) + '" sheetId="' + maxS + '" r:id="' + rid + '"/></sheets>');
    cts = cts.replace(/<\/Types>/,
      '<Override PartName="/' + parte + '" ContentType="' + CT_HOJA + '"/></Types>');
    creadas.push(nom);
  });

  if (creadas.length) {
    zip.updateFile('xl/workbook.xml', Buffer.from(wbx, 'utf8'));
    zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
    zip.updateFile('[Content_Types].xml', Buffer.from(cts, 'utf8'));
  }
  zip.writeZip(ruta);
  return { creadas: creadas, reemplazadas: reemplazadas };
}

module.exports = { escribir: escribir, hojaXml: hojaXml, col: col, esc: esc };
