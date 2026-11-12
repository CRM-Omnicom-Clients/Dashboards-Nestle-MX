// N2 · ¿UN ENVÍO PUEDE CAER EN MÁS DE UNA QUINCENA? — la pregunta de Rick.
//
// Hay que separar DOS cosas que se confunden:
//
//   1. EL ENVÍO         ocurre UN día → cae en UNA quincena. No hay ambigüedad.
//   2. SU ENGAGEMENT    sigue llegando semanas después → SÍ cruza quincenas y meses.
//
// La confusión de N1 era otra: ahí una PIEZA (campaña·touchpoint·segmento) agrupa VARIOS
// envíos en fechas distintas — por eso una pieza sí tiene Quincenas_Activas. Un envío no.
//
// Este script mide cuánto engagement cae fuera de la quincena de su envío, para que la
// decisión de a dónde atribuirlo se tome con el número delante.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
// 🔴 SUPERADO por N2a-email.js (19-ago-2026)
//    el engagement multi-quincena ya sale en auditoria.multimes y delta_opens_si_se_sumara.
//    Se conserva por su historia, no por su utilidad: corre sobre un esquema que ya cambió.
var SUPERADO_POR = "N2a-email.js";
if (!process.env.CORRER_SUPERADO) {
  console.log("\n  🔴 este script está SUPERADO por " + SUPERADO_POR + ".");
  console.log("     el engagement multi-quincena ya sale en auditoria.multimes y delta_opens_si_se_sumara");
  console.log("     Si de verdad lo necesitas: CORRER_SUPERADO=1 node N2-04-quincenas.js\n");
  process.exit(0);
}
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = D.t, num = D.num;
var Qz = function (d) { return d.slice(0, 7) + '-' + (Number(d.slice(8, 10)) <= 15 ? 'Q1' : 'Q2'); };
var F = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

console.log('════ ¿UN ENVÍO CRUZA QUINCENAS? ════\n');

// ── 1 · el envío en sí
var sinFecha = F.envios.filter(function (e) { return !t(e.fecha); });
console.log('══ 1 · EL ENVÍO ══');
console.log('  envíos: ' + F.envios.length + '  ·  sin fecha: ' + sinFecha.length);
console.log('  ✔ cada envío tiene UNA fecha → UNA quincena. No hay nada que separar aquí.');
var porQ = {};
F.envios.forEach(function (e) { if (t(e.fecha)) porQ[Qz(e.fecha)] = (porQ[Qz(e.fecha)] || 0) + e.email_sends; });
console.log('  distribución de los envíos por quincena:');
Object.keys(porQ).sort().forEach(function (q) { console.log('     ' + q + '  ' + String(porQ[q].toLocaleString()).padStart(11) + ' envíos'); });

// ── 2 · el engagement · dónde cae respecto a su envío
console.log('\n══ 2 · SU ENGAGEMENT ══');
var inv = D.inventario(PROY + '/Reportes-Datorama');
var R = D.leerArchivo(inv[0].ruta);
// el mes lo reconoce L.mesDe(), que conoce los 12. La lista clavada llegaba a agosto: en
// septiembre devolvia null y la fila se perdia sin un solo error en pantalla.
var porLlave = {};
R.hojas.forEach(function (h) {
  var mm = L.mesDe(h.hoja);
  h.filas.forEach(function (r) {
    var cn = t(r['Email Content Name']); if (!cn || !mm) return;
    var k = D.llaveEnvio({ content_name: cn, fecha: r['Send Date'] });
    (porLlave[k] = porLlave[k] || []).push({ mes: '2026-' + mm, opens: Math.max(0, num(r['Email Unique Opens'])), clicks: Math.max(0, num(r['Email Unique Clicks'])) });
  });
});
var mismoMes = 0, otroMes = 0, opensMismo = 0, opensOtro = 0, clicksOtro = 0, cruzan = [];
F.envios.forEach(function (e) {
  var L = porLlave[e.llave]; if (!L || !t(e.fecha)) return;
  var mEnvio = e.fecha.slice(0, 7), fuera = 0, foraC = 0;
  L.forEach(function (x) {
    if (x.mes === mEnvio) { mismoMes += x.opens; opensMismo += x.opens; }
    else { otroMes += x.opens; opensOtro += x.opens; fuera += x.opens; foraC += x.clicks; clicksOtro += x.clicks; }
  });
  if (fuera > 0) cruzan.push({ e: e, fuera: fuera, foraC: foraC, meses: L.map(function (x) { return x.mes; }).sort().join(',') });
});
console.log('  envíos cuyo engagement llega en OTRO mes: ' + cruzan.length + ' de ' + F.envios.length);
console.log('  opens en el mes del envío : ' + opensMismo.toLocaleString());
console.log('  opens en meses POSTERIORES: ' + opensOtro.toLocaleString() + '   (' + (opensOtro / (opensMismo + opensOtro) * 100).toFixed(1) + '% del total)');
console.log('  clicks en meses posteriores: ' + clicksOtro.toLocaleString());
console.log('\n  los que más cruzan:');
cruzan.sort(function (a, b) { return b.fuera - a.fuera; }).slice(0, 6).forEach(function (x) {
  console.log('     ' + x.e.fecha + '  ' + x.e.campana_raw.padEnd(14) + String(x.fuera.toLocaleString()).padStart(8) + ' opens fuera   meses: ' + x.meses);
});

// ── 3 · las dos formas de atribuirlo, con su consecuencia
console.log('\n══ 3 · LAS DOS OPCIONES, con su número ══');
console.log('  A) TODO al periodo del ENVÍO   ← lo que ya decidiste ("un journey sigue rindiendo");');
console.log('     el mes de un envío no cambia nunca, y las tasas se comparan contra SU base.');
console.log('     consecuencia: el mes de mayo puede seguir creciendo en opens meses después.');
console.log('  B) cada open a SU periodo');
console.log('     consecuencia: un envío aparecería en varias quincenas y el OR de un mes se');
console.log('     calcularía con opens de envíos de otro → la tasa deja de tener sentido.');
console.log('\n  🔴 Con A, lo único que hay que resolver es CUÁNTO, no DÓNDE:');
var dp = F.auditoria.DECISION_PENDIENTE;
console.log('     MAX  (hoy)  = solo el mejor mes        → deja fuera ' + dp.diferencia_opens.toLocaleString() + ' opens');
console.log('     SUMA        = todos los meses          → riesgo de doble conteo de "unique"');
console.log('     y esa es la única decisión que sigue abierta.');

fs.writeFileSync(BACK + '/_fuentes/engagement-multimes.json', JSON.stringify({
  pregunta: 'un envío ocurre en UNA quincena; su engagement cruza varias',
  envios_con_engagement_posterior: cruzan.length,
  opens_mes_del_envio: opensMismo, opens_meses_posteriores: opensOtro, clicks_meses_posteriores: clicksOtro,
  atribucion: 'A · todo al periodo del envío (regla ya decidida por Rick)',
  abierto: 'MAX vs SUMA del engagement multi-mes'
}, null, 1));
console.log('\n  → _fuentes/engagement-multimes.json');
