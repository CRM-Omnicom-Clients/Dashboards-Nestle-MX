// FB-anclaje.js — B7: ¿está el Pieza_ID bien anclado entre TODAS las hojas?
//
// 🔴 POR QUÉ ES EL PASO CRÍTICO. `Pieza_ID` es la única llave que une el catálogo con las cuatro
//    hojas de datos y con el reporte. Si un dato no ancla, no es que salga mal: **no sale**. Ya
//    pasó — 6 envíos de WhatsApp pasaron semanas sin llegar a ningún reporte porque nadie medía
//    esto, y hoy `Data_WhatsApp` tiene 0 de 12 filas ancladas.
//
// 🔴 LO QUE SE MIDE, Y POR QUÉ CADA COSA
//    1 · FORMA      — todo id cumple `NNN-PNNN`. Un id con otra forma no cruza y nadie se entera.
//    2 · UNICIDAD   — el catálogo no repite ids. Un id duplicado hace que un dato se sume dos veces.
//    3 · HACIA ARRIBA — todo id usado en una hoja de datos EXISTE en el catálogo (huérfanos).
//    4 · HACIA ABAJO  — toda pieza del catálogo con datos aparece en alguna hoja (piezas mudas).
//    5 · COBERTURA  — qué % de filas de cada hoja tiene ancla, y las que no, CON SU MOTIVO.
//    6 · COHERENCIA — el mismo id da las mismas dimensiones canónicas en todas las hojas.
//                     Esta es la que de verdad prueba que el anclaje SIRVE: un id que ancla pero
//                     trae BU distinto en dos hojas es peor que uno que no ancla.
//
// USO:  node FB-anclaje.js  ·  sale 1 si hay bloqueos
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var BLOQUEA = [], AVISA = [], V = [];
function chk(ok, n, d, bloqueante) {
  V.push([ok, n, d]);
  if (!ok) (bloqueante === false ? AVISA : BLOQUEA).push(n + ' — ' + d);
}

var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_fb.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
function hoja(n) { return wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', blankrows: false }) : null; }

console.log('════════ B7 · ANCLAJE DE Pieza_ID ════════');
console.log('  archivo: ' + vivo.archivo + '\n');

// ── el catálogo: la autoridad ──────────────────────────────────────────────────────────────
var P = hoja('Catalogo_Piezas') || [];
var ID_OK = /^\d{3}-P\d{3}$/;
var enCat = {}, dupCat = {}, malForma = [];
P.forEach(function (p) {
  var id = t(p['Pieza_ID']);
  if (!id) return;
  if (!ID_OK.test(id)) malForma.push(id);
  if (enCat[id]) dupCat[id] = (dupCat[id] || 1) + 1;
  enCat[id] = p;
});
console.log('  ── el catálogo (autoridad)');
console.log('     piezas: ' + P.length + '   ids únicos: ' + Object.keys(enCat).length);
chk(malForma.length === 0, '1 · todo Pieza_ID del catálogo cumple NNN-PNNN',
  malForma.length ? malForma.slice(0, 6).join(' · ') : 'los ' + Object.keys(enCat).length + ' bien formados');
chk(Object.keys(dupCat).length === 0, '2 · el catálogo no repite ningún Pieza_ID',
  Object.keys(dupCat).length ? Object.keys(dupCat).join(' · ') : 'ninguno repetido');

// ── las hojas de datos ─────────────────────────────────────────────────────────────────────
// cada hoja declara dónde vive su id y qué columna mide su volumen, para poder decir cuánto
// dato se está perdiendo cuando algo no ancla.
var HOJAS = [
  { n: 'Data_Email', col: 'pieza_id', vol: 'Email_Sends' },
  { n: 'Data_WhatsApp', col: 'pieza_id', vol: 'Sends' },
  { n: 'Data_Qcart_Carritos', col: 'pieza_id', vol: null },
  { n: 'Data_Qcart_Productos', col: 'pieza_id', vol: null }
];
var usados = {}, resumen = [];
console.log('\n  ── cobertura por hoja');
HOJAS.forEach(function (H) {
  var R = hoja(H.n);
  if (!R) { console.log('     ⚠ ' + H.n + ': no existe'); return; }
  var cols = Object.keys(R[0] || {});
  // la columna del id se busca sin distinguir mayúsculas: `pieza_id` vs `Pieza_ID` es el mismo dato
  var cid = cols.filter(function (c) { return /^pieza[_ ]?id$/i.test(c); })[0];
  var conAncla = 0, sinAncla = 0, huerfanos = {}, volSin = 0;
  R.forEach(function (x) {
    var id = cid ? t(x[cid]) : '';
    var v = H.vol ? (Number(String(x[H.vol]).replace(/[, ]/g, '')) || 0) : 1;
    if (!id) { sinAncla++; volSin += v; return; }
    conAncla++; usados[id] = (usados[id] || 0) + 1;
    if (!enCat[id]) huerfanos[id] = (huerfanos[id] || 0) + 1;
  });
  var pct = R.length ? Math.round(conAncla / R.length * 100) : 0;
  resumen.push({ hoja: H.n, filas: R.length, conAncla: conAncla, sinAncla: sinAncla, pct: pct, huerfanos: Object.keys(huerfanos), volSin: volSin, colId: cid });
  console.log('     ' + H.n.padEnd(22) + String(R.length).padStart(5) + ' filas · ancladas ' +
    String(conAncla).padStart(5) + ' (' + String(pct).padStart(3) + '%)' +
    (sinAncla ? '  🔴 sin ancla: ' + sinAncla + (H.vol ? '  (' + mil(volSin) + ' ' + H.vol + ' que NO llegan al reporte)' : '') : '') +
    (!cid ? '   🔴 NO EXISTE la columna del id' : ''));
  if (Object.keys(huerfanos).length) console.log('        🔴 huérfanos (no están en el catálogo): ' + Object.keys(huerfanos).join(' · '));
});
chk(resumen.every(function (r) { return r.colId; }), '3a · toda hoja de datos tiene su columna de Pieza_ID',
  resumen.filter(function (r) { return !r.colId; }).map(function (r) { return r.hoja; }).join(' · ') || 'las ' + resumen.length + ' la tienen');
var totHuerf = resumen.reduce(function (a, r) { return a.concat(r.huerfanos); }, []);
chk(totHuerf.length === 0, '3b · ningún id usado en datos falta en el catálogo',
  totHuerf.length ? totHuerf.slice(0, 8).join(' · ') : 'ninguno huérfano');
var sinAnclaTot = resumen.reduce(function (a, r) { return a + r.sinAncla; }, 0);
chk(sinAnclaTot === 0, '5 · toda fila de datos tiene ancla',
  sinAnclaTot ? sinAnclaTot + ' filas sin ancla: ' + resumen.filter(function (r) { return r.sinAncla; }).map(function (r) { return r.hoja + '(' + r.sinAncla + ')'; }).join(' · ') : 'todas ancladas');

// ── hacia abajo: piezas del catálogo que no aparecen en ningún dato ────────────────────────
// ⚠ esto AVISA, no bloquea: una pieza puede estar dada de alta y aún no haber salido.
var mudas = Object.keys(enCat).filter(function (id) { return !usados[id]; });
console.log('\n  ── piezas del catálogo sin ningún dato: ' + mudas.length + ' de ' + Object.keys(enCat).length);
if (mudas.length) console.log('     ' + mudas.slice(0, 20).join(' · ') + (mudas.length > 20 ? ' … +' + (mudas.length - 20) : ''));
chk(mudas.length === 0, '4 · toda pieza del catálogo tiene datos', mudas.length + ' sin datos (puede ser normal: aún no salen)', false);

// ── Catalogo_Referencias ───────────────────────────────────────────────────────────────────
var Rf = hoja('Catalogo_Referencias');
if (Rf) {
  // 🔴 la columna se llama `Pieza_IDs` (PLURAL) y contiene VARIOS ids separados. La version
  //    anterior buscaba `pieza_id` en singular, no encontraba nada, evaluaba CERO casos... y
  //    pintaba verde. **Un check que no compara nada no puede decir que todo esta bien.**
  var cRef = Object.keys(Rf[0] || {}).filter(function (c) { return /^pieza[_ ]?ids?$/i.test(c); })[0];
  var refHuerf = {}, refCon = 0, refIds = 0, truncadas = 0;
  if (cRef) {
    Rf.forEach(function (x) {
      var crudo = t(x[cRef]); if (!crudo) return;
      refCon++;
      // 🔴 el campo guarda una lista separada por ESPACIOS y ademas TRUNCADA («… (+65)»):
      //    es un campo de despliegue, no una llave. Se extraen solo los ids bien formados;
      //    partir por comas tomaba la cadena entera como un id y los marcaba huerfanos a todos.
      var ids = crudo.match(/\d{3}-P\d{3}/g) || [];
      if (/\(\+\d+\)|…/.test(crudo)) truncadas++;
      ids.forEach(function (id) { refIds++; if (!enCat[id]) refHuerf[id] = 1; });
    });
  }
  console.log('\n  ── Catalogo_Referencias: ' + Rf.length + ' filas · columna «' + (cRef || 'NO ENCONTRADA') +
    '» · filas con ids ' + refCon + ' · ids citados ' + refIds +
    (truncadas ? '  ⚠ ' + truncadas + ' listas TRUNCADAS («… +N»): es campo de despliegue, no llave' : '') +
    (Object.keys(refHuerf).length ? '  🔴 huerfanos: ' + Object.keys(refHuerf).slice(0, 6).join(' · ') : (refIds ? '  ✔ todos cruzan' : '')));
  chk(!!cRef && refIds > 0 && Object.keys(refHuerf).length === 0,
    '3c · Catalogo_Referencias cruza al catalogo',
    !cRef ? 'NO se encontro la columna de ids' :
      (refIds === 0 ? '🔴 0 ids citados: el check no probo NADA' :
        (Object.keys(refHuerf).length ? Object.keys(refHuerf).length + ' huerfanos' : refIds + ' ids cruzan desde ' + refCon + ' filas')));
}

// ── 6 · COHERENCIA: el mismo id, las mismas dimensiones en todas partes ────────────────────
// 🔴 LA QUE DE VERDAD PRUEBA QUE EL ANCLAJE SIRVE. Un id que ancla pero trae BU distinto en dos
//    hojas es peor que uno que no ancla: el reporte suma cosas que no son lo mismo, y en verde.
var DIMS = [['BU', /^bu(_canonico)?$/i], ['Marca', /^marca(_canonica)?$/i],
['Campaña', /^campa[nñ]a(_canonica)?$/i], ['Segmento', /^segmento(_canonico)?$/i]];
var choques = [];
HOJAS.forEach(function (H) {
  var R = hoja(H.n); if (!R || !R.length) return;
  var cols = Object.keys(R[0]);
  var cid = cols.filter(function (c) { return /^pieza[_ ]?id$/i.test(c); })[0]; if (!cid) return;
  R.forEach(function (x) {
    var id = t(x[cid]); var p = enCat[id]; if (!p) return;
    DIMS.forEach(function (D) {
      // 🔴 SE COMPARA LA COLUMNA CANONICA, NUNCA LA CRUDA. `Data_Email` trae `BU` = «Recetas
      //    Nestlé» (el valor tal como llega de la fuente) y `BU_Canonico` = «RN». Compararlas
      //    contra el catalogo canonico daba 205 «contradicciones» que no lo eran: eran dos
      //    vocabularios distintos, que es EXACTAMENTE para lo que existe la columna canonica.
      //    Si la hoja tiene canonica, esa manda; la cruda es el origen y puede diferir.
      var todas = cols.filter(function (c) { return D[1].test(c); });
      var cHoja = todas.filter(function (c) { return /canonic/i.test(c); })[0] || todas[0];
      if (!cHoja) return;
      var vHoja = t(x[cHoja]), vCat = t(p[D[0]]);
      if (!vHoja || !vCat) return;
      // se comparan normalizados: acentos y separadores no son una diferencia real
      if (L.nmz(vHoja) !== L.nmz(vCat)) {
        choques.push({ hoja: H.n, id: id, dim: D[0], enHoja: vHoja, enCatalogo: vCat });
      }
    });
  });
});
var porDim = {};
choques.forEach(function (c) { var k = c.hoja + '·' + c.dim; porDim[k] = (porDim[k] || 0) + 1; });
console.log('\n  ── coherencia de dimensiones (el mismo id → el mismo valor en todas las hojas)');
if (!choques.length) console.log('     ✔ sin contradicciones');
else {
  Object.keys(porDim).forEach(function (k) { console.log('     🔴 ' + k + ': ' + porDim[k] + ' choque(s)'); });
  choques.slice(0, 6).forEach(function (c) {
    console.log('        ' + c.id + ' ' + c.dim + ': hoja=«' + c.enHoja + '» vs catálogo=«' + c.enCatalogo + '»');
  });
}
chk(choques.length === 0, '6 · el mismo Pieza_ID da las mismas dimensiones en todas las hojas',
  choques.length ? choques.length + ' contradicciones' : 'coherente en las ' + resumen.length + ' hojas');

// ── veredicto ──────────────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
V.forEach(function (v) { console.log('  ' + (v[0] ? '✔' : '🔴') + ' ' + v[1].padEnd(56) + ' ' + (v[2] || '')); });
fs.writeFileSync(BACK + '/_fuentes/anclaje.json', JSON.stringify({
  paso: 'B7', archivo: vivo.archivo, piezas: Object.keys(enCat).length,
  por_hoja: resumen, mudas: mudas, huerfanos: totHuerf, choques: choques,
  checks: V.map(function (v) { return { ok: v[0], check: v[1], dato: String(v[2]) }; })
}, null, 1));
console.log('\n  ' + (BLOQUEA.length ? '🔴 ' + BLOQUEA.length + ' BLOQUEO(S) de anclaje' : '✅ ANCLAJE SANO'));
BLOQUEA.forEach(function (b) { console.log('     🔴 ' + b); });
AVISA.forEach(function (a) { console.log('     ⚠ ' + a); });
process.exit(BLOQUEA.length ? 1 : 0);
