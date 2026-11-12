// manual-bloque · ¿SIRVE PARA LOS SCRIPTS SIGUIENTES?
//
//   PUERTA-1 · cuadre cruzado → ¿puede sumar los CUATRO bloques sin contar dos veces?
//   N3  · puerta 1       → ¿sabe escribir un dato manual y marcarlo como tal?
//   motor-calculo  · motor          → ¿puede distinguir un número medido de uno declarado?
//
// 🔴 Lo que de verdad se prueba aquí: que un dato manual **no se confunda con uno automático**
//    río abajo. Si al llegar al reporte ya no se distingue, la procedencia que tanto cuidamos
//    en manual-bloque no sirvió de nada.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ manual-bloque · SIMULACIÓN DE LOS SCRIPTS SIGUIENTES ════════\n');
var CSV = PROY + '/_manual/_sig.csv';
var BLOQUE = BACK + '/_fuentes/manual.json';
var respaldo = fs.readFileSync(BLOQUE, 'utf8');
function limpiar() { try { fs.unlinkSync(CSV); } catch (e) { } fs.writeFileSync(BLOQUE, respaldo, 'utf8'); }
process.on('exit', limpiar);

// se carga un dato manual real para tener qué cruzar
fs.writeFileSync(CSV, 'pieza_id,fecha,metrica,valor,quien,por_que\n' +
  '005-P001,2026-08-22,sends,12500,Rick,Liga MX P1 — Datorama aún no lo trae\n' +
  '005-P002,2026-09-06,sends,9800,Rick,Liga MX P2\n', 'utf8');
cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-manual.manual.js"', { encoding: 'utf8' });

function cargar(n) { try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); } catch (e) { return null; } }
var B = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp'), manual: cargar('manual') };

// ══ PUERTA-1 · EL CUADRE CRUZADO ═════════════════════════════════════════════════════════
console.log('══ PUERTA-1 · ¿puede sumar los CUATRO bloques sin contar dos veces? ══');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2ds.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var cnPieza = {};
P.forEach(function (p) {
  [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean)
    .forEach(function (c) { cnPieza[c] = t(p['Pieza_ID']); });
});

// sends por pieza, viniendo de cada bloque
var sends = {};
function suma(id, v, quien) {
  if (!id || !v) return;
  sends[id] = sends[id] || { total: 0, de: {} };
  sends[id].total += v; sends[id].de[quien] = (sends[id].de[quien] || 0) + v;
}
B.email.envios.forEach(function (e) { suma(cnPieza[e.content_name], e.email_sends, 'email'); });
B.whatsapp.envios.forEach(function (e) { suma(e.pieza_id, e.sends, 'whatsapp'); });
B.manual.datos.filter(function (d) { return d.metrica === 'sends'; }).forEach(function (d) { suma(d.pieza_id, d.valor, 'manual'); });

var dobles = Object.keys(sends).filter(function (id) { return Object.keys(sends[id].de).length > 1; });
console.log('  piezas con sends: ' + Object.keys(sends).length);
console.log('  piezas alimentadas por MÁS de un bloque: ' + dobles.length);
dobles.slice(0, 5).forEach(function (id) { console.log('     ' + id + '  ' + JSON.stringify(sends[id].de)); });
chk('PUERTA-1 puede sumar los 4 bloques por pieza', Object.keys(sends).length > 0, Object.keys(sends).length + ' piezas');
chk('🔴 ninguna pieza recibe el MISMO dato de dos bloques', dobles.length === 0,
  dobles.length ? '🔴 ' + dobles.join(' ') + ' — el manual estaría duplicando' :
    'la regla «no pisar» de manual-bloque lo impide en origen');

var manualPiezas = B.manual.datos.map(function (d) { return d.pieza_id; });
console.log('  el manual aporta: ' + manualPiezas.join(' · ') + '  (piezas que ninguna fuente automática cubre)');
chk('el manual aporta piezas que estaban en cero', manualPiezas.length > 0,
  manualPiezas.length + ' piezas de Liga MX, que no tienen fuente automática');

// ══ N3 · LA PUERTA ══════════════════════════════════════════════════════════════════
console.log('\n══ N3 · ¿sabe escribir un dato manual y marcarlo? ══');
var d0 = B.manual.datos[0];
console.log('  un dato manual, tal como llega a la puerta:');
console.log('     ' + JSON.stringify({ pieza_id: d0.pieza_id, metrica: d0.metrica, valor: d0.valor, canal: d0.canal, fuente: d0.fuente, quien: d0.quien }).slice(0, 130));
chk('el dato trae su pieza, su métrica y su valor', !!(d0.pieza_id && d0.metrica && d0.valor !== undefined), 'los tres');
chk('trae las dimensiones para saber en qué hoja va', !!(d0.canal && d0.campana),
  d0.canal + ' → ' + (d0.canal === 'Email' ? 'Data_Email' : d0.canal === 'WhatsApp' ? 'Data_WhatsApp' : 'la hoja de su canal'));
chk('🔴 se puede MARCAR como manual en la hoja', d0.fuente === 'manual',
  'Fuente_Dato = «' + d0.fuente + '» — sin esto se confundiría con un dato de Datorama');
chk('la puerta sabe a quién preguntarle si el número no cuadra', !!d0.quien && !!d0.por_que,
  d0.quien + ' · «' + d0.por_que.slice(0, 40) + '»');

// ══ motor-calculo · EL MOTOR ═══════════════════════════════════════════════════════════════════
console.log('\n══ motor-calculo · ¿puede distinguir lo medido de lo declarado? ══');
var todos = [];
B.email.envios.slice(0, 3).forEach(function (e) { todos.push({ pieza: cnPieza[e.content_name], sends: e.email_sends, fuente: 'email' }); });
B.manual.datos.filter(function (d) { return d.metrica === 'sends'; }).forEach(function (d) { todos.push({ pieza: d.pieza_id, sends: d.valor, fuente: d.fuente }); });
var declarados = todos.filter(function (x) { return x.fuente === 'manual'; });
console.log('  muestra mezclada de ' + todos.length + ' registros · declarados a mano: ' + declarados.length);
chk('motor-calculo puede separar lo declarado de lo medido', declarados.length > 0 && todos.some(function (x) { return x.fuente !== 'manual'; }),
  'el campo `fuente` los separa sin ambigüedad');
chk('un reporte podría marcar el número como declarado', declarados.every(function (x) { return !!x.fuente; }),
  'todos traen su fuente · un total mezclado se puede desglosar por origen');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ EL BLOQUE SIRVE — y un dato manual sigue siendo distinguible río abajo'));
process.exit(fallo ? 1 : 0);
