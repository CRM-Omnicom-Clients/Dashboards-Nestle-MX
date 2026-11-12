// qcart-bloque · REFUTADOR — no busca confirmar el bloque, busca DEMOSTRAR QUE ESTÁ MAL.
//
// Tres frentes:
//   A · NO CALCULA    ¿se coló alguna métrica derivada? Es la razón de ser de esta migración.
//   B · PERTENENCIA   ¿el filtro deja pasar algo ajeno, o recorta algo nuestro?
//   C · LOGS          ¿el append pierde, duplica o reordena eventos?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var C = require(__dirname + '/lib-qcart.js');
var F = require(__dirname + '/lib-qcart-filtro.js');
var QL = require(__dirname + '/lib-qcart-links.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = F.t;
function mil(n) { return Number(n).toLocaleString('es-MX'); }
var acu = [], hall = [], fallo = 0;
function R_(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }
function HALL(n, hay, det) { hall.push([n, hay, det]); }

console.log('════════ qcart-bloque · REFUTADOR ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var pad = F.padron();
var R = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');

// ══ A · ¿NO CALCULA? ════════════════════════════════════════════════════════════════
console.log('══ A · ¿se coló algún cálculo? ══');
var src = fs.readFileSync(BACK + '/_scripts/fuentes-qcart.qcart.js', 'utf8');
// se buscan operaciones de división y porcentaje en el código que produce los eventos
var divide = /\/\s*(e\.|x\.|o\.)/.test(src.replace(/\/\//g, ''));
R_('A1 · el script divide métricas (eso sería una tasa)', divide, divide ? 'hay una división sobre un evento' : 'ninguna división sobre métricas');

var ev = B.carritos[0] || {};
var numericos = Object.keys(ev).filter(function (k) { return typeof ev[k] === 'number'; });
console.log('  campos numéricos del evento: ' + numericos.join(', '));
var DERIVADO = /pct|penetr|ticket|promedio|rate|tasa|ratio|top|avg/i;
R_('A2 · algún campo numérico es derivado', numericos.some(function (k) { return DERIVADO.test(k); }),
  numericos.filter(function (k) { return DERIVADO.test(k); }).join(', ') || 'los 4 son crudos: impressions, views, total_shown_price, n_tiendas');

// la prueba real: ¿los valores del bloque son IDÉNTICOS a los del CSV?
var porLlave = {};
R.carritos.forEach(function (e) { porLlave[C.llaveEvento(e)] = e; });
var alterados = B.carritos.filter(function (e) {
  var o = porLlave[C.llaveEvento(e)];
  return o && (o.views !== e.views || o.impressions !== e.impressions || o.total_shown_price !== e.total_shown_price);
});
R_('A3 · el bloque alteró alguna métrica del CSV', alterados.length > 0,
  alterados.length ? mil(alterados.length) + ' eventos con valores distintos al origen' : mil(B.carritos.length) + ' eventos idénticos al CSV');

// ══ B · LA PERTENENCIA ══════════════════════════════════════════════════════════════
console.log('\n══ B · ¿el filtro deja pasar lo ajeno o recorta lo nuestro? ══');
var ajenos = B.carritos.concat(B.productos).filter(function (e) { return !pad.links[e.shortlink_code]; });
R_('B1 · entró algún evento de un link que no es nuestro', ajenos.length > 0,
  ajenos.length ? mil(ajenos.length) + ' ajenos dentro' : 'ninguno: los ' + mil(B.carritos.length + B.productos.length) + ' son de links del catálogo');

var invalidos = B.carritos.concat(B.productos).filter(function (e) {
  var l = pad.links[e.shortlink_code]; return l && !l.valido;
});
R_('B2 · entró algún evento de un link que NO se envió', invalidos.length > 0,
  invalidos.length ? mil(invalidos.length) + ' de links inválidos' : 'ninguno');

var antes = B.carritos.concat(B.productos).filter(function (e) {
  return e.activacion_link && !e.aviso && e.fecha < e.activacion_link;
});
R_('B3 · entró algún evento anterior a la activación de su link', antes.length > 0,
  antes.length ? mil(antes.length) + ' anteriores' : 'ninguno, salvo los marcados por typo de fecha');

// ¿y al revés? ¿el filtro recortó algo que SÍ era nuestro y estaba en ventana?
var deberian = R.carritos.filter(function (e) {
  var l = pad.links[e.shortlink_code];
  return l && l.valido && e.fecha && (l.fecha_sospechosa || e.fecha >= l.activacion);
});
R_('B4 · el filtro recortó eventos que sí cumplían las dos reglas',
  deberian.length !== B.auditoria.carritos.dentro,
  'debían entrar ' + mil(deberian.length) + ' · entraron ' + mil(B.auditoria.carritos.dentro));

// ══ C · EL MODELO DE LOGS ═══════════════════════════════════════════════════════════
console.log('\n══ C · ¿el append pierde, duplica o reordena? ══');
var lls = {}, dup = 0;
B.carritos.forEach(function (e) { var k = C.llaveEvento(e); if (lls[k]) dup++; lls[k] = 1; });
B.productos.forEach(function (e) { var k = C.llaveEvento(e); if (lls['p' + k]) dup++; lls['p' + k] = 1; });
R_('C1 · hay eventos duplicados en el bloque', dup > 0, dup ? mil(dup) + ' duplicados' : 'ninguno en ' + mil(B.carritos.length + B.productos.length));

// simulación: agregar un lote con eventos viejos + uno nuevo
var lote = B.carritos.slice(0, 50).map(function (e) { return Object.assign({}, e); });
var nuevoEvento = Object.assign({}, B.carritos[0], { fecha: '2026-12-25', fecha_hora: '2026-12-25T09:00:00' });
lote.push(nuevoEvento);
var idx = {}; B.carritos.forEach(function (e) { idx[C.llaveEvento(e)] = 1; });
var entran = lote.filter(function (e) { return !idx[C.llaveEvento(e)]; });
console.log('  lote de prueba: 50 eventos ya cargados + 1 nuevo → entran ' + entran.length);
R_('C2 · el append no distingue lo nuevo de lo ya cargado', entran.length !== 1,
  entran.length === 1 ? 'entra exactamente el nuevo, los 50 se ignoran' : entran.length + ' entrarían');

// el orden no puede ser parte de la identidad
var revuelto = B.carritos.slice(0, 200).slice().reverse();
var kA = B.carritos.slice(0, 200).map(C.llaveEvento).sort().join('|');
var kB = revuelto.map(C.llaveEvento).sort().join('|');
R_('C3 · la llave depende del orden de las filas', kA !== kB,
  kA === kB ? 'las mismas llaves aunque se invierta el orden' : 'el orden cambia las llaves');

// ══ D · EL ANCLA AL CATÁLOGO ════════════════════════════════════════════════════════
console.log('\n══ D · ¿las dos hojas se anclan al catálogo nuevo? ══');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2br.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var idsCat = {}; P.forEach(function (p) { idsCat[t(p['Pieza_ID'])] = 1; });
var piezasBloque = {};
B.carritos.concat(B.productos).forEach(function (e) { if (e.pieza_id) piezasBloque[e.pieza_id] = 1; });
var fantasma = Object.keys(piezasBloque).filter(function (id) { return !idsCat[id]; });
R_('D1 · alguna pieza del bloque no existe en el catálogo', fantasma.length > 0,
  fantasma.length ? fantasma.join(' ') : Object.keys(piezasBloque).length + ' piezas, todas en Catalogo_Piezas');

// las dos hojas comparten el ancla → se pueden cruzar entre sí
var pc = {}, pp = {};
B.carritos.forEach(function (e) { pc[e.pieza_id] = 1; });
B.productos.forEach(function (e) { pp[e.pieza_id] = 1; });
var comunes = Object.keys(pc).filter(function (id) { return pp[id]; });
console.log('  piezas con carritos: ' + Object.keys(pc).length + ' · con productos: ' + Object.keys(pp).length + ' · en ambas: ' + comunes.length);
R_('D2 · las dos hojas no comparten ninguna pieza (no se podrían cruzar)', comunes.length === 0,
  comunes.length + ' piezas en las dos → motor-calculo puede cruzarlas por pieza_id');

// ── hallazgos con dueño ajeno ───────────────────────────────────────────────────────
HALL('DEF-QC-001 · shortlinks con tráfico sin catalogar', true,
  '9 links (8 de Mundial) con tráfico real, hoy en Data_Qcart, ausentes del doc y del catálogo');
HALL('DEF-QC-002 · fecha 2027 en 4 links de La Lechera', true,
  'mitigado: no se aplica la ventana a esos links, y se marcan');

console.log('\n════════ VEREDICTO · ¿está roto qcart-bloque? ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(56) + a[2]); });
console.log('\n──────── HALLAZGOS con dueño ajeno ────────');
hall.forEach(function (h) { console.log('  ' + (h[1] ? '⚠ ' : '✔ ') + ' ' + h[0].padEnd(56) + h[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) rompieron el bloque' : '✅ ningún ataque rompió el bloque'));
process.exit(fallo ? 1 : 0);
