/*
 * motor.hoja-clicks.js — construye `Data_Clicks` y `Dic_Clicks`: el detalle y el diccionario.
 *
 * 🔴 RICK, 20-sep-2026: «asegúrate con una metodología muy clara de contar bien y medir bien, si
 *    es posible ten una hoja donde estén esos datos bajados bien... para que doble valides tus
 *    cálculos». Esto es eso, y la idea de fondo es suya: **si no puedes ver el detalle y sumarlo
 *    tú, no hay doble validación — hay una promesa mía.**
 *
 * DOS HOJAS, Y CADA UNA RESPONDE UNA PREGUNTA DISTINTA:
 *   · `Data_Clicks` — el DETALLE. Una fila por pieza × clase × URL, con sus clicks y de qué fuente
 *     salieron. Se puede filtrar por clase, sumar a mano, y comparar contra la columna del reporte.
 *   · `Dic_Clicks` — el DICCIONARIO. Una fila por clase: qué es, qué patrones la definen, a qué
 *     columna del reporte alimenta, y cuántos clicks trae cada fuente. Es el contrato, legible.
 *
 * 🔴 LAS URLs TOKENIZADAS SE AGRUPAN, Y SE DICE CUÁNTAS. El link de baja de SFMC es único por
 *    suscriptor (`cloud.email.mx.nestle.com/Unsubscribe?qs=...`), igual que el de ver-en-navegador
 *    (`?vawpToken=...`). Escribir una fila por cada uno serían miles de filas ilegibles que dicen
 *    lo mismo. Se colapsan en una fila por pieza × clase con su `N_URLs`, para que el número sea
 *    verificable sin que la hoja sea basura.
 *
 * 🔴 DOS FUENTES, DECLARADAS FILA POR FILA. `Clicks_DE` sale de `CRM_Email_Links` (único por LINK);
 *    `Clicks_Plataforma` sale de `ClickEvent` (TOTALES por URL). No se suman entre ellas nunca:
 *    miden cosas distintas. La columna `Fuente` dice de dónde vino cada fila, y la 5ª validación
 *    del contrato es justamente cruzarlas.
 *
 *   node motor.hoja-clicks.js              (seco: la forma y los totales)
 *   node motor.hoja-clicks.js --escribir   (crea/actualiza las dos hojas)
 */
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();

// 🔴 ANCLADO AL CATÁLOGO RAÍZ (19-sep-2026, al entrar a la cadena). `lib-columna` consulta
//    `_contratos/registro.json` —id lógico inmutable → nombre físico actual— ANTES que a la hoja,
//    y TRUENA si un id no resuelve. Este script vivía fuera del ciclo y leía sus columnas por
//    literal; al cablearlo a la cadena, la guarda 5 bloqueó el corte, con razón: un script del
//    corte que lee por literal sobrevive a un renombre devolviendo `undefined`, y `undefined` se
//    lee como «vacío». Es exactamente lo que acabó de costar 6,471 clicks en `lib-canonico`.
var COL = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');
var L = require(BACK + '/_scripts/lib-flexible.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var NL = String.fromCharCode(10);

// ══ A QUÉ COLUMNA DEL REPORTE ALIMENTA CADA CLASE ══════════════════════════════════
// 🔴 Rick, 20-sep-2026: «ver en navegador + aviso legal esto va en redes». Queda declarado aquí
//    porque es una decisión suya, no una consecuencia del contrato de destinos. Y con una nota
//    honesta: de los clicks que caen en `Clicks_Redes`, alrededor del 39% NO son redes —son
//    plomería del correo. La columna se llama así porque él la nombró; el diccionario lo aclara.
// 🔴 EL NOMBRE LARGO ES DELIBERADO. Rick, 20-sep-2026: primero dijo que ver-en-navegador y aviso
//    legal fueran a «Redes»; cuando le avisé que entonces ~39% de esa columna no serían redes,
//    decidió: «ponle redes+navegador+legal, así lo nombras aunque sea largo». Una columna que dice
//    exactamente lo que contiene no necesita que nadie recuerde una nota al pie.
// 🔴 EL MAPA CLASE→COLUMNA SE PIDE, NO SE ESCRIBE AQUÍ. Vivía en este archivo, y el reporte iba a
//    necesitar el mismo mapa para sus nueve columnas: dos copias del mismo reparto es cómo la hoja
//    y el reporte acaban contando el mismo click en columnas distintas, cada uno cuadrando consigo
//    mismo. Ahora la autoridad es `lib-clicks-destino` y `columnaDe()` TRUENA si una clase nueva no
//    tiene columna declarada — en vez de caer callada en `'(sin columna)'`, que es lo que hacía el
//    `|| '(sin columna)'` de más abajo y habría escondido una clase nueva del contrato.
var COL_CTA = CD.COL_CTA, COL_BAJA = CD.COL_BAJA, COL_RNL = CD.COL_RNL;
var NOTA_RNL = 'Rick decidió el 20-sep-2026 que ver-en-navegador y aviso legal van en esta columna, y que el nombre lo dijera: «ponle redes+navegador+legal aunque sea largo». De su total, las redes sociales son ~61% y el resto es plomería del correo. El desglose exacto está en Data_Clicks.';
// 🔴 ESTA NOTA SE QUEDÓ DESFASADA Y HABÍA QUE CORREGIRLA, NO DEJARLA. Decía «por eso las tres
//    columnas no suman Clicks totales — la diferencia son estos destinos sin clasificar», y era
//    cierto cuando había 854 clicks sin clasificar. El 19-sep Rick resolvió `nes.tl/31266c` («seguro
//    sí es CTA») y `formSubmit` quedó en contenido: `por_clasificar` bajó a 0 y las tres columnas
//    SÍ suman los 45,424 de la DE. Una nota que explica una diferencia que ya no existe no es
//    inofensiva: hace que el lector busque un hueco que no hay, o que descarte un hueco real
//    creyendo que es «el de siempre».
var NOTA_PC = 'Hoy está en CERO: no hay ningún destino sin clasificar, así que las tres columnas suman exactamente el total de clicks de la DE (45,424). Esta clase existe para que un destino NUEVO aparezca como pregunta y no se cuele en una columna: si algún día vuelve a tener clicks, la diferencia entre las tres columnas y el total es ese hueco, declarado y no escondido. Nunca alimenta una columna — meterlo en Redes+Navegador+Legal haría que ese nombre dejara de ser cierto.';

var TOKENIZADA = /cloud\.email\.mx\.nestle\.com\/Unsubscribe|vawpToken|pages\.email\.mx\.nestle\.com\/page\.aspx/i;

console.log('════════ motor · HOJA DE CLICKS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);

// ── el catálogo, para las dimensiones de cada pieza ────────────────────────────────
var tmp = os.homedir() + '/.claude/reportes-backend/nestle/_tmp/_hclicks.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var wb = XLSX.readFile(tmp);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
// 🔴 las columnas del catálogo se PIDEN. `COL.de` devuelve el encabezado REAL de la hoja o truena;
//    así un renombre se resuelve en el registro, no aquí, y nunca en silencio.
var cID = COL.de(CAT, 'Pieza_ID', AMBITO_CATALOGO);
var cCAMP = COL.de(CAT, 'Campaña', AMBITO_CATALOGO);
var cTP = COL.de(CAT, 'TouchPoint', AMBITO_CATALOGO);
var cSEG = COL.de(CAT, 'Segmento', AMBITO_CATALOGO);
var cCANAL = COL.de(CAT, 'Canal', AMBITO_CATALOGO);
var dim = {};
CAT.forEach(function (p) {
  var id = t(p[cID]); if (!id) return;
  dim[id] = { camp: t(p[cCAMP]), tp: t(p[cTP]), seg: t(p[cSEG]), canal: t(p[cCANAL]) };
});

// 🔴 LA LLAVE ES EL NOMBRE, NO EL ConfigKey — y la validación lo cazó. La primera versión usaba
//    `ConfigKey` directo y 237 filas quedaron sin campaña: SFMC todavía publica el ConfigKey
//    PROVISIONAL (`TMP-AON-EAPP`, `TMP-MAGGI-J8`) para las piezas que nacieron después de que la
//    numeración fuera nuestra. Es el mismo defecto que ya costó 34 piezas y 3,544 clicks en
//    `motor.links.js`, y por eso ese script cruza por ContentName. Aquí se hace igual: se resuelve
//    el `Pieza_ID` por el NOMBRE del envío y solo se cae al ConfigKey si el nombre no cruza.
/* 🔴 19-sep-2026 · EL CRUCE POR NOMBRE SE LE PIDE A `lib-canonico`. Este script tenía su PROPIO
 *    índice (`porNombre[nom.toLowerCase()] = id`), `motor.links.js` tenía otro, y `lib-canonico`
 *    tenía el canónico. Tres resolutores para una sola pregunta: «¿de qué pieza es este envío?».
 *    Y no daban lo mismo — el de `motor.links.js` dejó 28 piezas y 6,471 clicks (14.2%) fuera del
 *    reporte mientras éste resolvía 931 de 931, cada uno cuadrando consigo mismo.
 * 🔴 Y EL PROPIO DE ESTE ARCHIVO ELEGÍA EN SILENCIO: al asignar `porNombre[n] = id` sin comprobar,
 *    la última pieza pisaba a la anterior cuando dos comparten nombre — y hay 20 nombres así
 *    (las piezas padre de Pro Plan declaran los nombres de sus hijas, y las gemelas de AON). Eso
 *    atribuía clicks a la pieza equivocada con la suma cuadrando. El índice canónico marca AMBIGUO
 *    y no elige: esas filas se caen al ConfigKey, visibles, en vez de aterrizar en la pieza de al lado. */
var CNH = require(BACK + '/_scripts/lib-canonico.js');
var IXH = CNH.indexarPiezas(CAT);
var viaCruce = { nombre: 0, configkey: 0, ambiguo: 0, ninguna: 0 };
function piezaDe(r) {
  var cands = [t(r.Email_Content_Name), t(r.EmailName)];
  var ambiguo = false;
  for (var i = 0; i < cands.length; i++) {
    if (!cands[i]) continue;
    var hit = IXH.porContent[CNH.nm(cands[i])];
    if (!hit) continue;
    if (hit === '¦AMBIGUO¦') { ambiguo = true; continue; }
    viaCruce.nombre++;
    return t(hit[cID]);
  }
  var ck = t(r.ConfigKey);
  if (ambiguo) viaCruce.ambiguo++;
  if (ck && dim[ck]) { viaCruce.configkey++; return ck; }
  viaCruce.ninguna++;
  return ck || '(sin llave)';
}

// ── FUENTE 1 · CRM_Email_Links ────────────────────────────────────────────────────
function vig(p) {
  var re = new RegExp('^' + p + '-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.txt$');
  return fs.readdirSync(BACK + '/_insumos').filter(function (x) { return re.test(x); }).sort().pop();
}
var LKf = vig('sfmc-links');
var LK = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + LKf, 'utf8')).rows;

// ── FUENTE 2 · ClickEvent, ya procesado ───────────────────────────────────────────
var CEf = vig('sfmc-clickevent');
var CE = CEf ? JSON.parse(fs.readFileSync(BACK + '/_insumos/' + CEf, 'utf8')) : { detalle: [] };
// el detalle guardado es por clase; para el por-URL se releen los archivos de la herramienta
var DIRTR = os.homedir() + '/.claude/projects/C--Users-Ricardo-Aguilar-OneDrive---OneWorkplace-Marketing-Automation-Kinesso---Librer-a-Sharepoint-MAK-Nestl--Reportes-Nestl-/3b8bfb8b-6ec3-479c-b781-b2110841f5b9/tool-results';
var piezaDeJob = {};
CE.detalle.forEach(function (x) { if (!x.truncated) piezaDeJob[String(x.job)] = x.pieza; });

console.log('  fuente 1 · ' + LKf + '   ' + LK.length + ' links');
console.log('  fuente 2 · ' + (CEf || '(ninguna)') + '   ' + CE.detalle.filter(function (x) { return !x.truncated; }).length + ' jobs completos');

// ── construir las filas ───────────────────────────────────────────────────────────
// llave: pieza ¦ clase ¦ url (o pieza ¦ clase ¦ '(tokenizadas)' cuando lo son)
var filas = {};
/* 🔴 LAS DIMENSIONES DE UNA FILA CUYA PIEZA ES AMBIGUA. Si el nombre lo comparten dos piezas no se
 *    sabe de cuál es el envío, pero sí se sabe todo lo que las dos contestan igual: las candidatas
 *    de Pro Plan son las dos «Fuel for life · E-E3 · Pro Plan Aspiracionales». Sin esto quedaban
 *    45 filas sin campaña **teniendo la campaña delante**, y la salida fácil —elegir la primera
 *    candidata— es el defecto que la guarda de ambigüedad existe para impedir.
 *    El `Pieza_ID` NO se rellena: que se sepa la campaña no autoriza a inventar la llave. */
var NMC = { camp: cCAMP, tp: cTP, seg: cSEG };
function dimDe(pieza, r) {
  if (dim[pieza]) return dim[pieza];
  var cands = [t(r && r.Email_Content_Name), t(r && r.EmailName)];
  for (var i = 0; i < cands.length; i++) {
    if (!cands[i]) continue;
    var res = CNH.dimensionesDeNombre(IXH, cands[i], [NMC.camp, NMC.tp, NMC.seg]);
    if (res && !res.unica) {
      return { camp: res.valores[NMC.camp], tp: res.valores[NMC.tp], seg: res.valores[NMC.seg], canal: '', via: 'candidatas que coinciden' };
    }
  }
  return {};
}
function fila(pieza, clase, url, tok, r) {
  var k = pieza + '¦' + clase + '¦' + (tok ? '(tokenizadas)' : url);
  if (!filas[k]) {
    var d = dimDe(pieza, r) || {};
    filas[k] = {
      Pieza_ID: pieza, Campaña: d.camp || '', TouchPoint: d.tp || '', Segmento: d.seg || '',
      Clase: clase, Familia: CD.familia(clase), Va_En_Columna: CD.columnaDe(clase),
      URL: tok ? '(URLs tokenizadas por suscriptor — se agrupan)' : url,
      N_URLs: 0, Clicks_DE: 0, Clicks_Plataforma: 0, Fuente: '', Notas: ''
    };
  }
  return filas[k];
}

LK.forEach(function (r) {
  var pz = piezaDe(r); if (!pz || pz === '(sin llave)') return;
  var u = t(r.Link_URL), c = CD.clase(u, t(r.Link_Name));
  var tok = TOKENIZADA.test(u);
  var f = fila(pz, c, u.slice(0, 230), tok, r);
  f.N_URLs++; f.Clicks_DE += num(r.Clicks_Unique);
  f.Fuente = f.Fuente.indexOf('DE') >= 0 ? f.Fuente : (f.Fuente ? f.Fuente + ' + DE' : 'DE');
});

var jobsLeidos = 0;
if (fs.existsSync(DIRTR)) {
  fs.readdirSync(DIRTR).filter(function (x) { return /sfmc_get_clicks/.test(x); }).forEach(function (x) {
    var P; try { P = JSON.parse(fs.readFileSync(path.join(DIRTR, x), 'utf8')); } catch (e) { return; }
    if (!P || !P.topUrls || P.truncated) return;
    var pz = piezaDeJob[String(P.jobId)]; if (!pz) return;
    jobsLeidos++;
    P.topUrls.forEach(function (y) {
      var u = t(y.url), c = CD.clase(u, '');
      var tok = TOKENIZADA.test(u);
      var f = fila(pz, c, u.slice(0, 230), tok, null)   // la rama de ClickEvent no tiene fila de la DE: la pieza viene del job;
      if (f.Clicks_DE === 0) f.N_URLs++;      // si la DE no la vio, la cuenta la plataforma
      f.Clicks_Plataforma += num(y.clicks);
      f.Fuente = f.Fuente.indexOf('Plataforma') >= 0 ? f.Fuente : (f.Fuente ? f.Fuente + ' + Plataforma' : 'Plataforma');
    });
  });
}
console.log('  jobs de la plataforma incorporados: ' + jobsLeidos);
console.log('  cruce de la DE a pieza: por NOMBRE ' + viaCruce.nombre + '   ·   por ConfigKey ' + viaCruce.configkey +
  '   ·   sin cruzar ' + viaCruce.ninguna);

var FILAS = Object.keys(filas).map(function (k) { return filas[k]; });
FILAS.forEach(function (f) {
  if (f.Fuente === 'Plataforma') f.Notas = 'la DE no ve este destino (URL tokenizada por suscriptor)';
  if (f.Clase === 'por_clasificar') f.Notas = 'ningún patrón del contrato reconoce este destino — necesita decisión';
});
FILAS.sort(function (a, b) {
  if (a.Pieza_ID !== b.Pieza_ID) return a.Pieza_ID.localeCompare(b.Pieza_ID);
  if (a.Clase !== b.Clase) return a.Clase.localeCompare(b.Clase);
  return (b.Clicks_DE + b.Clicks_Plataforma) - (a.Clicks_DE + a.Clicks_Plataforma);
});

console.log(NL + '══ Data_Clicks · ' + FILAS.length + ' filas');
var porCol = {};
FILAS.forEach(function (f) {
  porCol[f.Va_En_Columna] = porCol[f.Va_En_Columna] || { de: 0, pl: 0, filas: 0 };
  porCol[f.Va_En_Columna].de += f.Clicks_DE;
  porCol[f.Va_En_Columna].pl += f.Clicks_Plataforma;
  porCol[f.Va_En_Columna].filas++;
});
console.log('  columna del reporte'.padEnd(22) + 'filas'.padStart(7) + 'Clicks_DE'.padStart(12) + 'Plataforma'.padStart(12));
Object.keys(porCol).sort().forEach(function (c) {
  console.log('  ' + c.padEnd(22) + String(porCol[c].filas).padStart(7) + mil(porCol[c].de).padStart(12) + mil(porCol[c].pl).padStart(12));
});
var tokFilas = FILAS.filter(function (f) { return /tokenizadas/.test(f.URL); });
console.log(NL + '  filas de URLs tokenizadas (agrupadas): ' + tokFilas.length + '   ·   agrupan ' +
  tokFilas.reduce(function (a, f) { return a + f.N_URLs; }, 0) + ' URL(s)');

// ── Dic_Clicks ────────────────────────────────────────────────────────────────────
var C = CD.contrato();
var DIC = [];
CD.clases().forEach(function (id) {
  var def = CD.definicion(id) || {};
  var de = 0, pl = 0, urls = 0;
  FILAS.filter(function (f) { return f.Clase === id; }).forEach(function (f) { de += f.Clicks_DE; pl += f.Clicks_Plataforma; urls += f.N_URLs; });
  DIC.push({
    Clase: id, Nombre: def.nombre || id, Familia: CD.familia(id),
    Va_En_Columna: CD.columnaDe(id),
    Que_Es: t(def.que_es).replace(/\s+/g, ' ').slice(0, 800),
    Patrones_URL: (def.patrones || []).join('  ·  '),
    URLs_Ejemplo: (def.ejemplos_reales || []).join('  ·  ').slice(0, 300),
    N_URLs: urls, Clicks_DE: de, Clicks_Plataforma: pl,
    Nota: (id === 'social' || id === 'ver_en_navegador' || id === 'legal') ? NOTA_RNL
      : (id === 'por_clasificar' ? NOTA_PC : '')
  });
});
console.log(NL + '══ Dic_Clicks · ' + DIC.length + ' clases');
console.log('  clase'.padEnd(24) + 'familia'.padEnd(14) + 'columna'.padEnd(16) + 'DE'.padStart(9) + 'Plataforma'.padStart(12));
DIC.forEach(function (d) {
  console.log('  ' + d.Clase.padEnd(22) + d.Familia.padEnd(14) + d.Va_En_Columna.padEnd(16) + mil(d.Clicks_DE).padStart(9) + mil(d.Clicks_Plataforma).padStart(12));
});

// ── LAS VALIDACIONES DE ESTA HOJA ─────────────────────────────────────────────────
var fallos = [];
function K(n, ok, det) { console.log('  ' + (ok ? '✔' : '🔴') + ' ' + n.padEnd(58) + det); if (!ok) fallos.push(n); }
console.log(NL + '══ VALIDACIONES DEL DETALLE' + NL);
var sumaDE = FILAS.reduce(function (a, f) { return a + f.Clicks_DE; }, 0);
var totalDE = LK.reduce(function (a, r) { return a + num(r.Clicks_Unique); }, 0);
K('Σ Clicks_DE del detalle == Σ de CRM_Email_Links', sumaDE === totalDE, mil(sumaDE) + ' vs ' + mil(totalDE));
var sumaPL = FILAS.reduce(function (a, f) { return a + f.Clicks_Plataforma; }, 0);
var totalPL = CE.detalle.filter(function (x) { return !x.truncated; }).reduce(function (a, x) { return a + x.total_clasificado; }, 0);
K('Σ Clicks_Plataforma del detalle == Σ de ClickEvent', sumaPL === totalPL, mil(sumaPL) + ' vs ' + mil(totalPL));
// 🔴 se exige que cada clase tenga un DESTINO DECLARADO — que puede ser «ninguna columna», pero
//    declarado. Lo que no se tolera es una clase que nadie mapeó y que por tanto desaparece.
var sinCol = FILAS.filter(function (f) { return !f.Va_En_Columna; }).length;
K('cada clase tiene destino declarado (columna o «ninguna»)', sinCol === 0, sinCol ? sinCol + ' fila(s) sin declarar' : 'las ' + FILAS.length + ' filas');
var fueraCol = FILAS.filter(function (f) { return /ninguna/.test(f.Va_En_Columna); });
var clicksFuera = fueraCol.reduce(function (a, f) { return a + f.Clicks_DE; }, 0);
// 🔴 Este check NO es «las 3 columnas suman el total» a secas: es «suman el total, Y lo que no
//    entra en ninguna está declarado». Cuando `por_clasificar` está en 0 las tres cuadran exacto y
//    hay que DECIRLO así — dejar el rótulo fijo en «NO suman» haría que el día que cuadren el
//    lector siguiera leyendo que no cuadran, y ése es el tipo de check que se ignora.
K('las 3 columnas suman el total de clicks de la DE', clicksFuera === 0,
  clicksFuera === 0 ? mil(sumaDE) + ' = Σ de las 3, nada fuera'
    : mil(clicksFuera) + ' clicks sin clasificar (' + (sumaDE ? (clicksFuera / sumaDE * 100).toFixed(2) : 0) + '%) — declarados aparte');
var sinDim = FILAS.filter(function (f) { return !f.Campaña; }).length;
K('cada fila tiene sus dimensiones del catálogo', sinDim === 0, sinDim ? sinDim + ' sin campaña' : 'las ' + FILAS.length + ' filas');

if (fallos.length) { console.log(NL + '  🔴 ' + fallos.length + ' validación(es) en rojo. NO se escribe.'); process.exit(1); }
fs.writeFileSync(BACK + '/_preescritura/hoja-clicks.json', JSON.stringify({ generado: '2026-09-20', Data_Clicks: FILAS, Dic_Clicks: DIC, por_columna: porCol }, null, 1));
console.log(NL + '  → _preescritura/hoja-clicks.json');
if (!ESCRIBIR) { console.log('  (seco. Para escribir las hojas: --escribir)'); fs.unlinkSync(tmp); process.exit(0); }
fs.unlinkSync(tmp);
console.log(NL + '  ⚠ la escritura de las hojas la hace `escritor.hojas-clicks.js` — este paso solo mide y declara.');
