/*
 * orquestador.mapa-carpeta.js — DÓNDE VA CADA COSA EN EL BACKEND, MEDIDO DEL DISCO.
 *
 * Rick, 21-sep: «ordena toda la carpeta, no dejes cosas sueltas y me dices dónde queda cada cosa».
 *
 * 🔴 EL MAPA SE GENERA, NO SE ESCRIBE. Un README a mano describe la carpeta del día que se
 *    escribió y a partir de ahí miente con autoridad — es lo que le pasó a `estado-reportes.md`,
 *    que decía «v7 · WK31» dos meses después. Aquí cada cifra sale de `readdirSync`.
 *
 * 🔴 Y DENUNCIA LO SUELTO. No basta con describir: si aparece un archivo en la raíz que no es
 *    una carpeta conocida ni un doc declarado, sale en la lista de sueltos. Así «ordenado» es
 *    una medición y no una impresión.
 *
 *   node orquestador.mapa-carpeta.js              (muestra)
 *   node orquestador.mapa-carpeta.js --escribir   (además escribe MAPA.md)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

/* Qué es cada carpeta. Si aparece una que no esté aquí, se declara «SIN DECLARAR» — una carpeta
 * nueva que nadie explicó es deuda, no un detalle. */
var QUE_ES = {
  _scripts: { para: 'Todo lo ejecutable. Nombres `<skill>.<verbo>.js`; las librerías, `lib-*.js`.', regla: 'Un script sin skill dueño BLOQUEA el corte (guarda 1).' },
  '_scripts/_aplicados': { para: 'Scripts de un solo uso que YA se aplicaron, archivados por skill.', regla: 'Se guardan, no se borran: son la memoria de por qué una celda dice lo que dice.' },
  _contratos: { para: 'Lo que el sistema DECLARA: la cadena, el esquema, el registro de nombres, las reglas irrenunciables y los contratos de consumo.', regla: 'Se generan desde el estado real. Un contrato a mano se desfasa.' },
  _fuentes: { para: 'Los bloques de datos por fuente (email, qcart, whatsapp, manual). Es el LOG acumulado.', regla: 'Modo append: lo ya escrito no se va solo. Purgar exige un script con motivo.' },
  _insumos: { para: 'Lo que llega de fuera antes de procesarse.', regla: '—' },
  _preescritura: { para: 'Las MEDICIONES antes de tocar el Excel: qué se escribiría y por qué.', regla: 'E1 · medir todo → decidir todo → escribir una vez. Se revisa ANTES de escribir.' },
  _rejilla: { para: 'La rejilla de cálculo intermedia.', regla: '—' },
  _respaldos: { para: 'Copias del workbook antes de escrituras grandes.', regla: 'Fuera de OneDrive cuando importa: OneDrive revierte si Excel está abierto.' },
  _catalogo: { para: 'Estado y mediciones del catálogo de piezas.', regla: '—' },
  _archivo: { para: 'Lo RETIRADO: scripts que ya no corren, huérfanos y salidas accidentales.', regla: 'Se mueve aquí, NUNCA se borra con rm. Tres skills perdieron sus scripts así.' },
  /* 🔴 22-sep-2026 · Rick: «estás haciendo un desorden en la carpeta C». Tenía razón: 128 scripts
     escribían sus copias de trabajo en `homedir() + '/_algo.xlsx'`, o sea en la RAÍZ de su carpeta
     de usuario. El patrón existe por un motivo real —Node y `xlsx` fallan con las rutas de OneDrive
     porque llevan acentos— pero la raíz del home no era el único sitio ASCII posible. */
  _tmp: { para: 'Las copias ASCII de trabajo de los scripts. Descartable entero.', regla: 'Ningún script escribe temporales fuera de aquí. Nada de esto es fuente de verdad.' }
};
var DOCS_OK = { 'CATALOGO.md': 'La documentación del catálogo raíz.', 'MAPA.md': 'Este mapa (generado).', '_orquesta-bitacora.json': 'La bitácora que escribe `orquestador.orquestador.js` en esta ruta exacta.' };

var lineas = [], sueltos = [];
var entradas = fs.readdirSync(BACK);
var dirs = entradas.filter(function (e) { return fs.statSync(path.join(BACK, e)).isDirectory(); }).sort();
var files = entradas.filter(function (e) { return !fs.statSync(path.join(BACK, e)).isDirectory(); }).sort();

function cuenta(dir) {
  var n = 0, mb = 0;
  (function rec(d) {
    fs.readdirSync(d).forEach(function (e) {
      var p = path.join(d, e), s = fs.statSync(p);
      if (s.isDirectory()) return rec(p);
      n++; mb += s.size;
    });
  })(dir);
  return { n: n, mb: (mb / 1048576).toFixed(1) };
}

console.log('════════ MAPA DEL BACKEND · ' + new Date().toISOString().slice(0, 10) + ' ════════\n');
console.log('  ' + BACK.replace(os.homedir(), '~') + '\n');
dirs.forEach(function (d) {
  var c = cuenta(path.join(BACK, d));
  var q = QUE_ES[d];
  console.log('  ' + d.padEnd(16) + String(c.n).padStart(4) + ' arch · ' + String(c.mb).padStart(5) + ' MB   ' + (q ? q.para : '🔴 SIN DECLARAR — ¿qué va aquí?'));
  if (!q) sueltos.push('carpeta sin declarar: ' + d);
  lineas.push({ tipo: 'dir', nombre: d, archivos: c.n, mb: +c.mb, para: q ? q.para : null, regla: q ? q.regla : null });
});
console.log('');
files.forEach(function (f) {
  var ok = DOCS_OK[f];
  console.log('  ' + (ok ? '  ' : '🔴') + f.padEnd(28) + (ok || 'SUELTO — no es carpeta ni doc declarado'));
  if (!ok) sueltos.push('archivo suelto en la raíz: ' + f);
  lineas.push({ tipo: 'file', nombre: f, declarado: !!ok, para: ok || null });
});

console.log('\n── veredicto');
console.log(sueltos.length ? '  🔴 ' + sueltos.length + ' cosa(s) sueltas:\n' + sueltos.map(function (s) { return '     · ' + s; }).join('\n')
  : '  ✅ nada suelto: toda carpeta está declarada y todo archivo de la raíz tiene su razón.');

if (ESCRIBIR) {
  var md = ['# Mapa del backend de Nestlé', '', '> Generado por `orquestador.mapa-carpeta.js` el ' + new Date().toISOString().slice(0, 10) +
    '. **No se edita a mano** — se regenera.', '', '| Carpeta | Archivos | Para qué | Regla |', '|---|---|---|---|'];
  lineas.filter(function (l) { return l.tipo === 'dir'; }).forEach(function (l) {
    md.push('| `' + l.nombre + '` | ' + l.archivos + ' | ' + (l.para || '🔴 SIN DECLARAR') + ' | ' + (l.regla || '—') + ' |');
  });
  md.push('', '## Archivos en la raíz', '');
  lineas.filter(function (l) { return l.tipo === 'file'; }).forEach(function (l) {
    md.push('- `' + l.nombre + '` — ' + (l.para || '🔴 SUELTO'));
  });
  md.push('', '## Sueltos', '', sueltos.length ? sueltos.map(function (s) { return '- 🔴 ' + s; }).join('\n') : '✅ ninguno.');
  fs.writeFileSync(BACK + '/MAPA.md', md.join('\n'));
  console.log('\n  → MAPA.md');
}
process.exit(sueltos.length ? 1 : 0);
