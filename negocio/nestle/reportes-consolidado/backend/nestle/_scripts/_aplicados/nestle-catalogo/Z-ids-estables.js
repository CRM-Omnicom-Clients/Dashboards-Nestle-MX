// IDs ESTABLES + anclas reparadas. Lo que hacía falta para que el catálogo aguante crecer.
//
// 🔴 EL PROBLEMA: los IDs se asignaban con un contador sobre el ORDEN DE APARICIÓN. Si entra
//    una pieza nueva antes en el archivo, todos los siguientes se corren y PZA-00035 deja de
//    ser la misma pieza. Todo lo que apunte a un ID quedaría mal, en silencio.
// LA SOLUCIÓN: un REGISTRO persistente llave_natural → id. Lo que ya existe conserva su id;
//    lo nuevo toma el siguiente libre. El registro es append-only: un id nunca se reutiliza.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var BACK = os.homedir() + '/.claude/reportes-backend/nestle/_catalogo';
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));

// ── 1 · la llave natural, con lo que de verdad desambigua
function llavePieza(p) {
  return [nm(p.campana), nm(p.nombre_pieza), nm(p.segmento), nm(p.email_type), nm(p.canal),
  nm(p.nombre_pieza_raw)].join('|');
}
function llaveJourney(j) { return [nm(j.campana), nm(j.objetivo), nm(j.canal), nm(j.asset_id || j.id_sfmc || '')].join('|'); }
function llaveCamp(c) { return [nm(c.bu), nm(c.marca), nm(c.campana)].join('|'); }

var choques = {};
cat.piezas.forEach(function (p) { var k = llavePieza(p); (choques[k] = choques[k] || []).push(p.pieza_id); });
var dobles = Object.keys(choques).filter(function (k) { return choques[k].length > 1; });
console.log('══ llave natural de pieza ══');
console.log('  ' + (dobles.length ? '🔴 ' + dobles.length + ' choques' : '✔ única en las ' + cat.piezas.length));
dobles.forEach(function (k) {
  console.log('     ' + choques[k].join(' ≡ ') + '   →  ' + k.slice(0, 90));
  choques[k].forEach(function (id) {
    var p = cat.piezas.filter(function (x) { return x.pieza_id === id; })[0];
    console.log('        ' + id + '  content=' + t(p.content_name).slice(-30) + '  sends=' + p.sends + '  journey=' + p.journey_id);
  });
});
// si quedan choques, el journey los separa: es lo que distingue dos envíos iguales de campañas distintas
if (dobles.length) {
  console.log('  → se agrega el journey a la llave (es lo que separa dos envíos por lo demás idénticos)');
  llavePieza = function (p) {
    return [nm(p.campana), nm(p.nombre_pieza), nm(p.segmento), nm(p.email_type), nm(p.canal),
    nm(p.nombre_pieza_raw), nm(p.journey_id)].join('|');
  };
  var c2 = {}; cat.piezas.forEach(function (p) { var k = llavePieza(p); (c2[k] = c2[k] || []).push(p.pieza_id); });
  var d2 = Object.keys(c2).filter(function (k) { return c2[k].length > 1; });
  console.log('  ' + (d2.length ? '🔴 siguen ' + d2.length : '✔ ahora única'));
}

// ── 2 · registro persistente de IDs
var REG = { piezas: {}, journeys: {}, campanas: {} };
try { REG = JSON.parse(fs.readFileSync(BACK + '/registro-ids.json', 'utf8')); } catch (e) { }
function asigna(tipo, pref, llave, idActual) {
  if (REG[tipo][llave]) return REG[tipo][llave];
  // primera vez: se respeta el id que ya tiene, para no mover lo existente
  var usados = {}; Object.keys(REG[tipo]).forEach(function (k) { usados[REG[tipo][k]] = 1; });
  var id = idActual && !usados[idActual] ? idActual : null;
  if (!id) { var n = 1; while (usados[pref + String(n).padStart(5, '0')]) n++; id = pref + String(n).padStart(5, '0'); }
  REG[tipo][llave] = id; return id;
}
cat.campanas.forEach(function (c) { c.camp_id = asigna('campanas', 'CMP-', llaveCamp(c), c.camp_id); });
var mapC = {}; cat.campanas.forEach(function (c) { mapC[llaveCamp(c)] = c.camp_id; });
cat.journeys.forEach(function (j) { j.journey_id_nuevo = asigna('journeys', 'JRN-', llaveJourney(j), j.journey_id); });
var mapJ = {}; cat.journeys.forEach(function (j) { mapJ[j.journey_id] = j.journey_id_nuevo; });
cat.journeys.forEach(function (j) { j.journey_id = j.journey_id_nuevo; delete j.journey_id_nuevo; });
cat.piezas.forEach(function (p) {
  p.journey_id = mapJ[p.journey_id] || p.journey_id;
  p.pieza_id = asigna('piezas', 'PZA-', llavePieza(p), p.pieza_id);
});
fs.writeFileSync(BACK + '/registro-ids.json', JSON.stringify(REG, null, 1));
console.log('\n══ registro de IDs ══');
console.log('  piezas ' + Object.keys(REG.piezas).length + ' · journeys ' + Object.keys(REG.journeys).length + ' · campañas ' + Object.keys(REG.campanas).length);
console.log('  → ' + BACK + '/registro-ids.json');

// ── 3 · alias que dependen del segmento (el caso "N/A" de AON)
var porRaw = {};
cat.piezas.forEach(function (p) {
  var raw = t(p.nombre_pieza_raw).split(' · ')[0];
  if (!raw || raw === p.nombre_pieza) return;
  var k = p.campana + '¦' + nm(raw);
  (porRaw[k] = porRaw[k] || {})[p.nombre_pieza] = 1;
});
var ambiguos = Object.keys(porRaw).filter(function (k) { return Object.keys(porRaw[k]).length > 1; });
console.log('\n══ alias que una sola entrada no puede representar ══');
ambiguos.forEach(function (k) { console.log('  ' + k.replace('¦', ' » ') + ' → {' + Object.keys(porRaw[k]).join(', ') + '}  necesita el SEGMENTO'); });
// se reescriben esos alias con el segmento en el contexto
cat.aliasUTM = (cat.aliasUTM || []).filter(function (r) {
  return !(r.Dimension === 'Touchpoint' && ambiguos.indexOf(r.Contexto + '¦' + nm(r.Valor_Crudo)) >= 0);
});
var puestos = 0;
cat.piezas.forEach(function (p) {
  var raw = t(p.nombre_pieza_raw).split(' · ')[0];
  if (!raw || raw === p.nombre_pieza) return;
  if (ambiguos.indexOf(p.campana + '¦' + nm(raw)) < 0) return;
  var ya = cat.aliasUTM.some(function (r) { return r.Dimension === 'Touchpoint' && r.Valor_Crudo === raw && r.Contexto === p.campana + ' · ' + p.segmento; });
  if (ya) return;
  cat.aliasUTM.push({ Tipo: 'alias_utm', Dimension: 'Touchpoint', Valor_Crudo: raw, Valor_Canonico: p.nombre_pieza, Contexto: p.campana + ' · ' + p.segmento, Fuente: 'depende del segmento' });
  puestos++;
});
console.log('  alias reescritos con segmento: ' + puestos);

// ── 4 · vocabularios al día (WA-1 / WA-2 quedaron fuera al renombrar)
var vt = {}; cat.piezas.forEach(function (p) { vt[p.nombre_pieza] = 1; });
var faltaban = Object.keys(vt).filter(function (x) { return cat.VOC.touchpoint.indexOf(x) < 0; });
cat.VOC.touchpoint = Object.keys(vt).sort();
var vs = {}; cat.piezas.forEach(function (p) { vs[p.segmento] = 1; });
cat.VOC.segmento.forEach(function (s) { vs[s] = 1; });
cat.VOC.segmento = Object.keys(vs).sort();
console.log('\n══ vocabularios ══');
console.log('  touchpoint: ' + cat.VOC.touchpoint.length + (faltaban.length ? '  (faltaban: ' + faltaban.join(', ') + ')' : ''));
console.log('  segmento  : ' + cat.VOC.segmento.length);

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado');
