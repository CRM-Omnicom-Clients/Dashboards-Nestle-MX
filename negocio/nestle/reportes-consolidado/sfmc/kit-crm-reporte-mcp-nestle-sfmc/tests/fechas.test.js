'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../lib/fechas');

test('parseFechaSfmc: ISO REST (con fracciones) en la hora de la cuenta UTC-6', () => {
  assert.equal(F.parseFechaSfmc('2026-10-02T00:08:01.13', -6), Date.UTC(2026, 9, 2, 6, 8, 1));
  assert.equal(F.parseFechaSfmc('2026-08-19T18:22:18.153', -6), Date.UTC(2026, 7, 20, 0, 22, 18));
  assert.equal(F.parseFechaSfmc('2026-10-02 00:08:01', 0), Date.UTC(2026, 9, 2, 0, 8, 1), 'con espacio y offset 0');
});

test('parseFechaSfmc: formato SOAP de EE. UU. con AM/PM (12 AM = 00h, 12 PM = 12h)', () => {
  assert.equal(F.parseFechaSfmc('10/2/2026 12:23:05 AM', -6), Date.UTC(2026, 9, 2, 6, 23, 5));
  assert.equal(F.parseFechaSfmc('10/2/2026 12:23:05 PM', -6), Date.UTC(2026, 9, 2, 18, 23, 5));
  assert.equal(F.parseFechaSfmc('9/14/2026 5:52:24 PM', -6), Date.UTC(2026, 8, 14, 23, 52, 24));
  assert.equal(F.parseFechaSfmc('9/3/2026 11:43:34 PM', -6), Date.UTC(2026, 8, 4, 5, 43, 34));
});

test('parseFechaSfmc: lo irreconocible da null (nunca NaN ni una fecha inventada)', () => {
  for (const x of ['', null, undefined, 'ayer', '2026-13', '10/2/2026']) assert.equal(F.parseFechaSfmc(x), null, JSON.stringify(x));
});

test('edadMinutos y formatoEdad', () => {
  const ahora = Date.UTC(2026, 9, 2, 18, 0, 0);
  assert.equal(F.edadMinutos('2026-10-02T11:20:00', ahora, -6), 40);
  assert.equal(F.edadMinutos('nada', ahora), null);
  assert.equal(F.formatoEdad(40), '40 min'); assert.equal(F.formatoEdad(135), '2 h 15 min'); assert.equal(F.formatoEdad(3000), '2 d 2 h');
  assert.match(F.formatoEdad(-5), /zona horaria/); assert.equal(F.formatoEdad(null), 'edad desconocida');
});

test('fechaCuenta: "AAAA-MM-DD HH:MM" en la hora de la cuenta, sin convertir de zona; REST y SOAP; lo irreconocible, null', () => {
  assert.equal(F.fechaCuenta('9/24/2026 8:33:00 AM'), '2026-09-24 08:33');
  assert.equal(F.fechaCuenta('10/2/2026 7:00:00 PM'), '2026-10-02 19:00');
  assert.equal(F.fechaCuenta('2026-10-02T00:08:01.13'), '2026-10-02 00:08');
  assert.equal(F.fechaCuenta('12/1/2026 12:05:00 AM'), '2026-12-01 00:05');
  assert.equal(F.fechaCuenta(''), null); assert.equal(F.fechaCuenta('ayer'), null); assert.equal(F.fechaCuenta(null), null);
});
