/*
 * qcart.utms-por-pieza.js — POR CADA PIEZA: sus shortlinks, sus recetas, el utm QUE NOSOTROS
 * DECLARAMOS en el maestro, y el utm QUE DE VERDAD TRAE la data de Qcart.
 *
 * 🔴 POR QUÉ LAS DOS COLUMNAS DE UTM SON DISTINTAS Y HAY QUE VERLAS JUNTAS. En el maestro de
 *    Qcart-Links nosotros declaramos qué utm debería llevar cada link. En el CSV que devuelve Qcart
 *    viene el utm que realmente se registró. No siempre coinciden: ya se midió que
 *    `utm_content`/`utm_term` llegan INVERTIDOS en parte de las filas, y por eso la regla del
 *    sistema es que **la llave de Qcart es el SHORTLINK, nunca el utm** (R2). Este listado enseña
 *    exactamente dónde se separan, que es la pregunta que Rick hizo.
 *
 * 🔴 SE CRUZA POR EL CÓDIGO DEL SHORTLINK. El catálogo declara los códigos de cada pieza
 *    (`Cod_Walmart_N`, `Cod_Chedraui_N`); el maestro los tiene en `codigo`; el CSV en
 *    `shortlink_code`. Ése es el único identificador que las tres fuentes comparten.
 *
 *   node qcart.utms-por-pieza.js "Liga MX"
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var L = require(BACK + '/_scripts/lib-flexible.js');
var LKM = require(BACK + '/_scripts/lib-maestro-links.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var CAMP = process.argv[2] || 'Liga MX';

// ── 1 · el catálogo ───────────────────────────────────────────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_utms.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var CAT = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function pide(id) { try { return COL.de(CAT, id, AMBITO_CATALOGO); } catch (e) { return null; } }
var nID = pide('Pieza_ID'), nCAMP = pide('Campa' + 'ña'), nTP = pide('TouchPoint'), nSEG = pide('Segmento');
var nCOD = pide('Codigos_Qcart'), nNREC = pide('N_Recetas'), nF1 = pide('Fecha_Primer_Envio'), nCANAL = pide('Canal');
function v(p, nom) { return nom ? t(p[nom]) : ''; }
// los bloques Receta_N / URL_Receta_N / Cod_Walmart_N / Cod_Chedraui_N, hasta donde existan
var BLOQUES = [];
for (var i = 1; i <= 5; i++) {
  BLOQUES.push({ n: i, rec: pide('Receta_' + i), url: pide('URL_Receta_' + i), wal: pide('Cod_Walmart_' + i), che: pide('Cod_Chedraui_' + i) });
}

var piezas = CAT.filter(function (p) { return v(p, nID) && v(p, nCAMP).toLowerCase().indexOf(CAMP.toLowerCase()) >= 0; })
  .sort(function (a, b) { return v(a, nID) < v(b, nID) ? -1 : 1; });

// ── 2 · el maestro de links: lo que NOSOTROS declaramos ───────────────────────────
var MAE = LKM.cargar();
var maestroDe = {};
(MAE.filas || []).forEach(function (f) {
  var c = t(f.codigo); if (!c) return;
  (maestroDe[c] = maestroDe[c] || []).push(f);
});

// ── 3 · la data de Qcart: lo que REALMENTE llegó ──────────────────────────────────
var QC = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var dataDe = {};
(QC.carritos || []).forEach(function (e) {
  var c = t(e.shortlink_code); if (!c) return;
  var d = dataDe[c] = dataDe[c] || { n: 0, utm: {}, tiendas: {}, fechas: {} };
  d.n++;
  var k = t(e.utm_campaign) + ' ¦ ' + t(e.utm_content) + ' ¦ ' + t(e.utm_term) + ' ¦ ' + t(e.utm_medium) + '/' + t(e.utm_source);
  d.utm[k] = (d.utm[k] || 0) + 1;
  if (t(e.store)) d.tiendas[t(e.store)] = (d.tiendas[t(e.store)] || 0) + 1;
  if (t(e.fecha)) d.fechas[t(e.fecha).slice(0, 10)] = 1;
});

console.log('════════ ' + CAMP.toUpperCase() + ' · PIEZAS, RECETAS, SHORTLINKS Y UTMs ════════');
console.log('  catálogo: ' + piezas.length + ' pieza(s)   ·   maestro: ' + (MAE.filas || []).length + ' fila(s) en ' +
  ((MAE.hojas || []).map(function (h) { return t(h.hoja) + ':' + h.filas; }).join(' · ') || '?') + '   ·   carritos cargados: ' + (QC.carritos || []).length + '\n');

var sinMaestro = [], sinData = [], difieren = [];
piezas.forEach(function (p) {
  var id = v(p, nID);
  console.log('── ' + id + '   ' + v(p, nTP) + '   ·   ' + v(p, nSEG) + '   ·   ' + v(p, nCANAL) +
    '   ·   envío ' + v(p, nF1).slice(0, 10));
  var decl = v(p, nCOD);
  console.log('   códigos declarados en el catálogo: ' + (decl || '(ninguno)') +
    (v(p, nNREC) ? '   ·   N_Recetas ' + v(p, nNREC) : ''));

  var algo = false;
  BLOQUES.forEach(function (b) {
    var rec = v(p, b.rec), url = v(p, b.url), wal = v(p, b.wal), che = v(p, b.che);
    if (!rec && !wal && !che) return;
    if (/^(N\/A|POR DEFINIR)$/i.test(rec) && !wal && !che) return;
    algo = true;
    console.log('   ' + ('receta ' + b.n).padEnd(10) + rec);
    if (url) console.log('             url: ' + url);
    [['Walmart', wal], ['Chedraui', che]].forEach(function (par) {
      var tienda = par[0], cod = par[1];
      if (!cod || /^(N\/A|POR DEFINIR)$/i.test(cod)) return;
      console.log('             ' + tienda.padEnd(9) + 'shortlink ' + cod);
      var m = maestroDe[cod] || [];
      if (!m.length) { console.log('                       🔴 el MAESTRO no tiene este código'); sinMaestro.push(id + ' · ' + cod); }
      m.forEach(function (f) {
        console.log('                       maestro  (' + t(f.hoja) + '!' + f.fila + '):  utm_campaign «' + t(f.utm_campaign) +
          '»  utm_content «' + t(f.utm_content) + '»  utm_term «' + t(f.utm_term) + '»' +
          (t(f.receta) ? '  receta «' + t(f.receta) + '»' : '') + (t(f.retailer) ? '  retailer «' + t(f.retailer) + '»' : ''));
      });
      var d = dataDe[cod];
      if (!d) { console.log('                       ⊘ la DATA de Qcart no trae ni un carrito con este código'); sinData.push(id + ' · ' + cod); return; }
      console.log('                       data     (' + d.n + ' carrito(s), ' + Object.keys(d.fechas).length + ' día(s), tiendas: ' +
        Object.keys(d.tiendas).map(function (x) { return x + ' ' + d.tiendas[x]; }).join(' · ') + ')');
      Object.keys(d.utm).sort(function (a, b2) { return d.utm[b2] - d.utm[a]; }).forEach(function (k) {
        var pz = k.split(' ¦ ');
        console.log('                         ' + String(d.utm[k]).padStart(5) + '×  utm_campaign «' + pz[0] +
          '»  utm_content «' + pz[1] + '»  utm_term «' + pz[2] + '»  (' + pz[3] + ')');
      });
      // ¿coinciden el content y el term con lo declarado?
      if (m.length) {
        var dm = m[0];
        var vistos = Object.keys(d.utm).map(function (k) { return k.split(' ¦ '); });
        var igualContent = vistos.some(function (x) { return x[1].toLowerCase() === t(dm.utm_content).toLowerCase(); });
        var igualTerm = vistos.some(function (x) { return x[2].toLowerCase() === t(dm.utm_term).toLowerCase(); });
        if (!igualContent || !igualTerm) {
          console.log('                       🔴 NO coincide con el maestro: ' +
            (igualContent ? '' : 'utm_content ') + (igualTerm ? '' : 'utm_term ') + 'difiere(n)');
          difieren.push({ pieza: id, codigo: cod, maestro: t(dm.utm_content) + ' / ' + t(dm.utm_term), data: vistos.map(function (x) { return x[1] + ' / ' + x[2]; }).join(' | ') });
        }
      }
    });
  });
  if (!algo) console.log('   ⊘ el catálogo no declara recetas ni códigos para esta pieza');
  console.log('');
});

/* ══ UNA FILA POR PIEZA ═══════════════════════════════════════════════════════════════════════
 * 🔴 Rick: «solo una fila por pieza, con todas las shortlinks, utms y todo en su celda».
 * 🔴 DENTRO DE CADA CELDA, EL ORDEN ES EL DE LAS RECETAS y es el mismo en las 6 columnas: la
 *    receta 1 va con el shortlink 1 y con el utm 1. Aquí sí se leen por posición —es una tabla
 *    para leer, no una estructura para parsear— pero se dice, porque leer por posición sin
 *    avisarlo es lo que mandó 171 carritos al segmento de al lado.
 * 🔴 Y EL UTM DE LA DATA PUEDE SER MÁS DE UNO POR SHORTLINK: cuando un código trae dos huellas
 *    distintas se listan las dos con su conteo. Colapsarlas a la mayoritaria escondería
 *    exactamente el caso que hay que ver (`hTHNLqzL`, con 50 de una y 8 de otra).
 */
console.log('\n\n════ UNA FILA POR PIEZA ════\n');
var CABF = ['Pieza_ID', 'TouchPoint', 'Segmento', 'Canal', 'Fecha_Envio', 'Recetas', 'URL_Recetas',
  'Shortlinks', 'Retailer', 'utm_campaign_Maestro', 'utm_content_Maestro', 'utm_term_Maestro',
  'utm_campaign_Data', 'utm_content_Data', 'utm_term_Data', 'Carritos', 'Coincide'];
var FILAS = [];
piezas.forEach(function (p) {
  var id = v(p, nID);
  var rec = [], url = [], sho = [], ret = [], mCam = [], mCon = [], mTer = [], dCam = [], dCon = [], dTer = [], car = 0, ok = [];
  BLOQUES.forEach(function (b) {
    var r = v(p, b.rec); if (!r || /^(N\/A|POR DEFINIR)$/i.test(r)) return;
    var cods = [['Walmart', v(p, b.wal)], ['Chedraui', v(p, b.che)]].filter(function (x) { return x[1] && !/^(N\/A|POR DEFINIR)$/i.test(x[1]); });
    if (!cods.length) return;
    cods.forEach(function (par) {
      var cod = par[1];
      rec.push(r); url.push(v(p, b.url) || 'N/A'); sho.push(cod); ret.push(par[0]);
      var m = (maestroDe[cod] || [])[0];
      mCam.push(m ? t(m.utm_campaign) : '(no está en el maestro)');
      mCon.push(m ? t(m.utm_content) : '(no está en el maestro)');
      mTer.push(m ? t(m.utm_term) : '(no está en el maestro)');
      var d = dataDe[cod];
      if (!d) { dCam.push('(sin carritos)'); dCon.push('(sin carritos)'); dTer.push('(sin carritos)'); ok.push('sin data'); return; }
      car += d.n;
      var ks = Object.keys(d.utm).sort(function (a, b2) { return d.utm[b2] - d.utm[a]; });
      function junta(i2) { return ks.map(function (k) { return k.split(' ¦ ')[i2] + (ks.length > 1 ? ' (' + d.utm[k] + ')' : ''); }).join(' + '); }
      dCam.push(junta(0)); dCon.push(junta(1)); dTer.push(junta(2));
      if (!m) { ok.push('sin maestro'); return; }
      var vs = ks.map(function (k) { return k.split(' ¦ '); });
      ok.push(vs.some(function (x) { return x[1].toLowerCase() === t(m.utm_content).toLowerCase(); }) &&
        vs.some(function (x) { return x[2].toLowerCase() === t(m.utm_term).toLowerCase(); }) ? 'Sí' : 'NO');
    });
  });
  var u = function (a) { return a.join(' · ') || 'N/A'; };
  FILAS.push([id, v(p, nTP), v(p, nSEG), v(p, nCANAL), v(p, nF1).slice(0, 10),
    u(rec), u(url), u(sho), u(ret), u(mCam), u(mCon), u(mTer), u(dCam), u(dCon), u(dTer),
    String(car), u(ok)]);
});
var W = CABF.map(function (c, i) { return Math.max(c.length, Math.max.apply(null, FILAS.map(function (f) { return String(f[i]).length; }))); });
console.log('  ' + CABF.map(function (c, i) { return c.padEnd(W[i]); }).join(' │ '));
FILAS.forEach(function (f) { console.log('  ' + f.map(function (x, i) { return String(x).padEnd(W[i]); }).join(' │ ')); });

console.log('\n════ RESUMEN ════');
console.log('  códigos del catálogo que el MAESTRO no tiene: ' + sinMaestro.length + (sinMaestro.length ? '  → ' + sinMaestro.join(' · ') : ''));
console.log('  códigos sin ni un carrito en la DATA:         ' + sinData.length + (sinData.length ? '  → ' + sinData.join(' · ') : ''));
console.log('  códigos donde el utm de la data NO casa con el del maestro: ' + difieren.length);
difieren.forEach(function (d) {
  console.log('     ' + d.pieza + ' · ' + d.codigo);
  console.log('        maestro: ' + d.maestro);
  console.log('        data   : ' + d.data);
});
try { fs.unlinkSync(tmp); } catch (e) { }
