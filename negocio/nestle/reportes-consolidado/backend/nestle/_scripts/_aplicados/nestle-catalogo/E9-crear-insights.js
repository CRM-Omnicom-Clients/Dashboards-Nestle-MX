// E9 · LA COLUMNA `Insights` DE Report_Resumen — la que nadie había creado.
//
// 🔴 QUÉ LO DESTAPÓ: la corrida E2E en modo escritura. N6b se detuvo con «no encontré la columna
//    Insights». Lo primero fue sospechar que N6 la había borrado al regenerar la hoja —es el riesgo
//    real de un `borrar y recrear`— así que se revisaron los CINCO backups más recientes:
//    en ninguno existe. Nunca se creó. N6b llevaba corridas fallando por una columna fantasma,
//    y en modo seco eso se leía como «vista previa» en vez de como un fallo.
//
// 🔴 SE CREA AL FINAL DE LA HOJA, NUNCA A MEDIA HOJA. Insertar una columna en medio recorre todas
//    las de su derecha y deja las fórmulas apuntando a otro sitio. `apuntarColumna` la agrega al
//    final y Z actualiza el `<dimension>` — sin eso Excel sigue leyendo el rango viejo y la
//    columna existe en el XML pero no en la hoja.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), os = require('os');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ E9 · COLUMNA Insights ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('E9');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var sh = wb.Sheets['Report_Resumen'];
var enc = (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t);
var filas = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
console.log('  Report_Resumen: ' + filas.length + ' filas · ' + enc.length + ' columnas');

if (enc.indexOf('Insights') >= 0) {
  console.log('  ○ la columna «Insights» ya existe (col ' + (enc.indexOf('Insights') + 1) + '). Nada que hacer.');
  process.exit(0);
}
console.log('  🔴 no existe. Se crea al final, como columna ' + (enc.length + 1) + '.');
console.log('     la llenará N6b — aquí solo se crea el encabezado, sin inventar contenido.');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
CB.apuntarColumna('E9', 'Report_Resumen', 'Insights',
  'E9 · la columna que N6b exige y que nunca se creo. Se comprobaron los 5 backups mas recientes: ' +
  'en ninguno existe, asi que N6 no la borro al regenerar. Va AL FINAL para no recorrer las 82 que ya estan.');
var res = CB.resumen();
console.log('\n  ── apuntada. Acumulado: ' + res.total + ' celdas · ' + (res.columnas_nuevas || 0) + ' columna(s) nueva(s)');
