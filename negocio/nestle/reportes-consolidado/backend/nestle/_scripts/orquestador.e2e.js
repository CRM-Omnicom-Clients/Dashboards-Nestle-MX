// orquestador.e2e.js — la prueba de punta a punta: ¿el sistema REPRODUCE su resultado?
//
// 🔴 QUE PRUEBA, Y POR QUE ESA Y NO OTRA.
//    Que el ciclo termine en verde no prueba nada por si solo: ya paso hoy que las 36 validaciones
//    salieron verdes sobre un libro que Excel se NEGABA A ABRIR. Un sistema de reportes tiene que
//    cumplir tres cosas, y esta prueba mide las tres:
//
//      1 · REPRODUCE   — correr el ciclo otra vez desde el MISMO punto de partida da el MISMO
//                        resultado. Si no, hay estado escondido y ningun numero es confiable.
//      2 · ABRE        — Excel abre el archivo. Se mide con Excel de verdad, no con validadores.
//      3 · ES DERIVADO — cada cifra del reporte se puede rastrear hasta una fuente.
//
//    La 1 es la que nadie corre, y es la que caza el estado escondido: un script que lee el libro
//    VIVO en vez de la salida del paso anterior produce un resultado distinto en la 2a corrida.
//
// USO:  node orquestador.e2e.js            → compara la corrida actual contra una corrida nueva
//       node orquestador.e2e.js --rapido   → solo la huella + Excel, sin volver a correr el ciclo
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), cp = require('child_process');
var BACK = require('path').resolve(__dirname, '..');
var L = require(BACK + '/_scripts/lib-flexible.js');
var PROY = ENT.PROYECTO;
var RAPIDO = process.argv.indexOf('--rapido') > -1;
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };

console.log('════════ N11 · PRUEBA DE PUNTA A PUNTA ════════\n');

// ── la huella: lo que tiene que salir igual ────────────────────────────────────────────────
// NO se comparan bytes: el zip lleva fechas dentro y dos corridas identicas dan zips distintos.
// Se compara lo que el reporte DICE — hojas, filas, y la suma de cada columna numerica.
function huella(ruta) {
  var T = require('path').resolve(__dirname, '..') + '/_tmp/_e2e_' + Math.abs(ruta.length % 97) + '.xlsx';
  fs.copyFileSync(ruta, T);
  var wb = XLSX.readFile(T);
  var H = { hojas: wb.SheetNames.slice(), filas: {}, sumas: {}, textos: {} };
  wb.SheetNames.forEach(function (h) {
    var R = XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '', blankrows: false });
    H.filas[h] = R.length;
    if (!R.length) return;
    var s = {}, tx = 0;
    Object.keys(R[0]).forEach(function (c) {
      var n = 0, hay = false;
      R.forEach(function (r) {
        var v = r[c];
        if (typeof v === 'number' && isFinite(v)) { n += v; hay = true; }
        else if (typeof v === 'string' && v.trim()) tx += v.length;
      });
      if (hay) s[c] = Math.round(n * 1e6) / 1e6;
    });
    H.sumas[h] = s;
    H.textos[h] = tx;   // el volumen de texto: caza que los insights o los subjects se pierdan
  });
  return H;
}

function comparar(A, B) {
  var d = [];
  A.hojas.forEach(function (h) { if (B.hojas.indexOf(h) < 0) d.push('la hoja ' + h + ' desaparecio en la 2a corrida'); });
  B.hojas.forEach(function (h) { if (A.hojas.indexOf(h) < 0) d.push('la hoja ' + h + ' aparecio de la nada en la 2a corrida'); });
  Object.keys(A.filas).forEach(function (h) {
    if (B.filas[h] === undefined) return;
    if (A.filas[h] !== B.filas[h]) d.push(h + ': ' + A.filas[h] + ' filas → ' + B.filas[h]);
    if (A.textos[h] !== B.textos[h]) d.push(h + ': el texto cambio de ' + mil(A.textos[h]) + ' a ' + mil(B.textos[h]) + ' caracteres');
    Object.keys(A.sumas[h] || {}).forEach(function (c) {
      var a = A.sumas[h][c], b = (B.sumas[h] || {})[c];
      if (b === undefined) d.push(h + '.' + c + ': la columna desaparecio');
      else if (a !== b) d.push(h + '.' + c + ': Σ ' + mil(a) + ' → ' + mil(b) + '   (Δ ' + mil(b - a) + ')');
    });
  });
  return d;
}

// ── 1 · la huella de AHORA ─────────────────────────────────────────────────────────────────
var vivo = L.archivoVivo({ dir: PROY });
console.log('  archivo vivo: ' + vivo.archivo);
var H1 = huella(vivo.ruta);
console.log('  huella 1: ' + H1.hojas.length + ' hojas · ' +
  Object.keys(H1.filas).reduce(function (a, h) { return a + H1.filas[h]; }, 0) + ' filas · ' +
  Object.keys(H1.sumas).reduce(function (a, h) { return a + Object.keys(H1.sumas[h] || {}).length; }, 0) + ' columnas numericas\n');

// ── 3 · TODA CIFRA ES DERIVADA ─────────────────────────────────────────────────────────────
// El reporte no puede traer un numero que ninguna fuente respalde. Se comprueba contra la rejilla,
// que es lo unico que calcula, y contra los bloques, que es lo unico que lee las fuentes.
console.log('\n  ── ¿toda cifra viene de una fuente?');
try {
  var rej = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
  var blo = ['email', 'qcart', 'whatsapp', 'manual'].map(function (n) {
    return { n: n, d: JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')) };
  });
  var celdas = (rej.rejilla || []).length;
  chk('la rejilla existe y tiene celdas', celdas > 0, celdas + ' celdas (campaña × objetivo × TP × segmento × quincena)');
  // el recorrido completo: FUENTE → bloque → rejilla → reporte. Cada salto se mide aparte, porque
  // un salto que cuadra no prueba nada del otro: hoy el bloque→rejilla perdía 25,212 envíos y el
  // rejilla→reporte cuadraba perfecto, así que mirar solo el final habría dado verde.
  var sendsRej = rej.rejilla.reduce(function (a, c) { return a + (Number(c.total.sends) || 0); }, 0);
  var em = blo.filter(function (b) { return b.n === 'email'; })[0];
  var sendsBlo = ((em.d.envios) || []).reduce(function (a, e) { return a + (Number(e.email_sends) || 0); }, 0);
  var fuera = (rej.fuera_de_la_rejilla || []).filter(function (x) { return x.medio === 'email'; })
    .reduce(function (a, x) { return a + (Number(x.sends) || 0); }, 0);
  chk('BLOQUE → REJILLA: no se pierde nada sin declararlo',
    sendsRej + fuera === sendsBlo,
    mil(sendsRej) + ' en rejilla + ' + mil(fuera) + ' declarados fuera = ' + mil(sendsRej + fuera) + '  vs bloque ' + mil(sendsBlo));
  var H = H1.sumas['Report_Resumen'] || {};
  var sendsRep = (Number(H['Principal_Sends']) || 0) + (Number(H['FUP_Sends']) || 0);
  chk('REJILLA → REPORTE: el reporte no inventa ni pierde',
    sendsRep === sendsRej, mil(sendsRep) + ' vs ' + mil(sendsRej));
  // y el extremo: lo que el reporte dice contra lo que la FUENTE trae, sin escalas intermedias
  chk('FUENTE → REPORTE: la cifra del reporte se explica entera',
    sendsRep + fuera === sendsBlo,
    mil(sendsRep) + ' + ' + mil(fuera) + ' = ' + mil(sendsRep + fuera) + ' vs ' + mil(sendsBlo));
  var wa = blo.filter(function (b) { return b.n === 'whatsapp'; })[0];
  var waBlo = ((wa.d.envios) || []).reduce(function (a, e) { return a + (Number(e.sends) || 0); }, 0);
  var waRej = rej.rejilla.reduce(function (a, c) { return a + (Number(c.whatsapp.sends) || 0); }, 0);
  chk('WhatsApp llega entero a la rejilla', waRej === waBlo, mil(waRej) + ' = ' + mil(waBlo));
} catch (e) {
  chk('se pudo rastrear el reporte hasta las fuentes', false, e.message.slice(0, 120));
}

// ── 4 · ¿REPRODUCE? — la que caza el estado escondido ──────────────────────────────────────
if (RAPIDO) {
  console.log('\n  ⏭ --rapido: NO se volvio a correr el ciclo. La reproducibilidad NO se probo en esta corrida.');
} else {
  console.log('\n  ── ¿reproduce? (se corre el ciclo COMPLETO otra vez desde el mismo backup)');
  var bks = fs.readdirSync(PROY + '/_backups').filter(function (f) { return /antes-N4-canonicas.*\.xlsx$/.test(f); });
  if (!bks.length) {
    chk('hay un punto de partida para reproducir', false, 'no existe el backup «antes-N4-canonicas»');
  } else {
    bks.sort(function (a, b) { return fs.statSync(PROY + '/_backups/' + b).mtimeMs - fs.statSync(PROY + '/_backups/' + a).mtimeMs; });
    var partida = PROY + '/_backups/' + bks[0];
    console.log('     punto de partida: ' + bks[0]);
    // se guarda el resultado de la 1a corrida ANTES de pisarlo
    var guardado = require('path').resolve(__dirname, '..') + '/_tmp/_e2e_corrida1.xlsx';
    fs.copyFileSync(vivo.ruta, guardado);
    fs.copyFileSync(partida, vivo.ruta);
    var t0 = Date.now();
    var salida = '';
    try {
      salida = cp.execSync('"' + process.execPath + '" "' + BACK + '/_scripts/orquestador.orquestador.js" --escribir',
        { encoding: 'utf8', timeout: 900000, cwd: BACK + '/_scripts' });
    } catch (e) { salida = String(e.stdout || '') + String(e.message || ''); }
    var seg = Math.round((Date.now() - t0) / 1000);
    var mFall = /scripts corridos: (\d+)\s+·\s+con fallo: (\d+)/.exec(salida);
    console.log('     2a corrida: ' + seg + 's · ' + (mFall ? mFall[1] + ' scripts, ' + mFall[2] + ' fallos' : 'no se pudo leer el resumen'));
    if (!mFall || mFall[2] !== '0') {
      // sin esto, un fallo de la 2a corrida se leia como «no reproduce» y mandaba a buscar
      // estado escondido donde solo habia un script caido.
      console.log('     ── por que fallo la 2a corrida:');
      salida.split(/[\r\n]+/).filter(function (l) { return /🔴|FALLA|Error|se detuvo/.test(l); })
        .slice(-6).forEach(function (l) { console.log('        ' + l.trim().slice(0, 150)); });
    }
    chk('la 2a corrida termina sin fallos', !!mFall && mFall[2] === '0', mFall ? mFall[2] + ' fallos' : 'sin resumen');
    chk('la 2a corrida tarda menos de 30 min', seg < 1800, seg + 's');
    var H2 = huella(vivo.ruta);
    var difs = comparar(H1, H2);
    chk('la 2a corrida da EXACTAMENTE el mismo resultado', difs.length === 0,
      difs.length ? difs.length + ' diferencia(s)' : 'huella identica');
    if (difs.length) {
      console.log('\n     🔴 el sistema NO reproduce. Diferencias entre corrida 1 y 2:');
      difs.slice(0, 20).forEach(function (d) { console.log('        · ' + d); });
      if (difs.length > 20) console.log('        … y ' + (difs.length - 20) + ' mas');
      console.log('\n     Eso significa estado escondido: algun paso lee el libro VIVO en vez de');
      console.log('     la salida del paso anterior, o arrastra un archivo temporal entre corridas.');
    }
  }
}

// ── ¿ABRE EN EXCEL? — VA AL FINAL, y no es un detalle de orden ─────────────────────────────
// 🔴 Estaba arriba y ROMPIA la prueba que le sigue: abrir el libro con Excel COM deja el proceso
//    EXCEL.EXE agarrado al archivo unos segundos, y la corrida de reproducibilidad —que escribe
//    sobre ese mismo archivo— moria a los 10s contra el lock. El sintoma enganaba: se veian 57
//    diferencias de cifras y parecia que el sistema no reproducia, cuando lo que pasaba era que
//    la 2a corrida ni siquiera habia llegado a correr. Medir algo no puede cambiar lo que mide.
// Las 4 capas de validacion pasaron hoy sobre un libro que Excel rechazaba. La unica prueba de
// que un .xlsx abre es abrirlo.
console.log('  ── ¿lo abre Excel?');
var ps = os.tmpdir() + '/_e2e_abrir.ps1';
fs.writeFileSync(ps, [
  '$ErrorActionPreference = "Stop"',
  '$f = $args[0]',
  '$xl = New-Object -ComObject Excel.Application',
  '$xl.Visible = $false; $xl.DisplayAlerts = $false; $xl.AskToUpdateLinks = $false',
  'try {',
  '  $wb = $xl.Workbooks.Open($f, 0, $true)',
  '  Write-Output ("ABRE|" + $wb.Worksheets.Count)',
  '  $wb.Close($false)',
  '} catch { Write-Output ("NOABRE|" + $_.Exception.Message) }',
  'finally { $xl.Quit() }'
].join('\n'), 'utf8');
var abre = '', hojasXl = 0;
try {
  var o = cp.execSync('powershell -NoProfile -ExecutionPolicy Bypass -File "' + ps + '" "' + vivo.ruta + '"',
    { encoding: 'utf8', timeout: 300000 });
  var m = /(ABRE|NOABRE)\|(.*)/.exec(o);
  abre = m ? m[1] : '?'; hojasXl = m && m[1] === 'ABRE' ? +m[2] : 0;
  console.log('     ' + (abre === 'ABRE' ? '✔ Excel lo abre · ' + hojasXl + ' hojas' : '🔴 Excel NO lo abre: ' + (m ? m[2] : o).slice(0, 200)));
} catch (e) {
  abre = 'SIN-EXCEL';
  console.log('     ⚠ no se pudo usar Excel COM en esta maquina: ' + String(e.message).slice(0, 90));
  console.log('       → ESTE CHECK NO SE CORRIO. No cuenta como verde.');
}
if (abre !== 'SIN-EXCEL') chk('Excel abre el libro', abre === 'ABRE', abre === 'ABRE' ? hojasXl + ' hojas' : 'RECHAZADO');
if (abre === 'ABRE') chk('Excel ve las mismas hojas que el lector', hojasXl === H1.hojas.length, hojasXl + ' = ' + H1.hojas.length);


// ── SE DEVUELVE EL LIBRO COMO ESTABA. No es cortesía: es correccion. ───────────────────────
// 🔴 Esta prueba PISA el workbook para volver a correr el ciclo. Si la 2a corrida falla a medias,
//    el libro se queda en ese estado a medio hacer — y la corrida SIGUIENTE de la prueba toma ESO
//    como linea base y reporta diferencias que no existen. Paso: comparo un libro con 96 piezas
//    contra uno con 108 y concluí «no reproduce», cuando lo unico roto era mi propia prueba.
//    Una prueba que deja daño no es una prueba: es un script de escritura disfrazado.
if (!RAPIDO && fs.existsSync(require('path').resolve(__dirname, '..') + '/_tmp/_e2e_corrida1.xlsx')) {
  var H2f = huella(vivo.ruta);
  var reproducido = comparar(H1, H2f).length === 0;
  // se restaura SIEMPRE — tanto si reprodujo (los dos son iguales) como si no (el bueno es el 1o)
  fs.copyFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_e2e_corrida1.xlsx', vivo.ruta);
  console.log('\n  ↩ el workbook queda como estaba antes de la prueba' +
    (reproducido ? ' (la 2a corrida daba lo mismo, asi que da igual cual)' : ' — la 2a corrida NO era publicable'));
}

// ── veredicto ──────────────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(52) + ' ' + (v[2] === undefined ? '' : v[2])); });
fs.writeFileSync(BACK + '/_fuentes/e2e.json', JSON.stringify({
  paso: 'N11', rapido: RAPIDO, excel: abre, checks: V.map(function (v) { return { check: v[0], ok: v[1], dato: String(v[2]) }; })
}, null, 1));
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' CHECK(S) EN ROJO — la prueba de punta a punta NO pasa' :
  '✅ PRUEBA DE PUNTA A PUNTA SUPERADA — ' + V.length + ' checks'));
process.exit(fallo ? 1 : 0);
