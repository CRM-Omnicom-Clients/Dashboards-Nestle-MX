// ETAPA 5 · Cada SKILL.md declara qué contratos lee, qué hooks lo vigilan y qué le exige el preflight.
//
// 🔴 LA REGLA, DE RICK (26-ago): *«Los hooks, los contratos y todo eso tienen que quedar claros
//    tanto para Claude Code como para los skills.»* Hoy solo están claros para uno de los dos: los
//    hooks viven en `settings.json` —Claude Code los ve— y **11 de los 12 SKILL.md no los mencionan
//    siquiera**. Un skill que no sabe qué lo vigila no puede razonar sobre sus propios límites.
//
// 🔴 SE GENERA, NO SE ESCRIBE A MANO — y por la misma razón que el mapa. Un bloque escrito a mano
//    en 12 archivos se desfasa en cuanto se agrega una guarda: exactamente lo que pasó con el mapa
//    de la cadena, que enseñaba 15 etapas cuando ya eran 17. Aquí el bloque sale del estado real
//    (los contratos que sus scripts leen, los hooks de `settings.json`, las guardas del preflight)
//    y va entre marcas, así que se regenera y no puede mentir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
// los skills se piden: este script ESCRIBE en ellos, y escribir en la copia equivocada dejaría
// los bloques `@DECLARACION` de un sistema describiendo el estado de otro.
var SKILLS = require(__dirname + '/lib-entorno.js').SKILLS;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));

// ── los hooks, leídos de settings.json (la autoridad, no una lista mía)
var hooks = [];
try {
  var S = JSON.parse(fs.readFileSync(H + '/.claude/settings.json', 'utf8'));
  ['PreToolUse', 'PostToolUse'].forEach(function (ev) {
    (S.hooks[ev] || []).forEach(function (g) {
      (g.hooks || []).forEach(function (h) {
        var m = /hook-([a-z-]+)\.js/.exec(h.command || '');
        if (m) hooks.push({ nombre: m[1], evento: ev, matcher: g.matcher || '*' });
      });
    });
  });
} catch (e) { }

// qué vigila cada hook, en una frase — declarado aquí porque es una decisión, no un dato
var QUE_VIGILA = {
  'xlsx-protocolo': 'antes de tocar un `.xlsx` por Bash, inyecta el protocolo de escritura',
  'xlsx-vigilar': 'después de tocar un `.xlsx`, comprueba que se corrieran las 5 capas',
  'columna-literal': 'rechaza escribir un script que lea por literal una columna que ya mordió'
};

// ── las guardas del preflight, leídas del propio archivo de guardas
//
// 🔴 `(?:\\n)?`, no `\\n?` — y la diferencia se comió una guarda entera. `\\n?` hace opcional la
//    LETRA `n`, no el par `\n`: sigue exigiendo la barra invertida. La Guarda 1 imprime sin salto
//    de línea delante, así que no casaba, y los 12 SKILL.md declararon «4 guardas» existiendo 5.
//    Un bloque generado que undercontea es peor que uno escrito a mano: parece autoridad.
//
// 🔴 Y VOLVIÓ A PASAR, por la otra mitad del mismo defecto (29-sep-2026): la **GUARDA 6** («una
//    pieza es su nombre», 15-sep) es una IIFE y su encabezado es un COMENTARIO, `// ══ GUARDA 6 ══`,
//    no un `console.log`. El regex solo conocía una de las dos formas → los 12 declararon 5
//    guardas existiendo 6. **La lección no era «arregla el regex»: era que el encabezado se
//    escribe de más de una manera**, así que aquí se reconocen las dos y no se presume una.
//
// 🔴 EL VEREDICTO TAMBIÉN SE LEE DEL CÓDIGO, no de un mapa. Había un `BLOQUEAN = {2,4,5}` escrito
//    a mano y estaba MAL en dos de seis: la Guarda 1 llama `B()` tres veces (líneas 112/114/153) y
//    los 12 SKILL.md decían «avisa y viaja al handoff». Un skill que leyera su propia declaración
//    creería que un destructivo sin dueño solo avisa, cuando **detiene el corte**. Una guarda puede
//    ser MIXTA —bloquear por un defecto y avisar por otro— y un booleano no sabe decirlo.
var guardas = [];
try {
  var g = fs.readFileSync(D + '/orquestador.guardas.js', 'utf8');
  var reG = /(?:console\.log\('(?:\\n)?══ GUARDA (\d+) · ([^']+?) ══'\)|\/\/ ══ GUARDA (\d+) · ([^═]+?) ══)/g;
  var mG, crudas = [];
  while ((mG = reG.exec(g))) {
    crudas.push({ n: mG[1] || mG[3], nom: (mG[2] || mG[4]).trim().toLowerCase(), pos: mG.index });
  }
  /* 🔴 UNA GUARDA PUEDE LLEVAR LOS DOS ENCABEZADOS, Y CONTARLOS ERA CONTARLA DOS VECES.
   *    La guarda 7 (2-oct-2026) trae el comentario `// ══ GUARDA 7 · … ══` **y** el
   *    `console.log('══ GUARDA 7 · … ══')`: el primero explica por qué existe, el segundo lo
   *    imprime al correr. Los dos son legítimos, pero esta lista contaba 8 habiendo 7 y la línea
   *    de veredictos decía `7⊘ 7BA` — el primer «7» salía sin veredicto porque su segmento
   *    terminaba en el segundo encabezado, antes del código.
   *    Es la MISMA familia que ya mordió dos veces («4 guardas existiendo 5» por el `\n?`, y «5
   *    existiendo 6» por el encabezado en comentario) y la lección vuelve a ser la misma: no se
   *    presume la forma del encabezado. Ahora se agrupa por NÚMERO, que es la identidad de la
   *    guarda — el encabezado es solo cómo se anuncia. `orquestador.guardas.js` ya deduplicaba
   *    así en su propio conteo, y por eso él decía 7 mientras esto decía 8: dos censos del mismo
   *    hecho, discrepando.  */
  var porN = {};
  crudas.forEach(function (x) {
    if (!porN[x.n]) { porN[x.n] = x; return; }
    if (x.pos < porN[x.n].pos) { x.nom = porN[x.n].nom || x.nom; porN[x.n] = x; }   // se queda el PRIMERO
  });
  guardas = Object.keys(porN).sort(function (a, b) { return Number(a) - Number(b); }).map(function (n) { return porN[n]; });

  // el segmento de cada guarda va de su encabezado al de la SIGUIENTE GUARDA (otro número),
  // no al siguiente encabezado: si no, el cuerpo queda fuera y la guarda parece sin veredicto
  guardas.forEach(function (x, i) {
    var seg = g.slice(x.pos, i + 1 < guardas.length ? guardas[i + 1].pos : g.length);
    x.bloquea = /[^A-Za-z0-9_.]B\(/.test(seg);
    x.avisa = /[^A-Za-z0-9_.]A\(/.test(seg);
  });
} catch (e) { }
function veredicto(x) {
  if (x.bloquea && x.avisa) return '🔴 **detiene el corte** por lo grave, avisa por lo demás';
  if (x.bloquea) return '🔴 **detiene el corte**';
  if (x.avisa) return 'avisa y viaja al handoff';
  return '⊘ no emite veredicto — revisar';
}

// ── qué contratos lee cada skill: de sus propios scripts, no de una lista
//
// 🔴 UNA MENCIÓN EN UN COMENTARIO NO ES UNA REFERENCIA (29-sep-2026). Esto leía el archivo entero,
//    así que al DOCUMENTAR que `qcart-movimientos.json` era una cita muerta, el propio comentario
//    volvió a declararlo como contrato del skill y la verificación siguió en rojo señalando el
//    arreglo. Es la regla de los reemplazos masivos aplicada a un lector: hay que distinguir lo
//    que **apunta** a algo de lo que **cuenta** algo. Y ya había morado antes en este sistema —
//    P5 contó una mención en `hallazgos` como dependencia y habría impedido para siempre borrar
//    los duplicados que ese mismo reporte denunciaba.
//    Se descartan las líneas que son comentario COMPLETO; un `// nota` al final de una línea de
//    código se deja pasar a propósito, porque ahí el riesgo de tirar una referencia real es mayor
//    que el de contar una de más.
function sinComentarios(t) {
  return t.split('\n').filter(function (l) { return !/^\s*(\/\/|\*\/|\*|\/\*)/.test(l); }).join('\n');
}
//
// 🔴 Y SE SIGUEN LOS `require` UN NIVEL. Al dejar de contar los comentarios, tres skills pasaron a
//    «0 contratos» — y no porque no leyeran ninguno, sino porque lo leen **a través de una
//    librería**: el script dice `require('lib-esquema.js')` y es la librería la que abre el JSON.
//    El lector anterior fallaba en las dos direcciones a la vez: acreditaba contratos que el script
//    solo MENCIONA y ocultaba los que de verdad lee por interpósita librería. Contar la cita y no
//    la lectura es justo lo contrario de lo que este bloque promete.
// ⚠ NO se ancla en `require(`: en este backend el require lleva un paréntesis dentro —
//   `require(require('os').homedir() + '/.../lib-columna.js')`— y un `[^)]*` no lo cruza. La primera
//   versión no encontró NI UNA librería y el conteo se quedó igual; parecía que nadie leía contratos
//   por librería. Se busca el nombre del archivo, que es lo que de verdad identifica la dependencia.
function libreriasDe(t) {
  var libs = [];
  (t.match(/lib-[a-zA-Z0-9._-]+\.js/g) || []).forEach(function (m) { libs.push(m); });
  return libs;
}
function contratosDe(scripts) {
  var vistos = {};
  var pendientes = scripts.slice(), vistosArch = {};
  while (pendientes.length) {
    var f = pendientes.shift();
    if (vistosArch[f]) continue; vistosArch[f] = 1;
    var p0 = path.join(D, f);
    if (!fs.existsSync(p0)) continue;
    libreriasDe(sinComentarios(fs.readFileSync(p0, 'utf8'))).forEach(function (l) {
      if (!vistosArch[l]) pendientes.push(l);
    });
  }
  Object.keys(vistosArch).forEach(function (f) {
    var p = path.join(D, f);
    if (!fs.existsSync(p)) return;
    var t = sinComentarios(fs.readFileSync(p, 'utf8'));
    (t.match(/_contratos\/([a-zA-Z0-9._-]+\.json)/g) || []).forEach(function (m) {
      vistos[m.replace('_contratos/', '')] = 1;
    });
    (t.match(/_catalogo\/([a-zA-Z0-9._-]+\.json)/g) || []).forEach(function (m) { vistos[m.replace('_catalogo/', '_catalogo/')] = 1; });
  });
  return Object.keys(vistos).sort();
}

var porSkill = {};
C.etapas.forEach(function (e) {
  var s = e.skill;
  porSkill[s] = porSkill[s] || { etapas: [], scripts: [], escribe: false };
  porSkill[s].etapas.push(e.orden);
  e.scripts.forEach(function (n) {
    porSkill[s].scripts.push(n.script);
    (n.suites || []).forEach(function (x) { porSkill[s].scripts.push(x); });
    if (n.escribe) porSkill[s].escribe = true;
  });
});
// el orquestador dirige aunque su etapa sea una sola
porSkill['crm-reporte-orquestador'] = porSkill['crm-reporte-orquestador'] || { etapas: [], scripts: [], escribe: false };

console.log('════════ ETAPA 5 · CONTRATOS, HOOKS Y PREFLIGHT EN CADA SKILL ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  hooks activos en settings.json: ' + hooks.length + '   ·   guardas del preflight: ' + guardas.length + '\n');

var hechos = 0, sinMarca = [];
Object.keys(porSkill).sort().forEach(function (skill) {
  var info = porSkill[skill];
  var p = path.join(SKILLS, skill, 'SKILL.md');
  if (!fs.existsSync(p)) return;
  var corto = skill.replace(ENT.PREFIJO_SKILL, '');
  var contratos = contratosDe(info.scripts);

  var b = [];
  b.push('<!--@DECLARACION-->');
  b.push('## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen');
  b.push('');
  b.push('> Este bloque **se genera** desde el estado real del sistema con');
  b.push('> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se');
  b.push('> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.');
  b.push('');
  b.push('**Su turno:** ' + (info.etapas.length ? 'etapa' + (info.etapas.length > 1 ? 's' : '') + ' ' + info.etapas.join(' · ') : 'dirige la cadena, no toma turno') +
    '   ·   **' + info.scripts.length + ' script(s) de ejecución**' + (info.escribe ? '   ·   **escribe al Excel**' : ''));
  b.push('');
  b.push('**Contratos que lee**');
  b.push('');
  if (contratos.length) contratos.forEach(function (c) { b.push('- `_contratos/' + c + '`'); });
  else b.push('- ninguno directamente — trabaja sobre lo que le entrega el skill anterior');
  b.push('');
  b.push('**Hooks que lo vigilan** — viven en `~/.claude/settings.json`, los dispara Claude Code sin que nadie los invoque');
  b.push('');
  b.push('| Hook | Cuándo | Qué impide |');
  b.push('|---|---|---|');
  hooks.forEach(function (h) {
    b.push('| `hook-' + h.nombre + '` | ' + (h.evento === 'PreToolUse' ? 'antes de' : 'después de') + ' `' + h.matcher + '` | ' + (QUE_VIGILA[h.nombre] || '—') + ' |');
  });
  b.push('');
  b.push('**Lo que le exige el preflight** — las guardas corren solas antes de la etapa 1; ninguna depende de que alguien se acuerde');
  b.push('');
  guardas.forEach(function (g) {
    b.push('- **Guarda ' + g.n + ' · ' + g.nom + '** — ' + veredicto(g));
  });
  if (info.escribe) {
    b.push('');
    b.push('🔴 **Este skill escribe**, así que la Guarda 5 le aplica de lleno: sin su declaración de');
    b.push('pre-escritura en `_preescritura/DECL-*.json`, con los cuatro campos, **el corte no arranca**.');
  }
  b.push('<!--/@DECLARACION-->');

  var txt = fs.readFileSync(p, 'utf8');
  var ini = txt.indexOf('<!--@DECLARACION-->'), fin = txt.indexOf('<!--/@DECLARACION-->');
  var nuevo;
  if (ini >= 0 && fin >= 0) nuevo = txt.slice(0, ini) + b.join('\n') + txt.slice(fin + '<!--/@DECLARACION-->'.length);
  else {
    // se inserta después del frontmatter y del primer encabezado
    var m = /^---\n[\s\S]*?\n---\n/.exec(txt);
    var corte = m ? m[0].length : 0;
    var h1 = txt.indexOf('\n', txt.indexOf('# ', corte));
    var punto = h1 > 0 ? h1 + 1 : corte;
    nuevo = txt.slice(0, punto) + '\n' + b.join('\n') + '\n' + txt.slice(punto);
  }
  console.log('  ' + corto.padEnd(20) + contratos.length + ' contrato(s) · ' + hooks.length + ' hooks · ' + guardas.length + ' guardas' + (info.escribe ? '   ✍ escribe' : ''));
  if (ESCRIBIR) { fs.writeFileSync(p, nuevo); hechos++; }
});

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
console.log('\n  ✔ bloque declarado en ' + hechos + ' SKILL.md');

// ── VERIFICACIÓN DE SISTEMA
console.log('\n  ══ VERIFICACIÓN DE SISTEMA ══');
var sinBloque = [], contratoFantasma = [], sinNombrar = [];
Object.keys(porSkill).forEach(function (skill) {
  var p = path.join(SKILLS, skill, 'SKILL.md');
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8');
  if (t.indexOf('<!--@DECLARACION-->') < 0) { sinBloque.push(skill); return; }
  // 🔴 cada contrato citado tiene que EXISTIR: citar un contrato muerto es peor que no citarlo
  (t.match(/`_contratos\/([a-zA-Z0-9._-]+\.json)`/g) || []).forEach(function (m) {
    var f = m.replace(/[`]/g, '').replace('_contratos/', '');
    if (!fs.existsSync(BACK + '/_contratos/' + f)) contratoFantasma.push(skill.replace(ENT.PREFIJO_SKILL, '') + ' → ' + f);
  });
  // 🔴 SE MIRA DENTRO DEL ARCHIVO, no se compara un conteo contra un literal. Las dos líneas que
  //    había aquí preguntaban `hooks.length === 3` y `guardas.length === 5` e imprimían «están
  //    nombrados en los 12» sin abrir ni uno: un check que no puede fallar por la razón que dice
  //    vigilar. Y encima el `=== 5` se volvió MENTIRA al aparecer la guarda 6 — habría pintado ⚠
  //    justo cuando el bloque por fin decía la verdad.
  var falta = [];
  hooks.forEach(function (h) { if (t.indexOf('hook-' + h.nombre) < 0) falta.push('hook-' + h.nombre); });
  guardas.forEach(function (g) { if (t.indexOf('Guarda ' + g.n + ' · ' + g.nom) < 0) falta.push('guarda ' + g.n); });
  if (falta.length) sinNombrar.push(skill.replace(ENT.PREFIJO_SKILL, '') + ' → ' + falta.join(' '));
});
console.log('   ' + (sinBloque.length ? '🔴' : '✔') + ' los 12 SKILL.md declaran su bloque' + (sinBloque.length ? ': falta ' + sinBloque.join(' · ') : ''));
console.log('   ' + (contratoFantasma.length ? '🔴' : '✔') + ' cada contrato citado existe en disco' +
  (contratoFantasma.length ? ': ' + contratoFantasma.slice(0, 4).join(' · ') : ''));
console.log('   ' + (sinNombrar.length ? '🔴' : '✔') + ' cada SKILL.md nombra los ' + hooks.length + ' hooks y las ' +
  guardas.length + ' guardas que existen en el código' + (sinNombrar.length ? ': ' + sinNombrar.slice(0, 4).join(' · ') : ''));
console.log('   · veredictos leídos del código: ' + guardas.map(function (g) {
  return g.n + (g.bloquea && g.avisa ? 'BA' : g.bloquea ? 'B' : g.avisa ? 'A' : '⊘');
}).join(' '));
process.exit(sinBloque.length || contratoFantasma.length || sinNombrar.length ? 1 : 0);
