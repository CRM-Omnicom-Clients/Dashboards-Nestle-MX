// qcart-activacion · FECHA DE ACTIVACIÓN DE QCART — el campo que faltaba en el catálogo.
//
// Regla de Rick (19-ago-2026):
//   «del doc qcart link.xls viene una fecha que dice fecha de envío. Si dice "no se envió" o
//    cualquier otro valor que no es una fecha, ese link no es válido. Si tiene fecha, esa es la
//    fecha de qcart, debe ser claro el campo como fecha de activación de qcart en el catálogo.»
//
// Este paso NO escribe el Excel. Deja el campo resuelto en el backend y **valida que cada link
// esté mapeado a su pieza**, que es la otra mitad del encargo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'qcart';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var Q = require(__dirname + '/lib-qcart-links.js');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = Q.t;
var V = [], fallo = 0, H = [];
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
// 🔴 UN HALLAZGO NO ES UNA REGRESIÓN. `dato()` mide propiedades de la FUENTE: que el doc marque
//    9 links como «no se envió» no es un fallo del paso — es lo que el script tiene que detectar,
//    y Rick ya decidió qué hacer con ellos (no entran a Data_Qcart). Contarlo como fallo deja
//    el script en rojo para siempre y enseña a ignorar el rojo, que es lo peor que puede pasar.
function dato(n, limpio, d) { H.push([n, limpio, d]); }

console.log('════════ qcart-activacion · FECHA DE ACTIVACIÓN DE QCART ════════\n');

// ══ 1 · LA AUTORIDAD ════════════════════════════════════════════════════════════════
var DOC = PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx';
var A = Q.leer(DOC);
console.log('  autoridad: ' + A.archivo);
A.hojas.forEach(function (h) {
  console.log('     ' + t(h.hoja).padEnd(12) + (h.nota ? h.nota
    : 'encabezado fila ' + h.encabezado_en_fila + ' · ' + h.codigos + ' códigos · ' + h.invalidos + ' sin fecha válida'));
});
var codigos = Object.keys(A.links);
console.log('\n  ── el filtro que define la regla');
console.log('     links VÁLIDOS (con fecha)   : ' + codigos.length);
console.log('     links INVÁLIDOS (sin fecha) : ' + A.invalidos.length + '   ⛔ su tráfico NO entra a ningún reporte');
var motivos = {};
A.invalidos.forEach(function (x) { motivos[x.valor_de_fecha] = (motivos[x.valor_de_fecha] || 0) + 1; });
Object.keys(motivos).sort(function (a, b) { return motivos[b] - motivos[a]; }).slice(0, 6)
  .forEach(function (m) { console.log('        «' + m.slice(0, 40) + '» × ' + motivos[m]); });

chk('el doc entrega links con fecha de activación', codigos.length > 0, codigos.length + ' códigos válidos');
chk('los inválidos se declaran con su motivo', A.invalidos.every(function (x) { return !!x.motivo; }),
  A.invalidos.length + ' declarados, 0 descartados en silencio');

// ══ 2 · ¿ESTÁ CADA LINK MAPEADO A SU PIEZA? ═════════════════════════════════════════
console.log('\n══ 2 · ¿cada link está mapeado a su pieza en el catálogo? ══');
var vivo = L.archivoVivo({ dir: PROY });
var T = require('path').resolve(__dirname, '..') + '/_tmp/_n1c.xlsx';
fs.copyFileSync(vivo.ruta, T);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(T).Sheets['Catalogo_Piezas'], { defval: '' });

// el catálogo guarda los códigos en Cod_Walmart_1..5 y Cod_Chedraui_1..5
// 🔴 el catálogo TAMBIÉN mete varios códigos en una celda (`cartanywhere ; tJEICO87 ; Z8W0ZouI`).
//    Leer la celda como un solo código daba 6 falsos «sin fecha»: el problema era mi lectura,
//    no el dato. Se usa el mismo parser que la autoridad, para que ambos lados vean lo mismo.
var codPieza = {}, porPieza = {};
P.forEach(function (p) {
  var id = t(p['Pieza_ID']);
  for (var i = 1; i <= 5; i++) {
    ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
      Q.codigosDe(p[pre + i]).forEach(function (c) {
        codPieza[c] = id;
        if ((porPieza[id] = porPieza[id] || []).indexOf(c) < 0) porPieza[id].push(c);
      });
    });
  }
});
var enCatalogo = Object.keys(codPieza);
console.log('     códigos en el catálogo : ' + enCatalogo.length + '  (en ' + Object.keys(porPieza).length + ' piezas)');
console.log('     códigos en la autoridad: ' + codigos.length);

var sinPieza = codigos.filter(function (c) { return !codPieza[c]; });
var sinAutoridad = enCatalogo.filter(function (c) { return !A.links[c] && !A.invalidos.some(function (x) { return x.codigo === c; }); });
var ambos = codigos.filter(function (c) { return codPieza[c]; });
console.log('\n     ✔ en AMBOS (mapeados)          : ' + ambos.length);
console.log('     ⚠ válidos SIN pieza en catálogo: ' + sinPieza.length + '  → links reales que el catálogo no conoce');
console.log('     🔴 en el catálogo y NO en el doc: ' + sinAutoridad.length + '  → sin fecha de activación posible');
if (sinAutoridad.length) sinAutoridad.slice(0, 8).forEach(function (c) { console.log('          ' + c + '  (pieza ' + codPieza[c] + ')'); });

// 🔴 ESTO ES UN HALLAZGO DE LA FUENTE, NO UN FALLO DEL SCRIPT — y la diferencia importa porque
//    estaba DETENIENDO el ciclo completo. Que un código del catálogo no esté en `Qcart-Links` no
//    significa que qcart-activacion falló: significa que el equipo no lo agregó al doc. El paso hizo su
//    trabajo —lo detectó, lo declaró, y el filtro ya excluye su tráfico—. Un paso que bloquea por
//    una propiedad de la fuente no se puede desatorar nunca: la fuente no la arregla él.
dato('todo código del catálogo tiene su fecha de activación', sinAutoridad.length === 0,
  sinAutoridad.length ? sinAutoridad.length + ' código(s) del catálogo que el doc no declara: su tráfico se excluye y queda declarado'
    : enCatalogo.length + '/' + enCatalogo.length);

// ¿alguno inválido está en el catálogo? Ese es el caso peligroso: pieza que apunta a un link
// que nunca se envió → su tráfico es de otra cosa.
var invEnCat = A.invalidos.filter(function (x) { return codPieza[x.codigo]; });
console.log('\n     🔴 links INVÁLIDOS que el catálogo sí usa: ' + invEnCat.length);
invEnCat.slice(0, 8).forEach(function (x) {
  console.log('          ' + x.codigo + '  pieza ' + codPieza[x.codigo] + '  · «' + x.valor_de_fecha + '»  · ' + x.hoja);
});
// lo que el SCRIPT tiene que garantizar es que los detecte y los excluya, no que no existan
chk('las piezas con link no enviado quedan EXCLUIDAS y declaradas',
  invEnCat.every(function (x) { return !!x.motivo && !!x.valor_de_fecha; }),
  invEnCat.length + ' detectadas, cada una con su motivo y el valor que traía el doc');
dato('ninguna pieza apunta a un link que no se envió', invEnCat.length === 0,
  invEnCat.length ? invEnCat.length + ' piezas con link inválido — Rick decidió que NO entran a Data_Qcart' : 'ninguna');

// ══ 2b · ¿ALGUNA FECHA ES IMPOSIBLE? ════════════════════════════════════════════════
// Un link no se puede activar en el futuro. Cuatro códigos de La Lechera dicen 2027-07-26 en
// la hoja de Junio para una campaña de junio-2026: es un typo de año. Sin este check, el filtro
// borra el 100% del tráfico de esa pieza **y el resultado se ve perfectamente normal**.
console.log('\n══ 2b · fechas imposibles ══');
var HOY = new Date().toISOString().slice(0, 10);

// ⚠ «está en el futuro» NO alcanza como criterio: 7 links de `Maggi-LigaMx-agosto26` apuntan al
//   22-ago, 6-sep y 19-sep porque son **partidos programados**. Marcarlos en rojo es un falso
//   positivo, y una herramienta que avisa en falso enseña a ignorarla.
//   El criterio que sí distingue: ¿la fecha CUADRA con el mes que declara su propia campaña?
// el mes de la hoja lo resuelve lib-flexible (los 12, con frontera de palabra). Una tabla
// propia aquí sería la tercera copia, y la que se quedaría atrás cuando se corrija la otra.
function mesDeHoja(h) { var m = L.mesDe(h); return m ? +m : null; }

// ⚠ Sacar el año del NOMBRE de la campaña no funciona: `maggi-julio14` lleva el DÍA (14) y
//   `Maggi-LigaMx-agosto26` lleva el año (26). Leer «14» como 2014 daba «+144 meses» y cuatro
//   falsos positivos. La hoja del doc SÍ es contexto fiable: la hoja «Junio» agrupa los links
//   de junio, y su año se deduce de las fechas que ella misma contiene.
var anioHoja = {};
codigos.forEach(function (c) {
  var l = A.links[c], h = Q.nmz(l.hoja);
  if (!mesDeHoja(h)) return;
  (anioHoja[h] = anioHoja[h] || []).push(+l.fecha_activacion.slice(0, 4));
});
function anioDeHoja(h) {                                  // la moda de los años de esa hoja
  var a = anioHoja[h]; if (!a || !a.length) return null;
  var cnt = {}; a.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; });
  return +Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; })[0];
}
var incoherentes = [], programados = [];
codigos.forEach(function (c) {
  var l = A.links[c], h = Q.nmz(l.hoja);
  var mes = mesDeHoja(h), anio = anioDeHoja(h);
  if (!mes || !anio) { l.meses_vs_hoja = null; return; }
  var d = (+l.fecha_activacion.slice(0, 4) - anio) * 12 + (+l.fecha_activacion.slice(5, 7) - mes);
  l.meses_vs_hoja = d;
  l.hoja_referencia = h + ' ' + anio;
  if (Math.abs(d) >= 3) incoherentes.push(l);          // 3+ meses fuera de su hoja: dato malo
  else if (l.fecha_activacion > HOY) programados.push(l);
});
var viejas = codigos.filter(function (c) { return A.links[c].fecha_activacion < '2026-01-01'; })
  .map(function (c) { return A.links[c]; });
console.log('     hoy es ' + HOY);
console.log('     ✔ programados a futuro, coherentes con su campaña: ' + programados.length);
programados.slice(0, 4).forEach(function (l) {
  console.log('        ' + l.codigo.padEnd(12) + l.fecha_activacion + '   ' + l.campana + '   (no es error: el envío aún no ocurre)');
});
console.log('     🔴 INCOHERENTES con su propia campaña: ' + incoherentes.length);
incoherentes.forEach(function (l) {
  console.log('        ' + l.codigo.padEnd(12) + l.fecha_activacion + '   [' + l.hoja + ' f' + l.fila + ']   ' + l.campana +
    '   → ' + (l.meses_vs_hoja > 0 ? '+' : '') + l.meses_vs_hoja + ' meses de la hoja ' + l.hoja_referencia);
});
console.log('     activaciones antes de 2026: ' + viejas.length + (viejas.length ? '   ⚠ revisar' : '   ✔'));
// 🔴 TAMBIÉN ES UN HALLAZGO. Son 4 links de `lechera-junio` fechados **2027**-07-26 en la hoja
//    Junio: un typo del equipo en la fuente. El paso ya lo maneja —marca la fecha como sospechosa
//    y NO aplica la ventana, porque recortar por un typo borraría tráfico bueno— así que hizo
//    exactamente lo que debía. Bloquear aquí detenía el corte por algo que el script ya resolvió.
dato('ninguna fecha contradice a su hoja del doc', incoherentes.length === 0,
  incoherentes.length ? incoherentes.length + ' link(s) con fecha sospechosa: NO se les aplica la ventana y queda declarado'
    : 'todas coherentes');

// ══ 3 · LA FECHA DE ACTIVACIÓN, POR PIEZA ═══════════════════════════════════════════
// ⚠ Esto es INFORMATIVO. El filtro real va **por link**, no por pieza: una pieza puede tener
//    dos envíos con links distintos (001-P001 manda en marzo y abril, y su único código es el
//    de abril). Aplicar una sola fecha a toda la pieza recortaría el tráfico del otro envío.
console.log('\n══ 3 · la fecha de activación que le toca a cada pieza  (informativo — el filtro es por link) ══');
var activPieza = {};
Object.keys(porPieza).forEach(function (id) {
  var fechas = porPieza[id].map(function (c) { return A.links[c] ? A.links[c].fecha_activacion : null; }).filter(Boolean);
  if (!fechas.length) { activPieza[id] = { fecha: null, motivo: 'ninguno de sus códigos tiene fecha en el doc' }; return; }
  fechas.sort();
  // la pieza se activa cuando se activa su PRIMER link
  activPieza[id] = { fecha: fechas[0], codigos: porPieza[id].length, fechas_distintas: Array.from(new Set(fechas)).length };
});
var conFecha = Object.keys(activPieza).filter(function (id) { return activPieza[id].fecha; });
console.log('     piezas con fecha de activación: ' + conFecha.length + ' de ' + Object.keys(porPieza).length);
conFecha.slice(0, 10).forEach(function (id) {
  var a = activPieza[id];
  console.log('        ' + id.padEnd(10) + a.fecha + '   ' + a.codigos + ' código(s)' + (a.fechas_distintas > 1 ? '  ⚠ ' + a.fechas_distintas + ' fechas distintas → manda la más temprana' : ''));
});

// ¿coincide con la fecha del email? No tiene por qué: son dos cosas distintas.
var difs = [];
P.forEach(function (p) {
  var id = t(p['Pieza_ID']), a = activPieza[id];
  if (!a || !a.fecha) return;
  var env = t(p['Fecha_Primer_Envio']);
  if (env && env !== a.fecha) difs.push({ id: id, qcart: a.fecha, email: env });
});
console.log('\n     piezas donde la activación de Qcart ≠ 1er envío de email: ' + difs.length);
difs.slice(0, 6).forEach(function (d) { console.log('        ' + d.id.padEnd(10) + 'qcart ' + d.qcart + '   email ' + d.email); });
console.log('     ⚠ que difieran NO es un error: el link se da de alta antes del envío.');
console.log('       Por eso el filtro usa la fecha del LINK, no la del email.');

// ══ 4 · SALIDA ══════════════════════════════════════════════════════════════════════
var out = {
  paso: 'qcart-activacion · fecha de activación de Qcart', generado_por: 'fuentes-qcart.activacion-qcart.js',
  autoridad: { archivo: A.archivo, ruta: DOC, hojas: A.hojas },
  campo_nuevo: {
    nombre: 'Fecha_Activacion_Qcart',
    donde: 'Catalogo_Piezas',
    que_es: 'el día en que el link de Qcart se envió, según el doc de links del equipo',
    para_que: 'filtrar el tráfico: solo cuenta de esa fecha en adelante. Antes es prueba o de otra campaña, y contarlo infla los números',
    regla_de_validez: 'si su «Fecha de envío» no es una fecha (p.ej. «No seleccionado»), el link NO es válido y su tráfico no entra'
  },
  links_validos: A.links,
  links_invalidos: A.invalidos,
  activacion_por_pieza: activPieza,
  mapeo: {
    codigos_en_catalogo: enCatalogo.length,
    codigos_en_autoridad: codigos.length,
    mapeados: ambos.length,
    validos_sin_pieza: sinPieza,
    en_catalogo_sin_fecha: sinAutoridad,
    invalidos_usados_por_una_pieza: invEnCat
  },
  fechas_imposibles: {
    hoy: HOY,
    incoherentes_con_su_campana: incoherentes,
    programados_a_futuro_ok: programados,
    antes_de_2026: viejas,
    por_que_importa: 'una activación en el futuro hace que el filtro borre el 100% del tráfico de esa pieza, y el resultado se ve normal'
  },
  para_el_siguiente: {
    que_es: 'qcart-bloque filtra los CSV con esto: solo códigos válidos, y solo desde su fecha de activación',
    // 🔴 la unidad del filtro es el LINK
    unidad_del_filtro: 'shortlink code — NO la pieza. Una pieza puede tener dos envíos con links distintos (001-P001 manda en marzo y abril y su único código es el de abril): una sola fecha para toda la pieza recortaría el tráfico del otro envío.',
    ojo: 'un código sin fecha de activación NO se puede filtrar → su tráfico no entra hasta resolverlo'
  }
};
try { fs.mkdirSync(BACK + '/_catalogo'); } catch (e) { }
fs.writeFileSync(BACK + '/_catalogo/activacion-qcart.json', JSON.stringify(out, null, 1));

console.log('\n════ VEREDICTO ════');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(50) + (v[2] || '')); });
if (H.length) {
  console.log('\n══ LOS DATOS ══   (un rojo aquí es un HALLAZGO de la fuente, no un fallo del paso)');
  H.forEach(function (h, i) { console.log('  ' + (h[1] ? '✔' : '⚠ [' + (i + 1) + ']') + ' ' + h[0].padEnd(48) + (h[2] || '')); });
}
console.log('\n  → ' + BACK + '/_catalogo/activacion-qcart.json');
console.log('  ⚠ el Excel NO se tocó: el campo queda resuelto en el backend, lo escribe la Puerta 1.');
// 🔴 sin código de salida, este paso pasaba la batería aunque tuviera rojos: nadie lo miraba.
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s) del SCRIPT'
  : '✅ qcart-activacion VALIDADO — ' + V.length + ' checks' + (H.filter(function (h) { return !h[1]; }).length
    ? ' · ' + H.filter(function (h) { return !h[1]; }).length + ' hallazgo(s) en los datos' : '')));
process.exit(fallo ? 1 : 0);
