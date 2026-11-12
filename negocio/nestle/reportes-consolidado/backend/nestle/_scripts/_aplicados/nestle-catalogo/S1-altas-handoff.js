// S1 · LAS 22 PIEZAS DEL HANDOFF — 12 se LLENAN, 10 se dan de ALTA.
//
// 🔴 LLENAR NO ES CREAR, Y CONFUNDIRLO DUPLICA. Doce de las veintidós ya existen en el catálogo:
//    · `009-P012`…`P017` son los 6 de E4, creados como placeholders con `EmailID = **Por llenar`
//      (el marcado de I2 hizo su trabajo: se sabía exactamente qué faltaba y dónde).
//    · `009-P006`…`P011` son los 6 de E3, con su `ContentName` TRUNCADO — les falta el prefijo
//      `MX.Proplan.ATM_JB.`, por eso no emparejaban por la llave que el handoff declara.
//    Crearlas de nuevo habría dejado doce pares de gemelas y doblado ~50k envíos.
//
// 🔴 EL EMPAREJAMIENTO NO SE ADIVINA: se hace por touchpoint + persona + mascota, y se COMPRUEBA
//    contra los Sends que el handoff declara. Si un Sends no coincide, esa pieza no se toca.
//
// 🔴 LO INFERIDO ENTRA MARCADO. Las dimensiones que el handoff trae con `*` son lectura suya, no
//    dato: entran con `⚠ Por confirmar` en `Estado`. No se infiere del naming ni cuando el naming
//    es obvio — esa regla existe porque el WA «O_Welcome-NC007067» resultó ser Purchase.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var H = JSON.parse(fs.readFileSync(BACK + '/_insumos/handoff-22-piezas.json', 'utf8'));
var PORPROV = {}; H.forEach(function (x) { PORPROV[x.prov] = x; });

// ── A · las que se LLENAN: el mapeo, con el Sends que debe cuadrar como prueba
var LLENAR = [
  { pieza: '009-P012', prov: '009-TMP-PP-E4-P', sends: 3411 },
  { pieza: '009-P013', prov: '009-TMP-PP-E4-G', sends: 703 },
  { pieza: '009-P014', prov: '009-TMP-PP-E4-M', sends: 39 },
  { pieza: '009-P015', prov: '009-TMP-PAE-E4-P', sends: 14768 },
  { pieza: '009-P016', prov: '009-TMP-PAE-E4-G', sends: 4026 },
  { pieza: '009-P017', prov: '009-TMP-PAE-E4-M', sends: 157 },
  // los 6 de E3: solo el ContentName, que está truncado. El EmailID ya está bien.
  { pieza: '009-P006', prov: '009-TMP-PP-E3-P', soloCN: true },
  { pieza: '009-P007', prov: '009-TMP-PP-E3-G', soloCN: true },
  { pieza: '009-P008', prov: '009-TMP-PA-E3-G', soloCN: true },
  { pieza: '009-P009', prov: '009-TMP-PA-E3-M', soloCN: true },
  { pieza: '009-P010', prov: '009-TMP-PO-E3-G', soloCN: true },
  { pieza: '009-P011', prov: '009-TMP-PO-E3-M', soloCN: true }
];

// ── B · las ALTAS. El id vive dentro de la campaña; el correlativo se toma del catálogo, no se
//    escribe a mano, para que dar de alta una campaña no mueva los ids de otra.
//    🔴 `Nescafé ICE` va a **The Freshers**: su `Codigo_NC` es NC000817, EL MISMO que `006-P003`.
//       Eso no es inferir del nombre — es el código de campaña. Y coincide con lo que decidió
//       Rick: ICE es la MARCA, no la campaña.
var ALTAS = [
  { prov: 'TMP-AON-EAPP', camp: 'AON', cod: '001' },
  { prov: 'TMP-AON-EPROP2', camp: 'AON', cod: '001' },
  { prov: 'TMP-AON-EPROP2-FUP', camp: 'AON', cod: '001' },
  { prov: 'TMP-MAGGI-J4-CR', camp: 'Liga MX', cod: '005' },
  { prov: 'TMP-MAGGI-J4-SR', camp: 'Liga MX', cod: '005' },
  { prov: 'TMP-NESC-ICE', camp: 'The Freshers', cod: '006', nota: 'el handoff la llamaba «Nescafé ICE»; su Codigo_NC (NC000817) es el mismo de 006-P003 y Rick decidió que ICE es la MARCA' },
  { prov: 'TMP-NESC-ICE-FUP', camp: 'The Freshers', cod: '006', nota: 'idem' },
  // 🔴 `011`, NO `010`. El 010 acaba de quedar libre porque su única pieza se mudó a The Freshers
  //    — pero un código de campaña NO SE REUTILIZA. Media docena de documentos dicen «ICE
  //    010-P001»; si otra campaña toma ese número, esos documentos pasan a señalar algo distinto
  //    sin que nadie los haya tocado. Es la misma regla que el registro de nombres: el id es
  //    inmutable, y eso incluye no reciclarlo. `010` queda RETIRADO.
  { prov: 'TMP-NESC-ESPRESSO', camp: 'Espresso Con', cod: '011', campNueva: true },
  { prov: 'TMP-NESC-ESPRESSO-FUP', camp: 'Espresso Con', cod: '011', campNueva: true },
  { prov: 'TMP-NESC-ESPRESSO-V3', camp: 'Espresso Con', cod: '011', campNueva: true }
];
var CODIGOS_RETIRADOS = { '010': 'era «ICE»; su única pieza (010-P001) se mudó a The Freshers como 006-P003 el 20-ago-2026. No se reutiliza.' };
// las dimensiones de campaña que NO se inventan: se copian de una hermana de la misma campaña
var BU_MARCA = {
  'AON': { bu: 'RN', marca: 'Recetas Nestlé' },
  'Liga MX': { bu: 'RN', marca: 'Maggi' },
  'The Freshers': { bu: 'Nescafé', marca: 'ICE' },
  'Espresso Con': { bu: 'Nescafé', marca: 'Espresso Con' }   // campaña nueva: marca declarada, no inferida
};

console.log('════════ S1 · ALTAS DEL HANDOFF ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_s1w.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var IDS = ['catalogo.pieza_id', 'catalogo.content_name', 'catalogo.emailid', 'catalogo.campana', 'catalogo.marca',
  'catalogo.bu', 'catalogo.touchpoint', 'catalogo.segmento', 'catalogo.subsegmento', 'catalogo.email_type',
  'catalogo.canal', 'catalogo.sends', 'catalogo.estado', 'catalogo.notas', 'catalogo.codigo_nc', 'catalogo.fuente_dato'];
h.exigir(IDS, 'S1-altas');
console.log('  registro: ' + IDS.length + ' id(s) resuelven ✔\n');
var N = function (k) { return h.n('catalogo.' + k); };
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var filaDe = {}; CAT.forEach(function (p, i) { filaDe[t(p[N('pieza_id')])] = i + 2; });

// ══ A · LLENAR
console.log('══ A · las 12 que se LLENAN (existen ya) ══');
var aLlenar = [], problemas = [];
LLENAR.forEach(function (x) {
  var f = filaDe[x.pieza], p = CAT[f - 2], hh = PORPROV[x.prov];
  if (!f) { problemas.push(x.pieza + ': no existe'); return; }
  if (!hh) { problemas.push(x.prov + ': no está en el handoff'); return; }
  // 🔴 la prueba de que el emparejamiento es el correcto: el Sends tiene que cuadrar
  if (x.sends !== undefined) {
    var sReal = Number(t(p[N('sends')]).replace(/,/g, '')) || 0;
    if (sReal !== x.sends) { problemas.push(x.pieza + ': Sends ' + sReal + ' ≠ ' + x.sends + ' del handoff — NO se toca'); return; }
  }
  var pares = {};
  if (t(p[N('content_name')]) !== hh.cn) pares[N('content_name')] = hh.cn;
  if (!x.soloCN && !/^\d+$/.test(t(p[N('emailid')]))) pares[N('emailid')] = hh.eid;
  if (!Object.keys(pares).length) { console.log('  ○ ' + x.pieza + '  ya estaba bien'); return; }
  aLlenar.push({ fila: f, pieza: x.pieza, pares: pares });
  console.log('  ✔ ' + x.pieza + ' (fila ' + f + ')  ' + Object.keys(pares).map(function (c) {
    return c + ': «' + t(p[c]).slice(0, 26) + '» → «' + String(pares[c]).slice(0, 40) + '»';
  }).join('   '));
});

// ══ B · ALTAS
console.log('\n══ B · las 10 ALTAS ══');
var sig = {};
Object.keys(filaDe).forEach(function (id) {
  var m = /^(\d{3})-P(\d+)$/.exec(id); if (!m) return;
  sig[m[1]] = Math.max(sig[m[1]] || 0, +m[2]);
});
var aCrear = [];
ALTAS.forEach(function (a) {
  var hh = PORPROV[a.prov];
  if (!hh) { problemas.push(a.prov + ': no está en el handoff'); return; }
  var yaCN = CAT.some(function (p) { return t(p[N('content_name')]) === hh.cn; });
  if (yaCN) { console.log('  ○ ' + a.prov + '  su ContentName ya está en el catálogo'); return; }
  sig[a.cod] = (sig[a.cod] || 0) + 1;
  var pieza = a.cod + '-P' + String(sig[a.cod]).padStart(3, '0');
  var bm = BU_MARCA[a.camp] || { bu: '', marca: '' };
  var nc = (/NC(\d{6})/.exec(hh.cn) || [])[0] || '';
  var fila = {};
  fila[N('pieza_id')] = pieza;
  fila[N('content_name')] = hh.cn;
  fila[N('emailid')] = hh.eid;
  fila[N('campana')] = a.camp;
  fila[N('bu')] = bm.bu;
  fila[N('marca')] = bm.marca;
  fila[N('touchpoint')] = hh.tp;
  fila[N('segmento')] = hh.seg || '';
  fila[N('subsegmento')] = hh.sub || '';
  fila[N('email_type')] = hh.tipo;
  fila[N('canal')] = 'Email';
  fila[N('codigo_nc')] = nc;
  fila[N('fuente_dato')] = 'HANDOFF-CATALOGO-RAIZ.md · SFMC';
  // 🔴 lo inferido, marcado
  fila[N('estado')] = hh.inferido ? '⚠ Por confirmar' : 'Confirmado';
  fila[N('notas')] = [hh.inferido ? 'dimensiones inferidas por el equipo de SFMC (' + hh.inferido + '): confirmar' : '',
    a.nota || '', hh.dudoso || ''].filter(Boolean).join(' · ');
  aCrear.push({ pieza: pieza, prov: a.prov, campNueva: a.campNueva, fila: fila, hh: hh });
  console.log('  🆕 ' + pieza.padEnd(10) + a.camp.padEnd(15) + hh.tp.padEnd(14) + (hh.seg || '—').slice(0, 24).padEnd(26) +
    'eid ' + hh.eid + (a.campNueva ? '   🆕 CAMPAÑA NUEVA' : '') + (hh.inferido ? '   ⚠ Por confirmar' : ''));
});

if (problemas.length) {
  console.log('\n  🔴 ' + problemas.length + ' problema(s) — esas piezas NO se tocan:');
  problemas.forEach(function (p) { console.log('     · ' + p); });
}
console.log('\n  a llenar: ' + aLlenar.length + '   ·   a crear: ' + aCrear.length + '   ·   total: ' + (aLlenar.length + aCrear.length) + ' de 22');
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ══ ESCRIBIR ═══════════════════════════════════════════════════════════════════════
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var idx = {}; enc.forEach(function (n, i) { if (t(n)) idx[t(n)] = i; });
var estilo = {}; enc.forEach(function (n, i) { estilo[i] = CX.estiloDe(xml, R.letra(i) + '2') || CX.estiloDe(xml, 'A1'); });

aLlenar.forEach(function (x) {
  Object.keys(x.pares).forEach(function (c) {
    var i = idx[c], ref = R.letra(i) + x.fila;
    xml = CX.poner(xml, ref, CX.celda(ref, x.pares[c], CX.estiloDe(xml, ref) || estilo[i]), x.fila).xml;
  });
});
// 🔴 las filas nuevas van al FINAL y en ORDEN DE COLUMNA. Escribirlas en orden de inserción hace
//    que Excel se niegue a abrir el archivo — ya pasó, y por eso existe la 5ª capa de validación.
var ultima = 1;
xml.replace(/<row r="(\d+)"/g, function (_, n2) { ultima = Math.max(ultima, +n2); return _; });
var nuevasXml = '';
aCrear.forEach(function (x, k) {
  var nf = ultima + 1 + k, celdas = [];
  enc.forEach(function (nom, i) {
    var v = x.fila[t(nom)];
    if (v === undefined || v === '') return;
    celdas.push(CX.celda(R.letra(i) + nf, v, estilo[i]));
  });
  nuevasXml += '<row r="' + nf + '">' + celdas.join('') + '</row>';
});
if (nuevasXml) xml = xml.replace('</sheetData>', nuevasXml + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + (ultima + aCrear.length) + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save');
console.log('     validado: ' + (safeSave(SECO, SECO).validado || '?'));

// ── releer del disco
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('\n  ── releído: ' + V.length + ' piezas (antes ' + CAT.length + ')');
var cn = {}; V.forEach(function (p) { var c = t(p[N('content_name')]); if (c) cn[c] = (cn[c] || 0) + 1; });
var dupCN = Object.keys(cn).filter(function (k) { return cn[k] > 1; });
console.log('     ContentName duplicados: ' + (dupCN.length ? '🔴 ' + dupCN.length + ' · ' + dupCN.slice(0, 3).join(' · ') : '✔ ninguno'));
var conHandoff = H.filter(function (x) { return V.some(function (p) { return t(p[N('content_name')]) === x.cn; }); }).length;
console.log('     de las 22 del handoff, con su ContentName EXACTO en el catálogo: ' + conHandoff + '/22 ' + (conHandoff === 22 ? '✔' : '🔴'));
var porLlenar = V.filter(function (p) { return /Por llenar/.test(t(p[N('emailid')])); }).length;
console.log('     EmailID que siguen «**Por llenar»: ' + porLlenar + (porLlenar ? '' : ' ✔'));
console.log('\n  archivo listo en: ' + SECO + '   (aún NO publicado)');
