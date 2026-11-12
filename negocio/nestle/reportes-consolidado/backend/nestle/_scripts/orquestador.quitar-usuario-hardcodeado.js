/*
 * orquestador.quitar-usuario-hardcodeado.js — saca el nombre de usuario de las rutas escritas en
 * los scripts.
 *
 * 🔴 ES LA REGLA QUE EL PROPIO CLAUDE.md PROHÍBE: «Nunca hardcodear el username en rutas». Once
 *    scripts llevan `C:/Users/Ricardo.Aguilar/...` escrito, así que **para cualquier otra persona
 *    truenan**. Ninguno está en la cadena —el corte sí corre limpio en otra máquina— pero entre
 *    ellos está `escritor.restaurar.js`, que es la herramienta de restaurar: la que más falta hace
 *    justo cuando algo salió mal.
 *
 * 🔴 SE SUSTITUYE POR `os.homedir()`, NO POR UNA VARIABLE NUEVA. El resto del backend ya resuelve
 *    así; inventar aquí otra forma sería una segunda manera de decir lo mismo, que es como estas
 *    cosas divergen. Si el archivo no tiene `os` requerido, se declara y NO se toca: meterle un
 *    require a ciegas puede chocar con su propio `var os`.
 *
 * ⚠ NO ARREGLA LA RUTA DEL PROYECTO. 165 scripts llevan escrita la carpeta del cliente y 49 el
 *   nombre del libro. Eso es portabilidad de verdad y pide un contrato de rutas, no un reemplazo
 *   de texto: va en el plan de migración, no aquí.
 *
 *   node orquestador.quitar-usuario-hardcodeado.js            (seco)
 *   node orquestador.quitar-usuario-hardcodeado.js --escribir
 */
var fs = require('fs'), os = require('os'), path = require('path');
var D = require('path').resolve(__dirname, '..') + '/_scripts';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var USUARIO = path.basename(os.homedir());            // el de ESTA máquina, no uno escrito

console.log('════ QUITAR EL USUARIO DE LAS RUTAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════');
console.log('  usuario de esta máquina: ' + USUARIO + '\n');

// 🔴 el patrón se arma con el usuario REAL, no con «Ricardo.Aguilar» escrito: si mañana esto corre
//    en otra cuenta, sigue encontrando lo suyo en vez de buscar un nombre que ya no es el de nadie.
var reRuta = new RegExp("(['\"])([A-Za-z]:[\\\\/]+Users[\\\\/]+" + USUARIO.replace(/\./g, '\\.') + ")", 'g');

var tocados = [], sinOs = [];
fs.readdirSync(D).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  var p = path.join(D, f);
  var t = fs.readFileSync(p, 'utf8');
  if (!reRuta.test(t)) return;
  reRuta.lastIndex = 0;
  // ¿el archivo ya tiene `os` disponible?
  var tieneOs = /require\(\s*['"]os['"]\s*\)/.test(t);
  var n = (t.match(reRuta) || []).length;
  reRuta.lastIndex = 0;
  if (!tieneOs) { sinOs.push(f + '  (' + n + ' ruta(s)) — no requiere `os`, se declara y NO se toca'); return; }
  // `'C:/Users/X/resto'`  →  `os.homedir() + '/resto'`
  var nuevo = t.replace(reRuta, function (_, comilla) { return 'os.homedir() + ' + comilla; });
  tocados.push({ f: f, p: p, n: n, nuevo: nuevo });
});

tocados.forEach(function (x) { console.log('  ' + (ESCRIBIR ? '✔' : '·') + ' ' + x.f.padEnd(40) + x.n + ' ruta(s)'); });
sinOs.forEach(function (s) { console.log('  ⚠ ' + s); });
console.log('\n  ' + tocados.length + ' script(s) se arreglan  ·  ' + sinOs.length + ' quedan declarados');

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

var rotos = [];
tocados.forEach(function (x) {
  fs.writeFileSync(x.p, x.nuevo);
  // 🔴 se comprueba que SIGA SIENDO JAVASCRIPT VÁLIDO. Un reemplazo de texto puede dejar una
  //    comilla huérfana y el script no truena hasta que alguien lo invoca, que es tarde.
  try { new (require('vm').Script)(fs.readFileSync(x.p, 'utf8'), { filename: x.p }); }
  catch (e) { rotos.push(x.f + ': ' + String(e.message).slice(0, 60)); }
});
console.log('\n  ── releído del disco');
console.log('     ' + (rotos.length ? '🔴 ' + rotos.length + ' con sintaxis rota: ' + rotos.join(' · ') : '✔ los ' + tocados.length + ' siguen compilando'));

// y que ya no quede ninguna
var quedan = fs.readdirSync(D).filter(function (f) {
  if (!/\.js$/.test(f)) return false;
  var t = fs.readFileSync(path.join(D, f), 'utf8');
  reRuta.lastIndex = 0; return reRuta.test(t);
});
console.log('     ' + (quedan.length ? '⚠ quedan ' + quedan.length + ': ' + quedan.join(' · ') : '✔ ningún script lleva ya el usuario en una ruta'));
console.log('\n════ ' + (rotos.length ? '🔴 NO quedó' : '✅ ' + tocados.length + ' SCRIPTS PORTABLES') + ' ════');
process.exit(rotos.length ? 1 : 0);
