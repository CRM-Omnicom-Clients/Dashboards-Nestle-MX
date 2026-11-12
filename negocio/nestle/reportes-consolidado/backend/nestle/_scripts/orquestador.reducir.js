// ETAPA 1 · REDUCIR — archivar lo que ya cumplió su función, antes de tocar lo que sigue vivo.
//
// 🔴 POR QUÉ VA PRIMERO, y me lo tuvo que decir Rick: yo ya había empezado a anclar 9 scripts al
//    catálogo raíz **sin saber cuáles sobreviven**. Si alguno se archiva, ese trabajo se tira.
//    *«¿Para qué tocas 145 si 23 son los que corren? Ten una secuencia lógica.»* Tenía razón.
//
// 🔴 EL CRITERIO NO ES MI OPINIÓN, Y TAMPOCO SU CABECERA SOLA. Un script es de un solo uso si
//    (a) su cabecera declara que fue una fase o una migración, **y** (b) **nada vivo lo invoca**.
//    Las dos condiciones, porque cada una sola miente:
//      · solo la cabecera → `orquestador.censo-scripts.js` dice «fase 1» y es la herramienta VIVA
//        que regenera el censo; archivarla rompería el generador de la cadena y las guardas.
//      · solo el grafo → un migrador ya aplicado no lo invoca nadie, pero tampoco un diagnóstico
//        que sí querremos volver a correr.
//    Es la misma lección de siempre: **de quién es y si corre son dos preguntas distintas.**
//
// 🔴 SE ARCHIVA, NO SE BORRA. Van a `_scripts/_aplicados/<skill>/`, que ya es donde vive lo
//    cumplido. Su código sigue disponible; lo que cambia es que deja de contar como sistema vivo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var APL = D + '/_aplicados';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var censo = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));

// ── quién corre en el corte (esos no se tocan ni de broma)
var corre = {};
C.etapas.forEach(function (e) {
  e.scripts.forEach(function (n) { corre[n.script] = 1; (n.suites || []).forEach(function (s) { corre[s] = 1; }); });
});

// ── el grafo: ¿algo VIVO lo invoca de verdad? (comentarios no cuentan, ya lo aprendimos)
function sinComentarios(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
var vivos = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
function loInvocaAlgoVivo(f) {
  return vivos.some(function (g) {
    if (g === f) return false;
    var t = sinComentarios(fs.readFileSync(path.join(D, g), 'utf8'));
    if (t.indexOf(f) < 0) return false;
    // tiene que ser una LLAMADA, no una mención
    var i = 0;
    while ((i = t.indexOf(f, i)) >= 0) {
      var atras = t.slice(Math.max(0, i - 140), i);
      if (/(exec|spawn)\w*\s*\(|require\s*\(/.test(atras)) return true;
      i += f.length;
    }
    return false;
  });
}

// 🔴 LISTA DECLARADA, NO HEURÍSTICO — y el heurístico se probó primero, a propósito, para saber
//    por qué no sirve. Decía «archívalo si su cabecera dice FASE y nada vivo lo invoca», y quiso
//    archivar `censo-scripts`, `mapa-skills`, `revalidar-todo` y los dos probadores: herramientas
//    VIVAS a las que **nadie invoca desde código porque las invoca una persona desde la terminal**.
//    El grafo de llamadas no ve al humano. Ése es su punto ciego, y es grande.
//    Así que cada archivado se declara con su motivo, uno por uno. Es el principio del sistema
//    aplicado a sí mismo: declarar, no inferir.
var DE_UN_SOLO_USO = {
  // migradores de las fases de reorganización — ya aplicados, su resultado está en disco
  'orquestador.archivar-aplicados.js': 'fase 2: movió 105 scripts a _aplicados. Aplicada',
  'orquestador.colocar-por-skill.js': 'fase 2: colocó cada script bajo su skill. Aplicada',
  'orquestador.extraer-decisiones.js': 'fase 3: midió las decisiones escritas en código. Medición hecha',
  'orquestador.medir-duplicacion.js': 'fase 4: midió los 351 idiomas repetidos. Se re-medirá con otro script',
  'orquestador.renombrar-por-skill.js': 'fase 5: renombró 96 scripts a <skill>.<verbo>. Aplicada',
  // migradores de hoy — aplicados y verificados
  'orquestador.desanclar-nodos.js': '26-ago: renombró 651 identificadores. Aplicado',
  'orquestador.desanclar-3-criticos.js': '26-ago: rehízo los 3 críticos con cuidado. Aplicado',
  'orquestador.barrido-final.js': '26-ago: barrió 29,338 menciones del vocabulario viejo. Aplicado',
  'orquestador.vocabulario-scripts.js': '26-ago: «paso» → «script de ejecución». Aplicado',
  // siembras: crearon un contrato que ahora vive por su cuenta
  'orquestador.sembrar-registro.js': 'sembró el catálogo raíz (442 columnas). El catálogo ya vive solo',
  'orquestador.1-esquema.js': 'levantó `esquema.json`. El esquema ya vive solo',
  // diagnósticos de un momento concreto
  'orquestador.dx2.js': 'diagnóstico puntual',
  'orquestador.dx3.js': 'diagnóstico puntual',
  'orquestador.dx4.js': 'diagnóstico puntual',
  'orquestador.dx-carritos.js': 'diagnóstico puntual de carritos',
  'orquestador.dx-descuadre.js': 'diagnóstico puntual de un descuadre ya resuelto',
  'orquestador.nb-email-sfmc.js': 'exploración del bloque de email en SFMC. Hecha',
  'orquestador.estatus-instrucciones.js': 'midió el estatus de las instrucciones de Rick. Medición hecha',
  'orquestador.fantasmas-y-ligamx.js': 'midió las fantasmas y Liga MX. Aplicado',
  // reemplazados por algo mejor
  'orquestador.html-cadena-skills.js': 'lo sustituyó `orquestador.mapa-skills.js`, que GENERA el mapa desde el contrato'
};

var archivar = [], sequedan = [], porque = {};
fs.readdirSync(D).forEach(function (f) {
  if (!/\.js$/.test(f)) return;
  if (/^lib-/.test(f)) return;                 // las librerías son dependencia, no scripts sueltos
  if (corre[f]) return;                        // corre en el corte: intocable
  if (/reducir\.js$/.test(f)) return;          // este mismo

  if (DE_UN_SOLO_USO[f]) {
    // 🔴 aun declarado, se comprueba que nadie vivo lo invoque. Si alguien lo llama, la
    //    declaración está equivocada y manda la realidad.
    if (loInvocaAlgoVivo(f)) { sequedan.push(f); porque[f] = '🔴 declarado de un solo uso PERO algo vivo lo invoca — no se archiva'; }
    else { archivar.push(f); porque[f] = DE_UN_SOLO_USO[f]; }
  } else sequedan.push(f);
});

console.log('════════ ETAPA 1 · REDUCIR ' + (ESCRIBIR ? '🔴 ARCHIVA' : '(seco)') + ' ════════\n');
console.log('  corren en el corte (intocables): ' + Object.keys(corre).length);
console.log('  librerías (dependencia):         ' + fs.readdirSync(D).filter(function (f) { return /^lib-.*\.js$/.test(f); }).length);
console.log('  → a archivar:                    ' + archivar.length);
console.log('  → se quedan:                     ' + sequedan.length + '\n');

archivar.sort().forEach(function (f) { console.log('   📦 ' + f.padEnd(40) + (porque[f]||'')); });
var rescatados = sequedan.filter(function (f) { return /invoca/.test(porque[f] || ''); });
if (rescatados.length) {
  console.log('\n  ⚠ dicen «fase» pero algo vivo los invoca — NO se archivan:');
  rescatados.forEach(function (f) { console.log('     ' + f); });
}

if (!ESCRIBIR) { console.log('\n  (seco. Para archivar: --escribir)'); process.exit(0); }

// ── mover a _aplicados/<skill>/
var dueno = {};
Object.keys(censo.clases).forEach(function (k) {
  (censo.clases[k] || []).forEach(function (x) { dueno[x.f] = String(x.skill || 'orquestador').replace(ENT.PREFIJO_SKILL, ''); });
});
var movidos = 0;
archivar.forEach(function (f) {
  var sk = dueno[f] || 'orquestador';
  var dst = path.join(APL, sk);
  fs.mkdirSync(dst, { recursive: true });
  fs.renameSync(path.join(D, f), path.join(dst, f));
  movidos++;
});
console.log('\n  archivados: ' + movidos + ' → _scripts/_aplicados/<skill>/');

// ── VERIFICACIÓN DE SISTEMA (no de uso: no se corre el corte ni se toca el Excel)
console.log('\n  ══ VERIFICACIÓN DE SISTEMA ══');
var cp = require('child_process');

// 1 · nada de lo que corre se fue
var faltan = Object.keys(corre).filter(function (f) { return !fs.existsSync(path.join(D, f)); });
console.log('   ' + (faltan.length ? '🔴' : '✔') + ' los ' + Object.keys(corre).length + ' del corte siguen en su sitio' +
  (faltan.length ? ': 🔴 ' + faltan.join(' · ') : ''));

// 2 · nadie que se quede invoca a un archivado
var rotos = [];
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (g) {
  var t = sinComentarios(fs.readFileSync(path.join(D, g), 'utf8'));
  archivar.forEach(function (a) {
    var i = t.indexOf(a);
    if (i < 0) return;
    var atras = t.slice(Math.max(0, i - 140), i);
    if (/(exec|spawn)\w*\s*\(|require\s*\(/.test(atras)) rotos.push(g + ' → ' + a);
  });
});
console.log('   ' + (rotos.length ? '🔴' : '✔') + ' ningún script vivo invoca a un archivado' +
  (rotos.length ? ': ' + rotos.slice(0, 4).join(' · ') : ''));

// 3 · todo sigue parseando
var malos = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); })
  .filter(function (f) { return cp.spawnSync(process.execPath, ['-c', path.join(D, f)], { encoding: 'utf8' }).status !== 0; });
console.log('   ' + (malos.length ? '🔴' : '✔') + ' los ' + fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).length +
  ' scripts que quedan parsean' + (malos.length ? ': ' + malos.join(' · ') : ''));

process.exit(faltan.length || rotos.length || malos.length ? 1 : 0);
