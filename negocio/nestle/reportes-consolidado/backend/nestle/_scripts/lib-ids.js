// ÚNICA fuente de asignación de IDs del catálogo Nestlé.
// Cualquier script que cree piezas, journeys o campañas usa ESTO — no su propia copia.
//
// ESQUEMA (decidido por Rick, 17-ago-2026):
//   campaña   CMP-001
//   journey   001-J001      ← 001 = número de la campaña
//   pieza     001-P001      ← 001 = número de la campaña
//
// LA PROPIEDAD QUE DA: el correlativo vive DENTRO de la campaña. Una campaña nueva, o 30
// piezas nuevas de AON, no mueven ni un id de Mundial. Con el contador global anterior
// (PZA-00001…) cualquier alta empujaba a todos los siguientes.
//
// 🔴 El registro es APPEND-ONLY: una llave que ya tiene id conserva ese id para siempre, y un
//    id liberado NUNCA se reutiliza. Si esto se rompe, dos cosas distintas comparten ancla.
var fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..') + '/_catalogo';
var RUTA = BACK + '/registro-ids.json';

var t = function (v) { return String(v == null ? '' : v).trim(); };
// 🔴 UN SOLO NORMALIZADOR. Esta función estaba copiada literal en varias librerías. Copias
//    idénticas hoy son copias divergentes mañana: la de WhatsApp ya se había separado y
//    difería en 10 de 14 casos. Se delega en `lib-alias.nm`, que es el oficial.
var nm = require(__dirname + '/lib-alias.js').nm;
var d3 = function (n) { return String(n).padStart(3, '0'); };

// ── llaves naturales · lo que hace que dos filas sean la MISMA cosa
function llaveCamp(c) { return [nm(c.bu), nm(c.marca), nm(c.campana)].join('|'); }
function llaveJourney(j) { return [nm(j.campana), nm(j.objetivo), nm(j.canal), nm(j.asset_id || j.id_sfmc || '')].join('|'); }
function llavePieza(p) {
  // nombre_pieza_raw entra a propósito: lleva la fecha de los envíos de WhatsApp sin utm_content,
  // que sin ella colapsaban dos envíos distintos en una sola pieza.
  return [nm(p.campana), nm(p.nombre_pieza), nm(p.segmento), nm(p.email_type), nm(p.canal), nm(p.nombre_pieza_raw)].join('|');
}

function cargar() {
  try { return JSON.parse(fs.readFileSync(RUTA, 'utf8')); }
  catch (e) { return { piezas: {}, journeys: {}, campanas: {} }; }
}
function guardar(REG) { fs.writeFileSync(RUTA, JSON.stringify(REG, null, 1)); }

function usados(REG, tipo) {
  var u = {}; Object.keys(REG[tipo] || {}).forEach(function (k) { u[REG[tipo][k]] = 1; }); return u;
}

// ── campaña: CMP-###, correlativo global (son pocas y no dependen de nadie)
function idCampana(REG, camp) {
  var k = llaveCamp(camp);
  if (REG.campanas[k]) return REG.campanas[k];
  var u = usados(REG, 'campanas'), n = 1;
  while (u['CMP-' + d3(n)]) n++;
  REG.campanas[k] = 'CMP-' + d3(n);          // reservado de inmediato: dos altas seguidas no chocan
  return REG.campanas[k];
}

// ── ancla de una campaña, a partir de su camp_id
function ancla(campId) {
  var m = t(campId).match(/(\d{1,3})\s*$/);
  return m ? d3(Number(m[1])) : null;
}

// ── journey / pieza: ###-J### · ###-P###, correlativo DENTRO de la campaña
// 🔴 UN ID «LIBRE» EN EL REGISTRO PUEDE ESTAR OCUPADO EN EL CATÁLOGO (3-sep-2026).
//    El registro conocía 96 piezas y el catálogo tiene 136: cuarenta ids existían en el libro y
//    aquí no. `idPieza` para Liga MX devolvía `005-P005`, ocupado desde hace semanas por
//    E-J4 · Usuarios CON región. El registro no es la autoridad — el catálogo lo es; el registro
//    solo evita repetir. Así que quien pida un id puede pasar los YA OCUPADOS de verdad y esta
//    función los respeta. Sin eso, el camino sancionado por el skill entrega una colisión.
//    ⚠ Se desfasó porque varias altas escribieron la fila directo al Excel sin pasar por aquí.
//      El atajo funcionó cada vez —el id que se elegía a ojo estaba libre en el libro— y el
//      registro nunca se enteró. Un atajo que funciona no deja de ser deuda.
function idHijo(REG, tipo, letra, obj, campId, ocupadosExtra) {
  var a = ancla(campId);
  if (!a) throw new Error('no puedo anclar ' + tipo + ' sin camp_id válido (recibí "' + campId + '")');
  var k = (tipo === 'piezas' ? llavePieza : llaveJourney)(obj);
  if (REG[tipo][k]) return REG[tipo][k];
  var u = usados(REG, tipo), n = 1;
  (ocupadosExtra || []).forEach(function (id) { u[String(id).trim()] = 1; });
  while (u[a + '-' + letra + d3(n)]) n++;
  REG[tipo][k] = a + '-' + letra + d3(n);
  return REG[tipo][k];
}

module.exports = {
  RUTA: RUTA, cargar: cargar, guardar: guardar, ancla: ancla,
  llaveCamp: llaveCamp, llaveJourney: llaveJourney, llavePieza: llavePieza,
  idCampana: idCampana,
  idJourney: function (REG, j, campId, ocupados) { return idHijo(REG, 'journeys', 'J', j, campId, ocupados); },
  idPieza: function (REG, p, campId, ocupados) { return idHijo(REG, 'piezas', 'P', p, campId, ocupados); },
  RE_PIEZA: /^\d{3}-P\d{3}$/, RE_JOURNEY: /^\d{3}-J\d{3}$/, RE_CAMPANA: /^CMP-\d{3}$/
};
