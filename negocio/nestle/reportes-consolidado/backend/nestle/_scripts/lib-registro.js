// lib-registro · L2 — LA LIBRERÍA DEL REGISTRO DE NOMBRES.
//
// 🔴 EL CONTRATO, EN UNA FRASE: el id lógico no cambia nunca · el nombre físico puede cambiar
//    cuando quiera · esta librería es el ÚNICO lugar donde los dos se tocan.
//
// 🔴 LA REGLA QUE LA HACE ÚTIL, Y ES LA PRIMERA: **nunca resolver por adivinanza silenciosa.**
//    Si un id no resuelve, o resuelve a dos candidatos, esto TRUENA y dice cuáles son.
//    Un resolvedor que devuelve `undefined` es PEOR que no tener registro: produce el «0 y 0»
//    que el contador de resumen-regenerar reportó durante varias corridas mientras escribía 60 y 60.
//
// Uso típico en un script:
//
//    var R = require('.../lib-registro.js');
//    var h = R.abrir('resumen', encabezadosReales);     // reconcilia contra el archivo real
//    h.exigir(['resumen.tot_sends', 'resumen.campana']); // falla ANTES de tocar nada
//    var col = h.col('resumen.tot_sends');               // { nombre, i, letra }
//
var fs = require('fs'), os = require('os'), path = require('path');
// el backend es el padre de esta carpeta: así esta librería funciona desde donde esté copiada.
// La encontró la guarda 7 al aprender a leer la forma `path.join(...)`; mi barrido la había
// dejado pasar, igual que a `lib-entorno.js`.
var BACK = path.resolve(__dirname, '..');
var RUTA = path.join(BACK, '_contratos', 'registro.json');

function t(v) { return String(v == null ? '' : v).trim(); }

// 🔴 LA NORMALIZACIÓN VIVE AQUÍ Y SOLO AQUÍ. Estuvo escrita dos veces —una en el sembrador y otra
//    en la librería— y divergieron en el primer intento: el sembrador transliteraba `#` y la
//    librería lo borraba, así que `Mes (#)` acuñaba su propio id pero después resolvía al mismo
//    que `Mes`, y la librería se negaba a elegir. Tenía razón en negarse; el error era tener dos
//    copias de la regla. Es el mismo defecto que el proyecto ya documentó en los guardianes:
//    **un check que recalcula la decisión por su cuenta se desfasa en cuanto la decisión cambia.**
var SIMBOLOS = [[/#/g, ' num '], [/%/g, ' pct '], [/\$/g, ' mxn '], [/&/g, ' y '], [/\+/g, ' mas ']];
function nmz(v) {
  var n = t(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  SIMBOLOS.forEach(function (s) { n = n.replace(s[0], s[1]); });
  return n.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
/** el id que le tocaría a un nombre en un ámbito. Se usa al SEMBRAR; después el id manda. */
function idDe(ambito, nombre) { return ambito + '.' + (nmz(nombre) || 'sin_nombre'); }

function cargar() {
  if (!fs.existsSync(RUTA)) {
    throw new Error('no hay registro en ' + RUTA + '. Corre orquestador.sembrar-registro.js primero.');
  }
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}

// ── el error del registro dice SIEMPRE tres cosas: qué se pidió, qué hay, y qué hacer.
function fallo(msg, detalle) {
  var e = new Error('🔴 REGISTRO · ' + msg + (detalle ? '\n   ' + detalle : ''));
  e.registro = true;
  return e;
}

/**
 * Abre un ámbito contra los encabezados REALES del archivo que se va a tocar.
 * Devuelve un resolvedor que solo sabe de ids.
 */
function abrir(ambito, encabezados, opciones) {
  var reg = cargar(), op = opciones || {};
  if (!reg.ambitos[ambito]) {
    throw fallo('el ámbito «' + ambito + '» no existe en el registro',
      'ámbitos que sí: ' + Object.keys(reg.ambitos).join(' · '));
  }
  var delAmbito = Object.keys(reg.columnas)
    .map(function (k) { return reg.columnas[k]; })
    .filter(function (c) { return c.ambito === ambito && !c.retirado; });

  // índice de los encabezados reales, normalizados
  var real = {}, porPos = [];
  (encabezados || []).forEach(function (nom, i) {
    porPos[i] = t(nom);
    if (t(nom)) (real[nmz(nom)] = real[nmz(nom)] || []).push({ nombre: t(nom), i: i });
  });

  // resolver cada id: por su nombre actual, o por un alias histórico
  var mapa = {}, sinResolver = [], ambiguos = [], fantasmas = [];
  // 🔴 EL NOMBRE ACTUAL LE GANA AL ALIAS HISTÓRICO. Es lo que SIGNIFICA un renombre: el alias es
  //    el respaldo para cuando la columna todavía se llama como antes, no un competidor con los
  //    mismos derechos. Estaban en la misma bolsa, y bastó con que un renombre dejara viva la
  //    columna vieja —`EmailID` junto a `Email_ID (de la DE de SFMC)`— para que el id resolviera
  //    a DOS y el ciclo entero se detuviera, con las dos columnas correctas y presentes.
  //    Un registro que se atora cuando su propia historia sigue en la hoja no sirve de registro.
  //    La columna vieja NO se ignora: se declara como fantasma para que se vea y se pueda decidir.
  function busca(lista) {
    var out = [];
    (lista || []).forEach(function (n) {
      (real[nmz(n)] || []).forEach(function (r) { if (!out.some(function (x) { return x.i === r.i; })) out.push(r); });
    });
    return out;
  }
  delAmbito.forEach(function (c) {
    var porNombre = busca(c.nombres);
    var porAlias = busca(c.alias_historicos);
    var cands = porNombre.length ? porNombre : porAlias;
    if (porNombre.length === 1 && porAlias.length) {
      porAlias.forEach(function (a) {
        if (a.i !== porNombre[0].i) fantasmas.push({ id: c.id, vive: porNombre[0].nombre, fantasma: a.nombre, letra: letra(a.i) });
      });
    }
    if (cands.length === 1) { mapa[c.id] = { nombre: cands[0].nombre, i: cands[0].i, letra: letra(cands[0].i) }; return; }
    if (cands.length > 1) { ambiguos.push({ id: c.id, candidatos: cands.map(function (x) { return x.nombre + ' (col ' + letra(x.i) + ')'; }) }); return; }
    sinResolver.push(c);
  });

  // encabezados reales que ningún id reclama — la otra dirección del huérfano
  var reclamados = {};
  Object.keys(mapa).forEach(function (id) { reclamados[mapa[id].i] = 1; });
  var sinId = porPos.map(function (n, i) { return { nombre: n, i: i }; })
    .filter(function (o) { return o.nombre && !reclamados[o.i]; });

  var H = {
    ambito: ambito,
    registro: reg,
    resueltos: Object.keys(mapa).length,
    sin_resolver: sinResolver,
    ambiguos: ambiguos,
    fantasmas: fantasmas,   // columnas viejas que un renombre dejó vivas junto a la nueva
    sin_id: sinId,

    /** el nombre físico de un id, hoy. TRUENA si no resuelve. Jamás devuelve undefined. */
    col: function (id) {
      if (mapa[id]) return mapa[id];
      var c = reg.columnas[id];
      if (!c) {
        var parecidos = Object.keys(reg.columnas).filter(function (k) { return k.indexOf(ambito + '.') === 0 && k.indexOf(id.split('.').pop().slice(0, 5)) >= 0; });
        throw fallo('el id «' + id + '» no existe en el registro',
          parecidos.length ? 'parecidos: ' + parecidos.slice(0, 5).join(' · ') : 'el ámbito «' + ambito + '» tiene ' + delAmbito.length + ' ids');
      }
      // 🔴 UN MENSAJE QUE MANDA A BUSCAR AL LUGAR EQUIVOCADO ES PEOR QUE NINGUNO. Si el id existe
      //    pero es de OTRO ámbito, decirlo: «el archivo no lo trae» hace perder el tiempo mirando
      //    la hoja correcta, cuando el problema es que se preguntó por la hoja equivocada.
      if (c.ambito !== ambito) {
        throw fallo('el id «' + id + '» es del ámbito «' + c.ambito + '», no de «' + ambito + '»',
          '«' + c.ambito + '» es ' + (reg.ambitos[c.ambito] ? reg.ambitos[c.ambito].nombre_fisico : '?') +
          '. Ábrelo con R.abrir(\'' + c.ambito + '\', …) o pide el id de este ámbito.');
      }
      var amb = ambiguos.filter(function (a) { return a.id === id; })[0];
      if (amb) throw fallo('el id «' + id + '» resuelve a MÁS DE UNA columna', 'candidatos: ' + amb.candidatos.join(' · '));
      throw fallo('el id «' + id + '» no resuelve a ninguna columna del archivo',
        'el registro dice que se llama «' + c.nombres.join('» o «') + '»' +
        (c.alias_historicos && c.alias_historicos.length ? ' (antes: ' + c.alias_historicos.join(', ') + ')' : '') +
        '\n   el archivo trae: ' + porPos.filter(Boolean).slice(0, 8).join(' · ') + (porPos.length > 8 ? ' …' : ''));
    },

    /** el nombre físico, para usarlo como llave de un objeto de sheet_to_json */
    n: function (id) { return H.col(id).nombre; },

    /** varios de golpe, en orden — para construir llaves compuestas */
    llave: function (ids) { return ids.map(function (id) { return H.n(id); }); },

    /**
     * 🔴 EL MANIFIESTO (L4). Verifica TODOS los ids que un script necesita ANTES de tocar el
     *    archivo. Sin esto, un nombre cambiado se descubre a media escritura — con el archivo
     *    ya abierto y medio escrito.
     */
    exigir: function (ids, quien) {
      var faltan = [];
      ids.forEach(function (id) { try { H.col(id); } catch (e) { faltan.push({ id: id, por: e.message.split('\n')[0].replace('🔴 REGISTRO · ', '') }); } });
      if (faltan.length) {
        var m = (quien ? quien + ': ' : '') + faltan.length + ' de ' + ids.length + ' id(s) no resuelven contra «' + reg.ambitos[ambito].nombre_fisico + '».';
        faltan.forEach(function (f) { m += '\n     · ' + f.id + ' — ' + f.por; });
        m += '\n   No se toca el archivo. Corre orquestador.reconciliar.js si un nombre cambió.';
        throw fallo(m);
      }
      return true;
    }
  };
  if (op.silencioso !== true && (sinResolver.length || ambiguos.length || sinId.length)) {
    H.aviso = { sin_resolver: sinResolver.length, ambiguos: ambiguos.length, sin_id: sinId.length };
  }
  return H;
}

function letra(i) { var s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }

module.exports = { abrir: abrir, cargar: cargar, RUTA: RUTA, nmz: nmz, idDe: idDe, letra: letra };
