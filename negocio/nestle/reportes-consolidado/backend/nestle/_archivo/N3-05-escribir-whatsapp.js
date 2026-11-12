// PUERTA 1 · Data_WhatsApp — de 6 a 26 filas.
//
// 🔴 Las 6 que ya están NO se borran ni se reescriben: se conservan tal cual y se AGREGAN las
//    20 que faltan. El diff previo probó que las 6 están todas en el bloque, así que agregar es
//    suficiente; reescribirlas sería tocar sin motivo.
//
// ⚠ Las 4 columnas calculadas de la hoja (Delivery_Rate, Read_Rate, CTOR, Pct_Error) se dejan
//    VACÍAS en las filas nuevas: son de N5. Y `Clicks` se deja vacío donde el bloque dice que el
//    click no está medido — rellenarlo con el derivado sería meter un supuesto como medición.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var W = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-whatsapp.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = W.t;
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function serial(iso) {
  if (!iso) return null;
  var d = new Date(iso + 'T00:00:00Z');
  return Math.round((d - Date.UTC(1899, 11, 30)) / 86400000);
}

console.log('════════ PUERTA 1 · Data_WhatsApp ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_wahoja.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));

// lo que ya está en la hoja, por su llave de negocio
var wb = XLSX.readFile(SECO);
var shE = wb.Sheets['Data_WhatsApp'];
var r = XLSX.utils.decode_range(shE['!ref']);
var cols = [];
for (var c = r.s.c; c <= r.e.c; c++) { var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })]; cols.push(h ? t(h.v) : ''); }
var yaEstan = XLSX.utils.sheet_to_json(shE, { defval: '' }).filter(function (x) { return t(x['BU']); });
console.log('  la hoja tiene ' + yaEstan.length + ' filas · ' + cols.length + ' columnas');

// ¿cuáles del bloque NO están? se comparan por sends + campaña, que es lo que las identifica
// 🔴 LA LLAVE NO PUEDE USAR EL SEGMENTO. La hoja guarda `Segmento_Canonico` («Futboleros,
//    Amazon…») y el bloque trae `segmento_raw` (vacío en Tercer Tiempo, porque su hoja no lo
//    tiene). Comparando por segmento, las 2 filas de Tercer Tiempo parecían faltar y se
//    escribían OTRA VEZ: Σ 22,022 en vez de 16,209, justo los 5,813 duplicados.
//    `campaña + sends` basta y sobra: dentro de una campaña, la cifra identifica el envío.
var enHoja = {};
yaEstan.forEach(function (x) {
  var s = Number(String(x['Sends']).replace(/[, ]/g, '')) || 0;
  enHoja[t(x['Campaña']).toLowerCase() + '¦' + s] = 1;
  enHoja[t(x['Campana_Raw']).toLowerCase() + '¦' + s] = 1;      // la hoja tiene las dos columnas
});
function llaveDeEnvio(e) { return t(e.campana_raw).toLowerCase() + '¦' + (e.sends || 0); }
var faltan = B.envios.filter(function (e) { return !enHoja[llaveDeEnvio(e)]; });
console.log('  del bloque faltan por escribir: ' + faltan.length);
// el cuadre, ANTES de escribir: lo que ya está + lo que falta tiene que dar el bloque entero
var yaCubiertos = B.envios.length - faltan.length;
console.log('  cuadre: ' + yaCubiertos + ' ya en la hoja + ' + faltan.length + ' por escribir = ' + B.envios.length +
  '   ' + (yaCubiertos + faltan.length === B.envios.length ? '✔' : '🔴'));

// el mapeo bloque → columnas de la hoja. Las calculadas NO están, a propósito.
function valorDe(e, columna) {
  switch (columna) {
    case 'BU': return e.bu || '';
    case 'Marca': return e.marca || '';
    case 'Campaña': return e.campana_raw || '';
    case 'Campana_Raw': return e.campana_raw || '';
    case 'Objetivo': return e.objetivo || '';
    case 'Segmento_WA_Raw': return e.segmento_raw || '';
    case 'Canal': return 'WhatsApp';
    case 'Send_Date': return e.fecha ? serial(e.fecha) : '';
    case 'Sends': return e.sends;
    case 'Deliveries': return e.deliveries;
    case 'Opens_Read': return e.opens_read;
    case 'Clicks': return e.clicks;              // null si no está medido → celda vacía
    case 'Clicks_Medidos': return e.clicks_medidos || '';
    case 'Errores': return e.errores;
    case 'Aud_Original': return e.aud_original;
    case 'Aud_Filtros': return e.aud_filtros;
    case 'Aud_Final': return e.aud_final;
    case 'utm_content': return e.utm_content || '';
    case 'URL': return e.url || '';
    case 'Notas': return (e.clicks_nota ? e.clicks_nota : '') + (e.pieza_id ? '' : ' · sin pieza: ' + (e.motivo_sin_pieza || ''));
    default: return '';                           // las 4 calculadas y las que llena el catálogo
  }
}

// se agregan las filas al XML de la hoja, sin tocar las que ya están
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Data_WhatsApp') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
var xml = zip.readAsText(parte);
var ultima = 0;
xml.replace(/<row r="(\d+)"/g, function (_, n) { ultima = Math.max(ultima, +n); return _; });
console.log('  última fila con datos: ' + ultima + '   → las nuevas empiezan en la ' + (ultima + 1));

var filasXml = faltan.map(function (e, k) {
  var fila = ultima + 1 + k;
  var celdas = cols.map(function (nom, i) {
    if (!nom) return '';
    var v = valorDe(e, nom);
    if (v === null || v === undefined || v === '') return '';
    var ref = col(i) + fila;
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
    return '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
  }).filter(Boolean).join('');
  return '<row r="' + fila + '">' + celdas + '</row>';
}).join('');

if (xml.indexOf('</sheetData>') < 0) { console.log('  🔴 no encontré </sheetData>'); process.exit(1); }
xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
// el rango de la hoja tiene que crecer
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + (ultima + faltan.length) + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));

// releer
var wb2 = XLSX.readFile(SECO);
var F = XLSX.utils.sheet_to_json(wb2.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['BU']); });
console.log('\n  ── releído: ' + F.length + ' filas   Σ sends ' +
  F.reduce(function (a, x) { return a + (Number(String(x['Sends']).replace(/[, ]/g, '')) || 0); }, 0).toLocaleString('es-MX'));
var sinClick = F.filter(function (x) { return t(x['Clicks_Medidos']) === 'No'; });
console.log('     con Clicks_Medidos = No: ' + sinClick.length + '   y su celda Clicks: ' +
  (sinClick.every(function (x) { return t(x['Clicks']) === ''; }) ? '✔ VACÍA (no se metió el supuesto)' : '🔴 tiene número'));
var calc = ['Delivery_Rate', 'Read_Rate', 'CTOR', 'Pct_Error'];
var nuevas = F.slice(yaEstan.length);
console.log('     las 4 calculadas en las filas nuevas: ' +
  (nuevas.every(function (x) { return calc.every(function (k) { return t(x[k]) === ''; }); }) ? '✔ vacías (son de N5)' : '🔴 alguna trae valor'));
console.log('\n  archivo listo en: ' + SECO);
