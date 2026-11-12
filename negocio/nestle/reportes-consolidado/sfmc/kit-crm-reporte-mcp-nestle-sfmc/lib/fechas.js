'use strict';
// Fechas de SFMC: vienen SIN zona, en la hora de la CUENTA. Dos formatos reales (medidos en vivo, 2-oct-2026):
//   REST  '2026-10-02T00:08:01.13'          (lastRunTime, createdDate de queries, scheduledTime)
//   SOAP  '10/2/2026 12:23:05 AM'           (campos Date de una DE, p. ej. LastRefresh)  y  '2026-08-19T18:22:18.153' (CreatedDate)
// offsetHoras = diferencia de la cuenta contra UTC (Central sin horario de verano = -6). Se MIDE (de.medirOffsetCuenta), no se supone.

/** ms UTC de una fecha de SFMC, o null si no se reconoce. */
function parseFechaSfmc(s, offsetHoras = -6) {
  const t = String(s == null ? '' : s).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(t);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offsetHoras * 3600e3;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AaPp][Mm])?/.exec(t);
  if (m) {
    let h = +m[4]; const ap = (m[7] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
    return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +m[5], +m[6]) - offsetHoras * 3600e3;
  }
  return null;
}

/** 'AAAA-MM-DD HH:MM' en la hora de la CUENTA, tal cual viene (sin convertir de zona), o null si no se reconoce. */
function fechaCuenta(s) {
  const ms = parseFechaSfmc(s, 0);               // se lee "como si fuera UTC" solo para darle formato; no es un instante real
  return ms == null ? null : new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

/** Minutos transcurridos desde `fecha` hasta `ahoraMs` (UTC), o null si la fecha no se reconoce. */
function edadMinutos(fecha, ahoraMs, offsetHoras = -6) {
  const t = parseFechaSfmc(fecha, offsetHoras);
  return t == null ? null : (ahoraMs - t) / 60000;
}

/** 135 -> "2 h 15 min"; 40 -> "40 min"; 3000 -> "2 d 2 h". */
function formatoEdad(min) {
  if (min == null) return 'edad desconocida';
  const m = Math.round(min);
  if (m < 0) return 'en el futuro (¿zona horaria?)';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

module.exports = { parseFechaSfmc, fechaCuenta, edadMinutos, formatoEdad };
