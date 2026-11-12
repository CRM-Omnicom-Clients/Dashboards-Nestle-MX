/*
 * fuentes-whatsapp.ver-hoja-cruda.js — VOLCAR UNA HOJA DE LA FUENTE DE WHATSAPP, TAL CUAL.
 *
 * 🔴 SOLO LECTURA. El archivo es de Leslie y el equipo lo consolida a mano. Este script NUNCA
 *    escribe: copia a una ruta ASCII del home (Node falla con los acentos de OneDrive) y lee.
 *
 * 🔴 POR QUÉ. Rick: «de 008-P007 entregados no puede ser lo mismo que envíos». Tiene razón, y la
 *    única forma de saber si el error es del lector o de la hoja es MIRAR LA HOJA — no el bloque
 *    que el lector produjo, que es donde vive la sospecha.
 *
 *   node fuentes-whatsapp.ver-hoja-cruda.js "Tercer Tiempo"
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = process.argv[2] || null;

var RUTA = ENT.fuente('whatsapp');
if (!fs.existsSync(RUTA)) { console.log('no encuentro la fuente en:\n  ' + RUTA); process.exit(1); }
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_wafuente.xlsx';
fs.copyFileSync(RUTA, tmp);
var wb = XLSX.readFile(tmp, { cellDates: true });
console.log('fuente: ' + path.basename(RUTA));
console.log('hojas : ' + wb.SheetNames.join(' | ') + '\n');

(HOJA ? [HOJA] : wb.SheetNames).forEach(function (h) {
  var s = wb.Sheets[h];
  if (!s) { console.log('(no existe la hoja ' + h + ')'); return; }
  var F = XLSX.utils.sheet_to_json(s, { header: 1, defval: '', blankrows: true, raw: true });
  console.log('════════ ' + h + '   ·   ' + F.length + ' filas ════════');
  F.forEach(function (fila, i) {
    var celdas = (fila || []).map(function (c) {
      if (c instanceof Date) return c.toISOString().slice(0, 10);
      var s2 = t(c);
      return s2.length > 34 ? s2.slice(0, 31) + '...' : s2;
    });
    while (celdas.length && !celdas[celdas.length - 1]) celdas.pop();
    if (!celdas.length) { console.log(String(i + 1).padStart(3) + ' │'); return; }
    console.log(String(i + 1).padStart(3) + ' │ ' + celdas.join('  │  '));
  });
  console.log('');
});
try { fs.unlinkSync(tmp); } catch (e) { }
