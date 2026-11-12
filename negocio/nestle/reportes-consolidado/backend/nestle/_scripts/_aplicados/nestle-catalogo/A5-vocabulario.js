// A5 · EL VOCABULARIO ES CERRADO — campañas, marcas, BU y objetivos.
//
// 🔴 POR QUÉ EXISTE, y es mi propio error. El handoff de SFMC traía la campaña «Espresso Con»
//    marcada con `*` —lectura del equipo, no dato— y yo **di de alta una campaña nueva**, con una
//    marca nueva del mismo nombre. Ninguna validación chistó: el sistema cuida las CANTIDADES con
//    seis guardianes y estaba ciego ante un NOMBRE nuevo. La campaña real era `Hackea tu café`,
//    marca `Concentrate`, y ya existía.
//
// 🔴 LA REGLA: campaña, marca, BU y objetivo son conjuntos CERRADOS. Ningún paso puede introducir
//    un valor que no esté declarado aquí — ni aunque la fuente lo sugiera, ni aunque el nombre sea
//    obvio. Si aparece uno nuevo, **se para y se pregunta**. Ampliar el vocabulario es una
//    decisión de Rick, y por eso este archivo se edita a mano, no se regenera.
//
// Uso:  var V = require('./A5-vocabulario.js');
//       V.exigir({ campana: 'Hackea tu café', marca: 'Concentrate' }, 'S1-altas');  // truena si no
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var RUTA = BACK + '/_contratos/vocabulario.json';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

function cargar() {
  if (!fs.existsSync(RUTA)) throw new Error('🔴 VOCABULARIO · no existe ' + RUTA + '. Córrelo con --sembrar.');
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}

/**
 * 🔴 TRUENA si un valor no está en el conjunto cerrado. Nunca devuelve «no pasa nada».
 * @param dims  { campana, marca, bu, objetivo } — los que vengan; los ausentes no se revisan
 * @param quien quién lo pide, para que el error diga de dónde salió
 */
function exigir(dims, quien) {
  // 🔴 UN GUARDIÁN QUE PASA CON UN ARGUMENTO MALFORMADO SE PUEDE SALTAR POR ACCIDENTE. Llamarlo
  //    con una cadena, con `null` o con un objeto vacío no revisaba NADA y devolvía «true»: el
  //    paso seguía tan tranquilo creyendo que había validado. Si no hay nada que revisar, se dice.
  if (!dims || typeof dims !== 'object' || Array.isArray(dims)) {
    var e0 = new Error('🔴 VOCABULARIO · ' + (quien ? quien + ': ' : '') +
      'se llamó a exigir() sin un objeto de dimensiones (llegó ' + (dims === null ? 'null' : typeof dims) + ').\n' +
      '   Se esperaba { campana, marca, bu, objetivo }. No se valida nada y no se sigue.');
    e0.vocabulario = true; throw e0;
  }
  var reconocidos = ['campana', 'marca', 'bu', 'objetivo'].filter(function (k) { return t(dims[k]); });
  if (!reconocidos.length) {
    var e1 = new Error('🔴 VOCABULARIO · ' + (quien ? quien + ': ' : '') +
      'ninguna de las dimensiones que se pueden validar viene con valor.\n' +
      '   Llegó: ' + JSON.stringify(dims).slice(0, 120) + '\n' +
      '   Se esperaba al menos una de: campana · marca · bu · objetivo.');
    e1.vocabulario = true; throw e1;
  }
  var V = cargar(), malos = [];
  [['campana', 'campañas'], ['marca', 'marcas'], ['bu', 'bu'], ['objetivo', 'objetivos']].forEach(function (p) {
    var val = t(dims[p[0]]);
    if (!val) return;
    var set = V[p[1]] || [];
    if (!set.some(function (x) { return nmz(x) === nmz(val); })) {
      // ¿se parece a alguno? ayuda a ver si es un typo o algo genuinamente nuevo
      var cerca = set.filter(function (x) { return nmz(x).indexOf(nmz(val).slice(0, 5)) >= 0 || nmz(val).indexOf(nmz(x).slice(0, 5)) >= 0; });
      malos.push({ campo: p[0], valor: val, parecidos: cerca.slice(0, 3) });
    }
  });
  if (malos.length) {
    var m = '🔴 VOCABULARIO CERRADO · ' + (quien ? quien + ': ' : '') + malos.length + ' valor(es) que NO existen:\n';
    malos.forEach(function (x) {
      m += '     · ' + x.campo + ' = «' + x.valor + '»' +
        (x.parecidos.length ? '   ¿querías decir ' + x.parecidos.map(function (p2) { return '«' + p2 + '»'; }).join(' o ') + '?' : '   (no se parece a ninguno)') + '\n';
    });
    m += '   No se escribe nada. Ampliar el vocabulario es decisión de Rick:\n';
    m += '   edita ' + RUTA + ' a mano y vuelve a correr.';
    var e = new Error(m); e.vocabulario = true; throw e;
  }
  return true;
}

/** ¿está? sin tronar — para los pasos que quieren decidir en vez de fallar */
function tiene(campo, valor) {
  var V = cargar();
  var mapa = { campana: 'campañas', marca: 'marcas', bu: 'bu', objetivo: 'objetivos' };
  return (V[mapa[campo]] || []).some(function (x) { return nmz(x) === nmz(valor); });
}

/**
 * 🔴 LA FORMA CANÓNICA — la que SE ESCRIBE. El emparejamiento ignora acentos y mayúsculas a
 *    propósito (`Hackea tu cafe` tiene que reconocerse como `Hackea tu café`), pero escribir la
 *    versión sin acento metería una segunda ortografía del mismo valor en el catálogo, y a partir
 *    de ahí los dos conviven sin que nada los una. Todo paso que escriba una dimensión pasa por
 *    aquí: se acepta lo parecido, se guarda lo declarado.
 */
function canonico(campo, valor) {
  var V = cargar();
  var mapa = { campana: 'campañas', marca: 'marcas', bu: 'bu', objetivo: 'objetivos' };
  var hit = (V[mapa[campo]] || []).filter(function (x) { return nmz(x) === nmz(valor); })[0];
  if (hit === undefined) { exigir((function () { var d = {}; d[campo] = valor; return d; })(), 'canonico'); }
  return hit;
}

module.exports = { exigir: exigir, tiene: tiene, canonico: canonico, cargar: cargar, RUTA: RUTA, nmz: nmz };

// ── corrido directo: siembra o audita
if (require.main === module) {
  var XLSX = require('xlsx');
  var L = require(BACK + '/_scripts/lib-flexible.js');
  var R = require(BACK + '/_scripts/lib-registro.js');
  var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
  var C = os.homedir() + '/_a5.xlsx';
  fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
  var wb = XLSX.readFile(C);
  var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
  var h = R.abrir('catalogo', enc, { silencioso: true });
  var N = function (k) { return h.n('catalogo.' + k); };
  var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

  // 🔴 lo que el catálogo usa HOY, con cuántas piezas lo respaldan. Un valor con UNA sola pieza
  //    es sospechoso: así entró «Espresso Con».
  function inventario(campo) {
    var g = {};
    P.forEach(function (p) { var v = t(p[N(campo)]); if (v) (g[v] = g[v] || []).push(t(p[N('pieza_id')])); });
    return g;
  }
  console.log('════════ A5 · VOCABULARIO ' + (process.argv.indexOf('--sembrar') >= 0 ? '🔴 SIEMBRA' : '(auditoría)') + ' ════════\n');
  ['campana', 'marca', 'bu', 'objetivo'].forEach(function (c) {
    var g = inventario(c);
    console.log('  ── ' + c + ': ' + Object.keys(g).length + ' valores');
    Object.keys(g).sort(function (a, b) { return g[b].length - g[a].length; }).forEach(function (k) {
      console.log('     ' + String(g[k].length).padStart(4) + '  ' + k.padEnd(30) + (g[k].length <= 3 ? '⚠ solo ' + g[k].join(', ') : ''));
    });
    console.log('');
  });
  if (process.argv.indexOf('--sembrar') < 0) {
    if (fs.existsSync(RUTA)) {
      var V = cargar();
      console.log('  ── el vocabulario declarado');
      Object.keys(V).forEach(function (k) { if (Array.isArray(V[k])) console.log('     ' + k.padEnd(12) + V[k].length + ': ' + V[k].join(' · ')); });
      // lo que el catálogo usa y el vocabulario no declara
      var fuera = [];
      [['campana', 'campañas'], ['marca', 'marcas'], ['bu', 'bu'], ['objetivo', 'objetivos']].forEach(function (p) {
        Object.keys(inventario(p[0])).forEach(function (v) {
          if (!(V[p[1]] || []).some(function (x) { return nmz(x) === nmz(v); })) fuera.push(p[0] + ' = «' + v + '»');
        });
      });
      console.log('\n  ── ' + (fuera.length ? '🔴 el catálogo usa ' + fuera.length + ' valor(es) que el vocabulario NO declara:' : '✔ el catálogo no usa nada fuera del vocabulario'));
      fuera.forEach(function (f) { console.log('     ' + f); });
      process.exit(fuera.length ? 1 : 0);
    }
    console.log('  (no hay vocabulario todavía. Para crearlo: --sembrar)');
    process.exit(0);
  }
  console.log('  🔴 la siembra NO se hace sola: este archivo se escribe a mano, revisando la lista de arriba.');
  console.log('     Se genera una PROPUESTA en _contratos/vocabulario-propuesta.json para que Rick la revise.');
  var prop = {
    paso: 'A5', regla: 'conjunto CERRADO. Ningún paso puede introducir un valor nuevo; ampliarlo es decisión de Rick.',
    revisado_por: '(pendiente)', fecha: '(pendiente)',
    campañas: Object.keys(inventario('campana')).sort(),
    marcas: Object.keys(inventario('marca')).sort(),
    bu: Object.keys(inventario('bu')).sort(),
    objetivos: Object.keys(inventario('objetivo')).sort()
  };
  fs.writeFileSync(BACK + '/_contratos/vocabulario-propuesta.json', JSON.stringify(prop, null, 1));
  console.log('     → _contratos/vocabulario-propuesta.json');
}
