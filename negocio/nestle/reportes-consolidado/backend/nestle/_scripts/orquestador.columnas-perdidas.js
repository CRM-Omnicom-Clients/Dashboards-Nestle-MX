// S5 · NUNCA SE PIERDE UNA COLUMNA. Clasifica y recupera.
//
// 🔴 LA INSTRUCCIÓN DE RICK (25-ago): «la columna de campaña la eliminaste, no puedes volver a
//    perderla, no puedes volver a perder NUNCA columnas, asegúrate de esto». Y después: «de las
//    perdidas, unas quizá estuvo bien borrar porque había unas sucias, otras se te fueron por
//    error — corrige eso».
//
// 🔴 POR QUÉ HACEN FALTA TRES CLASES Y NO DOS. Mi primera medición dijo «114 perdidas» y era falso:
//    la mayoría eran RENOMBRES. Reportar un renombre como pérdida haría «recuperar» una columna que
//    ya existe con otro nombre — o sea, crear la duplicada que Rick prohibió. Las tres son:
//
//      RENOMBRADA           hoy existe con otro nombre (normalizado igual, o alias del registro)
//      RETIRADA A PROPÓSITO alguien la sustituyó por otra que dice lo mismo → se declara el relevo
//      🔴 PERDIDA           no está, nadie la sustituyó, y nadie declaró por qué → SE RECUPERA
//
// 🔴 Y EL PRINCIPIO QUE ORDENA TODO ESTO: **ningún paso borra por su cuenta.** Lo que este paso
//    hace por defecto es CONSERVAR: si no puede clasificar una columna, la trata como perdida y la
//    recupera. Equivocarse conservando cuesta una columna de más; equivocarse borrando cuesta el
//    dato de alguien.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var REG = require(__dirname + '/lib-registro.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// 🔴 EL RELEVO DECLARADO: qué columna nueva dice lo que decía la vieja. Sin esto, las 40 columnas
//    del esquema viejo de `Report_Resumen` se «recuperarían» encima de las nuevas y la hoja
//    tendría el dato dos veces con dos nombres — exactamente lo que Rick prohibió.
//    Cada entrada es una DECISIÓN, no una suposición: se escribe aquí para poder discutirla.
var RELEVO = {
  'Report_Resumen': {
    'Entregados': 'Tot_Deliveries', 'No entregados': 'Tot_Bounces', 'Leídos': 'Tot_Opens',
    'Clicks': 'Tot_Clicks', '%Entrega': '%_Entrega', '%No entrega': '%_No_Entrega',
    '%Read vs entrega': '%_Open_Rate', '%Click vs Read': '%_CTOR',
    'Tasa_Clicks_a_Views': 'Views_por_Click', 'Carritos_por_Click': '%_Carritos_vs_Clicks',
    'Tasa_Productos_a_Carritos': '%_Productos_vs_Carritos',
    'Views_vs_Clicks_%': 'Views_por_Click', 'Carritos_vs_Clicks_%': '%_Carritos_vs_Clicks',
    'Fecha_Envío': 'Quincena_Lanzamiento Principal'
  },
  'Data_Qcart_Productos': {
    // la hoja se reconstruyó con otro esquema en junio: estas 14 son del modelo viejo
    'Brand': 'Marca', 'Campaign': 'Campaña', 'Journey': 'TouchPoint', 'Segment': 'Segmento',
    'Receta': 'shortlink_name', 'Tienda': 'store', 'Producto_Nestle': 'product',
    'Views_Producto': 'views', 'Marca_Nestle': 'Marca', 'Intencion_Producto_MXN': 'total_shown_price',
    'Ticket_Producto_MXN': 'total_shown_price', 'Pct_del_Total_Carrito': null, '_Key': null
  }
};

console.log('════════ S5 · COLUMNAS PERDIDAS ' + (ESCRIBIR ? '🔴 RECUPERA' : '(seco)') + ' ════════\n');
var vivo = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var reg = REG.cargar();
function encDe(wb, h) { var sh = wb.Sheets[h]; if (!sh || !sh['!ref']) return null; return (XLSX.utils.sheet_to_json(sh, { header: 1 })[0] || []).map(t).filter(Boolean); }

var BK = PROY + '/_backups';
var backups = fs.readdirSync(BK).map(function (f) { return { f: f, m: fs.statSync(BK + '/' + f).mtime }; })
  .sort(function (a, b) { return a.m - b.m; });
var hojas = vivo.SheetNames.filter(function (h) { return /^(Report_|Data_|Catalogo_)/.test(h) && h !== 'Reporte_julio'; });

// dónde estuvo cada columna por última vez, y con qué datos
var vistas = {};
backups.forEach(function (b) {
  var wb; try { wb = XLSX.readFile(BK + '/' + b.f); } catch (e) { return; }
  hojas.forEach(function (h) {
    var enc = encDe(wb, h); if (!enc) return;
    var F = XLSX.utils.sheet_to_json(wb.Sheets[h], { defval: '', blankrows: false });
    enc.forEach(function (c) {
      var k = h + '¦' + c;
      var con = F.filter(function (r) { return t(r[c]); }).length;
      vistas[k] = { hoja: h, col: c, backup: b.f, cuando: b.m, conDato: con, filas: F.length };
    });
  });
});

var clases = { renombrada: [], relevo: [], perdida: [] };
Object.keys(vistas).forEach(function (k) {
  var x = vistas[k];
  var hoy = encDe(vivo, x.hoja) || [];
  if (hoy.indexOf(x.col) >= 0) return;                                     // sigue ahí

  // 1 · renombrada: hoy existe una con el nombre normalizado igual
  //    ⚠ con tolerancia a plural y a sufijos que solo añaden origen: `TouchPoints`→`TouchPoint`,
  //      `Audiencia_DE`→`Audiencia_DE SFMC`. Sin esto se «recuperarían» encima de la que ya está,
  //      creando la columna duplicada que Rick prohibió — el remedio peor que la enfermedad.
  var nz = REG.nmz(x.col), nzSing = nz.replace(/s$/, '');
  var mismo = hoy.filter(function (e) {
    var a = REG.nmz(e);
    return a === nz || a.replace(/s$/, '') === nzSing || a.indexOf(nz) === 0 || nz.indexOf(a) === 0;
  })[0];
  if (mismo) { clases.renombrada.push(Object.assign({ ahora: mismo, via: 'nombre normalizado' }, x)); return; }

  // 2 · renombrada: el registro lo declara como alias histórico de una que sí está
  var col = Object.keys(reg.columnas).map(function (q) { return reg.columnas[q]; }).filter(function (c) {
    return (c.alias_historicos || []).some(function (a) { return REG.nmz(a) === REG.nmz(x.col); });
  })[0];
  if (col) {
    var viva = (col.nombres || []).filter(function (n2) { return hoy.some(function (e) { return REG.nmz(e) === REG.nmz(n2); }); })[0];
    if (viva) { clases.renombrada.push(Object.assign({ ahora: viva, via: 'alias del registro' }, x)); return; }
  }

  // 3 · relevo declarado
  var rel = (RELEVO[x.hoja] || {})[x.col];
  if (rel !== undefined) {
    if (rel === null) { clases.relevo.push(Object.assign({ ahora: '(retirada: no aportaba)', via: 'declarado' }, x)); return; }
    if (hoy.indexOf(rel) >= 0) { clases.relevo.push(Object.assign({ ahora: rel, via: 'declarado' }, x)); return; }
  }

  // 4 · ¿es de una ERA anterior de la hoja? `Report_Resumen` se reconstruyó el 13-ago con otro
  //    esquema (antes tenía 16 filas y columnas de una matriz de insights que ya no existe).
  //    Una columna que no se ve desde antes de ese corte no es «una pérdida de hoy»: es el esquema
  //    viejo. Se declara, no se recupera — recuperarla metería en la hoja columnas de otro modelo.
  //    🔴 El corte es una FECHA declarada, no una intuición: si mañana hay otro rebuild, se cambia aquí.
  if (x.hoja === 'Report_Resumen' && x.cuando < new Date('2026-08-13T00:00:00Z')) {
    clases.relevo.push(Object.assign({ ahora: '(esquema anterior al rebuild del 13-ago)', via: 'era' }, x));
    return;
  }

  // 5 · 🔴 PERDIDA — nadie la sustituyó y nadie declaró por qué
  clases.perdida.push(x);
});

console.log('  columnas que estuvieron alguna vez: ' + Object.keys(vistas).length);
console.log('  ✔ renombradas (existen con otro nombre): ' + clases.renombrada.length);
console.log('  ✔ relevadas (declarado quién las sustituye): ' + clases.relevo.length);
console.log('  🔴 PERDIDAS: ' + clases.perdida.length + '\n');

if (clases.perdida.length) {
  var porHoja = {};
  clases.perdida.forEach(function (x) { (porHoja[x.hoja] = porHoja[x.hoja] || []).push(x); });
  Object.keys(porHoja).forEach(function (h) {
    console.log('  ══ ' + h + ' — ' + porHoja[h].length + ' ══');
    porHoja[h].sort(function (a, b) { return b.conDato - a.conDato; }).forEach(function (x) {
      console.log('     «' + x.col + '»'.padEnd(30) + '  tenía dato en ' + x.conDato + ' de ' + x.filas +
        ' filas   ·   ' + x.cuando.toISOString().slice(5, 16));
    });
  });
  console.log('\n  🔴 Las que tenían DATO se recuperan con su contenido; las que estaban vacías,');
  console.log('     solo el encabezado. Ninguna se descarta: conservar de más cuesta una columna;');
  console.log('     borrar de menos cuesta el dato de alguien.');
}

fs.writeFileSync(BACK + '/_contratos/columnas-perdidas.json', JSON.stringify({
  paso: 'S5', principio: 'ningún paso borra por su cuenta; ante la duda se conserva',
  renombradas: clases.renombrada.length, relevadas: clases.relevo.length,
  perdidas: clases.perdida
}, null, 1));
console.log('\n  → _contratos/columnas-perdidas.json');
if (!ESCRIBIR) { console.log('\n  (seco. Para recuperar: --escribir)'); process.exit(0); }

// ══ RECUPERAR ═════════════════════════════════════════════════════════════════════════
// 🔴 SE CRUZA POR LA LLAVE DE CADA HOJA, no por número de fila. Las hojas cambiaron de tamaño y
//    de orden entre el backup y hoy; emparejar por índice metería el dato en la fila equivocada,
//    que es peor que no recuperarlo. Si una fila de hoy no estaba en el backup, se queda sin valor
//    y se dice — no se inventa.
var CB = require(BACK + '/_scripts/lib-cambios.js');
// el lote anterior se aplicó y se cerró; este corte abre el suyo
try { CB.abrir('WK35-limpieza'); } catch (e) { }
var LLAVE = { 'Catalogo_Piezas': 'Pieza_ID', 'Data_Email': 'Pieza_ID', 'Data_WhatsApp': 'Pieza_ID' };
function llaveReporte(r) {
  return [t(r['Campaña']), t(r['Objetivo']), t(r['TouchPoint']), t(r['Segmento'])].map(function (s) { return REG.nmz(s); }).join('¦');
}
console.log('\n════ RECUPERANDO ════');
CB.descartarNodo('S5');
var recuperadas = 0, celdas = 0, sinPareja = 0;
var porBackup = {};
clases.perdida.filter(function (x) { return x.conDato > 0; })
  .forEach(function (x) { (porBackup[x.backup] = porBackup[x.backup] || []).push(x); });

Object.keys(porBackup).forEach(function (bk) {
  var wb; try { wb = XLSX.readFile(BK + '/' + bk); } catch (e) { console.log('  🔴 no abre ' + bk); return; }
  porBackup[bk].forEach(function (x) {
    var antes = XLSX.utils.sheet_to_json(wb.Sheets[x.hoja], { defval: '', blankrows: false });
    var hoyF = XLSX.utils.sheet_to_json(vivo.Sheets[x.hoja], { defval: '', blankrows: false });
    // 🔴 ESCALERA DE LLAVES, no una sola. El backup del 17-ago es ANTERIOR a que los ids se
    //    re-anclaran a su campaña (`P007` → `004-P007`), así que cruzar por `Pieza_ID` daba CERO
    //    parejas en 287 filas — y «0 recuperadas» se lee como «no había nada que recuperar».
    //    Se prueba por id, y si no, por la llave natural que el esquema declara: `Email_Name`.
    var LLAVES = x.hoja === 'Report_Resumen'
      ? [function (r) { return llaveReporte(r); }]
      : [function (r) { return REG.nmz(t(r[LLAVE[x.hoja]])); },
         function (r) { return REG.nmz(t(r['Email_Name'])); },
         function (r) { return REG.nmz(t(r['Nombre_Pieza'])); }];
    var idx = null, usada = -1;
    for (var q = 0; q < LLAVES.length && !idx; q++) {
      var cand = {}, buenas = 0;
      antes.forEach(function (r) { var kk = LLAVES[q](r); if (kk) { cand[kk] = t(r[x.col]); buenas++; } });
      if (!buenas) continue;
      var cruzan = hoyF.filter(function (r) { var kk = LLAVES[q](r); return kk && cand[kk] !== undefined; }).length;
      if (cruzan > 0) { idx = cand; usada = q; }
    }
    if (!idx) { console.log('  🔴 ' + x.hoja + ' «' + x.col + '»: ninguna llave cruza con el backup — no se recupera, y se dice'); sinPareja += hoyF.length; return; }
    // 🔴 PRIMERO SE CREA LA COLUMNA, LUEGO SE LLENA. Apuntar solo los valores dejaba al escritor
    //    con 112 celdas para una columna que no existe — y con razón se negó a escribir. Crear va
    //    antes que llenar, siempre: es el mismo orden de la fundación (atribuir → organizar → llenar).
    var hoyEnc = encDe(vivo, x.hoja) || [];
    if (hoyEnc.indexOf(x.col) < 0) {
      CB.apuntarColumna('S5', x.hoja, x.col, 'columna RECUPERADA: se perdio el ' + x.cuando.toISOString().slice(0, 10) + ' y tenia dato en ' + x.conDato + ' filas');
    }
    var kfn = LLAVES[usada];
    var puestas = 0, faltan = 0;
    hoyF.forEach(function (r, i) {
      var kk = kfn(r);
      var v = kk ? idx[kk] : undefined;
      if (v === undefined || v === '') { faltan++; return; }
      CB.apuntar('S5', x.hoja, i + 2, x.col, v, 'columna RECUPERADA: se perdió el ' + x.cuando.toISOString().slice(0, 10) + ' y tenía dato en ' + x.conDato + ' filas');
      puestas++; celdas++;
    });
    sinPareja += faltan;
    recuperadas++;
    console.log('  ✔ ' + x.hoja.padEnd(18) + '«' + x.col + '»'.padEnd(24) + puestas + ' celdas recuperadas' +
      (faltan ? '   ⚠ ' + faltan + ' filas de hoy no estaban en el backup' : ''));
  });
});
// las columnas vacías: solo el encabezado, para que no desaparezca el hueco
clases.perdida.filter(function (x) { return x.conDato === 0; }).forEach(function (x) {
  console.log('  ○ ' + x.hoja.padEnd(18) + '«' + x.col + '» estaba vacía: se recrea el encabezado, sin datos');
  CB.apuntarColumna('S5', x.hoja, x.col, 'columna recuperada (estaba vacía): se conserva el hueco para no perder la estructura');
});
var res = CB.resumen();
console.log('\n  ── ' + recuperadas + ' columnas con dato · ' + celdas + ' celdas apuntadas · choques: ' + res.choques);
if (sinPareja) console.log('  ⚠ ' + sinPareja + ' celdas quedaron sin valor: su fila no existía en el backup. No se inventa.');
console.log('  las aplica el escritor con escritor.escribir-todo.js --escribir');
