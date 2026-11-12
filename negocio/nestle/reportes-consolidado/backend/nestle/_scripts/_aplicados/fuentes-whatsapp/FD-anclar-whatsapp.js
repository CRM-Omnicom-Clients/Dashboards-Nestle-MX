// FD-anclar-whatsapp.js — D2: anclar `Data_WhatsApp` a su `pieza_id`.
//
// 🔴 EL DIAGNÓSTICO (D1), MEDIDO — no supuesto:
//    · El LECTOR funcionó: 13 envíos, Σ 14,643, y detectó los solapes.
//    · La HOJA tiene 12 filas porque una (`Final`, 1,965) es la SUMA de dos envíos del bloque
//      (982 + 983). Se escribió el subtotal en vez de los dos desagregados.
//    · El ANCLAJE nunca se escribió: 0 de 12 filas tenían `pieza_id`.
//    Σ coincide, así que NO falta volumen: falta desagregar y anclar.
//
// 🔴 LO QUE SÍ SE PUEDE ANCLAR Y LO QUE NO — y por qué no se fuerza.
//    Hotcakes (4) y Tercer Tiempo (2) anclan sin ambigüedad: campaña + segmento + volumen exacto.
//    Mundial e ICE NO, y la razón es de MODELO, no de datos: el catálogo tiene las piezas WA de
//    Mundial **por segmento** (WA-P2 Botana · WA-P2 Bebidas · WA-P2 Modern Cooking), pero el
//    envío real salió **uno solo para todos los segmentos** (Rick lo escribió en el reporte como
//    `Wa-opt-in-allsegments`). Un envío contra tres piezas no se reparte adivinando: eso es
//    inventar atribución. Se declara y se le pasa la decisión a Rick.
//
// USO:  node FD-anclar-whatsapp.js [--escribir]
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
var num = function (v) { return Number(String(v).replace(/[, ]/g, '')) || 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ D2 · ANCLAR Data_WhatsApp ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fd.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var W = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));

// ── el bloque ya resolvió la atribución. Se REUSA, no se recalcula ─────────────────────────
// El bloque aplicó la escalera de alias y dejó `pieza_id` + `via_atribucion` en cada envío.
// Volver a resolver aquí sería una segunda opinión que puede contradecir a la primera.
var porVolumen = {};
B.envios.forEach(function (e) {
  if (e.pieza_id) porVolumen[num(e.sends)] = { id: e.pieza_id, via: e.via_atribucion, campana: e.campana_raw };
});

// las piezas WA del catálogo, para poder explicar por qué algo no ancla
var waCat = P.filter(function (p) { return /WA/i.test(t(p['Touchpoint'])); });
var porCampanaTP = {};
waCat.forEach(function (p) {
  var k = L.nmz(t(p['Campaña']));
  (porCampanaTP[k] = porCampanaTP[k] || []).push(p);
});

var resuelto = [], sinAncla = [];
W.forEach(function (x, i) {
  var s = num(x['Sends']);
  var hit = porVolumen[s];
  if (hit) { resuelto.push(hit.id); return; }
  resuelto.push('');
  var camp = t(x['Campaña']) || t(x['Campana_Raw']);
  var cands = porCampanaTP[L.nmz(camp)] || [];
  sinAncla.push({
    fila: i + 2, campana: camp, tp: t(x['Touchpoint']), sends: s,
    candidatas: cands.length,
    motivo: cands.length === 0
      ? 'el catálogo no tiene ninguna pieza de WhatsApp de esa campaña'
      : 'el catálogo tiene ' + cands.length + ' piezas WA de ' + camp + ' separadas POR SEGMENTO, y este envío salió a TODOS los segmentos juntos: repartirlo sería inventar la atribución'
  });
});
var con = resuelto.filter(Boolean).length;
var sendsSin = sinAncla.reduce(function (a, s) { return a + s.sends; }, 0);
var sendsTot = W.reduce(function (a, x) { return a + num(x['Sends']); }, 0);

console.log('  ── resultado');
console.log('     filas de la hoja : ' + W.length);
console.log('     ancladas         : ' + con + '  (' + Math.round(con / W.length * 100) + '%)');
console.log('     sin ancla        : ' + sinAncla.length + '  (' + mil(sendsSin) + ' de ' + mil(sendsTot) + ' envíos)');
console.log('\n  ── las que NO anclan, con su motivo');
sinAncla.forEach(function (s) {
  console.log('     fila ' + String(s.fila).padStart(3) + '  ' + s.campana.padEnd(10) + s.tp.padEnd(13) + mil(s.sends).padStart(6) + '  ' + s.motivo);
});

console.log('\n  ── 🔴 DECISIÓN QUE NECESITA RICK');
console.log('     El catálogo modela las piezas WA de Mundial POR SEGMENTO (WA-P2 Botana, WA-P2 Bebidas,');
console.log('     WA-P2 Modern Cooking…), pero el envío real salió UNO para todos los segmentos.');
console.log('     Además esas 10 piezas están con sends=0 y sin quincena.');
console.log('     Opción A: crear UNA pieza WA por partido con segmento «Wa-opt-in-allsegments»');
console.log('               (que es como Rick ya lo escribió en el reporte) y retirar las de por-segmento.');
console.log('     Opción B: conservar las de por-segmento y declarar el envío como no atribuible a una sola.');
console.log('     Y falta dar de alta la pieza WA de ICE.');
console.log('     ⚠ Mientras no se decida, esos ' + mil(sendsSin) + ' envíos quedan en la hoja pero sin ancla al catálogo.');

// ── el otro hallazgo: la fila consolidada ──────────────────────────────────────────────────
var enBloque = {}; B.envios.forEach(function (e) { enBloque[num(e.sends)] = 1; });
var consolidadas = W.filter(function (x) { return !enBloque[num(x['Sends'])]; });
if (consolidadas.length) {
  console.log('\n  ── ⚠ filas de la hoja que NO existen como envío en la fuente (son sumas)');
  consolidadas.forEach(function (x) {
    console.log('     ' + t(x['Campaña']) + ' · ' + t(x['Touchpoint']) + ' · ' + mil(num(x['Sends'])) +
      '  ← en la fuente son DOS envíos separados. La hoja guarda el subtotal.');
  });
}

fs.writeFileSync(BACK + '/_fuentes/anclaje-whatsapp.json', JSON.stringify({
  paso: 'D2', filas: W.length, ancladas: con, sin_ancla: sinAncla,
  consolidadas: consolidadas.map(function (x) { return { campana: t(x['Campaña']), tp: t(x['Touchpoint']), sends: num(x['Sends']) }; }),
  decision_pendiente: 'modelo de piezas WA de Mundial: por segmento vs allsegments; y alta de ICE'
}, null, 1));

if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FD-anclar-whatsapp.js --escribir'); process.exit(0); }

// ── escribir la columna ────────────────────────────────────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Data_WhatsApp') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var cols = Object.keys(W[0]);
var ya = cols.filter(function (c) { return /^pieza[_ ]?id$/i.test(c); })[0];
var iCol = ya ? cols.indexOf(ya) : cols.length;
var estH = CX.estiloDe(xml, 'A1'), estD = CX.estiloDe(xml, 'A2');
xml = CX.poner(xml, col(iCol) + '1', CX.celda(col(iCol) + '1', 'pieza_id', estH), 1).xml;
var esc = 0;
resuelto.forEach(function (id, i) {
  if (!id) return;
  var nF = i + 2;
  xml = CX.poner(xml, col(iCol) + nF, CX.celda(col(iCol) + nF, id, estD), nF).xml; esc++;
});
xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + col(iCol) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── escritura: columna ' + col(iCol) + ' · ' + esc + ' celdas');
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var W2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var perdidas = cols.filter(function (c) { return Object.keys(W2[0]).indexOf(c) < 0; });
console.log('     releído: ' + W2.length + ' filas · ' + Object.keys(W2[0]).length + ' cols (antes ' + cols.length + ') · con pieza_id: ' +
  W2.filter(function (x) { return t(x['pieza_id']); }).length + '   columnas perdidas: ' + (perdidas.length ? '🔴 ' + perdidas.join(' · ') : 'ninguna ✔'));
if (perdidas.length) process.exit(1);
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ Data_WhatsApp anclada (lo inequívoco) y publicada');
