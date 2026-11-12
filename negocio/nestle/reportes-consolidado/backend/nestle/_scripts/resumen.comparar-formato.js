// resumen · ¿EL MOVIMIENTO DE COLUMNAS SE LLEVÓ ALGÚN FORMATO? — antes vs después, por NOMBRE.
//
// 🔴 POR QUÉ. Mover columnas reubica encabezado, ancho y estilo. Si el estilo no viaja bien, una
//    tasa que Rick tenía en `0.0%` se queda en `0.13253901` — y eso no lo ve ninguna puerta: las
//    puertas comparan VALORES y el valor no cambió. Lo vi en el render y hay que medirlo, porque
//    el render también podría estar ignorando el numFmt y entonces no habría nada roto.
//    Se compara el `numFmtId` efectivo de cada columna POR NOMBRE, no por letra: las letras
//    cambiaron a propósito.
//
//   node resumen.comparar-formato.js <respaldo.xlsx>
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Report_Resumen';
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

/* Devuelve, para un libro: { nombreDeColumna: 'codigo de formato' } leyendo la fila 2 (la primera
 * de datos), que es la que el regenerador usa de plantilla. El código es el `formatCode` real,
 * resuelto por su `numFmtId` contra `styles.xml` — no el id, que SheetJS renumera. */
function formatos(ruta) {
  var zip = new AdmZip(ruta);
  var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
  var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
  var parte = null;
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
  if (!parte) throw new Error('no encontré ' + HOJA + ' en ' + path.basename(ruta));
  var xml = zip.readAsText(parte);
  var st = zip.readAsText('xl/styles.xml');

  // numFmtId → formatCode. Los builtin no están en styles.xml: se declaran los que usa este libro.
  var BUILTIN = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 14: 'dd/mm/yyyy', 164: '(custom)' };
  var codigo = {};
  st.replace(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g, function (_, id, c) { codigo[id] = c; return _; });
  // cellXfs: el índice de estilo → su numFmtId
  var xfs = [];
  var mx = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
  if (mx) (mx[1].match(/<xf\b[^>]*\/?>/g) || []).forEach(function (x) {
    var n = /numFmtId="(\d+)"/.exec(x);
    xfs.push(n ? n[1] : '0');
  });

  var enc = (XLSX.utils.sheet_to_json(XLSX.readFile(ruta).Sheets[HOJA], { header: 1, defval: '' })[0] || []).map(t);
  var out = {};
  enc.forEach(function (h, i) {
    if (!h) return;
    var ref = col(i) + '2';
    var m = new RegExp('<c r="' + ref + '"([^>]*)>').exec(xml) || new RegExp('<c r="' + ref + '"([^>]*)/>').exec(xml);
    var s = m ? (/ s="(\d+)"/.exec(m[1]) || [])[1] : undefined;
    var nf = s !== undefined ? xfs[+s] : '0';
    out[h] = codigo[nf] || BUILTIN[nf] || ('numFmtId ' + nf);
  });
  return out;
}

/* 🔴 SE EXPORTA para que la use quien escribe, no solo yo a mano. La comprobación que descubre un
 *    formato perdido no sirve si hay que acordarse de correrla: `escritor.hojas-clicks.js` la llama
 *    ANTES de publicar y se niega si alguna columna cambió de formato. Un check que solo existe
 *    como comando es un check que el próximo corte no corre. */
module.exports = { formatos: formatos };
if (require.main !== module) return;

if (!process.argv[2]) { console.log('uso: node resumen.comparar-formato.js <respaldo.xlsx>'); process.exit(2); }
var antes = formatos(process.argv[2]);
var ahora = formatos(L.archivoVivo({ dir: PROY }).ruta);

console.log('════════ ¿SE PERDIÓ ALGÚN FORMATO AL MOVER? ════════\n');
console.log('  antes : ' + path.basename(process.argv[2]));
console.log('  ahora : ' + path.basename(L.archivoVivo({ dir: PROY }).ruta) + '\n');

var cambios = [], nuevas = [];
Object.keys(antes).forEach(function (h) {
  if (!(h in ahora)) { cambios.push('🔴 DESAPARECIÓ la columna ' + h); return; }
  if (antes[h] !== ahora[h]) cambios.push('🔴 ' + h.padEnd(40) + antes[h] + '   →   ' + ahora[h]);
});
Object.keys(ahora).forEach(function (h) { if (!(h in antes)) nuevas.push(h + '  →  ' + ahora[h]); });

if (!cambios.length) console.log('  ✅ NINGUNA columna que ya existía cambió de formato (' + Object.keys(antes).length + ' revisadas)');
else { console.log('  ' + cambios.length + ' cambio(s):'); cambios.forEach(function (c) { console.log('     ' + c); }); }
if (nuevas.length) { console.log('\n  columnas que no estaban antes:'); nuevas.forEach(function (n) { console.log('     ' + n); }); }

console.log('\n  ── el formato de las 9, junto al de su hermana');
['Principal_', 'FUP_', 'Tot_'].forEach(function (p) {
  [p + 'Clicks', p + 'Clicks_CTA', p + 'Clicks_Baja', p + 'Clicks_Redes+Navegador+Legal'].forEach(function (h) {
    if (ahora[h] !== undefined) console.log('     ' + h.padEnd(40) + ahora[h]);
  });
  console.log('');
});
process.exit(cambios.length ? 1 : 0);
