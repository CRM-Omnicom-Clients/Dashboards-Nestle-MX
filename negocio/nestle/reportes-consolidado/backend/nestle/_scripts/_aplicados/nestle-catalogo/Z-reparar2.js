// REPARAR lo que el refutador encontró — esta vez leyendo los campos REALES del JSON.
// (El intento anterior asumió que el JSON se llamaba como las columnas del Excel y escribió
//  campos que nadie leía. No dañó el archivo, pero no reparó nada. Restaurado desde git.)
//
//   1. 🔴 Julio f8 tiene TRES recetas y el catálogo guardó una. Se pierden 2 recetas + 2 códigos.
//   2. 🔴 Fecha_Primer_Envio es la del JOURNEY, no la de la PIEZA: 17 piezas caen en otra
//      QUINCENA y 3 en otro MES. Rompe el mes_atribucion de N3 y el anclaje del Qcart.
//   3. 7 códigos de envíos que no salieron, sin declarar → se declaran con su motivo.
//   4. Clicks_Medidos: N4 no puede comparar un CTOR asumido contra un benchmark.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var iso = function (f) { if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10); return t(f).slice(0, 10); };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var wb = XLSX.readFile(os.homedir() + '/_rf.xlsx');
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

// ══ 1 · las 2 recetas perdidas de Julio f8 (AON · E-P4 · Sin Cluster) ══════════════
console.log('══ 1 · recetas perdidas de una fila con varias recetas ══');
var PERDIDAS = [
  { receta: 'Agua de Horchata con Mango', url: 'https://www.recetasnestle.com.mx/recetas/agua-horchata-mango', cod: 'GblUR93I' },
  { receta: 'Huarache de nopal con atún a la mexicana', url: 'https://www.recetasnestle.com.mx/recetas/huarache-nopal-atun-mexicana', cod: 'fDAdN8Qa' }
];
var dest = cat.piezas.filter(function (p) { return p.campana === 'AON' && p.nombre_pieza === 'E-P4' && p.segmento === 'Sin Cluster' && nm(p['Receta_1']) === nm('Tinga de Pollo'); })[0];
if (!dest) { console.log('  🔴 no encontré la pieza destino — NO escribo nada'); process.exit(1); }
console.log('  pieza destino: ' + dest.pieza_id + '  (tenía ' + dest.n_recetas + ' receta)');
var libre = 2;
PERDIDAS.forEach(function (x) {
  while (libre <= 5 && t(dest['Receta_' + libre])) libre++;
  if (libre > 5) { console.log('  🔴 sin bloque libre para ' + x.receta); return; }
  dest['Receta_' + libre] = x.receta;
  dest['URL_Receta_' + libre] = x.url;
  dest['Cod_Walmart_' + libre] = x.cod;
  dest['Carritos_Walmart_' + libre] = 0;          // Data_Qcart no trae filas para estos códigos
  console.log('    ➕ Receta_' + libre + '  «' + x.receta + '»  ' + x.cod + ' (Walmart · 0 carritos en Data_Qcart)');
  libre++;
});
dest.n_recetas = [1, 2, 3, 4, 5].filter(function (i) { return t(dest['Receta_' + i]); }).length;
dest.fuente_qcart = t(dest.fuente_qcart) + (t(dest.fuente_qcart) ? ' ; ' : '') + 'Qcart-Links Mails-Hive- MX.xlsx · Julio · f8 (3 recetas en la fila)';
console.log('  ahora tiene ' + dest.n_recetas + ' recetas');

// ══ 2 · las URLs que faltaban (mismo origen: el maestro) ═══════════════════════════
console.log('\n══ 2 · recetas con código y sin URL ══');
var URLS = {
  'salmonalasfinashierbas': 'https://www.recetasnestle.com.mx/recetas/salmon-finas-hierbas',
  'wrapsdeatun': 'https://www.recetasnestle.com.mx/recetas/wraps-atun',
  'carneparahamburguesa': 'https://www.recetasnestle.com.mx/recetas/carne-hamburguesa',
  'tingadepollo': 'https://www.recetasnestle.com.mx/recetas/comidas-tinga-pollo',
  'molletes': 'https://www.recetasnestle.com.mx/recetas/molletes',
  'espaguetirojocremoso': 'https://www.recetasnestle.com.mx/recetas/espagueti-rojo-cremoso'
};
var nU = 0;
cat.piezas.forEach(function (p) {
  for (var i = 1; i <= 5; i++) {
    if (!t(p['Receta_' + i]) || t(p['URL_Receta_' + i])) continue;
    var u = URLS[nm(p['Receta_' + i])];
    if (u) { p['URL_Receta_' + i] = u; nU++; console.log('    ✔ ' + p.pieza_id + ' Receta_' + i + ' «' + t(p['Receta_' + i]) + '»'); }
    else console.log('    ⚠ ' + p.pieza_id + ' Receta_' + i + ' «' + t(p['Receta_' + i]) + '» — sin URL conocida, queda vacía');
  }
});

// ══ 3 · la FECHA, ahora de la PIEZA ════════════════════════════════════════════════
// 🔴 La fecha del journey aplicada a todas sus piezas es incorrecta: un journey manda varios
//    envíos en fechas distintas. Se toma el MÍNIMO Send_Date de Data_Email de esa pieza, y
//    solo si no hay filas de email se cae al journey (Mundial WA · Liga MX, ya declarados).
console.log('\n══ 3 · Fecha_Primer_Envio por PIEZA (antes era la del journey) ══');
var jById = {}; cat.journeys.forEach(function (j) { jById[j.journey_id] = j; });
var deEmail = 0, deJourney = 0, sinNada = 0, cambiaron = 0, cambioQuincena = 0;
var Qz = function (d) { return Number(d.slice(8, 10)) <= 15 ? 'Q1' : 'Q2'; };
cat.piezas.forEach(function (p) {
  var j = jById[p.journey_id] || {};
  var antes = t(j.fecha_primer_envio);
  var cn = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  var fechas = E.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) >= 0 && r['Send_Date']; })
    .map(function (r) { return iso(r['Send_Date']); }).filter(Boolean).sort();
  if (fechas.length) { p.fecha_primer_envio = fechas[0]; p.fecha_origen = 'Data_Email · mín Send_Date de sus ' + fechas.length + ' fila(s)'; deEmail++; }
  else if (antes) { p.fecha_primer_envio = antes; p.fecha_origen = 'journey ' + p.journey_id + ' (la pieza no tiene filas en Data_Email)'; deJourney++; }
  else { p.fecha_primer_envio = ''; p.fecha_origen = 'sin fecha · ' + t(p.estado); sinNada++; }
  if (antes && p.fecha_primer_envio && antes !== p.fecha_primer_envio) {
    cambiaron++;
    if (antes.slice(0, 7) + Qz(antes) !== p.fecha_primer_envio.slice(0, 7) + Qz(p.fecha_primer_envio)) cambioQuincena++;
  }
  p.mes_atribucion = p.fecha_primer_envio ? p.fecha_primer_envio.slice(0, 7) : '';
  p.quincena_atribucion = p.fecha_primer_envio ? p.fecha_primer_envio.slice(0, 7) + '-' + Qz(p.fecha_primer_envio) : '';
});
console.log('    de Data_Email ' + deEmail + ' · del journey (sin email) ' + deJourney + ' · sin fecha ' + sinNada);
console.log('    🔴 corregidas respecto a la fecha del journey: ' + cambiaron + ' · de ellas cambian de QUINCENA: ' + cambioQuincena);
console.log('    + mes_atribucion y quincena_atribucion derivados (lo que N3 necesita como llave)');

// ══ 4 · los códigos de envíos que no salieron ═════════════════════════════════════
console.log('\n══ 4 · códigos del maestro sin declarar ══');
var NO_SALIO = [
  { c: 'P8IcwfWJ', ctx: 'Mundial » e-bebida5', m: 'el maestro marca "No salió" · Partido 5 no se envió (coincide con Data_Maggi)', f: 'Qcart-Links · Julio · f10' },
  { c: 'znjG7J6r', ctx: 'Mundial » e-botanas5', m: 'el maestro marca "No salió" · Partido 5 no se envió (coincide con Data_Maggi)', f: 'Qcart-Links · Julio · f11' },
  { c: '5NnTxarc', ctx: 'Mundial » e-cooking5', m: 'el maestro marca "No salió" · Partido 5 no se envió (coincide con Data_Maggi)', f: 'Qcart-Links · Julio · f12' },
  { c: 'LJQsq5T9', ctx: 'Mundial » Envío Federación', m: 'Envío Federación · no está cargado en Data_Email, no hay pieza que lo reclame', f: 'Qcart-Links · Junio · f19' },
  { c: 'L5rqwrzD', ctx: 'Mundial » wa-botana1', m: 'el maestro marca "No enviado"', f: 'Qcart-Links · Junio · f20' },
  { c: 'JPrNSrwn', ctx: 'Mundial » wa-bebida1', m: 'el maestro marca "No enviado"', f: 'Qcart-Links · Junio · f22' },
  { c: 'yj8PKdRr', ctx: 'Mundial » wa-cooking1', m: 'el maestro marca "No enviado"', f: 'Qcart-Links · Junio · f25' }
];
cat.sinPieza = cat.sinPieza || [];
var yaSP = {}; cat.sinPieza.forEach(function (s) { yaSP[t(s.codigo)] = 1; });
var nE = 0;
NO_SALIO.forEach(function (x) {
  if (yaSP[x.c]) return;
  cat.sinPieza.push({ codigo: x.c, campana: x.ctx.split(' » ')[0], utm_content: x.ctx.split(' » ')[1] || '', carritos: 0, motivo: x.m, fuente: x.f });
  nE++; console.log('    ⛔ ' + x.c + '  ' + x.ctx.padEnd(28) + x.m.slice(0, 60));
});
console.log('    declarados: ' + nE + ' (0 carritos los 7 — ningún número cambia, cambia la trazabilidad)');

// ══ 5 · Clicks_Medidos ════════════════════════════════════════════════════════════
// REGLA DE NEGOCIO ya documentada, no inferencia: en Tercer Tiempo los clicks de WhatsApp NO
// se midieron (la fuente los deriva de Read × 12% asumido); en Hotcakes SÍ (el CTOR varía).
console.log('\n══ 5 · Clicks_Medidos ══');
var der = [], med = 0, na = 0;
cat.piezas.forEach(function (p) {
  if (t(p.canal) !== 'WhatsApp') { p.clicks_medidos = 'N/A · email'; na++; return; }
  if (nm(p.campana) === 'tercertiempo') { p.clicks_medidos = 'No · derivado de Read × CTOR 12% asumido'; der.push(p.pieza_id); }
  else { p.clicks_medidos = 'Sí · medido'; med++; }
});
console.log('    email ' + na + ' · WhatsApp medido ' + med + ' · WhatsApp DERIVADO ' + der.length + ' (' + der.join(' ') + ')');

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado');
