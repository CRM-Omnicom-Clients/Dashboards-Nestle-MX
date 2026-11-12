// C2 · RECONSTRUIR Data_Email AL GRANO NUEVO — 98 piezas, limpio, desde catálogo + bloque.
//
// 🔴 EL CONTRATO DE ESCRITURA DE LA FUENTE EMAIL (F2). Cada columna de la hoja dice de dónde sale.
//    · DIMENSIONES  → del CATÁLOGO FUTURO (con A2/A3/A8/A9/A10 aplicados). Es la fuente de verdad;
//      el bloque email.json es anterior a esos cambios y traería campañas viejas (011 en vez de 007).
//    · MÉTRICAS     → del bloque email.json (SFMC · CRM_Email_Piezas).
//    · El cruce es por EMAIL_ID, estable — A3 renumeró pieza_ids (011-P001 → 007-P005), así que
//      cruzar por pieza_id perdería esas piezas. Respaldo por pieza_id solo si no hay email_id.
//    · TASAS        → calculadas aquí, no copiadas.
//    · Columnas crudas de Datorama sin equivalente en SFMC → vacías, declarado (no se inventan).
//
// 🔴 C3 ya verificó que ninguna canónica a mano de Rick se pierde: el catálogo coincide con lo que
//    él escribió (las 3 «diferencias» eran el bloque juntando Segmento+Subsegmento; el catálogo no).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(__dirname + '/lib-flexible.js');
var CB = require(__dirname + '/lib-cambios.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
function serial(iso) { // fecha ISO → serial Excel (base 1899-12-30)
  if (!t(iso)) return '';
  var d = new Date(t(iso).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d)) return '';
  return Math.round((d - new Date('1899-12-30T00:00:00Z')) / 86400000);
}
var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function mesDe(iso) { var m = +t(iso).slice(5, 7); return m ? MESES[m - 1] : ''; }
function quincenaDe(iso) { var m = +t(iso).slice(5, 7), d = +t(iso).slice(8, 10); if (!m) return ''; return t(iso).slice(0, 4) && (MESES[m - 1].slice(0, 3) + '-Q' + (d <= 15 ? '1' : '2') + '-' + t(iso).slice(0, 4)); }

console.log('════════ C2 · RECONSTRUIR Data_Email ' + (ESCRIBIR ? '(apunta hoja)' : '(seco)') + ' ════════\n');
CB.descartarNodoHoja('C2');

var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8')).envios;
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { header: 1 })[0] || [];
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));
var catEid = {}, catPz = {};
P.forEach(function (p) { if (t(p['EmailID'])) catEid[t(p['EmailID'])] = p; catPz[t(p['Pieza_ID'])] = p; });

// una fila de la hoja, por cada envío del bloque
var filas = [], sinCat = [];
E.forEach(function (e) {
  var c = catEid[t(e.email_id)] || catPz[t(e.pieza_id)];
  if (!c) { sinCat.push(t(e.pieza_id) + '/' + t(e.email_id)); return; }
  var sends = num(e.email_sends), deliv = num(e.email_deliveries), opens = num(e.email_unique_opens),
    clicks = num(e.email_unique_clicks), bounces = num(e.email_bounces);
  var fila = {
    // ── dimensiones: del CATÁLOGO FUTURO
    'BU': t(c['BU']), 'Campaign': t(c['Campaña']), 'Journey': t(c['Objetivo']), 'Segment': t(c['Segmento']),
    'Email_Type': t(e.email_type) || t(c['Email_Type']), 'Touchpoint': t(c['Touchpoint']), 'Version': '',
    'Journey_ID': t(e.journey_id_datorama) || t(c['Journey_ID']),
    'Subject_Clean': t(e.subject), 'Report_Period': '', 'Source': 'SFMC · CRM_Email_Piezas',
    'Send_Date': serial(e.fecha), 'Send_Week': '', 'Email_Sender_Name': t(c['BU']), 'Canal': 'Email',
    'BU_Canonico': t(c['BU']), 'Marca': t(c['Marca']), 'Campana_Canonica': t(c['Campaña']), 'Segmento_Canonico': t(c['Segmento']),
    'Nombre_Journey': t(e.nombre_journey) || t(c['Content_Name']),
    'Datorama_Campaign': '', 'Datorama_Campaign_ID': '',
    // 🔴 A11 renombró este encabezado en Data_Email a «Email_Name». Se escribe con el nombre de HOY.
    'Email_Name': t(c['Content_Name']), 'Email_Subject_Raw': t(e.subject), 'Audience_Name': t(e.audiencia_de),
    // ── métricas: del BLOQUE
    'Email_Sends': sends, 'Email_Deliveries': deliv, 'Email_Unique_Opens': opens,
    'Email_Unique_Clicks': clicks, 'Email_Bounces': bounces,
    // ── tasas: CALCULADAS
    'Delivery_Rate': sends ? deliv / sends : '', 'Open_Rate': deliv ? opens / deliv : '',
    'Click_Rate': deliv ? clicks / deliv : '', 'CTOR': opens ? clicks / opens : '', 'Bounce_Rate': sends ? bounces / sends : '',
    'Flag_Zero_Sends': sends === 0 ? 'TRUE' : 'FALSE',
    'Flag_Negative_Values': [sends, deliv, opens, clicks, bounces].some(function (x) { return x < 0; }) ? 'TRUE' : 'FALSE',
    'Flag_Rate_Mismatch': deliv > sends ? 'TRUE' : 'FALSE',
    'Send_Month': mesDe(e.fecha), 'Send_Quincena': quincenaDe(e.fecha), 'Brand': t(c['Marca']),
    'Send_Week_Label': '', 'Excluido_Motivo': '', 'pieza_id': t(c['Pieza_ID'])
  };
  filas.push(fila);
});

// verificación: toda columna de la hoja está mapeada
var sinMapear = enc.map(t).filter(function (col) { return col && !(filas[0] && col in filas[0]); });
console.log('  columnas de la hoja: ' + enc.length + '   ·   mapeadas: ' + (enc.length - sinMapear.length));
if (sinMapear.length) console.log('  🔴 sin mapear: ' + sinMapear.join(' · '));
console.log('  filas nuevas: ' + filas.length + '   (antes 264)   ·   sin catálogo: ' + sinCat.length + (sinCat.length ? ' → ' + sinCat.join(' · ') : ''));

// cuadres contra el bloque
var sumSends = filas.reduce(function (a, f) { return a + num(f['Email_Sends']); }, 0);
var sumBloque = E.reduce(function (a, e) { return a + num(e.email_sends); }, 0);
console.log('\n  Σ Email_Sends hoja: ' + sumSends.toLocaleString('es-MX') + '   ·   Σ bloque: ' + sumBloque.toLocaleString('es-MX') +
  '   ' + (sumSends === sumBloque ? '✔' : '🔴'));
// 🔴 BU y Campaña son obligatorias: sin ellas no hay pieza. El SEGMENTO puede faltar legítimamente
//    cuando la fuente misma lo declara «(por definir)» — inventarlo sería peor que dejarlo vacío.
var faltaClave = filas.filter(function (f) { return !f['BU'] || !f['Campana_Canonica']; });
console.log('  filas sin BU o sin Campaña (BLOQUEA): ' + faltaClave.length + (faltaClave.length ? ' 🔴' : ' ✔'));
var sinSeg = filas.filter(function (f) { return !t(f['Segmento_Canonico']); });
console.log('  filas sin Segmento (AVISA · la fuente dice «por definir»): ' + sinSeg.length +
  (sinSeg.length ? '  → ' + sinSeg.map(function (f) { return f['pieza_id']; }).join(' · ') : ''));
var camp011 = filas.filter(function (f) { return /011|espresso con/i.test(f['Campana_Canonica']); });
console.log('  filas que todavía dicen 011/Espresso Con: ' + camp011.length + (camp011.length ? ' 🔴' : ' ✔ (A3 aplicado)'));

if (sinSeg.length) fs.writeFileSync(BACK + '/_respaldos/C2-sin-segmento.json', JSON.stringify({
  paso: 'C2', motivo: 'estas piezas de Email no tienen Segmento en ninguna fuente: SFMC lo declara «(por definir)». Se dejan vacías, no se inventa.',
  piezas: sinSeg.map(function (f) { return { pieza_id: f['pieza_id'], bu: f['BU'], campana: f['Campana_Canonica'], touchpoint: f['Touchpoint'] }; })
}, null, 1));

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(sinMapear.length || sumSends !== sumBloque || faltaClave.length ? 1 : 0); }
CB.regenerarHoja('C2', 'Data_Email', filas,
  'C2 · Data_Email reconstruida a ' + filas.length + ' piezas (grano día-de-envío → por pieza). Dimensiones del catálogo futuro por email_id, métricas del bloque SFMC, tasas calculadas. Respaldo verificado en C1.');
var res = CB.resumen();
console.log('\n  ── hojas a regenerar: ' + res.hojas + '   ·   celdas: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo. Lo aplica escritor.escribir-todo.js.');
