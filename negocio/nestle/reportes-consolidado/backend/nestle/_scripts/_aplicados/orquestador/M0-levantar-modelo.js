// M0 · LEVANTAR EL MODELO DE DATOS REAL — antes de rediseñarlo.
//
// 🔴 POR QUÉ EXISTE: Rick pide un modelo relacional de verdad (árbol, esquemas, llaves). Escribir
//    ese plan sobre relaciones SUPUESTAS sería el mismo defecto que queremos corregir. Este paso
//    no propone nada: MIDE lo que hay. Cuatro preguntas, cada una con su evidencia:
//      1 · ¿cómo se emparejan Principal y FUP hoy, y esa llave es única?
//      2 · ¿el Email_Name es único por touchpoint × audiencia? (de eso depende la atribución)
//      3 · ¿qué columnas comparten de verdad las 6 hojas?
//      4 · ¿cómo sirve Catalogo_Referencias a la atribución Qcart ↔ Data_Email?
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var H = function (h) { return XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '', blankrows: false }); };
var ENC = function (h) { return (XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || []).map(t); };
var out = {};

console.log('════════ M0 · EL MODELO REAL ════════\n');

// ══ 1 · PRINCIPAL ↔ FUP ═══════════════════════════════════════════════════════════
console.log('══ 1 · ¿cómo se emparejan Principal y FUP? ══\n');
var P = H('Catalogo_Piezas');
var prin = P.filter(function (p) { return /principal/i.test(t(p['Email_Type'])); });
var fup = P.filter(function (p) { return /follow|fup/i.test(t(p['Email_Type'])); });
console.log('   catálogo: ' + prin.length + ' Principal · ' + fup.length + ' FUP · ' +
  P.filter(function (p) { return !t(p['Email_Type']); }).length + ' sin tipo · ' + P.length + ' total');

// la llave que eligió Rick: Campaña + TouchPoint + Segmento
function llave(p) { return t(p['Campaña']) + ' | ' + t(p['Touchpoint']) + ' | ' + t(p['Segmento']); }
var kPrin = {}, colisionP = [];
prin.forEach(function (p) { var k = llave(p); if (kPrin[k]) colisionP.push(k); else kPrin[k] = p; });
var kFup = {}, colisionF = [];
fup.forEach(function (p) { var k = llave(p); if (kFup[k]) colisionF.push(k); else kFup[k] = p; });
console.log('\n   con la llave Campaña|TouchPoint|Segmento:');
console.log('      Principal: ' + Object.keys(kPrin).length + ' llaves únicas' + (colisionP.length ? '   🔴 ' + colisionP.length + ' COLISIONES' : '   ✔ sin colisión'));
colisionP.slice(0, 6).forEach(function (k) { console.log('         🔴 ' + k); });
console.log('      FUP:       ' + Object.keys(kFup).length + ' llaves únicas' + (colisionF.length ? '   🔴 ' + colisionF.length + ' COLISIONES' : '   ✔ sin colisión'));
colisionF.slice(0, 6).forEach(function (k) { console.log('         🔴 ' + k); });

var fupSinPrin = Object.keys(kFup).filter(function (k) { return !kPrin[k]; });
var prinConFup = Object.keys(kPrin).filter(function (k) { return kFup[k]; });
console.log('\n   emparejamiento:');
console.log('      Principal CON su FUP:  ' + prinConFup.length + ' de ' + Object.keys(kPrin).length);
console.log('      FUP SIN su Principal:  ' + fupSinPrin.length + (fupSinPrin.length ? '   🔴 quedarían huérfanos' : '   ✔'));
fupSinPrin.slice(0, 10).forEach(function (k) {
  var f = kFup[k];
  console.log('         🔴 ' + k + '   (pieza ' + t(f['Pieza_ID']) + ')');
});
// ¿el FUP salió en otra quincena que su principal?
var otraQ = prinConFup.filter(function (k) { return t(kPrin[k]['Quincena_Lanzamiento']) !== t(kFup[k]['Quincena_Lanzamiento']); });
console.log('      FUP en OTRA quincena que su Principal: ' + otraQ.length + ' de ' + prinConFup.length +
  (otraQ.length ? '   ← por eso hace falta la columna de quincena del FUP' : ''));
otraQ.slice(0, 5).forEach(function (k) { console.log('         ' + k + '   P=' + t(kPrin[k]['Quincena_Lanzamiento']) + '  F=' + t(kFup[k]['Quincena_Lanzamiento'])); });
out.fup = { principal: prin.length, fup: fup.length, colisiones_principal: colisionP, colisiones_fup: colisionF,
  fup_sin_principal: fupSinPrin, principal_con_fup: prinConFup.length, fup_otra_quincena: otraQ.length };

// ══ 2 · ¿EL EMAIL_NAME ES ÚNICO POR TOUCHPOINT × AUDIENCIA? ═══════════════════════
console.log('\n\n══ 2 · ¿el Email_Name identifica touchpoint × audiencia? ══\n');
var conNombre = P.filter(function (p) { return t(p['Email_Name']); });
var porNombre = {};
conNombre.forEach(function (p) { (porNombre[t(p['Email_Name'])] = porNombre[t(p['Email_Name'])] || []).push(p); });
var repetidos = Object.keys(porNombre).filter(function (n) { return porNombre[n].length > 1; });
console.log('   piezas con Email_Name: ' + conNombre.length + '   ·   nombres distintos: ' + Object.keys(porNombre).length +
  '   ·   repetidos: ' + repetidos.length + (repetidos.length ? ' 🔴' : ' ✔'));
repetidos.slice(0, 8).forEach(function (n) {
  console.log('      🔴 …' + n.slice(-44));
  porNombre[n].forEach(function (p) { console.log('           ' + t(p['Pieza_ID']).padEnd(10) + t(p['Touchpoint']).padEnd(10) + t(p['Segmento']).slice(0, 30)); });
});
// al revés: ¿una combinación touchpoint×segmento tiene más de un nombre?
var porTPSeg = {};
conNombre.forEach(function (p) {
  var k = t(p['Campaña']) + '|' + t(p['Touchpoint']) + '|' + t(p['Segmento']) + '|' + t(p['Email_Type']);
  (porTPSeg[k] = porTPSeg[k] || []).push(t(p['Email_Name']));
});
var multi = Object.keys(porTPSeg).filter(function (k) {
  var u = porTPSeg[k].filter(function (v, i, a) { return a.indexOf(v) === i; }); return u.length > 1;
});
console.log('\n   combinaciones campaña|touchpoint|segmento|tipo con MÁS de un Email_Name: ' + multi.length + (multi.length ? ' 🔴' : ' ✔'));
multi.slice(0, 6).forEach(function (k) { console.log('      🔴 ' + k + '  → ' + porTPSeg[k].length + ' nombres'); });
out.email_name = { con_nombre: conNombre.length, distintos: Object.keys(porNombre).length, repetidos: repetidos, multi_nombre: multi };

// ══ 3 · COLUMNAS COMPARTIDAS ENTRE LAS HOJAS ══════════════════════════════════════
console.log('\n\n══ 3 · qué columnas comparten de verdad las hojas ══\n');
var HOJAS = ['Report_Resumen', 'Catalogo_Piezas', 'Data_Email', 'Data_WhatsApp', 'Data_Qcart_Carritos', 'Data_Qcart_Productos'];
var encs = {}; HOJAS.forEach(function (h) { encs[h] = ENC(h); });
// normalizar para comparar (el registro ya hace esto: minúsculas, sin acentos, sin símbolos)
function nmz(v) { return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
var DIMS = ['Campaña', 'Medio', 'Objetivo', 'TouchPoint', 'Tipo Email', 'Segmento', 'Quincena_Lanzamiento', 'Mes', 'Mes (#)', 'Marca', 'BU', 'Pieza_ID', 'Email_Name'];
console.log('   ¿dónde vive cada dimensión? (— = no está)\n');
console.log('   ' + 'dimensión'.padEnd(22) + HOJAS.map(function (h) { return h.slice(0, 11).padEnd(13); }).join(''));
DIMS.forEach(function (d) {
  var fila = HOJAS.map(function (h) {
    var i = encs[h].map(nmz).indexOf(nmz(d));
    return (i >= 0 ? XLSX.utils.encode_col(i) : '—').padEnd(13);
  });
  console.log('   ' + d.padEnd(22) + fila.join(''));
});
out.dimensiones = DIMS.map(function (d) {
  var o = { dimension: d };
  HOJAS.forEach(function (h) { var i = encs[h].map(nmz).indexOf(nmz(d)); o[h] = i >= 0 ? XLSX.utils.encode_col(i) : null; });
  return o;
});

// ══ 4 · CATALOGO_REFERENCIAS: ¿cómo sirve a la atribución? ════════════════════════
console.log('\n\n══ 4 · Catalogo_Referencias — qué guarda y a quién sirve ══\n');
var R = H('Catalogo_Referencias');
var porTipo = {};
R.forEach(function (r) { var k = t(r['Tipo']) + ' · ' + t(r['Dimension']); porTipo[k] = (porTipo[k] || 0) + 1; });
Object.keys(porTipo).sort(function (a, b) { return porTipo[b] - porTipo[a]; }).forEach(function (k) {
  console.log('   ' + String(porTipo[k]).padStart(4) + '  ' + k);
});
// las que son de atribución (crudo → canónico), que es lo que Rick dice que no se puede perder
var conCrudo = R.filter(function (r) { return t(r['Valor_Crudo']) && t(r['Valor_Canonico']); });
console.log('\n   filas con mapeo CRUDO → CANÓNICO (el corazón de la normalización): ' + conCrudo.length);
conCrudo.slice(0, 10).forEach(function (r) {
  console.log('      ' + t(r['Dimension']).padEnd(14) + '«' + t(r['Valor_Crudo']).slice(0, 30) + '» → «' + t(r['Valor_Canonico']).slice(0, 28) + '»   ' + t(r['Fuente']).slice(0, 18));
});
var conPiezas = R.filter(function (r) { return t(r['Pieza_IDs']); });
console.log('\n   filas ligadas a piezas: ' + conPiezas.length + ' de ' + R.length);
var relacion = conPiezas.map(function (r) { return t(r['Pieza_IDs']).split(/\s+/).filter(Boolean).length; });
var unaPieza = relacion.filter(function (n) { return n === 1; }).length;
console.log('      de ellas, 1:1 con UNA pieza: ' + unaPieza + '   ·   N:M (varias piezas): ' + (conPiezas.length - unaPieza));
console.log('      → las 1:1 caben como columna en Catalogo_Piezas; las N:M no (repetirían el valor)');
out.referencias = { total: R.length, por_tipo: porTipo, con_mapeo_crudo: conCrudo.length,
  ligadas_a_piezas: conPiezas.length, uno_a_uno: unaPieza, n_a_m: conPiezas.length - unaPieza };

fs.writeFileSync(BACK + '/_contratos/modelo-real-medido.json', JSON.stringify(out, null, 1));
console.log('\n\n→ _contratos/modelo-real-medido.json');
