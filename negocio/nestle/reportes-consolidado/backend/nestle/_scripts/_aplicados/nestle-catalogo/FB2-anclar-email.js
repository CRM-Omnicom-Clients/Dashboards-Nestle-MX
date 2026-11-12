// FB2-anclar-email.js — B7: devolverle a `Data_Email` su columna `pieza_id`.
//
// 🔴 QUÉ SE ROMPIÓ. `Data_Email` tiene 264 filas y 6,454,554 envíos, y **ninguna ancla**: la
//    columna `pieza_id` no existe en la hoja. Sin ella, ningún envío de email cruza al catálogo,
//    y el motor solo puede reportar lo que le llega por otro camino.
//
// 🔴 CÓMO SE ANCLA, Y POR QUÉ ASÍ. La hoja trae `Email_Content_Name`, que es exactamente la llave
//    que SFMC usa: en la DE `CRM_Email_Detalle`, cada fila lleva `ConfigKey` (= el Pieza_ID) junto
//    a su `Email_Content_Name`. Así que el puente NO se adivina: se lee de SFMC, que es la fuente
//    de verdad. El catálogo (`Content_Name`) entra como segunda vía, y se declara cuál se usó.
//
// 🔴 ES ADITIVO. Se agrega UNA columna al final. No se toca ninguna de las 43 que ya están.
//
// USO:  node FB2-anclar-email.js            → seco, solo mide
//       node FB2-anclar-email.js --escribir → agrega la columna
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
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
// normalizar un content name: sin acentos, sin separadores, minúsculas. Un `.NA` vs `_NA` es el
// mismo correo; una tilde de más también.
function nm(v) {
  return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

console.log('════════ B7 · ANCLAR Data_Email ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fb2.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '', blankrows: false });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

// ── el puente: SFMC primero, catálogo después ──────────────────────────────────────────────
var porSFMC = {}, porCat = {};
try {
  var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-email-detalle.json', 'utf8'));
  D.rows.forEach(function (r) {
    var k = nm(r.Email_Content_Name); if (k && t(r.ConfigKey)) porSFMC[k] = t(r.ConfigKey);
  });
} catch (e) { console.log('  ⚠ sin la DE de SFMC: ' + e.message.slice(0, 60)); }
P.forEach(function (p) {
  var k = nm(p['Content_Name']); if (k && t(p['Pieza_ID'])) porCat[k] = t(p['Pieza_ID']);
  // el catálogo también guarda variantes del nombre; todas apuntan a la misma pieza
  t(p['Content_Names_Variantes']).split(/\s*[·|;]\s*/).forEach(function (v) {
    var kv = nm(v); if (kv && t(p['Pieza_ID']) && !porCat[kv]) porCat[kv] = t(p['Pieza_ID']);
  });
});
console.log('  puentes disponibles:  SFMC ' + Object.keys(porSFMC).length + ' nombres  ·  catálogo ' + Object.keys(porCat).length + ' nombres\n');

// ── resolver cada fila ─────────────────────────────────────────────────────────────────────
var enCat = {}; P.forEach(function (p) { if (t(p['Pieza_ID'])) enCat[t(p['Pieza_ID'])] = 1; });
var via = { sfmc: 0, catalogo: 0, sin: 0 }, sinAncla = [], resuelto = [];
E.forEach(function (x, i) {
  var k = nm(x['Email_Content_Name']);
  var id = porSFMC[k] || '', v = 'sfmc';
  if (!id) { id = porCat[k] || ''; v = id ? 'catalogo' : 'sin'; }
  if (id && !enCat[id]) { id = ''; v = 'sin'; }   // un id que no está en el catálogo NO ancla
  via[v]++;
  resuelto.push(id);
  if (!id) sinAncla.push({ fila: i + 2, nombre: t(x['Email_Content_Name']).slice(-46), sends: Number(String(x['Email_Sends']).replace(/[, ]/g, '')) || 0 });
});
var conAncla = via.sfmc + via.catalogo;
var sendsSin = sinAncla.reduce(function (a, s) { return a + s.sends; }, 0);
var sendsTot = E.reduce(function (a, x) { return a + (Number(String(x['Email_Sends']).replace(/[, ]/g, '')) || 0); }, 0);

console.log('  ── resultado del anclaje');
console.log('     filas          : ' + E.length);
console.log('     por SFMC       : ' + via.sfmc + '   (la fuente de verdad)');
console.log('     por catálogo   : ' + via.catalogo);
console.log('     SIN ancla      : ' + via.sin + '   (' + mil(sendsSin) + ' de ' + mil(sendsTot) + ' envíos = ' + (sendsTot ? (sendsSin / sendsTot * 100).toFixed(1) : 0) + '%)');
console.log('     cobertura      : ' + Math.round(conAncla / E.length * 100) + '%');
console.log('     piezas tocadas : ' + Object.keys(resuelto.filter(Boolean).reduce(function (o, x) { o[x] = 1; return o; }, {})).length);
if (sinAncla.length) {
  console.log('\n  ── las que no anclan (con su volumen, para saber cuánto se pierde)');
  sinAncla.slice(0, 14).forEach(function (s) {
    console.log('     fila ' + String(s.fila).padStart(4) + '  ' + mil(s.sends).padStart(9) + '  …' + s.nombre);
  });
  if (sinAncla.length > 14) console.log('     … y ' + (sinAncla.length - 14) + ' más');
}
fs.writeFileSync(BACK + '/_fuentes/anclaje-email.json', JSON.stringify({
  paso: 'B7', filas: E.length, via: via, cobertura_pct: Math.round(conAncla / E.length * 100),
  sends_sin_ancla: sendsSin, sin_ancla: sinAncla
}, null, 1));

if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FB2-anclar-email.js --escribir'); process.exit(0); }

// ── escribir la columna, al final, sin tocar nada más ──────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Data_Email') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var cols = Object.keys(E[0]);
var yaEsta = cols.filter(function (c) { return /^pieza[_ ]?id$/i.test(c); })[0];
var iCol = yaEsta ? cols.indexOf(yaEsta) : cols.length;
console.log('\n  ── escritura');
console.log('     columna: ' + col(iCol) + ' (' + (yaEsta ? 'ya existía, se actualiza' : 'nueva, al final') + ')');
var estH = CX.estiloDe(xml, 'A1'), estD = CX.estiloDe(xml, 'A2');
xml = CX.poner(xml, col(iCol) + '1', CX.celda(col(iCol) + '1', 'pieza_id', estH), 1).xml;
var escritas = 0;
resuelto.forEach(function (id, i) {
  if (!id) return;
  var nFila = i + 2;
  xml = CX.poner(xml, col(iCol) + nFila, CX.celda(col(iCol) + nFila, id, estD), nFila).xml;
  escritas++;
});
xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + col(iCol) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('     celdas escritas: ' + escritas);

var res = safeSave(SECO, SECO);
console.log('     safe-save: ' + (res.validado || '?'));
[['xlsx-label.js'], ['xlsx-check.js'], ['xlsx-orden-celdas.js']].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h[0] + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
console.log('     5 capas: OK');

// releer y comprobar que no se perdió ninguna columna
var wb2 = XLSX.readFile(SECO);
var E2 = XLSX.utils.sheet_to_json(wb2.Sheets['Data_Email'], { defval: '', blankrows: false });
var c2 = Object.keys(E2[0]);
console.log('\n  ── releído: ' + E2.length + ' filas · ' + c2.length + ' columnas (antes ' + cols.length + ')');
console.log('     con pieza_id: ' + E2.filter(function (x) { return t(x['pieza_id']); }).length + '/' + E2.length);
var perdidas = cols.filter(function (c) { return c2.indexOf(c) < 0; });
console.log('     columnas perdidas: ' + (perdidas.length ? '🔴 ' + perdidas.join(' · ') : 'ninguna ✔'));
if (perdidas.length) process.exit(1);

var antes = fs.statSync(vivo.ruta).mtimeMs;
fs.copyFileSync(SECO, vivo.ruta);
if (fs.statSync(vivo.ruta).mtimeMs <= antes) { console.log('  🔴 la copia no quedó'); process.exit(1); }
console.log('\n  ✅ Data_Email anclada y publicada');
