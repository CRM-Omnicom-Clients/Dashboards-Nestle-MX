// crm-reporte-resumen · ASEGURAR QUE EXISTEN LAS COLUMNAS QUE EL CONTRATO EXIGE.
//
// 🔴 POR QUÉ EXISTE ESTE SCRIPT. `Insights` se retiró de la hoja el 20-ago y nadie retiró la
//    exigencia: `insights-redactar` se detenía con «no encontré la columna Insights» —y en seco eso
//    se leía como vista previa, no como fallo— mientras la PUERTA 2 cerraba el corte por
//    «una columna muda». Dos etapas peleando por una columna que no estaba, cada corte.
//    Rick pidió el 27-ago: «agrega la de insights». Se agrega, y se agrega DECLARADA, para que
//    el día que alguien la vuelva a quitar el sistema lo diga en vez de atorarse.
//
// 🔴 ESTO NO ES FORMATO. El formato lo edita Rick (E5) y este script no decide anchos ni colores:
//    escribe UN encabezado y hereda el estilo del encabezado de al lado. Lo que sí hace es no
//    destruir nada — que es la otra mitad de esa regla.
//
// 🔴 Y NO ESCRIBE DATOS. La columna nace vacía a propósito: la llena `insights-redactar` en la
//    etapa 13, después de que `resumen-regenerar` reconstruya las filas. Si este script pusiera
//    contenido, el regenerador lo borraría dos etapas después y nadie sabría por qué.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. `lib-columna` consulta `_contratos/registro.json`
//    (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

// ── las columnas que el contrato exige y quién las llena ────────────────────────────
var EXIGIDAS = [
  { nombre: 'Insights', la_llena: 'insights-redactar (etapa 13)', porque: 'Rick, 27-ago-2026: «agrega la de insights». La PUERTA 2 la exige y `insights.insights.js` se detiene sin ella.' },

  /* ── 24-sep-2026 · EL TOTAL CON EL QUE EL DESGLOSE DE CLICKS SÍ SE COMPARA ──────────────
   * 🔴 Rick: «no puede haber incongruencias en el sentido de que el total de clicks sea menor que
   *    alguno de los desgloses». Medido: pasaba en 98 de 101 piezas — `*_Clicks` son únicos POR
   *    CORREO y el desglose suma clicks POR LINK. Quien hace clic en dos links cuenta UNA vez
   *    arriba y DOS abajo, así que Σ(por link) ≥ únicos por correo SIEMPRE. No había nada mal
   *    atribuido: estaban mal COMPARADOS.
   * 🔴 `*_Clicks` NO se toca — sostiene CTOR y Click_Rate, y moverlo cambiaría métricas que el
   *    cliente ya vio. `Clicks_Medidos` es la suma del propio desglose, así que la regla se cumple
   *    POR CONSTRUCCIÓN y no por el dato de este corte. */
  { nombre: 'Principal_Clicks_Medidos', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el total del desglose del envío principal. Sin esta columna el desglose se compara contra `Principal_Clicks` (únicos por correo) y lo excede siempre.' },
  { nombre: 'FUP_Clicks_Medidos', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el total del desglose del seguimiento.' },
  { nombre: 'Tot_Clicks_Medidos', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el total del desglose de la fila completa: Principal + FUP.' },

  // ── 4-sep-2026 · EL UNSUBSCRIBE POR BLOQUE. Siete columnas, no nueve: del bloque Total ya
  //    existen `Unsubs_Unicos` (el conteo) y `% Unsuscribe vs sends` (la tasa sobre envíos),
  //    así que agregarle `Tot_Unsubs` y `Tot_Unsub_Rate` sería poner el mismo número dos veces
  //    en la misma fila. De ese bloque solo falta la lectura sobre opens.
  // 🔴 9-sep-2026 · SE RETIRAN LAS TRES TASAS SOBRE ENVÍOS. Rick, textual: «hay que agregar los
  //    unsuscribe en volumen para la parte de envíos principales, fups y total … es # de
  //    unsuscribe y **deja solo el Unsuscribe vs open rate**. Nadamas».
  //    O sea: por bloque quedan DOS lecturas, no tres — el CONTEO y la UTOR.
  //    `Principal_Unsub_Rate (vs sends)`, `FUP_Unsub_Rate (vs sends)` y `Tot_Unsub_Rate (vs sends)`
  //    salen de aquí ANTES de retirarlas del Excel: quitarlas de la hoja sin quitarlas de esta
  //    lista es cómo el catálogo recreó 11 gemelas después de borrarlas — este script las volvería
  //    a crear vacías en el corte siguiente y nadie sabría de dónde salieron (regla E2, al creador).
  //    El dato no se pierde: la tasa sobre envíos es `Unsubs / Sends` y las dos columnas se quedan.
  { nombre: 'Principal_Unsubs', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'Rick, 4-sep-2026: «necesito el unsubscribe completo … tanto para las versiones principales como para los subs como para el total». El CONTEO, que el 9-sep pidió explícitamente conservar: «los unsuscribe en volumen … es # de unsuscribe».' },
  { nombre: 'Principal_UTOR (vs opens)', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'la baja sobre aperturas del envío principal — la UTOR. Una tasa sobre envíos baja puede esconder una UTOR alta si casi nadie abre. Es la única tasa que Rick dejó: «deja solo el Unsuscribe vs open rate» (9-sep-2026).' },
  { nombre: 'FUP_Unsubs', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'las bajas del seguimiento, separadas del principal: es la comparación que el dato existe para dar.' },
  { nombre: 'FUP_UTOR (vs opens)', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'la baja sobre aperturas del seguimiento. Es la que destapó que el FUP se ve igual sobre envíos y 3× peor sobre aperturas (4.60% vs 1.47%).' },
  { nombre: 'Tot_Unsubs', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'el conteo de bajas del total. Lo había dejado fuera creyendo que ya existía como `Unsubs_Unicos` — no existe: Rick la retiró a mano, y lo leí en un comentario del código en vez de en la hoja.' },
  // ── 7-sep-2026 · LA FECHA DE ENVÍO, una por bloque. Nacen al final —agregar al final es la
  //    operación segura— y `resumen.mover-columnas.js` las lleva a la izquierda de su Subject.
  { nombre: 'Principal_Fecha_Envio', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'Rick, 7-sep-2026: «agrega una columna de Fecha de envío (para principal y para FUP) para cada touchpoint, a un lado del subject a su lado izquierdo». El valor sale del DETALLE día por día, no de `Fecha_Primer_Envio` de la DE agregada: esa la fija una PRUEBA de 1 envío (E-PROP1 dice 3-ago y salió el 24-ago).' },
  { nombre: 'FUP_Fecha_Envio', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'la fecha en que salió el seguimiento, separada de la del principal: 10 de 34 FUP salen en otra quincena que su Principal, y sin esta columna el reporte parece decir que salieron juntos.' },
  { nombre: 'Tot_UTOR (vs opens)', la_llena: 'resumen-regenerar (etapa 12), desde motor-calculo', porque: 'la baja sobre aperturas del total. Una tasa sobre envíos baja puede esconder una UTOR alta si casi nadie abre — que es justo lo que pasa con los FollowUp.' },

  // ══ 19-sep-2026 · EL DESGLOSE DE CLICKS, TRES COLUMNAS POR BLOQUE ═══════════════════════════
  // 🔴 QUÉ PIDIÓ RICK, TEXTUAL: «son demasiadas columnas, necesitamos simplificar, y que sea mucho
  //    más claro qué es cada una. Fácil: click efectivo a CTA … clicks baja … hay que definir
  //    máximo 3 columnas». Y el nombre de la tercera lo eligió él: «ponle redes+navegador+legal,
  //    así lo nombras aunque sea largo». Son 3 × (Principal · FUP · Tot) = 9, ni una más.
  //
  // 🔴 ESTO NO ES «VOLVER A PONER» LO QUE SE RETIRÓ EL 26-AGO. Entonces se retiraron
  //    `Clicks_Qcart · Clicks_App · Clicks_Social · Clicks_Web · Clicks_Ver_Navegador` porque la
  //    afirmación estaba mal: «Fuel for life» tenía 29 piezas sin Qcart declarado y la hoja le
  //    atribuía 113 `Clicks_Qcart`. Lo que cambió no es la decisión, es el clasificador: ahora el
  //    reparto sale de `_contratos/clicks-destinos.json`, sin catch-all, auditado por
  //    `motor.auditar-destinos.js` (5 validaciones) y con su detalle publicado en `Data_Clicks`
  //    para que Rick sume a mano y no me crea a mí. Las 5 viejas siguen retiradas.
  //
  // 🔴 Y LO QUE NO SE SABE NO SE ESCRIBE COMO 0. 27 de las 103 combinaciones fila×bloque con clicks
  //    NO tienen ni una fila en `CRM_Email_Links` (5,616 clicks, 14.3%): para ésas la celda va
  //    `POR DEFINIR`, porque el desglose SÍ aplica y lo debemos — no es `N/A`. Un 0 ahí diría
  //    «ese correo no tuvo clicks efectivos» sobre correos que tuvieron 1,566.
  //    Medido con `motor.medir-cobertura-filas.js`: 76 completas · 0 parciales · 27 sin dato.
  { nombre: 'Principal_Clicks_CTA', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'Rick, 19-sep-2026: «click efectivo a CTA». Junta las 4 clases de intención del contrato (qcart · retail · app · contenido) en UNA columna, que es lo que pidió: no cuatro columnas de tipos de destino.' },
  { nombre: 'Principal_Clicks_Baja', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el click al centro de preferencias / link de baja. 🔴 NO es una baja: solo el 6.3% de las 49,517 bajas pasa por aquí — el resto usa el botón nativo del buzón. El conteo de bajas reales sigue siendo `Principal_Unsubs`, que es otra columna y otro evento.' },
  { nombre: 'Principal_Clicks_Redes+Navegador+Legal', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'redes del footer + ver-en-navegador + aviso legal. El nombre largo es de Rick y es deliberado: le dije que si ver-navegador y legal iban a «Redes», ~39% de esa columna no serían redes, y respondió «ponle redes+navegador+legal así lo nombras aunque sea largo».' },
  { nombre: 'FUP_Clicks_CTA', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el mismo desglose para el seguimiento. Separarlo del Principal es el punto: el FUP se comporta distinto — ya se vio con la baja (UTOR 3× peor), y el CTA es la otra mitad de esa lectura.' },
  { nombre: 'FUP_Clicks_Baja', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el click al link de baja en el seguimiento.' },
  { nombre: 'FUP_Clicks_Redes+Navegador+Legal', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el pie del correo en el seguimiento.' },
  { nombre: 'Tot_Clicks_CTA', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'Principal + FUP. Se escribe en vez de dejar que el lector sume, porque una fila puede tener el Principal medido y el FUP en POR DEFINIR, y entonces la suma a mano sería falsa sin avisar.' },
  { nombre: 'Tot_Clicks_Baja', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el total de clicks al link de baja de la fila.' },
  { nombre: 'Tot_Clicks_Redes+Navegador+Legal', la_llena: 'resumen-regenerar (etapa 12), desde resumen-fusionar', porque: 'el total del pie del correo de la fila.' }
];

DECL.declarar('crm-reporte-resumen', 'resumen.asegurar-columnas.js', [{
  hoja: 'Report_Resumen',
  grano: 'una CELDA de encabezado por columna exigida que falte',
  llave: 'el nombre del encabezado — no hay filas de datos en juego',
  celdas_esperadas: 'hasta ' + EXIGIDAS.length + ' encabezado(s) · 0 celdas de datos'
}]);

console.log('════════ resumen · ASEGURAR COLUMNAS DEL CONTRATO ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_asegurar-cols.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var F = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1, defval: '', blankrows: false });
var enc = (F[0] || []).map(t);
// 🔴 la última columna CON NOMBRE, no la última que devuelve sheet_to_json: la hoja arrastra
//    columnas sin encabezado al final y escribir «después de la última» las dejaría en medio.
var ultimaConNombre = -1;
enc.forEach(function (h, i) { if (h) ultimaConNombre = i; });
console.log('  libro: ' + path.basename(vivo.ruta));
console.log('  Report_Resumen: ' + (F.length - 1) + ' filas de datos · ' + enc.filter(Boolean).length +
  ' columnas con nombre (la última es ' + col(ultimaConNombre) + ' «' + enc[ultimaConNombre] + '»)');
var vacias = enc.length - 1 - ultimaConNombre;
if (vacias > 0) console.log('  ⚠ ' + vacias + ' columna(s) sin encabezado al final (' + col(ultimaConNombre + 1) + '..' + col(enc.length - 1) + ')');

var faltan = EXIGIDAS.filter(function (e) { return enc.indexOf(e.nombre) < 0; });
console.log('\n  ── las columnas del contrato');
EXIGIDAS.forEach(function (e) {
  var i = enc.indexOf(e.nombre);
  console.log('     ' + (i >= 0 ? '✔ ' : '🔴 ') + e.nombre.padEnd(14) + (i >= 0 ? 'ya está, en ' + col(i) : 'NO existe → se agrega en ' + col(ultimaConNombre + 1 + faltan.indexOf(e))));
  console.log('        la llena: ' + e.la_llena);
  if (i < 0) console.log('        por qué: ' + e.porque);
});

if (!faltan.length) { console.log('\n  ✅ no falta ninguna. El Excel no se toca.'); process.exit(0); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ════════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-columnas.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log('\n  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
// 🔴 la parte se resuelve por la RELACIÓN, no por número: `sheet1.xml` no tiene por qué ser la
//    primera pestaña, y escribir en la hoja equivocada no da error, da un desastre.
var wbXml = zip.readAsText('xl/workbook.xml');
var rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var mS = new RegExp('<sheet[^>]*name="Report_Resumen"[^>]*r:id="([^"]+)"').exec(wbXml);
var mR = mS ? new RegExp('Id="' + mS[1] + '"[^>]*Target="([^"]+)"').exec(rels) : null;
var parte = mR ? 'xl/' + mR[1].replace(/^\/?xl\//, '') : null;
if (!parte) { console.log('  🔴 no pude resolver la parte XML de Report_Resumen'); process.exit(1); }
console.log('     parte: ' + parte);

var xml = zip.readAsText(parte);
var nuevas = [];
faltan.forEach(function (e, k) {
  var ci = ultimaConNombre + 1 + k;
  var ref = col(ci) + '1';
  // hereda el estilo del encabezado de al lado: no se decide formato, se copia el que ya hay
  var celda = CX.celda(ref, e.nombre, CX.estiloDe(xml, col(ultimaConNombre) + '1'));
  var res = CX.poner(xml, ref, celda, 1);
  xml = res.xml;
  nuevas.push({ nombre: e.nombre, ref: ref });
  console.log('     ✔ «' + e.nombre + '» → ' + ref);
});
// la dimensión tiene que crecer con la hoja, o Excel se queja
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + col(ultimaConNombre + faltan.length) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);

// ══ LAS CINCO CAPAS (R7) ════════════════════════════════════════════════════════════
console.log('\n  ── las 5 capas');
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/';
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
var NODE = process.execPath;
function capa(nom, cmd, args) {
  try {
    var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(r).split('\n').filter(function (x) { return t(x); }).pop() || 'ok').slice(0, 74));
    return true;
  } catch (e) {
    console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split('\n').pop().slice(0, 74));
    return false;
  }
}
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) {
  console.log('\n  🔴 el paquete no quedó sano: NO se publica. El vivo no se tocó.');
  process.exit(1);
}
fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);

// ══ RELEER DEL DISCO (E4) ═══════════════════════════════════════════════════════════
console.log('\n  ── releído del disco');
var F2 = XLSX.utils.sheet_to_json(XLSX.readFile(vivo.ruta).Sheets['Report_Resumen'], { header: 1, defval: '', blankrows: false });
var enc2 = (F2[0] || []).map(t);
var fallos = 0;
nuevas.forEach(function (n) {
  var i = enc2.indexOf(n.nombre);
  console.log('     ' + (i >= 0 ? '✔ ' : '🔴 ') + '«' + n.nombre + '» ' + (i >= 0 ? 'está en ' + col(i) : 'NO llegó al disco'));
  if (i < 0) fallos++;
});
// 🔴 y que no se haya perdido ninguna de las que ya estaban: agregar al final no debería mover
//    nada, pero «no debería» no es una comprobación.
var perdidas = enc.filter(Boolean).filter(function (h) { return enc2.indexOf(h) < 0; });
console.log('     ' + (perdidas.length ? '🔴 se perdieron: ' + perdidas.join(' · ') : '✔ las ' + enc.filter(Boolean).length + ' columnas anteriores siguen ahí'));
console.log('     filas de datos: ' + (F.length - 1) + ' → ' + (F2.length - 1) + (F.length === F2.length ? '  ✔ ninguna se movió' : '  🔴 CAMBIÓ'));
if (perdidas.length || F.length !== F2.length) fallos++;
console.log('\n  ' + (fallos ? '🔴 no quedó bien' : '✅ LA(S) COLUMNA(S) QUEDARON, verificadas contra el disco'));
process.exit(fallos ? 1 : 0);
