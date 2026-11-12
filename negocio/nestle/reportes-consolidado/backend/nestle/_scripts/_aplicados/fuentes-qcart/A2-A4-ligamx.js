// A2+A4 · LIGA MX: el touchpoint es E-J4 y CON/SIN REGIÓN es el SEGMENTO. Y sus ContentName.
//
// 🔴 OTRO VALOR INFERIDO QUE ACEPTÉ. El handoff traía `J4-ConRegión*` / `J4-SinRegión*` —con
//    asterisco— y lo escribí como TOUCHPOINT. Rick: el touchpoint es **E-J4** y «Usuarios CON
//    región» / «Usuarios sin región» son **segmentos** de esa misma pieza. Es el mismo error que
//    «Espresso Con», en otra columna: tomé por dato lo que era la lectura de alguien.
//
// 🔴 Y LOS LINKS DE QCART VAN POR REGIÓN, NO POR TOUCHPOINT. Rick los dio así:
//        CON región · Botón 1 · Botana de Jamaica     · i8LZ55bd
//        CON región · Botón 2 · Tropi MAGGI® Shot     · HThaf6bT
//        SIN región · Botón 1 · Nachos con carne      · 4tBsCXTp
//        SIN región · Botón 2 · Aceitunas Toreadas    · hTHNLqzL
//    Hoy los tengo colgados de la pieza equivocada, emparejados por touchpoint. Se recolocan.
//
// 🔴 A4 · los 4 ContentName vacíos. `005-P001…P004` son de Email y no tienen `Content_Name`, así
//    que no cruzan con SFMC por la llave que declara el handoff. Este paso **no los inventa**:
//    los busca en la DE por EmailID y, si no están, lo declara.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var V = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/A5-vocabulario.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var SEG_CON = 'Usuarios CON región', SEG_SIN = 'Usuarios sin región';
// 🔴 el reparto que dictó Rick. `boton` es el orden dentro del correo, no una categoría inventada.
var LINKS = [
  { cod: 'i8LZ55bd', region: 'CON', boton: 1, receta: 'Botana de Jamaica' },
  { cod: 'HThaf6bT', region: 'CON', boton: 2, receta: 'Tropi MAGGI® Shot' },
  { cod: '4tBsCXTp', region: 'SIN', boton: 1, receta: 'Nachos con carne' },
  { cod: 'hTHNLqzL', region: 'SIN', boton: 2, receta: 'Aceitunas Toreadas' }
];

console.log('════════ A2 + A4 · LIGA MX ════════\n');
V.exigir({ campana: 'Liga MX', marca: 'Maggi', bu: 'RN', objetivo: 'Purchase' }, 'A2');
console.log('  vocabulario ✔\n');

var C = os.homedir() + '/_a2.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
h.exigir(['catalogo.pieza_id', 'catalogo.touchpoint', 'catalogo.segmento', 'catalogo.content_name',
  'catalogo.emailid', 'catalogo.notas'], 'A2');
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function filaDe(id) { var o = -1; P.forEach(function (p, i) { if (t(p[N('pieza_id')]) === id) o = i + 2; }); return o; }

// ── A2.1 · el touchpoint y el segmento de las dos piezas de agosto
console.log('══ A2.1 · touchpoint E-J4, y CON/SIN región al SEGMENTO ══');
var deRegion = {};
[['005-P005', SEG_CON], ['005-P006', SEG_SIN]].forEach(function (x) {
  var f = filaDe(x[0]);
  if (f < 0) { console.log('   🔴 ' + x[0] + ' no está'); return; }
  var p = P[f - 2];
  deRegion[x[1] === SEG_CON ? 'CON' : 'SIN'] = { id: x[0], fila: f };
  console.log('   ✔ ' + x[0] + '   tp «' + t(p[N('touchpoint')]) + '» → «E-J4»   seg «' + t(p[N('segmento')]) + '» → «' + x[1] + '»');
  CB.apuntar('A2', 'Catalogo_Piezas', f, N('touchpoint'), 'E-J4',
    'A2 · el handoff traía «J4-ConRegión»/«J4-SinRegión» como touchpoint, con asterisco (inferido). Rick: el touchpoint es E-J4 y la región es el SEGMENTO.');
  CB.apuntar('A2', 'Catalogo_Piezas', f, N('segmento'), x[1],
    'A2 · segmento dictado por Rick el 21-ago: CON/SIN región son segmentos de la misma pieza E-J4.');
});

// ── A2.2 · los links, por región y botón
console.log('\n══ A2.2 · los 4 links de Qcart, por región y botón ══');
var Q = require(BACK + '/_scripts/lib-qcart-links.js');
// primero: quitar los que puse mal en otras piezas
var mal = [];
P.forEach(function (p, i) {
  if (!/^005-/.test(t(p[N('pieza_id')]))) return;
  for (var s = 1; s <= 4; s++) {
    ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
      var col = pre + s, val = t(p[col]);
      if (!val) return;
      var cods = Q.codigosDe(val);
      var sobran = cods.filter(function (c) {
        var lk = LINKS.filter(function (l) { return l.cod === c; })[0];
        if (!lk) return false;
        return deRegion[lk.region] && deRegion[lk.region].id !== t(p[N('pieza_id')]);
      });
      if (sobran.length) mal.push({ pieza: t(p[N('pieza_id')]), fila: i + 2, col: col, val: val, sobran: sobran, quedan: cods.filter(function (c) { return sobran.indexOf(c) < 0; }) });
    });
  }
});
mal.forEach(function (m) {
  console.log('   − ' + m.pieza + ' ' + m.col.padEnd(16) + 'quita ' + m.sobran.join(', ') + (m.quedan.length ? '   (queda ' + m.quedan.join(', ') + ')' : '   (queda vacío)'));
  CB.apuntar('A2', 'Catalogo_Piezas', m.fila, m.col, m.quedan.join('; '),
    'A2 · el link estaba en la pieza equivocada: Rick lo reparte por REGIÓN (CON/SIN), no por touchpoint.');
});
// y ponerlos donde van, en el slot del botón
LINKS.forEach(function (l) {
  var d = deRegion[l.region];
  if (!d) { console.log('   🔴 ' + l.cod + ': no encontré la pieza de ' + l.region + ' región'); return; }
  var colCod = 'Cod_Walmart_' + l.boton, colRec = 'Receta_' + l.boton;
  console.log('   + ' + d.id + ' ' + colCod.padEnd(16) + l.cod.padEnd(10) + '· Botón ' + l.boton + ' · ' + l.receta);
  CB.apuntar('A2', 'Catalogo_Piezas', d.fila, colCod, l.cod,
    'A2 · Rick, 21-ago: usuarios ' + l.region + ' región · Botón ' + l.boton + ' · ' + l.receta);
  if (enc.indexOf(colRec) >= 0) {
    CB.apuntar('A2', 'Catalogo_Piezas', d.fila, colRec, l.receta,
      'A2 · receta del Botón ' + l.boton + ', dictada por Rick.');
  }
});

// ── A4 · los ContentName vacíos, buscados en la DE (no inventados)
console.log('\n══ A4 · los ContentName vacíos de Liga MX ══');
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var porEid = {}; D.rows.forEach(function (r) { porEid[t(r.Email_ID)] = r; });
var sinCN = P.filter(function (p) { return /^005-/.test(t(p[N('pieza_id')])) && !t(p[N('content_name')]); });
console.log('   piezas de Liga MX sin Content_Name: ' + sinCN.length);
var puestos = 0, sinDato = [];
sinCN.forEach(function (p) {
  var id = t(p[N('pieza_id')]), eid = t(p[N('emailid')]);
  var f = filaDe(id);
  if (!eid) { sinDato.push({ id: id, por: 'no tiene EmailID: no hay por dónde buscarlo en la DE' }); return; }
  var r = porEid[eid];
  if (!r) { sinDato.push({ id: id, por: 'su EmailID ' + eid + ' no está en `CRM_Email_Piezas`' }); return; }
  console.log('   ✔ ' + id + '  eid ' + eid + '  →  …' + t(r.Email_Content_Name).slice(-52));
  CB.apuntar('A4', 'Catalogo_Piezas', f, N('content_name'), t(r.Email_Content_Name),
    'A4 · ContentName tomado de `CRM_Email_Piezas` por su EmailID. Es la llave que declara el handoff; sin él la pieza no cruza con SFMC.');
  puestos++;
});
if (sinDato.length) {
  console.log('\n   🔴 ' + sinDato.length + ' que NO se pueden llenar — se declaran, no se inventan:');
  sinDato.forEach(function (x) { console.log('      ' + x.id.padEnd(10) + x.por); });
}

var res = CB.resumen();
console.log('\n  ── acumulado hasta ahora: ' + res.total + ' celda(s)   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
