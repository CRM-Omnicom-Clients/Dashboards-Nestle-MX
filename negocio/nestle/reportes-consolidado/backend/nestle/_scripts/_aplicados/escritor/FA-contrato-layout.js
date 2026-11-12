// FA-contrato-layout.js — A1+A3: congelar el layout de Report_Resumen que Rick editó a mano.
//
// 🔴 POR QUÉ EXISTE. Rick reacomodó y renombró columnas del reporte y agregó filas. Mi escritor
//    N6 construía su propia lista de columnas (`OUT`) y la imponía: habría movido `Content_ID` y
//    `Email_ID` al final —donde YO los puse— pisando su orden, y habría re-creado la columna
//    `Insights` que él quitó. Un escritor que decide la FORMA de la hoja destruye el trabajo del
//    humano cada vez que corre.
//
//    La regla que sale de aquí: **la hoja manda la forma; el sistema solo llena valores.**
//
// USO:  node FA-contrato-layout.js            → lee la hoja y escribe el contrato
//       node FA-contrato-layout.js --verificar → compara la hoja contra el contrato guardado
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var CONTRATO = BACK + '/_contratos/report-resumen-layout.json';
var VERIFICAR = process.argv.indexOf('--verificar') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_fa.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
var sh = wb.Sheets['Report_Resumen'];
var r = XLSX.utils.decode_range(sh['!ref']);
var COLS = [];
for (var c = r.s.c; c <= r.e.c; c++) {
  var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })];
  COLS.push(h ? t(h.v) : '');
}
var R = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });

console.log('════════ A1 · CONTRATO DE LAYOUT ════════\n');
console.log('  archivo: ' + vivo.archivo);
console.log('  hoja   : Report_Resumen · ' + R.length + ' filas · ' + COLS.filter(Boolean).length + ' columnas\n');

// ── A3 · qué filas produce la rejilla y cuáles son SOLO de Rick ────────────────────────────
// La llave de una fila del reporte es su combinación de dimensiones. Si la rejilla no produce
// esa combinación, la fila la puso Rick y el sistema NO puede tocarla.
var LLAVE = ['Campaña', 'Objetivo', 'TouchPoint', 'Segmento', 'Quincena_Lanzamiento'];
function llaveDe(x) { return LLAVE.map(function (k) { return t(x[k]); }).join('¦'); }
var deRick = [];
try {
  var rej = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
  var enRejilla = {};
  (rej.rejilla || []).forEach(function (c) {
    enRejilla[[c.campana, c.objetivo, c.touchpoint, c.segmento, c.quincena].join('¦')] = 1;
  });
  R.forEach(function (x, i) {
    if (!enRejilla[llaveDe(x)]) deRick.push({ fila: i + 2, llave: llaveDe(x) });
  });
  console.log('  ── A3 · filas que la rejilla NO produce (son de Rick, intocables)');
  console.log('     ' + deRick.length + ' de ' + R.length);
  deRick.slice(0, 12).forEach(function (x) { console.log('       fila ' + x.fila + '  ' + x.llave.replace(/¦/g, ' · ').slice(0, 88)); });
  if (deRick.length > 12) console.log('       … y ' + (deRick.length - 12) + ' más');
} catch (e) {
  console.log('  ⚠ no se pudo leer la rejilla: ' + e.message.slice(0, 70));
}

var contrato = {
  paso: 'A1', hoja: 'Report_Resumen', congelado: vivo.archivo,
  regla: 'LA HOJA MANDA LA FORMA. El escritor llena valores por NOMBRE de columna; nunca agrega, mueve, renombra ni reordena.',
  columnas: COLS,
  n_columnas: COLS.filter(Boolean).length,
  n_filas: R.length,
  llave_de_fila: LLAVE,
  filas_de_rick: deRick,
  columnas_que_el_sistema_NO_llena: COLS.filter(Boolean).filter(function (n) {
    // las que Rick agregó y el motor no conoce: se detectan al correr N6, aquí se dejan declaradas
    return /Tipo\s+Email|Mes \(#\)/.test(n);
  })
};

if (VERIFICAR) {
  if (!fs.existsSync(CONTRATO)) { console.log('\n  🔴 no hay contrato guardado'); process.exit(1); }
  var g = JSON.parse(fs.readFileSync(CONTRATO, 'utf8'));
  var difs = [];
  if (g.columnas.length !== COLS.length) difs.push('nº de columnas: ' + g.columnas.length + ' → ' + COLS.length);
  g.columnas.forEach(function (n, i) {
    if (COLS[i] !== n) difs.push('col ' + (i + 1) + ': «' + n + '» → «' + (COLS[i] || '(vacía)') + '»');
  });
  if (g.n_filas !== R.length) difs.push('nº de filas: ' + g.n_filas + ' → ' + R.length);
  console.log('\n  ── verificación contra el contrato');
  if (!difs.length) { console.log('     ✅ el layout es IDÉNTICO al congelado'); process.exit(0); }
  console.log('     🔴 ' + difs.length + ' diferencia(s):');
  difs.slice(0, 15).forEach(function (d) { console.log('        · ' + d); });
  process.exit(1);
}

try { fs.mkdirSync(BACK + '/_contratos'); } catch (e) { }
fs.writeFileSync(CONTRATO, JSON.stringify(contrato, null, 1));
console.log('\n  ── el contrato');
console.log('     columnas congeladas: ' + contrato.n_columnas);
console.log('     ' + COLS.filter(Boolean).slice(0, 14).join(' | '));
console.log('     … (' + (contrato.n_columnas - 14) + ' más)');
console.log('\n  ✅ contrato escrito → _contratos/report-resumen-layout.json');
console.log('     verificar en cualquier momento:  node FA-contrato-layout.js --verificar');
