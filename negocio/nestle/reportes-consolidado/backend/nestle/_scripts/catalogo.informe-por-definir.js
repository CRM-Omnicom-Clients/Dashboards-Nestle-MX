// nestle-catalogo · EL INFORME DE LOS `POR DEFINIR`, agrupado y con contexto. Mide, no escribe.
//
// 🔴 POR QUÉ NO BASTA LA LISTA DE COLUMNAS. Decir «67 celdas en 35 columnas» no le sirve a nadie
//    para decidir. Lo que hace falta es: QUÉ pieza, de QUÉ campaña, y POR QUÉ falta — porque el
//    motivo cambia quién lo puede resolver. Un hueco de Qcart lo cierra el maestro de links; uno
//    de WhatsApp lo cierra Twilio; uno de una pieza sin envíos no lo cierra nadie hasta que salga.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var FALTA = /^(POR DEFINIR|PENDIENTE)$/i;
var falta = function (v) { return FALTA.test(t(v)); };

var X = M.cargar();
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(X.tmp).Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var nmC = X.columna('Campaña'), nmT = X.columna('TouchPoint'), nmS = X.columna('Segmento'), nmCanal = X.columna('Canal');
var nmQcart = X.columna('Tiene_Qcart');

// 🔴 CADA COLUMNA CON HUECOS SE CLASIFICA POR QUIÉN LA PODRÍA CERRAR. El grupo no sale del nombre:
//    sale de qué fuente alimenta esa columna en el sistema.
var GRUPO = [
  { re: /^(Receta|URL_Receta|Cod_Walmart|Cod_Chedraui|Carritos_Walmart|Carritos_Chedraui|Codigos_Qcart|Fuente_Qcart|Fecha_Activacion_Qcart|Activaciones_Qcart|N_Recetas|Tiene_Qcart|Carritos_Total|Views_Total)/,
    grupo: 'QCART', cierra: 'el maestro Qcart-Links Mails-Hive-MX.xlsx' },
  { re: /^(Email_Name|Email_Names_Variantes|N_Email_Names|Asset_ID|Content_ID|Email_ID|Subject|Email_Type|Tipo_Envio|Sends|Codigo_NC|ID_SFMC|Audiencia)/,
    grupo: 'SFMC', cierra: 'SFMC — pero solo si la pieza tiene envíos ahí' },
  { re: /^(Fecha_|Quincena|Mes|Dias_Envio|N_Envios_Fechados|Granularidad|Sends_Por|Meses_Activos|N_Meses|N_Quincenas)/,
    grupo: 'PERIODO', cierra: 'el detalle día por día de SFMC' },
  { re: /^(Objetivo|Segmento|Subsegmento|Segmentos_Combinados|Oleada|Mascota|Pieza_Principal|Camp_ID|Journey_ID|Marca|BU|Canal|TouchPoint|Touchpoint_Raw)/,
    grupo: 'DIMENSIÓN', cierra: '🔴 RICK — se declara, no se deduce (R1)' },
  { re: /^(Clicks_Medidos|Fuente_Dato|Estado|Notas)/, grupo: 'PROCEDENCIA', cierra: 'el propio sistema al cargar la pieza' }
];
function grupoDe(h) { for (var i = 0; i < GRUPO.length; i++) if (GRUPO[i].re.test(h)) return GRUPO[i]; return { grupo: 'OTRO', cierra: '—' }; }

// por qué esa PIEZA tiene huecos
function porQue(p) {
  var canal = t(p[nmCanal]), cruza = !!X.sfmcDe(p);
  if (/whats/i.test(canal)) return 'es de WhatsApp — SFMC no la tiene';
  if (!cruza) return 'no cruza con SFMC (sin envíos en la DE)';
  return 'cruza con SFMC';
}

var filas = [];
enc.forEach(function (h) {
  if (!h) return;
  X.piezas.forEach(function (p) {
    if (!falta(p[h])) return;
    var g = grupoDe(h);
    filas.push({ col: h, grupo: g.grupo, cierra: g.cierra, id: X.idDe(p),
      campana: t(p[nmC]), tp: t(p[nmT]), seg: t(p[nmS]), canal: t(p[nmCanal]),
      qcart: t(p[nmQcart]), motivo: porQue(p) });
  });
});

console.log('════════ LOS `POR DEFINIR` DEL CATÁLOGO, POR GRUPO ════════\n');
console.log('  ' + filas.length + ' celda(s) en total   ·   ' + X.piezas.length + ' piezas del catálogo, ' + X.cruzan + ' cruzan con SFMC\n');

var porG = {};
filas.forEach(function (f) { (porG[f.grupo] = porG[f.grupo] || []).push(f); });
Object.keys(porG).sort(function (a, b) { return porG[b].length - porG[a].length; }).forEach(function (g) {
  var G = porG[g];
  var piezas = {}; G.forEach(function (f) { piezas[f.id] = f; });
  var cols = {}; G.forEach(function (f) { cols[f.col] = (cols[f.col] || 0) + 1; });
  console.log('  ══ ' + g + '   ·   ' + G.length + ' celda(s)   ·   ' + Object.keys(piezas).length + ' pieza(s)   ·   ' + Object.keys(cols).length + ' columna(s)');
  console.log('     lo cierra: ' + G[0].cierra);
  console.log('     columnas:  ' + Object.keys(cols).sort().map(function (k) { return k + '(' + cols[k] + ')'; }).join('  '));
  console.log('     las piezas:');
  Object.keys(piezas).sort().forEach(function (id) {
    var f = piezas[id];
    var suyas = G.filter(function (x) { return x.id === id; }).length;
    console.log('        ' + id.padEnd(10) + t(f.campana).slice(0, 16).padEnd(18) + t(f.tp).slice(0, 12).padEnd(14) +
      t(f.seg).slice(0, 24).padEnd(26) + String(suyas).padStart(2) + ' hueco(s)   ' + f.motivo);
  });
  console.log('');
});

fs.writeFileSync(BACK + '/_preescritura/informe-por-definir.json', JSON.stringify({ cuando: new Date().toISOString(), filas: filas }, null, 1));
console.log('  → _preescritura/informe-por-definir.json');
