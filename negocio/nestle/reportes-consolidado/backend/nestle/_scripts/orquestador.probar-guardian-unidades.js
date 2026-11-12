/*
 * orquestador.probar-guardian-unidades.js — ¿EL GUARDIÁN DE UNIDADES MIRA DE VERDAD?
 *
 * 🔴 Que una guarda salga verde no prueba que mire. Ya pasó: la guarda del script congelado no
 *    reconocía `execFileSync(` y salía verde con el señuelo delante. Así que a ésta se le planta
 *    CADA defecto sobre una copia y se le exige que bloquee. Un señuelo que pasa es un agujero.
 *
 * Los seis señuelos son los tres defectos reales de septiembre, más sus variantes:
 *   S1 · una métrica sin unidad declarada
 *   S2 · una métrica de conteo sin decir contra qué se compara
 *   S3 · un desglose que excede a su total EN EL DATO
 *   S4 · el desglose que deja de sumar su propio total
 *   S5 · el motor contando carritos por FILA (el defecto de Qcart, en el código)
 *   S6 · un cruce de unidades sin declarar `embudo` (el defecto de WhatsApp)
 *
 *   node orquestador.probar-guardian-unidades.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var LAB = BACK + '/_tmp/_lab-unidades';
var GUARD = BACK + '/_scripts/orquestador.guardian-unidades.js';

if (fs.existsSync(LAB)) fs.rmSync(LAB, { recursive: true, force: true });
fs.mkdirSync(LAB, { recursive: true });
fs.mkdirSync(LAB + '/_scripts', { recursive: true });

console.log('════════ ¿EL GUARDIÁN DE UNIDADES MIRA DE VERDAD? ════════\n');
console.log('  laboratorio: _tmp/_lab-unidades   (copias; nada real se toca)\n');

/* corre el guardián con los archivos que se le pasen y devuelve si BLOQUEÓ */
function corre(op) {
  var args = [GUARD];
  if (op.contrato) args.push('--contrato', op.contrato);
  if (op.reporte) args.push('--reporte', op.reporte);
  if (op.scripts) args.push('--scripts', op.scripts);
  try { cp.execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return { bloqueo: false }; }
  catch (e) { return { bloqueo: true, salida: String(e.stdout || '') }; }
}

/* el control: sin señuelo, tiene que PASAR. Si no pasa, el probador no prueba nada. */
var base = corre({});
console.log('  control · sin señuelo → ' + (base.bloqueo ? '🔴 BLOQUEA (el probador no sirve: arregla el estado real primero)' : '✔ pasa'));
if (base.bloqueo) process.exit(1);

var senuelos = [], fallos = 0;
function senuelo(id, que, prep) {
  var op;
  try { op = prep(); } catch (e) { op = null; }
  if (!op) { console.log('\n  🔴 ' + id + ' · no pude preparar el señuelo'); fallos++; return; }
  var r = corre(op);
  var ok = r.bloqueo;
  if (!ok) fallos++;
  senuelos.push({ id: id, que: que, atrapado: ok });
  console.log('\n  ' + (ok ? '✔' : '🔴') + ' ' + id + ' · ' + que);
  console.log('      ' + (ok ? 'BLOQUEÓ, como debe' : '🔴 PASÓ EN VERDE — el guardián no lo mira'));
  if (ok) {
    var linea = (r.salida || '').split('\n').filter(function (l) { return /🔴/.test(l) && /U[0-9]/.test(l); })[0];
    if (linea) console.log('      ' + linea.trim().slice(0, 108));
  }
}

var CONTRATO = JSON.parse(fs.readFileSync(BACK + '/_contratos/unidades.json', 'utf8'));
function guardaContrato(nom, obj) { var p = LAB + '/' + nom; fs.writeFileSync(p, JSON.stringify(obj, null, 1)); return p; }

/* S1 · quitarle la unidad a una métrica que el reporte publica */
senuelo('S1', 'una métrica del reporte SIN unidad declarada', function () {
  var c = JSON.parse(JSON.stringify(CONTRATO));
  delete c.metricas['Carritos_Total'];
  return { contrato: guardaContrato('s1.json', c) };
});

/* S2 · una métrica de conteo que no dice contra qué se compara */
senuelo('S2', 'una métrica de conteo sin declarar su comparación', function () {
  var c = JSON.parse(JSON.stringify(CONTRATO));
  delete c.metricas['Principal_Clicks_CTA'].se_compara_con;
  return { contrato: guardaContrato('s2.json', c) };
});

/* S3 · el defecto de los clicks, en el DATO: un desglose por encima de su total */
senuelo('S3', 'un desglose que excede a su total en el dato', function () {
  var p = LAB + '/s3.xlsx';
  fs.copyFileSync(VIVO, p);
  var wb = XLSX.readFile(p);
  var ws = wb.Sheets['Report_Resumen'];
  var rng = XLSX.utils.decode_range(ws['!ref']);
  var enc = [];
  for (var c = rng.s.c; c <= rng.e.c; c++) { var e = ws[XLSX.utils.encode_cell({ r: 0, c: c })]; enc[c] = e ? String(e.v).trim() : ''; }
  var iCTA = enc.indexOf('Principal_Clicks_CTA'), iMed = enc.indexOf('Principal_Clicks_Medidos');
  if (iCTA < 0 || iMed < 0) return null;
  for (var r = 1; r <= rng.e.r; r++) {
    var cm = ws[XLSX.utils.encode_cell({ r: r, c: iMed })];
    if (cm && typeof cm.v === 'number' && cm.v > 0) {
      ws[XLSX.utils.encode_cell({ r: r, c: iCTA })] = { t: 'n', v: cm.v + 999 };   // el señuelo
      break;
    }
  }
  XLSX.writeFile(wb, p);
  return { reporte: p };
});

/* S4 · el desglose deja de sumar su propio total */
senuelo('S4', 'el desglose que ya no suma su total', function () {
  var p = LAB + '/s4.xlsx';
  fs.copyFileSync(VIVO, p);
  var wb = XLSX.readFile(p);
  var ws = wb.Sheets['Report_Resumen'];
  var rng = XLSX.utils.decode_range(ws['!ref']);
  var enc = [];
  for (var c = rng.s.c; c <= rng.e.c; c++) { var e = ws[XLSX.utils.encode_cell({ r: 0, c: c })]; enc[c] = e ? String(e.v).trim() : ''; }
  var iMed = enc.indexOf('Principal_Clicks_Medidos');
  if (iMed < 0) return null;
  for (var r = 1; r <= rng.e.r; r++) {
    var cm = ws[XLSX.utils.encode_cell({ r: r, c: iMed })];
    if (cm && typeof cm.v === 'number' && cm.v > 0) { cm.v = cm.v + 7; break; }    // el total, inflado
  }
  XLSX.writeFile(wb, p);
  return { reporte: p };
});

/* S5 · el defecto de Qcart, en el CÓDIGO: contar carritos por fila */
senuelo('S5', 'el motor contando carritos por FILA', function () {
  var src = fs.readFileSync(BACK + '/_scripts/motor.motor.js', 'utf8');
  var malo = src.replace(/g\.qcart\.carritos \+= num\(e\.views\) \|\| 0;/, 'g.qcart.carritos++;');
  if (malo === src) return null;
  ['fuentes-cuadre.puerta2.js', 'fuentes-qcart.guardian-distribucion.js'].forEach(function (f) {
    fs.copyFileSync(BACK + '/_scripts/' + f, LAB + '/_scripts/' + f);
  });
  fs.writeFileSync(LAB + '/_scripts/motor.motor.js', malo);
  return { scripts: LAB + '/_scripts' };
});

/* S6 · el defecto de WhatsApp: cruzar unidades sin declararlo */
senuelo('S6', 'un cruce de unidades sin declarar `embudo`', function () {
  var c = JSON.parse(JSON.stringify(CONTRATO));
  delete c.metricas['WA-Clicks'].embudo;
  return { contrato: guardaContrato('s6.json', c) };
});

console.log('\n════ VEREDICTO ════');
console.log('  señuelos: ' + senuelos.length + '   ·   atrapados: ' + senuelos.filter(function (s) { return s.atrapado; }).length + '   ·   pasaron: ' + fallos);
fs.writeFileSync(BACK + '/_preescritura/probar-guardian-unidades.json', JSON.stringify({ cuando: new Date().toISOString(), senuelos: senuelos }, null, 1));
if (fallos) { console.log('\n  🔴 ' + fallos + ' señuelo(s) pasaron: el guardián NO mira eso.'); process.exit(1); }
console.log('\n  ✅ EL GUARDIÁN DE UNIDADES ATRAPA LO QUE DICE ATRAPAR — ' + senuelos.length + ' señuelos, ' + senuelos.length + ' bloqueos');
console.log('\n→ _preescritura/probar-guardian-unidades.json');
