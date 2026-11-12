// ÚLTIMO PELDAÑO DE LA ESCALERA DE FECHAS + granularidad explícita.
//
// 🔴 VOLVÍ A CAER EN LO MISMO que Rick me señaló con Send_Quincena: 7 piezas citan su mes en
//    Fuente_Qcart ("Qcart-Links… · Julio · f13") y yo las declaré "sin fecha en ninguna fuente".
//    La hoja del documento maestro ES un mes. El dato estaba escrito, en una columna que yo
//    mismo llené.
//
// 🔴 Y LA LECCIÓN MÁS ÚTIL: no basta con tener el periodo, hay que decir CON QUÉ PRECISIÓN.
//    Una hoja "Julio" da el mes, NO la quincena — inventar Q1 sería fabricar precisión.
//    Por eso entra Granularidad_Periodo: dia · quincena · mes · ninguna. Así N3 sabe qué
//    filas puede abrir por quincena y cuáles solo por mes, en vez de suponerlo.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));

var MES = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };
// "Qcart-Links Mails-Hive- MX.xlsx · Julio · f13" → "2026-07"
function mesDeFuente(s) {
  var partes = t(s).split(/\s*·\s*/);
  for (var i = 0; i < partes.length; i++) {
    var k = partes[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    for (var m in MES) if (m.normalize('NFD').replace(/[̀-ͯ]/g, '') === k) return '2026-' + MES[m];
  }
  return '';
}

var recuperadas = [], sinNada = [];
cat.piezas.forEach(function (p) {
  // granularidad de lo que YA tiene
  if (t(p.fecha_primer_envio)) p.granularidad_periodo = 'dia';
  else if (t(p.quincena_lanzamiento)) p.granularidad_periodo = 'quincena';
  else if (t(p.mes_lanzamiento)) p.granularidad_periodo = 'mes';
  else p.granularidad_periodo = '';

  if (t(p.mes_lanzamiento)) return;                       // ya tiene periodo: no se toca

  // ── PELDAÑO NUEVO: la hoja del documento maestro es un mes
  var mes = mesDeFuente(p.fuente_qcart);
  if (mes) {
    p.mes_lanzamiento = mes;
    p.meses_activos = mes;
    p.n_meses = 1;
    p.quincena_lanzamiento = '';                          // 🔴 una hoja de mes NO dice la quincena
    p.quincenas_activas = ''; p.n_quincenas = 0;
    p.granularidad_periodo = 'mes';
    p.mes_atribucion = mes;
    p.sends_por_mes = num(p.sends) ? mes + ':' + num(p.sends) : '';
    p.sends_por_quincena = '';
    p.fecha_origen = 'documento maestro · la hoja "' + t(p.fuente_qcart).split(/\s*·\s*/)[1] + '" es el mes · sin día ni quincena';
    recuperadas.push({ id: p.pieza_id, camp: p.campana, tp: p.nombre_pieza, mes: mes, carr: num(p.carritos_total) });
  } else {
    p.granularidad_periodo = 'ninguna';
    sinNada.push({ id: p.pieza_id, camp: p.campana, tp: p.nombre_pieza, carr: num(p.carritos_total), estado: t(p.estado) });
  }
});

console.log('══ PELDAÑO NUEVO · la hoja del maestro es un mes ══');
console.log('  piezas recuperadas: ' + recuperadas.length);
recuperadas.forEach(function (x) {
  console.log('    ✔ ' + x.id + '  ' + x.camp.padEnd(10) + x.tp.padEnd(7) + '→ ' + x.mes + (x.carr ? '   (' + x.carr + ' carritos que se perdían)' : ''));
});
console.log('  carritos recuperados: ' + recuperadas.reduce(function (a, x) { return a + x.carr; }, 0));
console.log('\n  siguen sin periodo: ' + sinNada.length + '  — y es honesto, no citan ninguna fuente con fecha:');
sinNada.forEach(function (x) { console.log('    · ' + x.id + '  ' + x.camp.padEnd(10) + x.tp.padEnd(7) + x.estado + (x.carr ? '  ' + x.carr + ' carritos' : '  0 carritos')); });

console.log('\n══ granularidad del periodo (lo que N3 puede abrir de verdad) ══');
var g = {};
cat.piezas.forEach(function (p) { var k = p.granularidad_periodo || 'ninguna'; g[k] = (g[k] || 0) + 1; });
['dia', 'quincena', 'mes', 'ninguna'].forEach(function (k) {
  if (g[k]) console.log('    ' + String(g[k]).padStart(3) + '  ' + k.padEnd(10) +
    (k === 'dia' ? '→ se puede abrir por quincena y por mes'
      : k === 'quincena' ? '→ por quincena y por mes'
        : k === 'mes' ? '→ SOLO por mes. Abrirla por quincena sería inventar precisión'
          : '→ no entra en ninguna rejilla de periodo; va declarada en su Estado'));
});

fs.writeFileSync(os.homedir() + '/_P5.json', JSON.stringify(cat, null, 1));
console.log('\n  → catálogo actualizado');
