/*
 * orquestador.probar-entorno.js — comprueba que `lib-entorno` resuelve EXACTAMENTE lo mismo que los
 * scripts tienen hoy escrito a mano.
 *
 * 🔴 ES LA ÚNICA VALIDACIÓN QUE AUTORIZA LA MIGRACIÓN. Cambiar 231 scripts de una ruta literal a
 *    `E.PROYECTO` solo es seguro si las dos resuelven al MISMO sitio. Si difieren en un carácter
 *    —un acento compuesto, una barra, un espacio— los scripts migrados apuntarían a otra carpeta y
 *    **no fallarían**: `existsSync` daría `false` y cada uno concluiría «no hay datos», que es
 *    justo el modo de fallo que este sistema ya conoce.
 *
 * 🔴 SE COMPARAN LAS RUTAS QUE LOS SCRIPTS USAN DE VERDAD, leídas de su código, no una lista mía.
 *    Una lista escrita a mano probaría lo que yo creo que hay; esto prueba lo que hay.
 *
 *   node orquestador.probar-entorno.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var E = require(BACK + '/_scripts/lib-entorno.js');
var D = BACK + '/_scripts';

console.log('════ ¿`lib-entorno` RESUELVE LO MISMO QUE LO ESCRITO A MANO? ════\n');

// ── 1 · sacar del código las rutas literales que hoy usan los scripts
//
// 🔴 TRES ARCHIVOS LLEVAN LOS LITERALES A PROPÓSITO y hay que saltarlos, o esta prueba se acusa a
//    sí misma: `lib-entorno` los DEFINE, el migrador los lleva en su tabla de sustituciones, y este
//    mismo los lleva en sus regexes. Sin esta lista, la prueba salió 🔴 por su propio código y
//    bloqueó una migración que estaba bien — un guardián que se muerde la cola no guarda, estorba.
//    🔴 Y LA LISTA SE PIDE AL CONTRATO, no se escribe aquí. La leen TRES —este probador, el
//       migrador y la guarda 7— y una lista repetida en tres sitios se desfasa en el primer
//       cambio: es el mismo defecto que el registro de nombres vino a cerrar.
var INTOCABLES = Object.keys(E.cfg().intocables.lista);

var literales = {};
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f) && INTOCABLES.indexOf(f) < 0; }).forEach(function (f) {
  var t = fs.readFileSync(path.join(D, f), 'utf8');
  /* 🔴 LAS DOS COMILLAS, O EL LITERAL QUE SALE NO ES UN LITERAL. Esto solo miraba comilla simple,
   *    así que ante un `var X = "…/OneDrive - OneWorkplace/…"` el patrón no cerraba donde debía y
   *    casaba un tramo que arrancaba en el `'` anterior: salió un «literal» que empezaba con `);`
   *    y el probador reportó un desajuste inventado, con una ruta que nadie escribió.
   *    Un lector que entrega basura no detecta un problema: FABRICA uno, y el que lo lee pierde el
   *    rato buscando algo que no existe. */
  (t.match(/'[^']*OneDrive - OneWorkplace[^']*'|"[^"]*OneDrive - OneWorkplace[^"]*"/g) || []).forEach(function (s) {
    var k = s.replace(/^['"]|['"]$/g, '');
    (literales[k] = literales[k] || []).push(f);
  });
});
var ks = Object.keys(literales);
console.log('  literales distintos encontrados en el código: ' + ks.length);

// ── 2 · normalizar: lo que resuelve el contrato, con separadores comparables
function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, ''); }
var PROY = norm(E.PROYECTO), EXT = norm(E.raiz('fuentes_externas'));

var ok = [], mal = [], fuera = [];
ks.forEach(function (lit) {
  var L = norm(lit.replace(/^~/, os.homedir()));
  // el literal suele venir ya con el home delante; si trae `os.homedir() + `, llega sin él
  var abs = /^[A-Za-z]:/.test(L) ? L : norm(os.homedir()) + (L[0] === '/' ? '' : '/') + L;
  if (abs.indexOf(PROY) === 0) ok.push({ lit: lit, raiz: 'proyecto', resto: abs.slice(PROY.length) });
  else if (abs.indexOf(EXT) === 0) ok.push({ lit: lit, raiz: 'fuentes_externas', resto: abs.slice(EXT.length) });
  else if (/Archivos de Leslie/.test(abs) || /Reportes-Nestl/.test(abs)) mal.push({ lit: lit, abs: abs });
  else fuera.push(lit);
});

console.log('\n  ── el contraste');
console.log('     ✔ literales que caen DENTRO de una raíz del contrato: ' + ok.length);
console.log('     ' + (mal.length ? '🔴' : '✔') + ' literales que deberían caer y NO caen: ' + mal.length);
mal.slice(0, 6).forEach(function (x) {
  console.log('        literal : ' + x.lit.slice(0, 92));
  console.log('        resuelto: ' + x.abs.slice(0, 92));
  console.log('        contrato: ' + PROY.slice(0, 92));
});
if (fuera.length) console.log('     · ' + fuera.length + ' no son del proyecto ni de las fuentes (otros destinos)');

// ── 3 · el libro vivo: su nombre está escrito en 49 scripts
var libro = norm(E.LIBRO);
var conLibro = fs.readdirSync(D).filter(function (f) {
  return /\.js$/.test(f) && /Interno\)-Reporte-Consolidado-Nestle-2026-v8\.xlsx/.test(fs.readFileSync(path.join(D, f), 'utf8'));
});
console.log('\n  ── el libro vivo');
console.log('     contrato → ' + libro);
console.log('     scripts que escriben su nombre a mano: ' + conLibro.length);
var libroOk = fs.existsSync(E.LIBRO);
console.log('     ' + (libroOk ? '✔ existe donde el contrato dice' : '🔴 el contrato apunta a un archivo que no está'));

// ── 4 · las fuentes declaradas existen de verdad
console.log('\n  ── las fuentes del contrato');
var malF = 0;
Object.keys(E.cfg().fuentes || {}).forEach(function (id) {
  try { var p = E.fuente(id); console.log('     ✔ ' + id.padEnd(16) + norm(p).slice(-58)); }
  catch (e) { console.log('     🔴 ' + id.padEnd(16) + String(e.message).split('\n')[1] || id); malF++; }
});

var fallo = mal.length + malF + (libroOk ? 0 : 1);
console.log('\n════ ' + (fallo
  ? '🔴 ' + fallo + ' desajuste(s): NO se puede migrar hasta que resuelvan igual'
  : '✅ EL CONTRATO RESUELVE LO MISMO QUE LO ESCRITO A MANO — se puede migrar') + ' ════');
process.exit(fallo ? 1 : 0);
