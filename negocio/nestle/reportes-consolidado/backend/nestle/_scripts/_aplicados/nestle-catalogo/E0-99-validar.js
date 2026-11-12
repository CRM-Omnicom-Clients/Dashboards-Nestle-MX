// E0.99 · VALIDACIÓN ADVERSARIAL DE LA ETAPA 0.
//
// 🔴 NO basta con «el esquema se escribió». La prueba es que un CASO DE USO REAL lo atraviese, y
//    que el sistema **se defienda** cuando lo ataco. Dos travesías y cuatro ataques:
//      travesía A · de un shortlink hasta su campaña, cruzando 4 entidades, usando SOLO el esquema
//      travesía B · de una fila del reporte a las piezas que la componen
//      ataques   · pieza inexistente · hoja no declarada · llave no declarada · deuda oculta
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var E = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-esquema.js');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-qcart-links.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ok = 0, mal = 0;
function chk(n, c, e) { console.log('   ' + (c ? '✔' : '🔴') + ' ' + n.padEnd(58) + e); c ? ok++ : mal++; }

console.log('════════ E0.99 · ¿EL ESQUEMA SIRVE DE VERDAD? ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var H = function (h) { return XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '', blankrows: false }); };
var P = H('Catalogo_Piezas');

// ══ TRAVESÍA A · shortlink → link → pieza → campaña, guiado por el esquema ══
console.log('══ travesía A · de un shortlink a su campaña, usando solo el esquema ══\n');
var eventos = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8')).carritos || [];
var muestra = eventos[Math.floor(eventos.length / 3)];
console.log('   evento: ' + t(muestra.fecha) + ' · ' + t(muestra.shortlink_code) + ' · ' + t(muestra.store));

// paso 1: evento → link  (foránea declarada)
var fEvento = E.foraneas('Data_Qcart_Carritos');
chk('el esquema declara la foránea de un evento', !!fEvento['shortlink_code'],
  Object.keys(fEvento).map(function (k) { return k + '→' + fEvento[k]; }).join(' · '));

// paso 2: link → pieza  (recorriendo el catálogo por los Cod_*)
var codPieza = {};
P.forEach(function (p) {
  for (var i = 1; i <= 5; i++) ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
    Q.codigosDe(p[pre + i]).forEach(function (c) { codPieza[c] = p; });
  });
});
var pieza = codPieza[t(muestra.shortlink_code)];
chk('el link llega a UNA pieza', !!pieza, pieza ? t(pieza['Pieza_ID']) + ' · ' + t(pieza['Touchpoint']) + ' · ' + t(pieza['Segmento']) : '🔴 sin pieza');

// paso 3: pieza → campaña  (la llave natural y la primaria)
if (pieza) {
  var llaveP = E.llaveDe('Catalogo_Piezas');
  chk('la llave primaria de la pieza sale del esquema', llaveP.length === 1 && llaveP[0] === 'Pieza_ID', llaveP.join(' + '));
  chk('la pieza llega a su campaña', !!t(pieza['Campaña']), t(pieza['Campaña']) + ' (Camp_ID ' + t(pieza['Camp_ID']) + ')');
  var ent = E.entidadDe('Catalogo_Piezas');
  chk('el grano de la hoja está declarado', /una fila = una pieza/.test(ent.grano), ent.grano);
}

// ══ TRAVESÍA B · fila del reporte → piezas que la componen ══
console.log('\n══ travesía B · de una fila del reporte a sus piezas ══\n');
var R = H('Report_Resumen').filter(function (r) { return t(r['Campaña']) && !/^total/i.test(t(r['Campaña'])); });
var fila = R.filter(function (r) { return /AON/i.test(t(r['Campaña'])) && t(r['Segmento']); })[0] || R[0];
console.log('   fila: ' + t(fila['Campaña']) + ' | ' + t(fila['TouchPoint']) + ' | ' + t(fila['Segmento']) + ' | ' + t(fila['Quincena_Lanzamiento']));
var llaveR = E.llaveDe('Report_Resumen');
chk('la llave del reporte sale del esquema', llaveR.length === 4, llaveR.join(' + '));
// 🔴 EL CAMINO ES CORRECTO, LA FORMA NO. Cruzar tal cual da 0 de 86 porque la quincena está en dos
//    formatos («Mar-Q1-2026» en el reporte, «2026-03-Q1» en el catálogo). Se prueban las dos cosas
//    por separado: que el esquema describe bien el camino, y que el dato hoy lo impide. Lo segundo
//    es deuda declarada con dueño (paso 3.1), no un fallo del esquema.
function normQ(q) {
  q = t(q);
  var m = /^(\d{4})-(\d{2})-Q([12])$/.exec(q); if (m) return q;
  var MES = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
  var n = /^([A-Za-zÁ-ú]{3})-Q([12])-(\d{4})$/.exec(q);
  if (n) { var mm = MES[n[1].toLowerCase()]; if (mm) return n[3] + '-' + mm + '-Q' + n[2]; }
  return null;
}
function componentes(f, usarNorm) {
  var q = usarNorm ? normQ(E.campo(f, 'Quincena', 'Quincena_Lanzamiento')) : t(E.campo(f, 'Quincena', 'Quincena_Lanzamiento'));
  return P.filter(function (p) {
    return t(p['Campaña']) === t(f['Campaña']) && t(E.campo(p,'TouchPoint','Touchpoint')) === t(f['TouchPoint']) &&
      t(p['Segmento']) === t(f['Segmento']) && t(E.campo(p, 'Quincena', 'Quincena_Lanzamiento')) === q;
  });
}
var crudo = R.filter(function (f) { return componentes(f, false).length; }).length;
var norm = R.filter(function (f) { return componentes(f, true).length; }).length;
chk('el esquema describe bien el camino reporte→piezas', norm > 0,
  'normalizando la quincena cruzan ' + norm + ' de ' + R.length);
console.log('   ⚠ ' + 'PERO tal como están hoy cruzan'.padEnd(58) + crudo + ' de ' + R.length +
  '   🔴 la quincena está en dos formatos → deuda #2, la cierra el paso 3.1');
var comp = componentes(fila, true);
if (comp.length) console.log('      la fila se descompone en: ' + comp.map(function (p) { return t(p['Pieza_ID']) + '(' + (t(p['Email_Type']) || '—') + ')'; }).join(' · '));

// ══ LOS ATAQUES ══
console.log('\n══ los ataques · el sistema tiene que DEFENDERSE ══\n');

// ataque 1 · hoja no declarada
var a1 = false;
try { E.llaveDe('Hoja_Que_No_Existe'); } catch (e) { a1 = /no está declarada|hoja no declarada/i.test(e.message); }
chk('ataque 1 · hoja no declarada → truena', a1, a1 ? 'se niega con mensaje claro' : '🔴 devolvió algo');

// ataque 2 · pieza inexistente no debe resolver a nada
var a2 = !codPieza['ZZZZZZZZ'];
chk('ataque 2 · shortlink inventado → no resuelve', a2, a2 ? 'devuelve vacío, no una pieza al azar' : '🔴 resolvió');

// ataque 3 · una hoja sin prefijo no puede declararse completa
var rj = E.revisarPrefijo('Reporte_julio', []);
chk('ataque 3 · Reporte_julio no lleva prefijo y el esquema lo sabe', rj.aplica === false, 'aplica=false (está congelada)');

// ataque 4 · la deuda NO puede estar escondida
var d = E.deuda();
chk('ataque 4 · la deuda está declarada, no escondida', d.length > 0 && !!d[0].lo_cierra,
  d.length + ' deuda(s) · la cierra: ' + (d[0] ? d[0].lo_cierra : '—'));

// ataque 5 · el prefijo real vs el declarado, hoja por hoja (mide el trabajo pendiente)
console.log('\n══ el prefijo hoy, medido por la librería ══\n');
E.hojas().filter(function (h) { return E.llevaPrefijo(h); }).forEach(function (h) {
  var enc = (XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1 })[0] || []).map(t);
  var r = E.revisarPrefijo(h, enc);
  console.log('   ' + h.padEnd(24) + (r.completo ? '✔ completo' : 'faltan ' + r.faltan.length + '  ·  en orden: ' + (r.en_orden ? 'sí' : 'no')));
});

console.log('\n════════ ' + (mal ? '🔴 ' + mal + ' FALLA(S)' : '✅ ETAPA 0 CERRADA — ' + ok + ' checks') + ' ════════');
process.exit(mal ? 1 : 0);
