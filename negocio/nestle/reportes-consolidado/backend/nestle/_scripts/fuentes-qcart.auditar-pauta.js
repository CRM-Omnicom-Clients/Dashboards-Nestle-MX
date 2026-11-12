// fuentes-qcart · LA PAUTA: EL DOC DE LINKS DEFINE LAS PIEZAS, Y EL CATÁLOGO TIENE QUE CUMPLIRLA.
//
// 🔴 LA REGLA, EN PALABRAS DE RICK (27-ago-2026):
//    «TODAS LAS FILAS DEL DOC LINK QCART MARCAN UNA PIEZA, CADA MES DE MARZO A AGOSTO, ESO
//     DEFINE TODO. SI ES MISMO SEGMENTO EN DIFERENTE MES CON SHORT LINK DISTINTO, ES AHÍ DONDE
//     CUADRAS. Únicamente envío principal, NUNCA FUPS. POR ESO EL CATÁLOGO ES PRIMERO.»
//
//    Un BLOQUE del doc = MES × campaña × touchpoint × segmento, con sus shortlinks. Eso es UNA
//    pieza. El mismo segmento en otro mes, con otros códigos, es OTRA pieza y otra fila.
//
// 🔴 ESTE SCRIPT NO ESCRIBE NADA. Compara y declara. Corregir el catálogo es una decisión con la
//    evidencia delante, no un efecto secundario de auditarlo — y menos cuando lo que está en
//    juego son atribuciones que ya se entregaron.
//
// 🔴 POR QUÉ NO ES CIRCULAR: el esperado sale del DOC (que este sistema no escribe) y el puesto
//    sale del catálogo. Ninguno de los dos lo produjo el mismo paso que se está auditando.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json`
//    (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var M = require(BACK + '/_scripts/lib-maestro-links.js');
var Q = require(BACK + '/_scripts/lib-qcart-links.js');
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ fuentes-qcart · LA PAUTA DEL DOC CONTRA EL CATÁLOGO ════════\n');

// ══ 1 · CÓMO SE LEYÓ EL DOC — si una hoja de mes no entró, nada de lo demás vale ═════
var idx = M.cargar({ recargar: true });
console.log('  ── el doc, hoja por hoja');
idx.hojas.forEach(function (h) {
  console.log('     ' + (h.leida ? '✔ ' : '🔴 ') + h.hoja.padEnd(9) +
    (h.leida ? ('encabezado f' + h.fila_encabezado).padEnd(16) + String(h.filas).padStart(4) + ' filas' +
      (h.codigos_de_url ? '   ' + h.codigos_de_url + ' código(s) leídos de la URL' : '')
      : h.motivo));
});
var sinLeer = idx.hojas.filter(function (h) { return !h.leida || !h.filas; });
chk('🔴 las ' + M.MESES.length + ' hojas de mes se leyeron y trajeron filas', sinLeer.length === 0,
  sinLeer.length ? '🔴 ' + sinLeer.map(function (h) { return h.hoja; }).join(' · ') + ' — media atribución sin fuente'
    : M.MESES.join(' · ') + '  ·  ' + idx.filas.length + ' filas · ' + Object.keys(idx.porCodigo).length + ' códigos');

// ══ 2 · LOS BLOQUES = LAS PIEZAS QUE EL DOC DECLARA ═════════════════════════════════
var bloques = M.piezasDelDoc();
console.log('\n  ── los bloques del doc: ' + bloques.length + ' pieza(s) declaradas');

// ══ 3 · EL CATÁLOGO ════════════════════════════════════════════════════════════════
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_auditar-pauta.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TMP);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var NM = {};
['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Email_Type', 'Quincena'].forEach(function (id) { NM[id] = COL.de(CAT, id); });
var pieza = {}, codPieza = {};
CAT.forEach(function (p) {
  var pid = t(p[NM.Pieza_ID]); if (!pid) return;
  pieza[pid] = p;
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { (codPieza[c] = codPieza[c] || []).push(pid); });
  });
});
console.log('     catálogo: ' + CAT.length + ' piezas · ' + Object.keys(codPieza).length + ' códigos declarados');

// ══ 4 · BLOQUE POR BLOQUE ══════════════════════════════════════════════════════════
console.log('\n  ── cada bloque del doc contra el catálogo');
console.log('     ' + 'MES'.padEnd(8) + 'CAMPAÑA'.padEnd(23) + 'TP'.padEnd(9) + 'SEGMENTO'.padEnd(20) + 'CODS'.padStart(5) + '   PIEZA');
console.log('     ' + '-'.repeat(112));
var sinPieza = [], multi = [], enFUP = [], ok = 0;
bloques.forEach(function (b) {
  var pzs = {};
  b.codigos.forEach(function (c) { (codPieza[c] || []).forEach(function (p) { pzs[p] = 1; }); });
  var lista = Object.keys(pzs), et;
  if (!lista.length) { et = '🔴 NINGUNA la declara'; sinPieza.push(b); }
  else if (lista.length > 1) { et = '🔴 ' + lista.join(',') + ' — el bloque se parte'; multi.push({ b: b, pzs: lista }); }
  else {
    var p = pieza[lista[0]], tipo = t(p[NM.Email_Type]);
    if (/follow|fup/i.test(tipo)) { et = '🔴 ' + lista[0] + ' es ' + tipo; enFUP.push({ b: b, pid: lista[0], tipo: tipo }); }
    else { et = '✔ ' + lista[0] + '  ' + t(p[NM.TouchPoint]) + ' · ' + t(p[NM.Segmento]).slice(0, 20) + ' · ' + t(p[NM.Quincena]); ok++; }
  }
  console.log('     ' + b.mes.padEnd(8) + b.campana.slice(0, 22).padEnd(23) + b.touchpoint.slice(0, 8).padEnd(9) +
    b.segmento.slice(0, 19).padEnd(20) + String(b.codigos.length).padStart(5) + '   ' + et);
});

chk('🔴 cada bloque del doc tiene UNA pieza en el catálogo', sinPieza.length === 0 && multi.length === 0,
  (sinPieza.length || multi.length) ? '🔴 ' + sinPieza.length + ' sin pieza · ' + multi.length + ' repartidos'
    : ok + ' de ' + bloques.length + ' bloques, uno a uno');
chk('🔴 ningún shortlink cuelga de un FUP (Rick: nunca FUPs)', enFUP.length === 0,
  enFUP.length ? '🔴 ' + enFUP.map(function (x) { return x.pid + ' (' + x.tipo + ')'; }).join(' · ')
    : 'los ' + ok + ' bloques cuelgan de un envío Principal');

// ══ 5 · EL OTRO LADO: códigos del catálogo que el doc no declara ════════════════════
var enDoc = {}; bloques.forEach(function (b) { b.codigos.forEach(function (c) { enDoc[c] = 1; }); });
var huerf = {};
Object.keys(codPieza).forEach(function (c) { if (!enDoc[c]) codPieza[c].forEach(function (p) { (huerf[p] = huerf[p] || []).push(c); }); });
var kh = Object.keys(huerf).sort();
chk('todo código del catálogo está declarado en el doc', kh.length === 0,
  kh.length ? '⚠ ' + kh.length + ' pieza(s) con códigos fuera del doc' : 'los ' + Object.keys(codPieza).length + ' códigos vienen del doc');

// ══ 6 · Y EL DETALLE QUE HACE ACCIONABLE CADA ROJO ══════════════════════════════════
if (sinPieza.length) {
  console.log('\n  🔴 BLOQUES DEL DOC SIN PIEZA — el catálogo les debe una fila');
  sinPieza.forEach(function (b) {
    console.log('     ' + b.mes.padEnd(8) + b.campana.padEnd(24) + b.touchpoint.padEnd(10) + b.segmento.slice(0, 22).padEnd(23) + b.codigos.join(','));
    console.log('          recetas: ' + b.recetas.join(' · ').slice(0, 100));
  });
}
if (multi.length) {
  console.log('\n  🔴 BLOQUES QUE SE PARTEN ENTRE VARIAS PIEZAS');
  multi.forEach(function (x) {
    console.log('     ' + x.b.mes + ' · ' + x.b.campana + ' · ' + x.b.touchpoint + ' · ' + x.b.segmento);
    x.pzs.forEach(function (p) {
      console.log('          ' + p + '  ' + t(pieza[p][NM.TouchPoint]) + ' · ' + t(pieza[p][NM.Segmento]) +
        ' · ' + t(pieza[p][NM.Email_Type]) + ' · ' + t(pieza[p][NM.Quincena]));
    });
  });
}
if (kh.length) {
  console.log('\n  ⚠ CÓDIGOS DEL CATÁLOGO QUE EL DOC NO DECLARA');
  kh.forEach(function (p) {
    var z = pieza[p];
    console.log('     ' + p.padEnd(10) + t(z[NM.Campaña]).slice(0, 16).padEnd(17) + t(z[NM.TouchPoint]).padEnd(9) +
      t(z[NM.Segmento]).slice(0, 22).padEnd(23) + t(z[NM.Email_Type]).padEnd(11) + huerf[p].join(','));
  });
}

fs.writeFileSync(BACK + '/_fuentes/pauta-doc-links.json', JSON.stringify({
  paso: 'fuentes-qcart.auditar-pauta', regla: 'un bloque MES×campaña×touchpoint×segmento del doc = UNA pieza Principal',
  hojas: idx.hojas, bloques: bloques.length, con_una_pieza: ok,
  sin_pieza: sinPieza, repartidos: multi.map(function (x) { return { bloque: x.b.llave, piezas: x.pzs }; }),
  en_fup: enFUP.map(function (x) { return { bloque: x.b.llave, pieza: x.pid, tipo: x.tipo }; }),
  codigos_fuera_del_doc: huerf
}, null, 1));

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔ ' : '🔴 ') + v[0].padEnd(56) + v[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) — el catálogo no cumple la pauta del doc' : '✅ EL CATÁLOGO CUMPLE LA PAUTA DEL DOC'));
console.log('  → _fuentes/pauta-doc-links.json   ·   el Excel NO se tocó');
process.exit(fallo ? 1 : 0);
