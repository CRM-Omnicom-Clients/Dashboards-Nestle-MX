// S7 · ANEXAR LAS FILAS QUE LA REJILLA DECLARÓ — y dejar la de totales AL FINAL.
//
// 🔴 POR QUÉ ESTE PASO TENÍA QUE EXISTIR. El escritor (`N6`) no anexa filas nunca, y con razón:
//    cuando la identidad de una pieza cambia, él no puede saber si es una fila nueva o la misma
//    con otro nombre — y anexando produjo 9 duplicados que DOBLARON los totales. Su salida es
//    DECLARAR lo que no tiene fila. Pero declarar no es entregar: si nadie toma esa lista, una
//    campaña nueva no aparece jamás en el reporte. Este paso la toma, con dos condiciones:
//      1 · solo anexa lo que N6 declaró (no busca por su cuenta), y
//      2 · comprueba una por una que su identidad+quincena NO exista ya en la hoja.
//
// 🔴 Y LA DE TOTALES SE QUEDA AL FINAL. Ya pasó lo contrario: una fila de WhatsApp quedó DEBAJO
//    de la fila de totales, cuyo `SUM(X2:X74)` no la alcanzaba, y sus 2,000 envíos se quedaron
//    fuera del total sin que nada avisara. Aquí las nuevas entran donde estaba la de totales y
//    ella se reescribe al final, con sus rangos corregidos.
//
// 🔴 LAS FÓRMULAS COMPARTIDAS SE EXPANDEN ANTES. Escribir encima de una celda MAESTRA de un
//    `<f t="shared">` deja huérfanas a todas sus hijas y `safe-save` se niega a guardar — con
//    razón: el libro quedaría roto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var SIN = BACK + '/_rejilla/sin-fila-en-el-reporte.json';
if (!fs.existsSync(SIN)) { console.log('✅ no hay celdas sin fila. Nada que anexar.'); process.exit(0); }
var decl = JSON.parse(fs.readFileSync(SIN, 'utf8'));
var REJ = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));

console.log('════════ S7 · ANEXAR ' + decl.length + ' FILA(S) DECLARADA(S) ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_s7.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Report_Resumen'];
var rng = XLSX.utils.decode_range(sh['!ref']);
var enc = [];
for (var c = rng.s.c; c <= rng.e.c; c++) { var hh = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; enc.push(hh ? t(hh.v) : ''); }
var h = R.abrir('resumen', enc, { silencioso: true });
var LLAVE = ['resumen.campana', 'resumen.objetivo', 'resumen.touchpoint', 'resumen.segmento', 'resumen.quincena_lanzamiento'];
h.exigir(LLAVE.concat(['resumen.tot_sends']), 'S7-anexar');
console.log('  registro ✔\n');
var N = function (k) { return h.n('resumen.' + k); };

// ── la fila de totales: la que NO tiene TouchPoint y sí trae números
var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
var iTot = -1;
F.forEach(function (x, i) { if (!t(x[N('touchpoint')]) && Number(t(x[N('tot_sends')]).replace(/,/g, '')) > 0) iTot = i; });
if (iTot < 0) { console.log('  🔴 no encontré la fila de totales. No se toca nada.'); process.exit(1); }
var filaTot = iTot + 2, ultimaHoy = rng.e.r + 1;
console.log('  fila de totales: ' + filaTot + '   ·   última fila de la hoja: ' + ultimaHoy);
if (filaTot !== ultimaHoy) console.log('  ⚠ la de totales NO es la última: hay ' + (ultimaHoy - filaTot) + ' fila(s) por debajo, fuera de su SUM');

// ── el guardián: ninguna declarada puede existir ya
var existe = {};
F.forEach(function (x) { existe[LLAVE.map(function (id) { return nmz(x[h.n(id)]); }).join('¦')] = 1; });
var aAnexar = [], yaEstaban = [];
decl.forEach(function (d) {
  var k = [d.campana, d.objetivo, d.tp, d.seg, d.quincena].map(nmz).join('¦');
  if (existe[k]) { yaEstaban.push(d); return; }
  var celda = (REJ.rejilla || []).filter(function (cc) {
    return nmz(cc.campana) === nmz(d.campana) && nmz(cc.objetivo) === nmz(d.objetivo) &&
      nmz(cc.touchpoint) === nmz(d.tp) && nmz(cc.segmento) === nmz(d.seg) && nmz(cc.quincena) === nmz(d.quincena);
  })[0];
  if (!celda) { console.log('  🔴 declarada pero no está en la rejilla: ' + k); return; }
  aAnexar.push({ d: d, celda: celda, k: k });
  existe[k] = 1;   // dos declaradas idénticas no se anexan dos veces
});
if (yaEstaban.length) console.log('  ○ ' + yaEstaban.length + ' declarada(s) que YA tienen fila — no se anexan');
console.log('  a anexar: ' + aAnexar.length + '   Σ ' + mil(aAnexar.reduce(function (a, x) { return a + (x.celda.total.sends || 0); }, 0)) + ' envíos\n');
aAnexar.forEach(function (x, i) {
  console.log('   ' + String(filaTot + i).padEnd(5) + t(x.d.campana).padEnd(16) + t(x.d.tp).padEnd(14) +
    t(x.d.seg).slice(0, 26).padEnd(28) + t(x.d.quincena).padEnd(14) + mil(x.celda.total.sends).padStart(9));
});
if (!aAnexar.length) { console.log('\n  nada que hacer.'); process.exit(0); }
var filaTotNueva = filaTot + aAnexar.length;
console.log('\n  la fila de totales se mueve: ' + filaTot + ' → ' + filaTotNueva + '   (sus SUM pasan de 2:' + (filaTot - 1) + ' a 2:' + (filaTotNueva - 1) + ')');
if (!ESCRIBIR) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

// ══ ESCRIBIR ═══════════════════════════════════════════════════════════════════════
// 1 · expandir las compartidas, para no dejar huérfanas al mover la fila de totales
try {
  cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/reportes/_expandir-compartidas.js" "' + SECO + '"', { encoding: 'utf8' });
  console.log('\n  ── fórmulas compartidas expandidas');
} catch (e) { console.log('\n  ⚠ no se pudieron expandir las compartidas: ' + String(e.message).slice(0, 80)); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);

// 2 · guardar la fila de totales tal cual está, para reescribirla abajo
var totXml = new RegExp('<row r="' + filaTot + '"[^>]*>([\\s\\S]*?)</row>').exec(xml);
if (!totXml) { console.log('  🔴 no pude leer la fila de totales del XML.'); process.exit(1); }
// 🔴 UNA CELDA AUTOCERRADA (`<c r="B75" s="61"/>`) ROMPE CUALQUIER REGEX `<c ...>…</c>`: el
//    `[^>]*` se traga la barra, el `>` casa con el cierre del propio tag, y el `[\s\S]*?</c>`
//    sigue devorando hasta el siguiente cierre — comiéndose varias celdas de una. Es el quinto
//    tropiezo del proyecto con lo mismo. Se parte primero en celdas COMPLETAS (las dos formas) y
//    después se lee cada una. Sin esto vi 41 de 58 y perdí las 40 fórmulas de la fila.
var celdasTot = [];
(totXml[1].match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || []).forEach(function (s) {
  var m = /^<c r="([A-Z]+)\d+"([^>]*?)\/>$/.exec(s);
  if (m) { celdasTot.push({ col: m[1], attr: m[2] || '', cont: null }); return; }
  m = /^<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*)<\/c>$/.exec(s);
  if (m) celdasTot.push({ col: m[1], attr: m[2] || '', cont: m[3] });
});
var conFormulaOrig = celdasTot.filter(function (x) { return x.cont && /<f[\s>]/.test(x.cont); }).length;
console.log('  ── la fila de totales tiene ' + celdasTot.length + ' celda(s), ' + conFormulaOrig + ' con fórmula');

// 3 · las filas nuevas, donde estaba la de totales
var estilo = {};
enc.forEach(function (n, i) { estilo[i] = CX.estiloDe(xml, R.letra(i) + '2') || CX.estiloDe(xml, 'A1'); });
function valorDe(nom, cc) {
  var M = {}; M[N('campana')] = cc.campana; M[N('medio')] = cc.medio; M[N('objetivo')] = cc.objetivo;
  M[N('touchpoint')] = cc.touchpoint; M[N('segmento')] = cc.segmento; M[N('quincena_lanzamiento')] = cc.quincena;
  M[N('mes')] = cc.mes; M[N('marca')] = cc.marca; M[N('bu')] = cc.bu;
  M[N('principal_sends')] = cc.principal.sends; M[N('principal_deliveries')] = cc.principal.deliveries;
  M[N('principal_opens')] = cc.principal.opens; M[N('principal_clicks')] = cc.principal.clicks;
  M[N('fup_sends')] = cc.fup.sends; M[N('fup_deliveries')] = cc.fup.deliveries;
  M[N('fup_opens')] = cc.fup.opens; M[N('fup_clicks')] = cc.fup.clicks;
  M[N('tot_sends')] = cc.total.sends; M[N('tot_deliveries')] = cc.total.deliveries;
  M[N('tot_opens')] = cc.total.opens; M[N('tot_clicks')] = cc.total.clicks;
  M[N('wa_envios')] = cc.whatsapp.sends;
  M[N('content_id_sfmc')] = Object.keys(cc.content_ids || {}).join(' · ');
  M[N('email_id_sfmc')] = Object.keys(cc.email_ids || {}).join(', ');
  return M[nom];
}
var nuevasXml = '';
aAnexar.forEach(function (x, i) {
  var nf = filaTot + i, celdas = [];
  enc.forEach(function (nom, j) {
    var v = valorDe(nom, x.celda);
    if (v === undefined || v === null || v === '') return;
    celdas.push(CX.celda(R.letra(j) + nf, v, estilo[j]));
  });
  nuevasXml += '<row r="' + nf + '">' + celdas.join('') + '</row>';
});

// 4 · la fila de totales, reescrita abajo con sus rangos corregidos
// 🔴 dos patrones y solo dos: `SUM(X2:X<ultima>)` y referencias a su propia fila (`Q75/P75`).
var totNuevaXml = '<row r="' + filaTotNueva + '">' + celdasTot.map(function (cc) {
  var cont = cc.cont;
  // 🔴 SOLO SE LE QUITA EL VALOR CACHEADO A LAS CELDAS QUE TIENEN FÓRMULA. La primera versión se
  //    lo quitaba a TODAS y borró las etiquetas de la fila —«Total» incluida—, dejándola en
  //    blanco. Una celda de texto no tiene nada que recalcular: su `<v>` ES el dato.
  if (cont && /<f[\s>]/.test(cont)) {
    cont = cont.replace(/(<f[^>]*>)([\s\S]*?)(<\/f>)/, function (_, a, f, b) {
      // 🔴 EL REEMPLAZO VA POR FUNCIÓN, NO POR CADENA. `'$12:$1' + 87` no es «grupo 1, luego 2»:
      //    JavaScript lee `$12` como el GRUPO 12, que no existe, y deja la fórmula intacta. Las
      //    fórmulas se quedaron en `SUM(O2:O74)` cuando debían decir `SUM(O2:O87)` — y el archivo
      //    pasaba todas las validaciones, porque un rango corto no es un error de estructura:
      //    es un total que miente.
      f = f.replace(new RegExp('([A-Z]+)2:([A-Z]+)' + (filaTot - 1) + '(?!\\d)', 'g'),
        function (todo2, c1, c2) { return c1 + '2:' + c2 + (filaTotNueva - 1); });
      f = f.replace(new RegExp('([A-Z]+)' + filaTot + '(?!\\d)', 'g'),
        function (todo2, c1) { return c1 + filaTotNueva; });
      return a + f + b;
    });
    // el valor cacheado de una FÓRMULA sí deja de valer al cambiar su rango: Excel lo recalcula
    cont = cont.replace(/<v>[\s\S]*?<\/v>/, '');
  }
  var at = cc.attr.replace(/\s*t="shared"[^\s>]*/g, '').replace(/\s*si="\d+"/g, '');
  return '<c r="' + cc.col + filaTotNueva + '"' + at + (cont === null ? '/>' : '>' + cont + '</c>');
}).join('') + '</row>';

// 5 · sustituir: fuera la fila de totales vieja, dentro las nuevas + la de totales al final
xml = xml.replace(new RegExp('<row r="' + filaTot + '"[^>]*>[\\s\\S]*?</row>'), nuevasXml + totNuevaXml);
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2) {
  return '<dimension ref="' + c1 + r1 + ':' + c2 + filaTotNueva + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('  ── safe-save');
console.log('     validado: ' + (safeSave(SECO, SECO).validado || '?'));

// ── releer del disco
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Report_Resumen'], { defval: '', blankrows: false });
var conId = V.filter(function (x) { return t(x[N('touchpoint')]); });
console.log('\n  ── releído: ' + V.length + ' filas   ·   con identidad: ' + conId.length);
console.log('     Σ Tot_Sends de las filas con identidad: ' + mil(conId.reduce(function (a, x) { return a + (Number(t(x[N('tot_sends')]).replace(/,/g, '')) || 0); }, 0)));
console.log('     la rejilla dice: ' + mil((REJ.rejilla || []).reduce(function (a, cc) { return a + (cc.total.sends || 0); }, 0)));
var sh2 = XLSX.readFile(SECO).Sheets['Report_Resumen'];
var ultima2 = XLSX.utils.decode_range(sh2['!ref']).e.r + 1;
console.log('     ¿la de totales quedó al final? ' + (filaTotNueva === ultima2 ? '✔ fila ' + filaTotNueva + ' de ' + ultima2 : '🔴 ' + filaTotNueva + ' vs ' + ultima2));
// 🔴 LA FILA DE TOTALES SE COMPRUEBA CONTRA EL XML, NO CONTRA SheetJS. Dos veces me dio un falso
//    rojo: SheetJS no materializa una celda de fórmula SIN valor cacheado —y acabamos de quitarle
//    el cacheado a propósito— ni una celda vacía autocerrada. Leída así, la fila parecía tener 1
//    celda cuando tenía 58. Se lee el XML, que es lo que Excel va a abrir.
// 🔴 Y SE MIRA EL RANGO, no solo que las fórmulas existan: una que siga diciendo `SUM(O2:O74)`
//    cuando la última fila es la 87 pasa TODAS las validaciones de estructura y aun así da un
//    total corto. Un total que miente no es un problema de paquete, y por eso nadie lo veía.
var zip2 = new AdmZip(SECO);
var xml2 = zip2.readAsText(parte);
var mTot = new RegExp('<row r="' + filaTotNueva + '"[^>]*>([\\s\\S]*?)</row>').exec(xml2);
var celTot2 = mTot ? (mTot[1].match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || []) : [];
var fTot2 = celTot2.filter(function (s2) { return /<f[\s>]/.test(s2); });
var rangosViejos = fTot2.filter(function (s2) { return new RegExp(':[A-Z]+' + (filaTot - 1) + '(?!\\d)').test(s2); });
console.log('     la fila de totales: ' + celTot2.length + ' celda(s), ' + fTot2.length + ' con fórmula   ' +
  (celTot2.length >= celdasTot.length && fTot2.length >= conFormulaOrig ? '✔' : '🔴 SE PERDIÓ CONTENIDO'));
console.log('     rangos al día (2:' + (filaTotNueva - 1) + '): ' +
  (rangosViejos.length ? '🔴 ' + rangosViejos.length + ' fórmula(s) siguen apuntando a 2:' + (filaTot - 1) + ' — el total saldría corto' : '✔ ninguna quedó corta'));
if (fTot2.length) console.log('     ejemplo: ' + fTot2[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
if (celTot2.length < celdasTot.length || fTot2.length < conFormulaOrig || rangosViejos.length) process.exit(1);
console.log('\n  archivo listo en: ' + SECO + '   (aún NO publicado)');
