/*
 * catalogo.auditar-ligamx.js — ¿está bien atribuido TODO Liga MX? Mide, no escribe.
 *
 * POR QUÉ: Rick, 9-sep-2026: «Checa a detalle que todo lo de Maggi Liga MX sí esté bien atribuido.
 * J5, J6, con cada región etc, debería de tener los datos de qcart, igual J7».
 *
 * 🔴 SE MIRAN LAS CUATRO CAPAS, NO UNA. Una pieza puede estar perfecta en el catálogo y no llegar
 *    a ninguna celda; o tener carritos en la fuente que el filtro descarta en silencio. Preguntarle
 *    a una sola capa es cómo `Data_WhatsApp` pasó 19 checks en verde con 14 de 26 envíos mal.
 *
 *      catálogo  →  SFMC (por Email_Name)  →  bloque Qcart (por SHORTLINK)  →  Report_Resumen
 *
 * 🔴 Y SE MIRA LO EXCLUIDO, NO SOLO LO INCLUIDO. «0 carritos» tiene dos lecturas que no se parecen:
 *    «el link no generó eventos» y «los generó y algo los tiró». La segunda es un defecto y la
 *    primera no, y desde el bloque las dos se ven idénticas.
 *
 * 🔴 TODAS las columnas se piden a `lib-columna`, también las del reporte. Ahí ya mordieron dos:
 *    `TouchPoint` leído como `Touchpoint` llamó fantasmas a dos piezas de Mundial, y `Campaña`
 *    chocó con `Campana_Raw` en Data_WhatsApp.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
// 🔴 el maestro de links entra a la auditoría (14-sep-2026). Sin él, esta auditoría declaraba
//    «sin pieza dueña» 76 carritos que estaban PERFECTAMENTE anclados por su shortlink — solo que
//    el código lo declara el maestro y no la columna `Codigos_Qcart` del catálogo. Ver la nota
//    larga en el bloque de huérfanos.
var LK = require(__dirname + '/lib-qcart-links.js');
// 🔴 el MISMO criterio de «job de prueba» que usa la cadena — se pregunta, no se reimplementa.
var FE = require(__dirname + '/lib-fechas-envio.js');
var PRUEBAS = FE.pruebas();
var BACK = require('path').resolve(__dirname, '..');
var LIBRO = ENT.LIBRO;

var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
// 🔴 14-sep-2026 · LA CAMPAÑA SE PIDE POR ARGUMENTO. Rick: «revisa TODO lo de Maggi». Maggi son
//    DOS campañas —Liga MX y Mundial— y un auditor clavado a una sola deja la otra sin mirar,
//    que es justo como se pierde un defecto: no por mentir, por no preguntar.
var CAMPANA = (function () { var i = process.argv.indexOf('--campana'); return i > 0 ? process.argv[i + 1] : 'Liga MX'; })();
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_audit-lmx.xlsx';
fs.copyFileSync(LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '' });
fs.unlinkSync(tmp);

// ── las columnas del CATÁLOGO, pedidas ──────────────────────────────────────
// 🔴 EL NOMBRE DE ENVÍO SE PIDE COMO `catalogo.content_name`, NO COMO «Email_Name». El registro
//    raíz tiene DOS entradas en este ámbito: `content_name` → «Email_Name» (la viva) y `emailname`
//    → «Email_Name_Legacy (duplicada, no usar)» (la retirada). Pedirla por su nombre físico
//    resuelve a la LEGACY y la librería truena — bien: prefiere tronar a devolver la columna
//    muerta. El id lógico correcto es el que el propio registro anotó: «content name = email name».
var K = {};
[['id', 'Pieza' + '_ID'], ['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'],
 ['en', 'catalogo.content_name'], ['cods', 'Codigos' + '_Qcart'], ['sends', 'Sen' + 'ds'],
 ['fecha', 'Fecha' + '_Primer_Envio'], ['quin', 'Quin' + 'cena'], ['tiene', 'Tiene' + '_Qcart']
].forEach(function (x) { K[x[0]] = COL.de(P, x[1], 'catalogo'); });

// ── las columnas del REPORTE, pedidas igual ─────────────────────────────────
var RC = {};
[['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'],
 ['sends', 'Principal' + '_Sends'], ['carr', 'Carritos' + '_Total']
].forEach(function (x) { RC[x[0]] = COL.opcional(R, x[1]) || null; });

var piezas = P.filter(function (r) { return t(r[K.cam]) === CAMPANA; });

// ── SFMC, del volcado vigente ───────────────────────────────────────────────
function vigente(pref) {
  var d = BACK + '/_insumos';
  var c = fs.readdirSync(d).filter(function (f) { return new RegExp('^' + pref + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? d + '/' + c[c.length - 1] : null;
}
var rutaSfmc = vigente('sfmc-piezas');
var sfmc = JSON.parse(fs.readFileSync(rutaSfmc, 'utf8')).rows;
var sfmcPorNombre = {};
sfmc.forEach(function (r) { if (t(r.EmailName)) sfmcPorNombre[t(r.EmailName)] = r; });

// ── el bloque de Qcart ──────────────────────────────────────────────────────
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var carPorCod = {}, prodPorCod = {};
Q.carritos.forEach(function (e) { var k = t(e.shortlink_code); (carPorCod[k] = carPorCod[k] || []).push(e); });
(Q.productos || []).forEach(function (e) { var k = t(e.shortlink_code); (prodPorCod[k] = prodPorCod[k] || []).push(e); });

// 🔴 lo EXCLUIDO: ahí vive la diferencia entre «no hubo eventos» y «los hubo y se tiraron»
var exPorCod = {};
['carritos', 'productos'].forEach(function (tipo) {
  var lista = (Q.excluidos && Q.excluidos[tipo]);
  if (!Array.isArray(lista)) return;
  lista.forEach(function (e) {
    var k = t(e.shortlink_code || e.codigo); if (!k) return;
    (exPorCod[k] = exPorCod[k] || []).push({ tipo: tipo, motivo: t(e.motivo || e.razon || e.por_que || e.excluido_por) || '?' });
  });
});

// ── el crudo purgado: ¿el shortlink existe siquiera en la fuente? ───────────
var crudoPorCod = null;
try {
  var purg = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart-purgados.json', 'utf8'));
  var filas = Array.isArray(purg) ? purg : (purg.filas || purg.eventos || purg.carritos || purg.purgados || []);
  if (Array.isArray(filas) && filas.length) {
    crudoPorCod = {};
    filas.forEach(function (e) {
      var k = t(e.shortlink_code || e.codigo); if (k) crudoPorCod[k] = (crudoPorCod[k] || 0) + 1;
    });
  }
} catch (e) { crudoPorCod = null; }

console.log('════════ AUDITORÍA · MAGGI LIGA MX · las cuatro capas ════════\n');
console.log('  catálogo ' + piezas.length + ' piezas   ·   SFMC ' + rutaSfmc.split(/[\\/]/).pop() +
  '   ·   bloque Qcart ' + mil(Q.carritos.length) + ' carritos / ' + mil((Q.productos || []).length) + ' productos');
console.log('  crudo purgado: ' + (crudoPorCod ? mil(Object.keys(crudoPorCod).length) + ' shortlinks distintos' : '⚠ no legible — la columna dirá «?»'));
console.log('  excluidos con shortlink identificable: ' + mil(Object.keys(exPorCod).length) + '\n');

var HALLAZGOS = [];
function hallazgo(id, que, detalle) { HALLAZGOS.push({ id: id, que: que, detalle: detalle }); }

// 🔴 EL MAESTRO SE LEE UNA VEZ Y ANTES DEL BUCLE. Es la autoridad del shortlink (R2); sin él esta
//    auditoría comparaba contra `Codigos_Qcart`, que es una columna de conveniencia del catálogo.
var MAE = { links: {} };
try {
  MAE = LK.leer(ENT.fuente('qcart_maestro'));
} catch (e) { console.log('  ⚠ no se pudo leer el maestro de links: ' + e.message); }
// qué shortlinks le atribuyó EL BLOQUE a cada pieza — lo que de verdad pasó, no lo declarado
var codsPorPieza = {};
['carritos', 'productos'].forEach(function (tp) {
  (Q[tp] || []).forEach(function (e) {
    var pi = t(e.pieza_id), c = t(e.shortlink_code);
    if (!pi || !c) return;
    (codsPorPieza[pi] = codsPorPieza[pi] || {})[c] = true;
  });
});

piezas.sort(function (a, b) { return t(a[K.id]).localeCompare(t(b[K.id])); }).forEach(function (p) {
  var id = t(p[K.id]), tp = t(p[K.tp]), seg = t(p[K.seg]), en = t(p[K.en]);
  var codigos = t(p[K.cods]).split(/[,;]/).map(t).filter(function (c) { return c && !TOKEN.test(c); });

  console.log('── ' + id + '  ·  ' + tp.padEnd(7) + '  ·  ' + seg);
  console.log('     catálogo   quincena ' + (t(p[K.quin]) || '—').padEnd(12) + ' fecha ' + (t(p[K.fecha]) || '—').padEnd(12) +
    ' Sends ' + (t(p[K.sends]) || '—').padEnd(10) + ' Tiene_Qcart ' + (t(p[K.tiene]) || '—'));

  // ── capa 2 · SFMC, por Email_Name
  // 🔴 UNA PIEZA PUEDE TENER VARIOS NOMBRES FÍSICOS, y esta celda los guarda separados por «·».
  //    Esta auditoría buscaba la celda ENTERA en el diccionario de SFMC y por eso declaraba
  //    «NO cruza» en las tres piezas de Liga MX que sí cruzan —005-P009, 005-P010 y 005-P012—,
  //    justo las que tienen dos nombres porque operación reusó el asset. La cadena de email ya
  //    parte por «·» (`porCN` en `fuentes-email.email-piezas.js`); la auditoría tenía que hacer
  //    lo mismo o contradecía al propio sistema que audita. Se prueban TODOS los nombres y se
  //    declara cuál respondió: el id lógico es uno, los nombres físicos son varios.
  var nombres = (en && !TOKEN.test(en)) ? en.split(/\s*[·|]\s*/).map(t).filter(Boolean) : [];
  var s = null, nombreQueCruza = '';
  for (var iN = 0; iN < nombres.length && !s; iN++) {
    if (sfmcPorNombre[nombres[iN]]) { s = sfmcPorNombre[nombres[iN]]; nombreQueCruza = nombres[iN]; }
  }
  if (!nombres.length) {
    console.log('     SFMC       — sin Email_Name declarado');
  } else if (!s) {
    console.log('     SFMC       🔴 NO cruza: ninguno de los ' + nombres.length + ' nombre(s) está en la DE');
    hallazgo(id, 'Email_Name declarado que SFMC no tiene', nombres.join(' · ').slice(0, 120));
  } else {
    if (nombres.length > 1) console.log('     SFMC       (cruza por el nombre ' + (nombres.indexOf(nombreQueCruza) + 1) + ' de ' + nombres.length + ')');
    console.log('     SFMC       ✔ cruza · ConfigKey «' + t(s.ConfigKey) + '» · sends ' + mil(s.Email_Sends) +
      ' · opens ' + mil(s.Email_Unique_Opens) + ' · clicks ' + mil(s.Email_Unique_Clicks));
    if (!/^\d{3}-[JP]\d{3}$/.test(t(s.ConfigKey))) {
      hallazgo(id, 'SFMC la publica con ConfigKey provisional, no con el Pieza_ID',
        '«' + t(s.ConfigKey) + '» — cruza por Email_Name, no por ConfigKey');
    }
    if (t(s.Touchpoint) && t(s.Touchpoint).toLowerCase() !== tp.toLowerCase()) {
      hallazgo(id, 'el touchpoint de SFMC no coincide con el del catálogo',
        'SFMC «' + t(s.Touchpoint) + '» vs catálogo «' + tp + '»');
    }
    // 🔴 SE COMPARA CONTRA SFMC **SIN LOS JOBS DE PRUEBA**, con el MISMO criterio que usa la
    //    cadena (`lib-fechas-envio`, umbral <10 envíos). El catálogo guarda el envío real; la DE
    //    agregada suma las pruebas. Comparar crudo contra crudo acusaba de descuadre a las tres
    //    piezas que están BIEN: J6-región-sur Δ2, J7 Δ4 y J8 Δ3 — que son exactamente sus correos
    //    de prueba. Dos criterios de «prueba» en el sistema es cómo una capa dice una cosa y otra
    //    dice otra; el criterio vive en un solo lugar y aquí se le pregunta, no se reimplementa.
    var sc = t(p[K.sends]);
    var pr = (PRUEBAS.porConfigKey[t(s.ConfigKey)] || {}).Email_Sends || 0;
    var sfmcReal = Number(s.Email_Sends) - pr;
    if (/^\d+$/.test(sc) && Number(sc) !== sfmcReal) {
      hallazgo(id, 'Sends del catálogo ≠ Sends de SFMC (ya sin jobs de prueba)',
        mil(sc) + ' vs ' + mil(sfmcReal) + '   (Δ ' + (sfmcReal - Number(sc)) + ')' +
        (pr ? '   [SFMC crudo ' + mil(s.Email_Sends) + ' − ' + pr + ' de prueba]' : ''));
    } else if (/^\d+$/.test(sc) && pr) {
      console.log('     SFMC       ✔ cuadra sin pruebas: ' + mil(sfmcReal) + ' (crudo ' + mil(s.Email_Sends) + ' − ' + pr + ' de prueba)');
    }
  }

  // ── capa 3 · Qcart, por SHORTLINK (R2)
  // 🔴 `Codigos_Qcart` NO ES LA AUTORIDAD DEL SHORTLINK — el maestro lo es (14-sep-2026). Esta
  //    rama daba por «sin Qcart» a piezas que tienen decenas de carritos bien anclados, solo
  //    porque esa columna del catálogo está vacía: `005-P006` recibía 63 carritos por `4tBsCXTp`,
  //    que el maestro declara en su hoja de Agosto, y la auditoría lo acusaba de no declarar nada.
  //    Antes de emitir el hallazgo se mira lo que de verdad importa: qué shortlinks le atribuyó el
  //    bloque a esta pieza y si el maestro los respalda.
  if (!codigos.length) {
    var delBloque = Object.keys(codsPorPieza[id] || {});
    var conMaestro = delBloque.filter(function (c) { return MAE.links[c]; });
    if (delBloque.length) {
      var huerf = delBloque.filter(function (c) { return !MAE.links[c]; });
      if (conMaestro.length) {
        console.log('     Qcart      ✔ ' + conMaestro.length + ' shortlink(s) anclados por el MAESTRO (el catálogo no los repite en Codigos_Qcart): ' + conMaestro.join(' · '));
      }
      if (huerf.length) {
        console.log('     Qcart      ⚠ ' + huerf.length + ' shortlink(s) que el MAESTRO NO declara — la pieza se la puso una vía más débil que el shortlink: ' + huerf.join(' · '));
        hallazgo(id, 'shortlink atribuido a esta pieza que el maestro NO declara (R2)', huerf.join(' · '));
      }
    } else {
      console.log('     Qcart      — sin códigos declarados y sin eventos en el bloque');
      if (t(p[K.tiene]).toLowerCase() === 'sí') hallazgo(id, 'dice Tiene_Qcart=Sí y NO tiene ni un evento de Qcart', '');
    }
  } else {
    codigos.forEach(function (c) {
      // 🔴 UN SHORTLINK SE PUEDE REUSAR ENTRE JORNADAS, así que contar por código sin mirar la
      //    pieza infla el número. `hTHNLqzL` (Aceitunas Toreadas) se usó en la J4 de agosto y otra
      //    vez en la J7 de septiembre: el bloque lo parte bien por fecha —48 carritos a 005-P006
      //    del 15-ago al 1-sep, 10 a 005-P010 del 3 al 13-sep— pero esta auditoría imprimía los
      //    58 debajo de J7. El reporte nunca estuvo mal (E-J7 = 13 = 10 + 3); la auditoría sí.
      var mios = function (arr) { return (arr || []).filter(function (e) { return t(e.pieza_id) === id; }); };
      var caTodos = carPorCod[c] || [];
      var ca = mios(caTodos), pr = mios(prodPorCod[c]), ex = exPorCod[c] || [];
      var otras = {};
      caTodos.forEach(function (e) { var q = t(e.pieza_id); if (q && q !== id) otras[q] = (otras[q] || 0) + 1; });
      var compartido = Object.keys(otras).length
        ? '   ⚠ link REUSADO: ' + Object.keys(otras).map(function (q) { return otras[q] + ' carrito(s) → ' + q; }).join(', ')
        : '';
      var enCrudo = crudoPorCod ? (crudoPorCod[c] || 0) : '?';
      var marca = ca.length ? '✔' : ((ex.length || (enCrudo !== '?' && enCrudo > 0)) ? '🔴' : '·');
      console.log('     Qcart      ' + marca + ' ' + c.padEnd(11) + 'carritos ' + String(ca.length).padStart(5) +
        '   productos ' + String(pr.length).padStart(4) + '   crudo ' + String(enCrudo).padStart(5) +
        (ex.length ? '   EXCLUIDOS ' + ex.length + ' → ' + ex[0].motivo : '') + compartido);
      if (!ca.length && ex.length) hallazgo(id, 'shortlink con eventos que el filtro descartó', c + ' · ' + ex.length + ' excluidos · ' + ex[0].motivo);
      if (!ca.length && !ex.length && enCrudo !== '?' && enCrudo > 0) hallazgo(id, 'shortlink en el crudo pero ausente del bloque', c + ' · ' + enCrudo + ' filas crudas, 0 en el bloque');
    });
  }

  // ── capa 4 · el reporte
  var fila = RC.cam && RC.tp ? R.filter(function (r) {
    return t(r[RC.cam]) === CAMPANA && t(r[RC.tp]).toLowerCase() === tp.toLowerCase();
  }) : [];
  if (!fila.length) {
    console.log('     reporte    🔴 sin fila en Report_Resumen');
    hallazgo(id, 'no tiene fila en el reporte', CAMPANA + ' · ' + tp);
  } else {
    fila.forEach(function (f) {
      console.log('     reporte    ✔ «' + t(f[RC.seg]) + '» · Principal_Sends ' + (t(RC.sends ? f[RC.sends] : '') || '—') +
        ' · Carritos_Total ' + (t(RC.carr ? f[RC.carr] : '') || '—'));
    });
  }
  console.log('');
});

// ── ¿hay carritos de Liga MX sin ancla de verdad? ───────────────────────────
//
// 🔴 CORREGIDO 14-sep-2026, Y ERA UN FALSO ROJO GRANDE. Esta sección declaraba «sin pieza dueña»
//    todo carrito cuyo shortlink no apareciera en la columna `Codigos_Qcart` del catálogo, y con
//    eso acusó a 76 carritos de estar huérfanos cuando estaban perfectamente anclados:
//    `4tBsCXTp` (63), `i8LZ55bd` (10) y `HThaf6bT` (3) los declara EL MAESTRO —hoja Agosto, con
//    `utm_content = e-j4`— y el bloque los ancló por ahí a 005-P006 y 005-P005. El catálogo no
//    los repite en `Codigos_Qcart`, que es una columna de conveniencia, no la autoridad.
//    Peor todavía: el detalle que imprimía era el `utm_content` del CSV, que en estas filas dice
//    `e-p1`. O sea que la auditoría ofrecía como prueba justamente el campo que R2 prohíbe usar
//    como ancla — y que aquí está mal. Un auditor que contradice la regla que audita no sirve.
//
//    Ahora se distinguen TRES estados, porque no son el mismo problema:
//      🔴 HUÉRFANO  · el evento no tiene `pieza_id`: no está en ninguna celda del reporte.
//      ⚠  SIN ANCLA · tiene pieza, pero su shortlink no lo declara ni el catálogo ni el maestro:
//                     lo atribuyó una vía más débil que el shortlink. Es la violación de R2.
//      ✔  ANCLADO   · el shortlink lo declara el maestro o el catálogo.
console.log('── carritos de Liga MX: ¿de dónde sale su ancla?');
var declarados = {};
piezas.forEach(function (p) {
  t(p[K.cods]).split(/[,;]/).map(t).forEach(function (c) { if (c && !TOKEN.test(c)) declarados[c] = t(p[K.id]); });
});
var hu = {}, sinAncla = {}, anclados = 0;
Q.carritos.forEach(function (e) {
  var u = (t(e.utm_campaign) + ' ' + t(e.utm_content)).toLowerCase();
  if (!/ligamx|liga-mx|\be-j\d/.test(u)) return;
  var c = t(e.shortlink_code);
  var m = MAE.links[c];
  if (declarados[c] || m) { anclados++; return; }
  // 🔴 el detalle se da con lo que DICE EL MAESTRO cuando existe, no con el utm del CSV.
  var k = c + '  (pieza ' + (t(e.pieza_id) || '—') + ' · utm del CSV: ' + t(e.utm_content) + ')';
  if (!t(e.pieza_id)) hu[k] = (hu[k] || 0) + 1;
  else sinAncla[k] = (sinAncla[k] || 0) + 1;
});
console.log('     ✔ anclados por el maestro o por el catálogo: ' + anclados);
if (!Object.keys(hu).length) console.log('     ✔ huérfanos (sin pieza, fuera del reporte): ninguno');
else Object.keys(hu).forEach(function (h) {
  console.log('     🔴 HUÉRFANO  ' + h + '   ' + hu[h] + ' carritos');
  hallazgo('—', 'carritos de Liga MX SIN PIEZA (no están en ninguna celda)', h + ' · ' + hu[h] + ' carritos');
});
Object.keys(sinAncla).forEach(function (h) {
  console.log('     ⚠  SIN ANCLA ' + h + '   ' + sinAncla[h] + ' carritos');
  hallazgo('—', 'carritos con pieza pero SIN shortlink declarado (atribuidos por una vía más débil que R2)', h + ' · ' + sinAncla[h] + ' carritos');
});

console.log('\n════════ HALLAZGOS: ' + HALLAZGOS.length + ' ════════');
HALLAZGOS.forEach(function (h, i) {
  console.log('  ' + String(i + 1).padStart(2) + '. [' + h.id + '] ' + h.que);
  if (h.detalle) console.log('      ' + h.detalle);
});
fs.writeFileSync(BACK + '/_preescritura/auditoria-ligamx.json',
  JSON.stringify({ cuando: new Date().toISOString(), piezas: piezas.length, hallazgos: HALLAZGOS }, null, 1));
console.log('\n  → _preescritura/auditoria-ligamx.json');
