// catálogo · ¿EL ÍNDICE POR NOMBRE DE `lib-canonico` ENCUENTRA ALGO?
//
// 🔴 LA SOSPECHA, Y POR QUÉ SE PRUEBA EN VEZ DE RAZONARSE. `indexarPiezas` lee `p['Content_Name']`
//    y `p['Content_Names_Variantes']` como LITERALES, pero el registro de nombres dice que la
//    columna física es `Email_Name` desde el renombre (con `Content_Name` como alias histórico).
//    Si los callers le pasan filas con encabezados físicos, esas dos lecturas son `undefined` y el
//    índice de nombres de EMAIL está vacío — llenándose solo con los de WhatsApp. Un índice vacío
//    no truena: devuelve «no encontré» y el que pregunta se cae a su fallback.
//    Es exactamente la familia de `Content_ID` vs `Content_ID (SFMC)`: reportó «0 y 0» mientras
//    escribía 60 y 60. Así que se MIDE: se cuentan las claves del índice por canal.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var CN = require(BACK + '/_scripts/lib-canonico.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_idxnom.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var wb = XLSX.readFile(tmp);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

console.log('════════ catálogo · EL ÍNDICE POR NOMBRE ════════\n');
console.log('  piezas en el catálogo: ' + CAT.length);
var enc = Object.keys(CAT[0] || {});
['Content_Name', 'Email_Name', 'Content_Names_Variantes', 'Email_Names_Variantes', 'Whatsapp_Name'].forEach(function (c) {
  var hay = enc.indexOf(c) >= 0;
  var llenas = hay ? CAT.filter(function (p) { return t(p[c]); }).length : 0;
  console.log('     ' + (hay ? '✔' : '🔴') + ' columna «' + c + '»  ' + (hay ? llenas + ' celda(s) con valor' : 'NO EXISTE en la hoja'));
});

var IX = CN.indexarPiezas(CAT);
var claves = Object.keys(IX.porContent);
console.log('\n  índice porContent: ' + claves.length + ' clave(s)   ·   porId: ' + Object.keys(IX.porId).length);

// ¿cuántos de los Email_Name reales encuentra el índice? ésa es la prueba que importa.
var nombresEmail = [];
CAT.forEach(function (p) {
  var n = t(p['Email_Name']);
  if (n && !/^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(n)) n.split(/\s*[·|]\s*/).forEach(function (x) { if (t(x)) nombresEmail.push(t(x)); });
});
var nm = CN.nm;
/* 🔴 «NO LO ENCUENTRA» Y «ESTÁ MARCADO AMBIGUO» NO SON LO MISMO, y meterlos en el mismo número
 *    empujaría a alguien a «arreglar» la guarda de ambigüedad, que es lo único que evita elegir
 *    una pieza al azar cuando dos comparten nombre (eso ya movió 186 carritos en Qcart).
 *    Un nombre ambiguo NO resuelto es el comportamiento correcto; se cuenta aparte. */
var resueltos = nombresEmail.filter(function (n) { var v = IX.porContent[nm(n)]; return v && v !== '¦AMBIGUO¦'; });
var ambiguos = nombresEmail.filter(function (n) { return IX.porContent[nm(n)] === '¦AMBIGUO¦'; });
var ausentes = nombresEmail.filter(function (n) { return !IX.porContent[nm(n)]; });
console.log('\n  🔴 LA PRUEBA: de ' + nombresEmail.length + ' Email_Name reales del catálogo');
console.log('     resueltos a una pieza      ' + String(resueltos.length).padStart(4));
console.log('     marcados AMBIGUO (correcto)' + String(ambiguos.length).padStart(4) + '  dos piezas comparten el nombre → a propósito no gana ninguna');
console.log('     AUSENTES del índice        ' + String(ausentes.length).padStart(4) + (ausentes.length ? '  🔴 éstos son el defecto' : '  ✅'));
if (ambiguos.length) console.log('       ambiguo p.ej.: ' + ambiguos[0].slice(0, 90));
if (ausentes.length) console.log('       ausente p.ej.: ' + ausentes[0].slice(0, 90));
if (!ausentes.length) console.log('\n     ✅ el índice de nombres de email está COMPLETO');
var waN = CAT.filter(function (p) { return t(p['Whatsapp_Name']); }).length;
console.log('\n  (de referencia: ' + waN + ' pieza(s) con Whatsapp_Name — si el índice tiene ~' + waN + ' claves, solo trae WhatsApp)');
try { fs.unlinkSync(tmp); } catch (e) { }
