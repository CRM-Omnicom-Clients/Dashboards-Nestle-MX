// A3 · «ESPRESSO CON» NO EXISTE: las piezas son de HACKEA TU CAFÉ, marca CONCENTRATE.
//
// 🔴 EL ERROR QUE REPARA. El handoff de SFMC traía la campaña `Espresso Con*` —con asterisco, o
//    sea lectura del equipo, no dato— y di de alta una campaña nueva Y una marca nueva del mismo
//    nombre. La campaña real ya existía: `Hackea tu café` (007), marca `Concentrate`.
//
// 🔴 Y AL MIRARLO BIEN, ERA MÁS LIMPIO DE LO QUE PARECÍA. Rick dictó 4 touchpoints —E-Hack1,
//    E-Hack2, E-Rit1, E-Rit2— en el orden de sus ContentNames. Los dos primeros **ya estaban en
//    el catálogo** como `007-P001…P004` con el touchpoint `E-A1`/`E-A2`: no hay que darlos de
//    alta, hay que **renombrarles el touchpoint**. Solo los dos de `E-Rit` se mudan desde la
//    campaña inventada.
//
// 🔴 SON 4 TOUCHPOINTS Y 7 CORREOS. Cada touchpoint tiene su Principal y su Follow Up —así modela
//    el catálogo, y así están ya AON y el resto de 007— menos `E-Rit2`, que no tiene FUP en la DE.
//    Contar 4 piezas y dejar fuera los 3 FUP habría perdido 85,622 envíos.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var V = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/A5-vocabulario.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// 🔴 el destino de cada correo, anclado por EmailID (que es lo que no cambia). El touchpoint y el
//    objetivo los dictó Rick; la campaña y la marca salen del vocabulario CERRADO, no de mí.
var CAMP = V.canonico('campana', 'Hackea tu café');
var MARCA = V.canonico('marca', 'Concentrate');
var BU = V.canonico('bu', 'Nescafé');
var OBJ_AW = V.canonico('objetivo', 'Awareness');
var OBJ_PU = V.canonico('objetivo', 'Purchase');

var RENOMBRAR = [   // ya están en 007: solo cambia el touchpoint
  { eid: '84253', tp: 'E-Hack1', obj: OBJ_AW },
  { eid: '84319', tp: 'E-Hack1', obj: OBJ_AW },
  { eid: '84372', tp: 'E-Hack2', obj: OBJ_AW },
  { eid: '84377', tp: 'E-Hack2', obj: OBJ_AW }
];
var MUDAR = [       // están en la campaña inventada: se mudan a 007
  { eid: '84742', tp: 'E-Rit1', obj: OBJ_PU },
  { eid: '84747', tp: 'E-Rit1', obj: OBJ_PU },
  { eid: '84984', tp: 'E-Rit2', obj: OBJ_PU }
];

console.log('════════ A3 · ESPRESSO CON → HACKEA TU CAFÉ ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
// 🔴 lo primero: que el destino exista en el vocabulario. Si no, no se toca nada.
V.exigir({ campana: CAMP, marca: MARCA, bu: BU, objetivo: OBJ_AW }, 'A3');
V.exigir({ objetivo: OBJ_PU }, 'A3');
console.log('  vocabulario ✔  campaña «' + CAMP + '» · marca «' + MARCA + '» · BU «' + BU + '»\n');

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_a3w.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var IDS = ['catalogo.pieza_id', 'catalogo.campana', 'catalogo.marca', 'catalogo.bu', 'catalogo.touchpoint',
  'catalogo.objetivo', 'catalogo.emailid', 'catalogo.email_type', 'catalogo.estado', 'catalogo.notas'];
h.exigir(IDS, 'A3');
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

// el siguiente id libre de 007
var sig = 0;
P.forEach(function (p) { var m = /^007-P(\d+)$/.exec(t(p[N('pieza_id')])); if (m) sig = Math.max(sig, +m[1]); });

function buscarPorEid(eid) {
  var out = -1;
  P.forEach(function (p, i) {
    t(p[N('emailid')]).split(/\s*,\s*/).forEach(function (e) { if (t(e) === eid) out = i; });
  });
  return out;
}

var cambios = [], problemas = [];
console.log('══ 1 · los que YA están en 007: solo cambia el touchpoint ══');
RENOMBRAR.forEach(function (x) {
  var i = buscarPorEid(x.eid);
  if (i < 0) { problemas.push('EmailID ' + x.eid + ' no está en el catálogo'); return; }
  var p = P[i], fila = i + 2;
  if (t(p[N('campana')]) !== CAMP) { problemas.push(t(p[N('pieza_id')]) + ' no está en ' + CAMP + ' sino en «' + t(p[N('campana')]) + '»'); return; }
  var c = {};
  if (t(p[N('touchpoint')]) !== x.tp) c[N('touchpoint')] = x.tp;
  if (t(p[N('objetivo')]) !== x.obj) c[N('objetivo')] = x.obj;
  if (!Object.keys(c).length) { console.log('   ○ ' + t(p[N('pieza_id')]) + ' ya estaba bien'); return; }
  cambios.push({ fila: fila, pieza: t(p[N('pieza_id')]), pares: c, eid: x.eid });
  console.log('   ✔ ' + t(p[N('pieza_id')]).padEnd(10) + 'eid ' + x.eid + '  tp «' + t(p[N('touchpoint')]) + '» → «' + x.tp +
    '»  tipo=' + t(p[N('email_type')]));
});

console.log('\n══ 2 · los que se MUDAN desde la campaña inventada ══');
MUDAR.forEach(function (x) {
  var i = buscarPorEid(x.eid);
  if (i < 0) { problemas.push('EmailID ' + x.eid + ' no está en el catálogo'); return; }
  var p = P[i], fila = i + 2;
  sig++;
  var nuevoId = '007-P' + String(sig).padStart(3, '0');
  var c = {};
  c[N('pieza_id')] = nuevoId;
  c[N('campana')] = CAMP; c[N('marca')] = MARCA; c[N('bu')] = BU;
  c[N('touchpoint')] = x.tp; c[N('objetivo')] = x.obj;
  var nota = t(p[N('notas')]).replace(/dimensiones inferidas[^·]*·?\s*/i, '');
  c[N('notas')] = (nota ? nota + ' · ' : '') + 'era ' + t(p[N('pieza_id')]) + ' de la campaña «Espresso Con», que NUNCA existió (inventada 21-ago desde un valor inferido del handoff). Touchpoint y objetivo dictados por Rick.';
  c[N('estado')] = '⚠ Por confirmar (segmento)';
  cambios.push({ fila: fila, pieza: t(p[N('pieza_id')]), pares: c, eid: x.eid, nuevoId: nuevoId });
  console.log('   ✔ ' + t(p[N('pieza_id')]).padEnd(10) + '→ ' + nuevoId.padEnd(10) + 'eid ' + x.eid + '  tp «' + t(p[N('touchpoint')]) +
    '» → «' + x.tp + '»  tipo=' + t(p[N('email_type')]) + '  obj=' + x.obj);
});

if (problemas.length) { console.log('\n  🔴 ' + problemas.length + ' problema(s):'); problemas.forEach(function (p) { console.log('     · ' + p); }); }
console.log('\n  celdas a cambiar en ' + cambios.length + ' fila(s)');
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(problemas.length ? 1 : 0); }
if (problemas.length) { console.log('\n  🔴 con problemas abiertos no se escribe.'); process.exit(1); }

// 🔴 ESTE PASO YA NO ESCRIBE: APUNTA. La doctrina dice una sola apertura del Excel por puerta, y
//    cinco pasos de catálogo escribiendo por su cuenta eran cinco aperturas, cinco cadenas de
//    validación y cinco respaldos. Además, a mitad del plan el archivo se puso EBUSY y lo ya
//    escrito quedó a medias. Ahora todo se acumula y un solo escritor lo aplica de una pasada.
cambios.forEach(function (c) {
  Object.keys(c.pares).forEach(function (col) {
    CB.apuntar('A3', 'Catalogo_Piezas', c.fila, col, c.pares[col],
      'A3 · «Espresso Con» nunca existió: la campaña es Hackea tu café, marca Concentrate. Touchpoint y objetivo dictados por Rick el 21-ago.');
  });
});
var nCeldas = cambios.reduce(function (a, c) { return a + Object.keys(c.pares).length; }, 0);
console.log('\n  ── apuntados ' + nCeldas + ' cambio(s) en ' + cambios.length + ' fila(s). NO se tocó el archivo.');
console.log('     los aplicará el escritor único: node escritor.escribir-todo.js --escribir');