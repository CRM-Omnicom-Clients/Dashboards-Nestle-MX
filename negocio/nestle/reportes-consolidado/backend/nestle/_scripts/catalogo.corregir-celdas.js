// nestle-catalogo · CORREGIR CELDAS SUELTAS DEL CATÁLOGO, declaradas una por una.
//
// 🔴 POR QUÉ NO SE EDITAN A MANO. Cada corrección aquí es una decisión con un porqué, y el
//    porqué es lo que hace que el corte siguiente no la deshaga. Una celda cambiada a mano en
//    Excel deja el archivo bien y el sistema sin memoria de por qué está bien.
//
// 🔴 SE COMPRUEBA EL VALOR DE PARTIDA. Si la celda ya no dice lo que yo creo, alguien la cambió
//    —Rick edita a mano— y pisarla borraría su decisión. En ese caso NO se escribe: se declara.
//
// 🔴 Y ES IDEMPOTENTE: si ya dice el valor final, se salta. Correr esto dos veces no puede
//    duplicar ni bloquear.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// ══ LAS CORRECCIONES, cada una con su porqué ════════════════════════════════════════
var CORRECCIONES = [
  /* ── 22-sep-2026 · 005-P013 (WA-J9): los cuatro campos que Qcart necesita para atribuir ──
   *
   * 🔴 POR QUÉ NO FUERON EN EL ALTA. Ahí se declaran DIMENSIONES; las métricas y fechas las
   *    llena la cadena. Pero la cadena de Qcart filtra los carritos por la FECHA DE ACTIVACIÓN
   *    del link, y con `Fecha_Primer_Envio` vacía no pasa ninguno: la pieza quedó con 0 carritos
   *    aunque su código `ymh2OT4x` tiene 10 en el bloque. Y sin `Clicks_Medidos`, el bloque de
   *    WhatsApp marca sus clicks como «no medidos». El alta sin estos cuatro campos deja una
   *    pieza que existe pero no puede recibir nada.
   *
   * 🔴 NO SE INFIEREN: LOS DICE LA FUENTE. La hoja «Maggi Liga MX» fecha los dos envíos de J9 el
   *    **19-sep** (serial 46284) — los dos, el de las 4PM y el de las 5PM. El día 19 cae en la
   *    segunda quincena, así que `2026-09-Q2` sale de la regla (día 1-15 = Q1 · 16-fin = Q2), no
   *    de una elección. `Clicks_Medidos = Sí` es el criterio que Rick declaró el 14-sep para todo
   *    WhatsApp con Qcart: «los clicks debes sacarlos de qcart carritos», el mismo que ya tiene
   *    su hermana 005-P011. */
  {
    pieza: '005-P013', columna: 'Fecha_Primer_Envio', de: '', a: '2026-09-19',
    porque: 'la hoja «Maggi Liga MX» de (Interno) Resultados Whatsapp CRM 2026 fecha los DOS envíos de J9 el 19-sep (serial 46284). Sin esta fecha, el filtro de activación de Qcart descarta los 10 carritos del código ymh2OT4x y la pieza queda en cero.'
  },
  {
    pieza: '005-P013', columna: 'Fecha_Ultimo_Envio', de: '', a: '2026-09-19',
    porque: 'los dos envíos (4PM y 5PM) salieron el mismo día, así que el primero y el último coinciden — no es una interpretación, es que solo hubo una fecha.'
  },
  {
    pieza: '005-P013', columna: 'Quincena', de: '', a: '2026-09-Q2',
    porque: 'el 19 de septiembre cae en la segunda quincena por la regla del sistema (día 1-15 = Q1 · 16-fin de mes = Q2). Sale de la fecha, no de una elección.'
  },
  {
    pieza: '005-P013', columna: 'Clicks_Medidos', de: '', a: 'Sí',
    porque: 'Rick, 14-sep-2026: «los clicks debes sacarlos de qcart carritos». En WhatsApp no hay tracking de clicks y el carrito es el único rastro de que el link se tocó; es el mismo criterio que ya lleva su hermana 005-P011 (WA-J8).'
  },

  // ── 10-sep-2026 · TERCER TIEMPO WHATSAPP: LA FECHA DE DESPERTAR 2 ESTABA MAL ───────────────
  // 🔴 El catálogo decía que `008-P008` salió el **19-jun**, la misma fecha que su hermana
  //    `008-P007`. La fuente del cliente, el bloque y la lámina de Twilio que trajo Rick dicen
  //    las tres **30-jun**. Once días de diferencia sobre una pieza que ya estaba «Confirmado».
  //    No mueve la quincena —el 30 sigue siendo 2026-06-Q2— así que ninguna fila del reporte se
  //    desplaza: es una corrección limpia. Que la quincena aguante NO es motivo para dejarlo mal;
  //    es el motivo por el que se puede corregir sin arrastrar nada.
  {
    pieza: '008-P008', columna: 'Fecha_Primer_Envio', de: '2026-06-19', a: '2026-06-30',
    porque: 'DESPERTAR 2 salió el 30/06/2026, no el 19/06. Lo dicen las tres fuentes: la hoja «Tercer Tiempo» de `(Interno) Resultados Whatsapp CRM 2026.xlsx` (serial 46203 = 30-jun), el bloque de WhatsApp (`fecha: 2026-06-30`) y la lámina de TWILIO KPIS REPORT que Rick compartió el 10-sep. El 19-jun es la fecha de DESPERTAR 1 (008-P007): la pieza había heredado la fecha de su hermana.'
  },
  {
    pieza: '008-P008', columna: 'Fecha_Ultimo_Envio', de: 'PENDIENTE', a: '2026-06-30',
    porque: 'la fuente trae UN solo envío para esta pieza, así que el primero y el último son el mismo día. No es una interpretación de «último envío vs cierre de periodo» —la duda abierta de Rick—: con un solo disparo las dos lecturas coinciden.'
  },
  {
    pieza: '008-P007', columna: 'Fecha_Ultimo_Envio', de: 'PENDIENTE', a: '2026-06-19',
    porque: 'mismo caso que 008-P008: un solo envío, 19/06/2026, primero = último.'
  },
  // 🔴 EL MGSC Y LOS JOURNEYS NO TIENEN COLUMNA EN EL CATÁLOGO, Y NO SE INVENTA UNA. En email
  //    esta información vive en `Audiencia_DE SFMC` y en el `Email_Name`; para WhatsApp no hay
  //    equivalente —`Email_Name` es N/A a propósito, porque no es un correo—. Crear dos columnas
  //    para dos piezas sería agregar estructura por un caso; van a `Notas`, que es donde el
  //    catálogo guarda lo que sabe y no tiene casilla. Si mañana WhatsApp crece, se declara la
  //    columna con su contrato y se migran — pero eso es una decisión, no un efecto secundario.
  {
    pieza: '008-P007', columna: 'Notas',
    de: 'utm_content no venía en la fuente · nombrado wa-1 por instrucción',
    a: 'utm_content no venía en la fuente · nombrado wa-1 por instrucción · DESPERTAR 1 · MGSC Mxnescafe_sbmktwhatsapp · journey O_Welcome-NC007067_1_IBS_FOOD_NEST_L60_ANMW_MX_ES_NA_CN_WA_A_V1_948953 · base total de la campaña 17,577 contactos (TWILIO KPIS REPORT, Rick 10-sep-2026)',
    porque: 'la lámina de Twilio trae tres datos que ninguna otra fuente tiene: el nombre del MGSC (la Data Extension de origen), el journey completo y la base total de la campaña. Van a Notas porque el catálogo no tiene columna para ninguno de los tres en el canal WhatsApp.'
  },
  {
    pieza: '008-P008', columna: 'Notas',
    de: 'utm_content no venía en la fuente · nombrado wa-2 por instrucción',
    a: 'utm_content no venía en la fuente · nombrado wa-2 por instrucción · DESPERTAR 2 · MGSC Mxnescafe_sbmktwhatsapp · DOS journeys: …WA_A_V1_948959 y …WA_B_V1_972359 (audiencia 5,000 programada en dos envíos A:2,000 y B:3,000). 🔴 La lámina da los totales COMBINADOS (3,996 enviados), no el reparto A/B: partirlos por regla de tres sería fabricar el dato, así que la pieza es UNA con sus dos journeys. base total de la campaña 17,577 contactos (TWILIO KPIS REPORT, Rick 10-sep-2026)',
    porque: 'mismo caso que 008-P007, más el detalle que importa: DESPERTAR 2 se disparó con DOS journeys (A y B) y la lámina solo reporta el total sumado. Queda escrito que el split no se puede derivar, para que nadie lo intente después.'
  },
  // ── 9-sep-2026 · LIGA MX J7: EL NOMBRE QUE DECLARÓ RICK NO ES EL QUE PUBLICA SFMC ──────────
  // 🔴 Rick declaró `…_ES_LIGAMX-J7_AQ_EM_A_NA_0359270` y la DE publica
  //    `…_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270`. Difieren en el sufijo **-B-C**. Todo cruza por
  //    `Email_Name`, así que con el nombre declarado la pieza NO habría encontrado sus 91,584
  //    envíos: se habría quedado en cero mientras SFMC los publicaba. Su nota decía «entra sola
  //    en la corrida de esta noche» — no habría entrado.
  // 🔴 Es la MISMA pieza, y lo prueban tres cosas que sí coinciden: el ID final **0359270**, el
  //    `Codigo_NC` NC006537 y el touchpoint E-J7 que la propia DE declara.
  // 🔴 SE GUARDAN LOS DOS NOMBRES, no se sustituye uno por otro — mismo patrón que `001-P032`.
  //    El id lógico es inmutable; el nombre físico cambia y puede haber más de uno. Tirar el que
  //    declaró Rick perdería la forma con la que él y el calendario del cliente la nombran.
  {
    pieza: '005-P010', columna: 'Email_Name',
    de: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7_AQ_EM_A_NA_0359270',
    a: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7_AQ_EM_A_NA_0359270 · O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270',
    porque: 'SFMC publica la pieza como `…LIGAMX-J7-B-C…` (ConfigKey TMP-MAGGI-J7-B-C, Email_ID 85487, 91,584 envíos, refresh 9-sep 17:58) y Rick la declaró como `…LIGAMX-J7…`. Mismo ID final 0359270, mismo Codigo_NC, mismo touchpoint E-J7 según la propia DE. Se cargan los DOS nombres separados por «·» —el cruce ya los parte así— para que la pieza encuentre sus envíos sin perder el nombre con el que Rick la declaró.'
  },
  {
    pieza: '005-P010', columna: 'Email_Names_Variantes', de: 'POR DEFINIR',
    a: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270',
    porque: 'el nombre con el que la DE la publica, registrado como variante en vez de sustituir al que declaró Rick.'
  },
  {
    pieza: '005-P010', columna: 'N_Email_Names', de: 'POR DEFINIR', a: '2',
    porque: 'dos nombres físicos para el mismo id lógico.'
  },
  {
    pieza: '005-P010', columna: 'Estado',
    de: '⚠ Por confirmar (segmento «Región unificada» y sends: SFMC aún no publica J7)',
    a: 'Declarado por Rick · segmento confirmado 9-sep',
    porque: 'Rick confirmó el segmento en el chat («J7 región unificada») y SFMC ya publica la pieza, así que las dos razones del «por confirmar» quedaron cerradas. El sends lo llena la cadena desde la DE, no se escribe aquí.'
  },
  {
    pieza: '001-P032', columna: 'Email_Name',
    // 🔴 EL VALOR DE PARTIDA ES EL TRUNCADO QUE YO MISMO ESCRIBÍ HACE UN MOMENTO. La corrida
    //    anterior imprimió el nombre recortado a sus últimos 46 caracteres para que cupiera en
    //    pantalla, y yo tomé ese recorte por el valor. Es el defecto de leer un DISPLAY como si
    //    fuera un DATO — y lo atrapó el cruce, que siguió sin encontrar la pieza.
    de: 'MX_O_EM_FOOD_NC-000600_IBS_3018905 · NF_MX_ES_DE_Audience_RN_AON_E-PROP1_EM_3018905',
    a: 'MX_O_EM_FOOD_NC-000600_IBS_3018905 · O_NC-000600_NA_IBS_FOOD_NEST_L73_ANNF_MX_ES_DE_Audience_RN_AON_E-PROP1_EM_3018905',
    porque: 'SFMC llama a esta pieza `O_NC-000600_NA_IBS_FOOD_NEST_L73_ANNF_MX_ES_DE_Audience_RN_AON_E-PROP1_EM_3018905` y Rick la declaró como `MX_O_EM_FOOD_NC-000600_IBS_3018905`. Son la MISMA pieza: el ID final es 3018905 en las dos, y ése es el ancla. La pieza carga los DOS nombres físicos separados por «·» —el cruce ya los parte así— porque el id lógico es inmutable y el nombre físico no. Sin esto, 157,578 envíos no llegaban al reporte.'
  },
  {
    pieza: '001-P032', columna: 'Email_Names_Variantes',
    de: 'NF_MX_ES_DE_Audience_RN_AON_E-PROP1_EM_3018905',
    a: 'O_NC-000600_NA_IBS_FOOD_NEST_L73_ANNF_MX_ES_DE_Audience_RN_AON_E-PROP1_EM_3018905',
    porque: 'el nombre con el que la DE de SFMC la publica, registrado como variante en vez de sustituir al que declaró Rick.'
  },
  {
    pieza: '001-P032', columna: 'N_Email_Names', de: 'POR DEFINIR', a: '2',
    porque: 'dos nombres físicos para el mismo id lógico.'
  },
  // ══ 3-sep-2026 · LAS TRES DECLARACIONES DE RICK, HOMOLOGADAS ═══════════════════════
  {
    pieza: '001-P032', columna: 'Segmento', de: 'POR DEFINIR', a: 'Tibios',
    porque: 'Rick, 3-sep-2026: «Campaña AON RN · Email E-PROP-1 · SEGMENTO TIBIOS». Era el hueco que quedó al darla de alta: no lo deduje del touchpoint entonces, y ahora lo declara él. La BU se queda en RN: Rick escribió «BU Recetas Nestlé», pero el catálogo usa BU=RN con Marca=Recetas Nestlé en sus otras 85 piezas, y él pidió homologar.'
  },
  {
    pieza: '006-P004', columna: 'TouchPoint', de: 'E-A', a: 'E-ENRICH1',
    porque: 'Rick, 3-sep-2026: «ESTE ES ENRICH 1: O_Nescafé-ICE-NC000817_2_..._V2_024222». SFMC etiquetó esa pieza como E-A* (provisional) y la _3_ como E-ENRICH1 — al revés. Manda la autoridad, no la etiqueta provisional de la DE.'
  },
  {
    pieza: '006-P005', columna: 'TouchPoint', de: 'E-A', a: 'E-ENRICH1',
    porque: 'el FollowUp de 006-P004: comparte content name y CID 024222, así que comparte touchpoint. Moverlo solo dejaría al FUP huérfano de su Principal.'
  },
  {
    pieza: '006-P006', columna: 'TouchPoint', de: 'E-ENRICH1', a: 'E-P1',
    porque: 'Rick, 3-sep-2026: «ESTE E-P1: O_Nescafé-ICE-NC000817_3_..._V3_024243». El 27-ago me había dicho E-ENRICH1 para este mismo content name; hoy lo corrige y aclara cuál es cuál. Gana lo último que declara la autoridad, y queda escrito que cambió para que el guardián de no-pérdida no lo lea como una pérdida.'
  },
  // 🔴 4-sep-2026 · LA PIEZA DE J6 EXISTE Y NO CRUZABA: dos nombres físicos, uno solo cargado.
  {
    pieza: '005-P009', columna: 'Email_Name',
    de: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J6-REGION-SUR_AQ_EM_A_NA_048423',
    a: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J6-REGION-SUR_AQ_EM_A_NA_048423 · O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J6-REGION-SUR_AQ_EM_A_NA_035275',
    porque: 'SFMC publica esta pieza con el nombre terminado en 035275; Rick la declaró con el terminado en 048423 — que es el que la DE trae en `Journey_Name`, no en `EmailName`. Los dos son reales y nombran lo MISMO: mismo journey, mismo Codigo_NC, mismo touchpoint, mismo segmento, 2,735 envíos del 28-ago. Se cargan los dos, igual que en 001-P032, porque el id lógico es inmutable y el nombre físico no. Sin esto, 2,735 envíos no llegaban al reporte. ⚠ Y el ID final NO sirve de llave: `..._J4-CONREGION_..._035275` termina igual y es otra pieza.'
  },
  {
    pieza: '005-P009', columna: 'Email_Names_Variantes', de: 'POR DEFINIR',
    a: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J6-REGION-SUR_AQ_EM_A_NA_035275',
    porque: 'el nombre con el que la DE de SFMC publica la pieza, registrado como variante en vez de sustituir al que declaró Rick.'
  },
  {
    pieza: '005-P009', columna: 'N_Email_Names', de: 'POR DEFINIR', a: '2',
    porque: 'dos nombres físicos para el mismo id lógico.'
  },
  // 🔴 4-sep-2026 · UN ERROR MÍO, ATRAPADO POR EL PROBADOR DE MAPEOS. Al dar de alta 001-P033
  //    escribí «FollowUp» y la hoja lleva «Follow Up» CON ESPACIO en sus otras 33 piezas de FUP.
  //    Nadie lo habría notado: no mueve ninguna suma. Lo vio el probador porque compara la hoja
  //    contra SFMC en las piezas donde los dos ya tienen valor, y ahí salió 1 de 104 discrepando.
  {
    pieza: '001-P033', columna: 'Email_Type', de: 'FollowUp', a: 'Follow Up',
    porque: 'homologación con las otras 33 piezas de FollowUp de la hoja, que escriben «Follow Up» con espacio. Un valor que no empata con su propia columna rompe cualquier filtro o SUMIFS que agrupe por tipo de envío.'
  },
  // 🔴 4-sep-2026 · EL NOMBRE PRESTADO QUE DEJABA A MARZO EN CERO. Detalle arriba, en el
  //    comentario de cabecera de este bloque de correcciones.
  {
    pieza: '001-P025', columna: 'Email_Name',
    de: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_PURCHASE-EP1_AC_EM_A_V1_863587 · J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_TRADITIONAL-PARENTS_AC_EM_A_V1_803867',
    a: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_PURCHASE-EP1_AC_EM_A_V1_863587',
    porque: 'El nombre `…TRADITIONAL-PARENTS_AC_EM_A_V1_803867` NO es de esta pieza: es de 001-P005 (la oleada de MARZO), y SFMC lo publica con ese ConfigKey. Cargarlo aquí hacía que el bloque de email, que cruza por nombre, le entregara a esta pieza los 37,375 del 18-mar que son de 001-P005. Resultado: 001-P005 salía con CERO envíos en el reporte y ésta con la suma de las dos. Se le quita el nombre prestado; conserva el suyo, que es con el que SFMC la publica.'
  },
  {
    pieza: '001-P027', columna: 'Email_Name',
    de: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_FUP-PURCHASE-EP1_AC_EM_A_V1_863587 · J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_TRADITIONAL-PARENTS-FP_AC_EM_A_V1_803867',
    a: 'J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_MULT_MULT_MLT_MLTS_MX_ES_FUP-PURCHASE-EP1_AC_EM_A_V1_863587',
    porque: 'El nombre `…TRADITIONAL-PARENTS-FP_AC_EM_A_V1_803867` NO es de esta pieza: es de 001-P006 (la oleada de MARZO), y SFMC lo publica con ese ConfigKey. Cargarlo aquí hacía que el bloque de email, que cruza por nombre, le entregara a esta pieza los 28,829 del 20-mar que son de 001-P006. Resultado: 001-P006 salía con CERO envíos en el reporte y ésta con la suma de las dos. Se le quita el nombre prestado; conserva el suyo, que es con el que SFMC la publica.'
  },
  // 🔴 4-sep-2026 · EL OBJETIVO DE E-PROP1, que Rick ya había escrito en su hoja.
  {
    pieza: '001-P032', columna: 'Objetivo', de: 'POR DEFINIR', a: 'Usuarios Tibios',
    porque: 'Rick, 4-sep-2026: «porque PROP1 quedó como audiencia POR DEFINIR si ya te había dicho». El valor sale de SU PROPIA fila del reporte, que ya dice «Usuarios Tibios» — no lo deduje del touchpoint, que es lo que estaba prohibido. Y no es cosmético: la llave del reporte lleva el objetivo, así que con POR DEFINIR la celda de la rejilla no casaba con su fila y el regenerador iba a crear una fila DUPLICADA de E-PROP1, dejando la suya con FUP_Sends = 0.'
  },
  {
    pieza: '001-P033', columna: 'Objetivo', de: 'POR DEFINIR', a: 'Usuarios Tibios',
    porque: 'el FollowUp comparte objetivo con su Principal 001-P032 por construcción: es el mismo journey. Sin esto, el FUP cae en otra celda de la rejilla que su Principal.'
  },
  // 🔴 7-sep-2026 · EL ÚLTIMO OBJETIVO QUE FALTABA EN TODO EL CATÁLOGO. Al dar de alta esta
  //    pieza lo dejé en POR DEFINIR a propósito: deducir «Purchase» de que el touchpoint sea
  //    E-P1 habría sido inferir del naming (R1), que es lo que el catálogo prohíbe. Rick lo
  //    declara hoy, y con esto `Objetivo` queda en 138 de 138.
  {
    pieza: '006-P006', columna: 'Objetivo', de: 'POR DEFINIR', a: 'Purchase',
    porque: 'Rick, 7-sep-2026: «Objetivo: Purchase de The Freshers». Es la autoridad declarándolo, no una deducción del touchpoint.'
  },

  // ── 14-sep-2026 · JORNADA 8 DE EMAIL: SFMC YA LA PUBLICÓ, Y CON EL NOMBRE DE LA J7 ──────────
  // 🔴 EL NOMBRE FÍSICO DE J8 ES EL DE J7 MÁS UN SUFIJO. Operación reusó el asset: la DE publica
  //    `…LIGAMX-J7-B-C…_0359270 - 202609` para la Jornada 8, mientras el `Journey_Name` sí dice
  //    `…LALIGA-J8-SAB…_069127`. Rick lo avisó ANTES de que llegara el dato («ese es el nombre
  //    real del J8, se equivocaron») y el volcado lo confirma.
  //    Y por eso mismo pidió: «cataloga bien, no te confundas: una cosa es email name y otra
  //    journey name». Se guardan LOS DOS, igual que en `005-P010`: el journey name con el que
  //    Rick y el calendario del cliente la nombran, y el email name con el que la DE la publica.
  // 🔴 LA COLISIÓN, Y POR QUÉ NO EXPLOTA: el nombre de J8 CONTIENE al de J7 (es el mismo string
  //    más « - 202609»). Cualquier emparejamiento por substring metería los 38,171 envíos de J8
  //    en J7. No pasa porque `fuentes-email.email-piezas.js` cruza por diccionario EXACTO
  //    (`porCN[cn]`), partiendo por «·». Queda escrito aquí para que nadie lo «optimice» a un
  //    indexOf más adelante.
  {
    pieza: '005-P012', columna: 'Email_Name',
    de: 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J8-SAB_CN_EM_A_V1_069127',
    a: 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J8-SAB_CN_EM_A_V1_069127 · O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609',
    porque: 'SFMC publicó J8 el 14-sep 18:45 bajo ConfigKey TMP-MAGGI-J8 · Email_ID 85752 · 38,171 envíos · 4 jobs (3 pruebas del 11-sep + el envío real del 12-sep con 38,168). Su `EmailName` es el de J7 con el sufijo « - 202609»; su `Journey_Name` sí dice LALIGA-J8-SAB…069127. Se cargan los DOS nombres separados por «·» para que la pieza encuentre sus envíos sin perder el nombre con el que Rick la declaró. El cruce es EXACTO, así que el nombre de J7 (sin sufijo) sigue apuntando solo a 005-P010.'
  },
  {
    pieza: '005-P012', columna: 'Email_Names_Variantes', de: 'POR DEFINIR',
    a: 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609',
    porque: 'el nombre con el que la DE publica J8, registrado como variante en vez de sustituir al journey name que declaró Rick.'
  },
  {
    pieza: '005-P012', columna: 'N_Email_Names', de: 'POR DEFINIR', a: '2',
    porque: 'dos nombres físicos para el mismo id lógico: el journey name y el email name de SFMC.'
  },
  {
    pieza: '005-P012', columna: 'Email_ID (de la DE de SFMC)', de: 'POR DEFINIR', a: '85752',
    porque: 'lo publica la DE `CRM_Email_Piezas` para TMP-MAGGI-J8, y el detalle lo repite en sus 4 jobs. Es distinto del 85487 de J7: aunque compartan el nombre, son dos assets.'
  },
  {
    pieza: '005-P012', columna: 'Subject', de: 'POR DEFINIR', a: 'Un clásico delicioso en tu mesa',
    porque: 'el asunto del job real (1306387, 12-sep). Los 3 jobs de prueba llevan «[Test J8]: » delante; el prefijo es del correo de prueba, no del envío.'
  },
  {
    pieza: '005-P012', columna: 'Tipo_Envio', de: 'POR DEFINIR', a: 'Principal',
    porque: 'SFMC declara `Es_FUP = No` en la agregada y en los 4 jobs. Es el campo declarado, no una lectura del nombre (que cada campaña escribe distinto).'
  },
  // 🔴 ESTA NO LLENA UN HUECO: CORRIGE UN VALOR QUE YO PUSE MAL. El 14-sep escribí Q2 razonando
  //    que «el maestro activa sus dos links el 15/09». Dos cosas fallaban ahí: **el día 15 es Q1**
  //    (la regla es 1–15 = Q1 · 16–fin = Q2, en `lib-quincena`), así que ni con esa fecha salía Q2;
  //    y además el maestro ya no dice 15 — Rick corrigió el archivo («me equivoqué en las fechas,
  //    es a partir del 12 de sept»). Hoy las TRES fuentes dicen 12-sep: el detalle de SFMC (job
  //    real 1306387), el maestro (0oSrtaxX y 0eQt7uf5, activación 2026-09-12) y su gemela de
  //    WhatsApp `005-P011`, que ya estaba en Q1.
  //    NO es cosmético: la llave de la fila del reporte LLEVA la quincena. Con Q2, los 38,171
  //    envíos de email abrirían una fila aparte de la que ya reciben sus carritos del 12-sep.
  {
    pieza: '005-P012', columna: 'Quincena', de: '2026-09-Q2', a: '2026-09-Q1',
    porque: 'el envío real de J8 fue el 12-sep (job 1306387 del detalle de SFMC), y día 1–15 = Q1. Las otras dos fuentes coinciden: el maestro de Qcart activa 0oSrtaxX y 0eQt7uf5 el 2026-09-12, y su gemela de WhatsApp 005-P011 ya estaba en 2026-09-Q1. El Q2 que yo había escrito venía de una nota del maestro anterior a la corrección de Rick, y encima el 15 tampoco es Q2.'
  },
  {
    pieza: '005-P012', columna: 'Estado',
    de: '⚠ Por confirmar (sends: SFMC aún no publica J8)',
    a: 'Confirmado · SFMC publicó J8 el 14-sep-2026',
    porque: 'la única razón del «por confirmar» era que SFMC no publicaba la pieza. Ya la publica (TMP-MAGGI-J8, refresh 14-sep 18:45). Los sends los llena la cadena desde la DE, no se escriben aquí.'
  },
  {
    pieza: '005-P012', columna: 'Notas',
    de: 'Alta declarada por Rick el 14-sep-2026. SFMC NO publica esta pieza todavía: comprobado por DOS vías el 14-sep — por nombre (LALIGA-J8 → 0 filas) y por el ID final 069127 (→ 0 filas). La doble búsqueda viene de la lección de J7, que SFMC publicó con el sufijo -B-C y por nombre no aparecía. Sends POR DEFINIR, no 0. QUINCENA 2026-09-Q2 porque el maestro activa sus dos links el 15/09, mientras su hermana de WhatsApp (005-P011) activó el 12/09 y cae en Q1: mismo «J8» para el negocio, dos periodos para el reporte. Qcart por SHORTLINK: e-j8/regionunificada-part-a → 0oSrtaxX (Nachos con carne) y 0eQt7uf5 (Sarten Queso Jalapeño).',
    a: 'Alta declarada por Rick el 14-sep-2026; SFMC la publicó ese mismo día a las 18:45 y con esto queda cerrada. NOMBRE: la DE publica J8 bajo el EmailName de J7 más el sufijo « - 202609» (operación reusó el asset) mientras el Journey_Name sí dice LALIGA-J8-SAB…069127 — Rick lo avisó antes de que llegara el dato. Se guardan los dos nombres; el cruce de email es por diccionario EXACTO, así que el nombre de J7 sigue apuntando solo a 005-P010. DATOS: ConfigKey TMP-MAGGI-J8 · Email_ID 85752 · 4 jobs = 3 pruebas del 11-sep (1 envío cada una, las descuenta la cadena) + el envío real del 12-sep con 38,168. QUINCENA corregida de Q2 a Q1 el 14-sep: el envío real fue el 12 y día 1–15 es Q1; el Q2 anterior venía de una nota del maestro previa a la corrección de fechas de Rick. Qcart por SHORTLINK: e-j8/regionunificada-part-a → 0oSrtaxX (Nachos con carne) y 0eQt7uf5 (Sarten Queso Jalapeño), ambos activos desde el 12-sep.',
    porque: 'la nota anterior decía dos cosas que hoy son falsas —«SFMC NO publica esta pieza todavía» y la justificación del Q2— y una nota falsa es peor que ninguna: el corte siguiente la lee como si fuera el estado. Se reescribe con lo que quedó comprobado, conservando lo que sigue siendo cierto (el alta de Rick y los dos shortlinks).'
  },

  // ── 14-sep-2026 · WA-J8: EL PERIODO SALE DE SU PROPIO DATO, NO DE UNA HERMANA ───────────────
  // 🔴 `005-P011` era la ÚNICA pieza de WhatsApp con `Sends` en POR DEFINIR: las otras 17 tienen
  //    exactamente lo que dice su bloque, y el bloque de ésta dice 1,962. No es una deducción —
  //    es la misma fuente que ya alimenta a sus 17 hermanas.
  // 🔴 Y LAS COLUMNAS DE PERIODO NO SE HEREDAN. Las hermanas de WhatsApp ni siquiera están
  //    homologadas entre ellas (`006-P003` las tiene todas en PENDIENTE, `004-P019` la mitad), así
  //    que copiar de una habría sido elegir a cuál parecerse. Salen del dato PROPIO de la pieza:
  //    su `Fecha_Primer_Envio` y su `Fecha_Ultimo_Envio` son las dos 2026-09-12 → un solo día, una
  //    sola quincena (12 ≤ 15 → Q1), un solo mes, y los 1,962 envíos caen enteros ahí.
  //    `N_Envios_Fechados` se queda en POR DEFINIR a propósito: sus hermanas dicen 0 y no tengo
  //    cómo comprobar qué significa ese 0 aquí. Un valor copiado sin entenderlo no es un dato.
  {
    pieza: '005-P011', columna: 'Sends', de: 'POR DEFINIR', a: '1962',
    porque: 'lo dice el bloque de WhatsApp para esta pieza (sus dos journeys: …LALIGA-JORNADA-4PM…065900 y …065901). Las otras 17 piezas de WhatsApp tienen en esta columna exactamente lo que dice su bloque — 17 de 17 comprobado el 14-sep — así que ésta era la única fuera de la regla.'
  },
  {
    pieza: '005-P011', columna: 'Quincenas_Activas', de: 'POR DEFINIR', a: '2026-09-Q1',
    porque: 'su único día de envío es el 2026-09-12 y día 1–15 = Q1 (lib-quincena). Coincide con su columna `Quincena`, que ya decía Q1.'
  },
  {
    pieza: '005-P011', columna: 'N_Quincenas', de: 'POR DEFINIR', a: '1',
    porque: 'una sola quincena activa.'
  },
  {
    pieza: '005-P011', columna: 'Meses_Activos', de: 'POR DEFINIR', a: '2026-09',
    porque: 'su único día de envío es el 2026-09-12.'
  },
  {
    pieza: '005-P011', columna: 'N_Meses', de: 'POR DEFINIR', a: '1',
    porque: 'un solo mes activo.'
  },
  {
    pieza: '005-P011', columna: 'Sends_Por_Quincena', de: 'POR DEFINIR', a: '2026-09-Q1:1962',
    porque: 'la regla del catálogo es que `Sends_Por_Quincena` SUME `Sends`. Con un solo día de envío, los 1,962 caen enteros en 2026-09-Q1.'
  },
  {
    pieza: '005-P011', columna: 'Sends_Por_Mes', de: 'POR DEFINIR', a: '2026-09:1962',
    porque: 'mismo caso: un solo mes, los 1,962 completos.'
  },
  {
    pieza: '005-P011', columna: 'Dias_Envio', de: 'POR DEFINIR', a: '1',
    porque: '`Fecha_Primer_Envio` y `Fecha_Ultimo_Envio` son las dos 2026-09-12.'
  },
  {
    pieza: '005-P011', columna: 'Granularidad_Periodo', de: 'POR DEFINIR', a: 'dia',
    porque: 'la fuente del cliente da el envío fechado al día (12/09), no agregado al mes. Es el mismo valor que `008-P008`, que también viene fechada al día; `004-P019` dice «mes» porque su fuente solo da el mes.'
  },
  {
    pieza: '005-P011', columna: 'Fecha_Origen', de: 'POR DEFINIR',
    a: 'hoja «Maggi Liga MX» de (Interno) Resultados Whatsapp CRM 2026.xlsx · fechado al día',
    porque: 'de dónde salió la fecha, para que el corte siguiente no tenga que averiguarlo. La hoja es la que Rick compartió el 14-sep.'
  },
  {
    pieza: '005-P011', columna: 'Tipo_Envio', de: 'POR DEFINIR', a: 'one-shot',
    porque: 'es un disparo único, no una serie: un solo día, sin FUP. Es el valor que ya usan las otras piezas de WhatsApp con la misma forma (008-P008, 004-P019).'
  },

  // ── 15-sep-2026 · MUNDIAL E-P2 MODERN COOKING: EL ENVÍO NUNCA SALIÓ ────────────────────────
  // 🔴 RICK: «ya recordé, nunca salió, esos carritos no deben de contar, hay que marcarlo de
  //    alguna manera». Esto es el marcado.
  //    La pieza nació el 27-ago de una lectura del maestro: junio declaraba los links del bloque
  //    `e-cooking2 · new-cooking` y de ahí se dedujo que debía existir un correo. Los links sí
  //    existieron y recibieron 49 carritos; el correo, no. Comprobado contra SFMC el 15-sep: de
  //    Mundial E-P2 la DE publica DOS piezas —Bebidas (14,117) y Botana (75,518)— y ninguna de
  //    Modern Cooking.
  // 🔴 NO SE BORRA LA FILA, y es a propósito. Sus 4 shortlinks son reales y están en el maestro;
  //    la fila es el registro de que se declararon links para un envío que no ocurrió. Borrarla
  //    haría que el próximo que lea el maestro de junio vuelva a deducir la misma pieza.
  //    Lo que se retira es el TRÁFICO: los 49 carritos y 4 productos salieron del bloque, sus 4
  //    links quedaron declarados en `_contratos/exclusiones.json`, y los eventos apartados —no
  //    borrados— en `_fuentes/qcart-excluidos.json`. La celda del reporte desapareció sola.
  {
    pieza: '004-P020', columna: 'Estado',
    de: '⚠ Por confirmar (Email_Name)',
    a: 'Retirada · el envío nunca salió (Rick, 15-sep-2026) — sus carritos NO cuentan',
    porque: 'el «por confirmar» esperaba un Email_Name que no va a llegar: ese correo nunca se envió. Dejarlo en «por confirmar» mantendría abierta una espera imposible y, peor, sugeriría que sus 49 carritos siguen siendo atribuibles.'
  },
  {
    pieza: '004-P020', columna: 'Tiene_Qcart', de: 'Sí', a: 'No',
    porque: 'sus 4 shortlinks existen en el maestro, pero su tráfico quedó declarado fuera: sin envío no hay atribución. Con `Tiene_Qcart = No`, las columnas de carritos y códigos pasan a `N/A` por la regla del skill —no aplica— en vez de quedar como huecos que alguien intente llenar.'
  },
  {
    pieza: '004-P020', columna: 'Carritos_Total', de: '49', a: '0',
    porque: 'los 49 salieron del bloque el 15-sep. Dejar el 49 aquí haría que el catálogo contradiga al bloque y a la rejilla, y la Puerta 1 cerraría con razón.'
  },
  {
    pieza: '004-P020', columna: 'Views_Total', de: '59', a: '0',
    porque: 'mismo caso que los carritos: el tráfico quedó declarado fuera.'
  },
  {
    pieza: '004-P020', columna: 'Carritos_Chedraui_2', de: '11', a: '0',
    porque: 'los 11 carritos de 3NIh2kYW quedaron declarados fuera (el envío nunca salió).'
  },
  {
    pieza: '004-P020', columna: 'Carritos_Walmart_3', de: '12', a: '0',
    porque: 'los carritos de ZJ3SmPMy quedaron declarados fuera (el envío nunca salió).'
  },
  {
    pieza: '004-P020', columna: 'Carritos_Chedraui_4', de: '5', a: '0',
    porque: 'los carritos de wdvsBDby quedaron declarados fuera (el envío nunca salió).'
  },
  {
    pieza: '004-P020', columna: 'Notas',
    de: 'Alta derivada del doc de links el 27-ago-2026, no declarada por Rick. El bloque `e-cooking2 · new-cooking` de junio tiene 3 shortlinks (3NIh2kYW · ZJ3SmPMy · wdvsBDby, 49 carritos) que hoy cuelgan de 004-P004 (E-P2 · Bebidas). Objetivo y quincena heredados de sus hermanas de E-P2 (004-P004/P005). FALTA su Email_Name: hasta que llegue de SFMC, esta pieza no cruza con el bloque de email.',
    a: 'EL ENVÍO NUNCA SALIÓ — Rick lo confirmó el 15-sep-2026: «ya recordé, nunca salió, esos carritos no deben de contar». La pieza nació el 27-ago de una lectura del maestro: junio declaraba los links del bloque `e-cooking2 · new-cooking` y de ahí se dedujo un correo que no existe. Comprobado contra SFMC el 15-sep: de Mundial E-P2 la DE publica solo Bebidas (14,117 envíos) y Botana (75,518); ninguna de Modern Cooking. SUS DATOS: los 4 shortlinks (LJQsq5T9 · 3NIh2kYW · ZJ3SmPMy · wdvsBDby) quedaron declarados en `_contratos/exclusiones.json`, y sus 49 carritos y 4 productos apartados —no borrados— en `_fuentes/qcart-excluidos.json`. Si algún día se demuestra que sí salió, se devuelven. LA FILA SE CONSERVA a propósito: es el registro de que se declararon links para un envío que no ocurrió; borrarla haría que el próximo que lea el maestro de junio vuelva a deducir la misma pieza.',
    porque: 'la nota anterior decía dos cosas que hoy son falsas: que los 49 carritos «cuelgan de 004-P004» (ya no cuelgan de ninguna pieza) y que «falta su Email_Name hasta que llegue de SFMC» (no va a llegar). Una nota falsa es peor que ninguna: el corte siguiente la lee como si fuera el estado.'
  },

  /* ── 29-sep-2026 · 005-P015 (E-J10): sus dos shortlinks, ahora que el maestro los declara ──
   *
   * 🔴 POR QUÉ NO FUERON EN EL ALTA, Y POR QUÉ ESO ESTUVO BIEN. Cuando di de alta la pieza (esa
   *    misma tarde) el maestro **no traía todavía** el bloque de J10: sus dos códigos no existían
   *    por ningún lado. Puse `Tiene_Qcart = POR DEFINIR` en vez de deducirlos del tráfico, que es
   *    lo que habría hecho el sistema viejo — y habría sido inventar la autoridad a partir del
   *    dato que la autoridad debe explicar. Rick actualizó el maestro a las 17:44 y ahora sí hay
   *    de dónde leerlos.
   *
   * 🔴 SALEN DEL MAESTRO, POR SHORTLINK (R2). Hoja «Septiembre», filas 13 y 14:
   *    `kzSTHGEd` (Dips Botaneros) y `jhMxJiSo` (Pepimiche), bloque `e-j10` ·
   *    `regionunificada-part-c-email`, **Fecha de envío 25-sep** (serial 46290). No se leen del
   *    utm del CSV: el utm es lo que hay que atribuir, no la autoridad que atribuye.
   *
   * 🔴 SIN ESTOS CUATRO CAMPOS, `cerrar-qcart` LA MARCABA `Tiene_Qcart = No`. Su regla R1 es «sin
   *    bloque en el maestro Y sin códigos propios → No», y ancla por los `Cod_*` de la propia
   *    fila. Una pieza que sí lleva carrito habría quedado declarada como que no lo lleva, y sus
   *    carritos sin dueño. Se vio corriendo el paso en seco y mirando la lista, no al escribir.
   *
   * ⚠ LA VENTANA VA A DESCARTAR 25 DE SUS 39 CARRITOS, y es correcto: el tráfico de `e-j10` del
   *    22, 23 y 24-sep es ANTERIOR a la activación del 25. Entran los 14 del 25 en adelante. Los
   *    25 descartados quedan declarados por el filtro con su motivo, no desaparecen. */
  {
    pieza: '005-P015', columna: 'Tiene_Qcart', de: 'POR DEFINIR', a: 'Sí',
    porque: 'el maestro de links (hoja «Septiembre», actualizado el 29-sep 17:44) declara el bloque e-j10 con dos shortlinks. Cuando se dio el alta ese bloque todavía no existía, por eso quedó POR DEFINIR en vez de deducido.'
  },
  {
    pieza: '005-P015', columna: 'N_Recetas', de: 'POR DEFINIR', a: '2',
    porque: 'el maestro declara DOS recetas para e-j10: «Dips Botaneros» (kzSTHGEd) y «Pepimiche» (jhMxJiSo). El número sale de contar las filas del bloque en el maestro, no del tráfico.'
  },
  {
    pieza: '005-P015', columna: 'Cod_Walmart_1', de: '', a: 'kzSTHGEd',
    porque: 'maestro, hoja «Septiembre» fila 13: Maggi-LigaMx-sep26 · e-j10 · regionunificada-part-c-email · receta «Dips Botaneros» · retailer Walmart · fecha de envío 25-sep. Sin este código, cerrar-qcart no encuentra bloque y marca la pieza como que NO lleva Qcart.'
  },
  {
    pieza: '005-P015', columna: 'Cod_Walmart_2', de: '', a: 'jhMxJiSo',
    porque: 'maestro, hoja «Septiembre» fila 14: mismo bloque e-j10, receta «Pepimiche», retailer Walmart, misma fecha de envío. Es el segundo de las dos recetas que el maestro declara para esta jornada.'
  },

  /* ── 29-sep-2026 · 005-P015: su nota afirmaba dos cosas que hoy son falsas ──
   *
   * 🔴 LO QUE YO INFERÍ Y LA AUTORIDAD DESMINTIÓ. Cuando di el alta, el maestro no traía el bloque
   *    de J10 y había 21 carritos de `e-j10` fechados 22-23 sep, tres días ANTES del envío de
   *    email del 26. De ahí concluí que eran de la J10 de **WhatsApp**. Razonable, y **falso**:
   *    el maestro actualizado declara `e-j10` para email con fecha 25-sep, y a la J10 de WhatsApp
   *    le da SU PROPIO shortlink —`uCV8KGHm`, `utm_content = wa-j10`— que hoy cuelga de
   *    `005-P016`. Los 22-23 sep eran tráfico de email anterior a su activación, nada más.
   *    **Deduje el canal del parecido de las fechas; la autoridad lo resolvió distinto.** */
  {
    pieza: '005-P015', columna: 'Notas',
    de: 'Alta del 29-sep-2026 a petición de Rick. SFMC (DE CRM_Email_Detalle, job 1316469 del 26-sep): 39,735 envíos · 39,355 entregados · 16,006 aperturas · 102 clicks · 380 rebotes · 29 bajas. Asunto «Tu alineación para hoy: fútbol + algo deli» (Email_ID 86203). 🔴 Los 39,738 de la DE agregada incluyen TRES jobs de prueba de 1 envío (24 y 25-sep), y por eso su Fecha_Primer_Envio dice 24-sep en vez del 26 real. 🔴 En la DE su ConfigKey es el provisional `TMP-MAGGI-J10` y su PiezaID viene «*por definir», igual que pasó con J9. El SEGMENTO «Región unificada» no se dedujo del naming: coincide en las 5 piezas de Liga MX desde J7 y el utm_term del tráfico dice literalmente «regionunificada-part-c-email». El OBJETIVO se hereda de la campaña. 🔴 QCART SIN RESOLVER A PROPÓSITO: los 2 shortlinks con utm e-j10 (kzSTHGEd «Dips Botaneros», jhMxJiSo «Pepimiche», 21 carritos) NO están en el maestro y su tráfico es del 22-23 sep, tres días antes de este envío — apuntan a la J10 de WhatsApp (089419), que aún no publica métricas.',
    a: 'Alta del 29-sep-2026 a petición de Rick. SFMC (DE CRM_Email_Detalle, job 1316469 del 26-sep): 39,735 envíos · 39,355 entregados · 16,006 aperturas · 102 clicks · 380 rebotes · 29 bajas. Asunto «Tu alineación para hoy: fútbol + algo deli» (Email_ID 86203). 🔴 Los 39,738 de la DE agregada incluyen TRES jobs de prueba de 1 envío (24 y 25-sep), y por eso su Fecha_Primer_Envio dice 24-sep en vez del 26 real. 🔴 En la DE su ConfigKey es el provisional `TMP-MAGGI-J10` y su PiezaID viene «*por definir», igual que pasó con J9. El SEGMENTO «Región unificada» no se dedujo del naming: coincide en las 5 piezas de Liga MX desde J7 y el utm_term del tráfico dice literalmente «regionunificada-part-c-email». El OBJETIVO se hereda de la campaña. QCART: el maestro actualizado el 29-sep declara sus dos shortlinks kzSTHGEd («Dips Botaneros») y jhMxJiSo («Pepimiche»), bloque e-j10, fecha de envío 25-sep. De sus 39 carritos entran 14 (del 25-sep en adelante) y se descartan 25 por ser anteriores a la activación — declarados por el filtro, no borrados. Su hermana de WhatsApp es 005-P016 (WA-J10), con su propio shortlink uCV8KGHm.',
    porque: 'la nota decía que esos 2 shortlinks NO estaban en el maestro y que apuntaban a la J10 de WhatsApp. Las dos cosas dejaron de ser ciertas el mismo día: el maestro los declara para e-j10 (email) con fecha 25-sep, y la J10 de WhatsApp tiene su propio shortlink uCV8KGHm, que ahora cuelga de 005-P016. Una nota falsa es peor que ninguna: el corte siguiente la lee como si fuera el estado.'
  },

  /* ── 30-sep-2026 · 005-P016 (WA-J10): la fuente llegó y trae TRES envíos, no uno ──
   *
   * 🔴 TRES ENVÍOS, DOS JOURNEY IDs. La hoja «Maggi Liga MX» publica J10 así:
   *      · `…LALIGA-J10-JUE_CN_WA_A_V1_089419`      24-sep (serial 46289)    628 enviados
   *      · `…LALIGA-J10-SAB-12PM_CN_WA_A_V1_089420` 26-sep (serial 46291)  1,085 enviados
   *      · `…LALIGA-J10-SAB-2PM_CN_WA_A_V1_089420`  26-sep (serial 46291)  1,085 enviados
   *    El canónico de la pieza es el JUE, que es el nombre que declaró Rick. Los dos SAB llevan
   *    OTRO id final (089420, el mismo del email J10), así que sin declararlos como variantes el
   *    bloque solo encontraría 628 de los 2,798 enviados.
   *
   * 🔴 VAN EN UNA SOLA PIEZA, Y NO LO DECIDO YO — LO DICEN DOS AUTORIDADES. La hoja de Leslie los
   *    agrupa bajo el encabezado «J10» con UN solo TOTAL (2,798), y el maestro de links declara UN
   *    solo shortlink para `wa-j10` (`uCV8KGHm`): un shortlink, una pieza, que es la regla R2. Y es
   *    exactamente como están J8 y J9 — `005-P011` y `005-P013` cubren dos envíos cada una con el
   *    segundo nombre en variantes. La diferencia es que aquí los envíos son de días distintos
   *    (24 y 26) en vez de horas del mismo día; si Rick prefiere separarlos en dos piezas, esto es
   *    lo que habría que deshacer, y por eso queda dicho.
   *
   * 🔴 Y CIERRA LA PREGUNTA DE LAS FECHAS. La activación de `uCV8KGHm` en el maestro es el 24-sep,
   *    y ahora la fuente confirma que el PRIMER envío fue el 24-sep. O sea que la ventana estaba
   *    bien puesta y los 13 carritos de `wa-j10` del 22-23 sep sí son anteriores a todo envío. No
   *    había que re-basar nada. */
  {
    pieza: '005-P016', columna: 'Whatsapp_Names_Variantes', de: 'POR DEFINIR',
    a: 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-12PM_CN_WA_A_V1_089420 · O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-2PM_CN_WA_A_V1_089420',
    porque: 'la hoja «Maggi Liga MX» publica J10 en TRES envíos: el JUE del 24-sep (628, el canónico) y dos SAB del 26-sep (1,085 cada uno) que llevan otro id final. Sin las variantes el bloque encontraría 628 de los 2,798 enviados que la propia hoja totaliza.'
  },
  {
    pieza: '005-P016', columna: 'Fecha_Ultimo_Envio', de: '2026-09-24', a: '2026-09-26',
    porque: 'al dar el alta solo se conocía el envío del 24-sep (por el maestro de links). La fuente de WhatsApp llegó el 30-sep y publica dos envíos más, los dos del 26-sep (serial 46291). El primero sigue siendo el 24; el último es el 26. Las dos fechas caen en 2026-09-Q2, así que la quincena no se mueve.'
  }
];

DECL.declarar('nestle-catalogo', 'catalogo.corregir-celdas.js', [{
  hoja: 'Catalogo_Piezas',
  grano: 'una CELDA — pieza × columna',
  llave: 'Pieza_ID + nombre de columna',
  celdas_esperadas: CORRECCIONES.length + ' celda(s), cada una con su valor de partida comprobado'
}]);

console.log('════════ nestle-catalogo · CORREGIR CELDAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_celdas.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var colIdx = {}; enc.forEach(function (h, i) { if (h) colIdx[h] = i; });
var nmPieza = COL.de(P, 'Pieza_ID');
/* 🔴 LA FILA SE BUSCA EN LA HOJA, NO SE CALCULA DEL ÍNDICE (22-sep-2026).
 *    Esto decía `filaDe[id] = i + 2`, que solo es cierto si las filas del XML son CONTIGUAS.
 *    En `Catalogo_Piezas` no lo son: tiene 138 filas que llegan hasta la 155, con huecos. Así
 *    que `005-P013` —fila REAL 155— se calculaba como 138, una fila que ni siquiera existe:
 *    `poner()` devolvía `sin fila`, no escribía nada, y las 5 capas pasaban en verde sobre un
 *    archivo sin el cambio. Lo destapó el propio re-leído («4 no quedaron»), no las capas.
 *    Es el mismo error que ya mintió con el reporte de WhatsApp: leer por índice de array en
 *    vez de por número de fila real. */
var filaDe = {}, idxDe = {};
P.forEach(function (p0, i) { var id = t(p0[nmPieza]); if (id && idxDe[id] === undefined) idxDe[id] = i; });
(function () {
  var hoja = wb.Sheets['Catalogo_Piezas'];
  var R = XLSX.utils.decode_range(hoja['!ref']);
  var colID = null;
  for (var c = R.s.c; c <= R.e.c; c++) {
    var h = hoja[XLSX.utils.encode_cell({ r: 0, c: c })];
    if (h && t(h.v) === nmPieza) { colID = XLSX.utils.encode_col(c); break; }
  }
  if (!colID) throw new Error('no encuentro la columna «' + nmPieza + '» en la hoja');
  for (var r = 2; r <= R.e.r + 1; r++) {
    var cel = hoja[colID + r];
    var id = cel ? t(cel.v) : '';
    if (id && filaDe[id] === undefined) filaDe[id] = r;
  }
})();
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + P.length + ' piezas\n');

var plan = [], ya = [], bloqueadas = [];
CORRECCIONES.forEach(function (c) {
  var f = filaDe[c.pieza];
  if (!f) { bloqueadas.push({ c: c, motivo: 'la pieza no existe' }); return; }
  if (colIdx[c.columna] === undefined) { bloqueadas.push({ c: c, motivo: 'la columna no existe en la hoja' }); return; }
  /* 🔴 DOS COSAS DISTINTAS: el ÍNDICE en el array para LEER, la FILA real para ESCRIBIR.
   *    `P` viene de `sheet_to_json`, que compacta: su posición 0 es la primera fila con datos,
   *    aunque en el XML esa fila sea la 7. Antes se usaba `f - 2` para las dos cosas y funcionaba
   *    solo mientras las filas fueran contiguas — dejó de serlo, y `P[153]` es `undefined`. */
  var idx = idxDe[c.pieza];
  if (idx === undefined) { bloqueadas.push({ c: c, motivo: 'la pieza no está en las filas leídas' }); return; }
  var actual = t(P[idx][c.columna]);
  if (actual === t(c.a)) { ya.push(c); return; }
  if (actual !== t(c.de)) { bloqueadas.push({ c: c, motivo: 'dice «' + actual.slice(0, 50) + '», yo esperaba «' + t(c.de).slice(0, 50) + '»' }); return; }
  plan.push({ c: c, fila: f });
});

console.log('  ── el plan');
plan.forEach(function (x) {
  console.log('     🔧 ' + x.c.pieza + ' · ' + x.c.columna + '   fila ' + x.fila);
  console.log('          de: «' + t(x.c.de).slice(0, 78) + '»');
  console.log('          a : «' + t(x.c.a).slice(0, 78) + '»');
  console.log('          ' + x.c.porque.slice(0, 150));
});
ya.forEach(function (c) { console.log('     ✔ ' + c.pieza + ' · ' + c.columna + ' ya dice lo que debe'); });
bloqueadas.forEach(function (b) { console.log('     🔴 ' + b.c.pieza + ' · ' + b.c.columna + ' — ' + b.motivo + ' · NO se toca'); });

if (!plan.length) { console.log('\n  ✅ nada que escribir.'); process.exit(bloqueadas.length ? 1 : 0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-celdas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="Catalogo_Piezas"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);
plan.forEach(function (x) {
  var ref = col(colIdx[x.c.columna]) + x.fila;
  xml = CX.poner(xml, ref, CX.celda(ref, x.c.a, CX.estiloDe(xml, ref)), x.fila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + plan.length + ' celda(s)');

// ══ LAS CINCO CAPAS (R7) ════════════════════════════════════════════════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(r).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 70));
    return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 70)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER (E4) ═════════════════════════════════════════════════════════════════════
console.log('\n  ── releído del disco');
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nm2 = COL.de(P2, 'Pieza_ID');
var fallos = 0;
plan.forEach(function (x) {
  var p = P2.filter(function (r) { return t(r[nm2]) === x.c.pieza; })[0];
  var ok = p && t(p[x.c.columna]) === t(x.c.a);
  console.log('     ' + (ok ? '✔ ' : '🔴 ') + x.c.pieza + ' · ' + x.c.columna + ' = «' + (p ? t(p[x.c.columna]).slice(0, 62) : '?') + '»');
  if (!ok) fallos++;
});
console.log('     piezas: ' + P.length + ' → ' + P2.length + (P.length === P2.length ? '  ✔ ninguna se movió' : '  🔴 CAMBIÓ'));
if (P.length !== P2.length) fallos++;
console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' no quedaron' : '✅ CELDAS CORREGIDAS, verificadas contra el disco'));
process.exit(fallos ? 1 : 0);
