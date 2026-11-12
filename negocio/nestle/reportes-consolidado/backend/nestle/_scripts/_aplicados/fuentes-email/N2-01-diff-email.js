// N2.1 · DIFF de email — qué trae el Datorama fresco que NO está cargado.
// NO escribe nada. Primero se mira, luego se decide.
//
// 🔴 REGLAS QUE APLICO (y que ya costaron un error cada una):
//  · "No hay envíos nuevos" ≠ "no hay datos nuevos": las métricas de email ACUMULAN.
//  · Un envío vive en la hoja de SU mes. Las otras hojas traen filas FRAGMENTO (sends=0,
//    opens parciales) → compararlas contra la hoja equivocada da falsos "creció".
//  · La llave NO usa el content_name crudo: cambia de prefijo entre semanas. Se usa
//    asset ¦ journey_id ¦ audiencia ¦ fecha — todos presentes en LAS DOS partes.
//  · Monotonía: se toma MAX por métrica. Nada baja nunca.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
// 🔴 SUPERADO por N2a-email.js (19-ago-2026)
//    el diff de email vive dentro del bloque, y ahora suma los NUEVOS.
//    Se conserva por su historia, no por su utilidad: corre sobre un esquema que ya cambió.
var SUPERADO_POR = "N2a-email.js";
if (!process.env.CORRER_SUPERADO) {
  console.log("\n  🔴 este script está SUPERADO por " + SUPERADO_POR + ".");
  console.log("     el diff de email vive dentro del bloque, y ahora suma los NUEVOS");
  console.log("     Si de verdad lo necesitas: CORRER_SUPERADO=1 node N2-01-diff-email.js\n");
  process.exit(0);
}
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var t = D.t, num = D.num;
var iso = function (f) {
  if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10);
  var s = t(f); if (!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  var d = new Date(s); return isNaN(d) ? s.slice(0, 10) : d.toISOString().slice(0, 10);
};

// ── lo cargado
var T = os.homedir() + '/_n2b.xlsx'; fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var MET = [['Email_Sends', 'Email Sends'], ['Email_Deliveries', 'Email Deliveries'],
['Email_Unique_Opens', 'Email Unique Opens'], ['Email_Unique_Clicks', 'Email Unique Clicks'],
['Email_Bounces', 'Email Bounces']];
var cargado = {};
E.forEach(function (r) {
  var k = D.llaveEnvio({content_name:r['Email_Content_Name'],fecha:r['Send_Date']});
  cargado[k] = { fila: r, m: MET.reduce(function (a, m) { a[m[0]] = num(r[m[0]]); return a; }, {}) };
});

// ── lo fresco
var inv = D.inventario(PROY + '/Reportes-Datorama');
var fuente = inv[0];
console.log('════ N2.1 · DIFF DE EMAIL ════');
console.log('  fuente elegida por su SELLO INTERNO: ' + fuente.archivo + '  (' + fuente.generado + ')');
console.log('  ⚠ ' + (inv.filter(function (x) { return x.wk > fuente.wk; }).length || 0) + ' archivo(s) con WK mayor pero MÁS VIEJOS — el nombre miente\n');
var R = D.leerArchivo(fuente.ruta);

// 🔴 un envío vive en la hoja de SU mes: se descarta la fila si su Send_Date no cae en el mes de su hoja
var MESN = { marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08' };
var nuevos = [], crecieron = [], iguales = 0, fragmentos = 0, sinFecha = 0, total = 0;
R.hojas.forEach(function (h) {
  var mm = null;
  Object.keys(MESN).forEach(function (k) { if (new RegExp(k, 'i').test(h.hoja)) mm = MESN[k]; });
  h.filas.forEach(function (r) {
    var cn = t(r['Email Content Name']); if (!cn) return;
    var fecha = iso(r['Send Date']);
    if (!fecha) { sinFecha++; return; }
    if (mm && fecha.slice(5, 7) !== mm) { fragmentos++; return; }   // fila fragmento de otro mes
    total++;
    var k = D.llaveEnvio({content_name:cn,fecha:r['Send Date']});
    var m = MET.reduce(function (a, x) { a[x[0]] = num(r[x[1]]); return a; }, {});
    if (!cargado[k]) { nuevos.push({ cn: cn, f: fecha, h: h.hoja, m: m }); return; }
    var sube = MET.filter(function (x) { return m[x[0]] > cargado[k].m[x[0]]; });
    if (sube.length) crecieron.push({ cn: cn, f: fecha, h: h.hoja, sube: sube.map(function (x) { return x[0] + ' ' + cargado[k].m[x[0]].toLocaleString() + '→' + m[x[0]].toLocaleString(); }) });
    else iguales++;
  });
});

console.log('  filas del export (tras quitar fragmentos de otro mes): ' + total);
console.log('    ya cargadas e idénticas : ' + iguales);
console.log('    🔴 CRECIERON            : ' + crecieron.length);
crecieron.slice(0, 8).forEach(function (x) { console.log('       ' + x.f + '  ' + x.cn.slice(-40).padEnd(42) + x.sube.join(' · ')); });
if (crecieron.length > 8) console.log('       … y ' + (crecieron.length - 8) + ' más');
console.log('    🔴 NUEVAS               : ' + nuevos.length);
var porH = {}; nuevos.forEach(function (x) { porH[x.h] = (porH[x.h] || 0) + 1; });
Object.keys(porH).sort().forEach(function (h) { console.log('       ' + String(porH[h]).padStart(3) + ' en ' + h); });
nuevos.slice(0, 10).forEach(function (x) { console.log('       ' + x.f + '  ' + String(x.m['Email_Sends']).padStart(8) + '  ' + x.cn.slice(-46)); });
if (nuevos.length > 10) console.log('       … y ' + (nuevos.length - 10) + ' más');
console.log('    filas fragmento descartadas (mes ≠ hoja): ' + fragmentos);
console.log('    filas sin Send_Date: ' + sinFecha);

console.log('\n  IMPACTO EN VOLUMEN');
var addN = nuevos.reduce(function (a, x) { return a + x.m['Email_Sends']; }, 0);
var actual = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
console.log('    sends cargados hoy : ' + actual.toLocaleString());
console.log('    sends que agregan  : ' + addN.toLocaleString() + '   (' + (addN / actual * 100).toFixed(1) + '% más)');

fs.writeFileSync(os.homedir() + '/_n2_diff.json', JSON.stringify({ fuente: fuente, nuevos: nuevos, crecieron: crecieron, iguales: iguales }, null, 1));
console.log('\n  → diff guardado. NO se escribió nada todavía.');
