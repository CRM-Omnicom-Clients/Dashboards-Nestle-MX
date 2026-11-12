/*
 * orquestador.migrar-a-dirname.js — que cada script encuentre el backend DONDE ÉL ESTÁ.
 *
 * 🔴 EL DEFECTO QUE ESTO ARREGLA ES EL QUE HARÍA FALSA TODA LA MIGRACIÓN. 238 scripts escriben
 *    `require('path').resolve(__dirname, '..')` en 852 líneas, y NINGUNO usa `__dirname`.
 *    Copiados a la carpeta de SharePoint, los 238 seguirían cargando sus librerías y sus contratos
 *    **desde `~/.claude` de Rick**. La carpeta nueva parecería funcionar —correría el corte, daría
 *    las cifras buenas— y en realidad estaría ejecutando la copia vieja: una fachada. En la máquina
 *    de otra persona, donde ese `~/.claude` no existe, fallaría; y en la de Rick nunca se notaría.
 *
 * 🔴 ESTO **NO** PUEDE SALIR DEL CONTRATO, y por eso es distinto de la migración de rutas. Para
 *    preguntarle al contrato dónde está el backend hay que cargar `lib-entorno.js`, que vive en el
 *    backend: la pescadilla. `__dirname` no necesita a nadie — Node lo rellena con la carpeta del
 *    archivo que se está ejecutando, así que un script sabe dónde está por el hecho de estar ahí.
 *
 * 🔴 LA PRUEBA ES GLOBAL Y SE HACE ANTES: `path.resolve(__dirname, '..')` tiene que dar HOY
 *    exactamente lo mismo que la ruta escrita. Si difieren, no se migra nada.
 *
 *   node orquestador.migrar-a-dirname.js              (seco)
 *   node orquestador.migrar-a-dirname.js --escribir
 */
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var D = path.resolve(__dirname);
var BACK = path.resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var ESCRITA = require('path').resolve(__dirname, '..');
function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, ''); }

console.log('════ QUE CADA SCRIPT ENCUENTRE EL BACKEND DONDE ÉL ESTÁ ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// ── 0 · la prueba que autoriza esto
console.log('  ── ¿`__dirname` da lo mismo que la ruta escrita?');
console.log('     escrita   : ' + norm(ESCRITA));
console.log('     __dirname : ' + norm(BACK));
if (norm(BACK) !== norm(ESCRITA)) {
  console.log('\n🔴 NO dan lo mismo. No migro nada: cambiar la forma de resolver sin que las dos');
  console.log('   apunten al mismo sitio dejaría a los scripts leyendo otra carpeta — y `existsSync`');
  console.log('   daría `false`, que este sistema lee como «no hay datos».');
  process.exit(1);
}
console.log('     ✔ idénticas: se puede migrar\n');


function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* los prefijos con que se nombra el home, leídos del archivo — el mismo aprendizaje de la
 * migración anterior: anclar el patrón a `var` dejó pasar `var fsG = require('fs'), osG = ...` */
function prefijosDelHome(t) {
  var pre = ['os.homedir()', "require('os').homedir()"];
  (t.match(/(\w+)\s*=\s*require\('os'\)/g) || []).forEach(function (m) { pre.push(/(\w+)\s*=/.exec(m)[1] + '.homedir()'); });
  (t.match(/(\w+)\s*=\s*(?:require\('os'\)|\w+)\.homedir\(\)/g) || []).forEach(function (m) { pre.push(/(\w+)\s*=/.exec(m)[1]); });
  return pre.filter(function (p, i) { return pre.indexOf(p) === i; });
}

var RB = '/.claude/reportes-backend/nestle';
var plan = [];

fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  /* 🔴 AQUÍ NO HAY INTOCABLES, Y CASI ME COMO EL ERROR. Mi primera versión saltaba los 4 de
   *    `entorno.json` y el barrido final también los excluía: habría dicho «ninguno ancla el
   *    backend» con cuatro anclados, que es EXACTAMENTE la comprobación-que-miente que acabo de
   *    arreglar en la otra migración.
   *    La lista existe porque esos cuatro llevan la ruta DEL CLIENTE a propósito —la definen, la
   *    comparan o la usan de señuelo—. La ruta del BACKEND no la lleva a propósito nadie: son dos
   *    asuntos distintos y una sola lista no puede gobernar los dos. `lib-entorno` incluido: él
   *    resuelve el proyecto, pero se tiene que encontrar a sí mismo como todos los demás. */
  var t = fs.readFileSync(path.join(D, f), 'utf8'), orig = t, cuenta = {};
  var PRE = prefijosDelHome(t);

  PRE.forEach(function (pre) {
    // 1 · lo más específico: una librería hermana  →  `require(__dirname + '/lib-x.js')`
    //     🔴 primero, porque la raíz del backend es PREFIJO de esto: al revés quedaría
    //        `require(path.resolve(__dirname,'..') + '/_scripts/lib-x.js')`, que funciona pero
    //        da la vuelta por el padre para volver a la misma carpeta.
    var reLib = new RegExp('require\\(\\s*' + esc(pre) + "\\s*\\+\\s*'" + esc(RB) + "/_scripts/([^']+\\.js)'\\s*\\)", 'g');
    t = t.replace(reLib, function (_, n) { cuenta['una librería hermana'] = (cuenta['una librería hermana'] || 0) + 1; return "require(__dirname + '/" + n + "')"; });

    // 2 · cualquier otra cosa del backend (carpetas de datos, contratos, el propio _scripts)
    var reResto = new RegExp(esc(pre) + "\\s*\\+\\s*'" + esc(RB) + "([^']*)'", 'g');
    t = t.replace(reResto, function (_, resto) {
      cuenta['la raíz del backend'] = (cuenta['la raíz del backend'] || 0) + 1;
      var base = "require('path').resolve(__dirname, '..')";
      return resto ? base + " + '" + resto + "'" : base;
    });
  });

  if (t === orig) return;
  plan.push({ f: f, p: path.join(D, f), t: t, cuenta: cuenta });
});

console.log('  a migrar: ' + plan.length + ' script(s) de ' + fs.readdirSync(D).filter(function (f) { return /.js$/.test(f); }).length + '   (aqui no hay intocables: ver el comentario)');
var tot = {};
plan.forEach(function (x) { Object.keys(x.cuenta).forEach(function (k) { tot[k] = (tot[k] || 0) + x.cuenta[k]; }); });
console.log('\n  ── qué se sustituye');
Object.keys(tot).forEach(function (k) { console.log('     ' + String(tot[k]).padStart(4) + '  ' + k); });

if (!ESCRIBIR) {
  console.log('\n  ── los primeros');
  plan.slice(0, 8).forEach(function (x) {
    console.log('     ' + x.f.padEnd(44) + Object.keys(x.cuenta).map(function (k) { return x.cuenta[k] + ' ' + k; }).join(' · '));
  });
  console.log('\n  (seco. Para escribir: --escribir)');
  process.exit(0);
}

// ── escribir, y comprobar con el mismo parser que lo va a cargar
var rotos = [];
plan.forEach(function (x) {
  fs.writeFileSync(x.p, x.t);
  var ch = cp.spawnSync(process.execPath, ['--check', x.p], { encoding: 'utf8' });
  if (ch.status !== 0) {
    var l = String(ch.stderr || '').split(/\r?\n/).filter(function (y) { return /Error|Unexpected/.test(y); })[0];
    rotos.push(x.f + ': ' + (l || 'node --check lo rechaza'));
  }
});
console.log('\n  ── releído del disco');
console.log('     ' + (rotos.length ? '🔴 ' + rotos.length + ' con sintaxis rota:' : '✔ los ' + plan.length + ' siguen compilando'));
rotos.slice(0, 6).forEach(function (r) { console.log('        ' + r); });

// 🔴 el barrido mira TODOS, no solo los que toqué — la lección de la migración anterior, donde
//    el aviso final solo revisaba el plan y se declaró completo con 7 rutas en pie.
var TODOS = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var quedan = [];
/* 🔴 EL BARRIDO SE SALTA A SÍ MISMO, Y A NADIE MÁS. Este archivo lleva la ruta en su tabla de
 *    sustituciones (`var RB`), igual que el otro migrador lleva las del cliente: es el único que
 *    la necesita escrita. Se excluye por `__filename` —por ser EL QUE BARRE— y no metiéndolo en
 *    una lista de excepciones, porque una lista de excepciones se llena de cosas que no lo son.
 *    Antes excluía los 4 intocables de `entorno.json` y eso era un error de categoría: esa lista
 *    gobierna la ruta DEL CLIENTE, no la del backend. */
TODOS.forEach(function (f) {
  if (path.join(D, f) === __filename) return;
  /* 🔴 LAS DOS FORMAS, porque buscar solo una ya me salió verde con el peor archivo anclado.
   *    Yo miraba el literal `'/.claude/reportes-backend/nestle'`, y `lib-entorno.js` lo tenía como
   *    `path.join(os.homedir(), '.claude', 'reportes-backend', 'nestle')`: la ruta repartida en
   *    argumentos sueltos, sin que ningún trozo contenga la cadena buscada. El barrido dijo
   *    «NINGUNO ancla el backend» con el archivo del que depende todo apuntando a ~/.claude. */
  var ls = fs.readFileSync(path.join(D, f), 'utf8').split(/\r?\n/).filter(function (L) {
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) return false;
    if (L.indexOf(RB) >= 0) return true;
    // la forma por argumentos: path.join(<algo>, '.claude', 'reportes-backend', …)
    return /['"]\.claude['"]\s*,\s*['"]reportes-backend['"]/.test(L);
  });
  if (ls.length) quedan.push({ f: f, n: ls.length, L: ls[0].trim().slice(0, 96) });
});
console.log('\n  ── el barrido, sobre los ' + TODOS.length + ' scripts');
if (!quedan.length) console.log('     ✔ NINGUNO ancla el backend al home: todos lo encuentran por `__dirname`');
else {
  console.log('     🔴 ' + quedan.length + ' siguen anclados al home:');
  quedan.slice(0, 10).forEach(function (x) { console.log('        ' + x.f.padEnd(42) + x.n + '   ' + x.L); });
}

var fallo = rotos.length + quedan.length;
console.log('\n════ ' + (fallo ? '🔴 NO quedó · ' + rotos.length + ' roto(s) · ' + quedan.length + ' anclado(s)'
  : '✅ ' + plan.length + ' MIGRADOS — el backend se encuentra solo. Ahora corre la cadena y compara contra la línea base') + ' ════');
process.exit(fallo ? 1 : 0);
