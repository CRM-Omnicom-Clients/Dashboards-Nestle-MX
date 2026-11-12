// E8 · LOS ALIAS QUE FALTABAN — declarados, no inferidos.
//
// 🔴 QUÉ LO DESTAPÓ: la corrida E2E completa. Al re-armar el bloque de WhatsApp desde la fuente,
//    3 envíos se quedaron sin pieza y la Puerta 1 cerró. La causa no era el paso: era vocabulario
//    que nadie había declarado.
//
//      · la fuente dice `journey: "Segundo Partido"` y el catálogo `TouchPoint: "Partido 2"`
//      · la fuente dice `campana_raw: "ICE"` y el catálogo `Campaña: "The Freshers"`
//        (ICE es la MARCA — Nescafé ICE — y The Freshers la campaña; lo decidió Rick el 20-ago)
//
// 🔴 POR QUÉ SE DECLARAN Y NO SE ADIVINAN. La regla es «nada se infiere del naming». Un paso que
//    dedujera «Segundo Partido ≈ Partido 2» por parecido acertaría hoy y fallaría el día que
//    aparezca «Segundo Partido - Repechaje». El alias se escribe UNA vez, en la autoridad, y
//    entonces cualquier paso lo resuelve igual.
//
// 🔴 Y VAN A LA HOJA, que es la vista de la autoridad — el JSON se regenera de ella. Meterlos solo
//    en el JSON haría que el guardián de referencias bloqueara por divergencia, con razón.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

// los alias que la corrida E2E demostró que faltan
var NUEVOS = [
  { Tipo: 'alias', Dimension: 'Touchpoint', Valor_Crudo: 'Segundo Partido', Valor_Canonico: 'Partido 2',
    Contexto: 'Mundial', Fuente: 'declarado 24-ago',
    Notas: 'La fuente de WhatsApp nombra el journey «Segundo Partido»; el catálogo usa «Partido 2». Sin este alias el envío de 162 no encuentra su pieza (004-P010) y la Puerta 1 cierra.' },
  { Tipo: 'alias', Dimension: 'Touchpoint', Valor_Crudo: 'Tercer Partido', Valor_Canonico: 'Partido 3',
    Contexto: 'Mundial', Fuente: 'declarado 24-ago',
    Notas: 'Idem para 004-P013. Los dos envíos tienen los MISMOS sends (162), así que la cifra no los desambigua: solo el journey.' },
  { Tipo: 'alias', Dimension: 'Campaña', Valor_Crudo: 'ICE', Valor_Canonico: 'The Freshers',
    Contexto: '', Fuente: 'declarado 24-ago',
    Notas: 'La hoja de WhatsApp titula la campaña «ICE», pero ICE es la MARCA (Nescafé ICE) y The Freshers la campaña — lo decidió Rick el 20-ago. Sin el alias, sus 2,000 envíos quedan sin pieza.' }
];

console.log('════════ E8 · ALIAS FALTANTES ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('E8');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { header: 1 })[0] || []).map(t);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
console.log('  Catalogo_Referencias: ' + R.length + ' filas · ' + enc.length + ' columnas');

// 🔴 SE REGENERA LA HOJA, no se apuntan celdas sueltas. Z **no sabe crear filas**: apuntar a la
//    fila 267 de una hoja que tiene 266 hacía que el log dijera «escritas» y no llegara nada.
//    `regenerarHoja` escribe la hoja completa —las 265 que ya estaban, más las nuevas al final—
//    y por eso sí las crea.
var nuevas = NUEVOS.filter(function (n) {
  var ya = R.filter(function (r) {
    return t(r['Tipo']) === n.Tipo && t(r['Dimension']) === n.Dimension &&
      t(r['Valor_Crudo']) === n.Valor_Crudo && t(r['Contexto']) === n.Contexto;
  })[0];
  if (ya) console.log('   ○ ya existe: ' + n.Dimension + ' «' + n.Valor_Crudo + '»');
  return !ya;
});
nuevas.forEach(function (n) {
  console.log('   + ' + n.Dimension.padEnd(12) + '«' + n.Valor_Crudo + '»' + (n.Contexto ? ' @ ' + n.Contexto : '') + ' → «' + n.Valor_Canonico + '»');
});
if (!nuevas.length) { console.log('\n  nada que agregar.'); process.exit(0); }

// la hoja completa: lo que ya estaba + las nuevas, con las columnas de la hoja
var filas = R.map(function (r) {
  var o = {}; enc.forEach(function (c) { o[c] = r[c]; }); return o;
}).concat(nuevas.map(function (n) {
  var o = {}; enc.forEach(function (c) { o[c] = n[c] !== undefined ? n[c] : ''; }); return o;
}));
console.log('\n  la hoja pasa de ' + R.length + ' a ' + filas.length + ' filas');
if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
CB.regenerarHoja('E8', 'Catalogo_Referencias', filas,
  'E8 · se agregan ' + nuevas.length + ' alias que la corrida E2E demostro que faltaban. Sin ellos, 3 envios de WhatsApp (2 de Mundial y los 2,000 de ICE) se quedan sin pieza y la Puerta 1 cierra. Nada se infiere del naming: se declara en la autoridad.');
var res = CB.resumen();
console.log('\n  ── hoja regenerada con ' + filas.length + ' filas. Acumulado: ' + res.total + ' celdas · choques: ' + res.choques);
