// G1 · LOS SEGMENTOS QUE DICTÓ RICK (21-ago) para las piezas que estaban «(por definir)».
//
//   · ICE / The Freshers  → «Gen Z Cafés»
//   · Hackea tu café      → «Premium Cafés»
//
// 🔴 SOLO A LAS QUE ESTABAN SIN SEGMENTO. Las piezas E-A1 de ICE ya traen «Gen Z Indulgentes» y
//    las E-Hack de Hackea ya traen «Premium»: esas NO se tocan aquí, se reportan para que Rick
//    decida si también las unifica (dijo «todas»). Cambiar un segmento que él puso a mano sin
//    preguntar es justo lo que la regla de oro prohíbe.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// pieza → segmento que dictó Rick (solo las que estaban vacías)
var DICTADO = {
  '006-P004': 'Gen Z Cafés', '006-P005': 'Gen Z Cafés',
  '007-P005': 'Premium Cafés', '007-P006': 'Premium Cafés', '007-P007': 'Premium Cafés'
};

console.log('════════ G1 · SEGMENTOS ICE / HACKEA ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('G1');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0].map(t);
var colSeg = enc.indexOf('Segmento');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

var apunta = 0, yaTenian = [];
P.forEach(function (p, i) {
  var id = t(p['Pieza_ID']); if (!DICTADO[id]) return;
  var fila = i + 2, actual = t(p['Segmento']);
  if (actual) { yaTenian.push(id + ' ya tenía «' + actual + '»'); return; }   // no se pisa
  console.log('   ' + id.padEnd(10) + t(p['Campaña']).padEnd(16) + t(p['Touchpoint']).padEnd(8) + '→ Segmento «' + DICTADO[id] + '»');
  if (ESCRIBIR) CB.apuntar('G1', 'Catalogo_Piezas', fila, 'Segmento', DICTADO[id],
    'G1 · segmento dictado por Rick (21-ago): ' + (/^006/.test(id) ? 'ICE/The Freshers = Gen Z Cafés' : 'Hackea tu café = Premium Cafés') + '. Estaba «(por definir)» en SFMC.');
  apunta++;
});
if (yaTenian.length) { console.log('\n  ⚠ NO se tocan (ya tenían segmento): ' + yaTenian.join(' · ')); }

// las piezas de las dos campañas que YA tienen otro segmento — para que Rick decida sobre «todas»
console.log('\n  ── para tu revisión (las que YA traen segmento, por si «todas» las unifica):');
P.filter(function (p) { return /^00[67]-/.test(t(p['Pieza_ID'])) && t(p['Segmento']) && !DICTADO[t(p['Pieza_ID'])]; })
  .forEach(function (p) { console.log('     ' + t(p['Pieza_ID']).padEnd(10) + t(p['Campaña']).padEnd(16) + t(p['Touchpoint']).padEnd(8) + '«' + t(p['Segmento']) + '»'); });

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
var res = CB.resumen();
console.log('\n  ── apuntadas ' + apunta + ' celda(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
