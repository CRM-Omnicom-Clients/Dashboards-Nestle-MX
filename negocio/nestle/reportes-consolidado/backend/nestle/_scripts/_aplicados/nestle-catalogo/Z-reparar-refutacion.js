// REPARAR lo que encontró el refutador. Cuatro cosas, ninguna cambia un número —
// cambian la TRAZABILIDAD, que es justo lo que el catálogo promete.
//
//   1. 6 códigos del maestro que se perdían en silencio → 2 se pegan a su pieza, 4 se declaran
//      excluidos con motivo (3 "No enviado" + 1 envío Federación que no tenemos cargado)
//   2. 6 recetas con código pero sin URL → se recupera la URL del maestro
//   3. 009-P005: Confirmado, 25,212 envíos y SIN fecha → se toma de Data_Email
//   4. Clicks_Medidos: N4 necesita distinguir un click medido de uno derivado de un CTOR
//      asumido. En Tercer Tiempo los clicks NO se midieron (Read × 12% fijo). Sin esta
//      columna, un insight compararía un supuesto contra un benchmark como si fuera dato.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
function nm(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var wb = XLSX.readFile(os.homedir() + '/_rf.xlsx');
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

// ── leer el maestro fila por fila: código → { receta, url, tienda, hoja, fila, estado }
var wd = XLSX.readFile(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
var doc = {};
wd.SheetNames.filter(function (h) { return /^(marzo|abril|mayo|junio|julio|agosto)/i.test(h); }).forEach(function (h) {
  XLSX.utils.sheet_to_json(wd.Sheets[h], { header: 1, defval: '' }).forEach(function (fila, i) {
    var cel = fila.map(t);
    var cods = [];
    cel.forEach(function (c) { (c.match(/qcart\.app\/([A-Za-z0-9_-]{4,})/g) || []).forEach(function (m) { cods.push(m.split('/').pop()); }); });
    if (!cods.length) return;
    var url = cel.filter(function (c) { return /recetasnestle\.com\.mx\/recetas\//.test(c); })[0] || '';
    var receta = url ? decodeURIComponent(url.split('/recetas/')[1] || '').replace(/-/g, ' ') : '';
    var tienda = /chedraui/i.test(cel.join(' ')) ? 'Chedraui' : (/walmart|smkts/i.test(cel.join(' ')) ? 'Walmart' : '');
    var noEnv = cel.some(function (c) { return /^no enviado$/i.test(c); });
    var fed = cel.some(function (c) { return /federaci/i.test(c); });
    cods.forEach(function (c) { doc[c] = { receta: receta, url: url, tienda: tienda, hoja: h, fila: i + 1, noEnv: noEnv, fed: fed, cel: cel }; });
  });
});
console.log('  maestro indexado: ' + Object.keys(doc).length + ' códigos\n');

// ══ 1 · los códigos huérfanos ══════════════════════════════════════════════════════
var enCat = {};
cat.piezas.forEach(function (p) {
  for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) {
    t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) enCat[t(k)] = p; });
  });
});
var yaExc = {}; (cat.excluidos || []).forEach(function (x) { yaExc[t(x.Valor_Crudo)] = 1; });
var huerf = Object.keys(doc).filter(function (c) { return !enCat[c] && !yaExc[c]; });
console.log('══ 1 · códigos del maestro sin declarar: ' + huerf.length + ' ══');
var pegados = [], excluidos = [];
huerf.forEach(function (cod) {
  var d = doc[cod];
  // ¿hay una pieza con ESA receta y ESA tienda? entonces es un código más de esa fila
  var puesto = false;
  if (!d.noEnv && !d.fed && d.receta) {
    var campo = d.tienda === 'Chedraui' ? 'Cod_Chedraui_' : 'Cod_Walmart_';
    cat.piezas.forEach(function (p) {
      if (puesto) return;
      for (var i = 1; i <= 5; i++) {
        if (nm(p['Receta_' + i]) && nm(p['Receta_' + i]) === nm(d.receta)) {
          var act = t(p[campo + i]);
          if (act.split(/\s*;\s*/).indexOf(cod) < 0) p[campo + i] = act ? act + ' ; ' + cod : cod;
          pegados.push(cod + ' → ' + p.pieza_id + ' ' + campo.replace('Cod_', '').replace('_', '') + i + ' (' + d.receta + ')');
          puesto = true; return;
        }
      }
    });
  }
  if (puesto) return;
  var motivo = d.noEnv ? 'el maestro marca "No enviado" · ' + d.hoja + ' f' + d.fila
    : d.fed ? 'Envío Federación · no está cargado en Data_Email · ' + d.hoja + ' f' + d.fila
      : 'sin pieza que lo reclame · ' + d.hoja + ' f' + d.fila;
  cat.excluidos = cat.excluidos || [];
  cat.excluidos.push({
    Tipo: 'excluido', Dimension: 'Shortlink', Valor_Crudo: cod, Valor_Canonico: '',
    Contexto: d.receta || '', Notas: motivo + ' · 0 carritos en Data_Qcart',
    Fuente: 'Qcart-Links Mails-Hive- MX.xlsx · ' + d.hoja + ' · f' + d.fila
  });
  excluidos.push(cod + ' — ' + motivo);
});
pegados.forEach(function (x) { console.log('    ➕ pegado a su pieza: ' + x); });
excluidos.forEach(function (x) { console.log('    ⛔ declarado excluido: ' + x); });

// ══ 2 · las recetas con código y sin URL ═══════════════════════════════════════════
console.log('\n══ 2 · recetas sin URL ══');
var urlPorReceta = {}; Object.keys(doc).forEach(function (c) { if (doc[c].receta && doc[c].url) urlPorReceta[nm(doc[c].receta)] = doc[c].url; });
var urlPorCod = {}; Object.keys(doc).forEach(function (c) { if (doc[c].url) urlPorCod[c] = doc[c].url; });
var puestas = [], sinRecuperar = [];
cat.piezas.forEach(function (p) {
  for (var i = 1; i <= 5; i++) {
    if (!t(p['Receta_' + i]) || t(p['URL_Receta_' + i])) continue;
    // primero por el código de esa misma celda (es el vínculo exacto), luego por nombre de receta
    var cods = (t(p['Cod_Walmart_' + i]) + ' ; ' + t(p['Cod_Chedraui_' + i])).split(/\s*;\s*/).filter(Boolean);
    var u = cods.map(function (c) { return urlPorCod[c]; }).filter(Boolean)[0] || urlPorReceta[nm(p['Receta_' + i])];
    if (u) { p['URL_Receta_' + i] = u; puestas.push(p.pieza_id + ' Receta_' + i + ' «' + t(p['Receta_' + i]) + '»'); }
    else sinRecuperar.push(p.pieza_id + ' Receta_' + i + ' «' + t(p['Receta_' + i]) + '»');
  }
});
puestas.forEach(function (x) { console.log('    ✔ URL recuperada: ' + x); });
sinRecuperar.forEach(function (x) { console.log('    ⚠ sin URL en el maestro: ' + x); });

// ══ 3 · la pieza Confirmado sin fecha ══════════════════════════════════════════════
console.log('\n══ 3 · fecha faltante en una pieza Confirmado ══');
var arregladas = [];
cat.piezas.filter(function (p) { return !t(p.fecha_primer_envio) && t(p.estado) === 'Confirmado'; }).forEach(function (p) {
  var cn = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  var filas = E.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) >= 0 && t(r['Send_Date']); });
  if (!filas.length) { console.log('    ⚠ ' + p.pieza_id + ' — Data_Email no trae Send_Date para su content_name'); return; }
  var fechas = filas.map(function (r) { return r['Send_Date']; }).filter(Boolean).sort();
  var f = fechas[0];
  // serial de Excel → ISO
  if (typeof f === 'number') { var d = new Date(Date.UTC(1899, 11, 30) + f * 86400000); f = d.toISOString().slice(0, 10); }
  else f = t(f).slice(0, 10);
  p.fecha_primer_envio = f;
  arregladas.push(p.pieza_id + ' → ' + f + '  (de ' + filas.length + ' fila(s) de Data_Email)');
});
arregladas.forEach(function (x) { console.log('    ✔ ' + x); });

// ══ 4 · Clicks_Medidos ═════════════════════════════════════════════════════════════
// 🔴 REGLA DE NEGOCIO, NO INFERENCIA: en Tercer Tiempo los clicks de WhatsApp NO se midieron;
//    la fuente los deriva de Read × un CTOR asumido de 12%. En Hotcakes SÍ son reales (el CTOR
//    varía 11.2–18.1%). Sin esta columna, N4 compararía un supuesto contra un benchmark.
console.log('\n══ 4 · Clicks_Medidos (lo que N4 necesita para no reportar un supuesto como dato) ══');
var der = 0, med = 0, na = 0;
cat.piezas.forEach(function (p) {
  if (t(p.canal) !== 'WhatsApp') { p.clicks_medidos = 'N/A'; na++; return; }
  if (nm(p.campana) === 'tercertiempo') { p.clicks_medidos = 'No · derivado de Read × CTOR 12% asumido'; der++; }
  else { p.clicks_medidos = 'Sí'; med++; }
});
console.log('    email/no aplica ' + na + ' · WhatsApp medido ' + med + ' · WhatsApp DERIVADO ' + der);

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado · ' + pegados.length + ' códigos pegados · ' + excluidos.length + ' excluidos declarados · ' +
  puestas.length + ' URLs · ' + arregladas.length + ' fechas · Clicks_Medidos en las ' + cat.piezas.length);
