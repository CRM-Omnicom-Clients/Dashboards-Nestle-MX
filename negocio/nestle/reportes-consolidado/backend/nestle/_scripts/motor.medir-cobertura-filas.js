// motor · ¿QUÉ FILAS DEL REPORTE PUEDEN LLEVAR EL DESGLOSE DE CLICKS, Y CUÁLES NO?
//
// 🔴 POR QUÉ ANTES DE ESCRIBIR. Una fila del reporte AGREGA varias piezas (la llave del reporte no
//    es única — agrega a propósito). 27 piezas no tienen ni una fila en `CRM_Email_Links`, así que
//    una fila puede quedar en tres estados muy distintos:
//      COMPLETA · todas sus piezas del bloque tienen links → el número es el número
//      PARCIAL  · unas sí y otras no → el número es un PISO, y presentarlo como total es falso
//      SIN DATO · ninguna tiene links → no es 0, es «no se sabe»
//    Si no se mide antes, el caso PARCIAL se escribe como si fuera completo, **la columna cuadra
//    consigo misma**, y nadie lo ve. Es exactamente el defecto del grano de escritura por fuente.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

var RJ = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var LK = JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8'));
var EM = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_cobcl.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var wb = XLSX.readFile(tmp);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var tipo = {};
CAT.forEach(function (p) { tipo[t(p['Pieza' + '_ID'])] = t(p['Email' + '_Type']); });
var clicksPersona = {};
(EM.envios || []).forEach(function (r) { clicksPersona[t(r.pieza_id)] = (clicksPersona[t(r.pieza_id)] || 0) + (Number(r.email_unique_clicks) || 0); });

console.log('════════ motor · COBERTURA DEL DESGLOSE, FILA POR FILA ════════\n');

var est = { COMPLETA: 0, PARCIAL: 0, SIN_DATO: 0, SIN_EMAIL: 0 };
var parciales = [], sinDato = [];
RJ.rejilla.forEach(function (c) {
  ['principal', 'fup'].forEach(function (b) {
    var esFup = b === 'fup';
    var pz = (c.piezas || []).map(t).filter(function (pid) {
      return (/follow|fup/i.test(tipo[pid] || '')) === esFup;
    });
    // solo cuentan las piezas que de verdad tuvieron clicks: una pieza con 0 clicks no crea un hueco
    var conClicks = pz.filter(function (pid) { return (clicksPersona[pid] || 0) > 0; });
    if (!conClicks.length) { est.SIN_EMAIL++; return; }
    var conLinks = conClicks.filter(function (pid) { return LK.piezas[pid] && LK.piezas[pid].clicks_unicos > 0; });
    var etq = c.campana + ' · ' + c.touchpoint + ' · ' + c.segmento + ' · ' + c.quincena + ' [' + b + ']';
    if (conLinks.length === conClicks.length) est.COMPLETA++;
    else if (conLinks.length === 0) {
      est.SIN_DATO++;
      sinDato.push({ fila: etq, piezas: conClicks, clicks: conClicks.reduce(function (a, p) { return a + clicksPersona[p]; }, 0) });
    } else {
      est.PARCIAL++;
      parciales.push({
        fila: etq, con: conLinks, sin: conClicks.filter(function (p) { return conLinks.indexOf(p) < 0; }),
        clicks_sin: conClicks.filter(function (p) { return conLinks.indexOf(p) < 0; }).reduce(function (a, p) { return a + clicksPersona[p]; }, 0)
      });
    }
  });
});

console.log('  de ' + RJ.rejilla.length + ' celdas × 2 bloques = ' + (RJ.rejilla.length * 2) + ' posibles:');
console.log('     COMPLETA  ' + String(est.COMPLETA).padStart(4) + '  todas sus piezas con clicks tienen links → el número vale');
console.log('     PARCIAL   ' + String(est.PARCIAL).padStart(4) + '  unas sí y otras no → el número es un PISO');
console.log('     SIN DATO  ' + String(est.SIN_DATO).padStart(4) + '  ninguna tiene links → no es 0');
console.log('     sin email ' + String(est.SIN_EMAIL).padStart(4) + '  el bloque no tuvo clicks (WhatsApp-only, Qcart-only, sin FUP)');

if (parciales.length) {
  console.log('\n  🔴 LAS PARCIALES — aquí el número que escriba será menor que la realidad:');
  parciales.sort(function (a, b) { return b.clicks_sin - a.clicks_sin; }).slice(0, 12).forEach(function (x) {
    console.log('     ' + x.fila);
    console.log('        con links: ' + x.con.join(' · ') + '   ·   SIN: ' + x.sin.join(' · ') + '  (' + mil(x.clicks_sin) + ' clicks fuera del desglose)');
  });
  if (parciales.length > 12) console.log('     … y ' + (parciales.length - 12) + ' más');
}
if (sinDato.length) {
  console.log('\n  ── LAS SIN DATO — van con su razón escrita, no con 0:');
  sinDato.sort(function (a, b) { return b.clicks - a.clicks; }).slice(0, 12).forEach(function (x) {
    console.log('     ' + x.fila.padEnd(62) + mil(x.clicks).padStart(7) + ' clicks   piezas: ' + x.piezas.join(' · '));
  });
  if (sinDato.length > 12) console.log('     … y ' + (sinDato.length - 12) + ' más');
}

fs.writeFileSync(BACK + '/_preescritura/cobertura-clicks.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), estados: est,
  columnas: CD.encabezados(), parciales: parciales, sin_dato: sinDato
}, null, 1));
console.log('\n  → _preescritura/cobertura-clicks.json');
try { fs.unlinkSync(tmp); } catch (e) { }
