// lib-esquema · L1 — LA LIBRERÍA DEL MODELO DE DATOS.
//
// 🔴 POR QUÉ EXISTE: hasta hoy cada script sabía «su» llave y la escribía a mano. Por eso el mismo
//    hecho se emparejaba distinto en cada lugar: resumen-regenerar cruzaba por identidad, PUERTA-2 por índice, A6b por
//    código… y cada vez que una llave cambiaba había que acordarse de todos los sitios. Aquí la
//    llave se PIDE, no se escribe.
//
//    Es la pareja de `lib-registro`: el registro dice **cómo se llama** una columna hoy; el esquema
//    dice **qué es** y **con qué se relaciona**. Uno resuelve nombres, el otro relaciones.
//
// 🔴 Y NO INVENTA: todo sale de `_contratos/esquema.json`, que nació verificado contra el archivo
//    real. Si algo no está declarado, esta librería **truena** en vez de adivinar — un default
//    silencioso es cómo se cuela una atribución equivocada.
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var RUTA = BACK + '/_contratos/esquema.json';
var t = function (v) { return String(v == null ? '' : v).trim(); };

var _E = null;
function esquema() {
  if (_E) return _E;
  if (!fs.existsSync(RUTA)) throw new Error('🔴 ESQUEMA · no existe ' + RUTA + '. Corre orquestador.1-esquema.js --escribir.');
  _E = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  return _E;
}

/** Normaliza igual que el registro de nombres, para comparar encabezados sin pelear por acentos. */
function nmz(v) {
  return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Las 12 columnas del prefijo dimensional, en su orden. */
function prefijo() { return esquema().prefijo_dimensional.slice(); }
function nombresPrefijo() { return prefijo().map(function (c) { return c.nombre; }); }

/** ¿Esta hoja lleva el prefijo? */
function llevaPrefijo(hoja) {
  var h = esquema().hojas[hoja];
  if (!h) throw new Error('🔴 ESQUEMA · la hoja «' + hoja + '» no está declarada. Agrégala a esquema.json antes de escribirle.');
  return !!h.prefijo;
}

/** La entidad que vive en una hoja, con su grano y su llave. */
function entidadDe(hoja) {
  var h = esquema().hojas[hoja];
  if (!h) throw new Error('🔴 ESQUEMA · hoja no declarada: «' + hoja + '»');
  var e = esquema().entidades[h.entidad];
  return { nombre: h.entidad, definicion: e || null, grano: (e && e.grano) || h.grano || '(no declarado)', escribe: h.escribe };
}

/**
 * La llave primaria de una hoja, como array de columnas.
 * 🔴 Se pide, no se escribe. Ese es el punto de esta librería.
 */
function llaveDe(hoja) {
  var e = entidadDe(hoja);
  if (!e.definicion || !e.definicion.llave_primaria)
    throw new Error('🔴 ESQUEMA · «' + hoja + '» no declara llave primaria. Sin llave no se puede actualizar sin duplicar.');
  return t(e.definicion.llave_primaria).split(/\s*\+\s*/);
}

/** Las llaves foráneas de una hoja: { columna: 'entidad a la que apunta' } */
function foraneas(hoja) {
  var e = entidadDe(hoja);
  return (e.definicion && e.definicion.foraneas) || {};
}

/** ¿Esta columna del prefijo admite N/A? */
function admiteNA(nombreCol) {
  var c = prefijo().filter(function (x) { return nmz(x.nombre) === nmz(nombreCol); })[0];
  return c ? !!c.na : true;   // fuera del prefijo, se permite: lo acota el contrato de cada hoja
}

/** Los tres estados de celda, para que un guardián los cite en vez de reinventarlos. */
function estados() { return esquema().estados_de_celda; }

/**
 * 🔴 LEER UNA CELDA CON LOS TRES ESTADOS. Al llenar el archivo con `N/A` y `PENDIENTE`, todo check
 *    que preguntaba «¿tiene dato?» con un simple `if (valor)` **empezó a leer «N/A» como un dato**.
 *    Pasó en el acto: el validador del catálogo reportó «21 EmailID que no existen en SFMC» — eran
 *    las piezas de WhatsApp, cuyo EmailID dice `N/A` a propósito.
 *
 *    Introducir un estado nuevo obliga a que TODOS los lectores lo conozcan. Por eso vive aquí y
 *    no en cada check.
 */
function esNA(v) { return t(v).toUpperCase() === 'N/A'; }
// 🔴 LOS DOS TOKENS SON EL MISMO ESTADO (15-sep-2026). El esquema declara tres estados de celda
//    —valor · `N/A` (no aplica) · pendiente (aplica y falta)— y el tercero se escribe de DOS
//    formas en el libro: `PENDIENTE` (133 celdas) y `POR DEFINIR` (57 en el catálogo, 11 en
//    Data_WhatsApp, 2 en Data_Email). Esta función solo reconocía la primera, así que
//    `esDato('POR DEFINIR')` devolvía **true**: un hueco declarado se leía como dato de verdad.
//    Lo destapó la prueba de `segmentoCanonico`, que con eso componía «Career Focused · POR
//    DEFINIR» como si fuera un segmento. Se arregla aquí y no en cada consumidor: si cada uno
//    escribe su propia lista de tokens, vuelve a faltar uno — que es exactamente lo que pasó.
function esPendiente(v) { var s = t(v).toUpperCase(); return s === 'PENDIENTE' || s === 'POR DEFINIR'; }
/** ¿Hay un dato de verdad? (ni vacío, ni N/A, ni PENDIENTE) */
function esDato(v) { return !!t(v) && !esNA(v) && !esPendiente(v); }
/** El valor si es un dato; '' si es vacío, N/A o PENDIENTE. Para sumar o comparar sin ensuciar. */
function dato(v) { return esDato(v) ? t(v) : ''; }

/**
 * 🔴 LEER UNA COLUMNA SIN ESCRIBIR SU NOMBRE. Al unificar el prefijo dimensional, media docena de
 *    columnas cambiaron de nombre (`Quincena_Lanzamiento` → `Quincena`, `Touchpoint` → `TouchPoint`,
 *    `pieza_id` → `Pieza_ID`) y **todo script que hardcodeaba el viejo se rompió en silencio**: el
 *    motor empezó a leer `undefined` y dos envíos de WhatsApp dejaron de llegar al reporte.
 *
 *    `campo(fila, 'Quincena', 'Quincena_Lanzamiento')` devuelve el primero que exista. No es un
 *    parche: es la misma idea del registro de nombres —el nombre físico se pide— aplicada a leer
 *    una fila suelta, donde no hay encabezados a mano.
 */
function campo(fila) {
  for (var i = 1; i < arguments.length; i++) {
    var n = arguments[i];
    if (fila && fila[n] !== undefined && t(fila[n]) !== '') return fila[n];
  }
  // último intento: comparar normalizado, por si cambió solo la capitalización
  if (fila) {
    for (var j = 1; j < arguments.length; j++) {
      var buscado = nmz(arguments[j]);
      var k = Object.keys(fila).filter(function (c) { return nmz(c) === buscado; })[0];
      if (k && t(fila[k]) !== '') return fila[k];
    }
  }
  return '';
}

/**
 * Compara el prefijo declarado contra los encabezados REALES de una hoja.
 * Devuelve qué falta, qué sobra al inicio y si el orden coincide — sin tocar nada.
 */
function revisarPrefijo(hoja, encabezados) {
  if (!llevaPrefijo(hoja)) return { aplica: false };
  var enc = (encabezados || []).map(nmz);
  var quiere = nombresPrefijo();
  var faltan = quiere.filter(function (n) { return enc.indexOf(nmz(n)) < 0; });
  var posiciones = quiere.map(function (n) { return enc.indexOf(nmz(n)); });
  var presentes = posiciones.filter(function (p) { return p >= 0; });
  var enOrden = presentes.every(function (p, i) { return i === 0 || p > presentes[i - 1]; });
  var alInicio = presentes.length ? Math.max.apply(null, presentes) < quiere.length + 2 : false;
  return { aplica: true, faltan: faltan, en_orden: enOrden, al_inicio: alInicio,
    completo: faltan.length === 0 && enOrden && alInicio };
}

/** La deuda declarada del esquema — un guardián debe exigir que esté vacía antes de publicar. */
function deuda() { return esquema().deuda_conocida || []; }

/** Todas las hojas declaradas. */
function hojas() { return Object.keys(esquema().hojas); }

/**
 * El SEGMENTO CANÓNICO de una pieza: su segmento, y su subsegmento pegado detrás con « · »
 * cuando lo hay y no está ya dicho.
 *
 * 🔴 VIVE AQUÍ PORQUE ANTES VIVÍA EN TRES SITIOS Y FALTABA EN UN CUARTO (15-sep-2026).
 *    La misma línea estaba copiada a mano en `fuentes-email.email-piezas.js`, `motor.motor.js` y
 *    `motor.validar.js` — y el bloque de Qcart no la tenía. Mientras las piezas nuevas no
 *    llegaban a las hojas crudas nadie lo notaba; en cuanto el escritor empezó a dar de alta esas
 *    filas, el mismo `pieza_id` apareció como «Región unificada · Partición A» en Data_Email y
 *    como «Región unificada» en Data_Qcart, y el guardián de canónicos lo cazó.
 *    La regla del sistema ya decía «una sola escalera: nadie reimplementa el normalizador»; esto
 *    la cumple para el subsegmento, que se había quedado fuera.
 *
 * 🔴 Y las tres condiciones NO son adorno, cada una nació de un defecto:
 *    · `esDato(sub)` — `N/A` no es un subsegmento, es la declaración de que no aplica. Tratarlo
 *      como dato sacaba 92 de 98 envíos como «Career Focused — N/A».
 *    · `indexOf(' · ') < 0` — si el segmento ya viene compuesto, no se compone otra vez.
 *    · `indexOf(sub) < 0` — Pro Plan ya trae la especie dentro («… · Gatos»); pegarla detrás no
 *      agrega nada y parte el mismo segmento en dos al agrupar.
 */
function segmentoCanonico(segmento, subsegmento) {
  var s = String(segmento == null ? '' : segmento).trim();
  var sub = String(subsegmento == null ? '' : subsegmento).trim();
  if (!esDato(sub)) return s;
  if (s.indexOf(' · ') >= 0 || s.indexOf(sub) >= 0) return s;
  return s + ' · ' + sub;
}

module.exports = {
  segmentoCanonico: segmentoCanonico,
  esquema: esquema, prefijo: prefijo, nombresPrefijo: nombresPrefijo, llevaPrefijo: llevaPrefijo,
  entidadDe: entidadDe, llaveDe: llaveDe, foraneas: foraneas, admiteNA: admiteNA,
  estados: estados, revisarPrefijo: revisarPrefijo, deuda: deuda, hojas: hojas, nmz: nmz, RUTA: RUTA,
  esNA: esNA, esPendiente: esPendiente, esDato: esDato, dato: dato, campo: campo
};
