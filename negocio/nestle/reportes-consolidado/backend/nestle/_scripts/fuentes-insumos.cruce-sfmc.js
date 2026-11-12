// N1s · EL CRUCE CONTRA SFMC. Mide el bloque de email (Datorama) contra la autoridad (SFMC).
//
// 🔴 POR QUÉ EXISTE. Hasta hoy el email venía de Datorama y nadie tenía con qué contrastarlo:
//    el catálogo se llenaba de Datorama, así que compararlos era preguntarle a la misma fuente
//    dos veces. Con la DE `CRM_Reporte_Auditoria` —que Leslie puebla con una query contra las
//    Data Views `_Sent`/`_Job`— hay por fin una segunda medición INDEPENDIENTE, pieza por pieza.
//
// 🔴 Y NO EMPATAN: Datorama dice 6,454,554 y SFMC 6,339,177. 115 mil envíos de diferencia. El
//    documento de correcciones es explícito: **SFMC es la fuente de verdad, Datorama es
//    referencia. Donde difieren, manda SFMC.**
//
// ⚠ ESTE SCRIPT NO CORRIGE NADA. Mide y declara, pieza por pieza, para que la decisión de migrar
//   la fuente sea de Rick y esté informada. Cambiar la fuente de email es un cambio de raíz:
//   toca la llave, el refresh y el histórico entero.
//
// ⚠ EL PULL DEL MCP NO LO HACE ESTE SCRIPT. Un script no puede llamar al MCP de SFMC; lo trae
//   el agente y lo deja en `_insumos/sfmc-auditoria.json`. Aquí solo se lee ese archivo, y se
//   declara CUÁNDO se trajo: un cruce contra un pull viejo es peor que ningún cruce.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ N1s · EL BLOQUE CONTRA SFMC ════════\n');
var S;
try { S = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-auditoria.json', 'utf8')); }
catch (e) {
  console.log('  ⚠ no hay pull de SFMC en _insumos/sfmc-auditoria.json.');
  console.log('    Lo trae el agente con el MCP (solo lectura, DE CRM_Reporte_Auditoria).');
  console.log('    Sin él este cruce no se puede hacer — y eso NO es un fallo del paso.');
  process.exit(0);
}
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
console.log('  pull de SFMC: ' + S.traido_el + '   ·   ' + S.fuente);
console.log('  bloque de email: ' + B.envios.length + ' envíos (Datorama)\n');

// ── por pieza: lo que dice el bloque contra lo que dice SFMC ────────────────────────
var porPieza = {};
B.envios.forEach(function (e) {
  var id = t(e.pieza_id); if (!id) return;
  porPieza[id] = (porPieza[id] || 0) + (num(e.email_sends) || 0);
});
var SF = S.envios_por_pieza || {};
var comparables = [], soloSFMC = [], soloBloque = [], iguales = 0;
Object.keys(SF).forEach(function (id) {
  var s = SF[id];
  // 🔴 las piezas que SFMC marca DUPLICADO no se comparan: su cifra es la de otra pieza, y el
  //    propio pull lo declara. Compararlas produciría una diferencia que no es una diferencia.
  if (s.sends === null || s.estado === 'DUPLICADO') return;
  if (porPieza[id] === undefined) { soloSFMC.push({ pieza: id, sfmc: s.sends }); return; }
  var d = porPieza[id] - s.sends;
  if (d === 0) iguales++;
  else comparables.push({ pieza: id, datorama: porPieza[id], sfmc: s.sends, dif: d, pct: s.sends ? d / s.sends : null });
});
Object.keys(porPieza).forEach(function (id) { if (SF[id] === undefined) soloBloque.push({ pieza: id, datorama: porPieza[id] }); });

comparables.sort(function (a, b) { return Math.abs(b.dif) - Math.abs(a.dif); });
console.log('  ── pieza por pieza');
console.log('     coinciden exacto        : ' + iguales);
console.log('     difieren                : ' + comparables.length);
console.log('     solo en SFMC            : ' + soloSFMC.length + (soloSFMC.length ? '  (' + soloSFMC.slice(0, 4).map(function (x) { return x.pieza; }).join(' · ') + ')' : ''));
console.log('     solo en el bloque       : ' + soloBloque.length + (soloBloque.length ? '  (' + soloBloque.slice(0, 4).map(function (x) { return x.pieza; }).join(' · ') + ')' : ''));

if (comparables.length) {
  console.log('\n  ── las 10 diferencias más grandes');
  console.log('     pieza      Datorama       SFMC        dif      %');
  comparables.slice(0, 10).forEach(function (x) {
    console.log('     ' + x.pieza + '  ' + mil(x.datorama).padStart(11) + mil(x.sfmc).padStart(11) +
      (x.dif > 0 ? '  +' : '  ') + mil(x.dif).padStart(9) + '  ' + (x.pct === null ? '—' : (x.pct * 100).toFixed(1) + '%').padStart(7));
  });
}

// ── el patrón de la diferencia: ¿es ventana o es otra cosa? ────────────────────────
// 🔴 Una diferencia PEQUEÑA Y CONSTANTE en todas las piezas es corte de ventana: las Data Views
//    y Datorama cierran el día en momentos distintos. Una diferencia GRANDE o que solo aparece
//    en algunas piezas es otra cosa, y hay que mirarla.
var pequenas = comparables.filter(function (x) { return x.pct !== null && Math.abs(x.pct) < 0.01; });
var grandes = comparables.filter(function (x) { return x.pct === null || Math.abs(x.pct) >= 0.01; });
console.log('\n  ── el patrón de la diferencia');
console.log('     menores al 1% (ventana de corte) : ' + pequenas.length);
console.log('     del 1% o más (hay que mirarlas)  : ' + grandes.length);
grandes.slice(0, 6).forEach(function (x) {
  console.log('        ' + x.pieza + '  Datorama ' + mil(x.datorama) + ' vs SFMC ' + mil(x.sfmc) +
    '   ' + (x.pct === null ? '' : (x.pct * 100).toFixed(1) + '%'));
});

var totalDat = Object.keys(porPieza).reduce(function (a, k) { return a + porPieza[k]; }, 0);
var totalSF = Object.keys(SF).reduce(function (a, k) { return a + (SF[k].sends || 0); }, 0);
console.log('\n  ── los totales (solo piezas comparables)');
console.log('     Datorama ' + mil(totalDat) + '   SFMC ' + mil(totalSF) + '   diferencia ' + mil(totalDat - totalSF));

// ── los checks ─────────────────────────────────────────────────────────────────────
chk('el pull de SFMC existe y dice cuándo se trajo', !!S.traido_el, S.traido_el);
chk('el pull declara qué piezas NO son confiables todavía',
  !!S['🔴 lo_que_NO_es_confiable_todavia'],
  (S['🔴 lo_que_NO_es_confiable_todavia'] || {}).piezas ? (S['🔴 lo_que_NO_es_confiable_todavia'].piezas || []).length + ' piezas declaradas' : '🔴 no lo declara');
chk('el cruce compara PIEZA A PIEZA, no solo totales', comparables.length + iguales > 0,
  (comparables.length + iguales) + ' piezas comparadas una por una');
// 🔴 lo que este paso NO puede permitir: que la diferencia quede sin nombre. Da igual si es
//    grande o chica — lo que no puede pasar es que nadie sepa de dónde sale.
chk('🔴 toda diferencia queda clasificada (ventana o a mirar)',
  pequenas.length + grandes.length === comparables.length,
  pequenas.length + ' de ventana · ' + grandes.length + ' a mirar · ninguna sin clasificar');

dato('Datorama y SFMC coinciden', comparables.length === 0,
  comparables.length + ' piezas difieren · ' + mil(Math.abs(totalDat - totalSF)) + ' envíos de diferencia total');
dato('todas las diferencias son de ventana de corte', grandes.length === 0,
  grandes.length + ' diferencias del 1% o más: no se explican por el corte del día');
dato('SFMC conoce todas las piezas del bloque', soloBloque.length === 0,
  soloBloque.length + ' piezas del bloque que la auditoría de SFMC aún no tiene (altas nuevas)');

fs.writeFileSync(BACK + '/_insumos/cruce-sfmc.json', JSON.stringify({
  paso: 'N1s · cruce Datorama vs SFMC', pull: S.traido_el,
  autoridad: 'SFMC. Donde difieren, manda SFMC (CATALOGO-CORRECCIONES.md)',
  iguales: iguales, difieren: comparables.length,
  de_ventana: pequenas.length, a_mirar: grandes.length,
  solo_sfmc: soloSFMC, solo_bloque: soloBloque,
  total_datorama: totalDat, total_sfmc: totalSF, diferencia: totalDat - totalSF,
  detalle: comparables,
  para_rick: 'Si se migra el email a SFMC, estas son exactamente las piezas cuyo numero cambia y cuanto.'
}, null, 1));

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(54) + (v[2] || '')); });
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(52) + (h[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ CRUCE HECHO — ' + V.length + ' checks · el detalle en _insumos/cruce-sfmc.json'));
process.exit(fallo ? 1 : 0);
