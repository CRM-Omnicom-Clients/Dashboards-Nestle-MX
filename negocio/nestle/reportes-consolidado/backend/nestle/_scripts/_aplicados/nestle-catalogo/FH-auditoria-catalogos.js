// FH-auditoria-catalogos.js — H1: la auditoría 100% de TODOS los catálogos.
//
// 🔴 LO QUE PIDIÓ RICK, LITERAL: «todos los catálogos, todos los [campos] de datos, fechas, id,
//    cada columna de cada canal al 100%, bien revisado, QUÉ ESTÁ Y QUÉ NO ESTÁ, cuadrado con los
//    datos reales».
//
// 🔴 LA DIFERENCIA ENTRE «VACÍA» Y «FALTA». Una columna vacía no es necesariamente un hueco: la
//    mascota solo aplica a Purina, y el CTOR de WhatsApp no aplica al email. Este auditor no
//    cuenta celdas vacías: mide **cobertura DENTRO del universo al que la columna aplica**. Decir
//    «Mascota está 95% vacía» sería cierto y completamente inútil.
//
// 🔴 Y CUADRA CONTRA LOS DATOS REALES, no contra sí mismo. Cada cifra del catálogo se compara con
//    la hoja de datos que la respalda. Un catálogo coherente consigo mismo pero desalineado de los
//    datos es exactamente el defecto que este sistema existe para atrapar.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { return Number(String(v).replace(/[, $%]/g, '')) || 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var FALTA = [], AVISO = [];

var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_fh.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
function hoja(n) { return wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', blankrows: false }) : []; }
var P = hoja('Catalogo_Piezas'), Rf = hoja('Catalogo_Referencias');
var E = hoja('Data_Email'), W = hoja('Data_WhatsApp'),
  QC = hoja('Data_Qcart_Carritos'), QP = hoja('Data_Qcart_Productos');

console.log('════════ H1 · AUDITORÍA 100% DE LOS CATÁLOGOS ════════');
console.log('  archivo: ' + vivo.archivo);
console.log('  Catalogo_Piezas ' + P.length + '×' + Object.keys(P[0] || {}).length +
  '   ·   Catalogo_Referencias ' + Rf.length + '×' + Object.keys(Rf[0] || {}).length + '\n');

// ── el canal de cada pieza, que decide qué columnas le APLICAN ─────────────────────────────
function canalDe(p) {
  var c = t(p['Canal']).toLowerCase(), tp = t(p['Touchpoint']);
  if (/whats|wa/.test(c) || /^WA/i.test(tp)) return 'WhatsApp';
  if (/email|mail/.test(c) || /^E-/i.test(tp)) return 'Email';
  return '(sin canal)';
}
var porCanal = {};
P.forEach(function (p) { var k = canalDe(p); (porCanal[k] = porCanal[k] || []).push(p); });
console.log('  ── piezas por canal');
Object.keys(porCanal).forEach(function (k) { console.log('     ' + k.padEnd(14) + porCanal[k].length); });

// ── 1 · CADA COLUMNA: cobertura dentro del universo al que aplica ──────────────────────────
// El «universo» de una columna se declara: global, solo email, solo WA, solo con-Qcart, solo Purina.
var UNIVERSO = {
  'Mascota': function (p) { return /purina/i.test(t(p['BU'])); },
  'Subsegmento': function (p) { return /purina/i.test(t(p['BU'])); },
  'EmailID': function (p) { return canalDe(p) === 'Email'; },
  'EmailName': function (p) { return canalDe(p) === 'Email'; },
  'Content_ID': function (p) { return canalDe(p) === 'Email'; },
  'Content_Name': function (p) { return canalDe(p) === 'Email'; },
  'Email_Type': function (p) { return canalDe(p) === 'Email'; },
  'Journey_ID': function (p) { return canalDe(p) === 'Email'; },
  'N_Recetas': function (p) { return /^s/i.test(t(p['Tiene_Qcart'])); },
  'Carritos_Total': function (p) { return /^s/i.test(t(p['Tiene_Qcart'])); },
  'Views_Total': function (p) { return /^s/i.test(t(p['Tiene_Qcart'])); }
};
var COLS = Object.keys(P[0] || {});
var filaCol = COLS.map(function (c) {
  var apl = UNIVERSO[c] ? P.filter(UNIVERSO[c]) : P;
  var llenas = apl.filter(function (p) { return t(p[c]) !== ''; }).length;
  return { col: c, aplica: apl.length, llenas: llenas, pct: apl.length ? Math.round(llenas / apl.length * 100) : null, acotada: !!UNIVERSO[c] };
});
var completas = filaCol.filter(function (f) { return f.pct === 100; });
var parciales = filaCol.filter(function (f) { return f.pct !== null && f.pct > 0 && f.pct < 100; });
var vacias = filaCol.filter(function (f) { return f.pct === 0; });
console.log('\n  ── 1 · las ' + COLS.length + ' columnas de Catalogo_Piezas');
console.log('     ✔ completas al 100% : ' + completas.length);
console.log('     ⚠ parciales         : ' + parciales.length);
console.log('     🔴 vacías del todo   : ' + vacias.length);
if (parciales.length) {
  console.log('\n     PARCIALES (col · llenas/aplican · %)');
  parciales.sort(function (a, b) { return a.pct - b.pct; }).forEach(function (f) {
    console.log('        ' + f.col.padEnd(26) + String(f.llenas).padStart(4) + '/' + String(f.aplica).padEnd(5) +
      String(f.pct).padStart(3) + '%' + (f.acotada ? '   (universo acotado)' : ''));
    if (f.pct < 100) AVISO.push('columna parcial: ' + f.col + ' ' + f.llenas + '/' + f.aplica);
  });
}
if (vacias.length) {
  console.log('\n     🔴 VACÍAS (existen pero sin un solo dato)');
  vacias.forEach(function (f) { console.log('        ' + f.col + (f.acotada ? '   (universo: ' + f.aplica + ' piezas)' : '')); FALTA.push('columna VACÍA en el catálogo: ' + f.col); });
}

// ── 2 · las columnas que DEBERÍAN EXISTIR y no existen ─────────────────────────────────────
var DEBEN = ['Pieza_ID', 'Camp_ID', 'Journey_ID', 'BU', 'Marca', 'Campaña', 'Objetivo', 'Touchpoint',
  'Segmento', 'Subsegmento', 'Canal', 'Email_Type', 'Content_Name', 'EmailName', 'EmailID',
  'Content_ID', 'Codigo_NC', 'Mes_Lanzamiento', 'Quincena_Lanzamiento', 'Sends', 'Estado'];
var noExisten = DEBEN.filter(function (c) { return COLS.indexOf(c) < 0; });
console.log('\n  ── 2 · columnas que el modelo pide y NO EXISTEN');
if (!noExisten.length) console.log('     ✔ están las ' + DEBEN.length);
else noExisten.forEach(function (c) { console.log('     🔴 falta: ' + c); FALTA.push('columna INEXISTENTE: ' + c); });

// ── 3 · LAS LLAVES ─────────────────────────────────────────────────────────────────────────
console.log('\n  ── 3 · las llaves');
var LLAVES = [
  { c: 'Pieza_ID', re: /^\d{3}-P\d{3}$/, unica: true },
  { c: 'Camp_ID', re: /^CMP-\d{3}$/, unica: false },
  { c: 'Journey_ID', re: /^\d{3}-J\d{3}$/, unica: false },
  { c: 'Codigo_NC', re: /^NC\d{6}$/, unica: false },
  { c: 'EmailID', re: /^\d{4,6}$/, unica: false },
  { c: 'Content_Name', re: /.+/, unica: true }
];
LLAVES.forEach(function (K) {
  if (COLS.indexOf(K.c) < 0) { console.log('     🔴 ' + K.c.padEnd(15) + 'NO EXISTE'); return; }
  var vals = P.map(function (p) { return t(p[K.c]); }).filter(Boolean);
  var malos = vals.filter(function (v) { return !K.re.test(v); });
  var vistos = {}, dups = [];
  vals.forEach(function (v) { if (vistos[v]) dups.push(v); vistos[v] = 1; });
  var linea = '     ' + (malos.length || (K.unica && dups.length) ? '🔴' : '✔') + ' ' + K.c.padEnd(15) +
    String(vals.length).padStart(4) + '/' + P.length + ' pobladas';
  if (malos.length) linea += '  · ' + malos.length + ' con formato raro: ' + malos.slice(0, 3).join(', ');
  if (K.unica && dups.length) linea += '  · ' + dups.length + ' DUPLICADOS: ' + dups.slice(0, 3).join(', ');
  console.log(linea);
  if (malos.length) FALTA.push(K.c + ': ' + malos.length + ' con formato inválido');
  if (K.unica && dups.length) FALTA.push(K.c + ': ' + dups.length + ' duplicados');
});

// ── 4 · LAS FECHAS, contra SFMC que es la fuente de verdad ─────────────────────────────────
console.log('\n  ── 4 · las fechas (SFMC manda)');
var COLF = COLS.filter(function (c) { return /fecha|mes|quincena|dias/i.test(c); });
COLF.forEach(function (c) {
  var ll = P.filter(function (p) { return t(p[c]) !== '' && t(p[c]) !== '0'; }).length;
  console.log('     ' + (ll === P.length ? '✔' : ll ? '⚠' : '🔴') + ' ' + c.padEnd(24) + String(ll).padStart(4) + '/' + P.length);
});
var sfmcFecha = {};
try {
  var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-email-detalle.json', 'utf8'));
  D.rows.forEach(function (r) {
    var k = t(r.ConfigKey); if (!k) return;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t(r.SendDay)); if (!m) return;
    var iso = m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    if (!sfmcFecha[k] || iso < sfmcFecha[k]) sfmcFecha[k] = iso;
  });
} catch (e) { }
var MESN = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };
function quinDe(iso) { var d = new Date(iso + 'T00:00:00Z'); return iso.slice(0, 4) + '-' + iso.slice(5, 7) + '-Q' + (d.getUTCDate() <= 15 ? 1 : 2); }
var difF = [], cruzF = 0;
Object.keys(sfmcFecha).forEach(function (pid) {
  var p = P.filter(function (x) { return t(x['Pieza_ID']) === pid; })[0]; if (!p) return;
  var esperado = quinDe(sfmcFecha[pid]), tiene = t(p['Quincena_Lanzamiento']);
  if (!tiene) { difF.push(pid + ': SFMC dice ' + esperado + ' y el catálogo NO TIENE quincena'); return; }
  cruzF++;
  if (tiene !== esperado) difF.push(pid + ': catálogo ' + tiene + ' vs SFMC ' + esperado + ' (' + sfmcFecha[pid] + ')');
});
console.log('     cruzadas contra SFMC: ' + cruzF + ' piezas   ·   diferencias: ' + difF.length);
difF.slice(0, 10).forEach(function (d) { console.log('        🔴 ' + d); FALTA.push('fecha: ' + d); });
if (difF.length > 10) console.log('        … y ' + (difF.length - 10) + ' más');

// ── 5 · LAS CIFRAS, contra las hojas de datos reales ───────────────────────────────────────
console.log('\n  ── 5 · las cifras del catálogo vs los datos reales');
function sumaPorPieza(rows, colId, colVal) {
  var o = {}; rows.forEach(function (r) {
    var id = t(r[colId]); if (!id) return; o[id] = (o[id] || 0) + num(r[colVal]);
  }); return o;
}
var realEmail = sumaPorPieza(E, 'pieza_id', 'Email_Sends');
var realWA = sumaPorPieza(W, 'pieza_id', 'Sends');
var difS = [], cruzS = 0, sinDato = [];
P.forEach(function (p) {
  var id = t(p['Pieza_ID']), cat = num(p['Sends']);
  var real = realEmail[id] !== undefined ? realEmail[id] : realWA[id];
  if (real === undefined) { if (cat) sinDato.push(id + ' (catálogo dice ' + mil(cat) + ' y no hay fila de datos)'); return; }
  cruzS++;
  if (Math.abs(cat - real) > 1) difS.push({ id: id, cat: cat, real: real, d: real - cat });
});
console.log('     piezas cruzadas: ' + cruzS + '   ·   cuadran: ' + (cruzS - difS.length) + '   ·   difieren: ' + difS.length);
difS.sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 12).forEach(function (d) {
  console.log('        🔴 ' + d.id + '  catálogo ' + mil(d.cat).padStart(9) + '  vs datos ' + mil(d.real).padStart(9) + '   Δ ' + mil(d.d));
  FALTA.push('Sends ' + d.id + ': catálogo ' + mil(d.cat) + ' vs real ' + mil(d.real));
});
if (difS.length > 12) console.log('        … y ' + (difS.length - 12) + ' más');
if (sinDato.length) {
  console.log('     ⚠ con Sends en catálogo pero SIN fila de datos: ' + sinDato.length);
  sinDato.slice(0, 6).forEach(function (x) { console.log('        ' + x); });
}

// ── 6 · Catalogo_Referencias ───────────────────────────────────────────────────────────────
console.log('\n  ── 6 · Catalogo_Referencias');
var colsR = Object.keys(Rf[0] || {});
colsR.forEach(function (c) {
  var ll = Rf.filter(function (r) { return t(r[c]) !== ''; }).length;
  console.log('     ' + (ll === Rf.length ? '✔' : ll ? '⚠' : '🔴') + ' ' + c.padEnd(20) + String(ll).padStart(4) + '/' + Rf.length);
  if (!ll) FALTA.push('Catalogo_Referencias: columna vacía ' + c);
});
var porTipo = {}; Rf.forEach(function (r) { porTipo[t(r['Dimension']) || '(sin dimensión)'] = (porTipo[t(r['Dimension']) || '(sin dimensión)'] || 0) + 1; });
console.log('     dimensiones cubiertas: ' + Object.keys(porTipo).map(function (k) { return k + '(' + porTipo[k] + ')'; }).join(' · '));

// ── 7 · CAMPAÑAS: las del catálogo vs las que aparecen en datos ────────────────────────────
console.log('\n  ── 7 · campañas: catálogo vs datos reales');
var campCat = {}; P.forEach(function (p) { if (t(p['Campaña'])) campCat[t(p['Campaña'])] = 1; });
var campDatos = {};
[[E, 'Campana_Canonica'], [W, 'Campaña'], [QC, 'campana_canonica']].forEach(function (par) {
  par[0].forEach(function (r) { var v = t(r[par[1]]); if (v) campDatos[v] = 1; });
});
var soloDatos = Object.keys(campDatos).filter(function (c) { return !campCat[c]; });
var soloCat = Object.keys(campCat).filter(function (c) { return !campDatos[c]; });
console.log('     en el catálogo: ' + Object.keys(campCat).length + '   ·   en los datos: ' + Object.keys(campDatos).length);
if (soloDatos.length) { console.log('     🔴 EN DATOS PERO NO EN EL CATÁLOGO: ' + soloDatos.join(' · ')); soloDatos.forEach(function (c) { FALTA.push('campaña sin dar de alta: ' + c); }); }
if (soloCat.length) console.log('     ⚠ en el catálogo sin datos aún: ' + soloCat.join(' · '));

// ── veredicto ──────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(BACK + '/_fuentes/auditoria-catalogos.json', JSON.stringify({
  paso: 'H1', archivo: vivo.archivo, piezas: P.length, columnas: COLS.length,
  columnas_detalle: filaCol, no_existen: noExisten, dif_fechas: difF, dif_sends: difS,
  campanas_sin_alta: soloDatos, falta: FALTA, aviso: AVISO
}, null, 1));
console.log('\n════════════════════════════════════════');
console.log('  🔴 FALTA / NO CUADRA: ' + FALTA.length + '     ⚠ avisos: ' + AVISO.length);
FALTA.slice(0, 20).forEach(function (f) { console.log('     🔴 ' + f); });
if (FALTA.length > 20) console.log('     … y ' + (FALTA.length - 20) + ' más (en _fuentes/auditoria-catalogos.json)');
