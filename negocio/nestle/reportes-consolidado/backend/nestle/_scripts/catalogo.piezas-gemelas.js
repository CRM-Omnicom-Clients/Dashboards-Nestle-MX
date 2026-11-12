// nestle-catalogo · ¿HAY DOS PIEZAS PARA EL MISMO ENVÍO? Mide, no escribe.
//
// 🔴 CÓMO APARECIÓ. Al llenar 16 huecos de `Sends` desde SFMC, el catálogo pasó a tener 44,666
//    envíos MÁS que el bloque de email y la PUERTA 1 cerró. La puerta tiene razón, y lo que
//    destapó es anterior a hoy: el catálogo tiene piezas de Fuel for life **con el mismo número
//    de envíos y sin `Email_Name`**, al lado de las que sí cruzan con SFMC. Antes no se veía
//    porque el bloque traía 2.5 millones MÁS que el catálogo y la puerta lo leía como aviso.
//
// 🔴 LA PRUEBA NO ES «SE PARECEN»: es que dos piezas de la MISMA campaña declaren EXACTAMENTE los
//    mismos envíos, una con nombre físico y la otra sin él. Un número repetido por casualidad
//    entre 138 piezas es posible; repetido diez veces, con la misma campaña y siempre con la
//    huérfana sin nombre, no lo es.
//
// 🔴 Y NO RETIRA NADA. Retirar una pieza es destructivo y es decisión de Rick. Esto entrega la
//    lista con su evidencia para que él decida — no la aplica.
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
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var HUECO = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-|)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;

var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var enBloque = {};
(E.envios || []).forEach(function (e) { if (e.pieza_id) enBloque[e.pieza_id] = (enBloque[e.pieza_id] || 0) + num(e.email_sends); });

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_gemelas.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_' + 'ID'), nmS = COL.de(P, 'Sends'), nmC = COL.de(P, 'Campaña');
var nmE = COL.de(P, 'Email_Name'), nmT = COL.de(P, 'TouchPoint'), nmSeg = COL.de(P, 'Segmento'), nmCanal = COL.de(P, 'Canal');
var piezas = P.filter(function (p) { return ES_PIEZA.test(t(p[nmP])) && t(p[nmCanal]) === 'Email'; });

console.log('════════ nestle-catalogo · ¿DOS PIEZAS PARA EL MISMO ENVÍO? ════════\n');
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + piezas.length + ' piezas de email\n');

// ── agrupar por campaña + número de envíos ──────────────────────────────────────────
var g = {};
piezas.forEach(function (p) {
  var s = num(p[nmS]); if (!s) return;
  var k = t(p[nmC]) + '¦' + s;
  (g[k] = g[k] || []).push(p);
});
var pares = Object.keys(g).filter(function (k) { return g[k].length > 1; }).map(function (k) { return g[k]; });

var huerfanas = [], sospechosas = 0;
pares.forEach(function (grupo) {
  var conNombre = grupo.filter(function (p) { return !HUECO.test(t(p[nmE])); });
  var sinNombre = grupo.filter(function (p) { return HUECO.test(t(p[nmE])); });
  if (!conNombre.length || !sinNombre.length) return;    // no es el patrón
  sospechosas++;
  console.log('  ── ' + t(conNombre[0][nmC]) + '   ' + num(conNombre[0][nmS]).toLocaleString('es-MX') + ' envíos, repetidos');
  conNombre.forEach(function (p) {
    console.log('     ✔ ' + t(p[nmP]).padEnd(10) + t(p[nmT]).slice(0, 14).padEnd(16) + t(p[nmSeg]).slice(0, 22).padEnd(24) +
      (enBloque[t(p[nmP])] ? 'en el bloque (' + enBloque[t(p[nmP])].toLocaleString('es-MX') + ')' : 'NO está en el bloque'));
  });
  sinNombre.forEach(function (p) {
    console.log('     🔴 ' + t(p[nmP]).padEnd(10) + t(p[nmT]).slice(0, 14).padEnd(16) + t(p[nmSeg]).slice(0, 22).padEnd(24) +
      'sin Email_Name · ' + (enBloque[t(p[nmP])] ? 'en el bloque' : 'NO está en el bloque') + '  ← huérfana');
    huerfanas.push({ pieza: t(p[nmP]), campana: t(p[nmC]), touchpoint: t(p[nmT]), segmento: t(p[nmSeg]),
      sends: num(p[nmS]), gemela_de: conNombre.map(function (x) { return t(x[nmP]); }).join(' · ') });
  });
});
if (!sospechosas) console.log('  ✔ ninguna pareja con el patrón «mismos envíos, una sin nombre»');

console.log('\n  ── el hueco de la PUERTA 1, desglosado');
var soloCat = piezas.filter(function (p) { return num(p[nmS]) > 0 && !enBloque[t(p[nmP])]; });
var sumaHuerfanas = huerfanas.reduce(function (a, h) { return a + h.sends; }, 0);
var otras = soloCat.filter(function (p) { return !huerfanas.some(function (h) { return h.pieza === t(p[nmP]); }); });
console.log('     ' + huerfanas.length + ' pieza(s) gemelas sin nombre, fuera del bloque   Σ ' + sumaHuerfanas.toLocaleString('es-MX'));
console.log('     ' + otras.length + ' otra(s) con Sends y fuera del bloque              Σ ' +
  otras.reduce(function (a, p) { return a + num(p[nmS]); }, 0).toLocaleString('es-MX'));
otras.forEach(function (p) {
  var id = t(p[nmP]);
  console.log('        ' + id.padEnd(10) + t(p[nmC]).slice(0, 16).padEnd(18) + t(p[nmT]).slice(0, 12).padEnd(14) +
    num(p[nmS]).toLocaleString('es-MX').padStart(9) + '   «' + t(p[nmE]).slice(-42) + '»');
});

fs.writeFileSync(BACK + '/_preescritura/piezas-gemelas.json', JSON.stringify({ cuando: new Date().toISOString(), huerfanas: huerfanas }, null, 1));
console.log('\n  → _preescritura/piezas-gemelas.json   ·   NO se retiró ninguna: es decisión de Rick');
fs.unlinkSync(TMP);
