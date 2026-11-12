/*
 * fuentes-qcart.reanclar-huerfanos.js — le da pieza a los eventos que se quedaron sin ella.
 *
 * POR QUÉ EXISTE. El bloque de Qcart es un APPEND: no vuelve a mirar lo que ya está cargado, y esa
 * es una buena regla —así un evento no cambia de celda a espaldas de nadie—. Pero tiene un costo:
 * un evento que entró ANTES de que su pieza existiera, o bajo una fecha de activación que después
 * se corrigió, se queda huérfano para siempre. Pasó con la Jornada 8: sus 5 carritos entraron el
 * 12-sep, la pieza `005-P012` nació el 14, y nadie los volvió a mirar.
 *
 * 🔴 SOLO TOCA LO QUE NO TIENE PIEZA. Ésa es la garantía de que no puede romper una atribución:
 *    un evento ya atribuido ni se lee. No es una regla de estilo — es la razón por la que esto se
 *    puede correr sin pedir permiso, a diferencia de `--rebuild`, que reconstruye TODO y por eso
 *    su guarda lo bloquea cuando los CSV no cubren el periodo completo.
 *
 * 🔴 Y NO INVENTA LA VENTANA: un huérfano solo se adopta si su fecha cae DENTRO de la activación
 *    vigente de su link. Si quedó fuera, se DECLARA —no se borra—: borrarlo sería decidir por Rick
 *    que ese tráfico no cuenta, y esa decisión es suya.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
var LK = require(__dirname + '/lib-qcart-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;

// ── el catálogo: qué pieza declara cada shortlink ───────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_reanc.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '' });
fs.unlinkSync(tmp);

var NM_ID = COL.de(P, 'Pieza' + '_ID', 'catalogo');
var piezaDe = {};
for (var i = 1; i <= 5; i++) {
  ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    var nm = COL.opcional(P, pre + i);
    if (!nm) return;
    P.forEach(function (p) {
      var v = t(p[nm]); if (!v || TOKEN.test(v)) return;
      v.split(/[,;]/).map(t).forEach(function (c) {
        if (!c || TOKEN.test(c)) return;
        (piezaDe[c] = piezaDe[c] || {})[t(p[NM_ID])] = true;
      });
    });
  });
}

var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

console.log('════════ qcart · RE-ANCLAR LOS HUÉRFANOS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var ADOPTADOS = [], FUERA_VENTANA = [], SIN_DUENO = [], AMBIGUOS = [];

['carritos', 'productos'].forEach(function (tipo) {
  (Q[tipo] || []).forEach(function (e) {
    if (t(e.pieza_id)) return;                       // ya tiene pieza: ni se toca
    var cod = t(e.shortlink_code);
    if (!cod) return;                                // sin ancla: no hay nada que hacer
    var duenos = Object.keys(piezaDe[cod] || {});
    if (!duenos.length) { SIN_DUENO.push({ tipo: tipo, cod: cod, fecha: e.fecha }); return; }
    if (duenos.length > 1) { AMBIGUOS.push({ tipo: tipo, cod: cod, duenos: duenos }); return; }
    var m = MAE.links[cod];
    var act = m ? m.fecha_activacion : null;
    if (act && t(e.fecha) && t(e.fecha) < act) {
      FUERA_VENTANA.push({ tipo: tipo, cod: cod, fecha: e.fecha, activa: act, pieza: duenos[0] });
      return;
    }
    e.pieza_id = duenos[0];
    e.reanclado = 'huérfano adoptado el ' + new Date().toISOString().slice(0, 10) +
      ': entró antes de que su pieza existiera o bajo una activación que después se corrigió';
    ADOPTADOS.push({ tipo: tipo, cod: cod, fecha: e.fecha, pieza: duenos[0] });
  });
});

function grupo(titulo, lista, marca) {
  console.log('  ' + marca + ' ' + titulo.padEnd(46) + lista.length);
  var g = {};
  lista.forEach(function (x) { var k = x.tipo + ' · ' + x.cod + (x.pieza ? ' → ' + x.pieza : '') + (x.activa ? '  (activa ' + x.activa + ')' : ''); g[k] = (g[k] || 0) + 1; });
  Object.keys(g).sort().forEach(function (k) { console.log('        ' + String(g[k]).padStart(4) + '  ' + k); });
}
grupo('ADOPTADOS — su pieza existe y caen en ventana', ADOPTADOS, '✔');
grupo('fuera de la ventana de activación (NO se tocan)', FUERA_VENTANA, '⏸');
grupo('su shortlink no lo declara ninguna pieza', SIN_DUENO, '· ');
grupo('🔴 AMBIGUOS: dos piezas declaran el mismo link', AMBIGUOS, '🔴');

if (!ADOPTADOS.length) { console.log('\n  nada que adoptar.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// 🔴 se comprueba que NADA atribuido cambió, antes de guardar
var antes = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var cambiadas = 0;
['carritos', 'productos'].forEach(function (tipo) {
  (antes[tipo] || []).forEach(function (a, k) {
    var b = Q[tipo][k];
    if (t(a.pieza_id) && t(a.pieza_id) !== t(b.pieza_id)) cambiadas++;
  });
});
if (cambiadas) {
  console.log('\n  🔴 NO SE ESCRIBE: ' + cambiadas + ' evento(s) YA atribuido(s) habrían cambiado de pieza.');
  process.exit(1);
}
console.log('\n  ✔ ningún evento ya atribuido cambió de pieza');

fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(Q, null, 1));
var re = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var sinPieza = ['carritos', 'productos'].reduce(function (s, tp) {
  return s + (re[tp] || []).filter(function (e) { return !t(e.pieza_id) && t(e.shortlink_code); }).length;
}, 0);
console.log('  ✅ ' + ADOPTADOS.length + ' evento(s) adoptados   ·   quedan ' + sinPieza + ' sin pieza (releído del disco)');
