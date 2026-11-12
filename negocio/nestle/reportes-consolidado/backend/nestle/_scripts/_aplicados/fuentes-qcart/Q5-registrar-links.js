// Q5 · REGISTRAR EN EL CATÁLOGO LOS LINKS QUE SÍ RESUELVEN.
//
// 🔴 SOLO LOS QUE RESUELVEN. Q4 mapeó 8 links a su pieza y dejó 37 sin ella — no porque falte
//    información del link, sino porque **la pieza no existe en el catálogo**: hay tráfico de
//    `crm-hive` (o sea, de un correo nuestro) con `utm_content = e-p1` de Antojo Infinito, y ese
//    envío no está ni en el catálogo ni en el config de SFMC. Eso no lo arregla este paso: se
//    declara, con su volumen, para que se corrija donde nace.
//
// 🔴 LA TIENDA DECIDE LA COLUMNA. `Cod_Walmart_N` o `Cod_Chedraui_N` según dónde ocurrió el
//    carrito. Un link que aparece en las dos ocupa un slot en cada una — no se elige una.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx'), AdmZip = require('adm-zip');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CX = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-celda-xml.js');
var R = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

var M = JSON.parse(fs.readFileSync(BACK + '/_insumos/qcart-links-mapeados.json', 'utf8'));
var vivo = L.archivoVivo({ dir: PROY });
var SECO = os.homedir() + '/_q5.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);
var enc = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0];
var h = R.abrir('catalogo', enc, { silencioso: true });
var N = function (k) { return h.n('catalogo.' + k); };
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });

console.log('════════ Q5 · REGISTRAR LINKS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
console.log('  resueltos por Q4: ' + M.resueltos.length + '   ·   sin pieza: ' + M.sin_pieza.length + '\n');

// por pieza, qué slots están libres
var porPieza = {};
M.resueltos.forEach(function (r) { (porPieza[r.pieza] = porPieza[r.pieza] || []).push(r); });
var escrituras = [], sinSlot = [];
Object.keys(porPieza).sort().forEach(function (id) {
  var idx = -1;
  P.forEach(function (p, i) { if (t(p[N('pieza_id')]) === id) idx = i; });
  if (idx < 0) { console.log('   🔴 ' + id + ' no está en el catálogo'); return; }
  var p = P[idx], fila = idx + 2;
  console.log('   ' + id + '  ' + t(p[N('campana')]) + ' · ' + t(p[N('touchpoint')]) + '  (fila ' + fila + ')');
  porPieza[id].forEach(function (r) {
    (r.tiendas.length ? r.tiendas : ['walmart-com-mx']).forEach(function (tienda) {
      var pre = /chedraui/i.test(tienda) ? 'Cod_Chedraui_' : 'Cod_Walmart_';
      // primer slot libre, sin pisar nada
      var slot = 0;
      for (var s = 1; s <= 5; s++) {
        var col = pre + s, val = t(p[col]);
        if (!val) { slot = s; break; }
        if (val.toLowerCase().indexOf(r.cod.toLowerCase()) >= 0) { slot = -1; break; }   // ya está
      }
      if (slot === -1) { console.log('      ○ ' + r.cod + ' ya estaba en ' + pre + ' · ' + tienda); return; }
      // 🔴 SIN SLOT LIBRE NO SE PIERDE EL LINK: SE ANEXA AL ÚLTIMO. El catálogo tiene 4 slots de
      //    receta por pieza y estas piezas de Liga MX ya los tienen llenos — pero `codigosDe()`
      //    parte el valor por `;` y `,`, así que **un slot admite varios códigos**. Agregar una
      //    columna `_5` cambiaría la forma de la hoja a media corrida; anexar no. El lector ya lo
      //    soporta, y por eso esto no es un parche: es cómo estaba diseñado.
      if (!slot) {
        var ult = pre + '4';
        if (enc.indexOf(ult) < 0) { sinSlot.push({ pieza: id, cod: r.cod, pre: pre }); console.log('      🔴 ' + r.cod + ': no existe ' + ult); return; }
        var actual = t(p[ult]);
        escrituras.push({ fila: fila, col: ult, valor: actual + '; ' + r.cod, cod: r.cod, pieza: id, anexado: true });
        p[ult] = actual + '; ' + r.cod;
        console.log('      ✔ ' + r.cod.padEnd(10) + '→ ' + ult.padEnd(16) + r.nombre.slice(0, 30) + '   (anexado, el slot admite varios)');
        return;
      }
      // 🔴 y el slot tiene que EXISTIR como columna: el catálogo llega hasta el 4, no hasta el 5.
      if (enc.indexOf(pre + slot) < 0) {
        var ult2 = pre + '4';
        var act2 = t(p[ult2]);
        escrituras.push({ fila: fila, col: ult2, valor: act2 + '; ' + r.cod, cod: r.cod, pieza: id, anexado: true });
        p[ult2] = act2 + '; ' + r.cod;
        console.log('      ✔ ' + r.cod.padEnd(10) + '→ ' + ult2.padEnd(16) + r.nombre.slice(0, 30) + '   (no existe ' + pre + slot + '; anexado)');
        return;
      }
      // el nombre de la receta va en su columna gemela
      escrituras.push({ fila: fila, col: pre + slot, valor: r.cod, cod: r.cod, pieza: id });
      var rec = 'Receta_' + slot;
      if (enc.indexOf(rec) >= 0 && !t(p[rec]) && r.nombre) escrituras.push({ fila: fila, col: rec, valor: r.nombre, cod: r.cod, pieza: id });
      console.log('      ✔ ' + r.cod.padEnd(10) + '→ ' + (pre + slot).padEnd(16) + r.nombre.slice(0, 34) + '   ' + tienda + '  ' + r.eventos + ' ev');
      p[pre + slot] = r.cod;   // para que el siguiente link no reutilice el slot
      if (enc.indexOf(rec) >= 0 && !t(p[rec])) p[rec] = r.nombre;
    });
  });
});

console.log('\n══ 🔴 los 37 que NO resuelven: el envío existe pero la pieza no ══');
var porCamp = {};
M.sin_pieza.forEach(function (s) {
  var k = t(s.utm_campaign);
  porCamp[k] = porCamp[k] || { links: 0, ev: 0, tps: {} };
  porCamp[k].links++; porCamp[k].ev += s.eventos;
  (s.utm_content || []).forEach(function (c) { porCamp[k].tps[c] = 1; });
});
Object.keys(porCamp).sort(function (a, b) { return porCamp[b].ev - porCamp[a].ev; }).forEach(function (k) {
  var g = porCamp[k];
  console.log('   ' + k.padEnd(26) + String(g.links).padStart(3) + ' links · ' + mil(g.ev).padStart(5) + ' ev   touchpoints: ' + Object.keys(g.tps).join(' · '));
});
console.log('\n   Estas piezas tienen tráfico de `crm-hive` —o sea, salieron de un correo nuestro—');
console.log('   pero no están en el catálogo NI en `CRM_Reporte_Config`. Se corrige en SFMC, no aquí.');

console.log('\n  a escribir: ' + escrituras.length + ' celda(s)' + (sinSlot.length ? '   ·   🔴 ' + sinSlot.length + ' sin slot' : ''));
if (!ESCRIBIR || !escrituras.length) { console.log('\n  (seco. Para aplicar: --escribir)'); process.exit(0); }

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parte = null;
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { if (n === 'Catalogo_Piezas') parte = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });
var xml = zip.readAsText(parte);
var idx = {}; enc.forEach(function (n, i) { if (t(n)) idx[t(n)] = i; });
escrituras.forEach(function (e) {
  var i = idx[e.col];
  if (i === undefined) { console.log('   🔴 no existe la columna ' + e.col); return; }
  var ref = R.letra(i) + e.fila;
  xml = CX.poner(xml, ref, CX.celda(ref, e.valor, CX.estiloDe(xml, ref) || CX.estiloDe(xml, R.letra(i) + '2')), e.fila).xml;
});
zip.updateFile(parte, Buffer.from(xml, 'utf8'));
zip.writeZip(SECO);
console.log('\n  ── safe-save: ' + (safeSave(SECO, SECO).validado || '?'));
var V = XLSX.utils.sheet_to_json(XLSX.readFile(SECO).Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
var puestos = escrituras.filter(function (e) {
  var p = V.filter(function (q) { return t(q[N('pieza_id')]) === e.pieza; })[0];
  return p && t(p[e.col]) === e.valor;
}).length;
console.log('  ── releído: ' + puestos + '/' + escrituras.length + ' celdas confirmadas ' + (puestos === escrituras.length ? '✔' : '🔴'));
console.log('\n  archivo listo en: ' + SECO);
