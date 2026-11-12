// NC · EL BLOQUE DE EMAIL DESDE `CRM_Email_Piezas` — el grano que el reporte necesita, ya agregado
//      por SFMC, con las columnas nuevas del handoff del 20-ago-2026.
//
// 🔴 POR QUÉ `Piezas` Y NO `Detalle`. `Detalle` es pieza × día y `NB` lo agregaba por pieza a mano.
//    `Piezas` YA viene agregado por pieza, con la misma regla de fecha ancla (`Fecha_Primer_Envio`
//    = mín Send_Date). Menos código, menos que se pueda desfasar, y la mitad del peso: se pide una
//    sola vez y cabe en disco sin trocear.
//
// 🔴 LO DECLARADO LE GANA A LO INFERIDO. Hasta hoy el sistema decidía si un correo era Follow Up
//    **leyendo su nombre** (`/follow/i`) — que es inferir del naming, justo lo que la regla del
//    proyecto prohíbe; sobrevivió porque funcionaba. SFMC ahora lo DECLARA en `Es_FUP`, y esa es
//    la fuente. ⚠ Y cuando los dos se contradicen no gana ninguno en silencio: **se declara la
//    contradicción**, igual que con las tablas apiladas de WhatsApp.
//
// 🔴 UN FETCH GRANDE NUNCA ENTRA AL CONTEXTO. Este script lee el volcado que el MCP dejó en
//    `_insumos/`; el crudo no se lee jamás a mano.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'email';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var FE = require(__dirname + '/lib-fechas-envio.js');
// 🔴 LO QUE APORTARON LOS JOBS DE PRUEBA, para restarlo. El criterio de «prueba» vive en UN
//    solo lugar (`lib-fechas-envio`), el mismo que decide la fecha: si el bloque tuviera el suyo,
//    un día la fecha diría que salió el 24 y las métricas seguirían contando el envío del 3.
var PRUEBAS = FE.pruebas();
var FECHAS = FE.cargar();
var R = require(__dirname + '/lib-registro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// 🔴 un flag no es una ruta. `process.argv[2]` tomaba '--escribir' como el nombre del volcado.
// 🔴 el volcado VIGENTE, no una fecha escrita a mano: cuando llego el de hoy, la fecha fija
//    habria seguido leyendo el de hace una semana y pisando el bloque bueno sin avisar.
var _pedido = process.argv.slice(2).filter(function (x) { return x.indexOf('--') !== 0; })[0];
var _vig = _pedido ? null : L.insumoVigente('sfmc-piezas');
var INS = _pedido || (_vig && _vig.ruta);
if (!INS) {
  /* 🔴 EL MENSAJE DICE QUÉ HACER, NO SOLO QUÉ FALTA. Decía «no hay ningun volcado sfmc-piezas-*
   *    en _insumos/» y se quedaba ahí: para quien no estuvo en la sesión donde se inventó ese
   *    nombre, es un callejón. Lo destapó correr el sistema desde la carpeta nueva con `_insumos`
   *    vacía — que es exactamente el estado en que lo va a encontrar la primera persona. */
  console.log('🔴 no hay ningún volcado `sfmc-piezas-*` en _insumos/');
  console.log('   Es la foto de las DE de SFMC, y es una ENTRADA: no la produce la cadena.');
  console.log('   Tráela con:   node ' + __dirname + '/fuentes-email.refrescar-volcado.js --escribir');
  console.log('   (necesita el MCP de SFMC conectado. Si no lo tienes, pídelo antes de correr el corte.)');
  process.exit(1);
}
if (!fs.existsSync(INS)) { console.log('🔴 no existe el volcado ' + INS); process.exit(1); }
var D = JSON.parse(fs.readFileSync(INS, 'utf8'));
console.log('════════ NC · BLOQUE DE EMAIL desde CRM_Email_Piezas ════════\n');
console.log('  volcado: ' + require('path').basename(INS) + '   ' + D.count + ' piezas   (' + Math.round(fs.statSync(INS).size / 1024) + ' KB, nunca al contexto)');

// ── el catálogo manda las dimensiones canónicas; la DE manda las métricas
var C = require('path').resolve(__dirname, '..') + '/_tmp/_nc.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var wb = XLSX.readFile(C);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
h.exigir(['catalogo.pieza_id', 'catalogo.content_name', 'catalogo.campana', 'catalogo.marca', 'catalogo.bu',
  'catalogo.touchpoint', 'catalogo.segmento', 'catalogo.subsegmento', 'catalogo.objetivo', 'catalogo.emailid'], 'NC');
var N = function (k) { return h.n('catalogo.' + k); };
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('  catálogo: ' + CAT.length + ' piezas · registro ✔\n');

// 🔴 EL NOMBRE DEL ENVÍO SE PIDE POR ROL, NO POR CAMPO (27-ago-2026). La DE cambió de esquema:
//    pasó de 23 a 36 campos, `Email_Content_Name` llega VACÍO en las 102 filas y el nombre vive
//    ahora en `EmailName`. Leerlo por el campo viejo no daba error — daba cadena vacía, y con
//    ella **ninguna** pieza cruzaba por su llave: las 102 caían al ConfigKey, y las 5 con
//    ConfigKey provisional (`TMP-*`) se habrían quedado sin pieza en silencio.
//    Es el mismo defecto que descartaba tres meses del maestro: un nombre fijo contra una
//    fuente que se renombra. Se prueban los candidatos en orden y se declara cuál respondió.
var CANDIDATOS_NOMBRE = ['Email_Content_Name', 'EmailName', 'Email_Name', 'Content_Name'];
var _viaNombre = {};
function nombreDelEnvio(r) {
  for (var i = 0; i < CANDIDATOS_NOMBRE.length; i++) {
    var v = t(r[CANDIDATOS_NOMBRE[i]]);
    if (v) { _viaNombre[CANDIDATOS_NOMBRE[i]] = (_viaNombre[CANDIDATOS_NOMBRE[i]] || 0) + 1; return v; }
  }
  _viaNombre['(ninguno)'] = (_viaNombre['(ninguno)'] || 0) + 1;
  return '';
}

// 🔴 LA LLAVE ES EL ContentName, como declara el handoff. El ConfigKey es alias interno.
var porCN = {}, porId = {};
CAT.forEach(function (p) {
  var id = t(p[N('pieza_id')]);
  if (id) porId[id] = p;
  t(p[N('content_name')]).split(/\s*[·|]\s*/).forEach(function (cn) { if (t(cn)) porCN[t(cn)] = p; });
});

// fecha "4/30/2026 12:00:00 AM" → ISO
function fechaISO(v) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t(v));
  if (!m) return '';
  return m[3] + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
}

// 🔴 `menos` es la ÚNICA puerta por la que pasa la resta, para poder contarla y comprobarla.
var restado = {}, piezasTocadas = {};
function menos(r, metrica) {
  var bruto = num(r[metrica]);
  var p = PRUEBAS.porConfigKey[t(r.ConfigKey)];
  if (!p) return bruto;
  var q = p[metrica] || 0;
  if (!q) return bruto;
  restado[metrica] = (restado[metrica] || 0) + q;
  piezasTocadas[t(r.ConfigKey)] = 1;
  return Math.max(0, bruto - q);
}

var envios = [], sinPieza = [], contradicciones = [], mismoAsset = [];
D.rows.forEach(function (r) {
  var cn = nombreDelEnvio(r), ck = t(r.ConfigKey);
  var p = porCN[cn] || porId[ck];
  var via = porCN[cn] ? 'ContentName (la llave)' : (porId[ck] ? 'ConfigKey (alias interno) — el ContentName no cruza' : null);
  if (!p) { sinPieza.push({ configkey: ck, content_name: cn, sends: num(r.Email_Sends), campana: t(r.Campana) }); return; }

  // 🔴 Es_FUP declarado vs el nombre. Si discrepan, se DECLARA — no gana ninguno en silencio.
  //    ⚠ Y la detección por nombre tiene que ser GENEROSA, o inventa contradicciones que no
  //      existen: la primera versión buscaba `_FUP_` y no veía `-FUP_`, así que marcó 13 falsas.
  //      Además hay una pieza que abrevia **FP** (`TRADITIONAL-PARENTS-FP`). Esto es exactamente
  //      por qué el nombre no sirve como fuente y `Es_FUP` sí: cada campaña lo escribe distinto.
  var declarado = /^s[ií]$/i.test(t(r.Es_FUP));
  var porNombre = /[-_.](FUP|FP)[-_.]/i.test(cn) || /follow/i.test(cn);
  if (declarado !== porNombre) {
    contradicciones.push({ pieza: t(p[N('pieza_id')]), content_name: cn.slice(-52), es_fup_declarado: t(r.Es_FUP), el_nombre_dice: porNombre ? 'FUP' : 'Principal' });
  }
  if (num(r.Piezas_Mismo_Asset) > 1) mismoAsset.push({ pieza: t(p[N('pieza_id')]), email_id: t(r.Email_ID), cuantas: num(r.Piezas_Mismo_Asset) });

  // 🔴 `N/A` NO ES UN SUBSEGMENTO — es la declaración de que no aplica. Con `t(...)` era truthy,
  //    así que se concatenaba: 92 de los 98 envíos salían como «Career Focused — N/A», y esos
  //    valores iban a PISAR los segmentos buenos de la hoja. Es el mismo defecto que ya se corrigió
  //    en el motor y en el catálogo: al introducir los tres estados de celda, todo `if (valor)` que
  //    quedó sin migrar empezó a tratar `N/A` y `PENDIENTE` como dato.
  //    Y además no se repite lo que el segmento ya dice: Pro Plan se desambigua con `· Gatos`,
  //    y pegarle «— Gatos» detrás no agrega nada.
  var EQS = require(__dirname + '/lib-esquema.js');
  var seg = t(p[N('segmento')]);
  var sub = t(p[N('subsegmento')]);
  //    🔴 UN SOLO SEPARADOR PARA UN SOLO HECHO. Salían las dos formas —«Pro Plan Aspiracionales
  //       — Perros» y «Pro Plan Aspiracionales · Gatos»— según si la especie venía ya pegada en
  //       `segmento` o aparte en `subsegmento`. Es el mismo dato escrito de dos maneras, y basta
  //       para que un agrupado parta un segmento en dos sin que nadie lo note. El canónico es `·`,
  //       que es como el catálogo ya desambigua las 12 piezas de Pro Plan.
  //    🔴 15-sep-2026: la regla se MUDÓ a `lib-esquema.segmentoCanonico`. Estaba copiada a mano
  //       en tres scripts y le faltaba a un cuarto (el bloque de Qcart), y esa ausencia hizo que
  //       el mismo pieza_id dijera dos segmentos distintos en dos hojas. Aquí se delega.
  seg = EQS.segmentoCanonico(seg, sub);
  envios.push({
    llave: t(p[N('pieza_id')]) + '¦' + (declarado ? 'FUP' : 'PRIN'),
    pieza_id: t(p[N('pieza_id')]),
    content_name: cn,
    // 🔴 7-sep-2026 · LA FECHA DEL ENVÍO REAL, y de aquí sale la QUINCENA de la fila del reporte.
    //     de la DE agregada toma el primer job PRUEBAS INCLUIDAS: E-PROP1
    //    decía 3-ago por cuatro jobs de UN envío, y salió el 24-ago. Eso metía 19 piezas en la
    //    quincena equivocada. Rick lo pidió explícito: «las quincenas las corriges, de catálogo
    //    y reporte». Se arregla AQUÍ, en el creador, no aguas abajo: la quincena la deriva el
    //    motor de esta fecha, así que corrigiéndola se mueven catálogo y reporte a la vez.
    //    Si una pieza no estuviera en el detalle, se cae a la de la DE en vez de quedarse sin fecha.
    fecha: (FECHAS.porNombre[cn] && FECHAS.porNombre[cn].primero) || fechaISO(r.Fecha_Primer_Envio),
    fecha_de: (FECHAS.porNombre[cn] && FECHAS.porNombre[cn].primero) ? 'detalle día por día (sin pruebas)' : 'DE agregada (la pieza no está en el detalle)',
    email_type: declarado ? 'FollowUp' : 'Principal',
    email_type_via: 'Es_FUP declarado por SFMC',
    canal: 'Email',
    fuente: 'SFMC · CRM_Email_Piezas',
    // 🔴 SIN LO DE PRUEBA (Rick, 7-sep-2026: «no puede haber ya nada de prueba, limpia esto»).
    //    Un job de menos de 10 envíos es alguien mandándose el correo a sí mismo para revisarlo:
    //    202 jobs en todo el sistema = 203 envíos. En el total no se nota (0.0023%), pero quien
    //    manda la prueba SE LA ABRE, así que aportan 200 opens y **93 clicks de 38,914 (0.24%)**.
    //    En una pieza chica eso movía la apertura hasta 7.65 puntos.
    //    Se resta métrica por métrica, y `menos()` NUNCA devuelve negativo: si la resta se pasara,
    //    sería que el detalle y la agregada no hablan de lo mismo, y prefiero un 0 a un negativo
    //    que se propague como si fuera un dato.
    email_sends: menos(r, 'Email_Sends'), email_deliveries: menos(r, 'Email_Deliveries'),
    email_unique_opens: menos(r, 'Email_Unique_Opens'), email_unique_clicks: menos(r, 'Email_Unique_Clicks'),
    email_bounces: menos(r, 'Email_Bounces'),
    email_unique_unsubs: menos(r, 'Email_Unique_Unsubs'), email_total_unsubs: menos(r, 'Email_Total_Unsubs'),
    email_id: t(r.Email_ID),
    content_id: cn,
    journey_id_datorama: t(r.Journey_ID_Datorama),
    // 🔴 los nombres que el CONTRATO de escritura le pide al bloque. NC los llamaba de otra
    //    forma y N1d-99 los reporto como inexistentes: es el mismo defecto que el registro
    //    resuelve para las columnas de la hoja, pero en los campos del JSON. Hasta que el
    //    registro cubra tambien los bloques, el contrato manda en como se llaman.
    nombre_journey: t(r.Journey_Name),
    audiencia: t(r.Audience_DE),
    subject: t(r.Email_Subject),
    audiencia_de: t(r.Audience_DE), audiencia_volumen: num(r.Audience_Volume),
    piezas_mismo_asset: num(r.Piezas_Mismo_Asset),
    dias_de_envio: num(r.Dias_Con_Envio),
    bu_canonico: t(p[N('bu')]), marca_canonica: t(p[N('marca')]), campana_canonica: t(p[N('campana')]),
    segmento_canonico: seg, objetivo: t(p[N('objetivo')]), touchpoint_raw: t(p[N('touchpoint')]),
    canonico_via: 'catálogo · ' + via, cruce: (porCN[cn] ? 'contentname' : 'configkey')
  });
});

var suma = envios.reduce(function (a, e) { return a + e.email_sends; }, 0);
console.log('  envíos: ' + envios.length + '   Σ sends ' + mil(suma));
console.log('  cruzados por ContentName: ' + envios.filter(function (e) { return e.cruce === 'contentname'; }).length +
  '   ·   por ConfigKey: ' + envios.filter(function (e) { return e.cruce === 'configkey'; }).length);
console.log('  sin lo de prueba: ' + Object.keys(piezasTocadas).length + ' pieza(s) tocadas · ' +
  FE.METRICAS.filter(function (m) { return restado[m]; }).map(function (m) { return m.replace('Email_', '') + ' -' + restado[m]; }).join('  ') +
  (Object.keys(piezasTocadas).length ? '' : '   (ninguna)'));
// 🔴 LA RESTA SE COMPRUEBA CONTRA LA MEDICIÓN INDEPENDIENTE. Si lo restado no coincide con lo
//    que `lib-fechas-envio` dice que aportan las pruebas, la resta se aplicó mal o a medias.
var descuadre = FE.METRICAS.filter(function (m) { return (restado[m] || 0) !== (PRUEBAS.total[m] || 0); });
if (descuadre.length) {
  console.log('  🔴 la resta NO cuadra con la medición: ' + descuadre.map(function (m) {
    return m + ' restó ' + (restado[m] || 0) + ' y debía restar ' + (PRUEBAS.total[m] || 0); }).join(' · '));
  process.exit(1);
}
// 🔴 se DECLARA de qué campo salió el nombre. Si mañana la DE vuelve a renombrarlo, esta línea
//    lo dice en la primera corrida en vez de dejar 102 cruces silenciosos por el alias interno.
console.log('  el nombre del envío salió de: ' + Object.keys(_viaNombre).map(function (k) { return k + '×' + _viaNombre[k]; }).join(' · '));
console.log('  Principal ' + envios.filter(function (e) { return e.email_type === 'Principal'; }).length +
  '  ·  FollowUp ' + envios.filter(function (e) { return e.email_type === 'FollowUp'; }).length + '   (por `Es_FUP`, declarado)');
console.log('  con asunto: ' + envios.filter(function (e) { return e.subject; }).length +
  '  ·  con audiencia: ' + envios.filter(function (e) { return e.audiencia_de; }).length +
  '  ·  con unsubs: ' + envios.filter(function (e) { return e.email_total_unsubs; }).length);

if (sinPieza.length) {
  var s2 = sinPieza.reduce(function (a, x) { return a + x.sends; }, 0);
  console.log('\n  🔴 ' + sinPieza.length + ' pieza(s) de la DE SIN pieza en el catálogo · ' + mil(s2) + ' envíos que NO llegan al reporte:');
  sinPieza.slice(0, 12).forEach(function (x) { console.log('     ' + t(x.configkey).padEnd(16) + t(x.campana).padEnd(16) + mil(x.sends).padStart(9) + '  ' + x.content_name.slice(-46)); });
}
if (contradicciones.length) {
  console.log('\n  ⚠ ' + contradicciones.length + ' contradicción(es) entre `Es_FUP` y el nombre — se DECLARAN, gana lo declarado:');
  contradicciones.slice(0, 10).forEach(function (x) { console.log('     ' + x.pieza.padEnd(10) + 'Es_FUP=' + x.es_fup_declarado.padEnd(4) + ' · el nombre dice ' + x.el_nombre_dice + '  ' + x.content_name); });
}
if (mismoAsset.length) {
  console.log('\n  ⚠ ' + mismoAsset.length + ' pieza(s) comparten creativo con otra (`Piezas_Mismo_Asset` > 1) — no es error, pero el Email_ID no las distingue:');
  mismoAsset.slice(0, 8).forEach(function (x) { console.log('     ' + x.pieza.padEnd(10) + 'Email_ID ' + x.email_id + ' usado por ' + x.cuantas + ' piezas'); });
}

var out = {
  paso: 'NC', generado_por: 'fuentes-email.email-piezas.js', fuente: 'SFMC · CRM_Email_Piezas (handoff 20-ago-2026)',
  canonico: 'catálogo raíz · llave = ContentName exacto', llave: 'pieza_id ¦ PRIN|FUP',
  envios: envios,
  auditoria: {
    envios: envios.length, sends_total: suma, filas_de_la_de: D.count,
    // 🔴 el contrato del bloque (lib-cuadre) exige que la auditoria se compruebe A SI MISMA:
    //    'cuadre_del_diff' tiene que ser igual a 'envios'. Sin este campo, PUERTA-1 lee undefined y
    //    cierra la Puerta 1 diciendo que el cuadre interno esta roto - y tiene razon: un bloque
    //    que no declara su propio cuadre no se puede escribir.
    cuadre_del_diff: envios.length,
    por_contentname: envios.filter(function (e) { return e.cruce === 'contentname'; }).length,
    sin_catalogo: sinPieza, contradicciones_es_fup: contradicciones, mismo_asset: mismoAsset
  },
  columnas_nuevas_del_handoff: ['Es_FUP', 'Email_Subject', 'Journey_ID_Datorama', 'Email_Unique_Unsubs',
    'Email_Total_Unsubs', 'Audience_DE', 'Audience_Volume', 'Piezas_Mismo_Asset'],
  para_el_siguiente: 'el motor toma `fecha` como ancla de la pieza y `email_type` de `Es_FUP`, no del nombre'
};
if (process.argv.indexOf('--escribir') >= 0) {
  fs.writeFileSync(BACK + '/_fuentes/email.json', JSON.stringify(out, null, 1));
  console.log('\n  → _fuentes/email.json  (' + envios.length + ' envíos · Σ ' + mil(suma) + ')');
} else {
  fs.writeFileSync(BACK + '/_fuentes/_email-nuevo.json', JSON.stringify(out, null, 1));
  console.log('\n  (seco) → _fuentes/_email-nuevo.json   ·   para reemplazar el bloque: --escribir');
}
