// fuentes-qcart · EL DOC DE LINKS SOBRE LAS PIEZAS — el entregable que pidió Rick.
//
// 🔴 QUÉ ES. Una fila por BLOQUE del doc (MES × campaña × touchpoint × audiencia), con la pieza
//    que le corresponde, su `Email_Name` —que es la llave con la que todo cruza— y sus
//    shortlinks con sus carritos. Es la vista que contesta, de un vistazo, la pregunta de Rick:
//    «todas las filas de qcart-links vs todas las piezas asignadas por email name con sus
//    short links».
//
// 🔴 NO ESCRIBE EN EL EXCEL. Produce un .md que se entrega. Lo que sí hace es no mentir: un
//    bloque sin pieza sale como tal, y un `Email_Name` que aún no llega sale como POR DEFINIR
//    en vez de vacío — porque vacío se lee como «no aplica» y aquí sí aplica.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var M = require(BACK + '/_scripts/lib-maestro-links.js');
var Q = require(BACK + '/_scripts/lib-qcart-links.js');
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESTADO = /^(PENDIENTE|POR DEFINIR|N\/A|NA|-)$/i;

var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_doc-piezas.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TMP);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var NM = {};
['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Email_Name', 'Email_Type', 'Quincena'].forEach(function (id) { NM[id] = COL.de(CAT, id); });
var pieza = {}, codPieza = {};
CAT.forEach(function (p) {
  var id = t(p[NM.Pieza_ID]); if (!id) return;
  pieza[id] = p;
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { if (!ESTADO.test(t(c))) (codPieza[c] = codPieza[c] || []).push(id); });
  });
});
var CAR = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8')).carritos;
var carr = {}; CAR.forEach(function (e) { var c = t(e.shortlink_code); if (c) carr[c] = (carr[c] || 0) + 1; });

var idx = M.cargar();
var bloques = M.piezasDelDoc();
var filaDe = {}; idx.filas.forEach(function (f) { filaDe[f.codigo] = f; });

console.log('════════ EL DOC DE LINKS SOBRE LAS PIEZAS ════════\n');
var md = ['# El doc de Qcart-links sobre las piezas', '',
  '> Generado con `fuentes-qcart.doc-sobre-piezas.js` desde `Qcart-Links Mails-Hive- MX.xlsx`',
  '> y `Catalogo_Piezas`. **Una fila por bloque del doc** — mes × campaña × touchpoint × audiencia,',
  '> con sus shortlinks. Esa es la unidad: *cada fila del doc marca una pieza*.', '',
  '**Cómo se lee cada hoja del doc** (el lector busca el rol, no el nombre de la columna):', '',
  '| Hoja | Encabezado | Filas | Códigos |', '|---|---|---|---|'];
idx.hojas.forEach(function (h) {
  md.push('| ' + h.hoja + ' | ' + (h.leida ? 'fila ' + h.fila_encabezado : '**no se leyó**') + ' | ' +
    (h.leida ? h.filas : '—') + ' | ' + (h.leida ? (h.codigos_de_url ? h.codigos_de_url + ' de la URL' : 'de su columna') : h.motivo) + ' |');
});
md.push('', '---', '');

var conPieza = 0, sinPieza = 0, partidos = 0, totalCarr = 0;
var porMes = {};
bloques.forEach(function (b) { (porMes[b.mes] = porMes[b.mes] || []).push(b); });

['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'].forEach(function (mes) {
  var bs = porMes[mes]; if (!bs) return;
  md.push('## ' + mes, '', '| Campaña (doc) | Touchpoint | Audiencia | Pieza | TouchPoint · Segmento | Email_Name | Shortlink | Receta | Carritos |',
    '|---|---|---|---|---|---|---|---|---|');
  console.log('══ ' + mes + ' ══');
  bs.forEach(function (b) {
    var pzs = {}; b.codigos.forEach(function (c) { (codPieza[c] || []).forEach(function (p) { pzs[p] = 1; }); });
    var lista = Object.keys(pzs);
    var pid = lista.length === 1 ? lista[0] : null;
    if (pid) conPieza++; else if (!lista.length) sinPieza++; else partidos++;
    var p = pid ? pieza[pid] : null;
    var en = p ? t(p[NM.Email_Name]) : '';
    var dims = p ? t(p[NM.TouchPoint]) + ' · ' + t(p[NM.Segmento]) : '';
    var etq = pid ? pid : (lista.length ? '⚠ ' + lista.join(' + ') : '🔴 ninguna');
    console.log('   ' + b.campana.slice(0, 22).padEnd(23) + b.touchpoint.slice(0, 12).padEnd(13) +
      b.segmento.slice(0, 20).padEnd(21) + etq.padEnd(12) + dims.slice(0, 34));
    // una línea por shortlink: es el grano que Rick pidió ver
    b.codigos.forEach(function (c, k) {
      var f = filaDe[c] || {};
      totalCarr += (carr[c] || 0);
      md.push('| ' + (k === 0 ? b.campana : '') + ' | ' + (k === 0 ? '`' + b.touchpoint + '`' : '') + ' | ' +
        (k === 0 ? b.segmento : '') + ' | ' + (k === 0 ? etq : '') + ' | ' + (k === 0 ? dims : '') + ' | ' +
        (k === 0 ? (en ? (ESTADO.test(en) ? '`POR DEFINIR`' : '`' + en.slice(0, 58) + (en.length > 58 ? '…' : '') + '`') : '—') : '') +
        ' | `' + c + '` | ' + (t(f.receta) || '—') + ' | ' + (carr[c] || 0) + ' |');
    });
  });
  md.push('');
});

md.push('---', '', '## El cuadre', '',
  '| | |', '|---|---|',
  '| Bloques del doc (marzo→agosto, solo filas con fecha) | **' + bloques.length + '** |',
  '| Con una pieza, uno a uno | **' + conPieza + '** |',
  '| Sin ninguna pieza | ' + sinPieza + ' |',
  '| Repartidos entre varias | ' + partidos + ' |',
  '| Σ carritos de los shortlinks del doc | **' + totalCarr.toLocaleString('es-MX') + '** |', '',
  '**Solo envíos Principal, nunca FUPs.** Septiembre queda fuera: son partidos programados, no envíos.');

var salida = PROY + '/_orquesta/qcart-links-sobre-piezas.md';
fs.writeFileSync(salida, md.join('\n'), 'utf8');
console.log('\n════ EL CUADRE ════');
console.log('   bloques: ' + bloques.length + '   ·   con una pieza: ' + conPieza +
  '   ·   sin pieza: ' + sinPieza + '   ·   repartidos: ' + partidos);
console.log('   Σ carritos de los shortlinks del doc: ' + totalCarr.toLocaleString('es-MX'));
console.log('\n   → ' + salida);
