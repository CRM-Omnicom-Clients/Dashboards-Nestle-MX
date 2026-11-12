// Cerrar las dos pérdidas de trazabilidad que encontró la prueba de uso:
//   (a) una pieza puede tener VARIOS content_name (Pro Plan: Perros/Gatos/Mixto) → se listan todos
//   (b) una receta puede tener VARIOS códigos por tienda → se listan todos, no solo el primero
// Los números ya cuadraban; lo que faltaba era poder RASTREAR cada fila hasta su pieza.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var cat = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_P5.json', 'utf8'));
var T = require('path').resolve(__dirname, '..') + '/_tmp/_tz.xlsx'; fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var Rf = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var aliasTP = {}, aliasSEG = {};
Rf.forEach(function (r) {
  if (t(r['Tipo']) !== 'alias') return;
  if (t(r['Dimension']) === 'Touchpoint') aliasTP[t(r['Contexto']) + '¦' + nm(r['Valor_Crudo'])] = t(r['Valor_Canonico']);
  if (t(r['Dimension']) === 'Segmento') aliasSEG[nm(r['Valor_Crudo'])] = t(r['Valor_Canonico']);
});

// ── (a) todos los content_name de cada pieza
var idx = {};
cat.piezas.forEach(function (p) { idx[[p.campana, p.nombre_pieza, p.segmento, p.email_type].join('¦')] = p; });
var porPieza = {};
E.forEach(function (r) {
  var camp = t(r['Campana_Canonica']);
  var tp = aliasTP[camp + '¦' + nm(r['Touchpoint'])] || t(r['Touchpoint']);
  var seg = aliasSEG[nm(r['Segmento_Canonico'])] || t(r['Segmento_Canonico']);
  var p = idx[[camp, tp, seg, t(r['Email_Type'])].join('¦')];
  if (!p) return;
  (porPieza[p.pieza_id] = porPieza[p.pieza_id] || {})[t(r['Email_Content_Name'])] = 1;
});
var conVarios = 0;
cat.piezas.forEach(function (p) {
  var cs = Object.keys(porPieza[p.pieza_id] || {});
  if (!cs.length) return;
  p.content_name = cs[0];
  p.content_names = cs.join(' ; ');
  p.n_content_names = cs.length;
  if (cs.length > 1) conVarios++;
});
console.log('(a) piezas con varios content_name: ' + conVarios);
cat.piezas.filter(function (p) { return num(p.n_content_names) > 1; }).forEach(function (p) {
  console.log('    ' + p.pieza_id + '  ' + p.campana.padEnd(14) + p.nombre_pieza.padEnd(6) + p.segmento.slice(0, 26).padEnd(28) + p.n_content_names + ' variantes');
});

// ── (b) todos los códigos por receta+tienda
var numsPorCod = {};
Q.forEach(function (r) {
  var c = t(r['Shortlink_Code']); if (!c) return;
  numsPorCod[c] = numsPorCod[c] || { carritos: 0, tiendas: {} };
  numsPorCod[c].carritos += num(r['Carts_Total_All_Products']);
  t(r['Tienda']).split(',').forEach(function (x) { if (t(x)) numsPorCod[c].tiendas[nm(x)] = 1; });
});
var enCat = {};
cat.piezas.forEach(function (p) { for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (k) enCat[k] = p.pieza_id; }); }); });
var exc = {}; Rf.filter(function (r) { return t(r['Tipo']) === 'excluido'; }).forEach(function (r) { exc[t(r['Valor_Crudo'])] = 1; });
// los códigos que Data_Qcart trae y el catálogo no muestra: se agregan a su receta
var doc = cat.doc || {}, recuperados = [];
Object.keys(numsPorCod).forEach(function (cod) {
  if (enCat[cod] || exc[cod]) return;
  var d = doc[cod]; if (!d) return;
  var esW = numsPorCod[cod].tiendas['walmartcommx'] || numsPorCod[cod].tiendas['walmart'];
  var campo = esW ? 'Cod_Walmart_' : 'Cod_Chedraui_';
  // buscar la pieza que ya tiene esa receta
  var puesto = false;
  cat.piezas.forEach(function (p) {
    if (puesto) return;
    for (var i = 1; i <= 5; i++) {
      if (nm(p['Receta_' + i]) && nm(p['Receta_' + i]) === nm(d.receta)) {
        var actual = t(p[campo + i]);
        if (actual.split(/\s*;\s*/).indexOf(cod) < 0) p[campo + i] = actual ? actual + ' ; ' + cod : cod;
        recuperados.push(cod + ' → ' + p.pieza_id + ' ' + campo.replace('Cod_', '').replace('_', '') + i + ' (' + d.receta + ')');
        puesto = true; return;
      }
    }
  });
});
console.log('\n(b) códigos recuperados en su receta: ' + recuperados.length);
recuperados.forEach(function (x) { console.log('    ' + x); });
fs.writeFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado');
