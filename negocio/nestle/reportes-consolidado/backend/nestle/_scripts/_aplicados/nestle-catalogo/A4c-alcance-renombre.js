// A4c · ANTES DE RENOMBRAR: qué encabezados se llaman Content_*, y quién depende del TEXTO.
//
// 🔴 Renombrar un encabezado es barato para los scripts (el registro direcciona por id lógico) y
//    caro para el workbook si alguna fórmula busca el texto del encabezado con MATCH/HLOOKUP.
//    Este paso mide las dos cosas ANTES de tocar nada. Y de paso saca las 4 filas de Liga MX,
//    que es donde quedó el hueco de ContentName.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var F0 = os.homedir() + '/_a4c.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

console.log('════════ A4c ════════\n');
console.log('══ 1 · TODOS los encabezados que dicen Content ══\n');
var aRenombrar = [];
wb.SheetNames.forEach(function (h) {
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || [];
  enc.forEach(function (e, i) {
    if (!/content/i.test(t(e))) return;
    var nuevo = t(e).replace(/Content[_ ]?Name/i, 'Email_Name').replace(/Content[_ ]?ID/i, 'Email_ID');
    aRenombrar.push({ hoja: h, col: XLSX.utils.encode_col(i), viejo: t(e), nuevo: nuevo });
    console.log('   ' + h.padEnd(24) + XLSX.utils.encode_col(i).padEnd(4) + t(e).padEnd(28) + '→  ' + nuevo);
  });
});
console.log('\n   ' + aRenombrar.length + ' encabezado(s)');
// ¿el nuevo nombre ya existe en esa hoja? sería un choque de nombres
aRenombrar.forEach(function (r) {
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[r.hoja], { header: 1 })[0] || [];
  var yaHay = enc.filter(function (e) { return t(e) === r.nuevo; });
  if (yaHay.length) console.log('   🔴 CHOQUE · ' + r.hoja + ' ya tiene una columna «' + r.nuevo + '»');
});

console.log('\n\n══ 2 · ¿alguna fórmula busca el TEXTO del encabezado? ══');
var zip = new AdmZip(F0);
var conTexto = [];
zip.getEntries().forEach(function (en) {
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(en.entryName)) return;
  var xml = en.getData().toString('utf8');
  aRenombrar.forEach(function (r) {
    var re = new RegExp('<f[^>]*>[^<]*"' + r.viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^<]*</f>', 'g');
    var m = xml.match(re);
    if (m) conTexto.push({ parte: en.entryName, header: r.viejo, n: m.length, ej: m[0].slice(0, 120) });
  });
});
if (!conTexto.length) console.log('   ✔ ninguna fórmula cita el texto de estos encabezados — renombrar es seguro');
else conTexto.forEach(function (c) { console.log('   🔴 ' + c.parte + '  ' + c.n + '×  ' + c.ej); });

// y las tablas / rangos con nombre, que sí guardan el encabezado
console.log('\n   tablas definidas: ' + zip.getEntries().filter(function (e) { return /^xl\/tables\//.test(e.entryName); }).length);
var wbx = zip.getEntry('xl/workbook.xml');
if (wbx) {
  var dn = (wbx.getData().toString('utf8').match(/<definedName[^>]*>[\s\S]*?<\/definedName>/g) || []);
  var tocan = dn.filter(function (d) { return /content/i.test(d); });
  console.log('   nombres definidos: ' + dn.length + '   ·   que citan «Content»: ' + tocan.length);
  tocan.slice(0, 5).forEach(function (d) { console.log('      ' + d.slice(0, 130)); });
}

console.log('\n\n══ 3 · LAS 4 FILAS DE LIGA MX, tal como están ══\n');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var muestra = ['Pieza_ID', 'Campana', 'Touchpoint', 'Segmento', 'Content_Name', 'Email_ID', 'Canal', 'Fecha_Envio'];
var cols = muestra.filter(function (c) { return enc.indexOf(c) >= 0; });
console.log('   ' + cols.map(function (c) { return c.slice(0, 15).padEnd(17); }).join(''));
P.forEach(function (p, i) {
  if (!/liga\s*mx/i.test(t(p['Campana']))) return;
  console.log('   ' + cols.map(function (c) { return t(p[c]).slice(0, 15).padEnd(17); }).join('') + '  fila ' + (i + 2));
});

console.log('\n══ 4 · ¿qué trae SFMC de Liga MX? ══\n');
var D2 = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var lm = D2.rows.filter(function (r) { return /liga|ligamx|j4/i.test(t(r.Campana) + ' ' + t(r.Email_Content_Name) + ' ' + t(r.Touchpoint)); });
console.log('   ' + lm.length + ' pieza(s) en SFMC');
lm.forEach(function (r) {
  console.log('   eid ' + t(r.Email_ID).padEnd(8) + t(r.Touchpoint).padEnd(10) + t(r.Segmento).padEnd(26) +
    Number(r.Email_Sends || 0).toLocaleString('es-MX').padStart(9) + '  ' + t(r.Email_Content_Name));
});
// ...y a qué pieza del catálogo está amarrada cada una
var porCN = {};
P.forEach(function (p) { t(p['Content_Name']).split(/\s*[·|]\s*/).forEach(function (c) { if (t(c)) porCN[t(c)] = t(p['Pieza_ID']) + ' / ' + t(p['Touchpoint']) + ' / ' + t(p['Segmento']); }); });
console.log('\n   a qué pieza del catálogo cae cada una:');
lm.forEach(function (r) { console.log('      ' + t(r.Email_Content_Name).slice(-40).padEnd(42) + '→ ' + (porCN[t(r.Email_Content_Name)] || '🔴 ninguna')); });
