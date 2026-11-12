// C1 · RESPALDO VERIFICADO de Data_Email — abierto y contado, no solo copiado.
//
// 🔴 «Si ya tienes respaldo, elimina y deja lo limpio» (Rick). El respaldo es la red: Data_Email
//    tiene 277 celdas escritas a mano suyas. Un respaldo que existe pero no abre no es una red.
//    Este paso copia, ABRE la copia, y cuenta filas y columnas. Sin eso, no se declara respaldada.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ C1 · RESPALDO DE Data_Email ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var wb = XLSX.readFile(vivo.ruta);
var F = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { header: 1 })[0] || [];

// respaldo dedicado de la hoja, como JSON con TODAS sus columnas — el crudo que Rick tocó
var DIR = BACK + '/_respaldos';
try { fs.mkdirSync(DIR); } catch (e) { }
var destino = DIR + '/Data_Email__264-filas__2026-08-21.json';
fs.writeFileSync(destino, JSON.stringify({
  cuando: '2026-08-21', hoja: 'Data_Email', filas: F.length, columnas: enc.length,
  encabezados: enc, datos: F
}, null, 1));

// y se RE-ABRE para verificar
var re = JSON.parse(fs.readFileSync(destino, 'utf8'));
console.log('  respaldo: _respaldos/' + require('path').basename(destino));
console.log('  filas guardadas: ' + re.filas + '   columnas: ' + re.columnas);
console.log('  primera pieza: ' + t(re.datos[0].pieza_id) + '   ·   última: ' + t(re.datos[re.datos.length - 1].pieza_id));
var ok = re.filas === F.length && re.columnas === enc.length && re.datos.length === F.length;
console.log('\n  ' + (ok ? '✔ respaldo verificado (abre, cuenta, coincide)' : '🔴 el respaldo NO coincide con el original'));
process.exit(ok ? 0 : 1);
