// E1.4b · LLEVAR EL CONTRATO DE ESCRITURA A LOS SKILLS.
//
// 🔴 RICK, y tiene razón: «todo está relacionado con los skills; no te veo con los skills». Un
//    contrato que vive solo en un JSON del backend no dirige a nadie: **el skill es lo que yo leo
//    cuando trabajo**. Si el contrato no está ahí, no existe.
//
// 🔴 UNA AUTORIDAD, UNA VISTA. El JSON (`_contratos/escritura.json`) es la autoridad; la sección
//    «Qué escribe» de cada `SKILL.md` se GENERA de él. Así no pueden divergir: no es que estén
//    sincronizados por disciplina, es que uno sale del otro. Y un check lo comprueba en cada corte.
//
//    Es la misma regla que aplicamos a Catalogo_Referencias: un dato, una autoridad, y las vistas
//    se verifican.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var SK = os.homedir() + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// fuente del contrato → skill que la ejecuta
var DONDE = {
  email: 'rick-reportes-fuentes-email',
  qcart: 'rick-reportes-fuentes-qcart',
  whatsapp: 'rick-reportes-fuentes-whatsapp',
  manual: 'rick-reportes-fuentes-manual',
  catalogo: 'rick-reportes-nestle-catalogo'
};
var MARCA_INI = '<!-- CONTRATO-ESCRITURA:INICIO -->';
var MARCA_FIN = '<!-- CONTRATO-ESCRITURA:FIN -->';

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/escritura.json', 'utf8'));

function seccion(fuente) {
  var f = C.fuentes[fuente];
  var L = [];
  L.push(MARCA_INI);
  L.push('');
  L.push('## 🔴 QUÉ ESCRIBE — el contrato de escritura');
  L.push('');
  L.push('> **Generado desde `_contratos/escritura.json`. No se edita a mano: se edita el contrato.**');
  L.push('> Antes existía solo el contrato de LECTURA. Por eso el grano acababa decidiéndose dentro');
  L.push('> del motor, tarde y sin que nadie lo revisara.');
  L.push('');
  L.push('*' + f.que_es + '*');
  L.push('');
  Object.keys(f.escribe_en).forEach(function (hoja) {
    var d = f.escribe_en[hoja];
    L.push('### → `' + hoja + '`');
    L.push('');
    L.push('| | |');
    L.push('|---|---|');
    L.push('| **Grano** | ' + d.grano + ' |');
    L.push('| **Llave** | `' + (d.llave || '—') + '` |');
    if (d.ancla) L.push('| **Ancla** | ' + d.ancla + ' |');
    if (d.columnas) L.push('| **Columnas suyas** | ' + d.columnas.length + ': ' + d.columnas.map(function (c) { return '`' + c + '`'; }).join(' · ') + ' |');
    L.push('| **NO toca** | ' + (d.no_toca || []).join(' · ') + ' |');
    L.push('');
    if (d.regla_dura) { L.push('> 🔴 **REGLA DURA.** ' + d.regla_dura); L.push(''); }
    if (d.ojo_fup) { L.push('> ⚠ ' + d.ojo_fup); L.push(''); }
  });
  L.push('**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido');
  L.push('primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.');
  L.push('');
  L.push('Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`');
  L.push('');
  L.push(MARCA_FIN);
  return L.join('\n');
}

console.log('════════ E1.4b · EL CONTRATO, DENTRO DE LOS SKILLS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var hechos = 0, faltan = [];
Object.keys(DONDE).forEach(function (fuente) {
  var ruta = SK + '/' + DONDE[fuente] + '/SKILL.md';
  if (!fs.existsSync(ruta)) { console.log('   🔴 ' + DONDE[fuente].padEnd(34) + 'NO EXISTE'); faltan.push(DONDE[fuente]); return; }
  var md = fs.readFileSync(ruta, 'utf8');
  var sec = seccion(fuente);
  var yaTiene = md.indexOf(MARCA_INI) >= 0;
  var nuevo;
  if (yaTiene) {
    nuevo = md.slice(0, md.indexOf(MARCA_INI)) + sec + md.slice(md.indexOf(MARCA_FIN) + MARCA_FIN.length);
  } else {
    // se inserta al FINAL, para no romper la estructura que el skill ya tiene
    nuevo = md.replace(/\s*$/, '') + '\n\n---\n\n' + sec + '\n';
  }
  var hojas = Object.keys(C.fuentes[fuente].escribe_en);
  console.log('   ' + (yaTiene ? '↻' : '+') + ' ' + DONDE[fuente].padEnd(34) + hojas.length + ' hoja(s): ' + hojas.join(', '));
  if (ESCRIBIR && nuevo !== md) { fs.writeFileSync(ruta, nuevo); hechos++; }
});

if (faltan.length) { console.log('\n  🔴 faltan skills: ' + faltan.join(', ')); process.exit(1); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
console.log('\n  ✔ ' + hechos + ' skill(s) actualizados desde el contrato');
