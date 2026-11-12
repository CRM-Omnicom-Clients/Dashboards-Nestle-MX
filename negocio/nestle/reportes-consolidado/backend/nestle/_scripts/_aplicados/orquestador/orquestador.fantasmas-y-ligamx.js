// S0b · QUÉ HAY DENTRO DE LAS COLUMNAS FANTASMA, Y CÓMO ESTÁ LIGA MX.
//
// 🔴 LA REGLA DE RICK (25-ago): «cuando es la vieja y la nueva **siempre se quedan ambos**. O
//    varios.» Fusionar NO es elegir un valor: la columna única se queda con **todos** los valores
//    distintos que existían. Por eso este paso no pregunta «cuál gana» — cuenta cuántas filas
//    tendrían que llevar dos valores, para que la fusión se vea antes de hacerse.
//
// 🔴 Y LIGA MX: Rick lo dijo dos veces — **tiene sus segmentos y su Qcart SEPARADOS**. Aquí solo
//    se mide cómo está hoy; agrupar o no agrupar lo decide su skill, no este inventario.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);

console.log('════════ S0b · FANTASMAS Y LIGA MX ════════\n');

// ── 1 · las dos parejas de fantasma, celda por celda
var PAREJAS = [
  { hoja: 'Catalogo_Piezas', viva: 'Email_ID (de la DE de SFMC)', fantasma: 'EmailID' },
  { hoja: 'Catalogo_Piezas', viva: 'Email_Name', fantasma: 'Email_Name_Legacy (duplicada, no usar)' }
];
var plan = [];
PAREJAS.forEach(function (p) {
  var F = XLSX.utils.sheet_to_json(wb.Sheets[p.hoja], { defval: '', blankrows: false });
  var iguales = 0, soloViva = 0, soloFant = 0, distintos = [], ninguno = 0;
  F.forEach(function (f, i) {
    var a = t(f[p.viva]), b = t(f[p.fantasma]);
    if (!a && !b) { ninguno++; return; }
    if (a && !b) { soloViva++; return; }
    if (!a && b) { soloFant++; return; }
    if (a === b) { iguales++; return; }
    distintos.push({ fila: i + 2, pieza: t(f['Pieza_ID']), viva: a, fantasma: b });
  });
  console.log('  ══ «' + p.fantasma + '»  →  «' + p.viva + '» ══');
  console.log('     filas: ' + F.length);
  console.log('     iguales (la fantasma no aporta):     ' + iguales);
  console.log('     solo en la VIVA:                     ' + soloViva);
  console.log('     🔴 solo en la FANTASMA (se perderían si se borra): ' + soloFant);
  console.log('     🔴 DISTINTOS (la celda se queda con LOS DOS):      ' + distintos.length);
  distintos.slice(0, 6).forEach(function (d) {
    console.log('          fila ' + d.fila + '  ' + d.pieza.padEnd(10) + 'viva=«' + d.viva + '»  fantasma=«' + d.fantasma + '»');
  });
  console.log('     ninguna de las dos:                  ' + ninguno);
  console.log('     → la fusión toca ' + (soloFant + distintos.length) + ' celda(s); las otras ' + (iguales + soloViva) + ' no cambian\n');
  plan.push({ pareja: p, iguales: iguales, soloViva: soloViva, soloFantasma: soloFant, distintos: distintos, ninguno: ninguno });
});

// ── 2 · Liga MX: sus segmentos y su Qcart
console.log('  ══ LIGA MX ══');
var cat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var liga = cat.filter(function (r) { return /liga\s*mx/i.test(t(r['Campaña']) + ' ' + t(r['Marca']) + ' ' + t(r['Email_Name'])); });
console.log('     piezas en el catálogo: ' + liga.length);
var segs = {}, tps = {}, objs = {};
liga.forEach(function (r) { segs[t(r['Segmento']) || '(vacío)'] = (segs[t(r['Segmento']) || '(vacío)'] || 0) + 1; tps[t(r['TouchPoint'])] = 1; objs[t(r['Objetivo'])] = 1; });
console.log('     segmentos distintos: ' + Object.keys(segs).length + '  →  ' + Object.keys(segs).map(function (s) { return '«' + s + '» ×' + segs[s]; }).join(' · '));
console.log('     touchpoints: ' + Object.keys(tps).join(' · '));
console.log('     objetivos:   ' + Object.keys(objs).join(' · '));

var rr = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var ligaR = rr.filter(function (r) { return /liga\s*mx/i.test(t(r['Campaña'])); });
console.log('     filas en Report_Resumen: ' + ligaR.length);
ligaR.forEach(function (r) {
  console.log('        ' + t(r['TouchPoint']).padEnd(10) + t(r['Segmento']).slice(0, 34).padEnd(36) +
    'qcart=' + (t(r['Carritos_Total']) || '—').padEnd(7) + ' QCART?=' + t(r['QCART?']));
});
// y en los carritos
var car = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart_Carritos'], { defval: '', blankrows: false });
var ligaC = car.filter(function (r) { return /liga\s*mx/i.test(t(r['Campaña'])); });
var segC = {}; ligaC.forEach(function (r) { segC[t(r['Segmento']) || '(vacío)'] = (segC[t(r['Segmento']) || '(vacío)'] || 0) + 1; });
console.log('     eventos en Data_Qcart_Carritos: ' + ligaC.length +
  (Object.keys(segC).length ? '  ·  por segmento: ' + Object.keys(segC).map(function (s) { return '«' + s + '» ' + segC[s]; }).join(' · ') : ''));

fs.writeFileSync(BACK + '/_contratos/fusion-fantasmas.json', JSON.stringify({
  paso: 'S0b', regla: 'vieja y nueva: SE QUEDAN AMBOS (Rick, 25-ago). Fusionar no es elegir.',
  parejas: plan
}, null, 1));
console.log('\n  → _contratos/fusion-fantasmas.json');
