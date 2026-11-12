// L4 · EL MANIFIESTO DE CADA SCRIPT — qué ids necesita, y verificarlos ANTES de tocar el archivo.
//
// 🔴 EL MANIFIESTO NO SE ESCRIBE A MANO: SE MIDE. Se lee el código de cada script y se busca qué
//    NOMBRES FÍSICOS de columna tiene escritos dentro. Eso da dos cosas de una vez:
//      · su manifiesto real (los ids que de verdad usa), y
//      · su DEUDA DE MIGRACIÓN: cada nombre físico dentro del código es un `Content_ID` esperando
//        a que alguien renombre la columna.
//    Un manifiesto escrito a mano se desactualiza en cuanto alguien toca el script; este se
//    regenera y siempre dice la verdad de hoy.
//
// 🔴 PARA QUÉ SIRVE: `R.exigir(manifiesto)` al arrancar un script falla **antes** de abrir el
//    archivo. Sin eso, un nombre cambiado se descubre a media escritura, con el libro ya abierto
//    y medio escrito — que es exactamente cómo se rompió la fila de abril.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var R = require(__dirname + '/lib-registro.js');
var BACK = require('path').resolve(__dirname, '..');
var DIR = BACK + '/_scripts';

// los scripts que producen el reporte. No se escanea todo: lo que no corre en un corte no es deuda.
var SCRIPTS = {
  'N5-motor': { archivo: 'motor.motor.js', que: 'convierte los bloques en la rejilla' },
  'N6-resumen': { archivo: 'orquestador.resumen.js', que: 'escribe Report_Resumen' },
  'N7-puerta2': { archivo: 'fuentes-cuadre.puerta2.js', que: 'la puerta del reporte' },
  'NB-email-sfmc': { archivo: 'orquestador.nb-email-sfmc.js', que: 'arma el bloque de email desde la DE' },
  'FI-normalizador': { archivo: 'fuentes-cuadre.normalizador.js', que: 'coherencia cruzando hojas' },
  'FG-diff': { archivo: 'orquestador.diff-explicado.js', que: 'el diff explicado' }
};

var reg = R.cargar();
// índice nombre físico → ids que lo llevan (un mismo nombre puede existir en varias hojas)
var porNombre = {};
Object.keys(reg.columnas).forEach(function (id) {
  reg.columnas[id].nombres.concat(reg.columnas[id].alias_historicos || []).forEach(function (n) {
    (porNombre[n] = porNombre[n] || []).push(id);
  });
});
// 🔴 los nombres muy cortos o genéricos producen ruido: `Mes`, `BU`, `Canal` aparecen en cadenas
//    que no son referencias a columnas. Se piden al menos 4 caracteres y que la cadena esté
//    entrecomillada como literal — no se adivina desde una palabra suelta en un comentario.
var CORTOS = /^.{1,3}$/;

console.log('════════ L4 · MANIFIESTOS ════════\n');
var manifiestos = { paso: 'L4', derivado_de: 'los literales de cada script', scripts: {} };
var deudaTotal = 0;

Object.keys(SCRIPTS).forEach(function (n) {
  var p = path.join(DIR, SCRIPTS[n].archivo);
  if (!fs.existsSync(p)) { console.log('  ⊘ ' + n.padEnd(18) + 'no existe ' + SCRIPTS[n].archivo); return; }
  var src = fs.readFileSync(p, 'utf8');
  // literales entre comillas simples o dobles
  var lits = {};
  src.replace(/'([^'\n]{4,60})'|"([^"\n]{4,60})"/g, function (_, a, b) { lits[a || b] = 1; return _; });
  var ids = {}, ambiguos = [];
  Object.keys(lits).forEach(function (s) {
    if (CORTOS.test(s) || !porNombre[s]) return;
    var cands = porNombre[s];
    if (cands.length === 1) { ids[cands[0]] = s; return; }
    // el mismo nombre en varias hojas: se registra el hecho, no se elige
    ambiguos.push({ nombre: s, ids: cands });
  });
  var lista = Object.keys(ids).sort();
  deudaTotal += lista.length + ambiguos.length;
  manifiestos.scripts[n] = {
    archivo: SCRIPTS[n].archivo, que: SCRIPTS[n].que,
    ids: lista,
    nombres_en_el_codigo: lista.map(function (id) { return ids[id]; }),
    ambiguos: ambiguos,
    deuda: lista.length + ambiguos.length
  };
  var porAmbito = {};
  lista.forEach(function (id) { var a = reg.columnas[id].ambito; porAmbito[a] = (porAmbito[a] || 0) + 1; });
  console.log('  ' + n.padEnd(18) + String(lista.length + ambiguos.length).padStart(3) + ' nombre(s) físico(s) en el código' +
    (Object.keys(porAmbito).length ? '   ·  ' + Object.keys(porAmbito).map(function (a) { return a + ':' + porAmbito[a]; }).join(' ') : '') +
    (ambiguos.length ? '   ⚠ ' + ambiguos.length + ' en más de una hoja' : ''));
});

console.log('\n══ la deuda de migración (L5), medida ══');
console.log('   ' + deudaTotal + ' referencias a nombres físicos dentro del código de ' + Object.keys(manifiestos.scripts).length + ' scripts.');
console.log('   Cada una es un «Content_ID» esperando a que alguien renombre la columna.');

// ── la prueba de L4: quitar un id y comprobar que el script SE NIEGA a correr
console.log('\n══ prueba: ¿de verdad se niega a correr si falta un id? ══');
var XLSX = require('xlsx');
var L = require(DIR + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var C = require('path').resolve(__dirname, '..') + '/_tmp/_l4.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, C);
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(C).Sheets['Report_Resumen'], { header: 1 })[0];
var h = R.abrir('resumen', enc, { silencioso: true });
var man = (manifiestos.scripts['N6-resumen'] || { ids: [] }).ids.filter(function (id) { return reg.columnas[id].ambito === 'resumen'; });
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(50) + e); c ? ok++ : mal++; }
var paso = false;
try { h.exigir(man, 'N6-resumen'); paso = true; } catch (e) { console.log('     ' + e.message.split('\n').slice(0, 3).join('\n     ')); }
chk('el manifiesto real de resumen-regenerar resuelve entero', paso, man.length + ' ids de la hoja Report_Resumen');
var conFalso = man.concat(['resumen.columna_que_alguien_borro']);
var negado = false;
try { h.exigir(conFalso, 'N6-resumen'); } catch (e) { negado = /no resuelven/.test(e.message) && /columna_que_alguien_borro/.test(e.message); }
chk('con un id de menos, SE NIEGA y dice cuál', negado, negado ? 'cita el id que falta y no toca el archivo' : '🔴 dejó pasar');

fs.writeFileSync(BACK + '/_contratos/manifiestos.json', JSON.stringify(manifiestos, null, 1));
console.log('\n  → _contratos/manifiestos.json');
console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ L4 EN PIE') + ' — ' + ok + ' checks ════════');
process.exit(mal ? 1 : 0);
