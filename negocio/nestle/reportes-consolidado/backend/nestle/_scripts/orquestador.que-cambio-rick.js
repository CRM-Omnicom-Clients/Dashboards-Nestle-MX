// orquestador · ¿QUÉ TOCÓ RICK DESDE MI ÚLTIMA ESCRITURA? Mide, no escribe.
//
// 🔴 LA REGLA QUE ESTE PASO HACE CUMPLIR: «leer el archivo ANTES de escribirlo, no después».
//    Rick edita el entregable a mano. Diffear DESPUÉS de escribir ya no sirve de nada: para
//    entonces su trabajo ya se perdió. Esto se corre ANTES de cualquier escritura que regenere
//    una hoja, y dice —celda por celda— qué cambió él y qué se llevaría por delante.
//
// 🔴 Y LEE EL ARCHIVO AUNQUE ESTÉ ABIERTO EN EXCEL. Copiarlo se puede; escribirlo no. Así que
//    este paso corre justo cuando hace falta: cuando el archivo está tomado y hay que decidir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
/* la llave de cada hoja se le PIDE al esquema y `lib-columna` la traduce al encabezado real */
var ESQ = require(__dirname + '/lib-esquema.js');
var COL = require(__dirname + '/lib-columna.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };

var REF = process.argv.slice(2).filter(function (x) { return x.indexOf('--') !== 0; })[0];
if (!REF) {
  var dir = BACK + '/_respaldos';
  var c = fs.readdirSync(dir).filter(function (f) { return /\.xlsx$/.test(f); })
    .map(function (f) { return { f: f, m: fs.statSync(path.join(dir, f)).mtimeMs }; })
    .sort(function (a, b) { return a.m - b.m; });
  REF = c.length ? path.join(dir, c[c.length - 1].f) : null;
}
if (!REF || !fs.existsSync(REF)) { console.log('🔴 no hay respaldo de referencia'); process.exit(1); }

var vivo = L.archivoVivo({ dir: PROY });
console.log('════════ ¿QUÉ CAMBIÓ EN EL LIBRO DESDE MI ÚLTIMA ESCRITURA? ════════\n');
console.log('  mío (respaldo): ' + path.basename(REF) + '   ' + Math.round(fs.statSync(REF).size / 1024) + ' KB');
console.log('  en disco ahora: ' + path.basename(vivo.ruta) + '   ' + Math.round(fs.statSync(vivo.ruta).size / 1024) + ' KB   ' +
  fs.statSync(vivo.ruta).mtime.toISOString().slice(0, 19).replace('T', ' '));
try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); console.log('  candado: libre\n'); }
catch (e) { console.log('  candado: 🔴 TOMADO por Excel — se puede leer, NO se puede escribir\n'); }

var TA = require('path').resolve(__dirname, '..') + '/_tmp/_qc-a.xlsx', TZ = require('path').resolve(__dirname, '..') + '/_tmp/_qc-z.xlsx';
fs.copyFileSync(REF, TA); fs.copyFileSync(vivo.ruta, TZ);
var A = XLSX.readFile(TA), Z = XLSX.readFile(TZ);

var hojas = {};
A.SheetNames.forEach(function (h) { hojas[h] = 1; });
Z.SheetNames.forEach(function (h) { hojas[h] = 1; });

var totalCambios = 0;
Object.keys(hojas).forEach(function (h) {
  var wa = A.Sheets[h], wz = Z.Sheets[h];
  if (!wa) { console.log('  🆕 hoja NUEVA: ' + h); totalCambios++; return; }
  if (!wz) { console.log('  🔴 hoja QUE YA NO ESTÁ: ' + h); totalCambios++; return; }
  var Ra = XLSX.utils.sheet_to_json(wa, { header: 1, defval: '' });
  var Rz = XLSX.utils.sheet_to_json(wz, { header: 1, defval: '' });
  var encA = (Ra[0] || []).map(t), encZ = (Rz[0] || []).map(t);
  var colsNuevas = encZ.filter(function (x) { return x && encA.indexOf(x) < 0; });
  var colsIdas = encA.filter(function (x) { return x && encZ.indexOf(x) < 0; });
  // 🔴 se compara POR NOMBRE de encabezado, nunca por letra ni por índice (E4): si él insertó
  //    una columna, comparar por posición reportaría toda la hoja como cambiada.
  /* 🔴 LAS FILAS SE EMPAREJAN POR SU LLAVE, NUNCA POR SU POSICIÓN (22-sep-2026).
   *    Comparaba por índice de fila, así que al retirarse 5 filas del catálogo todo lo de abajo
   *    se desplazó y el informe acusó a Rick de haber cambiado 48 ids, 47 touchpoints, 46
   *    segmentos… sin que él tocara nada: la f85 que decía una pieza ahora dice la siguiente
   *    porque subió dos lugares.
   *    Es grave en ESTE script precisamente: existe para defender sus ediciones, y un diff que
   *    grita cuando nadie tocó nada acaba en «ya no le hagas caso» — o peor, en que alguien
   *    «restaure» celdas que estaban bien.
   * 🔴 Y la llave NO se escribe aquí: se le pide al esquema, que es su autoridad. */
  var llave = null;
  try {
    var ids = ESQ.llaveDe(h) || [];
    var objZ = XLSX.utils.sheet_to_json(wz, { defval: '' });
    if (ids.length && objZ.length) llave = ids.map(function (idl) { return COL.de(objZ, idl); });
  } catch (e) { llave = null; }

  var difs = [], sinPar = [];
  if (llave && llave.length && llave.every(function (c) { return c && encA.indexOf(c) >= 0 && encZ.indexOf(c) >= 0; })) {
    var idDe = function (fila, enc) { return llave.map(function (c) { return t(fila[enc.indexOf(c)]); }).join('||'); };
    var mapA = {};
    for (var ra = 1; ra < Ra.length; ra++) {
      var ka = idDe(Ra[ra] || [], encA);
      if (t(ka.replace(/\|/g, ''))) mapA[ka] = Ra[ra];          // fila sin llave = nota a mano
    }
    for (var rz = 1; rz < Rz.length; rz++) {
      var fz = Rz[rz] || [], kz = idDe(fz, encZ);
      if (!t(kz.replace(/\|/g, ''))) continue;
      var fa = mapA[kz];
      if (!fa) { sinPar.push(kz.split('||')[0]); continue; }
      delete mapA[kz];
      encZ.forEach(function (colN, iz) {
        if (!colN || llave.indexOf(colN) >= 0) return;
        var ia = encA.indexOf(colN); if (ia < 0) return;
        var va = t(fa[ia]), vz = t(fz[iz]);
        if (va !== vz) difs.push({ fila: rz + 1, col: colN, mio: va, suyo: vz, id: kz.split('||')[0] });
      });
    }
    var idas = Object.keys(mapA).map(function (k) { return k.split('||')[0]; });
    if (idas.length) console.log('     🔴 ' + idas.length + ' fila(s) que ESTABAN y ya no: ' + idas.slice(0, 6).join(' · '));
    if (sinPar.length) console.log('     🆕 ' + sinPar.length + ' fila(s) nueva(s): ' + sinPar.slice(0, 6).join(' · '));
  } else if (Ra.length !== Rz.length) {
    /* sin llave usable no se compara por posición: se dice. Un informe que parece lleno de
       cambios y no significa nada es peor que no tener informe. */
    console.log('     ⚠ sin llave usable y cambió el número de filas (' + (Ra.length - 1) + ' → ' + (Rz.length - 1) +
      ') — no se compara celda por celda para no inventar diferencias');
  } else {
    encZ.forEach(function (colN, iz) {
      if (!colN) return;
      var ia = encA.indexOf(colN); if (ia < 0) return;
      for (var r = 1; r < Math.max(Ra.length, Rz.length); r++) {
        var va = t((Ra[r] || [])[ia]), vz = t((Rz[r] || [])[iz]);
        if (va !== vz) difs.push({ fila: r + 1, col: colN, mio: va, suyo: vz });
      }
    });
  }
  if (!colsNuevas.length && !colsIdas.length && !difs.length && Ra.length === Rz.length) return;
  totalCambios++;
  console.log('  ── ' + h + '   ' + (Ra.length - 1) + ' → ' + (Rz.length - 1) + ' filas   ·   ' + encA.length + ' → ' + encZ.length + ' columnas');
  if (colsNuevas.length) console.log('     🆕 columnas nuevas: ' + colsNuevas.join(' · '));
  if (colsIdas.length) console.log('     🔴 columnas que quitó: ' + colsIdas.join(' · '));
  if (difs.length) {
    var porCol = {}; difs.forEach(function (d) { (porCol[d.col] = porCol[d.col] || []).push(d); });
    console.log('     ✏ ' + difs.length + ' celda(s) con otro valor, en ' + Object.keys(porCol).length + ' columna(s):');
    Object.keys(porCol).slice(0, 12).forEach(function (k) {
      var g = porCol[k], ej = g[0];
      console.log('        ' + k.slice(0, 30).padEnd(32) + String(g.length).padStart(4) + ' celda(s)   p.ej. f' + ej.fila +
        '  mío «' + ej.mio.slice(0, 26) + '»  →  suyo «' + ej.suyo.slice(0, 26) + '»');
    });
    if (Object.keys(porCol).length > 12) console.log('        … y ' + (Object.keys(porCol).length - 12) + ' columna(s) más');
  }
});

console.log('\n════ VEREDICTO ════');
if (!totalCambios) console.log('  ✔ ningún cambio de CONTENIDO desde mi último respaldo.');
else console.log('  ⚠ ' + totalCambios + ' hoja(s) cambiaron. Lo de arriba es lo que hay HOY en disco.');
console.log('  ℹ el peso del archivo puede subir sin que cambie ningún valor: formatos, estilos y');
console.log('    anchos no aparecen aquí porque esto compara CONTENIDO. El formato es de Rick (E5)');
console.log('    y las escrituras del sistema lo conservan celda por celda.');
fs.unlinkSync(TA); fs.unlinkSync(TZ);
