// R1 · LAS COLUMNAS NUEVAS DEL REPORTE, pedidas por Rick el 21-ago-2026:
//      «DE (Audiencia original), volumen original, desglose de clicks y unsubscribes».
//
// 🔴 SE AGREGAN AL FINAL, NUNCA EN MEDIO. Mover una columna existente rompe las 437 fórmulas de
//    Rick, que apuntan por letra. Al final no estorban a nadie y la hoja sigue mandando su forma.
//
// 🔴 Y LA FILA DE TOTALES SIGUE AL FINAL, con SUM para las columnas que se suman. Las que NO se
//    suman —el nombre de la DE de audiencia— se quedan sin total, porque un total de texto no
//    significa nada. El VOLUMEN tampoco se suma entre filas: dos celdas pueden compartir la misma
//    audiencia y sumarlas contaría dos veces a la misma gente. Se declara en la columna y punto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// las columnas, con su naturaleza: `suma` decide si la fila de totales lleva SUM
var NUEVAS = [
  { nom: 'Audiencia_DE', suma: false, que: 'la DE que activó el journey — el nombre de la audiencia original' },
  { nom: 'Audiencia_Volumen', suma: false, que: 'tamaño de esa audiencia. NO se suma entre filas: dos celdas pueden compartir DE' },
  { nom: 'Unsubs_Unicos', suma: true, que: 'suscriptores distintos que se dieron de baja' },
  { nom: 'Unsubs_Total', suma: true, que: 'bajas totales (una persona puede aparecer más de una vez)' },
  { nom: 'Clicks_Qcart', suma: true, que: 'clicks únicos al carrito' },
  { nom: 'Clicks_App', suma: true, que: 'clicks únicos a la app' },
  { nom: 'Clicks_Social', suma: true, que: 'clicks únicos a redes' },
  { nom: 'Clicks_Web', suma: true, que: 'clicks únicos a web/receta' },
  { nom: 'Clicks_Ver_Navegador', suma: true, que: 'clicks a «ver en navegador»' },
  { nom: 'Clicks_Unsub', suma: true, que: 'clicks al link de baja' },
  { nom: 'Clicks_Links_Total', suma: true, que: 'Σ de los links de la pieza — cuadra con el desglose' }
];

console.log('════════ R1 · COLUMNAS NUEVAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_r1.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Report_Resumen'];
var rng = XLSX.utils.decode_range(sh['!ref']);
var enc = [];
for (var c = rng.s.c; c <= rng.e.c; c++) { var hh = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; enc.push(hh ? t(hh.v) : ''); }
console.log('  hoja: ' + enc.filter(Boolean).length + ' columnas · hasta la fila ' + (rng.e.r + 1));

var faltan = NUEVAS.filter(function (n) { return enc.indexOf(n.nom) < 0; });
console.log('  columnas nuevas que faltan: ' + faltan.length + ' de ' + NUEVAS.length);
faltan.forEach(function (n) { console.log('     ' + n.nom.padEnd(24) + n.que); });
if (!faltan.length) { console.log('\n  ✅ ya están todas.'); process.exit(0); }

// la fila de totales: la última con etiqueta y sin TouchPoint
var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
var iTot = -1;
F.forEach(function (x, i) { if (!t(x['TouchPoint']) && /total/i.test(t(x['Campaña']))) iTot = i; });
var filaTot = iTot >= 0 ? iTot + 2 : rng.e.r + 1;
console.log('\n  fila de totales: ' + filaTot + '   ·   última fila: ' + (rng.e.r + 1) +
  (filaTot === rng.e.r + 1 ? '   ✔ está al final' : '   🔴 NO está al final'));
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var estH = CX.estiloDe(xml, 'A1');
var estTot = CX.estiloDe(xml, 'O' + filaTot);
var base = enc.length;
faltan.forEach(function (n, k) {
  var i = base + k, letra = R.letra(i);
  // el encabezado
  xml = CX.poner(xml, letra + '1', CX.celda(letra + '1', n.nom, estH), 1).xml;
  // el total, solo si la columna se suma
  if (n.suma) {
    var ref = letra + filaTot;
    var f = '<c r="' + ref + '"' + (estTot ? ' s="' + estTot + '"' : '') + '><f>SUM(' + letra + '2:' + letra + (filaTot - 1) + ')</f></c>';
    xml = CX.poner(xml, ref, f, filaTot).xml;
  }
  console.log('   + ' + letra + '  ' + n.nom + (n.suma ? '   (con SUM en la fila ' + filaTot + ')' : '   (sin total: no se suma)'));
});
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + R.letra(base + faltan.length - 1) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
var sh2 = XLSX.readFile(SECO).Sheets['Report_Resumen'];
var enc2 = XLSX.utils.sheet_to_json(sh2, { header: 1 })[0];
var puestas = NUEVAS.filter(function (n) { return enc2.indexOf(n.nom) >= 0; }).length;
console.log('  ── releído: ' + enc2.filter(Boolean).length + ' columnas · las nuevas presentes: ' + puestas + '/' + NUEVAS.length +
  ' ' + (puestas === NUEVAS.length ? '✔' : '🔴'));
console.log('\n  archivo listo en: ' + SECO);
