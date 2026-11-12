// A9 · LIGA MX: retirar el duplicado, DECLARAR las programadas.
//
// 🔴 QUÉ SE MIDIÓ, y por qué la conclusión cambió dos veces:
//    · `005-P001` (E-P1) y `005-P005/P006` (E-J4 con/sin región) son **el mismo envío**: SFMC dice
//      que los eids 84969/84970 salieron el **15-ago**, y la autoridad de links fecha `e-p1` el
//      **15-ago**. Además la audiencia de la DE se llama `E-J4 Liga MX CON/SIN REGION filtrado`.
//      Con A2 y A6b aplicados, P001 se queda **sin un solo código**: es una fila vacía que duplica.
//    · `005-P002/P003/P004` NO son eso. Tienen links que la autoridad **sí declara**, de jornadas
//      que **todavía no salen** (22-ago, 06-sep, 19-sep). Su `Email_Name` vacío no es un hueco:
//      es un correo que no existe todavía.
//
// 🔴 NO SE BORRA NINGUNA FILA. El catálogo ya tiene columnas `Estado` y `Notas`, y `Retirada` ya
//    es un valor en uso. Borrar filas correría los números de fila de todo lo demás apuntado, y
//    una pieza retirada con su motivo escrito vale más que una pieza desaparecida.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var HOY = '2026-08-21';
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ A9 · LIGA MX ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('A9');

var A = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8'));
var val = A.links_validos || {};
var F0 = os.homedir() + '/_a9.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);
var crudo = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var P = CB.vistaFutura('Catalogo_Piezas', crudo);   // con A2, A3, A6b y A8 ya aplicados

var evidencia = [], apuntes = [];
P.forEach(function (p, i) {
  var fila = i + 2, id = t(p['Pieza_ID']);
  if (!/^005-P00[1-4]$/.test(id)) return;

  // los códigos que le quedan DESPUÉS de A2 y A6b, y sus fechas según la autoridad
  var cods = [];
  for (var k = 1; k <= 5; k++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + k]).forEach(function (c) { if (cods.indexOf(c) < 0) cods.push(c); });
  });
  var fechas = cods.map(function (c) { return val[c] ? val[c].fecha_activacion : null; }).filter(Boolean).sort();
  var sale = fechas[0] || '';
  var tp = t(p['Touchpoint']);

  var caso = {
    fila: fila, pieza_id: id, touchpoint: tp, segmento: t(p['Segmento']),
    codigos_que_le_quedan: cods, fecha_de_salida_segun_la_autoridad: sale,
    tiene_email_id: !!t(p['EmailID']), tiene_nombre: !!t(p['Content_Name'])
  };

  if (!cods.length) {
    // 🔴 P001 · sin códigos, sin correo: duplica al E-J4 del 15-ago
    caso.veredicto = 'Retirada';
    caso.porque = 'Es el mismo envío que 005-P005/P006 (E-J4, 15-ago-2026): SFMC fecha los eids ' +
      '84969/84970 ese día y la autoridad fecha e-p1 ese mismo día. Sus 4 links —los que dictó Rick— ' +
      'quedaron colgados de E-J4 por región (A2), y los 2 que no declara la autoridad salieron (A6b). ' +
      'La fila se queda sin códigos, sin EmailID y sin nombre: contarla sería contar dos veces el mismo envío.';
    apuntes.push({ fila: fila, col: 'Estado', valor: 'Retirada' });
    apuntes.push({ fila: fila, col: 'Notas', valor: 'RETIRADA 21-ago-2026 · duplica a 005-P005/P006 (E-J4, 15-ago). Sus links viven ahí, por región. No se borra la fila para conservar el rastro.' });
  } else if (sale && sale > HOY) {
    // P002/P003/P004 · links declarados, jornada futura
    caso.veredicto = 'Sin email cargado (programada)';
    caso.porque = 'Sus ' + cods.length + ' links SÍ los declara «Qcart-Links Mails-Hive-MX.xlsx», con salida ' +
      sale + ' — posterior a hoy (' + HOY + '). El correo no ha salido, así que no tiene Email_Name. ' +
      'No es un hueco por llenar: es una pieza programada.';
    apuntes.push({ fila: fila, col: 'Notas', valor: 'PROGRAMADA · jornada ' + tp + ', sale ' + sale +
      ' según Qcart-Links. Sin Email_Name porque el correo todavía no existe en SFMC. Su tráfico no cuenta hasta esa fecha.' });
  } else {
    caso.veredicto = '⚠ revisar';
    caso.porque = 'Tiene ' + cods.length + ' código(s) con salida ' + (sale || '(sin fecha)') + ', que no es futura, pero no tiene correo en SFMC.';
  }
  evidencia.push(caso);
});

evidencia.forEach(function (c) {
  console.log('  ── ' + c.pieza_id + '  (fila ' + c.fila + ')  ' + c.touchpoint);
  console.log('     códigos que le quedan: ' + (c.codigos_que_le_quedan.join(', ') || '(ninguno)'));
  console.log('     sale según la autoridad: ' + (c.fecha_de_salida_segun_la_autoridad || '—') +
    '   ·   EmailID: ' + (c.tiene_email_id ? 'sí' : 'no') + '   ·   nombre: ' + (c.tiene_nombre ? 'sí' : 'no'));
  console.log('     → ' + c.veredicto);
});

fs.writeFileSync(BACK + '/_catalogo/piezas-retiradas.json', JSON.stringify({
  paso: 'A9', cuando: HOY,
  que_es: 'Las piezas 005-P001…P004 de Liga MX, con la evidencia de por qué cada una queda como queda.',
  como_vuelve: 'Una PROGRAMADA se completa sola cuando SFMC declare su correo: el catálogo la cruza por EmailID. Una RETIRADA no vuelve: su envío ya está contado en otra pieza.',
  casos: evidencia
}, null, 1));
console.log('\n  → _catalogo/piezas-retiradas.json');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
apuntes.forEach(function (a) {
  var c = evidencia.filter(function (e) { return e.fila === a.fila; })[0];
  CB.apuntar('A9', 'Catalogo_Piezas', a.fila, a.col, a.valor, 'A9 · ' + c.porque);
});
var res = CB.resumen();
console.log('\n  ── apuntados ' + apuntes.length + ' cambio(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
