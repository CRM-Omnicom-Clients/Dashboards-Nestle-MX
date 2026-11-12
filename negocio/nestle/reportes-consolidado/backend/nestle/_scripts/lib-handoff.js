var ENT = require(__dirname + '/lib-entorno.js');
// lib-handoff.js — J1+J2: que lo que produce cada script quede EN EL PROYECTO, no solo en el backend.
//
// 🔴 EL PROBLEMA QUE RESUELVE (Rick, 20-ago). Todo el estado vive en
//    `~/.claude/reportes-backend/nestle/`, que es MI carpeta de herramientas: Rick no la ve, y una
//    sesión nueva empieza sin saber que existe. Ya costó caro — las correcciones del catálogo se
//    perdieron al restaurar un backup y nadie lo notó hasta medirlo.
//
// 🔴 EL BACKEND CALCULA, EL PROYECTO GUARDA. No se duplica el estado (dos copias divergen): el
//    JSON de trabajo se sigue calculando en el backend, y al CERRAR un script se emite su handoff al
//    proyecto — el `.json` para el paso siguiente y el `.md` para el humano.
//
// 🔴 Y EL `.md` NO ES UN RESUMEN BONITO: responde siempre las mismas cinco cosas, en este orden —
//    qué cargó · qué encontró · QUÉ FALTA · con qué se validó · cómo re-correrlo. Un JSON de 240 KB
//    no le dice a nadie que 6 EmailID quedaron «Por llenar». Una línea del md sí.
var fs = require('fs'), os = require('os'), path = require('path');
var PROY = ENT.PROYECTO;

function dir(corte) {
  var d = PROY + '/_cortes/' + (corte || 'actual');
  d.split('/').reduce(function (acc, x) {
    var p = acc ? acc + '/' + x : x;
    if (p && p.indexOf(':') !== p.length - 1) { try { fs.mkdirSync(p); } catch (e) { } }
    return p;
  }, '');
  return d;
}

/**
 * Emite el handoff de un script.
 *   nombre  — 'email' | 'qcart' | 'whatsapp' | 'catalogo' | 'reporte' …
 *   h       — { paso, cargo, encontro[], falta[], validado[], comando, datos }
 *             `datos` se guarda como .json; el resto arma el .md.
 */
function emitir(nombre, h, corte) {
  var d = dir(corte);
  var stamp = h.cuando || '(sin fecha — se pasa desde fuera para no romper el resume)';
  if (h.datos !== undefined) {
    fs.writeFileSync(d + '/' + nombre + '.json', JSON.stringify(h.datos, null, 1));
  }
  var L = [];
  L.push('# ' + nombre + ' — handoff del corte');
  L.push('');
  L.push('> Paso `' + (h.paso || '?') + '` · ' + stamp);
  L.push('> Este archivo es lo que lee el humano y la sesión siguiente. El JSON de al lado es lo que');
  L.push('> consume el script que sigue.');
  L.push('');
  L.push('## Qué cargó');
  L.push(h.cargo || '_(no declarado)_');
  L.push('');
  L.push('## Qué encontró');
  if (!(h.encontro || []).length) L.push('_(nada que reportar)_');
  (h.encontro || []).forEach(function (x) { L.push('- ' + x); });
  L.push('');
  L.push('## 🔴 QUÉ FALTA');
  if (!(h.falta || []).length) L.push('_Nada: el script quedó completo._');
  (h.falta || []).forEach(function (x) { L.push('- 🔴 ' + x); });
  L.push('');
  L.push('## Con qué se validó');
  if (!(h.validado || []).length) L.push('⚠ **Sin validación declarada.** Un paso sin evidencia no está cerrado.');
  (h.validado || []).forEach(function (x) { L.push('- ✔ ' + x); });
  L.push('');
  L.push('## Cómo re-correrlo');
  L.push('```bash');
  L.push(h.comando || '(no declarado)');
  L.push('```');
  fs.writeFileSync(d + '/' + nombre + '.md', L.join('\n'), 'utf8');
  return d + '/' + nombre + '.md';
}

/**
 * Reescribe el INDICE.md leyendo los handoffs que hay en la carpeta.
 * 🔴 Se DERIVA de los archivos, no se lleva a mano: un índice escrito aparte miente en cuanto
 *    alguien corre un script y se le olvida actualizarlo.
 */
function indice(corte, notas) {
  var d = dir(corte);
  var mds = fs.readdirSync(d).filter(function (f) { return /\.md$/.test(f) && f !== 'INDICE.md'; });
  var L = ['# Corte `' + (corte || 'actual') + '` — manifiesto', '',
    '> Derivado de los handoffs que hay en esta carpeta. **No se edita a mano**: se regenera.',
    '> Si un script no aparece aquí, no dejó handoff — y entonces no está cerrado.', '',
    '| Paso | Handoff | Datos | ¿Qué falta? |', '|---|---|---|---|'];
  mds.sort().forEach(function (f) {
    var n = f.replace(/\.md$/, '');
    var txt = fs.readFileSync(d + '/' + f, 'utf8');
    var m = /## 🔴 QUÉ FALTA\n([\s\S]*?)\n\n/.exec(txt);
    var falta = m ? m[1].split('\n').filter(function (l) { return /^- 🔴/.test(l); }) : [];
    var resumen = falta.length ? '🔴 ' + falta.length + ' pendiente(s)' : '✅ completo';
    L.push('| `' + n + '` | [' + f + '](' + f + ') | ' +
      (fs.existsSync(d + '/' + n + '.json') ? '`' + n + '.json`' : '—') + ' | ' + resumen + ' |');
  });
  L.push('');
  L.push('## Dónde vive cada cosa');
  L.push('');
  L.push('| Qué | Dónde |');
  L.push('|---|---|');
  L.push('| Los handoffs de este corte (lo que lees) | `<proyecto>/_cortes/' + (corte || 'actual') + '/` |');
  // 🔴 la ruta se DICE desde donde está, no se escribe: este handoff lo va a leer alguien que
  //    quizá corre el sistema desde la carpeta de SharePoint, y mandarlo a `~/.claude` lo
  //    llevaría a otra copia — o a ninguna.
  L.push('| Los scripts y el cálculo | `' + __dirname + '/` |');
  L.push('| El plan de afinación | `<proyecto>/_orquesta/plan-afinacion-fase2.md` |');
  L.push('| El workbook | `<proyecto>/' + require('path').basename(ENT.LIBRO) + '` |');
  if (notas) { L.push(''); L.push('## Notas'); L.push(notas); }
  fs.writeFileSync(d + '/INDICE.md', L.join('\n'), 'utf8');
  return d + '/INDICE.md';
}

module.exports = { emitir: emitir, indice: indice, dir: dir };
