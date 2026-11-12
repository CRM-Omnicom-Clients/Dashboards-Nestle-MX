// escritor-datos · EL ESCRITOR. Lee el contrato y copia. No sabe de negocio.
//
// 🔴 QUÉ CAMBIÓ. Antes la traducción bloque→hoja vivía aquí dentro, como un `switch` de 20 casos
//    con DOS copias (N3-05 y N3-07). Con eso el escritor no era un copiador: decidía. Y decidir
//    en dos sitios es cómo se separan. Ahora todo eso está declarado en `_contratos/hojas.js` y
//    este script solo obedece.
//
// LO QUE NO TOCA, nunca:
//    n5        · tasas y flags — los calcula el motor
//    conservar · columnas que la hoja tiene y ninguna fuente reproduce. Si se borran, no vuelven
//    y cualquier columna que el contrato no declare
//
// USO:  node escritor.escribir.js            → solo DIFF, no escribe
//       node escritor.escribir.js --escribir → escribe (con backup y la cadena de validación)
//       node escritor.escribir.js --hoja Data_Email
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

// 🔴 ANCLADO AL CATÁLOGO RAÍZ. Las columnas se le piden a `lib-columna`, que consulta
//    `_contratos/registro.json` (id lógico inmutable → nombre físico actual) ANTES que a la hoja.
//    Un renombre se resuelve cambiando una fila del catálogo, no este archivo.
var COL = require(__dirname + '/lib-columna.js');
var AMBITO_CATALOGO = 'escritor';   // el ámbito de este skill dentro del catálogo raíz
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var AdmZip = require('adm-zip');
var safeSave = require(require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js');
var L = require(__dirname + '/lib-flexible.js');
var C = require(require('path').resolve(__dirname, '..') + '/_contratos/hojas.js');
// 🔴 escribir una celda es SIEMPRE por aquí. Un regex propio sobre `<c…>` no distingue la celda
//    autocerrada y se come las vecinas — pasó dos veces en una sesión.
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var SOLO = (function () { var i = process.argv.indexOf('--hoja'); return i > 0 ? process.argv[i + 1] : null; })();

function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function serial(iso) { return iso ? Math.round((new Date(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000) : null; }

// ── las derivadas: se calculan de la fecha del propio bloque, no se piden a nadie ───
var MES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// 🔴 LA QUINCENA SE LE PIDE A `lib-quincena`, NO SE REIMPLEMENTA. Aquí había una segunda versión
//    que devolvía `Ago-Q1-2026` mientras la fundación —y las hojas— usan `2026-08-Q1`. Un escritor
//    con su propia regla degrada el dato cada vez que corre: iba a pisar 2,645 celdas buenas de
//    `Data_Qcart_Carritos` con el formato viejo, que además ordena por mes alfabético en vez de
//    cronológico. Es el mismo arreglo que ya se le hizo a motor-calculo: una sola regla y un solo formato.
var QN = require(__dirname + '/lib-quincena.js');

function derivar(formula, iso) {
  // 🔴 SIN FECHA NO SE DERIVA NADA — y «nada» es `undefined` (no tocar), NUNCA `''`.
  //    Devolviendo cadena vacía, el escritor la trataba como un valor y BORRABA la celda: iba a
  //    dejar en blanco `Mes (#)` en las 98 filas de email y las 12 de WhatsApp, que ya lo tenían
  //    bien. Un dato que no se puede calcular no autoriza a destruir el que ya está.
  if (!iso) return undefined;
  var d = new Date(iso + 'T00:00:00Z'), mes = d.getUTCMonth(), dia = d.getUTCDate(), anio = d.getUTCFullYear();
  if (isNaN(d.getTime())) return undefined;
  if (formula === 'mes') return MES_ES[mes];
  if (formula === 'mes_num') return mes + 1;
  if (formula === 'quincena') { var q = QN.deFecha(iso) || QN.normalizar(iso); return q || undefined; }
  if (formula === 'lunes_serial') { var w = new Date(d); w.setUTCDate(dia - ((d.getUTCDay() + 6) % 7)); return serial(w.toISOString().slice(0, 10)); }
  if (formula === 'semana_iso') {
    var x = new Date(Date.UTC(anio, mes, dia)); x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
    var y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return 'WK' + String(Math.ceil(((x - y0) / 86400000 + 1) / 7)).padStart(2, '0') + '-' + x.getUTCFullYear();
  }
  return undefined;   // fórmula desconocida: NO se inventa un valor, y sobre todo no se borra el que hay
}

// ── el valor de una columna, según el contrato ─────────────────────────────────────
function valorDe(def, reg) {
  if (def.de === 'bloque') return reg[def.campo];
  if (def.de === 'derivado') return derivar(def.formula, reg[def.desde]);
  if (def.de === 'catalogo') {
    // el bloque ya trae la canónica resuelta (la resolvió su script de fuente con lib-canonico)
    // 🔴 LA BÚSQUEDA ES INSENSIBLE A CÓMO SE ESCRIBA EL NOMBRE. Este mapa tenía la llave
    //    `Touchpoint` (p minúscula) y el contrato pasó a decir `TouchPoint`: la búsqueda devolvía
    //    `undefined`, la columna no se escribía nunca, y la hoja se quedaba con el crudo `WA-SF-A`
    //    donde el catálogo dice `Semifinal A`. Un mapa de nombres escrito a mano se desincroniza
    //    del contrato en cuanto alguien cambia una mayúscula — y falla en silencio, que es lo peor.
    var m = { bu: 'bu_canonico', marca: 'marca_canonica', campana: 'campana_canonica',
              segmento: 'segmento_canonico', touchpoint: 'touchpoint_canonico' };
    var k = String(def.campo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return reg[m[k]];
  }
  return undefined;                              // n5 · conservar → NO se toca
}

console.log('════════ escritor-datos · ESCRITOR ' + (ESCRIBIR ? '(ESCRIBE)' : '(solo diff)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var SECO = require('path').resolve(__dirname, '..') + '/_tmp/_n4.xlsx';
fs.copyFileSync(vivo.ruta, SECO);
var wb = XLSX.readFile(SECO);

var zip = new AdmZip(SECO);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

var RESUMEN = [], huboCambio = false;
Object.keys(C.hojas).forEach(function (hoja) {
  if (SOLO && hoja !== SOLO) return;
  var def = C.hojas[hoja];
  var cols = Object.assign({}, def.hereda ? C.hojas[def.hereda].columnas : {}, def.columnas);
  var sh = wb.Sheets[hoja]; if (!sh) { console.log('  ⚠ ' + hoja + ' no existe, se salta'); return; }
  var B; try { B = JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + def.bloque + '.json', 'utf8')); } catch (e) { console.log('  ⚠ sin bloque para ' + hoja); return; }
  var regs = B[def.registros] || [];
  var r = XLSX.utils.decode_range(sh['!ref']);
  var colIdx = {};
  for (var c = r.s.c; c <= r.e.c; c++) { var h = sh[XLSX.utils.encode_cell({ r: 0, c: c })]; if (h && t(h.v)) colIdx[t(h.v)] = c; }

  // emparejar filas de la hoja con registros del bloque, por la llave del contrato
  var filas = XLSX.utils.sheet_to_json(sh, { defval: '', blankrows: false });
  // 🔴 LA LLAVE LA DECLARA EL CONTRATO, CON SU COLUMNA Y SU TIPO. Antes el escritor mapeaba
  //    campo→columna por su cuenta con una tabla adivinada, y se equivocó feo: emparejó
  //    `journey_id` (GUID en el bloque) contra `Journey_ID` (JID numérico en la hoja). 66 filas
  //    sin pareja y 198 pareadas MAL — el diff mostraba 160 `Email_Sends` «cambiando» cuando el
  //    total cuadraba, que es la firma de filas cruzadas.
  function trozo(k, v) {
    if (k.tipo === 'fecha') { var s = typeof v === 'number' ? v : serial(t(v)); return s ? String(s) : ''; }
    if (k.tipo === 'numero') { var n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? String(n) : ''; }
    return L.nmz(v);
  }
  function llaveReg(x) { return def.llave.map(function (k) { return trozo(k, x[k.campo]); }).join('¦'); }
  function llaveFila(f) { return def.llave.map(function (k) { return trozo(k, f[k.columna]); }).join('¦'); }
  var porLlave = {}, colisiones = 0;
  regs.forEach(function (x) { var k = llaveReg(x); if (porLlave[k]) colisiones++; porLlave[k] = x; });
  if (colisiones) console.log('   🔴 la llave NO distingue ' + colisiones + ' registro(s) del bloque: emparejar sería una lotería');

  var xml = zip.readAsText(parteDe[hoja]);


  // ── columnas NUEVAS: el contrato las declara y la hoja no las tiene todavía ────────
  // 🔴 Se crean al FINAL, nunca intercaladas. Insertar una columna en medio correría todas
  //    las de la derecha y rompería cualquier fórmula o referencia que apunte por letra.
  //    Añadir al final es la única operación que no mueve nada de lo que ya está.
  var nuevas = Object.keys(cols).filter(function (c) { return cols[c].nueva && colIdx[c] === undefined; });
  if (nuevas.length && ESCRIBIR) {
    var ultima = -1; Object.keys(colIdx).forEach(function (c) { if (colIdx[c] > ultima) ultima = colIdx[c]; });
    nuevas.forEach(function (nom, k) {
      var ci = ultima + 1 + k;
      colIdx[nom] = ci;
      var ref = col(ci) + '1';
      var r2 = CX.poner(xml, ref, CX.celda(ref, nom, CX.estiloDe(xml, col(0) + '1')), 1);
      xml = r2.xml;
    });
    // el rango de la hoja tiene que crecer o Excel no ve las columnas nuevas
    xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2, r2f) {
      return '<dimension ref="' + c1 + r1 + ':' + col(ultima + nuevas.length) + r2f + '"/>';
    });
    console.log('   ➕ columnas creadas al final: ' + nuevas.join(' · '));
  } else if (nuevas.length) {
    console.log('   ➕ columnas que se CREARÍAN al final: ' + nuevas.join(' · '));
    nuevas.forEach(function (nom, k) { colIdx[nom] = 900 + k; });   // solo para contar el diff
  }

  var cambios = [], sinPareja = 0, tocables = Object.keys(cols).filter(function (c) {
    return ['bloque', 'catalogo', 'derivado'].indexOf(cols[c].de) >= 0 && colIdx[c] !== undefined;
  });

  filas.forEach(function (f, k) {
    var reg = porLlave[llaveFila(f)];
    if (!reg) { sinPareja++; return; }
    var nFila = k + 2;
    tocables.forEach(function (nom) {
      var d = cols[nom], v = valorDe(d, reg);
      if (v === undefined || v === null) return;
      if (d.tipo === 'fecha') v = serial(v);
      var actual = f[nom];
      var igual = d.tipo === 'numero' || d.tipo === 'fecha'
        ? Number(actual) === Number(v)
        : t(actual) === t(v);
      if (igual) return;
      cambios.push({ fila: nFila, columna: nom, de: t(actual) === '' ? '(vacío)' : t(actual), a: v, ref: col(colIdx[nom]) + nFila, valor: v });
    });
  });

  console.log('══ ' + hoja + ' ══');
  console.log('   filas ' + filas.length + ' · registros del bloque ' + regs.length + ' · sin pareja ' + sinPareja);
  console.log('   columnas que este escritor PUEDE tocar: ' + tocables.length + ' de ' + Object.keys(cols).length);
  // 🔴 LLENAR UN HUECO Y PISAR UN DATO NO SON LA MISMA OPERACIÓN, y el resumen las contaba juntas.
  //    «490 celdas cambiarían» no dice si son 490 huecos o 490 valores de Rick a punto de morir.
  //    Rick edita las hojas a mano —277 celdas canónicas de Data_Email son suyas— y la regla es
  //    diffear ANTES, no después: después ya se perdió. Así que se separan, y las que PISAN se
  //    listan con su valor actual para poder decidir.
  var pisa = cambios.filter(function (x) { return x.de !== '(vacío)'; });
  console.log('   celdas que cambiarían: ' + mil(cambios.length) +
    '   ·   llenan hueco: ' + mil(cambios.length - pisa.length) +
    '   ·   ' + (pisa.length ? '🔴 PISAN un valor: ' + mil(pisa.length) : 'pisan: 0'));
  var porCol = {}; cambios.forEach(function (x) { porCol[x.columna] = (porCol[x.columna] || 0) + 1; });
  var pisaCol = {}; pisa.forEach(function (x) { pisaCol[x.columna] = (pisaCol[x.columna] || 0) + 1; });
  Object.keys(porCol).sort(function (a, b) { return porCol[b] - porCol[a]; }).slice(0, 12)
    .forEach(function (c) { console.log('      ' + c.padEnd(24) + mil(porCol[c]) + (pisaCol[c] ? '   🔴 ' + mil(pisaCol[c]) + ' pisan' : '')); });
  if (pisa.length) {
    console.log('   ── qué se perdería (primeras 8):');
    pisa.slice(0, 8).forEach(function (x) {
      console.log('      ' + x.ref.padEnd(8) + x.columna.padEnd(22) + '«' + String(x.de).slice(0, 30) + '»  →  «' + String(x.a).slice(0, 30) + '»');
    });
  }
  // ══ FILAS NUEVAS · el defecto D1 ═══════════════════════════════════════════════════
  //
  // 🔴 ESTE ESCRITOR SOLO SABÍA ACTUALIZAR, NO DAR DE ALTA (corregido 15-sep-2026). El bucle de
  //    arriba recorre LAS FILAS DE LA HOJA y le busca su registro; un registro del bloque que no
  //    tuviera fila no lo visitaba nadie. Contaba `sinPareja` en un sentido —filas sin registro—
  //    y en el otro no contaba nada. Resultado: las hojas crudas llevaban corridas enteras
  //    quedándose atrás mientras el reporte salía bien, y ninguna puerta lo veía (la 1 cruza
  //    bloques contra catálogo y la 2 reporte contra rejilla: nadie mira hoja contra bloque).
  //    Medido el 15-sep: Data_Email 98 de 106, Data_WhatsApp 12 de 14, carritos 2,645 de 2,846,
  //    productos 696 de 839. Rick: «si son filas del catálogo, tienen que estar en el Excel, con
  //    todos los datos completos».
  //
  // 🔴 SE AÑADEN AL FINAL DE LOS DATOS Y NUNCA SE INSERTA EN MEDIO. Insertar correría las filas
  //    de abajo y rompería cualquier fórmula o nota que apunte a ellas.
  // 🔴 Y SI HAY ALGO DEBAJO DE LOS DATOS, NO SE ESCRIBE: SE DECLARA. Rick escribe notas a mano
  //    debajo de las tablas —ya pasó en el catálogo, y cuatro notas suyas desaparecieron de la
  //    lectura por anexar a ciegas. Aquí se comprueba que la última fila del XML sea la última
  //    fila de datos; si no lo es, este paso se planta y lo dice, en vez de adivinar dónde cabe.
  var enHoja = {};
  filas.forEach(function (f) { enHoja[llaveFila(f)] = 1; });
  var huerfanos = regs.filter(function (x) { return !enHoja[llaveReg(x)]; });
  var ultimaXml = 0;
  (function () { var m = /<row[^>]*\sr="(\d+)"/g, hit; while ((hit = m.exec(xml))) { var n = parseInt(hit[1], 10); if (n > ultimaXml) ultimaXml = n; } })();
  var ultimaDato = filas.length + 1;
  var hayAlgoDebajo = ultimaXml > ultimaDato;

  if (huerfanos.length) {
    console.log('   ➕ registros del bloque SIN fila en la hoja: ' + mil(huerfanos.length) +
      (hayAlgoDebajo ? '   🔴 NO SE AÑADEN: el XML llega a la fila ' + ultimaXml + ' y los datos acaban en la ' + ultimaDato + ' (hay algo debajo)' : ''));
    var muestra = {};
    huerfanos.forEach(function (x) { var k = t(x.pieza_id) || '(sin pieza_id)'; muestra[k] = (muestra[k] || 0) + 1; });
    Object.keys(muestra).sort().slice(0, 10).forEach(function (k) { console.log('        ' + k.padEnd(14) + mil(muestra[k])); });
    if (Object.keys(muestra).length > 10) console.log('        … y ' + (Object.keys(muestra).length - 10) + ' pieza(s) más');
  } else {
    console.log('   ✔ ningún registro del bloque se quedó sin fila');
  }
  /* 🔴 `--sin-nuevas` · ESCRIBIR SOLO EN LAS FILAS QUE YA EXISTEN (22-sep-2026).
   *    Un registro del bloque cuyas DIMENSIONES aún no existen produce una fila con métricas y
   *    sin identidad: sin campaña, sin touchpoint, sin segmento. Eso es una pieza suelta, y Rick
   *    fue explícito: «nada de duplicados, nada de piezas sueltas».
   *    Pasó con los 2 envíos de WA-J9: el bloque ya los tiene (la fuente los publica) pero el
   *    catálogo todavía no tiene su pieza, así que `BU · Marca · Campaña · Objetivo · Segmento ·
   *    TouchPoint` salían vacíos. La fila correcta existe DESPUÉS del alta, no antes.
   *    Con este flag el paso hace lo que sí puede hacer bien —actualizar lo que ya está— y deja
   *    lo demás declarado en `huerfanos`, para que se vea que falta. */
  var SIN_NUEVAS = process.argv.indexOf('--sin-nuevas') >= 0;
  var aAgregar = (hayAlgoDebajo || SIN_NUEVAS) ? [] : huerfanos;
  if (SIN_NUEVAS && huerfanos.length) {
    console.log('   ⏸ --sin-nuevas: ' + huerfanos.length + ' registro(s) NO se agregan como fila. ' +
      'Les falta su pieza en el catálogo: una fila con métricas y sin identidad es una pieza suelta.');
  }

  RESUMEN.push({ hoja: hoja, cambios: cambios.length, sinPareja: sinPareja, nuevas: aAgregar.length, bloqueadas: hayAlgoDebajo ? huerfanos.length : 0 });
  if (!cambios.length && !aAgregar.length) { console.log(''); return; }
  huboCambio = true;
  if (!ESCRIBIR) { console.log('   (no se escribe: falta --escribir)\n'); return; }

  // 🔴 SE ESCRIBE CON `lib-celda-xml`, NO CON UN REGEX A MANO. El que había aquí no distinguía
  //    una celda autocerrada (`<c r="P265"/>`, que es como queda una celda vacía) de una abierta,
  //    y al «reemplazarla» se llevaba por delante las celdas siguientes de la fila. Así perdió el
  //    `Email_Content_Name` de la fila de Purina. Sin error, sin aviso: la fila pierde columnas.

  var comoSalio = {};
  cambios.forEach(function (x) {
    var nueva = CX.celda(x.ref, x.valor, CX.estiloDe(xml, x.ref));
    var r2 = CX.poner(xml, x.ref, nueva, x.fila);
    xml = r2.xml; comoSalio[r2.como] = (comoSalio[r2.como] || 0) + 1;
  });
  // ── y ahora las filas nuevas, después de las celdas ────────────────────────────────
  if (aAgregar.length) {
    // 🔴 EL ESTILO SE HEREDA DE LA ÚLTIMA FILA DE DATOS, columna por columna. No se inventa un
    //    formato: una fila nueva con otro formato se ve como un parche, y el formato lo edita Rick.
    var estiloCol = {};
    Object.keys(colIdx).forEach(function (nom) {
      estiloCol[nom] = CX.estiloDe(xml, col(colIdx[nom]) + ultimaDato);
    });
    // las columnas que una fila NUEVA puede llevar: las que este escritor toca + las de la llave
    var deLaLlave = def.llave.map(function (k) { return k.columna; }).filter(function (c) { return colIdx[c] !== undefined; });
    var columnasNuevas = tocables.slice();
    deLaLlave.forEach(function (c) { if (columnasNuevas.indexOf(c) < 0) columnasNuevas.push(c); });
    // 🔴 EN ORDEN DE COLUMNA. Excel exige que las celdas de una fila vayan en orden ascendente;
    //    la quinta capa (`xlsx-orden-celdas`) existe justo porque esto ya rompió un libro antes.
    columnasNuevas.sort(function (a, b) { return colIdx[a] - colIdx[b]; });

    var vacias = {};
    var filasXml = aAgregar.map(function (reg, i) {
      var nFila = ultimaDato + 1 + i;
      var celdas = columnasNuevas.map(function (nom) {
        var d = cols[nom] || { de: 'bloque', campo: null };
        var v;
        if (d.campo === undefined || !cols[nom]) {
          // columna de la llave que el contrato no declara como escribible: sale del propio campo
          var kk = def.llave.filter(function (k) { return k.columna === nom; })[0];
          v = kk ? reg[kk.campo] : undefined;
        } else {
          v = valorDe(d, reg);
        }
        if (v === undefined || v === null || t(v) === '') { vacias[nom] = (vacias[nom] || 0) + 1; return ''; }
        if (d.tipo === 'fecha') v = serial(v);
        return CX.celda(col(colIdx[nom]) + nFila, v, estiloCol[nom]);
      }).join('');
      return '<row r="' + nFila + '">' + celdas + '</row>';
    }).join('');

    // se insertan justo después de la última fila de datos (que aquí es la última del XML:
    // si hubiera algo debajo, `aAgregar` estaría vacío y no llegaríamos aquí)
    xml = xml.replace('</sheetData>', filasXml + '</sheetData>');
    // 🔴 la dimensión solo puede CRECER — nunca se declara un fin menor del que ya había
    xml = xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, function (todo, c1, r1, c2, r2) {
      return '<dimension ref="' + c1 + r1 + ':' + c2 + Math.max(parseInt(r2, 10) || 0, ultimaDato + aAgregar.length) + '"/>';
    });
    console.log('   ➕ ' + mil(aAgregar.length) + ' fila(s) nuevas, de la ' + (ultimaDato + 1) + ' a la ' + (ultimaDato + aAgregar.length) +
      '   ·   ' + columnasNuevas.length + ' columnas por fila');
    var huecos = Object.keys(vacias).filter(function (c) { return vacias[c] === aAgregar.length; });
    if (huecos.length) console.log('      ⚠ el bloque no trae valor para: ' + huecos.slice(0, 8).join(' · ') + (huecos.length > 8 ? ' … +' + (huecos.length - 8) : ''));
  }

  zip.updateFile(parteDe[hoja], Buffer.from(xml, 'utf8'));
  console.log('   ✔ ' + mil(cambios.length) + ' celdas escritas   (' +
    Object.keys(comoSalio).map(function (k) { return k + ' ' + comoSalio[k]; }).join(' · ') + ')');
  if (comoSalio['sin fila']) console.log('   🔴 ' + comoSalio['sin fila'] + ' celdas NO se pudieron escribir: su fila no existe en el XML');
  console.log('');
});

if (!ESCRIBIR) {
  console.log('\n  ── solo diff. Para escribir: node escritor.escribir.js --escribir');
  process.exit(0);
}
if (!huboCambio) { console.log('\n  ✔ nada que escribir: la hoja ya dice lo que dice el bloque'); process.exit(0); }

zip.writeZip(SECO);
console.log('  ── safe-save');
var res = safeSave(SECO, SECO);
console.log('     validado: ' + (res.validado || '?'));
console.log('\n  archivo listo en: ' + SECO);
console.log('  ⚠ NO se copió al original: eso lo hace el paso siguiente, tras la cadena de validación.');
