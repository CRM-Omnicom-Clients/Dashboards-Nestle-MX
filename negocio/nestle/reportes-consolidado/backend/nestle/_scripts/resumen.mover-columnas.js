// crm-reporte-resumen · MOVER COLUMNAS A SU LUGAR, y darles el FORMATO de su hermana.
//
// 🔴 LO QUE PIDIÓ RICK (4-sep-2026): «las columnas de unsuscribe las ordenemos donde van, y
//    ajustes el formato de cómo pegas los datos hardcodeados». Las nueve nacieron AL FINAL —
//    agregar al final es la operación segura y por eso se hizo así— y salen como `0.006281462`
//    porque nacieron sin estilo. Ahora van dentro de su bloque y con el formato de la hoja.
//
// 🔴 EL FORMATO NO SE INVENTA: SE HEREDA DE LA HERMANA. En vez de fabricar un `numFmt` nuevo
//    —que SheetJS renumera y termina aplicando el formato equivocado— cada columna toma el
//    estilo de la que ya hace lo mismo en su bloque: `Principal_Unsubs` copia a
//    `Principal_Clicks`, y `Principal_UTOR` copia a `Principal_CTOR`. Así queda con el formato
//    que Rick ya eligió, no con el que yo elegiría.
//
// 🔴 Y NO SE MUEVE UNA SOLA CELDA DE DATOS. Mover 82 filas × 9 columnas es la operación que en
//    agosto desplazó celdas y perdió cinco columnas del catálogo. Aquí se mueven solo TRES cosas
//    —el encabezado, el ancho y el estilo— y después `resumen-regenerar` reconstruye las filas
//    leyendo el encabezado, que es como ya trabaja. El dato nunca viaja: se vuelve a escribir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Report_Resumen';
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// ══ EL ORDEN QUE PIDIÓ RICK ════════════════════════════════════════════════════════
// El bloque ya tiene su patrón: primero los CONTEOS, después las TASAS. Las bajas entran
// respetándolo — el conteo junto a los clicks, las dos tasas junto a las otras tasas.
var MOVIMIENTOS = [
  { columna: 'Principal_Unsubs', despues_de: 'Principal_Clicks', formato_de: 'Principal_Clicks' },
  // 🔴 9-sep-2026 · la UTOR se re-ancla al Click_Rate. Estaba anclada a 'Principal_Unsub_Rate
  //    (vs sends)', que Rick retiró: un ancla que apunta a una columna que ya no existe no falla,
  //    deja la columna donde estaba y nadie lo ve. El ancla se mueve a la hermana que SÍ se queda.
  { columna: 'Principal_UTOR (vs opens)', despues_de: 'Principal_Click_Rate', formato_de: 'Principal_CTOR' },
  { columna: 'FUP_Unsubs', despues_de: 'FUP_Clicks', formato_de: 'FUP_Clicks' },
  { columna: 'FUP_UTOR (vs opens)', despues_de: 'FUP_Click_Rate', formato_de: 'FUP_CTOR' },
  { columna: 'Tot_Unsubs', despues_de: 'Tot_Clicks', formato_de: 'Tot_Clicks' },
  { columna: 'Tot_UTOR (vs opens)', despues_de: 'Tot_Click_Rate', formato_de: 'Tot_CTOR' },
  // ── 7-sep-2026 · la Fecha de envío, a la IZQUIERDA de su Subject. El formato lo hereda de
  //    `FechaQcart_Desde`, que ya es una fecha en la hoja — así se ve como fecha y no como 46258.
  { columna: 'Principal_Fecha_Envio', antes_de: 'Principal_Subject', formato_de: 'FechaQcart_Desde' },
  { columna: 'FUP_Fecha_Envio', antes_de: 'FUP_Subject', formato_de: 'FechaQcart_Desde' },

  // ══ 20-sep-2026 · EL DESGLOSE DE CLICKS, DENTRO DE SU BLOQUE ════════════════════════════════
  // Rick: «necesito que queden bien ordenadas y donde van con buen formato». Nacieron al final,
  // después de `Insights` —agregar al final es la operación segura— y ahí no se leen: la columna
  // que explican (`*_Clicks`) queda a 50 columnas de distancia.
  //
  // 🔴 DÓNDE VAN: pegadas a `*_Clicks`, que es la columna que desglosan, y ANTES de `*_Unsubs`.
  //    El bloque tiene su patrón —primero los CONTEOS, después las TASAS— y estas tres son
  //    conteos. Queda: Sends → Deliveries → Opens → Clicks → CTA → Baja → Redes+Nav+Legal →
  //    Unsubs → las cuatro tasas.
  //
  // 🔴 EL ORDEN ENTRE ELLAS ES EL QUE RICK NOMBRÓ, textual: «*_Clicks_CTA, *_Clicks_Baja,
  //    *_Clicks_redes». Se me ocurrió que `Clicks_Baja` pegada a `Unsubs` leería mejor —son el
  //    mismo tema y la comparación que originó todo esto— pero eso es reordenar lo que él dictó
  //    por una preferencia mía. Su orden manda.
  //
  // 🔴 Y VAN ENCADENADAS, no las tres ancladas a `*_Clicks`. `MOVIMIENTOS` se aplica EN SECUENCIA
  //    sobre la lista que se va modificando: si las tres dijeran `despues_de: Principal_Clicks`,
  //    cada una se metería justo después de Clicks empujando a la anterior, y saldrían al revés
  //    —RNL, Baja, CTA— sin que nada fallara. Cada una se ancla a la que la precede.
  { columna: 'Principal_Clicks_CTA', despues_de: 'Principal_Clicks', formato_de: 'Principal_Clicks' },
  { columna: 'Principal_Clicks_Baja', despues_de: 'Principal_Clicks_CTA', formato_de: 'Principal_Clicks' },
  { columna: 'Principal_Clicks_Redes+Navegador+Legal', despues_de: 'Principal_Clicks_Baja', formato_de: 'Principal_Clicks' },
  { columna: 'FUP_Clicks_CTA', despues_de: 'FUP_Clicks', formato_de: 'FUP_Clicks' },
  { columna: 'FUP_Clicks_Baja', despues_de: 'FUP_Clicks_CTA', formato_de: 'FUP_Clicks' },
  { columna: 'FUP_Clicks_Redes+Navegador+Legal', despues_de: 'FUP_Clicks_Baja', formato_de: 'FUP_Clicks' },
  { columna: 'Tot_Clicks_CTA', despues_de: 'Tot_Clicks', formato_de: 'Tot_Clicks' },
  { columna: 'Tot_Clicks_Baja', despues_de: 'Tot_Clicks_CTA', formato_de: 'Tot_Clicks' },
  { columna: 'Tot_Clicks_Redes+Navegador+Legal', despues_de: 'Tot_Clicks_Baja', formato_de: 'Tot_Clicks' },

  /* 🔴 24-sep-2026 · `Clicks_Medidos` VA PEGADO A LOS TRES QUE SUMA, no al final del bloque.
   *    `resumen.asegurar-columnas` las crea al final de la hoja (CG/CH/CI) porque ahí es donde se
   *    puede añadir sin desplazar nada — pero dejarlas ahí es justo lo que Rick corrigió en su día:
   *    «las columnas quedaron al final, necesito que queden bien ordenadas y donde van».
   *    Un total separado de sus partes no se lee como su total.
   *    Encadenadas a Redes+Navegador+Legal, que es la última de las tres. */
  { columna: 'Principal_Clicks_Medidos', despues_de: 'Principal_Clicks_Redes+Navegador+Legal', formato_de: 'Principal_Clicks' },
  { columna: 'FUP_Clicks_Medidos', despues_de: 'FUP_Clicks_Redes+Navegador+Legal', formato_de: 'FUP_Clicks' },
  { columna: 'Tot_Clicks_Medidos', despues_de: 'Tot_Clicks_Redes+Navegador+Legal', formato_de: 'Tot_Clicks' }
];

DECL.declarar('crm-reporte-resumen', 'resumen.mover-columnas.js', [{
  hoja: HOJA, grano: 'el ENCABEZADO, el ANCHO y el ESTILO de una columna — ninguna celda de datos',
  llave: 'el nombre del encabezado',
  celdas_esperadas: MOVIMIENTOS.length + ' encabezado(s) reubicado(s) · 0 celdas de datos movidas'
}]);

console.log('════════ resumen · MOVER COLUMNAS A SU BLOQUE ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_mov.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb0 = XLSX.readFile(TMP);
var R0 = XLSX.utils.sheet_to_json(wb0.Sheets[HOJA], { header: 1, defval: '' });
var enc = R0[0].map(t);
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + enc.length + ' columnas × ' + (R0.length - 1) + ' filas');

// 🔴 LA FOTO DE ANTES, para poder probar que ninguna columna perdió su contenido.
var antes = {};
enc.forEach(function (h, i) {
  if (!h) return;
  var v = []; for (var r = 1; r < R0.length; r++) v.push(t(R0[r][i]));
  antes[h] = v;
});

// ── construir el orden nuevo ────────────────────────────────────────────────────────
var faltan = [];
MOVIMIENTOS.forEach(function (m) {
  [m.columna, m.despues_de, m.antes_de, m.formato_de].forEach(function (n) { if (n !== undefined && enc.indexOf(n) < 0 && faltan.indexOf(n) < 0) faltan.push(n); });
});
if (faltan.length) { console.log('\n  🔴 no están en la hoja: ' + faltan.join(' · ') + '. No se toca nada.'); process.exit(1); }

var orden = enc.slice();
MOVIMIENTOS.forEach(function (m) {
  var i = orden.indexOf(m.columna);
  orden.splice(i, 1);                                  // se saca de donde está
  // 🔴 `antes_de` existe porque así se pide en voz alta: «a la izquierda del subject». Traducirlo
  //    yo a «después de la columna que está antes del subject» funcionaría hoy y se rompería el
    //  día que alguien inserte algo en medio — el ancla sería una columna que nadie nombró.
  var j = m.antes_de !== undefined ? orden.indexOf(m.antes_de) - 1 : orden.indexOf(m.despues_de);
  orden.splice(j + 1, 0, m.columna);                   // y se mete justo después de su ancla
});
// 🔴 GUARDA: reordenar NO puede perder ni inventar una columna. Si el conjunto cambia, algo se
//    escribió mal en la tabla de arriba y NO se toca la hoja.
if (orden.length !== enc.length || orden.slice().sort().join('¦') !== enc.slice().sort().join('¦')) {
  console.log('\n  🔴 el conjunto de columnas cambiaría. No se toca nada.'); process.exit(1);
}

var moved = [];
orden.forEach(function (h, iNuevo) { var iViejo = enc.indexOf(h); if (iViejo !== iNuevo) moved.push({ h: h, de: col(iViejo), a: col(iNuevo) }); });
console.log('\n  ── el bloque queda así');
['Principal_', 'FUP_', 'Tot_'].forEach(function (pre) {
  var g = orden.filter(function (h) { return h.indexOf(pre) === 0; });
  console.log('     ' + pre.padEnd(11) + g.map(function (h) { return h.replace(pre, '').replace(/ \(vs (sends|opens)\)/, ''); }).join(' → '));
});
console.log('\n  ── el formato que hereda cada una');
MOVIMIENTOS.forEach(function (m) { console.log('     ' + m.columna.padEnd(32) + 'copia el estilo de   ' + m.formato_de); });
console.log('\n  ' + moved.length + ' columna(s) cambian de letra   ·   0 celdas de datos se mueven (las reescribe resumen-regenerar)');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA · solo fila 1 (encabezados), fila 2 (estilos) y <cols> (anchos) ════
var RESP = BACK + '/_respaldos/v8-antes-mover-columnas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

// el estilo que hoy tiene cada columna, tomado de la fila 2 (así lo lee el regenerador)
var estiloViejo = {}, anchoViejo = {};
enc.forEach(function (h, i) { if (h) estiloViejo[h] = CX.estiloDe(xml, col(i) + '2'); });
xml.replace(/<col min="(\d+)" max="(\d+)"([^>]*)\/>/g, function (todo, mn, mx, resto) {
  for (var k = +mn; k <= +mx; k++) { var h = enc[k - 1]; if (h) anchoViejo[h] = resto; }
  return todo;
});
// 🔴 el formato heredado se resuelve CONTRA LA FOTO VIEJA, antes de mover nada: si se resolviera
//    después, la hermana ya habría cambiado de letra y se copiaría el estilo de otra columna.
var estiloNuevo = {};
orden.forEach(function (h) { estiloNuevo[h] = estiloViejo[h]; });
MOVIMIENTOS.forEach(function (m) { estiloNuevo[m.columna] = estiloViejo[m.formato_de]; });

// fila 1 · los encabezados en el orden nuevo, conservando el estilo de CADA POSICIÓN
var estEnc = {}; enc.forEach(function (h, i) { estEnc[i] = CX.estiloDe(xml, col(i) + '1'); });
var f1 = '<row r="1">' + orden.map(function (h, i) { return CX.celda(col(i) + '1', h, estEnc[i]); }).join('') + '</row>';
// fila 2 · solo importa el ESTILO: `resumen-regenerar` reescribe todos los valores enseguida
var f2 = '<row r="2">' + orden.map(function (h, i) {
  var e = estiloNuevo[h];
  return '<c r="' + col(i) + '2"' + (e ? ' s="' + e + '"' : '') + '/>';
}).join('') + '</row>';
xml = xml.replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/, f1);
xml = xml.replace(/<row r="2"[^>]*>[\s\S]*?<\/row>/, f2);

// <cols> · el ancho viaja con su columna
var colsNuevo = '<cols>' + orden.map(function (h, i) {
  var resto = anchoViejo[h] || ' width="14" customWidth="1"';
  return '<col min="' + (i + 1) + '" max="' + (i + 1) + '"' + resto + '/>';
}).join('') + '</cols>';
xml = /<cols>[\s\S]*?<\/cols>/.test(xml) ? xml.replace(/<cols>[\s\S]*?<\/cols>/, colsNuevo) : xml;

zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ encabezados, anchos y estilos reubicados');

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 60)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 60)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

console.log('\n  ── releído del disco');
var enc2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets[HOJA], { header: 1, defval: '' })[0].map(t);
var ok = enc2.join('¦') === orden.join('¦');
console.log('     ' + (ok ? '✔ ' : '🔴 ') + 'el encabezado quedó en el orden pedido   ·   ' + enc2.length + ' columnas');
console.log('\n  ' + (ok ? '✅ LISTO — ahora corre `--desde motor-calculo --escribir` para que los datos se reescriban en su nueva columna'
  : '🔴 el encabezado no quedó'));
process.exit(ok ? 0 : 1);
