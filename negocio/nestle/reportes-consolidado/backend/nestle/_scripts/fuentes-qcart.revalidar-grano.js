/*
 * fuentes-qcart.revalidar-grano.js — TODO Qcart, revalidado al grano real. Mide, no escribe.
 *
 * POR QUÉ: Rick, 9-sep-2026: «Revalida todo qcart con las reglas que hemos mencionado por
 * segmento x touchpoint x campaña. Y me dices en total».
 *
 * 🔴 EL GRANO ES CAMPAÑA × TOUCHPOINT × SEGMENTO. La quincena es solo el ancla temporal.
 *    Agrupar a un solo segmento borra la comparación que el reporte existe para dar — y CUADRA
 *    IGUAL, así que ninguna puerta lo ve. Por eso esto se mide aparte de las puertas.
 *
 * 🔴 LA LLAVE ES EL SHORTLINK, NUNCA EL UTM (R2, y Rick lo reconfirmó el 9-sep: «tu principal key
 *    es el link… las utms están mal de estos»). Aquí el utm solo se IMPRIME para ver cuánto miente,
 *    nunca para atribuir.
 *
 * 🔴 SE CUENTA LO QUE ENTRA **Y** LO QUE NO. «0 carritos» tiene dos lecturas que no se parecen:
 *    «el link no generó tráfico» y «lo generó y algo lo tiró». Sin la segunda columna, un filtro
 *    demasiado estricto se ve exactamente igual que una campaña sin ventas.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
var LK = require(__dirname + '/lib-qcart-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;

var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;

// ── el libro ────────────────────────────────────────────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_reval.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '' });
fs.unlinkSync(tmp);

var K = {};
[['id', 'Pieza' + '_ID'], ['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'],
 ['cods', 'Codigos' + '_Qcart'], ['tiene', 'Tiene' + '_Qcart']
].forEach(function (x) { K[x[0]] = COL.de(P, x[1], 'catalogo'); });
var RC = {};
[['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'],
 ['carr', 'Carritos' + '_Total'], ['vw', 'Views' + '_Carrito'], ['int', 'Intencion' + '_Total_MXN']
].forEach(function (x) { RC[x[0]] = COL.opcional(R, x[1]); });

// ── el bloque y el maestro ──────────────────────────────────────────────────
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');

// dimensiones de cada pieza, desde el catálogo (la autoridad)
var dimDe = {};
P.forEach(function (r) {
  var id = t(r[K.id]); if (!id) return;
  dimDe[id] = { cam: t(r[K.cam]), tp: t(r[K.tp]), seg: t(r[K.seg]), cods: t(r[K.cods]) };
});

// ── el crudo: cuánto tráfico tiene cada shortlink, entre y no entre ─────────
var dir = PROY + '/ReportesQcart/_vigentes';
var crudoPorCod = {}, crudoTotal = 0;
fs.readdirSync(dir).filter(function (f) { return /carts-raw.*\.csv$/i.test(f); }).forEach(function (f) {
  fs.readFileSync(dir + '/' + f, 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    var p = l.split(';'); if (p.length < 3) return;
    var c = t(p[1]); if (!c) return;
    crudoTotal++;
    (crudoPorCod[c] = crudoPorCod[c] || { n: 0, utm: {} }).n++;
    var u = t(p[6]); crudoPorCod[c].utm[u] = (crudoPorCod[c].utm[u] || 0) + 1;
  });
});

// 🔴 EL SEGMENTO DEL REPORTE LLEVA SU SUBSEGMENTO PEGADO, EL DEL BLOQUE NO (30-sep-2026).
//    El reporte escribe «Región unificada · Partición A» y el bloque dice «Región unificada». Al
//    comparar el texto literal, este script declaraba **🔴 SIN FILA** sobre TRES celdas de Liga MX
//    —E-J6 (2), E-J8 (7) y WA-J8 (44)— que existen en el reporte con exactamente esos carritos.
//    O sea: anunciaba pérdida de datos donde no había ninguna.
//    🔴 Y ESE ES EL DAÑO REAL DE UN AVISO FALSO: «SIN FILA» se lee como «se perdió», y un validador
//    que grita por su propio formato enseña a ignorarlo. Es la misma lección que ya costó aquí el
//    «⚠ -5,027 sin anclar» del motor.
//    Se compara por la BASE del segmento —lo anterior al primer ` · `— porque la partición es una
//    subdivisión del mismo segmento, no otro segmento. Si algún día dos particiones del mismo
//    touchpoint tuvieran carritos distintos, esto las sumaría: por eso se imprime el segmento
//    completo del reporte al lado, para que se vea qué se agrupó.
function baseSeg(s) { return String(s == null ? '' : s).split(' · ')[0].trim(); }

// ── agrupar el bloque al GRANO REAL ─────────────────────────────────────────
var grano = {};
function celda(cam, tp, seg) {
  var k = cam + ' ¦ ' + tp + ' ¦ ' + baseSeg(seg);
  return grano[k] = grano[k] || { cam: cam, tp: tp, seg: seg, carritos: 0, views: 0, filas: 0, piezas: {}, cods: {} };
}
var sinPieza = 0;
Q.carritos.forEach(function (e) {
  var id = t(e.pieza_id);
  if (!id || !dimDe[id]) { sinPieza++; return; }
  var d = dimDe[id];
  var g = celda(d.cam, d.tp, d.seg);
  // 🔴 CARRITOS = VISTAS (29-sep-2026). Esto hacía `g.carritos++` —una fila, un carrito— y
  //    calculaba `g.views` al lado SIN USARLO NUNCA: las seis comparaciones de más abajo iban
  //    todas contra `g.carritos`. O sea que el script que valida el grano de Qcart del reporte
  //    lo comparaba contra FILAS. Corrido hoy marcaba en rojo TODAS las celdas y habría hecho
  //    creer que el reporte está mal de arriba abajo, cuando el roto era el validador.
  //    Es el mismo patrón que el auditor de WhatsApp: una medición y su comprobación salidas
  //    del mismo lector equivocado — solo que aquí la variable buena existía y nadie la leía.
  g.filas++; g.views += Number(e.views || 0); g.carritos = g.views;
  g.piezas[id] = (g.piezas[id] || 0) + 1;
  g.cods[t(e.shortlink_code)] = (g.cods[t(e.shortlink_code)] || 0) + 1;
});

// ── el reporte, al mismo grano ──────────────────────────────────────────────
// 🔴 UNA CELDA DEL REPORTE NO ES campaña×touchpoint×segmento: LLEVA LA QUINCENA. Con la llave de
//    tres partes, `AON · E-P1 · Traditional Parents` aparece DOS veces —mar-Q2 con 366 carritos y
//    abr-Q2 sin ninguno— y la segunda pisaba a la primera: el script acusó al reporte de perder
//    366 carritos que sí estaban. Es el mismo defecto que casi duplica una fila de E-PROP1: una
//    llave INCOMPLETA, no la agregación. Aquí se SUMAN las filas de la misma identidad, porque
//    del lado del bloque los carritos no vienen partidos por quincena.
var enReporte = {};
R.forEach(function (r) {
  var cam = t(r[RC.cam]); if (!cam) return;
  var k = cam + ' ¦ ' + t(r[RC.tp]) + ' ¦ ' + baseSeg(r[RC.seg]);
  var v = t(r[RC.carr]);
  var n = /^\d+$/.test(v) ? Number(v) : null;
  if (!enReporte[k]) enReporte[k] = { carritos: n, crudo: v, filas: 1 };
  else {
    enReporte[k].filas++;
    if (n !== null) enReporte[k].carritos = (enReporte[k].carritos || 0) + n;
    if (enReporte[k].carritos !== null) enReporte[k].crudo = String(enReporte[k].carritos);
  }
});

console.log('════════ QCART · REVALIDADO AL GRANO campaña × touchpoint × segmento ════════\n');
console.log('  bloque ' + mil(Q.carritos.length) + ' carritos   ·   maestro ' + Object.keys(MAE.links).length + ' shortlinks' +
  '   ·   descarga cruda ' + mil(crudoTotal) + ' filas');
console.log('  auditoría del bloque: ' + JSON.stringify(Q.auditoria.carritos) + '\n');

var claves = Object.keys(grano).sort();
var TOT = { carritos: 0, celdas: 0, descuadres: 0 };
var DESCUADRES = [];

console.log('  ' + 'CAMPAÑA'.padEnd(17) + 'TOUCHPOINT'.padEnd(11) + 'SEGMENTO'.padEnd(30) + 'BLOQUE'.padStart(7) + '  ' + 'REPORTE'.padStart(8) + '  PIEZAS');
console.log('  ' + '─'.repeat(17) + '─'.repeat(11) + '─'.repeat(30) + '───────  ────────  ──────');
claves.forEach(function (k) {
  var g = grano[k];
  var rep = enReporte[k];
  TOT.carritos += g.carritos; TOT.celdas++;
  var repTxt = rep ? (rep.carritos === null ? rep.crudo || '—' : mil(rep.carritos)) : '🔴 SIN FILA';
  var mal = !rep || (rep.carritos !== null && rep.carritos !== g.carritos) || (rep.carritos === null && g.carritos > 0);
  if (mal) { TOT.descuadres++; DESCUADRES.push({ k: k, bloque: g.carritos, reporte: repTxt }); }
  console.log('  ' + (mal ? '🔴' : '  ') + g.cam.slice(0, 15).padEnd(15) + g.tp.slice(0, 10).padEnd(11) +
    g.seg.slice(0, 28).padEnd(30) + String(g.carritos).padStart(7) + '  ' + repTxt.padStart(8) + '  ' + Object.keys(g.piezas).join(' '));
});
console.log('  ' + '─'.repeat(65));
console.log('  ' + 'TOTAL'.padEnd(58) + String(TOT.carritos).padStart(7));
if (sinPieza) console.log('  🔴 carritos en el bloque SIN pieza dueña: ' + mil(sinPieza));

// ── celdas del reporte con Qcart que el bloque no respalda ──────────────────
console.log('\n── ¿el reporte declara carritos que el bloque no tiene?');
var fantasma = 0;
Object.keys(enReporte).forEach(function (k) {
  var r = enReporte[k];
  if (r.carritos && !grano[k]) { console.log('     🔴 ' + k + '   reporte ' + mil(r.carritos) + ' · bloque 0'); fantasma++; }
});
if (!fantasma) console.log('     ✔ ninguna');

// ── los shortlinks declarados: ¿cuántos rinden? ─────────────────────────────
console.log('\n── los shortlinks del catálogo, uno por uno');
var declarados = [], sinTrafico = [], noDeclarados = [];
Object.keys(dimDe).forEach(function (id) {
  t(dimDe[id].cods).split(/[,;]/).map(t).forEach(function (c) {
    if (!c || TOKEN.test(c)) return;
    declarados.push({ c: c, id: id });
  });
});
var vistos = {};
declarados.forEach(function (x) {
  if (vistos[x.c]) return; vistos[x.c] = 1;
  var enBloque = Q.carritos.filter(function (e) { return t(e.shortlink_code) === x.c; }).length;
  var enCrudo = crudoPorCod[x.c] ? crudoPorCod[x.c].n : 0;
  if (!enBloque && enCrudo) {
    var utms = Object.keys(crudoPorCod[x.c].utm).map(function (u) { return u + ':' + crudoPorCod[x.c].utm[u]; }).join(' ');
    sinTrafico.push('     🔴 ' + x.c.padEnd(11) + x.id.padEnd(10) + 'bloque 0  ·  crudo ' + String(enCrudo).padStart(4) + '   utm ' + utms);
  }
});
console.log('     shortlinks declarados en el catálogo: ' + Object.keys(vistos).length + '   ·   en el maestro: ' + Object.keys(MAE.links).length);
if (sinTrafico.length) { console.log('     con tráfico en el crudo y CERO en el bloque:'); sinTrafico.forEach(function (l) { console.log(l); }); }
else console.log('     ✔ todos los que tienen tráfico crudo entraron al bloque');

// ── el maestro contra el catálogo ───────────────────────────────────────────
console.log('\n── shortlinks del maestro que NINGUNA pieza declara');
var huerf = Object.keys(MAE.links).filter(function (c) { return !vistos[c]; });
console.log('     ' + huerf.length + ' de ' + Object.keys(MAE.links).length);
huerf.forEach(function (c) {
  var r = MAE.links[c], n = crudoPorCod[c] ? crudoPorCod[c].n : 0;
  console.log('     ' + (n ? '🔴' : '· ') + ' ' + c.padEnd(11) + r.hoja.padEnd(12) + t(r.utm_content).padEnd(9) +
    r.fecha_activacion + '   crudo ' + String(n).padStart(4) + '   ' + t(r.receta).slice(0, 28));
});

console.log('\n════════ TOTAL ════════');
console.log('   celdas campaña × touchpoint × segmento con Qcart : ' + TOT.celdas);
console.log('   carritos atribuidos                              : ' + mil(TOT.carritos));
console.log('   descuadres bloque vs reporte                     : ' + TOT.descuadres + (TOT.descuadres ? ' 🔴' : ' 🟢'));
DESCUADRES.forEach(function (d) { console.log('      ' + d.k + '   bloque ' + d.bloque + ' · reporte ' + d.reporte); });
fs.writeFileSync(BACK + '/_preescritura/revalidacion-qcart.json', JSON.stringify({
  cuando: new Date().toISOString(), total_carritos: TOT.carritos, celdas: TOT.celdas,
  descuadres: DESCUADRES, sin_pieza: sinPieza, grano: grano
}, null, 1));
console.log('\n   → _preescritura/revalidacion-qcart.json');
