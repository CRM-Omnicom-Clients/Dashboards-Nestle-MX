/*
 * fuentes-qcart.purgar-no-nuestros.js — saca del bloque el tráfico que NO es nuestro.
 *
 * LA REGLA, de Rick (15-sep-2026):
 *   «No son nuestras. Si no están en nuestro catálogo de links no son nuestras, son de PAUTA.»
 *
 * POR QUÉ HACE FALTA UN PASO APARTE. El bloque de Qcart ya filtra por padrón al ENTRAR
 * (`fuera_no_es_nuestro`), pero es un APPEND: no revisita lo ya cargado. Un evento que entró
 * cuando el padrón era otro —o antes de que existiera el filtro— se queda dentro para siempre.
 * Así sobrevivieron 7 eventos de `piPZpvXp` y `CVCPHfND`: dos shortlinks que el maestro nunca
 * declaró, que el sistema había colgado de `005-P003` por el utm, y que eran la causa ÚNICA de
 * los tres rojos de la cadena (la refutación B1, el motor y el guardián de distribución).
 *
 * 🔴 EL ANCLA ES EL SHORTLINK, NO EL utm (R2). Un evento entra porque su shortlink está en el
 *    maestro, no porque su `utm_content` diga algo que suene a nuestro. Estos dos decían `e-p4`
 *    y por eso acabaron en una pieza de Liga MX — el utm es exactamente el campo que no manda.
 *
 * 🔴 NO SE BORRAN: SE APARTAN. Lo purgado se escribe entero en `_fuentes/qcart-pauta.json` con
 *    su motivo y su fecha. Es tráfico real de alguien, solo que no de CRM. Si mañana resulta que
 *    un link sí era nuestro y se agrega al maestro, el evento se puede volver a meter; si se
 *    hubiera borrado, no.
 *
 * 🔴 Y NO TOCA NADA QUE SÍ SEA NUESTRO. Antes de escribir se comprueba, evento por evento, que
 *    todo lo que se queda conserve su `pieza_id` exacto, y que el bloque baje EXACTAMENTE por lo
 *    declarado. Si alguna de las dos falla, no escribe.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
var LK = require(__dirname + '/lib-qcart-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
var HOY = new Date().toISOString().slice(0, 10);

console.log('════════ qcart · PURGAR LO QUE NO ES NUESTRO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

// ── LA autoridad del shortlink: EL MAESTRO ─────────────────────────────────────────
//
// 🔴 Y ES UNA SOLA, A PROPÓSITO (15-sep-2026). La primera versión aceptaba dos —el maestro Y los
//    códigos escritos en `Cod_Walmart_N` del catálogo— y con eso no purgaba nada: resulta que
//    `005-P003` SÍ declara `piPZpvXp` y `CVCPHfND` en `Cod_Walmart_2` y `Cod_Walmart_3`. (Yo
//    había reportado que el catálogo no los declaraba: estaba leyendo `Codigos_Qcart`, la columna
//    resumen, que dice N/A. El dato vive en las columnas por receta.)
//    Rick lo zanjó: «si no están en nuestro CATÁLOGO DE LINKS no son nuestras, son de pauta» — y
//    el catálogo de links es el maestro `Qcart-Links Mails-Hive- MX.xlsx`, no la fila de una pieza.
//    Tiene que ser una sola autoridad: si una fila del catálogo pudiera legitimar un shortlink,
//    bastaría escribirlo ahí para que entrara tráfico de pauta, y el maestro dejaría de mandar.
//
//    Medido antes de cambiarlo, que es lo que hace segura la decisión: de los 60 shortlinks con
//    eventos en el bloque, 58 están en el maestro. Los 2 que no son exactamente estos dos, los dos
//    de `005-P003` — una fila que además no tiene ni nombre ni envíos. Ninguna otra pieza se toca.
var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_purga.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '' });
fs.unlinkSync(tmp);

var NM_ID = COL.de(P, 'Pieza' + '_ID', 'catalogo');
var declarados = {};
for (var i = 1; i <= 5; i++) {
  ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    var nm = COL.opcional(P, pre + i);
    if (!nm) return;
    P.forEach(function (p) {
      var v = t(p[nm]); if (!v || TOKEN.test(v)) return;
      v.split(/[,;]/).map(t).forEach(function (c) { if (c && !TOKEN.test(c)) declarados[c] = t(p[NM_ID]); });
    });
  });
}
console.log('  maestro (LA autoridad): ' + Object.keys(MAE.links).length + ' links   ·   el catálogo escribe ' +
  Object.keys(declarados).length + ' códigos, pero NO legitiman\n');

// 🔴 solo el maestro. `declarados` se sigue leyendo para poder DECIR de qué pieza colgaba cada
//    evento que se va — informar de dónde salía no es lo mismo que darle permiso de quedarse.
function esNuestro(cod) { return !!MAE.links[cod]; }

var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var ANTES = { carritos: (Q.carritos || []).length, productos: (Q.productos || []).length };

var fuera = { carritos: [], productos: [] }, porCodigo = {};
['carritos', 'productos'].forEach(function (tipo) {
  (Q[tipo] || []).forEach(function (e) {
    var cod = t(e.shortlink_code);
    if (!cod) return;                       // sin código no se juzga aquí: es otro defecto
    if (esNuestro(cod)) return;
    fuera[tipo].push(e);
    var k = cod;
    porCodigo[k] = porCodigo[k] || { cod: cod, carritos: 0, productos: 0, piezas: {}, utm: {}, nombre: t(e.shortlink_name) };
    porCodigo[k][tipo]++;
    if (t(e.pieza_id)) porCodigo[k].piezas[t(e.pieza_id)] = 1;
    porCodigo[k].utm[t(e.utm_content) + ' · ' + t(e.utm_campaign)] = 1;
  });
});

var codigos = Object.keys(porCodigo);
if (!codigos.length) { console.log('  ✅ nada que purgar: todos los eventos del bloque son de links nuestros.'); process.exit(0); }

console.log('  ── lo que se va (shortlink que el MAESTRO no declara → es de pauta)');
codigos.sort().forEach(function (k) {
  var x = porCodigo[k];
  console.log('     🚫 ' + x.cod.padEnd(11) + '«' + (x.nombre || '?') + '»');
  console.log('          carritos ' + String(x.carritos).padStart(4) + '   productos ' + String(x.productos).padStart(4) +
    '   estaba colgado de: ' + (Object.keys(x.piezas).join(', ') || '(ninguna)'));
  console.log('          utm del CSV: ' + Object.keys(x.utm).join(' ¦ '));
});
// 🔴 LAS DOS UNIDADES: esto purga de verdad, y decia «total: N carrito(s)» contando FILAS
//    (29-sep-2026). Una fila es un bucket con contador `views`, asi que lo que se va puede pesar
//    el doble de lo que el resumen decia. Quien autoriza una purga tiene que ver cuanto se va.
var vw = function (a) { return (a || []).reduce(function (s, e) { return s + (Number(e.views) || 0); }, 0); };
var totC = fuera.carritos.length, totP = fuera.productos.length;
var vC = vw(fuera.carritos), vP = vw(fuera.productos);
console.log('\n     total: ' + totC + ' fila(s) = ' + vC + ' CARRITO(S)   ·   ' + totP + ' fila(s) = ' + vP + ' producto(s)   de ' + codigos.length + ' shortlink(s)');
console.log('     bloque: carritos ' + ANTES.carritos + ' → ' + (ANTES.carritos - totC) +
  '   ·   productos ' + ANTES.productos + ' → ' + (ANTES.productos - totP));

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ── se construye el bloque nuevo y se COMPRUEBA antes de guardar ────────────────────
var MOTIVO = 'no es nuestro: el shortlink no está en el maestro de links ni lo declara ninguna pieza del catálogo. ' +
  'Regla de Rick, 15-sep-2026: «si no están en nuestro catálogo de links no son nuestras, son de pauta». ' +
  'Apartado el ' + HOY + ' — el ancla es el SHORTLINK, no el utm (R2).';

var NUEVO = { carritos: [], productos: [] };
Object.keys(Q).forEach(function (k) { if (k !== 'carritos' && k !== 'productos') NUEVO[k] = Q[k]; });
['carritos', 'productos'].forEach(function (tipo) {
  NUEVO[tipo] = (Q[tipo] || []).filter(function (e) {
    var cod = t(e.shortlink_code);
    return !cod || esNuestro(cod);
  });
});

// 🔴 PRUEBA 1 · baja EXACTAMENTE por lo declarado, ni un evento más
var d1 = ANTES.carritos - NUEVO.carritos.length, d2 = ANTES.productos - NUEVO.productos.length;
console.log('\n  ── las pruebas antes de guardar');
console.log('     ' + (d1 === totC && d2 === totP ? '✔' : '🔴') + ' baja exactamente lo declarado: carritos -' + d1 + ' (esperado -' + totC + ')   productos -' + d2 + ' (esperado -' + totP + ')');
if (d1 !== totC || d2 !== totP) { console.log('\n  🔴 NO SE ESCRIBE.'); process.exit(1); }

// 🔴 PRUEBA 2 · ningún evento que se queda cambió de pieza ni de nada
var huella = function (e) { return [t(e.shortlink_code), t(e.fecha), t(e.hora), t(e.fila_en_csv), t(e.fuente), t(e.pieza_id)].join('¦'); };
var antesIdx = {};
['carritos', 'productos'].forEach(function (tipo) {
  (Q[tipo] || []).forEach(function (e) { if (!t(e.shortlink_code) || esNuestro(t(e.shortlink_code))) antesIdx[tipo + '¦' + huella(e)] = 1; });
});
var alterados = 0;
['carritos', 'productos'].forEach(function (tipo) {
  NUEVO[tipo].forEach(function (e) { if (!antesIdx[tipo + '¦' + huella(e)]) alterados++; });
});
console.log('     ' + (alterados ? '🔴' : '✔') + ' ningún evento que se queda cambió: ' + alterados + ' alterado(s)');
if (alterados) { console.log('\n  🔴 NO SE ESCRIBE.'); process.exit(1); }

// 🔴 PRUEBA 3 · lo purgado se aparta ANTES de tocar el bloque — nunca se pierde
var PAUTA = { generado: HOY, regla: MOTIVO, carritos: fuera.carritos, productos: fuera.productos };
fs.writeFileSync(BACK + '/_fuentes/qcart-pauta.json', JSON.stringify(PAUTA, null, 1));
var reP = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart-pauta.json', 'utf8'));
console.log('     ' + (reP.carritos.length === totC && reP.productos.length === totP ? '✔' : '🔴') +
  ' lo apartado quedó guardado en _fuentes/qcart-pauta.json: ' + reP.carritos.length + ' + ' + reP.productos.length);
if (reP.carritos.length !== totC || reP.productos.length !== totP) { console.log('\n  🔴 NO SE ESCRIBE el bloque.'); process.exit(1); }

fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(NUEVO, null, 1));
var re = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var quedan = ['carritos', 'productos'].reduce(function (s, tp) {
  return s + (re[tp] || []).filter(function (e) { return t(e.shortlink_code) && !esNuestro(t(e.shortlink_code)); }).length;
}, 0);
console.log('\n  ✅ PURGADO   ·   bloque releído del disco: ' + re.carritos.length + ' carritos · ' + re.productos.length + ' productos' +
  '   ·   ajenos que quedan: ' + quedan);
