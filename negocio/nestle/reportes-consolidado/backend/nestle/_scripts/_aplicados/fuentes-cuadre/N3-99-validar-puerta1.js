// PUERTA 1 · ¿QUEDÓ BIEN? — se relee el ARCHIVO EN DISCO, no la memoria.
//
// «Lo escribí» y «quedó bien» son cosas distintas. Todo lo de aquí sale de volver a abrir el
// workbook real y comparar contra los bloques y contra el backup.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ PUERTA 1 · ¿QUEDÓ BIEN? ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_fin.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
// 🔴 NO se clava el nombre del backup: incluye la version del libro y la fecha, asi que el dia
//    que Rick guarde una v9 este check apunta a un archivo que ya no existe. Se BUSCA el backup
//    'antes-puerta1' mas reciente, sea de la version que sea.
var BK = (function () {
  var d = PROY + '/_backups';
  var c = fs.existsSync(d) ? fs.readdirSync(d).filter(function (f) { return /antes-puerta1.*\.xlsx$/i.test(f); }) : [];
  if (!c.length) { console.log('  ⚠ no hay backup «antes-puerta1» en _backups: los checks que comparan contra el ANTES no se pueden correr.'); return null; }
  c.sort(function (a, b) { return fs.statSync(d + '/' + b).mtimeMs - fs.statSync(d + '/' + a).mtimeMs; });
  return d + '/' + c[0];
})();
if (!BK) { console.log('\n  🔴 sin backup de referencia — se aborta en vez de dar un verde que no se probo.'); process.exit(1); }
var TB = os.homedir() + '/_finbk.xlsx';
fs.copyFileSync(BK, TB);
var wbB = XLSX.readFile(TB);
function cargar(n) { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); }
var B = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp'), manual: cargar('manual') };

console.log('  archivo: ' + vivo.archivo + '   ' + Math.round(fs.statSync(vivo.ruta).size / 1024) + ' KB');
console.log('  backup : ' + Math.round(fs.statSync(BK).size / 1024) + ' KB\n');

// ══ 1 · NINGUNA HOJA SE PERDIÓ ══════════════════════════════════════════════════════
var antes = wbB.SheetNames, ahora = wb.SheetNames;
var perdidas = antes.filter(function (h) { return ahora.indexOf(h) < 0; });
var nuevas = ahora.filter(function (h) { return antes.indexOf(h) < 0; });
console.log('══ hojas ══');
console.log('     antes ' + antes.length + ' → ahora ' + ahora.length);
console.log('     nuevas: ' + (nuevas.join(' · ') || 'ninguna'));
// 🔴 DOS HOJAS SE RETIRARON A PROPÓSITO, y una hoja retirada por decisión no es una hoja
//    perdida. `Catalog_Campanas` y `Data_Qcart` las quitó Rick (19 y 20-ago-2026). Lo que el
//    check tiene que impedir es que desaparezca una hoja que NADIE decidió quitar.
var RETIRADAS = { 'Catalog_Campanas': 'sustituida por Catalogo_Piezas + Catalogo_Referencias (Rick, 19-ago)',
  'Data_Qcart': 'sustituida por Data_Qcart_Carritos + _Productos (Rick, 20-ago)' };
var sinDecidir = perdidas.filter(function (h) { return !RETIRADAS[h]; });
chk('ninguna hoja desapareció SIN que alguien lo decidiera', sinDecidir.length === 0,
  sinDecidir.length ? '🔴 ' + sinDecidir.join(' · ')
    : perdidas.length ? perdidas.length + ' retirada(s) a propósito: ' + perdidas.map(function (h) { return h + ' — ' + RETIRADAS[h]; }).join(' · ')
      : antes.length + '/' + antes.length + ' siguen');
chk('se crearon las 2 hojas de Qcart', nuevas.length === 2, nuevas.join(' · '));

// ══ 2 · DATA_EMAIL ══════════════════════════════════════════════════════════════════
console.log('\n══ Data_Email ══');
var shE = wb.Sheets['Data_Email'];
var E = XLSX.utils.sheet_to_json(shE, { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var sE = E.reduce(function (a, x) { return a + num(x['Email_Sends']); }, 0);
var dE = E.reduce(function (a, x) { return a + num(x['Email_Deliveries']); }, 0);
var dB = B.email.envios.reduce(function (a, e) { return a + e.email_deliveries; }, 0);
console.log('     filas ' + E.length + '   Σ sends ' + mil(sE) + '   Σ deliveries ' + mil(dE));
// CONSTANTE → INVARIANTE: «264» caduca en cuanto entre un envio. Lo que NO caduca es que la
//   hoja tenga exactamente una fila por envio del bloque.
chk('Data_Email tiene una fila por envio del bloque', E.length === B.email.envios.length,
  E.length + ' filas = ' + B.email.envios.length + ' envios del bloque');
chk('Σ sends igual al bloque', sE === B.email.auditoria.sends_total, mil(sE) + ' = ' + mil(B.email.auditoria.sends_total));
chk('Σ deliveries ahora igual al bloque', dE === dB, mil(dE) + ' = ' + mil(dB) + '  (las 3 celdas escritas)');

// 🔴 las 277 celdas de Rick
var r = XLSX.utils.decode_range(shE['!ref']), hdr = {};
for (var c = r.s.c; c <= r.e.c; c++) { var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h) hdr[t(h.v)] = c; }
var aMano = 0;
['BU_Canonico', 'Marca', 'Campana_Canonica', 'Segmento_Canonico'].forEach(function (col) {
  var ci = hdr[col]; if (ci === undefined) return;
  for (var i = 1; i <= r.e.r; i++) {
    var cel = shE[XLSX.utils.encode_cell({ r: i, c: ci })];
    if (cel && t(cel.v) !== '' && !cel.f) aMano++;
  }
});
// 🔴 CADUCÓ, Y POR LA MEJOR RAZÓN. Contaba «celdas sin fórmula» para proteger las 277 que
//    Rick escribió a mano. Ahora TODAS las canónicas son valores, así que la cuenta da 1,024
//    y el número 277 dejó de significar nada. Y lo importante ya se comprobó de otra forma:
//    el catálogo no contradice ni una sola de las 293 celdas que él había escrito.
//    Lo que sigue sin poder fallar: que ninguna canónica quede vacía teniendo el catálogo
//    con qué llenarla.
var conPieza = E.filter(function (x) { return t(x['pieza_id']); });
var huecos = conPieza.filter(function (x) { return !t(x['BU_Canonico']) || !t(x['Marca']); });
chk('🔴 ninguna fila anclada quedó sin sus canónicas', huecos.length === 0,
  huecos.length ? '🔴 ' + huecos.length + ' filas con pieza_id y sin canónicas'
    : conPieza.length + ' filas ancladas, todas con sus canónicas · ' + aMano + ' celdas de valor');

// y las fórmulas vivas también
var conFormula = 0;
['BU_Canonico', 'Marca', 'Campana_Canonica', 'Segmento_Canonico'].forEach(function (col) {
  var ci = hdr[col]; if (ci === undefined) return;
  for (var i = 1; i <= r.e.r; i++) { var cel = shE[XLSX.utils.encode_cell({ r: i, c: ci })]; if (cel && cel.f) conFormula++; }
});
// 🔴 caducó: ya no debe quedar NINGUNA fórmula en las canónicas. Ese era justo el problema —
//    779 fórmulas que murieron todas juntas al borrarse la hoja de la que leían.
chk('las canónicas ya NO son fórmulas (son valores, no se rompen)', conFormula === 0,
  conFormula === 0 ? 'cero fórmulas: borrar una hoja ya no puede matarlas' : '🔴 quedan ' + conFormula);

// ══ 3 · LAS DOS HOJAS DE QCART ══════════════════════════════════════════════════════
console.log('\n══ Data_Qcart_Carritos y _Productos ══');
var QC = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart_Carritos'] || {}, { defval: '' });
var QP = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart_Productos'] || {}, { defval: '' });
console.log('     carritos ' + mil(QC.length) + '   productos ' + mil(QP.length));
chk('carritos: todas las filas', QC.length === B.qcart.carritos.length, QC.length + ' = ' + B.qcart.carritos.length);
chk('productos: todas las filas', QP.length === B.qcart.productos.length, QP.length + ' = ' + B.qcart.productos.length);
var vQC = QC.reduce(function (a, x) { return a + num(x['views']); }, 0);
var vB = B.qcart.carritos.reduce(function (a, e) { return a + e.views; }, 0);
chk('Σ views de carritos cuadra', vQC === vB, mil(vQC) + ' = ' + mil(vB));
chk('toda fila trae su pieza_id', QC.every(function (x) { return t(x['pieza_id']); }), 'las ' + mil(QC.length) + ' ancladas');
// 🔴 ninguna columna calculada
var colsQ = Object.keys(QC[0] || {});
var calc = colsQ.filter(function (c) { return /penetr|ticket|rate|ctor|pct|promedio/i.test(c); });
chk('🔴 ninguna columna calculada en las hojas nuevas', calc.length === 0, calc.length ? '🔴 ' + calc.join(', ') : colsQ.length + ' columnas, todas crudas');

// Data_Qcart intacta
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' }).filter(function (x) { return t(x['Brand']) || t(x['Campaign']); });
var QB = XLSX.utils.sheet_to_json(wbB.Sheets['Data_Qcart'], { defval: '' }).filter(function (x) { return t(x['Brand']) || t(x['Campaign']); });
chk('Data_Qcart se retiró por decisión, no por accidente', !wb.Sheets['Data_Qcart'],
  wb.Sheets['Data_Qcart'] ? '⚠ sigue ahí' : 'retirada por Rick el 20-ago-2026 · sustituida por las dos nuevas');

// ══ 4 · DATA_WHATSAPP ═══════════════════════════════════════════════════════════════
console.log('\n══ Data_WhatsApp ══');
var W = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' })
  .filter(function (x) { return Object.keys(x).some(function (k) { return t(x[k]); }); });
var sW = W.reduce(function (a, x) { return a + num(x['Sends']); }, 0);
console.log('     filas ' + W.length + '   Σ sends ' + mil(sW));
chk('Data_WhatsApp tiene los envíos del bloque', W.length === B.whatsapp.envios.length, W.length + ' = ' + B.whatsapp.envios.length);
chk('Σ sends cuadra con el bloque', sW === B.whatsapp.auditoria.sends_total, mil(sW) + ' = ' + mil(B.whatsapp.auditoria.sends_total));
// las 6 originales siguen
var WB6 = XLSX.utils.sheet_to_json(wbB.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['BU']); });
var siguen = WB6.filter(function (o) { return W.some(function (n) { return num(n['Sends']) === num(o['Sends']) && t(n['Campaña']) === t(o['Campaña']); }); });
chk('las 6 filas que ya estaban siguen ahí', siguen.length === WB6.length, siguen.length + '/' + WB6.length);
// 🔴 el click derivado NO se escribió
var noMed = W.filter(function (x) { return /^no/i.test(t(x['Clicks_Medidos'])); });
// ⚠ dos de estas filas venían del sistema viejo con el estimado escrito como número. Se
//   retiraron de la columna Clicks y el valor quedó en Notas: no se pierde, cambia de sitio.
chk('🔴 ningún click derivado se escribió como número',
  noMed.every(function (x) { return t(x['Clicks']) === ''; }),
  noMed.length + ' filas con clicks no medidos · su celda Clicks vacía');

// ══ 5 · EL PAQUETE ══════════════════════════════════════════════════════════════════
console.log('\n══ el archivo ══');
chk('el archivo creció (se escribió de verdad)', fs.statSync(vivo.ruta).size > fs.statSync(BK).size,
  mil(Math.round(fs.statSync(BK).size / 1024)) + ' KB → ' + mil(Math.round(fs.statSync(vivo.ruta).size / 1024)) + ' KB');
chk('el backup sigue disponible para revertir', fs.existsSync(BK), 'en _backups/');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ PUERTA 1 ESCRIBIÓ BIEN — verificado releyendo el archivo en disco'));
process.exit(fallo ? 1 : 0);
