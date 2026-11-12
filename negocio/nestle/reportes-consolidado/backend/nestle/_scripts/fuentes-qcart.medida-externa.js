// fuentes-qcart · LA ÚNICA MEDIDA EXTERNA QUE TIENE QCART, HECHA REPRODUCIBLE.
//
// 🔴 POR QUÉ EXISTE. Las puertas del sistema cruzan bloque ↔ rejilla ↔ reporte, y los tres
//    descienden del mismo origen: si la unidad del origen está mal, **los tres coinciden**. Eso es
//    lo que dejó pasar el defecto de septiembre —3,077 filas leídas como 3,077 carritos cuando son
//    7,503 vistas— con todas las sumas cuadrando. Un sistema que se compara consigo mismo prueba
//    que es CONSISTENTE, no que es correcto.
//
// 🔴 LA MEDIDA EXTERNA ES EL EXPORT **AGREGADO** de Qcart: el CSV sin `-raw-` que trae una fila por
//    shortlink × utm × tienda con las vistas y el importe ya sumados del periodo. Es *el resumen que
//    Qcart hace de sus propios datos*, así que contrastar contra él es preguntarle a la fuente. Vive
//    en `ReportesQcart/_backups/no-se-cargan/` a propósito: **no se carga nunca** —cargarlo
//    duplicaría el volumen— y por eso no estaba comparado con nada.
//
// 🔴 EL NÚMERO SE MIDIÓ UNA VEZ A MANO Y ESO NO SIRVE. «Vistas exactas en 62 de 121 shortlinks» era
//    una medición suelta de una sesión: no la reproducía ningún script, así que no se podía volver a
//    comprobar ni ver si empeoraba. Un dato que el sistema no puede recalcular no es evidencia, es
//    una anécdota. Este script lo recalcula.
//
// 🔴 LA VENTANA ES LA DEL AGREGADO, NO LA DEL BLOQUE. El nombre del archivo trae su periodo y el
//    bloque cubre más: comparar el bloque completo contra un agregado de un solo mes daría
//    descuadres falsos en TODOS los shortlinks con tráfico anterior. Es el mismo error de leer un
//    envío contra la hoja del mes equivocado. Se filtra por fecha antes de comparar y la ventana se
//    imprime, para que nadie lea el resultado sin saber a qué periodo pertenece.
//
// USO:
//    node fuentes-qcart.medida-externa.js                  usa el agregado más reciente que encuentre
//    node fuentes-qcart.medida-externa.js --archivo <csv>   uno concreto
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var Q = require(BACK + '/_scripts/lib-qcart.js');

var iA = process.argv.indexOf('--archivo');
var ARCH = iA >= 0 ? process.argv[iA + 1] : null;
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var din = function (n) { return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }); };

console.log('════════ fuentes-qcart · MEDIDA EXTERNA — el bloque contra el agregado de Qcart ════════\n');

// ── 1 · encontrar el agregado. Un agregado NO lleva `-raw-`; si lo lleva, es un log y no sirve
//        de referencia porque es la misma materia prima que ya cargamos.
var DIR = PROY + '/ReportesQcart/_backups/no-se-cargan';
if (!ARCH) {
  var cand = [];
  try {
    cand = fs.readdirSync(DIR).filter(function (f) {
      return /\.csv$/i.test(f) && /carts/i.test(f) && !/-raw-/i.test(f);
    }).map(function (f) { return path.join(DIR, f); });
  } catch (e) { }
  cand.sort(function (a, b) { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; });
  ARCH = cand[0];
}
if (!ARCH || !fs.existsSync(ARCH)) {
  console.log('  ⊘ NO PUDE EVALUAR — no encontré un export AGREGADO de carritos (un `carts-` sin `-raw-`).');
  console.log('     Se busca en ' + DIR);
  console.log('     🔴 Esto NO cuenta como pasar: significa que Qcart se queda sin medida externa,');
  console.log('        que es justo el hueco que este script existe para cerrar.');
  process.exit(2);
}
console.log('  agregado: ' + path.basename(ARCH));

// ── 2 · la ventana sale del NOMBRE del archivo, que es quien la declara
var mv = /(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/.exec(path.basename(ARCH));
if (!mv) {
  console.log('  ⊘ NO PUDE EVALUAR — el nombre del agregado no declara su periodo, y sin periodo la');
  console.log('     comparación no significa nada.');
  process.exit(2);
}
var DESDE = mv[1], HASTA = mv[2];
console.log('  ventana:  ' + DESDE + ' → ' + HASTA + '   (se filtra el bloque a ella antes de comparar)\n');

// ── 3 · leer el agregado y sumar por shortlink
var txt = fs.readFileSync(ARCH, 'utf8').replace(/^﻿/, '');
var lineas = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
var sep = Q.separador ? Q.separador(lineas[0]) : ';';
var enc = Q.partir ? Q.partir(lineas[0], sep) : lineas[0].split(sep);
var idx = {};
enc.forEach(function (h, i) { idx[String(h).trim().toLowerCase()] = i; });
['shortlink code', 'views', 'total shown price'].forEach(function (c) {
  if (idx[c] === undefined) {
    console.log('  🔴 el agregado no trae la columna «' + c + '» — no se puede contrastar.');
    process.exit(1);
  }
});

var ext = {};
var extFilas = 0;
lineas.slice(1).forEach(function (l) {
  var c = Q.partir ? Q.partir(l, sep) : l.split(sep);
  var cod = String(c[idx['shortlink code']] || '').trim();
  if (!cod) return;
  extFilas++;
  var e = ext[cod] = ext[cod] || { views: 0, importe: 0, filas: 0 };
  e.views += Q.num(c[idx['views']]) || 0;
  e.importe += Q.num(c[idx['total shown price']]) || 0;
  e.filas++;
});
console.log('  el agregado: ' + mil(extFilas) + ' filas · ' + mil(Object.keys(ext).length) + ' shortlinks · Σ ' +
  mil(Object.keys(ext).reduce(function (a, k) { return a + ext[k].views; }, 0)) + ' vistas');

// ── 4 · el bloque, filtrado a la ventana y sumado por shortlink
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var mio = {}, mioFuera = 0;
(B.carritos || []).forEach(function (e) {
  var f = String(e.fecha || '').slice(0, 10);
  if (!f || f < DESDE || f > HASTA) { mioFuera++; return; }
  var cod = String(e.shortlink_code || '').trim();
  if (!cod) return;
  var m = mio[cod] = mio[cod] || { views: 0, importe: 0, filas: 0 };
  m.views += Number(e.views) || 0;
  m.importe += Number(e.total_shown_price) || 0;
  m.filas++;
});
console.log('  el bloque:   ' + mil(Object.keys(mio).length) + ' shortlinks en la ventana · Σ ' +
  mil(Object.keys(mio).reduce(function (a, k) { return a + mio[k].views; }, 0)) + ' vistas' +
  '   (' + mil(mioFuera) + ' filas del bloque quedan fuera de la ventana)\n');

// ── 5 · el contraste, solo sobre los shortlinks que están en LOS DOS
//        🔴 Un shortlink que solo está en el agregado NO es un descuadre: el agregado trae todo el
//           tráfico de Qcart, incluido el de campañas que no son nuestras. Meterlo en la cuenta
//           haría que el contraste saliera siempre mal y acabaría en «este check no sirve».
var comunes = Object.keys(mio).filter(function (k) { return ext[k]; });
var soloMio = Object.keys(mio).filter(function (k) { return !ext[k]; });
var exactas = [], difieren = [], impExactas = 0;
comunes.forEach(function (k) {
  var a = mio[k], b = ext[k];
  if (a.views === b.views) exactas.push(k);
  else difieren.push({ k: k, mio: a.views, ext: b.views, d: a.views - b.views });
  // el importe se compara con tolerancia de un peso: son dos sumas de decimales distintas
  if (Math.abs(a.importe - b.importe) < 1) impExactas++;
});
difieren.sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });

console.log('  ── el contraste, sobre los ' + comunes.length + ' shortlinks que están en los DOS');
console.log('     vistas exactas:  ' + exactas.length + ' de ' + comunes.length +
  (comunes.length ? '   (' + (100 * exactas.length / comunes.length).toFixed(0) + '%)' : ''));
console.log('     importe exacto:  ' + impExactas + ' de ' + comunes.length + '   (±$1)');
if (difieren.length) {
  console.log('\n     los ' + Math.min(8, difieren.length) + ' descuadres mayores:');
  difieren.slice(0, 8).forEach(function (d) {
    console.log('       ' + d.k + '   bloque ' + mil(d.mio) + '  vs  Qcart ' + mil(d.ext) +
      '   (' + (d.d > 0 ? '+' : '') + mil(d.d) + ')');
  });
}
if (soloMio.length) {
  console.log('\n     ⚠ ' + soloMio.length + ' shortlink(s) del bloque NO están en el agregado: ' +
    soloMio.slice(0, 6).join(' ') + (soloMio.length > 6 ? ' …' : ''));
  console.log('       (el agregado puede venir de otro periodo o de otra cuenta — se declara, no se ignora)');
}

// ── 6 · el veredicto. 🔴 Esto NO bloquea un corte: es una MEDIDA, no una puerta. Los descuadres
//        contra una fuente externa se explican (ventanas distintas, tráfico sin shortlink), y
//        convertirlos en bloqueo garantizaría que alguien desactive el check. Lo que sí hace es
//        dejar el número escrito para poder ver si mejora o empeora.
var salida = {
  agregado: path.basename(ARCH), ventana: { desde: DESDE, hasta: HASTA },
  medido: new Date().toISOString(),
  shortlinks: { agregado: Object.keys(ext).length, bloque: Object.keys(mio).length, comunes: comunes.length },
  vistas_exactas: exactas.length, importe_exacto: impExactas,
  descuadres: difieren.slice(0, 40), solo_en_bloque: soloMio
};
fs.writeFileSync(BACK + '/_preescritura/qcart-medida-externa.json', JSON.stringify(salida, null, 1));
console.log('\n════ ' + (comunes.length === 0
  ? '⊘ NO PUDE EVALUAR — ningún shortlink en común. No cuenta como pasar.'
  : 'MEDIDO · ' + exactas.length + '/' + comunes.length + ' vistas exactas y ' + impExactas + '/' + comunes.length +
  ' importes exactos contra la propia Qcart') + ' ════');
console.log('→ _preescritura/qcart-medida-externa.json');
process.exit(comunes.length === 0 ? 2 : 0);
