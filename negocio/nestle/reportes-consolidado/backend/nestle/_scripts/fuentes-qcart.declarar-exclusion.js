/*
 * fuentes-qcart.declarar-exclusion.js — declara que un shortlink NO CUENTA, y lo saca del bloque.
 *
 * 🔴 EL CONTRATO EXISTÍA Y NADIE LO LEÍA (descubierto el 15-sep-2026). `_contratos/exclusiones.json`
 *    lleva 18 shortlinks declarados desde agosto, cada uno con su motivo escrito — «link de un
 *    envío que NO se realizó», «el maestro marca No enviado», «hoja Reagendar, fuera de alcance».
 *    Ningún script lo consultaba. Era una lista de decisiones que no decidían nada.
 *    Se notó por el peor camino: `CVCPHfND` y `piPZpvXp` estaban ahí desde el 9-sep, declarados
 *    por Rick —«la Jornada 7 son solo los dos códigos de septiembre»— y aun así sus 7 eventos
 *    entraron al bloque y colgaron de `005-P003`. La nota de esa exclusión decía «el filtro de
 *    activación ya los descartaba»; dejó de ser cierto en cuanto llegó tráfico del 10-11 de
 *    septiembre.
 *
 * 🔴 UNA EXCLUSIÓN SIN MOTIVO NO SE ACEPTA. Es la regla que el propio contrato declara: «Toda
 *    exclusión lleva motivo escrito. Nunca se excluye tráfico en silencio.» Excluir es decidir que
 *    un dato real no cuenta; sin el porqué, dentro de un mes nadie puede revisar la decisión.
 *
 * 🔴 NO SE BORRA: SE APARTA. Lo excluido va entero a `_fuentes/qcart-excluidos.json` con su motivo
 *    y su fecha. Si mañana resulta que el envío sí salió, el evento se puede devolver; si se
 *    hubiera borrado, no.
 *
 *   node fuentes-qcart.declarar-exclusion.js --lote <id>          (seco)
 *   node fuentes-qcart.declarar-exclusion.js --lote <id> --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var RUTA = BACK + '/_contratos/exclusiones.json';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var NL = String.fromCharCode(10);
var HOY = '2026-09-15';

// ══ LOS LOTES DECLARADOS ═══════════════════════════════════════════════════════════
// Cada uno con quién lo decidió y cuándo. Un lote se queda aquí para siempre: es el registro
// de por qué esos datos no cuentan.
var LOTES = {
  'mundial-e-p2-modern-cooking': {
    piezas: ['004-P020'],
    codigos: ['LJQsq5T9', '3NIh2kYW', 'ZJ3SmPMy', 'wdvsBDby'],
    motivo: 'el envío NUNCA SALIÓ. Rick, 15-sep-2026: «ya recordé, nunca salió, esos carritos no deben de contar». ' +
      'Comprobado contra SFMC el mismo día: de Mundial E-P2 la DE publica DOS piezas —Bebidas (14,117 envíos) y ' +
      'Botana (75,518)— y ninguna de Modern Cooking. El maestro de junio sí declaró los links del bloque ' +
      '`e-cooking2 · new-cooking`, y de ahí nació la pieza `004-P020` el 27-ago («alta derivada del doc de links, ' +
      'no declarada por Rick»). Los links existieron y recibieron tráfico; el correo que debía mandarlos, no. ' +
      'Sin envío no hay atribución: 49 carritos y 4 productos que no pertenecen a ninguna pieza de CRM.',
    fuente: 'Rick en chat, 15-sep-2026'
  }
};

var iL = process.argv.indexOf('--lote');
var LOTE = iL >= 0 ? t(process.argv[iL + 1]) : '';
console.log('════════ qcart · DECLARAR UNA EXCLUSIÓN ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);
if (!LOTE || !LOTES[LOTE]) {
  console.log('  falta `--lote <id>`. Declarados: ' + Object.keys(LOTES).join(' · '));
  process.exit(1);
}
var D = LOTES[LOTE];

var X = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
var lista = (X.por_dimension || {})['Link Qcart'] || [];
var yaEstan = D.codigos.filter(function (c) { return lista.some(function (x) { return t(x.valor) === c; }); });
var nuevos = D.codigos.filter(function (c) { return yaEstan.indexOf(c) < 0; });

console.log('  lote: ' + LOTE);
console.log('  piezas: ' + D.piezas.join(' · '));
console.log('  códigos: ' + D.codigos.length + '   ·   ya declarados: ' + yaEstan.length + '   ·   se agregan: ' + nuevos.length);
console.log(NL + '  motivo:');
console.log('     ' + D.motivo.replace(/(.{100})\s/g, '$1' + NL + '     '));

// ── cuánto tráfico sale del bloque ────────────────────────────────────────────────
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var fuera = { carritos: [], productos: [] }, porCod = {};
['carritos', 'productos'].forEach(function (tipo) {
  (B[tipo] || []).forEach(function (e) {
    if (D.codigos.indexOf(t(e.shortlink_code)) < 0) return;
    fuera[tipo].push(e);
    var k = t(e.shortlink_code);
    porCod[k] = porCod[k] || { carritos: 0, productos: 0, nombre: t(e.shortlink_name), pieza: t(e.pieza_id) };
    porCod[k][tipo]++;
  });
});
console.log(NL + '  ── el tráfico que sale del bloque');
Object.keys(porCod).sort().forEach(function (k) {
  var x = porCod[k];
  console.log('     🚫 ' + k.padEnd(11) + '«' + (x.nombre || '?') + '»   carritos ' + String(x.carritos).padStart(3) +
    '   productos ' + String(x.productos).padStart(3) + '   colgaba de ' + (x.pieza || '—'));
});
// 🔴 LAS DOS UNIDADES, porque esto informa una DECISION de Rick (29-sep-2026). Decia «total: 7
//    carrito(s)» contando FILAS del bloque: una fila es un bucket con contador `views`, asi que el
//    numero real de carritos que salen puede ser el doble. Quien decide que excluir tiene que ver
//    cuanto pesa de verdad.
var vw = function (a) { return (a || []).reduce(function (s, e) { return s + (Number(e.views) || 0); }, 0); };
var tc = fuera.carritos.length, tp = fuera.productos.length;
var vc = vw(fuera.carritos), vp = vw(fuera.productos);
console.log('     total: ' + tc + ' fila(s) = ' + vc + ' CARRITO(S)   ·   ' + tp + ' fila(s) = ' + vp + ' producto(s) vistos');
console.log('     bloque: carritos ' + vw(B.carritos) + ' → ' + (vw(B.carritos) - vc) + ' vistas   (filas ' + (B.carritos || []).length + ' → ' + ((B.carritos || []).length - tc) + ')' +
  '   ·   productos ' + (B.productos || []).length + ' → ' + ((B.productos || []).length - tp));

if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

// ── 1 · el contrato ───────────────────────────────────────────────────────────────
nuevos.forEach(function (c) {
  lista.push({ valor: c, motivo: D.motivo, fuente: D.fuente, declarado: HOY, piezas: D.piezas.slice() });
});
X.por_dimension['Link Qcart'] = lista;
fs.writeFileSync(RUTA, JSON.stringify(X, null, 1), 'utf8');
var crudo = fs.readFileSync(RUTA);
var reX = JSON.parse(crudo.toString('utf8'));
var okX = D.codigos.every(function (c) { return (reX.por_dimension['Link Qcart'] || []).some(function (x) { return t(x.valor) === c; }); });
console.log(NL + '  ── el contrato');
console.log('     ' + (crudo[0] === 123 ? '✔' : '🔴') + ' primer byte «{» (sin BOM)');
console.log('     ' + (crudo.toString('utf8').indexOf(String.fromCharCode(195, 131)) < 0 ? '✔' : '🔴') + ' acentos sin doble-codificar');
console.log('     ' + (okX ? '✔' : '🔴') + ' los ' + D.codigos.length + ' códigos declarados   ·   la lista tiene ' + reX.por_dimension['Link Qcart'].length);
if (!okX || crudo[0] !== 123) process.exit(1);

// ── 2 · apartar lo excluido ANTES de tocar el bloque ──────────────────────────────
var DEST = BACK + '/_fuentes/qcart-excluidos.json';
var prev = { carritos: [], productos: [] };
try { prev = JSON.parse(fs.readFileSync(DEST, 'utf8')); } catch (e) { }
var acum = {
  generado: HOY,
  que_es: 'Tráfico REAL de Qcart que NO cuenta, con su motivo. No es basura: es tráfico de links que existieron. ' +
    'Si un día se demuestra que el envío sí salió, estos eventos se pueden devolver al bloque.',
  carritos: (prev.carritos || []).concat(fuera.carritos.map(function (e) { var o = Object.assign({}, e); o.excluido_motivo = D.motivo; o.excluido_lote = LOTE; o.excluido_el = HOY; return o; })),
  productos: (prev.productos || []).concat(fuera.productos.map(function (e) { var o = Object.assign({}, e); o.excluido_motivo = D.motivo; o.excluido_lote = LOTE; o.excluido_el = HOY; return o; }))
};
fs.writeFileSync(DEST, JSON.stringify(acum, null, 1), 'utf8');
var reD = JSON.parse(fs.readFileSync(DEST, 'utf8'));
var guardados = reD.carritos.filter(function (e) { return e.excluido_lote === LOTE; }).length +
  reD.productos.filter(function (e) { return e.excluido_lote === LOTE; }).length;
console.log('     ' + (guardados === tc + tp ? '✔' : '🔴') + ' apartados en qcart-excluidos.json: ' + guardados + ' de ' + (tc + tp));
if (guardados !== tc + tp) { console.log(NL + '  🔴 NO se toca el bloque.'); process.exit(1); }

// ── 3 · el bloque ─────────────────────────────────────────────────────────────────
var NUEVO = {};
Object.keys(B).forEach(function (k) { if (k !== 'carritos' && k !== 'productos') NUEVO[k] = B[k]; });
['carritos', 'productos'].forEach(function (tipo) {
  NUEVO[tipo] = (B[tipo] || []).filter(function (e) { return D.codigos.indexOf(t(e.shortlink_code)) < 0; });
});
// 🔴 baja EXACTAMENTE lo declarado, ni un evento más
var d1 = (B.carritos || []).length - NUEVO.carritos.length, d2 = (B.productos || []).length - NUEVO.productos.length;
console.log('     ' + (d1 === tc && d2 === tp ? '✔' : '🔴') + ' el bloque baja lo declarado: carritos -' + d1 + ' (esperado -' + tc + ')   productos -' + d2 + ' (esperado -' + tp + ')');
if (d1 !== tc || d2 !== tp) { console.log(NL + '  🔴 NO se escribe.'); process.exit(1); }
fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(NUEVO, null, 1));
var re = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var quedan = ['carritos', 'productos'].reduce(function (s, k) {
  return s + (re[k] || []).filter(function (e) { return D.codigos.indexOf(t(e.shortlink_code)) >= 0; }).length;
}, 0);
console.log('     ' + (quedan === 0 ? '✔' : '🔴') + ' releído del disco: ' + re.carritos.length + ' carritos · ' + re.productos.length + ' productos   ·   quedan ' + quedan + ' excluidos dentro');
console.log(NL + '  ✅ EXCLUSIÓN DECLARADA Y APLICADA');
