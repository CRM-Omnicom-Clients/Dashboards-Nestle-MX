// whatsapp-bloque · ¿SIRVE PARA LOS SCRIPTS SIGUIENTES? — la prueba que no es circular.
//
//   motor-calculo · motor   → 🔴 ¿puede derivar las 4 tasas que whatsapp-bloque dejó de calcular?
//                    Y sobre todo: ¿sabe distinguir el CTOR real del que no se puede calcular?
//   N3 · puerta  → ¿puede escribir Data_WhatsApp con lo que el bloque trae?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ whatsapp-bloque · SIMULACIÓN DE LOS SCRIPTS SIGUIENTES ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));

// ══ motor-calculo · EL MOTOR ═══════════════════════════════════════════════════════════════════
console.log('══ motor-calculo · ¿puede derivar las 4 tasas que el bloque ya no trae? ══');
var conDatos = B.envios.filter(function (e) { return e.sends && e.deliveries !== null; });
var tasas = conDatos.map(function (e) {
  return {
    hoja: e.hoja, seg: e.segmento_raw,
    delivery: e.deliveries / e.sends,
    read: e.opens_read !== null && e.deliveries ? e.opens_read / e.deliveries : null,
    // 🔴 el CTOR solo existe si los clicks son MEDIDOS. Si no, no es null por falta de datos:
    //    es que la pregunta no se puede responder con esta fuente.
    ctor: (e.clicks !== null && e.opens_read) ? e.clicks / e.opens_read : null,
    ctor_imposible: e.clicks_medidos === 'No',
    error: e.errores !== null && e.sends ? e.errores / e.sends : null
  };
});
console.log('  envíos con datos suficientes: ' + conDatos.length + ' de ' + B.envios.length);
tasas.slice(0, 6).forEach(function (x) {
  console.log('     ' + t(x.hoja).slice(0, 14).padEnd(15) + t(x.seg).slice(0, 16).padEnd(17) +
    'delivery ' + (x.delivery !== null ? (x.delivery * 100).toFixed(1) + '%' : '—').padStart(7) +
    '   read ' + (x.read !== null ? (x.read * 100).toFixed(1) + '%' : '—').padStart(7) +
    '   CTOR ' + (x.ctor !== null ? (x.ctor * 100).toFixed(1) + '%' : (x.ctor_imposible ? 'no medible' : '—')).padStart(11));
});
chk('motor-calculo puede derivar el DELIVERY RATE', tasas.filter(function (x) { return x.delivery !== null; }).length > 0,
  tasas.filter(function (x) { return x.delivery !== null; }).length + ' envíos');
chk('motor-calculo puede derivar el READ RATE', tasas.filter(function (x) { return x.read !== null; }).length > 0,
  tasas.filter(function (x) { return x.read !== null; }).length + ' envíos');
chk('motor-calculo puede derivar el CTOR donde hay medición', tasas.filter(function (x) { return x.ctor !== null; }).length > 0,
  tasas.filter(function (x) { return x.ctor !== null; }).length + ' con CTOR real');

// 🔴 la prueba que de verdad importa
var imposibles = tasas.filter(function (x) { return x.ctor_imposible; });
chk('motor-calculo SABE dónde el CTOR no se puede calcular', imposibles.every(function (x) { return x.ctor === null; }),
  imposibles.length + ' marcados «no medible» · sin esto saldrían todos con exactamente 12%');

// ¿y los totales por campaña?
var porCamp = {};
B.envios.forEach(function (e) {
  var k = e.campana_raw || e.hoja;
  porCamp[k] = porCamp[k] || { sends: 0, deliveries: 0, read: 0, clicks: 0, sin_click: 0, n: 0 };
  porCamp[k].sends += e.sends || 0; porCamp[k].deliveries += e.deliveries || 0;
  porCamp[k].read += e.opens_read || 0;
  if (e.clicks !== null) porCamp[k].clicks += e.clicks; else porCamp[k].sin_click++;
  porCamp[k].n++;
});
console.log('\n  por campaña (lo que el reporte va a pedir):');
Object.keys(porCamp).forEach(function (k) {
  var c = porCamp[k];
  console.log('     ' + k.slice(0, 16).padEnd(17) + String(c.n).padStart(3) + ' envíos · ' + mil(c.sends).padStart(7) + ' sends · ' +
    mil(c.read).padStart(6) + ' read' + (c.sin_click ? '   ⚠ ' + c.sin_click + ' sin click medible' : ''));
});
chk('motor-calculo puede agrupar por campaña', Object.keys(porCamp).length > 1, Object.keys(porCamp).length + ' campañas');

// ══ N3 · LA PUERTA ══════════════════════════════════════════════════════════════════
console.log('\n══ N3 · ¿puede escribir Data_WhatsApp? ══');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2cs.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var sh = XLSX.readFile(T).Sheets['Data_WhatsApp'];
var r = XLSX.utils.decode_range(sh['!ref']);
var hdr = [];
for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h) hdr.push(t(h.v)); }
// las columnas de la hoja que el bloque puede llenar
var MAPA = {
  BU: 'bu', Marca: 'marca', 'Campaña': 'campana_raw', Campana_Raw: 'campana_raw',
  Segmento_WA_Raw: 'segmento_raw', Canal: 'canal', Send_Date: 'fecha',
  Sends: 'sends', Deliveries: 'deliveries', Opens_Read: 'opens_read', Clicks: 'clicks',
  Clicks_Medidos: 'clicks_medidos', Errores: 'errores',
  Aud_Original: 'aud_original', Aud_Filtros: 'aud_filtros', Aud_Final: 'aud_final',
  utm_content: 'utm_content', URL: 'url'
};
var cubiertas = hdr.filter(function (h) { return MAPA[h]; });
var calculadas = hdr.filter(function (h) { return /rate|ctor|pct_/i.test(h); });
var faltan = hdr.filter(function (h) { return !MAPA[h] && !/rate|ctor|pct_/i.test(h); });
console.log('  columnas de la hoja: ' + hdr.length);
console.log('     el bloque llena  : ' + cubiertas.length);
console.log('     las calcula motor-calculo   : ' + calculadas.length + '  (' + calculadas.join(', ') + ')');
console.log('     las pone el catálogo o quedan vacías: ' + faltan.length + '  (' + faltan.slice(0, 6).join(', ') + ')');
chk('el bloque llena las columnas de datos de la hoja', cubiertas.length >= 15,
  cubiertas.length + ' de ' + hdr.length);
chk('las 4 calculadas NO las trae el bloque', calculadas.length === 4 && !Object.keys(B.envios[0]).some(function (k) { return /_rate$|^ctor$/i.test(k); }),
  calculadas.join(', ') + ' — son de motor-calculo');
chk('cada envío trae su hoja y su fila de origen', B.envios.every(function (e) { return e.hoja && e.fila_en_hoja; }),
  'trazable hasta la celda de la fuente');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ EL BLOQUE SIRVE — motor-calculo deriva las 4 tasas y sabe dónde el CTOR no existe'));
process.exit(fallo ? 1 : 0);
