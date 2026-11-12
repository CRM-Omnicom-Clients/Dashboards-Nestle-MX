// nestle-catalogo · ¿DE DÓNDE SALE LA DIFERENCIA ENTRE EL `Sends` DEL CATÁLOGO Y EL BLOQUE?
// Mide, no escribe. Existe porque la PUERTA 1 dice el TAMAÑO del hueco y no dice DÓNDE está.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var n = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var HUECO = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-|)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;

var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var envios = E.envios || E.rows || [];
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_diffs.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_' + 'ID'), nmS = COL.de(P, 'Sends'), nmC = COL.de(P, 'Campaña'), nmT = COL.de(P, 'TouchPoint');
var piezas = P.filter(function (p) { return ES_PIEZA.test(t(p[nmP])); });

var bloque = {};
envios.forEach(function (e) { var id = t(e.pieza_id); if (!id) return; bloque[id] = (bloque[id] || 0) + n(e.email_sends); });
var sinPieza = envios.filter(function (e) { return !t(e.pieza_id); }).reduce(function (a, e) { return a + n(e.email_sends); }, 0);

var sumaCat = 0, sumaBlq = 0, filas = [];
piezas.forEach(function (p) {
  var id = t(p[nmP]), sc = HUECO.test(t(p[nmS])) ? null : n(p[nmS]);
  var sb = bloque[id];
  if (sc !== null) sumaCat += sc;
  if (sb !== undefined) sumaBlq += sb;
  if ((sc || 0) !== (sb || 0)) filas.push({ id: id, camp: t(p[nmC]), tp: t(p[nmT]), cat: sc, blq: sb === undefined ? null : sb, dif: (sc || 0) - (sb || 0) });
});
Object.keys(bloque).forEach(function (id) {
  if (!piezas.some(function (p) { return t(p[nmP]) === id; })) filas.push({ id: id, camp: '(no está en el catálogo)', tp: '', cat: null, blq: bloque[id], dif: -bloque[id] });
});

console.log('════════ EL `Sends` DEL CATÁLOGO CONTRA EL BLOQUE DE EMAIL ════════\n');
console.log('  catálogo Σ ' + sumaCat.toLocaleString('es-MX') + '   ·   bloque Σ ' + (sumaBlq + sinPieza).toLocaleString('es-MX') +
  (sinPieza ? '  (de los cuales ' + sinPieza.toLocaleString('es-MX') + ' sin pieza)' : ''));
console.log('  diferencia ' + (sumaCat - sumaBlq - sinPieza).toLocaleString('es-MX') + '\n');
filas.sort(function (a, b) { return Math.abs(b.dif) - Math.abs(a.dif); });
console.log('  ── las piezas que no coinciden (' + filas.length + ')');
filas.slice(0, 25).forEach(function (f) {
  console.log('     ' + f.id.padEnd(10) + f.camp.slice(0, 18).padEnd(20) + f.tp.slice(0, 12).padEnd(14) +
    'catálogo ' + (f.cat === null ? '(hueco)' : f.cat.toLocaleString('es-MX')).padStart(11) +
    '   bloque ' + (f.blq === null ? '(no está)' : f.blq.toLocaleString('es-MX')).padStart(11) +
    '   dif ' + (f.dif > 0 ? '+' : '') + f.dif.toLocaleString('es-MX'));
});
if (filas.length > 25) console.log('     … y ' + (filas.length - 25) + ' más');
var soloCat = filas.filter(function (f) { return f.blq === null; });
console.log('\n  ── resumen');
console.log('     ' + soloCat.length + ' pieza(s) con Sends en el catálogo y SIN envío en el bloque   Σ ' +
  soloCat.reduce(function (a, f) { return a + (f.cat || 0); }, 0).toLocaleString('es-MX'));
var ambos = filas.filter(function (f) { return f.blq !== null && f.cat !== null; });
console.log('     ' + ambos.length + ' pieza(s) en los dos con número distinto              Σdif ' +
  ambos.reduce(function (a, f) { return a + f.dif; }, 0).toLocaleString('es-MX'));
fs.unlinkSync(TMP);
