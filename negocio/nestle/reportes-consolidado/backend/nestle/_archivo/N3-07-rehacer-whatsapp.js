// PUERTA 1 · CORRECCIÓN — rehace Data_WhatsApp con el bloque del lector v2.
//
// 🔴 POR QUÉ HAY QUE REHACERLA. La Puerta 1 escribió 20 filas desde un bloque que estaba mal:
//    el lector leía cada hoja con UN encabezado y las hojas traen tablas apiladas. Entraron
//    cifras corridas (`sends=94` cuando el envío real fue de 162), una tabla de links y seis
//    filas de sesiones de Google Analytics. El lector ya está corregido (v2) y el bloque
//    reconstruido: 13 envíos, Σ 14,643.
//
// 🔴 LAS 6 FILAS QUE YA ESTABAN NO SE TOCAN. Estaban antes de la Puerta 1 — el backup lo prueba —
//    y las 20 que se van son EXCLUSIVAMENTE las que escribí yo. Se comprueba contra el backup
//    ANTES de borrar: si alguna de las que voy a quitar existiera ahí, el script para.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip'), XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var numv = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function serial(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000);
}

console.log('════════ PUERTA 1 · rehacer Data_WhatsApp con el lector v2 ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_warehace.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
console.log('  bloque: lector v' + B.lector + '   ' + B.envios.length + ' envíos   Σ ' + mil(B.auditoria.sends_total));

// ── 1 · QUÉ HABÍA ANTES DE LA PUERTA 1 (el backup manda) ────────────────────────────
var BK = PROY + '/_backups/(Interno)-Reporte-Consolidado-Nestle-2026-v8__2026-08-19_1809_antes-puerta1.xlsx';
if (!fs.existsSync(BK)) { console.log('  🔴 no está el backup previo a la Puerta 1: no puedo probar qué filas eran de antes.'); process.exit(1); }
var TB = os.homedir() + '/_warehacebk.xlsx'; fs.copyFileSync(BK, TB);
var ANTES = XLSX.utils.sheet_to_json(XLSX.readFile(TB).Sheets['Data_WhatsApp'], { defval: '' })
  .filter(function (x) { return t(x['BU']) || t(x['Campaña']); });
console.log('  antes de la Puerta 1 la hoja tenía: ' + ANTES.length + ' filas · Σ ' +
  mil(ANTES.reduce(function (a, x) { return a + numv(x['Sends']); }, 0)));

var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Data_WhatsApp'];
var r = XLSX.utils.decode_range(sh['!ref']);
var cols = [];
for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; cols.push(h ? t(h.v) : ''); }
var AHORA = XLSX.utils.sheet_to_json(sh, { defval: '' })
  .filter(function (x) { return Object.keys(x).some(function (k) { return t(x[k]); }); });
console.log('  ahora tiene:                      ' + AHORA.length + ' filas · Σ ' +
  mil(AHORA.reduce(function (a, x) { return a + numv(x['Sends']); }, 0)));

// las filas conservadas son las primeras ANTES.length; las que se van son el resto
var primeraQueSeVa = ANTES.length + 2;                       // +1 encabezado, +1 base-1
var ultimaFila = r.e.r + 1;
console.log('\n  ── se conservan las filas 2..' + (primeraQueSeVa - 1) + '   ·   se quitan las ' + primeraQueSeVa + '..' + ultimaFila);

// 🔴 la comprobación que impide borrar trabajo ajeno: ninguna fila que voy a quitar puede
//    existir en el backup. Si existiera, sería anterior a la Puerta 1 y no me toca borrarla.
var enBackup = {};
ANTES.forEach(function (x) { enBackup[t(x['Campaña']).toLowerCase() + '¦' + numv(x['Sends'])] = 1; });
var seVan = AHORA.slice(ANTES.length);
var chocan = seVan.filter(function (x) { return enBackup[t(x['Campaña']).toLowerCase() + '¦' + numv(x['Sends'])]; });
if (chocan.length) {
  console.log('  🔴 ' + chocan.length + ' de las filas a quitar YA ESTABAN antes de la Puerta 1. No las borro. PARO.');
  chocan.slice(0, 5).forEach(function (x) { console.log('     ' + t(x['Campaña']) + ' · ' + t(x['Sends'])); });
  process.exit(1);
}
console.log('     ✔ ninguna de las ' + seVan.length + ' que se van estaba antes de la Puerta 1: son todas mías');

// ── 2 · BORRAR ESAS FILAS DEL XML ───────────────────────────────────────────────────
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Data_WhatsApp') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
if (!parte) { console.log('  🔴 no encontré la parte XML de la hoja'); process.exit(1); }
var xml = zip.readAsText(parte);
var borradas = 0;
// 🔴 `[\s\S]`, NO `.`. El punto no cruza saltos de línea, y varias de estas celdas los llevan
//    dentro (`Segmentos` trae «WA-opt-in Cooking⏎WA-opt-in Botanas»). Con `.` la expresión no
//    cerraba en esas filas y sobrevivían 5 de 20 al borrado — sin dar ningún error.
xml = xml.replace(/<row r="(\d+)"[^>]*>[\s\S]*?<\/row>|<row r="(\d+)"[^>]*\/>/g, function (todo, a, b) {
  var n = +(a || b);
  if (n >= primeraQueSeVa) { borradas++; return ''; }
  return todo;
});
console.log('     filas borradas del XML: ' + borradas + ' (debían ser ' + seVan.length + ')' +
  (borradas === seVan.length ? '  ✔' : '  🔴'));
if (borradas !== seVan.length) { console.log('  🔴 no borré las que dije. PARO antes de escribir.'); process.exit(1); }

// ── 3 · ESCRIBIR LOS ENVÍOS QUE FALTAN ──────────────────────────────────────────────
// misma llave que ya se probó: campaña + sends. El segmento NO entra (la hoja guarda el
// canónico y el bloque el crudo; compararlos duplicaba 5,813 sends).
var faltan = B.envios.filter(function (e) { return !enBackup[t(e.campana_raw).toLowerCase() + '¦' + (e.sends || 0)]; });
console.log('\n  ── del bloque hay que escribir ' + faltan.length + ' (los otros ' + (B.envios.length - faltan.length) + ' ya están en las filas conservadas)');
console.log('     cuadre: ' + (B.envios.length - faltan.length) + ' + ' + faltan.length + ' = ' + B.envios.length +
  '  ' + ((B.envios.length - faltan.length) + faltan.length === B.envios.length ? '✔' : '🔴'));

function valorDe(e, columna) {
  switch (columna) {
    case 'BU': return e.bu || '';
    case 'Marca': return e.marca || '';
    case 'Campaña': return e.campana_raw || '';
    case 'Campana_Raw': return e.campana_raw || '';
    case 'Objetivo': return e.objetivo || '';
    case 'Segmento_WA_Raw': return e.segmento_raw || '';
    case 'Canal': return 'WhatsApp';
    case 'Send_Date': return e.fecha ? serial(e.fecha) : '';
    case 'Sends': return e.sends;
    case 'Deliveries': return e.deliveries;
    case 'Opens_Read': return e.opens_read;
    case 'Clicks': return e.clicks;                    // null si no está medido → celda vacía
    case 'Clicks_Medidos': return e.clicks_medidos || '';
    case 'Errores': return e.errores;
    case 'Aud_Original': return e.aud_original;
    case 'Aud_Filtros': return e.aud_filtros;
    case 'Aud_Final': return e.aud_final;
    case 'utm_content': return e.utm_content || '';
    case 'URL': return e.url || '';
    case 'Notas': return [
      e.clicks_nota || '',
      // 🔴 una fecha DERIVADA tiene que verse como derivada en la hoja, no confundirse con
      //    una medida. `fecha_via` lo dice en el bloque; aquí lo dice en la celda que se lee.
      e.fecha_via === 'doc de links de Qcart' ? e.fecha_nota : '',
      e.fecha ? '' : (e.fecha_nota || 'SIN FECHA — no se puede ubicar en ningun periodo'),
      e.pieza_id ? '' : 'sin pieza: ' + (e.motivo_sin_pieza || ''),
      'origen: ' + e.hoja + '!' + e.fila_en_hoja
    ].filter(Boolean).join(' · ');
    default: return '';                                 // las 4 calculadas son de N5
  }
}

// 🔴 EL ESTILO DE CADA COLUMNA, TOMADO DE UNA FILA QUE YA EXISTE.
//    Sin esto, `Send_Date` sale mitad «2/6/26» y mitad «46175»: una celda de fecha sin su
//    `s="N"` es un número de 5 cifras a la vista, aunque el valor sea correcto. No lo detecta
//    ninguna suma — se ve mirando el render, y quien abre la hoja lo ve de inmediato.
//    Se lee de una fila real en vez de clavar índices: si mañana cambian los estilos, sigue bien.
var estiloDe = {};
(function () {
  for (var f = 2; f <= ANTES.length + 1; f++) {
    cols.forEach(function (nom, i) {
      if (estiloDe[i] !== undefined) return;
      var m = new RegExp('<c r="' + col(i) + f + '"([^>]*)').exec(xml);
      if (!m) return;
      var s = /\ss="(\d+)"/.exec(m[1]);
      if (s) estiloDe[i] = s[1];
    });
  }
})();
function celdaXml(ref, v, iCol) {
  var st = estiloDe[iCol] !== undefined ? ' s="' + estiloDe[iCol] + '"' : '';
  if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
  return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
}
console.log('     estilos heredados de las filas que ya estaban: ' + Object.keys(estiloDe).length + ' de ' + cols.length + ' columnas');

var base = primeraQueSeVa - 1;
var filasXml = faltan.map(function (e, k) {
  var fila = base + 1 + k;
  var celdas = cols.map(function (nom, i) {
    if (!nom) return '';
    var v = valorDe(e, nom);
    if (v === null || v === undefined || v === '') return '';
    return celdaXml(col(i) + fila, v, i);
  }).filter(Boolean).join('');
  return '<row r="' + fila + '">' + celdas + '</row>';
}).join('');

// ── 3b · MANDA LA FUENTE: corregir las celdas de las filas CONSERVADAS ──────────────
//
// 🔴 Decisión de Rick (19-ago-2026). Donde la hoja y la fuente discrepan en algo que la fuente
//    MIDE, se escribe lo de la fuente. El valor viejo NO se borra: se apunta en `Notas`, así que
//    si la decisión se revierte, está el rastro.
//    ⚠ Solo se tocan las columnas que el bloque declara en `corregir`. Las canónicas
//      (`BU_Canonico`, `Campana_Canonica`, `Segmento_Canonico`) no están en la fuente y son de
//      Rick: no hay nada que comparar ahí, y una regla de precedencia sin ese límite se las come.
var deriva = ((B.avisos || []).filter(function (a) { return a.tipo === 'deriva_hoja_vs_fuente'; })[0] || {}).filas || [];
var corregidas = 0;
console.log('\n  ── manda la FUENTE: ' + deriva.length + ' fila(s) con algo que corregir');
deriva.forEach(function (d) {
  // localizar la fila conservada por campaña + sends (las conservadas son las 2..ANTES.length+1)
  var iFila = -1;
  for (var k = 0; k < ANTES.length; k++) {
    if (t(ANTES[k]['Campaña']).toLowerCase() === t(d.campana).toLowerCase() && numv(ANTES[k]['Sends']) === d.sends) { iFila = k + 2; break; }
  }
  if (iFila < 0) { console.log('     ⚠ ' + d.campana + ' · ' + d.sends + ' no está entre las conservadas: la escribe el append, ya con el valor bueno'); return; }
  var notas = [];
  d.corregir.forEach(function (c) {
    if (c.valor_fuente === null || c.valor_fuente === undefined) return;
    var iCol = cols.indexOf(c.columna);
    if (iCol < 0) { console.log('     🔴 la hoja no tiene la columna ' + c.columna); return; }
    var ref = col(iCol) + iFila;
    var v = c.columna === 'Send_Date' ? serial(c.valor_fuente) : c.valor_fuente;
    // 🔴 el estilo de la celda que se reemplaza se CONSERVA. Corregir el VALOR no debe cambiar
    //    cómo se VE: sin esto, una fecha corregida se muestra como el número 46175 al lado de
    //    otra que dice «2/6/26», y la columna queda a medias.
    var mAnt = new RegExp('<c r="' + ref + '"([^>]*)').exec(xml);
    var sAnt = mAnt ? (/\ss="(\d+)"/.exec(mAnt[1]) || [])[1] : undefined;
    var st = sAnt !== undefined ? ' s="' + sAnt + '"'
      : (estiloDe[iCol] !== undefined ? ' s="' + estiloDe[iCol] + '"' : '');
    var nueva = (typeof v === 'number' && isFinite(v))
      ? '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>'
      : '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t>' + esc(v) + '</t></is></c>';
    var rx = new RegExp('<c r="' + ref + '"([^>]*)>[\\s\\S]*?</c>');
    if (rx.test(xml)) xml = xml.replace(rx, nueva);
    else if (new RegExp('<c r="' + ref + '"[^>]*/>').test(xml)) xml = xml.replace(new RegExp('<c r="' + ref + '"[^>]*/>'), nueva);
    else xml = xml.replace(new RegExp('(<row r="' + iFila + '"[^>]*>)'), '$1' + nueva);
    notas.push(c.columna + ' decia ' + (c.valor_hoja === null ? '(vacio)' : c.valor_hoja) + ', la fuente dice ' + c.valor_fuente);
    corregidas++;
    console.log('     fila ' + iFila + '  ' + c.columna.padEnd(12) + String(c.valor_hoja) + '  →  ' + String(c.valor_fuente));
  });
  // el rastro, para que el valor viejo no se pierda
  if (notas.length) {
    var iN = cols.indexOf('Notas');
    if (iN >= 0) {
      var refN = col(iN) + iFila;
      var texto = 'Corregido con la fuente (manda la fuente, 19-ago-2026): ' + notas.join(' · ') + '.';
      var nuevaN = '<c r="' + refN + '" t="inlineStr"><is><t>' + esc(texto) + '</t></is></c>';
      var rxN = new RegExp('<c r="' + refN + '"([^>]*)>[\\s\\S]*?</c>');
      if (rxN.test(xml)) xml = xml.replace(rxN, nuevaN);
      else if (new RegExp('<c r="' + refN + '"[^>]*/>').test(xml)) xml = xml.replace(new RegExp('<c r="' + refN + '"[^>]*/>'), nuevaN);
      else xml = xml.replace(new RegExp('(<row r="' + iFila + '"[^>]*>)'), '$1' + nuevaN);
    }
  }
});
console.log('     celdas corregidas: ' + corregidas);

if (xml.indexOf('</sheetData>') < 0) { console.log('  🔴 no encontré </sheetData>'); process.exit(1); }
xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + (base + faltan.length) + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));

// ── 4 · RELEER: lo escrito y lo que quedó ───────────────────────────────────────────
var wb2 = XLSX.readFile(SECO);
var F = XLSX.utils.sheet_to_json(wb2.Sheets['Data_WhatsApp'], { defval: '' })
  .filter(function (x) { return Object.keys(x).some(function (k) { return t(x[k]); }); });
var sumaF = F.reduce(function (a, x) { return a + numv(x['Sends']); }, 0);
console.log('\n  ── releído: ' + F.length + ' filas   Σ sends ' + mil(sumaF));
console.log('     esperado: ' + B.envios.length + ' filas   Σ ' + mil(B.auditoria.sends_total) +
  '   ' + (F.length === B.envios.length && sumaF === B.auditoria.sends_total ? '✔' : '🔴'));
console.log('     las ' + ANTES.length + ' filas previas siguen: ' +
  (ANTES.every(function (o) {
    return F.some(function (n) { return numv(n['Sends']) === numv(o['Sends']) && t(n['Campaña']) === t(o['Campaña']); });
  }) ? '✔' : '🔴'));
var mal = F.filter(function (x) { return /^no/i.test(t(x['Clicks_Medidos'])) && t(x['Clicks']) !== ''; });
console.log('     con «no medido» y un número en Clicks: ' + mal.length + (mal.length ? '  🔴' : '  ✔'));

// 🔴 releer la CORRECCIÓN, no confiar en haberla escrito: toda fecha de la hoja tiene que ser
//    la del bloque. Y no basta con que ya no diga lo viejo — tiene que decir lo nuevo.
function aIso2(s) { var n = numv(s); return n ? new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10) : null; }
var pendientes = 0, sinFechaEnHoja = 0;
F.forEach(function (fila) {
  var cand = B.envios.filter(function (e) { return t(e.campana_raw).toLowerCase() === t(fila['Campaña']).toLowerCase() && (e.sends || 0) === numv(fila['Sends']); });
  var e = cand.filter(function (x) { return x.opens_read === numv(fila['Opens_Read']); })[0] || (cand.length === 1 ? cand[0] : null);
  if (!e) return;
  if (!t(fila['Send_Date'])) sinFechaEnHoja++;
  if (e.fecha && aIso2(fila['Send_Date']) !== e.fecha) {
    pendientes++;
    console.log('     🔴 ' + t(fila['Campaña']) + ' ' + t(fila['Sends']) + ': la hoja dice ' + aIso2(fila['Send_Date']) + ' y la fuente ' + e.fecha);
  }
});
console.log('     toda fecha de la hoja == la del bloque: ' + (pendientes ? '🔴 ' + pendientes + ' sin corregir' : '✔'));
console.log('     filas sin fecha en la hoja: ' + sinFechaEnHoja + (sinFechaEnHoja ? '  ⚠' : '  ✔'));
var conRastro = F.filter(function (x) { return /Corregido con la fuente/.test(t(x['Notas'])); }).length;
var conDerivada = F.filter(function (x) { return /ACTIVACION del link/.test(t(x['Notas'])); }).length;
console.log('     filas con el rastro de la corrección: ' + conRastro + '   ·   con la fecha declarada como derivada: ' + conDerivada);
F.forEach(function (x) {
  console.log('     ' + t(x['Campaña']).padEnd(16) + String(t(x['Send_Date']) || '🔴 sin fecha').padEnd(12) +
    String(t(x['Sends'])).padStart(6) + ' env   ' + String(t(x['Opens_Read'])).padStart(6) + ' read');
});
console.log('\n  archivo listo en: ' + SECO);
console.log('  ⚠ NO se copió al original todavía.');
