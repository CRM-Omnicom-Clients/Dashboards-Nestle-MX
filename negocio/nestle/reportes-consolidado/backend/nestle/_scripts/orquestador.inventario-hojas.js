// S0 · INVENTARIO DE TODAS LAS HOJAS — columnas fantasma, duplicadas y celdas vacías.
//
// 🔴 POR QUÉ EXISTE. Rick pidió tres cosas que hasta ahora se medían solo en las 5 hojas que yo
//    miraba: cero celdas vacías, cero columnas fantasma y cero columnas duplicadas **en NINGUNA
//    hoja**. Este paso mira el libro ENTERO y no elige qué revisar: la foto completa es la que
//    enseña la única columna muda entre 83, o la hoja que nadie estaba vigilando.
//
// 🔴 LO QUE NO HACE: no escribe, no decide y no llama nada «basura». Solo mide y clasifica.
//    `Reporte_julio` se mide igual que las demás —medir no es tocar— y se marca como INTOCABLE.
//
// Tres clases de columna sospechosa, y NO son lo mismo:
//   · DUPLICADA EXACTA   dos columnas con el mismo encabezado, letra por letra
//   · DUPLICADA NORMAL.  difieren solo en mayúsculas, acentos o separadores (Touchpoint/TouchPoint)
//   · FANTASMA           el registro de nombres dice que una es el ALIAS HISTÓRICO de la otra
//                        (`EmailID` junto a `Email_ID (de la DE de SFMC)`)
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var JSON_OUT = process.argv.indexOf('--json') >= 0;

// 🔴 LA NORMALIZACIÓN SE LE PIDE AL REGISTRO. La primera versión de este paso escribió la suya
//    —tres líneas, parecía inofensivo— y borraba los símbolos en vez de transliterarlos. Resultado:
//    reportó `Mes` vs `Mes (#)` como «la misma columna con dos escrituras» en CINCO hojas, y
//    `QCART?` vs `%_Qcart` en el reporte. **Son columnas distintas**: una dice «Julio» y la otra 7.
//    El registro ya resuelve eso (`#`→` num `, `%`→` pct `, `$`, `&`, `+`) precisamente porque este
//    mismo error ya se cometió una vez ahí. Un detector de duplicados con su propia idea de qué es
//    «el mismo nombre» inventa duplicados — y este iba a proponer fusionar columnas buenas.
var R = require(BACK + '/_scripts/lib-registro.js');
var nmz = R.nmz;

var INTOCABLES = ['Reporte_julio'];

console.log('════════ S0 · INVENTARIO DEL LIBRO ENTERO ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var T = require('path').resolve(__dirname, '..') + '/_tmp/_s0.xlsx';
fs.copyFileSync(vivo.ruta, T);
var wb = XLSX.readFile(T);
console.log('  archivo: ' + require('path').basename(vivo.ruta));
console.log('  hojas: ' + wb.SheetNames.length + '\n');

// los alias históricos declarados en el registro, para detectar fantasmas
var REG = null;
try { REG = JSON.parse(fs.readFileSync(BACK + '/_contratos/registro.json', 'utf8')); } catch (e) { }
var aliasDe = {};   // nmz(alias) -> { nombreActual, id }
if (REG && REG.columnas) {
  Object.keys(REG.columnas).forEach(function (k) {
    var c = REG.columnas[k];
    (c.alias_historicos || []).forEach(function (a) {
      (c.nombres || []).forEach(function (n) { aliasDe[nmz(a)] = { actual: n, id: c.id }; });
    });
  });
}

var INV = [];
wb.SheetNames.forEach(function (hoja) {
  var sh = wb.Sheets[hoja];
  var o = { hoja: hoja, intocable: INTOCABLES.indexOf(hoja) >= 0 };
  if (!sh || !sh['!ref']) { o.vacia = true; INV.push(o); return; }
  var r = XLSX.utils.decode_range(sh['!ref']);
  var enc = [];
  for (var c = r.s.c; c <= r.e.c; c++) {
    var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })];
    enc.push(h ? t(h.v) : '');
  }
  o.filas = r.e.r;                       // sin el encabezado
  o.columnas = enc.filter(Boolean).length;
  o.col_sin_nombre = enc.filter(function (x) { return !x; }).length;

  // ── duplicadas
  var porExacto = {}, porNmz = {};
  enc.forEach(function (n, i) {
    if (!n) return;
    (porExacto[n] = porExacto[n] || []).push(i);
    (porNmz[nmz(n)] = porNmz[nmz(n)] || []).push({ n: n, i: i });
  });
  o.dup_exactas = Object.keys(porExacto).filter(function (k) { return porExacto[k].length > 1; })
    .map(function (k) { return { nombre: k, veces: porExacto[k].length }; });
  o.dup_normalizadas = Object.keys(porNmz).filter(function (k) {
    return porNmz[k].length > 1 && new Set(porNmz[k].map(function (x) { return x.n; })).size > 1;
  }).map(function (k) { return { variantes: porNmz[k].map(function (x) { return x.n; }) }; });

  // ── fantasmas, por DOS caminos distintos y los dos hacen falta
  o.fantasmas = [];
  enc.forEach(function (n) {
    if (!n) return;
    // 1 · el registro declara que es el alias histórico de otra que también está
    var a = aliasDe[nmz(n)];
    if (a && nmz(a.actual) !== nmz(n) && enc.some(function (x) { return nmz(x) === nmz(a.actual); })) {
      o.fantasmas.push({ vieja: n, actual: a.actual, id: a.id, via: 'alias declarado en el registro' });
      return;
    }
    // 2 · 🔴 EL ENCABEZADO SE DECLARA A SÍ MISMO OBSOLETO. `Email_Name_Legacy (duplicada, no usar)`
    //     dice en su propio nombre lo que es, y el camino 1 no lo ve porque nadie lo registró como
    //     alias. Una columna que anuncia «no usar» y convive con la buena es exactamente lo que
    //     Rick pidió que no exista. Se busca la hermana quitándole el sufijo que la delata.
    var m = /^(.*?)[ _-]*(legacy|old|viejo|vieja|obsolet\w*|deprecad\w*|bak|backup)\b/i.exec(n);
    if (m && t(m[1])) {
      var base = enc.filter(function (x) { return x && x !== n && nmz(x) === nmz(m[1]); })[0];
      if (base) o.fantasmas.push({ vieja: n, actual: base, id: null, via: 'el encabezado se declara obsoleto' });
    }
  });

  // ── celdas vacías, columna por columna (solo hojas con forma de tabla)
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  o.filas_datos = F.length;
  o.vacias_por_col = [];
  o.celdas_vacias = 0;
  enc.filter(Boolean).forEach(function (n) {
    var vac = F.filter(function (f) { return !t(f[n]); }).length;
    if (vac) { o.vacias_por_col.push({ col: n, vacias: vac, de: F.length }); o.celdas_vacias += vac; }
  });
  o.vacias_por_col.sort(function (a, b) { return b.vacias - a.vacias; });
  o.col_100_vacias = o.vacias_por_col.filter(function (x) { return x.vacias === x.de && x.de > 0; }).length;
  INV.push(o);
});

// ── el reporte
var conProblema = INV.filter(function (o) {
  return (o.dup_exactas || []).length || (o.dup_normalizadas || []).length ||
    (o.fantasmas || []).length || o.celdas_vacias || o.col_sin_nombre;
});
console.log('  ── LAS HOJAS, DE MÁS A MENOS CELDAS VACÍAS ─────────────────────────────');
INV.slice().sort(function (a, b) { return (b.celdas_vacias || 0) - (a.celdas_vacias || 0); })
  .forEach(function (o) {
    if (o.vacia) { console.log('   ' + o.hoja.padEnd(30) + '(hoja vacía)'); return; }
    var marcas = [];
    if (o.dup_exactas.length) marcas.push('🔴 ' + o.dup_exactas.length + ' dup exacta');
    if (o.dup_normalizadas.length) marcas.push('🔴 ' + o.dup_normalizadas.length + ' dup normalizada');
    if (o.fantasmas.length) marcas.push('👻 ' + o.fantasmas.length + ' fantasma');
    if (o.col_sin_nombre) marcas.push('⚠ ' + o.col_sin_nombre + ' col sin nombre');
    if (o.col_100_vacias) marcas.push('⚠ ' + o.col_100_vacias + ' col 100% vacía');
    console.log('   ' + (o.intocable ? '🔒' : '  ') + o.hoja.padEnd(28) +
      String(o.filas_datos).padStart(5) + ' filas · ' + String(o.columnas).padStart(3) + ' cols · ' +
      String(o.celdas_vacias).padStart(6) + ' vacías   ' + marcas.join(' · '));
  });

console.log('\n  ── COLUMNAS DUPLICADAS Y FANTASMA ──────────────────────────────────────');
var hayCol = false;
INV.forEach(function (o) {
  if (!o.dup_exactas) return;
  if (!o.dup_exactas.length && !o.dup_normalizadas.length && !o.fantasmas.length) return;
  hayCol = true;
  console.log('   ══ ' + o.hoja + (o.intocable ? '  🔒 INTOCABLE' : '') + ' ══');
  o.dup_exactas.forEach(function (d) { console.log('      🔴 duplicada exacta: «' + d.nombre + '» ×' + d.veces); });
  o.dup_normalizadas.forEach(function (d) { console.log('      🔴 misma columna con dos escrituras: ' + d.variantes.map(function (v) { return '«' + v + '»'; }).join(' vs ')); });
  o.fantasmas.forEach(function (f) { console.log('      👻 fantasma: «' + f.vieja + '» convive con «' + f.actual + '»   (' + f.id + ')'); });
});
if (!hayCol) console.log('   ✔ ninguna');

console.log('\n  ── TOTALES ─────────────────────────────────────────────────────────────');
var sum = function (k) { return INV.reduce(function (a, o) { return a + (o[k] || 0); }, 0); };
console.log('   hojas: ' + INV.length + '   ·   con algo que arreglar: ' + conProblema.length);
console.log('   celdas vacías en total: ' + sum('celdas_vacias').toLocaleString('es-MX'));
console.log('   columnas 100% vacías: ' + sum('col_100_vacias') + '   ·   columnas sin nombre: ' + sum('col_sin_nombre'));
console.log('   duplicadas exactas: ' + INV.reduce(function (a, o) { return a + (o.dup_exactas || []).length; }, 0) +
  '   ·   normalizadas: ' + INV.reduce(function (a, o) { return a + (o.dup_normalizadas || []).length; }, 0) +
  '   ·   fantasmas: ' + INV.reduce(function (a, o) { return a + (o.fantasmas || []).length; }, 0));

fs.writeFileSync(BACK + '/_contratos/inventario-hojas.json', JSON.stringify({
  paso: 'S0 · inventario de hojas', generado_por: 'orquestador.inventario-hojas.js',
  archivo: require('path').basename(vivo.ruta), hojas: INV
}, null, 1));
console.log('\n  → _contratos/inventario-hojas.json');
