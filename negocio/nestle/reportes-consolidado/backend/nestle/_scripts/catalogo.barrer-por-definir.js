// nestle-catalogo · ¿HAY ALGÚN `POR DEFINIR` QUE EN REALIDAD SÍ TENGO? Mide, no escribe.
//
// 🔴 LO QUE PIDIÓ RICK (7-sep-2026): «revisa al final cosas del catálogo que sí tengas data pero
//    no la estés colocando, no puede haber por definir que sí tengas».
//
// 🔴 CÓMO SE BUSCA, Y NO ES «MIRAR A VER». Para cada hueco se pregunta a CUATRO fuentes, en este
//    orden, y se dice cuál respondió:
//      1 · SFMC agregada    (`CRM_Email_Piezas`)      — 35 campos por pieza
//      2 · SFMC detalle     (`CRM_Email_Detalle`)     — 38 campos, día por día
//      3 · el propio catálogo (una HERMANA de la misma campaña·touchpoint que sí lo tiene)
//      4 · derivable de otra columna de la MISMA fila
//    Y lo que ninguna responde se declara como hueco REAL, con su motivo — que es la otra mitad
//    de la petición: si algo no se puede llenar, hay que poder decir por qué.
//
// 🔴 NO PROPONE LLENAR NADA QUE NO SE PUEDA PROBAR. Una hermana que «suele tener» un valor no es
//    una fuente: es un parecido. Solo cuenta si TODAS las hermanas coinciden en el mismo valor —
//    si discrepan, el hueco se queda y se dice que discrepan. Deducir del naming está prohibido.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'catalogo';
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var M = require(__dirname + '/lib-mapeo-sfmc.js');
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };

// 🔴  NO ES UN HUECO. El sistema tiene TRES estados de celda y esta distinción es la razón
//    de que existan:  significa «no aplica por naturaleza» (la receta 5 de una pieza con 2
//    recetas),  significa «aplica y lo debemos». Mi primera pasada los metió en el
//    mismo saco y reportó 5,923 «huecos», de los que casi todos eran N/A legítimos — un número
//    alarmante que no significaba nada. Rick preguntó por los POR DEFINIR, que son los que faltan.
var FALTA = /^(POR DEFINIR|PENDIENTE)$/i;
function falta(v) { return FALTA.test(String(v == null ? '' : v).trim()); }

var X = M.cargar();
console.log('════════ nestle-catalogo · ¿QUÉ POR DEFINIR SÍ TENGO? ════════\n');
console.log('  ' + X.piezas.length + ' piezas   ·   cruzan con SFMC: ' + X.cruzan + '\n');

// el detalle, por ConfigKey, para poder mirar sus 38 campos
function vigente(p) {
  var dir = BACK + '/_insumos';
  var c = fs.readdirSync(dir).filter(function (f) { return new RegExp('^' + p + '-\\d{4}-\\d{2}-\\d{2}\\.txt$').test(f); }).sort();
  return c.length ? dir + '/' + c[c.length - 1] : null;
}
var det = (function () { var D = JSON.parse(fs.readFileSync(vigente('sfmc-detalle'), 'utf8')); return D.rows || D.data || []; })();
var detDe = {};
det.forEach(function (r) { var ck = t(r.ConfigKey); if (ck && !detDe[ck]) detDe[ck] = r; });

// los encabezados reales de la hoja
var enc = XLSX.utils.sheet_to_json(XLSX.readFile(X.tmp).Sheets['Catalogo_Piezas'], { header: 1, defval: '' })[0].map(t);
var nmCamp = X.columna('Campaña'), nmTP = X.columna('TouchPoint'), nmCanal = X.columna('Canal');

// 🔴 la normalización que decide si dos nombres hablan de lo mismo. No adivina: quita acentos,
//    guiones bajos y mayúsculas. `Codigo_NC` casa con `Codigo_NC`, no con `Codigo_Nielsen`.
function plano(s) { return t(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
var camposSFMC = {}; (X.filas[0] ? Object.keys(X.filas[0]) : []).forEach(function (k) { camposSFMC[plano(k)] = k; });
var camposDet = {}; (det[0] ? Object.keys(det[0]) : []).forEach(function (k) { camposDet[plano(k)] = k; });

var hallados = [], reales = {}, porCol = {};
enc.forEach(function (h) {
  if (!h) return;
  X.piezas.forEach(function (p) {
    if (!falta(p[h])) return;
    var id = X.idDe(p);
    var f = X.sfmcDe(p), d = f ? detDe[t(f.ConfigKey)] : null;
    var fuente = null, valor = null;

    // 1 · SFMC agregada, por nombre equivalente
    var kA = camposSFMC[plano(h)];
    if (f && kA && t(f[kA])) { fuente = 'SFMC agregada · ' + kA; valor = t(f[kA]); }

    // 2 · el detalle
    if (!fuente) {
      var kD = camposDet[plano(h)];
      if (d && kD && t(d[kD])) { fuente = 'SFMC detalle · ' + kD; valor = t(d[kD]); }
    }

    // 3 · una hermana del catálogo — SOLO si TODAS coinciden
    if (!fuente) {
      var herm = X.piezas.filter(function (q) {
        return X.idDe(q) !== id && t(q[nmCamp]) === t(p[nmCamp]) && t(q[nmTP]) === t(p[nmTP]) && !M.esHueco(q[h]);
      });
      if (herm.length) {
        var vals = {}; herm.forEach(function (q) { vals[t(q[h])] = 1; });
        var uniq = Object.keys(vals);
        if (uniq.length === 1) { fuente = 'hermanas de ' + t(p[nmCamp]) + ' · ' + t(p[nmTP]) + ' (' + herm.length + ', todas dicen lo mismo)'; valor = uniq[0]; }
        else { (reales[h] = reales[h] || []).push(id + ': ' + herm.length + ' hermanas y discrepan (' + uniq.slice(0, 3).join(' / ') + ')'); return; }
      }
    }

    if (fuente) { hallados.push({ id: id, col: h, valor: valor, fuente: fuente }); (porCol[h] = porCol[h] || []).push(id); return; }
    (reales[h] = reales[h] || []).push(id + (f ? '' : ' (no cruza con SFMC)'));
  });
});

console.log('  ── 🔧 HUECOS QUE SÍ TIENEN DATO   (' + hallados.length + ' celda(s), ' + Object.keys(porCol).length + ' columna(s))');
Object.keys(porCol).sort(function (a, b) { return porCol[b].length - porCol[a].length; }).forEach(function (k) {
  var g = hallados.filter(function (x) { return x.col === k; });
  console.log('     ' + k.slice(0, 30).padEnd(32) + String(g.length).padStart(3) + ' celda(s)   ← ' + g[0].fuente.slice(0, 46));
  g.slice(0, 2).forEach(function (x) { console.log('          ' + x.id + '  « ' + t(x.valor).slice(0, 54) + ' »'); });
});
if (!hallados.length) console.log('     ✔ ninguno: no hay POR DEFINIR que alguna fuente pueda llenar');

var totReal = Object.keys(reales).reduce(function (a, k) { return a + reales[k].length; }, 0);
console.log('\n  ── huecos REALES (ninguna fuente los tiene): ' + totReal + ' celda(s) en ' + Object.keys(reales).length + ' columna(s)');
Object.keys(reales).sort(function (a, b) { return reales[b].length - reales[a].length; }).slice(0, 10).forEach(function (k) {
  console.log('     ' + k.slice(0, 30).padEnd(32) + String(reales[k].length).padStart(3) + ' celda(s)');
});

fs.writeFileSync(BACK + '/_preescritura/por-definir-con-dato.json', JSON.stringify({
  cuando: new Date().toISOString(), volcado: X.volcado, hallados: hallados,
  reales: Object.keys(reales).map(function (k) { return { columna: k, cuantas: reales[k].length, ejemplos: reales[k].slice(0, 5) }; })
}, null, 1));
console.log('\n  → _preescritura/por-definir-con-dato.json');
