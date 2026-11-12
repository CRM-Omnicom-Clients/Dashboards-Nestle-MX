var ENT = require(__dirname + '/lib-entorno.js');
// lib-flexible.js — lo que permite que el sistema absorba datos nuevos sin romperse.
//
// EL PRINCIPIO, en una línea:
//     FLEXIBLE en lo que ENTRA · ESTRICTO en el OBJETIVO.
//
// Un check contra una CONSTANTE (`piezas === 96`, `Σ === 6,454,554`) se rompe con el próximo
// corte y obliga a editar código para cargar datos. Un check contra un INVARIANTE (`toda pieza
// tiene id único`, `Σ catálogo == Σ fuente`) nunca caduca y sigue atrapando el error real.
//
// Aquí viven las tres cosas que la auditoría encontró clavadas en 47 sitios:
//   1 · el archivo vivo, escrito con su versión  → se RESUELVE, no se declara
//   2 · los meses, listados hasta agosto          → se RECONOCEN los 12, y lo raro se declara
//   3 · las métricas, en lista fija               → se DESCUBREN de la fuente, y lo nuevo se avisa
var fs = require('fs'), os = require('os'), path = require('path');

function t(v) { return String(v == null ? '' : v).trim(); }
function nmz(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// 🔴 LA NORMALIZADORA DE ENCABEZADOS — y NO es la misma que la de dimensiones.
//    Son dos trabajos distintos que se venían confundiendo, y confundirlos ya costó un defecto:
//      · `lib-alias.nm`   quita TODO separador  → «moderncooking». Resuelve DIMENSIONES contra
//        el catálogo, donde «Modern Cooking», «ModernCooking» y «modern-cooking» son el mismo.
//      · ésta            CONSERVA separadores  → «fecha de envio». Casa ENCABEZADOS contra el
//        diccionario de sinónimos, que está escrito con espacios.
//    Usar la de dimensiones aquí ROMPE la lectura: «Fecha de envío» daría «fechadeenvio» y no
//    casaría con el sinónimo «fecha de envio». El ancla de WhatsApp tenía el error al revés:
//    usaba ésta para resolver dimensiones, y por eso difería del oficial en 10 de 14 casos.
//    Las cinco copias idénticas de esta función viven ahora aquí, y las demás la llaman.
function nmEncabezado(s) { return nmz(s); }

// ══ 1 · EL ARCHIVO VIVO ═════════════════════════════════════════════════════════════
// Estaba clavado como '(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx' en 31 sitios. El día
// que exista una v9, los 31 apuntan a un archivo muerto —y peor: siguen corriendo sobre el
// viejo sin avisar—. Se resuelve por patrón y se toma el MÁS RECIENTE, ignorando respaldos.
function archivoVivo(opts) {
  opts = opts || {};
  var dir = opts.dir || (ENT.PROYECTO);
  var pat = opts.patron || 'consolidado';
  var cand = [];
  fs.readdirSync(dir).forEach(function (f) {
    if (f.slice(-5) !== '.xlsx' || f.indexOf('~$') === 0) return;
    var n = nmz(f);
    if (n.indexOf(nmz(pat)) < 0) return;
    if (/backup|respaldo|copia|draft|borrar|old/.test(n)) return;      // respaldos, nunca el vivo
    var p = path.join(dir, f);
    cand.push({ ruta: p, archivo: f, mtime: fs.statSync(p).mtimeMs, version: (/-v(\d+)/i.exec(f) || [])[1] || null });
  });
  if (!cand.length) throw new Error('no encontré el archivo vivo con patrón «' + pat + '» en ' + dir);
  // el más reciente manda; la versión del nombre solo desempata, nunca decide sola
  cand.sort(function (a, b) { return b.mtime - a.mtime; });
  var vivo = cand[0];
  vivo.otros = cand.slice(1).map(function (c) { return c.archivo; });
  vivo.ambiguo = cand.length > 1 && Math.abs(cand[0].mtime - cand[1].mtime) < 60000;
  return vivo;
}

// ══ 2 · LOS MESES ═══════════════════════════════════════════════════════════════════
// Estaba `MESN = { marzo:'03' … agosto:'08' }` en 13 sitios. En septiembre esos 13 dejan de
// reconocer la hoja del mes **y no fallan**: simplemente devuelven null y la fila se trata como
// fragmento de otro mes. Un envío entero desaparece sin un solo error en pantalla.
// Cubrir los 12 no es rigidez: es completitud. La rigidez era cubrir seis.
var MES = {};
['enero,jan,january', 'febrero,feb,february', 'marzo,mar,march', 'abril,apr,april',
  'mayo,may', 'junio,jun,june', 'julio,jul,july', 'agosto,ago,aug,august',
  'septiembre,setiembre,sep,sept,september', 'octubre,oct,october',
  'noviembre,nov,november', 'diciembre,dic,dec,december'
].forEach(function (fila, i) {
  var mm = String(i + 1).length === 1 ? '0' + (i + 1) : String(i + 1);
  fila.split(',').forEach(function (a) { MES[a] = mm; });
});
// devuelve '01'..'12' o null. NUNCA adivina: si el texto no nombra un mes, lo dice.
function mesDe(texto) {
  var s = nmz(texto);
  var hit = null;
  Object.keys(MES).forEach(function (k) {
    if (hit && hit.len >= k.length) return;
    // frontera de palabra a mano: 'mar' no debe pegar dentro de 'marketing'
    var i = s.indexOf(k);
    while (i >= 0) {
      var antes = i === 0 ? '' : s[i - 1], desp = s[i + k.length] || '';
      if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(desp)) { hit = { mm: MES[k], len: k.length }; break; }
      i = s.indexOf(k, i + 1);
    }
  });
  return hit ? hit.mm : null;
}

// ══ 3 · LAS MÉTRICAS ════════════════════════════════════════════════════════════════
// Estaban en lista fija en 3 sitios. Si la fuente agrega una métrica, no se carga y nadie se
// entera. Se descubren de la fila real y **lo que no se reconoce se DECLARA**, que es la
// diferencia entre un sistema flexible y uno descuidado: acepta lo nuevo, pero lo dice.
var CANON = [
  { canon: 'email_sends', pistas: ['sends', 'envios', 'sent'] },
  { canon: 'email_deliveries', pistas: ['deliveries', 'delivered', 'entregas'] },
  { canon: 'email_unique_opens', pistas: ['unique opens', 'unique_opens', 'aperturas unicas'] },
  { canon: 'email_unique_clicks', pistas: ['unique clicks', 'unique_clicks', 'clics unicos'] },
  { canon: 'email_bounces', pistas: ['bounces', 'rebotes'] }
];
// Las tasas se derivan y NO se cargan: si se cargan, dejan de cuadrar con sus propios números
// en cuanto una métrica base crece con el refresh.
function esTasa(nombre) { return /rate|tasa|%|ratio/i.test(nombre); }

function metricasDe(fila) {
  var cols = Object.keys(fila || {});
  var mapa = {}, sinReconocer = [], tasas = [];
  cols.forEach(function (c) {
    if (c.indexOf('__') === 0) return;
    var n = nmz(c);
    if (esTasa(c)) { tasas.push(c); return; }
    var m = CANON.filter(function (x) { return x.pistas.some(function (p) { return n.indexOf(nmz(p)) >= 0; }); })[0];
    if (m) { if (!mapa[m.canon]) mapa[m.canon] = c; return; }
    // ¿parece métrica? numérico y no es una dimensión conocida
    var v = fila[c];
    var esNum = v !== '' && v !== null && isFinite(Number(String(v).replace(/[, ]/g, '')));
    if (esNum && !/name|date|id|journey|campaign|subject|audience|week|sender/i.test(c)) sinReconocer.push(c);
  });
  var faltan = CANON.map(function (x) { return x.canon; }).filter(function (k) { return !mapa[k]; });
  return {
    mapa: mapa,                    // canon → nombre real de la columna en ESTA fuente
    faltan: faltan,                // métricas del contrato que la fuente no trae
    nuevas: sinReconocer,          // 🔴 numéricas que nadie reclama: se DECLARAN, no se ignoran
    tasas_ignoradas: tasas         // se derivan, no se cargan
  };
}

// ══ 4 · EL CONTRASTE QUE HACE FALTA EN TODOS LOS SCRIPTS ══════════════════════════════
// Un validador que compara contra una constante hay que editarlo cada corte. Uno que compara
// contra un invariante sirve para siempre. Esto solo nombra la diferencia para que se vea en
// el código y no se vuelva a colar un `=== 96`.
function invariante(nombre, ok, detalle) { return { clase: 'invariante', nombre: nombre, ok: !!ok, detalle: detalle }; }
function constante(nombre, ok, detalle) {
  return { clase: 'CONSTANTE', nombre: nombre, ok: !!ok, detalle: detalle,
    aviso: 'este check caduca: compara contra un número de hoy, no contra una regla' };
}

/**
 * EL VOLCADO VIGENTE de una fuente — el más reciente de `_insumos/` con ese prefijo.
 *
 * 🔴 POR QUÉ EXISTE (27-ago-2026). Tres scripts del corte traían la fecha del insumo ESCRITA A
 *    MANO: `sfmc-piezas-20ago.txt`, `sfmc-links-21ago.txt`. Cuando llegó el volcado nuevo, la
 *    cadena siguió leyendo el viejo — sin fallar, sin avisar, y pisando el bloque bueno con
 *    datos de una semana antes. Una fecha en el código es una bomba de tiempo: funciona hasta
 *    que llega el archivo siguiente, y entonces miente en vez de romperse.
 * 🔴 Y DEVUELVE POR QUÉ ELIGIÓ ESE. El script que lo usa imprime `via`, así que la primera línea
 *    de cada corrida dice con qué volcado se está trabajando. Sin eso, «usé el más reciente» es
 *    una afirmación que nadie puede comprobar.
 *    Se ordena por FECHA DEL NOMBRE cuando la trae (`-AAAA-MM-DD`), y por mtime cuando no:
 *    los nombres viejos (`-20ago`) no son ordenables como texto contra los nuevos.
 */
/* 🔴 `exigirInsumo` EXISTE PORQUE «falta null» NO ES UN MENSAJE. `insumoVigente` devuelve `null`
 *    cuando no hay ningún archivo de ese tipo, y de los que lo llaman solo 3 comprueban el
 *    resultado: los demás hacen `'falta ' + ins.ruta` y, con `null` delante, imprimen literalmente
 *    **«falta null»**. Lo vi al correr el sistema desde la carpeta nueva con `_insumos` casi vacía
 *    —el estado en que lo va a encontrar la primera persona— y ese mensaje no dice qué traer, ni
 *    de dónde, ni distingue «no hay ninguno» de «el que hay no está en disco».
 *    Se arregla en la LIBRERÍA y no en cada llamador: el defecto es de la pregunta, no de quien
 *    la hace. Quien necesita el insumo de verdad llama a esto; quien sabe tratar el `null` sigue
 *    usando `insumoVigente`. */
function exigirInsumo(prefijo, comoTraerlo) {
  var fs = require('fs'), path = require('path');
  var dir = require('path').resolve(__dirname, '..') + '/_insumos';
  var v = null;
  try { v = insumoVigente(prefijo); } catch (e) { }
  if (v && v.ruta && fs.existsSync(v.ruta)) return v;

  var hay = [];
  try { hay = fs.readdirSync(dir); } catch (e) { }
  console.log('🔴 falta el insumo `' + prefijo + '-*` y sin él este paso no puede correr.');
  console.log('   Lo busqué en: ' + dir);
  if (!v) console.log('   No hay NINGÚN archivo que empiece por «' + prefijo + '».');
  else console.log('   El vigente sería «' + v.archivo + '», pero no está en disco.');
  console.log('   Lo que sí hay ahí: ' + (hay.length ? hay.slice(0, 8).join(' · ') + (hay.length > 8 ? ' …' : '') : '(nada)'));
  console.log('   ' + (comoTraerlo || 'Es una ENTRADA: no la produce la cadena. Tráela antes de correr el corte.'));
  process.exit(1);
}

function insumoVigente(prefijo, opciones) {
  var fs = require('fs'), path = require('path'), os = require('os');
  var dir = (opciones || {}).dir || (require('path').resolve(__dirname, '..') + '/_insumos');
  var cand;
  try { cand = fs.readdirSync(dir).filter(function (f) { return f.indexOf(prefijo) === 0; }); }
  catch (e) { return null; }      // la carpeta puede no existir en una instalación nueva
  if (!cand.length) return null;
  var conFecha = cand.map(function (f) {
    var m = /-(\d{4})-(\d{2})-(\d{2})\./.exec(f);
    return { archivo: f, iso: m ? m[1] + m[2] + m[3] : null, mtime: fs.statSync(path.join(dir, f)).mtimeMs };
  });
  conFecha.sort(function (a, b) {
    if (a.iso && b.iso) return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
    if (a.iso && !b.iso) return 1;            // un nombre con fecha ISO gana al que no la trae
    if (!a.iso && b.iso) return -1;
    return a.mtime - b.mtime;
  });
  var elegido = conFecha[conFecha.length - 1];
  return {
    ruta: path.join(dir, elegido.archivo), archivo: elegido.archivo,
    via: elegido.iso ? 'fecha en el nombre' : 'mtime (el nombre no trae fecha)',
    descartados: conFecha.slice(0, -1).map(function (x) { return x.archivo; })
  };
}

module.exports = {
  t: t, nmz: nmz, nmEncabezado: nmEncabezado,
  archivoVivo: archivoVivo, insumoVigente: insumoVigente, exigirInsumo: exigirInsumo,
  mesDe: mesDe, MESES: MES,
  metricasDe: metricasDe,
  invariante: invariante, constante: constante
};
