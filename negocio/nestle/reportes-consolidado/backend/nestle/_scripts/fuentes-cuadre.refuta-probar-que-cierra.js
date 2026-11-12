// PUERTA-1 · ¿LA PUERTA CIERRA CUANDO DEBE?
//
// 🔴 EL RIESGO DE ESTE SCRIPT ES ESE: un gate que siempre da verde no es un gate, es un adorno.
//    Y con datos sanos siempre da verde, así que la única forma de saber si sirve es
//    **romper los bloques a propósito** y comprobar que se cierra por el motivo correcto.
//
// Se rompe una copia, se corre el PUERTA-1 de verdad, y se restaura. El Excel nunca se toca.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var F = BACK + '/_fuentes/';
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ PUERTA-1 · ¿LA PUERTA CIERRA CUANDO DEBE? ════════\n');

// respaldar los 4 bloques
var NOMBRES = ['email', 'qcart', 'whatsapp', 'manual'];
var respaldo = {};
NOMBRES.forEach(function (n) { respaldo[n] = fs.readFileSync(F + n + '.json', 'utf8'); });
var respVeredicto = fs.existsSync(F + 'veredicto.json') ? fs.readFileSync(F + 'veredicto.json', 'utf8') : null;
function restaurar() {
  NOMBRES.forEach(function (n) { fs.writeFileSync(F + n + '.json', respaldo[n], 'utf8'); });
  if (respVeredicto) fs.writeFileSync(F + 'veredicto.json', respVeredicto, 'utf8');
}
process.on('exit', restaurar);

function correr() {
  try {
    cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-cuadre.cuadre.js"', { encoding: 'utf8' });
    return JSON.parse(fs.readFileSync(F + 'veredicto.json', 'utf8'));
  } catch (e) {
    // exit 1 = puerta cerrada, que es justo lo que se busca aquí
    try { return JSON.parse(fs.readFileSync(F + 'veredicto.json', 'utf8')); }
    catch (e2) { return { veredicto: 'NO GENERÓ VEREDICTO', bloqueos: [], puede_escribir: false }; }
  }
}

// ── 0 · con datos sanos, la puerta ABRE ─────────────────────────────────────────────
console.log('══ 0 · el control: con los bloques sanos ══');
var sano = correr();
console.log('     ' + sano.veredicto + '   bloqueos: ' + sano.bloqueos.length + '   avisos: ' + sano.avisos.length);
chk('con datos sanos la puerta ABRE', sano.puede_escribir === true,
  sano.veredicto + ' — si esto fallara, el gate sería inservible por lo contrario');

// ── 1 · doble conteo ────────────────────────────────────────────────────────────────
console.log('\n══ 1 · un dato contado por DOS bloques ══');
restaurar();
var wa = JSON.parse(respaldo.whatsapp);
var em = JSON.parse(respaldo.email);
// se le da a un envío de WhatsApp la pieza de un envío de email que ya tiene sends
var piezaEmail = null;
var cat = JSON.parse(fs.readFileSync(F + 'email.json', 'utf8'));
// tomamos una pieza que el bloque de email sí alimenta
var manual = JSON.parse(respaldo.manual);
manual.datos = [{ pieza_id: '001-P001', fecha: '2026-03-19', metrica: 'sends', valor: 999,
  quien: 'test', por_que: 'inyectado para probar el gate', canal: 'Email', campana: 'AON', fuente: 'manual' }];
fs.writeFileSync(F + 'manual.json', JSON.stringify(manual, null, 1), 'utf8');
var r1 = correr();
console.log('     ' + r1.veredicto + '   bloqueos: ' + r1.bloqueos.length);
r1.bloqueos.forEach(function (b) { console.log('        · ' + b.que); });
chk('CIERRA cuando dos bloques aportan el mismo dato', r1.puede_escribir === false &&
  r1.bloqueos.some(function (b) { return /dos bloques/.test(b.que); }),
  r1.bloqueos.length ? r1.bloqueos[0].que : '🔴 abrió con doble conteo');

// ── 2 · un bloque con MENOS que el catálogo ─────────────────────────────────────────
console.log('\n══ 2 · un bloque que perdió datos (menos que el catálogo) ══');
restaurar();
var em2 = JSON.parse(respaldo.email);
em2.auditoria.sends_total = em2.auditoria.sends_total - 500000;
fs.writeFileSync(F + 'email.json', JSON.stringify(em2, null, 1), 'utf8');
var r2 = correr();
console.log('     ' + r2.veredicto + '   bloqueos: ' + r2.bloqueos.length);
r2.bloqueos.forEach(function (b) { console.log('        · ' + b.que + ' — ' + b.detalle.slice(0, 62)); });
chk('CIERRA cuando un bloque trae MENOS que el catálogo', r2.puede_escribir === false &&
  r2.bloqueos.some(function (b) { return /MENOS/.test(b.que); }),
  r2.bloqueos.length ? 'detectó la pérdida de 500,000 sends' : '🔴 abrió habiendo perdido datos');

// ── 3 · bloques de generaciones distintas ───────────────────────────────────────────
console.log('\n══ 3 · bloques de dos cortes distintos ══');
restaurar();
var viejo = new Date(Date.now() - 8 * 3600 * 1000);
fs.utimesSync(F + 'qcart.json', viejo, viejo);
var r3 = correr();
console.log('     ' + r3.veredicto + '   bloqueos: ' + r3.bloqueos.length);
r3.bloqueos.forEach(function (b) { console.log('        · ' + b.que + ' — ' + b.detalle.slice(0, 66)); });
chk('CIERRA cuando los bloques son de cortes distintos', r3.puede_escribir === false &&
  r3.bloqueos.some(function (b) { return /generaciones/.test(b.que); }),
  r3.bloqueos.length ? '8 h de diferencia detectadas' : '🔴 abrió mezclando dos cortes');

// ── 4 · el cuadre interno roto ──────────────────────────────────────────────────────
console.log('\n══ 4 · el cuadre interno de un bloque, roto ══');
restaurar();
var q = JSON.parse(respaldo.qcart);
q.auditoria.cuadre = false;
fs.writeFileSync(F + 'qcart.json', JSON.stringify(q, null, 1), 'utf8');
var r4 = correr();
console.log('     ' + r4.veredicto + '   bloqueos: ' + r4.bloqueos.length);
chk('CIERRA cuando el cuadre interno de un bloque falla', r4.puede_escribir === false &&
  r4.bloqueos.some(function (b) { return /cuadre interno/.test(b.que); }),
  r4.bloqueos.length ? r4.bloqueos[0].que : '🔴 abrió con un bloque descuadrado');

// ── 5 · falta un bloque entero ──────────────────────────────────────────────────────
console.log('\n══ 5 · falta un bloque entero ══');
restaurar();
fs.unlinkSync(F + 'whatsapp.json');
var salida5 = '';
try { cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-cuadre.cuadre.js"', { encoding: 'utf8' }); }
catch (e) { salida5 = String(e.stdout || ''); }
console.log('     ' + (salida5.split('\n').filter(function (l) { return /PUERTA CERRADA|NO EXISTE/.test(l); })[0] || '').trim());
chk('CIERRA cuando falta un bloque', /PUERTA CERRADA/.test(salida5),
  'no se puede escribir un corte incompleto');
restaurar();

// ── 6 · y vuelve a abrir al arreglarlo ──────────────────────────────────────────────
console.log('\n══ 6 · ¿vuelve a ABRIR al restaurar? ══');
var r6 = correr();
console.log('     ' + r6.veredicto + '   bloqueos: ' + r6.bloqueos.length + '   avisos: ' + r6.avisos.length);
chk('vuelve a ABRIR cuando se arregla', r6.puede_escribir === true,
  'un gate que se queda cerrado para siempre es igual de inútil que uno que no cierra');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(54) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' caso(s) no cierran la puerta' : '✅ la puerta cierra por los 5 motivos, y vuelve a abrir al arreglarlos'));
process.exit(fallo ? 1 : 0);
