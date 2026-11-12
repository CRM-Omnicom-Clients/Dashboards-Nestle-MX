/*
 * lib-entorno.js — LAS RUTAS SE PIDEN, NO SE ESCRIBEN.
 *
 * 🔴 POR QUÉ EXISTE. Medido el 2-oct-2026 antes de migrar: **165 scripts llevan escrita la carpeta
 *    del cliente, 231 la del backend y 49 el nombre del libro**, y no había ningún contrato de
 *    rutas. O sea que el sistema entero estaba cableado a una máquina, un OneDrive, una carpeta y
 *    un nombre de archivo. Para otra persona no arranca.
 *
 * 🔴 ES LA MISMA REGLA QUE YA RIGE PARA LAS COLUMNAS, aplicada a las rutas. `lib-columna` existe
 *    porque un literal devuelve `undefined` sin avisar; una ruta literal hace lo mismo pero peor:
 *    `fs.existsSync` devuelve `false` y el script concluye «no hay datos» sobre una carpeta que sí
 *    existe, solo que en otro sitio. Aquí no hay `false` silencioso: **si una ruta no resuelve, se
 *    truena con el motivo y qué hacer**.
 *
 * 🔴 LAS CUATRO RAÍCES, Y POR QUÉ SOLO DOS SON EL PROBLEMA. `<TOOLS>` y `<BACKEND>` cuelgan de
 *    `~/.claude/` y ya eran portables. Las que no viajan son las dos de OneDrive: la carpeta del
 *    cliente y la que Leslie comparte — su nombre lleva el tenant y la persona, así que en el
 *    OneDrive de alguien más montan distinto, o no montan.
 *
 * 🔴 SE RESUELVE BUSCANDO, NO ADIVINANDO. `entorno.json` declara un PATRÓN por raíz, no una ruta:
 *    así el mismo contrato sirve en cualquier máquina. Si una ruta configurada existe, manda esa
 *    (es lo que permite apuntar a la carpeta de SharePoint tras la migración). Si no, se busca bajo
 *    el home. Si hay varias candidatas NO se elige una: se declaran todas y se truena — elegir la
 *    primera es cómo un sistema acaba escribiendo en la carpeta equivocada de un cliente.
 *
 *   var E = require('<...>/lib-entorno.js');
 *   E.PROYECTO   E.BACKEND   E.TOOLS   E.LIBRO   E.fuente('whatsapp')
 *   E.diagnostico()   → qué resolvió y cómo, para el que llega nuevo
 */
var fs = require('fs'), os = require('os'), path = require('path');

/* 🔴 ESTE ARCHIVO SE ENCUENTRA A SÍ MISMO, Y ES EL QUE MÁS LO NECESITA. Decía
 *    `path.join(os.homedir(), '.claude', 'reportes-backend', 'nestle')`, y de ahí lee el contrato:
 *    copiado a la carpeta de SharePoint habría leído el `entorno.json` de **~/.claude de Rick**, y
 *    con él toda la resolución de rutas. La copia nueva parecería funcionar mientras en realidad
 *    obedeciera a la vieja — la fachada, en el único archivo del que depende todo lo demás.
 *    `__dirname` es la carpeta de ESTE archivo, así que el backend es su padre, siempre.
 *
 * 🔴 Y MI PROPIO BARRIDO NO LO VIO. Buscaba el literal `'/.claude/reportes-backend/nestle'`, y un
 *    `path.join(home, '.claude', 'reportes-backend', 'nestle')` reparte esa ruta en argumentos
 *    sueltos: ningún trozo contiene la cadena que yo buscaba, así que el barrido salió verde
 *    dejando anclado justo el archivo que peor podía estarlo. Es la misma familia de siempre —
 *    presumir la FORMA en que algo está escrito — y ya me costó el home aliasado y el nombre del
 *    libro partido en dos. El barrido del migrador mira ahora las dos formas. */
var BACKEND = path.resolve(__dirname, '..');
/* 🔴 UN MENSAJE BUENO SEPULTADO EN UN STACK TRACE NO ES UN MENSAJE BUENO.
 *    La batería adversarial lo destapó: al correr el sistema en una máquina donde la carpeta del
 *    cliente no existe, el error dice exactamente lo que hay que saber —qué buscó, con qué
 *    segmentos, y en qué clave del contrato escribir la ruta— pero sale envuelto en doce líneas de
 *    `at Module._load (node:internal/modules/cjs/loader:1335:12)`. Para quien llega nuevo, esas
 *    tres líneas útiles quedan enterradas en una pared de ruido que parece un crash del sistema.
 *
 *    Se arregla aquí y no en los 258 scripts: TODOS cargan esta librería, así que basta con que
 *    ella atienda el error. Solo toca los suyos —los que empiezan por el marcador de ENTORNO—; a
 *    cualquier otro error lo deja pasar tal cual, porque un stack sí es lo que hace falta cuando
 *    el fallo es un defecto de programación y no una pieza que falta. */
var MARCA = '🔴 ENTORNO ·';
process.on('uncaughtException', function (e) {
  var m = String((e && e.message) || '');
  if (m.indexOf(MARCA) !== 0) throw e;          // no es mío: que se vea el stack completo
  console.error('');
  console.error('════════════════════════════════════════════════════════════');
  m.split('\n').forEach(function (l) { console.error('  ' + l); });
  console.error('════════════════════════════════════════════════════════════');
  console.error('  (el contrato de rutas es `_contratos/entorno.json`.');
  console.error('   Para ver todo lo que resuelve y lo que no:');
  console.error('     node ' + path.join(BACKEND, '_scripts', 'orquestador.instalar.js') + ')');
  console.error('');
  process.exit(1);
});

var RUTA_CFG = path.join(BACKEND, '_contratos', 'entorno.json');

/* 🔴 LAS HERRAMIENTAS SE BUSCAN EN TRES SITIOS, en este orden, y el primero que exista gana:
 *      1 · lo que fije el contrato en `raices.tools.ruta` — para una máquina donde estén aparte
 *      2 · `<backend>/tools` — para que la carpeta de SharePoint pueda llevarlas consigo
 *      3 · `~/.claude/tools` — la de esta máquina, que es donde están hoy
 *    De aquí salen `node_modules` y las 5 capas de validación del Excel. Si no aparece, NO se
 *    inventa una ruta: se declara, porque un `node_modules` que no está se manifiesta como
 *    «cannot find module 'xlsx'» en el paso 3 de un corte, y no como un problema de instalación. */
var TOOLS = (function () {
  var cand = [];
  try {
    var c = JSON.parse(fs.readFileSync(RUTA_CFG, 'utf8'));
    var fija = ((c.raices || {}).tools || {}).ruta;
    if (fija) cand.push(String(fija).replace(/^~/, os.homedir()));
  } catch (e) { /* si el contrato no se puede leer, `leerCfg()` lo dirá con detalle */ }
  cand.push(path.join(BACKEND, 'tools'));
  cand.push(path.join(os.homedir(), '.claude', 'tools'));
  for (var i = 0; i < cand.length; i++) {
    try { if (fs.statSync(cand[i]).isDirectory()) return cand[i]; } catch (e) { }
  }
  return cand[cand.length - 1];     // la última, para que el mensaje de error diga dónde buscó
})();

function leerCfg() {
  try { return JSON.parse(fs.readFileSync(RUTA_CFG, 'utf8')); }
  catch (e) {
    throw new Error('🔴 ENTORNO · no pude leer `_contratos/entorno.json` (' + String(e.message).slice(0, 60) + ').\n' +
      '   Ese archivo declara dónde vive la carpeta del cliente y las fuentes externas.\n' +
      '   Sin él el sistema no sabe a qué proyecto pertenece.');
  }
}
var CFG = leerCfg();

/* 🔴 LA BÚSQUEDA ESTÁ ACOTADA A PROPÓSITO. Recorrer el home entero tarda y encuentra basura
 *    (copias en Descargas, respaldos viejos). Se busca solo bajo las carpetas que el contrato
 *    declara como raíces de búsqueda, y a la profundidad que declara. Una búsqueda sin límite es
 *    cómo se termina escribiendo en la copia de un respaldo creyendo que es el vivo. */
function buscar(raices, segmentos, hondo) {
  var hallados = [], vistos = {};
  /* 🔴 `dirent.isDirectory()` NO SIRVE AQUÍ, y costó la primera versión entera: en Windows las
   *    carpetas de OneDrive son JUNCTIONS. Para `OneDrive - OneWorkplace` devuelve
   *    `isDirectory=false` e `isSymbolicLink=true`, así que el recorrido saltaba justo la única
   *    rama que importa: 3,822 carpetas visitadas y 0 halladas, sobre una carpeta que existe.
   *    `statSync` SÍ sigue el enlace y dice `true`. Es el caso de siempre: «mi lector no lo
   *    devuelve» no es «no está». */
  function esCarpeta(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
  function recorrer(dir, nivel) {
    if (nivel > hondo) return;
    // seguir enlaces puede dar vueltas: se recuerda la ruta REAL, no la escrita
    var real; try { real = fs.realpathSync(dir); } catch (e) { real = dir; }
    if (vistos[real]) return;
    vistos[real] = 1;
    var hijos;
    try { hijos = fs.readdirSync(dir); } catch (e) { return; }
    hijos.forEach(function (n) {
      if (/^[._~$]/.test(n)) return;                      // ocultas, temporales y `~$` de Excel
      var p = path.join(dir, n);
      if (!esCarpeta(p)) return;
      if (segmentos.every(function (s) { return p.toLowerCase().indexOf(s.toLowerCase()) >= 0; })) {
        if (hallados.indexOf(p) < 0) hallados.push(p);
        return;                                           // no se baja dentro de una ya hallada
      }
      recorrer(p, nivel + 1);
    });
  }
  raices.forEach(function (r) { recorrer(r.replace(/^~/, os.homedir()), 0); });
  return hallados;
}

/* 🔴 LA BÚSQUEDA SE CACHEA EN DISCO, Y SE INVALIDA SOLA. Recorrer el home cuesta ~3,800 carpetas;
 *    la cadena invoca 43 scripts, así que sin caché la portabilidad se pagaría en minutos por
 *    corte y alguien acabaría fijando la ruta a mano — que es volver al problema.
 *    El caché guarda la ruta JUNTO con el home en que se resolvió, y **se descarta si la ruta ya no
 *    existe**: un caché que no se comprueba es peor que no tenerlo, porque sobrevive a la mudanza
 *    que debía detectar. */
var RUTA_CACHE = path.join(BACKEND, '_tmp', 'entorno-resuelto.json');
/* 🔴 EL CACHÉ TAMBIÉN SE INVALIDA CUANDO CAMBIA LA PREGUNTA, no solo cuando desaparece la
 *    respuesta. Antes solo descartaba una entrada si su ruta ya no existía — y eso no basta:
 *    al reorganizar la carpeta de SharePoint, el contrato pasó a declarar `proyecto` como el
 *    padre del backend, pero el caché seguía devolviendo la carpeta VIEJA de Rick, que **sigue
 *    existiendo**. O sea: el contrato decía una cosa y el sistema obedecía otra, sin fallar.
 *    Eso es peor que un error — es un caché que gana al contrato. Ahora se guarda la huella de
 *    la sección `raices` y, si no coincide, el caché entero se descarta: lo que cambió no es
 *    dónde está la carpeta, es QUÉ carpeta se está pidiendo. */
function huellaDeRaices() {
  try { return require('crypto').createHash('sha1').update(JSON.stringify((CFG || {}).raices || {})).digest('hex').slice(0, 12); }
  catch (e) { return 'sin-huella'; }
}
function leerCache() {
  try {
    var c = JSON.parse(fs.readFileSync(RUTA_CACHE, 'utf8'));
    if (c.home !== os.homedir()) return {};
    if (c.huella_raices !== huellaDeRaices()) return {};     // el contrato cambió: se re-resuelve
    var vivo = {};
    Object.keys(c.raices || {}).forEach(function (k) { if (fs.existsSync(c.raices[k])) vivo[k] = c.raices[k]; });
    return vivo;
  } catch (e) { return {}; }
}
function guardarCache(c) {
  try {
    fs.mkdirSync(path.dirname(RUTA_CACHE), { recursive: true });
    fs.writeFileSync(RUTA_CACHE, JSON.stringify({ home: os.homedir(), huella_raices: huellaDeRaices(), cuando: new Date().toISOString(), raices: c }, null, 1));
  } catch (e) { /* el caché es una comodidad: si no se puede escribir, se busca y ya */ }
}
var cache = leerCache();

function raiz(nombre) {
  if (cache[nombre]) return cache[nombre];
  var d = (CFG.raices || {})[nombre];
  if (!d) throw new Error('🔴 ENTORNO · `entorno.json` no declara la raíz «' + nombre + '».');

  /* 0 · 🔴 RELATIVA AL BACKEND — para una instalación AUTOCONTENIDA, que es la mejor forma de
   *    tenerla. Rick reorganizó la carpeta de SharePoint así:
   *        Sistema-Reportes-CRM/
   *          (Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx   ← el libro
   *          Fuentes/{ WhatsApp · Qcart/ · SFMC/ }               ← las fuentes
   *          Sistema/{ _scripts · _contratos · … }               ← el backend
   *    O sea: el proyecto es el PADRE del backend. Resolverlo así no busca nada, no escribe
   *    ninguna ruta, y no lleva dentro el nombre de la organización ni del usuario — es la misma
   *    idea que `__dirname` para el backend, un nivel más arriba.
   *    Se mira ANTES de `ruta` y de `segmentos` porque es la más fuerte de las tres: si el sistema
   *    y los datos viven juntos, no hay nada que adivinar. */
  if (d.relativo_al_backend) {
    var rel = path.resolve(BACKEND, d.relativo_al_backend);
    if (!fs.existsSync(rel)) {
      throw new Error('🔴 ENTORNO · «' + nombre + '» se declara relativa al backend (`' + d.relativo_al_backend +
        '`) y ahí no hay nada:\n   ' + rel + '\n   El backend está en ' + BACKEND +
        '\n   Si esta instalación no es autocontenida, usa `ruta` o `segmentos` en vez de `relativo_al_backend`.');
    }
    cache[nombre] = rel; guardarCache(cache); return rel;
  }

  // 1 · la ruta fijada a mano manda — es lo que permite apuntar a la carpeta compartida
  if (d.ruta) {
    var fija = d.ruta.replace(/^~/, os.homedir());
    if (!fs.existsSync(fija)) {
      throw new Error('🔴 ENTORNO · «' + nombre + '» está fijada a una ruta que NO existe:\n   ' + fija +
        '\n   Corrige `raices.' + nombre + '.ruta` en `_contratos/entorno.json`, o bórrala para que se busque sola.');
    }
    cache[nombre] = fija; guardarCache(cache); return fija;
  }

  // 2 · si no, se busca por los segmentos que declara
  if (!d.segmentos || !d.segmentos.length) {
    throw new Error('🔴 ENTORNO · «' + nombre + '» no tiene `ruta` ni `segmentos`: no hay forma de encontrarla.');
  }
  var c = buscar(d.buscar_en || ['~'], d.segmentos, d.hondo == null ? 4 : d.hondo);
  if (c.length === 1) { cache[nombre] = c[0]; guardarCache(cache); return c[0]; }
  if (c.length === 0) {
    throw new Error('🔴 ENTORNO · no encontré «' + nombre + '» (' + (d.que_es || '') + ').\n' +
      '   Busqué bajo ' + (d.buscar_en || ['~']).join(' · ') + ' una carpeta cuyo nombre contenga: ' + d.segmentos.join(' + ') + '\n' +
      '   Si en tu máquina está en otro sitio, escríbela en `raices.' + nombre + '.ruta` de `_contratos/entorno.json`.');
  }
  // 🔴 varias: NO se elige. Escribir en la carpeta equivocada de un cliente no se deshace.
  throw new Error('🔴 ENTORNO · «' + nombre + '» resuelve a ' + c.length + ' carpetas y no voy a elegir:\n' +
    c.map(function (x) { return '     ' + x; }).join('\n') +
    '\n   Pon la buena en `raices.' + nombre + '.ruta` de `_contratos/entorno.json`.');
}

function libro() {
  var n = CFG.libro_vivo;
  if (!n) throw new Error('🔴 ENTORNO · `entorno.json` no declara `libro_vivo`.');
  var p = path.join(raiz('proyecto'), n);
  if (!fs.existsSync(p)) {
    throw new Error('🔴 ENTORNO · el libro vivo no está donde el contrato dice:\n   ' + p +
      '\n   ⚠ Y NO busco otro parecido a propósito: escribirle al archivo equivocado es peor que no escribir.' +
      '\n   Si lo renombraron, corrige `libro_vivo` en `_contratos/entorno.json`.');
  }
  return p;
}

function fuente(id) {
  var f = (CFG.fuentes || {})[id];
  if (!f) throw new Error('🔴 ENTORNO · no hay fuente declarada con id «' + id + '». Las que hay: ' + Object.keys(CFG.fuentes || {}).join(' · '));
  var base = f.raiz ? raiz(f.raiz) : raiz('proyecto');
  var p = path.join(base, f.ruta || '');
  if (!fs.existsSync(p)) {
    throw new Error('🔴 ENTORNO · la fuente «' + id + '» (' + (f.que_es || '') + ') no está en:\n   ' + p +
      '\n   ' + (f.si_falta || 'Comprueba que la carpeta esté sincronizada y compartida contigo.'));
  }
  return p;
}

/* 🔴 LA RAÍZ DE LA NUBE SE DEDUCE, NO SE ESCRIBE. `orquestador.publicar.js` barre toda la carpeta de
 *    OneDrive buscando los archivos productivos por patrón, así que necesita su raíz — y la tenía
 *    escrita como `'/OneDrive - OneWorkplace'`. Ese nombre lleva **el de la organización**: en esta
 *    misma máquina fue `OneDrive - Interpublic` hasta la migración a Omnicom, y en la de alguien
 *    externo será otro. Escrito a mano, el barrido no encontraría nada y el script diría «no hay
 *    destinos» — sin fallar, que es el modo de fallo que este sistema ya conoce.
 *    Se saca subiendo desde la raíz del proyecto hasta el primer ancestro que se llame `OneDrive…`,
 *    así que funciona con cualquier organización sin declarar nada. */
/* 🔴 EL PREFIJO DE LOS SKILLS SE PIDE. Estaba escrito en 25 sitios del código —construyendo
 *    nombres (`'crm-reporte-' + sk`) y recortándolos (`skill.replace('crm-reporte-', '')`)— y
 *    en 937 sitios del sistema. Al renombrarlo a `crm-reporte-` eso habría sido un find-replace de
 *    937 ocurrencias que vuelve a hacer falta entero el día que cambie otra vez.
 *    `skillDe('escritor')` da el nombre físico; `cortoDe('crm-reporte-escritor')` da el id lógico.
 *    El id lógico es inmutable; el nombre físico es una decisión que vive en el contrato. */
function prefijoSkills() {
  var p = (CFG.nomenclatura || {}).prefijo_skills;
  if (!p) throw new Error('🔴 ENTORNO · `entorno.json` no declara `nomenclatura.prefijo_skills`.\n' +
    '   De ahí sale el nombre de cada skill (`<prefijo><id>`), y sin él no se puede ni encontrar su SKILL.md.');
  return p;
}
function skillDe(corto) { return prefijoSkills() + String(corto).replace(prefijoSkills(), ''); }
function cortoDe(nombre) { return String(nombre).replace(prefijoSkills(), ''); }

/* 🔴 LOS SKILLS TAMBIÉN SE BUSCAN, y por la misma razón que todo lo demás: VIAJAN con el sistema.
 *    Ocho scripts los leían o los escribían en `~/.claude/skills` fijo —entre ellos el que genera
 *    los bloques `@DECLARACION` y el que verifica la cadena—, así que desde la carpeta de
 *    SharePoint habrían declarado sobre los skills del HOME: otra copia, que puede decir otra
 *    cosa. Y el orquestador mandaba a leer ahí el contrato del skill que acababa de detenerse.
 *    Primero junto al sistema (`<backend>/skills`), que es como viaja; si no, los del home. */
var _sk = null;
function skills() {
  if (_sk) return _sk;
  var cand = [];
  var fijo = ((CFG.raices || {}).skills || {}).ruta;
  if (fijo) cand.push(String(fijo).replace(/^~/, os.homedir()));
  cand.push(path.join(BACKEND, 'skills'));
  cand.push(path.join(os.homedir(), '.claude', 'skills'));
  for (var i = 0; i < cand.length; i++) {
    try { if (fs.statSync(cand[i]).isDirectory()) { _sk = cand[i]; return _sk; } } catch (e) { }
  }
  _sk = cand[cand.length - 1];
  return _sk;
}

/* 🔴 `node_modules` NO ESTÁ DONDE ESTÁN LAS HERRAMIENTAS, Y TRATARLO COMO UNA SOLA COSA ROMPIÓ LA
 *    COPIA. Primero resolví un único `TOOLS` para las dos cosas; al probar el sistema desde la
 *    carpeta de SharePoint, `TOOLS` cayó en `<copia>/tools` —que existe, porque la copia SÍ lleva
 *    las 5 capas de validación— y ahí no hay `node_modules`, porque son 236 MB en 9,508 archivos
 *    que a propósito no viajan. Resultado: `Cannot find module 'xlsx'` en la primera línea de cada
 *    script, teniendo los paquetes instalados en la máquina.
 *    Son DOS asuntos: las 5 capas viajan con el sistema; los paquetes se instalan donde sea. Así
 *    que se buscan por separado, y `node_modules` gana el primer sitio donde EXISTA de verdad.
 *    Lo encontró la prueba de correr el sistema desde la carpeta nueva — no se veía leyendo. */
/* la doctrina y los agentes se buscan igual que los skills: viajan con el sistema, y
 * `orquestador.retiro.js` los ESCANEA para saber quién cita a un script antes de retirarlo —
 * buscar en la carpeta equivocada ahí devuelve «nadie lo cita», que es permiso para borrarlo. */
function _junto(nombreCarpeta, claveContrato) {
  var cand = [];
  var fijo = ((CFG.raices || {})[claveContrato] || {}).ruta;
  if (fijo) cand.push(String(fijo).replace(/^~/, os.homedir()));
  cand.push(path.join(BACKEND, nombreCarpeta));
  cand.push(path.join(os.homedir(), '.claude', nombreCarpeta));
  for (var i = 0; i < cand.length; i++) {
    try { if (fs.statSync(cand[i]).isDirectory()) return cand[i]; } catch (e) { }
  }
  return cand[cand.length - 1];
}

var _nm = null;
function nodeModules() {
  if (_nm) return _nm;
  var cand = [];
  var fijo = ((CFG.raices || {}).node_modules || {}).ruta;
  if (fijo) cand.push(String(fijo).replace(/^~/, os.homedir()));
  cand.push(path.join(TOOLS, 'node_modules'));
  cand.push(path.join(BACKEND, 'node_modules'));
  cand.push(path.join(os.homedir(), '.claude', 'tools', 'node_modules'));
  for (var i = 0; i < cand.length; i++) {
    try { if (fs.statSync(cand[i]).isDirectory()) { _nm = cand[i]; return _nm; } } catch (e) { }
  }
  // no se truena: el que lo pide va a fallar al requerir `xlsx`, y ese error es más claro que
  // uno de entorno. Se devuelve el último candidato para que el mensaje diga dónde se buscó.
  _nm = cand[cand.length - 1];
  return _nm;
}

/* 🔴 EL INTÉRPRETE DE PYTHON LLEVABA LA VERSIÓN ESCRITA, EN 36 SCRIPTS:
 *        os.homedir() + '/AppData/Local/Programs/Python/Python313/python.exe'
 *    El día que se instale un 3.14, esos 36 apuntan a una carpeta que ya no existe — y entre ellos
 *    está la CUARTA CAPA de validación del Excel (`xlsx-validar-fondo.py`), que es la que el
 *    protocolo marca como «la que no se salta». Un intérprete que no está no da un error de
 *    instalación: da un paso que no corre.
 *    Se busca en este orden y gana el primero que RESPONDA a `--version`: lo que fije el contrato,
 *    la versión más NUEVA que haya instalada en el perfil, y lo que haya en el PATH. Se prueba
 *    ejecutándolo, no mirando si el archivo existe — un .exe presente puede estar roto, y este
 *    sistema ya tiene esa cicatriz con los paquetes que cargan huecos. */
var _py = null;
function python() {
  if (_py) return _py;
  var cand = [];
  var fijo = (CFG.interpretes || {}).python;
  if (fijo) cand.push(String(fijo).replace(/^~/, os.homedir()));
  var base = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python');
  try {
    fs.readdirSync(base)
      .filter(function (n) { return /^Python\d+$/i.test(n); })
      .sort(function (a, b) { return Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')); })
      .forEach(function (n) { cand.push(path.join(base, n, 'python.exe')); });
  } catch (e) { /* no hay instalación por perfil: se prueba el PATH */ }
  cand.push('python3'); cand.push('python');

  for (var i = 0; i < cand.length; i++) {
    try {
      var r = require('child_process').spawnSync(cand[i], ['--version'], { encoding: 'utf8' });
      if (r.status === 0) { _py = cand[i]; return _py; }
    } catch (e) { }
  }
  throw new Error('🔴 ENTORNO · no encontré un Python que responda.\n' +
    '   Lo necesitan la 4ª capa de validación del Excel (xlsx-validar-fondo.py) y el render.\n' +
    '   Busqué: ' + cand.slice(0, 4).join(' · ') + '\n' +
    '   Instálalo, o escribe su ruta en `interpretes.python` de `_contratos/entorno.json`.');
}

function nube() {
  var d = raiz('proyecto');
  for (var i = 0; i < 12; i++) {
    var padre = path.dirname(d);
    if (padre === d) break;                                  // llegamos a la unidad
    if (/^OneDrive\b/i.test(path.basename(d))) return d;
    d = padre;
  }
  throw new Error('🔴 ENTORNO · la raíz del proyecto no está dentro de ninguna carpeta `OneDrive…`:\n' +
    '   ' + raiz('proyecto') + '\n' +
    '   Solo lo necesita el paso de publicar, que barre la nube buscando los archivos productivos.\n' +
    '   Si el proyecto vive fuera de OneDrive, declara la raíz de publicación en `_contratos/entorno.json`.');
}

/* el diagnóstico es para el que llega nuevo: dice qué resolvió, CÓMO, y qué falta. Nunca truena —
 * su trabajo es explicar, y un diagnóstico que se cae en la primera ruta rota no diagnostica nada. */
function diagnostico() {
  var out = [];
  out.push('── raíces');
  Object.keys(CFG.raices || {}).forEach(function (k) {
    var d = CFG.raices[k];
    try { out.push('   ✔ ' + k.padEnd(10) + raiz(k) + (d.ruta ? '   (fijada en el contrato)' : '   (encontrada)')); }
    catch (e) { out.push('   🔴 ' + k.padEnd(10) + String(e.message).split('\n')[0].replace('🔴 ENTORNO · ', '')); }
  });
  out.push('── el libro vivo');
  try { out.push('   ✔ ' + libro()); } catch (e) { out.push('   🔴 ' + String(e.message).split('\n')[1] || String(e.message)); }
  out.push('── fuentes');
  Object.keys(CFG.fuentes || {}).forEach(function (id) {
    try { out.push('   ✔ ' + id.padEnd(14) + fuente(id)); }
    catch (e) { out.push('   🔴 ' + id.padEnd(14) + String(e.message).split('\n')[1] || id); }
  });
  return out.join('\n');
}

module.exports = {
  get PROYECTO() { return raiz('proyecto'); },
  get LIBRO() { return libro(); },
  get NUBE() { return nube(); },
  get PYTHON() { return python(); },
  get NODE_MODULES() { return nodeModules(); },
  get SKILLS() { return skills(); },
  get DOCTRINA() { return _junto('crm-reporte-doctrina', 'doctrina'); },
  get AGENTES() { return _junto('agents', 'agentes'); },
  get PREFIJO_SKILL() { return prefijoSkills(); },
  skillDe: skillDe, cortoDe: cortoDe,
  BACKEND: BACKEND, TOOLS: TOOLS,
  raiz: raiz, fuente: fuente, diagnostico: diagnostico, cfg: function () { return CFG; }
};
