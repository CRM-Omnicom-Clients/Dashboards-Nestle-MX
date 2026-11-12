// motor · LOS LINKS QUE NO LLEGAN A NINGUNA FILA DEL REPORTE — ¿quiénes son y por qué?
//
// 🔴 LO DESTAPÓ EL CUADRE DE LAS 9 COLUMNAS, NO UN CHECK. Σ de las 9 = 38,953 y el bloque de links
//    trae 45,424: la diferencia son 6,471 clicks en 28 «piezas» cuyo id es un ConfigKey provisional
//    (`009-TMP-PA-E3-G`), o sea piezas que el catálogo no reconoce. Antes de escribir un desglose
//    que se presenta como completo hay que saber qué queda fuera y decirlo — si no, la columna
//    cuadra consigo misma y el 14% que falta no aparece en ningún sitio.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

var LK = JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8'));
var RJ = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
function vig(p) {
  var re = new RegExp('^' + p + '-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.txt$');
  return fs.readdirSync(BACK + '/_insumos').filter(function (x) { return re.test(x); }).sort().pop();
}
var CRUDO = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + vig('sfmc-links'), 'utf8')).rows;
var PZ = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + vig('sfmc-piezas'), 'utf8')).rows;

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_lkhuer.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var wb = XLSX.readFile(tmp);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

console.log('════════ motor · LOS LINKS QUE NO LLEGAN AL REPORTE ════════\n');

var enFila = {};
RJ.rejilla.forEach(function (c) { (c.piezas || []).forEach(function (p) { enFila[t(p)] = 1; }); });
var huer = Object.keys(LK.piezas).filter(function (p) { return !enFila[p] && LK.piezas[p].clicks_unicos > 0; });
var clicksHuer = huer.reduce(function (a, p) { return a + LK.piezas[p].clicks_unicos; }, 0);
console.log('  piezas con links: ' + Object.keys(LK.piezas).length + '   ·   de ellas en una fila del reporte: ' +
  Object.keys(LK.piezas).filter(function (p) { return enFila[p]; }).length);
console.log('  🔴 huérfanas: ' + huer.length + '   ·   ' + mil(clicksHuer) + ' clicks (' +
  (LK.auditoria.clicks_unicos ? (clicksHuer / LK.auditoria.clicks_unicos * 100).toFixed(1) : 0) + '% de los 45,424)\n');

// ¿de qué envío son? se busca en el crudo por ConfigKey y se saca el nombre
var porNombreCat = {};
CAT.forEach(function (p) {
  var id = t(p['Pieza' + '_ID']); if (!id) return;
  [t(p['Email' + '_Name']), t(p['Email' + '_Names_Variantes'])].forEach(function (celda) {
    if (!celda || /^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(celda)) return;
    celda.split(/\s*[·|]\s*/).map(t).forEach(function (n) { if (n) porNombreCat[n.toLowerCase()] = id; });
  });
});
var pzPorCK = {}; PZ.forEach(function (r) { pzPorCK[t(r.ConfigKey)] = r; });

var resumen = [];
huer.sort(function (a, b) { return LK.piezas[b].clicks_unicos - LK.piezas[a].clicks_unicos; }).forEach(function (id) {
  var filas = CRUDO.filter(function (r) { return t(r.ConfigKey) === id; });
  var nom = filas.length ? (t(filas[0].Email_Content_Name) || t(filas[0].EmailName)) : '';
  var p = pzPorCK[id] || {};
  resumen.push({
    id: id, clicks: LK.piezas[id].clicks_unicos, nombre: nom,
    campana: t(filas.length ? filas[0].Campana : ''), segmento: t(filas.length ? filas[0].Segmento : ''),
    sends: num(p.Email_Sends), email_id: t(filas.length ? filas[0].Email_ID : ''),
    cruza_por_nombre: nom && porNombreCat[nom.toLowerCase()] ? porNombreCat[nom.toLowerCase()] : null
  });
});

console.log('  ── quiénes son (por clicks)');
resumen.slice(0, 30).forEach(function (x) {
  console.log('     ' + mil(x.clicks).padStart(6) + '  ' + x.id.padEnd(20) + (x.campana || '?').padEnd(15) +
    (x.cruza_por_nombre ? '→ SÍ cruza con ' + x.cruza_por_nombre : '(el nombre no cruza con el catálogo)'));
  if (x.nombre) console.log('             ' + x.nombre.slice(0, 104));
});

var cruzan = resumen.filter(function (x) { return x.cruza_por_nombre; });
console.log('\n  ── ¿alguna cruzaría por NOMBRE con una pieza del catálogo? ' + cruzan.length + ' de ' + resumen.length);
if (cruzan.length) console.log('     🔴 ésas son un defecto del cruce, no un hueco de la fuente: ' +
  cruzan.map(function (x) { return x.id + '→' + x.cruza_por_nombre; }).join(' · '));

var camps = {};
resumen.forEach(function (x) { camps[x.campana || '(sin campaña)'] = (camps[x.campana || '(sin campaña)'] || 0) + x.clicks; });
console.log('\n  ── por campaña');
Object.keys(camps).sort(function (a, b) { return camps[b] - camps[a]; }).forEach(function (k) {
  console.log('     ' + k.padEnd(22) + mil(camps[k]).padStart(7) + ' clicks');
});

fs.writeFileSync(BACK + '/_preescritura/links-huerfanos.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  huerfanas: resumen.length, clicks: clicksHuer, total_bloque: LK.auditoria.clicks_unicos,
  cruzan_por_nombre: cruzan, por_campana: camps, detalle: resumen
}, null, 1));
console.log('\n  → _preescritura/links-huerfanos.json');
try { fs.unlinkSync(tmp); } catch (e) { }
