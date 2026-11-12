// ¿RETIRAR UNA COLUMNA MUEVE ALGÚN DATO? — la prueba que faltaba cuando esto rompió el catálogo.
//
// 🔴 POR QUÉ EXISTE. `escritor.retirar.js` quitó dos columnas del catálogo y desplazó las celdas:
//    `BU` pasó de 299 valores a 211, `Content_ID` de 119 a 0, `Email_ID` de 299 a 119,
//    `Codigos_Qcart` de 31 a 0. Nada tronó y las cuatro capas de validación pasaron — el paquete
//    estaba sano, los valores estaban en la columna equivocada. Se restauró del backup y la
//    capacidad quedó congelada.
//
// 🔴 LA PRUEBA QUE LO HABRÍA ATRAPADO no es «el archivo abre» ni «hay 86 columnas»: es comparar
//    **cada celda contra el NOMBRE de su columna**, antes y después. Por letra no sirve — después
//    del retiro las letras se corren a propósito, y comparar por letra da falsos rojos en todo lo
//    que está a la derecha. El encabezado es el único ancla que sobrevive al retiro.
//
// 🔴 Y SE CORRE SOBRE UNA COPIA. El libro vivo no se toca aquí ni una vez.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(nom, cond, ev) { console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(54) + (ev || '')); cond ? ok++ : mal++; }

// la función real, tal cual la usa el script — se importa por texto para probar LA MISMA, no una copia
var fuenteRetiro = fs.readFileSync(require('path').resolve(__dirname, '..') + '/_scripts/escritor.retirar.js', 'utf8');
var cuerpo = /function letraDe[\s\S]*?function quitarColumnas[\s\S]*?\n}\n/.exec(fuenteRetiro);
if (!cuerpo) { console.log('🔴 no encuentro `quitarColumnas` en escritor.retirar.js — ¿cambió de forma?'); process.exit(1); }
var quitarColumnas = new Function('return (function(){' + cuerpo[0] + '\nreturn quitarColumnas;})()')();

var HOJA = 'Catalogo_Piezas';
var A_QUITAR = ['EmailID', 'Email_Name_Legacy (duplicada, no usar)'];

console.log('════════ ¿RETIRAR UNA COLUMNA MUEVE ALGÚN DATO? ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = path.join(os.tmpdir(), 'probar-retiro.xlsx');
fs.copyFileSync(vivo.ruta, copia);
console.log('  copia de trabajo: ' + path.basename(vivo.ruta) + '  (el vivo NO se toca)\n');

// ── ANTES: leer todo por NOMBRE de columna
function leerPorNombre(archivo) {
  var wb = XLSX.readFile(archivo);
  var R = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: '' });
  var enc = R[0].map(t), filas = R.slice(1);
  var m = {};
  enc.forEach(function (h, i) { if (h) m[h] = filas.map(function (r) { return t(r[i]); }); });
  return { enc: enc, m: m, nFilas: filas.length };
}
var antes = leerPorNombre(copia);
console.log('  antes: ' + antes.enc.length + ' columnas × ' + antes.nFilas + ' filas');

// ── el retiro, con la misma mecánica del paso
var zip = new AdmZip(copia);
var wbx = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('🔴 no encuentro la parte XML de ' + HOJA); process.exit(1); }

var indices = A_QUITAR.map(function (c) { return antes.enc.indexOf(c) + 1; }).filter(function (i) { return i > 0; });
chk('las dos columnas a retirar existen', indices.length === A_QUITAR.length, indices.join(' · '));
if (indices.length !== A_QUITAR.length) process.exit(1);

var xml = zip.readAsText(parte);
var autoCerradas = (xml.match(/<c\b[^>]*?\/>/g) || []).length;
console.log('  celdas auto-cerradas en la hoja: ' + autoCerradas.toLocaleString('es-MX') + '   ← la trampa que rompió el script\n');

xml = quitarColumnas(xml, indices);
var quedan = antes.enc.length - indices.length;
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, f1, c2, f2) {
  var n = 0, s = String(quedan); void s;
  var letra = ''; var q = quedan; while (q > 0) { var r = (q - 1) % 26; letra = String.fromCharCode(65 + r) + letra; q = (q - r - 1) / 26; }
  void n; return '<dimension ref="' + c1 + f1 + ':' + letra + f2 + '"/>';
});
xml = xml.replace(/<cols>[\s\S]*?<\/cols>/, '');
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(copia);

// ── DESPUÉS: leer otra vez por NOMBRE
var despues = leerPorNombre(copia);
console.log('  después: ' + despues.enc.length + ' columnas × ' + despues.nFilas + ' filas\n');

console.log('══ lo que tiene que ser cierto ══');
chk('quedan exactamente ' + quedan + ' columnas', despues.enc.length === quedan, despues.enc.length + ' de ' + quedan);
chk('no queda ninguna de las retiradas', A_QUITAR.every(function (c) { return despues.enc.indexOf(c) < 0; }),
  A_QUITAR.filter(function (c) { return despues.enc.indexOf(c) >= 0; }).join(' · ') || 'ninguna');
chk('no se perdió ni una fila', despues.nFilas === antes.nFilas, despues.nFilas + ' de ' + antes.nFilas);

// 🔴 EL CHECK QUE IMPORTA: celda por celda, contra el nombre de su columna.
var movidas = [], perdidas = [];
antes.enc.forEach(function (h) {
  if (!h || A_QUITAR.indexOf(h) >= 0) return;
  var a = antes.m[h], d = despues.m[h];
  if (!d) { perdidas.push(h); return; }
  var dif = 0;
  for (var i = 0; i < a.length; i++) if (a[i] !== (d[i] || '')) dif++;
  if (dif) movidas.push({ col: h, dif: dif, de: a.length, conAntes: a.filter(Boolean).length, conDespues: d.filter(Boolean).length });
});
chk('ninguna columna que se queda desapareció', perdidas.length === 0, perdidas.slice(0, 4).join(' · ') || 'las ' + quedan + ' están');
chk('🔴 NINGUNA CELDA CAMBIÓ DE COLUMNA', movidas.length === 0,
  movidas.length ? movidas.length + ' columna(s) con celdas movidas' : 'las ' + (antes.enc.length - indices.length) + ' columnas dicen lo mismo, fila por fila');
movidas.slice(0, 10).forEach(function (m) {
  console.log('      🔴 «' + m.col + '»  ' + m.dif + ' de ' + m.de + ' celdas cambiaron   ·   con dato: ' + m.conAntes + ' → ' + m.conDespues);
});

// ── que el paquete siga abriendo
var abre = true;
try { XLSX.readFile(copia); } catch (e) { abre = false; }
chk('el archivo resultante se puede abrir', abre, abre ? 'SheetJS lo lee' : '🔴 paquete roto');

fs.rmSync(copia, { force: true });
console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S) — NO se retira nada' : '✅ RETIRAR NO MUEVE NINGÚN DATO') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
