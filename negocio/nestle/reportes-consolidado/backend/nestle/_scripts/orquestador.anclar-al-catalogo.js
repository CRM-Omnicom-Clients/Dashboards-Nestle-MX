// ANCLA al catálogo raíz todo script de ejecución que lea columnas.
//
// 🔴 LA REGLA, DE RICK (26-ago): *«Todos los scripts tienen que estar relacionados con el catálogo
//    raíz. No puede haber ningún script suelto de eso.»* Y la razón que dio es el diseño entero:
//    el catálogo guarda el **id lógico inmutable** y su **nombre físico actual**; si todo pregunta
//    ahí, un renombre cambia UNA fila del catálogo en vez de 143 scripts.
//
// 🔴 QUÉ SIGNIFICA «ANCLAR» AQUÍ, y no es poner un `require` decorativo:
//    el script declara su ámbito y pide sus columnas por `COL.de(filas, id, ambito)`. `lib-columna`
//    consulta el catálogo PRIMERO y la hoja después; si el catálogo dice un nombre que la hoja ya
//    no tiene, truena y pide que se registre el renombre — que es exactamente el hecho que el
//    catálogo existe para capturar.
//
// 🔴 ESTE SCRIPT NO REESCRIBE LÓGICA. Inserta el `require` y la declaración de ámbito, y deja el
//    resto al script. Reescribir 19 lecturas a mano es donde hoy ya rompí cosas dos veces; el
//    anclaje se hace obligatorio con la GUARDA, no reescribiendo a ciegas.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));

// el ámbito de cada skill dentro del catálogo raíz
var AMBITO = {
  'crm-reporte-resumen': 'resumen', 'crm-reporte-nestle-catalogo': 'catalogo',
  'crm-reporte-fuentes-email': 'email', 'crm-reporte-fuentes-qcart': 'qcart',
  'crm-reporte-fuentes-whatsapp': 'whatsapp', 'crm-reporte-fuentes-manual': 'manual',
  'crm-reporte-fuentes-cuadre': 'cuadre', 'crm-reporte-escritor': 'escritor',
  'crm-reporte-motor': 'motor', 'crm-reporte-nestle-insights': 'insights',
  'crm-reporte-fuentes-insumos': 'insumos', 'crm-reporte-orquestador': 'orquestador'
};

var enCadena = [];
C.etapas.forEach(function (e) {
  e.scripts.forEach(function (n) {
    enCadena.push({ f: n.script, skill: e.skill });
    (n.suites || []).forEach(function (s) { enCadena.push({ f: s, skill: e.skill }); });
  });
});
var vistos = {};
enCadena = enCadena.filter(function (x) { if (vistos[x.f]) return false; vistos[x.f] = 1; return true; });

console.log('════════ ANCLAR AL CATÁLOGO RAÍZ ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var anclar = [], ya = [], noLeen = [];
enCadena.forEach(function (x) {
  var p = path.join(D, x.f);
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8');
  var lee = /sheet_to_json|\[['"][A-ZÁÉÍÓÚ][^\]'"]*['"]\]/.test(t);
  if (!lee) { noLeen.push(x.f); return; }
  if (/lib-columna/.test(t)) { ya.push(x.f); return; }
  anclar.push(x);
});

console.log('  scripts del corte que leen columnas: ' + (anclar.length + ya.length));
console.log('    ✔ ya anclados: ' + ya.length);
console.log('    → por anclar:  ' + anclar.length + '\n');
anclar.forEach(function (x) {
  console.log('     ' + AMBITO[x.skill].padEnd(12) + x.f);
});

if (!ESCRIBIR) { console.log('\n  (seco. Para anclar: --escribir)'); process.exit(0); }

var hechos = 0;
anclar.forEach(function (x) {
  var p = path.join(D, x.f);
  var t = fs.readFileSync(p, 'utf8');
  var amb = AMBITO[x.skill] || 'orquestador';

  // se inserta justo después de `_initPaths()`, que es donde todos resuelven sus módulos
  var ancla = "\n// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta\n" +
    "//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.\n" +
    "//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.\n" +
    "var COL = require(__dirname + '/lib-columna.js');\n" +
    "var AMBITO_CATALOGO = '" + amb + "';   // el ámbito de este skill dentro del catálogo raíz\n";

  // 🔴 `\r?\n`, NO `\n`. Git convierte los finales de línea a CRLF en Windows, y el regex con `\n`
  //    pelado falló en 15 de 24 archivos: los saltó en silencio y reportó «no encontré dónde
  //    insertar». Suponer el formato del archivo en vez de comprobarlo — la misma familia de
  //    error que leer una columna por un nombre escrito a mano.
  var m = /require\('module'\)\.Module\._initPaths\(\);\r?\n/.exec(t);
  if (!m) { console.log('     ⊘ ' + x.f + ': no encontré dónde insertar el ancla'); return; }
  t = t.slice(0, m.index + m[0].length) + ancla + t.slice(m.index + m[0].length);
  fs.writeFileSync(p, t);
  hechos++;
});

console.log('\n  anclados: ' + hechos + ' de ' + anclar.length);

// ── VERIFICACIÓN DE SISTEMA — sin correr el corte, sin tocar el Excel
console.log('\n  ══ VERIFICACIÓN DE SISTEMA ══');
var cp = require('child_process'), malos = [];
enCadena.forEach(function (x) {
  var p = path.join(D, x.f);
  if (!fs.existsSync(p)) return;
  var r = cp.spawnSync(process.execPath, ['-c', p], { encoding: 'utf8' });
  if (r.status !== 0) malos.push(x.f);
});
console.log('   ' + (malos.length ? '🔴' : '✔') + ' los ' + enCadena.length + ' scripts del corte parsean' +
  (malos.length ? ': ' + malos.join(' · ') : ''));

var sueltos = [];
enCadena.forEach(function (x) {
  var p = path.join(D, x.f);
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8');
  var lee = /sheet_to_json|\[['"][A-ZÁÉÍÓÚ][^\]'"]*['"]\]/.test(t);
  if (lee && !/lib-columna/.test(t)) sueltos.push(x.f);
});
console.log('   ' + (sueltos.length ? '🔴' : '✔') + ' ningún script del corte lee columnas sin el catálogo: ' +
  (sueltos.length ? sueltos.join(' · ') : 'los ' + (anclar.length + ya.length) + ' anclados'));

// que el ancla apunte a un catálogo que de verdad responde
var COL = require(D + '/lib-columna.js');
var n = Object.keys(COL.registro()).length;
console.log('   ' + (n > 0 ? '✔' : '🔴') + ' el catálogo raíz responde: ' + n + ' columnas registradas');
process.exit(malos.length || sueltos.length ? 1 : 0);
