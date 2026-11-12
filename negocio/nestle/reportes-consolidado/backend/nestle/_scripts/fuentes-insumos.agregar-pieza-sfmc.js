/*
 * fuentes-insumos.agregar-pieza-sfmc.js — añade UNA pieza nueva a los volcados de SFMC.
 *
 * POR QUÉ EXISTE, y por qué no es «refrescar los insumos»:
 *   Rick, 9-sep-2026: «no debes de descuadrar ningún número que ya se haya calculado antes».
 *   Un refresh completo de la DE mueve las métricas de TODAS las piezas —opens y clicks siguen
 *   acumulando días después del envío—, y hoy la única pieza nueva es la Jornada 7. Traer la DE
 *   entera para incorporar una pieza cambiaría 104 filas para arreglar 1.
 *   Así que el volcado nuevo = el volcado vigente + las filas de esa pieza, y queda DECLARADO
 *   que es un volcado mixto: nadie tiene que deducirlo del contenido.
 *
 * 🔴 SE ESCRIBEN LOS DOS VOLCADOS O NINGUNO. `lib-fechas-envio` comprueba que el detalle cuadre
 *    EXACTO con la agregada en las 7 métricas; meter la pieza solo en la agregada haría fallar
 *    esa comprobación — con razón.
 * 🔴 Y SE NIEGA SI LA PIEZA YA ESTÁ. Duplicar una fila en el volcado duplicaría sus envíos.
 *
 * 🔴 UNA PIEZA NUEVA NO CLONA ESTE SCRIPT (14-sep-2026). La Jornada 8 llegó y lo obvio era copiar
 *    el archivo y cambiarle los números: eso es arreglar al HEREDERO. Se arregló al CREADOR — el
 *    registro de abajo tiene una entrada por pieza y se elige con `--pieza <ConfigKey>`. Las
 *    entradas viejas se quedan: son el registro de qué se cargó y con qué cifras.
 *
 *   node fuentes-insumos.agregar-pieza-sfmc.js --pieza TMP-MAGGI-J8 [--escribir]
 */
var fs = require('fs');
var os = require('os');
var INS = require('path').resolve(__dirname, '..') + '/_insumos';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var iP = process.argv.indexOf('--pieza');
var PEDIDA = iP >= 0 ? String(process.argv[iP + 1] || '').trim() : '';

// ════════ EL REGISTRO — una entrada por pieza cargada, tal como la devolvió el MCP (R14: solo lectura)

var REGISTRO = {};

// ── Jornada 7 · cargada el 9-sep-2026 ──────────────────────────────────────────────
REGISTRO['TMP-MAGGI-J7-B-C'] = function () {
  var CK = 'TMP-MAGGI-J7-B-C';
  var NOMBRE = 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270';
  var JOURNEY = 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7_AQ_EM_A_NA_0359270';
  var UUID = 'A18B1A8E-7B3B-4F83-8843-AB064A0D7E36';
  var REFRESH = '9/9/2026 5:58:03 PM';

  var PIEZA = {
    ConfigKey: CK, PiezaID: '*por definir', Codigo_NC: 'NC006537', Journey_Name: JOURNEY,
    Journey_UUID: UUID, BU: 'RN', Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J7',
    Segmento: '*por definir', Fecha_Primer_Envio: '9/4/2026 12:00:00 AM',
    Fecha_Ultimo_Envio: '9/4/2026 12:00:00 AM', N_Jobs: '5', Dias_Con_Envio: '1',
    Email_Sends: '91584', Email_Deliveries: '91123', Email_Bounces: '461',
    Email_Unique_Opens: '36733', Email_Unique_Clicks: '290', Email_Unique_Unsubs: '83',
    Delivery_Rate: '99.50', Open_Rate: '40.31', Click_Rate: '0.32', CTOR: '0.79', Bounce_Rate: '0.50',
    LastRefresh: REFRESH, Email_ID: '85487', Email_Subject: 'Prepárate esta delicia jugocita',
    Es_FUP: 'No', Journey_ID_Datorama: '0359270', Piezas_Mismo_Asset: '1',
    Email_Total_Unsubs: '86', EmailName: NOMBRE
  };

  // 🔴 LOS CINCO JOBS, con los CUATRO de prueba incluidos. No se filtran aquí: el criterio de
  //    «prueba» vive en UN solo lugar (`lib-fechas-envio`, umbral <10 envíos) y lo usan la fecha
  //    Y la resta. Recortarlos en el volcado sería un segundo criterio, y dos criterios es cómo la
  //    fecha diría una cosa mientras las métricas cuentan otra.
  function job(id, sends, deliv, bounces, bsoft, uo, to, uc, tc, uu, tu, subject, dr, or_, cr, ctor, br, jn, uuid) {
    return {
      RowKey: id + '_20260904', JobID: id, SendDay: '9/4/2026 12:00:00 AM', ConfigKey: CK,
      BU: 'RN', Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J7', Segmento: '*por definir',
      Email_Subject: subject, Email_Sender_Name: 'Recetas Nestlé', Send_Date: '9/4/2026 12:00:00 AM',
      Journey_Name: jn, Journey_UUID: uuid,
      Journey_ID_Datorama: '0359270', Codigo_NC: 'NC006537',
      Email_Sends: sends, Email_Deliveries: deliv, Email_Bounces: bounces, Email_Bounces_Soft: bsoft,
      Email_Unique_Opens: uo, Email_Total_Opens: to, Email_Unique_Clicks: uc, Email_Total_Clicks: tc,
      Email_Unique_Unsubs: uu, Delivery_Rate: dr, Open_Rate: or_, Click_Rate: cr, CTOR: ctor,
      Bounce_Rate: br, LastRefresh: '9/9/2026 5:52:08 PM', Email_ID: '85487', Es_FUP: 'No',
      Email_Total_Unsubs: tu, EmailName: NOMBRE
    };
  }
  var T = '[Test La Liga E-J7]: Prepárate esta delicia jugocita';
  var DETALLE = [
    job('1300529', '1', '1', '0', '0', '1', '1', '0', '0', '0', '0', T, '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1300530', '1', '1', '0', '0', '1', '4', '0', '0', '0', '0', T, '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1300534', '1', '1', '0', '0', '1', '3', '0', '0', '0', '0', '[Test Mothers day]: Prepárate esta delicia jugocita', '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1300535', '1', '1', '0', '0', '1', '3', '0', '0', '0', '0', '[Test La Liga 2]: Prepárate esta delicia jugocita', '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1300537', '91580', '91119', '461', '445', '36729', '43785', '290', '576', '83', '86',
      'Prepárate esta delicia jugocita', '99.50', '40.31', '0.32', '0.79', '0.50', JOURNEY, UUID)
  ];
  return { ck: CK, pieza: PIEZA, detalle: DETALLE, hoy: '2026-09-09' };
};

// ── Jornada 8 · cargada el 14-sep-2026 ─────────────────────────────────────────────
//
// 🔴 EL `EmailName` DE J8 ES EL DE J7 CON UN SUFIJO. Operación reusó el asset y SFMC publica
//    `…LIGAMX-J7-B-C…_0359270 - 202609` para la Jornada 8, mientras el `Journey_Name` sí dice
//    `…LALIGA-J8-SAB…_069127`. Lo avisó Rick antes de que llegara el dato: «ese es el nombre real
//    del J8, se equivocaron». Se guarda TAL CUAL —el volcado es un espejo de la fuente, no se
//    corrige aquí—, y quien empareje contra el catálogo DEBE hacerlo EXACTO: por substring, los
//    38,171 envíos de J8 aterrizan en J7.
REGISTRO['TMP-MAGGI-J8'] = function () {
  var CK = 'TMP-MAGGI-J8';
  var NOMBRE = 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609';
  var JOURNEY = 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J8-SAB_CN_EM_A_V1_069127';
  var UUID = '469F11C2-BDDA-4487-B6A8-B3E1CB34347D';
  var REFRESH = '9/14/2026 6:45:02 PM';

  var PIEZA = {
    ConfigKey: CK, PiezaID: '*por definir', Codigo_NC: 'NC006537', Journey_Name: JOURNEY,
    Journey_UUID: UUID, BU: 'RN', Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J8',
    Segmento: '*por definir', Fecha_Primer_Envio: '9/11/2026 12:00:00 AM',
    Fecha_Ultimo_Envio: '9/12/2026 12:00:00 AM', N_Jobs: '4', Dias_Con_Envio: '2',
    Email_Sends: '38171', Email_Deliveries: '37884', Email_Bounces: '287',
    Email_Unique_Opens: '15194', Email_Unique_Clicks: '114', Email_Unique_Unsubs: '30',
    Delivery_Rate: '99.25', Open_Rate: '40.11', Click_Rate: '0.30', CTOR: '0.75', Bounce_Rate: '0.75',
    LastRefresh: REFRESH, Email_ID: '85752', Email_Subject: 'Un clásico delicioso en tu mesa',
    Es_FUP: 'No', Piezas_Mismo_Asset: '1',
    Email_Total_Unsubs: '32', EmailName: NOMBRE
  };

  // Los CUATRO jobs: 3 pruebas del 11-sep (1 envío cada una) y el envío real del 12-sep.
  // 🔴 La agregada dice `Fecha_Primer_Envio` = 11-sep por esas pruebas; el envío real arrancó el
  //    12. No se corrige aquí: lo corrige `lib-fechas-envio` leyendo este detalle día por día.
  function job(id, dia, sends, deliv, bounces, bsoft, uo, to, uc, tc, uu, tu, subject, dr, or_, cr, ctor, br, jn, uuid) {
    return {
      RowKey: id + '_2026' + dia.replace(/\//g, ''), JobID: id,
      SendDay: '9/' + dia.split('/')[1] + '/2026 12:00:00 AM', ConfigKey: CK,
      BU: 'RN', Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J8', Segmento: '*por definir',
      Email_Subject: subject, Email_Sender_Name: 'Recetas Nestlé',
      Send_Date: '9/' + dia.split('/')[1] + '/2026 12:00:00 AM',
      Journey_Name: jn, Journey_UUID: uuid, Codigo_NC: 'NC006537',
      Email_Sends: sends, Email_Deliveries: deliv, Email_Bounces: bounces, Email_Bounces_Soft: bsoft,
      Email_Unique_Opens: uo, Email_Total_Opens: to, Email_Unique_Clicks: uc, Email_Total_Clicks: tc,
      Email_Unique_Unsubs: uu, Delivery_Rate: dr, Open_Rate: or_, Click_Rate: cr, CTOR: ctor,
      Bounce_Rate: br, LastRefresh: '9/14/2026 6:36:11 PM', Email_ID: '85752', Es_FUP: 'No',
      Email_Total_Unsubs: tu, EmailName: NOMBRE
    };
  }
  var T = '[Test J8]: Un clásico delicioso en tu mesa';
  var DETALLE = [
    job('1306374', '09/11', '1', '1', '0', '0', '1', '1', '0', '0', '0', '0', T, '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1306378', '09/11', '1', '1', '0', '0', '1', '2', '0', '0', '0', '0', T, '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1306380', '09/11', '1', '1', '0', '0', '1', '8', '0', '0', '0', '0', T, '100.00', '100.00', '0.00', '0.00', '0.00'),
    job('1306387', '09/12', '38168', '37881', '287', '284', '15191', '17514', '114', '264', '30', '32',
      'Un clásico delicioso en tu mesa', '99.25', '40.10', '0.30', '0.75', '0.75', JOURNEY, UUID)
  ];
  return { ck: CK, pieza: PIEZA, detalle: DETALLE, hoy: '2026-09-14' };
};

// ════════ EL PROCEDIMIENTO — idéntico para toda pieza

console.log('════════ fuentes-insumos · AGREGAR UNA PIEZA A LOS VOLCADOS ════════\n');
if (!PEDIDA || !REGISTRO[PEDIDA]) {
  console.log('  🔴 falta `--pieza <ConfigKey>`. Declaradas: ' + Object.keys(REGISTRO).join(' · '));
  process.exit(1);
}
var D = REGISTRO[PEDIDA]();
var CK = D.ck, PIEZA = D.pieza, DETALLE = D.detalle, HOY = D.hoy;

// ── la comprobación que hace honesto el volcado mixto ───────────────────────────────
var sumaDet = DETALLE.reduce(function (s, r) { return s + Number(r.Email_Sends); }, 0);
console.log('  pieza: ' + CK + '   ·   ' + DETALLE.length + ' jobs');
console.log('  Σ detalle ' + sumaDet.toLocaleString('es-MX') + '   vs   agregada ' + Number(PIEZA.Email_Sends).toLocaleString('es-MX') +
  '   ' + (sumaDet === Number(PIEZA.Email_Sends) ? '✔ cuadran' : '🔴 NO CUADRAN — no se escribe'));
if (sumaDet !== Number(PIEZA.Email_Sends)) process.exit(1);
var pruebas = DETALLE.filter(function (r) { return Number(r.Email_Sends) < 10; });
console.log('  jobs de prueba (<10 envíos): ' + pruebas.length + '   ·   ' +
  pruebas.reduce(function (s, r) { return s + Number(r.Email_Sends); }, 0) + ' envíos que la cadena descontará');
console.log('  envío real: ' + Number(DETALLE[DETALLE.length - 1].Email_Sends).toLocaleString('es-MX') + '\n');

function vigente(pref) {
  var c = fs.readdirSync(INS).filter(function (f) { return new RegExp('^' + pref + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? c[c.length - 1] : null;
}

var TAREAS = [
  { pref: 'sfmc-piezas', nuevas: [PIEZA] },
  { pref: 'sfmc-detalle', nuevas: DETALLE }
];

var listo = [];
TAREAS.forEach(function (T2) {
  var base = vigente(T2.pref);
  if (!base) { console.log('  🔴 no hay volcado ' + T2.pref + '-*'); process.exit(1); }
  var d = JSON.parse(fs.readFileSync(INS + '/' + base, 'utf8'));
  var yaEsta = d.rows.filter(function (r) { return String(r.ConfigKey).trim() === CK; });
  console.log('  ' + T2.pref.padEnd(14) + 'base ' + base + '   ' + d.rows.length + ' filas   ' +
    (yaEsta.length ? '🔴 la pieza YA ESTÁ (' + yaEsta.length + ') — no se duplica' : '✔ la pieza no está'));
  if (yaEsta.length) process.exit(1);
  // 🔴 los campos del volcado base mandan: si la DE creció una columna, se declara, no se cuela.
  var faltan = Object.keys(T2.nuevas[0]).filter(function (k) { return d.fields.indexOf(k) < 0; });
  if (faltan.length) { console.log('     🔴 campos que el volcado base no tiene: ' + faltan.join(' · ')); process.exit(1); }
  d.rows = d.rows.concat(T2.nuevas);
  d.count = d.rows.length; d.retrieved = d.rows.length;
  d.mixto = 'volcado ' + base + ' + las filas de ' + CK + ' pedidas al MCP el ' + HOY +
    '. Las demás piezas conservan sus cifras del volcado base a propósito: refrescar todo movería métricas ya calculadas.';
  listo.push({ archivo: INS + '/' + T2.pref + '-' + HOY + '.txt', datos: d, filas: d.rows.length });
});

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
listo.forEach(function (x) {
  fs.writeFileSync(x.archivo, JSON.stringify(x.datos), 'utf8');
  var releido = JSON.parse(fs.readFileSync(x.archivo, 'utf8'));
  var hit = releido.rows.filter(function (r) { return String(r.ConfigKey).trim() === CK; }).length;
  console.log('  ✔ ' + x.archivo.split(/[\\/]/).pop().padEnd(30) + x.filas + ' filas   ·   releído: ' + hit + ' fila(s) de la pieza');
});
console.log('\n  ✅ VOLCADOS LISTOS. La cadena tomará estos por ser los más recientes.');
