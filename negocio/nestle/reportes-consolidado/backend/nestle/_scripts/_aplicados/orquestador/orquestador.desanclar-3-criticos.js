// DESANCLA los 3 archivos críticos — con cuidado, porque el renombre masivo los rompió.
//
// 🔴 QUÉ SALIÓ MAL EN LA PASADA MASIVA, y por qué estos tres van aparte:
//    1. `N1:` como LLAVE DE OBJETO pasó a `insumos-validar:` — y un guion no es un identificador
//       válido en JS. Tres archivos dejaron de parsear.
//    2. Peor: en `orquestador.guardas.js` había una FUNCIÓN llamada `NE` (de «no evaluado»), y el
//       renombre la convirtió en `function motor-clicks(...)`. El id de un paso y el nombre de una
//       función son la misma cadena de dos letras — el reemplazo no puede distinguirlos solo.
//    Es la regla del CLAUDE.md aplicada al código: distinguir lo que APUNTA a algo de lo que
//    simplemente SE LLAMA igual. Un reemplazo ciego no hace esa distinción.
//
// 🔴 AQUÍ SÍ SE DISTINGUE: solo se toca el id cuando va **entre comillas** (es un dato) o dentro de
//    un comentario (es prosa). Nunca cuando es un identificador de código.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var D = os.homedir() + '/.claude/reportes-backend/nestle/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var IDS = [
  ['N1c', 'qcart-activacion'], ['N1e', 'catalogo-leer'], ['N1f', 'catalogo-aplicar'],
  ['N2a', 'email-bloque'], ['N2b', 'qcart-bloque'], ['N2c', 'whatsapp-bloque'],
  ['N2d', 'manual-bloque'], ['N2v', 'PUERTA-1'],
  ['N4b', 'escritor-formato-datos'], ['N5b', 'motor-rejilla'],
  ['N6s', 'resumen-fusionar'], ['N6b', 'insights-redactar'], ['N6f', 'escritor-formato-resumen'],
  ['N0', 'escritor-neutralizar'], ['N1', 'insumos-validar'],
  ['N4', 'escritor-datos'], ['N5', 'motor-calculo'], ['N6', 'resumen-regenerar'],
  ['N7', 'PUERTA-2'], ['NE', 'motor-clicks'],
  ['V1', 'vacios-medir'], ['V2', 'vacios-llenar'], ['I1', 'cuadre-coherencia']
];
IDS.sort(function (a, b) { return b[0].length - a[0].length; });

var PALABRAS = [
  [/\bcadena de nodos\b/gi, 'el sistema plano anterior'],
  [/\bnodos\b/g, 'pasos'], [/\bNodos\b/g, 'Pasos'], [/\bNODOS\b/g, 'PASOS'],
  [/\bnodo\b/g, 'paso'], [/\bNodo\b/g, 'Paso'], [/\bNODO\b/g, 'PASO']
];

var ARCHIVOS = ['orquestador.cadena-skills.js', 'orquestador.guardas.js', 'orquestador.orquestador.js'];

console.log('════════ DESANCLAR LOS 3 CRÍTICOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

ARCHIVOS.forEach(function (f) {
  var p = path.join(D, f);
  var txt = fs.readFileSync(p, 'utf8'), orig = txt;
  var nComillas = 0, nLlaves = 0, nProsa = 0;

  IDS.forEach(function (m) {
    var viejo = m[0], nuevo = m[1];
    var esc = viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1 · entre comillas: 'N2a' → 'email-bloque'   — es un DATO, siempre seguro
    var r1 = new RegExp("(['\"])" + esc + "\\1", 'g');
    nComillas += (txt.match(r1) || []).length;
    txt = txt.replace(r1, "$1" + nuevo + "$1");

    // 2 · LLAVE DE OBJETO sin comillas: `  N1:` → `  'insumos-validar':`
    //    🔴 se entrecomilla al vuelo, porque el nombre nuevo lleva guion y sin comillas no parsea.
    var r2 = new RegExp('(^\\s*|[\\{,]\\s*)' + esc + '(\\s*:)', 'gm');
    nLlaves += (txt.match(r2) || []).length;
    txt = txt.replace(r2, "$1'" + nuevo + "'$2");

    // 3 · en COMENTARIOS: solo dentro de líneas que empiezan por // — es prosa, nunca código
    txt = txt.split('\n').map(function (linea) {
      if (!/^\s*\/\//.test(linea)) return linea;
      var r3 = new RegExp('(?<![A-Za-z0-9_-])' + esc + '(?![A-Za-z0-9_-])', 'g');
      var c = (linea.match(r3) || []).length;
      if (c) { nProsa += c; return linea.replace(r3, nuevo); }
      return linea;
    }).join('\n');
  });

  PALABRAS.forEach(function (m) { txt = txt.replace(m[0], m[1]); });

  console.log('  ' + f);
  console.log('     entre comillas (datos): ' + nComillas + '   ·   llaves de objeto: ' + nLlaves + '   ·   en comentarios: ' + nProsa);

  if (ESCRIBIR && txt !== orig) fs.writeFileSync(p, txt);
});

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

console.log('\n  ══ VERIFICACIÓN ══');
var cp = require('child_process');
var malos = 0;
ARCHIVOS.forEach(function (f) {
  var r = cp.spawnSync(process.execPath, ['-c', path.join(D, f)], { encoding: 'utf8' });
  if (r.status !== 0) { malos++; console.log('   🔴 ' + f + ': ' + (r.stderr || '').split('\n').slice(0, 3).join(' | ')); }
  else console.log('   ✔ ' + f + ' parsea');
});
// 🔴 y que la función NE siga existiendo con su nombre — el caso que rompió la pasada anterior
var g = fs.readFileSync(path.join(D, 'orquestador.guardas.js'), 'utf8');
var tieneNE = /function NE\s*\(/.test(g);
console.log('   ' + (tieneNE ? '✔' : '🔴') + ' la función NE() de guardas sigue intacta (no se confundió con el id de un paso)');
process.exit(malos || !tieneNE ? 1 : 0);
