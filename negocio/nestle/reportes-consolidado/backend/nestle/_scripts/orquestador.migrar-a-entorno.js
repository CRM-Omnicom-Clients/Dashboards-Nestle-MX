/*
 * orquestador.migrar-a-entorno.js — cambia las rutas escritas a mano por `lib-entorno`.
 *
 * 🔴 LO AUTORIZA `orquestador.probar-entorno.js`, NO YO. Reescribir 162 líneas solo es seguro
 *    porque esa prueba ya comprobó que el contrato resuelve al MISMO sitio que los literales. Si
 *    difirieran en un carácter, los scripts migrados no fallarían: `existsSync` daría `false` y
 *    cada uno concluiría «no hay datos». Córrela antes; esto se niega si no está en verde.
 *
 * 🔴 POR TANDAS, Y LA PRIMERA ES LA DEL CORTE. `--corte` toca solo los scripts que la cadena
 *    invoca de verdad (los de `cadena-skills.json` y sus suites). Así se puede correr el corte
 *    entero y exigir que dé EXACTAMENTE lo mismo antes de tocar los otros 122. Migrar los 165 de
 *    una pasada haría imposible saber cuál rompió qué.
 *
 * 🔴 TRES ARCHIVOS NO SE TOCAN NUNCA, y no es pereza:
 *      · `lib-entorno.js`          — es quien DEFINE las rutas; migrarlo es una mordida circular
 *      · `orquestador.probar-entorno.js` — lleva los literales en regexes para poder compararlos
 *      · este mismo                — igual
 *
 *   node orquestador.migrar-a-entorno.js --corte              (seco)
 *   node orquestador.migrar-a-entorno.js --corte --escribir
 *   node orquestador.migrar-a-entorno.js --resto --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var SOLO_CORTE = process.argv.indexOf('--corte') >= 0;
var RESTO = process.argv.indexOf('--resto') >= 0;
if (!SOLO_CORTE && !RESTO) { console.log('uso: --corte | --resto  [--escribir]'); process.exit(1); }

// la lista se pide al contrato: la leen el probador, este y la guarda 7
var INTOCABLES = Object.keys(JSON.parse(fs.readFileSync(BACK + '/_contratos/entorno.json', 'utf8')).intocables.lista);

console.log('════ MIGRAR LAS RUTAS A `lib-entorno` · ' + (SOLO_CORTE ? 'LOS DEL CORTE' : 'EL RESTO') +
  ' ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// ── 0 · la prueba que autoriza esto tiene que estar en verde
var pr = cp.spawnSync(process.execPath, [D + '/orquestador.probar-entorno.js'], { encoding: 'utf8' });
if (pr.status !== 0) {
  console.log('🔴 `orquestador.probar-entorno.js` NO está en verde. No migro nada.');
  console.log((pr.stdout || '').split('\n').filter(function (l) { return /🔴/.test(l); }).slice(0, 4).join('\n'));
  process.exit(1);
}
console.log('  ✔ la prueba del entorno está en verde: el contrato resuelve lo mismo que los literales\n');

// ── 1 · el alcance
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var delCorte = {};
(C.etapas || []).forEach(function (e) {
  (e.scripts || []).forEach(function (n) {
    delCorte[n.script] = 1;
    (n.suites || []).forEach(function (s) { delCorte[s] = 1; });
  });
});
console.log('  scripts que la cadena invoca: ' + Object.keys(delCorte).length);

// ── 2 · las sustituciones, de la más específica a la más general
//    🔴 EL ORDEN IMPORTA: la raíz del proyecto es PREFIJO de todas las demás. Si se reemplaza
//       primero, las rutas al libro y a las fuentes quedarían como `ENT.PROYECTO + '/(Interno)…'`
//       en vez de `ENT.LIBRO`, y el contrato dejaría de ser el único sitio donde vive el nombre
//       del archivo — que es justo lo que esta migración viene a arreglar.
var RAIZ = "/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé";
var EXT = "/OneDrive - OneWorkplace/Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026";
var SUST = [
  { de: RAIZ + "/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx", a: 'ENT.LIBRO', que: 'el libro vivo' },
  { de: EXT + "/Marcas/CRM General/(Interno) Resultados Whatsapp CRM 2026.xlsx", a: "ENT.fuente('whatsapp')", que: 'la fuente de WhatsApp' },
  { de: RAIZ + "/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx", a: "ENT.fuente('qcart_maestro')", que: 'el maestro de Qcart' },
  { de: RAIZ + "/ReportesQcart/_vigentes", a: "ENT.fuente('qcart_descargas')", que: 'las descargas vigentes' },
  { de: RAIZ + "/_orquesta", a: "ENT.fuente('orquesta')", que: 'la carpeta _orquesta' },
  { de: EXT, a: "ENT.raiz('fuentes_externas')", que: 'la carpeta compartida' },
  { de: RAIZ, a: 'ENT.PROYECTO', que: 'la raíz del proyecto' }
];

var REQ = "var ENT = require(__dirname + '/lib-entorno.js');";

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* 🔴 EL HOME SE LLAMA DE VARIAS MANERAS, Y LA PRIMERA VERSIÓN SOLO CONOCÍA DOS.
 *    Buscaba literalmente `os.homedir() + '<ruta>'` y `require('os').homedir() + '<ruta>'`, así que
 *    **saltó en silencio** a los que lo tenían aliasado: `var H = os.homedir()` y luego `H + '…'`
 *    (4 scripts), y `var osG = require('os')` con `osG.homedir() + '…'` (la guarda 1). No falló:
 *    simplemente no los vio, y como el aviso final solo mira los archivos que SÍ cambió, el
 *    migrador se declaró completo con 7 rutas literales en pie.
 *    Los alias se LEEN del archivo en vez de listarse: una lista mía se desfasa con el primer
 *    script que use otra letra. */
function prefijosDelHome(t) {
  var pre = ['os.homedir()', "require('os').homedir()"];
  /* 🔴 EL ALIAS NO SIEMPRE VIENE DETRÁS DE UN `var`. La guarda 6 lo declara en una lista:
   *    `var fsG = require('fs'), osG = require('os');` — y anclar el patrón a la palabra `var`
   *    dejó a `osG` sin reconocer, así que el ÚNICO script que quedó con su ruta escrita fue
   *    precisamente una guarda. Basta con que ALGO reciba `require('os')`: quien lo recibe es un
   *    alias, venga de un `var`, de una coma o de una reasignación. */
  (t.match(/(\w+)\s*=\s*require\('os'\)/g) || []).forEach(function (m) {
    pre.push(/(\w+)\s*=/.exec(m)[1] + '.homedir()');
  });
  (t.match(/(\w+)\s*=\s*(?:require\('os'\)|\w+)\.homedir\(\)/g) || []).forEach(function (m) {
    pre.push(/(\w+)\s*=/.exec(m)[1]);
  });
  return pre.filter(function (p, i) { return pre.indexOf(p) === i; });
}

/* 🔴 EL NOMBRE DEL LIBRO SE ESCAPA CUANDO LA RUTA SE ARMA EN DOS EXPRESIONES.
 *    `PROY + '/(Interno)-…-v8.xlsx'` no es ninguno de los 7 literales del contrato: es la raíz,
 *    sustituida bien, MÁS el nombre del archivo, que se queda escrito. Así siguen 41 scripts con el
 *    nombre a mano mientras el contrato solo manda en 10 — y el nombre YA cambió una vez (v7→v8).
 *    🔴 SOLO SE COLAPSA UN IDENTIFICADOR QUE DEMOSTRADAMENTE VALGA LA RAÍZ. `orquestador.probar-
 *       flexible.js` hace `dirTmp + '/(Interno)-…-v8.xlsx'` para FABRICAR un v8 y un v9 falsos en un
 *       sandbox y comprobar que se elige el más nuevo: colapsar eso apuntaría la prueba al libro
 *       REAL y le escribiría encima. Un reemplazo por parecido no distingue lo que apunta de lo que
 *       finge — así que se exige la asignación a la vista. */
function raicesLocales(t) {
  var ids = ['ENT.PROYECTO'];
  (t.match(/(\w+)\s*=\s*ENT\.PROYECTO\b/g) || []).forEach(function (m) { ids.push(/(\w+)\s*=/.exec(m)[1]); });
  (t.match(/(\w+)\s*=\s*ENT\.raiz\('proyecto'\)/g) || []).forEach(function (m) { ids.push(/(\w+)\s*=/.exec(m)[1]); });
  return ids.filter(function (p, i) { return ids.indexOf(p) === i; });
}

var plan = [], saltados = [];
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  if (INTOCABLES.indexOf(f) >= 0) { saltados.push(f + ' (intocable)'); return; }
  var esDelCorte = !!delCorte[f];
  if (SOLO_CORTE && !esDelCorte) return;
  if (RESTO && esDelCorte) return;
  var t = fs.readFileSync(path.join(D, f), 'utf8'), orig = t, cuenta = {};
  var PRE = prefijosDelHome(t);
  SUST.forEach(function (s) {
    PRE.forEach(function (pre) {
      /* 🔴 Y EL LITERAL PUEDE SEGUIR MÁS ALLÁ DE LA RUTA DECLARADA. `…/Reportes-Nestlé/_orquesta/
       *    mapa.md` no es ninguna de las 7 rutas del contrato: es una de ellas MÁS un resto. La
       *    versión exacta tampoco veía esos, por eso `mapa-final` y `mapa-skills` quedaron con su
       *    ruta escrita. Se parte en `<llamada> + '<resto>'` y el contrato recupera el mando sobre
       *    la parte que le toca. */
      var re = new RegExp(esc(pre) + "\\s*\\+\\s*'" + esc(s.de) + "([^']*)'", 'g');
      t = t.replace(re, function (_, resto) {
        cuenta[s.que] = (cuenta[s.que] || 0) + 1;
        return resto ? s.a + " + '" + resto + "'" : s.a;
      });
    });
  });
  // segunda pasada: la raíz ya pedida + el nombre del libro escrito → `ENT.LIBRO`
  var LIB = '/' + JSON.parse(fs.readFileSync(BACK + '/_contratos/entorno.json', 'utf8')).libro_vivo;
  raicesLocales(t).forEach(function (id) {
    var re = new RegExp(esc(id) + "\\s*\\+\\s*'" + esc(LIB) + "'", 'g');
    t = t.replace(re, function () { cuenta['el nombre del libro'] = (cuenta['el nombre del libro'] || 0) + 1; return 'ENT.LIBRO'; });
  });
  if (t === orig) return;
  if (t.indexOf('lib-entorno.js') < 0) {
    // el require va después de `_initPaths()` si existe, o tras la primera línea de requires
    var anchor = t.indexOf("require('module').Module._initPaths();");
    if (anchor >= 0) { var fin = t.indexOf('\n', anchor) + 1; t = t.slice(0, fin) + REQ + '\n' + t.slice(fin); }
    else t = REQ + '\n' + t;
  }
  plan.push({ f: f, p: path.join(D, f), t: t, cuenta: cuenta, corte: esDelCorte });
});

console.log('  a migrar: ' + plan.length + ' script(s)' + (saltados.length ? '   ·   saltados: ' + saltados.length : ''));
var tot = {};
plan.forEach(function (x) { Object.keys(x.cuenta).forEach(function (k) { tot[k] = (tot[k] || 0) + x.cuenta[k]; }); });
console.log('\n  ── qué se sustituye');
Object.keys(tot).forEach(function (k) { console.log('     ' + String(tot[k]).padStart(4) + '  ' + k); });

if (!ESCRIBIR) {
  console.log('\n  ── los primeros, con su cuenta');
  plan.slice(0, 10).forEach(function (x) { console.log('     ' + x.f.padEnd(42) + Object.keys(x.cuenta).map(function (k) { return x.cuenta[k] + ' ' + k; }).join(' · ')); });
  console.log('\n  (seco. Para escribir: --escribir)');
  process.exit(0);
}

// ── 3 · escribir y comprobar que siguen compilando
var rotos = [];
plan.forEach(function (x) {
  fs.writeFileSync(x.p, x.t);
  // 🔴 SE COMPRUEBA CON `node --check`, NO CON `vm.Script`. `vm.Script` no envuelve el archivo en
  //    el wrapper de CommonJS, así que un `return` de salida temprana al nivel del módulo —patrón
  //    normal y legal— se reporta como «Illegal return statement». Pasó: dio por ROTO a
  //    `resumen.comparar-formato.js`, que Node carga sin problema, y habría bloqueado una migración
  //    correcta. Un verificador que no verifica lo que de verdad va a correr miente en las dos
  //    direcciones. `node --check` es el mismo parser que lo va a cargar.
  var ch = cp.spawnSync(process.execPath, ['--check', x.p], { encoding: 'utf8' });
  if (ch.status !== 0) {
    var linea = String(ch.stderr || '').split(/\r?\n/).filter(function (l) { return /Error|Unexpected/.test(l); })[0];
    rotos.push(x.f + ': ' + (linea || 'node --check lo rechaza'));
  }
});
console.log('\n  ── releído del disco');
console.log('     ' + (rotos.length ? '🔴 ' + rotos.length + ' con sintaxis rota:' : '✔ los ' + plan.length + ' siguen compilando'));
rotos.slice(0, 5).forEach(function (r) { console.log('        ' + r); });

/* 🔴 EL BARRIDO FINAL MIRA **TODOS** LOS SCRIPTS, NO SOLO LOS QUE TOQUÉ.
 *    La primera versión filtraba `plan` —los archivos que cambió— y por eso dijo «✔ ninguno
 *    conserva una ruta literal» mientras 7 seguían con la suya: los había saltado por no reconocer
 *    su forma, y un archivo saltado no está en `plan`, así que la comprobación no lo veía.
 *    Era la pregunta equivocada. «¿Quedó bien lo que escribí?» no responde «¿quedó bien el
 *    sistema?» — y la segunda es la que importa. Un literal dentro de un COMENTARIO no cuenta: es
 *    documentación, y la hay a propósito explicando por qué ya no se escriben rutas. */
var TODOS = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var conLiteral = [];
TODOS.forEach(function (f) {
  if (INTOCABLES.indexOf(f) >= 0) return;
  var lineas = fs.readFileSync(path.join(D, f), 'utf8').split(/\r?\n/).filter(function (L) {
    return L.indexOf('OneDrive - OneWorkplace') >= 0 && !/^\s*(\/\/|\*|\/\*)/.test(L);
  });
  if (lineas.length) conLiteral.push({ f: f, n: lineas.length, tocado: !!plan.filter(function (x) { return x.f === f; }).length });
});
console.log('\n  ── el barrido final, sobre los ' + TODOS.length + ' scripts del backend');
if (!conLiteral.length) console.log('     ✔ NINGUNO escribe una ruta a mano (los ' + INTOCABLES.length + ' intocables aparte)');
else {
  console.log('     🔴 ' + conLiteral.length + ' script(s) siguen con la ruta escrita:');
  conLiteral.forEach(function (x) {
    console.log('        ' + x.f.padEnd(42) + x.n + ' línea(s)' + (x.tocado ? '   ⚠ y SÍ lo toqué: la sustitución no cubrió su forma' : '   (saltado: ninguna forma coincidió)'));
  });
}

var fallo = rotos.length + conLiteral.length;
console.log('\n════ ' + (fallo
  ? '🔴 NO quedó · ' + rotos.length + ' roto(s) · ' + conLiteral.length + ' con ruta escrita'
  : '✅ ' + plan.length + ' MIGRADOS y CERO rutas escritas en el backend — ahora corre la cadena y compara contra la línea base') + ' ════');
process.exit(fallo ? 1 : 0);
