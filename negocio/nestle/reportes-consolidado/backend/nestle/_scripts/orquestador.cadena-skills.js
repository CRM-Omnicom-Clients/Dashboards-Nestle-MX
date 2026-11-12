// S1 · LA CADENA DE SKILLS — el skill es la unidad, el script vive dentro.
//
// 🔴 QUÉ CAMBIA Y POR QUÉ. Hasta hoy la cadena vivía como un array `SCRIPTS` de 20 SCRIPTS dentro de
//    `orquestador.orquestador.js`, y los skills existían al lado sin mandar sobre nada. Por eso el corte se
//    corría invocando scripts. Rick lo cerró el 25-ago: **la cadena es de SKILLS, los scripts están
//    contenidos en ellos, y la el sistema plano anterior no se vuelve a usar.**
//
// 🔴 EL MODELO, QUE NO ES «UN SKILL = UN TRAMO». Un skill aparece VARIAS veces en la cadena:
//    `qcart` corre en la activación (qcart-activacion) y otra vez al armar sus bloques (qcart-bloque); el escritor corre
//    tres veces (escritor-neutralizar, escritor-datos/escritor-formato-datos, escritor-formato-resumen); el cuadre abre la PUERTA 1 y después la PUERTA 2. Forzar que
//    cada skill fuera contiguo cambiaría el ORDEN REAL de ejecución, que es justo lo que Rick pidió
//    respetar. Así que:
//
//        SKILL  · la unidad de propiedad — su SKILL.md, su contrato, su DoD
//        ETAPA  · una aparición del skill en la cadena, con los scripts que corre ahí
//        SCRIPT   · un script, SIEMPRE dentro de una etapa de un skill
//
//    La cadena es una lista ordenada de ETAPAS. Es literalmente lo que Rick pidió: «skill por skill
//    en toda su cadena de etapas y funcionalidades».
//
// 🔴 Y NO SE ESCRIBE A MANO: se DERIVA del orden real que hoy ejecuta el orquestador, aplicándole
//    un mapa declarado paso→skill. Escribir la cadena a mano crearía una segunda versión del orden
//    que se desincronizaría del que corre — el defecto que este proyecto ya pagó cuatro veces.
//    Si un script del orquestador no tiene skill, esto **BLOQUEA**: un script huérfano significa que
//    «correr la cadena de skills» dejaría fuera parte del corte, en silencio.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var SKDIR = require(__dirname + '/lib-entorno.js').SKILLS;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// ── EL MAPA DECLARADO: qué skill es dueño de cada script ─────────────────────────────────
// Cada entrada dice POR QUÉ ese script pertenece a ese skill. Un mapa sin razones es una lista de
// asignaciones arbitrarias que nadie puede discutir después.
var DUENO = {
  // ── entrada
  'insumos-validar':   { skill: 'crm-reporte-fuentes-insumos', razon: 'valida las descargas antes de que nada las consuma' },
  'qcart-activacion':  { skill: 'crm-reporte-fuentes-qcart',   razon: 'la activación de un link de Qcart es un hecho de Qcart' },
  'catalogo-leer':  { skill: 'crm-reporte-nestle-catalogo', razon: 'lee las correcciones declaradas para el catálogo' },
  'catalogo-aplicar':  { skill: 'crm-reporte-nestle-catalogo', razon: 'las aplica — el catálogo es la autoridad de dimensiones' },
  // ── los cuatro bloques de fuente
  'email-bloque':  { skill: 'crm-reporte-fuentes-email',    razon: 'arma el bloque de email desde SFMC' },
  'qcart-bloque':  { skill: 'crm-reporte-fuentes-qcart',    razon: 'arma carritos y productos' },
  'whatsapp-bloque':  { skill: 'crm-reporte-fuentes-whatsapp', razon: 'arma el bloque de WhatsApp y lo ancla al catálogo' },
  'manual-bloque':  { skill: 'crm-reporte-fuentes-manual',   razon: 'el bloque manual — vacío es su estado normal' },
  // ── las dos puertas, del mismo dueño a propósito
  'PUERTA-1':  { skill: 'crm-reporte-fuentes-cuadre',   razon: 'PUERTA 1 · cruza los cuatro bloques entre ellos y contra el catálogo' },
  'PUERTA-2':   { skill: 'crm-reporte-fuentes-cuadre',   razon: 'PUERTA 2 · el reporte contra la rejilla. Las dos puertas, un solo dueño: quien decide si se puede escribir decide también si lo escrito dice la verdad' },
  // 🔴 cuadre-coherencia es del skill de CUADRE porque hace el TERCER cruce, el que ninguna puerta hace:
  //    PUERTA 1 cruza los bloques entre ellos · PUERTA 2 cruza el reporte contra la rejilla ·
  //    cuadre-coherencia cruza HOJA CONTRA HOJA dentro del libro escrito. Mismo oficio, tercer plano.
  'cuadre-coherencia':   { skill: 'crm-reporte-fuentes-cuadre',   razon: 'el tercer cruce: coherencia entre hojas del libro ya escrito. Avisa y NO repara — varias filas las escribió Rick a mano' },
  // 🔴 vacios-medir mide y vacios-llenar escribe, y son de DOS skills distintos a propósito: la decisión de qué va en
  //    una celda vacía es del dueño de la columna, y transcribirla al Excel es del escritor.
  //    Juntarlos en un script sería volver a «escribo para averiguar», que es de donde venimos.
  'vacios-medir':   { skill: 'crm-reporte-orquestador',      razon: 'mide TODAS las celdas vacías y las clasifica con las reglas de cada skill. No escribe' },
  'vacios-llenar':   { skill: 'crm-reporte-escritor',         razon: 'transcribe la tabla ya decidida: N/A con su razón, cero donde el cero es dato, POR DEFINIR a la lista de Rick' },
  // ── el escritor: la doctrina de escritura, tres apariciones
  'escritor-neutralizar':   { skill: 'crm-reporte-escritor', razon: 'neutraliza fórmulas muertas ANTES de escribir — es parte de la doctrina de escritura' },
  'escritor-datos':   { skill: 'crm-reporte-escritor', razon: 'el escritor que obedece los contratos de las fuentes' },
  'escritor-formato-datos':  { skill: 'crm-reporte-escritor', razon: 'anchos y encabezado congelado de las hojas de datos' },
  'escritor-formato-resumen':  { skill: 'crm-reporte-escritor', razon: 'el mismo formateador, sobre el Resumen ya construido' },
  // ── el motor
  'motor-clicks':   { skill: 'crm-reporte-motor', razon: 'clicks por destino — insumo del cálculo' },
  'motor-calculo':   { skill: 'crm-reporte-motor', razon: 'el motor de cálculo: tasas y agregados' },
  'motor-rejilla':  { skill: 'crm-reporte-motor', razon: 'lleva los links a la rejilla' },
  'clicks-hoja':    { skill: 'crm-reporte-motor', razon: 'el detalle y el diccionario de clicks, desde el mismo links.json que alimenta el reporte' },
  'clicks-escribir': { skill: 'crm-reporte-escritor', razon: 'publica Data_Clicks y Dic_Clicks — la hoja con la que Rick doble valida las 9 columnas' },
  // ── el reporte
  'resumen-fusionar':  { skill: 'crm-reporte-resumen', razon: 'fusiona Principal y FUP en una fila' },
  'resumen-regenerar':   { skill: 'crm-reporte-resumen', razon: 'regenera Report_Resumen desde la rejilla' },
  // ── insights
  'insights-redactar':  { skill: 'crm-reporte-nestle-insights', razon: 'redacta la columna de insights' }
};

// el skill que DIRIGE — no tiene scripts propios: recorre la cadena
var DIRIGE = 'crm-reporte-orquestador';

// ── leer el orden REAL del orquestador ─────────────────────────────────────────────────
var src = fs.readFileSync(BACK + '/_scripts/orquestador.orquestador.js', 'utf8');
var m = /SCRIPTS\s*=\s*\[([\s\S]*?)\n\];/.exec(src);
if (!m) { console.log('🔴 no pude leer SCRIPTS de orquestador.orquestador.js'); process.exit(1); }
// 🔴 SE CAPTURAN TODAS LAS OPCIONES DEL SCRIPT, no solo su nombre. La cadena de skills pasa a ser
//    lo que EJECUTA el orquestador, así que si aquí se pierde `salida`, `sinFlag` o `args`, los
//    scripts dejan de encadenarse: escritor-datos escribiría `_n4.xlsx` y el siguiente leería el archivo vivo
//    sin sus cambios. Una migración que pierde metadatos por el camino no es una migración.
// ⚠ Y SE PARTE POR OBJETO, NO POR LÍNEA. La primera versión leía línea a línea y `escritor-formato-resumen` ocupa DOS:
//   se quedó sin `salida`, sin `sinFlag` y sin `args`. El paso habría corrido sin `--hoja` (o sea,
//   formateando las hojas equivocadas) y su salida no se habría publicado — en silencio, porque un
//   paso que corre sin fallar parece que funcionó. Los scripts no tienen llaves anidadas, así que
//   `\{[^{}]*\}` los aísla enteros aunque abarquen varias líneas.
var SCRIPTS = [];
(m[1].match(/\{[^{}]*\}/g) || []).forEach(function (bloque) {
  var id = /id:\s*'([^']+)'/.exec(bloque);
  if (!id) return;
  var p = { id: id[1] };
  bloque.replace(/(\w+):\s*(?:'([^']*)'|(true|false)|(\d+))/g, function (_, k, s, b, n) {
    if (k === 'id') return _;
    p[k] = s !== undefined ? s : b !== undefined ? (b === 'true') : Number(n);
    return _;
  });
  SCRIPTS.push(p);
});
// y las suites de cada script
var ms = /SUITES\s*=\s*\{([\s\S]*?)\n\};/.exec(src);
var SUITES = {};
if (ms) {
  // 🔴 LA LLAVE PUEDE IR ENTRECOMILLADA — y no contemplarlo borró las 13 suites en silencio.
  //    El regex decía `(\w+):` y los ids nuevos llevan guion (`'email-bloque':`), así que dejó de
  //    casar con TODAS. La cadena siguió generándose, válida y sin suites: cero rojo, cero aviso,
  //    trece validaciones desaparecidas. Es el modo de fallo más caro del sistema — no truena,
  //    devuelve vacío, y el vacío se lee como «no hay».
  ms[1].replace(/'?([\w-]+)'?\s*:\s*\[([^\]]*)\]/g, function (_, k, v) {
    SUITES[k] = (v.match(/'[^']+'/g) || []).map(function (x) { return x.replace(/'/g, ''); });
    return _;
  });
}

console.log('════════ S1 · CADENA DE SKILLS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  el orquestador ejecuta hoy ' + SCRIPTS.length + ' scripts, en este orden.\n');

// ── 🔴 EL GUARD: ningún script sin skill ─────────────────────────────────────────────────
var huerfanos = SCRIPTS.filter(function (p) { return !DUENO[p.id]; });
if (huerfanos.length) {
  console.log('  🔴 SCRIPTS SIN SKILL — la cadena no se puede declarar:');
  huerfanos.forEach(function (p) { console.log('     ' + p.id.padEnd(6) + p.nom + '   (' + p.script + ')'); });
  console.log('\n     Un script huérfano significa que «correr la cadena de skills» dejaría fuera');
  console.log('     parte del corte, en silencio. Dale dueño en el mapa DUENO y vuelve a correr.');
  process.exit(1);
}
console.log('  ✔ los ' + SCRIPTS.length + ' scripts tienen skill dueño\n');

// ── armar las ETAPAS: scripts consecutivos del mismo skill se agrupan ────────────────────
var ETAPAS = [];
SCRIPTS.forEach(function (p) {
  var sk = DUENO[p.id].skill;
  var ult = ETAPAS[ETAPAS.length - 1];
  // el script se lleva TODAS sus opciones + su suite + por qué pertenece a este skill
  var paso = {};
  Object.keys(p).forEach(function (k) { paso[k === 'nom' ? 'nombre' : k] = p[k]; });
  paso.suites = SUITES[p.id] || [];
  paso.razon = DUENO[p.id].razon;
  // 🔴 EL SCRIPT LLEVA EL NOMBRE DE SU SKILL (Rick, 25-ago). Un `escritor-datos` suelto no dice de quién es, y
  //    leyendo un log de `escritor-neutralizar · insumos-validar · qcart-activacion…` es fácil creer que se está corriendo una el sistema plano anterior.
  //    `escritor/escritor-datos` deja ver, en cada línea, que el que manda es el SKILL y el script es su pieza.
  paso.etiqueta = sk.replace(ENT.PREFIJO_SKILL, '') + '/' + p.id;
  if (ult && ult.skill === sk) { ult.scripts.push(paso); return; }
  ETAPAS.push({ orden: ETAPAS.length + 1, skill: sk, scripts: [paso] });
});

// ── ¿existe el SKILL.md de cada skill? ─────────────────────────────────────────────────
var skills = {};
ETAPAS.forEach(function (e) { skills[e.skill] = skills[e.skill] || { etapas: [], scripts: 0 }; });
skills[DIRIGE] = skills[DIRIGE] || { etapas: [], scripts: 0, dirige: true };
ETAPAS.forEach(function (e) { skills[e.skill].etapas.push(e.orden); skills[e.skill].scripts += e.scripts.length; });

console.log('  ── LA CADENA, ETAPA POR ETAPA ────────────────────────────────────────');
ETAPAS.forEach(function (e) {
  var existe = fs.existsSync(path.join(SKDIR, e.skill, 'SKILL.md'));
  console.log('   ' + String(e.orden).padStart(2) + '  ' + (existe ? '  ' : '🔴') + ' ' + e.skill.replace(ENT.PREFIJO_SKILL, '').padEnd(20) +
    e.scripts.map(function (n) { return n.id + (n.puerta ? '🚪' : ''); }).join(' · '));
});

console.log('\n  ── LOS SKILLS ────────────────────────────────────────────────────────');
var faltan = [];
Object.keys(skills).sort().forEach(function (s) {
  var existe = fs.existsSync(path.join(SKDIR, s, 'SKILL.md'));
  if (!existe) faltan.push(s);
  console.log('   ' + (existe ? '✔' : '🔴') + ' ' + s.padEnd(34) +
    (skills[s].dirige ? 'DIRIGE la cadena' : skills[s].etapas.length + ' etapa(s) · ' + skills[s].scripts + ' paso(s)') +
    (existe ? '' : '   ← FALTA SKILL.md'));
});
console.log('\n   skills: ' + Object.keys(skills).length + '   ·   etapas: ' + ETAPAS.length + '   ·   scripts: ' + SCRIPTS.length +
  (faltan.length ? '   🔴 faltan ' + faltan.length + ' SKILL.md' : '   ✔ todos con SKILL.md'));

// ══ FASE 6 · LO QUE NO CORRE EN EL CORTE TAMBIÉN SE DECLARA ═══════════════════════════
//
// 🔴 «NINGUNO HUÉRFANO» NO ES SOLO PARA LOS 20 DEL CORTE. Hay 128 scripts vivos y la cadena solo
//    declaraba 33 (20 scripts de ejecución + 13 suites). Los otros 95 —refutadores, herramientas, el escritor
//    único— existían sin figurar en ninguna parte: cualquiera podía correr uno y nadie sabría de
//    quién era ni qué papel tenía. Que 10 de ellos ESCRIBAN el Excel lo vuelve grave.
//
// 🔴 Y NO SE METEN EN LAS ETAPAS. Un refutador no es un script de ejecución del corte: si entrara como etapa, la
//    cadena lo correría en cada ciclo y tardaría el triple. Van en `fuera_de_ciclo`: tienen skill
//    y papel declarados, pero no turno. Declarar no es lo mismo que ejecutar.
var censoPath = BACK + '/_contratos/orquestador.censo-scripts.json';
var fueraDeCiclo = [];
try {
  var cen = JSON.parse(fs.readFileSync(censoPath, 'utf8'));
  var enEtapas = {};
  ETAPAS.forEach(function (e) { e.scripts.forEach(function (n) { enEtapas[n.script] = 1; (n.suites || []).forEach(function (s) { enEtapas[s] = 1; }); }); });
  ['ADVERSARIAL', 'HERRAMIENTA', 'ESCRITOR', 'FUERA-DE-CICLO', 'CONGELADO', 'RETIRADO', 'VIVO'].forEach(function (clase) {
    (cen.clases[clase] || []).forEach(function (x) {
      if (enEtapas[x.f]) return;                       // ya tiene turno en una etapa
      var props = (cen.propiedades || {})[x.f] || {};
      fueraDeCiclo.push({
        script: x.f, skill: x.skill, papel: clase,
        escribe_excel: !!props.escribe_excel,
        // 🔴 un script que ESCRIBE y no tiene turno es el que hay que vigilar: puede tocar el
        //    archivo sin pasar por ninguna puerta. Se declara para que se vea, no para permitirlo.
        vigilar: !!props.escribe_excel && clase !== 'ESCRITOR'
      });
    });
  });
} catch (e) { }

var salida = {
  version: 3,
  fuera_de_ciclo: fueraDeCiclo,
  nota_fuera_de_ciclo: 'Tienen skill y papel declarados, pero NO turno en el corte. Declarar no es ejecutar.',
  que_es: 'La cadena de SKILLS. El skill es la unidad; el script vive dentro de una etapa de un skill.',
  regla: 'La el sistema plano anterior no se vuelve a usar (Rick, 25-ago-2026). Un paso solo se corre desde su skill.',
  derivado_de: 'el array SCRIPTS de orquestador.orquestador.js — el orden que de verdad se ejecuta',
  dirige: DIRIGE,
  skills: Object.keys(skills).sort().map(function (s) {
    return { id: s, dirige: !!skills[s].dirige, etapas: skills[s].etapas, scripts: skills[s].scripts,
             tiene_skill_md: fs.existsSync(path.join(SKDIR, s, 'SKILL.md')) };
  }),
  etapas: ETAPAS
};
// ── VALIDACIÓN DE LA FASE 6 ────────────────────────────────────────────────────────────
console.log('\n  ══ VALIDACIÓN DE LA FASE 6 ══');
var enEtapas2 = {};
ETAPAS.forEach(function (e) { e.scripts.forEach(function (n) { enEtapas2[n.script] = 1; (n.suites || []).forEach(function (s) { enEtapas2[s] = 1; }); }); });
var declarados = Object.keys(enEtapas2).length + fueraDeCiclo.length;
var vivosEnDisco = 0, sinDeclarar = [];
try {
  var cen2 = JSON.parse(fs.readFileSync(censoPath, 'utf8'));
  ['VIVO', 'ESCRITOR', 'ADVERSARIAL', 'HERRAMIENTA', 'FUERA-DE-CICLO', 'CONGELADO', 'RETIRADO'].forEach(function (k) {
    (cen2.clases[k] || []).forEach(function (x) {
      vivosEnDisco++;
      if (!enEtapas2[x.f] && !fueraDeCiclo.some(function (y) { return y.script === x.f; })) sinDeclarar.push(x.f);
    });
  });
} catch (e) { }
console.log('   ' + (sinDeclarar.length === 0 ? '✔' : '🔴') + ' todo lo vivo está declarado: ' + declarados + ' de ' + vivosEnDisco + (sinDeclarar.length ? '   falta ' + sinDeclarar.slice(0, 5).join(' · ') : ''));
console.log('   ✔ con turno en el corte: ' + Object.keys(enEtapas2).length + '   ·   declarados sin turno: ' + fueraDeCiclo.length);
var sinSkill2 = fueraDeCiclo.filter(function (x) { return !x.skill; });
console.log('   ' + (sinSkill2.length === 0 ? '✔' : '🔴') + ' cada uno sin turno tiene skill: ' + (fueraDeCiclo.length - sinSkill2.length) + ' de ' + fueraDeCiclo.length);
var vigilar = fueraDeCiclo.filter(function (x) { return x.vigilar; });
console.log('   ' + (vigilar.length ? '⚠ ' : '✔ ') + 'escriben el Excel SIN turno en el corte: ' + vigilar.length);
vigilar.forEach(function (x) { console.log('      ⚠ ' + x.script.padEnd(36) + x.skill.replace(ENT.PREFIJO_SKILL, '') + '  (' + x.papel + ')'); });

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(faltan.length ? 1 : 0); }
fs.writeFileSync(BACK + '/_contratos/cadena-skills.json', JSON.stringify(salida, null, 1));
console.log('\n  → _contratos/cadena-skills.json');
if (faltan.length) { console.log('  🔴 pero faltan ' + faltan.length + ' SKILL.md: la cadena no se puede correr todavía.'); process.exit(1); }
