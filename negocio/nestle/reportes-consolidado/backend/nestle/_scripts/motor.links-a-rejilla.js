// motor-rejilla · MEZCLA EL DESGLOSE DE CLICKS EN LA REJILLA, y consolida audiencia y volumen.
//
// 🔴 POR QUÉ UN SCRIPT APARTE Y NO DENTRO DE motor-calculo. `links.json` está a grano de PIEZA y la rejilla a
//    grano de celda (campaña × objetivo × touchpoint × segmento × quincena): una celda agrupa
//    varias piezas. Repartir eso dentro del bucle de email mezclaría dos granos en el mismo sitio
//    — que es exactamente cómo nacen los errores que nadie encuentra. Aquí el reparto es
//    explícito: cada celda suma los links de LAS PIEZAS QUE CONTIENE, ni una más.
//
// 🔴 Y EL VOLUMEN DE AUDIENCIA NO SE SUMA DOS VECES. Dos piezas de la misma celda pueden salir de
//    la MISMA DE (el Principal y su FUP, por ejemplo). Sumar sus volúmenes daría el doble de una
//    audiencia que es una sola. Se cuenta una vez por DE distinta.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var LK = fs.existsSync(BACK + '/_fuentes/links.json') ? JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8')) : null;
console.log('════════ motor-rejilla · LINKS Y AUDIENCIA A LA REJILLA ════════\n');
if (!LK) { console.log('  ⊘ no hay links.json — la rejilla queda sin desglose de clicks'); process.exit(0); }

var CLASES = ['qcart', 'app', 'social', 'web', 'ver_en_navegador', 'unsub', 'otro'];
var conLinks = 0, sinLinks = [];
R.rejilla.forEach(function (c) {
  c.clicks_por_destino = c.clicks_por_destino || {};
  c.links_clicks_unicos = 0;
  (c.piezas || []).forEach(function (pid) {
    var p = LK.piezas[pid];
    if (!p) { if (sinLinks.indexOf(pid) < 0) sinLinks.push(pid); return; }
    c.links_clicks_unicos += p.clicks_unicos;
    Object.keys(p.por_destino).forEach(function (k) {
      c.clicks_por_destino[k] = (c.clicks_por_destino[k] || 0) + p.por_destino[k];
    });
  });
  if (c.links_clicks_unicos) conLinks++;
  // 🔴 el volumen de audiencia: UNA vez por DE distinta, no por pieza
  var vols = c.audiencias || {};
  c.audiencia_volumen = Object.keys(vols).reduce(function (a, k) { return a + (vols[k] || 0); }, 0);
  c.audiencia_de = Object.keys(vols).join(' · ');
  c.audiencias_distintas = Object.keys(vols).length;
});

var tot = {};
CLASES.forEach(function (k) { tot[k] = R.rejilla.reduce(function (a, c) { return a + (c.clicks_por_destino[k] || 0); }, 0); });
console.log('  celdas con desglose de clicks: ' + conLinks + ' de ' + R.rejilla.length);
console.log('  celdas con audiencia declarada: ' + R.rejilla.filter(function (c) { return c.audiencia_de; }).length);
console.log('\n  ── clicks únicos por destino en toda la rejilla');
CLASES.forEach(function (k) { if (tot[k]) console.log('     ' + k.padEnd(18) + mil(tot[k]).padStart(8)); });
var sumaCeldas = R.rejilla.reduce(function (a, c) { return a + c.links_clicks_unicos; }, 0);
console.log('\n  ── el cuadre: Σ de la rejilla ' + mil(sumaCeldas) + '   vs el bloque de links ' + mil(LK.auditoria.clicks_unicos) +
  '   ' + (sumaCeldas === LK.auditoria.clicks_unicos ? '✔' : '⚠ difieren en ' + mil(Math.abs(sumaCeldas - LK.auditoria.clicks_unicos)) +
    ' — son las piezas cuyo link no llega a ninguna celda'));
if (sinLinks.length) console.log('  ⚠ ' + sinLinks.length + ' pieza(s) de la rejilla sin links en la DE: ' + sinLinks.slice(0, 6).join(' · '));

var unsub = R.rejilla.reduce(function (a, c) { return a + (c.unsubs_unicos || 0); }, 0);
console.log('\n  ── unsubs: ' + mil(unsub) + ' únicos · ' + mil(R.rejilla.reduce(function (a, c) { return a + (c.unsubs_total || 0); }, 0)) + ' totales');
console.log('  ── audiencia: ' + mil(R.rejilla.reduce(function (a, c) { return a + (c.audiencia_volumen || 0); }, 0)) + ' (suma de volúmenes por celda)');

R.auditoria = R.auditoria || {};
R.auditoria.links = { celdas_con_desglose: conLinks, por_destino: tot, piezas_sin_links: sinLinks };
fs.writeFileSync(BACK + '/_rejilla/rejilla.json', JSON.stringify(R, null, 1));
console.log('\n  → _rejilla/rejilla.json');
