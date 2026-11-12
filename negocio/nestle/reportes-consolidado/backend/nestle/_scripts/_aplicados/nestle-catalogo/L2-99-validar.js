// L2-99 · valida la librería del registro CONTRA EL ARCHIVO REAL, en las dos direcciones.
//
// 🔴 UN REGISTRO SE PUEDE ROMPER DE DOS MANERAS Y HAY QUE MEDIR LAS DOS:
//    · un id que no resuelve a ninguna columna  → el skill que lo pida se queda ciego
//    · una columna que ningún id reclama        → el registro promete gobernar algo que no ve
//    Medir solo la primera deja pasar la segunda, que es cómo un registro envejece sin avisar.
//
// 🔴 Y SE PRUEBA QUE **TRUENA**. Un resolvedor que no puede fallar no protege de nada: se le pide
//    un id inexistente, uno ambiguo y uno que el archivo ya no trae, y se comprueba que los tres
//    revientan con un mensaje que dice qué pasó.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';

var ok = 0, mal = 0;
function chk(nom, cond, ev) {
  console.log('   ' + (cond ? '✔' : '🔴') + ' ' + nom.padEnd(52) + ev);
  cond ? ok++ : mal++;
}

console.log('════════ L2-99 · LA LIBRERÍA CONTRA EL ARCHIVO REAL ════════\n');
var reg = R.cargar();
var C = os.homedir() + '/_l2.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);

console.log('══ 1 · las dos direcciones, hoja por hoja ══');
Object.keys(reg.ambitos).forEach(function (am) {
  var a = reg.ambitos[am];
  if (a.tipo !== 'hoja') return;
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[a.nombre_fisico], { header: 1 })[0] || [];
  var h = R.abrir(am, enc);
  var ids = Object.keys(reg.columnas).filter(function (k) { return reg.columnas[k].ambito === am; });
  chk(a.nombre_fisico + ' · todo id resuelve', h.sin_resolver.length === 0 && h.ambiguos.length === 0,
    h.resueltos + '/' + ids.length + (h.sin_resolver.length ? '  sin resolver: ' + h.sin_resolver.map(function (c) { return c.id; }).join(', ') : '') +
    (h.ambiguos.length ? '  ambiguos: ' + h.ambiguos.map(function (c) { return c.id; }).join(', ') : ''));
  chk(a.nombre_fisico + ' · toda columna tiene id', h.sin_id.length === 0,
    (enc.filter(Boolean).length - h.sin_id.length) + '/' + enc.filter(Boolean).length +
    (h.sin_id.length ? '  sin id: ' + h.sin_id.map(function (o) { return o.nombre; }).join(', ') : ''));
});

console.log('\n══ 2 · resolver de verdad, no solo contar ══');
var encRes = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0];
var hr = R.abrir('resumen', encRes);
// 🔴 los dos ids que causaron los defectos históricos, resueltos por el registro
chk('`resumen.content_id_sfmc` → su nombre real', hr.n('resumen.content_id_sfmc') === 'Content_ID (SFMC)', '«' + hr.n('resumen.content_id_sfmc') + '»  ← el que N6 leía mal');
chk('`resumen.email_id_sfmc` → su nombre real', hr.n('resumen.email_id_sfmc') === 'Email_ID (SFMC)', '«' + hr.n('resumen.email_id_sfmc') + '»');
chk('`resumen.mes` y `resumen.mes_num` son distintos', hr.n('resumen.mes') !== hr.n('resumen.mes_num'), '«' + hr.n('resumen.mes') + '» vs «' + hr.n('resumen.mes_num') + '»  ← colapsaban al mismo id');
var llave = hr.llave(['resumen.campana', 'resumen.objetivo', 'resumen.touchpoint', 'resumen.segmento', 'resumen.quincena_lanzamiento']);
chk('la llave del reporte se arma por id', llave.length === 5 && llave.every(Boolean), llave.join(' ¦ '));
var encRef = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { header: 1 })[0];
var href = R.abrir('referencias', encRef);
chk('`referencias.pieza_ids` (plural, el que evaluó 0 casos)', href.n('referencias.pieza_ids') === 'Pieza_IDs', '«' + href.n('referencias.pieza_ids') + '»');

console.log('\n══ 3 · ¿de verdad truena? (un resolvedor que no falla no protege) ══');
function truena(nom, fn, debeDecir) {
  var e = null;
  try { fn(); } catch (x) { e = x; }
  var bien = !!e && (!debeDecir || e.message.indexOf(debeDecir) >= 0);
  chk(nom, bien, e ? e.message.split('\n')[0].replace('🔴 REGISTRO · ', '').slice(0, 62) : '🔴 NO TRONÓ — devolvió sin error');
}
truena('un id que no existe', function () { hr.col('resumen.columna_inventada'); }, 'no existe en el registro');
truena('un id de otro ámbito lo DICE', function () { hr.col('data_email.email_sends'); }, 'es del ámbito');
truena('exigir un id que falta', function () { hr.exigir(['resumen.campana', 'resumen.no_existe'], 'prueba'); }, 'no resuelven');
// un id que el registro conoce pero el archivo ya no trae
var recortado = encRes.slice(0, 5);
var hRec = R.abrir('resumen', recortado, { silencioso: true });
truena('un id que el archivo ya no trae', function () { hRec.col('resumen.tot_sends'); }, 'no resuelve a ninguna columna');

console.log('\n══ 4 · exigir de verdad, con el manifiesto de un paso ══');
var MANIFIESTO_N6 = ['resumen.campana', 'resumen.objetivo', 'resumen.touchpoint', 'resumen.segmento',
  'resumen.quincena_lanzamiento', 'resumen.tot_sends', 'resumen.tot_deliveries', 'resumen.tot_opens',
  'resumen.tot_clicks', 'resumen.wa_envios', 'resumen.carritos_total', 'resumen.content_id_sfmc', 'resumen.email_id_sfmc'];
var paso = false;
try { hr.exigir(MANIFIESTO_N6, 'N6-resumen'); paso = true; } catch (e) { console.log('   ' + e.message); }
chk('el manifiesto de N6 (13 ids) resuelve entero', paso, MANIFIESTO_N6.length + ' ids');

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ LA LIBRERÍA RESUELVE Y FALLA COMO DEBE') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
