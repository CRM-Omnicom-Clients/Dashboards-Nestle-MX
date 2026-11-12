/*
 * fuentes-email.copia-de-local.js — UNA COPIA LOCAL, SIN CAMBIOS, DE LAS DE DE EMAIL DE SFMC.
 *
 * 🔴 QUÉ ES Y QUÉ NO ES. Lo pidió Rick así: *«una copia de la DE final por emails como xls fuente,
 *    para consultar la data, la puedes copiar sin ningún cambio»*. Entonces esto **no** es un
 *    reporte: es el volcado de la DE tal como SFMC lo entregó, una hoja por DE, los campos en el
 *    ORDEN de la DE y los valores intactos. No agrega columnas, no calcula tasas, no quita los
 *    jobs de prueba, no arregla nombres. Si algo se ve raro aquí, es porque así está en SFMC — y
 *    para eso sirve: para poder mirar la fuente sin la interpretación del sistema encima.
 *
 * 🔴 POR QUÉ SALE DE LOS VOLCADOS Y NO DE UNA LLAMADA NUEVA. Traer la DE completa por el MCP la
 *    haría pasar por el contexto de la sesión, y la doctrina de escritura lo prohíbe justamente por
 *    el tamaño. Los `_insumos/sfmc-*.txt` **ya son** el volcado sin tocar que el MCP entregó, con su
 *    fecha en el nombre. Se copian; no se reinterpretan. La hoja LEEME dice de qué día es, para que
 *    nadie confunda «la fuente» con «la fuente de hoy».
 *
 * 🔴 SE DECLARA LO QUE ESTA COPIA **NO** SABE. La DE agregada incluye los jobs de prueba (202 jobs
 *    = 203 envíos, alguien mandándose el correo a sí mismo) y el reporte los resta. O sea que los
 *    envíos de aquí NO tienen que cuadrar con el reporte, y si cuadran exacto es sospechoso. Eso va
 *    escrito en LEEME: una copia sin su advertencia se usa como si fuera el dato final.
 *
 * USO:
 *   node fuentes-email.copia-de-local.js              (seco: dice qué haría)
 *   node fuentes-email.copia-de-local.js --escribir
 *   node fuentes-email.copia-de-local.js --fecha 2026-09-22 --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var BACK = require('path').resolve(__dirname, '..');
var INS = BACK + '/_insumos';
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
function arg(n) { var i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; }
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

console.log('════ COPIA LOCAL DE LAS DE DE EMAIL ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// ── 1 · el volcado de cada DE: el más reciente, o el de la fecha pedida
var QUIERO = [
  { pre: 'piezas', hoja: 'CRM_Email_Piezas', que: 'la AGREGADA: una fila por pieza, con sus totales acumulados' },
  { pre: 'detalle', hoja: 'CRM_Email_Detalle', que: 'el DETALLE: una fila por pieza × día de envío. La fuente de verdad del sistema' },
  { pre: 'links', hoja: 'CRM_Email_Links', que: 'los LINKS: una fila por enlace de cada correo, con sus clicks' }
];
var FECHA = arg('fecha');
var elegidos = [], faltan = [];
QUIERO.forEach(function (q) {
  var cand = fs.readdirSync(INS).filter(function (f) {
    return new RegExp('^sfmc-' + q.pre + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f) &&
      (!FECHA || f.indexOf(FECHA) >= 0);
  }).sort().reverse();
  if (!cand.length) { faltan.push(q.pre); return; }
  var f = cand[0];
  var j;
  try { j = JSON.parse(fs.readFileSync(INS + '/' + f, 'utf8')); }
  catch (e) { faltan.push(q.pre + ' (ilegible: ' + String(e.message).slice(0, 40) + ')'); return; }
  // 🔴 UN VOLCADO TRUNCADO NO ES UNA COPIA. Si el MCP cortó la entrega, copiarlo igual daría un
  //    archivo que parece completo y no lo está, y quien lo consulte no tiene forma de saberlo.
  if (j.truncated) { faltan.push(q.pre + ' (el volcado viene TRUNCADO: ' + j.retrieved + ' de ' + j.count + ')'); return; }
  if ((j.rows || []).length !== j.count) {
    faltan.push(q.pre + ' (el volcado dice ' + j.count + ' y trae ' + (j.rows || []).length + ' filas)'); return;
  }
  elegidos.push(Object.assign({}, q, { archivo: f, j: j, fecha: /(\d{4}-\d{2}-\d{2})/.exec(f)[1] }));
  console.log('  ' + q.hoja.padEnd(20) + f.padEnd(30) + mil(j.count) + ' filas · ' + (j.fields || []).length + ' campos');
});
if (faltan.length) {
  console.log('\n  🔴 NO SE ESCRIBE: falta(n) ' + faltan.join(' · '));
  console.log('     Una copia a medias se consulta como si estuviera completa. Mejor ninguna.');
  process.exit(1);
}

// la fecha del archivo es la del volcado MÁS VIEJO de los tres: es hasta dónde llega de verdad
var fechas = elegidos.map(function (e) { return e.fecha; }).sort();
var CORTE = fechas[0];
var DESTINO = PROY + '/(Fuente)-SFMC-DEs-Email-' + CORTE + '.xlsx';
console.log('\n  destino: ' + path.basename(DESTINO));
if (fechas[0] !== fechas[fechas.length - 1]) {
  console.log('  ⚠ los tres volcados NO son del mismo día (' + fechas.join(' · ') + '): el nombre lleva el más viejo');
}
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ── 2 · el libro: una hoja por DE, los campos en SU orden, los valores intactos
var wb = XLSX.utils.book_new();

var leeme = [
  ['COPIA LOCAL DE LAS DATA EXTENSIONS DE EMAIL — SFMC'],
  [''],
  ['Qué es', 'el volcado de cada DE tal como SFMC lo entregó. Una hoja por DE.'],
  ['Qué NO es', 'un reporte. No hay columnas agregadas, ni tasas, ni correcciones.'],
  ['Para qué', 'consultar la fuente sin la interpretación del sistema encima.'],
  ['Generado', new Date().toISOString().slice(0, 16).replace('T', ' ')],
  ['Con', 'fuentes-email.copia-de-local.js'],
  [''],
  ['LAS HOJAS'],
  ['hoja', 'DE de SFMC', 'volcado del', 'filas', 'campos', 'qué es']
];
elegidos.forEach(function (e) {
  leeme.push([e.hoja, e.j.name, e.fecha, e.j.count, (e.j.fields || []).length, e.que]);
});
leeme = leeme.concat([
  [''],
  ['🔴 LO QUE ESTA COPIA NO SABE — leer antes de comparar con el reporte'],
  ['1', 'Los jobs de PRUEBA están dentro. En esta BU conviven jobs reales con jobs de 1 correo (alguien se lo manda a sí mismo para revisarlo): 202 jobs = 203 envíos. La DE agregada los suma con los reales; el reporte los resta. Por eso los envíos de aquí NO tienen que cuadrar con el reporte — y si cuadran exacto, es señal de que algo no restó.'],
  ['2', 'La Fecha_Primer_Envio de la agregada toma el primer job, pruebas incluidas. Para E-PROP1 decía 3-ago por cuatro jobs de UN envío cuando el envío real arrancó el 24-ago. La fecha buena se calcula del DETALLE, día por día.'],
  ['3', 'Es una foto del ' + CORTE + '. Las métricas de email ACUMULAN: opens y clicks siguen sumando días después del envío, así que un volcado posterior traerá números más altos para los MISMOS envíos. Maduran en 3-7 días.'],
  ['4', 'Clicks_Unique (por enlace) y Clicks (por correo) NO son la misma unidad. Quien toca dos enlaces cuenta 1 en el correo y 2 en los enlaces: el desglose puede exceder al total y no es un error.'],
  [''],
  ['De dónde salió cada hoja'],
  ['', '_insumos/' + elegidos.map(function (e) { return e.archivo; }).join('  ·  _insumos/')]
]);
var hL = XLSX.utils.aoa_to_sheet(leeme);
hL['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 13 }, { wch: 8 }, { wch: 8 }, { wch: 110 }];
XLSX.utils.book_append_sheet(wb, hL, 'LEEME');

elegidos.forEach(function (e) {
  // 🔴 `header` con los `fields` de la DE: así el orden de columnas es el de SFMC y no el que
  //    resulte de recorrer el primer objeto. Y `json_to_sheet` con esa cabecera incluye también las
  //    columnas que vengan VACÍAS en todas las filas — que si se omitieran, la copia tendría menos
  //    columnas que la DE y nadie lo notaría.
  var campos = (e.j.fields || []).slice();
  if (!campos.length) campos = Object.keys((e.j.rows || [])[0] || {});
  var hoja = XLSX.utils.json_to_sheet(e.j.rows || [], { header: campos });
  hoja['!cols'] = campos.map(function (c) { return { wch: Math.min(38, Math.max(10, c.length + 2)) }; });
  hoja['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, hoja, e.hoja.slice(0, 31));
  console.log('  ✔ hoja ' + e.hoja + ': ' + mil((e.j.rows || []).length) + ' filas × ' + campos.length + ' columnas');
});

// se escribe en LOCAL primero (rutas con acento + OneDrive) y se copia al destino
var TMP = BACK + '/_tmp/_copia-de.xlsx';
XLSX.writeFile(wb, TMP);
fs.copyFileSync(TMP, DESTINO);
console.log('\n  → ' + DESTINO);

// ── 3 · verificar RELEYENDO del destino, no del objeto que acabo de escribir
var rt = BACK + '/_tmp/_copia-de-verificar.xlsx';
fs.copyFileSync(DESTINO, rt);
var v = XLSX.readFile(rt);
var fallo = 0;
elegidos.forEach(function (e) {
  var h = v.Sheets[e.hoja.slice(0, 31)];
  if (!h) { console.log('  🔴 falta la hoja ' + e.hoja); fallo++; return; }
  var filas = XLSX.utils.sheet_to_json(h, { defval: '', blankrows: false });
  var campos = Object.keys(filas[0] || {});
  var okF = filas.length === (e.j.rows || []).length;
  // una comparación de contenido, no solo de conteo: la primera y la última fila, campo por campo
  var difs = 0;
  [0, filas.length - 1].forEach(function (i) {
    var a = (e.j.rows || [])[i] || {}, b = filas[i] || {};
    (e.j.fields || []).forEach(function (c) {
      var va = a[c] == null ? '' : String(a[c]), vb = b[c] == null ? '' : String(b[c]);
      if (va !== vb) difs++;
    });
  });
  console.log('  ' + (okF && !difs ? '✔' : '🔴') + ' ' + e.hoja.padEnd(20) + filas.length + '/' + (e.j.rows || []).length +
    ' filas · ' + campos.length + ' columnas · ' + difs + ' diferencia(s) en la primera y la última fila');
  if (!okF || difs) fallo++;
});
fs.unlinkSync(rt);
console.log('\n════ ' + (fallo ? '🔴 la copia NO cuadra con el volcado' : '✅ COPIA VERIFICADA CONTRA EL VOLCADO, releyendo del archivo escrito') + ' ════');
process.exit(fallo ? 1 : 0);
