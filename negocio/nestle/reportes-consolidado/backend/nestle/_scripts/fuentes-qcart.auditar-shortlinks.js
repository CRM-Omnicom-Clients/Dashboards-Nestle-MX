/*
 * fuentes-qcart.auditar-shortlinks.js — TODA la atribución de Qcart, anclada en el SHORTLINK.
 *
 * POR QUÉ: Rick, 10-sep-2026, señalando la columna B del CSV: «tienes un código del short link.
 * Ese código es el código único de cada short link… revisa todas las atribuciones de qcart, bien
 * cruzado con el catálogo, piezas, touchpoints, campañas. Esa es el ancla, ese es el shortlink».
 *
 * 🔴 EL RECORRIDO, y se mide en cada salto — no solo al final:
 *
 *      shortlink  →  bloque del MAESTRO  →  pieza del CATÁLOGO  →  celda del REPORTE
 *      (el ancla)    (campaña·tp·audiencia)  (Pieza_ID·segmento)    (camp·tp·seg·quincena)
 *
 * 🔴 Y SE CUENTA LO QUE NO LLEGA, con su motivo. «0 carritos» tiene tres lecturas que no se
 *    parecen: el link no tuvo tráfico · lo tuvo y el maestro no lo conoce · lo tuvo y cayó fuera
 *    de la ventana de activación. Solo la primera es normal.
 *
 * 🔴 `source` decide si el tráfico es NUESTRO. Un shortlink de la receta puede recibir clics de
 *    paid, de social o de búsqueda; esos no son atribuibles a un correo. Sin este filtro, «190
 *    shortlinks que el maestro no conoce» parece una catástrofe y son 27.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
var LK = require(__dirname + '/lib-qcart-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
var NUESTRO = 'crm-hive';

// ── las cuatro capas ────────────────────────────────────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_audsl.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var wb = XLSX.readFile(tmp);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '' });
fs.unlinkSync(tmp);

var K = {};
[['id', 'Pieza' + '_ID'], ['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'],
 ['cods', 'Codigos' + '_Qcart'], ['tiene', 'Tiene' + '_Qcart'], ['sends', 'Sen' + 'ds']
].forEach(function (x) { K[x[0]] = COL.de(P, x[1], 'catalogo'); });
var RC = {};
[['cam', 'Camp' + 'aña'], ['tp', 'Touch' + 'Point'], ['seg', 'Segm' + 'ento'], ['carr', 'Carritos' + '_Total']
].forEach(function (x) { RC[x[0]] = COL.opcional(R, x[1]); });

var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// ── la descarga cruda, agrupada por shortlink ───────────────────────────────
var dirV = PROY + '/ReportesQcart/_vigentes';
var crudo = {}, sinCodigo = 0, filas = 0;
fs.readdirSync(dirV).filter(function (f) { return /carts-raw.*\.csv$/i.test(f); }).forEach(function (f) {
  var L = fs.readFileSync(dirV + '/' + f, 'utf8').split(/\r?\n/).filter(function (l) { return l.trim(); });
  L.slice(1).forEach(function (l) {
    var p = l.split(';'); if (p.length < 9) return;
    filas++;
    var c = t(p[1]);
    if (!c) { sinCodigo++; return; }
    var x = crudo[c] = crudo[c] || { n: 0, nuestros: 0, receta: t(p[2]), camp: {}, utm: {}, src: {}, f0: '9', f1: '0' };
    x.n++;
    if (t(p[5]) === NUESTRO) x.nuestros++;
    x.src[t(p[5])] = (x.src[t(p[5])] || 0) + 1;
    x.camp[t(p[3])] = 1; x.utm[t(p[6])] = 1;
    var d = t(p[0]).slice(0, 10);
    if (d < x.f0) x.f0 = d; if (d > x.f1) x.f1 = d;
  });
});

// ── el catálogo: qué pieza declara cada shortlink ───────────────────────────
var piezaDe = {}, dimDe = {};
P.forEach(function (r) {
  var id = t(r[K.id]); if (!id) return;
  dimDe[id] = { cam: t(r[K.cam]), tp: t(r[K.tp]), seg: t(r[K.seg]), sends: t(r[K.sends]) };
  t(r[K.cods]).split(/[,;]/).map(t).forEach(function (c) {
    if (c && !TOKEN.test(c)) (piezaDe[c] = piezaDe[c] || []).push(id);
  });
});

// ── el bloque: dónde acabó cada carrito ─────────────────────────────────────
var enBloque = {};
Q.carritos.forEach(function (e) {
  var c = t(e.shortlink_code); if (!c) return;
  var x = enBloque[c] = enBloque[c] || { n: 0, piezas: {} };
  x.n++; x.piezas[t(e.pieza_id) || '(sin pieza)'] = (x.piezas[t(e.pieza_id) || '(sin pieza)'] || 0) + 1;
});

console.log('════════ QCART · TODA LA ATRIBUCIÓN, ANCLADA EN EL SHORTLINK ════════\n');
console.log('  descarga: ' + mil(filas) + ' filas · ' + Object.keys(crudo).length + ' shortlinks distintos · ' + mil(sinCodigo) + ' filas sin código');
console.log('  maestro : ' + Object.keys(MAE.links).length + ' shortlinks declarados');
console.log('  catálogo: ' + Object.keys(piezaDe).length + ' shortlinks declarados en alguna pieza');
console.log('  bloque  : ' + mil(Q.carritos.length) + ' carritos acumulados\n');

// ══ 1 · LOS SHORTLINKS DEL MAESTRO, uno por uno ════════════════════════════
var FILAS = [], SIN_PIEZA = [], SIN_MAESTRO = [], DOBLE = [];
Object.keys(MAE.links).sort().forEach(function (c) {
  var m = MAE.links[c];
  var cr = crudo[c], bl = enBloque[c];
  var pz = piezaDe[c] || [];
  var trafico = cr ? cr.n : 0, nuestro = cr ? cr.nuestros : 0, dentro = bl ? bl.n : 0;
  var estado, det = '';
  if (!trafico) estado = '·  sin tráfico';
  else if (dentro) estado = '✔  atribuido';
  else if (m.fecha_activacion > (cr.f1 || '')) { estado = '⏸  todo antes de activación'; det = 'tráfico ' + cr.f0 + '→' + cr.f1 + ' · activa ' + m.fecha_activacion; }
  else estado = '🔴 con tráfico y CERO en el bloque';
  if (!pz.length && trafico) SIN_PIEZA.push({ c: c, m: m, n: trafico, dentro: dentro });
  if ((m.otras_fechas || []).length) DOBLE.push({ c: c, m: m });
  FILAS.push({ c: c, hoja: m.hoja, utm: t(m.utm_content), act: m.fecha_activacion, receta: t(m.receta),
    trafico: trafico, nuestro: nuestro, dentro: dentro, pz: pz, estado: estado, det: det,
    piezas: bl ? Object.keys(bl.piezas) : [] });
});

console.log('══ 1 · LOS ' + FILAS.length + ' SHORTLINKS DEL MAESTRO ══');
console.log('  ' + 'código'.padEnd(11) + 'hoja'.padEnd(12) + 'utm'.padEnd(10) + 'activa'.padEnd(12) +
  'crudo'.padStart(6) + 'nuestro'.padStart(8) + 'bloque'.padStart(7) + '  pieza(s) que lo reciben');
console.log('  ' + '─'.repeat(104));
FILAS.forEach(function (f) {
  console.log('  ' + f.c.padEnd(11) + f.hoja.slice(0, 10).padEnd(12) + f.utm.slice(0, 8).padEnd(10) + f.act.padEnd(12) +
    String(f.trafico).padStart(6) + String(f.nuestro).padStart(8) + String(f.dentro).padStart(7) + '  ' +
    (f.piezas.length ? f.piezas.join(' ') : (f.pz.length ? '(declarado en ' + f.pz.join(' ') + ', 0 carritos)' : '—')) +
    '   ' + f.estado + (f.det ? ' · ' + f.det : ''));
});

// ══ 2 · TRÁFICO NUESTRO CON CÓDIGO QUE EL MAESTRO NO CONOCE ════════════════
console.log('\n══ 2 · SHORTLINKS DE NUESTROS CORREOS QUE EL MAESTRO NO DECLARA ══');
var huerf = Object.keys(crudo).filter(function (c) { return !MAE.links[c] && crudo[c].nuestros > 0; })
  .sort(function (a, b) { return crudo[b].nuestros - crudo[a].nuestros; });
var volH = huerf.reduce(function (s, c) { return s + crudo[c].nuestros; }, 0);
console.log('  ' + huerf.length + ' shortlinks · ' + volH + ' carritos de source=' + NUESTRO + ' que NO llegan a ninguna pieza');
console.log('  ' + 'código'.padEnd(11) + 'receta'.padEnd(28) + 'campaña utm'.padEnd(26) + 'utm_content'.padEnd(13) + 'nuestros'.padStart(9) + '  fechas');
console.log('  ' + '─'.repeat(104));
huerf.forEach(function (c) {
  var x = crudo[c];
  console.log('  ' + c.padEnd(11) + x.receta.slice(0, 26).padEnd(28) + Object.keys(x.camp).join(',').slice(0, 24).padEnd(26) +
    Object.keys(x.utm).join(',').slice(0, 11).padEnd(13) + String(x.nuestros).padStart(9) + '  ' + x.f0 + '→' + x.f1);
});

// ══ 3 · EL CRUCE CON EL CATÁLOGO ═══════════════════════════════════════════
console.log('\n══ 3 · EL CATÁLOGO CONTRA EL MAESTRO ══');
var declCat = Object.keys(piezaDe), declMae = Object.keys(MAE.links);
console.log('  shortlinks declarados en una pieza pero NO en el maestro: ' +
  declCat.filter(function (c) { return !MAE.links[c]; }).join(' · ') || '(ninguno)');
console.log('  shortlinks del maestro que NINGUNA pieza declara y SÍ tienen tráfico nuestro:');
var noDecl = SIN_PIEZA.filter(function (x) { return crudo[x.c] && crudo[x.c].nuestros; });
if (!noDecl.length) console.log('     ✔ ninguno');
noDecl.forEach(function (x) {
  console.log('     ' + x.c.padEnd(11) + x.m.hoja.padEnd(12) + t(x.m.utm_content).padEnd(10) +
    'crudo ' + String(x.n).padStart(4) + ' · bloque ' + String(x.dentro).padStart(4) + '   ' + t(x.m.receta).slice(0, 30));
});
console.log('  shortlinks con MÁS DE UNA activación (ambiguos): ' + DOBLE.length);
DOBLE.forEach(function (x) { console.log('     🔴 ' + x.c + '   gana ' + x.m.fecha_activacion + ' (' + x.m.hoja + ' · ' + x.m.utm_content + ')   también: ' + x.m.otras_fechas.join(' · ')); });

// ══ 4 · EL CUADRE FINAL ════════════════════════════════════════════════════
var aud = Q.auditoria.carritos;
var enMaestroVol = FILAS.reduce(function (s, f) { return s + f.trafico; }, 0);
console.log('\n══ 4 · EL CUADRE ══');
console.log('  filas de la descarga                                : ' + mil(filas));
console.log('  · sin shortlink code                                : ' + mil(sinCodigo) + '   (el ancla no existe: no se puede atribuir)');
console.log('  · con código que el maestro NO conoce               : ' + mil(filas - sinCodigo - enMaestroVol));
console.log('      de esas, de nuestros correos                    : ' + volH + ' 🔴');
console.log('  · con código que el maestro SÍ conoce               : ' + mil(enMaestroVol));
console.log('      entraron al bloque                              : ' + mil(aud.dentro));
console.log('      fuera por activación                            : ' + mil(aud.fuera_antes_de_activacion));
// 🔴 `fuera_link_invalido` NO se resta de los 294. Sale de las entradas del maestro cuya «Fecha de
//    envío» no es una fecha —«No usado», «No salió», «Envío Federación»—: ésas ni siquiera llegan a
//    `MAE.links`, así que su tráfico cae en el cubo de «el maestro no lo conoce», no en éste.
//    Restarlo aquí daba «-34 sin explicar» sobre una cuenta que cuadra exacto.
var cuadra = (aud.dentro + aud.fuera_antes_de_activacion) === enMaestroVol;
console.log('      ' + (cuadra ? '✔ cuadra exacto: ' + mil(aud.dentro) + ' + ' + mil(aud.fuera_antes_de_activacion) + ' = ' + mil(enMaestroVol)
  : '⚠ ' + mil(enMaestroVol - aud.dentro - aud.fuera_antes_de_activacion) + ' sin explicar'));
console.log('  · con código de un link que el maestro declara SIN FECHA válida : ' + mil(aud.fuera_link_invalido) +
  '   («No usado» · «No salió» · ' + (MAE.invalidos || []).length + ' entradas así en el maestro)');

fs.writeFileSync(BACK + '/_preescritura/auditoria-shortlinks.json', JSON.stringify({
  cuando: new Date().toISOString(), filas: filas, sin_codigo: sinCodigo,
  shortlinks_maestro: FILAS, huerfanos_nuestros: huerf.map(function (c) { return { c: c, n: crudo[c].nuestros, receta: crudo[c].receta, camp: Object.keys(crudo[c].camp), utm: Object.keys(crudo[c].utm) }; }),
  ambiguos: DOBLE.map(function (x) { return x.c; })
}, null, 1));
console.log('\n  → _preescritura/auditoria-shortlinks.json');
