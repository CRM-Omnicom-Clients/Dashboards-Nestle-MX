/*
 * orquestador.guardian-hojas-vs-bloques.js — D1: lo que NINGUNA puerta mira.
 *
 * 🔴 EL HUECO, Y POR QUÉ ES ESTRUCTURAL. La PUERTA 1 cruza los cuatro BLOQUES contra el CATÁLOGO.
 *    La PUERTA 2 cruza el REPORTE contra la REJILLA. Nadie compara las HOJAS CRUDAS del libro
 *    contra los bloques de los que salieron — así que una hoja puede quedarse atrás o adelante y
 *    las dos puertas siguen abriendo, porque ninguna la mira.
 *    No es teórico: hoy `Data_Qcart_Carritos` tiene 3,198 filas y su bloque 3,149 (+49), y
 *    `Data_Qcart_Productos` 946 contra 942 (+4). Antes la hoja iba ATRÁS (el escritor empareja
 *    contra filas que ya existen y no crea nuevas, así que seis piezas nunca llegaron); hoy va
 *    ADELANTE: conserva filas que el bloque ya no trae.
 *
 * 🔴 AVISA, NO BLOQUEA — a propósito. Las diferencias de hoy tienen causa conocida y decidida: las
 *    49 son TODAS de `004-P020`, la pieza cuyo envío nunca salió (Rick, 15-sep) pero cuyos cuatro
 *    shortlinks sí estuvieron activos, así que Qcart les atribuyó tráfico. Retirarlas de la hoja es
 *    decisión suya. Bloquear el corte por una decisión pendiente de un humano es como se consigue
 *    que alguien desactive una guarda.
 *    Lo que SÍ hace es que la diferencia deje de ser invisible, y la ATRIBUYE: dice qué piezas la
 *    explican, para que la decisión se tome sobre datos y no sobre un número suelto.
 *
 * 🔴 Y DISTINGUE LAS DOS DIRECCIONES, porque significan cosas distintas:
 *      hoja < bloque  →  el escritor no creó filas nuevas: hay DATOS QUE NO LLEGARON al libro
 *      hoja > bloque  →  la hoja conserva filas que el bloque ya no produce: RESIDUO o historia
 *    Contarlas juntas como «descuadre» esconde que una es pérdida y la otra no.
 *
 *   node orquestador.guardian-hojas-vs-bloques.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = path.resolve(__dirname, '..');
/* 🔴 LAS COLUMNAS SE PIDEN, Y LA GUARDA 4 ME BLOQUEÓ POR NO HACERLO. Escribí `f['Pieza_ID']` y
 *    `f['Email_Name']` directo, y el preflight paró el corte: «scripts del CORTE que leen columnas
 *    sin el catálogo raíz». Tenía razón — es la regla L1 del sistema, y la escribí yo mismo en la
 *    guarda que acabo de cablear. Un literal devuelve `undefined` en silencio y `undefined` se lee
 *    como vacío: así un script acusó de vacías a 98 de 98 filas sobre una columna llena al 100%.
 *    Aquí sería peor que en otros sitios: este guardián EXISTE para comparar llaves, así que una
 *    columna que no resuelve le haría decir que no empareja nada — que es exactamente el falso
 *    positivo que ya tuve (108 faltan y 108 sobran). */
var COL = require(__dirname + '/lib-columna.js');

function t(v) { return String(v == null ? '' : v).trim(); }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

/* qué hoja sale de qué bloque, y con qué LLAVE se emparejan sus filas.
 * 🔴 la llave se declara: comparar solo CONTEOS diría «cuadra» con las mismas filas cambiadas. */
var PARES = [
  {
    /* 🔴 EL MISMO CAMPO LÓGICO CON DOS NOMBRES FÍSICOS, uno por capa: la HOJA lo llama
     *    `Email_Name` y el BLOQUE sigue llamándolo `content_name`. Mi primera versión usó
     *    `email_name` en los dos lados y el resultado fue absurdo —108 filas «faltan» Y 108
     *    «sobran», con los conteos iguales—, que es la firma de una llave que no empareja NADA.
     *    Ese mismo par ya costó caro: el resolutor canónico buscaba `Content_Name` después del
     *    renombre a `Email_Name` y encontró **1 de 113**, dejando 6,471 clicks fuera del reporte
     *    sin que nada fallara. Aquí se declara la correspondencia en vez de suponerla, y queda
     *    anotado que la divergencia sigue viva: arreglarla es cambiarle el nombre en el bloque,
     *    no en el lector. */
    hoja: 'Data_Email', bloque: '_fuentes/email.json', campo: 'envios',
    llaveHoja: ['Pieza_ID', 'Email_Name'],
    llaveBloque: function (r) { return [t(r.pieza_id), t(r.content_name || r.email_name)].join('¦'); },
    nota: 'la hoja dice `Email_Name` y el bloque `content_name` — el mismo campo con dos nombres'
  },
  {
    hoja: 'Data_WhatsApp', bloque: '_fuentes/whatsapp.json', campo: 'envios',
    llaveHoja: ['Pieza_ID', 'Whatsapp_Name'],
    llaveBloque: function (r) { return [t(r.pieza_id || r.Pieza_ID), t(r.whatsapp_name || r.Whatsapp_Name)].join('¦'); }
  },
  {
    hoja: 'Data_Qcart_Carritos', bloque: '_fuentes/qcart.json', campo: 'carritos',
    llaveHoja: ['Pieza_ID', 'fecha', 'hora', 'shortlink_code', 'store'],
    llaveBloque: function (r) { return [t(r.pieza_id), t(r.fecha), t(r.hora), t(r.shortlink_code), t(r.store)].join('¦'); }
  },
  {
    hoja: 'Data_Qcart_Productos', bloque: '_fuentes/qcart.json', campo: 'productos',
    llaveHoja: ['Pieza_ID', 'fecha', 'hora', 'shortlink_code', 'store', 'product'],
    llaveBloque: function (r) { return [t(r.pieza_id), t(r.fecha), t(r.hora), t(r.shortlink_code), t(r.store), t(r.product)].join('¦'); }
  }
];

/* 🔴 LA COMPARACIÓN ES UNA FUNCIÓN PURA PARA PODER PLANTARLE LOS CASOS. Una guarda que solo se
 *    puede correr contra el sistema sano nunca demuestra que atrapa nada: «pasa siempre» y «no
 *    mira» se ven idénticos desde fuera. Y aquí ya me pasó en la primera versión —108 faltan y 108
 *    sobran con los conteos iguales— que es el aspecto de una llave que no empareja nada; sin un
 *    caso de control, eso se lee como «hay 108 filas perdidas» y manda a buscar un defecto que no
 *    existe. `--probar` le pone delante los cuatro casos que importan, en las dos direcciones. */
function comparar(filasHoja, filasBloque, llaveHoja, llaveBloque) {
  /* cada id lógico de la llave se RESUELVE contra los encabezados reales de la hoja. Si uno no
   * resuelve, se dice y se para: seguir con una columna menos haría que la llave emparejara por
   * casualidad. `opcional` devuelve `null` en vez de tronar, y aquí ese `null` SÍ es un fallo. */
  var reales = llaveHoja.map(function (id) {
    var r = filasHoja.length ? COL.opcional(filasHoja, id) : id;
    if (!r) throw new Error('la columna «' + id + '» no resuelve en esta hoja — la llave quedaría incompleta y emparejaría por casualidad');
    return r;
  });
  var enHoja = {}, sinLlave = 0;
  filasHoja.forEach(function (f) {
    var partes = reales.map(function (c) { return t(f[c]); });
    if (partes.every(function (x) { return x === ''; })) { sinLlave++; return; }
    var k = partes.join('¦');
    enHoja[k] = (enHoja[k] || 0) + 1;
  });
  var enBloque = {};
  filasBloque.forEach(function (r) { var k = llaveBloque(r); enBloque[k] = (enBloque[k] || 0) + 1; });
  return {
    sinLlave: sinLlave,
    noLlegaron: Object.keys(enBloque).filter(function (k) { return !enHoja[k]; }),
    residuo: Object.keys(enHoja).filter(function (k) { return !enBloque[k]; })
  };
}

if (process.argv.indexOf('--probar') >= 0) {
  console.log('══ ¿la guarda distingue, o solo pasa? ══');
  var LL = ['Pieza_ID', 'fecha'];
  var kb = function (r) { return [t(r.pieza_id), t(r.fecha)].join('¦'); };
  var CASOS = [
    ['todo cuadra → 0 y 0',
      [{ Pieza_ID: 'A', fecha: '1' }], [{ pieza_id: 'A', fecha: '1' }], 0, 0],
    ['🔴 el bloque trae una fila que la hoja NO tiene → PÉRDIDA, tiene que verla',
      [{ Pieza_ID: 'A', fecha: '1' }], [{ pieza_id: 'A', fecha: '1' }, { pieza_id: 'B', fecha: '2' }], 1, 0],
    ['⚠ la hoja tiene una que el bloque ya no trae → RESIDUO, también la ve',
      [{ Pieza_ID: 'A', fecha: '1' }, { Pieza_ID: 'Z', fecha: '9' }], [{ pieza_id: 'A', fecha: '1' }], 0, 1],
    ['🔴 MISMO CONTEO pero filas distintas → no cuadra, aunque los números engañen',
      [{ Pieza_ID: 'A', fecha: '1' }], [{ pieza_id: 'B', fecha: '2' }], 1, 1],
    ['una fila sin llave (nota a mano de Rick) no es un registro',
      [{ Pieza_ID: '', fecha: '' }, { Pieza_ID: 'A', fecha: '1' }], [{ pieza_id: 'A', fecha: '1' }], 0, 0]
  ];
  var malP = 0;
  CASOS.forEach(function (c) {
    var r = comparar(c[1], c[2], LL, kb);
    var bien = r.noLlegaron.length === c[3] && r.residuo.length === c[4];
    if (!bien) malP++;
    console.log('  ' + (bien ? '✔' : '🔴') + ' ' + c[0].padEnd(66) + '→ faltan ' + r.noLlegaron.length + ' · sobran ' + r.residuo.length);
  });
  console.log('\n' + (malP ? '🔴 ' + malP + ' caso(s) mal' : '✅ LOS ' + CASOS.length + ' CASOS SE DISTINGUEN — incluido el del mismo conteo con filas distintas'));
  process.exit(malP ? 1 : 0);
}

console.log('════ D1 · LAS HOJAS DEL LIBRO CONTRA LOS BLOQUES ════');
console.log('   (lo que la PUERTA 1 no mira porque cruza bloques vs catálogo,');
console.log('    y la PUERTA 2 tampoco porque cruza reporte vs rejilla)\n');

// el libro se copia a una ruta ASCII: las de OneDrive llevan acentos
var tmp = path.join(BACK, '_tmp', '_hojas-vs-bloques.xlsx');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.copyFileSync(ENT.LIBRO, tmp);
var WB = XLSX.readFile(tmp);
fs.unlinkSync(tmp);

var faltan = [], sobran = [], noEvaluado = [];
console.log('  hoja                      hoja   bloque   diferencia');
PARES.forEach(function (P) {
  if (!WB.Sheets[P.hoja]) { noEvaluado.push(P.hoja + ': la hoja no está en el libro'); return; }
  var bp = path.join(BACK, P.bloque);
  if (!fs.existsSync(bp)) { noEvaluado.push(P.hoja + ': no está ' + P.bloque + ' — ¿corrió su fuente?'); return; }
  var B = JSON.parse(fs.readFileSync(bp, 'utf8'))[P.campo];
  if (!Array.isArray(B)) { noEvaluado.push(P.hoja + ': el bloque no trae `' + P.campo + '`'); return; }

  var filas = XLSX.utils.sheet_to_json(WB.Sheets[P.hoja], { defval: '' });
  /* 🔴 SE USA EL MISMO COMPARADOR QUE PRUEBAN LOS SEÑUELOS. Tenía la lógica DUPLICADA: una copia
   *    aquí y otra en `comparar()`, la que `--probar` verifica. Eso es dos verdades del mismo
   *    hecho — el defecto de los dos censos — y significaba que los 5 señuelos probaban una
   *    función que el corte no usaba. */
  var R;
  try { R = comparar(filas, B, P.llaveHoja, P.llaveBloque); }
  catch (e) { noEvaluado.push(P.hoja + ': ' + e.message); return; }
  var sinLlave = R.sinLlave, noLlegaron = R.noLlegaron, residuo = R.residuo;
  var dif = filas.length - B.length;
  console.log('  ' + P.hoja.padEnd(24) + String(mil(filas.length)).padStart(6) + String(mil(B.length)).padStart(9) +
    '   ' + (dif === 0 ? '✔ igual' : (dif > 0 ? '+' : '') + mil(dif)) +
    (sinLlave ? '   (' + sinLlave + ' fila/s sin llave: notas a mano)' : ''));

  if (noLlegaron.length) faltan.push({ hoja: P.hoja, n: noLlegaron.length, muestra: noLlegaron.slice(0, 3), llaves: noLlegaron });
  if (residuo.length) sobran.push({ hoja: P.hoja, n: residuo.length, muestra: residuo.slice(0, 3), llaves: residuo });
});

/* ── a quién se le atribuye la diferencia ──────────────────────────────────────────────────── */
function porPieza(llaves) {
  var m = {};
  llaves.forEach(function (k) { var p = k.split('¦')[0] || '(sin pieza)'; m[p] = (m[p] || 0) + 1; });
  return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (p) { return p + ' (' + m[p] + ')'; });
}

if (faltan.length) {
  console.log('\n  🔴 FILAS DEL BLOQUE QUE NO LLEGARON A LA HOJA — esto SÍ es pérdida:');
  faltan.forEach(function (x) {
    console.log('     ' + x.hoja + ': ' + mil(x.n));
    console.log('        por pieza: ' + porPieza(x.llaves).slice(0, 8).join(' · '));
    console.log('        causa conocida: el escritor empareja contra filas que YA existen y no crea nuevas');
  });
}
if (sobran.length) {
  console.log('\n  ⚠ FILAS DE LA HOJA QUE EL BLOQUE YA NO TRAE — residuo o historia, no pérdida:');
  sobran.forEach(function (x) {
    console.log('     ' + x.hoja + ': ' + mil(x.n));
    console.log('        por pieza: ' + porPieza(x.llaves).slice(0, 8).join(' · '));
  });
}
if (noEvaluado.length) {
  console.log('\n  ⊘ NO PUDE EVALUAR (no cuenta como pasar):');
  noEvaluado.forEach(function (x) { console.log('     ' + x); });
}

fs.writeFileSync(BACK + '/_preescritura/hojas-vs-bloques.json', JSON.stringify({
  cuando: new Date().toISOString(),
  que_mide: 'las hojas crudas del libro contra los bloques de los que salieron — lo que ninguna de las dos puertas cruza',
  no_llegaron_a_la_hoja: faltan,
  sobran_en_la_hoja: sobran,
  no_evaluado: noEvaluado
}, null, 1), 'utf8');

var nF = faltan.reduce(function (s, x) { return s + x.n; }, 0);
var nS = sobran.reduce(function (s, x) { return s + x.n; }, 0);
console.log('\n════ ' + (noEvaluado.length ? '⊘ ' + noEvaluado.length + ' sin evaluar · ' : '') +
  (nF ? '🔴 ' + mil(nF) + ' fila(s) NO llegaron al libro' : '✔ nada del bloque se quedó fuera del libro') +
  (nS ? '   ·   ⚠ ' + mil(nS) + ' sobran en la hoja' : '') + ' ════');
console.log('   → _preescritura/hojas-vs-bloques.json');
// avisa; no bloquea. Las diferencias de hoy son decisiones pendientes de Rick, no defectos.
process.exit(0);
