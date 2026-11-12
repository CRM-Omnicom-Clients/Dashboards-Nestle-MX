/*
 * maggi.copiar-del-reporte.js — baja a «Maggi Reporte» lo de Maggi, y SOLO lo de Maggi, desde
 * Report_Resumen, que es lo actualizado.
 *
 * 🔴 LO PIDIÓ RICK ASÍ (30-sep-2026): «borrar lo que hay en la hoja de maggi y poner todo lo nuevo
 *    del reporte, que está actualizado, de maggi… Solo deja los espacios en blanco entre mundial y
 *    liga mx como está actualmente». Y sobre la columna `Carritos_Total`, que en su hoja tenía un
 *    IMPORTE («$137.00» como texto) donde el reporte tiene un CONTEO: «tu tienes lo actualizado,
 *    usa eso, lo del reporte».
 *
 * 🔴 QUÉ MANDA EN CADA COLUMNA, Y POR QUÉ NO ES TODO IGUAL. La hoja tiene 53 columnas: 40 que el
 *    reporte también tiene y 13 que son SOLO suyas —recetas asignadas, shortlinks, utms, ventana
 *    de medición, notas—. El reporte **no tiene nada que poner** en esas 13: vaciarlas no sería
 *    «poner lo nuevo», sería borrar trabajo sin sustituirlo. Así que:
 *      · las 40 comunes  → del reporte, sin excepción (incluida Carritos_Total)
 *      · las 13 propias  → se conservan de la fila que ya estaba
 *      · 6 de esas 13    → las recalcula después `maggi.calcular-columnas.js` desde el maestro
 *
 * 🔴 EL EMPAREJADO TIENE UN RESPALDO, Y EXIGE UNICIDAD. La llave normal es
 *    `campaña · touchpoint · segmento · quincena`. Pero dos filas cambiaron de segmento entre una
 *    versión y otra —J9 pasó de «Región unificada · Partición B» a «Región unificada»— y con la
 *    llave estricta perderían sus 13 columnas propias. El respaldo empareja por
 *    `campaña · touchpoint · quincena` **solo si es único en los dos lados**: sin esa condición,
 *    `E-P1` (tres segmentos en la misma quincena) se emparejaría a ciegas, que es exactamente cómo
 *    un alias mandó 191 carritos al segmento de al lado.
 *
 * 🔴 NO SE TOCA NI EL FORMATO NI LAS FILAS EN BLANCO. Cada celda se escribe con el estilo que ya
 *    tenía esa columna (`lib-celda-xml`), y las filas 16-17 —el separador entre Mundial y Liga MX—
 *    ni se leen. Las filas nuevas heredan el estilo de la primera fila de datos.
 *
 * 🔴 LAS COLUMNAS SE PIDEN, NO SE ESCRIBEN. `TouchPoint` y `Campaña` están en la lista negra por
 *    defectos reales —una leída como `Touchpoint` llamó fantasmas a dos piezas— así que todas las
 *    de la llave pasan por `lib-columna`, que resuelve el encabezado REAL o truena.
 *
 *   node maggi.copiar-del-reporte.js            (seco: la tabla completa, sin tocar el Excel)
 *   node maggi.copiar-del-reporte.js --escribir
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var LIBRO = ENT.LIBRO;
var CX = require(BACK + '/_scripts/lib-celda-xml.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Maggi Reporte';
var FILA_MUNDIAL = 2, N_MUNDIAL = 14, FILA_LIGA = 18;   // el separador son las 16-17

console.log('════════ MAGGI · COPIAR DEL REPORTE ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var tmp = BACK + '/_tmp/_maggi-copiar.xlsx';
fs.copyFileSync(LIBRO, tmp);
var wb = XLSX.readFile(tmp, { cellNF: true });
var shM = wb.Sheets[HOJA], shR = wb.Sheets['Report_Resumen'];
if (!shM || !shR) { console.log('🔴 falta una de las dos hojas'); process.exit(1); }

var encM = XLSX.utils.sheet_to_json(shM, { header: 1, defval: '' })[0].map(t);
var filasM = XLSX.utils.sheet_to_json(shM, { defval: '' });
var R = XLSX.utils.sheet_to_json(shR, { defval: '' });
var encR = Object.keys(R[0] || {});
fs.unlinkSync(tmp);

// ── las columnas de la llave, pedidas a la librería en CADA hoja por separado
var ID_CAM = 'Camp' + 'aña', ID_TP = 'Touch' + 'Point', ID_SEG = 'Segmento', ID_MAR = 'Marca';
var ID_Q = 'Quincena_Lanzamiento Principal';
var rCAM = COL.de(R, ID_CAM, 'resumen'), rTP = COL.de(R, ID_TP, 'resumen'),
    rSEG = COL.de(R, ID_SEG, 'resumen'), rMAR = COL.de(R, ID_MAR, 'resumen'), rQ = COL.de(R, ID_Q, 'resumen');
var mCAM = COL.de(filasM, ID_CAM, 'resumen'), mTP = COL.de(filasM, ID_TP, 'resumen'),
    mSEG = COL.de(filasM, ID_SEG, 'resumen'), mQ = COL.de(filasM, ID_Q, 'resumen');

// ── 1 · las filas de Maggi, del reporte. La MARCA manda, no el nombre de la campaña.
var mag = R.filter(function (r) { return /maggi/i.test(t(r[rMAR])); });
var esLiga = function (r, c) { return /liga/i.test(t(r[c])); };
var mundial = mag.filter(function (r) { return !esLiga(r, rCAM); });
var liga = mag.filter(function (r) { return esLiga(r, rCAM); });
console.log('  del reporte: ' + mag.length + ' filas de Maggi   (Mundial ' + mundial.length + ' · Liga MX ' + liga.length + ')');
console.log('  en la hoja hoy: ' + filasM.length + ' filas · ' + encM.length + ' columnas');

if (mundial.length !== N_MUNDIAL) {
  console.log('\n  🔴 Mundial trae ' + mundial.length + ' filas y el bloque de la hoja tiene ' + N_MUNDIAL + '.');
  console.log('     Mover el separador cambiaría el diseño que Rick pidió conservar. Se declara y no se escribe.');
  process.exit(1);
}

// ── 2 · qué columnas manda cada lado
var propias = encM.filter(function (c) { return c && encR.indexOf(c) < 0; });
var comunes = encM.filter(function (c) { return c && encR.indexOf(c) >= 0; });
console.log('  columnas: ' + comunes.length + ' del reporte  ·  ' + propias.length + ' propias de la hoja (se conservan)');

function kEst(r, cam, tp, seg, q) { return [t(r[cam]), t(r[tp]), t(r[seg]), t(r[q])].join(' ¦ '); }
function kFlo(r, cam, tp, q) { return [t(r[cam]), t(r[tp]), t(r[q])].join(' ¦ '); }
var kR = function (r) { return kEst(r, rCAM, rTP, rSEG, rQ); };
var kM = function (f) { return kEst(f, mCAM, mTP, mSEG, mQ); };
var fR = function (r) { return kFlo(r, rCAM, rTP, rQ); };
var fM = function (f) { return kFlo(f, mCAM, mTP, mQ); };

var viejasPorK = {}, viejasPorFlo = {};
filasM.forEach(function (f) { viejasPorK[kM(f)] = f; (viejasPorFlo[fM(f)] = viejasPorFlo[fM(f)] || []).push(f); });
var nuevasPorFlo = {};
mag.forEach(function (r) { (nuevasPorFlo[fR(r)] = nuevasPorFlo[fR(r)] || []).push(r); });

function viejaDe(r) {
  var e = viejasPorK[kR(r)];
  if (e) return { f: e, via: 'estricta' };
  var vs = viejasPorFlo[fR(r)] || [], ns = nuevasPorFlo[fR(r)] || [];
  if (vs.length === 1 && ns.length === 1) return { f: vs[0], via: 'respaldo' };
  return null;
}

// ── 3 · la tabla que se va a escribir
var plan = [], conservadas = 0, nuevas = 0, viaResp = [], usadas = [];
function armar(reg, fila) {
  var v = viejaDe(reg);
  if (v) { conservadas++; usadas.push(v.f); if (v.via !== 'estricta') viaResp.push(kR(reg) + '   ⟵   ' + kM(v.f)); } else nuevas++;
  encM.forEach(function (cNom, ci) {
    if (!cNom) return;
    var esComun = encR.indexOf(cNom) >= 0;
    plan.push({ fila: fila, col: ci, nom: cNom,
      valor: esComun ? reg[cNom] : (v ? v.f[cNom] : ''),
      de: esComun ? 'reporte' : (v ? 'se conserva' : 'vacío (fila nueva)') });
  });
}
mundial.forEach(function (r, i) { armar(r, FILA_MUNDIAL + i); });
liga.forEach(function (r, i) { armar(r, FILA_LIGA + i); });

console.log('\n  ── el emparejado');
console.log('     filas que ya existían: ' + conservadas + '   ·   filas NUEVAS: ' + nuevas);
if (viaResp.length) {
  console.log('     ⚠ ' + viaResp.length + ' por el respaldo (cambiaron de segmento; conservan sus columnas propias):');
  viaResp.forEach(function (k) { console.log('        ' + k); });
}
var sinUsar = filasM.filter(function (f) { return usadas.indexOf(f) < 0; });
if (sinUsar.length) {
  console.log('     ⚠ ' + sinUsar.length + ' fila(s) de la hoja que el reporte ya no tiene — se sobrescriben:');
  sinUsar.forEach(function (f) { console.log('        ' + kM(f)); });
}
console.log('\n  celdas a escribir: ' + plan.length + '   (Liga MX en las filas ' + FILA_LIGA + '..' + (FILA_LIGA + liga.length - 1) + '; el separador 16-17 no se toca)');

if (!ESCRIBIR) {
  var ult = FILA_LIGA + liga.length - 1;
  console.log('\n  ── muestra: la última fila (' + ult + ')');
  plan.filter(function (p) { return p.fila === ult && t(p.valor) !== ''; }).slice(0, 12).forEach(function (p) {
    console.log('     ' + p.nom.slice(0, 30).padEnd(32) + String(p.valor).slice(0, 24).padEnd(26) + p.de);
  });
  console.log('\n  (seco. Para escribir: --escribir)');
  process.exit(0);
}

// ── 4 · escribir por XML, heredando estilos
var resp = BACK + '/_respaldos/v8-antes-maggi-copiar.xlsx';
fs.copyFileSync(LIBRO, resp);
console.log('\n  ── respaldo: ' + resp.split(/[\\/]/).pop());

var trabajo = BACK + '/_tmp/_maggi-w.xlsx';
fs.copyFileSync(LIBRO, trabajo);
var zip = new AdmZip(trabajo);
var idx = XLSX.readFile(trabajo).SheetNames.indexOf(HOJA);
var rel = 'xl/worksheets/sheet' + (idx + 1) + '.xml';
var ent = zip.getEntry(rel);
if (!ent) { console.log('  🔴 no encontré ' + rel); process.exit(1); }
var xml = zip.readAsText(ent);
console.log('     parte: ' + rel);

function colLetra(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var estiloCol = {};
encM.forEach(function (c, ci) { if (c) estiloCol[ci] = CX.estiloDe(xml, colLetra(ci) + FILA_MUNDIAL); });

var como = {}, escritas = 0;
plan.forEach(function (p) {
  var ref = colLetra(p.col) + p.fila;
  var nueva = CX.celda(ref, p.valor, CX.estiloDe(xml, ref) || estiloCol[p.col]);
  var r2 = CX.poner(xml, ref, nueva, p.fila);
  xml = r2.xml; como[r2.como] = (como[r2.como] || 0) + 1; escritas++;
});
console.log('     celdas escritas: ' + escritas + '   ' + Object.keys(como).map(function (k) { return k + ' ' + como[k]; }).join(' · '));
// 🔴 una fila autocerrada (`<row r="24"/>`) EXISTE y no admite celdas: `poner` devolvería «sin
//    fila», escribiría CERO y no fallaría. Se comprueba antes de publicar.
if (como['sin fila']) { console.log('  🔴 ' + como['sin fila'] + ' celda(s) no se pudieron poner (fila autocerrada). NO se publica.'); process.exit(1); }

zip.updateFile(rel, Buffer.from(xml, 'utf8'));
zip.writeZip(trabajo);

// ── 5 · las capas, ANTES de publicar
var N = process.execPath, H = os.homedir();
function capa(nom, cmd, args) {
  var r = cp.spawnSync(cmd, args, { encoding: 'utf8' });
  var out = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(function (l) { return /==>|✅|🔴|✓/.test(l); }).pop() || '';
  console.log('     ' + (r.status === 0 ? '✔' : '🔴') + ' ' + nom.padEnd(20) + out.trim().slice(0, 72));
  return r.status === 0;
}
console.log('\n  ── las 5 capas');
var ok = capa('xlsx-safe-save', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js', trabajo]);
ok = capa('xlsx-label', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-label.js', trabajo]) && ok;
ok = capa('xlsx-check', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-check.js', trabajo]) && ok;
ok = capa('xlsx-validar-fondo', require(__dirname + '/lib-entorno.js').PYTHON, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-validar-fondo.py', trabajo]) && ok;
ok = capa('xlsx-orden-celdas', N, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-orden-celdas.js', trabajo]) && ok;
if (!ok) { console.log('\n  🔴 una capa falló — NO se publica.'); process.exit(1); }

fs.copyFileSync(trabajo, LIBRO);
console.log('     → publicado al vivo');

// ── 6 · releer del disco y comparar contra el reporte
var v2 = BACK + '/_tmp/_maggi-v.xlsx';
fs.copyFileSync(LIBRO, v2);
var M2 = XLSX.utils.sheet_to_json(XLSX.readFile(v2).Sheets[HOJA], { defval: '' });
fs.unlinkSync(v2);
var mal = 0, mostrados = 0;
mag.forEach(function (r) {
  var f = M2.filter(function (x) { return kM(x) === kR(r); })[0];
  if (!f) { console.log('     🔴 falta en la hoja: ' + kR(r)); mal++; return; }
  comunes.forEach(function (c) {
    if (t(f[c]) !== t(r[c])) {
      if (mostrados++ < 6) console.log('     🔴 ' + kR(r).slice(0, 32) + ' · ' + c + ': hoja «' + t(f[c]).slice(0, 12) + '» vs reporte «' + t(r[c]).slice(0, 12) + '»');
      mal++;
    }
  });
});
console.log('\n  ── releído del disco');
console.log('     filas en la hoja: ' + M2.length + '   ·   de Maggi en el reporte: ' + mag.length);
console.log('     ' + (mal ? '🔴 ' + mal + ' diferencia(s)' : '✔ las ' + mag.length + ' filas coinciden en las ' + comunes.length + ' columnas comunes'));
// ── 7 · 🔴 NINGUNA CELDA DE RICK SE PUEDE HABER PERDIDO
//
//    Este paso conserva las 13 columnas propias emparejando por identidad, y eso basta mientras la
//    identidad no cambie. Pero J9 YA cambió de segmento una vez, y una fila nueva no tiene de quién
//    conservar nada: las dos puertas y la comparación de arriba pasarían en verde con 91 celdas
//    suyas vacías, porque ninguna de las dos mira esas columnas — el reporte no las tiene.
//    Por eso se comprueba contra el contrato, que es su única copia fuera del Excel. Si falta una,
//    este paso FALLA: perder trabajo que nadie puede reproducir no es un aviso, es un bloqueo.
var RUTA_VDR = BACK + '/_contratos/maggi-valores-de-rick.json';
if (fs.existsSync(RUTA_VDR)) {
  var VDR = JSON.parse(fs.readFileSync(RUTA_VDR, 'utf8'));
  var guardadas = VDR.celdas || {};
  var idM2 = function (f) { return [t(f[mCAM]), t(f[mTP]), t(f[mSEG]), t(f[mQ])].join(' ¦ '); };
  var vivas = {};
  M2.forEach(function (f) { (VDR.columnas_protegidas || []).forEach(function (c) { if (t(f[c]) !== '') vivas[idM2(f) + ' ¦¦ ' + c] = f[c]; }); });
  var perdidas = Object.keys(guardadas).filter(function (k) { return vivas[k] === undefined; });
  console.log('     valores de Rick: ' + Object.keys(vivas).length + ' en la hoja · ' + Object.keys(guardadas).length + ' en el contrato');
  if (perdidas.length) {
    console.log('     🔴 SE PERDIERON ' + perdidas.length + ' celda(s) que escribió Rick:');
    perdidas.slice(0, 8).forEach(function (k) { console.log('        ' + k.replace(' ¦¦ ', '   →   ')); });
    console.log('     Se reponen con:  node maggi.valores-de-rick.js --restaurar');
    mal += perdidas.length;
  } else console.log('     ✔ ninguna celda de Rick se perdió');
} else {
  console.log('     ⊘ no hay contrato de los valores de Rick — córrelo con `maggi.valores-de-rick.js --capturar`.');
  console.log('       NO cuenta como pasar: sin él, perder una de sus celdas no lo nota nadie.');
}

console.log('\n════ ' + (mal ? '🔴 NO quedó' : '✅ MAGGI COPIADO DEL REPORTE, verificado contra el disco') + ' ════');
process.exit(mal ? 1 : 0);
