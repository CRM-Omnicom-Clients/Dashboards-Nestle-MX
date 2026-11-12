// S2 · EL HTML DE LA CADENA DE SKILLS.
//
// 🔴 SE GENERA, NO SE ESCRIBE A MANO. Las etapas, los pasos y su orden salen de
//    `_contratos/cadena-skills.json` — la misma declaración que EJECUTA el orquestador. Escribir la
//    tabla a mano crearía una tercera versión del orden que se desincronizaría de las otras dos, y
//    un diagrama que miente sobre el sistema es peor que no tener diagrama.
//    Lo único escrito a mano es la NARRATIVA de cada skill: lo que ningún JSON puede saber.
//
// 🔴 Y EL DISEÑO SE LEE DEL HTML DE SCRIPTS, no se reinventa: Rick pidió «las mismas dimensiones y
//    todo». Se toma su bloque <style> tal cual, así los dos documentos son el mismo sistema visual
//    aunque uno gire el eje.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ORQ = PROY + '/_orquesta';

var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/cadena-skills.json', 'utf8'));
var nodosHtml = fs.readFileSync(ORQ + '/cadena-pasos-nestle.html', 'utf8');
var estilo = (/<style>[\s\S]*?<\/style>/.exec(nodosHtml) || [''])[0];
if (!estilo) { console.log('🔴 no pude leer el <style> de cadena-pasos-nestle.html'); process.exit(1); }

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── LA NARRATIVA: lo que el JSON no puede saber. Una entrada por skill. ────────────────
// Cada columna corresponde a una dimensión de la tabla de pasos, girada al eje del skill.
var N = {
  'rick-reportes-orquestador': {
    fase: 'dirige',
    gobierna: 'El <b>bucle</b> del corte. No hace trabajo de datos: decide qué skill entra, en qué orden, y se detiene en el primero que falla.',
    viejo: 'Los 12 agentes del sistema 2, que se llamaban entre sí sin orden declarado.',
    contrato: 'No escribe ninguna hoja. Su producto es la <b>bitácora</b> y el veredicto del corte.',
    entra: 'El corte que declara Rick + el diagnóstico de los guardianes.',
    sale: '<code>_orquesta-bitacora.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: 'Que la cadena declarada cubra <b>exactamente</b> los scripts documentados. Si falta uno, no arranca.',
    duras: '🔴 <b>Publicar a producción NO está en el bucle</b> — exige el OK explícito de Rick, y un bucle no puede dárselo a sí mismo.<br>🔴 Un corte a medias es peor que ninguno: si una puerta cierra, se detiene todo.',
    nuevos: '<span class="si">Sí.</span> La cadena se declara en JSON: agregar un skill es una entrada, no un cambio de código.'
  },
  'rick-reportes-fuentes-insumos': {
    fase: 'entrada',
    gobierna: 'Revisa las descargas <b>antes de que nada las consuma</b>: qué llegó, qué falta, qué está viejo y qué forma trae cada fuente.',
    viejo: '<code>agent-insumos</code>',
    contrato: 'No escribe hojas. Declara qué hay y con qué forma.',
    entra: 'La carpeta de descargas + el volcado de SFMC.',
    sale: '<code>_insumos/inventario.json</code> · <code>_insumos/cruce-sfmc.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: '<code>N1-99-validar</code> (9) · <code>N1s-99-cruce-sfmc</code> (4)',
    duras: '🔴 <b>Si el encargo ya trae mediciones, NO se vuelven a derivar.</b><br>🔴 Flexible en lo que entra, estricto en el objetivo: un formato nuevo no puede obligar a editar el script.',
    nuevos: '<span class="si">Sí.</span> Descubre la forma; no la fija.'
  },
  'rick-reportes-nestle-catalogo': {
    fase: 'autoridad',
    gobierna: 'El <b>catálogo raíz</b> — la autoridad de dimensiones. Campaña, marca, BU, objetivo, segmento y touchpoint salen de aquí.',
    viejo: '<code>agent-normalizador</code>',
    contrato: '<code>Catalogo_Piezas</code> · <code>Catalogo_Referencias</code>. Grano: <b>una fila por pieza</b>.',
    entra: 'Las correcciones declaradas + lo que las fuentes no resuelven.',
    sale: 'el catálogo corregido y <code>_contratos/normalizacion.json</code>',
    excel: '<span class="si">escribe</span> el catálogo',
    valida: 'Su etapa va <b>antes</b> de los cuatro bloques, a propósito.',
    duras: '🔴 <b>Nada se infiere del naming.</b> Si una dimensión no resuelve, se declara un alias — no se deduce por parecido.<br>🔴 Un alias es <b>contextual</b>: «Segundo Partido» significa una cosa en Mundial y podría significar otra en otra campaña.',
    nuevos: '<span class="si">Sí.</span> Una campaña nueva es un alta, no un parche.'
  },
  'rick-reportes-fuentes-email': {
    fase: 'fuentes',
    gobierna: 'El bloque de <b>email</b>, desde SFMC. Σ 7,282,486 envíos en 98 piezas.',
    viejo: '<code>agent-datos-email</code> + Datorama',
    contrato: '→ <code>Data_Email</code> (una fila por envío) · → <code>Report_Resumen</code> (agrega piezas)',
    entra: 'La DE <code>CRM_Email_Piezas</code>, por volcado — <b>nunca al contexto</b>.',
    sale: '<code>_fuentes/email.json</code>',
    excel: '<span class="no">no toca</span> — lo escribe el escritor',
    valida: '<code>NC-99-validar</code> (12)',
    duras: '🔴 <b>Las 4 canónicas de <code>Data_Email</code> son MIXTAS</b>: 277 celdas están a mano. Escribir por columna las borraría.<br>🔴 La atribución envío→pieza es una <b>cascada</b>, nunca una sola variable.',
    nuevos: '<span class="quizas">Con reserva.</span> El export no entrega <code>Campaign</code> ni <code>Segment</code>: un envío nuevo nunca se escribe solo.'
  },
  'rick-reportes-fuentes-qcart': {
    fase: 'fuentes',
    gobierna: 'Los <b>dos</b> bloques de Qcart —carritos y productos— y la <b>activación</b> de cada link. Dos etapas separadas por eso.',
    viejo: '<code>agent-datos-qcart</code>',
    contrato: '→ <code>Data_Qcart_Carritos</code> · → <code>Data_Qcart_Productos</code> · → <code>Report_Resumen</code> <b>por touchpoint × segmento</b>',
    entra: 'Las descargas de Qcart (docs 2 y 3) + el doc de links.',
    sale: '<code>_fuentes/qcart.json</code> · <code>_catalogo/activacion-qcart.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: '<code>N2b-99-validar</code> (12) · <code>N2b-97-refutar</code>',
    duras: '🔴 <b>La unidad es el LINK</b>, no el nombre del archivo: la carpeta manda.<br>🔴 Son <b>LOGS</b>, no un refresh: no se re-consolidan, se acumulan.<br>🔴 El grano de escritura es <b>touchpoint × segmento</b> — agrupar a un segmento borra la comparación que el reporte existe para dar, <b>y cuadra igual</b>.',
    nuevos: '<span class="si">Sí.</span> Un código nuevo se declara en el catálogo.'
  },
  'rick-reportes-fuentes-whatsapp': {
    fase: 'fuentes',
    gobierna: 'El bloque de <b>WhatsApp</b>: 12 envíos, 14,643. El 0.15% del volumen y el que más fácil miente.',
    viejo: '<code>agent-datos-whatsapp</code>',
    contrato: '→ <code>Data_WhatsApp</code> · → <code>Report_Resumen</code>',
    entra: '<code>Resultados Whatsapp CRM 2026.xlsx</code> — 5 hojas, 5 esquemas.',
    sale: '<code>_fuentes/whatsapp.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: '<code>N2c-99-validar</code> (14) · <code>N2c-97-refutar</code>',
    duras: '🔴 <b>Una hoja no es una tabla</b> — la trampa que costó más caro.<br>🔴 Las filas de <b>SUBTOTAL</b> inflaban el bloque.<br>🔴 Los clicks de Tercer Tiempo <b>NO están medidos</b>: se derivan de un CTOR asumido. Nunca se reportan como resultado.<br>🔴 El ancla es una <b>cascada</b>; lo ambiguo se declara, no se fuerza.',
    nuevos: '<span class="quizas">Con reserva.</span> 2 de 12 envíos siguen sin fecha ubicable.'
  },
  'rick-reportes-fuentes-manual': {
    fase: 'fuentes',
    gobierna: 'Lo que <b>ninguna fuente entrega</b> y alguien capturó a mano.',
    viejo: '—',
    contrato: '→ <code>Report_Resumen</code>',
    entra: 'Lo declarado a mano, con su motivo.',
    sale: '<code>_fuentes/manual.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: '<code>N2d-99-validar</code> (12)',
    duras: '🔴 <b>Que esté vacío es el estado NORMAL.</b> Un bloque manual que crece es señal de que una fuente dejó de entregar algo.<br>🔴 Río abajo sigue siendo <b>distinguible</b> de un dato medido.',
    nuevos: '<span class="si">Sí.</span> Existe justo para lo que el sistema todavía no sabe leer.'
  },
  'rick-reportes-fuentes-cuadre': {
    fase: 'puertas',
    gobierna: 'Las <b>DOS puertas</b>. La 1 cruza los cuatro bloques antes de escribir; la 2 cruza el reporte contra la rejilla al final.',
    viejo: '<code>agent-refutador</code>',
    contrato: 'No escribe. <b>Dictamina.</b>',
    entra: 'Los 4 bloques + el catálogo (P1) · el reporte + la rejilla (P2)',
    sale: '<code>_fuentes/veredicto.json</code> · <code>_rejilla/veredicto-puerta2.json</code>',
    excel: '<span class="no">no toca</span>',
    valida: '<code>N2v-96</code> y <code>N7-96</code> — <b>rompen la puerta a propósito</b> y comprueban que cierra <em>y que vuelve a abrir</em>.',
    duras: '🔴 <b>Si cierra, no se escribe NADA</b> — ni los bloques que sí cuadran.<br>🔴 <b>BLOQUEA vs AVISA</b>: la dirección de la diferencia decide. Traer de más antes de escribir es normal; traer de menos significa que algo se perdió.<br>🔴 Un gate que no cierra es un adorno.',
    nuevos: '<span class="si">Sí.</span> Mide direcciones, no cifras fijas.'
  },
  'rick-reportes-escritor': {
    fase: 'escritura',
    gobierna: 'La <b>doctrina de escritura</b>. Tres etapas: prepara el libro, escribe las hojas de datos, y formatea el Resumen ya construido.',
    viejo: 'El <code>switch</code> de 20 casos que vivía dentro de N3 — <b>con dos copias</b>.',
    contrato: '→ las 4 hojas de datos, obedeciendo <code>_contratos/hojas.js</code>. <b>No sabe de negocio.</b>',
    entra: 'Los 4 bloques + el contrato de hoja.',
    sale: 'el Excel escrito y validado',
    excel: '<span class="si">ESCRIBE</span> · las 4 capas en cada publicación',
    valida: '<code>N1d-99-validar-contrato</code> (6)',
    duras: '🔴 <b>La llave se ancla a una celda que YA EXISTE</b>, nunca a una que el escritor va a fabricar.<br>🔴 <b>Llenar un hueco y PISAR un dato no son la misma operación.</b><br>🔴 Un dato que no se puede calcular <b>no autoriza a borrar</b> el que está.<br>🔴 <b>No crea filas.</b> Para eso está el acumulador.',
    nuevos: '<span class="si">Sí.</span> El ancho sale del contenido real: una columna nueva queda bien sin que nadie la agregue a una lista.'
  },
  'rick-reportes-motor': {
    fase: 'cálculo',
    gobierna: 'El <b>único que divide</b>. Tasas, agregados y el desglose de clicks por destino.',
    viejo: 'Las fórmulas que vivían en las hojas.',
    contrato: 'No escribe hojas. Produce <b>la rejilla</b>.',
    entra: 'Las hojas de datos ya escritas + <code>CRM_Email_Links</code>',
    sale: '<code>_rejilla/rejilla.json</code> · <code>_fuentes/links.json</code>',
    excel: '<span class="no">no toca</span> — verificado por <code>mtime</code>',
    valida: '<code>N5-99-validar</code> (10)',
    duras: '🔴 <b>Ningún otro skill calcula.</b> Si un escritor necesita dividir, al motor le falta una columna.<br>🔴 El destino sale de la <b>URL</b>, no del nombre — <code>Link_Name</code> viene vacío.<br>🔴 El <b>volumen de audiencia no se suma dos veces</b>: dos piezas pueden salir de la misma DE.<br>🔴 <code>motor-rejilla</code> es un script aparte porque <b>mezclar dos granos en el mismo bucle</b> es como nacen los errores que nadie encuentra.',
    nuevos: '<span class="si">Sí.</span> Lo que no cae en ninguna clase entra como <code>otro</code> y se cuenta — no se reparte a ojo.'
  },
  'rick-reportes-resumen': {
    fase: 'reporte',
    gobierna: 'Construye <code>Report_Resumen</code>: fusiona Principal y FUP en una fila y regenera la hoja.',
    viejo: '<code>agent-reporte-resumen</code>',
    contrato: '→ <code>Report_Resumen</code>. <b>No calcula: copia.</b>',
    entra: 'La rejilla.',
    sale: 'la hoja regenerada + su columna <code>Insights</code> creada y vacía',
    excel: '<span class="si">ESCRIBE</span>',
    valida: '<code>N6-99-validar</code> (10) · <b>912 cifras una por una</b>',
    duras: '🔴 <b>Principal y FUP en la MISMA fila</b> — lo pidió Rick. Se declara por <code>Pieza_Principal_ID</code>, no se deduce.<br>🔴 <b>Regenerar es destructivo por naturaleza</b>: leer y diffear antes; Rick edita a mano.<br>🔴 <b>La fila de totales va al final, es UNA, y sus <code>SUM</code> llevan su <code>result</code></b> — sin él, la fila está vacía para todo lector que no sea Excel.<br>🔴 <b>Y no es una fila de datos</b>: sumarla con ellas cuenta todo dos veces.',
    nuevos: '<span class="si">Sí.</span> Regenera desde la rejilla en vez de emparejar por llave — por eso un renombre no la rompe.'
  },
  'rick-reportes-nestle-insights': {
    fase: 'reporte',
    gobierna: 'La columna de <b>insights</b>: qué pasó, contra qué se compara y qué hacer.',
    viejo: '<code>agent-insights-resumen</code>',
    contrato: '→ <code>Report_Resumen.Insights</code>, y <b>solo</b> esa columna.',
    entra: 'La rejilla + el IQS determinista.',
    sale: '76 celdas de insight',
    excel: '<span class="si">ESCRIBE</span> una columna',
    valida: 'El <b>IQS</b> (umbral 60) decide si hay acción; si nada pasa, dice «sin acción prioritaria».',
    duras: '🔴 <b>Benchmark por campaña × OBJETIVO</b>, jamás cruzando journeys: <em>Inspiration</em> abre naturalmente más que <em>Purchase</em>.<br>🔴 <b>No forzar mejor/peor</b>: si OR y CTOR se contradicen, esa discrepancia <em>es</em> el insight.<br>🔴 <b>La acción abre con un VERBO</b>, no con una etiqueta.<br>🔴 Nunca inventar una recomendación para llenar.',
    nuevos: '<span class="si">Sí.</span> El IQS es determinista: no depende de que alguien recuerde la regla.'
  }
};

// ── el orden de presentación: por primera aparición en la cadena ───────────────────────
var orden = [], visto = {};
C.etapas.forEach(function (e) { if (!visto[e.skill]) { visto[e.skill] = 1; orden.push(e.skill); } });
if (!orden.length) { console.log('🔴 la cadena no tiene etapas'); process.exit(1); }
// el que dirige va primero aunque no tenga etapas
if (orden.indexOf(C.dirige) < 0) orden.unshift(C.dirige);
else { orden.splice(orden.indexOf(C.dirige), 1); orden.unshift(C.dirige); }

var faltan = orden.filter(function (s) { return !N[s]; });
if (faltan.length) { console.log('🔴 sin narrativa: ' + faltan.join(' · ')); process.exit(1); }

// ── la tabla ──────────────────────────────────────────────────────────────────────────
var FASES = {
  dirige: ['Dirige', 'El bucle. No hace trabajo de datos: decide quién entra y cuándo.'],
  entrada: ['Entrada', 'Qué llegó, y con qué forma.'],
  autoridad: ['Autoridad', 'De dónde salen las dimensiones. Va ANTES que las fuentes, a propósito.'],
  fuentes: ['Las cuatro fuentes', 'Cada una arma su bloque en el backend. Ninguna calcula.'],
  puertas: ['Las dos puertas', 'Un solo dueño: quien decide si se puede escribir decide si lo escrito dice la verdad.'],
  escritura: ['Escritura', 'Obedece los contratos. No sabe de negocio.'],
  'cálculo': ['Cálculo', 'El único que divide.'],
  reporte: ['El reporte', 'Copia de la rejilla y la explica.']
};

var filas = [], faseActual = null;
orden.forEach(function (s) {
  var n = N[s];
  if (n.fase !== faseActual) {
    var f = FASES[n.fase] || [n.fase, ''];
    filas.push('<tr class="fase"><td class="paso"><span class="fase-t">' + esc(f[0]) +
      '</span></td><td colspan="11"><span class="fase-d">' + esc(f[1]) + '</span></td></tr>');
    faseActual = n.fase;
  }
  var mias = C.etapas.filter(function (e) { return e.skill === s; });
  var etapasHtml = mias.length
    ? mias.map(function (e) {
        return '<div class="et"><b>etapa ' + e.orden + '</b> · ' +
          e.scripts.map(function (x) { return '<code>' + esc(x.id) + '</code>' + (x.puerta ? ' 🚪' : ''); }).join(' · ') + '</div>';
      }).join('')
    : '<div class="et"><em>recorre la cadena</em></div>';
  var scripts = mias.length
    ? mias.map(function (e) { return e.scripts.map(function (x) { return '<code>' + esc(x.script) + '</code>'; }).join('<br>'); }).join('<br>')
    : '<code>orquestador.orquestador.js</code>';
  filas.push('<tr>' +
    '<td class="paso"><b>' + esc(s.replace('rick-reportes-', '')) + '</b><div class="skid">' + esc(s) + '</div></td>' +
    '<td>' + n.gobierna + '</td>' +
    '<td>' + etapasHtml + '</td>' +
    '<td>' + n.viejo + '</td>' +
    '<td>' + n.contrato + '</td>' +
    '<td>' + scripts + '</td>' +
    '<td>' + n.entra + '</td>' +
    '<td>' + n.sale + '</td>' +
    '<td>' + n.excel + '</td>' +
    '<td>' + n.valida + '</td>' +
    '<td>' + n.duras + '</td>' +
    '<td>' + n.nuevos + '</td>' +
    '</tr>');
});

var nNodos = C.etapas.reduce(function (a, e) { return a + e.scripts.length; }, 0);
var conEscritura = C.etapas.filter(function (e) { return e.scripts.some(function (x) { return x.escribe; }); }).length;

var html = [
'<!doctype html>', '<html lang="es">', '<head>', '<meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>Cadena de Skills</title>', '</head>', '<body>',
'<link rel="preconnect" href="https://fonts.googleapis.com">',
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap">',
estilo,
'<style>',
'  .skid { font-family:"JetBrains Mono",monospace; font-size:10.5px; color:var(--ink2); margin-top:3px; opacity:.75; }',
'  .et { font-size:12px; margin-bottom:5px; line-height:1.5; }',
'  .et b { color:var(--puerta); font-weight:600; }',
'  .cadena-viz { display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin:4px 0 0; }',
'  .paso-viz { font-family:"JetBrains Mono",monospace; font-size:11px; padding:3px 8px; border-radius:5px;',
'              background:var(--surface2); border:1px solid var(--line); white-space:nowrap; }',
'  .paso-viz.p { background:var(--puerta-bg); border-color:var(--puerta); color:var(--puerta); font-weight:600; }',
'  .paso-viz.w { background:var(--ok-bg); border-color:var(--ok); color:var(--ok); }',
'  .flecha { color:var(--ink2); opacity:.5; font-size:11px; }',
'</style>',
'<div class="wrap">',
'  <header>',
'    <h1>Cadena de <em>skills</em> · sistema de reportes</h1>',
'    <p class="sub">El mismo corte, con el <strong>skill</strong> como columna vertebral. Hasta el 25-ago lo que se ejecutaba era un array de <strong>' + nNodos + ' pasos planos</strong> y los skills vivían al lado sin mandar sobre nada. Ahora la cadena se declara en <code>_contratos/cadena-skills.json</code> y el orquestador la recorre de ahí: <strong>' + C.etapas.length + ' etapas · ' + orden.length + ' skills · ' + nNodos + ' pasos · 0 huérfanos</strong>.</p>',
'    <p class="sub"><strong style="color:var(--stop)">La regla que lo cierra:</strong> <em>«los pasos están contenidos en los skills; el sistema plano anterior no se vuelve a usar»</em> (Rick, 25-ago-2026). El generador de la cadena <strong>BLOQUEA</strong> si un script del backend no tiene skill dueño — un script huérfano significaría que «correr la cadena de skills» deja fuera parte del corte, en silencio.</p>',
'    <p class="sub"><strong style="color:var(--puerta)">Y no es «un skill = un tramo».</strong> Un skill aparece varias veces: <code>qcart</code> corre en la activación y otra vez al armar sus bloques · el <code>escritor</code> corre <strong>tres</strong> veces · el <code>cuadre</code> abre la Puerta 1 y después la Puerta 2. Forzar que cada skill fuera contiguo cambiaría el <strong>orden real de ejecución</strong>. Por eso la unidad intermedia es la <strong>ETAPA</strong>: una aparición del skill, con los pasos que corre ahí.</p>',
'    <div class="legend">',
'      <span class="lg"><span class="dot" style="background:var(--ok)"></span>Escribe el Excel</span>',
'      <span class="lg"><span class="dot" style="background:var(--puerta)"></span>PUERTA — solo dos</span>',
'      <span class="lg"><span class="dot" style="background:var(--lee)"></span>Solo lee</span>',
'      <span class="lg"><span class="dot" style="background:var(--stop)"></span>Regla dura · se rompe si se ignora</span>',
'    </div>',
'  </header>',
'',
'  <div class="marcador">',
'    <div class="kpi abierta"><span class="kpi-l">La cadena, hoy</span><span class="kpi-n">' + C.etapas.length + '</span><span class="kpi-d">etapas · <b>' + orden.length + '</b> skills · <b>' + nNodos + '</b> pasos · <b>0</b> sin dueño</span></div>',
'    <div class="kpi"><span class="kpi-l">Corren en seco</span><span class="kpi-n">31</span><span class="kpi-d">pasos con sus validaciones · <b>0 fallos</b> · las dos puertas abiertas</span></div>',
'    <div class="kpi"><span class="kpi-l">Etapas que escriben</span><span class="kpi-n">' + conEscritura + '</span><span class="kpi-d">cada publicación pasa por sus <b>4 capas</b> de validación</span></div>',
'    <div class="kpi pend"><span class="kpi-l">Abierto · decisión de Rick</span><span class="kpi-n">4</span><span class="kpi-d">publicar · la columna fantasma <code>EmailID</code> · las 2 hojas <code>Soporte_IA_*</code> · retirar <code>% Unsuscribe</code></span></div>',
'  </div>',
'',
'  <div class="bloque" style="margin:26px 0">',
'    <h2>El orden, de un vistazo</h2>',
'    <p class="sub">Cada caja es una etapa. El nombre es el <strong>skill</strong>; debajo, los pasos que corre ahí.</p>',
'    <div class="cadena-viz">',
C.etapas.map(function (e, i) {
  var esP = e.scripts.some(function (x) { return x.puerta; });
  var esW = e.scripts.some(function (x) { return x.escribe; });
  return '      ' + (i ? '<span class="flecha">→</span>' : '') +
    '<span class="paso-viz' + (esP ? ' p' : esW ? ' w' : '') + '">' + e.orden + '. ' +
    esc(e.skill.replace('rick-reportes-', '')) + '<br><span style="opacity:.7">' +
    e.scripts.map(function (x) { return esc(x.id); }).join(' ') + '</span></span>';
}).join('\n'),
'    </div>',
'  </div>',
'',
'  <div class="scroller">',
'    <table>',
'      <thead>',
'        <tr>',
'          <th>Skill</th>',
'          <th>Qué gobierna</th>',
'          <th>Etapas · pasos</th>',
'          <th>Viene de (sistema viejo)</th>',
'          <th>Contrato — qué escribe y con qué grano</th>',
'          <th>Proceso · scripts</th>',
'          <th>Entra</th>',
'          <th>Sale — bloque en backend</th>',
'          <th>Excel</th>',
'          <th>Validación · DoD</th>',
'          <th>Reglas duras · qué falta</th>',
'          <th>¿Aguanta datos nuevos?</th>',
'        </tr>',
'      </thead>',
'      <tbody>',
filas.join('\n'),
'      </tbody>',
'    </table>',
'  </div>',
'',
'  <div class="bloque" style="margin:26px 0">',
'    <h2>Por qué el orden es ese</h2>',
'    <ul class="lista">',
'      <li><b>El catálogo va antes que las fuentes</b> (etapa 4, antes de la 5–8). Es su autoridad de dimensiones: un bloque armado contra un catálogo a medio corregir arrastra la dimensión vieja hasta el reporte, y ahí ya no se distingue de un dato.</li>',
'      <li><b>La Puerta 1 va antes de escribir</b> (etapa 9). Cada bloque se validó contra sí mismo; hay cosas que <em>solo se ven al juntarlos</em>.</li>',
'      <li><b>El motor va después de escribir</b> (etapa 11). Calcula sobre lo que quedó en las hojas, no sobre lo que cree que quedó.</li>',
'      <li><b>El formato del Resumen va al final</b> (etapa 14, no la 10). La etapa 12 <em>regenera</em> la hoja: cualquier ancho puesto antes se pierde. Estuvo así y sus 83 columnas nunca recibían ancho — «Recetas Nestlé» se leía «cetas Nes».</li>',
'      <li><b>La Puerta 2 va al final del todo</b> (etapa 15). Es el único punto donde preguntar <em>«¿quedó alguna columna sin llenar?»</em> mide algo real: antes, la respuesta sería «todavía no».</li>',
'    </ul>',
'  </div>',
'',
'  <footer><p class="sub">Generado por <code>orquestador.html-cadena-skills.js</code> desde <code>_contratos/cadena-skills.json</code> — la misma declaración que ejecuta el orquestador. Si esta tabla y la cadena divergen, es que alguien editó una sin regenerar la otra.</p></footer>',
'</div>',
'</body>', '</html>'
].join('\n');

fs.writeFileSync(ORQ + '/cadena-skills-nestle.html', html);
console.log('════════ S2 · HTML DE LA CADENA DE SKILLS ════════\n');
console.log('  ' + C.etapas.length + ' etapas · ' + orden.length + ' skills · ' + nNodos + ' pasos');
console.log('  narrativa escrita para los ' + orden.length + ' skills   ✔ ninguno sin describir');
console.log('  estilo reutilizado de cadena-pasos-nestle.html (' + Math.round(estilo.length / 1024) + ' KB)');
console.log('\n  → _orquesta/cadena-skills-nestle.html  (' + Math.round(html.length / 1024) + ' KB)');
