// nestle-catalogo · CERRAR LOS HUECOS DE QCART. Rick: «Qcart sí tiene que quedar todo cuadrado».
//
// 🔴 LA IDEA DE FONDO: «no lleva Qcart» ES UN DATO, no un hueco. 34 piezas dicen `PENDIENTE` o
//    `POR DEFINIR` en `Tiene_Qcart` y **no están en el maestro de links por ningún shortlink**.
//    Eso no es que falte el dato: es que esa pieza no lleva carrito. Y en cuanto se dice `No`,
//    todas sus columnas de carrito dejan de ser «lo debemos» y pasan a ser `N/A` — que es
//    exactamente para lo que existen los tres estados de celda.
//
// 🔴 LAS CUATRO REGLAS, cada una con su fuente:
//    R1 · sin bloque en el maestro Y sin códigos propios  → `Tiene_Qcart = No` + sus columnas N/A
//    R2 · ya dice `No`                                    → solo se cierran sus columnas con N/A
//    R3 · dice `Sí` y le falta `Codigos_Qcart`            → se DERIVA de sus propios `Cod_*_N`
//         (misma fila, no una hermana: es sumar lo que la pieza ya declara)
//    R4 · tiene bloque en el maestro                      → recetas, URLs y códigos DEL MAESTRO
//
// 🔴 LO QUE NO SE INVENTA. `Carritos_Total` y `Views_Total` NO salen del maestro: salen de los
//    eventos de Qcart, y eso lo calcula el motor. Aquí solo se dice si la pieza LLEVA carrito;
//    cuántos trajo lo dice el corte. Escribir un 0 aquí sería una medición que nadie hizo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var ML = require(__dirname + '/lib-maestro-links.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var HOJA = 'Catalogo_Piezas';
var FALTA = /^(POR DEFINIR|PENDIENTE)$/i;
var falta = function (v) { return FALTA.test(t(v)); };

DECL.declarar('nestle-catalogo', 'catalogo.cerrar-qcart.js', [{
  hoja: HOJA, grano: 'una CELDA — pieza × columna de Qcart',
  llave: 'Pieza_ID + nombre de columna',
  celdas_esperadas: 'los POR DEFINIR de Qcart: N/A donde la pieza no lleva carrito, dato donde el maestro lo tiene'
}]);

console.log('════════ nestle-catalogo · CERRAR QCART ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var X = M.cargar();
var doc = ML.piezasDelDoc();
var docPorCodigo = {};
doc.forEach(function (b) { (b.codigos || []).forEach(function (c) { if (t(c)) docPorCodigo[t(c)] = b; }); });
console.log('  catálogo ' + X.piezas.length + ' piezas   ·   maestro ' + doc.length + ' bloques, ' + Object.keys(docPorCodigo).length + ' shortlinks\n');

var enc = XLSX.utils.sheet_to_json(XLSX.readFile(X.tmp).Sheets[HOJA], { header: 1, defval: '' })[0].map(t);
var iDe = {}; enc.forEach(function (h, i) { if (h) iDe[h] = i; });
var wsL = XLSX.readFile(X.tmp).Sheets[HOJA];
var rngL = XLSX.utils.decode_range(wsL['!ref']);
var iPieza = enc.indexOf(X.nmPieza), filaDe = {};
for (var r0 = 1; r0 <= rngL.e.r; r0++) { var cP = wsL[XLSX.utils.encode_cell({ r: r0, c: iPieza })]; var i0 = cP ? t(cP.v) : ''; if (i0) filaDe[i0] = r0 + 1; }

var nmQ = X.columna('Tiene_Qcart'), nmCod = X.columna('Codigos_Qcart'), nmN = X.columna('N_Recetas');
var nmFte = X.columna('Fuente_Qcart'), nmC = X.columna('Campaña'), nmT = X.columna('TouchPoint'), nmS = X.columna('Segmento');
// las columnas que solo existen si la pieza lleva carrito
var COLS_CARRITO = ['N_Recetas', 'Codigos_Qcart', 'Fuente_Qcart', 'Carritos_Total', 'Views_Total',
  'Fecha_Activacion_Qcart', 'Activaciones_Qcart'];
var RX_RECETA = /^(Receta|URL_Receta|Cod_Walmart|Cod_Chedraui|Carritos_Walmart|Carritos_Chedraui)_(\d)$/;

var plan = [], resumen = { R1: 0, R2: 0, R3: 0, R4: 0 }, piezasR1 = [], sinCerrar = [];
// 🔴 LAS 12 GEMELAS DE FUEL FOR LIFE NO SE TOCAN. .. son filas que un script
//    duplicó el 20-ago (las 12 llevan el mismo jobId y repiten los envíos de 009-P006..P017).
//    Rick pidió dejarlas quietas hasta decidir. Escribirles aunque sea un  las haría parecer
//    piezas legítimas y enterraría la evidencia. Se saltan, y se dice que se saltaron.
var GEMELAS = /^009-P0(1[89]|2[0-9])$/;
var saltadas = [];
X.piezas.forEach(function (p) {
  var id = X.idDe(p), fila = filaDe[id]; if (!fila) return;
  if (GEMELAS.test(id)) { saltadas.push(id); return; }
  var codsPropios = t(p[nmCod]).split(/[;,]\s*/).map(t).filter(function (c) { return c && !falta(c) && !/^N\/A$/i.test(c); });
  // también los códigos individuales de la fila
  enc.forEach(function (h) {
    var m = RX_RECETA.exec(h); if (!m || !/^Cod_/.test(h)) return;
    var v = t(p[h]); if (v && !falta(v) && !/^N\/A$/i.test(v)) v.split(/[;,]\s*/).map(t).forEach(function (c) { if (c && codsPropios.indexOf(c) < 0) codsPropios.push(c); });
  });
  var bloque = null;
  codsPropios.forEach(function (c) { if (!bloque && docPorCodigo[c]) bloque = docPorCodigo[c]; });
  var q = t(p[nmQ]);
  function pon(colNom, valor, regla) {
    var i = iDe[colNom]; if (i === undefined) return;
    if (!falta(p[colNom])) return;
    plan.push({ id: id, col: colNom, fila: fila, ref: col(i) + fila, valor: valor, regla: regla });
    resumen[regla]++;
  }

  // R4 · tiene bloque en el maestro → sus recetas y códigos
  if (bloque) {
    (bloque.recetas || []).forEach(function (rec, k) { pon('Receta_' + (k + 1), rec, 'R4'); });
    (bloque.codigos || []).forEach(function (c, k) { pon('Cod_Walmart_' + (k + 1), c, 'R4'); });
    pon('Tiene_Qcart', 'Sí', 'R4');
    pon('N_Recetas', String((bloque.recetas || []).length || (bloque.codigos || []).length), 'R4');
    pon('Codigos_Qcart', (bloque.codigos || []).join(', '), 'R4');
    pon('Fuente_Qcart', 'maestro Qcart-Links · ' + bloque.llave, 'R4');
    // 🔴 lo que el maestro NO tiene se queda: Chedraui, URLs y los carritos son de otra fuente
    var quedan = ['Carritos_Total', 'Views_Total', 'Fecha_Activacion_Qcart', 'Activaciones_Qcart']
      .filter(function (c) { return falta(p[c]); });
    if (quedan.length) sinCerrar.push({ id: id, cols: quedan, motivo: 'el maestro no trae carritos ni activación — los mide el corte de Qcart' });
    return;
  }

  // R1 · sin bloque y sin códigos propios → no lleva Qcart
  if (!codsPropios.length) {
    if (falta(q)) { pon('Tiene_Qcart', 'No', 'R1'); piezasR1.push(id + ' · ' + t(p[nmC]) + ' · ' + t(p[nmT])); }
    COLS_CARRITO.forEach(function (c) {
      if (c === 'Tiene_Qcart') return;
      pon(c, c === 'N_Recetas' ? '0' : 'N/A', falta(q) ? 'R1' : 'R2');
    });
    enc.forEach(function (h) { if (RX_RECETA.test(h)) pon(h, 'N/A', falta(q) ? 'R1' : 'R2'); });
    return;
  }

  // R3 · dice Sí y tiene códigos, pero le falta la lista concatenada → se deriva de su propia fila
  if (falta(p[nmCod]) && codsPropios.length) pon('Codigos_Qcart', codsPropios.join(', '), 'R3');
  var faltan = COLS_CARRITO.concat(enc.filter(function (h) { return RX_RECETA.test(h); })).filter(function (c) { return falta(p[c]); });
  if (faltan.length) sinCerrar.push({ id: id, cols: faltan, motivo: 'lleva Qcart y el maestro no tiene ese bloque (mes no vigente o sin fecha)' });
});

if (saltadas.length) console.log('  ⏭ saltadas por decisión pendiente de Rick: ' + saltadas.length + ' gemelas de Fuel for life (' + saltadas[0] + '..' + saltadas[saltadas.length-1] + ')');
console.log('  ── lo que se va a escribir');
console.log('     R1 · no lleva Qcart (sin bloque ni códigos)      ' + String(resumen.R1).padStart(4) + ' celda(s)   ·   ' + piezasR1.length + ' pieza(s) pasan a `Tiene_Qcart = No`');
console.log('     R2 · ya decía `No`, se cierran sus columnas      ' + String(resumen.R2).padStart(4) + ' celda(s)');
console.log('     R3 · `Codigos_Qcart` derivado de su propia fila  ' + String(resumen.R3).padStart(4) + ' celda(s)');
console.log('     R4 · recetas y códigos DEL MAESTRO              ' + String(resumen.R4).padStart(4) + ' celda(s)');
console.log('     ─────');
console.log('     TOTAL                                           ' + String(plan.length).padStart(4) + ' celda(s)');
if (piezasR1.length) {
  console.log('\n     las que pasan a `No`:');
  piezasR1.slice(0, 12).forEach(function (x) { console.log('        ' + x); });
  if (piezasR1.length > 12) console.log('        … y ' + (piezasR1.length - 12) + ' más');
}
if (sinCerrar.length) {
  console.log('\n  ── 🔴 lo que NO se cierra (' + sinCerrar.length + ' pieza(s)) — se declara, no se inventa');
  sinCerrar.slice(0, 8).forEach(function (x) { console.log('     ' + x.id.padEnd(10) + x.cols.length + ' columna(s)   ' + x.motivo); });
  if (sinCerrar.length > 8) console.log('     … y ' + (sinCerrar.length - 8) + ' más');
}
fs.writeFileSync(BACK + '/_preescritura/PRE-cerrar-qcart.json', JSON.stringify({ cuando: new Date().toISOString(), plan: plan, sinCerrar: sinCerrar }, null, 1));
console.log('\n  → _preescritura/PRE-cerrar-qcart.json');
if (!plan.length) { console.log('\n  ✅ nada que escribir.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-cerrar-qcart.xlsx';
fs.copyFileSync(X.libro, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(X.tmp);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte), esc = 0;
plan.forEach(function (x) {
  var res = CX.poner(xml, x.ref, CX.celda(x.ref, x.valor, CX.estiloDe(xml, x.ref)), x.fila);
  xml = res.xml; if (res.como !== 'sin fila') esc++;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(X.tmp);
console.log('     ✔ ' + esc + ' de ' + plan.length + ' celda(s)');
if (esc !== plan.length) { console.log('  🔴 faltaron celdas: NO se publica.'); process.exit(1); }

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 58)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 58)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', X.tmp])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(X.tmp, X.libro);
console.log('     → publicado a ' + path.basename(X.libro));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', X.libro]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', X.libro]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', X.libro]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', X.libro]);

console.log('\n  ── releído del disco');
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(X.libro).Sheets[HOJA], { defval: '', blankrows: false });
var nrm = function (z) { return String(z == null ? '' : z).normalize('NFC').trim(); };
var mal = 0;
plan.forEach(function (x) {
  var p = P2.filter(function (y) { return t(y[X.nmPieza]) === x.id; })[0];
  if (!p || nrm(p[x.col]) !== nrm(x.valor)) mal++;
});
console.log('     ' + (mal ? '🔴 ' : '✔ ') + (plan.length - mal) + ' de ' + plan.length + ' celda(s) quedaron');
console.log('     filas del catálogo: ' + X.hoja.length + ' → ' + P2.length + (X.hoja.length === P2.length ? '   ✔ ninguna se movió' : '   🔴 CAMBIÓ'));
if (X.hoja.length !== P2.length) mal++;
console.log('\n  ' + (mal ? '🔴 ' + mal + ' no quedaron' : '✅ QCART CERRADO · ' + plan.length + ' celdas, verificadas contra el disco'));
process.exit(mal ? 1 : 0);
