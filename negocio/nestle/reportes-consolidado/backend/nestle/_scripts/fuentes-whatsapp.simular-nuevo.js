// whatsapp-bloque · SIMULACIÓN — la campaña nueva, que es el camino que el corte de hoy NO ejercita.
//
// WhatsApp no tiene cadencia: la próxima carga será «llegó una campaña». Ese camino no se ha
// corrido nunca con datos nuevos, y es donde vivía el defecto de fondo en email-bloque y en qcart-bloque.
//
// Se altera la fuente y se corre **el whatsapp-bloque de verdad** contra ella. Después se restaura todo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var W = require(__dirname + '/lib-whatsapp.js');
var BACK = require('path').resolve(__dirname, '..');
var t = W.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ whatsapp-bloque · SIMULACIÓN DE LA PRÓXIMA CAMPAÑA ════════\n');
var inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));
var SRC = inv.forma.whatsapp.ruta;
var BLOQUE = BACK + '/_fuentes/whatsapp.json';
var respaldoBloque = fs.readFileSync(BLOQUE, 'utf8');
var antes = JSON.parse(respaldoBloque);
console.log('  estado actual: ' + antes.envios.length + ' envíos · Σ ' + mil(antes.auditoria.sends_total));

// ⚠ la fuente es de SOLO LECTURA (vive en la carpeta de Leslie). Se trabaja sobre una COPIA
//   y se apunta el handoff a ella; el original no se toca jamás.
var SIM = require('path').resolve(__dirname, '..') + '/_tmp/_wa_sim.xlsx';
fs.copyFileSync(SRC, SIM);
var respaldoInv = fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8');

function restaurar() {
  fs.writeFileSync(BACK + '/_insumos/inventario.json', respaldoInv, 'utf8');
  fs.writeFileSync(BLOQUE, respaldoBloque, 'utf8');
  try { fs.unlinkSync(SIM); } catch (e) { }
}
process.on('exit', restaurar);

try {
  // ── una hoja nueva, con el esquema de otra campaña y su propia fila de Totales ────
  var wb = XLSX.readFile(SIM);
  var nueva = [
    ['SEGMENTO', 'utm_content', 'Fecha de envío', '#AUDIENCIA ORIGINAL', '#AUDIENCIA FINAL', 'ENVÍOS', 'ENTREGAS', 'ERRORES', 'OPENS', 'CLICKS'],
    ['Nuevos', 'wa-n1', '2026-09-15', 900, 800, 700, 650, 50, 400, 60],
    ['Recurrentes', 'wa-n2', '2026-09-15', 500, 450, 400, 380, 20, 210, 35],
    ['Totales', '', '', 1400, 1250, 1100, 1030, 70, 610, 95]      // 🔴 700+400 = 1100
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nueva), 'CampanaNueva');
  XLSX.writeFile(wb, SIM);
  var inv2 = JSON.parse(respaldoInv);
  inv2.forma.whatsapp.ruta = SIM;
  fs.writeFileSync(BACK + '/_insumos/inventario.json', JSON.stringify(inv2, null, 1), 'utf8');
  console.log('  campaña simulada: hoja «CampanaNueva» · 2 envíos + 1 fila de Totales (1,100 = 700+400)\n');

  // ── correr el whatsapp-bloque DE VERDAD ──────────────────────────────────────────────────────
  var salida = cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-whatsapp.whatsapp.js"', { encoding: 'utf8' });
  console.log(salida.split('\n').filter(function (l) { return /CampanaNueva|ya estaban|cuadra:|Totales/.test(l); }).join('\n'));

  var desp = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  var nuevos = desp.envios.filter(function (e) { return e.hoja === 'CampanaNueva'; });

  console.log('\n══ ¿la campaña nueva entró sola? ══');
  chk('la hoja nueva se lee sin tocar el código', nuevos.length === 2,
    nuevos.length + ' envíos de «CampanaNueva» · el lector la descubrió por su encabezado');
  chk('sus métricas llegan intactas', nuevos.length === 2 && nuevos[0].sends === 700 && nuevos[0].opens_read === 400,
    nuevos.length ? 'sends ' + nuevos[0].sends + ' · read ' + nuevos[0].opens_read : '');
  chk('su fecha se parsea', nuevos.length > 0 && nuevos[0].fecha === '2026-09-15',
    nuevos.length ? nuevos[0].fecha + '  (septiembre: el mes que rompía las listas clavadas)' : '');

  console.log('\n══ 🔴 ¿detectó SU fila de Totales? ══');
  var sub = desp.subtotales_excluidos.filter(function (s) { return s.hoja === 'CampanaNueva'; });
  chk('excluye el subtotal de la hoja nueva', sub.length === 1,
    sub.length ? 'dice ' + sub[0].sends_de_la_fila + ' · suma de arriba ' + sub[0].suma_de_las_de_arriba + ' → ' + (sub[0].cuadra ? 'confirmado' : 'NO cuadra') : '🔴 se le escapó');
  chk('el subtotal NO entró como envío', !nuevos.some(function (e) { return e.sends === 1100; }),
    'los 1,100 no se cargaron: habrían duplicado la hoja');

  console.log('\n══ ¿el append respetó lo anterior? ══');
  chk('el bloque creció exactamente en 2', desp.envios.length === antes.envios.length + 2,
    antes.envios.length + ' → ' + desp.envios.length);
  chk('lo ya cargado no se tocó', desp.auditoria.ya_estaban === antes.envios.length,
    mil(desp.auditoria.ya_estaban) + ' intactos');
  chk('la Σ subió solo lo de la campaña nueva', desp.auditoria.sends_total === antes.auditoria.sends_total + 1100,
    mil(antes.auditoria.sends_total) + ' + 1,100 = ' + mil(desp.auditoria.sends_total));

  console.log('\n══ ¿y una campaña sin pieza en el catálogo? ══');
  chk('se declara en vez de forzarse', nuevos.every(function (e) { return !e.pieza_id ? !!e.motivo_sin_pieza : true; }),
    nuevos.filter(function (e) { return !e.pieza_id; }).length + ' sin pieza, con su motivo — no se inventa una');

} finally {
  restaurar();
  var fin = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  console.log('\n══ ¿quedó todo como estaba? ══');
  chk('el bloque y el handoff quedaron restaurados',
    fin.envios.length === antes.envios.length && !fs.existsSync(SIM),
    fin.envios.length + ' envíos · la fuente original NUNCA se tocó (es solo lectura)');
}

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' camino(s) rotos' : '✅ una campaña nueva se carga sola, con su subtotal detectado'));
process.exit(fallo ? 1 : 0);
