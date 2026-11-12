// PASO 6 · VALIDACIÓN — releyendo DEL ARCHIVO. Que yo lo haya escrito no prueba que esté ahí.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
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
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
var T = os.homedir() + '/_p6v.xlsx'; fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'] || {}, { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'] || {}, { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (r) { return t(r['Email_Content_Name']); });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (r) { return t(r['Campaña']); });
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

chk('las 2 hojas del catálogo existen', !!(wb.Sheets['Catalogo_Piezas'] && wb.Sheets['Catalogo_Referencias']), wb.SheetNames.length + ' hojas');
chk('Catalogo_Links ya no está', wb.SheetNames.indexOf('Catalogo_Links') < 0, '');
var DEBEN = ['Report_Mensual', 'Report_Resumen', 'Report_CompletoQcart', 'Report_Insights_Operativo', 'Data_Email', 'Data_Qcart', 'Data_WhatsApp', 'Catalog_Campanas', 'Soporte_IA_Qcart_Productos', 'Soporte_IA_Stage_Carts', 'Soporte_IA_Stage_Products', 'Procesos-Rick', 'Report_Campana_Mes'];
chk('las 13 hojas de trabajo siguen', DEBEN.every(function (h) { return wb.SheetNames.indexOf(h) >= 0; }), DEBEN.filter(function (h) { return wb.SheetNames.indexOf(h) < 0; }).join(', ') || 'todas');
chk('filas de Piezas', P.length === cat.piezas.length, P.length + ' vs ' + cat.piezas.length + ' del JSON');
chk('Pieza_ID únicos', new Set(P.map(function (r) { return t(r['Pieza_ID']); })).size === P.length, '');
chk('Σ Sends == fuentes', P.reduce(function (a, r) { return a + num(r['Sends']); }, 0) ===
  E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0) + WA.reduce(function (a, r) { return a + num(r['Sends']); }, 0),
  P.reduce(function (a, r) { return a + num(r['Sends']); }, 0).toLocaleString());
chk('Σ Carritos_Total', P.reduce(function (a, r) { return a + num(r['Carritos_Total']); }, 0) === 1636,
  P.reduce(function (a, r) { return a + num(r['Carritos_Total']); }, 0) + ' (esperado 1636)');
var OBL = ['Pieza_ID', 'Camp_ID', 'Journey_ID', 'BU', 'Marca', 'Campaña', 'Objetivo', 'Touchpoint', 'Segmento', 'Canal', 'Tipo_Envio', 'Fuente_Dato', 'Tiene_Qcart'];
var vac = OBL.filter(function (c) { return P.some(function (r) { return !t(r[c]); }); });
chk('las 13 obligatorias sin vacíos', !vac.length, vac.join(', ') || '100%');
var d = { BU: {}, Marca: {}, 'Campaña': {}, Objetivo: {}, Segmento: {}, Touchpoint: {} };
P.forEach(function (r) { Object.keys(d).forEach(function (k) { if (t(r[k])) d[k][t(r[k])] = 1; }); });
var nn = Object.keys(d), cr = [];
for (var a = 0; a < nn.length; a++) for (var b = a + 1; b < nn.length; b++) Object.keys(d[nn[a]]).forEach(function (x) { if (d[nn[b]][x]) cr.push(x); });
chk('nada mezclado entre dimensiones', !cr.length, cr.join(' · '));
var codsX = {}, dupX = [];
P.forEach(function (r) { for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { var v = t(r[c + i]); if (!v) return; if (codsX[v]) dupX.push(v); codsX[v] = 1; }); });
chk('sin código de Qcart duplicado', !dupX.length, Object.keys(codsX).length + ' códigos escritos');
chk('filas de Referencias', R.length === 252, R.length);
chk('Referencias con Tipo siempre', R.every(function (r) { return t(r['Tipo']); }), '');
var pend = R.filter(function (r) { return t(r['Tipo']) === 'pendiente'; });
chk('todo pendiente con motivo', pend.every(function (r) { return t(r['Notas']); }), pend.length + ' pendientes');
chk('toda pieza con Qcart trae fuente', P.filter(function (r) { return t(r['Tiene_Qcart']) === 'Sí'; }).every(function (r) { return t(r['Fuente_Qcart']); }),
  P.filter(function (r) { return t(r['Tiene_Qcart']) === 'Sí'; }).length + ' piezas');

console.log('══ PASO 6 · VALIDACIÓN (releída del archivo) ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(36) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S)' : '✅ PASO 6 CERRADO · ' + V.length + ' validaciones'));
process.exit(fallo ? 1 : 0);
