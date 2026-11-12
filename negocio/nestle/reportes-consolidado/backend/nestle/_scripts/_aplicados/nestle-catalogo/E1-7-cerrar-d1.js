// E1.7 · CERRAR LA DEUDA D1 — el catálogo sin fecha ni segmento completo.
//
// 🔴 QUÉ SE MIDIÓ EN LA ETAPA 0: 31 piezas del catálogo no tienen `Quincena_Lanzamiento`, y
//    NINGUNA tiene fecha. 12 son Pro Plan CONFIRMADAS con envíos reales. Eso produce 7 colisiones
//    en la llave del reporte y deja 22 filas sin cruzar.
//
// 🔴 Y LO IMPORTANTE: el dato NO falta. SFMC entrega `Fecha_Primer_Envio` en **98 de 98** piezas,
//    y además un `Segmento` MÁS ESPECÍFICO que el que el catálogo guarda:
//        catálogo → «Pro Plan Pet Parents»            (3 piezas colisionan)
//        SFMC     → «Pro Plan Pet Parents · Perros»   ← esto las distingue
//    No falta el dato: faltaba cargarlo.
//
// 🔴 REGLA DURA DE RICK: **Pro Plan son 17 piezas y SE MANTIENEN TODAS.** Este paso no fusiona
//    nada: al contrario, carga lo que las separa. Si alguna vez el conteo baja de 17, es un bug.
//
// 🔴 NO PISA LO QUE YA ESTÁ BIEN: solo llena lo vacío y corrige lo que contradice a SFMC, y cada
//    corrección queda declarada con su valor anterior.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var Q = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-quincena.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ E1.7 · CERRAR D1 ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('E1.7');

// ── 1 · LEE · la autoridad
var D = JSON.parse(fs.readFileSync(BACK + '/_insumos/sfmc-piezas-20ago.txt', 'utf8'));
var porEid = {}, porNombre = {};
D.rows.forEach(function (r) {
  porEid[t(r.Email_ID)] = r;
  porNombre[t(r.Email_Content_Name)] = r;
});
console.log('  SFMC: ' + D.rows.length + ' piezas · con fecha ' +
  D.rows.filter(function (r) { return t(r.Fecha_Primer_Envio); }).length + '/' + D.rows.length);

var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var P = CB.vistaFutura('Catalogo_Piezas', XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false }));

// 🔴 EL NOMBRE FÍSICO SE PIDE AL REGISTRO, no se escribe. A11 renombró «EmailID» a
//    «Email_ID (de la DE de SFMC)»: hardcodearlo hacía que el cruce por id fallara en silencio y
//    cayera al cruce por nombre. Funcionaba, pero por accidente — y un cruce que funciona por
//    accidente es el que se rompe cuando el nombre vuelve a cambiar.
var RG = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-registro.js');
var encCat = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var hCat = RG.abrir('catalogo', encCat, { silencioso: true });
function col(id, respaldo) { try { return hCat.n(id); } catch (e) { return respaldo; } }
var C_EID = col('catalogo.emailid', 'EmailID');
var C_NOM = col('catalogo.content_name', 'Email_Name');
console.log('  columnas (vía registro): ' + C_EID + ' · ' + C_NOM);

// ── 2 · ATRIBUYE · cada pieza a su fila de SFMC, por EmailID o por Email_Name
var cambios = [], sinFuente = [], proplan = 0;
P.forEach(function (p, i) {
  var fila = i + 2, id = t(p['Pieza_ID']);
  var eid = t(p[C_EID]), nom = t(p[C_NOM]);
  var s = (eid && porEid[eid]) || (nom && porNombre[nom]) || null;
  if (/^009-/.test(id)) proplan++;
  if (!s) {
    if (t(p['Canal']) !== 'WhatsApp' && !/Retirada/i.test(t(p['Estado'])))
      sinFuente.push({ id: id, canal: t(p['Canal']), estado: t(p['Estado']) });
    return;
  }
  var via = (eid && porEid[eid]) ? 'EmailID ' + eid : 'Email_Name';

  // 2a · la QUINCENA, derivada de la fecha con la regla única
  var qSFMC = Q.deFecha(s.Fecha_Primer_Envio);
  var qCat = t(p['Quincena_Lanzamiento']);
  var qCatN = Q.normalizar(qCat);
  if (qSFMC && qCatN !== qSFMC) {
    cambios.push({ fila: fila, id: id, col: 'Quincena_Lanzamiento', antes: qCat || '(vacía)', ahora: qSFMC,
      porque: 'la fecha de SFMC (' + t(s.Fecha_Primer_Envio).slice(0, 10) + ') cae en ' + qSFMC +
        ' con la regla día 1-15 = Q1 · 16-fin = Q2. Vía ' + via + '.' });
  }

  // 2b · la FECHA, para que el catálogo pueda re-derivar sin volver a SFMC.
  // 🔴 También se CORRIGE si contradice: una fecha vieja que no cuadra con su quincena deja el
  //    catálogo diciendo dos cosas distintas sobre el mismo envío, y el guardián no puede saber
  //    cuál creer. Es lo que pasó con 001-P001 y 001-P005.
  var fS = Q.aFecha(s.Fecha_Primer_Envio);
  if (fS) {
    var iso = fS.toISOString().slice(0, 10);
    var fC = Q.aFecha(p['Fecha_Primer_Envio']);
    var isoC = fC ? fC.toISOString().slice(0, 10) : '';
    if (isoC !== iso) {
      cambios.push({ fila: fila, id: id, col: 'Fecha_Primer_Envio', antes: isoC || '(vacía)', ahora: iso,
        porque: isoC ? 'la fecha del catálogo contradecía a SFMC; con la de SFMC la quincena se re-deriva y ya no se contradicen.'
                     : 'SFMC la entrega y el catálogo no la tenía. Con ella la quincena se re-deriva sin volver a la fuente.' });
    }
  }

  // 2c · el SEGMENTO completo — lo que DISTINGUE las piezas de Pro Plan
  var segS = t(s.Segmento).replace(/\*+$/, '').trim();
  var segC = t(p['Segmento']);
  if (segS && segS !== segC && segS.length > segC.length && segS.indexOf(segC) === 0) {
    cambios.push({ fila: fila, id: id, col: 'Segmento', antes: segC || '(vacío)', ahora: segS,
      porque: 'SFMC entrega el segmento COMPLETO y el catálogo guardaba el corto. Es lo que distingue ' +
        'las piezas de Pro Plan entre sí — sin esto colisionan en la llave del reporte.' });
  } else {
    // 🔴 EL CASO PAE. SFMC dice «Pro Plan PAE (por confirmar) · Perros» y el catálogo dice
    //    «Aspiracionales + Educated Pet Owners». El nombre del catálogo es el BUENO: Rick descartó
    //    «PAE» explícitamente. Pero el SUFIJO DE MASCOTA sí es un dato que solo SFMC tiene, y es lo
    //    único que separa a P015/P016/P017 entre sí. Se toma el sufijo, no el nombre.
    var suf = /·\s*(Perros|Gatos|Mixto)\s*$/.exec(segS);
    if (suf && segC && !/·\s*(Perros|Gatos|Mixto)\s*$/.test(segC)) {
      cambios.push({ fila: fila, id: id, col: 'Segmento', antes: segC, ahora: segC + ' · ' + suf[1],
        porque: 'SFMC declara el desglose por mascota (· ' + suf[1] + ') y es lo único que separa estas ' +
          'piezas entre sí. Se toma SOLO el sufijo: el nombre del catálogo se conserva porque Rick ' +
          'descartó «PAE» y «Aspiracionales + Educated Pet Owners» es la lectura buena.' });
    }
  }

  // 2d · el EmailID, cuando el catálogo trae uno que SFMC ya no conoce
  // 🔴 Tres piezas de Pro Plan declaran un EmailID que no existe en la DE (83347, 83930, 84261).
  //    El Email_Name SÍ cruza — la llave natural aguanta lo que el id numérico no. SFMC manda.
  var eidS = t(s.Email_ID), eidC = t(p[C_EID]);
  if (eidS && eidC && eidS !== eidC) {
    cambios.push({ fila: fila, id: id, col: C_EID, antes: eidC, ahora: eidS,
      porque: 'el catálogo declaraba el EmailID ' + eidC + ', que SFMC ya no conoce. Cruzando por ' +
        'Email_Name (la llave natural) la pieza es el eid ' + eidS + '. SFMC es la autoridad.' });
  }
});

console.log('  Pro Plan en el catálogo: ' + proplan + ' piezas   ' + (proplan === 17 ? '✔ las 17' : '🔴 esperaba 17'));
console.log('\n  ── cambios: ' + cambios.length);
var porCol = {};
cambios.forEach(function (c) { porCol[c.col] = (porCol[c.col] || 0) + 1; });
Object.keys(porCol).forEach(function (c) { console.log('     ' + String(porCol[c]).padStart(4) + '  ' + c); });

console.log('\n  ── los de Segmento (los que desambiguan Pro Plan):');
cambios.filter(function (c) { return c.col === 'Segmento'; }).slice(0, 10).forEach(function (c) {
  console.log('     ' + c.id.padEnd(10) + '«' + c.antes + '» → «' + c.ahora + '»');
});
console.log('\n  ── los de Quincena (una muestra):');
cambios.filter(function (c) { return c.col === 'Quincena_Lanzamiento'; }).slice(0, 8).forEach(function (c) {
  console.log('     ' + c.id.padEnd(10) + c.antes.padEnd(14) + '→ ' + c.ahora);
});
if (sinFuente.length) {
  console.log('\n  ⚠ piezas de email sin fila en SFMC (' + sinFuente.length + '):');
  sinFuente.slice(0, 6).forEach(function (x) { console.log('     ' + x.id.padEnd(10) + x.canal.padEnd(10) + x.estado); });
}

fs.writeFileSync(BACK + '/_catalogo/d1-cerrada.json', JSON.stringify({
  paso: 'E1.7', fecha: '2026-08-24',
  que_cierra: 'La deuda D1: 31 piezas sin quincena y sin fecha, 12 de ellas Pro Plan con envios reales.',
  como: 'SFMC entrega Fecha_Primer_Envio en 98/98 y un Segmento mas especifico. No faltaba el dato: faltaba cargarlo.',
  regla_dura: 'Pro Plan son 17 piezas y se mantienen TODAS. Este paso carga lo que las separa, no las fusiona.',
  cambios: cambios, piezas_sin_fuente: sinFuente, proplan_en_catalogo: proplan
}, null, 1));
console.log('\n  → _catalogo/d1-cerrada.json');

if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }
cambios.forEach(function (c) {
  CB.apuntar('E1.7', 'Catalogo_Piezas', c.fila, c.col, c.ahora, 'E1.7 · ' + c.porque + ' Antes: «' + c.antes + '».');
});
var res = CB.resumen();
console.log('\n  ── apuntados ' + cambios.length + '. Acumulado: ' + res.total + '   ·   choques: ' + res.choques);
console.log('\n  NO se tocó el archivo.');
