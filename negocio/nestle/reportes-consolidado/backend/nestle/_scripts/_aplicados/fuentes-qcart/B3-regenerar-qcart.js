// B3 · REGENERAR LAS DOS HOJAS DE QCART DESDE EL BLOQUE LIMPIO.
//
// 🔴 La hoja tiene 3,009 carritos y 809 productos; el bloque, tras la purga de A1 y el rebuild de
//    B0, tiene 2,645 y 696. Anexar no puede QUITAR filas, y editar celda a celda 63,000 celdas no
//    es una edición, es una regeneración. Se le declara al acumulador «esta hoja queda así» y el
//    escritor único la reconstruye. La forma de la hoja MANDA: se escribe columna por nombre.
//
// 🔴 Y el mapeo es el contrato de escritura de esta fuente (F2): cada columna de la hoja, de qué
//    campo del bloque sale. Escrito, no implícito.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// el mapeo nombre-de-columna-en-la-hoja → campo-del-bloque. La misma tabla que usa Q7 al leer.
var ALIAS = {
  'fecha': 'fecha', 'hora': 'hora', 'shortlink_code': 'shortlink_code', 'shortlink_name': 'shortlink_name',
  'utm_campaign': 'utm_campaign', 'utm_medium': 'utm_medium', 'utm_source': 'utm_source', 'utm_content': 'utm_content',
  'utm_term': 'utm_term', 'store': 'store', 'n_tiendas': 'n_tiendas', 'impressions': 'impressions', 'views': 'views',
  'total_shown_price': 'total_shown_price', 'activacion_link': 'activacion_link', 'link_campana': 'link_campana',
  'fuente': 'fuente', 'fila_en_csv': 'fila_en_csv', 'aviso': 'aviso', 'pieza_id': 'pieza_id', 'product': 'product',
  'BU': 'bu_canonico', 'Marca': 'marca_canonica', 'Campana_Canonica': 'campana_canonica', 'Segmento_Canonico': 'segmento_canonico'
};

console.log('════════ B3 · REGENERAR HOJAS DE QCART ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodoHoja('B3');

var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var F0 = os.homedir() + '/_b3.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

var HOJAS = [['Data_Qcart_Carritos', Q.carritos || []], ['Data_Qcart_Productos', Q.productos || []]];
HOJAS.forEach(function (H) {
  var hoja = H[0], bloque = H[1];
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || [];
  var F = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '', blankrows: false });

  // cada fila de la hoja, armada por NOMBRE de columna desde el evento del bloque
  var faltan = [];
  var filas = bloque.map(function (e) {
    var fila = {};
    enc.forEach(function (nom) {
      var campo = ALIAS[t(nom)] || t(nom);
      if (e[campo] === undefined && faltan.indexOf(t(nom)) < 0) faltan.push(t(nom));
      var v = e[campo];
      fila[t(nom)] = (v === undefined || v === null) ? '' : v;
    });
    return fila;
  });

  console.log('  ' + hoja.padEnd(24) + 'hoja ' + mil(F.length) + '  →  ' + mil(filas.length) + '   (Δ ' + (filas.length - F.length) + ')');
  console.log('     columnas de la hoja: ' + enc.length + '   ·   mapeadas: ' + (enc.length - faltan.length));
  if (faltan.length) console.log('     ⚠ sin campo en el bloque (quedan vacías): ' + faltan.join(', '));

  if (ESCRIBIR) {
    CB.regenerarHoja('B3', hoja, filas,
      'B3 · regenerada desde _fuentes/qcart.json tras la purga A1 y el rebuild B0. La hoja tenía ' +
      F.length + ' filas admitidas bajo una regla vieja; el bloque limpio tiene ' + filas.length + '.');
  }
});

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
var res = CB.resumen();
console.log('\n  ── hojas a regenerar: ' + (res.hojas || 0) + '   ·   celdas apuntadas: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo. Lo aplica escritor.escribir-todo.js.');
