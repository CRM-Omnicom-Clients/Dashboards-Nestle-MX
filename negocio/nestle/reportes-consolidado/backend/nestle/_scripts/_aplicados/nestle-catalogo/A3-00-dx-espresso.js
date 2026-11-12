// A3-00 · las piezas de Espresso: qué dice la DE, qué dice Rick, y qué tengo yo mal.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// 🔴 lo que dictó Rick, EN SU ORDEN. El touchpoint no se deduce del nombre: él lo dio.
var RICK = [
  { tp: 'E-Hack1', obj: 'Awareness', cn: 'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_Concentrate_AC_EM_A_V1_001577' },
  { tp: 'E-Hack2', obj: 'Awareness', cn: 'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_Concentrate_AC_EM_B_V2_001576' },
  { tp: 'E-Rit1', obj: 'Purchase', cn: 'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_B_V2_024241' },
  { tp: 'E-Rit2', obj: 'Purchase', cn: 'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_C_V3_024242' }
];

console.log('════════ A3-00 · ESPRESSO: LA DE, RICK Y LO QUE TENGO ════════\n');

// ── 1 · qué dice la DE
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var enDE = D.rows.filter(function (r) { return /Espresso-Con/i.test(t(r.Email_Content_Name)); });
console.log('══ 1 · en `CRM_Email_Piezas` hay ' + enDE.length + ' pieza(s) de Espresso ══');
console.log('   EmailID   sends    ContentName');
enDE.forEach(function (r) {
  console.log('   ' + t(r.Email_ID).padEnd(9) + mil(r.Email_Sends).padStart(8) + '   …' + t(r.Email_Content_Name).slice(-62));
});

// ── 2 · las 4 de Rick contra la DE
console.log('\n══ 2 · las 4 que dictó Rick, ¿están en la DE? ══');
var porCN = {}; enDE.forEach(function (r) { porCN[t(r.Email_Content_Name)] = r; });
var falta = [];
RICK.forEach(function (x) {
  var r = porCN[x.cn];
  if (r) console.log('   ✔ ' + x.tp.padEnd(9) + t(r.Email_ID).padEnd(8) + mil(r.Email_Sends).padStart(8) + ' envíos   ' + x.obj);
  else { falta.push(x); console.log('   🔴 ' + x.tp.padEnd(9) + 'NO ESTÁ en la DE   …' + x.cn.slice(-56)); }
});

// ── 3 · lo que la DE trae y Rick NO listó
console.log('\n══ 3 · lo que la DE trae y Rick NO listó ══');
var listados = {}; RICK.forEach(function (x) { listados[x.cn] = 1; });
var sobra = enDE.filter(function (r) { return !listados[t(r.Email_Content_Name)]; });
if (!sobra.length) console.log('   (ninguna)');
sobra.forEach(function (r) {
  console.log('   ⚠ ' + t(r.Email_ID).padEnd(8) + mil(r.Email_Sends).padStart(8) + ' envíos · Es_FUP=' + t(r.Es_FUP) + '   …' + t(r.Email_Content_Name).slice(-56));
});

// ── 4 · lo que YO tengo en el catálogo
console.log('\n══ 4 · lo que tengo hoy en el catálogo (la campaña inventada) ══');
var C = os.homedir() + '/_a3.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
P.filter(function (p) { return /^011-/.test(t(p[N('pieza_id')])); }).forEach(function (p, i) {
  var cn = t(p[N('content_name')]);
  var deRick = RICK.filter(function (x) { return x.cn === cn; })[0];
  console.log('   ' + t(p[N('pieza_id')]).padEnd(10) + 'eid ' + t(p[N('emailid')]).padEnd(8) + 'tp=' + t(p[N('touchpoint')]).padEnd(6) +
    (deRick ? '→ ' + deRick.tp + ' (' + deRick.obj + ')' : '🔴 no está entre las 4 de Rick') + '   …' + cn.slice(-44));
});

// ── 5 · dónde van
console.log('\n══ 5 · a dónde van ══');
var sig = 0;
P.forEach(function (p) { var m = /^007-P(\d+)$/.exec(t(p[N('pieza_id')])); if (m) sig = Math.max(sig, +m[1]); });
console.log('   campaña 007 · Hackea tu café · marca Concentrate · BU Nescafé');
console.log('   último id usado: 007-P' + String(sig).padStart(3, '0') + '   →   las nuevas serían 007-P' +
  String(sig + 1).padStart(3, '0') + ' … 007-P' + String(sig + RICK.length).padStart(3, '0'));
P.filter(function (p) { return /^007-/.test(t(p[N('pieza_id')])); }).forEach(function (p) {
  console.log('      ya existe: ' + t(p[N('pieza_id')]).padEnd(10) + 'tp=' + t(p[N('touchpoint')]).padEnd(7) + 'obj=' + t(p[N('objetivo')]).padEnd(12) + 'seg=' + t(p[N('segmento')]));
});
