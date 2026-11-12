// VALIDAR LA FASE 4 · ¿la capacidad produce lo MISMO que el código que sustituye?
//
// 🔴 LO QUE NO VALE COMO VALIDACIÓN. Comprobar que el JSON de capacidades es coherente consigo
//    mismo no prueba nada: es el círculo que este proyecto ya pagó caro. Que las 13 estén
//    declaradas y que cada idioma tenga dueño dice que el DOCUMENTO está bien escrito, no que la
//    capa sirva.
//
// 🔴 LO QUE SÍ. Correr la capacidad y el código viejo sobre el MISMO dato, y comparar. Si difieren,
//    la capacidad no puede sustituirlo — por muy bien declarada que esté.
//
// 🔴 Y DECIR QUÉ NO SE PUEDE PROBAR. `publicar` escribe: probarlo de verdad exige tocar el archivo.
//    Se prueba lo que sí se puede (que se niegue cuando debe) y se DECLARA lo que no, en vez de
//    contarlo como verde.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var CAP = require(__dirname + '/lib-capacidades.js');
var L = require(__dirname + '/lib-flexible.js');
var REG = require(__dirname + '/lib-registro.js');
var PROY = CAP.PROY;

var C = CAP.checks('VALIDACIÓN DE LA FASE 4 · la capa contra el código que sustituye');

// ── 1 · `abrir` vs leer el libro como lo hacen los scripts ──────────────────────────────
(function () {
  // como lo hace un script cualquiera, a mano
  var vivo = L.archivoVivo({ dir: PROY });
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_val-viejo.xlsx';
  fs.copyFileSync(vivo.ruta, tmp);
  var wbV = XLSX.readFile(tmp);
  var t = function (v) { return String(v == null ? '' : v).trim(); };
  var encV = (XLSX.utils.sheet_to_json(wbV.Sheets['Report_Resumen'], { header: 1 })[0] || []).map(t).filter(Boolean);
  var filV = XLSX.utils.sheet_to_json(wbV.Sheets['Report_Resumen'], { defval: '', blankrows: false });

  // con la capacidad
  var A = CAP.abrir({ como: 'validacion' });
  var h = A.hoja('Report_Resumen');

  C.compara('abrir · mismas filas que leyendo a mano', h.filas.length, filV.length, 'Report_Resumen:');
  C.compara('abrir · mismas columnas', h.enc.length, encV.length, 'Report_Resumen:');
  // y celda por celda en una muestra, que es lo que de verdad prueba que lee igual
  var difs = 0;
  filV.slice(0, 20).forEach(function (r, i) {
    encV.forEach(function (c) { if (t(r[c]) !== t(h.filas[i][c])) difs++; });
  });
  C.compara('abrir · las celdas dicen lo mismo (20 filas × ' + encV.length + ' cols)', difs, 0, 'diferencias:');

  // los bloques
  var bV = JSON.parse(fs.readFileSync(CAP.BACK + '/_fuentes/qcart.json', 'utf8'));
  var bC = A.bloque('qcart');
  C.compara('abrir · el bloque es el mismo', bC.carritos.length, bV.carritos.length, 'carritos:');
})();

// ── 2 · `formato` vs los `num`/`mil` que cada script escribe ────────────────────────────
(function () {
  // la versión que repiten los scripts
  var numViejo = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
  var milViejo = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
  var casos = ['1,234', '7282486', '0', '', 'N/A', '2,645', '  912  ', 'abc', '1.5'];
  var difN = casos.filter(function (c) { return String(CAP.num(c)) !== String(numViejo(c)); });
  C.compara('formato · `num` da lo mismo que el de los scripts', difN.length, 0, casos.length + ' casos, difieren:');
  var difM = [0, 1, 1234, 7282486, null].filter(function (n) { return CAP.mil(n) !== milViejo(n); });
  C.compara('formato · `mil` da lo mismo', difM.length, 0, 'difieren:');
  // letra de columna: contra el que usan escritor-datos/N6r
  var colViejo = function (n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
  var difL = [0, 1, 25, 26, 27, 51, 52, 87, 100].filter(function (i) { return CAP.letra(i) !== colViejo(i); });
  C.compara('formato · `letra` da lo mismo', difL.length, 0, 'difieren:');
})();

// ── 3 · `nombrar` vs preguntarle al registro a mano ───────────────────────────────────
(function () {
  var A = CAP.abrir({ como: 'validacion' });
  var h = A.hoja('Report_Resumen');
  var porCapacidad = h.col('resumen.quincena_lanzamiento');
  var porRegistro = null;
  try { porRegistro = REG.abrir('resumen', h.enc).n('resumen.quincena_lanzamiento'); } catch (e) { }
  C.compara('nombrar · resuelve igual que el registro', String(porCapacidad), String(porRegistro), '');
  // y que de verdad exista en la hoja — si no, resolvió a un nombre muerto
  C.compara('nombrar · el nombre que devuelve EXISTE en la hoja', h.enc.indexOf(porCapacidad) >= 0, true, '«' + porCapacidad + '»');
})();

// ── 4 · `verificar-en-disco` — que detecte lo verdadero Y lo falso ────────────────────
(function () {
  var r = CAP.verificarEnDisco([
    { hoja: 'Report_Resumen' },
    { hoja: 'NO_EXISTE_ESTA_HOJA' },
    { hoja: 'Report_Resumen', columna: 'NO_EXISTE_ESTA_COLUMNA' },
    { hoja: 'Report_Resumen', columna: 'Campaña', filasConDato: 1 }
  ]);
  C.compara('verificar · reconoce una hoja que sí está', r[0].ok, true, '');
  C.compara('verificar · 🔴 DETECTA una hoja que no está', r[1].ok, false, 'no puede decir que sí');
  C.compara('verificar · 🔴 DETECTA una columna que no está', r[2].ok, false, '');
  C.compara('verificar · reconoce una columna con dato', r[3].ok, true, '');
})();

// ── 5 · `checks` — el tercer veredicto no puede contarse como pasar ───────────────────
(function () {
  var x = CAP.checks('(interna)');
  x.ok('a'); x.noEvaluado('b', 'porque sí');
  // se captura el veredicto sin imprimirlo
  var log = console.log; var buf = []; console.log = function (s) { buf.push(s); };
  var v = x.veredicto();
  console.log = log;
  C.compara('checks · «no pude evaluar» NO cuenta como falla', v.falla, 0, '');
  C.compara('checks · pero se cuenta aparte y se ve', v.noEvaluado, 1, '');
  C.compara('checks · y el total los incluye', v.total, 2, '');
})();

// ── 6 · `publicar` — lo que se puede probar sin escribir ─────────────────────────────
(function () {
  // se prueba que se NIEGA con un archivo inexistente, sin tocar el vivo
  var antes = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtime.getTime();
  var r = CAP.publicar(require('path').resolve(__dirname, '..') + '/_tmp/_no_existe_este_archivo.xlsx');
  var despues = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtime.getTime();
  C.compara('publicar · se niega con una entrada inválida', r.ok, false, r.motivo ? r.motivo.slice(0, 40) : '');
  C.compara('publicar · 🔴 y NO tocó el vivo al negarse', antes, despues, 'mtime:');
  C.noEvaluado('publicar · que las 5 capas corran de verdad',
    'exige escribir el archivo. Se prueba en la cadena, no aquí — y se dice en vez de contarlo verde.');
})();

var v = C.veredicto();
console.log('\n  ⚠ lo que NO se probó aquí queda declarado arriba como «no evaluado»: no cuenta como verde.');
process.exit(v.falla ? 1 : 0);
