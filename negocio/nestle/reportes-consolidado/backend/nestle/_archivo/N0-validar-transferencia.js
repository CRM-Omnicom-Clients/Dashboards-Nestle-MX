// ¿EL PLAN DE TRANSFERENCIA ESTÁ COMPLETO? — no se responde a ojo, se cruza.
//
// Tres preguntas:
//   1. ¿Cada pieza del sistema VIEJO tiene un paso nuevo que la absorbe?  (huérfanos)
//   2. ¿Cada paso nuevo viene de algo, o me lo inventé?                   (invención)
//   3. ¿La salida de un paso es la entrada del siguiente?                 (cadena rota)
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var t = function (v) { return String(v == null ? '' : v).trim(); };

// ── LO QUE DICE MI TABLA que absorbe cada paso (transcrito del artifact)
var PLAN = {
  'N0 Respaldo':            { viene: [], sale: ['git'], entra: [] },
  'N1 Insumos':             { viene: ['agent-insumos.md', 'validar-insumos.js', 'mapa-fuente.js'], sale: ['_insumos/inventario.json'], entra: ['descargas'] },
  'N2a Bloque Email':       { viene: ['agent-datos-email.md', 'contrato-fuente-email.md', 'guardian-fuente-email.js'], sale: ['_fuentes/email.json'], entra: ['_insumos/inventario.json'] },
  'N2b Bloque Qcart':       { viene: ['agent-datos-qcart.md', 'contrato-fuente-qcart.md', 'guardian-fuente-qcart.js', 'qcart-consolidar.js'], sale: ['_fuentes/qcart.json'], entra: ['_insumos/inventario.json'] },
  'N2c Bloque WhatsApp':    { viene: ['agent-datos-whatsapp.md', 'contrato-fuente-whatsapp.md', 'guardian-fuente-whatsapp.js'], sale: ['_fuentes/whatsapp.json'], entra: ['_insumos/inventario.json'] },
  'N2d Bloque Manual':      { viene: [], sale: ['_fuentes/manual.json'], entra: [] },
  'N2v Cuadre cruzado':     { viene: ['correr-guardianes.js', 'guardian-base.js'], sale: ['veredicto'], entra: ['_fuentes/email.json', '_fuentes/qcart.json', '_fuentes/whatsapp.json', '_fuentes/manual.json'] },
  'N3 Escribir datos':      { viene: ['xlsx-apply.js', 'xlsx-kit.js', 'xlsx-safe-save.js', 'xlsx-check.js', 'xlsx-label.js', '_qcart-escribir.js'], sale: ['Data_* escritas'], entra: ['_fuentes/email.json', '_fuentes/qcart.json', '_fuentes/whatsapp.json', '_fuentes/manual.json'] },
  'N4 Catálogo':            { viene: ['agent-normalizador.md', 'contrato-catalogo.md', 'guardian-catalogo.js', 'catalogo-links.js'], sale: ['_catalogo/catalogo.json'], entra: ['Data_* escritas'] },
  'N5 Motor':               { viene: ['_motor-filas.js', 'guardian-base.js'], sale: ['_motor/filas.json'], entra: ['_fuentes/email.json', '_catalogo/catalogo.json'] },
  'N6a Rep Resumen':        { viene: ['agent-reporte-resumen.md', 'contrato-report-resumen.md', 'guardian-report-resumen.js', '_resumen.js'], sale: ['_reportes/resumen.json'], entra: ['_motor/filas.json'] },
  'N6b Rep Campana-Mes':    { viene: ['agent-reporte-campana-mes.md', 'contrato-report-campana-mes.md', 'guardian-report-campana-mes.js', '_campana-mes.js'], sale: ['_reportes/campana-mes.json'], entra: ['_motor/filas.json'] },
  'N6c Rep Qcart':          { viene: ['agent-reporte-completoqcart.md', 'contrato-report-completoqcart.md', 'guardian-report-completoqcart.js', 'qcart-desde-catalogo.js'], sale: ['_reportes/qcart-completo.json'], entra: ['_motor/filas.json', '_fuentes/qcart.json'] },
  'N6d Insights':           { viene: ['agent-reporte-insights.md', 'agent-insights-resumen.md', 'contrato-report-insights.md', 'guardian-report-insights.js'], sale: ['_reportes/insights.json'], entra: ['_motor/filas.json'] },
  'N6v Refutacion':         { viene: ['agent-refutador.md'], sale: ['veredicto'], entra: ['_reportes/resumen.json', '_reportes/campana-mes.json', '_reportes/qcart-completo.json', '_reportes/insights.json'] },
  'N7 Escribir reportes':   { viene: ['xlsx-apply.js', 'xlsx-kit.js', 'xlsx-crear-hoja.js', 'xlsx-sanear-rangos.js'], sale: ['Report_* escritas'], entra: ['_reportes/resumen.json', '_reportes/campana-mes.json', '_reportes/qcart-completo.json', '_reportes/insights.json'] },
  'N8 Publicacion':         { viene: ['agent-publicacion.md', 'guardian-llegada.js'], sale: ['destinos'], entra: ['Report_* escritas'] },
  'N9 Orquestador':         { viene: ['correr-guardianes.js', 'auditar-agentes.js'], sale: ['plan/bitacora/estado'], entra: [] },
  'N10 Retiro':             { viene: [], sale: [], entra: [] },
  'N11 Prueba e2e':         { viene: [], sale: [], entra: [] }
};

// ── LO QUE EXISTE DE VERDAD EN DISCO
function listar(dir, filtro) {
  try { return fs.readdirSync(dir).filter(function (f) { return filtro.test(f); }); } catch (e) { return []; }
}
var agentes   = listar(H + '/.claude/agents/crm-reporte', /\.md$/);
var guardianes= listar(H + '/.claude/tools/reportes', /\.js$/);
var PROY = H + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var contratos = listar(PROY + '/_orquesta/contratos-cliente-nestle', /\.md$/);

// 🔴 los agentes en disco llevan prefijo `rick-reportes-agent-*` y en el PLAN los escribí sin
//    él. Se normaliza antes de comparar — si no, los 12 salen como huerfanos y el veredicto
//    culpa al plan cuando el que estaba mal era el check.
function norm(f) { return String(f).replace(/^rick-reportes-/, ''); }
var absorbido = {};
Object.keys(PLAN).forEach(function (n) { PLAN[n].viene.forEach(function (v) { (absorbido[norm(v)] = absorbido[norm(v)] || []).push(n); }); });

console.log('════════ ¿EL PLAN DE TRANSFERENCIA ESTÁ COMPLETO? ════════\n');

// ── 1 · huérfanos: piezas viejas que ningún paso absorbe
console.log('══ 1 · PIEZAS VIEJAS QUE NINGÚN PASO ABSORBE ══');
var problemas = 0;

function revisar(titulo, lista, esRuido) {
  var huerf = lista.filter(function (f) { return !absorbido[norm(f)] && !esRuido(f); });
  var ruido = lista.filter(esRuido);
  console.log('\n  ── ' + titulo + '  (' + lista.length + ' archivos, ' + ruido.length + ' descartados como scripts de un solo uso)');
  if (!huerf.length) { console.log('     ✔ todos absorbidos'); return; }
  problemas += huerf.length;
  huerf.forEach(function (f) { console.log('     🔴 SIN PASO: ' + f); });
}
revisar('AGENTES', agentes, function () { return false; });
revisar('CONTRATOS', contratos, function () { return false; });
// los guardianes traen scripts de un solo uso (_algo.js) y herramientas xlsx genéricas
revisar('GUARDIANES Y HERRAMIENTAS', guardianes, function (f) {
  // ruido = script de un solo uso (_wk32-*, _catalogo-nuevas...) que NO absorbe ningun paso,
  // o herramienta generica de xlsx que se usa desde cualquier lado.
  if (absorbido[norm(f)]) return false;
  return /^_/.test(f) || /^(xlsx-|find-file|auditar-estructura|mapa-fuente)/.test(f);
});

// ── 2 · invención: pasos que no vienen de nada
console.log('\n\n══ 2 · PASOS QUE NO VIENEN DE NADA (¿inventados?) ══');
var inventados = Object.keys(PLAN).filter(function (n) { return !PLAN[n].viene.length; });
inventados.forEach(function (n) {
  var ok = /Manual|Retiro|Prueba|Respaldo/.test(n);
  console.log('     ' + (ok ? '✔' : '🔴') + ' ' + n.padEnd(24) + (ok ? 'legítimo: es nuevo a propósito' : 'NO viene de nada y no es nuevo declarado'));
  if (!ok) problemas++;
});

// ── 3 · cadena: ¿la salida de un paso es la entrada de otro?
console.log('\n\n══ 3 · LA CADENA · ¿alguna salida se queda sin consumir? ══');
var salidas = {}, entradas = {};
Object.keys(PLAN).forEach(function (n) {
  PLAN[n].sale.forEach(function (s) { (salidas[s] = salidas[s] || []).push(n); });
  PLAN[n].entra.forEach(function (e) { (entradas[e] = entradas[e] || []).push(n); });
});
var sinConsumir = Object.keys(salidas).filter(function (s) { return !entradas[s] && !/veredicto|git|destinos|plan\/bitacora/.test(s); });
var sinProducir = Object.keys(entradas).filter(function (e) { return !salidas[e] && !/descargas/.test(e); });
console.log('  salidas que nadie consume:');
if (!sinConsumir.length) console.log('     ✔ ninguna');
sinConsumir.forEach(function (s) { console.log('     🔴 ' + s + '  ← lo produce ' + salidas[s].join(', ') + ' y nadie lo usa'); problemas++; });
console.log('  entradas que nadie produce:');
if (!sinProducir.length) console.log('     ✔ ninguna');
sinProducir.forEach(function (e) { console.log('     🔴 ' + e + '  ← lo pide ' + entradas[e].join(', ') + ' y nadie lo genera'); problemas++; });

// ── 4 · doble absorción: una pieza vieja en dos pasos
console.log('\n\n══ 4 · PIEZAS ABSORBIDAS POR MÁS DE UN PASO ══');
var dobles = Object.keys(absorbido).filter(function (v) { return absorbido[v].length > 1; });
if (!dobles.length) console.log('     ✔ ninguna');
dobles.forEach(function (v) {
  var ok = /^xlsx-|guardian-base|correr-guardianes/.test(v);
  console.log('     ' + (ok ? '✔' : '⚠') + ' ' + v.padEnd(30) + '→ ' + absorbido[v].join(' + ') + (ok ? '   (herramienta compartida, correcto)' : '   ¿está bien que esté en dos?'));
});

console.log('\n\n════════ VEREDICTO: ' + (problemas ? '🔴 ' + problemas + ' hueco(s)' : '✅ el plan cubre todo el sistema viejo') + ' ════════');
