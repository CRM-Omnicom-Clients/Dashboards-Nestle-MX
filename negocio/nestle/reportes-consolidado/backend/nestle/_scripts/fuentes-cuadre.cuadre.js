// PUERTA-1 · CUADRE CRUZADO — el gate que decide si la Puerta 1 abre.
//
// Los cuatro bloques ya se validaron **contra sí mismos**. Este los cruza **entre ellos** y
// contra el catálogo, que es donde aparece lo que ninguno puede ver solo.
//
// 🔴 REGLA DURA: si el veredicto es CERRADA, la Puerta 1 no escribe NADA — ni siquiera los
//    bloques que sí cuadran. Escribir la mitad de un corte deja el archivo en un estado que
//    nadie sabe describir después.
//
// ⚠ Este paso NO escribe el Excel. Solo lee y dictamina.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'cuadre';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var C = require(__dirname + '/lib-cuadre.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = C.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var BLOQUEA = [], AVISA = [];
function bloquea(que, detalle) { BLOQUEA.push({ que: que, detalle: detalle }); }
function avisa(que, detalle) { AVISA.push({ que: que, detalle: detalle }); }

console.log('════════ PUERTA-1 · CUADRE CRUZADO ════════\n');

// ══ 0 · LOS CUATRO BLOQUES ══════════════════════════════════════════════════════════
function cargar(n) {
  var p = BACK + '/_fuentes/' + n + '.json';
  try {
    var o = JSON.parse(fs.readFileSync(p, 'utf8'));
    var st = fs.statSync(p);
    o.__mtime = st.mtime.toISOString().slice(0, 16);
    o.__mtime_ms = st.mtimeMs;
    return o;
  } catch (e) { return null; }
}
var B = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp'), manual: cargar('manual') };
console.log('  bloque      generado          registros');
Object.keys(B).forEach(function (k) {
  var b = B[k];
  var n = !b ? '—' : k === 'qcart' ? (b.carritos.length + b.productos.length) : k === 'manual' ? b.datos.length : b.envios.length;
  console.log('  ' + k.padEnd(11) + (b ? b.__mtime : '(NO EXISTE)').padEnd(18) + String(n).padStart(6));
  if (!b) bloquea('falta el bloque «' + k + '»', 'no se puede escribir un corte incompleto');
});
if (BLOQUEA.length) {
  console.log('\n  🔴 PUERTA CERRADA: falta al menos un bloque.');
  process.exit(1);
}

var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2v.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var idx = C.indicePiezas(P);

// ══ 1 · ¿MISMA GENERACIÓN? ══════════════════════════════════════════════════════════
console.log('\n══ 1 · ¿los 4 bloques son del mismo corte? ══');
var fr = C.frescura(B);
console.log('     ' + fr.detalle);
if (!fr.ok) bloquea('los bloques son de generaciones distintas',
  fr.minutos + ' min entre ' + fr.mas_viejo + ' y ' + fr.mas_nuevo + ' — escribirlos juntos mezcla dos cortes');

// ══ 2 · ¿DOBLE CONTEO? ══════════════════════════════════════════════════════════════
console.log('\n══ 2 · ¿el mismo dato contado por dos bloques? ══');
var dc = C.dobleConteo(B, idx);
console.log('     pares pieza¦métrica: ' + dc.pares + '   con más de un bloque: ' + dc.choques.length);
dc.choques.slice(0, 6).forEach(function (c) { console.log('        🔴 ' + c.par + '  ' + JSON.stringify(c.de)); });
if (!dc.ok) bloquea('el mismo dato viene de dos bloques',
  dc.choques.length + ' pares: ' + dc.choques.slice(0, 3).map(function (c) { return c.par; }).join(' · ') + ' — el reporte los sumaría dos veces');

// ══ 3 · ¿LA Σ CUADRA CON EL CATÁLOGO? ═══════════════════════════════════════════════
console.log('\n══ 3 · ¿la Σ de cada bloque cuadra con el catálogo? ══');
var sv = C.sumaVsCatalogo(B, P);
sv.forEach(function (s) {
  var icono = s.clase === 'ok' ? '✔' : s.clase === 'aviso' ? '⚠' : '🔴';
  console.log('     ' + icono + ' ' + s.canal.padEnd(10) + 'bloque ' + mil(s.bloque).padStart(11) + '   catálogo ' + mil(s.catalogo).padStart(11));
  console.log('        ' + s.lectura);
  if (s.clase === 'bloquea') bloquea('el bloque de ' + s.canal + ' trae MENOS que el catálogo', s.lectura);
  if (s.clase === 'aviso') avisa('el bloque de ' + s.canal + ' trae más que el catálogo', s.lectura);
});

// ══ 4 · ¿EL CUADRE INTERNO SIGUE EN PIE? ════════════════════════════════════════════
console.log('\n══ 4 · ¿el cuadre interno de cada bloque sigue bien? ══');
C.cuadreInterno(B).forEach(function (c) {
  console.log('     ' + (c.ok ? '✔' : '🔴') + ' ' + c.bloque.padEnd(11) + c.detalle);
  if (!c.ok) bloquea('el cuadre interno de «' + c.bloque + '» está roto', c.detalle);
});

// ══ 5 · COBERTURA Y HUÉRFANOS ═══════════════════════════════════════════════════════
console.log('\n══ 5 · cobertura del catálogo ══');
var cob = C.cobertura(B, idx, P);
console.log('     piezas ' + cob.piezas + '   tocadas ' + cob.tocadas + '   sin tocar ' + cob.sin_tocar);
if (cob.sin_tocar) {
  console.log('        ' + cob.sin_tocar_detalle.slice(0, 6).join('  ·  '));
  avisa(cob.sin_tocar + ' piezas del catálogo sin datos de ningún bloque',
    'puede que aún no tengan envíos — no impide escribir las demás');
}
console.log('     datos sin pieza: ' + cob.huerfanos + '   de esos, SIN declarar: ' + cob.huerfanos_sin_declarar);
if (cob.huerfanos_sin_declarar) bloquea(cob.huerfanos_sin_declarar + ' datos sin pieza y sin motivo declarado',
  'un dato sin ancla y sin explicación no se puede escribir en ninguna hoja');
else if (cob.huerfanos) avisa(cob.huerfanos + ' datos sin pieza, todos declarados con su motivo',
  'sus bloques ya los explican; no entran a ninguna hoja');

// ══ EL VEREDICTO ════════════════════════════════════════════════════════════════════
var abierta = BLOQUEA.length === 0;
var out = {
  paso: 'PUERTA-1 · cuadre cruzado', generado_por: 'fuentes-cuadre.cuadre.js',
  cuando: new Date().toISOString().slice(0, 16),
  que_hace: 'cruza los 4 bloques entre ellos y contra el catálogo. NO escribe el Excel.',
  regla_dura: 'si el veredicto es CERRADA, la Puerta 1 no escribe NADA — ni los bloques que sí cuadran. Un corte a medias deja el archivo en un estado que nadie sabe describir.',
  veredicto: abierta ? 'PUERTA ABIERTA' : 'PUERTA CERRADA',
  puede_escribir: abierta,
  bloqueos: BLOQUEA,
  avisos: AVISA,
  medido: {
    frescura: fr, doble_conteo: { pares: dc.pares, choques: dc.choques },
    suma_vs_catalogo: sv, cuadre_interno: C.cuadreInterno(B), cobertura: cob,
    bloques: Object.keys(B).map(function (k) { return { bloque: k, generado: B[k].__mtime }; })
  },
  para_la_puerta: {
    orden: ['catalogo', 'email', 'qcart', 'whatsapp', 'manual'],
    ojo: 'el catálogo va PRIMERO: las columnas canónicas de las hojas de datos lo consultan por fórmula',
    ojo_2: 'los avisos no detienen la escritura pero viajan al reporte del corte'
  }
};
fs.writeFileSync(BACK + '/_fuentes/veredicto.json', JSON.stringify(out, null, 1));

console.log('\n════════ VEREDICTO ════════');
if (BLOQUEA.length) {
  console.log('  🔴 PUERTA CERRADA — ' + BLOQUEA.length + ' bloqueo(s):');
  BLOQUEA.forEach(function (b) { console.log('     · ' + b.que + '\n       ' + b.detalle); });
  console.log('\n  ⛔ La Puerta 1 NO debe escribir nada, ni siquiera los bloques que sí cuadran.');
} else {
  console.log('  ✅ PUERTA ABIERTA — los 4 bloques cuadran entre ellos y con el catálogo');
}
if (AVISA.length) {
  console.log('\n  ⚠ ' + AVISA.length + ' aviso(s) — no detienen la escritura, pero viajan al reporte:');
  AVISA.forEach(function (a) { console.log('     · ' + a.que + '\n       ' + a.detalle); });
}
console.log('\n  → ' + BACK + '/_fuentes/veredicto.json');
process.exit(abierta ? 0 : 1);
