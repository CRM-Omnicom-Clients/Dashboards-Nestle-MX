// resumen · LAS FILAS DE WHATSAPP TAL COMO SALEN EN EL REPORTE, con sus 4 tasas.
// 🔴 Se lee del DISCO, no de la rejilla: la pregunta es qué ve Rick en su hoja.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var FILTRO = process.argv[2] ? String(process.argv[2]).toLowerCase() : null;

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_wa.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var F = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { header: 1, defval: '', blankrows: false });
var enc = (F[0] || []).map(t);

var DIM = ['Campaña', 'Marca', 'TouchPoint', 'Segmento', 'Quincena_Lanzamiento Principal'];
var MET = ['WA-Envíos', 'WA-Entregados', 'WA-No entregados', 'WA-Leídos', 'WA-Clicks'];
var TAS = ['WA-%Entrega', 'WA-%No entrega', 'WA-%Read vs entrega', 'WA-%Click vs Read'];
function ix(c) { return enc.indexOf(c); }
function val(r, c) { var i = ix(c); return i < 0 ? '(columna ausente)' : F[r][i]; }
function pct(v) { return typeof v === 'number' ? (v * 100).toFixed(1) + '%' : (t(v) || '(vacío)'); }
function mil(v) { return typeof v === 'number' ? v.toLocaleString('es-MX') : (t(v) || '(vacío)'); }

console.log('== LAS FILAS CON WHATSAPP EN Report_Resumen ==');
MET.concat(TAS).forEach(function (c) { if (ix(c) < 0) console.log('   ! la columna ' + c + ' NO existe en la hoja'); });
console.log('');
var n = 0, sum = { env: 0, ent: 0, no: 0, leid: 0, cl: 0 };
for (var r = 1; r < F.length; r++) {
  if (/^total$/i.test(t(F[r][0]))) continue;
  var env = Number(val(r, 'WA-Envíos')) || 0;
  if (!env) continue;
  var etq = DIM.map(function (c) { return t(val(r, c)); }).join(' | ');
  if (FILTRO && etq.toLowerCase().indexOf(FILTRO) < 0) continue;
  n++;
  sum.env += env;
  sum.ent += Number(val(r, 'WA-Entregados')) || 0;
  sum.no += Number(val(r, 'WA-No entregados')) || 0;
  sum.leid += Number(val(r, 'WA-Leídos')) || 0;
  sum.cl += Number(val(r, 'WA-Clicks')) || 0;
  console.log('fila ' + (r + 1) + '  ' + etq);
  console.log('   envios ' + mil(val(r, 'WA-Envíos')) + '  entregados ' + mil(val(r, 'WA-Entregados')) +
    '  no entregados ' + mil(val(r, 'WA-No entregados')) + '  leidos ' + mil(val(r, 'WA-Leídos')) +
    '  clicks ' + mil(val(r, 'WA-Clicks')));
  console.log('   %entrega ' + pct(val(r, 'WA-%Entrega')) + '   %no entrega ' + pct(val(r, 'WA-%No entrega')) +
    '   %read vs entrega ' + pct(val(r, 'WA-%Read vs entrega')) + '   %click vs read ' + pct(val(r, 'WA-%Click vs Read')));
}
console.log('');
console.log('   filas: ' + n + '   ·   envios ' + sum.env.toLocaleString('es-MX') + '  entregados ' + sum.ent.toLocaleString('es-MX') +
  '  no entregados ' + sum.no.toLocaleString('es-MX') + '  leidos ' + sum.leid.toLocaleString('es-MX') + '  clicks ' + sum.cl.toLocaleString('es-MX'));
try { fs.unlinkSync(tmp); } catch (e) { }
