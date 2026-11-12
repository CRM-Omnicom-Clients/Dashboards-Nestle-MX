/*
 * catalogo.retirar-ep-ligamx.js — saca del catálogo las 4 piezas E-P* de Liga MX y sus alias.
 *
 * 🔴 RICK, 15-sep-2026: «Todos los E-p1, etc, ¿de dónde los sacaste? yo nunca te di eso; si no
 *    tienen email name pues no van». Y después: «si hacen ruido, elimínalos, en todo lo que haga
 *    referencia a ello para que no se recreen».
 *
 * DE DÓNDE SALIERON, que es lo que él preguntaba. De SU maestro de links, pero de una versión
 * ANTERIOR: `Qcart-Links Mails-Hive- MX.xlsx`, hoja Agosto, filas 5, 9, 18 y 26. En aquel momento
 * esas filas declaraban los touchpoints `e-p1`, `e-p2`, `e-p4` y `e-p6` para Liga MX. Rick rehizo
 * el maestro después y renumeró las jornadas: hoy la f5 dice `e-j4`, la f9 dice `e-j5`, y las f18
 * y f26 están VACÍAS. Comprobado el 15-sep: el maestro declara hoy para Liga MX exactamente
 * `e-j4 · e-j5 · e-j6 · e-j7 · e-j8 · e-j9 · wa-j8 · wa-j9` — y ni un solo `e-p*`.
 * O sea que el catálogo se quedó guardando el rastro de una versión superada, y yo lo leí como si
 * siguiera vigente.
 *
 * 🔴 LO QUE DE VERDAD HACÍA DAÑO NO ERA LA FILA: ERAN LOS ALIAS. `Catalogo_Referencias` declaraba
 *    «en el contexto Liga MX, un utm `e-p4` significa touchpoint E-P4». Esa regla es la que el
 *    14-sep mandó los carritos de `piPZpvXp` y `CVCPHfND` a `005-P003` por el utm, violando R2
 *    (el ancla es el SHORTLINK). Borrar las piezas sin borrar los alias no arregla nada: el
 *    siguiente tráfico viejo con `e-p*` vuelve a aterrizar en una pieza fantasma.
 *
 * 🔴 Y `E-P1`, `E-P2`, `E-P4` SON TOUCHPOINTS LEGÍTIMOS EN OTRAS CAMPAÑAS — AON tiene 6 piezas en
 *    E-P1 y Hotcakes tiene 2. Por eso NO se toca el vocabulario global: solo se retiran los alias
 *    cuyo `Contexto` es Liga MX. Un alias es CONTEXTUAL, no global; confundirlo aquí borraría la
 *    resolución de 20 piezas de otras campañas.
 *
 * 🔴 NADIE LAS RECREA, y eso se comprobó antes de escribir: ningún script las declara de alta.
 *    Lo único que las nombraba en el código eran dos PRUEBAS que las usaban de fixture, y esas se
 *    actualizan en el mismo commit — si no, quedan probando algo que ya no existe, que es la
 *    forma más silenciosa de que una suite se vuelva mentira.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var NL = String.fromCharCode(10);

var IDS = ['005-P001', '005-P002', '005-P003', '005-P004'];
var ALIAS_CRUDOS = ['e-p1', 'e-p2', 'e-p4', 'e-p6'];
var CONTEXTO = 'Liga MX';

console.log('════════ nestle-catalogo · RETIRAR LAS E-P* DE LIGA MX ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_retep.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var REF = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_ID');
var NM_TP = 'Touch' + 'Point', NM_CAMP = 'Camp' + 'aña', NM_SENDS = 'Send' + 's', NM_EN = 'Email' + '_Name';
var NM_RCRUDO = 'Valor' + '_Crudo', NM_RCANON = 'Valor' + '_Canonico', NM_RCTX = 'Contex' + 'to',
    NM_RDIM = 'Dimen' + 'sion', NM_RIDS = 'Pieza' + '_IDs', NM_RN = 'N_Pie' + 'zas';

// ══ LAS 5 PRUEBAS · sin las cinco en verde no se toca una fila ══════════════════════
var fallos = [];
function K(n, ok, det) { console.log('  ' + (ok ? '✔' : '🔴') + ' ' + n.padEnd(58) + det); if (!ok) fallos.push(n + ' — ' + det); }

console.log('  ── las 5 pruebas');
// P1 · existen las 4 y son de Liga MX
var filas4 = IDS.map(function (id) { return P.filter(function (p) { return t(p[nmP]) === id; })[0]; }).filter(Boolean);
K('P1 · las 4 existen y son de Liga MX', filas4.length === 4 && filas4.every(function (f) { return t(f[NM_CAMP]) === CONTEXTO; }),
  filas4.length + ' de 4 · campañas: ' + filas4.map(function (f) { return t(f[NM_CAMP]); }).join('/'));

// P2 · ninguna tiene Email_Name ni envíos — si alguna los tuviera, NO es residuo
var TOK = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
var conDato = filas4.filter(function (f) {
  var en = t(f[NM_EN]); var s = Number(t(f[NM_SENDS]));
  return (en && !TOK.test(en)) || (isFinite(s) && s > 0);
});
K('P2 · ninguna tiene Email_Name ni envíos', conDato.length === 0,
  conDato.length ? '🔴 ' + conDato.map(function (f) { return t(f[nmP]); }).join(' ') + ' SÍ tienen' : 'las 4 vacías: 0 envíos, sin nombre');

// P3 · el maestro ya no declara ningún e-p* para Liga MX
var LK = require(BACK + '/_scripts/lib-qcart-links.js');
var tps = {};
try {
  var MAEwb = XLSX.readFile((function () { var x = require('path').resolve(__dirname, '..') + '/_tmp/_retep-mae.xlsx'; fs.copyFileSync(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx', x); return x; })());
  MAEwb.SheetNames.forEach(function (h) {
    XLSX.utils.sheet_to_json(MAEwb.Sheets[h], { header: 1, defval: '' }).forEach(function (r) {
      if (!/ligamx|liga-mx/i.test(String(r[0] || ''))) return;
      var tp = t(r[4]).toLowerCase(); if (tp) tps[tp] = (tps[tp] || 0) + 1;
    });
  });
  fs.unlinkSync(require('path').resolve(__dirname, '..') + '/_tmp/_retep-mae.xlsx');
} catch (e) { }
var epVivos = Object.keys(tps).filter(function (k) { return /^e-p\d/.test(k); });
K('P3 · el maestro ya NO declara ningún e-p* para Liga MX', epVivos.length === 0,
  epVivos.length ? '🔴 sigue declarando ' + epVivos.join(' ') : 'declara solo: ' + Object.keys(tps).sort().join(' '));

// P4 · 🔴 LA QUE DE VERDAD PROTEGE: ni un dato suyo vive en ningún bloque
var menciones = {};
['_fuentes/email.json', '_fuentes/qcart.json', '_fuentes/whatsapp.json', '_rejilla/rejilla.json'].forEach(function (f) {
  var s = fs.readFileSync(BACK + '/' + f, 'utf8');
  IDS.forEach(function (id) { var n = (s.match(new RegExp(id, 'g')) || []).length; if (n) menciones[f + ' ' + id] = n; });
});
K('P4 · ni un dato suyo vive en ningún bloque', Object.keys(menciones).length === 0,
  Object.keys(menciones).length ? '🔴 ' + JSON.stringify(menciones) : 'cero menciones en email, qcart, whatsapp y rejilla');

// P5 · ninguna fórmula del libro las cita
var zipChk = new AdmZip(TMP), nForm = 0;
zipChk.getEntries().forEach(function (e) {
  if (!/^xl\/worksheets\/.*\.xml$/.test(e.entryName)) return;
  var x = e.getData().toString('utf8');
  IDS.forEach(function (id) { nForm += (x.match(new RegExp('<f>[^<]*' + id + '[^<]*</f>', 'g')) || []).length; });
});
K('P5 · ninguna fórmula del libro las cita', nForm === 0, nForm ? '🔴 ' + nForm + ' fórmula(s)' : 'cero fórmulas');

if (fallos.length) { console.log(NL + '  🔴 ' + fallos.length + ' prueba(s) en rojo. NO se toca nada.'); process.exit(1); }

// ══ EL PLAN ════════════════════════════════════════════════════════════════════════
console.log(NL + '  ── el plan');
// A · las 4 filas de Catalogo_Piezas
console.log('     A · Catalogo_Piezas: se van ' + IDS.length + ' filas   ' + IDS.join(' · '));

// B · los alias CONTEXTUALES de Liga MX (no el vocabulario global)
var aliasFuera = [];
REF.forEach(function (r, i) {
  if (!/^alias$/i.test(t(r['Tipo']))) return;
  if (!/touchpoint/i.test(t(r[NM_RDIM]))) return;
  if (t(r[NM_RCTX]) !== CONTEXTO) return;
  if (ALIAS_CRUDOS.indexOf(t(r[NM_RCRUDO]).toLowerCase()) < 0) return;
  aliasFuera.push({ fila: i + 2, crudo: t(r[NM_RCRUDO]), canon: t(r[NM_RCANON]) });
});
console.log('     B · Catalogo_Referencias: se van ' + aliasFuera.length + ' alias   ' +
  aliasFuera.map(function (x) { return x.crudo + '→' + x.canon + ' (f' + x.fila + ')'; }).join(' · '));

// C · las filas COMPARTIDAS: su lista se RECALCULA desde el catálogo, no se le resta
//
// 🔴 RESTAR ESTABA MAL, Y EL SECO LO ENSEÑÓ. La primera versión quitaba los 4 ids de cada lista.
//    Resultado: `Campana/Liga MX` se quedaba en 0 piezas y el alias `maggi-ligamx-agosto26` (que
//    usan los carritos de HOY) también. Liga MX tiene 8 piezas vivas — lo que pasaba es que esas
//    listas llevaban desactualizadas desde que nacieron 005-P005..P012 y nadie las repobló.
//    Restar sobre una lista ya vieja no la deja peor: la deja MINTIENDO, con un cero que parece
//    decir «este alias ya no lo usa nadie».
//    Así que se recalcula desde el catálogo tal como queda: la lista pasa a ser lo que de verdad
//    es. Eso retira los 4 ids Y repara el desfase de paso, y un cero a partir de aquí significa
//    lo que debe significar: que esa entrada del vocabulario se quedó sin dueño.
var vivos = P.filter(function (p) { return IDS.indexOf(t(p[nmP])) < 0; });
function recalcular(r) {
  var dim = t(r[NM_RDIM]).toLowerCase(), canon = t(r[NM_RCANON]), ctx = t(r[NM_RCTX]);
  var campoPieza = { campana: NM_CAMP, 'campaña': NM_CAMP, segmento: 'Segm' + 'ento', touchpoint: NM_TP, bu: 'BU', marca: 'Marca' }[dim];
  if (!campoPieza || !canon || TOK.test(canon)) return null;           // no sé mapearla: no la toco
  return vivos.filter(function (p) {
    if (t(p[campoPieza]).toLowerCase() !== canon.toLowerCase()) return false;
    // un alias CONTEXTUAL solo cuenta las piezas de su contexto
    if (ctx && !TOK.test(ctx) && !/^utm_/.test(ctx) && t(p[NM_CAMP]).toLowerCase() !== ctx.toLowerCase()) return false;
    return true;
  }).map(function (p) { return t(p[nmP]); });
}
var limpiar = [], huerfanas = [], noMapeadas = [];
REF.forEach(function (r, i) {
  var ids = t(r[NM_RIDS]); if (!ids) return;
  if (aliasFuera.some(function (a) { return a.fila === i + 2; })) return;     // ésas ya se van enteras
  var lista = ids.split(/[\s,;]+/).map(t).filter(Boolean);
  if (!lista.some(function (x) { return IDS.indexOf(x) >= 0; })) return;      // no las nombra: no se toca
  var nueva = recalcular(r);
  if (nueva === null) { noMapeadas.push({ fila: i + 2, dim: t(r[NM_RDIM]), canon: t(r[NM_RCANON]) }); return; }
  var x = { fila: i + 2, dim: t(r[NM_RDIM]), canon: t(r[NM_RCANON]), ctx: ctxDe(r), antes: lista, despues: nueva };
  limpiar.push(x);
  if (!nueva.length) huerfanas.push(x);
});
function ctxDe(r) { return t(r[NM_RCTX]); }
console.log('     C · filas compartidas con la lista RECALCULADA desde el catálogo: ' + limpiar.length);
limpiar.forEach(function (x) {
  var repara = x.despues.length > x.antes.length - IDS.filter(function (i2) { return x.antes.indexOf(i2) >= 0; }).length;
  console.log('          f' + String(x.fila).padStart(4) + '  ' + (x.dim + '/' + x.canon).slice(0, 30).padEnd(32) + ' ctx ' + (x.ctx || '—').padEnd(14) +
    x.antes.length + ' → ' + x.despues.length + ' pieza(s)' +
    (x.despues.length ? (repara ? '   ✔ además repara el desfase' : '') : '   ⚠ SIN dueño: ese valor del vocabulario ya no lo usa nadie'));
});
if (huerfanas.length) {
  console.log('     ⚠ ' + huerfanas.length + ' entrada(s) del vocabulario se quedan sin dueño. NO se borran aquí:');
  console.log('        retirar vocabulario es otra decisión y va en su propio paso, con su propia prueba.');
}
if (noMapeadas.length) {
  console.log('     🔴 ' + noMapeadas.length + ' fila(s) nombran una pieza retirada y NO sé recalcular su lista — se DECLARAN, no se tocan:');
  noMapeadas.forEach(function (x) { console.log('        f' + x.fila + '  ' + x.dim + '/' + x.canon); });
}

DECL.declarar('nestle-catalogo', 'catalogo.retirar-ep-ligamx.js', [
  { hoja: 'Catalogo_Piezas', grano: 'una FILA entera', llave: 'Pieza_ID', celdas_esperadas: IDS.length + ' filas retiradas' },
  { hoja: 'Catalogo_Referencias', grano: 'una FILA entera o una celda de lista', llave: 'Valor_Crudo + Contexto',
    celdas_esperadas: aliasFuera.length + ' alias retirados · ' + limpiar.length + ' listas depuradas' }
]);

if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA FOTO DE CONTROL, antes de tocar nada ════════════════════════════════════════
function foto(hoja, nmLlave) {
  var ws = wb.Sheets[hoja];
  var rng = XLSX.utils.decode_range(ws['!ref']);
  var enc = [];
  for (var c = rng.s.c; c <= rng.e.c; c++) { var e = ws[XLSX.utils.encode_cell({ r: 0, c: c }) ]; enc[c] = e ? t(e.v) : ''; }
  var out = {};
  var arr = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
  arr.forEach(function (f, i) {
    var k = nmLlave ? t(f[nmLlave]) : ('f' + (i + 2));
    if (!k) k = 'f' + (i + 2);
    out[k] = {}; enc.filter(Boolean).forEach(function (h) { out[k][h] = t(f[h]); });
  });
  return { filas: out, enc: enc, n: arr.length };
}
var fotoP = foto('Catalogo_Piezas', nmP);
console.log(NL + '  ── foto de control: ' + fotoP.n + ' piezas × ' + fotoP.enc.filter(Boolean).length + ' columnas');

var RESP = BACK + '/_respaldos/v8-antes-retirar-ep.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('  ── respaldo: ' + path.basename(RESP));

// ══ LA ESCRITURA ═══════════════════════════════════════════════════════════════════
var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
function parteDe(nombre) {
  var p = null;
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === nombre) p = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
  return p;
}
// 🔴 las filas de abajo se RENUMERAN, y sus celdas con ellas. Una fila r="127" que queda en la
//    posición 121 con celdas que dicen A127 es el paquete que Excel se niega a abrir.
function quitarFilas(hoja, numeros) {
  var parte = parteDe(hoja);
  if (!parte) { console.log('  🔴 no pude resolver la parte XML de ' + hoja); process.exit(1); }
  var xml = zip.readAsText(parte);
  var quitar = {}; numeros.forEach(function (n) { quitar[n] = 1; });
  var filas = [];
  xml.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, function (todo, nr, attrs, d) { filas.push({ n: +nr, attrs: attrs, d: d }); return todo; });
  var nuevo = 0;
  var cuerpo = filas.filter(function (f) { return !quitar[f.n]; }).map(function (f) {
    nuevo++;
    return '<row r="' + nuevo + '"' + String(f.attrs).replace(/ spans="[^"]*"/, '') + '>' +
      f.d.replace(/<c r="([A-Z]+)\d+"/g, function (_, LL) { return '<c r="' + LL + nuevo + '"'; }) + '</row>';
  }).join('');
  xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + cuerpo + '</sheetData>');
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2) { return '<dimension ref="' + c1 + r1 + ':' + c2 + nuevo + '"/>'; });
  zip.updateFile(parte, Buffer.from(xml, 'utf8'));
  console.log('     ✔ ' + hoja.padEnd(22) + filas.length + ' → ' + nuevo + ' filas, renumeradas');
  return nuevo;
}

console.log(NL + '  ── escritura');
// 🔴 PRIMERO las listas, DESPUÉS las filas: depurar una celda por su número de fila después de
//    haber borrado filas apuntaría a la fila equivocada.
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
if (limpiar.length) {
  var parteR = parteDe('Catalogo_Referencias');
  var xmlR = zip.readAsText(parteR);
  var wsR = wb.Sheets['Catalogo_Referencias'];
  var rngR = XLSX.utils.decode_range(wsR['!ref']);
  var encR = [];
  for (var cR = rngR.s.c; cR <= rngR.e.c; cR++) { var eR = wsR[XLSX.utils.encode_cell({ r: 0, c: cR })]; encR[cR] = eR ? t(eR.v) : ''; }
  function letra(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }
  var iIds = encR.indexOf(NM_RIDS), iN = encR.indexOf(NM_RN);
  limpiar.forEach(function (x) {
    if (iIds >= 0) {
      var ref = letra(iIds) + x.fila;
      xmlR = CX.poner(xmlR, ref, CX.celda(ref, x.despues.join(' '), CX.estiloDe(xmlR, ref)), x.fila).xml;
    }
    if (iN >= 0) {
      var ref2 = letra(iN) + x.fila;
      xmlR = CX.poner(xmlR, ref2, CX.celda(ref2, String(x.despues.length), CX.estiloDe(xmlR, ref2)), x.fila).xml;
    }
  });
  zip.updateFile(parteR, Buffer.from(xmlR, 'utf8'));
  console.log('     ✔ ' + limpiar.length + ' lista(s) de Pieza_IDs depuradas');
}
if (aliasFuera.length) quitarFilas('Catalogo_Referencias', aliasFuera.map(function (x) { return x.fila; }));
var filasP = [];
P.forEach(function (f, i) { if (IDS.indexOf(t(f[nmP])) >= 0) filasP.push(i + 2); });
quitarFilas('Catalogo_Piezas', filasP);
zip.writeZip(TMP);

// ══ LAS CAPAS Y LA VERIFICACIÓN ════════════════════════════════════════════════════
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split(NL).filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 54)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split(NL).pop().slice(0, 54)); return false; }
}
console.log(NL + '  ── las 5 capas');
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log(NL + '  🔴 paquete no sano: NO se publica.'); process.exit(1); }

var wb2 = XLSX.readFile(TMP);
var P2 = XLSX.utils.sheet_to_json(wb2.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var mal = [];
Object.keys(fotoP.filas).forEach(function (id) {
  if (IDS.indexOf(id) >= 0) return;
  if (!/^\d{3}-[JP]\d{3}$/.test(id)) return;
  var f2 = P2.filter(function (q) { return t(q[nmP]) === id; })[0];
  if (!f2) { mal.push(id + ': DESAPARECIÓ'); return; }
  var difs = Object.keys(fotoP.filas[id]).filter(function (h) { return t(f2[h]) !== fotoP.filas[id][h]; });
  if (difs.length) mal.push(id + ': cambiaron ' + difs.slice(0, 3).join(', '));
});
IDS.forEach(function (id) { if (P2.filter(function (q) { return t(q[nmP]) === id; }).length) mal.push(id + ': SIGUE en la hoja'); });
var REF2 = XLSX.utils.sheet_to_json(wb2.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
var aliasVivos = REF2.filter(function (r) {
  return /^alias$/i.test(t(r['Tipo'])) && /touchpoint/i.test(t(r[NM_RDIM])) &&
    t(r[NM_RCTX]) === CONTEXTO && ALIAS_CRUDOS.indexOf(t(r[NM_RCRUDO]).toLowerCase()) >= 0;
});
if (aliasVivos.length) mal.push(aliasVivos.length + ' alias e-p* @ Liga MX SIGUEN vivos');
var restos = REF2.filter(function (r) { return IDS.some(function (id) { return t(r[NM_RIDS]).indexOf(id) >= 0; }); });
if (restos.length) mal.push(restos.length + ' fila(s) de Referencias todavía nombran una pieza retirada');
// 🔴 y el vocabulario de OTRAS campañas tiene que seguir intacto
var epOtras = REF2.filter(function (r) { return /^E-P\d$/i.test(t(r[NM_RCANON])) && t(r[NM_RCTX]) !== CONTEXTO; }).length;

console.log(NL + '  ── verificación ANTES de publicar');
console.log('     Catalogo_Piezas:       ' + P.length + ' → ' + P2.length + '   (esperado −' + IDS.length + ')');
console.log('     Catalogo_Referencias:  ' + REF.length + ' → ' + REF2.length + '   (esperado −' + aliasFuera.length + ')');
console.log('     E-P* de otras campañas intactos: ' + epOtras + ' fila(s)');
console.log('     ' + (mal.length ? '🔴 ' + mal.length + ': ' + mal.slice(0, 5).join(' · ')
  : '✔ las ' + (P2.length) + ' piezas que se quedan dicen EXACTAMENTE lo mismo, celda por celda'));
if (mal.length) { console.log(NL + '  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log(NL + '  ✅ RETIRADAS ' + IDS.length + ' piezas y ' + aliasFuera.length + ' alias · el resto verificado celda por celda');
