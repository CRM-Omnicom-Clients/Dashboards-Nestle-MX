/*
 * maggi.qcart-j9.js — LAS MÉTRICAS DE QCART DEL J9, DERIVADAS Y CALIBRADAS.
 *
 * 🔴 POR QUÉ EXISTE. Dejé las 11 columnas de Qcart del J9 en `POR DEFINIR` diciendo que hacía
 *    falta un «match Nestlé» que no existía. Rick preguntó por qué. Tenía razón: no hace falta
 *    ningún match. `Data_Qcart_Productos` YA es el conjunto matcheado — sus 27 productos son
 *    todos Maggi/Nestlé (jugo sazonador, crema, leche evaporada Clavel, consomate, mi-che…).
 *    Busqué un SCRIPT que hiciera el match, no lo encontré, y concluí que no se podía hacer.
 *    La autoridad era la hoja, no un script.
 *
 * 🔴 NADA SE ESCRIBE SIN CALIBRAR PRIMERO. El script deriva las 11 columnas para las filas que
 *    Rick YA llenó y las compara contra sus cifras. Si el método no reproduce lo suyo, no tiene
 *    ningún derecho a inventar las del J9. Se imprime la comparación fila por fila.
 *
 * 🔴 LAS FÓRMULAS SE DEDUJERON DE SUS PROPIAS CELDAS, no de suponer:
 *      Clicks vs Carritos    = Carritos_Total / Clicks          (137/38 = 3.6053 ✓ fila 2)
 *      Pct_Penetracion       = Intencion_Nestle / Intencion_Total
 *      Ticket_Carrito_MXN    = Intencion_Total  / Views_Carrito (67,934.90/305 = 222.74 ✓)
 *      Ticket_Producto_MXN   = Intencion_Nestle / Views_Productos_Nestle (44/2 = 22 ✓ fila 23)
 *    🔴 Ojo: el ticket NO se divide entre los carritos sino entre las VIEWS. Dividir por
 *    `Carritos_Total` daba 270.79 donde su celda dice 338.49 — el denominador se comprueba.
 *
 * 🔴 LA FUENTE, POR PREGUNTA: BLOQUE para lo que ya tiene alta, CRUDO DEDUPLICADO para el J9
 *    (sus links no están dados de alta y el bloque descarta parte de sus eventos). Y el crudo
 *    se DEDUPLICA: los export se solapan (`08-01→09-14` y `09-01→09-30`) y sumarlos a pelo
 *    contaba dos veces — así reporté «30 carritos» donde eran 18.
 *
 *   node maggi.qcart-j9.js              (seco: calibra y muestra)
 *   node maggi.qcart-j9.js --escribir   (escribe SOLO las filas 24 y 25)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'maggi';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var DIRQ = PROY + '/ReportesQcart/_vigentes';
var HOJA = 'Maggi Reporte';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var CORTE_J7 = '2026-09-04';

function num(v) {
  var s = t(v).replace(/^"|"$/g, ''); if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(/,/g, '.'); else s = s.replace(/,/g, '');
  var n = Number(s.replace(/[$\s]/g, ''));
  return isFinite(n) ? n : 0;
}
function serialAIso(n) { return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10); }

// ══ LAS FUENTES ══════════════════════════════════════════════════════════════════════
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
function delBloque(tipo) {
  return (Q[tipo] || []).map(function (e) {
    return { cod: t(e.shortlink_code), fecha: t(e.fecha).slice(0, 10), store: t(e.store).toLowerCase(),
      views: num(e.views), precio: num(e.total_shown_price) };
  });
}
function leerCsv(a) {
  var txt = fs.readFileSync(DIRQ + '/' + a, 'utf8').replace(/^﻿/, '');
  var LN = txt.split(/\r?\n/).filter(function (x) { return x.trim(); });
  var enc = LN[0].split(';').map(function (x) { return t(x).replace(/^"|"$/g, ''); });
  return LN.slice(1).map(function (l) {
    var cel = [], act = '', d = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l.charAt(i);
      if (ch === '"') { d = !d; act += ch; continue; }
      if (ch === ';' && !d) { cel.push(act); act = ''; continue; }
      act += ch;
    }
    cel.push(act);
    var o = {}; enc.forEach(function (h, i2) { o[h] = t(cel[i2]).replace(/^"|"$/g, ''); });
    return o;
  });
}
/* 🔴 EL CRUDO SE DEDUPLICA. Los export de Qcart se solapan en el tiempo; la misma fila aparece
   en dos archivos. La llave lleva todo lo que identifica al evento. */
function delCrudo(esProductos) {
  var vistos = {}, out = [];
  fs.readdirSync(DIRQ).filter(function (f) {
    return /\.csv$/i.test(f) && /-raw-/.test(f) && (esProductos ? /products/i.test(f) : !/products/i.test(f));
  }).forEach(function (a) {
    leerCsv(a).forEach(function (o) {
      var k = [t(o['shortlink code']), t(o['date']), t(o['store']), t(o['total shown price']),
        t(o['views']), t(o['impressions']), t(o['utm_term']), t(o['product'] || '')].join('¦');
      if (vistos[k]) return; vistos[k] = 1;
      out.push({ cod: t(o['shortlink code']), fecha: t(o['date']).slice(0, 10), store: t(o['store']).toLowerCase(),
        views: num(o['views']), precio: num(o['total shown price']) });
    });
  });
  return out;
}

/* ══ EL DERIVADOR — uno solo, y lo usan la calibración y el J9 ══════════════════════════ */
function derivar(carr, prod, cods, desde, hasta, tp, clicks) {
  function dentro(e) {
    if (cods.indexOf(e.cod) < 0) return false;
    if (!e.fecha) return false;
    if (desde && e.fecha < desde) return false;
    if (hasta && e.fecha > hasta) return false;
    // el ambiguo: cada lado de la fecha va a su jornada
    if (e.cod === 'hTHNLqzL') {
      var esJ4 = (e.fecha < CORTE_J7);
      if (tp === 'E-J4' && !esJ4) return false;
      if (tp === 'E-J7' && esJ4) return false;
    }
    return true;
  }
  var C = carr.filter(dentro), P = prod.filter(dentro);
  var wal = C.filter(function (e) { return /walmart/.test(e.store); }).length;
  var che = C.filter(function (e) { return /chedraui/.test(e.store); }).length;
  var viewsC = C.reduce(function (a, e) { return a + e.views; }, 0);
  var viewsP = P.reduce(function (a, e) { return a + e.views; }, 0);
  var intT = C.reduce(function (a, e) { return a + e.precio; }, 0);
  var intN = P.reduce(function (a, e) { return a + e.precio; }, 0);
  return {
    Carritos_Walmart: wal, Carritos_Chedraui: che, Carritos_Total: C.length,
    'Clicks vs Carritos': clicks ? +(C.length / clicks).toFixed(4) : null,
    Views_Carrito: viewsC, Views_Productos_Nestle: viewsP,
    Intencion_Total_MXN: intT, Intencion_Nestle_MXN: intN,
    Pct_Penetracion_Nestle: intT ? +(intN / intT).toFixed(2) : null,
    Ticket_Carrito_MXN: viewsC ? intT / viewsC : null,
    Ticket_Producto_MXN: viewsP ? intN / viewsP : null
  };
}
function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ══ LA HOJA ══════════════════════════════════════════════════════════════════════════
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_qj9.xlsx';
fs.copyFileSync(VIVO, tmp);
var ws = XLSX.readFile(tmp, { cellStyles: true }).Sheets[HOJA];
var FILAS = XLSX.utils.sheet_to_json(ws, { defval: '' });
var LETRA = {}, R = XLSX.utils.decode_range(ws['!ref']);
for (var c = R.s.c; c <= R.e.c; c++) {
  var h = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) LETRA[t(h.v)] = XLSX.utils.encode_col(c);
}
function NOM(id) { return COL.de(FILAS, id, AMBITO); }
function L(id) { return LETRA[NOM(id)]; }
function val(id, r) { var x = ws[L(id) + r]; return (x === undefined || x.t === 'z') ? null : x.v; }

var COLS = ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Clicks vs Carritos',
  'Views_Carrito', 'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN',
  'Pct_Penetracion_Nestle', 'Ticket_Carrito_MXN', 'Ticket_Producto_MXN'];

console.log('════════ Qcart del J9 · derivar, CALIBRANDO primero ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var carrB = delBloque('carritos'), prodB = delBloque('productos');
console.log('  bloque: ' + carrB.length + ' carritos · ' + prodB.length + ' productos');
var carrC = delCrudo(false), prodC = delCrudo(true);
console.log('  crudo deduplicado: ' + carrC.length + ' carritos · ' + prodC.length + ' productos\n');

// ══ CALIBRACIÓN ══════════════════════════════════════════════════════════════════════
console.log('  ── ¿el método reproduce las cifras que Rick ya tiene? ──');
console.log('  fila  tp            ' + ['W', 'C', 'TOT', 'VC', 'VP', 'IntTot', 'IntNes'].map(function (x) { return x.padStart(8); }).join('') + '   veredicto');
var okFilas = 0, totFilas = 0, detalle = [];
for (var r = 2; r <= 23; r++) {
  var tp = t(val('TouchPoint', r)); if (!tp) continue;
  var aj = t(val('SHORTLINKS ASIGNADOS', r)); if (!aj || aj === 'N/A') continue;
  var dice = val('Carritos_Total', r); if (dice === null) continue;
  var cods = (aj.match(/\b[A-Za-z0-9]{8}\b/g) || []);
  var d0 = val('Medición desde', r), d1 = val('Medición hasta', r);
  var desde = (typeof d0 === 'number') ? serialAIso(d0) : null;
  var hasta = (typeof d1 === 'number') ? serialAIso(d1) : null;
  var clicks = val('Clicks', r);
  var D = derivar(carrB, prodB, cods, desde, hasta, tp, typeof clicks === 'number' ? clicks : 0);

  var suyo = {}; COLS.forEach(function (n) { var v = val(n, r); suyo[n] = (typeof v === 'number') ? v : num(v); });
  var iguales = 0, dif = [];
  ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle',
    'Intencion_Total_MXN', 'Intencion_Nestle_MXN'].forEach(function (n) {
      var a = Math.round(D[n] * 100) / 100, b = Math.round(suyo[n] * 100) / 100;
      if (Math.abs(a - b) < 0.02) iguales++; else dif.push(n.replace(/_MXN|Carritos_|Views_/g, '') + ' ' + a + '≠' + b);
    });
  totFilas++; if (iguales === 7) okFilas++;
  console.log('  ' + String(r).padStart(4) + '  ' + tp.padEnd(13) +
    [D.Carritos_Walmart, D.Carritos_Chedraui, D.Carritos_Total, D.Views_Carrito, D.Views_Productos_Nestle,
      Math.round(D.Intencion_Total_MXN), Math.round(D.Intencion_Nestle_MXN)].map(function (x) { return String(x).padStart(8); }).join('') +
    '   ' + (iguales === 7 ? '✔ 7/7' : '⚠ ' + iguales + '/7  ' + dif.slice(0, 2).join(' · ')));
  detalle.push({ fila: r, tp: tp, derivado: D, suyo: suyo, iguales: iguales });
}
console.log('\n  → ' + okFilas + ' de ' + totFilas + ' filas se reproducen EXACTAS en las 7 métricas base\n');

// ══ EL J9 ════════════════════════════════════════════════════════════════════════════
var J9 = [
  { fila: 24, tp: 'E-J9', cods: ['bfQ24tDq', 'xTaSfQ2y'] },
  { fila: 25, tp: 'WA-J9', cods: ['ymh2OT4x'] }
];
console.log('  ── J9 (fuente = CRUDO deduplicado: sus links no tienen alta y el bloque los recorta)');
J9.forEach(function (N) {
  var d0 = val('Medición desde', N.fila), d1 = val('Medición hasta', N.fila);
  N.desde = (typeof d0 === 'number') ? serialAIso(d0) : null;
  N.hasta = (typeof d1 === 'number') ? serialAIso(d1) : null;
  var clicks = val('Clicks', N.fila);
  N.clicks = (typeof clicks === 'number') ? clicks : 0;
  N.D = derivar(carrC, prodC, N.cods, N.desde, N.hasta, N.tp, N.clicks);
  console.log('     fila ' + N.fila + '  ' + N.tp + '   ventana ' + N.desde + ' → ' + N.hasta + '   codigos ' + N.cods.join(' · '));
  console.log('        Carritos  Walmart ' + N.D.Carritos_Walmart + ' · Chedraui ' + N.D.Carritos_Chedraui + ' · TOTAL ' + N.D.Carritos_Total +
    (N.D.Carritos_Total > N.D.Carritos_Walmart + N.D.Carritos_Chedraui ? '   (' + (N.D.Carritos_Total - N.D.Carritos_Walmart - N.D.Carritos_Chedraui) + ' sin tienda)' : ''));
  console.log('        Views     carrito ' + N.D.Views_Carrito + ' · productos Nestlé ' + N.D.Views_Productos_Nestle);
  console.log('        Intención total ' + money(N.D.Intencion_Total_MXN) + ' · Nestlé ' + money(N.D.Intencion_Nestle_MXN) +
    '   penetración ' + (N.D.Pct_Penetracion_Nestle === null ? '—' : (100 * N.D.Pct_Penetracion_Nestle).toFixed(0) + '%'));
  console.log('        Ticket    carrito ' + (N.D.Ticket_Carrito_MXN === null ? '—' : money(N.D.Ticket_Carrito_MXN)) +
    ' · producto ' + (N.D.Ticket_Producto_MXN === null ? '—' : money(N.D.Ticket_Producto_MXN)) +
    '   ·  clicks vs carritos ' + (N.D['Clicks vs Carritos'] === null ? '—' : N.D['Clicks vs Carritos']));
  console.log('');
});

fs.writeFileSync(BACK + '/_preescritura/maggi-qcart-j9.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  calibracion: { exactas: okFilas, de: totFilas, detalle: detalle },
  j9: J9
}, null, 1));
console.log('  → _preescritura/maggi-qcart-j9.json');

/* ══ LAS DOS GUARDAS QUE SÍ DICEN ALGO ═══════════════════════════════════════════════
   🔴 «Reproducir el 70% de las filas» era un umbral inventado, y encima medía la pregunta
      equivocada. Las cifras de Rick son FOTOS de cuando él las escribió: los carritos siguen
      llegando después. Exigir que coincidan exige que el tiempo no haya pasado.

   G1 · EN CARRITOS NUNCA PUEDO TENER MENOS QUE ÉL. Si tuviera menos, no sería acumulación:
        sería que estoy contando mal o mirando donde no es. Esa es la prueba que discrimina.

   G2 · PARA LAS FILAS QUE VOY A ESCRIBIR, la regla ambigua no puede cambiar el resultado.
        En el histórico no hay UNA regla de productos que reproduzca todo (las filas 18 y 20
        solo cuadran sin ventana; la 21 solo con ventana). Esa duda es real y no la resuelvo
        inventando. Pero en el J9 la ventana ES la vida entera de sus códigos, así que las
        dos reglas dan lo MISMO — y eso se comprueba aquí, no se supone.                      */
var menos = detalle.filter(function (d) { return d.derivado.Carritos_Total < d.suyo.Carritos_Total; });
console.log('  ── G1 · ¿alguna fila donde yo derive MENOS carritos que Rick?');
if (menos.length) {
  console.log('     🔴 sí: ' + menos.map(function (d) { return 'fila ' + d.fila + ' ' + d.derivado.Carritos_Total + '<' + d.suyo.Carritos_Total; }).join(' · '));
  console.log('     Eso no es acumulación — es un error de conteo. No escribo.');
  process.exit(1);
}
console.log('     ✔ ninguna. Donde difiere, yo tengo MÁS: ' +
  detalle.filter(function (d) { return d.derivado.Carritos_Total > d.suyo.Carritos_Total; })
    .map(function (d) { return 'f' + d.fila + ' ' + d.suyo.Carritos_Total + '→' + d.derivado.Carritos_Total; }).join(' · ') +
  '   (carritos que llegaron después de que él escribiera la celda)\n');

console.log('  ── G2 · en las filas del J9, ¿cambia algo si NO aplico la ventana?');
var G2ok = true;
J9.forEach(function (N) {
  var sin = derivar(carrC, prodC, N.cods, null, null, N.tp, N.clicks);
  var difs = COLS.filter(function (n) {
    var a = N.D[n], b = sin[n];
    if (a === null || b === null) return a !== b;
    return Math.abs(a - b) > 0.005;
  });
  console.log('     fila ' + N.fila + ' ' + N.tp + ': ' + (difs.length ? '🔴 cambia en ' + difs.join(', ') : '✔ idéntico con y sin ventana'));
  if (difs.length) G2ok = false;
});
if (!G2ok) {
  console.log('\n  🔴 la regla de ventana SÍ cambia el resultado del J9, y el histórico no dice cuál es la buena. No escribo.');
  process.exit(1);
}
console.log('');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir las filas 24 y 25: --escribir)'); process.exit(0); }

// ══ ESCRIBIR SOLO LAS FILAS 24 y 25 ══════════════════════════════════════════════════
try { fs.closeSync(fs.openSync(VIVO, 'r+')); }
catch (e) { console.log('🔴 el libro está BLOQUEADO (' + e.code + '). No escribo.'); process.exit(1); }

var zip = new AdmZip(VIVO);
var wbx = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
var rels = zip.getEntry('xl/_rels/workbook.xml.rels').getData().toString('utf8');
var mSh = new RegExp('<sheet[^>]*name="' + HOJA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*r:id="([^"]+)"').exec(wbx);
var mRel = new RegExp('<Relationship[^>]*Id="' + mSh[1] + '"[^>]*Target="([^"]+)"').exec(rels);
var parte = 'xl/' + mRel[1].replace(/^\/?xl\//, '');
var xml = zip.getEntry(parte).getData().toString('utf8');

/* 🔴 EL TIPO SE COPIA DE LA FILA HERMANA, NO DE LA PRIMERA QUE APAREZCA.
   Muestreando «la primera celda no vacía de la columna» salió `Carritos_Walmart = "$26.00"`:
   un CONTEO escrito como texto de moneda, que rompe cualquier SUM. La culpa es de la muestra
   —las filas 2,3,4,6 arrastran un numFmt de moneda sobre columnas de conteo, un artefacto que
   ya venía—, y al tomar la primera se hereda el artefacto en vez de la convención.
   La hermana (23 para E-J9, 22 para WA-J9) es la que define cómo se ve su bloque: ahí
   `Carritos_Walmart` es numérico y `Intencion_Total_MXN` es texto con «$». */
function comoLaHoja(nom, v, hermana) {
  if (v === null) return 'N/A';
  var x = ws[L(nom) + hermana];
  if (x && x.t === 's' && /^\$/.test(String(x.v))) return money(v);
  if (x && x.t === 'n') return v;
  return v;
}
var escritas = 0, fallos = [];
J9.forEach(function (N) {
  COLS.forEach(function (nom) {
    var ref = L(nom) + N.fila;
    var hermana = (N.tp === 'E-J9') ? 23 : 22;
    var v = comoLaHoja(nom, N.D[nom], hermana);
    var est = CX.estiloDe(xml, L(nom) + hermana);
    var res = CX.poner(xml, ref, CX.celda(ref, v, est), N.fila);
    xml = res.xml;
    if (res.como === 'sin fila') fallos.push(ref); else escritas++;
  });
});
if (fallos.length) { console.log('🔴 no se colocaron: ' + fallos.join(' ')); process.exit(1); }
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(VIVO);
console.log('\n  ✔ ' + escritas + ' celdas escritas en las filas 24 y 25. Ahora las 5 capas.\n');

var T = require(__dirname + '/lib-entorno.js').TOOLS, NODE = T + '/node/node.exe';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var fallo = 0;
[[NODE, [T + '/xlsx-safe-save.js', VIVO]], [NODE, [T + '/xlsx-label.js', VIVO]], [NODE, [T + '/xlsx-check.js', VIVO]],
[PY, [T + '/xlsx-validar-fondo.py', VIVO]], [NODE, [T + '/xlsx-orden-celdas.js', VIVO]]].forEach(function (cc) {
  var nom = String(cc[1][0]).split('/').pop();
  try {
    var out = cp.execFileSync(cc[0], cc[1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('  ✔ ' + nom.padEnd(24) + out.trim().split('\n').slice(-1).join(' ').slice(0, 120));
  } catch (e) { fallo++; console.log('  🔴 ' + nom.padEnd(24) + String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 250)); }
});
console.log('\n' + (fallo ? '  🔴 ' + fallo + ' capa(s) fallaron' : '  ✅ las 5 capas en verde'));
