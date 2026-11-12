// L1 · SEMBRAR EL REGISTRO DE NOMBRES — la idea de Rick, 20-ago-2026.
//
//    «Una librería común que almacena las variables y las actualiza cuando revisa el archivo que
//     va a tocar. Los skills no lo hacen conforme a su código, sino que tienen variables dinámicas
//     que toman de la librería. La librería tiene una llave única no modificable como propiedad,
//     y luego actualiza esa propiedad con los nuevos nombres que van cambiando.»
//
// 🔴 QUÉ ES. El catálogo de sistema de una base de datos: un id lógico INMUTABLE y un nombre
//    físico que puede cambiar. Ninguna consulta de SQL guarda el nombre de una columna dentro de
//    su plan: guarda su id, y el catálogo resuelve el nombre en cada ejecución.
//
// 🔴 POR QUÉ HACE FALTA, con los dos casos que lo motivaron:
//    · el contador de `resumen-regenerar` leía `Content_ID` cuando la hoja la llama `Content_ID (SFMC)`: reportó
//      «0 y 0» durante varias corridas MIENTRAS ESCRIBÍA 60 y 60. No falló — mintió en verde.
//    · un check buscaba `Pieza_ID` donde la columna se llama `Pieza_IDs`: evaluó CERO casos y
//      pintó verde durante días.
//    Los dos son el mismo defecto: un nombre físico escrito a mano dentro de la lógica.
//
// 🔴 EL ID SE ACUÑA UNA SOLA VEZ Y NO SE RENOMBRA JAMÁS. Si un concepto cambia de significado se
//    crea un id nuevo y el viejo se marca `retirado`. Renombrar el id es exactamente lo que el
//    registro existe para evitar.
//
// 🔴 ESTE SCRIPT NO ADIVINA NADA. Solo siembra: lee el libro real y los esquemas de las DEs (que
//    vienen del handoff del equipo de SFMC) y acuña un id por columna. Detectar renombres es
//    trabajo de L3, y ahí sí hay reglas de evidencia.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var HOY = process.argv[2] || '2026-08-20';
var t = function (v) { return String(v == null ? '' : v).trim(); };

// 🔴 EL ID SE ACUÑA CON LA NORMALIZACIÓN DE LA LIBRERÍA, NO CON UNA COPIA. Tenerla dos veces ya
//    falló en el primer intento: aquí `#` se transliteraba y allá se borraba, así que `Mes (#)`
//    acuñaba su id propio pero después resolvía al mismo que `Mes` — y la librería, con razón, se
//    negaba a elegir entre los dos. El defecto no era la ambigüedad: era tener dos copias de la
//    regla. Los símbolos se transliteran (`#`→`num`), no se borran: `#` es lo que distingue una
//    columna de la otra, no es ruido.
var REG = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var idDe = REG.idDe;

// 🔴 el tipo se INFIERE DE LOS DATOS, no del nombre. `Mes (#)` es número y `Codigo_NC` es texto
//    aunque parezca número: lo que manda es lo que hay en las celdas.
function tipoDe(valores) {
  var v = valores.filter(function (x) { return t(x) !== ''; });
  if (!v.length) return 'sin datos';
  var num = v.filter(function (x) { return typeof x === 'number' || /^-?[\d,]+(\.\d+)?$/.test(t(x)); }).length;
  if (num / v.length < 0.9) return 'texto';
  var dec = v.filter(function (x) { return typeof x === 'number' && x % 1 !== 0; }).length;
  return dec / v.length > 0.5 ? 'decimal' : 'entero';
}

var registro = { paso: 'L1', sembrado: HOY, regla: {
  id: 'INMUTABLE. Se acuña una vez y no se renombra jamás; si el concepto cambia, id nuevo y el viejo a `retirado`.',
  nombres: 'MUTABLE. Es lo que puede cambiar en el archivo. La librería es el único lugar donde el id y el nombre se tocan.',
  resolver: 'Si un id no resuelve, o resuelve a dos candidatos, la librería TRUENA y dice cuáles son. Nunca devuelve undefined.',
  actualizar: 'Se reconcilia AL LEER el archivo que se va a tocar, antes de tocarlo (L3). Un renombre es un hecho que se registra con evidencia, no una duda que se resuelve.'
}, ambitos: {}, columnas: {} };

// ── 1 · las hojas del libro vivo
var C = os.homedir() + '/_l1.xlsx';
var vivo = L.archivoVivo({ dir: PROY });
fs.copyFileSync(vivo.ruta, C);
var wb = XLSX.readFile(C);
console.log('════════ L1 · SEMBRAR EL REGISTRO ════════\n');
console.log('  libro: ' + require('path').basename(vivo.ruta) + '   ' + wb.SheetNames.length + ' hojas\n');

// 🔴 las hojas LEGACY no entran: tienen fórmulas vivas y no las produce este sistema. Meterlas
//    haría que el registro prometa gobernar algo que nadie gobierna.
var LEGACY = /^(Reporte_julio|Soporte_IA_)/;
var abrev = { 'Report_Resumen': 'resumen', 'Catalogo_Piezas': 'catalogo', 'Catalogo_Referencias': 'referencias',
  'Data_Email': 'data_email', 'Data_WhatsApp': 'data_wa', 'Data_Qcart_Carritos': 'qcart_carritos',
  'Data_Qcart_Productos': 'qcart_productos' };

wb.SheetNames.forEach(function (n) {
  if (LEGACY.test(n)) { console.log('  ⊘ ' + n.padEnd(28) + 'legacy — fuera del registro a propósito'); return; }
  var am = abrev[n];
  if (!am) { console.log('  ⊘ ' + n.padEnd(28) + 'sin abreviatura declarada — no se siembra a ciegas'); return; }
  var F = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', blankrows: false });
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })[0] || [];
  registro.ambitos[am] = { tipo: 'hoja', nombre_fisico: n, n_columnas: enc.length, n_filas: F.length };
  var acunados = 0, choques = [];
  enc.forEach(function (nom, i) {
    if (!t(nom)) return;
    var id = idDe(am, nom);
    // 🔴 UN SEMBRADOR QUE NO PUEDE ACUÑAR UN ID ÚNICO **PARA**, NO DESCARTA LA COLUMNA.
    //    Descartarla deja el registro incompleto y `R.exigir()` fallaría después, lejos de aquí,
    //    con un mensaje que no señala la causa. Mejor romper aquí, donde se ve el porqué.
    if (registro.columnas[id]) { choques.push('«' + nom + '» y «' + registro.columnas[id].nombres[0] + '» → ' + id); return; }
    registro.columnas[id] = {
      id: id, ambito: am, nombres: [t(nom)], alias_historicos: [],
      posicion: i, letra: XLSX.utils.encode_col(i),
      vecinos: [t(enc[i - 1] || ''), t(enc[i + 1] || '')].filter(Boolean),
      tipo_dato: tipoDe(F.slice(0, 60).map(function (x) { return x[nom]; })),
      llenas: F.filter(function (x) { return t(x[nom]) !== ''; }).length,
      visto: HOY
    };
    acunados++;
  });
  console.log('  ✔ ' + n.padEnd(28) + String(acunados).padStart(3) + ' columnas → ámbito `' + am + '`' +
    (choques.length ? '   🔴 ' + choques.length + ' choque(s) de id: ' + choques.join(' · ') : ''));
});

// ── 2 · las DEs de SFMC. La autoridad es el handoff del equipo, no una inspección nuestra.
// 🔴 se siembran los NOMBRES del esquema; los datos no hacen falta para acuñar un id.
var DES = {
  'de_detalle': { nombre_fisico: 'CRM_Email_Detalle', cols: ['RowKey','JobID','SendDay','ConfigKey','BU','Marca','Campana','Touchpoint','Segmento','Email_Content_Name','Email_Subject','Email_Sender_Name','Send_Date','Journey_Name','Journey_UUID','Journey_ID_Datorama','Codigo_NC','Email_Sends','Email_Deliveries','Email_Bounces','Email_Bounces_Soft','Email_Unique_Opens','Email_Total_Opens','Email_Unique_Clicks','Email_Total_Clicks','Email_Unique_Unsubs','Delivery_Rate','Open_Rate','Click_Rate','CTOR','Bounce_Rate','LastRefresh','Email_ID','Es_FUP','Email_Total_Unsubs','Audience_DE','Audience_Volume'],
    nuevas: ['Email_Subject','Journey_Name','Journey_UUID','Journey_ID_Datorama','Email_Unique_Unsubs','Email_ID','Es_FUP','Email_Total_Unsubs','Audience_DE','Audience_Volume'] },
  'de_piezas': { nombre_fisico: 'CRM_Email_Piezas', cols: ['ConfigKey','PiezaID','Email_Content_Name','Codigo_NC','Journey_Name','Journey_UUID','BU','Marca','Campana','Touchpoint','Segmento','Fecha_Primer_Envio','Fecha_Ultimo_Envio','N_Jobs','Dias_Con_Envio','Email_Sends','Email_Deliveries','Email_Bounces','Email_Unique_Opens','Email_Unique_Clicks','Email_Unique_Unsubs','Delivery_Rate','Open_Rate','Click_Rate','CTOR','Bounce_Rate','LastRefresh','Email_ID','Email_Subject','Es_FUP','Journey_ID_Datorama','Piezas_Mismo_Asset','Email_Total_Unsubs','Audience_DE','Audience_Volume'],
    nuevas: ['Journey_Name','Journey_UUID','Email_Unique_Unsubs','Email_ID','Email_Subject','Es_FUP','Journey_ID_Datorama','Piezas_Mismo_Asset','Email_Total_Unsubs','Audience_DE','Audience_Volume'] },
  'de_links': { nombre_fisico: 'CRM_Email_Links', cols: ['RowKey','ConfigKey','Campana','Touchpoint','Segmento','Email_Content_Name','Email_Subject','Email_ID','Link_Name','Link_URL','Clicks_Total','Clicks_Unique','LastRefresh'],
    nuevas: ['Email_Subject','Email_ID','Link_Name','Link_URL','Clicks_Total','Clicks_Unique'], de_nueva: true },
  'de_audiencias': { nombre_fisico: 'CRM_Audiencias', cols: ['ConfigKey','Journey_UUID','Audience_DE','Audience_Volume','LastRefresh'],
    nuevas: ['Journey_UUID','Audience_DE','Audience_Volume'], de_nueva: true },
  'de_config': { nombre_fisico: 'CRM_Reporte_Config', cols: ['ConfigKey','PiezaID','ContentName','CodigoNC','JourneyUUID','BU','Marca','Campana','Touchpoint','Segmento','EmailType','Estado','Activo','Notas','EmailID'],
    nuevas: ['EmailID'] },
  'de_auditoria': { nombre_fisico: 'CRM_Reporte_Auditoria', cols: ['ConfigKey','PiezaID','Email_Content_Name','Campana','Marca','Activo','JobsEncontrados','DiasConEnvio','EnviosTotales','PrimerEnvio','UltimoEnvio','Estado','LastRun','Asset_Declarado','Asset_Real','Piezas_Mismo_Asset'],
    nuevas: ['Asset_Declarado','Asset_Real','Piezas_Mismo_Asset'] }
};
console.log('');
Object.keys(DES).forEach(function (am) {
  var d = DES[am];
  registro.ambitos[am] = { tipo: 'data extension', nombre_fisico: d.nombre_fisico, n_columnas: d.cols.length,
    fuente: 'HANDOFF-CATALOGO-RAIZ.md (equipo de SFMC, 20-ago-2026)', de_nueva: !!d.de_nueva };
  var nuevas = 0;
  d.cols.forEach(function (nom, i) {
    var id = idDe(am, nom);
    if (registro.columnas[id]) return;
    var esNueva = d.nuevas.indexOf(nom) >= 0;
    if (esNueva) nuevas++;
    registro.columnas[id] = {
      id: id, ambito: am, nombres: [nom], alias_historicos: [], posicion: i,
      vecinos: [t(d.cols[i - 1] || ''), t(d.cols[i + 1] || '')].filter(Boolean),
      tipo_dato: 'declarado en el esquema',
      nueva_del_handoff: esNueva || undefined,
      visto: HOY
    };
  });
  console.log('  ✔ ' + d.nombre_fisico.padEnd(28) + String(d.cols.length).padStart(3) + ' columnas → ámbito `' + am + '`' +
    (nuevas ? '   🆕 ' + nuevas + ' nuevas del handoff' : '') + (d.de_nueva ? '   🆕 DE NUEVA' : ''));
});

// ── 3 · el sembrado no cierra si dejó una sola columna fuera
console.log('\n══ comprobación: toda columna real tiene id ══');
var falla = 0;
Object.keys(registro.ambitos).forEach(function (am) {
  var a = registro.ambitos[am];
  var conId = Object.keys(registro.columnas).filter(function (k) { return registro.columnas[k].ambito === am; }).length;
  var ok = conId === a.n_columnas;
  if (!ok) falla++;
  console.log('   ' + (ok ? '✔' : '🔴') + ' ' + a.nombre_fisico.padEnd(26) + conId + ' de ' + a.n_columnas +
    (ok ? '' : '   ← FALTAN ' + (a.n_columnas - conId)));
});
if (falla) {
  console.log('\n  🔴 NO SE ESCRIBE EL REGISTRO. ' + falla + ' ámbito(s) con columnas sin id.');
  console.log('     Un registro incompleto es peor que ninguno: promete gobernar algo que no gobierna.');
  process.exit(1);
}
fs.writeFileSync(BACK + '/_contratos/registro.json', JSON.stringify(registro, null, 1));
var n = Object.keys(registro.columnas).length;
console.log('\n  ámbitos: ' + Object.keys(registro.ambitos).length + '   columnas con id: ' + n + '   ✔ ninguna fuera');
console.log('  → _contratos/registro.json');
