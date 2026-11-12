// lib-preescritura · L0 — LA TABLA PREVIA. Fundación: ningún skill la reimplementa.
//
// 🔴 RICK, y es el hueco que faltaba: «los skills que no escriben datos en el Excel sí tienen que
//    escribir datos en algún lado y tener sus tablas en algún JSON o MD, previo a que el escritor
//    pase al Excel. Y esa pre-escritura tiene que estar alineada con el insumo al que van a llegar».
//
// 🔴 QUÉ RESUELVE. Hoy un skill de fuente arma su bloque con la forma de la FUENTE, y la traducción
//    a la forma de la HOJA ocurre dentro del escritor, tarde y sin que nadie la revise. Por eso el
//    grano se decidía en el motor (el defecto F1). La pre-escritura mueve esa traducción hacia
//    adelante: el skill entrega su tabla **ya con las columnas de la hoja destino, en su orden**, y
//    el escritor solo transcribe.
//
// 🔴 Y SE PUEDE REVISAR ANTES DE TOCAR EL EXCEL: el `.md` se lee como una tabla y el `.json` se
//    compara contra el contrato de escritura. Si un skill declaró que escribe 14 columnas y su
//    tabla trae 9, se ve **antes**, no después de haber escrito.
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var DIR = BACK + '/_preescritura';
var t = function (v) { return String(v == null ? '' : v).trim(); };

function asegurarDir() { try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) { } }

/**
 * Prepara la tabla de un skill para UNA hoja destino.
 *
 * @param opt.skill     quién la produce ('email', 'qcart', 'catalogo'…)
 * @param opt.hoja      la hoja destino
 * @param opt.columnas  las columnas de la hoja, EN SU ORDEN (se piden a la hoja real)
 * @param opt.filas     array de objetos { columna: valor }
 * @param opt.llave     con qué se empareja para actualizar sin duplicar
 * @param opt.grano     qué es una fila, en una frase
 * @param opt.ancla     (opcional) cómo se pega si el grano de la fuente ≠ el de la hoja
 * @param opt.no_toca   qué columnas NO son suyas
 */
function preparar(opt) {
  ['skill', 'hoja', 'columnas', 'filas', 'llave', 'grano'].forEach(function (k) {
    if (opt[k] === undefined) throw new Error('🔴 PREESCRITURA · falta «' + k + '». Una tabla previa sin ' + k + ' no se puede revisar.');
  });
  var cols = opt.columnas.map(t);
  // 🔴 toda columna que la tabla trae y la hoja NO tiene es un error que se ve AHORA
  var inventadas = {};
  opt.filas.forEach(function (f) {
    Object.keys(f).forEach(function (c) { if (cols.indexOf(t(c)) < 0) inventadas[t(c)] = 1; });
  });
  if (Object.keys(inventadas).length) {
    throw new Error('🔴 PREESCRITURA · ' + opt.skill + ' → ' + opt.hoja + ': trae columnas que la hoja no tiene: ' +
      Object.keys(inventadas).join(', ') + '.\n   La tabla previa debe tener la forma de la hoja destino, no la de la fuente.');
  }
  // se ordenan las claves como la hoja: así el escritor transcribe sin decidir nada
  var filas = opt.filas.map(function (f) {
    var o = {};
    cols.forEach(function (c) { if (f[c] !== undefined) o[c] = f[c]; });
    return o;
  });
  // qué columnas llenó de verdad
  var llenas = {};
  filas.forEach(function (f) { Object.keys(f).forEach(function (c) { if (t(f[c]) !== '') llenas[c] = (llenas[c] || 0) + 1; }); });
  return {
    skill: opt.skill, hoja: opt.hoja, grano: opt.grano, llave: opt.llave,
    ancla: opt.ancla || null, no_toca: opt.no_toca || [],
    columnas_de_la_hoja: cols,
    columnas_que_escribe: Object.keys(llenas),
    filas: filas, n_filas: filas.length,
    cobertura: Object.keys(llenas).map(function (c) { return { columna: c, llenas: llenas[c], de: filas.length }; })
  };
}

/** Guarda la tabla previa de un skill: el JSON que se compara y el MD que se lee. */
function guardar(skill, tablas, notas) {
  asegurarDir();
  var doc = {
    skill: skill, fecha: '2026-08-24',
    que_es: 'La tabla previa: lo que este skill VA a escribir, ya con la forma de cada hoja destino.',
    por_que: 'Mueve la traduccion fuente->hoja hacia adelante, para que se pueda revisar ANTES de tocar el Excel. Antes ocurria dentro del escritor, tarde y sin revision.',
    notas: notas || '',
    tablas: tablas
  };
  fs.writeFileSync(DIR + '/' + skill + '.json', JSON.stringify(doc, null, 1));
  fs.writeFileSync(DIR + '/' + skill + '.md', comoMD(doc));
  return { json: DIR + '/' + skill + '.json', md: DIR + '/' + skill + '.md' };
}

/** El MD legible — se lee como una tabla, no como un volcado. */
function comoMD(doc) {
  var L = [];
  L.push('# Pre-escritura · `' + doc.skill + '`');
  L.push('');
  L.push('> ' + doc.que_es);
  L.push('> **Generado. No se edita a mano.**');
  L.push('');
  if (doc.notas) { L.push(doc.notas); L.push(''); }
  doc.tablas.forEach(function (T) {
    L.push('## → `' + T.hoja + '`  ·  ' + T.n_filas + ' fila(s)');
    L.push('');
    L.push('| | |');
    L.push('|---|---|');
    L.push('| **Grano** | ' + T.grano + ' |');
    L.push('| **Llave** | `' + T.llave + '` |');
    if (T.ancla) L.push('| **Ancla** | ' + T.ancla + ' |');
    L.push('| **Escribe** | ' + T.columnas_que_escribe.length + ' de las ' + T.columnas_de_la_hoja.length + ' columnas de la hoja |');
    L.push('| **NO toca** | ' + (T.no_toca.length ? T.no_toca.join(' · ') : '—') + ' |');
    L.push('');
    L.push('### Cobertura por columna');
    L.push('');
    L.push('| Columna | Con dato | De |');
    L.push('|---|---:|---:|');
    T.cobertura.forEach(function (c) { L.push('| `' + c.columna + '` | ' + c.llenas + ' | ' + c.de + ' |'); });
    L.push('');
    // una muestra, para poder mirarla
    L.push('### Muestra — las 5 primeras');
    L.push('');
    var muestra = T.filas.slice(0, 5);
    if (muestra.length) {
      var cols = T.columnas_que_escribe.slice(0, 8);
      L.push('| ' + cols.join(' | ') + ' |');
      L.push('|' + cols.map(function () { return '---'; }).join('|') + '|');
      muestra.forEach(function (f) {
        L.push('| ' + cols.map(function (c) { return String(f[c] === undefined ? '' : f[c]).slice(0, 28); }).join(' | ') + ' |');
      });
    }
    L.push('');
  });
  return L.join('\n');
}

/**
 * 🔴 VERIFICA la tabla previa contra el CONTRATO DE ESCRITURA.
 *    Un contrato que nadie contrasta es prosa; una tabla que nadie compara es un volcado.
 */
function verificar(skill) {
  var ruta = DIR + '/' + skill + '.json';
  if (!fs.existsSync(ruta)) return { existe: false, fallas: ['no hay tabla previa para «' + skill + '»'] };
  var doc = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/escritura.json', 'utf8'));
  var contrato = (C.fuentes || {})[skill];
  var fallas = [], avisos = [];
  if (!contrato) return { existe: true, fallas: ['«' + skill + '» no tiene contrato de escritura'] };

  Object.keys(contrato.escribe_en).forEach(function (hoja) {
    var T = doc.tablas.filter(function (x) { return x.hoja === hoja; })[0];
    if (!T) { avisos.push('el contrato declara «' + hoja + '» y la tabla previa no la trae'); return; }
    var declaradas = (contrato.escribe_en[hoja].columnas || []).map(t);
    if (!declaradas.length) return;
    var faltan = declaradas.filter(function (c) { return T.columnas_que_escribe.indexOf(c) < 0; });
    var demas = T.columnas_que_escribe.filter(function (c) { return declaradas.indexOf(c) < 0; });
    if (faltan.length) avisos.push(hoja + ': declaró ' + declaradas.length + ' columnas y la tabla llena ' +
      (declaradas.length - faltan.length) + ' — faltan ' + faltan.join(', '));
    // 🔴 esto SÍ es falla: escribir una columna que el contrato no le da
    if (demas.length) fallas.push(hoja + ': escribe columnas que su contrato NO le asigna: ' + demas.join(', '));
  });
  return { existe: true, fallas: fallas, avisos: avisos, tablas: doc.tablas.length };
}

/** Los skills que ya tienen tabla previa. */
function quienes() {
  asegurarDir();
  return fs.readdirSync(DIR).filter(function (f) { return /\.json$/.test(f); }).map(function (f) { return f.replace('.json', ''); });
}

module.exports = { preparar: preparar, guardar: guardar, verificar: verificar, quienes: quienes, comoMD: comoMD, DIR: DIR };
