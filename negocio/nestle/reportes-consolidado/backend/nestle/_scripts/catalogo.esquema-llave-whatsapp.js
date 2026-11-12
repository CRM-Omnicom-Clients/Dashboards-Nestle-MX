/*
 * catalogo.esquema-llave-whatsapp.js — declara en el ESQUEMA que WhatsApp ya tiene llave natural.
 *
 * 🔴 EL ESQUEMA DECÍA DOS COSAS QUE HOY SON FALSAS, y un contrato que miente es peor que ninguno
 *    porque los pasos lo obedecen:
 *      · `pieza.llave_natural = "Email_Name"` — cierto para email, pero deja a las 18 piezas de
 *        WhatsApp sin llave natural declarada. Por eso nadie podía exigirles un nombre.
 *      · `envio_whatsapp.que_es` decía literalmente «No tiene Email_Name ni Subject → N/A». Era
 *        una descripción del hueco, escrita cuando el hueco no tenía remedio; leída hoy autoriza
 *        justo lo que Rick vino a cerrar.
 *
 * 🔴 LA LLAVE NATURAL PASA A SER POR CANAL, no una sola. Es lo que ya era en la práctica: la
 *    identidad de una pieza es el nombre con el que su fuente la publica, y las fuentes son dos.
 *    Declararla así es lo que permite que la guarda de unicidad exija un nombre a las 129 piezas
 *    sin tener que inventarle un `Email_Name` a WhatsApp.
 *
 * 🔴 Y NO SE BORRA LA FRASE VIEJA: se MUEVE a `historia`. Lo que un contrato dijo y por qué dejó
 *    de decirlo es parte del contrato — borrarlo deja al siguiente sin saber si el cambio fue una
 *    decisión o un descuido.
 */
var fs = require('fs'), os = require('os');
var RUTA = require('path').resolve(__dirname, '..') + '/_contratos/esquema.json';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var NL = String.fromCharCode(10);
var HOY = '2026-09-15';

var E = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
console.log('════════ esquema · LA LLAVE NATURAL DE WHATSAPP ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);

var cambios = [];
var pieza = E.entidades && E.entidades.pieza;
var wa = E.entidades && E.entidades.envio_whatsapp;
if (!pieza || !wa) { console.log('  🔴 el esquema no tiene las entidades esperadas'); process.exit(1); }

console.log('  ANTES');
console.log('     pieza.llave_natural      : ' + JSON.stringify(pieza.llave_natural));
console.log('     envio_whatsapp.que_es    : ' + String(wa.que_es).slice(0, 96));

var LLAVE_NUEVA = { Email: 'Email' + '_Name', WhatsApp: 'Whatsapp' + '_Name' };
var NOTA = 'La identidad de una pieza es el nombre con el que SU FUENTE la publica, y las fuentes son dos. ' +
  'Email: `Email_Name`, probado único (107 piezas con nombre, 107 nombres distintos). ' +
  'WhatsApp: `Whatsapp_Name`, creado el ' + HOY + ' — 18 piezas, 24 nombres distintos contando variantes, ninguno repetido. ' +
  'Una pieza puede tener VARIOS nombres físicos para el mismo id lógico (`*_Names_Variantes`): pasa cuando ' +
  'operación reusa un asset (005-P010 y 005-P012 en email) o cuando dos journeys comparten un shortlink y ' +
  'por tanto no se pueden separar (005-P011 en WhatsApp). El id lógico es inmutable; el nombre físico cambia.';

console.log(NL + '  DESPUÉS');
console.log('     pieza.llave_natural      : ' + JSON.stringify(LLAVE_NUEVA));
var QUE_ES_WA = 'Las métricas de un envío de WhatsApp. Su llave natural es `Whatsapp_Name` (desde el ' + HOY + '). ' +
  'No tiene Subject: la fuente no lo entrega → `N/A`.';
console.log('     envio_whatsapp.que_es    : ' + QUE_ES_WA.slice(0, 96));
cambios.push('pieza.llave_natural', 'envio_whatsapp.que_es');

if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

pieza.historia = (pieza.historia || []).concat([{
  cuando: HOY, campo: 'llave_natural', decia: pieza.llave_natural,
  por: 'Rick pidió una llave propia para WhatsApp: «de WA deberíamos tener una especie de Whatsapp Name». ' +
    'Con una sola llave natural, las 18 piezas de WhatsApp quedaban fuera de toda exigencia de identidad.'
}]);
pieza.llave_natural = LLAVE_NUEVA;
pieza.nota_llave_natural = NOTA;

wa.historia = (wa.historia || []).concat([{
  cuando: HOY, campo: 'que_es', decia: wa.que_es,
  por: 'la frase describía un hueco que ya se cerró; leída hoy autorizaba dejar WhatsApp sin nombre.'
}]);
wa.que_es = QUE_ES_WA;
wa.llave_natural = LLAVE_NUEVA.WhatsApp;

E.ultimo_cambio = { cuando: HOY, campos: cambios, por: 'llave natural por canal' };
fs.writeFileSync(RUTA, JSON.stringify(E, null, 1), 'utf8');

var crudo = fs.readFileSync(RUTA);
var re = JSON.parse(crudo.toString('utf8'));
console.log(NL + '  ── releído del disco');
console.log('     ' + (crudo[0] === 123 ? '✔' : '🔴') + ' primer byte «{» (sin BOM)');
console.log('     ' + (crudo.toString('utf8').indexOf(String.fromCharCode(195, 131)) < 0 ? '✔' : '🔴') + ' acentos sin doble-codificar');
console.log('     ' + (JSON.stringify(re.entidades.pieza.llave_natural) === JSON.stringify(LLAVE_NUEVA) ? '✔' : '🔴') + ' pieza.llave_natural');
console.log('     ' + (re.entidades.envio_whatsapp.llave_natural === LLAVE_NUEVA.WhatsApp ? '✔' : '🔴') + ' envio_whatsapp.llave_natural');
console.log('     ' + (re.entidades.pieza.historia.length ? '✔' : '🔴') + ' la frase vieja quedó en historia');

// 🔴 y que `lib-esquema` siga cargando: un JSON válido que la librería no entiende es igual de inútil
delete require.cache[require.resolve(require('path').resolve(__dirname, '..') + '/_scripts/lib-esquema.js')];
var EQ = require(__dirname + '/lib-esquema.js');
try {
  var n = EQ.hojas().length;
  console.log('     ✔ lib-esquema sigue cargando (' + n + ' hojas declaradas)');
} catch (e) { console.log('     🔴 lib-esquema ya no carga: ' + e.message); process.exit(1); }
console.log(NL + '  ✅ ESQUEMA ACTUALIZADO');
