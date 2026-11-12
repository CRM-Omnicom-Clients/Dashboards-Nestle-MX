/*
 * catalogo.nombrar-whatsapp.js — le da NOMBRE a las piezas de WhatsApp.
 *
 * 🔴 RICK, 15-sep-2026: «de WhatsApp deberíamos tener una especie de Whatsapp Name»; y para las
 *    campañas cuya hoja no lo trae: «sácalo o crea reglas para la nomenclatura y asígnalo… y que
 *    sean IDs únicos, todo bien estructurado».
 *
 * QUÉ CREA, y por qué con esa forma exacta. Tres columnas, espejo de las que email ya tiene:
 *      Email_Name      Email_Names_Variantes      N_Email_Names
 *      Whatsapp_Name   Whatsapp_Names_Variantes   N_Whatsapp_Names
 *    Misma forma a propósito: así el sistema aprende UNA regla y no dos. Y hace falta el trío
 *    entero, no solo la primera, porque `005-P011` tiene DOS journeys en una sola pieza (4PM y
 *    5PM) — el maestro da un único shortlink para `wa-j8` y los carritos de un link no se pueden
 *    repartir. Con una sola columna, esa pieza no cabría sin perder un nombre.
 *
 * 🔴 SE CREAN AL FINAL, NUNCA INTERCALADAS. Insertar una columna en medio corre todas las de la
 *    derecha y rompe cualquier fórmula o referencia que apunte por letra.
 *
 * 🔴 SE ESCRIBE UNA VEZ (E1). El nombre se calcula para las 18, se prueban las tres condiciones
 *    sobre el conjunto —único, estable, legible— y solo entonces se toca el archivo. Si la prueba
 *    de unicidad falla, no se escribe nada: un nombre repetido no es una llave.
 *
 * 🔴 Y NO PISA NADA. Solo escribe en celdas vacías de las columnas nuevas. Si una corrida anterior
 *    ya puso un nombre, se respeta y se declara — el que manda es el archivo, no este script.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var NOM = require(__dirname + '/lib-whatsapp-nombre.js');
var DECL = require(__dirname + '/lib-declaracion-escritura.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var NL = String.fromCharCode(10);
var HOJA = 'Catalogo_Piezas';
function letra(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }

var NUEVAS = ['Whatsapp' + '_Name', 'Whatsapp' + '_Names_Variantes', 'N_Whatsapp' + '_Names'];

console.log('════════ nestle-catalogo · NOMBRAR LAS PIEZAS DE WHATSAPP ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════' + NL);

var vivo = L.archivoVivo({ dir: PROY });
var TMP = require('path').resolve(__dirname, '..') + '/_tmp/_wanom.xlsx';
fs.copyFileSync(vivo.ruta, TMP);
var wb = XLSX.readFile(TMP);
var ws = wb.Sheets[HOJA];
var rng = XLSX.utils.decode_range(ws['!ref']);
var enc = [];
for (var c = rng.s.c; c <= rng.e.c; c++) { var e = ws[XLSX.utils.encode_cell({ r: 0, c: c })]; enc[c] = e ? t(e.v) : ''; }
var P = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
var nmP = COL.de(P, 'Pieza' + '_ID');
var NM_CANAL = 'Canal', NM_CAMP = 'Camp' + 'aña', NM_TP = 'Touch' + 'Point',
    NM_SEG = 'Segm' + 'ento', NM_SUB = 'Subsegm' + 'ento', NM_EST = 'Est' + 'ado';

console.log('  libro: ' + path.basename(vivo.ruta) + '   ·   ' + P.length + ' piezas   ·   ' + enc.filter(Boolean).length + ' columnas');

// ── qué journeys le atribuyó el bloque a cada pieza ────────────────────────────────
var B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8'));
var porPieza = {}, utmPorPieza = {};
(B.envios || []).forEach(function (ev) {
  var id = t(ev.pieza_id); if (!id) return;
  if (t(ev.journey)) (porPieza[id] = porPieza[id] || []).push(t(ev.journey));
  if (t(ev.utm_content) && !utmPorPieza[id]) utmPorPieza[id] = t(ev.utm_content);
});

// ── el cálculo, para las 18 ────────────────────────────────────────────────────────
var wa = P.map(function (p, i) { return { p: p, fila: i + 2 }; })
  .filter(function (x) { return /whatsapp/i.test(t(x.p[NM_CANAL])) && t(x.p[nmP]); });

var asignados = wa.map(function (x) {
  var id = t(x.p[nmP]);
  var r = NOM.nombrar({
    campana: t(x.p[NM_CAMP]), touchpoint: t(x.p[NM_TP]),
    segmento: t(x.p[NM_SEG]), subsegmento: t(x.p[NM_SUB])
  }, porPieza[id] || [], { utm_content: utmPorPieza[id] });
  return {
    pieza_id: id, fila: x.fila, tp: t(x.p[NM_TP]), camp: t(x.p[NM_CAMP]),
    estado: t(x.p[NM_EST]), nombre: r.nombre, variantes: r.variantes, n: r.n, nivel: r.nivel, via: r.via
  };
});

console.log(NL + '  ── los nombres, por nivel de la regla');
[1, 2, 3].forEach(function (niv) {
  var g = asignados.filter(function (a) { return a.nivel === niv; });
  if (!g.length) return;
  console.log(NL + '     NIVEL ' + niv + ' · ' + NOM.NIVELES[niv] + '   (' + g.length + ')');
  g.forEach(function (a) {
    console.log('        ' + a.pieza_id.padEnd(10) + a.camp.slice(0, 14).padEnd(16) + a.tp.slice(0, 12).padEnd(14) + a.nombre.slice(0, 52));
    if (a.variantes.length) console.log('        ' + ''.padEnd(40) + '↳ variante(s): ' + a.variantes.map(function (v) { return v.slice(-42); }).join(' | '));
  });
});

// ── 🔴 LAS TRES CONDICIONES, sobre el conjunto ─────────────────────────────────────
var pr = NOM.probar(asignados);
console.log(NL + '  ── la prueba');
console.log('     ' + (pr.ok ? '✔' : '🔴') + ' único · estable · legible     ' + pr.distintos + ' nombre(s) distintos para ' + asignados.length + ' piezas');
pr.fallos.forEach(function (f) { console.log('        🔴 ' + f); });
if (!pr.ok) { console.log(NL + '  🔴 NO se escribe: un nombre repetido no es una llave.'); process.exit(1); }

// 🔴 y que no choquen con un Email_Name existente — son el mismo espacio de identidad
var NM_EN = COL.de(P, 'Email' + '_Name');
// 🔴 LA PIEZA NO CHOCA CONSIGO MISMA. La primera versión de este check no excluía la propia fila
//    y marcó en rojo a `006-P003`: esa pieza de WhatsApp guardaba su journey en `Email_Name`
//    —porque hasta hoy no había dónde más— así que su `Whatsapp_Name` sale idéntico. Eso no es una
//    colisión, es la MISMA pieza diciendo el mismo nombre por dos columnas, que es justo lo que
//    este paso viene a ordenar. Chocar solo puede ser con OTRA pieza.
var choca = [], mismaCelda = [];
asignados.forEach(function (a) {
  P.forEach(function (p) {
    var en = t(p[NM_EN]); if (!en || /^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(en)) return;
    var otra = t(p[nmP]);
    en.split(/\s*[·|]\s*/).map(t).forEach(function (n) {
      if (!n || n !== a.nombre) return;
      if (otra === a.pieza_id) mismaCelda.push(otra);
      else choca.push(a.pieza_id + ' choca con el Email_Name de ' + otra);
    });
  });
});
console.log('     ' + (choca.length ? '🔴 ' + choca.join(' · ') : '✔ ninguno choca con el Email_Name de OTRA pieza'));
if (mismaCelda.length) console.log('     · ' + mismaCelda.length + ' pieza(s) ya tenían su journey en `Email_Name` porque no había otra columna: ' + mismaCelda.join(' ') + '   (misma pieza, no es choque)');
if (choca.length) process.exit(1);

// ── el plan de escritura ───────────────────────────────────────────────────────────
var faltan = NUEVAS.filter(function (n) { return enc.indexOf(n) < 0; });
console.log(NL + '  ── el plan');
console.log('     columnas que se crean al final: ' + (faltan.length ? faltan.join(' · ') : 'ninguna (ya existen)'));
console.log('     celdas a escribir: ' + (asignados.length * 3) + '   (' + asignados.length + ' piezas × 3 columnas)');

DECL.declarar('nestle-catalogo', 'catalogo.nombrar-whatsapp.js', [{
  hoja: HOJA, grano: 'una CELDA — pieza × columna',
  llave: 'Pieza_ID + nombre de columna',
  celdas_esperadas: (asignados.length * 3) + ' celdas en 3 columnas nuevas; ninguna celda existente se pisa'
}]);

if (!ESCRIBIR) { console.log(NL + '  (seco. Para escribir: --escribir)'); process.exit(0); }

// ══ LA ESCRITURA ═══════════════════════════════════════════════════════════════════
var RESP = BACK + '/_respaldos/v8-antes-nombrar-wa.xlsx';
fs.copyFileSync(vivo.ruta, RESP);
console.log(NL + '  ── respaldo: ' + path.basename(RESP));

var zip = new AdmZip(TMP);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === HOJA) parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
if (!parte) { console.log('  🔴 no pude resolver la parte XML'); process.exit(1); }
var xml = zip.readAsText(parte);

// 1 · los encabezados de las columnas nuevas, AL FINAL
var ultima = -1; enc.forEach(function (h, i) { if (h) ultima = Math.max(ultima, i); });
var idx = {};
NUEVAS.forEach(function (nom) {
  var ya = enc.indexOf(nom);
  if (ya >= 0) { idx[nom] = ya; return; }
  ultima++; idx[nom] = ultima;
  var ref = letra(ultima) + '1';
  // el estilo se hereda del encabezado de al lado — el formato lo edita Rick, no se inventa
  xml = CX.poner(xml, ref, CX.celda(ref, nom, CX.estiloDe(xml, letra(ultima - 1) + '1')), 1).xml;
});
if (faltan.length) console.log('     ➕ columnas creadas: ' + faltan.map(function (n) { return n + ' (' + letra(idx[n]) + ')'; }).join(' · '));

// 2 · las celdas
var escritas = 0, respetadas = 0;
asignados.forEach(function (a) {
  var valores = {};
  valores[NUEVAS[0]] = a.nombre;
  valores[NUEVAS[1]] = a.variantes.length ? a.variantes.join(' · ') : 'N/A';
  valores[NUEVAS[2]] = String(a.n);
  NUEVAS.forEach(function (nom) {
    var ref = letra(idx[nom]) + a.fila;
    var actual = ws[ref] ? t(ws[ref].v) : '';
    if (actual !== '') { respetadas++; return; }          // 🔴 no se pisa nada
    xml = CX.poner(xml, ref, CX.celda(ref, valores[nom], CX.estiloDe(xml, letra(idx[nom] - 1) + a.fila)), a.fila).xml;
    escritas++;
  });
});
// 3 · el rango de la hoja tiene que crecer o Excel no ve las columnas nuevas
xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (_, c1, r1, c2, r2) {
  return '<dimension ref="' + c1 + r1 + ':' + letra(ultima) + r2 + '"/>';
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(TMP);
console.log('     ✔ ' + escritas + ' celdas escritas' + (respetadas ? '   ·   ' + respetadas + ' respetadas (ya tenían valor)' : ''));

// ══ LAS 5 CAPAS ════════════════════════════════════════════════════════════════════
var T = require(__dirname + '/lib-entorno.js').TOOLS + '/', PY = require(__dirname + '/lib-entorno.js').PYTHON, NODE = process.execPath;
function capa(nom, cmd, args) {
  try { var rr = cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('     ✔ ' + nom.padEnd(20) + (t(rr).split(NL).filter(function (y) { return t(y); }).pop() || 'ok').slice(0, 54)); return true;
  } catch (er) { console.log('     🔴 ' + nom.padEnd(20) + t(String(er.stdout || er.message)).split(NL).pop().slice(0, 54)); return false; }
}
console.log(NL + '  ── las 5 capas');
if (!capa('xlsx-safe-save', NODE, [T + 'xlsx-safe-save.js', TMP])) { console.log(NL + '  🔴 paquete no sano: NO se publica.'); process.exit(1); }

// ══ VERIFICAR ANTES DE PUBLICAR ════════════════════════════════════════════════════
var P2 = XLSX.utils.sheet_to_json(XLSX.readFile(TMP).Sheets[HOJA], { defval: '', blankrows: false });
var mal = [];
if (P2.length !== P.length) mal.push('las filas cambiaron: ' + P.length + ' → ' + P2.length);
asignados.forEach(function (a) {
  var f = P2.filter(function (q) { return t(q[nmP]) === a.pieza_id; })[0];
  if (!f) { mal.push(a.pieza_id + ': desapareció'); return; }
  if (t(f[NUEVAS[0]]) !== a.nombre) mal.push(a.pieza_id + ': el nombre no quedó («' + t(f[NUEVAS[0]]).slice(0, 30) + '»)');
});
// y ninguna pieza que NO es de WhatsApp recibió nombre
var invadidas = P2.filter(function (q) { return !/whatsapp/i.test(t(q[NM_CANAL])) && t(q[NUEVAS[0]]); }).length;
if (invadidas) mal.push(invadidas + ' pieza(s) que no son de WhatsApp recibieron nombre');
console.log(NL + '  ── verificación ANTES de publicar');
console.log('     piezas: ' + P.length + ' → ' + P2.length + '   ·   con Whatsapp_Name: ' + P2.filter(function (q) { return t(q[NUEVAS[0]]); }).length);
console.log('     ' + (mal.length ? '🔴 ' + mal.slice(0, 5).join(' · ') : '✔ las ' + asignados.length + ' quedaron con su nombre, y ninguna otra pieza fue tocada'));
if (mal.length) { console.log(NL + '  🔴 NO se publica.'); process.exit(1); }

fs.copyFileSync(TMP, vivo.ruta);
console.log('     → publicado a ' + path.basename(vivo.ruta));
capa('xlsx-label', NODE, [T + 'xlsx-label.js', vivo.ruta]);
capa('xlsx-check', NODE, [T + 'xlsx-check.js', vivo.ruta]);
capa('xlsx-validar-fondo', PY, [T + 'xlsx-validar-fondo.py', vivo.ruta]);
capa('xlsx-orden-celdas', NODE, [T + 'xlsx-orden-celdas.js', vivo.ruta]);
console.log(NL + '  ✅ ' + asignados.length + ' PIEZAS DE WHATSAPP CON NOMBRE · ' + pr.distintos + ' nombres distintos, ninguno repetido');
