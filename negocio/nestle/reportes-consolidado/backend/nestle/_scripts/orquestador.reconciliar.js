// L3 · RECONCILIAR EL REGISTRO CONTRA EL ARCHIVO — «actualizarlo cuando revisa el archivo que va
//      a tocar», que es como lo pidió Rick.
//
// 🔴 UN RENOMBRE ES UN HECHO QUE SE REGISTRA, NO UNA DUDA QUE SE RESUELVE. Este paso NO adivina
//    para que la corrida siga: propone un emparejamiento solo con **evidencia múltiple**, lo
//    escribe con fecha y con el porqué, y si la evidencia no alcanza **para y pregunta**.
//
// 🔴 LAS CUATRO EVIDENCIAS, Y HACEN FALTA AL MENOS DOS:
//      1 · POSICIÓN   la columna sigue en el mismo lugar
//      2 · VECINOS    sus columnas de al lado son las mismas
//      3 · FORMA      el tipo de dato y qué tan llena está coinciden
//      4 · PARECIDO   el nombre nuevo se parece al viejo (subcadena o distancia corta)
//    Con UNA sola evidencia no se propone nada: una columna nueva insertada en la misma posición
//    que otra que se borró tiene la evidencia 1 y no es un renombre — es otra columna.
//
// 🔴 Y LO QUE NUNCA HACE: renombrar el ID. El id se acuña una vez y no cambia jamás; lo que se
//    actualiza es su NOMBRE FÍSICO, y el nombre viejo pasa a `alias_historicos` para que el
//    archivo de la semana pasada siga resolviendo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var R = require(__dirname + '/lib-registro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };

var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var ARCHIVO = null;
process.argv.forEach(function (a, i) { if (a === '--archivo') ARCHIVO = process.argv[i + 1]; });
var HOY = '2026-08-20';
process.argv.forEach(function (a, i) { if (a === '--fecha') HOY = process.argv[i + 1]; });

function tipoDe(valores) {
  var v = valores.filter(function (x) { return t(x) !== ''; });
  if (!v.length) return 'sin datos';
  var num = v.filter(function (x) { return typeof x === 'number' || /^-?[\d,]+(\.\d+)?$/.test(t(x)); }).length;
  if (num / v.length < 0.9) return 'texto';
  var dec = v.filter(function (x) { return typeof x === 'number' && x % 1 !== 0; }).length;
  return dec / v.length > 0.5 ? 'decimal' : 'entero';
}
// distancia de edición, acotada — para «se parece» sin traer una librería
function dist(a, b) {
  a = R.nmz(a); b = R.nmz(b);
  if (a === b) return 0;
  var m = [], i, j;
  for (i = 0; i <= a.length; i++) m[i] = [i];
  for (j = 0; j <= b.length; j++) m[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

console.log('════════ L3 · RECONCILIAR ' + (ESCRIBIR ? '🔴 ESCRIBE EL REGISTRO' : '(seco)') + ' ════════\n');
var reg = R.cargar();
var ruta = ARCHIVO || L.archivoVivo({ dir: PROY }).ruta;
var C = require('path').resolve(__dirname, '..') + '/_tmp/_l3.xlsx';
fs.copyFileSync(ruta, C);
var wb = XLSX.readFile(C);
console.log('  archivo: ' + require('path').basename(ruta) + '\n');

var propuestas = [], sinEvidencia = [], nuevas = [], desaparecidas = [];

Object.keys(reg.ambitos).forEach(function (am) {
  var a = reg.ambitos[am];
  if (a.tipo !== 'hoja' || !wb.Sheets[a.nombre_fisico]) return;
  var enc = XLSX.utils.sheet_to_json(wb.Sheets[a.nombre_fisico], { header: 1 })[0] || [];
  var F = XLSX.utils.sheet_to_json(wb.Sheets[a.nombre_fisico], { defval: '', blankrows: false });
  var h = R.abrir(am, enc, { silencioso: true });
  if (!h.sin_resolver.length && !h.sin_id.length) return;

  console.log('── ' + a.nombre_fisico + ':  ' + h.sin_resolver.length + ' id(s) sin columna · ' + h.sin_id.length + ' columna(s) sin id');

  h.sin_resolver.forEach(function (c) {
    // candidatos: las columnas huérfanas de esta hoja
    var cands = h.sin_id.map(function (o) {
      var vals = F.slice(0, 60).map(function (x) { return x[o.nombre]; });
      var ev = [];
      if (o.i === c.posicion) ev.push('posición ' + R.letra(o.i));
      var vec = [t(enc[o.i - 1] || ''), t(enc[o.i + 1] || '')].filter(Boolean);
      var comunes = (c.vecinos || []).filter(function (v) { return vec.indexOf(v) >= 0; });
      if (comunes.length) ev.push('vecino' + (comunes.length > 1 ? 's' : '') + ' ' + comunes.join(' y '));
      var tp = tipoDe(vals), llenas = F.filter(function (x) { return t(x[o.nombre]) !== ''; }).length;
      if (tp === c.tipo_dato && tp !== 'sin datos') {
        var dLl = c.llenas ? Math.abs(llenas - c.llenas) / Math.max(c.llenas, 1) : 1;
        if (dLl < 0.1) ev.push('forma: ' + tp + ' y ' + llenas + ' llenas (antes ' + c.llenas + ')');
      }
      var d = dist(o.nombre, c.nombres[0]);
      var largo = Math.max(R.nmz(o.nombre).length, R.nmz(c.nombres[0]).length);
      if (d <= Math.max(2, Math.floor(largo * 0.34))) ev.push('parecido al nombre viejo (distancia ' + d + ')');
      return { nombre: o.nombre, i: o.i, ev: ev };
    }).filter(function (x) { return x.ev.length; });

    var fuertes = cands.filter(function (x) { return x.ev.length >= 2; });
    if (fuertes.length === 1) {
      propuestas.push({ ambito: am, hoja: a.nombre_fisico, id: c.id, de: c.nombres[0], a: fuertes[0].nombre, evidencia: fuertes[0].ev });
      console.log('   ✔ ' + c.id.padEnd(34) + '«' + c.nombres[0] + '» → «' + fuertes[0].nombre + '»');
      console.log('        evidencia: ' + fuertes[0].ev.join(' · '));
    } else if (fuertes.length > 1) {
      sinEvidencia.push({ id: c.id, por: 'más de un candidato con evidencia suficiente', cands: fuertes.map(function (x) { return x.nombre; }) });
      console.log('   🔴 ' + c.id.padEnd(34) + 'AMBIGUO: ' + fuertes.map(function (x) { return '«' + x.nombre + '»'; }).join(' o '));
    } else {
      sinEvidencia.push({ id: c.id, por: 'ningún candidato con 2 evidencias', cands: cands.map(function (x) { return x.nombre + ' [' + x.ev.join(', ') + ']'; }) });
      console.log('   🔴 ' + c.id.padEnd(34) + 'SIN EVIDENCIA SUFICIENTE' +
        (cands.length ? ' — el mejor: «' + cands[0].nombre + '» con solo ' + cands[0].ev.length + ' (' + cands[0].ev.join(', ') + ')' : ' — no hay huérfanas'));
      desaparecidas.push({ ambito: am, id: c.id, nombre: c.nombres[0] });
    }
  });

  // columnas huérfanas que ninguna propuesta reclama = columnas NUEVAS
  var reclamadas = {};
  propuestas.forEach(function (p) { if (p.ambito === am) reclamadas[p.a] = 1; });
  h.sin_id.forEach(function (o) {
    if (reclamadas[o.nombre]) return;
    nuevas.push({ ambito: am, hoja: a.nombre_fisico, nombre: o.nombre, i: o.i, id_que_tendria: R.idDe(am, o.nombre) });
    console.log('   🆕 columna nueva: «' + o.nombre + '» (col ' + R.letra(o.i) + ') → id `' + R.idDe(am, o.nombre) + '`');
  });
});

console.log('\n══ resumen ══');
console.log('   renombres con evidencia : ' + propuestas.length);
console.log('   columnas nuevas         : ' + nuevas.length);
console.log('   ids que ya no aparecen  : ' + desaparecidas.length);
console.log('   sin evidencia suficiente: ' + sinEvidencia.length);

if (!propuestas.length && !nuevas.length) {
  console.log('\n  ✅ el registro y el archivo dicen lo mismo. Nada que reconciliar.');
  process.exit(0);
}
if (!ESCRIBIR) {
  console.log('\n  (seco. Para aplicar: node orquestador.reconciliar.js --escribir)');
  if (sinEvidencia.length) {
    console.log('\n  🔴 ESTO NO SE RESUELVE SOLO — hace falta que un humano diga qué es qué:');
    sinEvidencia.forEach(function (s) { console.log('     · ' + s.id + ' — ' + s.por + (s.cands.length ? '\n       candidatos: ' + s.cands.join(' · ') : '')); });
  }
  process.exit(0);
}

// ── APLICAR: el id no se toca; el nombre viejo pasa a alias y entra el nuevo
reg.renombres = reg.renombres || [];
propuestas.forEach(function (p) {
  var c = reg.columnas[p.id];
  c.alias_historicos = (c.alias_historicos || []).concat(c.nombres.filter(function (n) { return n !== p.a; }));
  c.nombres = [p.a];
  c.visto = HOY;
  reg.renombres.push({ id: p.id, de: p.de, a: p.a, fecha: HOY, evidencia: p.evidencia, detectado_por: 'L3-reconciliar' });
});
nuevas.forEach(function (nv) {
  if (reg.columnas[nv.id_que_tendria]) return;
  reg.columnas[nv.id_que_tendria] = {
    id: nv.id_que_tendria, ambito: nv.ambito, nombres: [nv.nombre], alias_historicos: [],
    posicion: nv.i, letra: R.letra(nv.i), tipo_dato: 'por medir', llenas: null,
    visto: HOY, acunada_por: 'L3-reconciliar'
  };
  reg.ambitos[nv.ambito].n_columnas = (reg.ambitos[nv.ambito].n_columnas || 0) + 1;
});
fs.writeFileSync(BACK + '/_contratos/registro.json', JSON.stringify(reg, null, 1));
console.log('\n  ✔ registro actualizado: ' + propuestas.length + ' renombre(s) y ' + nuevas.length + ' alta(s), con su evidencia y su fecha.');
console.log('  → _contratos/registro.json');
