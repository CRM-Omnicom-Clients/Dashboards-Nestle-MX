// S9 · LOS OBJETIVOS DE LAS PIEZAS NUEVAS — dichos por Rick el 21-ago-2026.
//
//    «APP: descarga de app. PROP's son prevención de churn. Liga MX son purchase.
//     Espresso Concentrate: si es E-A es awareness, si es E-Hack es awareness, si es E-Rit
//     es purchase.»
//
// 🔴 ESTO NO ES INFERIR DEL NAMING: es una AUTORIDAD. La regla del proyecto no prohíbe usar el
//    touchpoint para resolver una dimensión — prohíbe DEDUCIRLA. La diferencia es quién lo dice:
//    aquí lo dijo Rick, y por eso se puede escribir. Se guarda como regla, no como valor suelto,
//    para que la próxima pieza `E-Rit` de Espresso resuelva sola.
//
// 🔴 EL VOCABULARIO SE TOMA DEL CATÁLOGO, NO SE INVENTA. Si «Descarga App» ya existe con ese
//    nombre exacto, escribir «Descarga de App» crearía un objetivo gemelo que parte los reportes
//    en dos sin que nadie lo note.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase(); };

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_s9.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
h.exigir(['catalogo.pieza_id', 'catalogo.campana', 'catalogo.touchpoint', 'catalogo.objetivo', 'catalogo.estado', 'catalogo.notas'], 'S9');
var N = function (k) { return h.n('catalogo.' + k); };
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

console.log('════════ S9 · OBJETIVOS DE LAS PIEZAS NUEVAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

// ── el vocabulario que YA existe
var vocab = {};
CAT.forEach(function (p) { var o = t(p[N('objetivo')]); if (o) vocab[o] = (vocab[o] || 0) + 1; });
console.log('  objetivos que ya usa el catálogo:');
Object.keys(vocab).sort(function (a, b) { return vocab[b] - vocab[a]; })
  .forEach(function (o) { console.log('     ' + String(vocab[o]).padStart(4) + '  ' + o); });

// se elige el nombre EXACTO que ya existe; solo si ninguno cuadra se declara uno nuevo
function delVocab(pistas, nuevo) {
  var hit = Object.keys(vocab).filter(function (o) { return pistas.some(function (p) { return nmz(o).indexOf(p) >= 0; }); })[0];
  return hit || nuevo;
}
var OBJ_APP = delVocab(['descarga'], 'Descarga App');
var OBJ_CHURN = delVocab(['churn', 'retencion', 'retención'], 'Prevención de Churn');
var OBJ_PURCH = delVocab(['purchase'], 'Purchase');
var OBJ_AWARE = delVocab(['awareness'], 'Awareness');
console.log('\n  el vocabulario que se va a usar:');
[['APP', OBJ_APP], ['churn', OBJ_CHURN], ['purchase', OBJ_PURCH], ['awareness', OBJ_AWARE]].forEach(function (x) {
  console.log('     ' + x[0].padEnd(12) + '→ «' + x[1] + '»' + (vocab[x[1]] ? '   (ya existe, ' + vocab[x[1]] + ' piezas)' : '   🆕 objetivo NUEVO'));
});

// ── las reglas, tal como Rick las dictó. Por CAMPAÑA × patrón de touchpoint.
var REGLAS = [
  { campana: 'AON', tp: /^E-APP/i, obj: OBJ_APP, dicho: 'APP: descarga de app' },
  { campana: 'AON', tp: /^E-PROP/i, obj: OBJ_CHURN, dicho: 'PROPs: prevención de churn' },
  { campana: 'Liga MX', tp: /.*/, obj: OBJ_PURCH, dicho: 'Liga MX son purchase' },
  { campana: 'Espresso Con', tp: /^E-A/i, obj: OBJ_AWARE, dicho: 'Espresso: E-A es awareness' },
  { campana: 'Espresso Con', tp: /^E-Hack/i, obj: OBJ_AWARE, dicho: 'Espresso: E-Hack es awareness' },
  { campana: 'Espresso Con', tp: /^E-Rit/i, obj: OBJ_PURCH, dicho: 'Espresso: E-Rit es purchase' }
];

console.log('\n  ── qué se llena');
var cambios = [], derivadas = [];
CAT.forEach(function (p, i) {
  if (t(p[N('objetivo')])) return;                      // ya tiene: no se toca
  var camp = t(p[N('campana')]), tp = t(p[N('touchpoint')]);
  var r = REGLAS.filter(function (x) { return nmz(x.campana) === nmz(camp) && x.tp.test(tp); })[0];
  if (r) {
    cambios.push({ fila: i + 2, pieza: t(p[N('pieza_id')]), camp: camp, tp: tp, obj: r.obj, por: 'Rick, 21-ago: «' + r.dicho + '»' });
    return;
  }
  // 🔴 lo que Rick NO dictó no se rellena con una corazonada: se busca una HERMANA de la misma
  //    campaña y el mismo touchpoint base que ya tenga objetivo. Si no la hay, se queda vacío.
  var base = tp.replace(/\d+$/, '');
  var herm = CAT.filter(function (q) {
    return nmz(q[N('campana')]) === nmz(camp) && t(q[N('objetivo')]) &&
      t(q[N('touchpoint')]).replace(/\d+$/, '').toLowerCase() === base.toLowerCase();
  })[0];
  if (herm) {
    derivadas.push({ fila: i + 2, pieza: t(p[N('pieza_id')]), camp: camp, tp: tp, obj: t(herm[N('objetivo')]),
      por: 'su hermana ' + t(herm[N('pieza_id')]) + ' (' + t(herm[N('touchpoint')]) + ') en la misma campaña' });
  }
});
cambios.forEach(function (c) { console.log('   ✔ ' + c.pieza.padEnd(10) + c.camp.padEnd(15) + c.tp.padEnd(15) + '→ ' + c.obj.padEnd(22) + c.por); });
derivadas.forEach(function (c) { console.log('   ~ ' + c.pieza.padEnd(10) + c.camp.padEnd(15) + c.tp.padEnd(15) + '→ ' + c.obj.padEnd(22) + '⚠ derivado de ' + c.por); });

var sinResolver = CAT.filter(function (p) { return !t(p[N('objetivo')]); }).length - cambios.length - derivadas.length;
console.log('\n  dictados por Rick: ' + cambios.length + '   ·   derivados de una hermana (marcados): ' + derivadas.length +
  '   ·   siguen sin objetivo: ' + sinResolver);
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

var todos = cambios.concat(derivadas);
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var iObj = h.col('catalogo.objetivo').i, iNot = h.col('catalogo.notas').i, iEst = h.col('catalogo.estado').i;
todos.forEach(function (c) {
  var ref = R.letra(iObj) + c.fila;
  xml = CX.poner(xml, ref, CX.celda(ref, c.obj, CX.estiloDe(xml, ref) || CX.estiloDe(xml, R.letra(iObj) + '2')), c.fila).xml;
  var refN = R.letra(iNot) + c.fila;
  var notaVieja = t((CAT[c.fila - 2] || {})[N('notas')]);
  var nota = (notaVieja ? notaVieja + ' · ' : '') + 'objetivo: ' + c.por;
  xml = CX.poner(xml, refN, CX.celda(refN, nota, CX.estiloDe(xml, refN) || CX.estiloDe(xml, R.letra(iNot) + '2')), c.fila).xml;
  // 🔴 lo dictado por Rick deja de estar «Por confirmar» en su objetivo; lo derivado NO.
  if (/Rick/.test(c.por)) {
    var refE = R.letra(iEst) + c.fila;
    var est = t((CAT[c.fila - 2] || {})[N('estado')]);
    if (/Por confirmar/i.test(est)) {
      xml = CX.poner(xml, refE, CX.celda(refE, '⚠ Por confirmar (segmento)', CX.estiloDe(xml, refE) || CX.estiloDe(xml, R.letra(iEst) + '2')), c.fila).xml;
    }
  }
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save');
console.log('     validado: ' + (safeSave(SECO, SECO).validado || '?'));
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('\n  ── releído: piezas sin objetivo: ' + V.filter(function (p) { return !t(p[N('objetivo')]); }).length);
todos.slice(0, 12).forEach(function (c) {
  var p = V.filter(function (q) { return t(q[N('pieza_id')]) === c.pieza; })[0];
  console.log('     ' + c.pieza.padEnd(10) + '«' + (p ? t(p[N('objetivo')]) : '?') + '»');
});
console.log('\n  archivo listo en: ' + SECO + '   (aún NO publicado)');
