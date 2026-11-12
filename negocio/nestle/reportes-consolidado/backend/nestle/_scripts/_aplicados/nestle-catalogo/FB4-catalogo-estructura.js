// FB4-catalogo-estructura.js — B1+B2: darle al catálogo las columnas que le faltan y quitarle
// las que sobran.
//
// 🔴 LO QUE PIDIÓ RICK (20-ago): «Agrégalas · Llénalas si tienes datos, si no elimina, **máximo 4
//    serán**». Se refiere a los slots de receta/tienda: el catálogo prevé 5 y ninguna pieza llegó
//    a tener 5, así que el slot 5 se retira. Los slots 1-4 se quedan aunque alguno esté vacío:
//    un hueco DENTRO del rango válido es un dato («esta pieza tuvo 3 recetas»), no un sobrante.
//
// QUÉ SE AGREGA Y DE DÓNDE SALE CADA COLUMNA
//   · `Subsegmento`  — genérica. Vacía para casi todos; en Purina lleva la mascota. NO es una
//                      columna de un cliente: es un nivel del modelo que hoy no existía.
//   · `EmailName`    — la cadena COMPLETA del correo, tal como viene de la Data Extension.
//   · `Content_ID`   — el SEGMENTO FINAL de esa cadena. Ninguno de los dos viene del journey.
//   · `EmailID`      — el id numérico del creativo en SFMC.
//
// 🔴 SE RECONSTRUYE LA HOJA, y por eso se comprueba celda a celda que ningún dato se perdió:
//    se relee y se compara contra lo que había, columna por columna.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ B1+B2 · ESTRUCTURA DEL CATÁLOGO ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fb4.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS = Object.keys(P[0]);

// ── qué se quita: el slot 5, y SOLO si de verdad está vacío ────────────────────────────────
var QUITAR = COLS.filter(function (c) { return /_5$/.test(c); });
var noVacias = QUITAR.filter(function (c) { return P.some(function (p) { return t(p[c]) !== ''; }); });
if (noVacias.length) {
  console.log('  🔴 estas columnas del slot 5 TIENEN datos y NO se quitan: ' + noVacias.join(' · '));
  QUITAR = QUITAR.filter(function (c) { return noVacias.indexOf(c) < 0; });
}
console.log('  ── se QUITAN (slot 5, vacías): ' + QUITAR.length);
QUITAR.forEach(function (c) { console.log('     − ' + c); });

// ── qué se agrega ──────────────────────────────────────────────────────────────────────────
var AGREGAR = ['Subsegmento', 'EmailName', 'Content_ID', 'EmailID'].filter(function (c) { return COLS.indexOf(c) < 0; });
console.log('\n  ── se AGREGAN: ' + AGREGAR.length);
AGREGAR.forEach(function (c) { console.log('     + ' + c); });

// ── de dónde se llenan ─────────────────────────────────────────────────────────────────────
// EmailName y EmailID salen de SFMC, que es la fuente de verdad. Content_ID se DERIVA del
// EmailName cortando su segmento final. Subsegmento sale del propio Segmento cuando ya trae el
// separador « — » (así lo escribe Rick en el reporte).
var porPieza = {};
try {
  var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-email-detalle.json', 'utf8'));
  D.rows.forEach(function (r) {
    var k = t(r.ConfigKey); if (!k) return;
    porPieza[k] = porPieza[k] || { nombres: {}, ids: {} };
    if (t(r.Email_Content_Name)) porPieza[k].nombres[t(r.Email_Content_Name)] = 1;
    if (t(r.Email_ID)) porPieza[k].ids[t(r.Email_ID)] = 1;
  });
} catch (e) { console.log('  ⚠ sin la DE de SFMC: ' + e.message.slice(0, 50)); }

// 🔴 LA REGLA DE CORTE del Content_ID, declarada y probada contra los 3 formatos que existen:
//    · journey  `..._NEW-PARENTS_AC_EM_A_V1_803867`            → `803867`
//    · one-shot `..._Concentrate_AC_EM_A_V1_001577`            → `001577`
//    · Proplan  `...Comunidad.CDP_Proplan_PP_E3A1.NA`          → `PP_E3A1`
//    Es «lo que queda después del último separador significativo», no «el número del journey».
function contentIdDe(nombre) {
  var n = t(nombre); if (!n) return '';
  if (/CDP_Proplan/i.test(n)) {
    var m = /CDP_Proplan[._]([A-Za-z0-9]+_[A-Za-z0-9]+)/.exec(n);
    if (m) return m[1];
  }
  var partes = n.split('_');
  var ult = partes[partes.length - 1];
  if (/^\d+$/.test(ult)) return ult;                    // journey / one-shot numérico
  var pen = partes[partes.length - 2] || '';
  return /^\d+$/.test(pen) ? pen : ult.replace(/\.NA$/i, '');
}

var lleno = { Subsegmento: 0, EmailName: 0, Content_ID: 0, EmailID: 0 };
var valores = P.map(function (p) {
  var id = t(p['Pieza_ID']), s = porPieza[id] || { nombres: {}, ids: {} };
  var nombres = Object.keys(s.nombres);
  var emailName = nombres[0] || t(p['Content_Name']);
  var seg = t(p['Segmento']), sub = '';
  var m = seg.split(/\s*[—–]\s*/);              // « Persona — Mascota », como lo escribe Rick
  if (m.length > 1) sub = m.slice(1).join(' — ');
  var o = {
    Subsegmento: sub,
    EmailName: emailName,
    Content_ID: contentIdDe(emailName),
    EmailID: Object.keys(s.ids).join(', ')
  };
  Object.keys(o).forEach(function (k) { if (t(o[k])) lleno[k]++; });
  return o;
});
console.log('\n  ── con qué quedan llenas');
Object.keys(lleno).forEach(function (k) {
  console.log('     ' + k.padEnd(14) + String(lleno[k]).padStart(3) + '/' + P.length +
    (k === 'Subsegmento' ? '   (solo aplica donde el Segmento trae « — »)' : ''));
});
console.log('\n  ── ejemplos de la regla de corte de Content_ID');
['001-P003', '007-P001', '009-P002'].forEach(function (id) {
  var i = P.findIndex(function (p) { return t(p['Pieza_ID']) === id; }); if (i < 0) return;
  console.log('     ' + id + '  ' + t(valores[i].EmailName).slice(-52).padEnd(54) + ' → «' + valores[i].Content_ID + '»');
});

if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FB4-catalogo-estructura.js --escribir'); process.exit(0); }

// ── reconstruir la hoja ────────────────────────────────────────────────────────────────────
var NUEVAS = COLS.filter(function (c) { return QUITAR.indexOf(c) < 0; }).concat(AGREGAR);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var estH = CX.estiloDe(xml, 'A1'), estD = CX.estiloDe(xml, 'A2');
// estilo original de cada columna que SOBREVIVE, para que la hoja no cambie de aspecto
var estOrig = {}; COLS.forEach(function (c, i) { estOrig[c] = CX.estiloDe(xml, col(i) + '2'); });

var filas = P.map(function (p, r) {
  var nFila = r + 2;
  var celdas = NUEVAS.map(function (c, i) {
    var v = AGREGAR.indexOf(c) >= 0 ? valores[r][c] : p[c];
    if (v === '' || v === null || v === undefined) return '';
    return CX.celda(col(i) + nFila, v, estOrig[c] || estD);
  }).filter(Boolean).join('');
  return '<row r="' + nFila + '">' + celdas + '</row>';
}).join('');
var enc = NUEVAS.map(function (c, i) { return CX.celda(col(i) + '1', c, estH); }).join('');
xml = xml.replace(/<sheetData>[\s\S]*<\/sheetData>/, '<sheetData><row r="1">' + enc + '</row>' + filas + '</sheetData>');
xml = xml.replace(new RegExp('<dimension ref="[^"]*"/>'), '<dimension ref="A1:' + col(NUEVAS.length - 1) + (P.length + 1) + '"/>');
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});

// ── 🔴 comprobar que NADA se perdió: columna por columna, celda por celda ──────────────────
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var perdidas = [], difs = 0;
COLS.filter(function (c) { return QUITAR.indexOf(c) < 0; }).forEach(function (c) {
  if (Object.keys(P2[0]).indexOf(c) < 0) { perdidas.push(c); return; }
  P.forEach(function (p, i) { if (t(p[c]) !== t(P2[i] && P2[i][c])) difs++; });
});
console.log('\n  ── verificación');
console.log('     filas: ' + P.length + ' → ' + P2.length + (P.length === P2.length ? '  ✔' : '  🔴'));
console.log('     columnas: ' + COLS.length + ' → ' + Object.keys(P2[0]).length + '  (−' + QUITAR.length + ' +' + AGREGAR.length + ')');
console.log('     columnas perdidas: ' + (perdidas.length ? '🔴 ' + perdidas.join(' · ') : 'ninguna ✔'));
console.log('     celdas que cambiaron de valor: ' + (difs ? '🔴 ' + difs : '0 ✔'));
if (perdidas.length || difs || P.length !== P2.length) { console.log('\n  🔴 NO se publica: la reconstrucción perdió datos'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ catálogo reestructurado y publicado');
