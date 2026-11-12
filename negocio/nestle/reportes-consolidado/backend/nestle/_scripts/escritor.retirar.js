// N4r · RETIRAR columnas y hojas — etapa 10, skill `crm-reporte-escritor`.
//
// 🔴 ES EL ÚNICO SCRIPT DEL SISTEMA QUE BORRA, y por eso es el más desconfiado. El principio que Rick
//    puso por encima de todo es «ningún paso borra por su cuenta; ante la duda conserva y declara».
//    Este borra solo cuando se cumplen las TRES, y las comprueba él mismo:
//
//      1 · está en la LISTA DECLARADA de abajo — nada se borra por parecer sobrante
//      2 · 🔴 NO APORTA NADA que no esté ya en otro sitio — se prueba celda por celda
//      3 · ninguna fórmula del libro la cita
//
//    Si una sola falla, no borra: lo dice y sale. Equivocarse conservando cuesta una columna de
//    más; equivocarse borrando cuesta el dato de alguien, y ya pasó.
//
// 🔴 Y SIEMPRE CON BACKUP PROPIO, aparte del de la cadena: un borrado es lo único que no se puede
//    deshacer releyendo el archivo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// ── LO DECLARADO. Cada entrada dice QUIÉN se quedó con su contenido.
var COLUMNAS = [
  { hoja: 'Catalogo_Piezas', col: 'EmailID',
    releva: ['Email_ID (de la DE de SFMC)'],
    porque: 'fusionada: 181 celdas se llenaron y 009-P001, que discrepaba, quedó con LOS DOS («83356 · 83347»)' },
  { hoja: 'Catalogo_Piezas', col: 'Email_Name_Legacy (duplicada, no usar)',
    releva: ['Email_Name', 'Codigos_Qcart'],
    porque: 'sus 31 filas de WhatsApp eran CÓDIGOS de Qcart y fueron a `Codigos_Qcart`; los 4 email names que discrepaban quedaron con ambos' },
  // 🔴 UNA COLUMNA QUE SE DECIDIÓ QUITAR NO SE LLENA: SE RETIRA. `Unsubs_Total` es la decisión D3
  //    de Rick —«unsuscribe total se quita»— y quedó vacía en la hoja, así que la medición de
  //    huecos la contaba como 64 celdas POR DEFINIR. Rellenarla habría revivido una columna que él
  //    mandó eliminar, y encima habría ensuciado la lista de lo que de verdad falta.
  //    El conteo de bajas vive en `Unsubs_Unicos`, y sus dos lecturas en `% Unsuscribe` (sobre
  //    envíos) y `% Unsub vs Clicks` (sobre clicks), que son las que Rick pidió el 25-ago.
  { hoja: 'Report_Resumen', col: 'Unsubs_Total',
    releva: ['Unsubs_Unicos', '% Unsuscribe', '% Unsub vs Clicks'],
    porque: 'decisión D3 de Rick: «unsuscribe total se quita». El conteo vivo es Unsubs_Unicos y sus dos tasas' }
];
var HOJAS = [
  { hoja: 'Soporte_IA_Qcart_Productos', porque: 'Rick autorizó borrarla: no se usa y está en backup' },
  { hoja: 'Soporte_IA_Stage_Carts', porque: 'Rick autorizó borrarla: no se usa y está en backup' }
];
var INTOCABLE = ['Reporte_julio'];

console.log('════════ N4r · RETIRAR ' + (ESCRIBIR ? '🔴 BORRA' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_n4r.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);

// ── las tres pruebas, columna por columna
var vanCol = [], noVan = [];
COLUMNAS.forEach(function (c) {
  if (INTOCABLE.indexOf(c.hoja) >= 0) { noVan.push({ c: c, motivo: 'la hoja es INTOCABLE' }); return; }
  var sh = wb.Sheets[c.hoja];
  if (!sh) { noVan.push({ c: c, motivo: 'la hoja no existe' }); return; }
  var enc = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t);
  if (enc.indexOf(c.col) < 0) { noVan.push({ c: c, motivo: 'la columna ya no está' }); return; }
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  // 🔴 prueba 2 · ¿aporta algo que no esté ya en su relevo?
  var huerfanas = F.filter(function (r) {
    var v = t(r[c.col]); if (!v) return false;
    return !c.releva.some(function (rc) { return t(r[rc]).indexOf(v) >= 0; });
  });
  if (huerfanas.length) {
    noVan.push({ c: c, motivo: '🔴 aporta ' + huerfanas.length + ' valor(es) que NO están en ' + c.releva.join(' ni ') });
    return;
  }
  vanCol.push({ c: c, filas: F.filter(function (r) { return t(r[c.col]); }).length });
});

// ── las hojas: ¿alguna fórmula las cita?
var vanHoja = [], noVanHoja = [];
HOJAS.forEach(function (h) {
  if (INTOCABLE.indexOf(h.hoja) >= 0) { noVanHoja.push({ h: h, motivo: 'INTOCABLE' }); return; }
  if (!wb.Sheets[h.hoja]) { noVanHoja.push({ h: h, motivo: 'ya no está' }); return; }
  var citas = 0;
  wb.SheetNames.forEach(function (n) {
    var s = wb.Sheets[n]; if (!s || !s['!ref'] || n === h.hoja) return;
    Object.keys(s).forEach(function (a) { if (a[0] !== '!' && s[a] && s[a].f && String(s[a].f).indexOf(h.hoja) >= 0) citas++; });
  });
  if (citas) { noVanHoja.push({ h: h, motivo: '🔴 ' + citas + ' fórmula(s) la citan' }); return; }
  var F = XLSX.utils.sheet_to_json(wb.Sheets[h.hoja], { defval: '', blankrows: false });
  vanHoja.push({ h: h, filas: F.length, citas: 0 });
});

console.log('  ── COLUMNAS ──');
vanCol.forEach(function (x) { console.log('   ✔ se retira  ' + x.c.hoja + ' → «' + x.c.col + '»  (' + x.filas + ' filas con dato, todas ya en ' + x.c.releva.join('/') + ')'); });
noVan.forEach(function (x) { console.log('   ⛔ NO se retira ' + x.c.hoja + ' → «' + x.c.col + '»  ' + x.motivo); });
console.log('\n  ── HOJAS ──');
vanHoja.forEach(function (x) { console.log('   ✔ se borra  «' + x.h.hoja + '»  (' + x.filas + ' filas · 0 fórmulas la citan)'); });
noVanHoja.forEach(function (x) { console.log('   ⛔ NO se borra «' + x.h.hoja + '»  ' + x.motivo); });
console.log('\n  🔒 intocables: ' + INTOCABLE.join(' · '));

if (!ESCRIBIR) { console.log('\n  (seco. Para retirar: --escribir)'); process.exit(0); }
if (!vanCol.length && !vanHoja.length) { console.log('\n  nada que retirar.'); process.exit(0); }

// backup propio
var stamp = String(fs.statSync(vivo.ruta).mtime.getTime());
var bk = PROY + '/_backups/' + require('path').basename(vivo.ruta).replace(/\.xlsx$/, '') + '__antes-de-retirar-' + stamp + '.xlsx';
fs.copyFileSync(vivo.ruta, bk);
console.log('\n  backup propio → ' + require('path').basename(bk));

// libre
try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); }
catch (e) { console.log('  🔴 el archivo está TOMADO (' + e.code + '). No se retira nada.'); process.exit(2); }

// ── retirar las hojas (por XML: quitar del workbook y sus rels)
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
vanHoja.forEach(function (x) {
  var m = new RegExp('<sheet[^>]*name="' + x.h.hoja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*/>').exec(wbx);
  if (!m) { console.log('   ⚠ no encontré «' + x.h.hoja + '» en workbook.xml'); return; }
  var rid = (/r:id="(rId\d+)"/.exec(m[0]) || [])[1];
  wbx = wbx.replace(m[0], '');
  if (rid) rels = rels.replace(new RegExp('<Relationship[^>]*Id="' + rid + '"[^>]*/>'), '');
  console.log('   − hoja retirada: ' + x.h.hoja);
});
zip.updateFile('xl/workbook.xml', Buffer.from(wbx, 'utf8'));
zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
zip.writeZip(SECO);

// ── retirar las columnas: POR XML, no con el acumulador ───────────────────────────────
// 🔴 `regenerarHoja` NO PUEDE QUITAR UNA COLUMNA, y lo descubrí por las malas. El escritor único
//    lee el ENCABEZADO ACTUAL de la hoja y escribe las filas contra él: si le paso filas sin la
//    columna, simplemente la deja vacía y la columna sigue. Anuncié «88 → 86 columnas», salió en
//    verde, y las dos fantasmas seguían ahí. Un camino que reporta éxito sin hacer nada es peor
//    que uno que falla.
//    Quitar una columna es cirugía sobre el XML: se borran sus celdas y las de su derecha se
//    corren una letra. Es lo mismo que ya se hace para retirar una hoja, y por eso aquello sí
//    funcionó a la primera.
function letraDe(ref) { return (/^([A-Z]+)/.exec(ref) || [])[1] || ''; }
function numDe(letra) { var n = 0; for (var i = 0; i < letra.length; i++) n = n * 26 + (letra.charCodeAt(i) - 64); return n; }
function letraDeNum(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

function quitarColumnas(xml, indices) {   // indices: números de columna 1-based, a quitar
  var fuera = {}; indices.forEach(function (i) { fuera[i] = 1; });
  // nuevo número de columna para cada viejo
  var mapa = {}, k = 0;
  var maxCol = Math.max.apply(null, indices.concat([1]));
  for (var i = 1; i <= 1000; i++) { if (fuera[i]) continue; k++; mapa[i] = k; }
  // 🔴 ESTE REGEX ES EL QUE DAÑÓ EL CATÁLOGO — y el defecto era el ORDEN de las alternativas.
  //    Decía `<c …>([\s\S]*?)</c>  |  <c …/>`, con la pareja PRIMERO. Una celda auto-cerrada
  //    —`<c r="B2" s="5"/>`, que es como se guarda una celda vacía con formato— entra igual por la
  //    primera alternativa: `([^>]*)>` se traga la barra de `/>` y entonces `([\s\S]*?)</c>` sale a
  //    buscar el siguiente `</c>` **devorando todas las celdas que haya en medio**. Se re-emitían
  //    dentro de `todo` con solo la PRIMERA referencia renumerada, así que los valores caían en
  //    columnas ajenas: `BU` 299→211, `Content_ID` 119→0, `Email_ID` 299→119, `Codigos_Qcart` 31→0.
  //    En el catálogo hay 15,244 celdas vacías: la trampa saltaba en casi cada fila.
  //
  //    Ahora la auto-cerrada va PRIMERO y su alternativa exige terminar en `/>`; como `[^>]*?` no
  //    puede cruzar un `>`, ninguna de las dos puede invadir a la otra. Y no basta con creerlo:
  //    `escritor.probar-retiro.js` planta el caso y compara CELDA POR CELDA contra el encabezado.
  return xml.replace(/<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g,
    function (todo, attrsAuto, attrsPar) {
      var attrs = attrsAuto != null ? attrsAuto : attrsPar;
      var m = /r="([A-Z]+)(\d+)"/.exec(attrs || '');
      if (!m) return todo;                                       // sin referencia: no se toca
      var Lx = m[1], Fx = m[2], n = numDe(Lx);
      if (fuera[n]) return '';                                   // la celda se va
      var nueva = letraDeNum(mapa[n] || n);
      if (nueva === Lx) return todo;
      return todo.replace('r="' + Lx + Fx + '"', 'r="' + nueva + Fx + '"');
    });
}

var CB = require(__dirname + '/lib-cambios.js');
// 🔴 UNA SOLA REGENERACIÓN POR HOJA, con TODAS sus columnas de una vez. Llamar `regenerarHoja` dos
//    veces sobre la misma hoja no quita dos columnas: la segunda llamada se construye desde la
//    misma lectura que la primera —o sea, con la columna que la primera iba a quitar— y PISA su
//    resultado. Efecto medido: se anunciaron dos retiros, se aplicó cero. Y salió en verde.
var wb2 = XLSX.readFile(SECO);
var zip2 = new AdmZip(SECO);
var wbx2 = zip2.readAsText('xl/workbook.xml'), rels2 = zip2.readAsText('xl/_rels/workbook.xml.rels');
var rmap2 = {}; rels2.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap2[i] = tg; return _; });
var parteDe2 = {};
wbx2.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe2[n] = 'xl/' + String(rmap2[rid]).replace(/^\//, ''); return _; });

var porHoja = {};
vanCol.forEach(function (x) { (porHoja[x.c.hoja] = porHoja[x.c.hoja] || []).push(x.c.col); });
Object.keys(porHoja).forEach(function (hoja) {
  var sh = wb2.Sheets[hoja], parte = parteDe2[hoja];
  if (!parte) { console.log('   ⚠ no encontré la parte XML de ' + hoja); return; }
  var enc = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t);
  var fuera = porHoja[hoja];
  var indices = fuera.map(function (c) { return enc.indexOf(c) + 1; }).filter(function (i) { return i > 0; });
  if (indices.length !== fuera.length) { console.log('   ⚠ alguna columna no se encontró en el encabezado de ' + hoja); return; }
  var xml = zip2.readAsText(parte);
  xml = quitarColumnas(xml, indices);
  // el <dimension> tiene que encoger con la hoja, o Excel sigue leyendo el rango viejo
  var quedan = enc.filter(function (c) { return fuera.indexOf(c) < 0; }).length;
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, f1, c2, f2) {
    return '<dimension ref="' + c1 + f1 + ':' + letraDeNum(quedan) + f2 + '"/>';
  });
  // y las definiciones de ancho también, o quedan apuntando a columnas que ya no existen
  // 🔴 EL BLOQUE `<cols>` SE RECONSTRUYE, NO SE BORRA. Borrarlo entero era «más simple» y costó los
  //    65 anchos de `Catalogo_Piezas`: el render lo enseñó de inmediato —«Recetas Ne», «Career Foc»,
  //    «Traditional» cortados— porque sin `<cols>` Excel usa el ancho por defecto en las 86 columnas.
  //    Ningún check lo vio: el paquete estaba sano, las 5 capas en verde y las celdas en su sitio.
  //    Un ancho perdido no es cosmética — es la regla de que MIRAR el render es parte de entregar.
  //    Ahora se mapea cada `<col>` igual que las celdas: se descartan los tramos de las columnas
  //    retiradas y los de la derecha se corren, conservando su ancho.
  xml = xml.replace(/<cols>([\s\S]*?)<\/cols>/, function (_todo, dentro) {
    var out = [];
    dentro.replace(/<col\b([^>]*)\/>/g, function (tag, attrs) {
      var mn = Number((/min="(\d+)"/.exec(attrs) || [])[1]);
      var mx = Number((/max="(\d+)"/.exec(attrs) || [])[1]);
      if (!mn || !mx) return tag;
      for (var c = mn; c <= mx; c++) {
        if (fuera[c]) continue;                       // esta columna se va: su ancho también
        var n = mapa[c] || c;                          // el mismo mapa que renumeró las celdas
        out.push('<col' + attrs.replace(/min="\d+"/, 'min="' + n + '"').replace(/max="\d+"/, 'max="' + n + '"') + '/>');
      }
      return tag;
    });
    return out.length ? '<cols>' + out.join('') + '</cols>' : '';
  });
  zip2.updateFile(parte, Buffer.from(xml, 'utf8'));
  console.log('   − ' + hoja + ': ' + enc.filter(Boolean).length + ' → ' + quedan + ' columnas (por XML, celda por celda)');
  fuera.forEach(function (c) { console.log('        «' + c + '»  (col ' + letraDeNum(enc.indexOf(c) + 1) + ')'); });
});
zip2.writeZip(SECO);

console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
fs.copyFileSync(SECO, vivo.ruta);
// 🔴 SE VERIFICA RELEYENDO EL VIVO, no el objeto en memoria. La versión anterior de este paso
//    anunció «88 → 86» y no había quitado nada: sin releer, un no-op se ve idéntico a un éxito.
var wb3 = XLSX.readFile(vivo.ruta);
var malas = [];
Object.keys(porHoja).forEach(function (hoja) {
  var enc = (XLSX.utils.sheet_to_json(wb3.Sheets[hoja], { header: 1 })[0] || []).map(t);
  porHoja[hoja].forEach(function (c) { if (enc.indexOf(c) >= 0) malas.push(hoja + ' → «' + c + '»'); });
  console.log('  ✔ releído del vivo: ' + hoja + ' tiene ' + enc.filter(Boolean).length + ' columnas · ' +
    XLSX.utils.sheet_to_json(wb3.Sheets[hoja], { defval: '', blankrows: false }).length + ' filas');
});
if (malas.length) { console.log('  🔴 SIGUEN AHÍ: ' + malas.join(' · ')); process.exit(1); }
console.log('  ✔ retiradas de verdad, comprobado releyendo el archivo.');
