// Arma los dos archivos que pide fuentes-email.refrescar-volcado.js para dar de alta J-10.
//
// 🔴 EL FRESCO DE PIEZAS ES «EL VIGENTE + J-10», NO UN VOLCADO NUEVO COMPLETO. Es lo que pidió
//    Rick: «solo suma lo nuevo, no rompas nada de lo ya atribuido». Un volcado completo traeria
//    ademas la maduracion de las otras 107 piezas — legitimo, pero es OTRA cosa y hay que decidirla
//    aparte. Se declara en `mixto` para que nadie lea este archivo como una foto completa del dia.
//
// 🔴 LAS 4 FILAS DEL DETALLE VAN ENTERAS, pruebas incluidas. El criterio de «job de prueba» vive en
//    UN solo lugar (lib-fechas-envio, umbral <10 envios) y lo aplica el sistema al calcular: si yo
//    filtrara aqui, habria dos criterios y la fecha diria una cosa mientras las metricas cuentan
//    otra. Tres de estos jobs son de 1 envio (`[Test J10]`) y el real es el 1316469 del 26-sep con
//    39,735.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var INS = BACK + '/_insumos';
var HOY = '2026-09-29';

var PIEZA_J10 = {
  ConfigKey: 'TMP-MAGGI-J10',
  PiezaID: '*por definir',
  Codigo_NC: 'NC006537',
  Journey_Name: ' O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10_CN_EM_A_V1_089420',
  Journey_UUID: 'BCCF795E-DC6A-4399-81D2-B1CAF59336FC',
  BU: 'RN',
  Marca: 'Maggi',
  Campana: 'Liga MX',
  Touchpoint: 'E-J10',
  Segmento: '*por definir',
  Fecha_Primer_Envio: '9/24/2026 12:00:00 AM',
  Fecha_Ultimo_Envio: '9/26/2026 12:00:00 AM',
  N_Jobs: '4',
  Dias_Con_Envio: '3',
  Email_Sends: '39738',
  Email_Deliveries: '39358',
  Email_Bounces: '380',
  Email_Unique_Opens: '16009',
  Email_Unique_Clicks: '102',
  Email_Unique_Unsubs: '29',
  Delivery_Rate: '99.04',
  Open_Rate: '40.68',
  Click_Rate: '0.26',
  CTOR: '0.64',
  Bounce_Rate: '0.96',
  LastRefresh: '9/29/2026 4:09:11 PM',
  Email_ID: '86203',
  Email_Subject: 'Tu alineación para hoy: fútbol + algo deli',
  Es_FUP: 'No',
  Journey_ID_Datorama: '30794109',
  Piezas_Mismo_Asset: '1',
  Email_Total_Unsubs: '30',
  EmailName: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J10_AQ_EM_A_NA_30794109'
};

var base = {
  ConfigKey: 'TMP-MAGGI-J10', Campana: 'Liga MX', Touchpoint: 'E-J10', Segmento: '*por definir',
  EmailName: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J10_AQ_EM_A_NA_30794109'
};
function det(rowKey, jobId, dia, subject, s, d, o, c, b, u) {
  return Object.assign({}, base, {
    RowKey: rowKey, JobID: jobId, SendDay: dia, Send_Date: dia, Email_Subject: subject,
    Email_Sends: String(s), Email_Deliveries: String(d), Email_Unique_Opens: String(o),
    Email_Unique_Clicks: String(c), Email_Bounces: String(b), Email_Unique_Unsubs: String(u)
  });
}
var DETALLE_J10 = [
  det('1315709_20260924', '1315709', '9/24/2026 12:00:00 AM', '[Test J10]: Tu alineación para hoy: fútbol + algo deli', 1, 1, 1, 0, 0, 0),
  det('1315711_20260924', '1315711', '9/24/2026 12:00:00 AM', '[Test J10]: Tu alineación para hoy: fútbol + algo deli', 1, 1, 1, 0, 0, 0),
  det('1316453_20260925', '1316453', '9/25/2026 12:00:00 AM', '[Test J10 v2]: Tu alineación para hoy: fútbol + algo deli', 1, 1, 1, 0, 0, 0),
  det('1316469_20260926', '1316469', '9/26/2026 12:00:00 AM', 'Tu alineación para hoy: fútbol + algo deli', 39735, 39355, 16006, 102, 380, 29)
];

// ── el fresco de piezas: el vigente + J-10
var vig = fs.readdirSync(INS).filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort().reverse()[0];
var V = JSON.parse(fs.readFileSync(INS + '/' + vig, 'utf8'));
var yaEsta = (V.rows || []).some(function (r) { return String(r.ConfigKey).trim() === 'TMP-MAGGI-J10'; });
if (yaEsta) { console.log('🔴 J-10 YA está en ' + vig + ' — no lo duplico'); process.exit(1); }

var FRESCO = {
  name: V.name, count: (V.rows || []).length + 1, retrieved: (V.rows || []).length + 1,
  fields: V.fields, truncated: false,
  mixto: 'volcado ' + vig + ' + la pieza TMP-MAGGI-J10 traída del MCP el ' + HOY +
    '. 🔴 NO es un volcado completo del día: las otras ' + (V.rows || []).length +
    ' piezas conservan sus cifras del volcado anterior. Se armó así a pedido de Rick — «solo suma lo nuevo, no rompas nada de lo ya atribuido»— y por eso un refresco completo posterior PUEDE subirlas por maduración.',
  rows: (V.rows || []).concat([PIEZA_J10])
};
var fP = BACK + '/_tmp/j10-piezas-fresco.json';
fs.writeFileSync(fP, JSON.stringify(FRESCO, null, 1));

var DET = {
  name: 'CRM_Email_Detalle', count: DETALLE_J10.length, retrieved: DETALLE_J10.length,
  fields: Object.keys(DETALLE_J10[3]), truncated: false,
  mixto: 'las 4 filas de TMP-MAGGI-J10 traídas del MCP el ' + HOY + ' — incremento, no volcado completo. Las pruebas van incluidas a propósito: el criterio de «job de prueba» lo aplica el sistema, no este archivo.',
  rows: DETALLE_J10
};
var fD = BACK + '/_tmp/j10-detalle-nuevas.json';
fs.writeFileSync(fD, JSON.stringify(DET, null, 1));

// releer del disco y comprobar
var vp = JSON.parse(fs.readFileSync(fP, 'utf8')), vd = JSON.parse(fs.readFileSync(fD, 'utf8'));
var sumDet = vd.rows.reduce(function (a, r) { return a + Number(r.Email_Sends); }, 0);
console.log('  vigente: ' + vig + '   ' + (V.rows || []).length + ' piezas');
console.log('  fresco:  ' + path.basename(fP) + '   ' + vp.rows.length + ' piezas   (+1)');
console.log('  detalle: ' + path.basename(fD) + '   ' + vd.rows.length + ' filas   Σ sends ' + sumDet);
console.log('  la agregada dice ' + PIEZA_J10.Email_Sends + '   ·   ' +
  (sumDet === Number(PIEZA_J10.Email_Sends) ? '✔ el detalle CUADRA exacto con la agregada' : '🔴 NO CUADRAN'));
console.log('  envío real: job 1316469 del 26-sep con 39,735   ·   3 jobs de prueba de 1 envío');
