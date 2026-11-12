// orquestador · EL GUARDIÁN DE NO-PÉRDIDA. Prueba que el corte no destruyó nada — por
//              ATRIBUCIÓN, no por peso.
//
// 🔴 LO PIDIÓ RICK ASÍ (3-sep-2026): «MUY IMPORTANTE QUE NO PIERDAS LO QUE YA ESTÁ ATRIBUIDO,
//    NO POR PESO DEL ARCHIVO SINO POR VALIDACIÓN REAL». La distinción es exacta: un archivo
//    puede pesar lo mismo, tener las mismas filas y hasta cuadrar sus totales mientras un
//    segmento entero se mudó al de al lado. Pasó con 191 carritos de marzo y la suma nunca se
//    movió — por eso ninguna puerta lo vio.
//
// 🔴 QUÉ SE COMPARA, Y POR QUÉ ESTAS COSAS:
//    1 · TODA hoja sigue existiendo.
//    2 · TODA pieza sigue existiendo con su MISMA campaña · touchpoint · segmento · tipo · canal.
//        Una pieza que cambia de segmento no se perdió: se movió, que es peor.
//    3 · TODO shortlink que estaba atribuido sigue atribuido. Que cambie de pieza es una
//        DECISIÓN y se lista aparte; que deje de estarlo es una pérdida y bloquea.
//    4 · TODA combinación campaña × touchpoint × segmento conserva su fila.
//    5 · Las NOTAS ESCRITAS A MANO no desaparecieron. Rick anota en el libro y sus notas no
//        están en ninguna fuente: si un script las pisa, no las reconstruye nadie.
//    6 · Ningún total BAJÓ.
//
// 🔴 Y NO CONFUNDE «CAMBIÓ» CON «SE PERDIÓ». Un corte agrega piezas, corrige códigos mal
//    colgados y sube cifras: eso es el trabajo. Lo que bloquea es la DESAPARICIÓN.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Ningún nombre de columna se escribe dentro de un corchete: los
//    ids lógicos se declaran UNA vez como constantes y todo lo demás los usa por variable.
//    Un corchete con literal devuelve `undefined` sin avisar, y `undefined` se lee como vacío.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'orquestador';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var Q = require(__dirname + '/lib-qcart-links.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESTADO = /^(PENDIENTE|POR DEFINIR|N\/A|NA|-)$/i;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

var ID_PIEZA = 'Pieza_ID';
var IDS_DIM = ['Campaña', 'TouchPoint', 'Segmento', 'Email_Type', 'Canal'];
var ID_CAMP = IDS_DIM[0], ID_TP = IDS_DIM[1], ID_SEG = IDS_DIM[2];

var REF = process.argv.slice(2).filter(function (x) { return x.indexOf('--') !== 0; })[0];
if (!REF) {
  var dir = BACK + '/_respaldos';
  var c = fs.readdirSync(dir).filter(function (f) { return /\.xlsx$/i.test(f); })
    .map(function (f) { return { f: f, m: fs.statSync(path.join(dir, f)).mtimeMs }; })
    .sort(function (a, b) { return a.m - b.m; });
  REF = c.length ? path.join(dir, c[c.length - 1].f) : null;
}
if (!REF || !fs.existsSync(REF)) { console.log('🔴 no hay respaldo de referencia contra el cual comparar'); process.exit(1); }

console.log('════════ GUARDIÁN DE NO-PÉRDIDA ════════\n');
console.log('  referencia: ' + path.basename(REF));
var vivo = L.archivoVivo({ dir: PROY });
console.log('  actual    : ' + path.basename(vivo.ruta) + '\n');

var TA = require('path').resolve(__dirname, '..') + '/_tmp/_np-a.xlsx', TZ = require('path').resolve(__dirname, '..') + '/_tmp/_np-z.xlsx';
fs.copyFileSync(REF, TA); fs.copyFileSync(vivo.ruta, TZ);
var A = XLSX.readFile(TA), Z = XLSX.readFile(TZ);

// ══ 1 · LAS HOJAS ═══════════════════════════════════════════════════════════════════
var hojasIdas = A.SheetNames.filter(function (h) { return Z.SheetNames.indexOf(h) < 0; });
chk('🔴 ninguna HOJA desapareció', hojasIdas.length === 0,
  hojasIdas.length ? '🔴 ' + hojasIdas.join(' · ') : A.SheetNames.length + ' hojas, todas siguen');

// ══ 2 · LAS PIEZAS Y SUS DIMENSIONES ════════════════════════════════════════════════
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;   // la forma del id: campaña + tipo + correlativo
function piezas(wb) {
  var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
  var nm = {};
  [ID_PIEZA].concat(IDS_DIM).forEach(function (id) { nm[id] = COL.de(P, id); });
  var out = {};
  P.forEach(function (p) {
    var id = t(p[nm[ID_PIEZA]]); if (!id) return;
    // 🔴 UNA FILA SIN LLAVE VÁLIDA NO ES UNA PIEZA. Rick usa el final de la hoja para anotar
    //    recados, y su llave queda vacía o con un token. Contarlas como piezas hizo que este
    //    guardián reportara «desapareció la pieza POR DEFINIR» al limpiar sus notas: una
    //    PÉRDIDA falsa sobre algo que nunca fue un registro. Es el mismo defecto que causó el
    //    daño — un llenador que trató esas cuatro filas como piezas y les escribió 340 tokens.
    if (!ES_PIEZA.test(id)) return;
    var cods = [];
    for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
      Q.codigosDe(p[pre + i]).forEach(function (c) { if (!ESTADO.test(t(c))) cods.push(c); });
    });
    var dim = {}; IDS_DIM.forEach(function (d) { dim[d] = t(p[nm[d]]); });
    out[id] = { dim: dim, cods: cods };
  });
  return out;
}
var pa = piezas(A), pz = piezas(Z);
var idas = Object.keys(pa).filter(function (id) { return !pz[id]; });
chk('🔴 ninguna PIEZA desapareció', idas.length === 0,
  idas.length ? '🔴 ' + idas.join(' · ') : Object.keys(pa).length + ' piezas → ' + Object.keys(pz).length);

var movidas = Object.keys(pa).filter(function (id) {
  return pz[id] && IDS_DIM.some(function (d) { return pa[id].dim[d] !== pz[id].dim[d]; });
});
chk('🔴 ninguna pieza CAMBIÓ de dimensión', movidas.length === 0,
  movidas.length ? '🔴 ' + movidas.slice(0, 5).map(function (id) {
      return id + ' [' + IDS_DIM.filter(function (d) { return pa[id].dim[d] !== pz[id].dim[d]; })
        .map(function (d) { return d + ' «' + pa[id].dim[d] + '»→«' + pz[id].dim[d] + '»'; }).join(' · ') + ']';
    }).join('   ')
  : 'las ' + Object.keys(pa).length + ' conservan campaña · touchpoint · segmento · tipo · canal');

// ══ 3 · LOS SHORTLINKS ATRIBUIDOS ═══════════════════════════════════════════════════
function porCodigo(m) { var o = {}; Object.keys(m).forEach(function (id) { m[id].cods.forEach(function (c) { o[c] = id; }); }); return o; }
var ca = porCodigo(pa), cz = porCodigo(pz);
var codIdos = Object.keys(ca).filter(function (c) { return !cz[c]; });
var codMov = Object.keys(ca).filter(function (c) { return cz[c] && cz[c] !== ca[c]; });
chk('🔴 ningún SHORTLINK dejó de estar atribuido', codIdos.length === 0,
  codIdos.length ? '🔴 ' + codIdos.map(function (c) { return c + ' (era de ' + ca[c] + ')'; }).join(' · ')
  : Object.keys(ca).length + ' códigos atribuidos → ' + Object.keys(cz).length);
if (codMov.length) {
  console.log('  ── códigos que CAMBIARON de pieza (' + codMov.length + ') — es una decisión, no una pérdida:');
  codMov.forEach(function (c) { console.log('     ' + c + '   ' + ca[c] + ' → ' + cz[c]); });
}

// ══ 4 · LAS FILAS DEL REPORTE ═══════════════════════════════════════════════════════
function combos(wb) {
  var F = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1, defval: '', blankrows: false });
  if (!F.length) return {};
  var filas = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
  var E = F[0].map(t), ix = function (n) { return E.indexOf(n); };
  var iC = ix(COL.de(filas, ID_CAMP)), iT = ix(COL.de(filas, ID_TP)), iS = ix(COL.de(filas, ID_SEG));
  var iCT = ix('Carritos_Total'), iSe = ix('Tot_Sends'), iW = ix('WA-Envíos');
  var o = {};
  for (var r = 1; r < F.length; r++) {
    var c = t(F[r][iC]); if (!c || c === 'Total') continue;
    var k = c + ' ¦ ' + t(F[r][iT]) + ' ¦ ' + t(F[r][iS]);
    o[k] = o[k] || { car: 0, sends: 0, wa: 0 };
    o[k].car += Number(F[r][iCT]) || 0; o[k].sends += Number(F[r][iSe]) || 0; o[k].wa += Number(F[r][iW]) || 0;
  }
  return o;
}
var fa = combos(A), fz = combos(Z);
// 🔴 UNA COMBINACIÓN QUE DESAPARECE PORQUE EL CATÁLOGO LA RENOMBRÓ NO ES UNA PÉRDIDA (3-sep-2026).
//    Rick declaró que `001-P032` es segmento «Tibios» (era POR DEFINIR) y que la pieza de
//    The Freshers es E-ENRICH1 (era E-A). El reporte se regeneró y esas dos combinaciones viejas
//    dejaron de existir — correctamente: el reporte se puso al día con la autoridad.
//    La prueba de que fue un renombre y no un borrado: **ninguna pieza del catálogo tiene ya esa
//    combinación**. Si alguna la tuviera y la fila no estuviera, ahí sí falta una fila.
//    Sin esta distinción el guardián marca en rojo el trabajo bien hecho, y un guardián que
//    grita cuando todo está bien enseña a ignorarlo — que es exactamente cómo se cuela el real.
var combosDelCatalogo = {};
Object.keys(pz).forEach(function (id) {
  var d = pz[id].dim;
  combosDelCatalogo[d[ID_CAMP] + ' ¦ ' + d[ID_TP] + ' ¦ ' + d[ID_SEG]] = id;
});
var comboIdos = [], comboRenombrados = [];
Object.keys(fa).forEach(function (k) {
  if (fz[k]) return;
  if (combosDelCatalogo[k]) comboIdos.push(k + '  (el catálogo SÍ tiene ' + combosDelCatalogo[k] + ' ahí: falta la fila)');
  else comboRenombrados.push(k);
});
chk('🔴 ninguna COMBINACIÓN campaña × touchpoint × segmento perdió su fila', comboIdos.length === 0,
  comboIdos.length ? '🔴 ' + comboIdos.slice(0, 5).join('   ·   ')
  : Object.keys(fa).length + ' combinaciones → ' + Object.keys(fz).length +
    (comboRenombrados.length ? '   ·   ' + comboRenombrados.length + ' se renombraron en el catálogo (no son pérdidas)' : ''));
if (comboRenombrados.length) {
  console.log('  ── combinaciones que el CATÁLOGO renombró (el reporte se puso al día):');
  comboRenombrados.forEach(function (k) { console.log('     ' + k); });
}

// ══ 5 · LO ESCRITO A MANO ═══════════════════════════════════════════════════════════
// 🔴 Rick anota en el libro; una nota suya no está en ninguna fuente. Se detectan por FORMA:
//    prosa en mayúsculas, con espacios, larga y sin guiones bajos — o sea, no un id ni un nombre
//    técnico. Nunca por dónde están: hoy viven en `Catalogo_Piezas!I147:I150` y mañana no.
function notas(wb) {
  var o = {};
  wb.SheetNames.forEach(function (h) {
    var F = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: '' });
    F.forEach(function (r, i) {
      if (i === 0) return;
      (r || []).forEach(function (v) {
        var s = t(v);
        if (s.length < 12 || !/\s/.test(s) || /_/.test(s)) return;
        if (!/^[A-ZÁÉÍÓÚÑ0-9·.,: ()-]+$/.test(s)) return;
        if (s !== s.toUpperCase()) return;
        // 🔴 UNA LISTA DE IDs NO ES UNA NOTA. `Catalogo_Referencias.Pieza_IDs` guarda cosas como
        //    «001-P005 001-P006 001-P025» — mayúsculas, con espacios y largas, o sea que pasan
        //    todos los filtros de forma anteriores. Contarlas inflaba el check a 103 «notas» y
        //    lo volvía ruido: un guardián que señala 103 cosas no señala ninguna.
        if (/^(\d{3}-[A-Z0-9-]+[\s,]*)+$/.test(s)) return;
        // y tiene que tener al menos DOS palabras de tres letras: una nota es prosa, no un código
        if ((s.match(/[A-ZÁÉÍÓÚÑ]{3,}/g) || []).length < 2) return;
        o[h + '!' + s] = { hoja: h, fila: i + 1, txt: s };
      });
    });
  });
  return o;
}
var na = notas(A), nz = notas(Z);
var notasIdas = Object.keys(na).filter(function (k) { return !nz[k]; });
chk('🔴 ninguna NOTA escrita a mano se perdió', notasIdas.length === 0,
  notasIdas.length ? '🔴 ' + notasIdas.map(function (k) { return '«' + na[k].txt.slice(0, 42) + '» (' + na[k].hoja + ' f' + na[k].fila + ')'; }).join(' · ')
  : Object.keys(na).length + ' nota(s) a mano, todas siguen');
if (Object.keys(nz).length) {
  console.log('  ── notas a mano en el libro actual (NO se tocan):');
  Object.keys(nz).forEach(function (k) { console.log('     ' + nz[k].hoja + ' f' + nz[k].fila + '  «' + nz[k].txt.slice(0, 62) + '»'); });
}

// ══ 6 · LOS TOTALES — solo BAJAR es sospechoso ══════════════════════════════════════
function tot(o) { return Object.keys(o).reduce(function (a, k) { return { car: a.car + o[k].car, sends: a.sends + o[k].sends, wa: a.wa + o[k].wa }; }, { car: 0, sends: 0, wa: 0 }); }
var ta = tot(fa), tz = tot(fz);
var bajaron = ['car', 'sends', 'wa'].filter(function (k) { return tz[k] < ta[k]; });
chk('ningún total BAJÓ', bajaron.length === 0,
  bajaron.length ? '⚠ ' + bajaron.map(function (k) { return k + ': ' + ta[k].toLocaleString('es-MX') + ' → ' + tz[k].toLocaleString('es-MX'); }).join(' · ') + ' — revisar si está explicado'
  : 'carritos ' + ta.car.toLocaleString('es-MX') + '→' + tz.car.toLocaleString('es-MX') +
    ' · sends ' + ta.sends.toLocaleString('es-MX') + '→' + tz.sends.toLocaleString('es-MX') +
    ' · WA ' + ta.wa.toLocaleString('es-MX') + '→' + tz.wa.toLocaleString('es-MX'));

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔ ' : '🔴 ') + v[0].slice(0, 58).padEnd(60) + v[2]); });
fs.writeFileSync(BACK + '/_fuentes/no-perdida.json', JSON.stringify({
  paso: 'orquestador.guardian-no-perdida', referencia: path.basename(REF), cuando: new Date().toISOString(),
  piezas_idas: idas, piezas_movidas: movidas, codigos_idos: codIdos, codigos_movidos: codMov,
  combinaciones_idas: comboIdos, notas_idas: notasIdas.map(function (k) { return na[k]; }),
  notas_actuales: Object.keys(nz).map(function (k) { return nz[k]; }),
  totales: { antes: ta, ahora: tz }, fallos: fallo
}, null, 1));
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' PÉRDIDA(S) — el corte NO se da por bueno' : '✅ NADA SE PERDIÓ — probado por atribución, no por peso'));
console.log('  → _fuentes/no-perdida.json');
process.exit(fallo ? 1 : 0);
