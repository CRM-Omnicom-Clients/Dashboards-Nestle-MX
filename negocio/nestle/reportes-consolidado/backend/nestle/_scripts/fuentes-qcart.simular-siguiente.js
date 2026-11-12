// qcart-bloque · ¿SIRVE PARA LOS SCRIPTS SIGUIENTES? — la prueba que no es circular.
//
// Que qcart-bloque corra y dé verde no prueba nada: lo escribí yo. La prueba real es que los scripts que
// vienen puedan hacer su trabajo con los dos bloques:
//
//   N3 · puerta 1  → ¿puede escribir las dos hojas y sabe qué NO tocar?
//   motor-calculo · motor     → 🔴 ¿puede calcular la penetración SIN que qcart-bloque la haya calculado?
//                     Si no puede, sacar los cálculos del bloque fue un error.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ qcart-bloque · SIMULACIÓN DE LOS SCRIPTS SIGUIENTES ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// ══ motor-calculo · EL MOTOR ═══════════════════════════════════════════════════════════════════
// Se reconstruyen aquí las métricas que qcart-bloque YA NO calcula. Si salen, la separación fue correcta.
console.log('══ motor-calculo · ¿puede calcular lo que el bloque ya no calcula? ══');

function porPieza(bloque) {
  var g = {};
  bloque.forEach(function (e) {
    var k = e.pieza_id; if (!k) return;
    g[k] = g[k] || { eventos: 0, views: 0, impressions: 0, importe: 0, productos: {}, tiendas: {}, dias: {} };
    g[k].eventos++; g[k].views += e.views; g[k].impressions += e.impressions;
    g[k].importe += e.total_shown_price;
    if (e.product) g[k].productos[e.product] = (g[k].productos[e.product] || 0) + e.views;
    g[k].tiendas[e.store] = (g[k].tiendas[e.store] || 0) + e.views;
    g[k].dias[e.fecha] = 1;
  });
  return g;
}
var C = porPieza(B.carritos), P = porPieza(B.productos);

// 1 · PENETRACIÓN NESTLÉ = importe de productos ÷ importe de carritos
var conAmbos = Object.keys(C).filter(function (k) { return P[k]; });
var pen = conAmbos.map(function (k) {
  return { pieza: k, carrito: C[k].importe, nestle: P[k].importe,
    pct: C[k].importe > 0 ? P[k].importe / C[k].importe : null };
}).filter(function (x) { return x.pct !== null; });
console.log('  penetración Nestlé (importe productos ÷ importe carritos):');
pen.sort(function (a, b) { return b.pct - a.pct; }).slice(0, 6).forEach(function (x) {
  console.log('     ' + x.pieza.padEnd(10) + (x.pct * 100).toFixed(1).padStart(6) + '%   $' + mil(Math.round(x.carrito)).padStart(10) + ' carrito · $' + mil(Math.round(x.nestle)).padStart(9) + ' Nestlé');
});
chk('motor-calculo puede derivar la PENETRACIÓN', pen.length > 0,
  pen.length + ' piezas con las dos mitades · el bloque no la trae calculada, y aun así sale');

// 2 · TICKET PROMEDIO = importe ÷ views
var tick = Object.keys(C).filter(function (k) { return C[k].views > 0; })
  .map(function (k) { return { pieza: k, ticket: C[k].importe / C[k].views }; });
console.log('\n  ticket promedio por carrito (importe ÷ views): ' + tick.length + ' piezas');
tick.sort(function (a, b) { return b.ticket - a.ticket; }).slice(0, 3).forEach(function (x) {
  console.log('     ' + x.pieza.padEnd(10) + '$' + x.ticket.toFixed(2));
});
chk('motor-calculo puede derivar el TICKET promedio', tick.length > 0, tick.length + ' piezas');

// 3 · PRODUCTO TOP = el de más views dentro de la pieza
var tops = Object.keys(P).map(function (k) {
  var pr = P[k].productos;
  var mejor = Object.keys(pr).sort(function (a, b) { return pr[b] - pr[a]; })[0];
  return { pieza: k, producto: mejor, views: pr[mejor] };
}).filter(function (x) { return x.producto; });
console.log('\n  producto top por pieza: ' + tops.length + ' piezas');
tops.slice(0, 4).forEach(function (x) { console.log('     ' + x.pieza.padEnd(10) + x.views + ' views · ' + x.producto.slice(0, 44)); });
chk('motor-calculo puede derivar el PRODUCTO TOP', tops.length > 0, tops.length + ' piezas');

// 4 · la granularidad que la hoja vieja NO permitía: por día y por tienda
var porDia = {};
B.carritos.forEach(function (e) { porDia[e.fecha] = (porDia[e.fecha] || 0) + e.views; });
console.log('\n  🔴 lo que la hoja vieja NO permitía: serie diaria y corte por tienda');
console.log('     días con actividad: ' + Object.keys(porDia).length);
var tiendasTot = {};
B.carritos.forEach(function (e) { tiendasTot[e.store] = (tiendasTot[e.store] || 0) + e.views; });
Object.keys(tiendasTot).sort(function (a, b) { return tiendasTot[b] - tiendasTot[a]; }).forEach(function (k) {
  console.log('     ' + String(mil(tiendasTot[k])).padStart(7) + ' views · ' + k);
});
chk('motor-calculo puede cortar por DÍA (la hoja vieja no)', Object.keys(porDia).length > 30,
  Object.keys(porDia).length + ' días — la hoja vieja tenía «Periodo_Reporte: Agosto»');
chk('motor-calculo puede cortar por TIENDA', Object.keys(tiendasTot).length > 1, Object.keys(tiendasTot).length + ' tiendas separadas');

// 5 · el cruce entre las dos hojas es por pieza_id
chk('las dos hojas se cruzan por pieza_id', conAmbos.length > 0,
  conAmbos.length + ' piezas en ambas · sin el ancla no habría penetración');

// ══ N3 · LA PUERTA 1 ════════════════════════════════════════════════════════════════
console.log('\n══ N3 · ¿sabe qué escribir y qué NO tocar? ══');
var campos = Object.keys(B.carritos[0]);
console.log('  columnas de Data_Qcart_Carritos  : ' + campos.length);
console.log('  columnas de Data_Qcart_Productos : ' + Object.keys(B.productos[0]).length);
chk('el bloque declara las dos hojas destino', !!(B.para_el_siguiente && B.para_el_siguiente.dos_hojas),
  (B.para_el_siguiente.dos_hojas || []).join(' · '));
chk('cada evento trae su fuente y su fila de origen',
  B.carritos.every(function (e) { return !!e.fuente; }), 'trazable hasta el CSV y la línea');
chk('el bloque dice que NO trae cálculos', /ninguna columna calculada/i.test(B.para_el_siguiente.ojo || ''),
  B.para_el_siguiente.ojo.slice(0, 60));

// la puerta necesita saber qué hacer con Data_Qcart, la hoja vieja
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2bs.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var hojas = wb.SheetNames;
console.log('  hojas que hoy existen: ' + hojas.filter(function (h) { return /qcart/i.test(h); }).join(' · '));
// 🔴 ESTE CHECK CADUCÓ Y SE PUSO ROJO POR HACER BIEN EL TRABAJO. Decía «las dos hojas nuevas
//    todavía NO existen», y la Puerta 1 las creó: la afirmación era un ESTADO, no una regla.
//    Un check que se rompe cuando el sistema avanza no mide el sistema, mide el calendario.
//    Lo que sí vale antes y después de la puerta, y es lo que de verdad hay que proteger:
//      · `Data_Qcart` —la vieja, con sus 363 fórmulas— sigue viva. Las nuevas CONVIVEN con
//        ella; sustituirla es una decisión de Rick, no un efecto secundario.
//      · si las nuevas ya existen, traen el ancla `pieza_id`; sin ella no hay penetración.
// 🔴 `Data_Qcart` YA NO EXISTE — la retiró Rick el 20-ago-2026 («yo eliminé la hoja, así
//    déjalo, no la requieres»). El check anterior exigía que siguiera viva, y era correcto
//    mientras la decisión estuviera pendiente. Tomada la decisión, lo que hay que garantizar
//    es lo contrario: que las hojas nuevas se BASTEN SOLAS, porque ya no hay red debajo.
var vieja = wb.Sheets['Data_Qcart'];
var CAR = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart_Carritos'] || {}, { defval: '' });
chk('las hojas nuevas se bastan solas (la vieja se retiró)',
  !vieja && CAR.length > 0 && CAR.every(function (x) { return String(x['pieza_id'] || '').trim(); }),
  vieja ? '⚠ la vieja sigue ahí: convivir era lo previo a la decisión'
    : CAR.length + ' filas, todas ancladas por pieza_id · la vieja se retiró por decisión de Rick');

var yaCreadas = hojas.indexOf('Data_Qcart_Carritos') >= 0 && hojas.indexOf('Data_Qcart_Productos') >= 0;
chk('las hojas destino: o no existen aún, o existen ANCLADAS al catálogo',
  !yaCreadas || XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart_Carritos'], { defval: '' })
    .every(function (x) { return String(x['pieza_id'] || '').trim(); }),
  yaCreadas ? 'ya creadas por la puerta · todas sus filas traen pieza_id' : 'aún no existen: las crea la puerta');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(48) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s): el bloque no le sirve al siguiente'
  : '✅ LOS BLOQUES SIRVEN — motor-calculo deriva todo lo que qcart-bloque dejó de calcular, y con MÁS detalle'));
process.exit(fallo ? 1 : 0);
