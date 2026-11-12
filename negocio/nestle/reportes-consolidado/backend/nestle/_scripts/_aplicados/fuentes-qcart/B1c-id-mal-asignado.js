// B1c · UN pieza_id REPETIDO ENTRE TOUCHPOINTS — no es un duplicado, es un id mal puesto.
//
// 🔴 QUÉ SE MIDIÓ. Rick reportó «1 duplicado en Data_WhatsApp = 004-P013». Con la llave correcta
//    (pieza + touchpoint) NO hay duplicado: son DOS envíos distintos —WA-P2 y WA-P3— con
//    read-rate y CTOR propios, que por error llevan el MISMO pieza_id. El catálogo dice que
//    004-P013 es «Partido 3»; ninguna de las dos filas encaja con eso.
//
// 🔴 POR QUÉ NO SE TOCA AQUÍ. Borrar una de las dos filas destruiría un envío real (la regla de
//    oro: los cambios a mano son deliberados, y un envío medido no es basura). Y reasignar el id
//    correcto —¿WA-P2 es 004-P011/P012? ¿WA-P3 es 004-P014/P015?— es una decisión que necesita
//    la fuente de WhatsApp y el criterio de Rick, no una inferencia del naming. Se levanta con
//    evidencia y se deja para que él decida. Adivinar aquí es exactamente lo que rompe la
//    atribución.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ B1c · id repetido entre touchpoints (WhatsApp) ════════\n');
var F0 = os.homedir() + '/_b1c.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);
var W = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

// piezas por id en el catálogo, y filas por id en la hoja
var catPorId = {};
P.forEach(function (p) { catPorId[t(p['Pieza_ID'])] = p; });
var porId = {};
W.forEach(function (r, i) { var id = t(r['pieza_id']); if (id) (porId[id] = porId[id] || []).push({ fila: i + 2, tp: t(r['Touchpoint']), r: r }); });

var conflictos = Object.keys(porId).filter(function (id) {
  var tps = {}; porId[id].forEach(function (x) { tps[x.tp] = 1; });
  return Object.keys(tps).length > 1;   // mismo id, varios touchpoints
});

if (!conflictos.length) { console.log('  ✔ ningún pieza_id de WhatsApp aparece con dos touchpoints. Nada que levantar.'); process.exit(0); }

var casos = [];
conflictos.forEach(function (id) {
  var cat = catPorId[id];
  console.log('  🔴 ' + id + '   el catálogo lo llama «' + (cat ? t(cat['Touchpoint']) : '(no está)') + '»');
  porId[id].forEach(function (x) {
    console.log('       fila ' + x.fila + '  touchpoint hoja = ' + x.tp.padEnd(9) +
      'send=' + (t(x.r['Send_Date']) || '—').padEnd(7) + 'read_rate=' + t(x.r['Read_Rate']).slice(0, 6));
  });
  // qué piezas del catálogo SÍ tienen esos touchpoints — la pista, no la respuesta
  var candidatos = {};
  porId[id].forEach(function (x) {
    candidatos[x.tp] = P.filter(function (p) { return /whats/i.test(t(p['Canal'])) && t(p['Touchpoint']) === x.tp; })
      .map(function (p) { return t(p['Pieza_ID']) + ' (' + t(p['Segmento']).slice(0, 20) + ')'; });
  });
  Object.keys(candidatos).forEach(function (tp) {
    console.log('       el catálogo pone ' + tp + ' en: ' + (candidatos[tp].join(' · ') || '(ninguna)'));
  });
  casos.push({ pieza_id: id, touchpoint_catalogo: cat ? t(cat['Touchpoint']) : null,
    filas: porId[id].map(function (x) { return { fila: x.fila, touchpoint: x.tp, send_date: t(x.r['Send_Date']), read_rate: t(x.r['Read_Rate']) }; }),
    candidatos_por_touchpoint: candidatos });
});

fs.writeFileSync(BACK + '/_fuentes/whatsapp-id-mal-asignado.json', JSON.stringify({
  paso: 'B1c', cuando: '2026-08-21',
  que_es: 'Un pieza_id de WhatsApp que aparece con dos touchpoints distintos. No es un duplicado (los datos difieren): es un id mal asignado.',
  por_que_no_se_toca: 'Reasignar el id o borrar una fila necesita la fuente de WhatsApp y el criterio de Rick. Adivinar del naming rompe la atribución.',
  para_rick: 'Decidir a qué pieza pertenece cada uno de estos dos envíos de WhatsApp, o confirmar que ambos son 004-P013 en dos touchpoints.',
  casos: casos
}, null, 1));

console.log('\n  → _fuentes/whatsapp-id-mal-asignado.json');
console.log('\n  ⚠ AVISA, no bloquea: es un dato de WhatsApp (0.15% del volumen) y no cuadra contra sí mismo.');
console.log('     Va al handoff para que Rick decida el mapeo correcto — no se toca sin la fuente.');
