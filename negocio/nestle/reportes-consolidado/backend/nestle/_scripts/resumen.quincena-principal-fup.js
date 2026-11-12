/*
 * resumen.quincena-principal-fup.js — UNA TABLA POR QUINCENA, con el FUP al lado de su Principal.
 *
 * 🔴 Rick, 21-sep-2026: «las tablas ordenadas únicamente por quincena, los resultados de los FUP a
 *    un lado del principal, como lo tenemos en el reporte, y hasta el final los totales».
 *
 * 🔴 EL EMPAREJAMIENTO ES DECLARADO, NO DEDUCIDO. El FUP dice de quién es seguimiento en
 *    `Pieza_Principal_ID`. Deducirlo por touchpoint+segmento funcionaría hoy y fallaría el día que
 *    dos piezas compartan dimensiones — es la misma razón por la que el sistema dejó de deducirlo.
 *
 * 🔴 EL DATO SALE DEL DETALLE DÍA POR DÍA, con los jobs de prueba fuera (umbral <10 envíos, el
 *    mismo criterio de `lib-fechas-envio`). Un total por pieza no se puede repartir en el tiempo.
 *
 *   node resumen.quincena-principal-fup.js 001-P015 001-P016 …
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var Q = require(BACK + '/_scripts/lib-quincena.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var n = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var mil = function (v) { return Number(v || 0).toLocaleString('es-MX'); };
var pct = function (a, b) { return b ? (a / b * 100).toFixed(2) + '%' : '—'; };

var IDS = process.argv.slice(2).filter(function (a) { return /^\d{3}-P\d{3}$/.test(a); });
if (!IDS.length) { console.log('uso: node resumen.quincena-principal-fup.js 001-P015 ...'); process.exit(2); }

// ── el catálogo: quién es FUP de quién, y las dimensiones ─────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_qpf.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function pide(id) { try { return COL.de(CAT, id, AMBITO_CATALOGO); } catch (e) { return null; } }
var nID = pide('Pieza_ID'), nTP = pide('TouchPoint'), nSEG = pide('Segmento'), nPRIN = pide('Pieza_Principal_ID'), nSUBJ = pide('Subject');
var cat = {};
CAT.forEach(function (p) { var i = t(p[nID]); if (i) cat[i] = p; });
function v(id, nom) { return cat[id] && nom ? t(cat[id][nom]) : ''; }

// pares Principal → FUP, declarados
var pares = [], fupDe = {};
IDS.forEach(function (id) { var pp = v(id, nPRIN); if (pp && /^\d{3}-P\d{3}$/.test(pp)) fupDe[pp] = id; });
IDS.forEach(function (id) { if (!v(id, nPRIN) || !/^\d{3}-P\d{3}$/.test(v(id, nPRIN))) pares.push({ principal: id, fup: fupDe[id] || null }); });

// ── el detalle ────────────────────────────────────────────────────────────────────
var fotos = fs.readdirSync(BACK + '/_insumos').filter(function (x) { return /^sfmc-detalle-\d{4}-\d{2}-\d{2}\.txt$/.test(x); }).sort();
var NUEVA = fotos[fotos.length - 1];
var R = (JSON.parse(fs.readFileSync(BACK + '/_insumos/' + NUEVA, 'utf8')).rows || []).filter(function (r) { return IDS.indexOf(t(r.ConfigKey)) >= 0; });
var porJob = {};
R.forEach(function (r) { porJob[t(r.JobID)] = (porJob[t(r.JobID)] || 0) + n(r.Email_Sends); });
var pruebas = Object.keys(porJob).filter(function (j) { return porJob[j] < 10; });
R = R.filter(function (r) { return pruebas.indexOf(t(r.JobID)) < 0; });

var M = ['Email_Sends', 'Email_Deliveries', 'Email_Unique_Opens', 'Email_Unique_Clicks', 'Email_Unique_Unsubs'];
var G = {};
R.forEach(function (r) {
  var q = Q.deFecha(t(r.SendDay).slice(0, 10));
  var k = t(r.ConfigKey) + '¦' + q;
  if (!G[k]) { G[k] = {}; M.forEach(function (m) { G[k][m] = 0; }); }
  M.forEach(function (m) { G[k][m] += n(r[m]); });
});
function dato(id, q) { return G[id + '¦' + q] || { Email_Sends: 0, Email_Deliveries: 0, Email_Unique_Opens: 0, Email_Unique_Clicks: 0, Email_Unique_Unsubs: 0 }; }

var quincenas = {};
Object.keys(G).forEach(function (k) { quincenas[k.split('¦')[1]] = 1; });
var QS = Object.keys(quincenas).sort();

console.log('foto de SFMC: ' + NUEVA.replace(/sfmc-detalle-|\.txt/g, '') + '   ·   jobs de prueba fuera: ' + pruebas.length + '\n');

/* 🔴 LOS ENCABEZADOS SE LEEN DEL REPORTE, NO SE ESCRIBEN AQUÍ. Rick: «pon bien los encabezados
 *    como los tenemos en el reporte, no abreviados». Si los tecleara, el día que una columna se
 *    renombre esta tabla diría un nombre que ya no existe — que es exactamente el defecto que
 *    costó el registro de nombres. Se leen de `Report_Resumen` y se sirven tal cual.
 * 🔴 LAS TRES DE DESGLOSE DE CLICKS NO ENTRAN, y se declara por qué: `*_Clicks_CTA`,
 *    `*_Clicks_Baja` y `*_Clicks_Redes+Navegador+Legal` salen de `CRM_Email_Links`, que da un
 *    total por PIEZA y no por día. No se pueden repartir por quincena sin inventar el reparto. */
/* 🔴 21-sep-2026 · LA LISTA LA DIO RICK, LITERAL. Antes se leían todos los encabezados del reporte;
 *    él pidió un subconjunto y en un orden concreto, con `P_Subject` (no `Principal_Subject`).
 *    Las dos son el MISMO dato: `lib-valores-resumen` sirve el asunto del Principal por los dos
 *    nombres, porque la hoja lo tuvo antes como `P_Subject`. Se respeta el que él escribió.
 *    Sale de aquí y no del archivo a propósito: es una vista que él definió, no la hoja entera. */
var ENC = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { header: 1, defval: '' })[0].map(t);
var SUF = ['Sends', 'Deliveries', 'Opens', 'Clicks', 'Open_Rate', 'CTOR', 'Click_Rate'];
function valor(b, suf) {
  switch (suf) {
    case 'Sends': return mil(b.Email_Sends);
    case 'Deliveries': return mil(b.Email_Deliveries);
    case 'Opens': return mil(b.Email_Unique_Opens);
    case 'Clicks': return mil(b.Email_Unique_Clicks);
    case 'Unsubs': return mil(b.Email_Unique_Unsubs);
    case 'Open_Rate': return pct(b.Email_Unique_Opens, b.Email_Deliveries);
    case 'CTOR': return pct(b.Email_Unique_Clicks, b.Email_Unique_Opens);
    case 'Click_Rate': return pct(b.Email_Unique_Clicks, b.Email_Deliveries);
    case 'UTOR (vs opens)': return pct(b.Email_Unique_Unsubs, b.Email_Unique_Opens);
  }
  throw new Error('métrica sin fórmula declarada: ' + suf);
}
function fila(etq, p, f, subP, subF) {
  var tot = {}; M.forEach(function (m) { tot[m] = p[m] + f[m]; });
  var out = [etq, subP];
  SUF.forEach(function (s) { out.push(valor(p, s)); });
  out.push(subF);
  SUF.forEach(function (s) { out.push(valor(f, s)); });
  SUF.forEach(function (s) { out.push(valor(tot, s)); });
  return out;
}
var CAB = ['TouchPoint · Segmento', 'P_Subject'];
SUF.forEach(function (s) { CAB.push('Principal_' + s); });
CAB.push('FUP_Subject');
SUF.forEach(function (s) { CAB.push('FUP_' + s); });
SUF.forEach(function (s) { CAB.push('Tot_' + s); });
function tabla(filas) {
  var w = CAB.map(function (c, i) { return Math.max(c.length, Math.max.apply(null, filas.map(function (f) { return String(f[i]).length; }))); });
  console.log('   ' + CAB.map(function (c, i) { return i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]); }).join(' │ '));
  filas.forEach(function (f) { console.log('   ' + f.map(function (x, i) { return i === 0 ? String(x).padEnd(w[i]) : String(x).padStart(w[i]); }).join(' │ ')); });
}

var GRAN = {}; pares.forEach(function (x) { GRAN[x.principal] = { p: {}, f: {} }; M.forEach(function (m) { GRAN[x.principal].p[m] = 0; GRAN[x.principal].f[m] = 0; }); });
QS.forEach(function (q) {
  var filas = [];
  pares.forEach(function (x) {
    var p = dato(x.principal, q), f = x.fup ? dato(x.fup, q) : dato('(ninguna)', q);
    if (!p.Email_Sends && !f.Email_Sends) return;
    M.forEach(function (m) { GRAN[x.principal].p[m] += p[m]; GRAN[x.principal].f[m] += f[m]; });
    filas.push(fila(v(x.principal, nTP) + ' · ' + v(x.principal, nSEG), p, f, v(x.principal, nSUBJ), x.fup ? v(x.fup, nSUBJ) : 'N/A'));
  });
  if (!filas.length) return;
  console.log('══ ' + q + ' ══');
  tabla(filas);
  console.log('');
});

console.log('══ TOTALES (todo el periodo) ══');
var filasT = pares.map(function (x) { return fila(v(x.principal, nTP) + ' · ' + v(x.principal, nSEG), GRAN[x.principal].p, GRAN[x.principal].f, v(x.principal, nSUBJ), x.fup ? v(x.fup, nSUBJ) : 'N/A'); });
var SP = {}, SF = {}; M.forEach(function (m) { SP[m] = 0; SF[m] = 0; });
pares.forEach(function (x) { M.forEach(function (m) { SP[m] += GRAN[x.principal].p[m]; SF[m] += GRAN[x.principal].f[m]; }); });
filasT.push(fila('TOTAL', SP, SF, '', ''));
tabla(filasT);

try { fs.unlinkSync(tmp); } catch (e) { }
