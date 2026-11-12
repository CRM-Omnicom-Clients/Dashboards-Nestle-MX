// FASE E · UNA ESCRITURA. Aplica la tabla que la medición ya decidió, y no decide nada por su cuenta.
//
// 🔴 POR QUÉ ESTE SCRIPT NO PIENSA. La decisión de qué va en cada celda vacía es del SKILL DUEÑO de
//    esa columna, y ya está tomada en `_preescritura/decisiones.json`. Aquí solo se transcribe.
//    Separarlo así es lo que permite revisar ANTES de tocar el Excel — que es el orden que Rick
//    pidió después de una sesión entera de escribir para averiguar: medir todo, decidir todo,
//    escribir una vez.
//
// 🔴 SI LA TABLA NO CUADRA CON LA HOJA, NO SE ESCRIBE. La hoja pudo cambiar entre la medición y
//    ahora —Rick edita a mano, y hoy mismo se retiraron columnas—. Antes de tocar nada se comprueba
//    que cada celda que la tabla manda llenar SIGA vacía. Si alguna ya tiene dato, esa se salta y
//    se reporta: escribir encima de un dato que apareció después es exactamente cómo se pierde el
//    trabajo de alguien.
//
// 🔴 Y NO ESCRIBE `POR DEFINIR` A CIEGAS. Rick pidió que lo que aplica y no tenemos quede visible.
//    Se escribe el token en la celda **y** viaja a la lista — el archivo y la lista dicen lo mismo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'escritor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function letra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var TABLA = BACK + '/_preescritura/decisiones.json';
if (!fs.existsSync(TABLA)) { console.log('🔴 no está la tabla. Corre primero: node orquestador.medir-vacios.js'); process.exit(1); }
var D = JSON.parse(fs.readFileSync(TABLA, 'utf8'));

console.log('════════ FASE E · UNA ESCRITURA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = require('path').resolve(__dirname, '..') + '/_tmp/_vacios.xlsx';
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   tabla medida el ' + D.medido + '\n');

// ── construir el plan de celdas desde la tabla, comprobando contra la hoja de AHORA
var plan = [], ocupadas = [], sinColumna = [], sinHoja = [];
Object.keys(D.hojas).forEach(function (hoja) {
  var h = D.hojas[hoja];
  if (h.intocable) { console.log('  🔒 ' + hoja.padEnd(24) + 'intocable — ' + h.razon); return; }
  // 🔴 D6 · la medición declara a qué hojas se les escribe. Fuera del catálogo el vacío se
  //    permite (Rick, 26-ago), y este script transcribe la decisión — no la re-discute.
  //    Sin esto, el llenado volvería a poner un token en las 10 columnas retiradas en D5.
  if (h.se_llena === false) { console.log('  ·  ' + hoja.padEnd(24) + 'se mide, no se escribe — ' + h.razon_no_llenar); return; }
  var ws = wb.Sheets[hoja];
  if (!ws) { sinHoja.push(hoja); return; }
  var R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  var enc = (R[0] || []).map(t);
  var nNA = 0, nCero = 0, nPD = 0;

  function poner(col, filas, valor, clase) {
    var i = enc.indexOf(col);
    if (i < 0) { sinColumna.push(hoja + ' → «' + col + '»'); return 0; }
    var n = 0;
    filas.forEach(function (f) {
      // 🔴 solo si SIGUE vacía. Si apareció un dato después de medir, manda el dato.
      var actual = (R[f - 1] || [])[i];
      // 🔴 LA ÚNICA EXCEPCIÓN, Y ES ESTRECHA A PROPÓSITO (15-sep-2026): una celda que dice
      //    «POR DEFINIR» puede pasar a «N/A», porque eso no pisa un dato — cierra un hueco que
      //    el skill dueño ya sabe explicar. Nace de las 6 celdas de `Aud_Filtros`/`Aud_Final` que
      //    quedaron debiéndose por una regla equivocada; corregida la regla, sin esta excepción
      //    seguirían rojas para siempre porque el barrido solo mira celdas vacías.
      //    Las tres condiciones juntas son la garantía: el valor actual es un token de estado
      //    (no un dato), el valor nuevo es exactamente `N/A`, y nunca al revés.
      var deEstadoAna = /^(POR DEFINIR|PENDIENTE)$/i.test(t(actual)) && t(valor).toUpperCase() === 'N/A';
      if (t(actual) !== '' && !deEstadoAna) { ocupadas.push(hoja + '!' + letra(i) + f + ' = «' + t(actual) + '»'); return; }
      plan.push({ hoja: hoja, ref: letra(i) + f, fila: f, valor: valor, clase: clase, col: col });
      n++;
    });
    return n;
  }

  Object.keys(h.na || {}).forEach(function (col) { nNA += poner(col, h.na[col].filas, 'N/A', 'na'); });
  Object.keys(h.cero || {}).forEach(function (col) { nCero += poner(col, h.cero[col], 0, 'cero'); });
  Object.keys(h.por_definir || {}).forEach(function (col) { nPD += poner(col, h.por_definir[col], 'POR DEFINIR', 'pd'); });

  console.log('  ' + hoja.padEnd(24) + String(nNA).padStart(5) + ' N/A   ' + String(nCero).padStart(4) + ' cero   ' + String(nPD).padStart(5) + ' POR DEFINIR');
});

console.log('\n  celdas a escribir: ' + plan.length);
if (ocupadas.length) {
  console.log('  ⚠ ' + ocupadas.length + ' celda(s) ya tienen dato desde que se midió — se SALTAN, no se pisan:');
  ocupadas.slice(0, 6).forEach(function (o) { console.log('       ' + o); });
}
if (sinColumna.length) console.log('  ⚠ ' + sinColumna.length + ' columna(s) de la tabla ya no están en la hoja: ' + sinColumna.slice(0, 4).join(' · '));
if (sinHoja.length) console.log('  ⚠ hoja(s) de la tabla que ya no existen: ' + sinHoja.join(' · '));

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
if (!plan.length) { console.log('\n  ✔ no queda ninguna celda vacía que llenar'); process.exit(0); }

try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); } catch (e) { console.log('\n  🔴 el libro está TOMADO (' + e.code + ') — OneDrive revertiría la escritura'); process.exit(2); }

// ── escribir, hoja por hoja, celda por celda
var zip = new AdmZip(copia);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

var porHoja = {}, comos = {};
plan.forEach(function (p) { (porHoja[p.hoja] = porHoja[p.hoja] || []).push(p); });
Object.keys(porHoja).forEach(function (h) {
  var xml = zip.readAsText(parteDe[h]);
  porHoja[h].forEach(function (p) {
    var est = CX.estiloDe(xml, p.ref);
    var r = CX.poner(xml, p.ref, CX.celda(p.ref, p.valor, est), p.fila);
    xml = r.xml; comos[r.como] = (comos[r.como] || 0) + 1;
  });
  zip.updateFile(parteDe[h], Buffer.from(xml, 'utf8'));
});
zip.writeZip(copia);
console.log('  caminos: ' + Object.keys(comos).map(function (k) { return k + ' ' + comos[k]; }).join(' · '));
if (comos['sin fila']) { console.log('  🔴 ' + comos['sin fila'] + ' celda(s) sin fila donde caer — NO se publica'); process.exit(1); }

// ── las CINCO capas
var NODE = process.execPath, PY = require(__dirname + '/lib-entorno.js').PYTHON;
var falla = null;
[[NODE, 'xlsx-safe-save.js'], [NODE, 'xlsx-label.js'], [NODE, 'xlsx-check.js'], [PY, 'xlsx-validar-fondo.py'], [NODE, 'xlsx-orden-celdas.js']].forEach(function (c) {
  if (falla) return;
  var r = cp.spawnSync(c[0], [require(__dirname + '/lib-entorno.js').TOOLS + '/' + c[1], copia], { encoding: 'utf8' });
  if (r.status !== 0) falla = c[1] + ': ' + ((r.stdout || '') + (r.stderr || '')).slice(-300);
  console.log('   ' + (r.status === 0 ? '✔' : '🔴') + ' ' + c[1]);
});
if (falla) { console.log('\n🔴 NO SE PUBLICA — ' + falla); process.exit(1); }

fs.copyFileSync(copia, vivo.ruta);
console.log('\n  📤 publicado · ' + plan.length + ' celdas');

// ── releer del DISCO: ni una celda quedó vacía de las que se mandaron llenar
var wb2 = XLSX.readFile(vivo.ruta);
var malas = 0, revisadas = 0;
Object.keys(porHoja).forEach(function (h) {
  var ws = wb2.Sheets[h];
  porHoja[h].forEach(function (p) {
    revisadas++;
    var c = ws[p.ref];
    if (!c || t(c.v) !== t(p.valor)) { malas++; if (malas <= 5) console.log('   🔴 ' + h + '!' + p.ref + ' dice «' + (c ? t(c.v) : '(vacía)') + '», debía «' + p.valor + '»'); }
  });
});
console.log('   ' + (malas === 0 ? '✔' : '🔴') + ' releído del disco: ' + (revisadas - malas) + ' de ' + revisadas + ' celdas dicen lo que se escribió');

// ── y la lista de POR DEFINIR, para Rick
var pd = plan.filter(function (p) { return p.clase === 'pd'; });
var porCol = {};
pd.forEach(function (p) { var k = p.hoja + ' · ' + p.col; (porCol[k] = porCol[k] || []).push(p.fila); });
fs.writeFileSync(BACK + '/_preescritura/por-definir.json', JSON.stringify({
  que_es: 'Lo que APLICA y no tenemos. Cada celda dice POR DEFINIR en el archivo y aparece aquí.',
  total: pd.length, por_columna: porCol
}, null, 1));
console.log('   → _preescritura/por-definir.json   ·   ' + pd.length + ' celdas en ' + Object.keys(porCol).length + ' columnas');
process.exit(malas ? 1 : 0);
