// manual-bloque · REFUTADOR — ataca lo que la simulación NO probó.
//
// La simulación ya verificó las 4 reglas con casos adversos. Repetirlo aquí no añadiría nada.
// Este ataca por otro lado:
//   A · ¿se le puede colar un CSV mal formado?
//   B · ¿la cobertura de los otros bloques está bien calculada, o bloquea/deja pasar de más?
//   C · ¿un dato manual puede contradecir al catálogo sin que se note?
//   D · ¿la procedencia sirve de algo, o es un campo que se llena con cualquier cosa?
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var M = require(__dirname + '/lib-manual.js');
var G = require(__dirname + '/lib-manual-reglas.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = M.t;
var acu = [], hall = [], fallo = 0;
function R_(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }
function HALL(n, hay, det) { hall.push([n, hay, det]); }

console.log('════════ manual-bloque · REFUTADOR ════════\n');
var CSV = PROY + '/_manual/_ref.csv';
var BLOQUE = BACK + '/_fuentes/manual.json';
var respaldo = fs.readFileSync(BLOQUE, 'utf8');
function limpiar() { try { fs.unlinkSync(CSV); } catch (e) { } fs.writeFileSync(BLOQUE, respaldo, 'utf8'); }
process.on('exit', limpiar);

function correr(contenido) {
  fs.writeFileSync(CSV, contenido, 'utf8');
  try { cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/fuentes-manual.manual.js"', { encoding: 'utf8' }); }
  catch (e) { return { error: String(e.message).slice(0, 80) }; }
  return JSON.parse(fs.readFileSync(BLOQUE, 'utf8'));
}
var CAB = 'pieza_id,fecha,metrica,valor,quien,por_que\n';

// ══ A · CSV MAL FORMADO ═════════════════════════════════════════════════════════════
console.log('══ A · ¿se le cuela un CSV mal formado? ══');
var conBom = correr(String.fromCharCode(0xFEFF) + CAB + '005-P002,2026-09-06,sends,100,Rick,con BOM\n');
R_('A1 · un BOM al inicio rompe la lectura', !conBom.datos || conBom.datos.length !== 1,
  conBom.datos ? conBom.datos.length + ' dato leído pese al BOM' : 'no leyó');
limpiar();

var conPuntoYComa = correr(CAB.replace(/,/g, ';') + '005-P002;2026-09-06;sends;100;Rick;separador distinto\n');
R_('A2 · un separador distinto rompe la lectura', !conPuntoYComa.datos || conPuntoYComa.datos.length !== 1,
  conPuntoYComa.datos ? conPuntoYComa.datos.length + ' dato · el separador se detecta por archivo' : 'no leyó');
limpiar();

var conComas = correr(CAB + '005-P002,2026-09-06,sends,100,Rick,"Liga MX, partido 2, sin Datorama"\n');
var okComas = conComas.datos && conComas.datos.length === 1 && /partido 2/.test(conComas.datos[0].por_que);
R_('A3 · una coma dentro del «por_que» corre las columnas', !okComas,
  okComas ? 'el motivo llegó entero: «' + conComas.datos[0].por_que.slice(0, 40) + '»' : '🔴 se partió');
limpiar();

var vacio = correr(CAB);
R_('A4 · un CSV sin filas revienta el script', !vacio.datos, vacio.datos ? '0 datos, sin error' : 'reventó');
limpiar();

// ══ B · LA COBERTURA ════════════════════════════════════════════════════════════════
console.log('\n══ B · ¿la cobertura bloquea de más o de menos? ══');
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2dr.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var cnPieza = {};
P.forEach(function (p) {
  [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean)
    .forEach(function (c) { cnPieza[c] = t(p['Pieza_ID']); });
});
function cargar(n) { try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); } catch (e) { return null; } }
var bloques = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp') };
var cob = G.cobertura(bloques, cnPieza);
var nCob = Object.keys(cob).length;
console.log('  pares pieza¦métrica cubiertos por una fuente automática: ' + nCob);

// las 4 piezas de Liga MX NO deben estar cubiertas (sends=0, no se han enviado)
var ligaCubierta = ['005-P001', '005-P002', '005-P003', '005-P004'].filter(function (id) {
  return Object.keys(cob).some(function (k) { return k.indexOf(id + '¦') === 0; });
});
R_('B1 · bloquea Liga MX, que es justo lo que hay que declarar a mano', ligaCubierta.length > 0,
  ligaCubierta.length ? '🔴 ' + ligaCubierta.join(' ') + ' aparecen cubiertas' : 'las 4 libres: el manual puede declararlas');

// y sí debe bloquear una pieza que el email sí trae
var conEmail = Object.keys(cob).filter(function (k) { return /email/.test(cob[k]); }).length;
R_('B2 · no detecta lo que el email SÍ trae', conEmail === 0, conEmail + ' pares cubiertos por email');

// 🔴 los clicks de WhatsApp DERIVADOS no deben contar como cobertura
var waDeriv = (bloques.whatsapp.envios || []).filter(function (e) { return e.clicks_medidos === 'No' && e.pieza_id; });
var bloqueados = waDeriv.filter(function (e) { return cob[e.pieza_id + '¦clicks']; });
R_('B3 · un click DERIVADO cuenta como cobertura y bloquea un dato real', bloqueados.length > 0,
  bloqueados.length ? '🔴 ' + bloqueados.length + ' bloqueados por un supuesto' :
    waDeriv.length + ' envíos con clicks derivados NO bloquean: un dato manual real sí los mejora');

// ══ C · ¿CONTRADICE AL CATÁLOGO? ════════════════════════════════════════════════════
console.log('\n══ C · ¿un dato manual puede contradecir al catálogo? ══');
var b = correr(CAB + '005-P001,2026-08-22,sends,999,Rick,prueba de dimensiones\n');
var d0 = b.datos && b.datos[0];
var pieza = P.filter(function (p) { return t(p['Pieza_ID']) === '005-P001'; })[0];
R_('C1 · el dato trae dimensiones distintas a las de su pieza',
  !d0 || d0.campana !== t(pieza['Campaña']) || d0.canal !== t(pieza['Canal']),
  d0 ? 'hereda de la pieza: ' + d0.campana + ' · ' + d0.canal + ' (no se declaran a mano)' : 'no cargó');
R_('C2 · el CSV permite declarar campaña o canal a mano',
  /campana|canal|marca/i.test(fs.readFileSync(PROY + '/_manual/PLANTILLA-datos-manuales.csv', 'utf8').split('\n')[0]),
  'la plantilla solo pide pieza_id: las dimensiones salen del catálogo');
limpiar();

// ══ D · LA PROCEDENCIA ══════════════════════════════════════════════════════════════
console.log('\n══ D · ¿la procedencia sirve de algo? ══');
var b2 = correr(CAB + '005-P002,2026-09-06,sends,100,Rick,Liga MX P2 sin Datorama\n');
var dd = b2.datos && b2.datos[0];
R_('D1 · el dato cargado pierde su autor o su motivo', !dd || !dd.quien || !dd.por_que,
  dd ? 'quien=«' + dd.quien + '» · por_que=«' + dd.por_que.slice(0, 34) + '»' : 'no cargó');
R_('D2 · el dato no dice de qué archivo y fila salió', !dd || !dd.archivo || !dd.fila,
  dd ? dd.archivo + ' f' + dd.fila + ' — rastreable hasta la línea del CSV' : '');
limpiar();

HALL('la procedencia no se valida: «quien» acepta cualquier texto', true,
  'un «x» pasa. Se pide que exista, no que sea cierto — validarlo requeriría una lista de personas');
HALL('hoy el bloque está vacío', true, 'es el estado normal: solo se llena cuando una fuente no entrega algo');

console.log('\n════════ VEREDICTO · ¿está roto manual-bloque? ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(58) + a[2]); });
console.log('\n──────── LÍMITES CONOCIDOS ────────');
hall.forEach(function (h) { console.log('  ' + (h[1] ? '⚠ ' : '✔ ') + ' ' + h[0].padEnd(58) + h[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) rompieron el script' : '✅ ningún ataque rompió el script'));
process.exit(fallo ? 1 : 0);
