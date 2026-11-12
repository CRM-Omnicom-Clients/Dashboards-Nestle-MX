// CENSO DE SCRIPTS · fase 1 — clasifica sin mover nada.
//
// 🔴 POR QUÉ EXISTE. Hay 225 scripts en `_scripts/` y solo 32 están en la cadena. Los otros 193 no
//    son «código de más»: son **decisiones fosilizadas**. Cada serie (`E`, `L`, `F`, `A`, `S`…) fue
//    una decisión de un día que quedó en piedra, y por eso conviven 36 prefijos distintos y llegué
//    a pisar nombres que ya existían (`S1`, `S7`, `S8`, `S9`, `S10` estaban tomados).
//
// 🔴 LA CLASIFICACIÓN SE MIDE, NO SE INTUYE. «Parece viejo» no es un criterio: es como se borra
//    algo que alguien sigue usando. Aquí un script es VIVO si la cadena lo declara **o si algo
//    vivo lo invoca** — y eso se resuelve siguiendo el grafo de llamadas, no leyendo el nombre.
//
// 🔴 Y NO MUEVE NADA. Esta fase solo mira. Mover es la fase 2, y va después de que Rick vea esto.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var D = BACK + '/_scripts';

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var files = fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); });
var texto = {};
files.forEach(function (f) { texto[f] = fs.readFileSync(D + '/' + f, 'utf8'); });

// ── quién invoca a quién: un script "invoca" a otro si lo nombra y ejecuta procesos
//
// 🔴 LOS COMENTARIOS NO INVOCAN. Esto decía `texto[f].indexOf(g) >= 0` sobre el archivo ENTERO, y
//    un nombre citado dentro de un comentario contaba como llamada. El caso que lo destapó (fase 6):
//    `orquestador.orquestador.js` nombra a `orquestador.resumen.js` UNA sola vez, dentro de un
//    comentario que explica **por qué NO lo usa** — y el censo lo declaró VIVO, «lo invoca el
//    orquestador». Cuatro escritores del Excel quedaron así: clasificados como parte del corte
//    cuando el corte no los corre. Es la clasificación más peligrosa de las diez, porque esconde
//    justo lo que hay que vigilar — un script que toca el archivo sin pasar por ninguna puerta.
function sinComentarios(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ')       // de bloque
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');   // de línea (el `[^:]` respeta un http:// en un string)
}
var codigo = {};
files.forEach(function (f) { codigo[f] = sinComentarios(texto[f]); });
var invoca = {};
files.forEach(function (f) {
  invoca[f] = [];
  if (!/exec(Sync|File)|spawn|require\(/.test(codigo[f])) return;
  files.forEach(function (g) {
    if (g === f) return;
    if (codigo[f].indexOf(g) >= 0) invoca[f].push(g);
  });
});

// ── la raíz de lo VIVO: la cadena (scripts + suites) y el orquestador
var raiz = {};
C.etapas.forEach(function (e) {
  e.scripts.forEach(function (n) {
    raiz[n.script] = { skill: e.skill, via: 'paso de la etapa ' + e.orden };
    (n.suites || []).forEach(function (s) { raiz[s] = { skill: e.skill, via: 'suite de ' + n.id }; });
  });
});
raiz['orquestador.orquestador.js'] = { skill: C.dirige, via: 'recorre la cadena' };
raiz['orquestador.cadena-skills.js'] = { skill: C.dirige, via: 'declara la cadena' };

// ── alcance transitivo: lo que algo vivo invoca, también vive
var vivo = {};
Object.keys(raiz).forEach(function (r) { vivo[r] = raiz[r]; });
var cambio = true, vueltas = 0;
while (cambio && vueltas++ < 20) {
  cambio = false;
  Object.keys(vivo).forEach(function (f) {
    (invoca[f] || []).forEach(function (g) {
      if (vivo[g]) return;
      vivo[g] = { skill: vivo[f].skill, via: 'lo invoca ' + f };
      cambio = true;
    });
  });
}

// ── clasificar
//
// 🔴 «ANTE LA DUDA, CLASIFICA» (Rick, 25-ago). Dejar 57 scripts en «no sé qué son» es dejar 57
//    sitios donde alguien puede correr algo que escribe el Excel sin dueño. Cuatro clases no
//    alcanzaban porque mezclaban cosas que se tratan distinto: un refutador no es un script del
//    corte, y una herramienta de diagnóstico no es una migración aplicada.
//
// 🔴 Y EL DUEÑO SE DECLARA CUANDO NO SE PUEDE INFERIR. Lo que sigue es una tabla de decisiones,
//    no de suposiciones: está escrita para poder discutirse. Un script sin dueño inferible y sin
//    entrada aquí **hace fallar el censo** — es la única forma de que «nada sin clasificar» sea
//    cierto mañana y no solo hoy.
var DUENO_DECLARADO = {
  /* ── 24-sep-2026 · CINCO DESTRUCTIVOS QUE LLEVABAN SEMANAS SIN DUEÑO ──────────────────────
   * 🔴 Los destapó la guarda al regenerar el censo, y tenía razón en bloquear el corte: los cinco
   *    escriben el archivo del cliente y ninguno le rendía cuentas a un skill. Son míos, de las
   *    sesiones de Maggi y del bloque de PAID, y nunca los declaré. Un script que escribe el Excel
   *    sin dueño es exactamente lo que dejó a `escritor.retirar.js` desplazando celdas y perdiendo
   *    5 columnas del catálogo. */
  'lib-hoja-xml.js':                ['crm-reporte-escritor', 'HERRAMIENTA', 'librería: escribe una hoja por XML conservando el formato. La usa el escritor, no se invoca sola'],
  'maggi.escribir-columnas.js':     ['crm-reporte-escritor', 'APLICADO', 'escribió las 6 columnas de la hoja «Maggi Reporte» (recetas, shortlinks, utms, ventana). Corrida y cerrada el 22-sep-2026'],
  'maggi.qcart-j9.js':              ['crm-reporte-fuentes-qcart', 'APLICADO', 'derivó las 11 columnas de Qcart de la pieza J9 en «Maggi Reporte». Corrida y cerrada el 22-sep-2026'],
  'maggi.corregir-utm-junio.js':    ['crm-reporte-nestle-catalogo', 'APLICADO', 'corrigió 12 utm de junio en el catálogo de Maggi. Corrida y cerrada'],
  'paid.crear-catalogo-plantilla.js': ['crm-reporte-orquestador', 'FUERA-DE-CICLO', 'plantilla del catálogo de PAID: otro reporte, no entra en este corte'],

  /* 🔴 30-sep y 2-oct-2026 · LOS DECLARO PORQUE LA GUARDA 1 ME BLOQUEÓ, y tenía razón. Los escribí
   *    para pasar lo de Maggi del reporte a su hoja y los dejé sin dueño: dos scripts que publican
   *    al libro del cliente sin rendirle cuentas a ningún skill. Es literalmente el caso que la
   *    guarda existe para parar —`escritor.retirar.js` desplazó celdas y perdió 5 columnas del
   *    catálogo escribiendo así— y la atrapó al primer corte siguiente, no meses después.
   *    Van al ESCRITOR porque lo que hacen es bajar datos a una hoja conservando su formato, que es
   *    su doctrina; no al skill de Qcart ni al del catálogo, que no escriben hojas de reporte. */
  'maggi.copiar-del-reporte.js':    ['crm-reporte-escritor', 'HERRAMIENTA', 'copia a «Maggi Reporte» las filas de Maggi de Report_Resumen conservando las 13 columnas propias de esa hoja. Se invoca cuando Rick lo pide, no en el corte'],
  'maggi.ajustar-filas-nuevas.js':  ['crm-reporte-escritor', 'HERRAMIENTA', 'iguala la altura de las filas nuevas de «Maggi Reporte» a la de las demás y les pone el Tipo Email de su hermana. Nace de que el render mostró dos franjas de ht=304 que ningún check veía'],

  // — el escritor único y su familia
  'escritor.escribir-todo.js':      ['crm-reporte-escritor', 'ESCRITOR', 'el escritor único: aplica lo que todos apuntan'],
  'escritor.cierre.js':             ['crm-reporte-escritor', 'HERRAMIENTA', 'cierra el libro tras una tanda de escrituras'],
  'Z-final.js':              ['crm-reporte-escritor', 'APLICADO', 'cierre de una migración concreta, ya corrida'],
  'escritor.restaurar.js':          ['crm-reporte-escritor', 'HERRAMIENTA', 'restaura desde un backup: es la red, no el corte'],
  'orquestador.publicar.js':          ['crm-reporte-orquestador', 'FUERA-DE-CICLO', 'publicar a producción — exige OK de Rick, por eso no está en la cadena'],
  // 🔴 DESCONGELADO 25-ago, CON PRUEBA — no por decreto. Se congeló porque su cirugía XML desplazó
  //    celdas y perdió datos en 5 columnas del catálogo. La causa era el ORDEN de las alternativas
  //    del regex: la pareja `<c …>…</c>` iba primero y se tragaba las celdas auto-cerradas (13,564
  //    en esa hoja), devorando todo hasta el siguiente `</c>`. Corregido, y probado por
  //    `escritor.probar-retiro.js`, que compara CELDA POR CELDA contra el nombre de su columna —
  //    la única comparación que sobrevive a un retiro, porque las letras se corren a propósito.
  //    Verificado además que con el regex viejo esa prueba FALLA (reproduce el daño exacto:
  //    Content_ID 119→0, Email_ID 299→119): no es una prueba vacía.
  'escritor.retirar.js':          ['crm-reporte-escritor', 'HERRAMIENTA', 'retira columnas fantasma tras fusionarlas · probado por escritor.probar-retiro.js'],
  'escritor.probar-retiro.js':    ['crm-reporte-escritor', 'ADVERSARIAL', 'planta el retiro sobre una copia y exige que ninguna celda cambie de columna'],
  'catalogo.fusionar-fantasmas.js': ['crm-reporte-nestle-catalogo', 'VIVO', 'fusiona fantasma con viva ANTES de retirar · vieja y nueva SE QUEDAN AMBOS'],
  'orquestador.reporte.js':           ['crm-reporte-orquestador', 'RETIRADO', 'era un segundo runner del corte; se niega a correr'],
  // — herramientas de análisis, se invocan a mano con propósito
  'orquestador.censo-scripts.js':          ['crm-reporte-orquestador', 'HERRAMIENTA', 'este censo'],
  'orquestador.revalidar-todo.js':       ['crm-reporte-orquestador', 'HERRAMIENTA', 'corre la batería de validadores contra el libro ya escrito'],
  'orquestador.e2e.js':              ['crm-reporte-orquestador', 'HERRAMIENTA', 'prueba de punta a punta'],
  'orquestador.retiro.js':           ['crm-reporte-orquestador', 'HERRAMIENTA', 'mide quién cita a quién antes de retirar algo'],
  'catalogo.codigos-maestro.js':  ['crm-reporte-nestle-catalogo', 'HERRAMIENTA', 'contrasta los códigos del catálogo contra el maestro de links'],
  'catalogo.catalogo-limpieza.js':['crm-reporte-nestle-catalogo', 'HERRAMIENTA', 'fusión de fantasmas y revisión de vacíos del catálogo'],
  'N1b-puente-catalogos.js': ['crm-reporte-nestle-catalogo', 'APLICADO', 'puente entre el catálogo viejo y el nuevo'],
  'E-prefijo.js':            ['crm-reporte-escritor', 'APLICADO', 'escribió el prefijo dimensional en las hojas'],
  'Z-ancla-referencias.js':  ['crm-reporte-nestle-catalogo', 'APLICADO', 'ancló Catalogo_Referencias'],
  'Z-fechas-completo.js':    ['crm-reporte-nestle-catalogo', 'APLICADO', 'completó las fechas del catálogo'],
  'Z-ids-anclados.js':       ['crm-reporte-nestle-catalogo', 'APLICADO', 'ancló los ids a su campaña'],
  'Z-ids-estables.js':       ['crm-reporte-nestle-catalogo', 'APLICADO', 'estabilizó los ids'],
  'Z-periodo-granular.js':   ['crm-reporte-nestle-catalogo', 'APLICADO', 'declaró la granularidad del periodo'],
  'catalogo.medir-quincenas.js':    ['crm-reporte-nestle-catalogo', 'HERRAMIENTA', 'mide cómo quedan las quincenas'],
  'orquestador.trazabilidad.js':       ['crm-reporte-orquestador', 'HERRAMIENTA', 'traza de dónde salió cada dato'],
  'Z-reparar-refutacion.js': ['crm-reporte-nestle-catalogo', 'APLICADO', 'reparó lo que encontró Z-refutar'],
  'Z-reparar2.js':           ['crm-reporte-nestle-catalogo', 'APLICADO', 'segunda tanda de reparaciones'],
  'N2-00-inventario.js':     ['crm-reporte-fuentes-insumos', 'APLICADO', 'inventario de la migración al sistema 3'],
  'N2-01-diff-email.js':     ['crm-reporte-fuentes-email', 'APLICADO', 'diff de la migración de email'],
  'N2-03-fuentes-email.js':  ['crm-reporte-fuentes-email', 'APLICADO', 'migración de la fuente de email'],
  'N2-04-quincenas.js':      ['crm-reporte-fuentes-email', 'APLICADO', 'migración de quincenas'],
  'N2-05-fuentes-qcart.js':  ['crm-reporte-fuentes-qcart', 'APLICADO', 'migración de la fuente de qcart'],
  'N2-99-validar.js':        ['crm-reporte-fuentes-insumos', 'APLICADO', 'validó aquella migración'],
  'N3-99-validar-puerta1.js':['crm-reporte-fuentes-cuadre', 'APLICADO', 'validaba la PUERTA 1 de la era N3, que `N2v-cuadre` sustituyó']
};
// ⚠ MIS PROPIAS HERRAMIENTAS DE HOY, que la regex de series se tragaba. `S0`, `S2`, `S4` y `S5`
//   no son migraciones aplicadas: son herramientas que se invocan con propósito. Meterlas en el
//   archivo habría sido archivar el censo mientras se usa el censo.
// ⚠ Y LAS DE LA PROPIA MIGRACIÓN. Rompí el invariante yo mismo: creé cuatro scripts DESPUÉS de
//   correr el censo y quedaron sin clasificar. «Nada huérfano» no es un estado que se alcanza una
//   vez — es uno que hay que sostener, y la forma de sostenerlo es que crear un script sin
//   declararlo haga fallar el censo. Que es lo que pasó, y por eso se ve.
['orquestador.inventario-hojas.js', 'orquestador.fantasmas-y-ligamx.js', 'orquestador.html-cadena-skills.js',
 'orquestador.estatus-instrucciones.js', 'orquestador.columnas-perdidas.js', 'orquestador.archivar-aplicados.js',
 'orquestador.colocar-por-skill.js', 'orquestador.extraer-decisiones.js', 'orquestador.medir-duplicacion.js'].forEach(function (f) {
  DUENO_DECLARADO[f] = ['crm-reporte-orquestador', 'HERRAMIENTA', 'herramienta de la migración de scripts: se invoca con propósito'];
});
DUENO_DECLARADO['orquestador.validar-capacidades.js'] =
  ['crm-reporte-orquestador', 'ADVERSARIAL', 'compara cada capacidad contra el código que sustituye: si difieren, no puede sustituirlo'];
DUENO_DECLARADO['orquestador.renombrar-por-skill.js'] =
  ['crm-reporte-orquestador', 'HERRAMIENTA', 'fase 5: pone el skill delante del nombre, actualizando referencias antes de mover'];

// 🔴 EL EMAIL DE DATORAMA ESTÁ MUERTO, y su validador con él. Lo destapó el renombre: `N2a-99-validar`
//    y `NC-99-validar` querían el mismo nombre nuevo. No es un choque a desambiguar con un sufijo —
//    es que uno de los dos valida un script que ya nadie llama. El orquestador lo dice desde el 20-ago:
//    «N2a-email.js sigue en disco pero NO se llama: en una corrida en seco PISÓ el bloque de SFMC».
//    Declararlos aplicados es lo honesto; inventarles un sufijo habría conservado un validador que
//    mide contra una fuente que ya no existe — justo lo que Rick dijo de los refutadores viejos.
DUENO_DECLARADO['N2a-email.js'] =
  ['crm-reporte-fuentes-email', 'APLICADO', 'el bloque de email cuando salía de Datorama; hoy sale del MCP de SFMC (NC-email-piezas)'];
DUENO_DECLARADO['N2a-99-validar.js'] =
  ['crm-reporte-fuentes-email', 'APLICADO', 'validaba el bloque de Datorama; su sustituto es NC-99-validar'];
DUENO_DECLARADO['N2a-96-simular-nuevo.js'] =
  ['crm-reporte-fuentes-email', 'APLICADO', 'simulaba sobre el bloque de Datorama'];
DUENO_DECLARADO['N2a-97-refutar.js'] =
  ['crm-reporte-fuentes-email', 'APLICADO', 'refutaba el bloque de Datorama'];
DUENO_DECLARADO['N2a-98-simular-siguiente.js'] =
  ['crm-reporte-fuentes-email', 'APLICADO', 'simulaba el paso siguiente del bloque de Datorama'];

// ⚠ Y TRES QUE MI INFERENCIA PUSO EN EL SITIO EQUIVOCADO. `skillPorPrefijo` los mandó a
//   `fuentes-email` por su prefijo `E`/`L`, y no son de email: son de la fundación del registro.
DUENO_DECLARADO['orquestador.1-esquema.js'] =
  ['crm-reporte-orquestador', 'HERRAMIENTA', 'declara el esquema: el modelo de datos que TODOS los skills leen'];
DUENO_DECLARADO['orquestador.sembrar-registro.js'] =
  ['crm-reporte-orquestador', 'HERRAMIENTA', 'siembra el registro de nombres leyendo el libro real'];
DUENO_DECLARADO['orquestador.reconciliar.js'] =
  ['crm-reporte-orquestador', 'HERRAMIENTA', 'reconcilia el registro cuando un nombre físico cambió'];
DUENO_DECLARADO['orquestador.probar-renombre.js'] =
  ['crm-reporte-orquestador', 'ADVERSARIAL', 'prueba que el registro sobrevive a un renombre'];
DUENO_DECLARADO['L2-99-validar.js'] =
  ['crm-reporte-orquestador', 'ADVERSARIAL', 'valida el registro de nombres'];
DUENO_DECLARADO['orquestador.refutar-cadena.js'] = ['crm-reporte-orquestador', 'ADVERSARIAL', 'ataca la cadena de skills: 8 intentos de demostrar que la migración es de mentira'];

// 🔴 CADA SERIE TIENE DUEÑO, y se declara. Sin esto 67 de 110 caían en «orquestador» por descarte,
//    que es lo contrario de «todo claro dónde va»: un cajón de sastre no es una clasificación.
var SERIE_SKILL = {
  A2: 'fuentes-qcart', A9: 'fuentes-qcart', A6: 'fuentes-qcart',           // Liga MX y links
  Q1: 'fuentes-qcart', Q3: 'fuentes-qcart', Q4: 'fuentes-qcart', Q5: 'fuentes-qcart', Q7: 'fuentes-qcart',
  P1: 'nestle-catalogo', P2: 'nestle-catalogo', P3: 'nestle-catalogo',      // parser/alias del catálogo
  P4: 'nestle-catalogo', P5: 'nestle-catalogo', P6: 'nestle-catalogo',
  FA: 'escritor', FA2: 'escritor', FA3: 'escritor', FF: 'escritor',         // layout y doctrina
  FB: 'nestle-catalogo', FB2: 'nestle-catalogo', FB4: 'nestle-catalogo',
  FB5: 'nestle-catalogo', FB6: 'nestle-catalogo', FB7: 'nestle-catalogo',
  FE: 'fuentes-email', FH: 'nestle-catalogo', FJ: 'orquestador', FK: 'nestle-catalogo', FL: 'nestle-catalogo',
  G1: 'nestle-catalogo', G2: 'fuentes-whatsapp', G3: 'nestle-catalogo',
  A1: 'fuentes-qcart', A3: 'nestle-catalogo', A4: 'nestle-catalogo', A5: 'nestle-catalogo',
  A8: 'nestle-catalogo', A10: 'nestle-catalogo', A11: 'escritor',
  C1: 'escritor', C3: 'escritor', D: 'escritor', R1: 'escritor',
  S1: 'nestle-catalogo', S7: 'nestle-catalogo', S8: 'nestle-catalogo', S9: 'nestle-catalogo', S10: 'fuentes-email',
  M0: 'orquestador', MIGRAR: 'orquestador', AUDIT: 'orquestador',
  marcar: 'nestle-catalogo', registrar: 'fuentes-insumos', reparar: 'escritor'
};
// los `Z-dx*` y `Z-prueba-*` son diagnóstico de un día: herramienta del orquestador
var SERIES_APLICADAS = /^(E\d|L\d|F[A-Z]|A\d|S\d|B\d|C\d|D-|G\d|P\d|Q\d|M\d|R\d|NB|MIGRAR|AUDIT|marcar|registrar|reparar)/;
var clase = { VIVO: [], LIBRERIA: [], ADVERSARIAL: [], HERRAMIENTA: [], APLICADO: [],
              ESCRITOR: [], 'FUERA-DE-CICLO': [], CONGELADO: [], RETIRADO: [], SIN_CLASIFICAR: [] };

// 🔴 UN NOMBRE YA MIGRADO LLEVA SU SKILL DELANTE — y eso ES la clasificación. Tras la fase 5 el
//    censo marcó 5 «sin clasificar» que en realidad eran los suyos propios ya renombrados: el mapa
//    declarado seguía buscándolos por su nombre viejo. El sistema tiene que reconocer su propio
//    resultado, o cada fase deja rota a la anterior.
var SKILLS_CONOCIDOS = ['escritor', 'motor', 'resumen', 'orquestador', 'catalogo',
  'fuentes-email', 'fuentes-qcart', 'fuentes-whatsapp', 'fuentes-manual', 'fuentes-cuadre',
  'fuentes-insumos', 'insights'];
function skillDelNombre(f) {
  var m = /^([a-z-]+)\./.exec(f);
  if (!m) return null;
  return SKILLS_CONOCIDOS.indexOf(m[1]) >= 0 ? m[1] : null;
}
function claseDelNombre(f) {
  if (/\.(refutar|refuta-|simular|simular-|probar|prueba|probar-)/.test(f)) return 'ADVERSARIAL';
  if (/\.(tool-|dx\d|censo|archivar|colocar|extraer|medir|renombrar|revalidar|trazabilidad|restaurar|cierre)/.test(f)) return 'HERRAMIENTA';
  return null;
}

function skillPorPrefijo(f) {
  // el prefijo del paso dice de qué etapa venía: email-bloque→email, qcart-bloque→qcart, whatsapp-bloque→whatsapp, PUERTA-1→cuadre…
  if (/^email-bloque|^NC-/.test(f)) return 'crm-reporte-fuentes-email';
  if (/^qcart-bloque|^B\d/.test(f)) return 'crm-reporte-fuentes-qcart';
  if (/^whatsapp-bloque|^FD/.test(f)) return 'crm-reporte-fuentes-whatsapp';
  if (/^manual-bloque/.test(f)) return 'crm-reporte-fuentes-manual';
  if (/^PUERTA-1|^PUERTA-2|^N3-99/.test(f)) return 'crm-reporte-fuentes-cuadre';
  if (/^insumos-validar[^dg]|^insumos-validar$/.test(f)) return 'crm-reporte-fuentes-insumos';
  if (/^motor-calculo|^motor-clicks/.test(f)) return 'crm-reporte-motor';
  if (/^resumen-regenerar/.test(f)) return 'crm-reporte-resumen';
  if (/^escritor-neutralizar|^escritor-datos/.test(f)) return 'crm-reporte-escritor';
  if (/^Z-|^E\d|^L\d/.test(f)) return 'crm-reporte-nestle-catalogo';
  return 'crm-reporte-orquestador';
}

files.forEach(function (f) {
  var p = null;   // se calcula abajo con `propiedades`, declarada más adelante
  /* 🔴 UNA DECLARACIÓN EXPLÍCITA LE GANA AL PREFIJO DEL NOMBRE (24-sep-2026).
   *    El atajo `lib-*` iba PRIMERO, así que mandaba toda librería a LIBRERIA con skill
   *    «(fundación)» aunque estuviera declarada a mano. `lib-hoja-xml.js` borra archivos, y la
   *    guarda trata «(fundación)» como «sin dueño»: bloqueaba el corte y no había forma de
   *    resolverlo declarándolo, porque la declaración no llegaba a leerse.
   *    Es la misma lección que «el nombre no dice si corre»: la propiedad se declara, no se
   *    deduce del prefijo. */
  var dec = DUENO_DECLARADO[f];
  if (!dec && /^lib-/.test(f)) { clase.LIBRERIA.push({ f: f, skill: '(fundación)' }); return; }
  if (dec) { clase[dec[1]].push({ f: f, skill: dec[0], via: 'declarado: ' + dec[2] }); return; }
  if (vivo[f]) { clase.VIVO.push({ f: f, skill: vivo[f].skill, via: vivo[f].via }); return; }
  // adversarial: refuta, simula o prueba una puerta — y NO escribe el Excel
  if (/refutar|simular|probar|prueba|-9[678]-/.test(f)) {
    clase.ADVERSARIAL.push({ f: f, skill: skillPorPrefijo(f), via: 'refuta o simula · la cadena NO lo corre' }); return;
  }
  if (/^Z-dx/.test(f)) { clase.HERRAMIENTA.push({ f: f, skill: 'crm-reporte-orquestador', via: 'diagnóstico puntual' }); return; }
  // ya migrado: su nombre lleva el skill delante
  //
  // 🔴 EL NOMBRE DICE DE QUIÉN ES, NUNCA SI LA CADENA LO CORRE. Son dos preguntas distintas y este
  //    bloque las confundía: caía en `|| 'VIVO'`, así que un script pasaba a «lo corre el corte»
  //    por llevar `orquestador.` delante. Después del renombre de la fase 5 TODOS llevan prefijo,
  //    de modo que el defecto crecía con cada migración. Siete quedaron VIVO por su nombre y los
  //    siete escriben el Excel; el grafo de llamadas dice que a tres no los invoca nadie.
  //    Es «nada se infiere del naming» aplicado a mis propios scripts.
  //    La propiedad viene del nombre; el turno, del grafo. Sin turno → FUERA-DE-CICLO.
  var sk = skillDelNombre(f);
  if (sk) {
    var cl = claseDelNombre(f) || 'FUERA-DE-CICLO';
    clase[cl].push({ f: f, skill: ENT.PREFIJO_SKILL + (sk === 'catalogo' ? 'nestle-catalogo' : sk === 'insights' ? 'nestle-insights' : sk),
      via: 'el nombre declara su skill · ' + (cl === 'FUERA-DE-CICLO' ? 'NADIE lo invoca: no tiene turno en el corte' : 'clase por su verbo') });
    return;
  }
  if (SERIES_APLICADAS.test(f)) {
    var sr = (/^([A-Za-z]+\d*)/.exec(f) || [])[1];
    clase.APLICADO.push({ f: f, serie: sr,
      skill: SERIE_SKILL[sr] ? ENT.PREFIJO_SKILL + SERIE_SKILL[sr] : skillPorPrefijo(f) });
    return;
  }
  clase.SIN_CLASIFICAR.push({ f: f });
});

// ── qué es destructivo y qué es adversarial: dos propiedades que cambian el trato
function propiedades(f) {
  var x = texto[f];
  return {
    escribe_excel: /copyFileSync\([^)]*vivo|writeZip|updateFile|regenerarHoja|apuntarColumna/.test(x) && !/^lib-/.test(f),
    borra: /quitarColumnas|unlink|retirar|\bborra\b/i.test(x) && /writeZip|updateFile/.test(x),
    adversarial: /refutar|probar-que-cierra|simular|puerta/i.test(f),
    apunta: /CB\.apuntar/.test(x)
  };
}

console.log('════════ CENSO DE SCRIPTS · fase 1 ════════\n');
console.log('  scripts: ' + files.length + '\n');
var ORDEN = ['VIVO', 'ESCRITOR', 'ADVERSARIAL', 'HERRAMIENTA', 'LIBRERIA', 'FUERA-DE-CICLO',
             'APLICADO', 'CONGELADO', 'RETIRADO', 'SIN_CLASIFICAR'];
ORDEN.forEach(function (k) {
  var g = clase[k]; if (!g.length) return;
  var dest = g.filter(function (x) { return propiedades(x.f).escribe_excel; }).length;
  console.log('  ' + String(g.length).padStart(4) + '  ' + k.padEnd(16) +
    (dest ? '🔴 ' + dest + ' escriben el Excel' : ''));
});

// 🔴 LA VALIDACIÓN DE LA FASE: nada sin clasificar, y nada sin dueño.
var sinDueno = [];
ORDEN.forEach(function (k) {
  if (k === 'LIBRERIA' || k === 'SIN_CLASIFICAR') return;
  clase[k].forEach(function (x) { if (!x.skill) sinDueno.push(k + ' · ' + x.f); });
});
console.log('\n  ══ VALIDACIÓN DE LA FASE 1 ══');
console.log('   ' + (clase.SIN_CLASIFICAR.length === 0 ? '✔' : '🔴') + ' nada sin clasificar: ' + clase.SIN_CLASIFICAR.length);
console.log('   ' + (sinDueno.length === 0 ? '✔' : '🔴') + ' nada sin dueño: ' + sinDueno.length);
var suma = ORDEN.reduce(function (a, k) { return a + clase[k].length; }, 0);
console.log('   ' + (suma === files.length ? '✔' : '🔴') + ' las clases suman el total: ' + suma + ' de ' + files.length);
if (clase.SIN_CLASIFICAR.length) clase.SIN_CLASIFICAR.forEach(function (x) { console.log('      🔴 ' + x.f); });
if (sinDueno.length) sinDueno.slice(0, 10).forEach(function (x) { console.log('      🔴 ' + x); });

console.log('\n  ══ VIVO — por skill ══');
var porSkill = {};
clase.VIVO.forEach(function (x) { (porSkill[x.skill] = porSkill[x.skill] || []).push(x); });
Object.keys(porSkill).sort().forEach(function (s) {
  console.log('   ' + s.replace(ENT.PREFIJO_SKILL, '') + '  (' + porSkill[s].length + ')');
  porSkill[s].forEach(function (x) {
    var p = propiedades(x.f);
    console.log('      ' + x.f.padEnd(34) + (p.escribe_excel ? '✍ escribe  ' : '           ') +
      (p.adversarial ? '⚔ adversarial  ' : '               ') + x.via);
  });
});

console.log('\n  ══ SIN CLASIFICAR — nadie los invoca y no declaran qué fueron ══');
console.log('  🔴 ' + clase.SIN_CLASIFICAR.length + ' — estos NO se tocan hasta saber qué son');
clase.SIN_CLASIFICAR.forEach(function (x) {
  var p = propiedades(x.f);
  console.log('     ' + x.f.padEnd(34) + (p.escribe_excel ? '🔴 ESCRIBE EL EXCEL' : ''));
});

console.log('\n  ══ APLICADO — decisiones ya ejecutadas, candidatas a archivo ══');
var porSerie = {};
clase.APLICADO.forEach(function (x) { (porSerie[x.serie] = porSerie[x.serie] || []).push(x.f); });
console.log('   ' + Object.keys(porSerie).sort().map(function (s) { return s + '(' + porSerie[s].length + ')'; }).join(' · '));

fs.writeFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', JSON.stringify({
  paso: 'censo-scripts', fase: 1, que_hace: 'clasifica sin mover nada',
  total: files.length,
  // 🔴 SE PERSISTEN TODAS LAS CLASES, no las cuatro originales. Escribí el JSON con cuatro cuando
  //    ya había diez, y la fase siguiente leyó «0 candidatos» — un censo que no persiste lo que
  //    clasificó deja a quien lo consume creyendo que no hay nada que hacer.
  clases: ORDEN.reduce(function (a, k) {
    a[k] = k === 'LIBRERIA' ? clase[k].map(function (x) { return x.f; }) : clase[k];
    return a;
  }, {}),
  propiedades: files.reduce(function (a, f) { a[f] = propiedades(f); return a; }, {})
}, null, 1));
console.log('\n  → _contratos/orquestador.censo-scripts.json');
console.log('  ⚠ fase 1: nada se movió. Mover es la fase 2.');
