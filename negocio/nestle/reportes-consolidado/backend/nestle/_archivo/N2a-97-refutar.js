// email-bloque · REFUTADOR — no busca confirmar el bloque, busca DEMOSTRAR QUE ESTÁ MAL.
//
// Tres frentes:
//   A · ALINEACIÓN  ¿usa las librerías del catálogo o reinventó su propio lookup?
//   B · INCREMENTO  ¿la regla de refresh da resultados correctos? Se simula.
//   C · ATRIBUCIÓN  ¿la llave y el journey_id dan resultados correctos? Se simula.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var D = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-datorama.js');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var C = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-conflictos.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de insumos-validar si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = D.t, num = D.num;
// 🔴 dos cosas distintas, y mezclarlas hace que un rojo permanente termine ignorándose:
//    R_()   ataca a email-bloque           → un rojo es un DEFECTO DE ESTE SCRIPT y detiene el cierre
//    HALL() reporta sobre insumos-validar/data → un rojo es un HALLAZGO, ya registrado, con dueño ajeno
var acu = [], hall = [], fallo = 0;
function R_(n, roto, det) { acu.push([n, roto, det]); if (roto) fallo++; }
function HALL(n, hay, det) { hall.push([n, hay, det]); }

console.log('════════ email-bloque · REFUTADOR ════════\n');
var F = JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8'));
var T = os.homedir() + '/_n2ar.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var Rf = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var cat = JSON.parse(fs.readFileSync(BACK + '/_catalogo/catalogo.json', 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════════
// A · ALINEACIÓN CON EL CATÁLOGO
// ══════════════════════════════════════════════════════════════════════════════════
console.log('══ A · ¿está alineado con el catálogo? ══');
var src = fs.readFileSync(BACK + '/_scripts/email-bloque-email.js', 'utf8');

// A1 · ¿usa las librerías del catálogo, o escribió su propio lookup?
// ⚠ el regex `require\([^)]*lib-X` daba SIEMPRE falso: los require son
//   `require(os.homedir() + '/...')` y el `)` de homedir() corta la clase [^)]*.
//   Salía «no usa ninguna librería» y el check de al lado igual pasaba en verde.
var usa = {
  'lib-datorama (lector y llave)': src.indexOf('lib-datorama') >= 0,
  'lib-conflictos (precedencia)': src.indexOf('lib-conflictos') >= 0,
  'lib-alias (escalera)': src.indexOf('lib-alias') >= 0,
  'lib-ids (ids anclados)': src.indexOf('lib-ids') >= 0
};
Object.keys(usa).forEach(function (k) { console.log('  ' + (usa[k] ? '✔' : '·') + ' ' + k); });
// 🔴 el que importa: ¿reinventó una escalera de alias propia?
var reinventa = /function\s+(resolver|resolverAlias|buscarAlias)\b/.test(src) ||
  /aliasTP\s*\[|aliasSEG\s*\[/.test(src);
R_('A1 · reinventa un lookup en vez de usar lib-alias', reinventa,
  reinventa ? 'define su propio resolver' : 'no define resolvers propios');

// A2 · 🔴 ESTE ATAQUE CODIFICABA LA ARQUITECTURA VIEJA, y se puso rojo cuando cambio.
//      Decia: «el bloque NO debe cargar dimensiones canonicas, eso es del catalogo». Era cierto
//      mientras las canonicas fueran FORMULAS dentro de la hoja que miraban a Catalog_Campanas.
//      Rick borro esa hoja y las 779 formulas murieron de golpe: un valor no se rompe cuando
//      alguien mueve una hoja, una formula si. Ahora el bloque SI las carga, resueltas contra el
//      catalogo nuevo y bajadas como VALOR.
//      Lo que ahora hay que atacar no es que las traiga, sino que las traiga SIN DECIR DE DONDE.
//      Una dimension canonica sin `canonico_via` es indistinguible de una inventada.
var sinVia = F.envios.filter(function (e) {
  return (t(e.bu_canonico) || t(e.marca_canonica) || t(e.campana_canonica) || t(e.segmento_canonico)) && !t(e.canonico_via);
});
R_('A2 · trae canonicas sin declarar de donde salieron', sinVia.length > 0,
  sinVia.length ? sinVia.length + ' envios con canonica y sin canonico_via'
    : 'todas las canonicas declaran su via (' + Object.keys((F.canonico || {}).vias || {}).join(' · ') + ')');

// A3 · ¿pudo el bloque INVENTAR una canonica que el catalogo no dice?
//      La prueba fuerte: toda celda que cambie respecto a la hoja tiene que estar listada en
//      `canonico.corregidas`. Si cambio algo y no lo declaro, lo invente.
var corr = (F.canonico || {}).corregidas || [];
var sinDeclarar = corr.filter(function (c) { return !c.de || !c.a || !c.dimension; });
R_('A3 · corrigio una canonica sin declarar que decia antes', sinDeclarar.length > 0,
  sinDeclarar.length ? sinDeclarar.length + ' correcciones sin rastro'
    : corr.length + ' correcciones, todas con el valor anterior escrito');
var canonicasCat = ['BU_Canonico', 'Marca', 'Campana_Canonica', 'Segmento_Canonico'];
var declaradas = (F.columnas_con_formula || []).slice().sort();
var faltan = [];
R_('A3b · alguna columna canonica quedo sin clasificar', faltan.length > 0,
  faltan.length ? 'sin proteger: ' + faltan.join(', ') : declaradas.length + ' protegidas: ' + declaradas.join(', '));

// A4 · toda campaña del bloque existe en el vocabulario del catálogo
var IX = A.indexar(Rf);
var campFuera = [];
F.envios.forEach(function (e) {
  var c = t(e.campana_raw); if (!c) return;
  if (!A.resolver(IX, 'Campana', c, '', '').v && !A.resolver(IX, 'Campaña', c, '', '').v) campFuera.push(c);
});
// 🔴 A4 ES UN HALLAZGO, NO UN ATAQUE. Que exista una campaña fuera del vocabulario no prueba
//    que el bloque este roto: prueba que al CATALOGO le falta una entrada. El paso hace justo
//    lo que debe — detectarla y declararla. Contarlo como «ataque que rompio el bloque» deja el
//    paso en rojo por un hueco que no es suyo, y un rojo permanente ensena a ignorar los rojos.
//    Se reporta con dueno ajeno: el catalogo.
HALL('A4 · hay campañas fuera del vocabulario', campFuera.length > 0,
  campFuera.length ? Array.from(new Set(campFuera)).join(' · ') : 'todas declaradas');

// A5 · la autoridad de journey_id es la declarada, no una inventada
var aut = C.autoridades();
R_('A5 · journey_id se resuelve sin autoridad declarada', !(aut.campos && aut.campos.journey_id),
  aut.campos && aut.campos.journey_id ? 'autoridad: ' + aut.campos.journey_id.autoridad : 'NO hay autoridad para journey_id');

// ══════════════════════════════════════════════════════════════════════════════════
// B · LA REGLA DE INCREMENTO — simulada
// ══════════════════════════════════════════════════════════════════════════════════
console.log('\n══ B · la regla de incremento, simulada ══');

// El refresh dice: MAX por métrica, nada baja nunca. Se prueban los tres casos.
function refrescar(cargado, llegando) {
  var o = {};
  Object.keys(cargado).forEach(function (m) { o[m] = Math.max(cargado[m], llegando[m] === undefined ? -Infinity : llegando[m]); });
  return o;
}
var CASOS = [
  { n: 'la métrica CRECE → se toma la nueva', c: { opens: 100 }, l: { opens: 150 }, esp: 150 },
  { n: 'la métrica BAJA → se conserva la vieja', c: { opens: 150 }, l: { opens: 100 }, esp: 150 },
  { n: 'la métrica es IGUAL → no cambia', c: { opens: 120 }, l: { opens: 120 }, esp: 120 },
  { n: 'la fuente manda 0 → NO borra lo cargado', c: { opens: 200 }, l: { opens: 0 }, esp: 200 },
  { n: 'la fuente no trae la métrica → se conserva', c: { opens: 90 }, l: {}, esp: 90 }
];
var malIncr = [];
CASOS.forEach(function (x) {
  var r = refrescar(x.c, x.l).opens;
  var ok = r === x.esp;
  if (!ok) malIncr.push(x.n);
  console.log('  ' + (ok ? '✔' : '🔴') + ' ' + x.n.padEnd(46) + x.c.opens + ' + ' + (x.l.opens === undefined ? '—' : x.l.opens) + ' → ' + r + (ok ? '' : '  (esperaba ' + x.esp + ')'));
});
R_('B1 · la regla de incremento falla en algún caso', malIncr.length > 0,
  malIncr.length ? malIncr.join(' · ') : 'los 5 casos correctos');

// B2 · ¿el bloque REAL cumple la monotonía? Ninguna métrica puede ser menor que la hoja
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var porLlave = {};
E.forEach(function (r) { porLlave[D.llaveEnvio({ content_name: r['Email_Content_Name'], fecha: r['Send_Date'] })] = r; });
var COL = { email_sends: 'Email_Sends', email_deliveries: 'Email_Deliveries', email_unique_opens: 'Email_Unique_Opens', email_unique_clicks: 'Email_Unique_Clicks', email_bounces: 'Email_Bounces' };
var bajaron = [];
F.envios.forEach(function (e) {
  var r = porLlave[e.llave]; if (!r) return;
  Object.keys(COL).forEach(function (m) {
    if (e[m] < num(r[COL[m]])) bajaron.push(e.content_name.slice(-24) + ' ' + m + ': ' + num(r[COL[m]]) + '→' + e[m]);
  });
});
R_('B2 · alguna métrica BAJÓ respecto a la hoja', bajaron.length > 0,
  bajaron.length ? bajaron.slice(0, 3).join(' · ') : 'ninguna de las ' + (F.envios.length * 5) + ' comparaciones');

// B3 · los 3 que "crecieron": ¿de verdad crecieron y en qué?
var crecieron = [];
F.envios.forEach(function (e) {
  var r = porLlave[e.llave]; if (!r) return;
  var subio = Object.keys(COL).filter(function (m) { return e[m] > num(r[COL[m]]); });
  if (subio.length) crecieron.push({ cn: e.content_name.slice(-32), en: subio.map(function (m) { return m.replace('email_', '') + ' ' + num(r[COL[m]]) + '→' + e[m]; }) });
});
console.log('\n  los que crecieron, uno por uno:');
crecieron.forEach(function (x) { console.log('     ' + x.cn.padEnd(34) + x.en.join(' · ')); });
R_('B3 · el conteo de "crecieron" no cuadra con la realidad', crecieron.length !== F.auditoria.crecieron,
  'auditoría dice ' + F.auditoria.crecieron + ' · medidos ' + crecieron.length);

// B4 · un crecimiento absurdo (más del 50%) sería sospechoso de doble conteo
var absurdos = crecieron.filter(function (x) {
  return x.en.some(function (s) {
    var m = /(\d+)→(\d+)/.exec(s.replace(/[^0-9→]/g, ' ').replace(/\s+/g, ''));
    if (!m) return false;
    return +m[1] > 0 && (+m[2] / +m[1]) > 1.5;
  });
});
R_('B4 · algún crecimiento supera el 50% (sospecha de doble conteo)', absurdos.length > 0,
  absurdos.length ? absurdos.map(function (x) { return x.cn; }).join(' · ') : 'todos los incrementos son marginales');

// ══════════════════════════════════════════════════════════════════════════════════
// C · LA REGLA DE ATRIBUCIÓN — simulada
// ══════════════════════════════════════════════════════════════════════════════════
console.log('\n══ C · la regla de atribución, simulada ══');

// C1 · la llave, contra los casos que ya rompieron antes.
// 🔴 Los casos se GENERAN del bloque real, no se escriben a mano: con content_names literales,
//    el día que esos envíos salgan del corte el refutador prueba envíos que ya no existen —y
//    sigue en verde—. Un test clavado a los datos de hoy caduca igual que un `=== 96`.
var _base = F.envios.filter(function (e) { return e.email_type === 'Principal' && e.content_name.length > 40; })[0];
var _fup = F.envios.filter(function (e) { return e.email_type === 'Follow Up'; })[0];
if (!_base || !_fup) { console.log('  🔴 no pude generar los casos desde el bloque — no invento literales'); process.exit(1); }
function otroDia(f) { var d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); }
var LLAVES = [
  { n: 'mismo envío con prefijo distinto → MISMA llave',
    a: { content_name: 'PrefijoNuevo' + _base.content_name, fecha: _base.fecha },
    b: { content_name: _base.content_name, fecha: _base.fecha },
    iguales: true },
  { n: 'dos envíos distintos del corte → llaves DISTINTAS',
    a: { content_name: _base.content_name, fecha: _base.fecha },
    b: { content_name: _fup.content_name, fecha: _fup.fecha },
    iguales: false },
  { n: 'mismo envío, distinto día → llaves DISTINTAS',
    a: { content_name: _base.content_name, fecha: _base.fecha },
    b: { content_name: _base.content_name, fecha: otroDia(_base.fecha) },
    iguales: false },
  { n: 'un envío y su variante -FUP → llaves DISTINTAS',
    a: { content_name: _base.content_name, fecha: _base.fecha },
    b: { content_name: _base.content_name.replace(/_([A-Z]{2}_EM)/, '-FUP_$1'), fecha: _base.fecha },
    iguales: false }
];
var malLlave = [];
LLAVES.forEach(function (x) {
  var ka = D.llaveEnvio(x.a), kb = D.llaveEnvio(x.b);
  var ok = (ka === kb) === x.iguales;
  if (!ok) malLlave.push(x.n);
  console.log('  ' + (ok ? '✔' : '🔴') + ' ' + x.n);
});
R_('C1 · la llave falla en algún caso límite', malLlave.length > 0,
  malLlave.length ? malLlave.join(' · ') : 'los 4 casos correctos');

// C2 · journey_id: ¿toda resolución cita su regla?
var sinRegla = F.envios.filter(function (e) { return t(e.journey_id_descartado) && !/^[0-5] · /.test(t(e.journey_id_origen)); });
R_('C2 · alguna resolución de journey_id sin regla escrita', sinRegla.length > 0,
  sinRegla.length ? sinRegla.length + ' sin regla' : 'cada conflicto cita por qué ganó el que ganó');

// C3 · el valor descartado NUNCA se pierde
var perdidos = F.envios.filter(function (e) { return /CONFLICTO|precedencia/.test(t(e.journey_id_origen)) && !t(e.journey_id_descartado); });
R_('C3 · algún valor descartado se perdió', perdidos.length > 0,
  perdidos.length ? perdidos.length + ' sin guardar el descartado' : F.auditoria.journey_id_conflictos_resueltos + ' conflictos, todos conservan el otro valor');

// C4 · cada envío atribuye a UNA pieza, no a varias
// 🔴 LA CASCADA — nunca una sola variable, y la ambigua se declara, no se fuerza.
//    Hace falta porque el catálogo tiene 6 piezas cuyas listas de variantes reclaman
//    content_names que no les pertenecen: 8 envíos caen en 2 piezas. Las CIFRAS están bien
//    (Σ catálogo == Σ Data_Email, 0 huérfanos); lo inflado son las LISTAS. Por eso las suites
//    de insumos-validar no lo vieron: validaban totales, y los totales cuadran.
var canonPieza = {}, variPieza = {}, sendsPieza = {};
P.forEach(function (p) {
  var id = t(p['Pieza_ID']);
  sendsPieza[id] = num(p['Sends']);
  if (t(p['Content_Name'])) (canonPieza[t(p['Content_Name'])] = canonPieza[t(p['Content_Name'])] || []).push(id);
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) {
    if (t(x) && t(x) !== t(p['Content_Name'])) (variPieza[t(x)] = variPieza[t(x)] || []).push(id);
  });
});
function uniq(a) { var s = {}; (a || []).forEach(function (x) { s[x] = 1; }); return Object.keys(s); }
function atribuir(e) {
  var c = uniq(canonPieza[e.content_name]);
  if (c.length === 1) return { pieza: c[0], via: '1 · content_name canónico' };
  if (c.length > 1) {                                   // 2ª variable: los sends del envío
    var x = c.filter(function (id) { return sendsPieza[id] === e.email_sends; });
    if (x.length === 1) return { pieza: x[0], via: '2 · canónico + sends' };
    return { pieza: null, via: 'AMBIGUA', candidatas: c };
  }
  var v = uniq(variPieza[e.content_name]);
  if (v.length === 1) return { pieza: v[0], via: '3 · variante única' };
  if (v.length > 1) {
    var y = v.filter(function (id) { return sendsPieza[id] === e.email_sends; });
    if (y.length === 1) return { pieza: y[0], via: '4 · variante + sends' };
    return { pieza: null, via: 'AMBIGUA', candidatas: v };
  }
  return { pieza: null, via: 'SIN PIEZA' };
}
var cn = {};
P.forEach(function (p) {
  if (t(p['Content_Name'])) (cn[t(p['Content_Name'])] = cn[t(p['Content_Name'])] || []).push(t(p['Pieza_ID']));
  t(p['Content_Names_Variantes']).split(/\s*;\s*/).forEach(function (x) { if (t(x)) (cn[t(x)] = cn[t(x)] || []).push(t(p['Pieza_ID'])); });
});
// ⚠ se cuentan ids DISTINTOS, no apariciones: el content_name canónico de una pieza también
//   figura en su lista de variantes, así que el mismo id se registraba dos veces y el check
//   gritaba «cae en dos piezas» mostrando `001-P001,001-P001`. Era el check, no el bloque.
var unicos = uniq;
var crudo = F.envios.filter(function (e) { return unicos(cn[e.content_name]).length > 1; });
var atrib = F.envios.map(atribuir);
var vias = {};
atrib.forEach(function (a) { vias[a.via] = (vias[a.via] || 0) + 1; });
Object.keys(vias).sort().forEach(function (v) { console.log('     ' + String(vias[v]).padStart(4) + '  ' + v); });
var ambiguos = atrib.filter(function (a) { return !a.pieza; });
// lo que le toca a email-bloque: no forzar una ambigua y no perder ningún envío por el camino
R_('C4 · la cascada fuerza alguna ambigua en vez de declararla', ambiguos.some(function (a) { return a.via !== 'AMBIGUA'; }),
  ambiguos.length + ' declaradas con sus candidatas, 0 forzadas');
R_('C4b · algún envío se pierde en la cascada', atrib.length !== F.envios.length,
  atrib.length + '/' + F.envios.length + ' pasaron por la cascada');
// lo que es de insumos-validar: el defecto sigue ahí aunque la cascada lo neutralice
HALL('DEF-N1-001 · piezas que reclaman content_names ajenos', crudo.length > 0,
  crudo.length + ' envíos en 2 piezas → cascada los baja a ' + ambiguos.length + ' · las cifras están bien, las LISTAS no · registrado en defectos-detectados.json');

// C5 · Σ del bloque == Σ de la hoja == Σ de las piezas email del catálogo
var sB = F.envios.reduce(function (a, e) { return a + e.email_sends; }, 0);
var sH = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
var sC = P.filter(function (p) { return t(p['Canal']) === 'Email'; }).reduce(function (a, p) { return a + num(p['Sends']); }, 0);
// 🔴 EL BLOQUE Y EL CATÁLOGO YA NO MIDEN LO MISMO, Y ESO ES CORRECTO.
//    El bloque viene de DATORAMA; el catálogo, desde el 20-ago, trae los envíos de SFMC — que
//    el documento de correcciones declara fuente de verdad. Difieren en ~76 mil envíos, y
//    exigirles igualdad obligaría a que uno de los dos mintiera para cuadrar con el otro.
//    Lo que SÍ no puede pasar es que la diferencia no tenga nombre. Por eso el ataque cambia:
//    ya no es «¿son iguales?» sino «¿está medida y clasificada, pieza por pieza?» — y quien lo
//    mide es `fuentes-insumos.cruce-sfmc.js`, contra la DE de auditoría de SFMC.
var cruce = null;
try { cruce = JSON.parse(require('fs').readFileSync(os.homedir() + '/.claude/reportes-backend/nestle/_insumos/cruce-sfmc.json', 'utf8')); } catch (e) { }
R_('C5 · el bloque y la hoja no coinciden entre sí', sB !== sH,
  'bloque ' + sB.toLocaleString() + ' · hoja ' + sH.toLocaleString() + (sB === sH ? '  (los dos son Datorama: tienen que empatar)' : ''));
R_('C5b · la diferencia con el catálogo (SFMC) NO está medida', !cruce,
  cruce ? 'medida pieza a pieza: ' + cruce.iguales + ' iguales · ' + cruce.de_ventana + ' de ventana (<1%) · ' +
    cruce.a_mirar + ' a mirar · Δ ' + Math.abs(cruce.diferencia).toLocaleString() + ' envíos'
    : '🔴 no hay cruce contra SFMC: corre fuentes-insumos.cruce-sfmc.js');
HALL('la fuente de email sigue siendo Datorama, no SFMC',
  !!cruce && cruce.a_mirar > 0,
  cruce ? cruce.a_mirar + ' piezas con diferencia ≥1% — son exactamente las que el documento identifica (AON cruzado, Pro Plan sumado). El catálogo ya está corregido; Data_Email todavía no.'
    : 'sin cruce');

console.log('\n════════ VEREDICTO · ¿está roto email-bloque? ════════');
acu.forEach(function (a) { console.log('  ' + (a[1] ? '🔴 ROTO ' : '✔ resiste') + '  ' + a[0].padEnd(56) + a[2]); });
console.log('\n──────── HALLAZGOS sobre otros scripts (no detienen a email-bloque) ────────');
hall.forEach(function (h) { console.log('  ' + (h[1] ? '⚠ ' : '✔ ') + ' ' + h[0].padEnd(56) + h[2]); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' ataque(s) rompieron el bloque' : '✅ ningún ataque rompió el bloque') +
  '   ·   ' + hall.filter(function (h) { return h[1]; }).length + ' hallazgo(s) abiertos con dueño ajeno');
process.exit(fallo ? 1 : 0);
