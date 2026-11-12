// lib-mapeo-sfmc · EL MAPEO catálogo ← DE de SFMC, EN UN SOLO LUGAR.
//
// 🔴 POR QUÉ UNA LIBRERÍA Y NO UNA COPIA EN CADA SCRIPT. El que prueba el mapeo y el que llena
//    con él tienen que usar EXACTAMENTE el mismo. Dos copias es la copia que diverge: se aprueba
//    un mapeo y se escribe con otro, y la prueba deja de significar nada.
//
// 🔴 LOS NOMBRES DE LA DE SON LOS REALES, LEÍDOS DEL VOLCADO — no adivinados. La DE se llama
//    `Campana` (sin ñ), `Fecha_Primer_Envio`, `Email_Subject`, `Es_FUP`. Adivinar `SendDate` o
//    `Subject` hizo que la primera medición reportara «SFMC no trae ese campo» sobre 40 huecos
//    que SÍ se pueden llenar.
//
// 🔴 Y CADA MAPEO DECLARA CÓMO SE COMPARA. Una fecha `3/19/2026 12:00:00 AM` y un `19/03/2026`
//    de la hoja son el mismo día escrito distinto: compararlos como texto daría 100% de
//    desacuerdo y tiraría un mapeo bueno.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var FE = require(__dirname + '/lib-fechas-envio.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HUECO = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-|)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;
function esHueco(v) { return HUECO.test(t(v)); }

// ── fechas ──────────────────────────────────────────────────────────────────────────
// La DE entrega `M/D/AAAA h:mm:ss AM`. La hoja guarda unas como serial de Excel y otras como
// texto. Se normaliza todo a `AAAA-MM-DD` para comparar, y se ESCRIBE en ese mismo formato.
function aFecha(v) {
  var s = t(v); if (!s) return null;
  var n = Number(s);
  if (isFinite(n) && n > 20000 && n < 80000) {           // serial de Excel
    var d0 = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d0.toISOString().slice(0, 10);
  }
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);       // M/D/AAAA de la DE
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);                 // ya canónica
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s);     // D/M/AAAA
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
// 🔴 LA QUINCENA CANÓNICA: `AAAA-MM-Qn`, día 1-15 = Q1, 16-fin = Q2. Antes convivían dos
//    formatos y 0 de 86 filas cruzaban.
function aQuincena(v) { var f = aFecha(v); if (!f) return null; return f.slice(0, 7) + '-Q' + (Number(f.slice(8, 10)) <= 15 ? 1 : 2); }
var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function aMes(v) { var f = aFecha(v); if (!f) return null; return MESES[Number(f.slice(5, 7)) - 1]; }
function aMesNum(v) { var f = aFecha(v); if (!f) return null; return String(Number(f.slice(5, 7))); }

function mismaFecha(a, b) { var x = aFecha(a), y = aFecha(b); return !!x && x === y; }
function mismoTexto(a, b) { return t(a).toLowerCase() === t(b).toLowerCase(); }
function mismoNum(a, b) { return Number(t(a).replace(/[, ]/g, '')) === Number(t(b).replace(/[, ]/g, '')); }
// 🔴 el mes y la quincena de la hoja pueden venir con otra grafía («Ago-Q2», «agosto»): se
//    comparan por su forma canónica, no por su escritura.
// 🔴 tolerancia DECLARADA para contadores que acumulan: 0.5% o ±2, lo que sea mayor. No es un
//    ajuste para que la prueba pase: es que «355,979» y «355,980» son la misma medición leída
//    en dos momentos. Para un id o una fecha NO aplica — ahí ±1 sí es otro dato.
function casiIgual(a, b) {
  var x = Number(t(a).replace(/[, ]/g, '')), y = Number(t(b).replace(/[, ]/g, ''));
  if (!isFinite(x) || !isFinite(y)) return false;
  return Math.abs(x - y) <= Math.max(2, Math.abs(y) * 0.005);
}
// 🔴 monótono: para un contador que acumula, «no coincide» solo es un defecto si SFMC va HACIA
//    ABAJO. Hacia arriba es la hoja que se quedó vieja — y por eso el llenado solo toca huecos.
function monotono(hoja, sfmc) {
  var a = Number(t(hoja).replace(/[, ]/g, '')), b = Number(t(sfmc).replace(/[, ]/g, ''));
  if (!isFinite(a) || !isFinite(b)) return false;
  return b >= a - Math.max(2, Math.abs(a) * 0.005);
}
// 🔴 UNA FECHA DE ENVÍO TIENE DOS FORMAS DE «NO COINCIDIR», Y UNA NO ES UN ERROR — igual que un
//    contador que acumula.  de la DE toma el PRIMER job, pruebas incluidas;
//    el detalle filtrado toma el primer job REAL. Así que la fecha real solo puede ser IGUAL o
//    POSTERIOR. Si fuera ANTERIOR, sí sería otro dato y hay que mirarlo.
//    Medido el 7-sep-2026 sobre las 104 piezas: 64 iguales, 40 posteriores, **0 anteriores**.
//    Mediana del corrimiento: 4 días. Máximo: 21 (E-PROP1, del 3-ago a la prueba al 24-ago real).
//    Esto NO es ajustar la prueba hasta que pase: es que la dirección del desacuerdo se midió
//    ANTES y resultó ser toda la misma. Si alguna se corriera hacia atrás, el mapeo se cae.
function fechaPosterior(hoja, real) {
  var a = aFecha(hoja), b = aFecha(real);
  if (!a || !b) return false;
  return b >= a;
}
function mismoMes(a, b) { return t(a).toLowerCase().slice(0, 3) === t(b).toLowerCase().slice(0, 3); }

// ══ EL MAPEO ═══════════════════════════════════════════════════════════════════════
// `hoja`   · id lógico de la columna, se resuelve con lib-columna
// `desde`  · el campo REAL de la DE, para poder decirlo en la salida
// `valor`  · qué escribir (recibe la fila de SFMC y la de la hoja)
// `iguales`· cómo comparar cuando los dos lados ya tienen valor
var MAPEO = [
  // 🔴 7-sep-2026 · LA FECHA SALE DEL DETALLE DÍA POR DÍA, NO DE LA DE AGREGADA.
  //    `Fecha_Primer_Envio` de la DE dice, para E-PROP1, **3-ago** — y ese día SFMC solo
  //    registró cuatro jobs de UN envío: pruebas internas. El envío real arrancó el **24-ago**.
  //    La memoria del proyecto ya lo advertía («esa BU trae sobre todo pruebas, `sent:1`») y
  //    nadie lo estaba verificando: la fecha de una prueba se estaba escribiendo al catálogo,
  //    y de ella sale la quincena de la fila. `lib-fechas-envio` descarta los jobs de menos de
  //    10 envíos y declara cuánto descartó (hoy: 203 envíos de 8,937,727 = 0.0023%).
  { hoja: 'Fecha_Primer_Envio', desde: 'detalle día por día (primer envío real)', valor: function (f, p, R) { return R && R.primero ? R.primero : null; }, iguales: fechaPosterior },

  // 🔴 Y `Fecha_Ultimo_Envio` VUELVE A LA PRUEBA con la fuente buena. Con la DE agregada lo
  //    rechazó (23 de 75 discrepaban) porque la hoja guarda un CIERRE DE PERIODO — el mismo
  //    2026-04-30 en las 12 piezas de AON. Con el último día real se vuelve a medir: si sigue
  //    discrepando, es que la columna de la hoja mide otra cosa y se queda como está.
  { hoja: 'Fecha_Ultimo_Envio', desde: 'detalle día por día (último envío real)', valor: function (f, p, R) { return R && R.ultimo ? R.ultimo : null; }, iguales: fechaPosterior },

  { hoja: 'Quincena', desde: 'primer envío real (derivada)', valor: function (f, p, R) { return R && R.primero ? aQuincena(R.primero) : null; } },

  // 🔴 CADA COLUMNA DE MES USA SU PROPIA GRAFÍA, Y SE RESPETA LA QUE YA HAY. `Mes_Lanzamiento`
  //    guarda `2026-03`, `Mes` guarda «Marzo» y `Mes (#)` guarda 3. Escribir «Marzo» en las
  //    tres habría dado 76 de 76 discrepancias — no porque el dato fuera otro, sino porque yo
  //    elegí el formato en vez de leerlo. El formato lo dicta la hoja, no el escritor.
  { hoja: 'Mes_Lanzamiento', desde: 'primer envío real (derivada)', valor: function (f, p, R) { return R && R.primero ? R.primero.slice(0, 7) : null; } },
  { hoja: 'Mes', exacta: true, desde: 'primer envío real (derivada)', valor: function (f, p, R) { return R && R.primero ? aMes(R.primero) : null; }, iguales: mismoMes },
  { hoja: 'Mes (#)', exacta: true, desde: 'primer envío real (derivada)', valor: function (f, p, R) { return R && R.primero ? aMesNum(R.primero) : null; }, iguales: mismoNum },

  { hoja: 'Subject', desde: 'Email_Subject', valor: function (f) { return t(f.Email_Subject); } },

  // 🔴 `Es_FUP` es Si/No y la hoja escribe «Principal» / «Follow Up» — CON ESPACIO. Yo generaba
  //    «FollowUp» y la prueba marcó 34 desacuerdos que no eran desacuerdos: era yo imponiendo mi
  //    ortografía sobre la suya. La traducción va declarada aquí, no en el escritor.
  { hoja: 'Email_Type', desde: 'Es_FUP', valor: function (f) { return /^s/i.test(t(f.Es_FUP)) ? 'Follow Up' : 'Principal'; } },

  { hoja: 'Codigo_NC', desde: 'Codigo_NC', valor: function (f) { return t(f.Codigo_NC); }, iguales: function (a, b) { return t(a).replace(/-/g, '').toLowerCase() === t(b).replace(/-/g, '').toLowerCase(); } },

  // 🔴 UN CONTADOR QUE ACUMULA NO SE COMPARA POR IGUALDAD EXACTA. Los opens y los sends siguen
  //    sumando días después del envío, y dos refrescos de la misma pieza difieren en ±1 sobre
  //    355,980. Exigir igualdad daba 34 "desacuerdos" de ±1 que no significan nada. La tolerancia
  //    se DECLARA (0.5% o ±2) en vez de ajustarse hasta que la prueba pase — y aun así el mapeo
  //    solo LLENA huecos: nunca pisa un número que la hoja ya tiene.
  // 🔴 Y HAY UNA SEGUNDA FORMA DE «NO COINCIDIR» QUE NO ES UN ERROR: la hoja está VIEJA. Los
  //    opens y los sends siguen acumulando días después del envío, así que SFMC ≥ hoja siempre.
  //    Seis piezas discrepan por 1.7% y las seis van hacia ARRIBA (127,739 → 129,878): eso no es
  //    que las columnas signifiquen cosas distintas, es que el refresh maduró. Distinguirlo
  //    importa: `Fecha_Ultimo_Envio` discrepa porque MIDE OTRA COSA y esa sí se rechaza.
  //    Para un contador, la prueba es MONÓTONA — falla solo si SFMC va hacia abajo.
  { hoja: 'Sends', desde: 'Email_Sends', monotono: true, valor: function (f) { return t(f.Email_Sends); }, iguales: monotono },

  { hoja: 'Email_ID', desde: 'Email_ID', valor: function (f) { return t(f.Email_ID); }, iguales: mismoNum }

  // ── LO QUE SE PROBÓ Y NO SIRVE. Queda escrito para que nadie lo vuelva a proponer: ──────
  //
  // 🔴 `Content_ID ← ConfigKey`. ConfigKey es el **Pieza_ID** (`001-P001`), no un id de
  //    contenido. La medición por parecido de nombres lo propuso y habría escrito ids de pieza
  //    en 30 celdas de una columna de ids de contenido, sin mover ninguna suma.
  //
  // 🔴 `Journey_ID ← Journey_ID_Datorama`. 72 de 72 discrepan: la hoja guarda el journey del
  //    catálogo (`001-J001`) y la DE el id de Datorama (`803867`). Son dos espacios de ids
  //    distintos — el mismo error de los "tres identificadores" que ya costó un cruce entero.
  //
  // 🔴 `Asset_ID ← Email_ID`. 72 de 72 discrepan: la hoja tiene `863587` IGUAL en las 12 piezas
  //    de AON (es del journey) y la DE un id por email (79469, 79542, 79472). Rellenar 32
  //    huecos con el id equivocado habría quedado precioso y falso.
];

// ══ CARGAR LOS DOS LADOS Y CRUZARLOS POR Email_Name ═════════════════════════════════
function cargar() {
  var dir = BACK + '/_insumos';
  var cands = fs.readdirSync(dir).filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
  var rutaIns = dir + '/' + cands[cands.length - 1];
  var S = JSON.parse(fs.readFileSync(rutaIns, 'utf8'));
  var filas = S.rows || S.data || [];

  var vivo = L.archivoVivo({ dir: PROY });
  var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_mapeo.xlsx';
  fs.copyFileSync(vivo.ruta, TMP);
  var wb = XLSX.readFile(TMP);
  var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
  var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
  var nmPieza = COL.de(P, 'Pieza' + '_' + 'ID');
  var nmEmail = COL.de(P, 'Email_Name');
  var nmVar = null; try { nmVar = COL.de(P, 'Email_Names_Variantes'); } catch (e) { nmVar = null; }
  var piezas = P.filter(function (p) { return ES_PIEZA.test(t(p[nmPieza])); });

  // índice de SFMC por nombre físico
  var porNombre = {};
  filas.forEach(function (f) { var n = t(f.EmailName); if (n) porNombre[n.toLowerCase()] = f; });

  function nombresDe(p) {
    var out = [];
    [t(p[nmEmail])].concat(nmVar ? [t(p[nmVar])] : []).forEach(function (blob) {
      blob.split('·').forEach(function (n) { if (t(n) && !esHueco(t(n))) out.push(t(n)); });
    });
    return out;
  }
  function sfmcDe(p) { var f = null; nombresDe(p).forEach(function (n) { if (!f) f = porNombre[n.toLowerCase()]; }); return f || null; }

  // 🔴 LAS FECHAS REALES, por pieza, cruzadas por la MISMA llave que todo lo demás: el nombre
  //    físico. Si un mapeo necesita la fecha del envío real, la pide aquí — no la deduce.
  var FR = FE.cargar();
  function fechasDe(p) { var r = null; nombresDe(p).forEach(function (n) { if (!r) r = FR.porNombre[n]; }); return r || null; }

  var cruzan = piezas.filter(sfmcDe).length;
  // 🔴 CUANDO EL REGISTRO NO PUEDE DESAMBIGUAR, MANDA EL ENCABEZADO EXACTO — y se declara.
  //    `Mes`, `Mes (#)` y `Mes_Lanzamiento` normalizan al mismo texto, así que `COL.de` se
  //    niega (bien: prefiere tronar a devolver la equivocada). Para esas se pide el encabezado
  //    tal cual, y solo si aparece UNA vez en la hoja.
  function columna(id, exacta) {
    if (exacta) {
      var iguales = enc.filter(function (h) { return h === id; });
      return iguales.length === 1 ? id : null;
    }
    try { return COL.de(P, id); } catch (e) { return null; }
  }

  return {
    volcado: path.basename(rutaIns), libro: vivo.ruta, tmp: TMP,
    filas: filas, hoja: P, enc: enc, piezas: piezas, cruzan: cruzan,
    nmPieza: nmPieza, nmEmail: nmEmail,
    idDe: function (p) { return t(p[nmPieza]); }, sfmcDe: sfmcDe, columna: columna, fechasDe: fechasDe, resumenFechas: FR.resumen
  };
}

module.exports = {
  MAPEO: MAPEO, cargar: cargar, esHueco: esHueco,
  aFecha: aFecha, aQuincena: aQuincena, aMes: aMes, aMesNum: aMesNum
};
