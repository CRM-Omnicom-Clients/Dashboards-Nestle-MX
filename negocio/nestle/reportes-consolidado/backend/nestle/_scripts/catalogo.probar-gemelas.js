// nestle-catalogo · ANTES DE BORRAR 12 FILAS: probar que de verdad sobran. Mide, no escribe.
//
// 🔴 BORRAR FILAS ES LA OPERACIÓN QUE MÁS DAÑO HA HECHO EN ESTE PROYECTO. Por eso no se hace
//    porque «se ve claro»: se hace cuando CINCO pruebas dicen que sí, y si una falla, no se hace.
//
//    P1 · SFMC tiene 16 piezas de Pro Plan y el catálogo 28 → sobran 12
//    P2 · cada gemela tiene una MELLIZA con los mismos envíos, misma campaña y mismo segmento
//    P3 · la melliza SÍ tiene nombre, touchpoint y quincena; la gemela NO tiene ninguno
//    P4 · la gemela no aporta NI UN dato que su melliza no tenga (columna por columna)
//    P5 · nadie la referencia: ni otra hoja del libro, ni ningún JSON del backend
//
// 🔴 P4 ES LA QUE DE VERDAD PROTEGE. Las otras cuatro dicen «es un duplicado». P4 dice «y no se
//    pierde nada al quitarlo», que es otra afirmación. Si la gemela tuviera una sola celda con un
//    dato que la melliza no tiene, borrarla perdería ese dato — y el peso del archivo no lo diría.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var HUECO = /^(POR DEFINIR|PENDIENTE|N\/A|)$/i;
var GEMELAS = /^009-P0(1[89]|2[0-9])$/;

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_gem2.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var nmP = COL.de(P, 'Pieza' + '_' + 'ID'), nmC = COL.de(P, 'Campaña'), nmS = COL.de(P, 'Segmento');
var nmT = COL.de(P, 'TouchPoint'), nmE = COL.de(P, 'Email_Name'), nmSe = COL.de(P, 'Sends'), nmQ = COL.de(P, 'Quincena');

console.log('════════ ¿DE VERDAD SOBRAN LAS 12? — cinco pruebas ════════\n');
var gem = P.filter(function (p) { return GEMELAS.test(t(p[nmP])); });
console.log('  candidatas: ' + gem.length + ' (009-P018 … 009-P029)\n');
var fallos = [];

// ── P1 · ¿cuántas piezas de Pro Plan tiene SFMC? ───────────────────────────────────
var cands = fs.readdirSync(BACK + '/_insumos').filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
var S = JSON.parse(fs.readFileSync(BACK + '/_insumos/' + cands[cands.length - 1], 'utf8'));
var pro = (S.rows || S.data || []).filter(function (r) { return /Proplan/i.test(t(r.EmailName)); });
var catPro = P.filter(function (p) { return /Fuel for life/i.test(t(p[nmC])) && /^009-P0(0[2-9]|1[0-9]|2[0-9])$/.test(t(p[nmP])); });
console.log('  ── P1 · SFMC vs catálogo');
console.log('     SFMC tiene   ' + pro.length + ' piezas de Pro Plan');
console.log('     el catálogo  ' + catPro.length + ' (009-P002 … 009-P029)');
console.log('     ' + (catPro.length - pro.length === gem.length ? '✔ sobran exactamente ' + gem.length : '🔴 la diferencia es ' + (catPro.length - pro.length) + ', no ' + gem.length));
if (catPro.length - pro.length !== gem.length) fallos.push('P1: la diferencia no es exactamente 12');

// ── P2 y P3 · cada gemela y su melliza ─────────────────────────────────────────────
console.log('\n  ── P2 y P3 · cada gemela contra su melliza');
var pares = [];
gem.forEach(function (g) {
  var s = num(g[nmSe]);
  // 🔴 LA TOLERANCIA NO ES UN AJUSTE PARA QUE LA PRUEBA PASE. Es que yo limpié `Sends` de los
  //    jobs de prueba en las mellizas y SALTÉ las gemelas, así que la melliza quedó 0-7 envíos
  //    por debajo — y esa diferencia es exactamente lo que aportaban las pruebas de esa pieza.
  //    Se empareja con tolerancia de 10 (el mismo umbral de prueba) y en UNA sola dirección:
  //    la gemela (bruta) nunca puede tener MENOS que la melliza (limpia). Y se exige campaña
  //    + SEGMENTO iguales: sin el segmento, dos piezas con cifras parecidas se emparejarían.
  var mel = P.filter(function (q) {
    return t(q[nmP]) !== t(g[nmP]) && !GEMELAS.test(t(q[nmP])) &&
      // 🔴 EL SEGMENTO DE LA MELLIZA LLEVA EL SUBSEGMENTO PEGADO: dice «Pro Plan Pet Parents ·
      //    Perros» donde la gemela dice «Pro Plan Pet Parents». Es la regla de identidad de
      //    Pro Plan —se reporta por persona × MASCOTA— y la gemela nació sin ella. Se compara
      //    por prefijo, en esa dirección: la melliza es la que puede tener MÁS, nunca menos.
      t(q[nmC]) === t(g[nmC]) && t(q[nmS]).indexOf(t(g[nmS])) === 0 &&
      s >= num(q[nmSe]) && s - num(q[nmSe]) <= 10;
  });
  if (mel.length !== 1) { fallos.push('P2: ' + t(g[nmP]) + ' tiene ' + mel.length + ' mellizas, no 1'); console.log('     🔴 ' + t(g[nmP]) + '  ' + mel.length + ' melliza(s) con ' + s + ' envíos'); return; }
  var m = mel[0];
  var gTiene = !HUECO.test(t(g[nmE])) || !HUECO.test(t(g[nmT]));
  var mTiene = !HUECO.test(t(m[nmE])) && !HUECO.test(t(m[nmT]));
  if (gTiene) fallos.push('P3: ' + t(g[nmP]) + ' SÍ tiene nombre o touchpoint — no es una fila vacía');
  if (!mTiene) fallos.push('P3: la melliza ' + t(m[nmP]) + ' NO tiene nombre o touchpoint');
  pares.push({ g: g, m: m });
  console.log('     ' + (gTiene || !mTiene ? '🔴 ' : '✔ ') + t(g[nmP]) + '  →  ' + t(m[nmP]).padEnd(10) +
    String(s).padStart(7) + ' envíos   melliza: ' + t(m[nmT]).padEnd(6) + t(m[nmS]).slice(0, 24));
});

// ── P4 · ¿la gemela aporta algún dato que la melliza no tenga? ─────────────────────
console.log('\n  ── P4 · ¿la gemela tiene ALGÚN dato que su melliza no tenga?');
var aportes = [];
pares.forEach(function (par) {
  enc.forEach(function (h) {
    if (!h) return;
    var vg = t(par.g[h]), vm = t(par.m[h]);
    if (HUECO.test(vg)) return;                       // la gemela no dice nada: no aporta
    if (h === 'Pieza_ID') return;                     // su id es lo único suyo, y es lo que se va
    if (!HUECO.test(vm)) return;                      // la melliza también lo tiene: no se pierde
    aportes.push({ gem: t(par.g[nmP]), mel: t(par.m[nmP]), col: h, valor: vg });
  });
});
if (!aportes.length) console.log('     ✔ NINGUNA. Cada dato de las 12 gemelas ya está en su melliza.');
else {
  aportes.slice(0, 12).forEach(function (a) { console.log('     🔴 ' + a.gem + ' tiene ' + a.col + ' = «' + a.valor.slice(0, 40) + '» y ' + a.mel + ' no'); });
  fallos.push('P4: ' + aportes.length + ' celda(s) se perderían');
}

// ── P5 · ¿alguien las referencia? ──────────────────────────────────────────────────
console.log('\n  ── P5 · ¿alguien las nombra fuera de su propia fila?');
var ids = gem.map(function (g) { return t(g[nmP]); });
var refs = [], diag = [];
wb.SheetNames.forEach(function (h) {
  var w = wb.Sheets[h]; if (!w || !w['!ref']) return;
  var R = XLSX.utils.sheet_to_json(w, { header: 1, defval: '' });
  R.forEach(function (fila, ri) {
    fila.forEach(function (c) {
      var s2 = t(c); if (!s2) return;
      ids.forEach(function (id) {
        if (s2.indexOf(id) < 0) return;
        if (h === 'Catalogo_Piezas' && s2 === id) return;   // su propia celda de id
        refs.push(h + ' f' + (ri + 1) + ': ' + s2.slice(0, 46));
      });
    });
  });
});
// y los JSON del backend
['_fuentes', '_rejilla', '_catalogo', '_contratos'].forEach(function (d) {
  var dir = BACK + '/' + d; if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
    var s3 = fs.readFileSync(path.join(dir, f), 'utf8');
    // 🔴 SE BUSCA LA RUTA DONDE APARECE EL ID, NO EL TEXTO SUELTO. Un archivo que la nombra
    //    dentro de un AVISO, un HALLAZGO o la BITÁCORA de lo ya hecho no depende de ella: la
    //    está señalando o recordando. Contarlo como dependencia haría que el propio reporte
    //    que denuncia las filas duplicadas impidiera borrarlas para siempre.
    //    Una dependencia de verdad es que el DATO de la pieza (sus envíos, sus carritos, su
    //    celda de la rejilla) viva ahí — y eso se ve en la primera parte de la ruta.
    var REGISTRO = /^(avisos|hallazgos|sin_evaluar|cambios|altas|bloqueos|medido|plan|historia|movimientos)$/;
    var J = null; try { J = JSON.parse(s3); } catch (e) { J = null; }
    function rutasDe(nodo, id, ruta, out) {
      if (nodo === null || nodo === undefined) return;
      if (typeof nodo === 'string') { if (nodo.indexOf(id) >= 0) out.push(ruta); return; }
      if (Array.isArray(nodo)) { nodo.forEach(function (x, i) { rutasDe(x, id, ruta, out); }); return; }
      if (typeof nodo === 'object') {
        Object.keys(nodo).forEach(function (k) {
          if (k.indexOf(id) >= 0) out.push(ruta.length ? ruta : [k]);
          rutasDe(nodo[k], id, ruta.concat([k]), out);
        });
      }
    }
    ids.forEach(function (id) {
      if (s3.indexOf(id) < 0) return;
      if (!J) { refs.push(d + '/' + f + ' menciona ' + id + ' (no es JSON válido: no puedo ver dónde)'); return; }
      var out = []; rutasDe(J, id, [], out);
      var deDatos = out.filter(function (r) { return !REGISTRO.test(r[0] || ''); });
      if (!deDatos.length) { diag.push(d + '/' + f + ' → ' + (out[0] || []).join('.') + '  (registro, no dependencia)'); return; }
      refs.push(d + '/' + f + ' → ' + deDatos[0].join('.') + '  DEPENDE de ' + id);
    });
  });
});
if (diag.length) console.log('     ⚠ ' + diag.length + ' mención(es) en reportes de DIAGNÓSTICO, no son dependencias: ' + diag[0]);
if (!refs.length) console.log('     ✔ nadie DEPENDE de ellas: ni otra hoja del libro, ni ningún JSON de datos');
else { refs.slice(0, 10).forEach(function (r) { console.log('     🔴 ' + r); }); fallos.push('P5: ' + refs.length + ' referencia(s)'); }

console.log('\n════ VEREDICTO ════');
/* 🔴 CERO CASOS NO ES UN VERDE, Y ESTE SCRIPT LO PINTABA (2-oct-2026). Con las 12 gemelas YA
 *    retiradas decía «✅ LAS 5 PRUEBAS PASAN — las 12 filas se pueden retirar sin perder un solo
 *    dato» habiendo evaluado **0 candidatas**, y nombrando 12 filas que ya no existen. Leído por
 *    encima parece que el trabajo sigue pendiente y que está autorizado: las dos cosas falsas.
 *    Es la misma familia que `Pieza_ID` vs `Pieza_IDs`, que evaluó cero casos y pintó verde.
 *    El número de casos se dice SIEMPRE, y sin casos el veredicto es «nada que probar». */
if (fallos.length) { fallos.forEach(function (f) { console.log('  🔴 ' + f); }); console.log('\n  🔴 NO se retiran: alguna prueba falló.'); }
else if (!pares.length) {
  console.log('  ⊘ NADA QUE PROBAR — 0 candidatas: no quedan gemelas en el catálogo.');
  console.log('     (se retiraron en su momento; SFMC y el catálogo coinciden en el padrón de Pro Plan)');
  console.log('     Un verde aquí sin casos haría creer que hay 12 filas por retirar y que está autorizado.');
}
else console.log('  ✅ LAS 5 PRUEBAS PASAN sobre ' + pares.length + ' gemela(s) — se pueden retirar sin perder un solo dato');
fs.writeFileSync(BACK + '/_preescritura/gemelas-probadas.json', JSON.stringify({
  cuando: new Date().toISOString(), ok: !fallos.length, fallos: fallos,
  pares: pares.map(function (x) { return { gemela: t(x.g[nmP]), melliza: t(x.m[nmP]), sends: num(x.m[nmSe]), tp: t(x.m[nmT]), seg: t(x.m[nmS]) }; })
}, null, 1));
console.log('  → _preescritura/gemelas-probadas.json');
fs.unlinkSync(TMP);
process.exit(fallos.length ? 1 : 0);
