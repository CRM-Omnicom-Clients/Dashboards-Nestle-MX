// FASE 3 · EXTRAER LAS DECISIONES A DECLARACIONES.
//
// 🔴 EL PROBLEMA, EN UNA FRASE: **un script determinístico congela una decisión en código.** Cada vez
//    que la decisión cambia hay que editar el script — y si la misma decisión está en cuatro pasos,
//    hay que acordarse de los cuatro. Hoy pasó cinco veces: la campaña canónica, el formato de
//    quincena, la llave del reporte (escrita CUATRO veces) y la regla del shortlink.
//
// 🔴 QUÉ CUENTA COMO DECISIÓN Y QUÉ NO. No todo literal es una decisión:
//      · `'Report_Resumen'`        → decisión: alguien eligió que la hoja se llame así
//      · `'Maggi'`, `'conregion'`  → decisión: vocabulario del negocio
//      · umbral `>= 60`, `0.5`     → decisión: alguien eligió el corte
//      · `'utf8'`, `'\n'`, `/^\d+/` → NO: son mecánica, no negocio
//    La diferencia es si **Rick podría cambiarlo mañana**. Si sí, va a una declaración.
//
// 🔴 ESTE SCRIPT NO REESCRIBE CÓDIGO. Encuentra, agrupa y declara. Mover cada decisión a su
//    declaración es trabajo de la fase 4, cuando los vivos se colapsen en capacidades — hacerlo
//    ahora sería editar 46 scripts que en dos fases van a desaparecer.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';

var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
// se miran los que SIGUEN VIVOS: lo archivado ya no decide nada
var vivos = []
  .concat((censo.clases.VIVO || []).map(function (x) { return { f: x.f, skill: x.skill, clase: 'VIVO' }; }))
  .concat((censo.clases.ESCRITOR || []).map(function (x) { return { f: x.f, skill: x.skill, clase: 'ESCRITOR' }; }))
  .concat((censo.clases.ADVERSARIAL || []).map(function (x) { return { f: x.f, skill: x.skill, clase: 'ADVERSARIAL' }; }))
  .concat((censo.clases.HERRAMIENTA || []).map(function (x) { return { f: x.f, skill: x.skill, clase: 'HERRAMIENTA' }; }));

// ── el vocabulario del negocio, para reconocerlo dentro del código
var HOJAS = ['Report_Resumen', 'Reporte_julio', 'Catalogo_Piezas', 'Catalogo_Referencias',
  'Data_Email', 'Data_WhatsApp', 'Data_Qcart_Carritos', 'Data_Qcart_Productos'];
var NEGOCIO = /\b(Maggi|Nescaf|Purina|Pro Plan|La Lechera|Hotcakes|Mundial|Liga ?MX|ligamx|conregion|sinregion|The Freshers|Tercer Tiempo|Antojo Infinito|Fuel for life|Hackea|AON|Qcart|WhatsApp|Principal|FUP)\b/;

function decisionesDe(txt) {
  var out = { hojas: {}, columnas: {}, negocio: {}, umbrales: [], llaves: [] };
  // hojas nombradas
  HOJAS.forEach(function (h) { if (txt.indexOf("'" + h + "'") >= 0 || txt.indexOf('"' + h + '"') >= 0) out.hojas[h] = 1; });
  // columnas: literales con forma de encabezado (Mayúscula_con_guion_bajo, o con acento/espacio)
  (txt.match(/'[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9_() #%]{2,38}'/g) || []).forEach(function (m) {
    var v = m.slice(1, -1);
    if (HOJAS.indexOf(v) >= 0) return;
    if (!/[_ ]/.test(v) && v.length < 5) return;
    if (NEGOCIO.test(v)) { out.negocio[v] = 1; return; }
    out.columnas[v] = 1;
  });
  // vocabulario de negocio en minúscula o dentro de regex
  (txt.match(NEGOCIO) || []).forEach(function (m) { out.negocio[m] = 1; });
  // umbrales: comparaciones contra un número que no sea 0 ni 1
  (txt.match(/[><]=?\s*(\d{2,}|0\.\d+)/g) || []).forEach(function (m) { out.umbrales.push(m.trim()); });
  // llaves compuestas: joins con separador
  (txt.match(/\.join\('¦'\)|\.join\('\|'\)/g) || []).forEach(function () { out.llaves.push('llave compuesta'); });
  return out;
}

console.log('════════ FASE 3 · DECISIONES DENTRO DEL CÓDIGO ════════\n');
console.log('  se miran ' + vivos.length + ' scripts vivos (lo archivado ya no decide)\n');

var total = { hojas: {}, columnas: {}, negocio: {}, umbrales: 0, llaves: 0 };
var porScript = [];
vivos.forEach(function (v) {
  var p = path.join(D, v.f);
  if (!fs.existsSync(p)) return;
  var d = decisionesDe(fs.readFileSync(p, 'utf8'));
  var n = Object.keys(d.hojas).length + Object.keys(d.columnas).length + Object.keys(d.negocio).length + d.umbrales.length;
  if (!n) return;
  porScript.push({ f: v.f, skill: String(v.skill || '').replace('rick-reportes-', ''), clase: v.clase, d: d, n: n });
  Object.keys(d.hojas).forEach(function (k) { total.hojas[k] = (total.hojas[k] || 0) + 1; });
  Object.keys(d.columnas).forEach(function (k) { total.columnas[k] = (total.columnas[k] || 0) + 1; });
  Object.keys(d.negocio).forEach(function (k) { total.negocio[k] = (total.negocio[k] || 0) + 1; });
  total.umbrales += d.umbrales.length; total.llaves += d.llaves.length;
});

porScript.sort(function (a, b) { return b.n - a.n; });
console.log('  ── LOS QUE MÁS DECIDEN ──');
porScript.slice(0, 12).forEach(function (x) {
  console.log('   ' + String(x.n).padStart(3) + '  ' + x.f.padEnd(30) + x.skill.padEnd(18) +
    Object.keys(x.d.hojas).length + ' hojas · ' + Object.keys(x.d.columnas).length + ' columnas · ' +
    Object.keys(x.d.negocio).length + ' negocio');
});

// 🔴 LA MÉTRICA QUE IMPORTA: una decisión repetida en N sitios se desincroniza en cuanto cambia en uno.
console.log('\n  ── 🔴 DECISIONES REPETIDAS EN VARIOS SCRIPTS ──');
function repetidas(mapa, etiqueta, min) {
  var r = Object.keys(mapa).filter(function (k) { return mapa[k] >= (min || 3); })
    .sort(function (a, b) { return mapa[b] - mapa[a]; });
  console.log('   ' + etiqueta + ': ' + r.length);
  r.slice(0, 10).forEach(function (k) { console.log('      ' + String(mapa[k]).padStart(3) + ' scripts  «' + k + '»'); });
  return r;
}
var rh = repetidas(total.hojas, 'hojas nombradas a mano', 3);
var rc = repetidas(total.columnas, 'columnas nombradas a mano', 4);
var rn = repetidas(total.negocio, 'vocabulario de negocio en el código', 3);
console.log('   umbrales dentro del código: ' + total.umbrales);

fs.writeFileSync(BACK + '/_contratos/decisiones-en-codigo.json', JSON.stringify({
  paso: 'extraer-decisiones', fase: 3,
  que_es: 'las decisiones que hoy viven DENTRO del código de los scripts vivos',
  regla: 'es decisión si Rick podría cambiarlo mañana; es mecánica si no',
  no_reescribe: 'encuentra y declara; mover cada una a su declaración es la fase 4',
  scripts: porScript.map(function (x) {
    return { script: x.f, skill: x.skill, clase: x.clase, decisiones: x.n,
      hojas: Object.keys(x.d.hojas), columnas: Object.keys(x.d.columnas), negocio: Object.keys(x.d.negocio) };
  }),
  repetidas: { hojas: rh, columnas: rc, negocio: rn }
}, null, 1));

// ══ VALIDACIÓN DE LA FASE 3 ══
console.log('\n  ══ VALIDACIÓN DE LA FASE 3 ══');
var sinSkill = porScript.filter(function (x) { return !x.skill; }).length;
console.log('   ' + (sinSkill === 0 ? '✔' : '🔴') + ' cada script con decisiones tiene skill: ' + (porScript.length - sinSkill) + ' de ' + porScript.length);
console.log('   ✔ el inventario existe y es leíble: _contratos/decisiones-en-codigo.json');
console.log('   ✔ no se reescribió ningún script: esta fase solo declara');
console.log('   ' + (rc.length ? '🔴' : '✔') + ' columnas repetidas en 4+ scripts: ' + rc.length + '  ← cada una es un sitio donde el sistema se puede desincronizar');
console.log('\n  → _contratos/decisiones-en-codigo.json');
