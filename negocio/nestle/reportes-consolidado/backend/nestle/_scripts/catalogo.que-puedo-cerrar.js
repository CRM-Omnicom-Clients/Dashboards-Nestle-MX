/*
 * catalogo.que-puedo-cerrar.js — de los POR DEFINIR, ¿cuáles tengo la fuente para cerrar HOY?
 *
 * POR QUÉ: Rick, 14-sep-2026: «revisa que si tienes para resolver, lo que no me dices, porfavor
 * y vamos un grupo a la vez». La lista de POR DEFINIR dice **quién** puede cerrarlos; esto dice
 * algo distinto y más accionable: **cuáles ya se pueden cerrar con lo que hay en disco**.
 *
 * 🔴 «TENGO LA FUENTE» NO ES «PUEDO DEDUCIRLO». Una celda solo cuenta como resoluble si existe un
 *    dato REAL que la conteste —el maestro, el bloque, la DE—. Heredarla de una pieza hermana
 *    «porque todas coinciden» es derivar por parecido, y eso ya se rechazó una vez: dos piezas del
 *    mismo touchpoint pueden haber mandado en semanas distintas.
 *
 * 🔴 Y SE SEPARA LO QUE ES `N/A` DE LO QUE FALTA. Si una pieza no tiene Chedraui, su
 *    `Cod_Chedraui_2` no está «pendiente»: NO APLICA. Marcarlo como hueco infla la deuda con algo
 *    que nadie va a cerrar nunca — es el mismo defecto que reportaba 5,923 huecos irreales.
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var COL = require(__dirname + '/lib-columna.js');
var LK = require(__dirname + '/lib-qcart-links.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var TOKEN = /^(N\/A|POR DEFINIR|PENDIENTE)$/i;
var GRUPO = (function () { var i = process.argv.indexOf('--grupo'); return i > 0 ? process.argv[i + 1] : 'QCART'; })();

var inf = JSON.parse(fs.readFileSync(BACK + '/_preescritura/informe-por-definir.json', 'utf8'));
var filas = inf.filas.filter(function (f) { return f.grupo === GRUPO; });

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_qpc.xlsx';
fs.copyFileSync(ENT.LIBRO, tmp);
var P = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '' });
fs.unlinkSync(tmp);
var NM_ID = COL.de(P, 'Pieza' + '_ID', 'catalogo');
var pieza = {};
P.forEach(function (p) { var id = t(p[NM_ID]); if (id) pieza[id] = p; });

var MAE = LK.leer(PROY + '/ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx');
var Q = JSON.parse(fs.readFileSync(BACK + '/_fuentes/qcart.json', 'utf8'));

// ── la DE de SFMC, del volcado vigente, indexada por Email_Name ─────────────
// 🔴 Se indexa por el NOMBRE, que es la llave natural probada — nunca por `ConfigKey`: esa BU
//    publica Liga MX con claves provisionales (`TMP-MAGGI-J7-B-C`) que no son el Pieza_ID.
var SFMC = {};
(function () {
  var d = BACK + '/_insumos';
  var c = fs.readdirSync(d).filter(function (f) { return /^sfmc-piezas-\d{4}-\d{2}-\d{2}\.txt$/.test(f); }).sort();
  if (!c.length) return;
  JSON.parse(fs.readFileSync(d + '/' + c[c.length - 1], 'utf8')).rows.forEach(function (r) {
    if (t(r.EmailName)) SFMC[t(r.EmailName)] = r;
    if (t(r.Journey_Name)) SFMC[t(r.Journey_Name)] = SFMC[t(r.Journey_Name)] || r;
  });
})();

// ── lo que el bloque sabe de cada pieza ─────────────────────────────────────
var carritos = {}, views = {}, porTienda = {};
Q.carritos.forEach(function (e) {
  var id = t(e.pieza_id); if (!id) return;
  carritos[id] = (carritos[id] || 0) + 1;
  views[id] = (views[id] || 0) + (Number(e.views) || 0);
  var k = id + '¦' + t(e.shortlink_code) + '¦' + t(e.store);
  porTienda[k] = (porTienda[k] || 0) + 1;
});

// ── los códigos que declara cada pieza, por posición ────────────────────────
function codsDe(p) {
  var out = [];
  for (var i = 1; i <= 5; i++) {
    ['Cod_Walmart_', 'Cod_Chedraui_'].forEach(function (pre) {
      var nm = COL.opcional(P, pre + i); if (!nm) return;
      var v = t(p[nm]);
      if (v && !TOKEN.test(v)) out.push({ i: i, tienda: pre === 'Cod_Walmart_' ? 'walmart' : 'chedraui', cod: v });
    });
  }
  return out;
}

// ── la decisión, columna por columna ────────────────────────────────────────
function puedo(f) {
  var p = pieza[f.id]; if (!p) return { r: 'no', por: 'la pieza no está en la hoja' };
  var cods = codsDe(p);
  var col = f.col;

  if (/^Fecha_Activacion_Qcart$|^Activaciones_Qcart$/.test(col)) {
    var act = cods.map(function (c) { return MAE.links[c.cod] && MAE.links[c.cod].fecha_activacion; }).filter(Boolean);
    if (!cods.length) return { r: 'na', por: 'la pieza no lleva Qcart: no hay link que activar' };
    if (!act.length) return { r: 'no', por: 'sus códigos no están en el maestro' };
    return { r: 'si', por: 'el maestro: ' + act.sort()[0] + (act.length > 1 ? ' (la más temprana de ' + act.length + ')' : ''), valor: act.sort()[0] };
  }
  if (col === 'Carritos_Total') {
    if (!cods.length) return { r: 'na', por: 'la pieza no lleva Qcart' };
    return { r: 'si', por: 'el bloque: ' + (carritos[f.id] || 0) + ' carritos atribuidos', valor: String(carritos[f.id] || 0) };
  }
  if (col === 'Views_Total') {
    if (!cods.length) return { r: 'na', por: 'la pieza no lleva Qcart' };
    return { r: 'si', por: 'el bloque: ' + (views[f.id] || 0) + ' views', valor: String(views[f.id] || 0) };
  }
  if (col === 'Tiene_Qcart') return { r: 'si', por: cods.length ? 'declara ' + cods.length + ' código(s) → Sí' : 'no declara códigos → No', valor: cods.length ? 'Sí' : 'No' };
  if (col === 'N_Recetas') return { r: 'si', por: 'cuenta de sus códigos declarados: ' + cods.length, valor: String(cods.length) };
  if (col === 'Fuente_Qcart') {
    var m = cods.map(function (c) { return MAE.links[c.cod]; }).filter(Boolean)[0];
    if (!m) return { r: 'no', por: 'ninguno de sus códigos está en el maestro' };
    return { r: 'si', por: 'el maestro: ' + m.hoja + ' ¦ ' + m.campana + ' ¦ ' + m.utm_content };
  }
  var mURL = col.match(/^URL_Receta_(\d)$/);
  if (mURL) {
    var c = cods.filter(function (x) { return x.i === Number(mURL[1]); })[0];
    if (!c) return { r: 'na', por: 'esa posición de receta no tiene código: no aplica' };
    var mm = MAE.links[c.cod];
    return mm && t(mm.url) ? { r: 'si', por: 'el maestro trae la URL del link' } : { r: 'no', por: 'el maestro no trae la URL de ese link' };
  }
  var mCar = col.match(/^Carritos_(Walmart|Chedraui)_(\d)$/);
  if (mCar) {
    var tienda = mCar[1].toLowerCase(), pos = Number(mCar[2]);
    var cc = cods.filter(function (x) { return x.i === pos && x.tienda === tienda; })[0];
    if (!cc) return { r: 'na', por: 'la pieza no declara código de ' + mCar[1] + ' en la posición ' + pos + ': no aplica' };
    var n = porTienda[f.id + '¦' + cc.cod + '¦' + tienda] || 0;
    return { r: 'si', por: 'el bloque, por shortlink+tienda: ' + n, valor: String(n) };
  }
  var mCod = col.match(/^Cod_(Walmart|Chedraui)_(\d)$/);
  if (mCod) {
    return { r: 'na', por: 'si el maestro no declara un link de ' + mCod[1] + ' en esa posición, la celda NO APLICA — no es un pendiente' };
  }
  var mRec = col.match(/^Receta_(\d)$/);
  if (mRec) {
    var cr = cods.filter(function (x) { return x.i === Number(mRec[1]); })[0];
    if (!cr) return { r: 'na', por: 'esa posición de receta no tiene código declarado: no aplica' };
    var mr = MAE.links[cr.cod];
    return mr && t(mr.receta) ? { r: 'si', por: 'el maestro: «' + t(mr.receta).slice(0, 34) + '»', valor: t(mr.receta) } : { r: 'no', por: 'el maestro no nombra la receta de ese link' };
  }

  // ══ GRUPO SFMC · lo que contesta la DE, y solo si la pieza cruza ══════════════════
  // 🔴 «Cruza con SFMC» es la condición, no un detalle: si la DE no tiene esa pieza, ninguna de
  //    estas columnas se puede contestar y la celda sigue pendiente — no se inventa un cero.
  var nombres = t(COL.valor(p, P, 'catalogo.content_name')).split('·').map(t)
    .filter(function (x) { return x && !TOKEN.test(x); });
  var s = null;
  nombres.forEach(function (n) { if (!s && SFMC[n]) s = SFMC[n]; });

  if (col === 'Email_ID (de la DE de SFMC)') {
    if (t(COL.valor(p, P, 'Canal')) === 'WhatsApp') return { r: 'na', por: 'es de WhatsApp: no tiene Email_ID en SFMC' };
    return s && t(s.Email_ID) ? { r: 'si', por: 'la DE: Email_ID ' + t(s.Email_ID), valor: t(s.Email_ID) } : { r: 'no', por: 'la pieza no cruza con la DE (sin envíos ahí todavía)' };
  }
  if (col === 'Audiencia_DE SFMC' || col === 'Audiencia_DE') {
    if (t(COL.valor(p, P, 'Canal')) === 'WhatsApp') return { r: 'na', por: 'es de WhatsApp: su audiencia es el MGSC, no una DE de SFMC' };
    return s && t(s.Audience_DE) ? { r: 'si', por: 'la DE: ' + t(s.Audience_DE).slice(0, 34), valor: t(s.Audience_DE) } : { r: 'no', por: 'la DE no trae Audience_DE para esta pieza' };
  }
  if (col === 'Audiencia_Volumen SFMC' || col === 'Audiencia_Volumen') {
    if (t(COL.valor(p, P, 'Canal')) === 'WhatsApp') return { r: 'na', por: 'es de WhatsApp' };
    return s && t(s.Audience_Volume) ? { r: 'si', por: 'la DE: ' + t(s.Audience_Volume), valor: t(s.Audience_Volume) } : { r: 'no', por: 'la DE no trae Audience_Volume para esta pieza' };
  }
  if (col === 'Subject') {
    if (t(COL.valor(p, P, 'Canal')) === 'WhatsApp') return { r: 'na', por: 'WhatsApp no tiene subject' };
    return s && t(s.Email_Subject) ? { r: 'si', por: 'la DE: «' + t(s.Email_Subject).slice(0, 30) + '»', valor: t(s.Email_Subject) } : { r: 'no', por: 'la pieza no cruza con la DE' };
  }
  if (col === 'Content_ID (final del Email_Name)') {
    var idn = nombres.map(function (n) { return (n.match(/(\d{4,})\s*$/) || [])[1]; }).filter(Boolean)[0];
    return idn ? { r: 'si', por: 'el id final de su propio Email_Name: ' + idn, valor: idn } : { r: 'no', por: 'su Email_Name no termina en un id numérico' };
  }
  if (col === 'Email_Type') {
    var et = t(COL.valor(p, P, 'Email' + '_Type'));
    if (et && !TOKEN.test(et)) return { r: 'na', por: 'ya tiene valor' };
    return s ? { r: 'si', por: 'la DE: Es_FUP = ' + t(s.Es_FUP), valor: /^s[ií]$/i.test(t(s.Es_FUP)) ? 'Follow Up' : 'Principal' } : { r: 'no', por: 'la pieza no cruza con la DE' };
  }
  if (col === 'Tipo_Envio') {
    return s ? { r: 'si', por: 'la DE: Es_FUP = ' + t(s.Es_FUP), valor: /^s[ií]$/i.test(t(s.Es_FUP)) ? 'FUP' : 'Principal' } : { r: 'no', por: 'la pieza no cruza con la DE' };
  }

  // ══ GRUPO PROCEDENCIA · lo sabe el propio sistema ═════════════════════════════════
  if (col === 'Clicks_Medidos') {
    var canal = t(COL.valor(p, P, 'Canal'));
    if (canal === 'Email') return { r: 'si', por: 'el email SIEMPRE mide clicks: SFMC los entrega por envío', valor: 'Sí' };
    return { r: 'no', por: 'WhatsApp: depende de si su hoja trae clicks o los deriva — lo declara el bloque, no se deduce' };
  }
  if (col === 'Fuente_Dato') {
    var canal2 = t(COL.valor(p, P, 'Canal'));
    if (canal2 === 'Email') return { r: 'si', por: 'de dónde salió: la DE de SFMC', valor: 'SFMC · CRM_Email_Piezas' };
    if (canal2 === 'WhatsApp') return { r: 'si', por: 'de dónde salió: la fuente de WhatsApp', valor: '(Interno) Resultados Whatsapp CRM 2026.xlsx' };
    return { r: 'no', por: 'canal sin fuente declarada' };
  }
  if (col === 'Fecha_Origen') {
    return s ? { r: 'si', por: 'la fecha sale del detalle día por día, sin jobs de prueba', valor: 'SFMC · detalle día por día (sin jobs de prueba)' } : { r: 'no', por: 'la pieza no cruza con la DE: no hay detalle del cual sacar la fecha' };
  }

  return { r: 'no', por: 'sin regla declarada para esta columna' };
}

var SI = [], NO = [], NA = [];
filas.forEach(function (f) {
  var v = puedo(f);
  (v.r === 'si' ? SI : v.r === 'na' ? NA : NO).push({ f: f, v: v });
});

console.log('════════ GRUPO ' + GRUPO + ' · ¿qué puedo cerrar HOY? ════════\n');
console.log('  celdas en el grupo: ' + filas.length);
console.log('   ✔  con fuente real, se pueden cerrar : ' + SI.length);
console.log('   ·  NO APLICAN (deberían ser N/A)     : ' + NA.length);
console.log('   🔴 faltan de verdad                  : ' + NO.length + '\n');

function tabla(titulo, lista) {
  if (!lista.length) return;
  console.log('── ' + titulo);
  var porCol = {};
  lista.forEach(function (x) { (porCol[x.f.col] = porCol[x.f.col] || []).push(x); });
  Object.keys(porCol).sort(function (a, b) { return porCol[b].length - porCol[a].length; }).forEach(function (c) {
    console.log('   ' + String(porCol[c].length).padStart(4) + '  ' + c.padEnd(26) + porCol[c][0].v.por.slice(0, 60));
  });
  console.log('');
}
tabla('✔ SE PUEDEN CERRAR — con qué fuente', SI);
tabla('· NO APLICAN — la celda debería decir N/A, no POR DEFINIR', NA);
tabla('🔴 FALTAN DE VERDAD — y de quién depende', NO);

fs.writeFileSync(BACK + '/_preescritura/que-puedo-cerrar-' + GRUPO + '.json', JSON.stringify({
  cuando: new Date().toISOString(), grupo: GRUPO,
  si: SI.map(function (x) { return { id: x.f.id, col: x.f.col, fuente: x.v.por, valor: x.v.valor }; }),
  na: NA.map(function (x) { return { id: x.f.id, col: x.f.col, por: x.v.por }; }),
  no: NO.map(function (x) { return { id: x.f.id, col: x.f.col, por: x.v.por }; })
}, null, 1));
console.log('  → _preescritura/que-puedo-cerrar-' + GRUPO + '.json');
