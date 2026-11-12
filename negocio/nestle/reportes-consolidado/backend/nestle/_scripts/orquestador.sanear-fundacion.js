var ENT = require(__dirname + '/lib-entorno.js');
/*
 * orquestador.sanear-fundacion.js — quita de los 12 SKILL.md las dos citas muertas del bloque
 * FUNDACION.
 *
 * 🔴 UN BLOQUE QUE DICE GENERARSE, CUYO GENERADOR YA NO EXISTE. Los 12 skills abren su bloque de
 *    fundación con «Generado desde `E0-7-fundacion-a-skills.js`. No se edita a mano» — y ese script
 *    NO está en el backend: 0 archivos con ese nombre, 0 scripts que lo mencionen. O sea que el
 *    bloque lleva meses mantenido a mano mientras le dice a quien lo lea que no lo toque. Quien
 *    llegue nuevo intentará regenerarlo y no encontrará con qué.
 *
 * 🔴 Y CITA UN PLAN QUE TAMPOCO EXISTE. La última línea dice «el plan: `_orquesta/plan-skills-v2.md`»
 *    y ese archivo no está en `_orquesta` ni en `_archivo`. Doce documentos mandando a un sitio
 *    vacío. Es el mismo defecto que ya costó aquí un contrato fantasma: **citar algo muerto es peor
 *    que no citarlo**, porque parece que existe y nadie lo busca dos veces.
 *
 * 🔴 NO SE INVENTA UN SUSTITUTO. El plan se retiró; lo que SÍ existe y cumple ese papel son los dos
 *    documentos de estado, y a esos se apunta. El `esquema.json` de la misma línea sí existe y se
 *    queda tal cual.
 *
 *   node orquestador.sanear-fundacion.js            (seco)
 *   node orquestador.sanear-fundacion.js --escribir
 */
var fs = require('fs'), os = require('os'), path = require('path');
var SKILLS = require(__dirname + '/lib-entorno.js').SKILLS;
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

console.log('════ SANEAR EL BLOQUE FUNDACION ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════\n');

// 🔴 se comprueba que de verdad falten ANTES de tocar nada: si el generador o el plan reaparecen,
//    este script no tiene nada que hacer y debe decirlo, no «arreglar» algo que está bien.
var genExiste = fs.existsSync(BACK + '/_scripts/E0-7-fundacion-a-skills.js');
var planExiste = fs.existsSync(PROY + '/_orquesta/plan-skills-v2.md');
console.log('  E0-7-fundacion-a-skills.js : ' + (genExiste ? '✔ existe — NO lo toco' : '🔴 no existe'));
console.log('  _orquesta/plan-skills-v2.md: ' + (planExiste ? '✔ existe — NO lo toco' : '🔴 no existe'));
if (genExiste && planExiste) { console.log('\n  ✅ las dos citas son válidas: nada que sanear.'); process.exit(0); }

var VIEJO_GEN = '> **Generado desde `E0-7-fundacion-a-skills.js`. No se edita a mano.**';
var NUEVO_GEN = '> **Se mantiene a mano.** Su generador (`E0-7-fundacion-a-skills.js`) se retiró; mientras\n> no vuelva, este bloque es el único de los dos que NO se regenera solo — el de arriba sí.';
var VIEJO_PLAN = '📄 El modelo completo: `_contratos/esquema.json` · el plan: `_orquesta/plan-skills-v2.md`';
var NUEVO_PLAN = '📄 El modelo completo: `_contratos/esquema.json` · el estado del sistema:\n`_orquesta/HANDOFF-ESTADO-SISTEMA.md` (empezar por su §2bis) y `_orquesta/estado-reportes.md`';

var tocados = 0, sinBloque = [];
fs.readdirSync(SKILLS).filter(function (d) { return /^crm-reporte-/.test(d); }).forEach(function (d) {
  var p = path.join(SKILLS, d, 'SKILL.md');
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8'), antes = t;
  if (!genExiste && t.indexOf(VIEJO_GEN) >= 0) t = t.split(VIEJO_GEN).join(NUEVO_GEN);
  if (!planExiste && t.indexOf(VIEJO_PLAN) >= 0) t = t.split(VIEJO_PLAN).join(NUEVO_PLAN);
  if (t === antes) { sinBloque.push(d.replace(ENT.PREFIJO_SKILL, '')); return; }
  console.log('  ' + (ESCRIBIR ? '✔' : '·') + ' ' + d.replace(ENT.PREFIJO_SKILL, ''));
  if (ESCRIBIR) fs.writeFileSync(p, t);
  tocados++;
});
if (sinBloque.length) console.log('\n  ⚠ sin esas citas (nada que cambiar): ' + sinBloque.join(' · '));
if (!ESCRIBIR) { console.log('\n  ' + tocados + ' skill(s) cambiarían.  (seco. Para escribir: --escribir)'); process.exit(0); }

// releer y comprobar que no quede ninguna cita muerta
var quedan = [];
fs.readdirSync(SKILLS).filter(function (d) { return /^crm-reporte-/.test(d); }).forEach(function (d) {
  var p = path.join(SKILLS, d, 'SKILL.md');
  if (!fs.existsSync(p)) return;
  var t = fs.readFileSync(p, 'utf8');
  if (!planExiste && /plan-skills-v2/.test(t)) quedan.push(d + ' → plan-skills-v2');
  if (!genExiste && /Generado desde `E0-7/.test(t)) quedan.push(d + ' → E0-7');
});
console.log('\n  ── releído: ' + (quedan.length ? '🔴 quedan ' + quedan.length + ' cita(s): ' + quedan.slice(0, 4).join(' · ') : '✔ ninguna cita muerta en los 12'));
console.log('\n════ ' + (quedan.length ? '🔴 NO quedó' : '✅ ' + tocados + ' SKILL.md SANEADOS') + ' ════');
process.exit(quedan.length ? 1 : 0);
