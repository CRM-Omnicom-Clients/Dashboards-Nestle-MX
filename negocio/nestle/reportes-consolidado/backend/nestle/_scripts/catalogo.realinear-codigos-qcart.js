// nestle-catalogo · REALINEAR LOS CÓDIGOS DE QCART CON EL DOC. Aplica lo que midió `alinear-doc-piezas`.
//
// 🔴 LA REGLA (Rick, 27-ago-2026): el bloque del doc —MES × campaña × touchpoint × AUDIENCIA con
//    sus shortlinks— ES una pieza, y esa pieza se identifica por su `Email_Name`. Únicamente
//    envío Principal, nunca FUPs. Así que los códigos de una pieza son, exactamente, los de sus
//    bloques del doc: ni uno más, ni uno menos.
//
// 🔴 SOLO SE TOCAN LAS PIEZAS QUE CAMBIAN. Reconstruir las 135 «por si acaso» sería reescribir
//    encima de decisiones que ya estaban bien, y Rick pidió no romper lo atribuido. Se calcula
//    el conjunto correcto de cada pieza, se compara con el que tiene, y solo se escribe la
//    diferencia — con la lista de qué entra y qué sale, ANTES de tocar el Excel.
//
// 🔴 EL CASO QUE LO ORIGINA: `Catalogo_Referencias` traducía «Email 2»→E-P2 y «Email 3»→E-P3,
//    deduciendo el touchpoint del NÚMERO del correo. El doc de marzo dice, en su columna de
//    audiencia, que Email 2 fue a New Parents (E-P3) y Email 3 a Career Focused (E-P4). Los
//    códigos quedaron corridos una posición y 191 carritos se reportaron en el segmento de al
//    lado — con la suma cuadrando, que es por lo que ninguna puerta lo veía.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json` ANTES que la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var M = require(__dirname + '/lib-maestro-links.js');
var Q = require(__dirname + '/lib-qcart-links.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

DECL.declarar('nestle-catalogo', 'catalogo.realinear-codigos-qcart.js', [{
  hoja: 'Catalogo_Piezas',
  grano: 'el BLOQUE DE RECETAS de una pieza (Receta_N · Cod_Walmart_N · Cod_Chedraui_N · Codigos_Qcart · N_Recetas · Tiene_Qcart)',
  llave: 'Pieza_ID — y el conjunto correcto sale de los bloques del doc que mapean a esa pieza',
  celdas_esperadas: 'solo las piezas cuyo conjunto de códigos difiere del que dicta el doc'
}]);

console.log('════════ nestle-catalogo · REALINEAR CÓDIGOS DE QCART ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var PLAN = JSON.parse(fs.readFileSync(BACK + '/_preescritura/PRE-alinear-doc-piezas.json', 'utf8'));
if (!PLAN.mover || !PLAN.mover.length) { console.log('  ✅ el plan no trae movimientos. Nada que hacer.'); process.exit(0); }

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_realinear.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var colIdx = {}; enc.forEach(function (h, i) { if (h) colIdx[h] = i; });
var NM = {};
['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Email_Name'].forEach(function (id) { NM[id] = COL.de(CAT, id); });
var filaDe = {}, pieza = {};
CAT.forEach(function (p, i) { var id = t(p[NM.Pieza_ID]); if (id) { filaDe[id] = i + 2; pieza[id] = p; } });
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + CAT.length + ' piezas\n');

// ── el conjunto CORRECTO de cada pieza, desde los bloques del doc que le mapean ──────
// se re-corre el mapeo para tener también las piezas que NO mueven (y así saber qué sale)
var idx = M.cargar();
var filaPorCodigo = {};
idx.filas.forEach(function (f) { filaPorCodigo[f.codigo] = f; });

var debeTener = {};                       // pieza → [{codigo, receta, retailer}]
PLAN.mover.forEach(function (m) {
  m.codigos.forEach(function (c) {
    var f = filaPorCodigo[c.codigo] || {};
    (debeTener[m.pieza_destino] = debeTener[m.pieza_destino] || []).push({
      codigo: c.codigo, receta: t(f.receta), retailer: t(f.retailer), mes: t(f.hoja), carritos: c.carritos
    });
  });
});

// ── lo que cada pieza tiene HOY
// 🔴 UN TOKEN DE ESTADO NO ES UN CÓDIGO. `Q.codigosDe` devuelve lo que haya en la celda, y ahí
//    puede haber `PENDIENTE`, `POR DEFINIR` o `N/A` — los tres estados de celda del sistema. Sin
//    esta guarda el check de «ningún código en dos piezas» se ponía rojo señalando 17 piezas que
//    lo único que comparten es la palabra «PENDIENTE». Un check que confunde un estado con un
//    dato no mide: hace ruido, y el ruido enseña a ignorar el rojo.
var ESTADO = /^(PENDIENTE|POR DEFINIR|N\/A|NA|-)$/i;
function codigosDe(p) {
  var out = [];
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { if (!ESTADO.test(t(c))) out.push(c); });
  });
  return out;
}

// las piezas afectadas: las de destino y las que pierden algún código
var afectadas = {};
Object.keys(debeTener).forEach(function (p) { afectadas[p] = 1; });
PLAN.mover.forEach(function (m) { m.codigos.forEach(function (c) { (c.hoy_en || []).forEach(function (p) { afectadas[p] = 1; }); }); });

// el conjunto final de cada afectada = (lo que tiene) − (lo que se va) + (lo que llega)
var seVan = {};
PLAN.mover.forEach(function (m) {
  m.codigos.forEach(function (c) {
    (c.hoy_en || []).forEach(function (p) { if (p !== m.pieza_destino) (seVan[p] = seVan[p] || []).push(c.codigo); });
  });
});

console.log('  ── el diff, pieza por pieza (ANTES de tocar el Excel)\n');
var cambios = [];
Object.keys(afectadas).sort().forEach(function (pid) {
  var p = pieza[pid];
  if (!p) { console.log('     🔴 ' + pid + ' no está en el catálogo'); return; }
  var hoy = codigosDe(p);
  var fuera = (seVan[pid] || []);
  var entran = (debeTener[pid] || []).map(function (x) { return x.codigo; });
  var final = hoy.filter(function (c) { return fuera.indexOf(c) < 0; });
  entran.forEach(function (c) { if (final.indexOf(c) < 0) final.push(c); });
  var igual = hoy.length === final.length && hoy.every(function (c) { return final.indexOf(c) >= 0; });
  console.log('     ' + pid + '  ' + t(p[NM.TouchPoint]).padEnd(8) + t(p[NM.Segmento]).slice(0, 24).padEnd(25) +
    (igual ? '✔ sin cambio' : ''));
  if (igual) return;
  console.log('          hoy:   ' + (hoy.join(', ') || '(ninguno)'));
  if (fuera.length) console.log('          SALEN: ' + fuera.join(', '));
  if (entran.filter(function (c) { return hoy.indexOf(c) < 0; }).length)
    console.log('          ENTRAN:' + entran.filter(function (c) { return hoy.indexOf(c) < 0; }).join(', '));
  console.log('          queda: ' + (final.join(', ') || '(ninguno)'));
  cambios.push({ pid: pid, fila: filaDe[pid], final: final, hoy: hoy, fuera: fuera });
});

if (!cambios.length) { console.log('\n  ✅ ninguna pieza cambia.'); process.exit(0); }

// ── la receta de cada código, para reescribir el bloque completo
function recetaDe(c) { var f = filaPorCodigo[c]; return f ? t(f.receta) : ''; }
function esChedraui(c) { var f = filaPorCodigo[c]; return f && /chedraui/i.test(t(f.retailer)); }

console.log('\n  ── el bloque de recetas que va a quedar\n');
cambios.forEach(function (x) {
  console.log('     ' + x.pid + '   N_Recetas=' + x.final.length);
  x.final.forEach(function (c, k) {
    console.log('        Receta_' + (k + 1) + ' = «' + (recetaDe(c) || 'POR DEFINIR') + '»   ' +
      (esChedraui(c) ? 'Cod_Chedraui_' : 'Cod_Walmart_') + (k + 1) + ' = ' + c);
  });
});

fs.writeFileSync(BACK + '/_preescritura/PRE-realinear-codigos.json', JSON.stringify({
  paso: 'catalogo.realinear-codigos-qcart', cuando: '2026-08-27',
  regla: 'los códigos de una pieza son exactamente los de sus bloques del doc',
  cambios: cambios.map(function (x) {
    return { pieza: x.pid, hoy: x.hoy, salen: x.fuera, queda: x.final,
      recetas: x.final.map(function (c) { return { codigo: c, receta: recetaDe(c), chedraui: esChedraui(c) }; }) };
  })
}, null, 1));
console.log('\n  → _preescritura/PRE-realinear-codigos.json');
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-realinear.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="Catalogo_Piezas"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);
console.log('     parte: ' + parte);

var nCeldas = 0;
cambios.forEach(function (x) {
  var vals = {};
  // 🔴 el bloque de 1..5 se reescribe ENTERO: las posiciones que dejan de usarse van a `N/A`,
  //    no se quedan con el código viejo. Un residuo ahí vuelve a atribuir mañana.
  for (var i = 1; i <= 5; i++) {
    var c = x.final[i - 1];
    vals['Receta_' + i] = c ? (recetaDe(c) || 'POR DEFINIR') : 'N/A';
    vals['Cod_Walmart_' + i] = c && !esChedraui(c) ? c : 'N/A';
    vals['Cod_Chedraui_' + i] = c && esChedraui(c) ? c : 'N/A';
  }
  vals['Codigos_Qcart'] = x.final.length ? x.final.join(', ') : 'N/A';
  vals['N_Recetas'] = String(x.final.length);
  vals['Tiene_Qcart'] = x.final.length ? 'Sí' : 'No';
  Object.keys(vals).forEach(function (cN) {
    var ci = colIdx[cN]; if (ci === undefined) return;
    var ref = col(ci) + x.fila;
    xml = CX.poner(xml, ref, CX.celda(ref, vals[cN], CX.estiloDe(xml, ref)), x.fila).xml;
    nCeldas++;
  });
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + cambios.length + ' pieza(s) · ' + nCeldas + ' celda(s)');

// ══ LAS CINCO CAPAS (R7) ════════════════════════════════════════════════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(r).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 72));
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

// ══ RELEER Y COMPARAR (E4) ══════════════════════════════════════════════════════════
console.log('\n  ── releído del disco');
var C2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nm2 = COL.de(C2, 'Pieza_ID');
var fallos = 0;
cambios.forEach(function (x) {
  var p = C2.filter(function (r) { return t(r[nm2]) === x.pid; })[0];
  if (!p) { console.log('     🔴 ' + x.pid + ' desapareció'); fallos++; return; }
  var ahora = codigosDe(p);
  var ok = ahora.length === x.final.length && x.final.every(function (c) { return ahora.indexOf(c) >= 0; });
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + x.pid + '   ' + (ahora.join(', ') || '(ninguno)'));
  if (!ok) fallos++;
});
// 🔴 y que NINGÚN código quede en dos piezas: era el defecto de 005-P002.
var dobles = {};
C2.forEach(function (p) { codigosDe(p).forEach(function (c) { (dobles[c] = dobles[c] || []).push(t(p[nm2])); }); });
var rep = Object.keys(dobles).filter(function (c) { return dobles[c].length > 1; });
console.log('     ' + (rep.length ? '🔴 código en 2+ piezas: ' + rep.map(function (c) { return c + '(' + dobles[c].join(',') + ')'; }).join(' · ')
  : '✔ ningún código cuelga de dos piezas'));
if (rep.length) fallos++;
console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' problema(s)' : '✅ CÓDIGOS REALINEADOS, verificados contra el disco'));
process.exit(fallos ? 1 : 0);
