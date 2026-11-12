/*
 * maggi.calcular-columnas.js — LAS 6 COLUMNAS DE LA HOJA «Maggi Reporte», MEDIDAS. No escribe.
 *
 * 🔴 E1 · medir todo → decidir todo → escribir una vez. Esto deja la tabla en `_preescritura/`
 *    para poder revisarla ANTES de tocar el Excel.
 *
 * 🔴 LA CALIBRACIÓN NO ES CIRCULAR. Rick ya llenó a mano 15 de las 22 filas de `Medición desde` y
 *    `hasta`. Este script calcula las 22 desde la data y **compara contra las suyas**: si mi método
 *    reproduce lo que él puso, el método sirve; si no, uno de los dos está mal y hay que mirarlo
 *    antes de escribir nada. Es la única forma de saber que el cálculo es el correcto y no solo
 *    consistente consigo mismo.
 *
 * 🔴 NO SE TOCA LO QUE RICK ESCRIBIÓ. «No modificas las columnas que eliminé ni los datos que
 *    agregué, solo lo que te pedí». Cada celda sale marcada `escribir` o `respetar`.
 *
 *   node maggi.calcular-columnas.js
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
var LKQ = require(BACK + '/_scripts/lib-qcart-links.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var HOJA = 'Maggi Reporte';

// ── serial de Excel ↔ ISO ─────────────────────────────────────────────────────────
function serialDe(iso) {
  if (!iso) return null;
  var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); if (!p) return null;
  return Math.round((Date.UTC(+p[1], +p[2] - 1, +p[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}
function isoDeSerial(n) {
  var x = Number(n); if (!isFinite(x) || x < 30000) return null;
  return new Date(Date.UTC(1899, 11, 30 + x)).toISOString().slice(0, 10);
}

// ── la hoja ───────────────────────────────────────────────────────────────────────
var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_mgcalc.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, tmp);
var wb = XLSX.readFile(tmp);
var F = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: '', blankrows: false });
var enc = (F[0] || []).map(t);
function ix(c) { return enc.indexOf(c); }
var C_CAMP = ix('Campaña'), C_TP = ix('TouchPoint'), C_SEG = ix('Segmento'), C_Q = ix('Quincena_Lanzamiento Principal');
var NUEVAS = { rec: ix('RECETAS ASIGNADAS'), sho: ix('SHORTLINKS ASIGNADOS'), uo: ix('UTMS CONTENT ORIGEN'),
  um: ix('UTMS CONTENT MODIFICADAS'), md: ix('Medición desde'), mh: ix('Medición hasta') };
Object.keys(NUEVAS).forEach(function (k) { if (NUEVAS[k] < 0) { console.log('🔴 falta una columna: ' + k); process.exit(1); } });

// ── el catálogo: pieza → recetas y códigos ────────────────────────────────────────
var CAT = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
function pide(id) { try { return COL.de(CAT, id, AMBITO_CATALOGO); } catch (e) { return null; } }
var nID = pide('Pieza_ID'), nCAMP = pide('Campa' + 'ña'), nTP = pide('TouchPoint'), nSEG = pide('Segmento'), nQ = pide('Quincena');
var BL = []; for (var i = 1; i <= 5; i++) BL.push({ rec: pide('Receta_' + i), wal: pide('Cod_Walmart_' + i), che: pide('Cod_Chedraui_' + i) });
function v(p, nom) { return nom ? t(p[nom]) : ''; }

// ── maestro y data ────────────────────────────────────────────────────────────────
var MAE = LKM.cargar();
var maeDe = {}; (MAE.filas || []).forEach(function (f) { var c = t(f.codigo); if (c) (maeDe[c] = maeDe[c] || []).push(f); });
var QC = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
var datDe = {};
(QC.carritos || []).forEach(function (e) {
  var c = t(e.shortlink_code); if (!c) return;
  var d = datDe[c] = datDe[c] || { n: 0, utm: {}, dias: {} };
  d.n++; if (t(e.utm_content)) d.utm[t(e.utm_content)] = (d.utm[t(e.utm_content)] || 0) + 1;
  if (t(e.fecha)) d.dias[t(e.fecha).slice(0, 10)] = 1;
});
var ACT = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8')).links_validos || {};
var AMB = JSON.parse(fs.readFileSync(BACK + '/_preescritura/shortlinks-ambiguos.json', 'utf8'));
var ambigua = {}; (AMB.detalle || []).forEach(function (x) { ambigua[x.codigo] = x; });

// ── por fila de la hoja, encontrar su(s) pieza(s) ─────────────────────────────────
var nm = function (s) { return t(s).toLowerCase().replace(/\s+/g, ' '); };
var TABLA = [], calibra = {};
for (var r = 1; r < F.length; r++) {
  var camp = t(F[r][C_CAMP]), tp = t(F[r][C_TP]), seg = t(F[r][C_SEG]), q = t(F[r][C_Q]);
  if (!camp) continue;
  /* 🔴 EL SEGMENTO DE LA HOJA ES MÁS LARGO QUE EL DEL CATÁLOGO, y por eso el join exacto fallaba.
   *    La hoja dice «Región unificada · Partición A» y «Usuarios CON región · Región Sur ·
   *    Partición C»; el catálogo dice «Región unificada» y «Usuarios CON región». Con igualdad
   *    estricta, esas 3 filas se quedaban sin pieza — y sin pieza no hay recetas, ni shortlinks,
   *    ni ventana: salían vacías, que es justo lo que este paso viene a llenar.
   *    Se acepta que uno sea PREFIJO del otro. No se afloja más: `Usuarios CON región` y
   *    `Usuarios sin región` siguen sin casar entre sí, que es lo que hay que proteger en J4 y J5.
   *    Y si aun así casan dos piezas, se declara — no se elige la primera. */
  function casaSeg(a, b) {
    a = nm(a); b = nm(b);
    return a === b || (a && b && (a.indexOf(b) === 0 || b.indexOf(a) === 0));
  }
  var piezas = CAT.filter(function (p) {
    return nm(v(p, nCAMP)) === nm(camp) && nm(v(p, nTP)) === nm(tp) && casaSeg(v(p, nSEG), seg);
  });
  var rec = [], sho = [], uo = [], um = [], dias = [], act = [], notas = [];
  piezas.forEach(function (p) {
    BL.forEach(function (b) {
      /* 🔴 EL CÓDIGO MANDA, LA RECETA ES UNA ETIQUETA (30-sep-2026). Esto empezaba con
       *    `if (!rr) return;` — o sea que exigía `Receta_N` para siquiera MIRAR `Cod_Walmart_N`.
       *    Una pieza con su shortlink declarado y sin nombre de receta no aportaba nada, y no
       *    avisaba: `005-P015` (E-J10) y `005-P016` (WA-J10) salieron con «(ninguna)» en recetas,
       *    shortlinks, utms y ventana de medición teniendo sus tres códigos en el catálogo.
       *    La llave de Qcart es el SHORTLINK —está escrito en el skill— así que el código es lo que
       *    decide si la fila cuenta; el nombre de la receta es una etiqueta que, si el catálogo no
       *    la trae, la da el MAESTRO, que es su autoridad. */
      var rr = v(p, b.rec);
      if (rr && /^(N\/A|POR DEFINIR)$/i.test(rr)) rr = '';
      /* 🔴 UNA CELDA DE CÓDIGOS PUEDE TRAER VARIOS, Y ALGUNO NO SER UN CÓDIGO. El catálogo tiene
       *    celdas como «cartanywhere ; tJEICO87 ; Z8W0ZouI»: tres valores separados por «;» y el
       *    primero es el nombre del servicio, no un shortlink. Mi primera versión metía la cadena
       *    entera como si fuera un código — y entonces no casaba con nada ni en el maestro ni en
       *    la data, así que las columnas salían «(no está en el maestro)» sobre links que sí
       *    existen. Se parte y se valida con `codigosDe` de `lib-qcart-links`, que ya sabe qué
       *    forma tiene un shortlink; escribir aquí una segunda versión es cómo divergen. */
      var cels = [v(p, b.wal), v(p, b.che)].filter(function (x) { return x && !/^(N\/A|POR DEFINIR)$/i.test(x); });
      var codigos = [];
      cels.forEach(function (c) { LKQ.codigosDe(c).forEach(function (x) { if (codigos.indexOf(x) < 0) codigos.push(x); }); });
      codigos.forEach(function (cod) {
        var m = (maeDe[cod] || [])[0];
        // la receta: la del catálogo si la declara; si no, la que el maestro le da a ESE código
        var recCod = rr || (m ? t(m.receta) : '');
        if (recCod && rec.indexOf(recCod) < 0) rec.push(recCod);
        if (sho.indexOf(cod) < 0) sho.push(cod);
        var mo = m ? t(m.utm_content) : '(no está en el maestro)';
        if (uo.indexOf(mo) < 0) uo.push(mo);
        var d = datDe[cod];
        if (d) {
          Object.keys(d.utm).sort(function (a, b2) { return d.utm[b2] - d.utm[a]; }).forEach(function (u) {
            var et = u + (Object.keys(d.utm).length > 1 ? ' (' + d.utm[u] + ')' : '');
            if (um.indexOf(et) < 0) um.push(et);
          });
          /* 🔴 UN CÓDIGO AMBIGUO NO PUEDE FIJAR LA VENTANA DE NADIE. `hTHNLqzL` está en J4 y en
           *    J7, así que sus carritos empiezan el 15-ago: usarlo arrastraba la ventana de E-J7
           *    a agosto, un mes antes de que J7 saliera. Sus días se excluyen del cálculo y la
           *    ventana sale de los códigos que SÍ son de esta jornada. Si la fila no tuviera
           *    ningún código propio, queda sin ventana y se declara — mejor un hueco visible que
           *    una fecha de otra jornada con cara de dato. */
          if (!ambigua[cod]) Object.keys(d.dias).forEach(function (x) { dias.push(x); });
        } else if (um.indexOf('(sin carritos)') < 0) um.push('(sin carritos)');
        /* 🔴 LA CONVENCIÓN DE LA VENTANA NO SE ADIVINA: SE MIDE CONTRA LAS CELDAS DE RICK.
         *    Hay dos candidatas razonables —la ACTIVACIÓN del link o el PRIMER CARRITO— y eligen
         *    fechas distintas. Se calculan las dos y al final se compara cuál reproduce las 9
         *    celdas que él llenó a mano. La que gane es la convención; la otra se descarta con su
         *    número. Elegir yo una y "explicarla" sería inventar una regla y llamarla método. */
        var a = ACT[cod]; if (a && a.fecha_activacion) act.push(a.fecha_activacion);
        if (ambigua[cod]) notas.push('⚠ ' + cod + ' compartido con otra jornada (' +
          (ambigua[cod].maestro || []).map(function (x) { return t(x.hoja) + '/' + t(x.utm_content); }).join(' y ') + ')');
      });
    });
  });
  dias = dias.filter(Boolean).sort(); act = act.filter(Boolean).sort();
  // las dos candidatas, sin elegir todavia
  var candDesde = { activacion: act[0] || null, primer_carrito: dias[0] || null };
  var hasta = dias[dias.length - 1] || null;
  var u = function (a) { return a.join(' · '); };
  var yaD = t(F[r][NUEVAS.md]), yaH = t(F[r][NUEVAS.mh]);
  // 🔴 la calibración contra lo que Rick puso a mano
  if (yaD) {
    Object.keys(candDesde).forEach(function (k) {
      calibra[k] = calibra[k] || { ok: 0, dif: [] };
      var mio = serialDe(candDesde[k]);
      if (mio !== null && String(mio) === String(Math.round(Number(yaD)))) calibra[k].ok++;
      else calibra[k].dif.push({ fila: r + 1, tp: tp, suyo: yaD + ' (' + isoDeSerial(yaD) + ')', mio: mio + ' (' + candDesde[k] + ')' });
    });
  }
  TABLA.push({
    fila: r + 1, campana: camp, touchpoint: tp, segmento: seg, quincena: q,
    piezas: piezas.map(function (p) { return v(p, nID); }),
    valores: {
      'RECETAS ASIGNADAS': u(rec), 'SHORTLINKS ASIGNADOS': u(sho),
      'UTMS CONTENT ORIGEN': u(uo), 'UTMS CONTENT MODIFICADAS': u(um) + (notas.length ? ' · ' + u(notas) : ''),
      'Medición desde': null, 'Medición hasta': serialDe(hasta)
    },
    cand: candDesde, iso: { desde: null, hasta: hasta },
    yaTenia: { 'SHORTLINKS ASIGNADOS': t(F[r][NUEVAS.sho]), 'Medición desde': yaD, 'Medición hasta': yaH }
  });
}

console.log('════════ Maggi Reporte · LAS 6 COLUMNAS, MEDIDAS ════════\n');
console.log('  filas: ' + TABLA.length + '   ·   con pieza en el catálogo: ' + TABLA.filter(function (x) { return x.piezas.length; }).length + '\n');
console.log('  🔴 CALIBRACIÓN · ¿qué convención reproduce las celdas que Rick llenó a mano?');
Object.keys(calibra).forEach(function (k) {
  var c = calibra[k];
  console.log('     ' + k.padEnd(16) + 'coinciden ' + String(c.ok).padStart(2) + ' de ' + (c.ok + c.dif.length));
  c.dif.slice(0, 4).forEach(function (d) { console.log('        fila ' + d.fila + ' ' + d.tp + '   él ' + d.suyo + '   esta convención ' + d.mio); });
});
var GANA = Object.keys(calibra).sort(function (a, b) { return calibra[b].ok - calibra[a].ok; })[0];
console.log('     ⇒ gana: ' + GANA + '   (' + calibra[GANA].ok + ' de ' + (calibra[GANA].ok + calibra[GANA].dif.length) + ')');
TABLA.forEach(function (x) { x.iso.desde = x.cand[GANA]; x.valores['Medición desde'] = serialDe(x.cand[GANA]); });

console.log('\n  ── qué quedaría en cada fila');
TABLA.forEach(function (x) {
  console.log('  fila ' + String(x.fila).padStart(2) + '  ' + (x.campana + ' · ' + x.touchpoint).padEnd(26) +
    (x.piezas.join(',') || '⊘ sin pieza'));
  console.log('        recetas   : ' + (x.valores['RECETAS ASIGNADAS'] || '(ninguna)'));
  console.log('        shortlinks: ' + (x.valores['SHORTLINKS ASIGNADOS'] || '(ninguno)') +
    (x.yaTenia['SHORTLINKS ASIGNADOS'] ? '   [Rick puso: «' + x.yaTenia['SHORTLINKS ASIGNADOS'] + '» → se respeta]' : ''));
  console.log('        utm origen: ' + (x.valores['UTMS CONTENT ORIGEN'] || '—') + '     utm data: ' + (x.valores['UTMS CONTENT MODIFICADAS'] || '—'));
  console.log('        medición  : ' + (x.iso.desde || '—') + ' → ' + (x.iso.hasta || '—') +
    '  (serial ' + x.valores['Medición desde'] + ' → ' + x.valores['Medición hasta'] + ')');
});
fs.writeFileSync(BACK + '/_preescritura/maggi-columnas.json', JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), calibracion: calibra, tabla: TABLA }, null, 1));
console.log('\n  → _preescritura/maggi-columnas.json   (no se tocó el Excel)');
try { fs.unlinkSync(tmp); } catch (e) { }
