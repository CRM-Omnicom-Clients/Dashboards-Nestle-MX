// resumen-regenerar · ¿EL REPORTE DICE LO QUE DICE LA REJILLA? Se relee la HOJA en disco, no la memoria.
//
// 🔴 «Lo escribí» y «quedó bien» son cosas distintas. Todo lo de aquí sale de volver a abrir
//    `Report_Resumen` y compararla celda a celda contra `rejilla.json`, que resumen-regenerar no escribió.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';   // el ámbito de este skill dentro del catálogo raíz
var EQX = require(__dirname + '/lib-esquema.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var REG = require(__dirname + '/lib-registro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ resumen-regenerar · ¿EL REPORTE QUEDÓ BIEN? ════════\n');
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n6v.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var Ftodo = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
// 🔴 LA FILA DE TOTALES NO ES UNA FILA DE DATOS, Y SUMARLA CON ELLAS CUENTA TODO DOS VECES.
//    Pasó en cuanto la fila de totales dejó de estar vacía: `Σ Carritos_Total` saltó a 5,290
//    cuando la rejilla dice 2,645 — exactamente el doble. Antes «pasaba» solo porque la fila no
//    tenía valores; el check llevaba corridas midiendo con un cero de regalo.
//    ⚠ Se EXCLUYE de las sumas, pero NO se deja de mirar: se cuenta aparte y se comprueba que sea
//      exactamente una. Excluir una fila de la comparación no es dejar de mirarla — así fue como
//      una puerta dejó pasar 66,204 duplicados.
var esTotal = function (f) { return /^total$/i.test(String(f['Campaña'] == null ? '' : f['Campaña']).trim()); };
var totales = Ftodo.filter(esTotal);
var F = Ftodo.filter(function (f) { return !esTotal(f); });
chk('hay exactamente UNA fila de totales, y va al final', totales.length === 1 && esTotal(Ftodo[Ftodo.length - 1]),
  totales.length === 1 && esTotal(Ftodo[Ftodo.length - 1])
    ? 'fila ' + (Ftodo.length + 1) + ', la última'
    : '🔴 ' + totales.length + ' fila(s) «Total»' + (esTotal(Ftodo[Ftodo.length - 1]) ? '' : ' y la última NO es la de totales'));
console.log('  hoja: ' + F.length + ' filas de datos (+' + totales.length + ' de totales)   ·   rejilla: ' + R.rejilla.length + ' celdas\n');

// ══ 1 · UNA FILA POR CELDA, NI UNA MÁS ══════════════════════════════════════════════
// 🔴 LA FILA DE TOTALES NO ES UNA CELDA DE LA REJILLA. El check comparaba la hoja entera contra la
//    rejilla y reportaba «77 vs 76»: la de más era la de totales, que Rick pidió expresamente al
//    final. Se compara contra las filas de DATOS.
var Fdatos = F.filter(function (x) {
  var c = String(x['Campaña'] || '').trim();
  return c && !/^total/i.test(c);
});
chk('la hoja tiene exactamente una fila por celda de la rejilla', Fdatos.length === R.rejilla.length,
  Fdatos.length + ' filas de datos vs ' + R.rejilla.length + ' celdas' +
  (F.length !== Fdatos.length ? '   (+' + (F.length - Fdatos.length) + ' de totales)' : ''));

// el cruce por las cinco dimensiones que definen la fila
// 🔴 EL NOMBRE DE LA QUINCENA SE LE PIDE AL REGISTRO, no se adivina con una lista de variantes.
//    `EQX.campo(x,'Quincena','Quincena_Lanzamiento')` era una lista escrita a mano, y en cuanto la
//    hoja pasó a `Quincena_Lanzamiento Principal` dejó de resolver: la llave salía sin quincena y
//    este check reportó **las 76 celdas de la rejilla como «sin escribir»** — mientras el check de
//    al lado comprobaba 912 cifras y las daba todas por buenas. Dos checks del mismo paso
//    contradiciéndose es la señal de que uno lee un nombre que ya no existe.
var COL_QUINCENA = (function () {
  var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || [])
    .map(function (x) { return String(x == null ? '' : x).trim(); });
  try { return REG.abrir('resumen', enc).n('resumen.quincena_lanzamiento'); }
  catch (e) { console.log('  🔴 el registro no resuelve `resumen.quincena_lanzamiento`: ' + e.message); process.exit(1); }
})();
function llave(x, esHoja) {
  return [t(esHoja ? x['Campaña'] : x.campana), t(esHoja ? x['Objetivo'] : x.objetivo),
  t(esHoja ? x['TouchPoint'] : x.touchpoint), t(esHoja ? x['Segmento'] : x.segmento),
  t(esHoja ? x[COL_QUINCENA] : x.quincena)].join('¦');
}
var enHoja = {}; F.forEach(function (x) { enHoja[llave(x, true)] = x; });
var sinPareja = R.rejilla.filter(function (c) { return !enHoja[llave(c, false)]; });
chk('toda celda de la rejilla está en la hoja', sinPareja.length === 0,
  sinPareja.length ? '🔴 ' + sinPareja.length + ' sin escribir: ' + sinPareja.slice(0, 3).map(function (c) { return c.campana + '/' + c.quincena; }).join(' · ')
    : 'las ' + R.rejilla.length);

// ══ 2 · LAS CIFRAS COINCIDEN, CELDA A CELDA ═════════════════════════════════════════
console.log('══ 2 · las cifras, una por una ══');
var difs = [];
R.rejilla.forEach(function (c) {
  var f = enHoja[llave(c, false)]; if (!f) return;
  [['Principal_Sends', c.principal.sends], ['Principal_Deliveries', c.principal.deliveries],
  ['Principal_Opens', c.principal.opens], ['Principal_Clicks', c.principal.clicks],
  ['FUP_Sends', c.fup.sends], ['FUP_Deliveries', c.fup.deliveries],
  ['Tot_Sends', c.total.sends], ['Tot_Deliveries', c.total.deliveries],
  ['Tot_Opens', c.total.opens], ['Tot_Clicks', c.total.clicks],
  ['WA-Envíos', c.whatsapp.sends], ['WA-Leídos', c.whatsapp.read]].forEach(function (par) {
    var enF = num(f[par[0]]) || 0, enR = par[1] || 0;
    if (enF !== enR) difs.push({ celda: c.campana + '/' + c.quincena + '/' + c.touchpoint, columna: par[0], hoja: enF, rejilla: enR });
  });
});
chk('🔴 toda cifra de la hoja es la de la rejilla', difs.length === 0,
  difs.length ? '🔴 ' + difs.length + ' difieren' : (R.rejilla.length * 12) + ' comprobaciones');
difs.slice(0, 6).forEach(function (d) { console.log('     🔴 ' + d.celda + ' · ' + d.columna + ': hoja ' + mil(d.hoja) + ' vs rejilla ' + mil(d.rejilla)); });
if (!difs.length) console.log('     ✔ ' + (R.rejilla.length * 12) + ' cifras comprobadas una por una');

// ══ 3 · LA SUMA DE LA COLUMNA NO CUENTA DOS VECES ══════════════════════════════════
console.log('\n══ 3 · sumar la columna de Qcart no puede contar doble ══');
var carritosHoja = F.reduce(function (a, x) { return a + (num(x['Carritos_Total']) || 0); }, 0);
var carritosRejilla = R.rejilla.reduce(function (a, c) { return a + (c.qcart ? c.qcart.carritos : 0); }, 0);
chk('🔴 Σ Carritos_Total = Σ de la rejilla (el anclaje evita el doble conteo)',
  carritosHoja === carritosRejilla, mil(carritosHoja) + ' = ' + mil(carritosRejilla));
// 🔴 `QCART?` DICE Sí/No Y NADA MÁS — decisión de Rick (D1). Este check exigía la remisión
//    «— ver Qx» dentro de esa misma columna, que era el modelo viejo: la columna mezclaba el hecho
//    («¿tiene Qcart?») con la remisión («está contado en otra quincena»). Ahora la remisión vive en
//    `Qcart_Ancla` y `QCART?` responde una sola pregunta. Se valida eso.
var conSi = F.filter(function (x) { return t(x['QCART?']) === 'Sí'; }).length;
var conNo = F.filter(function (x) { return t(x['QCART?']) === 'No'; }).length;
var otros = Fdatos.filter(function (x) { return ['Sí', 'No'].indexOf(t(x['QCART?'])) < 0; });
chk('«QCART?» solo dice Sí o No', otros.length === 0,
  conSi + ' Sí · ' + conNo + ' No' + (otros.length ? '   🔴 ' + otros.length + ' con otro valor: ' +
    otros.slice(0, 3).map(function (x) { return '«' + t(x['QCART?']) + '»'; }).join(', ') : ''));
// y el «Sí» tiene que corresponder con las celdas que de verdad traen carritos
var celdasConQ = R.rejilla.filter(function (c) { return c.qcart && c.qcart.carritos > 0; }).length;
chk('cada «Sí» corresponde a una celda con carritos', conSi === celdasConQ,
  conSi + ' filas dicen Sí · ' + celdasConQ + ' celdas traen carritos');

// ══ 4 · LO QUE NO SE PISA ═══════════════════════════════════════════════════════════
console.log('\n══ 4 · lo que resumen-regenerar NO debe tocar ══');
var canon = ['Campaña', 'Objetivo', 'TouchPoint', 'Segmento', 'Quincena_Lanzamiento', 'BU', 'Marca'];
chk('las dimensiones vienen del catálogo, no del crudo',
  F.filter(function (x) { return t(x['BU']) || t(x['Marca']); }).length > 0,
  F.filter(function (x) { return t(x['BU']); }).length + ' filas con BU · ' +
  F.filter(function (x) { return t(x['Marca']); }).length + ' con Marca');
// 🔴 la columna Insights es de insights-redactar: resumen-regenerar la conserva, no la escribe ni la borra
chk('la columna Insights existe y resumen-regenerar no la inventó',
  Object.keys(F[0] || {}).indexOf('Insights') >= 0 || F.every(function (x) { return !t(x['Insights']); }),
  F.filter(function (x) { return t(x['Insights']); }).length + ' con insight (los escribe insights-redactar)');

// ══ 5 · LAS FILAS SIN RESOLVER VAN APARTE ══════════════════════════════════════════
var sinResolver = R.rejilla.filter(function (c) { return !c.campana_del_catalogo; });
if (sinResolver.length) {
  var posiciones = sinResolver.map(function (c) {
    return F.findIndex(function (x) { return llave(x, true) === llave(c, false); });
  }).filter(function (i) { return i >= 0; });
  var primeraSinResolver = Math.min.apply(null, posiciones);
  var ultimaResuelta = Math.max.apply(null, R.rejilla.filter(function (c) { return c.campana_del_catalogo; })
    .map(function (c) { return F.findIndex(function (x) { return llave(x, true) === llave(c, false); }); }));
  chk('🔴 las filas SIN RESOLVER van al final, no mezcladas',
    primeraSinResolver > ultimaResuelta,
    primeraSinResolver > ultimaResuelta
      ? sinResolver.length + ' filas sin pieza, todas después de las ' + (R.rejilla.length - sinResolver.length) + ' atribuidas'
      : '🔴 hay filas sin resolver entremezcladas con las atribuidas');
}

// ── LOS DATOS ───────────────────────────────────────────────────────────────────────
dato('todas las filas del reporte están atribuidas', sinResolver.length === 0,
  sinResolver.length + ' filas de envíos sin pieza en el catálogo');
dato('todas las filas traen su asunto',
  F.every(function (x) { return t(x['P_Subject']) || t(x['FUP_Subject']); }),
  F.filter(function (x) { return !t(x['P_Subject']) && !t(x['FUP_Subject']); }).length + ' sin asunto en Data_Email');
dato('el reporte ya tiene sus insights', F.some(function (x) { return t(x['Insights']); }),
  F.filter(function (x) { return t(x['Insights']); }).length + ' de ' + F.length + ' — los escribe insights-redactar');

// 🔴 UNA COLUMNA QUE EL REPORTE DEBE LLENAR Y SALE 100% VACÍA. Ninguna suma la ve: si el valor
//    cae en una columna que no existe, todos los totales siguen cuadrando y el reporte cierra en
//    verde. Pasó con `Audiencia_DE SFMC` y `Audiencia_Volumen SFMC`: la rejilla traía la audiencia
//    de 95 de 98 envíos, la librería la escribía con el nombre corto —una columna inexistente— y
//    el reporte mostraba 0 de 77 durante corridas enteras. Lo enseñó el render.
//    Se compara contra la REJILLA: solo se exige la columna cuyo dato la rejilla sí tiene.
(function () {
  var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || [])
    .map(function (x) { return String(x || '').trim(); });
  // qué campo de la rejilla alimenta cada columna que se quiere vigilar
  //    ⚠ SOLO LO QUE ESTE SCRIPT ESCRIBE. La primera versión también exigía `Insights`, y eso está
  //      mal por una razón que importa: la llena insights-redactar, que corre DESPUÉS de este validador. El
  //      check fallaba siempre, en un dato que en ese momento nadie tenía por qué haber escrito.
  //      Un check que mide el trabajo de otro paso no prueba nada y enseña a ignorar el rojo.
  //      Que `Insights` se llene lo comprueba PUERTA-2, con la hoja ya terminada.
  var VIGILA = {
    'Audiencia_DE SFMC': function (c) { return Object.keys(c.audiencias || {}).length || c.audiencia_de; },
    'Audiencia_Volumen SFMC': function (c) { return c.audiencia_volumen; }
  };
  var vacias = [];
  Object.keys(VIGILA).forEach(function (nom) {
    if (enc.indexOf(nom) < 0) { vacias.push(nom + ' (la columna NO EXISTE en la hoja)'); return; }
    var conDato = F.filter(function (f) { return String(f[nom] == null ? '' : f[nom]).trim(); }).length;
    if (conDato > 0) return;
    var fn = VIGILA[nom];
    var enRejilla = fn ? (R.rejilla || []).filter(function (c) { return fn(c); }).length : 0;
    if (!fn) { vacias.push(nom + ' (0 de ' + F.length + ' filas)'); return; }
    if (enRejilla > 0) vacias.push(nom + ' (0 de ' + F.length + ' filas, y la rejilla tiene el dato en ' + enRejilla + ')');
  });
  chk('ninguna columna que el reporte llena sale 100% vacía', vacias.length === 0,
    vacias.length ? '🔴 ' + vacias.join(' · ') : 'las columnas vigiladas traen dato');

  // 🔴 EL BARRIDO · NINGUNA COLUMNA CON DATO HOY PUEDE QUEDARSE SIN LLENAR MAÑANA.
  //    La lista `VIGILA` de arriba solo mira dos columnas — vigila lo que ya mordió. Este check
  //    no tiene lista: pregunta por las 82 columnas de la hoja, con su NOMBRE REAL, si el mapeo
  //    sabe llenarlas. Es el defecto «0 y 0»: la hoja se llama de una forma, el mapeo de otra, el
  //    valor se calcula y no aterriza en ninguna columna. Ninguna suma cambia y nada se pone rojo.
  //    Lo destapó el 26-ago sobre `% Unsuscribe vs sends` —una de las dos columnas que pidió
  //    Rick—: el mapeo decía `% Unsuscribe` y **71 valores se habrían perdido al regenerar**.
  // 🔴 LAS RETIRADAS SE DECLARAN AQUÍ, y por eso el check no se ahoga en ellas: una columna que
  //    se vacía POR DECISIÓN es distinta de una que se vacía por un nombre que no casa. Si mañana
  //    se decide volver a reportar el desglose, quitarla de esta lista vuelve a encender el check.
  // 🔴 EL MISMO resolvedor que usa el regenerador, con sus mismas dos dependencias. Montar aquí
  //    uno propio sería la copia divergente de siempre: el check saldría verde sobre una regla
  //    que no es la que corre.
  var VR = require(__dirname + '/lib-valores-resumen.js');
  var LF = require(__dirname + '/lib-flexible.js');
  var valorDe = VR.crear(
    function (iso) { return iso ? Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000) : ''; },
    LF.nmEncabezado);
  var RETIRADAS_A_PROPOSITO = /^(Clicks_(Qcart|App|Social|Web|Ver_Navegador)|%_(Qcart|App|Social|Web|Ver_Navegador)|Views_vs_Clicks_%|Carritos_vs_Clicks_%)$/;
  var seCaen = [];
  enc.forEach(function (col) {
    if (!col || RETIRADAS_A_PROPOSITO.test(col)) return;
    var hoy = F.filter(function (f) { return String(f[col] == null ? '' : f[col]).trim() !== ''; }).length;
    if (!hoy) return;                                    // vacía hoy: no hay nada que perder
    var podra = (R.rejilla || []).filter(function (c) {
      var v = valorDe(col, c); return v !== undefined && v !== null && v !== '';
    }).length;
    if (!podra) seCaen.push(col + ' (' + hoy + ' valor(es) hoy, 0 al regenerar)');
  });
  chk('🔴 ninguna columna con dato se queda sin llenar al regenerar', seCaen.length === 0,
    seCaen.length ? '🔴 ' + seCaen.join(' · ')
      : enc.filter(Boolean).length + ' columnas barridas por su nombre real · las retiradas van declaradas');
})();

// ── ¿HAY UNA LLAVE ESCRITA DOS VECES EN EL MAPA DE COLUMNAS?
//
// 🔴 SE LEE EL ARCHIVO, NO EL MÓDULO — y esa es toda la gracia. Al importar `lib-valores-resumen`,
//    JS ya se quedó con la última de las dos y la repetición desaparece: desde el módulo el defecto
//    es invisible. Pasó dos veces en este proyecto. La última, el 25-ago: escribí
//    `'Unsubs_Total': c.unsubs_unicos` veinte líneas debajo de `'Unsubs_Total': null`, y mi línea
//    pisó sin avisar una decisión de Rick («unsuscribe total se quita»). Lo que se pierde así no
//    es un valor: es una decisión, y no queda rastro de que se perdió.
(function () {
  var src = require('fs').readFileSync(require('path').resolve(__dirname, '..') + '/_scripts/lib-valores-resumen.js', 'utf8');
  // solo dentro del objeto de columnas: llaves entrecomilladas seguidas de dos puntos
  var vistas = {}, repes = [];
  src.replace(/^\s*'([^']+)'\s*:/gm, function (_, k) {
    if (vistas[k]) { if (repes.indexOf(k) < 0) repes.push(k); }
    vistas[k] = (vistas[k] || 0) + 1;
    return _;
  });
  V.push(['ninguna columna se escribe dos veces en el mapa', repes.length === 0,
    repes.length ? '🔴 ' + repes.join(' · ') + ' — JS se queda con la última y la otra se pierde en silencio'
                 : Object.keys(vistas).length + ' llaves, todas únicas']);
  if (repes.length) fallo++;
})();

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(60) + (v[2] || '')); });
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(58) + (h[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ EL REPORTE DICE LO QUE DICE LA REJILLA — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
