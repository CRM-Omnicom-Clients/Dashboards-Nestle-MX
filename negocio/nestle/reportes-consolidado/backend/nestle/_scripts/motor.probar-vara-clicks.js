/*
 * motor.probar-vara-clicks.js — ¿con qué vara se mide el desglose de clicks? Mide, no escribe.
 *
 * 🔴 EL DEFECTO (24-sep-2026). Rick: «no puede haber incongruencias en el sentido de que el total
 *    de clicks sea menor que alguno de los desgloses». Medido: el desglose excede al total en
 *    **98 de 101 piezas**. Y NO es mala atribución — son DOS VARAS DISTINTAS:
 *
 *       total    = `Email_Unique_Clicks`  · únicos POR CORREO   (CRM_Email_Piezas)
 *       desglose = Σ `Clicks_Unique`      · únicos POR LINK     (CRM_Email_Links)
 *
 *    Quien hace clic en dos links cuenta UNA vez arriba y DOS abajo. Σ(únicos por link) ≥ únicos
 *    por correo SIEMPRE. Ninguna re-atribución arregla eso: hay que medir los dos lados igual.
 *
 * 🔴 Y EL CHECK QUE DEBÍA VERLO SE COMPARABA CONSIGO MISMO. `motor.links.js` valida
 *    `Σ por_destino === clicks_unicos`, pero las dos cifras se construyen del MISMO campo en el
 *    MISMO bucle. Un guardián que compara algo consigo mismo no prueba nada: pasaba en verde
 *    mientras el reporte decía que 325 clicks de CTA salían de un total de 288.
 *
 * QUÉ HACE: compara las dos parejas posibles contra las FUENTES (no contra la rejilla) y dice
 * cuál es coherente. No decide por su cuenta: si la pareja elegida no cuadra, falla.
 *
 *   node motor.probar-vara-clicks.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();

var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[,$%\s]/g, '')); return isFinite(x) ? x : 0; };
function ruta(x) { return typeof x === 'string' ? x : (x && (x.ruta || x.archivo)); }

var rDet = ruta(L.insumoVigente('sfmc-detalle'));
var rLnk = ruta(L.insumoVigente('sfmc-links'));
if (!rDet || !rLnk) { console.log('🔴 falta un volcado vigente (detalle o links)'); process.exit(1); }

console.log('════════ motor · ¿CON QUÉ VARA SE MIDE EL DESGLOSE DE CLICKS? ════════\n');
console.log('  detalle: ' + path.basename(rDet));
console.log('  links:   ' + path.basename(rLnk) + '\n');

var DET = JSON.parse(fs.readFileSync(rDet, 'utf8'));
var LNK = JSON.parse(fs.readFileSync(rLnk, 'utf8'));

/* por pieza, desde el DETALLE (la fuente del total) */
var correoUnico = {}, correoTotal = {};
(DET.rows || []).forEach(function (r) {
  var k = t(r.ConfigKey);
  correoUnico[k] = (correoUnico[k] || 0) + num(r.Email_Unique_Clicks);
  correoTotal[k] = (correoTotal[k] || 0) + num(r.Email_Total_Clicks);
});
/* por pieza, desde LINKS (la fuente del desglose) */
var linkUnico = {}, linkTotal = {}, nLinks = {};
(LNK.rows || []).forEach(function (r) {
  var k = t(r.ConfigKey);
  linkUnico[k] = (linkUnico[k] || 0) + num(r.Clicks_Unique);
  linkTotal[k] = (linkTotal[k] || 0) + num(r.Clicks_Total);
  nLinks[k] = (nLinks[k] || 0) + 1;
});

var piezas = Object.keys(linkTotal).filter(function (k) { return correoTotal[k] !== undefined; });

function evaluar(nombre, desglose, total) {
  var exceden = [], residuo = 0;
  piezas.forEach(function (k) {
    var d = desglose[k] || 0, T = total[k] || 0;
    if (d > T) exceden.push({ pieza: k, desglose: d, total: T, de_mas: d - T });
    else residuo += (T - d);
  });
  return { nombre: nombre, piezas: piezas.length, exceden: exceden, residuo: residuo };
}

var A = evaluar('únicos por LINK  vs  únicos por CORREO', linkUnico, correoUnico);
var B = evaluar('TOTALES por LINK vs  TOTALES por CORREO', linkTotal, correoTotal);

[A, B].forEach(function (r) {
  var ok = r.exceden.length === 0;
  console.log('  ' + (ok ? '✅' : '🔴') + '  ' + r.nombre);
  console.log('        piezas ' + r.piezas + '   ·   exceden ' + r.exceden.length + '   ·   residuo ' + r.residuo.toLocaleString());
  r.exceden.slice(0, 4).forEach(function (x) {
    console.log('           ' + x.pieza + ': desglose ' + x.desglose + ' > total ' + x.total + '   (+' + x.de_mas + ')');
  });
  console.log('');
});

/* 🔴 LA VARA NO SE ELIGE POR GUSTO: gana la que no exceda en NINGUNA pieza. Si ninguna cumple,
 *    este paso falla — no hay una «mejor de las dos» cuando las dos están mal. */
var elegida = B.exceden.length === 0 ? B : (A.exceden.length === 0 ? A : null);
console.log('════ VEREDICTO ════');
if (!elegida) {
  console.log('  🔴 NINGUNA de las dos parejas es coherente. No se toca el motor hasta entender por qué.');
  process.exit(1);
}
console.log('  ✅ la vara que sí cierra: ' + elegida.nombre);
console.log('     ' + elegida.piezas + ' de ' + elegida.piezas + ' piezas · 0 exceden · residuo ' + elegida.residuo.toLocaleString() +
  ' click(s) del correo que no cayeron en un link medido');
console.log('');
console.log('  🔴 Y lo que NO cambia: `*_Clicks` del reporte sigue siendo ÚNICOS POR CORREO.');
console.log('     Es lo que alimenta CTOR y Click_Rate; moverlo cambiaría métricas que el cliente ya vio.');
console.log('     El desglose por destino pasa a CLICKS TOTALES, con su propio total comparable.');

var salida = {
  cuando: new Date().toISOString(), detalle: path.basename(rDet), links: path.basename(rLnk),
  vara_elegida: elegida.nombre, piezas: elegida.piezas, exceden: elegida.exceden.length, residuo: elegida.residuo,
  rechazada: (elegida === B ? A : B).nombre, rechazada_exceden: (elegida === B ? A : B).exceden.length,
  por_pieza: piezas.map(function (k) {
    return { pieza: k, links: nLinks[k], correo_unico: correoUnico[k] || 0, correo_total: correoTotal[k] || 0,
      link_unico: linkUnico[k] || 0, link_total: linkTotal[k] || 0 };
  })
};
fs.writeFileSync(BACK + '/_preescritura/vara-clicks.json', JSON.stringify(salida, null, 1));
console.log('\n→ _preescritura/vara-clicks.json');
