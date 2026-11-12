// PASO 1 — Parser del documento maestro de links.
// Cada registro sale con su FUENTE (archivo · hoja · fila) para poder rastrearlo siempre.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function iso(s) { var x = Number(s); return (isFinite(x) && x > 40000 && x < 50000) ? new Date(Date.UTC(1899, 11, 30) + x * 86400000).toISOString().slice(0, 10) : null; }
var T = os.homedir() + '/_ql.xlsx';
fs.copyFileSync(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx', T);
var wb = XLSX.readFile(T);
var HOJAS = ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'];   // Cuaresma/Reagendar/Borradores/Resultados FUERA

function esCod(s) { return /^[A-Za-z0-9]{8}$/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s); }
function codsDe(v, esColCod) {
  var s = t(v), o = [];
  (s.match(/qcart\.app\/([A-Za-z0-9]{6,12})/g) || []).forEach(function (m) { o.push(m.split('/').pop()); });
  if (!o.length && esColCod && esCod(s)) o.push(s);
  return o;
}
var reg = {}, trazas = [];
HOJAS.forEach(function (hn) {
  var F = XLSX.utils.sheet_to_json(wb.Sheets[hn], { header: 1, defval: '' });
  // 🔴 El encabezado se reconoce por su CONTENIDO, no por cantidad de celdas.
  //    "la fila con más celdas llenas" elegía una fila de DATOS: en Marzo el encabezado
  //    tiene 21 celdas y la primera fila de datos 22, así que ganaba la equivocada.
  var TERMINOS = /^(utm_campaign|utm_content|utm_term|utm_medium|utm_source|audiencia|nombre\s*(mail|email)|campa[nñ]a|fecha(\s|$)|recetas?|link\s*receta|links?\s*(recetas?|qcart)|retailer|c[óo]digos?|id|comentarios)/i;
  var iH = 0, mejor = -1;
  F.slice(0, 15).forEach(function (r, i) {
    var pts = r.filter(function (c) { return TERMINOS.test(t(c)); }).length;
    if (pts > mejor) { mejor = pts; iH = i; }
  });
  var enc = F[iH].map(t);
  // índices por CONCEPTO, aceptando las variantes de cada hoja
  function ix(re) { var o = []; enc.forEach(function (c, j) { if (re.test(c)) o.push(j); }); return o; }
  var I = {
    camp: ix(/^utm_campaign$|^campa[nñ]a$/i), fecha: ix(/fecha/i),
    cont: ix(/^utm_content$|^nombre\s*(mail|email)$/i), term: ix(/^utm_term$|^audiencia$/i),
    med: ix(/^utm_medium$/i), rec: ix(/^recetas?\s*\d*$/i), lrec: ix(/^link\s*receta/i),
    ret: ix(/^retailer$/i), cod: ix(/^c[óo]digos?$|^id$/i)
  };
  // 🔴 MARZO: las filas de continuación dejan vacías las 2 primeras columnas de identidad
  //    y TODO se recorre 2 lugares a la izquierda. Se detecta por contenido, no por posición.
  var esMarzo = hn === 'Marzo';
  var arr = {};
  F.slice(iH + 1).forEach(function (r, ri) {
    var fila = iH + 2 + ri;
    var desp = 0;
    if (esMarzo && I.cod.length) {
      // 🔴 Detectar el desfase por EVIDENCIA DIRECTA: dónde está el código.
      //    Probar "¿está vacía la Audiencia?" falla, porque la fila de continuación trae
      //    una FECHA en esa posición y el test da verdadero cuando no debe.
      var jc = I.cod[0];
      var aqui = esCod(t(r[jc])) || /qcart\.app\//.test(t(r[jc]));
      var dos = esCod(t(r[jc - 2])) || /qcart\.app\//.test(t(r[jc - 2]));
      if (!aqui && dos) desp = 2;
    }
    function val(idx) { for (var i = 0; i < idx.length; i++) { var v = t(r[idx[i] - desp]); if (v) return v; } return ''; }
    var camp = val(I.camp), cont = val(I.cont), term = val(I.term), med = val(I.med);
    var rec = val(I.rec), lrec = val(I.lrec), ret = val(I.ret);
    var fe = null; I.fecha.forEach(function (j) { if (!fe) fe = iso(r[j - desp]); });
    if (/^total/i.test(camp)) return;
    // arrastre solo de la IDENTIDAD del envío, nunca de la receta
    if (camp) arr.camp = camp; if (cont) arr.cont = cont; if (term) arr.term = term;
    if (fe) arr.fecha = fe; if (med) arr.med = med;
    var vistos = {};
    r.forEach(function (c, j) {
      codsDe(c, I.cod.indexOf(j + desp) >= 0 || I.cod.indexOf(j) >= 0).forEach(function (cod) {
        if (vistos[cod]) return; vistos[cod] = 1;
        var nuevo = {
          codigo: cod, utm_campaign: camp || arr.camp || '', utm_content: cont || arr.cont || '',
          utm_term: term || arr.term || '', fecha: fe || arr.fecha || null, utm_medium: med || arr.med || '',
          receta: rec, url_receta: lrec, retailer: ret,
          fuente: 'Qcart-Links Mails-Hive- MX.xlsx · ' + hn + ' · f' + fila
        };
        function pts(x) { return (x.utm_campaign ? 8 : 0) + (x.utm_content ? 4 : 0) + (x.receta ? 2 : 0) + (x.fecha ? 1 : 0); }
        if (!reg[cod] || pts(nuevo) > pts(reg[cod])) reg[cod] = nuevo;
        trazas.push({ cod: cod, hoja: hn, fila: fila, desp: desp });
      });
    });
  });
});

// ═════ VALIDACIÓN PASO 1 ═════
var K = Object.keys(reg), V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_N1_2.json', 'utf8'));
var delCat = {}; cat.links.forEach(function (L) { if (L.shortlink_code) delCat[L.shortlink_code] = 1; });
var cubiertos = Object.keys(delCat).filter(function (c) { return reg[c]; });

console.log('══ PASO 1 · PARSER DEL DOCUMENTO DE LINKS ══');
console.log('  códigos extraídos: ' + K.length + '  (hojas Marzo–Agosto)');
['utm_campaign', 'utm_content', 'utm_term', 'fecha', 'receta', 'url_receta', 'retailer'].forEach(function (c) {
  var n = K.filter(function (k) { return t(reg[k][c]); }).length;
  console.log('    ' + (n === K.length ? '✔' : '○') + ' ' + c.padEnd(14) + String(Math.round(n / K.length * 100)).padStart(3) + '%  (' + n + '/' + K.length + ')');
});

// Los códigos que Data_Qcart trae y no están en Marzo–Agosto viven en `Reagendar`, hoja
// excluida por instrucción. No se pierden: conservan la atribución de Data_Qcart y quedan
// marcados como NO confirmados por el documento vigente. Se listan siempre, nunca se callan.
var sinDoc = Object.keys(delCat).filter(function (c) { return !reg[c]; });
sinDoc.forEach(function (c) {
  reg[c] = {
    codigo: c, utm_campaign: '', utm_content: '', utm_term: '', fecha: null, utm_medium: '',
    receta: '', url_receta: '', retailer: '',
    fuente: 'Data_Qcart · sin respaldo en las hojas vigentes del documento (vive en Reagendar)',
    estado: '⚠ atribución no confirmada'
  };
});
chk('los códigos sin respaldo quedan marcados', sinDoc.every(function (c) { return reg[c].estado; }),
  sinDoc.length + ' de ' + Object.keys(delCat).length + ' vienen de la hoja Reagendar → marcados, no descartados');
var DEL_DOC = K.filter(function (k) { return !reg[k].estado; });
chk('todos con utm_campaign', DEL_DOC.every(function (k) { return t(reg[k].utm_campaign); }),
  DEL_DOC.filter(function (k) { return !t(reg[k].utm_campaign); }).length + ' sin campaña');
chk('todos con utm_content', DEL_DOC.every(function (k) { return t(reg[k].utm_content); }),
  K.filter(function (k) { return !t(reg[k].utm_content); }).map(function (k) { return k + '(' + reg[k].fuente.split('· ').pop() + ')'; }).slice(0, 6).join(' '));
chk('todos con receta', DEL_DOC.every(function (k) { return t(reg[k].receta); }),
  DEL_DOC.filter(function (k) { return !t(reg[k].receta); }).length + ' sin receta');
chk('todos con fuente trazable', K.every(function (k) { return /f\d+$/.test(reg[k].fuente); }), '');
chk('sin códigos duplicados', new Set(K).size === K.length, K.length + ' únicos');
chk('ningún código es una palabra', K.every(function (k) { return !/^(Choripan|Familias|WhatsApp|Whatsapp|Molletes)$/i.test(k); }), '');

console.log('\n══ VALIDACIONES ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(34) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S) — no se avanza al paso 2' : '✅ PASO 1 CERRADO · ' + V.length + ' validaciones'));
if (fallo) {
  console.log('\n  los que fallan, con su fuente:');
  K.filter(function (k) { return !t(reg[k].utm_content) || !t(reg[k].receta) || !t(reg[k].utm_campaign); }).slice(0, 12).forEach(function (k) {
    var r = reg[k];
    console.log('    ' + k.padEnd(11) + 'camp="' + r.utm_campaign + '" cont="' + r.utm_content + '" rec="' + t(r.receta).slice(0, 22) + '"  ' + r.fuente);
  });
}
if (!fallo) fs.writeFileSync(os.homedir() + '/_P1_links.json', JSON.stringify(reg, null, 1));
process.exit(fallo ? 1 : 0);
