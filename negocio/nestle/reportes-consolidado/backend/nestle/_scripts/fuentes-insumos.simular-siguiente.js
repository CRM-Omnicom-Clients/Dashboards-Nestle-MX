// insumos-validar · ¿SIRVE PARA EL SCRIPT SIGUIENTE? — la prueba que no es circular.
//
// Que insumos-validar corra y dé verde no prueba nada: lo escribí yo y validé mi propia salida.
// La prueba real es que **email-bloque pueda hacer su trabajo con el handoff, sin re-derivar**.
//
// Se simula el arranque de email-bloque (bloque de email) usando SOLO `_insumos/inventario.json`:
//   · ¿sabe qué archivo abrir, sin volver a inventariar la carpeta?
//   · ¿sabe dónde está el encabezado, sin volver a buscarlo?
//   · ¿la cifra de control cuadra contra el archivo real?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var D = require(__dirname + '/lib-datorama.js');
var BACK = require('path').resolve(__dirname, '..');
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ insumos-validar · SIMULACIÓN DEL SCRIPT SIGUIENTE (email-bloque) ════════\n');

var inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));

// ── 1 · ¿email-bloque sabe qué abrir SIN volver a inventariar?
var f = inv.forma && inv.forma.email;
chk('email-bloque sabe qué archivo abrir', !!(f && f.ruta), f ? f.archivo : 'el handoff no trae la ruta');
chk('y sabe por qué ese y no otro', !!(f && f.sello && f.frescura),
  f ? 'sello ' + f.sello + ' · elegido por ' + f.frescura : '—');
console.log('  → email-bloque NO tiene que listar la carpeta ni comparar 18 archivos: ya viene resuelto.\n');

// ── 2 · ¿el handoff le ahorra descubrir la forma?
chk('el handoff avisa del preámbulo', !!(f && /preámbulo|encabezado/i.test(f.nota || '')),
  f ? f.nota : '—');
var q = inv.forma && inv.forma.qcart;
chk('el handoff trae los esquemas de Qcart', !!(q && q.esquemas && q.esquemas.length),
  q ? q.esquemas.length + ' esquemas, con sus columnas' : '—');
chk('y avisa de separador y BOM variables', !!(q && /separador|BOM/i.test(q.nota || '')), q ? q.nota : '—');

// ── 3 · 🔴 LA VERIFICACIÓN DE UNA CIFRA — la regla del agente viejo
//    "verifica UNA sola de esas cifras contra el archivo. Si cuadra, das el resto por bueno.
//     Si NO cuadra, ahí sí paras todo: una medición mala envenena el script entero."
console.log('  ── la cifra de control, contra el archivo REAL');
var ok = false, detalle = '';
if (f && f.ruta && fs.existsSync(f.ruta)) {
  var R = D.leerArchivo(f.ruta);
  var filas = R.hojas.reduce(function (a, h) { return a + h.filas.length; }, 0);
  var selloReal = R.generado ? R.generado.txt : '';
  ok = selloReal === f.sello;
  detalle = 'handoff dice "' + f.sello + '" · el archivo dice "' + selloReal + '"  ·  ' + filas + ' filas leídas';
} else { detalle = 'no se pudo abrir el archivo que el handoff señala'; }
chk('la cifra de control cuadra contra el archivo', ok, detalle);

// ── 4 · ¿email-bloque arranca de verdad con esto?
console.log('\n  ── arranque real de email-bloque usando solo el handoff');
var arranco = false, nEnvios = 0;
try {
  var R2 = D.leerArchivo(f.ruta);
  var conDatos = R2.hojas.filter(function (h) { return h.filas.length; });
  nEnvios = conDatos.reduce(function (a, h) { return a + h.filas.length; }, 0);
  arranco = conDatos.length > 0 && nEnvios > 0;
  conDatos.forEach(function (h) { console.log('     ' + h.hoja.padEnd(16) + String(h.filas.length).padStart(4) + ' filas · ' + h.cols.length + ' columnas'); });
} catch (e) { detalle = e.message; }
chk('email-bloque arranca y lee filas con el handoff', arranco, nEnvios + ' filas en ' + (arranco ? 'todas sus hojas' : '—'));

// ── 5 · lo que el handoff NO resuelve, ¿está declarado?
console.log('\n  ── lo que email-bloque todavía tiene que resolver por su cuenta');
var tareas = (inv.tareas || []).filter(function (x) { return /esquema|periodo|WK mayor/i.test(x); });
chk('los límites del handoff están declarados', tareas.length > 0,
  tareas.length + ' avisos que email-bloque debe tener en cuenta');
tareas.forEach(function (x) { console.log('     · ' + x.slice(0, 110)); });

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(44) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s): el handoff no le sirve al paso siguiente'
  : '✅ EL HANDOFF SIRVE — email-bloque arranca sin re-derivar nada'));
process.exit(fallo ? 1 : 0);
