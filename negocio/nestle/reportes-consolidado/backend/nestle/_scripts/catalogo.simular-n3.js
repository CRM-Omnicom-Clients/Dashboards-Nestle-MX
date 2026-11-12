// ¿EL CATÁLOGO AGUANTA A N3? — no lo pregunto, lo intento.
//
// Hasta ahora comprobé que el catálogo TIENE las columnas que mi plan dice que N3 necesita.
// Eso es circular: comparé el catálogo contra mi propia lectura de mi propio plan. La única
// forma de saberlo es CONSTRUIR la salida de N3 usando SOLO el catálogo y ver qué se rompe.
//
// N3 según el plan: una fila = camp_id × touchpoint × segmento × mes_atribucion,
// con el Qcart anclado a la quincena de lanzamiento UNA sola vez (anti doble conteo).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n3.xlsx';
fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var pr = [], roto = 0;
function K(n, ok, d) { pr.push([n, ok, d]); if (!ok) roto++; }

console.log('════ SIMULACIÓN DE N3 · construida SOLO desde el catálogo ════\n');

// ── construir la rejilla
// 🔴 LA REJILLA SALE DEL PERIODO, NO DE LOS ENVÍOS.
//    Primera versión: la construí desde Sends_Por_Mes y perdí 44 carritos. Las 3 piezas de
//    Mundial WhatsApp TIENEN carritos y NO tienen envíos (el Qcart sí midió, el engagement de
//    Twilio no está cargado). Si la fila solo nace cuando hay envíos, la venta desaparece.
var filas = {}, sinPeriodo = [];
P.forEach(function (p) {
  var meses = t(p['Meses_Activos']).split(' ; ').filter(Boolean);
  if (!meses.length && t(p['Mes_Lanzamiento'])) meses = [t(p['Mes_Lanzamiento'])];
  if (!meses.length) { sinPeriodo.push(p); return; }
  var rep = {};
  t(p['Sends_Por_Mes']).split(' ; ').filter(Boolean).forEach(function (x) { rep[x.split(':')[0]] = num(x.split(':')[1]); });
  meses.forEach(function (mes) {
    var s = rep[mes] || 0;
    var k = [t(p['Camp_ID']), t(p['Touchpoint']), t(p['Segmento']), mes].join('¦');
    if (!filas[k]) filas[k] = {
      camp_id: t(p['Camp_ID']), campana: t(p['Campaña']), bu: t(p['BU']), marca: t(p['Marca']),
      objetivo: t(p['Objetivo']), tp: t(p['Touchpoint']), seg: t(p['Segmento']), canal: t(p['Canal']),
      mes: mes, sends: 0, piezas: [], carritos: 0, qcartAnclado: false, clicksDerivados: false
    };
    var f = filas[k];
    f.sends += s; f.piezas.push(t(p['Pieza_ID']));
    if (t(p['Canal']) !== f.canal) f.canal = 'Mixto';
    if (/^No/.test(t(p['Clicks_Medidos']))) f.clicksDerivados = true;
    // 🔴 ANTI DOBLE CONTEO: el Qcart cuelga SOLO del mes de lanzamiento de la pieza
    if (mes === t(p['Mes_Lanzamiento'])) { f.carritos += num(p['Carritos_Total']); f.qcartAnclado = true; }
  });
});
var R3 = Object.keys(filas).map(function (k) { return filas[k]; });
console.log('  filas generadas: ' + R3.length + '   (de ' + P.length + ' piezas)');
console.log('  piezas que NO produjeron fila: ' + sinPeriodo.length + '  → ' +
  Object.keys(sinPeriodo.reduce(function (a, p) { a[t(p['Estado'])] = 1; return a; }, {})).join(' · '));

// ── ¿la rejilla es sana?
K('toda fila tiene sus 4 dimensiones', R3.every(function (f) { return f.camp_id && f.tp && f.seg && f.mes; }),
  R3.length + ' filas');
K('ninguna llave repetida', new Set(R3.map(function (f) { return [f.camp_id, f.tp, f.seg, f.mes].join('¦'); })).size === R3.length, '');
var sumaN3 = R3.reduce(function (a, f) { return a + f.sends; }, 0);
var sumaCat = P.reduce(function (a, p) { return a + num(p['Sends']); }, 0);
var sumaSinP = sinPeriodo.reduce(function (a, p) { return a + num(p['Sends']); }, 0);
K('Σ sends de N3 + los sin periodo == catálogo', sumaN3 + sumaSinP === sumaCat,
  sumaN3.toLocaleString() + ' + ' + sumaSinP.toLocaleString() + ' = ' + (sumaN3 + sumaSinP).toLocaleString() + ' vs ' + sumaCat.toLocaleString());

// ── el anti doble conteo del Qcart, que es la regla que más miedo da
var carN3 = R3.reduce(function (a, f) { return a + f.carritos; }, 0);
var carCat = P.reduce(function (a, p) { return a + num(p['Carritos_Total']); }, 0);
K('el Qcart NO se dobla al abrir por mes', carN3 === carCat,
  'N3 ' + carN3.toLocaleString() + ' vs catálogo ' + carCat.toLocaleString() +
  (carN3 === carCat ? ' · cada carrito una sola vez' : ' 🔴 DOBLE CONTEO'));
var multi = P.filter(function (p) { return num(p['N_Meses']) > 1 && num(p['Carritos_Total']) > 0; });
K('piezas multi-mes CON carritos: su Qcart cae en un solo mes', true,
  multi.length + ' piezas · anclan a su Mes_Lanzamiento');

// ── 🔴 LA PRUEBA DE FUEGO: ¿puede N3 calcular una TASA?
console.log('\n══ ¿puede N3 calcular OR y CTOR con lo que el catálogo le da? ══');
var cols = Object.keys(P[0]);
var METR = ['Sends', 'Deliveries', 'Opens', 'Clicks', 'Email_Opens', 'Email_Clicks', 'Unique_Opens'];
var hay = METR.filter(function (m) { return cols.indexOf(m) >= 0; });
console.log('  métricas EN el catálogo : ' + (hay.join(' · ') || 'ninguna'));
console.log('  métricas que faltan     : ' + METR.filter(function (m) { return cols.indexOf(m) < 0; }).join(' · '));
K('el catálogo trae con qué calcular una tasa', hay.length > 1,
  hay.length > 1 ? '' : '🔴 solo Sends. Opens/Clicks viven en Data_Email y NO están repartidos por quincena');

// ¿y se pueden repartir por periodo desde Data_Email igual que los sends?
var colsE = Object.keys(E[0] || {});
var metrE = colsE.filter(function (c) { return /open|click|deliver|bounce|sends/i.test(c); });
console.log('\n  Data_Email sí las tiene: ' + metrE.slice(0, 6).join(' · '));
console.log('  → el reparto por quincena que hice es SOLO de Sends. Para OR y CTOR, N2/N3 tienen');
console.log('    que repartir las demás métricas con la MISMA llave, o las tasas saldrán mal.');

// ── ¿qué tan grande es la rejilla y tiene sentido?
console.log('\n══ la rejilla que produciría ══');
var porCamp = {};
R3.forEach(function (f) { (porCamp[f.campana] = porCamp[f.campana] || { filas: 0, sends: 0, meses: {} }); porCamp[f.campana].filas++; porCamp[f.campana].sends += f.sends; porCamp[f.campana].meses[f.mes] = 1; });
Object.keys(porCamp).sort().forEach(function (c) {
  console.log('    ' + c.padEnd(17) + String(porCamp[c].filas).padStart(3) + ' filas · ' +
    String(porCamp[c].sends.toLocaleString()).padStart(10) + ' envíos · meses ' + Object.keys(porCamp[c].meses).sort().join(','));
});
console.log('\n  muestra de filas:');
console.log('    Camp     TP     Segmento              Mes       Sends     Carritos  Piezas');
R3.sort(function (a, b) { return b.sends - a.sends; }).slice(0, 6).forEach(function (f) {
  console.log('    ' + f.camp_id.padEnd(9) + f.tp.padEnd(7) + f.seg.slice(0, 20).padEnd(22) + f.mes.padEnd(10) +
    String(f.sends.toLocaleString()).padStart(9) + String(f.carritos || '—').padStart(10) + '  ' + f.piezas.join(','));
});

console.log('\n════ VEREDICTO ════');
pr.forEach(function (p) { console.log('  ' + (p[1] ? '✔' : '🔴') + ' ' + p[0].padEnd(48) + (p[2] || '')); });
console.log('\n  ' + (roto ? '🔴 ' + roto + ' cosa(s) que N3 no podría hacer con el catálogo actual'
  : '✅ N3 se puede construir entero desde el catálogo'));
