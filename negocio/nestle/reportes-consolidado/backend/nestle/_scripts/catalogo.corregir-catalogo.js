// catalogo-aplicar · APLICA al catálogo las correcciones que catalogo-leer leyó del documento.
//
// 🔴 LO QUE CORRIGE, Y POR QUÉ NINGUNA ES COSMÉTICA:
//    1. Tres columnas nuevas: `EmailID`, `Oleada`, `Mascota`. La que resuelve el enredo de fondo
//       es `Oleada`: hay seis pares de filas con BU, Marca, Campaña, Touchpoint, Segmento y Tipo
//       IDÉNTICOS, y nada en la fila decía cuál era la de marzo y cuál la de abril. Al capturar
//       los números se cruzaron. Con la oleada, esas seis colisiones dejan de existir.
//    2. Los 12 números de AON: los de abril recibieron el número de su par de marzo, y los de
//       marzo quedaron con la SUMA de los dos. Las seis sumas cuadran a ±1, así que la mecánica
//       está probada, no supuesta.
//    3. Dos ContentName (`001-P025`, `001-P027`) que traían el nombre de marzo.
//    4. Pro Plan: 12 filas nuevas. Hoy hay una fila por grupo con la SUMA de las tres mascotas,
//       pero su ContentName apunta a una sola — por eso `009-P003` se veía con 185 envíos.
//    5. Seis notas cuyo diagnóstico («dígitos transpuestos 863587→803867») era FALSO: son dos
//       journeys distintos, no un typo.
//
// ⚠ Las columnas nuevas van al FINAL, nunca intercaladas: insertar en medio corre todo lo de la
//   derecha y rompe cualquier referencia por letra.
// ⚠ Las 62 piezas que cuadran NO se tocan. El doc es explícito.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
// 🔴 EL UMBRAL DE «ESTO FUE UNA PRUEBA», el mismo que usa  para decidir qué
//    jobs no son envíos de campaña. Vive aquí porque este paso compara la cifra BRUTA del
//    documento contra la LIMPIA del catálogo: sin tolerancia, cada corrida devolvía los correos
//    de prueba a la hoja y la PUERTA 1 lo leía como una pérdida de 65 envíos.
var TOLERANCIA_PRUEBA = 10;

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var C = JSON.parse(fs.readFileSync(BACK + '/_catalogo/correcciones.json', 'utf8'));
console.log('════════ catalogo-aplicar · corregir el catálogo ' + (ESCRIBIR ? '(ESCRIBE)' : '(solo diff)') + ' ════════\n');
console.log('  documento: ' + C.documento.split('/').pop() + '   leído ' + C.leido);
console.log('  autoridad: ' + C.autoridad + '\n');

var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_cat1f.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Catalogo_Piezas'];
var r = XLSX.utils.decode_range(sh['!ref']);
var colIdx = {}, ultima = -1;
for (var c = r.s.c; c <= r.e.c; c++) {
  var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })];
  if (h && t(h.v)) { colIdx[t(h.v)] = c; if (c > ultima) ultima = c; }
}
var P = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
var filaDe = {};                       // pieza_id → nº de fila en la hoja (1-based)
P.forEach(function (p, i) { if (t(p['Pieza_ID'])) filaDe[t(p['Pieza_ID'])] = i + 2; });
console.log('  catálogo: ' + P.length + ' piezas · ' + Object.keys(colIdx).length + ' columnas · última fila ' + (P.length + 1));

// ══ 1 · LAS TRES COLUMNAS NUEVAS ════════════════════════════════════════════════════
// 🔴 EL ID LÓGICO YA TIENE NOMBRE FÍSICO — y no saberlo recreaba una columna fantasma en cada
//    corrida. `EmailID` fue el nombre con que este paso la creó; hoy esa columna se llama
//    `Email_ID (de la DE de SFMC)` y las dos convivieron hasta que se fusionaron y se retiró la
//    vieja. Pero catalogo-aplicar volvía a crear `EmailID` en la corrida siguiente, porque preguntaba por el
//    nombre viejo y no lo encontraba. Retirar aguas abajo del que la crea no sirve de nada:
//    hay que enseñarle al creador cómo se llama hoy.
//    Es el registro de nombres aplicado donde importa: el id lógico es inmutable, el nombre físico
//    cambia, y quien escribe pregunta por el actual.
var NOMBRE_FISICO = { 'EmailID': 'Email_ID (de la DE de SFMC)' };
function fisica(idLogico) {
  var n = NOMBRE_FISICO[idLogico];
  if (n && colIdx[n] !== undefined) return n;
  return idLogico;
}
C.columnas_nuevas = C.columnas_nuevas.map(fisica);
var NUEVAS = C.columnas_nuevas.filter(function (c) { return colIdx[c] === undefined; });
console.log('\n  ── columnas nuevas: ' + (NUEVAS.join(' · ') || 'ninguna, ya están'));

// ══ 2 · EL PLAN DE CAMBIOS, ANTES DE TOCAR NADA ═════════════════════════════════════
var plan = [], avisos = [], yaEnPlan = {};
// ⚠ una misma celda puede llegar por dos caminos: las 3 filas de Pro Plan estan en la tabla de
//   EmailID (§4) Y en la de mascotas (§3). Escribir dos veces la misma celda no rompe nada, pero
//   infla el diff y esconde si los dos caminos dicen cosas DISTINTAS — que es lo que si importa.
function cambio(pieza, columna, de, a, motivo) {
  var k = pieza + '|' + columna;
  if (yaEnPlan[k] !== undefined) {
    if (String(yaEnPlan[k]) !== String(a)) {
      avisos.push('🔴 ' + pieza + '.' + columna + ': el doc lo pide con DOS valores distintos, «' +
        yaEnPlan[k] + '» y «' + a + '» — no se escribe ninguno hasta resolverlo');
      plan = plan.filter(function (x) { return !(x.pieza === pieza && x.columna === columna); });
      yaEnPlan[k] = '¦CONFLICTO¦';
    }
    return;
  }
  yaEnPlan[k] = a;
  plan.push({ pieza: pieza, fila: filaDe[pieza], columna: columna, de: de, a: a, motivo: motivo });
}

// 2a · EmailID en las 76 piezas de email
var sinFila = [];
Object.keys(C.email_id).forEach(function (pid) {
  if (!filaDe[pid]) { sinFila.push(pid); return; }
  cambio(pid, fisica('EmailID'), '(vacío)', C.email_id[pid], 'identificador del creativo en SFMC');
});
if (sinFila.length) avisos.push('🔴 el doc trae ' + sinFila.length + ' pieza(s) que NO están en el catálogo: ' + sinFila.join(' · '));

// 2b · AON: oleada, envíos y ContentName
Object.keys(C.aon).forEach(function (pid) {
  var a = C.aon[pid], f = filaDe[pid];
  if (!f) return;
  var actual = P[f - 2];
  cambio(pid, 'Oleada', '(vacío)', a.oleada, 'la dimensión que faltaba: journey ' + (a.journey_id || '?'));
  var sendsHoy = Number(String(actual['Sends']).replace(/[, ]/g, '')) || 0;
  // ⚠ se comprueba que la hoja traiga EXACTAMENTE lo que el doc dice que traía. Si no coincide,
  //   alguien ya la tocó y corregir a ciegas pisaría ese trabajo.
  if (a.traia !== null && sendsHoy !== a.traia) {
    avisos.push('⚠ ' + pid + ': el doc dice que traía ' + mil(a.traia) + ' y la hoja tiene ' + mil(sendsHoy) + ' — se corrige igual, pero míralo');
  }
  // 🔴 LA MISMA TOLERANCIA QUE EN PRO PLAN, y por la misma razón: el documento trae la cifra
  //    BRUTA de SFMC y el catálogo la limpia (sin los correos de prueba). Escribir la del
  //    documento devolvería esos envíos a la fila y la PUERTA 1 lo vería como una pérdida.
  //    La corrección de AON sigue viva —arregla que abril traía el número de marzo, que son
  //    miles de diferencia— pero ya no pisa por 1 o 2 envíos de prueba.
  if (sendsHoy !== a.sends && Math.abs(sendsHoy - a.sends) > TOLERANCIA_PRUEBA) {
    cambio(pid, 'Sends', mil(sendsHoy), a.sends, 'AON: el de abril traía el número de marzo y el de marzo la suma de los dos');
  }
  if (a.cambiar_cn) {
    // el doc da la COLA; el catálogo guarda el nombre completo. Se sustituye la cola.
    var cnHoy = t(actual['Content_Name']);
    var base = cnHoy.replace(/[^_]*_[^_]*_[^_]*_[^_]*_[^_]*_\d+$/, '');
    var cnNuevo = base + a.content_name_cola;
    cambio(pid, 'Content_Name', '…' + cnHoy.slice(-46), cnNuevo, 'traía el ContentName de MARZO siendo la fila de ABRIL');
  }
});

// 2c · las notas falsas
Object.keys(C.notas).forEach(function (pid) {
  if (!filaDe[pid]) return;
  var actual = t(P[filaDe[pid] - 2]['Notas']);
  cambio(pid, 'Notas', actual ? '«' + actual.slice(0, 40) + '»' : '(vacío)', C.notas[pid].poner,
    'el diagnóstico «dígitos transpuestos» era FALSO: son dos journeys distintos');
});

// 2d · Pro Plan: corregir las 3 existentes y dar de alta las 12 nuevas
//
// 🔴 EL ALTA SE DECIDE POR IDENTIDAD DE NEGOCIO, NO POR ID — y no tenerlo así clonó el catálogo.
//    Esto preguntaba `filaDe[p.pieza_id]`, pero estas piezas vienen del documento SIN `pieza_id`
//    (por eso son «nuevas»), y el id que se les asigna al escribirlas nunca vuelve al documento.
//    Resultado: en CADA corrida de la cadena volvían a ser nuevas y se daban de alta otra vez, con
//    ids frescos. Medido el 25-ago: **204 filas sobrantes** — 17 copias de cada una de las 12,
//    `009-P018 = 009-P030 = 009-P042 = …`, mismos sends, misma mascota, misma campaña.
//    Y ninguna guarda lo veía: los `Pieza_ID` son todos DISTINTOS, así que «id único» salía verde.
//    Lo que se repite no es el id: es la PIEZA. Por eso la llave de existencia lleva la identidad.
var yaExistian = 0;
// 🔴 8-sep-2026 · UNA LLAVE DE IDENTIDAD NO PUEDE LLEVAR UNA MÉTRICA. Ésta llevaba los envíos,
//    y el día que se limpiaron los correos de prueba del catálogo (19,213 → 19,206) la identidad
//    dejó de casar y las 12 piezas volvieron a ser «nuevas»: la cadena recreó 11 de las 12 que
//    se acababan de retirar. Un número que cambia con cada refresh no identifica nada.
//    Tampoco sirve el id del creativo: el documento llega SIN él —las filas recreadas nacen
//    vacías ahí— y por eso la llave vieja tampoco las reconocía.
//
// 🔴 LA LLAVE QUE SÍ: campaña · mascota · segmento. Y como dos piezas comparten las tres (el
//    mismo segmento sale en E-E3 y en E-E4), el desempate son los envíos CON TOLERANCIA — no
//    como parte de la llave, sino como criterio de CERCANÍA. La tolerancia es el umbral de
//    prueba (10): la diferencia entre el documento y el catálogo limpio es exactamente lo que
//    aportaban los correos de prueba de esa pieza, entre 0 y 7 envíos.
//
// 🔴 Y EL SEGMENTO SE COMPARA POR PREFIJO: el catálogo lo guarda con la mascota pegada —la
//    regla de identidad de Pro Plan— y el documento solo trae la parte de la persona.
var nmCampX = COL.de(P, 'Campaña');
var nmMascX = COL.de(P, 'Mascota');
var nmSegX = COL.de(P, 'Segmento');
var nmSendsX = COL.de(P, 'Sends');
var nmPiezaX = COL.de(P, 'Pieza_ID');
var nmEmailIdX = COL.de(P, 'Email_ID (de la DE de SFMC)');
function identidadProPlan(campana, mascota, emailId) {
  return [campana, mascota, emailId].map(function (x) { return t(x).toLowerCase(); }).join('¦');
}

// el índice guarda TODAS las filas de cada identidad, para poder desempatar por envíos
var yaEnCatalogo = {};
P.forEach(function (fila, i) {
  var k = identidadProPlan(fila[nmCampX], fila[nmMascX], fila[nmEmailIdX]);
  (yaEnCatalogo[k] = yaEnCatalogo[k] || []).push(i + 2);
});
// 🔴 PRIMERO POR EL ID DEL CREATIVO, que es exacto. Solo si el documento llega sin él se cae al
//    desempate por envíos — y ése puede quedar ambiguo, en cuyo caso NO se decide.
function filaQueYaEsta(campana, mascota, emailId, sends) {
  if (t(emailId)) {
    var exacta = yaEnCatalogo[identidadProPlan(campana, mascota, emailId)];
    if (exacta && exacta.length === 1) return exacta[0];
  }
  var pref = identidadProPlan(campana, mascota, '');
  var cand = [];
  Object.keys(yaEnCatalogo).forEach(function (k) {
    if (k.indexOf(pref) !== 0) return;   // `pref` termina en «¦», así que casa con cualquier id
    yaEnCatalogo[k].forEach(function (nf) { cand.push(nf); });
  });
  if (!cand.length) return null;
  var cerca = cand.filter(function (nf) {
    var sc = Number(String(P[nf - 2][nmSendsX]).replace(/[, ]/g, '')) || 0;
    return Math.abs(Number(sends) - sc) <= TOLERANCIA_PRUEBA;
  });
  // 🔴 si hay DOS candidatas igual de cerca, no se decide: se devuelve null y la pieza cae al
  //    camino de alta, donde la guarda de clonación la va a parar. Adivinar cuál es sería peor.
  if (cerca.length === 1) return cerca[0];
  if (!cerca.length) return null;
  // 🔴 SI VARIAS CAEN DENTRO DE LA TOLERANCIA, GANA LA MÁS CERCANA — pero solo si gana CLARO.
  //    Caso real: el documento trae 157 envíos y hay dos candidatas «Mixto», una con 153 (dif 4)
  //    y otra con 148 (dif 9). Las dos entran en la tolerancia de 10, así que exigir «solo una»
  //    las declaraba ambiguas y creaba un duplicado. La de 153 está a menos de la mitad de
  //    distancia: eso no es adivinar, es que una está claramente más cerca.
  //    Si dos empatan o casi, NO se decide: se devuelve null y la guarda de clonación para el paso.
  var conDist = cerca.map(function (nf) {
    var sc = Number(String(P[nf - 2][nmSendsX]).replace(/[, ]/g, String.fromCharCode(39, 39).slice(0,0))) || 0;
    return { nf: nf, d: Math.abs(Number(sends) - sc) };
  }).sort(function (a, b) { return a.d - b.d; });
  return (conDist[1].d - conDist[0].d) >= 2 ? conDist[0].nf : null;
}
var altas = [];
C.proplan.forEach(function (p) {
  // ¿esta pieza ya está, aunque haya llegado sin id? entonces NO es un alta —
  // 🔴 PERO TAMPOCO ES «NO HACER NADA». Mi primer corte devolvía aquí y de paso se saltaba las
  //    CORRECCIONES de esa fila, así que 12 piezas de Pro Plan se quedaron sin su EmailID en la
  //    columna viva y el retirador —con razón— se negó a retirar la vieja. «Ya existe» responde a
  //    si se da de alta, no a si se corrige: son dos preguntas y confundirlas dejó el trabajo a medias.
  //    Se le resuelve su `pieza_id` desde la fila que ya está y se sigue por el camino normal.
  var filaYa = p.pieza_id ? null : filaQueYaEsta(p.campana || 'Fuel for life', p.mascota, p.email_id, p.sends);
  if (filaYa) {
    yaExistian = (yaExistian || 0) + 1;
    p = Object.assign({}, p, { pieza_id: t(P[filaYa - 2][nmPiezaX]) });
  }
  if (p.pieza_id && filaDe[p.pieza_id]) {
    var actual = P[filaDe[p.pieza_id] - 2];
    var sHoy = Number(String(actual['Sends']).replace(/[, ]/g, '')) || 0;
    cambio(p.pieza_id, 'Mascota', '(vacío)', p.mascota, 'la mascota es su propia dimensión, no parte del segmento');
    cambio(p.pieza_id, fisica('EmailID'), '(vacío)', p.email_id, 'SFMC');
    // 🔴 NO SE PISA `Sends` SI LA DIFERENCIA SON LOS CORREOS DE PRUEBA. El documento trae la
    //    cifra BRUTA de SFMC (19,213) y el catálogo tiene la limpia (19,206): escribir la del
    //    documento devolvía los 7 correos de prueba a la fila, y la PUERTA 1 lo detectaba como
    //    «el bloque trae 65 MENOS que el catálogo». La limpieza y este paso tienen que estar de
    //    acuerdo, y quien manda es la limpieza: el bruto incluye envíos que no son de campaña.
    var difSends = Math.abs(sHoy - p.sends);
    if (sHoy !== p.sends && difSends > TOLERANCIA_PRUEBA) {
      cambio(p.pieza_id, 'Sends', mil(sHoy), p.sends, 'era la SUMA de las tres mascotas; ahora es solo la suya');
    }
  } else if (p.nueva) {
    altas.push(p);
  }
});

console.log('\n  ── CAMBIOS sobre filas existentes: ' + plan.length);
var porCol = {}; plan.forEach(function (x) { porCol[x.columna] = (porCol[x.columna] || 0) + 1; });
Object.keys(porCol).sort(function (a, b) { return porCol[b] - porCol[a]; }).forEach(function (k) {
  console.log('     ' + k.padEnd(16) + porCol[k]);
});
// 🔴 LA GUARDA QUE NO DEPENDE DE QUE LA LLAVE ESTÉ BIEN. Sea cual sea el defecto de mañana, el
//    catálogo no puede tener MÁS piezas de Pro Plan que envíos tiene SFMC. Si este paso fuera a
//    dejarlo por encima, se detiene: es la señal de que se está clonando otra vez. La llave se
//    puede volver a equivocar; esta cuenta no.
(function () {
  var dirI = require('path').resolve(__dirname, '..') + '/_insumos';
  var cI = fs.readdirSync(dirI).filter(function (x) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(x); }).sort();
  if (!cI.length) return;
  var S = JSON.parse(fs.readFileSync(dirI + '/' + cI[cI.length - 1], 'utf8'));
  var enSfmc = (S.rows || S.data || []).filter(function (r) { return /Proplan/i.test(t(r.EmailName)); }).length;
  var enCat = P.filter(function (x) { return /Pro Plan|Aspiracionales/i.test(t(x[nmSegX])); }).length;
  var quedaria = enCat + altas.length;
  console.log('\n  ── guarda de clonación: SFMC tiene ' + enSfmc + ' piezas de Pro Plan · el catálogo quedaría con ' + quedaria);
  if (enSfmc && quedaria > enSfmc) {
    console.log('     🔴 el catálogo tendría MÁS piezas que envíos hay en SFMC: se está clonando.');
    console.log('     🔴 NO se aplica nada. Hay que revisar la llave de identidad antes de seguir.');
    process.exit(1);
  }
  console.log('     ✔ no se clona');
})();

console.log('\n  ── ALTAS (filas nuevas de Pro Plan): ' + altas.length);
if (yaExistian) console.log('     ✔ ' + yaExistian + ' ya estaban en el catálogo por identidad (campaña·mascota·EmailID·sends) — NO se vuelven a dar de alta');
altas.forEach(function (a) {
  console.log('     ' + String(a.persona_codigo).padEnd(4) + String(a.mascota).padEnd(7) + 'EmailID ' + a.email_id +
    '  ' + String(mil(a.sends)).padStart(7) + '  ' + a.fechas + (a.por_confirmar ? '   ⚠ POR CONFIRMAR' : ''));
});
console.log('\n  ── los cambios que NO son de rellenar un vacío (pisan un valor):');
plan.filter(function (x) { return x.de !== '(vacío)'; }).forEach(function (x) {
  console.log('     ' + x.pieza + '  ' + x.columna.padEnd(14) + String(x.de).padStart(9) + '  →  ' + x.a);
});
if (avisos.length) { console.log('\n  ── avisos'); avisos.forEach(function (a) { console.log('     ' + a); }); }

if (!ESCRIBIR) {
  console.log('\n  ── solo diff. Para escribir: node catalogo.corregir-catalogo.js --escribir');
  process.exit(0);
}

// ══ 3 · ESCRIBIR ════════════════════════════════════════════════════════════════════
var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Catalogo_Piezas') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
var xml = zip.readAsText(parte);

// 3a · las columnas nuevas, al final
NUEVAS.forEach(function (nom, k) {
  var ci = ultima + 1 + k;
  colIdx[nom] = ci;
  var ref = col(ci) + '1';
  xml = CX.poner(xml, ref, CX.celda(ref, nom, CX.estiloDe(xml, 'A1')), 1).xml;
});
if (NUEVAS.length) console.log('\n  ➕ columnas creadas: ' + NUEVAS.join(' · '));

// 3b · los cambios
var comoSalio = {};
plan.forEach(function (x) {
  var ci = colIdx[x.columna];
  if (ci === undefined) { console.log('   🔴 no existe la columna ' + x.columna); return; }
  var ref = col(ci) + x.fila;
  var v = typeof x.a === 'number' ? x.a : (/^\d+$/.test(String(x.a)) && x.columna !== 'EmailID' ? Number(x.a) : x.a);
  var res = CX.poner(xml, ref, CX.celda(ref, v, CX.estiloDe(xml, ref)), x.fila);
  xml = res.xml; comoSalio[res.como] = (comoSalio[res.como] || 0) + 1;
});
console.log('  ✔ ' + plan.length + ' celdas   (' + Object.keys(comoSalio).map(function (k) { return k + ' ' + comoSalio[k]; }).join(' · ') + ')');

// 3c · las altas — al final de la hoja, con su Pieza_ID nuevo dentro de la campaña 009
// 🔴 el correlativo vive DENTRO de la campaña: así una campaña nueva no mueve los ids de otra.
var maxP = 0;
P.forEach(function (p) { var m = /^009-P(\d+)$/.exec(t(p['Pieza_ID'])); if (m && +m[1] > maxP) maxP = +m[1]; });
var filaBase = P.length + 1;
var modelo = P[filaDe['009-P002'] - 2] || {};
var filasXml = altas.map(function (a, k) {
  var nFila = filaBase + 1 + k;
  var pid = '009-P' + String(maxP + 1 + k).padStart(3, '0');
  a.pieza_id_asignado = pid;
  var vals = {};
  // hereda del modelo lo que NO cambia entre mascotas, y pone lo suyo en el resto
  ['BU', 'Marca', 'Campaña', 'Camp_ID', 'Journey_ID', 'Objetivo', 'Canal', 'Email_Type', 'Tipo_Envio',
    'Fuente_Dato', 'Clicks_Medidos', 'Estado'].forEach(function (cN) { if (colIdx[cN] !== undefined) vals[cN] = t(modelo[cN]); });
  vals['Pieza_ID'] = pid;
  vals['Touchpoint'] = /E4/.test(a.content_name) ? 'E-E4' : 'E-E3';
  vals['Segmento'] = a.persona || a.persona_codigo;
  vals['Mascota'] = a.mascota;
  vals['EmailID'] = a.email_id;
  vals['Content_Name'] = a.content_name;
  vals['Sends'] = a.sends;
  vals['Notas'] = 'Alta desde CATALOGO-CORRECCIONES.md (' + C.leido + '), linea ' + a.linea + '. Fechas: ' + a.fechas +
    (a.por_confirmar ? '. POR CONFIRMAR: ' + a.por_confirmar : '');
  // 🔴 LAS CELDAS VAN EN ORDEN DE COLUMNA, y `Object.keys()` devuelve el orden en que YO las
  //    escribí, no el de la hoja. Con el orden de inserción, la fila sale con `Pieza_ID` (col D)
  //    después de `Estado` (col BU) — y Excel se NIEGA A ABRIR el libro, sin ofrecer repararlo.
  //    Es el mismo defecto que rompió `Data_WhatsApp` hoy. Se ordena por índice de columna.
  var celdas = Object.keys(vals)
    .filter(function (cN) { return colIdx[cN] !== undefined && vals[cN] !== '' && vals[cN] !== null; })
    .sort(function (a, b) { return colIdx[a] - colIdx[b]; })
    .map(function (cN) {
      var ci = colIdx[cN];
      var ref = col(ci) + nFila;
      return CX.celda(ref, vals[cN], CX.estiloDe(xml, col(ci) + (filaDe['009-P002'] || 2)));
    }).join('');
  return '<row r="' + nFila + '">' + celdas + '</row>';
}).join('');
if (altas.length) {
  xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
  xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1) {
    return '<dimension ref="' + c1 + r1 + ':' + col(ultima + NUEVAS.length) + (filaBase + altas.length) + '"/>';
  });
  console.log('  ✔ ' + altas.length + ' filas nuevas: ' + altas.map(function (a) { return a.pieza_id_asignado; }).join(' · '));
}

zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save');
var res2 = safeSave(SECO, SECO);
console.log('     validado: ' + (res2.validado || '?'));

// ══ 4 · RELEER ══════════════════════════════════════════════════════════════════════
var wb2 = XLSX.readFile(SECO);
var P2 = XLSX.utils.sheet_to_json(wb2.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('\n  ── releído: ' + P2.length + ' piezas · ' + Object.keys(P2[0] || {}).length + ' columnas');
console.log('     con EmailID : ' + P2.filter(function (p) { return t(p['EmailID']); }).length);
console.log('     con Oleada  : ' + P2.filter(function (p) { return t(p['Oleada']); }).length);
console.log('     con Mascota : ' + P2.filter(function (p) { return t(p['Mascota']); }).length);
var sumaAON = P2.filter(function (p) { return /^001-P00[1-6]$|^001-P02[3-8]$/.test(t(p['Pieza_ID'])); })
  .reduce(function (a, p) { return a + (Number(String(p['Sends']).replace(/[, ]/g, '')) || 0); }, 0);
console.log('     Σ sends de los 12 de AON: ' + mil(sumaAON) + '   (el doc suma ' +
  mil(Object.keys(C.aon).reduce(function (a, k) { return a + C.aon[k].sends; }, 0)) + ')');
fs.writeFileSync(BACK + '/_catalogo/correcciones-aplicadas.json', JSON.stringify({
  cuando: C.leido, cambios: plan.length, altas: altas.map(function (a) { return { pieza_id: a.pieza_id_asignado, email_id: a.email_id, mascota: a.mascota, persona: a.persona_codigo, sends: a.sends, por_confirmar: a.por_confirmar }; }),
  avisos: avisos, plan: plan
}, null, 1));
console.log('\n  archivo listo en: ' + SECO);
console.log('  ⚠ NO se copió al original: eso es el paso siguiente, tras la cadena de validación.');
