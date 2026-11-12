// D-registro-columnas · enseñarle al registro el renombre y las columnas nuevas del reporte.
//
// 🔴 El registro es el único lugar donde el id lógico y el nombre físico se tocan. D-columnas
//    renombró `Clicks_Links_Total`→`Clicks_Unicos_Total` y agregó 8 columnas; aquí el registro lo
//    absorbe: el id `resumen.clicks_links_total` se queda con su viejo nombre como alias, y las
//    nuevas se siembran con su id. Sin esto, N6 exige un nombre que ya no existe y aborta —que es
//    justo lo que el registro debe evitar, no causar.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nmz(v) { return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/%/g, ' pct ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

var REG = JSON.parse(fs.readFileSync(BACK + '/_contratos/registro.json', 'utf8'));
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0].map(t);

console.log('════════ D-registro-columnas ════════\n');
// 1 · el renombre
var idCLT = 'resumen.clicks_links_total';
if (REG.columnas[idCLT]) {
  var c = REG.columnas[idCLT];
  if (c.nombres[0] !== 'Clicks_Unicos_Total') {
    c.alias_historicos = (c.alias_historicos || []).concat(c.nombres);
    c.nombres = ['Clicks_Unicos_Total'];
    c.renombrada = { cuando: '2026-08-21', de: 'Clicks_Links_Total', a: 'Clicks_Unicos_Total', por: 'D3 · el nombre tiene que decir que es de únicos' };
    console.log('  ✔ ' + idCLT + ' → Clicks_Unicos_Total (Clicks_Links_Total queda como alias)');
  } else console.log('  · ' + idCLT + ' ya estaba renombrado');
}
// 2 · las columnas nuevas — se siembran con su id, posición y vecinos
var NUEVAS = ['%_Qcart', '%_App', '%_Social', '%_Web', '%_Ver_Navegador', '%_Unsub', 'Email_Name', 'Principal_Subject'];
var sembradas = 0;
NUEVAS.forEach(function (nom) {
  var i = enc.indexOf(nom); if (i < 0) { console.log('  🔴 la hoja no tiene «' + nom + '»'); return; }
  var id = 'resumen.' + nmz(nom);
  if (REG.columnas[id]) return;
  REG.columnas[id] = { id: id, ambito: 'resumen', nombres: [nom], alias_historicos: [], posicion: i + 1,
    letra: XLSX.utils.encode_col(i), vecinos: [enc[i - 1] || '', enc[i + 1] || ''],
    tipo_dato: /^%/.test(nom) ? 'porcentaje' : 'texto', nueva: '2026-08-21 · D4/F3', visto: '2026-08-21' };
  sembradas++;
});
console.log('  ✔ columnas nuevas sembradas: ' + sembradas + ' de ' + NUEVAS.length);

fs.writeFileSync(BACK + '/_contratos/registro.json', JSON.stringify(REG, null, 1));
console.log('\n  → registro.json actualizado');
