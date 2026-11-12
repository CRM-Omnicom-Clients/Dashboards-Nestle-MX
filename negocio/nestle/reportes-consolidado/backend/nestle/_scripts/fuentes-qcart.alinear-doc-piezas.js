// fuentes-qcart · ALINEAR EL DOC DE LINKS CON LAS PIEZAS. Mide y propone; NO escribe.
//
// 🔴 LA DEFINICIÓN, EN PALABRAS DE RICK (27-ago-2026):
//    «¿Quién manda? Es una COMBINACIÓN: email name, cada uno con sus links. Cada fila de qcart
//     es una pieza, y esa pieza viene de la data de email. Todos los catálogos se relacionan por
//     el EMAIL NAME. Tu validación es todas las filas de qcart-links vs todas las piezas
//     asignadas por email name con sus short links.»
//
// 🔴 Y POR ESO SE MAPEA POR **SEGMENTO**, NO POR EL NÚMERO DEL EMAIL. Ese fue el bug de marzo:
//    `Catalogo_Referencias` traía `Email 1→E-P1`, `Email 2→E-P2`, `Email 3→E-P3` — un alias que
//    infiere el touchpoint del NÚMERO. Pero el doc de marzo trae la AUDIENCIA en su propia
//    columna, y dice: Email 1 = Traditional Parents · Email 2 = New Parents · Email 3 = Career
//    Focused. En AON esas audiencias son E-P1, **E-P3** y **E-P4**. El alias corrió los códigos
//    una posición y 191 carritos acabaron en el segmento de al lado, cuadrando la suma.
//    La audiencia es el dato; el «Email N» es una etiqueta de redacción.
//
// 🔴 LA CADENA DE VERDAD, ENTONCES:
//      bloque del doc (MES · campaña · touchpoint · AUDIENCIA · códigos)
//        → campaña canónica  (alias de Catalogo_Referencias)
//        → segmento canónico (alias de Catalogo_Referencias)
//        → la PIEZA Principal de esa campaña × segmento activa en ese MES
//        → su Email_Name, que es la llave con la que todo lo demás cruza
//
// 🔴 UNA PIEZA POR BLOQUE, Y SOLO PRINCIPAL. «Únicamente envío principal, NUNCA FUPS.»
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json` ANTES que la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var M = require(BACK + '/_scripts/lib-maestro-links.js');
var Q = require(BACK + '/_scripts/lib-qcart-links.js');
var L = require(BACK + '/_scripts/lib-flexible.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var pl = function (v) { return t(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
var MES_N = { 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8 };

console.log('════════ fuentes-qcart · ALINEAR EL DOC CON LAS PIEZAS ════════\n');

var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_alinear.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, TMP);
var wb = XLSX.readFile(TMP);
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var REF = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
var NM = {};
['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Email_Type', 'Quincena', 'Email_Name'].forEach(function (id) { NM[id] = COL.de(CAT, id); });
var NMR = {};
['Tipo', 'Dimension', 'Valor_Crudo', 'Valor_Canonico'].forEach(function (id) { NMR[id] = COL.de(REF, id); });

// ── los alias, por dimensión. Nada se infiere: si no hay alias, se declara.
// 🔴 LOS DE TOUCHPOINT SON CONTEXTUALES POR CAMPAÑA y los de segmento son globales — así está
//    hoy la hoja, y así se leen. Mezclarlos (usar un alias de touchpoint de Mundial dentro de
//    AON) es exactamente lo que la escalera de alias existe para impedir.
var aliasCamp = {}, aliasSeg = {}, aliasTP = {};
var NMR2 = { Contexto: COL.de(REF, 'Contexto') };
REF.forEach(function (r) {
  if (!/alias/i.test(t(r[NMR.Tipo]))) return;
  var dim = pl(r[NMR.Dimension]), crudo = pl(r[NMR.Valor_Crudo]), can = t(r[NMR.Valor_Canonico]);
  if (!crudo || !can) return;
  if (dim === 'campana') aliasCamp[crudo] = can;
  if (dim === 'segmento') aliasSeg[crudo] = can;
  if (dim === 'touchpoint') aliasTP[pl(r[NMR2.Contexto]) + '¦' + crudo] = can;
});
// los canónicos también resuelven a sí mismos
CAT.forEach(function (p) {
  if (t(p[NM.Campaña])) aliasCamp[pl(p[NM.Campaña])] = t(p[NM.Campaña]);
  if (t(p[NM.Segmento])) aliasSeg[pl(p[NM.Segmento])] = t(p[NM.Segmento]);
});
console.log('  alias vivos: ' + Object.keys(aliasCamp).length + ' de campaña · ' + Object.keys(aliasSeg).length + ' de segmento');

// ── las piezas Principal, indexadas por campaña × segmento
function mesesDe(p) {
  // los meses en los que la pieza estuvo activa, leídos de lo que el catálogo declara
  var out = {};
  [t(p['Quincena']), t(p['Quincenas_Activas'])].forEach(function (v) {
    (v.match(/\d{4}-(\d{2})-Q[12]/g) || []).forEach(function (x) { out[parseInt(x.slice(5, 7), 10)] = 1; });
  });
  var mn = t(p['Mes']); if (MES_N[mn]) out[MES_N[mn]] = 1;
  return Object.keys(out).map(Number);
}
var principales = CAT.filter(function (p) { return !/follow|fup/i.test(t(p[NM.Email_Type])); });   // 🔴 nunca FUPs

// ── dónde están HOY esos códigos (hace falta ANTES: el titular actual desempata)
var codHoy = {};
CAT.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { (codHoy[c] = codHoy[c] || []).push(t(p[NM.Pieza_ID])); });
  });
});

// ── el mapeo, bloque por bloque
// 🔴 EL ORDEN DE LAS SEÑALES IMPORTA, y es el que Rick describió: campaña · touchpoint ·
//    segmento · mes. El touchpoint se resuelve con su alias CONTEXTUAL a la campaña; el
//    segmento con el suyo. Si el touchpoint no resuelve, manda el segmento — y al revés.
//    Nunca se elige «la primera»: si tras todas las señales quedan dos, se declara ambiguo.
// 🔴 Y EL DESEMPATE FINAL ES EL TITULAR ACTUAL: la pieza que ya lleva ese código gana, porque
//    Rick pidió no romper lo atribuido. El titular solo pierde si el DOC lo contradice en
//    campaña, touchpoint o segmento — que es lo que pasó en marzo.
var bloques = M.piezasDelDoc();
var plan = [], sinResolver = [], ambiguos = [];
bloques.forEach(function (b) {
  var camp = aliasCamp[pl(b.campana)] || null;
  var seg = aliasSeg[pl(b.segmento)] || null;
  var tp = aliasTP[pl(camp || '') + '¦' + pl(b.touchpoint)] || null;
  var mes = MES_N[b.mes];
  var r = { bloque: b, campana_canonica: camp, segmento_canonico: seg, touchpoint_canonico: tp, mes: mes, pieza: null, via: '' };
  if (!camp) { r.motivo = 'campaña «' + b.campana + '» sin alias'; sinResolver.push(r); plan.push(r); return; }
  if (!seg && !tp) {
    r.motivo = 'ni el segmento «' + b.segmento + '» ni el touchpoint «' + b.touchpoint + '» resuelven';
    sinResolver.push(r); plan.push(r); return;
  }

  var paso = [];
  var cands = principales.filter(function (p) { return pl(p[NM.Campaña]) === pl(camp); });
  paso.push('campaña→' + cands.length);

  // 🔴 SI EL TOUCHPOINT Y EL SEGMENTO SE CONTRADICEN, GANA EL SEGMENTO — y se declara el choque.
  //    Es LA lección de marzo: el alias decía `Email 2 → E-P2` y el doc decía, en su propia
  //    columna de audiencia, «New Parents» — que en AON es E-P3. El touchpoint del doc es una
  //    etiqueta de redacción («el segundo correo»); la audiencia es un hecho del envío. Dejar
  //    ganar al touchpoint corrió 191 carritos al segmento de al lado, y la suma cuadró igual.
  //    Un choque aquí no es ruido: significa que el ALIAS de touchpoint está mal y hay que
  //    arreglarlo en Referencias, no taparlo eligiendo uno de los dos.
  var porTP = tp ? cands.filter(function (p) { return pl(p[NM.TouchPoint]) === pl(tp); }) : null;
  var porSeg = seg ? cands.filter(function (p) { return pl(p[NM.Segmento]) === pl(seg); }) : null;
  if (porTP && porTP.length && porSeg && porSeg.length) {
    var inter = porTP.filter(function (p) { return porSeg.indexOf(p) >= 0; });
    if (inter.length) { cands = inter; paso.push('touchpoint+segmento→' + cands.length); }
    else {
      cands = porSeg;
      r.conflicto = 'el touchpoint «' + b.touchpoint + '»→' + tp + ' y el segmento «' + b.segmento + '»→' + seg +
        ' apuntan a piezas distintas. GANA EL SEGMENTO; el alias de touchpoint está mal.';
      paso.push('🔴 CHOQUE, gana segmento→' + cands.length);
    }
  } else if (porSeg && porSeg.length) { cands = porSeg; paso.push('segmento→' + cands.length); }
  else if (porTP && porTP.length) { cands = porTP; paso.push('touchpoint→' + cands.length); }

  if (cands.length > 1) { var f3 = cands.filter(function (p) { return mesesDe(p).indexOf(mes) >= 0; }); if (f3.length) { cands = f3; paso.push('mes→' + cands.length); } }
  if (cands.length > 1) {
    // el titular actual de alguno de los códigos del bloque
    var titulares = {}; b.codigos.forEach(function (c) { (codHoy[c] || []).forEach(function (p) { titulares[p] = 1; }); });
    var f4 = cands.filter(function (p) { return titulares[t(p[NM.Pieza_ID])]; });
    if (f4.length === 1) { cands = f4; paso.push('titular actual→1'); }
  }
  if (cands.length > 1) {
    var f5 = cands.filter(function (p) { return /^s/i.test(t(p['Tiene_Qcart'])); });
    if (f5.length === 1) { cands = f5; paso.push('Tiene_Qcart=Sí→1'); }
  }
  r.via = paso.join(' · ');
  if (cands.length === 1) r.pieza = cands[0];
  else if (!cands.length) { r.motivo = 'ninguna pieza Principal sobrevive las señales (' + r.via + ')'; sinResolver.push(r); }
  else { r.candidatas = cands; r.motivo = cands.length + ' candidatas tras ' + r.via; ambiguos.push(r); }
  plan.push(r);
});
var CAR = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8')).carritos;
var carr = {}; CAR.forEach(function (e) { var c = t(e.shortlink_code); if (c) carr[c] = (carr[c] || 0) + 1; });

console.log('\n  ── EL MAPEO: cada bloque del doc → su pieza (por campaña × segmento × mes)\n');
console.log('     ' + 'MES'.padEnd(7) + 'CAMPAÑA→'.padEnd(17) + 'SEGMENTO→'.padEnd(25) + 'PIEZA'.padEnd(11) + 'TP'.padEnd(9) + 'CARR'.padStart(5) + '   ESTADO');
console.log('     ' + '-'.repeat(112));
var mueven = [], igual = 0;
plan.forEach(function (r) {
  var b = r.bloque;
  var carrB = b.codigos.reduce(function (a, c) { return a + (carr[c] || 0); }, 0);
  if (!r.pieza) {
    console.log('     ' + b.mes.padEnd(7) + t(r.campana_canonica || '?').slice(0, 16).padEnd(17) + t(r.segmento_canonico || b.segmento).slice(0, 24).padEnd(25) +
      '—'.padEnd(11) + ''.padEnd(9) + String(carrB).padStart(5) + '   🔴 ' + r.motivo);
    return;
  }
  var pid = t(r.pieza[NM.Pieza_ID]);
  // ¿alguno de sus códigos está hoy en OTRA pieza?
  var mal = b.codigos.filter(function (c) { return (codHoy[c] || []).some(function (p) { return p !== pid; }) || !(codHoy[c] || []).length; });
  if (!mal.length) igual++;
  else mueven.push({ pid: pid, bloque: b, codigos: mal, r: r });
  console.log('     ' + b.mes.padEnd(7) + t(r.campana_canonica).slice(0, 16).padEnd(17) + t(r.segmento_canonico).slice(0, 24).padEnd(25) +
    pid.padEnd(11) + t(r.pieza[NM.TouchPoint]).padEnd(9) + String(carrB).padStart(5) + '   ' +
    (mal.length ? '🔧 mueve ' + mal.length + ': ' + mal.map(function (c) { return c + '(' + (codHoy[c] || ['—']).join('/') + ')'; }).join(' ') : '✔ ya está'));
  if (r.conflicto) console.log('     ' + ' '.repeat(7) + '🔴 ' + r.conflicto);
});

console.log('\n════ EL PLAN DE CORRECCIÓN ════\n');
console.log('   bloques del doc: ' + bloques.length);
console.log('   ✔ ya alineados:  ' + igual);
console.log('   🔧 a corregir:    ' + mueven.length);
console.log('   🔴 sin resolver:  ' + sinResolver.length + '   ·   ambiguos: ' + ambiguos.length);
if (mueven.length) {
  console.log('\n   ── los movimientos, uno por uno ──');
  mueven.forEach(function (m) {
    m.codigos.forEach(function (c) {
      var de = (codHoy[c] || []).join(',') || '(ninguna)';
      console.log('      ' + c.padEnd(11) + String(carr[c] || 0).padStart(5) + ' carritos   ' + de.padEnd(20) + ' → ' + m.pid +
        '   [' + m.bloque.mes + ' · ' + m.bloque.campana + ' · ' + m.bloque.segmento + ']');
    });
  });
}
fs.writeFileSync(BACK + '/_preescritura/PRE-alinear-doc-piezas.json', JSON.stringify({
  paso: 'fuentes-qcart.alinear-doc-piezas', regla: 'el bloque del doc (mes × campaña × segmento) manda; la pieza es Principal y se identifica por Email_Name',
  bloques: bloques.length, alineados: igual,
  mover: mueven.map(function (m) {
    return { pieza_destino: m.pid, email_name: t(m.r.pieza[NM.Email_Name]), touchpoint: t(m.r.pieza[NM.TouchPoint]),
      segmento: t(m.r.pieza[NM.Segmento]), mes: m.bloque.mes, campana_doc: m.bloque.campana, segmento_doc: m.bloque.segmento,
      codigos: m.codigos.map(function (c) { return { codigo: c, carritos: carr[c] || 0, hoy_en: codHoy[c] || [] }; }),
      recetas: m.bloque.recetas };
  }),
  sin_resolver: sinResolver.map(function (r) { return { bloque: r.bloque.llave, motivo: r.motivo, codigos: r.bloque.codigos }; }),
  ambiguos: ambiguos.map(function (r) { return { bloque: r.bloque.llave, motivo: r.motivo, candidatas: (r.candidatas || []).map(function (p) { return t(p[NM.Pieza_ID]); }) }; })
}, null, 1));
console.log('\n   → _preescritura/PRE-alinear-doc-piezas.json   ·   el Excel NO se tocó');
