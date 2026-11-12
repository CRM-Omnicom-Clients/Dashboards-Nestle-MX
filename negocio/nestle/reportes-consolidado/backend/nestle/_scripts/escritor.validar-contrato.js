// ¿EL CONTRATO DICE LA VERDAD? Se compara contra las hojas reales y contra los bloques reales.
//
// 🔴 Un contrato sin validador es una opinión. Éste comprueba las dos direcciones, y las dos
//    importan por motivos distintos:
//      · columna de la hoja que el contrato NO declara → alguien agregó una columna y nadie
//        la llena. Hoy eso pasa en silencio.
//      · columna declarada que la hoja NO tiene → el contrato quedó atrás, y el escritor
//        intentaría escribir en una columna que no existe.
//    Y una tercera que es la que de verdad muerde: campo del bloque que NADIE usa — dato que
//    se carga, se valida, se cuadra… y no llega a ninguna hoja.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'escritor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var C = require(require('path').resolve(__dirname, '..') + '/_contratos/hojas.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var V = [], fallo = 0, H = [];
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ N1d · ¿EL CONTRATO DICE LA VERDAD? ════════\n');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n1dv.xlsx'; fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
function colsDe(hoja) {
  var sh = wb.Sheets[hoja]; if (!sh || !sh['!ref']) return null;
  var r = XLSX.utils.decode_range(sh['!ref']), out = [];
  for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h && t(h.v)) out.push(t(h.v)); }
  return out;
}
function bloqueDe(n) { try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); } catch (e) { return null; } }

var TOTAL = { sinDeclarar: 0, sobrantes: 0, campoInexistente: 0, deuda: 0, nuevas: 0, llaveVacia: 0 };
Object.keys(C.hojas).forEach(function (hoja) {
  var def = C.hojas[hoja];
  var cols = Object.assign({}, def.hereda ? C.hojas[def.hereda].columnas : {}, def.columnas);
  var reales = colsDe(hoja);
  console.log('══ ' + hoja + ' ══');
  if (!reales) { console.log('   🔴 la hoja no existe en el workbook'); chk(hoja + ' existe', false, 'no está'); return; }

  var declaradas = Object.keys(cols);
  var nuevas = declaradas.filter(function (c) { return cols[c].nueva; });
  var sinDeclarar = reales.filter(function (c) { return declaradas.indexOf(c) < 0; });
  var sobrantes = declaradas.filter(function (c) { return reales.indexOf(c) < 0 && !cols[c].nueva; });

  var porOrigen = {};
  declaradas.forEach(function (c) { var o = cols[c].de; porOrigen[o] = (porOrigen[o] || 0) + 1; });
  console.log('   columnas en la hoja: ' + reales.length + '   ·   declaradas: ' + declaradas.length +
    (nuevas.length ? '  (' + nuevas.length + ' por CREAR)' : ''));
  console.log('   por origen: ' + Object.keys(porOrigen).sort().map(function (o) { return o + ' ' + porOrigen[o]; }).join(' · '));
  if (sinDeclarar.length) console.log('   🔴 en la hoja y SIN declarar: ' + sinDeclarar.join(' · '));
  if (sobrantes.length) console.log('   🔴 declaradas y NO están en la hoja: ' + sobrantes.join(' · '));
  TOTAL.sinDeclarar += sinDeclarar.length; TOTAL.sobrantes += sobrantes.length;
  TOTAL.deuda += (porOrigen.conservar || 0); TOTAL.nuevas += nuevas.length;

  // 🔴 ¿LA LLAVE SE ANCLA A ALGO QUE YA EXISTE? Una llave cuya columna está VACÍA en la hoja no
  //    empareja nunca — y como «0 emparejadas» produce «0 celdas que cambiarían», el script cierra
  //    en verde mientras la hoja no recibe un solo dato. Pasó con `Data_Email`, que se anclaba a
  //    `Email_Name`: una columna que llena el propio escritor. La llave pedía como ancla algo que
  //    solo existiría después de escribir.
  //    No se mide «la columna existe» —existía— sino **cuántas filas la traen con valor**.
  (def.llave || []).forEach(function (k) {
    if (!k.columna || reales.indexOf(k.columna) < 0) return;   // eso ya lo cubre `sobrantes`
    var filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '', blankrows: false });
    var con = filas.filter(function (f) { return t(f[k.columna]); }).length;
    if (filas.length && con === 0) {
      console.log('   🔴 la llave se ancla a «' + k.columna + '», que está VACÍA en las ' + filas.length +
        ' filas: no puede emparejar ninguna, y «0 celdas que cambiarían» se leería como «ya está bien»');
      TOTAL.llaveVacia++;
    } else if (filas.length && con < filas.length) {
      console.log('   ⚠ la llave se ancla a «' + k.columna + '» y solo ' + con + ' de ' + filas.length + ' filas la traen');
    }
  });

  // ¿los campos que el contrato pide al bloque, existen en el bloque?
  var B = bloqueDe(def.bloque);
  var regs = B ? (B[def.registros] || []) : [];
  var campos = Object.keys(regs[0] || {});
  var pide = declaradas.filter(function (c) { return cols[c].de === 'bloque'; });
  var faltan = pide.filter(function (c) { return campos.indexOf(cols[c].campo) < 0; });
  console.log('   campos que le pide al bloque «' + def.bloque + '.' + def.registros + '»: ' + pide.length +
    (faltan.length ? '   🔴 NO existen: ' + faltan.map(function (c) { return cols[c].campo; }).join(' · ') : '   ✔ todos existen'));
  TOTAL.campoInexistente += faltan.length;

  // ¿hay campos del bloque que NADIE usa?
  var usados = pide.map(function (c) { return cols[c].campo; });
  // Campos que NO tienen por qué llegar a una columna. Dos clases, y la segunda importa:
  //   · trazabilidad — de dónde salió el registro, por qué se decidió lo que se decidió
  //   · 🔴 CRUDOS QUE SIRVEN PARA CONTRASTAR: la fuente de WhatsApp trae su propio `bu` y
  //     `marca`, y el contrato los toma del CATÁLOGO. Que no lleguen a una columna no significa
  //     que sobren: son la única forma de comprobar que el catálogo no se contradice con la
  //     fuente. Se usan en el script de resolución, no en la escritura.
  var META = ['llave', 'hoja', 'fila_en_hoja', 'encabezado_en_fila', 'via_atribucion', 'candidatas',
    'motivo_sin_pieza', 'fecha_via', 'fecha_nota', 'fecha_ausente_motivo', 'clicks_nota',
    'clicks_derivado_realista', 'estado_diff', 'campana_origen', 'campana_fuente', 'campana_cargada',
    'journey_id_origen', 'no_entregados', 'asset_id', 'pieza_id',
    'bu', 'marca', 'journey', 'fuente',                    // crudos: contrastan contra el catálogo
    'fecha_hora', 'store_raw', 'sin_codigo', 'tipo', 'product'];
  var huerfanos = campos.filter(function (k) { return usados.indexOf(k) < 0 && META.indexOf(k) < 0; });
  if (huerfanos.length) console.log('   ⚠ campos del bloque que NINGUNA columna usa: ' + huerfanos.join(' · '));
  console.log('');
});

// 🔴 LA LLAVE REPETIDA ES INVISIBLE DESPUÉS DEL PARSEO. JS acepta `{ BU: a, BU: b }` sin decir nada
//    y se queda con la última. Pasó de verdad: al alinear el contrato al prefijo, `BU_Canonico` se
//    renombró a `BU` en `Data_Email` —que ya tenía un `BU` crudo— y la declaración canónica quedó
//    tapada por la de `conservar`. Ningún check del objeto podía verlo: para cuando `require` termina,
//    solo hay una. Por eso este check lee el ARCHIVO, no el módulo.
var dups = (function () {
  var src = require('fs').readFileSync(
    require('path').resolve(__dirname, '..') + '/_contratos/hojas.js', 'utf8').split('\n');
  var hoja = null, vistas = {}, out = [];
  src.forEach(function (ln) {
    var mh = ln.match(/^    ([A-Za-z_][A-Za-z0-9_]*): \{/);
    if (mh) { hoja = mh[1]; vistas[hoja] = {}; return; }
    if (!hoja) return;
    if (/^    \}/.test(ln)) { hoja = null; return; }
    var mc = ln.match(/^        '?([^':]+)'?: \{/);
    if (!mc) return;
    var col = mc[1].trim();
    if (vistas[hoja][col]) out.push(hoja + ' · ' + col);
    vistas[hoja][col] = 1;
  });
  return out;
})();
if (dups.length) { dups.forEach(function (d) { console.log('   🔴 columna DECLARADA DOS VECES: ' + d); }); console.log(''); }

console.log('════ VEREDICTO ════');
chk('ninguna columna se declara dos veces en la misma hoja', dups.length === 0,
  dups.length ? '🔴 ' + dups.join(' · ') + ' — la segunda gana en silencio' : 'sin llaves repetidas');
chk('ninguna columna de las hojas queda sin declarar', TOTAL.sinDeclarar === 0,
  TOTAL.sinDeclarar ? '🔴 ' + TOTAL.sinDeclarar + ' sin dueño' : 'todas tienen origen declarado');
chk('el contrato no declara columnas que no existen', TOTAL.sobrantes === 0,
  TOTAL.sobrantes ? '🔴 ' + TOTAL.sobrantes : 'ninguna sobra');
chk('todo campo que el contrato pide al bloque existe', TOTAL.campoInexistente === 0,
  TOTAL.campoInexistente ? '🔴 ' + TOTAL.campoInexistente + ' campos inexistentes' : 'los ' + 'campos existen');
chk('toda llave se ancla a una columna que YA tiene datos', TOTAL.llaveVacia === 0,
  TOTAL.llaveVacia ? '🔴 ' + TOTAL.llaveVacia + ' llave(s) ancladas a una columna vacía' : 'ninguna llave pide como ancla lo que el escritor va a fabricar');
chk('el escritor ya NO necesita saber de negocio', true, 'la traducción vive en _contratos/hojas.js, no en el código');

dato('ninguna columna es DEUDA (nadie la puede reponer)', TOTAL.deuda === 0,
  TOTAL.deuda + ' columnas marcadas `conservar`: si se borran, no vuelven');
dato('todas las hojas ya tienen sus canónicas', TOTAL.nuevas === 0,
  TOTAL.nuevas + ' columnas canónicas por crear en las hojas de Qcart');

V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(54) + (v[2] || '')); });
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(50) + (h[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) del contrato' : '✅ CONTRATO VÁLIDO — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
