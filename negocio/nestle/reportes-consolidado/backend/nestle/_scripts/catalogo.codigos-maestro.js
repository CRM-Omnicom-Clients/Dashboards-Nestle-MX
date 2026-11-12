// N1h · LOS CÓDIGOS DE QCART, RECONCILIADOS CONTRA EL MAESTRO. Etapa 4 · skill del catálogo.
//
// 🔴 QUÉ DESTAPÓ ESTO. Rick lleva repitiendo que **Liga MX tiene sus segmentos y su Qcart
//    SEPARADOS** y que «no queda». Medido contra el maestro de links, el defecto es concreto:
//
//      `005-P002` (E-P2 · Futboleros) declara los códigos `9isauWgY · Hqa0fbOM · UhCnTNuz ·
//      TYZa8g47`. El maestro dice que esos cuatro son del bloque **`e-j5`** — y de sus DOS
//      audiencias: `9isauWgY`+`Hqa0fbOM` son `sinregion`, `UhCnTNuz`+`TYZa8g47` son `conregion`.
//
//    O sea: un touchpoint que no es, y las dos audiencias colapsadas en una pieza. Cualquier
//    carrito de E-J5 caía en Futboleros E-P2 y las dos audiencias se sumaban en una sola celda.
//    **Y cuadraba igual**, porque el total de carritos no cambia al meterlos en la fila equivocada
//    — que es justo el defecto que ninguna puerta ve.
//
// 🔴 LA AUTORIDAD ES EL MAESTRO, no el catálogo. Lo dice el propio skill: «la autoridad es
//    `ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx`, no `Data_Qcart`». Este paso compara y
//    declara; **no borra nada**: lo que sobra se marca para que Rick decida, lo que falta se apunta.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var MA = require(__dirname + '/lib-maestro-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var SOLO = (function () { var i = process.argv.indexOf('--campana'); return i > 0 ? process.argv[i + 1] : null; })();

console.log('════════ N1h · CÓDIGOS vs MAESTRO ════════\n');
var M = MA.cargar();
console.log('  el maestro declara ' + M.filas.length + ' shortlinks\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var F = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var COLS_COD = enc.filter(function (c) { return /^Cod_/.test(c); });

// dónde declara el catálogo cada código
var enCatalogo = {};
F.forEach(function (r, i) {
  COLS_COD.forEach(function (c) {
    var v = t(r[c]);
    if (!v || v === 'N/A' || v === 'PENDIENTE' || v === 'POR DEFINIR') return;
    (enCatalogo[v] = enCatalogo[v] || []).push({ fila: i + 2, columna: c, pieza: t(r['Pieza_ID']),
      campana: t(r['Campaña']), tp: t(r['TouchPoint']), seg: t(r['Segmento']) });
  });
});

// 🔴 el contraste, código por código
var contradice = [], sinDeclarar = [], enDosPiezas = [], deMas = [];
Object.keys(M.porCodigo).forEach(function (cod) {
  var m = M.porCodigo[cod];
  if (SOLO && t(m.utm_campaign).toLowerCase().indexOf(SOLO.toLowerCase()) < 0) return;
  var cat = enCatalogo[cod] || [];
  if (!cat.length) { sinDeclarar.push({ cod: cod, maestro: m }); return; }
  if (cat.length > 1) enDosPiezas.push({ cod: cod, maestro: m, piezas: cat.map(function (x) { return x.pieza; }) });
  cat.forEach(function (c) {
    // el touchpoint del maestro (`utm_content`) vs el de la pieza donde está declarado
    var tpM = t(m.utm_content).toLowerCase().replace(/[^a-z0-9]/g, '');
    var tpC = t(c.tp).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tpM && tpC && tpM !== tpC) {
      contradice.push({ cod: cod, pieza: c.pieza, tp_catalogo: c.tp, tp_maestro: m.utm_content,
        audiencia_maestro: m.utm_term, receta: m.receta, campana: m.utm_campaign, fila: c.fila, columna: c.columna });
    }
  });
});
Object.keys(enCatalogo).forEach(function (cod) {
  if (M.porCodigo[cod]) return;
  var c = enCatalogo[cod][0];
  if (SOLO && t(c.campana).toLowerCase().indexOf(SOLO.toLowerCase()) < 0) return;
  deMas.push({ cod: cod, pieza: c.pieza, campana: c.campana, tp: c.tp });
});

console.log('  🔴 códigos cuyo TOUCHPOINT contradice al maestro: ' + contradice.length);
contradice.forEach(function (x) {
  console.log('     ' + x.cod.padEnd(11) + 'catálogo lo pone en ' + x.pieza + ' (' + x.tp_catalogo + ')' +
    '   ·   el maestro dice ' + x.tp_maestro + ' ¦ ' + (x.audiencia_maestro || '(sin audiencia)') + '   «' + x.receta + '»');
});
console.log('\n  ⚠ el mismo código en DOS piezas: ' + enDosPiezas.length);
enDosPiezas.forEach(function (x) { console.log('     ' + x.cod + ' → ' + x.piezas.join(' y ') + '   (maestro: ' + x.maestro.utm_content + ' ¦ ' + x.maestro.utm_term + ')'); });
console.log('\n  ⚠ códigos del maestro que NINGUNA pieza declara: ' + sinDeclarar.length);
sinDeclarar.slice(0, 8).forEach(function (x) { console.log('     ' + x.cod.padEnd(11) + x.maestro.utm_campaign + ' · ' + x.maestro.utm_content + ' ¦ ' + x.maestro.utm_term); });
console.log('\n  ⚠ códigos del catálogo que el maestro NO declara: ' + deMas.length);
deMas.slice(0, 8).forEach(function (x) { console.log('     ' + x.cod.padEnd(11) + x.pieza + ' · ' + x.campana + ' · ' + x.tp); });

// las audiencias que el maestro declara por campaña — para ver si alguna se está colapsando
console.log('\n  ── AUDIENCIAS QUE DECLARA EL MAESTRO, por campaña y touchpoint ──');
var camps = {};
M.filas.forEach(function (f) { camps[f.utm_campaign] = 1; });
Object.keys(camps).sort().forEach(function (c) {
  if (SOLO && c.toLowerCase().indexOf(SOLO.toLowerCase()) < 0) return;
  var bl = MA.bloquesDe(c);
  var porTP = {};
  bl.forEach(function (b) { (porTP[b.utm_content || '(sin tp)'] = porTP[b.utm_content || '(sin tp)'] || []).push(b.utm_term || '(sin audiencia)'); });
  Object.keys(porTP).forEach(function (tp) {
    if (porTP[tp].length > 1) console.log('     🔴 ' + c + ' · ' + tp + ' tiene ' + porTP[tp].length + ' audiencias: ' + porTP[tp].join(' / ') + '  → deben ser ' + porTP[tp].length + ' filas, no 1');
  });
});

fs.writeFileSync(BACK + '/_contratos/codigos-vs-maestro.json', JSON.stringify({
  paso: 'N1h', autoridad: MA.RUTA,
  contradice: contradice, en_dos_piezas: enDosPiezas, sin_declarar: sinDeclarar, de_mas: deMas
}, null, 1));
console.log('\n  → _contratos/codigos-vs-maestro.json');
console.log('  ⚠ este paso NO corrige: declara. Corregir el catálogo es una decisión, y la toma Rick.');
