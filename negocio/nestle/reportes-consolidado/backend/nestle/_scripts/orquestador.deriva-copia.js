/*
 * orquestador.deriva-copia.js — ¿la copia y el origen siguen diciendo lo mismo?
 *
 * 🔴 EL SISTEMA VIVE EN DOS SITIOS Y SON INDEPENDIENTES. Eso es lo que lo hace portable y es
 *    también su riesgo: un cambio en una NO llega a la otra. Si alguien arregla algo en la carpeta
 *    de SharePoint, el arreglo se pierde en la siguiente sincronización —que copia origen → copia—;
 *    y si alguien arregla algo en el origen y nadie sincroniza, la copia sigue con el defecto.
 *    Las dos direcciones duelen, y ninguna avisa sola.
 *
 * 🔴 LA COMPARACIÓN ES POR CONTENIDO (sha1), NO POR FECHA. OneDrive reescribe `mtime` al
 *    sincronizar, así que las fechas dicen que todo cambió cuando nada cambió — y al revés: un
 *    archivo restaurado por OneDrive puede traer fecha nueva y contenido viejo. Este sistema ya
 *    tiene esa cicatriz: «OneDrive revierte el Claud».
 *
 * 🔴 Y DISTINGUE TRES COSAS, porque exigen decisiones distintas:
 *      · solo en el ORIGEN   → falta sincronizar. Inocuo: el siguiente `llevar-a-carpeta` lo lleva
 *      · DIFIERE             → ⚠ alguien editó uno de los dos. HAY QUE MIRAR CUÁL antes de
 *                              sincronizar, porque sincronizar PISA la copia
 *      · solo en la COPIA    → 🔴 lo peor: trabajo que solo existe allí y que la próxima
 *                              sincronización se lleva por delante
 *
 *   node orquestador.deriva-copia.js --copia "<ruta de la copia>"
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
var ENT = require(__dirname + '/lib-entorno.js');
var ORIGEN = path.resolve(__dirname, '..');

var COPIA = (function () {
  var i = process.argv.indexOf('--copia');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1].replace(/^~/, os.homedir());
  // si no se pasa, se busca junto al manifiesto que dejó `llevar-a-carpeta`
  try {
    var ext = ENT.raiz('fuentes_externas');
    var c = path.join(ext, 'Marcas', 'CRM General', 'Sistema-Reportes-CRM');
    if (fs.existsSync(path.join(c, '_MANIFIESTO.json'))) return c;
  } catch (e) { }
  console.log('🔴 falta --copia "<ruta>"   (o no encontré una copia con su _MANIFIESTO.json)');
  process.exit(1);
})();

/* solo se comparan las carpetas que VIAJAN. `_tmp`, `_respaldos` y las salidas de cada corrida
 * difieren por definición: la copia corre sus propios cortes. Compararlas daría ruido garantizado,
 * y un detector ruidoso se apaga.
 *
 * 🔴 Y CADA CARPETA SE RESUELVE EN SU SITIO, que no es el mismo en los dos lados. Mi primera
 *    versión comparó `<backend>/skills` contra `<copia>/skills` y reportó **127 archivos «solo en
 *    la copia»**: en el origen los skills no viven bajo el backend, viven en `~/.claude/skills`.
 *    O sea que el detector acusaba de deriva a lo que estaba perfectamente sincronizado — y un
 *    detector que grita 127 veces sin motivo se apaga el primer día.
 *    Lo mismo con `tools`: la copia lleva un SUBCONJUNTO curado (las 5 capas, el render, los
 *    hooks), no el árbol entero, así que ahí solo tiene sentido comparar lo que la copia TIENE.
 *    «Solo en el origen» únicamente significa algo donde el copiador lleva todo. */
/* 🔴 Y SE COMPARA LO QUE EL COPIADOR COPIA DE VERDAD, archivo por archivo. Mi segunda versión
 *    recorrió los árboles enteros y salieron **31,923 archivos** del origen —porque `tools`
 *    contiene `node_modules` (9,508) y el runtime de Node (3,205), que a propósito no viajan— y
 *    **138 «faltan en la copia»** que eran `_scripts/_aplicados/**`: historia que no va a viajar
 *    nunca. Las dos cifras son ruido, y un detector que informa de 31,923 archivos para decir algo
 *    de 450 enseña a no leerlo.
 *    El copiador toma cada carpeta **sin bajar a subcarpetas** y con un filtro; aquí se hace igual.
 *    Los skills son la excepción: de ellos sí viaja el árbol completo. */
var COMPARAR = [
  { sub: '_scripts', origen: function () { return path.join(ORIGEN, '_scripts'); }, filtro: /\.(js|py)$/, completo: true },
  { sub: '_contratos', origen: function () { return path.join(ORIGEN, '_contratos'); }, filtro: /\.(json|js)$/, completo: true },
  { sub: '_catalogo', origen: function () { return path.join(ORIGEN, '_catalogo'); }, filtro: /\.json$/, completo: true },
  // los skills del origen están en ~/.claude/skills, no bajo el backend — y de ellos viaja el árbol
  { sub: 'skills', origen: function () { return ENT.SKILLS; }, arbol: true, completo: true, soloPrefijo: ENT.PREFIJO_SKILL },
  // de tools viaja un subconjunto curado: se compara lo que la copia tiene
  { sub: 'tools', origen: function () { return ENT.TOOLS; }, filtro: /\.(js|py)$/, completo: false },
  { sub: 'tools/reportes', origen: function () { return ENT.TOOLS + '/reportes'; }, filtro: /\.(js|md)$/, completo: false }
];
var RAIZ_FILES = /^(LEEME\.md|CATALOGO\.md)$/;

function sha(p) { try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch (e) { return null; } }
function listar(dir, etiqueta, C) {
  var out = {};
  (function rec(d, pre, nivel) {
    var e; try { e = fs.readdirSync(d); } catch (x) { return; }
    e.forEach(function (n) {
      // en skills, solo las carpetas del sistema: lo demás son skills de otros temas de Rick
      if (nivel === 0 && C.soloPrefijo && n.indexOf(C.soloPrefijo) !== 0) return;
      var p = path.join(d, n), s; try { s = fs.statSync(p); } catch (y) { return; }
      if (s.isDirectory()) { if (C.arbol) rec(p, pre + n + '/', nivel + 1); return; }
      if (C.filtro && !C.filtro.test(n)) return;
      out[pre + n] = sha(p);
    });
  })(dir, etiqueta + '/', 0);
  return out;
}

console.log('════ ¿LA COPIA Y EL ORIGEN DICEN LO MISMO? ════\n');
console.log('  origen: ' + ORIGEN);
console.log('  copia : ' + COPIA + '\n');

var A = {}, B = {}, soloDondeCompleto = {};
COMPARAR.forEach(function (C) {
  var a = listar(C.origen(), C.sub, C);
  var b = listar(path.join(COPIA, C.sub), C.sub, C);
  Object.assign(A, a); Object.assign(B, b);
  if (C.completo) Object.keys(a).forEach(function (k) { soloDondeCompleto[k] = 1; });
});
fs.readdirSync(ORIGEN).filter(function (f) { return RAIZ_FILES.test(f); }).forEach(function (f) { A[f] = sha(path.join(ORIGEN, f)); });
try { fs.readdirSync(COPIA).filter(function (f) { return RAIZ_FILES.test(f); }).forEach(function (f) { B[f] = sha(path.join(COPIA, f)); }); } catch (e) { }

var soloOrigen = [], soloCopia = [], difieren = [], iguales = 0, noComparable = 0;
Object.keys(A).forEach(function (k) {
  if (!(k in B)) {
    // «falta en la copia» solo significa algo donde el copiador lleva la carpeta COMPLETA
    if (soloDondeCompleto[k]) soloOrigen.push(k); else noComparable++;
    return;
  }
  if (A[k] !== B[k]) difieren.push(k); else iguales++;
});
Object.keys(B).forEach(function (k) { if (!(k in A)) soloCopia.push(k); });

console.log('  comparados por contenido (sha1): ' + Object.keys(A).length + ' archivo(s) del origen');
console.log('     ✔ idénticos            ' + iguales);
console.log('     · solo en el ORIGEN    ' + soloOrigen.length + '   (falta sincronizar — inocuo)');
console.log('     ' + (difieren.length ? '⚠' : '✔') + ' DIFIEREN             ' + difieren.length + (difieren.length ? '   ← hay que mirar cuál antes de sincronizar' : ''));
console.log('     ' + (soloCopia.length ? '🔴' : '✔') + ' solo en la COPIA     ' + soloCopia.length + (soloCopia.length ? '   ← la próxima sincronización se lo lleva' : ''));

if (difieren.length) {
  console.log('\n  ⚠ DIFIEREN — alguien editó uno de los dos:');
  difieren.slice(0, 15).forEach(function (k) {
    var mo = 0, mc = 0;
    try { mo = fs.statSync(path.join(ORIGEN, k)).mtimeMs; } catch (e) { }
    try { mc = fs.statSync(path.join(COPIA, k)).mtimeMs; } catch (e) { }
    // la fecha NO decide, pero orienta sobre dónde mirar primero
    console.log('     ' + k.padEnd(52) + (mc > mo ? 'la COPIA es más nueva' : mo > mc ? 'el ORIGEN es más nuevo' : 'misma fecha'));
  });
  if (difieren.length > 15) console.log('     … y ' + (difieren.length - 15) + ' más');
  console.log('     🔴 la fecha ORIENTA, no decide: OneDrive reescribe `mtime` al sincronizar.');
  console.log('        Antes de sincronizar, diffea los que importen.');
}
if (soloCopia.length) {
  console.log('\n  🔴 SOLO EN LA COPIA — existe allí y en ningún otro sitio:');
  soloCopia.slice(0, 15).forEach(function (k) { console.log('     ' + k); });
  if (soloCopia.length > 15) console.log('     … y ' + (soloCopia.length - 15) + ' más');
  console.log('     Si es trabajo bueno, tráelo al origen ANTES de volver a sincronizar.');
}
if (soloOrigen.length) {
  console.log('\n  · solo en el ORIGEN (la sincronización los lleva): ' + soloOrigen.slice(0, 8).join(' · ') + (soloOrigen.length > 8 ? ' …' : ''));
}

fs.writeFileSync(ORIGEN + '/_preescritura/deriva-copia.json', JSON.stringify({
  cuando: new Date().toISOString(), origen: ORIGEN, copia: COPIA,
  comparado_por: 'sha1 del contenido — nunca por fecha: OneDrive reescribe mtime al sincronizar',
  carpetas: COMPARAR, iguales: iguales,
  solo_en_origen: soloOrigen, difieren: difieren, solo_en_copia: soloCopia
}, null, 1), 'utf8');

var grave = difieren.length + soloCopia.length;
console.log('\n════ ' + (grave
  ? '⚠ ' + grave + ' archivo(s) que NO se pueden sincronizar a ciegas'
  : '✅ LA COPIA DICE LO MISMO QUE EL ORIGEN' + (soloOrigen.length ? ' (le faltan ' + soloOrigen.length + ', que la sincronización lleva)' : '')) + ' ════');
console.log('   → _preescritura/deriva-copia.json');
process.exit(0);
