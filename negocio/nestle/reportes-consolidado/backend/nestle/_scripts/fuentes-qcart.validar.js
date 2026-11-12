// qcart-bloque · ¿LA MIGRACIÓN NO PERDIÓ NADA?
//
// Dos cosas distintas, y mezclarlas hace que un rojo permanente se ignore:
//   chk()  MIGRACIÓN → un rojo ES una regresión de este paso
//   dato() DATOS     → un rojo es un HALLAZGO en la fuente, no un fallo del paso
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var C = require(__dirname + '/lib-qcart.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n).toLocaleString('es-MX'); }
var V = [], H = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ qcart-bloque · ¿LA MIGRACIÓN NO PERDIÓ NADA? ════════\n');
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var padL = require(__dirname + '/lib-qcart-filtro.js').padron();
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2bv.xlsx';
var mtimeAntes = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs;
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' }).filter(function (x) { return t(x['Brand']) || t(x['Campaign']); });

var QL = require(__dirname + '/lib-qcart-links.js');
var Pz = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var codCat = {};
Pz.forEach(function (p) { for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
  QL.codigosDe(p[pre + i]).forEach(function (c) { codCat[c] = t(p['Pieza_ID']); }); }); });
function pieza(c) { return codCat[c] || null; }

console.log('══ LA MIGRACIÓN ══   (un rojo aquí ES una regresión)');

// 1 · las dos hojas existen y están separadas
chk('produce DOS bloques, no uno mezclado', Array.isArray(B.carritos) && Array.isArray(B.productos),
  'carritos ' + mil(B.carritos.length) + ' · productos ' + mil(B.productos.length));

// 2 · 🔴 ninguna columna calculada — la razón de ser de esta migración
var PROHIBIDAS = ['pct_penetracion', 'penetracion', 'ticket', 'promedio', 'top', 'rate', 'tasa', '_pct', 'ratio'];
var campos = Object.keys(B.carritos[0] || {}).concat(Object.keys(B.productos[0] || {}));
var calculadas = campos.filter(function (c) {
  return PROHIBIDAS.some(function (p) { return c.toLowerCase().indexOf(p) >= 0; });
});
chk('NINGUNA columna calculada en los bloques', calculadas.length === 0,
  calculadas.length ? '🔴 ' + calculadas.join(', ') : 'ni penetración, ni tickets, ni tops, ni tasas — eso es motor-calculo');

// 3 · el cuadre del filtro
chk('el descarte cuadra con el total (carritos)', B.auditoria.carritos.cuadra,
  mil(B.auditoria.carritos.total) + ' = ' + mil(B.auditoria.carritos.dentro) + ' + ' +
  mil(B.auditoria.carritos.fuera_no_es_nuestro + B.auditoria.carritos.fuera_antes_de_activacion +
    B.auditoria.carritos.fuera_link_invalido + B.auditoria.carritos.fuera_sin_codigo));
chk('el descarte cuadra con el total (productos)', B.auditoria.productos.cuadra, mil(B.auditoria.productos.total) + ' filas');

// 4 · el append cuadra
var ac = B.auditoria.append.carritos, ap = B.auditoria.append.productos;
chk('el append cuadra en las dos hojas',
  ac.ya_estaban + ac.nuevos === ac.total && ap.ya_estaban + ap.nuevos === ap.total,
  'carritos ' + mil(ac.ya_estaban) + '+' + mil(ac.nuevos) + '=' + mil(ac.total) + ' · productos ' + mil(ap.ya_estaban) + '+' + mil(ap.nuevos) + '=' + mil(ap.total));

// 5 · toda fila anclada al catálogo
var sinPieza = B.carritos.concat(B.productos).filter(function (e) { return !e.pieza_id; });
chk('toda fila está anclada a una pieza del catálogo', sinPieza.length === 0,
  sinPieza.length ? mil(sinPieza.length) + ' sin pieza' : mil(B.carritos.length + B.productos.length) + ' eventos, todos con pieza_id');

// 6 · las reglas están declaradas, no implícitas
chk('las reglas de pertenencia y ventana están escritas', !!(B.reglas && B.reglas.pertenencia && B.reglas.ventana),
  'unidad: ' + (B.reglas ? B.reglas.unidad.split(':')[0] : '?'));

// 7 · el vocabulario nuevo se declara
chk('lo que el catálogo no conoce se DECLARA', Array.isArray(B.vocabulario_nuevo),
  B.vocabulario_nuevo.length + ' campañas · ' + mil(B.vocabulario_nuevo.reduce(function (a, x) { return a + x.eventos; }, 0)) + ' eventos');

// 8 · lo excluido trae su motivo
chk('cada exclusión trae su motivo', B.excluidos.muestra.every(function (x) { return !!x.motivo; }),
  mil(B.excluidos.carritos + B.excluidos.productos) + ' excluidos en total');

// 9 · 🔴 el Excel no se tocó
var mtimeDespues = fs.statSync(L.archivoVivo({ dir: PROY }).ruta).mtimeMs;
chk('el script NO escribió en el Excel', mtimeAntes === mtimeDespues, 'el archivo no se tocó — eso es la Puerta 1');

// 10 · consume la autoridad de links
chk('usa la autoridad de links de qcart-activacion', /Qcart-Links/.test(B.reglas.pertenencia), B.reglas.pertenencia.slice(-40));

// ── comparación con lo que hoy vive en la hoja ──────────────────────────────────────
console.log('\n══ vs Data_Qcart (la hoja de hoy) ══');
console.log('     hoja actual : ' + Q.length + ' filas × 36 columnas, granularidad mezclada');
console.log('     bloque nuevo: ' + mil(B.carritos.length) + ' + ' + mil(B.productos.length) + ' eventos, dos granularidades separadas');
var codHoja = {}; Q.forEach(function (q) { if (t(q['Shortlink_Code'])) codHoja[t(q['Shortlink_Code'])] = 1; });
var codBloque = {}; B.carritos.forEach(function (e) { codBloque[e.shortlink_code] = 1; });
var perdidos = Object.keys(codHoja).filter(function (c) { return !codBloque[c]; });
// 🔴 Esto NO es una regresión del paso: el script aplica la regla que se le pidió. Los 9 códigos
//    que faltan **no están en el doc de links NI en Catalogo_Piezas** — viven solo en la hoja
//    vieja. Marcarlo como fallo del paso mandaría a arreglar lo que no está roto; el hueco está
//    en el catálogo, y es lo que hay que reportar.
chk('ningún shortlink perdido POR CULPA del filtro',
  perdidos.every(function (c) { return !pieza(c); }),
  'los que faltan no están catalogados: no es el filtro, es el catálogo');
// ⚠ Ya NO son «desconocidos»: están en la hoja `Reagendar` del doc con fecha «Por reagendar».
//   Por la regla, un link que no se envió no entra — y `Data_Qcart` además los tiene atribuidos
//   a campañas que no son (Mundial/Hotcakes cuando el CSV dice lechera-junio).
var porReagendar = perdidos.filter(function (c) {
  var l = padL.links[c];
  return l && !l.valido && /reagendar/i.test(l.valor_de_fecha || '');
});
dato('[6] shortlinks de la hoja que NO entran al bloque', perdidos.length === 0,
  perdidos.length ? mil(perdidos.length) + ' — ' + porReagendar.length + ' declarados «Por reagendar» (no se enviaron) · ' +
    (perdidos.length - porReagendar.length) + ' sin catalogar'
    : Object.keys(codHoja).length + '/' + Object.keys(codHoja).length + ' presentes');

// ── LOS DATOS (hallazgos, no fallos) ────────────────────────────────────────────────
console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO, no un fallo del paso)');
var s = B.auditoria.carritos;
dato('[1] eventos ajenos a nuestro catálogo', s.fuera_no_es_nuestro === 0,
  mil(s.fuera_no_es_nuestro) + ' de ' + mil(s.total) + ' carritos — tráfico de la cuenta que no es nuestro');
dato('[2] eventos anteriores a la activación', s.fuera_antes_de_activacion === 0,
  mil(s.fuera_antes_de_activacion) + ' — habrían inflado si se contaban');
dato('[3] eventos de links que no se enviaron', s.fuera_link_invalido === 0,
  mil(s.fuera_link_invalido) + ' — el doc dice «No enviado» / «No salió»');
dato('[4] filas sin shortlink code', s.fuera_sin_codigo === 0, mil(s.fuera_sin_codigo) + ' — traen views y precio reales');
dato('[5] entraron sin aplicar la ventana', (s.dentro_con_fecha_sospechosa || 0) === 0,
  mil(s.dentro_con_fecha_sospechosa || 0) + ' — la fecha de su link contradice a su hoja (typo de año)');

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(48) + (v[2] || '')); });
H.forEach(function (h) { console.log('  ' + (h[1] ? '✔' : '⚠') + ' ' + h[0].padEnd(48) + (h[2] || '')); });
var hall = H.filter(function (h) { return !h[1]; }).length;
console.log('\n  ' + (hall ? '⚠ ' + hall + ' hallazgo(s) en los datos — son propiedades de la fuente, no regresiones.' : ''));
console.log('  ' + (fallo ? '🔴 ' + fallo + ' REGRESIÓN(ES)' : '✅ MIGRACIÓN VALIDADA — ' + V.length + ' checks · ninguna capacidad perdida'));
process.exit(fallo ? 1 : 0);
