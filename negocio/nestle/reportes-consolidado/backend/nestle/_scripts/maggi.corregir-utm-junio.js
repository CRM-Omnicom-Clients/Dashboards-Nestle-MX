/*
 * maggi.corregir-utm-junio.js — CORREGIR LAS UTM QUE DECLARÉ «NO ESTÁ EN EL MAESTRO» Y SÍ ESTABAN.
 *
 * 🔴 EL ERROR QUE CORRIGE, Y DE QUIÉN FUE. Escribí «(no está en el maestro)» en la utm de cuatro
 *    filas. Rick preguntó por tres de esos códigos y tenía razón: ESTÁN en el maestro, en la hoja
 *    **Junio**, filas 23 y 26-28. Lo que pasa es que su columna `Códigos` no trae un código sino
 *    un ESTADO — «No se envío a Qcart» — y el código solo vive dentro de la URL de prueba.
 *    El lector hizo bien en no devolverlos como códigos; el que concluyó de más fui yo:
 *    «mi lector no lo devuelve» no es «no está en el maestro».
 *
 *      Junio f23  utm «wa-bebida1»   w5r9LWOP
 *      Junio f26  utm «e-bebida3»    vk67sh2J
 *      Junio f27  utm «e-botanas3»   xka2NWrW
 *      Junio f28  utm «e-cooking3»   YJOatjQs
 *
 * 🔴 POR FECHAS NO SE PUEDE, Y ESO SE MIDIÓ. Rick pidió atribuir por fechas «si se puede, si no la
 *    nota». Los cuatro códigos tienen **CERO carritos y CERO productos**: no hay ningún evento que
 *    repartir. El reparto por fecha sirvió con `hTHNLqzL` porque tenía 62 eventos a los dos lados
 *    de una fecha; aquí no hay nada que partir. Va la nota, con la razón que da la propia fuente.
 *
 * 🔴 SE RESPETA LO QUE RICK CAMBIÓ (él lo pidió dos veces). Antes de escribir se comprueba que:
 *      · `Carritos_Walmart` y `Carritos_Chedraui` NO existen — las quitó, no se recrean
 *      · la columna `NOTAS` existe — la agregó él
 *      · las filas se localizan por su CONTENIDO (touchpoint + segmento + código), nunca por el
 *        número que tenían antes: él insertó filas y todo se recorrió
 *      · en `NOTAS` solo se escribe donde está VACÍA — sus notas de f23 y f24 no se tocan
 *
 *   node maggi.corregir-utm-junio.js              (seco)
 *   node maggi.corregir-utm-junio.js --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'maggi';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var HOJA = 'Maggi Reporte';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

/* lo que el maestro declara de verdad — leído de Junio, no escrito de memoria */
var DEL_MAESTRO = {
  w5r9LWOP: { utm: 'wa-bebida1', hoja: 'Junio', fila: 23, estado: 'No se envío a Qcart' },
  vk67sh2J: { utm: 'e-bebida3', hoja: 'Junio', fila: 26, estado: 'No se envío a Qcart' },
  xka2NWrW: { utm: 'e-botanas3', hoja: 'Junio', fila: 27, estado: 'No se envío a Qcart' },
  YJOatjQs: { utm: 'e-cooking3', hoja: 'Junio', fila: 28, estado: 'No se envío a Qcart' }
};

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_cor.xlsx';
fs.copyFileSync(VIVO, tmp);
var ws = XLSX.readFile(tmp, { cellStyles: true }).Sheets[HOJA];
var FILAS = XLSX.utils.sheet_to_json(ws, { defval: '' });
var LETRA = {}, R = XLSX.utils.decode_range(ws['!ref']);
for (var c = R.s.c; c <= R.e.c; c++) {
  var h = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) LETRA[t(h.v)] = XLSX.utils.encode_col(c);
}
function NOM(id) { return COL.de(FILAS, id, AMBITO); }
function L(id) { return LETRA[NOM(id)]; }
function val(id, r) { var x = ws[L(id) + r]; return (x === undefined || x.t === 'z') ? null : x.v; }

console.log('════════ Maggi Reporte · corregir las utm de Junio ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

// ══ 0 · RESPETAR LO QUE RICK CAMBIÓ ══════════════════════════════════════════════════
console.log('── 0 · ¿sigo viendo la hoja como él la dejó?');
console.log('   ref: ' + ws['!ref'] + '   ·   ' + Object.keys(LETRA).length + ' columnas');
var quitadas = ['Carritos_Walmart', 'Carritos_Chedraui'].filter(function (n) { return LETRA[n]; });
if (quitadas.length) { console.log('   🔴 «' + quitadas.join('», «') + '» volvió a existir. Él la quitó. Paro.'); process.exit(1); }
console.log('   ✔ Carritos_Walmart y Carritos_Chedraui NO existen — las quitó él, no las recreo');
if (!LETRA['NOTAS']) { console.log('   🔴 no existe la columna NOTAS que él agregó. Paro.'); process.exit(1); }
console.log('   ✔ NOTAS existe (col ' + LETRA['NOTAS'] + ')');

// ══ 1 · LOCALIZAR LAS FILAS POR CONTENIDO, NUNCA POR NÚMERO ══════════════════════════
// 🔴 Él insertó filas: E-J6 pasó de la 20 a la 22. Un número de fila guardado de antes
//    escribiría sobre la fila equivocada sin que nada truene.
console.log('\n── 1 · localizar las filas por su contenido');
var objetivo = [];
for (var r = 2; r <= R.e.r + 1; r++) {
  var aj = t(val('SHORTLINKS ASIGNADOS', r)); if (!aj) continue;
  var cods = (aj.match(/\b[A-Za-z0-9]{8}\b/g) || []).filter(function (x) { return DEL_MAESTRO[x]; });
  if (!cods.length) continue;
  objetivo.push({ fila: r, tp: t(val('TouchPoint', r)), seg: t(val('Segmento', r)), cods: cods, aj: aj });
}
objetivo.forEach(function (o) {
  console.log('   f' + String(o.fila).padEnd(3) + ' ' + o.tp.padEnd(7) + ' ' + o.seg.slice(0, 18).padEnd(20) + ' → ' + o.cods.join(', '));
});
if (objetivo.length !== 4) { console.log('   🔴 esperaba 4 filas, encontré ' + objetivo.length + '. Paro.'); process.exit(1); }

// ══ 2 · LAS CELDAS ═══════════════════════════════════════════════════════════════════
var celdas = [];
function pon(ref, valor, porque, soloSiVacia) {
  var act = ws[ref];
  var vacia = (act === undefined || act.t === 'z' || t(act.v) === '');
  if (soloSiVacia && !vacia) { console.log('      ⊘ ' + ref + ' ya tiene texto suyo — no se toca: «' + t(act.v).slice(0, 50) + '»'); return; }
  celdas.push({ ref: ref, valor: valor, antes: vacia ? null : act.v, porque: porque });
}
console.log('\n── 2 · lo que se escribiría');
objetivo.forEach(function (o) {
  /* ORIGEN · se SUSTITUYE el marcador, no se reconstruye la celda.
     🔴 Reconstruir emparejando «código i ↔ parte i» produjo
     «e-bebida1 · (no está en el maestro) · wa-bebida1»: la celda ya venía DEDUPLICADA
     (rr0VvKTb y dHfqmS7n comparten `e-bebida1`), así que hay 3 códigos y 2 partes y el
     índice no alinea. Alinear por posición dos listas de distinto largo es el mismo error
     que ya mintió antes leyendo por índice de array. Se toca solo el marcador. */
  var origenActual = t(val('UTMS CONTENT ORIGEN', o.fila));
  var utmReal = DEL_MAESTRO[o.cods[0]].utm;
  var nuevo = origenActual.replace(/\(no está en el maestro\)/g, utmReal)
    .split(/\s*·\s*/).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · ');
  if (nuevo !== origenActual) pon(L('UTMS CONTENT ORIGEN') + o.fila, nuevo, 'el maestro (Junio) sí declara esta utm');

  // MODIFICADAS: con cero eventos no hay utm observada. Se declara la razón de la fuente.
  var modActual = t(val('UTMS CONTENT MODIFICADAS', o.fila));
  var modNuevo = modActual.replace(/\(sin carritos\)/g, 'N/A · no se envió a Qcart');
  if (modNuevo !== modActual) pon(L('UTMS CONTENT MODIFICADAS') + o.fila, modNuevo, 'la razón la da el maestro, no es que no haya carritos: es que no se envió');

  // NOTAS: solo si está vacía
  var nota;
  if (o.cods.indexOf('w5r9LWOP') >= 0) {
    nota = 'w5r9LWOP está en el maestro (Junio f23) pero con utm «wa-bebida1» = WhatsApp, ' +
      'y esta pieza es de email. El maestro lo marca «No se envío a Qcart» y tiene 0 carritos. ' +
      '¿Es un error del catálogo o se reusó a propósito?';
  } else {
    var c0 = o.cods[0], m = DEL_MAESTRO[c0];
    nota = c0 + ' está declarado en el maestro (' + m.hoja + ' f' + m.fila + ', utm «' + m.utm + '») ' +
      'pero marcado «' + m.estado + '»: por eso 0 carritos. El 0 es medido, no un hueco.';
  }
  pon(L('NOTAS') + o.fila, nota, 'no se pudo atribuir por fechas: 0 eventos que repartir', true);
});

celdas.forEach(function (x) {
  console.log('   ' + x.ref.padEnd(6) + (x.antes === null ? '(vacía)' : JSON.stringify(String(x.antes)).slice(0, 46)));
  console.log('   ' + ''.padEnd(6) + '   →  ' + JSON.stringify(String(x.valor)).slice(0, 110));
});
console.log('\n   total: ' + celdas.length + ' celdas');
fs.writeFileSync(BACK + '/_preescritura/maggi-utm-junio.json', JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), celdas: celdas }, null, 1));
if (!ESCRIBIR) { console.log('\n   (seco. Para aplicar: --escribir)'); process.exit(0); }

// ══ 3 · ESCRIBIR ═════════════════════════════════════════════════════════════════════
try { fs.closeSync(fs.openSync(VIVO, 'r+')); }
catch (e) { console.log('\n🔴 el libro está BLOQUEADO (' + e.code + '). Ciérralo en Excel. No escribo.'); process.exit(1); }

var zip = new AdmZip(VIVO);
var wbx = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
var rels = zip.getEntry('xl/_rels/workbook.xml.rels').getData().toString('utf8');
var mSh = new RegExp('<sheet[^>]*name="' + HOJA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*r:id="([^"]+)"').exec(wbx);
var mRel = new RegExp('<Relationship[^>]*Id="' + mSh[1] + '"[^>]*Target="([^"]+)"').exec(rels);
var parte = 'xl/' + mRel[1].replace(/^\/?xl\//, '');
var xml = zip.getEntry(parte).getData().toString('utf8');

var puestas = 0, malas = [];
celdas.forEach(function (x) {
  var fila = +/(\d+)$/.exec(x.ref)[1];
  // una fila autocerrada existe y NO admite celdas — hay que abrirla primero
  var mAuto = new RegExp('<row r="' + fila + '"([^>]*)\\/>').exec(xml);
  if (mAuto) xml = xml.replace(mAuto[0], '<row r="' + fila + '"' + mAuto[1] + '></row>');
  var est = CX.estiloDe(xml, x.ref);
  var res = CX.poner(xml, x.ref, CX.celda(x.ref, x.valor, est), fila);
  xml = res.xml;
  if (res.como === 'sin fila') malas.push(x.ref); else puestas++;
});
if (malas.length) { console.log('🔴 no se colocaron: ' + malas.join(' ')); process.exit(1); }
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(VIVO);
console.log('\n   ✔ ' + puestas + ' celdas escritas. Ahora las 5 capas.\n');

var T = require(__dirname + '/lib-entorno.js').TOOLS, NODE = T + '/node/node.exe';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var fallo = 0;
[[NODE, [T + '/xlsx-safe-save.js', VIVO]], [NODE, [T + '/xlsx-label.js', VIVO]], [NODE, [T + '/xlsx-check.js', VIVO]],
[PY, [T + '/xlsx-validar-fondo.py', VIVO]], [NODE, [T + '/xlsx-orden-celdas.js', VIVO]]].forEach(function (cc) {
  var nom = String(cc[1][0]).split('/').pop();
  try {
    var out = cp.execFileSync(cc[0], cc[1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('   ✔ ' + nom.padEnd(24) + out.trim().split('\n').slice(-1).join(' ').slice(0, 110));
  } catch (e) { fallo++; console.log('   🔴 ' + nom.padEnd(24) + String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 220)); }
});
console.log('\n' + (fallo ? '   🔴 ' + fallo + ' capa(s) fallaron' : '   ✅ las 5 capas en verde'));
