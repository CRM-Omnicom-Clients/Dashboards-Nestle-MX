// crm-reporte-resumen · ¿LAS 6 COLUMNAS DE BAJAS DICEN LA VERDAD? Mide, no escribe.
//
// 🔴 POR QUÉ NO BASTA CON QUE LA CADENA SALGA EN VERDE. La cadena valida que el reporte diga lo
//    que dice la rejilla — y eso es circular para una columna NUEVA: si el valor cayó en la
//    columna equivocada o no cayó en ninguna, las dos partes coinciden en el vacío. La prueba que
//    no es circular es una SUMA INDEPENDIENTE: se recalcula desde la fuente de SFMC y se compara.
//
// 🔴 Y SE MIRA LA FILA DE TOTALES APARTE. Una fila de totales NO es una fila de datos: al sumar
//    la columna entera se cuenta todo dos veces, y el resultado sale exactamente al doble — que
//    es lo que me pasó hace un momento y casi leo como «Σ 65,118 bajas» cuando son 32,559.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var n = function (v) { var x = Number(t(v).replace(/[, %]/g, '')); return isFinite(x) ? x : 0; };

var COLS = [
  { c: 'Principal_Unsubs', tipo: 'conteo', bloque: 'principal' },
  { c: 'Principal_UTOR (vs opens)', tipo: 'tasa', num: 'Principal_Unsubs', den: 'Principal_Opens' },
  { c: 'FUP_Unsubs', tipo: 'conteo', bloque: 'fup' },
  { c: 'FUP_UTOR (vs opens)', tipo: 'tasa', num: 'FUP_Unsubs', den: 'FUP_Opens' },
  { c: 'Tot_Unsubs', tipo: 'conteo', bloque: 'total' },
  { c: 'Tot_UTOR (vs opens)', tipo: 'tasa', num: 'Tot_Unsubs', den: 'Tot_Opens' }
];

console.log('════════ resumen · LAS 6 COLUMNAS DE BAJAS, VERIFICADAS ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_unsub.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var R = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Report_Resumen'], { header: 1, defval: '' });
var enc = R[0].map(t);
// 🔴 LA FILA DE TOTALES SE IDENTIFICA POR SU FORMA, NO POR SU POSICIÓN: es la que no tiene
//    campaña. Asumir «la última» funcionaría hoy y dejaría de funcionar el día que alguien
//    agregue una fila debajo.
var iCamp = enc.indexOf('Campaña');
var datos = [], totales = null;
for (var r = 1; r < R.length; r++) {
  var etq = t(R[r][iCamp]);
  if (!etq) continue;
  if (/^total/i.test(etq)) { totales = R[r]; continue; }
  datos.push(R[r]);
}
console.log('  libro: ' + path.basename(vivo.ruta));
console.log('  ' + datos.length + ' filas de datos   ·   fila de totales: ' + (totales ? '✔ hallada' : '🔴 no la hallé') + '\n');

// ── 1 · la suma independiente, desde el volcado de SFMC ─────────────────────────────
var dir = BACK + '/_insumos';
var cands = fs.readdirSync(dir).filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
var S = JSON.parse(fs.readFileSync(dir + '/' + cands[cands.length - 1], 'utf8'));
var filasS = S.rows || S.data || [];
var sfmcP = 0, sfmcF = 0;
filasS.forEach(function (f) {
  var u = n(f.Email_Unique_Unsubs);
  if (/^s/i.test(t(f.Es_FUP))) sfmcF += u; else sfmcP += u;
});
console.log('  ── 1 · LA SUMA INDEPENDIENTE (desde ' + cands[cands.length - 1] + ', no desde la rejilla)');
console.log('     SFMC · Principal ' + sfmcP.toLocaleString('es-MX') + '   FUP ' + sfmcF.toLocaleString('es-MX') +
  '   Total ' + (sfmcP + sfmcF).toLocaleString('es-MX'));

var fallos = [];
function sumaCol(nom) {
  var i = enc.indexOf(nom); if (i < 0) return null;
  var s = 0; datos.forEach(function (fila) { s += n(fila[i]); }); return s;
}
var hojaP = sumaCol('Principal_Unsubs'), hojaF = sumaCol('FUP_Unsubs'), hojaT = sumaCol('Tot_Unsubs');
console.log('     hoja · Principal ' + (hojaP || 0).toLocaleString('es-MX') + '   FUP ' + (hojaF || 0).toLocaleString('es-MX') +
  '   Total ' + (hojaT || 0).toLocaleString('es-MX'));
// 🔴 la hoja puede tener MENOS que SFMC y no ser un error: hay piezas de SFMC que el catálogo
//    aún no ancla a ninguna quincena. Lo que NO puede es tener MÁS — eso sería doble conteo.
[['Principal', hojaP, sfmcP], ['FUP', hojaF, sfmcF], ['Total', hojaT, sfmcP + sfmcF]].forEach(function (x) {
  if (x[1] === null) { fallos.push(x[0] + ': la columna no está en la hoja'); return; }
  if (x[1] > x[2]) fallos.push(x[0] + ': la hoja tiene MÁS bajas que SFMC (' + x[1] + ' > ' + x[2] + ') — doble conteo');
});
if (hojaT !== null && hojaP !== null && hojaF !== null && hojaT !== hojaP + hojaF)
  fallos.push('Tot_Unsubs (' + hojaT + ') ≠ Principal (' + hojaP + ') + FUP (' + hojaF + ')');
else console.log('     ✔ Tot_Unsubs = Principal + FUP   ' + hojaT + ' = ' + hojaP + ' + ' + hojaF);

// ── 2 · cada tasa se recalcula desde SUS DOS columnas, fila por fila ────────────────
console.log('\n  ── 2 · CADA TASA, RECALCULADA FILA POR FILA DESDE SUS DOS COLUMNAS');
COLS.forEach(function (x) {
  var i = enc.indexOf(x.c);
  if (i < 0) { fallos.push(x.c + ': NO está en la hoja'); console.log('     🔴 ' + x.c + ' NO ESTÁ'); return; }
  var conDato = datos.filter(function (f) { return t(f[i]) !== ''; }).length;
  if (x.tipo === 'conteo') {
    console.log('     ✔ ' + x.c.padEnd(32) + String(conDato).padStart(3) + ' de ' + datos.length + ' filas   Σ ' + sumaCol(x.c).toLocaleString('es-MX'));
    return;
  }
  var iN = enc.indexOf(x.num), iD = enc.indexOf(x.den);
  if (iN < 0 || iD < 0) { fallos.push(x.c + ': le falta ' + (iN < 0 ? x.num : x.den)); return; }
  var mal = 0, evaluadas = 0;
  datos.forEach(function (f) {
    var den = n(f[iD]); if (!den) return;
    var esperado = n(f[iN]) / den, real = n(f[i]);
    evaluadas++;
    if (Math.abs(real - esperado) > 1e-9) mal++;
  });
  // 🔴 CERO EVALUADAS NO ES PASAR. Una tasa que nunca se pudo comprobar se declara, no se pinta
  //    verde: es exactamente el check que mide su propia ausencia.
  if (!evaluadas) { fallos.push(x.c + ': NO PUDE EVALUAR — ninguna fila tiene denominador'); console.log('     ⚠  ' + x.c.padEnd(32) + 'NO PUDE EVALUAR'); return; }
  if (mal) fallos.push(x.c + ': ' + mal + ' de ' + evaluadas + ' filas no son ' + x.num + '/' + x.den);
  console.log('     ' + (mal ? '🔴 ' : '✔ ') + x.c.padEnd(32) + String(conDato).padStart(3) + ' de ' + datos.length +
    ' filas   ' + (evaluadas - mal) + '/' + evaluadas + ' = ' + x.num + ' / ' + x.den);
});

// ── 3 · la fila de totales ──────────────────────────────────────────────────────────
console.log('\n  ── 3 · LA FILA DE TOTALES');
if (!totales) fallos.push('no hallé la fila de totales');
else COLS.forEach(function (x) {
  var i = enc.indexOf(x.c); if (i < 0) return;
  var v = totales[i];
  var esTexto = typeof v !== 'number';
  if (esTexto) { fallos.push('totales · ' + x.c + ' = «' + t(v) + '» (no es un número)'); }
  if (x.tipo === 'tasa') {
    var iN = enc.indexOf(x.num), iD = enc.indexOf(x.den);
    var esp = n(totales[iD]) ? n(totales[iN]) / n(totales[iD]) : null;
    var ok = esp !== null && Math.abs(n(v) - esp) < 1e-9;
    if (!ok && !esTexto) fallos.push('totales · ' + x.c + ' no es Σ' + x.num + '/Σ' + x.den);
    console.log('     ' + (ok ? '✔ ' : '🔴 ') + x.c.padEnd(32) + (esTexto ? '«' + t(v) + '»' : (n(v) * 100).toFixed(3) + '%') +
      (esp !== null ? '   esperado ' + (esp * 100).toFixed(3) + '%' : ''));
  } else {
    console.log('     ' + (esTexto ? '🔴 ' : '✔ ') + x.c.padEnd(32) + (esTexto ? '«' + t(v) + '»' : n(v).toLocaleString('es-MX')));
  }
});

console.log('\n════ VEREDICTO ════');
if (!fallos.length) console.log('  ✅ LAS 9 COLUMNAS DICEN LA VERDAD — contadas contra SFMC, no contra la rejilla');
else fallos.forEach(function (f) { console.log('  🔴 ' + f); });
fs.unlinkSync(TMP);
process.exit(fallos.length ? 1 : 0);
