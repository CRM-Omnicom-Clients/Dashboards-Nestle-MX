// nestle-catalogo · CORREGIR Y COMPLETAR Catalogo_Referencias.
//
// 🔴 POR QUÉ ESTO VA PRIMERO. Referencias es la AUTORIDAD que traduce lo que dice el doc de
//    Qcart a las dimensiones del catálogo. Un alias equivocado no se nota: resuelve, devuelve
//    algo, y ese algo entra al reporte como si fuera un dato. Los 191 carritos de marzo que
//    acabaron en el segmento de al lado salieron de UNA fila mal de esta hoja.
//
// 🔴 EL DEFECTO DE FONDO: un alias que INFIERE. `Email 1→E-P1`, `Email 2→E-P2`, `Email 3→E-P3`
//    dedujo el touchpoint del NÚMERO del correo. Pero el doc de marzo trae la audiencia en su
//    propia columna y dice: Email 1 = Traditional Parents · Email 2 = New Parents · Email 3 =
//    Career Focused. En AON esas audiencias son E-P1, **E-P3** y **E-P4**. El número del correo
//    y el número del touchpoint no son la misma cosa, y suponer que sí es inferir del naming.
//
// 🔴 NO SE BORRA NADA: los alias que cambian de valor conservan su fila y se les reescribe el
//    canónico con su motivo en Notas. Rick edita esta hoja a mano; una fila que desaparece se
//    lleva por delante un trabajo que nadie puede reconstruir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json` ANTES que la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var pl = function (v) { return t(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var FUENTE = 'Rick en chat, 27-ago-2026';

// ── LO QUE CAMBIA DE VALOR (la fila existe; se le reescribe el canónico) ─────────────
var CAMBIOS = [
  { dim: 'Touchpoint', crudo: 'Email 2', ctx: 'AON', de: 'E-P2', a: 'E-P3',
    porque: 'el doc de marzo declara Email 2 = New Parents, y en AON New Parents es E-P3. El alias deducía el touchpoint del NÚMERO del correo: por eso 58 carritos de New Parents acabaron en Dinkies (001-P011).' },
  { dim: 'Touchpoint', crudo: 'Email 3', ctx: 'AON', de: 'E-P3', a: 'E-P4',
    porque: 'el doc de marzo declara Email 3 = Career Focused, y en AON Career Focused es E-P4. Mismo defecto: 133 carritos de Career Focused acabaron en New Parents (001-P003).' },
  { dim: 'Segmento', crudo: 'FamilyFocused', ctx: null, de: 'FamilyKids', a: 'Traditional Parents',
    porque: 'Rick, 27-ago: «¿FamilyFocused de abril es Traditional Parents? Sí, queda en referencias». FamilyKids es un segmento de HOTCAKES; FamilyFocused solo aparece en AON abril, donde la audiencia es Traditional Parents. El alias cruzaba dos campañas.' }
];

// ── LO QUE FALTA (filas nuevas) ─────────────────────────────────────────────────────
var ALTAS = [
  { dim: 'Segmento', crudo: 'conregion', canonico: 'Usuarios CON región', ctx: 'utm_term',
    porque: 'Liga MX manda E-J4 y E-J5 a DOS audiencias diferenciadas y el doc las llama conregion/sinregion. Sin el alias, sus bloques no resolvían y 13 carritos se quedaban sin pieza.' },
  { dim: 'Segmento', crudo: 'sinregion', canonico: 'Usuarios sin región', ctx: 'utm_term',
    porque: 'la otra audiencia de Liga MX. Sin el alias, 108 carritos se quedaban sin pieza.' },
  { dim: 'Touchpoint', crudo: 'e-j4', canonico: 'E-J4', ctx: 'Liga MX',
    porque: 'el touchpoint del doc de agosto para Liga MX. No existía y por eso el bloque no resolvía.' },
  { dim: 'Touchpoint', crudo: 'e-j5', canonico: 'E-J5', ctx: 'Liga MX',
    porque: 'Rick, 27-ago: «Es J5 · son dos audiencias · no las confundas para qcart». El doc lo trae como e-j5.' }
];

DECL.declarar('nestle-catalogo', 'catalogo.corregir-referencias.js', [{
  hoja: 'Catalogo_Referencias',
  grano: 'una fila por REFERENCIA (alias · vocabulario · excluido)',
  llave: 'Dimension + Valor_Crudo + Contexto — un alias es contextual, no global',
  celdas_esperadas: CAMBIOS.length + ' canónicos reescritos · ' + ALTAS.length + ' filas nuevas'
}]);

console.log('════════ nestle-catalogo · CORREGIR REFERENCIAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_refs-fix.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var REF = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { header: 1, defval: '' })[0].map(t);
var colIdx = {}; enc.forEach(function (h, i) { if (h) colIdx[h] = i; });
var NM = {};
['Tipo', 'Dimension', 'Valor_Crudo', 'Valor_Canonico', 'Contexto', 'Fuente', 'Notas'].forEach(function (id) { NM[id] = COL.de(REF, id); });
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + REF.length + ' referencias · ' + enc.filter(Boolean).length + ' columnas\n');

// ── localizar cada cambio, y comprobar que el valor de PARTIDA es el que creo ────────
console.log('  ── los cambios de valor');
var plan = [], noEncontrados = [], yaEstaban = [];
CAMBIOS.forEach(function (c) {
  var hits = [];
  REF.forEach(function (r, i) {
    if (pl(r[NM.Dimension]) !== pl(c.dim) || pl(r[NM.Valor_Crudo]) !== pl(c.crudo)) return;
    if (c.ctx && pl(r[NM.Contexto]) !== pl(c.ctx)) return;
    hits.push({ fila: i + 2, r: r });
  });
  if (!hits.length) { noEncontrados.push(c); console.log('     🔴 «' + c.crudo + '» (' + c.dim + ') NO está en la hoja'); return; }
  if (hits.length > 1) { noEncontrados.push(c); console.log('     🔴 «' + c.crudo + '» aparece ' + hits.length + ' veces — no elijo por mi cuenta'); return; }
  var actual = t(hits[0].r[NM.Valor_Canonico]);
  // 🔴 se comprueba el valor DE PARTIDA: si ya no es el que creo, alguien lo cambió y
  //    sobrescribirlo a ciegas borraría su decisión.
  if (pl(actual) === pl(c.a)) { yaEstaban.push(c); console.log('     ✔ «' + c.crudo + '» ya dice «' + c.a + '»'); return; }
  if (pl(actual) !== pl(c.de)) {
    noEncontrados.push(c);
    console.log('     🔴 «' + c.crudo + '» dice «' + actual + '», yo esperaba «' + c.de + '» — alguien lo cambió, NO lo piso');
    return;
  }
  plan.push({ fila: hits[0].fila, c: c });
  console.log('     🔧 «' + c.crudo + '» (' + c.dim + (c.ctx ? ' · ' + c.ctx : '') + ')   «' + c.de + '» → «' + c.a + '»   fila ' + hits[0].fila);
  console.log('          ' + c.porque);
});

console.log('\n  ── las filas nuevas');
var altas = [];
ALTAS.forEach(function (a) {
  var ya = REF.some(function (r) {
    return pl(r[NM.Dimension]) === pl(a.dim) && pl(r[NM.Valor_Crudo]) === pl(a.crudo) &&
      (!a.ctx || pl(r[NM.Contexto]) === pl(a.ctx));
  });
  if (ya) { console.log('     ✔ «' + a.crudo + '» (' + a.dim + ') ya existe'); return; }
  altas.push(a);
  console.log('     🆕 «' + a.crudo + '» (' + a.dim + ' · ' + a.ctx + ') → «' + a.canonico + '»');
  console.log('          ' + a.porque);
});

console.log('\n  ── resumen: ' + plan.length + ' cambio(s) · ' + altas.length + ' alta(s) · ' +
  yaEstaban.length + ' ya estaban · ' + noEncontrados.length + ' sin aplicar');
if (noEncontrados.length) console.log('     🔴 sin aplicar: ' + noEncontrados.map(function (c) { return c.crudo; }).join(' · '));
if (!plan.length && !altas.length) { console.log('\n  ✅ no hay nada que hacer.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-referencias.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="Catalogo_Referencias"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);
console.log('     parte: ' + parte);

// 1 · los canónicos que cambian, y su nota
plan.forEach(function (x) {
  var iC = colIdx[NM.Valor_Canonico], iN = colIdx[NM.Notas];
  var ref = col(iC) + x.fila;
  xml = CX.poner(xml, ref, CX.celda(ref, x.c.a, CX.estiloDe(xml, ref)), x.fila).xml;
  if (iN !== undefined) {
    var rn = col(iN) + x.fila;
    var nota = 'Corregido 27-ago-2026 (era «' + x.c.de + '»). ' + x.c.porque;
    xml = CX.poner(xml, rn, CX.celda(rn, nota, CX.estiloDe(xml, rn)), x.fila).xml;
  }
});

// 2 · las filas nuevas, al final y en ORDEN DE COLUMNA
// 🔴 LA FILA SIGUIENTE SE BUSCA, NO SE CALCULA — mismo caso que en el alta de piezas:
//    `length + 1` asume filas pegadas desde la 2, y una nota a mano debajo de los datos rompe
//    esa cuenta. Se busca la última con `Valor_Crudo` y se comprueba que el destino esté vacío.
var ultimaConRef = 1;
REF.forEach(function (r, i) { if (t(r[NM.Valor_Crudo])) ultimaConRef = Math.max(ultimaConRef, i + 2); });
var crudasRef = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { header: 1, defval: '' });
var ocupadasRef = [];
for (var kk = 0; kk < altas.length; kk++) {
  var nf = ultimaConRef + 1 + kk;
  if ((crudasRef[nf - 1] || []).some(function (v) { return t(v) !== ''; })) ocupadasRef.push(nf);
}
if (ocupadasRef.length) {
  console.log('\n  🔴 las filas destino NO están vacías: ' + ocupadasRef.join(' · ') + '. NO se escribe encima.');
  process.exit(1);
}
var filaBase = ultimaConRef;
var filasXml = altas.map(function (a, k) {
  var nFila = filaBase + 1 + k;
  var vals = {};
  vals[NM.Tipo] = 'alias'; vals[NM.Dimension] = a.dim; vals[NM.Valor_Crudo] = a.crudo;
  vals[NM.Valor_Canonico] = a.canonico; vals[NM.Contexto] = a.ctx;
  if (colIdx[NM.Fuente] !== undefined) vals[NM.Fuente] = FUENTE;
  vals[NM.Notas] = 'Alta 27-ago-2026. ' + a.porque;
  // 🔴 en ORDEN DE COLUMNA: con el orden de inserción Excel se niega a abrir el libro.
  var celdas = Object.keys(vals).filter(function (c) { return colIdx[c] !== undefined && t(vals[c]) !== ''; })
    .sort(function (x, y) { return colIdx[x] - colIdx[y]; })
    .map(function (c) { var ci = colIdx[c], ref = col(ci) + nFila; return CX.celda(ref, vals[c], CX.estiloDe(xml, col(ci) + '2')); }).join('');
  return '<row r="' + nFila + '">' + celdas + '</row>';
}).join('');
if (altas.length) {
  xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
    return '<dimension ref="' + c1 + r1 + ':' + c2 + (filaBase + altas.length) + '"/>';
  });
}
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + plan.length + ' canónico(s) reescritos · ' + altas.length + ' fila(s) nuevas');

// ══ LAS CINCO CAPAS (R7) ════════════════════════════════════════════════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(r).split('\n').filter(function (x) { return t(x); }).pop() || 'ok').slice(0, 72));
    return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 72)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER Y COMPARAR POR NOMBRE (E4) ═══════════════════════════════════════════════
console.log('\n  ── releído del disco');
var R2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
console.log('     referencias: ' + REF.length + ' → ' + R2.length);
var fallos = 0;
plan.forEach(function (x) {
  var f = R2[x.fila - 2];
  var ok = f && pl(f[NM.Valor_Canonico]) === pl(x.c.a);
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + '«' + x.c.crudo + '» → «' + (f ? t(f[NM.Valor_Canonico]) : '?') + '»');
  if (!ok) fallos++;
});
altas.forEach(function (a) {
  var ok = R2.some(function (r) { return pl(r[NM.Valor_Crudo]) === pl(a.crudo) && pl(r[NM.Valor_Canonico]) === pl(a.canonico); });
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + '«' + a.crudo + '» → «' + a.canonico + '»');
  if (!ok) fallos++;
});
console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' no quedaron' : '✅ REFERENCIAS CORREGIDAS, verificadas contra el disco'));
process.exit(fallos ? 1 : 0);
