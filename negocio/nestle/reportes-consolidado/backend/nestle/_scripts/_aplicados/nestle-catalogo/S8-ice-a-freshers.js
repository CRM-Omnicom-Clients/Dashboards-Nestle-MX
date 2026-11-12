// S8 · «THE FRESHERS ES LA CAMPAÑA» — decisión de Rick, 20-ago-2026.
//
// 🔴 QUÉ DECIDIÓ. `ICE` es la MARCA (Nescafé ICE), no una campaña. La pieza de WhatsApp que el
//    catálogo tenía como campaña `ICE` pertenece a **The Freshers**, igual que sus hermanas
//    `006-P001` y `006-P002` (que ya dicen `BU=Nescafé · Marca=ICE · Campaña=The Freshers`).
//
// 🔴 POR QUÉ SE RENUMERA. El id de pieza vive DENTRO de la campaña: `010-P001` es «la pieza 1 de
//    la campaña 010». Si la pieza se muda de campaña y conserva su número, el id deja de ser un
//    ancla y pasa a ser un nombre bonito. Se renumera a `006-P003` y la campaña `010` desaparece:
//    era su única pieza (10 campañas → 9).
//
// 🔴 LO QUE ESTE SCRIPT NO HACE: tocar el `Report_Resumen`. Ahí hay DOS filas con este envío —la
//    62, que es de Rick y está en el contrato congelado, y la 72, que insertó el sistema— y
//    decidir cuál se queda es de él. Este paso deja el catálogo y las fuentes correctos; la fila
//    se resuelve con su OK.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var VIEJO = '010-P001', NUEVO = '006-P003';
var CAMBIOS = { 'catalogo.pieza_id': NUEVO, 'catalogo.campana': 'The Freshers', 'catalogo.marca': 'ICE', 'catalogo.bu': 'Nescafé' };

console.log('════════ S8 · ' + VIEJO + ' → ' + NUEVO + '  (ICE → The Freshers) ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_s8.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);

// ── el registro resuelve los nombres; el script solo sabe de ids
function encabezados(hoja) { return XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || []; }
var hCat = R.abrir('catalogo', encabezados('Catalogo_Piezas'), { silencioso: true });
hCat.exigir(Object.keys(CAMBIOS).concat(['catalogo.canal', 'catalogo.touchpoint', 'catalogo.segmento']), 'S8');
var hWa = R.abrir('data_wa', encabezados('Data_WhatsApp'), { silencioso: true });
hWa.exigir(['data_wa.pieza_id', 'data_wa.campana'], 'S8');
console.log('  registro: los ids resuelven ✔\n');

// ── comprobar el estado ANTES, y que la decisión aplica a lo que hay
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var iP = -1;
CAT.forEach(function (p, i) { if (t(p[hCat.n('catalogo.pieza_id')]) === VIEJO) iP = i; });
if (iP < 0) {
  var yaEsta = CAT.some(function (p) { return t(p[hCat.n('catalogo.pieza_id')]) === NUEVO; });
  console.log(yaEsta ? '  ✅ ya está aplicado: ' + NUEVO + ' existe y ' + VIEJO + ' no. Nada que hacer.'
    : '  🔴 no encontré ' + VIEJO + ' ni ' + NUEVO + '. No se toca nada.');
  process.exit(yaEsta ? 0 : 1);
}
var fila = iP + 2;
console.log('  catálogo · fila ' + fila + ':');
Object.keys(CAMBIOS).forEach(function (id) {
  console.log('     ' + hCat.n(id).padEnd(16) + '«' + t(CAT[iP][hCat.n(id)]) + '» → «' + CAMBIOS[id] + '»');
});
// las hermanas, para probar que las dimensiones nuevas no son inventadas
var herm = CAT.filter(function (p) { return /^006-P00[12]$/.test(t(p[hCat.n('catalogo.pieza_id')])); });
console.log('\n  sus hermanas de la campaña 006 (de ahí salen BU y Marca, no de mi cabeza):');
herm.forEach(function (p) {
  console.log('     ' + t(p[hCat.n('catalogo.pieza_id')]).padEnd(10) + 'BU=' + t(p[hCat.n('catalogo.bu')]).padEnd(9) +
    'Marca=' + t(p[hCat.n('catalogo.marca')]).padEnd(6) + 'Campaña=' + t(p[hCat.n('catalogo.campana')]));
});
// 🔴 el id nuevo tiene que estar libre
var choca = CAT.some(function (p) { return t(p[hCat.n('catalogo.pieza_id')]) === NUEVO; });
console.log('\n  ¿' + NUEVO + ' está libre?  ' + (choca ? '🔴 NO — ya existe. Se para.' : '✔ sí'));
if (choca) process.exit(1);
// ¿queda alguna otra pieza de la campaña ICE?
var otrasIce = CAT.filter(function (p) { return t(p[hCat.n('catalogo.campana')]).toLowerCase() === 'ice' && t(p[hCat.n('catalogo.pieza_id')]) !== VIEJO; });
console.log('  ¿quedan otras piezas de la campaña ICE?  ' + (otrasIce.length ? '🔴 ' + otrasIce.length : '✔ ninguna: la campaña desaparece (10 → 9)'));

// ── Data_WhatsApp
var DW = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var iW = -1;
DW.forEach(function (x, i) { if (t(x[hWa.n('data_wa.pieza_id')]) === VIEJO) iW = i; });
console.log('\n  Data_WhatsApp · fila ' + (iW < 0 ? '(no está)' : iW + 2) + ':  pieza_id «' + VIEJO + '» → «' + NUEVO + '»' +
  (iW < 0 ? '  🔴' : '') + (iW >= 0 ? '   campaña «' + t(DW[iW][hWa.n('data_wa.campana')]) + '» → «The Freshers»' : ''));
if (iW < 0) process.exit(1);

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ══ ESCRIBIR ═══════════════════════════════════════════════════════════════════════
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var partes = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { partes[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

function escribir(hoja, nFila, pares) {
  var xml = zip.readAsText(partes[hoja]);
  Object.keys(pares).forEach(function (i) {
    var ref = R.letra(+i) + nFila;
    var est = CX.estiloDe(xml, ref) || CX.estiloDe(xml, R.letra(+i) + '2');
    xml = CX.poner(xml, ref, CX.celda(ref, pares[i], est), nFila).xml;
  });
  zip.updateFile(partes[hoja], Buffer.from(xml, 'utf8'));
}
var paresCat = {};
Object.keys(CAMBIOS).forEach(function (id) { paresCat[hCat.col(id).i] = CAMBIOS[id]; });
escribir('Catalogo_Piezas', fila, paresCat);
var paresWa = {};
paresWa[hWa.col('data_wa.pieza_id').i] = NUEVO;
paresWa[hWa.col('data_wa.campana').i] = 'The Freshers';
escribir('Data_WhatsApp', iW + 2, paresWa);
zip.writeZip(SECO);
console.log('\n  ── safe-save');
console.log('     validado: ' + (safeSave(SECO, SECO).validado || '?'));

// ── el bloque de WhatsApp del backend, para que la rejilla lo produzca bien
var wa = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var n = 0;
(wa.envios || []).forEach(function (e) { if (t(e.pieza_id) === VIEJO) { e.pieza_id = NUEVO; n++; } });
fs.writeFileSync(BACK + '/_fuentes/whatsapp.json', JSON.stringify(wa, null, 1));
console.log('  ── bloque: ' + n + ' envío(s) re-anclado(s) en whatsapp.json');

// ── releer del disco, que es la única prueba que vale
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var p = V.filter(function (x) { return t(x[hCat.n('catalogo.pieza_id')]) === NUEVO; })[0];
console.log('\n  ── releído: ' + (p ? NUEVO + ' · ' + t(p[hCat.n('catalogo.campana')]) + ' · marca ' + t(p[hCat.n('catalogo.marca')]) +
  ' · BU ' + t(p[hCat.n('catalogo.bu')]) + ' · canal ' + t(p[hCat.n('catalogo.canal')]) : '🔴 no quedó'));
var quedaViejo = V.some(function (x) { return t(x[hCat.n('catalogo.pieza_id')]) === VIEJO; });
console.log('     ¿queda algún ' + VIEJO + '? ' + (quedaViejo ? '🔴 SÍ' : '✔ no'));
console.log('\n  archivo listo en: ' + SECO + '   (aún NO publicado al vivo)');
