// FUSIONA las columnas fantasma del catálogo con su columna viva — ANTES de que nadie retire nada.
//
// 🔴 LA REGLA ES DE RICK Y NO ADMITE ATAJO: «vieja y nueva → SE QUEDAN AMBOS. Eso no es por definir;
//    cuando es la vieja y la nueva siempre se quedan ambos, o varios.» Fusionar NO es elegir.
//    Donde solo una tiene dato, se copia. Donde las dos tienen y coinciden, no se toca. Donde las
//    dos tienen y DISCREPAN, la viva pasa a decir `A · B` — las dos, separadas por «·», que es el
//    mismo separador que ya usa `Email_Name` para sus variantes.
//
// 🔴 Y VA ANTES DEL RETIRO, SIEMPRE. Hoy 24 piezas de la campaña 009 tienen su número SOLO en
//    `EmailID`. Retirar primero y fusionar después no es un orden distinto: es perder 24 datos.
//
// 🔴 ESCRIBE CELDA POR CELDA, NO REGENERA. Poner un valor en una celda que ya existe no mueve
//    nada; reconstruir la hoja sí puede. El retiro —que sí toca la estructura— es otro paso, con
//    su propia prueba (`escritor.probar-retiro.js`).
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var AdmZip = require('adm-zip');
var L = require(__dirname + '/lib-flexible.js');
var CX = require(__dirname + '/lib-celda-xml.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var SEP = ' · ';

// las parejas se DECLARAN aquí, con su hoja. No se detectan por parecido: una columna se llama
// fantasma porque alguien lo decidió, no porque su nombre se parezca a otro.
var PAREJAS = [
  { hoja: 'Catalogo_Piezas', viva: 'Email_ID (de la DE de SFMC)', fantasma: 'EmailID' },
  { hoja: 'Catalogo_Piezas', viva: 'Email_Name', fantasma: 'Email_Name_Legacy (duplicada, no usar)' }
];

function letraDeNum(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

console.log('════════ FUSIÓN DE COLUMNAS FANTASMA ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var vivo = L.archivoVivo({ dir: PROY });
var copia = require('path').resolve(__dirname, '..') + '/_tmp/_fusion.xlsx';
fs.copyFileSync(vivo.ruta, copia);
console.log('  libro: ' + path.basename(vivo.ruta) + '\n');

var wb = XLSX.readFile(copia);
var plan = [], resumen = [];

PAREJAS.forEach(function (P) {
  var ws = wb.Sheets[P.hoja];
  if (!ws) { console.log('  ⊘ no está la hoja ' + P.hoja); return; }
  var R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  var enc = R[0].map(t), filas = R.slice(1);
  var iV = enc.indexOf(P.viva), iF = enc.indexOf(P.fantasma);
  console.log('══ ' + P.fantasma + '  →  ' + P.viva + ' ══');
  if (iV < 0 || iF < 0) {
    console.log('   ⊘ NO PUDE EVALUAR — ' + (iV < 0 ? 'falta la viva' : 'ya no está la fantasma') + ': nada que fusionar\n');
    resumen.push({ pareja: P, estado: iF < 0 ? 'la fantasma ya no existe' : 'falta la columna viva' });
    return;
  }
  var copia_ = 0, ambos = 0, iguales = 0, vacias = 0, soloViva = 0;
  filas.forEach(function (r, k) {
    var a = t(r[iV]), b = t(r[iF]);
    var fila = k + 2;
    if (!a && !b) { vacias++; return; }
    if (a && !b) { soloViva++; return; }
    if (!a && b) {
      plan.push({ hoja: P.hoja, ref: letraDeNum(iV + 1) + fila, valor: b, por: 'solo la fantasma tenía dato' });
      copia_++; return;
    }
    if (a === b) { iguales++; return; }
    // 🔴 discrepan: NO se elige. Si la viva ya contiene a la fantasma, no se duplica.
    var partes = a.split('·').map(t);
    if (partes.indexOf(b) >= 0) { ambos++; return; }
    plan.push({ hoja: P.hoja, ref: letraDeNum(iV + 1) + fila, valor: a + SEP + b, por: 'discrepan → SE QUEDAN AMBOS' });
    ambos++;
  });
  console.log('   ambas vacías ' + vacias + '  ·  solo la viva ' + soloViva + '  ·  iguales ' + iguales);
  console.log('   → se copian de la fantasma: ' + copia_ + '   ·   quedan AMBOS: ' + ambos);
  resumen.push({ pareja: P, copia: copia_, ambos: ambos, iguales: iguales, soloViva: soloViva, vacias: vacias });
  console.log();
});

console.log('  celdas a escribir: ' + plan.length);
plan.slice(0, 8).forEach(function (p) { console.log('     ' + p.ref.padEnd(8) + String(p.valor).slice(0, 46).padEnd(48) + p.por); });
if (plan.length > 8) console.log('     … y ' + (plan.length - 8) + ' más');

fs.writeFileSync(BACK + '/_contratos/fusion-fantasmas.json', JSON.stringify({
  paso: 'catalogo.fusionar-fantasmas', regla: 'vieja y nueva: SE QUEDAN AMBOS (Rick, 25-ago). Fusionar no es elegir.',
  medido: 'contra el libro vivo, en esta corrida', parejas: resumen, celdas: plan
}, null, 1));

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
if (!plan.length) { console.log('\n  ✔ nada que fusionar — las parejas ya están fusionadas'); process.exit(0); }

// ── escribir celda por celda sobre el XML
var zip = new AdmZip(copia);
var wbx = zip.readAsText('xl/workbook.xml'), rels = zip.readAsText('xl/_rels/workbook.xml.rels');
var rmap = {}; rels.replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, i, tg) { rmap[i] = tg; return _; });
var parteDe = {};
wbx.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g, function (_, n, rid) { parteDe[n] = 'xl/' + String(rmap[rid]).replace(/^\//, ''); return _; });

var porHoja = {};
plan.forEach(function (p) { (porHoja[p.hoja] = porHoja[p.hoja] || []).push(p); });
// 🔴 `CX.poner` NO devuelve el XML: devuelve `{ xml, como }`, y `como` dice por qué camino entró
//    —reemplazada · autocerrada · insertada · sin fila—. Tratarlo como string mete un objeto en
//    `Buffer.from` y truena; peor sería que no tronara. Se lee `como` y se cuenta: si alguna celda
//    entra como «sin fila», es que la fila no existe y ese valor se habría perdido en silencio.
//    Y la celda se CONSTRUYE con `CX.celda`, conservando el estilo que ya tenía: escribir el valor
//    pelado dejaría la celda sin formato.
var comos = {};
Object.keys(porHoja).forEach(function (h) {
  var parte = parteDe[h];
  var xml = zip.readAsText(parte);
  porHoja[h].forEach(function (p) {
    var fila = Number((/\d+/.exec(p.ref) || [0])[0]);
    var estilo = CX.estiloDe(xml, p.ref);
    // 🔴 EL TIPO SE CONSERVA: un id que se escribe como texto deja de ordenar y de cruzar.
    var v = /^-?\d+(\.\d+)?$/.test(p.valor) ? Number(p.valor) : p.valor;
    var r = CX.poner(xml, p.ref, CX.celda(p.ref, v, estilo), fila);
    xml = r.xml; comos[r.como] = (comos[r.como] || 0) + 1;
  });
  zip.updateFile(parte, Buffer.from(xml, 'utf8'));
});
console.log('   caminos: ' + Object.keys(comos).map(function (k) { return k + ' ' + comos[k]; }).join(' · '));
if (comos['sin fila']) { console.log('   🔴 ' + comos['sin fila'] + ' celda(s) sin fila donde caer — NO se publica'); process.exit(1); }
zip.writeZip(copia);

// ── las CINCO capas, y solo entonces se publica
var cp = require('child_process');
var NODE = process.execPath, PY = require(__dirname + '/lib-entorno.js').PYTHON;
var capas = [
  [NODE, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-safe-save.js', copia]],
  [NODE, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-label.js', copia]],
  [NODE, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-check.js', copia]],
  [PY, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-validar-fondo.py', copia]],
  [NODE, [require(__dirname + '/lib-entorno.js').TOOLS + '/xlsx-orden-celdas.js', copia]]
];
var falla = null;
capas.forEach(function (c) {
  if (falla) return;
  var r = cp.spawnSync(c[0], c[1], { encoding: 'utf8' });
  var nom = path.basename(c[1][0]);
  if (r.status !== 0) { falla = nom + ': ' + ((r.stdout || '') + (r.stderr || '')).slice(-300); }
  console.log('   ' + (r.status === 0 ? '✔' : '🔴') + ' ' + nom);
});
if (falla) { console.log('\n🔴 NO SE PUBLICA — ' + falla); process.exit(1); }

fs.copyFileSync(copia, vivo.ruta);
console.log('\n  📤 publicado · ' + plan.length + ' celda(s) fusionadas');

// ── releer del DISCO y comprobar que está lo que se dijo
var wb2 = XLSX.readFile(vivo.ruta);
var malas = 0;
Object.keys(porHoja).forEach(function (h) {
  var ws = wb2.Sheets[h];
  porHoja[h].forEach(function (p) {
    var c = ws[p.ref];
    if (!c || t(c.v) !== t(p.valor)) { malas++; if (malas <= 5) console.log('   🔴 ' + p.ref + ' dice «' + (c ? t(c.v) : '(vacía)') + '» y debía decir «' + p.valor + '»'); }
  });
});
console.log('   ' + (malas === 0 ? '✔' : '🔴') + ' releído del disco: ' + (plan.length - malas) + ' de ' + plan.length + ' celdas dicen lo que se escribió');
process.exit(malas ? 1 : 0);
