// PUERTA 1 · quita las fórmulas MUERTAS que bloquean la escritura.
//
// La cadena de validación se niega a escribir el workbook porque tiene fórmulas que citan hojas
// inexistentes. Diagnóstico antes de tocar nada:
//
//   · son 234, TODAS en `Soporte_IA_Qcart_Productos`
//   · su fórmula es literalmente `#REF!` — no calculan nada, solo muestran el error
//   · quedaron así cuando se borró `Data_Qcart_Legacy`, que era de donde leían
//   · 🔴 NADIE lee esa hoja: cero fórmulas del workbook la citan
//
// Se vacían las celdas rotas. No se pierde información porque no había: `#REF!` es la ausencia
// de un dato, no un dato. Las columnas A-E de esa hoja, que sí funcionan (leen Data_Qcart), se
// quedan intactas.
//
// ⚠ Reparar la hoja de verdad —volver a apuntarla a un origen vivo— es otra tarea. Y ahora es
//   posible: `Data_Qcart_Productos`, la hoja nueva de N2b, trae justo lo que esas columnas
//   buscaban (producto, views e importe por producto).
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var XLSX = require('xlsx');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_neutral.xlsx';
fs.copyFileSync(vivo.ruta, SECO);

console.log('════════ neutralizar fórmulas muertas ════════\n');

// localizar la parte XML de la hoja
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {};
rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Soporte_IA_Qcart_Productos') parte = 'xl/' + String(rmap[rid]).replace(/^\//, '');
  return _;
});
if (!parte) { console.log('  🔴 no encontré la hoja'); process.exit(1); }
console.log('  hoja: Soporte_IA_Qcart_Productos → ' + parte);

var xml = zip.readAsText(parte);
var antes = (xml.match(/<f>#REF!<\/f>/g) || []).length;
var conRefDentro = (xml.match(/<f>[^<]*#REF![^<]*<\/f>/g) || []).length;
console.log('  fórmulas que son exactamente «#REF!» : ' + antes);
console.log('  fórmulas que CONTIENEN #REF! dentro  : ' + (conRefDentro - antes) + '   (esas también se van: su resultado ya es error)');

// se quita el <f> y el <v> de esas celdas: quedan vacías, como se ven hoy
var quitadas = 0;
xml = xml.replace(/<c([^>]*)>((?:(?!<\/c>).)*?)<\/c>/g, function (todo, attrs, dentro) {
  if (dentro.indexOf('#REF!') < 0) return todo;
  quitadas++;
  // se conserva el estilo (s="..") y la referencia; se va el contenido
  var a = attrs.replace(/\st="[^"]*"/g, '');
  return '<c' + a + '/>';
});
console.log('  celdas vaciadas: ' + quitadas);

zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);

// 🔴 adm-zip deja el paquete OPC mal: safeSave lo repara Y valida antes de escribir
console.log('\n  ── safe-save (repara el paquete y valida antes de escribir)');
var r = safeSave(SECO, SECO);
console.log('     validado: ' + (r.validado || '?') + '   partes: ' + r.partes);

// verificar releyendo, no confiando
var wb2 = XLSX.readFile(SECO);
var sh = wb2.Sheets['Soporte_IA_Qcart_Productos'];
var quedan = 0;
if (sh && sh['!ref']) {
  var rr = XLSX.utils.decode_range(sh['!ref']);
  for (var i = rr.s.r; i <= rr.e.r; i++) for (var c = rr.s.c; c <= rr.e.c; c++) {
    var cel = sh[XLSX.utils.encode_cell({ r: i, c: c })];
    if (cel && cel.f && /#REF!/.test(cel.f)) quedan++;
  }
}
console.log('     releído: quedan ' + quedan + ' fórmulas con #REF!');
// y que las columnas buenas sigan ahí
var a2 = sh['A2'];
console.log('     A2 (columna que SÍ funciona): ' + (a2 && a2.f ? 'sigue con su fórmula ✔' : '🔴 se perdió'));
console.log('\n  archivo listo en: ' + SECO);
console.log('  ⚠ NO se copió al original todavía — eso lo hace el paso siguiente.');
