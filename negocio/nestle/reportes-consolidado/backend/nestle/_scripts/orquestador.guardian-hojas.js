/*
 * orquestador.guardian-hojas.js — UNA HOJA QUE EL ESQUEMA NO DECLARA ES UN DEFECTO.
 *
 * Rick, 22-sep-2026: «yo nunca autoricé esa hoja… todo debe estar dentro de lo que el sistema ya
 * sabe de sus hojas principales, fuentes, datos».
 *
 * 🔴 EL AGUJERO QUE TAPA. `esquema.json` declara qué hojas existen y qué entidad guarda cada una,
 *    pero NADIE comprobaba que el workbook se pareciera a esa declaración. Yo agregué dos hojas
 *    —`Data_Clicks` y `Dic_Clicks`— y estuvieron semanas ahí sin que ningún paso lo notara. Se
 *    descubrió porque Rick preguntó, no porque el sistema avisara.
 *
 * 🔴 ES EL MISMO PATRÓN QUE YA USAMOS PARA LA CARPETA. `orquestador.mapa-carpeta.js` denuncia una
 *    carpeta sin declarar; esto denuncia una HOJA sin declarar. No es una idea nueva: es aplicar
 *    al workbook la regla que la carpeta ya tenía.
 *
 * 🔴 Y DISTINGUE DE QUIÉN ES. Una hoja que Rick creó a mano no es lo mismo que una que un script
 *    materializó: la suya se declara como suya y se respeta; la mía, si nadie la consume, sobra.
 *    Mezclarlas haría que el guardián pidiera borrar su trabajo.
 *
 *   node orquestador.guardian-hojas.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var tmp = BACK + '/_tmp/_guardian-hojas.xlsx';
fs.copyFileSync(VIVO, tmp);
var wb = XLSX.readFile(tmp);
var E = JSON.parse(fs.readFileSync(BACK + '/_contratos/esquema.json', 'utf8'));
var DEC = E.hojas || {};

/* 🔴 LA PREGUNTA NO ES «¿QUIÉN LA ESCRIBE?» SINO «¿QUIÉN LA CREÓ?».
 *    La primera versión marcaba `Maggi Reporte` como materializada por un script —porque mis
 *    scripts escriben celdas en ella— y eso la dejaba en la lista de «si nadie la consume,
 *    sobra». Es la hoja que Rick creó a mano; el guardián habría pedido tirar su trabajo.
 *    La distinción es medible y no es una opinión:
 *      · CREAR una hoja  = registrarla en workbook.xml → `lib-hoja-xml.escribir()`
 *      · ESCRIBIR celdas = meter valores en una que ya existe → `lib-celda-xml.poner()`
 *    Un script que solo pone celdas no es dueño de la hoja: es un invitado. */
function quienLaCreo(hoja) {
  var out = [];
  fs.readdirSync(BACK + '/_scripts').filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    var s = fs.readFileSync(BACK + '/_scripts/' + f, 'utf8');
    if (s.indexOf("'" + hoja + "'") < 0 && s.indexOf('"' + hoja + '"') < 0) return;
    if (/lib-hoja-xml|hojaXml\s*\(|HX\.escribir|escribirHoja/.test(s)) out.push(f);
  });
  return out;
}
function quienEscribeCeldas(hoja) {
  var out = [];
  fs.readdirSync(BACK + '/_scripts').filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    var s = fs.readFileSync(BACK + '/_scripts/' + f, 'utf8');
    if (s.indexOf("'" + hoja + "'") < 0 && s.indexOf('"' + hoja + '"') < 0) return;
    if (/lib-celda-xml|CX\.poner/.test(s)) out.push(f);
  });
  return out;
}

console.log('════════ GUARDIÁN DE HOJAS · el workbook contra el esquema ════════\n');
console.log('  libro: ' + wb.SheetNames.length + ' hojas   ·   esquema: ' + Object.keys(DEC).length + ' declaradas\n');

var sinDeclarar = [], faltantes = [];
wb.SheetNames.forEach(function (h) {
  var d = DEC[h];
  var n = XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '' }).length;
  if (d) {
    console.log('  ✔ ' + h.padEnd(24) + String(n).padStart(5) + ' filas   ' + (d.entidad || '?') + '   escribe: ' + (d.escribe || '?').slice(0, 40));
  } else {
    var esc = quienLaCreo(h), inv = quienEscribeCeldas(h);
    sinDeclarar.push({ hoja: h, filas: n, la_creo: esc, escriben_celdas: inv });
    console.log('  🔴 ' + h.padEnd(24) + String(n).padStart(5) + ' filas   SIN DECLARAR   ' +
      (esc.length ? 'la CREA: ' + esc.join(', ') : 'ningún script la crea → es de Rick' + (inv.length ? ' (scripts que le escriben celdas: ' + inv.length + ')' : '')));
  }
});
Object.keys(DEC).forEach(function (d) { if (wb.SheetNames.indexOf(d) < 0) faltantes.push(d); });

console.log('\n── veredicto');
if (faltantes.length) console.log('  🔴 declaradas pero AUSENTES del libro: ' + faltantes.join(', '));
if (!sinDeclarar.length && !faltantes.length) { console.log('  ✅ el libro y el esquema dicen lo mismo.'); process.exit(0); }

console.log('  🔴 ' + sinDeclarar.length + ' hoja(s) sin declarar:\n');
var deScript = sinDeclarar.filter(function (x) { return x.la_creo.length; });
var deRick = sinDeclarar.filter(function (x) { return !x.la_creo.length; });
if (deScript.length) {
  console.log('  ── las materializa un SCRIPT (si nadie las consume, sobran):');
  deScript.forEach(function (x) { console.log('     ' + x.hoja.padEnd(20) + x.filas + ' filas   ← la crea ' + x.la_creo.join(', ')); });
}
if (deRick.length) {
  console.log('  ── ningún script las escribe → son de Rick. Se DECLARAN como suyas, no se tocan:');
  deRick.forEach(function (x) { console.log('     ' + x.hoja.padEnd(20) + x.filas + ' filas'); });
}
console.log('\n  🔴 «Un dato, una autoridad» (regla de oro del esquema): una hoja que el esquema no');
console.log('     declara no es autoridad de nada, y si tampoco es la vista de nadie, es una copia huérfana.');

fs.writeFileSync(BACK + '/_preescritura/guardian-hojas.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  hojas_del_libro: wb.SheetNames.length, declaradas: Object.keys(DEC).length,
  sin_declarar: sinDeclarar, declaradas_ausentes: faltantes
}, null, 1));
console.log('\n→ _preescritura/guardian-hojas.json');
process.exit(1);
