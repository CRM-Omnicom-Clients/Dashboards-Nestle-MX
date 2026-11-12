// orquestador.publicar.js — llevar el interno ya validado a los destinos del cliente.
//
// 🔴 ESTE SCRIPT NO PUBLICA SOLO. Publicar necesita el OK explícito de Rick DESPUÉS de que él haya
//    validado en Excel — Node no recalcula fórmulas ni ve el render, así que ningún check de aquí
//    sustituye ese OK. Sin `--ok-de-rick` el script corre en seco: mide, diffea, y reporta qué
//    pasaría. Es lo único que puede hacer honestamente por su cuenta.
//
// 🔴 Y publicar NO es copiar el archivo encima. El interno y producción **ya no tienen la misma
//    forma**: si el destino tiene hojas que el origen no tiene, son trabajo del equipo del cliente
//    y se CONSERVAN. Borrar por omisión es la falla que este paso existe para impedir.
//
// USO:
//   node orquestador.publicar.js                 → seco: resuelve destinos, diffea, dice qué pasaría
//   node orquestador.publicar.js --ok-de-rick    → publica (y aun así se niega si el diff no es seguro)
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = process.argv.filter(function (a) { return !a.startsWith('--'); })[2] ||
  ENT.PROYECTO;
var OK = process.argv.indexOf('--ok-de-rick') > -1;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

console.log('════════ N8 · PUBLICAR ════════');
console.log(OK ? '  🔴 CON OK DE RICK — puede escribir' : '  modo seco: NADIE toca el destino\n');

// ── 1 · el origen: el interno ya validado ──────────────────────────────────────────────────
var vivo = L.archivoVivo({ dir: PROY });
console.log('  origen: ' + vivo.archivo + '   ' + Math.round(fs.statSync(vivo.ruta).size / 1024) + ' KB   ' +
  fs.statSync(vivo.ruta).mtime.toISOString().slice(0, 16).replace('T', ' '));

// ── 2 · los destinos SE BUSCAN, no se leen de un documento ─────────────────────────────────
// La ruta escrita en `publicacion-reportes.md` es una pista: al equipo del cliente le da por
// reagrupar carpetas sin avisar, y ya paso (16-jul-2026, de `Reportes/Total Proyecto` a
// `Marcas/CRM General`). Una ruta escrita puede estar muerta; la busqueda no.
function buscar(raiz, patron, prof) {
  var out = [];
  (function rec(d, n) {
    if (n > (prof || 6)) return;
    var e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch (x) { return; }
    e.forEach(function (x) {
      var p = d + '/' + x.name;
      if (x.isDirectory()) { if (!/^[~.]|_backups|node_modules/.test(x.name)) rec(p, n + 1); }
      else if (patron.test(x.name) && !/^~\$/.test(x.name)) out.push(p);
    });
  })(raiz, 0);
  return out;
}
// 🔴 la raíz de la nube se PIDE: su nombre lleva el de la organización (fue `OneDrive - Interpublic`
//    hasta la migración a Omnicom) y escrito a mano el barrido no encontraría nada — diría
//    «no hay destinos» sin fallar.
var HOME = ENT.NUBE;
var DESTINOS = [{
  n: 1, nombre: 'Consolidado productivo del cliente',
  patron: /^Reporte-CRM-Consolidado-Nestle-2026\.xlsx$/i
}];
// El destino 2 (Seguimiento) NO se busca: `publicacion-reportes.md` lo deja PENDIENTE DE RICK,
// sin ruta confirmada. Un destino sin ruta confirmada no se adivina.
console.log('  ⬜ destino 2 (Seguimiento del cliente): sin ruta confirmada por Rick — no se publica.\n');

var hallazgos = [], bloqueos = [];

DESTINOS.forEach(function (D) {
  console.log('  ── destino ' + D.n + ' · ' + D.nombre);
  var c = buscar(HOME, D.patron, 7);
  if (!c.length) {
    bloqueos.push('destino ' + D.n + ': no se encontro ningun archivo que case con ' + D.patron);
    console.log('     🔴 NO ENCONTRADO por busqueda. No se publica a una ruta que no se pudo verificar.\n');
    return;
  }
  // que lo encontrado no sea un respaldo ni un borrador
  var reales = c.filter(function (p) { return !/_backups|backup|respaldo|borrador|copia|old|viejo/i.test(p); });
  console.log('     encontrados: ' + c.length + (c.length !== reales.length ? '  (' + (c.length - reales.length) + ' descartados por parecer respaldo)' : ''));
  if (reales.length !== 1) {
    bloqueos.push('destino ' + D.n + ': la busqueda deja ' + reales.length + ' candidatos y ninguna variable mas los separa');
    reales.forEach(function (p) { console.log('        · ' + p.replace(HOME, '…')); });
    console.log('     🔴 AMBIGUO: ' + reales.length + ' candidatos. No se elige uno por corazonada.\n');
    return;
  }
  var dest = reales[0];
  var st = fs.statSync(dest);
  console.log('     ruta  : ' + dest.replace(HOME, '…'));
  console.log('     tamano: ' + Math.round(st.size / 1024) + ' KB   ' + st.mtime.toISOString().slice(0, 16).replace('T', ' '));

  // ── 3 · ¿esta libre? ─────────────────────────────────────────────────────────────────────
  // ⚠ que no de EBUSY NO prueba que nadie lo tenga abierto: en SharePoint se coedita sin dejar
  //   rastro local. Es una condicion necesaria, no suficiente — por eso se reporta asi.
  var libre = true;
  try { var fd = fs.openSync(dest, 'r+'); fs.closeSync(fd); } catch (e) { libre = false; }
  console.log('     libre : ' + (libre ? 'sin bloqueo local  ⚠ no prueba que nadie lo coedite en SharePoint' : '🔴 OCUPADO — no se publica'));
  if (!libre) { bloqueos.push('destino ' + D.n + ': el archivo esta ocupado'); console.log(''); return; }

  // ── 4 · EL DIFF, ANTES DE ESCRIBIR ───────────────────────────────────────────────────────
  var A = require('path').resolve(__dirname, '..') + '/_tmp/_pub_org.xlsx', B = require('path').resolve(__dirname, '..') + '/_tmp/_pub_dst.xlsx';
  fs.copyFileSync(vivo.ruta, A); fs.copyFileSync(dest, B);
  var wo, wd;
  try { wo = XLSX.readFile(A); wd = XLSX.readFile(B); }
  catch (e) {
    bloqueos.push('destino ' + D.n + ': no se pudo abrir uno de los dos libros: ' + e.message);
    console.log('     🔴 no se pudo abrir: ' + e.message + '\n'); return;
  }
  var ho = wo.SheetNames, hd = wd.SheetNames;
  var soloDestino = hd.filter(function (h) { return ho.indexOf(h) < 0; });
  var soloOrigen = ho.filter(function (h) { return hd.indexOf(h) < 0; });
  var comunes = ho.filter(function (h) { return hd.indexOf(h) > -1; });

  console.log('     hojas : origen ' + ho.length + '  ·  destino ' + hd.length + '  ·  en comun ' + comunes.length);
  if (soloOrigen.length) console.log('        + solo en el ORIGEN  (' + soloOrigen.length + '): ' + soloOrigen.join(' · '));
  if (soloDestino.length) {
    console.log('        🔴 solo en el DESTINO (' + soloDestino.length + '): ' + soloDestino.join(' · '));
    console.log('           ↑ son trabajo del equipo del cliente. Copiar el archivo encima las BORRA.');
  }
  var filas = comunes.map(function (h) {
    var fo = XLSX.utils.sheet_to_json(wo.Sheets[h], { defval: '', blankrows: false }).length;
    var fd2 = XLSX.utils.sheet_to_json(wd.Sheets[h], { defval: '', blankrows: false }).length;
    return { hoja: h, origen: fo, destino: fd2, delta: fo - fd2 };
  });
  filas.filter(function (f) { return f.delta !== 0; }).forEach(function (f) {
    console.log('        ~ ' + f.hoja.padEnd(26) + ' origen ' + String(f.origen).padStart(5) + '  destino ' + String(f.destino).padStart(5) +
      '   ' + (f.delta > 0 ? '+' + f.delta + ' filas nuevas' : f.delta + ' filas que el destino TIENE y el origen NO'));
  });

  hallazgos.push({ destino: D.n, ruta: dest, soloDestino: soloDestino, soloOrigen: soloOrigen, filas: filas });

  // ── 5 · el veredicto ─────────────────────────────────────────────────────────────────────
  var seguro = soloDestino.length === 0 && !filas.some(function (f) { return f.delta < 0; });
  if (!seguro) {
    console.log('\n     🔴 UNA COPIA ENCIMA PERDERIA TRABAJO DEL CLIENTE.');
    console.log('        Publicar aqui exige copiar HOJA POR HOJA, conservando lo que el destino ya tiene.');
    console.log('        Copiar una hoja entre libros distintos no es copiar su XML: hay que traducir');
    console.log('        estilos y textos compartidos. Eso — `copiarHoja()` — NO esta construido:');
    console.log('        ver ' + require(__dirname + '/lib-entorno.js').TOOLS + '/reportes/PENDIENTE.md');
    console.log('        👉 DECISION DE RICK, no del paso. Se detiene aqui.');
    bloqueos.push('destino ' + D.n + ': la copia perderia ' + soloDestino.length + ' hoja(s) del destino — hace falta copia hoja por hoja');
    console.log('');
    return;
  }
  console.log('\n     ✔ el destino no tiene nada que el origen no traiga: una copia completa no pierde nada.');
  if (!OK) { console.log('     ⏸ falta el OK de Rick. Con el: node orquestador.publicar.js --ok-de-rick\n'); return; }

  // ── 6 · publicar de verdad ───────────────────────────────────────────────────────────────
  var stamp = new Date(fs.statSync(dest).mtimeMs).toISOString().slice(0, 10);
  var bk = path.dirname(dest) + '/_backups';
  if (!fs.existsSync(bk)) fs.mkdirSync(bk, { recursive: true });
  var destino_bk = bk + '/' + path.basename(dest, '.xlsx') + '__' + stamp + '_antes-de-publicar.xlsx';
  fs.copyFileSync(dest, destino_bk);
  console.log('     respaldo del destino: ' + path.basename(destino_bk));
  var antes = fs.statSync(dest).mtimeMs;
  fs.copyFileSync(vivo.ruta, dest);
  var post = fs.statSync(dest);
  if (post.mtimeMs <= antes || post.size !== fs.statSync(vivo.ruta).size) {
    console.log('     🔴 LA COPIA NO QUEDO: el destino no cambio. OneDrive la revirtio (alguien lo tiene abierto).');
    bloqueos.push('destino ' + D.n + ': la copia se revirtio');
    return;
  }
  console.log('     ✔ copiado. Ahora el guardian de llegada:');
  var cp = require('child_process');
  try {
    var o = cp.execSync('"' + process.execPath + '" "' + require(__dirname + '/lib-entorno.js').TOOLS + '/reportes/guardian-llegada.js" --origen "' +
      vivo.ruta + '" --destino "' + dest + '" --texto', { encoding: 'utf8', timeout: 300000 });
    console.log(o.split('\n').map(function (l) { return '        ' + l; }).join('\n'));
  } catch (e) {
    console.log('     🔴 el guardian de llegada FALLA: ' + String(e.stdout || e.message).slice(-500));
    bloqueos.push('destino ' + D.n + ': el guardian de llegada fallo');
  }
});

fs.writeFileSync(BACK + '/_fuentes/publicacion-diff.json', JSON.stringify({
  paso: 'N8', modo: OK ? 'publicado' : 'seco', origen: vivo.archivo, hallazgos: hallazgos, bloqueos: bloqueos
}, null, 1));

console.log('\n════════════════════════════════════════');
if (bloqueos.length) {
  console.log('  🔴 ' + bloqueos.length + ' bloqueo(s) — NO se publico:');
  bloqueos.forEach(function (b) { console.log('     · ' + b); });
  process.exit(1);
}
console.log(OK ? '  ✅ PUBLICADO Y VERIFICADO' : '  ✔ diff medido · falta el OK de Rick para publicar');
