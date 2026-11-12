// nestle-catalogo · QUITAR LOS TOKENS QUE LE ESCRIBÍ A LAS NOTAS DE RICK.
//
// 🔴 EL DAÑO, EN UNA FRASE. Rick dejó cuatro notas a mano al final de `Catalogo_Piezas`
//    («NOTAS CATALOGO VARIOS DATOS YA ESTABAN», «REVISAR A DETALLE QCART», …) escritas en una
//    sola celda de la columna `TouchPoint`. Mi llenador de vacíos las leyó como si fueran PIEZAS
//    y les escribió `POR DEFINIR` o `N/A` en las otras 85 columnas: 340 celdas de token sobre
//    cuatro recados. Por eso Rick dice que «el catálogo se siente mal» — y tiene razón.
//
// 🔴 LA REGLA QUE FALTABA, Y YA QUEDÓ EN `orquestador.medir-vacios.js`:
//    **una fila sin llave no es un registro.** Si `Pieza_ID` está vacío —o dice un token— esa
//    fila no es una pieza, y ningún llenador tiene nada que hacer ahí. Sin esa regla, cualquier
//    renglón que alguien use para anotar algo se convierte en 85 celdas de basura.
//
// 🔴 QUÉ TOCA Y QUÉ NO. Solo vacía celdas cuyo valor sea exactamente un token que YO escribo
//    (`POR DEFINIR` · `PENDIENTE` · `N/A`) y solo en filas que NO son piezas. El texto de Rick
//    no se toca ni se mueve. Y no borra la fila: borrarla desplazaría todo lo de abajo, que es
//    justo el defecto que costó 5 columnas del catálogo en agosto.
//
// 🔴 Y CONSERVA EL ESTILO. La celda no se elimina del XML: se deja `<c r="X147" s="N"/>` — sin
//    valor y con su formato. El formato lo edita Rick (E5); lo que aquí se quita es el dato falso.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

var TOKEN = /^(POR DEFINIR|PENDIENTE|N\/A)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;
var HOJA = 'Catalogo_Piezas';
var ID_LLAVE = 'Pieza' + '_' + 'ID';   // se pide por librería más abajo; aquí solo el nombre

DECL.declarar('nestle-catalogo', 'catalogo.limpiar-notas.js', [{
  hoja: HOJA,
  grano: 'una CELDA — fila que NO es pieza × columna con token',
  llave: 'número de fila + nombre de columna',
  celdas_esperadas: 'las que hoy tengan POR DEFINIR / PENDIENTE / N/A en una fila sin Pieza_ID válido'
}]);

console.log('════════ nestle-catalogo · LIMPIAR LAS NOTAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_notas.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c = rng.s.c; c <= rng.e.c; c++) {
  var ce = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
  enc[c] = ce ? t(ce.v) : '';
}
var arr = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nmLlave = COL.de(arr, ID_LLAVE);
var iLlave = enc.indexOf(nmLlave);
if (iLlave < 0) { console.log('  🔴 no encontré la columna llave en la hoja'); process.exit(1); }

console.log('  libro: ' + path.basename(vivo.ruta));
console.log('  hoja:  ' + HOJA + '   ·   filas 2..' + (rng.e.r + 1) + '   ·   ' + (rng.e.c + 1) + ' columnas');
console.log('  llave: ' + nmLlave + ' (columna ' + col(iLlave) + ')\n');

// ── qué filas NO son piezas, y qué escribí yo en ellas ─────────────────────────────
var filas = [];
for (var r = 1; r <= rng.e.r; r++) {
  var cid = ws[XLSX.utils.encode_cell({ r: r, c: iLlave })];
  var id = cid ? t(cid.v) : '';
  if (ES_PIEZA.test(id)) continue;                 // es una pieza de verdad: no se toca

  var suyas = [], mias = [];
  for (var cc = rng.s.c; cc <= rng.e.c; cc++) {
    var cel = ws[XLSX.utils.encode_cell({ r: r, c: cc })];
    if (!cel) continue;
    var v = t(cel.v);
    if (v === '') continue;
    if (TOKEN.test(v)) mias.push({ ref: col(cc) + (r + 1), columna: enc[cc] || col(cc), val: v });
    else suyas.push({ ref: col(cc) + (r + 1), columna: enc[cc] || col(cc), val: v });
  }
  if (!mias.length && !suyas.length) continue;      // fila totalmente vacía: nada que hacer
  filas.push({ fila: r + 1, id: id, suyas: suyas, mias: mias });
}

if (!filas.length) { console.log('  ✅ no hay filas sin llave con contenido. Nada que limpiar.'); process.exit(0); }

console.log('  ── lo que hay hoy en las filas que NO son piezas');
var totalMias = 0;
filas.forEach(function (f) {
  console.log('     fila ' + f.fila + '   llave = ' + (f.id ? '«' + f.id + '»' : '(vacía)'));
  f.suyas.forEach(function (s) {
    console.log('        🔒 ' + s.ref.padEnd(6) + s.columna.padEnd(24) + '« ' + s.val.slice(0, 70) + ' »   ← de Rick, INTOCABLE');
  });
  if (f.mias.length) {
    var pd = f.mias.filter(function (x) { return /POR DEFINIR/i.test(x.val); }).length;
    var pe = f.mias.filter(function (x) { return /PENDIENTE/i.test(x.val); }).length;
    var na = f.mias.filter(function (x) { return /N\/A/i.test(x.val); }).length;
    console.log('        🧹 ' + f.mias.length + ' celda(s) de token que yo escribí   (' +
      pd + ' POR DEFINIR · ' + pe + ' PENDIENTE · ' + na + ' N/A)   → se vacían');
  }
  totalMias += f.mias.length;
});

// 🔴 UNA FILA SIN NINGÚN TEXTO DE RICK NO SE «LIMPIA»: se declara. Si toda la fila es token,
//    no sé si era una nota que perdí o una pieza a medio dar de alta, y vaciarla borraría la
//    única pista. Se avisa y se deja como está.
var ciegas = filas.filter(function (f) { return f.mias.length && !f.suyas.length; });
if (ciegas.length) {
  console.log('\n  ⚠ ' + ciegas.length + ' fila(s) son SOLO tokens, sin texto de Rick: ' +
    ciegas.map(function (f) { return f.fila; }).join(' ') + ' — NO se tocan, se declaran.');
}
var plan = filas.filter(function (f) { return f.mias.length && f.suyas.length; });
var aVaciar = 0; plan.forEach(function (f) { aVaciar += f.mias.length; });

console.log('\n  ═══ ' + plan.length + ' nota(s) de Rick   ·   ' + aVaciar + ' celda(s) a vaciar   ·   ' +
  plan.reduce(function (a, f) { return a + f.suyas.length; }, 0) + ' celda(s) suyas que se quedan');

if (!aVaciar) { console.log('\n  ✅ ya está limpio.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-limpiar-notas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML de la hoja'); process.exit(1); }
var xml = zip.readAsText(parte);

// 🔴 VACIAR ≠ BORRAR LA CELDA. Se sustituye por `<c r="REF" s="N"/>`: sin valor, con su estilo.
//    Quitarla del XML por completo también funcionaría, pero se perdería el formato de Rick.
var vaciadas = 0, noEncontradas = [];
plan.forEach(function (f) {
  f.mias.forEach(function (m) {
    var re = new RegExp('<c r="' + m.ref + '"(?:([^>]*?)\\/>|([^>]*?)>[\\s\\S]*?<\\/c>)');
    var hit = re.exec(xml);
    if (!hit) { noEncontradas.push(m.ref); return; }
    var attrs = (hit[1] !== undefined ? hit[1] : hit[2]) || '';
    var s = /\bs="(\d+)"/.exec(attrs);
    xml = xml.replace(hit[0], '<c r="' + m.ref + '"' + (s ? ' s="' + s[1] + '"' : '') + '/>');
    vaciadas++;
  });
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + vaciadas + ' celda(s) vaciadas' + (noEncontradas.length ? '   🔴 ' + noEncontradas.length + ' no se hallaron en el XML: ' + noEncontradas.slice(0, 8).join(' ') : ''));
if (noEncontradas.length) { console.log('\n  🔴 el XML no coincide con lo leído: NO se publica.'); process.exit(1); }

// ══ LAS CINCO CAPAS (R7) ════════════════════════════════════════════════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 70));
    return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 70)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER DEL DISCO (E4) ═══════════════════════════════════════════════════════════
console.log('\n  ── releído del disco');
var ws2 = XLSX.readFile(vivo.ruta).Sheets[HOJA];
var rng2 = XLSX.utils.decode_range(ws2['!ref']);
var fallos = 0;
plan.forEach(function (f) {
  var quedaToken = 0, suyasVivas = 0;
  for (var cc2 = rng2.s.c; cc2 <= rng2.e.c; cc2++) {
    var cel2 = ws2[XLSX.utils.encode_cell({ r: f.fila - 1, c: cc2 })];
    if (!cel2) continue;
    var v2 = t(cel2.v);
    if (v2 === '') continue;
    if (TOKEN.test(v2)) quedaToken++; else suyasVivas++;
  }
  var ok = quedaToken === 0 && suyasVivas === f.suyas.length;
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + 'fila ' + f.fila + '   tokens: ' + f.mias.length + ' → ' + quedaToken +
    '   ·   texto de Rick: ' + f.suyas.length + ' → ' + suyasVivas +
    (suyasVivas ? '   « ' + t(ws2[XLSX.utils.encode_cell({ r: f.fila - 1, c: enc.indexOf(f.suyas[0].columna) })] ? t(ws2[XLSX.utils.encode_cell({ r: f.fila - 1, c: enc.indexOf(f.suyas[0].columna) })].v).slice(0, 50) : '?') + ' »' : ''));
  if (!ok) fallos++;
});
var arr2 = XLSX.utils.sheet_to_json(ws2, { defval: '', blankrows: false });
var piezas1 = arr.filter(function (x) { return ES_PIEZA.test(t(x[nmLlave])); }).length;
var piezas2 = arr2.filter(function (x) { return ES_PIEZA.test(t(x[nmLlave])); }).length;
console.log('     piezas con id válido: ' + piezas1 + ' → ' + piezas2 + (piezas1 === piezas2 ? '   ✔ ninguna se movió' : '   🔴 CAMBIÓ'));
if (piezas1 !== piezas2) fallos++;
console.log('     filas totales:        ' + arr.length + ' → ' + arr2.length);

console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' fila(s) no quedaron' : '✅ NOTAS LIMPIAS · su texto intacto · verificado contra el disco'));
process.exit(fallos ? 1 : 0);
