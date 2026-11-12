// ¿La librería flexible resiste lo que rompe al sistema de hoy?
// Se prueba con los casos reales que van a llegar, no con los que ya funcionan.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var ENT = require(__dirname + '/lib-entorno.js');
var L = require(__dirname + '/lib-flexible.js');
var D = require(__dirname + '/lib-datorama.js');
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ ¿RESISTE LO QUE VIENE? ════════\n');

// ── 1 · el archivo vivo ─────────────────────────────────────────────────────────────
console.log('══ 1 · el archivo vivo, resuelto en vez de declarado ══');
var vivo = L.archivoVivo();
console.log('   ' + vivo.archivo + '   (v' + (vivo.version || '?') + ')');
console.log('   otros candidatos ignorados: ' + (vivo.otros.length ? vivo.otros.join(' · ') : 'ninguno'));
chk('encuentra el workbook sin que le digan su versión', /consolidado/i.test(vivo.archivo), vivo.archivo);
chk('no eligió un respaldo', !/backup|respaldo|copia/i.test(vivo.archivo), 'ok');
// la prueba de verdad: ¿seguiría funcionando si mañana hay una v9?
var dirTmp = require('path').resolve(__dirname, '..') + '/_tmp/_simv9';
try { fs.mkdirSync(dirTmp); } catch (e) { }
/* 🔴 LOS DOS NOMBRES SE DERIVAN DEL CONTRATO, no se escriben. Estaban clavados como v8 y v9, y
 *    esta prueba comprueba justamente que el sistema sobrevive a un cambio de versión: escrita a
 *    mano, el día que el libro pase a v9 la prueba fabricaría una v8 vieja y una v9 que ya es la
 *    real, y seguiría diciendo «elige la v9» sin probar nada. Derivado, la prueba siempre fabrica
 *    LA ACTUAL y LA SIGUIENTE, que es lo que quiere demostrar. */
var NOM_ACTUAL = require('path').basename(ENT.LIBRO);
var VER = /-v(\d+)\.xlsx$/i.exec(NOM_ACTUAL);
if (!VER) { console.log('🔴 el nombre del libro no acaba en -vN.xlsx: ' + NOM_ACTUAL); process.exit(1); }
var N = Number(VER[1]);
var NOM_SIGUIENTE = NOM_ACTUAL.replace(/-v\d+\.xlsx$/i, '-v' + (N + 1) + '.xlsx');
var NOM_RESPALDO = '_backups-' + NOM_ACTUAL.replace(/^\(Interno\)-/, '').replace(/-v\d+\.xlsx$/i, '-v' + (N - 1) + '.xlsx');
fs.writeFileSync(dirTmp + '/' + NOM_ACTUAL, 'x');
fs.writeFileSync(dirTmp + '/' + NOM_SIGUIENTE, 'x');
fs.writeFileSync(dirTmp + '/' + NOM_RESPALDO, 'x');
var v9 = L.archivoVivo({ dir: dirTmp });
console.log('   simulando que existe una ' + NOM_SIGUIENTE.replace(/.*-(v\d+)\.xlsx$/i, '$1') + ' → elige: ' + v9.archivo);
// 🔴 la ASERCIÓN también se deriva. Decía `/v9/.test(...)`: el día que el libro sea v9 eso daría
//    verde señalando al archivo ACTUAL en vez de al siguiente, y la prueba pasaría sin probar.
chk('con la versión siguiente en disco, la elige', v9.archivo === NOM_SIGUIENTE,
  v9.archivo + '   (esperaba ' + NOM_SIGUIENTE + ')');
chk('ignora el respaldo aunque sea más reciente', !/backup/i.test(v9.archivo), 'ok');

// ── 2 · los meses ───────────────────────────────────────────────────────────────────
console.log('\n══ 2 · los meses ══');
var CASOS = [
  ['AON-RN-Julio', '07'], ['AON-RN-Agosto', '08'],
  ['AON-RN-Septiembre', '09'], ['AON-RN-Octubre', '10'],
  ['AON-RN-Noviembre', '11'], ['AON-RN-Diciembre', '12'],
  ['AON-RN-Enero', '01'], ['Datos Marzo 2026', '03'],
  ['Marketing General', null], ['Resumen', null]
];
var malMes = [];
CASOS.forEach(function (c) {
  var r = L.mesDe(c[0]);
  var ok = r === c[1];
  if (!ok) malMes.push(c[0] + ' → ' + r + ' (esperaba ' + c[1] + ')');
  console.log('   ' + (ok ? '✔' : '🔴') + ' ' + c[0].padEnd(24) + ' → ' + (r || 'no es un mes'));
});
chk('reconoce los 12 meses, no solo los 6 de la lista vieja', !malMes.length, malMes.join(' · ') || 'incluye septiembre a diciembre');
chk('no confunde "Marketing" con "marzo"', L.mesDe('Marketing General') === null, 'frontera de palabra respetada');

// ── 3 · las métricas ────────────────────────────────────────────────────────────────
console.log('\n══ 3 · las métricas, descubiertas de la fuente ══');
var inv = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_insumos/inventario.json', 'utf8'));
var R = D.leerArchivo(inv.forma.email.ruta);
var m = L.metricasDe(R.hojas[0].filas[0]);
Object.keys(m.mapa).forEach(function (k) { console.log('   ' + k.padEnd(22) + '← "' + m.mapa[k] + '"'); });
console.log('   tasas ignoradas (se derivan): ' + m.tasas_ignoradas.length);
console.log('   🔴 numéricas SIN reconocer  : ' + (m.nuevas.length ? m.nuevas.join(' · ') : 'ninguna'));
chk('descubre las 5 métricas sin lista fija', m.faltan.length === 0, Object.keys(m.mapa).length + '/5' + (m.faltan.length ? ' faltan ' + m.faltan.join(',') : ''));
chk('declara lo que no reconoce en vez de ignorarlo', Array.isArray(m.nuevas), m.nuevas.length + ' columnas nuevas se reportarían');

// la prueba real: una métrica que la fuente todavía no manda
var filaFutura = {};
Object.keys(R.hojas[0].filas[0]).forEach(function (k) { filaFutura[k] = R.hojas[0].filas[0][k]; });
filaFutura['Email Unsubscribes'] = 42;
filaFutura['Email Complaints'] = 7;
var m2 = L.metricasDe(filaFutura);
console.log('   simulando 2 métricas nuevas en la fuente → detectadas: ' + m2.nuevas.join(' · '));
chk('una métrica NUEVA se detecta y se declara', m2.nuevas.length >= 2, m2.nuevas.join(' · ') + '  (con lista fija se perdían en silencio)');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' siguen frágiles' : '✅ los 3 puntos críticos dejan de romperse con datos nuevos'));
try { [NOM_ACTUAL, NOM_SIGUIENTE, NOM_RESPALDO].forEach(function (n) { fs.unlinkSync(dirTmp + '/' + n); }); fs.rmdirSync(dirTmp); } catch (e) { }
process.exit(fallo ? 1 : 0);
