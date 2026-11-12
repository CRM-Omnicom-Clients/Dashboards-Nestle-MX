// lib-vacios · CÓMO SE DECIDE QUÉ VA EN UNA CELDA VACÍA. Una sola regla, para los 12 skills.
//
// 🔴 POR QUÉ NO ES UN BARRIDO. La primera versión de la etapa 3 era un script global que recorría
//    las 10 hojas rellenando huecos. Rick lo paró: «no escribas por escribir; tiene que revisarlo
//    el skill correspondiente en el script correspondiente». Tenía razón, y no es un matiz —
//    un barrido decide sin saber de qué columna se trata:
//      · `FUP_Sends` vacío en una fila sin FUP **no aplica** → `N/A`, y la razón se puede escribir.
//      · `Sends` vacío en una pieza de Liga MX **sí aplica y lo debemos** → `POR DEFINIR`.
//    Los dos son «una celda vacía». Rellenarlos igual borra la diferencia, y con ella la señal de
//    qué falta — que es justo lo que la lista para Rick tiene que decir.
//
// 🔴 LA REGLA, EN UNA FRASE: **`N/A` solo si se puede ESCRIBIR la razón.** Si nadie declaró por qué
//    esa columna no aplica en esa fila, no es `N/A`: es `POR DEFINIR`. El default es deber, no
//    despachar. Llenar de `N/A` cerraría el archivo y dejaría a Rick sin saber qué le falta.
//
// 🔴 Y LA DECISIÓN SE PRE-ESCRIBE, no se aplica. Cada skill deja su tabla en `_preescritura/` y el
//    escritor la aplica después: así se puede revisar ANTES de tocar el Excel, que es el orden que
//    la fundación exige (atribuir → organizar → llenar).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var os = require('os');
var E = require(__dirname + '/lib-esquema.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };

// 🔴 EL TOKEN VISIBLE ES EL DE RICK. La fundación llama a este estado `PENDIENTE` y hay checks
//    colgados de esa palabra; Rick pidió `POR DEFINIR` — es su reporte y es más claro para quien
//    lo lee. Se escribe `POR DEFINIR` y los lectores reconocen las dos, para no romper lo que ya
//    vigila. Un cambio de vocabulario que rompe los guardianes no es un cambio de vocabulario.
var POR_DEFINIR = 'POR DEFINIR';
var NA = 'N/A';
function esPorDefinir(v) { var s = t(v).toUpperCase(); return s === 'POR DEFINIR' || s === 'PENDIENTE'; }
function esNA(v) { return t(v).toUpperCase() === 'N/A'; }
// los DOS textos del mismo estado: «aplica y falta». El libro usa las dos formas.
function esPendienteTexto(v) { var s = t(v).toUpperCase(); return s === 'POR DEFINIR' || s === 'PENDIENTE'; }
function esDato(v) { return !!t(v) && !esNA(v) && !esPorDefinir(v); }

/**
 * Decide qué va en una celda vacía.
 *
 * @param hoja     nombre de la hoja
 * @param columna  nombre físico de la columna
 * @param fila     la fila entera — hace falta: si aplica o no puede depender de OTRA columna
 * @param reglas   las que declara el skill dueño: { '<columna>': fn(fila) -> razón | null }
 *                 devolver una razón = «no aplica, y ésta es la razón» → `N/A`
 *                 devolver null      = «sí aplica y lo debemos»        → `POR DEFINIR`
 * @returns { valor, razon, declarada }
 */
function decidir(hoja, columna, fila, reglas) {
  var r = (reglas || {})[columna];
  if (typeof r === 'function') {
    var razon = r(fila);
    if (razon) return { valor: NA, razon: t(razon), declarada: true };
    return { valor: POR_DEFINIR, razon: 'la regla del skill dice que SÍ aplica en esta fila', declarada: true };
  }
  // sin regla del skill: se pregunta al esquema, que declara el prefijo
  if (E.admiteNA && E.admiteNA(columna) === false) {
    return { valor: POR_DEFINIR, razon: 'el esquema declara que esta columna NO admite N/A: es una dimensión que debe tener valor', declarada: true };
  }
  // 🔴 NADIE LO DECLARÓ. No se despacha con `N/A`: se debe.
  return { valor: POR_DEFINIR, razon: 'nadie declaró por qué esta columna podría no aplicar — sin razón escribible no es N/A', declarada: false };
}

/**
 * Recorre una hoja y decide TODAS sus celdas vacías. Devuelve la tabla lista para pre-escribir.
 * No escribe nada.
 */
function revisar(hoja, filas, encabezados, reglas, opciones) {
  var op = opciones || {};
  var saltar = op.saltarColumnas || [];
  var out = [], resumen = {};
  filas.forEach(function (f, i) {
    if (op.saltarFila && op.saltarFila(f)) return;
    encabezados.forEach(function (c) {
      if (!c || saltar.indexOf(c) >= 0) return;
      var actual = t(f[c]);
      // 🔴 RECONSIDERAR UN «POR DEFINIR» VA EN UNA SOLA DIRECCIÓN (15-sep-2026).
      //    Este barrido solo miraba celdas VACÍAS, y está bien: una celda ya decidida no se
      //    revisa a espaldas de nadie. Pero cuando una REGLA se corrige, las celdas que decidió
      //    mal se quedan mal para siempre — pasó con `Aud_Filtros`/`Aud_Final`: la regla
      //    concluía que el embudo «se debe» porque la fila traía `Aud_Original`, y resulta que esa
      //    columna sale del total inicial que traen TODAS las hojas. Seis celdas quedaron
      //    esperando un dato que la fuente no tiene.
      //    Con `reconsiderarPendientes` se vuelven a visitar, y SOLO se cambian si la regla ahora
      //    sabe ESCRIBIR la razón: `POR DEFINIR` → `N/A`. Nunca al revés, nunca sobre un dato.
      //    Es la regla de Rick —«lo que ya se definió no regresa a POR DEFINIR»— cumplida por
      //    construcción: este camino no puede producir un POR DEFINIR nuevo.
      var reconsidera = op.reconsiderarPendientes && esPendienteTexto(actual);
      if (actual !== '' && !reconsidera) return;        // ya tiene algo (dato, N/A o POR DEFINIR)
      var d = decidir(hoja, c, f, reglas);
      if (reconsidera && d.valor !== NA) return;        // sigue debiéndose: se queda como está
      out.push({ fila: i + 2, columna: c, valor: d.valor, razon: d.razon, declarada: d.declarada, reconsiderada: !!reconsidera, antes: actual });
      var k = c + ' → ' + d.valor;
      resumen[k] = (resumen[k] || 0) + 1;
    });
  });
  return {
    hoja: hoja, celdas: out, resumen: resumen,
    na: out.filter(function (x) { return x.valor === NA; }).length,
    porDefinir: out.filter(function (x) { return x.valor === POR_DEFINIR; }).length,
    sinDeclarar: out.filter(function (x) { return !x.declarada; }).length
  };
}

/** las columnas que quedaron en POR DEFINIR, agrupadas — es la lista que se le entrega a Rick */
function listaParaRick(revisiones) {
  var por = {};
  revisiones.forEach(function (r) {
    r.celdas.filter(function (x) { return x.valor === POR_DEFINIR; }).forEach(function (x) {
      var k = r.hoja + '¦' + x.columna;
      if (!por[k]) por[k] = { hoja: r.hoja, columna: x.columna, filas: 0, razon: x.razon, declarada: x.declarada };
      por[k].filas++;
    });
  });
  return Object.keys(por).map(function (k) { return por[k]; })
    .sort(function (a, b) { return b.filas - a.filas; });
}

module.exports = {
  decidir: decidir, revisar: revisar, listaParaRick: listaParaRick,
  POR_DEFINIR: POR_DEFINIR, NA: NA,
  esPorDefinir: esPorDefinir, esNA: esNA, esDato: esDato
};
