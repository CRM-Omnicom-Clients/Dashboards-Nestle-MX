// email-bloque · BLOQUE EMAIL — arma el bloque de envíos en el backend. NO escribe el Excel.
//
// Migra `agent-datos-email.md` + `contrato-fuente-email.md` + `guardian-fuente-email.js`.
//
// 🔴 CAMBIO DE DISEÑO respecto al agente viejo: él escribía `Data_Email` directamente.
//    Ahora arma su bloque en el backend y **la puerta 1 escribe las 3 hojas de una pasada**.
//    Una sola apertura del archivo por corte, y si un bloque falla no entra ninguno.
//
// ⚡ CONSUME EL HANDOFF DE insumos-validar. No vuelve a inventariar la carpeta ni a buscar el encabezado:
//    eso ya se midió. Verifica UNA cifra; si cuadra, arranca. Si no cuadra, PARA.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-conflictos.js');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
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
var esGuid = function (v) { return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(t(v)); };

console.log('════════ email-bloque · BLOQUE EMAIL ════════\n');

// ══ 1 · EL HANDOFF DE insumos-validar ════════════════════════════════════════════════════════════
var inv;
try { inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8')); }
catch (e) {
  console.log('  🔴 no hay handoff de insumos-validar. Corre primero fuentes-insumos.insumos.js — este paso no inventaria por su cuenta.');
  process.exit(1);
}
var f = inv.forma && inv.forma.email;
if (!f || !f.ruta) { console.log('  🔴 el handoff no trae la fuente de email.'); process.exit(1); }

console.log('  ⚡ handoff de insumos-validar (no re-derivo nada de esto):');
console.log('     archivo : ' + f.archivo);
console.log('     sello   : ' + f.sello + '   [' + f.frescura + ']');
console.log('     hojas   : ' + f.hojas.length + ' · esquema uniforme: ' + (f.esquema_uniforme ? 'sí' : 'NO — leer por nombre'));

// 🔴 LA VERIFICACIÓN DE UNA CIFRA. Si no cuadra, para todo: una medición mala envenena el script.
// modo simulación: se corre el código REAL contra un export alterado, para poder probar
// caminos que el corte vigente no ejercita (un envío nuevo, por ejemplo). Nunca escribe.
var SIM = process.env.N2A_SIM || '';
var R = D.leerArchivo(SIM || f.ruta);
if (SIM) console.log('  ⚠ SIMULACIÓN — export sustituido por ' + SIM + '  ·  no se escribe nada\n');
var selloReal = R.generado ? R.generado.txt : '';
if (!SIM && selloReal !== f.sello) {
  console.log('\n  🔴 LA CIFRA DE CONTROL NO CUADRA — paro aquí.');
  console.log('     el handoff dice "' + f.sello + '" y el archivo dice "' + selloReal + '"');
  console.log('     una medición mala envenena el script entero. Vuelve a correr insumos-validar.');
  process.exit(1);
}
console.log('     ✔ cifra de control verificada — arranco sin re-medir\n');

// ══ 2 · LO QUE YA ESTÁ CARGADO ══════════════════════════════════════════════════════
var T = os.homedir() + '/_n2a_hoja.xlsx';
fs.copyFileSync(VIVO_(), T);
var wbHoja = XLSX.readFile(T);
var shE = wbHoja.Sheets['Data_Email'];
var E = XLSX.utils.sheet_to_json(shE, { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

// 🔴 LAS TRES CLASES DE COLUMNA (contrato-fuente-email):
//    crudo    → se escribe tal cual, nunca se corrige
//    fórmula  → las canónicas hacen lookup VIVO al catálogo. ⛔ NO se sobrescriben:
//               escribir texto encima mata el vínculo. Y están INTERCALADAS, no al final.
//    derivada → mes · quincena · semana · tipo de envío. Las calcula este paso.
// Se detectan mirando una fila ya cargada, nunca con una lista fija de letras.
// 🔴 SE ESCANEA LA COLUMNA ENTERA, NO LA FILA 2. Mirar solo la primera fila de datos decía
//    «Segmento_Canonico es una columna de fórmula» cuando 193 de sus 264 celdas son TEXTO
//    ESCRITO A MANO. Una puerta que creyera eso y «restaurara la fórmula» en la columna
//    borraría 277 celdas de trabajo manual entre las cuatro — y como sus valores crudos no
//    están en Catalog_Campanas, la fórmula devolvería "" y quedarían vacías para siempre.
// 🔴 UNA FÓRMULA SE DETECTA POR SU FÓRMULA, NO POR SU VALOR. La versión anterior saltaba toda
//    celda con el valor vacío (`if (!cel || t(cel.v) === '') continue`) — y una fórmula ROTA no
//    tiene valor. Cuando Rick borró `Catalog_Campanas`, las 779 fórmulas de las canónicas
//    quedaron en `=#REF!` sin valor, este bucle las saltó todas, y el script reportó
//    «ninguna columna con fórmula detectada» sobre una hoja con 779. Una columna llena de
//    fórmulas muertas parecía una columna vacía.
//    Ahora se cuentan las tres cosas por separado, porque son tres decisiones distintas:
//      viva   → NO se sobrescribe: el vínculo al catálogo funciona
//      muerta → hay que REPONERLA con valor; conservarla no conserva nada
//      a mano → es trabajo escrito por una persona
var colsFormula = [], colsMuertas = [], clases = [];
(function () {
  var r = XLSX.utils.decode_range(shE['!ref']);
  for (var c = r.s.c; c <= r.e.c; c++) {
    var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })];
    var nom = h ? t(h.v) : XLSX.utils.encode_col(c);
    var frm = 0, dur = 0, muerta = 0;
    for (var i = 1; i <= r.e.r; i++) {
      var cel = shE[XLSX.utils.encode_cell({ r: i, c: c })];
      if (!cel) continue;
      if (cel.f) {
        // rota si la fórmula cita #REF! o si no dejó ningún valor en caché
        if (/#REF!/.test(cel.f) || t(cel.v) === '' || t(cel.v) === '#REF!') muerta++; else frm++;
      } else if (t(cel.v) !== '') dur++;
    }
    if (muerta) colsMuertas.push({ columna: nom, celdas: muerta, a_mano: dur });
    if (!frm && !muerta) continue;
    if (frm) colsFormula.push(nom);
    clases.push({
      columna: nom, celdas_con_formula: frm, celdas_a_mano: dur, celdas_formula_muerta: muerta,
      clase: muerta && !frm ? 'ROTA' : dur && frm ? 'MIXTA' : frm ? 'formula' : muerta ? 'ROTA' : 'crudo'
    });
  }
})();
console.log('  ── las clases de columna (escaneando la columna COMPLETA, no la fila 2)');
clases.forEach(function (x) {
  console.log('     ' + (x.celdas_formula_muerta ? '🔴' : '🔒') + ' ' + x.columna.padEnd(20) + x.clase.padEnd(9) +
    (x.celdas_con_formula ? 'viva ' + String(x.celdas_con_formula).padStart(3) + '  ' : '') +
    (x.celdas_formula_muerta ? '💀 MUERTA ' + String(x.celdas_formula_muerta).padStart(3) + '  ' : '') +
    (x.celdas_a_mano ? '✍ a mano ' + String(x.celdas_a_mano).padStart(3) : ''));
});
if (colsMuertas.length) {
  var totMuertas = colsMuertas.reduce(function (a, x) { return a + x.celdas; }, 0);
  console.log('\n  🔴 ' + totMuertas + ' celdas con FÓRMULA MUERTA en ' + colsMuertas.length + ' columna(s).');
  console.log('     No son celdas vacías que se puedan llenar y ya: son fórmulas que apuntan a una hoja');
  console.log('     que ya no existe. Conservarlas no conserva nada — hay que REPONER el valor.');
}

// ══ 3 · EL DIFF ═════════════════════════════════════════════════════════════════════
// La llave: el contrato pide `Journey_ID + Segment + Touchpoint + Email_Type + Version`.
// 🔴 GANA LA REALIDAD: Journey_ID está contaminado (58 de 264 filas traen el asset, no el
//    journey) y el content_name cambia de prefijo entre cortes. La llave probada es
//    cola(55) del content_name + fecha: 264 llaves para 264 filas, 0 colisiones.
//    Se reporta la discrepancia; NO se corrige el contrato desde aquí.
var cargado = {};
E.forEach(function (r) {
  cargado[D.llaveEnvio({ content_name: r['Email_Content_Name'], fecha: r['Send_Date'] })] = r;
});
// 🔴 LAS MÉTRICAS SE DESCUBREN DE LA FUENTE, no se listan. Con la lista fija, una métrica nueva
//    en Datorama no se cargaba y **nadie se enteraba**. Ahora el mapa hoja↔fuente se arma de la
//    fila real y lo que no se reconoce se DECLARA.
var _m = L.metricasDe(R.hojas[0].filas[0]);
var MET = [], MAP = {};
Object.keys(_m.mapa).forEach(function (canon) {
  var enHoja = canon.split('_').map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('_');
  MET.push(enHoja); MAP[enHoja] = _m.mapa[canon];
});
if (_m.faltan.length) console.log('  🔴 la fuente NO trae: ' + _m.faltan.join(' · '));
if (_m.nuevas.length) console.log('  ⚠ métricas NUEVAS en la fuente, sin cargar todavía: ' + _m.nuevas.join(' · ') + '  → decidir si entran al bloque');
var dat = {};
R.hojas.forEach(function (h) {
  h.filas.forEach(function (r) {
    var cn = t(r['Email Content Name']); if (!cn) return;
    var k = D.llaveEnvio({ content_name: cn, fecha: r['Send Date'] });
    (dat[k] = dat[k] || []).push(r);
  });
});

// 🔴 EL DIFF TIENE QUE SUMAR. Sin `sinPareja`, 264 envíos daban 244+3=247 y 17 quedaban
//    invisibles — no es que estuvieran mal, es que nadie los contaba. Nada se pierde en
//    silencio: un envío que el export ya no trae se DECLARA, no se omite.
// ══ EL VOCABULARIO QUE DECIDE SI UNA FILA NACE MUERTA ═══════════════════════════════
// 🔴 Se leyó la fórmula real de la hoja en vez de suponerla, y dice algo que cambia el check:
//
//    BU / Marca / Campana_Canonica → MATCH($B, Catalog_Campanas!$D)   $B = Email_Content_Name
//    Segmento_Canonico             → MATCH($D, Catalog_Campanas!$G)   $D = Audience_Name
//
//    O sea: la vía de atribución de Data_Email es el CONTENT_NAME, no el campo `Campaign` del
//    export. Y el vocabulario que la alimenta es `Catalog_Campanas` —la hoja viva, la de las
//    1,142 fórmulas—, NO el catálogo unificado de insumos-validar. Hoy conviven los dos; este paso tiene que
//    mirar el que de verdad decide, o avisaría de un problema que no existe y callaría el real.
var CC = XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalog_Campanas'], { defval: '' });
// 🔴 EL VOCABULARIO SALE DEL CATÁLOGO VIVO, NO DEL RETIRADO. Se construía SOLO desde
//    `Catalog_Campanas`, que Rick retiró el 19-ago. Con esa hoja fuera, `CC` viene vacío, todo
//    valor queda «sin catalogar» y CUALQUIER envío nuevo se graduaba MUERTA — incluidos los de
//    campañas que el catálogo nuevo sí conoce. Un vocabulario que consulta una autoridad muerta
//    no dice «no lo conozco»: dice «no conozco nada», que es una respuesta distinta.
//    Ahora se lee de `Catalogo_Piezas` (campañas y sus content_names) y de
//    `Catalogo_Referencias` (los alias crudos), y se conserva `Catalog_Campanas` si existiera.
var vocabCN = {}, vocabAUD = {};
CC.forEach(function (x) {
  if (t(x['Campana_SFMC_Raw'])) vocabCN[t(x['Campana_SFMC_Raw'])] = 1;
  if (t(x['Segmento_SFMC_Raw'])) vocabAUD[t(x['Segmento_SFMC_Raw'])] = 1;
});
(function () {
  var PZv = XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalogo_Piezas'] || {}, { defval: '' });
  var RFv = XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalogo_Referencias'] || {}, { defval: '' });
  PZv.forEach(function (p) {
    [t(p['Campaña'])].concat(String(p['Content_Names_Variantes'] || '').split(/[|;,\r\n]+/))
      .concat([t(p['Content_Name'])]).forEach(function (v) { if (t(v)) vocabCN[t(v)] = 1; });
    if (t(p['Segmento'])) t(p['Segmento']).split(/\s*,\s*/).forEach(function (s) { if (t(s)) vocabAUD[t(s)] = 1; });
  });
  RFv.forEach(function (x) {
    var dim = t(x['Dimension']), crudo = t(x['Valor_Crudo']), canon = t(x['Valor_Canonico']);
    if (/^camp/i.test(dim)) { if (crudo) vocabCN[crudo] = 1; if (canon) vocabCN[canon] = 1; }
    if (/^segm/i.test(dim)) { if (crudo) vocabAUD[crudo] = 1; if (canon) vocabAUD[canon] = 1; }
  });
  console.log('  ── vocabulario: ' + Object.keys(vocabCN).length + ' campañas · ' + Object.keys(vocabAUD).length +
    ' segmentos   (Catalog_Campanas ' + (CC.length ? CC.length + ' filas' : 'RETIRADA') + ')');
})();
// 🔴 HOY CONVIVEN DOS CATÁLOGOS y este paso tiene que decir si discrepan:
//      Catalog_Campanas      → alimenta las fórmulas vivas de Data_Email (el presente operativo)
//      Catalogo_Referencias  → la escalera de alias de insumos-validar (el catálogo unificado)
//    Si un valor resuelve en uno y no en el otro, los dos sistemas dejaron de hablar del mismo
//    mundo — y eso no se nota hasta que un reporte sale distinto según quién lo calculó.
var IXA = A.indexar(XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalogo_Referencias'], { defval: '' }));
var divergencia = [];
Object.keys(vocabCN).forEach(function (v) {
  if (!A.resolver(IXA, 'Campana', v, '', '').v && !A.resolver(IXA, 'Campaña', v, '', '').v) divergencia.push(v);
});
var vocabNuevo = {}, sinAudiencia = {}, sinAudienciaAMano = {};

// qué filas traen Segmento_Canonico escrito a mano (indexadas por su llave de negocio, no por
// el número de fila: si mañana se ordena la hoja, el índice miente y la llave no)
var manoPorLlave = {};
(function () {
  var rr = XLSX.utils.decode_range(shE['!ref']), hh = {};
  for (var c = rr.s.c; c <= rr.e.c; c++) { var h = shE[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h) hh[t(h.v)] = c; }
  var cSeg = hh['Segmento_Canonico'], cCN = hh['Email_Content_Name'], cFe = hh['Send_Date'];
  if (cSeg === undefined || cCN === undefined) return;
  for (var i = 1; i <= rr.e.r; i++) {
    var cel = shE[XLSX.utils.encode_cell({ r: i, c: cSeg })];
    if (!cel || t(cel.v) === '' || cel.f) continue;
    var cn = shE[XLSX.utils.encode_cell({ r: i, c: cCN })], fe = shE[XLSX.utils.encode_cell({ r: i, c: cFe })];
    if (cn) manoPorLlave[t(cn.v) + '¦' + (fe ? t(fe.v) : '')] = 1;
  }
})();
// «N/A» y el vacío son AUSENCIA de dato, no un valor. Tratarlos como valor fue lo que hizo que
// 144 envíos con campaña buena aparecieran como «campaña nueva llamada N/A».
function hayDato(v) { var s = t(v); return s && !/^(n\/?a|null|-|#n\/a)$/i.test(s); }

var st = { nuevos: [], crecieron: 0, iguales: 0, sinPareja: [], conflictos: 0, sinJourney: [], multimes: 0, deltaOpens: 0, campanaDeFuente: 0 };

// 🔴 UN SOLO CONSTRUCTOR para lo cargado y para lo nuevo. Si cada camino arma el envío a su
//    manera, el envío nuevo nace con menos campos que el viejo y nadie lo nota hasta que un
//    reporte lo deja fuera.
function armar(r, todas, esNuevo) {
  var d0 = todas.length ? todas[0] : null;

  var cn = r ? t(r['Email_Content_Name']) : t(d0['Email Content Name']);

  // ⛔ `Campana_Canonica` de la hoja NO es un dato crudo: es el RESULTADO de la fórmula viva.
  //    Y el `Campaign` del export NO es su fuente —la fórmula cruza por content_name—. No
  //    compiten: son dos niveles distintos, así que se guardan los dos y no se pisa ninguno.
  var campHoja = r ? t(r['Campana_Canonica']) : '';         // canónico ya resuelto
  var campFuente = d0 && hayDato(d0['Campaign']) ? t(d0['Campaign']) : '';   // crudo del sistema
  var camp = campHoja || campFuente;
  var campOrigen = campHoja ? 'canónico ya resuelto por la fórmula viva'
    : campFuente ? 'aún sin canonizar — crudo del export; lo resolverá la fórmula al escribirse'
      : '🔴 sin campaña por ninguna vía';
  if (campFuente && !campHoja) st.campanaDeFuente++;

  // 🔴 ¿NACERÁ MUERTA? Se mide con los valores EXACTOS que las fórmulas van a buscar.
  //    Medido: de lo que el export entrega, NADA matchea. `Campaign` trae 3 valores
  //    («CRM-AON-Recestas Nestlé-2026», «N/A», «Maggi SNM LMX») y ninguno está catalogado;
  //    y `Segment` ni siquiera existe en el export —solo `Audience Name`, que es
  //    «All Subscribers» en 955 de 955 filas, o sea que no distingue segmento—.
  //    ⚠ pero un raw sin catalogar solo hace daño si su celda es FÓRMULA. Si alguien ya la
//      resolvió A MANO, el valor está y no nace muerta — es frágil, no rota. Distinguirlo
//      evita reportar 105 envíos «sin segmento» que en realidad están resueltos.
  var campBusca = r ? t(r['Campaign']) : campFuente;    // lo que la fórmula buscará en $D
  var segBusca = r ? t(r['Segment']) : '';              // lo que buscará en $G
  var aMano = r ? !!manoPorLlave[t(r['Email_Content_Name']) + '¦' + t(r['Send_Date'])] : false;
  if (hayDato(campBusca) && !vocabCN[campBusca]) vocabNuevo[campBusca] = (vocabNuevo[campBusca] || 0) + 1;
  if (hayDato(segBusca) && !vocabAUD[segBusca]) {
    var d2 = aMano ? sinAudienciaAMano : sinAudiencia;
    d2[segBusca] = (d2[segBusca] || 0) + 1;
  }
  var aud = (r ? t(r['Audience_Name']) : '') || (d0 ? t(d0['Audience Name']) : '');
  var o = {
    llave: D.llaveEnvio({ content_name: cn, fecha: r ? r['Send_Date'] : d0['Send Date'] }),
    content_name: cn,
    asset_id: D.assetDe(cn),
    fecha: D.isoFecha(r ? r['Send_Date'] : d0['Send Date']),
    campana_raw: camp, campana_origen: campOrigen,
    campana_fuente: campFuente, campana_cargada: campHoja,
    segmento_raw: r ? t(r['Segmento_Canonico']) : '',
    touchpoint_raw: r ? t(r['Touchpoint']) : '',
    email_type: r ? t(r['Email_Type']) : D.tipoEmail(cn),
    canal: (r ? t(r['Canal']) : '') || 'Email',
    audiencia: aud,
    nombre_journey: (r ? t(r['Nombre_Journey']) : '') || (d0 ? t(d0['Journey Name']) : ''),
    fuente: f.archivo
  };
  if (esNuevo) {
    o.estado_diff = 'NUEVO en ' + f.archivo + ' · no estaba en la hoja';
    o.email_type_origen = 'derivado del marcador FUP/FP — la fuente no lo entrega';
    // ⛔ el canónico NO se rellena aquí: son columnas de FÓRMULA viva. Lo que sí hace falta
    //    es que las dos columnas CRUDAS que la fórmula lee traigan un valor catalogado.
    // 🔴 DOS bloqueos distintos, que NO se resuelven igual —y por eso no se reportan juntos:
    //      falta Campaign → se da de alta la campaña en Catalog_Campanas. Es catalogar.
    //      falta Segment  → el dato NO EXISTE en ninguna fuente. El export manda
    //                       «All Subscribers» para todos, así que ningún envío nuevo trae
    //                       segmento jamás. Es una DECISIÓN, no una alta de catálogo.
    var faltan = [], falta = { campana: false, segmento: false };
    if (!hayDato(campBusca) || !vocabCN[campBusca]) { falta.campana = true; faltan.push('Campaign (col $B → Catalog_Campanas.Campana_SFMC_Raw) · se cataloga'); }
    if (!hayDato(segBusca) || !vocabAUD[segBusca]) { falta.segmento = true; faltan.push('Segment (col $D → Catalog_Campanas.Segmento_SFMC_Raw) · lo decide un humano: no está en la fuente'); }
    if (faltan.length) {
      o.requiere_catalogo = true;
      o.gravedad = falta.campana ? 'MUERTA' : 'PARCIAL';
      o.no_escribir_aun = faltan;
      o.efecto_si_se_escribe = falta.campana
        ? 'BU_Canonico, Marca y Campana_Canonica saldrían "" — la fila no entra a NINGÚN reporte'
        : 'Segmento_Canonico saldría "" — entra por campaña, pero se cae del Resumen, que abre por campaña × touchpoint × segmento';
      // 🔴 CANDIDATO PROPUESTO, NO ASIGNADO. En la hoja hay 5 campañas cuyo `Campaign` ES el
      //    content_name completo: así se incorporó un envío antes (se dio de alta ese valor en
      //    Catalog_Campanas y se escribió igual en Data_Email). Se propone el mismo camino.
      //    Asignarlo solo es el error que ya movió 186 carritos: la decisión es humana.
      o.candidato_campaign = cn;
      o.candidato_segment = '(no hay: el export manda «All Subscribers» para todos)';
    }
  }
  MET.forEach(function (m) { o[m.toLowerCase()] = r ? num(r[m]) : 0; });
  return o;
}

var bloque = E.map(function (r) {
  var k = D.llaveEnvio({ content_name: r['Email_Content_Name'], fecha: r['Send_Date'] });
  var todas = dat[k] || [];
  var o = armar(r, todas, false);

  // journey_id: atributo, no llave. Se resuelve por regla, nunca se pisa en silencio.
  var actual = t(r['Journey_ID']), deFuente = todas.length ? t(todas[0]['Journey ID']) : '';
  if (esGuid(actual) && esGuid(deFuente) && actual.toUpperCase() !== deFuente.toUpperCase()) {
    var res = C.resolver({ campo: 'journey_id', valorA: actual, fuenteA: 'workbook · procedencia desconocida', valorB: deFuente, fuenteB: 'Datorama · ' + f.archivo, historia: [] });
    o.journey_id = res.valor; o.journey_id_descartado = res.valor === actual ? deFuente : actual;
    o.journey_id_origen = res.regla + ' · ' + res.detalle; st.conflictos++;
  } else if (esGuid(actual)) { o.journey_id = actual; o.journey_id_origen = 'ya venía correcto'; }
  else if (esGuid(deFuente)) { o.journey_id = deFuente; o.journey_id_origen = 'completado desde ' + f.archivo; o.journey_id_anterior = actual; }
  else { o.journey_id = ''; o.journey_id_origen = 'sin GUID en ninguna fuente'; st.sinJourney.push(o.content_name); }

  // refresh MONÓTONO: MAX por métrica. Nada baja nunca.
  if (todas.length) {
    var subio = false;
    MET.forEach(function (m) {
      var mx = Math.max.apply(null, todas.map(function (x) { return num(x[MAP[m]]); }));
      if (mx > o[m.toLowerCase()]) { o[m.toLowerCase()] = mx; subio = true; }
    });
    if (subio) st.crecieron++; else st.iguales++;
  } else {
    // el export vigente ya no lo trae. Se conserva —nunca se borra lo definido— y se declara.
    o.estado_diff = 'sin pareja en ' + f.archivo + ' · se conserva lo cargado';
    st.sinPareja.push({ cn: o.content_name, fecha: o.fecha, sends: o.email_sends, campana: o.campana_raw });
  }
  if (todas.length > 1) {
    o.opens_suma_meses = todas.reduce(function (a, x) { return a + Math.max(0, num(x['Email Unique Opens'])); }, 0);
    o.meses_con_engagement = todas.length;
    o.criterio_engagement = 'MAX · decisión abierta en decisiones-pendientes.json';
    st.multimes++; st.deltaOpens += Math.max(0, o.opens_suma_meses - o.email_unique_opens);
  }
  return o;
});

// ¿el export trae envíos que la hoja no tiene?
// 🔴 EL ENVÍO NUEVO ENTRA AL BLOQUE — no se cuenta y se deja fuera. Antes solo se guardaban
//    tres campos sueltos (cn/fecha/sends) y el bloque era `E.map(...)`: SOLO lo ya cargado.
//    O sea que el script cuyo trabajo es «lo que ya está se actualiza, lo nuevo se agrega» no
//    agregaba lo nuevo. Con `nuevos = 0` en el corte, el defecto era invisible.
Object.keys(dat).forEach(function (k) {
  if (cargado[k]) return;
  var d = dat[k][0], mm = null;
  // 🔴 el mes de la hoja sale de L.mesDe(), que conoce los 12. La lista clavada llegaba hasta
  //    agosto: en septiembre `mm` quedaba null, la fila se tomaba por fragmento de otro mes y
  //    el envío desaparecía SIN un solo error en pantalla.
  R.hojas.forEach(function (h) { h.filas.forEach(function (x) { if (x === d) mm = L.mesDe(h.hoja) || mm; }); });
  var fecha = D.isoFecha(d['Send Date']);
  if (mm && fecha.slice(5, 7) !== mm) return;          // fila fragmento de otro mes

  var o = armar(null, dat[k], true);
  // sus métricas salen del export (MAX entre las filas del envío, igual que el refresh)
  MET.forEach(function (m) {
    o[m.toLowerCase()] = Math.max.apply(null, dat[k].map(function (x) { return num(x[MAP[m]]); }).concat([0]));
  });
  var g = t(d['Journey ID']);
  if (esGuid(g)) { o.journey_id = g; o.journey_id_origen = 'del export · envío nuevo'; }
  else { o.journey_id = ''; o.journey_id_origen = 'sin GUID en ninguna fuente'; st.sinJourney.push(o.content_name); }
  if (dat[k].length > 1) {
    o.opens_suma_meses = dat[k].reduce(function (a, x) { return a + Math.max(0, num(x['Email Unique Opens'])); }, 0);
    o.meses_con_engagement = dat[k].length;
    o.criterio_engagement = 'MAX · decisión abierta en decisiones-pendientes.json';
    st.multimes++; st.deltaOpens += Math.max(0, o.opens_suma_meses - o.email_unique_opens);
  }
  st.nuevos.push({ cn: o.content_name, fecha: o.fecha, sends: o.email_sends, campana: o.campana_raw, tipo: o.email_type });
  bloque.push(o);
});

// ══ 3b · LAS CUATRO CANÓNICAS — ancla al catálogo y resuelve ════════════════════════
//
// 🔴 EL HUECO QUE DEJÓ EL BORRADO DEL CATÁLOGO VIEJO. Email era la ÚNICA fuente que no anclaba:
//    Qcart ancla 2,538/2,538 y WhatsApp 6/13, pero el bloque de email ni siquiera tenía el campo
//    `pieza_id`. Sus canónicas vivían como fórmula DENTRO de la hoja, y cuando la hoja de la que
//    leían desapareció, murieron las 779 de golpe.
//    Ahora se resuelven aquí y bajan como VALOR. Un valor no se rompe cuando alguien mueve una
//    hoja. Es la diferencia entre que el Excel calcule y que el Excel muestre.
//
// 🔴 MANDA EL CATÁLOGO (decisión de Rick, 20-ago-2026), pero cada celda que cambie se DECLARA
//    con lo que decía antes. `Data_Email` quedó desactualizada y las celdas escritas a mano se
//    escribieron cuando el catálogo no existía — pero «manda» no puede significar «se pisa sin
//    que nadie lo vea». Donde el catálogo NO resuelve, se conserva lo de la hoja: sustituir el
//    trabajo de una persona por un vacío sería destruir el único dato que hay.
var CAN = require(BACK + '/_scripts/lib-canonico.js');
var PZ = XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalogo_Piezas'] || {}, { defval: '' });
var RF = XLSX.utils.sheet_to_json(wbHoja.Sheets['Catalogo_Referencias'] || {}, { defval: '' });
var IXP = CAN.indexarPiezas(PZ), IXA = A.indexar(RF);
console.log('\n  ── las 4 canónicas, resueltas contra el catálogo NUEVO');
console.log('     Catalogo_Piezas: ' + PZ.length + ' piezas   ·   Catalogo_Referencias: ' + RF.length + ' filas');

var enHojaPor = {};
E.forEach(function (r) {
  enHojaPor[CAN.nm(r['Email_Content_Name'])] = {
    bu: r['BU_Canonico'], marca: r['Marca'], campana: r['Campana_Canonica'], segmento: r['Segmento_Canonico']
  };
});

var viasCan = {}, totalCambios = [], totalConservados = [], sinResolver = [];
bloque.forEach(function (o) {
  var r = CAN.resolver(IXP, IXA, o);
  viasCan[r.via] = (viasCan[r.via] || 0) + 1;
  o.pieza_id = r.pieza_id;
  o.bu_canonico = r.bu; o.marca_canonica = r.marca;
  o.campana_canonica = r.campana; o.segmento_canonico = r.segmento;
  o.canonico_via = r.via;
  o.canonico_motivo = r.motivo || null;

  var prev = enHojaPor[CAN.nm(o.content_name)] || {};
  var d = CAN.contrastar(r, prev);
  o.canonico_cambios = d.cambios.length ? d.cambios : null;
  o.canonico_conservados = d.conservados.length ? d.conservados : null;
  d.cambios.forEach(function (c) { totalCambios.push({ content_name: o.content_name, dimension: c.dimension, de: c.de, a: c.a, tipo: c.tipo }); });
  d.conservados.forEach(function (c) { totalConservados.push({ content_name: o.content_name, dimension: c.dimension, valor: c.valor }); });
  if (!r.bu && !r.marca && !r.campana && !r.segmento) sinResolver.push(o);
});
Object.keys(viasCan).sort().forEach(function (v) { console.log('     ' + String(viasCan[v]).padStart(4) + '  ' + v); });
var conLas4 = bloque.filter(function (o) { return o.bu_canonico && o.marca_canonica && o.campana_canonica && o.segmento_canonico; }).length;
console.log('     ── con las CUATRO resueltas: ' + conLas4 + ' de ' + bloque.length +
  '   ·   sin ninguna: ' + sinResolver.length);

var corregidos = totalCambios.filter(function (c) { return c.tipo === 'CORREGIDO'; });
var repuestos = totalCambios.filter(function (c) { return c.tipo === 'repuesto'; });
console.log('\n     💀 celdas REPUESTAS (estaban muertas o vacías): ' + repuestos.length);
console.log('     🔴 celdas CORREGIDAS (la hoja decía otra cosa) : ' + corregidos.length +
  (corregidos.length ? '   ← revisar: si el catálogo se equivoca, se corrige el CATÁLOGO' : ''));
var porDim = {};
corregidos.forEach(function (c) { (porDim[c.dimension] = porDim[c.dimension] || []).push(c); });
Object.keys(porDim).forEach(function (d) {
  var muestra = {};
  porDim[d].forEach(function (c) { var k = c.de + ' → ' + c.a; muestra[k] = (muestra[k] || 0) + 1; });
  console.log('        ' + d.padEnd(10) + porDim[d].length + ' celdas');
  Object.keys(muestra).slice(0, 6).forEach(function (k) { console.log('           «' + k + '»  x' + muestra[k]); });
});
if (totalConservados.length) console.log('     ✍ celdas CONSERVADAS (el catálogo no resuelve): ' + totalConservados.length);

// ══ 4 · SALIDA ══════════════════════════════════════════════════════════════════════
var out = {
  paso: 'email-bloque · bloque email', generado_por: 'N2a-email.js',
  canonico: {
    autoridad: 'Catalogo_Piezas + Catalogo_Referencias',
    regla: 'manda el CATÁLOGO (Rick, 20-ago-2026) · donde el catálogo no resuelve se conserva lo de la hoja',
    vias: viasCan, con_las_cuatro: conLas4, sin_ninguna: sinResolver.length,
    celdas_repuestas: repuestos.length, celdas_corregidas: corregidos.length,
    corregidas: corregidos, conservadas: totalConservados
  },
  handoff_de: 'insumos-validar · _insumos/inventario.json',
  fuente: { archivo: f.archivo, sello: f.sello, nota: 'elegido por insumos-validar según su sello interno' },
  llave: 'cola(55) del content_name ¦ fecha',
  columnas_con_formula: colsFormula,
  columnas_con_formula_muerta: colsMuertas,
  // 🔴 lo que la puerta 1 tiene que saber para no destruir trabajo manual
  clases_de_columna: clases,
  celdas_escritas_a_mano: clases.reduce(function (a, x) { return a + x.celdas_a_mano; }, 0),
  envios: bloque,
  // el vocabulario se mide contra Catalog_Campanas, que es lo que la fórmula viva consulta
  vocabulario_nuevo: {
    medido_contra: 'Catalog_Campanas · col D (content_name) y col G (Segmento_SFMC_Raw)',
    por_que: 'la fórmula viva de Data_Email cruza por ahí; lo que no esté da "" y la fila nace muerta',
    content_names_sin_catalogar: Object.keys(vocabNuevo),
    audiencias_sin_catalogar: Object.keys(sinAudiencia),
    resueltas_a_mano_sin_catalogar: Object.keys(sinAudienciaAMano)
  },
  divergencia_entre_catalogos: {
    que: 'valores que Catalog_Campanas conoce y la escalera de Catalogo_Referencias no resuelve',
    por_que_importa: 'los dos catálogos conviven; si divergen, un reporte sale distinto según quién lo calcule',
    cuantos: divergencia.length, de: Object.keys(vocabCN).length, valores: divergencia
  },
  auditoria: {
    envios: bloque.length, nuevos: st.nuevos.length, crecieron: st.crecieron, iguales: st.iguales,
    sin_pareja_en_el_export: st.sinPareja.length,
    campana_recuperada_de_la_fuente: st.campanaDeFuente,
    cuadre_del_diff: st.iguales + st.crecieron + st.sinPareja.length + st.nuevos.length,
    journey_id_conflictos_resueltos: st.conflictos, journey_id_sin_guid: st.sinJourney.length,
    multimes: st.multimes, delta_opens_si_se_sumara: st.deltaOpens,
    sends_total: bloque.reduce(function (a, e) { return a + e.email_sends; }, 0)
  },
  discrepancia_con_el_contrato: {
    que: 'el contrato pide la llave Journey_ID + Segment + Touchpoint + Email_Type + Version',
    realidad: 'Journey_ID está contaminado: 58 de 264 filas traen el asset_id, no el journey. Con esa llave hay 29 colisiones.',
    que_se_usa: 'cola(55) del content_name + fecha — 264 llaves para 264 filas, 0 colisiones',
    nota: 'GANA LA REALIDAD. Se reporta; el contrato NO se corrige desde aquí.'
  },
  para_el_siguiente: {
    que_es: 'el bloque de email listo para la puerta 1',
    ojo: 'las columnas con fórmula NO se sobrescriben: ' + (colsFormula.join(', ') || '(ninguna detectada)'),
    ojo_mayor: clases.filter(function (x) { return x.celdas_a_mano; }).length
      ? '⛔ ' + clases.reduce(function (a, x) { return a + x.celdas_a_mano; }, 0) + ' celdas de esas columnas están ESCRITAS A MANO, no calculadas. ' +
      'Restaurar la fórmula encima las borraría, y sus valores crudos no están en Catalog_Campanas: quedarían vacías para siempre. Se escribe celda por celda, nunca por columna.'
      : 'todas las celdas de esas columnas son fórmula',
    // 🔴 el catálogo se revisa ANTES de la primera escritura: si entra un envío con campaña que
    //    el vocabulario no conoce, su fórmula viva devolverá "" y la fila nace MUERTA.
    antes_de_escribir: (Object.keys(vocabNuevo).length + Object.keys(sinAudiencia).length)
      ? '🔴 catalogar primero en Catalog_Campanas: ' + Object.keys(vocabNuevo).length + ' content_name(s) y ' + Object.keys(sinAudiencia).length + ' audiencia(s)'
      : 'todo el vocabulario del bloque ya está en Catalog_Campanas — ninguna fila nacerá muerta'
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
// en simulación el bloque bueno NO se pisa: se escribe aparte para poder inspeccionarlo
fs.writeFileSync(BACK + (SIM ? '/_fuentes/_sim-email.json' : '/_fuentes/email.json'), JSON.stringify(out, null, 1));

console.log('\n  ── el diff');
console.log('     idénticos    : ' + st.iguales);
console.log('     crecieron    : ' + st.crecieron);
console.log('     sin pareja   : ' + st.sinPareja.length + '   (el export vigente ya no los trae; se conservan)');
console.log('     NUEVOS       : ' + st.nuevos.length);
var suma = st.iguales + st.crecieron + st.sinPareja.length + st.nuevos.length;
console.log('     ' + (suma === bloque.length ? '✔' : '🔴') + ' cuadre del diff: ' + st.iguales + ' + ' + st.crecieron + ' + ' + st.sinPareja.length + ' + ' + st.nuevos.length + ' = ' + suma + ' de ' + bloque.length);
st.nuevos.slice(0, 6).forEach(function (n) { console.log('        + ' + n.fecha + '  ' + String(n.sends).padStart(8) + '  ' + n.tipo.padEnd(10) + n.cn.slice(-40)); });
if (st.campanaDeFuente) console.log('\n  ── envíos sin canonizar aún (crudo del export): ' + st.campanaDeFuente);
console.log('\n  ── el catálogo, ANTES de la primera escritura');
console.log('     [se mide con el valor EXACTO que la fórmula busca: $B→Campana_SFMC_Raw · $D→Segmento_SFMC_Raw]');
console.log('     Campaign sin catalogar : ' + Object.keys(vocabNuevo).length + (Object.keys(vocabNuevo).length ? '  🔴 esas filas nacen muertas' : '  ✔ ninguna'));
Object.keys(vocabNuevo).slice(0, 5).forEach(function (v) { console.log('        «' + v.slice(0, 56) + '»  x' + vocabNuevo[v]); });
console.log('     Segment  sin catalogar : ' + Object.keys(sinAudiencia).length + (Object.keys(sinAudiencia).length ? '  🔴 su celda es fórmula → nace muerta' : '  ✔ ninguno que rompa'));
Object.keys(sinAudiencia).slice(0, 5).forEach(function (v) { console.log('        «' + v.slice(0, 56) + '»  x' + sinAudiencia[v]); });
if (Object.keys(sinAudienciaAMano).length) {
  console.log('     ⚠ sin catalogar pero YA RESUELTO A MANO (frágil, no roto): ' + Object.keys(sinAudienciaAMano).length);
  Object.keys(sinAudienciaAMano).forEach(function (v) { console.log('        «' + v + '»  x' + sinAudienciaAMano[v] + '  · si alguien restaura la fórmula, se pierde'); });
}
console.log('\n  ── los dos catálogos que hoy conviven');
console.log('     Catalog_Campanas conoce ' + Object.keys(vocabCN).length + ' campañas · la escalera de Catalogo_Referencias no resuelve ' + divergencia.length);
if (divergencia.length) console.log('        ' + divergencia.slice(0, 8).join(' · '));
var bloqueados = bloque.filter(function (e) { return e.requiere_catalogo; });
if (bloqueados.length) {
  console.log('\n  🔴 ' + bloqueados.length + ' envío(s) NUEVO(s) NO SE PUEDEN ESCRIBIR TODAVÍA — les falta catálogo:');
  bloqueados.slice(0, 5).forEach(function (e) {
    console.log('        ' + e.fecha + '  ' + e.content_name.slice(-40));
    e.no_escribir_aun.forEach(function (x) { console.log('           falta ' + x); });
  });
}
console.log('\n  ── journey_id (atributo, no llave)');
console.log('     conflictos resueltos por regla : ' + st.conflictos);
console.log('     sin GUID en ninguna fuente     : ' + st.sinJourney.length);
console.log('\n  ── el bloque');
console.log('     envíos : ' + bloque.length + '   ·   Σ sends: ' + out.auditoria.sends_total.toLocaleString());
console.log('     🔒 columnas con fórmula que NO se tocan: ' + (colsFormula.length || 'ninguna detectada'));
console.log('\n  → ' + BACK + '/_fuentes/email.json');
