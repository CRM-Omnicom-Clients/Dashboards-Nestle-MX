// motor-calculo · EL MOTOR DE CÁLCULO. Convierte los 4 bloques + el catálogo en una REJILLA NEUTRA.
//
// 🔴 ES EL ÚNICO SCRIPT QUE CALCULA. Las fuentes (email-bloque..manual-bloque) tienen prohibido calcular: solo traen
//    datos crudos. Por eso `Data_Email` tiene 8 columnas marcadas `n5` en el contrato y
//    `Data_WhatsApp` otras 4: nadie las llena hasta aquí.
//
// 🔴 NO ABRE EL EXCEL. Produce una rejilla en el backend y se acabó. Quien escribe es escritor-datos, y
//    quien decide cómo se ve es resumen-regenerar. Un paso que calcula Y escribe es un script que, cuando falla,
//    no se sabe si falló calculando o escribiendo.
//
// LAS TRES SALIDAS, y para qué sirve cada una:
//    por_registro       → las columnas `n5` de las hojas de datos, fila a fila
//    por_pieza          → todo lo de una pieza junto, que es la unidad del catálogo
//    por_campana_periodo→ la rejilla del Reporte Resumen: campaña × quincena
//
// ⚠ UNA TASA SOBRE CERO NO ES CERO, ES NULL. Si no hubo envíos, la tasa de apertura no es 0%:
//   es una pregunta sin respuesta. Ponerle 0 la mete en los promedios y arrastra el reporte
//   hacia abajo sin que nadie sepa por qué.
// ⚠ UN CTOR SIN CLICKS MEDIDOS NO EXISTE. WhatsApp declara `Clicks_Medidos`: donde dice «No»,
//   los clicks son `Read × un CTOR asumido`. Calcular el CTOR con eso devuelve exactamente el
//   supuesto y lo disfraza de medición.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'motor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var R = require(__dirname + '/lib-registro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// ── la tasa: null cuando la pregunta no se puede responder ──────────────────────────
function tasa(numerador, denominador) {
  if (numerador === null || numerador === undefined) return null;
  if (!denominador) return null;                    // 0, null o undefined → no hay tasa
  return numerador / denominador;
}
// 🔴 EL MOTOR NO REIMPLEMENTA LA QUINCENA. Tenía su propia `quincenaDe`, con su propia regla y su
//    propio formato (`Mar-Q1-2026`), y por eso el reporte y el catálogo llegaron a no cruzar en
//    NINGUNA de sus 86 filas. Además reventó en cuanto una fecha no fue un ISO limpio: hacía
//    `new Date(iso + 'T00:00:00Z')` sin preguntarse qué venía.
//    Ahora se pide a `lib-quincena`, que es la fundación: una regla (1–15 = Q1 · 16–fin = Q2) y un
//    formato (`AAAA-MM-Qn`, que ordena alfabéticamente igual que cronológicamente).
var QN = require(__dirname + '/lib-quincena.js');
var EQ = require(__dirname + '/lib-esquema.js');
var FE = require(__dirname + '/lib-fechas-envio.js');
// 🔴 la fecha del envío REAL, del detalle día por día: la de la DE agregada la fija una PRUEBA
//    de 1 envío (E-PROP1 dice 3-ago y salió el 24-ago). Solo alimenta las columnas nuevas.
var FECHAS = FE.cargar();
var MES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function mesDe(iso) { var m = QN.mesDe(QN.deFecha(iso) || iso); return m ? m.nombre : null; }
function quincenaDe(iso) { return QN.deFecha(iso) || QN.normalizar(iso); }

console.log('════════ motor-calculo · MOTOR DE CÁLCULO ════════\n');
var B = {};
['email', 'qcart', 'whatsapp', 'manual'].forEach(function (n) {
  try { B[n] = JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); }
  catch (e) { console.log('  🔴 falta el bloque ' + n); process.exit(1); }
});
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n5.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var PZ = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var piezaDe = {}; PZ.forEach(function (p) { if (t(p['Pieza_ID'])) piezaDe[t(p['Pieza_ID'])] = p; });
// 🔴 los nombres físicos del catálogo se resuelven por el REGISTRO, no se hardcodean. A11 renombró
//    Content_ID y EmailName; sin esto motor-calculo leería undefined y el reporte perdería esas columnas.
//    Es justo para lo que el registro existe: el id lógico no cambia, el nombre físico sí.
var _encCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var _hCat = R.abrir('catalogo', _encCat, { silencioso: true });
function NC(id) { try { return _hCat.n('catalogo.' + id); } catch (e) { return null; } }
var COL_CONTENT_ID = NC('content_id'), COL_EMAIL_NAME = NC('content_name');
console.log('  bloques: email ' + B.email.envios.length + ' · qcart ' + (B.qcart.carritos.length + B.qcart.productos.length) +
  ' · whatsapp ' + B.whatsapp.envios.length + ' · manual ' + ((B.manual.datos || []).length));
console.log('  catálogo: ' + PZ.length + ' piezas\n');

// ══ 1 · POR REGISTRO — las columnas `n5` de las hojas ═══════════════════════════════
var porRegistro = { email: [], whatsapp: [] };
var avisos = [];

B.email.envios.forEach(function (e) {
  var sends = num(e.email_sends), deliv = num(e.email_deliveries);
  var opens = num(e.email_unique_opens), clicks = num(e.email_unique_clicks), bounces = num(e.email_bounces);
  // 🔴 las banderas son del MOTOR, no de la fuente: la fuente no juzga, solo trae.
  //    Y `Flag_Rate_Mismatch` no compara contra un umbral inventado: comprueba la ARITMÉTICA
  //    interna — que entregados + rebotes no pase de enviados. Eso o cuadra o no cuadra.
  var mismatch = (sends !== null && deliv !== null && bounces !== null) ? (deliv + bounces > sends + 1) : null;
  porRegistro.email.push({
    llave: e.llave, content_name: e.content_name, fecha: e.fecha, pieza_id: e.pieza_id || null,
    Delivery_Rate: tasa(deliv, sends),
    Open_Rate: tasa(opens, deliv),
    Click_Rate: tasa(clicks, deliv),
    CTOR: tasa(clicks, opens),
    Bounce_Rate: tasa(bounces, sends),
    Flag_Zero_Sends: sends === 0 || sends === null,
    Flag_Negative_Values: [sends, deliv, opens, clicks, bounces].some(function (x) { return x !== null && x < 0; }),
    Flag_Rate_Mismatch: mismatch
  });
});

B.whatsapp.envios.forEach(function (e) {
  var sends = num(e.sends), deliv = num(e.deliveries), read = num(e.opens_read);
  var clicks = num(e.clicks), err = num(e.errores);
  // 🔴 el CTOR solo existe donde el click está MEDIDO. Donde `clicks_medidos` dice No, el
  //    numerador es `Read × un CTOR asumido`: dividirlo entre Read devuelve el supuesto, con
  //    dos decimales de falsa precisión. Ahí el CTOR es null y se dice por qué.
  var medido = /^s/i.test(t(e.clicks_medidos));
  porRegistro.whatsapp.push({
    campana_raw: e.campana_raw, sends: sends, fecha: e.fecha, pieza_id: e.pieza_id || null,
    Delivery_Rate: tasa(deliv, sends),
    Read_Rate: tasa(read, deliv),
    CTOR: medido ? tasa(clicks, read) : null,
    CTOR_no_calculable: medido ? null : 'los clicks no estan medidos en esta campania: la fuente los deriva de un CTOR asumido',
    Pct_Error: tasa(err, sends)
  });
});
console.log('  ── por registro');
console.log('     email    : ' + porRegistro.email.length + ' filas · con Delivery_Rate ' +
  porRegistro.email.filter(function (x) { return x.Delivery_Rate !== null; }).length);
console.log('     whatsapp : ' + porRegistro.whatsapp.length + ' filas · con CTOR real ' +
  porRegistro.whatsapp.filter(function (x) { return x.CTOR !== null; }).length +
  ' · sin CTOR posible ' + porRegistro.whatsapp.filter(function (x) { return x.CTOR_no_calculable; }).length);

// ══ 2 · POR PIEZA — la unidad del catálogo ══════════════════════════════════════════
var porPieza = {};
function pieza(id) {
  if (!id) return null;
  if (!porPieza[id]) {
    var p = piezaDe[id] || {};
    porPieza[id] = {
      pieza_id: id, bu: t(p['BU']), marca: t(p['Marca']), campana: t(p['Campaña']),
      touchpoint: t(EQ.campo(p, 'TouchPoint', 'Touchpoint')), segmento: t(p['Segmento']), email_type: t(p['Email_Type']),
      oleada: t(p['Oleada']) || null, mascota: t(p['Mascota']) || null, canal: t(p['Canal']),
      email: { sends: 0, deliveries: 0, opens: 0, clicks: 0, bounces: 0, envios: 0 },
      whatsapp: { sends: 0, deliveries: 0, read: 0, clicks: 0, envios: 0, clicks_medidos: true },
      qcart: { carritos: 0, views: 0, importe_total: 0, importe_nestle: 0, productos: 0, dias: {}, tiendas: {} },
      en_catalogo: !!piezaDe[id]
    };
  }
  return porPieza[id];
}
B.email.envios.forEach(function (e) {
  var g = pieza(e.pieza_id); if (!g) return;
  g.email.sends += num(e.email_sends) || 0; g.email.deliveries += num(e.email_deliveries) || 0;
  g.email.opens += num(e.email_unique_opens) || 0; g.email.clicks += num(e.email_unique_clicks) || 0;
  g.email.bounces += num(e.email_bounces) || 0; g.email.envios++;
});
B.whatsapp.envios.forEach(function (e) {
  var g = pieza(e.pieza_id); if (!g) return;
  g.whatsapp.sends += num(e.sends) || 0; g.whatsapp.deliveries += num(e.deliveries) || 0;
  g.whatsapp.read += num(e.opens_read) || 0; g.whatsapp.clicks += num(e.clicks) || 0;
  g.whatsapp.envios++;
  if (!/^s/i.test(t(e.clicks_medidos))) g.whatsapp.clicks_medidos = false;
});
B.qcart.carritos.forEach(function (e) {
  var g = pieza(e.pieza_id); if (!g) return;
  /* 🔴 UN CARRITO ES UNA VISTA, NO UNA FILA DEL CSV (24-sep-2026).
   *    Una fila del export de Qcart es un BUCKET —día × hora × shortlink × utm × tienda— con su
   *    contador `views`. Contar filas decía 3,077 donde Qcart dice 7,503, y el 37% de las filas
   *    traen más de una vista, así que el error no salta revisando casos sueltos: solo al sumar.
   *    Probado contra el export AGREGADO del propio Qcart, mismo periodo: `e-j7` da 221 = 221, y
   *    donde las vistas coinciden exacto (62 shortlinks) el IMPORTE coincide en 61. Contando
   *    filas coincidían 36 de 121.
   * 🔴 Ninguna puerta lo vio porque las cuatro capas —CSV, bloque, rejilla, reporte— descienden
   *    del mismo conteo: coincidían entre ellas. La primera medida externa fue la que Rick trajo
   *    de su sesión con Qcart. */
  g.qcart.carritos += num(e.views) || 0; g.qcart.views += num(e.views) || 0;
  g.qcart.importe_total += num(e.total_shown_price) || 0;
  if (e.fecha) g.qcart.dias[e.fecha] = 1;
  if (e.store) g.qcart.tiendas[e.store] = (g.qcart.tiendas[e.store] || 0) + (num(e.views) || 0);
});
B.qcart.productos.forEach(function (e) {
  var g = pieza(e.pieza_id); if (!g) return;
  g.qcart.productos++; g.qcart.importe_nestle += num(e.total_shown_price) || 0;
});

// las derivadas de la pieza
Object.keys(porPieza).forEach(function (id) {
  var g = porPieza[id];
  g.email.delivery_rate = tasa(g.email.deliveries, g.email.sends);
  g.email.open_rate = tasa(g.email.opens, g.email.deliveries);
  g.email.click_rate = tasa(g.email.clicks, g.email.deliveries);
  g.email.ctor = tasa(g.email.clicks, g.email.opens);
  g.whatsapp.delivery_rate = tasa(g.whatsapp.deliveries, g.whatsapp.sends);
  g.whatsapp.read_rate = tasa(g.whatsapp.read, g.whatsapp.deliveries);
  g.whatsapp.ctor = g.whatsapp.clicks_medidos ? tasa(g.whatsapp.clicks, g.whatsapp.read) : null;
  // 🔴 LA PENETRACIÓN ES UN PISO, NO UNA MEDICIÓN. El doc 3 de Qcart solo itemiza ~8% de los
  //    productos del carrito, así que `importe_nestle / importe_total` sale bajo por construcción.
  //    Se calcula igual —es el mejor dato que hay— pero viaja marcada, para que el reporte no la
  //    presente como si fuera la penetración real.
  g.qcart.penetracion = tasa(g.qcart.importe_nestle, g.qcart.importe_total);
  g.qcart.penetracion_es_piso = g.qcart.penetracion !== null;
  g.qcart.ticket_promedio = tasa(g.qcart.importe_total, g.qcart.views);
  g.qcart.dias_con_actividad = Object.keys(g.qcart.dias).length;
  g.qcart.tienda_top = Object.keys(g.qcart.tiendas).sort(function (a, b) { return g.qcart.tiendas[b] - g.qcart.tiendas[a]; })[0] || null;
  delete g.qcart.dias;
});
var conDatos = Object.keys(porPieza).length;
var sinCatalogo = Object.keys(porPieza).filter(function (k) { return !porPieza[k].en_catalogo; });
console.log('\n  ── por pieza');
console.log('     piezas con datos: ' + conDatos + ' de ' + PZ.length + ' del catálogo');
console.log('     con email: ' + Object.keys(porPieza).filter(function (k) { return porPieza[k].email.envios; }).length +
  ' · con whatsapp: ' + Object.keys(porPieza).filter(function (k) { return porPieza[k].whatsapp.envios; }).length +
  ' · con qcart: ' + Object.keys(porPieza).filter(function (k) { return porPieza[k].qcart.carritos; }).length);
if (sinCatalogo.length) {
  avisos.push('🔴 ' + sinCatalogo.length + ' pieza_id con datos que NO están en el catálogo: ' + sinCatalogo.join(' · '));
  console.log('     🔴 con datos pero sin ficha en el catálogo: ' + sinCatalogo.join(' · '));
}

// ══ 3 · POR CAMPAÑA × PERIODO — la rejilla del Resumen ═════════════════════════════
//
// 🔴 EL ANCLAJE DE QCART ES LO MÁS DELICADO DE TODO EL REPORTE. El Qcart es MENSUAL y el email
//    es QUINCENAL. Si se reparte el Qcart entre las quincenas del mes, se inventa un reparto que
//    nadie midió; si se repite en cada quincena, sumar la columna cuenta el mismo carrito dos
//    veces. La regla: el Qcart del mes se ancla a la quincena de LANZAMIENTO (la del primer
//    envío Principal de ese mes) y aparece UNA SOLA VEZ. Las demás quincenas del mismo mes
//    llevan la marca `— ver <quincena>` para que se vea que no es un cero, es un «está allá».
var rejilla = {};
// 🔴 UNA CELDA SABE SI SU CAMPANA VIENE DEL CATALOGO O ES UN CRUDO SIN RESOLVER.
//    Sin esa marca, «Maggi» (crudo de un envio sin pieza) se sienta en la misma tabla que
//    «Mundial» (canonico del catalogo) y el reporte los presenta como iguales. No lo son: uno
//    esta atribuido y el otro no. Mezclarlos es exactamente lo que la escalera de alias existe
//    para evitar, deshecho en el ultimo paso.
function celda(dim, delCatalogo) {
  var k = [dim.campana, dim.objetivo, dim.touchpoint, dim.segmento, dim.quincena].join('¦');
  if (!rejilla[k]) rejilla[k] = {
    campana: dim.campana, medio: dim.medio || 'email', objetivo: dim.objetivo,
    touchpoint: dim.touchpoint, segmento: dim.segmento, quincena: dim.quincena, mes: dim.mes,
    bu: dim.bu || '', marca: dim.marca || '',
    campana_del_catalogo: !!delCatalogo,
    // 🔴 4-sep-2026 · LAS BAJAS, SEPARADAS POR BLOQUE (Rick: «unsubscribe versus los sends y
    //    versus los opens, tanto para las versiones principales como para los subs como para el
    //    total. O sea, para todo»). Hasta hoy la baja solo vivía a nivel de CELDA
    //    (`unsubs_unicos`), o sea Principal+FUP fundidos, y por eso no había forma de decir si
    //    la gente se daba de baja en el envío principal o en el seguimiento — que es justo la
    //    comparación que el dato existe para dar. Se acumula en el mismo lugar y con el mismo
    //    criterio que sends/opens/clicks: quien decide a qué bloque va es `email_type`.
    // 🔴 `fecha_ini` / `fecha_fin` = el primer y último día con envío REAL de ese bloque. NO se
    //    usan para la quincena: la quincena sigue saliendo de donde salía, porque cambiarla
    //    movería filas en todo el reporte y eso es decisión de Rick, no efecto colateral.
    principal: { subject: '', sends: 0, deliveries: 0, opens: 0, clicks: 0, bounces: 0, unsubs: 0, unsubs_tot: 0, fecha_ini: null, fecha_fin: null, piezas: 0 },
    fup: { subject: '', sends: 0, deliveries: 0, opens: 0, clicks: 0, bounces: 0, unsubs: 0, unsubs_tot: 0, fecha_ini: null, fecha_fin: null, piezas: 0 },
    whatsapp: { sends: 0, deliveries: 0, read: 0, clicks: 0, no_entregados: 0, errores: 0, piezas: 0, clicks_medidos: true },
    qcart: null, qcart_ancla: null, piezas: [],
    // 🔴 las columnas que pidio Rick el 21-ago: la DE de audiencia y su volumen, las bajas y el
    //    desglose de clicks por DESTINO. Se acumulan aqui porque el reporte no calcula nada: si
    //    hiciera falta sumar en resumen-regenerar, seria senal de que a motor-calculo le falta una columna.
    audiencias: {}, audiencia_volumen: 0, unsubs_unicos: 0, unsubs_total: 0,
    clicks_por_destino: {},
    // los dos IDs que el reporte lleva al final, como conjuntos (una celda agrupa varias piezas)
    email_ids: {}, content_ids: {}, email_names: {}
  };
  if (delCatalogo) rejilla[k].campana_del_catalogo = true;
  return rejilla[k];
}
// 🔴 LA GRANULARIDAD LA MANDA LA HOJA, NO YO. `Report_Resumen` abre por Campana x Objetivo x
//    TouchPoint x Segmento x Quincena, y trae Principal y FUP como COLUMNAS PAREADAS en la misma
//    fila. Agrupar solo por campana x quincena —como hacia la primera version— fundia piezas que
//    la hoja separa, y el reporte habria salido con menos filas de las que tiene, cada una
//    sumando cosas que nadie pidio sumar.
// 🔴 UN ENVIO SIN FECHA NO ES UN ENVIO QUE NO EXISTIO.
//    El motor tiraba a la basura todo envio cuya `fecha` viniera vacia, dejando un aviso. Eso hizo
//    que `009-P005` (Fuel for life · Activos) desapareciera del Reporte Resumen con sus 25,212
//    envios: la fuente no trae el DIA, pero SI trae la quincena, y el catalogo la tiene registrada
//    con su procedencia («Send_Quincena declarada (2026-07-Q1) · la fuente no trae el dia»).
//    Usarla no es inventar un dato: es leer el que ya estaba escrito. Lo que si seria inventar es
//    ponerle un dia. Por eso se cae al PERIODO declarado por la pieza, nunca a una fecha.
// 🔴 LO QUE EL MOTOR DEJA FUERA, EL MOTOR LO DECLARA — y ese es el numero que los validadores
//    citan. Antes cada validador re-derivaba el motivo por su cuenta («los que no traen fecha»),
//    y en cuanto el motor cambio de criterio la cuenta se desfaso: N5-99 y PUERTA-2 se pusieron rojos
//    sumando 25,212 envios que YA estaban dentro de la rejilla. Un check que recalcula la decision
//    de otro paso termina midiendo su propia copia de la regla, no la regla.
var fueraDeLaRejilla = [];

function periodoDe(e, p) {
  var q = quincenaDe(e.fecha);
  if (q) return { quincena: q, mes: mesDe(e.fecha), via: 'fecha del envio' };
  if (!p) return null;
  // 🔴 LA QUINCENA TIENE **UN** FORMATO: `AAAA-MM-Qn` (27-ago-2026). Esta función convertía la
  //    del catálogo a `Jul-Q1-2026` porque «la rejilla usa ese» — y ya no: 75 de las 77 celdas
  //    están en `AAAA-MM-Qn`. Las 2 que salían por aquí (Mundial · Partido 2 y Partido 3) eran
  //    las únicas con el otro formato, y en el reporte se veían como una quincena distinta.
  //    El canónico ordena alfabéticamente igual que cronológicamente y no depende del idioma
  //    del mes; el otro no hace ninguna de las dos cosas. Dos formatos conviviendo ya costó una
  //    vez que 0 de 86 filas cruzaran, y el síntoma es siempre el mismo: nada falla, solo no casa.
  var qCat = t(EQ.campo(p, 'Quincena', 'Quincena_Lanzamiento'));
  var m = /^(\d{4})-(\d{2})-Q([12])$/.exec(qCat);
  if (!m) return null;
  var mi = parseInt(m[2], 10) - 1;
  if (!(mi >= 0 && mi < 12)) return null;
  return {
    quincena: qCat,                    // tal cual la declara el catálogo: mismo formato que el resto
    mes: MES_ES[mi],
    via: 'quincena declarada en el catalogo (la fuente no trae el dia)'
  };
}

function dimsDe(e, p) {
  return {
    campana: p ? t(p['Campaña']) : (t(e.campana_canonica) || t(e.campana_raw) || '(sin campaña)'),
    objetivo: p ? t(p['Objetivo']) : (t(e.objetivo) || ''),
    touchpoint: p ? t(EQ.campo(p, 'TouchPoint', 'Touchpoint')) : (t(e.touchpoint_raw) || ''),
    // 🔴 A · EL SUBSEGMENTO ENTRA EN LA IDENTIDAD DE LA CELDA (Rick, 20-ago: «como yo lo tengo»).
    //    Pro Plan no se reporta por persona: se reporta por **persona × mascota**, y así lo tiene
    //    Rick escrito — `Pro Plan Aspiracionales — Perros`, con guion largo. Agregar por persona
    //    fundía tres piezas en una y sus tres filas se quedaban sin datos.
    segmento: p
      // el subsegmento solo se concatena si es un DATO: con los tres estados, un 'N/A'
      // es truthy y pegaba «New Parents — N/A» en el reporte.
      // 🔴 Y CON EL MISMO SEPARADOR Y LA MISMA GUARDA QUE `NC-email-piezas`. Esta era la SEGUNDA
      //    copia de la regla: allá quedó `·` y aquí seguía `—`, así que el bloque salía limpio y
      //    la rejilla volvía a doblarlo — «Pro Plan Aspiracionales · Gatos — Gatos» en 15 filas.
      //    Ningún check lo vio porque cada script se validaba contra su propia salida; lo enseñó
      //    el RENDER. Si el segmento ya trae el subsegmento, no se le pega otra vez.
      //    🔴 15-sep-2026: delega en `lib-esquema.segmentoCanonico`. Esta misma línea estaba
      //       copiada en tres scripts y faltaba en el bloque de Qcart; ver la nota de la librería.
      ? EQ.segmentoCanonico(t(p['Segmento']), t(p['Subsegmento']))
      : (t(e.segmento_canonico) || t(e.segmento_raw) || ''),
    bu: p ? t(p['BU']) : t(e.bu_canonico), marca: p ? t(p['Marca']) : t(e.marca_canonica)
  };
}
B.email.envios.forEach(function (e) {
  var p = e.pieza_id ? piezaDe[e.pieza_id] : null;
  var per = periodoDe(e, p);
  if (!per) {
    fueraDeLaRejilla.push({ medio: 'email', content_name: t(e.content_name), pieza_id: e.pieza_id || null,
      sends: num(e.email_sends) || 0, motivo: 'sin periodo: ni fecha en la fuente ni quincena en el catalogo' });
    avisos.push('🔴 envio de email SIN PERIODO: ni fecha en la fuente ni quincena en el catalogo, ' +
      'asi que sus ' + (num(e.email_sends) || 0).toLocaleString('es-MX') + ' envios NO llegan al reporte · ' +
      t(e.content_name).slice(-40)); return;
  }
  if (per.via !== 'fecha del envio') avisos.push('⚠ ' + t(e.content_name).slice(-34) + ': ' + per.via + ' → ' + per.quincena);
  var d = dimsDe(e, p); d.quincena = per.quincena; d.mes = per.mes; d.medio = 'email';
  var c = celda(d, !!p || !!t(e.campana_canonica));
  var esFUP = /follow/i.test(t(e.email_type));
  var b = esFUP ? c.fup : c.principal;
  // 🔴 la AUDIENCIA no se suma entre piezas: es el tamano de una DE, y dos piezas pueden
  //    compartirla. Se guarda el conjunto y el volumen se toma UNA vez por DE distinta.
  if (t(e.audiencia_de)) c.audiencias[t(e.audiencia_de)] = num(e.audiencia_volumen) || 0;
  c.unsubs_unicos += num(e.email_unique_unsubs) || 0;
  c.unsubs_total += num(e.email_total_unsubs) || 0;
  b.sends += num(e.email_sends) || 0; b.deliveries += num(e.email_deliveries) || 0;
  b.opens += num(e.email_unique_opens) || 0; b.clicks += num(e.email_unique_clicks) || 0;
  b.bounces += num(e.email_bounces) || 0; b.piezas++;
  // 🔴 LA BAJA VA AL MISMO BLOQUE QUE SU ENVÍO. `email_unique_unsubs` es la baja REAL que
  //    entrega SFMC — no el click en el link de baja, que es otra cosa y da un número parecido
  //    y equivocado. Se suma a `b`, el bloque que ya eligió `esFUP`, así que Principal y FUP no
  //    se pueden cruzar por construcción. Y `c.unsubs_unicos` sigue sumándose aparte para que
  //    la identidad Σbloques = celda se pueda VERIFICAR en vez de suponerse.
  b.unsubs += num(e.email_unique_unsubs) || 0;
  b.unsubs_tot += num(e.email_total_unsubs) || 0;
  // 🔴 LA FECHA DEL ENVÍO REAL, cruzada por `Email_Name` (la llave natural probada, 104/104).
  //    Una celda puede agrupar varias piezas, así que se toma el MÍNIMO de los primeros y el
  //    MÁXIMO de los últimos: el rango completo en que ese bloque estuvo saliendo.
  var fr = FECHAS.porNombre[t(e.content_name)];
  if (fr) {
    if (fr.primero && (!b.fecha_ini || fr.primero < b.fecha_ini)) b.fecha_ini = fr.primero;
    if (fr.ultimo && (!b.fecha_fin || fr.ultimo > b.fecha_fin)) b.fecha_fin = fr.ultimo;
  }
  if (!b.subject && t(e.subject)) b.subject = t(e.subject);
  if (e.pieza_id && c.piezas.indexOf(e.pieza_id) < 0) c.piezas.push(e.pieza_id);
  // 🔴 los IDs para las dos columnas del reporte: Email_ID (creativo) y Content_ID (del content name).
  //    Vienen coma-separados desde NB (una pieza puede reusar varios creativos), se disgregan y se
  //    guardan como conjunto para no repetir cuando la celda agrupa varias piezas.
  // 🔴 C1 · LOS DOS IDENTIFICADORES SON DOS COSAS (Rick, 20-ago):
  //    · `EmailName`  = la cadena COMPLETA de la Data Extension. Vive en el CATÁLOGO.
  //    · `Content_ID` = el SEGMENTO FINAL de esa cadena. Es lo que va en el reporte.
  //    Ninguno sale del journey. El catálogo ya los tiene separados y validados, así que se
  //    toman de ahí: recalcular el corte aquí sería una segunda opinión que puede contradecir
  //    a la primera.
  t(e.email_id).split(/\s*,\s*/).forEach(function (x) { if (x) c.email_ids[x] = 1; });
  var cidCat = (p && COL_CONTENT_ID) ? t(p[COL_CONTENT_ID]) : '';
  if (cidCat) c.content_ids[cidCat] = 1;
  else t(e.content_id).split(/\s+·\s+/).forEach(function (x) { if (x) c.content_ids[x] = 1; });
  if (p && COL_EMAIL_NAME && t(p[COL_EMAIL_NAME])) c.email_names[t(p[COL_EMAIL_NAME])] = 1;
});
B.whatsapp.envios.forEach(function (e) {
  var p = e.pieza_id ? piezaDe[e.pieza_id] : null;
  var per = periodoDe(e, p);
  if (!per) {
    fueraDeLaRejilla.push({ medio: 'whatsapp', campana_raw: t(e.campana_raw), pieza_id: e.pieza_id || null,
      sends: num(e.sends) || 0, motivo: 'sin periodo: ni fecha en la fuente ni quincena en el catalogo' });
    avisos.push('🔴 envio de WhatsApp SIN PERIODO: sus ' + (num(e.sends) || 0).toLocaleString('es-MX') +
      ' envios NO llegan al reporte · ' + t(e.campana_raw)); return;
  }
  if (per.via !== 'fecha del envio') avisos.push('⚠ WhatsApp ' + t(e.campana_raw) + ': ' + per.via + ' → ' + per.quincena);
  var d = dimsDe(e, p); d.quincena = per.quincena; d.mes = per.mes; d.medio = 'whatsapp';
  var c = celda(d, !!p || !!t(e.campana_canonica));
  c.whatsapp.sends += num(e.sends) || 0; c.whatsapp.deliveries += num(e.deliveries) || 0;
  c.whatsapp.read += num(e.opens_read) || 0; c.whatsapp.clicks += num(e.clicks) || 0;
  c.whatsapp.no_entregados += num(e.no_entregados) || 0; c.whatsapp.errores += num(e.errores) || 0;
  c.whatsapp.piezas++;
  if (e.pieza_id && c.piezas.indexOf(e.pieza_id) < 0) c.piezas.push(e.pieza_id);
  if (!/^s/i.test(t(e.clicks_medidos))) c.whatsapp.clicks_medidos = false;
});

// 🔴 F1 (Rick, 21-ago-2026): EL QCART VA POR PIEZA (touchpoint × segmento), NO por campaña.
//    Antes se acumulaba TODO el Qcart de la campaña×mes en un solo grupo y se anclaba a UNA celda.
//    Eso colapsaba a un solo segmento y borraba la comparación entre segmentos —que es justo para
//    lo que el reporte existe—. Y cuadraba igual al sumar, así que ninguna puerta lo veía.
//    Cada evento de Qcart trae su `pieza_id` (por su shortlink), así que agrupar por pieza no
//    duplica: la suma de la columna sigue siendo el total. La quincena sigue siendo el ancla
//    temporal (el Qcart es mensual), pero decide EN QUÉ FILA se pega, no CUÁNTAS filas hay.
// 🔴 SE AGRUPA POR PIEZA, NO POR PIEZA×MES. Un shortlink se activa UNA vez y genera carritos por
//    meses (larga cola: un link de marzo trae carritos hasta agosto). Agrupar por pieza×mes dejaba
//    1,218 carritos sin anclar, porque su mes-de-evento no tiene envío. La atribución correcta es
//    a la PIEZA que los generó: todos sus carritos, desde la activación, a su celda de lanzamiento.
var qcartPieza = {};
function grupoPieza(pid) {
  qcartPieza[pid] = qcartPieza[pid] || { pieza_id: pid, carritos: 0, views: 0, importe_total: 0,
    importe_nestle: 0, productos: 0, views_productos: 0, tiendas: {}, recetas: {}, desde: null, hasta: null };
  return qcartPieza[pid];
}
B.qcart.carritos.forEach(function (e) {
  var pid = t(e.pieza_id); if (!pid) return;   // sin pieza no se atribuye
  var g = grupoPieza(pid);
  /* mismo cambio que arriba, en el grano de la rejilla: un carrito es una VISTA, no una fila */
  g.carritos += num(e.views) || 0; g.views += num(e.views) || 0;
  g.importe_total += num(e.total_shown_price) || 0;
  // 🔴 LA TIENDA ES MULTIVALOR. Un carrito puede ir a «chedraui+walmart», y contarlo entero en
  //    cada una duplica. Se reparte por tienda solo cuando la tienda es UNA; si son varias, se
  //    cuenta en «combinado», que es lo que de verdad pasó.
  var st = t(e.store).toLowerCase();
  var key = !st ? '(sin tienda)' : (st.indexOf('+') >= 0 || st.indexOf(',') >= 0 ? 'combinado' : st);
  /* 🔴 y el reparto por tienda también: `Carritos_Walmart` contaba filas. Si `Carritos_Total`
   *    pasa a vistas y el desglose por tienda se queda en filas, la suma de las tiendas deja de
   *    dar el total — una incoherencia nueva dentro de la misma fila. */
  g.tiendas[key] = (g.tiendas[key] || 0) + (num(e.views) || 0);
  if (t(e.shortlink_name)) g.recetas[t(e.shortlink_name)] = (g.recetas[t(e.shortlink_name)] || 0) + (num(e.views) || 0);
  if (e.fecha) { if (!g.desde || e.fecha < g.desde) g.desde = e.fecha; if (!g.hasta || e.fecha > g.hasta) g.hasta = e.fecha; }
});
B.qcart.productos.forEach(function (e) {
  var pid = t(e.pieza_id); if (!pid) return;
  var g = grupoPieza(pid);
  g.productos++;
  g.importe_nestle += num(e.total_shown_price) || 0;
  g.views_productos += num(e.views) || 0;
});

// la quincena de LANZAMIENTO de cada PIEZA = la del primer envío PRINCIPAL de ESA pieza (cualquier mes)
var lanzamiento = {};
B.email.envios.forEach(function (e) {
  if (/follow/i.test(t(e.email_type))) return;
  var pid = t(e.pieza_id); if (!pid) return;
  var p = piezaDe[pid];
  if (!lanzamiento[pid] || (e.fecha && e.fecha < lanzamiento[pid].fecha)) {
    var dl = dimsDe(e, p); dl.medio = 'email';
    // 🔴 K1 · EL QCART SE ANCLA DESDE SU FECHA DE ACTIVACIÓN, NO DESDE LA DEL ENVÍO (Rick, 20-ago).
    //    El catálogo guarda las dos por separado; aquí se usa la que le toca a cada cosa: el envío
    //    manda en email, la activación manda en Qcart.
    var fAct = p ? t(p['Fecha_Activacion_Qcart']) : '';
    var perL = periodoDe(e, p);
    lanzamiento[pid] = {
      fecha: e.fecha,
      quincena: quincenaDe(fAct || e.fecha) || (perL ? perL.quincena : ''),
      quincena_envio: perL ? perL.quincena : quincenaDe(e.fecha),
      mes: mesDe(e.fecha) || (perL ? perL.mes : ''),
      activacion: fAct || null,
      quincena_via: fAct ? 'activación del link (' + fAct + ')' : 'fecha del envío',
      dims: dl
    };
  }
});
// 🔴 las piezas de WhatsApp también anclan su Qcart: no tienen envío de EMAIL (Semifinal, Final
//    de Maggi salen por WhatsApp), así que su ancla es su propia celda de WhatsApp. El email manda
//    si la pieza tiene los dos; si no, WhatsApp. Sin esto, 132 carritos de 3 piezas de WA se
//    quedaban sin fila.
B.whatsapp.envios.forEach(function (e) {
  var pid = t(e.pieza_id); if (!pid || lanzamiento[pid]) return;
  var p = piezaDe[pid];
  var perL = periodoDe(e, p); if (!perL) return;
  var fAct = p ? t(p['Fecha_Activacion_Qcart']) : '';
  var dl = dimsDe(e, p); dl.medio = 'whatsapp';
  lanzamiento[pid] = {
    fecha: e.fecha || '',
    quincena: quincenaDe(fAct) || perL.quincena,
    quincena_envio: perL.quincena,
    mes: perL.mes,
    activacion: fAct || null,
    quincena_via: fAct ? 'activación del link (' + fAct + ')' : 'periodo del envío de WhatsApp',
    dims: dl
  };
});

// 🔴 F2 (Rick, 26-ago-2026) · UNA PIEZA CON QCART SIGUE TENIENDO AUDIENCIA AUNQUE SU ENVÍO NO
//    ESTÉ CARGADO. «Cada audiencia, por cada touchpoint que tiene Qcart, que quede bien.»
//    El caso: `001-P005` —AON · E-P1 · Traditional Parents— es la única pieza de AON sin fila en
//    el bloque de email. Sin envío no había registro de lanzamiento, y sus **366 carritos** se
//    quedaban sin fila: el reporte decía «No» donde el shortlink dice 366, y el segmento perdía
//    su intención de compra mientras los otros siete la conservaban. El motor lo DECLARABA
//    («1 bloque sin envío Principal»), pero un aviso no llena una celda ni detiene el corte.
// 🔴 EL CARRITO PERTENECE A LA PIEZA QUE LO GENERÓ, y esa pieza declara su campaña, su
//    touchpoint y su segmento en el CATÁLOGO. Esa atribución no depende de que el envío esté
//    cargado — depende del shortlink, que ya la trae. Leerla del catálogo no es inferir: es leer
//    el dato que ya estaba escrito, igual que `periodoDe` lee la quincena declarada.
// 🔴 R3 SIGUE INTACTA: esto NO fabrica una celda. Solo ancla si la celda de ese
//    campaña × objetivo × touchpoint × segmento × quincena YA EXISTE. Si ninguna de sus
//    quincenas candidatas tiene celda, la pieza sigue en `sinAncla` y se declara igual que antes.
var anclaPorCatalogo = [];
Object.keys(qcartPieza).forEach(function (pid) {
  if (lanzamiento[pid]) return;                 // ya tiene envío: manda el envío
  var p = piezaDe[pid]; if (!p) return;         // sin ficha no hay dimensiones que leer
  // 🔴 EL MEDIO SALE DEL CANAL DE LA PIEZA, NO DE UN LITERAL (30-sep-2026). Esta rama —la de una
  //    pieza con Qcart cuyo envío todavía no está cargado— escribía `medio = 'email'` a secas, y
  //    con eso `005-P016 · WA-J10` llegó al reporte clasificada como **email** teniendo `Canal =
  //    WhatsApp` en su ficha. La fila de al lado, `WA-J9`, decía whatsapp: dos piezas del mismo
  //    canal presentadas como canales distintos, en filas contiguas.
  //    🔴 Y NO LO VIO NINGÚN CHECK: no cambia ninguna suma, así que las dos puertas, el guardián de
  //    unidades y las 12 comprobaciones del resumen pasaron en verde. Lo destapó MIRAR EL RENDER.
  //    Las otras dos ramas (email y WhatsApp) ya leían su medio del envío; esta no tiene envío que
  //    leer, y por eso es la única donde había que preguntárselo al catálogo.
  var dl = dimsDe({}, p);
  dl.medio = /whats/i.test(t(p['Canal'])) ? 'whatsapp' : 'email';
  var fAct = t(p['Fecha_Activacion_Qcart']);
  var qCat = QN.normalizar(t(EQ.campo(p, 'Quincena', 'Quincena_Lanzamiento')));
  // el mismo orden que ya usa el ancla: manda la activación del link; si esa quincena no tiene
  // celda, la declarada por el catálogo. Nunca una tercera inventada.
  var elegida = null;
  [quincenaDe(fAct), qCat].forEach(function (q) {
    if (elegida || !q) return;
    if (rejilla[[dl.campana, dl.objetivo, dl.touchpoint, dl.segmento, q].join('¦')]) elegida = q;
  });
  // 🔴 F3 (27-ago-2026) · SI LA PIEZA DECLARA UNA IDENTIDAD COMPLETA, SU CELDA NACE.
  //    R3 dice que el ancla no se FABRICA, y sigue en pie: lo que prohíbe es inventarle una
  //    celda a un bloque de Qcart por conveniencia, para que cuadre. Aquí no se inventa nada —
  //    la pieza está en el CATÁLOGO con su campaña, su objetivo, su touchpoint, su segmento y su
  //    quincena, que es exactamente la identidad de una celda. Lo único que le falta es el envío
  //    de email, y «su email todavía no está cargado» no es «esta pieza no existe».
  //    EL CASO: `004-P020` (Mundial · E-P2 · Modern Cooking) se dio de alta porque el doc de
  //    links declara ese bloque con 3 shortlinks y **49 carritos** que hasta hoy se reportaban
  //    dentro de E-P2 · Bebidas. Sin esto, corregir la atribución los volvía invisibles: pasarían
  //    de estar mal contados a no estar. Y la celda se marca, para que se distinga de una con envío.
  if (!elegida && qCat && t(dl.campana) && t(dl.touchpoint) && t(dl.segmento) && /^s/i.test(t(p['Tiene_Qcart']))) {
    elegida = qCat;
    lanzamiento[pid] = null;                    // se reconstruye abajo con la marca
    var mmN = /^(\d{4})-(\d{2})-Q[12]$/.exec(elegida);
    lanzamiento[pid] = {
      fecha: '', quincena: elegida, quincena_envio: elegida,
      mes: mmN ? MES_ES[parseInt(mmN[2], 10) - 1] : '',
      activacion: fAct || null, sin_envio_cargado: true,
      quincena_via: 'el catálogo: la pieza declara su identidad completa y tiene Qcart, pero su envío de email aún no está cargado',
      dims: dl
    };
    anclaPorCatalogo.push(pid + ' · ' + dl.touchpoint + ' · ' + dl.segmento + ' → ' + elegida + '  (celda NUEVA, sin envío cargado)');
    return;
  }
  if (!elegida) return;                         // no hay celda → se queda sin ancla, y se declara
  var mm = /^(\d{4})-(\d{2})-Q[12]$/.exec(elegida);
  lanzamiento[pid] = {
    fecha: '', quincena: elegida, quincena_envio: elegida,
    mes: mm ? MES_ES[parseInt(mm[2], 10) - 1] : '',
    activacion: fAct || null,
    quincena_via: 'el catálogo: la pieza no tiene envío cargado y su celda (' + elegida + ') ya existía',
    dims: dl
  };
  anclaPorCatalogo.push(pid + ' · ' + dl.touchpoint + ' · ' + dl.segmento + ' → ' + elegida);
});

var anclados = 0, sinAncla = [], anclaCaida = [];
Object.keys(qcartPieza).forEach(function (pid) {
  var q = qcartPieza[pid], lan = lanzamiento[pid];
  q.mes = lan ? lan.mes : '';
  if (!lan) {
    // 🔴 hay Qcart de esta pieza y NO hay ningún envío Principal de ESA pieza. No se inventa una
    //    quincena: se declara. Anclarlo «a la primera» sería atribuir por conveniencia.
    sinAncla.push(q.pieza_id);
    return;
  }
  // 🔴 EL ANCLA SE PEGA A LA CELDA DE LA PIEZA (touchpoint × segmento × quincena). NUNCA FABRICA UNA.
  var kAncla = [lan.dims.campana, lan.dims.objetivo, lan.dims.touchpoint, lan.dims.segmento, lan.quincena].join('¦');
  var qAncla = lan.quincena, anclaVia = lan.quincena_via;
  // 🔴 EL ANCLA NO PUEDE CAER EN LA CELDA DEL FUP (4-sep-2026). Rick: «únicamente envío
  //    principal, NUNCA FUPS». Bastaba con que la celda EXISTIERA, y existir no es lo mismo que
  //    ser la del Principal: en Hotcakes el Principal salió el 13-may (Q1) y su FollowUp el
  //    23-may (Q2), así que había una celda Q2 hecha solo de FUP. Como la activación del link es
  //    del 20-may (Q2), los carritos del Principal aterrizaban ahí — en una fila con 0 sends de
  //    Principal y los 9,701 del FUP. Tres piezas de Hotcakes (46 · 41 · 78 carritos) quedaban
  //    partidas en dos filas, y **la suma no cambiaba**: por eso ninguna puerta lo veía.
  //    ⚠ La condición solo aplica a piezas que TIENEN envío de email. Una pieza cuyo Qcart vive
  //      sin Principal cargado —WhatsApp de Mundial, o `004-P020`— seguiría sin ancla si le
  //      exigiéramos sends que no existen.
  var celdaAncla = rejilla[kAncla];
  var piezaTieneEnvio = !!(lan.fecha || lan.quincena_envio);
  var sirve = celdaAncla && (!piezaTieneEnvio || celdaAncla.principal.sends > 0);
  if (celdaAncla && !sirve) {
    anclaVia = 'quincena del envío (' + lan.quincena_envio + '): la celda de ' + lan.quincena +
      ' es solo de FollowUp (0 sends de Principal) y el Qcart no se ancla a un FUP';
    anclaCaida.push(q.pieza_id + ' · ' + q.mes + ' → ' + lan.quincena_envio +
      ' (la celda de ' + lan.quincena + ' era solo del FUP)');
    qAncla = lan.quincena_envio;
  }
  if (!sirve && !celdaAncla) {
    qAncla = lan.quincena_envio;
    // 🔴 solo es un ancla CAÍDA si de verdad cambió de quincena. Cuando las dos son la misma
    //    —el caso de una pieza que estrena celda— el aviso decía «→ 2026-06-Q2 (activación decía
    //    2026-06-Q2)», que no informa de nada. Un aviso que se contradice a sí mismo enseña a
    //    ignorar los avisos, y hoy costó medio semestre de Qcart aprender eso.
    if (qAncla !== lan.quincena) {
      anclaVia = 'quincena del envío (' + qAncla + '): la de la activación (' + lan.quincena + ') no tiene celda con envíos';
      anclaCaida.push(q.pieza_id + ' · ' + q.mes + ' → ' + qAncla + ' (activación decía ' + lan.quincena + ')');
    }
  }
  var c = celda(Object.assign({}, lan.dims, { quincena: qAncla, mes: q.mes }), true);
  c.mes = c.mes || q.mes;
  var recetaTop = Object.keys(q.recetas).sort(function (a, b) { return q.recetas[b] - q.recetas[a]; })[0] || null;
  // clicks de email de la celda ancla: los ratios Views/Clicks y Carritos/Clicks se miden
  // contra el email que llevo a Qcart, que es el de ESA celda.
  var clicksCelda = c.principal.clicks + c.fup.clicks;
  // 🔴 SI LA CELDA YA TIENE QCART, SE SUMA — NO SE PISA. Esta línea decía `c.qcart = {…}` y
  //    **borraba** el Qcart de la pieza anterior cuando dos piezas se anclaban a la misma celda.
  //    Se perdían 164 carritos de 4 piezas (001-P001, 002-P002/P003/P004): el motor declaraba
  //    «qcart 2,645 vs bloque 2,645 ✔» porque contaba lo ANCLADO, y la rejilla solo sumaba 2,481.
  //    Un dato que se pisa no deja hueco visible: la celda ganadora se ve perfecta.
  //    Que dos piezas compartan celda es normal —Principal y FUP del mismo touchpoint— y sumar es
  //    lo correcto; lo que no se puede es que una desaparezca en silencio.
  var yaHabia = c.qcart;
  var nuevoQ = {
    carritos: q.carritos, views: q.views, productos: q.productos, views_productos: q.views_productos,
    importe_total: q.importe_total, importe_nestle: q.importe_nestle,
    penetracion: tasa(q.importe_nestle, q.importe_total),
    penetracion_es_piso: true,
    ticket_carrito: tasa(q.importe_total, q.views),
    ticket_producto: tasa(q.importe_nestle, q.views_productos),
    receta_representativa: recetaTop,
    desde: q.desde, hasta: q.hasta,
    carritos_walmart: q.tiendas['walmart'] || 0,
    carritos_chedraui: q.tiendas['chedraui'] || 0,
    carritos_combinado: q.tiendas['combinado'] || 0,
    carritos_sin_tienda: q.tiendas['(sin tienda)'] || 0,
    // 🔴 ESTOS TRES SON MULTIPLICADORES, NO PORCENTAJES. El shortlink de Qcart es unico por
    //    canal: no hay trafico externo. Por eso un ratio >1 no es «amplificacion», es dato
    //    inflado en la fuente — y vale como bandera de calidad, no como resultado.
    views_vs_clicks: tasa(q.views, clicksCelda),
    carritos_vs_clicks: tasa(q.carritos, clicksCelda),
    /* 🔴 LAS DOS PATAS DE LA TASA, EN LA MISMA UNIDAD (24-sep-2026).
     *    Dividía `q.productos` —el número de FILAS del export de productos— entre `q.carritos`.
     *    Mientras carritos también contaba filas la tasa era consistente aunque ambas estuvieran
     *    mal; al corregir carritos a VISTAS se volvió filas ÷ vistas, que no significa nada.
     *    `views_productos` ya suma las vistas de producto y es el que alimenta
     *    `Views_Productos_Nestle`, que cuadra exacto con Qcart (197 = 197). Esa es la pata buena.
     *    `q.productos` se queda como diagnóstico interno del bloque: NO se publica. */
    productos_a_carritos: tasa(q.views_productos, q.carritos),
    ratios_son_multiplicadores: true,
    mes_completo: q.mes,
    activacion_link: lan.activacion || null,
    ancla_via: anclaVia,
    nota: 'el Qcart es MENSUAL: este bloque es el mes entero de ' + q.mes + ', anclado a la quincena de lanzamiento'
  };
  if (!yaHabia) {
    c.qcart = nuevoQ;
  } else {
    // se SUMAN los conteos y los importes; las tasas se recalculan sobre el total sumado
    ['carritos', 'views', 'productos', 'views_productos', 'importe_total', 'importe_nestle',
     'carritos_walmart', 'carritos_chedraui', 'carritos_combinado', 'carritos_sin_tienda'].forEach(function (k) {
      yaHabia[k] = (Number(yaHabia[k]) || 0) + (Number(nuevoQ[k]) || 0);
    });
    yaHabia.penetracion = tasa(yaHabia.importe_nestle, yaHabia.importe_total);
    yaHabia.ticket_carrito = tasa(yaHabia.importe_total, yaHabia.views);
    yaHabia.ticket_producto = tasa(yaHabia.importe_nestle, yaHabia.views_productos);
    yaHabia.views_vs_clicks = tasa(yaHabia.views, clicksCelda);
    yaHabia.carritos_vs_clicks = tasa(yaHabia.carritos, clicksCelda);
    yaHabia.productos_a_carritos = tasa(yaHabia.productos, yaHabia.carritos);
    if (nuevoQ.desde && (!yaHabia.desde || nuevoQ.desde < yaHabia.desde)) yaHabia.desde = nuevoQ.desde;
    if (nuevoQ.hasta && (!yaHabia.hasta || nuevoQ.hasta > yaHabia.hasta)) yaHabia.hasta = nuevoQ.hasta;
    // se DECLARA que esta celda agrega el Qcart de varias piezas: sin esto, la suma es
    // indistinguible de un dato de una sola pieza y nadie podría auditarla.
    yaHabia.piezas_sumadas = (yaHabia.piezas_sumadas || [q.pieza_id]).concat([q.pieza_id])
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    yaHabia.nota = 'Qcart de ' + yaHabia.piezas_sumadas.length + ' pieza(s) anclada(s) a esta celda: ' +
      yaHabia.piezas_sumadas.join(' + ');
  }
  c.qcart_ancla = qAncla;
  anclados++;
  // 🔴 F1 · la remisión va a las otras quincenas de la MISMA PIEZA (mismo touchpoint × segmento),
  //    no de toda la campaña. Antes iba a toda la campaña×mes, y por eso el Qcart de un segmento
  //    aparecía como remisión en las filas de OTROS segmentos, borrando su identidad. Una pieza
  //    que se envió en dos quincenas ve su Qcart en una y «— ver Qx» en la otra; una pieza
  //    distinta de la misma campaña ya no la toca.
  Object.keys(rejilla).forEach(function (kk) {
    var cc = rejilla[kk];
    if (cc.campana === lan.dims.campana && cc.touchpoint === lan.dims.touchpoint &&
      cc.segmento === lan.dims.segmento && cc.quincena !== qAncla && !cc.qcart) {
      cc.qcart_ancla = qAncla;
      cc.qcart_remision = '— ver ' + qAncla;
    }
  });
});

// las tasas de cada celda
Object.keys(rejilla).forEach(function (k) {
  var c = rejilla[k];
  [c.principal, c.fup].forEach(function (b) {
    b.delivery_rate = tasa(b.deliveries, b.sends);
    b.open_rate = tasa(b.opens, b.deliveries);
    b.click_rate = tasa(b.clicks, b.deliveries);
    b.ctor = tasa(b.clicks, b.opens);
    b.bounce_rate = tasa(b.bounces, b.sends);
    // 🔴 LAS DOS LECTURAS DE LA BAJA, y son distintas a propósito:
    //      · sobre ENVÍOS (`unsub_rate`) → qué proporción de la base se fue. Salud de la lista.
    //      · sobre OPENS  (`utor`)       → de los que ABRIERON, cuántos se fueron. Salud del
    //        contenido: una tasa sobre envíos baja puede esconder un UTOR alto si casi nadie abre.
    //    Rick pidió las dos, y el denominador es el que él dijo: «versus los sends y versus los
    //    opens». Ojo: las otras tasas de la hoja van sobre DELIVERIES, no sobre sends — no es
    //    incoherencia, es que él pidió sends y sends es lo que se escribe. El nombre de la
    //    columna lo dice para que nadie tenga que adivinarlo.
    b.unsub_rate = tasa(b.unsubs, b.sends);
    b.utor = tasa(b.unsubs, b.opens);
  });
  c.total = {
    sends: c.principal.sends + c.fup.sends,
    deliveries: c.principal.deliveries + c.fup.deliveries,
    opens: c.principal.opens + c.fup.opens,
    clicks: c.principal.clicks + c.fup.clicks,
    bounces: c.principal.bounces + c.fup.bounces,
    unsubs: c.principal.unsubs + c.fup.unsubs,
    unsubs_tot: c.principal.unsubs_tot + c.fup.unsubs_tot
  };
  c.total.delivery_rate = tasa(c.total.deliveries, c.total.sends);
  c.total.open_rate = tasa(c.total.opens, c.total.deliveries);
  c.total.click_rate = tasa(c.total.clicks, c.total.deliveries);
  c.total.ctor = tasa(c.total.clicks, c.total.opens);
  c.total.unsub_rate = tasa(c.total.unsubs, c.total.sends);
  c.total.utor = tasa(c.total.unsubs, c.total.opens);
  // 🔴 LA IDENTIDAD SE VERIFICA, NO SE SUPONE. `c.unsubs_unicos` se acumula por su lado desde
  //    hace semanas y ahora también se acumula por bloque; si las dos cuentas no dan lo mismo,
  //    una de las dos está mal y el reporte enseñaría la que le toque. Se declara en vez de
  //    confiar: es exactamente el caso del bloque que se auditaba contra sí mismo.
  if (c.unsubs_unicos !== c.total.unsubs) {
    avisos.push('🔴 las bajas no cuadran en ' + c.campana + ' · ' + c.touchpoint + ' · ' + c.segmento +
      ' · ' + c.quincena + ': por celda ' + c.unsubs_unicos + ' ≠ Principal(' + c.principal.unsubs +
      ') + FUP(' + c.fup.unsubs + ') = ' + c.total.unsubs);
  }
  c.whatsapp.delivery_rate = tasa(c.whatsapp.deliveries, c.whatsapp.sends);
  c.whatsapp.read_rate = tasa(c.whatsapp.read, c.whatsapp.deliveries);
  c.whatsapp.ctor = c.whatsapp.clicks_medidos ? tasa(c.whatsapp.clicks, c.whatsapp.read) : null;
});

var celdas = Object.keys(rejilla).map(function (k) { return rejilla[k]; })
  .sort(function (a, b) { return (a.campana + a.quincena).localeCompare(b.campana + b.quincena); });
console.log('\n  ── la rejilla del Resumen');
console.log('     celdas (campaña × quincena): ' + celdas.length);
var campanas = {}; celdas.forEach(function (c) { campanas[c.campana] = (campanas[c.campana] || 0) + 1; });
var delCat = {}; celdas.forEach(function (c) { if (c.campana_del_catalogo) delCat[c.campana] = 1; });
Object.keys(campanas).sort().forEach(function (k) {
  console.log('       ' + (delCat[k] ? '  ' : '🔴') + ' ' + k.slice(0, 26).padEnd(28) + campanas[k] + ' quincena(s)' +
    (delCat[k] ? '' : '   sin resolver: crudo de envios sin pieza'));
});
var sinResolver = celdas.filter(function (c) { return !c.campana_del_catalogo; });
if (sinResolver.length) avisos.push('🔴 ' + sinResolver.length + ' celda(s) con campania SIN RESOLVER (' +
  Object.keys(campanas).filter(function (k) { return !delCat[k]; }).join(' · ') +
  '): son envios sin pieza. El reporte tiene que mostrarlas aparte, no mezcladas con las atribuidas.');
console.log('     con Qcart anclado: ' + anclados + ' · con remisión «— ver Qx»: ' +
  celdas.filter(function (c) { return c.qcart_remision; }).length);
// 🔴 lo que el motor decide, el motor lo DECLARA: si el ancla cayó a la quincena del envío
//    porque la de la activación no tenía celda, se dice — no se resuelve en silencio.
// 🔴 F2 · lo que se ancló POR CATÁLOGO se declara aparte: es una atribución que no salió de un
//    envío cargado, y quien lea el reporte tiene que poder distinguirla de las demás.
if (anclaPorCatalogo.length) {
  console.log('     ✔ ' + anclaPorCatalogo.length + ' pieza(s) ancladas por el CATÁLOGO (sin envío cargado, celda ya existente):');
  anclaPorCatalogo.forEach(function (x) { console.log('        ' + x); });
  avisos.push('⚠ ' + anclaPorCatalogo.length + ' bloque(s) de Qcart anclados por el CATÁLOGO: la pieza no tiene envío en el bloque de email, ' +
    'pero declara su campaña · touchpoint · segmento y su celda ya existía · ' + anclaPorCatalogo.join(' · '));
}
if (anclaCaida.length) {
  console.log('     ⚠ ' + anclaCaida.length + ' ancla(s) caída(s) a la quincena del envío:');
  anclaCaida.forEach(function (x) { console.log('        ' + x); });
  avisos.push('⚠ ' + anclaCaida.length + ' bloque(s) de Qcart anclados a la quincena del ENVÍO porque la de la activación del link no tiene celda con envíos · ' + anclaCaida.join(' · '));
}
if (sinAncla.length) {
  avisos.push('🔴 ' + sinAncla.length + ' bloque(s) de Qcart sin envío Principal ese mes: no se pueden anclar · ' + sinAncla.join(' · '));
  console.log('     🔴 Qcart sin dónde anclarse: ' + sinAncla.join(' · '));
}

// ══ 4 · EL CUADRE — que la rejilla no invente ni pierda ═════════════════════════════
var sumaRejilla = celdas.reduce(function (a, c) { return a + c.total.sends; }, 0);
var sumaBloque = B.email.envios.reduce(function (a, e) { return a + (num(e.email_sends) || 0); }, 0);
var sumaWaRejilla = celdas.reduce(function (a, c) { return a + c.whatsapp.sends; }, 0);
var sumaWaBloque = B.whatsapp.envios.reduce(function (a, e) { return a + (num(e.sends) || 0); }, 0);
var sumaQcRejilla = celdas.reduce(function (a, c) { return a + (c.qcart ? c.qcart.carritos : 0); }, 0);
console.log('\n  ── el cuadre (la rejilla no puede inventar ni perder)');
console.log('     email    rejilla ' + mil(sumaRejilla) + '  vs bloque ' + mil(sumaBloque) + '   ' + (sumaRejilla === sumaBloque ? '✔' : '🔴 faltan ' + mil(sumaBloque - sumaRejilla)));
console.log('     whatsapp rejilla ' + mil(sumaWaRejilla) + '  vs bloque ' + mil(sumaWaBloque) + '   ' + (sumaWaRejilla === sumaWaBloque ? '✔' : '🔴'));
// 🔴 VISTAS CONTRA VISTAS (29-sep-2026). Esta línea comparaba la suma de la rejilla —que está en
//    VISTAS— contra `carritos.length`, que son FILAS del bloque. Con 8,176 vistas en 3,149 filas
//    anunciaba «⚠ -5,027 sin anclar»: un número que no significa nada, porque las dos patas no son
//    la misma unidad. Y sonaba a hallazgo grave, que es lo peor de un aviso falso — enseña a
//    ignorar los avisos de verdad.
//    Se le escapó a U4 del guardián de unidades por una exclusión MÍA: descartaba las líneas con
//    `console.log` suponiendo que un `.length` que solo se imprime es un conteo de filas legítimo.
//    Esta lo imprime Y lo compara. La exclusión ya está corregida allá.
var qcBloqueVistas = (B.qcart.carritos || []).reduce(function (a, e) { return a + (Number(e.views) || 0); }, 0);
console.log('     qcart    rejilla ' + mil(sumaQcRejilla) + '  vs bloque ' + mil(qcBloqueVistas) +
  '   ' + (sumaQcRejilla === qcBloqueVistas ? '✔' : '⚠ ' + mil(qcBloqueVistas - sumaQcRejilla) + ' sin anclar') +
  '   (' + mil((B.qcart.carritos || []).length) + ' filas)');

var out = {
  paso: 'motor-calculo · motor de cálculo', generado_por: 'motor.motor.js',
  no_hace: 'no abre el Excel · no decide como se ve nada · no escribe ninguna hoja',
  reglas: {
    tasa_sobre_cero: 'una tasa sin denominador es null, NUNCA 0: un 0 entra a los promedios y arrastra el reporte',
    ctor_whatsapp: 'donde clicks_medidos = No, el CTOR es null: calcularlo devolveria el supuesto disfrazado de medicion',
    penetracion: 'es un PISO, no una medicion: el doc de productos solo itemiza ~8% del carrito',
    anclaje_qcart: 'el Qcart es MENSUAL y el email QUINCENAL. El mes entero se ancla a la quincena del primer envio Principal y aparece UNA vez; las demas quincenas llevan la remision',
    qcart_sin_ancla: 'si hay Qcart y ningun envio Principal ese mes, NO se ancla: se declara'
  },
  por_registro: porRegistro,
  por_pieza: porPieza,
  rejilla: celdas,
  auditoria: {
    registros_email: porRegistro.email.length, registros_whatsapp: porRegistro.whatsapp.length,
    piezas_con_datos: conDatos, piezas_sin_catalogo: sinCatalogo.length,
    celdas: celdas.length, qcart_anclados: anclados, qcart_sin_ancla: sinAncla.length,
    cuadre_email: sumaRejilla === sumaBloque, cuadre_whatsapp: sumaWaRejilla === sumaWaBloque,
    sends_email: sumaRejilla, sends_whatsapp: sumaWaRejilla
  },
  avisos: avisos,
  // el contrato con los validadores: aqui esta TODO lo que no llego a una celda, con su motivo.
  // Σ rejilla + Σ fuera_de_la_rejilla tiene que dar Σ bloque, por medio. Si no, se perdio algo.
  fuera_de_la_rejilla: fueraDeLaRejilla,
  para_el_siguiente: {
    que_es: 'la rejilla neutra: una celda por campaña × quincena, con Principal, FUP, Total, WhatsApp y Qcart',
    ojo: 'las tasas pueden ser null y eso es informacion: significa que la pregunta no se puede responder, no que valga cero',
    ojo_qcart: 'una celda con qcart_remision NO tiene Qcart propio: su Qcart esta en la quincena que dice la remision'
  }
};
try { fs.mkdirSync(BACK + '/_rejilla'); } catch (e) { }
fs.writeFileSync(BACK + '/_rejilla/rejilla.json', JSON.stringify(out, null, 1));
if (avisos.length) {
  console.log('\n  ── avisos (viajan al reporte)');
  avisos.slice(0, 8).forEach(function (a) { console.log('     ' + a); });
  if (avisos.length > 8) console.log('     … y ' + (avisos.length - 8) + ' más (todos en el JSON)');
}
console.log('\n  → ' + BACK + '/_rejilla/rejilla.json');
console.log('  ⚠ el Excel NO se tocó.');
