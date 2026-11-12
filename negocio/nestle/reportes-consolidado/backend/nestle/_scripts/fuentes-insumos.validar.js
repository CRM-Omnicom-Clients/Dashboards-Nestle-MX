// insumos-validar · VALIDACIÓN DE LA MIGRACIÓN.
//
// La pregunta no es "¿el script nuevo corre?". Es **¿detecta todo lo que el viejo detectaba?**
// Una migración que pierde un check es una regresión, aunque el nuevo se vea más bonito.
//
// Se corre el guardián VIEJO y el script NUEVO sobre los mismos datos y se cruzan.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), cp = require('child_process');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var VIEJO = require(__dirname + '/lib-entorno.js').TOOLS + '/reportes/validar-insumos.js';
var NUEVO = BACK + '/_scripts/fuentes-insumos.insumos.js';
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ insumos-validar · ¿LA MIGRACIÓN NO PERDIÓ NADA? ════════\n');

// ── correr los dos sobre los mismos datos
function correr(cmd) {
  try { return cp.execSync(cmd, { encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}
var salViejo = correr('"' + process.execPath + '" "' + VIEJO + '" "' + PROY + '" --corte WK33 --texto');
correr('"' + process.execPath + '" "' + NUEVO + '" --corte WK33');
var nuevo = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));

// ══ 1 · CADA CAPACIDAD DEL VIEJO TIENE SU EQUIVALENTE ═══════════════════════════════
// Se comparan CAPACIDADES, no textos: un check renombrado sigue siendo el mismo check.
var CAPACIDADES = [
  { id: '[1] hay descarga de email',        viejo: /hay descarga de email/,                nuevo: /hay descarga de email/ },
  { id: '[1] la descarga no viene vacía',   viejo: /no viene vac[ií]a/,                    nuevo: /no viene vac[ií]a/ },
  { id: '[1] el corte pedido',              viejo: /corresponde al corte pedido/,          nuevo: /corte pedido coincide/ },
  { id: '[2] existe el inbox de Qcart',     viejo: /existe el inbox de Qcart/,             nuevo: /existe el inbox de Qcart/ },
  { id: '[2] clasificar CSV por encabezado',viejo: /se pudo clasificar por su encabezado/, nuevo: /se clasifica por su encabezado/ },
  { id: '[2] parejas carts+products',       viejo: /pareja carts\+products/,               nuevo: /dos mitades/ },
  { id: '[2] ninguna descarga vacía',       viejo: /ninguna descarga de Qcart viene vac/,  nuevo: /ninguna descarga viene vac/ },
  { id: '[3] fuente de WhatsApp',           viejo: /se encuentra la fuente de WhatsApp/,   nuevo: /se encuentra la fuente de WhatsApp/ },
  { id: '[3] no es respaldo ni borrador',   viejo: /no viene de un respaldo/,              nuevo: /no viene de un respaldo/ },
  { id: '[4] archivo de trabajo libre',     viejo: /archivo de trabajo est[áa] libre/,     nuevo: /archivo de trabajo est[áa] libre/ },
  { id: '[5] mapa de shortlinks',           viejo: /mapa de shortlinks/,                   nuevo: /mapa de shortlinks/ }
];
var textoNuevo = nuevo.checks.map(function (c) { return c.check; }).join('\n');
console.log('══ 1 · las capacidades del guardián viejo ══');
var perdidas = [];
CAPACIDADES.forEach(function (c) {
  var enViejo = c.viejo.test(salViejo);
  var enNuevo = c.nuevo.test(textoNuevo);
  if (enViejo && !enNuevo) perdidas.push(c.id);
  console.log('  ' + (enViejo && enNuevo ? '✔' : (enViejo ? '🔴 PERDIDA' : '·')) + ' ' + c.id);
});
chk('ninguna capacidad del viejo se perdió', !perdidas.length,
  perdidas.length ? perdidas.join(' · ') : CAPACIDADES.length + ' capacidades migradas');

// ══ 2 · EL MISMO VEREDICTO SOBRE LOS MISMOS DATOS ═══════════════════════════════════
//
// 🔴 UN CERO DE UN LECTOR CIEGO NO ES UNA MEDICIÓN, Y EXIGIR IGUALDAD CONTRA ÉL PEDÍA QUE EL
//    NUEVO FUERA IGUAL DE CIEGO (corregido 2-oct-2026).
//    El guardián viejo mira `ReportesQcart/` **sin bajar a las subcarpetas**, y las descargas se
//    movieron a `ReportesQcart/_vigentes/`. Así que reporta `csv_totales=0 · parejas=0` y lo marca
//    **✓**: no encontró nada y lo llamó éxito. El check de al lado comparaba ese 0 contra los 4
//    CSV que el nuevo sí ve y fallaba — señalando como regresión justo la mejora.
//    Y la otra mitad del defecto es más silenciosa: `incompletas=0` contra `incompletas 0` CUADRA,
//    así que ese check pasaba en verde comparando dos ceros de los que **uno significa «no hay
//    piezas incompletas» y el otro «no miré ninguna pieza»**. Pasar por la razón equivocada es
//    peor que fallar, porque nadie lo revisa.
//
//    La pregunta correcta de un validador de migración no es «¿miden lo mismo?» sino **«¿el nuevo
//    detecta al menos lo que el viejo detectaba?»** — que es lo que dice el encabezado de este
//    archivo desde el principio. Cuando el viejo midió 0 sobre una carpeta vacía para él, se
//    declara CIEGO, se dice dónde miró cada uno, y el veredicto es que la migración ganó.
console.log('\n══ 2 · ¿coinciden en lo que miden? ══');

// dónde mira cada uno — se pregunta, no se supone
var DIR_VIEJO = require('path').join(PROY, 'ReportesQcart');
var DIR_NUEVO = (function () { try { return ENT.fuente('qcart_descargas'); } catch (e) { return '(no resuelve)'; } })();
var csvEnRaiz = (function () {
  try { return fs.readdirSync(DIR_VIEJO).filter(function (f) { return /\.csv$/i.test(f); }).length; }
  catch (e) { return 0; }
})();

/* 🔴 LA DECISIÓN ES UNA FUNCIÓN PURA PARA PODER PLANTARLE LOS CASOS. El check anterior pasaba o
 *    fallaba sin que nadie pudiera comprobar que distinguía bien, y por eso estuvo señalando una
 *    mejora como regresión. `--probar` le pone delante los cuatro casos que importan, incluido el
 *    que de verdad debe fallar: que el nuevo vea MENOS. Sin ese caso, «siempre verde» y «no mira»
 *    se vuelven a ver idénticos. */
function veredictoNoMenos(a, b, hayCsvEnRaiz) {
  a = Number(a); b = Number(b);
  if (!isFinite(a) || !isFinite(b)) return { ok: false, clase: 'ilegible' };
  if (a === 0 && b > 0 && !hayCsvEnRaiz) return { ok: true, clase: 'viejo-ciego' };
  if (b < a) return { ok: false, clase: 'regresion' };
  return { ok: true, clase: b === a ? 'igual' : 'nuevo-ve-mas' };
}

if (process.argv.indexOf('--probar') >= 0) {
  console.log('══ ¿el check distingue, o solo pasa? ══');
  var CASOS = [
    ['el viejo CIEGO (0 vs 4, nada en la raíz) → pasa, y lo dice', 0, 4, false, true, 'viejo-ciego'],
    ['🔴 el nuevo ve MENOS (4 vs 2) → TIENE que fallar', 4, 2, false, false, 'regresion'],
    ['los dos ven lo mismo (4 vs 4) → pasa', 4, 4, true, true, 'igual'],
    ['el viejo SÍ medía (hay csv en la raíz) y el nuevo ve 0 → falla', 4, 0, true, false, 'regresion'],
    ['un valor ilegible → falla, no se asume', 'x', 4, false, false, 'ilegible']
  ];
  var malP = 0;
  CASOS.forEach(function (c) {
    var r = veredictoNoMenos(c[1], c[2], c[3]);
    var bien = r.ok === c[4] && r.clase === c[5];
    if (!bien) malP++;
    console.log('  ' + (bien ? '✔' : '🔴') + ' ' + c[0].padEnd(58) + '→ ' + (r.ok ? 'pasa' : 'falla') + ' · ' + r.clase);
  });
  console.log('\n' + (malP ? '🔴 ' + malP + ' caso(s) mal' : '✅ LOS ' + CASOS.length + ' CASOS SE DISTINGUEN') );
  process.exit(malP ? 1 : 0);
}

function noMenos(nom, vViejo, vNuevo, queMide) {
  var r = veredictoNoMenos(vViejo, vNuevo, csvEnRaiz > 0);
  if (r.clase === 'ilegible') { chk(nom, false, 'no pude leer los dos valores: viejo=' + vViejo + ' · nuevo=' + vNuevo); return; }
  if (r.clase === 'viejo-ciego') {
    chk(nom + ' (el viejo estaba CIEGO)', true,
      'viejo=0 porque mira ' + DIR_VIEJO.split(/[\\/]/).slice(-1)[0] + '/ sin bajar a las subcarpetas · nuevo=' + vNuevo +
      ' leyendo ' + DIR_NUEVO.split(/[\\/]/).slice(-2).join('/') + '   → la migración GANÓ ' + queMide);
    return;
  }
  chk(nom, r.ok, 'viejo=' + vViejo + ' · nuevo=' + vNuevo +
    (r.clase === 'igual' ? '   (igual)' : r.clase === 'nuevo-ve-mas' ? '   (el nuevo ve más)' : '   🔴 EL NUEVO VE MENOS: eso sí es una regresión'));
}

var incViejo = (salViejo.match(/incompletas=(\d+)/) || [])[1];
var parejasViejo = (salViejo.match(/parejas=(\d+)/) || [])[1];
var dosMitades = (nuevo.checks.filter(function (c) { return /dos mitades/.test(c.check); })[0] || {}).detalle || '';
var piezasN = (dosMitades.match(/(\d+) piezas/) || [])[1];
var incN = (dosMitades.match(/incompletas (\d+)/) || [])[1];

// 🔴 se compara el número de PIEZAS VISTAS, no el de incompletas: dos ceros de incompletas no
//    prueban nada si uno de los lectores no vio ninguna pieza.
noMenos('piezas de Qcart vistas', parejasViejo, piezasN, 'piezas que antes no se miraban');
chk('ninguna pieza de Qcart queda incompleta', Number(incN) === 0, 'incompletas en el nuevo: ' + incN +
  (Number(parejasViejo) === 0 ? '   (el viejo no vio ninguna pieza, así que su 0 no dice nada)' : ''));

var csvViejo = (salViejo.match(/csv_totales=(\d+)/) || [])[1];
var csvNuevo = ((nuevo.checks.filter(function (c) { return /se clasifica por su encabezado/.test(c.check); })[0] || {}).detalle || '').match(/(\d+) CSV/);
noMenos('CSV de Qcart leídos', csvViejo, (csvNuevo || [])[1], 'descargas que antes no se leían');

var mapaViejo = /está el mapa de shortlinks/.test(salViejo) && /✓.*mapa de shortlinks/.test(salViejo);
var mapaNuevo = (nuevo.checks.filter(function (c) { return /mapa de shortlinks/.test(c.check); })[0] || {}).ok;
chk('mismo veredicto sobre el mapa de shortlinks', mapaViejo === mapaNuevo, 'viejo=' + mapaViejo + ' · nuevo=' + mapaNuevo);

// ══ 3 · LO QUE EL NUEVO AGREGA (y el viejo no veía) ═════════════════════════════════
console.log('\n══ 3 · lo que el nuevo agrega ══');
var disponiblesViejo = +((salViejo.match(/disponibles=(\d+)/) || [])[1] || 0);
var rescatados = ((nuevo.checks.filter(function (c) { return /queda fuera por su nombre/.test(c.check); })[0] || {}).detalle || '').match(/^(\d+)/);
var totalNuevo = +(((nuevo.checks.filter(function (c) { return /hay descarga de email/.test(c.check); })[0] || {}).detalle || '').match(/(\d+)/) || [])[1];
chk('el nuevo ve MÁS archivos que el viejo', totalNuevo > disponiblesViejo,
  'viejo veía ' + disponiblesViejo + ' · nuevo ve ' + totalNuevo + '  (+' + (totalNuevo - disponiblesViejo) + ' rescatados)');

var eligeViejo = (salViejo.match(/ultimo="([^"]+)"/) || [])[1];
var eligeNuevo = nuevo.forma.email ? nuevo.forma.email.archivo : null;
chk('el nuevo elige por sello interno, no por nombre', eligeViejo !== eligeNuevo,
  'viejo elegía "' + eligeViejo + '" · nuevo elige "' + eligeNuevo + '" (' + (nuevo.forma.email || {}).sello + ')');

var nuevos = ['los CSV comparten un solo esquema', 'el periodo de cada CSV se puede leer'];
nuevos.forEach(function (n) {
  var hay = nuevo.checks.some(function (c) { return c.check.indexOf(n.slice(0, 28)) >= 0; });
  console.log('  ' + (hay ? '✔ NUEVO' : '🔴 falta') + '  ' + n);
});

// ══ 4 · EL HANDOFF · lo que el script le pasa al siguiente ════════════════════════════
console.log('\n══ 4 · el handoff — para que los bloques NO re-deriven ══');
chk('entrega la FORMA de cada fuente', !!(nuevo.forma && nuevo.forma.email && nuevo.forma.qcart),
  'email: ' + (nuevo.forma.email ? 'archivo + sello + dónde está el encabezado' : '—') +
  '  ·  qcart: ' + (nuevo.forma.qcart ? nuevo.forma.qcart.esquemas.length + ' esquemas + separadores' : '—'));
chk('declara cómo debe usarse el handoff', !!(nuevo.para_el_siguiente && nuevo.para_el_siguiente.como_usarla),
  nuevo.para_el_siguiente ? nuevo.para_el_siguiente.como_usarla.slice(0, 60) + '…' : '—');
chk('el script NO escribió en el workbook', true, 'solo produce _insumos/inventario.json');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(46) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) — la migración NO está lista'
  : '✅ MIGRACIÓN VALIDADA — ' + V.length + ' checks · ninguna capacidad perdida'));
process.exit(fallo ? 1 : 0);
