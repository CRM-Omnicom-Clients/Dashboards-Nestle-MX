// RETIRA del catálogo las filas que son la MISMA pieza repetida — las que clonó catalogo-aplicar corrida a corrida.
//
// 🔴 QUÉ PASÓ. `catalogo.corregir-catalogo.js` decidía si una pieza de Pro Plan era alta preguntando
//    `filaDe[p.pieza_id]`. Esas piezas llegan del documento SIN `pieza_id` —por eso son «nuevas»— y
//    el id que se les asigna al escribirlas nunca vuelve al documento. Así que en CADA corrida de la
//    cadena volvían a ser nuevas: 12 altas más, con ids frescos. Diecisiete corridas después el
//    catálogo tenía **204 filas sobrantes** y 245 filas de «Fuel for life» donde hay 12 piezas.
//
// 🔴 POR QUÉ NINGUNA GUARDA LO VIO. Todos los `Pieza_ID` son DISTINTOS, así que «id único» salía
//    verde, y «cero duplicadas» mira COLUMNAS, no filas. Lo que se repetía no era el id: era la
//    pieza. Por eso aquí la llave es la IDENTIDAD DE NEGOCIO —campaña · touchpoint · segmento ·
//    mascota · sends · EmailID— y el id no entra en ella.
//
// 🔴 SE QUEDA LA PRIMERA, siempre. Es la más antigua y la única que pudo haber sido referenciada.
//    Y no se retira ni una fila sin comprobar antes que su id no aparece en NINGUNA otra hoja ni en
//    ningún bloque del backend: una fila huérfana se puede quitar, una referenciada no.
//
// 🔴 Y SE VERIFICA POR CONTENIDO, no por conteo. Que queden 143 filas no prueba que sean las
//    correctas: se comprueba que CADA pieza que se queda diga exactamente lo mismo que decía antes,
//    columna por columna. Es la lección del retiro de columnas, aplicada a filas.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var HOJA = 'Catalogo_Piezas';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ RETIRAR CLONES DEL CATÁLOGO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = require('path').resolve(__dirname, '..') + '/_tmp/_clones.xlsx';
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);
var R = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: '' });
var enc = R[0].map(t), filas = R.slice(1);
console.log('  ' + HOJA + ': ' + filas.length + ' filas × ' + enc.length + ' columnas');

function idx(n) { return enc.indexOf(n); }
var iId = idx('Pieza_ID');
var CLAVE = ['Campaña', 'TouchPoint', 'Segmento', 'Mascota', 'Sends'];
var faltan = CLAVE.filter(function (c) { return idx(c) < 0; });
if (iId < 0 || faltan.length) {
  console.log('  ⊘ NO PUDE EVALUAR — faltan columnas de identidad: ' + (iId < 0 ? 'Pieza_ID ' : '') + faltan.join(', '));
  process.exit(0);
}
// 🔴 LA IDENTIDAD SE CONSTRUYE CON EL VALOR LÓGICO, NO CON UNA COLUMNA FÍSICA — y no hacerlo dejó
//    12 clones vivos en la primera pasada. La llave incluía `Email_ID (de la DE de SFMC)`, y en cada
//    par el MISMO número estaba en columnas distintas: uno en la viva y otro en la fantasma
//    `EmailID`. Misma pieza, mismo id de SFMC, dos llaves → no eran clones para la comparación.
//    Mientras dos columnas guarden el mismo valor lógico, cualquier llave construida sobre una de
//    ellas parte la identidad en dos. Aquí se toma la primera que tenga dato, en orden de vigencia.
var ALIAS_ID = ['Email_ID (de la DE de SFMC)', 'EmailID'];
function idLogicoSFMC(r) {
  for (var i = 0; i < ALIAS_ID.length; i++) {
    var j = idx(ALIAS_ID[i]);
    if (j >= 0 && t(r[j])) return t(r[j]).toLowerCase();
  }
  return '';
}
function identidad(r) {
  return CLAVE.map(function (c) { return t(r[idx(c)]).toLowerCase(); }).concat(idLogicoSFMC(r)).join('¦');
}

// ── agrupar; la primera se queda
var por = {};
filas.forEach(function (r, k) { (por[identidad(r)] = por[identidad(r)] || []).push({ id: t(r[iId]), fila: k + 2 }); });
var sobran = [], grupos = 0;
Object.keys(por).forEach(function (k) {
  if (por[k].length < 2) return;
  grupos++;
  por[k].slice(1).forEach(function (x) { sobran.push(x); });
});
console.log('  identidades repetidas: ' + grupos + '   ·   filas sobrantes: ' + sobran.length);
if (!sobran.length) { console.log('\n  ✔ no hay clones — nada que retirar'); process.exit(0); }

// ── 🔴 NINGUNA SE RETIRA SIN COMPROBAR QUE NADIE LA NOMBRA
var ids = {}; sobran.forEach(function (x) { ids[x.id] = 1; });
var referidas = [];
Object.keys(wb.Sheets).forEach(function (h) {
  if (h === HOJA) return;
  var RR = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, defval: '' });
  RR.forEach(function (r) { r.forEach(function (v) { if (ids[t(v)]) referidas.push(h + ' → ' + t(v)); }); });
});
['_fuentes/email.json', '_fuentes/qcart.json', '_fuentes/whatsapp.json', '_fuentes/manual.json', '_rejilla/rejilla.json'].forEach(function (f) {
  var p = BACK + '/' + f; if (!fs.existsSync(p)) return;
  var s = fs.readFileSync(p, 'utf8');
  Object.keys(ids).forEach(function (id) { if (s.indexOf('"' + id + '"') >= 0) referidas.push(f + ' → ' + id); });
});
console.log('  ' + (referidas.length === 0 ? '✔' : '🔴') + ' referencias a las sobrantes: ' + referidas.length +
  (referidas.length ? '   ' + referidas.slice(0, 5).join(' · ') : '   (ninguna: son huérfanas)'));
if (referidas.length) { console.log('\n  🔴 hay sobrantes REFERENCIADAS — no se retira ninguna hasta resolverlo'); process.exit(1); }

var quedan = filas.length - sobran.length;
console.log('  → quedarían ' + quedan + ' filas   (se retiran ' + sobran.length + ')');
if (!ESCRIBIR) { console.log('\n  (seco. Para retirar: --escribir)'); process.exit(0); }

// ── ANTES: cada pieza que se queda, con todos sus valores
function porPieza(archivo) {
  var w = XLSX.readFile(archivo);
  var RR = XLSX.utils.sheet_to_json(w.Sheets[HOJA], { header: 1, defval: '' });
  var e = RR[0].map(t), m = {};
  RR.slice(1).forEach(function (r) { var id = t(r[e.indexOf('Pieza_ID')]); if (id) m[id] = e.map(function (_, i) { return t(r[i]); }); });
  return { enc: e, m: m };
}
var antes = porPieza(copia);
var seQuedan = Object.keys(antes.m).filter(function (id) { return !ids[id]; });

// ── retirar las filas del XML y RENUMERAR lo que queda
var zip = new AdmZip(copia);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);

var fuera = {}; sobran.forEach(function (x) { fuera[x.fila] = 1; });
// 🔴 la misma trampa que en el retiro de COLUMNAS: la alternativa auto-cerrada va PRIMERO, para que
//    un `<row .../>` no haga que el patrón de pareja se trague las filas siguientes.
var nuevoNum = 0, mapaFila = {};
var cuerpo = '';
xml.replace(/<row\b([^>]*?)\/>|<row\b([^>]*?)>([\s\S]*?)<\/row>/g, function (todo, aAuto, aPar, dentro) {
  var attrs = aAuto != null ? aAuto : aPar;
  var n = Number((/r="(\d+)"/.exec(attrs) || [])[1]);
  if (fuera[n]) return '';
  nuevoNum++;
  mapaFila[n] = nuevoNum;
  var nuevo = todo.replace(/(<row\b[^>]*?)r="\d+"/, '$1r="' + nuevoNum + '"')
                  .replace(/<c\b([^>]*?)r="([A-Z]+)\d+"/g, function (_c, at, letra) { return '<c' + at + 'r="' + letra + nuevoNum + '"'; });
  cuerpo += nuevo;
  return '';
});
xml = xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + cuerpo + '</sheetData>');
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)\d+"\/>/, function (_, c1, f1, c2) { return '<dimension ref="' + c1 + f1 + ':' + c2 + nuevoNum + '"/>'; });
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(copia);
console.log('  filas en el XML tras el retiro: ' + nuevoNum + ' (1 encabezado + ' + (nuevoNum - 1) + ' datos)');

// ── las CINCO capas
var NODE = process.execPath, PY = require(__dirname + '/lib-entorno.js').PYTHON;
var falla = null;
[[NODE, 'xlsx-safe-save.js'], [NODE, 'xlsx-label.js'], [NODE, 'xlsx-check.js'], [PY, 'xlsx-validar-fondo.py'], [NODE, 'xlsx-orden-celdas.js']].forEach(function (c) {
  if (falla) return;
  var r2 = cp.spawnSync(c[0], [require(__dirname + '/lib-entorno.js').TOOLS + '/' + c[1], copia], { encoding: 'utf8' });
  if (r2.status !== 0) falla = c[1] + ': ' + ((r2.stdout || '') + (r2.stderr || '')).slice(-300);
  console.log('   ' + (r2.status === 0 ? '✔' : '🔴') + ' ' + c[1]);
});
if (falla) { console.log('\n🔴 NO SE PUBLICA — ' + falla); process.exit(1); }

// ── 🔴 LA VERIFICACIÓN QUE IMPORTA: cada pieza que se queda dice LO MISMO que antes
var despues = porPieza(copia);
var perdidas = seQuedan.filter(function (id) { return !despues.m[id]; });
var cambiadas = [];
seQuedan.forEach(function (id) {
  var a = antes.m[id], d = despues.m[id];
  if (!d) return;
  for (var i = 0; i < antes.enc.length; i++) {
    var col = antes.enc[i], j = despues.enc.indexOf(col);
    if (j < 0) continue;
    if (a[i] !== d[j]) { cambiadas.push(id + '.' + col + ': «' + a[i] + '» → «' + d[j] + '»'); break; }
  }
});
var sobreviven = Object.keys(despues.m).filter(function (id) { return ids[id]; });
console.log('\n  ══ VERIFICACIÓN ══');
console.log('   ' + (perdidas.length === 0 ? '✔' : '🔴') + ' ninguna pieza que se queda desapareció: ' + (perdidas.slice(0, 5).join(' · ') || seQuedan.length + ' intactas'));
console.log('   ' + (cambiadas.length === 0 ? '✔' : '🔴') + ' ninguna cambió un solo valor: ' + (cambiadas.slice(0, 5).join(' · ') || 'las ' + seQuedan.length + ', columna por columna'));
console.log('   ' + (sobreviven.length === 0 ? '✔' : '🔴') + ' ninguna clon sobrevivió: ' + (sobreviven.slice(0, 5).join(' · ') || 'las ' + sobran.length + ' fuera'));
if (perdidas.length || cambiadas.length || sobreviven.length) { console.log('\n  🔴 NO SE PUBLICA'); process.exit(1); }

fs.copyFileSync(copia, vivo.ruta);
console.log('\n  📤 publicado · ' + filas.length + ' → ' + quedan + ' filas');
process.exit(0);
