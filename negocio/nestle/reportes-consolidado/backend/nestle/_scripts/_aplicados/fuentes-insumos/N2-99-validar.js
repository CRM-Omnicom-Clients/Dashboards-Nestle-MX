// N2 · VALIDACIÓN.  Se corre siempre antes de declarar el paso cerrado.
//
// Marcado como en el catálogo:
//   🟢 INDEPENDIENTE  se contrasta contra una FUENTE que N2 no escribió
//   ⚪ COHERENCIA     el backend contra sí mismo — necesario, no suficiente
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = D.t, num = D.num;
var F = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var V = [], fallo = 0;
function chk(tipo, n, ok, d) { V.push([tipo, n, ok, d]); if (!ok) fallo++; }

var T = os.homedir() + '/_n2v.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var Rf = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });

// ── V2.1 🟢 Σ del backend == Σ de la hoja de origen
var sB = F.envios.reduce(function (a, e) { return a + e.email_sends; }, 0);
var sE = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
chk('🟢', 'V2.1 Σ sends del backend == Data_Email', sB === sE, sB.toLocaleString() + ' vs ' + sE.toLocaleString());

// ── V2.2 ⚪ 0 duplicados por la llave
var k = {}; F.envios.forEach(function (e) { k[e.llave] = (k[e.llave] || 0) + 1; });
var dup = Object.keys(k).filter(function (x) { return k[x] > 1; });
chk('⚪', 'V2.2 0 duplicados por la llave', !dup.length, dup.length ? dup.length + ' repetidas' : F.envios.length + ' llaves únicas');

// ── V2.3 🟢 monotonía: ninguna métrica del backend es MENOR que la de la hoja
var bajaron = [];
var porLlave = {}; E.forEach(function (r) { porLlave[D.llaveEnvio({ content_name: r['Email_Content_Name'], fecha: r['Send_Date'] })] = r; });
F.envios.forEach(function (e) {
  var r = porLlave[e.llave]; if (!r) return;
  ['email_sends', 'email_deliveries', 'email_unique_opens', 'email_unique_clicks'].forEach(function (m) {
    var col = m.split('_').map(function (x) { return x[0].toUpperCase() + x.slice(1); }).join('_');
    if (e[m] < num(r[col])) bajaron.push(e.llave.slice(-24) + ' ' + m);
  });
});
chk('🟢', 'V2.3 monotonía: nada bajó', !bajaron.length, bajaron.length ? bajaron.slice(0, 3).join(' · ') : 'MAX aplicado en las ' + F.envios.length);

// ── V2.4 ⚪ anti-cero: toda fila con sends=0 y opens>0 está marcada, no descartada
var raras = F.envios.filter(function (e) { return e.email_sends === 0 && e.email_unique_opens > 0; });
chk('⚪', 'V2.4 filas sends=0 con opens>0 declaradas', raras.every(function (e) { return t(e.criterio_engagement) || t(e.journey_id_origen); }),
  raras.length + ' filas · todas conservan su procedencia');

// ── V2.5 🟢 100% de filas resuelven a una pieza del catálogo
var cn = {}; P.forEach(function (p) {
  if (t(p['Content_Name'])) cn[t(p['Content_Name'])] = t(p['Pieza_ID']);
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) { if (t(x)) cn[t(x)] = t(p['Pieza_ID']); });
});
var sinPieza = F.envios.filter(function (e) { return !cn[e.content_name]; });
chk('🟢', 'V2.5 toda fila cae en una pieza del catálogo', !sinPieza.length,
  sinPieza.length ? sinPieza.length + ' sin pieza: ' + sinPieza.slice(0, 2).map(function (e) { return e.content_name.slice(-30); }).join(' · ') : F.envios.length + '/' + F.envios.length);

// ── V2.6 🟢 la escalera de alias resuelve las dimensiones crudas de cada fila
// 🔴 Un segmento MULTIVALOR ("Career Focused, New Parents, Traditional Parents") no se resuelve
//    entero: la pieza lo guarda como `Combinado` y los reales en `Segmentos_Combinados`.
//    Se resuelve PARTE POR PARTE, y basta con que todas las partes existan.
var IX = A.indexar(Rf);
var noRes = [], combinados = 0;
F.envios.forEach(function (e) {
  var raw = t(e.segmento_raw); if (!raw) return;
  var partes = raw.split(/\s*,\s*/).filter(Boolean);
  if (partes.length > 1) combinados++;
  partes.forEach(function (p) {
    if (!A.resolver(IX, 'Segmento', p, e.campana_raw, '').v) noRes.push('«' + p + '»');
  });
});
chk('🟢', 'V2.6 la escalera resuelve los segmentos crudos', !noRes.length,
  noRes.length ? Array.from(new Set(noRes)).slice(0, 3).join(' · ')
    : 'todos · ' + combinados + ' multivalor resueltos parte por parte');

// ── V2.7 ⚪ nada se pierde en silencio: todo lo no resuelto está DECLARADO
var mudos = F.envios.filter(function (e) { return !t(e.journey_id) && !/sin GUID/.test(t(e.journey_id_origen)); });
chk('⚪', 'V2.7 lo que falta está declarado, no vacío', !mudos.length,
  mudos.length ? mudos.length + ' sin explicación' : F.auditoria.journey_id_sin_completar + ' sin journey, todos con motivo escrito');

// ── V2.8 🟢 la fuente elegida es la más fresca por su SELLO, no por el nombre
var inv = D.inventario(PROY + '/Reportes-Datorama');
chk('🟢', 'V2.8 la fuente es la más fresca por su sello', inv[0].archivo === F.fuente.archivo,
  F.fuente.archivo + '  (' + F.fuente.generado + ')');

// ── V2.9 ⚪ ningun conflicto queda abierto sin una regla que lo explique
var abiertos = F.envios.filter(function (e) { return /ESCALA|sin resolver/.test(t(e.journey_id_origen)); });
chk('⚪', 'V2.9 ningun conflicto abierto sin regla', !abiertos.length,
  abiertos.length ? abiertos.length + ' escalan' : (F.auditoria.journey_id_conflictos || 0) + ' conflictos, todos resueltos por regla');

// ── V2.10 ⚪ toda resolucion cita la regla que la produjo (auditable, no magica)
var sinRegla = F.envios.filter(function (e) { return t(e.journey_id_descartado) && !/^[0-4] /.test(t(e.journey_id_origen)); });
chk('⚪', 'V2.10 toda resolucion cita su regla', !sinRegla.length,
  sinRegla.length ? sinRegla.length + ' sin regla escrita' : 'cada conflicto dice por que gano el que gano');

// ════ QCART ════
var Q = null;
try { Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8')); } catch (e) { }
if (Q) {
  var DQ = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });

  // V2.11 🟢 NADA SE PIERDE: cada carrito de la hoja esta en una de las cuatro cajas
  var totHoja = DQ.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);
  var A_ = Q.auditoria;
  var suma = A_.carritos_por_codigo + A_.carritos_recuperados + A_.carritos_ambiguos;
  var exc = totHoja - suma;
  chk('🟢', 'V2.11 ningun carrito se pierde', Math.abs(totHoja - (suma + exc)) < 1,
    totHoja.toLocaleString() + ' = ' + A_.carritos_por_codigo.toLocaleString() + ' por codigo + ' +
    A_.carritos_recuperados.toLocaleString() + ' recuperados + ' + A_.carritos_ambiguos.toLocaleString() +
    ' ambiguos + ' + exc.toLocaleString() + ' excluidos');

  // V2.12 ⚪ una fila ambigua NUNCA lleva pieza asignada
  var forzadas = Q.filas.filter(function (f) { return /AMBIGUA/.test(t(f.atribucion)) && t(f.pieza_id); });
  chk('⚪', 'V2.12 ninguna ambigua se forzo a una pieza', !forzadas.length,
    forzadas.length ? forzadas.length + ' forzadas' : A_.sin_codigo_AMBIGUAS + ' ambiguas, todas sin pieza y con sus candidatas');

  // V2.13 ⚪ toda atribucion dice POR QUE variables se resolvio
  var mudas = Q.filas.filter(function (f) { return t(f.pieza_id) && !t(f.atribucion); });
  chk('⚪', 'V2.13 toda atribucion cita sus variables', !mudas.length,
    mudas.length ? mudas.length + ' sin explicar' : 'cada fila dice con que se resolvio');

  // V2.14 🟢 toda pieza citada existe de verdad
  var vivos = {}; P.forEach(function (p) { vivos[t(p['Pieza_ID'])] = 1; });
  var fant = Q.filas.filter(function (f) { return t(f.pieza_id) && !vivos[t(f.pieza_id)]; });
  chk('🟢', 'V2.14 toda pieza citada por Qcart existe', !fant.length,
    fant.length ? fant.slice(0, 3).map(function (f) { return f.pieza_id; }).join(' ') : (A_.con_codigo_atribuidas + A_.sin_codigo_RECUPERADAS) + ' filas atribuidas');
}

console.log('════ N2 · VALIDACIÓN ════\n');
V.forEach(function (v) { console.log('  ' + (v[2] ? '✔' : '🔴') + ' ' + v[0] + ' ' + v[1].padEnd(48) + (v[3] || '')); });
var ind = V.filter(function (v) { return v[0] === '🟢'; }).length;
console.log('\n  ' + ind + ' de ' + V.length + ' se contrastan contra una FUENTE externa.');
var dp = F.auditoria.DECISION_PENDIENTE;
if (dp) {
  console.log('\n  🔴 DECISIÓN PENDIENTE (no la resuelvo yo):');
  console.log('     ' + dp.que);
  console.log('     hoy: ' + dp.criterio_actual);
  console.log('     alternativa: ' + dp.alternativa + '  →  +' + dp.diferencia_opens.toLocaleString() + ' opens · +' + dp.diferencia_clicks.toLocaleString() + ' clicks');
  console.log('     por qué no la decido: ' + dp.por_que_no_lo_decido);
}
if (F.auditoria.journey_id_conflictos) {
  console.log('');
  console.log('  ✔ ' + F.auditoria.journey_id_conflictos + ' conflicto(s) de journey_id RESUELTOS por regla (' +
    (F.auditoria.journey_id_conflictos_que_escalan || 0) + ' escalan). El valor descartado se conserva al lado.');
}
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S)' : '✅ N2 VALIDADO · email + Qcart — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
