// ANCLA LITERAL entre Catalogo_Referencias y Catalogo_Piezas — lo que Rick notó que faltaba.
//
// 🔴 EL PROBLEMA: el ancla existía LÓGICAMENTE (Valor_Canonico == la dimensión de la pieza;
//    Contexto+Valor_Crudo == Campaña+Touchpoint_Raw) y mis pruebas la verificaban. Pero en el
//    Excel NO HAY COLUMNA para seguirla: abriendo la hoja no puedes saltar de una referencia a
//    las piezas que la usan. Un ancla que solo yo puedo recorrer no le sirve a Rick.
//
// LO QUE SE AGREGA a cada fila de Referencias:
//    N_Piezas   cuántas piezas usan ese valor  (0 = declarado pero sin usar → hay que mirarlo)
//    Pieza_IDs  los ids concretos, para BUSCARV directo. Si son muchos, los primeros + "…"
//
// Así el vocabulario deja de ser una lista suelta: cada término dice dónde se usa, y un término
// con 0 piezas salta a la vista en vez de quedarse ahí para siempre.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));

// dimensión del catálogo → campo de la pieza.  Las dos grafías (con y sin ñ) porque el
// vocabulario usa la clave interna (`campana`) y los alias el nombre visible (`Campaña`).
var DIM = {
  Bu: 'bu', BU: 'bu', Marca: 'marca', Campana: 'campana', 'Campaña': 'campana',
  Objetivo: 'objetivo', Segmento: 'segmento', Touchpoint: 'nombre_pieza', Canal: 'canal',
  Partido: 'nombre_pieza', Tienda: null, Estado: 'estado'
};
// ¿la pieza usa ese valor en esa dimensión?
function usa(p, campo, valor) {
  if (!campo) return false;
  if (t(p[campo]) === t(valor)) return true;
  // el segmento combinado cuenta: la pieza usa ese valor aunque su Segmento diga "Combinado"
  if (campo === 'segmento' && t(p.segmentos_combinados).split(/\s*,\s*/).map(t).indexOf(t(valor)) >= 0) return true;
  return false;
}
// ¿el contexto del alias aplica a esa pieza?
function aplica(ctx, p) {
  var c = t(ctx);
  if (!c || A.NAMESPACES[c]) return true;                   // sin contexto o contexto = utm
  if (c.indexOf(' · ') > 0) return c === p.campana + ' · ' + p.segmento;
  return c === p.campana;
}

function piezasDe(tipo, dim, canon, crudo, ctx) {
  var campo = DIM[dim];
  // ── vocabulario: las piezas cuya dimensión vale eso
  if (/^vocabulario/.test(tipo)) {
    if (!campo) return [];
    return cat.piezas.filter(function (p) { return usa(p, campo, canon); }).map(function (p) { return p.pieza_id; });
  }
  // ── alias: 🔴 se ancla por su CANÓNICO dentro de su contexto, no por dónde está el crudo.
  //    Un alias como «e-botana1» → E-P1 puede no aparecer en ninguna pieza (la pieza guarda otra
  //    grafía) y aun así ser útil: su trabajo es LLEVARTE a un canónico. El ancla que le sirve a
  //    Rick es "¿a qué piezas me lleva?", no "¿dónde está escrito este texto?".
  if (/^alias/.test(tipo)) {
    if (!campo) return [];
    return cat.piezas.filter(function (p) { return usa(p, campo, canon) && aplica(ctx, p); })
      .map(function (p) { return p.pieza_id; });
  }
  // ── excluido: por definición NINGUNA pieza lo usa. Si alguna lo usa, es un error grave.
  if (tipo === 'excluido') {
    var cods = [];
    cat.piezas.forEach(function (p) {
      for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
        t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k) === t(crudo)) cods.push(p.pieza_id); });
      });
    });
    return cods;
  }
  return [];
}

module.exports = { piezasDe: piezasDe, DIM: DIM };

if (require.main === module) {
  // diagnóstico: ¿cuántas referencias quedarían ancladas y cuántas huérfanas?
  var filas = [];
  Object.keys(cat.VOC).forEach(function (d) {
    var nom = d.charAt(0).toUpperCase() + d.slice(1);
    cat.VOC[d].forEach(function (v) { filas.push({ tipo: 'vocabulario', dim: nom, canon: v, crudo: '', ctx: '' }); });
  });
  (cat.aliasUTM || []).forEach(function (r) { filas.push({ tipo: 'alias', dim: r.Dimension, canon: r.Valor_Canonico, crudo: r.Valor_Crudo, ctx: r.Contexto }); });
  var res = filas.map(function (f) { return { f: f, ids: piezasDe(f.tipo, f.dim, f.canon, f.crudo, f.ctx) }; });
  var conAncla = res.filter(function (x) { return x.ids.length; }).length;
  var sinAncla = res.filter(function (x) { return !x.ids.length; });
  console.log('══ ancla Referencias → Piezas ══');
  console.log('  filas evaluadas : ' + res.length);
  console.log('  CON piezas      : ' + conAncla);
  console.log('  SIN piezas      : ' + sinAncla.length + '  ← declaradas pero sin usar (no es error, es visibilidad)');
  var porDim = {};
  sinAncla.forEach(function (x) { porDim[x.f.dim] = (porDim[x.f.dim] || 0) + 1; });
  Object.keys(porDim).sort().forEach(function (k) { console.log('      ' + String(porDim[k]).padStart(3) + '  ' + k); });
  console.log('\n  ejemplos anclados:');
  res.filter(function (x) { return x.ids.length; }).slice(0, 6).forEach(function (x) {
    console.log('    ' + x.f.tipo.padEnd(12) + x.f.dim.padEnd(12) + ('«' + (x.f.crudo || x.f.canon) + '»').padEnd(26) +
      x.ids.length + ' piezas: ' + x.ids.slice(0, 4).join(' ') + (x.ids.length > 4 ? ' …' : ''));
  });
}
