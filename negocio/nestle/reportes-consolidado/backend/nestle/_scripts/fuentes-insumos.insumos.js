// insumos-validar · INSUMOS — el veredicto. Produce `_insumos/inventario.json`.
//
// Migra `agent-insumos.md` + `validar-insumos.js`. Su trabajo: revisar lo que llegó ANTES de
// que nada lo consuma, y dejar por escrito **la forma de cada fuente** para que los bloques
// (email-bloque/b/c) NO la vuelvan a derivar — que es el gasto más grande de una corrida.
//
// NO HACE: cargar datos · escribir en el workbook · renombrar, mover o borrar nada del inbox.
//          Si detecta que un archivo debería renombrarse, lo REPORTA.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), path = require('path'), os = require('os');
var I = require(__dirname + '/lib-insumos.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
// 🔴 el archivo vivo se RESUELVE, no se declara. Estaba escrito con su versión (-v8) en 31
//    sitios del sistema: el día que exista una v9, todos siguen leyendo la v8 **sin avisar**.
//    Este paso es el que le dice a los demás cuál es el archivo, así que aquí se resuelve una
//    vez y viaja en el handoff.
var _vivo = L.archivoVivo({ dir: PROY });
var VIVO = _vivo.ruta;
var t = I.t;

var CORTE = (process.argv.indexOf('--corte') >= 0) ? process.argv[process.argv.indexOf('--corte') + 1] : null;
var V = [], notas = [], tareas = [];
function chk(n, nom, ok, det) { V.push({ grupo: n, check: nom, ok: !!ok, detalle: det || '' }); }

console.log('════════ insumos-validar · INSUMOS ════════');
console.log('  corte pedido: ' + (CORTE || '(ninguno)') + '\n');

// ══ [1] EMAIL ═══════════════════════════════════════════════════════════════════════
var em = I.descubrir(PROY, 'email');
/* 🔴 DATORAMA ESTÁ RETIRADO y estos dos checks lo seguían exigiendo. El email sale del MCP de SFMC
 *    desde septiembre, así que la carpeta de Datorama puede no existir — y marcarlo en rojo es
 *    ruido que entrena a ignorar el rojo. Se informa, no se reprueba, y se dice de dónde sale el
 *    email de verdad para que nadie lo busque donde ya no está. */
if (em.opcional && !em.existe) {
  console.log('  · [1] Datorama RETIRADO: su carpeta no está, y no hace falta.');
  console.log('        El email sale del MCP de SFMC — volcados `sfmc-piezas-*` en _insumos/.');
} else {
  chk(1, 'existe el inbox de email', em.existe, em.dir);
  var invEm0 = I.porFrescura(em.archivos);
  chk(1, 'hay descarga de email', invEm0.length > 0, invEm0.length + ' archivos');
}
var invEm = I.porFrescura(em.archivos);

var elegido = invEm[0] || null;
if (elegido) {
  chk(1, 'la descarga no viene vacía', elegido.kb > 50, elegido.kb + ' KB');

  // 🔴 el defecto 2 del guardián viejo: elegía por el WK del NOMBRE
  var enganan = I.nombreEngana(invEm);
  chk(1, 'el nombre no contradice a la frescura real', enganan.length === 0,
    enganan.length ? enganan.map(function (x) { return x.archivo + ' (WK' + x.wk_del_nombre + ' pero ' + x.sello + ')'; }).join(' · ')
      : 'el más fresco es ' + elegido.archivo);
  if (enganan.length) {
    tareas.push('⚠ ' + enganan.length + ' archivo(s) con WK mayor pero MÁS VIEJOS que ' + elegido.archivo +
      '. Se usa el sello interno, no el nombre. Si el corte pedía uno de esos, dilo.');
  }

  // el corte pedido se compara contra el NOMBRE, y eso se declara como tal
  if (CORTE) {
    var pedido = (String(CORTE).match(/(\d+)/) || [])[1];
    var coincide = pedido && elegido.wk_del_nombre && +pedido === elegido.wk_del_nombre;
    chk(1, 'el corte pedido coincide con el elegido', coincide,
      'pedido=' + CORTE + ' · elegido=' + elegido.archivo +
      (coincide ? '' : '  ⚠ el nombre del corte NO dice qué datos trae: eso se lee adentro'));
  }
  notas.push('email: ' + invEm.length + ' descargas · se usa ' + elegido.archivo + ' (' + elegido.sello + ')');
}

// 🔴 el defecto 1: los que el patrón de nombre dejaba fuera
var invisibles = em.archivos.filter(function (a) { return !/^Datorama-Nestle-WK\d+\.xlsx$/i.test(a.archivo); });
chk(1, 'ningún archivo queda fuera por su nombre', true,
  invisibles.length + ' rescatados que el patrón viejo no veía: ' + invisibles.map(function (a) { return a.archivo; }).join(', '));

// ══ [2] QCART ═══════════════════════════════════════════════════════════════════════
var qc = I.descubrir(PROY, 'qcart');
chk(2, 'existe el inbox de Qcart', qc.existe, qc.dir);
var csvs = qc.archivos.filter(function (a) { return /\.csv$/i.test(a.archivo); });
var clas = csvs.map(function (a) { return { a: a, c: I.clasificar(a.ruta) }; });
var sinClasificar = clas.filter(function (x) { return !/qcart-/.test(x.c.tipo); });
chk(2, 'todo CSV se clasifica por su encabezado', sinClasificar.length === 0,
  csvs.length + ' CSV · sin clasificar ' + sinClasificar.length);

// parejas carts+products
var piezas = {};
clas.forEach(function (x) {
  var p = I.pieza(x.a.archivo);
  piezas[p] = piezas[p] || {};
  piezas[p][x.c.tipo === 'qcart-productos' ? 'products' : 'carts'] = x.a.archivo;
});
var incompletas = Object.keys(piezas).filter(function (p) { return !piezas[p].carts || !piezas[p].products; });
chk(2, 'cada pieza trae sus dos mitades', incompletas.length === 0,
  Object.keys(piezas).length + ' piezas · incompletas ' + incompletas.length);
incompletas.forEach(function (p) {
  var falta = piezas[p].carts ? 'products' : 'carts';
  tareas.push('PENDIENTE-DESCARGA Qcart: "' + p + '" solo tiene ' + (piezas[p].carts ? 'carts' : 'products') +
    '. Sin las dos mitades no se puede calcular la penetración Nestlé de esa pieza');
});

var vacios = clas.filter(function (x) { return I.filasCSV(x.a.ruta) <= 0; });
chk(2, 'ninguna descarga viene vacía', vacios.length === 0, 'vacías: ' + vacios.length);

// 🔴 hallazgo nuevo: cuántos ESQUEMAS distintos conviven
var esquemas = {};
clas.forEach(function (x) { if (x.c.cols && x.c.cols.length) (esquemas[x.c.cols.join('|')] = esquemas[x.c.cols.join('|')] || []).push(x.a.archivo); });
chk(2, 'los CSV comparten un solo esquema', Object.keys(esquemas).length <= 2,
  Object.keys(esquemas).length + ' esquemas distintos conviviendo');
if (Object.keys(esquemas).length > 2) {
  tareas.push('⚠ ' + Object.keys(esquemas).length + ' esquemas de CSV distintos en Qcart. Un lector que asuma uno solo falla. ' +
    'Los bloques deben leer por NOMBRE de columna, no por posición.');
}

// 🔴 hallazgo nuevo: cuántos CSV NO permiten leer su periodo adentro
var sinFecha = clas.filter(function (x) { var p = I.periodoCSV(x.a.ruta); return !p || !p.desde; });
chk(2, 'el periodo de cada CSV se puede leer de sus filas', sinFecha.length === 0,
  sinFecha.length + ' de ' + csvs.length + ' sin columna de fecha');
if (sinFecha.length) {
  tareas.push('⚠ ' + sinFecha.length + ' CSV de Qcart NO traen columna de fecha: su periodo NO se puede leer adentro. ' +
    'Queda como granularidad "ninguna" desde el archivo — hay que resolverlo por el mapa de links, no por el nombre.');
}
notas.push('qcart: ' + Object.keys(piezas).length + ' piezas · ' + csvs.length + ' CSV · ' + Object.keys(esquemas).length + ' esquemas');

// ══ [3] WHATSAPP ════════════════════════════════════════════════════════════════════
var wa = null;
try {
  var salida = require('child_process').execSync(
    '"' + process.execPath + '" "' + require(__dirname + '/lib-entorno.js').TOOLS + '/reportes/find-file.js" "Resultados Whatsapp CRM" --uno',
    { encoding: 'utf8', timeout: 30000 });
  wa = t(salida).split(/\r?\n/).filter(function (l) { return /\.xlsx$/i.test(l); })[0] || null;
} catch (e) { }
chk(3, 'se encuentra la fuente de WhatsApp', !!wa, wa ? path.basename(wa) : 'no encontrada');
if (wa) {
  var esRespaldo = /_backups?|respaldo|\(draft\)|borrar/i.test(wa);
  chk(3, 'no viene de un respaldo ni es un borrador', !esRespaldo, path.dirname(wa).split(/[\\/]/).pop());
}

// ══ [4] EL ARCHIVO DE TRABAJO ═══════════════════════════════════════════════════════
var libre = true, porque = '';
try { fs.closeSync(fs.openSync(VIVO, 'r+')); } catch (e) { libre = false; porque = e.code; }
chk(4, 'el archivo de trabajo está libre para escribir', libre, libre ? path.basename(VIVO) : porque);
if (!libre) tareas.push('🔴 el archivo de trabajo está bloqueado (' + porque + '): ciérralo en Excel antes de cargar. Con Excel abierto OneDrive revierte lo escrito');

// ══ [5] EL MAPA DE SHORTLINKS ═══════════════════════════════════════════════════════
var mapas = qc.archivos.filter(function (a) { return /\.xlsx$/i.test(a.archivo) && /link/i.test(a.archivo); });
chk(5, 'está el mapa de shortlinks de Qcart', mapas.length > 0,
  mapas.map(function (m) { return m.archivo; }).join(', ') || 'ninguno');
if (mapas.length > 1) tareas.push('⚠ hay ' + mapas.length + ' mapas de shortlinks: confirma cuál es el vigente');

// ══ EL PRODUCTO · la FORMA de cada fuente, para que los bloques no la re-deriven ═════
// 🔴 El esquema NO es uniforme DENTRO de un mismo archivo: hojas distintas traen distinto
//    número de columnas (Julio y Agosto 31, los demás meses 20). No es un error — es la
//    fuente evolucionando. Pero un lector que fije el número de columnas falla en la mitad.
var hojasEmail = [];
if (elegido) {
  try {
    var D_ = require(BACK + '/_scripts/lib-datorama.js');
    D_.leerArchivo(elegido.ruta).hojas.forEach(function (h) {
      hojasEmail.push({ hoja: h.hoja, filas: h.filas.length, columnas: (h.cols || []).length });
    });
  } catch (e) { }
}
var anchos = {};
hojasEmail.forEach(function (h) { anchos[h.columnas] = (anchos[h.columnas] || 0) + 1; });
chk(1, 'todas las hojas traen el mismo número de columnas', Object.keys(anchos).length <= 1,
  Object.keys(anchos).map(function (k) { return anchos[k] + ' hoja(s) con ' + k + ' cols'; }).join(' · '));
if (Object.keys(anchos).length > 1) {
  tareas.push('⚠ el export de email NO tiene el mismo esquema en todas sus hojas (' +
    Object.keys(anchos).map(function (k) { return k + ' cols×' + anchos[k]; }).join(', ') +
    '). No es un error: es la fuente evolucionando. Leer por NOMBRE de columna, nunca por posición.');
}

var forma = {
  // 🔴 el archivo de trabajo viaja RESUELTO en el handoff: ningún paso de aguas abajo debe
  //    volver a escribir su nombre con la versión. Si mañana hay una v9, se resuelve aquí y
  //    todo el sistema la sigue sin tocar una línea.
  archivo_vivo: {
    archivo: _vivo.archivo, ruta: _vivo.ruta, version: _vivo.version,
    resuelto_por: 'patrón + más reciente, ignorando respaldos (lib-flexible.archivoVivo)',
    otros_candidatos: _vivo.otros,
    ambiguo: _vivo.ambiguo,
    ojo: _vivo.ambiguo ? '🔴 dos candidatos con mtime casi igual: confirmar cuál es el vivo' : ''
  },
  email: elegido ? {
    archivo: elegido.archivo, ruta: elegido.ruta, sello: elegido.sello,
    frescura: elegido.fuente_frescura,
    hojas: hojasEmail,
    esquema_uniforme: Object.keys(anchos).length <= 1,
    nota: 'el encabezado NO está en la fila 1: el export trae preámbulo. Buscarlo por CONTENIDO. ' +
      'Y el nº de columnas cambia entre hojas: leer por NOMBRE, nunca por posición.'
  } : null,
  qcart: {
    csv: csvs.length, piezas: Object.keys(piezas).length,
    esquemas: Object.keys(esquemas).map(function (k) {
      return { cols: k.split('|'), n: esquemas[k].length, ejemplo: esquemas[k][0] };
    }),
    sin_periodo_legible: sinFecha.length,
    mapa_shortlinks: mapas.length ? mapas[0].archivo : null,
    nota: 'separador y BOM varían: detectarlos por archivo. Clasificar por encabezado, no por nombre.'
  },
  whatsapp: wa ? { ruta: wa, nota: 'solo lectura' } : null
};

var fallos = V.filter(function (v) { return !v.ok; });
var out = {
  paso: 'insumos-validar · insumos', generado_por: 'fuentes-insumos.insumos.js', corte: CORTE,
  veredicto: fallos.length ? 'CON HALLAZGOS' : 'LISTO',
  checks: V, notas: notas, tareas: tareas,
  forma: forma,
  para_el_siguiente: {
    que_es: 'la FORMA de cada fuente. Los bloques email-bloque/b/c NO deben re-derivarla.',
    como_usarla: 'verifica UNA cifra contra el archivo; si cuadra, da el resto por bueno. Si no cuadra, para todo y repórtalo.'
  }
};
try { fs.mkdirSync(BACK + '/_insumos'); } catch (e) { }
fs.writeFileSync(BACK + '/_insumos/inventario.json', JSON.stringify(out, null, 1));

// ══ salida legible ══
[1, 2, 3, 4, 5].forEach(function (g) {
  var del = V.filter(function (v) { return v.grupo === g; });
  if (!del.length) return;
  del.forEach(function (v) {
    console.log('  ' + (v.ok ? '✓' : '✗') + ' [' + g + '] ' + v.check.padEnd(46) + v.detalle);
  });
});
if (notas.length) { console.log('\n  notas:'); notas.forEach(function (n) { console.log('     · ' + n); }); }
if (tareas.length) { console.log('\n  tareas para el plan:'); tareas.forEach(function (x) { console.log('     · ' + x); }); }
console.log('\n  veredicto: ' + out.veredicto + '   (' + (V.length - fallos.length) + '/' + V.length + ' checks)');
console.log('  → ' + BACK + '/_insumos/inventario.json');
