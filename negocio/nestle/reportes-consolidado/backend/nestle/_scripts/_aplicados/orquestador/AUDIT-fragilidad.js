// AUDITOR DE FRAGILIDAD — ¿qué se rompe cuando entra data nueva?
//
// La preocupación de Rick: los agentes y guardianes viejos tenían mucho determinismo que se
// rompía cada vez que llegaba algo nuevo. El sistema tiene que ser **flexible para entender
// datos nuevos y estricto en el objetivo**. Este script busca lo contrario: lo que está clavado.
//
// No opina: cuenta ocurrencias y cada patrón declara QUÉ lo rompe. Un hallazgo sin eso es
// una opinión.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var DIR = os.homedir() + '/.claude/reportes-backend/nestle/_scripts';

// Se busca por SUBCADENA o por función, nunca por regex barroco: un auditor que se rompe solo
// no tiene autoridad para señalar fragilidad ajena.
var MESES = ['marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'enero', 'febrero'];
var PATRONES = [
  { id: 'meses-clavados', grave: 3, rompe: 'un mes que no está en la lista (septiembre)',
    test: function (l) { return MESES.some(function (m) { return l.toLowerCase().indexOf(m + ':') >= 0 || l.toLowerCase().indexOf(m + "':") >= 0; }); } },
  { id: 'total-esperado', grave: 3, rompe: 'cualquier carga nueva de datos',
    test: function (l) { return l.indexOf('6454554') >= 0 || l.indexOf('6,454,554') >= 0; } },
  { id: 'archivo-versionado', grave: 3, rompe: 'que Rick guarde una v9',
    test: function (l) { return l.indexOf('Nestle-2026-v') >= 0; } },
  { id: 'conteo-esperado', grave: 2, rompe: 'que entren envíos o piezas nuevas',
    test: function (l) {
      return ['264', '265', '96', '119', '1142'].some(function (n) {
        return l.indexOf('=== ' + n) >= 0 || l.indexOf('===' + n) >= 0 || l.indexOf('length === ' + n) >= 0;
      });
    } },
  { id: 'id-de-pieza-clavado', grave: 2, rompe: 'que se renumere el catálogo',
    test: function (l) { return /00\d-P0\d\d/.test(l); } },
  { id: 'asset-concreto', grave: 2, rompe: 'una campaña distinta a la de hoy',
    test: function (l) { return ['863587', '803867', '982527', '948858', '865439'].some(function (a) { return l.indexOf(a) >= 0; }); } },
  { id: 'umbral-calibrado', grave: 2, rompe: 'content_names más largos o con otra estructura',
    test: function (l) { return l.indexOf('COLA =') >= 0 || l.indexOf('COLA=') >= 0; } },
  // ⚠ `var MET = []` seguido de un push NO es una lista fija: es el mapa que se construye desde
  //   la fuente. Solo cuenta si la lista trae los nombres escritos dentro.
  { id: 'lista-fija-de-metricas', grave: 2, rompe: 'una métrica nueva en la fuente',
    test: function (l) { return /var MET\s*=\s*\[\s*['"]/.test(l); } },
  { id: 'nombre-de-hoja-literal', grave: 1, rompe: 'que renombren una hoja',
    test: function (l) { return l.indexOf("Sheets['") >= 0; } },
  { id: 'ruta-absoluta', grave: 1, rompe: 'que muevan la carpeta del proyecto',
    test: function (l) { return l.indexOf('C:/Users/') >= 0 || l.indexOf('C:' + String.fromCharCode(92)) >= 0; } }
];

// 🔴 Tres clases, y mezclarlas da una cifra que no significa nada:
//    META      los que BUSCAN los patrones (este auditor, el migrador, lib-flexible). Se
//              detectan a sí mismos: contarlos infla el número y enseña a ignorarlo.
//    ARCHIVADO diagnósticos de una sesión concreta (Z-*, P#-*). No corren en el ciclo, y
//              migrarlos les quitaría el sentido de lo que midieron ese día.
//    VIVO      los que corren en cada corte. **Los únicos que cuentan.**
function clase(f) {
  if (/^(AUDIT|MIGRAR|marcar-)/.test(f) || f === 'lib-flexible.js') return 'META';
  if (/^(Z-|P\d)/.test(f)) return 'ARCHIVADO';
  // un registro documental (un defecto con sus cifras del día) NO es lógica que caduque:
  // sus números describen un hallazgo fechado, igual que una nota de bitácora
  if (/^registrar-/.test(f)) return 'ARCHIVADO';
  // los ya marcados como superados no corren: su fragilidad es irrelevante
  try {
    if (fs.readFileSync(path.join(DIR, f), 'utf8').indexOf('SUPERADO_POR') >= 0) return 'ARCHIVADO';
  } catch (e) { }
  return 'VIVO';
}
var TODOS = fs.readdirSync(DIR).filter(function (f) { return f.slice(-3) === '.js'; });
var archivos = TODOS.filter(function (f) { return clase(f) === 'VIVO'; });
var res = {}, porArchivo = {};
archivos.forEach(function (f) {
  fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/).forEach(function (linea, i) {
    var s = linea.trim();
    if (s.indexOf('//') === 0 || s.indexOf('*') === 0) return;    // un comentario no rompe nada
    // 🔴 ni el texto que se IMPRIME: `console.log('piezas activas en julio')` no es lógica de
    //    mes, es una etiqueta. Contarlo era el falso positivo que enseña a ignorar la herramienta.
    if (/^console\.log\(/.test(s)) return;
    PATRONES.forEach(function (p) {
      if (!p.test(linea)) return;
      res[p.id] = res[p.id] || { p: p, hits: [] };
      res[p.id].hits.push({ f: f, l: i + 1, txt: s.slice(0, 74) });
      porArchivo[f] = (porArchivo[f] || 0) + p.grave;
    });
  });
});

console.log('════════ AUDITORÍA DE FRAGILIDAD ════════');
console.log('  ' + archivos.length + ' scripts VIVOS de ' + TODOS.length + ' · ¿qué se rompe cuando entra data nueva?');
console.log('  (excluidos: ' + TODOS.filter(function (f) { return clase(f) === 'ARCHIVADO'; }).length + ' diagnósticos archivados · ' +
  TODOS.filter(function (f) { return clase(f) === 'META'; }).length + ' que buscan estos patrones y se detectan a sí mismos)\n');
Object.keys(res).sort(function (a, b) { return res[b].p.grave - res[a].p.grave || res[b].hits.length - res[a].hits.length; })
  .forEach(function (k) {
    var r = res[k];
    console.log('  ' + (r.p.grave === 3 ? '🔴' : r.p.grave === 2 ? '⚠ ' : '· ') + ' ' + k.padEnd(24) + String(r.hits.length).padStart(3) + ' sitios  → lo rompe: ' + r.p.rompe);
    r.hits.slice(0, 3).forEach(function (h) { console.log('        ' + (h.f + ':' + h.l).padEnd(30) + h.txt); });
    if (r.hits.length > 3) console.log('        … y ' + (r.hits.length - 3) + ' más');
  });

console.log('\n  ── los scripts que MÁS se romperían (peso = ocurrencias × gravedad)');
Object.keys(porArchivo).sort(function (a, b) { return porArchivo[b] - porArchivo[a]; }).slice(0, 10)
  .forEach(function (f) { console.log('     ' + String(porArchivo[f]).padStart(3) + '  ' + f); });

var criticos = Object.keys(res).filter(function (k) { return res[k].p.grave === 3; })
  .reduce(function (a, k) { return a + res[k].hits.length; }, 0);
console.log('\n  ' + (criticos ? '🔴 ' + criticos + ' sitios de gravedad ALTA: se rompen con el próximo corte' : '✅ nada crítico'));
