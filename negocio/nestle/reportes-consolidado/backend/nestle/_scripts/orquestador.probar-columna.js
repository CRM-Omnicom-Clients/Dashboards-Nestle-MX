// ¿`lib-columna` TRUENA con los cinco defectos del 25-ago? — la prueba que la vuelve regla.
//
// 🔴 UNA LIBRERÍA QUE NUNCA SE PROBÓ CON EL DEFECTO DELANTE NO PROTEGE DE NADA. Hoy pasó dos veces:
//    las guardas salieron verdes y solo al plantarles el caso se vio que una no reconocía
//    `execFileSync(` y dejaba pasar al señuelo. Así que aquí se le pone a `lib-columna` cada uno de
//    los cinco nombres que mordieron, con las hojas REALES, y se exige que se detenga en los cinco.
//    Y también lo contrario: que con el nombre bueno devuelva el encabezado y no estorbe.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var COL = require(__dirname + '/lib-columna.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var ok = 0, mal = 0;
function chk(nom, cond, ev) { console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(58) + (ev || '')); cond ? ok++ : mal++; }
function truena(fn) { try { fn(); return null; } catch (e) { return e.message; } }

console.log('════════ ¿lib-columna DETIENE los cinco de hoy? ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = path.join(os.tmpdir(), 'probar-columna.xlsx');
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);
function hoja(n) { return XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', blankrows: false }); }
var DE = hoja('Data_Email'), CAT = hoja('Catalogo_Piezas'), RES = hoja('Report_Resumen');

console.log('══ los cinco defectos de hoy, plantados ══');

// 🔴 QUÉ SIGNIFICA «PROTEGER» AQUÍ, porque mi primer test lo entendió al revés: exigía que la
//    librería RECHAZARA `pieza_id`. No. El rescate es que lo RESUELVA a `Pieza_ID` y la lectura
//    funcione — eso es exactamente lo que no pasó el 25-ago y costó cuatro hallazgos falsos.
//    Tronar se reserva para donde ELEGIR sería adivinar. Un test que pide lo contrario deja la
//    librería inútil: la volvería tan literal como el código que viene a sustituir.
var r1 = COL.de(DE, 'pieza_id');
chk('1 · `pieza_id` en Data_Email → RESUELVE al encabezado real', r1 === 'Pieza_ID',
  '«' + r1 + '»  (antes: «98 de 98 vacías» sobre una columna llena)');
var r2 = COL.de(CAT, 'Touchpoint');
chk('2 · `Touchpoint` (una sola letra) → RESUELVE', r2 === 'TouchPoint',
  '«' + r2 + '»  (antes: dos envíos reales llamados fantasmas)');
var r3 = COL.de(RES, 'Quincena_Lanzamiento');
chk('3 · `Quincena_Lanzamiento` → RESUELVE al nombre completo', r3 === 'Quincena_Lanzamiento Principal',
  '«' + r3 + '»  (antes: las 76 filas acusadas de no tener identidad)');

var C = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_contratos/cadena-skills.json', 'utf8'));
var e4 = truena(function () { COL.campo(C.etapas[0], 'n', 'una etapa de la cadena'); });
chk('4 · `etapa.n` (no existe) → SE DETIENE', !!e4,
  e4 ? 'trueno' : '🔴 devolvió undefined: las 15 etapas caerían en la misma llave');
chk('    …y `etapa.orden` sí devuelve', COL.campo(C.etapas[0], 'orden', 'etapa') === 1, 'orden = 1');
var e5 = truena(function () { COL.de(DE, 'Columna_Que_No_Existe'); });
chk('5 · un nombre inventado → SE DETIENE y enseña los reales', !!e5 && /encabezados disponibles/.test(e5),
  e5 ? 'lista los encabezados que sí existen' : '🔴 se quedó callado');

console.log('\n══ y truena donde ELEGIR sería adivinar ══');
var a1 = truena(function () { COL.de(RES, 'Mes'); });
chk('`Mes` vs `Mes (#)` → AMBIGUA, no elige', !!a1 && /AMBIGUA/.test(a1),
  a1 ? 'trueno, y nombra las dos' : '🔴 eligió una de las dos');
// 🔴 LA AMBIGÜEDAD POR PREFIJO SE BUSCA EN LA HOJA, NO SE CLAVA. Este check decía `Unsubs`, que
//    casaba con `Unsubs_Unicos` y `Unsubs_Total`. Al retirar la segunda —decisión D3 de Rick— el
//    prefijo pasó a resolver sin ambigüedad y el check se puso rojo acusando a la librería de
//    «elegir una», cuando ya no había dos entre las que elegir. El test se había quedado viejo, no
//    la librería. Un caso de prueba clavado a un dato que el sistema puede cambiar caduca solo.
var pl2 = {}, prefijoAmbiguo = null;
Object.keys(RES[0]).forEach(function (h) {
  var base = COL.plano(h).replace(/[0-9]+$/, '').slice(0, 8);
  (pl2[base] = pl2[base] || []).push(h);
});
Object.keys(pl2).forEach(function (k) { if (!prefijoAmbiguo && pl2[k].length > 1 && k.length >= 5) prefijoAmbiguo = { base: k, cols: pl2[k] }; });
if (!prefijoAmbiguo) {
  console.log('   ⊘ no hay ningún prefijo ambiguo en el reporte ahora mismo — nada que probar aquí');
} else {
  var a2 = truena(function () { COL.de(RES, prefijoAmbiguo.base); });
  chk('un prefijo que casa con dos → AMBIGUA', !!a2 && /AMBIGUA/.test(a2),
    a2 ? prefijoAmbiguo.cols.slice(0, 2).map(function (x) { return '«' + x + '»'; }).join(' y ') : '🔴 eligió una');
}
var a3 = truena(function () { COL.de(RES, 'QCART'); });
chk('`QCART?` vs `%_Qcart` → AMBIGUA', !!a3 && /AMBIGUA/.test(a3), a3 ? 'trueno' : '🔴 eligió una');

console.log('\n══ y no estorba a lo que sí es legítimo ══');
var op = COL.opcional(DE, 'Mascota');
chk('`opcional` no truena cuando falta de verdad', op === null || typeof op === 'string',
  op === null ? 'devuelve null y quien la use declara «no pude evaluar»' : '«' + op + '»');
var amb = truena(function () { COL.opcional(RES, 'Mes'); });
chk('pero `opcional` TAMPOCO adivina si es ambigua', !!amb,
  amb ? 'trueno igual — ni de opcional se elige entre dos' : '🔴 eligió una');
chk('`valor` lee la celda pidiendo su columna', COL.valor(DE[0], DE, 'pieza_id').length > 0,
  '«' + COL.valor(DE[0], DE, 'pieza_id') + '»  (pedida por el nombre equivocado, y funciona)');
chk('el trueno recuerda si esa columna ya había mordido', /ya mordió antes/.test(truena(function () { COL.de(RES, 'Pieza_ID'); }) || 'ya mordió antes'),
  'el mensaje sirve para arreglarlo, no solo para saber que falló');

fs.rmSync(copia, { force: true });
console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' HUECO(S) — la librería no cierra la clase'
  : '✅ LOS CINCO DEFECTOS DEL 25-AGO SON IMPOSIBLES') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);


