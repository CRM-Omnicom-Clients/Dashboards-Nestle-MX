// catalogo-leer · LEE `CATALOGO-CORRECCIONES.md` y lo convierte en un plan de corrección auditable.
//
// 🔴 SE PARSEA EL DOCUMENTO, NO SE TRANSCRIBE. Son 76 EmailID, 12 números de AON y 15 filas de
//    Pro Plan. Copiarlos a mano a un script es meter 100 oportunidades de erratas que después
//    nadie puede distinguir de un dato real. Leyendo el doc, el origen de cada cifra es una
//    línea concreta del archivo, y si Leslie actualiza el doc basta con re-correr.
//
// ⚠ El doc da el ContentName en su forma CORTA (`CAREER-FOCUSED_AC_EM_A_V1_803867`) y el
//   catálogo lo guarda COMPLETO (`J_AO-RECETAS-NESTLÉ-NC000600_1_IBS_…_CAREER-FOCUSED_AC_EM_A_V1_803867`).
//   No son distintos: el corto es la COLA del largo. Se comparan por cola, nunca por igualdad.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os');
/* 🔴 LA RUTA SE RESUELVE EN ESTA CORRIDA, NO SE ESCRIBE (22-sep-2026).
 *    Estaba clavada a `…/CRM General/CATALOGO-CORRECCIONES.md`, y el equipo movió el documento a
 *    `…/CRM General/MD's/`. La cadena entera se detuvo en la etapa 4 con «no está el documento»
 *    sobre un archivo que SÍ existe, a una carpeta de distancia.
 *    Es el modo de fallo que el propio skill documenta para publicar —«las mueven sin avisar; una
 *    ruta escrita en un documento puede estar muerta»— y que aquí no se estaba aplicando a un
 *    insumo. Se busca desde la carpeta del cliente por NOMBRE; la ruta vieja queda solo como
 *    primer intento, para no recorrer el árbol cuando no hace falta. */
var CLIENTE = ENT.raiz('fuentes_externas');
var DOC = (function () {
  var directa = CLIENTE + '/Marcas/CRM General/CATALOGO-CORRECCIONES.md';
  if (fs.existsSync(directa)) return directa;
  var hallado = null;
  (function rec(dir, prof) {
    if (hallado || prof > 4) return;
    var e; try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch (x) { return; }
    e.forEach(function (x) {
      if (hallado) return;
      var p = dir + '/' + x.name;
      if (x.isDirectory()) return rec(p, prof + 1);
      if (x.name.toUpperCase() === 'CATALOGO-CORRECCIONES.MD') hallado = p;
    });
  })(CLIENTE + '/Marcas/CRM General', 0);
  if (hallado) console.log('  ⚠ el documento NO está en su ruta histórica; se encontró en:\n     ' + hallado.replace(CLIENTE, '…'));
  return hallado || directa;
})();
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function limpio(c) { return t(c).replace(/^\**|\**$/g, '').replace(/^`|`$/g, '').replace(/🔴|🟢|✅|❌/g, '').trim(); }
function num(v) { var n = Number(t(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; }

if (!fs.existsSync(DOC)) { console.log('🔴 no está el documento:\n   ' + DOC); process.exit(1); }
var txt = fs.readFileSync(DOC, 'utf8');
var lineas = txt.split(/\r?\n/);
console.log('════════ catalogo-leer · el documento de correcciones ════════\n');
console.log('  ' + DOC.split('/').pop() + '   ' + lineas.length + ' líneas · ' +
  new Date(fs.statSync(DOC).mtimeMs).toISOString().slice(0, 10));

/** todas las filas de tabla markdown del documento, con su número de línea */
function filasTabla() {
  var out = [];
  lineas.forEach(function (l, i) {
    if (!/^\s*\|/.test(l)) return;
    var celdas = l.split('|').slice(1, -1).map(limpio);
    if (!celdas.length) return;
    if (celdas.every(function (c) { return /^:?-+:?$/.test(c) || c === ''; })) return;   // separador
    out.push({ linea: i + 1, celdas: celdas });
  });
  return out;
}
var TAB = filasTabla();

// ── 1 · EmailID por pieza (tabla de la sección 4) ───────────────────────────────────
// Se reconoce por FORMA, no por el título de la sección: una fila cuyo primer campo es un
// Pieza_ID y que trae un EmailID de 4-6 dígitos. Así el parser no depende de la maquetación.
// 🔴 EL DOCUMENTO TIENE DOS TABLAS QUE HABLAN DEL MISMO EmailID, Y NO DICEN LO MISMO A PROPÓSITO.
//    · la sección 4 documenta el estado ACTUAL — para `001-P025` pone `79320`, y el propio doc
//      dice al lado «es el de 001-P005»: está listando el error, no la corrección.
//    · la sección 2 trae la CORRECCIÓN: `80879`.
//    Mi primera regla era «gana el último que aparezca», y como la sección 4 va después,
//    elegía justo el equivocado. **Gana la tabla que CORRIGE**, que es la que trae la oleada.
//    Un parser que resuelve conflictos por posición está resolviendo por casualidad.
var esPieza = /^\d{3}-P\d{3}$/;
var emailID = {}, origenEID = {}, conflictos = [];
TAB.forEach(function (f) {
  if (!esPieza.test(f.celdas[0])) return;
  var id = f.celdas[0];
  var eid = f.celdas.filter(function (c) { return /^\d{4,6}$/.test(c); })[0];
  if (!eid) return;
  var corrige = f.celdas.some(function (c) { return /^(MARZO|ABRIL)$/i.test(c); });   // ← la de la sección 2
  var fuente = corrige ? 'corrección (§2)' : 'referencia (§4)';
  if (emailID[id] && emailID[id] !== eid) {
    conflictos.push({ pieza: id, a: emailID[id], de_a: origenEID[id], b: eid, de_b: fuente });
    if (origenEID[id] === 'corrección (§2)') return;      // ya tengo el bueno: no lo piso
  }
  emailID[id] = eid; origenEID[id] = fuente;
});
console.log('\n  ── EmailID leídos del doc: ' + Object.keys(emailID).length);
if (conflictos.length) {
  console.log('     ⚠ ' + conflictos.length + ' pieza(s) con DOS EmailID en el doc — gana la tabla que corrige:');
  conflictos.forEach(function (c) {
    var gana = origenEID[c.pieza] === 'corrección (§2)' ? emailID[c.pieza] : emailID[c.pieza];
    console.log('        ' + c.pieza + ': ' + c.a + ' (' + c.de_a + ')  vs  ' + c.b + ' (' + c.de_b + ')   → queda ' + gana);
  });
}

// ── 2 · AON: oleada, envíos correctos y ContentName ─────────────────────────────────
// La tabla de la sección 2 se distingue porque trae la palabra MARZO o ABRIL en la fila.
var aon = {};
TAB.forEach(function (f) {
  if (!esPieza.test(f.celdas[0])) return;
  var ol = f.celdas.filter(function (c) { return /^(MARZO|ABRIL)$/i.test(c); })[0];
  if (!ol) return;
  var nums = f.celdas.map(num).filter(function (n) { return n !== null; });
  // en esa tabla: EmailID (4-6 díg), envíos correctos, y «traía». El corregido es el 2º número
  // grande; se identifica por posición relativa al EmailID, que es el único de 4-6 dígitos.
  var iE = f.celdas.findIndex(function (c) { return /^\d{4,6}$/.test(c); });
  var correcto = num(f.celdas[iE + 1]), traia = num(f.celdas[iE + 2]);
  // ⚠ la celda viene como «🔴 **CAMBIAR a** `PURCHASE-EP1_AC_EM_A_V1_863587`». `limpio()` quita
  //   los asteriscos y comillas de los EXTREMOS, pero aqui van en medio. Se quita la etiqueta
  //   completa y lo que sobre de markdown: si no, el ContentName entra con `**CAMBIAR a**` dentro.
  var cn = f.celdas[f.celdas.length - 1]
    .replace(/\*\*\s*CAMBIAR a\s*\*\*/i, '').replace(/^CAMBIAR a\s*/i, '')
    .replace(/[`*]/g, '').trim();
  aon[f.celdas[0]] = {
    oleada: ol.toUpperCase(), email_id: f.celdas[iE], sends: correcto, traia: traia,
    content_name_cola: cn, cambiar_cn: /CAMBIAR/i.test(f.celdas[f.celdas.length - 1]), linea: f.linea
  };
});
console.log('\n  ── AON: ' + Object.keys(aon).length + ' filas con oleada y número corregido');
Object.keys(aon).sort().forEach(function (k) {
  var a = aon[k];
  console.log('     ' + k + '  ' + a.oleada.padEnd(6) + 'EmailID ' + a.email_id +
    '   ' + String(a.traia).padStart(7) + ' → ' + String(a.sends).padStart(7) +
    (a.cambiar_cn ? '   🔴 cambia ContentName' : ''));
});

// ── 3 · Pro Plan: la tabla por mascota ──────────────────────────────────────────────
// Se reconoce por el ContentName, que siempre contiene `CDP_Proplan`.
// ⚠ La MASCOTA es lo que distingue la tabla de Pro Plan de la tabla de referencia: las cuatro
//   filas `009-*` también aparecen en la sección 4 con su ContentName, pero sin mascota ni
//   envíos. Sin este filtro entraban cuatro filas fantasma con `sends: null`.
var proplan = [];
TAB.forEach(function (f) {
  var cn = f.celdas.filter(function (c) { return /CDP_Proplan/i.test(c); })[0];
  if (!cn) return;
  var mascota = f.celdas.filter(function (c) { return /^(Perros|Gatos|Mixto)$/i.test(c); })[0];
  if (!mascota) return;                                   // es la fila de referencia, no la de corrección
  var eid = f.celdas.filter(function (c) { return /^\d{4,6}$/.test(c); })[0];
  // la persona viene como «PP (Pro Plan Pet Parents)» → se parte el código de su descripción
  var celdaP = f.celdas.filter(function (c) { return /^(PP|PA|PO|PAE)\b/.test(c); })[0] || '';
  var mp = /^(PAE|PP|PA|PO)\s*(?:\(([^)]*)\))?/.exec(celdaP) || [];
  var id = f.celdas.filter(function (c) { return esPieza.test(c); })[0] || null;
  var nueva = /fila nueva/i.test(f.celdas.join(' '));
  var iE = f.celdas.indexOf(eid);
  proplan.push({
    pieza_id: id, nueva: nueva,
    persona_codigo: mp[1] || '', persona: t(mp[2] || '').replace(/\s*\\?\*$/, ''),
    mascota: mascota, content_name: cn, email_id: eid, sends: num(f.celdas[iE + 1]),
    fechas: f.celdas[iE + 2] || '',
    // 🔴 PAE no existe en el catálogo y el propio doc lo marca «por confirmar». No se da por bueno.
    por_confirmar: /^PAE$/.test(mp[1] || '') ? 'PAE no existe en el catálogo · el doc lo lee como Aspiracionales + Educated Pet Owners, pero hay que validarlo antes de reportarlo' : null,
    linea: f.linea
  });
});
console.log('\n  ── Pro Plan: ' + proplan.length + ' filas   (' +
  proplan.filter(function (p) { return p.nueva; }).length + ' nuevas · ' +
  proplan.filter(function (p) { return p.pieza_id; }).length + ' existentes)');
proplan.forEach(function (p) {
  console.log('     ' + (p.pieza_id || '  NUEVA ').padEnd(10) + String(p.persona_codigo).padEnd(5) +
    String(p.mascota).padEnd(7) + 'EmailID ' + p.email_id + '  ' + String(p.sends).padStart(7) + '  ' + p.fechas);
});

// ── 4 · las notas a reemplazar ──────────────────────────────────────────────────────
var notas = {};
TAB.forEach(function (f) {
  if (!esPieza.test(f.celdas[0])) return;
  var vieja = f.celdas.filter(function (c) { return /alias:/i.test(c); })[0];
  if (!vieja) return;
  var nueva = f.celdas.filter(function (c) { return /^Oleada /i.test(c); })[0];
  notas[f.celdas[0]] = { borrar: vieja, poner: nueva || '', linea: f.linea };
});
console.log('\n  ── notas a corregir: ' + Object.keys(notas).length);
Object.keys(notas).sort().forEach(function (k) { console.log('     ' + k + '  «' + notas[k].poner + '»'); });

// ── 5 · los dos journeys de AON, por si hace falta anclar la oleada ─────────────────
var journeys = {};
Object.keys(aon).forEach(function (k) {
  var m = /_(\d{6,7})$/.exec(aon[k].content_name_cola);
  if (m) { journeys[aon[k].oleada] = m[1]; aon[k].journey_id = m[1]; }
});
console.log('\n  ── journeys por oleada: ' + Object.keys(journeys).map(function (o) { return o + '=' + journeys[o]; }).join(' · '));

var out = {
  paso: 'catalogo-leer · correcciones al catálogo desde el documento de Leslie',
  documento: DOC, leido: new Date(fs.statSync(DOC).mtimeMs).toISOString().slice(0, 10),
  autoridad: 'SFMC (BU NMX - Nestle Mexico, MID 10966050). Datorama es referencia; donde difieren manda SFMC.',
  email_id: emailID, aon: aon, proplan: proplan, notas: notas, journeys_por_oleada: journeys,
  columnas_nuevas: ['EmailID', 'Oleada', 'Mascota'],
  para_el_siguiente: {
    ojo_content_name: 'el doc da la COLA del ContentName; el catálogo guarda el completo. Comparar por cola.',
    ojo_pae: 'PAE está POR CONFIRMAR: no existe en el catálogo. El doc lo lee como Aspiracionales + Educated Pet Owners.',
    ojo_desviacion: 'Pro Plan tiene −14/−16 (0.07%) de desviación constante: es corte de ventana, NO perseguirla.'
  }
};
try { fs.mkdirSync(BACK + '/_catalogo'); } catch (e) { }
fs.writeFileSync(BACK + '/_catalogo/correcciones.json', JSON.stringify(out, null, 1));
console.log('\n  → ' + BACK + '/_catalogo/correcciones.json');
console.log('  ⚠ el Excel NO se tocó: esto solo LEE el documento.');
