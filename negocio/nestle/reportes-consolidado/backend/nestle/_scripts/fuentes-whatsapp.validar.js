// whatsapp-bloque · ¿LA MIGRACIÓN NO PERDIÓ NADA?
//   chk()  MIGRACIÓN → un rojo ES una regresión de este paso
//   dato() DATOS     → un rojo es un HALLAZGO en la fuente, no un fallo del paso
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'whatsapp';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var W = require(__dirname + '/lib-whatsapp.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = W.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ whatsapp-bloque · ¿LA MIGRACIÓN NO PERDIÓ NADA? ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8'));
var R = W.leer(inv.forma.whatsapp.ruta);
var mtimeAntes = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs;
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2cv.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
// ⚠ contar las filas por `BU` deja fuera las que legítimamente no lo traen: la fuente de Maggi
//   y la de ICE no tienen columna de BU, y sus 6 filas quedaban invisibles. El check decía
//   «la hoja tiene 7 envíos» sobre una hoja de 13, y hacía ver un hueco el doble de grande.
//   Una fila cuenta si tiene CUALQUIER celda con contenido.
var D = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Data_WhatsApp'], { defval: '' })
  .filter(function (x) { return Object.keys(x).some(function (k) { return t(x[k]); }); });

console.log('══ LA MIGRACIÓN ══   (un rojo aquí ES una regresión)');

// 1 · ninguna columna calculada
var PROHIB = ['delivery_rate', 'read_rate', 'ctor', 'pct_', '_rate', 'tasa', 'ratio', 'promedio'];
var campos = Object.keys(B.envios[0] || {});
var calc = campos.filter(function (c) { return PROHIB.some(function (p) { return c.toLowerCase().indexOf(p) >= 0; }); });
chk('NINGUNA columna calculada en el bloque', calc.length === 0,
  calc.length ? '🔴 ' + calc.join(', ') : 'Delivery_Rate, Read_Rate, CTOR y Pct_Error se fueron a motor-calculo');

// 2 · 🔴 no se pierde ni un envío de la fuente
chk('los envíos de la fuente entran TODOS', B.envios.length === R.envios.length,
  B.envios.length + ' de ' + R.envios.length + ' · sin los subtotales');

// 3 · los subtotales se excluyen Y se declaran
chk('las filas de subtotal se excluyen', B.subtotales_excluidos.length > 0,
  B.subtotales_excluidos.length + ' excluidas · ' + mil(B.auditoria.sends_que_se_habrian_duplicado) + ' sends que se habrían duplicado');
chk('cada subtotal se confirma con la ARITMÉTICA, no con la palabra',
  B.subtotales_excluidos.every(function (s) { return typeof s.cuadra === 'boolean' && s.suma_de_las_de_arriba !== undefined; }),
  B.subtotales_excluidos.filter(function (s) { return s.cuadra; }).length + '/' + B.subtotales_excluidos.length + ' cuadran con la suma de arriba');

// 4 · 🔴 los clicks derivados NO se cargan como medición
var mentira = B.envios.filter(function (e) { return e.clicks_medidos === 'No' && e.clicks !== null; });
chk('ningún click DERIVADO se carga como medición', mentira.length === 0,
  mentira.length ? '🔴 ' + mentira.length + ' con clicks derivados cargados' :
    B.auditoria.clicks_no_medidos + ' envíos con clicks=null y su motivo escrito');
chk('los no medidos dicen POR QUÉ', B.envios.filter(function (e) { return e.clicks_medidos === 'No'; }).every(function (e) { return !!e.clicks_nota; }),
  'cada uno cita el factor del supuesto');

// 5 · el append cuadra
chk('el append cuadra', B.auditoria.cuadre_append,
  B.auditoria.ya_estaban + ' + ' + B.auditoria.nuevos + ' = ' + B.auditoria.envios);

// 6 · la llave no pierde envíos dentro del lote
var lls = {}; var dup = 0;
R.envios.forEach(function (e) { var k = W.llaveEnvio(e); if (lls[k]) dup++; lls[k] = 1; });
chk('la llave distingue todos los envíos de la fuente', dup === 0,
  dup ? dup + ' comparten llave → se perderían' : Object.keys(lls).length + ' llaves para ' + R.envios.length + ' envíos');

// 7 · ninguna hoja de la fuente se saltó
// 🔴 ESTE CHECK ESTABA MAL, y bloqueaba sin razón: exigía «5 hojas» fijas cuando la fuente hoy
//    tiene 4 (Hotcakes · Maggi Mundial · Tercer Tiempo · ICE). El equipo cambia esa fuente a mano,
//    así que el número NO se fija: se DESCUBRE del archivo y se compara. Es la regla que el propio
//    auditor vigila —«ningún guardián fija hojas que debería descubrir»— y que aquí no se aplicó.
//    Un guardián equivocado que bloquea cuesta tiempo; el que da permiso cuesta datos. Los dos son
//    el mismo defecto: medir contra algo escrito en vez de contra la realidad.
var hojasFuente = (R.hojas_del_archivo || R.hojas || []).map(function (h) { return t(h.hoja || h.nombre || h); }).filter(Boolean);
var hojasLeidas = B.hojas.map(function (h) { return t(h.hoja); });
var saltadas = hojasFuente.filter(function (h) { return hojasLeidas.indexOf(h) < 0; });
chk('ninguna hoja de la fuente se saltó', saltadas.length === 0,
  hojasLeidas.length + ' hoja(s) leída(s): ' + B.hojas.map(function (h) { return t(h.hoja).slice(0, 7) + ':' + (h.envios || 0); }).join(' · ') +
  (saltadas.length ? '   🔴 saltadas: ' + saltadas.join(', ') : ''));
// y ninguna hoja leída puede quedarse en cero sin decir por qué
/* 🔴 «EN CERO CON MOTIVO» NO ES LO MISMO QUE «EN CERO». El check exigía que toda hoja aportara
 *    envíos, y al aparecer `BAU 2025 Nescafé` —una ficha vertical de 2025, sin tabla de envíos—
 *    se puso rojo. Rojo correcto: una hoja leída que no aporta nada es, por defecto, un envío
 *    perdido. Pero la salida NO es una lista de hojas permitidas, que callaría también a la hoja
 *    futura que sí traiga envíos y se lea mal. Lo que se exige es la RAZÓN, derivada de la
 *    evidencia por el lector (`motivo_cero`): cuántos bloques tenía y por qué ninguno era una
 *    tabla de envíos. Sin razón escrita, sigue siendo rojo. */
var enCero = B.hojas.filter(function (h) { return !(h.envios > 0); });
var ceroSinMotivo = enCero.filter(function (h) { return !t(h.motivo_cero); });
chk('ninguna hoja leída quedó en cero sin motivo', ceroSinMotivo.length === 0,
  ceroSinMotivo.length ? '🔴 ' + ceroSinMotivo.map(function (h) { return t(h.hoja); }).join(', ')
    : (enCero.length ? enCero.length + ' en cero, todas con su razón escrita: ' + enCero.map(function (h) { return t(h.hoja); }).join(', ')
      : 'las ' + hojasLeidas.length + ' aportaron envíos'));

// 8 · lo que no se pudo atribuir trae su motivo
var sinP = B.envios.filter(function (e) { return !e.pieza_id; });
chk('todo envío sin pieza trae su motivo', sinP.every(function (e) { return !!e.motivo_sin_pieza; }),
  sinP.length + ' sin pieza, todos con motivo');
chk('los ambiguos traen sus candidatas',
  sinP.filter(function (e) { return e.via_atribucion === 'AMBIGUA'; }).every(function (e) { return (e.candidatas || []).length > 1; }),
  sinP.filter(function (e) { return e.via_atribucion === 'AMBIGUA'; }).length + ' ambiguos, con candidatas');

// 9 · el Excel no se tocó
chk('el script NO escribió en el Excel', mtimeAntes === fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs,
  'el archivo no se tocó — eso es la Puerta 1');

// 10 · lo que la hoja de hoy sí tiene, el bloque lo tiene
//
// 🔴 «se perdió» y «se quitó a propósito» no son lo mismo, y el check tiene que separarlos o
//    bloquea para siempre cada vez que el lector aprende a excluir algo. Lo que hace ilegítima
//    una desaparición no es que ocurra: es que ocurra EN SILENCIO. Así que una fila de la hoja
//    puede faltar del bloque solo si está declarada en `excluidos_por_solape` o en
//    `subtotales_excluidos`, con la aritmética que lo prueba. Si no está en ninguna lista, es
//    una pérdida y se pone rojo.
var declarados = {};
(B.excluidos_por_solape || []).forEach(function (e) { declarados[String(e.sends)] = 'solape'; });
(B.subtotales_excluidos || []).forEach(function (s) { declarados[String(s.sends_de_la_fila)] = 'subtotal'; });

var enHoja = {}; D.forEach(function (r) { enHoja[t(r['Campaña']) + '¦' + t(r['Sends'])] = 1; });
var faltan = Object.keys(enHoja).filter(function (k) {
  var s = k.split('¦')[1];
  return !B.envios.some(function (e) { return String(e.sends) === s; });
});
var perdidos = faltan.filter(function (k) { return !declarados[k.split('¦')[1]]; });
var quitados = faltan.filter(function (k) { return declarados[k.split('¦')[1]]; });
chk('ninguna fila de Data_WhatsApp desapareció EN SILENCIO', perdidos.length === 0,
  perdidos.length ? '🔴 ' + perdidos.join(' · ')
    : (quitados.length ? quitados.length + ' quitada(s) A PROPÓSITO y declarada(s): ' +
      quitados.map(function (k) { return k + '→' + declarados[k.split('¦')[1]]; }).join(' · ')
      : D.length + '/' + D.length + ' presentes en el bloque'));

// ── LOS DATOS ───────────────────────────────────────────────────────────────────────
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
var sHoja = D.reduce(function (a, r) { return a + (Number(String(r['Sends']).replace(/[, ]/g, '')) || 0); }, 0);
dato('[1] la hoja está al día con la fuente', D.length === B.envios.length,
  'hoja ' + D.length + ' envíos (' + mil(sHoja) + ' sends) · fuente ' + B.envios.length + ' (' + mil(B.auditoria.sends_total) + ') → faltan ' + mil(B.auditoria.sends_total - sHoja));
dato('[2] todos los envíos tienen pieza', B.auditoria.sin_pieza === 0,
  B.auditoria.sin_pieza + ' sin pieza — las 10 piezas WA de Mundial están vacías (sends=0) y no hay piezas de ICE');
dato('[3] todos los clicks están medidos', B.auditoria.clicks_no_medidos === 0,
  B.auditoria.clicks_no_medidos + ' derivados de un CTOR asumido — no son medición');
dato('[4] la fuente no trae filas de subtotal', B.subtotales_excluidos.length === 0,
  B.subtotales_excluidos.length + ' filas «Totales» que duplicarían ' + mil(B.auditoria.sends_que_se_habrian_duplicado) + ' sends');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
H.forEach(function (h) { console.log('  ' + (h[1] ? '✔' : '⚠') + ' ' + h[0].padEnd(50) + (h[2] || '')); });
var hall = H.filter(function (h) { return !h[1]; }).length;
console.log('\n  ' + (hall ? '⚠ ' + hall + ' hallazgo(s) en los datos — propiedades de la fuente, no regresiones.' : ''));
console.log('  ' + (fallo ? '🔴 ' + fallo + ' REGRESIÓN(ES)' : '✅ MIGRACIÓN VALIDADA — ' + V.length + ' checks · ninguna capacidad perdida'));
process.exit(fallo ? 1 : 0);
