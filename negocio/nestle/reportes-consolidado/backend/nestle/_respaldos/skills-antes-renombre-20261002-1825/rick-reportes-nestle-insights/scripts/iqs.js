// IQS · el puntaje determinista de los insights de Nestlé.
//
// 🔴 QUÉ HACE Y QUÉ NO. Este script NO escribe insights: produce los CANDIDATOS y su puntaje,
//    leyendo la rejilla del motor. La prosa la escribe el skill. La razón es la de siempre en
//    este sistema: lo que se puede calcular no se opina, y lo que se opina no se calcula.
//
// 🔴 LA REGLA QUE MÁS INSIGHTS FALSOS HA PRODUCIDO: comparar contra otro OBJETIVO. Hotcakes
//    May-Q2 (Purchase) se comparó contra su Abr-Q2 (Inspiration) y salió «44.9pp bajo tu mejor»
//    con una acción sin sentido — Inspiration abre naturalmente más que Purchase. Aquí el
//    baseline SOLO se busca dentro de la misma campaña Y el mismo objetivo. Sin excepción.
//
// 🔴 Y LA SEGUNDA: forzar un «mejor/peor» cuando OR y CTOR se contradicen. Botana OR 37% /
//    CTOR 0.6% contra Bebidas OR 31% / CTOR 1.1%: Botana «ganaba» convirtiendo la mitad.
//    Cuando discrepan, la discrepancia ES el insight, y este script la marca como tal.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var REJ = process.argv[2] || (BACK + '/_rejilla/rejilla.json');
if (!fs.existsSync(REJ)) { console.log('🔴 no hay rejilla en ' + REJ + '. Corre N5-motor.js primero.'); process.exit(1); }
var R = JSON.parse(fs.readFileSync(REJ, 'utf8'));
var celdas = R.rejilla || [];
var t = function (v) { return String(v == null ? '' : v).trim(); };
function pct(x) { return x === null || x === undefined ? null : Math.round(x * 1000) / 10; }
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// ── orden temporal de las quincenas, para saber qué es «anterior»
function orden(q) {
  var M = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
  var m = /^([a-zA-Z]{3})-Q([12])-(\d{4})$/.exec(t(q));
  if (!m) return 0;
  return (+m[3]) * 100 + (M[m[1].toLowerCase()] || 0) * 2 + (+m[2]);
}

// ── el universo de comparación: SIEMPRE campaña + objetivo
var universo = {};
celdas.forEach(function (c) {
  var k = t(c.campana) + '¦' + t(c.objetivo);
  (universo[k] = universo[k] || []).push(c);
});

var candidatos = [];
function cand(c, palanca, destino, texto, datos) {
  candidatos.push({
    campana: t(c.campana), objetivo: t(c.objetivo), touchpoint: t(c.touchpoint),
    segmento: t(c.segmento), quincena: t(c.quincena),
    palanca: palanca, destino: destino, hecho: texto, datos: datos || {}, puntaje: 0, criterios: {}
  });
}

celdas.forEach(function (c) {
  var tot = c.total || {}, sends = tot.sends || 0;
  if (!sends) return;
  var k = t(c.campana) + '¦' + t(c.objetivo);
  var hermanas = universo[k].filter(function (o) { return o !== c && (o.total || {}).sends; });
  var previas = hermanas.filter(function (o) { return orden(o.quincena) < orden(c.quincena); });

  // 1 · TECHO — su propio mejor OR dentro de la MISMA campaña y objetivo
  if (previas.length) {
    var mejorOR = previas.reduce(function (a, o) { return (o.total.open_rate || 0) > (a.total.open_rate || 0) ? o : a; });
    var brechaOR = (mejorOR.total.open_rate || 0) - (tot.open_rate || 0);
    if (brechaOR > 0.02) {
      cand(c, 'asunto', t(c.touchpoint),
        'su OR (' + pct(tot.open_rate) + '%) está ' + Math.round(brechaOR * 1000) / 10 + 'pp abajo de su propio mejor (' +
        pct(mejorOR.total.open_rate) + '%, ' + t(mejorOR.quincena) + ')',
        { or: tot.open_rate, mejor: mejorOR.total.open_rate, brecha: brechaOR, sends: sends });
    }
    var mejorCT = previas.reduce(function (a, o) { return (o.total.ctor || 0) > (a.total.ctor || 0) ? o : a; });
    var brechaCT = (mejorCT.total.ctor || 0) - (tot.ctor || 0);
    if (brechaCT > 0.003) {
      cand(c, 'clic', t(c.touchpoint),
        'su CTOR (' + pct(tot.ctor) + '%) está ' + Math.round(brechaCT * 1000) / 10 + 'pp abajo de su propio mejor (' +
        pct(mejorCT.total.ctor) + '%, ' + t(mejorCT.quincena) + '): abren pero no hacen clic',
        { ctor: tot.ctor, mejor: mejorCT.total.ctor, brecha: brechaCT, sends: sends });
    }
  }

  // 2 · FUP — el follow-up contra su principal
  if ((c.fup || {}).sends && (c.principal || {}).sends) {
    var dOR = (c.principal.open_rate || 0) - (c.fup.open_rate || 0);
    if (dOR > 0.05) cand(c, 'fup', 'Follow Up',
      'el FUP abre ' + Math.round(dOR * 1000) / 10 + 'pp menos que el Principal (' +
      pct(c.fup.open_rate) + '% vs ' + pct(c.principal.open_rate) + '%) sobre ' + mil(c.fup.sends) + ' envíos',
      { fup_or: c.fup.open_rate, prin_or: c.principal.open_rate, sends: c.fup.sends });
  }

  // 3 · QCART — intención, SIEMPRE número y %
  if (c.qcart && c.qcart.carritos) {
    cand(c, 'qcart', t(c.touchpoint),
      mil(c.qcart.carritos) + ' carritos · $' + mil(Math.round(c.qcart.importe_total)) + ' de intención total · $' +
      mil(Math.round(c.qcart.importe_nestle)) + ' Nestlé (' + pct(c.qcart.penetracion) + '%)' +
      (c.qcart.penetracion_es_piso ? ' — piso, no techo: el Doc 3 solo itemiza parte del carrito' : ''),
      { carritos: c.qcart.carritos, total: c.qcart.importe_total, nestle: c.qcart.importe_nestle, pen: c.qcart.penetracion });
  }
});

// 4 · DISPERSIÓN — dentro de la misma campaña×objetivo×quincena, si el CTOR abre ≥3× entre segmentos
var porCorte = {};
celdas.forEach(function (c) {
  if (!(c.total || {}).sends) return;
  var k = t(c.campana) + '¦' + t(c.objetivo) + '¦' + t(c.quincena);
  (porCorte[k] = porCorte[k] || []).push(c);
});
Object.keys(porCorte).forEach(function (k) {
  var g = porCorte[k].filter(function (c) { return (c.total.ctor || 0) > 0; });
  if (g.length < 2) return;
  var alto = g.reduce(function (a, o) { return o.total.ctor > a.total.ctor ? o : a; });
  var bajo = g.reduce(function (a, o) { return o.total.ctor < a.total.ctor ? o : a; });
  var veces = bajo.total.ctor ? alto.total.ctor / bajo.total.ctor : 0;
  if (veces >= 3) {
    cand(alto, 'dispersion', t(alto.segmento),
      'el CTOR abre ' + Math.round(veces * 10) / 10 + '× entre segmentos del mismo corte: ' +
      t(alto.segmento) + ' ' + pct(alto.total.ctor) + '% vs ' + t(bajo.segmento) + ' ' + pct(bajo.total.ctor) + '%',
      { veces: veces, alto: alto.total.ctor, bajo: bajo.total.ctor, sends: alto.total.sends });
  }
  // 🔴 la CONTRADICCIÓN entre OR y CTOR: no se rankea, se dice.
  //    ⚠ y solo si los dos líderes son SEGMENTOS DISTINTOS. Cuando un corte trae varias celdas
  //      del mismo segmento (dos touchpoints, por ejemplo), el líder de OR y el de CTOR pueden
  //      ser objetos distintos con el mismo nombre, y salía «Activos lidera apertura y Activos
  //      convierte mejor» — una frase que no dice nada y delata al generador.
  var altoOR = g.reduce(function (a, o) { return (o.total.open_rate || 0) > (a.total.open_rate || 0) ? o : a; });
  if (altoOR !== alto && t(altoOR.segmento) !== t(alto.segmento)) {
    cand(alto, 'contradiccion', t(alto.segmento),
      t(altoOR.segmento) + ' lidera apertura (' + pct(altoOR.total.open_rate) + '% OR) y ' + t(alto.segmento) +
      ' convierte mejor (' + pct(alto.total.ctor) + '% CTOR): NO se rankean, la discrepancia es el hallazgo',
      { or_lider: t(altoOR.segmento), ctor_lider: t(alto.segmento), sends: alto.total.sends });
  }
});

// ── EL PUNTAJE. Determinista, umbral 60.
candidatos.forEach(function (x) {
  var p = 0, cr = {};
  cr.cuantificado = /\d/.test(x.hecho) ? 25 : 0;                                    // trae cifras
  cr.comparado = /(abajo|vs|contra|×|lidera)/i.test(x.hecho) ? 20 : 0;               // hay contra qué medir
  cr.accionable = ['asunto', 'clic', 'fup', 'dispersion'].indexOf(x.palanca) >= 0 ? 25 : 0;
  var sends = x.datos.sends || 0, brecha = x.datos.brecha || 0;
  cr.material = (sends >= 100000 || brecha >= 0.10) ? 20 : 0;                        // pesa lo suficiente
  cr.no_repetido = 10;                                                               // lo ajusta el dedup de abajo
  x.criterios = cr;
  x.puntaje = cr.cuantificado + cr.comparado + cr.accionable + cr.material + cr.no_repetido;
});

// ── DEDUP por palanca+destino, y DIVERSIDAD: la 2ª acción de una celda usa OTRA palanca
var vistos = {};
candidatos.sort(function (a, b) { return b.puntaje - a.puntaje; }).forEach(function (x) {
  var k = x.campana + '¦' + x.palanca + '¦' + x.destino;
  if (vistos[k]) { x.puntaje -= 10; x.criterios.no_repetido = 0; x.repetido_de = vistos[k]; }
  else vistos[k] = x.quincena;
});

var pasan = candidatos.filter(function (x) { return x.puntaje >= 60; });
var porCelda = {};
pasan.sort(function (a, b) { return b.puntaje - a.puntaje; }).forEach(function (x) {
  var k = x.campana + '¦' + x.objetivo + '¦' + x.quincena;
  porCelda[k] = porCelda[k] || [];
  // máximo 2 por celda, y la 2ª con OTRA palanca
  if (porCelda[k].length >= 2) return;
  if (porCelda[k].length === 1 && porCelda[k][0].palanca === x.palanca) return;
  porCelda[k].push(x);
});

console.log('════════ IQS · candidatos de insight ════════\n');
console.log('  celdas de la rejilla: ' + celdas.length + '   candidatos: ' + candidatos.length +
  '   pasan el umbral 60: ' + pasan.length + '   celdas con acción: ' + Object.keys(porCelda).length + '\n');
Object.keys(porCelda).sort().forEach(function (k) {
  console.log('── ' + k.split('¦').join(' · '));
  porCelda[k].forEach(function (x) {
    console.log('   [' + String(x.puntaje).padStart(3) + '] ' + x.palanca.padEnd(14) + x.hecho);
  });
});
// 🔴 SIN CANDIDATOS NO SE INVENTA UNA RECOMENDACIÓN PARA LLENAR. Se dice que no la hay.
var sinAccion = [];
celdas.forEach(function (c) {
  var k = t(c.campana) + '¦' + t(c.objetivo) + '¦' + t(c.quincena);
  if (!porCelda[k] && (c.total || {}).sends) sinAccion.push(k.split('¦').join(' · '));
});
if (sinAccion.length) {
  console.log('\n  sin acción prioritaria (' + sinAccion.length + ' corte(s)) — y eso se ESCRIBE así,');
  console.log('  no se rellena con una recomendación inventada:');
  sinAccion.slice(0, 10).forEach(function (s) { console.log('     · ' + s); });
}
fs.writeFileSync(BACK + '/_fuentes/insights-candidatos.json', JSON.stringify({
  nodo: 'G3', celdas: celdas.length, candidatos: candidatos.length, pasan: pasan.length,
  por_celda: porCelda, sin_accion: sinAccion
}, null, 1));
console.log('\n  → _fuentes/insights-candidatos.json');
