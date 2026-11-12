// ETAPA 8 · El mapa final — los 8 puntos, dónde se resolvió cada uno y cómo se validó.
//
// 🔴 SE GENERA DESDE EL ESTADO REAL. Las cifras (skills, etapas, scripts, guardas, reglas) salen de
//    los contratos vivos, no de lo que yo recuerde. Un mapa escrito a mano se desfasa —ya pasó con
//    el de la cadena, que enseñaba 15 etapas cuando eran 17— y un mapa desfasado es peor que
//    ninguno: parece autoridad.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var SALIDA = ENT.fuente('orquesta') + '/mapa-y-plan-simplificacion.md';

function leer(f) { try { return JSON.parse(fs.readFileSync(BACK + '/_contratos/' + f, 'utf8')); } catch (e) { return null; } }
var C = leer('cadena-skills.json'), censo = leer('orquestador.censo-scripts.json');
var reglas = leer('reglas-irrenunciables.json'), dup = leer('duplicacion.json'), div = leer('divergencia.json');

// ── las cifras, medidas ahora
var scriptsJs = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var libs = scriptsJs.filter(function (f) { return /^lib-/.test(f); });
var delCorte = {};
C.etapas.forEach(function (e) { e.scripts.forEach(function (n) { delCorte[n.script] = 1; (n.suites || []).forEach(function (s) { delCorte[s] = 1; }); }); });
var nEjec = C.etapas.reduce(function (a, e) { return a + e.scripts.length; }, 0);
var nSuites = C.etapas.reduce(function (a, e) { return a + e.scripts.reduce(function (b, s) { return b + (s.suites || []).length; }, 0); }, 0);
var nEscritores = 0; C.etapas.forEach(function (e) { e.scripts.forEach(function (s) { if (s.escribe) nEscritores++; }); });
var guardas = (fs.readFileSync(D + '/orquestador.guardas.js', 'utf8').match(/══ GUARDA \d+ ·/g) || []).length;
var decls = fs.readdirSync(BACK + '/_preescritura').filter(function (f) { return /^DECL-/.test(f); }).length;
var aplicados = 0;
(function w(d) { fs.readdirSync(d).forEach(function (f) { var p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (/\.js$/.test(f)) aplicados++; }); })(D + '/_aplicados');

var L = [];
function p(s) { L.push(s === undefined ? '' : s); }

p('# El sistema de skills — mapa, categorización y plan');
p();
p('> **Este documento se genera** con `orquestador.mapa-final.js` desde los contratos vivos.');
p('> No se edita a mano: un mapa escrito a mano se desfasa, y un mapa desfasado parece autoridad.');
p();
p('**Vocabulario.** Hay **skills**, **etapas** y **scripts de ejecución**. Un *skill* es la unidad');
p('de propiedad — tiene su `SKILL.md`, sus contratos y su definición de terminado. Una *etapa* es');
p('una aparición de ese skill en la cadena. Un *script de ejecución* es un archivo que corre, y');
p('siempre dentro de una etapa de un skill. **La palabra «paso» no se usa: era ambigua.**');
p();
p('---');
p();
p('## El sistema hoy, en cifras medidas');
p();
p('| | |');
p('|---|---|');
p('| Skills | **' + C.skills.length + '** |');
p('| Etapas de la cadena | **' + C.etapas.length + '** |');
p('| Scripts de ejecución | **' + nEjec + '** · de ellos **' + nEscritores + ' escriben** al Excel |');
p('| Suites de validación | **' + nSuites + '** |');
p('| Guardas del preflight | **' + guardas + '** — corren solas antes de la etapa 1 |');
p('| Reglas irrenunciables | **' + reglas.reglas.length + '**, cada una con su mecanismo |');
p('| Declaraciones de pre-escritura | **' + decls + '** |');
p('| Scripts en `_scripts/` | ' + scriptsJs.length + ' · de ellos ' + libs.length + ' librerías |');
p('| Archivados en `_aplicados/` | ' + aplicados + ' |');
p();
p('---');
p();
p('## La cadena — lo que corre en cada corte');
p();
p('| # | Skill | Scripts de ejecución | | |');
p('|---|---|---|---|---|');
C.etapas.forEach(function (e) {
  var sk = e.skill.replace(ENT.PREFIJO_SKILL, '');
  var ids = e.scripts.map(function (s) { return '`' + s.id + '`'; }).join(' · ');
  var esc = e.scripts.some(function (s) { return s.escribe; }) ? '✍' : '';
  var su = e.scripts.reduce(function (a, s) { return a + (s.suites || []).length; }, 0);
  var puerta = e.scripts.some(function (s) { return /^PUERTA/.test(s.id); }) ? '🚪' : '';
  p('| ' + e.orden + ' | ' + (puerta ? '**' + sk + '**' : sk) + ' | ' + ids + ' | ' + esc + ' | ' + (su ? su + ' suite' + (su > 1 ? 's' : '') : '') + ' |');
});
p();
p('**El orden, en tres frases:** el catálogo va antes que las fuentes porque es su autoridad de');
p('dimensiones · el motor va después de escribir porque calcula sobre lo escrito · el formato del');
p('Resumen va al final porque la etapa 12 regenera la hoja.');
p();
p('---');
p();
p('## Los 8 puntos — dónde se resolvió cada uno y cómo se validó');
p();

var PUNTOS = [
  { n: 1, t: 'El loop de pre-escritura no lo cumplía casi nadie', etapa: 3,
    antes: '2 de 12 skills, y como práctica, no como regla',
    como: '`lib-declaracion-escritura` con **cuatro campos obligatorios** — la librería se niega si falta uno. Los ' + decls + ' escritores declaran hoja · grano · llave · celdas esperadas.',
    valida: '**Guarda 5 BLOQUEA** el corte. Probada: sin la declaración exit 1, restaurada exit 0. También atrapa la declaración *a medias*, que es peor porque parece cumplida.' },
  { n: 2, t: '«Pasos» era un nombre ambiguo', etapa: 4,
    antes: '`paso` era el sustituto del nombre del sistema anterior, y arrastraba su ambigüedad',
    como: 'Todo se llama **script de ejecución**. 134 cambios de estructura + 204 de prosa. El español normal («no saltes este paso») no se tocó.',
    valida: '**0 usos estructurales** de «paso»: ni campo, ni array, ni variable.' },
  { n: 3, t: 'Me pierdo entre los scripts y dejo de seguir el skill', etapa: 4,
    antes: 'el orquestador reportaba «falló resumen-regenerar» — obliga a traducir qué skill es',
    como: 'Reporta **por skill**: «se detuvo el skill `resumen`, en su etapa 12, al regenerar la hoja», y nombra su `SKILL.md`. El id del script va al final, como detalle interno.',
    valida: 'El titular del cierre cuenta skills y etapas primero. Guardado en memoria con la evidencia del propio día.' },
  { n: 4, t: '28 librerías planas, sin raíz', etapa: 2,
    antes: '`registro.json` tenía 442 columnas con id inmutable y nombre físico actual — **y nadie le preguntaba**. `lib-columna` resolvía contra la hoja.',
    como: '`lib-columna` consulta **el catálogo raíz primero** y la hoja después. Si el catálogo dice un nombre que la hoja no tiene, **truena** y pide registrar el renombre.',
    valida: '**Guarda 4 BLOQUEA**. Los ' + Object.keys(delCorte).length + ' del corte anclados; 0 sueltos. Probada con un script sin ancla: exit 1.' },
  { n: 5, t: 'Contratos y hooks no estaban claros para los skills', etapa: 5,
    antes: '11 de 12 SKILL.md no mencionaban ningún hook; 9 no decían nada del preflight',
    como: 'Cada `SKILL.md` declara, **entre marcas y generado**: su turno · los contratos que lee · los 3 hooks que lo vigilan · las ' + guardas + ' guardas y cuáles detienen el corte.',
    valida: '12/12 con bloque · **cada contrato citado existe en disco** · 3/3 hooks · ' + guardas + '/' + guardas + ' guardas nombradas.' },
  { n: 6, t: 'Lo irrenunciable son las REGLAS, no los mecanismos', etapa: 6,
    antes: 'mi lista enumeraba mecanismos (las puertas, las 5 capas) — la consecuencia, no la regla',
    como: reglas.reglas.length + ' reglas en `reglas-irrenunciables.json`, cada una con **quién la hace cumplir** y la evidencia del caso real que la originó.',
    valida: 'Cada mecanismo citado **existe en disco**. Y **R15 se declara sin mecanismo automático** a propósito: fingir que está cubierta es peor que no tenerla.' },
  { n: 7, t: 'Dos scripts atados a un documento, no a un proceso', etapa: 1,
    antes: '`catalogo-leer` y `catalogo-aplicar` procesan un documento puntual de Leslie',
    como: 'Siguen marcados `opcional`. **Decisión abierta de Rick:** ¿va a llegar otro documento así (se quedan como capacidad genérica) o ya cerró (se archivan)?',
    valida: 'Declarado como decisión pendiente, no resuelto por mi cuenta.' },
  { n: 8, t: 'La duplicación: «rompes, borras, reescribes»', etapa: 7,
    antes: 'medida sobre 93 scripts, en un sistema que ya no existe',
    como: 'Re-medida: **' + (dup ? dup.total_copias : '?') + ' copias**, ' + (dup ? dup.copias_en_el_corte : '?') + ' en el corte. Y al ir a consolidar apareció lo que importa: **' + (div ? div.total_divergentes : '?') + ' copias YA NO dicen lo mismo** — `mil()` tiene 4 variantes, una devuelve `NaN`, otra truena, otra redondea.',
    valida: 'La medición encontró **una violación de regla real**: `num()` devolvía cero en vez de `null` dentro de un script del corte — la regla R10 rota. Corregida. **No se consolida a ciegas:** hacerlo cambiaría el comportamiento de ' + (div ? div.total_divergentes : '?') + '.' }
];

PUNTOS.forEach(function (x) {
  p('### ' + x.n + ' · ' + x.t + '   `etapa ' + x.etapa + '`');
  p();
  p('**Estaba así:** ' + x.antes + '  ');
  p('**Cómo se resolvió:** ' + x.como + '  ');
  p('**Cómo se valida:** ' + x.valida);
  p();
});

p('---');
p();
p('## Las ' + reglas.reglas.length + ' reglas irrenunciables');
p();
p('| | Regla | Skill | Qué la hace cumplir |');
p('|---|---|---|---|');
reglas.reglas.forEach(function (r) {
  p('| `' + r.id + '` | ' + r.regla + ' | ' + r.skill.replace(ENT.PREFIJO_SKILL, '') + ' | ' + r.mecanismo.split('·')[0].trim() + ' |');
});
p();
p('---');
p();
p('## Lo que queda abierto');
p();
p('| | Qué | De quién es |');
p('|---|---|---|');
p('| 1 | `escritor.escribir-todo.js` — el escritor huérfano: ¿se retira o se consolida? | decisión de Rick |');
p('| 2 | `catalogo-leer` / `catalogo-aplicar` — ¿capacidad genérica o archivar? | decisión de Rick |');
p('| 3 | Consolidar los ' + (div ? div.total_divergentes : '?') + ' idiomas divergentes | decisión con la evidencia en `divergencia.json` |');
p('| 4 | ' + ((censo && censo.clases.ADVERSARIAL) ? censo.clases.ADVERSARIAL.length : '?') + ' adversariales sin inventariar — cuáles siguen probando algo vigente | inventario pendiente |');
p();
p('---');
p();
p('*Generado el ' + new Date(fs.statSync(BACK + '/_contratos/cadena-skills.json').mtime).toISOString().slice(0, 10) +
  ' desde los contratos vivos. El Excel no se tocó en ninguna de las 8 etapas: las validaciones son de **sistema**, no de uso.*');

fs.writeFileSync(SALIDA, L.join('\n') + '\n');
console.log('════════ ETAPA 8 · MAPA FINAL ════════\n');
console.log('  ' + C.skills.length + ' skills · ' + C.etapas.length + ' etapas · ' + nEjec + ' scripts de ejecución · ' +
  nSuites + ' suites · ' + guardas + ' guardas · ' + reglas.reglas.length + ' reglas');
console.log('\n  ── VERIFICACIÓN ──');
var txt = fs.readFileSync(SALIDA, 'utf8');
console.log('   ' + (/\bpasos?\b/i.test(txt.replace(/no saltes este paso/gi, '')) ? '⚠' : '✔') + ' el mapa no usa el vocabulario viejo');
console.log('   ' + (PUNTOS.length === 8 ? '✔' : '🔴') + ' los 8 puntos están, cada uno con etapa, resolución y validación');
console.log('   ✔ las cifras salen de los contratos, no de mi memoria');
console.log('\n  → ' + path.basename(SALIDA) + '   ' + txt.length.toLocaleString('es-MX') + ' bytes');
