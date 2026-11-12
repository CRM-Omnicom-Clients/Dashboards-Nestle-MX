// nestle-catalogo · SINCRONIZAR EL REGISTRO DE IDs CON EL CATÁLOGO. No escribe el Excel.
//
// 🔴 EL DEFECTO QUE LO ORIGINA (3-sep-2026). El registro `_catalogo/registro-ids.json` conocía
//    **96 piezas** y el catálogo del Excel tiene **136**. Cuarenta ids existen en el libro y el
//    registro no los sabe — y ninguno al revés, así que no es que sobren: es que se le escaparon.
//    Consecuencia: `lib-ids.idPieza()` reparte el PRIMER hueco que ve, y para Liga MX devolvía
//    `005-P005`, que lleva semanas ocupado por E-J4 · Usuarios CON región.
//
// 🔴 POR QUÉ SE DESFASÓ, y es una lección de proceso, no de código: varias altas escribieron la
//    fila directamente al Excel sin pasar por `lib-ids`. El skill lo dice con todas sus letras
//    —«los ids los asigna lib-ids.js; si escribes otro, se equivocará distinto que el resto del
//    sistema»— y aun así el atajo funcionó cada vez, porque el id que yo elegía a ojo estaba
//    libre EN EL EXCEL. El registro nunca se enteró. Un atajo que funciona no deja de ser deuda.
//
// 🔴 QUIÉN MANDA: **el catálogo del Excel**, que es la autoridad de dimensiones. El registro es
//    un índice para no repetir ids, no una segunda verdad. Así que se reconcilia EN ESA
//    DIRECCIÓN: todo id del libro entra al registro; ninguno se borra del registro por no estar
//    en el libro (eso sería perder una reserva y volver a repartirla).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Los ids lógicos se declaran como constantes y se usan por
//    variable: un corchete con literal devuelve `undefined` sin avisar.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var LIB = require(__dirname + '/lib-ids.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var ID_PIEZA = 'Pieza_ID', ID_CAMP = 'Campaña', ID_SEG = 'Segmento', ID_TIPO = 'Email_Type', ID_CANAL = 'Canal';
var ID_NOMBRE = 'Email_Name', ID_TPRAW = 'Touchpoint_Raw';

console.log('════════ nestle-catalogo · SINCRONIZAR REGISTRO DE IDs ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_sync-ids.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TMP);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nm = {};
[ID_PIEZA, ID_CAMP, ID_SEG, ID_TIPO, ID_CANAL, ID_NOMBRE, ID_TPRAW].forEach(function (id) { nm[id] = COL.de(P, id); });

var REG = LIB.cargar();
var antes = Object.keys(REG.piezas || {}).length;
var idsEnReg = {}; Object.keys(REG.piezas || {}).forEach(function (k) { idsEnReg[REG.piezas[k]] = k; });

console.log('  registro: ' + antes + ' piezas   ·   catálogo: ' + P.filter(function (p) { return t(p[nm[ID_PIEZA]]); }).length + ' piezas\n');

var nuevos = [], yaEstaban = 0, colisiones = [];
P.forEach(function (p) {
  var id = t(p[nm[ID_PIEZA]]); if (!id) return;
  // la llave se construye con la MISMA función que usa lib-ids — reimplementarla aquí sería
  // la copia que diverge, y entonces el registro tendría dos idiomas para la misma pieza.
  var llave = LIB.llavePieza({
    campana: t(p[nm[ID_CAMP]]), nombre_pieza: t(p[nm[ID_NOMBRE]]), segmento: t(p[nm[ID_SEG]]),
    email_type: t(p[nm[ID_TIPO]]), canal: t(p[nm[ID_CANAL]]), nombre_pieza_raw: t(p[nm[ID_TPRAW]])
  });
  var yaId = REG.piezas[llave];
  if (yaId === id) { yaEstaban++; return; }
  if (yaId && yaId !== id) { colisiones.push({ llave: llave, registro: yaId, catalogo: id }); return; }
  // 🔴 y si el ID ya está reservado para OTRA identidad, es un choque de verdad: se declara.
  if (idsEnReg[id] && idsEnReg[id] !== llave) {
    colisiones.push({ llave: llave, catalogo: id, ocupado_por: idsEnReg[id] });
    return;
  }
  nuevos.push({ id: id, llave: llave });
});

console.log('  ── el diff');
console.log('     ya coincidían        : ' + yaEstaban);
console.log('     se agregan al registro: ' + nuevos.length);
console.log('     🔴 colisiones         : ' + colisiones.length);
nuevos.slice(0, 50).forEach(function (n) { console.log('        + ' + n.id.padEnd(11) + n.llave.slice(0, 82)); });
if (nuevos.length > 50) console.log('        … y ' + (nuevos.length - 50) + ' más');
colisiones.forEach(function (c) {
  console.log('        🔴 ' + (c.catalogo || '?') + '  ' + c.llave.slice(0, 60));
  console.log('           ' + (c.registro ? 'el registro dice ' + c.registro : 'ese id ya lo tiene: ' + String(c.ocupado_por).slice(0, 60)));
});

// también las campañas, por la misma razón
var campNuevas = [];
var campsEnReg = {}; Object.keys(REG.campanas || {}).forEach(function (k) { campsEnReg[k] = REG.campanas[k]; });
P.forEach(function (p) {
  var c = t(p[nm[ID_CAMP]]); if (!c) return;
  var k = LIB.llaveCamp ? LIB.llaveCamp({ bu: t(p['BU']), marca: t(p['Marca']), campana: c }) : null;
  if (k && !campsEnReg[k] && campNuevas.indexOf(k) < 0) campNuevas.push(k);
});
if (campNuevas.length) console.log('     campañas sin registrar: ' + campNuevas.length);

if (colisiones.length) {
  console.log('\n  🔴 hay colisiones: NO se sincroniza. Un registro con dos identidades para el mismo id');
  console.log('     reparte peor que uno desfasado.');
  process.exit(1);
}
if (!nuevos.length) { console.log('\n  ✅ el registro ya está al día.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

nuevos.forEach(function (n) { REG.piezas[n.llave] = n.id; });
LIB.guardar(REG);
var REG2 = LIB.cargar();
var despues = Object.keys(REG2.piezas).length;
console.log('\n  ── releído del registro');
console.log('     piezas: ' + antes + ' → ' + despues + '   (+' + (despues - antes) + ')');
var faltan = P.filter(function (p) { return t(p[nm[ID_PIEZA]]); })
  .map(function (p) { return t(p[nm[ID_PIEZA]]); })
  .filter(function (id) { return Object.keys(REG2.piezas).every(function (k) { return REG2.piezas[k] !== id; }); });
console.log('     ' + (faltan.length ? '🔴 siguen fuera: ' + faltan.join(' · ') : '✔ los ' + despues + ' ids del catálogo están en el registro'));
console.log('\n  ' + (faltan.length ? '🔴 no quedó' : '✅ REGISTRO SINCRONIZADO — lib-ids ya no puede repartir un id ocupado'));
process.exit(faltan.length ? 1 : 0);
