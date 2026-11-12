// ¿Cuántas piezas mandan en más de una quincena? Es lo que Rick advirtió de AON.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var iso = function (f) { if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10); return t(f).slice(0, 10); };
var Qz = function (d) { return d.slice(0, 7) + '-' + (Number(d.slice(8, 10)) <= 15 ? 'Q1' : 'Q2'); };
var T = require('path').resolve(__dirname, '..') + '/_tmp/_mq.xlsx';
fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

console.log('══ ¿cuántas piezas mandan en MÁS DE UNA quincena? ══');
var multi = [], tot = 0;
P.forEach(function (p) {
  var cn = [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean);
  var fx = E.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) >= 0 && r['Send_Date']; }).map(function (r) { return iso(r['Send_Date']); });
  if (!fx.length) return;
  tot++;
  var qs = {}, ms = {};
  fx.forEach(function (d) { qs[Qz(d)] = 1; ms[d.slice(0, 7)] = 1; });
  if (Object.keys(qs).length > 1) multi.push({ id: t(p['Pieza_ID']), c: t(p['Campaña']), tp: t(p['Touchpoint']), seg: t(p['Segmento']), q: Object.keys(qs).sort(), m: Object.keys(ms).sort(), n: fx.length });
});
console.log('  piezas con envíos fechados: ' + tot);
console.log('  🔴 con envíos en MÁS DE UNA quincena: ' + multi.length);
multi.forEach(function (x) {
  console.log('    ' + x.id + '  ' + x.c.padEnd(14) + x.tp.padEnd(6) + x.seg.slice(0, 20).padEnd(22) + x.n + ' envíos  →  ' + x.q.join(' + '));
});
var mm = multi.filter(function (x) { return x.m.length > 1; });
console.log('\n  de ellas, en más de un MES: ' + mm.length + (mm.length ? '  (' + mm.map(function (x) { return x.id + ' ' + x.m.join(','); }).join(' · ') + ')' : ''));

// ── ¿y a nivel FILA de Data_Email? cuántas filas caen en cada quincena
console.log('\n══ distribución de las 264 filas de Data_Email por quincena ══');
var porQ = {};
E.forEach(function (r) { var d = r['Send_Date'] ? iso(r['Send_Date']) : '(sin fecha)'; var k = d === '(sin fecha)' ? d : Qz(d); porQ[k] = (porQ[k] || 0) + 1; });
Object.keys(porQ).sort().forEach(function (k) { console.log('    ' + k.padEnd(14) + String(porQ[k]).padStart(4) + ' filas'); });

// ── la pieza manual de Rick: ¿qué pistas de periodo hay en su fila?
console.log('\n══ 009-P005 · la pieza que Rick declaró a mano ══');
var p9 = P.filter(function (x) { return t(x['Pieza_ID']) === '009-P005'; })[0];
var cn9 = [t(p9['Content_Name'])].concat(t(p9['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean);
E.filter(function (r) { return cn9.indexOf(t(r['Email_Content_Name'])) >= 0; }).forEach(function (r) {
  console.log('  columnas con algo que huela a periodo:');
  Object.keys(r).forEach(function (k) {
    if (/date|fecha|quincena|mes|month|week|semana|periodo/i.test(k)) console.log('    ' + k.padEnd(30) + JSON.stringify(r[k]));
  });
});
console.log('  otras piezas de Fuel for life y sus fechas:');
P.filter(function (x) { return t(x['Campaña']) === 'Fuel for life'; }).forEach(function (x) {
  console.log('    ' + t(x['Pieza_ID']) + '  ' + t(x['Touchpoint']).padEnd(6) + t(x['Segmento']).slice(0, 24).padEnd(26) +
    (t(x['Fecha_Primer_Envio']) || '— sin fecha —').padEnd(13) + 'sends=' + String(x['Sends']).padStart(7) + '  ' + t(x['Content_Name']).slice(-32));
});
