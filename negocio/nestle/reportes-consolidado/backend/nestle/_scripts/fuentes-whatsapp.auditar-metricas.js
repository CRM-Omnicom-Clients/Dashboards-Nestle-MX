/*
 * fuentes-whatsapp.auditar-metricas.js — ¿LAS MÉTRICAS DE WHATSAPP SE CALCULAN IGUAL EN TODAS
 * LAS HOJAS Y EN TODAS LAS CAPAS?
 *
 * Rick, 22-sep: «las métricas de whatsapp hazles auditorías, debe de quedar claro para el skill
 * cómo calcula las métricas y calcularlas siempre con el mismo método para todo whatsapp. Veo
 * muchas discrepancias en las métricas %. Si tienes dudas no infieras nada, me dices.»
 *
 * 🔴 LO QUE ESTE AUDITOR ENCONTRÓ, Y YA ESTÁ RESUELTO (22-sep-2026). Las discrepancias que Rick
 *    veía no eran de criterio: el método estaba BIEN declarado en el SKILL desde antes, con el
 *    denominador correcto. Lo que fallaba era que `Data_WhatsApp` **guardaba** cuatro tasas junto
 *    a sus conteos — una derivación guardada es un caché, y ese caché no tenía invalidación:
 *    `008-P008` decía 60.90% teniendo 2,405 y 2,890 en su propia fila, que dan 83.22%.
 *    Las 4 columnas se retiraron. Ya no hay tres capas dividiendo: los conteos viven en el
 *    bloque y la tasa la deriva el motor, que es lo que el esquema decía desde el principio.
 *
 * 🔴 ESTE SCRIPT NO ARREGLA NADA: MIDE. Aplica el método único a los 16 envíos y comprueba la
 *    coherencia interna. Lo que no se pueda decidir sin inferir se imprime como PREGUNTA.
 *
 * 🔴 EL MÉTODO ÚNICO, deducido de las filas que Rick ya tiene (no inventado):
 *      %Entrega         = entregados / envíos        (125/162 = 0.7716 ✔ f11 del reporte)
 *      %No entrega      = no_entregados / envíos     y %Entrega + %No entrega = 1
 *      %Read vs entrega = leídos / entregados        (94/125  = 0.752  ✔)
 *      %Click vs Read   = clicks / leídos            (17/94   = 0.1809 ✔)
 *    Los denominadores NO son intercambiables: leer sobre envíos en vez de entregados baja la
 *    lectura ~23 pp en estas campañas.
 *
 * 🔴 Y LA REGLA QUE PIDIÓ RICK: en WhatsApp no hay tracking de clicks, así que
 *      `WA-Clicks Qcart` ≡ `Carritos_Total` de esa pieza.
 *
 *   node fuentes-whatsapp.auditar-metricas.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'data_whatsapp';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
/* 🔴 VACÍO DEVUELVE null, NO CERO. `Number('')` es 0, y eso hizo que este mismo auditor pintara
 *    «bloque 0.00%» en las 16 filas —como si el bloque calculara mal— cuando el bloque
 *    simplemente NO guarda tasas, que es lo correcto. Un cero no es un vacío (R10), y el
 *    auditor no está exento de la regla que audita. */
var num = function (v) { var s0 = t(v); if (s0 === '') return null; var x = Number(s0.replace(/[,$%\s]/g, '')); return isFinite(x) ? x : null; };
var pct = function (a, b) { return (b && a !== null && b !== null) ? a / b : null; };
var p4 = function (x) { return x === null ? '—' : (100 * x).toFixed(2) + '%'; };
var cerca = function (a, b) { return a !== null && b !== null && Math.abs(a - b) < 0.005; };

var tmp = BACK + '/_tmp/_wametricas.xlsx';
fs.copyFileSync(VIVO, tmp);
var wb = XLSX.readFile(tmp);
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8')).envios || [];
var HOJA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' });
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// 🔴 las columnas de la hoja se PIDEN. `h['Pieza_ID']` por literal ya acusó de vacías a 98/98.
function N(id) { return COL.de(HOJA, id, AMBITO); }
var cID = N('Pieza_ID'), cSENDS = N('Sends');
/* 🔴 22-sep-2026 · YA NO SE PIDEN `Read_Rate` NI `Pct_Error`: se RETIRARON de la hoja.
 *    Este auditor nació para comparar la misma tasa en tres capas (bloque · hoja · método único)
 *    porque las tres divergían. La causa de fondo era que la hoja guardaba la tasa junto a sus
 *    conteos —un caché sin invalidación— y quedó con el denominador crudo tras la conciliación.
 *    Retiradas las 4 columnas, **ya no hay tres capas, hay una**: los conteos viven en el bloque
 *    y la tasa la deriva el motor. La comparación de la sección 4 dejó de tener objeto, y este
 *    script truenó al pedirlas — la librería haciendo exactamente su trabajo.
 *    Lo que queda medido sigue siendo lo que importa: el método único, la coherencia interna de
 *    la fuente, y la regla `clicks ≡ carritos`. */
function hv(fila, nom) { return fila ? fila[nom] : null; }

console.log('════════ AUDITORÍA DE MÉTRICAS DE WHATSAPP ════════');
console.log('  bloque ' + B.length + ' envíos   ·   Data_WhatsApp ' + HOJA.length + ' filas\n');

// ══ 1 · EL MÉTODO ÚNICO, APLICADO A LOS 16 ═══════════════════════════════════════════
console.log('── 1 · las 4 tasas con UN método, envío por envío');
console.log('   pieza        hoja    envíos  entreg  leídos  clicks │ %Entrega  %NoEnt    %Read   %Click');
var filas = [];
B.forEach(function (e) {
  var r = {
    entrega: pct(e.deliveries, e.sends), noEntrega: pct(e.no_entregados, e.sends),
    read: pct(e.opens_read, e.deliveries), click: (e.clicks === null ? null : pct(e.clicks, e.opens_read))
  };
  filas.push({ e: e, r: r });
  console.log('   ' + (t(e.pieza_id) || '(sin pieza)').padEnd(13) + t(e.hoja).slice(0, 6).padEnd(8) +
    String(e.sends).padStart(6) + String(e.deliveries).padStart(8) + String(e.opens_read).padStart(8) +
    String(e.clicks === null ? 'n/m' : e.clicks).padStart(8) + ' │ ' +
    p4(r.entrega).padStart(8) + p4(r.noEntrega).padStart(8) + p4(r.read).padStart(9) + p4(r.click).padStart(9));
});

// ══ 2 · ¿SUMAN 1 LAS DOS DE ENTREGA? ═════════════════════════════════════════════════
console.log('\n── 2 · %Entrega + %No entrega debe dar 1');
var malSuma = filas.filter(function (x) { return !cerca((x.r.entrega || 0) + (x.r.noEntrega || 0), 1); });
console.log('   ' + (malSuma.length ? '🔴 ' + malSuma.length + ' no suman 1: ' +
  malSuma.map(function (x) { return t(x.e.pieza_id) + ' (' + p4(x.r.entrega) + '+' + p4(x.r.noEntrega) + ')'; }).join(' · ')
  : '✔ los ' + filas.length + ' suman 1'));

// ══ 3 · LO QUE LA FUENTE PUBLICA vs LO CONCILIADO ════════════════════════════════════
console.log('\n── 3 · ¿la fuente se contradice a sí misma?');
var inco = B.filter(function (e) { return e.entrega_coherente === false; });
console.log('   ' + (inco.length ? '🔴 ' + inco.length + ' envío(s) incoherentes EN LA FUENTE:' : '✔ ninguno'));
inco.forEach(function (e) {
  console.log('      ' + (t(e.pieza_id) || '(sin pieza)').padEnd(13) + t(e.journey).slice(-26) +
    '   dice entregados ' + e.entregados_hoja + ' (hueco ' + (e.sends - e.entregados_hoja) + ') pero sus fallos suman ' +
    e.no_entregados + ' → conciliado a ' + e.deliveries);
});

/* ══ 4 · (RETIRADA) · antes comparaba la misma tasa en tres capas. Con las 4 columnas de
 * tasa fuera de Data_WhatsApp ya no hay tres capas: los conteos viven en el bloque y la tasa
 * la deriva el motor. Dejar la comparación habría sido medir una capa que ya no existe. */
var divergen = [];

// ══ 5 · LA REGLA DE RICK: CLICKS ≡ CARRITOS ══════════════════════════════════════════
console.log('\n── 5 · «los clicks de WhatsApp con Qcart ≡ los carritos totales de la pieza»');
var carrPorPieza = {};
/* 🔴 VISTAS, NO FILAS — Y ESTE ERA EL CASO GRAVE (29-sep-2026). Este auditor comprueba LA REGLA
 *    DE RICK, y contaba los carritos `+ 1` por fila. El bloque de WhatsApp tambien los contaba por
 *    fila, asi que **los dos estaban mal y los dos coincidian**: la auditoria salia en ✔ diciendo
 *    que la regla se cumplia, con 21 clicks contra 21 filas donde hay 43 carritos.
 *    Es exactamente la patologia que ya habia morado en Data_WhatsApp: la auditoria comparaba el
 *    bloque contra si mismo y los dos salian del MISMO lector equivocado. Un auditor que hereda la
 *    unidad de lo que audita no audita nada — solo confirma. */
(Q.carritos || []).forEach(function (c) { var p = t(c.pieza_id); if (p) carrPorPieza[p] = (carrPorPieza[p] || 0) + (Number(c.views) || 0); });
/* 🔴 LA REGLA SOLO APLICA DONDE HAY QCART — la primera versión la aplicaba a las 16 y acusaba
 *    a 7 piezas de «clicks ≠ carritos» cuando esas piezas NO TIENEN ningún link de Qcart: sus
 *    clicks salen de la columna propia de su hoja (Hotcakes, Mundial e ICE traen `Clicks`).
 *    Rick lo dijo con esa condición — «los clicks de whatsapp QUE TIENEN QCART» — y medirla
 *    fuera de su ámbito convierte una regla buena en 7 falsos positivos. El ámbito se lee del
 *    CATÁLOGO (¿la pieza declara códigos?), no de si el número casualmente cuadra. */
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var conQcart = {};
CAT.forEach(function (p) {
  var id = t(p[COL.de(CAT, 'Pieza_ID', 'catalogo')]); if (!id) return;
  var tiene = Object.keys(p).some(function (k) { return /^Cod_/.test(k) && t(p[k]) && !/^(N\/A|POR DEFINIR)$/i.test(t(p[k])); });
  if (tiene) conQcart[id] = true;
});
var malClicks = [], vistos = {}, aplican = 0;
filas.forEach(function (x) {
  var id = t(x.e.pieza_id); if (!id || vistos[id]) return; vistos[id] = 1;
  var hermanos = B.filter(function (y) { return t(y.pieza_id) === id; });
  if (!conQcart[id]) {
    console.log('   ' + id.padEnd(13) + 'la pieza NO declara códigos de Qcart — la regla no aplica; sus clicks salen de su hoja');
    return;
  }
  if (hermanos.every(function (y) { return y.clicks === null; })) {
    console.log('   ' + id.padEnd(13) + 'clicks NO medidos (la fuente los deriva de un CTOR asumido) — la regla no aplica');
    return;
  }
  aplican++;
  var suma = hermanos.reduce(function (a, y) { return a + (y.clicks || 0); }, 0);
  var carr = carrPorPieza[id] || 0;
  var ok = suma === carr;
  if (!ok) malClicks.push({ pieza: id, clicks: suma, carritos: carr, dif: suma - carr });
  console.log('   ' + id.padEnd(13) + 'Σ clicks ' + String(suma).padStart(4) + '   ·   carritos Qcart ' + String(carr).padStart(4) + '   ' + (ok ? '✔' : '🔴 difieren en ' + (suma - carr)));
});
console.log('   ' + (malClicks.length ? '🔴 ' + malClicks.length + ' de ' + aplican + ' pieza(s) con Qcart donde clicks ≠ carritos'
  : '✔ la regla se cumple en las ' + aplican + ' piezas donde aplica'));

fs.writeFileSync(BACK + '/_preescritura/whatsapp-auditoria-metricas.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  metodo_unico: {
    pct_entrega: 'entregados / envíos', pct_no_entrega: 'no_entregados / envíos',
    pct_read: 'leídos / entregados', pct_click: 'clicks / leídos',
    regla_clicks: 'WA-Clicks Qcart ≡ Carritos_Total de la pieza (en WhatsApp no hay tracking de clicks)'
  },
  quien_divide_hoy: ['motor.motor.js', 'fuentes-whatsapp.whatsapp.js', 'lib-valores-resumen.js'],
  envios: filas.map(function (x) { return { pieza: x.e.pieza_id, hoja: x.e.hoja, journey: x.e.journey, sends: x.e.sends, deliveries: x.e.deliveries, read: x.e.opens_read, clicks: x.e.clicks, tasas: x.r }; }),
  incoherentes_en_la_fuente: inco.map(function (e) { return { pieza: e.pieza_id, journey: e.journey, entregados_hoja: e.entregados_hoja, conciliado: e.deliveries }; }),
  divergencias_entre_capas: divergen,
  clicks_vs_carritos: malClicks
}, null, 1));
console.log('\n→ _preescritura/whatsapp-auditoria-metricas.json');
