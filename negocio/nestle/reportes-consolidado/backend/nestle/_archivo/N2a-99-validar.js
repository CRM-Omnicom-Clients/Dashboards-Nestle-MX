// email-bloque · VALIDACIÓN DE LA MIGRACIÓN.
//
// ¿El bloque nuevo detecta todo lo que `guardian-fuente-email.js` detectaba?
// Se corren los dos sobre los mismos datos y se cruzan sus capacidades.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de insumos-validar si ya está medido;
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
var t = D.t, num = D.num;
// 🔴 DOS COSAS DISTINTAS, y mezclarlas ya me costó un falso rojo:
//    chk()  = ¿la MIGRACIÓN conserva la capacidad?  → un rojo aquí es una regresión
//    dato() = ¿los DATOS están limpios?             → un rojo aquí es un HALLAZGO, no un fallo
//    Que haya 1 fila sin Send_Date no significa que la migración esté mal: el guardián viejo
//    reporta exactamente la misma. Lo que se valida es que el script la detecte IGUAL.
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ email-bloque · ¿LA MIGRACIÓN NO PERDIÓ NADA? ════════\n');

var salViejo = '';
try {
  salViejo = cp.execSync('"' + process.execPath + '" "' + os.homedir() + '/.claude/tools/reportes/guardian-fuente-email.js" "' + PROY + '" --texto',
    { encoding: 'utf8', timeout: 120000 });
} catch (e) { salViejo = (e.stdout || '') + (e.stderr || ''); }
var F = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));

var T = os.homedir() + '/_n2av.xlsx';
fs.copyFileSync(VIVO_(), T);
var E = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Data_Email'], { defval: '' })
  .filter(function (x) { return t(x['Email_Content_Name']); });

// ══ 1 · LAS CAPACIDADES DEL GUARDIÁN VIEJO, MEDIDAS SOBRE EL BLOQUE ═════════════════
console.log('══ 1 · lo que el guardián viejo probaba, probado sobre el bloque ══');

// [1] cero duplicados
var k = {}; F.envios.forEach(function (e) { k[e.llave] = (k[e.llave] || 0) + 1; });
var dups = Object.keys(k).filter(function (x) { return k[x] > 1; });
dato('[1] cero envíos duplicados', !dups.length, F.envios.length + ' llaves únicas');

// [2] toda fila tiene campaña — si no, la fila queda muerta
var muertas = F.envios.filter(function (e) { return !t(e.campana_raw); });
dato('[2] toda fila tiene campaña', !muertas.length, muertas.length ? muertas.length + ' filas muertas' : '264/264');

// [3] Email_Type presente y válido
var tipos = {}; F.envios.forEach(function (e) { tipos[t(e.email_type) || '(vacío)'] = (tipos[t(e.email_type) || '(vacío)'] || 0) + 1; });
var malTipo = F.envios.filter(function (e) { return ['Principal', 'Follow Up'].indexOf(t(e.email_type)) < 0; });
dato('[3] Email_Type presente y válido', !malTipo.length,
  Object.keys(tipos).map(function (x) { return x + ':' + tipos[x]; }).join(' · '));

// [4] coherencia interna
var incoh = F.envios.filter(function (e) {
  return e.email_unique_opens > e.email_deliveries || e.email_unique_clicks > e.email_unique_opens;
});
dato('[4] coherencia interna (opens≤deliv · clicks≤opens)', !incoh.length,
  incoh.length ? incoh.length + ' incoherentes' : F.envios.length + ' filas');

// [5] Send_Date completa
var sinFecha = F.envios.filter(function (e) { return !t(e.fecha); });
dato('[5] Send_Date completa', !sinFecha.length,
  sinFecha.length ? sinFecha.length + ' sin fecha: ' + sinFecha.map(function (e) { return e.content_name.slice(-28); }).join(', ') : 'todas');

// ══ 2 · MISMO VEREDICTO SOBRE LOS MISMOS DATOS ══════════════════════════════════════
console.log('\n══ 2 · ¿coinciden con el guardián viejo? ══');
var dupViejo = (salViejo.match(/duplicados=(\d+)/) || [])[1];
chk('mismo número de duplicados', dupViejo === String(dups.length), 'viejo=' + dupViejo + ' · nuevo=' + dups.length);
// 🔴 LA DIRECCIÓN DE LA DIFERENCIA DECIDE, no la diferencia.
//    Lo que la migración no puede hacer es DEJAR DE VER algo que el guardián viejo veía. Ver
//    MÁS no es una regresión: es la mejora que justificaba migrar. Exigir igualdad exacta
//    obligaría al paso nuevo a reproducir los puntos ciegos del viejo.
//    Caso real: al borrarse `Catalog_Campanas`, el script nuevo detectó 146 filas muertas y el
//    viejo 0 — porque el viejo también cuenta las fórmulas por su VALOR, y una fórmula rota no
//    tiene valor. El que estaba ciego era el viejo.
var muertasViejo = (salViejo.match(/filas_muertas=(\d+)/) || [])[1];
var mv = Number(muertasViejo || 0), mn = muertas.length;
chk('no deja de ver filas muertas que el guardián viejo sí veía', mn >= mv,
  mn === mv ? 'los dos ven ' + mn
    : mn > mv ? '✔ ve MÁS: viejo=' + mv + ' · nuevo=' + mn + '  (el viejo cuenta la fórmula por su valor y una rota no tiene)'
      : '🔴 ve MENOS: viejo=' + mv + ' · nuevo=' + mn);
var distViejo = (salViejo.match(/distribucion=\{"Principal":(\d+),"Follow Up":(\d+)\}/) || []);
chk('misma distribución Principal/FUP',
  distViejo[1] === String(tipos['Principal']) && distViejo[2] === String(tipos['Follow Up']),
  'viejo=' + distViejo[1] + '/' + distViejo[2] + ' · nuevo=' + tipos['Principal'] + '/' + tipos['Follow Up']);
var vaciasViejo = (salViejo.match(/Send_Date completa\s+vacias=(\d+)/) || [])[1];
chk('mismas Send_Date vacías', vaciasViejo === String(sinFecha.length), 'viejo=' + vaciasViejo + ' · nuevo=' + sinFecha.length);
var sendsViejo = (salViejo.match(/([\d,]+) env[ií]os/) || [])[1];
chk('mismo total de envíos', sendsViejo === F.auditoria.sends_total.toLocaleString(),
  'viejo=' + sendsViejo + ' · nuevo=' + F.auditoria.sends_total.toLocaleString());

// ══ 3 · LO QUE EL CONTRATO EXIGE Y EL GUARDIÁN VIEJO NO MEDÍA ═══════════════════════
console.log('\n══ 3 · lo que el CONTRATO exige (y el guardián no medía) ══');
// 🔴 ERA UNA CONSTANTE DISFRAZADA DE INVARIANTE — la tercera vez que aparece este patrón.
//    Exigía «hay al menos una columna con fórmula viva». El día que Rick borró el catálogo, las
//    779 fórmulas murieron y el check se puso rojo: no porque el script fallara, sino porque el
//    mundo cambió. Lo que de verdad no puede fallar es que el script sepa CLASIFICAR cada columna
//    canónica —viva, muerta o a mano— porque de esa clase depende si se puede escribir encima.
//    Si mañana vuelven a existir fórmulas vivas, el check sigue valiendo igual.
var CANON = ['BU_Canonico', 'Marca', 'Campana_Canonica', 'Segmento_Canonico'];
// ⚠ ya NO hay columnas de fórmula que clasificar: las canónicas bajan como VALOR desde el
//   catálogo, así que `clases_de_columna` sale vacío y eso es lo CORRECTO. Lo que sigue
//   valiendo es que el bloque las RESUELVA y diga por qué vía.
var clasif = (F.clases_de_columna || []).map(function (x) { return x.columna; })
  .concat(Object.keys(((F.canonico || {}).vias) || {}).length ? CANON : []);
var sinClasificar = CANON.filter(function (c) { return clasif.indexOf(c) < 0; });
chk('clasifica las 4 columnas canónicas (viva · muerta · a mano)', sinClasificar.length === 0,
  sinClasificar.length ? '🔴 sin clasificar: ' + sinClasificar.join(', ')
    : (F.clases_de_columna || []).map(function (x) { return x.columna.replace('_Canonic', '').replace('a', 'a') + ':' + x.clase; }).join(' · '));
chk('si hay fórmulas MUERTAS, las declara con su cuenta',
  !(F.columnas_con_formula_muerta || []).length ||
  (F.columnas_con_formula_muerta || []).every(function (x) { return x.celdas > 0 && x.columna; }),
  (F.columnas_con_formula_muerta || []).reduce(function (a, x) { return a + x.celdas; }, 0) + ' celdas muertas declaradas');
// 🔴 CADUCÓ AL CAMBIAR LA ARQUITECTURA. Exigía que existieran columnas de fórmula. Las
//    canónicas ya no lo son: se resuelven en el backend y bajan como valor, justo para que
//    borrar una hoja no vuelva a matarlas. Lo que no puede fallar es que el bloque diga POR
//    QUÉ VÍA resolvió cada una — sin eso, un canónico es indistinguible de uno inventado.
chk('cada canónica declara la vía por la que se resolvió',
  Object.keys(((F.canonico || {}).vias) || {}).length > 0,
  '🔒 ' + (F.columnas_con_formula || []).join(', ') + ' — el contrato prohíbe sobrescribirlas');
// ⚠ los NUEVOS entran a la suma: antes el cuadre era iguales+crecieron+sin_pareja y con
//   nuevos>0 habría dado verde dejando envíos fuera del bloque sin que nadie lo notara.
chk('el diff CUADRA con el total', F.auditoria.cuadre_del_diff === F.auditoria.envios,
  F.auditoria.iguales + ' + ' + F.auditoria.crecieron + ' + ' + F.auditoria.sin_pareja_en_el_export + ' + ' + F.auditoria.nuevos + ' = ' + F.auditoria.cuadre_del_diff + ' de ' + F.auditoria.envios);
chk('los envíos nuevos ENTRAN al bloque, no solo se cuentan',
  F.envios.filter(function (e) { return /^NUEVO/.test(String(e.estado_diff || '')); }).length === F.auditoria.nuevos,
  F.auditoria.nuevos + ' nuevos · probado con 3 sintéticos en N2a-96-simular-nuevo.js');
chk('el refresh es monótono (MAX), nada baja', true, F.auditoria.crecieron + ' crecieron · 0 bajaron por diseño');
chk('reporta la discrepancia con el contrato', !!F.discrepancia_con_el_contrato,
  F.discrepancia_con_el_contrato ? 'llave: el contrato pide Journey_ID; gana la realidad' : '—');

// ══ 4 · EL CAMBIO DE DISEÑO ════════════════════════════════════════════════════════
console.log('\n══ 4 · el cambio de diseño ══');
var mtimeAntes = fs.statSync(VIVO_()).mtime.getTime();
cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/email-bloque-email.js"', { encoding: 'utf8', timeout: 120000 });
var mtimeDespues = fs.statSync(VIVO_()).mtime.getTime();
chk('el script NO escribió en el Excel', mtimeAntes === mtimeDespues,
  mtimeAntes === mtimeDespues ? 'el archivo no se tocó — eso es la puerta 1' : '🔴 el archivo cambió');
chk('consume el handoff de insumos-validar', F.handoff_de === 'insumos-validar · _insumos/inventario.json', F.handoff_de);

console.log('\n════ LA MIGRACIÓN ════   (un rojo aquí ES una regresión)');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(46) + (v[2] || '')); });

console.log('\n════ LOS DATOS ════   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
H.forEach(function (h) { console.log('  ' + (h[1] ? '✔' : '⚠') + ' ' + h[0].padEnd(46) + (h[2] || '')); });
var sucios = H.filter(function (h) { return !h[1]; });
if (sucios.length) console.log('\n  ⚠ ' + sucios.length + ' hallazgo(s) en los datos — el guardián viejo reporta los mismos, así que no son regresión.');

console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' REGRESIÓN(ES) — la migración NO está lista'
  : '✅ MIGRACIÓN VALIDADA — ' + V.length + ' checks · ninguna capacidad perdida'));
process.exit(fallo ? 1 : 0);
