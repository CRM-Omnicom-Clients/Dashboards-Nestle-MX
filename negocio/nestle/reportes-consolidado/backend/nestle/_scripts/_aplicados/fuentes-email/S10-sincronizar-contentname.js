// S10 · SINCRONIZAR EL ContentName DEL CATÁLOGO CON EL DE SFMC.
//
// 🔴 EL HANDOFF LO DICE SIN AMBIGÜEDAD: «el ContentName es la identidad; el número de pieza es
//    solo un alias interno». Si el catálogo guarda un ContentName distinto del que SFMC tiene,
//    la llave no cruza — y el bloque cae al alias como respaldo. Funciona, pero por la puerta de
//    atrás: la Puerta 1 lo detecta como «dato sin pieza» porque su índice sí usa la llave buena.
//
// 🔴 QUIÉN MANDA EN ESTE CAMPO: **SFMC**. No es una preferencia — es de dónde sale el dato. El
//    catálogo manda en las dimensiones (campaña, segmento, objetivo); SFMC manda en la identidad
//    del correo. Cada campo tiene un dueño y este no es nuestro.
//
// ⚠ Solo se toca el ContentName, y solo cuando el EmailID coincide: sin esa prueba, «parecerse»
//   no basta para reescribir una llave.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var INS = BACK + '/_insumos/sfmc-piezas-20ago.txt';
var D = JSON.parse(fs.readFileSync(INS, 'utf8'));
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_s10.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
h.exigir(['catalogo.pieza_id', 'catalogo.content_name', 'catalogo.emailid'], 'S10');
var N = function (k) { return h.n('catalogo.' + k); };
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

console.log('════════ S10 · ContentName del catálogo ← SFMC ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

// índice del catálogo por ContentName y por EmailID
var porCN = {}, porEID = {};
CAT.forEach(function (p, i) {
  t(p[N('content_name')]).split(/\s*[·|]\s*/).forEach(function (cn) { if (t(cn)) porCN[t(cn)] = { p: p, fila: i + 2 }; });
  t(p[N('emailid')]).split(/\s*,\s*/).forEach(function (e) { if (t(e)) porEID[t(e)] = { p: p, fila: i + 2 }; });
});

var cambios = [], sinPieza = [];
D.rows.forEach(function (r) {
  var cn = t(r.Email_Content_Name), eid = t(r.Email_ID);
  if (porCN[cn]) return;                                    // ya cruza por la llave: nada que hacer
  var m = porEID[eid];
  if (!m) { sinPieza.push({ cn: cn, eid: eid, camp: t(r.Campana), sends: t(r.Email_Sends) }); return; }
  cambios.push({ fila: m.fila, pieza: t(m.p[N('pieza_id')]), de: t(m.p[N('content_name')]), a: cn, eid: eid });
});

console.log('  piezas de la DE que NO cruzan por ContentName: ' + (cambios.length + sinPieza.length));
cambios.forEach(function (c) {
  console.log('   ✔ ' + c.pieza.padEnd(10) + '(EmailID ' + c.eid + ')');
  console.log('        de: ' + (c.de || '(vacío)').slice(0, 78));
  console.log('         a: ' + c.a.slice(0, 78));
});
if (sinPieza.length) {
  console.log('\n  🔴 ' + sinPieza.length + ' de la DE sin pieza NI por ContentName NI por EmailID:');
  sinPieza.forEach(function (x) { console.log('     ' + t(x.camp).padEnd(16) + 'EmailID ' + t(x.eid).padEnd(8) + t(x.sends).padStart(9) + '  ' + x.cn.slice(-46)); });
}
console.log('\n  a sincronizar: ' + cambios.length + '   ·   sin pieza: ' + sinPieza.length);
if (!ESCRIBIR || !cambios.length) {
  if (!cambios.length) console.log('\n  ✅ todo cruza por ContentName. Nada que sincronizar.');
  else console.log('\n  (seco. Para aplicar: --escribir)');
  process.exit(0);
}

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var iCN = h.col('catalogo.content_name').i;
cambios.forEach(function (c) {
  var ref = R.letra(iCN) + c.fila;
  xml = CX.poner(xml, ref, CX.celda(ref, c.a, CX.estiloDe(xml, ref) || CX.estiloDe(xml, R.letra(iCN) + '2')), c.fila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var vCN = {}; V.forEach(function (p) { var c = t(p[N('content_name')]); if (c) vCN[c] = 1; });
var cruzan = D.rows.filter(function (r) { return vCN[t(r.Email_Content_Name)]; }).length;
console.log('  ── releído: ' + cruzan + '/' + D.count + ' piezas de la DE cruzan por ContentName ' + (cruzan === D.count ? '✔' : '🔴'));
console.log('\n  archivo listo en: ' + SECO);
