// Repara los 3 defectos de estilos del doc de links, para poder escribirle.
//
// El archivo del equipo YA venía así —confirmado por openpyxl, que es un lector independiente
// del código propio— y Excel lo abre porque es tolerante. Pero la cadena de escritura no: aborta
// antes de tocar el archivo, y hace bien. Sin reparar esto no se puede corregir ni una celda.
//
// 🔴 De los 3 defectos que se reportaban, DOS NO EXISTÍAN: el validador contaba mal los
//    `<border/>` autocerrados y veía 24 donde hay 25. Corregido en `xlsx-validar-fondo.py`
//    —el orden de la alternancia—, esos dos desaparecieron. **El archivo estaba sano y la
//    herramienta bloqueaba trabajo legítimo.** Antes de reparar un archivo, comprobar que el
//    que se equivoca no sea el que mide.
//
// Queda uno real, y es seguro:
//   fill[1] es `lightGray` y el OOXML reserva esa posición para `gray125`.
//   **0 celdas usan fillId=1**, así que cambiarlo no altera nada visible.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');

var DOC = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx';
var SECO = os.homedir() + '/_qlinks_fix.xlsx';        // se trabaja en ruta ASCII, sin acentos

console.log('════════ reparar estilos · Qcart-Links ════════\n');
fs.copyFileSync(DOC, SECO);
var zip = new AdmZip(SECO);
var st = zip.readAsText('xl/styles.xml');
var antes = st.length;
var cambios = [];

// fill[1] tiene que ser gray125 (lo exige el esquema, en esa posición exacta)
var mf = /<fills count="(\d+)">([\s\S]*?)<\/fills>/.exec(st);
if (mf) {
  var fills = mf[2].match(/<fill>[\s\S]*?<\/fill>|<fill\/>/g) || [];
  if (fills[1] && fills[1].indexOf('gray125') < 0) {
    fills[1] = '<fill><patternFill patternType="gray125"/></fill>';
    st = st.replace(mf[0], '<fills count="' + fills.length + '">' + fills.join('') + '</fills>');
    cambios.push('fill[1] → gray125');
  }
}

if (!cambios.length) { console.log('  nada que reparar'); process.exit(0); }
cambios.forEach(function (c) { console.log('  ✔ ' + c); });
console.log('  styles.xml: ' + antes + ' → ' + st.length + ' bytes');

zip.updateFile('xl/styles.xml', Buffer.from(st, 'utf8'));
zip.writeZip(SECO);

// 🔴 adm-zip deja el paquete OPC mal (partes [trash]/ y Content_Types fuera de la 1ª posición).
//    safeSave lo repara Y valida antes de escribir: si algo quedó mal, no toca el archivo.
console.log('\n  ── safe-save (repara el paquete y valida antes de escribir)');
var r = safeSave(SECO, SECO);
console.log('     ' + JSON.stringify(r).slice(0, 200));
