// COMPLEMENTO DE FECHAS Y PERIODOS — lo que Rick pidió tras el refutador.
//
// 🔴 LO QUE ÉL VIO Y YO NO: una pieza AON no vive en UNA quincena, manda durante semanas.
//    Con una sola columna de quincena, N3 mete todos sus envíos en la de lanzamiento y el
//    reporte quincenal miente. Son 18 piezas (17 cruzan de mes).
// 🔴 Y LA OTRA: declaré 009-P005 "sin fecha en la fuente" mirando SOLO Send_Date. La fila
//    trae Send_Quincena = "Jul-Q1-2026". El dato estaba y no lo busqué.
//    REGLA: antes de declarar que un dato no existe, agotar TODAS las columnas que lo llevan.
//
// ── LA LLAVE fila→pieza (verificada: 76 piezas cuadran exacto, 0 filas huérfanas, 0 compartidas)
//      campaña ¦ touchpoint ¦ segmento ¦ email_type ¦ ASSET_ID
//    El asset_id es imprescindible: AON mandó dos oleadas (863587 y 803867) con el mismo
//    touchpoint y segmento. Sin él, dos piezas legítimas se fusionan.
//    Y el segmento hay que buscarlo también en segmentos_combinados: Antojo Infinito tiene
//    Segmento="Combinado" y los tres reales viven en la otra columna.
//
// ── LO QUE QUEDA, en tres niveles a propósito
//    ANCLA      Fecha_Primer_Envio · Quincena_Lanzamiento   una sola. El carrito del mes cuelga
//                                                           de aquí UNA vez y no se dobla.
//    ACTIVIDAD  Quincenas_Activas · Meses_Activos · N_*      todas. Donde de verdad mandó.
//    REPARTO    Sends_Por_Quincena · Sends_Por_Mes           "2026-04-Q2:14972 ; 2026-05-Q1:39"
//                                                           N3 abre una fila por periodo con SU
//                                                           volumen, sin inventarse el reparto.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var A = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-alias.js');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var iso = function (f) { if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10); return t(f).slice(0, 10); };
var Qz = function (d) { return d.slice(0, 7) + '-' + (Number(d.slice(8, 10)) <= 15 ? 'Q1' : 'Q2'); };
var assetDe = function (s) { return (t(s).match(/_(\d{4,})\s*$/) || [])[1] || ''; };

// "Jul-Q1-2026" → "2026-07-Q1". La quincena declarada, cuando no hay día exacto.
var MES = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
function quincenaDeclarada(s) {
  var m = /^([a-z]{3})[a-z]*-?(Q[12])-?(\d{4})$/i.exec(t(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''));
  if (!m) return '';
  var mm = MES[m[1].toLowerCase()];
  return mm ? m[3] + '-' + mm + '-' + m[2].toUpperCase() : '';
}

var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var T = os.homedir() + '/_fc.xlsx';
fs.copyFileSync('C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx', T);
var wb = XLSX.readFile(T);
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var IX = A.indexar(R);
var jById = {}; cat.journeys.forEach(function (j) { jById[j.journey_id] = j; });

// ── índice de filas por llave (el segmento crudo entra tal cual: la pieza puede tenerlo en
//    segmento o en segmentos_combinados, y se prueban las dos)
var porK = {};
E.forEach(function (r, i) {
  r.__i = i;
  var camp = t(r['Campana_Canonica']);
  var segRaw = t(r['Segmento_Canonico']);
  var seg = (A.resolver(IX, 'Segmento', segRaw, camp, '').v) || segRaw;
  var tp = (A.resolver(IX, 'Touchpoint', t(r['Touchpoint']), camp, seg).v) || t(r['Touchpoint']);
  [seg, segRaw].forEach(function (s) {
    var k = [camp, tp, s, t(r['Email_Type']), assetDe(r['Email_Content_Name'])].join('¦');
    (porK[k] = porK[k] || []).push(r);
  });
});

var st = { exacta: 0, declarada: 0, journey: 0, nada: 0, multiQ: 0, multiM: 0, descuadre: [], cnAgregados: 0 };
var dueno = {};

cat.piezas.forEach(function (p) {
  var k1 = [p.campana, p.nombre_pieza, p.segmento, p.email_type, t(p.asset_id)].join('¦');
  var k2 = [p.campana, p.nombre_pieza, t(p.segmentos_combinados), p.email_type, t(p.asset_id)].join('¦');
  var filas = porK[k1] || (t(p.segmentos_combinados) ? porK[k2] : null) || [];
  filas = filas.filter(function (r, i, a) { return a.indexOf(r) === i; });
  filas.forEach(function (r) { (dueno[r.__i] = dueno[r.__i] || []).push(p.pieza_id); });

  // ── content_names COMPLETO (esto listaba solo 1 de 3 en 10 piezas)
  var cnPrev = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  var cnTodos = {}; cnPrev.forEach(function (c) { cnTodos[c] = 1; });
  filas.forEach(function (r) { if (!cnTodos[t(r['Email_Content_Name'])]) { cnTodos[t(r['Email_Content_Name'])] = 1; st.cnAgregados++; } });
  var cns = Object.keys(cnTodos);
  if (cns.length) { p.content_name = cns[0]; p.content_names = cns.join(' ; '); p.n_content_names = cns.length; }

  // ── periodos y reparto, fila por fila
  var porQ = {}, porM = {}, dias = [], usoDeclarada = false;
  filas.forEach(function (r) {
    var s = num(r['Email_Sends']);
    var d = r['Send_Date'] ? iso(r['Send_Date']) : '';
    var q = d ? Qz(d) : quincenaDeclarada(r['Send_Quincena']);
    if (d) dias.push(d); else if (q) usoDeclarada = true;
    if (!q) return;
    porQ[q] = (porQ[q] || 0) + s;
    porM[q.slice(0, 7)] = (porM[q.slice(0, 7)] || 0) + s;
  });
  dias.sort();
  var qs = Object.keys(porQ).sort(), ms = Object.keys(porM).sort();

  // ── LA ESCALERA DE LA FECHA: día exacto → quincena declarada → journey → nada
  if (dias.length) { p.fecha_primer_envio = dias[0]; p.fecha_ultimo_envio = dias[dias.length - 1]; p.fecha_origen = 'Data_Email · Send_Date exacto · ' + dias.length + ' envío(s)'; st.exacta++; }
  else if (qs.length) { p.fecha_primer_envio = ''; p.fecha_ultimo_envio = ''; p.fecha_origen = 'Data_Email · Send_Quincena declarada (' + qs.join(' + ') + ') · la fuente no trae el día'; st.declarada++; }
  else {
    var j = jById[p.journey_id] || {};
    if (t(j.fecha_primer_envio)) {
      p.fecha_primer_envio = t(j.fecha_primer_envio); p.fecha_ultimo_envio = '';
      p.fecha_origen = 'journey ' + p.journey_id + ' · la pieza no tiene filas en Data_Email';
      st.journey++;
      qs = [Qz(p.fecha_primer_envio)]; ms = [p.fecha_primer_envio.slice(0, 7)];
      porQ[qs[0]] = num(p.sends); porM[ms[0]] = num(p.sends);
    } else { p.fecha_primer_envio = ''; p.fecha_ultimo_envio = ''; p.fecha_origen = 'sin fecha ni quincena en ninguna fuente · ' + t(p.estado); st.nada++; }
  }

  p.quincena_lanzamiento = qs[0] || '';
  p.mes_lanzamiento = ms[0] || '';
  p.quincenas_activas = qs.join(' ; ');
  p.meses_activos = ms.join(' ; ');
  p.n_quincenas = qs.length; p.n_meses = ms.length; p.n_envios_fechados = dias.length;
  p.sends_por_quincena = qs.map(function (q) { return q + ':' + porQ[q]; }).join(' ; ');
  p.sends_por_mes = ms.map(function (m) { return m + ':' + porM[m]; }).join(' ; ');
  var sumQ = qs.reduce(function (a, q) { return a + porQ[q]; }, 0);
  if (qs.length && sumQ !== num(p.sends)) st.descuadre.push(p.pieza_id + ' ' + sumQ.toLocaleString() + '≠' + num(p.sends).toLocaleString());
  if (qs.length > 1) st.multiQ++;
  if (ms.length > 1) st.multiM++;
  p.mes_atribucion = p.mes_lanzamiento;         // compatibilidad con lo ya escrito
  p.quincena_atribucion = p.quincena_lanzamiento;
  if (usoDeclarada && !dias.length) p.fuente_dato = t(p.fuente_dato).replace(/\s*·\s*quincena declarada$/, '') + ' · quincena declarada';
});

// ── el Estado no puede decir "sin fecha" si la quincena SÍ estaba
var recl = [];
cat.piezas.forEach(function (p) {
  if (t(p.estado) === 'Sin fecha en la fuente' && t(p.quincena_lanzamiento)) {
    p.estado = 'Confirmado';
    p.notas = t(p.notas).replace(/Data_Email no trae Send_Date[^·]*/, '').replace(/^\s*·\s*/, '').trim();
    p.notas = (p.notas ? p.notas + ' · ' : '') + 'sin día exacto en la fuente: se atribuye por Send_Quincena (' + p.quincena_lanzamiento + ')';
    recl.push(p.pieza_id + ' → Confirmado, anclada a ' + p.quincena_lanzamiento);
  }
});

var huerfanas = E.filter(function (r) { return !dueno[r.__i]; });
var compartidas = Object.keys(dueno).filter(function (i) { return dueno[i].length > 1; });

console.log('══ FECHAS Y PERIODOS · complemento ══');
console.log('  origen de la fecha:  día exacto ' + st.exacta + ' · quincena declarada ' + st.declarada + ' · del journey ' + st.journey + ' · sin nada ' + st.nada);
console.log('  🔴 piezas en MÁS DE UNA quincena: ' + st.multiQ + '  ·  en más de un MES: ' + st.multiM);
console.log('  content_names que faltaban y se agregaron: ' + st.cnAgregados);
console.log('');
console.log('  ✔ reparto Σ == Sends            : ' + (st.descuadre.length ? '🔴 ' + st.descuadre.length + ': ' + st.descuadre.slice(0, 4).join(' · ') : 'cuadra en las ' + cat.piezas.filter(function (p) { return t(p.sends_por_quincena); }).length));
console.log('  ✔ filas de Data_Email sin dueña : ' + (huerfanas.length ? '🔴 ' + huerfanas.length : '0 de ' + E.length));
console.log('  ✔ filas en DOS piezas           : ' + (compartidas.length ? '🔴 ' + compartidas.length : '0 — ningún envío se cuenta dos veces'));
if (recl.length) { console.log('\n  reclasificadas (la quincena SÍ estaba en la fuente):'); recl.forEach(function (x) { console.log('    ✔ ' + x); }); }
console.log('\n  ejemplos multi-quincena:');
cat.piezas.filter(function (p) { return p.n_quincenas > 1; }).slice(0, 5).forEach(function (p) {
  console.log('    ' + p.pieza_id + '  ' + p.campana.padEnd(15) + p.nombre_pieza.padEnd(6) + 'lanzó ' + p.quincena_lanzamiento);
  console.log('       activa en ' + p.quincenas_activas + '   reparto: ' + p.sends_por_quincena);
});
console.log('\n  sin periodo: ' + cat.piezas.filter(function (p) { return !t(p.quincena_lanzamiento); }).length + ' → ' +
  Object.keys(cat.piezas.filter(function (p) { return !t(p.quincena_lanzamiento); }).reduce(function (a, p) { a[t(p.estado)] = (a[t(p.estado)] || 0) + 1; return a; }, {})).join(' · '));

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado');
