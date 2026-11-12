// nestle-catalogo · LAS COLUMNAS DE LA HOJA, con cuántas piezas tienen dato en cada una.
// Mide, no escribe. Existe para no adivinar el nombre de una columna: se lee el que hay.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;
var HOJA = process.argv[2] || 'Catalogo_Piezas';

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_cols.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets[HOJA], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets[HOJA], { header: 1, defval: '' })[0].map(t);
var filas = P;
if (HOJA === 'Catalogo_Piezas') {
  var nm = COL.de(P, 'Pieza' + '_' + 'ID');
  filas = P.filter(function (p) { return ES_PIEZA.test(t(p[nm])); });
}
console.log('════════ ' + HOJA + '   ·   ' + enc.length + ' columnas   ·   ' + filas.length + ' filas con llave ════════\n');
enc.forEach(function (h, i) {
  if (!h) return;
  var con = filas.filter(function (p) { var v = t(p[h]); return v !== '' && !TOKEN.test(v); }).length;
  var tok = filas.filter(function (p) { return TOKEN.test(t(p[h])); }).length;
  var barra = '█'.repeat(Math.round(con / filas.length * 20)).padEnd(20, '·');
  console.log('  ' + String(i + 1).padStart(3) + ' ' + h.padEnd(28) + barra + ' ' + String(con).padStart(4) + ' con dato · ' +
    String(tok).padStart(4) + ' token · ' + String(filas.length - con - tok).padStart(4) + ' vacías');
});
fs.unlinkSync(TMP);
