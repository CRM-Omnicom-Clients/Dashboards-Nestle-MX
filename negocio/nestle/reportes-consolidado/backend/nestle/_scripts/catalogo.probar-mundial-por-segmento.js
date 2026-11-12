/*
 * catalogo.probar-mundial-por-segmento.js — ¿SE PUEDEN PLEGAR LAS 5 PIEZAS POR SEGMENTO DE
 * MUNDIAL EN SU PIEZA COMBINADA? Mide, no escribe.
 *
 * Rick, 22-sep-2026: «la data de whatsapp no se pudo sacar por pieza sino por partido, entonces
 * quizá deba agruparse como una sola pieza».
 *
 * 🔴 ES UNA REGLA QUE EL SISTEMA YA TIENE, no una idea nueva. `008-P008` (Tercer Tiempo) lo dice
 *    con estas palabras: «la lámina da los totales COMBINADOS, no el reparto A/B: partirlos por
 *    regla de tres sería fabricar el dato, así que la pieza es UNA». Y `005-P011` (WA-J8) lo
 *    repite con su shortlink único. Cuando la fuente solo entrega el total del partido, la pieza
 *    es el partido.
 *
 * 🔴 Y LA PIEZA COMBINADA YA EXISTE: `004-P010` (Partido 2) y `004-P013` (Partido 3) llevan los
 *    162 envíos cada una. Las 5 por segmento son declaraciones del doc de links que nunca se
 *    materializaron como envío. Plegarlas no crea nada: retira lo que nunca fue.
 *
 * 🔴 PERO NO SE BORRA PORQUE «SE VE CLARO». Borrar filas es la operación que más daño ha hecho
 *    en este proyecto. Se hace cuando las CINCO pruebas dicen que sí, y si una falla, no se hace:
 *
 *    P1 · la pieza por segmento no tiene NI UN envío, ni carrito, ni código
 *    P2 · existe su pieza COMBINADA, del mismo partido, y esa sí tiene envíos
 *    P3 · la declaración de audiencia SOBREVIVE a la retirada
 *    P4 · la pieza por segmento no aporta NI UN dato que la combinada no tenga  ← la que protege
 *    P5 · nadie DEPENDE de ella — y una cita no es una dependencia
 *
 * ════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 RE-BASE DE P3 Y P5 · 22-sep-2026 · con motivo, y con la prueba computada
 *
 * Rick: «solo deja las piezas que son, si está en 0 no va, no es lógico con lo que acabamos
 * de decir». O sea: si la pieza es el PARTIDO, una fila por segmento en 0 no es una pieza —
 * es una declaración del doc de links que nunca se materializó como envío.
 *
 * ⚠ Debilitar una guarda para que pase MI PROPIO borrado es justo el modo de falla contra el
 *   que este proyecto escribió sus reglas. Así que las dos se re-basan con la prueba adentro,
 *   no con una lista de excepciones que me deje pasar:
 *
 * P5 · ANTES: «nadie la cita». AHORA: «nadie DEPENDE de ella», y la diferencia se CALCULA:
 *      · una cita en un JSON es dependencia solo si algún script del backend LEE ese archivo
 *      · una cita en una hoja es dependencia solo si su columna NO tiene reconstructor
 *      Medido hoy: `Catalogo_Referencias.Pieza_IDs`/`N_Piezas` es un ROSTER derivado que
 *      reconstruye `lib-ancla-refs.js` (lo invoca `escritor.cierre.js`) — y esa librería ya
 *      contempla el caso: «N_Piezas 0 = declarada y sin usar → visible». Los 3 JSON
 *      (`_fuentes/anclaje.json`, `_catalogo/catalogo.json`, `_catalogo/completar-catalogo.json`)
 *      no los lee ningún script: el único lector de un `catalogo.json` apunta a una ruta que
 *      NO EXISTE. Y `correcciones.json` —el productor que SÍ crea filas— no las menciona,
 *      así que retirarlas no las resucita (la lección de las 12 gemelas de Fuel for life).
 *      🔴 Si mañana alguien lee uno de esos JSON, P5 vuelve a bloquear sola. Es lo que se quería.
 *
 * P3 · ANTES: «la combinada declara su segmento». Eso exigía ESCRIBIR «Modern Cooking» y
 *      «Activos» en el `Segmento` de la combinada — y eso sería AFIRMAR que esos 162 envíos
 *      llegaron a esas audiencias, que ninguna fuente dice: el reporte de WhatsApp da el total
 *      del partido y nada más. Una audiencia PLANEADA no es una audiencia ALCANZADA.
 *      AHORA: la declaración sobrevive **registrada en `Notas` de la combinada**. Se pierde la
 *      pieza, no el hecho de que se declaró. Y P3 sigue pudiendo fallar: si la nota no está,
 *      no pasa.
 * ════════════════════════════════════════════════════════════════════════════════════════
 *
 *   node catalogo.probar-mundial-por-segmento.js
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var AMBITO = 'catalogo';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE|0)$/i;
var esDato = function (v) { return t(v) && !TOKEN.test(t(v)); };
/* normaliza un segmento para comparar: «WA-opt-in Botanas» y «Botana» son el mismo público
   escrito por dos equipos. Se compara la RAÍZ, no el texto, y se dice cuando se hizo. */
function raiz(s) {
  return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/wa-opt-in/g, '').replace(/[^a-z]/g, '').replace(/s$/, '');
}

var PAREJAS = [
  { combinada: '004-P010', porSegmento: ['004-P011', '004-P012'], partido: 'Partido 2' },
  { combinada: '004-P013', porSegmento: ['004-P014', '004-P015', '004-P016'], partido: 'Partido 3' }
];

var tmp = BACK + '/_tmp/_probar-mundial.xlsx';
fs.copyFileSync(VIVO, tmp);
var wb = XLSX.readFile(tmp);
var C = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
function N(id) { return COL.de(C, id, AMBITO); }
var nID = N('Pieza_ID'), nSEG = N('Segmento'), nSENDS = N('Sends'), nTP = N('TouchPoint');
function pieza(id) { return C.filter(function (p) { return t(p[nID]) === id; })[0]; }

console.log('════════ ¿se pueden plegar las 5 piezas por segmento de Mundial? ════════');
console.log('  catálogo: ' + C.length + ' filas\n');

/* ── P5 · QUIÉN DEPENDE, no quién cita ────────────────────────────────────────────────
 * El código del backend se lee UNA vez y se consulta: así «¿es dependencia?» se CALCULA en
 * vez de declararse. Nada de listas de excepciones — una lista me dejaría pasar a mí y
 * dejaría pasar al siguiente error igual. */
var FUENTES_JS = fs.readdirSync(BACK + '/_scripts')
  .filter(function (f) { return /\.js$/.test(f); })
  .map(function (f) {
    var s = ''; try { s = fs.readFileSync(BACK + '/_scripts/' + f, 'utf8'); } catch (e) { }
    return { archivo: f, texto: s, lineas: s.split('\n') };
  });

/* ¿algún script LEE este archivo? Se exige readFileSync y el nombre en la MISMA línea:
 * nombrarlo en un comentario no es leerlo.
 * 🔴 Y se exige el nombre COMPLETO, no un pedazo. Primera versión buscaba el nombre como
 *    substring y `catalogo.json` casó dentro de `consumo-catalogo.json` y de
 *    `completar-catalogo.json`: inventó dos lectores que no existen. Un nombre de archivo
 *    solo cuenta si viene tras `/` o tras comilla, y termina en comilla. */
function quienLeeElArchivo(dir, base) {
  var esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('[/\'"]' + esc + '[\'"]');
  var reRuta = new RegExp(dir + '/' + esc);
  return FUENTES_JS.filter(function (s) {
    return s.lineas.some(function (l) {
      if (l.indexOf('readFileSync') < 0) return false;
      /* la ruta completa gana; si no, el nombre delimitado y que la línea no arme OTRA carpeta */
      return reRuta.test(l) || (re.test(l) && l.indexOf('_contratos') < 0 && l.indexOf('_preescritura') < 0);
    });
  }).map(function (s) { return s.archivo; });
}
/* ¿esta columna tiene RECONSTRUCTOR? Si algún script la nombra entre comillas, la produce
   código — es un roster derivado, y se regenera cuando la pieza se va. */
function quienReconstruyeLaColumna(col) {
  return FUENTES_JS.filter(function (s) {
    return s.texto.indexOf("'" + col + "'") >= 0 || s.texto.indexOf('"' + col + '"') >= 0;
  }).map(function (s) { return s.archivo; });
}

/* 🔴 TRES CLASES, no dos. Con dos, esto se muerde la cola: `_catalogo/catalogo.json` lo LEE
 * `catalogo.prueba-anclas.js` (que tiene turno) para cruzar JSON ↔ Excel, así que retirar la fila
 * del Excel sin sacarla del JSON descuadra el ancla — pero el JSON solo se puede actualizar
 * DENTRO del retiro, y P5 no dejaría llegar ahí. La salida no es una excepción: es nombrar lo que
 * de verdad es. Un archivo así no BLOQUEA, se SINCRONIZA en el mismo acto, y el retirador está
 * obligado a hacerlo y a comprobarlo.
 *   bloquea      · algo lo lee y el retiro no puede arreglarlo → no se toca la fila
 *   sincroniza   · algo lo lee y el retiro DEBE actualizarlo en el mismo acto
 *   registra     · nadie lo lee, o es un roster que se reconstruye → nada que hacer
 * `_catalogo/registro-ids.json` es el caso especial y su propia doctrina lo dice: APPEND-ONLY,
 * «un id liberado NUNCA se reutiliza». Si una cita ahí bloqueara, no se podría retirar nada nunca. */
var SINCRONIZABLES = { 'catalogo.json': 'el retirador saca la pieza de J.piezas' };
var APPEND_ONLY = { 'registro-ids.json': 'append-only por doctrina: el id se reserva para siempre' };

function quienDependeDeElla(id) {
  var dep = [], reg = [], sinc = [];
  wb.SheetNames.forEach(function (h) {
    if (h === 'Catalogo_Piezas') return;
    var J = XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '' });
    var porCol = {};
    J.forEach(function (r) {
      Object.keys(r).forEach(function (c) { if (t(r[c]).indexOf(id) >= 0) porCol[c] = (porCol[c] || 0) + 1; });
    });
    Object.keys(porCol).forEach(function (c) {
      var rec = quienReconstruyeLaColumna(c);
      var donde = 'hoja ' + h + '.' + c + ' (' + porCol[c] + ')';
      if (rec.length) reg.push(donde + ' → roster, lo reconstruye ' + rec[0]);
      else dep.push(donde + ' → 🔴 ninguna rutina la reconstruye');
    });
  });
  /* 🔴 UNA DEPENDENCIA NO ES UNA MENCIÓN. Se busca el id como VALOR dentro del JSON, no el texto
   *    suelto: los informes que denuncian estas piezas las nombran en su bitácora, y contarlo
   *    como dependencia haría que el propio reporte que las señala impidiera retirarlas. */
  ['_fuentes', '_rejilla', '_catalogo'].forEach(function (d) {
    var dir = BACK + '/' + d; if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
      var s;
      try { s = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return; }
      if (s.indexOf('"' + id + '"') < 0) return;
      var lect = quienLeeElArchivo(d, f);
      /* 🔴 y leerlo no basta: si lo lee de una ruta que NO EXISTE, ese lector está muerto y no
       *    depende de nada. Pasó con `catalogo.prueba-anclas.js`, que lee `BACK/catalogo.json`
       *    mientras el archivo vive en `_catalogo/catalogo.json`. */
      /* 🔴 LA RUTA SE RESUELVE CON EL `BACK` DEL LECTOR, NO CON EL MÍO. Primera versión usaba el
       *    mío (la raíz del backend) y declaró MUERTO a `catalogo.prueba-anclas.js`, que define
       *    su `BACK` terminando en `_catalogo` y por tanto SÍ encuentra el archivo. P5 se puso
       *    verde sola: el defecto exacto contra el que existe esta prueba. */
      var vivos = lect.filter(function (nom) {
        var src = FUENTES_JS.filter(function (s) { return s.archivo === nom; })[0];
        var linea = src.lineas.filter(function (l) { return l.indexOf('readFileSync') >= 0 && l.indexOf(f) >= 0; })[0] || '';
        var m = /readFileSync\(\s*[A-Za-z_$][\w$]*\s*\+\s*'([^']+)'/.exec(linea);
        if (!m) return true;                                   // no pude resolver la ruta → cuenta
        var mb = /var\s+BACK\s*=\s*os\.homedir\(\)\s*\+\s*'([^']+)'/.exec(src.texto);
        var base = mb ? os.homedir() + mb[1] : BACK;           // el BACK del LECTOR
        return fs.existsSync(base + m[1]) || fs.existsSync(base + '/' + m[1].replace(/^\//, ''));
      });
      if (APPEND_ONLY[f]) { reg.push(d + '/' + f + ' → ' + APPEND_ONLY[f]); return; }
      if (vivos.length && SINCRONIZABLES[f]) sinc.push(d + '/' + f + ' → lo lee ' + vivos.join(', ') + '; ' + SINCRONIZABLES[f]);
      else if (vivos.length) dep.push(d + '/' + f + ' → 🔴 lo lee ' + vivos.join(', '));
      else if (lect.length) reg.push(d + '/' + f + ' → lo lee ' + lect.join(', ') + ', pero de una RUTA MUERTA');
      else reg.push(d + '/' + f + ' → registro, ningún script lo lee');
    });
  });
  return { dependencias: dep, sincronizar: sinc, registros: reg };
}

var veredicto = [], aSincronizar = {};
PAREJAS.forEach(function (par) {
  var comb = pieza(par.combinada);
  console.log('── ' + par.partido + '   ·   combinada ' + par.combinada +
    '  (' + t(comb[nSENDS]) + ' envíos, seg «' + t(comb[nSEG]).slice(0, 46) + '»)');
  var segsComb = t(comb[nSEG]).split(/\s*,\s*/).map(raiz).filter(Boolean);

  par.porSegmento.forEach(function (id) {
    var p = pieza(id);
    if (!p) { console.log('   ' + id + ' · ya no está'); return; }
    var pruebas = [];

    // P1 · sin envíos, sin carritos, sin códigos
    var sends = t(p[nSENDS]);
    var cods = Object.keys(p).filter(function (k) { return /^Cod_/.test(k) && esDato(p[k]); });
    var carr = esDato(p['Carritos_Total']);
    var p1 = !esDato(sends) && !cods.length && !carr;
    pruebas.push(['P1 sin envíos/carritos/códigos', p1, 'Sends «' + (sends || '(vacío)') + '» · códigos ' + cods.length + ' · carritos ' + (carr ? 'sí' : 'no')]);

    // P2 · la combinada existe y sí tiene envíos
    var p2 = !!comb && esDato(comb[nSENDS]);
    pruebas.push(['P2 la combinada tiene envíos', p2, par.combinada + ' → ' + t(comb[nSENDS])]);

    /* P3 · la DECLARACIÓN sobrevive. Dos formas válidas, y ninguna inventa cobertura:
     *   a) la combinada ya declara ese segmento  → el hecho vive en `Segmento`
     *   b) la combinada lo registra en `Notas`   → el hecho vive como declaración, sin afirmar
     *      que esos envíos llegaron ahí (la fuente da el total del partido, no el reparto) */
    var miSeg = raiz(p[nSEG]);
    var enSeg = segsComb.indexOf(miSeg) >= 0;
    var nota = t(comb['Notas']);
    var enNota = nota.indexOf(id) >= 0 || raiz(nota).indexOf(miSeg) >= 0;
    var p3 = enSeg || enNota;
    pruebas.push(['P3 la declaración sobrevive', p3,
      enSeg ? '«' + t(p[nSEG]) + '» ya está en el Segmento de la combinada'
        : (enNota ? '«' + t(p[nSEG]) + '» registrada en Notas de ' + par.combinada
          : '🔴 ni en Segmento (' + segsComb.join('/') + ') ni en Notas — se perdería el hecho')]);

    // P4 · no aporta ni un dato que la combinada no tenga
    var aporta = [];
    Object.keys(p).forEach(function (col) {
      if (col === nID || col === nSEG || col === nTP) return;     // su identidad, por definición difiere
      if (!esDato(p[col])) return;
      if (t(comb[col]) === t(p[col])) return;
      if (!esDato(comb[col])) aporta.push(col);
    });
    var p4 = !aporta.length;
    pruebas.push(['P4 no aporta ningún dato propio', p4, p4 ? 'nada que la combinada no tenga' : '🔴 aporta: ' + aporta.slice(0, 5).join(' · ')]);

    // P5 · nadie DEPENDE de ella — las citas que solo la registran no cuentan
    var q = quienDependeDeElla(id);
    var p5 = !q.dependencias.length;
    pruebas.push(['P5 nadie depende de ella', p5,
      (p5 ? 'ninguna dependencia que bloquee' : '🔴 ' + q.dependencias.slice(0, 3).join(' · ')) +
      '   ·   a sincronizar: ' + q.sincronizar.length + '   ·   solo registran: ' + q.registros.length]);
    q.sincronizar.forEach(function (r) { console.log('             ↳ SINCRONIZAR: ' + r); });
    q.registros.forEach(function (r) { console.log('             ↳ registro:    ' + r); });
    aSincronizar[id] = q.sincronizar;

    var todas = pruebas.every(function (x) { return x[1]; });
    console.log('   ' + (todas ? '✅' : '🔴') + ' ' + id + '  «' + t(p[nSEG]) + '»   → ' + (todas ? 'SE PUEDE PLEGAR' : 'NO se toca'));
    pruebas.forEach(function (x) { console.log('        ' + (x[1] ? '✔' : '🔴') + ' ' + x[0].padEnd(36) + x[2]); });
    veredicto.push({ id: id, segmento: t(p[nSEG]), combinada: par.combinada, plegable: todas, pruebas: pruebas.map(function (x) { return { prueba: x[0], pasa: x[1], detalle: x[2] }; }) });
  });
  console.log('');
});

var si = veredicto.filter(function (v) { return v.plegable; });
var no = veredicto.filter(function (v) { return !v.plegable; });
console.log('════ VEREDICTO ════');
console.log('  ✅ se pueden plegar: ' + si.length + (si.length ? '   ' + si.map(function (v) { return v.id; }).join(' · ') : ''));
console.log('  🔴 NO se tocan:      ' + no.length + (no.length ? '   ' + no.map(function (v) { return v.id + ' (' + v.segmento + ')'; }).join(' · ') : ''));
if (no.length) console.log('\n  Una prueba que falla no es un detalle: es la razón por la que esa fila NO es redundante.');
fs.writeFileSync(BACK + '/_preescritura/probar-mundial-por-segmento.json', JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), veredicto: veredicto, a_sincronizar: aSincronizar
}, null, 1));
console.log('\n→ _preescritura/probar-mundial-por-segmento.json');
