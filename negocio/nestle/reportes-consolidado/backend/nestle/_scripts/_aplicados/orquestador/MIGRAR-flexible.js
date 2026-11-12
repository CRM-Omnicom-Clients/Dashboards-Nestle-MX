// MIGRACIÓN a lib-flexible — quitar lo que se rompe con datos nuevos.
//
// ⚠ Un find-replace ciego deja frases sin sentido. La regla: distinguir lo que **apunta** a algo
//   (código vivo → se actualiza) de lo que **cuenta** algo (un comentario que explica por qué el
//   patrón viejo era malo → se deja intacto, es la memoria del defecto).
//
// Uso:  node MIGRAR-flexible.js            (dry-run: muestra qué haría)
//       node MIGRAR-flexible.js --aplicar  (escribe)
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var DIR = os.homedir() + '/.claude/reportes-backend/nestle/_scripts';
var APLICA = process.argv.indexOf('--aplicar') >= 0;

// Solo los pasos VIVOS. Los Z-* fueron diagnósticos de una sesión concreta: migrarlos es ruido
// y además perderían el sentido de lo que midieron ese día.
var VIVOS = /^(N1|N2|N3|lib-|P6)/;

var CAMBIOS = [
  {
    id: 'username-hardcodeado',
    por_que: 'mi propio CLAUDE.md lo prohíbe: la carpeta de usuario cambia y la ruta muere',
    de: "var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';",
    a: "var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';"
  },
  {
    id: 'archivo-versionado',
    por_que: 'el día que exista una v9, este script sigue leyendo la v8 SIN avisar',
    de: "PROY + '/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx'",
    a: "VIVO_()"
  }
];

// el helper se inyecta una sola vez por archivo que lo necesite
// ⚠ el helper NO puede depender de `var BACK`: 6 de los 17 archivos no la declaran. Se arma
//   la ruta del backend por su cuenta, así se puede inyectar en cualquiera.
var HELPER = [
  '// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,',
  '// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;',
  '// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.',
  'function VIVO_() {',
  '  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";',
  '  try {',
  '    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));',
  '    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;',
  '  } catch (e) { }',
  '  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;',
  '}'
].join('\n');

var archivos = fs.readdirSync(DIR).filter(function (f) {
  return f.slice(-3) === '.js' && VIVOS.test(f) && f.indexOf('MIGRAR') !== 0;
});

var plan = [];
archivos.forEach(function (f) {
  var p = path.join(DIR, f);
  var src = fs.readFileSync(p, 'utf8');
  var orig = src, hechos = [];
  CAMBIOS.forEach(function (c) {
    // se cuenta solo en líneas de CÓDIGO: un comentario que narra el defecto se conserva
    var lineas = src.split(/\r?\n/);
    var n = 0;
    lineas = lineas.map(function (l) {
      var s = l.trim();
      if (s.indexOf('//') === 0 || s.indexOf('*') === 0) return l;   // narración: intacta
      if (l.indexOf(c.de) < 0) return l;
      n++;
      return l.split(c.de).join(c.a);
    });
    if (n) { src = lineas.join('\n'); hechos.push(c.id + ' ×' + n); }
  });
  // si quedó usando VIVO_() y no lo tiene definido, se inyecta tras la línea de BACK
  if (src.indexOf('VIVO_()') >= 0 && src.indexOf('function VIVO_') < 0) {
    // se ancla tras la declaración de PROY, que es la única que el helper necesita
    var m = /^var PROY = .*$/m.exec(src) || /^var BACK = .*$/m.exec(src);
    if (m) { src = src.replace(m[0], m[0] + '\n' + HELPER); hechos.push('helper VIVO_()'); }
    else hechos.push('🔴 sin PROY ni BACK: no pude inyectar el helper');
  }
  if (src !== orig) plan.push({ f: f, p: p, src: src, hechos: hechos });
});

console.log('════════ MIGRACIÓN A lib-flexible ' + (APLICA ? '· APLICANDO' : '· DRY-RUN') + ' ════════\n');
console.log('  candidatos (pasos vivos): ' + archivos.length + '   ·   a cambiar: ' + plan.length + '\n');
plan.forEach(function (x) { console.log('   ' + x.f.padEnd(30) + x.hechos.join(' · ')); });

var quedan = [];
archivos.forEach(function (f) {
  var src = fs.readFileSync(path.join(DIR, f), 'utf8');
  var yaPlan = plan.filter(function (x) { return x.f === f; })[0];
  if (yaPlan) src = yaPlan.src;
  var pend = [];
  src.split(/\r?\n/).forEach(function (l) {
    var s = l.trim();
    if (s.indexOf('//') === 0 || s.indexOf('*') === 0) return;
    if (/MESN\s*=/.test(l)) pend.push('MESN clavado');
    if (/var MET\s*=/.test(l)) pend.push('MET fija');
    if (l.indexOf('Nestle-2026-v') >= 0) pend.push('archivo versionado');
    if (l.indexOf('C:/Users/Ricardo') >= 0) pend.push('username');
  });
  if (pend.length) quedan.push(f + ': ' + Array.from(new Set(pend)).join(', '));
});
console.log('\n  ── lo que este script NO puede migrar solo (necesita criterio):');
quedan.forEach(function (q) { console.log('     ' + q); });

if (!APLICA) { console.log('\n  dry-run. Para escribir: node MIGRAR-flexible.js --aplicar'); process.exit(0); }
plan.forEach(function (x) { fs.writeFileSync(x.p, x.src, 'utf8'); });
console.log('\n  ✔ ' + plan.length + ' archivos escritos');
