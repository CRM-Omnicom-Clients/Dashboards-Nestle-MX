// manual-bloque · SIMULACIÓN DEL PRIMER DATO MANUAL — el único camino que existe.
//
// 🔴 Este paso está VACÍO hoy, así que correrlo no prueba absolutamente nada. La única forma de
//    saber si funciona es escribir el CSV que Rick escribiría y correr **el manual-bloque de verdad**.
//    Y hay que probarlo con las filas MAL escritas, no solo con la buena: el día que se use va a
//    ser con prisa y nadie va a releer el LEEME.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), cp = require('child_process');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ manual-bloque · SIMULACIÓN DEL PRIMER DATO MANUAL ════════\n');
var CSV = PROY + '/_manual/_sim-liga-mx.csv';
var BLOQUE = BACK + '/_fuentes/manual.json';
var respaldo = fs.readFileSync(BLOQUE, 'utf8');
var antes = JSON.parse(respaldo);
console.log('  estado actual: ' + antes.datos.length + ' datos manuales (vacío, como debe estar)\n');

function limpiar() {
  try { fs.unlinkSync(CSV); } catch (e) { }
  fs.writeFileSync(BLOQUE, respaldo, 'utf8');
}
process.on('exit', limpiar);

// ── el CSV que Rick escribiría, con sus errores típicos ─────────────────────────────
var CASOS = [
  { l: '005-P001,2026-08-22,sends,12500,Rick,Liga MX P1 — Datorama aún no lo trae', d: 'dato bueno → ENTRA' },
  { l: '005-P001,2026-08-22,opens,3100,Rick,idem P1', d: 'segundo dato de la misma pieza → ENTRA' },
  { l: '005-P002,2026-09-06,sends,9800,Rick,Liga MX P2', d: 'otra pieza → ENTRA' },
  { l: '005-P003,2026-09-19,sends,7000,,falta el autor', d: 'sin «quien» → RECHAZO' },
  { l: '005-P003,2026-09-19,opens,2000,Rick,', d: 'sin «por_que» → RECHAZO' },
  { l: '999-P999,2026-08-22,sends,500,Rick,pieza inventada', d: 'pieza que no existe → FUERA' },
  { l: '005-P001,2026-08-22,ctor,0.12,Rick,quiero meter una tasa', d: 'métrica CALCULADA → RECHAZO' },
  { l: '005-P004,2026-08-22,sends,abc,Rick,valor mal escrito', d: 'valor no numérico → RECHAZO' },
  { l: '001-P001,2026-03-19,sends,70421,Rick,por si acaso', d: 'lo que Datorama YA trae → REDUNDANTE' }
];
fs.writeFileSync(CSV, 'pieza_id,fecha,metrica,valor,quien,por_que\n' +
  CASOS.map(function (c) { return c.l; }).join('\n') + '\n', 'utf8');
console.log('  CSV simulado con ' + CASOS.length + ' filas:');
CASOS.forEach(function (c) { console.log('     · ' + c.d); });

try {
  var salida = cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-manual.manual.js"', { encoding: 'utf8' });
  console.log('\n' + salida.split('\n').filter(function (l) { return /entran|fuera|cuadra|REDUNDANTES|ya viene|datos manuales|rechazadas|f  \d/.test(l); }).slice(0, 14).join('\n'));

  var B = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  function motivoDe(pred) {
    return B.rechazados_por_forma.concat(B.fuera_por_reglas).filter(pred)[0];
  }

  console.log('\n══ ¿cada regla hizo su trabajo? ══');
  chk('el dato bueno ENTRA', B.datos.some(function (d) { return d.pieza_id === '005-P001' && d.metrica === 'sends' && d.valor === 12500; }),
    B.datos.length + ' datos cargados de 9 filas');
  chk('hereda las dimensiones de su pieza',
    B.datos.length > 0 && !!B.datos[0].campana && !!B.datos[0].canal,
    B.datos.length ? B.datos[0].campana + ' · ' + B.datos[0].canal + ' · ' + B.datos[0].touchpoint : '');

  var sinQuien = motivoDe(function (r) { return /sin «quien»/.test(r.motivo || ''); });
  chk('sin «quien» se RECHAZA', !!sinQuien, sinQuien ? sinQuien.motivo.slice(0, 60) : '🔴 entró');
  var sinPor = motivoDe(function (r) { return /sin «por_que»/.test(r.motivo || ''); });
  chk('sin «por_que» se RECHAZA', !!sinPor, sinPor ? sinPor.motivo.slice(0, 60) : '🔴 entró');

  var piezaMala = B.fuera_por_reglas.filter(function (r) { return r.pieza_id === '999-P999'; })[0];
  chk('la pieza inexistente queda FUERA', !!piezaMala, piezaMala ? piezaMala.motivo_exclusion.slice(0, 62) : '🔴 entró');

  var tasa = motivoDe(function (r) { return r.metrica === 'ctor'; });
  chk('la métrica CALCULADA se rechaza', !!tasa, tasa ? tasa.motivo.slice(0, 62) : '🔴 entró una tasa');

  var noNum = motivoDe(function (r) { return /no es un número/.test(r.motivo || ''); });
  chk('el valor no numérico se rechaza', !!noNum, noNum ? noNum.motivo : '🔴 entró');

  var red = B.redundantes[0];
  chk('🔴 lo que la fuente automática YA trae NO se carga', !!red,
    red ? red.metrica + ' de ' + red.pieza_id + ' ya viene de ' + red.cubierto_por : '🔴 se cargó por encima de Datorama');

  chk('el cuadre da con datos reales', B.auditoria.cuadre,
    B.datos.length + ' dentro + ' + B.auditoria.fuera_por_reglas + ' fuera + ' + B.auditoria.rechazados_por_forma + ' rechazados');

  // ── la corrección: el mismo dato con otro valor ────────────────────────────────
  console.log('\n══ ¿se puede CORREGIR un dato manual? ══');
  fs.writeFileSync(CSV, 'pieza_id,fecha,metrica,valor,quien,por_que\n' +
    '005-P001,2026-08-22,sends,13100,Rick,corrijo: el dato final de Liga MX P1\n', 'utf8');
  cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-manual.manual.js"', { encoding: 'utf8' });
  var B2 = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  var corr = B2.datos.filter(function (d) { return d.pieza_id === '005-P001' && d.metrica === 'sends'; })[0];
  console.log('     005-P001 · sends → ' + (corr ? corr.valor + (corr.valor_anterior !== undefined ? '   (antes ' + corr.valor_anterior + ')' : '') : '?'));
  chk('la corrección gana y conserva el valor anterior',
    !!corr && corr.valor === 13100 && corr.valor_anterior === 12500,
    corr ? 'valor ' + corr.valor + ' · anterior ' + corr.valor_anterior + ' · por ' + corr.quien : '');
  chk('los datos que no se volvieron a declarar SIGUEN ahí',
    B2.datos.some(function (d) { return d.metrica === 'opens' && d.pieza_id === '005-P001'; }),
    B2.datos.length + ' datos · borrar una fila del CSV no borra el dato cargado');

  // ── idempotencia ───────────────────────────────────────────────────────────────
  console.log('\n══ ¿correrlo dos veces cambia algo? ══');
  var n1 = B2.datos.length;
  cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-manual.manual.js"', { encoding: 'utf8' });
  var B3 = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  chk('correrlo dos veces no cambia nada', B3.datos.length === n1 && B3.auditoria.nuevos === 0,
    n1 + ' → ' + B3.datos.length + ' · nuevos: ' + B3.auditoria.nuevos);

} finally {
  limpiar();
  var fin = JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
  console.log('\n══ ¿quedó todo como estaba? ══');
  chk('el CSV simulado se borró y el bloque se restauró',
    !fs.existsSync(CSV) && fin.datos.length === antes.datos.length,
    fin.datos.length + ' datos · la carpeta _manual quedó solo con su plantilla');
}

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' regla(s) no se aplican' : '✅ las 4 reglas funcionan · el script está listo para el día que haga falta'));
process.exit(fallo ? 1 : 0);
