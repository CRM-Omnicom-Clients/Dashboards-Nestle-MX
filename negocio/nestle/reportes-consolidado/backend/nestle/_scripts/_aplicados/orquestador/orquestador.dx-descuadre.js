// ¿Por qué la suma por quincena no da los Sends de la pieza? Antes de "arreglarlo", entenderlo.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(String(v).replace(/[, ]/g, '')); return isFinite(x) ? x : 0; };
var cat = JSON.parse(fs.readFileSync(os.homedir() + '/_P5.json', 'utf8'));
var wb = XLSX.readFile(os.homedir() + '/_fc.xlsx');
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });

var mal = cat.piezas.filter(function (p) {
  var s = t(p.sends_por_quincena).split(' ; ').reduce(function (a, x) { return a + num(x.split(':')[1]); }, 0);
  return t(p.sends_por_quincena) && s !== num(p.sends);
});
console.log('══ piezas donde Σ(reparto) ≠ Sends: ' + mal.length + ' ══\n');
mal.slice(0, 4).forEach(function (p) {
  var cn = [t(p.content_name)].concat(t(p.content_names || '').split(/\s*;\s*/)).filter(Boolean);
  var filas = E.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) >= 0; });
  var sumFilas = filas.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
  console.log('  ' + p.pieza_id + '  ' + p.campana + ' / ' + p.nombre_pieza + ' / ' + p.segmento + ' / ' + p.email_type);
  console.log('     Sends en la pieza      : ' + num(p.sends).toLocaleString());
  console.log('     Σ de sus filas de email: ' + sumFilas.toLocaleString() + '   (' + filas.length + ' fila(s) por content_name)');
  console.log('     content_names          : ' + cn.join(' | ').slice(0, 100));
  filas.slice(0, 3).forEach(function (r) {
    console.log('       · sends=' + String(num(r['Email_Sends'])).padStart(7) + '  tp=' + t(r['Touchpoint']).padEnd(8) +
      ' seg=' + t(r['Segmento_Canonico']).slice(0, 22).padEnd(24) + ' type=' + t(r['Email_Type']));
  });
  // ¿hay OTRAS piezas con el mismo content_name? entonces las filas se reparten entre ellas
  var hermanas = cat.piezas.filter(function (q) {
    if (q.pieza_id === p.pieza_id) return false;
    var qcn = [t(q.content_name)].concat(t(q.content_names || '').split(/\s*;\s*/)).filter(Boolean);
    return qcn.some(function (x) { return cn.indexOf(x) >= 0; });
  });
  console.log('     piezas que COMPARTEN content_name: ' + hermanas.length +
    (hermanas.length ? ' → ' + hermanas.map(function (q) { return q.pieza_id + '(' + q.segmento.slice(0, 14) + '/' + q.email_type + ' ' + num(q.sends).toLocaleString() + ')'; }).join(' ') : ''));
  console.log('     Σ de la pieza + hermanas: ' + (num(p.sends) + hermanas.reduce(function (a, q) { return a + num(q.sends); }, 0)).toLocaleString() +
    '   vs Σ filas ' + sumFilas.toLocaleString());
  console.log('');
});

// ¿el total global sigue cuadrando? (Z-final dice que sí)
var totPieza = cat.piezas.reduce(function (a, p) { return a + num(p.sends); }, 0);
var totEmail = E.reduce(function (a, r) { return a + num(r['Email_Sends']); }, 0);
console.log('══ el TOTAL sí cuadra: piezas ' + totPieza.toLocaleString() + ' vs Data_Email+WA ══');
console.log('   Data_Email solo: ' + totEmail.toLocaleString());
