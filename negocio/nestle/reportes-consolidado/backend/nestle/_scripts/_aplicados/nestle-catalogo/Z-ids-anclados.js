// IDs ANCLADOS A LA CAMPAÑA (propuesta de Rick, 17-ago).
//
//   camp_id     CMP-001
//   journey_id  001-J001     ← campaña + J + correlativo DENTRO de esa campaña
//   pieza_id    001-P001     ← campaña + P + correlativo DENTRO de esa campaña
//
// POR QUÉ ES MEJOR que el contador global (PZA-00001…):
//   1. El id DICE de qué campaña es. Al leerlo ya sabes dónde vive.
//   2. El correlativo vive DENTRO de la campaña → una campaña nueva jamás toca los números
//      de otra. Antes, cualquier pieza nueva empujaba el contador global.
//   3. Cada campaña tiene su propio espacio: 999 piezas. AON va en 28.
//
// 🔴 UNA DECISIÓN QUE TOMÉ DISTINTO A TU EJEMPLO, y la razón:
//    No metí el touchpoint dentro del id (tu "035-00P1" podía leerse así). Si el id fuera
//    035-EP1-01 y la pieza se renombra —como pasó con WA-P1 → WA-1 esta misma sesión— el id
//    cambiaría, y un id que cambia deja de servir como ancla. El touchpoint ya está en su
//    columna; el id solo tiene que ser estable y decir a qué campaña pertenece.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var BACK = os.homedir() + '/.claude/reportes-backend/nestle/_catalogo';
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var d3 = function (n) { return String(n).padStart(3, '0'); };

// ── llaves naturales (idénticas a las que ya validamos: son lo que identifica la fila)
function llaveCamp(c) { return [nm(c.bu), nm(c.marca), nm(c.campana)].join('|'); }
function llaveJourney(j) { return [nm(j.campana), nm(j.objetivo), nm(j.canal), nm(j.asset_id || j.id_sfmc || '')].join('|'); }
function llavePieza(p) {
  return [nm(p.campana), nm(p.nombre_pieza), nm(p.segmento), nm(p.email_type), nm(p.canal), nm(p.nombre_pieza_raw)].join('|');
}

// ── 1 · campañas: CMP-001, respetando el número que ya tenían
var ordC = cat.campanas.slice().sort(function (a, b) { return t(a.camp_id).localeCompare(t(b.camp_id)); });
var anclaDe = {};                                   // campaña → "001"
ordC.forEach(function (c, i) {
  var n = (t(c.camp_id).match(/(\d+)\s*$/) || [])[1];
  var ancla = d3(n ? Number(n) : i + 1);
  c.camp_id_anterior = c.camp_id;
  c.camp_id = 'CMP-' + ancla;
  anclaDe[c.campana] = ancla;
});

// ── 2 · correlativo DENTRO de la campaña, en el orden que ya tenían (nada se reordena)
function reasigna(coll, letra, campoId) {
  var cont = {}, mapa = {};
  coll.slice().sort(function (a, b) { return t(a[campoId]).localeCompare(t(b[campoId])); })
    .forEach(function (x) {
      var ancla = anclaDe[x.campana];
      if (!ancla) { mapa[x[campoId]] = x[campoId]; return; }   // sin campaña conocida: se deja como está y se reporta
      cont[ancla] = (cont[ancla] || 0) + 1;
      var nuevo = ancla + '-' + letra + d3(cont[ancla]);
      mapa[x[campoId]] = nuevo;
      x[campoId + '_anterior'] = x[campoId];
      x[campoId] = nuevo;
    });
  return mapa;
}
var mapJ = reasigna(cat.journeys, 'J', 'journey_id');
cat.piezas.forEach(function (p) { p.journey_id = mapJ[p.journey_id] || p.journey_id; });
reasigna(cat.piezas, 'P', 'pieza_id');

var huerfanas = cat.piezas.filter(function (p) { return !/^\d{3}-P\d{3}$/.test(p.pieza_id); });
var huerfanasJ = cat.journeys.filter(function (j) { return !/^\d{3}-J\d{3}$/.test(j.journey_id); });

// ── 3 · registro persistente, ya con el esquema nuevo
var REG = { piezas: {}, journeys: {}, campanas: {} };
cat.campanas.forEach(function (c) { REG.campanas[llaveCamp(c)] = c.camp_id; });
cat.journeys.forEach(function (j) { REG.journeys[llaveJourney(j)] = j.journey_id; });
cat.piezas.forEach(function (p) { REG.piezas[llavePieza(p)] = p.pieza_id; });
REG._esquema = {
  campana: 'CMP-###',
  journey: '###-J###   (### = número de la campaña)',
  pieza: '###-P###   (### = número de la campaña)',
  regla: 'el correlativo es DENTRO de la campaña; una campaña nueva no mueve los números de otra',
  cambiado: '2026-08-17 · antes era contador global PZA-00001 / JRN-00001'
};
fs.writeFileSync(BACK + '/registro-ids.json', JSON.stringify(REG, null, 1));

// ── 4 · reporte
console.log('══ IDs ANCLADOS A LA CAMPAÑA ══');
console.log('  esquema:  CMP-001  ·  001-J001  ·  001-P001\n');
cat.campanas.forEach(function (c) {
  var ps = cat.piezas.filter(function (p) { return p.campana === c.campana; });
  var js = cat.journeys.filter(function (j) { return j.campana === c.campana; });
  console.log('  ' + c.camp_id + '  ' + c.campana.padEnd(18) +
    String(ps.length).padStart(2) + ' piezas  ' + (ps.length ? ps[0].pieza_id + '…' + ps[ps.length - 1].pieza_id : '—').padEnd(20) +
    String(js.length).padStart(2) + ' journeys ' + (js.length ? js[0].journey_id + '…' + js[js.length - 1].journey_id : '—'));
});
console.log('\n  ejemplo de traza (una pieza cualquiera):');
var ej = cat.piezas[40];
console.log('    ' + ej.pieza_id_anterior + '  →  ' + ej.pieza_id + '   ' + ej.campana + ' / ' + ej.nombre_pieza + ' / ' + ej.segmento);
console.log('\n  ' + (huerfanas.length || huerfanasJ.length
  ? '🔴 sin ancla de campaña: ' + huerfanas.length + ' piezas · ' + huerfanasJ.length + ' journeys'
  : '✔ las ' + cat.piezas.length + ' piezas y los ' + cat.journeys.length + ' journeys quedaron anclados'));
console.log('  ✔ el id anterior se conserva en pieza_id_anterior / journey_id_anterior (traza del cambio)');

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
