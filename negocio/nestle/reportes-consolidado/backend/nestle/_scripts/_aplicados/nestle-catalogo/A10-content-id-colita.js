// A10 · `Content_ID` ES LA COLITA DEL NOMBRE — no una copia del Asset_ID.
//
// 🔴 RICK (21-ago): «Content ID es el final del Email Name, la colita. Email ID es un número nuevo
//    que viene en la DE. No son lo mismo, conservas ambas.»
//    Hoy la columna `Content_ID` del catálogo guarda, en muchas filas, el **Asset_ID**. Se ve
//    porque el nombre termina en `_803867`, `Asset_ID` dice `863587`, y `Content_ID` dice `863587`.
//
// 🔴 LO QUE ESTE PASO NO HACE: inventar una colita donde el nombre no sigue el estándar. Los
//    nombres de Pro Plan van con puntos (`…CDP_Proplan_PA_E3B1.NA`) y ahí «el final» no está
//    definido. Se dejan como están y se declara — derivar a la fuerza los rompería en silencio.
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

console.log('════════ A10 · Content_ID = la colita del nombre ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('A10');

var F0 = os.homedir() + '/_a10.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);
var crudo = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var P = CB.vistaFutura('Catalogo_Piezas', crudo);

// la colita del estándar SFMC: el último tramo separado por «_», y tiene que ser numérico.
// `…_AQ_EM_A_NA_035275` → 035275 · `…_AC_EM_A_V1_803867` → 803867
function colitaDe(nombre) {
  var partes = t(nombre).split('_');
  var ult = t(partes[partes.length - 1]);
  return /^\d{4,}$/.test(ult) ? ult : null;
}

var st = { ok: 0, corrige: 0, era_asset: 0, sin_estandar: 0, sin_nombre: 0 };
var cambios = [], noEstandar = [], corregidas = [];

P.forEach(function (p, i) {
  var fila = i + 2, id = t(p['Pieza_ID']);
  var nom = t(p['Content_Name']), cid = t(p['Content_ID']), asset = t(p['Asset_ID']);
  if (!nom) { st.sin_nombre++; return; }
  var col = colitaDe(nom);
  if (!col) {
    st.sin_estandar++;
    noEstandar.push({ fila: fila, pieza_id: id, nombre: nom, content_id_actual: cid,
      porque: 'su nombre no sigue el estándar SFMC (no termina en «_<dígitos>»); no se deriva nada' });
    return;
  }
  if (cid === col) { st.ok++; return; }
  st.corrige++;
  if (cid && cid === asset) st.era_asset++;
  corregidas.push({ fila: fila, id: id, antes: cid || '(vacía)', ahora: col, asset: asset,
    era_asset: !!(cid && cid === asset), nombre: nom });
  cambios.push({ fila: fila, valor: col, antes: cid, era_asset: !!(cid && cid === asset) });
});

console.log('  ' + String(st.ok).padStart(4) + '  ya estaban bien');
console.log('  ' + String(st.corrige).padStart(4) + '  se corrigen   (de ellas ' + st.era_asset + ' guardaban el Asset_ID)');
console.log('  ' + String(st.sin_estandar).padStart(4) + '  el nombre no sigue el estándar → NO se tocan, se declaran');
console.log('  ' + String(st.sin_nombre).padStart(4) + '  sin nombre (WhatsApp y las programadas de Liga MX)');

console.log('\n  ── las que cambian:');
corregidas.slice(0, 14).forEach(function (c) {
  console.log('     f' + String(c.fila).padEnd(5) + t(c.id).padEnd(10) + String(c.antes).padEnd(11) + '→ ' + String(c.ahora).padEnd(10) +
    (c.era_asset ? '(era el Asset_ID)' : '') + '   …' + c.nombre.slice(-26));
});
if (corregidas.length > 14) console.log('     … y ' + (corregidas.length - 14) + ' más');

if (noEstandar.length) {
  console.log('\n  ── las que NO siguen el estándar (se quedan como están):');
  noEstandar.slice(0, 6).forEach(function (n) {
    console.log('     f' + String(n.fila).padEnd(5) + t(n.pieza_id).padEnd(10) + 'Content_ID=' + String(n.content_id_actual).padEnd(10) + '…' + n.nombre.slice(-40));
  });
  if (noEstandar.length > 6) console.log('     … y ' + (noEstandar.length - 6) + ' más');
}

fs.writeFileSync(BACK + '/_catalogo/content-id-sin-estandar.json', JSON.stringify({
  paso: 'A10', regla: 'Content_ID = el último tramo del Email_Name separado por «_», y solo si es numérico',
  no_derivados: noEstandar
}, null, 1));

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
cambios.forEach(function (c) {
  CB.apuntar('A10', 'Catalogo_Piezas', c.fila, 'Content_ID', c.valor,
    'A10 · Content_ID es la colita del Email_Name (regla de Rick). Estaba «' + (c.antes || 'vacía') + '»' +
    (c.era_asset ? ', que es el Asset_ID — otro dato' : '') + '. Email_ID (el número de la DE) va aparte y no se toca.');
});
var res = CB.resumen();
console.log('\n  ── apuntados ' + cambios.length + ' cambio(s). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
