// E1.1+1.2 · QUÉ GUARDIÁN VIVE — y quién cubre lo que se retira.
//
// 🔴 EL DIAGNÓSTICO, medido: los guardianes de `tools/reportes/` son del SISTEMA 2. Miden hojas
//    que ya no existen (`Catalog_Campanas`, `Data_Qcart`, `Report_CompletoQcart`) o columnas que
//    se renombraron. No hay que repararlos: el sistema 3 los reemplazó por sus `*-99-validar.js`,
//    que sí corren y sí están al día.
//
// 🔴 LOS TRES MODOS DE FALLAR DE UN GUARDIÁN, y hoy vimos los tres:
//      · TRUENA          → no bloquea nada: DA PERMISO           (guardian-catalogo, fuente-qcart)
//      · MIDE MAL        → bloquea sin razón, o peor, aprueba mal (report-resumen: sumaba la fila
//                          de totales y reportó «WhatsApp 29,286 vs 14,643» — el doble exacto)
//      · MIDE OTRA COSA  → su reporte ya no existe                (campana-mes, completoqcart, insights)
//
// 🔴 NADA SE RETIRA SIN DECIR QUIÉN LO CUBRE. Si un guardián no tiene equivalente en el sistema 3,
//    se CONSERVA y se declara. Retirar cobertura en silencio es el mismo defecto que da permiso.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var TOOLS = os.homedir() + '/.claude/tools/reportes';
var ARCH = TOOLS + '/_archivo-sistema2';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// guardián del sistema 2 → qué lo cubre hoy en el sistema 3
var MAPA = [
  { g: 'guardian-catalogo.js', falla: 'TRUENA · busca la hoja Catalog_Campanas, que no existe',
    cubre: ['A5-99-validar.js (13 checks · vocabulario cerrado)', 'L2-99-validar.js (registro de nombres)', 'E0-99-validar.js (esquema y llaves)'] },
  { g: 'guardian-fuente-email.js', falla: 'TRUENA · busca una columna que A11 renombró',
    cubre: ['fuentes-email.validar.js (12 checks · el bloque de email contra la DE de SFMC)'] },
  { g: 'guardian-fuente-qcart.js', falla: 'TRUENA · busca las hojas Data_Qcart y Report_CompletoQcart, retiradas',
    cubre: ['fuentes-qcart.validar.js (12 checks)', 'B0-99-validar.js (la reconstrucción evento por evento)'] },
  { g: 'guardian-report-resumen.js', falla: 'MIDE MAL · suma la fila de totales (reportó WhatsApp 29,286 = 2 × 14,643) y cruza por hojas muertas',
    cubre: ['resumen.validar.js (cifra por cifra)', 'fuentes-cuadre.puerta2.js (reporte vs rejilla vs bloques)'] },
  { g: 'guardian-report-campana-mes.js', falla: 'MIDE OTRA COSA · su reporte se retiró en el sistema 3',
    cubre: ['— el reporte ya no existe; se retiró con su contrato'] },
  { g: 'guardian-report-completoqcart.js', falla: 'MIDE OTRA COSA · su reporte se retiró',
    cubre: ['— el reporte ya no existe'] },
  { g: 'guardian-report-insights.js', falla: 'MIDE OTRA COSA · el insights del sistema 2 se retiró',
    cubre: ['— se rehará cuando vuelva la columna de insights'] }
];

// los que SE QUEDAN, y por qué
var VIVOS = [
  { g: 'guardian-fuente-whatsapp.js', por_que: 'corre y mide la hoja Data_WhatsApp, que sigue viva. Complementa a N2c-99 (que mide el BLOQUE): uno mira la hoja, el otro el bloque.' },
  { g: 'guardian-llegada.js', por_que: 'mide la PUBLICACIÓN (origen vs destino). No depende del modelo de hojas y sigue siendo la única red del paso 11.' },
  { g: 'guardian-base.js', por_que: 'librería compartida, no es un guardián.' },
  { g: 'auditar-agentes.js', por_que: 'audita la coherencia del sistema mismo.' },
  { g: 'auditar-estructura.js', por_que: 'audita la estructura del workbook.' },
  { g: 'correr-guardianes.js', por_que: 'es el runner, no un guardián.' }
];

console.log('════════ E1.1+1.2 · QUÉ GUARDIÁN VIVE ' + (ESCRIBIR ? '🔴 RETIRA' : '(seco)') + ' ════════\n');
console.log('══ se RETIRAN ' + MAPA.length + ' guardianes del sistema 2 ══\n');
var faltaCobertura = [];
MAPA.forEach(function (m) {
  var existe = fs.existsSync(TOOLS + '/' + m.g);
  console.log('   ' + (existe ? '·' : '⊘') + ' ' + m.g.replace('.js', '').padEnd(32) + m.falla);
  m.cubre.forEach(function (c) { console.log('        cubierto por: ' + c); });
  if (m.cubre.length === 1 && /^—/.test(m.cubre[0]) && !/ya no existe|se retir|se rehará/.test(m.cubre[0])) faltaCobertura.push(m.g);
});
console.log('\n══ se QUEDAN ' + VIVOS.length + ' ══\n');
VIVOS.forEach(function (v) { console.log('   ✔ ' + v.g.replace('.js', '').padEnd(32) + v.por_que); });

// ¿los validadores que declaramos como cobertura EXISTEN y CORREN?
console.log('\n══ ¿la cobertura declarada existe de verdad? ══\n');
var cubridores = ['A5-99-validar.js', 'L2-99-validar.js', 'E0-99-validar.js', 'fuentes-email.validar.js',
  'fuentes-qcart.validar.js', 'B0-99-validar.js', 'resumen.validar.js', 'fuentes-cuadre.puerta2.js'];
var rotos = [];
cubridores.forEach(function (c) {
  var p = BACK + '/_scripts/' + c;
  if (!fs.existsSync(p)) { console.log('   🔴 ' + c.padEnd(22) + 'NO EXISTE'); rotos.push(c); return; }
  var okSintaxis = true;
  try { cp.execSync('"' + process.execPath + '" --check "' + p + '"', { stdio: 'pipe' }); } catch (e) { okSintaxis = false; }
  console.log('   ' + (okSintaxis ? '✔' : '🔴') + ' ' + c.padEnd(22) + (okSintaxis ? 'existe y compila' : 'NO COMPILA'));
  if (!okSintaxis) rotos.push(c);
});

if (rotos.length || faltaCobertura.length) {
  console.log('\n  🔴 NO se retira nada: hay cobertura declarada que no existe.');
  rotos.concat(faltaCobertura).forEach(function (r) { console.log('     · ' + r); });
  process.exit(1);
}

var doc = {
  paso: 'E1.1+1.2', fecha: '2026-08-24',
  por_que: 'Los guardianes de tools/reportes/ eran del sistema 2: median hojas y columnas que ya no existen. El sistema 3 los reemplazo por sus *-99-validar.js.',
  los_tres_modos_de_fallar: {
    TRUENA: 'no bloquea nada: da permiso',
    MIDE_MAL: 'bloquea sin razon o aprueba mal — guardian-report-resumen sumaba la fila de totales y reportaba el doble exacto',
    MIDE_OTRA_COSA: 'su artefacto ya no existe'
  },
  retirados: MAPA, vivos: VIVOS
};
if (!ESCRIBIR) { console.log('\n  (seco. Para retirar: --escribir)'); process.exit(0); }
try { fs.mkdirSync(ARCH, { recursive: true }); } catch (e) { }
var movidos = 0;
MAPA.forEach(function (m) {
  var src = TOOLS + '/' + m.g;
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, ARCH + '/' + m.g);
  fs.unlinkSync(src);
  movidos++;
});
fs.writeFileSync(ARCH + '/POR-QUE-SE-RETIRARON.json', JSON.stringify(doc, null, 1));
console.log('\n  ✔ ' + movidos + ' guardianes movidos a _archivo-sistema2/ (con su motivo)');
console.log('  → ' + ARCH.replace(os.homedir(), '~') + '/POR-QUE-SE-RETIRARON.json');
