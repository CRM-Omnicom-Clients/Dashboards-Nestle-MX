// Q7 · ANEXAR A LAS HOJAS DE QCART LOS EVENTOS NUEVOS DEL BLOQUE.
//
// 🔴 POR QUÉ HACE FALTA. `N4` actualiza por llave las filas que ya existen, pero no anexa —igual
//    que `N6`, y por la misma razón: cuando la identidad de un registro cambia, un escritor que
//    anexa produce gemelos silenciosos. Su salida es que la hoja tenga MENOS filas que el bloque,
//    y eso ya no es una precaución: es un dato que no llegó. Este paso cierra ese hueco para
//    Qcart, que son logs —nunca cambian de identidad— y por eso aquí anexar es seguro.
//
// 🔴 LA LLAVE ES LA DEL EVENTO, la misma que usa el bloque (`lib-qcart.llaveEvento`). No se
//    inventa una nueva aquí: si el bloque y el escritor usaran llaves distintas, uno de los dos
//    vería duplicados que el otro no.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var HOJAS = [
  { hoja: 'Data_Qcart_Carritos', datos: Q.carritos || [] },
  { hoja: 'Data_Qcart_Productos', datos: Q.productos || [] }
];
console.log('════════ Q7 · ANEXAR EVENTOS DE QCART ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_q7.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var partes = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { partes[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

var totalAnexadas = 0;
HOJAS.forEach(function (H) {
  var sh = wb.Sheets[H.hoja];
  if (!sh) { console.log('  🔴 no existe ' + H.hoja); return; }
  var enc = XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || [];
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  // 🔴 el mapa nombre-de-columna → campo del bloque, por NOMBRE (nunca por posición)
  var alias = { 'fecha': 'fecha', 'hora': 'hora', 'shortlink_code': 'shortlink_code', 'shortlink_name': 'shortlink_name',
    'utm_campaign': 'utm_campaign', 'utm_medium': 'utm_medium', 'utm_source': 'utm_source', 'utm_content': 'utm_content',
    'utm_term': 'utm_term', 'store': 'store', 'n_tiendas': 'n_tiendas', 'impressions': 'impressions', 'views': 'views',
    'total_shown_price': 'total_shown_price', 'activacion_link': 'activacion_link', 'link_campana': 'link_campana',
    'fuente': 'fuente', 'fila_en_csv': 'fila_en_csv', 'aviso': 'aviso', 'pieza_id': 'pieza_id', 'product': 'product',
    'BU': 'bu_canonico', 'Marca': 'marca_canonica', 'Campana_Canonica': 'campana_canonica', 'Segmento_Canonico': 'segmento_canonico' };
  var enHoja = {};
  F.forEach(function (x) { enHoja[C.llaveEvento(mapa(x, enc, alias))] = 1; });
  var nuevas = H.datos.filter(function (e) { return !enHoja[C.llaveEvento(e)]; });
  console.log('  ' + H.hoja.padEnd(24) + 'hoja ' + mil(F.length) + '   bloque ' + mil(H.datos.length) + '   a anexar ' + mil(nuevas.length));
  if (!nuevas.length || !ESCRIBIR) return;

  var xml = zip.readAsText(partes[H.hoja]);
  var estilo = {}; enc.forEach(function (n, i) { estilo[i] = CX.estiloDe(xml, R.letra(i) + '2') || CX.estiloDe(xml, 'A1'); });
  var ultima = 1;
  xml.replace(/<row r="(\d+)"/g, function (_, n2) { ultima = Math.max(ultima, +n2); return _; });
  var filasXml = '';
  nuevas.forEach(function (e, k) {
    var nf = ultima + 1 + k, celdas = [];
    enc.forEach(function (nom, i) {
      var campo = alias[t(nom)] || t(nom);
      var v = e[campo];
      if (v === undefined || v === null || v === '') return;
      celdas.push(CX.celda(R.letra(i) + nf, v, estilo[i]));
    });
    filasXml += '<row r="' + nf + '">' + celdas.join('') + '</row>';
  });
  xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
    return '<dimension ref="' + c1 + r1 + ':' + c2 + (ultima + nuevas.length) + '"/>';
  });
  zip.updateFile(partes[H.hoja], Buffer.from(xml, 'utf8'));
  totalAnexadas += nuevas.length;
});
// 🔴 La hoja guarda `fecha` y `hora` en columnas separadas; el bloque lleva `fecha_hora`, y la
//    llave del evento usa `fecha_hora || fecha`. Sin reconstruirla, la fila de la hoja produce
//    una llave más corta que la del bloque y NINGUNA empareja: el anexador creía que las 3,009
//    eran nuevas y habría duplicado la hoja entera. Se mapea a la forma del bloque y se usa SU
//    llave — no una copia de la regla.
function mapa(fila, enc, alias) {
  var o = {};
  enc.forEach(function (n) { var campo = alias[t(n)] || t(n); o[campo] = fila[n]; });
  if (!o.fecha_hora && o.fecha) o.fecha_hora = t(o.fecha) + (t(o.hora) ? 'T' + t(o.hora) : '');
  return o;
}
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }
if (!totalAnexadas) { console.log('\n  ✅ nada que anexar.'); process.exit(0); }
zip.writeZip(SECO);
console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
var wb2 = XLSX.readFile(SECO);
HOJAS.forEach(function (H) {
  var F = XLSX.utils.sheet_to_json(wb2.Sheets[H.hoja], { defval: '', blankrows: false });
  console.log('  ── releído: ' + H.hoja.padEnd(24) + mil(F.length) + ' filas   el bloque dice ' + mil(H.datos.length) + '   ' + (F.length === H.datos.length ? '✔' : '🔴'));
});
console.log('\n  archivo listo en: ' + SECO);
