// C3 · QUÉ SE PIERDE AL RECONSTRUIR Data_Email — dicho ANTES de que C2 escriba.
//
// 🔴 EL ÚNICO PASO DEL CORTE QUE PUEDE DESTRUIR TRABAJO DE RICK. Data_Email tiene 277 celdas
//    canónicas escritas A MANO (Segmento_Canonico 193, Campana_Canonica 82, y 1+1 en BU/Marca).
//    C2 la reconstruye a 98 filas desde el bloque, que resuelve las 4 canónicas por su cuenta.
//    Si el bloque resuelve DISTINTO a lo que Rick escribió, esa reconstrucción borra su corrección.
//
// 🔴 ESTE PASO NO ESCRIBE. Compara, pieza por pieza, la canónica a mano contra la del bloque, y
//    lista cada diferencia. Regla de oro: si algo suyo se va a perder, AVISAR y ESPERAR — no
//    repararlo por cuenta propia. Diffear DESPUÉS de escribir ya no sirve: el trabajo ya se perdió.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nmz(v) { return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }

// canónica en la hoja  →  campo en el bloque
var CANON = [['BU_Canonico', 'bu_canonico'], ['Marca', 'marca_canonica'],
  ['Campana_Canonica', 'campana_canonica'], ['Segmento_Canonico', 'segmento_canonico']];

console.log('════════ C3 · QUÉ SE PIERDE AL RECONSTRUIR Data_Email ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var F = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '', blankrows: false });
var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8')).envios;
var bloque = {}; E.forEach(function (e) { bloque[t(e.pieza_id)] = e; });

// las piezas de la hoja actual, agrupadas
var porPieza = {};
F.forEach(function (r) { var id = t(r['pieza_id']); if (id) (porPieza[id] = porPieza[id] || []).push(r); });
console.log('  hoja actual: ' + F.length + ' filas · ' + Object.keys(porPieza).length + ' piezas distintas');
console.log('  bloque nuevo: ' + E.length + ' piezas\n');

// 1 · piezas de la hoja que NO están en el bloque (se perderían filas enteras)
var soloHoja = Object.keys(porPieza).filter(function (id) { return !bloque[id]; });
var soloBloque = Object.keys(bloque).filter(function (id) { return !porPieza[id]; });
console.log('══ cobertura ══');
console.log('  piezas en la hoja pero NO en el bloque: ' + soloHoja.length + (soloHoja.length ? '  → ' + soloHoja.slice(0, 20).join(' · ') : ' ✔'));
console.log('  piezas en el bloque pero NO en la hoja: ' + soloBloque.length + (soloBloque.length ? '  → ' + soloBloque.slice(0, 20).join(' · ') : ' ✔'));

// 2 · canónicas a mano que el bloque resuelve DISTINTO
console.log('\n══ canónicas: lo escrito a mano vs lo que el bloque resuelve ══');
var difs = [], internas = [];
Object.keys(porPieza).forEach(function (id) {
  var filas = porPieza[id], b = bloque[id];
  CANON.forEach(function (par) {
    var enHoja = filas.map(function (r) { return t(r[par[0]]); }).filter(Boolean);
    var distintos = enHoja.filter(function (v, i) { return enHoja.indexOf(v) === i; });
    // si dentro de la misma pieza la hoja ya trae dos valores, es un conflicto interno
    if (distintos.length > 1) internas.push({ pieza: id, col: par[0], valores: distintos });
    if (!b) return;
    var manual = distintos[0] || '';
    var resuelto = t(b[par[1]]);
    if (manual && nmz(manual) !== nmz(resuelto)) difs.push({ pieza: id, col: par[0], a_mano: manual, bloque: resuelto });
  });
});

if (internas.length) {
  console.log('  ⚠ ' + internas.length + ' caso(s) donde la MISMA pieza trae dos valores a mano:');
  internas.slice(0, 8).forEach(function (x) { console.log('     ' + x.pieza.padEnd(10) + x.col.padEnd(20) + x.valores.join('  |  ')); });
}

console.log('\n  🔴 celdas a mano que el bloque resolvería DISTINTO: ' + difs.length);
if (difs.length) {
  difs.slice(0, 30).forEach(function (d) {
    console.log('     ' + d.pieza.padEnd(10) + d.col.padEnd(20) + 'a mano «' + d.a_mano + '»   →  bloque «' + d.bloque + '»');
  });
  if (difs.length > 30) console.log('     … y ' + (difs.length - 30) + ' más');
}

fs.writeFileSync(BACK + '/_respaldos/C3-diff-canonicas.json', JSON.stringify({
  paso: 'C3', cuando: '2026-08-21',
  hoja_filas: F.length, hoja_piezas: Object.keys(porPieza).length, bloque_piezas: E.length,
  solo_en_hoja: soloHoja, solo_en_bloque: soloBloque,
  conflictos_internos: internas, difieren_del_bloque: difs
}, null, 1));
console.log('\n  → _respaldos/C3-diff-canonicas.json');

var seguro = difs.length === 0 && soloHoja.length === 0;
console.log('\n════════ ' + (seguro ? '✅ C2 puede reescribir: el bloque no pierde ninguna canónica a mano' :
  '🔴 HAY QUE DECIDIR antes de C2 — ver la lista de arriba') + ' ════════');
process.exit(seguro ? 0 : 1);
