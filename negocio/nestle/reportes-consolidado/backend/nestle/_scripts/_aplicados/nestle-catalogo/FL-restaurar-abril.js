// FL · RESTAURAR LA OLEADA DE ABRIL DE AON TRADITIONAL PARENTS (fila 73)
//
// 🔴 QUÉ PASÓ. Rick construyó a mano la fila de la oleada de ABRIL (journey 863587, Email ID
//    80879/81286, 38,093 + 29,136 = 67,229 envíos, con su Qcart de abril partido por fecha de
//    activación del link). El escritor la sobrescribió con una copia EXACTA de la fila de marzo:
//    la llave de N6 no llevaba la quincena, así que las dos filas —misma campaña, mismo
//    touchpoint, mismo segmento— colapsaban en una, y la de marzo se escribía en las dos.
//    Resultado: abril mostrando los números de marzo, y el total del reporte contando 66,204
//    envíos dos veces.
//
// 🔴 POR QUÉ NO SE PUEDE REGENERAR. SFMC no entrega esos dos correos: `CRM_Reporte_Config`
//    todavía tiene el `Content_Name` de marzo en las piezas de abril (`001-P025` / `001-P027`).
//    Mientras eso no se corrija, la rejilla NO puede producir esta fila. Es de Rick y punto.
//
// La corrección de la llave (identidad + quincena) ya está en N6; esto repara el daño hecho.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var FUENTE = PROY + '/_backups/(Interno)-Reporte-Consolidado-Nestle-2026-v8 - Copy200826.xlsx';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(i) { var s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }

// 🔴 LO QUE NO SE RESTAURA: las dimensiones canónicas. `Marca` decía «RN» en TODAS las filas de
//    aquella copia y hoy dice «Recetas Nestlé» porque el catálogo lo corrigió en bloque. Eso no
//    es trabajo de Rick perdido: es una mejora del sistema posterior. Se deja la de hoy.
var NO_RESTAURAR = { 'Marca': 1, 'BU': 1, 'Campaña': 1, 'Medio': 1, 'Objetivo': 1, 'TouchPoint': 1, 'Segmento': 1 };

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fl.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var A = os.homedir() + '/_fl-fuente.xlsx';
fs.copyFileSync(FUENTE, A);

var R = XLSX.utils.sheet_to_json(XLSX.readFile(A).Sheets['Report_Resumen'], { defval: '', blankrows: false });
var wb = XLSX.readFile(SECO);
var V = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var COLS = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0].map(t);

// 🔴 LA FILA SE BUSCA POR IDENTIDAD + QUINCENA, no por su número. Si alguien inserta una fila
//    arriba, «la 73» deja de ser la 73 — y el parche caería en la fila equivocada.
function buscar(F, q) {
  for (var i = 0; i < F.length; i++) {
    var x = F[i];
    if (t(x['Campaña']) === 'AON' && t(x['TouchPoint']) === 'E-P1' &&
        t(x['Segmento']) === 'Traditional Parents' && t(x['Quincena_Lanzamiento']) === q) return i;
  }
  return -1;
}
var iR = buscar(R, 'Abr-Q2-2026');
var iV = buscar(V, 'Abr-Q2-2026');
if (iR < 0) { console.log('🔴 la fila de abril NO está en la copia fuente. No se toca nada.'); process.exit(1); }
if (iV < 0) { console.log('🔴 la fila de abril NO está en el vivo. No se toca nada.'); process.exit(1); }
var nFila = iV + 2;
console.log('fuente: fila ' + (iR + 2) + ' de la copia 11:57   ·   destino: fila ' + nFila + ' del vivo\n');

// la marca de que el daño ocurrió: el vivo es idéntico a marzo
var iMar = buscar(V, 'Mar-Q2-2026');
if (iMar >= 0) {
  var igual = ['Tot_Sends', 'Email_ID (SFMC)', 'Content_ID (SFMC)'].every(function (c) { return t(V[iV][c]) === t(V[iMar][c]); });
  console.log('   ¿el vivo de abril es una copia de marzo?  ' + (igual ? '🔴 SÍ — hay daño que reparar' : 'no'));
  if (!igual) { console.log('   nada que reparar. Sale sin tocar.'); process.exit(0); }
}

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
function tieneFormula(x, ref) {
  var m = new RegExp('<c r="' + ref + '"(?![^>]*\/>)[^>]*>([\s\S]*?)</c>').exec(x);
  return !!(m && m[1].indexOf('<f') >= 0);
}

var cambios = [], respetadas = 0, saltadas = 0;
COLS.forEach(function (nom, i) {
  if (!nom) return;
  if (NO_RESTAURAR[nom]) { saltadas++; return; }
  var a = R[iR][nom], b = V[iV][nom];
  if (t(a) === t(b)) return;
  var ref = col(i) + nFila;
  if (tieneFormula(xml, ref)) { respetadas++; return; }
  cambios.push({ col: nom, ref: ref, de: t(b), a: t(a), valor: a });
});
console.log('   celdas a restaurar: ' + cambios.length + '   ·   con fórmula (se respetan): ' + respetadas + '   ·   dimensiones que NO se revierten: ' + saltadas + '\n');
cambios.forEach(function (c) { console.log('      ' + c.ref.padEnd(6) + c.col.slice(0, 24).padEnd(26) + '"' + c.de.slice(0, 22) + '"  ->  "' + String(c.a).slice(0, 22) + '"'); });

if (!ESCRIBIR) { console.log('\n   (simulación. Para aplicar: --escribir)'); process.exit(0); }

var estH = CX.estiloDe(xml, 'A1');
cambios.forEach(function (c) {
  var est = CX.estiloDe(xml, c.ref) || CX.estiloDe(xml, c.ref.replace(/\d+$/, '2')) || estH;
  var v = (c.valor === '' || c.valor === null || c.valor === undefined) ? '' : c.valor;
  xml = CX.poner(xml, c.ref, CX.celda(c.ref, v, est), nFila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));
var V2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Report_Resumen'], { defval: '', blankrows: false });
var j = buscar(V2, 'Abr-Q2-2026');
console.log('\n  ── releído de disco, fila ' + (j + 2) + ':');
['Content_ID (SFMC)', 'Email_ID (SFMC)', 'Principal_Sends', 'FUP_Sends', 'Tot_Sends', 'Carritos_Total', 'Intencion_Total_MXN', 'Receta_Representativa']
  .forEach(function (c) { console.log('     ' + c.padEnd(22) + t(V2[j][c])); });
console.log('\n  archivo listo en: ' + SECO + '   (NO se publicó al vivo todavía)');
