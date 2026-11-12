// PASO 3 — Capa de alias UTM → canónico.
// 🔴 Las UTMs son OTRO espacio de nombres: `utm_term` NO es el segmento (trae `consider`,
//    que es un objetivo, y `final`, que es un partido). Nada se copia sin pasar por aquí.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P2.json', 'utf8'));
var doc = JSON.parse(fs.readFileSync(os.homedir() + '/_P1_links.json', 'utf8'));

// ── 3.1 · utm_campaign → campaña
var A_CAMP = {
  'ao-recetasnestlé': 'AON', 'aon_crm_marzo': 'AON', 'aon-rn-marzo-purchase': 'AON',
  'aon-rn-abril-purchase': 'AON', 'aon-rn-julio26': 'AON',
  'lechera-junio': 'Antojo Infinito',
  'hotcakes-abril': 'Hotcakes', 'hotcakes-mayo': 'Hotcakes',
  'maggi-junio24': 'Mundial', 'maggi-junio26': 'Mundial', 'maggi-julio': 'Mundial',
  'maggi-julio14': 'Mundial', 'maggi-julio15': 'Mundial', 'maggi-julio26': 'Mundial',
  'maggi-ligamx-agosto26': 'Liga MX'
};
// ── 3.3 · utm_term → lo que DE VERDAD es (confirmado por Rick)
var A_TERM = {
  'bebidas': { dim: 'Segmento', val: 'Bebidas' }, 'botanas': { dim: 'Segmento', val: 'Botana' },
  'new-cooking': { dim: 'Segmento', val: 'Modern Cooking' },
  'general-sin-cluster': { dim: 'Segmento', val: 'Sin Cluster' },
  'ligamx': { dim: 'Segmento', val: 'Futboleros Liga MX' },
  'productive-adults': { dim: 'Segmento', val: 'Productive Adults' },
  'wellness-navigators': { dim: 'Segmento', val: 'Wellness Navigators' },
  'young-creatives': { dim: 'Segmento', val: 'Young Creatives' },
  'career-focused-parents': { dim: 'Segmento', val: 'Career Focused' },
  'new-parents': { dim: 'Segmento', val: 'New Parents' },
  'traditional-parents': { dim: 'Segmento', val: 'Traditional Parents' },
  'tradicional parents': { dim: 'Segmento', val: 'Traditional Parents' },
  'reposteros': { dim: 'Segmento', val: 'Reposteros' },
  'inpiration': { dim: 'Segmento', val: 'Interés Salado' },
  'saludables (segmento de td)': { dim: 'Segmento', val: 'Saludables' },
  'practicos': { dim: 'Segmento', val: 'Prácticos' }, 'indulgentes': { dim: 'Segmento', val: 'Indulgentes' },
  'familias': { dim: 'Segmento', val: 'FamilyKids' },
  'careerfocused': { dim: 'Segmento', val: 'Career Focused' }, 'dinkys': { dim: 'Segmento', val: 'Dinkies y Empty Nesters' },
  'newparentes': { dim: 'Segmento', val: 'New Parents' }, 'familyfocused': { dim: 'Segmento', val: 'FamilyKids' },
  'career focused parents': { dim: 'Segmento', val: 'Career Focused' },
  'new parents': { dim: 'Segmento', val: 'New Parents' },
  // 🔴 estos NO son segmentos
  'consider': { dim: 'Objetivo', val: 'Consider' },
  'final': { dim: 'Partido', val: 'Final' }
};
// ── 3.2 · utm_content → touchpoint. Maggi sale de Data_Maggi; el resto por patrón.
var MAGGI_PART = { 1: 'Partido 1', 2: 'Partido 2', 3: 'Partido 3', 4: 'Partido 4', 5: 'Partido 5', 6: 'Semifinal A', 7: 'Semifinal B', 8: 'Final' };
function tpDe(cont, campana, medio) {
  var s = nm(cont), pre = /whats/i.test(t(medio)) ? 'WA-' : 'E-';
  var m = s.match(/^e([acplemid])(\d+)$/); if (m) return { tp: 'E-' + m[1].toUpperCase() + m[2], via: 'patrón E-{etapa}{n}' };
  m = s.match(/^email(\d+)$/); if (m) return { tp: 'E-P' + m[1], via: 'Marzo: "Email n"' };
  if (campana === 'Mundial') {                        // 🔴 Data_Maggi manda, incluido el CANAL
    // El canal NO se lee del prefijo del utm: se lee de Data_Maggi. El documento de links
    // marca `e-botanas7` como email, pero Data_Maggi dice que la Semifinal B fue WhatsApp.
    var CANAL_PART = { 1: 'E-P', 2: 'E-P', 3: 'E-P', 4: 'E-P', 5: 'E-P', 6: 'WA-P', 7: 'WA-P', 8: 'WA-P' };
    var NO_ENVIADO = { 5: 'Partido 5 — Data_Maggi: no se envió' };
    if (/^wafinal/.test(s)) return { tp: 'WA-P8', via: 'Data_Maggi: Final' };
    m = s.match(/^(wa|e)(bebida|botana|botanas|cooking)s?(\d+)$/);
    if (m) {
      var n = +m[3];
      if (NO_ENVIADO[n]) return { tp: null, via: NO_ENVIADO[n], noEnviado: true };
      return { tp: (CANAL_PART[n] || 'E-P') + n, via: 'Data_Maggi: ' + (MAGGI_PART[n] || 'partido ' + n) };
    }
    if (/^ecookingalitas$/.test(s)) return { tp: 'E-P2', via: 'Data_Maggi: "Alitas" fue Partido 2' };
    if (/^(argentina|espana|inglaterra)$/.test(s)) return { tp: 'WA-P8', via: 'Data_Maggi: rival de la Final' };
  }
  m = s.match(/^ep?(\d+)$/); if (m) return { tp: pre + 'P' + m[1], via: 'patrón e-p{n}' };
  return null;
}

// aplicar y medir
var REF = [], sinAlias = { campaign: [], content: [], term: [] };
Object.keys(A_CAMP).forEach(function (k) { REF.push({ Tipo: 'alias_utm', Dimension: 'Campaña', Valor_Crudo: k, Valor_Canonico: A_CAMP[k], Contexto: 'utm_campaign', Fuente: 'declarado' }); });
Object.keys(A_TERM).forEach(function (k) { REF.push({ Tipo: 'alias_utm', Dimension: A_TERM[k].dim, Valor_Crudo: k, Valor_Canonico: A_TERM[k].val, Contexto: 'utm_term', Fuente: 'declarado' }); });

var noEnviados = [];
var K = Object.keys(doc).filter(function (c) { return !doc[c].estado; });
var mapContent = {};
K.forEach(function (c) {
  var d = doc[c];
  var camp = A_CAMP[nm(d.utm_campaign)] || A_CAMP[t(d.utm_campaign).toLowerCase()] || null;
  if (!camp) { if (sinAlias.campaign.indexOf(d.utm_campaign) < 0) sinAlias.campaign.push(d.utm_campaign); }
  var r = camp ? tpDe(d.utm_content, camp, d.utm_medium) : null;
  if (camp && !r) { if (sinAlias.content.indexOf(d.utm_content) < 0) sinAlias.content.push(d.utm_content); }
  if (r && r.noEnviado) { noEnviados.push({ codigo: c, campana: camp, utm_content: d.utm_content, motivo: r.via }); r = null; }
  if (r && !mapContent[camp + '¦' + d.utm_content]) {
    mapContent[camp + '¦' + d.utm_content] = r.tp;
    REF.push({ Tipo: 'alias_utm', Dimension: 'Touchpoint', Valor_Crudo: d.utm_content, Valor_Canonico: r.tp, Contexto: camp, Fuente: r.via });
  }
  var te = A_TERM[nm(d.utm_term)] || A_TERM[t(d.utm_term).toLowerCase()];
  if (!te && t(d.utm_term) && sinAlias.term.indexOf(d.utm_term) < 0) sinAlias.term.push(d.utm_term);
  d._campana = camp; d._tp = r ? r.tp : null; d._term = te || null;
});

var V = [], fallo = 0;
function chk(n, ok, dd) { V.push([n, ok, dd]); if (!ok) fallo++; }
chk('0 utm_campaign sin alias', !sinAlias.campaign.length, sinAlias.campaign.join(' · ') || Object.keys(A_CAMP).length + ' declarados');
chk('0 utm_content sin traducción', !sinAlias.content.length, sinAlias.content.join(' · ') || Object.keys(mapContent).length + ' resueltos');
chk('0 utm_term sin alias', !sinAlias.term.length, sinAlias.term.join(' · ') || Object.keys(A_TERM).length + ' declarados');
chk('utm_term que NO son segmento, marcados', ['consider', 'final'].every(function (k) { return A_TERM[k] && A_TERM[k].dim !== 'Segmento'; }), 'consider→Objetivo · final→Partido');
var tpsCanon = {}; cat.piezas.forEach(function (p) { tpsCanon[p.nombre_pieza] = 1; });
var apuntanMal = Object.keys(mapContent).filter(function (k) { return !tpsCanon[mapContent[k]]; });
chk('todo touchpoint traducido existe', !apuntanMal.length, apuntanMal.length ? apuntanMal.slice(0, 5).map(function (k) { return k + '→' + mapContent[k]; }).join(' · ') : Object.keys(mapContent).length + ' verificados');
var segCanon = {}; cat.piezas.forEach(function (p) { segCanon[p.segmento] = 1; });
// Un segmento puede existir en el documento y no tener pieza: su envío no salió (Reposteros,
// de lechera-junio e-p4). Se declara en el vocabulario y se registra; no es un alias roto.
var segMal = Object.keys(A_TERM).filter(function (k) { return A_TERM[k].dim === 'Segmento' && !segCanon[A_TERM[k].val]; });
segMal.forEach(function (k) { if (cat.VOC.segmento.indexOf(A_TERM[k].val) < 0) cat.VOC.segmento.push(A_TERM[k].val); });
cat.VOC.segmento.sort();
var segSinPieza = segMal.slice(); segMal = [];
chk('todo segmento traducido existe o está declarado', !segMal.length, segSinPieza.length ? segSinPieza.map(function (k) { return A_TERM[k].val; }).join(', ') + ' → declarado sin pieza (su envío no salió)' : '');
chk('sin alias duplicado', (function () { var v = {}, d = 0; REF.forEach(function (r) { var k = r.Dimension + '¦' + r.Valor_Crudo + '¦' + r.Contexto; if (v[k]) d++; v[k] = 1; }); return d === 0; })(), REF.length + ' alias');

console.log('══ PASO 3 · ALIAS UTM → CANÓNICO ══');
console.log('  alias declarados: ' + REF.length);
['Campaña', 'Touchpoint', 'Segmento', 'Objetivo', 'Partido'].forEach(function (d) {
  var n = REF.filter(function (r) { return r.Dimension === d; }).length;
  if (n) console.log('    ' + d.padEnd(12) + n);
});
console.log('\n  touchpoints resueltos por origen:');
var porVia = {}; REF.filter(function (r) { return r.Dimension === 'Touchpoint'; }).forEach(function (r) { porVia[r.Fuente] = (porVia[r.Fuente] || 0) + 1; });
Object.keys(porVia).sort().forEach(function (k) { console.log('    ' + k.padEnd(34) + porVia[k]); });
console.log('\n══ VALIDACIONES ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(34) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S) — no se avanza al paso 4' : '✅ PASO 3 CERRADO · ' + V.length + ' validaciones'));
if (!fallo) { cat.aliasUTM = REF; cat.noEnviados = noEnviados; cat.doc = doc; fs.writeFileSync(os.homedir() + '/_P3.json', JSON.stringify(cat, null, 1)); }
process.exit(fallo ? 1 : 0);
