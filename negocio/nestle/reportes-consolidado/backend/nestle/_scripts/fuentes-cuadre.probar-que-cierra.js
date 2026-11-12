// PUERTA-2 · ¿LA PUERTA 2 SE PUEDE CERRAR? Con datos sanos siempre da verde, y un verde constante no
// prueba nada. Aquí se ROMPE la rejilla a propósito, un motivo a la vez, y se comprueba dos cosas:
// que cierra, y que VUELVE A ABRIR al deshacer el daño. Lo segundo importa tanto como lo primero:
// una puerta que se queda cerrada tampoco sirve.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var D = require('path').resolve(__dirname, '..') + '/_scripts';
var REJ = require('path').resolve(__dirname, '..') + '/_rejilla/rejilla.json';
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

function puerta() {
  try { cp.execSync('"' + process.execPath + '" fuentes-cuadre.puerta2.js', { cwd: D, encoding: 'utf8', timeout: 300000 }); return { abierta: true, out: '' }; }
  catch (e) { return { abierta: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
// ⚠ la línea de resumen («PUERTA CERRADA — N motivo(s)») también empieza por el emoji, y se
//   colaba como si fuera un motivo. Un parser que confunde el titular con el contenido hace
//   fallar la prueba por un motivo que sí estaba, solo que en segunda posición.
function motivos(out) {
  return String(out).split('\n')
    .filter(function (l) { return /^\s+🔴 /.test(l) && !/PUERTA CERRADA/.test(l); })
    .map(function (l) { return l.trim().slice(2).trim(); });
}

console.log('════════ ¿LA PUERTA 2 CIERRA? ════════\n');
var original = fs.readFileSync(REJ, 'utf8');
var base = puerta();
chk('con los datos de hoy la puerta está ABIERTA', base.abierta, base.abierta ? 'punto de partida sano' : '🔴 ya estaba cerrada: no se puede probar nada');
if (!base.abierta) { console.log('  🔴 la puerta ya está cerrada — arregla eso antes de probar'); process.exit(1); }

var DANOS = [
  {
    nom: 'el motor INVENTA envíos',
    romper: function (R) { R.rejilla[0].total.sends += 999999; return R; },
    espera: /INVENT/i
  },
  {
    nom: 'el motor PIERDE envíos sin explicarlo',
    romper: function (R) { R.rejilla[0].total.sends = Math.max(0, R.rejilla[0].total.sends - 500000); return R; },
    espera: /perdi|no coincide/i
  },
  {
    nom: 'el Qcart de un mes aparece en DOS quincenas',
    romper: function (R) {
      var conQ = R.rejilla.filter(function (c) { return c.qcart; })[0];
      var otra = R.rejilla.filter(function (c) { return c.campana === conQ.campana && !c.qcart; })[0] || R.rejilla[1];
      otra.qcart = JSON.parse(JSON.stringify(conQ.qcart));
      return R;
    },
    // al duplicar el Qcart en la rejilla saltan DOS bloqueos legítimos: el descuadre contra la
    // hoja (que ya no tiene esos carritos) y el doble conteo. Cualquiera de los dos prueba que
    // la puerta lo caza; exigir uno concreto sería exigir un orden que no importa.
    espera: /dos veces|más de una quincena|Carritos_Total/i
  },
  {
    nom: 'la rejilla declara más celdas de las que tiene',
    romper: function (R) { R.auditoria.celdas = R.rejilla.length + 5; return R; },
    espera: /dice una cosa y contiene otra/i
  },
  {
    nom: 'se calcula un CTOR sobre clicks NO medidos',
    romper: function (R) {
      var x = R.por_registro.whatsapp.filter(function (y) { return y.CTOR_no_calculable; })[0];
      if (x) x.CTOR = 0.12;
      return R;
    },
    espera: /no est[áa]n medidos/i
  }
];

DANOS.forEach(function (d) {
  var R = JSON.parse(original);
  fs.writeFileSync(REJ, JSON.stringify(d.romper(R), null, 1));
  var r = puerta();
  var ms = motivos(r.out);
  var cazado = ms.some(function (m) { return d.espera.test(m); });
  chk('cierra cuando ' + d.nom, !r.abierta && cazado,
    r.abierta ? '🔴 NO cerró' : (cazado ? 'cerró por: ' + (ms.filter(function (m) { return d.espera.test(m); })[0] || '').slice(0, 54)
      : '🔴 cerró, pero por otro motivo: ' + (ms[0] || '?').slice(0, 50)));
  fs.writeFileSync(REJ, original);
});

var vuelta = puerta();
chk('🔴 VUELVE A ABRIR al deshacer el daño', vuelta.abierta,
  vuelta.abierta ? 'la rejilla original pasa igual que al principio' : '🔴 quedó cerrada: la puerta no se recupera');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s): la puerta no vigila lo que dice vigilar'
  : '✅ LA PUERTA CIERRA por los ' + DANOS.length + ' motivos, y vuelve a abrir'));
process.exit(fallo ? 1 : 0);
