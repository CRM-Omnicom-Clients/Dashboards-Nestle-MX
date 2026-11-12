// Marca los scripts del sistema viejo que un paso nuevo ya reemplazó.
//
// No se borran —nunca se borra lo que ya está definido—: se les pone un guard que dice quién
// los sustituye y por qué. Un script superado que sigue corriendo sobre un esquema que cambió
// no falla limpio: **da un resultado plausible y equivocado**, o truena con un error que parece
// un bug nuevo. N2-04 tronaba con `DECISION_PENDIENTE undefined` y parecía culpa de la
// migración; en realidad llevaba superado desde que N2a tomó el relevo de `_fuentes/email.json`.
var fs = require('fs'), os = require('os');
var DIR = os.homedir() + '/.claude/reportes-backend/nestle/_scripts';

var SUPERADOS = {
  'N2-00-inventario.js': ['fuentes-insumos.insumos.js', 'inventaría la carpeta; N1 ya lo hace y publica el handoff'],
  'N2-01-diff-email.js': ['N2a-email.js', 'el diff de email vive dentro del bloque, y ahora suma los NUEVOS'],
  'N2-03-fuentes-email.js': ['N2a-email.js', 'la carga de email es el bloque N2a; su llave y su diff quedaron atrás'],
  'N2-04-quincenas.js': ['N2a-email.js', 'el engagement multi-quincena ya sale en auditoria.multimes y delta_opens_si_se_sumara']
};

Object.keys(SUPERADOS).forEach(function (f) {
  var p = DIR + '/' + f;
  if (!fs.existsSync(p)) { console.log('  · no existe: ' + f); return; }
  var s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('SUPERADO_POR') >= 0) { console.log('  · ya marcado: ' + f); return; }
  var q = SUPERADOS[f];
  var guard = [
    '// 🔴 SUPERADO por ' + q[0] + ' (19-ago-2026)',
    '//    ' + q[1] + '.',
    '//    Se conserva por su historia, no por su utilidad: corre sobre un esquema que ya cambió.',
    'var SUPERADO_POR = ' + JSON.stringify(q[0]) + ';',
    'if (!process.env.CORRER_SUPERADO) {',
    '  console.log("\\n  🔴 este script está SUPERADO por " + SUPERADO_POR + ".");',
    '  console.log("     ' + q[1].replace(/"/g, "'") + '");',
    '  console.log("     Si de verdad lo necesitas: CORRER_SUPERADO=1 node ' + f + '\\n");',
    '  process.exit(0);',
    '}',
    ''
  ].join('\n');
  // se inserta después del bloque de cabecera (tras _initPaths), no al inicio: el archivo
  // debe seguir siendo legible como documento de lo que se hizo
  var m = /require\('module'\)\.Module\._initPaths\(\);\n/.exec(s);
  s = m ? s.replace(m[0], m[0] + guard) : guard + s;
  fs.writeFileSync(p, s, 'utf8');
  console.log('  ✔ marcado: ' + f.padEnd(26) + '→ ' + q[0]);
});
