// A6b · QUITAR DEL CATÁLOGO LOS CÓDIGOS QUE LA AUTORIDAD NO DECLARA.
//
// 🔴 EL MISMO ERROR, EN OTRA COLUMNA. Ayer registré 8 shortlinks en el catálogo porque tenían
//    tráfico de `crm-hive`, razonando que eso probaba que eran nuestros. Hoy reverti esa misma
//    lógica en el filtro (A1) porque la regla de Rick es otra: **la autoridad de links es
//    `Qcart-Links Mails-Hive-MX.xlsx`**, y lo que no está ahí no es nuestro o todavía no cuenta.
//    Dejar los 8 en el catálogo sería aplicar dos criterios distintos a la misma pregunta.
//
// ⚠ Los que Rick SÍ dictó a mano (los 4 de Liga MX por región) NO se tocan: esos vienen de él,
//   no del tráfico. El paso distingue una cosa de la otra por la lista explícita.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

// 🔴 los que Rick dictó: vienen de él, no del tráfico. Se quedan.
var DICTADOS = ['i8LZ55bd', 'HThaf6bT', '4tBsCXTp', 'hTHNLqzL'];

console.log('════════ A6b · CÓDIGOS QUE LA AUTORIDAD NO DECLARA ════════\n');
// 🔴 21-ago · SE RE-CORRE CONTRA EL PADRÓN FRESCO. La primera vez decidí contra un padrón que no
//    tenía las hojas Agosto ni Septiembre —el equipo las agregó después— y retiré 8 códigos, de
//    los que 4 SÍ estaban declarados. Lo apuntado se descarta y se vuelve a decidir de cero:
//    corregir encima de una decisión mala arrastra la mala.
var borrados = CB.descartarNodo('A6b');
if (borrados) console.log('  ↺ se descartaron ' + borrados + ' cambio(s) que A6b había apuntado contra el padrón viejo\n');
var A = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8'));
var enPadron = {};
Object.keys(A.links_validos || {}).forEach(function (c) { enPadron[c] = 'con fecha'; });
(A.links_invalidos || []).forEach(function (x) { enPadron[t(x.codigo)] = 'sin fecha'; });
console.log('  la autoridad conoce ' + Object.keys(enPadron).length + ' códigos\n');

var C = os.homedir() + '/_a6b.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

// 🔴 los cambios ya apuntados por A2 cuentan: si A2 va a poner un código, no se puede evaluar la
//    celda como está hoy. Se lee el estado FUTURO de cada celda, no el actual.
var pend = CB.cargar().cambios.filter(function (x) { return x.hoja === 'Catalogo_Piezas'; });
function valorFuturo(fila, col, actual) {
  var ult = pend.filter(function (x) { return x.fila === fila && x.columna === col; }).pop();
  return ult ? t(ult.valor) : t(actual);
}

var quitados = 0, revisadas = 0;
P.forEach(function (p, i) {
  var fila = i + 2, id = t(p[N('pieza_id')]);
  for (var s = 1; s <= 5; s++) {
    ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
      var col = pre + s;
      if (enc.indexOf(col) < 0) return;
      var val = valorFuturo(fila, col, p[col]);
      if (!val) return;
      revisadas++;
      var cods = Q.codigosDe(val);
      var fuera = cods.filter(function (c) { return !enPadron[c] && DICTADOS.indexOf(c) < 0; });
      if (!fuera.length) return;
      var quedan = cods.filter(function (c) { return fuera.indexOf(c) < 0; });
      console.log('   − ' + id.padEnd(10) + col.padEnd(16) + 'quita ' + fuera.join(', ').padEnd(22) +
        (quedan.length ? 'queda ' + quedan.join(', ') : '(vacía)'));
      // 🔴 apuntarSobre, no apuntar: este paso LEE el estado futuro (valorFuturo) y refina lo
      //    que otro paso dejo a medias. Un choque son dos pasos que no se hablaron; esto es uno
      //    que si leyo al otro. La diferencia queda declarada en el propio cambio.
      CB.apuntarSobre('A6b', 'Catalogo_Piezas', fila, col, quedan.join('; '),
        'A6b · ' + fuera.join(', ') + ' no está en «Qcart-Links Mails-Hive-MX.xlsx». Lo registré desde el tráfico de crm-hive, que es la misma lógica que A1 revirtió: la autoridad de links es ese archivo, no el tráfico.');
      quitados += fuera.length;
    });
  }
});
console.log('\n  celdas revisadas: ' + revisadas + '   ·   códigos quitados: ' + quitados);
console.log('  (los 4 que dictó Rick se conservan: ' + DICTADOS.join(', ') + ')');
var res = CB.resumen();
console.log('\n  ── acumulado: ' + res.total + ' celda(s)   ·   choques: ' + res.choques);
Object.keys(res.por_nodo).sort().forEach(function (n) { console.log('     ' + n.padEnd(8) + res.por_nodo[n]); });
console.log('\n  NO se tocó el archivo.');
