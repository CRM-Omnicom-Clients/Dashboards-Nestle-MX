// orquestador.nb-email-sfmc.js — construir email.json desde la DE de SFMC (CRM_Email_Detalle).
//
// 🔴 SFMC MANDA. Esta es la fuente de verdad del email desde 20-ago-2026 — ya no Datorama.
//    La DE llega FILTRADA por el catálogo del cliente (CRM_Reporte_Config): solo trae las piezas
//    activas, con sus dimensiones ya puestas. `ConfigKey` ES el `Pieza_ID` (001-P003), así que el
//    cruce es directo, sin adivinar.
//
// 🔴 EL GRANO DE LA DE ES JobID × DÍA. Una pieza que salió 5 días son 5 filas. Se AGREGA por
//    ConfigKey. Y las tasas NUNCA se promedian: no se cargan — el motor las recalcula desde los
//    conteos. Aquí solo se suman conteos y se toma la fecha ANCLA = mín(SendDay) de la pieza
//    (la regla probada: la fecha es de la pieza, nunca del journey).
//
// 🔴 DOS HUECOS CONOCIDOS DEL SPEC, que se REPORTAN, no se inventan:
//    · P005/P006 salen plegados dentro de P025/P027 (nombres duplicados en el config de SFMC).
//    · Pro Plan viene a 1/3 (cada pieza salió como 3 correos y el config registró uno).
//    Se arreglan en el config de SFMC (trabajo de Rick), no aquí. Se anotan en el handoff.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { return Number(String(v == null ? 0 : v).replace(/[, ]/g, '')) || 0; };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

// ── el catálogo, fuente de verdad de las dimensiones ────────────────────────────────────────
var TL = os.homedir() + '/_nb_cat.xlsx';
fs.copyFileSync(require(BACK + '/_scripts/lib-flexible.js').archivoVivo({ dir: PROY }).ruta, TL);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TL).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var pieza = {};
P.forEach(function (p) { if (t(p['Pieza_ID'])) pieza[t(p['Pieza_ID'])] = p; });

// ── el crudo de SFMC ────────────────────────────────────────────────────────────────────────
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-email-detalle.json', 'utf8'));
var R = D.rows;

// fecha ISO desde "3/14/2026 12:00:00 AM"
function iso(s) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t(s));
  if (!m) return '';
  return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
}

// ── agregación por ConfigKey (= Pieza_ID) ────────────────────────────────────────────────────
// Una pieza puede traer Principal y FUP en filas distintas (Es_FUP difiere). NO se mezclan: la
// llave de agregación es ConfigKey + Es_FUP, porque el reporte separa Principal de FUP.
var agg = {};
R.forEach(function (r) {
  var esFup = /^si$/i.test(t(r.Es_FUP));
  var k = t(r.ConfigKey) + '¦' + (esFup ? 'FUP' : 'PRIN');
  var a = agg[k] || (agg[k] = {
    pieza_id: t(r.ConfigKey), email_type: esFup ? 'FollowUp' : 'Principal',
    fecha: '', sends: 0, deliveries: 0, opens: 0, clicks: 0, bounces: 0,
    email_ids: {}, content_names: {}, dias: 0,
    de_bu: t(r.BU), de_marca: t(r.Marca), de_campana: t(r.Campana), de_tp: t(r.Touchpoint), de_seg: t(r.Segmento), de_nc: t(r.Codigo_NC)
  });
  a.sends += num(r.Email_Sends); a.deliveries += num(r.Email_Deliveries);
  a.opens += num(r.Email_Unique_Opens); a.clicks += num(r.Email_Unique_Clicks); a.bounces += num(r.Email_Bounces);
  var f = iso(r.SendDay);
  if (f && (!a.fecha || f < a.fecha)) a.fecha = f;   // 🔴 mín(SendDay) = la fecha ancla de la pieza
  if (t(r.Email_ID)) a.email_ids[t(r.Email_ID)] = 1;
  // 🔴 Content_ID = el NOMBRE COMPLETO del correo en Content Builder (Email_Content_Name), NO el
  //    journey. Decidido por Rick 20-ago: el content id es la identidad del email diseñado y no
  //    depende del journey — por eso los one-shots de Pro Plan (sin journey) SÍ tienen Content_ID.
  if (t(r.Email_Content_Name)) a.content_names[t(r.Email_Content_Name)] = 1;
  a.dias++;
});

// ── emitir en el contrato del motor ──────────────────────────────────────────────────────────
var sinCatalogo = [];
var envios = Object.keys(agg).map(function (k) {
  var a = agg[k];
  var p = pieza[a.pieza_id];
  if (!p) sinCatalogo.push(a.pieza_id);
  return {
    llave: k, pieza_id: a.pieza_id, content_name: t(p && p['Content_Name']) || a.de_campana,
    fecha: a.fecha, email_type: a.email_type, canal: 'Email', fuente: 'SFMC · CRM_Email_Detalle',
    email_sends: a.sends, email_deliveries: a.deliveries,
    email_unique_opens: a.opens, email_unique_clicks: a.clicks, email_bounces: a.bounces,
    // las dos columnas nuevas del reporte, a nivel pieza:
    email_id: Object.keys(a.email_ids).join(', '),          // el creativo (Email_ID de SFMC)
    content_id: Object.keys(a.content_names).join(' · '),   // 🔴 EmailName completo de Content Builder
    dias_de_envio: a.dias,
    // dimensiones canónicas — el motor las toma del catálogo vía pieza_id; van aquí de respaldo
    bu_canonico: t(p && p['BU']) || a.de_bu, marca_canonica: t(p && p['Marca']) || a.de_marca,
    campana_canonica: t(p && p['Campaña']) || a.de_campana, segmento_canonico: t(p && p['Segmento']) || a.de_seg,
    objetivo: t(p && p['Objetivo']), touchpoint_raw: t(p && p['Touchpoint']) || a.de_tp,
    canonico_via: p ? 'catálogo · ConfigKey=Pieza_ID' : 'SIN PIEZA en el catálogo'
  };
});

var sends = envios.reduce(function (s, e) { return s + e.email_sends; }, 0);
var crudoSends = R.reduce(function (s, r) { return s + num(r.Email_Sends); }, 0);

// ── VALIDACIONES · antes de dar el JSON por bueno ────────────────────────────────────────────
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([ok, n, d]); if (!ok) fallo++; }
chk('Σ sends del email.json == Σ sends del crudo (nada se pierde al agregar)', sends === crudoSends, mil(sends) + ' = ' + mil(crudoSends));
chk('toda pieza cruza al catálogo', sinCatalogo.length === 0, sinCatalogo.length ? 'sin catálogo: ' + sinCatalogo.join(' · ') : 'las ' + envios.length + ' cruzan');
chk('toda pieza con fecha ancla', envios.every(function (e) { return e.fecha; }), envios.filter(function (e) { return !e.fecha; }).map(function (e) { return e.pieza_id; }).join(' · ') || 'todas');
chk('toda pieza tiene objetivo (del catálogo)', envios.every(function (e) { return e.objetivo; }), envios.filter(function (e) { return !e.objetivo; }).map(function (e) { return e.pieza_id; }).join(' · ') || 'todas');
chk('ninguna tasa se cargó (el motor las recalcula)', envios.every(function (e) { return e.email_open_rate === undefined; }), 'sin tasas precargadas');
chk('deliveries ≤ sends en cada pieza', envios.every(function (e) { return e.email_deliveries <= e.email_sends; }), 'sin entregas mayores que envíos');
// cruce con las dimensiones que trae la propia DE — si difieren, alguien desalineó config vs catálogo
var difCampana = envios.filter(function (e) {
  var p = pieza[e.pieza_id]; return p && t(p['Campaña']) && agg[e.llave].de_campana && t(p['Campaña']).toLowerCase() !== agg[e.llave].de_campana.toLowerCase();
});
chk('la campaña del catálogo coincide con la de SFMC', difCampana.length === 0,
  difCampana.length ? difCampana.slice(0, 5).map(function (e) { return e.pieza_id + ': cat=' + t(pieza[e.pieza_id]['Campaña']) + ' vs sfmc=' + agg[e.llave].de_campana; }).join(' · ') : 'alineadas');

var out = {
  paso: 'NB', generado_por: 'orquestador.nb-email-sfmc.js', fuente: 'SFMC · CRM_Email_Detalle', canonico: 'catálogo vía ConfigKey=Pieza_ID',
  llave: [{ campo: 'pieza_id', de: 'ConfigKey' }, { campo: 'email_type', de: 'Es_FUP' }],
  envios: envios,
  auditoria: {
    envios: envios.length, piezas: Object.keys(agg).reduce(function (o, k) { o[agg[k].pieza_id] = 1; return o; }, {}).length,
    sends_total: sends, filas_crudas: R.length, ventana: [iso(R[0].SendDay)],
    principal: envios.filter(function (e) { return e.email_type === 'Principal'; }).length,
    fup: envios.filter(function (e) { return e.email_type === 'FollowUp'; }).length,
    sin_catalogo: sinCatalogo
  },
  huecos_conocidos_del_spec: [
    'P005/P006 salen plegados en P025/P027 (nombres duplicados en CRM_Reporte_Config) — se corrige en el config de SFMC',
    'Pro Plan viene a 1/3 (cada pieza salió como 3 correos, el config registró uno) — faltan altas en el config de SFMC'
  ],
  para_el_siguiente: { que_es: 'bloque email desde SFMC, mismo contrato que el bloque Datorama, listo para el motor motor-calculo' }
};

console.log('════════ N-B · email.json desde SFMC ════════');
console.log('  envíos (pieza × tipo): ' + envios.length + '   ·   Principal ' + out.auditoria.principal + ' · FUP ' + out.auditoria.fup);
console.log('  piezas distintas     : ' + out.auditoria.piezas);
console.log('  Σ sends              : ' + mil(sends) + '\n');
V.forEach(function (v) { console.log('  ' + (v[0] ? '✔' : '🔴') + ' ' + v[1].padEnd(52) + ' ' + (v[2] || '')); });

if (fallo) { console.log('\n  🔴 ' + fallo + ' validación(es) en rojo — NO se escribe email.json'); process.exit(1); }
fs.writeFileSync(BACK + '/_fuentes/email.json', JSON.stringify(out, null, 1));
console.log('\n  ✅ email.json escrito · ' + envios.length + ' envíos · las ' + V.length + ' validaciones en verde');
