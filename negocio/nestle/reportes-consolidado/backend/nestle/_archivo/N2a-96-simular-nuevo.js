// email-bloque · SIMULACIÓN — los caminos que el corte vigente NO ejercita.
//
// El corte de hoy trae `nuevos = 0`, así que todo el camino de incorporación de un envío
// nuevo pasaba en verde sin ejecutarse ni una vez. Ahí vivía el defecto de fondo: los nuevos
// se contaban y el bloque era `E.map(...)` —solo lo ya cargado—, o sea que el script cuyo
// trabajo es «lo nuevo se agrega» no agregaba lo nuevo.
//
// Esto no re-implementa la lógica: **altera el export y corre el email-bloque de verdad**. Una réplica
// de la lógica probaría la réplica.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = D.t, num = D.num;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

console.log('════════ email-bloque · SIMULACIÓN DE LOS CAMINOS NO EJERCITADOS ════════\n');
var inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));
var real = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

// ── se construye un export alterado a partir del real ────────────────────────────────
// ⚠ se trabaja a nivel de MATRIZ, no con json_to_sheet: `leerArchivo` lee con header:1 y
//   localiza el encabezado por puntaje entre las 25 primeras filas. Reconstruir la hoja desde
//   objetos borra el preámbulo de Datorama y el lector ya no encuentra dónde empieza la tabla
//   — que es justo lo que hizo que la primera simulación inyectara 0 filas.
var TMPO = os.homedir() + '/_sim-orig.xlsx';
fs.copyFileSync(inv.forma.email.ruta, TMPO);
var wb = XLSX.readFile(TMPO);
var hojaJul = wb.SheetNames.filter(function (n) { return /julio/i.test(n); })[0] || wb.SheetNames[0];
var M = XLSX.utils.sheet_to_json(wb.Sheets[hojaJul], { header: 1, defval: '' });
var TERM = /content name|send date|email sends|journey|campaign/i;
var iH = -1, mejor = 0;
M.slice(0, 25).forEach(function (fila, i) {
  var p = fila.filter(function (c) { return TERM.test(t(c)); }).length;
  if (p > mejor) { mejor = p; iH = i; }
});
var COLS = M[iH].map(t);
function col(n) { return COLS.indexOf(n); }
var iModelo = iH + 1;
while (iModelo < M.length && !t(M[iModelo][col('Email Content Name')])) iModelo++;

// TRES envios nuevos, cada uno para probar una cosa distinta.
// 🔴 EL FIXTURE CODIFICABA LA TAXONOMIA DEL CATALOGO RETIRADO. Usaba `camp: 'Recetas Nestle'`
//    como «campana ya catalogada», y en el catalogo nuevo eso es una BU, no una campana: sus
//    campanas son AON, Antojo Infinito, Fuel for life, Hackea tu cafe, Hotcakes, Liga MX,
//    Mundial, Tercer Tiempo y The Freshers. Con la taxonomia vieja el simulador pedia que el
//    paso reconociera algo que ya no es una campana, y graduaba MUERTA con razon.
//    Un fixture tambien caduca: si prueba contra un vocabulario retirado, mide el pasado.
var NUEVOS = [
  { cn: 'O_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_SIM-AON-EP9_CN_EM_A_V1_999001',
    camp: 'Hotcakes', desc: 'campana YA catalogada → debe poder escribirse' },
  { cn: 'O_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_SIM-AON-EP9-FUP_CN_EM_A_V1_999001',
    camp: 'Hotcakes', desc: 'su FUP → debe derivar Follow Up y NO fundirse con el anterior' },
  { cn: 'O_Marca-Nueva-NC009999_1_IBS_FOOD_XXXX_XXX_XXXX_MX_ES_SIM-DESCONOCIDA_CN_EM_A_V1_999002',
    camp: 'Campaña Que No Existe', desc: 'campaña SIN catalogar → debe quedar bloqueada, no escribirse' }
];
NUEVOS.forEach(function (n, i) {
  var f = M[iModelo].slice();
  f[col('Email Content Name')] = n.cn;
  f[col('Send Date')] = '2026-07-2' + (i + 1);
  f[col('Campaign')] = n.camp;
  f[col('Journey ID')] = 'AAAAAAAA-BBBB-CCCC-DDDD-00000000000' + (i + 1);
  f[col('Email Sends')] = 10000 * (i + 1);
  f[col('Email Deliveries')] = 9900 * (i + 1);
  f[col('Email Unique Opens')] = 2000 * (i + 1);
  f[col('Email Unique Clicks')] = 100 * (i + 1);
  f[col('Email Bounces')] = 100 * (i + 1);
  M.push(f);
});

// y un envío YA CARGADO al que se le BAJAN las métricas: el refresh no puede dejarlas bajar.
// ⚠ la víctima se elige DE ESTA HOJA, no del bloque: la primera versión tomó un envío que no
//   estaba en julio, la fila nunca se encontró y el check quedó SIN EJECUTARSE — imprimía
//   nada y el veredicto igual salía verde. Un check que no corre no prueba nada.
var porCola = {};
real.envios.forEach(function (e) { porCola[e.content_name.slice(-55)] = e; });
var bajada = null;
for (var i2 = iH + 1; i2 < M.length && !bajada; i2++) {
  var cnf = t(M[i2][col('Email Content Name')]);
  var v = porCola[cnf.slice(-55)];
  if (!v || v.email_sends < 1000 || v.email_unique_opens < 100) continue;
  bajada = { cn: v.content_name, antesOpens: v.email_unique_opens, antesSends: v.email_sends };
  M[i2][col('Email Unique Opens')] = 1;
  M[i2][col('Email Sends')] = 1;
  M[i2][col('Email Deliveries')] = 1;
}
if (!bajada) { console.log('  🔴 no se pudo montar la prueba de monotonía — se aborta: un check que no corre no prueba nada'); process.exit(1); }

var wb2 = XLSX.utils.book_new();
wb.SheetNames.forEach(function (n) {
  XLSX.utils.book_append_sheet(wb2, n === hojaJul ? XLSX.utils.aoa_to_sheet(M) : wb.Sheets[n], n);
});
var SIMF = os.homedir() + '/_sim-export.xlsx';
XLSX.writeFile(wb2, SIMF);
console.log('  export simulado: ' + hojaJul + ' + 3 envíos nuevos' + (bajada ? ' + 1 envío con métricas BAJADAS' : ''));
console.log('  (el archivo real no se toca; el bloque bueno tampoco)\n');

// ── se corre el email-bloque DE VERDAD contra ese export ──────────────────────────────────────
var out = cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/email-bloque-email.js"',
  { env: Object.assign({}, process.env, { N2A_SIM: SIMF }), encoding: 'utf8' });
console.log(out.split('\n').filter(function (l) { return /diff|cuadre|NUEVOS|idénticos|crecieron|sin pareja|NO SE PUEDEN|falta |^\s{8}\+/.test(l); }).join('\n'));

var S = JSON.parse(fs.readFileSync(BACK + '/_fuentes/_sim-email.json', 'utf8'));

// ══ LO QUE HAY QUE PROBAR ═══════════════════════════════════════════════════════════
console.log('\n══ ¿el envío nuevo ENTRA al bloque? ══');
var enBloque = NUEVOS.map(function (n) { return S.envios.filter(function (e) { return e.content_name === n.cn; })[0]; });
NUEVOS.forEach(function (n, i) {
  console.log('  ' + (enBloque[i] ? '✔' : '🔴') + ' ' + n.desc);
});
chk('los 3 envíos nuevos entran al bloque', enBloque.every(Boolean),
  enBloque.filter(Boolean).length + '/3   (antes entraban 0: se contaban y se dejaban fuera)');

chk('el bloque creció exactamente en 3', S.envios.length === real.envios.length + 3,
  'antes ' + real.envios.length + ' · ahora ' + S.envios.length);

chk('el diff SIGUE cuadrando con nuevos > 0', S.auditoria.cuadre_del_diff === S.envios.length,
  S.auditoria.iguales + ' + ' + S.auditoria.crecieron + ' + ' + S.auditoria.sin_pareja_en_el_export + ' + ' + S.auditoria.nuevos + ' = ' + S.auditoria.cuadre_del_diff + ' de ' + S.envios.length);

console.log('\n══ ¿trae sus datos, o entra hueco? ══');
if (enBloque[0]) {
  var e0 = enBloque[0];
  console.log('     sends ' + e0.email_sends + ' · opens ' + e0.email_unique_opens + ' · tipo ' + e0.email_type + ' · journey ' + (e0.journey_id ? 'sí' : 'NO'));
  chk('el envío nuevo trae sus métricas', e0.email_sends === 10000 && e0.email_unique_opens === 2000, 'sends 10,000 · opens 2,000');
  chk('el envío nuevo trae su journey_id', !!e0.journey_id, e0.journey_id_origen || '');
  chk('deriva Principal correctamente', e0.email_type === 'Principal', e0.email_type);
}
if (enBloque[1]) chk('deriva Follow Up del marcador FUP', enBloque[1].email_type === 'Follow Up', enBloque[1].email_type);
chk('el Principal y su FUP NO se funden en una llave', enBloque[0] && enBloque[1] && enBloque[0].llave !== enBloque[1].llave,
  'llaves distintas');

console.log('\n══ ¿frena lo que nacería muerto? ══');
if (enBloque[2]) {
  chk('el de campaña desconocida se marca MUERTA', enBloque[2].gravedad === 'MUERTA',
    enBloque[2].gravedad + ' · ' + (enBloque[2].efecto_si_se_escribe || '').slice(0, 60));
  chk('propone candidato SIN asignarlo', !!enBloque[2].candidato_campaign && enBloque[2].campana_raw !== enBloque[2].candidato_campaign,
    'candidato propuesto, campana_raw sin tocar');
}
// 🔴 la expectativa que estaba mal era la MÍA: un envío con campaña catalogada tampoco puede
//    escribirse entero, porque el segmento NO viene en la fuente para ningún envío nuevo
//    («All Subscribers» en 955 de 955 filas). No es un bug del paso: es el límite real del dato.
if (enBloque[0]) chk('el de campaña catalogada se gradúa PARCIAL, no MUERTA', enBloque[0].gravedad === 'PARCIAL',
  enBloque[0].gravedad + ' · solo le falta el segmento, que ninguna fuente entrega');
chk('los dos bloqueos se distinguen entre sí', enBloque[0] && enBloque[2] && enBloque[0].gravedad !== enBloque[2].gravedad,
  'PARCIAL (falta decidir segmento) ≠ MUERTA (falta catalogar campaña)');

console.log('\n══ ¿el refresh deja bajar una métrica? ══');
if (bajada) {
  var v = S.envios.filter(function (e) { return e.content_name === bajada.cn; })[0];
  console.log('     ' + bajada.cn.slice(-40));
  console.log('     opens cargados ' + bajada.antesOpens + ' · el export ahora manda 1 · el bloque dice ' + (v ? v.email_unique_opens : '?'));
  chk('MAX protege: la métrica NO baja', v && v.email_unique_opens === bajada.antesOpens,
    v ? 'quedó en ' + v.email_unique_opens : 'no se encontró');
  chk('MAX protege también los sends', v && v.email_sends === bajada.antesSends,
    v ? 'quedó en ' + v.email_sends.toLocaleString() : '');
}

console.log('\n══ ¿ensució el bloque bueno? ══');
var despues = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
chk('el bloque real quedó intacto', despues.envios.length === real.envios.length && despues.auditoria.sends_total === real.auditoria.sends_total,
  despues.envios.length + ' envíos · Σ ' + despues.auditoria.sends_total.toLocaleString());

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' camino(s) siguen rotos' : '✅ los caminos que el corte no ejercita FUNCIONAN'));
try { fs.unlinkSync(SIMF); } catch (e) { }
process.exit(fallo ? 1 : 0);
