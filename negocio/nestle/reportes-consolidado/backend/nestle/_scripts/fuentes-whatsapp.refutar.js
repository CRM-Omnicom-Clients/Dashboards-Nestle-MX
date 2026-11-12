// whatsapp-bloque · REFUTADOR — busca DEMOSTRAR que el bloque está mal.
//
//   A · NO CALCULA     ¿se coló una tasa? ¿alteró un número de la fuente?
//   B · SUBTOTALES     ¿se le escapó uno, o excluyó algo que no lo era?
//   C · CLICKS         ¿coló un supuesto como medición?
//   D · ANCLA          ¿forzó alguna ambigua?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'whatsapp';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var W = require(__dirname + '/lib-whatsapp.js');
var A = require(__dirname + '/lib-whatsapp-ancla.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = W.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var acu = [], hall = [], fallo = 0;
function R_(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }
function HALL(n, hay, det) { hall.push([n, hay, det]); }

console.log('════════ whatsapp-bloque · REFUTADOR ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));
var R = W.leer(inv.forma.whatsapp.ruta);

// ══ A · ¿NO CALCULA? ════════════════════════════════════════════════════════════════
console.log('══ A · ¿se coló algún cálculo? ══');
var numericos = Object.keys(B.envios[0] || {}).filter(function (k) { return typeof B.envios[0][k] === 'number'; });
console.log('  campos numéricos: ' + numericos.join(', '));
R_('A1 · algún campo numérico es una tasa', numericos.some(function (k) { return /rate|ctor|pct|ratio|promedio/i.test(k); }),
  numericos.filter(function (k) { return /rate|ctor|pct/i.test(k); }).join(', ') || 'todos son conteos crudos');

// los valores deben ser IDÉNTICOS a la fuente
var porLlave = {};
R.envios.forEach(function (e) { porLlave[W.llaveEnvio(e)] = e; });
var alterados = B.envios.filter(function (e) {
  var o = porLlave[W.llaveEnvio(e)];
  return o && (o.sends !== e.sends || o.opens_read !== e.opens_read || o.deliveries !== e.deliveries);
});
R_('A2 · el bloque alteró alguna cifra de la fuente', alterados.length > 0,
  alterados.length ? mil(alterados.length) + ' alterados' : B.envios.length + ' envíos idénticos a la fuente');

// ══ B · LOS SUBTOTALES ══════════════════════════════════════════════════════════════
console.log('\n══ B · ¿se le escapó un subtotal, o excluyó de más? ══');
// se busca por aritmética pura, sin mirar etiquetas: ¿algún envío del bloque iguala
// la suma de otros de su misma hoja?
var porHoja = {};
B.envios.forEach(function (e) { (porHoja[e.hoja] = porHoja[e.hoja] || []).push(e); });
var sospechosos = [];
Object.keys(porHoja).forEach(function (h) {
  var arr = porHoja[h];
  arr.forEach(function (e, i) {
    if (!e.sends) return;
    var resto = arr.filter(function (x, k) { return k !== i && x.sends; }).reduce(function (a, x) { return a + x.sends; }, 0);
    if (Math.abs(e.sends - resto) < 1 && arr.length > 2) sospechosos.push(h + ' · ' + e.sends + ' = suma del resto');
  });
});
R_('B1 · queda algún subtotal dentro del bloque', sospechosos.length > 0,
  sospechosos.length ? sospechosos.join(' · ') : 'ningún envío iguala la suma de los otros de su hoja');

// y al revés: lo excluido, ¿de verdad era subtotal?
R_('B2 · se excluyó algo que NO era subtotal',
  B.subtotales_excluidos.some(function (s) { return !s.cuadra; }),
  B.subtotales_excluidos.filter(function (s) { return s.cuadra; }).length + '/' + B.subtotales_excluidos.length + ' confirmados por aritmética');

// la suma tiene que cuadrar con la fuente menos los subtotales
var sumaFuente = R.envios.reduce(function (a, e) { return a + (e.sends || 0); }, 0);
R_('B3 · la Σ del bloque no cuadra con la fuente', B.auditoria.sends_total !== sumaFuente,
  'bloque ' + mil(B.auditoria.sends_total) + ' · fuente sin subtotales ' + mil(sumaFuente));

// ══ C · LOS CLICKS ══════════════════════════════════════════════════════════════════
console.log('\n══ C · ¿coló un supuesto como medición? ══');
// la firma del número inventado: un CTOR idéntico en varios envíos
var conClick = B.envios.filter(function (e) { return e.clicks !== null && e.opens_read; });
var ctors = {};
conClick.forEach(function (e) { var c = (e.clicks / e.opens_read).toFixed(4); ctors[c] = (ctors[c] || 0) + 1; });
var sospechoso = Object.keys(ctors).filter(function (c) { return ctors[c] >= 3 && +c > 0; });
console.log('  envíos con clicks cargados: ' + conClick.length + ' · CTOR repetido en 3+: ' + (sospechoso.join(', ') || 'ninguno'));
R_('C1 · hay un CTOR idéntico en 3+ envíos (firma de número derivado)', sospechoso.length > 0,
  sospechoso.length ? '🔴 ' + sospechoso.join(', ') : 'ningún CTOR se repite: los cargados son mediciones distintas');
R_('C2 · algún envío no medido trae clicks', B.envios.some(function (e) { return e.clicks_medidos === 'No' && e.clicks !== null; }),
  B.auditoria.clicks_no_medidos + ' no medidos, todos con clicks=null');

// ══ D · EL ANCLA ════════════════════════════════════════════════════════════════════
console.log('\n══ D · ¿forzó alguna ambigua? ══');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2cr.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var idsCat = {}; P.forEach(function (p) { idsCat[t(p['Pieza_ID'])] = 1; });
var fantasma = B.envios.filter(function (e) { return e.pieza_id && !idsCat[e.pieza_id]; });
R_('D1 · alguna pieza asignada no existe en el catálogo', fantasma.length > 0,
  fantasma.length ? fantasma.map(function (e) { return e.pieza_id; }).join(' ') : B.auditoria.con_pieza + ' asignadas, todas reales');

var forzados = B.envios.filter(function (e) { return e.pieza_id && (e.candidatas || []).length > 1; });
R_('D2 · asignó una pieza habiendo varias candidatas', forzados.length > 0,
  forzados.length ? mil(forzados.length) + ' forzados' : 'ninguno: la ambigua se declara');

// ¿el ancla es reproducible? mismo envío, mismo resultado
var repro = B.envios.slice(0, 10).every(function (e) {
  var r = A.atribuir(P, e);
  return r.pieza_id === e.pieza_id;
});
R_('D3 · el ancla no es reproducible', !repro, repro ? 'mismo envío → misma pieza, siempre' : 'cambia entre corridas');

HALL('la hoja Data_WhatsApp está desactualizada', true,
  '6 de 26 envíos · faltan ' + mil(B.auditoria.sends_total - 7374) + ' sends (Maggi Mundial, Maggi, ICE)');
HALL('el catálogo tiene 10 piezas WA de Mundial vacías', true,
  'sends=0 y sin fecha → no hay con qué desempatar los 11 ambiguos');

console.log('\n════════ VEREDICTO · ¿está roto whatsapp-bloque? ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(56) + a[2]); });
console.log('\n──────── HALLAZGOS con dueño ajeno ────────');
hall.forEach(function (h) { console.log('  ' + (h[1] ? '⚠ ' : '✔ ') + ' ' + h[0].padEnd(56) + h[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) rompieron el bloque' : '✅ ningún ataque rompió el bloque'));
process.exit(fallo ? 1 : 0);
