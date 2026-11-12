// lib-qcart-filtro.js — QUÉ ES NUESTRO y DESDE CUÁNDO cuenta.
//
// Las dos reglas de Rick (19-ago-2026), en el orden en que se aplican:
//
//   1 · PERTENENCIA  el shortlink tiene que estar en NUESTRO catálogo de links.
//                    Los 2 archivos traen tráfico de toda la cuenta, no solo nuestro.
//   2 · VENTANA      y solo cuenta desde la FECHA DE ACTIVACIÓN de ESE link en adelante.
//                    Antes de esa fecha es prueba o de otra campaña: contarlo infla.
//
// 🔴 La unidad de las dos reglas es el LINK, no la pieza. Una pieza puede tener dos envíos
//    con links distintos (001-P001 manda en marzo y abril y su único código es el de abril):
//    una sola fecha para toda la pieza recortaría el tráfico del otro envío.
//
// Nada se descarta en silencio: cada evento que queda fuera sale con su motivo y su cifra.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');

function t(v) { return String(v == null ? '' : v).trim(); }

// 🔴 EL CONTRATO DE EXCLUSIONES, LEÍDO UNA VEZ — ver la nota del peldaño 0b.
//    Si el archivo no está o no se puede leer, EXCLUIDOS queda vacío y el filtro sigue
//    funcionando: prefiero que entre tráfico que Rick excluyó —y que el purgador saca después con
//    su motivo— a que el bloque entero se caiga por un contrato ausente.
var EXCLUIDOS = (function () {
  try {
    var X = JSON.parse(fs.readFileSync(BACK + '/_contratos/exclusiones.json', 'utf8'));
    var m = {};
    ((X.por_dimension || {})['Link Qcart'] || []).forEach(function (x) {
      if (t(x.valor)) m[t(x.valor)] = t(x.motivo) || 'declarado sin motivo';
    });
    return m;
  } catch (e) { return {}; }
})();

/** Carga el padrón de links: qué códigos son nuestros, desde cuándo, y de qué pieza. */
function padron() {
  var A = JSON.parse(fs.readFileSync(BACK + '/_catalogo/activacion-qcart.json', 'utf8'));
  var P = {};
  // los válidos: entran, con su fecha
  Object.keys(A.links_validos).forEach(function (c) {
    var l = A.links_validos[c];
    P[c] = { codigo: c, activacion: l.fecha_activacion, campana: l.campana, hoja: l.hoja,
      receta: l.receta, valido: true,
      // 🔴 una fecha que contradice a su hoja es un dato malo. Se marca para que el filtro
      //    NO recorte tráfico por culpa de un typo (lechera-junio con 2027 borraría el 100%).
      fecha_sospechosa: Math.abs(l.meses_vs_hoja == null ? 0 : l.meses_vs_hoja) >= 3 };
  });
  // los inválidos: NO entran, pero se declaran para poder contar lo que se dejó fuera
  A.links_invalidos.forEach(function (x) {
    if (P[x.codigo]) return;                       // si también aparece válido, gana el válido
    P[x.codigo] = { codigo: x.codigo, activacion: null, campana: x.campana, hoja: x.hoja,
      valido: false, motivo: x.motivo, valor_de_fecha: x.valor_de_fecha };
  });
  // el mapa código → pieza, que es el ancla al catálogo
  var pieza = {};
  Object.keys(A.activacion_por_pieza).forEach(function (id) { pieza[id] = A.activacion_por_pieza[id]; });
  return { links: P, por_pieza: pieza, codigo_a_pieza: A.mapeo && A.mapeo.codigo_a_pieza || null, fuente: A.autoridad.archivo };
}

/**
 * Aplica las dos reglas a un lote de eventos.
 * Devuelve { dentro, fuera, resumen } — y `dentro + fuera === eventos.length`, siempre.
 */
function aplicar(eventos, pad, codPieza) {
  var dentro = [], fuera = [];
  // 🔴 LA AUDITORÍA CUENTA EN LAS DOS UNIDADES (29-sep-2026). Los contadores de arriba son de
  //    FILAS y su 'cuadra' también — eso está bien, describen a dónde fue cada fila del CSV. Pero
  //    la MÉTRICA que sale de aquí son VISTAS: 3,077 filas del bloque son 7,503 carritos, porque
  //    cada fila es un bucket día × hora × shortlink × utm × tienda con su contador 'views' (444
  //    de ellas con views = 0). Reportar 'dentro: 671' junto a un total de 7,503 invita a creer
  //    que son 671 carritos, y esa confusión de unidad es exactamente la que costó el reporte de
  //    septiembre. Ahora cada destino dice cuántas filas Y cuántas vistas, y las dos sumas cuadran
  //    por separado. De paso queda visible el peso real de 'fuera_sin_codigo', que en filas parece
  //    un cajón de descartes y trae carritos nuestros con su utm correcto.
  var vis = { total: 0, dentro: 0, fuera_sin_codigo: 0, fuera_no_es_nuestro: 0,
    fuera_link_invalido: 0, fuera_antes_de_activacion: 0, fuera_excluido: 0, dentro_con_fecha_sospechosa: 0 };
  var nviews = function (e) { var v = Number(e && e.views); return isFinite(v) && v > 0 ? v : 0; };
  var res = { total: eventos.length, dentro: 0,
    fuera_sin_codigo: 0, fuera_no_es_nuestro: 0, fuera_link_invalido: 0, fuera_antes_de_activacion: 0,
    dentro_con_fecha_sospechosa: 0 };

  eventos.forEach(function (e) {
    // 0 · sin código no hay forma de saber si es nuestro
    if (!t(e.shortlink_code)) {
      res.fuera_sin_codigo++; vis.fuera_sin_codigo += nviews(e);
      fuera.push(Object.assign({}, e, { motivo_exclusion: 'sin shortlink code: no se puede saber si es nuestro' }));
      return;
    }
    // 🔴 0b · LO QUE RICK YA DECLARÓ QUE NO CUENTA (15-sep-2026). `_contratos/exclusiones.json`
    //    lleva desde agosto una lista de shortlinks con su motivo escrito —«el envío NO se
    //    realizó», «el maestro marca No enviado», «hoja Reagendar»— y **ningún script la leía**.
    //    Era una lista de decisiones que no decidían nada, y se notó por el peor camino:
    //    `CVCPHfND` y `piPZpvXp` estaban declarados ahí desde el 9-sep y aun así sus 7 eventos
    //    entraron al bloque y colgaron de una pieza. La nota de esa exclusión decía «el filtro de
    //    activación ya los descartaba» — dejó de ser cierto en cuanto llegó tráfico posterior.
    //    Va ANTES de la pertenencia a propósito: un link puede estar perfectamente en el maestro
    //    y aun así no contar, porque el correo que debía mandarlo nunca salió. Que esté en el
    //    padrón no es permiso; que Rick no lo haya excluido, sí.
    if (EXCLUIDOS[t(e.shortlink_code)]) {
      res.fuera_excluido = (res.fuera_excluido || 0) + 1; vis.fuera_excluido += nviews(e);
      fuera.push(Object.assign({}, e, {
        motivo_exclusion: 'shortlink DECLARADO fuera en _contratos/exclusiones.json: ' +
          String(EXCLUIDOS[t(e.shortlink_code)]).slice(0, 140)
      }));
      return;
    }

    var l = pad.links[e.shortlink_code];

    // 1 · PERTENENCIA — ¿el link es nuestro?
    if (!l) {
      res.fuera_no_es_nuestro++; vis.fuera_no_es_nuestro += nviews(e);
      fuera.push(Object.assign({}, e, { motivo_exclusion: 'el shortlink no está en nuestro catálogo de links' }));
      return;
    }
    // 🔴 REVERTIDO (A1, 21-ago). Había metido los links que dicen «No seleccionado» apoyándome en
    //    que tenían tráfico de `crm-hive`: razoné que un carrito no puede venir de un link que
    //    nunca salió, así que el tráfico probaba el envío.
    //
    //    **La regla de Rick es otra, y es la que manda:** todo link *con link y con fecha* en
    //    `Qcart-Links` debe atribuirse a una pieza; el que **no tiene fecha de salida**, o no está
    //    en las hojas de mes, **no es nuestro o todavía no cuenta**. No es una duda que el tráfico
    //    resuelva: es una decisión de negocio sobre qué se reporta y cuándo.
    //
    //    Mi razonamiento no era absurdo, y por eso es peligroso: sonaba a «lo observado le gana a
    //    lo escrito» cuando en realidad era **sustituir el criterio del dueño del dato por el mío**.
    //    Esa regla sirve para corregir un dato mal medido, no para decidir qué entra al reporte.
    //    El hueco de captura se arregla en `Qcart-Links`, que es donde nace.
    var rescatado = false;
    if (!l.valido) {
      res.fuera_link_invalido++; vis.fuera_link_invalido += nviews(e);
      fuera.push(Object.assign({}, e, {
        motivo_exclusion: 'el link no se envió: su fecha dice «' + l.valor_de_fecha + '»',
        link_campana: l.campana, link_hoja: l.hoja
      }));
      return;
    }

    // 2 · VENTANA — ¿el evento ocurrió desde su activación?
    // ⚠ si la fecha del link es sospechosa (contradice a su propia hoja), NO se recorta: se
    //   deja pasar y se marca. Recortar por un typo borra tráfico bueno y el total se ve normal.
    if (!rescatado && !l.fecha_sospechosa && e.fecha && e.fecha < l.activacion) {
      res.fuera_antes_de_activacion++; vis.fuera_antes_de_activacion += nviews(e);
      fuera.push(Object.assign({}, e, {
        motivo_exclusion: 'anterior a la activación del link (' + l.activacion + ')',
        activacion: l.activacion, dias_antes: Math.round((new Date(l.activacion) - new Date(e.fecha)) / 86400000)
      }));
      return;
    }

    if (l.fecha_sospechosa) { res.dentro_con_fecha_sospechosa++; vis.dentro_con_fecha_sospechosa += nviews(e); }
    res.dentro++; vis.dentro += nviews(e);
    dentro.push(Object.assign({}, e, {
      pieza_id: codPieza[e.shortlink_code] || null,
      // 🔴 UN DATO SIN ANCLA TIENE QUE TRAER SU MOTIVO. El evento es NUESTRO -el padron de links lo
      //    dice- pero ninguna pieza del catalogo reclama su codigo: el envio existe y la pieza no.
      //    Sin este motivo la Puerta 1 lo cuenta como huerfano mudo y cierra, con razon.
      motivo_sin_pieza: codPieza[e.shortlink_code] ? undefined
        : 'el link es nuestro (padron: ' + (l.campana || '?') + ') pero ninguna pieza del catalogo declara su codigo ' + e.shortlink_code,
      activacion_link: l.activacion,
      link_campana: l.campana,
      activacion_desconocida: rescatado || undefined,
      aviso: rescatado ? 'el link decia «no se envio» en Qcart-Links pero tiene trafico de crm-hive: entra sin ventana, y se declara'
        : (l.fecha_sospechosa ? 'la fecha de activación del link contradice a su hoja: no se aplicó la ventana' : null)
    }));
  });

  // 🔴 EL CUADRE TIENE QUE CONTAR **TODOS** LOS DESTINOS, y por eso se rompió al añadir el
  //    peldaño 0b: el bucket nuevo `fuera_excluido` no estaba en esta suma, así que 2 carritos y
  //    5 productos desaparecían de la cuenta y el filtro se declaraba roto — con razón. Es la
  //    versión buena del defecto: una suma de control que no conoce un destino nuevo GRITA, en
  //    vez de dejar pasar el hueco en silencio. Cada vez que se agregue un motivo de salida hay
  //    que sumarlo aquí, y si alguien lo olvida, esta línea lo dice en la primera corrida.
  res.fuera_excluido = res.fuera_excluido || 0;
  res.cuadra = (res.dentro + res.fuera_sin_codigo + res.fuera_no_es_nuestro +
    res.fuera_link_invalido + res.fuera_antes_de_activacion + res.fuera_excluido) === res.total;

  // el total en vistas se CUENTA de los eventos, no se deduce: si un motivo de salida nuevo olvida
  // su gemelo en vistas, esta resta lo grita igual que la de filas.
  vis.total = eventos.reduce(function (s, e) { return s + nviews(e); }, 0);
  vis.cuadra = (vis.dentro + vis.fuera_sin_codigo + vis.fuera_no_es_nuestro +
    vis.fuera_link_invalido + vis.fuera_antes_de_activacion + vis.fuera_excluido) === vis.total;
  res.vistas = vis;
  return { dentro: dentro, fuera: fuera, resumen: res };
}

module.exports = { padron: padron, aplicar: aplicar, t: t };
