// E1.6 · `Pieza_Principal_ID` — la foránea FUP → Principal, DECLARADA.
//
// 🔴 POR QUÉ ES LA PIEZA QUE MÁS ESTABILIZA LA ATRIBUCIÓN. Hoy el FUP se empareja con su Principal
//    DEDUCIÉNDOLO de las dimensiones (campaña + touchpoint + segmento). Eso falla por dos motivos
//    medidos:
//      · el FUP sale en OTRA quincena que su Principal (9 de 31), así que la quincena —que sí está
//        en la llave del reporte— no puede usarse para emparejarlos;
//      · sin la quincena, las oleadas colisionan: `AON | E-P4 | Career Focused` existe en marzo Y
//        en abril, y el FUP de abril podía pegarse al Principal de marzo.
//
//    Declararlo UNA VEZ lo resuelve para siempre: ningún skill vuelve a deducirlo.
//
// 🔴 CÓMO SE ELIGE, y no es «el que más se parece»: el Principal de la MISMA campaña, touchpoint y
//    segmento cuya fecha de envío sea **la más cercana ANTERIOR** al FUP. Un seguimiento va después
//    de lo que sigue — si el único candidato es posterior, no se empareja: se declara.
//
// 🔴 N/A EN LO QUE NO ES FUP (Rick, explícito). Un Principal no apunta a nadie, y un WhatsApp
//    tampoco: eso no es un hueco, es que la columna no le aplica.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var COL = 'Pieza_Principal_ID';

console.log('════════ E1.6 · Pieza_Principal_ID ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('E1.6');

var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));

function esFUP(p) { return /follow|fup/i.test(t(p['Email_Type'])); }
function esPrincipal(p) { return /principal/i.test(t(p['Email_Type'])); }
function dim(p) { return t(p['Campaña']) + '|' + t(p['Touchpoint']) + '|' + t(p['Segmento']); }
function fecha(p) { var f = Q.aFecha(p['Fecha_Primer_Envio']); return f ? f.getTime() : null; }

// los Principales, agrupados por dimensión
var principales = {};
P.forEach(function (p, i) {
  if (!esPrincipal(p)) return;
  (principales[dim(p)] = principales[dim(p)] || []).push({ p: p, fila: i + 2, id: t(p['Pieza_ID']), f: fecha(p) });
});

var apuntes = [], sinPrincipal = [], evidencia = [];
var nFUP = 0, nNA = 0;

P.forEach(function (p, i) {
  var fila = i + 2, id = t(p['Pieza_ID']);
  var actual = t(p[COL]);

  if (!esFUP(p)) {
    // 🔴 N/A en todo lo que no es FUP — declarado, no vacío
    if (actual !== 'N/A') { apuntes.push({ fila: fila, valor: 'N/A', porque: 'no es una pieza de seguimiento: la columna no le aplica.' }); nNA++; }
    return;
  }
  nFUP++;
  var cands = (principales[dim(p)] || []).slice();
  var fF = fecha(p);
  var elegido = null, via = '';

  if (!cands.length) {
    sinPrincipal.push({ id: id, dim: dim(p), motivo: 'ningún Principal comparte campaña, touchpoint y segmento' });
  } else if (cands.length === 1) {
    elegido = cands[0]; via = 'único candidato';
  } else if (fF) {
    // el más cercano ANTERIOR — un seguimiento va después de lo que sigue
    var antes = cands.filter(function (c) { return c.f && c.f <= fF; }).sort(function (a, b) { return b.f - a.f; });
    if (antes.length) { elegido = antes[0]; via = 'el Principal más cercano ANTERIOR (' + cands.length + ' candidatos)'; }
    else sinPrincipal.push({ id: id, dim: dim(p), motivo: 'los ' + cands.length + ' candidatos son POSTERIORES al FUP' });
  } else {
    sinPrincipal.push({ id: id, dim: dim(p), motivo: 'hay ' + cands.length + ' candidatos y el FUP no tiene fecha para desempatar' });
  }

  if (elegido) {
    evidencia.push({ fup: id, principal: elegido.id, dim: dim(p), via: via,
      fecha_fup: t(p['Fecha_Primer_Envio']).slice(0, 10), fecha_principal: t(elegido.p['Fecha_Primer_Envio']).slice(0, 10),
      quincena_fup: Q.normalizar(p['Quincena_Lanzamiento']), quincena_principal: Q.normalizar(elegido.p['Quincena_Lanzamiento']) });
    if (actual !== elegido.id) apuntes.push({ fila: fila, valor: elegido.id,
      porque: 'es el seguimiento de ' + elegido.id + ' — ' + via + '. Se DECLARA para que ningún skill vuelva a deducirlo: ' +
        'el FUP sale en otra quincena y por eso la llave del reporte no puede emparejarlos.' });
  }
});

console.log('  piezas FUP: ' + nFUP + '   ·   emparejadas: ' + evidencia.length + '   ·   sin Principal: ' + sinPrincipal.length);
console.log('  celdas N/A (no son FUP): ' + nNA);

var otraQ = evidencia.filter(function (e) { return e.quincena_fup !== e.quincena_principal; });
console.log('\n  ── FUP que salieron en OTRA quincena que su Principal: ' + otraQ.length + ' de ' + evidencia.length);
otraQ.slice(0, 8).forEach(function (e) {
  console.log('     ' + e.fup + ' → ' + e.principal + '   ' + e.quincena_principal + ' → ' + e.quincena_fup + '   ' + e.dim.slice(0, 46));
});
var variosCand = evidencia.filter(function (e) { return /candidatos/.test(e.via); });
if (variosCand.length) {
  console.log('\n  ── las que tenían varios candidatos (las oleadas):');
  variosCand.slice(0, 8).forEach(function (e) {
    console.log('     ' + e.fup + ' → ' + e.principal + '   FUP ' + e.fecha_fup + ' · Principal ' + e.fecha_principal + '   ' + e.via);
  });
}
if (sinPrincipal.length) {
  console.log('\n  ⚠ FUP sin Principal (' + sinPrincipal.length + '):');
  sinPrincipal.forEach(function (x) { console.log('     ' + x.id.padEnd(10) + x.motivo + '   [' + x.dim.slice(0, 40) + ']'); });
}

fs.writeFileSync(BACK + '/_catalogo/fup-principal.json', JSON.stringify({
  paso: 'E1.6', fecha: '2026-08-24',
  que_es: 'La foranea FUP -> Principal, declarada pieza por pieza.',
  regla: 'El Principal de la MISMA campana, touchpoint y segmento cuya fecha sea la mas cercana ANTERIOR al FUP.',
  por_que: 'Deducirlo de las dimensiones falla: el FUP sale en otra quincena (9 de 31) y las oleadas colisionan.',
  emparejamientos: evidencia, sin_principal: sinPrincipal
}, null, 1));
console.log('\n  → _catalogo/fup-principal.json');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
CB.apuntarColumna('E1.6', 'Catalogo_Piezas', COL,
  'La foranea FUP -> Principal. Se declara una vez para que ningun skill vuelva a deducirla: el FUP sale en otra quincena que su Principal y por eso la llave del reporte no puede emparejarlos.');
apuntes.forEach(function (a) {
  CB.apuntar('E1.6', 'Catalogo_Piezas', a.fila, COL, a.valor, 'E1.6 · ' + a.porque);
});
var res = CB.resumen();
console.log('\n  ── apuntados ' + apuntes.length + ' (+1 columna nueva). Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
