// nestle-catalogo · ¿QUÉ SABE SFMC QUE EL CATÁLOGO NO ESCRIBIÓ? Mide, no escribe.
//
// 🔴 LO QUE PREGUNTÓ RICK, LITERAL: «hay muchos datos que son de campaña, de marca, de fecha de
//    envío y todo eso, que no estaban llenos, pero que sí los tienes, porque si no no se
//    llenarían los datos». Tiene razón en el razonamiento: si el bloque de email cuadra, es que
//    la pieza se está cruzando — y si se cruza, su fecha y su campaña están del otro lado.
//    Este paso mide exactamente eso: columna por columna, cuántas piezas tienen el dato en SFMC
//    y lo tienen VACÍO en el catálogo.
//
// 🔴 Y LA OTRA MITAD: qué piezas trae SFMC que el catálogo todavía no da de alta. Se cruza por
//    `Email_Name`, que es la llave natural probada — nunca por el ID final, que se repite.
//
// No escribe una sola celda. Deja su medición en `_preescritura/` para decidir sobre ella.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(POR DEFINIR|PENDIENTE|N\/A|#N\/A|-)$/i;
var vacio = function (v) { var s = t(v); return s === '' || TOKEN.test(s); };
var ES_PIEZA = /^\d{3}-[JP]\d{3}$/;

// ── el volcado vigente de SFMC ──────────────────────────────────────────────────────
var ins = L.insumoVigente ? L.insumoVigente('sfmc-piezas') : null;
var rutaIns = ins && ins.ruta ? ins.ruta : null;
if (!rutaIns) {
  var cands = fs.readdirSync(BACK + '/_insumos').filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
  rutaIns = BACK + '/_insumos/' + cands[cands.length - 1];
}
var S = JSON.parse(fs.readFileSync(rutaIns, 'utf8'));
var filasS = S.rows || S.data || [];

console.log('════════ nestle-catalogo · EL CATÁLOGO CONTRA SFMC (solo mide) ════════\n');
console.log('  volcado: ' + path.basename(rutaIns) + '   ·   ' + filasS.length + ' piezas · ' + (S.fields || []).length + ' campos');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_medir_sfmc.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nmPieza = COL.de(P, 'Pieza' + '_' + 'ID');
var piezas = P.filter(function (p) { return ES_PIEZA.test(t(p[nmPieza])); });
console.log('  libro:   ' + path.basename(vivo.ruta) + '   ·   ' + piezas.length + ' piezas con id válido\n');

// ── el cruce por Email_Name ─────────────────────────────────────────────────────────
// 🔴 UNA PIEZA PUEDE CARGAR VARIOS NOMBRES FÍSICOS separados por «·»: el id lógico es
//    inmutable y el nombre físico no. Se parte igual que en el cruce del bloque de email.
var nmEmail = COL.de(P, 'Email_Name');
var nmVar = null; try { nmVar = COL.de(P, 'Email_Names_Variantes'); } catch (e) { nmVar = null; }
var deNombre = {};
piezas.forEach(function (p) {
  var nombres = [];
  [t(p[nmEmail])].concat(nmVar ? [t(p[nmVar])] : []).forEach(function (blob) {
    blob.split('·').forEach(function (n) { if (t(n) && !TOKEN.test(t(n))) nombres.push(t(n)); });
  });
  nombres.forEach(function (n) { deNombre[n.toLowerCase()] = p; });
});

// el nombre de la pieza dentro del volcado: se busca el campo que trae los nombres largos
var CAND_NOMBRE = ['EmailName', 'Email_Name', 'Email_Content_Name', 'ContentName', 'Nombre_Email'];
var campos = (S.fields || []).slice();
if (!campos.length && filasS.length) campos = Object.keys(filasS[0]);
var campoNombre = null;
CAND_NOMBRE.forEach(function (c) {
  if (campoNombre) return;
  if (campos.indexOf(c) < 0) return;
  var conValor = filasS.filter(function (f) { return t(f[c]) !== ''; }).length;
  if (conValor > filasS.length * 0.5) campoNombre = c;
});
if (!campoNombre) { console.log('  🔴 ningún campo del volcado trae el nombre de la pieza en más de la mitad de las filas.'); process.exit(1); }
console.log('  el nombre de la pieza en SFMC viene en el campo `' + campoNombre + '`\n');

var enSFMC = {}, sinCatalogo = [];
filasS.forEach(function (f) {
  var n = t(f[campoNombre]); if (!n) return;
  enSFMC[n.toLowerCase()] = f;
  var p = deNombre[n.toLowerCase()];
  if (!p) sinCatalogo.push({ nombre: n, fila: f });
});
var sinSFMC = piezas.filter(function (p) {
  var nombres = t(p[nmEmail]).split('·').map(t).filter(Boolean);
  if (nmVar) t(p[nmVar]).split('·').map(t).filter(Boolean).forEach(function (x) { nombres.push(x); });
  if (!nombres.length) return false;
  return !nombres.some(function (n) { return enSFMC[n.toLowerCase()]; });
});

console.log('  ── 1 · LAS PIEZAS');
console.log('     SFMC → catálogo:  ' + (filasS.length - sinCatalogo.length) + ' de ' + filasS.length + ' cruzan   ·   🔴 ' + sinCatalogo.length + ' sin dar de alta');
sinCatalogo.forEach(function (s) {
  var f = s.fila;
  var pistas = ['Campaign', 'Campana', 'Campaña', 'Marca', 'Brand', 'Segment', 'Segmento', 'TouchPoint', 'Touchpoint', 'SendDate', 'Send_Date', 'Email_Sends', 'Sends']
    .filter(function (c) { return campos.indexOf(c) >= 0 && t(f[c]) !== ''; })
    .map(function (c) { return c + '=' + t(f[c]).slice(0, 28); });
  console.log('        🆕 ' + s.nombre.slice(0, 96));
  console.log('           ' + (pistas.join('  ·  ') || '(sin dimensiones en la DE)'));
});
console.log('     catálogo → SFMC:  ' + (piezas.length - sinSFMC.length) + ' de ' + piezas.length + ' cruzan   ·   ' + sinSFMC.length + ' sin envío en la DE');
if (sinSFMC.length && sinSFMC.length <= 14) sinSFMC.forEach(function (p) {
  console.log('        ·  ' + t(p[nmPieza]) + '   ' + t(p[nmEmail]).slice(0, 78));
});

// ── 2 · QUÉ COLUMNA DEL CATÁLOGO ESTÁ VACÍA TENIENDO EL DATO EN SFMC ────────────────
// El mapeo es por SIGNIFICADO, no por nombre: la DE y la hoja no se llaman igual.
var MAPEO = [
  { hoja: 'Campaña', de: ['Campaign', 'Campana', 'Campaña', 'CampaignName'] },
  { hoja: 'Marca', de: ['Marca', 'Brand', 'BrandName'] },
  { hoja: 'BU', de: ['BU', 'BusinessUnit', 'Unidad'] },
  { hoja: 'Segmento', de: ['Segment', 'Segmento', 'Audience', 'Audiencia'] },
  { hoja: 'TouchPoint', de: ['TouchPoint', 'Touchpoint', 'TP'] },
  { hoja: 'Fecha_Envio', de: ['SendDate', 'Send_Date', 'FechaEnvio', 'Fecha_Envio', 'FirstSendDate'] },
  { hoja: 'Quincena', de: ['Quincena', 'Fortnight', 'Periodo'] },
  { hoja: 'Subject', de: ['Subject', 'Asunto', 'EmailSubject'] },
  { hoja: 'Content_ID', de: ['ContentID', 'Content_ID', 'ConfigKey', 'CustomerKey'] },
  { hoja: 'Email_ID', de: ['EmailID', 'Email_ID', 'AssetID', 'Asset_ID'] },
  { hoja: 'Email_Type', de: ['EmailType', 'Email_Type', 'Tipo'] },
  { hoja: 'Canal', de: ['Canal', 'Channel'] }
];
console.log('\n  ── 2 · COLUMNAS DEL CATÁLOGO VACÍAS TENIENDO EL DATO EN SFMC');
var recuperables = [], sinFuente = [];
MAPEO.forEach(function (m) {
  var nmH = null; try { nmH = COL.de(P, m.hoja); } catch (e) { nmH = null; }
  if (!nmH) { return; }   // la columna no existe en la hoja: no es un hueco, es otra hoja
  var campoDE = m.de.filter(function (c) { return campos.indexOf(c) >= 0; })
    .filter(function (c) { return filasS.some(function (f) { return t(f[c]) !== ''; }); })[0];
  var huecos = piezas.filter(function (p) { return vacio(p[nmH]); });
  if (!huecos.length) return;
  if (!campoDE) { sinFuente.push({ col: m.hoja, huecos: huecos.length }); return; }
  var conDato = huecos.filter(function (p) {
    var nombres = t(p[nmEmail]).split('·').map(t).filter(Boolean);
    var f = null; nombres.forEach(function (n) { if (!f) f = enSFMC[n.toLowerCase()]; });
    return f && t(f[campoDE]) !== '';
  });
  if (conDato.length) recuperables.push({ col: m.hoja, campoDE: campoDE, huecos: huecos.length, recuperables: conDato.length, ejemplos: conDato.slice(0, 3).map(function (p) { return t(p[nmPieza]); }) });
  else sinFuente.push({ col: m.hoja, huecos: huecos.length, nota: 'la DE trae `' + campoDE + '` pero está vacío en esas piezas' });
});
if (recuperables.length) {
  recuperables.forEach(function (x) {
    console.log('     🔧 ' + x.col.padEnd(16) + String(x.recuperables).padStart(4) + ' de ' + String(x.huecos).padStart(4) +
      ' hueco(s) SE PUEDEN LLENAR desde `' + x.campoDE + '`   p.ej. ' + x.ejemplos.join(' '));
  });
} else console.log('     ✔ ninguna: donde el catálogo está vacío, SFMC tampoco trae el dato');
sinFuente.forEach(function (x) {
  console.log('     ·  ' + x.col.padEnd(16) + String(x.huecos).padStart(4) + ' hueco(s) — ' + (x.nota || 'SFMC no trae ese campo'));
});

// ── qué campos trae la DE, para no adivinar ────────────────────────────────────────
console.log('\n  ── 3 · LO QUE LA DE SÍ TRAE (campo · cuántas de las ' + filasS.length + ' filas lo tienen)');
var llenos = campos.map(function (c) {
  return { c: c, n: filasS.filter(function (f) { return t(f[c]) !== ''; }).length };
}).sort(function (a, b) { return b.n - a.n; });
var linea = '';
llenos.forEach(function (x) {
  var s = x.c + '(' + x.n + ')';
  if ((linea + '  ' + s).length > 108) { console.log('     ' + linea); linea = s; }
  else linea = linea ? linea + '  ' + s : s;
});
if (linea) console.log('     ' + linea);

fs.writeFileSync(BACK + '/_preescritura/catalogo-vs-sfmc.json', JSON.stringify({
  cuando: new Date().toISOString(), volcado: path.basename(rutaIns), campoNombre: campoNombre,
  sinCatalogo: sinCatalogo.map(function (s) { return s.nombre; }), sinSFMC: sinSFMC.map(function (p) { return t(p[nmPieza]); }),
  recuperables: recuperables, sinFuente: sinFuente
}, null, 1));
console.log('\n  → _preescritura/catalogo-vs-sfmc.json');
fs.unlinkSync(TMP);
