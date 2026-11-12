// Z · EL ESCRITOR ÚNICO — aplica TODOS los cambios apuntados en una sola pasada.
//
// 🔴 UNA APERTURA, UNA CADENA DE VALIDACIÓN, UN RESPALDO. Cada apertura del .xlsx es una
//    oportunidad de corromperlo, y cinco scripts escribiendo por su cuenta eran cinco. Aquí los
//    cambios de todos los scripts entran juntos, se validan juntos y se publican juntos.
//
// 🔴 SI DOS SCRIPTS PIDEN LA MISMA CELDA CON VALORES DISTINTOS, NO SE ESCRIBE NINGUNO. Dejar que
//    gane el último por orden de ejecución es cómo se pierde un dato sin que nadie lo note.
//
// 🔴 Y SI EL ARCHIVO ESTÁ TOMADO (`EBUSY`), NO SE FUERZA. Con Excel abierto OneDrive revierte la
//    escritura sin dejar rastro: quedaría un log diciendo «publicado» y el archivo intacto. Los
//    cambios siguen apuntados y se aplican cuando se libere.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), cp = require('child_process');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var R = require(__dirname + '/lib-registro.js');
var CB = require(__dirname + '/lib-cambios.js');
var PROY = ENT.PROYECTO;
var TOOLS = require(__dirname + '/lib-entorno.js').TOOLS;
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function q(x) { return String.fromCharCode(34) + x + String.fromCharCode(34); }

var C = CB.cargar();
console.log('════════ Z · ESCRITOR ÚNICO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  cambios apuntados: ' + C.cambios.length);
var res = CB.resumen();
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n] + ' celda(s)'); });
console.log('  por hoja:');
Object.keys(res.por_hoja).sort().forEach(function (h2) { console.log('     ' + h2.padEnd(24) + res.por_hoja[h2]); });
var HOJAS = C.hojas || [];
if (HOJAS.length) {
  console.log('  hojas a REGENERAR enteras:');
  HOJAS.forEach(function (h) { console.log('     ' + h.hoja.padEnd(24) + h.n + ' filas   (' + h.paso + ')'); });
}

// ── 1 · los choques paran todo
var ch = CB.choques(C);
if (ch.length) {
  console.log('\n  🔴 ' + ch.length + ' celda(s) que dos scripts piden con valores DISTINTOS:');
  ch.forEach(function (x) {
    console.log('     ' + x.celda);
    x.piden.forEach(function (p) { console.log('        ' + p.paso + ' → «' + t(p.valor) + '»   ' + p.porque.slice(0, 70)); });
  });
  console.log('\n  ⛔ No se escribe NADA hasta resolverlo. Que gane el último por orden de ejecución');
  console.log('     es exactamente cómo se pierde un dato sin que nadie lo note.');
  process.exit(1);
}
console.log('  choques: ninguno ✔');
// 🔴 «NADA QUE ESCRIBIR» NO ES SOLO CERO CELDAS. Un lote puede traer únicamente columnas nuevas o
//    una hoja a regenerar, y Z se salía en silencio dejándolas sin aplicar: pedí `FUP_Quincena` y
//    `Canal`, el log no dijo nada, y las columnas no aparecieron. Se cuenta TODO lo que el lote
//    puede pedir.
var _nuevasCnt = (C.columnas_nuevas || []).length, _hojasCnt = (C.hojas || []).length;
if (!C.cambios.length && !_nuevasCnt && !_hojasCnt) { console.log('\n  nada que escribir.'); process.exit(0); }
if (!C.cambios.length) console.log('  (sin celdas, pero hay ' + _nuevasCnt + ' columna(s) nueva(s) y ' + _hojasCnt + ' hoja(s) a regenerar)');

// ── 2 · el archivo tiene que estar libre ANTES de preparar nada
var vivo = L.archivoVivo({ dir: PROY });
var libre = false, errBusy = '';
try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); libre = true; } catch (e) { errBusy = e.code; }
console.log('\n  el archivo vivo: ' + (libre ? 'libre ✔' : '🔴 TOMADO (' + errBusy + ')'));
if (!libre) {
  console.log('\n  ⛔ NO SE ESCRIBE. Con Excel abierto OneDrive revierte la escritura sin dejar rastro:');
  console.log('     quedaría un log diciendo «publicado» y el archivo intacto.');
  console.log('     Los ' + C.cambios.length + ' cambios siguen apuntados. Cierra el Excel y vuelve a correr esto.');
  process.exit(2);
}

// ── 3 · preparar: agrupar por hoja y resolver las columnas por el registro
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_z.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var AMBITO = { 'Report_Resumen': 'resumen', 'Catalogo_Piezas': 'catalogo', 'Catalogo_Referencias': 'referencias',
  'Data_Email': 'data_email', 'Data_WhatsApp': 'data_wa', 'Data_Qcart_Carritos': 'qcart_carritos',
  'Data_Qcart_Productos': 'qcart_productos' };
var porHoja = {};
C.cambios.forEach(function (x) { (porHoja[x.hoja] = porHoja[x.hoja] || []).push(x); });

// 🔴 LAS COLUMNAS NUEVAS SE CREAN ANTES DE VALIDAR NADA. El modelo pide columnas que la hoja no
//    tiene todavía (`Pieza_Principal_ID`, `Subject`, `FUP_Quincena`). Se agregan **al final** de su
//    hoja: insertar en medio desplazaría todas las de la derecha y con ellas cada referencia de
//    fórmula que las apunte. Y se declara cada una con su motivo, como cualquier otro cambio.
var NUEVAS = CB.columnasNuevas();
var encExtra = {};   // hoja → encabezados con las nuevas ya incluidas (para validar contra esto)
if (NUEVAS.length) {
  console.log('\n  ── columnas NUEVAS pedidas: ' + NUEVAS.length);
  NUEVAS.forEach(function (n) {
    var enc = (XLSX.utils.sheet_to_json(wb.Sheets[n.hoja], { header: 1 })[0] || []).map(t);
    var base = encExtra[n.hoja] || enc.slice();
    var ya = base.indexOf(t(n.nombre)) >= 0;
    console.log('     ' + (ya ? '○ ya existe' : '+ se creará') + '  ' + n.hoja + ' → «' + n.nombre + '»   (' + n.paso + ')');
    if (!ya) base.push(t(n.nombre));
    encExtra[n.hoja] = base;
  });
}
function encabezadosDe(hoja) {
  return encExtra[hoja] || (XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || []).map(t);
}

var problemas = [];
Object.keys(porHoja).forEach(function (hoja) {
  if (!wb.Sheets[hoja]) { problemas.push('no existe la hoja «' + hoja + '»'); return; }
  var enc = encabezadosDe(hoja);
  var faltan = {};
  porHoja[hoja].forEach(function (x) { if (enc.indexOf(t(x.columna)) < 0) faltan[x.columna] = 1; });
  Object.keys(faltan).forEach(function (c) { problemas.push('«' + hoja + '» no tiene la columna «' + c + '» (ni se pidió crearla)'); });

  // 🔴 Z NO SABE AGREGAR FILAS, Y ANTES LO CALLABA. Se apuntaron 21 celdas a las filas 267-269 de
  //    `Catalogo_Referencias`; el log dijo «21 celdas escritas · PUBLICADO» y **ninguna llegó**:
  //    `CX.poner` reemplaza dentro de filas existentes y esas no existían. Un escritor que reporta
  //    haber escrito lo que no escribió es peor que uno que falla — el corte siguió como si el
  //    dato estuviera. Ahora se detecta ANTES y se dice qué hacer en su lugar.
  var ultima = XLSX.utils.decode_range(wb.Sheets[hoja]['!ref'] || 'A1').e.r + 1;
  var fueraDeRango = porHoja[hoja].filter(function (x) { return x.fila > ultima; });
  if (fueraDeRango.length) {
    var filasFR = fueraDeRango.map(function (x) { return x.fila; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    problemas.push('«' + hoja + '» tiene ' + ultima + ' filas y se apuntaron celdas a la(s) fila(s) ' + filasFR.join(', ') +
      ' — Z NO crea filas nuevas. Para agregar filas, el script debe usar CB.regenerarHoja() con la hoja completa.');
  }
});
// las hojas a regenerar tienen que existir, y sus filas usar columnas de la hoja
HOJAS.forEach(function (h) {
  if (!wb.Sheets[h.hoja]) { problemas.push('no existe la hoja a regenerar «' + h.hoja + '»'); return; }
  var enc = (XLSX.utils.sheet_to_json(wb.Sheets[h.hoja], { header: 1 })[0] || []).map(t);
  var ajenas = {};
  (h.filas[0] ? Object.keys(h.filas[0]) : []).forEach(function (c) { if (enc.indexOf(t(c)) < 0) ajenas[c] = 1; });
  Object.keys(ajenas).forEach(function (c) { problemas.push('la regeneración de «' + h.hoja + '» trae una columna «' + c + '» que la hoja no tiene'); });
});
if (problemas.length) {
  console.log('\n  🔴 ' + problemas.length + ' problema(s) antes de tocar nada:');
  problemas.forEach(function (p) { console.log('     · ' + p); });
  process.exit(1);
}
console.log('  todas las columnas existen ✔');
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: node escritor.escribir-todo.js --escribir)'); process.exit(0); }

// ── 4 · respaldo, uno solo
var stamp = (C.corte || 'corte').replace(/[^A-Za-z0-9_-]/g, '');
var BK = PROY + '/_backups/' + require('path').basename(vivo.ruta).replace(/\.xlsx$/, '') + '__antes-' + stamp + '.xlsx';
fs.copyFileSync(vivo.ruta, BK);
console.log('\n  respaldo: ' + require('path').basename(BK));

// ── 5 · aplicar, hoja por hoja, en UNA apertura del zip
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var partes = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { partes[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

// 🔴 primero REGENERAR las hojas de datos enteras, y DESPUÉS aplicar celdas sobre las demás.
//    El orden importa solo si algo apuntara una celda sobre una hoja regenerada — pero eso ya es
//    un choque y no llegamos aquí. Se hace en este orden para que quede explícito.
var regeneradas = 0;
HOJAS.forEach(function (h) {
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[h.hoja], { header: 1 })[0] || [];
  var xml = zip.readAsText(partes[h.hoja]);
  // el estilo de cada columna, tomado de la fila 2 del original (o A1 si no hay)
  var estCol = {}; enc.forEach(function (n, i) { estCol[i] = CX.estiloDe(xml, R.letra(i) + '2'); });
  var estEnc = {}; enc.forEach(function (n, i) { estEnc[i] = CX.estiloDe(xml, R.letra(i) + '1'); });
  // la fila 1 (encabezado) se conserva; si algún paso apuntó un RENOMBRE de encabezado sobre esta
  // hoja (celda fila 1), se aplica aquí — no es un choque, es el nombre nuevo de la columna.
  var renEnc = (porHoja[h.hoja] || []).filter(function (x) { return x.fila === 1; });
  var filaEnc = (/<row r="1"[^>]*>[\s\S]*?<\/row>/.exec(xml) || [''])[0];
  if (!filaEnc) { // fila 1 autocerrada o ausente: la armamos desde enc
    filaEnc = '<row r="1">' + enc.map(function (n, i) { return CX.celda(R.letra(i) + '1', t(n), estEnc[i]); }).join('') + '</row>';
  }
  renEnc.forEach(function (x) {
    var i = enc.map(t).indexOf(t(x.columna)); if (i < 0) return;
    filaEnc = CX.poner(filaEnc, R.letra(i) + '1', CX.celda(R.letra(i) + '1', x.valor, estEnc[i]), 1).xml;
  });
  // esas celdas de encabezado ya se aplicaron aquí: se quitan de porHoja para no re-aplicarlas
  if (renEnc.length) porHoja[h.hoja] = (porHoja[h.hoja] || []).filter(function (x) { return x.fila !== 1; });
  var cuerpo = '';
  h.filas.forEach(function (fila, k) {
    var nf = k + 2, celdas = [];
    enc.forEach(function (nom, i) {
      var v = fila[t(nom)];
      celdas.push(CX.celda(R.letra(i) + nf, (v === undefined || v === null) ? '' : v, estCol[i]));
    });
    cuerpo += '<row r="' + nf + '">' + celdas.join('') + '</row>';
  });
  // fila de totales opcional, al final
  var ultima = h.filas.length + 1;
  if (h.totales) {
    ultima++;
    var celdasT = enc.map(function (nom, i) { var v = h.totales[t(nom)]; return CX.celda(R.letra(i) + ultima, (v === undefined || v === null) ? '' : v, estCol[i]); });
    cuerpo += '<row r="' + ultima + '">' + celdasT.join('') + '</row>';
  }
  xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + filaEnc + cuerpo + '</sheetData>');
  xml = xml.replace(/<dimension ref="([A-Z]+)\d+:([A-Z]+)\d+"\/>/, function (_, c1, c2) { return '<dimension ref="' + c1 + '1:' + c2 + ultima + '"/>'; });
  zip.updateFile(partes[h.hoja], Buffer.from(xml, 'utf8'));
  console.log('     ' + h.hoja.padEnd(24) + 'regenerada: ' + h.filas.length + ' filas' + (h.totales ? ' + totales' : ''));
  regeneradas++;
});

// 🔴 PRIMERO LOS ENCABEZADOS NUEVOS. Se escriben en la fila 1, al final de la hoja, ANTES de
//    aplicar celdas: si una celda apunta a una columna que aún no existe, su índice sería -1 y
//    escribiría en la columna equivocada — un dato en el lugar de otro, sin error visible.
var creadas = 0;
Object.keys(encExtra).forEach(function (hoja) {
  var real = (XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || []).map(t);
  var xml = zip.readAsText(partes[hoja]);
  encExtra[hoja].forEach(function (nom, i) {
    if (i < real.length) return;            // ya estaba
    var ref = R.letra(i) + '1';
    var est = CX.estiloDe(xml, R.letra(real.length - 1) + '1');   // el estilo del encabezado vecino
    xml = CX.poner(xml, ref, CX.celda(ref, nom, est), 1).xml;
    console.log('     ' + hoja.padEnd(24) + '+ columna ' + R.letra(i) + ' «' + nom + '»');
    creadas++;
  });
  // 🔴 EL `<dimension>` TIENE QUE CRECER CON LA HOJA. Sin esto la celda se escribe en el XML pero
  //    **nadie la ve**: SheetJS y Excel leen el rango declarado, no las celdas que hay. Pasó exacto:
  //    BY1 y BZ1 estaban en el archivo, `dimension` seguía diciendo `A1:BX120`, y la hoja reportaba
  //    76 columnas después de crear dos. Un dato escrito que nadie lee es peor que no escribirlo:
  //    el log dice «publicado» y la columna no existe.
  var ultCol = R.letra(encExtra[hoja].length - 1);
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2, r2) {
    return '<dimension ref="' + c1 + r1 + ':' + ultCol + r2 + '"/>';
  });
  zip.updateFile(partes[hoja], Buffer.from(xml, 'utf8'));
});

var escritas = 0;
Object.keys(porHoja).forEach(function (hoja) {
  // el índice se arma con los encabezados que la hoja VA a tener (incluidas las nuevas)
  var enc = encExtra[hoja] || (XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || []).map(t);
  var idx = {}; enc.forEach(function (n, i) { if (t(n)) idx[t(n)] = i; });
  var xml = zip.readAsText(partes[hoja]);
  porHoja[hoja].forEach(function (x) {
    var i = idx[x.columna], ref = R.letra(i) + x.fila;
    var est = CX.estiloDe(xml, ref) || CX.estiloDe(xml, R.letra(i) + '2');
    var v = (x.valor === null || x.valor === undefined) ? '' : x.valor;
    xml = CX.poner(xml, ref, CX.celda(ref, v, est), x.fila).xml;
    escritas++;
  });
  zip.updateFile(partes[hoja], Buffer.from(xml, 'utf8'));
  console.log('     ' + hoja.padEnd(24) + porHoja[hoja].length + ' celda(s)');
});
zip.writeZip(SECO);
console.log('  celdas escritas: ' + escritas + (regeneradas ? '  ·  hojas regeneradas: ' + regeneradas : '') + (creadas ? '  ·  columnas creadas: ' + creadas : ''));

// ── 6 · las cinco capas, una vez
console.log('\n  ── las 5 capas');
function corre(cmd) { return cp.execSync(cmd, { encoding: 'utf8', timeout: 300000 }); }
try {
  console.log('     safe-save : ' + (safeSave(SECO, SECO).validado || '?'));
  corre(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-label.js') + ' ' + q(SECO));
  console.log('     etiqueta  : restaurada');
  corre(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-check.js') + ' ' + q(SECO));
  console.log('     check     : estructura íntegra');
  if (fs.existsSync(PY)) { corre(q(PY) + ' ' + q(TOOLS + '/xlsx-validar-fondo.py') + ' ' + q(SECO)); console.log('     fondo     : limpio en las 4'); }
  corre(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-orden-celdas.js') + ' ' + q(SECO));
  console.log('     orden     : correcto');
} catch (e) {
  console.log('\n  🔴 la salida NO pasa las capas. El vivo queda INTACTO.');
  console.log('     ' + String((e.stdout || '') + (e.message || '')).split(/[\r\n]+/).slice(-3).join('\n     '));
  process.exit(1);
}

// ── 7 · publicar y comprobar que de verdad quedó
var antes = fs.statSync(vivo.ruta).mtimeMs;
try { fs.copyFileSync(SECO, vivo.ruta); }
catch (e) {
  console.log('\n  🔴 no se pudo copiar (' + e.code + '). Los cambios siguen apuntados.');
  process.exit(2);
}
if (fs.statSync(vivo.ruta).mtimeMs <= antes || fs.statSync(vivo.ruta).size !== fs.statSync(SECO).size) {
  console.log('\n  🔴 la copia no quedó (¿OneDrive la revirtió?). Los cambios siguen apuntados.');
  process.exit(2);
}
console.log('\n  ✔ PUBLICADO al vivo · ' + Math.round(fs.statSync(vivo.ruta).size / 1024) + ' KB');

// ── 7b · las hojas regeneradas tienen que tener las filas que se pidieron, RELEÍDAS del disco
if (HOJAS.length) {
  console.log('\n  ── verificación de hojas regeneradas (releído del vivo):');
  var wbV = XLSX.readFile(vivo.ruta);
  var malReg = 0;
  HOJAS.forEach(function (h) {
    var F = XLSX.utils.sheet_to_json(wbV.Sheets[h.hoja], { defval: '', blankrows: false });
    var esperado = h.filas.length + (h.totales ? 1 : 0);
    var bien = F.length === esperado;
    if (!bien) malReg++;
    console.log('     ' + (bien ? '✔' : '🔴') + ' ' + h.hoja.padEnd(24) + F.length + ' filas   (esperado ' + esperado + ')');
  });
  if (malReg) { console.log('\n  🔴 una hoja regenerada no quedó con las filas esperadas. Revisa el vivo.'); process.exit(3); }
}

// ── 8 · el lote se cierra: lo aplicado SE VACÍA, no solo se marca
// 🔴 ESTO ESTABA MAL Y COSTÓ UNA CORRIDA. El cierre ponía `abierto: false` pero DEJABA los 28,286
//    cambios dentro, y nadie miraba esa bandera. El paso siguiente los volvía a ver, Z intentaba
//    re-aplicarlos, y se estrelló contra 15 columnas que él mismo acababa de renombrar: buscaba
//    `Campana_Canonica` cuando ya se llamaba `Campaña`. Un lote «cerrado» que sigue lleno no está
//    cerrado. Se ARCHIVA con su fecha —para poder auditar qué se aplicó— y se vacía.
var histo = BACK_HIST();
function BACK_HIST() { return require('path').resolve(__dirname, '..') + '/_contratos/_aplicados'; }
try { fs.mkdirSync(histo, { recursive: true }); } catch (e) { }
var nomHist = (C.corte || 'corte').replace(/[^A-Za-z0-9_-]/g, '') + '__' + escritas + 'celdas.json';
fs.writeFileSync(histo + '/' + nomHist, JSON.stringify({
  corte: C.corte, celdas: escritas, columnas: creadas, hojas_regeneradas: regeneradas,
  respaldo: require('path').basename(BK),
  cambios: C.cambios, columnas_nuevas: C.columnas_nuevas || [], hojas: C.hojas || []
}, null, 1));
CB.guardar({
  corte: C.corte, abierto: false,
  aplicado: { celdas: escritas, columnas: creadas, respaldo: require('path').basename(BK), archivo: nomHist },
  cambios: [], columnas_nuevas: [], hojas: [],
  regla: 'lote CERRADO y VACIADO. Lo aplicado vive en _contratos/_aplicados/. Para el siguiente corte: lib-cambios.abrir(<corte>)'
});
console.log('  lote cerrado y vaciado → _contratos/_aplicados/' + nomHist);
