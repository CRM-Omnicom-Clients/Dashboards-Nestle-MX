// Q3 · QUÉ DE ESE TRÁFICO DESCONOCIDO ES NUESTRO — y qué es orgánico.
//
// 🔴 «Campaña que el catálogo no conoce» NO es lo mismo que «campaña nuestra que falta dar de
//    alta». El shortlink de Qcart lo usa TODO Nestlé: hay tráfico de Instagram, de orgánico y de
//    otras agencias en el mismo panel. Nuestra firma es el MEDIO y la FUENTE, no el nombre de la
//    campaña — y esa es justo la regla que impide inferir del naming: `hot_cakes_clasicos` suena
//    a Hotcakes, y puede ser tráfico orgánico que nunca pasó por un correo nuestro.
//
// 🔴 LO QUE SE BUSCA: eventos con `utm_medium = email` (o whatsapp) y `utm_source = crm-hive`.
//    Esos SÍ salieron de una pieza nuestra; si el catálogo no los conoce, es que falta darlos de
//    alta. Lo demás se declara como ajeno y se deja fuera, que es lo correcto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var XLSX = require('xlsx');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var lec = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');
var todos = (lec.carritos || []).concat(lec.productos || []);
console.log('════════ Q3 · QUÉ DEL TRÁFICO DESCONOCIDO ES NUESTRO ════════\n');
console.log('  eventos leídos: ' + mil(todos.length));

// el padrón de códigos que el catálogo YA conoce
var T = os.homedir() + '/_q3.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var conocido = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { conocido[t(c).toLowerCase()] = t(p[N('pieza_id')]); });
  });
});
console.log('  códigos de link que el catálogo conoce: ' + Object.keys(conocido).length + '\n');

// 🔴 la firma de lo nuestro: medio + fuente, no el nombre
function esNuestro(e) {
  var med = t(e.utm_medium || e.medium).toLowerCase();
  var src = t(e.utm_source || e.source).toLowerCase();
  return (/^(email|whatsapp|wa)$/.test(med) || /crm/.test(src)) && !/instagram|facebook|organic|tiktok/.test(med + src);
}
var desconocidos = todos.filter(function (e) { return !conocido[t(e.shortlink_code || e['shortlink code'] || e.shortlink).toLowerCase()]; });
var nuestros = desconocidos.filter(esNuestro);
var ajenos = desconocidos.filter(function (e) { return !esNuestro(e); });
console.log('  eventos sin código conocido: ' + mil(desconocidos.length));
console.log('     de ellos NUESTROS (email/whatsapp/crm): ' + mil(nuestros.length));
console.log('     ajenos (instagram, orgánico, otros)   : ' + mil(ajenos.length) + '   ← se quedan fuera, y está bien\n');

function agrupar(arr, por) {
  var g = {};
  arr.forEach(function (e) {
    var k = t(por(e)) || '(vacío)';
    g[k] = g[k] || { n: 0, links: {}, medios: {}, fuentes: {}, contents: {}, desde: '', hasta: '' };
    g[k].n++;
    g[k].links[t(e.shortlink_code || e['shortlink code'] || e.shortlink)] = 1;
    g[k].medios[t(e.utm_medium || e.medium)] = 1;
    g[k].fuentes[t(e.utm_source || e.source)] = 1;
    if (t(e.utm_content)) g[k].contents[t(e.utm_content)] = 1;
    var f = t(e.fecha || e.date).slice(0, 10);
    if (f) { if (!g[k].desde || f < g[k].desde) g[k].desde = f; if (!g[k].hasta || f > g[k].hasta) g[k].hasta = f; }
  });
  return g;
}
console.log('══ lo NUESTRO que el catálogo no conoce, por campaña utm ══');
var gn = agrupar(nuestros, function (e) { return e.utm_campaign || e.campaign; });
Object.keys(gn).sort(function (a, b) { return gn[b].n - gn[a].n; }).forEach(function (k) {
  var g = gn[k];
  console.log('   ' + String(g.n).padStart(5) + ' ev · ' + String(Object.keys(g.links).length).padStart(3) + ' links · ' +
    k.slice(0, 34).padEnd(36) + g.desde + '→' + g.hasta + '  medio=' + Object.keys(g.medios).join('/') +
    '  fuente=' + Object.keys(g.fuentes).join('/'));
  if (Object.keys(g.contents).length) console.log('           utm_content: ' + Object.keys(g.contents).slice(0, 8).join(' · '));
});
console.log('\n══ lo AJENO, para dejar constancia de que se miró ══');
var ga = agrupar(ajenos, function (e) { return t(e.utm_medium || e.medium) + ' / ' + t(e.utm_source || e.source); });
Object.keys(ga).sort(function (a, b) { return ga[b].n - ga[a].n; }).slice(0, 8).forEach(function (k) {
  console.log('   ' + String(ga[k].n).padStart(5) + ' ev · ' + k);
});

fs.writeFileSync(BACK + '/_insumos/qcart-links-nuevos.json', JSON.stringify({
  paso: 'Q3', eventos: todos.length, desconocidos: desconocidos.length,
  nuestros: nuestros.length, ajenos: ajenos.length,
  campanas_nuestras: Object.keys(gn).map(function (k) {
    return { utm_campaign: k, eventos: gn[k].n, links: Object.keys(gn[k].links), desde: gn[k].desde, hasta: gn[k].hasta,
      medios: Object.keys(gn[k].medios), fuentes: Object.keys(gn[k].fuentes), utm_content: Object.keys(gn[k].contents) };
  })
}, null, 1));
console.log('\n  → _insumos/qcart-links-nuevos.json');
