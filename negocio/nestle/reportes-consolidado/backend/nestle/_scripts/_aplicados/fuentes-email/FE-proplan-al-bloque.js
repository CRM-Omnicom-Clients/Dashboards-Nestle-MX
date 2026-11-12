// FE · EL PUENTE DE PRO PLAN E3 — mete al bloque de email los 6 correos que SFMC envió y que la
//      DE no entrega, porque `CRM_Reporte_Config` no los declara.
//
// 🔴 POR QUÉ EXISTE. `CRM_Email_Detalle` es un reflejo de `CRM_Reporte_Config`: lo que el config
//    no declara, la DE no lo trae, y el reporte tampoco. Pro Plan E3 son NUEVE correos (3 personas
//    × 3 mascotas) y el config solo declaró TRES. Los otros seis —26,102 envíos— existen en SFMC
//    y se sacaron uno a uno con `sfmc_get_send_metrics` por jobId. Son datos REALES, medidos, no
//    del documento de correcciones.
//
// 🔴 ESTO SE BORRA EL DÍA QUE ENTREN AL CONFIG. No es una regla de negocio: es una muleta con
//    fecha de caducidad, y por eso el bloque la declara en `puente_proplan_e3.quitar_cuando`.
//
// 🔴 LA QUINCENA ES LA DE LA OLEADA, NO LA DEL jobId. Este es el error que corrigió el
//    normalizador (I1) el 20-ago: `get_send_metrics` resuelve UN job —el blast del 17-jul— así
//    que la fecha que devuelve es la de ese job, no el mín(Send_Date) de la pieza. Sus tres
//    hermanas, que sí están en la DE, arrancan el 13-jul con 5-6 días de envío: la oleada E3
//    corrió del 13 al 17. Anclar seis de nueve al 17 partía UNA MISMA OLEADA en dos quincenas
//    (Jul-Q1 y Jul-Q2) según por qué vía había llegado cada pieza — y contradecía las nueve filas
//    que Rick ya tenía puestas en Jul-Q1. La fecha ancla se toma de las hermanas de la MISMA
//    campaña × touchpoint que sí vienen de la DE, y se declara de dónde salió.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var INS = BACK + '/_insumos/proplan-e3-metricas-reales.json';
if (!fs.existsSync(INS)) { console.log('🔴 falta ' + INS + ' — sin el insumo no se inventa nada.'); process.exit(1); }
var M = JSON.parse(fs.readFileSync(INS, 'utf8'));
var em = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

// el mapa pieza ← email_id lo manda el catálogo, no yo
var XLSX = require('xlsx');
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var C = os.homedir() + '/_fe.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(C).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var porEmailId = {};
CAT.forEach(function (p) { if (t(p['EmailID'])) porEmailId[t(p['EmailID'])] = p; });

console.log('════════ FE · PUENTE PRO PLAN E3 ════════\n');
console.log('  insumo: ' + M.length + ' correos medidos por jobId');

// 🔴 la fecha ancla: la mín(Send_Date) de las piezas HERMANAS que sí vienen de la DE
var yaEstan = {};
em.envios.forEach(function (e) { if (t(e.email_id)) t(e.email_id).split(/[,;]/).map(t).forEach(function (id) { yaEstan[id] = e; }); });
var hermanas = em.envios.filter(function (e) {
  return /CRM_Email_Detalle/.test(t(e.fuente)) && /E-?E3/i.test(t(e.touchpoint_raw));
});
var fechaOleada = hermanas.map(function (e) { return t(e.fecha); }).filter(Boolean).sort()[0] || '';
console.log('  hermanas en la DE: ' + hermanas.length + '   fecha ancla de la oleada: ' + (fechaOleada || '(ninguna)'));
if (!fechaOleada) {
  console.log('  🔴 ninguna hermana en la DE trae fecha. No se ancla por conveniencia: se para.');
  process.exit(1);
}

var nuevos = 0, ya = 0, sinPieza = [], sends = 0, refechados = 0;
M.forEach(function (m) {
  var eid = t(m.email_id);
  if (yaEstan[eid]) {
    ya++;
    // 🔴 idempotente Y correctivo: si el registro ya está pero lo puso ESTE puente con la fecha
    //    del jobId, se le pone la de la oleada. Un script que solo sabe crear deja para siempre
    //    el error que cometió la primera vez.
    var e = yaEstan[eid];
    if (/get_send_metrics/.test(t(e.fuente)) && t(e.fecha) !== fechaOleada) {
      console.log('   ~ ' + t(e.pieza_id).padEnd(10) + eid.padEnd(8) + 'fecha ' + t(e.fecha) + ' → ' + fechaOleada + '  (era la del jobId, no la de la oleada)');
      e.fecha = fechaOleada;
      e.fecha_via = 'oleada E-E3: mín(Send_Date) de las hermanas de la DE (' + fechaOleada + '). ' +
        'get_send_metrics solo resuelve el blast del jobId ' + m.jobId + ', no el mín de la pieza.';
      refechados++;
    }
    return;
  }
  var p = porEmailId[eid];
  if (!p) { sinPieza.push(eid + ' · ' + t(m.personaN) + ' ' + t(m.mascota)); return; }
  var seg = t(p['Segmento']) || (t(m.personaN) ? 'Pro Plan ' + t(m.personaN) : '');
  if (t(p['Subsegmento']) && seg.indexOf('—') < 0) seg = seg + ' — ' + t(p['Subsegmento']);
  em.envios.push({
    llave: t(p['Pieza_ID']) + '¦PRIN',
    pieza_id: t(p['Pieza_ID']),
    content_name: t(m.content_id),
    fecha: fechaOleada,
    fecha_via: 'oleada E-E3: mín(Send_Date) de las hermanas de la DE (' + fechaOleada + '). ' +
      'get_send_metrics solo resuelve el blast del jobId ' + m.jobId + ', no el mín de la pieza.',
    email_type: 'Principal',
    canal: 'Email',
    fuente: 'SFMC · sfmc_get_send_metrics jobId ' + m.jobId,
    email_sends: +m.sends || 0, email_deliveries: +m.deliv || 0,
    email_unique_opens: +m.opens || 0, email_unique_clicks: +m.clicks || 0, email_bounces: (+m.sends || 0) - (+m.deliv || 0),
    email_id: eid,
    content_id: t(m.content_id),
    dias_de_envio: null,
    bu_canonico: t(p['BU']), marca_canonica: t(p['Marca']), campana_canonica: t(p['Campaña']),
    segmento_canonico: seg, objetivo: t(p['Objetivo']), touchpoint_raw: t(p['Touchpoint']),
    canonico_via: 'catálogo · EmailID'
  });
  nuevos++; sends += (+m.sends || 0);
  console.log('   + ' + t(p['Pieza_ID']).padEnd(10) + eid.padEnd(8) + mil(m.sends).padStart(8) + ' envíos   ' + seg);
});
console.log('\n  nuevos ' + nuevos + ' · ya estaban ' + ya + ' · sin pieza en el catálogo ' + sinPieza.length);
if (sinPieza.length) console.log('   🔴 ' + sinPieza.join(' · '));

em.puente_proplan_e3 = {
  motivo: 'CRM_Reporte_Config no declara estas piezas, así que la DE no las trae. Verificadas una a una en SFMC por jobId.',
  cuantos: nuevos || (em.puente_proplan_e3 || {}).cuantos || 0,
  sends: sends || (em.puente_proplan_e3 || {}).sends || 0,
  fecha_ancla: fechaOleada,
  fecha_via: 'mín(Send_Date) de las hermanas E-E3 que sí están en la DE — el jobId solo resuelve un blast',
  quitar_cuando: 'entren al config y la DE las traiga sola'
};
em.auditoria = em.auditoria || {};
em.auditoria.envios = em.envios.length;
em.auditoria.sends_total = em.envios.reduce(function (a, e) { return a + (+e.email_sends || 0); }, 0);
fs.writeFileSync(BACK + '/_fuentes/email.json', JSON.stringify(em, null, 1));
console.log('\n  bloque: ' + em.auditoria.envios + ' envíos · Σ ' + mil(em.auditoria.sends_total));
console.log('  → _fuentes/email.json');
