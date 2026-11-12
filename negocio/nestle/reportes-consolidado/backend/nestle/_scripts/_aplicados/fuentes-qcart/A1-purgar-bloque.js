// A1b · RE-EVALUAR EL BLOQUE CUANDO CAMBIA LA REGLA, no solo cuando llegan datos.
//
// 🔴 LA DISTINCIÓN QUE FALTABA. El bloque de Qcart es append-only a propósito: son logs, y **un
//    evento pasado no cambia**. Pero eso solo vale mientras la REGLA no cambie. Al revertir el
//    «rescate» de los links sin fecha, el filtro volvió a dejar fuera 401 carritos… que ya estaban
//    cargados. El append no los quita —no es su trabajo— y el bloque se quedó con datos admitidos
//    bajo una regla que ya no existe.
//
//    · llegan datos nuevos  → se agregan, nada de lo cargado se toca   (append)
//    · cambia la regla      → se RE-EVALÚA lo cargado                  (esto)
//
// 🔴 Y SE DECLARA QUÉ SALE Y POR QUÉ, evento por evento. Purgar en silencio es peor que no purgar:
//    el total baja y nadie sabe si fue una corrección o una pérdida.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var F = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-filtro.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var QJ = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
console.log('════════ A1b · RE-EVALUAR EL BLOQUE CON LA REGLA DE HOY ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  bloque cargado: ' + mil((QJ.carritos || []).length) + ' carritos · ' + mil((QJ.productos || []).length) + ' productos');

// el padrón y el mapa código→pieza, tal como están HOY
var pad = F.padron();
var C = os.homedir() + '/_a1.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var codPieza = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { codPieza[c] = t(p[N('pieza_id')]); });
  });
});

function reevaluar(nombre, arr) {
  var res = F.aplicar(arr, pad, codPieza);
  var quedan = res.dentro, salen = res.fuera;
  console.log('\n  ── ' + nombre);
  console.log('     cargados ' + mil(arr.length) + '   ·   siguen pasando ' + mil(quedan.length) + '   ·   🔴 SALEN ' + mil(salen.length));
  var porMotivo = {};
  salen.forEach(function (e) { var m = t(e.motivo_exclusion) || '(sin motivo)'; porMotivo[m] = (porMotivo[m] || 0) + 1; });
  Object.keys(porMotivo).sort(function (a, b) { return porMotivo[b] - porMotivo[a]; }).forEach(function (m) {
    console.log('        ' + String(porMotivo[m]).padStart(5) + '  ' + m.slice(0, 88));
  });
  // qué campañas pierden, para que la baja se pueda leer
  var porCamp = {};
  salen.forEach(function (e) { var k = t(e.link_campana || e.utm_campaign) || '(sin campaña)'; porCamp[k] = (porCamp[k] || 0) + 1; });
  if (Object.keys(porCamp).length) {
    console.log('        por campaña:');
    Object.keys(porCamp).sort(function (a, b) { return porCamp[b] - porCamp[a]; }).slice(0, 8)
      .forEach(function (k) { console.log('           ' + String(porCamp[k]).padStart(5) + '  ' + k); });
  }
  return { quedan: quedan, salen: salen };
}

var car = reevaluar('CARRITOS', QJ.carritos || []);
var pro = reevaluar('PRODUCTOS', QJ.productos || []);

console.log('\n  ── el bloque quedaría en: ' + mil(car.quedan.length) + ' carritos · ' + mil(pro.quedan.length) + ' productos');
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

QJ.carritos = car.quedan;
QJ.productos = pro.quedan;
QJ.auditoria = QJ.auditoria || {};
QJ.auditoria.purga_a1 = {
  motivo: 'A1 · se revirtió el rescate de los links sin fecha de envío. Regla de Rick: link + fecha → atribuye; sin fecha de salida, no cuenta.',
  carritos_fuera: car.salen.length, productos_fuera: pro.salen.length,
  quedan: { carritos: car.quedan.length, productos: pro.quedan.length }
};
fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(QJ, null, 1));
// la evidencia de lo que salió, para poder revisarlo
fs.writeFileSync(BACK + '/_fuentes/qcart-purgados.json', JSON.stringify({
  paso: 'A1b', carritos: car.salen.slice(0, 2000), productos: pro.salen.slice(0, 2000)
}, null, 1));
console.log('\n  ✔ bloque re-evaluado');
console.log('  → _fuentes/qcart.json          (' + mil(car.quedan.length) + ' · ' + mil(pro.quedan.length) + ')');
console.log('  → _fuentes/qcart-purgados.json (' + mil(car.salen.length) + ' · ' + mil(pro.salen.length) + ' con su motivo)');
console.log('\n  🔴 las hojas Data_Qcart_* todavía tienen las filas viejas: las reescribe el paso B.');
