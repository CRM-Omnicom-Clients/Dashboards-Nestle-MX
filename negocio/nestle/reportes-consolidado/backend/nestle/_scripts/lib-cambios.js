// lib-cambios · EL ACUMULADOR: todos los scripts apuntan lo que quieren cambiar, nadie escribe.
//
// 🔴 POR QUÉ EXISTE, y es una corrección a cómo venía trabajando. La doctrina dice que el backend
//    CALCULA y el escritor TRANSCRIBE, y que el Excel se abre las menos veces posibles — cada
//    apertura es una oportunidad de corromperlo. Pero yo venía haciendo calcular→escribir→publicar
//    **por paso**: cinco scripts de catálogo eran cinco aperturas, cinco cadenas de validación y
//    cinco respaldos. Y a mitad del plan el archivo se puso `EBUSY` con cuatro scripts por delante.
//
// 🔴 CÓMO QUEDA: cada script apunta aquí sus celdas con su motivo, sin tocar nada. Cuando todos
//    terminaron, UN escritor las aplica de una pasada, corre las cinco capas una vez y publica.
//    Si el archivo está tomado, no se pierde nada: los cambios siguen apuntados.
//
// 🔴 Y DOS SCRIPTS NO PUEDEN PISAR LA MISMA CELDA EN SILENCIO. Si dos apuntan a la misma, se
//    declara el choque y el escritor **no aplica ninguno de los dos** hasta que se resuelva:
//    el último que escribe ganando por casualidad es exactamente cómo se pierden datos.
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var RUTA = BACK + '/_contratos/cambios-pendientes.json';
var t = function (v) { return String(v == null ? '' : v).trim(); };

function cargar() {
  if (!fs.existsSync(RUTA)) return { corte: '', abierto: true, cambios: [] };
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}
function guardar(C) { fs.writeFileSync(RUTA, JSON.stringify(C, null, 1)); }

/** Empieza un lote limpio. Se llama UNA vez, al principio del corte. */
function abrir(corte) {
  guardar({ corte: corte || '', abierto: true, cambios: [],
    regla: 'los scripts apuntan; nadie escribe hasta que el escritor los aplica de una pasada' });
  return true;
}

/**
 * Apunta el cambio de UNA celda.
 * @param paso    quién lo pide (A3, A4…) — para poder rastrear cada celda a su motivo
 * @param hoja    nombre de la hoja
 * @param fila    número de fila REAL (1-based, como Excel)
 * @param columna nombre de la COLUMNA, nunca su letra
 * @param valor   lo que va a quedar
 * @param porque  el motivo, en una línea. Sin motivo no se apunta.
 */
/**
 * 🔴 UN LOTE CERRADO NO ACEPTA APUNTES. Z cierra y vacía el lote al publicar; si un script apunta
 *    después sin abrir uno nuevo, sus cambios quedarían mezclados con un corte ya aplicado y la
 *    próxima escritura intentaría re-aplicar lo viejo. Pasó: Z se estrelló contra 15 columnas que
 *    él mismo acababa de renombrar. Mejor negarse con un mensaje que diga qué hacer.
 */
function exigirAbierto(paso) {
  var C = cargar();
  if (C.abierto === false) throw new Error('🔴 CAMBIOS · el lote «' + (C.corte || '?') + '» está CERRADO ' +
    '(se aplicó y se vació). ' + paso + ' no puede apuntar sobre él.\n' +
    '   Abre uno nuevo: require(lib-cambios).abrir(\'<nombre-del-corte>\')');
}

function apuntar(paso, hoja, fila, columna, valor, porque) {
  if (!t(porque)) throw new Error('🔴 CAMBIOS · ' + paso + ' apuntó ' + hoja + '!' + columna + fila + ' sin motivo. Un cambio sin porqué no se puede revisar.');
  exigirAbierto(paso);
  var C = cargar();
  C.cambios.push({ paso: paso, hoja: hoja, fila: fila, columna: t(columna), valor: valor, porque: t(porque) });
  guardar(C);
}

/**
 * 🔴 APUNTAR POR LOTE — una sola escritura del JSON.
 *    `apuntar()` hace cargar+guardar del archivo entero en CADA llamada. Con 4,370 celdas eso es
 *    O(n²) sobre un JSON que crece: gigabytes de I/O para escribir unos megas. Cuando un script sabe
 *    de antemano todo lo que va a apuntar —y clasificar celdas vacías es justo ese caso— entrega
 *    la lista completa y el archivo se escribe UNA vez.
 *
 * @param lista array de { hoja, fila, columna, valor, porque }
 */
function apuntarLote(paso, lista) {
  exigirAbierto(paso);
  var C = cargar();
  var sinMotivo = lista.filter(function (x) { return !t(x.porque); });
  if (sinMotivo.length) throw new Error('🔴 CAMBIOS · ' + paso + ' apuntó ' + sinMotivo.length +
    ' celda(s) sin motivo. Un cambio sin porqué no se puede revisar.');
  lista.forEach(function (x) {
    C.cambios.push({ paso: paso, hoja: x.hoja, fila: x.fila, columna: t(x.columna), valor: x.valor, porque: t(x.porque) });
  });
  guardar(C);
  return lista.length;
}

/** Varios de golpe, mismo paso/hoja/fila: { columna: valor } */
function apuntarFila(paso, hoja, fila, pares, porque) {
  Object.keys(pares).forEach(function (c) { apuntar(paso, hoja, fila, c, pares[c], porque); });
}

/**
 * 🔴 SUPERSEDE — «leí lo que ya estaba apuntado para esta celda y esto lo reemplaza».
 *
 *    Es distinto de un choque. Un choque son dos scripts que NO se hablaron y piden cosas
 *    distintas: eso para la escritura, porque dejar que gane el último por orden de ejecución
 *    es cómo se pierde un dato. Esto es un script que **leyó el estado futuro** —lo pendiente
 *    incluido— y lo está refinando a propósito. La diferencia se declara: queda escrito qué
 *    reemplazó a qué y por qué, así que se puede auditar.
 *
 *    Caso real que lo motivó: A2 movió unos shortlinks entre piezas y dejó dos códigos en una
 *    celda; A6b, que corre después y lee el estado futuro, descubrió que esos dos ni siquiera
 *    están en la autoridad de links y la celda tiene que quedar vacía. El valor de A2 no estaba
 *    «mal»: era un estado intermedio.
 */
function apuntarSobre(paso, hoja, fila, columna, valor, porque) {
  if (!t(porque)) throw new Error('🔴 CAMBIOS · ' + paso + ' reemplazó ' + hoja + '!' + columna + fila + ' sin motivo.');
  var C = cargar();
  var previos = C.cambios.filter(function (x) { return x.hoja === hoja && x.fila === fila && x.columna === t(columna); });
  C.cambios = C.cambios.filter(function (x) { return !(x.hoja === hoja && x.fila === fila && x.columna === t(columna)); });
  C.cambios.push({ paso: paso, hoja: hoja, fila: fila, columna: t(columna), valor: valor, porque: t(porque),
    reemplaza: previos.map(function (p) { return { paso: p.paso, valor: p.valor }; }) });
  guardar(C);
  return previos.length;
}

/**
 * 🔴 LA VISTA FUTURA — el problema que trae acumular en vez de escribir.
 *
 *    Mientras nadie escribe, el workbook sigue diciendo lo viejo. Un paso que corre después y
 *    lee la hoja del disco **ve un estado que ya está condenado**, y decide contra él. Eso ya
 *    pasó: A6b tuvo que inventarse su propio `valorFuturo()` para no pisar a A2.
 *
 *    Aquí queda una sola vez, para todos: devuelve las filas de la hoja con los cambios
 *    pendientes ya aplicados encima. Un paso que lee así ve lo que **va a haber**, no lo que hay.
 *
 * @param hoja  nombre de la hoja
 * @param filas array de objetos como los da `XLSX.utils.sheet_to_json` (fila 1 = encabezado,
 *              así que `filas[i]` es la fila real `i + 2`)
 * @param base  (opcional) número de la primera fila de datos. Por defecto 2.
 */
function vistaFutura(hoja, filas, base) {
  base = base || 2;
  var pend = cargar().cambios.filter(function (x) { return x.hoja === hoja; });
  if (!pend.length) return filas;
  var copia = filas.map(function (f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = f[k]; }); return o; });
  var fuera = 0;
  pend.forEach(function (x) {
    // la fila 1 es el ENCABEZADO, no un dato: un renombre de columna no entra en la vista de
    // filas. Ignorarlo en silencio es correcto; avisar de él sería ruido en cada corrida.
    if (x.fila < base) return;
    var i = x.fila - base;
    if (i >= copia.length) { fuera++; return; }
    copia[i][x.columna] = x.valor;
  });
  if (fuera) console.log('   ⚠ vistaFutura(' + hoja + '): ' + fuera + ' cambio(s) apuntan a filas que no existen');
  return copia;
}

/** Borra lo apuntado por un script, para poder re-correrlo limpio cuando cambia un insumo. */
function descartarNodo(paso) {
  var C = cargar();
  var antes = C.cambios.length;
  C.cambios = C.cambios.filter(function (x) { return x.paso !== paso; });
  guardar(C);
  return antes - C.cambios.length;
}

/** Borra las hojas regeneradas por un script (para re-correrlo limpio). */
function descartarNodoHoja(paso) {
  var C = cargar();
  var antes = (C.hojas || []).length;
  C.hojas = (C.hojas || []).filter(function (h) { return h.paso !== paso; });
  guardar(C);
  return antes - (C.hojas || []).length;
}

/**
 * 🔴 REGENERAR UNA HOJA ENTERA — no toda escritura es una celda.
 *
 *    Las hojas de DATOS (Data_Qcart_*, Data_Email) no se editan celda por celda: se regeneran
 *    desde el backend. El bloque puede traer MENOS filas que la hoja (una purga) o MÁS (datos
 *    nuevos), así que anexar no basta y editar celda por celda tampoco. Se declara «esta hoja
 *    queda así», con sus filas por NOMBRE de columna, y el escritor único la reconstruye en la
 *    misma apertura del zip donde aplica las celdas. Sigue siendo UNA escritura.
 *
 *    Una hoja regenerada y una celda apuntada sobre esa misma hoja **chocan**: la celda se
 *    perdería al reconstruir. El escritor lo detecta.
 *
 * @param paso   quién la regenera
 * @param hoja   nombre de la hoja
 * @param filas  array de objetos { nombreColumna: valor } — cada uno una fila de datos
 * @param porque el motivo
 * @param opts   { totales: {col: valor} } opcional: una fila de totales que va al FINAL
 */
function regenerarHoja(paso, hoja, filas, porque, opts) {
  if (!t(porque)) throw new Error('🔴 CAMBIOS · ' + paso + ' regeneró ' + hoja + ' sin motivo.');
  if (!Array.isArray(filas)) throw new Error('🔴 CAMBIOS · ' + paso + ' regeneró ' + hoja + ' sin filas (array).');
  var C = cargar();
  C.hojas = C.hojas || [];
  C.hojas = C.hojas.filter(function (h) { return h.hoja !== hoja; });   // una hoja, un regenerador
  C.hojas.push({ paso: paso, hoja: hoja, filas: filas, porque: t(porque), totales: (opts && opts.totales) || null, n: filas.length });
  guardar(C);
  return filas.length;
}

/**
 * 🔴 COLUMNAS NUEVAS. El acumulador sabía cambiar celdas y regenerar hojas, pero no CREAR una
 *    columna — y varias cosas del modelo necesitan una que no existe: `Pieza_Principal_ID` (la
 *    foránea FUP→Principal), `Subject` en el catálogo, `FUP_Quincena` en el reporte.
 *
 *    Se agregan **al FINAL de la hoja**, nunca en medio: insertar una columna desplaza todas las
 *    de su derecha, y con ellas cada referencia de fórmula que las apunte. Al final no se desplaza
 *    nada — y el orden bonito es trabajo de formato, que es de Rick, no del sistema.
 */
function apuntarColumna(paso, hoja, nombre, porque) {
  if (!t(porque)) throw new Error('🔴 CAMBIOS · ' + paso + ' pidió la columna «' + nombre + '» en ' + hoja + ' sin motivo.');
  var C = cargar();
  C.columnas_nuevas = C.columnas_nuevas || [];
  if (C.columnas_nuevas.filter(function (x) { return x.hoja === hoja && t(x.nombre) === t(nombre); }).length) return false;
  C.columnas_nuevas.push({ paso: paso, hoja: hoja, nombre: t(nombre), porque: t(porque) });
  guardar(C);
  return true;
}

/** Las columnas nuevas pedidas para una hoja (o para todas). */
function columnasNuevas(hoja) {
  var l = cargar().columnas_nuevas || [];
  return hoja ? l.filter(function (x) { return x.hoja === hoja; }) : l;
}

/** Los choques: dos scripts pidiendo la misma celda con valores distintos. */
function choques(C) {
  C = C || cargar();
  var porCelda = {};
  C.cambios.forEach(function (x) {
    var k = x.hoja + '!' + x.columna + '!' + x.fila;
    (porCelda[k] = porCelda[k] || []).push(x);
  });
  var lista = Object.keys(porCelda).filter(function (k) {
    var v = porCelda[k];
    if (v.length < 2) return false;
    // mismo valor pedido dos veces no es un choque: es redundancia inofensiva
    return v.some(function (x) { return t(x.valor) !== t(v[0].valor); });
  }).map(function (k) { return { celda: k, piden: porCelda[k] }; });
  // 🔴 una celda de DATOS (fila ≥ 2) sobre una hoja que otro paso regenera entera se perdería:
  //    eso es un choque. Una celda de la fila 1 (renombre de encabezado) NO choca: el escritor la
  //    aplica al encabezado que la regeneración conserva. Distinguirlas evita un falso choque
  //    entre A11 (renombra encabezados) y C2/B3 (regeneran filas de datos).
  var regeneradas = {}; (C.hojas || []).forEach(function (h) { regeneradas[h.hoja] = h.paso; });
  C.cambios.forEach(function (x) {
    if (regeneradas[x.hoja] && x.fila >= 2) lista.push({ celda: x.hoja + '!' + x.columna + '!' + x.fila,
      piden: [{ paso: x.paso, valor: x.valor, porque: x.porque },
        { paso: regeneradas[x.hoja], valor: '(regenera la hoja entera)', porque: 'la celda de datos se perdería al reconstruir' }] });
  });
  return lista;
}

/** Resumen para el log de un script */
function resumen() {
  var C = cargar(), porNodo = {}, porHoja = {};
  C.cambios.forEach(function (x) {
    porNodo[x.paso] = (porNodo[x.paso] || 0) + 1;
    porHoja[x.hoja] = (porHoja[x.hoja] || 0) + 1;
  });
  return { total: C.cambios.length, por_nodo: porNodo, por_hoja: porHoja, hojas: (C.hojas||[]).length, choques: choques(C).length };
}

module.exports = { abrir: abrir, apuntar: apuntar, apuntarLote: apuntarLote, apuntarFila: apuntarFila, apuntarSobre: apuntarSobre, cargar: cargar,
  vistaFutura: vistaFutura, descartarNodo: descartarNodo, descartarNodoHoja: descartarNodoHoja, regenerarHoja: regenerarHoja,
  apuntarColumna: apuntarColumna, columnasNuevas: columnasNuevas,
  guardar: guardar, choques: choques, resumen: resumen, RUTA: RUTA };
