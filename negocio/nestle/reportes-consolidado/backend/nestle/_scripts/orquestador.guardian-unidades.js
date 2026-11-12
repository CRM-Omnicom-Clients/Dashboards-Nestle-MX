/*
 * orquestador.guardian-unidades.js — ¿QUÉ ES «UNO» EN CADA MÉTRICA? Mide, no escribe.
 *
 * 🔴 POR QUÉ EXISTE (24-sep-2026). Tres defectos de septiembre costaron un reporte equivocado y
 *    los tres son el MISMO: nadie declaraba la unidad.
 *      · CLICKS   — `Clicks` es único POR CORREO y el desglose sumaba únicos POR LINK: el
 *                   desglose excedía al total en 98 de 101 piezas.
 *      · QCART    — un carrito se contaba como una FILA del CSV; una fila es un bucket con su
 *                   contador `views`. 3,077 filas son 7,503 vistas.
 *      · WHATSAPP — se impuso `WA-Clicks ≡ Carritos_Total`; Qcart mide 949 clicks → 18 carritos.
 *
 * 🔴 Y NINGUNA PUERTA LOS VIO, porque las puertas comparan bloque ↔ rejilla ↔ reporte y las tres
 *    descienden del mismo origen: si la unidad del origen está mal, las tres coinciden. Un sistema
 *    que se compara consigo mismo prueba que es CONSISTENTE, no que es correcto.
 *
 * QUÉ EXIGE, y las cuatro se pueden probar plantándoles el defecto:
 *   U1 · toda métrica numérica del reporte tiene UNIDAD declarada
 *   U2 · toda métrica de conteo declara CONTRA QUÉ se compara (o por qué no se compara con nada)
 *   U3 · las relaciones declaradas se cumplen EN EL DATO, fila por fila
 *   U4 · ninguna fuente con contador se cuenta por FILAS en el código
 *
 *   node orquestador.guardian-unidades.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
function n(v) { var s = t(v); if (!s || TOKEN.test(s)) return null; var x = Number(s.replace(/[,$%\s]/g, '')); return isFinite(x) ? x : null; }

/* 🔴 `--contrato` y `--reporte` existen para PROBAR al guardián, no para relajarlo: el probador le
 *    planta cada defecto sobre una COPIA y exige que bloquee. Sin esta puerta de entrada habría que
 *    mutar los archivos de verdad para probarlo, que es como se rompe un sistema probándolo.
 *    `--scripts` hace lo mismo con la carpeta de código que escanea U4. */
function arg(nom) { var i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1] : null; }
var RUTA_CONTRATO = arg('contrato') || (BACK + '/_contratos/unidades.json');
var RUTA_SCRIPTS = arg('scripts') || (BACK + '/_scripts');
var U = JSON.parse(fs.readFileSync(RUTA_CONTRATO, 'utf8'));
var tmp = BACK + '/_tmp/_unidades.xlsx';
var ORIGEN = arg('reporte') || VIVO;
fs.copyFileSync(ORIGEN, tmp);
var R = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Report_Resumen'], { defval: '' });
var nCamp = COL.de(R, 'Campaña', 'resumen');
var Rd = R.filter(function (r) { return !/^total/i.test(t(r[nCamp])); });

console.log('════════ orquestador · ¿QUÉ ES «UNO» EN CADA MÉTRICA? ════════\n');
console.log('  contrato: _contratos/unidades.json   ·   filas de datos: ' + Rd.length + '\n');
var bloquea = [], avisa = [];
function chk(nom, ok, det, duro) {
  console.log('  ' + (ok ? '✔' : (duro ? '🔴' : '⚠')) + ' ' + nom.padEnd(52) + det);
  if (!ok) (duro ? bloquea : avisa).push(nom + ' — ' + det);
}

/* ── U1 · toda métrica numérica declara su unidad ────────────────────────────────────── */
var cols = Object.keys(R[0] || {});
function esNumerica(c) {
  var num = 0, con = 0;
  Rd.slice(0, 60).forEach(function (r) { var v = n(r[c]); if (t(r[c]) && !TOKEN.test(t(r[c]))) { con++; if (v !== null) num++; } });
  return con > 2 && num / con > 0.8;
}
var esTasa = /rate|ctor|utor|%|pct|penetrac/i;
var numericas = cols.filter(function (c) { return esNumerica(c) && !esTasa.test(c); });
var sinUnidad = numericas.filter(function (c) { return !U.metricas[c]; });
chk('U1 · toda métrica numérica tiene unidad declarada',
  sinUnidad.length === 0,
  sinUnidad.length ? '🔴 ' + sinUnidad.length + ' sin declarar: ' + sinUnidad.slice(0, 5).join(' · ')
    : 'las ' + numericas.length + ' declaradas en el contrato', true);

/* ── U2 · toda métrica de conteo dice contra qué se compara ──────────────────────────── */
var conteo = Object.keys(U.metricas).filter(function (k) {
  var m = U.metricas[k]; return m.unidad && m.unidad !== 'no_es_metrica' && m.unidad !== 'peso_mxn';
});
var sinPareja = conteo.filter(function (k) {
  var m = U.metricas[k];
  return m.se_compara_con === undefined;
});
chk('U2 · toda métrica de conteo declara su comparación',
  sinPareja.length === 0,
  sinPareja.length ? '🔴 ' + sinPareja.join(' · ') : 'las ' + conteo.length + ' la declaran (null = es un total, y dice por qué)', true);

/* ── U3 · las relaciones declaradas se cumplen EN EL DATO ────────────────────────────── */
var malRel = [], probadas = 0, peor = null;
Object.keys(U.metricas).forEach(function (k) {
  var m = U.metricas[k];
  if (!m.se_compara_con) return;
  var padre = m.se_compara_con;
  if (cols.indexOf(k) < 0 || cols.indexOf(padre) < 0) return;
  /* 🔴 LA UNIDAD TIENE QUE COINCIDIR — salvo que el cruce se DECLARE como embudo.
   *    Comparar dos unidades distintas es el defecto que costó los clicks y Qcart. Pero hay
   *    cruces legítimos: un click de WhatsApp no es un mensaje, y aun así no puede exceder a las
   *    lecturas porque hay que leer antes de tocar. La diferencia entre un cruce legítimo y el
   *    defecto es que el legítimo está ESCRITO. Sin `embudo: true`, bloquea. */
  var up = U.metricas[padre] && U.metricas[padre].unidad;
  if (up && up !== m.unidad && !m.embudo) {
    malRel.push(k + ' (' + m.unidad + ') se compara con ' + padre + ' (' + up + '): UNIDADES DISTINTAS y sin declarar `embudo`');
    return;
  }
  Rd.forEach(function (r) {
    var a = n(r[k]), b = n(r[padre]);
    if (a === null || b === null) return;
    probadas++;
    if (a > b) {
      var d = a - b;
      if (!peor || d > peor.d) peor = { k: k, padre: padre, a: a, b: b, d: d, camp: t(r[nCamp]) };
      malRel.push(k + ' > ' + padre + ' (' + a + ' > ' + b + ') en ' + t(r[nCamp]));
    }
  });
});
chk('U3 · cada métrica cabe dentro de su total',
  malRel.length === 0,
  malRel.length ? "🔴 " + malRel.length + " de " + probadas + "   " + malRel[0].slice(0, 86)
    : probadas.toLocaleString() + ' comparaciones, todas dentro', true);

/* ── U3b · el desglose suma exactamente su total ─────────────────────────────────────── */
var malSuma = 0;
['Principal', 'FUP', 'Tot'].forEach(function (b) {
  var partes = [b + '_Clicks_CTA', b + '_Clicks_Baja', b + '_Clicks_Redes+Navegador+Legal'], tot = b + '_Clicks_Medidos';
  if (cols.indexOf(tot) < 0) return;
  Rd.forEach(function (r) {
    var T = n(r[tot]); if (T === null) return;
    var s = 0, hay = false;
    partes.forEach(function (p) { var v = n(r[p]); if (v !== null) { s += v; hay = true; } });
    if (hay && s !== T) malSuma++;
  });
});
chk('U3b · el desglose de clicks suma su propio total', malSuma === 0,
  malSuma ? '🔴 ' + malSuma + ' filas donde Σdesglose ≠ Clicks_Medidos' : 'exacto en las ' + Rd.length + ' filas', true);

/* ── U4 · ninguna fuente con contador se cuenta por filas ────────────────────────────── */
/* 🔴 se busca el patrón en el CÓDIGO, no en el dato: el dato ya estaría mal cuando se note.
 *
 * 🔴 REESCRITO 29-sep-2026 — ERA UNA PRUEBA DE REGRESIÓN, NO UNA GUARDA. Traía CINCO patrones
 *    LITERALES —el texto exacto de cinco defectos ya arreglados— y los buscaba en TRES archivos
 *    fijos. O sea que solo podía detectar el regreso de esas cinco líneas a esos tres archivos:
 *    ni el mismo defecto escrito de otra forma, ni en un cuarto archivo. Salía en verde diciendo
 *    «los 5 patrones prohibidos, ausentes», que es verdad y no significa nada.
 *    Y se le escapó uno de verdad: `fuentes-whatsapp.whatsapp.js` recorría los carritos del bloque
 *    sumando `+ 1` por fila, así que las dos piezas de Liga MX reportaban **21 y 12** clicks
 *    cuando sus carritos son **43 y 30**. Un cuarto archivo, el mismo defecto, otra redacción.
 *
 * 🔴 AHORA BARRE TODOS LOS SCRIPTS BUSCANDO LA **FORMA**: un recorrido de los carritos que cuenta
 *    unidades sin mirar `views`, o una medición del bloque con `.length`. Al generalizar aparecen
 *    usos legítimos (la auditoría del filtro SÍ cuenta filas, y hace bien), y la única manera de
 *    que una guarda general no se vuelva ruido —y acabe desactivada— es que la excepción se
 *    **declare** en `_contratos/unidades.json` con su razón, en vez de ablandar el patrón. */
var PERMITIDO = {};
((U.conteo_por_filas || {}).permitido || []).forEach(function (x) { PERMITIDO[x.archivo] = x.razon; });

var hallados = [], barridos = 0, saltados = [];
var reForEach = /\(\s*([A-Za-z0-9_.\[\]']*carritos[A-Za-z0-9_.\[\]']*)[^)]{0,40}\|\|\s*\[\]\s*\)\s*\.forEach|\b([A-Za-z0-9_.]*carritos)\s*\.forEach/g;
fs.readdirSync(RUTA_SCRIPTS).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  var src = ''; try { src = fs.readFileSync(RUTA_SCRIPTS + '/' + f, 'utf8'); } catch (e) { return; }
  if (!/carritos/.test(src)) return;
  barridos++;
  if (PERMITIDO[f] !== undefined) { saltados.push(f); return; }

  // a · recorrer los carritos y contar de uno en uno, sin mirar `views`
  var m; reForEach.lastIndex = 0;
  while ((m = reForEach.exec(src))) {
    var cuerpo = src.slice(m.index, m.index + 700);   // ventana del cuerpo del forEach
    var cuenta = /\|\|\s*0\s*\)\s*\+\s*1\b|\+\+\s*;/.test(cuerpo);
    if (cuenta && !/views/.test(cuerpo)) {
      var ln = src.slice(0, m.index).split('\n').length;
      hallados.push(f + ':' + ln + ' recorre los carritos y cuenta +1 por fila, sin `views`');
    }
  }
  // a2 · un acumulador LLAMADO carritos que sube de uno en uno
  //    🔴 ESTE ES EL DEFECTO ORIGINAL DEL MOTOR, y mi primera generalización no lo veía: el motor no
  //       recorre los carritos, recorre los EVENTOS y hace `g.qcart.carritos++`. O sea que el
  //       acumulador se llama carritos y el bucle no. Al generalizar por «recorrer los carritos» se
  //       cambió un punto ciego por otro, y lo dijo el señuelo S5 pasando en verde — que es
  //       exactamente para lo que existe. Una guarda nueva se prueba con el señuelo VIEJO.
  var reAcc = [
    /[A-Za-z0-9_.\[\]']*carritos\s*\+\+/g,
    /[A-Za-z0-9_.\[\]']*carritos\s*\+=\s*1\b/g,
    /([A-Za-z0-9_.\[\]']*carritos)\s*=\s*\(\s*[^)]*\|\|\s*0\s*\)\s*\+\s*1\b/g
  ];
  reAcc.forEach(function (re) {
    re.lastIndex = 0; var mm;
    while ((mm = re.exec(src))) {
      var li = src.slice(src.lastIndexOf('\n', mm.index) + 1, src.indexOf('\n', mm.index));
      if (/^\s*(\/\/|\*|\/\*)/.test(li)) continue;
      hallados.push(f + ':' + src.slice(0, mm.index).split('\n').length +
        ' un acumulador de carritos sube +1 por evento, en vez de sumar `views`');
    }
  });

  // b · medir el bloque de carritos con .length como si fuera el número de carritos
  var reLen = /([A-Za-z0-9_.\[\]']*carritos[A-Za-z0-9_.\[\]']*)\s*(?:\|\|\s*\[\]\s*\))?\s*\.length/g;
  reLen.lastIndex = 0;
  while ((m = reLen.exec(src))) {
    var linea = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
    // 🔴 `.length` es legítimo para DECIR cuántas filas hay; el defecto es usarlo como la CIFRA de
    //    carritos. Se distingue por lo que se hace con él: si la línea lo COMPARA o lo asigna a algo
    //    que se llama carritos/total/suma, es la cifra. Si solo se imprime, es un conteo de filas.
    //
    // 🔴 Y `console.log` NO ES UNA EXCLUSIÓN (29-sep-2026). Yo descartaba toda línea que lo llevara,
    //    suponiendo que un `.length` impreso solo informa. `motor.motor.js:779` **imprimía Y
    //    comparaba** en la misma línea: `sumaQcRejilla === B.qcart.carritos.length`, o sea vistas
    //    contra filas, y anunciaba «⚠ -5,027 sin anclar» — un aviso falso que sonaba a hallazgo
    //    grave. Mi exclusión lo dejó pasar. Ahora una comparación pesa MÁS que el console.log: solo
    //    se descarta la línea que imprime y **no** compara.
    if (/^\s*(\/\/|\*)/.test(linea)) continue;
    var compara = /===|==|!==|!=/.test(linea);
    var asigna = /=\s*[A-Za-z0-9_.]*(?:carritos|total|suma)/.test(linea);
    var esConteoDeFilas = /views|eventos|filas|\.length\s*\+/.test(linea) || (/console\.log/.test(linea) && !compara);
    if ((compara || asigna) && !esConteoDeFilas) {
      hallados.push(f + ':' + src.slice(0, m.index).split('\n').length + ' usa .length de los carritos como la cifra de carritos');
    }
  }
});
// 🔴 LA EVIDENCIA COMPLETA VA AL ARCHIVO, aunque en pantalla se resuma (29-sep-2026). El detalle
//    de este check se truncaba a 5 y el JSON heredaba el mismo texto truncado: con 13 hallazgos,
//    quien intentara trabajar desde la evidencia veía 5 y creía haber acabado, y al arreglarlos
//    aparecían otros 5 — un juego de topos que parece progreso. Una evidencia recortada no es
//    evidencia. La pantalla dice cuántos hay; el archivo los trae todos.
chk('U4 · ninguna fuente con contador se cuenta por filas', hallados.length === 0,
  hallados.length ? '🔴 ' + hallados.length + ' hallazgo(s), los 3 primeros: ' + hallados.slice(0, 3).join(' · ') +
    '   → la lista completa en _preescritura/guardian-unidades-u4.json'
    : 'barridos ' + barridos + ' scripts que nombran carritos, ' + saltados.length + ' con excepción declarada', true);
fs.writeFileSync(BACK + '/_preescritura/guardian-unidades-u4.json', JSON.stringify({
  medido: new Date().toISOString(), barridos: barridos,
  con_excepcion_declarada: saltados, hallazgos: hallados
}, null, 1));

/* ── U6 · la coherencia interna de QCART, que hasta hoy no vigilaba nadie ─────────────
 * 🔴 Ninguna puerta miraba Qcart contra sí mismo: la 1 cruza bloques contra catálogo y la 2
 *    reporte contra rejilla. Un importe sin carrito, o una penetración por encima del 100%,
 *    pasaban las dos. Son baratas de comprobar y caras de descubrir tarde. */
var nTP = COL.de(R, 'TouchPoint', 'resumen');
var qMal = [];
Rd.forEach(function (r) {
  var ca = n(r['Carritos_Total']), it = n(r['Intencion_Total_MXN']), ine = n(r['Intencion_Nestle_MXN']);
  var pen = t(r['Pct_Penetracion_Nestle']), tk = n(r['Ticket_Carrito_MXN']);
  var quien = t(r[nCamp]) + ' · ' + t(r[nTP]);
  if (it !== null && it > 0 && (ca === null || ca === 0)) qMal.push(quien + ': importe ' + it + ' sin ningún carrito');
  if (ine !== null && it !== null && ine > it) qMal.push(quien + ': intención Nestlé ' + ine + ' > total ' + it);
  var p = pen && !TOKEN.test(pen) ? Number(String(pen).replace(/[%\s]/g, '')) : null;
  if (p !== null && isFinite(p) && p > (String(pen).indexOf('%') >= 0 ? 100 : 1)) qMal.push(quien + ': penetración ' + pen + ' por encima del 100%');
  /* el ticket tiene que ser el cociente de sus dos patas, no otro número */
  if (tk !== null && it !== null && ca !== null && ca > 0) {
    var esperado = it / ca;
    if (Math.abs(tk - esperado) > Math.max(0.02, esperado * 0.001)) qMal.push(quien + ': ticket ' + tk.toFixed(2) + ' ≠ importe/carritos ' + esperado.toFixed(2));
  }
});
chk('U6 · Qcart es coherente consigo mismo', qMal.length === 0,
  qMal.length ? '🔴 ' + qMal.length + ': ' + qMal.slice(0, 2).join(' · ') : 'importe, intención, penetración y ticket cuadran en las ' + Rd.length + ' filas', true);

/* ── U5 · cada fuente declara su MEDIDA EXTERNA ──────────────────────────────────────── */
var ext = (U.medida_externa || {}).por_fuente || {};
var sinExt = Object.keys(ext).filter(function (k) { return /NINGUNA|HUECO/i.test(t(ext[k].externa) + ' ' + t(ext[k].estado)); });
chk('U5 · cada fuente tiene una medida EXTERNA', sinExt.length === 0,
  sinExt.length ? '⚠ sin contraste externo: ' + sinExt.join(' · ') + '  (declarado, no oculto)'
    : Object.keys(ext).length + ' fuentes con contraste externo', false);

console.log('\n════ VEREDICTO ════');
if (avisa.length) avisa.forEach(function (a) { console.log('  ⚠ ' + a); });
fs.writeFileSync(BACK + '/_preescritura/guardian-unidades.json', JSON.stringify({
  cuando: new Date().toISOString(), bloquea: bloquea, avisa: avisa, metricas: numericas.length
}, null, 1));
if (bloquea.length) {
  bloquea.forEach(function (b) { console.log('  🔴 ' + b); });
  console.log('\n  🔴 ' + bloquea.length + ' problema(s) de UNIDAD — no se publica.');
  process.exit(1);
}
console.log('  ✅ LAS UNIDADES CUADRAN — cada métrica dice qué es «uno» y cabe en su total');
console.log('\n→ _preescritura/guardian-unidades.json');
