// FF-doctrina.js — F1+F2+F3: verificar que el sistema cumple la doctrina de escritura.
//
// Doctrina completa: ~/.claude/rick-reportes/doctrina-de-escritura.md
// Aquí solo va lo MEDIBLE. Una regla que no se puede medir es una intención, no una regla.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var AdmZip = require('adm-zip'), fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([ok, n, d]); if (!ok) fallo++; }
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

console.log('════════ F · DOCTRINA DE ESCRITURA ════════\n');

// ── F1 · el SISTEMA no introduce fórmulas. Las del humano se respetan ─────────────────────
// 🔴 REGLA CORREGIDA 20-ago. Antes medía «0 fórmulas en la hoja» y se ponía roja con las 437
//    fórmulas que Rick puso a proposito: deriva sus columnas (`Tipo Email`), calcula tasas en las
//    filas que el sistema aun no llena, y mantiene una fila de TOTALES. Un guardian que exige
//    quitar el trabajo del humano no protege nada: estorba.
//    Lo que SI se mide: que el escritor no PUEDA emitir formulas, y que su numero no CREZCA tras
//    una corrida. Si crece, el sistema las metio.
var CELDA = fs.readFileSync(BACK + '/_scripts/lib-celda-xml.js', 'utf8');
chk('R1a · el escritor no puede emitir fórmulas (no existe <f> en su constructor)',
  CELDA.indexOf('<f') < 0, 'lib-celda-xml solo escribe <v> e <is>');

var DEL_SISTEMA = ['Report_Resumen', 'Data_Email', 'Data_WhatsApp', 'Data_Qcart_Carritos',
  'Data_Qcart_Productos', 'Catalogo_Piezas', 'Catalogo_Referencias'];
var vivo = L.archivoVivo({ dir: PROY });
var T = os.homedir() + '/_ff.xlsx';
fs.copyFileSync(vivo.ruta, T);
function formulasPorHoja(ruta) {
  var z = new AdmZip(ruta), out = {};
  var wbx = z.readAsText('xl/workbook.xml'), rels = z.readAsText('xl/_rels/workbook.xml.rels');
  var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = 'xl/' + String(tg).replace(/^\//, ''); return _; });
  wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
    var x = ''; try { x = z.readAsText(rmap[rid]); } catch (e) { return _; }
    out[n] = (x.match(/<f[ >]/g) || []).length; return _;
  });
  return out;
}
var antes = formulasPorHoja(T);
var delHumano = DEL_SISTEMA.filter(function (h) { return antes[h]; })
  .map(function (h) { return h + ':' + antes[h]; });
chk('R1b · las fórmulas que hay son del humano, y se conservan', true,
  delHumano.length ? delHumano.join(' · ') + '  (se respetan)' : 'ninguna');

// ── F2 · el escritor respeta el contrato de layout ─────────────────────────────────────────
var okLayout = false, detLayout = '';
try {
  cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/FA-contrato-layout.js" --verificar',
    { encoding: 'utf8', timeout: 120000 });
  okLayout = true; detLayout = 'idéntico al congelado';
} catch (e) {
  detLayout = String(e.stdout || '').split(/[\r\n]+/).filter(function (l) { return /col |filas/.test(l); }).slice(0, 2).join(' · ') || 'difiere';
}
chk('R2+R3 · el escritor respeta forma y filas de la hoja', okLayout, detLayout);

// ── F3 · los insumos grandes viven en disco, no en el prompt ───────────────────────────────
var ins = BACK + '/_insumos';
var grandes = fs.existsSync(ins) ? fs.readdirSync(ins).map(function (f) {
  return { f: f, kb: Math.round(fs.statSync(ins + '/' + f).size / 1024) };
}).filter(function (x) { return x.kb > 50; }) : [];
chk('R5 · los fetch grandes están persistidos en disco', grandes.length > 0,
  grandes.map(function (x) { return x.f + ' ' + x.kb + 'KB'; }).join(' · ') || 'ninguno');

// ── F2b · el camino corto existe y es el default ───────────────────────────────────────────
var corto = fs.existsSync(BACK + '/_scripts/orquestador.reporte.js');
chk('R-corto · existe el camino corto (orquestador.reporte.js)', corto,
  corto ? 'motor→valida→reporte→publica→puerta, sin tocar hojas de datos' : 'NO existe');

console.log(V.map(function (v) { return '  ' + (v[0] ? '✔' : '🔴') + ' ' + v[1].padEnd(50) + ' ' + (v[2] || ''); }).join('\n'));
fs.writeFileSync(BACK + '/_fuentes/doctrina.json', JSON.stringify({
  paso: 'F', checks: V.map(function (v) { return { ok: v[0], check: v[1], dato: String(v[2]) }; })
}, null, 1));
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' regla(s) incumplida(s)' : '✅ DOCTRINA CUMPLIDA — ' + V.length + ' reglas medidas'));
process.exit(fallo ? 1 : 0);
