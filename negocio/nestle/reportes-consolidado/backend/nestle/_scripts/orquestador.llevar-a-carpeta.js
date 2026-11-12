/*
 * orquestador.llevar-a-carpeta.js — copia el sistema a la carpeta compartida, y lo COMPRUEBA.
 *
 * 🔴 SOLO ESCRIBE DENTRO DE SU PROPIA SUBCARPETA. El destino que eligió Rick es
 *    `…/Archivos de Leslie…/Marcas/CRM General`, que **no es suya**: ahí vive el consolidado
 *    productivo del cliente, el calendario de envíos y la fuente de WhatsApp. Este script crea UNA
 *    subcarpeta y no toca ni lee para escribir nada de lo que ya hay. Si la subcarpeta existe, los
 *    archivos se reemplazan; cualquier cosa fuera de ella es intocable.
 *
 * 🔴 LO QUE PESA NO VIAJA: SE INSTALA. `node_modules` son 236 MB en 9,508 archivos y el runtime de
 *    Node otros 540 MB. Meterlos en una carpeta de SharePoint compartida con el cliente es pedirle
 *    una tormenta de sincronización por algo que `npm install` resuelve en un minuto — y el sistema
 *    solo usa DOS paquetes: `xlsx` (169 usos) y `adm-zip` (48). Lo dice el LEEME y lo comprueba
 *    `orquestador.instalar.js`.
 *
 * 🔴 CADA PIEZA DICE POR QUÉ VIAJA O POR QUÉ NO. Una lista sin motivos se convierte en «copia todo»
 *    o en «faltaba algo» — y faltar un archivo en este sistema no truena: `existsSync` da `false` y
 *    el paso concluye «no hay datos».
 *
 *   node orquestador.llevar-a-carpeta.js --destino "<ruta>"              (seco: dice qué haría)
 *   node orquestador.llevar-a-carpeta.js --destino "<ruta>" --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
var ENT = require(__dirname + '/lib-entorno.js');

var BACK = ENT.BACKEND;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var DESTINO = (function () {
  var i = process.argv.indexOf('--destino');
  if (i < 0 || !process.argv[i + 1]) {
    console.log('🔴 falta --destino "<ruta de la carpeta compartida>"');
    console.log('   p.ej.  --destino "' + ENT.raiz('fuentes_externas') + '\\Marcas\\CRM General"');
    process.exit(1);
  }
  return process.argv[i + 1].replace(/^~/, os.homedir());
})();
/* 🔴 EL DESTINO SE RESUELVE, NO SE CONSTRUYE CON UN NOMBRE FIJO. Esto hacía
 *    `path.join(DESTINO, 'Sistema-Reportes-CRM')` y asumía que el backend va en la raíz de esa
 *    carpeta. Rick la reorganizó el 6-oct para que fuera autocontenida:
 *        Sistema-Reportes-CRM/{ el libro · Fuentes/ · Sistema/ }
 *    o sea que el backend vive en `Sistema/`, no en la raíz. Con el nombre fijo, la siguiente
 *    sincronización habría creado un `_scripts` SUELTO al lado de `Sistema/` — dos copias del
 *    sistema en la misma carpeta, y la de siempre ganando por costumbre.
 *    Se busca el `_MANIFIESTO.json` que este mismo script dejó: él sabe dónde quedó el backend.
 *    Si no hay ninguno, es una instalación nueva y se usa el nombre por defecto. */
var NOMBRE = 'Sistema-Reportes-CRM';
var RAIZ = (function () {
  var i = process.argv.indexOf('--instalacion');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1].replace(/^~/, os.homedir());
  var cand = [
    path.join(DESTINO, NOMBRE, 'Sistema'),   // el layout autocontenido de Rick
    path.join(DESTINO, NOMBRE),              // el layout plano original
    DESTINO                                   // el destino ES la instalación
  ];
  for (var k = 0; k < cand.length; k++) {
    if (fs.existsSync(path.join(cand[k], '_MANIFIESTO.json'))) return cand[k];
  }
  return path.join(DESTINO, NOMBRE);
})();

console.log('════ LLEVAR EL SISTEMA A LA CARPETA COMPARTIDA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');
console.log('  destino : ' + DESTINO);
console.log('  carpeta : ' + NOMBRE + '/     ← lo único que se crea o se toca\n');

if (!fs.existsSync(DESTINO)) {
  console.log('🔴 el destino no existe. Si es de SharePoint, comprueba que esté sincronizado.');
  process.exit(1);
}

/* ── QUÉ VIAJA, cada cosa con su motivo ─────────────────────────────────────────────────────── */
var VIAJA = [
  {
    de: BACK, a: '.', filtro: /^(LEEME\.md|CATALOGO\.md)$/,
    por: '🔴 el LEEME es por donde se empieza: los tres pasos para ponerlo a andar, cómo correr un corte, qué mirar cuando algo falla y las 7 reglas que no se negocian. Sin él esto es una carpeta con 255 scripts.'
  },
  {
    de: BACK + '/_scripts', a: '_scripts', filtro: /\.(js|py)$/,
    por: 'LOS 255, no solo los 64 del corte: las guardas y el censo razonan sobre el conjunto COMPLETO, así que una copia parcial les cambia las cuentas y puede bloquear. Y cuando algo falla, el refutador que lo diagnostica tiene que estar ahí.'
  },
  {
    de: BACK + '/_contratos', a: '_contratos', filtro: /\.(json|js)$/,
    por: 'los scripts los piden por nombre y las guardas los verifican; falta uno y el paso dice «no pude evaluar» en el mejor caso'
  },
  {
    de: BACK + '/_catalogo', a: '_catalogo', filtro: /\.json$/,
    por: 'aquí vive lo que se mantiene A MANO (correcciones.json) — es una ENTRADA del sistema, no una salida que se regenere'
  },
  {
    de: BACK + '/_fuentes', a: '_fuentes', filtro: /\.json$/,
    por: '🔴 LOS BLOQUES SON **ESTADO ACUMULADO**, NO SALIDAS — y creer lo contrario era el error más caro de esta migración. Las descargas de Qcart son una VENTANA (las vigentes cubren 2026-08-01 → 09-28), pero el bloque guarda **3,149 carritos de marzo a septiembre**: es la UNIÓN de todas las descargas procesadas alguna vez. Sin este archivo, marzo-julio —2,356 carritos— desaparecen y no hay forma de recuperarlos, porque esas descargas ya no están. Lo destapó correr la cadena desde la carpeta nueva: el bloque salió con 430 carritos en vez de 3,149, la rejilla con 2,032 en vez de 8,184, y **PUERTA 2 cerró** — mientras email (108) y WhatsApp (19) salían idénticos, que es lo que hizo visible que el problema era solo de Qcart. La regla del sistema es «unión, nunca reemplazo»; un bloque que no viaja rompe la unión por el lado que no se ve.'
  },
  {
    de: BACK + '/_insumos', a: '_insumos', filtro: /\.(json|txt)$/,
    por: 'los volcados de SFMC son ENTRADAS: no los produce la cadena, los trae el MCP. Viajan para que el primer corte se pueda correr sin depender de tener el MCP conectado el día uno; `insumoVigente` elige el más reciente, así que los viejos no estorban.'
  },
  {
    de: BACK + '/_preescritura', a: '_preescritura', filtro: /^DECL-.*\.json$/,
    por: '🔴 LAS 26 DECLARACIONES DE ESCRITURA, y clasificarlas mal dejó la copia sin arrancar. Las metí en el montón de «mediciones de una corrida» y las dejé fuera; la GUARDA 5 las exige antes de que nadie escriba, así que el preflight de la copia BLOQUEÓ con 7 escritores «sin declarar». No eran salidas: cada una dice qué escribe ese script, en qué hoja, con qué grano y con qué llave — es doctrina, como los contratos. La regla es de Rick (26-ago): sin declaración previa el skill descubre los problemas MIENTRAS escribe, y ahí ya es tarde.'
  },
  {
    de: BACK + '/_preescritura/lineas-base', a: '_preescritura/lineas-base', filtro: /\.json$/,
    ultimas: 3,
    por: 'las fotos de la red de seguridad: son el ESTADO ANTERIOR, lo único con lo que se puede demostrar que un corte no perdió nada. 🔴 Viajan solo las 3 MÁS RECIENTES: las 18 son 13.8 MB y son la BITÁCORA de Rick, no un punto de partida. Quien llegue toma la suya el día que corra su primer corte, y para eso le basta tener contra qué comparar. Las demás siguen en el backend de Rick y en git.'
  },
  {
    de: ENT.TOOLS, a: 'tools', filtro: /^(xlsx-safe-save\.js|xlsx-label\.js|xlsx-check\.js|xlsx-validar-fondo\.py|xlsx-orden-celdas\.js|xlsx-render\.py|xlsx-q\.js|xlsx-apply\.js|xlsx-kit\.js|find-file\.js|hook-xlsx-protocolo\.js|hook-columna-literal\.js|hook-xlsx-vigilar\.js)$/,
    por: 'las 5 capas de validación (sin ellas NO se publica nada), el render para mirar el resultado, y los 3 hooks que `orquestador.instalar.js` cablea en la máquina de cada persona'
  },
  {
    de: ENT.TOOLS + '/reportes', a: 'tools/reportes', filtro: /\.(js|md)$/,
    por: 'los guardianes transversales y el guardián de llegada que exige el paso de publicar'
  }
];

var SKILLS = ENT.SKILLS;

/* ── QUÉ **NO** VIAJA, también con su motivo ───────────────────────────────────────────────── */
var NO_VIAJA = [
  ['node_modules  (236 MB · 9,508 archivos)', 'se INSTALA: el sistema usa dos paquetes, `npm install xlsx adm-zip`. Sincronizar 9,508 archivos en una carpeta del cliente es un problema que no hace falta tener.'],
  ['el runtime de Node  (540 MB)', 'se instala en la máquina de cada persona; no es parte del sistema'],
  ['_tmp  (85 MB)', 'es el borrador de cada corrida: se rehace sola'],
  ['_respaldos  (19 MB)', '🔴 son copias del libro del CLIENTE y son el histórico de Rick. No se reparten.'],
  ['_rejilla', 'ESTA si es una salida: se calcula entera desde los bloques en cada corte. (_fuentes y _insumos SI viajan: ver arriba — los bloques son estado acumulado y los volcados son entradas.)'],
  ['el resto de _preescritura  (16 MB)', 'son mediciones de una corrida concreta, no estado del sistema'],
  ['_archivo', 'documentos retirados; están en git si alguien los necesita']
];

function listar(dir, filtro, ultimas) {
  var l;
  try { l = fs.readdirSync(dir).filter(function (f) { return filtro.test(f) && !fs.statSync(path.join(dir, f)).isDirectory(); }); }
  catch (e) { return null; }
  // `ultimas` recorta por fecha de modificación: lo más reciente primero
  if (ultimas) {
    l = l.sort(function (a, b) { return fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs; }).slice(0, ultimas);
  }
  return l;
}
function sha(p) { try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch (e) { return null; } }

console.log('  ── qué viaja');
var total = 0, kb = 0, faltan = [];
VIAJA.forEach(function (v) {
  var fs2 = listar(v.de, v.filtro, v.ultimas);
  if (fs2 === null) { faltan.push(v.de); console.log('     🔴 ' + v.a.padEnd(26) + 'NO EXISTE el origen: ' + v.de); return; }
  var t = fs2.reduce(function (s, f) { return s + fs.statSync(path.join(v.de, f)).size; }, 0);
  total += fs2.length; kb += t / 1024;
  console.log('     ' + v.a.padEnd(26) + String(fs2.length).padStart(4) + ' archivos  ' + String(Math.round(t / 1024)).padStart(6) + ' KB');
  console.log('        ' + v.por);
});
// los skills del sistema
var misSkills = (function () {
  // 🔴 el prefijo se PIDE: con `/^rick-reportes/` escrito aquí, el día del renombre este copiador
  //    habría copiado CERO skills a la carpeta del cliente — y sin fallar, porque un filtro que no
  //    casa nada devuelve una lista vacía, no un error.
  try { return fs.readdirSync(SKILLS).filter(function (d) { return d.indexOf(ENT.PREFIJO_SKILL) === 0; }); } catch (e) { return []; }
})();
console.log('     ' + 'skills'.padEnd(26) + String(misSkills.length).padStart(4) + ' carpetas');
console.log('        los 12 SKILL.md con sus referencias: son el QUÉ HACER. Sin ellos hay scripts y ninguna doctrina.');

console.log('\n  ── qué NO viaja, y por qué');
NO_VIAJA.forEach(function (x) { console.log('     · ' + x[0]); console.log('        ' + x[1]); });

console.log('\n  total que viaja: ' + total + ' archivos · ' + Math.round(kb / 1024) + ' MB  (+ los skills)');

if (faltan.length) { console.log('\n🔴 faltan orígenes: no copio a medias.'); process.exit(1); }

if (!ESCRIBIR) {
  console.log('\n  (seco. Para copiar: --escribir)');
  process.exit(0);
}

/* ── copiar ─────────────────────────────────────────────────────────────────────────────────── */
function copiarDir(de, a, filtro, acc, ultimas) {
  fs.mkdirSync(a, { recursive: true });
  listar(de, filtro, ultimas).forEach(function (f) {
    var o = path.join(de, f), d = path.join(a, f);
    fs.copyFileSync(o, d);
    acc.push({ de: o, a: d, sha: sha(o) });
  });
}
function copiarArbol(de, a, acc) {
  fs.mkdirSync(a, { recursive: true });
  fs.readdirSync(de).forEach(function (n) {
    var o = path.join(de, n), d = path.join(a, n), s;
    try { s = fs.statSync(o); } catch (e) { return; }
    if (s.isDirectory()) copiarArbol(o, d, acc);
    else { fs.copyFileSync(o, d); acc.push({ de: o, a: d, sha: sha(o) }); }
  });
}

console.log('\n  ── copiando');
/* 🔴 `entorno.json` TIENE DOS MITADES Y SOLO UNA ES PORTABLE — y sincronizar a ciegas rompe la
 *    instalación de destino. Lo destapó Rick al reorganizar la carpeta de SharePoint para que fuera
 *    AUTOCONTENIDA (el libro y `Fuentes/` al lado de `Sistema/`): el contrato de allí tiene que
 *    apuntar a ESE layout, no al de la máquina de Rick.
 *      · per-instalación → `raices`, `libro_vivo`, `fuentes`   (dónde vive la data AQUÍ)
 *      · doctrina        → `nomenclatura`, `intocables`, `patrones_prohibidos`, los `que_es`
 *    Es lo mismo que ya decidimos para los hooks: la configuración de máquina se INSTALA, no se
 *    copia. Antes de este arreglo, la primera sincronización habría devuelto el contrato de la
 *    copia al layout viejo — y el sistema se habría quedado buscando un libro que ya no está ahí,
 *    diciendo «no está donde el contrato dice» y culpando al destino.  */
/* 🔴 Y SON DOS FASES, NO UNA — me costó dos intentos y los dos fallaron por orden.
 *    Primero lo puse DESPUÉS de copiar: comparaba el contrato ya pisado contra el origen, no veía
 *    diferencia y no preservaba nada. Luego lo moví ANTES: escribía la mezcla y el bucle de copia
 *    la pisaba a continuación. Lo que hace falta es **capturar antes y restaurar después**, porque
 *    la pieza que se protege es justo la que el bucle va a sobrescribir.
 *    Es la misma lección que el manejador de errores registrado después de la línea que truena: en
 *    un paso que escribe, el orden ES la lógica. */
var PERINST = ['raices', 'libro_vivo', 'fuentes'];
var configDelDestino = (function capturar() {
  var pD = path.join(RAIZ, '_contratos', 'entorno.json');
  if (!fs.existsSync(pD)) return null;             // instalación nueva: se lleva el del origen
  try { return JSON.parse(fs.readFileSync(pD, 'utf8')); } catch (e) { return null; }
})();

function restaurarConfigDelDestino() {
  if (!configDelDestino) return;
  var pD = path.join(RAIZ, '_contratos', 'entorno.json');
  var origen;
  try { origen = JSON.parse(fs.readFileSync(BACK + '/_contratos/entorno.json', 'utf8')); } catch (e) { return; }
  var difieren = PERINST.filter(function (k) {
    return JSON.stringify(configDelDestino[k]) !== JSON.stringify(origen[k]);
  });
  if (!difieren.length) return;                    // esta instalación apunta a lo mismo que el origen
  var mezcla = JSON.parse(JSON.stringify(origen));          // la doctrina, del origen
  PERINST.forEach(function (k) {                             // la ubicación, del destino
    if (k in configDelDestino) mezcla[k] = configDelDestino[k]; else delete mezcla[k];
  });
  fs.writeFileSync(pD, JSON.stringify(mezcla, null, 1), 'utf8');
  // y se RELEE: decir «lo conservé» sin comprobarlo es lo que falló las dos veces anteriores
  var leido = JSON.parse(fs.readFileSync(pD, 'utf8'));
  var ok = difieren.every(function (k) { return JSON.stringify(leido[k]) === JSON.stringify(configDelDestino[k]); });
  console.log('\n  ── `entorno.json`: ' + (ok ? 'se conservó' : '🔴 NO se conservó') + ' la configuración DE ESTA INSTALACIÓN');
  console.log('     del destino: ' + difieren.join(' · ') + '   (dónde vive su data)');
  console.log('     del origen : la doctrina (nomenclatura · intocables · patrones · textos)');
  if (ok) console.log('     ✔ releído del disco: ' + (leido.raices && leido.raices.proyecto && leido.raices.proyecto.relativo_al_backend
    ? 'proyecto = relativo_al_backend ' + leido.raices.proyecto.relativo_al_backend : 'confirmado'));
}

var copiados = [];
VIAJA.forEach(function (v) { copiarDir(v.de, path.join(RAIZ, v.a), v.filtro, copiados, v.ultimas); });
misSkills.forEach(function (d) { copiarArbol(path.join(SKILLS, d), path.join(RAIZ, 'skills', d), copiados); });

/* 🔴 EL COPIADOR AÑADE PERO NO RETIRA, y eso dejó la copia con VEINTICINCO carpetas de skill donde
 *    hay trece: al renombrar `rick-reportes-*` a `crm-reporte-*` copió las nuevas y dejó las viejas
 *    al lado. Nadie habría fallado por eso — simplemente la carpeta del cliente tendría dos
 *    versiones del mismo skill y quien llegara no sabría cuál manda. Es el mismo defecto que el
 *    escritor de hojas, que empareja contra lo que ya existe y no retira lo que sobra.
 *
 * 🔴 Y SOLO SE BORRA LO QUE ESTE SCRIPT PUSO: una carpeta de skill con el prefijo del contrato, o
 *    una que lo tuviera con un prefijo anterior declarado en `nomenclatura.historia`. Nada más.
 *    Borrar «lo que no reconozco» en una carpeta compartida con el cliente es como se destruye
 *    trabajo ajeno, y aquí ya hay precedente: `rm` se llevó 113 scripts una vez. */
var prefijosConocidos = [ENT.PREFIJO_SKILL].concat(
  (((ENT.cfg().nomenclatura || {}).historia) || []).map(function (h) { return h.de; })
).filter(Boolean);
var sobran = [];
try {
  fs.readdirSync(path.join(RAIZ, 'skills')).forEach(function (d) {
    var esDeSkill = prefijosConocidos.some(function (p) { return d.indexOf(p) === 0; });
    var sigueViva = misSkills.indexOf(d) >= 0;
    if (esDeSkill && !sigueViva) sobran.push(d);
  });
} catch (e) { }
if (sobran.length) {
  console.log('\n  ── retirando ' + sobran.length + ' carpeta(s) de skill que ya no existen en el origen');
  sobran.forEach(function (d) {
    fs.rmSync(path.join(RAIZ, 'skills', d), { recursive: true, force: true });
    console.log('     · ' + d);
  });
  console.log('     (solo las que llevan un prefijo declarado en el contrato — lo demás no se toca)');
}

// las carpetas que la cadena necesita para escribir, vacías
['_tmp', '_fuentes', '_insumos', '_rejilla', '_preescritura', '_respaldos'].forEach(function (d) {
  fs.mkdirSync(path.join(RAIZ, d), { recursive: true });
});

/* 🔴 `_tmp` SE VACÍA EN CADA SINCRONIZACIÓN. Las corridas de prueba desde la carpeta nueva dejaron
 *    27 archivos y 8 MB de copias temporales del libro **en la carpeta del cliente** — y OneDrive
 *    las sincroniza igual que si fueran entregables. No son basura inocua: son copias del workbook
 *    del cliente tiradas en su carpeta compartida.
 *    Se borra solo esta carpeta, que la crea este script, y se dice qué se quitó. Nada fuera de
 *    `<destino>/Sistema-Reportes-CRM/_tmp/` se toca jamás. */
var tmpCopia = path.join(RAIZ, '_tmp');
var basura = [];
try { basura = fs.readdirSync(tmpCopia); } catch (e) { }
if (basura.length) {
  var kbT = basura.reduce(function (s, f) { try { return s + fs.statSync(path.join(tmpCopia, f)).size; } catch (e) { return s; } }, 0);
  fs.rmSync(tmpCopia, { recursive: true, force: true });
  fs.mkdirSync(tmpCopia, { recursive: true });
  console.log('     _tmp vaciado: ' + basura.length + ' archivo(s) · ' + Math.round(kbT / 1024) + ' KB de temporales de corridas anteriores');
}
console.log('     ' + copiados.length + ' archivo(s) copiados');
console.log('     6 carpetas de trabajo creadas vacías (_tmp · _fuentes · _insumos · _rejilla · _preescritura · _respaldos)');

/* ── comprobar: no «lo copié», sino «llegó igual» ───────────────────────────────────────────── */
var malos = [], ausentes = [];
copiados.forEach(function (c) {
  if (!fs.existsSync(c.a)) { ausentes.push(c.a); return; }
  if (sha(c.a) !== c.sha) malos.push(c.a);
});

restaurarConfigDelDestino();
console.log('\n  ── comprobado archivo por archivo (sha1, releído del destino)');
console.log('     ' + (ausentes.length ? '🔴 ' + ausentes.length + ' no llegaron' : '✔ los ' + copiados.length + ' están'));
console.log('     ' + (malos.length ? '🔴 ' + malos.length + ' llegaron DISTINTOS: ' + malos.slice(0, 3).join(' · ') : '✔ los ' + copiados.length + ' son idénticos al origen'));

// el manifiesto, en el destino: de dónde salió cada cosa y cuándo
fs.writeFileSync(path.join(RAIZ, '_MANIFIESTO.json'), JSON.stringify({
  cuando: new Date().toISOString(),
  copiado_desde: BACK,
  por: 'orquestador.llevar-a-carpeta.js',
  archivos: copiados.length,
  que_viaja: VIAJA.map(function (v) { return { carpeta: v.a, por_que: v.por }; }),
  que_no_viaja: NO_VIAJA.map(function (x) { return { que: x[0], por_que: x[1] }; }),
  skills: misSkills,
  advertencia: 'Esta carpeta vive en un SharePoint compartido con el equipo de cliente. No es la de Rick.'
}, null, 1), 'utf8');

var fallo = ausentes.length + malos.length;
console.log('\n════ ' + (fallo ? '🔴 la copia NO está íntegra' : '✅ EL SISTEMA ESTÁ EN LA CARPETA — ' + copiados.length + ' archivos, idénticos') + ' ════');
console.log('   → ' + RAIZ);
if (!fallo) {
  console.log('\n   Lo que falta para que corra ahí (lo dice el LEEME):');
  console.log('     1 · npm install xlsx adm-zip   (los dos únicos paquetes)');
  console.log('     2 · node _scripts/orquestador.instalar.js --escribir   (los 3 hooks de esta máquina)');
  console.log('     3 · node _scripts/orquestador.probar-entorno.js        (que el contrato resuelva)');
}
process.exit(fallo ? 1 : 0);
