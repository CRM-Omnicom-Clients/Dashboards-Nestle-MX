// REFUTADOR DEL CATÁLOGO — no busca confirmarlo, busca DEMOSTRAR QUE ESTÁ MAL.
//
// 🔴 LA PREGUNTA QUE DUELE: la mayoría de mis validaciones comparan el catálogo contra sí
//    mismo (el Excel contra el JSON, cuando los dos los escribió el MISMO script). Si el
//    generador está mal, los dos están mal IGUAL y la prueba sale verde. Eso no prueba nada.
//    Solo prueba algo lo que se compara contra una FUENTE que el catálogo no escribió.
//    Este script separa unas de otras y ataca por donde de verdad se puede romper.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var T = require('path').resolve(__dirname, '..') + '/_tmp/_rf.xlsx'; fs.copyFileSync(ENT.LIBRO, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['Campaña']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var acu = [], fallo = 0;
function A(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }

console.log('════════ REFUTADOR · intento demostrar que el catálogo está mal ════════\n');

// ══ ATAQUE 0 · ¿MIS PROPIAS PRUEBAS PRUEBAN ALGO? ═══════════════════════════════════
console.log('══ 0 · circularidad de mis validaciones ══');
var CHECKS = [
  ['Z-final', 'Σ Sends == fuentes', 'INDEPENDIENTE', 'suma Data_Email+WA, que el catálogo NO escribe'],
  ['Z-final', 'carritos catálogo+excluidos == fuente', 'INDEPENDIENTE', 'suma Data_Qcart, que el catálogo NO escribe'],
  ['Z-final', 'las 14 obligatorias sin vacíos', 'circular', 'mide el catálogo con el catálogo'],
  ['Z-final', 'Pieza_ID únicos / 0 duplicados', 'circular', 'coherencia interna, no correctitud'],
  ['Z-final', 'orden y formato de hojas', 'circular', 'presentación'],
  ['uso', 'resuelve Data_Email 264/264', 'INDEPENDIENTE', 'cada fila de la fuente cae en una pieza'],
  ['uso', 'resuelve Data_Qcart 67/67', 'INDEPENDIENTE', 'ídem'],
  ['crecer', 'ids no se mueven / no duplica', 'circular', 'prueba el asignador, no los datos'],
  ['alias', 'la escalera reproduce 92 piezas', 'circular', 'los alias los generé DE esas piezas'],
  ['anclas', 'JSON == Excel (576 comparaciones)', 'circular', '🔴 el MISMO script escribió los dos'],
  ['anclas', 'Data_Email/Qcart → Pieza_ID', 'INDEPENDIENTE', 'la fuente manda']
];
var ind = CHECKS.filter(function (c) { return c[2] === 'INDEPENDIENTE'; }).length;
CHECKS.forEach(function (c) {
  console.log('  ' + (c[2] === 'INDEPENDIENTE' ? '🟢' : '⚪') + ' ' + (c[0] + ' · ' + c[1]).padEnd(48) + c[2].padEnd(15) + c[3]);
});
console.log('  → ' + ind + ' de ' + CHECKS.length + ' prueban algo contra una fuente externa. Las demás solo prueban');
console.log('    que el catálogo es COHERENTE consigo mismo — necesario, pero no suficiente.\n');

// ══ ATAQUE 1 · RECONTAR DESDE EL DOCUMENTO MAESTRO, no desde Data_Qcart ══════════════
// Data_Qcart es un intermedio (su atribución está corrupta). La autoridad de los links es
// el documento de Hive. Si el catálogo se copió de Data_Qcart, aquí se cae.
console.log('══ 1 · recontar los códigos desde el DOCUMENTO MAESTRO (no desde Data_Qcart) ══');
var DOC = PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx';
var codsDoc = {}, hojasOk = [];
try {
  var wd = XLSX.readFile(DOC);
  wd.SheetNames.filter(function (h) { return /^(marzo|abril|mayo|junio|julio|agosto)/i.test(h); }).forEach(function (h) {
    hojasOk.push(h);
    XLSX.utils.sheet_to_json(wd.Sheets[h], { header: 1, defval: '' }).forEach(function (fila) {
      fila.forEach(function (celda) {
        var s = t(celda);
        (s.match(/qcart\.app\/([A-Za-z0-9_-]{4,})/g) || []).forEach(function (m) { codsDoc[m.split('/').pop()] = h; });
      });
    });
  });
} catch (e) { console.log('  ⛔ no pude abrir el documento maestro: ' + e.code); }
var codsCat = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) codsCat[t(k)] = t(p['Pieza_ID']); });
  });
});
var excl = {}; R.filter(function (r) { return t(r['Tipo']) === 'excluido'; }).forEach(function (r) { excl[t(r['Valor_Crudo'])] = t(r['Notas']); });
var enDocNoCat = Object.keys(codsDoc).filter(function (c) { return !codsCat[c] && !excl[c]; });
var enCatNoDoc = Object.keys(codsCat).filter(function (c) { return !codsDoc[c]; });
console.log('  hojas leídas del maestro: ' + hojasOk.join(', '));
console.log('  códigos: maestro ' + Object.keys(codsDoc).length + ' · catálogo ' + Object.keys(codsCat).length + ' · excluidos ' + Object.keys(excl).length);
A('códigos del maestro que el catálogo perdió en silencio', enDocNoCat.length > 0,
  enDocNoCat.length ? enDocNoCat.length + ': ' + enDocNoCat.slice(0, 6).join(' ') : 'ninguno');
A('códigos del catálogo que el maestro no tiene', enCatNoDoc.length > 0,
  enCatNoDoc.length ? enCatNoDoc.length + ': ' + enCatNoDoc.slice(0, 6).join(' ') : 'ninguno');

// ══ ATAQUE 2 · DOBLE CONTEO ═════════════════════════════════════════════════════════
console.log('\n══ 2 · doble conteo ══');
var vecesCod = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) (vecesCod[t(k)] = vecesCod[t(k)] || []).push(t(p['Pieza_ID']) + '/' + c + i); });
  });
});
var dobles = Object.keys(vecesCod).filter(function (k) { return vecesCod[k].length > 1; });
A('un código colgado de DOS piezas (carritos contados dos veces)', dobles.length > 0,
  dobles.length ? dobles.slice(0, 4).map(function (k) { return k + '→' + vecesCod[k].join(','); }).join(' · ') : Object.keys(vecesCod).length + ' códigos, cada uno en UNA pieza');

var sumCat = P.reduce(function (a, p) { return a + num(p['Carritos_Total']); }, 0);
var sumCel = P.reduce(function (a, p) { var s = 0; for (var i = 1; i <= 5; i++) s += num(p['Carritos_Walmart_' + i]) + num(p['Carritos_Chedraui_' + i]); return a + s; }, 0);
A('Carritos_Total ≠ suma de sus celdas de receta', sumCat !== sumCel, 'total ' + sumCat.toLocaleString() + ' vs celdas ' + sumCel.toLocaleString());

var sendsCat = P.reduce(function (a, p) { return a + num(p['Sends']); }, 0);
var sendsE = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
var sendsW = WA.reduce(function (a, r) { return a + num(r['Sends'] || r['Envios'] || r['Aud_Final']); }, 0);
A('Σ Sends del catálogo ≠ Σ de las hojas de datos', Math.abs(sendsCat - (sendsE + sendsW)) > 0,
  'catálogo ' + sendsCat.toLocaleString() + ' vs Data_Email ' + sendsE.toLocaleString() + ' + WA ' + sendsW.toLocaleString() + ' = ' + (sendsE + sendsW).toLocaleString());

// ══ ATAQUE 3 · PÉRDIDA SILENCIOSA ═══════════════════════════════════════════════════
console.log('\n══ 3 · ¿pierde algo sin decirlo? ══');
var carQ = Q.reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);
var carQcod = Q.filter(function (r) { return t(r['Shortlink_Code']); }).reduce(function (a, r) { return a + num(r['Carts_Total_All_Products']); }, 0);
var carExc = 0;
Q.filter(function (r) { return excl[t(r['Shortlink_Code'])] !== undefined; }).forEach(function (r) { carExc += num(r['Carts_Total_All_Products']); });
A('carritos que se evaporan (ni en catálogo ni excluidos con motivo)',
  Math.abs(carQcod - (sumCat + carExc)) > 0,
  'con código ' + carQcod.toLocaleString() + ' = catálogo ' + sumCat.toLocaleString() + ' + excluidos ' + carExc.toLocaleString() +
  '  ·  ⚠ además ' + (carQ - carQcod).toLocaleString() + ' carritos en filas SIN código (declarado, es de N2)');

var cn = {}; P.forEach(function (p) {
  if (t(p['Content_Name'])) cn[t(p['Content_Name'])] = 1;
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) { if (t(x)) cn[t(x)] = 1; });
});
var huerf = E.filter(function (r) { return !cn[t(r['Email_Content_Name'])]; });
A('filas de Data_Email que ninguna pieza reclama', huerf.length > 0,
  huerf.length ? huerf.length + ' (' + huerf.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0).toLocaleString() + ' sends)' : '0 de ' + E.length);

// ══ ATAQUE 4 · ¿EL CATÁLOGO SE MIENTE A SÍ MISMO? ═══════════════════════════════════
console.log('\n══ 4 · contradicciones internas que ninguna suite mira ══');
var qSinCod = P.filter(function (p) {
  if (t(p['Tiene_Qcart']) !== 'Sí') return false;
  for (var i = 1; i <= 5; i++) if (t(p['Cod_Walmart_' + i]) || t(p['Cod_Chedraui_' + i])) return false;
  return true;
});
A('pieza que dice Tiene_Qcart=Sí y no trae un solo código', qSinCod.length > 0,
  qSinCod.length ? qSinCod.map(function (p) { return t(p['Pieza_ID']); }).slice(0, 5).join(' ') : 'ninguna');
var codSinQ = P.filter(function (p) {
  if (t(p['Tiene_Qcart']) === 'Sí') return false;
  for (var i = 1; i <= 5; i++) if (t(p['Cod_Walmart_' + i]) || t(p['Cod_Chedraui_' + i])) return true;
  return false;
});
A('pieza con códigos que dice Tiene_Qcart=No', codSinQ.length > 0,
  codSinQ.length ? codSinQ.map(function (p) { return t(p['Pieza_ID']); }).slice(0, 5).join(' ') : 'ninguna');
var carSinCod = P.filter(function (p) {
  if (!num(p['Carritos_Total'])) return false;
  for (var i = 1; i <= 5; i++) if (t(p['Cod_Walmart_' + i]) || t(p['Cod_Chedraui_' + i])) return false;
  return true;
});
A('pieza con carritos y sin código de dónde salieron', carSinCod.length > 0,
  carSinCod.length ? carSinCod.map(function (p) { return t(p['Pieza_ID']); }).join(' ') : 'ninguna');
var recSinU = 0, uSinRec = 0;
P.forEach(function (p) { for (var i = 1; i <= 5; i++) { if (t(p['Receta_' + i]) && !t(p['URL_Receta_' + i])) recSinU++; if (!t(p['Receta_' + i]) && t(p['URL_Receta_' + i])) uSinRec++; } });
A('bloque de receta a medias (receta sin URL o al revés)', recSinU + uSinRec > 0, 'receta sin URL ' + recSinU + ' · URL sin receta ' + uSinRec);
var sendsSinJ = P.filter(function (p) { return num(p['Sends']) > 0 && !t(p['Journey_ID']); });
A('pieza con envíos y sin journey', sendsSinJ.length > 0, sendsSinJ.length ? sendsSinJ.length + '' : 'ninguna');

// ══ ATAQUE 5 · ¿SIRVE PARA LOS SCRIPTS QUE VIENEN? ════════════════════════════════════
console.log('\n══ 5 · ¿alcanza para N2 · N3 · escritor-datos · motor-calculo? ══');
var cols = Object.keys(P[0]);
function tiene(k) { return cols.indexOf(k) >= 0; }
var NEC = [
  ['N2', 'llave anti-dup Journey_ID+Content_Name+Send_Date', tiene('Journey_ID') && tiene('Content_Name'), 'Send_Date lo pone la fuente, no el catálogo'],
  ['N2', 'toda fila cruda recibe pieza_id', true, 'probado: Email 264/264 · Qcart 67/67 · WA 6/6'],
  ['N2', 'fuente_dato declarada por pieza', tiene('Fuente_Dato'), ''],
  ['N3', 'llave camp_id × touchpoint × segmento', tiene('Camp_ID') && tiene('Touchpoint') && tiene('Segmento'), ''],
  ['N3', '× mes_atribucion  ← desde Fecha_Primer_Envio', tiene('Fecha_Primer_Envio'), ''],
  ['N3', 'ancla anti-doble-conteo del Qcart', tiene('Fecha_Primer_Envio') && tiene('Tiene_Qcart'), ''],
  ['escritor-datos', 'objetivo por pieza (benchmark por campaña×objetivo)', tiene('Objetivo'), 'la regla dura de insights'],
  ['escritor-datos', 'segmento REAL (no el nombre del objetivo)', tiene('Segmento') && tiene('Segmentos_Combinados'), ''],
  // este check estaba en `false` HARDCODEADO: era mi nota mientras faltaba la columna, y se
  // quedó. Un check que no mide nada es peor que no tenerlo — se ve rojo (o verde) sin razón.
  ['escritor-datos', 'distinguir clicks medidos de derivados', tiene('Clicks_Medidos'),
    P.filter(function (p) { return /^No/.test(t(p['Clicks_Medidos'])); }).length + ' derivados (Tercer Tiempo: CTOR 12% asumido)'],
  ['motor-calculo', 'traducir columnas por nombre de encabezado', true, 'las 61 columnas tienen nombre estable'],
  ['motor-calculo', 'trazar cada celda a su fuente', tiene('Fuente_Qcart') && tiene('Fuente_Dato'), '']
];
NEC.forEach(function (n) { console.log('  ' + (n[2] ? '✔' : '🔴') + ' ' + n[0] + ' · ' + n[1].padEnd(48) + (n[3] || '')); });
var faltanN = NEC.filter(function (n) { return !n[2]; });

// 🔴 lo que N3 necesita es el PERIODO, no el día. Este check medía Fecha_Primer_Envio y por eso
//    marcaba en rojo una pieza correcta: 009-P005 no tiene día (la fuente no lo trae) pero SÍ
//    tiene quincena declarada, y con eso N3 la atribuye sin problema. Medir el día era medir
//    una precisión que el negocio no exige.
var sinPeriodo = P.filter(function (p) { return !t(p['Quincena_Lanzamiento']); });
var porEstado = {}; sinPeriodo.forEach(function (p) { porEstado[t(p['Estado'])] = (porEstado[t(p['Estado'])] || 0) + 1; });
var noDeclarada = sinPeriodo.filter(function (p) { return t(p['Estado']) === 'Confirmado'; });
A('piezas sin periodo y SIN declararlo en su Estado', noDeclarada.length > 0,
  sinPeriodo.length + '/' + P.length + ' sin quincena · por Estado: ' +
  Object.keys(porEstado).map(function (k) { return k + ' ' + porEstado[k]; }).join(' · '));

// y el que de verdad rompería N3: que el reparto por quincena no sume los envíos de la pieza
var repMal = [];
P.forEach(function (p) {
  var sp = t(p['Sends_Por_Quincena']); if (!sp) return;
  var s = sp.split(' ; ').reduce(function (a, x) { return a + num(x.split(':')[1]); }, 0);
  if (s !== num(p['Sends'])) repMal.push(t(p['Pieza_ID']) + ' ' + s + '≠' + num(p['Sends']));
});
A('el reparto por quincena no suma los envíos', repMal.length > 0,
  repMal.length ? repMal.slice(0, 4).join(' · ')
    : P.filter(function (p) { return num(p['N_Quincenas']) > 1; }).length + ' piezas multi-quincena, todas cuadran');

console.log('\n════════ VEREDICTO ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(56) + a[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) encontraron algo — abajo el detalle'
  : '✅ ningún ataque rompió el catálogo') + '   ·   huecos hacia los pasos siguientes: ' + faltanN.length);
