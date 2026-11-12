/*
 * qcart.shortlinks-ambiguos.js — LOS SHORTLINKS QUE ESTÁN EN DOS SITIOS A LA VEZ.
 *
 * 🔴 POR QUÉ IMPORTA. La regla del sistema es que **la llave de Qcart es el shortlink**. Si un
 *    mismo código vive en dos meses del maestro o en dos piezas del catálogo, la llave deja de ser
 *    única: sus carritos se pueden contar dos veces o aterrizar en la pieza equivocada, y la suma
 *    sigue cuadrando, así que ninguna puerta lo ve.
 *
 * 🔴 NO SE RESUELVE AQUÍ. Rick, 21-sep: «lo del link duplicado hay que aclarárselo al equipo para
 *    que ellos lo revisen». Este script DECLARA: qué código, en qué meses, con qué touchpoint, y
 *    cuántos carritos están en juego. Elegir uno sería inventar una atribución.
 *
 *   node qcart.shortlinks-ambiguos.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var LKM = require(BACK + '/_scripts/lib-maestro-links.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

// ── el maestro: ¿un código en dos meses? ──────────────────────────────────────────
var MAE = LKM.cargar();
var enMaestro = {};
(MAE.filas || []).forEach(function (f) {
  var c = t(f.codigo); if (!c) return;
  (enMaestro[c] = enMaestro[c] || []).push(f);
});
var dosM = Object.keys(enMaestro).filter(function (c) {
  var meses = {}; enMaestro[c].forEach(function (f) { meses[t(f.hoja)] = 1; });
  return Object.keys(meses).length > 1;
});

// ── el catálogo: ¿un código en dos piezas? ────────────────────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_amb.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function pide(id) { try { return COL.de(CAT, id, AMBITO_CATALOGO); } catch (e) { return null; } }
var nID = pide('Pieza_ID'), nCAMP = pide('Campa' + 'ña'), nTP = pide('TouchPoint'), nSEG = pide('Segmento');
var COD = []; for (var i = 1; i <= 5; i++) { COD.push(pide('Cod_Walmart_' + i)); COD.push(pide('Cod_Chedraui_' + i)); }
function v(p, nom) { return nom ? t(p[nom]) : ''; }
var enCatalogo = {};
CAT.forEach(function (p) {
  var id = v(p, nID); if (!id) return;
  COD.forEach(function (nc) {
    var c = v(p, nc); if (!c || /^(N\/A|POR DEFINIR)$/i.test(c)) return;
    (enCatalogo[c] = enCatalogo[c] || []).push({ id: id, camp: v(p, nCAMP), tp: v(p, nTP), seg: v(p, nSEG) });
  });
});
var dosP = Object.keys(enCatalogo).filter(function (c) {
  var ids = {}; enCatalogo[c].forEach(function (x) { ids[x.id] = 1; });
  return Object.keys(ids).length > 1;
});

// ── los carritos en juego ─────────────────────────────────────────────────────────
var QC = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var carr = {};
// vistas, no filas: decia «N carritos en juego» contando buckets (29-sep-2026)
(QC.carritos || []).forEach(function (e) { var c = t(e.shortlink_code); if (c) carr[c] = (carr[c] || 0) + (Number(e.views) || 0); });

console.log('════════ SHORTLINKS AMBIGUOS · para revisión del equipo ════════');
console.log('  maestro: ' + (MAE.filas || []).length + ' filas en ' + (MAE.meses || []).join(', '));
console.log('  catálogo: ' + CAT.length + ' piezas\n');

var todos = {};
dosM.concat(dosP).forEach(function (c) { todos[c] = 1; });
var lista = Object.keys(todos).sort();
if (!lista.length) { console.log('  ✅ ningún shortlink está en dos meses ni en dos piezas.'); process.exit(0); }

console.log('  🔴 ' + lista.length + ' shortlink(s) en más de un sitio · ' +
  lista.reduce(function (a, c) { return a + (carr[c] || 0); }, 0) + ' carritos en juego\n');
lista.forEach(function (c) {
  console.log('── ' + c + '   ·   ' + (carr[c] || 0) + ' carrito(s) cargados');
  (enMaestro[c] || []).forEach(function (f) {
    console.log('     MAESTRO   ' + t(f.hoja) + '!' + f.fila + '   utm_content «' + t(f.utm_content) +
      '»   utm_term «' + t(f.utm_term) + '»   receta «' + t(f.receta) + '»');
  });
  if (!(enMaestro[c] || []).length) console.log('     MAESTRO   (no lo declara)');
  (enCatalogo[c] || []).forEach(function (x) {
    console.log('     CATÁLOGO  ' + x.id + '   ' + x.camp + ' · ' + x.tp + ' · ' + x.seg);
  });
  if (!(enCatalogo[c] || []).length) console.log('     CATÁLOGO  (no lo declara)');
  console.log('     ⇒ la pregunta para el equipo: ¿se reusó el MISMO link en dos jornadas, o debió crearse uno nuevo?');
  console.log('');
});
console.log('  🔴 No se elige ninguno: con un código en dos piezas, sus carritos se pueden contar');
console.log('     dos veces y la suma cuadra igual. Lo resuelve quien creó los links, no el reporte.');
fs.writeFileSync(BACK + '/_preescritura/shortlinks-ambiguos.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), total: lista.length,
  detalle: lista.map(function (c) { return { codigo: c, carritos: carr[c] || 0, maestro: enMaestro[c] || [], catalogo: enCatalogo[c] || [] }; })
}, null, 1));
console.log('\n  → _preescritura/shortlinks-ambiguos.json');
try { fs.unlinkSync(tmp); } catch (e) { }
