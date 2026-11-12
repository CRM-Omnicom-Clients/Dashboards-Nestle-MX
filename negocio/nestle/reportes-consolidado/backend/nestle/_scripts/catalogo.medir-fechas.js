// nestle-catalogo · EL ESTADO DE LAS FECHAS DE ENVÍO EN EL CATÁLOGO. Mide, no escribe.
//
// 🔴 TRES GRUPOS, y cada uno se trata distinto:
//      A · HUECO y SFMC lo tiene      → se llena. Es lo que pidió Rick.
//      B · TIENE valor, pero es de una PRUEBA (el real es POSTERIOR) → se corrige, declarando
//          el valor de partida. Son 40 piezas; la fecha vieja la escribí yo desde la DE agregada.
//      C · HUECO y SFMC tampoco lo tiene → no se puede llenar. Se dice cuáles y por qué.
//
// 🔴 Y SE MIDE EL EFECTO EN LA QUINCENA ANTES DE TOCAR NADA. Corregir la fecha puede mover la
//    pieza de quincena, y eso mueve filas del reporte. Rick pidió las fechas, no mover filas: si
//    la corrección cambia el periodo, se declara aparte y se decide, no se arrastra de pasada.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var fs = require('fs'), os = require('os'), path = require('path');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };

var X = M.cargar();
console.log('════════ nestle-catalogo · EL ESTADO DE LAS FECHAS DE ENVÍO ════════\n');
console.log('  volcado: ' + X.volcado + '   ·   ' + X.piezas.length + ' piezas   ·   cruzan con SFMC: ' + X.cruzan);
var rf = X.resumenFechas;
console.log('  detalle: descartó ' + rf.jobs_descartados + ' job(s) de prueba = ' + rf.volumen_descartado +
  ' envíos de ' + rf.volumen_total.toLocaleString('es-MX') + ' (' + (rf.pct_descartado * 100).toFixed(4) + '%)' +
  (rf.aviso ? '   ⚠ ' + rf.aviso : '   ✔ sin aviso') + '\n');

var COLS = [
  { id: 'Fecha_Primer_Envio', campo: 'primero' },
  { id: 'Fecha_Ultimo_Envio', campo: 'ultimo' }
];
var salida = {};
COLS.forEach(function (c) {
  var nm = X.columna(c.id);
  if (!nm) { console.log('  🔴 no está la columna ' + c.id); return; }
  var A = [], Bg = [], C = [], iguales = 0, atras = [];
  X.piezas.forEach(function (p) {
    var actual = t(p[nm]);
    var R = X.fechasDe(p);
    var real = R ? R[c.campo] : null;
    var hueco = M.esHueco(actual);
    if (hueco && real) A.push({ id: X.idDe(p), a: real });
    else if (hueco && !real) C.push({ id: X.idDe(p), campana: t(p[X.columna('Campaña')]), canal: t(p[X.columna('Canal')]) });
    else if (!hueco && real) {
      var h = M.aFecha(actual);
      if (!h) return;
      if (h === real) iguales++;
      else if (real > h) Bg.push({ id: X.idDe(p), de: h, a: real, dias: Math.round((new Date(real) - new Date(h)) / 86400000) });
      else atras.push({ id: X.idDe(p), de: h, a: real });
    }
  });
  salida[c.id] = { llenar: A, corregir: Bg, sin_fuente: C, iguales: iguales, atras: atras };
  console.log('  ── ' + c.id);
  console.log('     ✔ ya correctas          ' + String(iguales).padStart(4));
  console.log('     🔧 HUECO y SFMC lo tiene ' + String(A.length).padStart(4) + '   → se pueden llenar');
  console.log('     🔧 tiene la de una PRUEBA' + String(Bg.length).padStart(4) + '   → se pueden corregir (el real va después)');
  console.log('     ·  hueco sin fuente      ' + String(C.length).padStart(4) + '   → SFMC tampoco la tiene');
  if (atras.length) console.log('     🔴 el real va ANTES      ' + String(atras.length).padStart(4) + '   → NO se explica por pruebas, hay que mirarlo');
  if (C.length) {
    var porC = {}; C.forEach(function (x) { porC[x.canal || '(sin canal)'] = (porC[x.canal || '(sin canal)'] || 0) + 1; });
    console.log('        las sin fuente son: ' + Object.keys(porC).map(function (k) { return porC[k] + ' de ' + k; }).join('  ·  '));
  }
  console.log('');
});

// ── el efecto en la QUINCENA ────────────────────────────────────────────────────────
var nmQ = X.columna('Quincena');
var mueven = [];
(salida['Fecha_Primer_Envio'].corregir || []).forEach(function (x) {
  var p = X.piezas.filter(function (y) { return X.idDe(y) === x.id; })[0]; if (!p) return;
  var qAhora = t(p[nmQ]), qNueva = M.aQuincena(x.a);
  if (qAhora && !M.esHueco(qAhora) && qNueva && qAhora !== qNueva) mueven.push({ id: x.id, de: qAhora, a: qNueva, fecha: x.de + ' → ' + x.a });
});
console.log('  ── 🔴 EFECTO EN LA QUINCENA (esto SÍ movería filas del reporte)');
console.log('     ' + mueven.length + ' de las ' + salida['Fecha_Primer_Envio'].corregir.length + ' correcciones cambian de quincena:');
mueven.forEach(function (m) { console.log('        ' + m.id.padEnd(10) + m.de + ' → ' + m.a + '   (' + m.fecha + ')'); });
if (!mueven.length) console.log('        ninguna ✔ — corregir la fecha NO mueve ninguna fila');

fs.writeFileSync(BACK + '/_preescritura/fechas-catalogo.json', JSON.stringify({ cuando: new Date().toISOString(), volcado: X.volcado, cols: salida, mueven_quincena: mueven }, null, 1));
console.log('\n  → _preescritura/fechas-catalogo.json');
