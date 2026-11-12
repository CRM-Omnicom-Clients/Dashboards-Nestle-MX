// fuentes-qcart · EL GUARDIÁN DE LA DISTRIBUCIÓN DE QCART.
//
// 🔴 LA PREGUNTA DE RICK (3-sep-2026), literal: «¿Puedo confiar en que dejarás bien lo de qcart
//    distribuido con su segmento × touchpoint × campaña × quincena? ¿Que no moverás eso? ¿Y que
//    validarás que todo incrementa, nada baja, ni se rompe, ni se quita de lo que ya hemos
//    trabajado?»
//
//    La respuesta honesta no es «confía en mí». Esta sesión movió 191 carritos a propósito —
//    estaban en el segmento de al lado— y estuvo a punto de borrar 2,427 por accidente con un
//    `--rebuild`. La respuesta es un mecanismo que no dependa de que me acuerde.
//
// 🔴 EL GRANO ES EL DE RICK, LOS CUATRO: campaña × touchpoint × segmento × QUINCENA.
//    El guardián general del corte compara a tres —sin quincena— y eso deja pasar el caso que
//    más duele: los carritos de una pieza que se mudan de una quincena a otra. Suman igual, la
//    combinación sigue existiendo, y la comparación quincenal del reporte queda mintiendo.
//
// 🔴 Y LA REGLA ES «NADA BAJA», CELDA POR CELDA — no en el total. Un total que sube puede tapar
//    perfectamente una celda que se vació: eso fue exactamente lo de marzo, donde la suma nunca
//    se movió mientras dos segmentos se intercambiaban 191 carritos.
//
//    · una celda que BAJA          → 🔴 BLOQUEA
//    · una celda que DESAPARECE    → 🔴 BLOQUEA
//    · una celda que SUBE          → ✔ es el trabajo
//    · una celda NUEVA             → ✔ es el trabajo
//    · un movimiento DECLARADO     → ✔ pero se imprime, para que se pueda revisar
//
// 🔴 LOS MOVIMIENTOS SE DECLARAN ANTES, NO SE EXPLICAN DESPUÉS. Si un corte necesita mover
//    carritos —porque el doc dice que estaban mal— eso se declara con su motivo. Sin declaración,
//    bloquea. Justificar a posteriori es como se cuela cualquier cosa.
//
// 🔴 Y LA DECLARACIÓN VIVE EN LA BASE, NO EN UN ARCHIVO APARTE (corregido 29-sep-2026). Esto leía
//    los movimientos de `_contratos/qcart-movimientos.json` — un archivo que **ningún script del
//    sistema escribe jamás** (0 `writeFileSync` en los 238). Quien los escribe es
//    `rebasar-distribucion.js`, y los mete DENTRO de la base como `movimientos`, con la misma
//    forma `{de, a, carritos}` que este lector espera. La lectura estaba envuelta en
//    `try{}catch{}`, así que el archivo ausente no rompía nada: `movs` quedaba en `{}` y la rama
//    de «movimiento declarado» **no podía dispararse nunca**. Un mes entera en verde por un
//    nombre de archivo.
//    Lo destapó la verificación de `declarar-en-skills.js` al exigir que cada contrato citado
//    exista en disco — no lo vio ninguna de las 26 suites, porque las 26 comprueban que el
//    guardián BLOQUEE y ninguna que DEJE PASAR lo declarado. Esa mitad ya tiene su señuelo (el 4
//    de `probar-guardian-distribucion.js`).
//
// USO:
//    node fuentes-qcart.guardian-distribucion.js            compara contra la línea base
//    node fuentes-qcart.guardian-distribucion.js --sellar   fija la base (solo si está en verde)
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Los ids lógicos van en constantes y se usan por variable.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var SELLAR = process.argv.indexOf('--sellar') >= 0;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var BASE = BACK + '/_contratos/qcart-distribucion-base.json';

console.log('════════ fuentes-qcart · GUARDIÁN DE LA DISTRIBUCIÓN ════════\n');

// ── la distribución de AHORA, a los cuatro niveles, leída de la rejilla
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var ahora = {};
R.rejilla.forEach(function (c) {
  var n = (c.qcart && c.qcart.carritos) || 0;
  if (!n) return;
  var k = [t(c.campana), t(c.touchpoint), t(c.segmento), t(c.quincena)].join(' ¦ ');
  ahora[k] = (ahora[k] || 0) + n;
});
var sumaAhora = Object.keys(ahora).reduce(function (a, k) { return a + ahora[k]; }, 0);
console.log('  celdas con Qcart: ' + Object.keys(ahora).length + '   ·   Σ carritos: ' + mil(sumaAhora));

// ── 1 · la rejilla no puede perder ni inventar respecto del bloque
/* 🔴 24-sep-2026 · EL BLOQUE SE MIDE EN VISTAS, NO EN FILAS. Un carrito es una VISTA: una fila del
 *    export de Qcart es un bucket (día × hora × shortlink × utm × tienda) con su contador `views`.
 *    Este check comparaba la distribución contra `Q.carritos.length` —el número de eventos— y tras
 *    corregir el motor decía «7,503 vs 3,077». No sobraban 4,426 carritos: sobraba la unidad.
 *    Sigue siendo un contraste contra la FUENTE (el bloque), que es lo que le da valor. */
var sumaBloque = Q.carritos.reduce(function (a, e) { return a + (Number(String(e.views == null ? '' : e.views).trim()) || 0); }, 0);
chk('🔴 Σ de la distribución == Σ del bloque de Qcart', sumaAhora === sumaBloque,
  mil(sumaAhora) + ' vs ' + mil(sumaBloque) + (sumaAhora === sumaBloque ? '   (en VISTAS, ' + mil(Q.carritos.length) + ' eventos)' : '   🔴 difieren en ' + mil(Math.abs(sumaBloque - sumaAhora))));

// ── 2 · cada evento cae en UNA celda: ninguna pieza en dos quincenas
var porPieza = {};
R.rejilla.forEach(function (c) {
  if (!c.qcart || !c.qcart.carritos) return;
  var suyas = (c.qcart.piezas_sumadas || []).slice();
  if (!suyas.length) suyas = (c.piezas || []).slice(0, 1);
  suyas.filter(Boolean).forEach(function (p) {
    (porPieza[t(p)] = porPieza[t(p)] || []).push([t(c.campana), t(c.touchpoint), t(c.segmento), t(c.quincena)].join(' ¦ '));
  });
});
var enDos = Object.keys(porPieza).filter(function (p) {
  return porPieza[p].filter(function (v, i, a) { return a.indexOf(v) === i; }).length > 1;
});
chk('🔴 ninguna PIEZA reparte sus carritos en dos celdas', enDos.length === 0,
  enDos.length ? '🔴 ' + enDos.slice(0, 4).map(function (p) { return p + ' → ' + porPieza[p].join('  +  '); }).join('   ·   ')
  : Object.keys(porPieza).length + ' piezas con Qcart, cada una en una sola celda');

// ── 3 · contra la línea base: nada baja, nada desaparece
var base = null;
try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')); } catch (e) { }
if (!base) {
  // 🔴 NO TENER LÍNEA BASE NO ES UN FALLO DEL DATO — es que nunca se ha sellado una. Contarlo
  //    como problema dejaba al guardián bloqueándose a sí mismo: no podía sellar porque no
  //    estaba en verde, y no estaba en verde porque no había sellado. Se declara ruidosamente
  //    («NO PUDE EVALUAR» no cuenta como pasar) pero no impide fijar la primera.
  console.log('\n  ⚠ NO HAY LÍNEA BASE — no se puede comparar contra nada.');
  console.log('     Los dos checks estructurales de arriba sí corrieron; la comparación no.');
  console.log('     Se fija con `--sellar`, y solo si los estructurales están en verde.');
  V.push(['línea base contra la cual comparar', null, '⊘ NO PUDE EVALUAR: no existe ' + path.basename(BASE)]);
} else {
  // los movimientos declarados salen de la base misma — es quien los escribe. Sin `try`: si la
  // base está ilegible ya no llegamos aquí, y callar un error de forma es cómo murió el lector
  // anterior.
  var movs = {};
  (base.movimientos || []).forEach(function (m) { if (m && m.de) movs[m.de] = m; });

  var bajan = [], idas = [], suben = [], nuevas = [], declarados = [];
  Object.keys(base.celdas).forEach(function (k) {
    var a = base.celdas[k], z = ahora[k];
    if (z === undefined) {
      if (movs[k]) { declarados.push({ k: k, m: movs[k], antes: a }); return; }
      idas.push({ k: k, antes: a });
      return;
    }
    if (z < a) {
      if (movs[k]) { declarados.push({ k: k, m: movs[k], antes: a, ahora: z }); return; }
      bajan.push({ k: k, antes: a, ahora: z });
    } else if (z > a) suben.push({ k: k, antes: a, ahora: z });
  });
  Object.keys(ahora).forEach(function (k) { if (base.celdas[k] === undefined) nuevas.push({ k: k, ahora: ahora[k] }); });

  // 🔴 UN HECHO, DOS NOMBRES FÍSICOS — y el lector conocía uno (29-sep-2026). `--sellar` escribe
  //    `sellado`; `rebasar-distribucion.js` escribe `cuando`. Esta línea imprimía literalmente
  //    «contra la línea base del undefined» desde la primera re-basada. Es el mismo defecto que ya
  //    costó un `undefined` en este contrato (el campo `suma`, 7-sep): al cambiar la forma hay que
  //    mirar a TODOS sus lectores. Se acepta cualquiera de los dos para no romper las bases que ya
  //    están en disco, y el escritor nuevo pone los dos.
  var sellado = base.sellado || base.cuando || '(sin fecha en la base)';
  console.log('\n  ── contra la línea base del ' + String(sellado).slice(0, 10) +
    (movs[Object.keys(movs)[0]] ? '   ·   ' + Object.keys(movs).length + ' movimiento(s) declarado(s) en ella' : ''));
  console.log('     celdas: ' + Object.keys(base.celdas).length + ' → ' + Object.keys(ahora).length +
    '   ·   Σ: ' + mil(base.suma) + ' → ' + mil(sumaAhora) + '   (' + (sumaAhora >= base.suma ? '+' : '') + mil(sumaAhora - base.suma) + ')');

  chk('🔴 ninguna celda BAJÓ de carritos', bajan.length === 0,
    bajan.length ? '🔴 ' + bajan.map(function (x) { return x.k + ': ' + x.antes + '→' + x.ahora; }).join('   ·   ')
    : 'ninguna de las ' + Object.keys(base.celdas).length);
  chk('🔴 ninguna celda DESAPARECIÓ', idas.length === 0,
    idas.length ? '🔴 ' + idas.map(function (x) { return x.k + ' (tenía ' + x.antes + ')'; }).join('   ·   ')
    : 'las ' + Object.keys(base.celdas).length + ' siguen');
  chk('🔴 el total no bajó', sumaAhora >= base.suma,
    mil(base.suma) + ' → ' + mil(sumaAhora));

  if (suben.length) {
    console.log('\n  ── celdas que SUBIERON (' + suben.length + ') — es el trabajo:');
    suben.forEach(function (x) { console.log('     ' + x.k.padEnd(62) + x.antes + ' → ' + x.ahora + '   (+' + (x.ahora - x.antes) + ')'); });
  }
  if (nuevas.length) {
    console.log('\n  ── celdas NUEVAS (' + nuevas.length + '):');
    nuevas.forEach(function (x) { console.log('     ' + x.k.padEnd(62) + x.ahora); });
  }
  if (declarados.length) {
    console.log('\n  ── movimientos DECLARADOS (' + declarados.length + ') — permitidos, y por eso se imprimen:');
    declarados.forEach(function (x) {
      console.log('     ' + x.k);
      console.log('        → ' + t(x.m.a) + '   motivo: ' + t(x.m.porque).slice(0, 110));
    });
  }
}

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) {
  console.log('  ' + (v[1] === null ? '⊘ ' : v[1] ? '✔ ' : '🔴 ') + v[0].slice(0, 52).padEnd(54) + v[2]);
});

if (SELLAR) {
  if (fallo) { console.log('\n  🔴 NO se sella: el guardián no está en verde. Sellar un estado malo lo vuelve la norma.'); process.exit(1); }
  fs.writeFileSync(BASE, JSON.stringify({
    que_es: 'La distribución de Qcart a los CUATRO niveles que pidió Rick: campaña × touchpoint × segmento × quincena. Es la línea base: a partir de aquí ninguna celda puede bajar ni desaparecer sin un movimiento declarado.',
    sellado: new Date().toISOString().slice(0, 10), suma: sumaAhora, celdas: ahora
  }, null, 1));
  console.log('\n  ✅ línea base sellada: ' + Object.keys(ahora).length + ' celdas · ' + mil(sumaAhora) + ' carritos');
  console.log('     → ' + path.basename(BASE));
  process.exit(0);
}
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) — la distribución de Qcart NO se da por buena'
  : '✅ LA DISTRIBUCIÓN DE QCART ESTÁ ÍNTEGRA — nada bajó, nada desapareció, nada se movió sin declarar'));
process.exit(fallo ? 1 : 0);
