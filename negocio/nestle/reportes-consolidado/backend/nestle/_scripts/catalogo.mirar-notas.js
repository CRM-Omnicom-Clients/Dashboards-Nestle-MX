// catalogo · MIRAR las filas de NOTAS de Rick antes de tocarlas. No escribe nada.
//
// 🔴 POR QUÉ EXISTE. Rick dijo «siento que el Pieza_ID está mal». Lo que está mal no son los ids:
//    son CUATRO filas que no son piezas — son sus notas a mano — y mi llenador de vacíos las trató
//    como registros y les escribió `POR DEFINIR` o `N/A` en las otras ~85 columnas.
//    Antes de limpiar hay que MIRAR: qué escribió él, qué escribí yo, y en qué celda exacta.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

var libro = L.libroVivo ? L.libroVivo() : null;
var RUTA = libro || (ENT.LIBRO);
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_mirar_notas.xlsx';
fs.copyFileSync(RUTA, TMP);
var wb = XLSX.readFile(TMP, { cellStyles: false });
var ws = wb.Sheets['Catalogo_Piezas'];
var rng = XLSX.utils.decode_range(ws['!ref']);

// encabezados
var enc = [];
for (var c = rng.s.c; c <= rng.e.c; c++) {
  var cel = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  enc[c] = cel ? t(cel.v) : '';
}
var colPieza = enc.indexOf('Pieza_ID');
console.log('════════ LAS FILAS QUE NO SON PIEZAS ════════\n');
console.log('  hoja: Catalogo_Piezas   ·   filas 2..' + (rng.e.r + 1) + '   ·   ' + (rng.e.c + 1) + ' columnas');
console.log('  Pieza_ID está en la columna ' + XLSX.utils.encode_col(colPieza) + '\n');

var TOKEN = /^(POR DEFINIR|PENDIENTE|N\/A)$/i;
var sospechosas = [];
for (var r = 1; r <= rng.e.r; r++) {
  var cid = ws[XLSX.utils.encode_cell({ r: r, c: colPieza })];
  var v = cid ? t(cid.v) : '';
  if (v && /^\d{3}-[JP]\d{3}$/.test(v)) continue;   // es una pieza de verdad
  sospechosas.push({ fila: r + 1, r: r, pieza: v });
}

sospechosas.forEach(function (s) {
  var propias = [], mias = [];
  for (var c = rng.s.c; c <= rng.e.c; c++) {
    var cel = ws[XLSX.utils.encode_cell({ r: s.r, c: c })];
    if (!cel) continue;
    var val = t(cel.v);
    if (val === '') continue;
    if (TOKEN.test(val)) mias.push(XLSX.utils.encode_col(c) + '=' + val);
    else propias.push({ col: enc[c] || XLSX.utils.encode_col(c), ref: XLSX.utils.encode_col(c) + (s.r + 1), val: val });
  }
  console.log('  ── fila ' + s.fila + '   (Pieza_ID = ' + (s.pieza || '(vacío)') + ')');
  console.log('     lo que escribió RICK  (' + propias.length + ' celda(s)):');
  propias.forEach(function (p) { console.log('        ' + p.ref.padEnd(6) + p.col.padEnd(26) + '« ' + p.val.slice(0, 80) + ' »'); });
  console.log('     lo que escribí YO     (' + mias.length + ' celda(s) de token): ' +
    (mias.length ? mias.slice(0, 6).map(function (x) { return x.split('=')[0]; }).join(' ') + (mias.length > 6 ? ' … +' + (mias.length - 6) : '') : '—'));
  var pd = mias.filter(function (x) { return /POR DEFINIR$/i.test(x); }).length;
  var na = mias.filter(function (x) { return /N\/A$/i.test(x); }).length;
  console.log('        → ' + pd + ' × POR DEFINIR   ·   ' + na + ' × N/A\n');
});

var totalMias = 0;
sospechosas.forEach(function (s) {
  for (var c = rng.s.c; c <= rng.e.c; c++) {
    var cel = ws[XLSX.utils.encode_cell({ r: s.r, c: c })];
    if (cel && TOKEN.test(t(cel.v))) totalMias++;
  }
});
console.log('  ═══ ' + sospechosas.length + ' fila(s) que no son piezas   ·   ' + totalMias + ' celda(s) de token que hay que quitar');
fs.unlinkSync(TMP);
