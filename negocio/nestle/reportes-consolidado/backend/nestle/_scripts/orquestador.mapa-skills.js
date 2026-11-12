// REGENERA el mapa HTML de la cadena desde `cadena-skills.json` — para que no pueda divergir.
//
// 🔴 POR QUÉ GENERADO Y NO ESCRITO A MANO. El ataque A6 de `orquestador.refutar-cadena.js` existe
//    para detectar que el mapa y la cadena se hayan separado, y el 25-ago prosperó: agregué las
//    etapas vacios-medir, vacios-llenar y la cadena pasó a 17, mientras el HTML seguía enseñando 15. El mapa no mentía
//    por descuido — mentía porque era una COPIA, y una copia se desfasa en cuanto la fuente cambia.
//    Es el mismo defecto que la fase 3 midió en el código: una decisión escrita dos veces.
//    Ahora la rejilla de carriles y la espina de etapas se emiten desde el contrato, entre marcas,
//    y lo escrito a mano —el texto, los pendientes, el diseño— se conserva intacto.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var HTML = ENT.fuente('orquesta') + '/mapa-cadena-skills.html';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

var N = C.etapas.length;
var porSkill = {};
C.etapas.forEach(function (e) {
  var s = e.skill.replace(ENT.PREFIJO_SKILL, '');
  (porSkill[s] = porSkill[s] || []).push(e);
});
// el orden de los carriles es el de su PRIMERA aparición: así se lee de arriba abajo como se ejecuta
var orden = Object.keys(porSkill).sort(function (a, b) { return porSkill[a][0].orden - porSkill[b][0].orden; });

// ── la rejilla de carriles
var g = ['<table class="lanes">', '<thead><tr><th class="skillcol">Skill</th>'];
for (var i = 1; i <= N; i++) g.push('<th>' + i + '</th>');
g.push('</tr></thead><tbody>');
g.push('<tr class="dirige"><th>orquestador · dirige</th><td class="cell" colspan="' + N + '" style="position:relative">' +
  '<div class="mark dirige" style="inset:6px 5px">dirige la cadena · preflight de guardas · sus etapas van abajo</div></td></tr>');
orden.forEach(function (s) {
  var enEtapa = {};
  porSkill[s].forEach(function (e) { enEtapa[e.orden] = e.scripts.map(function (n) { return n.id; }); });
  g.push('<tr><th>' + esc(s) + '</th>');
  for (var k = 1; k <= N; k++) {
    if (!enEtapa[k]) { g.push('<td class="cell"><div class="rail"></div></td>'); continue; }
    var ids = enEtapa[k];
    var puerta = ids.some(function (x) { return /^PUERTA-1$|^PUERTA-2$/.test(x); });
    var texto = ids.length > 2 ? ids.slice(0, 2).join('·') + '…' : ids.join('·');
    g.push('<td class="cell"><div class="rail"></div><div class="mark' + (puerta ? ' gate' : '') + '">' + esc(texto) + '</div></td>');
  }
  g.push('</tr>');
});
g.push('</tbody></table>');

// ── la espina
var sp = ['<div class="espina">'];
C.etapas.forEach(function (e) {
  var s = e.skill.replace(ENT.PREFIJO_SKILL, '');
  var apar = porSkill[s].map(function (x) { return x.orden; });
  var cual = apar.indexOf(e.orden);
  var sub = apar.length > 1 ? ['primera', 'segunda', 'tercera', 'cuarta'][cual] + ' aparición' : e.skill;
  var puerta = e.scripts.some(function (n) { return /^PUERTA-1$|^PUERTA-2$/.test(n.id); });
  sp.push('<div class="etapa' + (puerta ? ' puerta' : '') + '"><div class="num">' + String(e.orden).padStart(2, '0') + '</div>' +
    '<div class="sk">' + esc(s) + '<small>' + esc(sub) + '</small></div><div class="scripts">');
  e.scripts.forEach(function (n) {
    var tags = '';
    if (n.escribe) tags += '<span class="tag w">escribe</span>';
    var ns = (n.suites || []).length;
    if (ns) tags += '<span class="tag s">' + (ns > 1 ? ns + ' suites' : 'suite') + '</span>';
    var nom = /^PUERTA-1$|^PUERTA-2$/.test(n.id) ? '<strong>' + esc(n.nombre) + '</strong>' : esc(n.nombre);
    sp.push('<div class="paso"><span class="nid">' + esc(n.id) + '</span>' + nom + tags + '</div>');
  });
  sp.push('</div></div>');
});
sp.push('</div>');

console.log('════════ MAPA DE LA CADENA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  la cadena declara ' + N + ' etapas · ' + orden.length + ' skills con turno · ' +
  C.etapas.reduce(function (a, e) { return a + e.scripts.length; }, 0) + 'scripts');

var html = fs.readFileSync(HTML, 'utf8');
function entre(marca, nuevo) {
  var ini = '<!--@' + marca + '-->', fin = '<!--/@' + marca + '-->';
  var a = html.indexOf(ini), b = html.indexOf(fin);
  if (a < 0 || b < 0) return false;
  html = html.slice(0, a + ini.length) + '\n' + nuevo + '\n' + html.slice(b);
  return true;
}
var okG = entre('LANES', g.join('\n'));
var okE = entre('ESPINA', sp.join('\n'));
console.log('  ' + (okG ? '✔' : '🔴') + ' rejilla de carriles   ·   ' + (okE ? '✔' : '🔴') + ' espina de etapas');
if (!okG || !okE) { console.log('\n  🔴 faltan las marcas <!--@LANES--> / <!--@ESPINA--> en el HTML'); process.exit(1); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
fs.writeFileSync(HTML, html);
console.log('\n  → ' + require('path').basename(HTML) + '   ' + html.length.toLocaleString('es-MX') + ' bytes');
