// G2 · REASIGNAR (no borrar) la fila de WhatsApp mal etiquetada.
//
// 🔴 RICK: «bórralo si está duplicado». Al verificar, NO es duplicado: son DOS envíos —Partido 2
//    (004-P010) y Partido 3 (004-P013)— con opens/clicks distintos en la fuente (94/17 vs 101/26)
//    y utm distintos (…1 vs …3). Borrar uno perdería 162 envíos reales del Partido 2. Lo correcto
//    es reasignar la fila que quedó mal cargada a lo que dice la fuente (el bloque ya la separó
//    bien; el reporte ya cuenta 14,643 correctos). Esto solo alinea la HOJA con esa verdad.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ G2 · reasignar 004-P013/WA-P2 → 004-P010/Partido 2 ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('G2');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var W = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { header: 1 })[0].map(t);

// la fila mal etiquetada: pieza_id 004-P013 con touchpoint WA-P2 (la de Partido 2)
var fila = -1;
W.forEach(function (r, i) { if (t(r['pieza_id']) === '004-P013' && t(r['Touchpoint']) === 'WA-P2') fila = i + 2; });
if (fila < 0) { console.log('  ⚠ no encontré la fila (¿ya corregida?)'); process.exit(0); }

// lo que dice la fuente para 004-P010 (Partido 2)
var CAMBIOS = {
  'pieza_id': '004-P010',
  'Touchpoint': 'Partido 2',
  'Opens_Read': 94,          // era 101 (de Partido 3)
  'Clicks': 17,              // era 26 (de Partido 3)
  'Objetivo': 'Purchase',    // 004-P010 es Purchase; la fila decía «Ver receta»
  'utm_content': 'wa-cooking1\nwa-bebida1\nwa-botana1'
};
// Read_Rate 94/125=0.752 y CTOR 17/94=0.181 YA están bien en la fila: no se tocan.

console.log('  fila ' + fila + ' de Data_WhatsApp:');
Object.keys(CAMBIOS).forEach(function (c) {
  if (enc.indexOf(c) < 0) { console.log('     ⚠ la hoja no tiene «' + c + '» — se omite'); return; }
  var antes = t(W[fila - 2][c]);
  console.log('     ' + c.padEnd(18) + '«' + antes.slice(0, 24).replace(/\n/g, '|') + '» → «' + String(CAMBIOS[c]).slice(0, 24).replace(/\n/g, '|') + '»');
});

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
Object.keys(CAMBIOS).forEach(function (c) {
  if (enc.indexOf(c) < 0) return;
  CB.apuntar('G2', 'Data_WhatsApp', fila, c, CAMBIOS[c],
    'G2 · la fila estaba mal etiquetada como 004-P013 (Partido 3); es 004-P010 (Partido 2). NO es duplicado: la fuente los tiene como envíos distintos. Se reasigna, no se borra, para no perder 162 envíos reales.');
});
var res = CB.resumen();
console.log('\n  ── apuntadas ' + Object.keys(CAMBIOS).filter(function (c) { return enc.indexOf(c) >= 0; }).length + ' celda(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
