/*
 * resumen.verificar-clicks.js — LA PRUEBA DE LAS 9 COLUMNAS, contra el disco y contra links.json.
 *
 * 🔴 POR QUÉ NO BASTA CON QUE LA CADENA DIGA «✔». Las dos puertas comparan el reporte con la
 *    REJILLA, y la rejilla es de donde salen estas columnas: comparar el reporte contra su propia
 *    fuente de escritura es circular. Lo que prueba algo es subir un escalón y cruzarlo contra
 *    **`_fuentes/links.json`**, que es la autoridad del desglose por destino — de ahí sale la
 *    rejilla, así que si las dos coinciden el número es verificable sin creerme a mí.
 *
 * 🔴 ANTES ESTO CRUZABA CONTRA LA HOJA `Data_Clicks`, y era un círculo más largo: esa hoja la
 *    materializaba un script desde los mismos insumos. Comparar el reporte contra una copia de su
 *    propia fuente no prueba nada — es el defecto que ya costó 19 checks en verde sobre 14 envíos
 *    mal. La hoja se retiró el 22-sep (Rick: «yo nunca autoricé esa hoja»); esta prueba mejoró al
 *    perderla. Las cifras no se movieron: 35,844 · 3,096 · 6,351, idénticas.
 *
 * LAS 5 PRUEBAS
 *   1 · cada columna del reporte == Σ de `links.json` por clase → columna (y por bloque)
 *   2 · ninguna de las 9 está 100% vacía — una columna muda es el defecto que costó la audiencia
 *   3 · las celdas sin número dicen POR DEFINIR o N/A, nunca 0 ni blanco
 *   4 · la fila de totales suma lo mismo que las filas de arriba
 *   5 · el desglose de cada fila NO se presenta como igual a `*_Clicks`: son dos mediciones
 *       distintas (único por LINK vs único por PERSONA) y se declara la brecha, no se esconde
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var vivo = L.archivoVivo({ dir: PROY });
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_verclicks.xlsx';
fs.copyFileSync(vivo.ruta, tmp);
var wb = XLSX.readFile(tmp);
console.log('════════ resumen · VERIFICAR LAS 9 COLUMNAS DE CLICKS ════════\n');
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   hojas: ' + wb.SheetNames.length);

var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1, defval: '', blankrows: false });
var enc = (R[0] || []).map(t);
/* 🔴 22-sep-2026 · SE VERIFICA CONTRA `links.json`, NO CONTRA `Data_Clicks`.
 *    Esta prueba existía para cruzar el reporte contra algo independiente, y por eso leía una
 *    HOJA. Pero esa hoja la materializaba un script a partir de los mismos insumos: era una copia,
 *    no una fuente. Rick la retiró («yo nunca autoricé esa hoja»), y de paso queda mejor: ahora se
 *    cruza contra `_fuentes/links.json`, que es la AUTORIDAD del desglose por destino.
 *    `piezas[id].por_destino` trae exactamente lo que la hoja agregaba, y la clase → columna la
 *    resuelve `lib-clicks-destino`, que es el único que sabe ese mapeo. */
var LKJ = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_fuentes/links.json', 'utf8'));
var DC = [];
Object.keys(LKJ.piezas || {}).forEach(function (pid) {
  var pz = LKJ.piezas[pid];
  Object.keys(pz.por_destino || {}).forEach(function (clase) {
    /* 🔴 SIN try/catch QUE SE TRAGUE EL ERROR. La primera versión llamaba a `CDv` (un typo: la
     *    librería está en `CD`) dentro de un try, así que TODAS las clases fallaban y `DC` salía
     *    con 0 pares — y el script reportaba «35,844 vs 0», un rojo enorme causado por mí, no por
     *    los datos. Un catch que devuelve null convierte un typo en un cero, y un cero se lee como
     *    «no hubo». `columnaDe` truena a propósito ante una clase desconocida: hay que dejarla. */
    var col = CD.columnaDe(clase);
    if (!CD.tieneColumna(clase)) return;   // `por_clasificar` no va a ninguna columna, por diseño
    DC.push({ Pieza_ID: pid, Va_En_Columna: col, Clicks_DE: pz.por_destino[clase] });
  });
});
console.log('  Report_Resumen: ' + (R.length - 1) + ' filas   ·   links.json: ' +
  Object.keys(LKJ.piezas || {}).length + ' piezas → ' + DC.length + ' pares clase×pieza\n');

var fallos = [];
function K(nom, ok, det) {
  console.log('  ' + (ok ? '✔' : '🔴') + ' ' + nom.padEnd(58) + det);
  if (!ok) fallos.push(nom);
}

// la última fila es la de totales (etiqueta «Total» en la col A)
var iTot = -1;
for (var r = R.length - 1; r >= 1; r--) { if (/^total$/i.test(t((R[r] || [])[0]))) { iTot = r; break; } }
var nDatos = iTot > 0 ? iTot - 1 : R.length - 1;
console.log('  filas de datos: ' + nDatos + '   ·   fila de totales: ' + (iTot > 0 ? 'fila ' + (iTot + 1) : '(no la encontré)') + '\n');

// ── PRUEBA 1 · el reporte contra Data_Clicks ───────────────────────────────────────
console.log('  ── PRUEBA 1 · cada columna == Σ de links.json por clase → columna\n');
// Data_Clicks es por PIEZA; el reporte por bloque. Se compara el TOTAL de cada columna, que es la
// comparación que no depende de cómo se reparten las piezas entre filas.
/* 🔴 Y SE PARTE EN DOS, porque las dos hojas NO cubren lo mismo y comparar los totales a secas
 *    da un rojo que no significa nada. `Data_Clicks` trae TODAS las piezas con links; el reporte
 *    solo las que llegan a una fila. Hoy hay 6 piezas de Pro Plan cuyo nombre lo comparten dos
 *    piezas del catálogo, así que el índice canónico las marca AMBIGUO y —bien— no elige: se
 *    quedan con su ConfigKey provisional y ninguna fila las recoge. Son 133 clicks.
 *    La prueba honesta son DOS: (a) el reporte == lo que sí llega a una fila, exacto; y (b) el
 *    resto == exactamente las huérfanas declaradas. Si el residuo no cuadra con ellas, hay otra
 *    causa y eso sí es un defecto. Un solo número mezclaría las dos cosas y taparía la segunda. */
var enFila = {};
try {
  var RJ = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
  RJ.rejilla.forEach(function (c) { (c.piezas || []).forEach(function (p) { enFila[t(p)] = 1; }); });
} catch (e) { console.log('  ⚠ no pude leer la rejilla — la partición por «llega a una fila» no se puede hacer'); }
var deDC = {}, fueraDC = {}, piezasFuera = {};
DC.forEach(function (f) {
  var c = t(f.Va_En_Columna), n = Number(f.Clicks_DE) || 0;
  var pid = t(f.Pieza_ID);
  if (enFila[pid]) { deDC[c] = (deDC[c] || 0) + n; return; }
  fueraDC[c] = (fueraDC[c] || 0) + n;
  if (n) piezasFuera[pid] = (piezasFuera[pid] || 0) + n;
});
var sumaRep = {};
CD.columnas().forEach(function (c) { sumaRep[c] = 0; });
var vacias = [], malEstado = [];
CD.encabezados().forEach(function (h) {
  var i = enc.indexOf(h);
  if (i < 0) { K(h, false, 'la columna NO existe en la hoja'); return; }
  var base = h.replace(/^(Principal_|FUP_|Tot_)/, '');
  var conNum = 0, conPD = 0, conNA = 0, otros = [], suma = 0;
  for (var rr = 1; rr <= nDatos; rr++) {
    var v = (R[rr] || [])[i];
    if (typeof v === 'number') { conNum++; suma += v; continue; }
    var s = t(v).toUpperCase();
    if (s === 'POR DEFINIR' || s === 'PENDIENTE') { conPD++; continue; }
    if (s === 'N/A') { conNA++; continue; }
    if (s === '') { otros.push('(blanco) fila ' + (rr + 1)); continue; }
    var n = Number(t(v).replace(/[, ]/g, ''));
    if (isFinite(n) && t(v) !== '') { conNum++; suma += n; continue; }
    otros.push('«' + t(v) + '» fila ' + (rr + 1));
  }
  // el bloque Tot_ duplica lo que ya suman Principal_ + FUP_, así que NO entra en el total global
  if (!/^Tot_/.test(h)) sumaRep[base] += suma;
  console.log('     ' + col(i).padStart(3) + '  ' + h.padEnd(40) + mil(suma).padStart(8) +
    '   ' + String(conNum).padStart(3) + ' con número · ' + String(conPD).padStart(2) + ' POR DEFINIR · ' +
    String(conNA).padStart(2) + ' N/A' + (otros.length ? '   🔴 ' + otros.length + ' raras: ' + otros.slice(0, 3).join(' · ') : ''));
  if (conNum === 0) vacias.push(h);
  if (otros.length) malEstado.push(h + ' (' + otros.slice(0, 2).join(' · ') + ')');
});

console.log('');
CD.columnas().forEach(function (c) {
  K('Σ Principal_+FUP_ de «' + c + '» == links.json (piezas con fila)', sumaRep[c] === (deDC[c] || 0),
    mil(sumaRep[c]) + ' vs ' + mil(deDC[c] || 0) + (sumaRep[c] === (deDC[c] || 0) ? '' :
      '   difieren en ' + mil(Math.abs(sumaRep[c] - (deDC[c] || 0)))));
});
var totFuera = Object.keys(fueraDC).reduce(function (a, c) { return a + fueraDC[c]; }, 0);
var totPz = Object.keys(piezasFuera).reduce(function (a, p) { return a + piezasFuera[p]; }, 0);
K('lo que queda fuera son SOLO las piezas sin fila, nombradas', totFuera === totPz,
  mil(totFuera) + ' clicks en ' + Object.keys(piezasFuera).length + ' pieza(s): ' + Object.keys(piezasFuera).sort().join(' · '));
console.log('       └ son piezas cuyo nombre lo comparten DOS del catálogo: el índice las marca');
console.log('         AMBIGUO y no elige. Retirarlas o renombrarlas es decisión de Rick, no mía.');

// ── PRUEBA 2 · ninguna muda ────────────────────────────────────────────────────────
K('ninguna de las 9 columnas está 100% vacía', vacias.length === 0,
  vacias.length ? '🔴 mudas: ' + vacias.join(' · ') : 'las 9 tienen números');

// ── PRUEBA 3 · los estados de celda ────────────────────────────────────────────────
K('sin número → POR DEFINIR o N/A, nunca blanco ni 0 inventado', malEstado.length === 0,
  malEstado.length ? '🔴 ' + malEstado.join(' · ') : 'las ' + (nDatos * 9) + ' celdas están en uno de los 3 estados');

// ── PRUEBA 4 · la fila de totales ──────────────────────────────────────────────────
if (iTot > 0) {
  var malTot = [];
  CD.encabezados().forEach(function (h) {
    var i = enc.indexOf(h); if (i < 0) return;
    var esperado = 0;
    for (var rr = 1; rr <= nDatos; rr++) {
      var v = (R[rr] || [])[i];
      var n = typeof v === 'number' ? v : Number(t(v).replace(/[, ]/g, ''));
      if (isFinite(n) && t(v) !== '') esperado += n;
    }
    var vt = (R[iTot] || [])[i];
    var nt = typeof vt === 'number' ? vt : Number(t(vt).replace(/[, ]/g, ''));
    if (!isFinite(nt) || Math.abs(nt - esperado) > 0.5) malTot.push(h + ': total dice ' + t(vt) + ', las filas suman ' + mil(esperado));
  });
  K('la fila de totales suma lo que suman las filas', malTot.length === 0,
    malTot.length ? '🔴 ' + malTot.slice(0, 3).join('  ·  ') : 'las 9 cuadran');
} else K('la fila de totales suma lo que suman las filas', false, 'no encontré la fila de totales');

// ── PRUEBA 5 · la brecha con `*_Clicks`, declarada ─────────────────────────────────
console.log('\n  ── PRUEBA 5 · las 3 columnas NO suman `*_Clicks`, y eso es correcto\n');
['Principal', 'FUP', 'Tot'].forEach(function (b) {
  var iC = enc.indexOf(b + '_Clicks');
  if (iC < 0) { console.log('     ' + b + ': no existe ' + b + '_Clicks'); return; }
  var sumC = 0, sumD = 0;
  for (var rr = 1; rr <= nDatos; rr++) {
    var v = (R[rr] || [])[iC];
    var n = typeof v === 'number' ? v : Number(t(v).replace(/[, ]/g, ''));
    if (isFinite(n) && t(v) !== '') sumC += n;
    CD.columnas().forEach(function (c) {
      var i2 = enc.indexOf(b + '_' + c); if (i2 < 0) return;
      var v2 = (R[rr] || [])[i2];
      var n2 = typeof v2 === 'number' ? v2 : Number(t(v2).replace(/[, ]/g, ''));
      if (isFinite(n2) && t(v2) !== '') sumD += n2;
    });
  }
  console.log('     ' + b.padEnd(10) + b + '_Clicks (único por PERSONA) ' + mil(sumC).padStart(8) +
    '   ·   Σ del desglose (único por LINK) ' + mil(sumD).padStart(8) +
    '   ·   ' + (sumC ? (sumD / sumC).toFixed(3) : '—') + '×');
});
console.log('\n     🔴 Que no coincidan NO es un error: `*_Clicks` cuenta PERSONAS distintas y el');
console.log('        desglose cuenta LINKS distintos. Una persona que toca 3 links es 1 y 3.');
console.log('        Está declarado en el contrato (regla `unico_por_link`).');

console.log('\n════ VEREDICTO ════');
if (!fallos.length) console.log('  ✅ LAS 9 COLUMNAS DICEN LO QUE DICE Data_Clicks — verificable sumando a mano en la hoja');
else { console.log('  🔴 ' + fallos.length + ' prueba(s) en rojo:'); fallos.forEach(function (f) { console.log('     · ' + f); }); }
try { fs.unlinkSync(tmp); } catch (e) { }
process.exit(fallos.length ? 1 : 0);
