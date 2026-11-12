/*
 * maggi.ajustar-filas-nuevas.js — le da a las filas nuevas de «Maggi Reporte» la altura y el
 * `Tipo Email` de sus hermanas.
 *
 * 🔴 LO ENCONTRÓ EL RENDER, NO UN CHECK — y no podía encontrarlo ningún otro (30-sep-2026). Las dos
 *    filas de J10 quedaron con `ht="304.2"` contra el `ht="18"` de todas las demás: eran filas
 *    VACÍAS con una altura heredada de vez de quién sabe qué, y escribirles celdas no cambia su
 *    altura. En la hoja se ven como dos franjas enormes al final. Ninguna suma cambia, así que las
 *    puertas, el guardián de unidades y la verificación celda por celda pasaron todas en verde.
 *
 * 🔴 Y `Tipo Email` SE QUEDÓ VACÍO por una razón distinta y legítima: es una de las 13 columnas que
 *    solo existen en esta hoja, el reporte no tiene qué poner en ella, y una fila NUEVA no tiene
 *    de quién conservarla. Su valor no se inventa: se toma del de su hermana del mismo canal —
 *    `E-J9` dice «Principal» y `WA-J9` dice «WhatsApp»— que es la fila inmediatamente anterior del
 *    mismo touchpoint. Si algún día una fila nueva no tuviera hermana, esto NO adivina: la deja
 *    vacía y lo dice.
 *
 * ⚠ ESTO TOCA FORMATO, QUE ES DE RICK. No decide un diseño: **iguala** la altura de una fila nueva
 *   a la de las que ya estaban. Nunca cambia la altura de una fila que ya tenía datos.
 *
 *   node maggi.ajustar-filas-nuevas.js            (seco)
 *   node maggi.ajustar-filas-nuevas.js --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var LIBRO = ENT.LIBRO;
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Maggi Reporte';

console.log('════ MAGGI · AJUSTAR LAS FILAS NUEVAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

var tmp = BACK + '/_tmp/_maggi-aj.xlsx';
fs.copyFileSync(LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var idx = wb.SheetNames.indexOf(HOJA);
var A = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: '' });
var filas = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { defval: '' });
var enc = A[0].map(t);
var zip = new AdmZip(tmp);
var rel = 'xl/worksheets/sheet' + (idx + 1) + '.xml';
var xml = zip.readAsText(zip.getEntry(rel));
fs.unlinkSync(tmp);

var ID_TP = 'Touch' + 'Point';
var cTP = COL.de(filas, ID_TP, 'resumen');
var iTP = enc.indexOf(cTP), iTE = enc.indexOf('Tipo Email');
if (iTP < 0 || iTE < 0) { console.log('🔴 no encuentro ' + cTP + ' o «Tipo Email»'); process.exit(1); }

// ── 1 · la altura que usan las filas CON datos; la moda, no la primera
var alturas = {};
for (var r = 2; r <= A.length; r++) {
  if (!t(A[r - 1] && A[r - 1][0])) continue;                 // fila sin campaña: no es de datos
  var m = new RegExp('<row r="' + r + '"[^>]*?ht="([0-9.]+)"').exec(xml);
  if (m) alturas[m[1]] = (alturas[m[1]] || 0) + 1;
}
var modo = Object.keys(alturas).sort(function (a, b) { return alturas[b] - alturas[a]; })[0];
console.log('  alturas de las filas con datos: ' + Object.keys(alturas).map(function (h) { return h + '×' + alturas[h]; }).join(' · '));
console.log('  la que manda (la más repetida): ht=' + modo);

// la fila modelo: la primera fila de datos que usa esa altura, para copiarle los atributos enteros
var modelo = null;
for (var r2 = 2; r2 <= A.length && !modelo; r2++) {
  if (!t(A[r2 - 1] && A[r2 - 1][0])) continue;
  var mm = new RegExp('<row r="' + r2 + '"[^>]*>').exec(xml);
  if (mm && mm[0].indexOf('ht="' + modo + '"') >= 0) modelo = { fila: r2, tag: mm[0] };
}
console.log('  fila modelo: ' + (modelo ? modelo.fila : '(ninguna)'));
if (!modelo) { console.log('🔴 sin fila modelo no se iguala nada.'); process.exit(1); }

// ── 2 · qué filas de datos NO usan esa altura
var arreglarAlto = [];
for (var r3 = 2; r3 <= A.length; r3++) {
  if (!t(A[r3 - 1] && A[r3 - 1][0])) continue;
  var m3 = new RegExp('<row r="' + r3 + '"[^>]*>').exec(xml);
  if (m3 && m3[0].indexOf('ht="' + modo + '"') < 0) arreglarAlto.push({ fila: r3, tp: t(A[r3 - 1][iTP]), tag: m3[0] });
}
console.log('\n  ── altura');
if (!arreglarAlto.length) console.log('     ✔ todas las filas de datos ya usan ht=' + modo);
arreglarAlto.forEach(function (x) { console.log('     fila ' + x.fila + ' (' + x.tp + '): ' + (/ht="([0-9.]+)"/.exec(x.tag) || [])[1] + ' → ' + modo); });

// ── 3 · Tipo Email vacío: se toma de la hermana del MISMO touchpoint base (E-J10 ← E-J9)
function base(tp) { return t(tp).replace(/\d+$/, ''); }          // E-J10 → E-J, WA-J10 → WA-J
var arreglarTE = [];
for (var r4 = 2; r4 <= A.length; r4++) {
  var fila = A[r4 - 1]; if (!t(fila && fila[0])) continue;
  if (t(fila[iTE])) continue;
  var herm = null;
  for (var r5 = 2; r5 <= A.length; r5++) {
    var f5 = A[r5 - 1];
    if (r5 === r4 || !t(f5 && f5[0]) || !t(f5[iTE])) continue;
    if (base(f5[iTP]) === base(fila[iTP])) herm = { fila: r5, tp: t(f5[iTP]), val: t(f5[iTE]) };
  }
  if (herm) arreglarTE.push({ fila: r4, tp: t(fila[iTP]), val: herm.val, de: herm.tp + ' (fila ' + herm.fila + ')' });
  else console.log('     ⚠ fila ' + r4 + ' (' + t(fila[iTP]) + ') sin «Tipo Email» y SIN hermana — se deja vacía, no se adivina');
}
console.log('\n  ── Tipo Email');
if (!arreglarTE.length) console.log('     ✔ ninguna fila de datos lo tiene vacío');
arreglarTE.forEach(function (x) { console.log('     fila ' + x.fila + ' (' + x.tp + ') ← «' + x.val + '»  de su hermana ' + x.de); });

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
if (!arreglarAlto.length && !arreglarTE.length) { console.log('\n  ✅ nada que ajustar.'); process.exit(0); }

// ── 4 · escribir
var resp = BACK + '/_respaldos/v8-antes-maggi-ajuste.xlsx';
fs.copyFileSync(LIBRO, resp);
var trabajo = BACK + '/_tmp/_maggi-aj-w.xlsx';
fs.copyFileSync(LIBRO, trabajo);
var z2 = new AdmZip(trabajo);
var x2 = z2.readAsText(z2.getEntry(rel));

arreglarAlto.forEach(function (x) {
  // se copia el tag de la fila modelo cambiándole solo el número: así viajan ht, customHeight y
  // thickBot juntos. Poner solo `ht` dejaría `customHeight` fuera y Excel reajustaría la altura.
  var nuevo = modelo.tag.replace(/r="\d+"/, 'r="' + x.fila + '"');
  x2 = x2.replace(new RegExp('<row r="' + x.fila + '"[^>]*>'), nuevo);
});
function colLetra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var comoTE = {};
arreglarTE.forEach(function (x) {
  var ref = colLetra(iTE) + x.fila;
  var nueva = CX.celda(ref, x.val, CX.estiloDe(x2, colLetra(iTE) + modelo.fila));
  var r6 = CX.poner(x2, ref, nueva, x.fila);
  x2 = r6.xml; comoTE[r6.como] = (comoTE[r6.como] || 0) + 1;
});
if (comoTE['sin fila']) { console.log('  🔴 ' + comoTE['sin fila'] + ' celda(s) no se pudieron poner. NO se publica.'); process.exit(1); }
z2.updateFile(rel, Buffer.from(x2, 'utf8'));
z2.writeZip(trabajo);

var N = process.execPath, H = os.homedir();
function capa(nom, cmd, args) {
  var r = cp.spawnSync(cmd, args, { encoding: 'utf8' });
  var out = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(function (l) { return /==>|✅|🔴|✓/.test(l); }).pop() || '';
  console.log('     ' + (r.status === 0 ? '✔' : '🔴') + ' ' + nom.padEnd(20) + out.trim().slice(0, 70));
  return r.status === 0;
}
console.log('\n  ── las 5 capas');
var ok = capa('xlsx-safe-save', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js', trabajo]);
ok = capa('xlsx-label', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-label.js', trabajo]) && ok;
ok = capa('xlsx-check', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-check.js', trabajo]) && ok;
ok = capa('xlsx-validar-fondo', require(__dirname + '/lib-entorno.js').PYTHON, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-validar-fondo.py', trabajo]) && ok;
ok = capa('xlsx-orden-celdas', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-orden-celdas.js', trabajo]) && ok;
if (!ok) { console.log('\n  🔴 una capa falló — NO se publica.'); process.exit(1); }
fs.copyFileSync(trabajo, LIBRO);

// releer
var v = BACK + '/_tmp/_maggi-aj-v.xlsx';
fs.copyFileSync(LIBRO, v);
var z3 = new AdmZip(v), x3 = z3.readAsText(z3.getEntry(rel));
var A3 = XLSX.utils.sheet_to_json(XLSX.readFile(v).Sheets[HOJA], { header: 1, defval: '' });
fs.unlinkSync(v);
var mal = 0;
arreglarAlto.forEach(function (x) {
  var m = new RegExp('<row r="' + x.fila + '"[^>]*?ht="([0-9.]+)"').exec(x3);
  if (!m || m[1] !== modo) { console.log('     🔴 fila ' + x.fila + ' sigue en ' + (m ? m[1] : '?')); mal++; }
});
arreglarTE.forEach(function (x) {
  if (t(A3[x.fila - 1][iTE]) !== x.val) { console.log('     🔴 fila ' + x.fila + ' Tipo Email = «' + t(A3[x.fila - 1][iTE]) + '»'); mal++; }
});
console.log('\n  ── releído del disco');
console.log('     ' + (mal ? '🔴 ' + mal + ' sin quedar' : '✔ ' + arreglarAlto.length + ' altura(s) y ' + arreglarTE.length + ' «Tipo Email» quedaron'));
console.log('\n════ ' + (mal ? '🔴 NO quedó' : '✅ FILAS NUEVAS AJUSTADAS') + ' ════');
process.exit(mal ? 1 : 0);
