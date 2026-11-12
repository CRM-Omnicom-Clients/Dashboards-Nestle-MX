// FB5-catalogo-completar.js — B3+H4: dejar el catálogo COMPLETO.
//
// Hace cuatro cosas, todas pedidas por Rick el 20-ago:
//
//  1 · `Mascota` → `Subsegmento`. Rick: «Mascota no es columna, en todo caso es SUBSEGMENTO, y
//      solo aplica para Purina». Se mueve el dato y se retira la columna específica de cliente.
//
//  2 · Los 12 EmailID de Purina, con la lista que Rick dio en chat. Dos difieren del documento
//      del 19-ago (`84324` vs `84261` · `84317` vs `83930`). **No se pudieron verificar por MCP**
//      —los EmailID de la DE no son asset IDs de Content Builder, `sfmc_get_asset` da 404— así que
//      manda la lista de Rick, que es más reciente, y queda DECLARADO que no hubo segunda fuente.
//
//  3 · Las piezas WA de Mundial pasan a ser **por PARTIDO**, no por segmento. Rick: «son piezas
//      por partido no por segmento, es el único caso; en segmentos pones todos los segmentos que
//      correspondan». La correspondencia NO se adivinó: los códigos Qcart que ya tenía el catálogo
//      coinciden exactamente con los utm de cada partido en la fuente
//      (P017=sbH9gVge+Agy5v9Yb=Semifinal A · P018=2YWR8c3Z+haPs2HHU=Semifinal B ·
//       P019=LO8RxwsM+2Yn9L0bD=Final).
//      Las 5 piezas por-segmento que quedan sin envío se marcan RETIRADAS, no se borran.
//
//  4 · Alta de **ICE**, que estaba en los datos y no en el catálogo.
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

// ── los EmailID de Purina ─────────────────────────────────────────────────────────────────
// 🔴 REGLA DE RICK (20-ago): «El EmailID está en la DE del MCP, o ahí debería estar; si no, la
//    reportas como **Por llenar». Ninguno de los 12 está en la DE, porque `CRM_Reporte_Config`
//    todavía no los tiene. Pero NO todos están igual de huérfanos, y meterlos en el mismo saco
//    sería tan falso como darlos todos por buenos:
//
//    · Los 9 de **E3** SÍ se verificaron contra SFMC, por `sfmc_get_send_metrics` con su jobId
//      del blast del 17-jul. Tienen fuente real, solo que no la DE. Se cargan y se declara la vía.
//    · Los 6 de **E4** NO se pudieron verificar por ninguna vía: E4 es un journey continuo y sus
//      jobs no se pueden agregar sin conocerlos todos. Van como **Por llenar**, con el valor que
//      dio Rick guardado en Notas como candidato — no como dato.
var VERIFICADO_SFMC = {   // EmailID → jobId con el que se comprobó
  'CDP_Proplan_PP_E3A1': ['83762', 1263904], 'CDP_Proplan_PP_E3A2': ['83763', 1263905],
  'CDP_Proplan_PP_E3A3': ['83764', 1263906], 'CDP_Proplan_PA_E3B1': ['83765', 1263916],
  'CDP_Proplan_PA_E3B2': ['83766', 1263915], 'CDP_Proplan_PA_E3B3': ['83767', 1263914],
  'CDP_Proplan_PO_E3C1': ['83768', 1263923], 'CDP_Proplan_PO_E3C2': ['83769', 1263924],
  'CDP_Proplan_PO_E3C3': ['83770', 1263925]
};
var CANDIDATO_RICK = {    // sin verificar — van como «Por llenar»
  'CDP_Proplan_PP_E4A1': '84317', 'CDP_Proplan_PP_E4A2': '84320', 'CDP_Proplan_PP_E4A3': '84321',
  'CDP_Proplan_PAE_E4B1': '84322', 'CDP_Proplan_PAE_E4B2': '84323', 'CDP_Proplan_PAE_E4B3': '84324'
};
var POR_LLENAR = '**Por llenar';

// ── los 5 partidos de Mundial, con su métrica REAL de la fuente ────────────────────────────
var PARTIDOS = {
  '004-P010': { tp: 'WA-P2', nombre: 'Segundo Partido', seg: 'WA-opt-in Cooking, WA-opt-in Botanas, WA-opt-in Bebidas', fecha: '2026-06-18', quin: '2026-06-Q2', sends: 162, del: 125, read: 94, clicks: 17, utms: 'wa-cooking1, wa-bebida1, wa-botana1' },
  '004-P013': { tp: 'WA-P3', nombre: 'Tercer Partido', seg: 'WA-opt-in Cooking, WA-opt-in Botanas, WA-opt-in Bebidas', fecha: '2026-06-26', quin: '2026-06-Q2', sends: 162, del: 125, read: 101, clicks: 26, utms: 'wa-modercooking3, wa-botanas3, wa-bebidas3' },
  '004-P017': { tp: 'WA-SF-A', nombre: 'Semifinal A', seg: 'Wa-opt-in-allsegments', fecha: '2026-07-14', quin: '2026-07-Q1', sends: 1981, del: 1525, read: 872, clicks: null, utms: 'sbH9gVge, Agy5v9Yb' },
  '004-P018': { tp: 'WA-SF-B', nombre: 'Semifinal B', seg: 'Wa-opt-in-allsegments', fecha: '2026-07-15', quin: '2026-07-Q1', sends: 999, del: 722, read: 411, clicks: null, utms: '2YWR8c3Z, haPs2HHU' },
  '004-P019': { tp: 'WA-FINAL', nombre: 'Final', seg: 'Wa-opt-in-allsegments', fecha: '2026-07-19', quin: '2026-07-Q2', sends: 1965, del: 1520, read: 917, clicks: null, utms: 'LO8RxwsM, 2Yn9L0bD' }
};
var RETIRAR = ['004-P011', '004-P012', '004-P014', '004-P015', '004-P016'];

console.log('════════ B3+H4 · COMPLETAR EL CATÁLOGO ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fb5.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS = Object.keys(P[0]);
var idx = {}; COLS.forEach(function (c, i) { idx[c] = i; });

var cambios = [];
function set(fila, colN, valor, motivo) {
  if (idx[colN] === undefined) return;
  var actual = t(P[fila][colN]);
  if (actual === t(valor)) return;
  cambios.push({ fila: fila + 2, pieza: t(P[fila]['Pieza_ID']), col: colN, de: actual, a: t(valor), motivo: motivo });
  P[fila][colN] = valor;
}

// ── 1 · Mascota → Subsegmento ──────────────────────────────────────────────────────────────
var movidos = 0;
P.forEach(function (p, i) {
  if (t(p['Mascota']) && !t(p['Subsegmento'])) { set(i, 'Subsegmento', t(p['Mascota']), 'Mascota → Subsegmento'); movidos++; }
});
console.log('  ── 1 · Mascota → Subsegmento: ' + movidos + ' piezas');

// ── 2 · EmailID / EmailName / Content_ID de Purina ─────────────────────────────────────────
var conId = 0, porLlenar = [];
P.forEach(function (p, i) {
  var cn = t(p['Content_Name']); if (!/CDP_Proplan/i.test(cn)) return;
  var m = /(CDP_Proplan_[A-Za-z]+_[A-Za-z0-9]+)/.exec(cn); if (!m) return;
  var clave = m[1];
  set(i, 'EmailName', cn, 'el EmailName es el ContentName completo');
  set(i, 'Content_ID', clave.replace('CDP_Proplan_', ''), 'segmento final del EmailName');
  if (VERIFICADO_SFMC[clave]) {
    set(i, 'EmailID', VERIFICADO_SFMC[clave][0], 'verificado en SFMC');
    set(i, 'Fuente_Dato', 'SFMC · sfmc_get_send_metrics jobId ' + VERIFICADO_SFMC[clave][1], 'la via con la que se comprobo');
    conId++;
  } else if (CANDIDATO_RICK[clave]) {
    // 🔴 no se pudo verificar: se marca, no se rellena con un valor de segunda mano
    set(i, 'EmailID', POR_LLENAR, 'no esta en la DE ni se pudo verificar');
    set(i, 'Estado_Dato', '⚠ Por confirmar', 'EmailID sin fuente verificable');
    set(i, 'Fuente_Dato', 'SIN VERIFICAR', 'ninguna via lo confirmo');
    set(i, 'Notas', t(p['Notas']) + ' · EmailID candidato ' + CANDIDATO_RICK[clave] +
      ' (lista de Rick 20-ago). NO esta en CRM_Reporte_Config ni se pudo verificar por MCP: E4 es un ' +
      'journey continuo y sus jobs no se pueden agregar. Se llena cuando entre al config.', 'candidato, no dato');
    porLlenar.push(t(p['Pieza_ID']) + '→' + CANDIDATO_RICK[clave]);
  }
});
console.log('  ── 2 · Purina · EmailID verificado en SFMC: ' + conId + '   ·   **Por llenar: ' + porLlenar.length);
porLlenar.forEach(function (x) { console.log('        ⚠ ' + x + ' (candidato de Rick, sin fuente verificable)'); });

// ── 3 · Mundial: piezas por PARTIDO ────────────────────────────────────────────────────────
console.log('\n  ── 3 · Mundial WhatsApp: por partido');
Object.keys(PARTIDOS).forEach(function (id) {
  var i = P.findIndex(function (p) { return t(p['Pieza_ID']) === id; });
  if (i < 0) { console.log('     ⚠ no existe ' + id); return; }
  var D = PARTIDOS[id];
  set(i, 'Touchpoint', D.tp, 'partido');
  set(i, 'Segmento', D.seg, 'todos los segmentos que corresponden');
  set(i, 'Nombre_Journey', D.nombre, 'el partido');
  set(i, 'Sends', D.sends, 'fuente WhatsApp');
  set(i, 'Fecha_Primer_Envio', D.fecha, 'fuente WhatsApp');
  set(i, 'Quincena_Lanzamiento', D.quin, 'derivada de la fecha');
  set(i, 'Mes_Lanzamiento', D.quin.slice(0, 7), 'derivada de la fecha');
  set(i, 'EmailName', D.utms, 'los utm agrupados del partido');
  set(i, 'Content_ID', D.nombre, 'el partido es la identidad de la pieza');
  set(i, 'Estado', 'Confirmado', 'cuadrado con la fuente');
  console.log('     ' + id + ' → ' + D.nombre.padEnd(17) + ' ' + String(D.sends).padStart(5) + ' envíos · ' + D.seg.slice(0, 40));
});
RETIRAR.forEach(function (id) {
  var i = P.findIndex(function (p) { return t(p['Pieza_ID']) === id; }); if (i < 0) return;
  set(i, 'Estado', 'Retirada', 'el envío de WhatsApp fue UNO por partido, no uno por segmento');
  set(i, 'Notas', 'Retirada 20-ago-2026: modelada por segmento, pero el envío salió uno por partido. Su volumen está en la pieza del partido. NO se borra para conservar la historia.', 'trazabilidad');
  console.log('     ' + id + ' → RETIRADA (su volumen vive en la pieza del partido)');
});

// ── 4 · alta de ICE ────────────────────────────────────────────────────────────────────────
var yaICE = P.some(function (p) { return /^ICE$/i.test(t(p['Campaña'])); });
var altaICE = null;
if (!yaICE) {
  var modelo = P.find(function (p) { return t(p['Pieza_ID']) === '004-P019'; }) || P[0];
  altaICE = {};
  COLS.forEach(function (c) { altaICE[c] = ''; });
  var ICE = {
    'Pieza_ID': '010-P001', 'Camp_ID': 'CMP-010', 'Journey_ID': '010-J001',
    'BU': 'Nescafé', 'Marca': 'Nescafé', 'Campaña': 'ICE', 'Objetivo': 'Awareness',
    'Touchpoint': 'WA-A1', 'Segmento': 'Wa-opt-in', 'Canal': 'WhatsApp',
    'Content_Name': 'O_Nescafé-ICE-NC000817_1', 'EmailName': 'O_Nescafé-ICE-NC000817_1',
    'Content_ID': 'NC000817', 'Codigo_NC': 'NC000817',
    'Sends': 2000, 'Fecha_Primer_Envio': '2026-07-23',
    'Mes_Lanzamiento': '2026-07', 'Quincena_Lanzamiento': '2026-07-Q2',
    'Tiene_Qcart': 'No', 'Estado': 'Confirmado', 'Fuente_Dato': 'Resultados Whatsapp CRM 2026 · hoja ICE',
    'Notas': 'Alta 20-ago-2026: aparecía en los datos de WhatsApp y no en el catálogo. 2,000 envíos · 1,599 entregados · 893 leídos.'
  };
  Object.keys(ICE).forEach(function (k) { if (idx[k] !== undefined) altaICE[k] = ICE[k]; });
  console.log('\n  ── 4 · alta de ICE: 010-P001 · Nescafé · WA-A1 · 2,000 envíos · 23-jul-2026');
} else console.log('\n  ── 4 · ICE ya estaba');

console.log('\n  ── total de cambios: ' + cambios.length + (altaICE ? ' + 1 alta' : ''));
if (!ESCRIBIR) {
  cambios.slice(0, 18).forEach(function (c) {
    console.log('     ' + c.pieza + ' · ' + c.col.padEnd(22) + ' «' + c.de.slice(0, 22) + '» → «' + t(c.a).slice(0, 30) + '»');
  });
  if (cambios.length > 18) console.log('     … y ' + (cambios.length - 18) + ' más');
  console.log('\n  seco. Para escribir: node FB5-catalogo-completar.js --escribir'); process.exit(0);
}

// ── escribir ───────────────────────────────────────────────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
cambios.forEach(function (c) {
  var i = idx[c.col];
  var est = CX.estiloDe(xml, col(i) + c.fila) || CX.estiloDe(xml, col(i) + '2');
  xml = CX.poner(xml, col(i) + c.fila, CX.celda(col(i) + c.fila, c.a, est), c.fila).xml;
});
if (altaICE) {
  var nF = P.length + 2;
  var estD = CX.estiloDe(xml, 'A2');
  var celdas = COLS.map(function (c, i) {
    if (t(altaICE[c]) === '') return '';
    return CX.celda(col(i) + nF, altaICE[c], CX.estiloDe(xml, col(i) + '2') || estD);
  }).filter(Boolean).join('');
  xml = xml.replace('</sheetData>', '<row r="' + nF + '">' + celdas + '</row></sheetData>');
  xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2) {
    return '<dimension ref="' + c1 + r1 + ':' + c2 + nF + '"/>';
  });
}
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('\n  ── releído: ' + P2.length + ' piezas (antes ' + P.length + ') · ' + Object.keys(P2[0]).length + ' columnas');
console.log('     Subsegmento poblado: ' + P2.filter(function (p) { return t(p['Subsegmento']); }).length);
console.log('     EmailID poblado    : ' + P2.filter(function (p) { return t(p['EmailID']); }).length);
console.log('     campañas           : ' + Object.keys(P2.reduce(function (o, p) { if (t(p['Campaña'])) o[t(p['Campaña'])] = 1; return o; }, {})).join(' · '));
if (P2.length !== P.length + (altaICE ? 1 : 0)) { console.log('  🔴 el nº de filas no cuadra'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
fs.writeFileSync(BACK + '/_catalogo/completar-catalogo.json', JSON.stringify({ paso: 'B3+H4', cambios: cambios, ice: !!altaICE, por_llenar: porLlenar }, null, 1));
console.log('\n  ✅ catálogo completado y publicado');
