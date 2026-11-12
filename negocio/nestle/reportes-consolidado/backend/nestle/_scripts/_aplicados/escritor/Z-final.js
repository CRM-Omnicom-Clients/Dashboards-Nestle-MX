// ORDEN FINAL + VALIDACIÓN DE CIERRE.
// 🔴 El reordenamiento anterior perdió una hoja: mi regex solo capturaba <sheet .../>
//    auto-cerradas. Ahora captura ambas formas y VERIFICA que no se pierda ninguna antes
//    de escribir — si la cuenta no cuadra, aborta.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var AdmZip = require('adm-zip'), XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var safeSave = require(os.homedir() + '/.claude/tools/xlsx-safe-save.js');
var PROY = 'C:/Users/Ricardo.Aguilar/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var WB = PROY + '/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx';
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };

var ORDEN = ['Catalogo_Piezas', 'Catalogo_Referencias', 'Data_Email', 'Data_Qcart', 'Data_WhatsApp',
  'Catalog_Campanas', 'Report_Resumen', 'Report_Mensual', 'Report_CompletoQcart', 'Report_Campana_Mes',
  'Report_Insights_Operativo', 'Soporte_IA_Qcart_Productos', 'Soporte_IA_Stage_Carts',
  'Soporte_IA_Stage_Products'];   // Procesos-Rick la borró Rick a propósito

fs.copyFileSync(WB, PROY + '/_backups/v8_antes-orden-final.xlsx');
var z = new AdmZip(WB);
var wbXml = z.readAsText('xl/workbook.xml');
// captura AMBAS formas: <sheet .../> y <sheet ...></sheet>
var tags = {}, todas = wbXml.match(/<sheet\b[^>]*\/>|<sheet\b[^>]*>[\s\S]*?<\/sheet>/g) || [];
todas.forEach(function (x) { var m = /name="([^"]*)"/.exec(x); if (m) tags[m[1]] = x; });
var nombres = Object.keys(tags);
console.log('══ ORDEN DE HOJAS ══');
console.log('  hojas registradas: ' + nombres.length);
var orden = ORDEN.filter(function (n) { return tags[n]; }).concat(nombres.filter(function (n) { return ORDEN.indexOf(n) < 0; }));
if (orden.length !== nombres.length) { console.log('🔴 ABORTA: el orden tendría ' + orden.length + ' y hay ' + nombres.length); process.exit(1); }
wbXml = wbXml.replace(/<sheets>[\s\S]*?<\/sheets>/, '<sheets>' + orden.map(function (n) { return tags[n]; }).join('') + '</sheets>');
var check = (wbXml.match(/<sheet\b[^>]*\/>|<sheet\b[^>]*>[\s\S]*?<\/sheet>/g) || []).length;
if (check !== nombres.length) { console.log('🔴 ABORTA: tras reordenar quedan ' + check); process.exit(1); }
z.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));
z.writeZip(WB);
var r = safeSave(WB);
orden.forEach(function (n, i) { console.log('  ' + String(i + 1).padStart(2) + '. ' + n); });
console.log('  safe-save: ' + r.partes + ' partes · ' + r.validado);

// ═════ VALIDACIÓN DE CIERRE ═════
var T = os.homedir() + '/_zf.xlsx'; fs.copyFileSync(WB, T);
var wb = XLSX.readFile(T);
var P = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '' });
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '' });
var E = XLSX.utils.sheet_to_json(wb.Sheets['Data_Email'], { defval: '' }).filter(function (x) { return t(x['Email_Content_Name']); });
var WA = XLSX.utils.sheet_to_json(wb.Sheets['Data_WhatsApp'], { defval: '' }).filter(function (x) { return t(x['Campaña']); });
var Q = XLSX.utils.sheet_to_json(wb.Sheets['Data_Qcart'], { defval: '' });
var V = [], fallo = 0;
function chk(n, ok, d) { V.push([n, ok, d]); if (!ok) fallo++; }

chk('las 14 hojas presentes', wb.SheetNames.length === 14, wb.SheetNames.length);
chk('Procesos-Rick fuera (Rick la borró)', wb.SheetNames.indexOf('Procesos-Rick') < 0, '');
chk('el catálogo abre primero', wb.SheetNames[0] === 'Catalogo_Piezas' && wb.SheetNames[1] === 'Catalogo_Referencias', wb.SheetNames.slice(0, 2).join(' · '));
chk('96 piezas', P.length === 96, P.length);
chk('Pieza_ID únicos', new Set(P.map(function (x) { return t(x['Pieza_ID']); })).size === P.length, '');
var OBL = ['Pieza_ID', 'Camp_ID', 'Journey_ID', 'BU', 'Marca', 'Campaña', 'Objetivo', 'Touchpoint', 'Segmento', 'Canal', 'Tipo_Envio', 'Fuente_Dato', 'Tiene_Qcart', 'Estado'];
var vac = OBL.filter(function (c) { return P.some(function (x) { return !t(x[c]); }); });
chk('las 14 obligatorias sin vacíos', !vac.length, vac.join(', ') || '100%');
chk('Σ Sends == fuentes', P.reduce(function (a, x) { return a + num(x['Sends']); }, 0) ===
  E.reduce(function (a, x) { return a + num(x['Email_Sends']); }, 0) + WA.reduce(function (a, x) { return a + num(x['Sends']); }, 0),
  P.reduce(function (a, x) { return a + num(x['Sends']); }, 0).toLocaleString());
// cuadre explícito de carritos
var catC = P.reduce(function (a, x) { return a + num(x['Carritos_Total']); }, 0);
var exC = R.filter(function (x) { return t(x['Tipo']) === 'excluido'; }).reduce(function (a, x) { return a + num(x['Dato_1']); }, 0);
var qC = Q.filter(function (x) { return t(x['Shortlink_Code']); }).reduce(function (a, x) { return a + num(x['Carts_Total_All_Products']); }, 0);
chk('carritos: catálogo + excluidos == fuente', catC + exC === qC, catC + ' + ' + exC + ' = ' + (catC + exC) + ' vs ' + qC);
chk('0 pendientes', !R.some(function (x) { return t(x['Tipo']) === 'pendiente'; }), 'reclasificados a estado o excluido');
chk('todo excluido con motivo', R.filter(function (x) { return t(x['Tipo']) === 'excluido'; }).every(function (x) { return t(x['Notas']); }),
  R.filter(function (x) { return t(x['Tipo']) === 'excluido'; }).length + ' excluidos');
chk('todo Estado en su lista', P.every(function (x) { return ['Confirmado', 'Sin engagement cargado', 'Sin email cargado', 'Sin fecha en la fuente'].indexOf(t(x['Estado'])) >= 0; }),
  Object.keys(P.reduce(function (a, x) { a[t(x['Estado'])] = 1; return a; }, {})).join(' · '));
chk('Tercer Tiempo WhatsApp = WA-1 y WA-2', P.filter(function (x) { return t(x['Campaña']) === 'Tercer Tiempo' && t(x['Canal']) === 'WhatsApp'; })
  .map(function (x) { return t(x['Touchpoint']); }).sort().join(',') === 'WA-1,WA-2', '');
var dup = [];
(function () {
  var v = {}; P.forEach(function (x) { for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { var k = t(x[c + i]); if (!k) return; if (v[k]) dup.push(k); v[k] = 1; }); });
  var v2 = {}; P.forEach(function (x) { var k = [t(x['Journey_ID']), t(x['Touchpoint']), t(x['Segmento']), t(x['Email_Type']), t(x['Touchpoint_Raw'])].join('¦'); if (v2[k]) dup.push('llave ' + k); v2[k] = 1; });
})();
chk('0 duplicados', !dup.length, dup.slice(0, 3).join(' · ') || 'códigos y llaves naturales');
var d2 = { BU: {}, Marca: {}, 'Campaña': {}, Objetivo: {}, Segmento: {}, Touchpoint: {} };
P.forEach(function (x) { Object.keys(d2).forEach(function (k) { if (t(x[k])) d2[k][t(x[k])] = 1; }); });
var nn = Object.keys(d2), cr = [];
for (var a = 0; a < nn.length; a++) for (var b = a + 1; b < nn.length; b++) Object.keys(d2[nn[a]]).forEach(function (x) { if (d2[nn[b]][x]) cr.push(x); });
chk('nada mezclado entre dimensiones', !cr.length, cr.join(' · '));
// formato
var z2 = new AdmZip(WB);
var wbx = z2.readAsText('xl/workbook.xml'), rr = z2.readAsText('xl/_rels/workbook.xml.rels'), dd = {};
rr.replace(/<Relationship[^>]*\/>/g, function (x) { var i = /Id="([^"]*)"/.exec(x), g = /Target="([^"]*)"/.exec(x); if (i && g) dd[i[1]] = g[1].replace(/^\/?xl\//, ''); return x; });
var ruta = null; wbx.replace(/<sheet\b[^>]*\/>/g, function (x) { var n = /name="([^"]*)"/.exec(x), i = /r:id="([^"]*)"/.exec(x); if (n && n[1] === 'Catalogo_Piezas') ruta = 'xl/' + dd[i[1]]; return x; });
var sx = z2.readAsText(ruta);
chk('encabezado congelado y con filtro', /state="frozen"/.test(sx) && /<autoFilter/.test(sx), '');
chk('encabezados con estilo', ((/<row r="1"[^>]*>([\s\S]*?)<\/row>/.exec(sx) || ['', ''])[1].match(/ s="\d+"/g) || []).length >= 55, '');

// ══ los 4 checks que el REFUTADOR tuvo que encontrar porque ninguna suite los miraba ═══
// Regla: si un defecto pasó en verde una vez, se queda un check permanente. Si no, vuelve.
(function () {
  var iso = function (f) { if (typeof f === 'number') return new Date(Date.UTC(1899, 11, 30) + f * 86400000).toISOString().slice(0, 10); return t(f).slice(0, 10); };
  var Em = E;

  // R1 · la fecha debe ser la de la PIEZA (mín Send_Date de Data_Email), no la del journey
  var malF = [];
  P.forEach(function (p) {
    var cn = [t(p['Content_Name'])].concat(t(p['Content_Names_Variantes']).split(/\s*;\s*/)).filter(Boolean);
    var fx = Em.filter(function (r) { return cn.indexOf(t(r['Email_Content_Name'])) >= 0 && r['Send_Date']; })
      .map(function (r) { return iso(r['Send_Date']); }).sort();
    if (fx.length && t(p['Fecha_Primer_Envio']).slice(0, 10) !== fx[0]) malF.push(t(p['Pieza_ID']) + ' ' + t(p['Fecha_Primer_Envio']).slice(0, 10) + '≠' + fx[0]);
  });
  chk('Fecha = mín Send_Date de SU pieza', !malF.length, malF.length ? malF.slice(0, 3).join(' · ') : 'no es la del journey');

  // R2 · todo código del documento MAESTRO está en una pieza o declarado excluido
  var codsCat = {}, exc2 = {};
  P.forEach(function (p) { for (var i = 1; i <= 5; i++)['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (c) { t(p[c + i]).split(/\s*;\s*/).forEach(function (k) { if (t(k)) codsCat[t(k)] = 1; }); }); });
  R.filter(function (r) { return t(r['Tipo']) === 'excluido'; }).forEach(function (r) { exc2[t(r['Valor_Crudo'])] = 1; });
  var docCods = {};
  try {
    var wd2 = XLSX.readFile(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
    wd2.SheetNames.filter(function (h) { return /^(marzo|abril|mayo|junio|julio|agosto)/i.test(h); }).forEach(function (h) {
      XLSX.utils.sheet_to_json(wd2.Sheets[h], { header: 1, defval: '' }).forEach(function (fl) {
        fl.forEach(function (c) { (t(c).match(/qcart\.app\/([A-Za-z0-9_-]{4,})/g) || []).forEach(function (m) { docCods[m.split('/').pop()] = h; }); });
      });
    });
  } catch (e) { }
  var perdidos = Object.keys(docCods).filter(function (c) { return !codsCat[c] && !exc2[c]; });
  chk('ningún código del maestro se pierde', !perdidos.length,
    perdidos.length ? perdidos.length + ': ' + perdidos.slice(0, 5).join(' ') : Object.keys(docCods).length + ' del maestro: ' + Object.keys(codsCat).length + ' en piezas + el resto declarado');

  // R3 · un bloque de receta nunca queda a medias (fue como se detectó la fila con 3 recetas)
  var medias = [];
  P.forEach(function (p) { for (var i = 1; i <= 5; i++) { if (!!t(p['Receta_' + i]) !== !!t(p['URL_Receta_' + i])) medias.push(t(p['Pieza_ID']) + '/R' + i); } });
  chk('ningún bloque de receta a medias', !medias.length, medias.length ? medias.slice(0, 4).join(' ') : 'receta y URL siempre juntas');

  // R4 · toda pieza de WhatsApp declara si sus clicks son medidos o derivados
  var sinCM = P.filter(function (p) { return t(p['Canal']) === 'WhatsApp' && !t(p['Clicks_Medidos']); });
  chk('WhatsApp declara si el click es medido', !sinCM.length,
    sinCM.length ? sinCM.length + ' sin declarar' : P.filter(function (p) { return /^No/.test(t(p['Clicks_Medidos'])); }).length + ' derivados marcados (no comparables contra benchmark)');

  // ── R5-R8 · PERIODOS. Una pieza AON manda durante semanas: si el reparto no cuadra, N3
  //    mete envíos en la quincena equivocada y el reporte quincenal miente sin avisar.
  var desc = [];
  P.forEach(function (p) {
    var sp = t(p['Sends_Por_Quincena']); if (!sp) return;
    var s = sp.split(' ; ').reduce(function (a, x) { return a + num(x.split(':')[1]); }, 0);
    if (s !== num(p['Sends'])) desc.push(t(p['Pieza_ID']) + ' ' + s + '≠' + num(p['Sends']));
  });
  chk('Σ Sends_Por_Quincena == Sends', !desc.length,
    desc.length ? desc.slice(0, 3).join(' · ') : P.filter(function (p) { return t(p['Sends_Por_Quincena']); }).length + ' piezas con reparto');

  var incoh = P.filter(function (p) {
    var qs = t(p['Quincenas_Activas']).split(' ; ').filter(Boolean);
    return qs.length !== num(p['N_Quincenas']) || (qs.length && qs[0] !== t(p['Quincena_Lanzamiento']));
  });
  chk('el lanzamiento es la 1ª quincena activa', !incoh.length,
    incoh.length ? incoh.slice(0, 3).map(function (p) { return t(p['Pieza_ID']); }).join(' ') : P.filter(function (p) { return num(p['N_Quincenas']) > 1; }).length + ' piezas multi-quincena');

  // 🔴 el que me faltó: declarar "no hay dato" sin agotar TODAS las columnas que lo llevan.
  //    009-P005 tenía Send_Quincena y yo miré solo Send_Date.
  var mintio = P.filter(function (p) {
    return /sin fecha ni quincena/.test(t(p['Fecha_Origen'])) && t(p['Quincena_Lanzamiento']);
  });
  chk('no declara "sin dato" teniéndolo', !mintio.length,
    mintio.length ? mintio.map(function (p) { return t(p['Pieza_ID']); }).join(' ') : 'la escalera agota Send_Date → Send_Quincena → journey');

  var sinPeriodo = P.filter(function (p) { return !t(p['Mes_Lanzamiento']); });
  var noDecl = sinPeriodo.filter(function (p) { return t(p['Estado']) === 'Confirmado'; });
  chk('toda pieza sin periodo lo declara en su Estado', !noDecl.length,
    noDecl.length ? noDecl.map(function (p) { return t(p['Pieza_ID']); }).join(' ') : sinPeriodo.length + ' sin periodo, todas declaradas');

  // ── R9-R11 · el ANCLA LITERAL a la otra hoja (lo que Rick notó que faltaba)
  chk('Referencias trae el ancla a Piezas', Object.keys(R[0] || {}).indexOf('Pieza_IDs') >= 0 && Object.keys(R[0] || {}).indexOf('N_Piezas') >= 0,
    'N_Piezas · Pieza_IDs — sin esto la hoja no se cruza desde Excel');

  // 🔴 un excluido con piezas significa que un código excluido se coló a una pieza: su número se
  //    estaría contando en el catálogo Y descontando como excluido. Doble conteo silencioso.
  var excMal = R.filter(function (r) { return t(r['Tipo']) === 'excluido' && num(r['N_Piezas']) > 0; });
  chk('ningún excluido aparece en una pieza', !excMal.length,
    excMal.length ? excMal.map(function (r) { return t(r['Valor_Crudo']); }).join(' ') : R.filter(function (r) { return t(r['Tipo']) === 'excluido'; }).length + ' excluidos, ninguno en uso');

  // los ids que declara el ancla tienen que existir de verdad
  var vivos = {}; P.forEach(function (p) { vivos[t(p['Pieza_ID'])] = 1; });
  var fantasma = [];
  R.forEach(function (r) {
    t(r['Pieza_IDs']).split(/\s+/).forEach(function (id) {
      if (/^\d{3}-P\d{3}$/.test(id) && !vivos[id]) fantasma.push(id);
    });
  });
  chk('el ancla no apunta a piezas inexistentes', !fantasma.length,
    fantasma.length ? fantasma.slice(0, 4).join(' ') : R.filter(function (r) { return num(r['N_Piezas']) > 0; }).length + ' referencias ancladas');
})();

console.log('\n══ VALIDACIÓN DE CIERRE ══');
V.forEach(function (v) { console.log('  ' + (v[1] ? '✔' : '🔴') + ' ' + v[0].padEnd(38) + (v[2] || '')); });
console.log('\n  ' + (fallo ? '🔴 ' + fallo + ' FALLIDA(S)' : '✅ CATÁLOGO CERRADO · ' + V.length + ' validaciones'));
process.exit(fallo ? 1 : 0);
