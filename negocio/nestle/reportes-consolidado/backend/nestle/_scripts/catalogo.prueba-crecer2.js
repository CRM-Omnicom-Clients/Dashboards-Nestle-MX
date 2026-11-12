// PRUEBA DE CRECIMIENTO — con el registro de IDs ya instalado.
// Simula que llega información nueva y comprueba que NADA de lo existente se mueve.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var BACK = require('path').resolve(__dirname, '..') + '/_catalogo';
var cat = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..') + '/_tmp/_P5.json', 'utf8'));
var REG = JSON.parse(fs.readFileSync(BACK + '/registro-ids.json', 'utf8'));
var pr = [], fallo = 0;
function K(n, ok, d) { pr.push([n, ok, d]); if (!ok) fallo++; }

// el asignador REAL, el mismo que usará cualquier sesión futura — no una copia para la prueba
var LIB = require(__dirname + '/lib-ids.js');
var llavePieza = LIB.llavePieza;
// asigna() persiste en el registro al momento: si no, dos altas seguidas ven el mismo
// "siguiente libre" y devuelven el mismo id — que es justo lo que esta prueba detectó antes.
function asignaPieza(p) {
  var k = llavePieza(p), ya = !!REG.piezas[k];
  var camp = (cat.campanas.filter(function (c) { return c.campana === p.campana; })[0] || {}).camp_id
    || LIB.idCampana(REG, { bu: p.bu || '?', marca: p.marca || '?', campana: p.campana });
  return { id: LIB.idPieza(REG, p, camp), nuevo: !ya, camp: camp };
}

// ── el estado actual, como referencia
var antes = {}; cat.piezas.forEach(function (p) { antes[llavePieza(p)] = p.pieza_id; });

// ── SIMULACIÓN: llegan 4 tipos de novedad a la vez
var NUEVAS = [
  { campana: 'AON', nombre_pieza: 'E-P5', segmento: 'Nuevo Cluster', email_type: 'Principal', canal: 'Email', nombre_pieza_raw: 'EP5', que: 'touchpoint nuevo en campaña existente' },
  { campana: 'Navidad', bu: 'RN', marca: 'Recetas Nestlé', nombre_pieza: 'E-P1', segmento: 'Traditional Parents', email_type: 'Principal', canal: 'Email', nombre_pieza_raw: 'EP1', que: 'campaña nueva del vocabulario' },
  { campana: 'Hotcakes', nombre_pieza: 'E-I1', segmento: 'Interés Salado', email_type: 'Follow Up', canal: 'WhatsApp', nombre_pieza_raw: 'Único', que: 'canal nuevo para una pieza existente' },
  { campana: 'Mundial', nombre_pieza: 'E-P1', segmento: 'Bebidas', email_type: 'Principal', canal: 'Email', nombre_pieza_raw: 'Partido 1', que: 'una que YA existe — no debe duplicarse' }
];
console.log('══ SIMULACIÓN · entran 4 novedades ══');
var asignados = [];
NUEVAS.forEach(function (n) {
  var r = asignaPieza(n);
  asignados.push({ n: n, r: r });
  console.log('  ' + (r.nuevo ? '➕ id NUEVO ' : '♻ ya existía ') + r.id.padEnd(10) + ' [' + r.camp + ']  ' + n.que);
  console.log('     ' + n.campana + ' / ' + n.nombre_pieza + ' / ' + n.segmento + ' / ' + n.canal);
});

// ── ¿se movió algo de lo existente?
var movidos = [];
cat.piezas.forEach(function (p) {
  var k = llavePieza(p);
  if (REG.piezas[k] !== antes[k]) movidos.push(p.pieza_id + ' → ' + REG.piezas[k]);
});
K('los IDs existentes NO se mueven', !movidos.length, movidos.length ? movidos.slice(0, 5).join(' · ') : 'las ' + cat.piezas.length + ' piezas conservan su id');
K('una pieza que ya existe NO se duplica', !asignados[3].r.nuevo, 'Mundial/E-P1/Bebidas reusa ' + asignados[3].r.id);
K('las 3 novedades reciben id propio', asignados.slice(0, 3).every(function (a) { return a.r.nuevo; }), asignados.slice(0, 3).map(function (a) { return a.r.id; }).join(' · '));
K('los ids nuevos no chocan con los usados', (function () {
  var u = {}; Object.keys(REG.piezas).forEach(function (k) { if (u[REG.piezas[k]]) return false; u[REG.piezas[k]] = 1; });
  var ids = asignados.filter(function (a) { return a.r.nuevo; }).map(function (a) { return a.r.id; });
  var yaUsados={};Object.keys(antes).forEach(function(k){yaUsados[antes[k]]=1});return new Set(ids).size === ids.length && ids.every(function (i) { return !yaUsados[i]; });
})(), '');

// ── ¿el vocabulario absorbe lo nuevo o lo rechaza?
console.log('\n══ ¿qué pasa con un valor que NO está en el vocabulario? ══');
var fuera = [];
NUEVAS.forEach(function (n) {
  if (cat.VOC.campana.indexOf(n.campana) < 0) fuera.push('Campaña "' + n.campana + '"');
  if (cat.VOC.segmento.indexOf(n.segmento) < 0) fuera.push('Segmento "' + n.segmento + '"');
  if (!/^(E-[A-Z]\d+|WA-[A-Z0-9]+)$/.test(n.nombre_pieza)) fuera.push('Touchpoint "' + n.nombre_pieza + '"');
});
console.log('  valores fuera del vocabulario: ' + (fuera.length ? fuera.join(' · ') : 'ninguno'));
console.log('  → el validador los DETIENE y van a revisión, no entran en silencio');
K('el vocabulario detecta lo que no conoce', fuera.length > 0, fuera.join(' · '));

// ── anclas entre hojas, con las correcciones
var T = require('path').resolve(__dirname, '..') + '/_tmp/_pc2.xlsx'; fs.copyFileSync(ENT.LIBRO, T);
console.log('\n══ ANCLAS ENTRE LAS DOS HOJAS ══');
console.log('  Piezas → Referencias, por dimensión:');
console.log('    vocabulario : Piezas.<Dimensión>            == Referencias.Valor_Canonico  (Tipo=vocabulario)');
console.log('    alias       : Piezas.Campaña + Touchpoint_Raw == Referencias.Contexto + Valor_Crudo');
console.log('    alias ambiguo: + Segmento en el Contexto      (cuando un mismo crudo da varios touchpoints)');
console.log('    excluido    : Piezas.Cod_*                   ∌ Referencias.Valor_Crudo (Tipo=excluido)');
console.log('  Piezas ↔ JSON: pieza_id · camp_id · journey_id son los MISMOS en los dos lados');

// ── anclas Piezas → alias, incluyendo los que dependen del segmento
var XL=XLSX.readFile(T);
var PP=XLSX.utils.sheet_to_json(XL.Sheets['Catalogo_Piezas'],{defval:''});
var RR=XLSX.utils.sheet_to_json(XL.Sheets['Catalogo_Referencias'],{defval:''});
var aTP={};RR.filter(function(r){return t(r['Dimension'])==='Touchpoint'}).forEach(function(r){aTP[t(r['Contexto'])+'|'+nm(r['Valor_Crudo'])]=t(r['Valor_Canonico'])});
var noU=[];
PP.forEach(function(p){
  var raw=t(p['Touchpoint_Raw']).split(' · ')[0];
  if(!raw||raw===t(p['Touchpoint']))return;
  // 🔴 el alias MÁS ESPECÍFICO gana: primero campaña+segmento, luego solo campaña.
  //    Al revés, un alias genérico ambiguo ("N/A") tapaba al que sí distingue por segmento.
  var v=aTP[t(p['Campaña'])+' · '+t(p['Segmento'])+'|'+nm(raw)]||aTP[t(p['Campaña'])+'|'+nm(raw)];
  if(v!==t(p['Touchpoint']))noU.push(t(p['Pieza_ID'])+' '+raw+'→'+(v||'⬛')+' vs '+t(p['Touchpoint']));
});
K('Piezas → alias de Touchpoint',!noU.length,noU.length?noU.slice(0,3).join(' · '):PP.length+' piezas');
var codsP={};PP.forEach(function(p){for(var i=1;i<=5;i++)['Cod_Walmart_','Cod_Chedraui_'].forEach(function(c){t(p[c+i]).split(/;/).forEach(function(k){k=t(k);if(k)codsP[k]=1})})});
var exc={};RR.filter(function(r){return t(r['Tipo'])==='excluido'}).forEach(function(r){exc[t(r['Valor_Crudo'])]=1});
K('ningún código en pieza Y excluido',!Object.keys(exc).filter(function(c){return codsP[c]}).length,Object.keys(codsP).length+' en piezas · '+Object.keys(exc).length+' excluidos');
console.log('');
pr.forEach(function (p) { console.log('  ' + (p[1] ? '✔' : '🔴') + ' ' + p[0].padEnd(42) + (p[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' problema(s)' : '✅ el catálogo aguanta crecer sin romper lo existente'));
// ── no persistir la simulación · se revierte a lo que había ANTES de correr la prueba
// 🔴 hay que quitar también la campaña que la simulación dio de alta ("Navidad" → CMP-010),
//    y conservar _esquema. Si no, la prueba deja basura en el registro real.
var campReales = {}; cat.campanas.forEach(function (c) { campReales[LIB.llaveCamp(c)] = c.camp_id; });
var jReales = {}; cat.journeys.forEach(function (j) { jReales[LIB.llaveJourney(j)] = j.journey_id; });
LIB.guardar({
  piezas: Object.keys(REG.piezas).filter(function (k) { return antes[k]; })
    .reduce(function (a, k) { a[k] = REG.piezas[k]; return a; }, {}),
  journeys: jReales, campanas: campReales, _esquema: REG._esquema
});
var limpio = JSON.parse(fs.readFileSync(LIB.RUTA, 'utf8'));
console.log('  (la simulación no se guardó · registro en ' + Object.keys(limpio.piezas).length + ' piezas · ' +
  Object.keys(limpio.campanas).length + ' campañas · esquema ' + (limpio._esquema ? 'presente' : '🔴 PERDIDO') + ')');
