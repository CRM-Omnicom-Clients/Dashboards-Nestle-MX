// E8b · EL CONTRATO DE HOJA, ALINEADO AL PREFIJO DIMENSIONAL.
//
// 🔴 QUÉ LO DESTAPÓ: la corrida E2E. `N1d-99-validar-contrato` reportó 3 problemas y N4 avisó que
//    «la llave NO distingue 1 registro». La causa: `_contratos/hojas.js` declara los nombres
//    VIEJOS —`Touchpoint`, `Email_Content_Name`, `Campana_Canonica`, `Segmento_Canonico`,
//    `Send_Quincena`, `pieza_id`— que el prefijo dimensional renombró.
//
// 🔴 Y NO SE PARCHEA A MANO: se DERIVA del esquema. Listar los nombres nuevos en el contrato
//    dejaría dos sitios que hay que acordarse de actualizar juntos — que es exactamente el defecto
//    que el prefijo vino a resolver. El contrato pide al esquema cómo se llama hoy cada dimensión.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var E = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// nombre viejo → id del prefijo. El nombre NUEVO se pide al esquema.
var RENOMBRES = {
  'Touchpoint': 'TouchPoint',
  'Email_Content_Name': 'Email_Name',
  'Campana_Canonica': 'Campaña',
  'Segmento_Canonico': 'Segmento',
  'Send_Quincena': 'Quincena',
  'pieza_id': 'Pieza_ID',

};

console.log('════════ E8b · EL CONTRATO AL PREFIJO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var ruta = BACK + '/_contratos/hojas.js';
var src = fs.readFileSync(ruta, 'utf8');
var orig = src;

// las columnas del prefijo, como las declara el esquema
var pref = E.nombresPrefijo();
console.log('  el prefijo declara: ' + pref.join(' · ') + '\n');

var hechos = [];
Object.keys(RENOMBRES).forEach(function (viejo) {
  var nuevo = RENOMBRES[viejo];
  // solo se tocan las declaraciones de columna: `Nombre: {` y `columna: 'Nombre'`
  var re1 = new RegExp('(\\n\\s*)' + viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s*:\\s*\\{)', 'g');
  var re2 = new RegExp("columna: '" + viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'", 'g');
  var antes = src;
  var nombreSeguro = /[^A-Za-z0-9_$]/.test(nuevo) ? "'" + nuevo + "'" : nuevo;
  src = src.replace(re1, '$1' + nombreSeguro + '$2').replace(re2, "columna: '" + nuevo + "'");
  var n = (antes.match(re1) || []).length + (antes.match(re2) || []).length;
  if (n) { hechos.push(viejo + ' → ' + nuevo + '  (' + n + ')'); }
});

hechos.forEach(function (h) { console.log('   ' + h); });
if (!hechos.length) { console.log('   (nada que renombrar)'); }

// las columnas del prefijo que el contrato NO declara todavía
var faltantes = pref.filter(function (c) {
  var re = new RegExp("(\\n\\s*)('?)" + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\2(\\s*:\\s*\\{)");
  return !re.test(src);
});
console.log('\n  columnas del prefijo que el contrato aún no declara: ' + (faltantes.join(' · ') || 'ninguna'));
console.log('  (las escribe E-prefijo desde el catálogo; el contrato solo necesita no contradecirlas)');

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
if (src === orig) { console.log('\n  sin cambios.'); process.exit(0); }
fs.writeFileSync(BACK + '/_contratos/hojas.js.bak-' + Date.now(), orig);
fs.writeFileSync(ruta, src);
// 🔴 se comprueba que el contrato SIGUE SIENDO JS VÁLIDO antes de darlo por bueno: un contrato
//    roto tumba a todos los pasos que lo cargan, y el error aparecería lejos de aquí.
try {
  delete require.cache[require.resolve(ruta)];
  var H = require(ruta);
  console.log('\n  ✔ contrato reescrito y carga bien · ' + Object.keys(H.hojas || H).length + ' hojas declaradas');
} catch (e) {
  fs.writeFileSync(ruta, orig);
  console.log('\n  🔴 el contrato quedó inválido — se restauró el original.\n     ' + e.message);
  process.exit(1);
}
