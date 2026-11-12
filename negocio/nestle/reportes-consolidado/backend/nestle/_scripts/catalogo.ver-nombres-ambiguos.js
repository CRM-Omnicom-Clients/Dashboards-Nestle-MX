// catálogo · QUÉ PIEZAS COMPARTEN UN Email_Name, Y CUÁNTO CUESTA
//
// 🔴 POR QUÉ. Al enchufar `motor.links.js` al índice canónico, 6 piezas de Pro Plan siguieron con
//    su ConfigKey provisional. La causa NO es la que supuse: su nombre SÍ está en el catálogo, pero
//    lo comparten DOS piezas, así que el índice lo marca AMBIGUO y —correctamente— no elige.
//    Mi prueba anterior (`motor.medir-links-huerfanos.js`) dijo «28 de 28 cruzan» porque su índice
//    hacía `porNombre[n] = id` y la última pieza pisaba a la anterior: eligió en silencio. Ése es
//    exactamente el defecto que la guarda de ambigüedad existe para impedir.
//    Aquí se ve CON QUIÉN choca cada una, que es lo que decide si hay que renombrar o retirar.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var CN = require(BACK + '/_scripts/lib-canonico.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_amb.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var LK = JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8'));

console.log('════════ catálogo · NOMBRES COMPARTIDOS POR DOS PIEZAS ════════\n');

// nombre normalizado → lista de piezas que lo declaran
var quien = {};
CAT.forEach(function (p) {
  var id = t(p['Pieza' + '_ID']); if (!id) return;
  [p['Email' + '_Name'], p['Email' + '_Names_Variantes']].forEach(function (celda) {
    String(celda == null ? '' : celda).split(/\s*[·|;]\s*|[\r\n]+/).map(t).filter(Boolean).forEach(function (n) {
      if (/^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(n)) return;
      var k = CN.nm(n);
      quien[k] = quien[k] || { nombre: n, piezas: [] };
      if (quien[k].piezas.indexOf(id) < 0) quien[k].piezas.push(id);
    });
  });
});
var ambig = Object.keys(quien).filter(function (k) { return quien[k].piezas.length > 1; });
console.log('  nombres distintos: ' + Object.keys(quien).length + '   ·   compartidos por 2+ piezas: ' + ambig.length + '\n');

var porId = {}; CAT.forEach(function (p) { porId[t(p['Pieza' + '_ID'])] = p; });
ambig.sort(function (a, b) { return quien[b].piezas.length - quien[a].piezas.length; }).forEach(function (k) {
  var q = quien[k];
  console.log('  ── ' + q.nombre.slice(0, 96));
  q.piezas.forEach(function (id) {
    var p = porId[id] || {};
    console.log('       ' + id.padEnd(11) + t(p['Camp' + 'aña']).padEnd(16) + t(p['Touch' + 'Point']).padEnd(12) +
      t(p['Segm' + 'ento']).slice(0, 26).padEnd(28) + 'sends ' + mil(num(p['Sends'])).padStart(9) +
      '   estado: ' + (t(p['Estado']) || '—'));
  });
});

// ¿cuáles de las 6 piezas con ConfigKey provisional en links.json caen aquí?
var tmpKeys = Object.keys(LK.piezas).filter(function (x) { return /(^|-)TMP-/.test(x); });
console.log('\n  ── las que siguen con ConfigKey provisional en links.json: ' + tmpKeys.length);
tmpKeys.forEach(function (x) { console.log('     ' + x.padEnd(20) + mil(LK.piezas[x].clicks_unicos).padStart(6) + ' clicks únicos'); });
console.log('     Σ ' + mil(tmpKeys.reduce(function (a, x) { return a + LK.piezas[x].clicks_unicos; }, 0)) + ' clicks (' +
  (LK.auditoria.clicks_unicos ? (tmpKeys.reduce(function (a, x) { return a + LK.piezas[x].clicks_unicos; }, 0) / LK.auditoria.clicks_unicos * 100).toFixed(2) : 0) + '% del total)');

fs.writeFileSync(BACK + '/_preescritura/nombres-ambiguos.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), compartidos: ambig.length,
  detalle: ambig.map(function (k) { return quien[k]; }), tmp_en_links: tmpKeys
}, null, 1));
console.log('\n  → _preescritura/nombres-ambiguos.json');
try { fs.unlinkSync(tmp); } catch (e) { }
