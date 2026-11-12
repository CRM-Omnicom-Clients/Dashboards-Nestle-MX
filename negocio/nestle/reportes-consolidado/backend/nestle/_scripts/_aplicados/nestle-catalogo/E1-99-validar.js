// E1.99 · VALIDACIÓN ADVERSARIAL DE LA ETAPA 1 — el skill del catálogo.
//
// 🔴 EL CHECK QUE ESTUVE A PUNTO DE ESCRIBIR MAL, y vale la pena dejarlo escrito: iba a exigir
//    «la llave del reporte es única por pieza». **Es falso.** Una fila del reporte AGREGA piezas:
//    tres variantes de Pro Plan PAE (E4B1/B2/B3) del mismo touchpoint × segmento × quincena van a
//    una sola fila que suma 18,951, y eso es correcto.
//
//    Lo que sí es un defecto es otra cosa: **una pieza con envíos reales cuya llave está
//    INCOMPLETA**. Ahí la agregación no es una decisión, es un accidente — y fue lo que hizo que
//    las oleadas de AON de marzo y abril colapsaran en la misma fila.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var EQX = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');

var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { return Number(String(v).replace(/[, ]/g, '')) || 0; };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(56) + e); c ? ok++ : mal++; }

console.log('════════ E1.99 · EL SKILL DEL CATÁLOGO ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));

// ══ 1 · LA REGLA DURA DE PRO PLAN ══
console.log('══ 1 · 🔴 Pro Plan: las 17 piezas se mantienen ══');
var pp = P.filter(function (p) { return /^009-/.test(t(p['Pieza_ID'])); });
chk('Pro Plan sigue teniendo 17 piezas', pp.length === 17, pp.length + ' piezas');
var segsPP = {};
pp.forEach(function (p) { var s = t(p['Segmento']); if (s) segsPP[s] = (segsPP[s] || 0) + 1; });
chk('sus segmentos están desglosados, no agrupados', Object.keys(segsPP).length >= 8,
  Object.keys(segsPP).length + ' segmentos distintos');
var conMascota = pp.filter(function (p) { return /·\s*(Perros|Gatos|Mixto)/.test(t(p['Segmento'])); }).length;
chk('el desglose por mascota está cargado', conMascota >= 9, conMascota + ' piezas con · Perros/Gatos/Mixto');

// ══ 2 · LA LLAVE COMPLETA — no única: COMPLETA ══
console.log('\n══ 2 · toda pieza CON ENVÍOS tiene la llave completa ══');
var conEnvios = P.filter(function (p) { return num(p['Sends']) > 0; });
var incompletas = conEnvios.filter(function (p) {
  return !t(p['Campaña']) || !t(EQX.campo(p,'TouchPoint','Touchpoint')) || !t(p['Segmento']) || !Q.normalizar(EQX.campo(p,'Quincena','Quincena_Lanzamiento'));
});
chk('ninguna pieza con envíos tiene la llave incompleta', incompletas.length === 0,
  conEnvios.length + ' piezas con envíos' + (incompletas.length ? '   🔴 ' + incompletas.length + ' incompletas' : ''));
incompletas.slice(0, 6).forEach(function (p) {
  console.log('        🔴 ' + t(p['Pieza_ID']).padEnd(10) + ' falta: ' +
    ['Campaña', 'Touchpoint', 'Segmento', 'Quincena_Lanzamiento'].filter(function (c) { return !t(p[c]); }).join(', '));
});
// y las que NO tienen envíos, ¿por qué no tienen quincena?
var sinQ = P.filter(function (p) { return !Q.normalizar(EQX.campo(p,'Quincena','Quincena_Lanzamiento')); });
var sinQconEnvios = sinQ.filter(function (p) { return num(p['Sends']) > 0; });
chk('las que no tienen quincena es porque NO han salido', sinQconEnvios.length === 0,
  sinQ.length + ' sin quincena, todas con sends=0 (retiradas o programadas)');

// ══ 3 · LA QUINCENA, EN FORMATO CANÓNICO ══
// 🔴 LOS CHECKS AHORA CONOCEN LOS TRES ESTADOS. Al llenar el archivo con `N/A` y `PENDIENTE`, todo
//    check que preguntaba «¿tiene dato?» con un `if (valor)` empezó a leer «N/A» como un dato: este
//    mismo reportó 21 EmailID inexistentes que eran las piezas de WhatsApp, cuyo EmailID dice N/A
//    a propósito. Se lee con `E.esDato()`, que vive en la fundación.
var E = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
console.log('\n══ 3 · la quincena, con la regla y el formato únicos ══');
var qs = P.map(function (p) { return t(EQX.campo(p,'Quincena','Quincena_Lanzamiento')); }).filter(E.esDato);
var noCanon = qs.filter(function (q) { return !Q.esCanonica(q); });
chk('toda quincena del catálogo es canónica', noCanon.length === 0,
  qs.length + ' con quincena real' + (noCanon.length ? '   🔴 ' + noCanon.slice(0, 4).join(', ') : ' · formato AAAA-MM-Qn'));
// y coincide con su fecha
var contradice = P.filter(function (p) {
  if (!E.esDato(p['Fecha_Primer_Envio'])) return false;
  var q = Q.normalizar(EQX.campo(p,'Quincena','Quincena_Lanzamiento')); if (!q) return false;
  return Q.deFecha(p['Fecha_Primer_Envio']) !== q;
});
chk('la quincena coincide con la fecha de envío', contradice.length === 0,
  contradice.length ? '🔴 ' + contradice.map(function (p) { return t(p['Pieza_ID']); }).slice(0, 4).join(', ') : 'ninguna se contradice');

// ══ 4 · CONTRA LA FUENTE — el catálogo no puede inventar ni perder ══
console.log('\n══ 4 · el catálogo contra SFMC ══');
// 🔴 EL NOMBRE FÍSICO SE PIDE AL REGISTRO. Hardcodeé «EmailID» y el check midió 0 piezas: A11
//    renombró esa columna a «Email_ID (de la DE de SFMC)». Es exactamente el error que el registro
//    de nombres existe para evitar, y lo cometí en el validador del registro.
var RG = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var encCat = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var hCat = RG.abrir('catalogo', encCat, { silencioso: true });
var COL_EID = (function () { try { return hCat.n('catalogo.emailid'); } catch (e) { return 'EmailID'; } })();
var porEid = {}; D.rows.forEach(function (r) { porEid[t(r.Email_ID)] = r; });
var conEid = P.filter(function (p) { return E.esDato(p[COL_EID]); });
var descuadre = conEid.filter(function (p) {
  var s = porEid[t(p[COL_EID])]; if (!s) return false;
  return Q.deFecha(s.Fecha_Primer_Envio) && Q.normalizar(EQX.campo(p,'Quincena','Quincena_Lanzamiento')) !== Q.deFecha(s.Fecha_Primer_Envio);
});
chk('ninguna quincena contradice a SFMC', descuadre.length === 0,
  conEid.length + ' piezas con EmailID' + (descuadre.length ? '   🔴 ' + descuadre.length : ''));
var huerfanas = conEid.filter(function (p) { return !porEid[t(p[COL_EID])]; });
chk('todo EmailID del catálogo existe en SFMC', huerfanas.length === 0,
  huerfanas.length ? '🔴 ' + huerfanas.map(function (p) { return t(p['Pieza_ID']); }).join(', ') : 'los ' + conEid.length);

// ══ 5 · LOS ATAQUES ══
console.log('\n══ 5 · ataques ══');
// ataque 1 · agrupar Pro Plan a un segmento corto
// 🔴 EL CHECK CORREGIDO: no todas las piezas de Pro Plan tienen desglose por mascota. SFMC
//    entrega «Pro Plan Aspiracionales» a secas para tres de ellas (eids 83764/83765/83768) y
//    «Pro Plan Pet Parents · Perros» para otras. Marcar las primeras sería exigir un dato que la
//    fuente no da. Lo que sí es un defecto: que el catálogo tenga el corto cuando SFMC da el largo.
var porEidPP = {}; D.rows.forEach(function (r) { porEidPP[t(r.Email_ID)] = t(r.Segmento).replace(/\*+$/, '').trim(); });
var colEid = 'Email_ID (de la DE de SFMC)';
var perdieron = pp.filter(function (p) {
  var sfmc = porEidPP[t(p[colEid]) || t(p['EmailID'])];
  return sfmc && /·/.test(sfmc) && !/·/.test(t(p['Segmento']));
});
chk('ataque 1 · ningún Pro Plan perdió el desglose que SFMC da', perdieron.length === 0,
  perdieron.length ? '🔴 ' + perdieron.map(function (p) { return t(p['Pieza_ID']); }).join(', ')
    : conMascota + ' con desglose · ' + (17 - conMascota) + ' que SFMC no desglosa');
// ataque 2 · una quincena en formato viejo NO debe pasar por canónica
chk('ataque 2 · «Mar-Q1-2026» no se acepta como canónica', !Q.esCanonica('Mar-Q1-2026'), 'el formato viejo se rechaza');
// ataque 3 · el día 15 y el 16 caen donde deben
chk('ataque 3 · el borde 15/16 se respeta', Q.deFecha('2026-08-15') === '2026-08-Q1' && Q.deFecha('2026-08-16') === '2026-08-Q2', '15→Q1 · 16→Q2');
// ataque 4 · agregación legítima vs accidente
var llaves = {};
conEnvios.forEach(function (p) {
  var k = t(p['Campaña']) + '|' + t(EQX.campo(p,'TouchPoint','Touchpoint')) + '|' + t(p['Segmento']) + '|' + Q.normalizar(EQX.campo(p,'Quincena','Quincena_Lanzamiento'));
  (llaves[k] = llaves[k] || []).push(p);
});
var agregan = Object.keys(llaves).filter(function (k) { return llaves[k].length > 1; });
console.log('   ○ ' + 'agregaciones (varias piezas → una fila)'.padEnd(56) + agregan.length + ' llave(s)');
agregan.slice(0, 4).forEach(function (k) {
  console.log('        ' + llaves[k].length + ' piezas · ' + llaves[k].map(function (p) { return t(p['Pieza_ID']); }).join(' + ') +
    ' → ' + llaves[k].reduce(function (a, p) { return a + num(p['Sends']); }, 0).toLocaleString('es-MX') + ' envíos');
});
chk('toda agregación tiene la llave COMPLETA (es decisión, no accidente)',
  agregan.every(function (k) { return k.split('|').every(function (x) { return t(x) && x !== 'null'; }); }),
  'ninguna agrupa por un dato faltante');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
