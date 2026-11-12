/*
 * maggi.valores-de-rick.js — pone a salvo, fuera del Excel, las celdas de «Maggi Reporte» que
 * escribió Rick y que NINGUNA fuente produce.
 *
 * 🔴 POR QUÉ EXISTE. Rick: «Esto es mío. No lo modifiques, en todo caso llévalo a la fuente».
 *    Medido: de las 13 columnas propias de esa hoja, **7 no las produce nadie** — `Tipo Email`,
 *    `WA-Clicks Qcart`, `WA-Clicks-Recetas`, `NOTAS`, `Clicks`, `Clicks vs Carritos` y una vacía.
 *    Son ~91 celdas que existen solo porque él las escribió. Hoy viven en una celda y en ningún
 *    otro sitio: el día que alguien regenere la hoja —y el objetivo de esta migración es que la
 *    regenere gente que no estuvo en estas sesiones— se van sin dejar rastro.
 *
 * 🔴 LA LLAVE ES LA IDENTIDAD, NUNCA LA FILA. El diff del 1-oct reportó `WA-Clicks-Recetas` en la
 *    fila 27 y hoy esa pieza está en la 25: al crecer Liga MX de 10 a 12 filas, todo lo de abajo se
 *    movió. Un contrato guardado por número de fila habría devuelto el 14 a la pieza equivocada —
 *    que es exactamente el defecto que ya costó aquí 191 carritos en el segmento de al lado.
 *    Se guarda por `campaña · touchpoint · segmento · quincena`.
 *
 * 🔴 RESTAURAR SOLO LLENA LO VACÍO. Nunca pisa una celda con valor: si Rick cambió el 14 por un 15,
 *    manda el 15 y el contrato se re-captura. «No lo modifiques» no admite un matiz, así que la
 *    única dirección permitida es vacío → valor.
 *
 *   node maggi.valores-de-rick.js              compara el contrato contra la hoja
 *   node maggi.valores-de-rick.js --capturar   guarda lo que hay hoy en la hoja
 *   node maggi.valores-de-rick.js --restaurar  apunta las celdas VACÍAS que el contrato sí tiene
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
// 🔴  EXISTE PARA PODER PROBAR ESTO. Una comparación que solo se puede correr contra la
//    hoja sana nunca demuestra que detecta una pérdida: sale «0 perdidas» siempre, y «siempre»
//    es indistinguible de «no mira». Con este flag se le planta el defecto sobre una COPIA.
var iL = process.argv.indexOf('--libro');
var LIBRO = iL >= 0 ? process.argv[iL + 1] : ENT.LIBRO;
var CB = require(BACK + '/_scripts/lib-cambios.js');
var RUTA = BACK + '/_contratos/maggi-valores-de-rick.json';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var CAPTURAR = process.argv.indexOf('--capturar') >= 0;
var RESTAURAR = process.argv.indexOf('--restaurar') >= 0;
var HOJA = 'Maggi Reporte';

// 🔴 LAS 7 SE DECLARAN AQUÍ, NO SE DEDUCEN. Una lista calculada —«las que el reporte no tiene»—
//    crecería sola el día que alguien agregue una columna al reporte, y este contrato empezaría a
//    guardar datos que sí tienen fuente. Lo que se protege es lo que NADIE produce, y eso se mide
//    una vez y se escribe.
var SUYAS = ['Tipo Email', 'WA-Clicks Qcart', 'WA-Clicks-Recetas', 'NOTAS', 'Clicks', 'Clicks vs Carritos'];

console.log('════ MAGGI · LOS VALORES DE RICK ' + (CAPTURAR ? '🔴 CAPTURA' : RESTAURAR ? '🔴 RESTAURA' : '(comparar)') + ' ════\n');

var tmp = BACK + '/_tmp/_vdr.xlsx';
fs.copyFileSync(LIBRO, tmp);
var sh = XLSX.readFile(tmp).Sheets[HOJA];
if (!sh) { console.log('🔴 no existe la hoja «' + HOJA + '»'); process.exit(1); }
var filas = XLSX.utils.sheet_to_json(sh, { defval: '' });
var A = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
var enc = A[0].map(t);
fs.unlinkSync(tmp);

var ID_CAM = 'Camp' + 'aña', ID_TP = 'Touch' + 'Point';
var cCAM = COL.de(filas, ID_CAM, 'resumen'), cTP = COL.de(filas, ID_TP, 'resumen'),
    cSEG = COL.de(filas, 'Segmento', 'resumen'), cQ = COL.de(filas, 'Quincena_Lanzamiento Principal', 'resumen');
function ident(r) { return [t(r[cCAM]), t(r[cTP]), t(r[cSEG]), t(r[cQ])].join(' ¦ '); }

// la fila FÍSICA de cada identidad, resuelta ahora: el contrato no la guarda
var filaDe = {};
A.forEach(function (r, i) {
  if (i === 0 || !t(r[enc.indexOf(cCAM)])) return;
  filaDe[[t(r[enc.indexOf(cCAM)]), t(r[enc.indexOf(cTP)]), t(r[enc.indexOf(cSEG)]), t(r[enc.indexOf(cQ)])].join(' ¦ ')] = i + 1;
});

var faltanCol = SUYAS.filter(function (c) { return enc.indexOf(c) < 0; });
if (faltanCol.length) { console.log('🔴 la hoja ya no tiene: ' + faltanCol.join(' · ') + '. No sigo: el contrato quedaría a medias.'); process.exit(1); }

// ── lo que hay HOY en la hoja
var hoy = {};
filas.forEach(function (r) {
  SUYAS.forEach(function (c) { if (t(r[c]) !== '') hoy[ident(r) + ' ¦¦ ' + c] = r[c]; });
});
console.log('  en la hoja hoy: ' + Object.keys(hoy).length + ' celda(s) con valor, en ' + SUYAS.length + ' columnas');

// ── CAPTURAR
if (CAPTURAR) {
  var C = { que_es: 'Las celdas de «' + HOJA + '» que escribió Rick y que ninguna fuente produce. La llave es la IDENTIDAD de la fila, nunca su número.',
    por_que: 'Rick, 2-oct-2026: «Esto es mío. No lo modifiques, en todo caso llévalo a la fuente». Viven solo en la celda; al regenerar la hoja se perderían.',
    columnas_protegidas: SUYAS, capturado: new Date().toISOString(), celdas: hoy };
  fs.writeFileSync(RUTA, JSON.stringify(C, null, 1));
  var v = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  console.log('  ✔ capturadas ' + Object.keys(v.celdas).length + ' celda(s) → _contratos/maggi-valores-de-rick.json');
  console.log('  ' + (Object.keys(v.celdas).length === Object.keys(hoy).length ? '✔ releído: coincide con la hoja' : '🔴 releído: NO coincide'));
  process.exit(Object.keys(v.celdas).length === Object.keys(hoy).length ? 0 : 1);
}

// ── comparar / restaurar
if (!fs.existsSync(RUTA)) { console.log('\n  ⚠ todavía no hay contrato. Córrelo con --capturar.'); process.exit(0); }
var C2 = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
var guard = C2.celdas || {};
console.log('  en el contrato: ' + Object.keys(guard).length + ' celda(s)   (capturado ' + String(C2.capturado).slice(0, 10) + ')');

var perdidas = [], cambiadas = [], nuevas = [];
Object.keys(guard).forEach(function (k) {
  if (hoy[k] === undefined) perdidas.push(k);
  else if (t(hoy[k]) !== t(guard[k])) cambiadas.push({ k: k, antes: guard[k], ahora: hoy[k] });
});
Object.keys(hoy).forEach(function (k) { if (guard[k] === undefined) nuevas.push(k); });

console.log('\n  ── el estado');
console.log('     🔴 PERDIDAS (el contrato las tiene y la hoja no): ' + perdidas.length);
perdidas.slice(0, 8).forEach(function (k) { console.log('        ' + k.replace(' ¦¦ ', '   →   ')); });
console.log('     ⚠ cambiadas (Rick las editó; manda la hoja): ' + cambiadas.length);
cambiadas.slice(0, 6).forEach(function (x) { console.log('        ' + x.k.replace(' ¦¦ ', '   →   ') + '   «' + t(x.antes) + '» → «' + t(x.ahora) + '»'); });
console.log('     + nuevas en la hoja (aún sin capturar): ' + nuevas.length);

if (!RESTAURAR) {
  if (cambiadas.length || nuevas.length) console.log('\n  → para que el contrato se ponga al día:  --capturar');
  if (perdidas.length) console.log('  → para devolver a la hoja lo perdido:   --restaurar');
  if (!perdidas.length && !cambiadas.length && !nuevas.length) console.log('\n  ✅ la hoja y el contrato dicen lo mismo.');
  process.exit(0);
}

if (!perdidas.length) { console.log('\n  ✅ no hay nada perdido que restaurar.'); process.exit(0); }
var n = 0, sinFila = [];
perdidas.forEach(function (k) {
  var p = k.split(' ¦¦ '), id = p[0], col = p[1];
  var f = filaDe[id];
  if (!f) { sinFila.push(k); return; }
  CB.apuntar('maggi-valores-de-rick', HOJA, f, col, guard[k],
    'Celda que escribió Rick y ninguna fuente produce; estaba en el contrato y la hoja la perdió. Se repone SOLO porque está vacía: este paso nunca pisa un valor.');
  n++;
});
if (sinFila.length) { console.log('\n  ⚠ ' + sinFila.length + ' sin fila en la hoja (su identidad ya no existe) — se declaran, no se inventan:'); sinFila.forEach(function (k) { console.log('     ' + k.replace(' ¦¦ ', '   →   ')); }); }
console.log('\n  ✔ apuntadas ' + n + ' celda(s).  Las aplica:  node escritor.escribir-todo.js --escribir');
