// E1.4 · EL CONTRATO DE ESCRITURA — qué escribe cada fuente, DÓNDE y CON QUÉ GRANO.
//
// 🔴 EL DEFECTO QUE CIERRA, en palabras de Rick: «los skills de fuente leen las fuentes, pero no
//    entienden cómo van a escribir la información». Hoy cada skill declara de dónde LEE
//    (`contrato-fuente-*.md`) y nadie declara a dónde ESCRIBE. Por eso el grano acaba decidiéndose
//    dentro del motor, tarde y sin que nadie lo revise.
//
// 🔴 EL CASO QUE LO PRUEBA — F1. El Qcart se estaba escribiendo COLAPSADO a un solo segmento por
//    campaña. Sumaba igual, así que las dos puertas pasaban en verde y ningún guardián lo veía;
//    solo se notaba mirando la hoja. Un contrato que declare «Qcart escribe por touchpoint ×
//    segmento» convierte ese defecto invisible en uno que se puede medir.
//
// 🔴 Y SE VERIFICA, no se declara y ya: cada columna declarada tiene que existir en su hoja, y el
//    grano declarado tiene que ser el que la hoja realmente tiene. Un contrato que nadie contrasta
//    es prosa.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var EQX = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');

var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var E = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(56) + e); c ? ok++ : mal++; }

// ══ EL CONTRATO ══
var CONTRATO = {
  catalogo: {
    que_es: 'El catálogo no es una fuente: es la TABLA MAESTRA. Define las dimensiones que las demás usan.',
    escribe_en: {
      'Report_Resumen': {
        grano: 'define la LLAVE de la fila: campaña × touchpoint × segmento × quincena del Principal',
        columnas: ['Campaña', 'Medio', 'Objetivo', 'TouchPoint', 'Segmento', 'Quincena_Lanzamiento', 'Mes', 'Mes (#)', 'Marca', 'BU'],
        llave: 'Campaña + TouchPoint + Segmento + Quincena_Lanzamiento',
        no_toca: ['ninguna métrica: el catálogo describe, no mide']
      }
    }
  },
  email: {
    que_es: 'Los envíos de email. Autoridad: la DE de SFMC (CRM_Email_Piezas), cruce por ContentName.',
    escribe_en: {
      'Data_Email': {
        grano: 'una fila = UNA PIEZA (98). No día de envío: la fuente entrega por pieza.',
        llave: 'Pieza_ID',
        no_toca: ['las 4 columnas canónicas escritas a mano por Rick — 277 celdas']
      },
      'Report_Resumen': {
        grano: 'campaña × touchpoint × segmento × quincena — Principal y FUP FUSIONADOS en la misma fila',
        columnas: ['Email Name SFMC_Principal', 'Principal_Subject', 'Principal_Sends', 'Principal_Deliveries',
          'Principal_Opens', 'Principal_Clicks', 'Email Name SFMC_FUP', 'FUP_Subject', 'FUP_Sends',
          'FUP_Deliveries', 'FUP_Opens', 'FUP_Clicks', 'Tot_Sends', 'Tot_Deliveries', 'Tot_Opens',
          'Tot_Clicks', 'Unsubs_Unicos', 'Audiencia_DE SFMC', 'Audiencia_Volumen SFMC',
          'Clicks_Unicos_Total', 'Clicks_Qcart', 'Clicks_App', 'Clicks_Social', 'Clicks_Web',
          'Clicks_Ver_Navegador', 'Clicks_Unsub'],
        llave: 'la misma fila que define el catálogo',
        ancla: 'el FUP se pega a la fila de su Principal por Pieza_Principal_ID, aunque haya salido en otra quincena',
        no_toca: ['las columnas WA-*', 'las columnas de Qcart']
      }
    }
  },
  whatsapp: {
    que_es: 'Los envíos de WhatsApp. No tiene Email_Name ni Subject: ahí va N/A.',
    escribe_en: {
      'Data_WhatsApp': { grano: 'una fila = un envío de WA', llave: 'Pieza_ID + TouchPoint', no_toca: ['nada de email'] },
      'Report_Resumen': {
        grano: 'su propia fila — una pieza de WhatsApp NO se fusiona con una de email',
        columnas: ['WA-Envíos', 'WA-Entregados', 'WA-No entregados', 'WA-Leídos', 'WA-Clicks'],
        llave: 'la misma fila que define el catálogo',
        no_toca: ['Email Name', 'Subject', 'las columnas Principal_* y FUP_*: van en N/A']
      }
    }
  },
  qcart: {
    que_es: 'Los carritos y productos. Autoridad de links: Qcart-Links Mails-Hive-MX.xlsx.',
    escribe_en: {
      'Data_Qcart_Carritos': { grano: 'una fila = un evento carrito', llave: 'fecha_hora + shortlink + tienda', no_toca: ['nada calculado: penetración y tickets son del motor'] },
      'Data_Qcart_Productos': { grano: 'una fila = un evento producto', llave: 'fecha_hora + shortlink + tienda + producto', no_toca: ['idem'] },
      'Report_Resumen': {
        grano: '🔴 POR TOUCHPOINT × SEGMENTO. La quincena es solo el ANCLA temporal.',
        regla_dura: 'El ancla decide EN QUÉ FILA se pega el Qcart, NO cuántas filas hay. Agrupar a un ' +
          'solo segmento por campaña borra la comparación que el reporte existe para dar — y CUADRA IGUAL, ' +
          'así que ninguna puerta lo detecta. Cada evento trae su pieza_id por su shortlink: se agrupa por ' +
          'pieza y se reparte sin duplicar.',
        columnas: ['QCART?', 'Receta_Representativa', 'FechaQcart_Desde', 'FechaQcart_Hasta',
          'Carritos_Walmart', 'Carritos_Chedraui', 'Carritos_Total', 'Views_Carrito',
          'Views_Productos_Nestle', 'Intencion_Total_MXN', 'Intencion_Nestle_MXN',
          'Pct_Penetracion_Nestle', 'Ticket_Carrito_MXN', 'Ticket_Producto_MXN'],
        llave: 'la misma fila que define el catálogo',
        ancla: 'la quincena de lanzamiento del Principal, pegada a una celda QUE YA EXISTE — nunca fabrica una',
        no_toca: ['las columnas de email', 'las columnas WA-*'],
        ojo_fup: 'Los carritos que llegaron por un link del FUP suman al Principal, y queda declarado que vinieron vía FUP.'
      }
    }
  },
  manual: {
    que_es: 'Lo que Rick declara a mano porque ninguna descarga lo entrega.',
    escribe_en: { 'Report_Resumen': { grano: 'la fila que Rick declare', columnas: ['las que declare'], llave: 'la misma', no_toca: ['lo que una fuente automática ya escribe'] } }
  }
};

console.log('════════ E1.4 · CONTRATO DE ESCRITURA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var ENC = function (h) { return (XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || []).map(t); };

// ── verificación 1 · toda columna declarada EXISTE en su hoja
console.log('══ 1 · ¿las columnas declaradas existen? ══');
var fantasmas = [];
Object.keys(CONTRATO).forEach(function (f) {
  Object.keys(CONTRATO[f].escribe_en).forEach(function (h) {
    var d = CONTRATO[f].escribe_en[h];
    if (!d.columnas || !wb.Sheets[h]) return;
    var enc = ENC(h).map(E.nmz);
    var faltan = d.columnas.filter(function (c) { return c !== 'las que declare' && enc.indexOf(E.nmz(c)) < 0; });
    console.log('   ' + (faltan.length ? '🔴' : '✔') + ' ' + (f + ' → ' + h).padEnd(34) +
      d.columnas.length + ' columnas' + (faltan.length ? '   🔴 no existen: ' + faltan.join(', ') : ''));
    faltan.forEach(function (c) { fantasmas.push(f + ' → ' + h + ' → ' + c); });
  });
});
chk('ninguna columna declarada es un fantasma', fantasmas.length === 0,
  fantasmas.length ? '🔴 ' + fantasmas.length : 'todas existen');

// ── verificación 2 · ninguna fuente declara una columna de OTRA
console.log('\n══ 2 · ¿alguna fuente invade a otra? ══');
var dueno = {}, invasiones = [];
Object.keys(CONTRATO).forEach(function (f) {
  var d = (CONTRATO[f].escribe_en['Report_Resumen'] || {}).columnas || [];
  d.forEach(function (c) {
    if (dueno[c] && dueno[c] !== f) invasiones.push(c + ': ' + dueno[c] + ' y ' + f);
    dueno[c] = f;
  });
});
chk('cada columna del reporte tiene UN solo dueño', invasiones.length === 0,
  Object.keys(dueno).length + ' columnas con dueño' + (invasiones.length ? '   🔴 ' + invasiones.join(' · ') : ''));

// ── verificación 3 · el grano del Qcart, medido en la hoja real
console.log('\n══ 3 · el grano del Qcart en el reporte, MEDIDO ══');
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false })
  .filter(function (r) { return t(r['Campaña']) && !/^total/i.test(t(r['Campaña'])); });
var num = function (v) { return Number(String(v).replace(/[, ]/g, '')) || 0; };
// 🔴 ESTE CHECK ESTABA MAL Y LO CORRIJO EN EL MOMENTO: exigía «más de 1 celda por campaña», que es
//    fijar un número. Una campaña con un solo touchpoint DEBE tener una sola celda. Lo que hay que
//    medir es otra cosa: que el reporte tenga **tantas celdas con Qcart como combinaciones
//    touchpoint × segmento tienen carritos en el BLOQUE**. Se compara contra la fuente, no contra
//    una expectativa. Es el mismo defecto que acabo de corregir en el guardián de WhatsApp.
var bloque = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var piezaDim = {};
P.forEach(function (p) { piezaDim[t(p['Pieza_ID'])] = { camp: t(p['Campaña']), tp: t(EQX.campo(p,'TouchPoint','Touchpoint')), seg: t(p['Segmento']) }; });
var esperado = {};   // campaña → combinaciones touchpoint|segmento con carritos, según el BLOQUE
(bloque.carritos || []).forEach(function (e) {
  var d = piezaDim[t(e.pieza_id)]; if (!d || !d.camp) return;
  (esperado[d.camp] = esperado[d.camp] || {})[d.tp + '|' + d.seg] = 1;
});
var porCamp = {};
R.forEach(function (r) {
  if (num(r['Carritos_Total']) <= 0) return;
  (porCamp[t(r['Campaña'])] = porCamp[t(r['Campaña'])] || {})[t(r['TouchPoint']) + '|' + t(r['Segmento'])] = 1;
});
var desalineadas = [];
Object.keys(esperado).sort().forEach(function (c) {
  var esp = Object.keys(esperado[c]).length, hay = Object.keys(porCamp[c] || {}).length;
  var bien = hay === esp;
  console.log('   ' + (bien ? '✔' : '🔴') + ' ' + c.padEnd(18) + 'reporte: ' + String(hay).padStart(2) +
    ' celda(s)   ·   bloque: ' + String(esp).padStart(2) + ' combinación(es) con carritos' + (bien ? '' : '   🔴 se está colapsando'));
  if (!bien) desalineadas.push(c + ' (' + hay + ' vs ' + esp + ')');
});
chk('el Qcart se reparte como el bloque manda', desalineadas.length === 0,
  desalineadas.length ? '🔴 ' + desalineadas.join(' · ') : Object.keys(esperado).length + ' campañas, cada una con sus celdas');

// ── verificación 4 · el contrato cubre las 6 hojas que llevan datos
console.log('\n══ 4 · ¿el contrato cubre todas las hojas de datos? ══');
var cubiertas = {};
Object.keys(CONTRATO).forEach(function (f) { Object.keys(CONTRATO[f].escribe_en).forEach(function (h) { cubiertas[h] = 1; }); });
var deben = ['Report_Resumen', 'Data_Email', 'Data_WhatsApp', 'Data_Qcart_Carritos', 'Data_Qcart_Productos'];
var sinCubrir = deben.filter(function (h) { return !cubiertas[h]; });
chk('toda hoja de datos tiene una fuente que la declara', sinCubrir.length === 0,
  Object.keys(cubiertas).length + ' hojas cubiertas' + (sinCubrir.length ? '   🔴 ' + sinCubrir.join(', ') : ''));

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ' + ok + ' checks') + ' ════════');
if (mal) process.exit(1);
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
fs.writeFileSync(BACK + '/_contratos/escritura.json', JSON.stringify({
  paso: 'E1.4', fecha: '2026-08-24',
  que_es: 'Que escribe cada fuente, DONDE y CON QUE GRANO. Se declara ANTES de escribir.',
  por_que: 'Los skills de fuente sabian de donde LEEN pero no a donde ESCRIBEN, y el grano acababa decidiendose dentro del motor, tarde y sin revision. F1 es el caso que lo prueba.',
  se_verifica_con: 'E1-4-contrato-escritura.js — cada columna declarada debe existir, cada columna del reporte debe tener UN dueno, y el grano del Qcart se mide en la hoja real',
  fuentes: CONTRATO
}, null, 1));
console.log('\n  → _contratos/escritura.json   (' + Object.keys(CONTRATO).length + ' fuentes · ' + Object.keys(dueno).length + ' columnas con dueño)');
