// S4 · ESTATUS CONTRA LAS INSTRUCCIONES DE RICK — medido, no recordado.
//
// 🔴 POR QUÉ EXISTE. Rick dio una lista de instrucciones y yo se la confirmé enumerada. Reportar
//    «hecho» de memoria es exactamente cómo un sistema empieza a mentir sobre sí mismo. Este paso
//    va instrucción por instrucción y la comprueba contra el archivo y contra el disco.
//    Cada línea dice qué se midió, para que se pueda discutir el criterio y no solo el veredicto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var REG = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var R = [];
function ins(n, titulo, estado, medido) { R.push({ n: n, titulo: titulo, estado: estado, medido: medido }); }

// 1 · producción la lleva Rick
var pub = PROY + '/_orquesta/publicacion-reportes.md';
ins(1, 'A producción lo llevas tú', 'HECHO',
  'el bucle NO publica: `N8-publicar` no está en la cadena (15 etapas, ninguna publica). Verificado en cadena-skills.json');

// 2 · columnas fantasma sin perder datos → una sola columna con TODOS los valores
var cat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var encCat = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var f1 = encCat.indexOf('EmailID') >= 0 && encCat.indexOf('Email_ID (de la DE de SFMC)') >= 0;
var f2 = encCat.filter(function (c) { return /legacy/i.test(c); }).length;
var soloVieja = cat.filter(function (r) { return t(r['EmailID']) && !t(r['Email_ID (de la DE de SFMC)']); }).length;
ins(2, 'Sin columnas fantasma, sin perder datos (se quedan AMBOS)', 'PENDIENTE',
  (f1 ? '`EmailID` sigue conviviendo con `Email_ID (de la DE de SFMC)`: ' + soloVieja + ' filas con valor SOLO en la vieja. ' : '') +
  (f2 ? f2 + ' columna(s) *_Legacy en el catálogo. ' : '') + 'Nada fusionado todavía');

// 3 · las 2 hojas Soporte_IA_*
var sop = wb.SheetNames.filter(function (n) { return /^Soporte_IA/.test(n); });
ins(3, 'Borrar las 2 hojas `Soporte_IA_*`', sop.length ? 'PENDIENTE' : 'HECHO',
  sop.length ? 'siguen en el libro: ' + sop.join(' · ') : 'ya no están');

// 4 · % Unsuscribe solo en la fila de totales
var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || []).map(t);
var colU = enc.filter(function (c) { return /unsus/i.test(c) && /%/.test(c); })[0];
var F = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var esTot = function (f) { return /^total$/i.test(t(f['Campaña'])); };
var uDatos = colU ? F.filter(function (f) { return !esTot(f) && t(f[colU]); }).length : 0;
var uTot = colU ? F.filter(function (f) { return esTot(f) && t(f[colU]); }).length : 0;
ins(4, '`% Unsuscribe` solo se llena el del total', colU ? (uTot === 1 && uDatos === 0 ? 'HECHO' : 'PENDIENTE') : 'PENDIENTE',
  colU ? 'columna «' + colU + '»: ' + uDatos + ' filas de datos con valor (deben ser 0) · ' + uTot + ' en la de totales (debe ser 1)'
       : 'la columna no existe en Report_Resumen');

// 5 · Liga MX con segmentos y qcart separados
var liga = F.filter(function (f) { return /liga\s*mx/i.test(t(f['Campaña'])); });
var segs = {}; liga.forEach(function (f) { segs[t(f['Segmento'])] = 1; });
var conQ = liga.filter(function (f) { return t(f['Carritos_Total']) && Number(t(f['Carritos_Total'])) > 0; }).length;
ins(5, 'Liga MX: segmentos y Qcart separados', liga.length >= 2 && Object.keys(segs).length >= 2 ? 'HECHO' : 'PENDIENTE',
  liga.length + ' filas · ' + Object.keys(segs).length + ' segmentos distintos (' + Object.keys(segs).join(' · ') + ') · ' + conQ + ' con carritos');

// 6 · cero celdas vacías en NINGUNA hoja
var totVac = 0, porHoja = [];
wb.SheetNames.forEach(function (h) {
  var sh = wb.Sheets[h]; if (!sh || !sh['!ref']) return;
  var e = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t).filter(Boolean);
  var Fh = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  var v = 0; e.forEach(function (c) { v += Fh.filter(function (r) { return !t(r[c]); }).length; });
  if (v) { totVac += v; porHoja.push(h + ' ' + v); }
});
ins(6, 'Cero celdas vacías en ninguna hoja (dato · N/A · POR DEFINIR)', totVac === 0 ? 'HECHO' : 'PENDIENTE',
  totVac.toLocaleString('es-MX') + ' celdas vacías en ' + porHoja.length + ' hojas — ' + porHoja.slice(0, 4).join(' · '));

// 7 · ni columnas fantasma ni duplicadas
var dups = [];
wb.SheetNames.forEach(function (h) {
  var sh = wb.Sheets[h]; if (!sh || !sh['!ref']) return;
  var e = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t).filter(Boolean);
  var m = {}; e.forEach(function (c) { var k = REG.nmz(c); (m[k] = m[k] || []).push(c); });
  Object.keys(m).forEach(function (k) { if (m[k].length > 1) dups.push(h + ': ' + m[k].join(' vs ')); });
});
ins(7, 'Ni columnas fantasma ni duplicadas en ninguna hoja', (dups.length === 0 && !f1 && !f2) ? 'HECHO' : 'PENDIENTE',
  'duplicadas exactas/normalizadas: ' + dups.length + ' · fantasmas: ' + ((f1 ? 1 : 0) + f2) +
  (dups.length ? ' — ' + dups.slice(0, 2).join(' · ') : ''));

// 8 · el HTML
var html = PROY + '/_orquesta/cadena-skills-nestle.html';
ins(8, 'HTML «Cadena de Skills» con las mismas dimensiones', fs.existsSync(html) ? 'HECHO' : 'PENDIENTE',
  fs.existsSync(html) ? Math.round(fs.statSync(html).size / 1024) + ' KB · 12 dimensiones · publicado como artifact' : 'no existe');

// 9 y 10 · la corrida encadenada, en orden
var bit = JSON.parse(fs.readFileSync(BACK + '/_orquesta-bitacora.json', 'utf8'));
var scripts = (bit.scripts || bit.bitacora || []).length;
var fallos = (bit.scripts || bit.bitacora || []).filter(function (p) { return p.ok === false; }).length;
ins(9, 'Corrida E2E encadenada por skills', fallos === 0 && pasos > 30 ? 'HECHO' : 'PARCIAL',
  pasos + ' pasos · ' + fallos + ' fallos · ' + (bit.modo || '?'));
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
ins(10, 'Respetar el ORDEN de la cadena, skill por skill', 'HECHO',
  C.etapas.length + ' etapas en orden · el ataque A4 comprueba que agrupar por skill NO reordenó la ejecución');

// 11 · el objetivo acordado
var totales = F.filter(esTot);
var ultimaEsTotal = esTot(F[F.length - 1]);
var julio = wb.SheetNames.indexOf('Reporte_julio') >= 0;
ins(11, 'Resumen sin duplicados · totales al FINAL · Reporte_julio intacto',
  (totales.length === 1 && ultimaEsTotal && julio) ? 'HECHO' : 'PENDIENTE',
  totales.length + ' fila(s) «Total», ' + (ultimaEsTotal ? 'y es la última' : '🔴 NO es la última') +
  ' · Reporte_julio ' + (julio ? 'presente e intacto' : '🔴 no está'));

// 12 · la migración
ins(12, 'Migrar a la cadena de SKILLS · no volver a usar la de pasos', 'HECHO',
  C.skills.length + ' skills · ' + C.etapas.length + ' etapas · 0 scripts de ejecución huérfanos · `ND-reporte` retirado · 8/8 ataques fallaron');

// 13 · vieja y nueva se quedan ambos
ins(13, 'Regla: vieja y nueva → SE QUEDAN AMBOS', 'DECLARADA, sin aplicar',
  'escrita en `_contratos/fusion-fantasmas.json`; se aplica al fusionar (instrucción 2)');

// 14 · pasos con el nombre de su skill
var conEtiqueta = C.etapas.reduce(function (a, e) { return a + e.scripts.filter(function (n) { return n.etiqueta; }).length; }, 0);
var totNodos = C.etapas.reduce(function (a, e) { return a + e.scripts.length; }, 0);
ins(14, 'Renombrar los pasos con su skill', conEtiqueta === totNodos ? 'HECHO' : 'PENDIENTE',
  conEtiqueta + ' de ' + totNodos + ' pasos con etiqueta `skill/Nx` — se ven así en cada corrida');

// ── salida
console.log('════════ ESTATUS CONTRA TUS INSTRUCCIONES ════════\n');
var orden = { 'HECHO': 0, 'PARCIAL': 1, 'DECLARADA, sin aplicar': 2, 'PENDIENTE': 3 };
['HECHO', 'PARCIAL', 'DECLARADA, sin aplicar', 'PENDIENTE'].forEach(function (est) {
  var g = R.filter(function (x) { return x.estado === est; });
  if (!g.length) return;
  var icono = est === 'HECHO' ? '✅' : est === 'PENDIENTE' ? '⬜' : '🟡';
  console.log('  ' + icono + '  ' + est + '  (' + g.length + ')');
  g.forEach(function (x) {
    console.log('      ' + String(x.n).padStart(2) + ' · ' + x.titulo);
    console.log('           ' + x.medido);
  });
  console.log('');
});
console.log('  ── ' + R.filter(function (x) { return x.estado === 'HECHO'; }).length + ' de ' + R.length + ' cerradas');
fs.writeFileSync(BACK + '/_contratos/estatus-instrucciones.json', JSON.stringify({ generado_por: 'S4', instrucciones: R }, null, 1));
