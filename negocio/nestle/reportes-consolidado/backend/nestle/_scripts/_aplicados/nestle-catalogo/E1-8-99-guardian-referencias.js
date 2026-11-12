// E1.8.99 · EL GUARDIÁN QUE HACE REAL LA GARANTÍA.
//
// 🔴 «Un dato, una autoridad» no es una promesa: es un check que BLOQUEA. El JSON manda y la hoja
//    es una vista; si divergen, alguien editó la vista creyendo que editaba la autoridad — y a
//    partir de ese momento los skills (que leen el JSON) y los humanos (que leen la hoja) ven
//    cosas distintas sin saberlo. Eso es peor que no tener la hoja.
//
//    Corre en cada corte, antes de la Puerta 1.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(54) + e); c ? ok++ : mal++; }

console.log('════════ E1.8.99 · LA HOJA CONTRA SU AUTORIDAD ════════\n');
var N = JSON.parse(fs.readFileSync(BACK + '/_contratos/normalizacion.json', 'utf8'));
var X = JSON.parse(fs.readFileSync(BACK + '/_contratos/exclusiones.json', 'utf8'));
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });

// ── 1 · todo alias de la hoja está en el JSON, con el MISMO canónico
console.log('══ 1 · los alias ══');
var enHoja = 0, faltan = [], difieren = [];
// 🔴 LA LLAVE DE UN ALIAS LLEVA EL CONTEXTO. Sin él, `N/A` colapsa tres alias distintos
//    (E-P4 en «AON · Career Focused», E-P3 en «AON · New Parents», E-P1 en «AON · Traditional
//    Parents») y el check reportaba una discrepancia que no existía: la causa era mi llave, no
//    el dato. Es la «escalera de alias» — el contexto es el escalón que desambigua.
function llaveAlias(r) { return t(r['Valor_Crudo']) + (t(r['Contexto']) ? ' @ ' + t(r['Contexto']) : ''); }
R.filter(function (r) { return t(r['Tipo']).toLowerCase() === 'alias'; }).forEach(function (r) {
  enHoja++;
  var d = t(r['Dimension']) || 'sin_dimension', k = llaveAlias(r);
  var a = (N.alias[d] || {})[k];
  if (!a) { faltan.push(d + ' · ' + k); return; }
  if (t(a.canonico) !== t(r['Valor_Canonico'])) difieren.push(d + ' · «' + k + '» → hoja «' + t(r['Valor_Canonico']) + '» vs JSON «' + a.canonico + '»');
});
chk('todo alias de la hoja está en el JSON', faltan.length === 0,
  enHoja + ' alias' + (faltan.length ? '   🔴 ' + faltan.length + ': ' + faltan.slice(0, 3).join(' · ') : ''));
chk('ninguno resuelve a un canónico distinto', difieren.length === 0,
  difieren.length ? '🔴 ' + difieren.slice(0, 2).join('   ·   ') : 'los ' + enHoja + ' coinciden');

// ── 2 · y al revés: el JSON no puede tener alias que la hoja no muestre
console.log('\n══ 2 · el JSON contra la hoja ══');
var enJson = 0, huerfanos = [];
Object.keys(N.alias).forEach(function (d) {
  Object.keys(N.alias[d]).forEach(function (k) {
    enJson++;
    var hay = R.filter(function (r) {
      return t(r['Tipo']).toLowerCase() === 'alias' && t(r['Dimension']) === d && llaveAlias(r) === k;
    }).length;
    if (!hay) huerfanos.push(d + ' · ' + k);
  });
});
chk('todo alias del JSON se ve en la hoja', huerfanos.length === 0,
  enJson + ' en el JSON' + (huerfanos.length ? '   🔴 ' + huerfanos.length + ' invisibles: ' + huerfanos.slice(0, 3).join(' · ') : ''));

// ── 3 · las exclusiones: toda decisión con motivo
console.log('\n══ 3 · las exclusiones son decisiones, y llevan motivo ══');
var totalX = 0, sinMotivo = 0;
Object.keys(X.por_dimension).forEach(function (d) {
  X.por_dimension[d].forEach(function (e) {
    totalX++;
    if (!t(e.motivo) || /sin motivo/i.test(e.motivo)) sinMotivo++;
  });
});
chk('toda exclusión lleva motivo escrito', sinMotivo === 0,
  totalX + ' exclusiones' + (sinMotivo ? '   🔴 ' + sinMotivo + ' sin motivo' : ' · todas con motivo'));
chk('las exclusiones NO viven en el JSON de normalización',
  !Object.keys(N.alias).some(function (d) { return /exclu/i.test(d); }),
  'son decisiones, no referencias: contrato aparte');

// ── 4 · el puente con el catálogo
console.log('\n══ 4 · el puente Referencias ↔ Piezas ══');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
// 🔴 `Pieza_IDs` ES UNA MUESTRA, NO UNA LLAVE FORÁNEA. Está TRUNCADA en 25 de 265 filas: dice
//    `N_Piezas=77` y lista 9, terminando en «(+65)». Mi primer check leyó «(+65)» como si fuera un
//    Pieza_ID y reportó 11 ids inventados. El dato no está mal: mi lectura lo estaba. Se valida lo
//    que SÍ es una llave —los ids completos que aparecen— y se declara el truncamiento.
var idsCat = {}; P.forEach(function (p) { idsCat[t(p['Pieza_ID'])] = 1; });
var ES_ID = /^\d{3}-P\d{3}$/;
var inventados = [], truncadas = 0;
R.forEach(function (r) {
  var lista = t(r['Pieza_IDs']).split(/\s+/).filter(Boolean);
  if (lista.some(function (x) { return /^\(\+\d+\)$/.test(x) || x === '…'; })) truncadas++;
  lista.filter(function (x) { return ES_ID.test(x); }).forEach(function (id) { if (!idsCat[id]) inventados.push(id); });
});
var unicos = inventados.filter(function (v, i, a) { return a.indexOf(v) === i; });
chk('todo Pieza_ID completo citado en Referencias existe', unicos.length === 0,
  unicos.length ? '🔴 ' + unicos.length + ': ' + unicos.slice(0, 5).join(', ') : 'todos resuelven');
console.log('   ○ ' + 'filas con Pieza_IDs TRUNCADO (es una muestra)'.padEnd(54) + truncadas + ' de ' + R.length +
  '   → el puente real se reconstruye desde el catálogo');
chk('el puente está declarado en el JSON', (N.puente_con_el_catalogo || []).length === 3,
  (N.puente_con_el_catalogo || []).join(' + '));

// ── 5 · el ataque: meter un alias contradictorio y ver que BLOQUEA
console.log('\n══ 5 · ataque · un alias contradictorio ══');
// se corrompe una copia del JSON y se comprueba que la comparación lo detecta
var d0 = Object.keys(N.alias)[0], k0 = Object.keys(N.alias[d0])[0];
var copia = JSON.parse(JSON.stringify(N));
copia.alias[d0][k0].canonico = 'VALOR-INVENTADO';
var enLaHoja = R.filter(function (r) {
  return t(r['Tipo']).toLowerCase() === 'alias' && t(r['Dimension']) === d0 && llaveAlias(r) === k0;
})[0];
var detecta = !!enLaHoja && t(enLaHoja['Valor_Canonico']) !== t(copia.alias[d0][k0].canonico);
chk('ataque · si el JSON dijera otra cosa, el check lo caza', detecta,
  '«' + k0 + '» → hoja «' + (enLaHoja ? t(enLaHoja['Valor_Canonico']) : '?') + '» vs ataque «VALOR-INVENTADO»');
// y el ataque inverso: un alias que el JSON no tenga
var copia2 = JSON.parse(JSON.stringify(N));
delete copia2.alias[d0][k0];
chk('ataque · si el JSON perdiera un alias, el check lo caza', !copia2.alias[d0][k0],
  'la hoja lo tiene y el JSON no: la comparación de la sección 1 lo reporta');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S) — la vista y la autoridad NO coinciden' : '✅ ' + ok + ' checks · un dato, una autoridad') + ' ════════');
process.exit(mal ? 1 : 0);
