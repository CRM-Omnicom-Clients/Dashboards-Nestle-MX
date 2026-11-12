'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const X = require('../lib/difsql');

const BLOQUE = (q, cuerpo) => '```diff-sql ' + q + '\n' + cuerpo + '\n```\n';
const SQL = ['SELECT', '    a.ConfigKey   AS ConfigKey,', '    a.Otra AS Otra,', 'FROM t a', 'JOIN u b ON b.ConfigKey = a.ConfigKey', 'GROUP BY a.ConfigKey'].join('\r\n');

test('parsearBloques: varios bloques y varios cambios; la sangria de los "+" se conserva; un cambio sin "+" es un borrado', () => {
  const md = '# titulo\ntexto\n' + BLOQUE('Q1', '@@ L2\n-     a.ConfigKey   AS ConfigKey,\n+     a.EmailName   AS EmailName,\n@@ L5\n- JOIN u b ON b.ConfigKey = a.ConfigKey\n') + 'mas texto\n' + BLOQUE('Q2', '@@ L1\n- x\n+   y');
  const r = X.parsearBloques(md);
  assert.deepEqual(Object.keys(r), ['Q1', 'Q2']);
  assert.deepEqual(r.Q1[0], { linea: 2, viejas: ['    a.ConfigKey   AS ConfigKey,'], nuevas: ['    a.EmailName   AS EmailName,'] });
  assert.deepEqual(r.Q1[1].nuevas, [], 'sin "+" = borrar');
  assert.deepEqual(r.Q2[0].nuevas, ['  y'], 'solo se quita el marcador y UN espacio');
  assert.deepEqual(X.parsearBloques('sin bloques'), {});
});
test('parsearBloques: rechaza lo mal formado con un mensaje que dice cual query y cual linea', () => {
  assert.throws(() => X.parsearBloques(BLOQUE('Q', '- suelta antes del @@')), /Q: una línea del bloque aparece antes de su "@@ L<n>"/);
  assert.throws(() => X.parsearBloques(BLOQUE('Q', '@@ L1\n+ nueva\n- vieja')), /Q L1: las líneas "-" van antes que las "\+"/);
  assert.throws(() => X.parsearBloques(BLOQUE('Q', '@@ L1\n* algo')), /Q L1: línea que no empieza con "-" ni "\+"/);
  assert.throws(() => X.parsearBloques(BLOQUE('Q', '@@ L1\n+ solo nueva')), /Q L1: un cambio sin líneas "-"/);
  assert.throws(() => X.parsearBloques(BLOQUE('Q', '@@ L1\n- a') + BLOQUE('Q', '@@ L1\n- a')), /la query Q aparece en dos bloques/);
});

test('aplicarHunks: reemplaza, borra y toma el SQL con CRLF; compara sin espacios sobrantes; de abajo hacia arriba (los numeros no se corren)', () => {
  const h = [{ linea: 2, viejas: ['a.ConfigKey AS ConfigKey,'], nuevas: ['a.EmailName AS EmailName,'] },
    { linea: 3, viejas: ['a.Otra AS Otra,'], nuevas: [] },
    { linea: 5, viejas: ['JOIN u b ON b.ConfigKey = a.ConfigKey'], nuevas: ['JOIN u b ON b.EmailName = a.EmailName'] },
    { linea: 6, viejas: ['GROUP BY a.ConfigKey'], nuevas: ['GROUP BY a.EmailName'] }];
  const r = X.aplicarHunks(SQL, h, { query: 'Q' });
  assert.equal(r, ['SELECT', 'a.EmailName AS EmailName,', 'FROM t a', 'JOIN u b ON b.EmailName = a.EmailName', 'GROUP BY a.EmailName'].join('\n'));
  assert.equal(SQL.includes('\r\n'), true, 'no toca el original');
});
test('aplicarHunks: si una linea NO coincide, lanza con lo esperado y lo encontrado, y no aplica nada a medias', () => {
  const h = [{ linea: 2, viejas: ['a.ConfigKey AS ConfigKey,'], nuevas: ['x'] }, { linea: 4, viejas: ['FROM OTRA a'], nuevas: ['y'] }];
  assert.throws(() => X.aplicarHunks(SQL, h, { query: 'Q' }), /Q L4: esperaba «FROM OTRA a» y hay «FROM t a»/);
  assert.throws(() => X.aplicarHunks(SQL, [{ linea: 99, viejas: ['x'], nuevas: [] }], { query: 'Q' }), /Q L99: esperaba «x» y hay «\(no hay línea\)»/);
  assert.throws(() => X.aplicarHunks(SQL, [{ linea: 2, viejas: ['a.ConfigKey AS ConfigKey,', 'a.Otra AS Otra,'], nuevas: [] }, { linea: 3, viejas: ['a.Otra AS Otra,'], nuevas: [] }], { query: 'Q' }), /Q: los cambios en L2 y L3 se pisan/);
  assert.throws(() => X.aplicarHunks(SQL, [{ linea: 2, viejas: ['a.ConfigKey AS ConfigKey,', 'MAL'], nuevas: [] }], { query: 'Q' }), /Q L3: esperaba «MAL»/, 'una linea de un cambio de varias lineas tambien se verifica');
});
test('menciones: sin distinguir mayusculas, con la linea', () => {
  assert.deepEqual(X.menciones(SQL, ['configkey']), [{ linea: 2, token: 'configkey' }, { linea: 5, token: 'configkey' }, { linea: 6, token: 'configkey' }]);
  assert.deepEqual(X.menciones(SQL, ['ContentName']), []);
});

// ---------- el mapa REAL de la guia contra el SQL REAL (foto E0 del 2-oct-2026) ----------
const GUIA = fs.readFileSync(path.join(__dirname, '..', 'docs', 'MIGRACION-EMAILNAME-PK.md'), 'utf8');
const E0 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arquitectura-nestle-2026-10-02.json'), 'utf8'));
const mapa = X.parsearBloques(GUIA);
const nLineas = (s) => String(s).replace(/\r\n/g, '\n').split('\n').length;

test('GUIA DE MIGRACION: hay un bloque por cada una de las 5 queries del reporte, y ninguna otra', () => {
  assert.deepEqual(Object.keys(mapa).sort(), Object.keys(E0.queries).sort());
});
test('GUIA DE MIGRACION: cada cambio coincide tal cual, en su linea, con el SQL real; no queda ConfigKey ni ContentName; el largo cuadra con lo que dice el mapa', () => {
  for (const [nombre, hunks] of Object.entries(mapa)) {
    const antes = E0.queries[nombre].queryText;
    const despues = X.aplicarHunks(antes, hunks, { query: nombre });
    assert.deepEqual(X.menciones(despues, ['ConfigKey', 'ContentName']), [], `${nombre}: aún menciona ConfigKey/ContentName`);
    const delta = hunks.reduce((n, h) => n + h.nuevas.length - h.viejas.length, 0);
    assert.equal(nLineas(despues) - nLineas(antes), delta, `${nombre}: el cambio de líneas no cuadra`);
    assert.ok(X.menciones(antes, ['ConfigKey', 'ContentName']).length > 0, `${nombre}: la query ya no menciona ConfigKey: ¿sigue haciendo falta el cambio?`);
  }
});
test('GUIA DE MIGRACION: si alguien edita una query, la guia lo DETECTA (una linea cambiada o corrida hace fallar el mapa)', () => {
  for (const [nombre, hunks] of Object.entries(mapa)) {
    const base = E0.queries[nombre].queryText.replace(/\r\n/g, '\n').split('\n');
    const h = hunks[0]; const editada = [...base]; editada[h.linea - 1] = editada[h.linea - 1] + ' /* editada */';
    assert.throws(() => X.aplicarHunks(editada.join('\n'), hunks, { query: nombre }), X.ErrorDif, `${nombre}: una línea editada no se detectó`);
    const corrida = ['-- linea nueva arriba', ...base].join('\n');
    assert.throws(() => X.aplicarHunks(corrida, hunks, { query: nombre }), X.ErrorDif, `${nombre}: un SQL con líneas corridas no se detectó`);
  }
});
test('parsearBloques: un marcador sin espacio ("-x", "+y") no se come la primera letra', () => {
  const r = X.parsearBloques(BLOQUE('Q', '@@ L1\n-x\n+y'));
  assert.deepEqual(r.Q[0], { linea: 1, viejas: ['x'], nuevas: ['y'] });
});
test('aplicarHunks: acepta los cambios en cualquier orden y NO modifica los que recibe (ni su orden)', () => {
  const h = [{ linea: 6, viejas: ['GROUP BY a.ConfigKey'], nuevas: ['GROUP BY a.EmailName'] }, { linea: 2, viejas: ['a.ConfigKey AS ConfigKey,'], nuevas: ['a.EmailName AS EmailName,'] }];
  const copia = JSON.stringify(h);
  const r = X.aplicarHunks(SQL, h, { query: 'Q' });
  assert.equal(JSON.stringify(h), copia, 'el arreglo recibido queda como estaba');
  assert.ok(r.includes('a.EmailName AS EmailName,') && r.endsWith('GROUP BY a.EmailName'));
});
