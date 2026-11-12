// S1-00 · qué de las 22 piezas del handoff YA está en el catálogo y qué falta.
// 🔴 Se cruza por `ContentName` EXACTO, que es la llave que declara el handoff — no por el
//    número de pieza, que es alias interno nuestro.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

// las 22 del handoff, tal cual. Las dimensiones con `*` vienen INFERIDAS por el equipo de SFMC:
// entran marcadas «⚠ Por confirmar», nunca aceptadas en silencio.
var H = [
  { prov: '009-TMP-PA-E3-G', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Aspiracionales', sub: 'Gatos', tipo: 'Principal', eid: '83766', cn: 'MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PA_E3B2.NA' },
  { prov: '009-TMP-PA-E3-M', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Aspiracionales', sub: 'Mixto', tipo: 'Principal', eid: '83767', cn: 'MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PA_E3B3.NA' },
  { prov: '009-TMP-PAE-E4-G', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan PAE', sub: 'Gatos', tipo: 'Principal', eid: '84323', cn: 'MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PAE_E4B2.NA', dudoso: 'PAE' },
  { prov: '009-TMP-PAE-E4-M', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan PAE', sub: 'Mixto', tipo: 'Principal', eid: '84261', cn: 'MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PAE_E4B3.NA', dudoso: 'PAE' },
  { prov: '009-TMP-PAE-E4-P', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan PAE', sub: 'Perros', tipo: 'Principal', eid: '84322', cn: 'MX.Proplan.ATM_JB.User.Perros.Comunidad.CDP_Proplan_PAE_E4B1.NA', dudoso: 'PAE' },
  { prov: '009-TMP-PO-E3-G', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Educated Pet Owners', sub: 'Gatos', tipo: 'Principal', eid: '83769', cn: 'MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PO_E3C2.NA' },
  { prov: '009-TMP-PO-E3-M', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Educated Pet Owners', sub: 'Mixto', tipo: 'Principal', eid: '83770', cn: 'MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PO_E3C3.NA' },
  { prov: '009-TMP-PP-E3-G', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Pet Parents', sub: 'Gatos', tipo: 'Principal', eid: '83763', cn: 'MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PP_E3A2.NA' },
  { prov: '009-TMP-PP-E3-P', camp: 'Fuel for life', tp: 'E-E3', seg: 'Pro Plan Pet Parents', sub: 'Perros', tipo: 'Principal', eid: '83762', cn: 'MX.Proplan.ATM_JB.User.Perros.Comunidad.CDP_Proplan_PP_E3A1.NA' },
  { prov: '009-TMP-PP-E4-G', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan Pet Parents', sub: 'Gatos', tipo: 'Principal', eid: '84320', cn: 'MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PP_E4A2.NA' },
  { prov: '009-TMP-PP-E4-M', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan Pet Parents', sub: 'Mixto', tipo: 'Principal', eid: '84321', cn: 'MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PP_E4A3.NA' },
  { prov: '009-TMP-PP-E4-P', camp: 'Fuel for life', tp: 'E-E4', seg: 'Pro Plan Pet Parents', sub: 'Perros', tipo: 'Principal', eid: '83930', cn: 'MX.Proplan.ATM_JB.User.Perros.Comunidad.CDP_Proplan_PP_E4A1.NA' },
  { prov: 'TMP-AON-EAPP', camp: 'AON', tp: 'E-APP', seg: 'App', tipo: 'Principal', eid: '84566', cn: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_E-APP_CN_EM_A_V1_018904', inferido: 'touchpoint y segmento' },
  { prov: 'TMP-AON-EPROP2', camp: 'AON', tp: 'E-PROP2', seg: 'Propensión', tipo: 'Principal', eid: '84594', cn: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_E-PROP2_EN_EM_A_V1', inferido: 'touchpoint y segmento' },
  { prov: 'TMP-AON-EPROP2-FUP', camp: 'AON', tp: 'E-PROP2', seg: 'Propensión', tipo: 'Follow Up', eid: '84595', cn: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_E-PROP2-FUP_EN_EM_A_V1', inferido: 'touchpoint y segmento' },
  { prov: 'TMP-MAGGI-J4-CR', camp: 'Liga MX', tp: 'J4-ConRegión', seg: 'Con región', tipo: 'Principal', eid: '84969', cn: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J4-CONREGION_AQ_EM_A_NA_035275', inferido: 'campaña, touchpoint y segmento' },
  { prov: 'TMP-MAGGI-J4-SR', camp: 'Liga MX', tp: 'J4-SinRegión', seg: 'Sin región', tipo: 'Principal', eid: '84970', cn: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J4-SINREGION_AQ_EM_A_NA_035274', inferido: 'campaña, touchpoint y segmento' },
  { prov: 'TMP-NESC-ESPRESSO', camp: 'Espresso Con', tp: 'E-A', seg: '', tipo: 'Principal', eid: '84742', cn: 'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_B_V2_024241', inferido: 'campaña, touchpoint y segmento' },
  { prov: 'TMP-NESC-ESPRESSO-FUP', camp: 'Espresso Con', tp: 'E-A', seg: '', tipo: 'Follow Up', eid: '84747', cn: 'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_FUP_B_V2_024241', inferido: 'campaña, touchpoint y segmento' },
  { prov: 'TMP-NESC-ESPRESSO-V3', camp: 'Espresso Con', tp: 'E-A', seg: '', tipo: 'Principal', eid: '84984', cn: 'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_C_V3_024242', inferido: 'campaña, touchpoint y segmento' },
  { prov: 'TMP-NESC-ICE', camp: 'Nescafé ICE', tp: 'E-A', seg: '', tipo: 'Principal', eid: '84655', cn: 'O_Nescafé-ICE-NC000817_2_IBS_CFEE_NESC_NCF_AAIW_MX_ES_NA_AC_EM_A_V2_024222', inferido: 'campaña, touchpoint y segmento', dudoso: 'ICE es MARCA según Rick — ¿la campaña es The Freshers?' },
  { prov: 'TMP-NESC-ICE-FUP', camp: 'Nescafé ICE', tp: 'E-A', seg: '', tipo: 'Follow Up', eid: '84697', cn: 'O_Nescafé-ICE-NC000817_2_IBS_CFEE_NESC_NCF_AAIW_MX_ES_NA_AC_EM_FUP_A_V2_024222', inferido: 'campaña, touchpoint y segmento', dudoso: 'ICE es MARCA según Rick — ¿la campaña es The Freshers?' }
];
fs.writeFileSync(os.homedir() + '/.claude/reportes-backend/nestle/_insumos/handoff-22-piezas.json', JSON.stringify(H, null, 1));

var C = os.homedir() + '/_s1.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
h.exigir(['catalogo.pieza_id', 'catalogo.content_name', 'catalogo.emailid', 'catalogo.campana', 'catalogo.touchpoint', 'catalogo.segmento', 'catalogo.subsegmento', 'catalogo.email_type'], 'S1');
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var N = function (id) { return h.n('catalogo.' + id); };

console.log('════════ S1-00 · las 22 piezas del handoff contra el catálogo ════════\n');
console.log('  catálogo: ' + CAT.length + ' piezas  ·  se cruza por ContentName EXACTO (la llave del handoff)\n');

var porCN = {}, porEID = {};
CAT.forEach(function (p, i) {
  t(p[N('content_name')]).split(/\s*[·|]\s*/).forEach(function (cn) { if (t(cn)) porCN[t(cn)] = { p: p, fila: i + 2 }; });
  t(p[N('emailid')]).split(/\s*,\s*/).forEach(function (e) { if (t(e)) porEID[t(e)] = { p: p, fila: i + 2 }; });
});

var estan = 0, porEmail = 0, faltan = [];
H.forEach(function (x) {
  var m = porCN[x.cn], via = 'ContentName';
  if (!m) { m = porEID[x.eid]; via = 'EmailID'; }
  if (m) {
    (via === 'ContentName') ? estan++ : porEmail++;
    console.log('  ✔ ' + x.prov.padEnd(24) + '→ ' + t(m.p[N('pieza_id')]).padEnd(10) + '(por ' + via + ')  ' +
      t(m.p[N('campana')]) + ' · ' + t(m.p[N('touchpoint')]) + ' · ' + t(m.p[N('segmento')]).slice(0, 26));
  } else {
    faltan.push(x);
    console.log('  🆕 ' + x.prov.padEnd(24) + x.camp.padEnd(15) + x.tp.padEnd(14) + (x.seg || '(sin segmento)').slice(0, 28).padEnd(30) + 'EmailID ' + x.eid +
      (x.inferido ? '   ⚠ ' + x.inferido + ' inferido' : ''));
  }
});
console.log('\n  ya están por ContentName: ' + estan + '   ·   por EmailID: ' + porEmail + '   ·   FALTAN: ' + faltan.length);

var camps = {};
faltan.forEach(function (x) { camps[x.camp] = (camps[x.camp] || 0) + 1; });
console.log('\n  campañas de lo que falta:');
Object.keys(camps).forEach(function (c) {
  var existe = CAT.some(function (p) { return t(p[N('campana')]) === c; });
  console.log('     ' + c.padEnd(18) + camps[c] + ' pieza(s)   ' + (existe ? 'la campaña ya existe' : '🆕 CAMPAÑA NUEVA'));
});
var dud = H.filter(function (x) { return x.dudoso; });
console.log('\n  ⚠ con duda declarada (entran «Por confirmar», no en silencio): ' + dud.length);
dud.forEach(function (x) { console.log('     ' + x.prov.padEnd(24) + x.dudoso); });
console.log('\n  → _insumos/handoff-22-piezas.json');
