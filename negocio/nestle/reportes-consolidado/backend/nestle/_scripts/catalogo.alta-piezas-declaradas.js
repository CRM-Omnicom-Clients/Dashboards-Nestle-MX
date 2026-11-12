// nestle-catalogo · ALTA DE LAS PIEZAS QUE DECLARA RICK EN EL CHAT.
//
// 🔴 POR QUÉ ES UN SCRIPT Y NO UNA EDICIÓN A MANO. Una pieza nueva no es una fila: es una entrada
//    en la AUTORIDAD de dimensiones. Todo lo de aguas abajo —el bloque de email, el ancla de
//    Qcart, la celda del reporte— la lee de aquí. Escribirla a mano deja el «por qué» fuera del
//    sistema, y el corte siguiente no puede reproducir su propio estado.
//
// 🔴 LAS DIMENSIONES SALEN DE LA AUTORIDAD, NUNCA DEL NAMING (R1). El caso de hoy lo prueba:
//    los dos content names de Maggi dicen **`J5-SINREGION` / `J5-CONREGION`**, y Rick confirmó
//    que el touchpoint es **E-J5** con DOS audiencias diferenciadas. Aquí coinciden, pero la que
//    manda es la autoridad — y por eso se escribe de dónde salió cada campo, no solo su valor.
//
// 🔴 LO QUE NO SE SABE SE ESCRIBE «POR DEFINIR», NO SE ADIVINA. Rick no declaró el objetivo de
//    `E-ENRICH1` ni el de `E-PROP1`, ni el segmento de `E-PROP1`. Deducirlos del touchpoint sería
//    inferir del naming, que es justo lo prohibido. Van como POR DEFINIR y salen en su lista.
//
// 🔴 EL QCART SE LEE DEL MAESTRO, POR SHORTLINK (R2). E-J5 tiene sus cuatro códigos en el maestro,
//    dos por audiencia, y NO se cruzan: `9isauWgY`/`Hqa0fbOM` son de «sin región» y
//    `UhCnTNuz`/`TYZa8g47` de «con región». Esa separación es la que Rick pidió que no se pierda.
//    ⚠ `TYZa8g47` aparece TAMBIÉN bajo `e-p4/ligamx` en el maestro. Hoy tiene 0 carritos, así que
//      no hay daño; queda DECLARADO porque el día que traiga carritos el shortlink no podrá
//      decir a cuál de los dos touchpoints pertenecen — y la llave de Qcart es el shortlink.
//
// 🔴 LOS NOMBRES DE COLUMNA SE PIDEN, NO SE ESCRIBEN — incluso para leer mi propia declaración.
//    Parece exagerado y no lo es: si mañana la hoja renombra `TouchPoint`, la declaración de
//    abajo se queda con la llave vieja y este script escribiría la celda en el vacío. Pedirla
//    hace que truene en vez de mentir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json`
//    (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
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

// ══ LO QUE RICK DECLARÓ, con la procedencia de cada campo ═══════════════════════════
var PD = 'POR DEFINIR';
var DECLARADAS = [
  /* 🔴 22-sep-2026 · WA-J9 · la Jornada 9 de WhatsApp.
   *
   *    Rick: «nada de piezas duplicadas, revisa bien qué sigue y hazlo». Comprobado antes de dar
   *    el alta: **0 piezas del catálogo mencionan J9** por ningún campo (ni `074969`, ni `J9`, ni
   *    el id del creativo), y `005-P013` está libre. No hay nada que duplicar.
   *
   * 🔴 UNA PIEZA, DOS ENVÍOS — como su hermana. La fuente publica J9 en dos disparos, uno a las
   *    4PM y otro a las 5PM, exactamente igual que J8 (`005-P011`, que cubre 1,962 envíos entre
   *    sus dos). El grano de `Catalogo_Piezas` es la PIEZA; el de `Data_WhatsApp`, el ENVÍO. Por
   *    eso esto es UNA fila y allá serán DOS, y no es una contradicción: es la diferencia de
   *    grano que `esquema.json` declara.
   *
   * 🔴 LO QUE NO SE INVENTA. El `Segmento` es «Región unificada», igual que WA-J8: la partición
   *    (A / B) vive en la hoja de Rick, no en el catálogo. El `Objetivo` se hereda de la campaña
   *    —las 8 piezas de Liga MX son Purchase— y queda dicho en Notas que es heredado, no leído
   *    de la fuente. Las MÉTRICAS no se declaran aquí: las llena la cadena desde el bloque.  */
  {
    id: '005-P013', modelo: '005-P011',
    porque: 'Rick, 22-sep-2026: «llena los datos desde el reporte interno de whatsapp» y «revisa bien qué sigue y hazlo». La hoja «Maggi Liga MX» de (Interno) Resultados Whatsapp CRM 2026 publica la Jornada 9 el 19-sep en dos envíos: 4PM (2,000 enviados) y 5PM (560). Sin esta pieza, esos 2 envíos del bloque no tienen fila en Data_WhatsApp.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'WA-J9', 'Touchpoint_Raw': 'wa-j9',
      'Segmento': 'Región unificada', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'WhatsApp', 'Email_Type': 'Principal', 'Tipo_Envio': 'one-shot',
      'Email_Name': 'N/A',
      'Whatsapp_Name': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J9-4PM_CN_WA_A_V1_074969',
      'Whatsapp_Names_Variantes': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J9-5PM_CN_WA_A_V1_074969',
      'Codigo_NC': 'NC006537',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '1', 'Cod_Walmart_1': 'ymh2OT4x',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (objetivo heredado de la campaña)',
      'Notas': 'Alta del 22-sep-2026. La fuente la publica en DOS envíos (4PM y 5PM) que suman 2,560 enviados; el Whatsapp_Name canónico es el de las 4PM y el de las 5PM va en variantes, igual que en 005-P011. El OBJETIVO se hereda de la campaña (las 8 piezas de Liga MX son Purchase), no lo dice la fuente. El SEGMENTO es «Región unificada» como su hermana: la partición A/B vive en la hoja Maggi Reporte, no en el catálogo. Shortlink ymh2OT4x (receta «Alitas con salsa mango habanero al horno»), 17 carritos medidos en el crudo de Qcart.'
    }
  },
  /* 🔴 22-sep-2026 · E-J9 · la Jornada 9 de EMAIL. Rick: «E-J9 dalo de alta ahora tú».
   *
   *    Comprobado antes: **0 coincidencias** de `E-J9`, `LIGAMX-J9` o `3074970` en el catálogo,
   *    y `005-P014` libre. Nada que duplicar.
   *
   * 🔴 LAS FECHAS VAN AQUÍ, no en un segundo paso. Con WA-J9 las dejé fuera «porque el alta
   *    declara dimensiones y la cadena llena el resto», y la pieza nació sin fecha: el filtro de
   *    activación de Qcart le descartó sus 10 carritos y hubo que corregirlas aparte. La fecha de
   *    envío no es una métrica que la cadena calcule — es un HECHO que la fuente publica — así
   *    que se declara desde el principio.
   *
   * 🔴 LOS ENVÍOS SON 40,130 Y NO 40,132. El detalle de SFMC trae tres jobs bajo este nombre: el
   *    real del 19-sep (40,130) y dos de UN solo envío el 18-sep, que son pruebas. El umbral de
   *    prueba (<10 envíos) vive en `lib-fechas-envio.js` y es el mismo que usa la fecha: por eso
   *    la fecha dice 19-sep y no 18. Los 40,132 que vio Rick son la suma con las pruebas dentro. */
  {
    id: '005-P014', modelo: '005-P012',
    porque: 'Rick, 22-sep-2026: «E-J9 dalo de alta ahora tú». El detalle de SFMC (`CRM_Email_Detalle`, job 1311353 del 19-sep) publica la Jornada 9 de email con 40,130 envíos. Sin esta pieza, sus 24 carritos y 5 productos de Qcart (bfQ24tDq · xTaSfQ2y) se quedan huérfanos y el envío no entra al reporte.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J9', 'Touchpoint_Raw': 'e-j9',
      'Segmento': 'Región unificada', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': 'Principal',
      'Email_Name': 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J9-B-C_AQ_EM_A_NA_3074970',
      'Content_ID (final del Email_Name)': '3074970', 'Codigo_NC': 'NC006537',
      'Fecha_Primer_Envio': '2026-09-19', 'Fecha_Ultimo_Envio': '2026-09-19',
      'Quincena': '2026-09-Q2', 'Mes_Lanzamiento': '2026-09',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Cod_Walmart_1': 'bfQ24tDq', 'Cod_Walmart_2': 'xTaSfQ2y',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (objetivo heredado de la campaña)',
      'Notas': 'Alta del 22-sep-2026 a petición de Rick. SFMC: 40,130 envíos · 39,804 entregados · 15,080 aperturas · 86 clicks · 27 bajas, el 19-sep, asunto «El clásico de clásicos también se juega en la mesa» (Email_ID 86026). Los 40,132 que aparecen en la DE agregada incluyen DOS jobs de prueba de 1 envío del 18-sep. 🔴 En la DE su ConfigKey es `TMP-MAGGI-J9`, un provisional: si el bloque de email no la empareja, hay que corregir esa llave en origen. El OBJETIVO se hereda de la campaña (las 8 piezas de Liga MX son Purchase). Shortlinks bfQ24tDq («Alitas con salsa mango habanero al horno») y xTaSfQ2y («Tropi MAGGI® Shot»).'
    }
  },
  {
    id: '006-P006', modelo: '006-P001',
    porque: 'Rick, 27-ago-2026: «O_Nescafé-ICE-NC000817_3 … PIEZA E-ENRICH1 … es de Nescafé ICE». Marca ICE, campaña The Freshers, confirmado por él.',
    campos: {
      'BU': 'Nescafé', 'Marca': 'ICE', 'Campaña': 'The Freshers',
      'TouchPoint': 'E-ENRICH1', 'Touchpoint_Raw': 'N/A',
      'Segmento': 'Gen Z Cafés', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': PD, 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Nescafé-ICE-NC000817_3_IBS_CFEE_NESC_NCF_AAIW_MX_ES_NA_AC_EM_C_V3_024243',
      'Content_ID (final del Email_Name)': '024243', 'Codigo_NC': 'NC000817',
      'Tiene_Qcart': 'No', 'N_Recetas': '0', 'Codigos_Qcart': 'N/A',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (objetivo · segmento)',
      'Notas': 'Alta declarada por Rick en chat el 27-ago-2026. El SEGMENTO se hereda de las otras piezas de email de The Freshers (todas Gen Z Cafés) — derivado, no declarado. El OBJETIVO va POR DEFINIR: deducirlo de «ENRICH» sería inferir del naming. Sin códigos en el maestro de links → Tiene_Qcart=No.'
    }
  },
  {
    id: '001-P032', modelo: '001-P030',
    porque: 'Rick, 27-ago-2026: «eMAIL PROP1 - DE RECETAS NESTLE CAMPAÑA AON RN · MX_O_EM_FOOD_NC-000600_IBS_3018905».',
    campos: {
      'BU': 'RN', 'Marca': 'Recetas Nestlé', 'Campaña': 'AON',
      'TouchPoint': 'E-PROP1', 'Touchpoint_Raw': 'N/A',
      'Segmento': PD, 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': PD, 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'MX_O_EM_FOOD_NC-000600_IBS_3018905',
      'Content_ID (final del Email_Name)': '3018905', 'Codigo_NC': 'NC-000600',
      'Tiene_Qcart': 'No', 'N_Recetas': '0', 'Codigos_Qcart': 'N/A',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (objetivo · segmento)',
      'Notas': 'Alta declarada por Rick en chat el 27-ago-2026. Su hermano E-PROP2 (001-P030/P031) es «Prevención de Churn» y E-APP (001-P029) es «Descarga App» — no se hereda ninguno: elegir uno sería adivinar. El NOMBRE tiene otro formato que el resto de AON (MX_O_EM_… en vez de J_AO-RECETAS-NESTLÉ-…) y otro ID (3018905 vs 803867): es pieza distinta, no variante.'
    }
  },
  {
    id: '005-P007', modelo: '005-P006',
    porque: 'Rick, 27-ago-2026: «SON DE MAGGI LIGA MX, EMAIL E-J5, CON AUDIENCIAS DIFERENCIADAS» + «Es J5 (mismo caso que el otro, son dos audiencias, no las confundas para qcart)».',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J5', 'Touchpoint_Raw': 'N/A',
      'Segmento': 'Usuarios sin región', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_J5-SINREGION_CN_EM_A_V1_043381',
      'Content_ID (final del Email_Name)': '043381', 'Codigo_NC': 'NC006537',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Receta_1': 'Botana de Carnes', 'Cod_Walmart_1': '9isauWgY', 'Cod_Chedraui_1': 'N/A',
      'Receta_2': 'MAGGI® Shots / Cerdito enchilado', 'Cod_Walmart_2': 'Hqa0fbOM', 'Cod_Chedraui_2': 'N/A',
      'Codigos_Qcart': '9isauWgY, Hqa0fbOM',
      'Pieza_Principal_ID': 'N/A',
      'Estado': 'Declarado por Rick',
      'Notas': 'Alta declarada por Rick en chat el 27-ago-2026. TOUCHPOINT E-J5 por la AUTORIDAD (Rick), no por el naming. Objetivo Purchase heredado de E-J4 (005-P005/P006), que Rick declaró «mismo caso». Qcart leído del maestro por SHORTLINK: e-j5/sinregion → 9isauWgY (Botana de Carnes) y Hqa0fbOM (Cerdito enchilado). Hoy 0 carritos: los links existen y aún no generan eventos.'
    }
  },
  {
    id: '005-P008', modelo: '005-P005',
    porque: 'Rick, 27-ago-2026: la segunda de las dos audiencias diferenciadas de E-J5.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J5', 'Touchpoint_Raw': 'N/A',
      'Segmento': 'Usuarios CON región', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_J5-CONREGION_CN_EM_A_V1_043382',
      'Content_ID (final del Email_Name)': '043382', 'Codigo_NC': 'NC006537',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Receta_1': 'Esquites MAGGI®', 'Cod_Walmart_1': 'UhCnTNuz', 'Cod_Chedraui_1': 'N/A',
      'Receta_2': 'Dip de Pimiento Rostizado', 'Cod_Walmart_2': 'TYZa8g47', 'Cod_Chedraui_2': 'N/A',
      'Codigos_Qcart': 'UhCnTNuz, TYZa8g47',
      'Pieza_Principal_ID': 'N/A',
      'Estado': 'Declarado por Rick',
      // ⚠ este texto tiene que coincidir LETRA POR LETRA con el que ya está en la hoja: la guarda
      //   de idempotencia compara campo por campo, y una coma de más se lee como un choque de
      //   identidad. La aclaración de que septiembre no cuenta vive en el SKILL, no aquí.
      'Notas': 'Alta declarada por Rick en chat el 27-ago-2026. TOUCHPOINT E-J5 por la AUTORIDAD. Qcart por SHORTLINK: e-j5/conregion → UhCnTNuz (Esquites) y TYZa8g47 (Dip de Pimiento). ⚠ TYZa8g47 aparece TAMBIÉN bajo e-p4/ligamx en el maestro: hoy 0 carritos, pero si llegan no se podrán separar por shortlink. Declarado, no resuelto.'
    }
  },
  {
    // 🔴 ESTA NO LA DECLARÓ RICK: SALE DEL DOC, y la procedencia se escribe tal cual.
    //    El doc de junio trae un bloque `e-cooking2 · new-cooking` con TRES shortlinks y
    //    **49 carritos**, y en el catálogo esos códigos cuelgan de `004-P004`, que es
    //    **E-P2 · Bebidas**. No es que estén mal colgados por descuido: es que la pieza a la que
    //    pertenecen NO EXISTE. Mundial tiene E-P1 con Botana · Modern Cooking · Bebidas, y E-P3
    //    con las tres; E-P2 tiene Bebidas y Botana, y le falta Modern Cooking. El hueco del
    //    catálogo se tapó metiendo su tráfico en la pieza de al lado.
    //    Es el mismo defecto que marzo, en otra campaña: 49 carritos de Modern Cooking
    //    reportados como Bebidas, con la suma cuadrando.
    id: '004-P020', modelo: '004-P004',
    porque: 'Derivada del DOC (no de Rick): el bloque `maggi-junio26 · e-cooking2 · new-cooking` existe con 3 shortlinks y 49 carritos, y no hay pieza de Mundial E-P2 × Modern Cooking que lo reciba.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Mundial',
      'TouchPoint': 'E-P2', 'Touchpoint_Raw': 'e-cooking2',
      'Segmento': 'Modern Cooking', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': PD,
      'Content_ID (final del Email_Name)': PD, 'Codigo_NC': 'NC006537',
      'Quincena': '2026-06-Q2',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '3',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (Email_Name)',
      'Notas': 'Alta derivada del doc de links el 27-ago-2026, no declarada por Rick. El bloque `e-cooking2 · new-cooking` de junio tiene 3 shortlinks (3NIh2kYW · ZJ3SmPMy · wdvsBDby, 49 carritos) que hoy cuelgan de 004-P004 (E-P2 · Bebidas). Objetivo y quincena heredados de sus hermanas de E-P2 (004-P004/P005). FALTA su Email_Name: hasta que llegue de SFMC, esta pieza no cruza con el bloque de email.'
    }
  },
  {
    // 🔴 3-sep-2026 · LIGA MX · E-J6 · REGIÓN SUR. El id lo dio `lib-ids.idPieza` —como manda el
    //    skill— pasándole los 136 ids que YA ocupa el catálogo. Sin ese dato devolvía `005-P005`,
    //    ocupado desde hace semanas por E-J4 · Usuarios CON región: el registro conocía 96 piezas
    //    y el libro tiene 136, porque varias altas escribieron directo al Excel sin pasar por él.
    //
    // 🔴 EL SEGMENTO SE HOMOLOGA, EL DETALLE SE CONSERVA. Rick escribió «Segmento Region Sur
    //    Particion C»; el doc de links dice `conregion` para e-j6. No son dos cosas distintas:
    //    «región sur» ES una región, o sea la audiencia CON región. Así que el segmento queda
    //    como el de sus hermanas E-J4/E-J5 —«Usuarios CON región», que es con lo que cruza el
    //    alias del doc— y la precisión que dio Rick vive en el SUBSEGMENTO. Inventarle un
    //    segmento nuevo habría roto el cruce; tirar el detalle habría perdido lo que él sabe y
    //    el doc no dice.
    id: '005-P009', modelo: '005-P008',
    porque: 'Rick, 3-sep-2026: «Campaña Liga Mx · Marca Maggi · O_Maggi-Seleccion-NC006537_NA_…_LIGAMX-J6-REGION-SUR_…_048423 · Segmento Region Sur Particion C». El maestro trae el bloque e-j6/conregion con 2 códigos y fecha 28/08.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J6', 'Touchpoint_Raw': 'e-j6',
      'Segmento': 'Usuarios CON región', 'Subsegmento': 'Región Sur · Partición C', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J6-REGION-SUR_AQ_EM_A_NA_048423',
      'Content_ID (final del Email_Name)': '048423', 'Codigo_NC': 'NC006537',
      'Quincena': '2026-08-Q2',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Receta_1': 'Brochetas de Pollo con Salsa de Piña', 'Cod_Walmart_1': 'BdN0ck7t', 'Cod_Chedraui_1': 'N/A',
      'Receta_2': 'Cebollitas Maggi®', 'Cod_Walmart_2': 'okUSdwJk', 'Cod_Chedraui_2': 'N/A',
      'Codigos_Qcart': 'BdN0ck7t, okUSdwJk',
      'Pieza_Principal_ID': 'N/A', 'Sends': PD,
      'Fuente_Dato': 'Rick en chat, 3-sep-2026 · Qcart-Links Mails-Hive- MX.xlsx (Agosto f13-f14)',
      'Estado': '⚠ Por confirmar (sends: la data de email la trae otra sesión)',
      'Notas': 'Alta declarada por Rick el 3-sep-2026. TOUCHPOINT E-J6 por la AUTORIDAD, no por el naming. Segmento homologado a «Usuarios CON región» igual que E-J4 y E-J5 —el doc dice conregion— y «Región Sur · Partición C» va en el subsegmento, para no perder la precisión de Rick ni romper el cruce con el alias. Qcart por SHORTLINK del maestro: e-j6/conregion → BdN0ck7t (Brochetas de Pollo con Salsa de Piña) y okUSdwJk (Cebollitas Maggi), fecha de envío 28/08 → quincena 2026-08-Q2. Sends PENDIENTE: la DE de SFMC todavía no la trae.'
    }
  },
  {
    // 🔴 4-sep-2026 · EL FOLLOWUP DE E-PROP1. La declara SFMC, no Rick — y eso se escribe.
    //    Rick declaro el Principal el 3-sep («AON RN · E-PROP-1 · SEGMENTO TIBIOS»); el FUP
    //    aparecio despues en la DE, con su propio EmailName (…ES-FUP__DE_Audience…) y sus
    //    propios 158,056 envios. Sin esta fila, esos envios no llegan a ninguna celda.
    id: '001-P033', modelo: '001-P031',
    porque: 'Derivada de SFMC (no de Rick): la DE trae el FollowUp de E-PROP1 con 158,056 envios y el catalogo no tenia donde ponerlos. Era una de las 2 piezas que SFMC publicaba y el catalogo no daba de alta.',
    campos: {
      'BU': 'RN', 'Marca': 'Recetas Nestlé', 'Campaña': 'AON',
      'TouchPoint': 'E-PROP1', 'Touchpoint_Raw': 'N/A',
      'Segmento': 'Tibios', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': PD, 'Canal': 'Email', 'Email_Type': 'Follow Up', 'Tipo_Envio': 'FUP',
      'Email_Name': 'O_NC-000600_NA_IBS_FOOD_NEST_L73_ANNF_MX_ES-FUP__DE_Audience_RN_AON_E-PROP1_EM_3018905',
      'Content_ID (final del Email_Name)': '3018905', 'Codigo_NC': 'NC-000600',
      'Quincena': '2026-08-Q2',
      'Tiene_Qcart': 'No', 'N_Recetas': '0', 'Codigos_Qcart': 'N/A',
      'Pieza_Principal_ID': '001-P032', 'Sends': PD,
      'Estado': '⚠ Por confirmar (objetivo)',
      'Notas': 'Alta derivada de SFMC el 4-sep-2026, no declarada por Rick en el chat: la DE CRM_Email_Piezas trae esta pieza con ConfigKey TMP-RN-AON-PROP1-FUP, Es_FUP=Si y 158,056 envios entre el 27-ago y el 3-sep, y ninguna pieza del catalogo la recibia. Su Principal es 001-P032 (mismo Codigo_NC, mismo touchpoint, mismo segmento, mismo ID final 3018905), asi que se DECLARA con Pieza_Principal_ID en vez de deducirlo: un FUP sale en otra quincena que su Principal y deducirlo por fecha falla. El OBJETIVO va POR DEFINIR igual que en 001-P032 — heredarlo de un hermano seria adivinar. Sin codigos en el maestro de links → Tiene_Qcart=No.'
    }
  },
  {
    // 🔴 9-sep-2026 · LIGA MX · E-J7. Rick declaró el content name y los DOS shortlinks; el
    //    resto salió del maestro de links, que es la autoridad que define las piezas: su bloque
    //    `Septiembre f5-f6` dice touchpoint `e-j7`, audiencia `regionunificada`, retailer Walmart
    //    y fecha de envío serial 46269 = 2026-09-04 → quincena 2026-09-Q1.
    //
    // 🔴 SFMC NO TIENE ESTA PIEZA. Comprobado el 9-sep contra las DOS DEs (`CRM_Email_Piezas` y
    //    `CRM_Email_Detalle`, refresh 9/9 00:22): cero filas para `LIGAMX-J7`. Rick lo anticipó
    //    («quizá no están los datos de email completos para jornada 7»). Así que la pieza entra
    //    con su IDENTIDAD completa y sin ninguna MÉTRICA: `Sends` va POR DEFINIR, no 0 — un cero
    //    afirma que no se envió, y lo que sabemos es que SFMC todavía no lo publica.
    //
    // 🔴 EL SEGMENTO NO SE HOMOLOGA AQUÍ, Y ESA ES LA DIFERENCIA CON E-J6. En J6 el maestro decía
    //    `conregion` y Rick «Región Sur · Partición C»: eran la misma audiencia vista con más
    //    detalle, así que el segmento se homologó a «Usuarios CON región» y el detalle se fue al
    //    subsegmento. Aquí el maestro dice `regionunificada`, que **no es** ni «CON región» ni
    //    «sin región»: es una audiencia nueva —unificaron las particiones—. Meterla en cualquiera
    //    de las dos anteriores sería deducir (R1) y ensuciaría la comparación entre jornadas.
    //    Se declara con el valor del maestro y se marca ⚠ Por confirmar para que Rick lo cierre.
    id: '005-P010', modelo: '005-P009',
    porque: 'Rick, 9-sep-2026: «Jornada 7 Email: O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7_AQ_EM_A_NA_0359270» + los dos links de Qcart (hTHNLqzL, GQnvqqP3). El maestro trae el bloque e-j7/regionunificada con esos dos códigos y fecha 04/09.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J7', 'Touchpoint_Raw': 'e-j7',
      'Segmento': 'Región unificada', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J7_AQ_EM_A_NA_0359270',
      'Content_ID (final del Email_Name)': '0359270', 'Codigo_NC': 'NC006537',
      'Quincena': '2026-09-Q1', 'Mes_Lanzamiento': '2026-09', 'Mes': 'Septiembre', 'Mes (#)': '9',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Receta_1': 'Aceitunas Toreadas', 'Cod_Walmart_1': 'hTHNLqzL', 'Cod_Chedraui_1': 'N/A',
      'Receta_2': 'Papas Nacho', 'Cod_Walmart_2': 'GQnvqqP3', 'Cod_Chedraui_2': 'N/A',
      'Codigos_Qcart': 'hTHNLqzL, GQnvqqP3',
      'Pieza_Principal_ID': 'N/A', 'Sends': PD,
      'Fuente_Dato': 'Rick en chat, 9-sep-2026 · Qcart-Links Mails-Hive- MX.xlsx (Septiembre f5-f6)',
      'Fuente_Qcart': 'maestro Qcart-Links · Septiembre ¦ Maggi-LigaMx-agosto26 ¦ e-j7 ¦ regionunificada',
      'Estado': '⚠ Por confirmar (segmento «Región unificada» y sends: SFMC aún no publica J7)',
      'Notas': 'Alta declarada por Rick el 9-sep-2026. TOUCHPOINT E-J7 por la AUTORIDAD y confirmado por el maestro (e-j7). SEGMENTO «Región unificada» tomado del maestro (regionunificada): NO se homologó a «Usuarios CON región» ni a «sin región» como en E-J6, porque unificaron las particiones y es una audiencia distinta — homologarla sería deducir (R1) y rompería la comparación entre jornadas. Qcart por SHORTLINK del maestro: e-j7/regionunificada → hTHNLqzL (Aceitunas Toreadas) y GQnvqqP3 (Papas Nacho), ambos Walmart, fecha de envío serial 46269 = 04/09 → quincena 2026-09-Q1. SENDS Y TODAS LAS MÉTRICAS POR DEFINIR: verificado el 9-sep contra las dos DEs de SFMC (refresh 9/9 00:22) que NO tienen ninguna fila de LIGAMX-J7. Va POR DEFINIR y no 0 a propósito: un cero afirmaría que no se envió.'
    }
  },
  {
    // ══ 14-sep-2026 · LIGA MX JORNADA 8 · WHATSAPP ═══════════════════════════════════════════
    // 🔴 DOS JOURNEYS, UNA PIEZA — y la razón es el SHORTLINK. Rick declaró dos journeys de
    //    WhatsApp (…JORNADA-4PM… y …JORNADA-5PM…, mismo id 065900) y el maestro trae **un solo**
    //    link para `wa-j8`: `DTuqPqBo`. Si fueran dos piezas, los carritos de ese único link no se
    //    podrían repartir entre ellas sin inventar el reparto — el mismo caso de DESPERTAR 2
    //    (`008-P008`), que también lleva dos journeys en una pieza.
    //    La fuente sí las separa (985 y 977 envíos), así que el bloque produce DOS filas de envío
    //    apuntando a esta pieza. Eso es correcto: el grano de `Data_WhatsApp` es «una fila por
    //    ENVÍO», no por pieza, y el reporte las agrega en su celda (1,962).
    //
    // 🔴 EL SEGMENTO SE HOMOLOGA Y EL DETALLE SE CONSERVA — la regla de E-J6. El maestro dice
    //    `regionunificada-part-a-wa`: la audiencia es la misma «Región unificada» que estrenó J7,
    //    con una partición. El sufijo `-wa` es el canal, no el segmento, y por eso no entra.
    id: '005-P011', modelo: '005-P010',
    porque: 'Rick, 14-sep-2026: «Esto es del envío J8 de Liga MX … O_Maggi-Seleccion-NC006537_1_…_LALIGA-JORNADA-5PM_CN_WA_A_V1_065900 · …_LALIGA-JORNADA-4PM_CN_WA_A_V1_065900 … Dos journeys de whatsapp 1 de email». La fuente de WhatsApp trae una hoja NUEVA («Maggi Liga MX») con los dos envíos del 12-sep, y el maestro trae el bloque wa-j8 con un solo código.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'WA-J8', 'Touchpoint_Raw': 'wa-j8',
      'Segmento': 'Región unificada', 'Subsegmento': 'Partición A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'WhatsApp', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'N/A', 'Email_Names_Variantes': 'N/A', 'N_Email_Names': 'N/A',
      'Content_ID (final del Email_Name)': '065900', 'Codigo_NC': 'NC006537',
      'Fecha_Primer_Envio': '2026-09-12', 'Fecha_Ultimo_Envio': '2026-09-12',
      'Quincena': '2026-09-Q1', 'Mes_Lanzamiento': '2026-09', 'Mes': 'Septiembre', 'Mes (#)': '9',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '1',
      'Receta_1': 'Sarten Queso Jalapeño', 'Cod_Walmart_1': 'DTuqPqBo', 'Cod_Chedraui_1': 'N/A',
      'Codigos_Qcart': 'DTuqPqBo',
      'Pieza_Principal_ID': 'N/A', 'Sends': PD,
      'Clicks_Medidos': 'Sí',
      'Fuente_Dato': 'Rick en chat, 14-sep-2026 · (Interno) Resultados Whatsapp CRM 2026.xlsx hoja «Maggi Liga MX» · Qcart-Links Mails-Hive- MX.xlsx (Septiembre)',
      'Fuente_Qcart': 'maestro Qcart-Links · Septiembre ¦ Maggi-LigaMx-agosto26 ¦ wa-j8 ¦ regionunificada-part-a-wa',
      'Estado': 'Declarado por Rick · 14-sep-2026',
      'Notas': 'Alta declarada por Rick el 14-sep-2026. DOS journeys de WhatsApp en UNA pieza: …LALIGA-JORNADA-4PM…065900 y …LALIGA-JORNADA-5PM…065900. Se unen porque el maestro trae UN SOLO shortlink para wa-j8 (DTuqPqBo) y los carritos de un link no se pueden repartir entre dos piezas sin inventar el reparto — mismo criterio que DESPERTAR 2 (008-P008). La fuente sí separa los dos envíos (985 y 977 = 1,962), así que Data_WhatsApp lleva DOS filas con este Pieza_ID: su grano es el ENVÍO, no la pieza. SEGMENTO homologado a «Región unificada» (la audiencia que estrenó J7) con la partición en el subsegmento; el sufijo -wa del maestro es el CANAL, no el segmento. CLICKS_MEDIDOS = Sí porque Rick declaró el 14-sep que los clicks de WhatsApp salen de los CARRITOS de Qcart: «Clicks debes sacarlos de qcart carritos ok? en caso de j8».'
    }
  },
  {
    // ══ 14-sep-2026 · LIGA MX JORNADA 8 · EMAIL ══════════════════════════════════════════════
    // 🔴 SFMC TODAVÍA NO LA PUBLICA. Comprobado el 14-sep contra `CRM_Email_Piezas` por DOS vías,
    //    no una: por nombre (`LALIGA-J8` → 0 filas) y por el ID final (`069127` → 0 filas). La
    //    segunda búsqueda existe por la lección de J7: el nombre que declara Rick no siempre es el
    //    que publica la DE —J7 salió con el sufijo `-B-C`— así que buscar solo por nombre habría
    //    dejado la duda de si estaba con otro nombre. No está.
    //    Entra con su identidad y sin métricas: `Sends` va POR DEFINIR, nunca 0.
    //
    // 🔴 SU QUINCENA ES LA Q2, NO LA Q1 DE SU HERMANA DE WHATSAPP. El maestro activa los dos links
    //    de `e-j8` el **15-sep** mientras el de WhatsApp activó el 12. Son el mismo «J8» para el
    //    negocio y dos periodos distintos para el reporte, y eso se declara en vez de igualarse.
    id: '005-P012', modelo: '005-P010',
    porque: 'Rick, 14-sep-2026: «…LALIGA-J8-SAB_CN_EM_A_V1_069127 … Dos journeys de whatsapp 1 de email. Aún se están cargando los datos de email». El maestro trae el bloque e-j8 con dos códigos y fecha 15/09.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J8', 'Touchpoint_Raw': 'e-j8',
      'Segmento': 'Región unificada', 'Subsegmento': 'Partición A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': PD,
      'Email_Name': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J8-SAB_CN_EM_A_V1_069127',
      'Content_ID (final del Email_Name)': '069127', 'Codigo_NC': 'NC006537',
      'Quincena': '2026-09-Q2', 'Mes_Lanzamiento': '2026-09', 'Mes': 'Septiembre', 'Mes (#)': '9',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2',
      'Receta_1': 'Nachos con carne / Nachos MAGGI', 'Cod_Walmart_1': '0oSrtaxX', 'Cod_Chedraui_1': 'N/A',
      'Receta_2': 'Sarten Queso Jalapeño', 'Cod_Walmart_2': '0eQt7uf5', 'Cod_Chedraui_2': 'N/A',
      'Codigos_Qcart': '0oSrtaxX, 0eQt7uf5',
      'Pieza_Principal_ID': 'N/A', 'Sends': PD,
      'Fuente_Dato': 'Rick en chat, 14-sep-2026 · Qcart-Links Mails-Hive- MX.xlsx (Septiembre f7-f8)',
      'Fuente_Qcart': 'maestro Qcart-Links · Septiembre ¦ Maggi-LigaMx-agosto26 ¦ e-j8 ¦ regionunificada-part-a',
      'Estado': '⚠ Por confirmar (sends: SFMC aún no publica J8)',
      'Notas': 'Alta declarada por Rick el 14-sep-2026. SFMC NO publica esta pieza todavía: comprobado por DOS vías el 14-sep — por nombre (LALIGA-J8 → 0 filas) y por el ID final 069127 (→ 0 filas). La doble búsqueda viene de la lección de J7, que SFMC publicó con el sufijo -B-C y por nombre no aparecía. Sends POR DEFINIR, no 0. QUINCENA 2026-09-Q2 porque el maestro activa sus dos links el 15/09, mientras su hermana de WhatsApp (005-P011) activó el 12/09 y cae en Q1: mismo «J8» para el negocio, dos periodos para el reporte. Qcart por SHORTLINK: e-j8/regionunificada-part-a → 0oSrtaxX (Nachos con carne) y 0eQt7uf5 (Sarten Queso Jalapeño).'
    }
  },
  /* 🔴 29-sep-2026 · E-J10 · la Jornada 10 de EMAIL. Rick: «J-10 YA DEBES TENER DATOS DE EMAIL EN
   *    LA DE, CONECTATE POR MCP». Y tenía razón: yo había buscado en el objeto **Send** de SFMC y
   *    ahí solo salían los tres jobs de prueba. El dato vive en la **DE** `CRM_Email_Piezas`, que
   *    la llena una query — son dos cosas distintas y buscar en la equivocada me hizo concluir
   *    «no hay dato» sobre algo que sí estaba, refrescado esa misma tarde (LastRefresh 16:09).
   *
   *    Comprobado antes del alta: **0 filas** del catálogo mencionan `J10`, `30794109`, `089419`,
   *    `089420` ni ninguno de los dos shortlinks. `005-P015` libre. Nada que duplicar.
   *
   * 🔴 LOS ENVÍOS SON 39,735 Y NO 39,738, Y LA FECHA ES EL 26 Y NO EL 24. El detalle trae CUATRO
   *    jobs: tres de UN envío (`[Test J10]` ×2 el 24-sep, `[Test J10 v2]` el 25-sep) y el real,
   *    job **1316469 del 26-sep con 39,735**. La DE agregada suma las pruebas, así que su
   *    `Fecha_Primer_Envio` dice 24-sep — contaminada, el mismo defecto que ya costó 21 días en
   *    E-PROP1. Aquí se declara la fecha REAL; la resta de pruebas la hace la cadena con su
   *    umbral único (<10 envíos, en `lib-fechas-envio.js`).
   *
   * 🔴 `Tiene_Qcart` VA COMO **POR DEFINIR**, Y ES A PROPÓSITO. Hay 2 shortlinks con tráfico
   *    `utm_content = e-j10` —`kzSTHGEd` (Dips Botaneros) y `jhMxJiSo` (Pepimiche), 21 carritos—
   *    pero NO son de esta pieza, por dos razones medidas: (1) **ninguno de los dos está en el
   *    maestro**, que es la autoridad de links, y (2) su tráfico es del **22-23 sep**, tres días
   *    ANTES de que este correo saliera el 26. Apuntan a la J10 de **WhatsApp** (`089419`, el
   *    nombre que dio Rick), que todavía no tiene métricas. Colgarlos aquí sería atribuir una
   *    compra al canal equivocado — justo lo que Rick pidió no romper. */
  {
    id: '005-P015', modelo: '005-P014',
    porque: 'Rick, 29-sep-2026: «J-10 YA DEBES TENER DATOS DE EMAIL EN LA DE, CONECTATE POR MCP». La DE CRM_Email_Detalle publica la Jornada 10 de email en el job 1316469 del 26-sep con 39,735 envíos. Sin esta pieza el bloque no la empareja: se queda en 107 de 108 y la resta de jobs de prueba no cuadra (resta 212 y debe restar 215, los 3 que faltan son los de J10).',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'E-J10', 'Touchpoint_Raw': 'e-j10',
      'Segmento': 'Región unificada', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'Email', 'Email_Type': 'Principal', 'Tipo_Envio': 'Principal',
      'Email_Name': 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J10_AQ_EM_A_NA_30794109',
      'Content_ID (final del Email_Name)': '30794109', 'Codigo_NC': 'NC006537',
      'Fecha_Primer_Envio': '2026-09-26', 'Fecha_Ultimo_Envio': '2026-09-26',
      'Quincena': '2026-09-Q2', 'Mes_Lanzamiento': '2026-09',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '2', 'Cod_Walmart_1': 'kzSTHGEd', 'Cod_Walmart_2': 'jhMxJiSo',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (objetivo heredado de la campaña · Qcart sin resolver)',
      'Notas': 'Alta del 29-sep-2026 a petición de Rick. SFMC (DE CRM_Email_Detalle, job 1316469 del 26-sep): 39,735 envíos · 39,355 entregados · 16,006 aperturas · 102 clicks · 380 rebotes · 29 bajas. Asunto «Tu alineación para hoy: fútbol + algo deli» (Email_ID 86203). 🔴 Los 39,738 de la DE agregada incluyen TRES jobs de prueba de 1 envío (24 y 25-sep), y por eso su Fecha_Primer_Envio dice 24-sep en vez del 26 real. 🔴 En la DE su ConfigKey es el provisional `TMP-MAGGI-J10` y su PiezaID viene «*por definir», igual que pasó con J9. El SEGMENTO «Región unificada» no se dedujo del naming: coincide en las 5 piezas de Liga MX desde J7 y el utm_term del tráfico dice literalmente «regionunificada-part-c-email». El OBJETIVO se hereda de la campaña. 🔴 QCART SIN RESOLVER A PROPÓSITO: los 2 shortlinks con utm e-j10 (kzSTHGEd «Dips Botaneros», jhMxJiSo «Pepimiche», 21 carritos) NO están en el maestro y su tráfico es del 22-23 sep, tres días antes de este envío — apuntan a la J10 de WhatsApp (089419), que aún no publica métricas.'
    }
  },
  /* 🔴 29-sep-2026 · WA-J10 · la Jornada 10 de WHATSAPP. El nombre lo dio Rick en el chat:
   *    `…_LALIGA-J10-JUE_CN_WA_A_V1_089419`. Es la HERMANA de `005-P015`: ids consecutivos
   *    (089419 WhatsApp / 089420 email), misma jornada, dos canales.
   *
   * 🔴 LA DESTAPÓ LA PUERTA 2, NO YO. Tras cargar J10 de email, la puerta cerró con «faltan 8
   *    carritos y no hay bloques sin anclar que lo expliquen». Esos 8 son 7 filas del shortlink
   *    `uCV8KGHm` con `utm_content = wa-j10` y `utm_term = regionunificada-part-c-**wa**`, sin
   *    `pieza_id` porque esta pieza no existía. Sin la puerta habrían quedado de carritos
   *    huérfanos, que es justo lo que una puerta existe para no dejar pasar.
   *
   * 🔴 Y CORRIGE UNA CONCLUSIÓN MÍA. Antes de que Rick actualizara el maestro yo había escrito que
   *    los 21 carritos de `e-j10` del 22-23 sep «apuntan a la J10 de WhatsApp». No: el maestro
   *    declara `uCV8KGHm` como el link de WhatsApp —y es OTRO shortlink, con su propio utm—.
   *    Aquellos 21 eran de email y su tráfico simplemente precede a la activación. **La autoridad
   *    resolvió lo que yo había inferido del parecido de las fechas.**
   *
   * 🔴 NACE SIN MÉTRICAS DE ENVÍO, Y ESO NO ES UN HUECO SINO UN ESTADO. `(Interno) Resultados
   *    Whatsapp CRM 2026.xlsx` es del 22-sep y llega hasta J9: Rick lo dijo — «WHATSAPP AUN NO».
   *    Es el mismo caso que la guarda 6 ya sabe leer: «no son residuo, son piezas reales a las que
   *    les falta una fuente». Sus envíos van POR DEFINIR, nunca 0. */
  {
    id: '005-P016', modelo: '005-P013',
    porque: 'Rick declaró el nombre en el chat el 29-sep-2026 y el maestro de links (hoja «Septiembre» fila 15, actualizado ese día) declara su shortlink uCV8KGHm con utm_medium=whatsapp, utm_content=wa-j10 y fecha de envío 24-sep. Sin esta pieza, sus 8 carritos quedan sin dueño y la PUERTA 2 cierra — de hecho cerró.',
    campos: {
      'BU': 'RN', 'Marca': 'Maggi', 'Campaña': 'Liga MX',
      'TouchPoint': 'WA-J10', 'Touchpoint_Raw': 'wa-j10',
      'Segmento': 'Región unificada', 'Subsegmento': 'N/A', 'Segmentos_Combinados': 'N/A',
      'Objetivo': 'Purchase', 'Canal': 'WhatsApp', 'Email_Type': 'Principal', 'Tipo_Envio': 'one-shot',
      'Email_Name': 'N/A',
      'Whatsapp_Name': 'O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-JUE_CN_WA_A_V1_089419',
      'Codigo_NC': 'NC006537',
      'Fecha_Primer_Envio': '2026-09-24', 'Fecha_Ultimo_Envio': '2026-09-24',
      'Quincena': '2026-09-Q2', 'Mes_Lanzamiento': '2026-09',
      'Tiene_Qcart': 'Sí', 'N_Recetas': '1', 'Cod_Walmart_1': 'uCV8KGHm',
      'Clicks_Medidos': 'Sí',
      'Pieza_Principal_ID': 'N/A',
      'Estado': '⚠ Por confirmar (sin métricas de envío: la fuente de WhatsApp llega hasta J9)',
      'Notas': 'Alta del 29-sep-2026. Nombre declarado por Rick en el chat; su hermana de email es 005-P015 (E-J10) y los ids finales son consecutivos: 089419 WhatsApp / 089420 email. FECHA 24-sep del maestro de links (serial 46289), que es la autoridad — no de la fuente de WhatsApp, que todavía no publica J10. 🔴 SIN ENVÍOS NI LEÍDOS: (Interno) Resultados Whatsapp CRM 2026.xlsx es del 22-sep y su hoja «Maggi Liga MX» llega hasta J9. Van POR DEFINIR, no 0, hasta que Leslie actualice. Qcart: shortlink uCV8KGHm, receta «Papitas elote», Walmart — 7 filas = 8 carritos entre el 24 y el 27-sep. CLICKS_MEDIDOS=Sí por la regla que Rick declaró el 14-sep para todo WhatsApp con Qcart («los clicks debes sacarlos de qcart carritos»), la misma de 005-P011 y 005-P013. 🔴 Esta pieza la destapó la PUERTA 2 al cerrar por 8 carritos sin dueño, no una revisión: sin ella esos carritos no aparecían en ningún reporte.'
    }
  }
];

// ══ LA DECLARACIÓN DE PRE-ESCRITURA — sin ella este script no procede (R5) ══════════
DECL.declarar('nestle-catalogo', 'catalogo.alta-piezas-declaradas.js', [{
  hoja: 'Catalogo_Piezas',
  grano: 'una fila por PIEZA nueva declarada por Rick en el chat',
  llave: 'Pieza_ID — correlativo DENTRO de su campaña (001-, 005-, 006-), nunca global',
  celdas_esperadas: DECLARADAS.length + ' filas nuevas · 0 celdas de filas existentes se tocan'
}]);

console.log('════════ nestle-catalogo · ALTA DE PIEZAS DECLARADAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_alta-piezas.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var colIdx = {}; enc.forEach(function (h, i) { if (h) colIdx[h] = i; });
console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + P.length + ' piezas · ' + enc.length + ' columnas\n');

// 🔴 los nombres físicos se resuelven UNA vez contra el catálogo raíz, y todo lo demás usa
//    la variable. Ninguna lectura por literal, ni siquiera sobre mi propia declaración.
var NM = {};
['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Email_Name', 'Tiene_Qcart'].forEach(function (id) {
  NM[id] = COL.de(P, id);
});
function campo(d, idLogico) { return t(d.campos[NM[idLogico]]); }

var filaDe = {}; P.forEach(function (p, i) { if (t(p[NM.Pieza_ID])) filaDe[t(p[NM.Pieza_ID])] = i + 2; });

// ══ LAS GUARDAS DEL ALTA ════════════════════════════════════════════════════════════
// 🔴 UN ID DUPLICADO ES LA GUARDA 2 DEL PREFLIGHT, y aquí se aplica ANTES de escribir:
// 🔴 EL ID SE INYECTA AQUÍ, NO SE ESCRIBE EN CADA DECLARACIÓN — y hay un caso real detrás.
//    La primera corrida escribió las 4 filas completas y SIN `Pieza_ID`: yo lo puse como `id:`
//    arriba del objeto y nunca dentro de `campos`, así que nunca llegó a una celda. Las 5 capas
//    pasaron, el conteo subió de 131 a 135, y el libro quedó con cuatro piezas anónimas — que es
//    peor que no tenerlas, porque TODO cruza por ese id. Lo atrapó releer del disco, no un check.
//    Inyectarlo aquí hace que no se pueda olvidar: no depende de que yo me acuerde en cada alta.
DECLARADAS.forEach(function (d) { d.campos[NM.Pieza_ID] = d.id; });

// 🔴 IDEMPOTENCIA: correr esto dos veces no puede bloquear ni duplicar. Una pieza que YA está y
//    coincide campo por campo se salta; solo bloquea si el id existe con OTRO contenido — eso sí
//    es un choque de identidad. Sin esto, agregar una quinta alta a la lista hacía que el script
//    se negara por las cuatro que ya había escrito él mismo.
// 🔴 UNA DECLARACIÓN DE ALTA CADUCA CUANDO LA PIEZA YA EXISTE. Después del alta, otros pasos
//    corrigen legítimamente esa fila —realinear códigos cambió N_Recetas, y el registro de
//    nombres le puso a 001-P032 sus dos Email_Name—, así que la declaración de aquí deja de
//    coincidir con el disco y el script se bloquea a sí mismo. La declaración es de ALTA, no
//    de estado permanente: una vez creada, se marca aplicada y deja de compararse.
//    Se conserva escrita porque es el registro de POR QUÉ existe esa pieza.
// 🔴 «APLICADA» significa: ya está en la hoja Y la cadena la completó desde entonces, así que su
//    declaración de aquí es HISTORIA, no una orden. Sin esta marca el script las ve «distintas»
//    —`005-P009` tenía Sends POR DEFINIR y hoy tiene 2,733; `001-P033` tenía Objetivo POR
//    DEFINIR y hoy lo tiene— y bloquea el alta entera. La guarda tiene razón: no debe pisar un
//    dato más nuevo que la declaración. Marcarlas es la forma de darle la razón sin desactivarla.
var APLICADAS = {
  '006-P006': 1, '001-P032': 1, '005-P007': 1, '005-P008': 1, '004-P020': 1,
  '005-P009': 1,   // 3-sep · la cadena le puso Email_Name y Sends=2,733 desde SFMC
  '001-P033': 1,   // 4-sep · la cadena le puso Objetivo y Sends
  '005-P010': 1,   // 9-sep · la cadena le puso Sends=91,580, fechas y el Email_Name con sus dos nombres
  /* 🔴 22-sep · las dos de J8 se marcan aplicadas porque su declaración ya NO es la verdad: la
   *    cadena las enriqueció después y difieren en `Tipo_Envio`·`Sends` (P011) y además en
   *    `Email_Name`·`Quincena`·`Estado`·`Notas` (P012). Eso no es un choque: es la declaración
   *    cumpliendo su papel —dar el alta— y la cadena haciendo el suyo —llenar las métricas—.
   *    Sin marcarlas, `CHOCAN` no queda vacío y el script sale con `exit(1)` ANTES de procesar
   *    las altas nuevas: dos piezas ya resueltas bloqueaban toda alta futura, en silencio.
   *    Así se descubrió: el alta de `005-P013` no aparecía ni en la lista de lo que haría. */
  '005-P011': 1,   // 22-sep · la cadena le puso Tipo_Envio y Sends=1,962 (sus dos envíos, 4PM+5PM)
  '005-P012': 1    // 22-sep · la cadena le puso Sends=38,168, la quincena y el Email_Name con sus dos nombres
};
var YA = [], CHOCAN = [];
DECLARADAS = DECLARADAS.filter(function (d) {
  if (APLICADAS[d.id] && filaDe[d.id]) { YA.push(d.id + ' (aplicada)'); return false; }
  if (!filaDe[d.id]) return true;                       // no está: se da de alta
  var p = P[filaDe[d.id] - 2] || {};
  var difieren = Object.keys(d.campos).filter(function (c) {
    return colIdx[c] !== undefined && t(p[c]) !== t(d.campos[c]);
  });
  if (!difieren.length) { YA.push(d.id); return false; }
  CHOCAN.push({ id: d.id, campos: difieren });
  return false;
});
if (YA.length) console.log('  ── ya estaban, idénticas: ' + YA.join(' · '));
if (CHOCAN.length) {
  console.log('  🔴 el id existe con OTRO contenido — no lo piso:');
  CHOCAN.forEach(function (c) { console.log('     ' + c.id + '   difieren: ' + c.campos.slice(0, 6).join(' · ')); });
  process.exit(1);
}
if (!DECLARADAS.length) { console.log('\n  ✅ nada nuevo que dar de alta.'); process.exit(0); }

//    dos piezas con el mismo id hacen que todo lo que cruce por él elija una en silencio.
var duplicados = DECLARADAS.filter(function (d) { return filaDe[d.id]; });
// 🔴 Y UNA IDENTIDAD DE NEGOCIO REPETIDA ES PEOR QUE UN ID REPETIDO: el id se ve, la identidad
//    no. Fue lo que metió 216 filas clonadas al catálogo sin que ninguna guarda las viera.
// 🔴 UN TOKEN DE ESTADO NO ES UNA IDENTIDAD. `PENDIENTE` como Email_Name lo tienen ya varias
//    piezas de Liga MX, así que compararlo como si fuera un nombre haría que toda alta sin
//    Email_Name conocido chocara contra ellas. Se compara la identidad solo cuando la hay.
var ESTADO_TXT = /^(PENDIENTE|POR DEFINIR|N\/A)$/i;
var yaPorNombre = DECLARADAS.filter(function (d) {
  var n = campo(d, 'Email_Name');
  if (!n || ESTADO_TXT.test(n)) return false;
  return P.some(function (p) { return t(p[NM.Email_Name]) === n; });
});
var sinModelo = DECLARADAS.filter(function (d) { return !filaDe[d.modelo]; });
var sinColumna = [];
DECLARADAS.forEach(function (d) {
  Object.keys(d.campos).forEach(function (c) { if (colIdx[c] === undefined && sinColumna.indexOf(c) < 0) sinColumna.push(c); });
});


// 🔴 Y LA GUARDA QUE LO VIGILA: ninguna fila puede escribirse sin su llave. Es la misma regla que
//    la guarda 2 del preflight, mirada desde el otro lado — allá es «no repetido», aquí «no vacío».
var sinId = DECLARADAS.filter(function (d) { return !campo(d, 'Pieza_ID'); });
console.log('  ── las guardas del alta');
console.log('     ' + (sinId.length ? '🔴 fila(s) sin Pieza_ID: ' + sinId.length : '✔ las ' + DECLARADAS.length + ' llevan su Pieza_ID en una celda'));
if (sinId.length) { console.log('\n  🔴 NO SE ESCRIBE: una fila sin llave no se puede cruzar con nada.'); process.exit(1); }

console.log('     ' + (duplicados.length ? '🔴 id ya existe: ' + duplicados.map(function (d) { return d.id; }).join(' · ') : '✔ ningún id repetido'));
console.log('     ' + (yaPorNombre.length ? '🔴 Email_Name ya está: ' + yaPorNombre.map(function (d) { return d.id; }).join(' · ') : '✔ ningún Email_Name repetido'));
console.log('     ' + (sinModelo.length ? '🔴 sin fila modelo: ' + sinModelo.map(function (d) { return d.modelo; }).join(' · ') : '✔ las ' + DECLARADAS.length + ' tienen fila modelo para heredar estilo'));
console.log('     ' + (sinColumna.length ? '🔴 columnas que NO existen en la hoja: ' + sinColumna.join(' · ') : '✔ todas las columnas citadas existen en la hoja'));
if (duplicados.length || yaPorNombre.length || sinModelo.length || sinColumna.length) {
  console.log('\n  🔴 NO SE ESCRIBE. Una guarda del alta bloqueó.');
  process.exit(1);
}

// ══ LA PRE-ESCRITURA — la tabla se revisa ANTES de tocar el Excel (E1) ══════════════
console.log('\n  ── lo que se va a escribir');
DECLARADAS.forEach(function (d) {
  console.log('     ' + d.id + '   ' + campo(d, 'Campaña').padEnd(15) + campo(d, 'TouchPoint').padEnd(11) +
    campo(d, 'Segmento').slice(0, 22).padEnd(23) + 'Qcart=' + campo(d, 'Tiene_Qcart').padEnd(4) +
    Object.keys(d.campos).length + ' campos');
  var pd = Object.keys(d.campos).filter(function (c) { return d.campos[c] === PD; });
  if (pd.length) console.log('        POR DEFINIR: ' + pd.join(' · ') + '   → van a la lista de Rick');
});

fs.writeFileSync(BACK + '/_preescritura/PRE-alta-piezas.json', JSON.stringify({
  paso: 'catalogo.alta-piezas-declaradas', cuando: '2026-08-27', declaradas: DECLARADAS
}, null, 1));
console.log('\n  → _preescritura/PRE-alta-piezas.json');

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-alta-piezas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
// 🔴 la parte XML se resuelve por la RELACIÓN, no por número de hoja: `sheet3.xml` no tiene por
//    qué ser la tercera pestaña, y escribir en la hoja equivocada no da error, da un desastre.
var wbXml = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mSheet = new RegExp('<sheet[^>]*name="Catalogo_Piezas"[^>]*r:id="([^"]+)"').exec(wbXml);
var mRel = mSheet ? new RegExp('Id="' + mSheet[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mRel ? 'xl/' + mRel[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML de Catalogo_Piezas'); process.exit(1); }
console.log('     parte: ' + parte);

var xml = zip.readAsText(parte);
// 🔴 LA FILA SIGUIENTE SE BUSCA, NO SE CALCULA (3-sep-2026). `P.length + 1` asume que las filas
//    van pegadas desde la 2, y **no van**: Rick escribe notas a mano debajo de los datos y deja
//    un hueco. Hoy hay 136 piezas (filas 2-137), un vacío en 138-146 y sus notas en
//    `I147:I150` — con `P.length+1` la cuenta sale 141 porque `sheet_to_json` ya contó las notas
//    como filas, y el alta habría escrito en medio del hueco. Peor: si el hueco no existiera,
//    escribiría ENCIMA de una nota suya, que no está en ninguna fuente y no la reconstruye nadie.
// 🔴 Se busca la última fila con `Pieza_ID` de verdad, y se escribe DESPUÉS — comprobando que
//    cada fila destino esté completamente vacía antes de tocarla.
var ultimaConPieza = 1;
P.forEach(function (p, i) { if (t(p[NM.Pieza_ID])) ultimaConPieza = Math.max(ultimaConPieza, i + 2); });
var filasCrudas = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1, defval: '' });
function filaVacia(n) { return !(filasCrudas[n - 1] || []).some(function (v) { return t(v) !== ''; }); }

// 🔴 SE ESCRIBE DESPUÉS DE TODO EL CONTENIDO, NO DESPUÉS DE LA ÚLTIMA PIEZA (9-sep-2026).
//    Hasta hoy la fila base era `ultimaConPieza`, y funcionó mientras las notas de Rick estuvieran
//    lejos. Ya no: la última pieza está en la 127 y **la 128 es su primera nota**. La guarda de
//    abajo hizo su trabajo y detuvo el alta — pero dejarlo ahí significa que ninguna pieza nueva
//    entra jamás mientras esas notas no se muevan, y moverlas NO es una opción: no están en
//    ninguna fuente y no las reconstruye nadie.
//    Una pieza se cruza por su `Pieza_ID`, nunca por su posición, así que quedar debajo de las
//    notas no le quita nada. Se busca la última fila CON ALGO —sea pieza o nota— y se escribe
//    después de ella.
var ultimaConAlgo = ultimaConPieza;
for (var q = 1; q <= filasCrudas.length; q++) if (!filaVacia(q)) ultimaConAlgo = Math.max(ultimaConAlgo, q);
if (ultimaConAlgo > ultimaConPieza) {
  console.log('  ── hay ' + (ultimaConAlgo - ultimaConPieza) + ' fila(s) con contenido debajo de la última pieza' +
    ' (fila ' + (ultimaConPieza + 1) + '..' + ultimaConAlgo + '): son notas a mano. Se escribe DESPUÉS, no encima.');
}
var filaBase = ultimaConAlgo;
var ocupadas = [];
for (var k = 0; k < DECLARADAS.length; k++) if (!filaVacia(filaBase + 1 + k)) ocupadas.push(filaBase + 1 + k);
if (ocupadas.length) {
  console.log('\n  🔴 las filas destino NO están vacías: ' + ocupadas.join(' · '));
  console.log('     Hay contenido ahí abajo (notas a mano de Rick, u otra cosa). NO se escribe encima.');
  ocupadas.forEach(function (n) {
    console.log('       fila ' + n + ': ' + (filasCrudas[n - 1] || []).map(t).filter(Boolean).join(' | ').slice(0, 90));
  });
  process.exit(1);
}
console.log('  ── última fila con pieza: ' + ultimaConPieza + '   ·   se escribe en ' +
  (filaBase + 1) + '..' + (filaBase + DECLARADAS.length) + '   (comprobadas vacías)');
var ultimaCol = enc.length - 1;

var filasXml = DECLARADAS.map(function (d, k) {
  var nFila = filaBase + 1 + k;
  var fModelo = filaDe[d.modelo];
  // 🔴 LAS CELDAS VAN EN ORDEN DE COLUMNA, no en el orden en que yo escribí el objeto. Con el
  //    orden de inserción Excel se NIEGA A ABRIR el libro y ni siquiera ofrece repararlo.
  var celdas = Object.keys(d.campos)
    .filter(function (c) { return colIdx[c] !== undefined && t(d.campos[c]) !== ''; })
    .sort(function (a, b) { return colIdx[a] - colIdx[b]; })
    .map(function (c) {
      var ci = colIdx[c], ref = col(ci) + nFila;
      return CX.celda(ref, d.campos[c], CX.estiloDe(xml, col(ci) + fModelo));
    }).join('');
  return '<row r="' + nFila + '">' + celdas + '</row>';
}).join('');

// 🔴 LA FILA SE INSERTA EN SU LUGAR, NO SE ANEXA AL FINAL (3-sep-2026). Anexar antes de
//    `</sheetData>` funciona mientras los datos sean lo último del XML — y dejaron de serlo en
//    cuanto Rick escribió notas en las filas 147-150. La fila 138 quedó DESPUÉS de la 150, Excel
//    exige orden ascendente, y al releer el libro `sheet_to_json` devolvió 137 filas: **las
//    cuatro notas habían desaparecido de la lectura**. Lo atrapó `xlsx-orden-celdas`, la quinta
//    capa, la que existe justo para esto.
//    Se inserta ANTES de la primera fila cuyo número sea mayor; si no hay ninguna, va al final.
(function () {
  var m = /<row[^>]*\sr="(\d+)"/g, hit, corte = -1;
  while ((hit = m.exec(xml))) {
    if (parseInt(hit[1], 10) > filaBase) { corte = hit.index; break; }
  }
  if (corte >= 0) xml = xml.slice(0, corte) + filasXml + xml.slice(corte);
  else xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
})();
// 🔴 LA DIMENSIÓN SOLO PUEDE CRECER (3-sep-2026). Se ponía como fin `filaBase + nuevas` — o sea
//    139 — sin mirar dónde terminaba antes. Las notas que Rick escribió en las filas 147-150
//    quedaron FUERA del rango declarado y desaparecieron al releer: el libro las tenía en el XML
//    y `<dimension>` decía que la hoja acababa en la 139, así que nadie las leyó.
//    Es el mismo error que anexar al final, visto desde el otro lado: asumir que los datos son
//    lo último de la hoja. Se toma el MÁXIMO entre lo que había y lo que agrego.
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2, r2) {
  var finAntes = parseInt(r2, 10) || 0;
  var finAhora = Math.max(finAntes, filaBase + DECLARADAS.length);
  return '<dimension ref="' + c1 + r1 + ':' + col(ultimaCol) + finAhora + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + DECLARADAS.length + ' filas nuevas: ' + DECLARADAS.map(function (d) { return d.id; }).join(' · '));

// ══ LAS CINCO CAPAS — sin las cinco no se dice que quedó bien (R7) ══════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    var ult = t(r).split('\n').filter(function (x) { return t(x); }).pop() || 'ok';
    console.log('     ✔ ' + nom.padEnd(20) + ult.slice(0, 76));
    return true;
  } catch (e) {
    console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 76));
    return false;
  }
}
// 🔴 LAS CINCO CAPAS CORREN SOBRE EL TEMPORAL, Y SOLO SI PASAN LAS CINCO SE PUBLICA.
//    Hasta hoy se publicaba después de la PRIMERA (safe-save) y las otras cuatro se corrían ya
//    sobre el archivo del cliente. El 3-sep `xlsx-orden-celdas` —la quinta— detectó que la fila
//    nueva había quedado después de las notas de Rick… con el libro roto ya publicado. La capa
//    hizo su trabajo y aun así el daño estaba hecho: validar después de publicar no es validar,
//    es avisar. Ahora el vivo no se toca hasta que las cinco están en verde.
var capasOk = capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP]);
if (capasOk) capasOk = capa('xlsx-label', NODE, [T + 'xlsx-label.js', TMP]) && capasOk;
if (capasOk) capasOk = capa('xlsx-check', NODE, [T + 'xlsx-check.js', TMP]) && capasOk;
if (capasOk) capasOk = capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', TMP]) && capasOk;
if (capasOk) capasOk = capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', TMP]) && capasOk;
if (!capasOk) {
  console.log('\n  🔴 una de las 5 capas falló: NO se publica. El archivo del cliente NO se tocó.');
  process.exit(1);
}
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta) + '   (las 5 capas en verde ANTES de publicar)');
// una última pasada sobre el archivo ya publicado: comprueba que la copia llegó sana, no que
// el contenido sea correcto — eso ya lo dijeron las cinco capas sobre el temporal.
capa('xlsx-orden-celdas (ya publicado)', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER DEL DISCO Y COMPARAR POR NOMBRE (E4) ═════════════════════════════════════
console.log('\n  ── releído del disco');
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var nm2 = COL.de(P2, 'Pieza_ID');
console.log('     piezas: ' + P.length + ' → ' + P2.length + '   (' + (P2.length - P.length) + ' nuevas)');
var fallos = 0;
DECLARADAS.forEach(function (d) {
  var f = P2.filter(function (p) { return t(p[nm2]) === d.id; })[0];
  if (!f) { console.log('     🔴 ' + d.id + ' NO está en el disco'); fallos++; return; }
  var mal = Object.keys(d.campos).filter(function (c) { return colIdx[c] !== undefined && t(f[c]) !== t(d.campos[c]); });
  console.log('     ' + (mal.length ? '🔴 ' : '✔ ') + d.id + '   ' + Object.keys(d.campos).length + ' campos · ' +
    (mal.length ? mal.length + ' no coinciden: ' + mal.slice(0, 4).join(' · ') : 'todos coinciden'));
  if (mal.length) fallos++;
});
console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' pieza(s) no quedaron bien' : '✅ LAS ' + DECLARADAS.length + ' PIEZAS QUEDARON, verificadas contra el disco'));
process.exit(fallos ? 1 : 0);
