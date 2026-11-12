// motor · ¿CUÁNTO SE SEPARAN LOS DOS TOTALES DE CLICKS? — medición, no suposición.
//
// 🔴 POR QUÉ EXISTE. El reporte ya trae `Principal_Clicks` / `FUP_Clicks` / `Tot_Clicks`, que salen
//    de `CRM_Email_Piezas.Email_Unique_Clicks` = **único por PERSONA**. Las 3 columnas nuevas de
//    desglose salen de `CRM_Email_Links.Clicks_Unique` = **único por LINK**. Los dos números son
//    correctos y miden cosas distintas, así que el desglose NO puede sumar el total de al lado.
//    Antes de escribir nueve columnas que a la vista parecen no cuadrar, hay que saber CUÁNTO se
//    separan y poder escribir la razón en el diccionario. Si no se mide, el primero que sume las
//    tres con la calculadora concluye que el reporte está roto.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

var LK = JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8'));
var EM = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var CD = require(BACK + '/_scripts/lib-clicks-destino.js');

console.log('════════ motor · LA BRECHA ENTRE LOS DOS TOTALES DE CLICKS ════════\n');

// por pieza: único por LINK (suma de sus links) vs único por PERSONA (la DE agregada)
var porPieza = {};
Object.keys(LK.piezas).forEach(function (pid) {
  porPieza[pid] = { link: LK.piezas[pid].clicks_unicos || 0, persona: null };
});
(EM.envios || []).forEach(function (r) {
  var pid = t(r.pieza_id);
  if (!pid) return;
  var c = Number(r.email_unique_clicks) || 0;
  if (!porPieza[pid]) porPieza[pid] = { link: 0, persona: 0 };
  porPieza[pid].persona = (porPieza[pid].persona || 0) + c;
});

var ids = Object.keys(porPieza).filter(function (p) { return porPieza[p].persona !== null; });
var sumL = ids.reduce(function (a, p) { return a + porPieza[p].link; }, 0);
var sumP = ids.reduce(function (a, p) { return a + porPieza[p].persona; }, 0);

console.log('  piezas con las dos mediciones: ' + ids.length);
console.log('  único por LINK    (CRM_Email_Links.Clicks_Unique)    ' + mil(sumL).padStart(9));
console.log('  único por PERSONA (CRM_Email_Piezas.Email_Unique_Clicks) ' + mil(sumP).padStart(6));
/* 🔴 EL AGREGADO MIENTE Y HAY QUE DESCOMPONERLO. La primera versión de este script imprimía
 *    «el link cuenta 1.3× más: una persona que toca 3 links cuenta 3 veces» como una explicación
 *    escrita a mano. Al medirlo, el agregado salió **0.99×** — o sea, según ese rótulo, el link
 *    contaría MENOS que la persona, que es imposible por construcción. No era un dato raro: son
 *    DOS efectos opuestos que se cancelan y que ninguno de los dos se ve en el cociente global.
 *      · hacia arriba · en las piezas que SÍ tienen links, el per-link infla (una persona que toca
 *        3 links cuenta 3 veces).
 *      · hacia abajo  · las piezas sin ni un link en la DE aportan 0 al per-link y su total entero
 *        al per-persona.
 *    Se imprimen separados. Un cociente global que tapa dos efectos de signo contrario no es un
 *    resumen: es un número que da permiso para no mirar. */
var conL = ids.filter(function (p) { return porPieza[p].link > 0; });
var sumLc = conL.reduce(function (a, p) { return a + porPieza[p].link; }, 0);
var sumPc = conL.reduce(function (a, p) { return a + porPieza[p].persona; }, 0);
console.log('  ── el cociente global es ' + (sumP ? (sumL / sumP).toFixed(2) : '—') + '×, y NO se puede leer: son dos efectos que se cancelan');
console.log('     · en las ' + conL.length + ' piezas CON links: ' + mil(sumLc) + ' por link vs ' + mil(sumPc) +
  ' por persona = ' + (sumPc ? (sumLc / sumPc).toFixed(3) : '—') + '×  ← el per-link infla, como debe');
console.log('     · las piezas SIN links aportan 0 por link y ' + mil(sumP - sumPc) + ' por persona  ← esto es lo que lo baja\n');

/* 🔴 EL HALLAZGO QUE DECIDE EL DISEÑO DE LAS 9 COLUMNAS: hay piezas con clicks reales y CERO
 *    filas en `CRM_Email_Links`. Para ésas el desglose no vale 0 — **no se sabe**. Escribir 0
 *    sería inventar una medición (L2: un cero no es un vacío), y encima una que resta: quien sume
 *    la columna del reporte concluiría que esos correos no tuvieron clicks efectivos cuando sí los
 *    tuvieron. Esas celdas van con su razón escrita, no con un número. */
var sinLinks = ids.filter(function (p) { return porPieza[p].link === 0 && porPieza[p].persona > 0; });
var parciales = ids.filter(function (p) { return porPieza[p].link > 0 && porPieza[p].link < porPieza[p].persona; });
var clicksSinDesglose = sinLinks.reduce(function (a, p) { return a + porPieza[p].persona; }, 0);
console.log('  🔴 piezas con clicks pero SIN NI UN link en la DE: ' + sinLinks.length + ' de ' + ids.length +
  '   ·   ' + mil(clicksSinDesglose) + ' clicks (' + (sumP ? (clicksSinDesglose / sumP * 100).toFixed(1) : 0) + '% del total por persona)');
console.log('     para ésas el desglose NO es 0 — es «no se sabe», y así tiene que quedar en el reporte');
sinLinks.sort(function (a, b) { return porPieza[b].persona - porPieza[a].persona; }).slice(0, 10).forEach(function (p) {
  console.log('       ' + p.padEnd(11) + mil(porPieza[p].persona).padStart(7) + ' clicks por persona, 0 links');
});
if (sinLinks.length > 10) console.log('       … y ' + (sinLinks.length - 10) + ' más');
console.log('\n  piezas con desglose PARCIAL (menos por link que por persona): ' + parciales.length);
parciales.sort(function (a, b) { return (porPieza[b].persona - porPieza[b].link) - (porPieza[a].persona - porPieza[a].link); })
  .slice(0, 5).forEach(function (p) {
    console.log('       ' + p.padEnd(11) + 'link ' + String(mil(porPieza[p].link)).padStart(7) + '   persona ' + String(mil(porPieza[p].persona)).padStart(7));
  });

// el desglose por clase, para confirmar que Σ clases == Σ link
var porClase = {};
Object.keys(LK.piezas).forEach(function (pid) {
  var d = LK.piezas[pid].por_destino || {};
  Object.keys(d).forEach(function (k) { porClase[k] = (porClase[k] || 0) + d[k]; });
});
var porCol = {};
Object.keys(porClase).forEach(function (k) {
  var c = CD.columnaDe(k);
  porCol[c] = (porCol[c] || 0) + porClase[k];
});
console.log('\n  ── el desglose, por la columna del reporte');
Object.keys(porCol).sort().forEach(function (c) { console.log('     ' + c.padEnd(30) + mil(porCol[c]).padStart(8)); });
var sumCols = Object.keys(porCol).reduce(function (a, c) { return a + porCol[c]; }, 0);
console.log('     ' + '───── Σ'.padEnd(30) + mil(sumCols).padStart(8) +
  '   ' + (sumCols === LK.auditoria.clicks_unicos ? '✔ igual al bloque de links' : '⚠ el bloque dice ' + mil(LK.auditoria.clicks_unicos)));

fs.writeFileSync(BACK + '/_preescritura/brecha-clicks.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10),
  unico_por_link: sumL, unico_por_persona: sumP,
  factor: sumP ? Number((sumL / sumP).toFixed(4)) : null,
  piezas_comparadas: ids.length, piezas_sin_links: sinLinks, piezas_parciales: parciales, clicks_sin_desglose: clicksSinDesglose,
  por_columna: porCol
}, null, 1));
console.log('\n  → _preescritura/brecha-clicks.json');
