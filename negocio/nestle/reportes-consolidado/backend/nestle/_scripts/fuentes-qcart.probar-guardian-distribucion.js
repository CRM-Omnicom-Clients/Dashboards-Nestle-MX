// fuentes-qcart · LE PLANTA AL GUARDIÁN LOS TRES CASOS QUE PREOCUPAN A RICK Y EXIGE QUE BLOQUEE.
//
// 🔴 POR QUÉ ESTO EXISTE. Un guardián en verde no prueba que mire — prueba que no encontró nada,
//    que es otra cosa. La única forma de saber que sirve es plantarle el defecto y ver si lo
//    para. Así se descubrió que la guarda del congelado no reconocía `execFileSync(` y salía
//    verde con el señuelo delante.
//
// 🔴 LOS TRES CASOS SON, LITERALMENTE, LOS QUE RICK PREGUNTÓ:
//    1 · una celda BAJA de carritos            → «que nada baja»
//    2 · una celda DESAPARECE                  → «que no se quita»
//    3 · carritos se MUEVEN entre quincenas    → «que no moverás eso»
//        (y este es el importante: la suma NO cambia, así que ninguna puerta lo ve)
//
// Trabaja sobre una COPIA de la rejilla y la restaura al terminar. El Excel no se toca.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var RJ = BACK + '/_rejilla/rejilla.json';
var GUARDIAN = BACK + '/_scripts/fuentes-qcart.guardian-distribucion.js';
var SANO = RJ + '.sano-prueba';
// el señuelo 4 declara un movimiento, y una declaración vive en la base → hay que respaldarla
// también, y restaurarla pase lo que pase. Sin esto una corrida abortada dejaría una declaración
// de prueba dentro del contrato real, que es peor que no probar.
var BASE = BACK + '/_contratos/qcart-distribucion-base.json';
var BASE_SANA = BASE + '.sana-prueba';

// 🔴 LA SALIDA SE CAPTURA EN LOS DOS CAMINOS (29-sep-2026). Devolvía `salida: ''` cuando el
//    guardián NO bloqueaba, y con eso no se puede comprobar nada de lo que dice cuando deja pasar
//    — que es justo lo que el señuelo 4 necesita leer. Un probador que solo sabe mirar el camino
//    del fallo solo puede probar la mitad del guardián.
function correGuardian() {
  try {
    var out = cp.execFileSync(process.execPath, [GUARDIAN], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { bloqueo: false, salida: String(out || '') };
  } catch (e) { return { bloqueo: true, salida: String(e.stdout || '') }; }
}

// mueve carritos de una quincena a otra dentro del mismo campaña×tp×segmento. Devuelve las dos
// claves con la forma EXACTA que usa el guardián, para poder declarar el movimiento.
function moverDeQuincena(R) {
  var porCombo = {};
  R.rejilla.forEach(function (c) {
    var k = c.campana + '¦' + c.touchpoint + '¦' + c.segmento;
    (porCombo[k] = porCombo[k] || []).push(c);
  });
  var par = null;
  Object.keys(porCombo).forEach(function (k) {
    if (par) return;
    var conQ = porCombo[k].filter(function (c) { return c.qcart && c.qcart.carritos > 0; });
    var sinQ = porCombo[k].filter(function (c) { return !c.qcart || !c.qcart.carritos; });
    if (conQ.length && sinQ.length) par = { de: conQ[0], a: sinQ[0] };
  });
  if (!par) return null;
  var n = par.de.qcart.carritos;
  var tt = function (v) { return String(v == null ? '' : v).trim(); };
  var clave = function (c) { return [tt(c.campana), tt(c.touchpoint), tt(c.segmento), tt(c.quincena)].join(' ¦ '); };
  var kDe = clave(par.de), kA = clave(par.a);
  par.a.qcart = JSON.parse(JSON.stringify(par.de.qcart));
  par.de.qcart = null;
  return {
    n: n, kDe: kDe, kA: kA,
    detalle: n + ' carritos de ' + par.de.campana + ' · ' + par.de.touchpoint + ' · ' + par.de.segmento +
      '   ' + par.de.quincena + ' → ' + par.a.quincena + '   (la suma NO cambia)'
  };
}
function conCarritos(R) { return R.rejilla.filter(function (c) { return c.qcart && c.qcart.carritos > 0; }); }

console.log('════════ ¿EL GUARDIÁN DE LA DISTRIBUCIÓN MIRA DE VERDAD? ════════\n');
fs.copyFileSync(RJ, SANO);

var CASOS = [
  {
    nombre: '1 · una celda BAJA de carritos',
    pregunta: '«que todo incrementa, nada baja»',
    plantar: function (R) {
      var c = conCarritos(R)[0];
      var antes = c.qcart.carritos;
      c.qcart.carritos = Math.max(1, Math.floor(antes / 2));
      return c.campana + ' · ' + c.touchpoint + ' · ' + c.segmento + ' · ' + c.quincena +
        '   ' + antes + ' → ' + c.qcart.carritos;
    }
  },
  {
    nombre: '2 · una celda DESAPARECE',
    pregunta: '«que no se quita de lo que ya hemos trabajado»',
    plantar: function (R) {
      var c = conCarritos(R)[1];
      var antes = c.qcart.carritos;
      c.qcart = null;
      return c.campana + ' · ' + c.touchpoint + ' · ' + c.segmento + ' · ' + c.quincena + '   tenía ' + antes + ', ahora ninguno';
    }
  },
  {
    nombre: '3 · carritos que se MUEVEN de quincena',
    pregunta: '«que no moverás eso» — Σ NO cambia, ninguna puerta lo ve',
    plantar: function (R) {
      var m = moverDeQuincena(R);
      return m ? m.detalle : null;
    }
  },
  {
    // 🔴 EL SEÑUELO QUE FALTABA, Y ES EL QUE ENCUENTRA LO QUE LOS OTROS TRES NO PUEDEN
    //    (29-sep-2026). Los tres de arriba comprueban que el guardián BLOQUEE. Ninguno comprueba
    //    que DEJE PASAR un movimiento declarado — y esa rama llevaba semanas muerta: el guardián
    //    buscaba las declaraciones en `_contratos/qcart-movimientos.json`, un archivo que **ningún
    //    script escribe**, mientras el re-basador las escribía DENTRO de la base. La lectura iba en
    //    `try{}catch{}`, así que el archivo ausente dejaba `movs = {}` en silencio y la rama no
    //    podía dispararse nunca. En verde, las tres suites pasando, y media guarda sin existir.
    //    Con este señuelo, ese defecto sale a la primera: plantado el MISMO movimiento del caso 3
    //    y declarado en la base, si el lector está roto sigue bloqueando y el caso falla.
    nombre: '4 · un movimiento DECLARADO en la base — debe DEJARLO PASAR',
    pregunta: 'la otra mitad: un guardián que no sabe reconocer una declaración solo sabe decir no',
    espera: 'pasa',
    plantar: function (R) {
      var m = moverDeQuincena(R);
      if (!m) return null;
      // la declaración va donde el re-basador la escribe: `movimientos` dentro de la propia base
      var b = JSON.parse(fs.readFileSync(BASE, 'utf8'));
      b.movimientos = (b.movimientos || []).concat([{ de: m.kDe, a: m.kA, carritos: m.n, motivo: 'señuelo 4 del probador' }]);
      fs.writeFileSync(BASE, JSON.stringify(b, null, 1));
      return m.detalle + '   · DECLARADO en ' + require('path').basename(BASE);
    },
    // la marca de que de verdad lo reconoció, no de que simplemente no vio nada
    huella: /movimiento\(s\) declarado\(s\)|declarad/i
  }
];

var pasaron = 0, fallaron = [];
fs.copyFileSync(BASE, BASE_SANA);
try {
  CASOS.forEach(function (caso) {
    fs.copyFileSync(SANO, RJ);
    fs.copyFileSync(BASE_SANA, BASE);            // cada caso arranca de la base intacta
    var R = JSON.parse(fs.readFileSync(RJ, 'utf8'));
    var detalle = caso.plantar(R);
    if (detalle === null) { console.log('  ⊘ ' + caso.nombre + ' — no encontré dónde plantarlo. NO cuenta como pasar.'); fallaron.push(caso.nombre + ' (no se pudo plantar)'); return; }
    fs.writeFileSync(RJ, JSON.stringify(R, null, 1));
    var r = correGuardian();
    var esperaPasa = caso.espera === 'pasa';
    // 🔴 «NO BLOQUEÓ» NO ES «LO RECONOCIÓ». Un caso que espera paso exige además la huella de que
    //    el guardián vio la declaración: sin eso, un guardián que se cayera antes de comparar
    //    también «pasaría», y el señuelo diría verde por la razón contraria.
    var huella = !caso.huella || caso.huella.test(r.salida);
    var bien = esperaPasa ? (!r.bloqueo && huella) : r.bloqueo;
    var linea = (r.salida.match(/🔴 ninguna celda [^\n]*/g) || []).concat(r.salida.match(/🔴 el total no bajó[^\n]*/g) || [])
      .filter(function (x) { return /🔴/.test(x); })[0] || '';
    var decl = (r.salida.match(/── contra la línea base[^\n]*/) || [])[0] || '';
    console.log('  ' + (bien ? (esperaPasa ? '✔ DEJA PASAR  ' : '✔ BLOQUEA  ')
      : (esperaPasa ? (r.bloqueo ? '🔴 BLOQUEÓ lo declarado  ' : '🔴 pasó pero SIN reconocerlo  ') : '🔴 NO LO VIO  ')) + caso.nombre);
    console.log('       ' + caso.pregunta);
    console.log('       plantado: ' + detalle);
    if (r.bloqueo && linea) console.log('       lo dijo así: ' + linea.trim().slice(0, 120));
    if (esperaPasa && decl) console.log('       lo dijo así: ' + decl.trim().slice(0, 130));
    if (bien) pasaron++; else fallaron.push(caso.nombre);
  });
} finally {
  fs.copyFileSync(BASE_SANA, BASE);
  fs.unlinkSync(BASE_SANA);
}

fs.copyFileSync(SANO, RJ);
fs.unlinkSync(SANO);
var v = correGuardian();
console.log('\n  ── rejilla restaurada · el guardián vuelve a ' + (v.bloqueo ? '🔴 ROJO (mal)' : '✔ verde'));

console.log('\n════ VEREDICTO ════');
console.log('  ' + (fallaron.length || v.bloqueo
  ? '🔴 el guardián NO sirve: ' + (fallaron.length ? 'falló en ' + fallaron.join(' · ') : 'no vuelve a verde')
  : '✅ LOS ' + pasaron + '/' + CASOS.length + ' CASOS SALEN COMO DEBEN (3 lo paran, 1 lo deja pasar reconociendolo), y con la rejilla sana vuelve a verde'));
process.exit((fallaron.length || v.bloqueo) ? 1 : 0);
