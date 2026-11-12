/*
 * escritor.desempatar-envio-wa.js — le devuelve su identidad a una fila de Data_WhatsApp que quedó
 * como copia de su hermana.
 *
 * 🔴 QUÉ PASÓ, MEDIDO. La llave de escritura de `Data_WhatsApp` es
 *    `pieza_id + campana_raw + **sends**`. Lleva una MÉTRICA, y eso ya está prohibido en este
 *    sistema por el caso de las gemelas de Pro Plan: «un número que cambia con cada refresh no
 *    identifica nada». Aquí mordió por el otro lado — un número que es IGUAL en dos filas tampoco
 *    las distingue. La Jornada 10 de WhatsApp tiene tres envíos y **dos de ellos mandaron
 *    exactamente 1,085**, así que el escritor emparejó las dos filas de la hoja con el MISMO
 *    registro del bloque: `SAB-2PM` (343 leídos, 912 entregados) desapareció de la hoja y en su
 *    lugar quedó una segunda copia de `SAB-12PM` (439, 860).
 *
 * 🔴 EL REPORTE NUNCA ESTUVO MAL. Sale de la rejilla, que sale del bloque, y el bloque sí tiene los
 *    tres envíos: 2,798 envíos y 1,054 leídos, idénticos al TOTAL de la hoja de Leslie. Lo que
 *    quedó mal es la hoja CRUDA — y no lo ve ninguna puerta, porque la 1 cruza bloques contra
 *    catálogo y la 2 reporte contra rejilla: **nadie compara hoja contra bloque**.
 *
 * 🔴 POR QUÉ ESTO EXISTE Y NO BASTA CON ARREGLAR LA LLAVE. Las dos filas de la hoja quedaron
 *    IDÉNTICAS en todas sus columnas, así que ninguna llave puede desempatarlas: no hay nada que
 *    las distinga. Hay que decirle a una cuál envío es. Después de eso, la llave nueva
 *    —`whatsapp_name`, que el propio contrato ya documenta como único por envío— mantiene el
 *    emparejamiento bien y el escritor corrige solo las métricas.
 *
 * 🔴 NO ESCRIBE: APUNTA. Registra la celda en `_contratos/cambios-pendientes.json` con su motivo y
 *    la aplica `escritor.escribir-todo.js`, que es el único con permiso de tocar el libro. Así el
 *    cambio pasa por un respaldo, la cadena de validación y una sola publicación.
 *
 *   node escritor.desempatar-envio-wa.js            (seco)
 *   node escritor.desempatar-envio-wa.js --apuntar
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'whatsapp';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var LIBRO = ENT.LIBRO;
var CB = require(BACK + '/_scripts/lib-cambios.js');
var APUNTAR = process.argv.indexOf('--apuntar') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var PASO = 'escritor.desempatar-envio-wa';

console.log('════ DESEMPATAR UN ENVÍO DE WHATSAPP ' + (APUNTAR ? '🔴 APUNTA' : '(seco)') + ' ════\n');

var tmp = BACK + '/_tmp/_desempatar.xlsx';
fs.copyFileSync(LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var sh = wb.Sheets['Data_WhatsApp'];
var filas = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
fs.unlinkSync(tmp);

var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8')).envios || [];

// ── 1 · qué envíos del bloque NO tienen su fila, y qué filas están repetidas
var C_NOM = COL.de(filas, 'Whatsapp' + '_Name', 'whatsapp'), C_PZ = COL.de(filas, 'Pieza' + '_ID', 'whatsapp'), C_SEND = COL.de(filas, 'Sends', 'whatsapp');
var C_READ = COL.de(filas, 'Opens' + '_Read', 'whatsapp'), C_DEL = COL.de(filas, 'Deliveries', 'whatsapp');

var enHoja = {};
filas.forEach(function (f, i) {
  var n = t(f[C_NOM]); if (!n) return;
  (enHoja[n] = enHoja[n] || []).push({ i: i, fila: i + 2, f: f });
});
var faltan = B.filter(function (e) { return !enHoja[t(e.whatsapp_name)]; });
var repes = Object.keys(enHoja).filter(function (n) { return enHoja[n].length > 1; });

console.log('  hoja ' + filas.length + ' filas · bloque ' + B.length + ' envíos');
console.log('  envíos del bloque SIN fila con su nombre: ' + faltan.length +
  (faltan.length ? '  → ' + faltan.map(function (e) { return t(e.pieza_id) + ' ' + t(e.whatsapp_name).slice(-22); }).join(' · ') : ''));
console.log('  nombres REPETIDOS en la hoja: ' + repes.length +
  (repes.length ? '  → ' + repes.map(function (n) { return n.slice(-22) + ' ×' + enHoja[n].length; }).join(' · ') : ''));

if (!faltan.length && !repes.length) { console.log('\n  ✅ nada que desempatar: cada envío tiene su fila.'); process.exit(0); }

// 🔴 SOLO SE ACTÚA EN EL CASO EXACTO: un envío sin fila y un nombre repetido las mismas veces. Si el
//    desajuste es otro, esto NO adivina — se declara y para. Un desempate a ojo pondría el nombre
//    de un envío sobre las métricas de otro, que es peor que la copia que ya hay.
if (faltan.length !== 1 || repes.length !== 1 || enHoja[repes[0]].length !== 2) {
  console.log('\n  🔴 NO ES EL CASO QUE ESTO SABE RESOLVER (1 envío sin fila · 1 nombre repetido 2 veces).');
  console.log('     Se declara y no se toca nada: desempatar a ojo pondría el nombre de un envío');
  console.log('     sobre las métricas de otro.');
  process.exit(1);
}

var huerfano = faltan[0];
var par = enHoja[repes[0]];
// de las dos copias, se corrige la que NO coincide con el registro que sí tiene dueño
var dueno = B.filter(function (e) { return t(e.whatsapp_name) === repes[0]; })[0];
if (!dueno) { console.log('\n  🔴 el nombre repetido no existe en el bloque — no sé cuál conservar.'); process.exit(1); }

// 🔴 las dos copias son idénticas, así que da igual CUÁL se corrige: lo que no da igual es que la
//    corregida quede con el nombre Y las métricas del huérfano, las tres juntas.
var victima = par[1];
console.log('\n  ── el caso');
console.log('     envío sin fila : ' + t(huerfano.whatsapp_name).slice(-26) + '   sends ' + huerfano.sends + ' · read ' + huerfano.opens_read + ' · deliv ' + huerfano.deliveries);
console.log('     fila repetida  : Data_WhatsApp!' + victima.fila + '   sends ' + victima.f[C_SEND] + ' · read ' + victima.f[C_READ] + ' · deliv ' + victima.f[C_DEL]);
console.log('     se le devuelve su identidad a esa fila; las métricas las corrige el escritor con');
console.log('     la llave nueva (whatsapp_name), que el contrato ya documenta como única por envío.');

if (!APUNTAR) { console.log('\n  (seco. Para apuntar el cambio: --apuntar)'); process.exit(0); }

var porque = 'La llave de escritura de Data_WhatsApp era pieza_id+campana_raw+SENDS, y los dos envíos SAB de WA-J10 mandaron 1,085 cada uno: el escritor emparejó las dos filas con el mismo registro y esta quedó como copia de su hermana, perdiendo ' + t(huerfano.whatsapp_name).slice(-18) + ' (read ' + huerfano.opens_read + ', deliv ' + huerfano.deliveries + '). Se le devuelve el nombre para que la llave nueva (whatsapp_name) pueda emparejarla bien. El reporte nunca estuvo mal: sale del bloque, que sí tiene los tres envíos.';
CB.apuntar(PASO, 'Data_WhatsApp', victima.fila, C_NOM, t(huerfano.whatsapp_name), porque);
console.log('\n  ✔ apuntado: Data_WhatsApp!' + C_NOM + victima.fila + ' → ' + t(huerfano.whatsapp_name).slice(-26));
console.log('  → lo aplica  node escritor.escribir-todo.js --escribir');
