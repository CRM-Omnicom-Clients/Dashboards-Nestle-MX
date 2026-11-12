// B2 · GUARDIÁN PERMANENTE DE DUPLICADOS — con las llaves declaradas, y probado inyectando uno.
//
// 🔴 UN GUARDIÁN QUE NUNCA SE PROBÓ NO SIRVE. Este corre dos veces: sobre el archivo real (¿hay
//    duplicados hoy?) y sobre una copia en memoria donde YO clono una fila a propósito (¿los
//    detecta?). Si no atrapa el que inyecté, el guardián está roto y no puede dar fe de nada.
//
//    Las llaves viven en `_contratos/llaves-por-hoja.json`, no aquí: son la autoridad, y otros
//    pasos (B1, el orquestador) leen la misma. Duplicar la llave en dos lugares es cómo divergen.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var LLAVES = JSON.parse(fs.readFileSync(BACK + '/_contratos/llaves-por-hoja.json', 'utf8')).hojas;

// detecta duplicados en un arreglo de filas, con la llave dada. Devuelve los grupos repetidos.
function duplicados(filas, cols, enc) {
  var faltan = cols.filter(function (c) { return enc.map(t).indexOf(c) < 0; });
  if (faltan.length) return { error: 'faltan columnas: ' + faltan.join(', ') };
  var g = {};
  filas.forEach(function (r, i) {
    var esTot = /total/i.test(t(r[enc[0]])) && cols.every(function (c) { return !t(r[c]); });
    if (esTot) return;
    var k = cols.map(function (c) { return t(r[c]); }).join('¦');
    if (!k.replace(/¦/g, '')) return;
    (g[k] = g[k] || []).push(i + 2);
  });
  return { grupos: Object.keys(g).filter(function (k) { return g[k].length > 1; }).map(function (k) { return { llave: k, filas: g[k] }; }) };
}

console.log('════════ B2 · GUARDIÁN DE DUPLICADOS ════════\n');
var F0 = os.homedir() + '/_b2.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

// ── 1 · el archivo real
console.log('══ sobre el archivo real ══');
var bloquea = 0, avisa = 0;
Object.keys(LLAVES).forEach(function (hoja) {
  var sh = wb.Sheets[hoja]; if (!sh) { console.log('   ⊘ ' + hoja); return; }
  var def = LLAVES[hoja];
  var enc = XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || [];
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  var r = duplicados(F, def.cols, enc);
  if (r.error) { console.log('   ⚠ ' + hoja.padEnd(22) + r.error); return; }
  var n = r.grupos.length;
  var estado = n === 0 ? '✔' : (def.reescrita ? '⚠ AVISA' : '🔴 BLOQUEA');
  console.log('   ' + estado.padEnd(9) + hoja.padEnd(22) + '[' + def.cols.join('+') + ']   duplicados: ' + n +
    (n && def.reescrita ? '  (se reescribe desde el backend)' : ''));
  if (n) { if (def.reescrita) avisa += n; else bloquea += n; }
});

// ── 2 · la prueba: clono una fila y compruebo que el guardián la ve
console.log('\n══ prueba de inyección (clono una fila de Catalogo_Piezas) ══');
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var F = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var antes = duplicados(F, ['Pieza_ID'], enc).grupos.length;
var conClon = F.concat([F[0]]);   // una fila idéntica a la primera
var despues = duplicados(conClon, ['Pieza_ID'], enc).grupos.length;
var pasa = antes === 0 && despues === 1;
console.log('   sin clon: ' + antes + ' duplicados   ·   con clon: ' + despues + '   → ' + (pasa ? '✔ el guardián lo atrapa' : '🔴 NO lo atrapa'));

console.log('\n════════ ' + (bloquea ? '🔴 ' + bloquea + ' DUPLICADO(S) QUE BLOQUEAN' :
  (pasa ? '✅ sin duplicados que bloqueen · guardián probado' : '🔴 el guardián no pasó su prueba')) +
  (avisa ? ' · ' + avisa + ' aviso(s) (hojas que se reescriben)' : '') + ' ════════');
process.exit(bloquea || !pasa ? 1 : 0);
