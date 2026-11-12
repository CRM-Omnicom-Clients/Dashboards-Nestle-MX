/*
 * orquestador.huella-formato.js — la foto del FORMATO, para poder probar que una corrida no se lo
 * llevó. No escribe en el workbook: guarda o compara.
 *
 * 🔴 POR QUÉ EXISTE: «un numFmt perdido no cambia ningún valor, así que las puertas pasan en
 *    verde». Ya pasó: un escritor usó `XLSX.writeFile` y se llevó el formato de 56 columnas con
 *    las dos PUERTAS abiertas y todas las sumas cuadrando. `linea-base.js` cuida los DATOS —
 *    cuántos registros, cuántos con valor—; nadie cuidaba la FORMA.
 *
 * Qué mira, por hoja y por NOMBRE de encabezado (nunca por letra: las columnas se mueven):
 *    · el `numFmt` de la primera celda de datos de cada columna  ← el que se pierde en silencio
 *    · el estilo (`s`) del encabezado                            ← relleno y negrita viven ahí
 *    · el ancho de la columna                                    ← Rick los ajusta a mano
 *    · cuántas filas y cuántas columnas tiene la hoja
 *
 * 🔴 SE COMPARA POR NOMBRE DE ENCABEZADO, y una columna que DESAPARECE es un hallazgo, no un
 *    hueco: es justo el caso que se quiere atrapar.
 *
 *   node orquestador.huella-formato.js --guardar <etiqueta>
 *   node orquestador.huella-formato.js --comparar <etiqueta>
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var DIR = BACK + '/_preescritura/huellas-formato';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var iG = process.argv.indexOf('--guardar'), iC = process.argv.indexOf('--comparar');
var ETQ = iG > 0 ? process.argv[iG + 1] : (iC > 0 ? process.argv[iC + 1] : null);
if (!ETQ) { console.log('uso: --guardar <etiqueta>  |  --comparar <etiqueta>'); process.exit(1); }
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function huella() {
  var tmp = BACK + '/_tmp/_huella.xlsx';
  fs.copyFileSync(VIVO, tmp);
  var wb = XLSX.readFile(tmp, { cellStyles: true, cellNF: true });
  /* el numFmt real vive en styles.xml: `s` de la celda → xf → numFmtId → código.
     Sin resolverlo, comparar `s` a secas daría falsos positivos en cuanto se inserte un estilo. */
  var zip = new AdmZip(tmp);
  var st = zip.readAsText('xl/styles.xml') || '';
  var codigo = {};
  st.replace(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g, function (_, id, c) { codigo[id] = c; return _; });
  var xfs = [];
  var mCell = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
  if (mCell) mCell[1].replace(/<xf[^>]*numFmtId="(\d+)"[^>]*>/g, function (_, id) { xfs.push(id); return _; });
  /* 🔴 EN SheetJS EL FORMATO VIVE EN `c.z`, no en `c.s`. La primera versión leía `c.s` y devolvió
   *    «0 con numFmt propio» en LAS ONCE HOJAS — una huella que no registra nada demostraría para
   *    siempre que el formato nunca cambia. Se prueba abajo contra un conteo independiente. */
  function fmtDe(c) {
    if (!c) return '(sin celda)';
    if (c.z) return String(c.z);                                           // SheetJS: el numFmt
    var s = c.s;
    if (typeof s === 'object' && s && s.numFmt) return String(s.numFmt);
    var id = xfs[typeof s === 'number' ? s : 0];
    if (id === undefined) return 'xf?';
    return codigo[id] || ('builtin:' + id);
  }

  var H = { cuando: new Date().toISOString(), hojas: {} };
  wb.SheetNames.forEach(function (nom) {
    var ws = wb.Sheets[nom]; if (!ws || !ws['!ref']) return;
    var rng = XLSX.utils.decode_range(ws['!ref']);
    var cols = {};
    for (var c = rng.s.c; c <= rng.e.c; c++) {
      var he = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
      var nomCol = he ? t(he.v) : '';
      if (!nomCol) continue;
      /* la primera celda de datos CON valor: una vacía no tiene formato que comparar */
      var prim = null;
      for (var r = 1; r <= Math.min(rng.e.r, 40); r++) {
        var cc = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        if (cc && cc.v !== undefined && t(cc.v) !== '') { prim = cc; break; }
      }
      cols[nomCol] = {
        fmt: fmtDe(prim),
        tipo: prim ? prim.t : '-',
        enc_s: he.s !== undefined ? (typeof he.s === 'object' ? 'obj' : String(he.s)) : '-',
        ancho: (ws['!cols'] && ws['!cols'][c] && ws['!cols'][c].wch) ? Math.round(ws['!cols'][c].wch) : '-'
      };
    }
    H.hojas[nom] = { filas: rng.e.r, columnas: Object.keys(cols).length, cols: cols };
  });
  return H;
}

var H = huella();
var RUTA = DIR + '/' + ETQ + '.json';

if (iG > 0) {
  fs.writeFileSync(RUTA, JSON.stringify(H, null, 1), 'utf8');
  console.log('══ HUELLA DE FORMATO «' + ETQ + '» guardada ══');
  Object.keys(H.hojas).forEach(function (h) {
    var x = H.hojas[h];
    var conFmt = Object.keys(x.cols).filter(function (k) { return x.cols[k].fmt !== 'General' && x.cols[k].fmt !== '(sin celda)' && !/^builtin:0$/.test(x.cols[k].fmt); }).length;
    console.log('   ' + h.padEnd(24) + String(x.filas).padStart(5) + ' filas · ' + String(x.columnas).padStart(3) + ' cols · ' + String(conFmt).padStart(3) + ' con numFmt propio');
  });
  console.log('\n   → ' + path.relative(BACK, RUTA));
  process.exit(0);
}

// ── COMPARAR ────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(RUTA)) { console.log('🔴 no existe la huella «' + ETQ + '»'); process.exit(1); }
var A = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
console.log('══ FORMATO · «' + ETQ + '» (' + String(A.cuando).slice(0, 19).replace('T', ' ') + ')  vs  AHORA ══\n');

var hallazgos = [];
Object.keys(A.hojas).forEach(function (h) {
  var a = A.hojas[h], b = H.hojas[h];
  if (!b) { hallazgos.push({ g: 'hoja', d: h + ': LA HOJA YA NO ESTÁ' }); return; }
  var perdidas = Object.keys(a.cols).filter(function (k) { return !b.cols[k]; });
  var nuevas = Object.keys(b.cols).filter(function (k) { return !a.cols[k]; });
  var fmtCambio = [], anchoCambio = [], encCambio = [];
  Object.keys(a.cols).forEach(function (k) {
    if (!b.cols[k]) return;
    if (a.cols[k].fmt !== b.cols[k].fmt) fmtCambio.push(k + ': «' + a.cols[k].fmt + '» → «' + b.cols[k].fmt + '»');
    if (String(a.cols[k].ancho) !== String(b.cols[k].ancho)) anchoCambio.push(k + ': ' + a.cols[k].ancho + '→' + b.cols[k].ancho);
    if (a.cols[k].enc_s !== b.cols[k].enc_s) encCambio.push(k);
  });
  var lineas = [];
  if (a.filas !== b.filas) lineas.push('filas ' + a.filas + ' → ' + b.filas);
  if (perdidas.length) lineas.push('🔴 columnas PERDIDAS (' + perdidas.length + '): ' + perdidas.slice(0, 6).join(', '));
  if (nuevas.length) lineas.push('+ columnas nuevas (' + nuevas.length + '): ' + nuevas.slice(0, 6).join(', '));
  if (fmtCambio.length) lineas.push('🔴 numFmt cambiado (' + fmtCambio.length + '): ' + fmtCambio.slice(0, 4).join(' · '));
  if (anchoCambio.length) lineas.push('⚠ ancho cambiado (' + anchoCambio.length + '): ' + anchoCambio.slice(0, 4).join(' · '));
  if (encCambio.length) lineas.push('⚠ estilo de encabezado cambiado (' + encCambio.length + '): ' + encCambio.slice(0, 5).join(', '));
  if (perdidas.length || fmtCambio.length) hallazgos.push({ g: 'formato', d: h });
  console.log('  ' + (lineas.length ? (perdidas.length || fmtCambio.length ? '🔴 ' : '⚠ ') : '✔ ') + h.padEnd(24) + (lineas.length ? lineas.join('  ·  ') : 'sin cambios de forma'));
});
Object.keys(H.hojas).filter(function (h) { return !A.hojas[h]; }).forEach(function (h) {
  console.log('  + ' + h.padEnd(24) + 'HOJA NUEVA (' + H.hojas[h].columnas + ' columnas)');
});

console.log('');
if (!hallazgos.length) console.log('  ✅ EL FORMATO RESISTIÓ — ninguna columna perdida, ningún numFmt cambiado');
else { console.log('  🔴 ' + hallazgos.length + ' hoja(s) con formato alterado: ' + hallazgos.map(function (x) { return x.d; }).join(' · ')); process.exit(1); }
