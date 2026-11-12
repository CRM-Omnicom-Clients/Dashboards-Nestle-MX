// FG · G2 — EL DIFF EXPLICADO: qué cambió en Report_Resumen y POR QUÉ.
//
// 🔴 SE EMPAREJA POR IDENTIDAD + QUINCENA, NUNCA POR NÚMERO DE FILA. Un diff por índice miente
//    en cuanto alguien inserta una fila: la copia de referencia tiene 73 filas y el vivo 74, así
//    que a partir de la primera inserción TODAS las filas «cambian». Pasó en esta misma sesión y
//    me hizo perseguir 60 diferencias falsas antes de notar el desfase.
//
// 🔴 UN DIFF QUE SOLO LISTA NO SIRVE: cada diferencia se CLASIFICA por causa, y las causas se
//    cuentan. Lo único que hay que mirar a mano es lo que no cae en ninguna causa conocida.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path');
var L = require(__dirname + '/lib-flexible.js');
var PROY = ENT.PROYECTO;
var BACK = require('path').resolve(__dirname, '..');
var t = function (v) { return String(v == null ? '' : v).trim(); };
var nmz = function (v) { return t(v).toLowerCase(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }
function numOf(v) { var n = parseFloat(t(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n; }

var ANTES = process.argv[2] ||
  (PROY + '/_backups/(Interno)-Reporte-Consolidado-Nestle-2026-v8__ANTES-sustituir-reporte.xlsx');
if (!fs.existsSync(ANTES)) { console.log('🔴 no existe la copia de referencia:\n   ' + ANTES); process.exit(1); }

var A = require('path').resolve(__dirname, '..') + '/_tmp/_dg-antes.xlsx', C = require('path').resolve(__dirname, '..') + '/_tmp/_dg-vivo.xlsx';
fs.copyFileSync(ANTES, A);
var vivo = L.archivoVivo({ dir: PROY });
fs.copyFileSync(vivo.ruta, C);

function leer(p) { return XLSX.utils.sheet_to_json(XLSX.readFile(p).Sheets['Report_Resumen'], { defval: '', blankrows: false }); }
var Fa = leer(A), Fb = leer(C);
console.log('════════ FG · DIFF EXPLICADO ════════\n');
console.log('  antes : ' + path.basename(ANTES) + '   (' + Fa.length + ' filas)');
console.log('  ahora : ' + path.basename(vivo.ruta) + '   (' + Fb.length + ' filas)\n');

// 🔴 la fila de totales no tiene TouchPoint. No se diffea: es una consecuencia, no una causa.
function conId(F) { return F.filter(function (x) { return t(x['TouchPoint']); }); }
function llave(x) { return [x['Campaña'], x['Objetivo'], x['TouchPoint'], x['Segmento'], x['Quincena_Lanzamiento']].map(nmz).join('¦'); }
function idSinQ(x) { return [x['Campaña'], x['Objetivo'], x['TouchPoint'], x['Segmento']].map(nmz).join('¦'); }
var Da = conId(Fa), Db = conId(Fb);
var iA = {}, iB = {};
Da.forEach(function (x) { iA[llave(x)] = x; });
Db.forEach(function (x) { iB[llave(x)] = x; });

// ── 1 · filas que aparecen, desaparecen o cambiaron de quincena
var soloB = Db.filter(function (x) { return !iA[llave(x)]; });
var soloA = Da.filter(function (x) { return !iB[llave(x)]; });
// 🔴 una fila «nueva» cuya identidad ya estaba con OTRA quincena no es un alta: es una quincena
//    corregida. Contarla como alta hace creer que entró volumen nuevo cuando solo se movió.
var reQuincena = [];
soloB.slice().forEach(function (b) {
  var par = soloA.filter(function (a) { return idSinQ(a) === idSinQ(b); })[0];
  if (par) {
    reQuincena.push({ id: idSinQ(b), de: t(par['Quincena_Lanzamiento']), a: t(b['Quincena_Lanzamiento']), fila: b, antes: par });
    soloB.splice(soloB.indexOf(b), 1);
    soloA.splice(soloA.indexOf(par), 1);
  }
});

console.log('── 1 · filas');
console.log('   emparejadas por identidad+quincena : ' + Db.filter(function (x) { return iA[llave(x)]; }).length);
console.log('   con la QUINCENA corregida          : ' + reQuincena.length);
reQuincena.forEach(function (r) {
  console.log('      · ' + r.id.split('¦').slice(0, 4).join(' · ') + '   ' + r.de + ' → ' + r.a +
    '   (Tot_Sends ' + mil(numOf(r.antes['Tot_Sends'])) + ' → ' + mil(numOf(r.fila['Tot_Sends'])) + ')');
});
console.log('   filas NUEVAS                       : ' + soloB.length);
soloB.forEach(function (x) { console.log('      + ' + llave(x).split('¦').join(' · ') + '   ' + mil(numOf(x['Tot_Sends'])) + ' envíos'); });
console.log('   filas que YA NO ESTÁN              : ' + soloA.length);
soloA.forEach(function (x) { console.log('      − ' + llave(x).split('¦').join(' · ') + '   ' + mil(numOf(x['Tot_Sends'])) + ' envíos'); });

// ── 2 · celdas: qué cambió y por qué
var CAUSAS = [
  ['dimensión canónica del catálogo', function (c) { return /^(Marca|BU|Medio|Objetivo)$/.test(c); }],
  ['identificadores de SFMC', function (c) { return /^(Content_ID|Email_ID)/.test(c); }],
  ['métrica de email', function (c) { return /^(Principal_|FUP_|Tot_)/.test(c); }],
  ['bloque de Qcart', function (c) { return /^(QCART|Carritos_|Views_|Intencion_|Pct_Penetracion|Ticket_|Receta_|FechaQcart)/.test(c); }],
  ['WhatsApp', function (c) { return /^WA-/.test(c); }],
  ['quincena / periodo', function (c) { return /Quincena|^Mes/.test(c); }]
];
function causaDe(col) {
  for (var i = 0; i < CAUSAS.length; i++) if (CAUSAS[i][1](col)) return CAUSAS[i][0];
  return 'otra (revisar a mano)';
}
var porCausa = {}, porColumna = {}, celdas = 0, filasTocadas = 0, sinCausa = [];
var llenadas = 0, limpiadas = 0, cambiadas = 0;
Db.forEach(function (b) {
  var a = iA[llave(b)];
  if (!a) return;
  var hubo = false;
  Object.keys(b).forEach(function (col) {
    var va = t(a[col]), vb = t(b[col]);
    if (va === vb) return;
    var na = numOf(va), nb = numOf(vb);
    if (na !== null && nb !== null && Math.abs(na - nb) < 0.005) return;   // ruido de redondeo
    hubo = true; celdas++;
    var cau = causaDe(col);
    porCausa[cau] = (porCausa[cau] || 0) + 1;
    porColumna[col] = (porColumna[col] || 0) + 1;
    if (!va && vb) llenadas++; else if (va && !vb) limpiadas++; else cambiadas++;
    if (cau === 'otra (revisar a mano)' && sinCausa.length < 25) {
      sinCausa.push(llave(b).split('¦').slice(0, 4).join(' · ') + '  [' + col + ']  "' + va.slice(0, 20) + '" → "' + vb.slice(0, 20) + '"');
    }
  });
  if (hubo) filasTocadas++;
});
console.log('\n── 2 · celdas en las filas emparejadas');
console.log('   filas con algún cambio : ' + filasTocadas + ' de ' + Db.filter(function (x) { return iA[llave(x)]; }).length);
console.log('   celdas cambiadas       : ' + celdas + '   (se llenaron ' + llenadas + ' · se limpiaron ' + limpiadas + ' · cambiaron de valor ' + cambiadas + ')');
console.log('\n   por causa:');
Object.keys(porCausa).sort(function (a, b) { return porCausa[b] - porCausa[a]; })
  .forEach(function (k) { console.log('      ' + String(porCausa[k]).padStart(4) + '  ' + k); });
console.log('\n   columnas más tocadas:');
Object.keys(porColumna).sort(function (a, b) { return porColumna[b] - porColumna[a]; }).slice(0, 10)
  .forEach(function (k) { console.log('      ' + String(porColumna[k]).padStart(4) + '  ' + k); });
if (sinCausa.length) {
  console.log('\n   🔴 las que no caen en ninguna causa conocida:');
  sinCausa.forEach(function (s) { console.log('      ' + s); });
}

// ── 3 · el efecto en los totales, que es lo que la gente lee
console.log('\n── 3 · totales (solo filas con identidad; la de totales de Rick no cuenta)');
['Tot_Sends', 'Tot_Deliveries', 'Tot_Opens', 'Tot_Clicks', 'WA-Envíos', 'Carritos_Total', 'Intencion_Total_MXN'].forEach(function (c) {
  var sa = Da.reduce(function (s, x) { return s + (numOf(x[c]) || 0); }, 0);
  var sb = Db.reduce(function (s, x) { return s + (numOf(x[c]) || 0); }, 0);
  var d = sb - sa;
  console.log('   ' + c.padEnd(20) + mil(Math.round(sa)).padStart(13) + '  →  ' + mil(Math.round(sb)).padStart(13) +
    '   ' + (d === 0 ? 'igual' : (d > 0 ? '+' : '') + mil(Math.round(d))));
});

fs.writeFileSync(BACK + '/_fuentes/diff-explicado.json', JSON.stringify({
  paso: 'G2', antes: path.basename(ANTES), ahora: path.basename(vivo.ruta),
  filas: {
    antes: Fa.length, ahora: Fb.length, nuevas: soloB.length,
    retiradas: soloA.length, requincena: reQuincena.length, tocadas: filasTocadas
  },
  celdas: celdas, llenadas: llenadas, limpiadas: limpiadas, cambiadas: cambiadas,
  por_causa: porCausa, por_columna: porColumna, sin_causa: sinCausa
}, null, 1));
console.log('\n  → _fuentes/diff-explicado.json');
