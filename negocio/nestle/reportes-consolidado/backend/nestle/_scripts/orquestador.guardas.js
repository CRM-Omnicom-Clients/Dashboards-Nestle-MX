// FASE 7 · LAS DOS GUARDAS ESTRUCTURALES — destructivo sin skill · id duplicado.
//
// 🔴 QUÉ VIGILAN QUE NADIE MÁS VIGILA. Las suites del sistema miran DATOS: que el motor calcule,
//    que el bloque cuadre, que la puerta cierre. Ninguna mira la ESTRUCTURA del sistema mismo:
//    que nada que borre o escriba ande suelto, y que dos cosas no compartan id. Los dos defectos
//    que abrieron esta fase son de esa clase y ninguna suite los vio:
//      · `escritor.retirar.js` desplazó celdas y perdió 5 columnas del catálogo. Escribía el
//        archivo del cliente y no era paso de ninguna etapa: nada le pedía permiso a nadie.
//      · `censo-scripts.json` y `orquestador.censo-scripts.json` convivieron con el mismo contenido,
//        uno muerto, porque la fase 5 renombró el producto al renombrar al productor.
//
// 🔴 ADAPTABLES, NO DETERMINISTAS — es lo que pidió Rick: «que no rompan nada ni del proceso ni de
//    la hoja, y que se adapten a las nuevas decisiones». Aquí eso significa tres cosas concretas:
//      1. NO traen su propia lista de qué es destructivo ni de quién manda. Todo lo preguntan a
//         las declaraciones vivas (`orquestador.censo-scripts.json`, `cadena-skills.json`). Si mañana
//         un script deja de escribir, la guarda se entera sola.
//      2. Tienen TRES veredictos, no dos: BLOQUEA · AVISA · **NO PUDE EVALUAR**. Un guardián que
//         solo sabe pasar o fallar, cuando le falta el insumo, pasa — y un guardián equivocado no
//         bloquea: DA PERMISO.
//      3. Solo BLOQUEAN lo que pueden PROBAR con el caso concreto en la mano. Lo demás avisa y
//         viaja al handoff. Así una decisión nueva de Rick no atora el corte.
//
// Uso:  node orquestador.guardas.js                  → las dos, sobre todo el sistema
//       node orquestador.guardas.js --antes <script> → preflight: ¿este puede correr?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';
var iAntes = process.argv.indexOf('--antes');
var ANTES = iAntes >= 0 ? process.argv[iAntes + 1] : null;

var bloquea = [], avisa = [], noEvaluado = [], ok = 0;
function B(nom, ev) { bloquea.push({ nom: nom, ev: ev }); }
function A(nom, ev) { avisa.push({ nom: nom, ev: ev }); }
function NE(nom, por) { noEvaluado.push({ nom: nom, por: por }); }
function OK(nom, ev) { ok++; console.log('   ✔ ' + nom.padEnd(52) + (ev || '')); }

// ── las declaraciones. Si falta una, NO se inventa: se declara no evaluable.
//
// 🔴 `--contratos <dir>` EXISTE PARA PODER PROBARLA. Una guarda que solo se puede correr contra el
//    sistema sano nunca demuestra que atrapa nada: pasa siempre, y «pasa siempre» es indistinguible
//    de «no mira». Con este flag, `orquestador.probar-guardas.js` le planta cada defecto en una
//    copia y comprueba que bloquea. El sistema real no se toca en ningún momento.
var iC = process.argv.indexOf('--contratos');
var CDIR = iC >= 0 ? process.argv[iC + 1] : BACK + '/_contratos';
function leer(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
var CENSO = leer(CDIR + '/orquestador.censo-scripts.json');
var CADENA = leer(CDIR + '/cadena-skills.json');

// 🔴 CUÁNTAS GUARDAS SON, CONTADO DE ESTE MISMO ARCHIVO. Es el único número que no puede quedarse
//    viejo: si alguien agrega una guarda 7, el encabezado y el veredicto lo dicen sin que nadie los
//    edite. El encabezado se escribe de DOS formas —`console.log('══ GUARDA n ══')` en las cinco
//    primeras y `// ══ GUARDA n ══` en la sexta, que es una IIFE— y presumir una sola es lo que ya
//    dejó a los 12 SKILL.md declarando 5 de 6.
var NGUARDAS = (function () {
  try {
    var yo = fs.readFileSync(__filename, 'utf8');
    var vistas = {};
    (yo.match(/══ GUARDA (\d+) ·/g) || []).forEach(function (m) { vistas[/(\d+)/.exec(m)[1]] = 1; });
    return Object.keys(vistas).length || '?';
  } catch (e) { return '?'; }
})();

console.log('════════ FASE 7 · GUARDAS ESTRUCTURALES (' + NGUARDAS + ') ════════');
console.log('  adaptables: preguntan a las declaraciones vivas, no traen su propia lista\n');

// ══════════════════════════════════════════════════════════════════════════════════════
// GUARDA 1 · DESTRUCTIVO SIN SKILL
//
// Un script que ESCRIBE el workbook o BORRA archivos tiene que poder responder dos preguntas:
// **de quién es** (skill) y **con qué permiso corre** (turno en una etapa, o papel declarado
// fuera de ciclo). Un script destructivo que no responde ninguna de las dos es el caso de
// `escritor.retirar.js`: existía, escribía el archivo del cliente, y no le rendía cuentas a nadie.
//
// 🔴 LO QUE **NO** HACE: bloquear por escribir. Escribir es el trabajo del sistema — el escritor
//    escribe, el motor escribe, el resumen escribe. Bloquear eso sería el guardián determinista
//    que rompe el proceso. Lo que se bloquea es escribir **sin dueño declarado**.
// ══════════════════════════════════════════════════════════════════════════════════════
console.log('══ GUARDA 1 · destructivo sin skill ══');
if (!CENSO || !CENSO.propiedades) {
  NE('destructivo sin skill', 'no está orquestador.censo-scripts.json — corre el censo primero');
  console.log('   ⊘ NO PUDE EVALUAR — falta el censo\n');
} else {
  // quién tiene turno: paso de una etapa, o suite de un script
  var conTurno = {};
  (CADENA ? CADENA.etapas : []).forEach(function (e) {
    e.scripts.forEach(function (n) { conTurno[n.script] = 'paso de la etapa ' + e.orden; (n.suites || []).forEach(function (s) { conTurno[s] = 'suite de ' + n.id; }); });
  });
  // quién está declarado sin turno, con su papel
  var declaradoFuera = {};
  (CADENA && CADENA.fuera_de_ciclo ? CADENA.fuera_de_ciclo : []).forEach(function (x) { declaradoFuera[x.script] = x; });
  // dueño según el censo, mirando TODAS las clases (el dueño no depende de la clase)
  var duenoDe = {};
  Object.keys(CENSO.clases).forEach(function (cl) {
    /* 🔴 UNA CLASE PUEDE GUARDAR CADENAS O OBJETOS, y asumir una sola forma dejó ciegas a las 35
     *    LIBRERÍAS (esa clase guarda strings). `x.f` sobre una cadena da `undefined`, así que se
     *    escribía `duenoDe[undefined]` una y otra vez y ninguna librería quedaba con dueño. No
     *    tronaba: devolvía vacío, y el vacío se lee como «no hay». Solo salió a la luz porque
     *    `lib-hoja-xml.js` es la única con `borra: true`, así que era la única que la guarda
     *    miraba — las otras 34 pasaban por no ser destructivas, no por estar declaradas. */
    (CENSO.clases[cl] || []).forEach(function (x) {
      var f = typeof x === 'string' ? x : x.f;
      if (!f) return;
      duenoDe[f] = { skill: (typeof x === 'string' ? null : x.skill), clase: cl };
    });
  });

  var destructivos = Object.keys(CENSO.propiedades).filter(function (f) {
    var p = CENSO.propiedades[f];
    return p.escribe_excel || p.borra;
  });

  var sueltos = [], sinDueno = [], sinPapel = [];
  destructivos.forEach(function (f) {
    if (!fs.existsSync(path.join(D, f))) return;          // ya no está: no es un riesgo vivo
    var d = duenoDe[f];
    var skill = d && d.skill && d.skill !== '(fundación)' ? d.skill : null;
    var papel = conTurno[f] || (declaradoFuera[f] ? declaradoFuera[f].papel : null) || (d ? d.clase : null);
    if (!skill && !papel) sueltos.push(f);
    else if (!skill) sinDueno.push(f);
    else if (!papel) sinPapel.push(f);
  });

  console.log('   destructivos vivos (escriben el Excel o borran): ' + destructivos.length);
  if (sueltos.length) B('hay destructivos SUELTOS (sin skill y sin papel)', sueltos.join(' · '));
  else OK('ningún destructivo anda suelto', 'los ' + destructivos.length + ' tienen skill y papel');
  if (sinDueno.length) B('destructivos sin skill dueño', sinDueno.join(' · '));
  else OK('cada destructivo tiene skill dueño', '');
  if (sinPapel.length) A('destructivos con dueño pero sin papel declarado', sinPapel.join(' · '));
  else OK('cada destructivo tiene papel declarado', 'paso · suite · o fuera de ciclo con su clase');

  // 🔴 EL CASO QUE MOTIVÓ LA GUARDA: un destructivo CONGELADO no debe poder correr. Se comprueba
  //    que siga congelado y que nadie lo invoque — si alguien lo invocara, la congelación es papel.
  //
  // 🔴 DECLARAR NO ES INVOCAR — y esta guarda se equivocó en su primera corrida por no distinguirlo.
  //    Acusó a `orquestador.censo-scripts.js` de invocar al congelado, cuando lo que hace es
  //    DECLARARLO congelado en su tabla `DUENO_DECLARADO` (línea 93). Es literalmente el mismo
  //    defecto que la fase 6 acababa de arreglar en el censo, cometido de nuevo aquí: nombrar algo
  //    y llamarlo no son lo mismo. Un guardián que grita sobre la única tabla que dice «esto está
  //    congelado» entrena a ignorar el rojo, y ahí es donde deja de proteger.
  //    Ahora se exige que el nombre aparezca **como argumento de una llamada**: exec o spawn a
  //    menos de 120 caracteres antes, sin salto de párrafo de por medio.
  function loInvocaDeVerdad(txt, nombre) {
    var i = 0;
    while ((i = txt.indexOf(nombre, i)) >= 0) {
      var atras = txt.slice(Math.max(0, i - 120), i);
      // 🔴 Y EL REGEX TAMPOCO PUEDE INVENTARSE LAS FORMAS. Decía `exec(Sync|File)?\(` y se le escapaba
      //    `execFileSync(`: el `Sync` quedaba fuera del grupo, así que la llamada más común del
      //    sistema no contaba como llamada. El probador lo destapó plantando un señuelo que invocaba
      //    al congelado justo con esa forma — la guarda lo dejó pasar y salió verde.
      if (/(exec|spawn)\w*\s*\(/.test(atras) && !/\n\s*\n/.test(atras)) return true;
      i += nombre.length;
    }
    return false;
  }
  var congelados = (CENSO.clases.CONGELADO || []).map(function (x) { return x.f; });
  var invocanCongelado = [];
  congelados.forEach(function (c) {
    fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f) && f !== c; }).forEach(function (f) {
      var txt = fs.readFileSync(path.join(D, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      if (loInvocaDeVerdad(txt, c)) invocanCongelado.push(f + ' → ' + c);
    });
  });
  if (congelados.length === 0) NE('los congelados no se invocan', 'no hay ninguno congelado ahora mismo');
  else if (invocanCongelado.length) B('alguien invoca un script CONGELADO', invocanCongelado.join(' · '));
  else OK('nadie invoca un script congelado', congelados.join(' · ') + ' — congelado de verdad');
}

// ══════════════════════════════════════════════════════════════════════════════════════
// GUARDA 2 · ID DUPLICADO
//
// Dos cosas con el mismo id es el defecto que el registro de nombres vino a cerrar, y aparece en
// cuatro planos distintos. Los cuatro se miran, porque en cada uno ya se coló uno de verdad:
//   · dos SCRIPTS con el mismo id en la cadena
//   · dos SCRIPTS que resuelven al mismo nombre (lo bloqueó el renombrador en la fase 5)
//   · dos CONTRATOS con el mismo contenido lógico y distinto nombre  ← el censo, hoy
//   · dos ETAPAS del mismo skill con el mismo número de paso
// ══════════════════════════════════════════════════════════════════════════════════════
console.log('\n══ GUARDA 2 · id duplicado ══');
if (!CADENA) {
  NE('id duplicado', 'no está cadena-skills.json — corre orquestador.cadena-skills.js');
  console.log('   ⊘ NO PUDE EVALUAR — falta la cadena\n');
} else {
  // 1 · ids de paso
  var vistos = {}, dupNodo = [];
  CADENA.etapas.forEach(function (e) {
    e.scripts.forEach(function (n) {
      // 🔴 un id PUEDE repetirse si es el mismo script en dos etapas (el escritor corre 3 veces).
      //    Lo que no puede es que dos SCRIPTS distintos compartan id — ahí el id deja de ser ancla.
      if (vistos[n.id] && vistos[n.id] !== n.script) dupNodo.push(n.id + ': ' + vistos[n.id] + ' y ' + n.script);
      vistos[n.id] = n.script;
    });
  });
  if (dupNodo.length) B('dos scripts distintos con el mismo id de paso', dupNodo.join(' · '));
  else OK('cada id de paso apunta a un solo script', Object.keys(vistos).length + ' ids');

  // 2 · nombres de archivo que chocarían
  var enDisco = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
  var porMinuscula = {};
  enDisco.forEach(function (f) { (porMinuscula[f.toLowerCase()] = porMinuscula[f.toLowerCase()] || []).push(f); });
  var dupArchivo = Object.keys(porMinuscula).filter(function (k) { return porMinuscula[k].length > 1; });
  if (dupArchivo.length) B('dos scripts que solo se distinguen por mayúsculas', dupArchivo.join(' · '));
  else OK('ningún par de scripts choca por nombre', enDisco.length + ' archivos');

  // 3 · contratos gemelos — el caso de hoy
  //    Se compara por CONTENIDO, no por nombre: dos nombres distintos con el mismo JSON dentro es
  //    un producto renombrado que dejó a su gemelo muerto atrás, y el muerto sigue leyéndose.
  // (usa el CDIR de arriba: así el probador también puede plantarle contratos gemelos)
  var jsons = fs.readdirSync(CDIR).filter(function (f) { return /\.json$/.test(f); });
  var firma = {};
  jsons.forEach(function (f) {
    var st = fs.statSync(path.join(CDIR, f));
    if (st.size > 3e6) return;                       // los enormes no se comparan byte a byte
    var txt = fs.readFileSync(path.join(CDIR, f), 'utf8');
    var J = null; try { J = JSON.parse(txt); } catch (e) { return; }
    // la firma es la FORMA, no el byte: mismas claves de primer nivel y mismos tamaños
    var f1 = Object.keys(J).sort().join(',') + '|' + (J.total || '') + '|' + txt.length;
    (firma[f1] = firma[f1] || []).push(f);
  });
  var gemelos = Object.keys(firma).filter(function (k) { return firma[k].length > 1; }).map(function (k) { return firma[k].join(' ≡ '); });
  if (gemelos.length) B('dos contratos con la misma forma y distinto nombre', gemelos.join(' · '));
  else OK('ningún contrato tiene gemelo', jsons.length + ' contratos');

  // 4 · dos etapas del mismo skill en el mismo paso
  //
  // 🔴 Y AQUÍ ME INVENTÉ EL CAMPO. Esto decía `e.n`, que no existe —la etapa se llama `orden`—, así
  //    que las 15 etapas cayeron bajo la llave `undefined` y la guarda bloqueó acusando a todas de
  //    compartir paso. Un campo inexistente no da error en JS: da `undefined`, y `undefined` agrupa
  //    perfecto. Es el mismo modo de fallar que la columna fantasma: se escribe a un lugar que no
  //    existe y nada truena. Al dato hay que preguntarle su forma, no suponérsela.
  var porPaso = {};
  CADENA.etapas.forEach(function (e) {
    if (e.orden == null) { NE('id duplicado · script por etapa', 'la etapa no trae `orden`'); return; }
    (porPaso[e.orden] = porPaso[e.orden] || []).push(e.skill);
  });
  var dupPaso = Object.keys(porPaso).filter(function (k) { return porPaso[k].length > 1; });
  if (dupPaso.length) B('dos etapas comparten número de paso', dupPaso.map(function (k) { return k + ': ' + porPaso[k].join(' y '); }).join(' · '));
  else OK('cada script de la cadena es de un solo skill', CADENA.etapas.length + ' etapas');
}

// ══════════════════════════════════════════════════════════════════════════════════════
// GUARDA 3 · LECTURA POR LITERAL
//
// El hook impide ESCRIBIR un script que lea una columna por literal, pero no ve lo que ya está en
// disco de antes. Esta guarda cubre ese hueco: barre los scripts vivos y nombra a los que leen por
// corchete una de las columnas que ya mordieron. AVISA, no bloquea — hay 130 scripts y atorar el
// corte por deuda histórica es cómo un guardián acaba desactivado. Lo que bloquea es el hook, que
// impide que la deuda CREZCA.
// ══════════════════════════════════════════════════════════════════════════════════════
console.log('\n══ GUARDA 3 · lectura por literal ══');
(function () {
  var LIB = BACK + '/_scripts/lib-columna.js';
  if (!fs.existsSync(LIB)) { NE('lectura por literal', 'no está lib-columna.js'); console.log('   ⊘ NO PUDE EVALUAR'); return; }
  var MORDIERON = require(LIB).MORDIERON;
  var deudores = [];
  fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f) && !/^lib-columna|probar-columna/.test(f); }).forEach(function (f) {
    var txt = fs.readFileSync(path.join(D, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    var cols = Object.keys(MORDIERON).filter(function (c) {
      return new RegExp('\\[\\s*[\'"]' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\s*\\]').test(txt);
    });
    if (cols.length) deudores.push({ f: f, cols: cols });
  });
  if (!deudores.length) OK('ningún script vivo lee por literal una columna que mordió', Object.keys(MORDIERON).length + ' columnas vigiladas');
  else {
    A('scripts que leen por literal una columna que ya mordió', deudores.length + ' — el hook impide que crezca');
    console.log('   ⚠ deuda histórica: ' + deudores.length + ' script(s)');
    deudores.slice(0, 6).forEach(function (x) { console.log('      ' + x.f.padEnd(38) + x.cols.map(function (c) { return '«' + c + '»'; }).join(' · ')); });
    if (deudores.length > 6) console.log('      … y ' + (deudores.length - 6) + ' más');
  }
})();

// ══════════════════════════════════════════════════════════════════════════════════════
// GUARDA 4 · SCRIPT SUELTO DEL CATÁLOGO RAÍZ
//
// 🔴 LA REGLA, DE RICK (26-ago): *«Todos los scripts tienen que estar relacionados con el catálogo
//    raíz. No puede haber ningún script suelto de eso.»* El porqué es el diseño entero: el catálogo
//    guarda el **id lógico inmutable** y su **nombre físico actual**, así que un renombre cambia UNA
//    fila del catálogo en vez de 126 scripts.
//
// 🔴 ÉSTA BLOQUEA, no avisa — la única de las cuatro que detiene el corte. Un script que lee
//    columnas por su cuenta puede devolver vacío sin tronar, y un vacío se lee como «no hay»: es la
//    mentira que costó cinco defectos en un día. Mientras eso sea posible, el corte no arranca.
//
// 🔴 UNA MENCIÓN NO ES UN USO. La primera versión buscaba la cadena `lib-columna` en cualquier
//    parte — y el COMENTARIO que el anclaje inserta la contiene. Al plantarle un script sin el
//    `require`, el comentario lo hizo pasar por anclado y la guarda salió verde sobre el defecto.
//    Tercera vez hoy que un texto citado se cuenta como uso. Se exige el `require(…lib-columna…)`
//    de verdad, con los comentarios fuera.
//
// 🔴 SOLO BLOQUEA POR LOS QUE CORREN. Las herramientas se invocan a mano, con una persona delante
//    que ve el resultado; atorar el corte por su deuda sería el guardián que acaba desactivado.
// ══════════════════════════════════════════════════════════════════════════════════════
console.log('\n══ GUARDA 4 · script suelto del catálogo raíz ══');
(function () {
  if (!CADENA) { NE('script suelto del catálogo raíz', 'no está cadena-skills.json'); console.log('   ⊘ NO PUDE EVALUAR'); return; }
  var LIB = BACK + '/_scripts/lib-columna.js';
  if (!fs.existsSync(LIB)) { NE('script suelto del catálogo raíz', 'no está lib-columna.js — la puerta al catálogo'); console.log('   ⊘ NO PUDE EVALUAR'); return; }

  var nCol = 0;
  try { nCol = Object.keys(require(LIB).registro()).length; } catch (e) { }
  if (!nCol) B('el catálogo raíz no responde', 'registro.json vacío o ilegible — anclar a él no ancla nada');
  else OK('el catálogo raíz responde', nCol + ' columnas: id lógico inmutable → nombre físico actual');

  var delCorte = {};
  CADENA.etapas.forEach(function (e) {
    e.scripts.forEach(function (n) { delCorte[n.script] = 1; (n.suites || []).forEach(function (s) { delCorte[s] = 1; }); });
  });

  function sinComent(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }
  var sueltosCorte = [], sueltosFuera = [];
  fs.readdirSync(D).forEach(function (f) {
    if (!/\.js$/.test(f) || /^lib-/.test(f)) return;
    var t = fs.readFileSync(path.join(D, f), 'utf8');
    if (!/sheet_to_json|\[['"][A-ZÁÉÍÓÚ][^\]'"]*['"]\]/.test(t)) return;
    var codigo = sinComent(t);
    // 🔴 `[\s\S]{0,220}?`, NO `[^)]*` — y esto bloqueó el sistema sano en su primera corrida.
    //    El anclaje inserta `require(require('os').homedir() + '…/lib-columna.js')`, y `[^)]*` no
    //    puede cruzar el `)` de `require('os')`: la guarda declaraba sueltos a scripts anclados.
    //    Cuarto regex mío que falla hoy por suponer la forma del texto en vez de probarla contra
    //    el texto real. La regla que me falta es la misma que le exijo al sistema: comprobar,
    //    no suponer.
    if (/require\s*\([\s\S]{0,220}?lib-columna/.test(codigo)) return;
    (delCorte[f] ? sueltosCorte : sueltosFuera).push(f);
  });

  if (sueltosCorte.length) B('scripts del CORTE que leen columnas sin el catálogo raíz', sueltosCorte.join(' · '));
  else OK('ningún script del corte lee columnas por su cuenta', 'los ' + Object.keys(delCorte).length + ' pasan por lib-columna');

  if (sueltosFuera.length) {
    A('herramientas fuera del corte sin anclar al catálogo', sueltosFuera.length + ' — se invocan a mano, no atoran el corte');
    console.log('   ⚠ fuera del corte: ' + sueltosFuera.slice(0, 4).join(' · ') + (sueltosFuera.length > 4 ? ' … +' + (sueltosFuera.length - 4) : ''));
  } else OK('tampoco las herramientas leen por su cuenta', '');
})();

// ══════════════════════════════════════════════════════════════════════════════════════
// GUARDA 5 · ESCRIBIR SIN HABER DECLARADO ANTES
//
// 🔴 LA REGLA, DE RICK (26-ago): *«Solo el skill puede proceder y terminar cuando completa el loop
//    de pre-escritura. Si eso no pasa, el proceso genera muchos loops en la escritura siguiente.
//    Tiene que ser una regla muy estricta.»*
//
// 🔴 POR QUÉ CIERRA EL CICLO DE LOOPS. Sin declaración previa, el skill descubre los problemas
//    MIENTRAS escribe — y ahí ya es tarde: el archivo queda a medias y el skill siguiente hereda el
//    desorden. Con declaración previa, lo que se va a escribir se puede revisar antes de tocar nada.
//
// 🔴 SE EXIGEN LOS CUATRO CAMPOS, no que el archivo exista. Una declaración a medias es peor que
//    ninguna: parece cumplida. Cada campo tapa un defecto real —el grano (el Qcart agrupado que
//    cuadraba igual), la llave (Data_Email anclada a una columna que el escritor llena), las celdas
//    esperadas («0 celdas que cambiarían» leído como «ya está bien»)—.
// ══════════════════════════════════════════════════════════════════════════════════════
console.log('\n══ GUARDA 5 · escribir sin haber declarado ══');
(function () {
  if (!CADENA) { NE('pre-escritura declarada', 'no está cadena-skills.json'); console.log('   ⊘ NO PUDE EVALUAR'); return; }
  var LIB = D + '/lib-declaracion-escritura.js';
  if (!fs.existsSync(LIB)) { NE('pre-escritura declarada', 'no está lib-declaracion-escritura.js'); console.log('   ⊘ NO PUDE EVALUAR'); return; }
  var DE = require(LIB);

  var escritores = [];
  CADENA.etapas.forEach(function (e) {
    e.scripts.forEach(function (s) { if (s.escribe && escritores.indexOf(s.script) < 0) escritores.push(s.script); });
  });

  var sin = [], aMedias = [];
  escritores.forEach(function (s) {
    var d = DE.declaracionDe(s);
    if (!d) { sin.push(s); return; }
    (d.tablas || []).forEach(function (t, i) {
      var faltan = DE.CAMPOS.filter(function (c) { return !t[c]; });
      if (faltan.length) aMedias.push(s + ' tabla ' + (i + 1) + ': falta ' + faltan.join(', '));
    });
    if (!(d.tablas || []).length) aMedias.push(s + ': declaró sin ninguna tabla');
  });

  if (sin.length) B('skills que ESCRIBEN sin haber declarado antes', sin.join(' · '));
  else OK('todo escritor del corte declaró antes de escribir', escritores.length + ' escritores con su declaración');

  if (aMedias.length) B('declaraciones a medias (parecen cumplidas y no lo están)', aMedias.slice(0, 4).join(' · '));
  else if (escritores.length) OK('ninguna declaración está a medias', 'los 4 campos en todas las tablas');
})();

// ══ PREFLIGHT: ¿este script puede correr? ═══════════════════════════════════════════════
// 🔴 Esta es la parte que de verdad protege, porque corre ANTES. Lo demás es auditoría.
if (ANTES) {
  console.log('\n══ PREFLIGHT · ¿puede correr «' + ANTES + '»? ══');
  var pr = (CENSO && CENSO.propiedades ? CENSO.propiedades[ANTES] : null);
  if (!pr) {
    console.log('   ⊘ NO PUDE EVALUAR — el censo no conoce «' + ANTES + '». Corre el censo.');
    NE('preflight de ' + ANTES, 'el censo no lo conoce');
  } else if (!pr.escribe_excel && !pr.borra) {
    console.log('   ✔ no es destructivo — corre sin más');
  } else {
    var cl2 = null, sk2 = null;
    Object.keys(CENSO.clases).forEach(function (c) { (CENSO.clases[c] || []).forEach(function (x) { if (x.f === ANTES) { cl2 = c; sk2 = x.skill; } }); });
    if (cl2 === 'CONGELADO') { console.log('   🔴 BLOQUEA — está CONGELADO: ' + ANTES); B('preflight: congelado', ANTES); }
    else if (!sk2) { console.log('   🔴 BLOQUEA — destructivo sin skill dueño'); B('preflight: sin dueño', ANTES); }
    else console.log('   ✔ destructivo pero con dueño (' + sk2.replace(ENT.PREFIJO_SKILL, '') + ') y papel (' + cl2 + ')');
  }
}

// ══ GUARDA 6 · UNA PIEZA ES SU NOMBRE ══════════════════════════════════════════════
//
// 🔴 NACE DE LAS E-P* (15-sep-2026). El catálogo llevaba desde agosto con cuatro filas que
//    parecían piezas y no lo eran: `005-P001..P004`, sin nombre, sin envíos, y con touchpoints
//    (`e-p1`, `e-p2`, `e-p4`, `e-p6`) que el maestro había dejado de declarar cuando Rick
//    renumeró las jornadas a `e-j*`. Nadie las frenó porque **nada exigía que una pieza tuviera
//    nombre**. Y no eran inofensivas: sus alias mandaron carritos de pauta a una pieza fantasma.
//    Rick: «si no tienen email name pues no van».
//
// 🔴 DOS COSAS, Y SON DISTINTAS:
//    · ÚNICO  — dos piezas no pueden compartir un nombre. Si lo comparten, no es una llave, y
//               cualquier cruce por nombre elige al azar. Esto **bloquea**.
//    · EXISTE — una fila sin nombre Y sin envíos no es una pieza. Esto **avisa**: puede ser una
//               pieza programada que todavía no sale, y decidir retirarla es de Rick, no de una
//               guarda. Lo que la guarda hace es que deje de pasar inadvertida.
(function () {
  var NOMBRE = 'guarda 6 · una pieza es su nombre';
  try {
    var XL = (function () { process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES; require('module').Module._initPaths(); return require('xlsx'); })();
    var fsG = require('fs'), osG = require('os');
    var PROYG = ENT.PROYECTO;
    var tg = require('path').resolve(__dirname, '..') + '/_tmp/_guarda6.xlsx';
    fsG.copyFileSync(ENT.LIBRO, tg);
    var PG = XL.utils.sheet_to_json(XL.readFile(tg).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
    fsG.unlinkSync(tg);
    var tg2 = function (v) { return String(v == null ? '' : v).trim(); };
    var TOKG = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
    var ID = 'Pieza' + '_ID', EN = 'Email' + '_Name', WN = 'Whatsapp' + '_Name',
        EV = 'Email' + '_Names_Variantes', WV = 'Whatsapp' + '_Names_Variantes', SN = 'Send' + 's';

    var porNombre = {}, sinNombre = [], sinDatoDeEmail = [], yaResueltas = [];
    PG.forEach(function (p) {
      var id = tg2(p[ID]); if (!id || TOKG.test(id)) return;
      var nombres = [];
      [EN, WN].forEach(function (c) { var v = tg2(p[c]); if (v && !TOKG.test(v)) nombres = nombres.concat(v.split(/\s*[·|]\s*/)); });
      [EV, WV].forEach(function (c) { var v = tg2(p[c]); if (v && !TOKG.test(v)) nombres = nombres.concat(v.split(/\s*[·|]\s*/)); });
      nombres = nombres.map(tg2).filter(function (n) { return n && !TOKG.test(n); });
      if (!nombres.length) {
        // 🔴 «SIN ENVÍOS» NO ES «SIN DATOS» (15-sep-2026). La primera versión solo miraba `Sends`
        //    y marcó a `004-P020` como si fuera residuo. No lo es: esa pieza tiene 49 carritos y
        //    4 productos en el bloque de Qcart, sus cuatro shortlinks declarados en el maestro de
        //    junio, y su propia fila en el reporte. Lo único que le falta es el lado de EMAIL —
        //    SFMC nunca publicó su correo. Es justo lo contrario del residuo: es una pieza real a
        //    la que le falta una fuente.
        //    Meterlas en el mismo montón invita a retirar una pieza que está aportando datos, que
        //    es exactamente lo que esta guarda existe para evitar.
        var s = Number(tg2(p[SN]));
        var conEnvios = isFinite(s) && s > 0;
        var car = Number(tg2(p['Carritos' + '_Total']));
        var conQcart = isFinite(car) && car > 0;
        /* 🔴 SI LA FILA YA DICE QUÉ ES, NO SE PREGUNTA (2-oct-2026). Esta guarda avisaba de
         *    `004-P020` preguntando «¿es una pieza programada o residuo?» — y la respuesta estaba
         *    ESCRITA en su propia fila desde el 15-sep: `Estado: Retirada · el envío nunca salió
         *    (Rick, 15-sep-2026)`. La guarda no leía esa columna, así que repetía en cada corte una
         *    pregunta ya contestada. Eso no es cautela: es ruido, y el ruido es cómo se consigue
         *    que alguien deje de leer los avisos — justo lo que esta guarda necesita que no pase.
         *    Se sigue contando la fila, pero el aviso dice que la decisión ya está tomada y quién
         *    la tomó, en vez de volver a preguntar. */
        var estado = tg2(p['Estado']) + ' ' + tg2(p['Notas']);
        var yaDecidida = /retirad|nunca sali|no sali[oó]|cancelad/i.test(estado);
        if (!conEnvios && !conQcart && yaDecidida) { yaResueltas.push({ id: id, por: tg2(p['Estado']).slice(0, 72) }); return; }
        if (!conEnvios && !conQcart) sinNombre.push(id);
        else if (!conEnvios) sinDatoDeEmail.push(id + ' (' + car + ' carritos, sin correo en SFMC)');
        return;
      }
      nombres.forEach(function (n) { (porNombre[n] = porNombre[n] || {})[id] = 1; });
    });

    var repetidos = Object.keys(porNombre).filter(function (n) { return Object.keys(porNombre[n]).length > 1; });
    console.log('\n── ' + NOMBRE);
    console.log('   piezas: ' + PG.length + '   ·   nombres distintos: ' + Object.keys(porNombre).length);
    if (repetidos.length) {
      repetidos.slice(0, 5).forEach(function (n) {
        console.log('   🔴 «' + n.slice(0, 46) + '» en ' + Object.keys(porNombre[n]).join(' + '));
      });
      B(NOMBRE + ' · nombre repetido', repetidos.length + ' nombre(s) en más de una pieza');
    } else {
      console.log('   ✔ ningún nombre está en dos piezas');
      ok++;
    }
    if (sinNombre.length) {
      console.log('   ⚠ ' + sinNombre.length + ' fila(s) sin nombre y sin envíos: ' + sinNombre.slice(0, 8).join(' ') + (sinNombre.length > 8 ? ' …' : ''));
      A(NOMBRE + ' · filas sin nombre y sin ningún dato', sinNombre.length + ': ' + sinNombre.slice(0, 6).join(' ') + ' — ¿son piezas programadas o residuo? (ninguna tiene envíos NI carritos)');
    } else {
      console.log('   ✔ ninguna fila sin nombre y sin ningún dato');
      ok++;
    }
    if (yaResueltas.length) {
      // se informa, no se pregunta: la decision ya esta en la fila
      console.log('   · ' + yaResueltas.length + ' fila(s) sin datos pero con su estado YA DECLARADO (no se vuelve a preguntar):');
      yaResueltas.forEach(function (x) { console.log('        ' + x.id + ' — ' + x.por); });
    }
    if (sinDatoDeEmail.length) {
      console.log('   · ' + sinDatoDeEmail.length + ' pieza(s) con datos de Qcart pero sin correo en SFMC: ' + sinDatoDeEmail.join(' · '));
      console.log('     no son residuo — son piezas reales a las que les falta una fuente.');
    }
  } catch (eG) {
    // 🔴 NO PUDE EVALUAR no cuenta como pasar — es el tercer veredicto, y existe para esto
    noEvaluado.push({ nom: NOMBRE, por: 'no se pudo leer el catálogo: ' + String(eG.message).slice(0, 60) });
  }
})();

// ══ GUARDA 7 · una ruta se pide, no se escribe ═══════════════════════════════════════════════
//
// 🔴 POR QUÉ. El 2-oct-2026 el backend tenía 165 scripts con la carpeta del cliente escrita, 41
//    con el nombre del libro y uno con la carpeta de OneDrive: el sistema estaba cableado a UNA
//    máquina, y para otra persona simplemente no arrancaba. Ya se migraron los 251. Esta guarda
//    existe para que no vuelvan — porque el modo de fallo de una ruta escrita no es tronar:
//    `existsSync` da `false` y el script concluye «no hay datos», que es el defecto que este
//    sistema ya conoce de memoria.
//
// 🔴 VEREDICTO PARTIDO, COMO LA GUARDA 1: BLOQUEA si el script lo invoca la cadena, AVISA si no.
//    Atorar el corte entero por un literal en un explorador de un rato sería la clase de guarda
//    que alguien desactiva — y una guarda desactivada no guarda nada. Pero un script que SÍ corre
//    en el corte con la ruta escrita rompe la portabilidad de verdad, y eso sí detiene.
//
// 🔴 NO TRAE SU PROPIA LISTA DE NADA. Los patrones y los tres intocables se los pide a
//    `entorno.json`. Una guarda hecha de literales es una prueba de regresión: atrapa lo que ya
//    pasó y es ciega a la variante siguiente. Y el nombre del libro entra como `@LIBRO_VIVO@`, que
//    se sustituye por el valor real del contrato: así renombrarlo NO deja la guarda mirando un
//    nombre que ya no existe.
(function () {
  var NOMBRE = 'guarda 7 · una ruta se pide, no se escribe';

  /* 🔴 UN COMENTARIO NO SE RECONOCE POR CÓMO EMPIEZA LA LÍNEA. Yo filtraba con
   *    `/^\s*(\/\/|\*|\/\*)/`, y una continuación de bloque `/* … *​/` SIN `*` al margen —que es
   *    legal y la hay en este backend— se colaba como si fuera código: la guarda señaló un
   *    comentario de `orquestador.mapa-carpeta.js` que EXPLICA el defecto de las rutas al home.
   *    Es la misma familia que llevo todo el día arreglando —presumir la FORMA en que algo está
   *    escrito— y aquí vuelve del lado de los falsos positivos: señalar la documentación es cómo
   *    se consigue que alguien apague el guardián.
   *    Se recorre el archivo llevando la cuenta de si se está DENTRO de un bloque, y se devuelven
   *    las líneas con los comentarios ya vaciados, conservando el número de línea. */
  function soloCodigo(texto) {
    var dentro = false;
    return texto.split(/\r?\n/).map(function (L) {
      var out = '', i = 0;
      while (i < L.length) {
        if (dentro) {
          var fin = L.indexOf('*/', i);
          if (fin < 0) { i = L.length; break; }
          dentro = false; i = fin + 2; continue;
        }
        if (L[i] === '/' && L[i + 1] === '/') break;                 // de aquí al final es comentario
        if (L[i] === '/' && L[i + 1] === '*') { dentro = true; i += 2; continue; }
        out += L[i]; i++;
      }
      return out;
    });
  }
  try {
    var ENTJ = leer(CDIR + '/entorno.json');
    if (!ENTJ || !ENTJ.patrones_prohibidos) {
      NE(NOMBRE, 'el contrato `entorno.json` no declara `patrones_prohibidos`');
      return;
    }
    // `--scripts <dir>` para poder plantarle el defecto sin tocar el backend real
    var iS = process.argv.indexOf('--scripts');
    var SDIR = iS >= 0 ? process.argv[iS + 1] : BACK + '/_scripts';
    var INTOC = Object.keys((ENTJ.intocables || {}).lista || {});
    var LIBRO_N = ENTJ.libro_vivo || '';

    var PAT = ENTJ.patrones_prohibidos.lista.map(function (p) {
      return {
        texto: String(p.patron).replace('@LIBRO_VIVO@', LIBRO_N),
        que_es: p.que_es,
        pide: p.pide_en_su_lugar
      };
    }).filter(function (p) { return p.texto && p.texto.indexOf('@') !== 0; });

    // quién corre en el corte: se lo pregunta a la cadena, no lo decide la guarda
    var delCorte = {};
    (((CADENA || {}).etapas) || []).forEach(function (e) {
      (e.scripts || []).forEach(function (n) {
        delCorte[n.script] = 1;
        (n.suites || []).forEach(function (s) { delCorte[s] = 1; });
      });
    });

    var hallazgos = [];
    fs.readdirSync(SDIR).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
      if (INTOC.indexOf(f) >= 0) return;
      var lineas = soloCodigo(fs.readFileSync(path.join(SDIR, f), 'utf8'));
      lineas.forEach(function (L, i) {
        // un comentario NO cuenta: hay comentarios a propósito explicando por qué ya no se escriben
        if (/^\s*(\/\/|\*|\/\*)/.test(L)) return;
        PAT.forEach(function (p) {
          /* 🔴 LAS DOS FORMAS, o esta guarda es ciega al peor defecto del día. Un patrón se puede
           *    escribir con barras (`'/.claude/reportes-backend/nestle'`) o repartido en
           *    argumentos (`path.join(home, '.claude', 'reportes-backend', 'nestle')`). Buscando
           *    solo la primera, MI PROPIO BARRIDO salió verde dejando anclado `lib-entorno.js`
           *    —el archivo del que depende todo lo demás, porque de ahí sale el contrato— y la
           *    copia de SharePoint habría obedecido al `~/.claude` de Rick sin que nada fallara.
           *    La forma por argumentos se detecta pidiendo los mismos trozos entrecomillados y
           *    separados por comas: eso es `path.join` construyendo exactamente esa ruta. */
          var porArgs = p.texto.split('/').filter(function (s) { return s; });
          if (porArgs.length > 1) {
            var reArgs = new RegExp(porArgs.map(function (s) {
              return '[\'"]' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]';
            }).join('\\s*,\\s*'));
            if (reArgs.test(L)) {
              hallazgos.push({
                script: f, linea: i + 1, patron: p.texto + '  (repartido en argumentos)',
                que_es: p.que_es, pide_en_su_lugar: p.pide, corre_en_el_corte: !!delCorte[f],
                codigo: L.trim().slice(0, 120)
              });
              return;
            }
          }
          if (L.indexOf(p.texto) < 0) return;
          /* 🔴 SOLO CUENTA SI SE ESTÁ ARMANDO UNA RUTA — pegado a una barra. NOMBRAR una carpeta
           *    dentro de una frase no es escribirla: `orquestador.instalar.js` le dice a la
           *    persona nueva «pide que te compartan «Marketing Automation Kinesso - …»», y ese
           *    nombre es lo que hace útil el mensaje. La primera versión lo señaló, y señalar la
           *    ayuda es como se consigue que alguien apague la guarda. */
          var ok = false, desde = 0, i2;
          while ((i2 = L.indexOf(p.texto, desde)) >= 0) {
            var antes = L[i2 - 1], detras = L[i2 + p.texto.length];
            if (antes === '/' || antes === '\\' || detras === '/' || detras === '\\') { ok = true; break; }
            desde = i2 + 1;
          }
          if (!ok) return;
          hallazgos.push({
            script: f, linea: i + 1, patron: p.texto, que_es: p.que_es,
            pide_en_su_lugar: p.pide, corre_en_el_corte: !!delCorte[f],
            codigo: L.trim().slice(0, 120)
          });
        });
      });
    });

    var bloqueantes = hallazgos.filter(function (h) { return h.corre_en_el_corte; });
    var avisables = hallazgos.filter(function (h) { return !h.corre_en_el_corte; });

    console.log('\n══ GUARDA 7 · una ruta se pide, no se escribe ══');
    console.log('   scripts revisados: ' + fs.readdirSync(SDIR).filter(function (f) { return /\.js$/.test(f); }).length +
      '   ·   patrones del contrato: ' + PAT.length + '   ·   intocables: ' + INTOC.length);

    // 🔴 la evidencia completa va a un JSON, pero el AVISO se da aquí: un aviso que solo existe
    //    en un archivo es un aviso que no se dio.
    try {
      fs.mkdirSync(BACK + '/_preescritura', { recursive: true });
      fs.writeFileSync(BACK + '/_preescritura/guarda-rutas.json', JSON.stringify({
        cuando: new Date().toISOString(), revisados: SDIR, patrones: PAT, hallazgos: hallazgos
      }, null, 1), 'utf8');
    } catch (e) { /* la evidencia es una comodidad; el veredicto no depende de poder escribirla */ }

    /* 🔴 Y LA REGLA GENERAL, QUE ES LA QUE DE VERDAD CIERRA ESTO: ningún script debe construir una
     *    ruta desde el HOME, sea cual sea. Los 7 patrones de arriba son los que ya mordieron; esta
     *    comprobación atrapa el siguiente sin que nadie lo declare.
     *    La escribí porque `motor.clicks-desde-plataforma.js` se escapó de los 7: su ruta es
     *    `~/.claude/projects/<proyecto>/<ID-DE-SESIÓN>/tool-results` — la carpeta de resultados de
     *    UNA sesión de Claude Code. No es ninguno de los patrones y es la peor de todas: el id
     *    cambia en cada sesión, así que no corre ni en la máquina de Rick la próxima vez.
     *    Enumerar patrones es una prueba de regresión; la regla es «desde el home, nada». */
    var desdeElHome = [];
    fs.readdirSync(SDIR).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
      if (INTOC.indexOf(f) >= 0) return;
      soloCodigo(fs.readFileSync(path.join(SDIR, f), 'utf8')).forEach(function (L, i) {
        if (!/homedir\(\)\s*\+\s*['"]/.test(L)) return;
        desdeElHome.push({
          script: f, linea: i + 1, corre_en_el_corte: !!delCorte[f],
          codigo: L.trim().slice(0, 118)
        });
      });
    });
    if (desdeElHome.length) {
      console.log('   ── y la regla general: ' + desdeElHome.length + ' línea(s) construyen una ruta DESDE EL HOME');
      desdeElHome.slice(0, 8).forEach(function (h) {
        console.log('   ' + (h.corre_en_el_corte ? '🔴' : '⚠ ') + ' ' + h.script + ':' + h.linea);
        console.log('        ' + h.codigo);
      });
      var bloqH = desdeElHome.filter(function (h) { return h.corre_en_el_corte; });
      if (bloqH.length) B(NOMBRE + ' · ruta desde el home en el corte', bloqH.map(function (h) { return h.script + ':' + h.linea; }).join(' · '));
      else A(NOMBRE + ' · ruta desde el home', desdeElHome.length + ' línea(s), ninguna en el corte: ' +
        desdeElHome.slice(0, 4).map(function (h) { return h.script + ':' + h.linea; }).join(' · '));
    }

    if (!hallazgos.length && !desdeElHome.length) {
      OK(NOMBRE, 'ningún script escribe una ruta: todas se piden al contrato');
      return;
    }
    hallazgos.slice(0, 8).forEach(function (h) {
      console.log('   ' + (h.corre_en_el_corte ? '🔴' : '⚠ ') + ' ' + h.script + ':' + h.linea +
        '   escribe «' + h.patron.slice(0, 34) + '»');
      console.log('        ' + h.codigo);
      console.log('        → pide en su lugar: ' + h.pide_en_su_lugar);
    });
    if (hallazgos.length > 8) console.log('   … y ' + (hallazgos.length - 8) + ' más — todos en _preescritura/guarda-rutas.json');

    // 🔴 SE CUENTAN LOS SCRIPTS APARTE DE LOS HALLAZGOS: una sola línea puede infringir DOS
    //    patrones (la carpeta de OneDrive y el segmento del cliente viven en la misma ruta), así
    //    que contar hallazgos y decir «scripts» exagera. Decía «2 de ellos» con UN archivo
    //    plantado delante. Un veredicto que nombra mal lo que midió hace dudar de lo que midió.
    function cuantosScripts(hs) { var v = {}; hs.forEach(function (h) { v[h.script] = 1; }); return Object.keys(v).length; }
    if (bloqueantes.length) {
      var nB = cuantosScripts(bloqueantes);
      console.log('   🔴 BLOQUEA — ' + nB + ' script(s) del corte con ' + bloqueantes.length +
        ' hallazgo(s): la cadena dejaría de funcionar en otra máquina');
      B(NOMBRE, nB + ' script(s) del corte escriben la ruta (' + bloqueantes.length + ' hallazgo/s): ' +
        bloqueantes.slice(0, 4).map(function (h) { return h.script + ':' + h.linea; }).join(' · '));
    }
    if (avisables.length) {
      A(NOMBRE, cuantosScripts(avisables) + ' herramienta(s) fuera del corte escriben la ruta (' +
        avisables.length + ' hallazgo/s; se invocan a mano, no atoran el corte): ' +
        avisables.slice(0, 4).map(function (h) { return h.script + ':' + h.linea; }).join(' · '));
    }
  } catch (eG) {
    // NO PUDE EVALUAR no cuenta como pasar
    NE(NOMBRE, 'no se pudo revisar: ' + String(eG.message).slice(0, 70));
  }
})();

// ── veredicto de tres estados
console.log('\n════════════════════════════════════════════');
console.log('   ✔ pasan: ' + ok + '   ·   ⚠ avisan: ' + avisa.length + '   ·   ⊘ no evaluados: ' + noEvaluado.length + '   ·   🔴 bloquean: ' + bloquea.length);
avisa.forEach(function (x) { console.log('   ⚠ ' + x.nom + ' — ' + x.ev); });
noEvaluado.forEach(function (x) { console.log('   ⊘ ' + x.nom + ' — ' + x.por + '   (no cuenta como pasar)'); });
bloquea.forEach(function (x) { console.log('   🔴 ' + x.nom + ' — ' + x.ev); });
console.log(bloquea.length ? '\n════════ 🔴 BLOQUEA ════════' :
  noEvaluado.length ? '\n════════ ⚠ PASA CON ' + noEvaluado.length + ' SIN EVALUAR — no cuenta como verde ════════' :
    // 🔴 el conteo se CUENTA, no se escribe (29-sep-2026). Decía «LAS DOS GUARDAS EN VERDE» con
    //    SEIS guardas corriendo — se quedó en el nombre que tuvo el archivo el día que nació. Un
    //    veredicto que nombra mal lo que verificó invita a creer que se verificó menos.
    '\n════════ ✅ LAS ' + NGUARDAS + ' GUARDAS EN VERDE ════════');
process.exit(bloquea.length ? 1 : 0);
