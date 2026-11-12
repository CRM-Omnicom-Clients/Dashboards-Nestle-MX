// AGREGA una columna AL FINAL de una hoja — sin tocar ninguna de las que ya están.
//
// 🔴 POR QUÉ AL FINAL Y NO EN MEDIO. Insertar en medio obliga a correr todas las columnas de la
//    derecha, que es exactamente la operación que desplazó celdas y perdió cinco columnas del
//    catálogo. Al final no se corre nada: se añade una celda después de la última de cada fila.
//    Cuando Rick pidió la segunda columna de bajas dijo «al final, para análisis» — y ese detalle
//    no es de gusto: es lo que hace que la operación sea segura.
//
// 🔴 NO LLENA LA COLUMNA. La crea con su encabezado y la deja vacía; quien la llena es el script del
//    skill que la calcula (`resumen.regenerar.js`), que escribe por NOMBRE de encabezado. Separar
//    «existir» de «tener dato» es lo que permite que el llenado sea idempotente.
//
// Uso:  node resumen.agregar-columna.js --hoja Report_Resumen --columna "% Unsub vs Clicks" [--escribir]
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function arg(n) { var i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; }
var HOJA = arg('hoja'), COL = arg('columna'), ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
if (!HOJA || !COL) { console.log('falta --hoja o --columna'); process.exit(1); }
function letraDeNum(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ AGREGAR COLUMNA AL FINAL ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = require('path').resolve(__dirname, '..') + '/_tmp/_addcol.xlsx';
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);
var ws = wb.Sheets[HOJA];
if (!ws) { console.log('🔴 no está la hoja ' + HOJA); process.exit(1); }
var R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
var enc = R[0].map(t), nFilas = R.length;
console.log('  ' + HOJA + ': ' + enc.length + ' columnas × ' + (nFilas - 1) + ' filas de datos');

// 🔴 IDEMPOTENTE: si ya está, no se agrega otra vez. Correr esto dos veces no puede dar dos columnas
//    con el mismo nombre — que es justo el defecto «duplicada» que veníamos a cerrar.
if (enc.indexOf(COL) >= 0) {
  console.log('  ✔ «' + COL + '» ya existe (col ' + letraDeNum(enc.indexOf(COL) + 1) + ') — no se agrega nada');
  process.exit(0);
}
var nueva = enc.length + 1, letra = letraDeNum(nueva);
console.log('  → se agrega «' + COL + '» como columna ' + letra + ' (la ' + nueva + ')');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

var zip = new AdmZip(copia);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('🔴 no encuentro la parte XML de ' + HOJA); process.exit(1); }
var xml = zip.readAsText(parte);

// el encabezado hereda el estilo del encabezado anterior, para que no nazca sin formato
var estiloEnc = CX.estiloDe(xml, letraDeNum(enc.length) + '1');
xml = CX.poner(xml, letra + '1', CX.celda(letra + '1', COL, estiloEnc), 1).xml;
// y cada fila recibe su celda vacía, con el estilo de su vecina
var puestas = 0;
for (var f = 2; f <= nFilas; f++) {
  var est = CX.estiloDe(xml, letraDeNum(enc.length) + f);
  var r = CX.poner(xml, letra + f, CX.celda(letra + f, '', est), f);
  if (r.como !== 'sin fila') { xml = r.xml; puestas++; }
}
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, f1, c2, f2) {
  return '<dimension ref="' + c1 + f1 + ':' + letra + f2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(copia);
console.log('  celdas creadas: encabezado + ' + puestas + ' filas');

// ── las CINCO capas antes de publicar
var NODE = process.execPath, PY = require(__dirname + '/lib-entorno.js').PYTHON;
var capas = [[NODE, 'xlsx-safe-save.js'], [NODE, 'xlsx-label.js'], [NODE, 'xlsx-check.js'], [PY, 'xlsx-validar-fondo.py'], [NODE, 'xlsx-orden-celdas.js']];
var falla = null;
capas.forEach(function (c) {
  if (falla) return;
  var r = cp.spawnSync(c[0], [require(__dirname + '/lib-entorno.js').TOOLS + '/' + c[1], copia], { encoding: 'utf8' });
  if (r.status !== 0) falla = c[1] + ': ' + ((r.stdout || '') + (r.stderr || '')).slice(-300);
  console.log('   ' + (r.status === 0 ? '✔' : '🔴') + ' ' + c[1]);
});
if (falla) { console.log('\n🔴 NO SE PUBLICA — ' + falla); process.exit(1); }

fs.copyFileSync(copia, vivo.ruta);
// ── releer del disco: que la columna esté, y que NINGUNA otra se haya movido
var wb2 = XLSX.readFile(vivo.ruta);
var R2 = XLSX.utils.sheet_to_json(wb2.Sheets[HOJA], { header: 1, defval: '' });
var enc2 = R2[0].map(t);
var movidas = enc.filter(function (h, i) { return h !== enc2[i]; });
console.log('\n  📤 publicado');
console.log('   ' + (enc2.length === nueva ? '✔' : '🔴') + ' la hoja tiene ' + enc2.length + ' columnas (esperado ' + nueva + ')');
console.log('   ' + (enc2[nueva - 1] === COL ? '✔' : '🔴') + ' la última se llama «' + enc2[nueva - 1] + '»');
console.log('   ' + (movidas.length === 0 ? '✔' : '🔴') + ' ninguna columna anterior cambió de sitio' + (movidas.length ? ': ' + movidas.slice(0, 4).join(' · ') : ''));
console.log('   ' + (R2.length === nFilas ? '✔' : '🔴') + ' filas: ' + (R2.length - 1) + ' de ' + (nFilas - 1));
process.exit(enc2.length === nueva && enc2[nueva - 1] === COL && movidas.length === 0 && R2.length === nFilas ? 0 : 1);
