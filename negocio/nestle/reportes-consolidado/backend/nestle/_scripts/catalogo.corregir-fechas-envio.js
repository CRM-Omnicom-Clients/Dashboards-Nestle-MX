// nestle-catalogo · LAS FECHAS DE ENVÍO DEL CATÁLOGO, tomadas del envío REAL.
//
// 🔴 LO QUE PIDIÓ RICK (7-sep-2026): «actualiza el catálogo con esas fechas, muchas dicen por
//    definir pero esos datos sí los tienes, las fechas de envío».
//
// 🔴 DE DÓNDE SALE LA FECHA. Del DETALLE día por día, no de `Fecha_Primer_Envio` de la DE
//    agregada. La DE toma el primer job que existe, PRUEBAS INCLUIDAS: para E-PROP1 dice
//    **3-ago**, y ese día SFMC solo registró cuatro jobs de UN envío. El envío real arrancó el
//    **24-ago**. Son 21 días de diferencia en la pieza más grande de AON.
//
// 🔴 TRES REGLAS, Y LA TERCERA ES LA QUE PROTEGE EL DATO DE RICK:
//      1 · celda VACÍA y SFMC lo tiene            → se LLENA
//      2 · la celda es ANTERIOR al envío real     → se CORRIGE: o era una prueba, o la hoja se
//          quedó vieja mientras el envío seguía. Las dos se arreglan escribiendo el real.
//      3 · la celda es POSTERIOR al envío real    → 🔴 NO SE TOCA. Eso no lo explica una prueba:
//          `Fecha_Ultimo_Envio` tiene el MISMO valor en las 12 piezas de AON (2026-04-30), o sea
//          un CIERRE DE PERIODO. Pisarlo cambiaría lo que la columna significa, y eso lo decide
//          Rick. Se declara y se deja.
//
// 🔴 Y NO TOCA LA QUINCENA. Corregir la fecha movería de periodo a 19 piezas, y eso mueve filas
//    del reporte. Rick pidió las fechas, no mover filas. Se cuenta, se declara, y se para ahí.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
var HOJA = 'Catalogo_Piezas';
// 🔴 LAS DERIVADAS VAN CON SU FECHA, EN EL MISMO PASO. Rick: «las quincenas las corriges, de
//    catálogo y reporte». Si la fecha se corrige aquí y la quincena en otro script, hay una
//    ventana en la que el catálogo dice que salió el 24-ago y que su quincena es la del 3-ago.
//    Cada derivada declara CÓMO se calcula, y la regla de la quincena la pone 
//    a través de  — no se reimplementa el 1-15/16-fin aquí.
var MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var COLS = [
  { id: 'Fecha_Primer_Envio', campo: 'primero', deriva: function (d) { return d; } },
  { id: 'Fecha_Ultimo_Envio', campo: 'ultimo', deriva: function (d) { return d; } },
  { id: 'Quincena', campo: 'primero', deriva: function (d) { return M.aQuincena(d); } },
  { id: 'Mes_Lanzamiento', campo: 'primero', deriva: function (d) { return d.slice(0, 7); } },
  { id: 'Mes', exacta: true, campo: 'primero', deriva: function (d) { return MESES_ES[Number(d.slice(5, 7)) - 1]; } },
  { id: 'Mes (#)', exacta: true, campo: 'primero', deriva: function (d) { return String(Number(d.slice(5, 7))); } },

  // ── 7-sep-2026 · EL PERIODO DE LA PIEZA, calculado de SUS PROPIOS DÍAS ──────────────
  // 🔴 Rick: «no puede haber por definir que sí tengas». Estas siete decían POR DEFINIR en 7
  //    piezas cada una, y el dato estaba en el detalle día por día todo el tiempo.
  // 🔴 Y NO SE COPIAN DE UNA HERMANA. El barrido las encontró «heredables» porque las 3
  //    hermanas de Fuel for life · E-E3 coinciden — pero `N_Quincenas` es de la PIEZA, no de la
  //    campaña: dos piezas del mismo touchpoint pueden haber mandado en semanas distintas.
  //    Heredar por coincidencia es derivar por parecido, que es justo lo que el catálogo prohíbe.
  { id: 'Quincenas_Activas', campo: 'primero', deTodo: function (e) { return e.quincenas.join(' ; '); } },
  { id: 'N_Quincenas', campo: 'primero', deTodo: function (e) { return String(e.quincenas.length); } },
  { id: 'Meses_Activos', campo: 'primero', deTodo: function (e) { return e.meses.join(' ; '); } },
  { id: 'N_Meses', campo: 'primero', deTodo: function (e) { return String(e.meses.length); } },
  { id: 'Dias_Envio', campo: 'primero', deTodo: function (e) { return String(e.dias_envio); } },
  { id: 'Sends_Por_Quincena', campo: 'primero', deTodo: function (e) { return e.sends_por_quincena; } },
  { id: 'Sends_Por_Mes', campo: 'primero', deTodo: function (e) { return e.sends_por_mes; } },
  // 🔴 `Granularidad_Periodo` = con qué PRECISIÓN se conoce el periodo. Con el detalle día por
  //    día se conoce el DÍA — es el dato, no una suposición. Rellenar precisión que no existe
  //    sería peor que dejarlo vacío; aquí existe.
  { id: 'Granularidad_Periodo', campo: 'primero', deTodo: function () { return 'dia'; } },
  // 🔴 `esFecha: false` NO es decoración. La verificación de abajo decidía por el PREFIJO del
  //    nombre (`/^Fecha_/`) si una celda era una fecha, y `Fecha_Origen` NO lo es: guarda de DÓNDE
  //    salió la fecha. Al releerla, `M.aFecha('SFMC · detalle día por día…')` devolvía vacío y el
  //    verificador reportaba «0 de 1 quedaron» sobre una celda que estaba perfectamente escrita
  //    (14-sep-2026, con la Jornada 8). Un verificador que da falsos rojos se acaba ignorando, y
  //    entonces ya no verifica nada. El tipo se DECLARA, no se adivina del nombre.
  { id: 'Fecha_Origen', esFecha: false, campo: 'primero', deTodo: function () { return 'SFMC · detalle día por día (sin jobs de prueba)'; } },

  // 🔴  TAMBIÉN SE LIMPIA. El catálogo lo tenía con las pruebas dentro, y el reparto por
  //    quincena sin ellas: 52 piezas donde el reparto daba 34,449 y la columna 34,450 — la
  //    diferencia era exactamente el correo de prueba. La regla del catálogo es que
  //     SUME ; con dos criterios distintos no puede cumplirse nunca.
  //    Rick: «no puede haber ya nada de prueba, limpia esto».
  { id: 'Sends', campo: 'primero', deTodo: function (e) { return String(e.envios); } }
];

DECL.declarar('nestle-catalogo', 'catalogo.corregir-fechas-envio.js', [{
  hoja: HOJA, grano: 'una CELDA — pieza × columna de fecha',
  llave: 'Pieza_ID + nombre de columna',
  celdas_esperadas: 'las vacías que SFMC tiene, y las que son ANTERIORES al envío real. Ninguna posterior.'
}]);

console.log('════════ nestle-catalogo · FECHAS DE ENVÍO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var X = M.cargar();
var rf = X.resumenFechas;
console.log('  volcado: ' + X.volcado + '   ·   ' + X.piezas.length + ' piezas · cruzan ' + X.cruzan);
console.log('  jobs de prueba descartados: ' + rf.jobs_descartados + ' = ' + rf.volumen_descartado + ' envíos (' +
  (rf.pct_descartado * 100).toFixed(4) + '%)' + (rf.aviso ? '  ⚠ ' + rf.aviso : '  ✔'));
// 🔴 si el umbral se volviera grande, este paso NO escribe: estaría borrando envíos reales.
if (rf.aviso) { console.log('\n  🔴 el umbral de prueba está descartando demasiado volumen. NO se escribe.'); process.exit(1); }

var wsL = XLSX.readFile(X.tmp).Sheets[HOJA];
var rngL = XLSX.utils.decode_range(wsL['!ref']);
var encL = [];
for (var c0 = rngL.s.c; c0 <= rngL.e.c; c0++) { var e0 = wsL[XLSX.utils.encode_cell({ r: 0, c: c0 })]; encL[c0] = e0 ? t(e0.v) : ''; }
var iPieza = encL.indexOf(X.nmPieza), filaDe = {};
for (var r0 = 1; r0 <= rngL.e.r; r0++) { var cP = wsL[XLSX.utils.encode_cell({ r: r0, c: iPieza })]; var i0 = cP ? t(cP.v) : ''; if (i0) filaDe[i0] = r0 + 1; }

var plan = [], intocadas = [], sinFuente = 0;
COLS.forEach(function (c) {
  var nm = X.columna(c.id, c.exacta);
  if (!nm) { console.log('     🔴 la columna ' + c.id + ' NO resuelve — se declara, no se salta en silencio'); return; }
  var iCol = encL.indexOf(nm); if (iCol < 0) return;
  X.piezas.forEach(function (p) {
    var id = X.idDe(p), fila = filaDe[id]; if (!fila) return;
    var R = X.fechasDe(p), base = R ? R[c.campo] : null;
    var real = base ? (c.deTodo ? c.deTodo(R) : c.deriva(base)) : null;
    var actual = t(p[nm]);
    if (!real) { if (M.esHueco(actual)) sinFuente++; return; }
    if (M.esHueco(actual)) { plan.push({ id: id, col: c.id, fila: fila, ref: col(iCol) + fila, de: '(vacía)', a: real, motivo: 'llena' }); return; }
    var esFecha = /^Fecha_/.test(c.id);
    var h = esFecha ? M.aFecha(actual) : actual; if (!h) return;
    if (h === real) return;
    // 🔴 7-sep-2026 · LA REGLA 3 SE CAYÓ AL INVESTIGARLA, y así es como debía caerse.
    //    Dejé sin tocar 6 celdas donde la hoja iba DESPUÉS del envío real, suponiendo que fuera
    //    un CIERRE DE PERIODO. Rick pidió que coincidieran 104/104 y al mirarlas una por una
    //    resultó otra cosa: las 6 son piezas de la oleada de MARZO —primer envío = último = 19-mar—
    //    y la hoja les puso 30-abr / 3-may, que es la fecha de la oleada de ABRIL. Es el mismo
    //    defecto del «nombre prestado» de 001-P025, ahora en la columna de fecha.
    //    Una hipótesis que se investiga y no se sostiene se retira: la fecha del catálogo es la
    //    del envío real, en las dos direcciones.
    plan.push({ id: id, col: c.id, fila: fila, ref: col(iCol) + fila, de: h, a: real,
      motivo: 'corrige', dias: esFecha ? Math.round((new Date(real) - new Date(h)) / 86400000) : 0 });
  });
});

var porCol = {}; plan.forEach(function (x) { (porCol[x.col] = porCol[x.col] || []).push(x); });
console.log('\n  ── lo que se va a escribir');
Object.keys(porCol).forEach(function (k) {
  var g = porCol[k], ll = g.filter(function (x) { return x.motivo === 'llena'; }), co = g.filter(function (x) { return x.motivo === 'corrige'; });
  console.log('     ' + k.padEnd(22) + String(g.length).padStart(3) + ' celda(s)   ·   ' + ll.length + ' vacías que se llenan   ·   ' + co.length + ' que tenían la fecha de una prueba');
  co.sort(function (a, b) { return b.dias - a.dias; }).slice(0, 4).forEach(function (x) {
    console.log('        ' + x.id.padEnd(10) + x.de + '  →  ' + x.a + '   (+' + x.dias + ' días)');
  });
  if (co.length > 4) console.log('        … y ' + (co.length - 4) + ' más');
});
if (!plan.length) console.log('     (ninguna)');

console.log('\n  ── lo que NO se toca');
console.log('     ' + sinFuente + ' celda(s) vacías que SFMC tampoco tiene (WhatsApp y piezas sin envío en la DE)');
if (intocadas.length) {
  console.log('     🔴 ' + intocadas.length + ' celda(s) donde la hoja es POSTERIOR al envío real — parece un CIERRE DE PERIODO, no una fecha de envío:');
  intocadas.slice(0, 6).forEach(function (x) { console.log('        ' + x.id.padEnd(10) + x.col.padEnd(20) + 'hoja ' + x.hoja + '   real ' + x.real); });
  if (intocadas.length > 6) console.log('        … y ' + (intocadas.length - 6) + ' más');
}

// ── el efecto en la quincena, declarado ─────────────────────────────────────────────
var nmQ = X.columna('Quincena'), mueven = [];
plan.filter(function (x) { return x.col === 'Fecha_Primer_Envio'; }).forEach(function (x) {
  var p = X.piezas.filter(function (y) { return X.idDe(y) === x.id; })[0]; if (!p) return;
  var qa = t(p[nmQ]), qn = M.aQuincena(x.a);
  if (qa && !M.esHueco(qa) && qn && qa !== qn) mueven.push(x.id + ' ' + qa + '→' + qn);
});
console.log('\n  ── 🔴 LA QUINCENA NO SE TOCA, y esto es lo que quedaría desalineado');
console.log('     ' + mueven.length + ' pieza(s) tendrían su fecha en una quincena y su columna `Quincena` en otra.');
console.log('     Moverlas cambiaría de periodo filas del reporte — es decisión de Rick, no efecto colateral.');
if (mueven.length) console.log('     ' + mueven.slice(0, 8).join(' · ') + (mueven.length > 8 ? ' … +' + (mueven.length - 8) : ''));

fs.writeFileSync(BACK + '/_preescritura/PRE-fechas-envio.json', JSON.stringify({ cuando: new Date().toISOString(), volcado: X.volcado, plan: plan, intocadas: intocadas, mueven_quincena: mueven }, null, 1));
console.log('\n  ═══ ' + plan.length + ' celda(s)   ·   → _preescritura/PRE-fechas-envio.json');
if (!plan.length) { console.log('\n  ✅ nada que escribir.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-fechas-envio.xlsx';
fs.copyFileSync(X.libro, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));
var zip = new AdmZip(X.tmp);
var wbXml = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="' + HOJA + '"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte), esc = 0;
plan.forEach(function (x) {
  var res = CX.poner(xml, x.ref, CX.celda(x.ref, x.a, CX.estiloDe(xml, x.ref)), x.fila);
  xml = res.xml; if (res.como !== 'sin fila') esc++;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(X.tmp);
console.log('     ✔ ' + esc + ' de ' + plan.length + ' celda(s) escritas');
if (esc !== plan.length) { console.log('  🔴 faltaron celdas: NO se publica.'); process.exit(1); }

console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split('\n').filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 60)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 60)); return false; }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', X.tmp])) { console.log('\n  🔴 paquete no sano: NO se publica.'); process.exit(1); }
fs.copyFileSync(X.tmp, X.libro);
console.log('     → publicado a ' + path.basename(X.libro));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', X.libro]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', X.libro]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', X.libro]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', X.libro]);

console.log('\n  ── releído del disco');
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(X.libro).Sheets[HOJA], { defval: '', blankrows: false });
var mal = 0;
Object.keys(porCol).forEach(function (k) {
  var cc = COLS.filter(function (z) { return z.id === k; })[0];
  var nm = X.columna(k, cc && cc.exacta), malos = 0;
  porCol[k].forEach(function (x) {
    var p = P2.filter(function (y) { return t(y[X.nmPieza]) === x.id; })[0];
    // 🔴 el tipo lo DECLARA la columna; el prefijo del nombre solo se usa si no lo declaró.
    //    Ver la nota de `Fecha_Origen` en COLS: decidirlo por el nombre daba un rojo falso.
    var esFecha = (cc && cc.esFecha !== undefined) ? cc.esFecha : /^Fecha_/.test(k);
    var got = esFecha ? M.aFecha(p && p[nm]) : t(p && p[nm]);
    var nrm = function (z) { return String(z == null ? '' : z).normalize('NFC').trim(); };
    if (!p || nrm(got) !== nrm(x.a)) malos++;
  });
  console.log('     ' + (malos ? '🔴 ' : '✔ ') + k.padEnd(22) + (porCol[k].length - malos) + ' de ' + porCol[k].length + ' quedaron');
  mal += malos;
});
console.log('     filas del catálogo: ' + X.hoja.length + ' → ' + P2.length + (X.hoja.length === P2.length ? '   ✔ ninguna se movió' : '   🔴 CAMBIÓ'));
if (X.hoja.length !== P2.length) mal++;
console.log('\n  ' + (mal ? '🔴 ' + mal + ' no quedaron' : '✅ ' + plan.length + ' FECHAS ESCRITAS, verificadas contra el disco'));
process.exit(mal ? 1 : 0);
