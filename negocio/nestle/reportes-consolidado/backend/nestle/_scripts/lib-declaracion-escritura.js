// lib-declaracion-escritura · LA REGLA DURA DE PRE-ESCRITURA. Un skill no escribe si no declaró antes.
//
// 🔴 LA REGLA, DE RICK (26-ago): *«Solo el skill puede proceder y terminar cuando completa el loop
//    de pre-escritura. Si eso no pasa, el proceso genera muchos loops en la escritura siguiente,
//    para el script siguiente o para el skill siguiente. Tiene que ser una regla muy estricta.»*
//
// 🔴 POR QUÉ ES LA REGLA QUE CIERRA EL CICLO DE LOOPS. Sin declaración previa, el skill descubre
//    los problemas **mientras escribe** — y ahí ya es tarde: el archivo quedó a medias, el skill
//    siguiente hereda el desorden, y se vuelve a empezar. Con declaración previa, lo que se va a
//    escribir se puede revisar **antes** de tocar nada, y el que falla, falla sin dejar rastro.
//    Es la misma disciplina que ya funcionó con las celdas vacías: medir todo → decidir todo →
//    escribir una vez. Aquí se generaliza a todo skill que escriba.
//
// 🔴 QUÉ ES UNA DECLARACIÓN, y no es un archivo cualquiera:
//      · a QUÉ HOJA va a escribir
//      · con QUÉ GRANO (una fila por qué cosa) — el defecto del Qcart nació de no declararlo
//      · con QUÉ LLAVE ancla cada fila
//      · CUÁNTAS celdas espera tocar
//    Las cuatro, porque cada una sola deja pasar un defecto real que ya ocurrió.
//
// 🔴 Y NO LA VALIDA QUIEN ESCRIBE. La comprueba la guarda, antes de que el corte arranque.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var DIR = require('path').resolve(__dirname, '..') + '/_preescritura';

var CAMPOS = ['hoja', 'grano', 'llave', 'celdas_esperadas'];

/**
 * Deja la declaración de un skill antes de escribir.
 * @param skill   el skill dueño (sin el prefijo `crm-reporte-`)
 * @param script  el script de ejecución que va a escribir
 * @param tablas  [{ hoja, grano, llave, celdas_esperadas }]
 */
function declarar(skill, script, tablas) {
  if (!Array.isArray(tablas) || !tablas.length) {
    throw new Error('lib-declaracion-escritura: `' + script + '` intentó declarar sin ninguna tabla.\n' +
      '   Un skill que escribe declara SIEMPRE a qué hoja va, con qué grano y con qué llave.');
  }
  tablas.forEach(function (t, i) {
    var faltan = CAMPOS.filter(function (c) { return t[c] === undefined || t[c] === null || t[c] === ''; });
    if (faltan.length) {
      throw new Error('lib-declaracion-escritura: la tabla ' + (i + 1) + ' de `' + script + '` no declara: ' +
        faltan.join(', ') + '.\n   Los cuatro campos son obligatorios — cada uno tapa un defecto que ya ocurrió:\n' +
        '     hoja  · escribir a la hoja equivocada\n' +
        '     grano · agrupar el Qcart a un solo segmento y cuadrar igual\n' +
        '     llave · anclar a una columna que el propio escritor va a llenar\n' +
        '     celdas_esperadas · «0 celdas que cambiarían» leído como «ya está bien»');
    }
  });
  fs.mkdirSync(DIR, { recursive: true });
  var salida = {
    skill: skill, script: script,
    declarado: new Date(fs.statSync(DIR).mtime).toISOString().slice(0, 10),
    que_es: 'Lo que este skill VA a escribir, declarado ANTES de tocar el Excel.',
    regla: 'Rick, 26-ago: un skill no procede si no completó su loop de pre-escritura.',
    tablas: tablas
  };
  fs.writeFileSync(path.join(DIR, 'DECL-' + script.replace(/\.js$/, '') + '.json'), JSON.stringify(salida, null, 1));
  return salida;
}

/** ¿Este script dejó su declaración? Devuelve la declaración o null. */
function declaracionDe(script) {
  var p = path.join(DIR, 'DECL-' + script.replace(/\.js$/, '') + '.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

/** Los escritores del corte que NO declararon. Lo usa la guarda. */
function sinDeclarar(escritores) {
  return escritores.filter(function (s) { return !declaracionDe(s); });
}

module.exports = { declarar: declarar, declaracionDe: declaracionDe, sinDeclarar: sinDeclarar, CAMPOS: CAMPOS, DIR: DIR };
