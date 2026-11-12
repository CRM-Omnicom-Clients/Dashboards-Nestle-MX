// PUERTA-1 · SIMULACIÓN DE LA PUERTA 1 — el script que tiene que OBEDECER el veredicto.
//
// 🔴 Un gate solo sirve si el de abajo le hace caso. Aquí se simula la Puerta 1 con la regla
//    dura puesta —«si está cerrada no escribo NADA»— y se comprueba las dos direcciones:
//      · con la puerta abierta, escribe los 4 bloques en el orden correcto
//      · con la puerta cerrada, NO escribe ni siquiera los bloques que sí cuadran
//
// ⚠ La puerta simulada escribe sobre una COPIA del workbook. El archivo real no se toca.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var F = BACK + '/_fuentes/';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ PUERTA-1 · SIMULACIÓN DE LA PUERTA 1 ════════\n');
var NOMBRES = ['email', 'qcart', 'whatsapp', 'manual'];
var resp = {}; NOMBRES.forEach(function (n) { resp[n] = fs.readFileSync(F + n + '.json', 'utf8'); });
var respV = fs.readFileSync(F + 'veredicto.json', 'utf8');
function restaurar() {
  NOMBRES.forEach(function (n) { fs.writeFileSync(F + n + '.json', resp[n], 'utf8'); });
  fs.writeFileSync(F + 'veredicto.json', respV, 'utf8');
  var ahora = new Date();
  NOMBRES.forEach(function (n) { fs.utimesSync(F + n + '.json', ahora, ahora); });
}
process.on('exit', restaurar);
function correrGate() {
  try { cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-cuadre.cuadre.js"', { encoding: 'utf8' }); } catch (e) { }
  return JSON.parse(fs.readFileSync(F + 'veredicto.json', 'utf8'));
}

// ── LA PUERTA 1, SIMULADA ───────────────────────────────────────────────────────────
// No escribe de verdad: cuenta qué escribiría. Lo que se prueba es que OBEDECE.
function puerta1(destino) {
  var v = JSON.parse(fs.readFileSync(F + 'veredicto.json', 'utf8'));
  if (!v.puede_escribir) {
    return { escribio: false, motivo: 'veredicto CERRADA: ' + (v.bloqueos[0] || {}).que, hojas: [], filas: 0 };
  }
  // el orden lo dicta el veredicto: el catálogo primero, porque las columnas canónicas de las
  // hojas de datos lo consultan por fórmula
  var orden = v.para_la_puerta.orden;
  var wb = XLSX.readFile(destino);
  var hojas = [], filas = 0;
  orden.forEach(function (paso) {
    if (paso === 'catalogo') { hojas.push('Catalogo_Piezas (ya presente)'); return; }
    var b = JSON.parse(fs.readFileSync(F + paso + '.json', 'utf8'));
    var n = paso === 'qcart' ? (b.carritos.length + b.productos.length) : paso === 'manual' ? b.datos.length : b.envios.length;
    var destinoHoja = paso === 'email' ? 'Data_Email' : paso === 'qcart' ? 'Data_Qcart_Carritos + _Productos'
      : paso === 'whatsapp' ? 'Data_WhatsApp' : 'la hoja de cada dato';
    hojas.push(destinoHoja + ' ← ' + paso + ' (' + n + ')');
    filas += n;
  });
  return { escribio: true, hojas: hojas, filas: filas, orden: orden };
}

// ══ 1 · CON LA PUERTA ABIERTA ═══════════════════════════════════════════════════════
console.log('══ 1 · con el veredicto ABIERTO ══');
restaurar();
var v1 = correrGate();
var COPIA = require('path').resolve(__dirname, '..') + '/_tmp/_puerta_sim.xlsx';
var mtimeReal = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs;
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, COPIA);
var r1 = puerta1(COPIA);
console.log('     veredicto: ' + v1.veredicto);
r1.hojas.forEach(function (h) { console.log('        → ' + h); });
console.log('     total de filas que escribiría: ' + mil(r1.filas));
chk('con la puerta abierta, escribe', r1.escribio === true, mil(r1.filas) + ' filas en ' + r1.hojas.length + 'scripts');
chk('el catálogo va PRIMERO', r1.orden[0] === 'catalogo',
  r1.orden.join(' → ') + '  · las columnas canónicas lo consultan por fórmula');
chk('escribe los 4 bloques', r1.hojas.length === 5, '1 catálogo + 4 bloques');

// ══ 2 · CON LA PUERTA CERRADA ═══════════════════════════════════════════════════════
console.log('\n══ 2 · con el veredicto CERRADO ══');
var w = JSON.parse(resp.whatsapp);
w.auditoria.sends_total = 100;                    // menos que el catálogo → bloqueo
fs.writeFileSync(F + 'whatsapp.json', JSON.stringify(w, null, 1), 'utf8');
var v2 = correrGate();
var r2 = puerta1(COPIA);
console.log('     veredicto: ' + v2.veredicto + '  ·  ' + (v2.bloqueos[0] || {}).que);
console.log('     la puerta: ' + (r2.escribio ? '🔴 ESCRIBIÓ' : 'no escribió — ' + r2.motivo));
chk('🔴 con la puerta cerrada NO escribe nada', r2.escribio === false, r2.motivo);
chk('ni siquiera los bloques que SÍ cuadran', r2.filas === 0,
  '0 filas · email y qcart cuadraban, y aun así no se escriben: un corte a medias es peor');

// ══ 3 · ¿EL ARCHIVO REAL SIGUE INTACTO? ═════════════════════════════════════════════
console.log('\n══ 3 · ¿el workbook real se tocó? ══');
chk('PUERTA-1 y la puerta simulada NO tocaron el Excel real',
  fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs === mtimeReal,
  'mismo mtime · la simulación trabajó sobre una copia');

// ══ 4 · Y VUELVE A ABRIR ════════════════════════════════════════════════════════════
console.log('\n══ 4 · al arreglar el bloque, ¿la puerta vuelve a escribir? ══');
restaurar();
var v4 = correrGate();
var r4 = puerta1(COPIA);
console.log('     veredicto: ' + v4.veredicto + '  ·  la puerta ' + (r4.escribio ? 'escribiría ' + mil(r4.filas) + ' filas' : 'no escribe'));
chk('vuelve a escribir al arreglarlo', r4.escribio === true && r4.filas === r1.filas,
  mil(r4.filas) + ' filas, las mismas que antes de romperlo');

try { fs.unlinkSync(COPIA); } catch (e) { }
console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ la Puerta 1 OBEDECE el veredicto en las dos direcciones'));
process.exit(fallo ? 1 : 0);
