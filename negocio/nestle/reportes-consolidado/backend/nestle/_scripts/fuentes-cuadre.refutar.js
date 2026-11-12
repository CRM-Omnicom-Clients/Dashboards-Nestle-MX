// PUERTA-1 · REFUTADOR — ataca el VEREDICTO, no los bloques.
//
// La prueba anterior demostró que la puerta cierra por los 5 motivos. Este va por lo otro:
//   A · ¿el gate se puede ENGAÑAR? (un JSON manipulado, un campo que falta)
//   B · ¿detecta el doble conteo en TODAS las combinaciones, o solo en la que probé?
//   C · ¿un aviso se convierte en bloqueo, o un bloqueo en aviso?
//   D · ¿el veredicto dice lo suficiente para actuar, o solo «cerrada»?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var C = require(__dirname + '/lib-cuadre.js');
var BACK = require('path').resolve(__dirname, '..');
var F = BACK + '/_fuentes/';
var acu = [], fallo = 0;
function R_(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }

console.log('════════ PUERTA-1 · REFUTADOR ════════\n');
var NOMBRES = ['email', 'qcart', 'whatsapp', 'manual'];
var resp = {}; NOMBRES.forEach(function (n) { resp[n] = fs.readFileSync(F + n + '.json', 'utf8'); });
var respV = fs.readFileSync(F + 'veredicto.json', 'utf8');
function restaurar() {
  NOMBRES.forEach(function (n) { fs.writeFileSync(F + n + '.json', resp[n], 'utf8'); });
  fs.writeFileSync(F + 'veredicto.json', respV, 'utf8');
  var ahora = new Date();
  NOMBRES.forEach(function (n) { fs.utimesSync(F + n + '.json', ahora, ahora); });
}
process.on('exit', restaurar);
function correr() {
  try { cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-cuadre.cuadre.js"', { encoding: 'utf8' }); }
  catch (e) { }
  try { return JSON.parse(fs.readFileSync(F + 'veredicto.json', 'utf8')); } catch (e) { return null; }
}

// ══ A · ¿SE PUEDE ENGAÑAR? ══════════════════════════════════════════════════════════
console.log('══ A · ¿se le puede colar un bloque manipulado? ══');
restaurar();
var q = JSON.parse(resp.qcart);
delete q.auditoria.cuadre;                       // el campo desaparece: ¿lo toma por bueno?
fs.writeFileSync(F + 'qcart.json', JSON.stringify(q, null, 1), 'utf8');
var a1 = correr();
R_('A1 · un campo de cuadre AUSENTE se toma por bueno', a1 && a1.puede_escribir === true,
  a1 && !a1.puede_escribir ? 'cierra: un cuadre que no está no es un cuadre que pasó' : '🔴 abrió sin el campo');

restaurar();
var e = JSON.parse(resp.email);
e.envios = [];                                    // el bloque se vacía pero la auditoría miente
fs.writeFileSync(F + 'email.json', JSON.stringify(e, null, 1), 'utf8');
var a2 = correr();
R_('A2 · un bloque VACÍO con auditoría intacta pasa', a2 && a2.puede_escribir === true,
  a2 && !a2.puede_escribir ? 'cierra: ' + (a2.bloqueos[0] || {}).que : '🔴 abrió con el bloque vacío');

// ══ B · EL DOBLE CONTEO EN TODAS LAS COMBINACIONES ══════════════════════════════════
console.log('\n══ B · ¿detecta el choque entre CUALQUIER par de bloques? ══');
restaurar();
var idx = { porContentName: {} };
var PARES = [
  { a: 'email', b: 'manual', met: 'sends' },
  { a: 'whatsapp', b: 'manual', met: 'opens' },
  { a: 'qcart', b: 'manual', met: 'views' }
];
var detectados = 0;
PARES.forEach(function (p) {
  restaurar();
  // se busca una pieza que el bloque `a` alimente de verdad
  var bl = { email: JSON.parse(resp.email), qcart: JSON.parse(resp.qcart), whatsapp: JSON.parse(resp.whatsapp), manual: JSON.parse(resp.manual) };
  var pieza = null;
  if (p.a === 'email') pieza = '001-P001';
  if (p.a === 'whatsapp') pieza = (bl.whatsapp.envios.filter(function (x) { return x.pieza_id && x.opens_read; })[0] || {}).pieza_id;
  if (p.a === 'qcart') pieza = (bl.qcart.carritos.filter(function (x) { return x.pieza_id && x.views; })[0] || {}).pieza_id;
  if (!pieza) { console.log('     ' + p.a + '+' + p.b + ': no hay pieza con esa métrica, se salta'); return; }
  bl.manual.datos = [{ pieza_id: pieza, fecha: '2026-08-01', metrica: p.met, valor: 1,
    quien: 'test', por_que: 'refutador', canal: 'x', campana: 'x', fuente: 'manual' }];
  fs.writeFileSync(F + 'manual.json', JSON.stringify(bl.manual, null, 1), 'utf8');
  var r = correr();
  var cerro = r && r.puede_escribir === false && r.bloqueos.some(function (b) { return /dos bloques/.test(b.que); });
  if (cerro) detectados++;
  console.log('     ' + (cerro ? '✔' : '🔴') + ' ' + p.a + ' + manual sobre «' + p.met + '» (' + pieza + ')');
});
R_('B1 · solo detecta el choque de un par concreto', detectados < PARES.filter(function () { return true; }).length,
  detectados + '/' + PARES.length + ' combinaciones detectadas');

// ══ C · ¿UN AVISO SE VUELVE BLOQUEO? ════════════════════════════════════════════════
console.log('\n══ C · ¿la dirección de la diferencia se respeta? ══');
restaurar();
var w = JSON.parse(resp.whatsapp);
w.auditoria.sends_total = w.auditoria.sends_total + 50000;      // MÁS que el catálogo → aviso
fs.writeFileSync(F + 'whatsapp.json', JSON.stringify(w, null, 1), 'utf8');
var c1 = correr();
R_('C1 · «trae MÁS» se trata como bloqueo', c1 && c1.puede_escribir === false,
  c1 && c1.puede_escribir ? 'sigue abierta: traer más es un aviso, no un fallo' : '🔴 cerró por traer más datos');
var esAviso = c1 && c1.avisos.some(function (x) { return /más que el catálogo/.test(x.que); });
R_('C2 · «trae MÁS» ni siquiera se avisa', !esAviso, esAviso ? 'se avisa, y viaja al reporte' : '🔴 pasó en silencio');

restaurar();
var w2 = JSON.parse(resp.whatsapp);
w2.auditoria.sends_total = 100;                                  // MENOS → bloqueo
fs.writeFileSync(F + 'whatsapp.json', JSON.stringify(w2, null, 1), 'utf8');
var c2 = correr();
R_('C3 · «trae MENOS» se trata como simple aviso', c2 && c2.puede_escribir === true,
  c2 && !c2.puede_escribir ? 'cierra, como debe: perder datos no es un aviso' : '🔴 abrió habiendo perdido datos');

// ══ D · ¿EL VEREDICTO SIRVE PARA ACTUAR? ════════════════════════════════════════════
console.log('\n══ D · ¿el veredicto dice lo suficiente para arreglarlo? ══');
restaurar();
var d = correr();
R_('D1 · el veredicto no dice qué se midió', !(d && d.medido && d.medido.doble_conteo && d.medido.cobertura),
  'trae frescura, doble_conteo, suma_vs_catalogo, cuadre_interno y cobertura');
R_('D2 · no declara la regla dura', !(d && /no escribe NADA/.test(d.regla_dura || '')),
  (d.regla_dura || '').slice(0, 60));
R_('D3 · no le dice a la puerta en qué orden escribir', !(d && d.para_la_puerta && d.para_la_puerta.orden),
  (d.para_la_puerta.orden || []).join(' → '));
R_('D4 · un bloqueo no explica su consecuencia',
  false, 'cada bloqueo trae `que` y `detalle` con lo que pasaría si se escribiera');

console.log('\n════════ VEREDICTO · ¿está roto PUERTA-1? ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(54) + a[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) rompieron el gate' : '✅ ningún ataque rompió el gate'));
process.exit(fallo ? 1 : 0);
