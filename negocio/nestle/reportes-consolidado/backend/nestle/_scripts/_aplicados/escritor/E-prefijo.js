// E-prefijo · EL PREFIJO DIMENSIONAL EN UNA HOJA. Se invoca UNA VEZ POR SKILL.
//
//   node E-prefijo.js Data_Email          (seco)
//   node E-prefijo.js Data_Email --escribir
//
// 🔴 QUÉ RESUELVE, medido en la Etapa 0: `Campaña` y `Segmento` **no existen** en `Data_Email` ni
//    en las hojas de Qcart, y `Pieza_ID` vive en la columna E, AR, AF, A y A según la hoja. Por eso
//    leer una fila obligaba a cruzar mentalmente dos hojas, y por eso la atribución dependía de que
//    alguien encontrara el dato.
//
// 🔴 RENOMBRAR ANTES QUE AGREGAR. `Data_Email` ya tiene `Campana_Canonica` y `Segmento_Canonico`:
//    son EL MISMO HECHO que `Campaña` y `Segmento`. Agregar una columna nueva al lado dejaría el
//    mismo dato en dos sitios — que es exactamente el defecto que encontramos con `Content_Name` vs
//    `EmailName` y que costó 16 discrepancias. Se renombra el encabezado; **el contenido no se
//    toca**, y con él las 277 celdas que Rick escribió a mano.
//
// 🔴 LO QUE SE AGREGA SE DERIVA DEL CATÁLOGO por `Pieza_ID`, nunca del naming.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var E = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var PRE = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-preescritura.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var HOJA = process.argv[2];
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
if (!HOJA) { console.log('uso: node E-prefijo.js <Hoja> [--escribir]'); process.exit(1); }

var PASO = 'PRE-' + HOJA;
console.log('════════ PREFIJO DIMENSIONAL · ' + HOJA + ' ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo(PASO);

// sinónimos conocidos: el mismo hecho con otro nombre → se RENOMBRA, no se duplica
var SINONIMO = {
  'Campaña': ['Campana_Canonica', 'Campana', 'Campaign'],
  'Segmento': ['Segmento_Canonico', 'Segment'],
  'BU': ['BU_Canonico'],
  'Canal': ['Medio'],
  'TouchPoint': ['Touchpoint'],
  'Quincena': ['Quincena_Lanzamiento', 'Send_Quincena'],
  'Marca': ['Marca_Canonica'],
  'Pieza_ID': ['pieza_id'],
  'Email_Name': ['Email_Content_Name', 'Content_Name']
};

var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
if (!wb.Sheets[HOJA]) { console.log('🔴 no existe la hoja «' + HOJA + '»'); process.exit(1); }
var enc = (XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1 })[0] || []).map(t);
var F = CB.vistaFutura(HOJA, XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { defval: '', blankrows: false }));

// el catálogo, indexado por Pieza_ID — la fuente de toda dimensión
var CP = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var cat = {};
CP.forEach(function (p) { cat[t(p['Pieza_ID'])] = p; });

// ¿dónde está el Pieza_ID de esta hoja?
var colPieza = enc.filter(function (c) { return E.nmz(c) === 'pieza_id'; })[0];
if (!colPieza) { console.log('🔴 «' + HOJA + '» no tiene Pieza_ID: sin él no se puede derivar ninguna dimensión.'); process.exit(1); }

var quiere = E.nombresPrefijo();
var renombres = [], nuevas = [], yaEstan = [];
quiere.forEach(function (nom) {
  // 🔴 «MISMO NOMBRE» ES CARÁCTER POR CARÁCTER, no normalizado. La hoja dice `Touchpoint` y
  //    `pieza_id`; el prefijo pide `TouchPoint` y `Pieza_ID`. Normalizando parecen iguales —y para
  //    el registro lo son— pero el punto del prefijo es que **se vean iguales al abrir el archivo**.
  //    Si se dejan distintos, el problema que esto resuelve sigue ahí a simple vista.
  var exacto = enc.indexOf(nom) >= 0;
  if (exacto) { yaEstan.push(nom); return; }
  var casi = enc.filter(function (c) { return E.nmz(c) === E.nmz(nom); })[0];
  if (casi) { renombres.push({ de: casi, a: nom, motivo: 'mismo nombre con otra capitalización' }); return; }
  var sin = (SINONIMO[nom] || []).filter(function (s) { return enc.filter(function (c) { return E.nmz(c) === E.nmz(s); }).length; })[0];
  if (sin) renombres.push({ de: enc.filter(function (c) { return E.nmz(c) === E.nmz(sin); })[0], a: nom, motivo: 'el mismo hecho con otro nombre' });
  else nuevas.push(nom);
});

console.log('  ya están (' + yaEstan.length + '): ' + (yaEstan.join(' · ') || '—'));
console.log('\n  ── SE RENOMBRAN (mismo hecho, otro nombre — el contenido NO se toca):');
if (!renombres.length) console.log('     —');
renombres.forEach(function (r) { console.log('     «' + r.de + '» → «' + r.a + '»   (' + r.motivo + ')'); });
console.log('\n  ── SE AGREGAN (derivadas del catálogo por Pieza_ID):');
if (!nuevas.length) console.log('     —');
nuevas.forEach(function (n) { console.log('     ' + n); });

// ── derivar los valores de las columnas nuevas
function valorDe(p, nom) {
  if (!p) return 'N/A';
  switch (nom) {
    case 'Campaña': return t(p['Campaña']);
    case 'Canal': return t(p['Canal']);
    case 'Objetivo': return t(p['Objetivo']);
    case 'TouchPoint': return t(p['Touchpoint']);
    case 'Segmento': return t(p['Segmento']);
    case 'Marca': return t(p['Marca']);
    case 'BU': return t(p['BU']);
    case 'Email_Name': return t(p['Email_Name']);
    case 'Quincena': return t(p['Quincena_Lanzamiento']);
    case 'Mes': { var m = Q.mesDe(p['Quincena_Lanzamiento']); return m ? m.nombre : 'N/A'; }
    case 'Mes (#)': { var m2 = Q.mesDe(p['Quincena_Lanzamiento']); return m2 ? m2.num : 'N/A'; }
    default: return '';
  }
}

var apuntes = [], sinPieza = 0, porCol = {};
F.forEach(function (f, i) {
  var fila = i + 2, pid = t(f[colPieza]);
  var p = cat[pid];
  if (!p && E.esDato(pid)) sinPieza++;
  nuevas.forEach(function (nom) {
    var v = valorDe(p, nom);
    if (v === '' || v === undefined) v = 'PENDIENTE';
    apuntes.push({ hoja: HOJA, fila: fila, columna: nom, valor: v,
      porque: PASO + ' · dimensión del prefijo, derivada del catálogo por Pieza_ID ' + (pid || '(sin id)') + '. Nunca del naming.' });
    porCol[nom] = (porCol[nom] || 0) + (E.esDato(v) ? 1 : 0);
  });
});
console.log('\n  filas: ' + F.length + (sinPieza ? '   🔴 ' + sinPieza + ' con Pieza_ID que el catálogo no conoce' : '   ✔ todas cruzan con el catálogo'));
if (nuevas.length) {
  console.log('  cobertura de las nuevas:');
  nuevas.forEach(function (n) { console.log('     ' + n.padEnd(14) + porCol[n] + ' de ' + F.length + ' con dato real'); });
}

// ── la PRE-ESCRITURA: la tabla previa, con la forma de la hoja destino
var colsDestino = enc.slice();
renombres.forEach(function (r) { colsDestino[colsDestino.indexOf(r.de)] = r.a; });
nuevas.forEach(function (n) { colsDestino.push(n); });
var filasPrev = F.map(function (f, i) {
  var o = {}; var pid = t(f[colPieza]); var p = cat[pid];
  quiere.forEach(function (nom) {
    var actual = colsDestino.indexOf(nom) >= 0 && enc.indexOf(nom) >= 0 ? t(f[nom]) : null;
    var ren = renombres.filter(function (r) { return r.a === nom; })[0];
    o[nom] = ren ? t(f[ren.de]) : (actual !== null ? actual : valorDe(p, nom));
  });
  return o;
});
var T = PRE.preparar({
  skill: PASO, hoja: HOJA, columnas: colsDestino, filas: filasPrev,
  llave: 'Pieza_ID', grano: E.entidadDe(HOJA).grano,
  no_toca: ['el contenido de las columnas renombradas: solo cambia su encabezado']
});
PRE.guardar(PASO, [T], 'El prefijo dimensional de `' + HOJA + '`, derivado del catálogo por Pieza_ID.');
console.log('\n  → _preescritura/' + PASO + '.md');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
renombres.forEach(function (r) {
  CB.apuntar(PASO, HOJA, 1, r.de, r.a,
    PASO + ' · «' + r.de + '» y «' + r.a + '» son el MISMO hecho. Se renombra en vez de agregar una columna nueva: ' +
    'dejar el mismo dato en dos sitios es el defecto que costo 16 discrepancias entre Content_Name y EmailName. ' +
    'El contenido no se toca.');
});
nuevas.forEach(function (n) {
  CB.apuntarColumna(PASO, HOJA, n, PASO + ' · columna del prefijo dimensional: las mismas dimensiones, en el mismo orden, en todas las hojas.');
});
if (apuntes.length) CB.apuntarLote(PASO, apuntes);
var res = CB.resumen();
console.log('\n  ── apuntados ' + (renombres.length + apuntes.length) + ' (+' + nuevas.length + ' columnas). Acumulado: ' + res.total.toLocaleString('es-MX') + '   ·   choques: ' + res.choques);
