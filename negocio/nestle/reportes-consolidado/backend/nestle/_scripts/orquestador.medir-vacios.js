// FASE M · UNA MEDICIÓN. Clasifica cada celda vacía del libro y NO escribe ni una.
//
// 🔴 POR QUÉ UNA SOLA PASADA. El 25-ago escribí al workbook para averiguar qué estaba mal: cada
//    descubrimiento costó una corrida de 41 scripts de ejecución y cada arreglo otra. Rick lo dijo sin rodeos —
//    «no puedes estar dando vueltas escribiendo, viendo qué salió mal, corrigiendo, luego otra vez».
//    Tenía razón, y el orden correcto ya estaba escrito en `lib-vacios`: **medir todo → decidir
//    todo → escribir una vez**. Este paso es el «medir todo», y no toca el archivo ni por accidente.
//
// 🔴 LA REGLA, EN UNA FRASE: `N/A` solo si se puede ESCRIBIR la razón. Si nadie declaró por qué esa
//    columna no aplica en esa fila, no es `N/A`: es `POR DEFINIR`, y va a la lista de Rick.
//    El default es DEBER, no despachar. Llenar de `N/A` cerraría el archivo y lo dejaría sin saber
//    qué le falta — que es justo lo que la lista tiene que decirle.
//
// 🔴 Y UN CERO ES UN DATO. `Clicks_App` vacío en una fila que sí tuvo clicks no es «no aplica»:
//    es **cero clicks a la app**, y se escribe `0`. Confundir «cero» con «vacío» es la otra mitad
//    del problema: un cero borrado se vuelve un hueco, y un hueco se vuelve un `N/A` falso.
//
// Las reglas viven aquí agrupadas POR SKILL, porque el dueño de la columna es quien sabe cuándo no
// aplica. Ninguna regla mira otra hoja: si necesitara hacerlo, sería una atribución, no un relleno.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var COL = require(__dirname + '/lib-columna.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
var hay = function (v) { return t(v) !== ''; };

// ── helpers que preguntan por la columna en vez de escribirla ─────────────────────────
function leer(fila, filas, id) { try { return t(fila[COL.de(filas, id)]); } catch (e) { return null; } }
function tiene(fila, filas, id) { var v = leer(fila, filas, id); return v !== null && v !== ''; }

// ══ LAS REGLAS, POR SKILL ══════════════════════════════════════════════════════════════
// Cada regla recibe (fila, filas) y devuelve:
//    string → «no aplica, y ésta es la razón»  → N/A
//    0      → «aplica y el valor real es cero» → 0
//    null   → «aplica y lo debemos»            → POR DEFINIR
var REGLAS = {

  // ── crm-reporte-resumen ───────────────────────────────────────────────────────────
  'Report_Resumen': {
    _skill: 'crm-reporte-resumen',
    // Qcart: la fila lo tiene o no lo tiene, y la hoja lo declara en `QCART?`
    _qcart: /^(Carritos_|Views_|Intencion_|Ticket_|Pct_Penetracion|Tasa_Productos|Receta_Representativa|FechaQcart_|Views_vs_Clicks|Carritos_vs_Clicks)/,
    _wa: /^WA-/,
    _fup: /^FUP_/,
    // 🔴 el `%_` faltaba y por eso 12×5 celdas cayeron en POR DEFINIR: `%_Qcart`, `%_App`,
    //    `%_Social`, `%_Web`, `%_Ver_Navegador` son tasas sobre clicks de EMAIL, así que en las 12
    //    filas de WhatsApp no aplican igual que el resto del bloque. Una regla incompleta no
    //    inventa un dato: manda a la lista de Rick algo que sí tiene razón escribible, y así la
    //    lista deja de servir para lo que existe — señalar lo que de verdad falta.
    _email: /^(Principal_|Tot_|Email Name SFMC|Content ID|Email_ID|Unsubs_|%_|% Unsub|% Unsuscribe|Audiencia_|P_Subject|Clicks_)/,
    _cero: /^Clicks_(App|Social|Web|Qcart|Ver_Navegador|Unsub)$/,
    regla: function (col, fila, filas) {
      var R = REGLAS['Report_Resumen'];
      var esWA = num(leer(fila, filas, 'WA-Envíos')) > 0;
      var esEmail = num(leer(fila, filas, 'Tot_Sends')) > 0;
      var conQcart = num(leer(fila, filas, 'Carritos_Total')) > 0 || /s[ií]/i.test(leer(fila, filas, 'QCART?') || '');
      var conFUP = num(leer(fila, filas, 'FUP_Sends')) > 0;

      // 🔴 un cero es un DATO: si la fila tuvo clicks, «sin clicks a la app» es 0, no «no aplica»
      if (R._cero.test(col) && num(leer(fila, filas, 'Clicks_Unicos_Total')) > 0) return 0;

      if (R._qcart.test(col) && !conQcart) return 'esta fila no tiene Qcart — el journey no lleva carrito';
      if (R._wa.test(col) && !esWA) return 'esta fila no es de WhatsApp — su medio es email';
      if (R._fup.test(col) && !conFUP) return 'este touchpoint no tiene envío de FollowUp';
      if (R._email.test(col) && !esEmail) return 'esta fila es de WhatsApp — no tiene métricas de email';
      return null;
    }
  },

  // ── crm-reporte-nestle-catalogo ───────────────────────────────────────────────────
  'Catalogo_Piezas': {
    _skill: 'crm-reporte-nestle-catalogo',
    regla: function (col, fila, filas) {
      // el bloque de recetas 1..5: una pieza con N recetas no tiene la N+1
      var mR = /^(Receta|URL_Receta|Cod_Walmart|Carritos_Walmart|Cod_Chedraui|Carritos_Chedraui)_(\d)$/.exec(col);
      if (mR) {
        var n = num(leer(fila, filas, 'N_Recetas'));
        if (Number(mR[2]) > n) return 'esta pieza tiene ' + (n || 0) + ' receta(s); la ' + mR[2] + ' no existe';
      }
      if (col === 'Codigos_Qcart' || /^Carritos_(Total|Walmart|Chedraui)$/.test(col) || col === 'Views_Total' || col === 'Fecha_Activacion_Qcart' || col === 'Activaciones_Qcart') {
        if (!/s[ií]/i.test(leer(fila, filas, 'Tiene_Qcart') || '')) return 'esta pieza no lleva Qcart (Tiene_Qcart = No)';
      }
      // lo que solo existe para email
      if (/^(Email_Name|Email_Names_Variantes|N_Email_Names|Asset_ID|Content_ID|Email_ID|Subject|Email_Type)/.test(col)) {
        var canal = leer(fila, filas, 'Canal') || '';
        if (canal && !/email/i.test(canal)) return 'esta pieza es de ' + canal + ', no de email';
      }
      // 🔴 y su espejo: lo que solo existe para WhatsApp (15-sep-2026). Sin esta regla, las 111
      //    piezas de email habrían pedido un `Whatsapp_Name` y las tres columnas nuevas habrían
      //    aparecido como 333 celdas POR DEFINIR el día que se crearon. No es un hueco: una pieza
      //    de email no tiene nombre de WhatsApp, y ésa es una razón que SÍ se puede escribir.
      if (/^(Whatsapp_Name|Whatsapp_Names_Variantes|N_Whatsapp_Names)/.test(col)) {
        var canalW = leer(fila, filas, 'Canal') || '';
        if (canalW && !/whatsapp/i.test(canalW)) return 'esta pieza es de ' + canalW + ', no de WhatsApp';
      }
      if (col === 'Mascota') {
        var camp = leer(fila, filas, 'Campaña') || '';
        if (!/fuel for life|pro ?plan|purina/i.test(camp)) return 'la mascota solo es dimensión en las campañas de Purina';
      }
      if (col === 'Pieza_Principal_ID') {
        if (!/fup|follow/i.test(leer(fila, filas, 'Email_Type') || '')) return 'solo un FollowUp declara su pieza Principal';
      }
      if (col === 'Oleada') {
        if (!/^AON/i.test(leer(fila, filas, 'Campaña') || '')) return 'la oleada solo distingue las piezas de AON';
      }
      if (col === 'Subsegmento') {
        if (!hay(leer(fila, filas, 'Segmentos_Combinados'))) return 'esta pieza no tiene segmentos combinados';
      }
      if (col === 'Notas' || col === 'Estado') return 'sin nota que registrar en esta pieza';
      return null;
    }
  },

  // ── crm-reporte-fuentes-email ─────────────────────────────────────────────────────
  'Data_Email': {
    _skill: 'crm-reporte-fuentes-email',
    regla: function (col) {
      // 🔴 la fuente cambió el 20-ago: Datorama ya no alimenta nada. La razón se puede escribir,
      //    así que es `N/A` — no «lo debemos».
      if (/^(Version|Report_Period|Nombre_Journey|Datorama_Campaign|Datorama_Campaign_ID)$/.test(col))
        return 'columna de la era Datorama; la fuente de email es SFMC desde el 20-ago-2026';
      if (col === 'Excluido_Motivo') return 'este envío no fue excluido del bloque';
      return null;
    }
  },

  // ── crm-reporte-fuentes-whatsapp ──────────────────────────────────────────────────
  'Data_WhatsApp': {
    _skill: 'crm-reporte-fuentes-whatsapp',
    regla: function (col, fila, filas) {
      if (/^(Logins|Recetas_Capturadas)$/.test(col))
        return 'la fuente no reporta el embudo de logins/recetas para esta campaña';
      if (/^(Pct_Error|Errores_Meta_Detalle)$/.test(col)) {
        if (num(leer(fila, filas, 'No_Entregados')) === 0) return 'no hubo no-entregados: no hay error de Meta que detallar';
        return 'la fuente entrega el total de no-entregados sin desglosar el código de Meta';
      }
      if (/click/i.test(col) && /^no$/i.test(leer(fila, filas, 'Clicks_Medidos') || ''))
        return 'los clicks de WhatsApp NO están medidos en esta campaña: la fuente los deriva de un CTOR asumido';
      // 🔴 el embudo de opt-in (Original → Filtros → Final) solo lo entregan algunas campañas, y
      //    eso es un hecho de la fuente, no un pendiente. Pero si la campaña SÍ trae el principio
      //    del embudo y le falta el final, entonces sí se debe: ahí la razón ya no se puede escribir.
      // 🔴 `Aud_Original` NO PRUEBA QUE HAYA EMBUDO (15-sep-2026). La condición miraba
      //    `Aud_Original`, y esa columna sale del «Total MGSC / Data Extension», que traen TODAS
      //    las hojas de la fuente — así que «trae el principio» era siempre cierto y el embudo se
      //    declaraba debido en campañas que no tienen embudo. Comprobado en el archivo del
      //    cliente: ni «Tercer Tiempo» ni «ICE» tienen una sola columna de filtros ni de
      //    audiencia final; su única cifra de audiencia es ese total. Resultado: 6 celdas en POR
      //    DEFINIR esperando un dato que nadie va a entregar nunca.
      //    Lo que sí prueba que hay embudo es que exista el MEDIO o el FINAL, no el total inicial.
      if (/^Aud_(Original|Filtros|Final)$/.test(col)) {
        var hayEmbudo = hay(leer(fila, filas, 'Aud_Filtros')) || hay(leer(fila, filas, 'Aud_Final'));
        if (!hayEmbudo) return 'la fuente no entrega el embudo de opt-in para esta campaña: su hoja no tiene columnas de filtros ni de audiencia final, solo el total inicial';
        return null;
      }
      if (col === 'URL' || col === 'utm_content')
        return 'este envío de WhatsApp no lleva shortlink: no hay carrito que enlazar';
      return null;
    }
  },

  // ── crm-reporte-fuentes-qcart ─────────────────────────────────────────────────────
  'Data_Qcart_Carritos': {
    _skill: 'crm-reporte-fuentes-qcart',
    regla: function (col, fila, filas) {
      if (/^utm_/.test(col)) return 'el evento no trae este utm — la llave del Qcart es el shortlink, no el utm';
      if (/^(Pieza_ID|pieza)/i.test(col)) return null;
      return 'el evento de Qcart no entrega este campo';
    }
  },
  'Data_Qcart_Productos': {
    _skill: 'crm-reporte-fuentes-qcart',
    regla: function (col) {
      if (/^utm_/.test(col)) return 'el evento no trae este utm — la llave del Qcart es el shortlink, no el utm';
      return 'el evento de Qcart no entrega este campo';
    }
  },

  // ── crm-reporte-nestle-catalogo (referencias) ─────────────────────────────────────
  // La hoja tiene tres tipos y cada uno usa columnas distintas — 115 `vocabulario`, 132 `alias`,
  // 21 `excluido`. Tratarlas como una sola tabla es lo que dejaba 815 celdas en POR DEFINIR.
  'Catalogo_Referencias': {
    _skill: 'crm-reporte-nestle-catalogo',
    regla: function (col, fila, filas) {
      var tipo = (leer(fila, filas, 'Tipo') || '').toLowerCase();
      if (col === 'Valor_Crudo' && tipo === 'vocabulario')
        return 'el vocabulario es una lista cerrada: no nace de un valor crudo, se declara';
      if (col === 'Valor_Canonico' && tipo === 'excluido')
        return 'un excluido no tiene canónico: se declara para NO atribuirlo';
      // 🔴 UN ALIAS ES CONTEXTUAL, y su contexto vacío SIGNIFICA algo: es la última grada de la
      //    escalera —canónico → campaña·segmento → campaña → utm → global— y ahí el alias vale para
      //    todo. Vacío no es «falta»: es «global», y esa razón se puede escribir.
      if (col === 'Contexto') return 'alias global: no está acotado a una campaña ni a un segmento';
      if (col === 'Dato_1' || col === 'Dato_2')
        return 'la referencia de tipo «' + (tipo || '?') + '» se resuelve sin dato' + (col === 'Dato_2' ? ' secundario' : ' auxiliar');
      if (col === 'Notas') return 'sin nota que registrar en esta referencia';
      if (col === 'Pieza_IDs' || col === 'N_Piezas')
        return 'ninguna pieza usa todavía esta referencia' + (tipo === 'excluido' ? ' (es un excluido: no debe usarla ninguna)' : '');
      return null;
    }
  }
};

// ══ LA MEDICIÓN ════════════════════════════════════════════════════════════════════════
console.log('════════ FASE M · UNA MEDICIÓN — no se escribe ni una celda ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = path.join(os.tmpdir(), 'medir-vacios.xlsx');
fs.copyFileSync(vivo.ruta, copia);
var wb = XLSX.readFile(copia);
console.log('  libro: ' + path.basename(vivo.ruta) + '\n');

var INTOCABLES = /^Reporte_julio$/i;

// 🔴 D6 (Rick, 26-ago-2026) · LA REGLA DE VACÍOS SE RELAJA, Y SE RELAJA CON CRITERIO.
//    «Te voy a dejar esta vez que sí dejes celdas vacías; solamente pongas POR DEFINIR en el
//     catálogo, donde corresponda, donde realmente no tengas la información.»
//
//    Antes se llenaba TODO el libro. Eso tenía un costo que no se veía: para cerrar el archivo
//    había que despachar cada hueco con un `N/A`, y cada `N/A` de más **borra la señal de qué
//    falta** — que es justo para lo que existe la lista. Y esta vez habría hecho algo peor:
//    volver a llenar las 10 columnas del desglose de clicks que acabamos de retirar, deshaciendo
//    la decisión D5 con un token que parece dato.
//
// 🔴 EL CATÁLOGO ES DISTINTO AL RESTO, y por eso él sí se llena: es la AUTORIDAD de dimensiones.
//    Un hueco ahí no es una celda bonita de menos, es una dimensión que nadie declaró, y todo lo
//    que la lee aguas abajo hereda el hueco. Ahí `POR DEFINIR` es la pregunta abierta que Rick
//    tiene que responder. En un reporte, en cambio, el vacío ya se lee como «no hay».
//
//    Se sigue MIDIENDO todo el libro —la medición no cuesta nada y la lista es más completa—;
//    lo que cambia es a qué hojas se les escribe.
var SE_LLENAN = /^Catalogo_(Piezas|Referencias)$/i;
var RAZON_NO_LLENAR = 'Rick, 26-ago: se permiten celdas vacías fuera del catálogo — POR DEFINIR solo donde el catálogo deba una dimensión';
var salida = { paso: 'orquestador.medir-vacios', medido: new Date(fs.statSync(vivo.ruta).mtime).toISOString().slice(0, 10), hojas: {} };
var totNA = 0, totPD = 0, totCero = 0, totIntocable = 0;

Object.keys(wb.Sheets).forEach(function (nombre) {
  var R = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: '' });
  if (!R.length) return;
  var enc = R[0].map(t);
  var filasArr = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { defval: '', blankrows: false });
  var vacias = 0;
  R.slice(1).forEach(function (r) { enc.forEach(function (h, i) { if (h && !hay(r[i])) vacias++; }); });

  if (INTOCABLES.test(nombre)) {
    totIntocable += vacias;
    salida.hojas[nombre] = { intocable: true, vacias: vacias, razon: 'Rick: «julio no se toca»' };
    console.log('  🔒 ' + nombre.padEnd(24) + vacias + ' vacías — INTOCABLE, no se decide ninguna');
    return;
  }

  // 🔴 EL NÚMERO DE FILA ES EL REAL, NO EL ÍNDICE DEL ARRAY (3-sep-2026). `sheet_to_json` con
  //    `blankrows:false` **salta las filas vacías**, así que `k + 2` solo coincide con la fila de
  //    verdad mientras la hoja no tenga huecos. `Catalogo_Piezas` tiene uno: los datos acaban en
  //    la 138, hay vacío hasta la 146 y las notas de Rick están en la 147-150. Desde el hueco en
  //    adelante cada índice apuntaba ocho filas antes, y el escritor reportó **340 celdas «sin
  //    fila donde caer»** — que es la versión afortunada del defecto: la mala habría sido
  //    escribirlas ocho filas arriba, encima de datos buenos, sin decir nada.
  var filaRealDe = [];
  for (var rr = 1; rr < R.length; rr++) {
    if ((R[rr] || []).some(function (v) { return t(v) !== ''; })) filaRealDe.push(rr + 1);
  }

  // 🔴 UNA FILA SIN LLAVE NO ES UN REGISTRO — Y LLENARLA ES DESTRUIRLA (4-sep-2026).
  //    Rick escribió cuatro notas en la columna `TouchPoint`, filas 147-150 de `Catalogo_Piezas`,
  //    debajo de los datos. Este medidor las vio como «piezas con 85 celdas vacías» y el
  //    llenador les escribió `POR DEFINIR` o `N/A` en TODAS. Sus notas siguen ahí, sepultadas
  //    bajo 340 tokens, y el catálogo quedó con cuatro piezas fantasma cuyo `Pieza_ID` dice
  //    literalmente «POR DEFINIR». Eso es lo que se siente mal al abrir el archivo.
  //    Regla: si la hoja tiene llave declarada y la fila no la trae, la fila no se llena. Se
  //    cuenta aparte y se dice, porque una fila así es información —alguien escribió ahí— pero
  //    no es un registro que este sistema tenga que completar.
  var LLAVE_DE = { 'Catalogo_Piezas': 'Pieza_ID', 'Catalogo_Referencias': 'Valor_Crudo' };
  var idLlave = LLAVE_DE[nombre];
  var nmLlave = null;
  if (idLlave) { try { nmLlave = COL.de(filasArr, idLlave); } catch (e) { nmLlave = null; } }
  var TOKEN_ESTADO = /^(POR DEFINIR|PENDIENTE|N\/A)$/i;
  var sinLlave = 0;

  var def = REGLAS[nombre];
  var na = {}, pd = {}, cero = {}, nNA = 0, nPD = 0, nCero = 0;
  filasArr.forEach(function (fila, k) {
    // una fila cuya llave falta —o es un token de estado, que es lo mismo— no se toca
    if (nmLlave) {
      var v = t(fila[nmLlave]);
      if (!v || TOKEN_ESTADO.test(v)) { sinLlave++; return; }
    }
    var nFila = filaRealDe[k] || (k + 2);
    enc.forEach(function (h) {
      if (!h) return;
      // 🔴 UN «POR DEFINIR» SE RECONSIDERA, PERO SOLO HACIA `N/A` (15-sep-2026).
      //    Este bucle solo miraba celdas vacías. Correcto mientras las reglas no cambien — pero
      //    cuando una regla se CORRIGE, las celdas que decidió mal se quedan mal para siempre.
      //    Pasó con `Aud_Filtros`/`Aud_Final`: la regla daba por debido el embudo de opt-in
      //    porque la fila traía `Aud_Original`, y esa columna sale del total inicial que traen
      //    TODAS las hojas de la fuente. Seis celdas quedaron esperando un dato que ni «Tercer
      //    Tiempo» ni «ICE» tienen columna para entregar.
      //    Ahora esas celdas se vuelven a preguntar, y solo se mueven si la regla ya sabe
      //    ESCRIBIR la razón. Nunca al revés: por construcción este camino no puede producir un
      //    `POR DEFINIR` nuevo ni tocar una celda con dato — que es justo lo que Rick pidió
      //    («lo que ya se definió no se regresa a por definir»).
      var actual = t(fila[h]);
      var reconsidera = /^(POR DEFINIR|PENDIENTE)$/i.test(actual);
      if (hay(fila[h]) && !reconsidera) return;
      var v = def ? def.regla(h, fila, filasArr) : null;
      if (reconsidera) {
        if (typeof v !== 'string') return;              // sigue debiéndose: se queda como está
        na[h] = na[h] || { razon: v, filas: [] }; na[h].filas.push(nFila); nNA++;
        (salida.reconsideradas = salida.reconsideradas || []).push({ hoja: nombre, fila: nFila, columna: h, de: actual, a: 'N/A', razon: v });
        return;
      }
      if (v === 0) { (cero[h] = cero[h] || []).push(nFila); nCero++; }
      else if (typeof v === 'string') { na[h] = na[h] || { razon: v, filas: [] }; na[h].filas.push(nFila); nNA++; }
      else { pd[h] = pd[h] || []; pd[h].push(nFila); nPD++; }
    });
  });
  totNA += nNA; totPD += nPD; totCero += nCero;
  // 🔴 D6 · se mide igual, pero se declara si se escribe o no. La medición sigue completa para
  //    que la lista de Rick lo sea; lo que se decide aquí es a qué hojas se les toca una celda.
  var seLlena = SE_LLENAN.test(nombre);
  if (sinLlave) console.log('     ⚠ ' + nombre + ': ' + sinLlave + ' fila(s) sin llave — NO se llenan (son notas, no registros)');
  salida.hojas[nombre] = { skill: def ? def._skill : '(sin reglas declaradas)', vacias: vacias,
    se_llena: seLlena, razon_no_llenar: seLlena ? null : RAZON_NO_LLENAR,
    na: na, por_definir: pd, cero: cero };
  console.log('  ' + (seLlena ? (nPD ? '⚠' : '✔') : '·') + ' ' + nombre.padEnd(24) + String(vacias).padStart(5) + ' vacías  →  ' +
    String(nNA).padStart(5) + ' N/A   ' + String(nCero).padStart(4) + ' cero   ' + String(nPD).padStart(5) + ' POR DEFINIR' +
    (seLlena ? '   ← se escribe' : '   (se mide, no se escribe)') + (def ? '' : '   🔴 sin reglas'));
});

fs.writeFileSync(BACK + '/_preescritura/decisiones.json', JSON.stringify(salida, null, 1));
fs.rmSync(copia, { force: true });

console.log('\n  ── TOTAL ' + '─'.repeat(52));
console.log('   N/A (la razón se puede escribir) ...... ' + totNA.toLocaleString('es-MX'));
console.log('   cero (es un dato, no un hueco) ........ ' + totCero.toLocaleString('es-MX'));
console.log('   🔴 POR DEFINIR (aplica y se debe) ..... ' + totPD.toLocaleString('es-MX'));
console.log('   🔒 intocables (Reporte_julio) ......... ' + totIntocable.toLocaleString('es-MX'));

// 🔴 D6 · UNA CELDA QUE YA DICE «POR DEFINIR» NO ESTÁ VACÍA — Y ESO VACIABA LA LISTA.
//    El conteo de arriba mide huecos. Pero las corridas anteriores ya escribieron el token en el
//    catálogo, así que esas celdas dejaron de contar como vacías y la lista de Rick salía en CERO
//    mientras el archivo seguía lleno de pendientes. Un pendiente escrito sigue siendo pendiente:
//    la lista tiene que leer el TOKEN, no solo el hueco. Si no, se cierra sola sin resolver nada.
var TOKEN = /^(POR DEFINIR|PENDIENTE)$/i;
var pendientes = {};
Object.keys(wb.Sheets).forEach(function (nombre) {
  if (INTOCABLES.test(nombre) || !SE_LLENAN.test(nombre)) return;
  var R = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: '' });
  if (!R.length) return;
  var enc = R[0].map(t);
  R.slice(1).forEach(function (r, k) {
    enc.forEach(function (h, i) {
      if (!h || !TOKEN.test(t(r[i]))) return;
      pendientes[nombre] = pendientes[nombre] || {};
      (pendientes[nombre][h] = pendientes[nombre][h] || []).push(k + 2);
    });
  });
});
salida.pendientes_ya_escritos = pendientes;
fs.writeFileSync(BACK + '/_preescritura/decisiones.json', JSON.stringify(salida, null, 1));

var nPend = Object.keys(pendientes).reduce(function (a, h) {
  return a + Object.keys(pendientes[h]).reduce(function (b, c) { return b + pendientes[h][c].length; }, 0);
}, 0);

console.log('\n  ══ LA LISTA PARA RICK — lo que el CATÁLOGO debe y nadie ha declarado ══');
if (!nPend) console.log('   (nada pendiente en el catálogo)');
Object.keys(pendientes).forEach(function (h) {
  console.log('\n   ' + h + '   ' + Object.keys(pendientes[h]).reduce(function (a, c) { return a + pendientes[h][c].length; }, 0) + ' celda(s)');
  Object.keys(pendientes[h]).sort(function (a, b) { return pendientes[h][b].length - pendientes[h][a].length; }).forEach(function (c) {
    console.log('      ' + String(pendientes[h][c].length).padStart(5) + '  ' + c +
      '   (filas ' + pendientes[h][c].slice(0, 6).join(',') + (pendientes[h][c].length > 6 ? '…' : '') + ')');
  });
});

// lo de aguas abajo se informa, pero NO es una pregunta para Rick: son consecuencias de lo
// anterior o columnas que este corte decidió no reportar. Mezclarlas convierte su lista en ruido.
if (totPD) {
  console.log('\n  ── y aguas abajo, huecos que NO se escriben (consecuencia, no pregunta) ──');
  Object.keys(salida.hojas).forEach(function (h) {
    var pd = salida.hojas[h].por_definir;
    if (!pd || !Object.keys(pd).length || salida.hojas[h].se_llena) return;
    console.log('   ' + h.padEnd(24) + Object.keys(pd).length + ' columna(s) · ' +
      Object.keys(pd).reduce(function (a, c) { return a + pd[c].length; }, 0) + ' celda(s)');
  });
}
console.log('\n  → _preescritura/decisiones.json   ·   el Excel NO se tocó');
