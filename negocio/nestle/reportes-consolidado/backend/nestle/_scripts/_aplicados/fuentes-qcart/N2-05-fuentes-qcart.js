// N2 · QCART → BACKEND.  Produce `_fuentes/qcart.json`.
//
// 🔴 EL HALLAZGO: `Data_Qcart` tiene 118 filas, no 67. Las otras 49 no tienen `Shortlink_Code`
//    y por eso quedaron fuera del catálogo — 673 carritos sin atribuir.
//    **Pero no les falta información**: traen campaña, segmento, touchpoint, receta, tienda,
//    canal Y FECHA, todo ya canonizado en columnas `*_Canonico`.
//
// 🔴 LA LECCIÓN, POR CUARTA VEZ EN ESTA SESIÓN: antes de decir que un dato no se puede
//    resolver, agotar TODAS las columnas de la fila. Yo estaba usando `Campaign`/`Segment`
//    crudos teniendo `Campana_Canonica` y `Segmento_Canonico` al lado, y sin mirar
//    `Fecha_Envio` ni `Medio`. Con las columnas crudas: 14 resueltas. Con todas: 34.
//
// 🔴 Y LO QUE NO SE HACE: forzar las ambiguas. Si campaña+segmento+canal+touchpoint+fecha
//    +receta+tipo siguen dando varias piezas, se DECLARA ambigua con sus candidatas. Asignar
//    "la primera" es exactamente el error que movió 186 carritos en su momento.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
// 🔴 SUPERADO por fuentes-qcart.qcart.js (19-ago-2026)
//    Leía los 42 CSV agrupados y sin fecha, y producía una sola hoja con las dos
//    granularidades mezcladas y 5 columnas calculadas. N2b lee los 2 vigentes,
//    separa carritos de productos y no calcula nada.
var SUPERADO_POR = 'fuentes-qcart.qcart.js';
if (!process.env.CORRER_SUPERADO) {
  console.log('');
  console.log('  🔴 este script está SUPERADO por ' + SUPERADO_POR + '.');
  console.log('     leía los 42 CSV viejos, agrupados y sin fecha, y producía UNA hoja con las');
  console.log('     dos granularidades mezcladas y 5 columnas calculadas.');
  console.log('     Ahora solo cuentan los 2 archivos de ReportesQcart/_vigentes/.');
  console.log('     Si de verdad lo necesitas: CORRER_SUPERADO=1 node N2-05-fuentes-qcart.js');
  console.log('');
  process.exit(0);
}
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var PROY = require('os').homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
// el archivo de trabajo se RESUELVE (no se escribe con su versión): si mañana hay una v9,
// este script la sigue sin tocar una línea. Prefiere el handoff de N1 si ya está medido;
// si no hay handoff, lo resuelve por patrón. Nunca lo da por sabido.
function VIVO_() {
  var _b = require("os").homedir() + "/.claude/reportes-backend/nestle";
  try {
    var inv = JSON.parse(require("fs").readFileSync(_b + "/_insumos/inventario.json", "utf8"));
    if (inv.forma && inv.forma.archivo_vivo && inv.forma.archivo_vivo.ruta) return inv.forma.archivo_vivo.ruta;
  } catch (e) { }
  return require(_b + "/_scripts/lib-flexible.js").archivoVivo({ dir: PROY }).ruta;
}
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var nm = A.nm;
var iso = function (f) { var n = num(f); return n ? new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10) : ''; };

var T = os.homedir() + '/_n2q.xlsx';
fs.copyFileSync(VIVO_(), T);
var wb = XLSX.readFile(T);
var DQ = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var IX = A.indexar(XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' }));

// índice de códigos → pieza (lo que ya resolvía el catálogo)
var porCod = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) porCod[t(k)] = p; });
  });
});

/** Resuelve una fila SIN código usando todas sus columnas, en cascada. Nunca fuerza. */
function resolverSinCodigo(r) {
  var camp = t(r['Campana_Canonica']) || t(r['Campaign']);
  var seg = t(r['Segmento_Canonico']) || t(r['Segment']);
  var canal = /whats/i.test(t(r['Medio'])) ? 'WhatsApp' : 'Email';
  var tp = A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v
    || A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, '').v || t(r['Touchpoint']);
  var f = iso(r['Fecha_Envio']), rec = nm(r['Receta']);
  var c = P.filter(function (p) { return t(p['Campaña']) === camp && t(p['Segmento']) === seg && t(p['Canal']) === canal; });
  var por = ['campaña+segmento+canal'];
  if (c.length > 1) { var x = c.filter(function (p) { return t(p['Touchpoint']) === tp; }); if (x.length) { c = x; por.push('touchpoint'); } }
  if (c.length > 1 && f) { var y = c.filter(function (p) { return t(p['Fecha_Primer_Envio']).slice(0, 10) === f; }); if (y.length) { c = y; por.push('fecha'); } }
  if (c.length > 1 && rec) { var z = c.filter(function (p) { for (var i = 1; i <= 5; i++) if (nm(p['Receta_' + i]) === rec) return true; return false; }); if (z.length) { c = z; por.push('receta'); } }
  if (c.length > 1) { var w = c.filter(function (p) { return t(p['Email_Type']) === 'Principal'; }); if (w.length === 1) { c = w; por.push('tipo=Principal'); } }
  return { candidatas: c, por: por.join(' → '), dims: { camp: camp, seg: seg, canal: canal, tp: tp, fecha: f, receta: t(r['Receta']) } };
}

var st = { conCod: 0, sinPieza: 0, recuperadas: 0, ambiguas: 0, carrCod: 0, carrRec: 0, carrAmb: 0 };
var filas = DQ.map(function (r) {
  var cod = t(r['Shortlink_Code']), carr = num(r['Carts_Total_All_Products']);
  var o = {
    shortlink_code: cod, carritos: carr, views: num(r['Views']),
    campana: t(r['Campana_Canonica']) || t(r['Campaign']), segmento: t(r['Segmento_Canonico']) || t(r['Segment']),
    touchpoint_raw: t(r['Touchpoint']), receta: t(r['Receta']), tienda: t(r['Tienda']),
    medio: t(r['Medio']), fecha_envio: iso(r['Fecha_Envio']), periodo: t(r['Periodo_Reporte']),
    intencion_total: num(r['Intencion_Total_Carrito_MXN']), intencion_nestle: num(r['Intencion_Productos_Nestle_MXN'])
  };
  if (cod && porCod[cod]) { o.pieza_id = t(porCod[cod]['Pieza_ID']); o.atribucion = 'por código'; st.conCod++; st.carrCod += carr; return o; }
  if (cod) { o.pieza_id = ''; o.atribucion = 'código no está en ninguna pieza · ver excluidos'; st.sinPieza++; return o; }
  var R = resolverSinCodigo(r);
  o.dims_usadas = R.dims;
  if (R.candidatas.length === 1) {
    o.pieza_id = t(R.candidatas[0]['Pieza_ID']);
    o.atribucion = 'SIN código · resuelta por ' + R.por;
    st.recuperadas++; st.carrRec += carr;
  } else {
    // 🔴 no se fuerza. Se declara con sus candidatas para que decida quien sabe.
    o.pieza_id = '';
    o.atribucion = 'AMBIGUA · ' + (R.candidatas.length || 'ninguna') + ' candidata(s) tras ' + R.por;
    o.candidatas = R.candidatas.map(function (p) { return t(p['Pieza_ID']) + ' ' + t(p['Touchpoint']) + '/' + t(p['Email_Type']) + '/' + t(p['Fecha_Primer_Envio']).slice(0, 10); });
    st.ambiguas++; st.carrAmb += carr;
  }
  return o;
});

var out = {
  paso: 'N2 · qcart', generado_por: 'N2-05-fuentes-qcart.js',
  fuente: 'Data_Qcart (workbook) — ' + DQ.length + ' filas', filas: filas,
  auditoria: {
    filas_totales: filas.length,
    con_codigo_atribuidas: st.conCod, carritos_por_codigo: st.carrCod,
    con_codigo_sin_pieza: st.sinPieza,
    sin_codigo_RECUPERADAS: st.recuperadas, carritos_recuperados: st.carrRec,
    sin_codigo_AMBIGUAS: st.ambiguas, carritos_ambiguos: st.carrAmb,
    nota: 'los carritos recuperados NO estaban en el catálogo: son ADICIONALES a los 1,636. Cambian cifras que el cliente ya vio → requieren OK antes de publicarse.'
  }
};
try { fs.mkdirSync(BACK + '/_fuentes'); } catch (e) { }
fs.writeFileSync(BACK + '/_fuentes/qcart.json', JSON.stringify(out, null, 1));

console.log('════ N2 · QCART → BACKEND ════');
console.log('  filas de Data_Qcart: ' + filas.length);
console.log('');
console.log('  ── con código');
console.log('     atribuidas a una pieza : ' + st.conCod + '   (' + st.carrCod.toLocaleString() + ' carritos)');
console.log('     sin pieza (excluidos)  : ' + st.sinPieza);
console.log('  ── SIN código  (las que estaban fuera del catálogo)');
console.log('     ✔ RECUPERADAS          : ' + st.recuperadas + '   (' + st.carrRec.toLocaleString() + ' carritos)');
console.log('     🔴 ambiguas, declaradas : ' + st.ambiguas + '   (' + st.carrAmb.toLocaleString() + ' carritos) — NO se fuerzan');
console.log('');
var amb = {};
filas.filter(function (f) { return /AMBIGUA/.test(f.atribucion); }).forEach(function (f) {
  var k = f.campana + ' | ' + (f.dims_usadas ? f.dims_usadas.tp : '?') + ' | ' + f.segmento + '  → ' + (f.candidatas || []).length + ' candidatas';
  amb[k] = (amb[k] || 0) + f.carritos;
});
Object.keys(amb).forEach(function (k) { console.log('        ' + String(amb[k]).padStart(4) + ' carritos   ' + k); });
console.log('\n  → ' + BACK + '/_fuentes/qcart.json');
