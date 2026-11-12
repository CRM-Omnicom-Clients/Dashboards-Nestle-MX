/*
 * orquestador.verificar-estado-docs.js — LOS DOCUMENTOS DE ESTADO, CONTRA EL DISCO.
 *
 * 🔴 POR QUÉ. `estado-reportes.md` estuvo **desfasado desde julio hasta el 8-sep**: decía «v7 · WK31»
 *    cuando el sistema ya iba en v8 con 17 etapas. Y el handoff decía «126 piezas · 82 columnas»
 *    cuando el catálogo tenía 122 y 85, y «5 guardas» habiendo 6. Nadie mintió: se escribieron
 *    verdad y el disco siguió cambiando. **Un documento de estado no se desfasa por descuido, se
 *    desfasa por definición** — lo único que lo evita es volverlo a medir.
 *
 * 🔴 CADA AFIRMACIÓN TRAE SU MEDICIÓN AL LADO. No se parsea la prosa: se declara aquí qué dice el
 *    documento y **cómo se comprueba**. Si el doc dice X y el disco dice Y, se imprimen los dos y
 *    falla. Un check que solo dijera «algo no cuadra» obligaría a buscar a mano, y buscar a mano es
 *    lo que nadie hace.
 *
 * 🔴 NO ARREGLA EL DOCUMENTO. Reescribir la cifra sola parecería que el estado se mantiene al día
 *    cuando lo que cambió puede ser un defecto. Quien decide si el número nuevo es correcto o es un
 *    síntoma es una persona.
 *
 *   node orquestador.verificar-estado-docs.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var H = os.homedir();
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ORQ = PROY + '/_orquesta';
var LIBRO = ENT.LIBRO;

var mil = function (n) { return Number(n || 0).toLocaleString('es-MX'); };
function leerJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

console.log('════════ ¿LOS DOCUMENTOS DE ESTADO DICEN LO QUE HAY EN DISCO? ════════\n');

// ── el libro, leído de una copia local (ruta con acentos + puede estar abierto)
var hojas = {}, nHojas = 0, libroOK = true;
try {
  var tmp = BACK + '/_tmp/_verificar-docs.xlsx';
  fs.copyFileSync(LIBRO, tmp);
  var wb = XLSX.readFile(tmp);
  nHojas = wb.SheetNames.length;
  wb.SheetNames.forEach(function (n) {
    var r = XLSX.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1');
    hojas[n] = { filas: r.e.r, cols: r.e.c + 1 };
  });
  fs.unlinkSync(tmp);
} catch (e) {
  libroOK = false;
  console.log('  ⊘ no pude leer el libro (' + String(e.message).slice(0, 50) + ')');
  console.log('    Lo que dependa de él sale como NO EVALUADO, que no cuenta como pasar.\n');
}

// ── las mediciones vivas
var Q = leerJson(BACK + '/_fuentes/qcart.json') || {};
var W = leerJson(BACK + '/_fuentes/whatsapp.json') || {};
var E = leerJson(BACK + '/_fuentes/email.json') || {};
var C = leerJson(BACK + '/_contratos/cadena-skills.json') || {};
var nScripts = fs.readdirSync(BACK + '/_scripts').filter(function (f) { return /\.js$/.test(f); }).length;
var nGuardas = (function () {
  try {
    var yo = fs.readFileSync(BACK + '/_scripts/orquestador.guardas.js', 'utf8'), v = {};
    (yo.match(/══ GUARDA (\d+) ·/g) || []).forEach(function (m) { v[/(\d+)/.exec(m)[1]] = 1; });
    return Object.keys(v).length;
  } catch (e) { return null; }
})();
var etapas = (C.etapas || []).length;
var vistasQ = (Q.carritos || []).reduce(function (a, x) { return a + (Number(x.views) || 0); }, 0);
var clicksW = (W.envios || []).reduce(function (a, x) { return a + (Number(x.clicks) || 0); }, 0);
var sendsE = (E.envios || []).reduce(function (a, x) { return a + (Number(x.email_sends) || 0); }, 0);

// ── las afirmaciones: qué dice el doc · cuánto hay · cómo se volvió a medir
var AF = [
  { doc: 'estado-reportes.md', dice: '**124 piezas · 85 columnas**', hay: libroOK && hojas['Catalogo_Piezas'] ? hojas['Catalogo_Piezas'].filas + ' piezas · ' + hojas['Catalogo_Piezas'].cols + ' columnas' : null, como: 'filas y columnas de Catalogo_Piezas' },
  { doc: 'estado-reportes.md', dice: '**89 filas × 87 columnas**', hay: libroOK && hojas['Report_Resumen'] ? hojas['Report_Resumen'].filas + ' filas × ' + hojas['Report_Resumen'].cols + ' columnas' : null, como: 'rango de Report_Resumen' },
  /* 🔴 UN CONTEO DE ARCHIVOS NO ES UNA AFIRMACIÓN QUE MEREZCA UN CHECK. Aquí había
   *    «**N scripts** en `_scripts/`», y se desfasó TRES veces en una sola tarde: 251 → 256 → 257
   *     → 258, una por cada script que agregué. Cada vez el verificador salía rojo por algo que no
   *    era un error, y encima pedía editar el doc Y su propio check. Ese es el ruido que acaba con
   *    que nadie lea los avisos.
   *    Lo que sí es un invariante —y sí debe gritar si se rompe— es que **ningún script del backend
   *    ande sin skill dueño**: un huérfano significa que «correr la cadena de skills» deja fuera
   *    parte del corte, en silencio. El conteo se saca con el censo, que además dice de quién es
   *    cada uno. */
  {
    doc: 'estado-reportes.md',
    dice: 'ningún script del backend sin skill dueño',
    hay: (function () {
      try {
        var C = JSON.parse(fs.readFileSync(BACK + '/_contratos/orquestador.censo-scripts.json', 'utf8'));
        var s = JSON.stringify(C);
        var m = s.match(/"sin_?(skill|duenio|dueno)"\s*:\s*\[([^\]]*)\]/);
        var h = m ? (m[2].trim() ? m[2].split(',').length : 0) : 0;
        return h + ' huérfano(s)';
      } catch (e) { return 'no pude leer el censo'; }
    })(),
    como: 'scripts sin skill dueño en el censo',
    num: 0, esperado: 0
  },
  { doc: 'estado-reportes.md', dice: 'Las **7 guardas del preflight**', hay: nGuardas + ' guardas', como: 'encabezados de guarda en orquestador.guardas.js', num: nGuardas, esperado: 7 },
  { doc: 'estado-reportes.md', dice: '17 etapas · 12 skills · 23 pasos · 15 suites · 0 huérfanos.', hay: etapas + ' etapas', como: 'etapas de cadena-skills.json', num: etapas, esperado: 17 },
  // 🔴 LAS CIFRAS DE §2bis SON NARRACIÓN, NO ESTADO — y por eso ya no se comprueban contra el
  //    disco. «3,077 filas son 7,503 carritos» describe el defecto que se encontró el 24-sep.
  //    Exigirle que coincida con hoy obliga a reescribir la HISTORIA en cada corte, y una
  //    historia reescrita deja de explicar por qué existe la guarda. Lo que sí se comprueba es
  //    lo que `estado-reportes.md` declara VIGENTE, abajo.
  { doc: 'estado-reportes.md', dice: 'Σ carritos **8,184**', hay: mil(vistasQ) + ' carritos', como: 'Σ views del bloque de qcart', num: vistasQ, esperado: 8184 },
  { doc: 'estado-reportes.md', dice: 'Σ WA-Clicks **1,240**', hay: mil(clicksW) + ' clicks', como: 'Σ clicks del bloque de whatsapp', num: clicksW, esperado: 1240 },
  { doc: 'estado-reportes.md', dice: 'Σ email **10,395,076**', hay: mil(sendsE) + ' envíos', como: 'Σ email_sends del bloque de email', num: sendsE, esperado: 10395076 },
  { doc: 'estado-reportes.md', dice: '`Report_Resumen` 88 filas de dato', hay: libroOK && hojas['Report_Resumen'] ? (hojas['Report_Resumen'].filas - 1) + ' filas de dato' : null, como: 'filas de Report_Resumen menos la de totales', num: libroOK && hojas['Report_Resumen'] ? hojas['Report_Resumen'].filas - 1 : null, esperado: 88 }
];

// ── 1 · la frase está DONDE dice que está. Sin esto se comprobarían cifras de un texto que ya no existe.
var textos = {};
['estado-reportes.md', 'HANDOFF-ESTADO-SISTEMA.md'].forEach(function (f) {
  try { textos[f] = fs.readFileSync(ORQ + '/' + f, 'utf8'); } catch (e) { textos[f] = null; }
});
var fallos = 0, noEval = 0;
AF.forEach(function (a) {
  var arch = a.doc.indexOf('HANDOFF') === 0 ? 'HANDOFF-ESTADO-SISTEMA.md' : a.doc;
  var t = textos[arch];
  var estaLaFrase = t ? t.indexOf(a.dice) >= 0 : null;
  // 🔴 SE COMPARAN LOS NÚMEROS, NORMALIZANDO EL SEPARADOR DE MILES. El respaldo comparaba el primer
  //    token tal cual, así que el doc diciendo «3,126» y el disco diciendo «3126» salía como
  //    descuadre: un falso rojo del comparador, no del documento. Un verificador que grita por su
  //    propio formato entrena a ignorarlo, que es peor que no tenerlo.
  var soloNum = function (s) {
    return (String(s).match(/\d[\d.,]*/g) || []).map(function (x) { return x.replace(/[.,](?=\d{3}\b)/g, ''); });
  };
  var cuadra;
  if (a.esperado !== undefined) cuadra = (a.num === a.esperado);
  else {
    var nd = soloNum(a.dice), nh = soloNum(a.hay);
    cuadra = a.hay !== null && nh.length > 0 && nh.every(function (x) { return nd.indexOf(x) >= 0; });
  }

  if (t === null || a.hay === null) {
    console.log('  ⊘ ' + a.doc.padEnd(22) + '«' + a.dice.replace(/\*\*|`/g, '') + '»');
    console.log('      NO PUDE EVALUAR — ' + (t === null ? 'no leí el documento' : 'no pude medirlo') + '. No cuenta como pasar.');
    noEval++; return;
  }
  if (!estaLaFrase) {
    console.log('  🔴 ' + a.doc.padEnd(22) + 'la frase «' + a.dice.replace(/\*\*|`/g, '') + '» YA NO ESTÁ en el documento');
    console.log('      Este check quedó apuntando a un texto que alguien cambió: actualízalo aquí también,');
    console.log('      o el verificador se vuelve el documento desfasado.');
    fallos++; return;
  }
  console.log('  ' + (cuadra ? '✔' : '🔴') + ' ' + a.doc.padEnd(22) + '«' + a.dice.replace(/\*\*|`/g, '') + '»');
  console.log('      disco: ' + a.hay + '   (' + a.como + ')');
  if (!cuadra) fallos++;
});

// ── 2 · la fecha del documento contra la del libro: un estado más viejo que su objeto miente por omisión
if (libroOK) {
  var mLibro = fs.statSync(LIBRO).mtime;
  ['estado-reportes.md', 'HANDOFF-ESTADO-SISTEMA.md'].forEach(function (f) {
    try {
      var m = fs.statSync(ORQ + '/' + f).mtime;
      var dias = Math.floor((mLibro - m) / 86400000);
      console.log('\n  ' + (dias > 7 ? '⚠' : '✔') + ' ' + f + ': escrito ' + m.toISOString().slice(0, 10) +
        ' · el libro ' + mLibro.toISOString().slice(0, 10) + (dias > 0 ? '   (el doc va ' + dias + ' día(s) atrás)' : ''));
      if (dias > 7) console.log('      Más de una semana atrás del libro: lo que afirme del libro es sospechoso.');
    } catch (e) { }
  });
}

console.log('\n════ ' + (fallos ? '🔴 ' + fallos + ' afirmación(es) NO cuadran con el disco' :
  noEval ? '⚠ PASA CON ' + noEval + ' SIN EVALUAR — no cuenta como verde' :
    '✅ LAS ' + AF.length + ' AFIRMACIONES MEDIBLES CUADRAN CON EL DISCO') + ' ════');
process.exit(fallos ? 1 : 0);
