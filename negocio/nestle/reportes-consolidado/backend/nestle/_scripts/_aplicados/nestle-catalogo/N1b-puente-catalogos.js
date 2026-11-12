// N1b · EL PUENTE — qué le falta al catálogo NUEVO para ser la base de verdad.
//
// Medido: las 1,142 fórmulas vivas del workbook leen `Catalog_Campanas`. `Catalogo_Piezas` y
// `Catalogo_Referencias` los lee **cero**. El sistema nuevo (los scripts) usa el catálogo nuevo;
// el sistema vivo (el Excel) usa el viejo. Dos mundos paralelos sin puente.
//
// Este script NO escribe el Excel. Mide el hueco y **propone las altas**, sacándolas de la
// autoridad que ya existe —`Catalog_Campanas` declara raw→canónico— y NUNCA de una inferencia
// del naming. Después comprueba que con esas altas la escalera resolvería el 100%.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ N1b · PUENTE ENTRE LOS DOS CATÁLOGOS ════════\n');
var T = os.homedir() + '/_puente.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var CC = XLSX.utils.sheet_to_json(wb.Sheets['Catalog_Campanas'], { defval: '' });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var Rf = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var IX = A.indexar(Rf);

// ══ 1 · LAS ALTAS DE ALIAS, SACADAS DE LA AUTORIDAD ═════════════════════════════════
// `Catalog_Campanas` YA declara la equivalencia: Campana_SFMC_Raw → Campaña.
// Leerla no es inferir; inventarme el canónico desde el nombre sí lo sería.
console.log('══ 1 · alias que faltan, tomados de Catalog_Campanas (no inventados) ══');
var altas = [], sinAutoridad = [];
function proponer(tipo, campo, raw, canon, fila) {
  if (!t(raw)) return;
  if (A.resolver(IX, tipo, t(raw), '', '').v) return;          // ya resuelve
  if (!t(canon)) { sinAutoridad.push(tipo + ' · «' + raw + '» (la autoridad no dice su canónico)'); return; }
  if (altas.some(function (x) { return x.tipo === tipo && x.alias === t(raw); })) return;
  altas.push({ tipo: tipo, campo: campo, alias: t(raw), canonico: t(canon), autoridad: 'Catalog_Campanas fila ' + fila });
}
CC.forEach(function (x, i) {
  proponer('Campana', 'Campana_SFMC_Raw', x['Campana_SFMC_Raw'], x['Campaña'], i + 2);
  proponer('Segmento', 'Segmento_SFMC_Raw', x['Segmento_SFMC_Raw'], x['Segmento_Canonico'], i + 2);
});
var pC = altas.filter(function (a) { return a.tipo === 'Campana'; });
var pS = altas.filter(function (a) { return a.tipo === 'Segmento'; });
console.log('   campañas : ' + pC.length + ' altas');
pC.slice(0, 6).forEach(function (a) { console.log('      «' + a.alias.slice(0, 46) + '» → ' + a.canonico); });
console.log('   segmentos: ' + pS.length + ' altas');
pS.slice(0, 6).forEach(function (a) { console.log('      «' + a.alias.slice(0, 46) + '» → ' + a.canonico); });
if (sinAutoridad.length) {
  console.log('   🔴 ' + sinAutoridad.length + ' SIN autoridad — no se proponen, se preguntan:');
  sinAutoridad.slice(0, 8).forEach(function (s) { console.log('      ' + s); });
}
chk('toda alta propuesta cita su autoridad', altas.every(function (a) { return !!a.autoridad; }), altas.length + ' altas, todas con fila de origen');
chk('ninguna alta se inventó un canónico', altas.every(function (a) { return !!a.canonico; }), 'las sin autoridad se apartan: ' + sinAutoridad.length);

// ══ 2 · ¿CON ESAS ALTAS RESOLVERÍA EL 100%? ═════════════════════════════════════════
console.log('\n══ 2 · simulación: la escalera CON las altas aplicadas ══');
// ⚠ la fila se arma con la forma REAL de la hoja, leída de ella: Tipo='alias' y la dimensión
//   en su propia columna. Inventarme `Tipo='alias_campana'` hizo que la simulación no aplicara
//   ni una alta y reportara los 18 huecos intactos — un rojo mío, no del catálogo.
var RfSim = Rf.slice();
altas.forEach(function (a) {
  var fila = {};
  Object.keys(Rf[0] || {}).forEach(function (k) { fila[k] = ''; });
  fila['Tipo'] = 'alias';
  fila['Dimension'] = a.tipo;
  fila['Valor_Crudo'] = a.alias;
  fila['Valor_Canonico'] = a.canonico;
  fila['Fuente'] = a.autoridad;
  RfSim.push(fila);
});
var IX2 = A.indexar(RfSim);
var vCamp = {}, vSeg = {};
CC.forEach(function (x) { if (t(x['Campana_SFMC_Raw'])) vCamp[t(x['Campana_SFMC_Raw'])] = 1; if (t(x['Segmento_SFMC_Raw'])) vSeg[t(x['Segmento_SFMC_Raw'])] = 1; });
var noC = Object.keys(vCamp).filter(function (v) { return !A.resolver(IX2, 'Campana', v, '', '').v && !A.resolver(IX2, 'Campaña', v, '', '').v; });
var noS = Object.keys(vSeg).filter(function (v) { return !A.resolver(IX2, 'Segmento', v, '', '').v; });
console.log('   campañas sin resolver : ' + noC.length + ' de ' + Object.keys(vCamp).length + (noC.length ? '  → ' + noC.slice(0, 4).join(' · ') : '  ✔'));
console.log('   segmentos sin resolver: ' + noS.length + ' de ' + Object.keys(vSeg).length + (noS.length ? '  → ' + noS.slice(0, 4).join(' · ') : '  ✔'));
chk('las altas cierran el hueco de campañas', noC.length === 0, noC.length ? noC.length + ' quedan fuera' : '20/20');
chk('las altas cierran el hueco de segmentos', noS.length === 0, noS.length ? noS.length + ' quedan fuera' : 'todos');

// ══ 3 · LO QUE NO SE ARREGLA CON ALIAS ══════════════════════════════════════════════
console.log('\n══ 3 · lo que NINGÚN alias resuelve ══');
var colsP = Object.keys(P[0] || {}), colsCC = Object.keys(CC[0] || {});
var puente = ['Campana_SFMC_Raw', 'Segmento_SFMC_Raw'].filter(function (c) { return colsP.indexOf(c) < 0; });
console.log('   a · columnas PUENTE que le faltan a Catalogo_Piezas: ' + puente.join(' · '));
console.log('       sin ellas ninguna fórmula puede apuntarle: no tiene por dónde engancharse.');
var place = CC.filter(function (x) { return /placeholder/i.test(t(x['Estado_Dato'])) || /sin lanzamiento/i.test(t(x['Estado_Campana'])); });
var campN = {}; P.forEach(function (x) { if (t(x['Campaña'])) campN[t(x['Campaña'])] = 1; });
var futuras = {}; place.forEach(function (x) { if (t(x['Campaña']) && !campN[t(x['Campaña'])]) futuras[t(x['Campaña'])] = 1; });
console.log('   b · campañas DECLARADAS pero sin datos aún: ' + Object.keys(futuras).length);
console.log('       ' + Object.keys(futuras).join(' · '));
console.log('       el catálogo nuevo se construye DESDE los datos → solo sabe de lo que ya pasó.');
console.log('       Para catalogar ANTES de escribir tiene que poder llevar una fila sin envíos.');
chk('el catálogo nuevo puede registrar una campaña sin datos', Object.keys(futuras).length === 0,
  Object.keys(futuras).length ? '🔴 no: ' + Object.keys(futuras).length + ' declaradas viven solo en el viejo' : 'sí');

// ══ 4 · LA PROPUESTA, ESCRITA ═══════════════════════════════════════════════════════
var out = {
  paso: 'N1b · puente entre catálogos', generado_por: 'N1b-puente-catalogos.js',
  diagnostico: {
    formulas_que_leen_el_viejo: 1142,
    formulas_que_leen_el_nuevo: 0,
    scripts_que_leen_el_nuevo: 'casi todos los del backend',
    veredicto: 'el catálogo nuevo es la base CONCEPTUAL; el viejo sigue siendo la base OPERATIVA'
  },
  altas_de_alias: altas,
  sin_autoridad: sinAutoridad,
  columnas_puente_faltantes: puente,
  campanas_declaradas_sin_datos: Object.keys(futuras),
  lo_que_falta_para_alinear: [
    '1 · dar de alta ' + altas.length + ' alias en Catalogo_Referencias (todos con autoridad en Catalog_Campanas)',
    '2 · agregar a Catalogo_Piezas las columnas puente ' + puente.join(' y ') + ' para que las fórmulas puedan apuntarle',
    '3 · permitir filas sin datos (placeholder) para catalogar ANTES del primer envío',
    '4 · repuntar las 1,142 fórmulas del viejo al nuevo — es el paso que toca producción'
  ],
  no_se_hizo: 'nada de esto se escribió: los 4 pasos tocan el workbook y requieren OK de Rick'
};
try { fs.mkdirSync(BACK + '/_catalogo'); } catch (e) { }
fs.writeFileSync(BACK + '/_catalogo/puente-catalogos.json', JSON.stringify(out, null, 1));

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' hueco(s) siguen abiertos — el catálogo nuevo NO puede sustituir al viejo todavía'
  : '✅ el catálogo nuevo ya puede sustituir al viejo'));
console.log('  → ' + BACK + '/_catalogo/puente-catalogos.json');
console.log('\n  ⚠ este script NO escribió el Excel. Las altas están propuestas, no aplicadas.');
