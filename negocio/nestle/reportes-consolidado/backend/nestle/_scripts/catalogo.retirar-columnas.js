// nestle-catalogo · RETIRAR COLUMNAS QUE NADIE CONSUME, probando antes que nadie las consume.
//
// 🔴 LO QUE PIDIÓ RICK (7-sep-2026): «quita ID_SFMC, Asset_ID, Camp_ID, Journey_ID». Su
//    razonamiento: *«la idea era que fueran como foreign keys pero en realidad no nos dicen nada
//    ni las ocupamos»*. Medido y confirmado: **0 fórmulas del workbook citan ninguna de las cuatro.**
//
// 🔴 ESTA ES LA OPERACIÓN QUE MÁS DAÑO HIZO EN ESTE PROYECTO. `escritor.retirar.js` desplazó
//    celdas y **perdió cinco columnas del catálogo** en agosto. Por eso aquí no se «borra una
//    columna»: se RECONSTRUYE la hoja entera desde lo que se leyó, sin las retiradas, y después
//    se comprueba **columna por columna y celda por celda, por NOMBRE**, que todo lo demás dice
//    exactamente lo mismo que antes. Si una sola celda cambia, no se publica.
//
// 🔴 Y SE PRUEBA QUE NADIE LA USA, no se confía en que Rick tenga razón:
//      1 · ninguna FÓRMULA del libro la cita por su letra
//      2 · ningún SCRIPT del backend la pide por su id lógico con `COL.de`
//      3 · ninguna OTRA HOJA tiene una columna con ese nombre
//    Si alguna falla, NO se retira: se declara quién la usa.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
// 🔴 9-sep-2026 · LA HOJA SE PIDE POR ARGUMENTO. Estaba clavada a 'Catalogo_Piezas', y un
//    retirador que solo sabe retirar de una hoja es un literal disfrazado de herramienta: al
//    pedirle las 3 columnas de unsub del Report_Resumen habría medido las fórmulas de la hoja
//    equivocada y declarado «0 fórmulas la citan» sobre una columna que sí se cita.
var HOJA = (function () { var i = process.argv.indexOf('--hoja'); return i > 0 ? process.argv[i + 1] : 'Catalogo_Piezas'; })();

// ── LAS CUATRO, con el porqué de cada una ──────────────────────────────────────────
var RETIRAR_POR_HOJA = {
  'Catalogo_Piezas': [
    { nombre: 'ID_SFMC', porque: 'llave foránea a SFMC que nadie consume. Era además la columna más vacía del catálogo: 98 de 138 piezas en POR DEFINIR.' },
    { nombre: 'Asset_ID', porque: 'el id del creativo en SFMC. Ya se probó que NO identifica la pieza: `863587` es idéntico en las 12 piezas de AON — es del journey, no del email.' },
    { nombre: 'Camp_ID', porque: 'llave interna de campaña. Lo que se usa de verdad es el NOMBRE («Hackea tu café», «The Freshers»), no el id.' },
    { nombre: 'Journey_ID', porque: 'se queda `Journey_Name`, que es lo que se lee. El id no lo cita ninguna fórmula.' }
  ],
  // 🔴 9-sep-2026 · Rick: «los unsuscribe en volumen para … principales, fups y total … es # de
  //    unsuscribe y **deja solo el Unsuscribe vs open rate**. Nadamas». Por bloque quedan DOS
  //    lecturas: el CONTEO y la UTOR. El creador ya dejó de calcularlas (`lib-valores-resumen`,
  //    `resumen.asegurar-columnas`, `resumen.regenerar`, `resumen.mover-columnas`,
  //    `resumen.verificar-unsub`), así que la última corrida las dejó VACÍAS. Esto retira la
  //    columna física. El orden importa: al revés, la cadena las recrearía (regla E2).
  //    No se pierde nada medible: la tasa sobre envíos es el conteo entre los sends, y las dos
  //    columnas que la componen se quedan en la fila.
  'Report_Resumen': [
    { nombre: 'Principal_Unsub_Rate (vs sends)', porque: 'Rick, 9-sep-2026: de las tres lecturas del unsubscribe se queda el conteo y la UTOR. Ésta es derivable de `Principal_Unsubs` / `Principal_Sends`, que siguen en la fila.' },
    { nombre: 'FUP_Unsub_Rate (vs sends)', porque: 'ídem para el seguimiento: `FUP_Unsubs` / `FUP_Sends`.' },
    { nombre: 'Tot_Unsub_Rate (vs sends)', porque: 'ídem para el total: `Tot_Unsubs` / `Tot_Sends`.' }
  ],
  /* 🔴 22-sep-2026 · LAS 4 TASAS DE WhatsApp — una derivación guardada es un CACHÉ, y éste no
   *    tenía invalidación. Rick: «sí quita esas 4 columnas».
   *
   *    El caso que lo prueba: `008-P008` (Nescafé Clásico · Tercer Tiempo · WA-2) guarda
   *    `Read_Rate` = **60.90%** teniendo **2,405 leídos y 2,890 entregados en su propia fila**,
   *    que dan **83.22%**. La celda quedó con el denominador CRUDO (3,949) de antes de que la
   *    conciliación corrigiera los entregados. Nadie se enteró en semanas porque **nadie las lee**:
   *    son de solo escritura. Una columna que nadie lee no puede estar bien, solo sin descubrir.
   *
   *    No se pierde ninguna medición: el motor deriva las 4 desde los conteos —que se quedan en
   *    la fila— y el reporte las publica en `WA-%Entrega`, `WA-%No entrega`, `WA-%Read vs entrega`
   *    y `WA-%Click vs Read`. El propio SKILL de la fuente ya decía «no se copian: el motor las
   *    recalcula»; la hoja llevaba tiempo contradiciendo su propio contrato.
   *
   *    El único lector era el alambre trampa del CTOR en `fuentes-cuadre.normalizador.js`, que se
   *    mudó al BLOQUE (mira `clicks_medidos` + `clicks === null`): vigilar la hoja era vigilar la
   *    copia; vigilar el bloque es vigilar el original. */
  'Data_WhatsApp': [
    { nombre: 'Delivery_Rate', porque: 'derivación guardada junto a sus conteos. La deriva el motor: `Deliveries ÷ Sends`, y se publica como `WA-%Entrega`.' },
    { nombre: 'Read_Rate', porque: 'idem: `Opens_Read ÷ Deliveries` (el ENTREGADO CONCILIADO). Es la que llegó a decir 60.90% donde su propia fila daba 83.22%.' },
    { nombre: 'CTOR', porque: 'idem: `Clicks ÷ Opens_Read`, y vacío donde los clicks no están medidos. Se publica como `WA-%Click vs Read`.' },
    { nombre: 'Pct_Error', porque: 'idem: `No_Entregados ÷ Sends`, que se publica como `WA-%No entrega`. En la hoja estaba VACÍA en las 14 filas.' }
  ]
};
var RETIRAR = RETIRAR_POR_HOJA[HOJA];
if (!RETIRAR) {
  console.log('🔴 no hay nada declarado para retirar de «' + HOJA + '».');
  console.log('   hojas con retiro declarado: ' + Object.keys(RETIRAR_POR_HOJA).join(' · '));
  process.exit(1);
}
// 🔴 `Codigo_NC` NO se retira: Rick lo dejó explícitamente porque es el código Nestlé con el que
//    se habla con el cliente. `Pieza_ID` tampoco: lo nombran 57 scripts y es la llave de todo el
//    backend — que no aparezca en fórmulas de Excel significa que se usa FUERA de Excel.
//    `Touchpoint_Raw` tampoco: guarda la grafía original y es la única forma de auditar por qué
//    `TP1` acabó siendo `E-I1` en una pieza y `E-L1` en otra.

DECL.declarar('nestle-catalogo', 'catalogo.retirar-columnas.js', [{
  hoja: HOJA, grano: 'una COLUMNA entera',
  llave: 'el nombre del encabezado',
  celdas_esperadas: RETIRAR.length + ' columna(s) retiradas; TODAS las demás verificadas celda por celda'
}]);

console.log('════════ nestle-catalogo · RETIRAR COLUMNAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_retirar.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
console.log('  ' + HOJA + ': ' + enc.length + ' columnas × ' + (rng.e.r) + ' filas\n');

// ══ LAS TRES PRUEBAS ═══════════════════════════════════════════════════════════════
var bloqueos = [];
console.log('  ── prueba 1 · ¿alguna FÓRMULA del libro la cita?');
RETIRAR.forEach(function (r) {
  var i = enc.indexOf(r.nombre);
  if (i < 0) { bloqueos.push(r.nombre + ': no está en la hoja'); console.log('     🔴 ' + r.nombre + ' NO está en la hoja'); return; }
  r.i = i; r.letra = col(i);
  var n = 0;
  wb.SheetNames.forEach(function (h) {
    var w = wb.Sheets[h]; if (!w || !w['!ref']) return;
    Object.keys(w).forEach(function (k) {
      if (k[0] === '!') return; var cc = w[k]; if (!cc.f) return;
      var f = String(cc.f);
      if (f.indexOf(HOJA) < 0) return;
      if (new RegExp(HOJA + '!\\$?' + r.letra + '[:$0-9]').test(f)) n++;
    });
  });
  r.formulas = n;
  if (n) bloqueos.push(r.nombre + ': ' + n + ' fórmula(s) la citan');
  console.log('     ' + (n ? '🔴 ' : '✔ ') + r.nombre.padEnd(14) + 'col ' + r.letra.padEnd(4) + n + ' fórmula(s)');
});

console.log('\n  ── prueba 2 · ¿algún SCRIPT la pide por su id lógico?');
var dirS = BACK + '/_scripts';
RETIRAR.forEach(function (r) {
  if (r.i === undefined) return;
  var quien = [];
  fs.readdirSync(dirS).filter(function (f) { return /\.js$/.test(f) && f !== 'catalogo.retirar-columnas.js'; }).forEach(function (f) {
    var s = fs.readFileSync(path.join(dirS, f), 'utf8');
    // 🔴 se busca la PETICIÓN real —`COL.de(..., 'X')` o `X.columna('X')`— no la mención: un
    //    comentario que nombra la columna no la consume, y contarlo bloquearía por ruido.
    if (new RegExp("(COL\\.de\\([^)]*|columna\\()\\s*['\"]" + r.nombre + "['\"]").test(s)) quien.push(f);
  });
  r.scripts = quien;
  if (quien.length) bloqueos.push(r.nombre + ': la piden ' + quien.join(' · '));
  console.log('     ' + (quien.length ? '🔴 ' : '✔ ') + r.nombre.padEnd(14) + (quien.length ? quien.join(' · ') : 'ningún script la pide'));
});

console.log('\n  ── prueba 3 · ¿otra HOJA tiene una columna con ese nombre?');
RETIRAR.forEach(function (r) {
  if (r.i === undefined) return;
  var hojas = [];
  wb.SheetNames.forEach(function (h) {
    if (h === HOJA) return;
    var w = wb.Sheets[h]; if (!w || !w['!ref']) return;
    var e = (XLSX.utils.sheet_to_json(w, { header: 1, defval: '' })[0] || []).map(t);
    if (e.indexOf(r.nombre) >= 0) hojas.push(h);
  });
  r.hojas = hojas;
  console.log('     ' + (hojas.length ? '⚠ ' : '✔ ') + r.nombre.padEnd(14) + (hojas.length ? hojas.join(' · ') + '  (no bloquea: es otra hoja, con su propia columna)' : 'en ninguna otra hoja'));
});

if (bloqueos.length) {
  console.log('\n════ VEREDICTO ════');
  bloqueos.forEach(function (b) { console.log('  🔴 ' + b); });
  console.log('\n  🔴 NO se retira nada: hay quien las usa.');
  process.exit(1);
}
var quitar = RETIRAR.map(function (r) { return r.i; });
var quedan = [];
for (var c1 = 0; c1 <= rng.e.c; c1++) if (quitar.indexOf(c1) < 0) quedan.push(c1);
console.log('\n════ VEREDICTO ════');
console.log('  ✅ nadie las usa: 0 fórmulas, 0 scripts. Se pueden retirar.');
console.log('  columnas: ' + enc.length + ' → ' + quedan.length + '   ·   se van: ' + RETIRAR.map(function (r) { return r.nombre + ' (' + r.letra + ')'; }).join(' · '));

// 🔴 LA FOTO DE ANTES, celda por celda, por NOMBRE de columna. Es contra esto que se verifica.
var antes = {};
quedan.forEach(function (c2) {
  var h = enc[c2]; if (!h) return;
  var v = [];
  for (var r2 = 1; r2 <= rng.e.r; r2++) { var cc = ws[XLSX.utils.encode_cell({ r: r2, c: c2 })]; v.push(cc ? t(cc.v) : ''); }
  antes[h] = v;
});
console.log('  foto de control: ' + Object.keys(antes).length + ' columnas × ' + (rng.e.r) + ' filas');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA · se reconstruye la hoja, no se «borra» una columna ════════════════
var RESP = BACK + '/_respaldos/v8-antes-retirar-columnas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

// se lee cada fila del XML y se reescribe con las celdas que quedan, RE-REFERENCIADAS
var anchos = {};
xml.replace(/<col min="(\d+)" max="(\d+)"([^>]*)\/>/g, function (todo, mn, mx, resto) {
  for (var k = +mn; k <= +mx; k++) { var h = enc[k - 1]; if (h) anchos[h] = resto; } return todo;
});
var filasXml = [];
xml.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, function (todo, nr, attrs, dentro) {
  var celdas = {};
  dentro.replace(/<c r="([A-Z]+)(\d+)"((?:[^>]*\/>)|(?:[^>]*>[\s\S]*?<\/c>))/g, function (tc, L2, R2, resto) {
    celdas[L2] = '<c r="' + L2 + R2 + '"' + resto; return tc;
  });
  filasXml.push({ n: +nr, attrs: attrs, celdas: celdas });
  return todo;
});
var cuerpo = filasXml.map(function (f) {
  var out = [];
  quedan.forEach(function (cViejo, iNuevo) {
    var lv = col(cViejo), ln = col(iNuevo);
    var cel = f.celdas[lv]; if (!cel) return;
    out.push(cel.replace('<c r="' + lv + f.n + '"', '<c r="' + ln + f.n + '"'));
  });
  return '<row r="' + f.n + '"' + String(f.attrs).replace(/ spans="[^"]*"/, '') + '>' + out.join('') + '</row>';
}).join('');
xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + cuerpo + '</sheetData>');
var colsNuevo = '<cols>' + quedan.map(function (cViejo, iNuevo) {
  var h = enc[cViejo], resto = anchos[h] || ' width="14" customWidth="1"';
  return '<col min="' + (iNuevo + 1) + '" max="' + (iNuevo + 1) + '"' + resto + '/>';
}).join('') + '</cols>';
xml = /<cols>[\s\S]*?<\/cols>/.test(xml) ? xml.replace(/<cols>[\s\S]*?<\/cols>/, colsNuevo) : xml;
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + col(quedan.length - 1) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ hoja reconstruida con ' + quedan.length + ' columnas');

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 56)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 56)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }

// 🔴 SE VERIFICA ANTES DE PUBLICAR, sobre el temporal. Publicar y luego comprobar es cómo se
//    perdieron cinco columnas: para cuando se ve, el archivo del cliente ya está mal.
var ws2 = XLSX.readFile(TMP).Sheets[HOJA];
var rng2 = XLSX.utils.decode_range(ws2['!ref']);
var enc2 = [];
for (var c3 = rng2.s.c; c3 <= rng2.e.c; c3++) { var e3 = ws2[XLSX.utils.encode_cell({ r: 0, c: c3 })]; enc2[c3] = e3 ? t(e3.v) : ''; }
var mal = [];
Object.keys(antes).forEach(function (h) {
  var i = enc2.indexOf(h);
  if (i < 0) { mal.push(h + ': DESAPARECIÓ'); return; }
  var difs = 0;
  for (var r3 = 1; r3 <= rng.e.r; r3++) {
    var cc = ws2[XLSX.utils.encode_cell({ r: r3, c: i })];
    if (t(cc ? cc.v : '') !== antes[h][r3 - 1]) difs++;
  }
  if (difs) mal.push(h + ': ' + difs + ' celda(s) cambiaron');
});
RETIRAR.forEach(function (r) { if (enc2.indexOf(r.nombre) >= 0) mal.push(r.nombre + ': SIGUE en la hoja'); });
console.log('\n  ── verificación ANTES de publicar');
console.log('     columnas: ' + enc.length + ' → ' + enc2.filter(Boolean).length);
console.log('     ' + (mal.length ? '🔴 ' + mal.length + ' problema(s): ' + mal.slice(0, 5).join(' · ')
  : '✔ las ' + Object.keys(antes).length + ' columnas que se quedan tienen EXACTAMENTE los mismos valores, celda por celda'));
if (mal.length) { console.log('\n  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log('\n  ✅ ' + RETIRAR.length + ' COLUMNAS RETIRADAS · el resto verificado celda por celda');
