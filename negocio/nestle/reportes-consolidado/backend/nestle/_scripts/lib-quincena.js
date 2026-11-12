// lib-quincena · L0 — UNA REGLA Y UN FORMATO. Fundación: ningún skill la reimplementa.
//
// 🔴 POR QUÉ EXISTE, y está medido: hoy el reporte y el catálogo **NO SE PUEDEN CRUZAR**. Ninguna
//    de las 86 filas empareja, porque la misma quincena está escrita de dos formas:
//       Report_Resumen  → «Mar-Q1-2026»
//       Catalogo_Piezas → «2026-03-Q1»
//    Normalizando el formato cruzan 64 de 86. No es un problema de contenido: es de FORMA. Y era
//    la causa concreta de que la atribución dependiera de que alguien buscara el dato a mano.
//
// 🔴 LA REGLA (Rick, 24-ago): **día 1–15 = Q1 · día 16–fin de mes = Q2.** Universal, para email,
//    WhatsApp y Qcart. No hay excepciones por mes.
//
// 🔴 EL FORMATO CANÓNICO: **`AAAA-MM-Qn`**. Se eligió sobre «Mar-Q1-2026» por dos razones que se
//    pueden comprobar: ordena alfabéticamente igual que cronológicamente, y no depende del idioma
//    del mes (un `Mar` puede ser marzo o March, y un `Dic`/`Dec` rompe el cruce en silencio).
var t = function (v) { return String(v == null ? '' : v).trim(); };

var MES_NUM = {
  ene: '01', enero: '01', jan: '01', january: '01',
  feb: '02', febrero: '02', february: '02',
  mar: '03', marzo: '03', march: '03',
  abr: '04', abril: '04', apr: '04', april: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06', june: '06',
  jul: '07', julio: '07', july: '07',
  ago: '08', agosto: '08', aug: '08', august: '08',
  sep: '09', sept: '09', septiembre: '09', september: '09',
  oct: '10', octubre: '10', october: '10',
  nov: '11', noviembre: '11', november: '11',
  dic: '12', diciembre: '12', dec: '12', december: '12'
};
var MES_NOM = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** El formato canónico: AAAA-MM-Qn */
var CANONICO = /^(\d{4})-(0[1-9]|1[0-2])-Q([12])$/;
function esCanonica(q) { return CANONICO.test(t(q)); }

/**
 * 🔴 LA REGLA. De una fecha a su quincena. Día 1–15 = Q1 · 16–fin = Q2.
 * Acepta Date, serial de Excel, ISO, y d/m/aaaa o m/d/aaaa (SFMC entrega «7/13/2026»).
 */
function deFecha(f) {
  var d = aFecha(f);
  if (!d) return null;
  var q = d.getUTCDate() <= 15 ? 1 : 2;
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-Q' + q;
}

/** Convierte a Date lo que se pueda, en UTC para que no se corra un día por zona horaria. */
function aFecha(f) {
  if (f instanceof Date && !isNaN(f)) return new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  var s = t(f);
  if (!s) return null;
  // serial de Excel (días desde 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
  }
  var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  // 🔴 «7/13/2026» de SFMC es M/D/AAAA. Si el primer número es >12 no puede ser mes: es D/M.
  var barras = /^(\d{1,2})[\/](\d{1,2})[\/](\d{4})/.exec(s);
  if (barras) {
    var a = +barras[1], b = +barras[2], anio = +barras[3];
    var mes = a, dia = b;
    if (a > 12 && b <= 12) { mes = b; dia = a; }
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return new Date(Date.UTC(anio, mes - 1, dia));
  }
  return null;
}

/**
 * 🔴 NORMALIZA cualquier forma conocida al canónico. Devuelve null si NO la reconoce —
 *    nunca adivina: un valor que no se entiende no se convierte, se declara.
 */
function normalizar(q) {
  var s = t(q);
  if (!s) return null;
  if (CANONICO.test(s)) return s;
  // «Mar-Q1-2026» · «Ago-Q2-2026»
  var m1 = /^([A-Za-zÁ-úá-ú]{3,10})[-\s]*Q([12])[-\s]*(\d{4})$/.exec(s);
  if (m1) { var n1 = MES_NUM[m1[1].toLowerCase()]; if (n1) return m1[3] + '-' + n1 + '-Q' + m1[2]; }
  // «2026-Mar-Q1»
  var m2 = /^(\d{4})[-\s]*([A-Za-zÁ-úá-ú]{3,10})[-\s]*Q([12])$/.exec(s);
  if (m2) { var n2 = MES_NUM[m2[2].toLowerCase()]; if (n2) return m2[1] + '-' + n2 + '-Q' + m2[3]; }
  // «2026-03-Q1» con separadores raros, o «202603Q1»
  var m3 = /^(\d{4})\D*(\d{1,2})\D*Q?([12])$/.exec(s);
  if (m3) { var mm = String(+m3[2]).padStart(2, '0'); if (+m3[2] >= 1 && +m3[2] <= 12) return m3[1] + '-' + mm + '-Q' + m3[3]; }
  // por último: ¿es una fecha?
  return deFecha(s);
}

/** Para mostrar: «2026-03-Q1» → «Mar-Q1-2026». El almacenamiento SIEMPRE es canónico. */
function bonita(q) {
  var c = normalizar(q); if (!c) return t(q);
  var p = CANONICO.exec(c);
  return MES_NOM[+p[2]] + '-Q' + p[3] + '-' + p[1];
}

/** El mes de una quincena: { num: 3, nombre: 'Marzo' } */
var MESES_LARGO = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function mesDe(q) {
  var c = normalizar(q); if (!c) return null;
  var p = CANONICO.exec(c);
  return { num: +p[2], nombre: MESES_LARGO[+p[2]], anio: +p[1] };
}

/** Ordena cronológicamente. Con el formato canónico basta comparar como texto — esa es la gracia. */
function comparar(a, b) {
  var x = normalizar(a) || '', y = normalizar(b) || '';
  return x < y ? -1 : x > y ? 1 : 0;
}

module.exports = {
  REGLA: 'día 1–15 = Q1 · día 16–fin de mes = Q2',
  FORMATO: 'AAAA-MM-Qn',
  CANONICO: CANONICO,
  esCanonica: esCanonica, deFecha: deFecha, aFecha: aFecha,
  normalizar: normalizar, bonita: bonita, mesDe: mesDe, comparar: comparar
};
