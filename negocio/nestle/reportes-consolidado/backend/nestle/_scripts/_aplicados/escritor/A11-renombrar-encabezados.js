// A11 · RENOMBRAR LOS ENCABEZADOS — y que el registro lo absorba sin que nada se rompa.
//
// 🔴 ESTO ES EL REGISTRO DE NOMBRES HACIENDO SU TRABAJO. La idea de Rick: el **id lógico es
//    inmutable**, el **nombre físico cambia**, y la librería es el único lugar donde se tocan.
//    Aquí se prueba de verdad: 9 encabezados cambian de nombre y **ningún script cambia**, porque
//    todos direccionan por id. Lo único que se actualiza es `registro.json`, donde el nombre viejo
//    pasa a `alias_historicos` — así el archivo resuelve igual ANTES y DESPUÉS de la escritura.
//
// 🔴 LO QUE **NO** SE TOCA, y son tres cosas distintas:
//    · `utm_content` (WhatsApp y las dos de Qcart) — es un parámetro de UTM, no un nombre de pieza.
//      Mi primer barrido lo marcó por contener «content»: falso positivo.
//    · `Reporte_julio` — Rick fue explícito: ni una celda.
//    · Los ámbitos `de_*` — son las Data Extensions del cliente en SFMC. Solo lectura, siempre.
//
// 🔴 Y `Content_ID` ≠ `Email_ID`. Rick: «Content ID es el final del Email Name, la colita; Email ID
//    es un número nuevo que viene en la DE». Las dos se conservan, y el encabezado lo dice.
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

// hoja · id lógico · nombre viejo · nombre nuevo · por qué
var MAPA = [
  ['Catalogo_Piezas', 'catalogo.content_name', 'Content_Name', 'Email_Name',
    'content name = email name (Rick, 21-ago)'],
  ['Catalogo_Piezas', 'catalogo.content_names_variantes', 'Content_Names_Variantes', 'Email_Names_Variantes',
    'sigue al nombre principal'],
  ['Catalogo_Piezas', 'catalogo.n_content_names', 'N_Content_Names', 'N_Email_Names',
    'sigue al nombre principal'],
  ['Catalogo_Piezas', 'catalogo.content_id', 'Content_ID', 'Content_ID (final del Email_Name)',
    'la nota que pidió Rick, para que no se confunda con Email_ID'],
  ['Catalogo_Piezas', 'catalogo.emailid', 'EmailID', 'Email_ID (de la DE de SFMC)',
    'la nota que pidió Rick — es otro dato, no la colita'],
  ['Catalogo_Piezas', 'catalogo.emailname', 'EmailName', 'Email_Name_Legacy (duplicada, no usar)',
    'era una SEGUNDA columna con el mismo hecho, y no coincidía en 16 filas (A8). Se conserva como evidencia; el nombre avisa que no se use'],
  ['Report_Resumen', 'resumen.content_id_sfmc', 'Content_ID (SFMC)', 'Content_ID (final del Email_Name)',
    'mismo criterio que el catálogo'],
  ['Report_Resumen', 'resumen.email_id_sfmc', 'Email_ID (SFMC)', 'Email_ID (de la DE de SFMC)',
    'mismo criterio que el catálogo'],
  ['Data_Email', 'data_email.email_content_name', 'Email_Content_Name', 'Email_Name',
    'content name = email name; «Email_Email_Name» habría sido el resultado de un reemplazo ciego']
];

console.log('════════ A11 · RENOMBRAR ENCABEZADOS ' + (ESCRIBIR ? '(apunta + registro)' : '(seco)') + ' ════════\n');
CB.descartarNodo('A11');

var F0 = os.homedir() + '/_a11.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);
var REG = JSON.parse(fs.readFileSync(BACK + '/_contratos/registro.json', 'utf8'));

var problemas = [], listos = [];
MAPA.forEach(function (m) {
  var hoja = m[0], id = m[1], viejo = m[2], nuevo = m[3], porque = m[4];
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 })[0] || [];
  var i = enc.map(t).indexOf(viejo);
  if (i < 0) { problemas.push(hoja + ' no tiene «' + viejo + '»'); return; }
  var choque = enc.map(t).indexOf(nuevo);
  if (choque >= 0 && choque !== i) { problemas.push(hoja + ' YA tiene una columna «' + nuevo + '» (col ' + XLSX.utils.encode_col(choque) + ') — renombrar crearía dos iguales'); return; }
  if (!REG.columnas[id]) { problemas.push('el registro no conoce el id «' + id + '»'); return; }
  var reg = REG.columnas[id];
  if (reg.nombres.map(t).indexOf(viejo) < 0) { problemas.push('el registro dice que «' + id + '» se llama ' + JSON.stringify(reg.nombres) + ', no «' + viejo + '»'); return; }
  listos.push({ hoja: hoja, id: id, viejo: viejo, nuevo: nuevo, porque: porque, letra: XLSX.utils.encode_col(i) });
});

listos.forEach(function (r) {
  console.log('   ' + r.hoja.padEnd(18) + r.letra.padEnd(4) + r.viejo.padEnd(26) + '→  ' + r.nuevo);
  console.log('        id lógico ' + r.id.padEnd(34) + '(no cambia)   ' + r.porque);
});
console.log('\n   ' + listos.length + ' de ' + MAPA.length + ' listos');
if (problemas.length) {
  console.log('\n  🔴 no se puede renombrar:');
  problemas.forEach(function (p) { console.log('     · ' + p); });
  process.exit(1);
}

// ── lo que NO se toca, dicho en voz alta
console.log('\n  ── intactos a propósito:');
['Data_WhatsApp', 'Data_Qcart_Carritos', 'Data_Qcart_Productos'].forEach(function (h) {
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || [];
  if (enc.map(t).indexOf('utm_content') >= 0) console.log('     ' + h.padEnd(24) + 'utm_content — es un UTM, no un nombre de pieza');
});
console.log('     Reporte_julio           entera — Rick fue explícito');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }

// 1 · el encabezado, como una celda más de la fila 1
listos.forEach(function (r) {
  CB.apuntar('A11', r.hoja, 1, r.viejo, r.nuevo,
    'A11 · renombre de encabezado: ' + r.porque + '. El id lógico «' + r.id + '» NO cambia; el nombre viejo queda como alias histórico en registro.json, así los scripts resuelven igual antes y después.');
});

// 2 · el registro aprende el nombre nuevo ANTES de que el archivo cambie.
//     Con el viejo en `alias_historicos`, resuelve en los dos estados: durante la transición
//     ninguna corrida queda ciega.
listos.forEach(function (r) {
  var c = REG.columnas[r.id];
  c.alias_historicos = (c.alias_historicos || []).concat(c.nombres.filter(function (n) { return t(n) !== r.nuevo; }));
  c.nombres = [r.nuevo];
  c.renombrada = { cuando: '2026-08-21', de: r.viejo, a: r.nuevo, por: 'A11 · ' + r.porque };
});
REG.ultimo_renombre = { paso: 'A11', cuando: '2026-08-21', columnas: listos.length };
fs.writeFileSync(BACK + '/_contratos/registro.json', JSON.stringify(REG, null, 1));
console.log('\n  ✔ registro.json actualizado: ' + listos.length + ' columnas, id intacto, nombre viejo como alias');

var res = CB.resumen();
console.log('\n  ── apuntados ' + listos.length + ' cambio(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
