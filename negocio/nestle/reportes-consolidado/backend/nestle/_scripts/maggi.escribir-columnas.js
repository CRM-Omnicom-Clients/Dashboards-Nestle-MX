/*
 * maggi.escribir-columnas.js — LLENAR LAS 6 COLUMNAS QUE PIDIÓ RICK EN «Maggi Reporte».
 *
 * 🔴 LO QUE RICK DIJO, Y QUE MANDA SOBRE TODO LO DEMÁS (21-sep-2026):
 *      1. «Los demás datos que ya están atribuidos no se modifican»
 *      2. «Lo más importante son los datos de qcart»
 *      3. «Las tasas calculadas no las modificas»
 *      4. «Formato no lo rompes»
 *      5. «Vamos a agregar datos del J9»
 *      «No modificas las columnas que eliminé ni los datos que agregué, solo lo que te pedí»
 *
 * 🔴 POR ESO ESTE SCRIPT SOLO TOCA CELDAS VACÍAS — con UNA excepción declarada: la columna
 *    `SHORTLINKS ASIGNADOS`, donde Rick había escrito el NOMBRE del shortlink («Piñarindo_W»)
 *    y no su código. El nombre no se pierde: reaparece completo en `RECETAS ASIGNADAS`, que es
 *    la columna cuyo encabezado lo describe. Cada sustitución se imprime antes y después.
 *
 * 🔴 UNA COLUMNA SE PIDE, NO SE ESCRIBE. Todo pasa por `lib-columna.de()`, que resuelve contra
 *    el catálogo raíz y truena si no existe. Leer `fila['TouchPoint']` por literal devuelve
 *    `undefined` sin avisar, y `undefined` se lee como «vacío».
 *
 * 🔴 NO ESCRIBE CON SheetJS. `XLSX.writeFile` se lleva por delante los estilos de la hoja —
 *    ya pasó y costó el formato de 56 columnas. Aquí se edita el XML con `adm-zip` y
 *    `lib-celda-xml.poner()`, que además INSERTA EN ORDEN DE COLUMNA (una celda fuera de orden
 *    hace que Excel se niegue a abrir el libro, y las 4 capas pasan en verde igual).
 *
 * 🔴 LO QUE **NO** HACE, a propósito:
 *    · No recalcula ni una cifra de carritos de las filas que ya las traen. Son de Rick.
 *    · No inventa las columnas de métricas Qcart del J9: salen del pipeline (ventana + match
 *      Nestlé) y ese match no existe en este backend. Van `POR DEFINIR` y el dato crudo se
 *      reporta aparte. Rellenarlas a ojo sería inventar una atribución.
 *
 *   node maggi.escribir-columnas.js              (seco — imprime lo que haría)
 *   node maggi.escribir-columnas.js --escribir
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
var HOJA = 'Maggi Reporte';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_maggi-esc.xlsx';

/* ── fechas ───────────────────────────────────────────────────────────────────────
   🔴 El convertidor se COMPRUEBA contra una celda que ya existe antes de usarlo. Un
   desfase de un día en el ancla movería todas las ventanas sin que nada truene.      */
function serial(iso) {
  var d = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((d - Date.UTC(1899, 11, 30)) / 86400000);
}
var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dm(iso) { return iso.slice(8, 10) + '-' + MES[+iso.slice(5, 7) - 1]; }

/* ── el crudo de Qcart, para verificar los repartos por fecha ─────────────────────── */
var DIRQ = PROY + '/ReportesQcart/_vigentes';
function filasCrudas() {
  var out = [];
  fs.readdirSync(DIRQ).filter(function (f) { return /\.csv$/i.test(f) && /-raw-/.test(f) && !/products/i.test(f); })
    .forEach(function (a) {
      var txt = fs.readFileSync(DIRQ + '/' + a, 'utf8').replace(/^﻿/, '');
      var LN = txt.split(/\r?\n/).filter(function (x) { return x.trim(); });
      var enc = LN[0].split(';').map(function (x) { return t(x).replace(/^"|"$/g, ''); });
      LN.slice(1).forEach(function (l) {
        var celdas = [], act = '', dentro = false;
        for (var i = 0; i < l.length; i++) {
          var ch = l.charAt(i);
          if (ch === '"') { dentro = !dentro; act += ch; continue; }
          if (ch === ';' && !dentro) { celdas.push(act); act = ''; continue; }
          act += ch;
        }
        celdas.push(act);
        var o = {}; enc.forEach(function (h, i2) { o[h] = t(celdas[i2]).replace(/^"|"$/g, ''); });
        out.push(o);
      });
    });
  return out;
}

/* ── el BLOQUE de Qcart (`qcart.json`) — el histórico acumulado ────────────────────
   🔴 CADA PREGUNTA A LA FUENTE QUE DE VERDAD LA CUBRE, Y DICIENDO CUÁL.
      · El BLOQUE es la autoridad para los códigos que el catálogo YA conoce: arrastra
        marzo-agosto (`Fullcarritos-MarzoAgosto.csv`), que ya no está en `_vigentes`.
      · El CRUDO es la autoridad para el J9: sus links no tienen alta todavía —la está
        haciendo otra sesión— así que el filtro del bloque descarta parte de sus eventos
        por «ajenos» y el bloque se queda corto (34 de 48).
      Medir `hTHNLqzL` contra el crudo daba 26 carritos y un arranque el 1-sep; contra el
      bloque da 62 y arranca el 15-ago, que es el día que salió E-J4. La diferencia no es
      un matiz: cambiaba el reparto de 48/14 a 2/24.                                      */
function eventosBloque() {
  var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
  return Q.carritos || [];
}

/* ══ EL REPARTO POR FECHAS DEL CÓDIGO AMBIGUO ════════════════════════════════════════
   🔴 `hTHNLqzL` está declarado en DOS jornadas (Agosto/e-j4 y Septiembre/e-j7). No se
   elige una: se parte por la fecha en que salió la segunda, y las dos celdas se marcan
   en ROJO para que se vea que llevan una atribución partida. Lo pidió Rick así.        */
var CORTE_J7 = '2026-09-04';
function repartoAmbiguo(bloque) {
  var antes = 0, desde = 0, dias = { min: null, max: null };
  bloque.forEach(function (e) {
    if (t(e.shortlink_code) !== 'hTHNLqzL') return;
    var d = t(e.fecha).slice(0, 10); if (!d) return;
    if (!dias.min || d < dias.min) dias.min = d;
    if (!dias.max || d > dias.max) dias.max = d;
    if (d < CORTE_J7) antes++; else desde++;
  });
  return { antes: antes, desde: desde, dias: dias };
}

/* ══ EL J9, medido ═══════════════════════════════════════════════════════════════════
   Email: del detalle de SFMC (`CRM_Email_Detalle`, job 1311353 del 19-sep). Los dos jobs
   de 1 envío del 18-sep son PRUEBAS y se restan — el umbral (<10) vive en un solo sitio,
   `lib-fechas-envio.js`, y es el mismo que usa la fecha. Por eso aquí son 40,130 y no los
   40,132 que suma la DE agregada.                                                        */
var J9 = {
  emailName: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J9-B-C_AQ_EM_A_NA_3074970',
  subject: 'El clásico de clásicos también se juega en la mesa',
  envio: '2026-09-19',
  sends: 40130, deliv: 39804, opens: 15080, clicks: 86, unsubs: 27,
  email: { codigos: ['bfQ24tDq', 'xTaSfQ2y'], recetas: ['Alitas con salsa mango habanero al horno', 'Tropi MAGGI® Shot'], utm: 'e-j9' },
  wa: { codigos: ['ymh2OT4x'], recetas: ['Alitas con salsa mango habanero al horno'], utm: 'wa-j9' }
};

// ══════════════════════════════════════════════════════════════════════════════════════
console.log('════════ Maggi Reporte · LLENAR LAS 6 COLUMNAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

fs.copyFileSync(VIVO, TMP);
var wb = XLSX.readFile(TMP, { cellStyles: true });
var ws = wb.Sheets[HOJA];
if (!ws) { console.log('🔴 no existe la hoja «' + HOJA + '»'); process.exit(1); }

// ── el convertidor de fechas, comprobado contra HECHOS, no contra una celda ───────────
//
// 🔴 EL ANCLA ESTABA ATADA A UN DATO QUE PUEDE CAMBIAR (corregido 30-sep-2026). Exigía que la
//    celda `N23` valiera el serial de 2026-09-12. `N` es `Principal_Fecha_Envio` y la fila 23 es
//    E-J7: en cuanto el reporte trajo otra fecha para esa pieza —4-sep en vez de 12-sep, que es
//    un dato legítimo— la comprobación falló y el paso se negó a escribir, culpando al convertidor.
//    La intención era buena (un desfase de un día movería todas las ventanas sin que nada truene)
//    pero la prueba no era del convertidor: era de la celda.
//    Ahora se prueba la ARITMÉTICA, que no se desfasa: tres pares fecha↔serial conocidos, incluido
//    el bug histórico del año bisiesto 1900 que Excel arrastra. Si el convertidor está bien, esto
//    pasa siempre; si alguien lo toca, falla siempre. Eso sí es una calibración.
// ⚠ nada de fechas de 1900: Excel arrastra el bug del año bisiesto y sus seriales ≤60 están
//   corridos un día. Mi primer par era 1900-01-01 → 1 y la comprobación falló contra su propio
//   convertidor, que es correcto para todo lo posterior a 1900-02-28 — o sea, para todo dato real.
//   Los tres pares son de esta semana y están CORROBORADOS fuera del sistema: 46289 es la fecha de
//   envío que el maestro declara para uCV8KGHm y coincide con el envío del 24-sep de la hoja de
//   WhatsApp; 46291 son sus dos envíos del 26-sep.
var PARES = [['2026-09-12', 46277], ['2026-09-24', 46289], ['2026-09-26', 46291]];
var malCal = PARES.filter(function (p) { return serial(p[0]) !== p[1]; });
if (malCal.length) {
  console.log('🔴 el convertidor de fechas NO cuadra: ' +
    malCal.map(function (p) { return p[0] + ' → ' + serial(p[0]) + ', debería ser ' + p[1]; }).join(' · ') + '. No escribo nada.');
  process.exit(1);
}
console.log('  ✔ convertidor de fechas comprobado contra ' + PARES.length + ' pares fecha↔serial\n');

// ── las columnas: se PIDEN por id lógico, nunca por letra ni por literal ─────────────
var FILAS = XLSX.utils.sheet_to_json(ws, { defval: '' });
var LETRA = {};
var R = XLSX.utils.decode_range(ws['!ref']);
for (var c = R.s.c; c <= R.e.c; c++) {
  var h = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) LETRA[t(h.v)] = XLSX.utils.encode_col(c);
}
var _cacheNom = {};
function NOM(id) {
  if (_cacheNom[id] === undefined) _cacheNom[id] = COL.de(FILAS, id, AMBITO);
  return _cacheNom[id];
}
function L(id) {
  var n = NOM(id);
  if (!LETRA[n]) throw new Error('la hoja no tiene la columna «' + n + '» — no invento su letra');
  return LETRA[n];
}
var SEIS = ['RECETAS ASIGNADAS', 'SHORTLINKS ASIGNADOS', 'UTMS CONTENT ORIGEN', 'UTMS CONTENT MODIFICADAS', 'Medición desde', 'Medición hasta'];
SEIS.forEach(function (n) { L(n); });
console.log('  ✔ las 6 columnas resueltas: ' + SEIS.map(function (n) { return L(n); }).join(' · ') + '\n');

// ── el reparto del ambiguo, verificado contra el crudo ───────────────────────────────
var crudo = filasCrudas();
var bloque = eventosBloque();
var rep = repartoAmbiguo(bloque);
// 🔴 la contraprueba: cuánto vería si preguntara al crudo. Si el crudo trae MÁS que el
//    bloque para este código, el bloque estaría incompleto y habría que pararse a mirar.
var repCrudo = { n: 0, min: null };
crudo.forEach(function (o) {
  if (t(o['shortlink code']) !== 'hTHNLqzL') return;
  var d = t(o['date']).slice(0, 10); if (!d) return;
  repCrudo.n++; if (!repCrudo.min || d < repCrudo.min) repCrudo.min = d;
});
if (repCrudo.n > rep.antes + rep.desde) {
  console.log('🔴 el crudo trae MÁS carritos de hTHNLqzL (' + repCrudo.n + ') que el bloque (' +
    (rep.antes + rep.desde) + '). El bloque estaría incompleto — no escribo.');
  process.exit(1);
}
console.log('  ── hTHNLqzL · reparto por fecha (corte = ' + CORTE_J7 + ', el día que salió E-J7)');
console.log('     fuente = BLOQUE (el crudo de _vigentes solo ve ' + repCrudo.n + ' desde ' + repCrudo.min + ': no cubre agosto)');
console.log('     J4  ' + rep.dias.min + ' → antes del corte : ' + rep.antes + ' carritos');
console.log('     J7  desde el corte → ' + rep.dias.max + ' : ' + rep.desde + ' carritos');
console.log('     total ' + (rep.antes + rep.desde) + '\n');
if (!rep.antes || !rep.desde) { console.log('🔴 el reparto no da dos lados. No escribo.'); process.exit(1); }

var TXT_J4 = 'hTHNLqzL (' + dm(rep.dias.min) + '→' + dm(CORTE_J7) + ' · ' + rep.antes + ' carritos)';
var TXT_J7 = 'hTHNLqzL (' + dm(CORTE_J7) + '→' + dm(rep.dias.max) + ' · ' + rep.desde + ' carritos)';

// ══ LA TABLA DE CELDAS ═══════════════════════════════════════════════════════════════
var TAB = JSON.parse(fs.readFileSync(BACK + '/_preescritura/maggi-columnas.json', 'utf8')).tabla;
var celdas = [];   // { ref, valor, porque, pisa, rojo }
function pon(ref, valor, porque, opts) {
  opts = opts || {};
  var act = ws[ref];
  var vacia = (act === undefined || act.t === 'z' || t(act.v) === '');
  if (!vacia && !opts.pisar) return;                       // 🔴 lo que Rick ya escribió, se queda
  celdas.push({ ref: ref, valor: valor, porque: porque, pisa: vacia ? null : act.v, rojo: !!opts.rojo });
}

var SIN_LINK = [10, 11, 12];          // ni receta ni shortlink: no existen en el maestro
var CERO = [7, 8, 9, 19];             // 🔴 SÍ hay link y receta, y dio CERO carritos → 0 literal

TAB.forEach(function (f) {
  var r = f.fila, v = f.valores || {};
  var sinLink = SIN_LINK.indexOf(r) >= 0;

  // 1 · RECETAS — vacía en las 22 filas
  pon(L('RECETAS ASIGNADAS') + r, sinLink ? 'N/A' : (v['RECETAS ASIGNADAS'] || 'N/A'),
    sinLink ? 'el maestro no declara ningún link para este touchpoint' : 'recetas del maestro de links');

  // 2 · SHORTLINKS — 🔴 la única columna donde se PISA, y solo el nombre por el código
  var cod = v['SHORTLINKS ASIGNADOS'] || '';
  if (r === 17) cod = cod.replace('hTHNLqzL', TXT_J4);
  if (r === 21) cod = cod.replace('hTHNLqzL', TXT_J7);
  pon(L('SHORTLINKS ASIGNADOS') + r, sinLink ? 'N/A' : (cod || 'N/A'),
    sinLink ? 'el maestro no declara ningún link' : 'los códigos del maestro; el nombre que había pasa a RECETAS ASIGNADAS',
    { pisar: true, rojo: (r === 17 || r === 21) });

  // 3 y 4 · los utm
  pon(L('UTMS CONTENT ORIGEN') + r, sinLink ? 'N/A' : (v['UTMS CONTENT ORIGEN'] || 'N/A'), 'utm_content declarado en el maestro');
  pon(L('UTMS CONTENT MODIFICADAS') + r, sinLink ? 'N/A' : (v['UTMS CONTENT MODIFICADAS'] || 'N/A'), 'utm_content como llega en el crudo de Qcart');

  // 5 y 6 · la ventana — solo si está vacía
  var d = f.iso && f.iso.desde, hh = f.iso && f.iso.hasta;
  pon(L('Medición desde') + r, d ? serial(d) : 'N/A', d ? 'primer carrito del link' : 'el link no registró ningún carrito');
  pon(L('Medición hasta') + r, hh ? serial(hh) : 'N/A', hh ? 'último carrito del link' : 'el link no registró ningún carrito');

  // 🔴 EL CERO LITERAL — lo pidió Rick. Solo en los CONTEOS e importes, nunca en las tasas:
  //    un ticket o una penetración con cero carritos no es 0, es indefinido, y la regla 3 dice
  //    que las tasas no se tocan.
  if (CERO.indexOf(r) >= 0) {
    ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle'].forEach(function (n) {
      pon(L(n) + r, 0, 'el link existe y no registró carritos — cero medido, no vacío');
    });
    ['Intencion_Total_MXN', 'Intencion_Nestle_MXN'].forEach(function (n) {
      pon(L(n) + r, '$0.00', 'el link existe y no registró carritos (la columna es texto en esta hoja)');
    });
  }
});

// ══ LAS DOS FILAS DEL J9 ═════════════════════════════════════════════════════════════
// Se clona la identidad de la fila hermana del J8 (22 = WA, 23 = email) y se sustituye lo
// que cambia. Clonar evita inventar el formato y las convenciones de la hoja.
function carritosDe(cods) {
  var n = 0, dias = { min: null, max: null };
  crudo.forEach(function (o) {
    if (cods.indexOf(t(o['shortlink code'])) < 0) return;
    var d = t(o['date']).slice(0, 10); if (!d) return;
    n++; if (!dias.min || d < dias.min) dias.min = d; if (!dias.max || d > dias.max) dias.max = d;
  });
  return { n: n, dias: dias };
}
function carritosBloque(cods) {
  var n = 0, min = null;
  bloque.forEach(function (e) {
    if (cods.indexOf(t(e.shortlink_code)) < 0) return;
    var d = t(e.fecha).slice(0, 10); if (!d) return;
    n++; if (!min || d < min) min = d;
  });
  return { n: n, min: min };
}
var qE = carritosDe(J9.email.codigos), qW = carritosDe(J9.wa.codigos);
var bE = carritosBloque(J9.email.codigos), bW = carritosBloque(J9.wa.codigos);
console.log('  ── J9 · fuente = CRUDO (sus links no tienen alta, el bloque descarta parte por «ajenos»)');
console.log('     E-J9  (' + J9.email.codigos.join(' · ') + ')  crudo ' + qE.n + ' carritos  ' + qE.dias.min + ' → ' + qE.dias.max +
  '   ·   el bloque solo ve ' + bE.n + ' desde ' + bE.min);
console.log('     WA-J9 (' + J9.wa.codigos.join(' · ') + ')  crudo ' + qW.n + ' carritos  ' + qW.dias.min + ' → ' + qW.dias.max +
  '   ·   el bloque solo ve ' + bW.n + ' desde ' + bW.min + '\n');

var NUEVAS = [
  { fila: 24, base: 23, tp: 'E-J9', medio: 'email', q: J9.email, qq: qE, conEmail: true },
  { fila: 25, base: 22, tp: 'WA-J9', medio: 'whatsapp', q: J9.wa, qq: qW, conEmail: false }
];
var METRICAS_QCART = ['Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Clicks vs Carritos',
  'Views_Carrito', 'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN',
  'Pct_Penetracion_Nestle', 'Ticket_Carrito_MXN', 'Ticket_Producto_MXN'];
var COLS_WA = ['WA-Envíos', 'WA-Entregados', 'WA-No entregados', 'WA-Leídos', 'WA-Clicks Qcart'];
var COLS_WA_PCT = ['WA-Clicks-Recetas', 'WA-%Entrega', 'WA-%No entrega', 'WA-%Read vs entrega', 'WA-%Click vs Read'];
var COLS_PRINC = ['Principal_Fecha_Envio', 'Principal_Sends', 'Principal_Deliveries', 'Principal_Opens',
  'Principal_Clicks', 'Principal_Unsubs', 'Principal_Open_Rate', 'Principal_CTOR',
  'Principal_Click_Rate', 'Principal_UTOR (vs opens)'];

var filasNuevas = [];
NUEVAS.forEach(function (N) {
  var val = {};
  // identidad: se copia de la hermana, salvo lo que cambia
  Object.keys(LETRA).forEach(function (nom) {
    var b = ws[LETRA[nom] + N.base];
    val[nom] = (b === undefined || b.t === 'z') ? null : b.v;
  });
  val[NOM('TouchPoint')] = N.tp;
  val[NOM('Medio')] = N.medio;
  val[NOM('Segmento')] = 'Región unificada · Partición B';
  val[NOM('Quincena_Lanzamiento Principal')] = '2026-09-Q2';
  val[NOM('RECETAS ASIGNADAS')] = N.q.recetas.join(' · ');
  val[NOM('SHORTLINKS ASIGNADOS')] = N.q.codigos.join(' · ');
  val[NOM('UTMS CONTENT ORIGEN')] = N.q.utm;
  val[NOM('UTMS CONTENT MODIFICADAS')] = N.q.utm;
  val[NOM('Medición desde')] = N.qq.dias.min ? serial(N.qq.dias.min) : 'POR DEFINIR';
  val[NOM('Medición hasta')] = N.qq.dias.max ? serial(N.qq.dias.max) : 'POR DEFINIR';

  if (N.conEmail) {
    val[NOM('Email Name SFMC_Principal')] = J9.emailName;
    val[NOM('Principal_Subject')] = J9.subject;
    val[NOM('Principal_Fecha_Envio')] = serial(J9.envio);
    val[NOM('Principal_Sends')] = J9.sends;
    val[NOM('Principal_Deliveries')] = J9.deliv;
    val[NOM('Principal_Opens')] = J9.opens;
    val[NOM('Principal_Clicks')] = J9.clicks;
    val[NOM('Principal_Unsubs')] = J9.unsubs;
    val[NOM('Principal_Open_Rate')] = +(J9.opens / J9.deliv).toFixed(3);
    val[NOM('Principal_CTOR')] = +(J9.clicks / J9.opens).toFixed(3);
    val[NOM('Principal_Click_Rate')] = +(J9.clicks / J9.deliv).toFixed(3);
    val[NOM('Principal_UTOR (vs opens)')] = +(J9.unsubs / J9.opens).toFixed(3);
    val[NOM('Clicks')] = J9.clicks;
    COLS_WA.forEach(function (n) { val[NOM(n)] = 0; });
  } else {
    // 🔴 WhatsApp del J9: Rick todavía no ha pasado la fuente. No se inventa ni un número.
    val[NOM('Email Name SFMC_Principal')] = 'N/A';
    val[NOM('Principal_Subject')] = 'N/A';
    COLS_PRINC.forEach(function (n) { val[NOM(n)] = 'N/A'; });
    COLS_WA.forEach(function (n) { val[NOM(n)] = 'POR DEFINIR'; });
    COLS_WA_PCT.forEach(function (n) { val[NOM(n)] = 'POR DEFINIR'; });
    val[NOM('Clicks')] = 'POR DEFINIR';
  }
  // 🔴 las métricas de Qcart salen del pipeline (ventana + match Nestlé). No se inventan.
  METRICAS_QCART.forEach(function (n) { val[NOM(n)] = 'POR DEFINIR'; });

  filasNuevas.push({ fila: N.fila, base: N.base, tp: N.tp, val: val });
});

// ══ EL SECO ══════════════════════════════════════════════════════════════════════════
var pisadas = celdas.filter(function (x) { return x.pisa !== null; });
console.log('  ── celdas a escribir en las filas 2-23: ' + celdas.length +
  '   (vacías ' + (celdas.length - pisadas.length) + ' · se pisan ' + pisadas.length + ')');
console.log('  ── filas nuevas: ' + filasNuevas.map(function (f) { return f.fila + ' (' + f.tp + ')'; }).join(' · '));
console.log('');
if (pisadas.length) {
  console.log('  🔴 LAS ÚNICAS CELDAS QUE SE PISAN — todas de «' + NOM('SHORTLINKS ASIGNADOS') + '»:');
  pisadas.forEach(function (x) {
    console.log('     ' + x.ref.padEnd(6) + JSON.stringify(x.pisa));
    console.log('     ' + ''.padEnd(6) + '  →  ' + JSON.stringify(x.valor) + (x.rojo ? '   [ROJO]' : ''));
  });
  console.log('');
}

fs.writeFileSync(BACK + '/_preescritura/maggi-escritura.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  reparto_ambiguo: rep, j9: { email: qE, wa: qW },
  celdas: celdas, filas_nuevas: filasNuevas
}, null, 1));
console.log('  → _preescritura/maggi-escritura.json\n');

if (!ESCRIBIR) { console.log('  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ══ ESCRIBIR ═════════════════════════════════════════════════════════════════════════
try { fs.closeSync(fs.openSync(VIVO, 'r+')); }
catch (e) { console.log('🔴 el libro está BLOQUEADO (' + e.code + '). Ciérralo en Excel. No escribo.'); process.exit(1); }

var zip = new AdmZip(VIVO);
var wbx = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
var rels = zip.getEntry('xl/_rels/workbook.xml.rels').getData().toString('utf8');
var mSh = new RegExp('<sheet[^>]*name="' + HOJA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*r:id="([^"]+)"').exec(wbx);
if (!mSh) { console.log('🔴 no encuentro la hoja en workbook.xml'); process.exit(1); }
var mRel = new RegExp('<Relationship[^>]*Id="' + mSh[1] + '"[^>]*Target="([^"]+)"').exec(rels);
var parte = 'xl/' + mRel[1].replace(/^\/?xl\//, '');
var xml = zip.getEntry(parte).getData().toString('utf8');
console.log('  parte de la hoja: ' + parte);

// ── el estilo ROJO: se clona la fuente que ya usa la celda y se le cambia el color ───
var estilos = zip.getEntry('xl/styles.xml').getData().toString('utf8');
function xfsDe(s) { var m = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(s); return m[1].match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) || []; }
function fontsDe(s) { var m = /<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(s); return m[1].match(/<font>[\s\S]*?<\/font>|<font\/>/g) || []; }
var cacheRojo = {};
function estiloRojo(sBase) {
  var k = String(sBase);
  if (cacheRojo[k] !== undefined) return cacheRojo[k];
  var xfs = xfsDe(estilos), fonts = fontsDe(estilos);
  var xf = xfs[+sBase || 0] || '<xf/>';
  var fid = (/fontId="(\d+)"/.exec(xf) || [, '0'])[1];
  var base = fonts[+fid] || '<font/>';
  var nuevo = base.replace(/<color[^>]*\/>/g, '').replace('<font>', '<font><color rgb="FFFF0000"/>');
  if (nuevo === base) nuevo = '<font><color rgb="FFFF0000"/></font>';
  fonts.push(nuevo);
  var nfid = fonts.length - 1;
  var nxf = xf.replace(/fontId="\d+"/, 'fontId="' + nfid + '"');
  if (nxf === xf) nxf = xf.replace(/^<xf/, '<xf fontId="' + nfid + '"');
  if (!/applyFont=/.test(nxf)) nxf = nxf.replace(/^<xf/, '<xf applyFont="1"');
  xfs.push(nxf);
  var nsid = xfs.length - 1;
  estilos = estilos
    .replace(/<fonts[^>]*>[\s\S]*?<\/fonts>/, '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>')
    .replace(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/, '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>');
  cacheRojo[k] = nsid;
  return nsid;
}

// ── aplicar las celdas de las filas 2-23 ────────────────────────────────────────────
var como = {};
celdas.forEach(function (x) {
  var est = CX.estiloDe(xml, x.ref);
  if (x.rojo) est = String(estiloRojo(est === undefined ? 0 : est));
  var res = CX.poner(xml, x.ref, CX.celda(x.ref, x.valor, est), +/(\d+)$/.exec(x.ref)[1]);
  xml = res.xml; como[res.como] = (como[res.como] || 0) + 1;
});
console.log('  celdas aplicadas: ' + Object.keys(como).map(function (k) { return k + ' ' + como[k]; }).join(' · '));

// ── las filas nuevas ────────────────────────────────────────────────────────────────
filasNuevas.forEach(function (F) {
  // 🔴 UNA FILA AUTOCERRADA EXISTE Y NO ADMITE CELDAS. Rick había dejado `<row r="24" ht=…/>`
  //    (solo la altura, sin contenido). `poner()` busca `<row …>…</row>` para insertar dentro,
  //    no la encuentra, y devuelve `sin fila`: **escribe cero celdas y no falla**. La primera
  //    versión de esto dio «fila 24 escrita» con la fila vacía en disco. Hay que ABRIRLA, y
  //    conservando sus atributos: ahí vive la altura que puso él.
  var mAuto = new RegExp('<row r="' + F.fila + '"([^>]*)\\/>').exec(xml);
  if (mAuto) {
    xml = xml.replace(mAuto[0], '<row r="' + F.fila + '"' + mAuto[1] + '></row>');
    console.log('  fila ' + F.fila + ': estaba autocerrada — abierta conservando sus atributos');
  }
  var existe = new RegExp('<row r="' + F.fila + '"').test(xml);
  if (!existe) {
    var mBase = new RegExp('<row r="' + F.base + '"(?![^>]*\\/>)([^>]*)>').exec(xml);
    var attrs = mBase ? mBase[1].replace(/\s*r="\d+"/, '').replace(/\s*spans="[^"]*"/, '') : '';
    var nueva = '<row r="' + F.fila + '"' + attrs + '></row>';
    var puesto = false;
    xml = xml.replace(/<sheetData>([\s\S]*?)<\/sheetData>/, function (todo, dentro) {
      var fs2 = [];
      dentro.replace(/<row r="(\d+)"(?:[^>]*\/>|[^>]*>[\s\S]*?<\/row>)/g, function (tt, n) { fs2.push({ n: +n, xml: tt }); return tt; });
      var i = 0; while (i < fs2.length && fs2[i].n < F.fila) i++;
      fs2.splice(i, 0, { n: F.fila, xml: nueva });
      puesto = true;
      return '<sheetData>' + fs2.map(function (z) { return z.xml; }).join('') + '</sheetData>';
    });
    if (!puesto) { console.log('🔴 no pude insertar la fila ' + F.fila); process.exit(1); }
  }
  // 🔴 SE COMPRUEBA EL RETORNO. `poner` devuelve `como`, y `sin fila` significa que NO escribió.
  //    Ignorarlo fue exactamente lo que hizo que se anunciaran dos filas que estaban vacías.
  var puestas = 0, sinFila = [];
  Object.keys(F.val).forEach(function (nom) {
    var v = F.val[nom]; if (v === null || v === undefined) return;
    var ref = LETRA[nom] + F.fila;
    var est = CX.estiloDe(xml, LETRA[nom] + F.base);
    var r2 = CX.poner(xml, ref, CX.celda(ref, v, est), F.fila);
    xml = r2.xml;
    if (r2.como === 'sin fila') sinFila.push(ref); else puestas++;
  });
  if (sinFila.length) {
    console.log('🔴 ' + sinFila.length + ' celda(s) de la fila ' + F.fila + ' no se pudieron colocar (' +
      sinFila.slice(0, 6).join(' ') + '). No declaro esta fila escrita.');
    process.exit(1);
  }
  console.log('  fila ' + F.fila + ' (' + F.tp + '): ' + puestas + ' celdas' + (existe ? '' : ' [fila creada]'));
});

// ── guardar ─────────────────────────────────────────────────────────────────────────
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.updateFile('xl/styles.xml', Buffer.from(estilos, 'utf8'));
zip.writeZip(VIVO);
console.log('\n  ✔ escrito. Ahora las 5 capas.\n');

// ══ LAS 5 CAPAS ══════════════════════════════════════════════════════════════════════
var T = require(__dirname + '/lib-entorno.js').TOOLS;
var NODE = require(__dirname + '/lib-entorno.js').TOOLS + '/node/node.exe';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var CAPAS = [
  [NODE, [T + '/xlsx-safe-save.js', VIVO]],
  [NODE, [T + '/xlsx-label.js', VIVO]],
  [NODE, [T + '/xlsx-check.js', VIVO]],
  [PY, [T + '/xlsx-validar-fondo.py', VIVO]],
  [NODE, [T + '/xlsx-orden-celdas.js', VIVO]]
];
var fallo = 0;
CAPAS.forEach(function (cc) {
  var nom = String(cc[1][0]).split('/').pop();
  try {
    var out = cp.execFileSync(cc[0], cc[1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('  ✔ ' + nom.padEnd(24) + out.trim().split('\n').slice(-2).join(' | ').slice(0, 150));
  } catch (e) {
    fallo++;
    console.log('  🔴 ' + nom.padEnd(24) + String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-3).join(' | ').slice(0, 300));
  }
});
console.log('\n' + (fallo ? '  🔴 ' + fallo + ' capa(s) fallaron — NO declares que quedó bien' : '  ✅ las 5 capas en verde'));
