// Q1 · QUÉ TRAEN LOS CSV DE AGOSTO, Y CUÁNTO SE SOLAPAN CON LO QUE YA ESTÁ.
//
// 🔴 EL SOLAPE NO SE ADIVINA, SE MIDE. `Fullcarritos-MarzoAgosto.csv` ya dice «hasta agosto» en
//    el nombre, y los nuevos van del 01 al 21 de agosto. Cargar los dos sin más DUPLICA todo lo
//    que ambos traen — y un carrito duplicado no se nota: infla la intención y nadie lo ve.
//
// 🔴 LA LLAVE DE UN CARRITO. No hay id de carrito en el CSV. La identidad es la fila entera de
//    lo que la fuente MIDE: fecha + hora + shortlink + utms + tienda + views + importe. Dos filas
//    con esa llave igual son el mismo evento visto dos veces, no dos eventos idénticos.
//    ⚠ Si dos eventos REALES coincidieran en los nueve campos, se contarían como uno. Se declara
//      cuántos colapsan por eso en vez de esconderlo.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os'), path = require('path');
var QDIR = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé/ReportesQcart';
var VIG = QDIR + '/_vigentes';
var t = function (v) { return String(v == null ? '' : v).trim(); };
function mil(n) { return Number(n || 0).toLocaleString('es-MX'); }

// ── un lector de CSV que respeta comillas: los nombres de receta llevan comas
//
// 🔴 EL DELIMITADOR SE DETECTA, NO SE ASUME. Estos CSV usan **punto y coma**, no coma. Dando la
//    coma por hecha, cada fila entera caía en un solo campo: todas las filas quedaban idénticas
//    entre sí y el medidor de duplicados dijo que el 99.97% del archivo estaba repetido. Un
//    resultado absurdo delata al lector, no a los datos — pero solo si uno lo mira.
function leerCSV(ruta) {
  var txt = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  var prim = txt.split(/\r?\n/)[0] || '';
  var DEL = (prim.split(';').length > prim.split(',').length) ? ';' : ',';
  var filas = [], campo = '', fila = [], enCom = false;
  for (var i = 0; i < txt.length; i++) {
    var ch = txt[i];
    if (enCom) {
      if (ch === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') enCom = false;
      else campo += ch;
    } else if (ch === '"') enCom = true;
    else if (ch === DEL) { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  if (!filas.length) return { enc: [], filas: [] };
  var enc = filas[0].map(function (x) { return t(x).toLowerCase(); });
  return {
    enc: enc,
    filas: filas.slice(1).filter(function (f) { return f.some(function (c) { return t(c); }); })
      .map(function (f) { var o = {}; enc.forEach(function (n, j) { o[n] = t(f[j]); }); return o; })
  };
}
// la fecha puede venir en varias columnas según el esquema
function fechaDe(o) {
  var c = ['date', 'fecha', 'day', 'created_at', 'timestamp', 'datetime'];
  for (var i = 0; i < c.length; i++) if (o[c[i]]) return t(o[c[i]]);
  return '';
}
function isoDe(v) {
  var m = /(\d{4})-(\d{2})-(\d{2})/.exec(v); if (m) return m[0];
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) return m[3] + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  return '';
}
// 🔴 la llave: TODO lo que la fuente mide de ese evento, con la MARCA DE TIEMPO COMPLETA.
//    La `date` de estos CSV trae hora (`2026-08-20T17:00:00`). Truncándola al día, dos carritos
//    distintos del mismo día sobre el mismo link colapsaban en uno: el medidor dijo que 873 filas
//    del archivo grande estaban repetidas, cuando lo repetido era mi propia llave.
var CAMPOS = ['shortlink code', 'shortlink', 'shortlink name', 'utm_campaign', 'utm_medium', 'utm_source',
  'utm_content', 'utm_term', 'campaign', 'medium', 'store', 'product', 'impressions', 'views', 'total shown price'];
function llave(o) {
  return t(fechaDe(o)) + '¦' + CAMPOS.map(function (c) { return t(o[c]); }).join('¦');
}

console.log('════════ Q1 · LOS CSV DE AGOSTO CONTRA LO QUE YA ESTÁ ════════\n');
var archivos = fs.readdirSync(VIG).filter(function (f) { return /\.csv$/i.test(f); });
console.log('  en _vigentes: ' + archivos.length + ' CSV\n');

var info = {};
archivos.forEach(function (f) {
  var d = leerCSV(path.join(VIG, f));
  var fechas = d.filas.map(function (o) { return isoDe(fechaDe(o)); }).filter(Boolean).sort();
  var tipo = /product/i.test(f) ? 'productos' : 'carritos';
  info[f] = { tipo: tipo, filas: d.filas.length, enc: d.enc, datos: d.filas,
    desde: fechas[0] || '(sin fecha)', hasta: fechas[fechas.length - 1] || '(sin fecha)',
    conFecha: fechas.length };
  console.log('  ' + f.slice(0, 52).padEnd(54) + tipo.padEnd(11) + String(d.filas.length).padStart(6) + ' filas   ' +
    info[f].desde + ' → ' + info[f].hasta + '   con fecha: ' + fechas.length + '/' + d.filas.length);
  console.log('      columnas: ' + d.enc.join(' · ').slice(0, 100));
});

// ── el solape, por tipo
console.log('\n══ el solape, medido ══');
['carritos', 'productos'].forEach(function (tipo) {
  var fs2 = Object.keys(info).filter(function (f) { return info[f].tipo === tipo; });
  if (fs2.length < 2) { console.log('  ' + tipo + ': solo ' + fs2.length + ' archivo, no hay solape posible'); return; }
  console.log('\n  ── ' + tipo.toUpperCase());
  for (var i = 0; i < fs2.length; i++) {
    for (var j = i + 1; j < fs2.length; j++) {
      var A = info[fs2[i]], B = info[fs2[j]];
      var kA = {}; A.datos.forEach(function (o) { kA[llave(o)] = (kA[llave(o)] || 0) + 1; });
      var repes = 0;
      B.datos.forEach(function (o) { if (kA[llave(o)]) repes++; });
      console.log('     ' + fs2[i].slice(0, 40).padEnd(42) + ' ∩ ' + fs2[j].slice(0, 40).padEnd(42));
      console.log('        filas en común: ' + mil(repes) + ' de ' + mil(B.filas) + ' del segundo   ' +
        (repes ? '🔴 hay que deduplicar' : '✔ no se solapan'));
    }
  }
  // duplicados DENTRO de cada archivo
  fs2.forEach(function (f) {
    var k = {}, dup = 0;
    info[f].datos.forEach(function (o) { var l = llave(o); if (k[l]) dup++; else k[l] = 1; });
    if (dup) console.log('     ⚠ ' + f.slice(0, 48) + ': ' + mil(dup) + ' fila(s) repetidas DENTRO del propio archivo');
  });
});

// ── qué cubre agosto
console.log('\n══ agosto ══');
Object.keys(info).forEach(function (f) {
  var d = info[f].datos.filter(function (o) { return /^2026-08/.test(isoDe(fechaDe(o))); });
  if (d.length) console.log('  ' + f.slice(0, 52).padEnd(54) + mil(d.length) + ' filas de agosto');
});

fs.writeFileSync(os.homedir() + '/.claude/reportes-backend/nestle/_insumos/qcart-agosto.json', JSON.stringify({
  paso: 'Q1', archivos: Object.keys(info).map(function (f) {
    return { archivo: f, tipo: info[f].tipo, filas: info[f].filas, desde: info[f].desde, hasta: info[f].hasta, columnas: info[f].enc };
  })
}, null, 1));
console.log('\n  → _insumos/qcart-agosto.json');
