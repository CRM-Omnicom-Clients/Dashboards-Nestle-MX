// RESOLUCIÓN DE CONFLICTOS ENTRE FUENTES — lo que le faltaba al sistema.
//
// 🔴 EL HUECO QUE CIERRA (Rick, 17-ago): "¿qué necesitas para que tus reglas lo resuelvan?"
//    Una grafía resuelta UNA vez nunca se vuelve a preguntar: queda en Catalogo_Referencias.
//    **No existía el equivalente para un conflicto entre fuentes.** Yo escalaba, y la
//    escalación moría ahí: la sesión siguiente volvía a preguntar lo mismo.
//
// UN CONFLICTO NO ES UNA COSA, SON CUATRO — y solo la última llega a Rick:
//
//   1. CAMBIO EN EL TIEMPO   el valor cambió en la fuente entre dos cortes.
//                            Se comprueba mirando los exports ANTERIORES: si el valor que
//                            tengo aparece en uno viejo, la fuente cambió → se historiza,
//                            no es conflicto.
//   2. PRECEDENCIA           hay una autoridad declarada para ESE CAMPO → gana ella.
//   3. PROCEDENCIA           un valor cita su fuente y el otro no → gana el que la cita.
//                            Un dato sin procedencia no puede ganarle a uno que sí la tiene.
//   4. GENUINO               ninguna regla aplica → escala UNA vez, y la decisión queda
//                            grabada en conflictos.json para siempre.
//
// Lo que hace que esto funcione: **todo valor lleva de dónde salió**. Sin procedencia,
// el caso 3 es indistinguible del 4 y todo termina en la mesa de Rick.
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..') + '/_catalogo';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var K = function (s) { return t(s).toUpperCase(); };

function cargar(f, vacio) {
  try { return JSON.parse(fs.readFileSync(BACK + '/' + f, 'utf8')); } catch (e) { return vacio; }
}
function guardar(f, o) { fs.writeFileSync(BACK + '/' + f, JSON.stringify(o, null, 1)); }

/** Autoridad declarada por CAMPO. Se lee; no se adivina. */
function autoridades() { return cargar('autoridad-campos.json', { campos: {} }); }
/** Decisiones ya tomadas. APPEND-ONLY: una decisión no se borra ni se re-pregunta. */
function resueltos() { return cargar('conflictos.json', { version: 1, decisiones: {} }); }

function llaveConflicto(campo, a, b) {
  return campo + '¦' + [K(a), K(b)].sort().join('¦');   // simétrica: el orden no importa
}

/**
 * resolver({campo, valorA, fuenteA, valorB, fuenteB, historia})
 *   historia = [valores que el campo tuvo en cortes ANTERIORES] (opcional pero es lo que
 *              distingue "la fuente cambió" de "alguien metió un dato raro")
 * → { valor, regla, detalle, escala:boolean }
 */
function resolver(o) {
  var AUT = autoridades(), RES = resueltos();
  var lk = llaveConflicto(o.campo, o.valorA, o.valorB);

  // 0 · ¿ya se decidió esto alguna vez? Entonces no se vuelve a preguntar. NUNCA.
  if (RES.decisiones[lk]) {
    var d = RES.decisiones[lk];
    return { valor: d.gana, regla: '0 · decidido antes', detalle: d.motivo + '  (' + d.cuando + ')', escala: false };
  }

  // 1 · ¿el valor que tengo aparece en un corte anterior? Entonces la FUENTE CAMBIÓ.
  //     No es un conflicto: es historia. Se toma el nuevo y se conserva el viejo con su fecha.
  if (o.historia && o.historia.some(function (h) { return K(h) === K(o.valorA); })) {
    return {
      valor: o.valorB, regla: '1 · cambio en el tiempo',
      detalle: 'el valor cargado aparece en un export anterior → la fuente lo cambió; se historiza, no se escala',
      escala: false, historizar: { anterior: o.valorA, vigente: o.valorB }
    };
  }

  // 2 · ¿hay autoridad declarada para este campo?
  var a = AUT.campos[o.campo];
  if (a && a.autoridad) {
    if (t(o.fuenteB).indexOf(a.autoridad) >= 0) return { valor: o.valorB, regla: '2 · precedencia', detalle: a.autoridad + ' manda en ' + o.campo + ' · ' + a.porque, escala: false };
    if (t(o.fuenteA).indexOf(a.autoridad) >= 0) return { valor: o.valorA, regla: '2 · precedencia', detalle: a.autoridad + ' manda en ' + o.campo + ' · ' + a.porque, escala: false };
  }

  // 3 · procedencia: gana el que cita su fuente. Un dato sin origen no le gana a uno con origen.
  var pa = /desconocid|sin procedencia|^$/i.test(t(o.fuenteA)) ? 0 : 1;
  var pb = /desconocid|sin procedencia|^$/i.test(t(o.fuenteB)) ? 0 : 1;
  if (pa !== pb) {
    return {
      valor: pb > pa ? o.valorB : o.valorA, regla: '3 · procedencia',
      detalle: 'gana el valor que declara su fuente (' + (pb > pa ? o.fuenteB : o.fuenteA) + '); el otro no la tiene',
      escala: false
    };
  }

  // 4 · genuino: escala UNA vez, con todo el contexto para que se decida sin investigar.
  return {
    valor: o.valorA, regla: '4 · sin regla · ESCALA',
    detalle: 'ninguna regla aplica. Se conserva el cargado hasta que se decida.',
    escala: true, paraDecidir: { campo: o.campo, llave: lk, opciones: [{ valor: o.valorA, fuente: o.fuenteA }, { valor: o.valorB, fuente: o.fuenteB }] }
  };
}

/** Graba una decisión humana. A partir de aquí ese conflicto NO se vuelve a preguntar. */
function decidir(campo, valorA, valorB, gana, motivo, quien) {
  var RES = resueltos();
  var lk = llaveConflicto(campo, valorA, valorB);
  if (RES.decisiones[lk]) return RES.decisiones[lk];      // append-only: no se pisa
  RES.decisiones[lk] = { campo: campo, gana: gana, pierde: K(gana) === K(valorA) ? valorB : valorA, motivo: motivo, quien: quien || 'Rick', cuando: 'declarado' };
  guardar('conflictos.json', RES);
  return RES.decisiones[lk];
}

module.exports = { resolver: resolver, decidir: decidir, autoridades: autoridades, resueltos: resueltos, llaveConflicto: llaveConflicto };
