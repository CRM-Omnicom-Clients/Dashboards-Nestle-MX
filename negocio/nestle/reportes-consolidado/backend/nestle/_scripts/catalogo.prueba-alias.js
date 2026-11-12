// ¿SE CONFUNDE CON LOS ALIAS CUANDO LLEGAN NUEVOS? — la pregunta de Rick, puesta a prueba.
// Usa el resolvedor REAL del backend (lib-alias.js), no una copia hecha para la prueba:
// probar una copia no prueba nada del sistema que sí va a correr.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(__dirname + '/lib-alias.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var T = require('path').resolve(__dirname, '..') + '/_tmp/_pa.xlsx';
fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var IX = A.indexar(R);
var errores = 0;

console.log('══════ LA ESCALERA DE ALIAS ══════');
console.log('  0 ya es canónico · 1 campaña·segmento · 2 campaña · 3 utm (namespace) · 4 global · 5 pendiente\n');
console.log('  índice:  específicos ' + Object.keys(IX.espec).length + '  ·  por campaña ' + Object.keys(IX.camp).length +
  '  ·  utm ' + Object.keys(IX.ns).length + '  ·  globales ' + Object.keys(IX.global).length +
  '  ·  vocabulario ' + Object.keys(IX.voc).length + ' dims  ·  excluidos ' + Object.keys(IX.excl).length + '\n');

// CASOS reales — cada uno con lo que DEBE pasar. `null` = debe quedar pendiente.
var CASOS = [
  { d: 'Touchpoint', c: 'N/A', camp: 'AON', seg: 'Career Focused', esp: 'E-P4', dice: 'grafía ambigua, la salva el segmento' },
  { d: 'Touchpoint', c: 'N/A', camp: 'AON', seg: 'New Parents', esp: 'E-P3', dice: 'MISMA grafía, otro segmento, otro destino' },
  { d: 'Touchpoint', c: 'N/A', camp: 'AON', seg: 'Traditional Parents', esp: 'E-P1', dice: 'y un tercero' },
  { d: 'Touchpoint', c: 'Único', camp: 'Hotcakes', seg: 'Prácticos', esp: 'WA-C2', dice: 'lo mismo en WhatsApp de Hotcakes' },
  { d: 'Touchpoint', c: 'Partido 1', camp: 'Mundial', seg: 'Bebidas', esp: 'E-P1', dice: 'alias normal, por campaña' },
  { d: 'Touchpoint', c: 'Partido 1', camp: 'Liga MX', seg: 'Bebidas', esp: null, dice: 'MISMA grafía, OTRA campaña → no la inventa' },
  { d: 'Segmento', c: 'botanas', camp: '', seg: '', esp: 'Botana', dice: 'plural (viene del utm_term)' },
  { d: 'Segmento', c: 'BOTANA', camp: '', seg: '', esp: 'Botana', dice: 'mayúsculas' },
  { d: 'Segmento', c: '  Botana ', camp: '', seg: '', esp: 'Botana', dice: 'espacios de sobra' },
  { d: 'Segmento', c: 'Interes Salado', camp: '', seg: '', esp: 'Interés Salado', dice: 'sin acento' },
  { d: 'Segmento', c: 'tradicional parents', camp: '', seg: '', esp: 'Traditional Parents', dice: 'error de dedo que ya vino en el dato' },
  { d: 'Touchpoint', c: 'e-bebida7', camp: 'Mundial', seg: 'Bebidas', esp: null, dice: '🆕 NUNCA VISTO → debe frenar' },
  { d: 'Segmento', c: 'Cluster Fantasma', camp: '', seg: '', esp: null, dice: '🆕 NUNCA VISTO → debe frenar' }
];
CASOS.forEach(function (k) {
  var r = A.resolver(IX, k.d, k.c, k.camp, k.seg);
  var bien = (r.v || null) === k.esp;
  if (!bien) errores++;
  console.log('  ' + (bien ? '✔' : '🔴') + ' ' + (k.d + ' «' + k.c + '»').padEnd(30) +
    (k.camp ? (k.camp + (k.seg ? ' · ' + k.seg : '')) : '—').slice(0, 30).padEnd(32) +
    '→ ' + (r.v || '⛔ pendiente').padEnd(21) + '[' + r.por + ']');
  console.log('       ' + k.dice + (bien ? '' : '   🔴 esperaba: ' + (k.esp || 'pendiente')));
});

// ── la prueba de verdad: ¿la escalera reproduce las 96 piezas del catálogo?
console.log('\n══ la escalera contra las piezas reales ══');
var mal = [], conAlias = 0;
P.forEach(function (p) {
  var raw = t(p['Touchpoint_Raw']).split(' · ')[0];
  if (!raw || raw === t(p['Touchpoint'])) return;
  conAlias++;
  var r = A.resolver(IX, 'Touchpoint', raw, t(p['Campaña']), t(p['Segmento']));
  if (r.v !== t(p['Touchpoint'])) mal.push(t(p['Pieza_ID']) + ' ' + raw + '→' + (r.v || '⛔') + ' vs ' + t(p['Touchpoint']));
});
console.log('  ' + (mal.length ? '🔴 ' + mal.length + ' no reproducen: ' + mal.slice(0, 3).join(' · ')
  : '✔ las ' + conAlias + ' piezas con grafía distinta se reproducen por la escalera'));
if (mal.length) errores++;

// ── y los segmentos: ¿cada segmento de cada pieza es alcanzable desde su grafía cruda?
var malS = [];
P.forEach(function (p) {
  var s = t(p['Segmento']); if (!s || s === 'Segmentos_Combinados') return;
  var r = A.resolver(IX, 'Segmento', s, t(p['Campaña']), '');
  if (r.v !== s) malS.push(t(p['Pieza_ID']) + ' ' + s + '→' + (r.v || '⛔'));
});
console.log('  ' + (malS.length ? '🔴 ' + malS.length + ' segmentos no se resuelven: ' + malS.slice(0, 3).join(' · ')
  : '✔ los ' + P.length + ' segmentos de las piezas se resuelven contra el vocabulario'));
if (malS.length) errores++;

// ── coherencia interna del catálogo de alias
console.log('\n══ ¿el catálogo de alias puede contradecirse a sí mismo? ══');
var fantasma = [];
R.filter(function (r) { return /^alias/.test(t(r['Tipo'])); }).forEach(function (r) {
  var d = t(r['Dimension']), c = t(r['Valor_Canonico']);
  if (IX.voc[d] && !IX.voc[d][c]) fantasma.push(d + ' «' + t(r['Valor_Crudo']) + '» → ' + c);
});
console.log('  ' + (fantasma.length ? '🔴 ' + fantasma.length + ' apuntan fuera del vocabulario: ' + fantasma.slice(0, 4).join(' · ')
  : '✔ ningún alias apunta fuera del vocabulario'));
if (fantasma.length) errores++;

var vistos = {}, pelea = [];
R.filter(function (r) { return /^alias/.test(t(r['Tipo'])); }).forEach(function (r) {
  var k = t(r['Dimension']) + '¦' + t(r['Contexto']) + '¦' + A.nm(r['Valor_Crudo']);
  if (vistos[k] && vistos[k] !== t(r['Valor_Canonico'])) pelea.push(k.replace(/¦/g, ' » ') + ': ' + vistos[k] + ' vs ' + t(r['Valor_Canonico']));
  vistos[k] = t(r['Valor_Canonico']);
});
console.log('  ' + (pelea.length ? '🔴 ' + pelea.length + ' colisiones: ' + pelea.slice(0, 3).join(' · ')
  : '✔ cada (dimensión · contexto · grafía) tiene UN solo destino'));
if (pelea.length) errores++;

console.log('\n  ' + (errores ? '🔴 ' + errores + ' problema(s) de alias'
  : '✅ la escalera no se confunde: lo ambiguo lo salva el contexto, y lo que no conoce lo FRENA'));
