// EL CONTRATO DE HOJA — qué columna se llena con qué. Declarado, no programado.
//
// 🔴 POR QUÉ EXISTE. Esta tabla vivía como código dentro del escritor: un `switch` de 20 casos
//    en `N3-07`, con una SEGUNDA COPIA en `N3-05`. Con el conocimiento de negocio ahí adentro,
//    el escritor no es un copiador: decide. Y decidir en dos lugares distintos es cómo se
//    separan. Aquí se declara una vez y el escritor solo obedece.
//
// 🔴 LOS CANÓNICOS SE LLAMAN DISTINTO EN CADA HOJA. `Data_Email` dice `BU_Canonico`,
//    `Data_WhatsApp` dice `BU`, y `Data_Qcart_*` no los tenía. Por eso cada columna canónica
//    declara su DIMENSIÓN LÓGICA (`bu`, `marca`, `campana`, `segmento`): así se puede exigir
//    —como pidió Rick— que el mismo `pieza_id` muestre el mismo valor en TODAS las hojas,
//    aunque la columna se llame distinto en cada una.
//
// Cada columna declara de dónde sale. Cinco orígenes, y ninguno se adivina:
//
//   bloque    · lo trae el bloque de la fuente        → se escribe
//   catalogo  · sale de Catalogo_Piezas por pieza_id  → se escribe  (🔴 manda el catálogo)
//   derivado  · se calcula de otra columna del propio bloque (mes, quincena) → se escribe
//   n5        · es una tasa o un flag: los calcula N5 → NO se toca
//   conservar · la hoja lo tiene y NINGUNA fuente lo reproduce → NO se toca, y se declara
//
// ⚠ `conservar` es deuda, no una categoría cómoda. Cada columna ahí es una columna que, si se
//   borrara, nadie podría reponer. Están listadas a propósito para que se vean.

var DIMENSION = { bu: 'bu', marca: 'marca', campana: 'campana', segmento: 'segmento' };

module.exports = {
  dimensiones: DIMENSION,

  hojas: {

    // ══════════════════════════════════════════════════════════════════════════════
    Data_Email: {
      bloque: 'email', registros: 'envios',
      // La llave empareja una fila de la hoja con un registro del bloque, y CADA parte declara
      // su columna y su tipo. Antes el escritor lo adivinaba por nombre y se equivocaba:
      //   · `journey_id` del bloque es un GUID (o vacio); la columna `Journey_ID` de la hoja
      //     guarda el JID NUMERICO. Son identificadores distintos — 66 filas quedaban sin pareja
      //     y las 198 que si emparejaban estaban pareando filas equivocadas.
      //   · `content_name` SOLO tampoco sirve: 264 registros comparten 88 nombres (15 repetidos).
      // La buena es content_name + fecha, que es la llave que el propio bloque declara.
      // 🔴 Y AUN ASÍ ERA LA LLAVE EQUIVOCADA, POR UN MOTIVO DISTINTO: `Email_Name` está VACÍA en
      //    la hoja. Es una columna que llena el propio escritor — así que la llave le pedía como
      //    ancla algo que solo existiría DESPUÉS de escribir. Emparejaba 0 de 98 filas y N4
      //    reportaba «celdas que cambiarían: 0» sin que nada se pusiera rojo: la hoja de email
      //    llevaba corridas enteras sin recibir una sola celda, y el ciclo cerraba en verde.
      //    Es el mismo error que el ancla del Qcart: **la llave se pega a una celda que YA EXISTE,
      //    nunca a una que el paso va a fabricar.**
      //    `Pieza_ID` sí está: 98 de 98, única en la hoja y única en el bloque, y los dos conjuntos
      //    coinciden exacto (0 registros sin fila). Es además el ancla declarada de todo el sistema.
      llave: [
        { campo: 'pieza_id', columna: 'Pieza_ID' }
      ],
      columnas: {
        // identidad cruda que sí trae el bloque
        // 🔴 RECLASIFICADAS TRAS MIRAR EL DIFF. Las tenia como 'bloque' por el parecido del
        //    nombre, y escribirlas habria DESTRUIDO datos. El diff lo probo celda por celda:
        //      Campaign  : el bloque habria vaciado 104 celdas y metido el CONTENT NAME en otras
        //                  («O_AO-RECETAS-NESTLE-NC000600...» -> Campaign). `campana_raw` del
        //                  bloque no es lo que guarda esta columna.
        //      Segment   : habria vaciado 80 celdas con valores reales («Career Focused»,
        //                  «New Parents»): el bloque trae `segmento_raw` vacio en esas filas.
        //    El parecido de los nombres es justo lo que el sistema prohibe usar como criterio.
        Campaign: { de: 'conservar', deuda: 'el bloque trae campana_raw, que NO es esta columna: escribirlo vaciaria 104 celdas y meteria el content name' },
        Segment: { de: 'conservar', deuda: 'el bloque trae segmento_raw vacio en 80 filas que aqui SI tienen valor' },
        Email_Type: { de: 'bloque', campo: 'email_type' },
        TouchPoint: { de: 'bloque', campo: 'touchpoint_raw' },
        //      Journey_ID: el bloque trae el GUID y esta columna guarda el JID NUMERICO. Son
        //                  identificadores distintos — escribirlo pisaria 60 y vaciaria 6.
        //      Source    : la hoja dice «Datorama WK32» (el corte); el bloque, el nombre del
        //                  archivo. Escribirlo pierde de que semana es el dato.
        Journey_ID: { de: 'conservar', deuda: 'el bloque trae el GUID; esta columna guarda el JID numerico. Identificadores distintos' },
        Source: { de: 'conservar', deuda: 'la hoja guarda el corte (Datorama WK32) y el bloque el nombre del archivo' },
        Send_Date: { de: 'bloque', campo: 'fecha', tipo: 'fecha' },
        Canal: { de: 'bloque', campo: 'canal' },
        Nombre_Journey: { de: 'bloque', campo: 'nombre_journey' },
        Email_Name: { de: 'bloque', campo: 'content_name' },
        Audience_Name: { de: 'bloque', campo: 'audiencia' },
        Email_Sends: { de: 'bloque', campo: 'email_sends', tipo: 'numero' },
        Email_Deliveries: { de: 'bloque', campo: 'email_deliveries', tipo: 'numero' },
        Email_Unique_Opens: { de: 'bloque', campo: 'email_unique_opens', tipo: 'numero' },
        Email_Unique_Clicks: { de: 'bloque', campo: 'email_unique_clicks', tipo: 'numero' },
        Email_Bounces: { de: 'bloque', campo: 'email_bounces', tipo: 'numero' },
        //      Excluido_Motivo: la hoja tiene motivos escritos a mano («BASE INSUFICIENTE»,
        //                  «DUPLICADO») y el bloque solo sabe decir «sin pareja en el export».
        //                  El del bloque es mas pobre: escribirlo borraria 18 motivos reales.
        Excluido_Motivo: { de: 'conservar', deuda: 'los motivos de la hoja son mas ricos que el estado_diff del bloque' },

        // 🔴 EL ANCLA. Sin esta columna la regla «los canonicos coinciden entre todas las hojas»
        //    no se puede comprobar fila a fila: N6-99 solo podia cruzar las dos hojas de Qcart,
        //    que son las unicas que la tenian, y ninguna pieza estaba en las dos a la vez.
        //    Con el pieza_id en las cuatro, la invariante deja de ser una intencion.
        Pieza_ID: { de: 'bloque', campo: 'pieza_id', nueva: true },

        // 🔴 LAS CANÓNICAS — manda el catálogo (decisión de Rick, 20-ago-2026)
        BU_Canonico: { de: 'catalogo', campo: 'BU', dimension: DIMENSION.bu },
        Marca: { de: 'catalogo', campo: 'Marca', dimension: DIMENSION.marca },
        'Campaña': { de: 'catalogo', campo: 'Campaña', dimension: DIMENSION.campana },
        Segmento: { de: 'catalogo', campo: 'Segmento', dimension: DIMENSION.segmento },

        // derivadas de la fecha del propio bloque
        Send_Month: { de: 'derivado', formula: 'mes', desde: 'fecha' },
        Quincena: { de: 'derivado', formula: 'quincena', desde: 'fecha' },
        // 🔴 MANDA EL CALCULO (decision de Rick, 20-ago-2026). Lo cargado y el calculo ISO
        //    discrepaban una semana: para el envio del 2026-05-02 la hoja decia WK19 y el
        //    calendario ISO 2026 pone esa fecha en la semana 18 (27-abr a 3-may). Se derivan
        //    las dos de la fecha del propio bloque, que es la unica forma de que no vuelvan a
        //    separarse: una etiqueta escrita a mano se queda quieta cuando la fecha cambia.
        Send_Week: { de: 'derivado', formula: 'lunes_serial', desde: 'fecha', tipo: 'numero' },
        Send_Week_Label: { de: 'derivado', formula: 'semana_iso', desde: 'fecha' },

        // las calcula N5 — aquí no se tocan
        Delivery_Rate: { de: 'n5' }, Open_Rate: { de: 'n5' }, Click_Rate: { de: 'n5' },
        CTOR: { de: 'n5' }, Bounce_Rate: { de: 'n5' },
        Flag_Zero_Sends: { de: 'n5' }, Flag_Negative_Values: { de: 'n5' }, Flag_Rate_Mismatch: { de: 'n5' },

        // ⚠ DEUDA: la hoja las tiene y ninguna fuente las reproduce. Si se borran, no vuelven.
        BU: { de: 'conservar', deuda: 'el export no trae el BU crudo; el canónico está en BU_Canonico' },
        Journey: { de: 'conservar', deuda: 'la columna se llama Journey pero guarda el OBJETIVO («Purchase»). El bloque no lo trae' },
        Version: { de: 'conservar', deuda: 'solo 80 de 264 filas la tienen; el export no la entrega' },
        Subject_Clean: { de: 'conservar', deuda: 'el asunto limpio se escribió a mano; el export trae Email_Subject_Raw' },
        Report_Period: { de: 'conservar', deuda: 'el WK del pull viejo; hoy la fecha ya lo determina' },
        Email_Sender_Name: { de: 'conservar', deuda: 'no está en el bloque' },
        Datorama_Campaign: { de: 'conservar', deuda: 'no está en el bloque' },
        Datorama_Campaign_ID: { de: 'conservar', deuda: 'no está en el bloque' },
        Email_Subject_Raw: { de: 'conservar', deuda: 'no está en el bloque' },
        Brand: { de: 'conservar', deuda: 'solo 75 de 264; se solapa con Marca' }
      }
    },

    // ══════════════════════════════════════════════════════════════════════════════
    Data_WhatsApp: {
      bloque: 'whatsapp', registros: 'envios',
      // 🔴 `campana_raw + sends` NO SEPARA a los dos de Mundial: Partido 2 y Partido 3 tienen los
      //    MISMOS 162 sends, así que los dos daban la llave «mundial¦162». El emparejador se queda
      //    con el último, de modo que las dos filas recibían los datos de `004-P013` y `004-P010`
      //    desaparecía — en silencio, porque «sin pareja» seguía dando 0: las dos filas SÍ
      //    emparejaban, solo que con el registro equivocado.
      //    La atribución sí los distingue (por el alias declarado «Tercer Partido → Partido 3»),
      //    y lo que la distingue es justo el `pieza_id`. Es el ancla del sistema y está en las 12
      //    filas de la hoja, única de los dos lados. La llave lo usa; el resto queda de contraste.
      /* 🔴 30-sep-2026 · LA LLAVE LLEVABA UNA MÉTRICA, Y POR ESO PERDIÓ UN ENVÍO.
       *    Era `pieza_id + campana_raw + **sends**`. Este sistema ya tiene escrita la regla de que
       *    una llave de identidad no puede llevar una métrica —las gemelas de Pro Plan, 8-sep:
       *    «un número que cambia con cada refresh no identifica nada»—. Aquí mordió por el otro
       *    lado: un número que es IGUAL en dos filas tampoco las distingue.
       *
       *    La Jornada 10 de WhatsApp tiene TRES envíos y dos de ellos mandaron exactamente 1,085.
       *    El escritor emparejó las dos filas de la hoja con el MISMO registro: `SAB-2PM` (343
       *    leídos, 912 entregados) desapareció y quedó una segunda copia de `SAB-12PM`. La hoja
       *    sumaba 11,033 leídos donde el bloque —y la fuente— dicen 10,937.
       *
       *    Funcionó hasta ahora por casualidad: J8 mandó 985 y 977, J9 mandó 2,000 y 560. En
       *    cuanto dos envíos de una pieza coincidieron en volumen, la llave dejó de ser llave.
       *
       * 🔴 EL RECAMBIO YA ESTABA DOCUMENTADO AQUÍ ABAJO, en la nota de `Whatsapp_Name`: «la llave
       *    de una entidad de envíos tomada de la tabla de piezas no puede distinguir dos envíos de
       *    la misma pieza. Con esto, los 16 envíos tienen 16 nombres distintos». Se arregló la
       *    COLUMNA el 22-sep y no la LLAVE — que es donde hacía falta.
       *
       * ⚠ `sends` se queda FUERA, no se suma al final: una llave que incluya una métrica vuelve a
       *   emparejar mal en cuanto esa métrica se refresque (opens y clicks maduran, y un re-pull
       *   puede corregir `sends`). El nombre no se mueve; el volumen sí. */
      llave: [
        { campo: 'pieza_id', columna: 'Pieza_ID' },
        { campo: 'campana_raw', columna: 'Campana_Raw' },
        { campo: 'whatsapp_name', columna: 'Whatsapp_Name' }
      ],
      columnas: {
        // 🔴 `Campaña` ES CANÓNICA, NO CRUDA — y estaba declarada al MISMO campo que `Campana_Raw`.
        //    Dos columnas del prefijo apuntando al mismo dato es, literalmente, una columna
        //    duplicada: la hoja decía «ICE» en las dos, cuando el canónico es «The Freshers» (ICE
        //    es la MARCA — lo decidió Rick el 20-ago). El reporte sí traía el canónico, porque sale
        //    del catálogo, así que las dos vistas del mismo envío no cruzaban y el guardián de
        //    WhatsApp declaró los 12 envíos «sin llegar a ningún reporte». Estaban todos.
        //    `Campana_Raw` conserva el crudo: para eso existe, y es lo que permite contrastar.
        Campaña: { de: 'catalogo', campo: 'Campaña', dimension: DIMENSION.campana },
        Campana_Raw: { de: 'bloque', campo: 'campana_raw' },
        Objetivo: { de: 'bloque', campo: 'objetivo' },
        Segmento_WA_Raw: { de: 'bloque', campo: 'segmento_raw' },
        Canal: { de: 'bloque', campo: 'canal' },
        /* 🔴 LA HOJA CRUDA TAMBIÉN LLEVA LA IDENTIDAD (15-sep-2026). `Whatsapp_Name` es la llave
         *    natural del canal, y una hoja de datos que no la lleva obliga a volver al catálogo
         *    para saber de qué envío habla cada fila.
         *
         * 🔴 22-sep-2026 · PASA A SALIR DEL BLOQUE, NO DEL CATÁLOGO — y es un cambio de GRANO.
         *    Decía aquí: «sale del catálogo porque el bloque trae el journey que publicó la
         *    fuente, que para Mundial y Hotcakes no es el nombre canónico». Era cierto entonces;
         *    ya no: el bloque ahora calcula el nombre con `lib-whatsapp-nombre` —la MISMA librería
         *    que usa el catálogo— así que también es canónico, y además es **por envío**.
         *
         *    Y esa es la razón de fondo. `Data_WhatsApp` es la entidad `envio_whatsapp`: una fila
         *    = un ENVÍO. El catálogo está a grano de PIEZA, y una pieza puede tener varios envíos:
         *    `005-P011` (WA-J8) tiene dos —4PM y 5PM— y el catálogo guarda el de 4PM como nombre
         *    canónico y el de 5PM en `Whatsapp_Names_Variantes`. Mapeando desde el catálogo, los
         *    DOS envíos recibían el nombre del de las 4PM: la llave de una entidad de envíos
         *    tomada de la tabla de piezas no puede distinguir dos envíos de la misma pieza.
         *    Con esto, los 16 envíos tienen 16 nombres distintos. */
        Whatsapp_Name: { de: 'bloque', campo: 'whatsapp_name', nueva: true },
        Send_Date: { de: 'bloque', campo: 'fecha', tipo: 'fecha' },
        Sends: { de: 'bloque', campo: 'sends', tipo: 'numero' },
        Deliveries: { de: 'bloque', campo: 'deliveries', tipo: 'numero' },
        Opens_Read: { de: 'bloque', campo: 'opens_read', tipo: 'numero' },
        Clicks: { de: 'bloque', campo: 'clicks', tipo: 'numero' },
        Clicks_Medidos: { de: 'bloque', campo: 'clicks_medidos' },
        // 🔴 10-sep-2026 · `Errores` NO es lo que la gente lee como «errores». Twilio separa dos
        //    cosas y la fuente trae las dos columnas: `Failed` (no salió) y `ERROR Undelivered`
        //    (salió y no llegó). `Errores` mapea a `Failed`, que vale **0** en las dos filas de
        //    Tercer Tiempo — así que la hoja decía «0 errores» sobre un envío con **1,059**.
        //    El bloque siempre tuvo el dato en `no_entregados`; lo que faltaba era la columna
        //    donde ponerlo. El reporte ya lo mostraba en `WA-No entregados`: el hueco estaba en
        //    la capa de en medio, que es justo la que nadie cruza contra nada.
        //    Se verifica con el desglose por código Meta: 63024:302 + 63032:100 + 63049:657 = 1,059.
        Errores: { de: 'bloque', campo: 'errores', tipo: 'numero' },
        No_Entregados: { de: 'bloque', campo: 'no_entregados', tipo: 'numero', nueva: true },
        Aud_Original: { de: 'bloque', campo: 'aud_original', tipo: 'numero' },
        Aud_Filtros: { de: 'bloque', campo: 'aud_filtros', tipo: 'numero' },
        Aud_Final: { de: 'bloque', campo: 'aud_final', tipo: 'numero' },
        utm_content: { de: 'bloque', campo: 'utm_content' },
        URL: { de: 'bloque', campo: 'url' },
        Notas: { de: 'bloque', campo: 'notas_compuestas' },

        Pieza_ID: { de: 'bloque', campo: 'pieza_id', nueva: true },

        // 🔴 las mismas cuatro dimensiones, con OTROS nombres de columna
        BU: { de: 'catalogo', campo: 'BU', dimension: DIMENSION.bu },
        Marca: { de: 'catalogo', campo: 'Marca', dimension: DIMENSION.marca },
        Segmento: { de: 'catalogo', campo: 'Segmento', dimension: DIMENSION.segmento },
        // ⚠ pedía `Touchpoint` (p minúscula) y el traductor lo mapeaba a un campo que ningún bloque
        //   produce: nunca se escribía, y la hoja se quedaba con el crudo `WA-SF-A`.
        TouchPoint: { de: 'catalogo', campo: 'TouchPoint' },

        Send_Month: { de: 'derivado', formula: 'mes', desde: 'fecha' },
        Quincena: { de: 'derivado', formula: 'quincena', desde: 'fecha' },

        /* 🔴 RETIRADAS 22-sep-2026 · `Delivery_Rate` `Read_Rate` `CTOR` `Pct_Error`.
         * Rick: «Sí quita esas 4 columnas». Eran tasas DERIVADAS guardadas en la hoja: un caché
         * sin invalidación —el numerador y el denominador viven al lado, así que la tasa se
         * calcula cuando se necesita y no puede quedar desfasada—. Se quitaron de la hoja pero
         * el contrato siguió declarándolas, y `escritor.validar-contrato.js` lo cazó: «declaradas
         * y NO están en la hoja». Declarar una columna que no existe es pedirle al escritor que
         * la recree — exactamente cómo vuelve lo que se retiró. */

        Logins: { de: 'conservar', deuda: 'vacía en las 13 filas; la fuente no la trae' },
        Recetas_Capturadas: { de: 'conservar', deuda: 'vacía en las 13 filas' },
        Errores_Meta_Detalle: { de: 'conservar', deuda: 'el desglose por código Meta no se está leyendo de la fuente' }
      }
    },

    // ══════════════════════════════════════════════════════════════════════════════
    // Qcart: eran las únicas hojas 1:1 con su bloque. Se les AGREGAN las 4 canónicas para
    // que la regla «los canónicos coinciden en todas las hojas» se pueda comprobar aquí también.
    Data_Qcart_Carritos: {
      bloque: 'qcart', registros: 'carritos',
      // 🔴 LA LLAVE NO PUEDE LLEVAR LA ATRIBUCIÓN (15-sep-2026). Llevaba `pieza_id`, y el
      //    `pieza_id` es justo lo que el sistema RECALCULA: cada vez que un evento se re-ancla
      //    —porque su pieza nació después, porque se corrigió una fecha de activación, porque el
      //    maestro cambió— la llave de esa fila cambia y deja de emparejar con su propia fila.
      //    Medido: con `pieza_id` dentro, 240 filas de la hoja quedaban sin registro y 441
      //    registros sin fila, cuando la diferencia real era 201. Sin él, `fuente + fila_en_csv`
      //    empareja 0 huérfanos en la hoja y deja exactamente los 201 nuevos, sin una sola llave
      //    repetida en ninguno de los dos lados.
      //    Es la misma familia de defecto que ya costó las 12 gemelas de Pro Plan: una llave de
      //    identidad no puede llevar un valor que el propio sistema reescribe. El CSV y el número
      //    de fila dentro de él no cambian nunca — eso sí identifica un evento.
      //    Consecuencia buena y buscada: las 240 filas que traían un `pieza_id` viejo ahora sí
      //    emparejan, y el escritor les actualiza la atribución en vez de dejarlas fosilizadas.
      llave: [
        { campo: 'fuente', columna: 'fuente' },
        { campo: 'fila_en_csv', columna: 'fila_en_csv', tipo: 'numero' }
      ],
      columnas: {
        Pieza_ID: { de: 'bloque', campo: 'pieza_id' },
        fecha: { de: 'bloque', campo: 'fecha' }, hora: { de: 'bloque', campo: 'hora' },
        shortlink_code: { de: 'bloque', campo: 'shortlink_code' },
        shortlink_name: { de: 'bloque', campo: 'shortlink_name' },
        utm_campaign: { de: 'bloque', campo: 'utm_campaign' },
        utm_medium: { de: 'bloque', campo: 'utm_medium' },
        utm_source: { de: 'bloque', campo: 'utm_source' },
        utm_content: { de: 'bloque', campo: 'utm_content' },
        utm_term: { de: 'bloque', campo: 'utm_term' },
        store: { de: 'bloque', campo: 'store' },
        n_tiendas: { de: 'bloque', campo: 'n_tiendas', tipo: 'numero' },
        impressions: { de: 'bloque', campo: 'impressions', tipo: 'numero' },
        views: { de: 'bloque', campo: 'views', tipo: 'numero' },
        total_shown_price: { de: 'bloque', campo: 'total_shown_price', tipo: 'numero' },
        activacion_link: { de: 'bloque', campo: 'activacion_link' },
        link_campana: { de: 'bloque', campo: 'link_campana' },
        fuente: { de: 'bloque', campo: 'fuente' },
        fila_en_csv: { de: 'bloque', campo: 'fila_en_csv', tipo: 'numero' },
        aviso: { de: 'bloque', campo: 'aviso' },
        BU: { de: 'catalogo', campo: 'BU', dimension: DIMENSION.bu, nueva: true },
        Marca: { de: 'catalogo', campo: 'Marca', dimension: DIMENSION.marca, nueva: true },
        'Campaña': { de: 'catalogo', campo: 'Campaña', dimension: DIMENSION.campana, nueva: true },
        Segmento: { de: 'catalogo', campo: 'Segmento', dimension: DIMENSION.segmento, nueva: true },

        // 🔴 EN QCART EL TIEMPO NO SE DERIVA DE LA FECHA DE LA FILA. Cada fila es un evento de
        //    carrito, y su quincena es el ANCLA de la pieza que lo originó — no el día en que el
        //    usuario abrió el carrito. Derivarlas de `fecha` iba a pisar 2,645 celdas y mover
        //    `2026-07-Q2 → Ago-Q1` y `Julio → Agosto`: el reporte cambiaría de mes solo.
        //    Es la regla que ya está escrita: el ancla se pega a una celda que YA EXISTE.
        //    Las declara quien resuelve el ancla; el escritor NO las toca.
        Quincena: { de: 'conservar', deuda: 'la pone el ancla de la pieza, no la fecha del evento' },
        Mes: { de: 'conservar', deuda: 'idem — se deriva del ancla, no de la fila' },
        'Mes (#)': { de: 'conservar', deuda: 'idem — se deriva del ancla, no de la fila' }
      }
    },

    Data_Qcart_Productos: {
      bloque: 'qcart', registros: 'productos',
      // misma corrección que en carritos, y por el mismo motivo — ver la nota de arriba.
      // Medido aquí: con `pieza_id` dentro, 74 filas sin registro y 217 registros sin fila;
      // sin él, 0 y 143, que es la diferencia real entre la hoja (696) y el bloque (839).
      llave: [
        { campo: 'fuente', columna: 'fuente' },
        { campo: 'fila_en_csv', columna: 'fila_en_csv', tipo: 'numero' }
      ],
      hereda: 'Data_Qcart_Carritos',
      columnas: {
        product: { de: 'bloque', campo: 'product' }
      }
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// EL PREFIJO DIMENSIONAL NO SE LISTA A MANO EN CADA HOJA — se DERIVA del esquema.
//
// 🔴 POR QUÉ. Listarlo cuatro veces deja cuatro sitios que hay que acordarse de actualizar juntos,
//    y es exactamente el defecto que el prefijo vino a resolver: el contrato declaraba `Touchpoint`,
//    `Campana_Canonica`, `Send_Quincena` y `pieza_id` mucho después de que las hojas se llamaran
//    `TouchPoint`, `Campaña`, `Quincena` y `Pieza_ID`. Nadie mintió: se olvidó un lugar.
//
// 🔴 LA DECLARACIÓN ESPECÍFICA DE CADA HOJA GANA, y no es un detalle: en `Data_Email` la columna
//    `BU` es el CRUDO de SFMC (col A) y el canónico vive en `BU_Canonico` — al revés que en las
//    otras tres. Por eso se inyecta solo lo que la hoja no declara ya.
//    ⚠ DEUDA que esto deja a la vista: el mismo nombre `BU` significa crudo en Data_Email y
//      canónico en las demás. No se corrige aquí porque el crudo no se sobrescribe (R15).
(function inyectarPrefijo() {
  var E;
  try { E = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js'); }
  catch (e) { return; }   // sin esquema, el contrato sigue valiendo por lo que declara a mano
  // las tres que salen de la FECHA de la pieza, no del catálogo
  var DERIVADAS = { 'Quincena': 'quincena', 'Mes': 'mes', 'Mes (#)': 'mes_num' };
  var DIM = { 'BU': DIMENSION.bu, 'Marca': DIMENSION.marca, 'Campaña': DIMENSION.campana, 'Segmento': DIMENSION.segmento };
  Object.keys(module.exports.hojas).forEach(function (hoja) {
    if (!E.llevaPrefijo(hoja)) return;
    var def = module.exports.hojas[hoja];
    def.columnas = def.columnas || {};
    var heredadas = def.hereda ? (module.exports.hojas[def.hereda].columnas || {}) : {};
    E.nombresPrefijo().forEach(function (col) {
      if (def.columnas[col] || heredadas[col]) return;          // lo específico manda
      def.columnas[col] = DERIVADAS[col]
        ? { de: 'derivado', formula: DERIVADAS[col], desde: 'fecha', prefijo: true }
        : { de: 'catalogo', campo: col, dimension: DIM[col], prefijo: true };
    });
  });
})();
