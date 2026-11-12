// PUERTA-2 · PUERTA 2 — el gate de la capa de REPORTE. Como PUERTA-1, pero un piso más arriba.
//
// 🔴 QUÉ VIGILA QUE NADIE MÁS VIGILA. PUERTA-1 cruza los BLOQUES entre ellos: si cuadran, deja
//    escribir los datos. Pero entre los datos y el reporte hay dos saltos más —el motor y la
//    proyección— y cada uno puede perder o inventar sin que PUERTA-1 se entere, porque PUERTA-1 ya cerró.
//    Esta puerta mide el reporte contra la rejilla, y la rejilla contra los bloques: la cadena
//    entera, de punta a punta.
//
// 🔴 BLOQUEA vs AVISA lo decide la DIRECCIÓN de la diferencia, igual que en PUERTA-1:
//      reporte  >  rejilla  → el reporte INVENTÓ algo. Bloquea: no se publica un número que
//                             nadie midió.
//      reporte  <  rejilla  → el reporte PERDIÓ algo. Bloquea: alguien va a leer un total que
//                             no es el total.
//      rejilla  >  bloques  → el motor inventó. Bloquea.
//      rejilla  <  bloques  → el motor dejó fuera algo. AVISA solo si está EXPLICADO (envíos
//                             sin fecha, Qcart sin anclar). Si no está explicado, bloquea.
//
// 🔴 Y UNA PUERTA QUE NO SE PUEDE CERRAR ES UN ADORNO. `fuentes-cuadre.probar-que-cierra.js` rompe la
//    rejilla a propósito, uno por motivo, y comprueba que cierra y que vuelve a abrir.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'cuadre';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var REG = require(__dirname + '/lib-registro.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var bloqueos = [], avisos = [];
function bloquea(m, d) { bloqueos.push({ motivo: m, detalle: d }); }
function avisa(m, d) { avisos.push({ motivo: m, detalle: d }); }

console.log('════════ PUERTA-2 · PUERTA 2 ════════\n');
var R, B = {};
try { R = JSON.parse(fs.readFileSync(BACK + '/_rejilla/rejilla.json', 'utf8')); }
catch (e) { console.log('  🔴 no hay rejilla. Corre motor.motor.js primero.'); process.exit(1); }
['email', 'qcart', 'whatsapp'].forEach(function (n) { B[n] = JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + n + '.json', 'utf8')); });
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n7.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var Ftodo = XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { defval: '', blankrows: false });
// 🔴 LA FILA DE TOTALES NO ES UNA FILA DE DATOS. Rick mantiene al final una fila con `SUM(P2:P73)`
//    que suma todas las demás. Contarla como una fila más DUPLICA cada columna: la puerta veía
//    12,627,406 contra 6,220,891 y acusaba al reporte de «inventar» 6.4 M — cuando el reporte
//    estaba bien y el que sumaba de más era el guardián.
//    Se reconoce porque no tiene identidad: sin campaña ni touchpoint no es una pieza.
// Se reconoce por lo que NO tiene: una fila de totales no tiene TouchPoint. La de Rick además
// se llama «Total» en la columna Campaña, así que filtrar por «tiene campaña» no la atrapaba.
var F = Ftodo.filter(function (x) { return String(x['TouchPoint'] || '').trim(); });

// 🔴 LA PUERTA COMPARA LO QUE EL SISTEMA ESCRIBIÓ, NO LO QUE HAY EN LA HOJA.
//    La hoja tiene además filas que Rick llenó a mano —los splits de Qcart por activación, las dos
//    oleadas de Traditional Parents— que la rejilla todavía no reproduce. Contarlas como si el
//    sistema las hubiera puesto hacía que la puerta acusara al reporte de «inventar» 92,306 envíos
//    y 2,697 carritos que en realidad son trabajo suyo, correcto y deliberado.
//    Una puerta que grita por el trabajo del humano entrena a ignorar la puerta.
//    Se comparan solo las filas cuya identidad EXISTE en la rejilla; las demás se cuentan aparte.
//    🔴 Y LA IDENTIDAD SOLA NO BASTA: LLEVA LA QUINCENA. AON Traditional Parents E-P1 existe
//    dos veces en la hoja —la oleada de marzo y la de abril que Rick capturó a mano— con la
//    MISMA identidad. Con la llave sin quincena, la fila de abril pasaba el filtro (su identidad
//    sí está en la rejilla) y sus 66,204 envíos se comparaban contra una rejilla que no los
//    produce, porque el `Content_Name` duplicado en `CRM_Reporte_Config` impide que SFMC los
//    entregue. La puerta acusaba al reporte de inventar el trabajo correcto del humano.
var nmz = function (v) { return String(v || '').trim().toLowerCase(); };
var idRejilla = {};
R.rejilla.forEach(function (c) {
  idRejilla[[c.campana, c.objetivo, c.touchpoint, c.segmento, c.quincena].map(nmz).join('¦')] = 1;
});
// 🔴 EL NOMBRE DE LA QUINCENA SE LE PIDE AL REGISTRO. Estaba clavado como `Quincena_Lanzamiento`
//    y la hoja pasó a llamarla `Quincena_Lanzamiento Principal`: la llave salía SIN quincena, no
//    cruzaba con ninguna celda de la rejilla, y esta puerta clasificó **las 77 filas del reporte
//    como «filas de Rick»** y las excluyó todas. No tronó — se quedó muda, que es peor: el script
//    siguiente medía sobre 0 filas y declaraba la hoja vacía.
//    Es exactamente el defecto por el que existe el registro de nombres. Ahora se pregunta.
var COL_QUINCENA = (function () {
  try {
    var h = REG.abrir('resumen', (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || [])
      .map(function (x) { return String(x == null ? '' : x).trim(); }));
    return h.n('resumen.quincena_lanzamiento');
  } catch (e) {
    console.log('   🔴 el registro no resuelve `resumen.quincena_lanzamiento`: ' + e.message);
    process.exit(1);
  }
})();
var deRick = F.filter(function (x) {
  var k = [x['Campaña'], x['Objetivo'], x['TouchPoint'], x['Segmento'], x[COL_QUINCENA]].map(nmz).join('¦');
  return !idRejilla[k];
});
if (deRick.length) {
  console.log('   (' + deRick.length + ' fila(s) de la hoja no las produce la rejilla: son de Rick. Se comparan aparte.)');
  deRick.forEach(function (x) {
    console.log('      · ' + t(x['Campaña']) + ' · ' + t(x['TouchPoint']) + ' · ' + t(x['Segmento']) +
      ' [' + t(x[COL_QUINCENA]) + ']  Tot_Sends ' + mil(num(x['Tot_Sends']) || 0));
  });
  // 🔴 UNA FILA «DE RICK» QUE REPITE LOS EMAIL_ID DE UNA FILA DEL SISTEMA NO ES SUYA: ES UN
  //    CLON. Fue exactamente lo que pasó con AON Traditional Parents: el escritor copió la fila de
  //    marzo encima de la de abril (misma identidad, distinta quincena, y la llave no llevaba
  //    quincena). La puerta la excluyó por «es de Rick» y dejó pasar 66,204 envíos contados dos
  //    veces. Excluir una fila de la comparación NO puede significar dejar de mirarla.
  //    ⚠ el índice se construye con las filas DEL SISTEMA: `F` todavía trae las de Rick en este
  //      punto, y sin sacarlas cada fila se encuentra a sí misma y la puerta se acusa sola.
  var idsDelSistema = {};
  F.filter(function (x) { return deRick.indexOf(x) < 0; }).forEach(function (x) {
    t(x['Email_ID (SFMC)']).split(/[,;·]/).forEach(function (id) {
      if (t(id)) idsDelSistema[t(id)] = t(x['Campaña']) + ' · ' + t(x['TouchPoint']) + ' · ' + t(x['Segmento']) + ' [' + t(x[COL_QUINCENA]) + ']';
    });
  });
  deRick.forEach(function (x) {
    var chocan = t(x['Email_ID (SFMC)']).split(/[,;·]/).map(t).filter(function (id) { return id && idsDelSistema[id]; });
    if (chocan.length) {
      bloquea('una fila de Rick repite los Email_ID de una fila del sistema — doble conteo',
        t(x['Campaña']) + ' · ' + t(x['TouchPoint']) + ' · ' + t(x['Segmento']) + ' [' + t(x[COL_QUINCENA]) +
        '] con Email_ID ' + chocan.join(', ') + ' que ya están en ' + idsDelSistema[chocan[0]] +
        ' · ' + mil(num(x['Tot_Sends']) || 0) + ' envíos contados dos veces');
    }
  });
  F = F.filter(function (x) { return deRick.indexOf(x) < 0; });
}
if (F.length !== Ftodo.length) {
  console.log('   (se excluyen ' + (Ftodo.length - F.length) + ' fila(s) sin identidad: la de totales de Rick)');
}

// ══ 1 · EL REPORTE CONTRA LA REJILLA ════════════════════════════════════════════════
console.log('══ 1 · el reporte contra la rejilla ══');
// 🔴 se CUENTAN los registros, no se cree el número que la rejilla declara de sí misma.
//    Un bloque con `celdas: 70` y la lista vacía pasaría cualquier check que crea la cifra.
var celdasReales = (R.rejilla || []).length;
if (celdasReales !== (R.auditoria || {}).celdas) {
  bloquea('la rejilla dice una cosa y contiene otra',
    'declara ' + (R.auditoria || {}).celdas + ' celdas y tiene ' + celdasReales);
}
var pares = [
  ['Tot_Sends', function (c) { return c.total.sends; }],
  ['Tot_Deliveries', function (c) { return c.total.deliveries; }],
  ['Tot_Opens', function (c) { return c.total.opens; }],
  ['Tot_Clicks', function (c) { return c.total.clicks; }],
  ['WA-Envíos', function (c) { return c.whatsapp.sends; }],
  ['Carritos_Total', function (c) { return c.qcart ? c.qcart.carritos : 0; }]
];
pares.forEach(function (par) {
  var enHoja = F.reduce(function (a, x) { return a + (num(x[par[0]]) || 0); }, 0);
  var enRejilla = R.rejilla.reduce(function (a, c) { return a + (par[1](c) || 0); }, 0);
  var estado = enHoja === enRejilla ? '✔' : (enHoja > enRejilla ? '🔴 el reporte INVENTÓ' : '🔴 el reporte PERDIÓ');
  console.log('   ' + par[0].padEnd(18) + 'hoja ' + mil(enHoja).padStart(11) + '   rejilla ' + mil(enRejilla).padStart(11) + '   ' + estado);
  if (enHoja !== enRejilla) bloquea('el reporte no coincide con la rejilla en ' + par[0],
    'hoja ' + mil(enHoja) + ' vs rejilla ' + mil(enRejilla) + ' — ' + (enHoja > enRejilla ? 'inventó ' : 'perdió ') + mil(Math.abs(enHoja - enRejilla)));
});
if (F.length !== celdasReales) bloquea('la hoja no tiene una fila por celda', F.length + ' filas vs ' + celdasReales + ' celdas');

// ══ 2 · LA REJILLA CONTRA LOS BLOQUES ═══════════════════════════════════════════════
console.log('\n══ 2 · la rejilla contra los bloques ══');
function cuenta(arr, campo) { return (arr || []).reduce(function (a, e) { return a + (num(e[campo]) || 0); }, 0); }
var emailBloque = cuenta(B.email.envios, 'email_sends');
var emailRejilla = R.rejilla.reduce(function (a, c) { return a + c.total.sends; }, 0);
// lo que no llegó a la rejilla lo DECLARA el motor; la puerta comprueba la declaración, no la
// re-inventa. Si el motor no declara nada, `sinFecha` es 0 y cualquier hueco bloquea — que es
// exactamente lo que tiene que pasar: un envío perdido sin motivo escrito cierra la puerta.
var fueraEmail = (R.fuera_de_la_rejilla || []).filter(function (x) { return x.medio === 'email'; });
var sinFecha = fueraEmail.reduce(function (a, x) { return a + (num(x.sends) || 0); }, 0);
console.log('   email    bloque ' + mil(emailBloque) + '   rejilla ' + mil(emailRejilla) + '   declarados fuera ' + mil(sinFecha));
if (emailRejilla > emailBloque) bloquea('el motor INVENTÓ envíos de email', mil(emailRejilla - emailBloque) + ' de más');
else if (emailRejilla + sinFecha !== emailBloque) bloquea('el motor perdió envíos que NADIE explica',
  mil(emailBloque - emailRejilla - sinFecha) + ' sin motivo declarado');
else if (sinFecha) avisa('hay envíos que el motor dejó fuera de la rejilla',
  mil(sinFecha) + ' envíos — ' + fueraEmail.map(function (x) { return (x.content_name || '?').slice(-30) + ': ' + x.motivo; }).join(' · '));

var waBloque = cuenta(B.whatsapp.envios, 'sends');
var waRejilla = R.rejilla.reduce(function (a, c) { return a + c.whatsapp.sends; }, 0);
console.log('   whatsapp bloque ' + mil(waBloque) + '   rejilla ' + mil(waRejilla));
if (waRejilla !== waBloque) {
  if (waRejilla > waBloque) bloquea('el motor INVENTÓ envíos de WhatsApp', mil(waRejilla - waBloque));
  else bloquea('el motor perdió envíos de WhatsApp', mil(waBloque - waRejilla));
}

/* 🔴 24-sep-2026 · LA PUERTA MIDE EN VISTAS, NO EN FILAS. Un carrito es una VISTA: la fila del
 *    export de Qcart es un bucket (día × hora × shortlink × utm × tienda) con su contador `views`.
 *    Medido contra el export agregado del propio Qcart, `e-j7` da 221 = 221 en vistas y 86 en
 *    filas. Con la unidad vieja esta puerta gritaba «el motor INVENTÓ carritos» ante la
 *    corrección: comparaba 7,503 vistas contra 3,077 eventos.
 *    Sigue comparando reporte contra BLOQUE —la fuente que la puerta no escribe—, que es de donde
 *    saca su valor; lo único que cambia es en qué unidad. */
var qcBloque = (B.qcart.carritos || []).reduce(function (a, e) {
  return a + (Number(String(e.views == null ? '' : e.views).trim()) || 0);
}, 0);
var qcRejilla = R.rejilla.reduce(function (a, c) { return a + (c.qcart ? c.qcart.carritos : 0); }, 0);
var sinAncla = (R.auditoria || {}).qcart_sin_ancla || 0;
console.log('   qcart    bloque ' + mil(qcBloque) + '   rejilla ' + mil(qcRejilla) + '   bloques sin anclar ' + sinAncla);
if (qcRejilla > qcBloque) bloquea('el motor INVENTÓ carritos', mil(qcRejilla - qcBloque));
else if (qcRejilla < qcBloque && !sinAncla) bloquea('faltan carritos y no hay bloques sin anclar que lo expliquen', mil(qcBloque - qcRejilla));
else if (qcRejilla < qcBloque) avisa('hay Qcart sin dónde anclarse',
  sinAncla + ' bloque(s) campaña×mes con carritos y sin ningún envío Principal ese mes · ' + mil(qcBloque - qcRejilla) + ' carritos fuera');

// ══ 3 · EL DOBLE CONTEO DE QCART ════════════════════════════════════════════════════
console.log('\n══ 3 · que nadie cuente el Qcart dos veces ══');
// 🔴 ESTE CHECK ERA DEL MODELO VIEJO Y BLOQUEABA SIN RAZÓN. Agrupaba por `campaña ¦ mes` y
//    bloqueaba si una campaña tenía más de una celda con Qcart ese mes. Eso valía cuando el Qcart
//    se anclaba UNA vez por campaña; **con F1 el Qcart va por touchpoint × segmento**, así que
//    varias celdas por campaña es exactamente lo que el reporte debe mostrar — y este check
//    prohibía justo la mejora.
//
//    Lo que sí hay que vigilar es el doble conteo REAL: que los carritos de una misma PIEZA no
//    estén en dos celdas. Eso sí duplicaría al sumar la columna.
var porPieza = {};
R.rejilla.filter(function (c) { return c.qcart && c.qcart.carritos > 0; }).forEach(function (c) {
  // las piezas cuyo Qcart vive en esta celda: la ancla, más las que se sumaron o llegaron por FUP
  var suyas = (c.qcart.piezas_sumadas || []).slice();
  if (c.qcart.via_fup) suyas = suyas.concat(t(c.qcart.via_fup).split(/\s*\+\s*/));
  if (!suyas.length) suyas = (c.piezas || []).slice(0, 1);
  suyas.filter(Boolean).forEach(function (p) {
    (porPieza[t(p)] = porPieza[t(p)] || []).push(t(c.campana) + '|' + t(c.touchpoint) + '|' + t(c.segmento) + '|' + t(c.quincena));
  });
});
var dobles = Object.keys(porPieza).filter(function (p) {
  return porPieza[p].filter(function (v, i, a) { return a.indexOf(v) === i; }).length > 1;
});
var celdasConQ = R.rejilla.filter(function (c) { return c.qcart && c.qcart.carritos > 0; }).length;
console.log('   celdas con Qcart: ' + celdasConQ + ' (por touchpoint × segmento, como manda F1)   ·   piezas con Qcart en 2+ celdas: ' + dobles.length);
if (dobles.length) bloquea('🔴 los carritos de una misma PIEZA están en dos celdas',
  dobles.slice(0, 5).map(function (p) { return p + ' → ' + porPieza[p].join(' y '); }).join(' · ') +
  ' — sumar la columna contaría el mismo carrito dos veces');

// ══ 4 · LO QUE EL REPORTE NO PUEDE PRESENTAR COMO SI FUERA OTRA COSA ═══════════════
console.log('\n══ 4 · lo que no se puede disfrazar ══');
var sinResolver = R.rejilla.filter(function (c) { return !c.campana_del_catalogo; });
if (sinResolver.length) {
  var pos = sinResolver.map(function (c) {
    return F.findIndex(function (x) {
      return t(x['Campaña']) === t(c.campana) && t(x[COL_QUINCENA]) === t(c.quincena) && t(x['TouchPoint']) === t(c.touchpoint);
    });
  }).filter(function (i) { return i >= 0; });
  var ultAtrib = Math.max.apply(null, R.rejilla.filter(function (c) { return c.campana_del_catalogo; }).map(function (c) {
    return F.findIndex(function (x) {
      return t(x['Campaña']) === t(c.campana) && t(x[COL_QUINCENA]) === t(c.quincena) && t(x['TouchPoint']) === t(c.touchpoint);
    });
  }));
  var mezcladas = pos.filter(function (i) { return i < ultAtrib; });
  console.log('   filas sin atribuir: ' + sinResolver.length + '   mezcladas con las atribuidas: ' + mezcladas.length);
  if (mezcladas.length) bloquea('hay filas SIN ATRIBUIR mezcladas con las atribuidas',
    mezcladas.length + ' filas — el lector no puede distinguir un dato con pieza de uno sin pieza');
  else avisa('el reporte lleva filas sin atribuir', sinResolver.length + ' filas al final, separadas · son envíos sin pieza en el catálogo');
}
var ctorInventado = (R.por_registro.whatsapp || []).filter(function (x) { return x.CTOR !== null && x.CTOR_no_calculable; });
if (ctorInventado.length) bloquea('hay CTOR calculado sobre clicks que no están medidos', ctorInventado.length + ' registros');
else console.log('   CTOR de WhatsApp: ' + (R.por_registro.whatsapp || []).filter(function (x) { return x.CTOR_no_calculable; }).length +
  ' no calculables, todos en null ✔');

// 🔴 LA HOJA TERMINADA NO PUEDE TENER UNA COLUMNA QUE NADIE LLENÓ. Aquí sí se puede exigir:
//    PUERTA-2 corre al final, con resumen-regenerar, insights-redactar y el formato ya aplicados. Es el único punto del ciclo donde
//    preguntar «¿esta columna tiene dato?» mide algo real — antes, la respuesta sería «todavía no».
//    `Insights` llegó a existir sin que nadie la creara nunca: insights-redactar se detenía con «no encontré la
//    columna Insights» y en seco eso se leía como vista previa, no como fallo.
(function () {
  var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Report_Resumen'], { header: 1 })[0] || [])
    .map(function (x) { return String(x || '').trim(); });
  // 🔴 «NO EXISTE» Y «EXISTE VACÍA» NO SON LO MISMO (3-sep-2026), y tratarlos igual atoró el corte.
  //    · **existe y está vacía** → el escritor de esa columna falló. BLOQUEA: el reporte sale con
  //      una columna muda y nadie se entera.
  //    · **no existe** → alguien la retiró, y ese alguien es el dueño del reporte. Rick borró a
  //      mano 17 columnas el 27-ago —todo el bloque de clicks, las de Unsubscribe e `Insights`—
  //      y dejó sus notas al lado. Bloquear por eso es exigirle al sistema que deshaga una
  //      decisión suya. AVISA y viaja al handoff, que es justo para lo que existe el aviso.
  var EXIGE = ['Insights'];
  var vacias = [], ausentes = [];
  EXIGE.forEach(function (nom) {
    if (enc.indexOf(nom) < 0) { ausentes.push(nom); return; }
    var con = F.filter(function (f) { return String(f[nom] == null ? '' : f[nom]).trim(); }).length;
    if (con === 0) vacias.push(nom + ': existe pero está vacía en las ' + F.length + ' filas');
  });
  if (vacias.length) {
    bloqueos.push({
      motivo: 'la hoja terminada deja ' + vacias.length + ' columna(s) sin llenar',
      detalle: vacias.join(' · ') + '  — el reporte se entrega con una columna muda'
    });
  }
  if (ausentes.length) {
    console.log('  ⚠ columna(s) que el contrato pide y NO están en la hoja: ' + ausentes.join(' · '));
    console.log('     Rick las retiró a mano; no se reponen. El reporte se entrega sin ellas.');
    if (typeof avisos !== 'undefined' && avisos && avisos.push) {
      avisos.push('⚠ el reporte se entrega SIN ' + ausentes.join(' · ') + ': Rick retiró esas columnas a mano el 27-ago');
    }
  }
  if (!vacias.length && !ausentes.length) {
    console.log('  ✔ columnas exigidas en la hoja final: ' + EXIGE.join(' · ') + ' — todas con dato');
  }
})();

// ══ VEREDICTO ══════════════════════════════════════════════════════════════════════
console.log('\n════════ VEREDICTO ════════');
if (bloqueos.length) {
  console.log('  🔴 PUERTA CERRADA — ' + bloqueos.length + ' motivo(s). El reporte NO se publica.');
  bloqueos.forEach(function (b) { console.log('     🔴 ' + b.motivo + '\n        ' + b.detalle); });
} else {
  console.log('  ✅ PUERTA ABIERTA — el reporte dice lo que dice la rejilla, y la rejilla lo que dicen los bloques');
}
if (avisos.length) {
  console.log('\n  ⚠ ' + avisos.length + ' aviso(s) — no detienen, pero viajan al reporte:');
  avisos.forEach(function (a) { console.log('     · ' + a.motivo + '\n       ' + a.detalle); });
}
fs.writeFileSync(BACK + '/_rejilla/veredicto-puerta2.json', JSON.stringify({
  paso: 'PUERTA-2 · puerta 2', cuando: new Date().toISOString().slice(0, 16).replace('T', ' '),
  abierta: bloqueos.length === 0, bloqueos: bloqueos, avisos: avisos,
  medido: { filas_reporte: F.length, celdas_rejilla: celdasReales, email_bloque: emailBloque, email_rejilla: emailRejilla }
}, null, 1));
console.log('\n  → ' + BACK + '/_rejilla/veredicto-puerta2.json');
process.exit(bloqueos.length ? 1 : 0);
