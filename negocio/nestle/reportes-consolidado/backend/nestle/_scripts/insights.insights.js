// insights-redactar · LOS INSIGHTS — la columna `Insights` dentro del Resumen. SOLO esa columna.
//
// 🔴 ES DETERMINISTA A PROPÓSITO. Un insight escrito «a ojo» no se puede refutar: si mañana sale
//    distinto, nadie sabe si cambió el dato o cambió el criterio. Aquí cada frase sale de una
//    regla que se puede citar, y el IQS decide si una acción entra o no. Lo que no pasa el
//    umbral no se escribe — no se rellena con una recomendación de adorno.
//
// LAS REGLAS, cada una con el caso real que la obligó:
//
//  1. NÚMERO Y PORCENTAJE, nunca solo el %. «7.8% de penetración» no dice si son mil pesos o un
//     millón. Va `$16,687 de $214,026 (7.8%)`.
//  2. SIEMPRE OR Y CTOR. Un objetivo con buen OR y mal CTOR no es un buen objetivo.
//  3. ⛔ NO FORZAR MEJOR/PEOR CUANDO SE CONTRADICEN. Caso real: Botana OR 37% / CTOR 0.6% vs
//     Bebidas OR 31% / CTOR 1.1%. Rankear por OR decía que ganaba Botana, y Botana convertía la
//     mitad. **Cuando OR y CTOR discrepan, ESA discrepancia es el insight.**
//  4. ⛔ BENCHMARK POR CAMPAÑA × OBJETIVO, jamás cruzando journeys. Caso real: Hotcakes May-Q2
//     (Purchase, OR 39.7%) se comparaba contra su Abr-Q2 (Inspiration, OR 84.6%) y salía
//     «44.9pp bajo tu mejor». Inspiration abre más por naturaleza; la comparación no existía.
//  5. LA ACCIÓN ABRE CON VERBO. «Dejar un solo CTA arriba del fold porque…», no
//     «CLIC (Purchase): CTOR 0.7%…». Una etiqueta no se puede ejecutar.
//  6. «PRIMERA CORRIDA» NO ES UNA ACCIÓN. Si no hay histórico, se dice y punto.
//  7. DISPERSIÓN: si el CTOR entre segmentos abre ≥3×, entra aunque el líder gane en ambas.
//     Sin esto se perdía el mejor hallazgo de Tercer Tiempo (9.3% vs 0.3% = 35×).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'insights';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function mil(n) { return Number(Math.round(n || 0)).toLocaleString('es-MX'); }
function pc(v, d) { return v === null || v === undefined ? '—' : (v * 100).toFixed(d === undefined ? 1 : d) + '%'; }
function money(v) { return '$' + mil(v); }

console.log('════════ insights-redactar · INSIGHTS ' + (ESCRIBIR ? '(ESCRIBE)' : '(solo vista previa)') + ' ════════\n');
var R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var celdas = R.rejilla;

// ── el histórico para comparar: MISMA campaña Y MISMO objetivo, quincenas anteriores ──
// 🔴 la llave del benchmark lleva el objetivo. Sin él, se compara Purchase contra Inspiration.
function ordenQuincena(q) {
  var m = /^([A-Za-zé]{3})-Q(\d)-(\d{4})$/.exec(t(q)); if (!m) return 0;
  var MES = { Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6, Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12 };
  return (+m[3]) * 100 + (MES[m[1]] || 0) * 2 + (+m[2]);
}
var historico = {};
celdas.forEach(function (c) {
  var k = c.campana + '¦' + c.objetivo;
  (historico[k] = historico[k] || []).push(c);
});
Object.keys(historico).forEach(function (k) {
  historico[k].sort(function (a, b) { return ordenQuincena(a.quincena) - ordenQuincena(b.quincena); });
});

// ── el IQS: determinista, umbral 60, máximo 2 acciones ──────────────────────────────
// Cuantificado 25 · Comparado 20 · Accionable 25 · Material 20 · No repetido 10
function iqs(cand) {
  var s = 0;
  if (cand.cifras) s += 25;
  if (cand.comparado) s += 20;
  if (cand.accion) s += 25;
  if (cand.material) s += 20;
  if (!cand.repetido) s += 10;
  return s;
}

var usadas = {};                    // palanca+destino ya usada → no se repite
function insightDe(c) {
  var lineas = [], candidatos = [];
  var P = c.principal, FU = c.fup, TT = c.total, WA = c.whatsapp, Q = c.qcart;

  // ── 1 · DESEMPEÑO, con touchpoints y siempre número Y porcentaje ─────────────────
  if (TT.sends > 0) {
    var pr = P.sends ? 'Principal ' + mil(P.sends) + ' env · OR ' + pc(P.open_rate) + ' · CTOR ' + pc(P.ctor, 2) : '';
    var fp = FU.sends ? 'FUP ' + mil(FU.sends) + ' env · OR ' + pc(FU.open_rate) + ' · CTOR ' + pc(FU.ctor, 2) : '';
    lineas.push('Desempeño: ' + [pr, fp].filter(Boolean).join('  ·  ') +
      (P.sends && FU.sends ? '  ·  Total ' + mil(TT.sends) + ' env · OR ' + pc(TT.open_rate) + ' · CTOR ' + pc(TT.ctor, 2) : ''));
  }
  if (WA.sends > 0) {
    lineas.push('WhatsApp: ' + mil(WA.sends) + ' env · entrega ' + pc(WA.delivery_rate) + ' · lectura ' + pc(WA.read_rate) +
      (WA.clicks_medidos ? ' · CTOR ' + pc(WA.ctor, 2) : ' · CTOR no disponible: la fuente deriva los clicks de un supuesto, no los mide'));
  }

  // ── 2 · INTENCIÓN: número Y porcentaje, o «Sin Qcart» ────────────────────────────
  if (Q) {
    lineas.push('Intención: ' + money(Q.importe_total) + ' total · ' + money(Q.importe_nestle) + ' Nestlé (' +
      pc(Q.penetracion) + ') · ' + mil(Q.carritos) + ' carritos' +
      (Q.receta_representativa ? ' · receta que más jala: ' + Q.receta_representativa : '') +
      '  [la penetración es un PISO: el doc de productos solo itemiza parte del carrito]');
  } else if (c.qcart_remision) {
    lineas.push('Intención: el Qcart de ' + c.mes + ' está contado en ' + c.qcart_remision.replace('— ver ', '') +
      ' — es mensual y se ancla una sola vez para no contarlo dos veces.');
  } else {
    lineas.push('Intención: Sin Qcart.');
  }

  // ── 3 · EL BENCHMARK: misma campaña, MISMO objetivo, quincena anterior ───────────
  // 🔴 UNA FILA SIN ATRIBUIR NO TIENE CONTRA QUE COMPARARSE. Las celdas sin pieza comparten la
  //    llave «(sin campana)¦» y, sin este corte, se comparaban ENTRE ELLAS: un envio de Maggi
  //    contra uno de ICE, solo porque ninguno de los dos esta atribuido. Eso es exactamente el
  //    cruce de journeys que la regla 4 prohibe, hecho por accidente en vez de a proposito.
  //    Lo mismo si falta el objetivo: sin objetivo, la comparacion no tiene sentido.
  var comparable = c.campana_del_catalogo && t(c.objetivo);
  var serie = comparable ? (historico[c.campana + '¦' + c.objetivo] || []) : [];
  var previas = serie.filter(function (x) { return ordenQuincena(x.quincena) < ordenQuincena(c.quincena) && x.total.sends > 0; });
  if (!comparable) {
    lineas.push('Comparacion: no se puede comparar — esta fila no esta atribuida a una pieza del catalogo' +
      (t(c.objetivo) ? '' : ' y no trae objetivo') + ', asi que no hay un mismo objetivo contra el que medir.');
  } else if (!previas.length) {
    // 🔴 regla 6: «primera corrida» NO es una acción. Se dice y ya.
    lineas.push('Comparación: primera corrida de ' + c.campana + ' · ' + c.objetivo +
      ' — no hay historico del MISMO objetivo contra el que medir. Los numeros quedan de referencia.');
  } else {
    var mejorOR = previas.reduce(function (a, x) { return (x.total.open_rate || 0) > (a.total.open_rate || 0) ? x : a; });
    var mejorCTOR = previas.reduce(function (a, x) { return (x.total.ctor || 0) > (a.total.ctor || 0) ? x : a; });
    var dOR = (TT.open_rate !== null && mejorOR.total.open_rate !== null) ? (TT.open_rate - mejorOR.total.open_rate) * 100 : null;
    var dCTOR = (TT.ctor !== null && mejorCTOR.total.ctor !== null) ? (TT.ctor - mejorCTOR.total.ctor) * 100 : null;
    lineas.push('Comparación (mismo objetivo · ' + c.objetivo + '): OR ' + pc(TT.open_rate) + ' vs su mejor ' +
      pc(mejorOR.total.open_rate) + ' (' + mejorOR.quincena + ')' + (dOR === null ? '' : ', ' + (dOR >= 0 ? '+' : '') + dOR.toFixed(1) + 'pp') +
      ' · CTOR ' + pc(TT.ctor, 2) + ' vs ' + pc(mejorCTOR.total.ctor, 2) + (dCTOR === null ? '' : ', ' + (dCTOR >= 0 ? '+' : '') + dCTOR.toFixed(2) + 'pp'));

    // 🔴 regla 3: si OR y CTOR se contradicen, ESA es la observación
    if (dOR !== null && dCTOR !== null && ((dOR > 2 && dCTOR < -0.2) || (dOR < -2 && dCTOR > 0.2))) {
      lineas.push('⚠ OR y CTOR apuntan en direcciones opuestas: ' +
        (dOR > 0 ? 'abre mejor que su historia pero convierte peor' : 'abre peor pero convierte mejor') +
        ' — rankear por una sola de las dos daría una lectura falsa.');
      candidatos.push({
        clave: 'discrepancia', cifras: true, comparado: true, accion: true,
        material: TT.sends >= 100000 || Math.abs(dOR) >= 10, repetido: !!usadas['discrepancia¦' + c.campana],
        texto: (dOR > 0
          ? 'Revisar el CTA y el destino, no el asunto — el asunto ya está funcionando: OR ' + pc(TT.open_rate) +
          ' (' + (dOR >= 0 ? '+' : '') + dOR.toFixed(1) + 'pp sobre su mejor) con CTOR ' + pc(TT.ctor, 2) +
          ' (' + dCTOR.toFixed(2) + 'pp): abren y no hacen clic.'
          : 'Trabajar el asunto, no el CTA — convierte mejor que su historia (CTOR ' + pc(TT.ctor, 2) + ', +' + dCTOR.toFixed(2) +
          'pp) pero abre menos (OR ' + pc(TT.open_rate) + ', ' + dOR.toFixed(1) + 'pp): a quien abre le sirve, faltan aperturas.')
      });
    } else if (dOR !== null && dOR < -5) {
      candidatos.push({
        clave: 'asunto', cifras: true, comparado: true, accion: true,
        material: TT.sends >= 100000 || Math.abs(dOR) >= 10, repetido: !!usadas['asunto¦' + c.campana],
        texto: 'Probar un asunto nuevo contra el de ' + mejorOR.quincena + ' — su OR (' + pc(TT.open_rate) +
          ') está ' + Math.abs(dOR).toFixed(1) + 'pp abajo del mejor del mismo objetivo (' + pc(mejorOR.total.open_rate) + ').'
      });
    }
  }

  // ── 4 · FUP: si existe y rinde muy por debajo, es una palanca ───────────────────
  if (P.sends > 0 && FU.sends > 0 && P.open_rate !== null && FU.open_rate !== null && P.open_rate > 0) {
    var caida = (P.open_rate - FU.open_rate) / P.open_rate;
    if (caida > 0.45) candidatos.push({
      clave: 'fup', cifras: true, comparado: true, accion: true,
      material: FU.sends >= 50000, repetido: !!usadas['fup¦' + c.campana],
      texto: 'Reescribir el FUP o espaciarlo — abre ' + pc(FU.open_rate) + ' contra ' + pc(P.open_rate) +
        ' del Principal (' + mil(FU.sends) + ' envíos): la caída es de ' + (caida * 100).toFixed(0) + '%.'
    });
  }

  // ── 5 · el multiplicador de Qcart >1 es bandera de calidad, no resultado ────────
  if (Q && Q.views_vs_clicks !== null && Q.views_vs_clicks > 1) {
    lineas.push('⚠ Views de Qcart (' + mil(Q.views) + ') por encima de los clicks de email (' + mil(TT.clicks) +
      '): ×' + Q.views_vs_clicks.toFixed(2) + '. El shortlink es único por canal, así que no hay tráfico externo — es dato inflado en la fuente, no amplificación.');
  }

  // ── 6 · las acciones: máximo 2, con IQS ≥60, y sin repetir palanca ──────────────
  var acciones = candidatos.map(function (x) { x.iqs = iqs(x); return x; })
    .filter(function (x) { return x.iqs >= 60; })
    .sort(function (a, b) { return b.iqs - a.iqs; });
  var elegidas = [];
  acciones.forEach(function (a) {
    if (elegidas.length >= 2) return;
    if (elegidas.some(function (e) { return e.clave === a.clave; })) return;   // diversidad de palanca
    elegidas.push(a); usadas[a.clave + '¦' + c.campana] = 1;
  });
  if (elegidas.length) {
    lineas.push('Acción: ' + elegidas.map(function (a, i) { return (elegidas.length > 1 ? (i + 1) + ') ' : '') + a.texto; }).join('  '));
  } else {
    // 🔴 regla: si nada pasa el umbral, se dice. NUNCA se inventa una recomendación de relleno.
    lineas.push('Acción: sin acción prioritaria esta quincena.');
  }

  // audiencias — nunca «audiencia única»
  var segs = t(c.segmento).split(/\s*,\s*/).filter(Boolean);
  if (segs.length) lineas.push('Audiencias: ' + (segs.length > 1 ? segs.join(' + ') + ' (envío combinado, no separables)' : segs[0]));

  return lineas.join('\n');
}

var insights = celdas.map(function (c) { return { celda: c, texto: insightDe(c) }; });
console.log('  celdas: ' + celdas.length);
console.log('  con acción prioritaria : ' + insights.filter(function (x) { return !/sin acción prioritaria/.test(x.texto); }).length);
console.log('  primera corrida        : ' + insights.filter(function (x) { return /primera corrida/.test(x.texto); }).length);
console.log('  con discrepancia OR/CTOR: ' + insights.filter(function (x) { return /direcciones opuestas/.test(x.texto); }).length);
console.log('  con aviso de multiplicador: ' + insights.filter(function (x) { return /dato inflado/.test(x.texto); }).length);

if (!ESCRIBIR) {
  console.log('\n  ── dos ejemplos completos\n');
  [insights.filter(function (x) { return /direcciones opuestas/.test(x.texto); })[0], insights[1]]
    .filter(Boolean).forEach(function (x) {
      console.log('  ▸ ' + x.celda.campana + ' · ' + x.celda.objetivo + ' · ' + x.celda.touchpoint + ' · ' + x.celda.quincena);
      x.texto.split('\n').forEach(function (l) { console.log('      ' + l); });
      console.log('');
    });
  console.log('  ── vista previa. Para escribir: node insights.insights.js --escribir');
  process.exit(0);
}

// ══ ESCRIBIR — SOLO la columna Insights ════════════════════════════════════════════
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_n6b.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var sh = wb.Sheets['Report_Resumen'];
var rr = XLSX.utils.decode_range(sh['!ref']);
var iIns = -1;
for (var c2 = rr.s.c; c2 <= rr.e.c; c2++) {
  var h = sh[XLSX.utils.encode_cell({ r: 0, c: c2 })];
  if (h && t(h.v) === 'Insights') iIns = c2;
}
// 🔴 SI LA COLUMNA NO ESTÁ, ES UNA DECISIÓN DE RICK — NO UN FALLO (3-sep-2026).
//    El 27-ago él mismo retiró a mano 17 columnas del Report_Resumen: todo el bloque de clicks
//    por destino, las cuatro de Unsubscribe y ésta, y dejó escrito al lado «ATRIBUCIÓN DE CLICKS
//    Y AGRUPACIÓN» y «CADA COSA POR SEPARADO». Reponerla sería deshacer su edición, que es la
//    regla que este sistema no rompe: *sus cambios se respetan*.
//    Este paso ESCRIBE esa columna; sin columna no hay nada que escribir. Se declara y se sale
//    en verde — un `exit 1` aquí detenía el corte entero por respetar una decisión suya.
// ⚠ La distinción que sí importa: **existe y está vacía** es un fallo del escritor y sigue
//    bloqueando aguas abajo; **no existe** es una decisión del dueño del reporte.
if (iIns < 0) {
  console.log('  ⏭ la columna `Insights` no está en Report_Resumen.');
  console.log('     Rick la retiró a mano el 27-ago junto con las 16 de clicks/unsub. No se repone:');
  console.log('     este paso escribe esa columna, y sin columna no hay nada que escribir.');
  console.log('     Para volver a tenerla: node resumen.asegurar-columnas.js --escribir');
  process.exit(0);
}
var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) {
  if (n === 'Report_Resumen') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _;
});
var xml = zip.readAsText(parte);
// 🔴 la llave se PIDE a la librería del reporte. Estaba escrita aquí con el nombre físico clavado
//    (`Quincena_Lanzamiento`), y cuando la hoja lo cambió este paso escribió 0 insights, lo dijo en
//    su propio log —«releído: 0 de 77 filas con insight»— y salió en verde igual.
var llave = require(__dirname + '/lib-valores-resumen.js').llaveDeFila;
var porLlave = {}; insights.forEach(function (x) { porLlave[llave(x.celda, false)] = x.texto; });
var escritas = 0, sinPareja = 0;
F.forEach(function (fila, k) {
  var txt = porLlave[llave(fila, true)];
  if (!txt) { sinPareja++; return; }
  var ref = col(iIns) + (k + 2);
  xml = CX.poner(xml, ref, CX.celda(ref, txt, CX.estiloDe(xml, ref)), k + 2).xml;
  escritas++;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ✔ ' + escritas + ' insights escritos · ' + sinPareja + ' filas sin pareja en la rejilla');
console.log('  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));
var F2 = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Report_Resumen'], { defval: '', blankrows: false });
// 🔴 RELEER Y NO ACTUAR SOBRE LO QUE SE LEE ES PEOR QUE NO RELEER. Este paso escribía 0 insights,
//    lo IMPRIMÍA —«releído: 0 de 77»— y salía con éxito, así que la cadena seguía y la Puerta 2
//    era la que descubría, dos etapas después, que el reporte tenía una columna muda.
//    Un paso que ya sabe que falló tiene que decirlo con su código de salida, no solo en su log.
var conInsight = F2.filter(function (x) { return t(x['Insights']); }).length;
console.log('\n  ── releído: ' + conInsight + ' de ' + F2.length + ' filas con insight');
if (ESCRIBIR && insights.length > 0 && conInsight === 0) {
  console.log('  🔴 se generaron ' + insights.length + ' insights y NINGUNO llegó a la hoja.');
  console.log('     Casi siempre es la llave: la hoja y la rejilla no están cruzando.');
  process.exit(1);
}
console.log('  archivo listo en: ' + SECO);
