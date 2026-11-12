// Q4 · MAPEAR LOS LINKS DE `crm-hive` A SU PIEZA — y declarar lo que no resuelve.
//
// 🔴 LA SEÑAL DURA ES `utm_source = crm-hive`, no el nombre de la campaña. De los 1,222 eventos
//    que el catálogo no conoce y que parecen nuestros, solo los de `crm-hive` salieron de una
//    pieza de CRM: los demás llevan `qc_recetas_nestle_mx` o `journey_tp`, que son los links de
//    las páginas de receta — mismo panel, otro dueño. Confundirlos metería tráfico ajeno al
//    reporte, que es la forma más silenciosa de inflar la intención.
//
// 🔴 EL PUENTE ES `utm_campaign` + `utm_content`. El `utm_content` ES el touchpoint (`e-p1`,
//    `e-botana1`), y el `utm_campaign` dice la campaña. Las dos cosas vienen de la fuente, no de
//    una corazonada. Lo que no case con una pieza existente **se declara**, no se fuerza.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase().replace(/[^a-z0-9]/g, ''); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// 🔴 la equivalencia utm_campaign → campaña del catálogo. Se DECLARA aquí, con su porqué; no se
//    deduce del parecido de los nombres.
var CAMPANA_DE = {
  'lechera-junio': { camp: 'Antojo Infinito', por: 'La Lechera; sus utm_content (e-p1…e-c1) son los touchpoints de esa campaña' },
  'maggi-junio26': { camp: 'Mundial', por: 'Maggi Mundial de junio; utm_content por partido (e-botana1, e-cooking1…)' },
  'maggi-julio26': { camp: 'Mundial', por: 'Maggi Mundial de julio; misma serie de touchpoints' },
  'maggi-ligamx-agosto26': { camp: 'Liga MX', por: 'Liga MX de agosto; utm_content e-p1…e-p7' }
};

var lec = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');
var todos = (lec.carritos || []).concat(lec.productos || []);
var T = os.homedir() + '/_q4.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var conocido = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { conocido[t(c).toLowerCase()] = 1; });
  });
});

console.log('════════ Q4 · LOS LINKS DE crm-hive → SU PIEZA ════════\n');
// índice de piezas por campaña + touchpoint
var porCampTp = {};
P.forEach(function (p, i) {
  var k = nmz(p[N('campana')]) + '¦' + nmz(p[N('touchpoint')]);
  (porCampTp[k] = porCampTp[k] || []).push({ p: p, fila: i + 2, id: t(p[N('pieza_id')]) });
});

var links = {};
todos.forEach(function (e) {
  var src = t(e.utm_source || e.source).toLowerCase();
  if (src !== 'crm-hive') return;
  var cod = t(e.shortlink_code || e['shortlink code'] || e.shortlink);
  if (!cod || conocido[cod.toLowerCase()]) return;
  var camp = t(e.utm_campaign || e.campaign), cont = t(e.utm_content);
  var k = cod;
  links[k] = links[k] || { cod: cod, nombre: t(e.shortlink_name || e['shortlink name']), utm_campaign: camp,
    utm_content: {}, tiendas: {}, n: 0, desde: '', hasta: '' };
  links[k].n++;
  if (cont) links[k].utm_content[cont] = 1;
  var st = t(e.store); if (st) links[k].tiendas[st] = 1;
  var f = t(e.fecha || e.date).slice(0, 10);
  if (f) { if (!links[k].desde || f < links[k].desde) links[k].desde = f; if (!links[k].hasta || f > links[k].hasta) links[k].hasta = f; }
});
var ls = Object.keys(links).map(function (k) { return links[k]; });
console.log('  links de crm-hive que el catálogo no conoce: ' + ls.length + '   ·   ' + mil(ls.reduce(function (a, x) { return a + x.n; }, 0)) + ' eventos\n');

var resueltos = [], sinPieza = [];
ls.forEach(function (l) {
  var eq = CAMPANA_DE[l.utm_campaign];
  if (!eq) { sinPieza.push({ l: l, por: 'la utm_campaign «' + l.utm_campaign + '» no está declarada en Q4' }); return; }
  var conts = Object.keys(l.utm_content);
  if (!conts.length) { sinPieza.push({ l: l, por: 'sin utm_content: no se sabe qué touchpoint es' }); return; }
  var cands = [];
  conts.forEach(function (c) {
    var k = nmz(eq.camp) + '¦' + nmz(c);
    (porCampTp[k] || []).forEach(function (x) { if (cands.indexOf(x) < 0) cands.push(x); });
  });
  if (cands.length === 1) { resueltos.push({ l: l, camp: eq.camp, pieza: cands[0], conts: conts }); return; }
  if (cands.length > 1) {
    // varias piezas del mismo campaña×touchpoint: se queda la de EMAIL (el link va en el correo)
    var em = cands.filter(function (x) { return /email/i.test(t(x.p[N('canal')])); });
    if (em.length === 1) { resueltos.push({ l: l, camp: eq.camp, pieza: em[0], conts: conts, nota: 'varias candidatas; se toma la de Email' }); return; }
    sinPieza.push({ l: l, por: cands.length + ' piezas candidatas: ' + cands.map(function (x) { return x.id; }).join(', ') });
    return;
  }
  sinPieza.push({ l: l, por: 'no hay pieza de «' + eq.camp + '» con touchpoint ' + conts.join('/') });
});

console.log('══ resueltos ══');
var porPieza = {};
resueltos.forEach(function (r) { (porPieza[r.pieza.id] = porPieza[r.pieza.id] || []).push(r); });
Object.keys(porPieza).sort().forEach(function (id) {
  var rs = porPieza[id], p = rs[0].pieza.p;
  console.log('   ' + id.padEnd(10) + t(p[N('campana')]).padEnd(17) + t(p[N('touchpoint')]).padEnd(12) +
    rs.length + ' link(s) · ' + mil(rs.reduce(function (a, x) { return a + x.l.n; }, 0)) + ' eventos   ' +
    rs[0].l.desde + '→' + rs[rs.length - 1].l.hasta);
  rs.slice(0, 3).forEach(function (r) { console.log('        ' + r.l.cod.padEnd(10) + r.l.nombre.slice(0, 44)); });
  if (rs.length > 3) console.log('        … y ' + (rs.length - 3) + ' más');
});
console.log('\n══ sin pieza — se declaran, no se fuerzan ══');
var porMotivo = {};
sinPieza.forEach(function (s) { (porMotivo[s.por] = porMotivo[s.por] || []).push(s.l); });
Object.keys(porMotivo).forEach(function (m) {
  var ev = porMotivo[m].reduce(function (a, x) { return a + x.n; }, 0);
  console.log('   ' + String(porMotivo[m].length).padStart(3) + ' link(s) · ' + mil(ev).padStart(6) + ' ev · ' + m.slice(0, 84));
});
console.log('\n  resueltos: ' + resueltos.length + ' links   ·   sin pieza: ' + sinPieza.length + ' links');

fs.writeFileSync(BACK + '/_insumos/qcart-links-mapeados.json', JSON.stringify({
  paso: 'Q4', equivalencias: CAMPANA_DE,
  resueltos: resueltos.map(function (r) { return { cod: r.l.cod, nombre: r.l.nombre, pieza: r.pieza.id, fila: r.pieza.fila,
    campana: r.camp, utm_campaign: r.l.utm_campaign, utm_content: r.conts, eventos: r.l.n, tiendas: Object.keys(r.l.tiendas), nota: r.nota || '' }; }),
  sin_pieza: sinPieza.map(function (s) { return { cod: s.l.cod, nombre: s.l.nombre, utm_campaign: s.l.utm_campaign,
    utm_content: Object.keys(s.l.utm_content), eventos: s.l.n, motivo: s.por }; })
}, null, 1));
console.log('\n  → _insumos/qcart-links-mapeados.json');
