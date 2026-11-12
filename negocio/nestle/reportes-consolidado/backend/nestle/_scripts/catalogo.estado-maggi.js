/*
 * catalogo.estado-maggi.js — el estado de TODO Maggi contra sus fuentes. Mide, no escribe.
 *
 * POR QUÉ: Rick, 14-sep-2026: «re-revisa lo de maggi… todo lo de maggi, sin romper lo que ya está
 * atribuido y ya te había dado fecha, compara contra fuentes de origen… valida lo de Qcart,
 * revisando estado actual de archivos». Y: «que me reportes si no hay carritos».
 *
 * 🔴 «SIN CARRITOS» SE REPORTA CON SU MOTIVO, no como un cero. Un cero tiene cuatro lecturas que
 *    no se parecen, y solo una es normal:
 *      · la pieza no declara códigos           → el catálogo debe algo
 *      · declara códigos que el maestro ignora → el maestro debe algo
 *      · el link no tuvo tráfico               → normal, no hay nada que hacer
 *      · lo tuvo y cayó antes de su activación → decisión ya tomada (Rick, 9-sep)
 *
 * 🔴 SE COMPARA CONTRA LA FUENTE, NO CONTRA EL BLOQUE. El bloque salió de la fuente; preguntarle
 *    si coincide con ella es preguntarle si coincide consigo mismo. Los envíos se contrastan con
 *    el volcado de SFMC y los carritos con el CSV crudo de la descarga vigente.
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
var MARCA = 'Maggi';

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_maggi.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '' });
fs.unlinkSync(tmp);

var K = {};
[['id', 'Pieza' + '_ID'], ['mar', 'Mar' + 'ca'], ['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'],
 ['seg', 'Segm' + 'ento'], ['can', 'Can' + 'al'], ['en', 'catalogo.content_name'],
 ['cods', 'Codigos' + '_Qcart'], ['sends', 'Sen' + 'ds'], ['fecha', 'Fecha' + '_Primer_Envio'],
 ['quin', 'Quin' + 'cena'], ['tiene', 'Tiene' + '_Qcart']
].forEach(function (x) { K[x[0]] = COL.de(P, x[1], 'catalogo'); });
var RC = {};
[['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'], ['carr', 'Carritos' + '_Total']
].forEach(function (x) { RC[x[0]] = COL.opcional(R, x[1]); });

// ── FUENTE 1 · el volcado de SFMC ───────────────────────────────────────────
function vigente(pref) {
  var d = BACK + '/_insumos';
  var c = fs.readdirSync(d).filter(function (f) { return new RegExp('^' + pref + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? d + '/' + c[c.length - 1] : null;
}
var rutaS = vigente('sfmc-piezas');
var sfmcPorNombre = {};
JSON.parse(fs.readFileSync(rutaS, 'utf8')).rows.forEach(function (r) { if (t(r.EmailName)) sfmcPorNombre[t(r.EmailName)] = r; });

// ── FUENTE 2 · el maestro de links ──────────────────────────────────────────
var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');

// ── FUENTE 3 · el CSV crudo de la descarga vigente ──────────────────────────
var dirV = PROY + '/ReportesQcart/_vigentes';
var crudo = {}, archivosCrudos = [];
fs.readdirSync(dirV).filter(function (f) { return /carts-raw.*\.csv$/i.test(f); }).forEach(function (f) {
  archivosCrudos.push(f);
  fs.readFileSync(dirV + '/' + f, 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    var p = l.split(';'); if (p.length < 9) return;
    var c = t(p[1]); if (!c) return;
    var x = crudo[c] = crudo[c] || { n: 0, f0: '9', f1: '0' };
    x.n++;
    var d = t(p[0]).slice(0, 10);
    if (d < x.f0) x.f0 = d; if (d > x.f1) x.f1 = d;
  });
});

var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var carPorCod = {};
// 🔴 VISTAS, no filas (29-sep-2026). Contaba `+ 1` por fila del bloque y el estado que Rick lee
//    decia «carritos». Una fila de Qcart es un bucket con su contador `views`: contarlas da 3,077
//    donde hay 7,503. Lo destapo U4 al dejar de buscar cinco patrones literales en tres archivos.
Q.carritos.forEach(function (e) { var c = t(e.shortlink_code); if (c) carPorCod[c] = (carPorCod[c] || 0) + (Number(e.views) || 0); });

console.log('════════ ESTADO DE MAGGI · contra sus fuentes ════════\n');
console.log('  SFMC           ' + rutaS.split(/[\\/]/).pop());
console.log('  maestro links  ' + Object.keys(MAE.links).length + ' shortlinks · ' + (MAE.invalidos || []).length + ' con fecha inválida');
console.log('  descarga Qcart ' + archivosCrudos.join(' · '));
console.log('  bloque         ' + mil(Q.carritos.length) + ' carritos · ' + mil((Q.productos || []).length) + ' productos\n');

var piezas = P.filter(function (r) { return t(r[K.mar]) === MARCA; });
var porCampana = {};
piezas.forEach(function (p) { (porCampana[t(p[K.cam])] = porCampana[t(p[K.cam])] || []).push(p); });

var SIN_CARRITOS = [], DESVIOS = [];

Object.keys(porCampana).sort().forEach(function (camp) {
  console.log('══════ ' + camp.toUpperCase() + ' · ' + porCampana[camp].length + ' piezas ══════');
  console.log('  ' + 'pieza'.padEnd(10) + 'canal'.padEnd(10) + 'tp'.padEnd(13) + 'segmento'.padEnd(24) +
    'envíos'.padStart(9) + '  vs SFMC        carritos  estado del Qcart');
  console.log('  ' + '─'.repeat(112));

  porCampana[camp].sort(function (a, b) { return t(a[K.id]).localeCompare(t(b[K.id])); }).forEach(function (p) {
    var id = t(p[K.id]), en = t(p[K.en]), canal = t(p[K.can]);
    var sendsCat = t(p[K.sends]);

    // envíos contra SFMC
    var vs = '—';
    if (canal === 'Email') {
      var nombres = en.split('·').map(t).filter(function (x) { return x && !TOKEN.test(x); });
      var s = null;
      nombres.forEach(function (n) { if (!s && sfmcPorNombre[n]) s = sfmcPorNombre[n]; });
      if (!nombres.length) vs = 'sin nombre';
      else if (!s) { vs = '🔴 no está'; DESVIOS.push({ id: id, que: 'Email_Name que SFMC no publica', d: nombres[0].slice(0, 60) }); }
      else if (/^\d+$/.test(sendsCat) && Number(sendsCat) !== Number(s.Email_Sends)) {
        vs = '🔴 ' + mil(s.Email_Sends);
        DESVIOS.push({ id: id, que: 'Sends catálogo ≠ SFMC', d: mil(sendsCat) + ' vs ' + mil(s.Email_Sends) });
      } else vs = '✔';
    } else vs = 'n/a';

    // carritos, y el MOTIVO si son cero
    var cods = t(p[K.cods]).split(/[,;]/).map(t).filter(function (c) { return c && !TOKEN.test(c); });
    var nCar = cods.reduce(function (s2, c) { return s2 + (carPorCod[c] || 0); }, 0);
    var estado;
    if (t(p[K.tiene]).toLowerCase() === 'no') estado = 'no lleva Qcart';
    else if (!cods.length) { estado = '🔴 la pieza NO declara códigos'; SIN_CARRITOS.push({ id: id, camp: camp, tp: t(p[K.tp]), motivo: 'el catálogo no le declara ningún shortlink' }); }
    else if (nCar > 0) estado = '✔ ' + cods.length + ' link(s)';
    else {
      var sinMae = cods.filter(function (c) { return !MAE.links[c]; });
      var conTrafico = cods.filter(function (c) { return crudo[c]; });
      if (sinMae.length) { estado = '🔴 ' + sinMae.length + ' link(s) que el maestro no declara'; SIN_CARRITOS.push({ id: id, camp: camp, tp: t(p[K.tp]), motivo: 'el maestro no declara: ' + sinMae.join(' ') }); }
      else if (!conTrafico.length) { estado = '· sin tráfico en la descarga'; SIN_CARRITOS.push({ id: id, camp: camp, tp: t(p[K.tp]), motivo: 'sus links no tuvieron tráfico en ' + archivosCrudos[0] }); }
      else {
        var det = conTrafico.map(function (c) { return c + ' (' + crudo[c].n + ' · ' + crudo[c].f0 + '→' + crudo[c].f1 + ', activa ' + MAE.links[c].fecha_activacion + ')'; });
        estado = '🔴 tráfico ANTES de activar';
        SIN_CARRITOS.push({ id: id, camp: camp, tp: t(p[K.tp]), motivo: 'todo su tráfico es anterior a la activación: ' + det.join(' · ') });
      }
    }

    console.log('  ' + id.padEnd(10) + canal.padEnd(10) + t(p[K.tp]).slice(0, 11).padEnd(13) + t(p[K.seg]).slice(0, 22).padEnd(24) +
      (sendsCat || '—').padStart(9) + '  ' + vs.padEnd(14) + String(nCar).padStart(8) + '  ' + estado);
  });
  console.log('');
});

console.log('══════ SIN CARRITOS, CON SU MOTIVO ══════');
if (!SIN_CARRITOS.length) console.log('   ✔ todas las piezas de Maggi con Qcart tienen carritos');
SIN_CARRITOS.forEach(function (x) {
  console.log('   ' + x.id.padEnd(10) + (x.camp + ' · ' + x.tp).padEnd(26) + x.motivo);
});

console.log('\n══════ DESVÍOS CONTRA LA FUENTE ══════');
if (!DESVIOS.length) console.log('   ✔ ninguno: el catálogo dice lo que dice SFMC');
DESVIOS.forEach(function (x) { console.log('   ' + x.id.padEnd(10) + x.que.padEnd(36) + x.d); });

// ── el maestro: bloques de Maggi que ninguna pieza reclama ──────────────────
console.log('\n══════ BLOQUES DEL MAESTRO SIN PIEZA ══════');
var declarados = {};
piezas.forEach(function (p) { t(p[K.cods]).split(/[,;]/).map(t).forEach(function (c) { if (c && !TOKEN.test(c)) declarados[c] = t(p[K.id]); }); });
var faltan = Object.keys(MAE.links).filter(function (c) {
  var m = MAE.links[c];
  return /maggi/i.test(t(m.campana)) && !declarados[c];
});
if (!faltan.length) console.log('   ✔ ninguno');
faltan.sort(function (a, b) { return (crudo[b] ? crudo[b].n : 0) - (crudo[a] ? crudo[a].n : 0); }).forEach(function (c) {
  var m = MAE.links[c], n = crudo[c] ? crudo[c].n : 0;
  console.log('   ' + (n ? '🔴' : '· ') + ' ' + c.padEnd(11) + m.hoja.padEnd(12) + t(m.utm_content).padEnd(10) +
    m.fecha_activacion + '   crudo ' + String(n).padStart(4) + '   ' + t(m.receta).slice(0, 30));
});

fs.writeFileSync(BACK + '/_preescritura/estado-maggi.json', JSON.stringify({
  cuando: new Date().toISOString(), piezas: piezas.length,
  sin_carritos: SIN_CARRITOS, desvios: DESVIOS, maestro_sin_pieza: faltan
}, null, 1));
console.log('\n  → _preescritura/estado-maggi.json');
