/*
 * maggi.verificar-carritos.js — ¿LA SUMA DE CARRITOS DE CADA FILA CUADRA CON SUS SHORTLINKS?
 *
 * Lo pidió Rick así: «deben estar todas las recetas, todas las shortlinks agregadas, y que en la
 * suma de carritos/productos pues sean acorde a los short links».
 *
 * 🔴 SE COMPARA CONTRA DOS DENOMINADORES, NO UNO. Un shortlink tiene carritos durante toda su
 *    vida, pero la fila solo cuenta los de SU ventana (`Medición desde`→`hasta`). Comparar contra
 *    el total de vida diría «faltan 25 carritos» en filas que están bien, y comparar solo contra
 *    la ventana escondería que la ventana se quedó corta. Las dos cifras juntas son el diagnóstico.
 *
 * 🔴 NO CORRIGE NADA. Las cifras de carritos son de Rick («los datos ya atribuidos no se
 *    modifican»). Esto mide y reporta; decidir es suyo.
 *
 * 🔴 EL AMBIGUO SE REPARTE POR FECHA. `hTHNLqzL` vive en dos jornadas: sus carritos anteriores al
 *    4-sep son de E-J4 y los posteriores de E-J7. Contarlo entero en las dos filas lo duplicaría.
 *
 *   node maggi.verificar-carritos.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'maggi';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var CORTE_J7 = '2026-09-04';

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_vercar.xlsx';
fs.copyFileSync(VIVO, tmp);
var ws = XLSX.readFile(tmp, { cellStyles: true }).Sheets['Maggi Reporte'];
var FILAS = XLSX.utils.sheet_to_json(ws, { defval: '' });
var LETRA = {};
var R = XLSX.utils.decode_range(ws['!ref']);
for (var c = R.s.c; c <= R.e.c; c++) {
  var h = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) LETRA[t(h.v)] = XLSX.utils.encode_col(c);
}
function L(id) { return LETRA[COL.de(FILAS, id, AMBITO)]; }
function val(L2, r) { var x = ws[L2 + r]; return (x === undefined || x.t === 'z') ? null : x.v; }

// ── el bloque: los carritos con su fecha y su código ────────────────────────────────
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var porCodigo = {};
(Q.carritos || []).forEach(function (e) {
  var k = t(e.shortlink_code); if (!k) return;
  (porCodigo[k] = porCodigo[k] || []).push(t(e.fecha).slice(0, 10));
});

function serialAIso(n) {
  var d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

console.log('════════ Maggi Reporte · ¿los carritos cuadran con sus shortlinks? ════════');
console.log('  bloque: ' + (Q.carritos || []).length + ' carritos · ' + Object.keys(porCodigo).length + ' códigos\n');
console.log('  fila  touchpoint    códigos                     vida  ventana   la fila dice   ');
console.log('  ────────────────────────────────────────────────────────────────────────────────');

var lineas = [], sumVida = 0, sumVent = 0, sumFila = 0, descuadres = 0;
for (var r = 2; r <= 25; r++) {
  var tp = val(L('TouchPoint'), r); if (!tp) continue;
  var aj = t(val(L('SHORTLINKS ASIGNADOS'), r));
  if (!aj || aj === 'N/A') continue;
  // 🔴 los códigos son tokens de 8 caracteres; la celda puede llevar anotaciones de fecha
  var cods = (aj.match(/\b[A-Za-z0-9]{8}\b/g) || []).filter(function (x) { return porCodigo[x]; });
  if (!cods.length) continue;

  var d0 = val(L('Medición desde'), r), d1 = val(L('Medición hasta'), r);
  var desde = (typeof d0 === 'number') ? serialAIso(d0) : null;
  var hasta = (typeof d1 === 'number') ? serialAIso(d1) : null;

  var vida = 0, vent = 0;
  cods.forEach(function (cod) {
    porCodigo[cod].forEach(function (f) {
      if (!f) return;
      // el ambiguo: cada lado de la fecha va a su jornada
      if (cod === 'hTHNLqzL') {
        var esJ4 = (f < CORTE_J7);
        if (t(tp) === 'E-J4' && !esJ4) return;
        if (t(tp) === 'E-J7' && esJ4) return;
      }
      vida++;
      if (desde && hasta && f >= desde && f <= hasta) vent++;
    });
  });
  var dice = val(L('Carritos_Total'), r);
  var diceN = (typeof dice === 'number') ? dice : (/^\$?([\d,.]+)/.test(t(dice)) ? +t(dice).replace(/[$,]/g, '') : null);

  sumVida += vida; sumVent += vent; if (diceN !== null) sumFila += diceN;
  var cuadra = (diceN !== null && diceN === vent);
  if (!cuadra) descuadres++;
  console.log('  ' + String(r).padStart(4) + '  ' + t(tp).padEnd(13) + cods.join(' ').padEnd(28) +
    String(vida).padStart(4) + String(vent).padStart(9) + String(diceN === null ? '—' : diceN).padStart(14) +
    '   ' + (cuadra ? '✔' : (diceN === null ? '(sin cifra)' : '⚠ ' + (diceN - vent > 0 ? '+' : '') + (diceN - vent))));
  lineas.push({ fila: r, tp: t(tp), codigos: cods, vida: vida, ventana: vent, dice: diceN, desde: desde, hasta: hasta });
}
console.log('  ────────────────────────────────────────────────────────────────────────────────');
console.log('  ' + ''.padStart(4) + '  ' + 'TOTAL'.padEnd(13) + ''.padEnd(28) + String(sumVida).padStart(4) + String(sumVent).padStart(9) + String(sumFila).padStart(14));
console.log('');
console.log('  vida    = todos los carritos del código, desde su primer día');
console.log('  ventana = solo los que caen dentro de `Medición desde`→`hasta` de esa fila');
console.log('  la fila = lo que hoy dice la columna Carritos_Total');
console.log('');
console.log(descuadres ? '  ⚠ ' + descuadres + ' fila(s) no cuadran con su ventana — NO se tocaron: son cifras de Rick.'
  : '  ✅ todas las filas cuadran con sus shortlinks dentro de su ventana.');

fs.writeFileSync(BACK + '/_preescritura/maggi-verificacion-carritos.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  total_vida: sumVida, total_ventana: sumVent, total_fila: sumFila, descuadres: descuadres, filas: lineas
}, null, 1));
console.log('\n  → _preescritura/maggi-verificacion-carritos.json');
