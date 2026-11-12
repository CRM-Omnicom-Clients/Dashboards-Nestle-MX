// lib-qcart-links.js — la AUTORIDAD de qué link de Qcart es nuestro y desde cuándo cuenta.
//
// Fuente: `ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx`, el doc que el equipo mantiene a mano.
//
// 🔴 LAS DOS REGLAS QUE DEFINEN EL FILTRO (Rick, 19-ago-2026):
//    1 · si su «Fecha de envío» NO es una fecha ("No seleccionado", vacío, cualquier texto)
//        → **el link NO es válido** y su tráfico no entra a ningún reporte.
//    2 · si SÍ es una fecha → esa es la **fecha de activación de Qcart**, y solo cuenta el
//        tráfico **de ese día en adelante**. Antes de esa fecha el link puede tener actividad
//        de pruebas o de otra campaña: contarla infla los números.
//
// ⚠ El doc tiene DOS esquemas y el encabezado NO está en la fila 1 (hay notas encima):
//      Jul/Ago  fila 4   `utm_campaign · Fecha de envío · … · Códigos`  (hasta 3 recetas)
//      Marzo    fila 8   `Audiencia · Nombre Mail · Fecha Envío · Fecha Fin · … · ID`
//    Por eso el encabezado se BUSCA por contenido, nunca por posición: el mes que viene el
//    equipo puede meter otra nota arriba y correrlo una fila.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
// la tabla de meses vive en UN solo sitio: duplicarla es garantizar que diverjan
var FLEX = require(__dirname + '/lib-flexible.js');

function t(v) { return String(v == null ? '' : v).trim(); }
// una sola normalizadora de ENCABEZADOS para todos los lectores: cinco copias idénticas hoy
// son cinco copias divergentes mañana. (No es `lib-alias.nm`, que resuelve DIMENSIONES y sí
//  quita los separadores — son trabajos distintos, y confundirlos ya costó un defecto.)
var nmz = require(__dirname + '/lib-flexible.js').nmEncabezado;

// serial de Excel → ISO. El doc los guarda como número, no como texto.
// 🔴 Y TAMBIÉN en español: «19 de julio» ES una fecha, escrita a mano por el equipo. Tratarla
//    como inválida descartaba links buenos — el error va justo en la dirección que hay que
//    evitar: perder tráfico real por no entender cómo lo escribió una persona.
function isoDe(v, anioPorDefecto) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 40000 && v < 60000) {
    return new Date(Date.UTC(1899, 11, 30 + v)).toISOString().slice(0, 10);
  }
  var s = t(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[0];
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);          // dd/mm/aaaa
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  /* 🔴 21-sep-2026 · `dd/mm` SIN AÑO — el equipo lo escribe así cuando el mes ya lo dice la hoja.
   *    La celda de `DTuqPqBo` (WA-J8) dice «10/09 - 12/ 09»: sin esta rama, `10/09` no era una
   *    fecha, el link salía inválido y su tráfico se tiraba entero.
   * 🔴 DÍA PRIMERO, que es como escribe el equipo (el doc es en español y sus fechas completas
   *    vienen `dd/mm/aaaa`). Se exige que el segundo número sea un mes real: así `13/09` se lee
   *    como 13 de septiembre y nunca como «mes 13». Si el primero pasa de 31 o el segundo de 12,
   *    no se adivina: se devuelve null y el link queda inválido con su motivo. */
  m = /^(\d{1,2})[\/\-](\d{1,2})$/.exec(s);
  if (m && anioPorDefecto) {
    var dd = +m[1], mm2 = +m[2];
    if (dd >= 1 && dd <= 31 && mm2 >= 1 && mm2 <= 12) {
      return anioPorDefecto + '-' + ('0' + mm2).slice(-2) + '-' + ('0' + dd).slice(-2);
    }
  }
  // «19 de julio» · «19 julio» · «19 de julio 2026»
  // ⚠ el mes lo reconoce lib-flexible, que conoce los 12. Tener aquí una segunda tabla era
  //   garantizar que las dos divergieran: la de allá se corrige y esta se queda atrás.
  var e = /(\d{1,2})\s*(?:de\s*)?([A-Za-zÁÉÍÓÚáéíóú]{3,12})(?:\s*(?:de\s*)?(\d{4}))?/.exec(s);
  if (e) {
    var mm = FLEX.mesDe(e[2]);
    if (mm) {
      var anio = e[3] || anioPorDefecto || String(new Date().getUTCFullYear());
      return anio + '-' + mm + '-' + ('0' + e[1]).slice(-2);
    }
  }
  var n = Number(s.replace(/[, ]/g, ''));
  if (isFinite(n) && n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
  return null;                                                    // NO es fecha → link inválido
}

var TERM = /utm_campaign|fecha de env|fecha env|codigos|^id$|links qcart|receta/i;
function encabezado(M) {
  var mejor = -1, pts = 2;
  M.slice(0, 15).forEach(function (f, i) {
    var p = f.filter(function (c) { return TERM.test(nmz(c)); }).length;
    if (p > pts) { pts = p; mejor = i; }
  });
  return mejor;
}

// Un código de shortlink: 6-12 alfanuméricos. Se acepta el código suelto o dentro de la URL.
// 🔴 Una celda puede traer VARIOS separados por «;» (`cartanywhere ; tJEICO87 ; Z8W0ZouI`) y
//    alguno no ser un código (`cartanywhere`). Se devuelven todos los que sí lo son.
// 🔴 La FORMA de un código, no una lista de excepciones. Un shortlink de Qcart mezcla
//    mayúsculas y minúsculas en medio de la palabra (`NhrllATy`, `qrMAKnjA`, `os3U6hWb`) o
//    trae dígitos. Una palabra normal —`Practicos`, `Indulgentes`, `cartanywhere`— no.
//    Sin esto, detectar la columna por contenido tragaba la de segmentos: `Practicos` pasaba
//    por código y aparecía como «link válido sin pieza».
function pareceCodigo(p) {
  if (!/^[A-Za-z0-9]{6,12}$/.test(p)) return false;
  if (/^\d+$/.test(p)) return false;                       // solo dígitos: es un id o una cifra
  if (/\d/.test(p)) return true;                           // con dígito: código
  return /[a-z][A-Z]|[A-Z].*[A-Z]/.test(p);                // camelCase o 2+ mayúsculas: código
}
function codigosDe(v) {
  var s = t(v);
  if (!s) return [];
  var out = [];
  s.split(/[;,\n\r]+/).forEach(function (p) {
    p = t(p);
    if (!p) return;
    // 🔴 A7 · la URL NO exime de la prueba de forma. Aquí se colaba `cartanywhere`: venía dentro
    //    de un `…/cartanywhere` y esta rama lo aceptaba sin preguntarle la forma, mientras la rama
    //    de abajo —la del código suelto— sí lo rechazaba. El mismo dato pasaba o no según cómo
    //    viniera escrito. `cartanywhere` es el nombre del servicio, no un shortlink.
    var m = /qcart\.app\/([A-Za-z0-9]{6,12})/.exec(p);
    if (m) { if (pareceCodigo(m[1])) out.push(m[1]); return; }
    if (pareceCodigo(p)) out.push(p);
  });
  return out;
}
function codigoDe(v) { return codigosDe(v)[0] || null; }

// 🔴 La columna de códigos NO siempre tiene encabezado: en Mayo vive en `L` y la fila de
//    encabezados la deja vacía. Buscarla solo por nombre encontraba CERO códigos en esa hoja.
//    Se detecta por CONTENIDO: la columna cuyas celdas son mayoritariamente códigos.
function columnasDeCodigo(M, iH) {
  var cols = [];
  var ancho = M[iH] ? M[iH].length : 0;
  for (var k = 0; k < ancho + 6; k++) {
    var vistos = 0, aciertos = 0;
    for (var i = iH + 1; i < Math.min(M.length, iH + 220); i++) {
      var v = M[i] && M[i][k];
      if (!t(v)) continue;
      vistos++;
      if (codigosDe(v).length) aciertos++;
    }
    if (vistos >= 3 && aciertos / vistos >= 0.7) cols.push(k);
  }
  return cols;
}

/**
 * Lee el doc completo y devuelve un registro por CÓDIGO de shortlink.
 * Nunca descarta en silencio: lo inválido se devuelve con su motivo.
 */
function leer(ruta) {
  var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_qlinks_lib.xlsx';
  fs.copyFileSync(ruta, tmp);                       // rutas con acentos: siempre por copia ASCII
  var wb = XLSX.readFile(tmp);
  var out = { archivo: path.basename(ruta), links: {}, invalidos: [], hojas: [], sin_codigo: 0, sin_fecha_en_la_hoja: [] };

  // 🔴 QUÉ HOJAS SON CALENDARIO Y CUÁLES NO (corregido 19-ago-2026)
  //
  //    `Reagendar` SÍ es calendario y yo la excluía. Ahí viven 9 links de `lechera-junio` con
  //    tráfico real, y por excluirla el sistema los reportaba como «desconocidos» cuando en
  //    realidad el doc SÍ los declara: su fecha dice **«Por reagendar»**, que no es una fecha.
  //    Leyéndola quedan donde deben — inválidos con su motivo — en vez de invisibles.
  //
  //    `Cuaresma` se excluye a propósito: no tiene columna de fecha, así que ninguno de sus
  //    links se puede fechar. Sin fecha no hay ventana, y sin ventana no se puede filtrar.
  //    (Decisión de Rick, 19-ago: «Cuaresma no va, no hay links fechados pues no funciona».)
  //
  //    `Reemplazos` es una tabla de sustitución de productos, no un calendario.
  var NO_CALENDARIO = /resultado|roadmap|borrador|reemplazo|cuaresma/i;
  wb.SheetNames.forEach(function (hoja) {
    if (NO_CALENDARIO.test(hoja)) {
      out.hojas.push({ hoja: hoja, codigos: 0, invalidos: 0,
        nota: /cuaresma/i.test(hoja)
          ? '⛔ EXCLUIDA por decisión: no tiene columna de fecha, sus links no se pueden fechar'
          : 'no es un calendario de envíos' });
      return;
    }
    var M = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: '' });
    var iH = encabezado(M);
    if (iH < 0) { out.hojas.push({ hoja: hoja, nota: 'sin encabezado reconocible' }); return; }
    var cols = M[iH].map(function (c) { return nmz(c); });

    // las columnas se ubican por NOMBRE. `Códigos` aparece hasta 3 veces (receta 1, 2, 3):
    // se toman TODAS, no la primera — si no, se pierden las recetas 2 y 3 de cada fila.
    var iFecha = cols.findIndex(function (c) { return /fecha de env|fecha env/.test(c); });
    var iCods = []; cols.forEach(function (c, k) { if (/^codigos?$/.test(c) || /^id$/.test(c)) iCods.push(k); });
    var iLinks = []; cols.forEach(function (c, k) { if (/links? qcart/.test(c)) iLinks.push(k); });
    // + las que se detectan por contenido (la de Mayo no tiene encabezado)
    columnasDeCodigo(M, iH).forEach(function (k) { if (iCods.indexOf(k) < 0 && iLinks.indexOf(k) < 0) iCods.push(k); });
    // el año de la hoja, para resolver «19 de julio» sin inventarlo
    var anio = (/(20\d\d)/.exec(hoja) || [])[1] || (function () {
      for (var i = iH + 1; i < Math.min(M.length, iH + 60); i++) {
        var f2 = iFecha >= 0 && M[i] ? isoDe(M[i][iFecha]) : null;
        if (f2) return f2.slice(0, 4);
      }
      return null;
    })();
    if (iFecha < 0) {
      out.hojas.push({ hoja: hoja, encabezado_en_fila: iH + 1, codigos: 0, invalidos: 0,
        nota: '🔴 esta hoja NO tiene columna de fecha — sus links no se pueden fechar (distinto de «no se envió»)' });
      // se registran igual, como pendientes de fecha: descartarlos en silencio sería peor
      var pend = 0;
      M.slice(iH + 1).forEach(function (f, k) {
        iCods.concat(iLinks).forEach(function (ci) {
          codigosDe(f[ci]).forEach(function (cod) {
            pend++;
            out.sin_fecha_en_la_hoja.push({ codigo: cod, hoja: hoja, fila: iH + k + 2,
              motivo: 'la hoja no tiene columna de fecha de envío' });
          });
        });
      });
      out.hojas[out.hojas.length - 1].codigos = pend;
      return;
    }
    var iCamp = cols.findIndex(function (c) { return /utm_campaign|^campana$|^campa/.test(c); });
    var iRec = []; cols.forEach(function (c, k) { if (/^receta/.test(c) || /^recetas$/.test(c)) iRec.push(k); });
    var iFin = cols.findIndex(function (c) { return /fecha fin/.test(c); });
    var iTerm = cols.findIndex(function (c) { return /utm_term/.test(c); });
    var iCont = cols.findIndex(function (c) { return /utm_content/.test(c); });

    var n = 0, inv = 0;
    M.slice(iH + 1).forEach(function (f, k) {
      var fechaCruda = iFecha >= 0 ? f[iFecha] : '';
      var fecha = isoDe(fechaCruda, anio);
      // todos los códigos de la fila: los de la columna `Códigos` y los que vengan en las URL
      var codigos = [];
      iCods.concat(iLinks).forEach(function (ci) { codigosDe(f[ci]).forEach(function (c) { if (codigos.indexOf(c) < 0) codigos.push(c); }); });
      if (!codigos.length) { out.sin_codigo++; return; }

      /* 🔴 21-sep-2026 · UN RANGO SÍ ES UNA FECHA. La celda de `DTuqPqBo` (WA-J8) dice
       *    «10/09 - 12/ 09» — el link estuvo activo del 10 al 12 de septiembre, tal como lo
       *    confirmó Rick. `isoDe` no lo entiende, devuelve vacío, y el lector concluía «su Fecha
       *    de envío no es una fecha → el link no se envió, no cuenta». O sea: convertía un dato en
       *    una ausencia y tiraba su tráfico.
       *    No es un caso raro: el equipo escribe rangos cuando el link vive varios días, y el
       *    maestro YA tiene el concepto (`fecha_fin`). Se parte por el separador, y si las DOS
       *    mitades son fechas, la primera es la activación y la segunda el fin. Si solo una lo es,
       *    se usa ésa. Si ninguna, ahí sí no es una fecha.
       *    ⚠ Los espacios sucios («12/ 09») se limpian antes: son de teclear, no de significado. */
      var finDelRango = null;
      if (!fecha) {
        var partes = t(fechaCruda).split(/\s*(?:-|–|—|\ba\b|\bal\b|\bhasta\b)\s*/i)
          .map(function (x) { return x.replace(/\s+/g, ''); }).filter(Boolean);
        if (partes.length === 2) {
          var f1 = isoDe(partes[0], anio), f2 = isoDe(partes[1], anio);
          if (f1 && f2) { fecha = f1; finDelRango = f2; }
          else if (f1) fecha = f1;
          else if (f2) fecha = f2;
        }
      }
      codigos.forEach(function (cod) {
        n++;
        if (!fecha) {
          inv++;
          out.invalidos.push({ codigo: cod, hoja: hoja, fila: iH + k + 2,
            valor_de_fecha: t(fechaCruda) || '(vacío)',
            campana: iCamp >= 0 ? t(f[iCamp]) : '',
            motivo: 'su «Fecha de envío» no es una fecha ni un rango de fechas → el link no se envió, no cuenta' });
          return;
        }
        var reg = {
          codigo: cod, fecha_activacion: fecha, hoja: hoja, fila: iH + k + 2,
          fecha_fin: (iFin >= 0 && isoDe(f[iFin])) || finDelRango || null,
          campana: iCamp >= 0 ? t(f[iCamp]) : '',
          utm_term: iTerm >= 0 ? t(f[iTerm]) : '',
          utm_content: iCont >= 0 ? t(f[iCont]) : '',
          receta: iRec.map(function (ri) { return t(f[ri]); }).filter(Boolean)[0] || ''
        };
        // si el código aparece en varias hojas, manda la fecha MÁS TEMPRANA: es cuando se
        // activó. Quedarse con la última recortaría tráfico legítimo.
        //
        // 🔴 9-sep-2026 · EL RASTRO SE GUARDABA EN UNA SOLA DIRECCIÓN, y por eso el sistema no
        //    podía ni reportar que un código estuviera repetido. Cuando la entrada nueva era la
        //    más TEMPRANA, sustituía a la anterior y la fecha de esa anterior **se perdía sin
        //    dejar nota**: solo el caso contrario alimentaba `otras_fechas`. Las hojas se
        //    recorren en el orden del libro —Septiembre antes que Agosto—, así que `hTHNLqzL`
        //    (Septiembre/e-j7/04-sep y Agosto/e-j4/15-ago) guardaba primero la de Septiembre,
        //    Agosto la pisaba por ser anterior, y el conteo de códigos ambiguos daba **CERO**
        //    sobre un código que está repetido de verdad. Un guardián que no puede ver el
        //    defecto no lo reporta: da permiso.
        //    Ahora el rastro se conserva pase lo que pase. Esto NO cambia a quién se le atribuye
        //    un carrito —sigue ganando la fecha más temprana—: solo hace visible la ambigüedad.
        var y = out.links[cod];
        if (!y) {
          out.links[cod] = reg;
        } else if (reg.fecha_activacion < y.fecha_activacion) {
          reg.otras_fechas = (y.otras_fechas || []).concat([y.fecha_activacion + ' (' + y.hoja + ' · ' + (y.utm_content || '?') + ')']);
          out.links[cod] = reg;
        } else if (reg.fecha_activacion !== y.fecha_activacion) {
          (y.otras_fechas = y.otras_fechas || []).push(reg.fecha_activacion + ' (' + hoja + ' · ' + (reg.utm_content || '?') + ')');
        }
      });
    });
    out.hojas.push({ hoja: hoja, encabezado_en_fila: iH + 1, codigos: n, invalidos: inv });
  });
  return out;
}

module.exports = { leer: leer, isoDe: isoDe, codigoDe: codigoDe, codigosDe: codigosDe, t: t, nmz: nmz };
