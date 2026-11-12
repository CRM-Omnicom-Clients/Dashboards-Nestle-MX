// resumen-regenerar · EL REPORTE RESUMEN. Proyecta la rejilla de motor-calculo sobre las 59 columnas de `Report_Resumen`.
//
// 🔴 NO CALCULA NADA. Todo lo que escribe ya venía calculado por motor-calculo. Si aquí hiciera falta una
//    división, sería señal de que a motor-calculo le falta una columna — no de que resumen-regenerar deba dividir. Ese
//    limite es lo que permite refutar el reporte contra la rejilla sin discutir aritmética.
//
// 🔴 LA HOJA MANDA LA FORMA. Sus 59 columnas y su granularidad —Campaña × Objetivo × TouchPoint
//    × Segmento × Quincena, con Principal y FUP PAREADOS en la misma fila— no se rediseñan aquí.
//    Se leen del encabezado real y se llenan por NOMBRE, nunca por letra.
//
// ⚠ LO QUE NO SE PISA: la columna `Insights` (BG) la escribe insights-redactar, y los `Subject` salen de
//   `Data_Email`, que es donde alguien los escribió a mano. resumen-regenerar no los inventa.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
function serial(iso) { return iso ? Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000) : ''; }

console.log('════════ resumen-regenerar · REPORTE RESUMEN ' + (ESCRIBIR ? '(ESCRIBE)' : '(solo diff)') + ' ════════\n');
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_n6.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Report_Resumen'];
if (!sh) { console.log('  🔴 no existe Report_Resumen'); process.exit(1); }
var r = XLSX.utils.decode_range(sh['!ref']);
var COLS = [];
for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; COLS.push(h ? t(h.v) : ''); }
var idx = {}; COLS.forEach(function (n, i) { if (n) idx[n] = i; });

// 🔴 L4 · EL MANIFIESTO SE EXIGE **ANTES** DE TOCAR EL ARCHIVO. Si una columna cambió de nombre,
//    esto se entera aquí —con el libro todavía cerrado— y no a media escritura, con la hoja ya
//    abierta y medio escrita. El manifiesto no está escrito a mano: lo deriva `orquestador.manifiestos.js`
//    leyendo qué nombres físicos usa este mismo archivo, así que no se desactualiza en silencio.
try {
  var REG = require(__dirname + '/lib-registro.js');
  var MAN = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_contratos/manifiestos.json', 'utf8'));
  var mios = ((MAN.scripts['N6-resumen'] || {}).ids || []).filter(function (id) { return id.indexOf('resumen.') === 0; });
  if (mios.length) {
    REG.abrir('resumen', COLS, { silencioso: true }).exigir(mios, 'N6-resumen');
    console.log('  registro: ' + mios.length + ' id(s) del manifiesto resuelven ✔');
  }
} catch (e) {
  if (e && e.registro) { console.log('\n' + e.message + '\n'); process.exit(1); }   // 🔴 no se escribe nada
  console.log('  ⚠ registro no disponible (' + (e.code || e.message).toString().slice(0, 40) + ') — se sigue sin él');
}
console.log('  hoja: ' + COLS.filter(Boolean).length + ' columnas · ' + r.e.r + ' filas de datos hoy');
console.log('  rejilla: ' + R.rejilla.length + ' celdas');

// los subjects viven en Data_Email, escritos a mano. Se leen, no se inventan.
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '', blankrows: false });
var subjPorPieza = {};
E.forEach(function (x) {
  var pid = t(x['pieza_id']); if (!pid) return;
  var s = t(x['Subject_Clean']) || t(x['Email_Subject_Raw']);
  if (!s) return;
  var fup = /follow/i.test(t(x['Email_Type']));
  subjPorPieza[pid] = subjPorPieza[pid] || {};
  if (!subjPorPieza[pid][fup ? 'fup' : 'principal']) subjPorPieza[pid][fup ? 'fup' : 'principal'] = s.slice(0, 120);
});

// ── el mapeo columna → valor. Declarado, no programado en un switch ────────────────
function pct(v) { return v === null || v === undefined ? '' : v; }
var MES_NUM = { 'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12 };
// 🔴 D4 · la tasa de un destino sobre el TOTAL de clicks únicos de la fila. No calcula el conteo
//    (eso lo trae motor-calculo): solo el cociente, que es lo que la doctrina permite en el reporte cuando el
//    numerador y el denominador ya vienen de la rejilla.
function tasaDest(c, dest) {
  var tot = c.links_clicks_unicos || 0;
  var v = (c.clicks_por_destino || {})[dest] || 0;
  return tot ? v / tot : null;
}
function valorDe(nombre, c) {
  var q = c.qcart;
  // 🔴 D2 (Rick, 21-ago): Tipo Email LLENO y correcto. La fórmula vieja `IF(O=0,"FUP","Principal")`
  //    daba «FUP» a las filas de WhatsApp y Qcart-only (Principal_Sends=0 sin ser FUP). Se calcula
  //    del contenido real de la celda: manda el email si lo hay, si no el canal que sí tuvo envío.
  var tipoEmail = c.principal.sends > 0 ? 'Principal'
    : (c.fup.sends > 0 ? 'FUP'
      : (c.whatsapp.sends > 0 ? 'WhatsApp'
        : (q ? 'Qcart' : '')));
  var M = {
    'Campaña': c.campana, 'Medio': c.medio, 'Objetivo': c.objetivo, 'TouchPoint': c.touchpoint,
    // 🔴 D1 (Rick): QCART? = Sí / No y NADA MÁS. La remisión «— ver Qx» ya no va aquí: con F1 el
    //    Qcart va por pieza (touchpoint × segmento), así que cada fila tiene su propio Qcart o no.
    'QCART?': q ? 'Sí' : 'No',
    'Segmento': c.segmento, 'Quincena_Lanzamiento': c.quincena, 'Mes': c.mes,
    'Tipo  Email': tipoEmail,                 // D2 · dos espacios: es el nombre real de la hoja
    'Mes (#)': MES_NUM[t(c.mes)] || '',       // D2 · el número del mes
    'BU': c.bu, 'Marca': c.marca,
    // 🔴 las dos columnas nuevas (20-ago-2026), al final del reporte. Una celda agrupa varias
    //    piezas, así que son conjuntos coma-separados. Content_ID = id del content name
    //    (Journey_ID_Datorama) · Email_ID = el creativo de SFMC.
    // 🔴 los nombres son los de la HOJA, que Rick renombró. El sistema se adapta a la hoja,
    //    nunca al revés.
    // C1 · `Content_ID` = el segmento final (viene del catálogo). El `EmailName` completo NO va
    //      en el reporte: vive en el catálogo, que es donde se consulta la identidad larga.
    // 🔴 los encabezados que A11 renombró (21-ago). Se mapean los DOS nombres —el nuevo y el viejo—
    //    para que el script funcione con la hoja de hoy y con una que aún no se haya renombrado.
    'Content_ID (final del Email_Name)': Object.keys(c.content_ids || {}).join(' · '),
    'Email_ID (de la DE de SFMC)': Object.keys(c.email_ids || {}).join(', '),
    'Content_ID (SFMC)': Object.keys(c.content_ids || {}).join(' · '),
    'Email_ID (SFMC)': Object.keys(c.email_ids || {}).join(', '),
    // 🔴 F3 (Rick, 21-ago): el Email_Name al reporte. Es el nombre completo de la pieza (= EmailName
    //    del catálogo), no la colita. Una celda agrupa varias piezas → conjunto.
    'Email_Name': Object.keys(c.email_names || {}).join(' · '),
    'EmailName': Object.keys(c.email_names || {}).join(' · '),
    'Content_ID': Object.keys(c.content_ids || {}).join(' · '),
    'Email_ID': Object.keys(c.email_ids || {}).join(', '),
    // 🔴 F3 · el subject Principal y el FUP. El P_Subject faltaba en la hoja; se agrega en D6.
    'P_Subject': c.principal.subject || '', 'Principal_Subject': c.principal.subject || '',
    'FUP_Subject': c.fup.subject || '',
    'Principal_Sends': c.principal.sends, 'Principal_Deliveries': c.principal.deliveries,
    'Principal_Opens': c.principal.opens, 'Principal_Clicks': c.principal.clicks,
    'Principal_Open_Rate': pct(c.principal.open_rate), 'Principal_CTOR': pct(c.principal.ctor),
    'Principal_Click_Rate': pct(c.principal.click_rate),
    'FUP_Sends': c.fup.sends, 'FUP_Deliveries': c.fup.deliveries, 'FUP_Opens': c.fup.opens,
    'FUP_Clicks': c.fup.clicks, 'FUP_Open_Rate': pct(c.fup.open_rate), 'FUP_CTOR': pct(c.fup.ctor),
    'FUP_Click_Rate': pct(c.fup.click_rate),
    'Tot_Sends': c.total.sends, 'Tot_Deliveries': c.total.deliveries, 'Tot_Opens': c.total.opens,
    'Tot_Clicks': c.total.clicks, 'Tot_Open_Rate': pct(c.total.open_rate),
    'Tot_CTOR': pct(c.total.ctor), 'Tot_Click_Rate': pct(c.total.click_rate),
    'WA-Envíos': c.whatsapp.sends, 'WA-Entregados': c.whatsapp.deliveries,
    'WA-No entregados': c.whatsapp.no_entregados, 'WA-Leídos': c.whatsapp.read,
    'WA-Clicks': c.whatsapp.clicks_medidos ? c.whatsapp.clicks : '',
    'WA-%Entrega': pct(c.whatsapp.delivery_rate),
    'WA-%No entrega': pct(c.whatsapp.sends ? c.whatsapp.no_entregados / c.whatsapp.sends : null),
    'WA-%Read vs entrega': pct(c.whatsapp.read_rate),
    'WA-%Click vs Read': pct(c.whatsapp.ctor),
    // 🔴 las columnas que pidio Rick el 21-ago. Todas vienen YA calculadas de la rejilla: aqui
    //    no se suma ni se divide nada, que es la primera regla de la doctrina.
    // 🔴 EL NOMBRE FÍSICO ES EL DE LA HOJA: «Audiencia_DE SFMC», no «Audiencia_DE». Con el nombre
    //    corto, estas dos filas se escribían a una columna que NO EXISTE: la rejilla traía la
    //    audiencia de 95 de 98 envíos y el reporte mostraba 0 de 77, en verde. Es exactamente el
    //    «0 y 0» por el que nació el registro de nombres — y el render fue quien lo enseñó.
    //    ⚠ DEUDA: estos dos nombres siguen escritos a mano. Deberían pedirse al registro, como el
    //      resto, para que un renombre no los vuelva a dejar mudos.
    'Audiencia_DE SFMC': Object.keys(c.audiencias || {}).join(' · ') || (c.audiencia_de || ''),
    'Audiencia_Volumen SFMC': c.audiencia_volumen || null,
    'Unsubs_Unicos': c.unsubs_unicos || null,
    // 🔴 D3 (Rick): «unsuscribe total se quita». Se limpia (null): el dato redundante es Unsubs_Total;
    //    el que vale es Unsubs_Unicos. La columna física la retira D-encabezados si Rick confirma.
    'Unsubs_Total': null,
    // 🔴 D4 · las tasas de cada destino sobre los clicks únicos de la fila. Vienen calculadas de motor-calculo.
    '%_Qcart': tasaDest(c, 'qcart'), '%_App': tasaDest(c, 'app'), '%_Social': tasaDest(c, 'social'),
    '%_Web': tasaDest(c, 'web'), '%_Ver_Navegador': tasaDest(c, 'ver_en_navegador'), '%_Unsub': tasaDest(c, 'unsub'),
    'Clicks_Qcart': (c.clicks_por_destino || {}).qcart || null,
    'Clicks_App': (c.clicks_por_destino || {}).app || null,
    'Clicks_Social': (c.clicks_por_destino || {}).social || null,
    'Clicks_Web': (c.clicks_por_destino || {}).web || null,
    'Clicks_Ver_Navegador': (c.clicks_por_destino || {}).ver_en_navegador || null,
    'Clicks_Unsub': (c.clicks_por_destino || {}).unsub || null,
    // 🔴 D3 · el nombre nuevo (Clicks_Unicos_Total) y el viejo (Clicks_Links_Total), ambos mapeados.
    'Clicks_Unicos_Total': c.links_clicks_unicos || null,
    'Clicks_Links_Total': c.links_clicks_unicos || null
  };
  if (q) {
    M['Receta_Representativa'] = q.receta_representativa || '';
    M['FechaQcart_Desde'] = serial(q.desde); M['FechaQcart_Hasta'] = serial(q.hasta);
    M['Carritos_Walmart'] = q.carritos_walmart; M['Carritos_Chedraui'] = q.carritos_chedraui;
    M['Carritos_Total'] = q.carritos; M['Views_Carrito'] = q.views;
    M['Views_Productos_Nestle'] = q.views_productos;
    M['Intencion_Total_MXN'] = q.importe_total; M['Intencion_Nestle_MXN'] = q.importe_nestle;
    M['Pct_Penetracion_Nestle'] = pct(q.penetracion);
    M['Ticket_Carrito_MXN'] = pct(q.ticket_carrito); M['Ticket_Producto_MXN'] = pct(q.ticket_producto);
    // ⚠ la hoja las llama «_%» pero NO son porcentajes: son MULTIPLICADORES. El shortlink de
    //   Qcart es unico por canal, no hay trafico externo, asi que un valor >1 no es amplificacion
    //   sino dato inflado en la fuente. El nombre de la columna miente; el valor no.
    M['Views_vs_Clicks_%'] = pct(q.views_vs_clicks); M['Carritos_vs_Clicks_%'] = pct(q.carritos_vs_clicks);
    M['Tasa_Productos_a_Carritos'] = pct(q.productos_a_carritos);
  } else {
    // 🔴 SIN QCART SE PONE `null`, NO SE OMITE. `undefined` significa «el sistema no conoce esta
    //    columna, déjala como está»; `null` significa «el sistema SÍ la calcula y le toca vacía».
    //    Omitirlas dejaba el Qcart de una corrida anterior vivo para siempre en una fila que ya no
    //    lo ancla — y el reporte sumaba 1,030 carritos que la rejilla no producía. Es justo lo que
    //    la regla anti-doble-conteo existe para impedir: el Qcart del mes aparece UNA vez.
    ['Receta_Representativa', 'FechaQcart_Desde', 'FechaQcart_Hasta', 'Carritos_Walmart', 'Carritos_Chedraui',
      'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN',
      'Pct_Penetracion_Nestle', 'Ticket_Carrito_MXN', 'Ticket_Producto_MXN', 'Views_vs_Clicks_%',
      'Carritos_vs_Clicks_%', 'Tasa_Productos_a_Carritos'].forEach(function (k) { M[k] = null; });
  }
  // ⚠ el nombre exacto de la hoja puede llevar acentos o cortes distintos: se casa por prefijo
  //   normalizado, que es como el resto del sistema casa encabezados.
  if (M[nombre] !== undefined) return M[nombre];
  var nn = L.nmEncabezado(nombre);
  var hit = Object.keys(M).filter(function (k) { return L.nmEncabezado(k) === nn; })[0];
  return hit ? M[hit] : undefined;
}

// ── el orden de las filas: por campaña, y dentro por quincena ──────────────────────
// 🔴 las celdas con campaña SIN RESOLVER van AL FINAL y juntas. Mezclarlas con las atribuidas
//    las presenta como si fueran lo mismo, y no lo son: unas tienen pieza y las otras no.
var filas = R.rejilla.slice().sort(function (a, b) {
  if (a.campana_del_catalogo !== b.campana_del_catalogo) return a.campana_del_catalogo ? -1 : 1;
  return (a.campana + '¦' + a.quincena + '¦' + a.touchpoint + '¦' + a.segmento)
    .localeCompare(b.campana + '¦' + b.quincena + '¦' + b.touchpoint + '¦' + b.segmento);
});
// el subject, de la pieza que compone la celda
filas.forEach(function (c) {
  (c.piezas || []).forEach(function (pid) {
    var s = subjPorPieza[pid]; if (!s) return;
    if (!c.principal.subject && s.principal) c.principal.subject = s.principal;
    if (!c.fup.subject && s.fup) c.fup.subject = s.fup;
  });
});

var sinMapear = COLS.filter(Boolean).filter(function (n) {
  return n !== 'Insights' && valorDe(n, filas[0]) === undefined;
});
console.log('\n  ── el mapeo');
console.log('     columnas de la hoja que resumen-regenerar llena: ' + (COLS.filter(Boolean).length - sinMapear.length - 1) + ' de ' + COLS.filter(Boolean).length);
console.log('     Insights: la escribe insights-redactar, aquí no se toca');
if (sinMapear.length) console.log('     🔴 sin mapear: ' + sinMapear.join(' · '));

console.log('\n  ── las filas');
console.log('     atribuidas: ' + filas.filter(function (c) { return c.campana_del_catalogo; }).length +
  '   ·   sin resolver (van al final): ' + filas.filter(function (c) { return !c.campana_del_catalogo; }).length);
console.log('     Σ Tot_Sends: ' + mil(filas.reduce(function (a, c) { return a + c.total.sends; }, 0)));
console.log('     con Qcart propio: ' + filas.filter(function (c) { return c.qcart; }).length +
  '   ·   con remisión: ' + filas.filter(function (c) { return c.qcart_remision; }).length);

if (!ESCRIBIR) {
  console.log('\n  ── muestra de 4 filas');
  filas.slice(0, 4).forEach(function (c) {
    console.log('     ' + t(c.campana).slice(0, 14).padEnd(15) + t(c.objetivo).slice(0, 10).padEnd(11) +
      t(c.touchpoint).padEnd(6) + t(c.segmento).slice(0, 16).padEnd(17) + c.quincena.padEnd(12) +
      String(mil(c.principal.sends)).padStart(9) + ' P  ' + String(mil(c.fup.sends)).padStart(8) + ' FUP  ' +
      (c.total.open_rate === null ? '   —  ' : (c.total.open_rate * 100).toFixed(1).padStart(5) + '% OR'));
  });
  console.log('\n  ── solo diff. Para escribir: node orquestador.resumen.js --escribir');
  process.exit(0);
}

// ══ ESCRIBIR ════════════════════════════════════════════════════════════════════════
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
var xml = zip.readAsText(parte);

// 🔴 SE BORRAN LAS FILAS DE DATOS Y SE REESCRIBEN. El Resumen es una PROYECCIÓN de la rejilla:
//    no hay nada escrito a mano ahí. (Antes se rescataba `Insights`; Rick decidió 20-ago-2026
//    dejar el reporte SIN insights, así que esa columna se retira.)
//
// 🔴 LAS COLUMNAS DE SALIDA (`OUT`) ≠ las de la hoja (`COLS`). Rick pidió: quitar `Insights` y
//    poner `Content_ID` y `Email_ID` al final. Se sustituye Insights por Content_ID EN SU MISMA
//    posición (era la última) y se AGREGA Email_ID como columna nueva justo después. Así los dos
//    ids quedan al final, y solo se crea UNA columna nueva.
// 🔴 A2 · LA HOJA MANDA LA FORMA. La versión anterior construía su PROPIA lista de columnas y la
//    imponía: agregaba `Content_ID`/`Email_ID` al final —donde YO los puse— aunque Rick ya los
//    tuviera en la posición 13-14 con otro nombre, y recreaba la columna `Insights` que él quitó.
//    Un escritor que decide la forma de la hoja destruye el trabajo del humano en cada corrida.
//    Ahora: OUT = las columnas EXACTAS de la hoja. No se agrega, mueve, renombra ni reordena.
var OUT = COLS.slice();
var estH = CX.estiloDe(xml, 'A1');
var estilo = {};
OUT.forEach(function (n, i) { if (n) estilo[i] = CX.estiloDe(xml, col(i) + '2') || estH; });

// 🔴 A3 · Y NO SE BORRAN LAS FILAS. Antes se borraba todo de la fila 2 en adelante y se reescribía:
//    eso habría eliminado las 17 filas que Rick agregó a mano (el desglose de Pro Plan por mascota
//    y los partidos de WhatsApp de Mundial), que la rejilla todavía no produce. Ahora se ACTUALIZA
//    por llave: la fila que la rejilla conoce se rellena en su sitio; la que no, se deja intacta.
// las filas que la hoja tiene HOY, para poder actualizarlas en su sitio en vez de borrarlas
var Rpre = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });

// 🔴 EL SISTEMA NO PISA UNA CELDA QUE EL HUMANO CALCULÓ. Rick tiene 437 fórmulas en esta hoja
//    —deriva sus columnas, calcula tasas en las filas que el sistema aún no llena, y mantiene una
//    fila de totales— y muchas son COMPARTIDAS (`<f t="shared" si="N">`). Escribir un valor encima
//    de la celda MAESTRA deja huérfanas a todas sus hijas, y `safe-save` se niega a guardar (con
//    razón: el libro quedaría roto).
//    Regla, y es la cuarta de la doctrina: **si la celda tiene fórmula, es del humano y se
//    respeta.** El sistema llena lo que está vacío o lo que él mismo escribió antes.
function tieneFormula(x, ref) {
  var m = new RegExp('<c r="' + ref + '"(?![^>]*\/>)[^>]*>([\s\S]*?)</c>').exec(x);
  return !!(m && m[1].indexOf('<f') >= 0);
}
// 🔴 LA LLAVE NO LLEVA LA QUINCENA. Rick tiene `Partido 3` en Jul-Q1 y la fuente dice 26-jun
//    (Jun-Q2); `Final` en Jul-Q1 y la fuente 19-jul (Jul-Q2). Si la quincena entra en la llave,
//    esas filas no emparejan y se quedan sin datos — cuando el TouchPoint ya identifica la pieza
//    sin ambigüedad dentro de su campaña. Se empareja por identidad y **la quincena se corrige**
//    como un dato más: en fechas manda la fuente, que es la regla de Rick.
// 🔴 columnas donde el sistema sobrescribe la fórmula (Rick las quiere como valor calculado)
var SISTEMA_MANDA = { 'Tipo  Email': 1, 'Mes (#)': 1, 'QCART?': 1 };
var LLAVEC = ['Campaña', 'Objetivo', 'TouchPoint', 'Segmento'];
var filaDeLlave = {}, filaDeLlaveQ = {}, cuantasPorId = {}, sinObjetivo = {};
Rpre.forEach(function (x, i) {
  var k = LLAVEC.map(function (n) { return L.nmz(t(x[n])); }).join('¦');
  // 🔴 UNA IDENTIDAD PUEDE REPETIRSE EN DOS QUINCENAS. AON Traditional Parents E-P1 tiene la
  //    oleada de marzo y la de abril: misma campaña, mismo touchpoint, mismo segmento. Indexadas
  //    solo por identidad, la segunda pisaba a la primera y 66,204 envíos se contaban dos veces.
  //    Por eso hay DOS índices y el de quincena manda; el de identidad sigue existiendo para las
  //    filas de WhatsApp de Rick, cuya quincena no coincide con la fuente (y ahí manda la fuente).
  cuantasPorId[k] = (cuantasPorId[k] || 0) + 1;
  filaDeLlaveQ[k + '¦' + L.nmz(t(x['Quincena_Lanzamiento']))] = i + 2;
  filaDeLlave[k] = i + 2;
  // ⚠ varias filas de WhatsApp de Rick tienen el Segmento VACÍO («Partido 2» sin segmento) aunque
  //   la pieza sí lo tenga. Se indexa también sin segmento para que emparejen igual.
  var kSinSeg = LLAVEC.slice(0, 3).map(function (n) { return L.nmz(t(x[n])); }).join('¦');
  if (!t(x['Segmento']) && filaDeLlave[kSinSeg] === undefined) filaDeLlave[kSinSeg] = i + 2;
  // 🔴 UNA FILA CON EL OBJETIVO EN BLANCO ESTÁ ESPERANDO A QUE SE LO LLENEN. Es el mismo caso que
  //    la fila sin segmento: Rick —o el propio sistema al anexar— deja la fila puesta y una
  //    dimensión vacía porque todavía nadie la ha declarado. En cuanto el catálogo la resuelve,
  //    la llave completa deja de coincidir y la fila se queda huérfana con sus datos dentro.
  //    ⚠ Solo aplica cuando el objetivo está VACÍO, nunca cuando dice otra cosa: un objetivo
  //      distinto es otra fila, no la misma esperando.
  if (!t(x['Objetivo'])) {
    var kSinObj = [x['Campaña'], x['TouchPoint'], x['Segmento'], x['Quincena_Lanzamiento']].map(function (v) { return L.nmz(t(v)); }).join('¦');
    sinObjetivo[kSinObj] = (sinObjetivo[kSinObj] === undefined) ? i + 2 : -1;   // -1 = ambiguo, no se usa
  }
});
// 🔴 LA ÚLTIMA FILA ES LA QUE DICE EL XML, NO EL CONTEO DE DATOS. `Rpre.length + 1` daba 74,
//    pero la hoja llega hasta la 78 (fila de totales y filas de cola): las anexadas caían
//    ENCIMA de filas existentes y quedaban fuera de orden — y Excel se niega a abrir así.
var ultimaEnXml = 1;
xml.replace(/<row r="(\d+)"/g, function (_, n2) { ultimaEnXml = Math.max(ultimaEnXml, +n2); return _; });
var sinFila = [];
var maxFila = Math.max(Rpre.length + 1, ultimaEnXml), actualizadas = 0, anexadas = 0, intactas = Rpre.length, respetadas = 0, limpiadas = 0, reclamadas = 0;
var filasNuevasXml = '';

// 🔴 FILAS OBSOLETAS POR RENOMBRE. La hoja tiene filas con una identidad que A2/A3 cambiaron
//    (Espresso Con → Hackea tu café · J4-ConRegión → E-J4): su campaña o su touchpoint ya no
//    aparece en la rejilla. Una celda nueva de la MISMA campaña puede RECLAMAR esa fila —se
//    sobrescribe su identidad y sus datos— en vez de dejar una fila vieja huérfana y anexar la
//    nueva (que es como se doblaron los totales la vez pasada). Solo son reclamables las que
//    tienen datos (sends>0) y cuya identidad ya no existe: un placeholder de Rick (0 sends) no.
var campEnRej = {}, campTpEnRej = {};
filas.forEach(function (c) { campEnRej[L.nmz(c.campana)] = 1; campTpEnRej[L.nmz(c.campana) + '¦' + L.nmz(c.touchpoint)] = 1; });
var obsoletasPorCamp = {}, obsoletasTotal = 0;
Rpre.forEach(function (x, i) {
  if (/total/i.test(t(x['Campaña'])) || /total/i.test(t(x['Medio']))) return;
  var kc = L.nmz(t(x['Campaña'])), kt = kc + '¦' + L.nmz(t(x['TouchPoint']));
  var sends = Number(String(x['Tot_Sends']).replace(/[, ]/g, '')) || 0;
  if (!campTpEnRej[kt] && sends > 0) { (obsoletasPorCamp[kc] = obsoletasPorCamp[kc] || []).push(i + 2); obsoletasTotal++; }
});

filas.forEach(function (c) {
  var k = [c.campana, c.objetivo, c.touchpoint, c.segmento].map(L.nmz).join('¦');
  var kSinSeg = [c.campana, c.objetivo, c.touchpoint].map(L.nmz).join('¦');
  // 1 · identidad + quincena   2 · identidad sola, SOLO si es única   3 · la fila de Rick sin segmento
  var nFila = filaDeLlaveQ[k + '¦' + L.nmz(t(c.quincena))];
  if (nFila === undefined && cuantasPorId[k] === 1) nFila = filaDeLlave[k];
  if (nFila === undefined) nFila = filaDeLlave[kSinSeg];
  // 4 · la fila que dejaron con el OBJETIVO en blanco, si no hay dos candidatas
  if (nFila === undefined) {
    var kso = [c.campana, c.touchpoint, c.segmento, c.quincena].map(L.nmz).join('¦');
    if (sinObjetivo[kso] > 0) nFila = sinObjetivo[kso];
  }
  var esNueva = false;
  // 🔴 EL ESCRITOR NO ANEXA FILAS. Antes sí, y produjo duplicados silenciosos: al corregir el
  //    catálogo, las piezas de WhatsApp de Mundial cambiaron de touchpoint y varias de quincena,
  //    así que su LLAVE dejó de coincidir con la fila que Rick ya tenía. El escritor las dio por
  //    nuevas, las anexó, y la vieja se quedó: la hoja pasó de 73 a 82 filas y los totales se
  //    DOBLARON (12.6M contra 6.2M reales). La Puerta 2 lo atrapó — pero el reporte ya estaba mal.
  //    Cuando la identidad de una pieza cambia, el escritor NO puede saber si es una fila nueva o
  //    la misma con otro nombre. Lo honesto: actualizar lo que empareja y DECLARAR lo que no.
  // 🔴 si no empareja, intenta RECLAMAR una fila obsoleta de su misma campaña (renombre) antes de
  //    anexar. Al reclamar se sobrescribe TODO —identidad incluida—, porque la fila vieja ya no es
  //    de esa pieza.
  var reclamada = false;
  if (!nFila) {
    var libres = obsoletasPorCamp[L.nmz(c.campana)];
    if (libres && libres.length) { nFila = libres.shift(); reclamada = true; reclamadas++; }
  }
  if (!nFila) { sinFila.push({ campana: c.campana, objetivo: c.objetivo, tp: c.touchpoint, seg: c.segmento, quincena: c.quincena, sends: c.total.sends }); return; }
  actualizadas++; intactas--;
  var celdas = [];
  OUT.forEach(function (nom, i) {
    if (!nom) return;
    var v = valorDe(nom, c);
    // 🔴 `undefined` = columna que el sistema NO conoce (p.ej. `Tipo  Email`, `Mes (#)`, que Rick
    //    agregó). Se DEJA lo que haya: no se pisa con vacío lo que uno no sabe calcular.
    if (v === undefined) return;
    // 🔴 `null`/vacío NO es lo mismo que `undefined`. `undefined` = columna que el sistema no
    //    conoce y deja intacta. `null` = el sistema SÍ la calcula y le toca vacía -> hay que
    //    BORRAR lo que hubiera antes. Sin esto, un valor viejo de una corrida anterior sobrevive
    //    para siempre en una fila que ya no le corresponde, y el reporte suma de más.
    var vacio = (v === null || v === '');
    if (esNueva) { if (!vacio) celdas.push(CX.celda(col(i) + nFila, v, estilo[i])); return; }
    // 🔴 una fila RECLAMADA se sobrescribe entera: su identidad cambió, así que ninguna fórmula
    //    vieja de esa celda sigue siendo válida. No es trabajo de Rick, es una fila obsoleta.
    if (reclamada) { xml = CX.poner(xml, col(i) + nFila, CX.celda(col(i) + nFila, vacio ? '' : v, estilo[i]), nFila).xml; if (vacio) limpiadas++; return; }
    // 🔴 D2 (Rick, 21-ago): estas columnas las MANDA el sistema, no la fórmula. La `IF(O=0,"FUP",
    //    "Principal")` de Tipo Email daba «FUP» a WhatsApp/Qcart, y `Mes (#)` no tenía fórmula y
    //    quedaba vacía. Rick pidió que estén llenas y correctas, así que aquí el valor calculado
    //    reemplaza la fórmula heurística. El resto de fórmulas de Rick se siguen respetando.
    if (!SISTEMA_MANDA[t(nom)] && tieneFormula(xml, col(i) + nFila)) { respetadas++; return; }   // 🔴 es de Rick
    xml = CX.poner(xml, col(i) + nFila, CX.celda(col(i) + nFila, vacio ? '' : v, estilo[i]), nFila).xml;
    if (vacio) limpiadas++;
  });
  if (esNueva) filasNuevasXml += '<row r="' + nFila + '">' + celdas.join('') + '</row>';
});

console.log('  filas actualizadas en su sitio: ' + actualizadas);
console.log('  filas anexadas (rejilla nueva): ' + anexadas);
console.log('  filas de Rick NO tocadas      : ' + intactas);
console.log('  celdas con fórmula respetadas : ' + respetadas);
console.log('  celdas rancias limpiadas      : ' + limpiadas);
if (sinFila.length) {
  console.log('\n  🔴 ' + sinFila.length + ' celda(s) de la rejilla NO tienen fila en la hoja — NO se anexan.');
  console.log('     Decide tú si van, y con qué identidad. Quedan en _rejilla/sin-fila-en-el-reporte.json');
  sinFila.slice(0, 12).forEach(function (x) {
    console.log('        ' + String(x.campana).padEnd(16).slice(0, 16) + String(x.tp).padEnd(10) +
      String(x.seg).padEnd(24).slice(0, 24) + String(x.quincena).padEnd(13) + mil(x.sends) + ' envíos');
  });
  fs.writeFileSync(BACK + '/_rejilla/sin-fila-en-el-reporte.json', JSON.stringify(sinFila, null, 1));
}
if (filasNuevasXml) xml = xml.replace('</sheetData>', filasNuevasXml + '</sheetData>');
xml = xml.replace(new RegExp('<dimension ref="([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)"/>'), function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + maxFila + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));

var wb2 = XLSX.readFile(SECO);
var F2 = XLSX.utils.sheet_to_json(wb2.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var sT = F2.reduce(function (a, x) { return a + (Number(String(x['Tot_Sends']).replace(/[, ]/g, '')) || 0); }, 0);
console.log('\n  ── releído: ' + F2.length + ' filas   Σ Tot_Sends ' + mil(sT));
console.log('     esperado: ' + filas.length + ' filas   Σ ' + mil(filas.reduce(function (a, c) { return a + c.total.sends; }, 0)) +
  '   ' + (F2.length === filas.length ? '✔' : '🔴'));
// 🔴 EL CONTADOR LEE EL NOMBRE REAL DE LA COLUMNA. Leía `Content_ID` a secas cuando la hoja
//    las llama `Content_ID (SFMC)` / `Email_ID (SFMC)`: reportó «0 y 0» durante varias corridas
//    mientras escribía 60 y 60. Un contador que no encuentra la columna debe decir eso, no cero.
function cuantasCon(F2, base) {
  var nom = Object.keys(F2[0] || {}).filter(function (k) { return k === base || k.indexOf(base + ' ') === 0; })[0];
  if (!nom) return base + ': NO EXISTE la columna 🔴';
  return String(F2.filter(function (x) { return t(x[nom]); }).length);
}
console.log('     con Content_ID: ' + cuantasCon(F2, 'Content_ID') +
  '   ·   con Email_ID: ' + cuantasCon(F2, 'Email_ID') +
  '   ·   Insights: ' + (('Insights' in (F2[0] || {})) ? 'AÚN PRESENTE 🔴' : 'retirada ✔'));
console.log('\n  archivo listo en: ' + SECO);
