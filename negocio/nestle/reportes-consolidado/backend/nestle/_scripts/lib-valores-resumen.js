// lib-valores-resumen · EL MAPEO columna→valor del Report_Resumen, en UN solo lugar.
//
// 🔴 POR QUÉ EXISTE. resumen-regenerar (actualiza por llave) y N6r (regenera desde la rejilla) necesitan el MISMO
//    mapeo. Tenerlo dos veces es exactamente el bug que Rick odia: dos copias de una regla que
//    divergen en silencio (fue el caso de `Content_ID` vs `Content_ID (SFMC)`). Aquí vive una vez.
//    `crear(serial, nmEncabezado)` inyecta las dos dependencias externas y devuelve `valorDe`.
var t = function (v) { return String(v == null ? '' : v).trim(); };
function pct(v) { return v === null || v === undefined ? '' : v; }
var MES_NUM = { 'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12 };
// 🔴 D4 · la tasa de un destino sobre el TOTAL de clicks únicos de la fila. Solo el cociente; el
//    conteo lo trae motor-calculo. Es lo que la doctrina permite en el reporte.
function tasaDest(c, dest) {
  var tot = c.links_clicks_unicos || 0;
  var v = (c.clicks_por_destino || {})[dest] || 0;
  return tot ? v / tot : null;
}

/* ══ EL DESGLOSE DE CLICKS DE UN BLOQUE — 19-sep-2026 ═════════════════════════════════════════
 * 🔴 TRES ESTADOS, Y ÉSTE ES EL PUNTO DE TODA LA COLUMNA. Un bloque puede estar en:
 *      `completa`   → el número, que es el número
 *      `sin_links`  → tuvo clicks pero `CRM_Email_Links` no publica ni una fila de esa pieza.
 *                     **NO es 0.** Un 0 diría «este correo no tuvo clicks efectivos» sobre
 *                     `001-P029`, que tuvo 1,566. Va `POR DEFINIR`: aplica y lo debemos.
 *      `sin_clicks` → ese bloque no tuvo clicks de email (fila de WhatsApp, de Qcart, o sin FUP).
 *                     Ahí sí `N/A`, y la razón se puede escribir — que es la regla de `lib-vacios`.
 *      `parcial`    → unas piezas con links y otras sin. Hoy son 0, pero si aparece una, el número
 *                     sería un PISO presentado como total: se marca `POR DEFINIR` igual que
 *                     `sin_links`. Redondear hacia «ya cuadra» es cómo se cuela un dato incompleto.
 * 🔴 Y si el bloque no trae `clicks_desglose_estado`, NO se devuelve 0: se devuelve `POR DEFINIR`.
 *    Que el paso que lo calcula no haya corrido es una deuda, no una medición de cero (regla L2).
 */
var CDv = require(__dirname + '/lib-clicks-destino.js');
function desg(bloque, columna) {
  var e = bloque && bloque.clicks_desglose_estado;
  if (e === 'sin_clicks') return 'N/A';
  if (e === 'completa') return Number((bloque.clicks_desglose || {})[columna] || 0);
  return 'POR DEFINIR';
}

/* 🔴 EL BLOQUE `Tot_` SE DERIVA DE SUS DOS BLOQUES, NO SE LEE DE `c.total`. Primero lo leía de ahí
 *    y las tres columnas salieron **84 POR DEFINIR de 84** — mudas. La causa: `resumen-fusionar`
 *    RECALCULA `c.total` después (tiene que hacerlo: fusionar mueve el FUP de celda), y esa
 *    recalculación reemplaza el objeto entero, llevándose el desglose que yo había puesto antes.
 *    Depender del orden de dos pasos dentro del mismo script es frágil por definición; derivarlo
 *    aquí no puede ser pisado por nadie, y además es la definición del total: Principal + FUP.
 * 🔴 Y EL ESTADO ES EL PEOR DE LOS DOS. Si el Principal se midió y el FUP no se sabe, el total NO
 *    se sabe: sumar solo lo conocido y rotularlo «Tot» es presentar un piso como un total. */
function desgTot(c, columna) {
  var ep = (c.principal || {}).clicks_desglose_estado;
  var ef = (c.fup || {}).clicks_desglose_estado;
  if (ep === 'sin_links' || ep === 'parcial' || ef === 'sin_links' || ef === 'parcial') return 'POR DEFINIR';
  if (ep === 'completa' || ef === 'completa') {
    return Number(((c.principal || {}).clicks_desglose || {})[columna] || 0) +
      Number(((c.fup || {}).clicks_desglose || {})[columna] || 0);
  }
  if (ep === 'sin_clicks' && ef === 'sin_clicks') return 'N/A';
  return 'POR DEFINIR';
}

function crear(serial, nmEncabezado) {
  return function valorDe(nombre, c) {
    var q = c.qcart;
    // 🔴 D2 · Tipo Email LLENO y correcto. La fórmula vieja `IF(O=0,"FUP","Principal")` daba «FUP»
    //    a WhatsApp/Qcart-only. Se calcula del contenido real: manda el email, si no el canal que sí tuvo envío.
    var tipoEmail = c.principal.sends > 0 ? 'Principal'
      : (c.fup.sends > 0 ? 'FUP' : (c.whatsapp.sends > 0 ? 'WhatsApp' : (q ? 'Qcart' : '')));
    var M = {
      'Campaña': c.campana, 'Medio': c.medio, 'Objetivo': c.objetivo, 'TouchPoint': c.touchpoint,
      // 🔴 D1 · QCART? = Sí / No y nada más. Con F1 el Qcart va por pieza, así que cada fila tiene el suyo o no.
      'QCART?': q ? 'Sí' : 'No',
      'Segmento': c.segmento, 'Quincena_Lanzamiento': c.quincena, 'Mes': c.mes,
      'Tipo  Email': tipoEmail, 'Mes (#)': MES_NUM[t(c.mes)] || '',
      'BU': c.bu, 'Marca': c.marca,
      // 🔴 A11 renombró estos encabezados; se mapean el nuevo y el viejo para servir a ambas hojas.
      'Content_ID (final del Email_Name)': Object.keys(c.content_ids || {}).join(' · '),
      'Email_ID (de la DE de SFMC)': Object.keys(c.email_ids || {}).join(', '),
      'Content_ID (SFMC)': Object.keys(c.content_ids || {}).join(' · '),
      'Email_ID (SFMC)': Object.keys(c.email_ids || {}).join(', '),
      // 🔴 F3 · Email_Name (nombre completo de la pieza) y los subjects Principal y FUP.
      'Email_Name': Object.keys(c.email_names || {}).join(' · '),
      'EmailName': Object.keys(c.email_names || {}).join(' · '),
      'Content_ID': Object.keys(c.content_ids || {}).join(' · '),
      'Email_ID': Object.keys(c.email_ids || {}).join(', '),
      'P_Subject': c.principal.subject || '', 'Principal_Subject': c.principal.subject || '',
      'FUP_Subject': c.fup.subject || 'N/A',
      // 🔴 LAS COLUMNAS QUE RICK AGREGO Y ESTABAN EN CERO. La rejilla guardaba email_names
      //    como un monton -- todos los nombres de la celda juntos-- y desde ahi no se puede saber
      //    cual es del Principal y cual del FUP. resumen-fusionar los separa usando el Email_Type del catalogo.
      'Email Name SFMC_Principal': c.principal.email_name || 'N/A',
      'Email Name SFMC_FUP': c.fup.email_name || 'N/A',
      'Content ID (Final del Email Name) Principal': c.principal.content_id || 'N/A',
      'Content ID (Final del Email Name) _ FUP': c.fup.content_id || 'N/A',
      'Email_ID (de la DE de SFMC) _ FUP': c.fup.email_id || 'N/A',
      // 🔴 LA QUINCENA DEL FUP. 10 de 34 seguimientos salieron en otra quincena que su
      //    Principal; sin esta columna el reporte parece decir que salieron juntos.
      'FUP_Quincena': c.fup_quincena || 'N/A',
      // 🔴 Canal gana sobre Medio (decision de Rick): un solo nombre para el mismo dato.
      'Canal': c.medio,
      // ══ 7-sep-2026 · LA FECHA DE ENVÍO, que pidió Rick a la izquierda de cada Subject ════
      // 🔴 SALE DEL DETALLE DÍA POR DÍA, NO DE LA DE AGREGADA. `Fecha_Primer_Envio` de la DE
      //    dice, para E-PROP1, **3-ago** — y ese día SFMC solo registró cuatro jobs de UN envío:
      //    pruebas. El envío real arrancó el **24-ago**. Poner aquí la fecha de la DE habría
      //    hecho visible el error en vez de corregirlo, y encima con cara de dato.
      // 🔴 ES LA FECHA EN QUE EMPEZÓ A SALIR. Cuando el bloque goteó varios días (un always-on),
      //    el rango completo vive en `Fecha_Primer_Envio`/`Fecha_Ultimo_Envio` del catálogo;
      //    aquí va el arranque, que es lo que se lee como «cuándo salió».
      'Principal_Fecha_Envio': c.principal.fecha_ini ? serial(c.principal.fecha_ini) : '',
      'FUP_Fecha_Envio': c.fup.fecha_ini ? serial(c.fup.fecha_ini) : '',

      'Principal_Sends': c.principal.sends, 'Principal_Deliveries': c.principal.deliveries,
      'Principal_Opens': c.principal.opens, 'Principal_Clicks': c.principal.clicks,
      'Principal_Open_Rate': pct(c.principal.open_rate), 'Principal_CTOR': pct(c.principal.ctor),
      'Principal_Click_Rate': pct(c.principal.click_rate),
      'FUP_Sends': c.fup.sends, 'FUP_Deliveries': c.fup.deliveries, 'FUP_Opens': c.fup.opens,
      'FUP_Clicks': c.fup.clicks, 'FUP_Open_Rate': pct(c.fup.open_rate), 'FUP_CTOR': pct(c.fup.ctor),
      'FUP_Click_Rate': pct(c.fup.click_rate),
      'Tot_Sends': c.total.sends, 'Tot_Deliveries': c.total.deliveries, 'Tot_Opens': c.total.opens,
      'Tot_Clicks': c.total.clicks, 'Tot_Open_Rate': pct(c.total.open_rate),
      'Tot_CTOR': pct(c.total.ctor), 'Tot_Click_Rate': pct(c.total.click_rate),
      'WA-Envíos': c.whatsapp.sends, 'WA-Entregados': c.whatsapp.deliveries,
      'WA-No entregados': c.whatsapp.no_entregados, 'WA-Leídos': c.whatsapp.read,
      'WA-Clicks': c.whatsapp.clicks_medidos ? c.whatsapp.clicks : '',
      'WA-%Entrega': pct(c.whatsapp.delivery_rate),
      'WA-%No entrega': pct(c.whatsapp.sends ? c.whatsapp.no_entregados / c.whatsapp.sends : null),
      'WA-%Read vs entrega': pct(c.whatsapp.read_rate),
      'WA-%Click vs Read': pct(c.whatsapp.ctor),
      // 🔴 EL NOMBRE FÍSICO ES EL DE LA HOJA: «Audiencia_DE SFMC», no «Audiencia_DE». Con el nombre
      //    corto se escribía a una columna INEXISTENTE: la rejilla traía la audiencia de 95 de 98
      //    envíos y el reporte mostraba 0 de 77 — en verde, porque ninguna suma cambia si el valor
      //    cae en el vacío. Es el «0 y 0» por el que nació el registro de nombres, y lo enseñó el
      //    render, no un check. El check que faltaba (una columna que el reporte debe llenar y sale
      //    100% vacía) está ahora en N6-99.
      'Audiencia_DE SFMC': Object.keys(c.audiencias || {}).join(' · ') || (c.audiencia_de || ''),
      'Audiencia_Volumen SFMC': c.audiencia_volumen || null,
      'Unsubs_Unicos': c.total.unsubs || null,   // mismo arreglo: el campo por celda queda viejo tras fusionar
      'Unsubs_Total': null,   // D3 · «unsuscribe total se quita» → se limpia; vale Unsubs_Unicos
      // 🔴 D5 (Rick, 26-ago-2026) · EL DESGLOSE DE CLICKS POR DESTINO NO SE REPORTA.
      //    «No los estás atribuyendo bien o no los estás agrupando bien, y no tenemos el tiempo
      //     ahorita para hacerlo. Lo único que sí me interesa es el Unsubscribe.»
      //
      //    EL CASO QUE LO PRUEBA: «Fuel for life» tiene **29 piezas y CERO con Qcart declarado**
      //    en el catálogo, y la hoja le atribuía **113 Clicks_Qcart** — intención de compra en una
      //    campaña que no la tiene. No es un caso suelto: 28 piezas recibían clicks de «qcart» sin
      //    tenerlo. La clase se lee de la URL, y eso es correcto A NIVEL DE LINK; el error está en
      //    presentarlo como intención de compra A NIVEL DE PIEZA, que es otra afirmación.
      //
      // 🔴 SE DEJA DE ESCRIBIR, NO SE BORRA LA MEDICIÓN. `motor.links.js` sigue clasificando y
      //    `_fuentes/links.json` conserva el desglose entero: el día que se decida cómo agruparlo,
      //    el dato está. Lo que se retira es la AFIRMACIÓN en el reporte, que es lo que estaba mal.
      //    Las celdas quedan vacías a propósito — Rick lo autorizó explícitamente para este corte.
      '%_Qcart': null, '%_App': null, '%_Social': null, '%_Web': null, '%_Ver_Navegador': null,
      'Clicks_Qcart': null, 'Clicks_App': null, 'Clicks_Social': null,
      'Clicks_Web': null, 'Clicks_Ver_Navegador': null,

      // ══ 19-sep-2026 · EL DESGLOSE QUE SÍ SE REPORTA — 3 columnas × 3 bloques ═══════════════
      // 🔴 ESTO NO DESHACE LA D5 DE ARRIBA. Lo que se retiró el 26-ago fue la AFIRMACIÓN de un
      //    clasificador con catch-all: `web` se quedaba con todo lo desconocido y por eso «Fuel
      //    for life» —29 piezas, cero Qcart declarado— mostraba 113 `Clicks_Qcart`. Lo que cambió
      //    es el clasificador, no la decisión: ahora el reparto sale de un contrato sin catch-all
      //    (`_contratos/clicks-destinos.json`), lo auditan 5 validaciones, y el detalle vive en
      //    `_fuentes/links.json` (la autoridad del desglose). Las 5 columnas viejas siguen retiradas.
      // 🔴 Y EL VALOR SE PIDE, NO SE CALCULA AQUÍ. `resumen-fusionar` es el único sitio que sabe a
      //    la vez qué pieza es Principal, cuál es FUP, y qué links tiene cada una. Aquí solo se
      //    transcribe — el escritor transcribe, el backend calcula (doctrina de escritura).
      'Principal_Clicks_CTA': desg(c.principal, CDv.COL_CTA),
      'Principal_Clicks_Baja': desg(c.principal, CDv.COL_BAJA),
      'Principal_Clicks_Redes+Navegador+Legal': desg(c.principal, CDv.COL_RNL),
      'FUP_Clicks_CTA': desg(c.fup, CDv.COL_CTA),
      'FUP_Clicks_Baja': desg(c.fup, CDv.COL_BAJA),
      'FUP_Clicks_Redes+Navegador+Legal': desg(c.fup, CDv.COL_RNL),
      'Tot_Clicks_CTA': desgTot(c, CDv.COL_CTA),
      'Tot_Clicks_Baja': desgTot(c, CDv.COL_BAJA),
      'Tot_Clicks_Redes+Navegador+Legal': desgTot(c, CDv.COL_RNL),
      /* 🔴 EL TOTAL CON EL QUE EL DESGLOSE SÍ SE COMPARA (24-sep-2026). `*_Clicks` son únicos POR
       * CORREO y el desglose suma clicks POR LINK: comparar uno con otro daba «325 de CTA sobre un
       * total de 288» en 98 de 101 piezas. `Clicks_Medidos` es la suma del propio desglose, así que
       * la regla de Rick se cumple por construcción. Pasa por los MISMOS `desg`/`desgTot`, así que
       * hereda los tres estados: `N/A` si el bloque no tuvo clicks, `POR DEFINIR` si los tuvo y no
       * hay links — nunca un 0 que se lea como medición. */
      'Principal_Clicks_Medidos': desg(c.principal, CDv.COL_MEDIDOS),
      'FUP_Clicks_Medidos': desg(c.fup, CDv.COL_MEDIDOS),
      'Tot_Clicks_Medidos': desgTot(c, CDv.COL_MEDIDOS),

      // ── LO QUE SÍ SE MANTIENE: EL UNSUBSCRIBE ────────────────────────────────────────
      // 🔴 «El Unsubscribe sí mantenlo.» Y se mantiene entero: el click en el link de baja, su
      //    tasa sobre los clicks, y las dos lecturas de la baja real (más abajo). El desglose de
      //    destino se retira para todos MENOS éste, porque éste es el que Rick usa.
      'Clicks_Unsub': (c.clicks_por_destino || {}).unsub || null,
      '%_Unsub': tasaDest(c, 'unsub'),
      'Clicks_Unicos_Total': c.links_clicks_unicos || null,
      'Clicks_Links_Total': c.links_clicks_unicos || null,

      // ── LAS BAJAS · las dos columnas que pidió Rick, con el MISMO numerador y distinto
      //    denominador. «Lo puse en el total de envíos; la duplicas en total de clicks, análisis
      //    al final.» Son dos lecturas del mismo hecho y por eso van juntas:
      //      · sobre ENVÍOS  → qué proporción de la base se dio de baja (salud de la lista)
      //      · sobre CLICKS  → de los que interactuaron, cuántos lo hicieron para irse
      //
      // 🔴 EL NUMERADOR NO ES `Clicks_Unsub`. Ese cuenta clicks en el link de baja, que no es lo
      //    mismo que una baja: SFMC entrega la baja de verdad en `email_unique_unsubs`, y el motor
      //    ya la agrega como `unsubs_unicos` (Σ 41,376 en 93 envíos). Usar el click habría dado un
      //    número parecido y equivocado — de los peores, porque nadie lo nota.
      //
      // 🔴 Y NO SE VUELVE A LLENAR `Unsubs_Total`. Aquí escribí `'Unsubs_Total': c.unsubs_unicos`
      //    veinte líneas debajo de `'Unsubs_Total': null` — la MISMA llave dos veces en el mismo
      //    objeto. JS se queda con la última sin avisar, así que mi línea pisó en silencio la
      //    decisión D3 de Rick («unsuscribe total se quita»). Es el defecto de la llave repetida
      //    invisible, otra vez, y esta vez borrando una decisión suya en vez de un dato.
      //    El conteo vive en `Unsubs_Unicos`; estas dos columnas son sus dos lecturas.
      // 🔴 EL NOMBRE FÍSICO DE ESTA COLUMNA CAMBIÓ Y EL MAPEO NO LA SIGUIÓ. En la hoja se llama
      //    **`% Unsuscribe vs sends`**; aquí la llave decía solo `% Unsuscribe`, y `nmEncabezado`
      //    normaliza mayúsculas y acentos pero no adivina un sufijo. Resultado: el valor se
      //    calculaba bien y **no aterrizaba en ninguna columna** — el defecto «0 y 0» otra vez, y
      //    esta vez sobre una de las dos columnas que Rick pidió explícitamente. Lo destapó
      //    simular la hoja y barrer columna por columna: **71 valores se habrían perdido**, sin
      //    que ninguna suma cambiara y sin que ninguna puerta lo viera.
      // 🔴 SE MAPEAN LOS DOS NOMBRES, no se renombra la hoja: el id lógico es inmutable y el
      //    nombre físico es de Rick. Mismo patrón que `Clicks_Unicos_Total` / `Clicks_Links_Total`.
      '% Unsuscribe': c.total.sends ? (c.total.unsubs || 0) / c.total.sends : null,
      '% Unsuscribe vs sends': c.total.sends ? (c.total.unsubs || 0) / c.total.sends : null,
      '% Unsub vs Clicks': c.total.clicks ? (c.total.unsubs || 0) / c.total.clicks : null,

      // ══ 4-sep-2026 · EL UNSUBSCRIBE COMPLETO, POR BLOQUE (Rick) ═══════════════════════
      // «necesito el unsubscribe completo, y necesito que lo dividas el unsubscribe versus los
      //  sends y versus los opens, tanto para las versiones principales como para los subs como
      //  para el total. O sea, para todo, y que esas columnas sí queden en el reporte.»
      //
      // 🔴 LOS NOMBRES, PORQUE ÉL DIJO QUE NO LOS SABÍA: la baja sobre ENVÍOS es la
      //    **unsubscribe rate** (salud de la lista: qué proporción de la base se fue). La baja
      //    sobre OPENS es la **UTOR — unsubscribe-to-open rate** (salud del contenido: de los
      //    que abrieron, cuántos se fueron). El encabezado lleva el denominador entre
      //    paréntesis para que no haya que acordarse de cuál es cuál.
      //
      // 🔴 Y NO SE DUPLICA EL TOTAL. `Tot_Unsubs` sería `Unsubs_Unicos` con otro nombre y
      //    `Tot_Unsub_Rate` sería `% Unsuscribe vs sends` con otro nombre: dos columnas con el
      //    mismo número es el defecto de la llave repetida, en versión visible. Del bloque
      //    Total solo falta la lectura sobre opens, y ésa sí se agrega.
      // 🔴 9-sep-2026 · DOS LECTURAS POR BLOQUE, NO TRES. Rick: «los unsuscribe en volumen para
      //    … principales, fups y total … es # de unsuscribe y **deja solo el Unsuscribe vs open
      //    rate**. Nadamas». Las tres `_Unsub_Rate (vs sends)` se dejan de calcular AQUÍ, que es
      //    donde nacen; retirarlas solo del Excel las habría dejado vivas en el backend y la
      //    etapa 12 las escribiría otra vez sobre columnas que ya no existen — un valor que cae
      //    en una columna inexistente no mueve ninguna suma y nadie lo ve (regla E2).
      //    No se pierde nada medible: la tasa sobre envíos es el conteo entre los sends, y las
      //    dos columnas se quedan en la fila.
      'Principal_Unsubs': c.principal.unsubs || null,
      'Principal_UTOR (vs opens)': c.principal.opens ? (c.principal.unsubs || 0) / c.principal.opens : null,
      'FUP_Unsubs': c.fup.unsubs || null,
      'FUP_UTOR (vs opens)': c.fup.opens ? (c.fup.unsubs || 0) / c.fup.opens : null,
      // 🔴 Y EL BLOQUE TOTAL LLEVA LAS TRES. Dije que `Tot_Unsubs` duplicaría `Unsubs_Unicos`
      //    y que `Tot_Unsub_Rate` duplicaría `% Unsuscribe vs sends`. Ninguna de las dos está
      //    en la hoja: Rick las retiró a mano. Lo leí en los comentarios de este archivo en vez
      //    de leerlo en la hoja — y la hoja es la autoridad de su propia forma.
      // 🔴 EL NUMERADOR ES `c.total.unsubs`, NO `c.unsubs_unicos`. Los dos valen lo mismo al
      //    salir del motor —está verificado ahí con una identidad explícita— y dejan de valer
      //    lo mismo en cuanto `fusionar-fup` mueve un FollowUp de celda: ése recalcula
      //    `c.total` y no `c.unsubs_unicos`. Con el campo viejo, `Tot_Unsubs` daba 46,367
      //    contra 48,478 de Principal+FUP: 2,111 bajas perdidas en las celdas fusionadas.
      'Tot_Unsubs': c.total.unsubs || null,
      // `Tot_Unsub_Rate (vs sends)` retirada el 9-sep con sus dos hermanas — ver la nota de arriba.
      'Tot_UTOR (vs opens)': c.total.opens ? (c.total.unsubs || 0) / c.total.opens : null
    };
    if (q) {
      M['Receta_Representativa'] = q.receta_representativa || '';
      M['FechaQcart_Desde'] = serial(q.desde); M['FechaQcart_Hasta'] = serial(q.hasta);
      M['Carritos_Walmart'] = q.carritos_walmart; M['Carritos_Chedraui'] = q.carritos_chedraui;
      M['Carritos_Total'] = q.carritos; M['Views_Carrito'] = q.views;
      M['Views_Productos_Nestle'] = q.views_productos;
      M['Intencion_Total_MXN'] = q.importe_total; M['Intencion_Nestle_MXN'] = q.importe_nestle;
      M['Pct_Penetracion_Nestle'] = pct(q.penetracion);
      M['Ticket_Carrito_MXN'] = pct(q.ticket_carrito); M['Ticket_Producto_MXN'] = pct(q.ticket_producto);
      // ⚠ la hoja las llama «_%» pero son MULTIPLICADORES, no porcentajes (shortlink único por canal).
      M['Views_vs_Clicks_%'] = pct(q.views_vs_clicks); M['Carritos_vs_Clicks_%'] = pct(q.carritos_vs_clicks);
      M['Tasa_Productos_a_Carritos'] = pct(q.productos_a_carritos);
    } else {
      // 🔴 sin Qcart se pone null (calculada y vacía), NO se omite: omitir deja vivo el Qcart de una
      //    corrida anterior en una fila que ya no lo ancla.
      ['Receta_Representativa', 'FechaQcart_Desde', 'FechaQcart_Hasta', 'Carritos_Walmart', 'Carritos_Chedraui',
        'Carritos_Total', 'Views_Carrito', 'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN',
        'Pct_Penetracion_Nestle', 'Ticket_Carrito_MXN', 'Ticket_Producto_MXN', 'Views_vs_Clicks_%',
        'Carritos_vs_Clicks_%', 'Tasa_Productos_a_Carritos'].forEach(function (k) { M[k] = null; });
    }
    if (M[nombre] !== undefined) return M[nombre];
    // el nombre de la hoja puede llevar acentos o cortes distintos: se casa por prefijo normalizado
    var nn = nmEncabezado(nombre);
    var hit = Object.keys(M).filter(function (k) { return nmEncabezado(k) === nn; })[0];
    if (hit) return M[hit];

    // 🔴 SI EL NOMBRE NO CASA, SE LE PREGUNTA AL REGISTRO — no se devuelve `undefined` sin más.
    //    La hoja renombró `Quincena_Lanzamiento` a `Quincena_Lanzamiento Principal` y este mapa
    //    siguió con el nombre viejo: la columna se escribía VACÍA en las 76 filas. Y como la
    //    quincena forma parte de la llave del reporte, la cascada fue larga — la Puerta 2 vio las
    //    76 filas como «de Rick» y los insights se quedaron sin dónde escribirse. Una sola columna
    //    muda tumbó el cierre del corte.
    //    El registro sabe que las dos son la misma columna: se traduce por su alias histórico.
    try {
      var REG = require(__dirname + '/lib-registro.js');
      var reg = REG.cargar();
      var col = Object.keys(reg.columnas).map(function (k) { return reg.columnas[k]; })
        .filter(function (x) {
          return x.ambito === 'resumen' &&
            (x.nombres || []).concat(x.alias_historicos || []).some(function (n) { return REG.nmz(n) === REG.nmz(nombre); });
        })[0];
      if (col) {
        var todos = (col.nombres || []).concat(col.alias_historicos || []);
        var h2 = Object.keys(M).filter(function (k) {
          return todos.some(function (n) { return REG.nmz(n) === REG.nmz(k); });
        })[0];
        if (h2) return M[h2];
      }
    } catch (e) { /* sin registro, se comporta como antes */ }
    return undefined;
  };
}

/**
 * 🔴 LA LLAVE DEL REPORTE, EN UN SOLO SITIO.
 *
 * Estaba escrita CUATRO veces —`PUERTA-2`, `N6-99`, `insights-redactar` y aquí— y las cuatro clavaban el nombre físico
 * `Quincena_Lanzamiento`. Cuando la hoja pasó a llamarla `Quincena_Lanzamiento Principal`, las
 * cuatro dejaron de cruzar a la vez, cada una con un síntoma distinto y ninguno parecido al otro:
 *   · `PUERTA-2` clasificó las 76 filas como «de Rick» y las excluyó — sin tronar.
 *   · `N6-99` reportó las 76 celdas «sin escribir» mientras el check de al lado daba 912 cifras
 *     por buenas.
 *   · `insights-redactar` escribió 0 insights, lo dijo en su log, y salió en verde igual.
 * Cuatro copias de una regla es cuatro sitios donde acordarse. Aquí se pide.
 *
 * @param x    una fila de la hoja, o una celda de la rejilla
 * @param esHoja  true si `x` es una fila de la hoja
 */
function llaveDeFila(x, esHoja) {
  var tt = function (v) { return String(v == null ? '' : v).trim(); };
  if (!esHoja) {
    return [tt(x.campana), tt(x.objetivo), tt(x.touchpoint), tt(x.segmento), tt(x.quincena)].join('¦');
  }
  var q = '';
  try {
    var REG = require(__dirname + '/lib-registro.js');
    var reg = REG.cargar();
    var col = reg.columnas['resumen.quincena_lanzamiento'];
    var nombres = ((col && col.nombres) || []).concat((col && col.alias_historicos) || []);
    var k = nombres.filter(function (n) { return tt(x[n]); })[0];
    q = k ? tt(x[k]) : '';
  } catch (e) { q = tt(x['Quincena_Lanzamiento Principal'] || x['Quincena_Lanzamiento']); }
  return [tt(x['Campaña']), tt(x['Objetivo']), tt(x['TouchPoint']), tt(x['Segmento']), q].join('¦');
}

module.exports = { crear: crear, pct: pct, MES_NUM: MES_NUM, tasaDest: tasaDest, llaveDeFila: llaveDeFila };
