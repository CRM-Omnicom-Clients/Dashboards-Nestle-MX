// LA LISTA PARA RICK · lo que el catálogo debe y nadie ha declarado, en un archivo que se entrega.
//
// 🔴 POR QUÉ NO BASTA CON EL CONTEO. `orquestador.medir-vacios` dice «1,092 celdas POR DEFINIR» y con eso
//    Rick no puede hacer nada: no sabe de QUÉ pieza, ni de qué campaña, ni si es un dato que él
//    tiene o uno que hay que pedirle a alguien más. Una lista que no se puede responder no es una
//    lista, es un número. Aquí cada pendiente sale con su pieza, su campaña y su touchpoint.
//
// 🔴 Y SE AGRUPA POR COLUMNA, NO POR FILA. 1,092 celdas son ~35 preguntas: «¿cuál es el ID_SFMC de
//    estas 91 piezas?» es UNA pregunta, no 91. Listarlas fila por fila convierte una tarde de
//    trabajo en un muro que nadie abre.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'orquestador';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(POR DEFINIR|PENDIENTE)$/i;

var vivo = L.archivoVivo({ dir: PROY });
var copia = path.join(os.tmpdir(), 'lista-por-definir.xlsx');
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);

console.log('════════ LA LISTA PARA RICK · lo que el catálogo debe ════════\n');
console.log('  libro: ' + path.basename(vivo.ruta) + '\n');

var md = ['# Lo que el catálogo debe — la lista para Rick', '',
  '> Generada con `orquestador.lista-por-definir.js` desde `' + path.basename(vivo.ruta) + '`.',
  '> Cada línea es **una pregunta**, no una celda: si 91 piezas comparten la misma columna vacía,',
  '> es una sola cosa que decidir. La columna «piezas» dice a quiénes les falta.', ''];

var totalCeldas = 0, totalPreguntas = 0;
['Catalogo_Piezas', 'Catalogo_Referencias'].forEach(function (hoja) {
  var ws = wb.Sheets[hoja]; if (!ws) return;
  var filas = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
  if (!filas.length) return;
  var enc = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0].map(t);

  // las tres dimensiones que hacen respondible un pendiente — se PIDEN, no se escriben
  function ident(f) {
    var p = [];
    ['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento'].forEach(function (id) {
      var v = null; try { v = t(COL.valor(f, filas, id)); } catch (e) { v = null; }
      if (v) p.push(v);
    });
    return p.length ? p.join(' · ') : '(fila ' + (filas.indexOf(f) + 2) + ')';
  }

  var porCol = {};
  filas.forEach(function (f) {
    enc.forEach(function (c) {
      if (!c || !TOKEN.test(t(f[c]))) return;
      (porCol[c] = porCol[c] || []).push(ident(f));
    });
  });
  var cols = Object.keys(porCol).sort(function (a, b) { return porCol[b].length - porCol[a].length; });
  if (!cols.length) return;

  var nCeldas = cols.reduce(function (a, c) { return a + porCol[c].length; }, 0);
  totalCeldas += nCeldas; totalPreguntas += cols.length;

  console.log('  ══ ' + hoja + ' ══   ' + cols.length + ' pregunta(s) · ' + nCeldas + ' celda(s)');
  md.push('## ' + hoja, '', '**' + cols.length + ' preguntas · ' + nCeldas + ' celdas**', '',
    '| Columna | Piezas | A quiénes les falta |', '|---|---|---|');
  cols.forEach(function (c) {
    var quienes = porCol[c];
    console.log('     ' + String(quienes.length).padStart(4) + '  ' + c.padEnd(30) + quienes.slice(0, 2).join('  |  ').slice(0, 70));
    md.push('| `' + c + '` | ' + quienes.length + ' | ' +
      quienes.slice(0, 4).join(' · ') + (quienes.length > 4 ? ' … y ' + (quienes.length - 4) + ' más' : '') + ' |');
  });
  md.push('');
});

md.push('---', '', '**Total: ' + totalPreguntas + ' preguntas sobre ' + totalCeldas + ' celdas.**', '',
  'Fuera del catálogo no se llena nada: las celdas vacías se permiten (Rick, 26-ago-2026).');

var salida = PROY + '/_orquesta/lista-por-definir.md';
fs.writeFileSync(salida, md.join('\n'), 'utf8');
fs.rmSync(copia, { force: true });
console.log('\n  ── TOTAL: ' + totalPreguntas + ' preguntas · ' + totalCeldas + ' celdas');
console.log('  → ' + salida + '   ·   el Excel NO se tocó');
