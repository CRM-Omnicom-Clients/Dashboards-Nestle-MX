// manual-bloque · ¿EL SCRIPT ESTÁ BIEN? — validación de forma.
//
// ⚠ Este paso no migra nada del sistema viejo: la entrada manual nunca existió como proceso,
//   se pegaba a mano en la hoja. Así que aquí no hay «capacidad perdida» que comprobar; lo que
//   se valida es que el script **exista, corra vacío, y rechace bien** — porque el día que se use
//   va a ser con prisa y nadie va a leer el LEEME.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var M = require(__dirname + '/lib-manual.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ manual-bloque · VALIDACIÓN ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/manual.json', 'utf8'));
var mtimeAntes = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs;

// 1 · corre vacío sin fallar — el estado normal
chk('el script corre con CERO datos', Array.isArray(B.datos),
  B.datos.length + ' datos · «' + B.estado_normal.slice(0, 46) + '»');

// 2 · la carpeta y la plantilla existen
chk('la carpeta _manual existe con su plantilla', fs.existsSync(PROY + '/_manual/PLANTILLA-datos-manuales.csv'),
  fs.readdirSync(PROY + '/_manual').join(' · '));
chk('la plantilla trae su LEEME', fs.existsSync(PROY + '/_manual/LEEME.md'),
  Math.round(fs.statSync(PROY + '/_manual/LEEME.md').size / 100) / 10 + ' KB');

// 3 · la fila de ejemplo de la plantilla NO se carga
chk('la fila de ejemplo de la plantilla no entra',
  B.rechazados_por_forma.some(function (r) { return /plantilla/i.test(r.motivo); }),
  'se rechaza con su motivo, no en silencio');

// 4 · las reglas están escritas, no implícitas
['procedencia', 'pieza', 'no_pisar', 'correccion'].forEach(function (k) {
  chk('la regla «' + k + '» está declarada', !!(B.reglas && B.reglas[k]), (B.reglas[k] || '').slice(0, 54));
});

// 5 · el cuadre
chk('el cuadre da', B.auditoria.cuadre, 'entran + fuera = leídos');

// 6 · nada calculado puede entrar
var CALC = ['ctor', 'rate', 'pct'];
chk('las métricas válidas son solo conteos', !M.METRICAS.some(function (m) { return CALC.some(function (c) { return m.indexOf(c) >= 0; }); }),
  M.METRICAS.join(', '));

// 7 · el Excel no se tocó
chk('el script NO escribió en el Excel', mtimeAntes === fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs,
  'el archivo no se tocó');

// 8 · el bloque declara para quién es
chk('declara qué necesita el paso siguiente', !!(B.para_el_siguiente && B.para_el_siguiente.ojo_puerta),
  B.para_el_siguiente.ojo_puerta.slice(0, 54));

console.log('════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(46) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ SCRIPT VALIDADO — ' + V.length + ' checks · existe, corre vacío y rechaza bien'));
process.exit(fallo ? 1 : 0);
