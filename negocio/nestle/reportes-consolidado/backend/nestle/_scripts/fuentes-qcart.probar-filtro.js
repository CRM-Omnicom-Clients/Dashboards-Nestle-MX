// qcart-bloque · paso 4 — el filtro de pertenencia y ventana.
// Lo que se prueba: que el descarte CUADRE y que cada exclusión traiga su motivo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var C = require(__dirname + '/lib-qcart.js');
var F = require(__dirname + '/lib-qcart-filtro.js');
var Q = require(__dirname + '/lib-qcart-links.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function mil(n) { return n.toLocaleString('es-MX'); }

console.log('════════ qcart-bloque · paso 4 · EL FILTRO ════════\n');

var R = C.leerVigentes(PROY + '/ReportesQcart/_vigentes');
var pad = F.padron();
console.log('  padrón de links: ' + Object.keys(pad.links).length + ' códigos   (autoridad: ' + pad.fuente + ')');
var val = Object.keys(pad.links).filter(function (c) { return pad.links[c].valido; });
var sosp = val.filter(function (c) { return pad.links[c].fecha_sospechosa; });
console.log('     válidos: ' + val.length + '   inválidos: ' + (Object.keys(pad.links).length - val.length) +
  '   con fecha sospechosa: ' + sosp.length);

// el mapa código → pieza, del catálogo
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2bf.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var codPieza = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { codPieza[c] = F.t(p['Pieza_ID']); });
  });
});
console.log('     códigos anclados a una pieza: ' + Object.keys(codPieza).length);

// ── aplicar a los dos lotes ─────────────────────────────────────────────────────────
['carritos', 'productos'].forEach(function (tp) {
  var r = F.aplicar(R[tp], pad, codPieza);
  var s = r.resumen;
  console.log('\n══ ' + tp.toUpperCase() + ' ══');
  console.log('     total en el archivo          ' + String(mil(s.total)).padStart(6));
  console.log('     ─────────────────────────────────────');
  console.log('     ✔ ENTRA                      ' + String(mil(s.dentro)).padStart(6) + '   (' + (s.dentro / s.total * 100).toFixed(1) + '%)');
  console.log('     ✗ sin shortlink code         ' + String(mil(s.fuera_sin_codigo)).padStart(6));
  console.log('     ✗ no está en nuestro catálogo' + String(mil(s.fuera_no_es_nuestro)).padStart(6));
  console.log('     ✗ el link no se envió        ' + String(mil(s.fuera_link_invalido)).padStart(6));
  console.log('     ✗ antes de la activación     ' + String(mil(s.fuera_antes_de_activacion)).padStart(6));
  console.log('     ─────────────────────────────────────');
  console.log('     ' + (s.cuadra ? '✔ CUADRA' : '🔴 NO CUADRA') + '                     ' + String(mil(
    s.dentro + s.fuera_sin_codigo + s.fuera_no_es_nuestro + s.fuera_link_invalido + s.fuera_antes_de_activacion)).padStart(6));
  if (s.dentro_con_fecha_sospechosa) console.log('     ⚠ ' + mil(s.dentro_con_fecha_sospechosa) +
    ' entraron SIN aplicar la ventana: la fecha de su link contradice a su hoja (typo)');

  chk(tp + ': el descarte cuadra con el total', s.cuadra, mil(s.total) + ' = suma de las 5 categorías');
  chk(tp + ': todo excluido trae su motivo', r.fuera.every(function (x) { return !!x.motivo_exclusion; }),
    mil(r.fuera.length) + ' excluidos, 0 en silencio');
  chk(tp + ': todo lo que entra tiene pieza', r.dentro.every(function (x) { return !!x.pieza_id; }),
    r.dentro.filter(function (x) { return !x.pieza_id; }).length === 0 ? 'todos anclados' :
      mil(r.dentro.filter(function (x) { return !x.pieza_id; }).length) + ' sin pieza');
  chk(tp + ': nada que entra es anterior a su activación',
    r.dentro.every(function (x) { return !x.activacion_link || x.aviso || x.fecha >= x.activacion_link; }),
    'la ventana se respeta salvo en los marcados');

  // ¿qué se dejó fuera, en detalle?
  if (tp === 'carritos') {
    var porMotivo = {};
    r.fuera.forEach(function (x) { var m = x.motivo_exclusion.split('(')[0].trim(); porMotivo[m] = (porMotivo[m] || 0) + 1; });
    console.log('\n     lo que quedó fuera, por motivo:');
    Object.keys(porMotivo).sort(function (a, b) { return porMotivo[b] - porMotivo[a]; }).forEach(function (m) {
      console.log('        ' + String(mil(porMotivo[m])).padStart(5) + '  ' + m.slice(0, 66));
    });
    var antes = r.fuera.filter(function (x) { return /anterior a la activación/.test(x.motivo_exclusion); });
    if (antes.length) {
      console.log('\n     los que llegaron ANTES de que el link existiera (top por días):');
      antes.sort(function (a, b) { return b.dias_antes - a.dias_antes; }).slice(0, 6).forEach(function (x) {
        console.log('        ' + x.fecha + '  ' + x.shortlink_code + '  activado ' + x.activacion +
          '  → ' + x.dias_antes + 'd antes   ' + (x.utm_campaign || '').slice(0, 22));
      });
    }
  }
});

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ el filtro deja entrar solo lo nuestro, y lo demás sale con su motivo'));
process.exit(fallo ? 1 : 0);
