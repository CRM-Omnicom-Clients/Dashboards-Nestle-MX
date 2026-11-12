/*
 * maggi.validar-todo.js — VALIDAR CADA TOUCHPOINT Y CADA DATO QUE SE AGREGÓ.
 *
 * Lo pidió Rick: «al final valida todo, cada touchpoint y todos los datos que agregaste».
 *
 * 🔴 SE VALIDA CONTRA FUERA, NO CONTRA UNO MISMO. El defecto que este sistema ya pagó caro fue
 *    una auditoría que comparaba un bloque consigo mismo: 19 checks en verde con 14 de 26 envíos
 *    mal, porque los dos lados salían del MISMO lector equivocado. Aquí cada cifra se contrasta
 *    con algo independiente de quien la escribió:
 *      · las celdas       → contra el RESPALDO anterior a tocar nada (qué cambió y qué no)
 *      · los carritos     → contra el bloque / el crudo deduplicado
 *      · el email del J9  → contra el detalle de SFMC
 *      · las derivadas    → recalculadas desde las OTRAS celdas de su propia fila
 *
 * 🔴 Y SE MIRA EL TIPO, no solo el valor. Un conteo escrito como texto de moneda («$26.00»)
 *    vale lo mismo a la vista y rompe cualquier SUM. Ya pasó en esta misma hoja.
 *
 *   node maggi.validar-todo.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'maggi';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var RESP = require('path').resolve(__dirname, '..') + '/_tmp/_respaldos-maggi/v8-antes-maggi-20260921-131411.xlsx';
var HOJA = 'Maggi Reporte';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var CORTE_J7 = '2026-09-04';
function num(v) {
  var s = t(v).replace(/^"|"$/g, ''); if (!s) return 0;
  s = s.replace(/,/g, '');
  var n = Number(s.replace(/[$\s]/g, ''));
  return isFinite(n) ? n : 0;
}
function serialAIso(n) { return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10); }
var cerca = function (a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.02 : tol); };

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_val.xlsx'; fs.copyFileSync(VIVO, tmp);
var WB = XLSX.readFile(tmp, { cellStyles: true });
var ws = WB.Sheets[HOJA];
var WA = XLSX.readFile(RESP, { cellStyles: true });
var wsA = WA.Sheets[HOJA];

var FILAS = XLSX.utils.sheet_to_json(ws, { defval: '' });
var LETRA = {}, R = XLSX.utils.decode_range(ws['!ref']);
for (var c = R.s.c; c <= R.e.c; c++) {
  var h = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) LETRA[t(h.v)] = XLSX.utils.encode_col(c);
}
function NOM(id) { return COL.de(FILAS, id, AMBITO); }
function L(id) { return LETRA[NOM(id)]; }
function cel(hoja, id, r) { var x = hoja[L(id) + r]; return (x === undefined || x.t === 'z') ? null : x; }
function v(id, r) { var x = cel(ws, id, r); return x ? x.v : null; }
function vA(id, r) { var x = cel(wsA, id, r); return x ? x.v : null; }

var FALLOS = [], AVISOS = [];
function mal(q, d) { FALLOS.push(q + ' — ' + d); }
function avisa(q, d) { AVISOS.push(q + ' — ' + d); }

// ── las fuentes, independientes de la hoja ──────────────────────────────────────────
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
function delBloque(tipo) {
  return (Q[tipo] || []).map(function (e) {
    return { cod: t(e.shortlink_code), fecha: t(e.fecha).slice(0, 10), store: t(e.store).toLowerCase(), views: num(e.views), precio: num(e.total_shown_price) };
  });
}
var DIRQ = PROY + '/ReportesQcart/_vigentes';
function delCrudo(esProd) {
  var vistos = {}, out = [];
  fs.readdirSync(DIRQ).filter(function (f) { return /\.csv$/i.test(f) && /-raw-/.test(f) && (esProd ? /products/i.test(f) : !/products/i.test(f)); })
    .forEach(function (a) {
      var txt = fs.readFileSync(DIRQ + '/' + a, 'utf8').replace(/^﻿/, '');
      var LN = txt.split(/\r?\n/).filter(function (x) { return x.trim(); });
      var enc = LN[0].split(';').map(function (x) { return t(x).replace(/^"|"$/g, ''); });
      LN.slice(1).forEach(function (l) {
        var ce = [], act = '', d = false;
        for (var i = 0; i < l.length; i++) { var ch = l.charAt(i); if (ch === '"') { d = !d; act += ch; continue; } if (ch === ';' && !d) { ce.push(act); act = ''; continue; } act += ch; }
        ce.push(act);
        var o = {}; enc.forEach(function (hh, i2) { o[hh] = t(ce[i2]).replace(/^"|"$/g, ''); });
        var k = [o['shortlink code'], o['date'], o['store'], o['total shown price'], o['views'], o['impressions'], o['utm_term'], o['product'] || ''].join('¦');
        if (vistos[k]) return; vistos[k] = 1;
        out.push({ cod: t(o['shortlink code']), fecha: t(o['date']).slice(0, 10), store: t(o['store']).toLowerCase(), views: num(o['views']), precio: num(o['total shown price']) });
      });
    });
  return out;
}
var carrB = delBloque('carritos'), prodB = delBloque('productos');
var carrC = delCrudo(false), prodC = delCrudo(true);

/* 🔴 «DECLARADO» NO ES «TIENE CARRITOS». La primera versión daba por desconocido cualquier
   código sin eventos en Qcart y acusó a 6 que están perfectamente declarados: son links
   asignados que no generaron ni un carrito — justamente el caso por el que Rick pidió el cero
   literal. Un cero no es una ausencia. La autoridad de «existe» es el CATÁLOGO y el maestro,
   no el tráfico. */
var codigosConocidos = {};
carrB.concat(carrC).forEach(function (e) { if (e.cod) codigosConocidos[e.cod] = 1; });
var CAT = XLSX.utils.sheet_to_json(WB.Sheets['Catalogo_Piezas'], { defval: '' });
var clavesCod = Object.keys(CAT[0] || {}).filter(function (k) { return /^Cod_/.test(k); });
CAT.forEach(function (p) { clavesCod.forEach(function (k) { var x = t(p[k]); if (x && !/^(N\/A|POR DEFINIR)$/i.test(x)) codigosConocidos[x] = 1; }); });
try {
  var LKM = require(BACK + '/_scripts/lib-maestro-links.js');
  (LKM.cargar().filas || []).forEach(function (f) { var x = t(f.codigo); if (x) codigosConocidos[x] = 1; });
} catch (e) { avisa('setup', 'no pude leer el maestro de links: ' + e.message); }

/* 🔴 «carritos» NO es un shortlink. El extractor de códigos casaba cualquier token de 8
   caracteres y se tragó la palabra española dentro de la anotación de fechas
   («… · 48 carritos»), reportándola como código inexistente. Todo código real lleva al menos
   una mayúscula o un dígito; una palabra en minúsculas, no. */
function codigosDe(txt) {
  if (!txt || txt === 'N/A') return [];
  return (txt.match(/\b[A-Za-z0-9]{8}\b/g) || []).filter(function (x) { return /[A-Z]/.test(x) || /\d/.test(x); });
}

console.log('════════════ Maggi Reporte · VALIDACIÓN COMPLETA ════════════\n');

// ══ A · ¿QUÉ CAMBIÓ EN TODO EL LIBRO? ════════════════════════════════════════════════
console.log('── A · ¿qué cambió en el libro, contra el respaldo previo?');
var cambios = {}, totalCambios = 0;
WA.SheetNames.forEach(function (n) {
  var x = WA.Sheets[n], y = WB.Sheets[n];
  if (!y) { mal('A', 'la hoja «' + n + '» DESAPARECIÓ'); return; }
  var r1 = XLSX.utils.decode_range(x['!ref'] || 'A1'), r2 = XLSX.utils.decode_range(y['!ref'] || 'A1');
  var difs = [];
  for (var r = 0; r <= Math.max(r1.e.r, r2.e.r); r++) for (var cc = 0; cc <= Math.max(r1.e.c, r2.e.c); cc++) {
    var ref = XLSX.utils.encode_cell({ r: r, c: cc });
    var a = x[ref] && x[ref].t !== 'z' ? String(x[ref].v) : '';
    var b = y[ref] && y[ref].t !== 'z' ? String(y[ref].v) : '';
    if (a !== b) difs.push(ref);
  }
  if (difs.length) { cambios[n] = difs; totalCambios += difs.length; }
});
Object.keys(cambios).forEach(function (n) {
  console.log('   ' + (n === HOJA ? '✔' : '🔴') + ' ' + n.padEnd(24) + cambios[n].length + ' celdas');
  if (n !== HOJA) mal('A', 'cambió la hoja «' + n + '», que yo no debía tocar');
});
console.log('   hojas: ' + WA.SheetNames.length + ' → ' + WB.SheetNames.length +
  '   ·   total celdas cambiadas: ' + totalCambios + (Object.keys(cambios).length === 1 ? '   (todas en Maggi Reporte)' : ''));

// ══ B · LO DE RICK QUE NO SE DEBÍA TOCAR ═════════════════════════════════════════════
console.log('\n── B · ¿sobrevivió intacto lo que Rick ya tenía?');
var PROTEGIDAS = ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Clicks vs Carritos', 'Views_Carrito',
  'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN', 'Pct_Penetracion_Nestle',
  'Ticket_Carrito_MXN', 'Ticket_Producto_MXN', 'Medición desde', 'Medición hasta',
  'Principal_Sends', 'Principal_Opens', 'Principal_Clicks', 'WA-Envíos', 'WA-Leídos'];
var pisadas = 0, protegidasOk = 0;
for (var r = 2; r <= 23; r++) {
  PROTEGIDAS.forEach(function (n) {
    var antes = vA(n, r), ahora = v(n, r);
    if (antes === null) return;                       // estaba vacía: llenarla era el trabajo
    protegidasOk++;
    if (String(antes) !== String(ahora)) { pisadas++; mal('B', 'fila ' + r + ' «' + n + '»: ' + JSON.stringify(antes) + ' → ' + JSON.stringify(ahora)); }
  });
}
console.log('   ' + (pisadas ? '🔴' : '✔') + ' ' + protegidasOk + ' celdas suyas con valor previo · ' + pisadas + ' pisadas');
// la excepción declarada: SHORTLINKS
var susNombres = 0;
for (var r2 = 2; r2 <= 23; r2++) { if (vA('SHORTLINKS ASIGNADOS', r2) !== null) susNombres++; }
console.log('   ℹ  ' + susNombres + ' celdas de «SHORTLINKS ASIGNADOS» sí se sustituyeron (nombre → código) — la excepción declarada');
var perdidos = [];
for (var r3 = 2; r3 <= 23; r3++) {
  var nom = t(vA('SHORTLINKS ASIGNADOS', r3)); if (!nom) continue;
  var rec = t(v('RECETAS ASIGNADAS', r3));
  var base = nom.replace(/_[wWcC]$/, '').toLowerCase();
  var plano = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  if (plano(rec).indexOf(plano(base).slice(0, 12)) < 0) perdidos.push('fila ' + r3 + ' «' + nom + '» no aparece en RECETAS «' + rec.slice(0, 40) + '»');
}
console.log('   ' + (perdidos.length ? '⚠' : '✔') + ' su nombre reaparece en RECETAS ASIGNADAS en ' + (susNombres - perdidos.length) + '/' + susNombres + ' casos');
perdidos.forEach(function (p) { avisa('B', p); });

// ══ C · CADA TOUCHPOINT ══════════════════════════════════════════════════════════════
console.log('\n── C · touchpoint por touchpoint');
console.log('   fila  touchpoint     segmento                        6col  códigos  carritos(hoja/fuente)  derivadas  tipos');
var filasOk = 0, filasCon = 0;
var resumen = [];
for (var r4 = 2; r4 <= 25; r4++) {
  var tp = t(v('TouchPoint', r4)); if (!tp) continue;
  filasCon++;
  var pb = [];

  // C1 · las 6 columnas, ninguna vacía
  var seis = ['RECETAS ASIGNADAS', 'SHORTLINKS ASIGNADOS', 'UTMS CONTENT ORIGEN', 'UTMS CONTENT MODIFICADAS', 'Medición desde', 'Medición hasta'];
  var vacias = seis.filter(function (n) { var x = v(n, r4); return x === null || t(x) === ''; });
  if (vacias.length) pb.push('vacías: ' + vacias.join(','));

  // C2 · los códigos existen en la fuente
  var aj = t(v('SHORTLINKS ASIGNADOS', r4));
  var cods = codigosDe(aj);
  var desconocidos = cods.filter(function (x) { return !codigosConocidos[x]; });
  if (desconocidos.length) pb.push('códigos que no existen en Qcart: ' + desconocidos.join(','));

  // C3 · carritos contra la fuente
  var esJ9 = (r4 >= 24);
  var carr = esJ9 ? carrC : carrB, prod = esJ9 ? prodC : prodB;
  var d0 = v('Medición desde', r4), d1 = v('Medición hasta', r4);
  var desde = (typeof d0 === 'number') ? serialAIso(d0) : null;
  var hasta = (typeof d1 === 'number') ? serialAIso(d1) : null;
  function dentro(e) {
    if (cods.indexOf(e.cod) < 0 || !e.fecha) return false;
    if (desde && e.fecha < desde) return false;
    if (hasta && e.fecha > hasta) return false;
    if (e.cod === 'hTHNLqzL') { var j4 = e.fecha < CORTE_J7; if (tp === 'E-J4' && !j4) return false; if (tp === 'E-J7' && j4) return false; }
    return true;
  }
  var fuenteCar = cods.length ? carr.filter(dentro).length : 0;
  var hojaCar = v('Carritos_Total', r4);
  var hojaCarN = (hojaCar === null) ? null : num(hojaCar);
  if (hojaCarN !== null && hojaCarN > fuenteCar) pb.push('la hoja dice MÁS carritos (' + hojaCarN + ') que la fuente (' + fuenteCar + ')');

  // C4 · W + C nunca mayor que el total
  var w = num(v('Carritos_Walmart', r4)), ch = num(v('Carritos_Chedraui', r4));
  if (hojaCarN !== null && w + ch > hojaCarN) pb.push('Walmart+Chedraui (' + (w + ch) + ') > Total (' + hojaCarN + ')');

  // C5 · las derivadas, recalculadas desde las OTRAS celdas de su propia fila
  var iT = num(v('Intencion_Total_MXN', r4)), iN = num(v('Intencion_Nestle_MXN', r4));
  var vC = num(v('Views_Carrito', r4)), vP = num(v('Views_Productos_Nestle', r4));
  var der = [];
  var pen = v('Pct_Penetracion_Nestle', r4);
  if (typeof pen === 'number' && iT) { if (!cerca(pen, iN / iT, 0.011)) der.push('Penetración ' + pen + '≠' + (iN / iT).toFixed(3)); }
  var tc = v('Ticket_Carrito_MXN', r4);
  if (tc !== null && t(tc) !== 'N/A' && vC) { if (!cerca(num(tc), iT / vC, 0.6)) der.push('Ticket_Carrito ' + num(tc) + '≠' + (iT / vC).toFixed(2)); }
  var tpd = v('Ticket_Producto_MXN', r4);
  if (tpd !== null && t(tpd) !== 'N/A' && vP) { if (!cerca(num(tpd), iN / vP, 0.6)) der.push('Ticket_Producto ' + num(tpd) + '≠' + (iN / vP).toFixed(2)); }
  if (der.length) pb.push('derivadas: ' + der.join(' · '));

  // C6 · tipos: un conteo NUNCA es texto de moneda
  var tipos = [];
  ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle'].forEach(function (n) {
    var x = cel(ws, n, r4); if (!x) return;
    if (x.t === 's' && /^\$/.test(String(x.v))) tipos.push(n + '="' + x.v + '"');
  });
  // solo se reprocha lo que yo escribí (24-25); en 2-23 el artefacto ya venía de antes
  if (tipos.length && r4 >= 24) pb.push('conteo como texto de moneda: ' + tipos.join(','));

  var estado = pb.length ? '🔴' : '✔';
  if (!pb.length) filasOk++;
  console.log('   ' + String(r4).padStart(4) + '  ' + tp.padEnd(14) + t(v('Segmento', r4)).slice(0, 30).padEnd(32) +
    (vacias.length ? (6 - vacias.length) + '/6' : ' 6/6') + '   ' + String(cods.length).padStart(5) + '    ' +
    String(hojaCarN === null ? '—' : hojaCarN).padStart(6) + ' / ' + String(fuenteCar).padEnd(6) + '   ' +
    (der.length ? '🔴' : '✔ ').padEnd(9) + (tipos.length && r4 >= 24 ? '🔴' : '✔ ') + '  ' + estado);
  pb.forEach(function (p) { mal('C', 'fila ' + r4 + ' (' + tp + ') ' + p); });
  resumen.push({ fila: r4, tp: tp, codigos: cods, hoja: hojaCarN, fuente: fuenteCar });
}
console.log('   ' + (filasOk === filasCon ? '✔' : '🔴') + ' ' + filasOk + ' de ' + filasCon + ' filas sin ningún reproche');

// ══ D · EL CÓDIGO AMBIGUO, SIN DOBLE CONTEO ══════════════════════════════════════════
console.log('\n── D · hTHNLqzL: ¿repartido, no duplicado?');
var enFilas = resumen.filter(function (x) { return x.codigos.indexOf('hTHNLqzL') >= 0; });
var totalAmb = carrB.filter(function (e) { return e.cod === 'hTHNLqzL'; }).length;
var j4 = carrB.filter(function (e) { return e.cod === 'hTHNLqzL' && e.fecha < CORTE_J7; }).length;
var j7 = totalAmb - j4;
console.log('   aparece en ' + enFilas.length + ' fila(s): ' + enFilas.map(function (x) { return x.fila + ' (' + x.tp + ')'; }).join(' · '));
console.log('   reparto: J4 ' + j4 + ' + J7 ' + j7 + ' = ' + (j4 + j7) + '   ·   el código tiene ' + totalAmb + ' carritos en total');
if (j4 + j7 !== totalAmb) mal('D', 'el reparto no suma el total del código');
if (enFilas.length !== 2) mal('D', 'debería aparecer exactamente en 2 filas, aparece en ' + enFilas.length);
console.log('   ' + (j4 + j7 === totalAmb && enFilas.length === 2 ? '✔ sin doble conteo' : '🔴'));

// ══ E · EL EMAIL DEL J9 CONTRA SFMC ══════════════════════════════════════════════════
console.log('\n── E · E-J9: la hoja contra el detalle de SFMC (job 1311353, 19-sep)');
var SFMC = { Principal_Sends: 40130, Principal_Deliveries: 39804, Principal_Opens: 15080, Principal_Clicks: 86, Principal_Unsubs: 27 };
var eOk = 0;
Object.keys(SFMC).forEach(function (n) {
  var hoja = v(n, 24);
  var ig = num(hoja) === SFMC[n];
  if (ig) eOk++; else mal('E', 'E-J9 «' + n + '»: hoja ' + hoja + ' vs SFMC ' + SFMC[n]);
  console.log('   ' + (ig ? '✔' : '🔴') + ' ' + n.padEnd(22) + String(hoja).padStart(8) + '   SFMC ' + SFMC[n]);
});
var or = v('Principal_Open_Rate', 24), ctor = v('Principal_CTOR', 24);
var orReal = SFMC.Principal_Opens / SFMC.Principal_Deliveries;
console.log('   ' + (cerca(num(or), orReal, 0.001) ? '✔' : '🔴') + ' Open_Rate             ' + String(or).padStart(8) + '   calculado ' + orReal.toFixed(4) + '  (= 37.9%, lo que dijiste)');
if (!cerca(num(or), orReal, 0.001)) mal('E', 'Open_Rate no cuadra');
if (!cerca(num(ctor), SFMC.Principal_Clicks / SFMC.Principal_Opens, 0.001)) mal('E', 'CTOR no cuadra');

// ══ F · LOS TOTALES ══════════════════════════════════════════════════════════════════
console.log('\n── F · totales de la hoja');
var sC = 0, sW = 0, sCh = 0, sIT = 0, sIN = 0;
resumen.forEach(function (x) {
  if (x.hoja !== null) sC += x.hoja;
  sW += num(v('Carritos_Walmart', x.fila)); sCh += num(v('Carritos_Chedraui', x.fila));
  sIT += num(v('Intencion_Total_MXN', x.fila)); sIN += num(v('Intencion_Nestle_MXN', x.fila));
});
console.log('   carritos ' + sC + '   (Walmart ' + sW + ' · Chedraui ' + sCh + ' · sin tienda ' + (sC - sW - sCh) + ')');
console.log('   intención total $' + sIT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  '   ·   Nestlé $' + sIN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  '   ·   penetración ' + (100 * sIN / sIT).toFixed(1) + '%');
if (sW + sCh > sC) mal('F', 'Walmart+Chedraui supera el total de carritos');

// ══ VEREDICTO ════════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════');
if (FALLOS.length) {
  console.log('🔴 ' + FALLOS.length + ' FALLO(S):');
  FALLOS.forEach(function (f) { console.log('   · ' + f); });
} else console.log('✅ SIN FALLOS — cada touchpoint y cada dato agregado cuadra con su fuente.');
if (AVISOS.length) { console.log('\n⚠ ' + AVISOS.length + ' aviso(s):'); AVISOS.forEach(function (a) { console.log('   · ' + a); }); }
fs.writeFileSync(BACK + '/_preescritura/maggi-validacion.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), fallos: FALLOS, avisos: AVISOS,
  filas: resumen, totales: { carritos: sC, walmart: sW, chedraui: sCh, intencion_total: sIT, intencion_nestle: sIN }
}, null, 1));
console.log('\n→ _preescritura/maggi-validacion.json');
process.exit(FALLOS.length ? 1 : 0);
