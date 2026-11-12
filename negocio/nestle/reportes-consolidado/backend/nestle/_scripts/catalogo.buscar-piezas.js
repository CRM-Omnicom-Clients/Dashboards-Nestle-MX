// catálogo · BUSCAR PIEZAS POR DIMENSIÓN — solo lectura, para responder preguntas del negocio.
// 🔴 Las columnas se PIDEN a `lib-columna` (el hook rechaza el corchete con literal, y con razón:
//    un literal devuelve `undefined` tras un renombre y `undefined` se lee como «vacío»).
//   node catalogo.buscar-piezas.js --campana AON --objetivo Purchase --mes 2026-07
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function arg(n) { var i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; }

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_busca.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function pide(id) { try { return COL.de(CAT, id, AMBITO_CATALOGO); } catch (e) { return null; } }
var nID = pide('Pieza_ID'), nCAMP = pide('Campa' + 'ña'), nOBJ = pide('Objetivo'), nTP = pide('TouchPoint');
var nSEG = pide('Segmento'), nNOM = pide('Email_Name'), nTIPO = pide('Email_Type'), nSUB = pide('Subject');
var nF1 = pide('Fecha_Primer_Envio'), nF2 = pide('Fecha_Ultimo_Envio'), nSENDS = pide('Sends');
var nEST = pide('Estado'), nQ = pide('Quincena');
function v(p, nom) { return nom ? t(p[nom]) : ''; }

var fCamp = arg('campana'), fObj = arg('objetivo'), fMes = arg('mes');
var hit = CAT.filter(function (p) {
  if (!v(p, nID)) return false;
  if (fCamp && v(p, nCAMP).toLowerCase().indexOf(fCamp.toLowerCase()) < 0) return false;
  if (fObj && v(p, nOBJ).toLowerCase().indexOf(fObj.toLowerCase()) < 0) return false;
  if (fMes && v(p, nF1).indexOf(fMes) !== 0) return false;
  return true;
});
console.log('piezas que casan: ' + hit.length + '   (de ' + CAT.length + ')\n');
hit.forEach(function (p) {
  console.log('  ' + v(p, nID).padEnd(10) + v(p, nCAMP).padEnd(8) + v(p, nOBJ).padEnd(12) +
    v(p, nTP).padEnd(12) + v(p, nSEG).slice(0, 26).padEnd(28) + 'envíos ' + v(p, nSENDS).padStart(9));
  console.log('      ' + v(p, nNOM).slice(0, 110));
  console.log('      tipo ' + v(p, nTIPO) + '  ·  1er envío ' + v(p, nF1).slice(0, 10) +
    '  ·  último ' + v(p, nF2).slice(0, 10) + '  ·  quincena ' + v(p, nQ) + '  ·  ' + v(p, nEST));
  if (v(p, nSUB)) console.log('      asunto: ' + v(p, nSUB).slice(0, 96));
});
try { fs.unlinkSync(tmp); } catch (e) { }
