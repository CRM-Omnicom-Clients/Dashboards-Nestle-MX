// E1 · ORGANIZAR — el paso 3 del skill del catálogo (1.11 · 1.12 · 1.17).
//
//   1.11 · los segmentos con el nombre completo que dictó Rick, en español
//   1.12 · 🔴 ninguna celda vacía: `N/A` si NO APLICA, `PENDIENTE` si aplica y falta
//   1.17 · `Subject` al catálogo, desde SFMC (la causa raíz de los errores que Rick vio)
//
// 🔴 LO IMPORTANTE DE 1.12, y responde la pregunta de Rick sobre mejores prácticas: llenar TODO lo
//    vacío con `N/A` cerraría el archivo pero **borraría la señal de qué falta**. Con dos marcas el
//    archivo también queda al 100% sin vacías, y además un guardián puede exigir que `PENDIENTE`
//    tienda a cero — que es la lista de trabajo real.
//
// 🔴 LA PRUEBA PARA DECIDIR: va `N/A` **solo si se puede ESCRIBIR la razón** por la que no aplica
//    («Cod_Chedraui_3 no aplica: la pieza no tiene una receta 3»). Si la razón no se puede
//    escribir, el vacío NO es un N/A: es un PENDIENTE, y alguien tiene que conseguirlo.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var RG = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ E1 · ORGANIZAR ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('E1org');

var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));
var h = RG.abrir('catalogo', enc, { silencioso: true });
function col(id, resp) { try { return h.n(id); } catch (e) { return resp; } }
var C_EID = col('catalogo.emailid', 'EmailID'), C_NOM = col('catalogo.content_name', 'Email_Name');

var apuntes = [];
function apunta(fila, columna, valor, porque) { apuntes.push({ fila: fila, columna: columna, valor: valor, porque: porque }); }

// ══ 1.11 · LOS SEGMENTOS QUE DICTÓ RICK ═══════════════════════════════════════════
console.log('══ 1.11 · segmentos con el nombre completo ══');
var SEG = {
  'App': 'Usuarios activos sin click en App',
  'Propensión': 'Usuarios re-enganchables: nuevos del último año que nunca han interactuado',
  'Propension': 'Usuarios re-enganchables: nuevos del último año que nunca han interactuado'
};
var nSeg = 0;
P.forEach(function (p, i) {
  var s = t(p['Segmento']); if (!SEG[s]) return;
  apunta(i + 2, 'Segmento', SEG[s], 'nombre completo dictado por Rick (24-ago). En español, como el resto del vocabulario.');
  console.log('   ' + t(p['Pieza_ID']).padEnd(10) + '«' + s + '» → «' + SEG[s].slice(0, 52) + '»');
  nSeg++;
});
console.log('   ' + nSeg + ' pieza(s)');

// ══ 1.17 · SUBJECT DESDE SFMC ═════════════════════════════════════════════════════
console.log('\n══ 1.17 · Subject al catálogo (desde SFMC) ══');
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var porEid = {}, porNom = {};
D.rows.forEach(function (r) { porEid[t(r.Email_ID)] = r; porNom[t(r.Email_Content_Name)] = r; });
var conSubject = 0, sinSubject = 0, naSubject = 0;
P.forEach(function (p, i) {
  var fila = i + 2;
  var s = porEid[t(p[C_EID])] || porNom[t(p[C_NOM])];
  if (s && t(s.Email_Subject)) { apunta(fila, 'Subject', t(s.Email_Subject), 'lo declara SFMC — la autoridad de Email_Name, Email_ID y Subject.'); conSubject++; }
  else if (/whats/i.test(t(p['Canal']))) { apunta(fila, 'Subject', 'N/A', 'WhatsApp no lleva subject: no es un correo.'); naSubject++; }
  else { apunta(fila, 'Subject', 'PENDIENTE', 'la pieza es de email pero SFMC todavía no entrega su subject.'); sinSubject++; }
});
console.log('   de SFMC: ' + conSubject + '   ·   N/A (WhatsApp): ' + naSubject + '   ·   PENDIENTE: ' + sinSubject);

// ══ 1.12 · NI UNA CELDA VACÍA ═════════════════════════════════════════════════════
console.log('\n══ 1.12 · ninguna celda vacía · N/A vs PENDIENTE ══');

// 🔴 qué campañas usan Chedraui SE MIDE, no se supone
var usaChedraui = {};
P.forEach(function (x) {
  for (var i = 1; i <= 5; i++) if (t(x['Cod_Chedraui_' + i])) usaChedraui[t(x['Campaña'])] = true;
});
console.log('   campañas que usan Chedraui: ' + (Object.keys(usaChedraui).join(', ') || 'ninguna'));

function noAplica(p, c) {
  var canal = t(p['Canal']), tipo = t(p['Email_Type']), estado = t(p['Estado']);
  var esWA = /whats/i.test(canal), esRetirada = /Retirada/i.test(estado), programada = /Sin email cargado/i.test(estado);

  // — lo de email no aplica a WhatsApp
  if (esWA && /^(Email_Name|Email_Names_Variantes|N_Email_Names|Email_Name_Legacy|Asset_ID|Content_ID|Email_ID|Subject|Email_Type|ID_SFMC|Codigo_NC)/i.test(c))
    return 'WhatsApp no es un correo: no tiene ' + c;
  // — la foránea solo aplica a los FUP
  if (c === 'Pieza_Principal_ID' && !/follow|fup/i.test(tipo)) return 'solo las piezas de seguimiento apuntan a un Principal';
  // — Chedraui: si NINGUNA pieza de la campaña lo usa, la tienda no aplica
  if (/^(Cod_Chedraui|Carritos_Chedraui)_\d$/.test(c) && !usaChedraui[t(p['Campaña'])])
    return 'ninguna pieza de esta campaña usa Chedraui: la tienda no aplica';
  // — las recetas y sus códigos: la N no aplica si no hay receta N
  var m = /^(Receta|URL_Receta|Cod_Walmart|Carritos_Walmart|Cod_Chedraui|Carritos_Chedraui)_(\d)$/.exec(c);
  if (m) { var n = +m[2]; if (!t(p['Receta_' + n])) return 'la pieza no tiene una receta ' + n; }
  // — lo de Qcart no aplica si la pieza no lo usa
  if (/^(N_Recetas|Carritos_Total|Views_Total|Fuente_Qcart|Fecha_Activacion_Qcart|Activaciones_Qcart)$/i.test(c) && t(p['Tiene_Qcart']) === 'No')
    return 'la pieza no tiene Qcart';
  // — lo que solo tiene sentido si la pieza SALIÓ
  if ((esRetirada || programada) && /^(Fecha_Primer_Envio|Fecha_Ultimo_Envio|Quincena_Lanzamiento|Mes_Lanzamiento|Quincenas_Activas|N_Quincenas|Meses_Activos|N_Meses|Sends_Por_Quincena|Sends_Por_Mes|N_Envios_Fechados|Dias_Envio|Sends|Clicks_Medidos|Granularidad_Periodo|Fecha_Origen)$/i.test(c))
    return esRetirada ? 'la pieza está retirada: nunca salió' : 'la pieza está programada: todavía no sale';
  // — campos opcionales por naturaleza
  if (/^(Segmentos_Combinados|Subsegmento|Notas|Oleada|Mascota|Touchpoint_Raw|Email_Names_Variantes|N_Email_Names|Email_Name_Legacy)/i.test(c))
    return 'campo opcional: solo se llena cuando aplica';
  return null;
}

var cols = enc.filter(Boolean);
var nNA = 0, nPend = 0, pendPorCol = {};
P.forEach(function (p, i) {
  var fila = i + 2;
  cols.forEach(function (c) {
    if (c === 'Subject') return;                    // ya resuelta arriba
    if (t(p[c])) return;                            // tiene dato
    var razon = noAplica(p, c);
    if (razon) { apunta(fila, c, 'N/A', razon); nNA++; }
    else { apunta(fila, c, 'PENDIENTE', 'aplica a esta pieza y no lo tenemos: hay que conseguirlo.'); nPend++; pendPorCol[c] = (pendPorCol[c] || 0) + 1; }
  });
});
console.log('   N/A (no aplica, con su razón): ' + nNA.toLocaleString('es-MX'));
console.log('   PENDIENTE (aplica y falta):    ' + nPend.toLocaleString('es-MX'));
if (nPend) {
  console.log('\n   🔴 la lista de trabajo real — dónde falta dato:');
  Object.keys(pendPorCol).sort(function (a, b) { return pendPorCol[b] - pendPorCol[a]; }).slice(0, 12)
    .forEach(function (c) { console.log('      ' + String(pendPorCol[c]).padStart(4) + '  ' + c); });
}

fs.writeFileSync(BACK + '/_catalogo/celdas-clasificadas.json', JSON.stringify({
  paso: 'E1org', fecha: '2026-08-24',
  regla: 'N/A si se puede ESCRIBIR la razon por la que no aplica. Si no se puede escribir, es PENDIENTE.',
  por_que: 'Llenar todo de N/A cierra el archivo pero borra la senal de que falta. Con dos marcas un guardian puede exigir que PENDIENTE tienda a cero.',
  na: nNA, pendiente: nPend, pendiente_por_columna: pendPorCol,
  subject: { de_sfmc: conSubject, na_whatsapp: naSubject, pendiente: sinSubject }
}, null, 1));

console.log('\n  ── total a apuntar: ' + apuntes.length.toLocaleString('es-MX') + ' celdas');
if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
CB.apuntarColumna('E1org', 'Catalogo_Piezas', 'Subject',
  'El subject de cada pieza, desde SFMC. Rick: "agregar los subjects al catalogo, por eso hay errores" -- sin el, el subject del reporte se resolvia por otra via y se equivocaba.');
// 🔴 por LOTE: apuntar 4,370 celdas una por una hace cargar+guardar del JSON en CADA llamada,
//    que es O(n²) sobre un archivo que crece. Una sola escritura.
CB.apuntarLote('E1org', apuntes.map(function (a) {
  return { hoja: 'Catalogo_Piezas', fila: a.fila, columna: a.columna, valor: a.valor, porque: 'E1org · ' + a.porque };
}));
var res = CB.resumen();
console.log('\n  ── apuntadas ' + apuntes.length.toLocaleString('es-MX') + '. Acumulado: ' + res.total.toLocaleString('es-MX') + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
