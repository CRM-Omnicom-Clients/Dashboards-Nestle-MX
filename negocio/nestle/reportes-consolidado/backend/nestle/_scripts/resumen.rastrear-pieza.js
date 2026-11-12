// resumen · RASTREAR UNA PIEZA POR LAS CUATRO CAPAS. Mide, no escribe.
//
// 🔴 PARA QUÉ. Rick mira una cifra del reporte y dice «se me hicieron demasiados envíos». La
//    pregunta no se contesta mirando el reporte: hay que ver POR DÓNDE PASÓ el número. Un envío
//    puede duplicarse en el bloque, doblarse al agregarse en la rejilla, o estar bien y ser
//    simplemente un acumulado de meses presentado como una quincena — y las tres se ven igual
//    desde la celda.
//
//    Las cuatro capas, en orden:
//      1 · la DE de SFMC  (el crudo: una fila por pieza, ya agregada por SFMC)
//      2 · el bloque      (`_fuentes/email.json`: la DE cruzada contra el catálogo)
//      3 · la rejilla     (`_rejilla/rejilla.json`: agregada por campaña×tp×segmento×quincena)
//      4 · el reporte     (la hoja)
//
// Uso:  node resumen.rastrear-pieza.js E-PROP1
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var QUE = process.argv[2] || 'E-PROP1';
var re = new RegExp(QUE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

console.log('════════ RASTREAR «' + QUE + '» POR LAS CUATRO CAPAS ════════\n');

// ── 1 · la DE de SFMC ───────────────────────────────────────────────────────────────
var dir = BACK + '/_insumos';
var cands = fs.readdirSync(dir).filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
var S = JSON.parse(fs.readFileSync(dir + '/' + cands[cands.length - 1], 'utf8'));
var filasS = (S.rows || S.data || []).filter(function (r) { return re.test(t(r.EmailName)) || re.test(t(r.Touchpoint)); });
console.log('  ── 1 · LA DE DE SFMC   (' + cands[cands.length - 1] + ')');
var sumS = 0;
filasS.forEach(function (r) {
  sumS += num(r.Email_Sends);
  console.log('     ck=' + t(r.ConfigKey).padEnd(24) + ' fup=' + t(r.Es_FUP).padEnd(3) +
    ' sends=' + mil(r.Email_Sends).padStart(10) + '  jobs=' + t(r.N_Jobs).padStart(4) +
    '  dias=' + t(r.Dias_Con_Envio).padStart(4) + '  ' + t(r.Fecha_Primer_Envio).slice(0, 10) + ' → ' + t(r.Fecha_Ultimo_Envio).slice(0, 10));
  console.log('        audiencia: ' + t(r.Audience_DE).slice(0, 56) + '   vol=' + mil(r.Audience_Volume));
  console.log('        opens=' + mil(r.Email_Unique_Opens).padStart(9) + '  clicks=' + mil(r.Email_Unique_Clicks).padStart(8) +
    '  entregados=' + mil(r.Email_Deliveries).padStart(10) + '  OR=' + t(r.Open_Rate));
});
console.log('     Σ SFMC = ' + mil(sumS));

// ── 2 · el bloque ───────────────────────────────────────────────────────────────────
var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var env = (E.envios || []).filter(function (e) { return re.test(t(e.content_name)) || re.test(t(e.touchpoint_raw)); });
console.log('\n  ── 2 · EL BLOQUE   (_fuentes/email.json)');
var sumB = 0;
env.forEach(function (e) { sumB += num(e.email_sends); console.log('     ' + t(e.pieza_id).padEnd(11) + t(e.email_type).padEnd(12) + mil(e.email_sends).padStart(10) + '  fecha=' + t(e.fecha)); });
console.log('     Σ bloque = ' + mil(sumB) + (sumB === sumS ? '   ✔ igual que SFMC' : '   🔴 DIFIERE de SFMC en ' + mil(sumB - sumS)));

// ── 3 · la rejilla ──────────────────────────────────────────────────────────────────
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var cel = (R.rejilla || []).filter(function (c) { return re.test(t(c.touchpoint)); });
console.log('\n  ── 3 · LA REJILLA   (_rejilla/rejilla.json)');
var sumR = 0;
cel.forEach(function (c) {
  var p = (c.principal && c.principal.sends) || 0, f = (c.fup && c.fup.sends) || 0;
  sumR += p + f;
  console.log('     ' + t(c.campana).padEnd(10) + t(c.segmento).slice(0, 22).padEnd(24) + t(c.quincena).padEnd(12) +
    ' P=' + mil(p).padStart(10) + '  FUP=' + mil(f).padStart(9) + '  piezas=' + (c.piezas || []).join(','));
});
console.log('     Σ rejilla = ' + mil(sumR) + (sumR === sumB ? '   ✔ igual que el bloque' : '   🔴 DIFIERE del bloque en ' + mil(sumR - sumB)));

// ── 4 · el reporte ──────────────────────────────────────────────────────────────────
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_rastro.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var H = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Report_Resumen'], { header: 1, defval: '' });
var enc = H[0].map(t);
var g = function (n) { return enc.indexOf(n); };
console.log('\n  ── 4 · EL REPORTE   (' + path.basename(vivo.ruta) + ')');
var sumH = 0;
for (var r = 1; r < H.length; r++) {
  if (!re.test(t(H[r][g('TouchPoint')]))) continue;
  var p2 = num(H[r][g('Principal_Sends')]), f2 = num(H[r][g('FUP_Sends')]);
  sumH += p2 + f2;
  console.log('     fila ' + (r + 1) + '   ' + t(H[r][g('Campaña')]).padEnd(10) + t(H[r][g('Segmento')]).slice(0, 20).padEnd(22) +
    t(H[r][g('Quincena_Lanzamiento Principal')]).padEnd(12) + ' P=' + mil(p2).padStart(10) + '  FUP=' + mil(f2).padStart(9) + '  Tot=' + mil(H[r][g('Tot_Sends')]));
}
console.log('     Σ reporte = ' + mil(sumH) + (sumH === sumR ? '   ✔ igual que la rejilla' : '   🔴 DIFIERE de la rejilla en ' + mil(sumH - sumR)));

console.log('\n════ VEREDICTO ════');
if (sumS === sumB && sumB === sumR && sumR === sumH) {
  console.log('  ✔ el número NO se duplica en ninguna capa: ' + mil(sumS) + ' de punta a punta.');
  console.log('    Si la cifra parece alta, el asunto NO es un doble conteo — es qué SIGNIFICA.');
} else {
  console.log('  🔴 el número cambia entre capas. SFMC ' + mil(sumS) + ' → bloque ' + mil(sumB) +
    ' → rejilla ' + mil(sumR) + ' → reporte ' + mil(sumH));
}
fs.unlinkSync(TMP);
