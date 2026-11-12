/*
 * qcart.extraer-crudo.js — SACAR LOS NÚMEROS DE UNOS SHORTLINKS DIRECTO DEL CSV CRUDO.
 *
 * 🔴 POR QUÉ NO SALE DEL BLOQUE. El bloque solo carga lo que el catálogo declara como nuestro.
 *    Los links de J9 todavía no están dados de alta —Rick: «eso lo está haciendo otra sesión»— así
 *    que sus 48 eventos se filtran como «ajenos» y el bloque devuelve cero. Que el catálogo no los
 *    conozca no significa que no existan: existen en el CSV y se pueden leer.
 *
 * 🔴 NO ESCRIBE NADA. Ni al bloque, ni al catálogo, ni al Excel. Solo lee y reporta.
 *
 * 🔴 EL DECIMAL VIENE CON COMA Y ENTRECOMILLADO (`"335,43"`). Parsearlo con `Number()` da NaN y un
 *    NaN sumado deja el total en NaN — o peor, `|| 0` lo vuelve un cero que parece medición.
 *    Se normaliza explícitamente y se cuenta cuántos valores no se pudieron leer.
 *
 *   node qcart.extraer-crudo.js bfQ24tDq xTaSfQ2y ymh2OT4x
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), path = require('path');
var DIR = ENT.fuente('qcart_descargas');
var t = function (v) { return String(v == null ? '' : v).trim().replace(/^"|"$/g, ''); };
var CODS = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
if (!CODS.length) { console.log('uso: node qcart.extraer-crudo.js <cod> [cod...]'); process.exit(2); }

/* 🔴 `"1.234,56"` → 1234.56 · `""` → null (NO cero). Un cero inventado se suma como si fuera dato. */
function numero(v) {
  var s = t(v); if (!s) return null;
  s = s.replace(/\./g, '').replace(/,/g, '.');
  var n = Number(s);
  return isFinite(n) ? n : null;
}
function filas(archivo) {
  var txt = fs.readFileSync(path.join(DIR, archivo), 'utf8').replace(/^﻿/, '');
  var L = txt.split(/\r?\n/).filter(function (x) { return x.trim(); });
  var enc = L[0].split(';').map(t);
  return L.slice(1).map(function (l) {
    // split respetando comillas — el precio viene entrecomillado por la coma decimal
    var celdas = [], act = '', dentro = false;
    for (var i = 0; i < l.length; i++) {
      var c = l.charAt(i);
      if (c === '"') { dentro = !dentro; act += c; continue; }
      if (c === ';' && !dentro) { celdas.push(act); act = ''; continue; }
      act += c;
    }
    celdas.push(act);
    var o = {}; enc.forEach(function (h, i2) { o[h] = celdas[i2]; });
    return o;
  });
}

var archivos = fs.readdirSync(DIR).filter(function (f) { return /\.csv$/i.test(f) && /-raw-/.test(f); });
console.log('════════ QCART · EXTRACCIÓN DIRECTA DEL CRUDO ════════');
console.log('  archivos -raw- leídos: ' + archivos.length + '   ·   códigos pedidos: ' + CODS.join(' · ') + '\n');

var R = {};
CODS.forEach(function (c) { R[c] = { carritos: { n: 0, views: 0, impr: 0, importe: 0, sinPrecio: 0, dias: {}, utm: {}, tiendas: {}, nombre: '' }, productos: { n: 0, views: 0, importe: 0, sinPrecio: 0, dias: {}, prods: {} } }; });

archivos.forEach(function (a) {
  var tipo = /products/i.test(a) ? 'productos' : 'carritos';
  filas(a).forEach(function (o) {
    var cod = t(o['shortlink code']); if (CODS.indexOf(cod) < 0) return;
    var d = R[cod][tipo];
    d.n++;
    var dia = t(o['date']).slice(0, 10); if (dia) d.dias[dia] = 1;
    var v = numero(o['views']); if (v !== null) d.views += v;
    var im = numero(o['impressions']); if (im !== null && tipo === 'carritos') d.impr += im;
    var p = numero(o['total shown price']); if (p === null) d.sinPrecio++; else d.importe += p;
    if (tipo === 'carritos') {
      d.nombre = d.nombre || t(o['shortlink name']);
      var k = t(o['utm_campaign']) + ' ¦ ' + t(o['utm_content']) + ' ¦ ' + t(o['utm_term']) + ' ¦ ' + t(o['utm_medium']);
      d.utm[k] = (d.utm[k] || 0) + 1;
      var st = t(o['store']) || '(sin tienda)'; d.tiendas[st] = (d.tiendas[st] || 0) + 1;
    } else {
      var pr = t(o['product']); if (pr) d.prods[pr] = (d.prods[pr] || 0) + 1;
    }
  });
});

var mil = function (n) { return Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }); };
var TOT = { c: 0, cv: 0, ci: 0, p: 0, pv: 0, pi: 0 };
CODS.forEach(function (c) {
  var d = R[c];
  console.log('── ' + c + '   «' + (d.carritos.nombre || '?') + '»');
  var dias = Object.keys(d.carritos.dias).sort();
  console.log('   CARRITOS   ' + d.carritos.n + ' evento(s)   ·   ' + dias.length + ' día(s) ' +
    (dias.length ? '(' + dias[0] + ' → ' + dias[dias.length - 1] + ')' : '') +
    '   ·   views ' + mil(d.carritos.views) + '   impresiones ' + mil(d.carritos.impr) +
    '   importe $' + mil(d.carritos.importe) + (d.carritos.sinPrecio ? '   ⚠ ' + d.carritos.sinPrecio + ' fila(s) sin precio' : ''));
  Object.keys(d.carritos.utm).sort(function (a, b) { return d.carritos.utm[b] - d.carritos.utm[a]; }).forEach(function (k) {
    var p = k.split(' ¦ ');
    console.log('        ' + String(d.carritos.utm[k]).padStart(4) + '×  campaign «' + p[0] + '»  content «' + p[1] + '»  term «' + p[2] + '»  (' + p[3] + ')');
  });
  console.log('        tiendas: ' + Object.keys(d.carritos.tiendas).map(function (x) { return x + ' ' + d.carritos.tiendas[x]; }).join(' · '));
  var dp = Object.keys(d.productos.dias).sort();
  console.log('   PRODUCTOS  ' + d.productos.n + ' evento(s)   ·   ' + dp.length + ' día(s)   ·   views ' + mil(d.productos.views) +
    '   importe $' + mil(d.productos.importe));
  if (d.productos.n) console.log('        top: ' + Object.keys(d.productos.prods).sort(function (a, b) { return d.productos.prods[b] - d.productos.prods[a]; })
    .slice(0, 5).map(function (x) { return x.slice(0, 34) + ' (' + d.productos.prods[x] + ')'; }).join(' · '));
  console.log('');
  TOT.c += d.carritos.n; TOT.cv += d.carritos.views; TOT.ci += d.carritos.importe;
  TOT.p += d.productos.n; TOT.pv += d.productos.views; TOT.pi += d.productos.importe;
});
console.log('════ TOTAL ════');
console.log('  carritos  ' + TOT.c + ' evento(s)  ·  views ' + mil(TOT.cv) + '  ·  importe $' + mil(TOT.ci));
console.log('  productos ' + TOT.p + ' evento(s)  ·  views ' + mil(TOT.pv) + '  ·  importe $' + mil(TOT.pi));
