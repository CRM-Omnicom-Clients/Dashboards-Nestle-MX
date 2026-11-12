// B0 · VALIDAR LA RECONSTRUCCIÓN — qué cambió al usar el padrón fresco, y por qué.
//
// 🔴 Una reconstrucción que solo dice «ahora hay más» no se puede revisar. Este paso empareja el
//    bloque de antes contra el de ahora **evento por evento** y clasifica cada diferencia con su
//    causa. Si un evento entró, tiene que poderse decir por cuál link y con qué fecha.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(54) + e); c ? ok++ : mal++; }

console.log('════════ B0-99 · QUÉ CAMBIÓ AL RECONSTRUIR ════════\n');
var A = JSON.parse(fs.readFileSync('C:/Users/RICARD~1.AGU/AppData/Local/Temp/claude/qcart-antes-b0.json', 'utf8'));
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var PAD = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8'));
var val = PAD.links_validos || {};

['carritos', 'productos'].forEach(function (k) {
  var antes = {}, ahora = {};
  (A[k] || []).forEach(function (e) { antes[C.llaveEvento(e)] = e; });
  (B[k] || []).forEach(function (e) { ahora[C.llaveEvento(e)] = e; });
  var entran = Object.keys(ahora).filter(function (x) { return !antes[x]; });
  var salen = Object.keys(antes).filter(function (x) { return !ahora[x]; });
  console.log('══ ' + k.toUpperCase() + '   antes ' + mil(Object.keys(antes).length) + '  →  ahora ' + mil(Object.keys(ahora).length) +
    '   (entran ' + entran.length + ' · salen ' + salen.length + ')');

  // los que entran: cada uno tiene que tener un link declarado, con su fecha
  var porLink = {};
  entran.forEach(function (x) {
    var e = ahora[x], c = t(e.shortlink_code);
    porLink[c] = porLink[c] || { n: 0, pieza: t(e.pieza_id), fecha_link: val[c] ? val[c].fecha_activacion : null, hoja: val[c] ? val[c].hoja : '' };
    porLink[c].n++;
  });
  var sinDeclarar = Object.keys(porLink).filter(function (c) { return !porLink[c].fecha_link; });
  chk('todo evento que ENTRA viene de un link declarado', sinDeclarar.length === 0,
    sinDeclarar.length ? '🔴 ' + sinDeclarar.join(' · ') : Object.keys(porLink).length + ' link(s)');
  Object.keys(porLink).sort(function (a, b) { return porLink[b].n - porLink[a].n; }).slice(0, 8).forEach(function (c) {
    var x = porLink[c];
    console.log('        +' + String(x.n).padStart(4) + '  ' + c.padEnd(11) + 'pieza ' + (x.pieza || '—').padEnd(10) +
      'link declarado ' + (x.fecha_link || '?') + '  (hoja ' + x.hoja + ')');
  });

  // los que salen: tiene que haber un motivo, nunca una pérdida muda
  if (salen.length) {
    var porSale = {};
    salen.forEach(function (x) {
      var e = antes[x], c = t(e.shortlink_code);
      var motivo = !val[c] ? 'su link ya no está en la autoridad'
        : (t(e.fecha).slice(0, 10) < val[c].fecha_activacion ? 'es anterior a la activación del link (' + val[c].fecha_activacion + ')' : '⚠ sin motivo claro');
      porSale[motivo] = (porSale[motivo] || 0) + 1;
    });
    console.log('     por qué salen:');
    Object.keys(porSale).forEach(function (m) { console.log('        −' + String(porSale[m]).padStart(4) + '  ' + m); });
    chk('ningún evento sale sin motivo', !porSale['⚠ sin motivo claro'], porSale['⚠ sin motivo claro'] ? '🔴 ' + porSale['⚠ sin motivo claro'] : 'todos explicados');
  } else { chk('ningún evento sale sin motivo', true, 'no salió ninguno'); }

  // y ninguno cargado puede ser anterior a la activación de su link… **salvo los declarados**.
  // 🔴 Mi primera versión de este check daba 122 fallas que no eran fallas: el filtro tiene una
  //    excepción legítima —cuando la fecha del link contradice a su propia hoja, no se recorta,
  //    porque recortar por un typo borra tráfico bueno— y **la declara evento por evento** en
  //    `aviso`. Un check que ignora una excepción declarada no está midiendo, está adivinando.
  var antesDe = (B[k] || []).filter(function (e) {
    var c = t(e.shortlink_code), l = val[c];
    return l && t(e.fecha).slice(0, 10) < l.fecha_activacion;
  });
  var declarados = antesDe.filter(function (e) { return t(e.aviso); });
  var mudos = antesDe.filter(function (e) { return !t(e.aviso); });
  chk('ningún evento anterior a su activación entra SIN declararlo', mudos.length === 0,
    mudos.length ? '🔴 ' + mudos.length + ' mudos' : mil((B[k] || []).length) + ' revisados · ' + declarados.length + ' con excepción declarada');
  if (declarados.length) {
    var porAviso = {};
    declarados.forEach(function (e) { porAviso[t(e.aviso)] = (porAviso[t(e.aviso)] || 0) + 1; });
    Object.keys(porAviso).forEach(function (a) { console.log('        ' + String(porAviso[a]).padStart(5) + '  ' + a); });
  }

  // toda pieza del bloque existe
  var sinPieza = (B[k] || []).filter(function (e) { return !t(e.pieza_id); });
  chk('todo evento cargado tiene pieza', sinPieza.length === 0, sinPieza.length ? '🔴 ' + sinPieza.length : 'los ' + mil((B[k] || []).length));
  console.log();
});

// los 4 códigos de septiembre: su tráfico de agosto NO puede haber entrado
console.log('══ los 4 códigos de septiembre con tráfico de agosto ══');
['piPZpvXp', 'CVCPHfND', 'TjDcVdNI', 'bgsOdlLo'].forEach(function (c) {
  var n = (B.carritos || []).concat(B.productos || []).filter(function (e) { return t(e.shortlink_code) === c; }).length;
  var l = val[c];
  chk(c + ' (activa ' + (l ? l.fecha_activacion : '?') + ')', n === 0, n === 0 ? 'sin eventos cargados ✔' : '🔴 ' + n + ' eventos entraron antes de tiempo');
});

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks en verde') + ' ════════');
process.exit(mal ? 1 : 0);
