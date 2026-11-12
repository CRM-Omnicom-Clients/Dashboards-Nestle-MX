// E0.4.99 · ¿LA PRE-ESCRITURA SIRVE? — con un caso real y sus ataques.
//
// 🔴 No se prueba con datos de juguete: se prueba armando la tabla previa REAL de WhatsApp (12
//    envíos, la fuente más pequeña) y comprobando que tiene la forma de `Data_WhatsApp`. Si la
//    librería sirve para la fuente real, sirve.
//
//    Y los ataques van al corazón de para qué existe: **atrapar el error ANTES de escribir**.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var PRE = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-preescritura.js');
var QN = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(56) + e); c ? ok++ : mal++; }

console.log('════════ E0.4.99 · LA TABLA PREVIA ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var COLS = (XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { header: 1 })[0] || []).map(t);
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));

// ══ 1 · EL CASO REAL · la tabla previa de WhatsApp
console.log('══ 1 · caso real · WhatsApp → Data_WhatsApp ══');
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var dimDe = {};
P.forEach(function (p) {
  dimDe[t(p['Pieza_ID'])] = { BU: t(p['BU']), Marca: t(p['Marca']), 'Campaña': t(p['Campaña']),
    Objetivo: t(p['Objetivo']), Touchpoint: t(p['Touchpoint']), Canal: t(p['Canal']) };
});
var filas = (B.envios || []).map(function (e) {
  var d = dimDe[t(e.pieza_id)] || {};
  var f = { pieza_id: t(e.pieza_id) };
  // solo se ponen columnas que la hoja TIENE — esa es la disciplina
  [['BU', d.BU], ['Marca', d.Marca], ['Campaña', d['Campaña']], ['Objetivo', d.Objetivo],
   ['Touchpoint', d.Touchpoint], ['Canal', d.Canal], ['Sends', e.sends], ['Deliveries', e.deliveries],
   ['Opens_Read', e.opens_read], ['Clicks', e.clicks]].forEach(function (par) {
    if (COLS.indexOf(par[0]) >= 0 && par[1] !== undefined && par[1] !== null) f[par[0]] = par[1];
  });
  return f;
});
var T = PRE.preparar({
  skill: 'whatsapp', hoja: 'Data_WhatsApp', columnas: COLS, filas: filas,
  llave: 'Pieza_ID + Touchpoint', grano: 'una fila = un envío de WhatsApp',
  no_toca: ['Email_Name', 'Subject', 'las columnas Principal_* y FUP_*: van en N/A']
});
chk('la tabla previa se arma con la fuente real', T.n_filas === (B.envios || []).length,
  T.n_filas + ' filas · llena ' + T.columnas_que_escribe.length + ' de ' + COLS.length + ' columnas');
chk('sus columnas son las de la hoja destino', T.columnas_que_escribe.every(function (c) { return COLS.indexOf(c) >= 0; }),
  T.columnas_que_escribe.slice(0, 6).join(' · ') + '…');
chk('el orden de las claves sigue al de la hoja', (function () {
  var f = T.filas[0] || {}; var pos = Object.keys(f).map(function (c) { return COLS.indexOf(c); });
  return pos.every(function (p, i) { return i === 0 || p > pos[i - 1]; });
})(), 'un escritor puede transcribir sin decidir nada');

// ══ 2 · LOS ATAQUES
console.log('\n══ 2 · ataques · tiene que atrapar el error ANTES de escribir ══');

// ataque 1 · una columna que la hoja NO tiene
var a1 = false, msg1 = '';
try {
  PRE.preparar({ skill: 'x', hoja: 'Data_WhatsApp', columnas: COLS, llave: 'k', grano: 'g',
    filas: [{ pieza_id: '004-P010', Columna_Inventada: 1 }] });
} catch (e) { a1 = /columnas que la hoja no tiene/i.test(e.message); msg1 = e.message.split('\n')[0].slice(0, 60); }
chk('ataque 1 · columna inventada → truena', a1, a1 ? 'la caza antes de escribir' : '🔴 la dejó pasar');

// ataque 2 · sin llave declarada
var a2 = false;
try { PRE.preparar({ skill: 'x', hoja: 'Data_WhatsApp', columnas: COLS, filas: [], grano: 'g' }); }
catch (e) { a2 = /falta «llave»/.test(e.message); }
chk('ataque 2 · sin llave → truena', a2, 'sin llave no se puede actualizar sin duplicar');

// ataque 3 · sin grano declarado
var a3 = false;
try { PRE.preparar({ skill: 'x', hoja: 'Data_WhatsApp', columnas: COLS, filas: [], llave: 'k' }); }
catch (e) { a3 = /falta «grano»/.test(e.message); }
chk('ataque 3 · sin grano → truena', a3, 'el grano es lo que F1 dejó decidir al motor');

// ══ 3 · GUARDA y VERIFICA contra el contrato
console.log('\n══ 3 · guardar y contrastar contra el contrato ══');
var r = PRE.guardar('whatsapp', [T], 'Tabla previa de prueba, generada por E0.4.99 con la fuente real.');
chk('escribe el JSON y el MD', fs.existsSync(r.json) && fs.existsSync(r.md),
  r.md.replace(os.homedir(), '~'));
var v = PRE.verificar('whatsapp');
chk('se puede contrastar contra el contrato de escritura', v.existe && v.fallas.length === 0,
  v.fallas.length ? '🔴 ' + v.fallas.join(' · ') : (v.avisos.length ? v.avisos.length + ' aviso(s)' : 'sin fallas'));
(v.avisos || []).forEach(function (a) { console.log('        ⚠ ' + a); });

// ══ 4 · ataque 4 · escribir una columna que el contrato NO le asigna
console.log('\n══ 4 · ataque 4 · invadir una columna ajena ══');
var COLSR = (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || []).map(t);
var Tinvasor = PRE.preparar({
  skill: 'whatsapp', hoja: 'Report_Resumen', columnas: COLSR, llave: 'k', grano: 'g',
  filas: [{ 'WA-Envíos': 100, 'Principal_Sends': 999 }]   // Principal_Sends es de EMAIL
});
PRE.guardar('whatsapp', [Tinvasor], 'prueba de invasión');
var v2 = PRE.verificar('whatsapp');
chk('ataque 4 · invadir una columna de email → FALLA', v2.fallas.length > 0,
  v2.fallas.length ? v2.fallas[0].slice(0, 62) : '🔴 lo dejó pasar');

// se restaura la tabla buena
PRE.guardar('whatsapp', [T], 'Tabla previa de WhatsApp, generada con la fuente real.');
console.log('\n   (restaurada la tabla buena de whatsapp)');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
