// E0.3.99 · ¿lib-quincena RESUELVE LA DEUDA D2? — adversarial.
//
// 🔴 LA PRUEBA NO ES «la función corre». Es: **¿el reporte y el catálogo ya se pueden cruzar?**
//    Antes: 0 de 86. Esa es la cifra que tiene que moverse.
//
// Y los ataques importan tanto como la travesía: una función que normaliza DEMASIADO es peor que
// una que normaliza poco — convertir a la fuerza un valor que no se entiende mete un dato falso
// en la llave, y a partir de ahí todo cruza con la fila equivocada.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var ES = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(56) + e); c ? ok++ : mal++; }

console.log('════════ E0.3.99 · LA QUINCENA ════════\n');
console.log('   regla:   ' + Q.REGLA);
console.log('   formato: ' + Q.FORMATO + '\n');

// ══ 1 · LA REGLA · día 1–15 = Q1 · 16–fin = Q2
console.log('══ 1 · la regla, en los bordes ══');
[['2026-08-01', '2026-08-Q1', 'primer día del mes'],
 ['2026-08-15', '2026-08-Q1', '🔴 el 15 es Q1 — el borde que Rick fijó'],
 ['2026-08-16', '2026-08-Q2', '🔴 el 16 ya es Q2'],
 ['2026-08-31', '2026-08-Q2', 'último día'],
 ['2026-02-28', '2026-02-Q2', 'febrero'],
 ['7/13/2026', '2026-07-Q1', 'formato M/D/AAAA de SFMC'],
 ['7/27/2026', '2026-07-Q2', 'M/D/AAAA, segunda quincena'],
 ['25/12/2026', '2026-12-Q2', 'D/M/AAAA — el 25 no puede ser mes']
].forEach(function (c) {
  var r = Q.deFecha(c[0]);
  chk(c[0] + ' → ' + c[1], r === c[1], (r || 'null') + '   ' + c[2]);
});

// ══ 2 · NORMALIZAR los dos formatos que hoy conviven
console.log('\n══ 2 · los dos formatos que rompían el cruce ══');
[['Mar-Q1-2026', '2026-03-Q1', 'el del REPORTE'],
 ['2026-03-Q1', '2026-03-Q1', 'el del CATÁLOGO (canónico)'],
 ['Ago-Q2-2026', '2026-08-Q2', ''],
 ['Dic-Q2-2026', '2026-12-Q2', 'diciembre, que en inglés sería Dec'],
 ['2026-Mar-Q1', '2026-03-Q1', 'otra variante']
].forEach(function (c) {
  var r = Q.normalizar(c[0]);
  chk('«' + c[0] + '» → ' + c[1], r === c[1], (r || 'null') + '   ' + c[2]);
});

// ══ 3 · LOS ATAQUES · normalizar de más es peor que normalizar de menos
console.log('\n══ 3 · ataques · lo que NO debe convertir ══');
[['', 'vacío'], ['N/A', 'un no-aplica'], ['PENDIENTE', 'un pendiente'],
 ['Q1', 'sin año ni mes'], ['2026', 'solo el año'], ['Trimestre 1', 'otra granularidad'],
 ['2026-13-Q1', 'mes 13'], ['2026-03-Q3', 'no existe Q3'], ['basura', 'texto suelto']
].forEach(function (c) {
  var r = Q.normalizar(c[0]);
  chk('«' + c[0] + '» NO se convierte', r === null, (r === null ? 'devuelve null ✔' : '🔴 devolvió ' + r) + '   ' + c[1]);
});

// ══ 4 · LA TRAVESÍA · ¿ya cruzan el reporte y el catálogo?
console.log('\n══ 4 · 🔴 LA DEUDA D2 · ¿cruzan reporte y catálogo? ══');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false })
  .filter(function (r) { return t(r['Campaña']) && !/^total/i.test(t(r['Campaña'])); });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var idx = {};
P.forEach(function (p) {
  var q = Q.normalizar(ES.campo(p, 'Quincena', 'Quincena_Lanzamiento'));
  idx[t(p['Campaña']) + '|' + t(ES.campo(p,'TouchPoint','Touchpoint')) + '|' + t(p['Segmento']) + '|' + (q || '')] = 1;
});
var crudo = 0, norm = 0;
R.forEach(function (r) {
  var base = t(r['Campaña']) + '|' + t(r['TouchPoint']) + '|' + t(r['Segmento']) + '|';
  if (idx[base + t(ES.campo(r, 'Quincena', 'Quincena_Lanzamiento'))]) crudo++;
  var q = Q.normalizar(ES.campo(r, 'Quincena', 'Quincena_Lanzamiento'));
  if (q && idx[base + q]) norm++;
});
console.log('      sin normalizar : ' + crudo + ' de ' + R.length + '   ← así estaba');
console.log('      normalizando   : ' + norm + ' de ' + R.length);
chk('normalizar mejora el cruce', norm > crudo, 'de ' + crudo + ' a ' + norm + ' filas');
// las que aún no cruzan, ¿por qué?
var faltan = R.filter(function (r) {
  var q = Q.normalizar(ES.campo(r, 'Quincena', 'Quincena_Lanzamiento'));
  return !(q && idx[t(r['Campaña']) + '|' + t(r['TouchPoint']) + '|' + t(r['Segmento']) + '|' + q]);
});
var porQue = {};
faltan.forEach(function (r) {
  var k = /whats/i.test(t(r['Medio'])) ? 'WhatsApp (su pieza no tiene esas dimensiones)'
    : (!Q.normalizar(ES.campo(r, 'Quincena', 'Quincena_Lanzamiento')) ? 'quincena vacía o no reconocida'
    : 'la combinación no existe en el catálogo');
  porQue[k] = (porQue[k] || 0) + 1;
});
console.log('\n      las ' + faltan.length + ' que aún no cruzan:');
Object.keys(porQue).sort(function (a, b) { return porQue[b] - porQue[a]; })
  .forEach(function (k) { console.log('        ' + String(porQue[k]).padStart(3) + '  ' + k); });

// ══ 5 · el orden alfabético == el cronológico (la razón de elegir AAAA-MM-Qn)
console.log('\n══ 5 · ¿el formato ordena bien? ══');
var revueltas = ['2026-12-Q1', '2026-01-Q2', '2026-03-Q1', '2026-01-Q1', '2026-10-Q2'];
var ordenadas = revueltas.slice().sort();
chk('ordenar como texto == ordenar cronológicamente',
  ordenadas.join(',') === '2026-01-Q1,2026-01-Q2,2026-03-Q1,2026-10-Q2,2026-12-Q1',
  ordenadas.join(' · '));

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
