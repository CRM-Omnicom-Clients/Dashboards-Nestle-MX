// ETAPA 3 · Deja la declaración de pre-escritura de cada skill que escribe.
//
// 🔴 QUÉ DECLARA CADA UNO, y por qué esto no se puede inferir. El grano y la llave son DECISIONES
//    del skill dueño, no propiedades del código: dos escritores pueden tocar la misma hoja con
//    granos distintos y los dos estar bien. Por eso se declaran a mano, una vez, y desde entonces
//    la guarda las exige.
//
// 🔴 CADA CAMPO TAPA UN DEFECTO QUE YA OCURRIÓ:
//      grano  → el Qcart se agrupó a un solo segmento, borró la comparación y **cuadró igual**
//      llave  → `Data_Email` se ancló a una columna que el propio escritor llena: 0 de 98 cruzaron
//      celdas → «0 celdas que cambiarían» se leyó como «ya está bien»
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var os = require('os');
var DE = require(__dirname + '/lib-declaracion-escritura.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

var DECLARACIONES = [
  { skill: 'escritor', script: 'escritor.neutralizar-muertas.js', tablas: [
    { hoja: '(todas las del libro)', grano: 'una celda por fórmula muerta detectada',
      llave: 'la referencia de celda, que ya existe en la hoja',
      celdas_esperadas: 'variable · 0 es el estado sano' } ] },

  { skill: 'nestle-catalogo', script: 'catalogo.corregir-catalogo.js', tablas: [
    { hoja: 'Catalogo_Piezas', grano: 'una fila por PIEZA del catálogo',
      llave: 'Pieza_ID — y para las altas, la IDENTIDAD DE NEGOCIO (campaña·mascota·EmailID·sends), nunca el id',
      celdas_esperadas: '~123 correcciones sobre filas existentes · 0 altas si ya están' } ] },

  { skill: 'escritor', script: 'escritor.escribir.js', tablas: [
    { hoja: 'Data_Email', grano: 'una fila por ENVÍO de email',
      llave: 'Pieza_ID — nunca Email_Name: es una columna que este mismo escritor llena',
      celdas_esperadas: '98 filas × las columnas del contrato' },
    { hoja: 'Data_WhatsApp', grano: 'una fila por ENVÍO de WhatsApp', llave: 'Pieza_ID', celdas_esperadas: '12 filas' },
    { hoja: 'Data_Qcart_Carritos', grano: 'una fila por EVENTO de carrito', llave: 'shortlink + Pieza_ID', celdas_esperadas: '~2,645 filas' },
    { hoja: 'Data_Qcart_Productos', grano: 'una fila por PRODUCTO matcheado', llave: 'shortlink + Pieza_ID', celdas_esperadas: '~696 filas' } ] },

  { skill: 'escritor', script: 'escritor.formato.js', tablas: [
    { hoja: '(la que reciba por --hoja)', grano: 'una columna por ancho declarado',
      llave: 'la posición de la columna en la hoja',
      celdas_esperadas: '0 celdas de dato — solo `cols`, `sheetViews` y `sheetFormatPr`' } ] },

  { skill: 'resumen', script: 'resumen.regenerar.js', tablas: [
    { hoja: 'Report_Resumen', grano: 'una fila por CAMPAÑA × TOUCHPOINT × SEGMENTO × QUINCENA — el Qcart va por touchpoint × segmento, la quincena es solo el ancla temporal',
      llave: 'la llave compuesta de lib-valores-resumen.llaveDeFila() — nunca escrita a mano en el script',
      celdas_esperadas: '~76 filas de datos + 1 de totales AL FINAL, con sus SUM cacheados' } ] },

  { skill: 'nestle-insights', script: 'insights.insights.js', tablas: [
    { hoja: 'Report_Resumen', grano: 'una celda por FILA del reporte — solo la columna Insights',
      llave: 'la misma llave de fila del resumen; la columna se pide por nombre al catálogo raíz',
      celdas_esperadas: '~76 celdas, una por fila de datos' } ] },

  { skill: 'escritor', script: 'escritor.aplicar-vacios.js', tablas: [
    { hoja: '(todas las tocables — Reporte_julio queda fuera por declaración de Rick)',
      grano: 'una celda por hueco, clasificada por el skill dueño de esa columna',
      llave: 'la referencia de celda que la medición dejó en decisiones.json — se comprueba que SIGA vacía antes de escribir',
      celdas_esperadas: 'lo que diga _preescritura/decisiones.json · ~9,256 en el último corte' } ] }
];

console.log('════════ ETAPA 3 · DECLARACIONES DE PRE-ESCRITURA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
DECLARACIONES.forEach(function (d) {
  console.log('  ' + d.skill.padEnd(18) + d.script);
  d.tablas.forEach(function (t) {
    console.log('     → ' + String(t.hoja).padEnd(34) + t.grano.slice(0, 72));
  });
});
console.log('\n  declaraciones: ' + DECLARACIONES.length + '   ·   tablas: ' +
  DECLARACIONES.reduce(function (a, d) { return a + d.tablas.length; }, 0));

if (!ESCRIBIR) { console.log('\n  (seco. Para dejarlas: --escribir)'); process.exit(0); }

var n = 0;
DECLARACIONES.forEach(function (d) { DE.declarar(d.skill, d.script, d.tablas); n++; });
console.log('\n  ✔ dejadas en _preescritura/DECL-*.json: ' + n);

// ── VERIFICACIÓN DE SISTEMA
console.log('\n  ══ VERIFICACIÓN DE SISTEMA ══');
var faltan = DE.sinDeclarar(DECLARACIONES.map(function (d) { return d.script; }));
console.log('   ' + (faltan.length ? '🔴' : '✔') + ' cada escritor tiene su declaración en disco' + (faltan.length ? ': ' + faltan.join(' · ') : ''));

// que ninguna declaración esté incompleta — se relee del disco, no del objeto en memoria
var incompletas = [];
DECLARACIONES.forEach(function (d) {
  var leida = DE.declaracionDe(d.script);
  if (!leida) { incompletas.push(d.script + ' (no se pudo releer)'); return; }
  leida.tablas.forEach(function (t, i) {
    DE.CAMPOS.forEach(function (c) { if (!t[c]) incompletas.push(d.script + ' tabla ' + (i + 1) + ': falta ' + c); });
  });
});
console.log('   ' + (incompletas.length ? '🔴' : '✔') + ' releídas del disco, ninguna incompleta' +
  (incompletas.length ? ': ' + incompletas.slice(0, 4).join(' · ') : ' — los 4 campos en las ' +
    DECLARACIONES.reduce(function (a, d) { return a + d.tablas.length; }, 0) + ' tablas'));

// 🔴 la librería tiene que NEGARSE a declarar sin los cuatro campos — si no, la regla es papel
var truena = false;
try { DE.declarar('prueba', 'prueba-sin-grano.js', [{ hoja: 'X', llave: 'Y', celdas_esperadas: 1 }]); }
catch (e) { truena = /no declara: grano/.test(e.message); }
console.log('   ' + (truena ? '✔' : '🔴') + ' la librería se NIEGA a declarar sin los cuatro campos');
process.exit(faltan.length || incompletas.length || !truena ? 1 : 0);
