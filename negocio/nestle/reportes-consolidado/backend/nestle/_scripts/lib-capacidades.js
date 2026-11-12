// lib-capacidades · LOS VERBOS QUE LOS SKILLS INVOCAN. Fase 4 de la migración de scripts.
//
// 🔴 POR QUÉ EXISTE, MEDIDO. En los 93 scripts vivos hay **351 copias del mismo puñado de gestos**:
//      56 escriben su propia función `t()`   ← y `lib-flexible` ya la exporta
//      55 abren el libro vivo a mano
//      49 leen las filas de una hoja
//      33 tienen su propio registrador de checks
//      32 formatean números
//      30 leen un bloque de fuente
//      26 leen un número con comas
//      11 publican con las 5 capas
//      ...y solo **8 releen el archivo para verificar lo que escribieron**
//
//    Esa última asimetría es el sistema entero: 55 escriben, 8 comprueban. Por eso un no-op se ve
//    idéntico a un éxito — pasó hoy con el retiro de columnas, que anunció «88 → 86» sin quitar nada.
//
// 🔴 QUÉ ES UNA CAPACIDAD Y QUÉ NO. Una capacidad es un **verbo parametrizado sin decisiones
//    dentro**: «lee esta hoja», «publica este archivo», «verifica que lo escrito está». La decisión
//    —qué hoja, qué columna, qué umbral— la trae el skill como parámetro o sale de una declaración.
//    Si un verbo de aquí tuviera un nombre de campaña o de columna dentro, sería un script otra vez.
//
// 🔴 Y NO REIMPLEMENTA LA FUNDACIÓN. `t`, `nmz` y `archivoVivo` salen de `lib-flexible`; la quincena
//    de `lib-quincena`; el nombre físico del `lib-registro`. Añadir aquí una copia sería crear el
//    problema que esta capa viene a cerrar.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var L = require(__dirname + '/lib-flexible.js');
var REG = require(__dirname + '/lib-registro.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var TOOLS = require(__dirname + '/lib-entorno.js').TOOLS;

var t = L.t;
function num(v) { var n = Number(String(v == null ? '' : v).replace(/[, $%]/g, '')); return isFinite(n) ? n : null; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
function letra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// ── ABRIR ─────────────────────────────────────────────────────────────────────────────
/**
 * Abre el libro vivo. Devuelve un lector con las hojas ya resueltas.
 * ⚠ Copia a una ruta ASCII antes de leer: Node falla con las rutas de OneDrive con acentos.
 */
function abrir(opciones) {
  var op = opciones || {};
  var vivo = L.archivoVivo({ dir: PROY });
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_cap-' + (op.como || 'lectura') + '.xlsx';
  fs.copyFileSync(vivo.ruta, tmp);
  var wb = XLSX.readFile(tmp);
  return {
    ruta: vivo.ruta, copia: tmp, wb: wb, hojas: wb.SheetNames,
    /** las filas y los encabezados de una hoja, de una vez */
    hoja: function (nombre) {
      var sh = wb.Sheets[nombre];
      if (!sh || !sh['!ref']) return { existe: false, enc: [], filas: [], nombre: nombre };
      var enc = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t);
      return {
        existe: true, nombre: nombre, sh: sh,
        enc: enc.filter(Boolean), encTodos: enc,
        filas: XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false }),
        /** 🔴 el nombre FÍSICO de una columna, preguntándole al registro — no adivinando */
        col: function (idLogico, ambito) {
          try { return REG.abrir(ambito || 'resumen', enc).n(idLogico); }
          catch (e) { return null; }
        },
        letraDe: function (nombreCol) { var i = enc.indexOf(nombreCol); return i < 0 ? null : letra(i); }
      };
    },
    /** un bloque del backend, con su nombre lógico */
    bloque: function (nombre) {
      try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + nombre + '.json', 'utf8')); }
      catch (e) { return null; }
    },
    libre: function () {
      try { var fd = fs.openSync(vivo.ruta, 'r+'); fs.closeSync(fd); return true; } catch (e) { return false; }
    }
  };
}

// ── VERIFICAR ─────────────────────────────────────────────────────────────────────────
/**
 * 🔴 LA CAPACIDAD QUE MÁS FALTA: releer el archivo y comprobar que lo que se dijo, está.
 *    Solo 8 de 55 scripts que escriben lo hacen. Sin esto un no-op se ve igual que un éxito:
 *    el retiro de columnas anunció «88 → 86» y no había quitado ninguna.
 *
 * @param espera  [{ hoja, columna, existe, filasConDato, filas }]
 */
function verificarEnDisco(espera) {
  var vivo = L.archivoVivo({ dir: PROY });
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_cap-verificar.xlsx';
  fs.copyFileSync(vivo.ruta, tmp);
  var wb = XLSX.readFile(tmp);
  return (espera || []).map(function (e) {
    var sh = wb.Sheets[e.hoja];
    if (!sh) return { ok: false, que: e.hoja, dice: 'la hoja no existe' };
    var enc = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t);
    var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
    if (e.columna !== undefined) {
      var esta = enc.indexOf(e.columna) >= 0;
      if (e.existe === false) return { ok: !esta, que: e.hoja + '.' + e.columna, dice: esta ? '🔴 SIGUE AHÍ' : 'retirada' };
      if (!esta) return { ok: false, que: e.hoja + '.' + e.columna, dice: '🔴 no está' };
      if (e.filasConDato !== undefined) {
        var n = F.filter(function (r) { return t(r[e.columna]); }).length;
        return { ok: n >= e.filasConDato, que: e.hoja + '.' + e.columna, dice: n + ' filas con dato (se esperaban ≥' + e.filasConDato + ')' };
      }
      return { ok: true, que: e.hoja + '.' + e.columna, dice: 'presente' };
    }
    if (e.filas !== undefined) return { ok: F.length === e.filas, que: e.hoja, dice: F.length + ' filas (se esperaban ' + e.filas + ')' };
    return { ok: true, que: e.hoja, dice: F.length + ' filas · ' + enc.filter(Boolean).length + ' columnas' };
  });
}

// ── PUBLICAR ──────────────────────────────────────────────────────────────────────────
/**
 * Publica un archivo al vivo con las CINCO capas. Nunca cuatro.
 * 🔴 Valida ANTES de copiar: al revés, cuando la validación falla el vivo ya quedó pisado.
 * 🔴 Y se niega si el archivo está tomado: con Excel abierto OneDrive revierte sin dejar rastro.
 */
function publicar(archivo, opciones) {
  var op = opciones || {};
  var vivo = L.archivoVivo({ dir: PROY });
  var q = function (x) { return String.fromCharCode(34) + x + String.fromCharCode(34); };
  var PY = require(__dirname + '/lib-entorno.js').PYTHON;
  var capas = [];
  try { fs.closeSync(fs.openSync(vivo.ruta, 'r+')); }
  catch (e) { return { ok: false, motivo: 'el vivo está TOMADO (' + e.code + '): con Excel abierto OneDrive revierte', capas: capas }; }
  try {
    var safeSave = require(TOOLS + '/xlsx-safe-save.js');
    capas.push(['safe-save', safeSave(archivo, archivo).validado || 'ok']);
    cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-label.js') + ' ' + q(archivo), { encoding: 'utf8', timeout: 120000 });
    capas.push(['etiqueta', 'restaurada']);
    cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-check.js') + ' ' + q(archivo), { encoding: 'utf8', timeout: 180000 });
    capas.push(['check', 'estructura íntegra']);
    if (fs.existsSync(PY)) { cp.execSync(q(PY) + ' ' + q(TOOLS + '/xlsx-validar-fondo.py') + ' ' + q(archivo), { encoding: 'utf8', timeout: 180000 }); capas.push(['fondo', 'limpio']); }
    cp.execSync(q(process.execPath) + ' ' + q(TOOLS + '/xlsx-orden-celdas.js') + ' ' + q(archivo), { encoding: 'utf8', timeout: 180000 });
    capas.push(['orden', 'correcto']);
  } catch (e) {
    return { ok: false, motivo: 'una capa falló: ' + String(e.message || e).slice(0, 120), capas: capas };
  }
  if (op.backup) {
    var bk = PROY + '/_backups/' + path.basename(vivo.ruta).replace(/\.xlsx$/, '') + '__' + op.backup + '.xlsx';
    fs.copyFileSync(vivo.ruta, bk);
  }
  fs.copyFileSync(archivo, vivo.ruta);
  return { ok: true, capas: capas, kb: Math.round(fs.statSync(vivo.ruta).size / 1024) };
}

// ── CHECKS ────────────────────────────────────────────────────────────────────────────
/**
 * Un registrador de checks con TRES veredictos, no dos.
 * 🔴 El tercero es el que faltaba: «no pude evaluar». Un check que truena hoy DA PERMISO —
 *    y uno que mide contra una regla vieja bloquea trabajo correcto. Los dos son invisibles
 *    si solo existen «pasa» y «falla».
 */
function checks(titulo) {
  var V = [];
  return {
    ok: function (n, d) { V.push({ n: n, v: 'ok', d: d }); },
    falla: function (n, d) { V.push({ n: n, v: 'falla', d: d }); },
    noEvaluado: function (n, porque) { V.push({ n: n, v: 'no-evaluado', d: porque }); },
    /** compara y decide solo */
    compara: function (n, a, b, d) { V.push({ n: n, v: a === b ? 'ok' : 'falla', d: (d || '') + ' ' + a + (a === b ? ' = ' : ' ≠ ') + b }); },
    veredicto: function () {
      var f = V.filter(function (x) { return x.v === 'falla'; });
      var ne = V.filter(function (x) { return x.v === 'no-evaluado'; });
      console.log('\n════ ' + titulo + ' ════');
      V.forEach(function (x) {
        console.log('  ' + (x.v === 'ok' ? '✔' : x.v === 'falla' ? '🔴' : '⚠ ') + ' ' + x.n.padEnd(56) + (x.d || ''));
      });
      console.log('  ' + (f.length ? '🔴 ' + f.length + ' falla(s)' : '✅ pasa') +
        (ne.length ? '   ⚠ ' + ne.length + ' sin evaluar — no cuenta como pasar' : '') +
        '   · ' + V.length + ' checks');
      return { falla: f.length, noEvaluado: ne.length, total: V.length, detalle: V };
    }
  };
}

module.exports = {
  abrir: abrir, verificarEnDisco: verificarEnDisco, publicar: publicar, checks: checks,
  t: t, nmz: L.nmz, num: num, mil: mil, letra: letra,
  PROY: PROY, BACK: BACK
};
