// A8 · UNA SOLA COLUMNA DE NOMBRE.
//
// 🔴 EL DEFECTO: `Catalogo_Piezas` tiene DOS columnas con el mismo hecho —`Content_Name` (99 con
//    dato) y `EmailName` (94)— y **no coinciden en 16 filas**. En 4 están literalmente cruzadas.
//    Mientras las dos existan, el renombre que pidió Rick (`Content_Name` → `Email_Name`) no se
//    puede hacer: habría dos columnas llamadas igual, que es exactamente el defecto que dio origen
//    al registro de nombres (`Content_ID` vs `Content_ID (SFMC)` reportando «0 y 0»).
//
// 🔴 CÓMO SE ELIGE EL GANADOR, y esto es lo importante: **no se elige entre columnas, decide la
//    fuente**. Si la pieza tiene `EmailID`, su nombre es el que SFMC declara para ese id — punto.
//    Escoger «la columna que suele tener razón» es estadística; preguntarle a la DE es un dato.
//    Solo cuando no hay EmailID (WhatsApp, piezas sin correo) se cae a lo que haya, declarado.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ A8 · UNA SOLA COLUMNA DE NOMBRE ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('A8');

var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var porEid = {};
D.rows.forEach(function (r) { porEid[t(r.Email_ID)] = t(r.Email_Content_Name); });
console.log('  SFMC declara ' + Object.keys(porEid).length + ' nombres por Email_ID\n');

var F0 = os.homedir() + '/_a8.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);
var crudo = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
// 🔴 se lee el estado FUTURO: A2 y A3 ya apuntaron cambios que este paso tiene que ver
var P = CB.vistaFutura('Catalogo_Piezas', crudo);

var st = { sfmc: 0, solo_cn: 0, solo_en: 0, iguales: 0, vacia: 0, wa: 0 };
var corrige = [], discrepan = [], cambios = [];

P.forEach(function (p, i) {
  var fila = i + 2, id = t(p['Pieza_ID']), canal = t(p['Canal']);
  var cn = t(p['Content_Name']), en = t(p['EmailName']), eid = t(p['EmailID']);
  var ganador = '', via = '';

  // 🔴 WhatsApp NO toma nombre de `EmailName`. Esa columna, en las filas de WA, **no guarda un
  //    nombre de correo**: guarda códigos y utms (`sbH9gVge, Agy5v9Yb` · `wa-cooking1, wa-bebida1`).
  //    Es un tercer hecho escondido en la columna. Copiarlo a Content_Name metería basura justo
  //    donde la regla dice que va vacío — WhatsApp no es un correo, no tiene EmailName.
  var esWA = /whats|^wa$/i.test(canal);

  if (eid && porEid[eid]) { ganador = porEid[eid]; via = 'SFMC(' + eid + ')'; st.sfmc++; }
  else if (esWA) { st.wa++; }
  else if (cn && en && cn === en) { ganador = cn; via = 'las dos coinciden'; st.iguales++; }
  else if (cn && !en) { ganador = cn; via = 'solo Content_Name'; st.solo_cn++; }
  else if (en && !cn) { ganador = en; via = 'solo EmailName'; st.solo_en++; }
  else if (cn && en) { ganador = cn; via = '⚠ difieren y no hay EmailID → gana Content_Name'; }
  else { st.vacia++; }

  if (cn && en && cn !== en) {
    discrepan.push({ fila: fila, pieza_id: id, canal: canal, content_name: cn, email_name: en,
      email_id: eid, gana: ganador, via: via });
  }
  if (ganador && ganador !== cn) {
    corrige.push({ fila: fila, id: id, antes: cn || '(vacía)', ahora: ganador, via: via });
    cambios.push({ fila: fila, valor: ganador, via: via });
  }
});

console.log('  de dónde salió el nombre de cada pieza:');
console.log('     ' + String(st.sfmc).padStart(4) + '  lo declara SFMC por su Email_ID   ← la fuente');
console.log('     ' + String(st.iguales).padStart(4) + '  las dos columnas ya coincidían');
console.log('     ' + String(st.solo_cn).padStart(4) + '  solo estaba en Content_Name');
console.log('     ' + String(st.solo_en).padStart(4) + '  solo estaba en EmailName');
console.log('     ' + String(st.wa).padStart(4) + '  WhatsApp → se deja VACÍO a propósito (no es un correo)');
console.log('     ' + String(st.vacia).padStart(4) + '  sin nombre por ningún lado');

// las que hay que corregir en Content_Name
console.log('\n  ── celdas que cambian en Content_Name: ' + corrige.length);
corrige.slice(0, 12).forEach(function (c) {
  console.log('     f' + String(c.fila).padEnd(5) + t(c.id).padEnd(10) + c.via.padEnd(18) +
    '…' + String(c.antes).slice(-30) + '  →  …' + String(c.ahora).slice(-30));
});
if (corrige.length > 12) console.log('     … y ' + (corrige.length - 12) + ' más');

// las discrepancias, para que queden documentadas
console.log('\n  ── discrepancias Content_Name ≠ EmailName: ' + discrepan.length);
var porQuien = {};
discrepan.forEach(function (d) { var k = /SFMC/.test(t(d.via)) ? 'las resolvió SFMC' : 'sin EmailID que las resuelva'; porQuien[k] = (porQuien[k] || 0) + 1; });
Object.keys(porQuien).forEach(function (k) { console.log('     ' + String(porQuien[k]).padStart(4) + '  ' + k); });
var ganoEN = discrepan.filter(function (d) { return t(d.gana) === t(d.email_name); }).length;
console.log('     de ellas, el valor bueno estaba en EmailName y NO en Content_Name: ' + ganoEN);

fs.writeFileSync(BACK + '/_catalogo/nombres-discrepantes.json', JSON.stringify({
  paso: 'A8', cuando: '2026-08-21',
  que_es: 'Catalogo_Piezas tenía dos columnas con el mismo hecho. Aquí queda cada fila donde no coincidían y quién ganó.',
  regla: 'si la pieza tiene EmailID, manda el nombre que SFMC declara para ese id; si no, se declara de dónde salió',
  discrepancias: discrepan
}, null, 1));
console.log('\n  → _catalogo/nombres-discrepantes.json  (' + discrepan.length + ' filas)');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
cambios.forEach(function (c) {
  CB.apuntar('A8', 'Catalogo_Piezas', c.fila, 'Content_Name', c.valor,
    'A8 · el nombre lo declara ' + c.via + '. Catalogo_Piezas tenía Content_Name y EmailName con el mismo hecho y sin coincidir; se unifican en una sola columna, que A11 renombra a Email_Name.');
});
var res = CB.resumen();
console.log('\n  ── apuntados ' + cambios.length + ' cambio(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
