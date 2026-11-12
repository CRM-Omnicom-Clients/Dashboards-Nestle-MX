/*
 * orquestador.linea-base.js — la red de seguridad de Rick, en una foto.
 *
 * POR QUÉ EXISTE: Rick puso tres condiciones para esta corrida, y las tres son sobre lo que YA
 * estaba bien, no sobre lo nuevo:
 *     «no se debe de quitar ni eliminar nada del catálogo que ya hayamos cuadrado antes»
 *     «no debes de descuadrar ningún número que ya se haya calculado antes»
 *     «lo que ya se definió no se regresa a POR DEFINIR, cuida muchísimo eso»
 *
 * Ninguna de las dos puertas puede probar eso: la PUERTA 1 cruza bloques contra catálogo y la
 * PUERTA 2 cruza reporte contra rejilla — las dos miran el estado NUEVO contra sí mismo. Para
 * demostrar que no se perdió nada hace falta el estado ANTERIOR, y eso hay que guardarlo antes.
 *
 * 🔴 Las columnas se PIDEN a `lib-columna`, no se escriben con corchete. Un literal devuelve
 *    `undefined` en silencio y `undefined` se lee como «vacío»: así un script acusó de vacías a
 *    98 de 98 filas sobre una columna llena al 100%.
 * 🔴 Direcciona por LLAVE de fila, nunca por índice: si Rick reordena filas, un diff posicional
 *    reporta cientos de falsos cambios y esconde el único real.
 *
 *   node orquestador.linea-base.js --guardar <etiqueta>    toma la foto
 *   node orquestador.linea-base.js --comparar <etiqueta>   la contrasta con lo que hay hoy
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx');
var fs = require('fs');
var os = require('os');
var path = require('path');
var COL = require(__dirname + '/lib-columna.js');

/* `--libro <ruta>` fotografía OTRO archivo en vez del vivo. Existe para poder tomar la foto del
 * «antes» cuando nadie la tomó a tiempo: un respaldo en disco ES el estado anterior, y compararlo
 * contra el vivo es la única forma honesta de decir «esto no movió nada» después del hecho. */
var LIBRO = (function () {
  var i = process.argv.indexOf('--libro');
  if (i > 0 && process.argv[i + 1]) {
    var p = process.argv[i + 1];
    if (!fs.existsSync(p)) { console.log('🔴 no existe el libro que pides: ' + p); process.exit(1); }
    return p;
  }
  return ENT.LIBRO;
})();
var CARPETA = require('path').resolve(__dirname, '..') + '/_preescritura/lineas-base';

// Los ids LÓGICOS de la llave de cada hoja. `lib-columna` los traduce al encabezado real.
//
// 🔴 LA LLAVE DE UNA RED DE SEGURIDAD NO PUEDE LLEVAR UN VALOR QUE EL SISTEMA REESCRIBE
//    (15-sep-2026). La de `Catalogo_Referencias` era `Pieza_IDs + Valor_Crudo`, y `Pieza_IDs` es
//    justo la lista que un paso recalcula cuando el padrón de piezas cambia. Al retirar las 4
//    piezas E-P* de Liga MX se recalcularon 7 listas, y esta red reportó **15 filas idas** cuando
//    de verdad se habían ido 8: las otras 7 seguían ahí, con otra llave.
//    Es el mismo defecto que acabábamos de corregir en el contrato de Qcart, y duele más aquí:
//    ésta es la red que existe para decir «no se perdió nada». Una red que grita de más se aprende
//    a ignorar, y entonces ya no avisa el día que se pierde algo de verdad.
//    Lo que SÍ identifica una fila de referencias es lo que la fila declara —qué valor crudo, de
//    qué dimensión, en qué contexto— y nada de eso lo reescribe ningún paso.
//
// 🔴 LAS HOJAS DE DATOS ENTRARON EL 2-OCT-2026, Y LA RAZÓN ES UN ERROR MÍO.
//    Esta red cubría el catálogo, el Resumen y las referencias — los tres artefactos que Rick
//    pidió cuidar. No cubría las hojas crudas, así que para validar la migración me escribí una
//    foto aparte, a mano. Esa foto tomaba el email y el WhatsApp de la HOJA y el Qcart del
//    BLOQUE, y después la comparé contra la hoja: la diferencia sheet-vs-bloque se leyó como
//    «la migración movió 49 carritos». No había movido nada — las 49 filas de `004-P020` llevan
//    en la hoja desde el 30-sep, y lo probó un respaldo.
//    Peor: con esa misma foto declaré «las 10 cifras son idénticas» en la tanda anterior. El
//    Qcart se comparaba bloque contra bloque y **cuadraba consigo mismo**, que es justo el modo
//    de fallo que ya costó `Data_WhatsApp` (19 checks en verde, 14 de 26 envíos mal, los dos
//    lados salían del mismo lector equivocado).
//    Así que las hojas crudas se miden AQUÍ, con llave y desde UN solo objeto: el libro.
var LLAVE = {
  'Catalogo_Piezas': ['Pieza' + '_ID'],
  'Report_Resumen': ['Camp' + 'aña', 'Touch' + 'Point', 'Segm' + 'ento', 'Obje' + 'tivo'],
  'Catalogo_Referencias': ['Valor' + '_Crudo', 'Dimen' + 'sion', 'Contex' + 'to'],
  // `Email_Name` es la llave natural única de una pieza de email (probada 99/99); el `Pieza_ID`
  // la acompaña porque una pieza puede aparecer con variantes de nombre.
  'Data_Email': ['Pieza' + '_ID', 'Email' + '_Name'],
  // 🔴 aquí NO va `Sends`: una llave de identidad no puede llevar una métrica. Ese defecto ya
  //    mordió dos veces — un número que cambia con el refresh, y dos filas con el mismo 1,085.
  'Data_WhatsApp': ['Pieza' + '_ID', 'Whatsapp' + '_Name'],
  'Data_Qcart_Carritos': ['Pieza' + '_ID', 'fecha', 'hora', 'shortlink' + '_code', 'store'],
  'Data_Qcart_Productos': ['Pieza' + '_ID', 'fecha', 'hora', 'shortlink' + '_code', 'store', 'product']
};

var TOKEN_PENDIENTE = /^(POR DEFINIR|PENDIENTE)$/i;

function t(v) { return String(v == null ? '' : v).trim(); }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

function leerLibro() {
  // 🔴 Ruta con acentos + OneDrive: se copia a una ruta ASCII del home antes de leer.
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_linea-base.xlsx';
  fs.copyFileSync(LIBRO, tmp);
  var wb = XLSX.readFile(tmp);
  fs.unlinkSync(tmp);
  return wb;
}

function fotografiar() {
  var wb = leerLibro();
  var foto = { cuando: new Date().toISOString(), libro: path.basename(LIBRO), hojas: {} };

  Object.keys(LLAVE).forEach(function (hoja) {
    if (!wb.Sheets[hoja]) { foto.hojas[hoja] = { ausente: true }; return; }
    var filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '' });
    if (!filas.length) { foto.hojas[hoja] = { ausente: true }; return; }

    // Se resuelven los encabezados REALES una sola vez, pidiéndolos.
    var campos = LLAVE[hoja].map(function (id) {
      var real = COL.opcional(filas, id);
      if (!real) throw new Error('linea-base: la hoja «' + hoja + '» no tiene columna que resuelva a «' + id + '»');
      return real;
    });

    var reg = {}, sinLlave = 0, conValor = 0, pendientes = 0;

    filas.forEach(function (f) {
      var partes = campos.map(function (c) { return t(f[c]).toLowerCase(); });
      // Una fila sin NINGÚN campo de llave no es un registro: son las notas a mano de Rick.
      if (partes.every(function (p) { return p === ''; })) { sinLlave++; return; }
      var k = partes.join('¦');

      var celdas = {};
      Object.keys(f).forEach(function (col) {
        var v = t(f[col]);
        if (v === '') return;
        celdas[col] = v;
        if (TOKEN_PENDIENTE.test(v)) pendientes++; else conValor++;
      });
      // Si la llave se repite se guardan las dos: perder una en el diff sería peor que verla.
      if (reg[k]) { var n = 2; while (reg[k + '¤' + n]) n++; reg[k + '¤' + n] = celdas; }
      else reg[k] = celdas;
    });

    foto.hojas[hoja] = {
      filas: filas.length, registros: Object.keys(reg).length, sin_llave: sinLlave,
      celdas_con_valor: conValor, celdas_pendientes: pendientes,
      llave_real: campos, columnas: Object.keys(filas[0]), reg: reg
    };
  });

  return foto;
}

function resumir(foto, titulo) {
  console.log('══ ' + titulo + ' ══');
  Object.keys(foto.hojas).forEach(function (h) {
    var d = foto.hojas[h];
    if (d.ausente) { console.log('   ' + h.padEnd(24) + 'AUSENTE'); return; }
    console.log('   ' + h.padEnd(24) + mil(d.registros) + ' registros · ' + d.columnas.length + ' columnas · ' +
      mil(d.celdas_con_valor) + ' con valor · ' + mil(d.celdas_pendientes) + ' pendientes' +
      (d.sin_llave ? '   (' + d.sin_llave + ' filas sin llave: notas a mano)' : ''));
  });
}

var ETIQ = (function () {
  var i = process.argv.indexOf('--guardar'); if (i > 0) return { modo: 'guardar', n: process.argv[i + 1] };
  var j = process.argv.indexOf('--comparar'); if (j > 0) return { modo: 'comparar', n: process.argv[j + 1] };
  return null;
})();

if (!ETIQ || !ETIQ.n) { console.log('uso: --guardar <etiqueta>  |  --comparar <etiqueta>'); process.exit(1); }
if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true });
var DESTINO = CARPETA + '/' + ETIQ.n + '.json';

if (ETIQ.modo === 'guardar') {
  var foto = fotografiar();
  fs.writeFileSync(DESTINO, JSON.stringify(foto), 'utf8');
  resumir(foto, 'LÍNEA BASE «' + ETIQ.n + '» guardada');
  Object.keys(foto.hojas).forEach(function (h) {
    if (!foto.hojas[h].ausente) console.log('      llave de ' + h + ': ' + foto.hojas[h].llave_real.join(' + '));
  });
  console.log('\n   → ' + DESTINO);
  process.exit(0);
}

// ── comparar ────────────────────────────────────────────────────────────────
if (!fs.existsSync(DESTINO)) { console.log('no existe la línea base «' + ETIQ.n + '»'); process.exit(1); }
var antes = JSON.parse(fs.readFileSync(DESTINO, 'utf8'));
var hoy = fotografiar();

resumir(antes, 'ANTES  (' + antes.cuando.slice(0, 16).replace('T', ' ') + ')');
resumir(hoy, 'HOY');

var PERDIDAS = [], REGRESIONES = [], CAMBIOS = [], FILAS_IDAS = [], COLS_IDAS = [];

// 🔴 SI LA LLAVE CAMBIÓ, LA COMPARACIÓN NO VALE PARA ESA HOJA — y se dice, no se disimula.
//    Al corregir la llave de `Catalogo_Referencias` (llevaba `Pieza_IDs`, que el sistema
//    recalcula) las líneas base guardadas antes quedaron con la llave vieja. Compararlas fila a
//    fila diría que TODAS se fueron y todas son nuevas, que es ruido puro. Una red que no puede
//    concluir tiene que decir «no pude evaluar», nunca inventar un veredicto.
var LLAVE_DISTINTA = [];
Object.keys(antes.hojas).forEach(function (h) {
  var A = antes.hojas[h], H = hoy.hojas[h];
  if (A.ausente || !H || H.ausente) return;
  if ((A.llave_real || []).join('|') !== (H.llave_real || []).join('|')) {
    LLAVE_DISTINTA.push({ hoja: h, antes: (A.llave_real || []).join(' + '), hoy: (H.llave_real || []).join(' + ') });
  }
});
if (LLAVE_DISTINTA.length) {
  console.log('\n⊘ NO PUEDO COMPARAR FILA A FILA en ' + LLAVE_DISTINTA.length + ' hoja(s): su llave cambió desde que se tomó la foto');
  LLAVE_DISTINTA.forEach(function (x) {
    console.log('   ' + x.hoja + '   antes: ' + x.antes + '   ·   hoy: ' + x.hoy);
    console.log('      se compara solo el CONTEO de filas, que sí es comparable: ' +
      Object.keys(antes.hojas[x.hoja].reg).length + ' → ' + Object.keys(hoy.hojas[x.hoja].reg).length);
  });
  console.log('   (para volver a comparar fila a fila, toma una línea base nueva)');
}
var SALTAR = {}; LLAVE_DISTINTA.forEach(function (x) { SALTAR[x.hoja] = 1; });

Object.keys(antes.hojas).forEach(function (h) {
  var A = antes.hojas[h], H = hoy.hojas[h];
  if (A.ausente) return;
  if (!H || H.ausente) { PERDIDAS.push({ hoja: h, que: 'la hoja entera desapareció' }); return; }
  if (SALTAR[h]) return;

  A.columnas.forEach(function (c) { if (H.columnas.indexOf(c) < 0) COLS_IDAS.push({ que: h + ' · ' + c }); });

  Object.keys(A.reg).forEach(function (k) {
    var a = A.reg[k], b = H.reg[k];
    if (!b) { FILAS_IDAS.push({ hoja: h, llave: k, celdas: Object.keys(a).length }); return; }
    Object.keys(a).forEach(function (col) {
      var va = a[col], vb = b[col];
      if (vb === undefined || vb === '') {
        // Una celda que tenía algo y ahora no tiene nada. Si la columna ya no existe, se
        // reporta como columna retirada, no como pérdida de dato: es otra decisión.
        if (H.columnas.indexOf(col) < 0) return;
        if (!TOKEN_PENDIENTE.test(va)) PERDIDAS.push({ hoja: h, llave: k, col: col, era: va, ahora: '(vacío)' });
        return;
      }
      if (vb === va) return;
      // 🔴 Lo que Rick pidió cuidar «muchísimo»: un valor real que vuelve a POR DEFINIR.
      if (!TOKEN_PENDIENTE.test(va) && TOKEN_PENDIENTE.test(vb)) {
        REGRESIONES.push({ hoja: h, llave: k, col: col, era: va, ahora: vb });
      } else {
        CAMBIOS.push({ hoja: h, llave: k, col: col, era: va, ahora: vb });
      }
    });
  });
});

console.log('\n══ VEREDICTO ══');
function bloque(titulo, lista, tope, grave) {
  var marca = lista.length === 0 ? '🟢' : (grave ? '🔴' : '⚠ ');
  console.log('   ' + marca + ' ' + titulo.padEnd(46) + mil(lista.length));
  lista.slice(0, tope || 12).forEach(function (x) {
    console.log('        ' + (x.hoja || '') + ' · ' + (x.llave || x.que || '') + (x.col ? ' · ' + x.col : '') +
      (x.era !== undefined ? '   «' + String(x.era).slice(0, 34) + '» → «' + String(x.ahora).slice(0, 34) + '»' : ''));
  });
  if (lista.length > (tope || 12)) console.log('        … y ' + (lista.length - (tope || 12)) + ' más');
}
bloque('VALORES QUE SE PERDIERON (celda quedó vacía)', PERDIDAS, 15, true);
bloque('VOLVIERON A «POR DEFINIR»', REGRESIONES, 15, true);
bloque('FILAS QUE YA NO ESTÁN', FILAS_IDAS, 15, true);
bloque('columnas retiradas (decisión aparte)', COLS_IDAS, 15, false);
bloque('valores que CAMBIARON (dato nuevo o corrección)', CAMBIOS, 12, false);

var mal = PERDIDAS.length + REGRESIONES.length + FILAS_IDAS.length;
console.log('\n   ' + (mal === 0
  ? '🟢 NADA DE LO QUE YA ESTABA SE PERDIÓ NI REGRESÓ A «POR DEFINIR».'
  : '🔴 ' + mil(mal) + ' cosas que Rick pidió cuidar SE MOVIERON. No se declara la corrida buena.'));
process.exit(mal === 0 ? 0 : 1);
