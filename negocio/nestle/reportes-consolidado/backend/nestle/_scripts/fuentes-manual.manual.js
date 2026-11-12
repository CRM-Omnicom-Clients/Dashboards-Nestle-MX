// manual-bloque · BLOQUE MANUAL — lo que el equipo declara a mano. NO escribe el Excel.
//
// Es el cuarto bloque, y el más raro de los cuatro: **hoy no tiene datos, y eso es lo normal**.
// Existe para que el día que haga falta —Liga MX es el caso a la vista— el dato entre por un
// camino con reglas, y no pegado a mano en la hoja.
//
// 🔴 LO QUE LO HACE DISTINTO: un dato manual es el único sin fuente verificable. Los demás se
//    vuelven a bajar y se comparan; éste no. Por eso aquí `quien` y `por_que` son obligatorios,
//    y un dato que la fuente automática ya trae **no se carga**: se declara redundante.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'manual';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var M = require(__dirname + '/lib-manual.js');
var G = require(__dirname + '/lib-manual-reglas.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = M.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

console.log('════════ manual-bloque · BLOQUE MANUAL ════════\n');

// ══ 1 · LEER LA CARPETA ═════════════════════════════════════════════════════════════
var DIR = PROY + '/_manual';
var R = M.leer(DIR);
console.log('  carpeta: _manual/');
if (!R.archivos.length) console.log('     (sin archivos .csv)');
R.archivos.forEach(function (a) {
  console.log('     ' + a.archivo.padEnd(34) + String(a.filas).padStart(3) + ' datos · ' +
    String(a.rechazadas || 0).padStart(2) + ' rechazadas' + (a.es_plantilla ? '   (plantilla)' : '') + (a.nota ? '   ' + a.nota : ''));
});
R.avisos.forEach(function (a) { console.log('     ⚠ ' + a); });

if (R.rechazados.length) {
  console.log('\n  ── rechazadas, con su motivo (nunca en silencio)');
  R.rechazados.slice(0, 8).forEach(function (r) {
    console.log('     ' + t(r.archivo).slice(0, 28).padEnd(29) + 'f' + String(r.fila).padStart(3) + '  ' + r.motivo);
  });
}

// ══ 2 · LAS DOS REGLAS QUE NECESITAN EL CATÁLOGO ════════════════════════════════════
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2d.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });
var cnPieza = {};
P.forEach(function (p) {
  [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean)
    .forEach(function (c) { cnPieza[c] = t(p['Pieza_ID']); });
});
function cargar(n) { try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); } catch (e) { return null; } }
var bloques = { email: cargar('email'), qcart: cargar('qcart'), whatsapp: cargar('whatsapp') };
console.log('\n  ── los otros bloques (para saber qué YA está cubierto)');
Object.keys(bloques).forEach(function (k) {
  var b = bloques[k];
  console.log('     ' + k.padEnd(10) + (b ? '✔ cargado' : '· no existe todavía'));
});

var res = G.aplicar(R.datos, P, bloques, cnPieza);
console.log('\n  ── el filtro');
console.log('     entran           : ' + res.dentro.length);
console.log('     fuera            : ' + res.fuera.length + (res.redundantes.length ? '   (' + res.redundantes.length + ' redundantes)' : ''));
console.log('     ' + (res.cuadra ? '✔ cuadra' : '🔴 NO cuadra') + ': ' + res.dentro.length + ' + ' + res.fuera.length + ' = ' + R.datos.length);
if (res.redundantes.length) {
  console.log('\n  ── 🔴 REDUNDANTES: la fuente automática ya los trae. Bórralos del CSV.');
  res.redundantes.forEach(function (r) {
    console.log('     ' + r.pieza_id + ' · ' + r.metrica + '  ya viene de ' + r.cubierto_por + '   [' + r.archivo + ' f' + r.fila + ']');
  });
}

// ══ 3 · EL APPEND ═══════════════════════════════════════════════════════════════════
var prev = { datos: [] };
try { prev = JSON.parse(fs.readFileSync(BACK + '/_fuentes/manual.json', 'utf8')); } catch (e) { }
prev.datos = prev.datos || [];
var idx = {}, nuevos = [], repetidos = 0;
prev.datos.forEach(function (d) { idx[M.llave(d)] = d; });
res.dentro.forEach(function (d) {
  var k = M.llave(d);
  if (idx[k]) {
    // 🔴 un dato manual SÍ se puede corregir: si el valor cambió, gana el nuevo y se guarda
    //    el anterior. No es como los logs de Qcart, donde el evento pasado no cambia: aquí
    //    la persona puede haberse equivocado y estar arreglándolo.
    if (idx[k].valor !== d.valor) {
      d.valor_anterior = idx[k].valor;
      d.corregido = true;
      idx[k] = d;
      nuevos.push(d);
    } else repetidos++;
    return;
  }
  idx[k] = d; nuevos.push(d);
});
var final = Object.keys(idx).map(function (k) { return idx[k]; });
console.log('\n  ── el append');
console.log('     ya estaban ' + String(prev.datos.length).padStart(3) + '   nuevos/corregidos ' + String(nuevos.length).padStart(3) +
  '   sin cambio ' + String(repetidos).padStart(3) + '   → ' + final.length);
var corregidos = final.filter(function (d) { return d.corregido; });
if (corregidos.length) {
  console.log('     ✎ corregidos (se conserva el valor anterior):');
  corregidos.forEach(function (d) { console.log('        ' + d.pieza_id + ' · ' + d.metrica + '  ' + d.valor_anterior + ' → ' + d.valor + '   por ' + d.quien); });
}

// ══ 4 · SALIDA ══════════════════════════════════════════════════════════════════════
var out = {
  paso: 'manual-bloque · bloque manual', generado_por: 'fuentes-manual.manual.js',
  que_es: 'lo que el equipo declara a mano porque ninguna descarga lo entrega',
  estado_normal: 'CERO datos. Que esté vacío no es un fallo: es lo esperado.',
  no_calcula: 'solo conteos. ctor, rates y porcentajes se rechazan: son de motor-calculo.',
  reglas: {
    procedencia: '`quien` y `por_que` son obligatorios — es el único dato sin fuente verificable',
    pieza: 'el pieza_id debe existir en Catalogo_Piezas',
    no_pisar: 'si una fuente automática ya trae esa métrica, el manual se declara redundante y NO se carga',
    correccion: 'un valor manual SÍ se puede corregir: gana el nuevo y se conserva el anterior'
  },
  carpeta: '_manual/',
  datos: final,
  rechazados_por_forma: R.rechazados,
  fuera_por_reglas: res.fuera,
  redundantes: res.redundantes,
  auditoria: {
    datos: final.length, nuevos: nuevos.length, ya_estaban: prev.datos.length, sin_cambio: repetidos,
    corregidos: corregidos.length,
    rechazados_por_forma: R.rechazados.length,
    fuera_por_reglas: res.fuera.length,
    redundantes: res.redundantes.length,
    cuadre: res.cuadra && (prev.datos.length + nuevos.length >= final.length),
    por_metrica: final.reduce(function (a, d) { a[d.metrica] = (a[d.metrica] || 0) + 1; return a; }, {}),
    piezas: Object.keys(final.reduce(function (a, d) { a[d.pieza_id] = 1; return a; }, {})).length
  },
  para_el_siguiente: {
    que_es: 'datos declarados a mano, ya anclados a su pieza y con su procedencia',
    ojo: 'cada dato trae quien y por_que: si un número del reporte no cuadra, ahí está su autor',
    ojo_puerta: 'N3 los escribe como cualquier otro bloque, pero marcando Fuente_Dato = manual'
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
fs.writeFileSync(BACK + '/_fuentes/manual.json', JSON.stringify(out, null, 1));

console.log('\n  ── el bloque');
console.log('     datos manuales: ' + final.length + (final.length ? '   piezas: ' + out.auditoria.piezas : '   ← vacío, que es el estado normal'));
if (final.length) Object.keys(out.auditoria.por_metrica).forEach(function (m) { console.log('        ' + m.padEnd(12) + out.auditoria.por_metrica[m]); });
console.log('\n  → ' + BACK + '/_fuentes/manual.json');
console.log('  ⚠ el Excel NO se tocó.');
