/*
 * escritor.retirar-hojas.js — RETIRAR UNA HOJA DEL WORKBOOK, ENTERA Y SIN DEJAR RASTRO ROTO.
 *
 * Rick, 22-sep-2026: «las hojas de Data_Clicks etc. no deberían existir, yo nunca autoricé esa
 * hoja… todo debe estar dentro de lo que el sistema ya sabe de sus hojas principales, fuentes,
 * datos».
 *
 * 🔴 QUITAR UNA HOJA NO ES QUITAR SU XML. Un .xlsx la nombra en CUATRO sitios, y dejar uno suelto
 *    hace que Excel se niegue a abrir el libro o lo «repare» perdiendo cosas:
 *      1. `xl/worksheets/sheetN.xml`      — la hoja
 *      2. `xl/workbook.xml` → `<sheets>`  — su entrada y su r:id
 *      3. `xl/_rels/workbook.xml.rels`    — la relación que apunta al archivo
 *      4. `[Content_Types].xml`           — el Override con su tipo
 *
 * 🔴 Y ANTES DE QUITARLA, SE COMPRUEBA QUE NADIE LA CITE. Si una fórmula de otra hoja la
 *    referencia, retirarla deja un `#REF!` — y la suma que dependía de ella queda rota en
 *    silencio. Si hay citas, este script NO borra: las nombra y se detiene.
 *
 * 🔴 NO BORRA POR NOMBRE QUE YO ELIJA: exige que la hoja NO esté declarada en `esquema.json`.
 *    El esquema es el registro de qué hojas existen; si una está declarada, retirarla es una
 *    decisión de modelo, no una limpieza, y no se hace desde aquí.
 *
 *   node escritor.retirar-hojas.js Data_Clicks Dic_Clicks              (seco)
 *   node escritor.retirar-hojas.js Data_Clicks Dic_Clicks --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var HOJAS = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
var t = function (v) { return String(v == null ? '' : v).trim(); };
if (!HOJAS.length) { console.log('uso: node escritor.retirar-hojas.js <hoja> [hoja...] [--escribir]'); process.exit(2); }

console.log('════════ RETIRAR HOJAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  a retirar: ' + HOJAS.join(' · ') + '\n');

// ── 0 · ninguna puede estar declarada en el esquema ─────────────────────────────────
var E = JSON.parse(fs.readFileSync(BACK + '/_contratos/esquema.json', 'utf8'));
var declaradas = HOJAS.filter(function (h) { return E.hojas && E.hojas[h]; });
if (declaradas.length) {
  console.log('🔴 estas hojas SÍ están declaradas en el esquema: ' + declaradas.join(', '));
  console.log('   Retirar una hoja declarada es una decisión de modelo, no una limpieza. No borro.');
  process.exit(1);
}
console.log('  ✔ ninguna está declarada en el esquema — por eso sobran\n');

var tmp = BACK + '/_tmp/_retirar.xlsx';
fs.copyFileSync(VIVO, tmp);
var wb = XLSX.readFile(tmp);
var faltan = HOJAS.filter(function (h) { return wb.SheetNames.indexOf(h) < 0; });
if (faltan.length) { console.log('  ⊘ ya no están en el libro: ' + faltan.join(', ')); }
var reales = HOJAS.filter(function (h) { return wb.SheetNames.indexOf(h) >= 0; });
if (!reales.length) { console.log('\n  ✅ nada que hacer.'); process.exit(0); }

// ── 1 · ¿alguna fórmula las cita? ───────────────────────────────────────────────────
console.log('  ── ¿alguien las cita en una fórmula?');
var citas = [];
wb.SheetNames.forEach(function (n) {
  if (reales.indexOf(n) >= 0) return;
  var ws = wb.Sheets[n]; if (!ws || !ws['!ref']) return;
  Object.keys(ws).forEach(function (ref) {
    if (ref[0] === '!') return;
    var f = ws[ref] && ws[ref].f; if (!f) return;
    reales.forEach(function (h) {
      if (String(f).indexOf(h) >= 0) citas.push({ hoja: n, celda: ref, formula: String(f).slice(0, 70), cita: h });
    });
  });
});
if (citas.length) {
  console.log('     🔴 ' + citas.length + ' fórmula(s) las citan — retirarlas dejaría #REF!:');
  citas.slice(0, 10).forEach(function (c) { console.log('        ' + c.hoja + '!' + c.celda + '  cita «' + c.cita + '»  → ' + c.formula); });
  console.log('     No borro nada.');
  process.exit(1);
}
console.log('     ✔ ninguna fórmula las cita\n');

reales.forEach(function (h) {
  var n = XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '' }).length;
  console.log('  ' + h.padEnd(18) + n + ' filas → se retira');
});
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ── 2 · quitarla de los CUATRO sitios ───────────────────────────────────────────────
try { fs.closeSync(fs.openSync(VIVO, 'r+')); }
catch (e) { console.log('\n🔴 el libro está BLOQUEADO (' + e.code + '). Ciérralo en Excel.'); process.exit(1); }

var zip = new AdmZip(VIVO);
var wbx = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
var rels = zip.getEntry('xl/_rels/workbook.xml.rels').getData().toString('utf8');
var ct = zip.getEntry('[Content_Types].xml').getData().toString('utf8');

reales.forEach(function (h) {
  var mSh = new RegExp('<sheet[^>]*name="' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*\\/>').exec(wbx);
  if (!mSh) { console.log('  🔴 no encuentro «' + h + '» en workbook.xml'); process.exit(1); }
  var rid = /r:id="([^"]+)"/.exec(mSh[0])[1];
  var mRel = new RegExp('<Relationship[^>]*Id="' + rid + '"[^>]*\\/>').exec(rels);
  var target = /Target="([^"]+)"/.exec(mRel[0])[1].replace(/^\/?xl\//, '');
  var parte = 'xl/' + target;

  wbx = wbx.replace(mSh[0], '');
  rels = rels.replace(mRel[0], '');
  ct = ct.replace(new RegExp('<Override[^>]*PartName="/' + parte.replace(/\//g, '\\/') + '"[^>]*\\/>'), '');
  zip.deleteFile(parte);
  console.log('  ✔ «' + h + '» fuera de las 4 partes   (era ' + parte + ', ' + rid + ')');
});

zip.updateFile('xl/workbook.xml', Buffer.from(wbx, 'utf8'));
zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
zip.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
/* 🔴 EL calcChain SE VA POR LOS TRES SITIOS, NO POR DOS.
 *    Guarda a qué hoja pertenece cada fórmula POR ÍNDICE, así que al quitar una hoja los índices
 *    se corren y Excel repara el libro. Hay que borrarlo — pero mi primera versión borró la parte
 *    y el Override y **dejó su RELACIÓN** en `xl/_rels/workbook.xml.rels`. `xlsx-safe-save` se negó
 *    a escribir («rel apunta a parte inexistente») y `xlsx-check` avisó de 1 relación huérfana:
 *    las capas hicieron exactamente su trabajo. Una parte del OPC vive en tres registros y quitar
 *    dos de tres deja el paquete roto igual que quitar cero. */
if (zip.getEntry('xl/calcChain.xml')) {
  zip.deleteFile('xl/calcChain.xml');
  ct = ct.replace(/<Override[^>]*calcChain\.xml"[^>]*\/>/, '');
  rels = rels.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, '')
    .replace(/<Relationship[^>]*Target="\/xl\/calcChain\.xml"[^>]*\/>/, '');
  zip.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
  zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
  console.log('  ✔ calcChain.xml retirado de sus TRES registros (parte · Override · relación)');
}
zip.writeZip(VIVO);
console.log('\n  ✔ escrito. Ahora las 5 capas.\n');

var T = require(__dirname + '/lib-entorno.js').TOOLS, NODE = T + '/node/node.exe';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var fallo = 0;
[[NODE, [T + '/xlsx-safe-save.js', VIVO]], [NODE, [T + '/xlsx-label.js', VIVO]], [NODE, [T + '/xlsx-check.js', VIVO]],
[PY, [T + '/xlsx-validar-fondo.py', VIVO]], [NODE, [T + '/xlsx-orden-celdas.js', VIVO]]].forEach(function (cc) {
  var nom = String(cc[1][0]).split('/').pop();
  try {
    var out = cp.execFileSync(cc[0], cc[1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('  ✔ ' + nom.padEnd(24) + out.trim().split('\n').slice(-1).join(' ').slice(0, 110));
  } catch (e) { fallo++; console.log('  🔴 ' + nom.padEnd(24) + String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 240)); }
});
console.log('\n' + (fallo ? '  🔴 ' + fallo + ' capa(s) fallaron' : '  ✅ las 5 capas en verde'));
