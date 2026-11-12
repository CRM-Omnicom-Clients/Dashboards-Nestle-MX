// BARRIDO FINAL — que no quede en disco nada que hable del sistema anterior.
//
// 🔴 LO QUE PIDIÓ RICK (26-ago): «nada sobre nodos, nada sobre la cadena de nodos, no podemos tener
//    ya nada en disco que hable sobre esa cadena. Todo va dentro de los skills.»
//    El desanclaje anterior limpió el backend y los SKILL.md, pero se quedó corto en tres frentes
//    que sí están en disco: los documentos del proyecto, las memorias, y una carpeta que llevaba
//    la palabra en su propio nombre.
//
// 🔴 SE MUEVE, NO SE BORRA — y la diferencia importa. Los planes viejos son el registro de por qué
//    el sistema es como es; destruirlos es irreversible y no lo pidió nadie. Salen del PROYECTO
//    (que es donde estorban y donde el equipo los leería por error) a un respaldo fuera de
//    OneDrive. Si Rick quiere borrarlos, es un comando suyo, no una decisión mía.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var PROY = H + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ORQ = PROY + '/_orquesta';
var BACK = H + '/.claude/reportes-backend/nestle';
var RESPALDO = H + '/_respaldos-nestle/_planes-superados';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// ── el vocabulario. La narración histórica se reescribe para que SIGA teniendo sentido:
//    «la cadena de nodos» era un nombre propio; su sustituto no puede ser «la cadena de pasos»,
//    porque hoy todo es un paso. Se dice lo que era: el sistema plano anterior.
var PALABRAS = [
  [/\bcadena de nodos\b/gi, 'el sistema plano anterior'],
  [/\bsistema de nodos\b/gi, 'el sistema plano anterior'],
  [/\bplan de nodos\b/gi, 'plan de pasos'],
  [/\bnodos\b/g, 'pasos'], [/\bNodos\b/g, 'Pasos'], [/\bNODOS\b/g, 'PASOS'],
  [/\bnodo\b/g, 'paso'], [/\bNodo\b/g, 'Paso'], [/\bNODO\b/g, 'PASO']
];

// ── los documentos del proyecto que SIGUEN VIVOS: se les barre la palabra, se quedan donde están
var VIVOS = ['estado-reportes.md', 'mapa-y-plan-simplificacion.md',
             'mapa-cadena-skills.html', 'que-vale-este-sistema.html'];

// ── los que ya no se consultan: salen del proyecto
var SUPERADOS = ['HANDOFF-etapas-5-8.md', 'estado-sistema.html', 'plan-afinacion-fase2.md',
  'plan-agentes-reportes.md', 'plan-ajustes-rick-21ago.md', 'plan-cerrar-cadena-skills.md',
  'plan-cierre-para-prueba.md', 'plan-corte-agosto.md', 'plan-modelo-datos-y-skills.md',
  'plan-n2b-qcart.md', 'plan-skills-v2.md', 'plan-construccion-reportes.md',
  'plan-reportes-WK32.md', 'plan-simplificar-sistema.html', 'pendientes-reportes-WK32.md'];

function barrer(p) {
  if (!fs.existsSync(p)) return 0;
  var t = fs.readFileSync(p, 'utf8'), o = t, n = 0;
  PALABRAS.forEach(function (r) { var c = (t.match(r[0]) || []).length; if (c) { n += c; t = t.replace(r[0], r[1]); } });
  if (t !== o && ESCRIBIR) fs.writeFileSync(p, t);
  return n;
}

console.log('════════ BARRIDO FINAL ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

// 1 · backend y skills (lo que el desanclaje dejó pendiente)
var n1 = 0, f1 = 0;
[BACK + '/_scripts', BACK + '/_contratos'].forEach(function (d) {
  fs.readdirSync(d).forEach(function (f) {
    if (!/\.(js|json)$/.test(f)) return;
    if (/desanclar-|barrido-final/.test(f)) return;    // los migradores definen la palabra en sus regex
    var c = barrer(path.join(d, f)); if (c) { n1 += c; f1++; }
  });
});
fs.readdirSync(H + '/.claude/skills').forEach(function (d) {
  var p = H + '/.claude/skills/' + d + '/SKILL.md';
  if (/^rick-reportes-/.test(d) && fs.existsSync(p)) { var c = barrer(p); if (c) { n1 += c; f1++; } }
});
console.log('  1 · backend + skills:        ' + String(n1).padStart(4) + ' menciones en ' + f1 + ' archivo(s)');

// 2 · las memorias del proyecto
var n2 = 0, f2 = 0;
var memDir = fs.readdirSync(H + '/.claude/projects').filter(function (d) { return /Nestl/.test(d); })[0];
if (memDir) {
  var md = H + '/.claude/projects/' + memDir + '/memory';
  if (fs.existsSync(md)) fs.readdirSync(md).forEach(function (f) {
    if (!/\.md$/.test(f)) return;
    var c = barrer(path.join(md, f)); if (c) { n2 += c; f2++; }
  });
}
console.log('  2 · memorias del proyecto:   ' + String(n2).padStart(4) + ' menciones en ' + f2 + ' archivo(s)');

// 3 · los documentos vivos del proyecto
var n3 = 0, f3 = 0;
VIVOS.forEach(function (f) { var c = barrer(path.join(ORQ, f)); if (c) { n3 += c; f3++; } });
console.log('  3 · documentos vivos:        ' + String(n3).padStart(4) + ' menciones en ' + f3 + ' archivo(s)');

// 4 · los superados salen del proyecto
var mover = SUPERADOS.filter(function (f) { return fs.existsSync(path.join(ORQ, f)); });
console.log('  4 · planes superados a mover fuera del proyecto: ' + mover.length);

// 5 · la carpeta que lleva la palabra en su nombre
var hist = ORQ + '/_historico-sistema-nodos';
console.log('  5 · carpeta histórica: ' + (fs.existsSync(hist) ? 'existe, sale del proyecto' : 'ya no está'));

if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

fs.mkdirSync(RESPALDO, { recursive: true });
mover.forEach(function (f) { fs.renameSync(path.join(ORQ, f), path.join(RESPALDO, f)); });
if (fs.existsSync(hist)) {
  var destino = RESPALDO + '/_cadena-anterior';
  fs.mkdirSync(destino, { recursive: true });
  fs.readdirSync(hist).forEach(function (f) { fs.renameSync(path.join(hist, f), path.join(destino, f)); });
  fs.rmdirSync(hist);
}
console.log('\n  → movidos a ' + RESPALDO.replace(H, '~') + '   (fuera de OneDrive y fuera del proyecto)');

// ── VERIFICACIÓN: ¿queda algo en disco?
console.log('\n  ══ VERIFICACIÓN ══');
function buscar(dir, filtro) {
  var hits = [];
  (function walk(d, prof) {
    if (prof > 3 || !fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f);
      var st; try { st = fs.statSync(p); } catch (e) { return; }
      if (st.isDirectory()) { if (!/node_modules|_aplicados|_respaldos|_backups/.test(f)) walk(p, prof + 1); return; }
      if (!filtro.test(f)) return;
      if (/desanclar-|barrido-final/.test(f)) return;
      var t = fs.readFileSync(p, 'utf8');
      if (/\bnodos?\b/i.test(t)) hits.push(p.replace(H, '~'));
    });
  })(dir, 0);
  return hits;
}
var q1 = buscar(BACK, /\.(js|json)$/);
var q2 = buscar(ORQ, /\.(md|html)$/);
var q3 = memDir ? buscar(H + '/.claude/projects/' + memDir + '/memory', /\.md$/) : [];
var q4 = buscar(H + '/.claude/skills', /^SKILL\.md$/);
console.log('   ' + (q1.length ? '⚠' : '✔') + ' backend: ' + (q1.length ? q1.length + ' — ' + q1.slice(0, 3).join(' · ') : 'limpio'));
console.log('   ' + (q2.length ? '⚠' : '✔') + ' documentos del proyecto: ' + (q2.length ? q2.length + ' — ' + q2.slice(0, 3).join(' · ') : 'limpio'));
console.log('   ' + (q3.length ? '⚠' : '✔') + ' memorias: ' + (q3.length ? q3.length + ' — ' + q3.slice(0, 3).join(' · ') : 'limpio'));
console.log('   ' + (q4.length ? '⚠' : '✔') + ' SKILL.md: ' + (q4.length ? q4.length + ' — ' + q4.slice(0, 3).join(' · ') : 'limpio'));
var carpetas = fs.existsSync(ORQ) && fs.readdirSync(ORQ).filter(function (f) { return /nodo/i.test(f); });
console.log('   ' + (carpetas && carpetas.length ? '🔴' : '✔') + ' sin archivos ni carpetas con «nodo» en el nombre');
process.exit(0);
