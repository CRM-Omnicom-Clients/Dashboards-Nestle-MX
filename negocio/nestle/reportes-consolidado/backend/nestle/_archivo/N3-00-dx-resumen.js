// DIAGNÓSTICO del Report_Resumen — qué tiene hoy vs qué debería tener, enfocado en JULIO.
// No escribe nada. Solo mide el hueco.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
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
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var iso = function (f) {
  if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10);
  var s = t(f); if (!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : s.slice(0, 10);
};

var T = os.homedir() + '/_dxr.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var RR = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', header: 1 });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

console.log('════ ESTRUCTURA DE Report_Resumen ════');
console.log('  filas: ' + RR.length);
// el encabezado real: la fila con más celdas de texto no numérico
var iH = 0, mejor = 0;
RR.slice(0, 8).forEach(function (f, i) {
  var n = f.filter(function (c) { return t(c) && isNaN(Number(c)); }).length;
  if (n > mejor) { mejor = n; iH = i; }
});
var H = RR[iH].map(t);
console.log('  encabezado en la fila ' + (iH + 1) + '  ·  ' + H.filter(Boolean).length + ' columnas');
console.log('');
H.forEach(function (c, i) { if (c) console.log('    [' + String(i).padStart(2) + '] ' + c); });

// filas de datos
var D = RR.slice(iH + 1).filter(function (f) { return f.some(function (c) { return t(c); }); });
console.log('\n  filas de datos: ' + D.length);

// ¿cómo identifica cada fila su campaña y su periodo?
var iCamp = H.findIndex(function (c) { return /campa/i.test(c); });
var iPer = H.findIndex(function (c) { return /quincena|periodo|mes/i.test(c); });
var iTP = H.findIndex(function (c) { return /touchpoint/i.test(c); });
var iSeg = H.findIndex(function (c) { return /segmento/i.test(c); });
console.log('  col campaña=[' + iCamp + ']  periodo=[' + iPer + ']  touchpoint=[' + iTP + ']  segmento=[' + iSeg + ']');

console.log('\n════ QUÉ HAY HOY, POR CAMPAÑA Y PERIODO ════');
var hoy = {};
D.forEach(function (f) {
  var k = t(f[iCamp]) + ' ¦ ' + t(f[iPer]);
  hoy[k] = (hoy[k] || 0) + 1;
});
Object.keys(hoy).sort().forEach(function (k) { console.log('  ' + String(hoy[k]).padStart(3) + '  ' + k); });

console.log('\n════ QUÉ DEBERÍA TENER JULIO, según el catálogo ════');
var julio = P.filter(function (p) {
  var m = t(p['Meses_Activos']) || t(p['Mes_Lanzamiento']);
  return /2026-07/.test(m);
});
console.log('  piezas del catálogo activas en julio: ' + julio.length);
var porC = {};
julio.forEach(function (p) {
  var k = t(p['Campaña']);
  porC[k] = porC[k] || { n: 0, sends: 0, carr: 0, tps: {}, segs: {} };
  porC[k].n++; porC[k].sends += num(p['Sends']); porC[k].carr += num(p['Carritos_Total']);
  porC[k].tps[t(p['Touchpoint'])] = 1; porC[k].segs[t(p['Segmento'])] = 1;
});
Object.keys(porC).sort().forEach(function (c) {
  var x = porC[c];
  console.log('  ' + c.padEnd(16) + String(x.n).padStart(3) + ' piezas · ' + String(x.sends.toLocaleString()).padStart(10) + ' sends · ' +
    String(x.carr).padStart(4) + ' carr · TP: ' + Object.keys(x.tps).sort().join(',') + ' · seg: ' + Object.keys(x.segs).length);
});

console.log('\n════ MAGGI / MUNDIAL — el reclamo de Rick ════');
var maggi = P.filter(function (p) { return t(p['Marca']) === 'Maggi' || /Mundial|Liga MX/.test(t(p['Campaña'])); });
console.log('  piezas de Maggi en el catálogo: ' + maggi.length);
var mj = {};
maggi.forEach(function (p) {
  var k = t(p['Campaña']) + ' ¦ ' + t(p['Canal']) + ' ¦ ' + (t(p['Meses_Activos']) || t(p['Mes_Lanzamiento']) || 'SIN PERIODO');
  mj[k] = mj[k] || { n: 0, sends: 0, carr: 0 };
  mj[k].n++; mj[k].sends += num(p['Sends']); mj[k].carr += num(p['Carritos_Total']);
});
Object.keys(mj).sort().forEach(function (k) {
  console.log('  ' + String(mj[k].n).padStart(2) + ' piezas · ' + String(mj[k].sends.toLocaleString()).padStart(9) + ' sends · ' +
    String(mj[k].carr).padStart(4) + ' carr   ' + k);
});
console.log('\n  ¿aparece Maggi/Mundial en Report_Resumen?');
var enRR = D.filter(function (f) { return /maggi|mundial|liga/i.test(f.join(' ')); });
console.log('    filas que lo mencionan: ' + enRR.length);
enRR.slice(0, 6).forEach(function (f) { console.log('      ' + t(f[iCamp]).padEnd(16) + t(f[iPer]).padEnd(14) + t(f[iTP]).padEnd(8) + t(f[iSeg]).slice(0, 24)); });

console.log('\n════ HOTCAKES — las fechas que Rick dice que están mal ════');
var hot = P.filter(function (p) { return t(p['Campaña']) === 'Hotcakes'; });
console.log('  piezas: ' + hot.length);
var fh = {};
hot.forEach(function (p) {
  var k = t(p['Canal']) + ' ¦ ' + t(p['Fecha_Primer_Envio']).slice(0, 10) + ' → ' + t(p['Fecha_Ultimo_Envio']).slice(0, 10) + ' ¦ ' + t(p['Meses_Activos']);
  fh[k] = (fh[k] || 0) + 1;
});
Object.keys(fh).sort().forEach(function (k) { console.log('  ' + String(fh[k]).padStart(2) + '  ' + k); });
console.log('\n  y en Report_Resumen, ¿qué periodo dice para Hotcakes?');
D.filter(function (f) { return /hotcakes/i.test(t(f[iCamp])); }).slice(0, 8).forEach(function (f) {
  console.log('      ' + t(f[iCamp]).padEnd(12) + t(f[iPer]).padEnd(16) + t(f[iTP]).padEnd(8) + t(f[iSeg]).slice(0, 26));
});
