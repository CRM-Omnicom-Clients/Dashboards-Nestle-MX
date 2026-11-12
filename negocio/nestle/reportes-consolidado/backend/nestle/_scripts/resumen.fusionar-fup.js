// resumen-fusionar · EL SKILL DEL REPORTE — fusionar Principal y FUP en una fila.
//
// 🔴 LO QUE PIDIÓ RICK: «FUP y Principal deberían existir en la misma línea, no separada; por eso
//    tiene sus columnas de resultados FUP». Y: «de hecho no están todos los resultados de los FUPS».
//
// 🔴 QUÉ SE MIDIÓ: de las 86 celdas de la rejilla, **10 son un FUP sin su Principal**. No duplican
//    nada —Principal + FUP suma exacto los 7,282,486 de `Data_Email`— pero ocupan una fila propia
//    en vez de ir en la de su Principal. Caen separadas porque **el FUP salió en otra quincena**
//    (`001-P004` en Mar-Q2 y su Principal `001-P003` en Mar-Q1), y la quincena está en la llave.
//
// 🔴 CÓMO SE FUSIONAN, y esto es lo que antes no se podía: por **`Pieza_Principal_ID`**, la foránea
//    que la Etapa 1 declaró. Deducirlo por dimensiones era imposible —la quincena no coincide— y
//    por eso el motor las dejaba sueltas. Ahora cada FUP dice de quién es seguimiento.
//
// 🔴 EL TOTAL NO PUEDE CAMBIAR. Fusionar mueve envíos de una fila a otra; si la suma se mueve,
//    la fusión perdió o duplicó. Se comprueba antes de escribir nada.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'resumen';   // el ámbito de este skill dentro del catálogo raíz
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var Q = require(__dirname + '/lib-quincena.js');
var E = require(__dirname + '/lib-esquema.js');
var L = require(__dirname + '/lib-flexible.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

console.log('════════ resumen-fusionar · FUSIONAR PRINCIPAL Y FUP ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var RJ = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8'));
var G = RJ.rejilla;

// el catálogo: pieza → sus datos, y la foránea FUP→Principal
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var pieza = {}; P.forEach(function (p) { pieza[t(p['Pieza_ID'])] = p; });

function sends(c, cual) { return (c[cual] && Number(c[cual].sends)) || 0; }
var totalAntes = G.reduce(function (a, c) { return a + sends(c, 'principal') + sends(c, 'fup'); }, 0);
console.log('  celdas: ' + G.length + '   ·   Σ email antes: ' + mil(totalAntes));

// ── índice: pieza → celda que la contiene
var celdaDe = {};
G.forEach(function (c, i) { (c.piezas || []).forEach(function (pid) { celdaDe[t(pid)] = i; }); });

// ── las celdas que son un FUP sin su Principal
var huerfanas = [];
G.forEach(function (c, i) {
  if (sends(c, 'principal') > 0 || sends(c, 'fup') <= 0) return;
  huerfanas.push({ i: i, c: c });
});
console.log('  celdas que son un FUP sin su Principal: ' + huerfanas.length);

var fusiones = [], sinDestino = [];
huerfanas.forEach(function (h) {
  var pids = (h.c.piezas || []).map(t);
  // el Principal de cualquiera de sus piezas
  var destino = null, viaPieza = null;
  pids.forEach(function (pid) {
    if (destino !== null) return;
    var pp = t((pieza[pid] || {})['Pieza_Principal_ID']);
    if (!E.esDato(pp)) return;
    if (celdaDe[pp] !== undefined) { destino = celdaDe[pp]; viaPieza = pid + ' → ' + pp; }
  });
  if (destino === null) { sinDestino.push({ celda: h.c, piezas: pids, motivo: 'ninguna de sus piezas declara un Pieza_Principal_ID que tenga celda' }); return; }
  fusiones.push({ desde: h.i, hacia: destino, via: viaPieza, c: h.c });
});

console.log('\n  ── las fusiones (' + fusiones.length + '):');
fusiones.forEach(function (f) {
  var d = G[f.hacia];
  console.log('     ' + t(f.c.campana).padEnd(12) + t(f.c.touchpoint).padEnd(8) + t(f.c.segmento).slice(0, 22).padEnd(24) +
    'FUP ' + t(f.c.quincena).padEnd(13) + '→ Principal ' + t(d.quincena).padEnd(13) + '   ' + f.via + '   ' + mil(sends(f.c, 'fup')) + ' envíos');
});
if (sinDestino.length) {
  console.log('\n  ⚠ sin destino (' + sinDestino.length + '):');
  sinDestino.forEach(function (x) { console.log('     ' + t(x.celda.campana) + ' | ' + t(x.celda.touchpoint) + ' | ' + t(x.celda.segmento) + '   ' + x.motivo); });
}

// ── aplicar la fusión sobre una COPIA
var nueva = JSON.parse(JSON.stringify(G));
var aBorrar = {};
fusiones.forEach(function (f) {
  var dst = nueva[f.hacia], src = nueva[f.desde];
  // 🔴 si el destino YA tenía un fup, se suman: dos seguimientos del mismo Principal son dos
  //    piezas, no un error. Pero se declara, porque un fup que se suma sin avisar esconde una
  //    duplicación si el emparejamiento estuviera mal.
  if (dst.fup && dst.fup.sends > 0) {
    ['sends', 'deliveries', 'opens', 'clicks', 'bounces', 'piezas'].forEach(function (k) {
      dst.fup[k] = (Number(dst.fup[k]) || 0) + (Number(src.fup[k]) || 0);
    });
    dst.fup.fusionado_de = (dst.fup.fusionado_de || []).concat(src.piezas || []);
  } else {
    dst.fup = JSON.parse(JSON.stringify(src.fup));
  }
  // 🔴 LA QUINCENA DEL FUP — lo que Rick pidió: el seguimiento salió en otra quincena y eso
  //    tiene que verse, o el reporte parece decir que salió con su Principal.
  dst.fup_quincena = t(src.quincena);
  dst.piezas = (dst.piezas || []).concat(src.piezas || []);

  // 🔴 EL QCART DE LA CELDA QUE DESAPARECE VIAJA CON ELLA. Sin esto la fusión borraba 164
  //    carritos: la celda del FUP tenía su Qcart anclado y al eliminarla se iba con ella, sin
  //    dejar hueco visible —el motor seguía declarando «2,645 ✔» porque él contaba lo ANCLADO—.
  //    Y arrastrarlo al Principal es exactamente la regla de Rick: **los FUP nunca tienen Qcart,
  //    se asigna al touchpoint y audiencia del Principal.**
  if (src.qcart && src.qcart.carritos > 0) {
    if (!dst.qcart) {
      dst.qcart = JSON.parse(JSON.stringify(src.qcart));
      dst.qcart.via_fup = (src.piezas || []).join(' + ');
      dst.qcart.nota = 'Qcart que llegó por el FUP (' + dst.qcart.via_fup + '). Se atribuye al Principal: los FUP no tienen Qcart propio.';
    } else {
      ['carritos', 'views', 'productos', 'views_productos', 'importe_total', 'importe_nestle',
       'carritos_walmart', 'carritos_chedraui', 'carritos_combinado', 'carritos_sin_tienda'].forEach(function (k) {
        dst.qcart[k] = (Number(dst.qcart[k]) || 0) + (Number(src.qcart[k]) || 0);
      });
      dst.qcart.via_fup = (src.piezas || []).join(' + ');
      dst.qcart.nota = 'incluye el Qcart que llegó por el FUP (' + dst.qcart.via_fup + '), atribuido al Principal.';
    }
    if (!dst.qcart_ancla) dst.qcart_ancla = src.qcart_ancla || t(src.quincena);
  }
  // los nombres e ids del FUP viajan con él
  ['email_names', 'content_ids', 'email_ids'].forEach(function (k) {
    if (!src[k]) return;
    dst[k] = dst[k] || {};
    Object.keys(src[k]).forEach(function (v) { dst[k][v] = (dst[k][v] || 0) + src[k][v]; });
  });
  aBorrar[f.desde] = 1;
});
// y las celdas que ya tenían fup en su propia fila: su quincena es la del Principal
nueva.forEach(function (c) { if (c.fup && c.fup.sends > 0 && !c.fup_quincena) c.fup_quincena = t(c.quincena); });

// ── SEPARAR NOMBRES E IDS POR PRINCIPAL Y FUP
// 🔴 Rick agregó al reporte `Email Name SFMC_Principal` y `Email Name SFMC_FUP`, y estaban las dos
//    en CERO. La rejilla guardaba `email_names` como un montón —todos los nombres de la celda
//    juntos— y desde ahí no se puede saber cuál es de quién. Se separan aquí, donde sí se sabe:
//    cada pieza de la celda declara su `Email_Type` en el catálogo.
var E1 = require(__dirname + '/lib-esquema.js');
function colCat(p, ids) { for (var i = 0; i < ids.length; i++) if (p && t(p[ids[i]])) return t(p[ids[i]]); return ''; }
nueva.forEach(function (c) {
  var pr = { nombres: [], content: [], eids: [], subjects: [] };
  var fu = { nombres: [], content: [], eids: [], subjects: [] };
  (c.piezas || []).forEach(function (pid) {
    var p = pieza[t(pid)]; if (!p) return;
    var dest = /follow|fup/i.test(t(p['Email_Type'])) ? fu : pr;
    var nom = colCat(p, ['Email_Name']);
    var cid = colCat(p, ['Content_ID (final del Email_Name)', 'Content_ID']);
    var eid = colCat(p, ['Email_ID (de la DE de SFMC)', 'EmailID']);
    var sub = colCat(p, ['Subject']);
    if (E1.esDato(nom) && dest.nombres.indexOf(nom) < 0) dest.nombres.push(nom);
    if (E1.esDato(cid) && dest.content.indexOf(cid) < 0) dest.content.push(cid);
    if (E1.esDato(eid) && dest.eids.indexOf(eid) < 0) dest.eids.push(eid);
    if (E1.esDato(sub) && dest.subjects.indexOf(sub) < 0) dest.subjects.push(sub);
  });
  c.principal = c.principal || {};
  c.fup = c.fup || {};
  c.principal.email_name = pr.nombres.join(' · ');
  c.principal.content_id = pr.content.join(' · ');
  c.principal.email_id = pr.eids.join(', ');
  if (!t(c.principal.subject) && pr.subjects.length) c.principal.subject = pr.subjects[0];
  c.fup.email_name = fu.nombres.join(' · ');
  c.fup.content_id = fu.content.join(' · ');
  c.fup.email_id = fu.eids.join(', ');
  if (!t(c.fup.subject) && fu.subjects.length) c.fup.subject = fu.subjects[0];
});
var conNomP = nueva.filter(function (c) { return t(c.principal.email_name); }).length;
var conNomF = nueva.filter(function (c) { return t(c.fup.email_name); }).length;
console.log('\n  ── nombres separados: Principal en ' + conNomP + ' celdas · FUP en ' + conNomF);

/* ══ EL DESGLOSE DE CLICKS POR BLOQUE — 19-sep-2026 ═══════════════════════════════════════════
 * 🔴 POR QUÉ SE CALCULA AQUÍ Y NO EN `motor.links-a-rejilla.js`. Ese paso ya reparte los clicks
 *    por celda, pero NO sabe qué pieza es Principal y cuál es FUP — y las 3 columnas van por
 *    bloque. Este es el único sitio del sistema donde las dos cosas están a la vez: la celda ya
 *    fusionada (así que `c.piezas` incluye las piezas del FUP que se movieron aquí) y el
 *    `Email_Type` de cada pieza. Calcularlo antes obligaría a deducir el bloque del nombre, que es
 *    justo lo que falló con `Email 2 → E-P2` y corrió 191 carritos al segmento de al lado.
 *
 * 🔴 EL REPARTO CLASE→COLUMNA NO SE ESCRIBE AQUÍ: se le pide a `lib-clicks-destino`. Si estuviera
 *    escrito aquí habría dos copias (la otra construye `Data_Clicks`) y la hoja y el reporte
 *    podrían contar el mismo click en columnas distintas, cada una cuadrando consigo misma.
 *
 * 🔴 TRES ESTADOS, NO DOS. Una pieza con clicks y sin ni una fila en `CRM_Email_Links` no vale 0:
 *    vale «no se sabe». Son 27 bloques y 5,616 clicks (14.3%). Se marca `sin_links` y el reporte
 *    escribe `POR DEFINIR` — aplica y lo debemos. Si el bloque no tuvo clicks de email, es `N/A`.
 */
var CD = require(__dirname + '/lib-clicks-destino.js');
var LKcl = fs.existsSync(BACK + '/_fuentes/links.json') ? JSON.parse(fs.readFileSync(BACK + '/_fuentes/links.json', 'utf8')) : null;
/* 🔴 «¿ESTA PIEZA TUVO CLICKS?» SE LE PREGUNTA AL BLOQUE DE EMAIL, NO AL CATÁLOGO. El catálogo
 *    declara qué es cada pieza; cuántos clicks tuvo lo mide `_fuentes/email.json`. Leerlo de una
 *    columna del catálogo funcionaría hasta el día que esa columna se quede atrás —y ya pasó:
 *    `Tot_Unsubs` leía un campo que `fusionar-fup` deja obsoleto y perdió 2,111 bajas. */
var EMcl = fs.existsSync(BACK + '/_fuentes/email.json') ? JSON.parse(fs.readFileSync(BACK + '/_fuentes/email.json', 'utf8')) : { envios: [] };
var clicksPersona = {};
(EMcl.envios || []).forEach(function (r) {
  var pid = t(r.pieza_id); if (!pid) return;
  clicksPersona[pid] = (clicksPersona[pid] || 0) + (Number(r.email_unique_clicks) || 0);
});
var cobertura = { completa: 0, sin_links: 0, sin_clicks: 0, parcial: 0 };
if (!LKcl) {
  console.log('\n  ⊘ no hay _fuentes/links.json — las 9 columnas de desglose quedan sin calcular');
} else {
  nueva.forEach(function (c) {
    ['principal', 'fup'].forEach(function (b) {
      var esFup = b === 'fup';
      var pz = (c.piezas || []).map(t).filter(function (pid) {
        return (/follow|fup/i.test(t((pieza[pid] || {})['Email_Type']))) === esFup;
      });
      /* 🔴 el hueco lo crea una pieza CON clicks y sin links. Una pieza con 0 clicks no es un hueco:
       *    su desglose de verdad es 0 y contarla como «no se sabe» ensuciaría 60 filas sanas.
       * 🔴 «TUVO CLICKS» = LO DICE CUALQUIERA DE LAS DOS FUENTES, no solo la agregada. `009-P017`
       *    trae 6 clicks en `CRM_Email_Links` y 0 en `CRM_Email_Piezas`: mirando solo la agregada,
       *    esos 6 clicks medidos se caían del desglose y el cuadre quedaba corto por 6. Un click que
       *    una fuente registró no desaparece porque la otra no lo tenga. */
      /* 🔴 24-sep-2026 · Y UN CLICK DE PRUEBA NO ES UN CLICK QUE DESGLOSAR. Rick: «deja todos los
       *    volúmenes de prueba… pero no debe de haber incoherencias de todos modos». Las dos cosas
       *    caben: el volumen se queda en el bloque y en `links.json`, pero el REPORTE no publica el
       *    desglose de una pieza cuyos clicks son todos de un correo de prueba — ahí salía
       *    `Clicks = 0` junto a `Clicks_Medidos = 32`, que es una contradicción en la misma fila.
       *    Se resta lo que `motor-clicks` ya midió como prueba, y solo se considera «con clicks»
       *    si queda algo real. `009-P017` (6 clicks en links, 0 en la agregada, ninguno de prueba)
       *    sigue contando: la regla de arriba se conserva entera. */
      var conClicks = pz.filter(function (pid) {
        if ((clicksPersona[pid] || 0) > 0) return true;
        var lk = LKcl.piezas[pid] || {};
        return ((lk.clicks_unicos || 0) - (lk.clicks_de_prueba || 0)) > 0;
      });
      var acum = {}; CD.columnas().forEach(function (k) { acum[k] = 0; });
      var conLinks = 0;
      conClicks.forEach(function (pid) {
        var p = LKcl.piezas[pid];
        if (!p || !(p.clicks_unicos > 0)) return;
        conLinks++;
        var r = CD.repartir(p.por_destino);
        CD.columnas().forEach(function (k) { acum[k] += r[k]; });
      });
      /* 🔴 el total del bloque es la suma de su propio desglose — así `Clicks_Medidos` nunca puede
       *    quedar por debajo de una de sus partes, por construcción y no por el dato del corte. */
      acum[CD.COL_MEDIDOS] = CD.totalMedido(acum);
      var estado = !conClicks.length ? 'sin_clicks'
        : (conLinks === 0 ? 'sin_links' : (conLinks === conClicks.length ? 'completa' : 'parcial'));
      cobertura[estado]++;
      c[b] = c[b] || {};
      c[b].clicks_desglose = acum;
      c[b].clicks_desglose_estado = estado;
      c[b].clicks_desglose_piezas_sin_links = conClicks.filter(function (pid) {
        return !LKcl.piezas[pid] || !(LKcl.piezas[pid].clicks_unicos > 0);
      });
    });
    // el Total es la suma de los dos bloques, y su estado es el PEOR de los dos: si el FUP no se
    // sabe, el total tampoco se sabe — sumar lo conocido y presentarlo como total es el error.
    c.total = c.total || {};
    var accT = {}; CD.columnasReporte().forEach(function (k) { accT[k] = (c.principal.clicks_desglose[k] || 0) + (c.fup.clicks_desglose[k] || 0); });
    c.total.clicks_desglose = accT;
    var ep = c.principal.clicks_desglose_estado, ef = c.fup.clicks_desglose_estado;
    var malos = [ep, ef].filter(function (e) { return e === 'sin_links' || e === 'parcial'; });
    c.total.clicks_desglose_estado = malos.length ? malos[0]
      : (ep === 'completa' || ef === 'completa' ? 'completa' : 'sin_clicks');
  });
  var sumCol = {};
  CD.columnas().forEach(function (k) {
    sumCol[k] = nueva.reduce(function (a, c) { return a + ((c.principal.clicks_desglose || {})[k] || 0) + ((c.fup.clicks_desglose || {})[k] || 0); }, 0);
  });
  console.log('\n  ── desglose de clicks por bloque: ' + cobertura.completa + ' completa(s) · ' +
    cobertura.sin_links + ' sin links en la DE (→ POR DEFINIR) · ' + cobertura.parcial + ' parcial(es) · ' +
    cobertura.sin_clicks + ' sin clicks de email (→ N/A)');
  CD.columnas().forEach(function (k) { console.log('     ' + k.padEnd(30) + Number(sumCol[k]).toLocaleString('es-MX').padStart(8)); });
  var sd = CD.columnas().reduce(function (a, k) { return a + sumCol[k]; }, 0);
  // 🔴 EL CUADRE CONTRA LA FUENTE, NO CONTRA MÍ MISMO. La Σ de las 9 columnas tiene que ser la Σ
  //    de los links de las piezas QUE LLEGAN A UNA CELDA. La diferencia son piezas del bloque de
  //    links que ninguna fila del reporte recoge, y si hay, se dice — no se redondea.
  var enCeldas = {};
  nueva.forEach(function (c) { (c.piezas || []).forEach(function (p) { enCeldas[t(p)] = 1; }); });
  var esperado = Object.keys(LKcl.piezas).filter(function (p) { return enCeldas[p]; })
    .reduce(function (a, p) { return a + (LKcl.piezas[p].clicks_unicos || 0); }, 0);
  /* 🔴 SI DIFIERE, SE EXPLICA — NO SE REDEFINE EL ESPERADO PARA QUE CUADRE. `esperado` se calcula
   *    aparte a propósito (Σ links de las piezas que llegan a una fila), así que puede no coincidir
   *    con la Σ de las 9, y la diferencia tiene UNA causa concreta: una pieza con links pero con
   *    `Email_Unique_Clicks = 0` en la DE agregada queda fuera de `conClicks` y sus links no se
   *    reparten. Ajustar `esperado` para incluir ese filtro haría que el check se comparara contra
   *    sí mismo — que es cómo `Data_WhatsApp` pasó 19 checks en verde con 14 de 26 envíos mal. */
  var mudas = Object.keys(LKcl.piezas).filter(function (p) {
    return enCeldas[p] && LKcl.piezas[p].clicks_unicos > 0 && !(clicksPersona[p] > 0);
  });
  var clicksMudos = mudas.reduce(function (a, p) { return a + LKcl.piezas[p].clicks_unicos; }, 0);
  var dif = esperado - sd;
  console.log('     ' + '───── Σ de las 9'.padEnd(30) + Number(sd).toLocaleString('es-MX').padStart(8) +
    (dif === 0 ? '   ✔ = Σ links de las piezas que llegan a una fila'
      : '   la fuente dice ' + Number(esperado).toLocaleString('es-MX') + ', difieren en ' + Number(dif).toLocaleString('es-MX') +
        (dif === clicksMudos ? '   ✔ y es EXACTAMENTE lo explicado' : '   🔴 SIN EXPLICAR')));
  if (mudas.length) console.log('     └ ' + mudas.length + ' pieza(s) con links y 0 clicks en la DE agregada (' +
    Number(clicksMudos).toLocaleString('es-MX') + ' clicks): ' + mudas.slice(0, 6).join(' · '));
  if (dif !== 0 && dif !== clicksMudos) console.log('     🔴 la diferencia NO la explican las piezas mudas — hay otra causa sin identificar');
  var huerfanas = Object.keys(LKcl.piezas).filter(function (p) { return !enCeldas[p] && LKcl.piezas[p].clicks_unicos > 0; });
  if (huerfanas.length) console.log('     ⚠ ' + huerfanas.length + ' pieza(s) con links que ninguna fila del reporte recoge: ' + huerfanas.slice(0, 6).join(' · '));
  RJ.auditoria = RJ.auditoria || {};
  RJ.auditoria.clicks_desglose = { cobertura: cobertura, por_columna: sumCol, suma: sd, esperado: esperado, huerfanas: huerfanas };
}

// 🔴 EL `total` SE RECALCULA. Fusionar mueve el FUP a otra celda, pero `c.total` se calculó ANTES:
//    quedaba diciendo solo lo del Principal. El reporte leía de ahí y perdía 350,328 envíos —
//    exactamente lo que sumaban las 10 filas fusionadas. Mover un dato sin recalcular lo que lo
//    agrega es cómo un total miente sin que ninguna suma parcial se vea mal.
function tasaS(n, d) { return (n === null || n === undefined || !d) ? null : n / d; }
nueva.forEach(function (c) {
  var p = c.principal || {}, f = c.fup || {};
  var T = {};
  ['sends', 'deliveries', 'opens', 'clicks', 'bounces', 'unsubs', 'unsubs_tot'].forEach(function (k) {
    T[k] = (Number(p[k]) || 0) + (Number(f[k]) || 0);
  });
  T.delivery_rate = tasaS(T.deliveries, T.sends);
  T.open_rate = tasaS(T.opens, T.deliveries);
  T.click_rate = tasaS(T.clicks, T.deliveries);
  T.ctor = tasaS(T.clicks, T.opens);
  T.unsub_rate = tasaS(T.unsubs, T.sends);
  T.utor = tasaS(T.unsubs, T.opens);
  c.total = T;
});

var final = nueva.filter(function (_, i) { return !aBorrar[i]; });
var totalDespues = final.reduce(function (a, c) { return a + sends(c, 'principal') + sends(c, 'fup'); }, 0);
var totalAgregado = final.reduce(function (a, c) { return a + ((c.total && Number(c.total.sends)) || 0); }, 0);
console.log('\n  ── el total recalculado: Σ c.total.sends = ' + mil(totalAgregado) +
  '   ' + (totalAgregado === totalDespues ? '✅ == Principal + FUP' : '🔴 ≠ ' + mil(totalDespues)));

console.log('\n  ── el resultado');
console.log('     celdas: ' + G.length + ' → ' + final.length + '   (−' + Object.keys(aBorrar).length + ')');
console.log('     Σ email: ' + mil(totalAntes) + ' → ' + mil(totalDespues) + '   ' + (totalAntes === totalDespues ? '✅ NO cambió' : '🔴 CAMBIÓ — la fusión perdió o duplicó'));
// 🔴 Y EL QCART TAMPOCO PUEDE CAMBIAR. Este check faltaba, y por eso la fusión se llevó 164
//    carritos sin que nada lo dijera: se vigilaba el email y el Qcart viajaba en la misma celda.
//    Un check que mira una sola métrica deja pasar todo lo demás que va en el mismo vagón.
var qAntes = G.reduce(function (a, c) { return a + ((c.qcart && Number(c.qcart.carritos)) || 0); }, 0);
var qDespues = final.reduce(function (a, c) { return a + ((c.qcart && Number(c.qcart.carritos)) || 0); }, 0);
console.log('     Σ carritos: ' + mil(qAntes) + ' → ' + mil(qDespues) + '   ' + (qAntes === qDespues ? '✅ NO cambió' : '🔴 CAMBIÓ — la fusión perdió Qcart'));
var wAntes = G.reduce(function (a, c) { return a + ((c.whatsapp && Number(c.whatsapp.sends)) || 0); }, 0);
var wDespues = final.reduce(function (a, c) { return a + ((c.whatsapp && Number(c.whatsapp.sends)) || 0); }, 0);
console.log('     Σ WhatsApp: ' + mil(wAntes) + ' → ' + mil(wDespues) + '   ' + (wAntes === wDespues ? '✅ NO cambió' : '🔴 CAMBIÓ'));
if (totalAntes !== totalDespues) { console.log('\n  ⛔ no se escribe: fusionar movió envíos.'); process.exit(1); }
if (qAntes !== qDespues) { console.log('\n  ⛔ no se escribe: fusionar movió carritos.'); process.exit(1); }
if (wAntes !== wDespues) { console.log('\n  ⛔ no se escribe: fusionar movió WhatsApp.'); process.exit(1); }
var conFupQ = final.filter(function (c) { return t(c.fup_quincena); }).length;
var otraQ = final.filter(function (c) { return t(c.fup_quincena) && Q.normalizar(c.fup_quincena) !== Q.normalizar(c.quincena); }).length;
console.log('     celdas con FUP: ' + conFupQ + '   ·   de ellas, el FUP salió en OTRA quincena: ' + otraQ);

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
RJ.rejilla = final;
// 🔴 EL METADATO SE ACTUALIZA CON EL DATO. `auditoria.celdas` seguía diciendo 86 cuando la rejilla
//    ya tenía 76, y la Puerta 2 bloqueó —con razón— porque «la rejilla dice una cosa y contiene
//    otra». Cambiar un array sin actualizar lo que lo describe deja al sistema mintiendo sobre sí
//    mismo, y el siguiente que lea el metadato decidirá contra un número que ya no existe.
RJ.auditoria = RJ.auditoria || {};
RJ.auditoria.celdas = final.length;
RJ.auditoria.celdas_antes_de_fusionar = G.length;
RJ.auditoria.fusionadas_principal_fup = fusiones.length;
RJ.fusion_fup = {
  paso: 'resumen-fusionar', fecha: '2026-08-24',
  que_hizo: 'Fusiono ' + fusiones.length + ' celdas que eran un FUP sin su Principal, usando la foranea Pieza_Principal_ID.',
  por_que: 'El FUP sale en otra quincena que su Principal y la quincena esta en la llave, asi que caian en celdas separadas. Deducirlo por dimensiones era imposible.',
  celdas: G.length + ' -> ' + final.length, total_email: totalDespues,
  fusiones: fusiones.map(function (f) { return { via: f.via, campana: f.c.campana, touchpoint: f.c.touchpoint, segmento: f.c.segmento, quincena_fup: f.c.quincena, sends: sends(f.c, 'fup') }; }),
  sin_destino: sinDestino
};
fs.writeFileSync(BACK + '/_rejilla/rejilla.json', JSON.stringify(RJ, null, 1));
console.log('\n  ✔ rejilla fusionada → _rejilla/rejilla.json');
