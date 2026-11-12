// nestle-catalogo · QUITAR EL NÚMERO DUPLICADO A LAS FILAS GEMELAS. NO borra ninguna fila.
//
// 🔴 QUÉ PASÓ. Un script escribió el 20-ago-2026 doce filas de Fuel for life (`009-P018`..`P029`)
//    que NO son piezas: son copias. La prueba no es que se parezcan, son tres hechos:
//      1 · las DOCE llevan el MISMO `jobId` en su procedencia. Un solo envío de SFMC no puede
//          producir doce cifras distintas — el script se quedó pegado con el último id que leyó.
//      2 · sus doce cifras son EXACTAMENTE las de `009-P006`..`P017`, cada una con su gemela.
//      3 · no tienen `Email_Name`, ni `TouchPoint`, ni `Quincena` — las tres cosas que hacen que
//          una pieza cruce con algo. Nunca cruzaron con SFMC y nunca llegaron al reporte.
//
// 🔴 POR QUÉ SE QUITA EL NÚMERO Y NO LA FILA. Borrar una fila desplaza todo lo de abajo — es la
//    operación que en agosto perdió cinco columnas del catálogo — y además no se deshace solo.
//    Quitar el número es reversible (respaldo + git), deja la fila a la vista para que Rick decida
//    qué son, y logra lo único que hace falta: que el catálogo deje de reclamar 49,237 envíos que
//    ya está contando su gemela. Eso es lo que tiene cerrada la PUERTA 1.
//
// 🔴 Y LA PRUEBA SE COMPRUEBA AQUÍ, NO SE CONFÍA. El script no trae una lista de ids: BUSCA las
//    gemelas y exige los tres hechos antes de tocar nada. Si mañana una de esas filas recibe un
//    nombre —o su cifra deja de coincidir con la de su gemela— deja de calificar y no se toca.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(t(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var HUECO = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-|)$/i;
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;
var HOJA = 'Catalogo_Piezas';
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

DECL.declarar('nestle-catalogo', 'catalogo.limpiar-sends-duplicados.js', [{
  hoja: HOJA, grano: 'una CELDA — la columna de envíos de una fila gemela probada',
  llave: 'Pieza_ID', celdas_esperadas: 'solo las filas que cumplan los TRES hechos; 0 filas borradas'
}]);

console.log('════════ nestle-catalogo · QUITAR EL NÚMERO A LAS GEMELAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_gem.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var ws = XLSX.readFile(TMP).Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c0 = rng.s.c; c0 <= rng.e.c; c0++) { var e0 = ws[XLSX.utils.encode_cell({ r: 0, c: c0 })]; enc[c0] = e0 ? t(e0.v) : ''; }
var P = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_' + 'ID'), nmS = COL.de(P, 'Sends'), nmC = COL.de(P, 'Campaña');
var nmE = COL.de(P, 'Email_Name'), nmT = COL.de(P, 'TouchPoint'), nmQ = COL.de(P, 'Quincena'), nmF = COL.de(P, 'Fuente_Dato');
var iSends = enc.indexOf(nmS), iPieza = enc.indexOf(nmP);
var filaDe = {};
for (var r0 = 1; r0 <= rng.e.r; r0++) {
  var cP = ws[XLSX.utils.encode_cell({ r: r0, c: iPieza })];
  var idr = cP ? t(cP.v) : ''; if (idr) filaDe[idr] = r0 + 1;
}
var piezas = P.filter(function (p) { return ES_PIEZA.test(t(p[nmP])); });
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + piezas.length + ' piezas\n');

// ── HECHO 3 · candidatas: con número de envíos, pero sin nombre / sin touchpoint / sin quincena
function jobDe(p) { var m = /jobId\s+(\d+)/i.exec(t(p[nmF])); return m ? m[1] : null; }
var candidatas = piezas.filter(function (p) {
  return num(p[nmS]) > 0 && HUECO.test(t(p[nmE])) && HUECO.test(t(p[nmT])) && HUECO.test(t(p[nmQ]));
});
console.log('  ── hecho 3 · filas con envíos pero SIN nombre, SIN touchpoint y SIN quincena: ' + candidatas.length);
if (!candidatas.length) { console.log('\n  ✅ ninguna candidata. Nada que hacer.'); process.exit(0); }

// ── HECHO 1 · ¿comparten un mismo jobId, y ese jobId pertenece a OTRA pieza que sí cruza?
var porJob = {};
candidatas.forEach(function (p) { var j = jobDe(p); if (j) (porJob[j] = porJob[j] || []).push(p); });
console.log('  ── hecho 1 · sus jobId:');
Object.keys(porJob).forEach(function (j) {
  var dueno = piezas.filter(function (p) { return jobDe(p) === j && !HUECO.test(t(p[nmE])); }).map(function (p) { return t(p[nmP]); });
  console.log('     job ' + j + '  →  ' + porJob[j].length + ' fila(s) sin nombre lo comparten' +
    (dueno.length ? '   ·   y pertenece de verdad a ' + dueno.join(' · ') : '   ·   🔴 ninguna pieza con nombre lo reclama'));
});

// ── HECHO 2 · cada candidata tiene una GEMELA con nombre: misma campaña, mismo número de envíos
var plan = [], sinGemela = [];
candidatas.forEach(function (p) {
  var j = jobDe(p);
  var compartido = j && porJob[j] && porJob[j].length > 1;
  var gemelas = piezas.filter(function (q) {
    return t(q[nmP]) !== t(p[nmP]) && t(q[nmC]) === t(p[nmC]) && num(q[nmS]) === num(p[nmS]) && !HUECO.test(t(q[nmE]));
  });
  if (!compartido || gemelas.length !== 1) { sinGemela.push({ p: p, motivo: !compartido ? 'su jobId no lo comparte nadie' : (gemelas.length ? gemelas.length + ' gemelas posibles' : 'no encontré gemela con nombre') }); return; }
  plan.push({ id: t(p[nmP]), fila: filaDe[t(p[nmP])], campana: t(p[nmC]), sends: num(p[nmS]),
    gemela: t(gemelas[0][nmP]), gemelaTP: t(gemelas[0][nmT]), gemelaSeg: t(gemelas[0]['Segmento'] || gemelas[0][COL.de(P, 'Segmento')]), job: j });
});

console.log('\n  ── hecho 2 · cada una contra su gemela con nombre');
plan.forEach(function (x) {
  console.log('     🧹 ' + x.id + '  ' + String(x.sends).padStart(7) + ' envíos   ≡   ' + x.gemela +
    ' (' + x.gemelaTP + ' · ' + String(x.gemelaSeg).slice(0, 26) + ')   job ' + x.job);
});
sinGemela.forEach(function (s) {
  console.log('     ⊘  ' + t(s.p[nmP]) + '  ' + String(num(s.p[nmS])).padStart(7) + ' envíos   — ' + s.motivo + ' · NO SE TOCA');
});

var suma = plan.reduce(function (a, x) { return a + x.sends; }, 0);
console.log('\n  ═══ ' + plan.length + ' fila(s) califican   ·   ' + suma.toLocaleString('es-MX') + ' envíos duplicados que el catálogo deja de reclamar');
console.log('      🔒 CERO filas borradas · solo se vacía la celda de envíos · se deshace con `git checkout` o con el respaldo');
if (!plan.length) { console.log('\n  ✅ ninguna califica.'); process.exit(0); }
fs.writeFileSync(BACK + '/_preescritura/PRE-gemelas-sends.json', JSON.stringify({ cuando: new Date().toISOString(), plan: plan, sinGemela: sinGemela.map(function (s) { return { pieza: t(s.p[nmP]), motivo: s.motivo }; }) }, null, 1));
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-gemelas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte), hechas = 0;
// 🔴 se vacía CONSERVANDO EL ESTILO: `<c r="REF" s="N"/>`. El formato lo edita Rick (E5).
plan.forEach(function (x) {
  var ref = col(iSends) + x.fila;
  var re = new RegExp('<c r="' + ref + '"(?:([^>]*?)\\/>|([^>]*?)>[\\s\\S]*?<\\/c>)');
  var hit = re.exec(xml); if (!hit) return;
  var attrs = (hit[1] !== undefined ? hit[1] : hit[2]) || '';
  var st = /\bs="(\d+)"/.exec(attrs);
  xml = xml.replace(hit[0], '<c r="' + ref + '"' + (st ? ' s="' + st[1] + '"' : '') + '/>');
  hechas++;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + hechas + ' de ' + plan.length + ' celda(s) vaciadas');
if (hechas !== plan.length) { console.log('  🔴 faltaron celdas: NO se publica.'); process.exit(1); }

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 62)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 62)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER (E4) · y comprobar que las GEMELAS BUENAS no se movieron ═════════════════
console.log('\n  ── releído del disco');
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets[HOJA], { defval: '', blankrows: false });
var mal = 0;
plan.forEach(function (x) {
  var q = P2.filter(function (y) { return t(y[nmP]) === x.id; })[0];
  var vacia = q && HUECO.test(t(q[nmS]));
  var g = P2.filter(function (y) { return t(y[nmP]) === x.gemela; })[0];
  var gOk = g && num(g[nmS]) === x.sends;
  console.log('     ' + (vacia && gOk ? '✔ ' : '🔴 ') + x.id + ' vaciada' + (vacia ? '' : ' 🔴') +
    '   ·   ' + x.gemela + ' intacta: ' + (g ? num(g[nmS]).toLocaleString('es-MX') : '?') + (gOk ? '' : ' 🔴 CAMBIÓ'));
  if (!vacia || !gOk) mal++;
});
console.log('     filas del catálogo: ' + P.length + ' → ' + P2.length + (P.length === P2.length ? '   ✔ NINGUNA se borró' : '   🔴 SE PERDIERON FILAS'));
if (P.length !== P2.length) mal++;
console.log('\n  ' + (mal ? '🔴 ' + mal + ' no quedaron' : '✅ LISTO · ' + plan.length + ' números duplicados fuera · ' + P2.length + ' filas intactas'));
process.exit(mal ? 1 : 0);
