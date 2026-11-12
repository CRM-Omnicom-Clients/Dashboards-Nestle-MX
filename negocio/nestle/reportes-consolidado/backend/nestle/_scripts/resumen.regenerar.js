// N6r · REGENERAR el Report_Resumen desde la rejilla — filas = la rejilla, sin obsoletas.
//
// 🔴 POR QUÉ, y no el resumen-regenerar que actualiza por llave. A2/A3 RENOMBRARON piezas: Espresso Con → Hackea
//    tu café (campaña nueva) y J4-ConRegión → E-J4 (touchpoint nuevo). Emparejar una fila vieja con
//    su celda nueva por identidad es imposible cuando la identidad entera cambió, y reclamarla por
//    campaña falla cuando la CAMPAÑA es la que cambió. Regenerar desde la rejilla resuelve todo: la
//    hoja pasa a ser exactamente las celdas de la rejilla + las filas placeholder de Rick, sin
//    obsoletas. La fila de totales se recrea AL FINAL con SUM, como pidió Rick.
//
// 🔴 QUÉ SE CONSERVA de la hoja: las filas que Rick dejó con datos que la rejilla NO produce
//    (placeholders de 0 envíos, como The Freshers WA-A1). Una fila con datos (>0) cuya identidad no
//    está en la rejilla es OBSOLETA por renombre y se descarta —su dato ya vive en la celda nueva—.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';   // el ámbito de este skill dentro del catálogo raíz
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var VR = require(__dirname + '/lib-valores-resumen.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function serial(iso) { return iso ? Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000) : ''; }
var valorDe = VR.crear(serial, L.nmEncabezado);
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };

console.log('════════ N6r · REGENERAR Report_Resumen ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_n6r.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Report_Resumen'];
var COLS = XLSX.utils.sheet_to_json(sh, { header: 1 })[0].map(t);
var Rpre = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });

// ── 1 · las filas de la rejilla, ordenadas (atribuidas primero, luego por campaña/quincena/tp/seg)
// 🔴 LAS FILAS VAN EN EL ORDEN QUE RICK YA LES DIO. Lo nuevo se agrega al final.
//
//    POR QUÉ. Rick reordena el reporte a mano — es su entregable y su criterio de lectura.
//    Este paso REGENERA la hoja entera, así que si impone su propio orden le borra el suyo
//    sin dejar rastro y sin que ninguna suma cambie: ninguna puerta lo vería. Ya pasó en
//    agosto con una fila que había hecho a mano. Él lo dijo así el 4-sep-2026: «no rompas lo
//    que está, solo es ir agregando datos».
//
//    CÓMO. Se lee la posición de cada fila EN SU HOJA por la llave del reporte
//    (campaña¦objetivo¦touchpoint¦segmento¦quincena, la misma de `llaveDeFila`) y se ordena la
//    rejilla por esa posición. Una celda que su hoja no tiene todavía —una pieza nueva— no
//    tiene posición, y ésas van al final, entre ellas con el orden de siempre. Nunca se borra
//    una fila suya: las que la rejilla ya no produce siguen por el camino de los placeholders.
var posDeRick = {};
Rpre.forEach(function (fila, i) {
  var k = VR.llaveDeFila(fila, true);
  if (k && posDeRick[k] === undefined) posDeRick[k] = i;
});
var nuevas = [];
var celdas = R.rejilla.slice().sort(function (a, b) {
  var pa = posDeRick[VR.llaveDeFila(a, false)], pb = posDeRick[VR.llaveDeFila(b, false)];
  var na = pa === undefined, nb = pb === undefined;
  if (na !== nb) return na ? 1 : -1;              // lo nuevo, al final
  if (!na) return pa - pb;                        // lo que ya estaba, en SU orden
  if (a.campana_del_catalogo !== b.campana_del_catalogo) return a.campana_del_catalogo ? -1 : 1;
  return (a.campana + '¦' + a.quincena + '¦' + a.touchpoint + '¦' + a.segmento)
    .localeCompare(b.campana + '¦' + b.quincena + '¦' + b.touchpoint + '¦' + b.segmento);
});
celdas.forEach(function (c) { if (posDeRick[VR.llaveDeFila(c, false)] === undefined) nuevas.push(c); });
console.log('  orden: el de Rick para ' + (celdas.length - nuevas.length) + ' fila(s) que ya tenía' +
  (nuevas.length ? '   ·   🆕 ' + nuevas.length + ' fila(s) NUEVA(S), al final:' : '   ·   ninguna fila nueva'));
nuevas.forEach(function (c) {
  console.log('       + ' + c.campana + ' · ' + c.touchpoint + ' · ' + c.segmento + ' · ' + c.quincena +
    '   ' + ((c.total && c.total.sends) || 0).toLocaleString('es-MX') + ' envíos');
});
// el subject vive en la pieza; la rejilla ya lo trae en principal.subject/fup.subject

// ── 2 · las filas placeholder de Rick que la rejilla no produce (0 envíos, identidad no obsoleta)
var enRej = {};
celdas.forEach(function (c) { enRej[[L.nmz(c.campana), L.nmz(c.touchpoint), L.nmz(c.segmento)].join('¦')] = 1; });
var placeholders = [], obsoletas = [], residuo = [];
Rpre.forEach(function (x) {
  if (/total/i.test(t(x['Campaña'])) || /total/i.test(t(x['Medio']))) return;
  // 🔴 UNA FILA SIN IDENTIDAD NO ES UNA FILA. Se encontraron 15 con SOLO `Principal_Subject` lleno
  //    y nada más: ni campaña, ni touchpoint, ni segmento. Son residuo de una escritura anterior,
  //    no placeholders de Rick — y N6r las conservaba porque tienen 0 envíos y no están en la
  //    rejilla, engordando el reporte con filas fantasma. Un placeholder legítimo TIENE identidad:
  //    es una fila que Rick puso para algo que va a salir.
  if (!t(x['Campaña']) && !t(x['TouchPoint'])) { residuo.push(x); return; }
  var k = [L.nmz(t(x['Campaña'])), L.nmz(t(x['TouchPoint'])), L.nmz(t(x['Segmento']))].join('¦');
  if (enRej[k]) return;                       // ya la produce la rejilla
  // 🔴 «con datos» = CUALQUIER medio, no solo email. La fila The Freshers WA-A1 con Segmento vacío
  //    tiene 0 envíos de email pero 2,000 de WhatsApp — que YA están en su celda de la rejilla
  //    (misma pieza, segmento resuelto). Contar solo Tot_Sends la dejaba pasar como placeholder y
  //    duplicaba 2,000 WhatsApp: es exactamente el defecto que la memoria documentó.
  var sends = num(x['Tot_Sends']) + num(x['WA-Envíos']) + num(x['Carritos_Total']);
  if (sends > 0) obsoletas.push({ campana: t(x['Campaña']), tp: t(x['TouchPoint']), seg: t(x['Segmento']), sends: sends });
  else placeholders.push(x);                  // sin datos en ningún medio: placeholder de Rick, se conserva
});

console.log('  rejilla: ' + celdas.length + ' celdas   ·   placeholders de Rick (0 envíos): ' + placeholders.length +
  '   ·   obsoletas descartadas: ' + obsoletas.length +
  (residuo.length ? '   ·   🔴 residuo SIN IDENTIDAD descartado: ' + residuo.length : ''));
if (residuo.length) console.log('     (filas sin Campaña ni TouchPoint: restos de una escritura anterior, no placeholders)');
if (obsoletas.length) obsoletas.forEach(function (o) {
  console.log('     − ' + o.campana.padEnd(16) + o.tp.padEnd(14) + o.seg.slice(0, 20).padEnd(22) + mil(o.sends) + ' (su dato vive en la celda nueva)');
});

var totalFilas = celdas.length + placeholders.length;
var sumaRej = celdas.reduce(function (a, c) { return a + c.total.sends; }, 0);
console.log('  filas de datos que quedarán: ' + totalFilas + '   ·   Σ Tot_Sends (rejilla): ' + mil(sumaRej));

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// libre
try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); } catch (e) { console.log('\n  🔴 vivo TOMADO (' + e.code + ')'); process.exit(2); }

// ── 3 · regenerar el sheetData
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);

// estilos: por columna, de la fila 2; encabezado de la fila 1; totales de la última fila del XML
var estCol = {}, estEnc = {};
COLS.forEach(function (n, i) { estCol[i] = CX.estiloDe(xml, col(i) + '2'); estEnc[i] = CX.estiloDe(xml, col(i) + '1'); });
var ultXml = 1; xml.replace(/<row r="(\d+)"/g, function (_, n2) { ultXml = Math.max(ultXml, +n2); return _; });
var estTot = {}; COLS.forEach(function (n, i) { estTot[i] = CX.estiloDe(xml, col(i) + ultXml) || estCol[i]; });

var filaEnc = (/<row r="1"[^>]*>[\s\S]*?<\/row>/.exec(xml) || [''])[0] ||
  ('<row r="1">' + COLS.map(function (n, i) { return CX.celda(col(i) + '1', n, estEnc[i]); }).join('') + '</row>');

// las filas de datos: primero las celdas de la rejilla, luego los placeholders
var cuerpo = '', nf = 1;
// 🔴 EL TOTAL SE ACUMULA MIENTRAS SE ESCRIBE, no se recalcula después leyendo la hoja. Releer para
//    sumar sería medir el resultado con el mismo lector que lo produjo — el círculo que este
//    proyecto ya pagó caro. Aquí el total sale de los MISMOS valores que se escribieron en la celda.
//    Solo suma lo que es número: un «—» o un «N/A» no entra, y no convierte el total en NaN.
var SUMA = {}, SIN_FUENTE = {};
function acumular(i, v) {
  if (typeof v === 'number') { if (isFinite(v)) SUMA[i] = (SUMA[i] || 0) + v; return; }
  var s = String(v).trim();
  if (!s || /^[—–-]$/.test(s) || /^(N\/A|PENDIENTE)$/i.test(s)) return;
  var n = Number(s.replace(/[, $%]/g, ''));
  if (isFinite(n) && /^[\d.,$ %-]+$/.test(s)) SUMA[i] = (SUMA[i] || 0) + n;
}
celdas.forEach(function (c) {
  nf++;
  var cs = [];
  COLS.forEach(function (nom, i) {
    if (!nom) return;
    var v = valorDe(nom, c);
    // 🔴 SE CUENTA QUÉ COLUMNAS NO SABE LLENAR LA LIBRERÍA. Un `undefined` aquí no es «esta celda
    //    va vacía»: es «nadie produce esta columna», y hasta hoy se escribía en blanco sin decir
    //    nada. Así se perdió `Quincena_Lanzamiento Principal` en las 76 filas — y como la quincena
    //    está en la llave del reporte, la Puerta 2 acabó viendo las 76 filas como «de Rick» y los
    //    insights se quedaron sin dónde escribirse. Una columna muda tumbó el cierre del corte.
    if (v === undefined) (SIN_FUENTE[nom] = (SIN_FUENTE[nom] || 0) + 1);
    if (v === undefined || v === null || v === '') { cs.push(CX.celda(col(i) + nf, '', estCol[i])); return; }
    acumular(i, v);
    cs.push(CX.celda(col(i) + nf, v, estCol[i]));
  });
  cuerpo += '<row r="' + nf + '">' + cs.join('') + '</row>';
});
placeholders.forEach(function (x) {
  nf++;
  var cs = [];
  COLS.forEach(function (nom, i) {
    if (!nom) return;
    var v = x[nom];
    if (v !== undefined && v !== null && v !== '') acumular(i, v);
    cs.push(CX.celda(col(i) + nf, (v === undefined || v === null) ? '' : v, estCol[i]));
  });
  cuerpo += '<row r="' + nf + '">' + cs.join('') + '</row>';
});

// ── 4 · la fila de TOTALES, al final. SUM en las columnas de conteo; vacío en identidad y tasas.
//
// 🔴 LA FÓRMULA VA CON SU `result` — es una regla del proyecto y aquí se estaba incumpliendo.
//    La fila salía como `<c><f>SUM(...)</f></c>`, sin `<v>`. Excel la calcularía al abrir, pero
//    CUALQUIER otro lector ve una celda vacía: los guardianes, el guardián de llegada, Datorama,
//    y quien abra el archivo en Excel Online. Medida desde fuera, la fila «Total» tenía UNA celda
//    con dato —la etiqueta— y 82 vacías, mientras las 76 filas de arriba suman 4,992,922.
//    Y no se puede tapar recalculando: Excel COM no abre en esta máquina, así que el valor tiene
//    que salir de aquí. Se acumula al escribir cada fila y se emite junto a la fórmula.
// 🔴 19-sep-2026 · `_Clicks_(CTA|Baja|Redes)` ENTRA EXPLÍCITO. Las 9 columnas nuevas del desglose
//    NO las recogía ninguna alternativa del regex: `_Clicks$` pide que `Clicks` sea el final
//    (`Principal_Clicks_CTA` no lo es) y `^Clicks_` pide que sea el principio. Sin esta alternativa
//    caían al `else` y la fila de totales les escribía `N/A` encima — una columna con 35,939 clicks
//    arriba y «no aplica» en el total. Es el mismo defecto que ya costó `Tot_UTOR (vs opens)` y
//    `WA-Clicks`: el regex no falla, se salta la columna en silencio.
//    Las celdas `POR DEFINIR`/`N/A` no estorban: no pasan el filtro numérico de `SUMA` y `SUM()` de
//    Excel también ignora texto, así que el valor cacheado y la fórmula dicen lo mismo.
// 🔴 24-sep-2026 · `Medidos` ENTRA EN LA ALTERNATIVA. Es el mismo defecto de siempre: el regex no
//    falla, se salta la columna en silencio. `_Clicks_(CTA|Baja|Redes)` no cubre `Clicks_Medidos`
//    y `_Clicks$` pide que `Clicks` sea el final, así que la columna nueva habría caído al `else`
//    y la fila de totales le habría escrito `N/A` encima de una columna con ~97,000 clicks.
var SUMABLES = /_(Sends|Deliveries|Opens|Clicks|Bounces)$|_Clicks_(CTA|Baja|Redes|Medidos)|^WA-(Env|Entreg|No entreg|Le|Clicks)|Carritos|^Views|Intencion|Audiencia_Volumen|Unsubs|^Clicks_/;

// 🔴 D5 · LAS COLUMNAS RETIRADAS ESTE CORTE (Rick, 26-ago-2026) — el desglose de clicks por
//    destino, MENOS Unsubscribe. Van declaradas aquí porque la fila de totales tiene que saberlo:
//    `^Clicks_` las mete en SUMABLES y habría emitido `SUM(BR2:BR77)` con un 0 cacheado. Un 0 en
//    la fila de totales de una columna vacía **se lee como una medición**, y es justo lo contrario:
//    es una columna que decidimos no reportar. Se deja VACÍA, arriba y en el total.
//    No están retiradas de la hoja ni de `_fuentes/links.json`: está retirada la AFIRMACIÓN.
var RETIRADAS = {
  'Clicks_Qcart': 1, 'Clicks_App': 1, 'Clicks_Social': 1, 'Clicks_Web': 1, 'Clicks_Ver_Navegador': 1,
  '%_Qcart': 1, '%_App': 1, '%_Social': 1, '%_Web': 1, '%_Ver_Navegador': 1,
  'Views_vs_Clicks_%': 1, 'Carritos_vs_Clicks_%': 1
};

// 🔴 UNA TASA NO SE SUMA — SE RECALCULA. La fila de totales dejaba vacías las 22 columnas de tasa,
//    y con razón: sumar porcentajes es falso. Pero «vacío» tampoco es la respuesta, porque Rick
//    pidió cero celdas vacías y porque un total SÍ tiene tasa: la de los totales.
//    Se declara la pareja numerador/denominador de cada una y se emite Σnum/Σden con su fórmula.
//    (`WA-Clicks` además no entraba en SUMABLES: el regex decía `^WA-(Env|Entreg|No entreg|Le)`
//     y se lo saltaba. Salía vacía en totales mientras las 77 filas de arriba tenían números.)
var RAZONES = {
  'Principal_Open_Rate':  ['Principal_Opens', 'Principal_Deliveries'],
  'Principal_CTOR':       ['Principal_Clicks', 'Principal_Opens'],
  'Principal_Click_Rate': ['Principal_Clicks', 'Principal_Deliveries'],
  'FUP_Open_Rate':        ['FUP_Opens', 'FUP_Deliveries'],
  'FUP_CTOR':             ['FUP_Clicks', 'FUP_Opens'],
  'FUP_Click_Rate':       ['FUP_Clicks', 'FUP_Deliveries'],
  'Tot_Open_Rate':        ['Tot_Opens', 'Tot_Deliveries'],
  'Tot_CTOR':             ['Tot_Clicks', 'Tot_Opens'],
  'Tot_Click_Rate':       ['Tot_Clicks', 'Tot_Deliveries'],
  '%_Unsub':              ['Clicks_Unsub', 'Clicks_Unicos_Total'],
  '% Unsuscribe':         ['Unsubs_Unicos', 'Tot_Sends'],
  // 🔴 el nombre físico de la hoja, que es el que llega en `nom`. Sin esta llave la fila de
  //    totales caía al `else` y escribía `N/A` sobre una columna que sí tiene su razón.
  '% Unsuscribe vs sends': ['Unsubs_Unicos', 'Tot_Sends'],
  '% Unsub vs Clicks':    ['Unsubs_Unicos', 'Tot_Clicks'],
  // 🔴 4-sep-2026 · LAS BAJAS POR BLOQUE EN LA FILA DE TOTALES. Una tasa no se suma: se
  //    recalcula como Σnumerador/Σdenominador. Sin su pareja declarada, estas seis columnas
  //    caían al `else` y escribían `N/A` sobre una columna que sí tiene total.
  'Principal_UTOR (vs opens)':       ['Principal_Unsubs', 'Principal_Opens'],
  'FUP_UTOR (vs opens)':             ['FUP_Unsubs', 'FUP_Opens'],
  // 🔴 EL NUMERADOR ES `Tot_Unsubs`, NO `Unsubs_Unicos`: esa columna no está en la hoja, así que
  //    la razón no resolvía y la fila de totales escribió «POR DEFINIR» sobre un total que sí
  //    existe. Una razón que apunta a una columna inexistente no falla: se queda callada.
  'Tot_UTOR (vs opens)':             ['Tot_Unsubs', 'Tot_Opens'],
  'WA-%Entrega':          ['WA-Entregados', 'WA-Envíos'],
  'WA-%No entrega':       ['WA-No entregados', 'WA-Envíos'],
  'WA-%Read vs entrega':  ['WA-Leídos', 'WA-Entregados'],
  'WA-%Click vs Read':    ['WA-Clicks', 'WA-Leídos'],
  // 🔴 D5 (Rick, 26-ago-2026) · RETIRADAS CON SU NUMERADOR. `%_Qcart · %_App · %_Social · %_Web ·
  //    %_Ver_Navegador` salían de aquí como Σnum/Σden en la fila de totales. Si se retira el
  //    numerador y se deja la razón, el total emite `0/43,284 = 0%` — que **no es un cero, es una
  //    columna sin medir presentada como cero**. Peor que el dato mal atribuido, porque un 0%
  //    parece una lectura. La razón se va con su numerador.
  //    `%_Unsub` se queda: es la única del desglose que Rick usa.
  'Pct_Penetracion_Nestle': ['Intencion_Nestle_MXN', 'Intencion_Total_MXN'],
  'Ticket_Carrito_MXN':   ['Intencion_Total_MXN', 'Carritos_Total'],
  'Ticket_Producto_MXN':  ['Intencion_Nestle_MXN', 'Views_Productos_Nestle'],
  'Tasa_Productos_a_Carritos': ['Views_Productos_Nestle', 'Carritos_Total']
  // 🔴 `Views_vs_Clicks_%` y `Carritos_vs_Clicks_%` también se retiran: dividían entre
  //    `Clicks_Qcart`, que ya no se escribe. Una razón cuyo denominador está vacío no da un
  //    número prudente, da #DIV/0 o un cero inventado.
};

// 🔴 LO QUE NO ES DATO NI TASA EN LA FILA DE TOTALES ES `N/A`, Y LA RAZÓN SE PUEDE ESCRIBIR:
//    «fila de totales — la dimensión no aplica». Ésa es la prueba que exige `lib-vacios`: si la
//    razón se puede escribir, es N/A; si no, es POR DEFINIR. Un total no tiene campaña, ni
//    segmento, ni asunto, ni insight — y decirlo con `N/A` es más honesto que dejarlo en blanco,
//    porque el blanco también significa «no lo tengo» y aquí sí lo sabemos.
var RAZON_TOTAL_NA = 'fila de totales — la dimensión no aplica a un agregado';
var faltanRazon = [], razonesPuestas = 0, naTot = 0;
nf++;
var filaTot = '<row r="' + nf + '">';
COLS.forEach(function (nom, i) {
  if (!nom) return;
  var ref = col(i) + nf;
  if (i === 0) { filaTot += CX.celda(ref, 'Total', estTot[i]); return; }
  // 🔴 D5 · una columna retirada no suma, no promedia y no dice N/A: queda vacía, como sus filas.
  if (RETIRADAS[nom]) { filaTot += CX.celda(ref, '', estTot[i]); return; }
  if (SUMABLES.test(nom)) {
    // SUM sobre las filas de datos (2 .. nf-1), CON su resultado cacheado
    var f = 'SUM(' + col(i) + '2:' + col(i) + (nf - 1) + ')';
    var tot = SUMA[i] || 0;
    filaTot += '<c r="' + ref + '"' + (estTot[i] !== undefined ? ' s="' + estTot[i] + '"' : '') +
      '><f>' + f + '</f><v>' + tot + '</v></c>';
  } else if (RAZONES[nom]) {
    var par = RAZONES[nom];
    var iN = COLS.indexOf(par[0]), iD = COLS.indexOf(par[1]);
    if (iN < 0 || iD < 0) {
      // 🔴 la pareja está declarada pero una de las dos columnas no existe en la hoja: NO se
      //    inventa un cero. Se deja constancia y la celda queda como POR DEFINIR — lo mismo que
      //    haría `lib-vacios` cuando no se puede escribir la razón.
      faltanRazon.push(nom + ' (falta ' + (iN < 0 ? par[0] : par[1]) + ')');
      filaTot += CX.celda(ref, 'POR DEFINIR', estTot[i]);
    } else {
      var den = SUMA[iD] || 0;
      var f2 = den ? col(iN) + nf + '/' + col(iD) + nf : null;
      var val = den ? (SUMA[iN] || 0) / den : null;
      if (f2 === null) { filaTot += CX.celda(ref, 'N/A', estTot[i]); naTot++; }
      else {
        filaTot += '<c r="' + ref + '"' + (estTot[i] !== undefined ? ' s="' + estTot[i] + '"' : '') +
          '><f>' + f2 + '</f><v>' + val + '</v></c>';
        razonesPuestas++;
      }
    }
  } else {
    // identidad y texto: el total no tiene campaña ni asunto, y eso SÍ se puede escribir
    filaTot += CX.celda(ref, 'N/A', estTot[i]);
    naTot++;
  }
});
filaTot += '</row>';
console.log('  ── fila de totales: ' + razonesPuestas + ' tasa(s) recalculadas Σnum/Σden  ·  ' + naTot + ' celda(s) N/A (la dimensión no aplica a un agregado)');
if (faltanRazon.length) console.log('     ⚠ sin poder recalcular, quedan POR DEFINIR: ' + faltanRazon.join(' · '));

xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + filaEnc + cuerpo + filaTot + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)\d+:([A-Z]+)\d+"\/>/, function (_, c1, c2) { return '<dimension ref="' + c1 + '1:' + c2 + nf + '"/>'; });
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

// 🔴 LAS COLUMNAS QUE NADIE SABE LLENAR — se dicen, no se dejan en blanco en silencio.
//
// ⚠ PERO NO TODAS LAS VACÍAS SON UN DEFECTO. Este paso deja a propósito columnas que llena una
//   ETAPA POSTERIOR de la cadena, y exigirlas aquí sería medir el trabajo de otro skill — el
//   mismo error que ya se corrigió en `N6-99`. Un check que siempre falla enseña a ignorar el rojo.
//   Se declaran con quién las llena, para que la distinción no dependa de acordarse.
var LAS_LLENA_OTRO = {
  'Insights': 'etapa 13 · crm-reporte-nestle-insights'
};
var todasVacias = Object.keys(SIN_FUENTE).filter(function (n) { return SIN_FUENTE[n] >= celdas.length; });
var mudas = todasVacias.filter(function (n) { return !LAS_LLENA_OTRO[n]; });
var esperadas = todasVacias.filter(function (n) { return LAS_LLENA_OTRO[n]; });
if (esperadas.length) {
  console.log('\n  ○ vacías a propósito, las llena una etapa posterior:');
  esperadas.forEach(function (n) { console.log('     · «' + n + '» → ' + LAS_LLENA_OTRO[n]); });
}
if (mudas.length) {
  console.log('\n  🔴 ' + mudas.length + ' columna(s) que la librería NO sabe llenar — salen VACÍAS en las ' + celdas.length + ' filas:');
  mudas.forEach(function (n) { console.log('     · «' + n + '»'); });
  console.log('     No es «esta celda va vacía»: es que nadie produce esa columna. Si alguna forma');
  console.log('     parte de la llave del reporte, la Puerta 2 no podrá cruzar ninguna fila.');
}

console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
var cp = require('child_process'); var TOOLS = require(__dirname + '/lib-entorno.js').TOOLS;
function q(x) { return String.fromCharCode(34) + x + String.fromCharCode(34); }
cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-label.js') + ' ' + q(SECO), { timeout: 120000 });
cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-check.js') + ' ' + q(SECO), { timeout: 120000 });
console.log('  ── etiqueta + check ✔');

// verificar releyendo
var wb2 = XLSX.readFile(SECO);
var F2 = XLSX.utils.sheet_to_json(wb2.Sheets['Report_Resumen'], { defval: '', blankrows: false });
var datos = F2.filter(function (x) { return !/total/i.test(t(x['Campaña'])); });
var sT = datos.reduce(function (a, x) { return a + num(x['Tot_Sends']); }, 0);
console.log('\n  ── releído: ' + F2.length + ' filas (' + datos.length + ' datos + totales)   Σ Tot_Sends ' + mil(sT) +
  '   ' + (sT === sumaRej ? '✔' : '🔴 esperaba ' + mil(sumaRej)));
var vac = datos.filter(function (x) { return !t(x['Tipo  Email']); }).length;
console.log('     Tipo Email lleno: ' + (datos.length - vac) + '/' + datos.length + '   ·   con Email_Name: ' +
  datos.filter(function (x) { return t(x['Email_Name']); }).length);

console.log('\n  archivo listo en: ' + SECO + '   (aún NO publicado al vivo)');
