// FD2-escribir-whatsapp.js — H5 + D3: escribir `Data_WhatsApp` COMPLETA y alineada a la fuente.
//
// 🔴 LO QUE PIDIÓ RICK: «ya tiene los datos de qcart y todo alineados, solo es que **alinees
//    completamente en todas las filas y columnas** bien todos los datos de whatsapp».
//
// 🔴 QUÉ ESTABA MAL, MEDIDO: la hoja tenía 12 filas con **0 ancladas**, guardaba `Final` como un
//    SUBTOTAL (1,965 escrito como una fila cuando el lector lo partía en 982+983), y las campañas
//    no coincidían con la fuente («Maggi» en la hoja, «Mundial» en el catálogo).
//
// 🔴 CÓMO SE ESCRIBE AHORA: el bloque `whatsapp.json` es la única entrada, y ya trae las 5 piezas
//    de Mundial POR PARTIDO con sus utm agrupados. Cada fila de la hoja se llena por NOMBRE de
//    columna desde el envío correspondiente; las columnas que la fuente no entrega se dejan como
//    estén — no se pisan con vacío.
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
function serial(iso) { return iso ? Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000) : ''; }
var MESN = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };
function quin(i) { if (!i) return ''; var d = new Date(i + 'T00:00:00Z'); return MESN[i.slice(5, 7)] + '-Q' + (d.getUTCDate() <= 15 ? 1 : 2) + '-' + i.slice(0, 4); }
function mes(i) { return i ? ({ '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' })[i.slice(5, 7)] : ''; }
function tasa(a, b) { return b ? a / b : null; }

console.log('════════ H5+D3 · ESCRIBIR Data_WhatsApp ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fd2.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var W = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var COLS = Object.keys(W[0]);
console.log('  hoja hoy: ' + W.length + ' filas · ' + COLS.length + ' columnas');
console.log('  bloque  : ' + B.envios.length + ' envíos · Σ ' + mil(B.envios.reduce(function (a, e) { return a + num(e.sends); }, 0)) + '\n');

// ── anclar cada envío a su pieza ───────────────────────────────────────────────────────────
// El bloque ya resolvió lo que pudo. Para Mundial e ICE, la pieza se encuentra por el UTM que el
// catálogo declara — que es el mismo criterio con el que se confirmó que P017=Semifinal A.
var cat = {}; P.forEach(function (p) { if (t(p['Pieza_ID'])) cat[t(p['Pieza_ID'])] = p; });
function piezaPorUtm(utms) {
  var lista = t(utms).split(/[\s,;·|]+/).filter(Boolean);
  if (!lista.length) return null;
  var hit = P.filter(function (p) {
    var decl = t(p['EmailName']) + ' ' + [1, 2, 3, 4].map(function (i) { return t(p['Cod_Walmart_' + i]) + ' ' + t(p['Cod_Chedraui_' + i]); }).join(' ');
    return lista.some(function (u) { return decl.indexOf(u) >= 0; });
  });
  return hit.length === 1 ? t(hit[0]['Pieza_ID']) : null;
}
function piezaPorNombre(e) {
  var n = L.nmz(t(e.journey));
  if (!n) return null;
  var hit = P.filter(function (p) {
    // el journey del envio puede coincidir con el nombre del journey, el Content_ID, o el
    // ContentName completo — ICE cruza por este ultimo (`O_Nescafé-ICE-NC000817_1`).
    return /WA/i.test(t(p['Touchpoint'])) && (
      L.nmz(t(p['Nombre_Journey'])) === n || L.nmz(t(p['Content_ID'])) === n ||
      L.nmz(t(p['Content_Name'])) === n || L.nmz(t(p['EmailName'])) === n);
  });
  return hit.length === 1 ? t(hit[0]['Pieza_ID']) : null;
}
// 🔴 EL BLOQUE PUBLICA `envios` CON LOS EXCLUIDOS DENTRO. `whatsapp.json` trae 17 envíos, pero 5
//    están en `excluidos_por_solape`: son la misma medición contada en dos tablas. Quien lea
//    `envios` sin filtrar escribe 17,931 donde la fuente dice 14,643 — un 22% de más, en verde.
//    Se filtra por `hoja!fila`, que es como el bloque los identifica.
var excluido = {};
(B.excluidos_por_solape || []).forEach(function (e) { excluido[e.hoja + '!' + e.fila_en_hoja] = 1; });
var VIVOS = B.envios.filter(function (e) { return !excluido[e.hoja + '!' + e.fila_en_hoja]; });
console.log('  envíos vivos: ' + VIVOS.length + ' de ' + B.envios.length +
  '   (' + Object.keys(excluido).length + ' excluidos por solape)   Σ ' +
  mil(VIVOS.reduce(function (a, e) { return a + num(e.sends); }, 0)) + '\n');

var filas = VIVOS.map(function (e) {
  var pid = t(e.pieza_id) || piezaPorUtm(e.utm_content) || piezaPorNombre(e) || '';
  return { e: e, pid: pid, p: cat[pid] || null };
});
var anclados = filas.filter(function (f) { return f.pid; }).length;
console.log('  ── anclaje');
filas.forEach(function (f) {
  console.log('     ' + (f.pid || '(sin pieza)').padEnd(11) + t(f.e.journey || f.e.campana_raw).padEnd(20).slice(0, 20) +
    String(num(f.e.sends)).padStart(6) + '  ' + (f.p ? t(f.p['Campaña']) + ' · ' + t(f.p['Touchpoint']) : '🔴 no cruza'));
});
console.log('     → ' + anclados + '/' + filas.length + ' anclados');

// ── el mapeo columna → valor, declarado ────────────────────────────────────────────────────
function valorDe(nom, f) {
  var e = f.e, p = f.p || {};
  var fecha = t(e.fecha);
  var M = {
    'BU': t(p['BU']) || t(e.bu_canonico) || t(e.bu),
    'Marca': t(p['Marca']) || t(e.marca_canonica) || t(e.marca),
    'Campaña': t(p['Campaña']) || t(e.campana_canonica) || t(e.campana_raw),
    'Campana_Raw': t(e.campana_raw),
    'Objetivo': t(p['Objetivo']) || t(e.objetivo),
    'Segmento_Canonico': t(p['Segmento']) || t(e.segmento_canonico),
    'Segmento_WA_Raw': t(e.segmento_raw).replace(/[\r\n]+/g, ', '),
    'Canal': 'WhatsApp',
    'Touchpoint': t(p['Touchpoint']) || t(e.touchpoint_raw),
    'Send_Date': serial(fecha),
    'Send_Month': mes(fecha), 'Send_Quincena': quin(fecha),
    'Sends': num(e.sends), 'Deliveries': num(e.deliveries),
    'Opens_Read': num(e.opens_read),
    // 🔴 el CLICK de WhatsApp no siempre está medido: en algunas campañas la fuente lo DERIVA de
    //    `Read × un CTOR asumido`. Un supuesto no se escribe como si fuera medición.
    'Clicks': e.clicks_medidos === false ? '' : (e.clicks === null || e.clicks === undefined ? '' : num(e.clicks)),
    'Clicks_Medidos': e.clicks_medidos === false ? 'No' : (e.clicks === null || e.clicks === undefined ? 'No' : 'Sí'),
    'Errores': num(e.errores),
    'Delivery_Rate': tasa(num(e.deliveries), num(e.sends)),
    'Read_Rate': tasa(num(e.opens_read), num(e.deliveries)),
    'CTOR': e.clicks_medidos === false ? '' : tasa(num(e.clicks), num(e.opens_read)),
    'Aud_Original': num(e.aud_original) || '', 'Aud_Filtros': num(e.aud_filtros) || '', 'Aud_Final': num(e.aud_final) || '',
    'utm_content': t(e.utm_content).replace(/[\r\n]+/g, ', '),
    'URL': t(e.url).replace(/[\r\n]+/g, ' '),
    'pieza_id': f.pid
  };
  return M[nom];
}
var sinMapear = COLS.filter(function (c) { return valorDe(c, filas[0]) === undefined; });
console.log('\n  ── mapeo: ' + (COLS.length - sinMapear.length) + '/' + COLS.length + ' columnas');
if (sinMapear.length) console.log('     no las llena el sistema (se dejan como estén): ' + sinMapear.join(' · '));

var sumaB = filas.reduce(function (a, f) { return a + num(f.e.sends); }, 0);
console.log('\n  Σ Sends que se va a escribir: ' + mil(sumaB) + '   (hoja hoy: ' + mil(W.reduce(function (a, x) { return a + num(x['Sends']); }, 0)) + ')');
if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FD2-escribir-whatsapp.js --escribir'); process.exit(0); }

// ── escribir: se reconstruyen las filas de datos ───────────────────────────────────────────
// La hoja es una PROYECCIÓN de la fuente: no hay nada escrito a mano ahí (a diferencia del
// Report_Resumen). Se reescriben las filas y se conserva el encabezado tal cual.
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Data_WhatsApp') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
var estilo = {}; COLS.forEach(function (c, i) { estilo[i] = CX.estiloDe(xml, col(i) + '2'); });
var nuevas = filas.map(function (f, k) {
  var nF = k + 2;
  var celdas = COLS.map(function (nom, i) {
    var v = valorDe(nom, f);
    if (v === undefined || v === null || v === '') return '';
    return CX.celda(col(i) + nF, v, estilo[i]);
  }).filter(Boolean).join('');
  return '<row r="' + nF + '">' + celdas + '</row>';
}).join('');
xml = xml.replace(/<row r="(\d+)"(?![^>]*\/>)[^>]*>[\s\S]*?<\/row>|<row r="(\d+)"[^>]*\/>/g, function (todo, a, b) {
  return (+(a || b)) >= 2 ? '' : todo;
});
xml = xml.replace('</sheetData>', nuevas + '</sheetData>');
xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + (filas.length + 1) + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var W2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var s2 = W2.reduce(function (a, x) { return a + num(x['Sends']); }, 0);
console.log('\n  ── releído: ' + W2.length + ' filas · ' + Object.keys(W2[0]).length + ' columnas');
console.log('     Σ Sends: ' + mil(s2) + (s2 === sumaB ? '  ✔ igual al bloque' : '  🔴 NO cuadra con el bloque (' + mil(sumaB) + ')'));
console.log('     con pieza_id: ' + W2.filter(function (x) { return t(x['pieza_id']); }).length + '/' + W2.length);
if (s2 !== sumaB) { console.log('\n  🔴 no se publica: la suma no cuadra'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ Data_WhatsApp escrita y publicada');
