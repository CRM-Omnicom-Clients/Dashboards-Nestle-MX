// qcart-bloque · BLOQUE QCART — arma DOS bloques de eventos en el backend. NO escribe el Excel.
//
// 🔴 LO QUE ESTE SCRIPT NO HACE: calcular. Ni penetración, ni tickets, ni tops, ni tasas.
//    `Data_Qcart` mezclaba dos granularidades en una fila (carrito y producto) y por eso tenía
//    que agregar; y encima derivaba 5 columnas que son de motor-calculo. Aquí se separan las dos cosas y
//    el dato queda crudo. Sumar para CUADRAR sí; derivar una métrica de negocio, no.
//
// El modelo es de LOGS, no de refresh: cada fila es un evento con su fecha-hora, así que
// actualizar es **agregar los que no estaban**. Lo ya cargado no se toca nunca.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var C = require(__dirname + '/lib-qcart.js');
var F = require(__dirname + '/lib-qcart-filtro.js');
var Q = require(__dirname + '/lib-qcart-links.js');
var L = require(__dirname + '/lib-flexible.js');
var CB = require(__dirname + '/lib-cambios.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = F.t;
function mil(n) { return Number(n).toLocaleString('es-MX'); }

console.log('════════ qcart-bloque · BLOQUE QCART ════════\n');

// ══ 1 · LOS ARCHIVOS VIGENTES ═══════════════════════════════════════════════════════
var DIR = PROY + '/ReportesQcart/_vigentes';
var R = C.leerVigentes(DIR);
console.log('  carpeta vigente: ReportesQcart/_vigentes');
R.archivos.forEach(function (a) {
  console.log('     ' + a.archivo.padEnd(32) + a.tipo.padEnd(11) + String(mil(a.filas)).padStart(6) + ' filas   ' + a.desde + ' → ' + a.hasta);
});
R.avisos.forEach(function (v) { console.log('     ' + v); });
if (!R.carritos.length && !R.productos.length) {
  console.log('\n  🔴 no hay nada que cargar. Deja las descargas en _vigentes/ y vuelve a correr.');
  process.exit(1);
}

// ══ 2 · EL FILTRO — solo lo nuestro, y solo desde su activación ═════════════════════
var pad = F.padron();
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2b.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
// 🔴 el catálogo que vale es el FUTURO, no el del disco. Mientras el lote de cambios no se
//    escribe, la hoja sigue diciendo lo viejo: A2 movió los links de Liga MX a E-J4 y A6b sacó
//    los que la autoridad no declara. Construir el mapa contra el disco colgaría tráfico de
//    piezas que ya no lo tienen.
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));
var codPieza = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { codPieza[c] = t(p['Pieza_ID']); });
  });
});

var fCar = F.aplicar(R.carritos, pad, codPieza);
var fPro = F.aplicar(R.productos, pad, codPieza);
console.log('\n  ── el filtro (las dos reglas de pertenencia)');
[['carritos', fCar], ['productos', fPro]].forEach(function (x) {
  var s = x[1].resumen;
  console.log('     ' + x[0].padEnd(10) + mil(s.dentro).padStart(6) + ' entran de ' + mil(s.total) +
    '   fuera: ' + mil(s.fuera_no_es_nuestro) + ' ajenos · ' + mil(s.fuera_excluido || 0) + ' excluidos por contrato · ' +
    mil(s.fuera_antes_de_activacion) + ' antes de activar · ' +
    mil(s.fuera_link_invalido) + ' link no enviado · ' + mil(s.fuera_sin_codigo) + ' sin código' +
    (s.cuadra ? '   ✔ cuadra' : '   🔴 NO CUADRA'));
});

// ══ 3 · EL APPEND — lo que ya estaba no se toca ═════════════════════════════════════
// 🔴 Aquí NO hay refresh: un evento pasado no cambia. Se agregan los que no estaban, por su
//    llave. Correr el script dos veces con el mismo archivo no debe mover una sola cifra.
// 🔴 `--rebuild` — el append vale mientras la REGLA no cambie. Cuando cambia (el padrón
//    incorporó dos hojas nuevas, el catálogo movió códigos), lo cargado se admitió bajo un
//    criterio que ya no existe y hay que re-evaluarlo desde la fuente. Se declara qué cambió.
var REBUILD = process.argv.indexOf('--rebuild') >= 0;
var prev = { carritos: [], productos: [] };
try { prev = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8')); } catch (e) { }
prev.carritos = prev.carritos || []; prev.productos = prev.productos || [];
var ANTES = { carritos: prev.carritos.length, productos: prev.productos.length };
if (REBUILD) {
  // 🔴 `--rebuild` DESTRUYE HISTORIA SI LOS CSV YA NO LA CUBREN (3-sep-2026). El bloque tenía
  //    2,765 carritos desde marzo; Rick dejó en `_vigentes` solo la descarga de **04-ago → 03-sep**
  //    y el rebuild lo dejó en **331**. No falló nada: reconstruyó exactamente lo que había, y lo
  //    que había era un mes. Marzo a julio desapareció sin un solo error en pantalla.
  //    El bloque es un LOG: lo cargado no se toca. `--rebuild` existe solo para cuando cambia la
  //    REGLA de pertenencia, no para cuando cambian los archivos — y ahí los CSV tienen que
  //    cubrir al menos lo mismo que ya estaba cargado.
  var desdeCargado = prev.carritos.map(function (e) { return t(e.fecha); }).filter(Boolean).sort()[0];
  var desdeCsv = R.archivos.map(function (a) { return t(a.desde); }).filter(Boolean).sort()[0];
  if (desdeCargado && desdeCsv && desdeCsv > desdeCargado) {
    console.log('\n  🔴 REBUILD BLOQUEADO — los CSV no cubren lo que ya está cargado.');
    console.log('     el bloque arranca en ' + desdeCargado + ' y el CSV más antiguo en ' + desdeCsv + ':');
    console.log('     reconstruir tiraría ' + mil(prev.carritos.filter(function (e) { return t(e.fecha) < desdeCsv; }).length) +
      ' carrito(s) anteriores a esa fecha, sin error y sin aviso.');
    console.log('     Corre SIN `--rebuild` para agregar lo nuevo, o repón los CSV del periodo completo.');
    process.exit(1);
  }
  console.log('\n  ↺ REBUILD — el bloque se reconstruye desde los CSV. Tenía ' +
    mil(ANTES.carritos) + ' carritos y ' + mil(ANTES.productos) + ' productos.');
  console.log('     los CSV cubren desde ' + (desdeCsv || '?') + ' y lo cargado arrancaba en ' + (desdeCargado || '?') + ' ✔');
  prev.carritos = []; prev.productos = [];
}

function fusionar(cargados, llegando) {
  var idx = {}, nuevos = [], repetidos = 0;
  cargados.forEach(function (e) { idx[C.llaveEvento(e)] = 1; });
  llegando.forEach(function (e) {
    var k = C.llaveEvento(e);
    if (idx[k]) { repetidos++; return; }
    idx[k] = 1; nuevos.push(e);
  });
  return { bloque: cargados.concat(nuevos), nuevos: nuevos.length, repetidos: repetidos, ya_estaban: cargados.length };
}
var mCar = fusionar(prev.carritos, fCar.dentro);
var mPro = fusionar(prev.productos, fPro.dentro);

console.log('\n  ── el append (son logs: nada de lo cargado se toca)');
[['carritos', mCar], ['productos', mPro]].forEach(function (x) {
  var m = x[1];
  console.log('     ' + x[0].padEnd(10) + 'ya estaban ' + String(mil(m.ya_estaban)).padStart(6) +
    '   nuevos ' + String(mil(m.nuevos)).padStart(6) + '   repetidos (se ignoran) ' + String(mil(m.repetidos)).padStart(6) +
    '   → ' + mil(m.bloque.length));
  var cuadra = m.ya_estaban + m.nuevos === m.bloque.length;
  console.log('     ' + (cuadra ? '           ✔ cuadra: ' : '           🔴 NO cuadra: ') + mil(m.ya_estaban) + ' + ' + mil(m.nuevos) + ' = ' + mil(m.bloque.length));
});

// ══ 4 · LO QUE EL CATÁLOGO NO CONOCE ════════════════════════════════════════════════
// Igual que en email: lo nuevo se declara, no se descarta.
var vocab = {};
fCar.fuera.concat(fPro.fuera).forEach(function (e) {
  if (!/no está en nuestro catálogo/.test(e.motivo_exclusion)) return;
  var k = e.utm_campaign || '(sin campaña)';
  vocab[k] = vocab[k] || { campana: k, eventos: 0, shortlinks: {} };
  vocab[k].eventos++; vocab[k].shortlinks[e.shortlink_code] = 1;
});
var vocabL = Object.keys(vocab).map(function (k) {
  return { campana: k, eventos: vocab[k].eventos, shortlinks: Object.keys(vocab[k].shortlinks).length };
}).sort(function (a, b) { return b.eventos - a.eventos; });
console.log('\n  ── vocabulario nuevo: shortlinks con tráfico que el catálogo no conoce');
console.log('     ' + vocabL.length + ' campañas · ' + mil(vocabL.reduce(function (a, x) { return a + x.eventos; }, 0)) + ' eventos');
vocabL.slice(0, 6).forEach(function (x) {
  console.log('        ' + String(mil(x.eventos)).padStart(5) + ' eventos · ' + String(x.shortlinks).padStart(3) + ' links · ' + x.campana.slice(0, 44));
});

// ══ 5 · SALIDA ══════════════════════════════════════════════════════════════════════
function resumenPorPieza(bloque) {
  var g = {};
  bloque.forEach(function (e) {
    var k = e.pieza_id || '(sin pieza)';
    g[k] = g[k] || { pieza_id: k, eventos: 0, views: 0, desde: null, hasta: null };
    g[k].eventos++; g[k].views += e.views;                       // suma para CUADRAR, no métrica
    if (!g[k].desde || e.fecha < g[k].desde) g[k].desde = e.fecha;
    if (!g[k].hasta || e.fecha > g[k].hasta) g[k].hasta = e.fecha;
  });
  return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.eventos - a.eventos; });
}

// ══ LAS CUATRO CANÓNICAS, con la MISMA librería que las demás fuentes ═══════════════
// 🔴 La regla de Rick (20-ago-2026): los canónicos deben coincidir EXACTAMENTE entre todas las
//    hojas de datos. Eso solo es cierto si una sola función los resuelve. Si cada fuente
//    resolviera por su cuenta, el mismo `pieza_id` podría salir con `Segmento` distinto en dos
//    hojas y nada lo detectaría — cada script se valida contra sí mismo.
//    Aquí es directo: el evento ya trae su `pieza_id`, así que hereda las cuatro de su pieza.
(function () {
  var CAN = require(BACK + '/_scripts/lib-canonico.js');
  var XL = require('xlsx');
  var TT = require('path').resolve(__dirname, '..') + '/_tmp/_n2bcan.xlsx';
  require('fs').copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TT);
  var wbc = XL.readFile(TT);
  var IXP = CAN.indexarPiezas(CB.vistaFutura('Catalogo_Piezas', XL.utils.sheet_to_json(wbc.Sheets['Catalogo_Piezas'] || {}, { defval: '', blankrows: false })));
  var IXA = null;
  var vias = {}, con4 = 0, total = 0;
  [mCar.bloque, mPro.bloque].forEach(function (arr) {
    arr.forEach(function (e) {
      total++;
      var r = CAN.resolver(IXP, IXA, e);
      e.bu_canonico = r.bu; e.marca_canonica = r.marca;
      e.campana_canonica = r.campana; e.segmento_canonico = r.segmento;
      e.canonico_via = r.via;
      // 🔴 UN DATO SIN ANCLA TIENE QUE TRAER SU MOTIVO, o la Puerta 1 lo cuenta como huerfano
      //    mudo y cierra -con razon: un dato sin explicacion no se puede escribir en ninguna hoja.
      //    Aqui el motivo se sabe con precision: el link SI es nuestro (paso el padron, si no no
      //    estaria en el bloque) pero ninguna pieza del catalogo declara su codigo. Es decir: el
      //    envio existe y la pieza no. Eso se arregla en el catalogo, no escondiendolo.
      if (!e.pieza_id) {
        e.motivo_sin_pieza = 'el link es nuestro (padron: ' + (e.link_campana || e.utm_campaign || '?') +
          ') pero ninguna pieza del catalogo declara su codigo ' + (e.shortlink_code || '?');
      }
      vias[r.via] = (vias[r.via] || 0) + 1;
      if (r.bu && r.marca && r.campana && r.segmento) con4++;
    });
  });
  console.log('\n  ── las 4 canónicas (misma librería que email y whatsapp)');
  Object.keys(vias).sort().forEach(function (v) { console.log('     ' + String(vias[v]).padStart(5) + '  ' + v); });
  console.log('     ── con las cuatro: ' + con4 + ' de ' + total);
})();

var out = {
  paso: 'qcart-bloque · bloque qcart', generado_por: 'fuentes-qcart.qcart.js',
  modelo: 'LOGS · append por llave de evento. Lo ya cargado no se toca: un evento pasado no cambia.',
  no_calcula: 'penetración, tickets, tops, tasas y promedios son de motor-calculo. Aquí solo se suma para cuadrar.',
  fuente: { carpeta: 'ReportesQcart/_vigentes', archivos: R.archivos },
  reglas: {
    pertenencia: 'el shortlink debe estar en el catálogo de links (autoridad: ' + pad.fuente + ')',
    ventana: 'solo eventos desde la fecha de activación de ESE link',
    unidad: 'el LINK, no la pieza: una pieza puede tener varios envíos con links distintos',
    excepcion: 'si la fecha del link contradice a su hoja del doc, NO se aplica la ventana y se marca — recortar por un typo borra tráfico bueno'
  },
  carritos: mCar.bloque,
  productos: mPro.bloque,
  vocabulario_nuevo: vocabL,
  excluidos: {
    carritos: fCar.fuera.length, productos: fPro.fuera.length,
    // se guarda una muestra con motivo; el conteo completo va en auditoría
    muestra: fCar.fuera.slice(0, 40).concat(fPro.fuera.slice(0, 20)).map(function (e) {
      return { fecha: e.fecha, shortlink: e.shortlink_code, campana: e.utm_campaign, motivo: e.motivo_exclusion };
    })
  },
  auditoria: {
    carritos: fCar.resumen, productos: fPro.resumen,
    append: { carritos: { ya_estaban: mCar.ya_estaban, nuevos: mCar.nuevos, repetidos: mCar.repetidos, total: mCar.bloque.length },
      productos: { ya_estaban: mPro.ya_estaban, nuevos: mPro.nuevos, repetidos: mPro.repetidos, total: mPro.bloque.length } },
    cuadre: fCar.resumen.cuadra && fPro.resumen.cuadra &&
      (mCar.ya_estaban + mCar.nuevos === mCar.bloque.length) && (mPro.ya_estaban + mPro.nuevos === mPro.bloque.length),
    piezas_con_carritos: resumenPorPieza(mCar.bloque).length,
    piezas_con_productos: resumenPorPieza(mPro.bloque).length
  },
  por_pieza: { carritos: resumenPorPieza(mCar.bloque), productos: resumenPorPieza(mPro.bloque) },
  para_el_siguiente: {
    que_es: 'dos bloques de eventos, anclados al catálogo por pieza_id',
    dos_hojas: ['Data_Qcart_Carritos', 'Data_Qcart_Productos'],
    ancla: 'pieza_id — el mismo que usa el bloque de email, así las tres hojas hablan del mismo objeto',
    ojo: 'ninguna columna calculada. motor-calculo deriva penetración cruzando los dos bloques por pieza_id'
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(out, null, 1));

console.log('\n  ── los dos bloques');
console.log('     Data_Qcart_Carritos   ' + String(mil(mCar.bloque.length)).padStart(6) + ' eventos · ' + out.auditoria.piezas_con_carritos + ' piezas');
console.log('     Data_Qcart_Productos  ' + String(mil(mPro.bloque.length)).padStart(6) + ' eventos · ' + out.auditoria.piezas_con_productos + ' piezas');
console.log('     ' + (out.auditoria.cuadre ? '✔ todo cuadra' : '🔴 algo no cuadra'));
console.log('\n  → ' + BACK + '/_fuentes/qcart.json');
console.log('  ⚠ el Excel NO se tocó. Las dos hojas las escribe la Puerta 1.');
