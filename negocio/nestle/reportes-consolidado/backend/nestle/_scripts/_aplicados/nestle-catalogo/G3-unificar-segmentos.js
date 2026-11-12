// G3 · UNIFICAR los segmentos de ICE/Hackea (Rick: «obvio que sí», 21-ago).
//
//   ICE / The Freshers  · E-A1  «Gen Z Indulgentes» → «Gen Z Cafés»
//   Hackea tu café      · E-Hack «Premium»          → «Premium Cafés»
//
// 🔴 esto SÍ pisa un valor que ya estaba: por eso se hace solo porque Rick lo confirmó explícito.
//    El WhatsApp opt-in de ICE (006-P003, «Wa-opt-in») NO se toca: es el segmento técnico de la
//    lista de opt-in, no un segmento de marketing — se reporta aparte.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// campaña → { de: segmento viejo, a: segmento nuevo } · solo para las piezas de EMAIL
var REGLA = {
  'The Freshers': { de: ['Gen Z Indulgentes'], a: 'Gen Z Cafés' },
  'Hackea tu café': { de: ['Premium'], a: 'Premium Cafés' }
};

console.log('════════ G3 · UNIFICAR SEGMENTOS ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('G3');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

var apunta = 0, waOptIn = [];
P.forEach(function (p, i) {
  var camp = t(p['Campaña']), seg = t(p['Segmento']), canal = t(p['Canal']), id = t(p['Pieza_ID']), fila = i + 2;
  var r = REGLA[camp]; if (!r) return;
  if (/whats/i.test(canal)) { if (seg) waOptIn.push(id + ' (' + canal + ') «' + seg + '»'); return; }  // WhatsApp no
  if (r.de.indexOf(seg) < 0) return;   // solo las que tienen el segmento viejo exacto
  console.log('   ' + id.padEnd(10) + camp.padEnd(16) + t(p['Touchpoint']).padEnd(9) + '«' + seg + '» → «' + r.a + '»');
  if (ESCRIBIR) CB.apuntar('G3', 'Catalogo_Piezas', fila, 'Segmento', r.a,
    'G3 · Rick unificó (21-ago): ' + camp + ' = ' + r.a + '. Antes «' + seg + '».');
  apunta++;
});
if (waOptIn.length) console.log('\n  ⚠ NO se toca (WhatsApp opt-in, segmento técnico): ' + waOptIn.join(' · '));

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
var res = CB.resumen();
console.log('\n  ── apuntadas ' + apunta + ' celda(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
