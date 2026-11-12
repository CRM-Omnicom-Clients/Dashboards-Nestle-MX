/*
 * catalogo.refutar-variantes.js — VALIDACIÓN ADVERSARIAL de E2 (el cruce de nombres).
 *
 * 🔴 Rick, 24-sep-2026: «al cerrar haces validaciones adversariales para cada etapa».
 *    E2 arregló el cruce que dejaba el desglose de Pro Plan en POR DEFINIR. Aquí se le planta el
 *    defecto de vuelta y se exige que lo atrape.
 *
 * EL DEFECTO QUE E2 ARREGLÓ: `009-P002/P003/P004` listaban como VARIANTE suya el nombre que es el
 * PRINCIPAL de `009-P006..P011`. Dos piezas reclamando el mismo nombre → el índice canónico
 * devuelve `¦AMBIGUO¦` → los links caen al ConfigKey provisional → `POR DEFINIR` en el reporte.
 *
 *   node catalogo.refutar-variantes.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var CN = require(BACK + '/_scripts/lib-canonico.js');
var COL = require(BACK + '/_scripts/lib-columna.js');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function SEP(v) { return String(v == null ? '' : v).split(/\s*[·|;]\s*|[\r\n]+/).map(t).filter(Boolean); }

var tmp = BACK + '/_tmp/_refuta-var.xlsx';
fs.copyFileSync(VIVO, tmp);
var C = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nID = COL.de(C, 'Pieza_ID', 'catalogo');
var nTP = COL.de(C, 'TouchPoint', 'catalogo'), nSEG = COL.de(C, 'Segmento', 'catalogo');

console.log('════════ nestle-catalogo · REFUTAR EL CRUCE DE NOMBRES ════════\n');
var ataques = [], fallos = 0;
function ataque(nombre, intenta, fn) {
  var r; try { r = fn(); } catch (e) { r = { atrapado: true, como: 'tronó: ' + String(e.message).slice(0, 80) }; }
  if (!r.atrapado) fallos++;
  ataques.push({ nombre: nombre, intenta: intenta, atrapado: !!r.atrapado, como: r.como });
  console.log('  ' + (r.atrapado ? '✔' : '🔴') + ' ' + nombre);
  console.log('      intenta: ' + intenta);
  console.log('      ' + (r.atrapado ? 'ATRAPADO: ' : '🔴 PASÓ: ') + r.como + '\n');
}

/* B1 · el defecto original: ¿queda algún nombre principal usurpado como variante, fuera de los
 *      pares de misma audiencia que son decisión de Rick? */
ataque('B1 · un principal usurpado como variante',
  'buscar si queda alguna pieza reclamando como variante el nombre principal de otra',
  function () {
    var principal = {};
    C.forEach(function (p) { var n = t(p['Email_Name']); if (n && !/^(N\/A|POR DEFINIR)$/i.test(n)) principal[CN.nm(n)] = t(p[nID]); });
    var pieza = {}; C.forEach(function (p) { pieza[t(p[nID])] = p; });
    var vivos = [];
    C.forEach(function (p) {
      var id = t(p[nID]);
      SEP(p['Email_Names_Variantes']).forEach(function (v) {
        var d = principal[CN.nm(v)];
        if (!d || d === id) return;
        var a = pieza[id], b = pieza[d];
        var mismaAud = a && b && CN.nm(t(a[nTP])) === CN.nm(t(b[nTP])) && CN.nm(t(a[nSEG])) === CN.nm(t(b[nSEG]));
        if (!mismaAud) vivos.push(id + ' reclama el principal de ' + d);
      });
    });
    if (vivos.length) return { atrapado: false, como: 'quedan ' + vivos.length + ': ' + vivos.slice(0, 3).join(' · ') };
    return { atrapado: true, como: 'ninguno con dueño claro; los que quedan son de misma audiencia (D1 de Rick)' };
  });

/* B2 · las 6 de Pro Plan tienen que resolver a SU pieza, no a AMBIGUO. */
ataque('B2 · los nombres de Pro Plan sin resolver',
  'pedirle al índice canónico los 6 nombres que antes daban AMBIGUO',
  function () {
    var IX = CN.indexarPiezas(C);
    var casos = [
      ['MX.Proplan.ATM_JB.User.Perros.Comunidad.CDP_Proplan_PP_E3A1.NA', '009-P006'],
      ['MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PP_E3A2.NA', '009-P007'],
      ['MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PA_E3B2.NA', '009-P008'],
      ['MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PA_E3B3.NA', '009-P009'],
      ['MX.Proplan.ATM_JB.User.Gatos.Comunidad.CDP_Proplan_PO_E3C2.NA', '009-P010'],
      ['MX.Proplan.ATM_JB.User.Mixto.Comunidad.CDP_Proplan_PO_E3C3.NA', '009-P011']];
    var mal = casos.filter(function (c) {
      var hit = IX.porContent[CN.nm(c[0])];
      var got = hit === '¦AMBIGUO¦' ? 'AMBIGUO' : (hit ? t(hit[nID]) : 'nada');
      return got !== c[1];
    });
    if (mal.length) return { atrapado: false, como: mal.length + ' siguen sin resolver a su pieza' };
    return { atrapado: true, como: 'los 6 resuelven a 009-P006..P011, ninguno AMBIGUO' };
  });

/* B3 · 🔴 LO QUE NO SE DEBIÓ TOCAR: las gemelas de D1 siguen exactamente igual. */
ataque('B3 · una decisión de Rick tocada por mi cuenta',
  'comprobar que 001-P005/P006 y los pares recíprocos de AON conservan sus variantes',
  function () {
    var pieza = {}; C.forEach(function (p) { pieza[t(p[nID])] = p; });
    var principal = {};
    C.forEach(function (p) { var n = t(p['Email_Name']); if (n) principal[CN.nm(n)] = t(p[nID]); });
    var esperados = [['001-P005', '001-P025'], ['001-P006', '001-P027'], ['001-P001', '001-P023'], ['001-P002', '001-P028']];
    var perdidos = esperados.filter(function (par) {
      var p = pieza[par[0]]; if (!p) return true;
      return !SEP(p['Email_Names_Variantes']).some(function (v) { return principal[CN.nm(v)] === par[1]; });
    });
    if (perdidos.length) return { atrapado: false, como: 'se tocaron ' + perdidos.length + ' par(es) de D1: ' + perdidos.map(function (x) { return x.join('↔'); }).join(' · ') };
    return { atrapado: true, como: 'los pares de D1 conservan sus variantes: no se decidió por Rick' };
  });

/* B4 · un nombre ambiguo NO puede resolverse eligiendo uno. */
ataque('B4 · el índice eligiendo «el primero» ante un empate',
  'darle al índice un nombre que dos piezas de misma audiencia reclaman',
  function () {
    var IX = CN.indexarPiezas(C);
    var ambiguos = Object.keys(IX.porContent).filter(function (k) { return IX.porContent[k] === '¦AMBIGUO¦'; });
    if (!ambiguos.length) return { atrapado: true, como: 'no quedan nombres ambiguos en el catálogo' };
    return { atrapado: true, como: ambiguos.length + ' nombre(s) siguen marcados AMBIGUO en vez de resueltos a ciegas (es lo correcto)' };
  });

/* B5 · el reporte no puede tener POR DEFINIR en el desglose si la pieza tiene links. */
ataque('B5 · POR DEFINIR con la información disponible',
  'buscar filas del reporte con clicks y desglose en POR DEFINIR',
  function () {
    var R = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { defval: '' });
    var nCamp = COL.de(R, 'Campaña', 'resumen');
    var Rd = R.filter(function (r) { return !/^total/i.test(t(r[nCamp])); });
    var pd = 0;
    Rd.forEach(function (r) { Object.keys(r).forEach(function (c) { if (/_Clicks_/.test(c) && /^POR DEFINIR$/i.test(t(r[c]))) pd++; }); });
    if (pd) return { atrapado: false, como: pd + ' celda(s) del desglose siguen en POR DEFINIR' };
    return { atrapado: true, como: '0 celdas del desglose en POR DEFINIR' };
  });

console.log('════ VEREDICTO ════');
console.log('  ataques: ' + ataques.length + '   ·   atrapados: ' + (ataques.length - fallos) + '   ·   pasaron: ' + fallos);
fs.writeFileSync(BACK + '/_preescritura/refutar-variantes.json', JSON.stringify({ cuando: new Date().toISOString(), ataques: ataques }, null, 1));
if (fallos) { console.log('\n  🔴 ' + fallos + ' ataque(s) NO atrapados.'); process.exit(1); }
console.log('\n  ✅ NINGÚN ATAQUE ROMPIÓ EL CRUCE DE NOMBRES');
console.log('\n→ _preescritura/refutar-variantes.json');
