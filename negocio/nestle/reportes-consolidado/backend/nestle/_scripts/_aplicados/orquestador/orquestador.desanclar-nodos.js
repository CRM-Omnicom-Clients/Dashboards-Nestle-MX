// DESANCLA el sistema del vocabulario de NODOS — los ids y la palabra.
//
// 🔴 POR QUÉ. Rick cerró la cadena de nodos el 25-ago y pidió el 26: «quiero el sistema de skills,
//    nada del de nodos; si queda algo que te ancle al sistema de nodos, lo eliminas o renombras
//    para que nunca volvamos a hablar de ese sistema». Y tenía razón en que seguía anclado: aunque
//    la CADENA ya era de skills, cada paso se seguía llamando `N0`, `N2a`, `N6f` — nombres que solo
//    significan algo dentro del sistema viejo. Un id así obliga a traducir mentalmente cada vez.
//
// 🔴 EL NOMBRE NUEVO DICE SKILL Y VERBO. `N2a` no le dice nada a nadie; `email-bloque` dice de qué
//    skill es y qué hace. Y las dos puertas dejan de esconderse detrás de `N2v`/`N7`: se llaman
//    `PUERTA-1` y `PUERTA-2`, que es lo que son.
//
// 🔴 LO QUE NO TOCA: `_aplicados/` (es historia, y reescribir historia la vuelve inútil) ni el
//    archivo de este script (se nombra a sí mismo por necesidad).
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var D = BACK + '/_scripts';
var SKILLS = os.homedir() + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// ── el mapeo de ids. Orden IMPORTA: los largos primero, si no `N1` se come a `N1c`.
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
// ordenar por longitud descendente para que el reemplazo no se solape
IDS.sort(function (a, b) { return b[0].length - a[0].length; });

// ── el vocabulario
var PALABRAS = [
  [/\bcadena de nodos\b/gi, 'cadena de pasos'],
  [/\bcadena_de_nodos\b/g, 'cadena_de_pasos'],
  [/\bnodos\b/g, 'pasos'], [/\bNodos\b/g, 'Pasos'], [/\bNODOS\b/g, 'PASOS'],
  [/\bnodo\b/g, 'paso'], [/\bNodo\b/g, 'Paso'], [/\bNODO\b/g, 'PASO']
];

function archivos() {
  var out = [];
  // scripts vivos (NO _aplicados: es historia)
  fs.readdirSync(D).forEach(function (f) {
    if (!/\.(js|json)$/.test(f)) return;
    if (/desanclar-nodos/.test(f)) return;             // este mismo
    out.push(path.join(D, f));
  });
  fs.readdirSync(BACK + '/_contratos').forEach(function (f) {
    if (/\.json$/.test(f)) out.push(path.join(BACK + '/_contratos', f));
  });
  fs.readdirSync(SKILLS).forEach(function (d) {
    var p = path.join(SKILLS, d, 'SKILL.md');
    if (/^rick-reportes-/.test(d) && fs.existsSync(p)) out.push(p);
  });
  return out;
}

console.log('════════ DESANCLAR DEL SISTEMA DE NODOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var lista = archivos();
console.log('  archivos en alcance: ' + lista.length + '   (scripts vivos, contratos y los 12 SKILL.md)');
console.log('  fuera de alcance: _aplicados/ — es historia y se conserva tal cual\n');

var tocados = 0, subsIds = 0, subsPalabras = 0, detalle = {};
lista.forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8'), orig = txt;

  // 1 · los ids, solo cuando van entre comillas o como valor suelto — nunca dentro de otra palabra
  IDS.forEach(function (m) {
    var viejo = m[0], nuevo = m[1];
    // entre comillas: 'N2a'  "N2a"
    var r1 = new RegExp("(['\"])" + viejo + "\\1", 'g');
    // como etiqueta de la cadena: escritor/N0
    var r2 = new RegExp('([a-z-]+/)' + viejo + '\\b', 'g');
    // en prosa, precedido de espacio/paréntesis y seguido de límite: (N2a) · N2a ·
    var r3 = new RegExp('(?<![A-Za-z0-9_-])' + viejo + '(?![A-Za-z0-9_-])', 'g');
    [r1, r2, r3].forEach(function (r, k) {
      var n = (txt.match(r) || []).length;
      if (!n) return;
      subsIds += n;
      detalle[viejo] = (detalle[viejo] || 0) + n;
      txt = txt.replace(r, k === 0 ? "$1" + nuevo + "$1" : k === 1 ? "$1" + nuevo : nuevo);
    });
  });

  // 2 · el vocabulario
  PALABRAS.forEach(function (m) {
    var n = (txt.match(m[0]) || []).length;
    if (n) { subsPalabras += n; txt = txt.replace(m[0], m[1]); }
  });

  if (txt !== orig) { tocados++; if (ESCRIBIR) fs.writeFileSync(p, txt); }
});

console.log('  ids reemplazados: ' + subsIds);
Object.keys(detalle).sort(function (a, b) { return detalle[b] - detalle[a]; }).slice(0, 12).forEach(function (k) {
  var nuevo = (IDS.filter(function (m) { return m[0] === k; })[0] || [])[1];
  console.log('     ' + String(detalle[k]).padStart(4) + '  ' + k.padEnd(5) + '→ ' + nuevo);
});
console.log('\n  palabras «nodo/nodos» reemplazadas por «paso/pasos»: ' + subsPalabras);
console.log('  archivos tocados: ' + tocados);

// ── 3 · los dos archivos con «nodos» en el NOMBRE
var RENOMBRAR = [
  [D + '/orquestador.censo-scripts.js', D + '/orquestador.censo-scripts.js'],
  [BACK + '/_contratos/orquestador.censo-scripts.json', BACK + '/_contratos/orquestador.censo-scripts.json']
];
console.log('\n  ── archivos a renombrar ──');
RENOMBRAR.forEach(function (r) {
  var de = path.basename(r[0]), a = path.basename(r[1]);
  var existe = fs.existsSync(r[0]);
  console.log('     ' + (existe ? '→' : '⊘') + ' ' + de + '  →  ' + a + (existe ? '' : '   (ya no está)'));
});

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// las referencias al nombre viejo ya se actualizaron arriba (la palabra «nodos» → «scripts» no,
// porque el nombre del archivo es una cadena literal). Se hace aquí, explícito.
lista.forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8'), orig = txt;
  txt = txt.replace(/orquestador\.censo-nodos\.js/g, 'orquestador.censo-scripts.js')
           .replace(/orquestador\.censo-nodos\.json/g, 'orquestador.censo-scripts.json')
           .replace(/orquestador\.censo-pasos\.js/g, 'orquestador.censo-scripts.js')
           .replace(/orquestador\.censo-pasos\.json/g, 'orquestador.censo-scripts.json');
  if (txt !== orig) fs.writeFileSync(p, txt);
});
RENOMBRAR.forEach(function (r) {
  if (fs.existsSync(r[0])) { fs.renameSync(r[0], r[1]); console.log('     ✔ renombrado: ' + path.basename(r[1])); }
});

// ── VERIFICACIÓN
console.log('\n  ══ VERIFICACIÓN ══');
var quedan = [], idsQuedan = [];
archivos().forEach(function (p) {
  var txt = fs.readFileSync(p, 'utf8');
  if (/\bnodos?\b/i.test(txt)) quedan.push(path.basename(p));
  IDS.forEach(function (m) {
    var r = new RegExp("(['\"])" + m[0] + "\\1", 'g');
    if (r.test(txt)) idsQuedan.push(path.basename(p) + ' → ' + m[0]);
  });
});
console.log('   ' + (idsQuedan.length === 0 ? '✔' : '🔴') + ' sin ids de nodo entre comillas: ' +
  (idsQuedan.length ? idsQuedan.slice(0, 6).join(' · ') : 'ninguno en ' + archivos().length + ' archivos'));
console.log('   ' + (quedan.length === 0 ? '✔' : '⚠') + ' sin la palabra «nodo»: ' +
  (quedan.length ? quedan.length + ' archivo(s): ' + quedan.slice(0, 8).join(' · ') : 'ninguno'));
var sinArchivo = fs.existsSync(D + '/orquestador.censo-scripts.js') || fs.existsSync(BACK + '/_contratos/orquestador.censo-scripts.json');
console.log('   ' + (sinArchivo ? '🔴' : '✔') + ' ningún archivo con «nodos» en el nombre');
process.exit(idsQuedan.length ? 1 : 0);
