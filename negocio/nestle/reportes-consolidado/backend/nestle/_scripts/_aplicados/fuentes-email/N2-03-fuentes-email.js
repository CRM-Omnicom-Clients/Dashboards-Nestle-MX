// N2 · EMAIL → BACKEND.  Produce `_fuentes/email.json`, la capa que N3 consume.
//
// 🔴 REGLA DE RICK QUE MANDA AQUÍ: **nunca atribuir con una sola variable.** Medido:
//
//      Journey_ID solo                    31 llaves / 264 filas   🔴 29 colisiones
//      asset solo                         19 llaves               🔴 16 colisiones
//      asset + fecha                     112 llaves               🔴 69 colisiones
//      asset + fecha + segmento + tipo   232 llaves               🔴 29 colisiones
//      cola(55) + fecha                  264 llaves / 264 filas   ✔ ÚNICA y completa
//
//    Por eso `Journey_ID` NO es la llave: es un ATRIBUTO que hay que completar y auditar.
//
// 🔴 Y la columna está MEZCLADA, no rota: 205 de 264 traen GUID válido, 58 traen el asset_id
//    y 1 está vacía. Se completa desde Datorama lo que se pueda, se DECLARA lo que no, y
//    **nunca se borra el valor que ya estaba** — se guarda al lado con su conflicto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
// 🔴 SUPERADO por N2a-email.js (19-ago-2026)
//    la carga de email es el bloque N2a; su llave y su diff quedaron atrás.
//    Se conserva por su historia, no por su utilidad: corre sobre un esquema que ya cambió.
var SUPERADO_POR = "N2a-email.js";
if (!process.env.CORRER_SUPERADO) {
  console.log("\n  🔴 este script está SUPERADO por " + SUPERADO_POR + ".");
  console.log("     la carga de email es el bloque N2a; su llave y su diff quedaron atrás");
  console.log("     Si de verdad lo necesitas: CORRER_SUPERADO=1 node N2-03-fuentes-email.js\n");
  process.exit(0);
}
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-conflictos.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = D.t, num = D.num;
var esGuid = function (v) { return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(t(v)); };

var T = os.homedir() + '/_n2fe.xlsx';
fs.copyFileSync(VIVO_(), T);
var E = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var inv = D.inventario(PROY + '/Reportes-Datorama');
var fuente = inv[0];
var R = D.leerArchivo(fuente.ruta);

// ── índice de la fuente: TODAS las filas por llave, no la primera.
// 🔴 Un mismo envío aparece en VARIAS hojas de mes (187 de 247 llaves). La hoja de su mes trae
//    los sends; las otras traen sends=0 pero **opens y clicks REALES** — el engagement que
//    siguió acumulando después. Quedarse con la primera fila pierde eso en silencio.
var dat = {};
R.hojas.forEach(function (h) {
  h.filas.forEach(function (r) {
    var cn = t(r['Email Content Name']); if (!cn) return;
    var k = D.llaveEnvio({ content_name: cn, fecha: r['Send Date'] });
    (dat[k] = dat[k] || []).push(r);
  });
});

var MET = ['Email_Sends', 'Email_Deliveries', 'Email_Unique_Opens', 'Email_Unique_Clicks', 'Email_Bounces'];
var MAP = { Email_Sends: 'Email Sends', Email_Deliveries: 'Email Deliveries', Email_Unique_Opens: 'Email Unique Opens', Email_Unique_Clicks: 'Email Unique Clicks', Email_Bounces: 'Email Bounces' };

var histJourney = {};   // historia del journey_id en exports anteriores (vacía = no aparece en ninguno)
var st = { escalan: [], resueltos: [], completados: 0, sinCompletar: [], conflictos: [], creciero: 0, sinPar: 0, multimes: 0, deltaOpens: 0, deltaClicks: 0 };
var envios = E.map(function (r) {
  var k = D.llaveEnvio({ content_name: r['Email_Content_Name'], fecha: r['Send_Date'] });
  var todas = dat[k] || [];
  var d = todas[0];
  var o = {
    llave: k,
    content_name: t(r['Email_Content_Name']),
    asset_id: D.assetDe(r['Email_Content_Name']),
    fecha: D.isoFecha(r['Send_Date']),
    campana_raw: t(r['Campana_Canonica']),
    segmento_raw: t(r['Segmento_Canonico']),
    touchpoint_raw: t(r['Touchpoint']),
    email_type: t(r['Email_Type']),
    canal: t(r['Canal']) || 'Email',
    audiencia: t(r['Audience_Name']),
    nombre_journey: t(r['Nombre_Journey']),
    fuente: 'Data_Email (workbook)'
  };
  MET.forEach(function (m) { o[m.toLowerCase()] = num(r[m]); });

  // ── Journey_ID: se resuelve con procedencia, nunca pisando lo que ya estaba
  var actual = t(r['Journey_ID']);
  var deFuente = d ? t(d['Journey ID']) : '';
  if (!d) st.sinPar++;
  if (esGuid(actual) && esGuid(deFuente) && actual.toUpperCase() !== deFuente.toUpperCase()) {
    // 🔴 El conflicto NO se conserva sin resolver: pasa por lib-conflictos, que aplica en orden
    //    cambio-en-el-tiempo → precedencia declarada → procedencia → escala UNA vez.
    //    Antes yo lo dejaba abierto y la sesión siguiente volvía a preguntar lo mismo.
    var res = C.resolver({
      campo: 'journey_id',
      valorA: actual, fuenteA: 'workbook Data_Email · procedencia desconocida',
      valorB: deFuente, fuenteB: 'Datorama · ' + fuente.archivo,
      historia: histJourney[k] || []
    });
    o.journey_id = res.valor;
    o.journey_id_descartado = res.valor === actual ? deFuente : actual;   // nunca se borra el otro
    o.journey_id_origen = res.regla + ' · ' + res.detalle;
    if (res.escala) st.escalan.push({ cn: o.content_name.slice(-40), a: actual, b: deFuente, para: res.paraDecidir });
    else st.resueltos.push({ cn: o.content_name.slice(-40), regla: res.regla, gana: res.valor });
    st.conflictos.push({ cn: o.content_name.slice(-40), cargado: actual, fuente: deFuente, resuelto: !res.escala });
  } else if (esGuid(actual)) {
    o.journey_id = actual; o.journey_id_origen = 'ya venía correcto' + (esGuid(deFuente) ? ' · confirmado por Datorama' : '');
  } else if (esGuid(deFuente)) {
    o.journey_id = deFuente; o.journey_id_origen = 'completado desde ' + fuente.archivo;
    o.journey_id_anterior = actual || '(vacío)';
    st.completados++;
  } else {
    o.journey_id = ''; o.journey_id_origen = 'sin GUID en ninguna fuente' + (actual ? ' · lo cargado era "' + actual + '" (es el asset, no un journey)' : '');
    o.journey_id_anterior = actual;
    st.sinCompletar.push(o);
  }

  // ── monotonía: MAX sobre TODAS las filas de la llave. Nada baja nunca.
  if (todas.length) {
    var subio = false;
    MET.forEach(function (m) {
      var mx = Math.max.apply(null, todas.map(function (x) { return num(x[MAP[m]]); }));
      if (mx > o[m.toLowerCase()]) { o[m.toLowerCase()] = mx; subio = true; }
    });
    if (subio) { st.creciero++; o.refrescado = fuente.archivo; }

    // 🔴 DECISIÓN DE MEDICIÓN QUE NO ES MÍA — se declara con su número, no se resuelve sola.
    //    El engagement sigue acumulando meses después del envío. Cada hoja de mes trae los
    //    opens DE ESE MES para el mismo envío.
    //      MAX  = el mejor mes solo            → subcuenta 73,928 opens (3.9%) en total
    //      SUMA = todos los meses              → doble-cuenta a quien abrió en abril Y en mayo
    //             ("unique" es único POR PERIODO, no de por vida)
    //    Se usa MAX (conservador, es lo que ya estaba) y se guarda la SUMA al lado para que
    //    la diferencia sea visible y Rick decida. Nunca se elige en silencio.
    if (todas.length > 1) {
      o.opens_suma_meses = todas.reduce(function (a, x) { return a + Math.max(0, num(x['Email Unique Opens'])); }, 0);
      o.clicks_suma_meses = todas.reduce(function (a, x) { return a + Math.max(0, num(x['Email Unique Clicks'])); }, 0);
      o.meses_con_engagement = todas.length;
      o.criterio_engagement = 'MAX (un solo mes) · la SUMA de los ' + todas.length + ' meses está en opens_suma_meses — decisión pendiente';
      st.multimes++;
      st.deltaOpens += Math.max(0, o.opens_suma_meses - o.email_unique_opens);
      st.deltaClicks += Math.max(0, o.clicks_suma_meses - o.email_unique_clicks);
    }
  }
  return o;
});

// ── salida
var out = {
  paso: 'N2 · email', generado_por: 'N2-03-fuentes-email.js',
  fuente: { archivo: fuente.archivo, generado: fuente.generado, nota: 'elegido por su sello INTERNO, no por el WK del nombre' },
  llave: 'cola(55) del content_name ¦ fecha — única en las ' + envios.length + ' filas',
  envios: envios,
  auditoria: {
    journey_id_completados: st.completados,
    journey_id_sin_completar: st.sinCompletar.length,
    journey_id_conflictos: st.conflictos.length,
    journey_id_conflictos_resueltos_por_regla: st.resueltos.length,
    journey_id_conflictos_que_escalan: st.escalan.length,
    metricas_refrescadas: st.creciero,
    filas_sin_pareja_en_export: st.sinPar,
    envios_con_engagement_multimes: st.multimes,
    DECISION_PENDIENTE: {
      que: "engagement que acumula en meses posteriores al envio",
      criterio_actual: "MAX de un solo mes (conservador, es lo que ya estaba cargado)",
      alternativa: "SUMA de todos los meses",
      diferencia_opens: st.deltaOpens,
      diferencia_clicks: st.deltaClicks,
      por_que_no_lo_decido: "sumar unique opens de varios meses doble-cuenta a quien abrio en dos periodos distintos; es una decision de medicion, no de codigo"
    }
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
fs.writeFileSync(BACK + '/_fuentes/email.json', JSON.stringify(out, null, 1));

console.log('════ N2 · EMAIL → BACKEND ════');
console.log('  fuente: ' + fuente.archivo + '  (' + fuente.generado + ')');
console.log('  envíos: ' + envios.length + '   llave única: ' + (new Set(envios.map(function (e) { return e.llave; })).size === envios.length ? '✔' : '🔴'));
console.log('');
console.log('  ── Journey_ID (atributo, NO llave)');
console.log('     ya venía correcto      : ' + envios.filter(function (e) { return /ya venía/.test(e.journey_id_origen); }).length);
console.log('     ✔ completados de fuente: ' + st.completados);
console.log('     conflictos: ' + st.conflictos.length + ' → resueltos por regla ' + st.resueltos.length + ' · escalan ' + st.escalan.length);
st.resueltos.slice(0,2).forEach(function(x){console.log('        ✔ ' + x.regla + '  ' + x.cn)});
st.escalan.forEach(function(x){console.log('        🔴 ESCALA: ' + x.cn)});
console.log('     ⛔ sin GUID en ninguna : ' + st.sinCompletar.length);
st.sinCompletar.slice(0, 4).forEach(function (o) { console.log('        ' + o.campana_raw.padEnd(14) + o.content_name.slice(-40)); });
console.log('');
console.log('  ── métricas');
console.log('     refrescadas por MAX    : ' + st.creciero);
console.log('     envíos multi-mes       : ' + st.multimes);
console.log('     🔴 DECISIÓN PENDIENTE  : MAX deja fuera ' + st.deltaOpens.toLocaleString() + ' opens y ' + st.deltaClicks.toLocaleString() + ' clicks de meses posteriores');
console.log('        (sumarlos doble-contaría a quien abrió en dos meses — decide tú, el número está guardado)');
console.log('     Σ sends                : ' + envios.reduce(function (a, e) { return a + e.email_sends; }, 0).toLocaleString());
console.log('\n  → ' + BACK + '/_fuentes/email.json');
