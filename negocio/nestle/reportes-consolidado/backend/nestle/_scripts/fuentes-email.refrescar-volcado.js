/*
 * fuentes-email.refrescar-volcado.js — refresca los volcados de SFMC en `_insumos/`, monótono.
 *
 * 🔴 POR QUÉ EXISTE: NADIE era dueño de este paso. Los volcados se escribían a mano desde el MCP,
 *    así que el sistema no podía refrescar su propia fuente: el 22-sep el último volcado era del
 *    15-sep, J9 salió el 18-19, y `E-J9` aparecía en CERO en el reporte con las dos PUERTAS
 *    abiertas. El reporte no estaba mal — estaba VIEJO, y nada lo decía.
 *
 * 🔴 LA REGLA ES MONÓTONA, Y SE TOMA LA FILA COMPLETA, NO CAMPO POR CAMPO. Las métricas de email
 *    acumulan (opens y clicks siguen sumando días después del envío), así que un refresco solo
 *    puede SUBIR. Si una pieza baja sus envíos, NO se mezcla: se reporta, porque eso no es
 *    maduración, es otra cosa. Y se toma la fila entera a propósito: un MAX campo por campo
 *    dejaría `Open_Rate` sin corresponder con sus propios `opens/deliveries`.
 *
 * 🔴 Y EL DETALLE VIAJA CON LA AGREGADA, SIEMPRE. El criterio de «job de prueba» (<10 envíos) y
 *    las fechas de envío salen del DETALLE, y antes de restar se exige que el detalle cuadre
 *    EXACTO con la agregada. Refrescar una sola de las dos rompe ese invariante — así que este
 *    paso escribe las dos o no escribe ninguna, y lo comprueba pieza por pieza al final.
 *
 *   node fuentes-email.refrescar-volcado.js --piezas <fresco.json> --detalle <nuevas.json>
 *   node fuentes-email.refrescar-volcado.js ... --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();

var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var INS = BACK + '/_insumos';
var L = require(BACK + '/_scripts/lib-flexible.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[,$%\s]/g, '')); return isFinite(x) ? x : 0; };
function arg(n) { var i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; }

var HOY = new Date().toISOString().slice(0, 10);
var fPiezas = arg('piezas'), fDetalle = arg('detalle');
if (!fPiezas) { console.log('uso: --piezas <fresco.json> [--detalle <nuevas.json>] [--escribir]'); process.exit(1); }

console.log('════ fuentes-email · REFRESCAR VOLCADOS DE SFMC ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// ── el volcado vigente, elegido por el mismo resolutor que usa el lector del bloque ──
var vigPz = L.insumoVigente('sfmc-piezas');
var vigDt = L.insumoVigente('sfmc-detalle');
var rutaPz = typeof vigPz === 'string' ? vigPz : (vigPz && (vigPz.ruta || vigPz.archivo));
var rutaDt = typeof vigDt === 'string' ? vigDt : (vigDt && (vigDt.ruta || vigDt.archivo));
if (!rutaPz) { console.log('🔴 no hay volcado sfmc-piezas vigente'); process.exit(1); }
var VIEJO = JSON.parse(fs.readFileSync(rutaPz, 'utf8'));
var FRESCO = JSON.parse(fs.readFileSync(fPiezas, 'utf8'));
console.log('  vigente: ' + path.basename(rutaPz) + '   ' + VIEJO.count + ' piezas');
console.log('  fresco:  ' + path.basename(fPiezas) + '   ' + FRESCO.count + ' piezas\n');

var vj = {}; (VIEJO.rows || []).forEach(function (r) { vj[t(r.ConfigKey)] = r; });
var fr = {}; (FRESCO.rows || []).forEach(function (r) { fr[t(r.ConfigKey)] = r; });

var suben = [], bajan = [], nuevas = [], desaparecidas = [], iguales = 0;
Object.keys(fr).forEach(function (k) {
  var a = vj[k], b = fr[k];
  if (!a) { nuevas.push({ k: k, sends: num(b.Email_Sends), tp: t(b.Touchpoint), camp: t(b.Campana) }); return; }
  var d = num(b.Email_Sends) - num(a.Email_Sends);
  if (d > 0) suben.push({ k: k, de: num(a.Email_Sends), a: num(b.Email_Sends), d: d, tp: t(b.Touchpoint) });
  else if (d < 0) bajan.push({ k: k, de: num(a.Email_Sends), a: num(b.Email_Sends), d: d, tp: t(b.Touchpoint) });
  else iguales++;
});
Object.keys(vj).forEach(function (k) { if (!fr[k]) desaparecidas.push(k); });

console.log('── qué se movió');
console.log('     ▲ suben   ' + String(suben.length).padStart(3) + '   ' + (suben.length ? suben.map(function (x) { return x.k + ' +' + x.d.toLocaleString(); }).join(' · ') : ''));
console.log('     🆕 nuevas  ' + String(nuevas.length).padStart(3) + '   ' + (nuevas.length ? nuevas.map(function (x) { return x.k + ' (' + x.tp + ', ' + x.sends.toLocaleString() + ')'; }).join(' · ') : ''));
console.log('     = iguales ' + String(iguales).padStart(3));
if (bajan.length) console.log('     🔴 BAJAN   ' + String(bajan.length).padStart(3) + '   ' + bajan.map(function (x) { return x.k + ' ' + x.de + '→' + x.a; }).join(' · '));
if (desaparecidas.length) console.log('     🔴 la DE ya no trae: ' + desaparecidas.join(' · '));

/* 🔴 un refresco que BAJA no es maduración. No se mezcla en silencio: se detiene y se declara. */
if (bajan.length) { console.log('\n  🔴 ' + bajan.length + ' pieza(s) bajan sus envíos. El refresco NO es monótono: no se escribe nada.'); process.exit(1); }
if (desaparecidas.length) { console.log('\n  🔴 la DE dejó de traer piezas que el volcado tenía. No se escribe nada.'); process.exit(1); }

var dSends = suben.reduce(function (s, x) { return s + x.d; }, 0) + nuevas.reduce(function (s, x) { return s + x.sends; }, 0);
console.log('\n     Σ envíos: ' + (VIEJO.rows || []).reduce(function (s, r) { return s + num(r.Email_Sends); }, 0).toLocaleString() +
  ' → ' + (FRESCO.rows || []).reduce(function (s, r) { return s + num(r.Email_Sends); }, 0).toLocaleString() + '   (+' + dSends.toLocaleString() + ')');

// ── el detalle ──────────────────────────────────────────────────────────────────────
var DET = null, DETnuevo = null, filasNuevas = 0;
var fCompleto = arg('detalle-completo');
/* 🔴 EL DETALLE SE REEMPLAZA COMPLETO, no se parchea por días nuevos. Lo enseñó el invariante:
 *    parchear solo los `SendDay > 14-sep` dejó a `001-P015` con 52 filas de detalle cuando la
 *    agregada declara 63 días con envío — el volcado viejo YA venía incompleto para días
 *    anteriores, así que sumar los nuevos no lo cuadra. Y tres piezas más habían crecido SIN
 *    día nuevo (maduración): filtrar por `Fecha_Ultimo_Envio` no las ve. */
if (fCompleto && rutaDt) {
  DET = JSON.parse(fs.readFileSync(fCompleto, 'utf8'));
  var viejoDt = JSON.parse(fs.readFileSync(rutaDt, 'utf8'));
  console.log('\n── detalle COMPLETO: ' + (viejoDt.rows || []).length + ' filas → ' + (DET.rows || []).length +
    '   (+' + ((DET.rows || []).length - (viejoDt.rows || []).length) + ')');
  DET.__completo = true;
} else if (fDetalle && rutaDt) {
  DET = JSON.parse(fs.readFileSync(rutaDt, 'utf8'));
  DETnuevo = JSON.parse(fs.readFileSync(fDetalle, 'utf8'));
  var porLlave = {};
  /* la llave del detalle es su RowKey; si no viene, JobID+SendDay identifica el disparo del día */
  function llaveDet(r) { return t(r.RowKey) || (t(r.JobID) + '|' + t(r.SendDay)); }
  (DET.rows || []).forEach(function (r) { porLlave[llaveDet(r)] = r; });
  var antes = Object.keys(porLlave).length;
  (DETnuevo.rows || []).forEach(function (r) { porLlave[llaveDet(r)] = r; });     // el fresco gana
  filasNuevas = Object.keys(porLlave).length - antes;
  console.log('\n── detalle: ' + path.basename(rutaDt) + '   ' + antes + ' filas  +' + filasNuevas + ' nuevas  +' +
    ((DETnuevo.rows || []).length - filasNuevas) + ' actualizadas  = ' + Object.keys(porLlave).length);
  DET.rows = Object.keys(porLlave).map(function (k) { return porLlave[k]; });
}

// ── 🔴 EL INVARIANTE: el detalle tiene que cuadrar EXACTO con la agregada, pieza por pieza ──
if (DET) {
  var porCK = {};
  DET.rows.forEach(function (r) {
    var k = t(r.ConfigKey); if (!porCK[k]) porCK[k] = { sends: 0, del: 0, op: 0, cl: 0, n: 0 };
    porCK[k].sends += num(r.Email_Sends); porCK[k].del += num(r.Email_Deliveries);
    porCK[k].op += num(r.Email_Unique_Opens); porCK[k].cl += num(r.Email_Unique_Clicks); porCK[k].n++;
  });
  var descuadres = [];
  Object.keys(fr).forEach(function (k) {
    var d = porCK[k];
    if (!d) { descuadres.push(k + ': sin detalle'); return; }
    if (d.sends !== num(fr[k].Email_Sends)) descuadres.push(k + ': sends detalle ' + d.sends + ' vs agregada ' + num(fr[k].Email_Sends));
  });
  console.log('\n── invariante detalle ≡ agregada  (' + Object.keys(fr).length + ' piezas)');
  if (descuadres.length) {
    console.log('     🔴 ' + descuadres.length + ' descuadre(s): ' + descuadres.slice(0, 6).join(' · '));
    console.log('\n  🔴 el detalle NO cuadra con la agregada. No se escribe: la resta de pruebas quedaría mal.');
    process.exit(1);
  }
  console.log('     ✔ las ' + Object.keys(fr).length + ' piezas cuadran exacto entre detalle y agregada');
}

// ── los LINKS (CRM_Email_Links): la clasificación de clicks por destino ──────────────
/* 🔴 Va en el MISMO paso que las otras dos. El volcado de links estaba en el 4-sep —18 días—, y
 *    por eso `E-J9` tenía 94 clicks en la agregada y CERO clasificados: su bloque de
 *    `Clicks_CTA/Baja/Redes` pasó de `N/A` a `POR DEFINIR`. El dato no faltaba: faltaba el volcado. */
var LNK = null, lnkViejo = null;
var fLinks = arg('links');
if (fLinks) {
  var vigLk = L.insumoVigente('sfmc-links');
  var rutaLk = typeof vigLk === 'string' ? vigLk : (vigLk && (vigLk.ruta || vigLk.archivo));
  LNK = JSON.parse(fs.readFileSync(fLinks, 'utf8'));
  lnkViejo = rutaLk ? JSON.parse(fs.readFileSync(rutaLk, 'utf8')) : { rows: [] };
  /* 🔴 EL CAMPO ES `Clicks_Unique`. La primera versión sumó `Clicks_Unicos || Unique_Clicks ||
   *    Clicks` — ninguno existe — así que `num(undefined)` dio 0 para TODAS las piezas y la
   *    comparación fue `0 < 0` para todas: la guarda pasó en verde sin mirar nada, y dejó pasar
   *    la pérdida real de abajo. Se comprueba que el campo exista antes de confiar en la cuenta. */
  var CAMPO = 'Clicks_Unique';
  function clicksPorCK(rows) {
    var m = {}; (rows || []).forEach(function (r) {
      var k = t(r.ConfigKey); m[k] = (m[k] || 0) + num(r[CAMPO]);
    }); return m;
  }
  if (!(LNK.fields || []).length || (LNK.fields || []).indexOf(CAMPO) < 0) {
    console.log('\n  🔴 el volcado de links no trae el campo «' + CAMPO + '». Sin él la guarda no mide nada. No se escribe.');
    process.exit(1);
  }
  var cv0 = clicksPorCK(lnkViejo.rows), cn0 = clicksPorCK(LNK.rows);
  var bajan0 = Object.keys(cv0).filter(function (k) { return cn0[k] !== undefined && cn0[k] < cv0[k]; });
  var idas0 = Object.keys(cv0).filter(function (k) { return cn0[k] === undefined; });
  var nuevasLk = Object.keys(cn0).filter(function (k) { return cv0[k] === undefined; });
  console.log('\n── links: ' + (lnkViejo.rows || []).length + ' → ' + (LNK.rows || []).length + ' filas' +
    '   ·   piezas ' + Object.keys(cv0).length + ' → ' + Object.keys(cn0).length +
    (nuevasLk.length ? '   🆕 ' + nuevasLk.join(' · ') : ''));
  if (idas0.length) console.log('     ⚠ la DE ya no devuelve: ' + idas0.join(' · '));
  if (bajan0.length) console.log('     ⚠ la DE recontó a la baja: ' + bajan0.join(' · '));

  /* 🔴 UNIÓN CON MAX POR FILA, NUNCA REEMPLAZO. Reemplazar el volcado entero hizo dos daños
   *    reales, y ninguno lo habría visto una puerta:
   *      · la DE dejó de devolver `001-P002` y `001-P006` → dos filas del reporte perdieron
   *        clicks REALES (Tot_Clicks_CTA 325 y 532) y quedaron en POR DEFINIR
   *      · la DE recontó A LA BAJA cuatro piezas de AON
   *    Que una consulta ya no los traiga —o los cuente distinto— no significa que esos clicks no
   *    ocurrieran. Se une por `RowKey` y, cuando la fila existe en los dos, se queda la que tiene
   *    MÁS clicks únicos, ENTERA: tomar el máximo campo por campo dejaría `Clicks_Total` sin
   *    corresponder con `Clicks_Unique` de la misma fila. */
  var porRK = {}, gano = { viejo: 0, nuevo: 0, solo_viejo: 0, solo_nuevo: 0 };
  (lnkViejo.rows || []).forEach(function (r) { porRK[t(r.RowKey)] = r; gano.solo_viejo++; });
  (LNK.rows || []).forEach(function (r) {
    var k = t(r.RowKey), a = porRK[k];
    if (!a) { porRK[k] = r; gano.solo_nuevo++; return; }
    gano.solo_viejo--;
    if (num(r[CAMPO]) >= num(a[CAMPO])) { porRK[k] = r; gano.nuevo++; } else { gano.viejo++; }
  });
  LNK.rows = Object.keys(porRK).map(function (k) { return porRK[k]; });
  LNK.count = LNK.rows.length; LNK.retrieved = LNK.rows.length;
  LNK.__union = { ya_no_devuelve: idas0, reconto_a_la_baja: bajan0 };
  console.log('     unión por RowKey: ' + LNK.rows.length + ' filas   (gana el fresco ' + gano.nuevo +
    ' · gana el viejo ' + gano.viejo + ' · solo en el viejo ' + gano.solo_viejo + ' · solo en el fresco ' + gano.solo_nuevo + ')');

  /* y se COMPRUEBA que la unión sea monótona de verdad, pieza por pieza */
  var cf = clicksPorCK(LNK.rows);
  var malLk = Object.keys(cv0).filter(function (k) { return (cf[k] || 0) < cv0[k]; });
  if (malLk.length) {
    console.log('     🔴 tras la unión ' + malLk.length + ' pieza(s) siguen por debajo: ' + malLk.slice(0, 6).join(' · '));
    console.log('\n  🔴 no se escribe.'); process.exit(1);
  }
  console.log('     ✔ las ' + Object.keys(cv0).length + ' piezas del volcado anterior conservan o suben sus clicks');
}

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ── ESCRITURA de los dos volcados, con su procedencia ───────────────────────────────
var outPz = INS + '/sfmc-piezas-' + HOY + '.txt';
FRESCO.mixto = 'volcado COMPLETO pedido al MCP el ' + HOY + ' (DE CRM_Email_Piezas). Reemplaza a ' +
  path.basename(rutaPz) + '. Refresco monótono comprobado: ' + suben.length + ' piezas suben, ' +
  nuevas.length + ' nuevas, 0 bajan, 0 desaparecen.';
FRESCO.refrescado = (VIEJO.refrescado || []).concat([{
  fecha: HOY, filas: (FRESCO.rows || []).length, movidas: suben.length + nuevas.length,
  nota: 'refresco COMPLETO. +' + dSends.toLocaleString() + ' envíos. Nuevas: ' +
    (nuevas.map(function (x) { return x.k; }).join(', ') || 'ninguna') +
    '. El detalle se refrescó en el mismo acto y cuadra exacto pieza por pieza.'
}]);
fs.writeFileSync(outPz, JSON.stringify(FRESCO), 'utf8');
console.log('\n  ✔ ' + path.basename(outPz) + '   ' + (FRESCO.rows || []).length + ' piezas, ' + Math.round(fs.statSync(outPz).size / 1024) + ' KB');

if (DET) {
  var outDt = INS + '/sfmc-detalle-' + HOY + '.txt';
  DET.count = DET.rows.length; DET.retrieved = DET.rows.length;
  DET.mixto = DET.__completo ? ('volcado COMPLETO de CRM_Email_Detalle pedido al MCP el ' + HOY + '. Reemplaza a ' + path.basename(rutaDt) + ' entero: parchear por dias nuevos no cuadra porque el volcado viejo ya venia incompleto para dias anteriores.') : ('volcado ' + path.basename(rutaDt) + ' + las ' + (DETnuevo.rows || []).length +
    ' filas con SendDay > 2026-09-14 pedidas al MCP el ' + HOY +
    '. Los dias anteriores no se re-piden: el engagement madura en 3-7 dias y ya estaban finales.');
  fs.writeFileSync(outDt, JSON.stringify(DET), 'utf8');
  console.log('  ✔ ' + path.basename(outDt) + '   ' + DET.rows.length + ' filas, ' + Math.round(fs.statSync(outDt).size / 1024) + ' KB');
}

if (LNK) {
  var outLk = INS + '/sfmc-links-' + HOY + '.txt';
  LNK.mixto = 'volcado COMPLETO de CRM_Email_Links pedido al MCP el ' + HOY +
    '. El vigente era del 4-sep y por eso las piezas nuevas no tenian clasificacion de clicks por destino.' +
    ' UNION con el anterior por RowKey, quedandose la fila con MAS clicks unicos: la DE dejo de devolver [' +
    ((LNK.__union && LNK.__union.ya_no_devuelve) || []).join(', ') + '] y reconto a la baja [' +
    ((LNK.__union && LNK.__union.reconto_a_la_baja) || []).join(', ') +
    ']. Reemplazar en vez de unir perdio clicks reales de dos filas del reporte.';
  fs.writeFileSync(outLk, JSON.stringify(LNK), 'utf8');
  console.log('  ✔ ' + path.basename(outLk) + '   ' + (LNK.rows || []).length + ' filas, ' + Math.round(fs.statSync(outLk).size / 1024) + ' KB');
}

// ── releer del disco y comprobar que el resolutor elige los nuevos ──────────────────
var vp2 = L.insumoVigente('sfmc-piezas'), vd2 = L.insumoVigente('sfmc-detalle');
var r2p = typeof vp2 === 'string' ? vp2 : (vp2 && (vp2.ruta || vp2.archivo));
var r2d = typeof vd2 === 'string' ? vd2 : (vd2 && (vd2.ruta || vd2.archivo));
console.log('\n  ── el lector del bloque ahora tomará:');
console.log('     piezas:  ' + path.basename(String(r2p)) + (String(r2p).indexOf(HOY) >= 0 ? '  ✔' : '  🔴 NO es el nuevo'));
console.log('     detalle: ' + path.basename(String(r2d)) + (String(r2d).indexOf(HOY) >= 0 ? '  ✔' : '  🔴 NO es el nuevo'));
console.log('\n  ✅ VOLCADOS REFRESCADOS. Sigue: la cadena completa (orquestador.orquestador.js --escribir)');
