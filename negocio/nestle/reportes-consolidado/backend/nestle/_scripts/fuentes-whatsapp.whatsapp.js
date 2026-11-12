// whatsapp-bloque · BLOQUE WHATSAPP — arma el bloque de envíos en el backend. NO escribe el Excel.
//
// 🔴 LO QUE ESTE SCRIPT NO HACE: calcular. `Data_WhatsApp` trae hoy 4 columnas que son de motor-calculo
//    —`Delivery_Rate`, `Read_Rate`, `CTOR`, `Pct_Error`— y aquí no entran. Solo datos.
//
// ⚠ WhatsApp es el 0.15% del volumen (7,374 envíos vs 5 millones de email) pero es el que más
//   fácil miente: sus 5 hojas no comparten esquema, traen filas de SUBTOTAL que duplican, y una
//   de ellas DERIVA los clicks de un supuesto. Ninguna de esas tres cosas se ve en un total.
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
var A = require(__dirname + '/lib-whatsapp-ancla.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = A.t;
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

console.log('════════ whatsapp-bloque · BLOQUE WHATSAPP ════════\n');

// ══ 1 · EL HANDOFF DE insumos-validar ════════════════════════════════════════════════════════════
var inv;
try { inv = JSON.parse(fs.readFileSync(BACK + '/_insumos/inventario.json', 'utf8')); }
catch (e) { console.log('  🔴 no hay handoff de insumos-validar. Corre primero fuentes-insumos.insumos.js.'); process.exit(1); }
var f = inv.forma && inv.forma.whatsapp;
if (!f || !f.ruta) { console.log('  🔴 el handoff no trae la fuente de WhatsApp.'); process.exit(1); }
if (!fs.existsSync(f.ruta)) { console.log('  🔴 la fuente no está en disco: ' + f.ruta); process.exit(1); }

// ══ 2 · LEER LAS 5 HOJAS ════════════════════════════════════════════════════════════
var R = W.leer(f.ruta, { sinSolapes: true });   // los solapes se resuelven DESPUÉS de enriquecer
console.log('  fuente: ' + R.archivo + '   (solo lectura)');
// 🔴 SE REPORTA POR TABLA, NO POR HOJA. Una hoja trae varias tablas apiladas con encabezados
//    distintos; contarlas juntas fue lo que escondió el defecto durante todo whatsapp-bloque.
console.log('\n  ── las tablas de envíos (una hoja puede traer varias)');
R.tablas.forEach(function (h) {
  console.log('     ' + t(h.hoja).slice(0, 15).padEnd(16) + 'enc f' + String(h.encabezado_en_fila).padStart(2) + '  ' +
    String(h.envios || 0).padStart(3) + ' envíos · Σ ' + mil(h.acumulado).padStart(7) +
    '   fecha: ' + (h.tiene_columna_de_fecha ? 'sí' : '🔴 NO') +
    ((h.columnas_sin_mapear || []).length ? '   sin mapear: ' + h.columnas_sin_mapear.slice(0, 2).join(' · ') : ''));
});
console.log('\n  ── tablas DESCARTADAS (no se leen con el encabezado de otra)');
if (!R.tablas_descartadas.length) console.log('     ninguna');
R.tablas_descartadas.forEach(function (d) {
  console.log('     ' + t(d.hoja).slice(0, 15).padEnd(16) + 'f' + String(d.desde_fila).padStart(3) + '  ' +
    String(d.filas).padStart(2) + ' filas  → ' + d.motivo);
});

// 🔴 los subtotales: se excluyen, y se dice cuáles y por qué
console.log('\n  ── filas de SUBTOTAL excluidas (cargarlas duplica la hoja)');
R.subtotales.forEach(function (s) {
  console.log('     ' + t(s.hoja).slice(0, 15).padEnd(16) + 'f' + String(s.fila).padStart(3) + '  «' + s.etiqueta + '»  dice ' +
    mil(s.sends_de_la_fila) + ' · la suma de arriba es ' + mil(s.suma_de_las_de_arriba) +
    '  ' + (s.cuadra ? '✔ confirmado por aritmética' : '⚠ NO cuadra: se declara, no se asume'));
});

// ══ 2b · LA FECHA QUE LA FUENTE NO TRAE, DEL DOC DE LINKS ═══════════════════════════
//
// 🔴 Un envío sin fecha no cae en ningún periodo, y TODO reporte pivota por periodo: se caería
//    en silencio. La tabla `Maggi Mundial` no tiene columna de fecha — no es que esté vacía, es
//    que no existe. Decisión de Rick (19-ago-2026): **la fecha sale de la activación del link
//    en `Qcart-Links Mails-Hive- MX.xlsx`**, que es la autoridad que qcart-activacion ya resolvió.
//
// ⚠ Esto NO es adivinar. Es leer otra autoridad y DECLARAR de dónde salió: el envío se queda con
//   `fecha_via` y `fecha_nota`, así que río abajo se puede distinguir una fecha medida de una
//   derivada. Si ningún código del `utm_content` está en el doc, la fecha se queda en null y se
//   dice por qué — nunca se inventa.
//
// 🔴 Y la prueba de que la regla no es circular: se aplica también a los envíos que YA tienen
//    fecha de la fuente, y tiene que dar lo mismo. Si discrepara ahí, la regla estaría mal.
var ACT = {};
try { ACT = (JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8')).links_validos) || {}; }
catch (e) { console.log('\n  ⚠ no pude leer activacion-qcart.json: corre antes fuentes-qcart.activacion-qcart.js'); }

function codigosDe(s) {
  return String(s == null ? '' : s).split(/[\r\n;,\/\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}
function fechaDelDoc(e) {
  var cods = codigosDe(e.utm_content);
  if (!cods.length) return { fecha: null, motivo: 'el envío no trae utm_content: no hay código con qué buscar en el doc' };
  var hits = cods.map(function (c) { return ACT[c] ? { codigo: c, fecha: ACT[c].fecha_activacion } : null; }).filter(Boolean);
  if (!hits.length) return { fecha: null, motivo: 'ninguno de sus códigos (' + cods.join(', ') + ') está en el doc de links' };
  var fechas = hits.map(function (h) { return h.fecha; }).filter(Boolean).sort();
  var unicas = fechas.filter(function (f, i) { return fechas.indexOf(f) === i; });
  return {
    fecha: unicas[0] || null,               // la PRIMERA activación, igual que en el catálogo
    codigos: hits.map(function (h) { return h.codigo; }),
    varias: unicas.length > 1 ? unicas : null,
    motivo: null
  };
}

// La SEGUNDA variable: las tablas que el lector descarta por no medir envíos igual saben fechas.
// La tabla-calendario de `Maggi Mundial` dice «Semifinal A · 14/07/26 · sbH9gVge…» — es una
// afirmación independiente del doc de links, hecha por otra persona en otro documento.
// 🔴 Nunca atribuir con una sola variable: sin este cruce, la fecha derivada sería mi palabra.
function fechaEnCalendarios(codigos) {
  var out = [];
  (R.tablas_descartadas || []).forEach(function (tab) {
    if (!tab.tiene_fecha || !tab.filas_datos) return;
    var iF = tab.cols.indexOf('fecha');
    if (iF < 0) tab.cols.forEach(function (c, k) { if (/fecha|date/.test(c) && iF < 0) iF = k; });
    tab.filas_datos.forEach(function (fila) {
      var texto = fila.celdas.join(' ');
      var cual = codigos.filter(function (c) { return texto.indexOf(c) >= 0; });
      if (!cual.length) return;
      var f = W.isoFecha(fila.celdas[iF]);
      if (f) out.push({ tabla: tab.hoja + ' f' + tab.desde_fila, fila: fila.fila, fecha: f, codigos: cual });
    });
  });
  return out;
}

var puestas = 0, cruzadas = 0, discrepan = [], sinCruce = [];
R.envios.forEach(function (e) {
  var d = fechaDelDoc(e);
  var cal = fechaEnCalendarios(codigosDe(e.utm_content));
  if (e.fecha) {                             // ya la trae la fuente → sirve para PROBAR la regla
    if (d.fecha) { cruzadas++; if (d.fecha !== e.fecha) discrepan.push({ envio: e.hoja + '!' + e.fila_en_hoja, contra: 'fuente', a: e.fecha, b: d.fecha, codigos: d.codigos }); }
    e.fecha_via = 'fuente';
    return;
  }
  if (!d.fecha) { e.fecha_via = null; e.fecha_nota = 'SIN FECHA · ' + (e.fecha_ausente_motivo || '') + ' · ' + d.motivo; return; }

  // el cruce contra el calendario, que es la variable independiente
  var conCal = cal.filter(function (c) { return c.fecha !== d.fecha; });
  if (cal.length) { cruzadas++; if (conCal.length) conCal.forEach(function (c) { discrepan.push({ envio: e.hoja + '!' + e.fila_en_hoja, contra: 'calendario ' + c.tabla + '!' + c.fila, a: c.fecha, b: d.fecha, codigos: c.codigos }); }); }
  else sinCruce.push(e.hoja + '!' + e.fila_en_hoja);

  e.fecha = d.fecha;
  e.fecha_via = 'doc de links de Qcart';
  e.fecha_nota = 'fecha tomada de la ACTIVACION del link en el doc de Qcart-Links (la tabla de origen no trae columna de fecha). ' +
    'Codigos: ' + d.codigos.join(', ') +
    (cal.length ? ' · confirmada por el calendario de la hoja (' + cal[0].tabla + '!' + cal[0].fila + ': ' + cal[0].fecha + ')' : ' · SIN segunda fuente que la confirme') +
    (d.varias ? ' · los codigos daban ' + d.varias.length + ' fechas (' + d.varias.join(', ') + '), se toma la primera activacion' : '');
  puestas++;
});

console.log('\n  ── la fecha que la fuente no trae, del doc de links');
console.log('     envíos con fecha PUESTA por el doc : ' + puestas);
console.log('     comprobaciones contra una SEGUNDA fuente: ' + cruzadas);
// 🔴 con 0 comprobaciones, un ✔ no dice «está bien»: dice «no se probó». No son lo mismo.
if (!cruzadas) console.log('     🔴 la regla NO se pudo probar contra ninguna otra fuente — el verde de abajo no valdría nada');
else console.log('     ' + (discrepan.length ? '🔴 ' + discrepan.length + ' discrepan → la regla estaría mal' : '✔ ' + cruzadas + '/' + cruzadas + ' coinciden: dos fuentes independientes dicen la misma fecha'));
discrepan.forEach(function (x) { console.log('        ' + x.envio + '  ' + x.contra + ' ' + x.a + ' vs doc ' + x.b + '  (' + (x.codigos || []).join(',') + ')'); });
if (sinCruce.length) console.log('     ⚠ sin segunda fuente: ' + sinCruce.join(' · '));
R.envios.filter(function (e) { return e.fecha_via === 'doc de links de Qcart'; }).forEach(function (e) {
  console.log('     ✔ ' + (e.hoja + '!' + e.fila_en_hoja).padEnd(20) + e.fecha + '   por ' + codigosDe(e.utm_content).join(' · '));
});
if (discrepan.length) {
  R.avisos.push({ tipo: 'fecha_doc_discrepa', cuantas: discrepan.length, detalle: '🔴 el doc de links y la fuente NO coinciden donde ambos dan fecha: la regla de derivar la fecha del link no se puede confiar hasta resolverlo.', filas: discrepan });
}
if (puestas) {
  R.avisos.push({
    tipo: 'fecha_derivada_del_doc', cuantas: puestas,
    detalle: '⚠ ' + puestas + ' envío(s) tomaron su fecha de la ACTIVACIÓN del link en el doc de Qcart (su tabla no trae columna de fecha). Queda declarado en `fecha_via` y en Notas — es derivada, no medida.'
  });
}
// ── los solapes, AHORA que los envíos ya tienen todas sus fechas ────────────────────
// El lector los dejó sin resolver a propósito (`sinSolapes`). Su desempate usa la fecha, así
// que resolverlos antes de derivarla es desempatar con menos información de la que hay.
W.marcarSolapes(R);

// ⚠ el aviso de «sin fecha» se recalcula al final: contarlo antes denunciaría envíos que aquí
//   acaban de resolverse o que los solapes acaban de excluir. Un aviso que sobra-cuenta se
//   aprende a ignorar, y entonces deja de servir el día que dice la verdad.
R.avisos = R.avisos.filter(function (a) { return a.tipo !== 'envios_sin_fecha'; });

// ⚠ lo mismo con `tabla_sin_fecha`: el lector lo emite sin saber que después alguien le va a
//   conseguir la fecha por otra vía. Decir «sus 5 envíos no se pueden ubicar» cuando ya se
//   ubicaron es un aviso falso, y los falsos son los que enseñan a no leer los avisos.
R.avisos = R.avisos.map(function (a) {
  if (a.tipo !== 'tabla_sin_fecha') return a;
  var suyos = R.envios.filter(function (e) { return e.hoja === a.hoja && e.encabezado_en_fila === a.encabezado_en_fila; });
  var huerfanos = suyos.filter(function (e) { return !e.fecha; });
  if (!huerfanos.length) {
    return {
      tipo: 'tabla_sin_fecha', hoja: a.hoja, encabezado_en_fila: a.encabezado_en_fila, cuantas: 0,
      detalle: '⚠ esta tabla no trae columna de fecha, pero sus ' + suyos.length +
        ' envío(s) la obtuvieron del doc de links de Qcart. Quedan ubicables — con la fecha DERIVADA, no medida.'
    };
  }
  return Object.assign({}, a, {
    cuantas: huerfanos.length,
    detalle: '🔴 esta tabla NO trae columna de fecha y ' + huerfanos.length + ' de sus ' + suyos.length +
      ' envíos tampoco la consiguieron del doc de links: esos no se pueden ubicar en ningún periodo.'
  });
});
var siguenSinFecha = R.envios.filter(function (e) { return !e.fecha; });
if (siguenSinFecha.length) {
  R.avisos.push({
    tipo: 'envios_sin_fecha', cuantas: siguenSinFecha.length,
    detalle: '🔴 ' + siguenSinFecha.length + ' de ' + R.envios.length + ' envíos siguen sin fecha, ni de la fuente ni del doc de links: no se pueden ubicar en ningún periodo.',
    filas: siguenSinFecha.map(function (e) { return e.hoja + '!' + e.fila_en_hoja + ' · ' + (e.fecha_nota || ''); })
  });
}

// ══ 3 · EL ANCLA AL CATÁLOGO ════════════════════════════════════════════════════════
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n2c.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var CANON = require(BACK + '/_scripts/lib-canonico.js');
var IXPZ = CANON.indexarPiezas(P);
// los encabezados se PIDEN, no se escriben: `lib-columna` resuelve el nombre real o truena
var NM_PIEZA_ID = COL.de(P, 'Pieza' + '_ID', 'catalogo');
var NM_FECHA_1 = COL.de(P, 'Fecha' + '_Primer_Envio', 'catalogo');

var vias = {}, bloque = [];
R.envios.forEach(function (e) {
  var r = A.atribuir(P, e);
  vias[r.via] = (vias[r.via] || 0) + 1;
  // 🔴 LA NOTA SE COMPONE AQUÍ, NO EN EL ESCRITOR. La armaba `valorDe()` dentro de N3-07 —
  //    con dos copias del mismo código. Componerla en el bloque es lo que hace que el escritor
  //    solo copie: el bloque entrega la celda ya lista, no las piezas para armarla.
  var notas = [
    e.clicks_nota || '',
    // 🔴 LA CONTRADICCIÓN DE ENTREGAS TAMBIÉN VIAJA (30-sep-2026). `entrega_coherente:false` y su
    //    `entrega_nota` se calculaban bien y **no los veía nadie**: vivían solo en el JSON del
    //    bloque, y la celda `Notas` de la hoja solo traía la de clicks. Con J-10 la fuente se
    //    contradice en DOS de sus tres envíos —dice 824 entregados de 1,085 pero declara 173
    //    fallos— y sin esto el reporte enseña un `WA-Entregados` derivado sin decir por qué no es
    //    el que trae la hoja. Un aviso que solo existe en un JSON es un aviso que no se dio.
    e.entrega_coherente === false ? (e.entrega_nota || 'la hoja se contradice en las entregas') : '',
    e.fecha_via === 'doc de links de Qcart' ? e.fecha_nota : '',
    e.fecha ? '' : (e.fecha_nota || 'SIN FECHA - no se puede ubicar en ningun periodo'),
    r.pieza_id ? '' : 'sin pieza: ' + (r.motivo || ''),
    'origen: ' + e.hoja + '!' + e.fila_en_hoja
  ].filter(Boolean).join(' · ');

  // 🔴 las 4 canónicas, con la MISMA librería que email y qcart. Es lo único que hace cierta la
  //    regla de que coincidan entre hojas: una sola función resolviendo para las cuatro fuentes.
  var can = CANON.resolver(IXPZ, null, { pieza_id: r.pieza_id, content_name: e.utm_content });

  bloque.push(Object.assign({}, e, {
    pieza_id: r.pieza_id, via_atribucion: r.via,
    candidatas: r.candidatas || null, motivo_sin_pieza: r.pieza_id ? null : r.motivo,
    notas_compuestas: notas,
    bu_canonico: can.bu, marca_canonica: can.marca,
    campana_canonica: can.campana, segmento_canonico: can.segmento,
    // 🔴 el touchpoint canónico: la hoja se quedaba con el crudo (`WA-SF-A` donde el catálogo dice
    //    `Semifinal A`) porque ningún bloque producía este campo, y el contrato lo pedía.
    touchpoint_canonico: can.touchpoint,
    canonico_via: can.via
  }));
});
// 🔴 QUÉ DECIDIÓ UNA HEURÍSTICA EN VEZ DE UN ALIAS DECLARADO.
//    El sistema prohíbe inferir del naming: las dimensiones salen de las autoridades. El ancla
//    de WhatsApp todavía infiere (plural/singular y subcadena) porque hoy resuelve cruces reales.
//    Cada inferencia se imprime para poder MIGRARLA a un alias en `Catalogo_Referencias` — el
//    objetivo es que esta lista quede vacía y la heurística se pueda borrar.
var inferidas = A.inferenciasHechas ? A.inferenciasHechas() : [];
if (inferidas.length) {
  console.log('\n  ── ⚠ ' + inferidas.length + ' cruce(s) los decidió una HEURÍSTICA, no un alias declarado');
  inferidas.forEach(function (i) {
    console.log('     [' + i.heuristica + ']  «' + i.a + '»  ≟  «' + i.b + '»');
  });
  console.log('     → cada uno debería ser un alias en Catalogo_Referencias, y entonces la heurística sobra');
}

console.log('\n  ── el ancla (nunca una sola variable; la ambigua se declara)');
Object.keys(vias).sort().forEach(function (v) { console.log('     ' + String(vias[v]).padStart(3) + '  ' + v); });
var conPieza = bloque.filter(function (e) { return e.pieza_id; }).length;
console.log('     ── atribuidos: ' + conPieza + ' de ' + bloque.length);

// ══ 4 · EL APPEND ═══════════════════════════════════════════════════════════════════
// Sin cadencia: se agregan campañas cuando ocurren. Lo ya cargado no se toca.
var prev = { envios: [] };
var out_desaparecidos = [];
try { prev = JSON.parse(fs.readFileSync(BACK + '/_fuentes/whatsapp.json', 'utf8')); } catch (e) { }
prev.envios = prev.envios || [];

// 🔴 SI CAMBIA EL LECTOR, LO CARGADO ANTES NO ES HISTORIA: ES SALIDA MALA.
//    El append conserva lo ya cargado porque un envío pasado no cambia. Eso vale mientras la
//    forma de LEER la fuente sea la misma. Cuando el lector se corrige, lo de antes se leyó con
//    reglas ya probadas equivocadas, y sumarle lo corregido deja las dos versiones dentro:
//    pasó aquí — 26 envíos corruptos + 13 buenos = 31, con la corrupción intacta y creciendo.
//    Reconstruir se DECLARA, y se dice cuánto se descartó.
// 🔴 LA VERSIÓN TIENE QUE CUBRIR TODO LO QUE CAMBIA CÓMO SE VE UN ENVÍO, no solo el lector.
//    Al derivar la fecha del doc de links, `Maggi Mundial!4` pasó de «(sin fecha)» a
//    «2026-07-14» — y la fecha va DENTRO de la llave, así que el append lo vio como un envío
//    nuevo y dejó los dos: 14 envíos, Σ 16,624, con 1,981 duplicados. El lector no había
//    cambiado, así que no hubo reconstrucción.
//    Por eso la versión es de DOS mitades, y cada una se mueve por su cuenta.
var ENRIQUECIMIENTO = 2;   // v1: fecha derivada del doc de links · v2: los solapes se resuelven ya enriquecido
var VERSION = W.LECTOR + '.' + ENRIQUECIMIENTO;

// 🔴 LA FORMA DEL REGISTRO, NO SOLO LA VERSIÓN QUE YO ME ACUERDE DE SUBIR.
//    Acabo de agregar el campo `notas_compuestas` y NO llegó al bloque: los 13 envíos ya
//    estaban, el append los dio por repetidos, y el bloque final se quedó con los viejos —
//    sin el campo. La versión existía justo para eso y se me olvidó subirla.
//    Un mecanismo que depende de que alguien se acuerde no es un mecanismo. Así que además de
//    la versión se compara la FORMA: la lista de campos que produce el script. Si cambia, se
//    reconstruye sola. Es lo que hace que «cada corrida sume solo lo nuevo» sea cierto en vez
//    de ser cierto solo mientras nadie toque nada.
// 🔴 LA FORMA ES LA UNIÓN DE TODOS LOS REGISTROS, no la del primero. Medirla en `regs[0]` deja
//    invisible el caso que de verdad pasa: una PARTE de los registros pierde campos y el resto no.
//    Fue lo que tapó que los 12 envíos venían sin `notas_compuestas` ni canónicas — el registro 0
//    estaba tan incompleto como los demás, así que la forma se veía consistente consigo misma.
//    Es el mismo error que el sistema persigue en otro lado: comparar un bloque contra sí mismo.
function formaDe(regs) {
  var u = {};
  (regs || []).forEach(function (r) { Object.keys(r || {}).forEach(function (k) { u[k] = 1; }); });
  return Object.keys(u).sort().join(',');
}
var formaNueva = formaDe(bloque), formaVieja = formaDe(prev.envios);
var cambioForma = prev.envios.length > 0 && formaNueva !== formaVieja;
var reconstruye = String(prev.lector || 1) !== VERSION || cambioForma;
if (cambioForma) {
  var nuevosC = formaNueva.split(',').filter(function (c) { return formaVieja.split(',').indexOf(c) < 0; });
  var idosC = formaVieja.split(',').filter(function (c) { return formaNueva.split(',').indexOf(c) < 0; });
  console.log('\n  🔴 CAMBIÓ LA FORMA DEL REGISTRO' +
    (nuevosC.length ? '   campos nuevos: ' + nuevosC.join(' · ') : '') +
    (idosC.length ? '   campos que se fueron: ' + idosC.join(' · ') : ''));
  console.log('     el append habría dado los 13 por «repetidos» y el campo nuevo nunca llegaría.');
}
if (reconstruye) {
  // ⚠ decir el motivo REAL. Antes imprimía siempre «venía de la versión X y esta es la Y»
  //   incluso cuando reconstruía por la forma y las dos versiones eran la misma — un mensaje
  //   que se contradice a sí mismo enseña a no leer los mensajes.
  var motivo = cambioForma
    ? 'cambió la FORMA del registro: el append daría los de antes por repetidos y el campo nuevo nunca llegaría'
    : 'la versión pasó de ' + (prev.lector || 1) + ' a ' + VERSION + ': se leyó con reglas que ya se probaron equivocadas';
  console.log('\n  🔴 RECONSTRUCCIÓN — ' + motivo);
  console.log('     se descarta lo cargado antes: ' + prev.envios.length + ' envíos · Σ ' +
    mil(prev.envios.reduce(function (a, e) { return a + (e.sends || 0); }, 0)));
  prev = { envios: [], descartado: { motivo: motivo, lector_viejo: prev.lector || 1, envios: prev.envios.length } };
}
var idx = {}, nuevos = [], repetidos = 0;
prev.envios.forEach(function (e) { idx[W.llaveEnvio(e)] = 1; });
bloque.forEach(function (e) {
  var k = W.llaveEnvio(e);
  if (idx[k]) { repetidos++; return; }
  idx[k] = 1; nuevos.push(e);
});
var final = prev.envios.concat(nuevos);

// ── 🔴 TRES CORRECCIONES AL APPEND (20-ago) ───────────────────────────────────────────────
// El append conserva lo acumulado y agrega lo nuevo. Correcto mientras la fuente solo CREZCA.
// Pero la fuente de WhatsApp se consolida completa cada vez, y además cambió la interpretación:
//   1 · lo que la lectura de HOY excluye por solape, sale — aunque estuviera en el JSON anterior.
//       Al corregir la regla, `Finales` pasó a leerse como UN envío de 1,965 y el append lo sumó
//       ADEMÁS de los 982+983 viejos: 17,931 donde la fuente dice 14,643, y en verde.
//   2 · si la misma fila de la fuente aparece dos veces (porque al anclarla cambió su llave),
//       manda la de hoy.
//   3 · lo que estaba antes y hoy la fuente ya no trae, se DECLARA — no se conserva a escondidas.
(function () {
  // 🔴 SE INDEXA EL BLOQUE ENRIQUECIDO, NO `R.envios`. `R.envios` es la lectura CRUDA: no tiene
  //    `pieza_id`, ni las cuatro canónicas, ni `notas_compuestas`. Indexando el crudo, esta
  //    resolución de solapes sustituía CADA registro enriquecido por su gemelo sin enriquecer y
  //    tiraba a la basura todo el trabajo de las líneas de arriba — la nota se componía y se perdía.
  //    Se notó porque el contrato pedía `notas_compuestas` al bloque y el bloque no la tenía;
  //    los 12 envíos llevaban semanas escribiéndose sin su columna de notas y sin sus canónicas.
  //    `bloque` conserva `hoja` y `fila_en_hoja` (sale de `Object.assign({}, e, …)`), así que la
  //    llave de esta resolución es la misma: cambia el contenido, no el emparejamiento.
  var fueraHoy = {}, hoyPorFila = {};
  (R.excluidos_por_solape || []).forEach(function (e) { fueraHoy[e.hoja + '!' + e.fila_en_hoja] = 1; });
  bloque.forEach(function (e) { hoyPorFila[e.hoja + '!' + e.fila_en_hoja] = e; });

  var antes = final.length, visto = {}, salida = [];
  final.forEach(function (e) {
    var k = e.hoja + '!' + e.fila_en_hoja;
    if (fueraHoy[k]) return;                       // 1 · hoy lo excluye
    if (visto[k]) return;                          // 2 · duplicado
    visto[k] = 1;
    // 🔴 SE FUSIONA, NO SE ELIGE — la misma lección que en los solapes. La versión de HOY trae la
    //    lectura corregida (fechas, utms, partido); la acumulada trae la ATRIBUCIÓN que ya se
    //    había resuelto. Quedarse solo con la de hoy borraba el `pieza_id` de Hotcakes y Tercer
    //    Tiempo, que el lector no reasigna. Manda la de hoy en los datos, y hereda lo que le falte.
    var h = hoyPorFila[k];
    if (h) {
      if (!t(h.pieza_id) && t(e.pieza_id)) { h.pieza_id = e.pieza_id; h.via_atribucion = e.via_atribucion; }
      salida.push(h);
    } else salida.push(e);
  });
  bloque.forEach(function (e) {                    // y lo que hoy trae y no estaba — enriquecido
    var k = e.hoja + '!' + e.fila_en_hoja;
    if (!visto[k] && !fueraHoy[k]) { visto[k] = 1; salida.push(e); }
  });
  var desap = (prev.envios || []).filter(function (e) {
    return !hoyPorFila[e.hoja + '!' + e.fila_en_hoja] && !fueraHoy[e.hoja + '!' + e.fila_en_hoja];
  });
  out_desaparecidos = desap;
  if (antes !== salida.length) {
    console.log('  ⚠ el append traía ' + antes + ' y la fuente de hoy deja ' + salida.length +
      '  (excluidos por solape o duplicados por cambio de llave)');
  }
  if (desap.length) {
    console.log('  ⚠ ' + desap.length + ' envío(s) estaban antes y HOY la fuente ya no los trae — se declaran, no se conservan');
  }
  final = salida;
})();

// ── 🔴 EL ANCLAJE VIVE EN EL BLOQUE, NO SOLO EN EL ESCRITOR ───────────────────────────────
// Estaba anclando Mundial e ICE en `FD2` (el que escribe la hoja) y no aquí. Resultado: la hoja
// salía con `pieza_id` pero **el bloque no**, y el MOTOR —que lee el bloque— dejaba a Mundial e
// ICE fuera de la rejilla. Un dato anclado solo en la hoja es un dato que el cálculo no ve.
// ⚠ El match es ESTRICTO por token completo: con `indexOf` un utm corto como `c3` casaba dentro
//   de cualquier código que lo contuviera y reasignaba Hotcakes a Semifinal B.
(function () {
  var Pc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
  var nm = L.nmEncabezado;
  function tokens(v) { return t(v).split(/[\s,;·|]+/).filter(Boolean); }
  function porUtm(u) {
    var lista = tokens(u).filter(function (x) { return x.length >= 6; });   // un utm corto no identifica
    if (!lista.length) return null;
    var hit = Pc.filter(function (q) {
      var decl = tokens(t(q['EmailName'])).concat(
        [1, 2, 3, 4].reduce(function (a, i) { return a.concat(tokens(q['Cod_Walmart_' + i]), tokens(q['Cod_Chedraui_' + i])); }, []));
      return lista.some(function (x) { return decl.indexOf(x) >= 0; });     // token COMPLETO
    });
    return hit.length === 1 ? t(hit[0]['Pieza_ID']) : null;
  }
  function porNombre(j) {
    var n = nm(t(j)); if (!n) return null;
    var hit = Pc.filter(function (q) {
      return /WA/i.test(t(q['Touchpoint'])) && (nm(t(q['Nombre_Journey'])) === n ||
        nm(t(q['Content_ID'])) === n || nm(t(q['Content_Name'])) === n || nm(t(q['EmailName'])) === n);
    });
    return hit.length === 1 ? t(hit[0]['Pieza_ID']) : null;
  }
  var ganados = 0;
  final.forEach(function (e) {
    if (t(e.pieza_id)) return;                     // lo que el lector ya resolvió NO se toca
    var pid = porUtm(e.utm_content) || porNombre(e.journey);
    if (pid) { e.pieza_id = pid; e.via_atribucion = 'catálogo · utm o nombre declarado'; ganados++; }
  });
  if (ganados) console.log('  ✔ ' + ganados + ' envío(s) anclados contra el catálogo (utm/nombre declarado)');
})();

// ── 🔴 LA FECHA, DE LA PIEZA, CUANDO LA FUENTE NO LA TRAE (15-sep-2026) ───────────────────
//
// La hoja «Maggi Mundial» del archivo del cliente NO TIENE columna de fecha — comprobado en el
// archivo: sus encabezados van de BU a %Click vs Read y no hay ninguna. Por eso «Segundo Partido»
// y «Tercer Partido» llevaban corridas enteras sin fecha, y sin fecha no hay `Send_Month` ni
// `Quincena`: las dos salían POR DEFINIR aunque la pieza SÍ tenga su fecha en el catálogo.
//
// 🔴 EL ÚLTIMO RECURSO ES LA PIEZA, NO UNA VECINA NI UNA MEDIA. Es la regla que ya rige el
//    sistema —«la fecha es de la PIEZA»— y aquí se aplica igual: si el envío está anclado a una
//    pieza y esa pieza tiene `Fecha_Primer_Envio`, ésa es su fecha. Se marca `fecha_via` como
//    `catálogo` para que nadie la confunda con una medición: es una fecha DECLARADA.
// 🔴 Y NO PISA NADA. Solo entra donde `fecha` está vacía; un envío que ya trajo su fecha de la
//    fuente o del doc de links no se toca.
(function () {
  var puestas = 0, sinPieza = 0;
  final.forEach(function (e) {
    if (t(e.fecha)) return;
    var pid = t(e.pieza_id);
    if (!pid) { sinPieza++; return; }
    var p = P.filter(function (x) { return t(x[NM_PIEZA_ID]) === pid; })[0];
    var f = p ? t(p[NM_FECHA_1]) : '';
    if (!f || /^(N\/A|POR DEFINIR|PENDIENTE)$/i.test(f)) return;
    e.fecha = f;
    e.fecha_via = 'catálogo · Fecha_Primer_Envio de la pieza (su hoja de la fuente no trae columna de fecha)';
    e.fecha_nota = 'DECLARADA, no medida: la hoja «' + t(e.hoja) + '» del archivo del cliente no tiene columna de fecha.';
    puestas++;
  });
  if (puestas || sinPieza) {
    console.log('  ' + (puestas ? '✔ ' : '  ') + puestas + ' envío(s) tomaron su fecha del CATÁLOGO (su hoja no trae columna de fecha)' +
      (sinPieza ? '   ·   🔴 ' + sinPieza + ' sin fecha y sin pieza: no hay de dónde' : ''));
  }
})();

// el aviso se recalcula: contarlo antes denunciaría envíos que la línea de arriba acaba de resolver
R.avisos = R.avisos.filter(function (a) { return a.tipo !== 'envios_sin_fecha'; });
(function () {
  var faltan = final.filter(function (e) { return !t(e.fecha); });
  if (!faltan.length) return;
  R.avisos.push({
    tipo: 'envios_sin_fecha', cuantas: faltan.length,
    detalle: '🔴 ' + faltan.length + ' de ' + final.length + ' envíos siguen sin fecha: ni de la fuente, ni del doc de links, ni del catálogo.',
    filas: faltan.map(function (e) { return t(e.hoja) + '!' + e.fila_en_hoja; })
  });
})();

console.log('\n  ── el append (sin cadencia: se agregan campañas cuando ocurren)');
console.log('     ya estaban ' + String(prev.envios.length).padStart(4) + '   nuevos ' + String(nuevos.length).padStart(4) +
  '   repetidos ' + String(repetidos).padStart(4) + '   → ' + final.length);
var cuadraAppend = prev.envios.length + nuevos.length === final.length;
console.log('     ' + (cuadraAppend ? '✔' : '🔴') + ' cuadra: ' + prev.envios.length + ' + ' + nuevos.length + ' = ' + final.length);

// ══ 4b · LA DERIVA: lo que ya está cargado, ¿sigue diciendo lo que dice la fuente? ══
//
// 🔴 EL APPEND NUNCA VUELVE A MIRAR LO QUE YA ESTÁ. Da una fila por presente con su llave y
//    pasa de largo — así que si la hoja y la fuente se separan en un campo que no es la llave,
//    nadie se entera nunca. Pasó: la hoja fecha 3 envíos de Hotcakes en 3 días distintos y la
//    fuente dice que los 4 salieron el mismo. Uno de los dos está mal y cambia la quincena.
//
// 🔴 DECISIÓN DE RICK (19-ago-2026): **manda la FUENTE.** La deriva ya no es solo un aviso —
//    la escritura CORRIGE la celda, y deja escrito en `Notas` qué decía antes. El valor viejo
//    no se pierde, cambia de sitio.
//
//    ⚠ El límite importa: esto vale **solo para los campos que la fuente MIDE** (fecha, envíos,
//      entregas, leídos, clicks). Las columnas canónicas —`BU_Canonico`, `Campana_Canonica`,
//      `Segmento_Canonico`— NO están en la fuente y son de Rick: ahí no hay nada que comparar
//      y nada que corregir. Una regla de precedencia sin ese límite se come el trabajo a mano.
var deriva = [];
try {
  var shWA = wb.Sheets['Data_WhatsApp'];
  var D = shWA ? XLSX.utils.sheet_to_json(shWA, { defval: '' }).filter(function (x) { return t(x['Campaña']); }) : [];
  var nv = function (v) { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
  var aIso = function (s) { var n = nv(s); return n ? new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10) : null; };
  D.forEach(function (fila) {
    // la llave del cotejo lleva los READ además de los sends: dos envíos de la misma campaña
    // pueden compartir cifra de envío (Maggi tiene dos de 162) y compararlos cruzados inventa
    // diferencias que no existen.
    var cand = bloque.filter(function (e) {
      return t(e.campana_raw).toLowerCase() === t(fila['Campaña']).toLowerCase() && (e.sends || 0) === nv(fila['Sends']);
    });
    var e = cand.filter(function (x) { return x.opens_read === nv(fila['Opens_Read']); })[0] || (cand.length === 1 ? cand[0] : null);
    if (!e) return;
    var d = [];
    var fh = aIso(fila['Send_Date']);
    // ⚠ `fh && ...` dejaba fuera el caso más importante: la hoja SIN fecha y el bloque CON ella.
    //   Esa fila existe (Semifinal A, que acaba de resolverse por el doc de links) y sin esto la
    //   escritura no le pondría nada. Que la hoja no diga nada también es una diferencia.
    if (e.fecha && e.fecha !== fh) d.push('fecha: hoja ' + (fh || '(vacía)') + ' · fuente ' + e.fecha);
    if (e.deliveries !== null && Math.abs(nv(fila['Deliveries']) - e.deliveries) > 0.5) d.push('entregas: hoja ' + nv(fila['Deliveries']) + ' · fuente ' + e.deliveries);
    if (e.opens_read !== null && nv(fila['Opens_Read']) !== e.opens_read) d.push('read: hoja ' + nv(fila['Opens_Read']) + ' · fuente ' + e.opens_read);
    if (d.length) {
      deriva.push({
        campana: t(fila['Campaña']), sends: nv(fila['Sends']),
        origen: e.hoja + '!' + e.fila_en_hoja, difiere_en: d,
        // lo que la escritura tiene que poner y lo que va a reemplazar: sin esto, «corregir»
        // sería que el escritor volviera a deducir la diferencia, y dos deducciones se separan
        corregir: d.map(function (dif) {
          var campo = dif.split(':')[0];
          return {
            columna: campo === 'fecha' ? 'Send_Date' : campo === 'entregas' ? 'Deliveries' : 'Opens_Read',
            valor_fuente: campo === 'fecha' ? e.fecha : campo === 'entregas' ? e.deliveries : e.opens_read,
            valor_hoja: campo === 'fecha' ? aIso(fila['Send_Date']) : campo === 'entregas' ? nv(fila['Deliveries']) : nv(fila['Opens_Read'])
          };
        })
      });
    }
  });
} catch (err) { }
if (deriva.length) {
  R.avisos.push({
    tipo: 'deriva_hoja_vs_fuente', cuantas: deriva.length,
    detalle: '🔴 ' + deriva.length + ' fila(s) de Data_WhatsApp dicen algo distinto de la fuente. MANDA LA FUENTE (decisión de Rick, 19-ago-2026): la escritura corrige la celda y deja el valor viejo en Notas.',
    regla: 'manda la fuente · solo en los campos que la fuente MIDE · las columnas canónicas no se tocan',
    filas: deriva
  });
  console.log('\n  ── 🔴 deriva: lo cargado no coincide con la fuente → MANDA LA FUENTE');
  deriva.forEach(function (x) {
    console.log('     ' + x.campana.padEnd(16) + String(x.sends).padStart(6) + ' env  (' + x.origen + ')');
    x.corregir.forEach(function (c) { console.log('        ' + c.columna.padEnd(12) + String(c.valor_hoja) + '  →  ' + String(c.valor_fuente)); });
  });
}

// ══ 4c · LOS CLICKS QUE SALEN DE LOS CARRITOS DE QCART ══════════════════════════════
// 🔴 Rick, 14-sep-2026: «Clicks debes sacarlos de qcart carritos ok? **en caso de j8**, los demás
//    no rompas lo que ya sabes de atribución». Las dos frases importan igual.
//
//    En WhatsApp no hay tracking de clicks: el único rastro de que alguien tocó el link es que
//    **el carrito se creó**. Por eso el carrito ES el click — no un proxy ni una estimación.
//    Eso lo distingue de los «clicks» de Tercer Tiempo, que la fuente DERIVA de `Read × CTOR
//    asumido`: aquellos son un supuesto y siguen sin reportarse.
//
// 🔴 SE APLICA SOLO A LAS PIEZAS DECLARADAS AQUÍ, y por eso es una lista y no una regla general.
//    `004-P017/P018/P019` (Semis y Final de Mundial) están en la MISMA situación —dicen
//    `Clicks_Medidos = Sí` y su `Clicks` quedó en POR DEFINIR— pero llenarlas cambiaría una
//    atribución que Rick pidió no tocar. Se reportan como candidatas y esperan su OK.
//
// 🔴 EL CARRITO CUENTA DESDE LA ACTIVACIÓN DEL LINK, igual que en todo Qcart. `DTuqPqBo` tiene 13
//    carritos crudos y solo **5** son del 12-sep en adelante; los 8 anteriores son de otro uso del
//    mismo link y ya los descarta el bloque de Qcart. Aquí NO se recalcula el filtro: se leen los
//    carritos que el bloque de Qcart YA atribuyó a esta pieza. Recalcularlo sería un segundo
//    criterio, y dos criterios es cómo la fecha dice una cosa y la métrica otra.
var CLICKS_DESDE_CARRITOS = {
  '005-P011': 'Rick, 14-sep-2026: los clicks de la Jornada 8 de WhatsApp salen de los carritos de Qcart. En WhatsApp no hay tracking de clicks; el carrito es el único rastro de que el link se tocó.',
  // 🔴 14-sep-2026 · Rick: «Dale». Las tres piezas de Mundial estaban en una contradicción: decían
  //    `Clicks_Medidos = Sí` —alguien ya había declarado que sus clicks SE miden— y su `Clicks`
  //    llevaba meses en POR DEFINIR. La celda prometía un dato que nunca llegó.
  //    Llenarlas no pisa ningún número: cierra un hueco declarado. Y deja UNA sola regla para todo
  //    WhatsApp en vez de una excepción para J8 — que era el riesgo real de haber parado ahí.
  '004-P017': 'Rick, 14-sep-2026 («Dale»): Semifinal A. Ya declaraba Clicks_Medidos = Sí con el valor en POR DEFINIR; los clicks salen de los carritos de Qcart, igual que la Jornada 8.',
  '004-P018': 'Rick, 14-sep-2026 («Dale»): Semifinal B. Mismo caso que 004-P017.',
  '004-P019': 'Rick, 14-sep-2026 («Dale»): Final. Mismo caso que 004-P017.',
  /* 🔴 22-sep-2026 · WA-J9. Rick elevó esto a REGLA: «los clicks de whatsapp que tienen qcart
   *    deben de coincidir con los carritos totales de qcart». Sigue entrando a la lista y no se
   *    convierte en regla automática porque el motivo de que sea lista no ha cambiado: cada
   *    entrada lleva su autorización, y una regla general podría tocar piezas que Rick pidió no
   *    mover. Pero aquí no hay nada que pisar — `005-P013` se dio de alta hoy y su `Clicks`
   *    nace vacío —, así que llenarla cierra un hueco en vez de cambiar una atribución. */
  '005-P013': 'Rick, 22-sep-2026: «los clicks de whatsapp que tienen qcart deben de coincidir con los carritos totales de qcart». Jornada 9 de WhatsApp, shortlink ymh2OT4x. Pieza nueva: su Clicks nacía vacío, así que esto no pisa ninguna atribución previa.',
  /* 🔴 30-sep-2026 · WA-J10. La misma regla de Rick, y la pieza cumple sus dos condiciones: es de
   *    WhatsApp y tiene Qcart (shortlink `uCV8KGHm`, 8 carritos). La hoja «Maggi Liga MX» no trae
   *    columna de clicks —ninguna de Liga MX la trae—, así que sin esta entrada sus tres envíos
   *    salen como «clicks NO medidos» aunque el catálogo diga `Clicks_Medidos = Sí`: la ficha y el
   *    bloque se contradirían, y la contradicción no la ve ninguna suma.
   *    ⚠ Sus TRES envíos son de la misma pieza, así que el carrito se asigna UNA vez —al primero—
   *    y los otros dos llevan 0 a propósito. Es la regla que ya aplica a J8 y J9: el carrito es de
   *    la PIEZA, no del envío; repartirlo inventaría un criterio y duplicarlo inflaría la celda. */
  '005-P016': 'Rick, 14-sep-2026 y 22-sep-2026: «los clicks de whatsapp que tienen qcart deben de coincidir con los carritos totales de qcart». Jornada 10 de WhatsApp, shortlink uCV8KGHm («Papitas elote»). Pieza dada de alta el 29-sep con su Clicks vacío: esto cierra un hueco, no cambia ninguna atribución.'
};

var qcartPorPieza = {};
try {
  var QB = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));
  (QB.carritos || []).forEach(function (c) {
    var pid = String(c.pieza_id || '').trim();
    // 🔴 UN CARRITO ES UNA **VISTA**, NO UNA FILA (29-sep-2026). Esto sumaba `+ 1` por fila del
    //    bloque, y una fila de Qcart es un bucket día × hora × shortlink × utm × tienda con su
    //    contador `views`. Las dos piezas de Liga MX reportaban **21 y 12** clicks cuando sus
    //    carritos son **43 y 30**: el reporte decía menos de la mitad.
    //    🔴 Y NO ES UN CAMBIO A LA DECISIÓN DE RICK, ES CUMPLIRLA. Él la declaró así: «los clicks
    //    de WhatsApp que tienen qcart deben coincidir con los carritos totales de qcart». Con el
    //    conteo por filas NO coincidían — contar vistas es lo que hace verdadera la regla.
    //    Fue el último rincón del sistema que seguía contando filas: la corrección de vistas pasó
    //    por el motor, la rejilla, las dos puertas y el guardián de distribución, y este no, porque
    //    U4 buscaba CINCO patrones literales en TRES archivos y este era un cuarto archivo con el
    //    mismo defecto escrito de otra manera.
    if (pid) qcartPorPieza[pid] = (qcartPorPieza[pid] || 0) + (Number(c.views) || 0);
  });
} catch (e) { qcartPorPieza = null; }

// 🔴 EL CARRITO ES DE LA PIEZA, NO DEL ENVÍO — y por eso se asigna UNA sola vez.
//    La Jornada 8 tiene DOS envíos (4PM y 5PM) apuntando a la misma pieza y UN solo shortlink.
//    Al poner el conteo de la pieza en cada envío, el reporte —que suma los envíos de la celda—
//    daba **10 clicks sobre 5 carritos**: el doble exacto. No se reparte entre los dos (repartir
//    5 entre 2 inventaría decimales y un criterio), se le da entero al PRIMER envío de la pieza
//    y 0 a los demás, con la nota diciéndolo. Así la suma de la celda es el número real.
var desdeCarritos = [];
if (qcartPorPieza) {
  var yaAsignada = {};
  final.forEach(function (e) {
    var pid = String(e.pieza_id || '').trim();
    if (!CLICKS_DESDE_CARRITOS[pid]) return;
    var total = qcartPorPieza[pid] || 0;
    var primero = !yaAsignada[pid];
    yaAsignada[pid] = true;
    e.clicks = primero ? total : 0;
    e.clicks_medidos = 'Sí';
    e.clicks_origen = 'carritos de Qcart';
    e.clicks_nota = CLICKS_DESDE_CARRITOS[pid] +
      ' Carritos atribuidos por el bloque de Qcart a la PIEZA (ya filtrados por fecha de activación): ' + total + '.' +
      (primero ? '' : ' Este envío lleva 0 a propósito: el carrito es de la pieza, no del envío, y el total ya va en el primer envío de esta pieza — repartirlo inventaría un criterio y duplicarlo inflaría la celda.');
    desdeCarritos.push({ pieza: pid, carritos: e.clicks, total: total, primero: primero });
  });
}
if (desdeCarritos.length) {
  console.log('\n  ── 🔴 clicks tomados de los CARRITOS de Qcart (decisión declarada de Rick)');
  desdeCarritos.forEach(function (x) { console.log('     ' + x.pieza + '   clicks = ' + x.carritos + ' carritos'); });
}
// 🔴 y se declara lo que NO se tocó, para que no se pierda de vista
var candidatas = final.filter(function (e) {
  var pid = String(e.pieza_id || '').trim();
  return pid && !CLICKS_DESDE_CARRITOS[pid] && e.clicks_medidos === 'Sí' &&
    (e.clicks === null || e.clicks === undefined) && qcartPorPieza && qcartPorPieza[pid];
});
if (candidatas.length) {
  console.log('  ── ⚠ candidatas al MISMO trato, sin tocar (esperan el OK de Rick):');
  candidatas.forEach(function (e) {
    console.log('     ' + e.pieza_id + '   ' + String(e.campana_raw || '').slice(0, 16).padEnd(18) + qcartPorPieza[String(e.pieza_id).trim()] + ' carritos disponibles');
  });
}

// ══ 5 · LOS CLICKS: MEDIDOS vs ASUMIDOS ═════════════════════════════════════════════
var medidos = final.filter(function (e) { return e.clicks_medidos === 'Sí'; }).length;
var noMedidos = final.filter(function (e) { return e.clicks_medidos === 'No'; });
console.log('\n  ── 🔴 los clicks: qué es medición y qué es supuesto');
console.log('     medidos      : ' + medidos);
console.log('     NO medidos   : ' + noMedidos.length + '   → clicks = null, y se dice por qué');
if (noMedidos.length) console.log('        ' + String(noMedidos[0].clicks_nota).slice(0, 92));

// ══ 6 · SALIDA ══════════════════════════════════════════════════════════════════════
var suma = final.reduce(function (a, e) { return a + (e.sends || 0); }, 0);
var out = {
  paso: 'whatsapp-bloque · bloque whatsapp', generado_por: 'fuentes-whatsapp.whatsapp.js',
  fuente: { archivo: R.archivo, ruta: f.ruta, nota: 'solo lectura · el equipo la consolida a mano, sin cadencia' },
  no_calcula: 'Delivery_Rate, Read_Rate, CTOR y Pct_Error son de motor-calculo. Aquí solo datos.',
  modelo: 'APPEND por llave fecha¦campaña¦segmento¦journey. Sin cadencia: se agregan campañas cuando ocurren.',
  lector: VERSION,
  version: { lector: W.LECTOR, enriquecimiento: ENRIQUECIMIENTO },
  envios: final,
  subtotales_excluidos: R.subtotales,
  tablas: R.tablas,
  tablas_descartadas: R.tablas_descartadas,
  solapes: R.solapes,
  excluidos_por_solape: R.excluidos_por_solape || [],
  desaparecidos_vs_carga_anterior: out_desaparecidos,
  avisos: R.avisos,
  hojas: R.hojas,
  auditoria: {
    envios: final.length, nuevos: nuevos.length, ya_estaban: prev.envios.length, repetidos: repetidos,
    cuadre_append: cuadraAppend,
    sends_total: suma,
    con_pieza: conPieza, sin_pieza: final.length - conPieza,
    vias: vias,
    clicks_medidos: medidos, clicks_no_medidos: noMedidos.length,
    subtotales_excluidos: R.subtotales.length,
    sends_que_se_habrian_duplicado: R.subtotales.reduce(function (a, s) { return a + (s.sends_de_la_fila || 0); }, 0),
    tablas_de_envios: R.tablas.length,
    tablas_descartadas: R.tablas_descartadas.length,
    solapes_excluidos: R.solapes.length,
    sin_fecha: final.filter(function (e) { return !e.fecha; }).length,
    reconstruido: reconstruye
  },
  para_el_siguiente: {
    que_es: 'el bloque de WhatsApp, anclado al catálogo por pieza_id',
    hoja_destino: 'Data_WhatsApp',
    ojo: 'ninguna columna calculada · los envíos sin pieza traen su motivo y sus candidatas',
    ojo_clicks: 'donde clicks_medidos = No, `clicks` es null A PROPÓSITO: la fuente lo deriva de un supuesto. No rellenar con el derivado.'
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
fs.writeFileSync(BACK + '/_fuentes/whatsapp.json', JSON.stringify(out, null, 1));

console.log('\n  ── el bloque');
console.log('     envíos ' + final.length + '   ·   Σ sends ' + mil(suma) + '   ·   con pieza ' + conPieza + ' / sin pieza ' + (final.length - conPieza));
console.log('     subtotales excluidos: ' + R.subtotales.length + '  (' + mil(out.auditoria.sends_que_se_habrian_duplicado) + ' sends que se habrían duplicado)');
// 🔴 lo que no se imprime no existe: un solape que solo vive en el JSON no lo mira nadie
if (R.solapes.length) {
  console.log('\n  ── 🔴 el mismo envío en DOS tablas (se conserva el DESAGREGADO)');
  R.solapes.forEach(function (x) {
    console.log('     excluye ' + String(x.excluido).padEnd(20) + ' sends ' + mil(x.sends));
    console.log('        prueba: ' + x.prueba);
    console.log('        regla : ' + x.regla);
  });
}
if (R.avisos.length) {
  console.log('\n  ── avisos (viajan al handoff; por sí solos no bloquean)');
  R.avisos.forEach(function (a) { console.log('     [' + a.tipo + '] ' + a.detalle); });
}

console.log('\n  → ' + BACK + '/_fuentes/whatsapp.json');
console.log('  ⚠ el Excel NO se tocó. Data_WhatsApp la escribe la Puerta 1.');
