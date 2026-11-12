// FB6-fechas-y-codigos.js — B5(fechas) + H2b: alinear las fechas del catálogo con SFMC, y con
// eso poder reasignar los códigos de Qcart a la pieza que de verdad los activó.
//
// 🔴 POR QUÉ VAN JUNTOS, Y EN ESTE ORDEN. La reasignación de códigos falló dos veces porque usaba
//    «la fecha de envío que SFMC reporta para esa pieza» — y SFMC **no tiene envío propio para
//    `001-P005`**: su `Content_Name` está duplicado con `001-P025` en el `CRM_Reporte_Config`, que
//    es de donde nace la DE. Corregir el catálogo del Excel no arregla eso, porque el defecto vive
//    en SFMC.
//    El criterio que SÍ aguanta: **la QUINCENA de la pieza**. Un código activado el 13-mar
//    pertenece a la pieza de la oleada de marzo; uno activado el 30-abr, a la de abril. Eso no
//    depende de que SFMC sepa distinguirlas — depende de que el catálogo tenga bien sus fechas.
//    Por eso primero se corrigen las fechas, y después se reasignan los códigos.
//
// 🔴 SFMC MANDA en fechas de activación (decisión de Rick).
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
function iso(s) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t(s)); return m ? m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : ''; }
function quinDe(i) { var d = new Date(i + 'T00:00:00Z'); return i.slice(0, 7) + '-Q' + (d.getUTCDate() <= 15 ? 1 : 2); }

console.log('════════ B5 + H2b · FECHAS Y CÓDIGOS ' + (ESCRIBIR ? '(ESCRIBE)' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_fb6.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS = Object.keys(P[0]); var idx = {}; COLS.forEach(function (c, i) { idx[c] = i; });
var cambios = [];
function set(f, c, v, m) {
  if (idx[c] === undefined) return;
  if (t(P[f][c]) === t(v)) return;
  cambios.push({ fila: f + 2, pieza: t(P[f]['Pieza_ID']), col: c, de: t(P[f][c]), a: t(v), motivo: m });
  P[f][c] = v;
}

// ── 1 · las fechas, de SFMC ────────────────────────────────────────────────────────────────
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-email-detalle.json', 'utf8'));
var envio = {};
D.rows.forEach(function (r) {
  var k = t(r.ConfigKey), f = iso(r.SendDay); if (!k || !f) return;
  if (!envio[k] || f < envio[k]) envio[k] = f;
});
// 🔴 el par cruzado: SFMC no distingue P005 de P025 porque comparten ContentName en su config.
//    El documento de correcciones SÍ los distingue —fue hecho auditando `_Sent`/`_Job` directo—
//    así que para ESAS piezas manda el documento, y queda declarado de dónde salió cada fecha.
var DEL_DOC = {
  '001-P001': '2026-03-14', '001-P002': '2026-03-17', '001-P003': '2026-03-14', '001-P004': '2026-03-17',
  '001-P005': '2026-03-14', '001-P006': '2026-03-17',
  '001-P023': '2026-04-30', '001-P024': '2026-04-30', '001-P025': '2026-04-30',
  '001-P026': '2026-05-03', '001-P027': '2026-05-03', '001-P028': '2026-05-03'
};
var corr = 0;
P.forEach(function (p, i) {
  var id = t(p['Pieza_ID']);
  var f = DEL_DOC[id] || envio[id]; if (!f) return;
  var via = DEL_DOC[id] ? 'CATALOGO-CORRECCIONES.md (SFMC no distingue el par)' : 'SFMC · min(SendDay)';
  var q = quinDe(f);
  if (t(p['Quincena_Lanzamiento']) !== q || t(p['Fecha_Primer_Envio']) !== f) corr++;
  set(i, 'Fecha_Primer_Envio', f, via);
  set(i, 'Quincena_Lanzamiento', q, via);
  set(i, 'Mes_Lanzamiento', f.slice(0, 7), via);
  set(i, 'Fecha_Origen', via, 'declarar la procedencia de la fecha');
});
console.log('  ── 1 · fechas alineadas: ' + corr + ' piezas cambiaron');
cambios.filter(function (c) { return /Quincena/.test(c.col); }).slice(0, 14).forEach(function (c) {
  console.log('     ' + c.pieza + '  ' + (c.de || '(vacía)').padEnd(12) + ' → ' + c.a + '   ' + c.motivo.slice(0, 42));
});

// ── 2 · los códigos de Qcart, a la pieza que los activó ────────────────────────────────────
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var codigo = {};
Q.carritos.concat(Q.productos).forEach(function (c) {
  var k = t(c.shortlink_code); if (!k) return;
  codigo[k] = codigo[k] || { act: t(c.activacion_link), hoy: t(c.pieza_id), n: 0 };
  codigo[k].n++;
});
var cat = {}; P.forEach(function (p) { if (t(p['Pieza_ID'])) cat[t(p['Pieza_ID'])] = p; });
var mover = [], ambiguos = [];
// 🔴 LO DECLARADO GANA A LO INFERIDO. Si la pieza que hoy tiene el código lo lleva escrito en sus
//    columnas `Cod_Walmart_N` / `Cod_Chedraui_N`, entonces alguien ya decidió que es suyo y no se
//    toca. Sin esta guarda, el algoritmo movía `2YWR8c3Z` y `haPs2HHU` de Semifinal B a Semifinal A
//    solo porque las dos caen en la misma quincena — y esos códigos son literalmente los que
//    identifican a Semifinal B en la fuente. Inferir por fecha sirve para lo que NADIE declaró.
function declaraCodigo(p, k) {
  for (var i = 1; i <= 4; i++) {
    if (t(p['Cod_Walmart_' + i]).indexOf(k) >= 0) return true;
    if (t(p['Cod_Chedraui_' + i]).indexOf(k) >= 0) return true;
  }
  return false;
}
var respetados = [];
Object.keys(codigo).forEach(function (k) {
  var c = codigo[k], pHoy = cat[c.hoy]; if (!pHoy || !c.act) return;
  if (declaraCodigo(pHoy, k)) { respetados.push(k + '→' + c.hoy); return; }
  var qAct = quinDe(c.act);
  // candidatas: MISMA campaña, MISMO segmento, MISMO tipo — solo cambia la oleada
  var cands = P.filter(function (p) {
    return t(p['Campaña']) === t(pHoy['Campaña']) && t(p['Segmento']) === t(pHoy['Segmento']) &&
      t(p['Email_Type']) === t(pHoy['Email_Type']) && t(p['Quincena_Lanzamiento']);
  });
  if (cands.length < 2) return;                       // no hay dos oleadas: nada que decidir
  var exacta = cands.filter(function (p) { return t(p['Quincena_Lanzamiento']) === qAct; });
  if (exacta.length === 1) {
    if (t(exacta[0]['Pieza_ID']) !== c.hoy) mover.push({ codigo: k, de: c.hoy, a: t(exacta[0]['Pieza_ID']), act: c.act, quincena: qAct, eventos: c.n });
    return;
  }
  // sin coincidencia exacta: la pieza cuya quincena es la MAYOR que no pasa de la activación
  var previas = cands.filter(function (p) { return t(p['Quincena_Lanzamiento']) <= qAct; })
    .sort(function (a, b) { return t(b['Quincena_Lanzamiento']).localeCompare(t(a['Quincena_Lanzamiento'])); });
  if (previas.length && t(previas[0]['Pieza_ID']) !== c.hoy) {
    mover.push({ codigo: k, de: c.hoy, a: t(previas[0]['Pieza_ID']), act: c.act, quincena: qAct, eventos: c.n, nota: 'la quincena anterior más cercana' });
  } else if (!previas.length) {
    ambiguos.push(k + ' (activación ' + c.act + ', ninguna oleada anterior)');
  }
});
console.log('\n  ── 2 · códigos de Qcart a reasignar: ' + mover.length);
mover.forEach(function (m) {
  console.log('     ' + m.codigo.padEnd(10) + String(m.eventos).padStart(4) + ' eventos  ' + m.de + ' → ' + m.a +
    '   activación ' + m.act + ' = ' + m.quincena + (m.nota ? '  (' + m.nota + ')' : ''));
});
if (ambiguos.length) { console.log('     ⚠ sin resolver: ' + ambiguos.join(' · ')); }

fs.writeFileSync(BACK + '/_catalogo/fechas-y-codigos.json', JSON.stringify({ paso: 'B5+H2b', cambios: cambios, mover: mover, ambiguos: ambiguos, respetados_por_declaracion: respetados }, null, 1));
console.log('\n  total de cambios al catálogo: ' + cambios.length);
if (!ESCRIBIR) { console.log('\n  seco. Para escribir: node FB6-fechas-y-codigos.js --escribir'); process.exit(0); }

// ── escribir las fechas ────────────────────────────────────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = rmap[rid]; return _; });
var xml = zip.readAsText(parte);
cambios.forEach(function (c) {
  var i = idx[c.col];
  xml = CX.poner(xml, col(i) + c.fila, CX.celda(col(i) + c.fila, c.a, CX.estiloDe(xml, col(i) + '2')), c.fila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
safeSave(SECO, SECO);
['xlsx-label.js', 'xlsx-check.js', 'xlsx-orden-celdas.js'].forEach(function (h) {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/' + h + '" "' + SECO + '"', { encoding: 'utf8', timeout: 180000 });
});
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('\n  ── releído: ' + P2.length + ' piezas · ' + Object.keys(P2[0]).length + ' columnas');
console.log('     con quincena: ' + P2.filter(function (p) { return t(p['Quincena_Lanzamiento']); }).length + '/' + P2.length);
if (P2.length !== P.length) { console.log('  🔴 cambió el nº de filas'); process.exit(1); }
fs.copyFileSync(SECO, vivo.ruta);
console.log('\n  ✅ fechas alineadas y publicadas   ·   los ' + mover.length + ' códigos quedan declarados en _catalogo/fechas-y-codigos.json');
