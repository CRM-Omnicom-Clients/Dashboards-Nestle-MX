/*
 * escritor.hojas-clicks.js — crea `Data_Clicks` y `Dic_Clicks` en el workbook.
 *
 * 🔴 RICK, 20-sep-2026: «ten una hoja donde estén esos datos bajados bien... para que doble valides
 *    tus cálculos». La idea de fondo es suya y es la correcta: si él no puede ver el detalle y
 *    sumarlo, no hay doble validación — hay una promesa mía.
 *
 * 🔴 DOS HOJAS NUEVAS, NINGUNA EXISTENTE SE TOCA. Se crean al final del libro. Si ya existen, se
 *    reemplaza su contenido — son hojas DERIVADAS, se regeneran enteras en cada corte, y por eso
 *    NADIE debe escribir a mano en ellas. Eso queda dicho en la primera fila de `Dic_Clicks`.
 *
 * 🔴 SE ESCRIBE CON SheetJS Y LUEGO LAS 5 CAPAS. SheetJS borra estilos al escribir, así que estas
 *    dos hojas nacen sin formato a propósito: el formato lo pone Rick si las quiere presentables.
 *    Lo que NO puede pasar es que al agregarlas se degrade el resto del libro — de eso se encargan
 *    las 5 capas, y si alguna falla no se publica.
 */
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();

// 🔴 ANCLADO AL CATÁLOGO RAÍZ (19-sep-2026, al entrar a la cadena). `lib-columna` resuelve el
//    encabezado REAL desde `_contratos/registro.json` o truena. Este script vivía fuera del ciclo;
//    al cablearlo, la guarda 5 bloqueó el corte con razón: dentro del corte, una lectura por literal
//    devuelve `undefined` tras un renombre y `undefined` se lee como «vacío».
var COL = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var L = require(BACK + '/_scripts/lib-flexible.js');
var DECL = require(BACK + '/_scripts/lib-declaracion-escritura.js');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
var NL = String.fromCharCode(10);

var PRE = BACK + '/_preescritura/hoja-clicks.json';
if (!fs.existsSync(PRE)) { console.log('🔴 falta la medición. Corre antes: motor.hoja-clicks.js'); process.exit(1); }
var M = JSON.parse(fs.readFileSync(PRE, 'utf8'));

console.log('════════ escritor · Data_Clicks y Dic_Clicks ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);
console.log('  Data_Clicks: ' + M.Data_Clicks.length + ' filas   ·   Dic_Clicks: ' + M.Dic_Clicks.length + ' filas');

// ── la metodología, como filas legibles al principio del diccionario ───────────────
// 🔴 Va DENTRO del libro a propósito. Una metodología que vive solo en un script es una
//    metodología que nadie del equipo puede leer ni cuestionar.
var METODO = [
  ['⚠ HOJA DERIVADA — no escribir a mano: se regenera entera en cada corte', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', ''],
  ['METODOLOGÍA · cómo se cuentan los clicks', '', '', '', '', '', '', '', '', '', ''],
  ['1 · El destino se lee de la URL del link, no de su nombre', 'Link_Name viene vacío en casi todas las filas de la DE, así que no se puede usar como autoridad.', '', '', '', '', '', '', '', '', ''],
  ['2 · Los patrones viven en un contrato, no en código', '_contratos/clicks-destinos.json. Un patrón en código es un patrón que nadie puede revisar.', '', '', '', '', '', '', '', '', ''],
  ['3 · No hay clase "cajón de sastre"', 'Lo que ningún patrón reconoce cae en por_clasificar y se declara. Antes todo lo desconocido se volvía "web", o sea intención, en silencio.', '', '', '', '', '', '', '', '', ''],
  ['4 · DOS fuentes, nunca sumadas entre ellas', 'Clicks_DE = CRM_Email_Links, único por LINK. Clicks_Plataforma = ClickEvent, TOTALES por URL. Miden cosas distintas: sumarlas sería inventar.', '', '', '', '', '', '', '', '', ''],
  ['5 · Por qué hacen falta las dos', 'El link de baja de SFMC es TOKENIZADO POR SUSCRIPTOR (cloud.email.mx.nestle.com/Unsubscribe?qs=...). Una DE que agrupa por URL no puede representarlo: serían miles de filas de un click. En 30 de 106 piezas la DE mostraba CERO bajas habiendo miles.', '', '', '', '', '', '', '', '', ''],
  ['6 · El cruce a la pieza es por NOMBRE, no por ConfigKey', 'SFMC publica ConfigKeys provisionales (TMP-*). Cruzar por ahí dejó 237 filas sin campaña en la primera corrida.', '', '', '', '', '', '', '', '', ''],
  ['7 · Un click de baja NO es una baja', 'Clicks al destino de baja: 3,117. Bajas que reporta SFMC: 49,517. Solo el 6.3% de las bajas toca un link rastreado; el resto usa el botón nativo del buzón (List-Unsubscribe), que no es un link del correo.', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', ''],
  ['CÓMO DOBLE VALIDAR ESTA HOJA TÚ MISMO', '', '', '', '', '', '', '', '', '', ''],
  ['a · Filtra Data_Clicks por Va_En_Columna y suma Clicks_DE', 'Tiene que dar la columna del reporte con ese nombre.', '', '', '', '', '', '', '', '', ''],
  ['b · Suma TODO Clicks_DE de Data_Clicks', 'Tiene que dar 45,424, que es el total de CRM_Email_Links.', '', '', '', '', '', '', '', '', ''],
  ['c · Mira las filas con Fuente = Plataforma', 'Son los destinos que la DE no puede ver. Si esa lista crece, la DE se quedó más corta.', '', '', '', '', '', '', '', '', ''],
  ['d · Mira las filas con Clase = por_clasificar', 'Son destinos que el contrato no reconoce. Cada uno necesita una decisión, no una suposición.', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', ''],
  ['EL DICCIONARIO', '', '', '', '', '', '', '', '', '', '']
];

var COLS_DIC = ['Clase', 'Nombre', 'Familia', 'Va_En_Columna', 'Que_Es', 'Patrones_URL', 'URLs_Ejemplo', 'N_URLs', 'Clicks_DE', 'Clicks_Plataforma', 'Nota'];
var COLS_DATA = ['Pieza_ID', 'Campaña', 'TouchPoint', 'Segmento', 'Clase', 'Familia', 'Va_En_Columna', 'URL', 'N_URLs', 'Clicks_DE', 'Clicks_Plataforma', 'Fuente', 'Notas'];

console.log(NL + '  ── lo que se crea');
console.log('     Data_Clicks   ' + (M.Data_Clicks.length + 1) + ' filas × ' + COLS_DATA.length + ' columnas');
console.log('     Dic_Clicks    ' + (METODO.length + M.Dic_Clicks.length + 1) + ' filas × ' + COLS_DIC.length + ' columnas   (incluye la metodología)');
console.log(NL + '  ── la metodología que queda escrita en el libro');
METODO.filter(function (r) { return r[0] && !r[1]; }).forEach(function (r) { console.log('     ' + r[0]); });
METODO.filter(function (r) { return r[0] && r[1]; }).forEach(function (r) { console.log('     · ' + r[0]); });

DECL.declarar('rick-reportes-escritor', 'escritor.hojas-clicks.js', [
  { hoja: 'Data_Clicks', grano: 'una fila por pieza × clase × URL', llave: 'Pieza_ID + Clase + URL', celdas_esperadas: M.Data_Clicks.length + ' filas — hoja DERIVADA, se regenera entera' },
  { hoja: 'Dic_Clicks', grano: 'una fila por clase de destino', llave: 'Clase', celdas_esperadas: M.Dic_Clicks.length + ' clases + la metodología' }
]);

if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ═══════════════════════════════════════════════════════════════════
var vivo = L.archivoVivo({ dir: PROY });
var RESP = BACK + '/_respaldos/v8-antes-hojas-clicks.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log(NL + '  ── respaldo: ' + path.basename(RESP));

var TMP = os.homedir() + '/.claude/reportes-backend/nestle/_tmp/_hcl.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP, { cellStyles: true });
var hojasAntes = wb.SheetNames.slice();
// las filas de cada hoja ANTES de tocar nada — la referencia se mide en esta corrida, no se escribe
var filasAntes = {};
hojasAntes.forEach(function (n) {
  if (n === 'Data_Clicks' || n === 'Dic_Clicks') return;   // éstas son las que este paso sí reescribe
  var s = wb.Sheets[n];
  if (s && s['!ref']) filasAntes[n] = XLSX.utils.decode_range(s['!ref']).e.r + 1;
});

/* 🔴 20-sep-2026 · SE ESCRIBE POR XML, NO CON SHEETJS — Y ÉSTE FUE UN DEFECTO MÍO CARO.
 *    Aquí había `XLSX.writeFile(wb, TMP)`. La regla del proyecto lo dice sin ambigüedad («SheetJS
 *    BORRA todos los estilos de celda en cada writeFile; edita el XML con adm-zip») y la incumplí.
 *    Medido comparando el numFmt columna por columna antes y después: **56 columnas de
 *    `Report_Resumen` perdieron su formato** — las fechas a `General`, las tasas a `0.13253901`,
 *    los importes sin máscara de moneda. Este script solo tenía que añadir DOS hojas al final.
 *
 * 🔴 NINGUNA PUERTA PODÍA VERLO: comparan VALORES, y `0.13253901` y `13.3%` son el mismo valor.
 *    Lo destapó MIRAR el render, y lo confirmó `resumen.comparar-formato.js`, que ahora corre
 *    aquí mismo como parte de la verificación previa a publicar.
 */
var HX = require(BACK + '/_scripts/lib-hoja-xml.js');
var aoaData = [COLS_DATA].concat(M.Data_Clicks.map(function (f) { return COLS_DATA.map(function (c) { return f[c] === undefined ? '' : f[c]; }); }));
var aoaDic = METODO.concat([COLS_DIC]).concat(M.Dic_Clicks.map(function (d) { return COLS_DIC.map(function (c) { return d[c] === undefined ? '' : d[c]; }); }));
var res = HX.escribir(TMP, { 'Data_Clicks': aoaData, 'Dic_Clicks': aoaDic });
console.log('     ✔ ' + (res.creadas.length ? 'creadas: ' + res.creadas.join(' · ') + '   ' : '') +
  (res.reemplazadas.length ? 'reemplazadas: ' + res.reemplazadas.join(' · ') : '') +
  '   (por XML — el resto del paquete no se toca)');

// ══ LAS 5 CAPAS ════════════════════════════════════════════════════════════════════
var T = os.homedir() + '/.claude/tools/', PY = os.homedir() + '/AppData/Local/Programs/Python/Python313/python.exe', NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var r = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(r).split(NL).filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 54)); return true;
  } catch (e) { console.log('     🔴 ' + nom.padEnd(20) + t(String(e.stdout || e.message)).split(NL).pop().slice(0, 54)); return false; }
}
console.log(NL + '  ── las 5 capas');
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log(NL + '  🔴 paquete no sano: NO se publica.'); process.exit(1); }

// ══ VERIFICAR ANTES DE PUBLICAR ════════════════════════════════════════════════════
var wb2 = XLSX.readFile(TMP);
var mal = [];
hojasAntes.forEach(function (n) { if (wb2.SheetNames.indexOf(n) < 0) mal.push('desapareció la hoja ' + n); });
['Data_Clicks', 'Dic_Clicks'].forEach(function (n) { if (wb2.SheetNames.indexOf(n) < 0) mal.push('no se creó ' + n); });
var d2 = XLSX.utils.sheet_to_json(wb2.Sheets['Data_Clicks'], { defval: '', blankrows: false });
if (d2.length !== M.Data_Clicks.length) mal.push('Data_Clicks tiene ' + d2.length + ' filas y esperaba ' + M.Data_Clicks.length);
var sDE = d2.reduce(function (a, r) { return a + Number(r.Clicks_DE || 0); }, 0);
var esperado = M.Data_Clicks.reduce(function (a, r) { return a + Number(r.Clicks_DE || 0); }, 0);
if (sDE !== esperado) mal.push('Σ Clicks_DE en la hoja es ' + sDE + ' y esperaba ' + esperado);
/* 🔴 LAS FILAS DE REFERENCIA SE MIDEN, NO SE ESCRIBEN. Aquí había una lista a mano
 *    (`{ Report_Resumen: 86, Catalogo_Piezas: 130, … }`), que es una foto del día que se escribió
 *    este script. Dos formas de romperse, las dos malas: si una hoja crece por una razón legítima
 *    —y el catálogo crece cada corte— este paso se NIEGA a publicar culpando a un cambio que no
 *    hizo; y si alguien «arregla» el número para que pase, el check deja de mirar para siempre.
 *    Lo que sí prueba algo es medir las mismas hojas ANTES y DESPUÉS **en esta corrida**: eso
 *    detecta lo único que este script podría romper, que es tocar una hoja que no es suya. */
Object.keys(filasAntes).forEach(function (n) {
  if (!wb2.Sheets[n] || !wb2.Sheets[n]['!ref']) return;
  var f = XLSX.utils.decode_range(wb2.Sheets[n]['!ref']).e.r + 1;
  if (f !== filasAntes[n]) mal.push(n + ' pasó de ' + filasAntes[n] + ' a ' + f + ' filas');
});

/* 🔴 Y EL FORMATO DE `Report_Resumen` NO PUEDE MOVERSE. Éste es el check que faltaba: este mismo
 *    script arrasó 56 numFmt —fechas, porcentajes, moneda— y lo hizo durante varios cortes sin que
 *    nada lo dijera, porque las puertas comparan VALORES y un numFmt perdido no cambia ningún
 *    valor. Ahora se compara columna por columna, POR NOMBRE, entre el libro vivo y el temporal, y
 *    si algo cambió NO se publica. El formato es de Rick (E5): este paso solo agrega dos hojas. */
try {
  var CF = require(BACK + '/_scripts/resumen.comparar-formato.js');
  var fAntes = CF.formatos(vivo.ruta), fDespues = CF.formatos(TMP);
  var movidos = Object.keys(fAntes).filter(function (h) { return h in fDespues && fAntes[h] !== fDespues[h]; });
  if (movidos.length) {
    mal.push(movidos.length + ' columna(s) de Report_Resumen cambiarían de FORMATO: ' +
      movidos.slice(0, 5).map(function (h) { return h + ' (' + fAntes[h] + '→' + fDespues[h] + ')'; }).join(' · '));
  } else {
    console.log(NL + '     ✔ formato de Report_Resumen intacto: ' + Object.keys(fAntes).length + ' columnas, mismo numFmt');
  }
} catch (e) {
  // 🔴 «no pude evaluar» NO es «pasó». Se dice ruidosamente y se sigue, porque un fallo del
  //    comparador no debe impedir un corte — pero tampoco puede leerse como verde.
  console.log(NL + '     ⊘ NO PUDE comprobar el formato (' + e.message.slice(0, 80) + ') — esto NO cuenta como que esté bien');
}
console.log(NL + '  ── verificación ANTES de publicar');
console.log('     hojas: ' + hojasAntes.length + ' → ' + wb2.SheetNames.length + '   ·   Data_Clicks ' + d2.length + ' filas   ·   Σ Clicks_DE ' + mil(sDE));
console.log('     ' + (mal.length ? '🔴 ' + mal.join(' · ') : '✔ las ' + hojasAntes.length + ' hojas que ya estaban siguen intactas y el detalle cuadra'));
if (mal.length) { console.log(NL + '  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log(NL + '  ✅ Data_Clicks y Dic_Clicks EN EL LIBRO · el resto verificado');
