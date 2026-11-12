/*
 * catalogo.limpiar-variantes-usurpadas.js — un nombre PRINCIPAL de una pieza no puede ser VARIANTE
 * de otra. Mide siempre; escribe solo los casos inequívocos.
 *
 * 🔴 EL DEFECTO, MEDIDO (24-sep-2026). Rick: «no puede haber métricas por definir cuando ya tienes
 *    la información (Proplan, etc), ni atribución de clicks por definir porque ya tienes las piezas».
 *    Tenía razón, y la causa no era que faltara el dato: los links de Pro Plan SÍ están en
 *    `CRM_Email_Links`. Lo que fallaba era el CRUCE.
 *
 *    `lib-canonico.indexarPiezas` indexa `Email_Name` **y** `Email_Names_Variantes`. Y
 *    `009-P002/P003/P004` listaban como variante suya el nombre que es el PRINCIPAL de
 *    `009-P006..P011`. Dos piezas reclamando el mismo nombre → el índice devuelve `¦AMBIGUO¦` →
 *    `motor.links.js` se cae al ConfigKey provisional (`009-TMP-PP-E3-P`) → el desglose de clicks
 *    de esas filas sale `POR DEFINIR`. 45 links de 6 piezas, fuera del reporte.
 *
 * 🔴 LA REGLA ES GENERAL, LA ESCRITURA NO. Hay 16 casos en el catálogo y son DOS familias:
 *
 *      UNIDIRECCIONAL (6, Pro Plan) — A reclama el nombre de B, y B no reclama el de A.
 *          Hay un dueño claro: el principal manda. Se limpia.
 *
 *      RECÍPROCO (10, AON) — A reclama el de B y B reclama el de A. Son los pares
 *          `001-P001↔P023`, `P002↔P028`, `P003↔P024`, `P004↔P026`, más `P005→P025` y `P006→P027`:
 *          mismo touchpoint, mismo segmento, envíos distintos. Es la familia de GEMELAS que ya
 *          está abierta como **decisión D1 de Rick**, con 4,085 referencias vivas.
 *          🔴 NO SE TOCAN. Limpiar un lado de un par recíproco elige por él cuál es la buena, y
 *          esa elección no es mía. Se declaran y se dejan igual.
 *
 *   node catalogo.limpiar-variantes-usurpadas.js              seco
 *   node catalogo.limpiar-variantes-usurpadas.js --escribir    escribe + las 5 capas
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var CN = require(BACK + '/_scripts/lib-canonico.js');
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var DECL = require(BACK + '/_scripts/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var HOJA = 'Catalogo_Piezas';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
function colLetra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
/* el MISMO separador que usa `lib-canonico`: si partiera distinto, vería variantes que el índice no ve */
function SEP(v) { return String(v == null ? '' : v).split(/\s*[·|;]\s*|[\r\n]+/).map(t).filter(Boolean); }

var PARES = [
  { principal: 'Email_Name', variantes: 'Email_Names_Variantes' },
  { principal: 'Whatsapp_Name', variantes: 'Whatsapp_Names_Variantes' }
];

console.log('════ nestle-catalogo · VARIANTES QUE USURPAN UN NOMBRE PRINCIPAL ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

var tmp = BACK + '/_tmp/_variantes.xlsx';
fs.copyFileSync(VIVO, tmp);
var wb = XLSX.readFile(tmp);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
var C = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nID = COL.de(C, 'Pieza_ID', 'catalogo');
var iID = enc.indexOf(nID);

/* la fila se busca por su id en la hoja, nunca índice+2: el catálogo no es contiguo */
var filaDe = {};
for (var r0 = 1; r0 <= rng.e.r; r0++) {
  var cc = ws[XLSX.utils.encode_cell({ r: r0, c: iID })];
  if (cc && t(cc.v)) filaDe[t(cc.v)] = r0 + 1;
}

var casos = [];
PARES.forEach(function (par) {
  if (enc.indexOf(par.principal) < 0 || enc.indexOf(par.variantes) < 0) return;
  var dueno = {};
  C.forEach(function (p) {
    var n = t(p[par.principal]);
    if (n && !TOKEN.test(n)) dueno[CN.nm(n)] = t(p[nID]);
  });
  C.forEach(function (p) {
    var id = t(p[nID]); if (!id) return;
    SEP(p[par.variantes]).forEach(function (v) {
      var d = dueno[CN.nm(v)];
      if (d && d !== id) casos.push({ ladron: id, dueno: d, nombre: v, col: par.variantes, principalDe: par.principal });
    });
  });
});

/* 🔴 EL CRITERIO NO ES «RECÍPROCO» — ESO SE ME QUEDÓ CORTO Y CASI TOCO UNA DECISIÓN DE RICK.
 *    La primera versión separaba por reciprocidad y dejaba `001-P005`/`001-P006` del lado
 *    «limpiable». Pero ésas son justo las gemelas de D1: SFMC las publica bajo el MISMO EmailName
 *    que `001-P025`/`001-P027`, y hay 66,204 envíos en disputa esperando la palabra de Rick.
 *    Que la usurpación sea de un solo lado no la hace mía de arreglar.
 *
 *    El criterio que sí separa: **¿comparten TouchPoint y Segmento?** Si dos piezas son del mismo
 *    touchpoint y el mismo segmento, cuál de las dos es la dueña del nombre es una decisión de
 *    NEGOCIO —son la misma audiencia del mismo envío— y no se resuelve mecánicamente.
 *    Si difieren, hay un dueño claro: Pro Plan `009-P003` es «Pet Parents» y `009-P006` es
 *    «Pet Parents · Perros» — el nombre con `Perros` es de la segunda, y eso no lo decide nadie. */
var nTP = COL.de(C, 'TouchPoint', 'catalogo'), nSEG = COL.de(C, 'Segmento', 'catalogo');
var pieza = {};
C.forEach(function (p) { pieza[t(p[nID])] = p; });
function mismaAudiencia(a, b) {
  var pa = pieza[a], pb = pieza[b];
  if (!pa || !pb) return true;                       // si no puedo compararlas, NO se tocan
  return CN.nm(t(pa[nTP])) === CN.nm(t(pb[nTP])) && CN.nm(t(pa[nSEG])) === CN.nm(t(pb[nSEG]));
}
casos.forEach(function (x) { x.decision_de_negocio = mismaAudiencia(x.ladron, x.dueno); });

var uni = casos.filter(function (x) { return !x.decision_de_negocio; });
var rec = casos.filter(function (x) { return x.decision_de_negocio; });

console.log('  casos totales: ' + casos.length + '   ·   unidireccionales: ' + uni.length + '   ·   recíprocos: ' + rec.length + '\n');
console.log('  ── UNIDIRECCIONALES · se limpian (hay dueño claro)');
uni.forEach(function (x) { console.log('     ' + x.ladron + ' suelta «…' + x.nombre.slice(-34) + '» → es el principal de ' + x.dueno); });
console.log('\n  ── RECÍPROCOS · NO se tocan (decisión D1 de Rick, las gemelas)');
var pares = {};
rec.forEach(function (x) { pares[[x.ladron, x.dueno].sort().join(' ↔ ')] = 1; });
Object.keys(pares).sort().forEach(function (k) { console.log('     ' + k); });

if (!uni.length) { console.log('\n  ✔ nada unidireccional que limpiar.'); process.exit(0); }

/* qué queda en cada celda tras soltar los nombres usurpados */
var porCelda = {};
uni.forEach(function (x) {
  var k = x.ladron + '¦' + x.col;
  if (!porCelda[k]) {
    var fila = C.filter(function (p) { return t(p[nID]) === x.ladron; })[0];
    porCelda[k] = { id: x.ladron, col: x.col, antes: t(fila[x.col]), quitar: [], fila: filaDe[x.ladron] };
  }
  porCelda[k].quitar.push(x.nombre);
});
var APLICAR = [];
console.log('\n  ── qué queda en cada celda');
Object.keys(porCelda).forEach(function (k) {
  var x = porCelda[k];
  var quedan = SEP(x.antes).filter(function (v) {
    return !x.quitar.some(function (q) { return CN.nm(q) === CN.nm(v); });
  });
  /* 🔴 si la celda se quedara vacía, NO se escribe '' — la columna admite `N/A` y un vacío se lee
   *    como «no medido». Y si no admitiera N/A, mejor dejarla como está y declararlo. */
  var nuevo = quedan.length ? quedan.join(' · ') : 'N/A';
  console.log('     ' + x.id + '.' + x.col + '  f' + x.fila);
  console.log('        antes:  ' + (x.antes.length > 96 ? x.antes.slice(0, 96) + '…' : x.antes));
  console.log('        queda:  ' + nuevo + '    (suelta ' + x.quitar.length + ')');
  if (!x.fila) { console.log('        🔴 no encontré su fila en la hoja'); return; }
  APLICAR.push({ id: x.id, col: x.col, fila: x.fila, valor: nuevo });
});

DECL.declarar('nestle-catalogo', 'catalogo.limpiar-variantes-usurpadas.js', [{
  hoja: HOJA, grano: 'una PIEZA (una fila)', llave: 'Pieza_ID',
  celdas_esperadas: APLICAR.length + ' celda(s) de variantes; ninguna otra columna se toca'
}]);

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ ESCRITURA ════════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-variantes-usurpadas.xlsx';
fs.copyFileSync(VIVO, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(tmp);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mSheet = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mRel = mSheet ? new RegExp('Id="' + mSheet[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mRel ? 'xl/' + mRel[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

var COMO = {};
APLICAR.forEach(function (a) {
  var ref = colLetra(enc.indexOf(a.col)) + a.fila;
  var r = CX.poner(xml, ref, CX.celda(ref, a.valor, CX.estiloDe(xml, ref)), a.fila);
  xml = r.xml; COMO[r.como] = (COMO[r.como] || 0) + 1;
  console.log('     ' + ref + ' (' + a.id + '.' + a.col + ') → ' + r.como);
});
/* `sin fila` = no se escribió NADA y el script no truena: se comprueba el `como`, no la ausencia de error */
if (COMO['sin fila']) { console.log('\n  🔴 ' + COMO['sin fila'] + ' celda(s) no se escribieron. NO se publica.'); process.exit(1); }
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(tmp);

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
[['xlsx-safe-save', 'node', [T + 'xlsx-safe-save.js', tmp]], ['xlsx-label', 'node', [T + 'xlsx-label.js', tmp]],
 ['xlsx-check', 'node', [T + 'xlsx-check.js', tmp]], ['xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', tmp]],
 ['xlsx-orden-celdas', 'node', [T + 'xlsx-orden-celdas.js', tmp]]].forEach(function (c) {
  try {
    var o = cp.execFileSync(c[1] === 'node' ? process.execPath : c[1], c[2], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('     ✔ ' + c[0].padEnd(22) + String(o).split('\n').filter(Boolean).pop().slice(0, 62));
  } catch (e) { console.log('     🔴 ' + c[0] + ' — ' + String(e.message).slice(0, 100)); process.exit(1); }
});

fs.copyFileSync(tmp, VIVO);
console.log('     → publicado a ' + path.basename(VIVO));

// ── E4 · releer del disco y comprobar que el índice YA RESUELVE ──────────────────────
var C2 = XLSX.utils.sheet_to_json(XLSX.readFile(VIVO).Sheets[HOJA], { defval: '', blankrows: false });
var IX2 = CN.indexarPiezas(C2);
var nID2 = COL.de(C2, 'Pieza_ID', 'catalogo');
var duenos = {};
uni.forEach(function (x) { duenos[x.nombre] = x.dueno; });
var mal = [];
Object.keys(duenos).forEach(function (nom) {
  var hit = IX2.porContent[CN.nm(nom)];
  var got = hit === '¦AMBIGUO¦' ? 'AMBIGUO' : (hit ? t(hit[nID2]) : 'no encontrado');
  if (got !== duenos[nom]) mal.push(nom.slice(-30) + ': ' + got + ' ≠ ' + duenos[nom]);
});
console.log('\n  ── verificación (releído del disco)');
console.log('     filas: ' + C.length + ' → ' + C2.length + (C.length === C2.length ? '  ✔' : '  🔴 CAMBIÓ'));
if (mal.length) { console.log('     🔴 ' + mal.length + ' nombre(s) siguen sin resolver: ' + mal.slice(0, 4).join(' · ')); process.exit(1); }
console.log('     ✔ los ' + Object.keys(duenos).length + ' nombres resuelven ahora a SU pieza, ninguno AMBIGUO');
console.log('\n  ✅ LISTO. Sigue: la cadena desde `motor-clicks` para que los links crucen.');
