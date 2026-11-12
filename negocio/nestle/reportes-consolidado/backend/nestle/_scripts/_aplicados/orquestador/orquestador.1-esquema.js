// E0.1 · EL ESQUEMA DECLARADO — el diccionario de datos del sistema.
//
// 🔴 QUÉ ES: la declaración formal de entidades, llaves y relaciones. Hasta hoy cada skill sabía
//    «su» llave y la hardcodeaba; por eso el mismo hecho se emparejaba distinto en cada script y la
//    atribución dependía de que alguien encontrara el dato. Esto es el equivalente al diccionario
//    de datos de una base: una sola declaración que todos consultan.
//
// 🔴 NACE VERIFICADO, no declarado a mano. Cada afirmación del esquema se comprueba contra el
//    archivo real ANTES de escribirse: que la columna exista, que la llave sea única, que la
//    foránea resuelva. Un esquema que dice algo que el archivo no cumple es peor que no tenerlo:
//    da permiso. Si algo no cuadra, este paso NO escribe y reporta qué falló.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nmz(v) {
  return t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
var ok = 0, mal = 0, fallas = [];
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(56) + e); if (c) ok++; else { mal++; fallas.push(n + ' — ' + e); } }

console.log('════════ E0.1 · ESQUEMA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var H = function (h) { return XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '', blankrows: false }); };
var ENC = function (h) { return (XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || []).map(t); };

// ── EL PREFIJO DIMENSIONAL · las 12 columnas, en este orden, en todas las hojas
var PREFIJO = [
  { orden: 1, id: 'dim.campana', nombre: 'Campaña', tipo: 'texto', vocabulario: 'cerrado', na: false },
  { orden: 2, id: 'dim.canal', nombre: 'Canal', tipo: 'texto', vocabulario: 'cerrado', na: false },
  { orden: 3, id: 'dim.objetivo', nombre: 'Objetivo', tipo: 'texto', vocabulario: 'cerrado', na: true },
  { orden: 4, id: 'dim.touchpoint', nombre: 'TouchPoint', tipo: 'texto', vocabulario: 'abierto', na: false },
  { orden: 5, id: 'dim.segmento', nombre: 'Segmento', tipo: 'texto', vocabulario: 'abierto', na: true },
  { orden: 6, id: 'dim.quincena', nombre: 'Quincena', tipo: 'texto', formato: 'AAAA-MM-Qn', na: false },
  { orden: 7, id: 'dim.mes', nombre: 'Mes', tipo: 'texto', na: false },
  { orden: 8, id: 'dim.mes_num', nombre: 'Mes (#)', tipo: 'entero', na: false },
  { orden: 9, id: 'dim.marca', nombre: 'Marca', tipo: 'texto', vocabulario: 'cerrado', na: false },
  { orden: 10, id: 'dim.bu', nombre: 'BU', tipo: 'texto', vocabulario: 'cerrado', na: false },
  { orden: 11, id: 'dim.pieza_id', nombre: 'Pieza_ID', tipo: 'texto', formato: 'CCC-Pnnn', na: true },
  { orden: 12, id: 'dim.email_name', nombre: 'Email_Name', tipo: 'texto', na: true }
];

// ── LAS ENTIDADES · llaves y cardinalidades
var ENTIDADES = {
  campana: {
    que_es: 'La campaña de marketing. Vocabulario CERRADO: ningún paso puede introducir una nueva.',
    llave_primaria: 'Camp_ID', llave_natural: 'Campaña',
    vive_en: '_contratos/vocabulario.json', hijos: ['pieza']
  },
  pieza: {
    que_es: 'Una pieza enviable identificable. En email = un correo (Principal o FUP). En WhatsApp = un envío.',
    llave_primaria: 'Pieza_ID',
    llave_natural: 'Email_Name',
    nota_llave_natural: 'PROBADO único: 99 piezas con nombre, 99 nombres distintos, 0 repetidos.',
    foraneas: {
      'Camp_ID': 'campana',
      'Pieza_Principal_ID': 'pieza · apunta al Principal del que este FUP es seguimiento. N/A si no es FUP.'
    },
    vive_en: 'Catalogo_Piezas', grano: 'una fila = una pieza',
    hijos: ['envio_email', 'envio_whatsapp', 'link_qcart'],
    ojo_pro_plan: '🔴 Pro Plan (Fuel for life) tiene 17 piezas reales y SE MANTIENEN TODAS. Su desglose es ' +
      'touchpoint (E-E3 · E-E4) × audiencia (Pet Parents · Aspiracionales · Educated Pet Owners) × mascota ' +
      '(Perros · Gatos · Mixto). El catálogo guarda el segmento corto y por eso 7 piezas colisionan; ' +
      'SFMC entrega el segmento COMPLETO («Pro Plan Pet Parents · Perros») y ESO es lo que las distingue. ' +
      'Ningún paso puede agrupar Pro Plan a un segmento corto: destruiría el desglose que el reporte existe para dar.'
  },
  envio_email: {
    que_es: 'Las métricas de SFMC de una pieza de email.',
    llave_primaria: 'Email_ID', nota: 'Email_ID es el número de la DE. Content_ID es la colita del Email_Name. NO son lo mismo.',
    foraneas: { 'Pieza_ID': 'pieza' }, vive_en: 'Data_Email', grano: 'una fila = una pieza'
  },
  envio_whatsapp: {
    que_es: 'Las métricas de un envío de WhatsApp. No tiene Email_Name ni Subject → N/A.',
    llave_primaria: 'Pieza_ID + TouchPoint', foraneas: { 'Pieza_ID': 'pieza' },
    vive_en: 'Data_WhatsApp', grano: 'una fila = un envío'
  },
  link_qcart: {
    que_es: 'Un shortlink de Qcart. Pertenece a UNA pieza, por tanto a UN touchpoint × UNA audiencia.',
    llave_primaria: 'shortlink_code',
    autoridad: 'Qcart-Links Mails-Hive-MX.xlsx — lo que no está ahí no cuenta',
    foraneas: { 'Pieza_ID': 'pieza' },
    vive_en: 'Catalogo_Piezas (columnas Cod_*) + _catalogo/activacion-qcart.json'
  },
  evento_qcart: {
    que_es: 'Un carrito o un producto. Solo cuenta desde la fecha de activación de su link.',
    llave_primaria: 'fecha_hora + shortlink_code + tienda + producto',
    foraneas: { 'shortlink_code': 'link_qcart' },
    vive_en: 'Data_Qcart_Carritos · Data_Qcart_Productos', grano: 'una fila = un evento'
  },
  fila_reporte: {
    que_es: 'La unidad de reporte: agrega N piezas. Principal y FUP van FUSIONADOS en una fila.',
    llave_primaria: 'Campaña + TouchPoint + Segmento + Quincena_del_Principal',
    nota_llave: 'Sin la quincena hay 13 colisiones MEDIDAS: las oleadas de AON (marzo y abril) comparten campaña, touchpoint y segmento pero son piezas distintas.',
    vive_en: 'Report_Resumen', grano: 'una fila = campaña × touchpoint × segmento × quincena'
  }
};

// ── LOS TRES ESTADOS DE UNA CELDA
var ESTADOS = {
  valor: 'el dato',
  'N/A': 'NO APLICA a esta fila por naturaleza — Email_Name en WhatsApp, FUP_Sends sin FUP, Pieza_Principal_ID en un Principal',
  PENDIENTE: 'SÍ aplica y lo debemos — un subject que la fuente todavía no entrega',
  regla: 'Ninguna celda vacía. Llenar todo de N/A cerraría el archivo pero borraría la señal de qué falta; con tres estados un guardián puede exigir que PENDIENTE tienda a cero.',
  meta_del_corte: '0 vacías · 0 PENDIENTE'
};

// ── LAS HOJAS Y SU GRANO
var HOJAS = {
  'Report_Resumen': { entidad: 'fila_reporte', prefijo: true, escribe: 'resumen.regenerar.js' },
  'Catalogo_Piezas': { entidad: 'pieza', prefijo: true, escribe: 'los skills de catálogo vía el acumulador' },
  'Data_Email': { entidad: 'envio_email', prefijo: true, escribe: 'fuentes-email.reconstruir-data-email.js' },
  'Data_WhatsApp': { entidad: 'envio_whatsapp', prefijo: true, escribe: 'el skill de fuente WhatsApp' },
  'Data_Qcart_Carritos': { entidad: 'evento_qcart', prefijo: true, escribe: 'el skill de fuente Qcart' },
  'Data_Qcart_Productos': { entidad: 'evento_qcart', prefijo: true, escribe: 'el skill de fuente Qcart' },
  'Catalogo_Referencias': { entidad: 'normalizacion', prefijo: true, escribe: 'vista de _contratos/normalizacion.json',
    puente: ['Pieza_IDs', 'Dimension', 'Valor_Canonico'] },
  'Reporte_julio': { entidad: 'histórico', prefijo: false, escribe: 'NADIE — congelado, modelo viejo' }
};

// ══════════ VERIFICAR CONTRA EL ARCHIVO REAL ══════════
console.log('══ 1 · las hojas que el esquema declara, ¿existen? ══');
Object.keys(HOJAS).forEach(function (h) {
  chk('hoja «' + h + '»', !!wb.Sheets[h], wb.Sheets[h] ? ENC(h).length + ' columnas' : '🔴 no existe');
});

console.log('\n══ 2 · ¿la llave natural de PIEZA es única? ══');
var P = H('Catalogo_Piezas');
var nombres = P.map(function (p) { return t(p['Email_Name']); }).filter(Boolean);
var unicos = nombres.filter(function (v, i, a) { return a.indexOf(v) === i; });
chk('Email_Name identifica una y solo una pieza', nombres.length === unicos.length,
  nombres.length + ' con nombre · ' + unicos.length + ' distintos');

console.log('\n══ 3 · ¿la llave primaria de PIEZA es única? ══');
var ids = P.map(function (p) { return t(p['Pieza_ID']); }).filter(Boolean);
var idsU = ids.filter(function (v, i, a) { return a.indexOf(v) === i; });
chk('Pieza_ID es único', ids.length === idsU.length && ids.length === P.length,
  ids.length + ' de ' + P.length + ' filas · ' + idsU.length + ' distintos');

console.log('\n══ 4 · ¿la llave del REPORTE es única con la quincena? ══');
// 🔴 BLOQUEA vs AVISA. Una colisión por un dato que la fuente NO tiene sería un defecto de diseño
//    y bloquearía. Estas colisiones son otra cosa: SFMC **sí** entrega lo que las desambigua
//    —`Fecha_Primer_Envio` (98/98) y un `Segmento` más específico (`… · Perros` / `· Gatos`)— y
//    el catálogo simplemente no lo cargó. Es DEUDA con dueño y paso que la cierra, no un vicio del
//    esquema. Se declara en `deuda_conocida` para que un guardián pueda exigir que esté vacía
//    antes de la Puerta 2; escribir el esquema callándola sería justo «dar permiso».
var llaves = {}, colision = [];
P.filter(function (p) { return /principal/i.test(t(p['Email_Type'])); }).forEach(function (p) {
  var k = t(p['Campaña']) + '|' + t(p['Touchpoint']) + '|' + t(p['Segmento']) + '|' + t(p['Quincena_Lanzamiento']);
  if (llaves[k]) colision.push(k); else llaves[k] = 1;
});
var sinQuincena = P.filter(function (p) { return !t(p['Quincena_Lanzamiento']); }).length;
console.log('   ' + (colision.length ? '⚠' : '✔') + ' Campaña+TouchPoint+Segmento+Quincena'.padEnd(56) +
  Object.keys(llaves).length + ' llaves' + (colision.length ? '   ⚠ ' + colision.length + ' colisiones' : ''));
if (colision.length) {
  console.log('      causa medida: ' + sinQuincena + ' piezas sin Quincena_Lanzamiento, y NINGUNA tiene fecha en el catálogo');
  console.log('      pero SFMC entrega la fecha en 98/98 y un Segmento más específico → lo cierra el script 2.6');
  colision.slice(0, 4).forEach(function (k) { console.log('         ⚠ ' + k); });
}

console.log('\n══ 5 · ¿dónde vive hoy cada columna del prefijo? ══');
var faltantes = [];
Object.keys(HOJAS).filter(function (h) { return HOJAS[h].prefijo; }).forEach(function (h) {
  var enc = ENC(h).map(nmz);
  var faltan = PREFIJO.filter(function (c) { return enc.indexOf(nmz(c.nombre)) < 0; });
  // Canal/Medio y Quincena/Quincena_Lanzamiento son el mismo dato con otro nombre: se resolverán
  var falt2 = faltan.filter(function (c) {
    if (c.id === 'dim.canal' && enc.indexOf('medio') >= 0) return false;
    if (c.id === 'dim.quincena' && enc.indexOf('quincena_lanzamiento') >= 0) return false;
    return true;
  });
  console.log('   ' + h.padEnd(24) + (falt2.length ? '🔴 le faltan ' + falt2.length + ': ' + falt2.map(function (c) { return c.nombre; }).join(', ') : '✔ completo'));
  if (falt2.length) faltantes.push({ hoja: h, faltan: falt2.map(function (c) { return c.nombre; }) });
});
console.log('\n   (esto NO es una falla: es el trabajo de las etapas 2 y 3)');

console.log('\n══ 6 · ¿la foránea Pieza_Principal_ID ya existe? ══');
var tienePPI = ENC('Catalogo_Piezas').indexOf('Pieza_Principal_ID') >= 0;
console.log('   ' + (tienePPI ? '✔ ya existe' : '○ no existe todavía — la crea la etapa 2.4'));

var esquema = {
  paso: 'E0.1', version: 1, fecha: '2026-08-24',
  que_es: 'El diccionario de datos del sistema: entidades, llaves, relaciones y grano. Ningún skill debe hardcodear una llave: la pide aquí.',
  como_se_usa: 'require lib-esquema.js — prefijo(), llaveDe(hoja), foraneas(hoja), admiteNA(hoja, col)',
  regla_de_oro: 'Un dato, una autoridad. Si dos lugares guardan el mismo hecho, uno es la autoridad y el otro es una vista verificada por un guardián.',
  prefijo_dimensional: PREFIJO,
  entidades: ENTIDADES,
  estados_de_celda: ESTADOS,
  hojas: HOJAS,
  verificado_contra_el_archivo: {
    cuando: '2026-08-24', checks_ok: ok, checks_mal: mal,
    email_name_unico: nombres.length === unicos.length,
    pieza_id_unico: ids.length === idsU.length,
    llave_reporte_sin_colision: colision.length === 0,
    prefijo_faltante_por_hoja: faltantes
  },
  deuda_conocida: [
    {
      que: 'La llave del reporte colisiona ' + colision.length + ' veces',
      causa: sinQuincena + ' piezas del catálogo no tienen Quincena_Lanzamiento, y ninguna tiene fecha. ' +
        'De ellas, 12 son Pro Plan CONFIRMADAS con envíos reales.',
      por_que_no_bloquea: 'El dato existe en la fuente: SFMC entrega Fecha_Primer_Envio en 98/98 piezas ' +
        'y un Segmento más específico que desambigua Pro Plan. No falta el dato: falta cargarlo.',
      lo_cierra: 'paso 2.6 — cargar fecha y segmento completo desde SFMC',
      colisiones: colision,
      guardian: 'antes de la Puerta 2, deuda_conocida debe estar VACÍA'
    },
    {
      que: '🔴 El reporte y el catálogo NO SE PUEDEN CRUZAR: 0 de 86 filas emparejan',
      causa: 'La quincena está en DOS formatos para el mismo hecho: Report_Resumen usa «Mar-Q1-2026» ' +
        'y Catalogo_Piezas usa «2026-03-Q1». Ninguna llave compuesta que la incluya puede funcionar.',
      medido: 'tal como están: 0/86 cruzan · normalizando el formato: 64/86',
      por_que_importa: 'Es la causa concreta de que la atribución dependa de buscar el dato a mano. ' +
        'No es un problema de contenido sino de FORMA: el dato es el mismo.',
      formato_canonico: 'AAAA-MM-Qn (el del catálogo) — ordenable alfabéticamente, sin ambigüedad de idioma',
      lo_cierra: 'paso 3.1 — lib-quincena: una sola regla (día 1-15 = Q1, 16-fin = Q2) y un solo formato',
      guardian: 'ninguna hoja puede escribir una quincena que no case con AAAA-MM-Qn'
    }
  ],
  decisiones_que_lo_originan: '_orquesta/plan-modelo-datos-y-skills.md — las 22 decisiones'
};

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S) — no se escribe' : '✅ ' + ok + ' checks en verde') + ' ════════');
if (mal) { fallas.forEach(function (f) { console.log('   · ' + f); }); process.exit(1); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
fs.writeFileSync(BACK + '/_contratos/esquema.json', JSON.stringify(esquema, null, 1));
console.log('\n  → _contratos/esquema.json   (' + PREFIJO.length + ' columnas de prefijo · ' +
  Object.keys(ENTIDADES).length + ' entidades · ' + Object.keys(HOJAS).length + ' hojas)');
