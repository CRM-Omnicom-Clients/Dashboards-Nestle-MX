/*
 * paid.crear-catalogo-plantilla.js — LA PLANTILLA DEL CATÁLOGO DE PAID MEDIA, para el equipo.
 *
 * 🔴 QUÉ DECIDIÓ RICK (21-sep-2026), y por eso esto es UNA hoja y no cuatro:
 *      · una fila = una campaña (una audiencia por campaña; se ajusta con el equipo si no)
 *      · `Objetivo_Plataforma` y `Objetivo_Negocio`, así, los dos
 *      · `Segmento_Canonico` se queda — es la ÚNICA columna que deja comparar Paid contra CRM
 *      · nombre / origen / tipo de audiencia, declarados por separado
 *      · Qcart se integra en este mismo catálogo
 *      · nada de hoja de Referencias por ahora: «el catálogo saldrá en el proceso»
 *
 * 🔴 POR QUÉ NO ES UNA HOJA DE RESULTADOS. Aquí NO van inversión, impresiones, clics, CPC, CTR ni
 *    carritos. El catálogo declara lo que una campaña ES; las métricas las miden las plataformas y
 *    Qcart. Si le pides métricas al equipo las va a llenar a mano y van a competir con la fuente —
 *    y cuando dos números del mismo dato conviven, gana el que se lea primero.
 *
 * 🔴 POR QUÉ RECETA_1..3 Y NO UNA CELDA CON TODO SEPARADO POR «·». Tres listas paralelas (recetas,
 *    shortlinks, retailers) se leen POR POSICIÓN, y leer por posición es lo que ya mandó 171
 *    carritos de Cooking a Botana en el reporte de CRM: bastó que un par viniera invertido. Con
 *    bloques nombrados, `Shortlink_Qcart_2` solo puede ser el de `Receta_2`. El precio es que topa
 *    en 3 — si una campaña trae más, se agrega el bloque 4; NO se meten dos en la misma celda.
 *
 * 🔴 SE ESCRIBE CON XML, NO CON `XLSX.writeFile` PARA LOS ESTILOS. Aquí el archivo nace de cero, así
 *    que SheetJS puede armar la tabla sin destruir nada; el formato, las listas desplegables y los
 *    mensajes de ayuda se inyectan después por XML, que es lo único que Excel respeta.
 *
 *   node paid.crear-catalogo-plantilla.js            (seco: enseña las columnas)
 *   node paid.crear-catalogo-plantilla.js --escribir (crea el .xlsx)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var DESTINO = ENT.PROYECTO + '/Catalogo-Paid-Media-2026-PLANTILLA.xlsx';
var HOJA = 'Catalogo_Campanas_Paid';

/* ══ LAS COLUMNAS ═══════════════════════════════════════════════════════════════════════════════
 * `quien`  : 'equipo' lo llena Paid · 'sistema' lo ponemos nosotros (nace vacío)
 * `lista`  : vocabulario cerrado → desplegable en Excel
 * `ayuda`  : el mensaje que Excel muestra al pararse en la celda. Aquí vive la regla, porque una
 *            regla en un LÉEME aparte es una regla que nadie lee al llenar. */
var COLS = [
  { n: 'Campana_ID', w: 13, quien: 'sistema', ej: '',
    ayuda: 'Lo asignamos nosotros al integrar. Déjalo vacío.' },
  { n: 'Plataforma', w: 12, quien: 'equipo', lista: ['Meta', 'TikTok', 'Google', 'Rappi'], ej: 'Meta',
    ayuda: 'Dónde corrió la campaña. Una campaña vive en UNA plataforma.' },
  { n: 'Nombre_Campana_Plataforma', w: 46, quien: 'equipo', ej: 'MX_NES_RN_ANTOJO-INFINITO_CONV_MET_SEP26',
    ayuda: 'LA LLAVE. Cópialo y pégalo del export de la plataforma, tal cual, sin corregir ni acortar. Es lo que une esta fila con los resultados.' },
  { n: 'Nombres_Variantes', w: 30, quien: 'equipo', ej: 'N/A',
    ayuda: 'Si la campaña se renombró a media vuelta, el nombre ANTERIOR va aquí. Varios se separan con " · ". Si no hubo, escribe N/A.' },
  { n: 'BU', w: 10, quien: 'equipo', lista: ['RN', 'Nescafé', 'Purina'], ej: 'RN',
    ayuda: 'Unidad de negocio.' },
  { n: 'Marca', w: 16, quien: 'equipo', ej: 'La Lechera',
    ayuda: 'Marca. Si son varias, se separan con coma (ej. "Carnation, La Lechera").' },
  { n: 'Campana', w: 20, quien: 'equipo', ej: 'Antojo Infinito',
    ayuda: 'El nombre de la campaña como la conoce el negocio — NO el de la plataforma y NO la marca.' },
  { n: 'Objetivo_Negocio', w: 18, quien: 'equipo', lista: ['Purchase', 'Inspiration', 'Loyalty', 'Awareness', 'Consideration', 'POR DEFINIR'], ej: 'Purchase',
    ayuda: 'Para qué se hizo, en nuestro lenguaje. Es el que permite comparar contra CRM.' },
  { n: 'Objetivo_Plataforma', w: 20, quien: 'equipo', lista: ['Conversiones', 'Tráfico', 'Alcance', 'Reconocimiento', 'Interacción', 'Video', 'Catálogo', 'POR DEFINIR'], ej: 'Conversiones',
    ayuda: 'El objetivo que se eligió DENTRO de la plataforma. No es el mismo que el de negocio: éste decide cómo optimiza y cómo cobra Meta/TikTok/Google.' },
  { n: 'Segmento_Canonico', w: 22, quien: 'equipo', ej: 'Career Focused',
    ayuda: 'El segmento traducido al MISMO vocabulario que usa CRM (Career Focused, Traditional Parents, New Parents...). No es el nombre de la audiencia. Si no corresponde a ninguno, escribe N/A.' },
  { n: 'Audiencia_Nombre', w: 34, quien: 'equipo', ej: 'LAL2_Compradores_LaLechera_90d',
    ayuda: 'El nombre de la audiencia tal como aparece en la CDP, Audience Console o Rappi.' },
  { n: 'Audiencia_Origen', w: 18, quien: 'equipo', lista: ['CDP', 'Audience Console', 'Rappi'], ej: 'CDP',
    ayuda: 'De dónde salió la audiencia.' },
  { n: 'Audiencia_Tipo', w: 14, quien: 'equipo', lista: ['Semilla', 'Look a Like'], ej: 'Look a Like',
    ayuda: 'Semilla = la audiencia original. Look a Like = derivada de una semilla.' },
  { n: 'Audiencia_Semilla_De', w: 30, quien: 'equipo', ej: 'Compradores_LaLechera_90d',
    ayuda: 'SOLO si es Look a Like: el nombre de la semilla de la que salió. No se deduce del nombre — decláralo. Si es Semilla, escribe N/A.' },
  { n: 'Audiencia_Tamano', w: 18, quien: 'equipo', ej: 1240000,
    ayuda: 'Cuántos perfiles tenía la audiencia. Solo el número, sin comas ni texto.' },
  { n: 'Fecha_Inicio', w: 13, quien: 'equipo', ej: '2026-09-01',
    ayuda: 'Primer día que corrió. Formato AAAA-MM-DD.' },
  { n: 'Fecha_Fin', w: 13, quien: 'equipo', ej: '2026-09-30',
    ayuda: 'Último día que corrió. Formato AAAA-MM-DD. Si sigue activa, escribe POR DEFINIR.' },
  { n: 'Tiene_Qcart', w: 12, quien: 'equipo', lista: ['Sí', 'No'], ej: 'Sí',
    ayuda: '¿La campaña llevaba a un carrito de Qcart?' },
  { n: 'Receta_1', w: 26, quien: 'equipo', ej: 'Carlota ligera de limón',
    ayuda: 'Nombre de la receta, igual que en el maestro de Qcart.' },
  { n: 'URL_Receta_1', w: 40, quien: 'equipo', ej: 'https://www.recetasnestle.com.mx/recetas/carlota-ligera-limon',
    ayuda: 'El link de la receta.' },
  { n: 'Shortlink_Qcart_1', w: 34, quien: 'equipo', ej: 'recetasnestlmx.qcart.app/PySVWRVY',
    ayuda: 'LA LLAVE DE QCART. Es el shortlink, no el utm: los utm vienen invertidos en parte de las filas y mandan los carritos al segmento equivocado.' },
  { n: 'Retailer_1', w: 14, quien: 'equipo', lista: ['Walmart', 'Chedraui', 'Amazon', 'Soriana', 'La Comer', 'Rappi'], ej: 'Walmart',
    ayuda: 'A qué retailer apunta ese carrito.' },
  { n: 'Receta_2', w: 26, quien: 'equipo', ej: 'N/A', ayuda: 'Segunda receta, si la hay. Si no, N/A.' },
  { n: 'URL_Receta_2', w: 40, quien: 'equipo', ej: 'N/A', ayuda: 'Si no hay segunda receta, N/A.' },
  { n: 'Shortlink_Qcart_2', w: 34, quien: 'equipo', ej: 'N/A', ayuda: 'Si no hay segunda receta, N/A.' },
  { n: 'Retailer_2', w: 14, quien: 'equipo', lista: ['Walmart', 'Chedraui', 'Amazon', 'Soriana', 'La Comer', 'Rappi', 'N/A'], ej: 'N/A', ayuda: 'Si no hay segunda receta, N/A.' },
  { n: 'Receta_3', w: 26, quien: 'equipo', ej: 'N/A', ayuda: 'Tercera receta, si la hay. Si una campaña trae MÁS de tres, avísanos y agregamos el bloque 4 — no metas dos en la misma celda.' },
  { n: 'URL_Receta_3', w: 40, quien: 'equipo', ej: 'N/A', ayuda: 'Si no hay tercera receta, N/A.' },
  { n: 'Shortlink_Qcart_3', w: 34, quien: 'equipo', ej: 'N/A', ayuda: 'Si no hay tercera receta, N/A.' },
  { n: 'Retailer_3', w: 14, quien: 'equipo', lista: ['Walmart', 'Chedraui', 'Amazon', 'Soriana', 'La Comer', 'Rappi', 'N/A'], ej: 'N/A', ayuda: 'Si no hay tercera receta, N/A.' },
  { n: 'Fecha_Activacion_Qcart', w: 24, quien: 'equipo', ej: '2026-09-01',
    ayuda: 'Cuándo se activó el shortlink, según el maestro de Qcart. AAAA-MM-DD.' },
  { n: 'Fecha_Termino_Qcart', w: 21, quien: 'equipo', ej: '2026-09-30',
    ayuda: 'Cuándo dejó de estar activo. AAAA-MM-DD.' },
  { n: 'Medio_Qcart', w: 14, quien: 'equipo', lista: ['Meta', 'TikTok', 'Google', 'Rappi', 'N/A'], ej: 'Meta',
    ayuda: 'El "medio" que declara el maestro de Qcart. Sirve para cruzar contra Plataforma: si no coinciden, uno de los dos está mal y hay que mirarlo.' },
  { n: 'Estado', w: 14, quien: 'equipo', lista: ['Activa', 'Finalizada', 'Pausada', 'Cancelada', 'POR DEFINIR'], ej: 'Activa',
    ayuda: 'En qué va la campaña.' },
  { n: 'Notas', w: 34, quien: 'equipo', ej: 'N/A',
    ayuda: 'Cualquier cosa que haya que saber para leer esta fila. Si no hay nada, N/A.' }
];

function col(i) { var s = '', n = i + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

console.log('════════ PLANTILLA · CATÁLOGO DE PAID MEDIA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  hoja: ' + HOJA + '   ·   ' + COLS.length + ' columnas   ·   1 fila de ejemplo');
console.log('  la llena el equipo: ' + COLS.filter(function (c) { return c.quien === 'equipo'; }).length +
  '   ·   la ponemos nosotros: ' + COLS.filter(function (c) { return c.quien === 'sistema'; }).length);
console.log('  con lista cerrada: ' + COLS.filter(function (c) { return c.lista; }).length + '\n');
COLS.forEach(function (c, i) {
  console.log('  ' + col(i).padStart(3) + '  ' + c.n.padEnd(26) + (c.quien === 'sistema' ? '🔧 sistema ' : '           ') +
    (c.lista ? '[' + c.lista.join(' | ') + ']' : ''));
});
if (!ESCRIBIR) { console.log('\n  (seco. Para crear el archivo: --escribir)'); process.exit(0); }

// ══ 1 · la tabla, con SheetJS (archivo nuevo: no hay estilos que destruir) ══════════════════════
var aoa = [COLS.map(function (c) { return c.n; }), COLS.map(function (c) { return c.ej === undefined ? '' : c.ej; })];
var wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), HOJA);
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_paidcat.xlsx';
XLSX.writeFile(wb, TMP);

// ══ 2 · formato, listas y ayudas, por XML — que es lo único que Excel respeta ═══════════════════
var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = String(tg).replace(/^\//, ''); return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, nm, rid) { if (nm === HOJA) parte = 'xl/' + rmap[rid].replace(/^xl\//, ''); return _; });
var xml = zip.readAsText(parte);

// estilos: 0 normal · 1 encabezado (blanco sobre verde) · 2 encabezado de sistema (gris) · 3 ejemplo (itálica gris)
var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="4">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF444444"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF808080"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF2A9187"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';
zip.updateFile('xl/styles.xml', Buffer.from(styles, 'utf8'));

// aplicar el estilo a la fila 1 (encabezados) y a la 2 (ejemplo)
xml = xml.replace(/<c r="([A-Z]+)(1|2)"([^>]*?)(\/>|>)/g, function (todo, letra, fila, at, cierre) {
  var i = 0, L = letra; for (var k = 0; k < L.length; k++) i = i * 26 + (L.charCodeAt(k) - 64); i--;
  var s = fila === '1' ? (COLS[i] && COLS[i].quien === 'sistema' ? 2 : 1) : 3;
  return '<c r="' + letra + fila + '" s="' + s + '"' + at.replace(/\s*s="\d+"/, '') + cierre;
});
// anchos + fila 1 congelada
var cols = '<cols>' + COLS.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c.w + '" customWidth="1"/>'; }).join('') + '</cols>';
xml = xml.replace(/<sheetData>/, cols + '<sheetData>');
xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, '') .replace(/(<\/dimension>|<dimension[^>]*\/>)/,
  '$1<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
// listas desplegables + mensajes de ayuda, hasta la fila 500
var dv = COLS.map(function (c, i) {
  var sq = col(i) + '2:' + col(i) + '500';
  var ayuda = ' showInputMessage="1" promptTitle="' + esc(c.n) + '" prompt="' + esc(c.ayuda) + '"';
  if (c.lista) return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Valor no permitido" error="Elige uno de la lista. Si ninguno aplica, avísanos y lo agregamos — no escribas uno nuevo."' + ayuda + ' sqref="' + sq + '"><formula1>"' + c.lista.join(',') + '"</formula1></dataValidation>';
  return '<dataValidation type="none" allowBlank="1"' + ayuda + ' sqref="' + sq + '"/>';
}).join('');
/* 🔴 EL ORDEN DE LOS ELEMENTOS DE UNA HOJA NO ES LIBRE. La primera versión pegaba
 *    `<dataValidations>` justo antes de `</worksheet>` y `xlsx-check` marcó falla: SheetJS ya había
 *    escrito un `<ignoredErrors>`, y en el esquema OOXML `dataValidations` va ANTES que
 *    `ignoredErrors`. Excel no se queja al validar el XML — «repara» el archivo, que es peor:
 *    abre, descarta lo que no entiende y el equipo se queda sin las listas sin enterarse.
 *    Se inserta antes de `ignoredErrors` si existe; si no, antes del cierre. */
var bloqueDV = '<dataValidations count="' + COLS.length + '">' + dv + '</dataValidations>';
xml = /<ignoredErrors[\s>]/.test(xml)
  ? xml.replace(/<ignoredErrors/, bloqueDV + '<ignoredErrors')
  : xml.replace(/<\/worksheet>/, bloqueDV + '</worksheet>');
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);

// ══ 3 · las capas de validación, las mismas de siempre ═════════════════════════════════════════
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('     ✔ ' + nom.padEnd(20) + String(r).trim().split('\n').pop().slice(0, 62)); return true; }
  catch (e) { console.log('     🔴 ' + nom + ': ' + String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-2).join(' ').slice(0, 150)); return false; }
}
console.log('\n  ── validación');
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP, '--salida', TMP])) { console.log('\n  🔴 NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, DESTINO);
console.log('     → ' + path.basename(DESTINO));
/* 🔴 UNA CAPA EN ROJO NO PUEDE TERMINAR EN «✅ LISTA». La primera corrida marcó falla en
 *    `xlsx-check` (el orden de `dataValidations`) y este script igual imprimió que la plantilla
 *    estaba lista — o sea, el resumen contradecía a su propia evidencia tres líneas arriba.
 *    Ahora el veredicto se calcula de las capas, no se escribe a mano. */
var capasOK = true;
capasOK = capa('xlsx-check', NODE, [T + 'xlsx-check.js', DESTINO]) && capasOK;
capasOK = capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', DESTINO]) && capasOK;
capasOK = capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', DESTINO]) && capasOK;

// releer del disco: lo que importa es lo que quedó, no lo que escribí
var chk = XLSX.readFile(DESTINO);
var F = XLSX.utils.sheet_to_json(chk.Sheets[HOJA], { header: 1, defval: '' });
console.log('\n  ── releído del disco');
console.log('     hoja(s): ' + chk.SheetNames.join(' | '));
console.log('     encabezados: ' + (F[0] || []).length + ' de ' + COLS.length + (((F[0] || []).length === COLS.length) ? '  ✔' : '  🔴'));
var mal = COLS.filter(function (c, i) { return String((F[0] || [])[i]) !== c.n; });
console.log('     nombres exactos: ' + (mal.length ? '🔴 difieren ' + mal.length : '✔ los ' + COLS.length));
console.log('     fila de ejemplo: ' + ((F[1] || []).filter(function (x) { return String(x).trim(); }).length) + ' celdas con valor');
var nombresOK = mal.length === 0 && (F[0] || []).length === COLS.length;
if (capasOK && nombresOK) console.log('\n  ✅ PLANTILLA LISTA: ' + DESTINO);
else {
  console.log('\n  🔴 LA PLANTILLA NO QUEDÓ BIEN' + (capasOK ? '' : ' — una capa de validación falló') +
    (nombresOK ? '' : ' — los encabezados no coinciden') + '. El archivo está en disco pero NO se debe compartir así.');
  process.exit(1);
}
try { fs.unlinkSync(TMP); } catch (e) { }
