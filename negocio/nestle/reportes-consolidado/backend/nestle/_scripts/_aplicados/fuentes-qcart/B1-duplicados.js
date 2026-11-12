// B1 · DUPLICADOS FUERA, EN TODAS LAS HOJAS — con una llave DECLARADA por hoja.
//
// 🔴 «Nada de duplicados, en ninguna hoja» (Rick). No hay una llave universal: cada hoja tiene su
//    identidad. Un evento de Qcart es fecha-hora + shortlink + tienda + producto; una pieza de
//    WhatsApp es su pieza_id; un envío de email es su pieza. Una llave genérica o cuenta de más
//    (junta cosas distintas) o de menos (deja pasar copias). Por eso se declara hoja por hoja.
//
// 🔴 Y NO SE BORRA A CIEGAS: cada duplicado se muestra con sus dos filas y cuál se conserva. Las
//    hojas de Qcart NO se tocan aquí —las reescribe B3 desde el bloque ya limpio—; este paso
//    apunta bajas solo en las hojas que no se reescriben (WhatsApp).
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };

// la llave de cada hoja, por NOMBRE de columna. La que reescribe B3 se marca reescrita:true.
var LLAVES = {
  'Data_Email':           { cols: ['pieza_id'],                                              reescrita: true  }, // C2 la reconstruye a 98
  // 🔴 WhatsApp NO se llavea solo por pieza_id: un envío es pieza + touchpoint. Con [pieza_id]
  //    salían «duplicados» que eran dos envíos distintos (WA-P2 y WA-P3, con read-rate y CTOR
  //    propios). El defecto real es otro y lo levanta B1c: un pieza_id repetido entre touchpoints.
  'Data_WhatsApp':        { cols: ['pieza_id', 'Touchpoint'],                                 reescrita: false },
  'Data_Qcart_Carritos':  { cols: ['fecha', 'hora', 'shortlink_code', 'store', 'utm_content'], reescrita: true },
  'Data_Qcart_Productos': { cols: ['fecha', 'hora', 'shortlink_code', 'store', 'product'],     reescrita: true },
  'Catalogo_Piezas':      { cols: ['Pieza_ID'],                                              reescrita: false },
  // 🔴 Referencias NO tiene una llave simple: mezcla dos formas. `vocabulario` se distingue por
  //    Valor_Canonico (el Crudo va vacío); `alias` es la ESCALERA por campaña — el mismo `E-P1`
  //    resuelve distinto en AON, Hotcakes y Liga MX, y lo que los separa es `Contexto`. Sin
  //    Contexto+Canonico en la llave, 20 filas legítimas parecían duplicados. Cada una es un
  //    hecho distinto: mi primera llave contaba de menos.
  'Catalogo_Referencias': { cols: ['Tipo', 'Dimension', 'Valor_Crudo', 'Valor_Canonico', 'Contexto'], reescrita: false }
};

console.log('════════ B1 · DUPLICADOS EN TODAS LAS HOJAS ════════\n');
var F0 = os.homedir() + '/_b1.xlsx';
fs.copyFileSync(L.archivoVivo({ dir: PROY }).ruta, F0);
var wb = XLSX.readFile(F0);

var hallados = {};
Object.keys(LLAVES).forEach(function (hoja) {
  var sh = wb.Sheets[hoja];
  if (!sh) { console.log('   ⊘ ' + hoja + ' no existe'); return; }
  var def = LLAVES[hoja];
  var enc = XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || [];
  var faltan = def.cols.filter(function (c) { return enc.map(t).indexOf(c) < 0; });
  if (faltan.length) { console.log('   ⚠ ' + hoja.padEnd(22) + 'no tiene la(s) columna(s) ' + faltan.join(', ') + ' → se salta'); return; }
  var F = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  var grupos = {};
  F.forEach(function (r, i) {
    var esTotales = /total/i.test(t(r[enc[0]])) && def.cols.every(function (c) { return !t(r[c]); });
    if (esTotales) return;
    var llave = def.cols.map(function (c) { return t(r[c]); }).join('¦');
    if (!llave.replace(/¦/g, '')) return; // fila vacía en la llave
    (grupos[llave] = grupos[llave] || []).push({ fila: i + 2, r: r });
  });
  var dups = Object.keys(grupos).filter(function (k) { return grupos[k].length > 1; });
  console.log('   ' + (dups.length ? '🔴' : '✔') + ' ' + hoja.padEnd(22) + F.length + ' filas · llave [' + def.cols.join('+') + ']' +
    (def.reescrita ? ' (la reescribe B3)' : '') + '   duplicados: ' + dups.length);
  if (dups.length) {
    hallados[hoja] = { def: def, dups: dups.map(function (k) { return grupos[k]; }) };
    dups.slice(0, 5).forEach(function (k) {
      var g = grupos[k];
      console.log('        llave «' + k.slice(0, 46) + '»  filas ' + g.map(function (x) { return x.fila; }).join(', ') +
        '  → conserva ' + g[0].fila + ', quita ' + g.slice(1).map(function (x) { return x.fila; }).join(', '));
    });
  }
});

fs.writeFileSync(BACK + '/_fuentes/duplicados-hallados.json', JSON.stringify({
  paso: 'B1', cuando: '2026-08-21',
  regla: 'llave declarada por hoja; se conserva la PRIMERA aparición; las hojas de Qcart no se tocan aquí, las reescribe B3',
  hojas: Object.keys(hallados).map(function (h) {
    return { hoja: h, llave: hallados[h].def.cols, reescrita: hallados[h].def.reescrita,
      grupos: hallados[h].dups.map(function (g) { return { conserva: g[0].fila, quita: g.slice(1).map(function (x) { return x.fila; }) }; }) };
  })
}, null, 1));

console.log('\n  → _fuentes/duplicados-hallados.json');
console.log('\n  ⚠ este paso solo REPORTA. Las bajas de WhatsApp las apunta B1b tras tu confirmación visual;');
console.log('    las de Qcart desaparecen solas cuando B3 reescribe desde el bloque limpio.');
