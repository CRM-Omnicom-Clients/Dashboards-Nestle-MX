// lib-fechas-envio · LA FECHA EN QUE UNA PIEZA SALIÓ DE VERDAD, del detalle día por día.
//
// 🔴 POR QUÉ NO SIRVE `Fecha_Primer_Envio` DE LA DE AGREGADA. Para `E-PROP1` dice **3-ago**, y
//    ese día SFMC registró cuatro jobs de **UN envío cada uno**: pruebas. El envío real arrancó
//    el **24-ago**. O sea, la fecha que el sistema tiene hoy es la de un correo de prueba, y de
//    ella sale la QUINCENA de la fila — así que la pieza está reportada en la quincena
//    equivocada. Ya estaba escrito en la memoria del proyecto: *«esa BU trae sobre todo pruebas
//    (`sent:1`) — verificar `sent>1` antes de cargar»*. Nadie lo estaba verificando.
//
// 🔴 EL UMBRAL SE DECLARA Y SE RINDE CUENTAS. Un job con menos de `UMBRAL` envíos no es un envío
//    de campaña. El número es una decisión, no una verdad, así que: (1) está aquí, en un solo
//    lugar; (2) el resumen dice cuántos jobs descartó y **cuánto volumen**; (3) si lo descartado
//    pasa del 1% del total, AVISA — a ese volumen ya no es una prueba y el umbral está mal.
//
// 🔴 Y NO TOCA LA QUINCENA. Esta librería produce un dato NUEVO. Cambiar `e.fecha` movería filas
//    de quincena en todo el reporte, y eso es una decisión de Rick, no un efecto colateral de
//    agregar una columna.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };

// 🔴 EL UMBRAL, EN UN SOLO LUGAR. Un job de menos de 10 envíos es una prueba interna: los que se
//    vieron en los datos son de 1, 2 y 4 envíos, siempre el mismo día y con el mismo asunto que
//    el envío real de días después.
var UMBRAL = 10;

function aISO(v) {
  var s = t(v); if (!s) return null;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}
function vigente(prefijo) {
  var dir = BACK + '/_insumos';
  var c = fs.readdirSync(dir).filter(function (f) { return new RegExp('^' + prefijo + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? dir + '/' + c[c.length - 1] : null;
}

function cargar() {
  var rutaDet = vigente('sfmc-detalle'), rutaPza = vigente('sfmc-piezas');
  if (!rutaDet || !rutaPza) return { porNombre: {}, resumen: { error: 'falta el volcado de SFMC' } };
  var det = (function () { var D = JSON.parse(fs.readFileSync(rutaDet, 'utf8')); return D.rows || D.data || []; })();
  var pza = (function () { var D = JSON.parse(fs.readFileSync(rutaPza, 'utf8')); return D.rows || D.data || []; })();

  // 🔴 EL CRUCE VA POR `Email_Name`, LA LLAVE NATURAL PROBADA — no por el ConfigKey, que para 16
  //    piezas es un `TMP-*` provisional. El detalle solo trae ConfigKey, así que se traduce con
  //    la DE agregada, que tiene los dos. Un salto más, pero por la llave buena.
  var nombreDe = {};
  pza.forEach(function (r) { var ck = t(r.ConfigKey); if (ck) nombreDe[ck] = t(r.EmailName); });

  // por job: su día y su volumen (un job puede gotear varios días)
  var jobs = {};
  det.forEach(function (r) {
    var ck = t(r.ConfigKey); if (!ck) return;
    var dia = aISO(r.SendDay || r.Send_Date); if (!dia) return;
    var k = ck + '¦' + t(r.JobID);
    if (!jobs[k]) jobs[k] = { ck: ck, job: t(r.JobID), envios: 0, dias: {} };
    jobs[k].envios += num(r.Email_Sends);
    jobs[k].dias[dia] = (jobs[k].dias[dia] || 0) + num(r.Email_Sends);
  });

  var porNombre = {}, descartados = 0, volDescartado = 0, volTotal = 0, ejemplos = [];
  Object.keys(jobs).forEach(function (k) {
    var j = jobs[k];
    volTotal += j.envios;
    var nom = nombreDe[j.ck];
    if (!nom) return;
    if (j.envios < UMBRAL) {
      descartados++; volDescartado += j.envios;
      if (ejemplos.length < 6) ejemplos.push({ pieza: j.ck, job: j.job, envios: j.envios, dia: Object.keys(j.dias)[0] });
      return;                                            // es una prueba: no fija fecha
    }
    var e = porNombre[nom] || (porNombre[nom] = { primero: null, ultimo: null, dias: 0, envios: 0, jobs: 0, porDia: {} });
    e.jobs++; e.envios += j.envios;
    Object.keys(j.dias).forEach(function (d) {
      if (j.dias[d] <= 0) return;
      e.dias++;
      if (!e.primero || d < e.primero) e.primero = d;
      if (!e.ultimo || d > e.ultimo) e.ultimo = d;
      e.porDia[d] = (e.porDia[d] || 0) + j.dias[d];
    });
  });

  // 🔴 EL PERIODO DE CADA PIEZA SE CALCULA DE SUS PROPIOS DÍAS, no se copia de una hermana.
  //    , ,  y el REPARTO por quincena son de la PIEZA:
  //    dos piezas de la misma campaña y touchpoint pueden haber mandado en semanas distintas.
  //    Heredarlas de la hermana porque «todas coinciden» es derivar por parecido — que es
  //    exactamente lo que el catálogo prohíbe. Aquí sale del dato: día por día, sin pruebas.
  Object.keys(porNombre).forEach(function (n) {
    var e = porNombre[n], dias = Object.keys(e.porDia).sort();
    var q = {}, m = {};
    dias.forEach(function (d) {
      var qq = d.slice(0, 7) + '-Q' + (Number(d.slice(8, 10)) <= 15 ? 1 : 2);
      q[qq] = (q[qq] || 0) + e.porDia[d];
      m[d.slice(0, 7)] = (m[d.slice(0, 7)] || 0) + e.porDia[d];
    });
    e.dias_lista = dias;
    e.dias_envio = dias.length;
    e.quincenas = Object.keys(q).sort();
    e.meses = Object.keys(m).sort();
    e.sends_por_quincena = e.quincenas.map(function (k) { return k + ':' + q[k]; }).join(' ; ');
    e.sends_por_mes = e.meses.map(function (k) { return k + ':' + m[k]; }).join(' ; ');
  });

  var pct = volTotal ? volDescartado / volTotal : 0;
  return {
    porNombre: porNombre, umbral: UMBRAL,
    resumen: {
      volcado: path.basename(rutaDet), piezas_con_fecha: Object.keys(porNombre).length,
      jobs_descartados: descartados, volumen_descartado: volDescartado, volumen_total: volTotal,
      pct_descartado: pct,
      // 🔴 el aviso que impide que el umbral se vuelva un número mágico sin dueño
      aviso: pct > 0.01 ? 'se descartó el ' + (pct * 100).toFixed(2) + '% del volumen como prueba: a ese peso YA NO es una prueba y el umbral (' + UMBRAL + ') está mal' : null,
      ejemplos: ejemplos
    }
  };
}

// ══ LO QUE APORTAN LAS PRUEBAS, POR PIEZA ══════════════════════════════════════════
//
// 🔴 VIVE AQUÍ Y NO EN EL BLOQUE DE EMAIL a propósito: el criterio de «esto es una prueba» tiene
//    que ser UNO. Si el bloque tuviera su propia definición, un día se ajustaría el umbral aquí y
//    allá no, y la fecha diría que una pieza salió el 24 mientras sus métricas siguen contando el
//    envío del 3. Es la copia que diverge, aplicada al criterio en vez de al dato.
//
// 🔴 SE DEVUELVE LO QUE HAY QUE RESTAR, no el total ya limpio. Así el que resta puede comprobar
//    su propia aritmética contra la fuente agregada, y un error de resta se ve.
var METRICAS = ["Email_Sends","Email_Deliveries","Email_Unique_Opens","Email_Unique_Clicks","Email_Bounces","Email_Unique_Unsubs","Email_Total_Unsubs"];
function pruebas() {
  var rutaDet = vigente('sfmc-detalle'), rutaPza = vigente('sfmc-piezas');
  if (!rutaDet) return { porConfigKey: {}, total: {}, umbral: UMBRAL };
  var det = (function () { var D = JSON.parse(fs.readFileSync(rutaDet, 'utf8')); return D.rows || D.data || []; })();
  var jobs = {};
  det.forEach(function (r) {
    var k = t(r.ConfigKey) + String.fromCharCode(166) + t(r.JobID);
    if (!jobs[k]) jobs[k] = { ck: t(r.ConfigKey), envios: 0, filas: [] };
    jobs[k].envios += Number(String(r.Email_Sends || 0).replace(/[, ]/g, '')) || 0;
    jobs[k].filas.push(r);
  });
  var porCK = {}, total = {};
  METRICAS.forEach(function (m) { total[m] = 0; });
  Object.keys(jobs).forEach(function (k) {
    var j = jobs[k]; if (j.envios >= UMBRAL) return;
    if (!porCK[j.ck]) { porCK[j.ck] = { jobs: 0 }; METRICAS.forEach(function (m) { porCK[j.ck][m] = 0; }); }
    porCK[j.ck].jobs++;
    j.filas.forEach(function (r) {
      METRICAS.forEach(function (m) {
        var v = Number(String(r[m] || 0).replace(/[, ]/g, '')) || 0;
        porCK[j.ck][m] += v; total[m] += v;
      });
    });
  });
  return { porConfigKey: porCK, total: total, umbral: UMBRAL, metricas: METRICAS };
}

/* ── `Email_Total_Clicks` por pieza, SIN los jobs de prueba ──────────────────────────────
 * 🔴 POR QUÉ VIVE AQUÍ Y NO EN EL BLOQUE (24-sep-2026). El desglose de clicks por destino y el
 *    total con el que se compara tienen que salir de la MISMA vara, y la que cierra es la de
 *    clicks TOTALES: medido sobre las 107 piezas, únicos-por-link contra únicos-por-correo excede
 *    en 103; totales contra totales cuadra en 107 con residuo de 3 clicks.
 *
 *    Pero `Email_Total_Clicks` NO está en la DE agregada (`CRM_Email_Piezas`): solo en el DETALLE.
 *    Y el detalle trae los jobs de prueba mezclados. Sumarlo por fuera sería inventar un SEGUNDO
 *    criterio de «prueba» — y ya sabemos qué pasa con eso: la fecha diría que salió el 24 mientras
 *    las métricas siguen contando el envío del 3. El umbral vive en UN solo lugar, y este también.
 */
function totalesPorPieza() {
  var rutaDet = vigente('sfmc-detalle');
  if (!rutaDet) return { porConfigKey: {}, umbral: UMBRAL, error: 'falta el volcado de detalle' };
  var det = (function () { var D = JSON.parse(fs.readFileSync(rutaDet, 'utf8')); return D.rows || D.data || []; })();
  var jobs = {};
  det.forEach(function (r) {
    var k = t(r.ConfigKey) + String.fromCharCode(166) + t(r.JobID);
    if (!jobs[k]) jobs[k] = { ck: t(r.ConfigKey), envios: 0, filas: [] };
    jobs[k].envios += Number(String(r.Email_Sends || 0).replace(/[, ]/g, '')) || 0;
    jobs[k].filas.push(r);
  });
  var porCK = {}, descartados = 0;
  Object.keys(jobs).forEach(function (k) {
    var j = jobs[k];
    if (j.envios < UMBRAL) { descartados++; return; }          // el MISMO umbral, no otro
    if (!porCK[j.ck]) porCK[j.ck] = { Email_Total_Clicks: 0, Email_Total_Opens: 0, jobs: 0 };
    porCK[j.ck].jobs++;
    j.filas.forEach(function (r) {
      porCK[j.ck].Email_Total_Clicks += Number(String(r.Email_Total_Clicks || 0).replace(/[, ]/g, '')) || 0;
      porCK[j.ck].Email_Total_Opens += Number(String(r.Email_Total_Opens || 0).replace(/[, ]/g, '')) || 0;
    });
  });
  return { porConfigKey: porCK, umbral: UMBRAL, jobs_descartados: descartados, piezas: Object.keys(porCK).length };
}

module.exports = { cargar: cargar, pruebas: pruebas, totalesPorPieza: totalesPorPieza, METRICAS: METRICAS, UMBRAL: UMBRAL, aISO: aISO };
