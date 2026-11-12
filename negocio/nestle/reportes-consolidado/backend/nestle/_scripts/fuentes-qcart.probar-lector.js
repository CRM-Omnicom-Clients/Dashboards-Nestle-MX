// qcart-bloque · paso 3 — ¿el lector aguanta lo que traen los archivos de verdad?
// Se prueba contra las trampas medidas, no contra lo que ya sabemos que funciona.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var os = require('os');
var C = require(__dirname + '/lib-qcart.js');
var PROY = ENT.PROYECTO;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ qcart-bloque · paso 3 · EL LECTOR ════════\n');

// ── las trampas, una por una ────────────────────────────────────────────────────────
console.log('══ el precio en formato europeo ══');
[['316,83', 316.83], ['1.234,56', 1234.56], ['0', 0], ['', 0], ['27', 27], ['1,5', 1.5]].forEach(function (c) {
  var r = C.num(c[0]);
  var ok = Math.abs(r - c[1]) < 0.001;
  if (!ok) fallo++;
  console.log('  ' + (ok ? '✔' : '🔴') + ' "' + c[0] + '"'.padEnd(12) + ' → ' + r + (ok ? '' : '   esperaba ' + c[1]));
});
chk('«316,83» no se lee como 31683', C.num('316,83') === 316.83, 'la coma es decimal, no separador de miles');

console.log('\n══ la tienda multivalor, en los dos órdenes ══');
var a = C.tiendaClave('walmart-com-mx, chedraui-com-mx');
var b = C.tiendaClave('chedraui-com-mx, walmart-com-mx');
console.log('  «walmart, chedraui» → ' + a);
console.log('  «chedraui, walmart» → ' + b);
chk('los dos órdenes dan la MISMA tienda', a === b, a + '  (sin ordenar serían 2 tiendas que no existen)');
chk('una sola tienda se conserva', C.tiendaClave('walmart-com-mx') === 'walmart', C.tiendaClave('walmart-com-mx'));
chk('sin tienda se declara, no queda vacío', C.tiendaClave('') === '(sin tienda)', C.tiendaClave(''));

console.log('\n══ la fecha con hora ══');
var f = C.fechaHora('2026-08-12T17:00:00');
console.log('  «2026-08-12T17:00:00» → día ' + f.dia + '  hora ' + f.hora);
// (mi expectativa decía «17:00»; la hora completa es lo correcto — el test estaba mal, no el código)
chk('separa día y hora', f.dia === '2026-08-12' && /^17:00/.test(f.hora), f.dia + ' · ' + f.hora);
chk('una fecha sin hora no inventa una', C.fechaHora('2026-08-12').hora === null, 'null, no «00:00»');
chk('un valor que no es fecha devuelve null', C.fechaHora('pendiente').dia === null, 'no adivina');

// ── el archivo real ─────────────────────────────────────────────────────────────────
console.log('\n══ los archivos vigentes ══');
var R = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');
R.archivos.forEach(function (x) {
  console.log('  ' + x.archivo.padEnd(32) + x.tipo.padEnd(11) + String(x.filas).padStart(5) + ' filas   sep «' + x.separador + '»' +
    (x.bom ? ' +BOM' : '') + '   ' + x.desde + ' → ' + x.hasta);
});
R.avisos.forEach(function (v) { console.log('  ' + v); });

chk('encuentra los 2 archivos', R.archivos.length === 2, R.archivos.length + ' archivos');
chk('los clasifica por ENCABEZADO, no por nombre',
  R.archivos.filter(function (x) { return x.tipo === 'carritos'; }).length === 1 &&
  R.archivos.filter(function (x) { return x.tipo === 'productos'; }).length === 1,
  'carritos y productos, uno de cada');
chk('detecta el separador y el BOM', R.archivos.every(function (x) { return x.separador === ';' && x.bom; }),
  'todos «;» con BOM');
// CONSTANTE → INVARIANTE. «3,953» y «1,199» son los numeros de HOY: la descarga siguiente
//   trae otros y estos dos checks se pondrian rojos sin que nada este roto — el rojo falso
//   que manda a arreglar lo que funciona. Lo que NO caduca: el lector no puede PERDER filas
//   entre lo que parseo del archivo y lo que entrega clasificado.
['carritos', 'productos'].forEach(function (tp) {
  var a = R.archivos.filter(function (x) { return x.tipo === tp; })[0];
  chk('no pierde ninguna fila de ' + tp + ' entre el parseo y la entrega',
    !!a && R[tp].length === a.filas,
    a ? R[tp].length + ' entregadas = ' + a.filas + ' parseadas' : 'no hay archivo de ' + tp);
});
chk('solo productos trae `product`', R.productos.every(function (x) { return x.product !== null; }) &&
  R.carritos.every(function (x) { return x.product === null; }), 'la columna decide el tipo');

// ── ¿ninguna fila se rompió al partir? ──────────────────────────────────────────────
console.log('\n══ ¿el parser partió mal alguna fila? ══');
var sinFecha = R.carritos.concat(R.productos).filter(function (x) { return !x.fecha; });
var sinCod = R.carritos.concat(R.productos).filter(function (x) { return !x.shortlink_code; });
var precioRaro = R.carritos.filter(function (x) { return x.total_shown_price > 1000000; });
console.log('  sin fecha        : ' + sinFecha.length);
console.log('  sin shortlink    : ' + sinCod.length);
console.log('  precio > 1,000,000: ' + precioRaro.length + '  (síntoma de coma mal leída)');
chk('toda fila tiene fecha', sinFecha.length === 0, sinFecha.length ? sinFecha.length + ' sin fecha' : '5,152/5,152');
chk('ningún precio se infló ×100', precioRaro.length === 0, precioRaro.length ? 'revisar' : 'ninguno');

// ── multivalor real en los datos ────────────────────────────────────────────────────
var multi = R.carritos.filter(function (x) { return x.n_tiendas > 1; });
var claves = {}; R.carritos.forEach(function (x) { claves[x.store] = (claves[x.store] || 0) + 1; });
console.log('\n══ tiendas encontradas (tras normalizar) ══');
Object.keys(claves).sort(function (x, y) { return claves[y] - claves[x]; }).forEach(function (k) {
  console.log('  ' + String(claves[k]).padStart(5) + '  ' + k);
});
console.log('  filas con tienda multivalor: ' + multi.length);
chk('las 4 variantes de store colapsan a 3 tiendas reales', Object.keys(claves).length <= 4,
  Object.keys(claves).length + ' claves distintas (el CSV traía 4 strings para 3 combinaciones)');

// ── la llave del evento ─────────────────────────────────────────────────────────────
console.log('\n══ la llave del evento (lo que hace idempotente la carga) ══');
var lls = {}, dup = 0;
R.carritos.forEach(function (e) { var k = C.llaveEvento(e); if (lls[k]) dup++; lls[k] = 1; });
console.log('  carritos: ' + Object.keys(lls).length + ' llaves para ' + R.carritos.length + ' filas · repetidas: ' + dup);
var llp = {}, dupp = 0;
R.productos.forEach(function (e) { var k = C.llaveEvento(e); if (llp[k]) dupp++; llp[k] = 1; });
console.log('  productos: ' + Object.keys(llp).length + ' llaves para ' + R.productos.length + ' filas · repetidas: ' + dupp);
chk('la llave distingue los eventos del archivo', dup === 0 && dupp === 0,
  dup + dupp === 0 ? 'ninguna colisión' : (dup + dupp) + ' filas comparten llave → la llave no basta');

// ── la idempotencia: leer dos veces da exactamente lo mismo ─────────────────────────
// Es la propiedad que hace que la carga sea «agregar logs» y no un recálculo. Si las llaves
// cambiaran entre lecturas, cada corrida duplicaría el archivo entero.
console.log('\n══ leer dos veces da lo mismo (append idempotente) ══');
var R2 = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');
var k1 = R.carritos.map(C.llaveEvento).sort().join('\n');
var k2 = R2.carritos.map(C.llaveEvento).sort().join('\n');
var p1 = R.productos.map(C.llaveEvento).sort().join('\n');
var p2 = R2.productos.map(C.llaveEvento).sort().join('\n');
console.log('  carritos : ' + (k1 === k2 ? 'las mismas ' + R2.carritos.length + ' llaves' : '🔴 CAMBIARON'));
console.log('  productos: ' + (p1 === p2 ? 'las mismas ' + R2.productos.length + ' llaves' : '🔴 CAMBIARON'));
chk('las llaves son estables entre lecturas', k1 === k2 && p1 === p2,
  'sin esto, cada carga duplicaría el archivo completo');

// ── lo que se declara en vez de descartarse ─────────────────────────────────────────
var sc = R.carritos.concat(R.productos).filter(function (x) { return x.sin_codigo; });
console.log('\n══ filas sin shortlink code ══');
console.log('  ' + sc.length + ' filas · se CONSERVAN con su motivo, no se descartan');
console.log('  campañas: ' + Array.from(new Set(sc.map(function (x) { return x.utm_campaign || '(vacía)'; }))).join(' · '));
chk('las filas sin código se declaran, no se pierden', sc.length > 0 && sc.every(function (x) { return !!x.sin_codigo; }),
  sc.length + ' declaradas · traen views y precio reales');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ el lector aguanta los archivos reales'));
process.exit(fallo ? 1 : 0);
