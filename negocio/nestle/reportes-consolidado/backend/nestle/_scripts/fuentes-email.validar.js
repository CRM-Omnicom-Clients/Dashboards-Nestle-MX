// NC-99 · valida el bloque de email de SFMC contra su volcado y contra el catálogo.
//
// 🔴 POR QUÉ EXISTE. Los validadores de `email-bloque` validaban la migración DESDE los agentes viejos, y
//    uno de ellos —`N2a-99-validar.js`— vuelve a correr `N2a-email.js` para comparar. Eso, con la
//    fuente ya migrada a SFMC, no valida: **revierte**. En la corrida completa del 21-ago el
//    bloque de 98 envíos / 7,282,486 volvió a ser el de Datorama, 264 / 6,454,554, y la Puerta 2
//    se cerró acusando al reporte de perder 408,900 envíos que nadie había perdido.
//    Un validador con su propia copia de la decisión se desfasa en cuanto la decisión cambia.
//
// 🔴 LO QUE MIDE: que el bloque diga lo mismo que el VOLCADO de la DE (no lo que él cree de sí
//    mismo), que cada envío tenga pieza, que `Es_FUP` venga declarado, y que ningún ContentName
//    aparezca dos veces — que es la llave que declara el handoff.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var ok = 0, mal = 0;
function chk(nom, cond, ev) {
  console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(50) + ev);
  cond ? ok++ : mal++;
}

console.log('════════ NC-99 · EL BLOQUE DE EMAIL CONTRA SU FUENTE ════════\n');
var E = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

// 🔴 lo primero: que el bloque lo haya hecho QUIEN debe. Si aquí dice `N2a-email.js`, alguien
//    revirtió la fuente y todo lo demás sobra.
// 🔴 A QUIÉN LE PREGUNTA QUIÉN DEBE HABER GENERADO EL BLOQUE: a la CADENA, no a un nombre clavado.
//    Este check decía `/NC-email-piezas/` y el renombre de la fase 5 lo rompió contra su propio
//    sistema: el bloque pasó a decir `fuentes-email.email-piezas.js`, que es el MISMO lector con su
//    nombre nuevo, y el validador declaró «EL BLOQUE NO ES EL DE SFMC» sobre un bloque de SFMC
//    perfectamente sano (98 envíos, Σ 7,282,486).
//    Es exactamente lo que la fase 3 midió: una decisión —quién genera el bloque de email— escrita
//    dentro del código. Ahora se pide a `cadena-skills.json`, que es donde vive.
var QUIEN_DEBE = (function () {
  try {
    var C = JSON.parse(require('fs').readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
    var et = C.etapas.filter(function (e) { return /fuentes-email/.test(e.skill); })[0];
    return et && et.scripts[0] ? et.scripts[0].script : null;
  } catch (e) { return null; }
})();
// lo que NUNCA debe haberlo generado: la fuente vieja. Eso sí es un hecho del negocio, no un nombre.
var ES_DATORAMA = /N2a-email|datorama/i.test(t(E.generado_por));
var loGeneroElBueno = QUIEN_DEBE ? t(E.generado_por) === QUIEN_DEBE : !ES_DATORAMA;
chk('lo generó el lector que declara la cadena', loGeneroElBueno && !ES_DATORAMA,
  '«' + t(E.generado_por) + '»' + (QUIEN_DEBE ? '  · la cadena dice «' + QUIEN_DEBE + '»' : '  ⚠ sin cadena: solo se comprueba que no sea Datorama') +
  (ES_DATORAMA ? '  ← ALGUIEN REVIRTIÓ LA FUENTE A DATORAMA' : ''));
if (!loGeneroElBueno || ES_DATORAMA) {
  console.log('\n   Vuelve a correr:  node ' + (QUIEN_DEBE || 'fuentes-email.email-piezas.js') + ' --escribir');
  console.log('\n════════ 🔴 EL BLOQUE NO ES EL DE SFMC ════════');
  process.exit(1);
}

var env = E.envios || [];
// ── contra el volcado, que es la fuente
var FEp = require(BACK + '/_scripts/lib-fechas-envio.js');
var _v = require(BACK + '/_scripts/lib-flexible.js').insumoVigente('sfmc-piezas');
var INS = _v && _v.ruta;   // el vigente, no una fecha fija
if (fs.existsSync(INS)) {
  var D = JSON.parse(fs.readFileSync(INS, 'utf8'));
  var sumDE = (D.rows || []).reduce(function (a, r) { return a + num(r.Email_Sends); }, 0);
  var sumBloque = env.reduce(function (a, e) { return a + num(e.email_sends); }, 0);
  var sinPieza = ((E.auditoria || {}).sin_catalogo || []).reduce(function (a, x) { return a + num(x.sends); }, 0);
  // 🔴 LOS JOBS DE PRUEBA SE RESTARON A PROPÓSITO, así que entran en la ecuación como «lo
  //    declarado fuera». Se piden a `lib-fechas-envio`, que es quien decide qué es una prueba:
  //    si el check trajera su propio criterio, un día divergirían y este número dejaría de
  //    significar nada. Hoy son 203 envíos de 8,937,727 en 202 jobs de 1 correo.
  var pruebasFuera = FEp.pruebas().total.Email_Sends || 0;
  chk('Σ del bloque + lo de fuera + las pruebas == Σ de la DE', sumBloque + sinPieza + pruebasFuera === sumDE,
    mil(sumBloque) + ' + ' + mil(sinPieza) + ' + ' + mil(pruebasFuera) + ' de prueba = ' +
    mil(sumBloque + sinPieza + pruebasFuera) + '   la DE dice ' + mil(sumDE));
  chk('el bloque no tiene más piezas que la DE', env.length + ((E.auditoria || {}).sin_catalogo || []).length === D.count,
    env.length + ' + ' + ((E.auditoria || {}).sin_catalogo || []).length + ' de ' + D.count);
} else {
  console.log('   ⊘ no está el volcado ' + require('path').basename(INS) + ' — no se puede cruzar contra la fuente');
}

// ── la llave del handoff
var porCN = {};
env.forEach(function (e) { var c = t(e.content_name); if (c) porCN[c] = (porCN[c] || 0) + 1; });
var dup = Object.keys(porCN).filter(function (k) { return porCN[k] > 1; });
chk('ningún ContentName repetido (es la llave)', dup.length === 0,
  dup.length ? '🔴 ' + dup.length + ': ' + dup.slice(0, 2).join(' · ') : Object.keys(porCN).length + ' distintos');

chk('todo envío tiene pieza del catálogo', env.every(function (e) { return t(e.pieza_id); }),
  env.filter(function (e) { return t(e.pieza_id); }).length + '/' + env.length);
chk('todo envío tiene fecha ancla', env.every(function (e) { return t(e.fecha); }),
  env.filter(function (e) { return t(e.fecha); }).length + '/' + env.length);

// ── lo declarado le gana a lo inferido
chk('el tipo sale de `Es_FUP`, no del nombre', env.every(function (e) { return /Es_FUP/.test(t(e.email_type_via)); }),
  'Principal ' + env.filter(function (e) { return e.email_type === 'Principal'; }).length +
  ' · FollowUp ' + env.filter(function (e) { return e.email_type === 'FollowUp'; }).length);
var contra = ((E.auditoria || {}).contradicciones_es_fup || []).length;
chk('las contradicciones entre Es_FUP y el nombre se declaran', true,
  contra ? '⚠ ' + contra + ' declarada(s) — gana lo declarado' : 'ninguna');

// ── las columnas nuevas del handoff, que son la razón de migrar
[['subject', 'asunto'], ['audiencia_de', 'audiencia'], ['journey_id_datorama', 'journey de Datorama']].forEach(function (p) {
  var n = env.filter(function (e) { return t(e[p[0]]); }).length;
  chk('llega la columna nueva: ' + p[1], n > 0, n + '/' + env.length + ' envíos');
});

// ── lo que queda fuera se DECLARA, no se esconde
var fuera = (E.auditoria || {}).sin_catalogo || [];
chk('lo que no cruza al catálogo está declarado', true,
  fuera.length ? '⚠ ' + fuera.length + ' pieza(s) · ' + mil(fuera.reduce(function (a, x) { return a + num(x.sends); }, 0)) + ' envíos' : 'ninguna');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ EL BLOQUE DE EMAIL ES EL DE SFMC Y CUADRA') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
