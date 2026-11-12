/*
 * catalogo.registrar-whatsapp-name.js — mete las 3 columnas nuevas en el REGISTRO RAÍZ.
 *
 * 🔴 POR QUÉ NO BASTA CON CREAR LA COLUMNA. El registro (`_contratos/registro.json`) es el único
 *    lugar donde el id lógico y el nombre físico se tocan. Una columna que existe en la hoja pero
 *    no en el registro solo se puede leer por literal — y leer por literal es cómo `Content_ID`
 *    reportó «0 y 0» mientras escribía 60 y 60, y cómo `Pieza_ID` acusó de vacías a 98 de 98 filas
 *    llenas. `COL.de()` truena si la columna no está registrada, y esa es la protección.
 *
 * 🔴 SE ESCRIBE CON NODE, NUNCA CON POWERSHELL. `Set-Content -Encoding UTF8` mete BOM (JSON
 *    inválido) y el round-trip de `ConvertFrom-Json` doble-codifica los acentos. Después se relee
 *    del disco y se comprueba: primer byte `{` y sin `Ã`.
 */
var fs = require('fs'), os = require('os');
var RUTA = require('path').resolve(__dirname, '..') + '/_contratos/registro.json';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var NL = String.fromCharCode(10);
var HOY = new Date().toISOString().slice(0, 10);

// 🔴 Se declaran con la MISMA forma que sus gemelas de email, a propósito: mismo ámbito, mismo
//    `tipo_dato`, misma relación entre las tres. Así quien lea el registro ve que son el mismo
//    concepto en otro canal, y no dos invenciones distintas.
var NUEVAS = [
  {
    id: 'catalogo.whatsapp_name',
    nombres: ['Whatsapp' + '_Name'],
    vecinos: ['Codigos_Qcart', 'Whatsapp' + '_Names_Variantes'],
    nota: 'la llave natural de una pieza de WhatsApp — el equivalente de `Email_Name` en email. ' +
      'Creada el ' + HOY + ' a pedido de Rick: hasta entonces las 18 piezas de WhatsApp tenían ' +
      '`Email_Name = N/A` y sus journeys vivían en `Notas`, como texto libre. Los valores los ' +
      'produce `lib-whatsapp-nombre` con su regla de 3 niveles, y `nivel` dice si el nombre lo ' +
      'publica la fuente o lo construyó el sistema.'
  },
  {
    id: 'catalogo.whatsapp_names_variantes',
    nombres: ['Whatsapp' + '_Names_Variantes'],
    vecinos: ['Whatsapp' + '_Name', 'N_Whatsapp' + '_Names'],
    nota: 'los demás nombres físicos de la misma pieza. Hace falta porque `005-P011` tiene DOS ' +
      'journeys en una sola pieza (4PM y 5PM): el maestro da un único shortlink para `wa-j8` y ' +
      'los carritos de un link no se pueden repartir. Y en los niveles 2 y 3 guarda lo que dijo ' +
      'la fuente tal cual, para que el nombre construido no la sustituya.'
  },
  {
    id: 'catalogo.n_whatsapp_names',
    nombres: ['N_Whatsapp' + '_Names'],
    vecinos: ['Whatsapp' + '_Names_Variantes'],
    nota: 'cuántos nombres físicos tiene el mismo id lógico. Igual que `N_Email_Names`.'
  }
];

var R = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
console.log('════════ registro raíz · ALTA DE COLUMNAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);
console.log('  columnas registradas hoy: ' + Object.keys(R.columnas).length);

// la posición real en la hoja, para no declararla de memoria
var XLSX = (function () {
  process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
  require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
  return require('xlsx');
})();
var PROY = ENT.PROYECTO;
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_reg.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(function (x) { return String(x || '').trim(); });
fs.unlinkSync(tmp);
function letra(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }

var plan = [], ya = [], sinColumna = [];
NUEVAS.forEach(function (n) {
  if (R.columnas[n.id]) { ya.push(n.id); return; }
  var pos = enc.indexOf(n.nombres[0]);
  if (pos < 0) { sinColumna.push(n.nombres[0]); return; }
  plan.push({
    id: n.id, ambito: 'catalogo', nombres: n.nombres, alias_historicos: [],
    posicion: pos + 1, letra: letra(pos), vecinos: n.vecinos,
    tipo_dato: n.id === 'catalogo.n_whatsapp_names' ? 'numero' : 'texto',
    llenas: null, visto: HOY, nota: n.nota
  });
});

plan.forEach(function (x) { console.log('  ➕ ' + x.id.padEnd(36) + x.nombres[0].padEnd(28) + 'col ' + x.letra + ' (pos ' + x.posicion + ')'); });
ya.forEach(function (x) { console.log('  ✔ ' + x + ' ya estaba registrada'); });
sinColumna.forEach(function (x) { console.log('  🔴 «' + x + '» no existe en la hoja: primero se crea la columna'); });
if (sinColumna.length) process.exit(1);
if (!plan.length) { console.log(NL + '  ✅ nada que registrar.'); process.exit(0); }
if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

plan.forEach(function (x) { R.columnas[x.id] = x; });
R.ultimo_alta = { cuando: HOY, ids: plan.map(function (x) { return x.id; }), por: 'Rick pidió una llave propia para WhatsApp' };
fs.writeFileSync(RUTA, JSON.stringify(R, null, 1), 'utf8');

// 🔴 se relee del disco y se comprueba la codificación, que es donde PowerShell rompía el JSON
var crudo = fs.readFileSync(RUTA);
var re = JSON.parse(crudo.toString('utf8'));
var okBom = crudo[0] === 123;
var okAcentos = crudo.toString('utf8').indexOf(String.fromCharCode(195, 131)) < 0;
console.log(NL + '  ── releído del disco');
console.log('     ' + (okBom ? '✔' : '🔴') + ' primer byte «{» (sin BOM)');
console.log('     ' + (okAcentos ? '✔' : '🔴') + ' acentos sin doble-codificar');
plan.forEach(function (x) { console.log('     ' + (re.columnas[x.id] ? '✔' : '🔴') + ' ' + x.id); });
console.log('     columnas: ' + Object.keys(re.columnas).length);
if (!okBom || !okAcentos) process.exit(1);

// 🔴 y la prueba de verdad: que `lib-columna` ya las resuelva
delete require.cache[require.resolve(require('path').resolve(__dirname, '..') + '/_scripts/lib-columna.js')];
var COL = require(__dirname + '/lib-columna.js');
var tmp2 = require('path').resolve(__dirname, '..') + '/_tmp/_reg2.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp2);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(tmp2).Sheets['Catalogo_Piezas'], { defval: '' });
fs.unlinkSync(tmp2);
console.log(NL + '  ── la prueba: `lib-columna` las resuelve');
var malas = 0;
NUEVAS.forEach(function (n) {
  try { console.log('     ✔ ' + n.nombres[0].padEnd(28) + '→ «' + COL.de(P, n.nombres[0]) + '»'); }
  catch (e) { console.log('     🔴 ' + n.nombres[0] + ' · ' + String(e.message).slice(0, 70)); malas++; }
});
console.log(NL + (malas ? '  🔴 ' + malas + ' no resuelven' : '  ✅ LAS 3 REGISTRADAS Y RESUELTAS'));
process.exit(malas ? 1 : 0);
