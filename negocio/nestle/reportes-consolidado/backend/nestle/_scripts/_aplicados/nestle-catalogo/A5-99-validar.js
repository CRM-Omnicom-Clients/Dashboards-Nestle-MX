// A5-99 · valida el guardián de vocabulario. Un guardián que no se puede probar no protege.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var V = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/A5-vocabulario.js');
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(48) + e); c ? ok++ : mal++; }
function truena(n, dims, debe) {
  var e = null;
  try { V.exigir(dims, 'prueba'); } catch (x) { e = x; }
  chk(n, !!e && (!debe || e.message.indexOf(debe) >= 0),
    e ? (e.message.split('\n')[1] || e.message.split('\n')[0]).trim().slice(0, 56) : '🔴 NO TRONÓ');
}
console.log('════════ A5-99 · EL GUARDIÁN DE VOCABULARIO ════════\n');
console.log('══ 1 · lo inventado no pasa ══');
truena('una campaña que no existe', { campana: 'Espresso Con' }, 'Espresso Con');
truena('una marca que no existe', { marca: 'Espresso Con' });
truena('un objetivo inventado', { objetivo: 'Retención' });
truena('un BU inventado', { bu: 'Nestlé Waters' });

console.log('\n══ 2 · no se puede saltar por accidente ══');
truena('llamarlo con una cadena', 'Espresso Con', 'sin un objeto');
truena('llamarlo con null', null, 'sin un objeto');
truena('llamarlo con un objeto vacío', {}, 'ninguna de las dimensiones');
truena('llamarlo con llaves que no valida', { campaña: 'AON', segmento: 'x' }, 'ninguna de las dimensiones');

console.log('\n══ 3 · lo válido pasa, y se escribe canónico ══');
var paso = false;
try { V.exigir({ campana: 'Hackea tu café', marca: 'Concentrate', bu: 'Nescafé', objetivo: 'Awareness' }, 'prueba'); paso = true; } catch (e) { }
chk('las 4 dimensiones válidas pasan', paso, 'Hackea tu café · Concentrate · Nescafé · Awareness');
chk('el acento se corrige al escribir', V.canonico('campana', 'Hackea tu cafe') === 'Hackea tu café',
  '«Hackea tu cafe» → «' + V.canonico('campana', 'Hackea tu cafe') + '»');
chk('las mayúsculas se corrigen', V.canonico('marca', 'concentrate') === 'Concentrate',
  '«concentrate» → «' + V.canonico('marca', 'concentrate') + '»');
var ec = null;
try { V.canonico('campana', 'Inventada'); } catch (x) { ec = x; }
chk('canonico() truena si no existe', !!ec, ec ? 'no devuelve un valor inventado' : '🔴 devolvió algo');

console.log('\n══ 4 · el catálogo contra el vocabulario ══');
var cp = require('child_process');
var salida = '';
try { salida = cp.execSync('"' + process.execPath + '" "' + __dirname + '/A5-vocabulario.js"', { encoding: 'utf8' }); }
catch (e) { salida = (e.stdout || '') + ''; }
var fuera = /el catálogo usa (\d+) valor/.exec(salida);
chk('la auditoría dice cuántos valores están fuera', !!fuera || /no usa nada fuera/.test(salida),
  fuera ? '🔴 ' + fuera[1] + ' fuera del vocabulario — los arregla A3' : '✔ ninguno fuera');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ EL GUARDIÁN PROTEGE Y NO SE PUEDE SALTAR') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
