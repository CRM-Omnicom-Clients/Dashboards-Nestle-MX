// email-bloque · ¿SIRVE PARA LOS SCRIPTS SIGUIENTES? — la prueba que no es circular.
//
// Que email-bloque corra y dé verde no prueba nada: lo escribí yo. La prueba real es que los dos
// scripts que vienen puedan hacer su trabajo con el bloque:
//
//   PUERTA-1 · cuadre cruzado  → ¿puede cruzarlo contra el catálogo y los otros bloques?
//   N3  · puerta 1        → ¿sabe qué escribir y, sobre todo, qué NO tocar?
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de insumos-validar si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ email-bloque · SIMULACIÓN DE LOS SCRIPTS SIGUIENTES ════════\n');
var F = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var T = os.homedir() + '/_n2as.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var Rf = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });

// ══ PUERTA-1 · EL CUADRE CRUZADO ═════════════════════════════════════════════════════════
console.log('══ PUERTA-1 · ¿puede cruzar el bloque contra el catálogo? ══');
// ⚠ el cruce ingenuo `cn[content_name] = pieza_id` machaca: cuando dos piezas reclaman el
//   mismo content_name, la última gana en silencio y el check daba 264/264 tranquilizador.
//   Son 8 casos reales (DEF-N1-001). Se cruza con la MISMA cascada que usa el refutador.
var canonP = {}, variP = {}, sendsP = {};
P.forEach(function (p) {
  var id = t(p['Pieza_ID']); sendsP[id] = num(p['Sends']);
  if (t(p['Content_Name'])) (canonP[t(p['Content_Name'])] = canonP[t(p['Content_Name'])] || []).push(id);
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) {
    if (t(x) && t(x) !== t(p['Content_Name'])) (variP[t(x)] = variP[t(x)] || []).push(id);
  });
});
function uq(a) { var s = {}; (a || []).forEach(function (x) { s[x] = 1; }); return Object.keys(s); }
function atribuir(e) {
  var c = uq(canonP[e.content_name]);
  if (c.length === 1) return { pieza: c[0] };
  if (c.length > 1) { var x = c.filter(function (i) { return sendsP[i] === e.email_sends; }); return x.length === 1 ? { pieza: x[0] } : { pieza: null, candidatas: c }; }
  var v = uq(variP[e.content_name]);
  if (v.length === 1) return { pieza: v[0] };
  if (v.length > 1) { var y = v.filter(function (i) { return sendsP[i] === e.email_sends; }); return y.length === 1 ? { pieza: y[0] } : { pieza: null, candidatas: v }; }
  return { pieza: null };
}
var atr = F.envios.map(atribuir);
var sinPieza = atr.filter(function (a) { return !a.pieza && !a.candidatas; });
var ambig = atr.filter(function (a) { return !a.pieza && a.candidatas; });
chk('ningún envío se queda SIN pieza', !sinPieza.length,
  (F.envios.length - sinPieza.length - ambig.length) + ' atribuidos · ' + ambig.length + ' ambiguos declarados (DEF-N1-001) · ' + sinPieza.length + ' sin pieza');
chk('los ambiguos se declaran, no se fuerzan', ambig.every(function (a) { return a.candidatas.length > 1; }),
  ambig.length ? ambig.map(function (a) { return a.candidatas.join('/'); }).join(' · ') : 'ninguno');

var IX = A.indexar(Rf);
var noRes = [];
F.envios.forEach(function (e) {
  t(e.segmento_raw).split(/\s*,\s*/).filter(Boolean).forEach(function (s) {
    if (!A.resolver(IX, 'Segmento', s, e.campana_raw, '').v) noRes.push(s);
  });
});
chk('la escalera resuelve todos sus segmentos', !noRes.length,
  noRes.length ? Array.from(new Set(noRes)).slice(0, 3).join(' · ') : 'todos');

var sumaBloque = F.envios.reduce(function (a, e) { return a + e.email_sends; }, 0);
var sumaCat = P.filter(function (p) { return t(p['Canal']) === 'Email'; }).reduce(function (a, p) { return a + num(p['Sends']); }, 0);
chk('Σ del bloque cuadra con el catálogo', sumaBloque === sumaCat,
  'bloque ' + sumaBloque.toLocaleString() + ' vs catálogo ' + sumaCat.toLocaleString());

// ══ N3 · LA PUERTA 1 ════════════════════════════════════════════════════════════════
console.log('\n══ N3 · ¿sabe qué escribir y qué NO tocar? ══');
// 🔴 caducó: las canónicas ya no son fórmulas. Lo que N3 necesita saber ahora es de dónde
//    salió cada canónica, no qué columnas no puede tocar.
chk('el bloque declara de dónde salió cada canónica',
  Object.keys(((F.canonico || {}).vias) || {}).length > 0,
  Object.keys(((F.canonico || {}).vias) || {}).map(function (v) { return v + ': ' + F.canonico.vias[v]; }).join(' · '));

// la prueba de verdad: ¿esas columnas SIGUEN teniendo fórmula en la hoja?
var shE = wb.Sheets['Data_Email'];
var r = XLSX.utils.decode_range(shE['!ref']);
var hdr = {}, sigueFormula = [];
for (var c = r.s.c; c <= r.e.c; c++) {
  var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h) hdr[t(h.v)] = c;
}
// 🔴 se escanea la columna ENTERA. Mirar solo la fila 2 decía «columna de fórmula» de una
//    columna que es 73% texto escrito a mano: la puerta creería que puede restaurar la
//    fórmula en toda la columna y borraría el trabajo manual.
var aMano = 0;
(F.columnas_con_formula || []).forEach(function (col) {
  var ci = hdr[col];
  if (ci === undefined) return;
  var f = 0, d = 0;
  for (var i = 1; i <= r.e.r; i++) {
    var cel = shE[XLSX.utils.encode_cell({ r: i, c: ci })];
    if (!cel || t(cel.v) === '') continue;
    if (cel.f) f++; else d++;
  }
  if (f) sigueFormula.push(col);
  aMano += d;
});
chk('esas columnas siguen con fórmula viva en la hoja', sigueFormula.length === (F.columnas_con_formula || []).length,
  sigueFormula.length + '/' + (F.columnas_con_formula || []).length + ' verificadas contra la hoja real');
chk('la puerta sabe cuántas celdas son manuales', (F.celdas_escritas_a_mano || 0) === aMano,
  '✍ ' + aMano + ' celdas escritas a mano en esas columnas · ⛔ escribir por columna las borraría');

var camposParaEscribir = ['content_name', 'fecha', 'email_type', 'journey_id', 'email_sends', 'email_deliveries', 'email_unique_opens', 'email_unique_clicks', 'email_bounces'];
var faltan = camposParaEscribir.filter(function (k) { return F.envios[0][k] === undefined; });
chk('el bloque trae todo lo que la puerta necesita escribir', !faltan.length,
  faltan.length ? 'faltan: ' + faltan.join(', ') : camposParaEscribir.length + ' campos por envío');

// ¿la puerta puede localizar la fila a actualizar?
var porLlave = {};
XLSX.utils.sheet_to_json(shE, { defval: '' }).forEach(function (x, i) {
  if (!t(x['Email_Content_Name'])) return;
  porLlave[t(x['Email_Content_Name']) + '¦' + t(x['Send_Date'])] = i + 2;   // fila real en la hoja
});
var ubicables = F.envios.filter(function (e) {
  return Object.keys(porLlave).some(function (k) { return k.indexOf(e.content_name) === 0; });
});
chk('la puerta puede ubicar cada envío en su fila', ubicables.length === F.envios.length,
  ubicables.length + '/' + F.envios.length + ' ubicables por content_name');

// ══ EL CUADRE FINAL ═════════════════════════════════════════════════════════════════
console.log('\n══ el cuadre que la puerta va a comprobar ══');
console.log('     envíos en el bloque : ' + F.envios.length);
console.log('     Σ sends             : ' + sumaBloque.toLocaleString());
console.log('     idénticos           : ' + F.auditoria.iguales);
console.log('     crecieron (MAX)     : ' + F.auditoria.crecieron);
console.log('     sin pareja          : ' + F.auditoria.sin_pareja_en_el_export + '  (se conservan)');
console.log('     nuevos              : ' + F.auditoria.nuevos);

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(48) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s): el bloque no le sirve al siguiente'
  : '✅ EL BLOQUE SIRVE — PUERTA-1 puede cruzarlo y N3 sabe qué NO tocar'));
process.exit(fallo ? 1 : 0);
